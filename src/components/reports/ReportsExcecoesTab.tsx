import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  DollarSign,
  Package,
  Truck,
  Search,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import {
  CompanyProfile,
  Employee,
  Expense,
  FinanceiroCheque,
  InventoryItem,
  Machinery,
  MaintenanceLog,
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
  buildExcecoesAlertasReport,
  ExceptionAlertItem,
  ReportPrintConfig,
} from './reportPrintBuilders';

interface ReportsExcecoesTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  inventory: InventoryItem[];
  machineries: Machinery[];
  maintenanceLogs: MaintenanceLog[];
  employees: Employee[];
  companyProfile: CompanyProfile;
  onOpenPrintModal: (config: ReportPrintConfig) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

export const ReportsExcecoesTab: React.FC<ReportsExcecoesTabProps> = ({
  expenses = [],
  orders = [],
  services = [],
  inventory = [],
  machineries = [],
  maintenanceLogs = [],
  employees = [],
  companyProfile,
  onOpenPrintModal,
  onRegisterPrintGetter,
}) => {
  const [areaFilter, setAreaFilter] = useState<'todas' | 'financeiro' | 'estoque' | 'frota_rh'>('todas');
  const [severityFilter, setSeverityFilter] = useState<'todas' | 'critico' | 'alto' | 'atencao'>('todas');
  const [searchTerm, setSearchTerm] = useState('');

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

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const in30DaysIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  }, []);

  // Auditoria em Tempo Real de Exceções e Alertas
  const allAlerts = useMemo<ExceptionAlertItem[]>(() => {
    const list: ExceptionAlertItem[] = [];

    // 1. FINANCEIRO — Contas a Pagar vencidas ou vencendo hoje
    (expenses || []).forEach((e) => {
      if (!e || e.status === 'pago') return;
      const due = (e.dueDate || '').split('T')[0];
      if (!due) return;
      if (due < todayIso) {
        list.push({
          id: `exp_ov_${e.id}`,
          area: 'financeiro',
          areaLabel: 'Financeiro',
          severity: 'critico',
          category: 'Conta a Pagar Vencida',
          title: `${e.description} (${e.supplier || 'Fornecedor N/I'})`,
          detail: `Vencimento expirado em ${formatDateBR(due)} • Categoria: ${e.categoryName || '-'}`,
          referenceDate: due,
          amountOrMetric: formatCurrencyBRL(e.amount || 0),
        });
      } else if (due === todayIso) {
        list.push({
          id: `exp_td_${e.id}`,
          area: 'financeiro',
          areaLabel: 'Financeiro',
          severity: 'alto',
          category: 'Conta a Pagar Hoje',
          title: `${e.description} (${e.supplier || 'Fornecedor N/I'})`,
          detail: `Vencimento hoje (${formatDateBR(due)}) • Categoria: ${e.categoryName || '-'}`,
          referenceDate: due,
          amountOrMetric: formatCurrencyBRL(e.amount || 0),
        });
      }
    });

    // 2. FINANCEIRO — Contas a Receber vencidas ou vencendo hoje
    (orders || []).forEach((o) => {
      if (!o || o.status === 'cancelado' || o.paymentStatus === 'pago') return;
      const due = (o.dueDate || o.deliveryDate || o.date || '').split('T')[0];
      if (!due || due > todayIso) return;
      list.push({
        id: `ord_rec_${o.id}`,
        area: 'financeiro',
        areaLabel: 'Financeiro',
        severity: due < todayIso ? 'critico' : 'alto',
        category: due < todayIso ? 'Recebível em Atraso' : 'Recebível Vence Hoje',
        title: `${o.clientName} — Pedido #${o.orderNumber || o.id.slice(0, 6)}`,
        detail: `${o.productType || 'Venda'} • Vencimento: ${formatDateBR(due)}`,
        referenceDate: due,
        amountOrMetric: formatCurrencyBRL(o.totalAmount || 0),
      });
    });

    (services || []).forEach((s) => {
      const isBilled = s.status === 'faturado' || s.billingStatus === 'faturado' || !!s.billedAt;
      if (!s || s.status === 'cancelado' || !isBilled || s.paymentStatus === 'pago' || s.status === 'finalizado') return;
      const due = (s.dueDate || s.date || s.startDate || '').split('T')[0];
      if (!due || due > todayIso) return;
      list.push({
        id: `srv_rec_${s.id}`,
        area: 'financeiro',
        areaLabel: 'Financeiro',
        severity: due < todayIso ? 'critico' : 'alto',
        category: due < todayIso ? 'Serviço Faturado Vencido' : 'Serviço Vence Hoje',
        title: `${s.clientName} — ${s.serviceType}`,
        detail: `Vencimento em ${formatDateBR(due)}${s.farmName ? ` • ${s.farmName}` : ''}`,
        referenceDate: due,
        amountOrMetric: formatCurrencyBRL(s.totalAmount || 0),
      });
    });

    (notasSaida || []).forEach((n) => {
      if (!n.lancarContasReceber || n.status === 'CANCELADA' || n.status === 'RASCUNHO' || n.receberStatus === 'pago') return;
      const due = (n.dataVencimento || n.dataEmissao || '').split('T')[0];
      if (!due || due > todayIso) return;
      list.push({
        id: `nf_rec_${n.id}`,
        area: 'financeiro',
        areaLabel: 'Financeiro',
        severity: due < todayIso ? 'critico' : 'alto',
        category: 'NF-e Recebível em Atraso',
        title: `${n.destinatarioNome || 'Cliente'} — NF ${n.numero}`,
        detail: `Vencimento em ${formatDateBR(due)}`,
        referenceDate: due,
        amountOrMetric: formatCurrencyBRL(Number(n.valorTotal) || 0),
      });
    });

    // 3. FINANCEIRO — Cheques devolvidos ou vencendo hoje / em atraso
    (cheques || []).forEach((c) => {
      const chqDate = (c.data_vencimento || c.dataVencimento || '').split('T')[0];
      const num = c.numero_cheque || c.numeroCheque || '-';
      const emit = c.emitente_nome || c.emitenteNome || 'N/I';
      if (c.status === 'DEVOLVIDO') {
        list.push({
          id: `chq_dev_${c.id}`,
          area: 'financeiro',
          areaLabel: 'Financeiro',
          severity: 'critico',
          category: 'Cheque Devolvido',
          title: `Cheque nº ${num} (${c.banco || 'Banco'}) — ${emit}`,
          detail: `Bom para ${formatDateBR(chqDate)} • Necessita cobrança / regularização`,
          referenceDate: chqDate,
          amountOrMetric: formatCurrencyBRL(Number(c.valor) || 0),
        });
      } else if (c.status === 'EM_NOSSO_PODER' && chqDate && chqDate <= todayIso) {
        list.push({
          id: `chq_due_${c.id}`,
          area: 'financeiro',
          areaLabel: 'Financeiro',
          severity: 'alto',
          category: chqDate < todayIso ? 'Cheque Pronto p/ Compensar' : 'Cheque Vence Hoje',
          title: `Cheque nº ${num} (${c.banco || 'Banco'}) — ${emit}`,
          detail: `Bom para ${formatDateBR(chqDate)} • Em nosso poder aguardando depósito/baixa`,
          referenceDate: chqDate,
          amountOrMetric: formatCurrencyBRL(Number(c.valor) || 0),
        });
      }
    });

    // 4. ESTOQUE & ALMOXARIFADO — Saldo zerado ou abaixo do mínimo
    (inventory || []).forEach((item) => {
      const qty = Number(item.quantity ?? item.quantidade_atual ?? 0);
      const minQty = Number(item.minQuantity ?? 0);
      const unit = item.unit || 'un';
      if (qty <= 0) {
        list.push({
          id: `inv_zero_${item.id}`,
          area: 'estoque',
          areaLabel: 'Estoque',
          severity: 'critico',
          category: 'Estoque Zerado',
          title: `${item.name}${item.code ? ` (${item.code})` : ''}`,
          detail: `Saldo atual zerado • Mínimo configurado: ${minQty} ${unit}`,
          amountOrMetric: `${qty} ${unit}`,
        });
      } else if (minQty > 0 && qty <= minQty) {
        list.push({
          id: `inv_min_${item.id}`,
          area: 'estoque',
          areaLabel: 'Estoque',
          severity: 'alto',
          category: 'Abaixo do Estoque Mínimo',
          title: `${item.name}${item.code ? ` (${item.code})` : ''}`,
          detail: `Reposição necessária • Mínimo recomendado: ${minQty} ${unit}`,
          amountOrMetric: `${qty} / ${minQty} ${unit}`,
        });
      }
    });

    // 5. FROTA & RH — Manutenções/Revisões, IPVA/Licenciamento, CNHs
    const latestMaintNextByVeh = new Map<string, { due: number; log: MaintenanceLog }>();
    (maintenanceLogs || []).forEach((m) => {
      if (m.nextServiceDueHourMeterOrKm && m.machineryId && m.status !== 'cancelada') {
        const curr = latestMaintNextByVeh.get(m.machineryId);
        if (!curr || (m.date || '') >= (curr.log.date || '')) {
          latestMaintNextByVeh.set(m.machineryId, { due: m.nextServiceDueHourMeterOrKm, log: m });
        }
      }
    });

    (machineries || []).forEach((v) => {
      const label = `${v.licensePlateOrSerial ? `[${v.licensePlateOrSerial}] ` : ''}${v.name || v.model}`;

      if (v.status === 'em_manutencao') {
        list.push({
          id: `veh_maint_${v.id}`,
          area: 'frota_rh',
          areaLabel: 'Frota & RH',
          severity: 'alto',
          category: 'Veículo em Manutenção',
          title: label,
          detail: 'Equipamento atualmente parado em oficina / manutenção',
          referenceDate: v.lastMaintenanceDate,
          amountOrMetric: 'Em Oficina',
        });
      }

      const nextRev = latestMaintNextByVeh.get(v.id);
      const isHours = v.controla_por === 'horas' || v.controlBy === 'horas' || (v.currentHourMeter || v.hourMeter || 0) > 0 && !(v.currentKm || 0);
      const currentReading = isHours
        ? Number(v.currentHourMeter || v.hourMeter || v.horimetro_ou_km_atual || 0)
        : Number(v.currentKm || v.horimetro_ou_km_atual || 0);

      if (nextRev && currentReading > 0) {
        const unitLabel = isHours ? 'h' : 'km';
        const diff = nextRev.due - currentReading;
        if (diff <= 0) {
          list.push({
            id: `veh_rev_ov_${v.id}`,
            area: 'frota_rh',
            areaLabel: 'Frota & RH',
            severity: 'critico',
            category: 'Revisão Preventiva Vencida',
            title: label,
            detail: `Prevista para ${nextRev.due.toLocaleString('pt-BR')} ${unitLabel} • Atual: ${currentReading.toLocaleString('pt-BR')} ${unitLabel}`,
            referenceDate: nextRev.log.date,
            amountOrMetric: `+${Math.abs(diff).toLocaleString('pt-BR')} ${unitLabel} venc.`,
          });
        } else if ((isHours && diff <= 25) || (!isHours && diff <= 500)) {
          list.push({
            id: `veh_rev_soon_${v.id}`,
            area: 'frota_rh',
            areaLabel: 'Frota & RH',
            severity: 'atencao',
            category: 'Revisão Preventiva Próxima',
            title: label,
            detail: `Faltam ${diff.toLocaleString('pt-BR')} ${unitLabel} para próxima revisão (${nextRev.due.toLocaleString('pt-BR')} ${unitLabel})`,
            referenceDate: nextRev.log.date,
            amountOrMetric: `Falta ${diff.toLocaleString('pt-BR')} ${unitLabel}`,
          });
        }
      }

      const ipvaAmt = Number(v.ipvaTotalAmount || 0);
      if (ipvaAmt > 0 && v.ipvaFinancialStatus !== 'lancado') {
        list.push({
          id: `veh_ipva_${v.id}`,
          area: 'frota_rh',
          areaLabel: 'Frota & RH',
          severity: 'atencao',
          category: 'IPVA Pendente de Lançamento',
          title: label,
          detail: 'IPVA calculado no patrimônio ainda não lançado no Contas a Pagar',
          amountOrMetric: formatCurrencyBRL(ipvaAmt),
        });
      }

      const licAmt = Number(v.licensingValue || 0);
      if (licAmt > 0 && v.licensingFinancialStatus !== 'lancado') {
        list.push({
          id: `veh_lic_${v.id}`,
          area: 'frota_rh',
          areaLabel: 'Frota & RH',
          severity: 'atencao',
          category: 'Licenciamento Pendente',
          title: label,
          detail: 'Taxa anual de licenciamento pendente de lançamento financeiro',
          amountOrMetric: formatCurrencyBRL(licAmt),
        });
      }
    });

    (employees || []).forEach((emp) => {
      if (!emp || emp.status === 'inativo' || !emp.cnhExpiration) return;
      const exp = emp.cnhExpiration.split('T')[0];
      if (exp < todayIso) {
        list.push({
          id: `rh_cnh_ov_${emp.id}`,
          area: 'frota_rh',
          areaLabel: 'Frota & RH',
          severity: 'critico',
          category: 'CNH Vencida (RH)',
          title: `${emp.name}${emp.cnhCategory ? ` • Cat. ${emp.cnhCategory}` : ''}`,
          detail: `Habilitação vencida em ${formatDateBR(exp)} • Proibido conduzir veículos da frota`,
          referenceDate: exp,
          amountOrMetric: 'Vencida',
        });
      } else if (exp <= in30DaysIso) {
        list.push({
          id: `rh_cnh_soon_${emp.id}`,
          area: 'frota_rh',
          areaLabel: 'Frota & RH',
          severity: 'alto',
          category: 'CNH a Vencer (30 dias)',
          title: `${emp.name}${emp.cnhCategory ? ` • Cat. ${emp.cnhCategory}` : ''}`,
          detail: `Habilitação vence em ${formatDateBR(exp)} • Programar renovação`,
          referenceDate: exp,
          amountOrMetric: formatDateBR(exp),
        });
      }
    });

    const sevWeight = { critico: 0, alto: 1, atencao: 2 };
    return list.sort((a, b) => sevWeight[a.severity] - sevWeight[b.severity]);
  }, [expenses, orders, services, notasSaida, cheques, inventory, machineries, maintenanceLogs, employees, todayIso, in30DaysIso]);

  const filteredAlerts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return allAlerts.filter((a) => {
      const matchArea = areaFilter === 'todas' || a.area === areaFilter;
      const matchSev = severityFilter === 'todas' || a.severity === severityFilter;
      const matchSearch =
        !term ||
        a.title.toLowerCase().includes(term) ||
        a.category.toLowerCase().includes(term) ||
        a.detail.toLowerCase().includes(term);
      return matchArea && matchSev && matchSearch;
    });
  }, [allAlerts, areaFilter, severityFilter, searchTerm]);

  const counts = useMemo(() => {
    return {
      total: allAlerts.length,
      critico: allAlerts.filter((a) => a.severity === 'critico').length,
      financeiro: allAlerts.filter((a) => a.area === 'financeiro').length,
      estoque: allAlerts.filter((a) => a.area === 'estoque').length,
      frotaRh: allAlerts.filter((a) => a.area === 'frota_rh').length,
    };
  }, [allAlerts]);

  const printConfig = useMemo(
    () =>
      buildExcecoesAlertasReport({
        companyProfile,
        alerts: filteredAlerts,
        areaFilter,
        severityFilter,
        searchTerm,
      }),
    [companyProfile, filteredAlerts, areaFilter, severityFilter, searchTerm]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in financial-subtab-clean">
      {/* 1. Cards de Resumo de Criticidade */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0 border border-black/15">
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Exceções em Tempo Real
            </span>
            <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-400 font-['Outfit'] truncate">
              {counts.total} alertas
            </div>
            <div className="text-[10px] text-stone-600 truncate">{counts.critico} críticos imediatos</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Financeiro & Cheques
            </span>
            <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] truncate">
              {counts.financeiro} pendências
            </div>
            <div className="text-[10px] text-stone-600 truncate">Vencidos, atraso e devolvidos</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center shrink-0 border border-black/15">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Estoque & Almoxarifado
            </span>
            <div className="text-sm sm:text-base font-black text-sky-700 dark:text-sky-400 font-['Outfit'] truncate">
              {counts.estoque} alertas
            </div>
            <div className="text-[10px] text-stone-600 truncate">Saldo zerado ou mínimo</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-violet-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 flex items-center justify-center shrink-0 border border-black/15">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Frota & RH
            </span>
            <div className="text-sm sm:text-base font-black text-violet-700 dark:text-violet-400 font-['Outfit'] truncate">
              {counts.frotaRh} alertas
            </div>
            <div className="text-[10px] text-stone-600 truncate">Revisões, IPVA/Licenc. e CNH</div>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros e Botão Imprimir Pauta de Pendências */}
      <div className="reports-filter-bar shrink-0 bg-[#cad4e6] dark:bg-stone-900 px-3 py-2 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'todas', label: `Todas (${counts.total})` },
            { id: 'financeiro', label: `Financeiro (${counts.financeiro})` },
            { id: 'estoque', label: `Estoque (${counts.estoque})` },
            { id: 'frota_rh', label: `Frota & RH (${counts.frotaRh})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setAreaFilter(pill.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                areaFilter === pill.id
                  ? 'bg-emerald-700 text-white border-emerald-800'
                  : 'bg-white dark:bg-stone-800 border-slate-400 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-slate-100'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar exceções por título, produto, veículo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
          />
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688]"
        >
          <option value="todas">Todas as criticidades</option>
          <option value="critico">Crítico (Imediato)</option>
          <option value="alto">Alto</option>
          <option value="atencao">Atenção</option>
        </select>

        <button
          type="button"
          onClick={() => onOpenPrintModal(printConfig)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#e0e6f1] dark:bg-stone-800 text-black dark:text-stone-200 hover:bg-[#d2dced] border border-black dark:border-stone-700 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Imprimir Pauta de Pendências</span>
        </button>
      </div>

      {/* 3. Tabela de Alertas */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
              <tr>
                <th className="py-2.5 px-3.5 text-center w-24">Severidade</th>
                <th className="py-2.5 px-3.5 w-28">Área</th>
                <th className="py-2.5 px-3.5 w-44">Tipo de Alerta</th>
                <th className="py-2.5 px-3.5">Ocorrência & Detalhes</th>
                <th className="py-2.5 px-3.5 w-28">Data Ref.</th>
                <th className="py-2.5 px-3.5 text-right w-32">Valor / Saldo</th>
              </tr>
            </thead>
            <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map((item) => (
                  <tr
                    key={item.id}
                    className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800"
                  >
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.severity === 'critico'
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : item.severity === 'alto'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-sky-100 text-sky-800 border border-sky-300'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {item.severity === 'critico'
                          ? 'Crítico'
                          : item.severity === 'alto'
                          ? 'Alto'
                          : 'Atenção'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-stone-800 dark:text-stone-200">
                      {item.areaLabel}
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-stone-700 dark:text-stone-300">
                      {item.category}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="font-bold text-stone-900 dark:text-stone-100">{item.title}</div>
                      <div className="text-[11px] text-stone-600 dark:text-stone-400">{item.detail}</div>
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-700 dark:text-stone-400">
                      {item.referenceDate ? formatDateBR(item.referenceDate) : '-'}
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-right font-black whitespace-nowrap ${
                        item.severity === 'critico'
                          ? 'text-rose-700 dark:text-rose-400'
                          : item.severity === 'alto'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-sky-700 dark:text-sky-400'
                      }`}
                    >
                      {item.amountOrMetric || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center bg-[#e0e6f1] dark:bg-stone-900">
                    <div className="inline-flex flex-col items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-7 h-7" />
                      <span className="font-bold text-sm">
                        Nenhuma exceção encontrada para os filtros selecionados.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
