import React, { useState, useMemo } from 'react';
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
import { ServiceOrder, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { BillingPaymentModal, getPaymentMethodLabel } from './BillingPaymentModal';

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
}

export const BillingModule: React.FC<BillingModuleProps> = ({
  services = [],
  companyProfile,
  onSaveServices,
  onOpenServiceModal,
}) => {
  const { confirm } = useConfirm();

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Identifica serviços na esteira de faturamento (ou com status em_faturamento ou faturado)
  const billingServices = useMemo(() => {
    return services.filter((s) => {
      // Itens que foram enviados para faturamento, ou já estão faturados
      return s.status === 'em_faturamento' || s.status === 'faturado' || s.billingStatus === 'faturado' || !!s.billedAt;
    });
  }, [services]);

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
        const method = (it.paymentMethod || 'OUTRO').toLowerCase();
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
        const typeStr = (s.serviceType || '').toLowerCase();
        const tabStr = (s.serviceTab || '').toLowerCase();
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
        const q = searchTerm.toLowerCase();
        const matchesClient = (s.clientName || '').toLowerCase().includes(q);
        const matchesFarm = (s.farmName || '').toLowerCase().includes(q);
        const matchesOrder = (item.cleanOrderNumber || s.orderNumber || s.id || '').toLowerCase().includes(q);
        const matchesType = (s.serviceType || '').toLowerCase().includes(q);
        const matchesNotes = (item.summaryBillingNotes || s.billingNotes || s.notes || '').toLowerCase().includes(q);
        if (!matchesClient && !matchesFarm && !matchesOrder && !matchesType && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedBillingServices, statusFilter, serviceTypeFilter, searchTerm]);

  // Abrir Modal Avançado de Condições Comerciais e Definição de Recebimento
  const handleSendToReceivables = (service: ServiceOrder) => {
    setBillingPaymentService(service);
  };

  // Confirmar faturamento e desmembrar títulos para o Contas a Receber
  const handleConfirmBillingPayment = (splitOrders: ServiceOrder[]) => {
    if (!splitOrders || splitOrders.length === 0) return;
    const targetParentId = splitOrders[0].parentOrderId || splitOrders[0].id;

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
    const type = (service.serviceType || '').toLowerCase();
    const tab = (service.serviceTab || '').toLowerCase();

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
    <div className="w-full space-y-3 antialiased">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Card 1: Total Geral */}
        <div 
          style={{ backgroundColor: '#caf4cc', borderColor: '#0ec244' }}
          className="border rounded-lg p-2.5 shadow-2xs"
        >
          <div 
            style={{ backgroundColor: '#caf4cc', borderColor: '#0ec244' }}
            className="flex items-center justify-between text-slate-700 dark:text-stone-700 mb-1"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider">Total em Faturamento</span>
            <Receipt className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <div className="text-base font-black text-zinc-900 dark:text-white">
            {formatCurrencyBRL(metrics.totalGeral)}
          </div>
          <div className="text-[10px] text-zinc-600 dark:text-stone-300 mt-0.5">
            {billingServices.length} serviço{billingServices.length !== 1 ? 's' : ''} na esteira
          </div>
        </div>

        {/* Card 2: Pendentes de Auditoria */}
        <div className="bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700/60 rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Aguardando Auditoria</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-base font-black text-amber-800 dark:text-amber-300">
            {formatCurrencyBRL(metrics.totalPendente)}
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
            {metrics.pendentesCount} ordem(ns) pronta(s) para conferência
          </div>
        </div>

        {/* Card 3: Faturados e Enviados */}
        <div className="bg-white dark:bg-stone-900 border border-emerald-300 dark:border-emerald-700/60 rounded-lg p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Faturados / Contas a Receber</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-base font-black text-emerald-800 dark:text-emerald-300">
            {formatCurrencyBRL(metrics.totalFaturado)}
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
            {metrics.faturadosCount} título(s) ativos no Financeiro
          </div>
        </div>
      </div>

      {/* ========================================================
          2. BARRA DE FILTROS E PESQUISA
          ======================================================== */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="BUSCAR CLIENTE, FAZENDA, Nº OU ANOTAÇÕES..."
            className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white font-semibold placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors shadow-2xs uppercase"
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
            className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-zinc-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors shadow-2xs cursor-pointer uppercase"
          >
            <option value="todos">STATUS: TODOS OS FATURAMENTOS</option>
            <option value="pendente">PENDENTE DE REVISÃO</option>
            <option value="faturado">FATURADO (CONTAS A RECEBER)</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-zinc-400">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Dropdown de Tipo de Serviço */}
        <div className="relative sm:w-48">
          <select
            value={serviceTypeFilter}
            onChange={(e) => setServiceTypeFilter(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-zinc-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-colors shadow-2xs cursor-pointer uppercase"
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
      </section>

      {/* ========================================================
          3. TABELA DE AUDITORIA E FATURAMENTO
          ======================================================== */}
      <section className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-2xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-300 dark:border-stone-700 bg-slate-100 dark:bg-stone-800/80">
                <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider w-16 whitespace-nowrap">
                  Nº
                </th>
                <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap">
                  CLIENTE
                </th>
                <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap">
                  DATA
                </th>
                <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap">
                  TIPO DE SERVIÇO
                </th>
                <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-right whitespace-nowrap">
                  VALOR ATUAL
                </th>
                <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-center whitespace-nowrap">
                  STATUS FATURAMENTO
                </th>
                <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-zinc-700 dark:text-stone-300 uppercase tracking-wider text-right whitespace-nowrap">
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-stone-800 bg-white dark:bg-stone-900">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileCheck2 className="w-8 h-8 text-slate-400 stroke-1" />
                      <span>Nenhum serviço encontrado na esteira de faturamento.</span>
                      <span className="text-[10px] text-slate-400 normal-case">
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

                  return (
                    <tr
                      key={item.id}
                      className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition-colors duration-150 group border-b border-slate-200 dark:border-stone-800"
                    >
                      {/* Nº Limpo e Unificado */}
                      <td className="px-3 py-1.5 text-xs font-mono text-zinc-600 dark:text-stone-400 font-bold whitespace-nowrap">
                        {item.cleanOrderNumber}
                      </td>

                      {/* Cliente e Fazenda */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="font-bold text-zinc-900 dark:text-white text-xs leading-snug uppercase">
                          {service.clientName}
                        </div>
                        {service.farmName && (
                          <div className="text-[10px] text-zinc-500 dark:text-stone-400 font-medium uppercase">
                            {service.farmName}
                          </div>
                        )}

                        {/* Resumo Financeiro Unificado da OS */}
                        {item.summaryBillingNotes && (
                          <div className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold mt-0.5 flex items-center gap-1 uppercase">
                            <span className="bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                              FAT: {item.summaryBillingNotes}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Data */}
                      <td className="px-3 py-1.5 text-xs text-zinc-700 dark:text-stone-300 font-medium whitespace-nowrap">
                        {service.startDate ? formatDateBR(service.startDate) : '--'}
                      </td>

                      {/* Tipo de Serviço */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${serviceTypeBadge.className}`}
                        >
                          {serviceTypeBadge.label}
                        </span>
                      </td>

                      {/* Valor Atual Consolidado */}
                      <td className="px-3 py-1.5 text-right font-black text-zinc-900 dark:text-white text-xs whitespace-nowrap">
                        {formatCurrencyBRL(item.totalAmount || 0)}
                      </td>

                      {/* Status Interno do Faturamento Unificado */}
                      <td className="px-3 py-1.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${item.statusBadge.className}`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          {item.statusBadge.label}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Auditar / Revisar Valores */}
                          <button
                            type="button"
                            onClick={() => handleOpenAuditModal(service)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-stone-300 bg-white dark:bg-stone-800 hover:bg-slate-100 dark:hover:bg-stone-750 border border-slate-300 dark:border-stone-600 rounded-md shadow-2xs transition cursor-pointer"
                            title="Auditar valores, descontos e anotações do faturamento"
                          >
                            <Pencil className="w-3 h-3 text-slate-600 dark:text-stone-300" />
                            <span>Auditar</span>
                          </button>

                          {/* Botão Ver DRE Completo */}
                          <button
                            type="button"
                            onClick={() => onOpenServiceModal(service)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-md shadow-2xs transition cursor-pointer"
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
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-md shadow-xs transition cursor-pointer uppercase active:scale-95"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-850 border-b border-slate-300 dark:border-stone-700">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Auditoria de Faturamento • OS #{auditingService.orderNumber || auditingService.id.slice(-4)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditingService(null)}
                className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo da Auditoria */}
            <div className="p-4 space-y-3.5 text-xs text-zinc-800 dark:text-stone-200">
              {/* Card Resumo do Cliente e Detalhes Operacionais */}
              <div className="bg-slate-50 dark:bg-stone-800/60 p-3 rounded-lg border border-slate-200 dark:border-stone-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-900 dark:text-white text-sm uppercase">
                    {auditingService.clientName}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-mono">
                    {auditingService.startDate ? formatDateBR(auditingService.startDate) : ''}
                  </span>
                </div>
                {auditingService.farmName && (
                  <div className="text-[11px] text-zinc-600 dark:text-stone-300 uppercase">
                    Fazenda: {auditingService.farmName}
                  </div>
                )}
                <div className="text-[11px] text-zinc-600 dark:text-stone-300 uppercase flex items-center justify-between">
                  <span>Serviço: {auditingService.serviceType || 'Prestação Agrícola'}</span>
                  {auditingService.areaQuantity && (
                    <span className="font-semibold text-zinc-800 dark:text-stone-200">
                      {auditingService.areaQuantity} {auditingService.areaUnit || 'ha'}
                    </span>
                  )}
                </div>

                {/* Composição Operacional: Frotas, Maquinários e Ratios */}
                {((auditingService.trucks && auditingService.trucks.length > 0) || auditingService.forageHarvesterName || auditingService.tractorName) && (
                  <div className="pt-2 border-t border-slate-200 dark:border-stone-700 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-stone-400 uppercase block tracking-wider">
                      Composição da Operação & Frotas
                    </span>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {auditingService.forageHarvesterName && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 font-semibold">
                          FORR: {auditingService.forageHarvesterName}
                        </span>
                      )}
                      {auditingService.tractorName && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-semibold">
                          TRATOR: {auditingService.tractorName}
                        </span>
                      )}
                      {auditingService.trucks && auditingService.trucks.map((trk, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-semibold">
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
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 dark:text-blue-400 hover:underline cursor-pointer uppercase"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspecionar Ordem Completa & DRE Operacional</span>
                  </button>
                </div>
              </div>

              {/* Grid Financeiro: Valor Original, Desconto e Acréscimo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-stone-300 uppercase mb-1">
                    Valor Operacional (R$)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formatCurrencyBRL(modalAmounts.originalBase)}
                    className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-mono font-bold text-zinc-900 dark:text-white cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-stone-300 uppercase mb-1">
                    Desconto Comercial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={auditDiscount}
                    onChange={(e) => setAuditDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 dark:text-stone-300 uppercase mb-1">
                    Acréscimo / Extras (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={auditExtra}
                    onChange={(e) => setAuditExtra(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Anotações Exclusivas do Faturamento (billingNotes) */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-700 dark:text-stone-300 uppercase mb-1 flex items-center justify-between">
                  <span>Anotações do Faturamento / Escritório</span>
                  <span className="text-[9px] text-zinc-400 normal-case">(exclusivo do faturamento)</span>
                </label>
                <textarea
                  rows={3}
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value.toUpperCase())}
                  placeholder="DIGITE INSTRUÇÕES DE COBRANÇA, ACORDOS DE PAGAMENTO, VENCIMENTOS OU OBSERVAÇÕES..."
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 uppercase"
                />
              </div>

              {/* Total Final Calculado */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">
                    Valor Final Faturado
                  </span>
                  <span className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                    {formatCurrencyBRL(modalAmounts.final)}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase">
                  {auditingService.status === 'faturado' ? 'Já no Contas a Receber' : 'Pronto para Envio'}
                </span>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 bg-slate-100 dark:bg-stone-800 border-t border-slate-300 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setAuditingService(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-stone-700 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveAudit(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-stone-200 bg-white dark:bg-stone-700 border border-slate-300 dark:border-stone-600 hover:bg-slate-50 rounded-lg shadow-2xs transition cursor-pointer"
              >
                Salvar Auditoria
              </button>
              <button
                type="button"
                onClick={() => handleSaveAudit(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs transition cursor-pointer uppercase active:scale-95"
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
        onClose={() => setBillingPaymentService(null)}
        onConfirm={handleConfirmBillingPayment}
      />
    </div>
  );
};
