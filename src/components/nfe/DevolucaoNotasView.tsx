import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Search,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Ban,
  PackageX,
  Eye,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import {
  Client,
  CompanyProfile,
  PendenciaDevolucaoRecord,
  PendenciaDevolucaoStatus,
  TrocaDevolucaoRecord,
} from '../../types';
import {
  formatDateBR,
  formatCurrencyBRL,
  getActiveCompanyId,
  getStoredClients,
  getStoredCompanyProfile,
  getStoredPendenciasDevolucao,
  getStoredTrocasDevolucoes,
  saveStoredPendenciasDevolucao,
  saveStoredTrocasDevolucoes,
} from '../../lib/storage';
import {
  NovaTrocaDevolucaoModal,
  TrocaDevolucaoDetailsModal,
} from '../vendas/NovaTrocaDevolucaoModal';
import {
  getTipoOperacaoLabel,
  printEspelhoFiscalDevolucaoA4,
  printTrocaDevolucaoA4,
  printTrocaDevolucaoCupom80mm,
} from '../vendas/trocaDevolucaoPrintUtils';
import {
  CompetenceSelector,
  getPrevCompetence,
  getNextCompetence,
  matchesCompetence,
} from '../financial/CompetenceSelector';

export const NOTAS_DEVOLUCAO_KEY = 'colaca_silagem_notas_devolucao';
const TROCAS_STORAGE_KEY = 'agrocontrol_trocas_devolucoes';

export interface DevolucaoItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface NotaDevolucao {
  id: string;
  devolucaoNumber: string;
  originInvoiceNumber: string;
  originInvoiceKey?: string;
  issueDate: string;
  supplierId?: string;
  supplierName: string;
  supplierCnpj?: string;
  reason: string;
  items: DevolucaoItem[];
  totalAmount: number;
  status: 'Autorizada' | 'Emitida' | 'Cancelada';
  notes?: string;
  createdAt: string;
}

export function getStoredNotasDevolucao(): NotaDevolucao[] {
  try {
    const raw = localStorage.getItem(NOTAS_DEVOLUCAO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((d) => d && d.id !== 'dev_mock_1');
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar notas de devolução:', e);
  }
  return [];
}

function isFiscalRelevantTroca(rec: TrocaDevolucaoRecord): boolean {
  if (!rec) return false;
  if (rec.fiscalStatus) return true;
  if (rec.tipoOperacao === 'devolucao_fornecedor') return true;
  if (Array.isArray(rec.itensDevolvidos) && rec.itensDevolvidos.some((it) => it.returnToStock === false)) {
    return true;
  }
  return false;
}

function normalizeMotivo(motivoRaw?: string): TrocaDevolucaoRecord['motivo'] {
  const m = String(motivoRaw || '').toLowerCase();
  if (m.includes('garantia')) return 'Garantia';
  if (m.includes('tamanho') || m.includes('modelo') || m.includes('incompat')) {
    return 'Tamanho/Modelo Incorreto';
  }
  if (m.includes('desist')) return 'Desistência';
  if (m.includes('defeito') || m.includes('avaria')) return 'Defeito';
  return motivoRaw?.trim() || 'Garantia';
}

/**
 * Lê a fonte única compartilhada (`agrocontrol_trocas_devolucoes`), sincronizando
 * silenciosamente quaisquer registros legados que ainda existiam em
 * `agrocontrol_pendencias_devolucao` ou `colaca_silagem_notas_devolucao`.
 */
export function getUnifiedFiscalDevolucoes(): TrocaDevolucaoRecord[] {
  const trocas = getStoredTrocasDevolucoes();
  const pendencias = getStoredPendenciasDevolucao();
  const legacyNotas = getStoredNotasDevolucao();

  let mutatedTrocas = false;
  const trocasMap = new Map<string, TrocaDevolucaoRecord>();
  const orderedTrocas: TrocaDevolucaoRecord[] = trocas.map((rec) => {
    const clone = { ...rec };
    trocasMap.set(clone.id, clone);
    return clone;
  });

  // 1. Garante fiscalStatus nos registros de troca que exigem decisão fiscal
  const pendByTrocaOrProto = new Map<string, PendenciaDevolucaoRecord>();
  pendencias.forEach((p) => {
    if (p.trocaRecordId) pendByTrocaOrProto.set(`id:${p.trocaRecordId}`, p);
    if (p.protocolo) pendByTrocaOrProto.set(`proto:${p.protocolo}`, p);
  });

  orderedTrocas.forEach((rec) => {
    if (isFiscalRelevantTroca(rec) && !rec.fiscalStatus) {
      const matchedPend =
        pendByTrocaOrProto.get(`id:${rec.id}`) ||
        pendByTrocaOrProto.get(`proto:${rec.protocolo}`);
      rec.fiscalStatus = matchedPend?.status || 'Aguardando Decisão Fiscal';
      if (matchedPend?.notaDevolucaoNumber && !rec.notaDevolucaoNumber) {
        rec.notaDevolucaoNumber = matchedPend.notaDevolucaoNumber;
      }
      if (matchedPend?.justificativaDescarte && !rec.justificativaDescarte) {
        rec.justificativaDescarte = matchedPend.justificativaDescarte;
      }
      if (matchedPend?.decidedAt && !rec.fiscalDecidedAt) {
        rec.fiscalDecidedAt = matchedPend.decidedAt;
      }
      mutatedTrocas = true;
    }
  });

  // 2. Migra pendências legadas sem registro pai em agrocontrol_trocas_devolucoes
  const existingProtocols = new Set(orderedTrocas.map((r) => String(r.protocolo || '').trim()));
  const existingIds = new Set(orderedTrocas.map((r) => String(r.id || '').trim()));

  pendencias.forEach((p) => {
    const hasParentById = p.trocaRecordId && existingIds.has(String(p.trocaRecordId));
    const hasParentByProto = p.protocolo && existingProtocols.has(String(p.protocolo).trim());
    const legacyId = `legacy_pend_${p.id}`;
    if (hasParentById || hasParentByProto || existingIds.has(legacyId)) return;

    const isFornecedor = p.origemTipo === 'devolucao_fornecedor';
    const migrated: TrocaDevolucaoRecord = {
      id: legacyId,
      companyId: p.companyId || getActiveCompanyId(),
      protocolo: p.protocolo || `DEV-LEG-${String(p.id).slice(-4)}`,
      data: p.data || (p.createdAt ? p.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      tipoOperacao: isFornecedor ? 'devolucao_fornecedor' : 'devolucao_cliente',
      envolvidoTipo: isFornecedor ? 'fornecedor' : 'cliente',
      envolvidoId: p.fornecedorId,
      envolvidoNome: isFornecedor
        ? p.fornecedorNome || 'Fornecedor'
        : p.clienteNome || p.fornecedorNome || 'Consumidor Balcão',
      envolvidoDocumento: p.fornecedorCnpj,
      numeroVendaOuNotaOrigem: p.numeroNotaOuVendaOrigem,
      motivo: normalizeMotivo(p.motivo),
      observacoes: p.observacoes,
      itensDevolvidos: [
        {
          id: `item_${p.id}`,
          productId: p.productId || '',
          productCode: p.productCode,
          productName: p.productName || 'Item devolvido',
          unit: p.unit || 'UN',
          quantity: Number(p.quantidade || 1),
          unitPrice: Number(p.valorUnitario || 0),
          totalPrice: Number(p.valorTotal || 0),
          returnToStock: false,
        },
      ],
      itensLevados: [],
      totalDevolvido: Number(p.valorTotal || 0),
      totalLevado: 0,
      saldoFinal: Number(p.valorTotal || 0),
      destinoFinanceiro: p.boletoAbatido ? 'abatimento_boleto' : 'credito_fornecedor',
      destinoFinanceiroLabel: p.boletoAbatido
        ? `Abatimento em Boleto (${p.boletoAbatido.documento || 'Parcela'})`
        : 'Crédito / Aguardando Decisão Fiscal',
      boletoAbatido: p.boletoAbatido,
      fiscalStatus: p.status || 'Aguardando Decisão Fiscal',
      notaDevolucaoNumber: p.notaDevolucaoNumber,
      justificativaDescarte: p.justificativaDescarte,
      fiscalDecidedAt: p.decidedAt,
      createdAt: p.createdAt || new Date().toISOString(),
    };
    orderedTrocas.push(migrated);
    existingIds.add(migrated.id);
    existingProtocols.add(migrated.protocolo);
    mutatedTrocas = true;
  });

  // 3. Migra notas de devolução antigas (colaca_silagem_notas_devolucao)
  const existingNotasDevNums = new Set(
    orderedTrocas
      .map((r) => String(r.notaDevolucaoNumber || '').trim().toUpperCase())
      .filter(Boolean)
  );

  legacyNotas.forEach((n) => {
    const devNum = String(n.devolucaoNumber || '').trim();
    const legacyId = `legacy_nfdev_${n.id}`;
    if (
      existingIds.has(legacyId) ||
      (devNum && (existingProtocols.has(devNum) || existingNotasDevNums.has(devNum.toUpperCase())))
    ) {
      return;
    }
    const isCanceled = n.status === 'Cancelada';
    const migratedNota: TrocaDevolucaoRecord = {
      id: legacyId,
      companyId: getActiveCompanyId(),
      protocolo: devNum || `DEV-NF-${String(n.id).slice(-4)}`,
      data: n.issueDate || (n.createdAt ? n.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      tipoOperacao: 'devolucao_fornecedor',
      envolvidoTipo: 'fornecedor',
      envolvidoId: n.supplierId,
      envolvidoNome: n.supplierName || 'Fornecedor',
      envolvidoDocumento: n.supplierCnpj,
      numeroVendaOuNotaOrigem: n.originInvoiceNumber,
      motivo: normalizeMotivo(n.reason),
      observacoes: n.notes,
      itensDevolvidos: (n.items || []).map((it, idx) => ({
        id: it.id || `leg_it_${idx}`,
        productId: '',
        productName: it.description || 'Mercadoria devolvida',
        unit: it.unit || 'UN',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        totalPrice: Number(it.totalPrice || 0),
        returnToStock: false,
      })),
      itensLevados: [],
      totalDevolvido: Number(n.totalAmount || 0),
      totalLevado: 0,
      saldoFinal: Number(n.totalAmount || 0),
      destinoFinanceiro: 'credito_fornecedor',
      destinoFinanceiroLabel: 'Crédito / NF-e de Devolução Registrada',
      fiscalStatus: isCanceled ? 'Descartado pela Empresa' : 'Nota de Devolução Emitida',
      notaDevolucaoNumber: isCanceled ? undefined : devNum,
      notaDevolucaoChave: n.originInvoiceKey,
      justificativaDescarte: isCanceled ? n.notes || 'Nota cancelada' : undefined,
      fiscalDecidedAt: n.createdAt,
      createdAt: n.createdAt || new Date().toISOString(),
    };
    orderedTrocas.push(migratedNota);
    existingIds.add(migratedNota.id);
    if (devNum) existingNotasDevNums.add(devNum.toUpperCase());
    mutatedTrocas = true;
  });

  // Persistência silenciosa da migração única para evitar loops de eventos
  if (mutatedTrocas) {
    try {
      localStorage.setItem(TROCAS_STORAGE_KEY, JSON.stringify(orderedTrocas));
    } catch (e) {
      console.warn('Erro ao sincronizar devoluções legadas:', e);
    }
  }

  return orderedTrocas.filter(isFiscalRelevantTroca);
}

export function getUnifiedFiscalDevolucaoCounts(): {
  total: number;
  aguardando: number;
  emitidas: number;
  descartadas: number;
} {
  const list = getUnifiedFiscalDevolucoes();
  let aguardando = 0;
  let emitidas = 0;
  let descartadas = 0;
  list.forEach((r) => {
    const st = r.fiscalStatus || 'Aguardando Decisão Fiscal';
    if (st === 'Nota de Devolução Emitida') emitidas += 1;
    else if (st === 'Descartado pela Empresa') descartadas += 1;
    else aguardando += 1;
  });
  return { total: list.length, aguardando, emitidas, descartadas };
}

type FiscalFilterOption = 'todas' | PendenciaDevolucaoStatus;

const JUSTIFICATIVAS_RAPIDAS = [
  'Peça de baixo valor (custo de frete/NF não compensa)',
  'Avaria interna / mau uso constatado',
  'Fora do prazo ou sem cobertura de garantia do fornecedor',
];

interface DevolucaoNotasViewProps {
  companyProfile?: CompanyProfile;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
}

export const DevolucaoNotasView: React.FC<DevolucaoNotasViewProps> = ({
  companyProfile,
  competence,
  onCompetenceChange,
}) => {
  const [records, setRecords] = useState<TrocaDevolucaoRecord[]>(() =>
    getUnifiedFiscalDevolucoes()
  );
  const [clients, setClients] = useState<Client[]>(() => getStoredClients());
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<TrocaDevolucaoRecord | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<FiscalFilterOption>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [useCompetenceFilter, setUseCompetenceFilter] = useState(false);

  // Modal de Registro de NF-e de Devolução Emitida
  const [nfeTarget, setNfeTarget] = useState<TrocaDevolucaoRecord | null>(null);
  const [nfeNumero, setNfeNumero] = useState('');
  const [nfeChave, setNfeChave] = useState('');
  const [nfeOrigem, setNfeOrigem] = useState('');
  const [printEspelhoOnSave, setPrintEspelhoOnSave] = useState(true);
  const [nfeError, setNfeError] = useState('');

  // Modal de Descarte / Baixa como Perda
  const [discardTarget, setDiscardTarget] = useState<TrocaDevolucaoRecord | null>(null);
  const [discardJustificativa, setDiscardJustificativa] = useState('');
  const [discardError, setDiscardError] = useState('');

  const [successMsg, setSuccessMsg] = useState('');

  const company = useMemo(
    () => companyProfile || getStoredCompanyProfile(),
    [companyProfile]
  );

  useEffect(() => {
    const syncAll = () => {
      setRecords(getUnifiedFiscalDevolucoes());
      setClients(getStoredClients());
    };
    window.addEventListener('agrocontrol_trocas_updated', syncAll);
    window.addEventListener('agrocontrol_pendencias_devolucao_updated', syncAll);
    window.addEventListener('colaca_silagem_notas_devolucao_updated', syncAll);
    window.addEventListener('storage', syncAll);
    return () => {
      window.removeEventListener('agrocontrol_trocas_updated', syncAll);
      window.removeEventListener('agrocontrol_pendencias_devolucao_updated', syncAll);
      window.removeEventListener('colaca_silagem_notas_devolucao_updated', syncAll);
      window.removeEventListener('storage', syncAll);
    };
  }, []);

  const activeCompetence = useMemo(() => {
    if (competence && /^\d{2}\/\d{4}$/.test(competence)) return competence;
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence]);

  const handlePrevCompetence = () => {
    setUseCompetenceFilter(true);
    onCompetenceChange?.(getPrevCompetence(activeCompetence));
  };

  const handleNextCompetence = () => {
    setUseCompetenceFilter(true);
    onCompetenceChange?.(getNextCompetence(activeCompetence));
  };

  const counts = useMemo(() => {
    let aguardando = 0;
    let emitidas = 0;
    let descartadas = 0;
    let valorAguardando = 0;
    let valorEmitidas = 0;

    records.forEach((rec) => {
      const st = rec.fiscalStatus || 'Aguardando Decisão Fiscal';
      if (st === 'Nota de Devolução Emitida') {
        emitidas += 1;
        valorEmitidas += Number(rec.totalDevolvido || 0);
      } else if (st === 'Descartado pela Empresa') {
        descartadas += 1;
      } else {
        aguardando += 1;
        valorAguardando += Number(rec.totalDevolvido || 0);
      }
    });

    return {
      todas: records.length,
      aguardando,
      emitidas,
      descartadas,
      valorAguardando,
      valorEmitidas,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = records.filter((rec) => {
      const st = rec.fiscalStatus || 'Aguardando Decisão Fiscal';
      if (statusFilter !== 'todas' && st !== statusFilter) return false;

      if (useCompetenceFilter) {
        const recDate = rec.data || rec.createdAt || '';
        if (!matchesCompetence(recDate, activeCompetence)) return false;
      }

      if (!q) return true;
      const itensText = (rec.itensDevolvidos || [])
        .map((i) => `${i.productCode || ''} ${i.productName}`)
        .join(' ')
        .toLowerCase();
      return (
        String(rec.protocolo || '').toLowerCase().includes(q) ||
        String(rec.envolvidoNome || '').toLowerCase().includes(q) ||
        String(rec.numeroVendaOuNotaOrigem || '').toLowerCase().includes(q) ||
        String(rec.notaDevolucaoNumber || '').toLowerCase().includes(q) ||
        String(rec.motivo || '').toLowerCase().includes(q) ||
        itensText.includes(q)
      );
    });

    return [...list].sort((a, b) => {
      const aWait = (a.fiscalStatus || 'Aguardando Decisão Fiscal') === 'Aguardando Decisão Fiscal' ? 0 : 1;
      const bWait = (b.fiscalStatus || 'Aguardando Decisão Fiscal') === 'Aguardando Decisão Fiscal' ? 0 : 1;
      if (aWait !== bWait) return aWait - bWait;
      return String(b.createdAt || b.data).localeCompare(String(a.createdAt || a.data));
    });
  }, [records, statusFilter, useCompetenceFilter, activeCompetence, searchTerm]);

  const syncMatchingPendencias = (
    rec: TrocaDevolucaoRecord,
    patch: Partial<PendenciaDevolucaoRecord>
  ) => {
    const currentPend = getStoredPendenciasDevolucao();
    let changed = false;
    const updatedPend = currentPend.map((p) => {
      if (
        p.trocaRecordId === rec.id ||
        (p.protocolo && rec.protocolo && p.protocolo === rec.protocolo)
      ) {
        changed = true;
        return { ...p, ...patch };
      }
      return p;
    });
    if (changed) {
      saveStoredPendenciasDevolucao(updatedPend);
    }
  };

  // Ação 1: Abrir Modal de Registro de NF-e de Devolução
  const handleOpenRegisterNfe = (rec: TrocaDevolucaoRecord) => {
    setNfeTarget(rec);
    setNfeNumero(rec.notaDevolucaoNumber || '');
    setNfeChave(rec.notaDevolucaoChave || '');
    setNfeOrigem(rec.numeroVendaOuNotaOrigem || '');
    setPrintEspelhoOnSave(true);
    setNfeError('');
  };

  const handleConfirmRegisterNfe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nfeTarget) return;

    const trimmedNum = nfeNumero.trim();
    if (!trimmedNum) {
      setNfeError('Informe o número da NF-e de Devolução emitida.');
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedRecord: TrocaDevolucaoRecord = {
      ...nfeTarget,
      numeroVendaOuNotaOrigem: nfeOrigem.trim() || nfeTarget.numeroVendaOuNotaOrigem,
      fiscalStatus: 'Nota de Devolução Emitida',
      notaDevolucaoNumber: trimmedNum,
      notaDevolucaoChave: nfeChave.trim() || undefined,
      notaDevolucaoEmitidaEm: nowIso,
      fiscalDecidedAt: nowIso,
    };

    const allTrocas = getStoredTrocasDevolucoes();
    const nextTrocas = allTrocas.map((r) => (r.id === nfeTarget.id ? updatedRecord : r));
    saveStoredTrocasDevolucoes(nextTrocas);

    syncMatchingPendencias(nfeTarget, {
      status: 'Nota de Devolução Emitida',
      notaDevolucaoNumber: trimmedNum,
      decidedAt: nowIso,
    });

    setRecords(getUnifiedFiscalDevolucoes());
    setSuccessMsg(
      `NF-e de Devolução ${trimmedNum} vinculada ao protocolo ${nfeTarget.protocolo} com sucesso!`
    );
    setTimeout(() => setSuccessMsg(''), 5500);

    if (printEspelhoOnSave) {
      printEspelhoFiscalDevolucaoA4(updatedRecord, company);
    }

    setNfeTarget(null);
  };

  // Ação 2: Abrir Modal de Descarte / Baixar como Perda
  const handleOpenDiscard = (rec: TrocaDevolucaoRecord) => {
    setDiscardTarget(rec);
    setDiscardJustificativa('');
    setDiscardError('');
  };

  const handleConfirmDiscard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discardTarget) return;
    const just = discardJustificativa.trim();
    if (!just) {
      setDiscardError('Informe uma justificativa curta para baixar o item como perda.');
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedRecord: TrocaDevolucaoRecord = {
      ...discardTarget,
      fiscalStatus: 'Descartado pela Empresa',
      justificativaDescarte: just,
      fiscalDecidedAt: nowIso,
    };

    const allTrocas = getStoredTrocasDevolucoes();
    const nextTrocas = allTrocas.map((r) => (r.id === discardTarget.id ? updatedRecord : r));
    saveStoredTrocasDevolucoes(nextTrocas);

    syncMatchingPendencias(discardTarget, {
      status: 'Descartado pela Empresa',
      justificativaDescarte: just,
      decidedAt: nowIso,
    });

    setRecords(getUnifiedFiscalDevolucoes());
    setSuccessMsg(
      `Protocolo ${discardTarget.protocolo} encerrado como "Descartado pela Empresa" sem gerar NF-e.`
    );
    setTimeout(() => setSuccessMsg(''), 5500);
    setDiscardTarget(null);
    setDiscardJustificativa('');
  };

  const getFiscalStatusBadge = (rec: TrocaDevolucaoRecord) => {
    const st = rec.fiscalStatus || 'Aguardando Decisão Fiscal';
    if (st === 'Aguardando Decisão Fiscal') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Aguardando Decisão Fiscal</span>
        </span>
      );
    }
    if (st === 'Nota de Devolução Emitida') {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>Nota de Devolução Emitida</span>
          </span>
          {rec.notaDevolucaoNumber && (
            <span className="text-[10px] font-mono font-black text-emerald-800 dark:text-emerald-300">
              NF-e: {rec.notaDevolucaoNumber}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-stone-200 text-stone-800 border border-stone-400 whitespace-nowrap">
          <Ban className="w-3 h-3 shrink-0" />
          <span>Descartado pela Empresa</span>
        </span>
        {rec.justificativaDescarte && (
          <span
            className="text-[10px] text-stone-500 max-w-[190px] truncate"
            title={rec.justificativaDescarte}
          >
            {rec.justificativaDescarte}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-3">
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPIs Compactos Unificados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="border border-rose-300/90 dark:border-rose-800 rounded-xl bg-white dark:bg-stone-900 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Aguardando Decisão Fiscal
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-rose-700 dark:text-rose-400">
              {counts.aguardando} {counts.aguardando === 1 ? 'registro' : 'registros'}
            </span>
            <span className="text-xs font-black text-stone-700 dark:text-stone-300">
              {formatCurrencyBRL(counts.valorAguardando)}
            </span>
          </div>
        </div>

        <div className="border border-emerald-300/80 dark:border-emerald-800 rounded-xl bg-white dark:bg-stone-900 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Notas de Devolução Emitidas
            </span>
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
              {counts.emitidas}
            </span>
            <span className="text-xs font-black text-stone-700 dark:text-stone-300">
              {formatCurrencyBRL(counts.valorEmitidas)}
            </span>
          </div>
        </div>

        <div className="border border-slate-300/80 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              Descartadas pela Empresa
            </span>
            <PackageX className="w-3.5 h-3.5 text-stone-500" />
          </div>
          <div className="text-lg font-black text-stone-800 dark:text-stone-200 mt-0.5">
            {counts.descartadas}
          </div>
        </div>
      </div>

      {/* Painel Principal Unificado */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 space-y-3">
        {/* Cabeçalho */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-2.5 border-b border-stone-200 dark:border-stone-800">
          <div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit'] flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>🔄 Devoluções & Garantias (Fila Fiscal & Emissão Unificada)</span>
            </h3>
            <p className="text-[11px] text-stone-500">
              Banco único integrado ao Balcão/Estoque e Financeiro: registre novas devoluções, vincule a NF-e emitida ou baixe itens como perda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar protocolo, NF-e, fornecedor, item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none w-52 sm:w-60"
              />
            </div>

            <div className="flex items-center gap-1">
              <CompetenceSelector
                competence={activeCompetence}
                onPrev={handlePrevCompetence}
                onNext={handleNextCompetence}
              />
              {useCompetenceFilter ? (
                <button
                  type="button"
                  onClick={() => setUseCompetenceFilter(false)}
                  className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer"
                  title="Clique para voltar a exibir todos os meses"
                >
                  Mês ativo ×
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setUseCompetenceFilter(true)}
                  className="px-2 py-1.5 text-[10px] font-bold rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 cursor-pointer"
                  title="Filtrar pela competência selecionada"
                >
                  Todos os meses
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Nova Nota de Devolução</span>
            </button>
          </div>
        </div>

        {/* Filtros Rápidos no Topo */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('Aguardando Decisão Fiscal')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
              statusFilter === 'Aguardando Decisão Fiscal'
                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                : 'bg-rose-50/80 hover:bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Aguardando Decisão Fiscal (Pendentes)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'Aguardando Decisão Fiscal'
                  ? 'bg-white/25 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {counts.aguardando}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Nota de Devolução Emitida')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
              statusFilter === 'Nota de Devolução Emitida'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Notas de Devolução Emitidas</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'Nota de Devolução Emitida'
                  ? 'bg-white/25 text-white'
                  : 'bg-emerald-200 text-emerald-900'
              }`}
            >
              {counts.emitidas}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('Descartado pela Empresa')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
              statusFilter === 'Descartado pela Empresa'
                ? 'bg-stone-700 text-white border-stone-800 shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Descartadas pela Empresa</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'Descartado pela Empresa'
                  ? 'bg-white/25 text-white'
                  : 'bg-stone-300 text-stone-900'
              }`}
            >
              {counts.descartadas}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('todas')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
              statusFilter === 'todas'
                ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700'
            }`}
          >
            <span>Todas</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                statusFilter === 'todas'
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-200 text-slate-800'
              }`}
            >
              {counts.todas}
            </span>
          </button>
        </div>

        {/* Tabela Unificada */}
        <div className="border border-slate-300 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
          <div className="max-h-[calc(100vh-370px)] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-black uppercase sticky top-0 z-20 border-b border-slate-300 dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Protocolo</th>
                  <th className="py-2.5 px-3">Fornecedor / Origem</th>
                  <th className="py-2.5 px-3">Produto(s) Devolvido(s)</th>
                  <th className="py-2.5 px-3 text-right">Valor Total</th>
                  <th className="py-2.5 px-3">Motivo / Financeiro</th>
                  <th className="py-2.5 px-3 text-center">Situação Fiscal</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-6 text-center text-xs text-stone-500 font-semibold uppercase"
                    >
                      Nenhum registro de devolução ou garantia encontrado para este filtro
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec, idx) => {
                    const st = rec.fiscalStatus || 'Aguardando Decisão Fiscal';
                    const isPending = st === 'Aguardando Decisão Fiscal';
                    const isEmitida = st === 'Nota de Devolução Emitida';
                    const firstItem = rec.itensDevolvidos?.[0];
                    const extraItemsCount = Math.max(0, (rec.itensDevolvidos?.length || 0) - 1);

                    return (
                      <tr
                        key={`${rec.id}_${idx}`}
                        className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800"
                      >
                        <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                          {formatDateBR(rec.data)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-black text-rose-700 dark:text-rose-400">
                            {rec.protocolo}
                          </span>
                          <span className="block text-[10px] font-semibold text-stone-500">
                            {getTipoOperacaoLabel(rec.tipoOperacao)}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 font-bold text-stone-800 dark:text-stone-200">
                          <span className="uppercase">{rec.envolvidoNome}</span>
                          {rec.numeroVendaOuNotaOrigem && (
                            <span className="block text-[10px] font-normal text-stone-500">
                              NF/Venda Origem: {rec.numeroVendaOuNotaOrigem}
                            </span>
                          )}
                          {rec.boletoAbatido && (
                            <span
                              className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/50 border border-teal-300 dark:border-teal-800 text-[10px] font-bold text-teal-800 dark:text-teal-300"
                              title={`Boleto: ${rec.boletoAbatido.documento || '—'} | ${rec.boletoAbatido.statusResultante}`}
                            >
                              Abatido em {rec.boletoAbatido.documento || 'Boleto'}:{' '}
                              {formatCurrencyBRL(rec.boletoAbatido.valorAbatido)}
                              {rec.boletoAbatido.saldoRestante <= 0
                                ? ' (Liquidado)'
                                : ` • Rest: ${formatCurrencyBRL(rec.boletoAbatido.saldoRestante)}`}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-stone-900 dark:text-stone-100">
                          {firstItem ? (
                            <div>
                              <span className="font-bold">
                                {firstItem.productCode ? `[${firstItem.productCode}] ` : ''}
                                {firstItem.productName}
                              </span>
                              <span className="block text-[10px] text-stone-500">
                                {firstItem.quantity} {firstItem.unit || 'UN'} ×{' '}
                                {formatCurrencyBRL(firstItem.unitPrice)}
                                {extraItemsCount > 0 ? ` (+${extraItemsCount} item(ns))` : ''}
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-black text-stone-900 dark:text-stone-100 whitespace-nowrap">
                          {formatCurrencyBRL(rec.totalDevolvido)}
                        </td>

                        <td className="py-2.5 px-3 text-stone-700 dark:text-stone-300">
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[10.5px] font-bold text-amber-900 dark:text-amber-200">
                            {rec.motivo}
                          </span>
                          <span className="block text-[10px] text-stone-500 mt-0.5 max-w-[200px] truncate">
                            {rec.destinoFinanceiroLabel}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {getFiscalStatusBadge(rec)}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRegisterNfe(rec)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                                  title="Registrar número da NF-e de Devolução emitida e gerar espelho fiscal"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>📄 Registrar NF-e de Devolução</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDiscard(rec)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-bold transition cursor-pointer"
                                  title="Descartar item e baixar como perda sem emitir nota"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>🗑️ Descartar / Perda</span>
                                </button>
                              </>
                            )}

                            {isEmitida && (
                              <button
                                type="button"
                                onClick={() => printEspelhoFiscalDevolucaoA4(rec, company)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                                title="Imprimir Espelho Fiscal da NF-e de Devolução"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Espelho Fiscal A4</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => printTrocaDevolucaoA4(rec, company)}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition cursor-pointer"
                              title="Imprimir Comprovante A4"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => printTrocaDevolucaoCupom80mm(rec, company)}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition cursor-pointer"
                              title="Imprimir Cupom 80mm"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDetailsTarget(rec)}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700 transition cursor-pointer"
                              title="Ver Detalhes Completos"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Único Compartilhado: NOVA TROCA / DEVOLUÇÃO DE PRODUTOS */}
      <NovaTrocaDevolucaoModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        clients={clients}
        companyProfile={company}
        defaultTipoOperacao="devolucao_fornecedor"
        onSuccess={(record, shouldAutoPrint) => {
          setRecords(getUnifiedFiscalDevolucoes());
          setSuccessMsg(
            `Devolução ${record.protocolo} registrada com sucesso! Enviada para a fila fiscal como "Aguardando Decisão Fiscal".`
          );
          setTimeout(() => setSuccessMsg(''), 6000);
          if (shouldAutoPrint) {
            printTrocaDevolucaoA4(record, company);
          }
        }}
      />

      {/* Modal de Detalhes Completos */}
      <TrocaDevolucaoDetailsModal
        record={detailsTarget}
        companyProfile={company}
        onClose={() => setDetailsTarget(null)}
      />

      {/* Modal Rápido: Registrar NF-e de Devolução Emitida */}
      {nfeTarget && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 bg-black/60 backdrop-blur-[1px] animate-in fade-in duration-150">
          <div className="bg-[#cad4e6] dark:bg-stone-900 rounded-xl max-w-lg w-full border border-black dark:border-stone-700 shadow-2xl overflow-hidden text-slate-900 dark:text-stone-100">
            <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white dark:bg-stone-800 border border-black dark:border-stone-700">
                  <FileText className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                    Registrar NF-e de Devolução Emitida
                  </h3>
                  <p className="text-[11px] text-black/75 dark:text-stone-400 font-medium">
                    Protocolo {nfeTarget.protocolo} • {nfeTarget.envolvidoNome}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNfeTarget(null)}
                className="p-1 rounded-lg bg-white/80 hover:bg-white border border-black text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRegisterNfe} className="p-4 space-y-3 bg-[#cad4e6] dark:bg-stone-950">
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Protocolo: {nfeTarget.protocolo}</span>
                  <span className="font-black text-emerald-800 dark:text-emerald-300">
                    {formatCurrencyBRL(nfeTarget.totalDevolvido)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 dark:text-stone-300">
                  Itens:{' '}
                  {(nfeTarget.itensDevolvidos || [])
                    .map((i) => `${i.quantity}x ${i.productName}`)
                    .join(', ')}
                </div>
              </div>

              {nfeError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-500 text-rose-800 text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{nfeError}</span>
                </div>
              )}

              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-lg p-3 space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">
                    Número da NF-e de Devolução Emitida <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={nfeNumero}
                    onChange={(e) => {
                      setNfeNumero(e.target.value);
                      if (nfeError) setNfeError('');
                    }}
                    placeholder="Ex: NF-e 001428 ou DEV-2026-001"
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-900 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-emerald-600"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">
                    Chave de Acesso da NF-e (Opcional)
                  </label>
                  <input
                    type="text"
                    value={nfeChave}
                    onChange={(e) => setNfeChave(e.target.value)}
                    placeholder="44 dígitos da chave fiscal (se disponível)"
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-900 text-black dark:text-stone-100 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1">
                    NF-e / Venda de Origem (Referência)
                  </label>
                  <input
                    type="text"
                    value={nfeOrigem}
                    onChange={(e) => setNfeOrigem(e.target.value)}
                    placeholder="Ex: NF-e Entrada 48291"
                    className="w-full px-2.5 py-1.5 text-xs font-semibold rounded border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-900 text-black dark:text-stone-100 outline-none"
                  />
                </div>

                <label className="inline-flex items-center gap-2 pt-1 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printEspelhoOnSave}
                    onChange={(e) => setPrintEspelhoOnSave(e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
                  />
                  <span>Gerar e imprimir Espelho Fiscal A4 ao salvar</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNfeTarget(null)}
                  className="px-4 py-1.5 text-xs font-bold rounded bg-white hover:bg-gray-100 text-black border border-black cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-900 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar Emissão & Vincular NF-e</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Descartar / Baixar como Perda */}
      {discardTarget && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 bg-black/60 backdrop-blur-[1px] animate-in fade-in duration-150">
          <div className="bg-[#cad4e6] dark:bg-stone-900 rounded-xl max-w-lg w-full border border-black dark:border-stone-700 shadow-2xl overflow-hidden text-slate-900 dark:text-stone-100">
            <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white dark:bg-stone-800 border border-black dark:border-stone-700">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                    Descartar / Baixar como Perda
                  </h3>
                  <p className="text-[11px] text-black/75 dark:text-stone-400 font-medium">
                    Encerrar registro sem emitir Nota Fiscal de Devolução
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscardTarget(null)}
                className="p-1 rounded-lg bg-white/80 hover:bg-white border border-black text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDiscard} className="p-4 space-y-3 bg-[#cad4e6] dark:bg-stone-950">
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-lg p-3 space-y-1 text-xs">
                <div>
                  <span className="font-bold">Protocolo:</span>{' '}
                  <span className="font-mono font-black text-rose-700 dark:text-rose-400">
                    {discardTarget.protocolo}
                  </span>
                </div>
                <div>
                  <span className="font-bold">Produto(s):</span>{' '}
                  {(discardTarget.itensDevolvidos || [])
                    .map((i) => `${i.quantity} ${i.unit || 'UN'} × ${i.productName}`)
                    .join(', ')}
                </div>
                <div>
                  <span className="font-bold">Valor:</span>{' '}
                  {formatCurrencyBRL(discardTarget.totalDevolvido)} •{' '}
                  <span className="font-bold">Envolvido:</span> {discardTarget.envolvidoNome}
                </div>
              </div>

              {discardError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-400 text-rose-800 text-xs font-bold">
                  {discardError}
                </div>
              )}

              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-lg p-3 space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider">
                  Justificativa Curta <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-wrap gap-1">
                  {JUSTIFICATIVAS_RAPIDAS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setDiscardJustificativa(sug);
                        if (discardError) setDiscardError('');
                      }}
                      className="px-2 py-0.5 rounded bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 text-[10px] font-semibold hover:bg-slate-100 cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={discardJustificativa}
                  onChange={(e) => {
                    setDiscardJustificativa(e.target.value);
                    if (discardError) setDiscardError('');
                  }}
                  placeholder="Ex: Peça barata / avaria interna, não compensa emitir NF de devolução..."
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-900 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-rose-600 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDiscardTarget(null)}
                  className="px-4 py-1.5 text-xs font-bold rounded bg-white hover:bg-gray-100 dark:bg-stone-800 text-black dark:text-stone-200 border border-black cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white border border-rose-800 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmar Descarte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
