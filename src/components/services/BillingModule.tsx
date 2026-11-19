import React, { useState, useMemo, useEffect } from 'react';
import {
  Receipt,
  Search,
  X,
  ChevronDown,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileText,
  DollarSign,
  AlertCircle,
  Pencil,
  Send,
  Eye,
  Check,
  Building2,
  CornerDownRight,
  ShieldCheck,
  FileCheck2,
  Undo2
} from 'lucide-react';
import { ServiceOrder, CompanyProfile, BankAccount } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredBankAccounts } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { BillingPaymentModal, getPaymentMethodLabel } from './BillingPaymentModal';
import {
  PendingNfseFromServicePayload,
  buildPendingNfsePayloadFromBilling,
} from '../../utils/nfsePrefill';
import {
  CompetenceSelector,
  getCurrentCompetence,
  getPrevCompetence,
  getNextCompetence,
  matchesCompetence,
} from '../financial/CompetenceSelector';

/**
 * Remove qualquer sufixo de parcelas e formata como #0001
 * Ex: "#001-1" -> "#001", "1001-P1/3" -> "#1001", "#0001" -> "#0001"
 */
export const getCleanOrderNumber = (rawOrderNumber?: string, fallbackId?: string): string => {
  if (rawOrderNumber) {
    const cleaned = rawOrderNumber.replace(/(-P\d+.*|-P\d+\/\d+|-(\d+)\/\d+|-\d+.*)$/i, '').trim();
    return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
  }
  const idStr = (fallbackId || '').slice(-4);
  return idStr.startsWith('#') ? idStr : `#${idStr}`;
};

export interface UnifiedBillingItem {
  id: string; // groupKey
  primaryService: ServiceOrder;
  childOrders: ServiceOrder[];
  cleanOrderNumber: string;
  totalAmount: number;
  totalPaidAmount: number;
  isFaturado: boolean;
  isPaidAll: boolean;
  statusBadge: {
    label: string;
    className: string;
  };
  summaryBillingNotes: string;
}

interface BillingModuleProps {
  services: ServiceOrder[];
  companyProfile?: CompanyProfile;
  onSaveServices: (updated: ServiceOrder[]) => void;
  onOpenServiceModal: (service: ServiceOrder) => void;
  onEmitirNfseFromService?: (payload: PendingNfseFromServicePayload) => void;
  competence?: string;
  onPrevCompetence?: () => void;
  onNextCompetence?: () => void;
}

export const BillingModule: React.FC<BillingModuleProps> = ({
  services = [],
  companyProfile,
  onSaveServices,
  onOpenServiceModal,
  onEmitirNfseFromService,
  competence,
  onPrevCompetence,
  onNextCompetence,
}) => {
  const { confirm } = useConfirm();

  // Competência Ativa (Sincronizada globalmente com o módulo de Prestação de Serviços)
  const [internalCompetence, setInternalCompetence] = useState<string>(() => getCurrentCompetence());
  const activeCompetence = competence || internalCompetence;
  const handlePrev = onPrevCompetence || (() => setInternalCompetence(prev => getPrevCompetence(prev)));
  const handleNext = onNextCompetence || (() => setInternalCompetence(prev => getNextCompetence(prev)));

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'faturado'>('todos');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('todos');

  // Quick Audit Modal state
  const [auditingService, setAuditingService] = useState<ServiceOrder | null>(null);
  const [auditNotes, setAuditNotes] = useState('');
  const [auditDiscount, setAuditDiscount] = useState<number | ''>('');
  const [auditExtra, setAuditExtra] = useState<number | ''>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Avançado de Condições Comerciais e Definição de Recebimento
  const [billingPaymentService, setBillingPaymentService] = useState<ServiceOrder | null>(null);
  const [postBillingNfseContext, setPostBillingNfseContext] = useState<{
    originalService: ServiceOrder;
    splitOrders: ServiceOrder[];
  } | null>(null);

  // Sincronização reativa de contas bancárias cadastradas
  const [storedBankAccounts, setStoredBankAccounts] = useState<BankAccount[]>(() => {
    try {
      return getStoredBankAccounts();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        setStoredBankAccounts(getStoredBankAccounts());
      } catch (err) {
        console.warn('Erro ao atualizar contas bancárias no faturamento:', err);
      }
    };
    window.addEventListener('agrocontrol_bancos_updated', handleUpdate);
    window.addEventListener('agrocontrol_contas_bancarias_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('agrocontrol_bancos_updated', handleUpdate);
      window.removeEventListener('agrocontrol_contas_bancarias_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Identifica serviços na esteira de faturamento filtrados pela competência ativa (MM/AAAA)
  const billingServices = useMemo(() => {
    return services.filter((s) => {
      if (activeCompetence) {
        const dateToCheck = s.billedAt || s.startDate || s.date || s.completionDate || (s as any).createdAt;
        if (!matchesCompetence(dateToCheck, activeCompetence)) {
          return false;
        }
      }
      // Itens que foram enviados para faturamento, ou já estão faturados
      return s.status === 'em_faturamento' || s.status === 'faturado' || s.billingStatus === 'faturado' || !!s.billedAt;
    });
  }, [services, activeCompetence]);

  // UNIFICAÇÃO: Agrupa estritamente um único registro por ordem de serviço (OS) original
  const unifiedBillingServices = useMemo<UnifiedBillingItem[]>(() => {
    const groupsMap = new Map<string, ServiceOrder[]>();

    billingServices.forEach((s) => {
      const groupKey = s.parentOrderId || s.id;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
      groupsMap.get(groupKey)!.push(s);
    });

    const list: UnifiedBillingItem[] = [];

    groupsMap.forEach((items, groupKey) => {
      // Localiza a ordem principal da OS (preferencialmente id === groupKey ou a primeira)
      const primary = items.find((it) => it.id === groupKey) || items[0];
      const cleanNumber = getCleanOrderNumber(primary.orderNumber, groupKey);

      // Total consolidado da OS (soma das parcelas/títulos)
      const totalAmount = items.reduce((acc, it) => acc + (Number(it.totalAmount) || 0), 0);
      const totalPaidAmount = items.reduce((acc, it) => acc + (Number(it.paidAmount) || 0), 0);

      const isFaturado = items.some(
        (it) => it.status === 'faturado' || it.billingStatus === 'faturado' || !!it.billedAt
      );
      const isPaidAll = items.length > 0 && items.every((it) => it.paymentStatus === 'pago');

      const maxInstallments = Math.max(
        ...items.map((it) => Number(it.totalInstallments) || (items.length > 1 ? items.length : 1))
      );

      let badgeLabel = 'AGUARDANDO REVISÃO';
      let badgeClass =
        'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700';

      if (isPaidAll) {
        badgeLabel = maxInstallments > 1 ? `RECEBIDO NO CAIXA (${maxInstallments}x)` : 'RECEBIDO NO CAIXA';
        badgeClass =
          'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700';
      } else if (isFaturado) {
        badgeLabel = maxInstallments > 1 ? `FATURADO (${maxInstallments}x)` : 'FATURADO (A RECEBER)';
        badgeClass =
          'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700';
      }

      // Agrupamento consolidado das formas de pagamento para o resumo na descrição
      // Ex: [FATURAMENTO: PIX - R$ 10.000,00 | CHEQUE (3x) - R$ 25.750,00]
      const methodTotals = new Map<string, { total: number; count: number; label: string }>();
      items.forEach((it) => {
        const method = String((it.paymentMethod || 'OUTRO') ?? '').toLowerCase();
        const methodLabel = getPaymentMethodLabel(it.paymentMethod);
        const prev = methodTotals.get(method) || { total: 0, count: 0, label: methodLabel };
        prev.total += Number(it.totalAmount) || 0;
        prev.count += 1;
        methodTotals.set(method, prev);
      });

      const summaryParts: string[] = [];
      methodTotals.forEach(({ total, count, label }) => {
        if (count > 1) {
          summaryParts.push(`${label} (${count}x) - ${formatCurrencyBRL(total)}`);
        } else {
          summaryParts.push(`${label} - ${formatCurrencyBRL(total)}`);
        }
      });

      const customNotes = (primary.billingNotes || '')
        .replace(/\[FATURAMENTO:.*?\]/gi, '')
        .trim();

      const summaryBillingNotes =
        summaryParts.length > 0
          ? [customNotes, `[FATURAMENTO: ${summaryParts.join(' | ')}]`].filter(Boolean).join(' ')
          : primary.billingNotes || '';

      list.push({
        id: groupKey,
        primaryService: primary,
        childOrders: items,
        cleanOrderNumber: cleanNumber,
        totalAmount,
        totalPaidAmount,
        isFaturado,
        isPaidAll,
        statusBadge: {
          label: badgeLabel,
          className: badgeClass,
        },
        summaryBillingNotes,
      });
    });

    return list;
  }, [billingServices]);

  // Totais e Métricas baseados na lista unificada
  const metrics = useMemo(() => {
    const totalGeral = unifiedBillingServices.reduce((acc, it) => acc + (it.totalAmount || 0), 0);
    const pendentesList = unifiedBillingServices.filter((it) => !it.isFaturado);
    const faturadosList = unifiedBillingServices.filter((it) => it.isFaturado);

    const totalPendente = pendentesList.reduce((acc, it) => acc + (it.totalAmount || 0), 0);
    const totalFaturado = faturadosList.reduce((acc, it) => acc + (it.totalAmount || 0), 0);

    return {
      totalGeral,
      pendentesCount: pendentesList.length,
      totalPendente,
      faturadosCount: faturadosList.length,
      totalFaturado,
    };
  }, [unifiedBillingServices]);

  // Lista filtrada unificada
  const filteredList = useMemo(() => {
    return unifiedBillingServices.filter((item) => {
      const s = item.primaryService;
      const isFaturado = item.isFaturado;

      if (statusFilter === 'pendente' && isFaturado) return false;
      if (statusFilter === 'faturado' && !isFaturado) return false;

      if (serviceTypeFilter !== 'todos') {
        const typeStr = String(s.serviceType ?? '').toLowerCase();
        const tabStr = String(s.serviceTab ?? '').toLowerCase();
        if (serviceTypeFilter === 'corte' && !typeStr.includes('corte') && !typeStr.includes('ensilagem') && tabStr !== 'corte') {
          return false;
        }
        if (serviceTypeFilter === 'colheita' && !typeStr.includes('colheita') && tabStr !== 'colheita') {
          return false;
        }
        if (serviceTypeFilter === 'trator' && !typeStr.includes('trator') && tabStr !== 'trator') {
          return false;
        }
        if (serviceTypeFilter === 'maquina' && !typeStr.includes('máquina') && !typeStr.includes('maquina') && tabStr !== 'maquina') {
          return false;
        }
        if (serviceTypeFilter === 'frete' && !typeStr.includes('frete') && !typeStr.includes('transporte') && tabStr !== 'frete') {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const q = String(searchTerm ?? '').toLowerCase();
        const matchesClient = String(s.clientName ?? '').toLowerCase().includes(q);
        const matchesFarm = String(s.farmName ?? '').toLowerCase().includes(q);
        const matchesOrder = String((item.cleanOrderNumber || s.orderNumber || s.id) ?? '').toLowerCase().includes(q);
        const matchesType = String(s.serviceType ?? '').toLowerCase().includes(q);
        const matchesNotes = String((item.summaryBillingNotes || s.billingNotes || s.notes) ?? '').toLowerCase().includes(q);
        if (!matchesClient && !matchesFarm && !matchesOrder && !matchesType && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedBillingServices, statusFilter, serviceTypeFilter, searchTerm]);

  // Abrir Modal Avançado de Condições Comerciais e Definição de Recebimento
  const handleSendToReceivables = (service: ServiceOrder) => {
    try {
      setStoredBankAccounts(getStoredBankAccounts());
    } catch {}
    setBillingPaymentService(service);
  };

  // Confirmar faturamento e desmembrar títulos para o Contas a Receber
  const handleConfirmBillingPayment = (splitOrders: ServiceOrder[]) => {
    if (!splitOrders || splitOrders.length === 0) return;
    const targetParentId = splitOrders[0].parentOrderId || splitOrders[0].id;
    const originalServiceSnapshot = billingPaymentService || splitOrders[0];

    const updated = services.flatMap((s) => {
      if (s.id === targetParentId) {
        return splitOrders;
      }
      return [s];
    });

    onSaveServices(updated);
    setBillingPaymentService(null);

    const orderNum = splitOrders[0]?.orderNumber || targetParentId.slice(-4);
    if (splitOrders.length > 1) {
      showToast(
        `✓ Faturamento concluído! Pedido #${orderNum} desmembrado em ${splitOrders.length} parcelas/títulos e enviado ao Contas a Receber.`
      );
    } else {
      showToast(`✓ Serviço #${orderNum} faturado com sucesso e lançado no Contas a Receber!`);
    }

    if (onEmitirNfseFromService && originalServiceSnapshot) {
      setPostBillingNfseContext({
        originalService: originalServiceSnapshot,
        splitOrders,
      });
    }
  };

  // Reabrir faturamento / devolver para revisão da ordem unificada
  const handleReopenBilling = async (item: UnifiedBillingItem) => {
    const isConfirmed = await confirm({
      title: 'Devolver para Revisão de Faturamento',
      message: `Deseja estornar o status do pedido ${item.cleanOrderNumber} para "Em Faturamento" para permitir novos ajustes no escritório? Os títulos no Contas a Receber serão temporariamente suspensos.`,
      confirmLabel: 'Reabrir para Revisão',
      cancelLabel: 'Cancelar',
      variant: 'warning',
    });

    if (!isConfirmed) return;

    const groupKey = item.id;

    // Se o pedido foi desmembrado em múltiplas parcelas no Contas a Receber,
    // consolida de volta em um único registro matriz para permitir nova conferência
    const restoredPrimary: ServiceOrder = {
      ...item.primaryService,
      id: groupKey,
      orderNumber: item.cleanOrderNumber,
      totalAmount: item.totalAmount,
      status: 'em_faturamento' as const,
      billingStatus: 'em_revisao' as const,
      billedAt: undefined,
      billedBy: undefined,
      isInstallment: false,
      installmentNumber: undefined,
      totalInstallments: undefined,
      parentOrderId: undefined,
      updatedAt: new Date().toISOString(),
    };

    const updated = services
      .filter((s) => s.id !== groupKey && s.parentOrderId !== groupKey)
      .concat(restoredPrimary);

    onSaveServices(updated);
    showToast(`Serviço ${item.cleanOrderNumber} devolvido para revisão interna.`);
  };

  // Abrir Modal de Auditoria do Escritório
  const handleOpenAuditModal = (service: ServiceOrder) => {
    setAuditingService(service);
    setAuditNotes(service.billingNotes || '');
    setAuditDiscount(service.billingDiscount !== undefined ? service.billingDiscount : '');
    setAuditExtra(service.billingExtra !== undefined ? service.billingExtra : '');
  };

  // Helper para cálculos dinâmicos no modal de auditoria
  const modalAmounts = useMemo(() => {
    if (!auditingService) return { originalBase: 0, discount: 0, extra: 0, final: 0 };
    const prevDiscount = auditingService.billingDiscount || 0;
    const prevExtra = auditingService.billingExtra || 0;
    const originalBase = (auditingService.totalAmount || 0) + prevDiscount - prevExtra;
    const discount = typeof auditDiscount === 'number' ? auditDiscount : 0;
    const extra = typeof auditExtra === 'number' ? extraNumber(auditExtra) : 0;
    const final = Math.max(0, originalBase - discount + extra);
    return { originalBase, discount, extra, final };
  }, [auditingService, auditDiscount, auditExtra]);

  // Salvar Auditoria e Opcionalmente Faturar
  const handleSaveAudit = (sendToReceivablesDirectly: boolean = false) => {
    if (!auditingService) return;

    const { discount, extra, final } = modalAmounts;
    const nowIso = new Date().toISOString();

    let auditedTarget: ServiceOrder | null = null;

    const updated = services.map((s) => {
      if (s.id === auditingService.id) {
        const item: ServiceOrder = {
          ...s,
          billingNotes: auditNotes.trim().toUpperCase(),
          billingDiscount: discount > 0 ? discount : undefined,
          billingExtra: extra > 0 ? extra : undefined,
          totalAmount: final > 0 ? final : s.totalAmount,
          billingStatus: 'em_revisao' as const,
          updatedAt: nowIso,
        };
        auditedTarget = item;
        return item;
      }
      return s;
    });

    onSaveServices(updated);
    setAuditingService(null);

    if (sendToReceivablesDirectly && auditedTarget) {
      // Abre a janela de definição de recebimento com o valor já auditado
      setBillingPaymentService(auditedTarget);
    } else {
      showToast(`Auditoria do faturamento salva com sucesso!`);
    }
  };

  function extraNumber(val: any): number {
    return typeof val === 'number' ? val : Number(val) || 0;
  }

  // Helper para cor do Tipo de Serviço
  const getServiceTypeBadge = (service: ServiceOrder) => {
    const type = String(service.serviceType ?? '').toLowerCase();
    const tab = String(service.serviceTab ?? '').toLowerCase();

    if (type.includes('corte') || type.includes('ensilagem') || tab === 'corte') {
      return {
        label: 'CORTE DE SILAGEM',
        className: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      };
    }
    if (type.includes('colheita') || tab === 'colheita') {
      return {
        label: 'COLHEITA',
        className: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      };
    }
    if (type.includes('trator') || tab === 'trator') {
      return {
        label: 'SERVIÇO DE TRATOR',
        className: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
      };
    }
    if (type.includes('frete') || type.includes('transporte') || tab === 'frete') {
      return {
        label: 'SERVIÇO DE FRETE',
        className: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
      };
    }
    return {
      label: 'SERVIÇO DE MÁQUINA',
      className: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
    };
  };

  return (
    <div className="w-full flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden antialiased">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] max-w-md bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center justify-between gap-3 animate-fade-in border border-emerald-500">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white hover:text-emerald-200 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================
          1. CARDS DE MÉTRICAS DO FATURAMENTO
          ======================================================== */}
      <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Card 1: Total Geral */}
        <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-black dark:text-stone-300 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total em Faturamento</span>
            <Receipt className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-base font-black text-black dark:text-white">
            {formatCurrencyBRL(metrics.totalGeral)}
          </div>
          <div className="text-[10px] text-slate-700 dark:text-stone-300 mt-0.5 font-semibold">
            {billingServices.length} serviço{billingServices.length !== 1 ? 's' : ''} na esteira
          </div>
        </div>

        {/* Card 2: Pendentes de Auditoria */}
        <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-amber-700/60 rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-black dark:text-amber-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Aguardando Auditoria</span>
            <Clock className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <div className="text-base font-black text-amber-900 dark:text-amber-300">
            {formatCurrencyBRL(metrics.totalPendente)}
          </div>
          <div className="text-[10px] text-slate-700 dark:text-amber-400 font-semibold mt-0.5">
            {metrics.pendentesCount} ordem(ns) pronta(s) para conferência
          </div>
        </div>

        {/* Card 3: Faturados e Enviados */}
        <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-emerald-700/60 rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-black dark:text-emerald-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Faturados / Contas a Receber</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-base font-black text-emerald-900 dark:text-emerald-300">
            {formatCurrencyBRL(metrics.totalFaturado)}
          </div>
          <div className="text-[10px] text-slate-700 dark:text-emerald-400 font-semibold mt-0.5">
            {metrics.faturadosCount} título(s) ativos no Financeiro
          </div>
        </div>
      </div>

      {/* ========================================================
          2. BARRA DE FILTROS E PESQUISA
          ======================================================== */}
      <section className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg p-2">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="BUSCAR CLIENTE, FAZENDA, Nº OU ANOTAÇÕES..."
            className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 rounded-lg text-xs text-black dark:text-white font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors shadow-2xs uppercase"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown de Status de Faturamento */}
        <div className="relative sm:w-56">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors shadow-2xs cursor-pointer uppercase"
          >
            <option value="todos">STATUS: TODOS OS FATURAMENTOS</option>
            <option value="pendente">PENDENTE DE REVISÃO</option>
            <option value="faturado">FATURADO (CONTAS A RECEBER)</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-500">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Dropdown de Tipo de Serviço */}
        <div className="relative sm:w-48">
          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors shadow-2xs cursor-pointer uppercase"
          >
            <option value="todos">TIPO: TODOS</option>
            <option value="corte">CORTE DE SILAGEM</option>
            <option value="colheita">COLHEITA</option>
            <option value="trator">SERVIÇO DE TRATOR</option>
            <option value="maquina">SERVIÇO DE MÁQUINA</option>
            <option value="frete">SERVIÇO DE FRETE</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-zinc-400">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Seletor de Competência */}
        <CompetenceSelector
          competence={activeCompetence}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </section>

      {/* ========================================================
          3. TABELA DE AUDITORIA E FATURAMENTO
          ======================================================== */}
      <section className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg overflow-hidden shadow-2xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#e0e6f1] dark:bg-stone-900">
          <table className="w-full table-auto text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black">
              <tr className="border-b border-black dark:border-stone-700 bg-[#cad4e6] dark:bg-stone-800">
                <th scope="col" className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-2.5 py-1.5 text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider w-14 border-b border-black">
                  Nº
                </th>
                <th scope="col" className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-2.5 py-1.5 text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider border-b border-black">
                  CLIENTE
                </th>
                <th scope="col" className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-2.5 py-1.5 text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider border-b border-black">
                  TIPO DE SERVIÇO
                </th>
                <th scope="col" className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-2.5 py-1.5 text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider text-center whitespace-nowrap border-b border-black">
                  EMISSÃO
                </th>
                <th scope="col" className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-2.5 py-1.5 text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider text-center whitespace-nowrap border-b border-black">
                  DATA SERVIÇO / EXECUÇÃO
                </th>
                <th scope="col" className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-2.5 py-1.5 text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider text-right whitespace-nowrap border-b border-black">
                  VALOR ATUAL
                </th>
                <th scope="col" className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-2.5 py-1.5 text-[10px] font-black text-black dark:text-stone-300 uppercase tracking-wider text-right whitespace-nowrap border-b border-black">
                  STATUS / AÇÕES
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#e0e6f1] dark:bg-stone-900">
              {filteredList.length === 0 ? (
                <tr className="bg-[#e0e6f1] dark:bg-stone-900">
                  <td colSpan={7} className="py-8 text-center text-xs font-semibold text-slate-700 dark:text-stone-400 uppercase bg-[#e0e6f1] dark:bg-stone-900">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileCheck2 className="w-8 h-8 text-slate-500 stroke-1" />
                      <span>Nenhum serviço encontrado na esteira de faturamento.</span>
                      <span className="text-[10px] text-slate-600 normal-case">
                        Para enviar um serviço aqui, abra a ordem de serviço em qualquer aba operacional e clique em "Enviar ao Faturamento".
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const service = item.primaryService;
                  const isFaturado = item.isFaturado;
                  const serviceTypeBadge = getServiceTypeBadge(service);
                  const srvAny = service as any;
                  const issueDateVal =
                    srvAny.issueDate ||
                    service.date ||
                    (srvAny.createdAt ? String(srvAny.createdAt).split('T')[0] : '') ||
                    service.startDate ||
                    '';
                  const executionDateVal = service.startDate || service.completionDate || service.date || issueDateVal;

                  return (
                    <tr
                      key={item.id}
                      className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800 transition-colors duration-150 group border-b border-black/20 dark:border-stone-800"
                    >
                      {/* Nº Limpo e Unificado */}
                      <td className="px-2.5 py-1.5 text-xs font-mono text-zinc-600 dark:text-stone-400 font-bold whitespace-nowrap">
                        {item.cleanOrderNumber}
                      </td>

                      {/* Cliente e Estabelecimento */}
                      <td className="px-2.5 py-1.5">
                        <div className="font-bold text-zinc-900 dark:text-white text-xs leading-snug uppercase break-words">
                          {service.clientName}
                        </div>
                        {service.farmName && (
                          <div className="text-[10px] text-zinc-500 dark:text-stone-400 font-medium uppercase break-words">
                            {service.farmName}
                          </div>
                        )}
                      </td>

                      {/* Tipo de Serviço */}
                      <td className="px-2.5 py-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${serviceTypeBadge.className}`}
                        >
                          {serviceTypeBadge.label}
                        </span>
                      </td>

                      {/* Emissão */}
                      <td className="px-2.5 py-1.5 text-xs text-center text-zinc-600 dark:text-stone-400 font-medium whitespace-nowrap font-mono">
                        {issueDateVal ? formatDateBR(issueDateVal) : '--'}
                      </td>

                      {/* Data Serviço / Execução */}
                      <td className="px-2.5 py-1.5 text-xs text-center text-zinc-900 dark:text-stone-200 font-bold whitespace-nowrap font-mono">
                        {executionDateVal ? formatDateBR(executionDateVal) : '--'}
                      </td>

                      {/* Valor Atual Consolidado */}
                      <td className="px-2.5 py-1.5 text-right font-black text-zinc-900 dark:text-white text-xs whitespace-nowrap font-mono">
                        {formatCurrencyBRL(item.totalAmount || 0)}
                      </td>

                      {/* Status / Ações */}
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border uppercase ${item.statusBadge.className}`}
                          >
                            <Check className="w-3 h-3 stroke-[3] shrink-0" />
                            <span>{item.statusBadge.label}</span>
                          </span>

                          {/* Botão Auditar / Revisar Valores */}
                          <button
                            type="button"
                            onClick={() => handleOpenAuditModal(service)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-stone-300 bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-750 border border-slate-300 dark:border-stone-600 rounded-md shadow-2xs transition cursor-pointer"
                            title="Auditar valores, descontos e anotações do faturamento"
                          >
                            <Pencil className="w-3 h-3 text-slate-600 dark:text-stone-300" />
                            <span>Auditar</span>
                          </button>

                          {/* Botão Ver DRE Completo */}
                          <button
                            type="button"
                            onClick={() => onOpenServiceModal(service)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-md shadow-2xs transition cursor-pointer"
                            title="Visualizar ordem de serviço completa e DRE"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver OS</span>
                          </button>

                          {/* Ação Primária: Enviar para Contas a Receber */}
                          {!isFaturado ? (
                            <button
                              type="button"
                              onClick={() => handleSendToReceivables(service)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-md shadow-xs transition cursor-pointer uppercase active:scale-95"
                              title="Enviar imediatamente para o módulo Contas a Receber"
                            >
                              <Send className="w-3 h-3" />
                              <span>Faturar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReopenBilling(item)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 rounded-md transition cursor-pointer"
                              title="Reabrir para conferência"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>Reabrir</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================
          4. MODAL DE AUDITORIA DO ESCRITÓRIO
          ======================================================== */}
      {auditingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[2px]">
          <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden text-black animate-fade-in">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#cad4e6] border-b border-black shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#e0e6f1] border border-black flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-black" />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-black uppercase tracking-wider">
                  Auditoria de Faturamento • OS #{auditingService.orderNumber || auditingService.id.slice(-4)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditingService(null)}
                className="p-1.5 text-black hover:bg-[#e0e6f1] border border-transparent hover:border-black rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo da Auditoria */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#cad4e6] text-xs text-black">
              {/* Card Resumo do Cliente e Detalhes Operacionais */}
              <div className="bg-[#e0e6f1] p-4 rounded-xl border border-black space-y-2.5 shadow-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-black text-sm uppercase">
                    {auditingService.clientName}
                  </span>
                  <span className="text-[11px] text-black bg-white px-2 py-0.5 rounded border border-black font-mono font-bold">
                    {auditingService.startDate ? formatDateBR(auditingService.startDate) : ''}
                  </span>
                </div>
                {auditingService.farmName && (
                  <div className="text-xs text-slate-900 uppercase font-medium">
                    Fazenda: {auditingService.farmName}
                  </div>
                )}
                <div className="text-xs text-slate-900 uppercase flex items-center justify-between font-medium">
                  <span>Serviço: {auditingService.serviceType || 'Prestação Agrícola'}</span>
                  {auditingService.areaQuantity && (
                    <span className="font-bold text-black">
                      {auditingService.areaQuantity} {auditingService.areaUnit || 'ha'}
                    </span>
                  )}
                </div>

                {/* Composição Operacional: Frotas, Maquinários e Ratios */}
                {((auditingService.trucks && auditingService.trucks.length > 0) || auditingService.forageHarvesterName || auditingService.tractorName) && (
                  <div className="pt-2 border-t border-black/20 space-y-1">
                    <span className="text-[10px] font-bold text-black uppercase block tracking-wider">
                      Composição da Operação & Frotas
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {auditingService.forageHarvesterName && (
                        <span className="px-2 py-0.5 rounded bg-white text-black border border-black font-bold">
                          FORR: {auditingService.forageHarvesterName}
                        </span>
                      )}
                      {auditingService.tractorName && (
                        <span className="px-2 py-0.5 rounded bg-white text-black border border-black font-bold">
                          TRATOR: {auditingService.tractorName}
                        </span>
                      )}
                      {auditingService.trucks && auditingService.trucks.map((trk, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-white text-black border border-black font-bold">
                          {trk.truckName || `CAMINHÃO #${i+1}`}: {trk.ratioPercent ? `${Number(trk.ratioPercent).toFixed(1)}% RATIO` : `${trk.tripLoads || 0} CARGAS`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link para Inspecionar / Editar a OS Completa */}
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setAuditingService(null);
                      onOpenServiceModal(auditingService);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 hover:underline cursor-pointer uppercase"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspecionar Ordem Completa & DRE Operacional</span>
                  </button>
                </div>
              </div>

              {/* Grid Financeiro: Valor Original, Desconto e Acréscimo */}
              <div className="bg-[#e0e6f1] p-4 rounded-xl border border-black space-y-4 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-black uppercase mb-1">
                      Valor Operacional (R$)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={formatCurrencyBRL(modalAmounts.originalBase)}
                      className="w-full px-3 py-2 bg-slate-100 border border-black rounded-lg text-xs font-mono font-bold text-black cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black uppercase mb-1">
                      Desconto Comercial (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={auditDiscount}
                      onChange={(e) => setAuditDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-black rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black uppercase mb-1">
                      Acréscimo / Extras (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={auditExtra}
                      onChange={(e) => setAuditExtra(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-black rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>

                {/* Anotações Exclusivas do Faturamento (billingNotes) */}
                <div>
                  <label className="block text-[11px] font-bold text-black uppercase mb-1 flex items-center justify-between">
                    <span>Anotações do Faturamento / Escritório</span>
                    <span className="text-[10px] text-slate-700 normal-case">(exclusivo do faturamento)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value.toUpperCase())}
                    placeholder="DIGITE INSTRUÇÕES DE COBRANÇA, ACORDOS DE PAGAMENTO, VENCIMENTOS OU OBSERVAÇÕES..."
                    className="w-full px-3 py-2 bg-white border border-black rounded-lg text-xs font-medium text-black placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-black uppercase"
                  />
                </div>
              </div>

              {/* Total Final Calculado */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-black flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] font-bold text-emerald-900 uppercase block">
                    Valor Final Faturado
                  </span>
                  <span className="text-base font-black text-emerald-950">
                    {formatCurrencyBRL(modalAmounts.final)}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-900 font-bold uppercase px-2.5 py-1 bg-white border border-black rounded-lg">
                  {auditingService.status === 'faturado' ? 'Já no Contas a Receber' : 'Pronto para Envio'}
                </span>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3 bg-[#cad4e6] border-t border-black shrink-0">
              <button
                type="button"
                onClick={() => setAuditingService(null)}
                className="px-4 py-2 text-xs font-bold text-black bg-white hover:bg-gray-100 border border-black rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveAudit(false)}
                className="px-4 py-2 text-xs font-bold text-black bg-[#e0e6f1] border border-black hover:bg-white rounded-lg shadow-2xs transition cursor-pointer"
              >
                Salvar Auditoria
              </button>
              <button
                type="button"
                onClick={() => handleSaveAudit(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-800 rounded-lg shadow-xs transition cursor-pointer uppercase"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar para Contas a Receber</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. MODAL AVANÇADO DE CONDIÇÕES COMERCIAIS & RECEBIMENTO
          ======================================================== */}
      <BillingPaymentModal
        isOpen={!!billingPaymentService}
        service={billingPaymentService}
        bankAccounts={storedBankAccounts}
        companyProfile={companyProfile}
        onClose={() => setBillingPaymentService(null)}
        onConfirm={handleConfirmBillingPayment}
      />

      {/* ========================================================
          6. DIÁLOGO INTELIGENTE PÓS-FATURAMENTO (EMITIR NFS-E AGORA?)
          ======================================================== */}
      {postBillingNfseContext && (
        <div
          id="modal-pos-faturamento-nfse"
          className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/55 backdrop-blur-none"
        >
          <div className="w-full max-w-lg bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden text-black dark:text-stone-100 animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none shrink-0" aria-hidden="true">✅</span>
                <h3 className="text-xs sm:text-[13px] font-black uppercase tracking-wide text-black dark:text-stone-100 leading-snug">
                  SERVIÇO FATURADO COM SUCESSO! COMO DESEJA PROSSEGUIR?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPostBillingNfseContext(null)}
                className="p-1 text-black dark:text-stone-300 hover:bg-[#e0e6f1] dark:hover:bg-stone-800 border border-transparent hover:border-black rounded-lg cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-[#cad4e6] dark:bg-stone-900 space-y-3">
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-lg p-3 space-y-2.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-stone-200 leading-relaxed">
                  O título financeiro já foi gerado. Deseja emitir agora a{' '}
                  <strong className="font-black text-black dark:text-white">
                    Nota Fiscal de Serviço (NFS-e)
                  </strong>{' '}
                  para este cliente?
                </p>

                {(() => {
                  const preview = buildPendingNfsePayloadFromBilling(
                    postBillingNfseContext.originalService,
                    postBillingNfseContext.splitOrders
                  );
                  return (
                    <div className="bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg px-3 py-2 text-[11px] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black uppercase text-black dark:text-stone-100 truncate">
                          {preview.clientName || 'CLIENTE NÃO INFORMADO'}
                        </span>
                        <span className="font-mono font-bold text-slate-600 dark:text-stone-400 shrink-0">
                          OS {preview.orderNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-stone-700">
                        <span className="font-bold uppercase text-slate-700 dark:text-stone-300 truncate">
                          {preview.serviceType} • {preview.condicaoPagamento.toUpperCase()}
                        </span>
                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 shrink-0">
                          {formatCurrencyBRL(preview.totalAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  id="btn-pos-faturamento-interno"
                  onClick={() => setPostBillingNfseContext(null)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-black dark:text-stone-100 border border-black dark:border-stone-600 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  <span>📄 Manter Apenas como Pedido / Interno</span>
                </button>
                <button
                  type="button"
                  id="btn-pos-faturamento-emitir-nfse"
                  onClick={() => {
                    const payload = buildPendingNfsePayloadFromBilling(
                      postBillingNfseContext.originalService,
                      postBillingNfseContext.splitOrders
                    );
                    setPostBillingNfseContext(null);
                    onEmitirNfseFromService?.(payload);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border border-emerald-900 rounded-lg text-xs font-black uppercase shadow-sm transition cursor-pointer active:scale-95"
                >
                  <span>🧾 Emitir NFS-e Agora</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
