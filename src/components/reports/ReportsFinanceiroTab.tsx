import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  WalletCards,
  Search,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import {
  CompanyProfile,
  Expense,
  FinanceiroCheque,
  NotaSaidaRecord,
  ServiceOrder,
  SilageOrder,
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredFinanceiroCheques,
  getStoredNotasSaida,
} from '../../lib/storage';
import {
  CompetenceSelector,
  getPrevCompetence,
  getNextCompetence,
} from '../financial/CompetenceSelector';
import { getPaymentMethodLabel } from '../financial/ReceivablesTab';
import {
  buildFinanceiroChequesReport,
  buildFinanceiroPagarReport,
  buildFinanceiroReceberReport,
  buildSyntheticSummaryRows,
  ReceivableReportRow,
  ReportPrintConfig,
  ReportViewMode,
  resolveReportSegmentContext,
} from './reportPrintBuilders';
import { ReportViewModeToggle } from './ReportViewModeToggle';

export type FinanceiroSubTab = 'pagar' | 'receber' | 'cheques';

interface ReportsFinanceiroTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  companyProfile: CompanyProfile;
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
  onSubTabChange?: (sub: FinanceiroSubTab) => void;
}

export const ReportsFinanceiroTab: React.FC<ReportsFinanceiroTabProps> = ({
  expenses = [],
  orders = [],
  services = [],
  companyProfile,
  startDate,
  endDate,
  competence,
  onCompetenceChange,
  onRegisterPrintGetter,
  onSubTabChange,
}) => {
  const segmentCtx = useMemo(() => resolveReportSegmentContext(companyProfile), [companyProfile]);
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const activeCompetence = useMemo(() => {
    if (competence) return competence;
    if (startDate && startDate.length >= 7) {
      const [y, m] = startDate.split('-');
      return `${m}/${y}`;
    }
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence, startDate]);

  const handlePrev = () => onCompetenceChange?.(getPrevCompetence(activeCompetence));
  const handleNext = () => onCompetenceChange?.(getNextCompetence(activeCompetence));

  const [subTab, setSubTab] = useState<FinanceiroSubTab>('pagar');
  const [viewMode, setViewMode] = useState<ReportViewMode>('analitico');
  const [groupBy, setGroupBy] = useState<string>('default');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const [cheques, setCheques] = useState<FinanceiroCheque[]>(() => getStoredFinanceiroCheques());
  const [notasSaida, setNotasSaida] = useState<NotaSaidaRecord[]>(() => getStoredNotasSaida());

  useEffect(() => {
    const sync = () => {
      setCheques(getStoredFinanceiroCheques());
      setNotasSaida(getStoredNotasSaida());
    };
    window.addEventListener('storage', sync);
    window.addEventListener('silagem_orders_updated', sync);
    window.addEventListener('silagem_services_updated', sync);
    window.addEventListener('notas_saida_updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('silagem_orders_updated', sync);
      window.removeEventListener('silagem_services_updated', sync);
      window.removeEventListener('notas_saida_updated', sync);
    };
  }, []);

  const handleSwitchSubTab = (next: FinanceiroSubTab) => {
    setSubTab(next);
    setStatusFilter('todos');
    setGroupBy('default');
    onSubTabChange?.(next);
  };

  // ==================== 1. CONTAS A PAGAR ====================
  const filteredPayables = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return (expenses || [])
      .filter((e) => {
        const matchDate = e?.dueDate ? e.dueDate >= startDate && e.dueDate <= endDate : false;
        const matchSearch =
          !term ||
          String(e.description ?? '').toLowerCase().includes(term) ||
          String(e.supplier ?? '').toLowerCase().includes(term) ||
          String(e.categoryName ?? '').toLowerCase().includes(term) ||
          String(e.costCenterName ?? '').toLowerCase().includes(term);

        const isOverdue = e.status !== 'pago' && e.dueDate && e.dueDate < todayIso;
        const matchStatus =
          statusFilter === 'todos' ||
          (statusFilter === 'pago' && e.status === 'pago') ||
          (statusFilter === 'aberto' && e.status !== 'pago' && !isOverdue) ||
          (statusFilter === 'vencido' && isOverdue);

        return matchDate && matchSearch && matchStatus;
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }, [expenses, startDate, endDate, searchTerm, statusFilter, todayIso]);

  const payableKpis = useMemo(() => {
    let total = 0;
    let paid = 0;
    let open = 0;
    let overdue = 0;
    let paidCount = 0;
    let openCount = 0;
    let overdueCount = 0;

    filteredPayables.forEach((e) => {
      const amt = e.amount || 0;
      total += amt;
      if (e.status === 'pago') {
        paid += amt;
        paidCount += 1;
      } else if (e.dueDate && e.dueDate < todayIso) {
        overdue += amt;
        overdueCount += 1;
      } else {
        open += amt;
        openCount += 1;
      }
    });

    return { total, paid, open, overdue, paidCount, openCount, overdueCount };
  }, [filteredPayables, todayIso]);

  // ==================== 2. CONTAS A RECEBER ====================
  const allReceivables: ReceivableReportRow[] = useMemo(() => {
    const rows: ReceivableReportRow[] = [];

    (orders || [])
      .filter((o) => o && o.status !== 'cancelado')
      .forEach((o) => {
        const dueDate = o.dueDate || o.deliveryDate || o.date || o.createdAt || '';
        const isPaid = o.paymentStatus === 'pago';
        const isOverdue = !isPaid && dueDate && dueDate < todayIso;
        rows.push({
          id: o.id,
          dueDate,
          issueDate: o.date || o.deliveryDate || '',
          clientName: o.clientName || 'Cliente N/I',
          originLabel: segmentCtx.isAgroSilage ? 'Venda de Silagem' : 'Pedido / Venda',
          description: o.isInstallment && o.installmentNumber
            ? `Parcela ${o.installmentNumber}/${o.totalInstallments} (${o.productType || 'Venda'})`
            : `${o.orderNumber ? `Pedido #${o.orderNumber} - ` : ''}${o.productType || 'Venda'}`,
          paymentMethodLabel: getPaymentMethodLabel(o.paymentMethod),
          amount: o.totalAmount || 0,
          status: isPaid ? 'pago' : isOverdue ? 'vencido' : 'a_vencer',
        });
      });

    (services || [])
      .filter(
        (s) =>
          s &&
          s.status !== 'cancelado' &&
          (s.status === 'faturado' || s.billingStatus === 'faturado' || !!s.billedAt || (s.status === 'finalizado' && !!s.billedAt))
      )
      .forEach((s) => {
        const dueDate = s.dueDate || s.date || s.startDate || '';
        const isPaid = s.status === 'finalizado' || s.paymentStatus === 'pago';
        const isOverdue = !isPaid && dueDate && dueDate < todayIso;
        rows.push({
          id: s.id,
          dueDate,
          issueDate: s.date || s.startDate || '',
          clientName: s.clientName || 'Cliente N/I',
          originLabel: 'Prestação de Serviço',
          description: s.isInstallment && s.installmentNumber
            ? `Parcela ${s.installmentNumber}/${s.totalInstallments} (${s.serviceType || 'Serviço'})`
            : `${s.serviceType || 'Serviço'}${s.farmName ? ` - ${s.farmName}` : ''}`,
          paymentMethodLabel: getPaymentMethodLabel(s.paymentMethod),
          amount: s.totalAmount || 0,
          status: isPaid ? 'pago' : isOverdue ? 'vencido' : 'a_vencer',
        });
      });

    (notasSaida || [])
      .filter((n) => n.lancarContasReceber && n.status !== 'CANCELADA' && n.status !== 'RASCUNHO')
      .forEach((n) => {
        const dueDate = n.dataVencimento || n.dataEmissao || n.createdAt || '';
        const isPaid = n.receberStatus === 'pago';
        const isOverdue = !isPaid && dueDate && dueDate < todayIso;
        rows.push({
          id: n.id,
          dueDate,
          issueDate: n.dataEmissao || '',
          clientName: n.cteTomadorFinalNome || n.destinatarioNome || 'Destinatário N/I',
          originLabel: 'Nota Fiscal de Saída',
          description: `${(n.tipoDocumento || 'NF').split(' ')[0]} Nº ${n.numero}${n.serie ? `/${n.serie}` : ''}`,
          paymentMethodLabel: n.condicaoPagamento || '-',
          amount: Number(n.valorTotal) || 0,
          status: isPaid ? 'pago' : isOverdue ? 'vencido' : 'a_vencer',
        });
      });

    return rows;
  }, [orders, services, notasSaida, segmentCtx.isAgroSilage, todayIso]);

  const filteredReceivables = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allReceivables
      .filter((r) => {
        const refDate = (r.dueDate || r.issueDate || '').split('T')[0];
        const matchDate = refDate ? refDate >= startDate && refDate <= endDate : false;
        const matchSearch =
          !term ||
          r.clientName.toLowerCase().includes(term) ||
          r.originLabel.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term);
        const matchStatus = statusFilter === 'todos' || r.status === statusFilter;
        return matchDate && matchSearch && matchStatus;
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }, [allReceivables, startDate, endDate, searchTerm, statusFilter]);

  const receivableKpis = useMemo(() => {
    let total = 0;
    let received = 0;
    let upcoming = 0;
    let overdue = 0;
    let receivedCount = 0;
    let upcomingCount = 0;
    let overdueCount = 0;

    filteredReceivables.forEach((r) => {
      total += r.amount;
      if (r.status === 'pago') {
        received += r.amount;
        receivedCount += 1;
      } else if (r.status === 'vencido') {
        overdue += r.amount;
        overdueCount += 1;
      } else {
        upcoming += r.amount;
        upcomingCount += 1;
      }
    });

    return { total, received, upcoming, overdue, receivedCount, upcomingCount, overdueCount };
  }, [filteredReceivables]);

  // ==================== 3. CUSTÓDIA DE CHEQUES ====================
  const filteredCheques = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return (cheques || [])
      .filter((c) => {
        const bomPara = (c.data_vencimento || c.dataVencimento || '').split('T')[0];
        const matchDate = bomPara ? bomPara >= startDate && bomPara <= endDate : false;
        const emitente = String(c.emitente_nome || c.emitenteNome || '').toLowerCase();
        const cliente = String(c.cliente_nome || c.clienteNome || '').toLowerCase();
        const num = String(c.numero_cheque || c.numeroCheque || '').toLowerCase();
        const banco = String(c.banco || '').toLowerCase();
        const matchSearch =
          !term || emitente.includes(term) || cliente.includes(term) || num.includes(term) || banco.includes(term);
        const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
        return matchDate && matchSearch && matchStatus;
      })
      .sort((a, b) =>
        (a.data_vencimento || a.dataVencimento || '').localeCompare(b.data_vencimento || b.dataVencimento || '')
      );
  }, [cheques, startDate, endDate, searchTerm, statusFilter]);

  const chequeKpis = useMemo(() => {
    let total = 0;
    let emPoder = 0;
    let compensado = 0;
    let devolvido = 0;
    let emPoderCount = 0;
    let compensadoCount = 0;
    let devolvidoCount = 0;

    filteredCheques.forEach((c) => {
      const val = Number(c.valor) || 0;
      total += val;
      if (c.status === 'EM_NOSSO_PODER') {
        emPoder += val;
        emPoderCount += 1;
      } else if (c.status === 'COMPENSADO') {
        compensado += val;
        compensadoCount += 1;
      } else if (c.status === 'DEVOLVIDO') {
        devolvido += val;
        devolvidoCount += 1;
      }
    });

    return { total, emPoder, compensado, devolvido, emPoderCount, compensadoCount, devolvidoCount };
  }, [filteredCheques]);

  // ==================== AGRUPAMENTO SINTÉTICO ====================
  const groupOptions = useMemo(() => {
    if (subTab === 'pagar') {
      return [
        { value: 'default', label: 'Categoria' },
        { value: 'fornecedor', label: 'Fornecedor' },
        { value: 'forma', label: 'Forma de Pagamento' },
      ];
    }
    if (subTab === 'receber') {
      return [
        { value: 'default', label: 'Cliente / Tomador' },
        { value: 'origem', label: 'Origem (Venda/Serviço/NF)' },
        { value: 'forma', label: 'Forma de Pagamento' },
      ];
    }
    return [
      { value: 'default', label: 'Banco / Instituição' },
      { value: 'emitente', label: 'Emitente' },
      { value: 'status', label: 'Status do Cheque' },
    ];
  }, [subTab]);

  const currentGroupLabel =
    groupOptions.find((o) => o.value === groupBy)?.label || groupOptions[0].label;

  const syntheticRows = useMemo(() => {
    if (subTab === 'pagar') {
      return buildSyntheticSummaryRows(
        filteredPayables,
        (e) => {
          if (groupBy === 'fornecedor') return e.supplier || 'Fornecedor N/I';
          if (groupBy === 'forma') return getPaymentMethodLabel(e.paymentMethod);
          return e.categoryName || 'Outras Categorias';
        },
        (e) => e.amount || 0,
        {
          getPaidAmount: (e) => (e.status === 'pago' ? e.amount || 0 : 0),
          getPendingAmount: (e) => (e.status !== 'pago' ? e.amount || 0 : 0),
        }
      );
    }
    if (subTab === 'receber') {
      return buildSyntheticSummaryRows(
        filteredReceivables,
        (r) => {
          if (groupBy === 'origem') return r.originLabel;
          if (groupBy === 'forma') return r.paymentMethodLabel || 'Não Informado';
          return r.clientName;
        },
        (r) => r.amount || 0,
        {
          getPaidAmount: (r) => (r.status === 'pago' ? r.amount || 0 : 0),
          getPendingAmount: (r) => (r.status !== 'pago' ? r.amount || 0 : 0),
        }
      );
    }
    return buildSyntheticSummaryRows(
      filteredCheques,
      (c) => {
        if (groupBy === 'emitente') return c.emitente_nome || c.emitenteNome || 'N/I';
        if (groupBy === 'status') return c.status;
        return c.banco || 'Banco N/I';
      },
      (c) => Number(c.valor) || 0
    );
  }, [subTab, filteredPayables, filteredReceivables, filteredCheques, groupBy]);

  // ==================== REGISTRO DO RELATÓRIO PARA IMPRESSÃO A4 ====================
  const printConfig = useMemo<ReportPrintConfig>(() => {
    if (subTab === 'pagar') {
      return buildFinanceiroPagarReport({
        companyProfile,
        filteredPayables,
        startDate,
        endDate,
        competence: activeCompetence,
        todayIso,
        searchTerm,
        statusFilter,
        viewMode,
        groupByLabel: currentGroupLabel,
        syntheticRows,
      });
    }
    if (subTab === 'receber') {
      return buildFinanceiroReceberReport({
        companyProfile,
        filteredReceivables,
        startDate,
        endDate,
        competence: activeCompetence,
        searchTerm,
        statusFilter,
        viewMode,
        groupByLabel: currentGroupLabel,
        syntheticRows,
      });
    }
    return buildFinanceiroChequesReport({
      companyProfile,
      filteredCheques,
      startDate,
      endDate,
      competence: activeCompetence,
      searchTerm,
      statusFilter,
      viewMode,
      groupByLabel: currentGroupLabel,
      syntheticRows,
    });
  }, [
    subTab,
    companyProfile,
    filteredPayables,
    filteredReceivables,
    filteredCheques,
    startDate,
    endDate,
    activeCompetence,
    todayIso,
    searchTerm,
    statusFilter,
    viewMode,
    currentGroupLabel,
    syntheticRows,
  ]);

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  // ==================== EXPORTAÇÃO CSV ====================
  const handleExportCsv = () => {
    let headers = '';
    let rows = '';
    let filename = '';

    if (viewMode === 'sintetico') {
      headers = `Agrupamento (${currentGroupLabel}),Qtd_Lancamentos,Valor_Total_R$,Ticket_Medio_R$,Participacao_%\n`;
      rows = syntheticRows
        .map(
          (r) =>
            `"${r.groupKey}","${r.count}","${r.totalAmount.toFixed(2)}","${r.avgTicket.toFixed(2)}","${r.sharePct.toFixed(1)}%"`
        )
        .join('\n');
      filename = `relatorio_financeiro_${subTab}_sintetico_${startDate}_a_${endDate}.csv`;
    } else if (subTab === 'pagar') {
      headers = 'Vencimento,Fornecedor,Descricao,Categoria,Forma_Pagamento,Valor_R$,Status\n';
      rows = filteredPayables
        .map(
          (e) =>
            `"${e.dueDate}","${e.supplier || ''}","${e.description}","${e.categoryName || ''}","${e.paymentMethod || ''}","${e.amount}","${e.status}"`
        )
        .join('\n');
      filename = `relatorio_contas_a_pagar_${startDate}_a_${endDate}.csv`;
    } else if (subTab === 'receber') {
      headers = 'Vencimento,Cliente,Origem,Referencia,Forma_Pagamento,Valor_R$,Status\n';
      rows = filteredReceivables
        .map(
          (r) =>
            `"${r.dueDate}","${r.clientName}","${r.originLabel}","${r.description}","${r.paymentMethodLabel}","${r.amount}","${r.status}"`
        )
        .join('\n');
      filename = `relatorio_contas_a_receber_${startDate}_a_${endDate}.csv`;
    } else {
      headers = 'Numero_Cheque,Banco,Emitente,Cliente_Destino,Bom_Para,Valor_R$,Status\n';
      rows = filteredCheques
        .map(
          (c) =>
            `"${c.numero_cheque || c.numeroCheque || ''}","${c.banco}","${c.emitente_nome || c.emitenteNome || ''}","${c.fornecedor_destino || c.fornecedorDestino || c.cliente_nome || ''}","${c.data_vencimento || c.dataVencimento || ''}","${c.valor}","${c.status}"`
        )
        .join('\n');
      filename = `relatorio_cheques_custodia_${startDate}_a_${endDate}.csv`;
    }

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in financial-subtab-clean">
      {/* 0. Sub-pílulas Financeiras */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSwitchSubTab('pagar')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
              subTab === 'pagar'
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                : 'bg-white dark:bg-stone-800 border-slate-400 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Contas a Pagar</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSubTab('receber')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
              subTab === 'receber'
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                : 'bg-white dark:bg-stone-800 border-slate-400 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Contas a Receber</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchSubTab('cheques')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
              subTab === 'cheques'
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                : 'bg-white dark:bg-stone-800 border-slate-400 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700'
            }`}
          >
            <WalletCards className="w-3.5 h-3.5" />
            <span>Controle & Custódia de Cheques</span>
          </button>
        </div>
      </div>

      {/* 1. Cards de Resumo (4 cards por sub-pílula no padrão bg-[#e0e6f1] border border-black) */}
      {subTab === 'pagar' && (
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-slate-700 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-stone-800 text-slate-700 flex items-center justify-center shrink-0 border border-black/15">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Total no Período
              </span>
              <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] truncate">
                {formatCurrencyBRL(payableKpis.total)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{filteredPayables.length} títulos</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-500 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 border border-black/15">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Pago / Liquidado
              </span>
              <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(payableKpis.paid)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{payableKpis.paidCount} quitados</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Em Aberto
              </span>
              <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(payableKpis.open)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{payableKpis.openCount} a vencer</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-600 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 border border-black/15">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Vencido / Atraso
              </span>
              <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(payableKpis.overdue)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{payableKpis.overdueCount} vencidos</div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'receber' && (
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-600 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center shrink-0 border border-black/15">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Total a Receber
              </span>
              <div className="text-sm sm:text-base font-black text-sky-700 dark:text-sky-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(receivableKpis.total)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{filteredReceivables.length} títulos</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-500 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 border border-black/15">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Recebido
              </span>
              <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(receivableKpis.received)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{receivableKpis.receivedCount} liquidados</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                A Vencer
              </span>
              <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(receivableKpis.upcoming)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{receivableKpis.upcomingCount} no prazo</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-600 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 border border-black/15">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Inadimplente / Vencido
              </span>
              <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(receivableKpis.overdue)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{receivableKpis.overdueCount} vencidos</div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'cheques' && (
        <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-600 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center shrink-0 border border-black/15">
              <WalletCards className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Total em Custódia
              </span>
              <div className="text-sm sm:text-base font-black text-sky-700 dark:text-sky-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(chequeKpis.total)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{filteredCheques.length} cheques</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                A Compensar
              </span>
              <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(chequeKpis.emPoder)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{chequeKpis.emPoderCount} em nosso poder</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-500 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 border border-black/15">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Compensados
              </span>
              <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(chequeKpis.compensado)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{chequeKpis.compensadoCount} liquidados</div>
            </div>
          </div>

          <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-600 shadow-2xs flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 border border-black/15">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
                Devolvidos
              </span>
              <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-400 font-['Outfit'] truncate">
                {formatCurrencyBRL(chequeKpis.devolvido)}
              </div>
              <div className="text-[10px] text-stone-600 truncate">{chequeKpis.devolvidoCount} ocorrências</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Barra de Filtros, Alternador Analítico/Sintético e Competência */}
      <div className="reports-filter-bar shrink-0 bg-[#cad4e6] dark:bg-stone-900 px-3 py-2 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[190px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              subTab === 'pagar'
                ? 'Buscar por fornecedor, descrição ou categoria...'
                : subTab === 'receber'
                ? 'Buscar por cliente, pedido ou origem...'
                : 'Buscar por nº do cheque, banco ou emitente...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688]"
          >
            <option value="todos">Todos os status</option>
            {subTab === 'pagar' && (
              <>
                <option value="pago">Pago / Liquidado</option>
                <option value="aberto">Em Aberto</option>
                <option value="vencido">Vencido / Atraso</option>
              </>
            )}
            {subTab === 'receber' && (
              <>
                <option value="pago">Recebido</option>
                <option value="a_vencer">A Vencer</option>
                <option value="vencido">Inadimplente / Vencido</option>
              </>
            )}
            {subTab === 'cheques' && (
              <>
                <option value="EM_NOSSO_PODER">A Compensar (Em Poder)</option>
                <option value="COMPENSADO">Compensados</option>
                <option value="DEVOLVIDO">Devolvidos</option>
                <option value="REPASSADO">Repassados</option>
              </>
            )}
          </select>

          <ReportViewModeToggle
            viewMode={viewMode}
            onChange={setViewMode}
            groupBy={groupBy}
            groupOptions={groupOptions}
            onGroupByChange={setGroupBy}
          />

          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-[#e0e6f1] dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-[#d2dced] dark:hover:bg-stone-700 border border-black dark:border-stone-700 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela (Analítica ou Sintética) */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          {viewMode === 'sintetico' ? (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="py-2.5 px-3.5">{currentGroupLabel}</th>
                  <th className="py-2.5 px-3.5 text-center">Qtd. Lanç.</th>
                  {subTab !== 'cheques' && (
                    <>
                      <th className="py-2.5 px-3.5 text-right">Liquidado (R$)</th>
                      <th className="py-2.5 px-3.5 text-right">Em Aberto (R$)</th>
                    </>
                  )}
                  <th className="py-2.5 px-3.5 text-right">Valor Total (R$)</th>
                  <th className="py-2.5 px-3.5 text-right">Ticket Médio</th>
                  <th className="py-2.5 px-3.5 text-right">% Participação</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {syntheticRows.length > 0 ? (
                  syntheticRows.map((row) => (
                    <tr
                      key={row.groupKey}
                      className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800"
                    >
                      <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                        {row.groupKey}
                      </td>
                      <td className="py-2.5 px-3.5 text-center font-bold">{row.count}</td>
                      {subTab !== 'cheques' && (
                        <>
                          <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatCurrencyBRL(row.paidAmount || 0)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                            {formatCurrencyBRL(row.pendingAmount || 0)}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">
                        {formatCurrencyBRL(row.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-stone-700 dark:text-stone-300">
                        {formatCurrencyBRL(row.avgTicket)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-emerald-700 dark:text-emerald-400">
                        {row.sharePct.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={subTab !== 'cheques' ? 7 : 5}
                      className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900"
                    >
                      Nenhum lançamento localizado para agrupamento no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : subTab === 'pagar' ? (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="py-2.5 px-3.5">Vencimento</th>
                  <th className="py-2.5 px-3.5">Fornecedor</th>
                  <th className="py-2.5 px-3.5">Descrição</th>
                  <th className="py-2.5 px-3.5">Categoria</th>
                  <th className="py-2.5 px-3.5">Forma Pagto.</th>
                  <th className="py-2.5 px-3.5 text-right">Valor (R$)</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {filteredPayables.length > 0 ? (
                  filteredPayables.map((item) => {
                    const isOverdue = item.status !== 'pago' && item.dueDate && item.dueDate < todayIso;
                    return (
                      <tr
                        key={item.id}
                        className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800"
                      >
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-700 dark:text-stone-400">
                          {formatDateBR(item.dueDate)}
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                          {item.supplier || 'Fornecedor N/I'}
                        </td>
                        <td className="py-2.5 px-3.5 text-stone-800 dark:text-stone-300 font-medium">
                          {item.description}
                        </td>
                        <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                          {item.categoryName || '-'}
                        </td>
                        <td className="py-2.5 px-3.5 uppercase text-[11px] font-semibold text-stone-700 dark:text-stone-400">
                          {getPaymentMethodLabel(item.paymentMethod)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-black text-rose-700 dark:text-rose-400 whitespace-nowrap">
                          {formatCurrencyBRL(item.amount || 0)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              item.status === 'pago'
                                ? 'bg-emerald-100 text-emerald-700'
                                : isOverdue
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.status === 'pago' ? 'Pago' : isOverdue ? 'Vencido' : 'Em Aberto'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
                      Nenhuma conta a pagar localizada no período e filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : subTab === 'receber' ? (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="py-2.5 px-3.5">Vencimento</th>
                  <th className="py-2.5 px-3.5">Cliente / Tomador</th>
                  <th className="py-2.5 px-3.5">Origem</th>
                  <th className="py-2.5 px-3.5">Referência / OS</th>
                  <th className="py-2.5 px-3.5">Forma Pagto.</th>
                  <th className="py-2.5 px-3.5 text-right">Valor (R$)</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {filteredReceivables.length > 0 ? (
                  filteredReceivables.map((item) => (
                    <tr
                      key={item.id}
                      className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800"
                    >
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-700 dark:text-stone-400">
                        {formatDateBR(item.dueDate)}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                        {item.clientName}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold text-sky-800 dark:text-sky-300">
                        {item.originLabel}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                        {item.description}
                      </td>
                      <td className="py-2.5 px-3.5 uppercase text-[11px] font-semibold text-stone-700 dark:text-stone-400">
                        {item.paymentMethodLabel}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {formatCurrencyBRL(item.amount)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'pago'
                              ? 'bg-emerald-100 text-emerald-700'
                              : item.status === 'vencido'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {item.status === 'pago' ? 'Recebido' : item.status === 'vencido' ? 'Vencido' : 'A Vencer'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
                      Nenhum título a receber localizado no período e filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="py-2.5 px-3.5">Nº Cheque</th>
                  <th className="py-2.5 px-3.5">Banco</th>
                  <th className="py-2.5 px-3.5">Emitente</th>
                  <th className="py-2.5 px-3.5">Favorecido / Destino</th>
                  <th className="py-2.5 px-3.5">Data Bom Para</th>
                  <th className="py-2.5 px-3.5 text-right">Valor (R$)</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {filteredCheques.length > 0 ? (
                  filteredCheques.map((c) => (
                    <tr
                      key={c.id}
                      className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800"
                    >
                      <td className="py-2.5 px-3.5 font-mono font-bold text-stone-900 dark:text-stone-100">
                        {c.numero_cheque || c.numeroCheque || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-800 dark:text-stone-300 font-medium">
                        {c.banco || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                        {c.emitente_nome || c.emitenteNome || 'N/I'}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                        {c.fornecedor_destino || c.fornecedorDestino || c.cliente_nome || c.clienteNome || 'Em Custódia'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-700 dark:text-stone-400">
                        {formatDateBR(c.data_vencimento || c.dataVencimento || '')}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-sky-700 dark:text-sky-400 whitespace-nowrap">
                        {formatCurrencyBRL(Number(c.valor) || 0)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            c.status === 'COMPENSADO'
                              ? 'bg-emerald-100 text-emerald-700'
                              : c.status === 'DEVOLVIDO'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {c.status === 'EM_NOSSO_PODER' ? 'A Compensar' : c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
                      Nenhum cheque localizado no período e filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
