import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Printer,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { NotaSaidaRecord } from '../../types';
import { CertificateStatusInfo, formatChaveAcesso44 } from '../../lib/fiscalCertificate';

export type SefazModalStage = 'closed' | 'cert_warning' | 'transmitting' | 'authorized';

export interface SefazTransmissionModalProps {
  stage: SefazModalStage;
  currentStep: number; // 1..4
  targetNota: NotaSaidaRecord | null;
  certInfo: CertificateStatusInfo;
  ambienteEfetivo: 'homologacao' | 'producao';
  simulationMode: boolean;
  onClose: () => void;
  onGoToCompanySettings: () => void;
  onConfirmSimulation: () => void;
  onPrintAuthorized: (nota: NotaSaidaRecord) => void;
}

export const SefazTransmissionModal: React.FC<SefazTransmissionModalProps> = ({
  stage,
  currentStep,
  targetNota,
  certInfo,
  ambienteEfetivo,
  simulationMode,
  onClose,
  onGoToCompanySettings,
  onConfirmSimulation,
  onPrintAuthorized,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);

  if (stage === 'closed' || !targetNota) return null;

  const shortDoc = (targetNota.tipoDocumento || 'NF-e').split(' ')[0].toUpperCase();
  const ambienteLabel =
    ambienteEfetivo === 'producao'
      ? 'Produção (Validade Jurídica)'
      : 'Homologação (Testes / Sem Valor Fiscal)';

  const handleCopyChave = async () => {
    if (!targetNota.chaveAcesso) return;
    try {
      await navigator.clipboard.writeText(targetNota.chaveAcesso);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const transmissionSteps = [
    '1. Validando schema XML...',
    simulationMode
      ? '2. Assinando lote em Modo Homologação / Simulação...'
      : '2. Assinando lote com Certificado A1...',
    `3. Transmitindo para SEFAZ (${ambienteEfetivo === 'producao' ? 'Produção' : 'Homologação'})...`,
    `4. Retorno: Autorizado o uso da ${shortDoc}`,
  ];

  return (
    <div
      id="modal-transmissao-sefaz"
      className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}
    >
      <div
        className="w-full max-w-xl bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden text-black dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial */}
        <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-black flex items-center justify-center shrink-0">
              {stage === 'cert_warning' ? (
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              ) : stage === 'authorized' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <Send className="w-4 h-4 text-emerald-700" />
              )}
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-stone-100">
                {stage === 'cert_warning'
                  ? 'Certificado Digital A1 Necessário'
                  : stage === 'authorized'
                    ? `Autorização SEFAZ Confirmada (${shortDoc})`
                    : `Transmissão Fiscal SEFAZ (${shortDoc} Nº ${targetNota.numero})`}
              </h4>
              <p className="text-[10.5px] font-semibold text-slate-700 dark:text-stone-400 uppercase">
                {shortDoc} Nº {targetNota.numero} • Série {targetNota.serie || '1'} • {ambienteLabel}
              </p>
            </div>
          </div>

          {stage !== 'transmitting' && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Conteúdo por Etapa */}
        <div className="p-4 bg-[#cad4e6] dark:bg-stone-950 space-y-3">
          {stage === 'cert_warning' && (
            <>
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs text-slate-900 dark:text-stone-200">
                    <p className="font-black uppercase text-amber-900 dark:text-amber-300">
                      {certInfo.isExpired
                        ? `O Certificado Digital A1 venceu em ${certInfo.formattedValidade}!`
                        : 'Nenhum Certificado Digital A1 (.pfx/.p12) ativo foi importado.'}
                    </p>
                    <p className="leading-relaxed font-medium text-slate-700 dark:text-stone-300">
                      Para assinar e transmitir documentos fiscais com validade jurídica, importe o arquivo <strong>.pfx / .p12</strong> em <strong>Dados da Empresa</strong>. Se preferir testar ou emitir o documento agora, utilize o <strong>Modo Simulação / Homologação</strong>.
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
                <button
                  type="button"
                  onClick={onGoToCompanySettings}
                  className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Ir para Dados da Empresa</span>
                </button>
                <button
                  type="button"
                  onClick={onConfirmSimulation}
                  className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 text-xs font-bold uppercase shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Continuar em Modo Simulação / Homologação</span>
                </button>
              </div>
            </>
          )}

          {stage === 'transmitting' && (
            <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-800 dark:text-stone-200">
                <span>Processando Lote Eletrônico</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {Math.min(currentStep, 4)} / 4
                </span>
              </div>

              <div className="w-full h-2.5 bg-white dark:bg-stone-900 rounded-full border border-black/30 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, currentStep * 25)}%` }}
                />
              </div>

              <div className="space-y-2 pt-1">
                {transmissionSteps.map((label, idx) => {
                  const stepNum = idx + 1;
                  const isDone = currentStep > stepNum || (stepNum === 4 && currentStep >= 4);
                  const isRunning = currentStep === stepNum && stepNum < 4;
                  return (
                    <div
                      key={label}
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg border text-xs font-bold transition ${
                        isDone
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200'
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
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stage === 'authorized' && (
            <>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-600 rounded-xl p-4 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                      ✅ AUTORIZADA PELA SEFAZ
                    </span>
                    <h5 className="text-sm font-black text-emerald-950 dark:text-emerald-100 uppercase mt-0.5">
                      Uso da {shortDoc} autorizado com sucesso!
                    </h5>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5">
                    <span className="block text-[10px] font-black text-slate-500 uppercase">
                      Número da Nota / Série
                    </span>
                    <span className="font-mono font-black text-sm text-slate-900 dark:text-stone-100">
                      Nº {targetNota.numero} / Série {targetNota.serie || '1'}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5">
                    <span className="block text-[10px] font-black text-slate-500 uppercase">
                      Ambiente SEFAZ
                    </span>
                    <span className="font-bold text-xs text-slate-900 dark:text-stone-100 uppercase">
                      {ambienteLabel}
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

                <div className="bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-800 rounded-lg p-2.5">
                  <span className="block text-[10px] font-black text-slate-500 uppercase">
                    Protocolo de Autorização SEFAZ
                  </span>
                  <span className="font-mono font-black text-xs text-emerald-800 dark:text-emerald-300">
                    {targetNota.protocoloAutorizacao || '-'}
                  </span>
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
                  <span>🖨️ IMPRIMIR NOTA AUTORIZADA (DANFE / DACTE / NFS-e)</span>
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
