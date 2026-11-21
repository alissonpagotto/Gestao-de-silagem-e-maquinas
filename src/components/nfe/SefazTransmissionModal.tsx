import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FileWarning,
  Loader2,
  Package,
  Printer,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { NotaSaidaRecord } from '../../types';
import { CertificateStatusInfo, formatChaveAcesso44 } from '../../lib/fiscalCertificate';
import { SefazValidationGroup, SefazValidationIssue } from '../../lib/sefazValidator';

export type SefazModalStage =
  | 'closed'
  | 'validation_error'
  | 'cert_warning'
  | 'transmitting'
  | 'authorized';

export interface SefazTransmissionModalProps {
  stage: SefazModalStage;
  currentStep: number; // 1..4
  targetNota: NotaSaidaRecord | null;
  certInfo: CertificateStatusInfo;
  ambienteEfetivo: 'homologacao' | 'producao';
  simulationMode: boolean;
  ufEmitente?: string;
  validationIssues?: SefazValidationIssue[];
  previewProtocoloNumero?: string;
  onClose: () => void;
  onGoToCompanySettings?: () => void;
  onConfirmSimulation: () => void;
  onPrintAuthorized: (nota: NotaSaidaRecord) => void;
}

const GROUP_META: Record<
  SefazValidationGroup,
  { label: string; icon: React.ReactNode }
> = {
  emitente: {
    label: 'Emitente (Dados da Empresa)',
    icon: <Building2 className="w-3.5 h-3.5 text-rose-700 shrink-0" />,
  },
  destinatario: {
    label: 'Destinatário (Cliente / Fornecedor)',
    icon: <UserCheck className="w-3.5 h-3.5 text-rose-700 shrink-0" />,
  },
  itens: {
    label: 'Itens / Produtos da Nota',
    icon: <Package className="w-3.5 h-3.5 text-rose-700 shrink-0" />,
  },
  devolucao: {
    label: 'Regra de Devolução (finNFe = 4)',
    icon: <FileWarning className="w-3.5 h-3.5 text-rose-700 shrink-0" />,
  },
};

export const SefazTransmissionModal: React.FC<SefazTransmissionModalProps> = ({
  stage,
  currentStep,
  targetNota,
  certInfo,
  ambienteEfetivo,
  simulationMode,
  ufEmitente = 'PR',
  validationIssues = [],
  previewProtocoloNumero,
  onClose,
  onGoToCompanySettings,
  onConfirmSimulation,
  onPrintAuthorized,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);

  if (stage === 'closed') return null;
  if (stage !== 'validation_error' && !targetNota) return null;

  const shortDoc = (targetNota?.tipoDocumento || 'NF-e').split(' ')[0].toUpperCase();
  const isNfe = shortDoc === 'NF-E' || shortDoc === 'NFE';
  const isHomologacao = ambienteEfetivo !== 'producao' || simulationMode;
  const ufCode = (ufEmitente || 'PR').trim().toUpperCase().slice(0, 2) || 'PR';

  const ambienteLabel = isHomologacao
    ? '2 - Homologação (Testes / Sem Valor Fiscal)'
    : '1 - Produção (Validade Jurídica)';

  const ambienteStepLabel = isHomologacao
    ? 'Certificado A1 / Ambiente Homologação'
    : 'Certificado A1 / Ambiente Produção';

  const protocoloRaw = String(targetNota?.protocoloAutorizacao || '').trim();
  const protocoloSomenteNumero =
    protocoloRaw.split(' - ')[0]?.trim() || previewProtocoloNumero || '14126...';

  const dataAutorizacaoBr = (() => {
    if (protocoloRaw.includes(' - ')) {
      return protocoloRaw.split(' - ')[1]?.trim() || '';
    }
    if (targetNota?.dataAutorizacao) {
      const d = new Date(targetNota.dataAutorizacao);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('pt-BR');
      }
    }
    return '';
  })();

  const handleCopyChave = async () => {
    if (!targetNota?.chaveAcesso) return;
    try {
      await navigator.clipboard.writeText(targetNota.chaveAcesso);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const transmissionSteps = [
    {
      step: 1,
      doneText: `✅ Validando Estrutura XML (Layout ${isNfe ? 'NF-e 4.00' : `${shortDoc} 4.00`})...`,
      runningText: `Validando Estrutura XML (Layout ${isNfe ? 'NF-e 4.00' : `${shortDoc} 4.00`})...`,
    },
    {
      step: 2,
      doneText: `✅ Assinando Digitalmente (${ambienteStepLabel})...`,
      runningText: `Assinando Digitalmente (${ambienteStepLabel})...`,
    },
    {
      step: 3,
      doneText: `✅ Transmitindo Lote para Webservice SEFAZ-${ufCode}...`,
      runningText: `Transmitindo Lote para Webservice SEFAZ-${ufCode}...`,
    },
    {
      step: 4,
      doneText: `🎉 AUTORIZADO O USO DA ${shortDoc} (cStat 100) — Protocolo Nº ${protocoloSomenteNumero}`,
      runningText: `Aguardando protocolo de retorno SEFAZ-${ufCode}...`,
    },
  ];

  const groupedIssues: Array<{ group: SefazValidationGroup; items: SefazValidationIssue[] }> = (
    ['emitente', 'destinatario', 'itens', 'devolucao'] as SefazValidationGroup[]
  )
    .map((group) => ({
      group,
      items: validationIssues.filter((i) => i.group === group),
    }))
    .filter((entry) => entry.items.length > 0);

  const hasEmitenteIssues = groupedIssues.some((g) => g.group === 'emitente');

  return (
    <div
      id="modal-transmissao-sefaz"
      className="fixed inset-0 z-[9998] bg-black/65 flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
      onClick={() => {
        if (stage !== 'transmitting') onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden text-black dark:text-stone-100 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial */}
        <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-black flex items-center justify-center shrink-0">
              {stage === 'validation_error' ? (
                <AlertOctagon className="w-4 h-4 text-rose-600" />
              ) : stage === 'cert_warning' ? (
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              ) : stage === 'authorized' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <Send className="w-4 h-4 text-emerald-700" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-stone-100 truncate">
                {stage === 'validation_error'
                  ? 'Alerta de Rejeição Pré-SEFAZ — Transmissão Bloqueada'
                  : stage === 'cert_warning'
                    ? 'Certificado Digital A1 Necessário para Produção'
                    : stage === 'authorized'
                      ? `Autorização SEFAZ-${ufCode} Confirmada (${shortDoc} • cStat 100)`
                      : `Transmissão SEFAZ-${ufCode} (${shortDoc} Nº ${targetNota?.numero || ''})`}
              </h4>
              <p className="text-[10.5px] font-semibold text-slate-700 dark:text-stone-400 uppercase truncate">
                {stage === 'validation_error'
                  ? `${validationIssues.length} ${
                      validationIssues.length === 1
                        ? 'campo obrigatório pendente ou inválido'
                        : 'campos obrigatórios pendentes ou inválidos'
                    } antes do envio ao Webservice SEFAZ-${ufCode}`
                  : `${shortDoc} Nº ${targetNota?.numero || ''} • Série ${targetNota?.serie || '1'} • ${ambienteLabel}`}
              </p>
            </div>
          </div>

          {stage !== 'transmitting' && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black transition cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Conteúdo por Etapa */}
        <div className="p-4 bg-[#cad4e6] dark:bg-stone-950 space-y-3 overflow-y-auto flex-1">
          {/* =============================================================== */}
          {/* ETAPA 0: ALERTA DE REJEIÇÃO PRÉ-SEFAZ (CRÍTICA FISCAL)          */}
          {/* =============================================================== */}
          {stage === 'validation_error' && (
            <>
              <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-600 rounded-xl p-3 space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-950 dark:text-rose-100 space-y-0.5">
                    <p className="font-black uppercase">
                      Crítica Fiscal Pré-SEFAZ (Layout NF-e 4.00)
                    </p>
                    <p className="font-medium text-rose-900/90 dark:text-rose-200 leading-snug">
                      A transmissão foi interrompida antes do envio à SEFAZ-{ufCode} porque existem
                      campos obrigatórios faltando ou inválidos. Corrija os itens abaixo e tente
                      transmitir novamente:
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {groupedIssues.map(({ group, items }) => {
                  const meta = GROUP_META[group];
                  return (
                    <div
                      key={group}
                      className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl overflow-hidden"
                    >
                      <div className="px-3 py-1.5 bg-white/80 dark:bg-stone-900 border-b border-black/30 dark:border-stone-700 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase text-slate-900 dark:text-stone-100">
                          {meta.icon}
                          <span>{meta.label}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 border border-rose-400 text-[10px] font-black text-rose-800 uppercase">
                          {items.length} {items.length === 1 ? 'pendência' : 'pendências'}
                        </span>
                      </div>
                      <ul className="divide-y divide-black/15 dark:divide-stone-700">
                        {items.map((issue, idx) => (
                          <li
                            key={`${issue.code}-${idx}`}
                            className="px-3 py-2 bg-white/60 dark:bg-stone-900/60 text-xs space-y-0.5"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-black">
                                {issue.code}
                              </span>
                              <span className="font-black text-slate-900 dark:text-stone-100 uppercase text-[11px]">
                                {issue.field}
                              </span>
                            </div>
                            <p className="font-bold text-rose-900 dark:text-rose-300 leading-snug">
                              {issue.message}
                            </p>
                            {issue.hint && (
                              <p className="text-[11px] font-medium text-slate-600 dark:text-stone-400">
                                💡 {issue.hint}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
                {hasEmitenteIssues && onGoToCompanySettings && (
                  <button
                    type="button"
                    onClick={onGoToCompanySettings}
                    className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-700 text-xs font-black uppercase cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Corrigir Dados da Empresa</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white border border-rose-900 text-xs font-black uppercase shadow-xs cursor-pointer"
                >
                  <span>Voltar e Corrigir Campos</span>
                </button>
              </div>
            </>
          )}

          {/* =============================================================== */}
          {/* ETAPA AVISO CERTIFICADO (PRODUÇÃO SEM CERTIFICADO A1)           */}
          {/* =============================================================== */}
          {stage === 'cert_warning' && targetNota && (
            <>
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs text-slate-900 dark:text-stone-200">
                    <p className="font-black uppercase text-amber-900 dark:text-amber-300">
                      {certInfo.isExpired
                        ? `O Certificado Digital A1 venceu em ${certInfo.formattedValidade}!`
                        : 'Ambiente de Produção configurado sem Certificado Digital A1 (.pfx/.p12) ativo.'}
                    </p>
                    <p className="leading-relaxed font-medium text-slate-700 dark:text-stone-300">
                      Para assinar e transmitir documentos fiscais com validade jurídica em{' '}
                      <strong>Produção</strong>, importe o arquivo <strong>.pfx / .p12</strong> em{' '}
                      <strong>Dados da Empresa</strong>. Você também pode continuar agora operando em{' '}
                      <strong>Modo Homologação (Sem Valor Fiscal)</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                {onGoToCompanySettings && (
                  <button
                    type="button"
                    onClick={onGoToCompanySettings}
                    className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black text-xs font-bold uppercase cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Ir para Dados da Empresa</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onConfirmSimulation}
                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 text-xs font-bold uppercase shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Transmitir em Modo Homologação</span>
                </button>
              </div>
            </>
          )}

          {/* =============================================================== */}
          {/* ETAPA TRANSMISSÃO EM TEMPO REAL (4 ETAPAS OFICIAIS SEFAZ)       */}
          {/* =============================================================== */}
          {stage === 'transmitting' && targetNota && (
            <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black uppercase text-slate-800 dark:text-stone-200">
                <span>Processando Lote Eletrônico — SEFAZ-{ufCode}</span>
                <div className="flex items-center gap-2">
                  {isHomologacao && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-500 text-amber-900 text-[10px] font-black">
                      HOMOLOGAÇÃO
                    </span>
                  )}
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    Etapa {Math.min(currentStep, 4)} / 4
                  </span>
                </div>
              </div>

              <div className="w-full h-2.5 bg-white dark:bg-stone-900 rounded-full border border-black/30 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, currentStep * 25)}%` }}
                />
              </div>

              <div className="space-y-2 pt-1">
                {transmissionSteps.map((st) => {
                  const isDone =
                    currentStep > st.step || (st.step === 4 && currentStep >= 4);
                  const isRunning = currentStep === st.step && st.step < 4;
                  return (
                    <div
                      key={st.step}
                      className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg border text-xs font-bold transition ${
                        isDone
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100'
                          : isRunning
                            ? 'bg-white dark:bg-stone-900 border-black text-slate-900 dark:text-stone-100 shadow-2xs'
                            : 'bg-white/50 dark:bg-stone-900/40 border-slate-300 dark:border-stone-700 text-slate-400'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : isRunning ? (
                        <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                      )}
                      <span className="leading-snug">
                        {isDone ? st.doneText : st.runningText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* ETAPA FINAL: RETORNO OFICIAL SEFAZ (cStat 100) + PROTOCOLO      */}
          {/* =============================================================== */}
          {stage === 'authorized' && targetNota && (
            <>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-600 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                          cStat 100 — AUTORIZADA PELA SEFAZ-{ufCode}
                        </span>
                        {isHomologacao && (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-500 text-[10px] font-black uppercase tracking-wider">
                            SELO HOMOLOGAÇÃO (SEM VALOR FISCAL)
                          </span>
                        )}
                      </div>
                      <h5 className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100 uppercase mt-1">
                        🎉 AUTORIZADO O USO DA {shortDoc} (cStat 100) — Protocolo Nº{' '}
                        <span className="font-mono">{protocoloSomenteNumero}</span>
                      </h5>
                    </div>
                  </div>
                </div>

                {/* Etapas concluídas resumidas */}
                <div className="bg-white/80 dark:bg-stone-900/80 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5 text-[11px] font-bold text-emerald-950 dark:text-emerald-200 space-y-1">
                  <div>✅ Validando Estrutura XML (Layout {isNfe ? 'NF-e 4.00' : `${shortDoc} 4.00`})...</div>
                  <div>✅ Assinando Digitalmente ({ambienteStepLabel})...</div>
                  <div>✅ Transmitindo Lote para Webservice SEFAZ-{ufCode}...</div>
                  <div className="text-emerald-800 dark:text-emerald-300 font-black">
                    🎉 AUTORIZADO O USO DA {shortDoc} (cStat 100) — Protocolo Nº {protocoloSomenteNumero}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5">
                    <span className="block text-[10px] font-black text-slate-500 uppercase">
                      Número / Série
                    </span>
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-stone-100">
                      Nº {targetNota.numero} / Série {targetNota.serie || '1'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5">
                    <span className="block text-[10px] font-black text-slate-500 uppercase">
                      Protocolo de Autorização
                    </span>
                    <span className="font-mono font-black text-xs text-emerald-800 dark:text-emerald-300 break-all">
                      {protocoloSomenteNumero}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5">
                    <span className="block text-[10px] font-black text-slate-500 uppercase">
                      Data / Hora Autorização
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-stone-100">
                      {dataAutorizacaoBr || new Date().toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase">
                      Chave de Acesso (44 dígitos)
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyChave()}
                      className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey ? 'Copiada!' : 'Copiar Chave'}</span>
                    </button>
                  </div>
                  <p className="font-mono font-bold text-xs text-slate-900 dark:text-stone-100 break-all tracking-wide">
                    {formatChaveAcesso44(targetNota.chaveAcesso)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  id="btn-imprimir-nota-autorizada"
                  onClick={() => onPrintAuthorized(targetNota)}
                  className="flex-1 inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 text-xs sm:text-sm font-black uppercase tracking-wide shadow-md transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Imprimir DANFE</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SefazTransmissionModal;
