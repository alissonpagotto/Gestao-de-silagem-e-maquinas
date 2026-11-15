import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Search,
  Landmark,
  FileText,
  FlaskConical,
  History,
  Check,
  Clock,
  Send,
} from 'lucide-react';
import {
  BankAccount,
  CompanyProfile,
  NotaSaidaRecord,
  ServiceOrder,
  SilageOrder,
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredCompanyProfile,
} from '../../lib/storage';
import { resolveBoletoBankMeta } from '../../utils/boletoUtils';
import {
  appendCnabRemessaHistory,
  BOLETOS_EMITIDOS_UPDATED_EVENT,
  BoletoEmitidoRecord,
  buildOpenReceivablesLookup,
  CnabRemessaHistoryRecord,
  CnabRetornoParsedRow,
  CnabRetornoParseResult,
  CnabStandard,
  generateCnabRemessaFile,
  generateSampleCnabRetornoContent,
  getStoredBoletosEmitidos,
  getStoredCnabRemessas,
  markBoletosStatus,
  parseCnabRetornoContent,
  triggerTextFileDownload,
} from '../../utils/cnabUtils';

export interface CnabBatchSettlePayload {
  rows: CnabRetornoParsedRow[];
  bankAccountId: string;
  fileName?: string;
}

interface CnabRemessaRetornoModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: BankAccount[];
  companyProfile?: CompanyProfile | null;
  orders: SilageOrder[];
  services: ServiceOrder[];
  notasSaida: NotaSaidaRecord[];
  onBatchSettleRetorno: (payload: CnabBatchSettlePayload) => {
    settledCount: number;
    creditedAmount: number;
    boletosUpdated: number;
  };
}

type ModalTab = 'remessa' | 'retorno';
type RemessaFilter = 'AGUARDANDO_REMESSA' | 'ENVIADO_BANCO' | 'LIQUIDADO' | 'ALL';

export const CnabRemessaRetornoModal: React.FC<CnabRemessaRetornoModalProps> = ({
  isOpen,
  onClose,
  bankAccounts = [],
  companyProfile,
  orders = [],
  services = [],
  notasSaida = [],
  onBatchSettleRetorno,
}) => {
  const effectiveCompany = useMemo(
    () => companyProfile || getStoredCompanyProfile(),
    [companyProfile]
  );

  const defaultBankAccount = useMemo(() => {
    return (
      bankAccounts.find((a) => a.isPriority || a.prioritaria) ||
      bankAccounts[0] ||
      null
    );
  }, [bankAccounts]);

  const [activeTab, setActiveTab] = useState<ModalTab>('remessa');
  const [boletos, setBoletos] = useState<BoletoEmitidoRecord[]>(() =>
    getStoredBoletosEmitidos()
  );
  const [remessasHistory, setRemessasHistory] = useState<CnabRemessaHistoryRecord[]>(() =>
    getStoredCnabRemessas()
  );

  // Aba 1 — Remessa
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [cnabStandard, setCnabStandard] = useState<CnabStandard>('CNAB_240');
  const [convenioCode, setConvenioCode] = useState<string>('');
  const [remessaFilter, setRemessaFilter] = useState<RemessaFilter>('AGUARDANDO_REMESSA');
  const [remessaSearch, setRemessaSearch] = useState<string>('');
  const [selectedBoletoIds, setSelectedBoletoIds] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Aba 2 — Retorno
  const [creditBankId, setCreditBankId] = useState<string>('');
  const [simStandard, setSimStandard] = useState<CnabStandard>('CNAB_240');
  const [retornoResult, setRetornoResult] = useState<CnabRetornoParseResult | null>(null);
  const [selectedRetornoIds, setSelectedRetornoIds] = useState<string[]>([]);
  const [retornoError, setRetornoError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const reloadRegistry = () => {
    setBoletos(getStoredBoletosEmitidos());
    setRemessasHistory(getStoredCnabRemessas());
  };

  useEffect(() => {
    if (!isOpen) return;
    reloadRegistry();
    setRetornoError('');
    if (!selectedBankId && defaultBankAccount?.id) {
      setSelectedBankId(defaultBankAccount.id);
      setConvenioCode(defaultBankAccount.accountNumber || '');
    }
    if (!creditBankId && defaultBankAccount?.id) {
      setCreditBankId(defaultBankAccount.id);
    }
  }, [isOpen, defaultBankAccount]);

  useEffect(() => {
    const onSync = () => reloadRegistry();
    window.addEventListener(BOLETOS_EMITIDOS_UPDATED_EVENT, onSync);
    window.addEventListener('storage', onSync);
    return () => {
      window.removeEventListener(BOLETOS_EMITIDOS_UPDATED_EVENT, onSync);
      window.removeEventListener('storage', onSync);
    };
  }, []);

  const selectedRemessaBank = useMemo(
    () => bankAccounts.find((a) => a.id === selectedBankId) || defaultBankAccount,
    [bankAccounts, selectedBankId, defaultBankAccount]
  );

  const selectedCreditBank = useMemo(
    () => bankAccounts.find((a) => a.id === creditBankId) || defaultBankAccount,
    [bankAccounts, creditBankId, defaultBankAccount]
  );

  const countsByStatus = useMemo(() => {
    const waiting = boletos.filter((b) => b.statusRegistro === 'AGUARDANDO_REMESSA').length;
    const sent = boletos.filter((b) => b.statusRegistro === 'ENVIADO_BANCO').length;
    const paid = boletos.filter((b) => b.statusRegistro === 'LIQUIDADO').length;
    return { waiting, sent, paid, all: boletos.length };
  }, [boletos]);

  const filteredBoletos = useMemo(() => {
    const q = remessaSearch.trim().toLowerCase();
    return boletos.filter((b) => {
      const matchesStatus =
        remessaFilter === 'ALL' || b.statusRegistro === remessaFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        (b.clienteNome || '').toLowerCase().includes(q) ||
        (b.nossoNumero || '').toLowerCase().includes(q) ||
        (b.numeroDocumento || '').toLowerCase().includes(q) ||
        (b.parcela || '').toLowerCase().includes(q)
      );
    });
  }, [boletos, remessaFilter, remessaSearch]);

  // Auto-seleciona todos os aguardando remessa quando abrir nessa aba
  useEffect(() => {
    if (!isOpen) return;
    if (remessaFilter === 'AGUARDANDO_REMESSA') {
      setSelectedBoletoIds(
        boletos
          .filter((b) => b.statusRegistro === 'AGUARDANDO_REMESSA')
          .map((b) => b.id)
      );
    }
  }, [isOpen, remessaFilter, boletos.length]);

  const selectedBoletosList = useMemo(
    () => boletos.filter((b) => selectedBoletoIds.includes(b.id)),
    [boletos, selectedBoletoIds]
  );

  const selectedBoletosTotal = useMemo(
    () => selectedBoletosList.reduce((acc, b) => acc + (Number(b.valor) || 0), 0),
    [selectedBoletosList]
  );

  const openReceivablesLookup = useMemo(
    () => buildOpenReceivablesLookup(orders, services, notasSaida),
    [orders, services, notasSaida]
  );

  const showNotice = (type: 'success' | 'error', message: string) => {
    setFeedbackToast({ type, message });
    setTimeout(() => {
      setFeedbackToast((curr) => (curr?.message === message ? null : curr));
    }, 6000);
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredBoletos.map((b) => b.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedBoletoIds.includes(id));
    if (allSelected) {
      setSelectedBoletoIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedBoletoIds(Array.from(new Set([...selectedBoletoIds, ...visibleIds])));
    }
  };

  const toggleSelectBoleto = (id: string) => {
    setSelectedBoletoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDownloadRemessa = () => {
    if (selectedBoletosList.length === 0) {
      showNotice('error', 'Selecione pelo menos 1 boleto na tabela para gerar o arquivo remessa.');
      return;
    }

    const res = generateCnabRemessaFile({
      boletos: selectedBoletosList,
      standard: cnabStandard,
      bankAccount: selectedRemessaBank,
      companyProfile: effectiveCompany,
      convenio: convenioCode,
    });

    triggerTextFileDownload(res.fileName, res.content);

    const remessaId = `rem_${Date.now()}`;
    const bankMeta = resolveBoletoBankMeta(selectedRemessaBank);
    const boletoIds = selectedBoletosList.map((b) => b.id);

    markBoletosStatus(boletoIds, 'ENVIADO_BANCO', {
      remessaId,
      remessaArquivo: res.fileName,
      dataEnvioRemessa: new Date().toISOString().split('T')[0],
    });

    appendCnabRemessaHistory({
      id: remessaId,
      fileName: res.fileName,
      standard: res.standard,
      bankAccountId: selectedRemessaBank?.id || '',
      bankCode: bankMeta.code,
      bankName: bankMeta.shortName,
      convenio: convenioCode,
      sequencialArquivo: res.sequencialArquivo,
      boletosCount: res.boletosCount,
      totalAmount: res.totalAmount,
      boletoIds,
      createdAt: new Date().toISOString(),
    });

    reloadRegistry();
    setSelectedBoletoIds([]);
    showNotice(
      'success',
      `Arquivo ${res.fileName} (${cnabStandard === 'CNAB_240' ? 'CNAB 240' : 'CNAB 400'}) baixado com ${res.boletosCount} boleto(s)! Status atualizado para ✅ ENVIADO AO BANCO.`
    );
  };

  const processRetornoText = (text: string, fileName?: string) => {
    try {
      setRetornoError('');
      const parsed = parseCnabRetornoContent(
        text,
        boletos,
        openReceivablesLookup,
        fileName
      );
      if (parsed.rows.length === 0) {
        setRetornoError(
          'Nenhum registro de detalhe (Segmento T/U ou Registro Tipo 1) encontrado no arquivo.'
        );
        setRetornoResult(null);
        return;
      }
      setRetornoResult(parsed);
      const autoCheckIds = parsed.rows
        .filter((r) => r.ocorrenciaTipo === 'LIQUIDACAO' && !r.alreadyLiquidated)
        .map((r) => r.id);
      setSelectedRetornoIds(autoCheckIds);
      showNotice(
        'success',
        `Arquivo retorno lido (${parsed.standard === 'CNAB_240' ? 'CNAB 240' : 'CNAB 400'}): ${parsed.rows.length} ocorrência(s) e ${parsed.totalLiquidacoes} liquidação(ões).`
      );
    } catch (err: any) {
      setRetornoError(err?.message || 'Não foi possível interpretar o arquivo retorno.');
      setRetornoResult(null);
    }
  };

  const handleFileUpload = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result || '');
      processRetornoText(content, file.name);
    };
    reader.onerror = () => {
      setRetornoError('Falha ao ler o arquivo selecionado.');
    };
    reader.readAsText(file, 'latin1');
  };

  const handleSimulateRetorno = () => {
    const sample = generateSampleCnabRetornoContent(
      boletos,
      openReceivablesLookup,
      selectedCreditBank,
      effectiveCompany,
      simStandard
    );
    processRetornoText(sample.content, sample.fileName);
  };

  const toggleRetornoRow = (rowId: string) => {
    setSelectedRetornoIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const selectedLiquidationRows = useMemo(() => {
    if (!retornoResult) return [];
    return retornoResult.rows.filter(
      (r) => selectedRetornoIds.includes(r.id) && r.ocorrenciaTipo === 'LIQUIDACAO'
    );
  }, [retornoResult, selectedRetornoIds]);

  const selectedLiquidationTotal = useMemo(
    () => selectedLiquidationRows.reduce((acc, r) => acc + (Number(r.valorPago) || 0), 0),
    [selectedLiquidationRows]
  );

  const handleConfirmBatchAutoSettle = () => {
    if (!retornoResult || selectedLiquidationRows.length === 0) {
      showNotice(
        'error',
        'Selecione pelo menos 1 título com ocorrência de Liquidação para confirmar a baixa automática.'
      );
      return;
    }
    if (!selectedCreditBank?.id) {
      showNotice(
        'error',
        'Selecione a Conta Bancária de destino para creditar os valores recebidos.'
      );
      return;
    }

    const result = onBatchSettleRetorno({
      rows: selectedLiquidationRows,
      bankAccountId: selectedCreditBank.id,
      fileName: retornoResult.fileName,
    });

    const settledRowIds = new Set(selectedLiquidationRows.map((r) => r.id));
    setRetornoResult((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r) =>
              settledRowIds.has(r.id) ? { ...r, alreadyLiquidated: true } : r
            ),
          }
        : null
    );
    setSelectedRetornoIds([]);
    reloadRegistry();

    showNotice(
      'success',
      `Baixa automática concluída! ${result.boletosUpdated} boleto(s) liquidado(s), ${result.settledCount} título(s) quitado(s) no Contas a Receber e ${formatCurrencyBRL(
        result.creditedAmount
      )} creditado(s) na conta ${selectedCreditBank.bankName || selectedCreditBank.name}.`
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-70 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}
    >
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden text-black">
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#cad4e6] border-b border-black shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#e0e6f1] border border-black flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5 text-black stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-black">
                  🏦 REMESSA &amp; RETORNO BANCÁRIO (CNAB 240 / 400)
                </h3>
                <span className="px-2 py-0.5 rounded bg-white border border-black text-[10px] font-black text-blue-900 uppercase">
                  {countsByStatus.waiting} Aguardando Remessa
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-800 text-[10px] font-black text-emerald-950 uppercase">
                  {countsByStatus.sent} Enviados ao Banco
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-800 truncate">
                Registro oficial de boletos em lote (.REM) e baixa automática bancária via arquivo retorno (.RET) sem custos de API externa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#e0e6f1] hover:bg-white border border-black flex items-center justify-center text-black transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BARRA DE ABAS PRINCIPAIS */}
        <div className="px-5 py-2.5 bg-[#e0e6f1] border-b border-black flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('remessa')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black border border-black transition cursor-pointer uppercase ${
                activeTab === 'remessa'
                  ? 'bg-orange-400/50 text-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>📤 GERAR ARQUIVO REMESSA (.REM)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('retorno')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black border border-black transition cursor-pointer uppercase ${
                activeTab === 'retorno'
                  ? 'bg-orange-400/50 text-black shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>📥 IMPORTAR ARQUIVO RETORNO (.RET) — BAIXA AUTOMÁTICA</span>
            </button>
          </div>

          {activeTab === 'remessa' && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-50 border border-black text-black cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>
                {showHistory
                  ? 'Ocultar Histórico'
                  : `Histórico de Remessas (${remessasHistory.length})`}
              </span>
            </button>
          )}
        </div>

        {/* TOAST DE FEEDBACK */}
        {feedbackToast && (
          <div
            className={`mx-5 mt-3 px-4 py-2.5 rounded-lg border border-black text-xs font-bold flex items-center justify-between shrink-0 ${
              feedbackToast.type === 'success'
                ? 'bg-emerald-100 text-emerald-950'
                : 'bg-red-100 text-red-950'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
              )}
              <span>{feedbackToast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackToast(null)}
              className="p-0.5 hover:bg-black/10 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* CORPO PRINCIPAL */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#cad4e6]">
          {activeTab === 'remessa' ? (
            <>
              {/* CARD DE CONFIGURAÇÃO DA REMESSA */}
              <div className="bg-[#e0e6f1] border border-black rounded-lg p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="block text-[10px] font-black uppercase text-black mb-1">
                    Conta Bancária Cedente (Banco Emissor)
                  </label>
                  <select
                    value={selectedRemessaBank?.id || ''}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedBankId(nextId);
                      const found = bankAccounts.find((a) => a.id === nextId);
                      if (found?.accountNumber) setConvenioCode(found.accountNumber);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-black rounded-lg text-black outline-none"
                  >
                    {bankAccounts.length > 0 ? (
                      bankAccounts.map((acc) => {
                        const meta = resolveBoletoBankMeta(acc);
                        return (
                          <option key={acc.id} value={acc.id}>
                            {meta.code} - {acc.bankName || acc.name} (Ag {acc.agency || '0001'} / Cc {acc.accountNumber || '-'})
                          </option>
                        );
                      })
                    ) : (
                      <option value="">748 - SICREDI / Conta Padrão</option>
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-black mb-1">
                    Layout CNAB
                  </label>
                  <select
                    value={cnabStandard}
                    onChange={(e) => setCnabStandard(e.target.value as CnabStandard)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-black rounded-lg text-black outline-none"
                  >
                    <option value="CNAB_240">CNAB 240 (Padrão)</option>
                    <option value="CNAB_400">CNAB 400 (Legado)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-black mb-1">
                    Código Convênio / Cedente
                  </label>
                  <input
                    type="text"
                    value={convenioCode}
                    onChange={(e) => setConvenioCode(e.target.value)}
                    placeholder="Ex: 748074"
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-black rounded-lg text-black outline-none"
                  />
                </div>

                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="button"
                    id="btn-baixar-remessa-cnab"
                    onClick={handleDownloadRemessa}
                    disabled={selectedBoletosList.length === 0}
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black border border-black uppercase transition ${
                      selectedBoletosList.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                        : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>💾 BAIXAR ARQUIVO REMESSA (.REM)</span>
                  </button>
                </div>
              </div>

              {/* HISTÓRICO DE REMESSAS (OPCIONAL) */}
              {showHistory && (
                <div className="bg-[#e0e6f1] border border-black rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-black">
                      Histórico de Arquivos Remessa Gerados
                    </span>
                    <span className="text-[10px] font-bold text-slate-700">
                      Últimos {remessasHistory.length} envios
                    </span>
                  </div>
                  {remessasHistory.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto bg-white border border-black rounded-lg">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 border-b border-black font-black uppercase text-[10px]">
                          <tr>
                            <th className="py-1.5 px-2.5">Arquivo</th>
                            <th className="py-1.5 px-2.5">Layout</th>
                            <th className="py-1.5 px-2.5">Banco</th>
                            <th className="py-1.5 px-2.5 text-center">Boletos</th>
                            <th className="py-1.5 px-2.5 text-right">Valor Total</th>
                            <th className="py-1.5 px-2.5 text-right">Data</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {remessasHistory.map((h) => (
                            <tr key={h.id}>
                              <td className="py-1.5 px-2.5 font-mono font-bold text-blue-900">
                                {h.fileName}
                              </td>
                              <td className="py-1.5 px-2.5 font-bold">
                                {h.standard === 'CNAB_240' ? 'CNAB 240' : 'CNAB 400'}
                              </td>
                              <td className="py-1.5 px-2.5 font-semibold">
                                {h.bankCode} - {h.bankName}
                              </td>
                              <td className="py-1.5 px-2.5 text-center font-bold">
                                {h.boletosCount}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-black">
                                {formatCurrencyBRL(h.totalAmount)}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-medium">
                                {formatDateBR(h.createdAt.split('T')[0])}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-slate-700 bg-white border border-black rounded-lg p-2.5">
                      Nenhum arquivo remessa gerado até o momento.
                    </p>
                  )}
                </div>
              )}

              {/* BARRA DE FILTROS DA TABELA DE BOLETOS */}
              <div className="bg-[#e0e6f1] border border-black rounded-lg px-3 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRemessaFilter('AGUARDANDO_REMESSA')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border border-black cursor-pointer transition ${
                      remessaFilter === 'AGUARDANDO_REMESSA'
                        ? 'bg-amber-300 text-black'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Aguardando Remessa ({countsByStatus.waiting})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemessaFilter('ENVIADO_BANCO')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border border-black cursor-pointer transition ${
                      remessaFilter === 'ENVIADO_BANCO'
                        ? 'bg-blue-200 text-black'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Já Enviados ({countsByStatus.sent})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemessaFilter('LIQUIDADO')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border border-black cursor-pointer transition ${
                      remessaFilter === 'LIQUIDADO'
                        ? 'bg-emerald-200 text-black'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Liquidados ({countsByStatus.paid})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemessaFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border border-black cursor-pointer transition ${
                      remessaFilter === 'ALL'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Todos ({countsByStatus.all})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar cliente, Nosso Número, Doc..."
                    value={remessaSearch}
                    onChange={(e) => setRemessaSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1 text-xs border border-black rounded-lg bg-white text-black placeholder-slate-400 outline-none"
                  />
                </div>
              </div>

              {/* TABELA DE BOLETOS PARA REMESSA */}
              <div className="bg-white border border-black rounded-lg overflow-hidden">
                <div className="max-h-[46vh] overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-[#e0e6f1] border-b border-black text-[10px] font-black uppercase text-black">
                      <tr>
                        <th className="py-2 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredBoletos.length > 0 &&
                              filteredBoletos.every((b) => selectedBoletoIds.includes(b.id))
                            }
                            onChange={toggleSelectAllVisible}
                            className="w-3.5 h-3.5 cursor-pointer accent-emerald-700"
                            title="Selecionar todos visíveis"
                          />
                        </th>
                        <th className="py-2 px-2.5">Status</th>
                        <th className="py-2 px-2.5">Nosso Número</th>
                        <th className="py-2 px-2.5">Nº Documento</th>
                        <th className="py-2 px-2.5">Cliente / Pagador</th>
                        <th className="py-2 px-2.5 text-center">Parcela</th>
                        <th className="py-2 px-2.5">Vencimento</th>
                        <th className="py-2 px-2.5 text-right pr-3">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredBoletos.length > 0 ? (
                        filteredBoletos.map((b) => {
                          const isChecked = selectedBoletoIds.includes(b.id);
                          return (
                            <tr
                              key={b.id}
                              onClick={() => toggleSelectBoleto(b.id)}
                              className={`cursor-pointer transition ${
                                isChecked
                                  ? 'bg-emerald-50/80'
                                  : 'even:bg-[#f2f2f2] odd:bg-white hover:bg-slate-100'
                              }`}
                            >
                              <td
                                className="py-2 px-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSelectBoleto(b.id)}
                                  className="w-3.5 h-3.5 cursor-pointer accent-emerald-700"
                                />
                              </td>
                              <td className="py-2 px-2.5 whitespace-nowrap">
                                {b.statusRegistro === 'LIQUIDADO' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-700 text-emerald-950 text-[10px] font-black uppercase">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>LIQUIDADO</span>
                                  </span>
                                ) : b.statusRegistro === 'ENVIADO_BANCO' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 border border-blue-700 text-blue-950 text-[10px] font-black uppercase">
                                    <Send className="w-3 h-3" />
                                    <span>✅ ENVIADO AO BANCO</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-700 text-amber-950 text-[10px] font-black uppercase">
                                    <Clock className="w-3 h-3" />
                                    <span>AGUARDANDO REMESSA</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2.5 font-mono font-bold text-black whitespace-nowrap">
                                {b.nossoNumero}
                              </td>
                              <td className="py-2 px-2.5 font-semibold text-slate-800 whitespace-nowrap">
                                {b.numeroDocumento}
                              </td>
                              <td className="py-2 px-2.5">
                                <div className="font-bold text-black">{b.clienteNome}</div>
                                <div className="text-[10px] text-slate-600">
                                  Banco {b.bancoCodigo} {b.bancoNome || ''} • Cart. {b.carteira}
                                  {b.remessaArquivo ? ` • Rem: ${b.remessaArquivo}` : ''}
                                </div>
                              </td>
                              <td className="py-2 px-2.5 text-center font-bold whitespace-nowrap">
                                {b.parcela}
                              </td>
                              <td className="py-2 px-2.5 font-bold whitespace-nowrap">
                                {formatDateBR(b.vencimento)}
                              </td>
                              <td className="py-2 px-2.5 text-right font-black text-black whitespace-nowrap pr-3">
                                {formatCurrencyBRL(b.valor)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-8 text-center text-xs font-bold text-slate-600"
                          >
                            {boletos.length === 0
                              ? 'Nenhum boleto emitido ainda. Gere boletos no botão "🧾 GERAR / VISUALIZAR BOLETOS" ao baixar ou faturar um título para listá-los aqui automaticamente.'
                              : 'Nenhum boleto encontrado para este filtro.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* ABA 2 — IMPORTAR ARQUIVO RETORNO (.RET) */
            <>
              <div className="bg-[#e0e6f1] border border-black rounded-lg p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                <div className="lg:col-span-5">
                  <label className="block text-[10px] font-black uppercase text-black mb-1">
                    Conta Bancária de Crédito (Onde o banco depositou os boletos pagos)
                  </label>
                  <select
                    value={selectedCreditBank?.id || ''}
                    onChange={(e) => setCreditBankId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-black rounded-lg text-black outline-none"
                  >
                    {bankAccounts.length > 0 ? (
                      bankAccounts.map((acc) => {
                        const meta = resolveBoletoBankMeta(acc);
                        return (
                          <option key={acc.id} value={acc.id}>
                            {meta.code} - {acc.bankName || acc.name} (Saldo atual:{' '}
                            {formatCurrencyBRL(Number(acc.balance) || 0)})
                          </option>
                        );
                      })
                    ) : (
                      <option value="">Nenhuma conta cadastrada</option>
                    )}
                  </select>
                </div>

                <div className="lg:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-end justify-end gap-2">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-black mb-1">
                      Layout do Simulador
                    </label>
                    <select
                      value={simStandard}
                      onChange={(e) => setSimStandard(e.target.value as CnabStandard)}
                      className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-black rounded-lg text-black outline-none"
                    >
                      <option value="CNAB_240">CNAB 240</option>
                      <option value="CNAB_400">CNAB 400</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    id="btn-simular-retorno-cnab"
                    onClick={handleSimulateRetorno}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-300 hover:bg-amber-400 text-black border border-black text-xs font-black uppercase cursor-pointer shadow-xs"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>🧪 Simular Arquivo Retorno de Teste</span>
                  </button>
                </div>
              </div>

              {/* ÁREA DE DRAG & DROP PARA ARQUIVO .RET / .CRT */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  handleFileUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed border-black rounded-lg p-5 text-center cursor-pointer transition ${
                  isDragOver
                    ? 'bg-blue-100'
                    : 'bg-[#e0e6f1] hover:bg-white/90'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ret,.crt,.txt,.rem"
                  className="hidden"
                  onChange={(e) => {
                    handleFileUpload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-col items-center gap-1.5">
                  <FileCheck2 className="w-7 h-7 text-blue-900" />
                  <p className="text-xs font-black uppercase text-black">
                    Arraste e solte o arquivo Retorno (.RET / .CRT) do banco aqui ou clique para selecionar
                  </p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    Compatível com CNAB 240 (Segmentos T e U) e CNAB 400 (Registro Tipo 1) — Sicredi, Sicoob, BB, Itaú, Bradesco, Santander e Caixa
                  </p>
                </div>
              </div>

              {retornoError && (
                <div className="p-3 bg-red-100 border border-black rounded-lg text-xs font-bold text-red-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{retornoError}</span>
                </div>
              )}

              {/* TABELA DE CONFERÊNCIA DO ARQUIVO RETORNO */}
              {retornoResult && (
                <div className="space-y-2.5">
                  <div className="bg-[#e0e6f1] border border-black rounded-lg px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                      <FileText className="w-4 h-4 text-blue-900" />
                      <span>
                        Arquivo: <strong className="font-mono">{retornoResult.fileName || 'Retorno.RET'}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-black text-[10px] font-black">
                        {retornoResult.standard === 'CNAB_240' ? 'CNAB 240' : 'CNAB 400'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-black text-[10px] font-black">
                        Banco {retornoResult.bankCode} - {retornoResult.bankName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-black">
                      <span className="text-emerald-900">
                        Liquidações no Arquivo: {retornoResult.totalLiquidacoes} ({formatCurrencyBRL(retornoResult.totalValorPago)})
                      </span>
                      <button
                        type="button"
                        id="btn-confirmar-baixa-lote-cnab"
                        onClick={handleConfirmBatchAutoSettle}
                        disabled={selectedLiquidationRows.length === 0}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black border border-black uppercase transition ${
                          selectedLiquidationRows.length > 0
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                            : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>✅ CONFIRMAR E DAR BAIXA AUTOMÁTICA EM LOTE</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border border-black rounded-lg overflow-hidden">
                    <div className="max-h-[38vh] overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-[#e0e6f1] border-b border-black text-[10px] font-black uppercase text-black">
                          <tr>
                            <th className="py-2 px-3 w-10 text-center">Baixar</th>
                            <th className="py-2 px-2.5">Nosso Número</th>
                            <th className="py-2 px-2.5">Cliente</th>
                            <th className="py-2 px-2.5">Vencimento</th>
                            <th className="py-2 px-2.5 text-right">Valor Título</th>
                            <th className="py-2 px-2.5 text-right">Valor Pago no Banco</th>
                            <th className="py-2 px-2.5 text-right">Juros / Desconto</th>
                            <th className="py-2 px-2.5">Status da Ocorrência</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {retornoResult.rows.map((row) => {
                            const canSettle =
                              row.ocorrenciaTipo === 'LIQUIDACAO' && !row.alreadyLiquidated;
                            const isSelected = selectedRetornoIds.includes(row.id);
                            return (
                              <tr
                                key={row.id}
                                onClick={() => canSettle && toggleRetornoRow(row.id)}
                                className={`${
                                  canSettle ? 'cursor-pointer' : 'opacity-75'
                                } ${
                                  isSelected
                                    ? 'bg-emerald-50/90'
                                    : 'even:bg-[#f2f2f2] odd:bg-white'
                                }`}
                              >
                                <td
                                  className="py-2 px-3 text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={!canSettle}
                                    checked={isSelected}
                                    onChange={() => toggleRetornoRow(row.id)}
                                    className="w-3.5 h-3.5 accent-emerald-700 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="py-2 px-2.5 font-mono font-bold whitespace-nowrap">
                                  <div>{row.nossoNumero}</div>
                                  <div className="text-[10px] text-slate-600">
                                    Doc: {row.numeroDocumento}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5">
                                  <div className="font-bold text-black">{row.clienteNome}</div>
                                  <div className="text-[10px] font-semibold text-slate-600">
                                    {row.matchedContaReceberId
                                      ? `🔗 Vinculado (${row.matchedContaReceberTipo || 'Contas a Receber'})`
                                      : '⚠️ Título avulso / não encontrado no Contas a Receber'}
                                  </div>
                                </td>
                                <td className="py-2 px-2.5 font-bold whitespace-nowrap">
                                  {formatDateBR(row.vencimento)}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold whitespace-nowrap">
                                  {formatCurrencyBRL(row.valorTitulo)}
                                </td>
                                <td className="py-2 px-2.5 text-right font-black text-emerald-900 whitespace-nowrap">
                                  {row.ocorrenciaTipo === 'LIQUIDACAO'
                                    ? formatCurrencyBRL(row.valorPago)
                                    : '-'}
                                </td>
                                <td className="py-2 px-2.5 text-right text-[11px] font-semibold whitespace-nowrap">
                                  {row.jurosMulta > 0 && (
                                    <span className="text-blue-800 block">
                                      +{formatCurrencyBRL(row.jurosMulta)} Juros
                                    </span>
                                  )}
                                  {row.desconto > 0 && (
                                    <span className="text-amber-800 block">
                                      -{formatCurrencyBRL(row.desconto)} Desc.
                                    </span>
                                  )}
                                  {row.jurosMulta === 0 && row.desconto === 0 && (
                                    <span className="text-slate-500">R$ 0,00</span>
                                  )}
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  {row.alreadyLiquidated ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-700 text-emerald-950 text-[10px] font-black uppercase">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>JÁ LIQUIDADO</span>
                                    </span>
                                  ) : row.ocorrenciaTipo === 'LIQUIDACAO' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-700 text-emerald-950 text-[10px] font-black uppercase">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>{row.ocorrenciaDescricao}</span>
                                    </span>
                                  ) : row.ocorrenciaTipo === 'ENTRADA_CONFIRMADA' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 border border-blue-700 text-blue-950 text-[10px] font-black uppercase">
                                      <span>{row.ocorrenciaDescricao}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-700 text-amber-950 text-[10px] font-black uppercase">
                                      <span>{row.ocorrenciaDescricao}</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-[#cad4e6] border-t border-black shrink-0">
          <div className="text-xs font-bold text-black">
            {activeTab === 'remessa' ? (
              <>
                Selecionados para Remessa:{' '}
                <span className="font-black">{selectedBoletosList.length} boleto(s)</span> •
                Total do Lote:{' '}
                <span className="font-black">{formatCurrencyBRL(selectedBoletosTotal)}</span>
              </>
            ) : (
              <>
                Selecionados para Baixa Automática:{' '}
                <span className="font-black">
                  {selectedLiquidationRows.length} título(s)
                </span>{' '}
                • Crédito em Conta:{' '}
                <span className="font-black text-emerald-950">
                  {formatCurrencyBRL(selectedLiquidationTotal)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-black bg-white hover:bg-gray-100 border border-black rounded-lg shadow-2xs transition cursor-pointer uppercase"
            >
              <span>⬅️ VOLTAR</span>
            </button>

            {activeTab === 'remessa' ? (
              <button
                type="button"
                onClick={handleDownloadRemessa}
                disabled={selectedBoletosList.length === 0}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black border border-black rounded-lg shadow-2xs transition uppercase ${
                  selectedBoletosList.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>💾 BAIXAR ARQUIVO REMESSA (.REM)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmBatchAutoSettle}
                disabled={selectedLiquidationRows.length === 0}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black border border-black rounded-lg shadow-2xs transition uppercase ${
                  selectedLiquidationRows.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>✅ CONFIRMAR E DAR BAIXA AUTOMÁTICA EM LOTE</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
