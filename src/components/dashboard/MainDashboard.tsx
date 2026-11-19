import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  Wallet,
  Truck,
  Layers,
  RotateCcw,
  Wrench,
  Package,
  IdCard,
  CalendarClock,
  Scale,
  Receipt
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  Expense,
  Client,
  Machinery,
  Employee,
  SilageOrder,
  ServiceOrder,
  InventoryItem,
  FuelLog,
  CropSeason,
  BankAccount,
  NotaSaidaRecord
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  checkCnhStatus,
  saveStoredExpenses,
  getStoredExpenses,
  saveStoredFuelLogs,
  getStoredFuelLogs,
  getActiveCompanyId,
  getStoredDocumentosEntrada,
  getStoredFiscalRecords,
  getStoredBankAccounts,
  getStoredNotasSaida
} from '../../lib/storage';
import {
  getCurrentCompetence,
  getPrevCompetence,
  getNextCompetence,
  matchesCompetence
} from '../financial/CompetenceSelector';
import { calculatePredictiveMaintenanceAlerts, PredictiveMaintenanceAlert } from '../../lib/predictiveMaintenance';
import { supabase } from '../../lib/supabaseClient';
import {
  isSupabaseConfigured,
  fetchContasAPagar,
  fetchAbastecimentos,
  saveCloudFuelLogs,
  getAbastecimentosTableName,
  toValidUUID
} from '../../lib/supabaseService';

interface MainDashboardProps {
  expenses: Expense[];
  clients: Client[];
  machineries: Machinery[];
  employees: Employee[];
  orders: SilageOrder[];
  services?: ServiceOrder[];
  inventory?: InventoryItem[];
  fuelLogs?: FuelLog[];
  seasons?: CropSeason[];
  onNavigate: (tab: string) => void;
  onNewExpense: () => void;
  onOpenAiParser: () => void;
  onOpenIntegration: () => void;
  onExpensesChange?: (expenses: Expense[]) => void;
}

interface RecentActivityItem {
  id: string;
  kind: 'receita' | 'despesa';
  title: string;
  subtitle: string;
  dateIso: string;
  sortKey: number;
  amount: number;
  statusLabel: string;
  targetTab: string;
}

function normalizeIsoDate(raw?: string | null): string {
  if (!raw) return '';
  const str = String(raw).trim();
  if (!str) return '';
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const y = parts[2].slice(0, 4);
      const m = parts[1].padStart(2, '0');
      const d = parts[0].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (str.includes('T')) {
    return str.split('T')[0];
  }
  return str.slice(0, 10);
}

function parseCompetenceYearMonth(competence: string): { year: number; month: number } {
  const now = new Date();
  if (!competence || !competence.includes('/')) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const [mStr, yStr] = competence.split('/');
  const m = parseInt(mStr, 10);
  const y = parseInt(yStr, 10);
  if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: y, month: m };
}

function formatCompactAxisBRL(value: number): string {
  if (value === 0) return 'R$ 0';
  if (Math.abs(value) >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)}k`;
  }
  return `R$ ${Math.round(value)}`;
}

function readLocalPdvVendas(): any[] {
  try {
    const raw =
      localStorage.getItem('agrocontrol_vendas') ||
      localStorage.getItem('agrocontrol_pdv_vendas') ||
      localStorage.getItem('colaca_silagem_vendas_pdv');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function readLocalProductsFallback(): any[] {
  try {
    const raw =
      localStorage.getItem('agrocontrol_produtos') ||
      localStorage.getItem('colaca_silagem_estoque_produtos') ||
      localStorage.getItem('silagem_facil_clean_v1_inventory');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

const CATEGORY_BAR_PALETTE = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#6366f1',
  '#06b6d4',
  '#8b5cf6',
  '#ea580c'
];

export const MainDashboard: React.FC<MainDashboardProps> = ({
  expenses: propExpenses,
  machineries,
  employees,
  orders,
  services = [],
  inventory = [],
  fuelLogs: propFuelLogs = [],
  onNavigate,
  onNewExpense,
  onExpensesChange,
}) => {
  const [activeCompetence, setActiveCompetence] = useState<string>(() => getCurrentCompetence());
  const [activeExpenses, setActiveExpenses] = useState<Expense[]>(() => propExpenses || []);
  const [activeFuelLogs, setActiveFuelLogs] = useState<FuelLog[]>(() => propFuelLogs || []);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => getStoredBankAccounts());
  const [notasSaida, setNotasSaida] = useState<NotaSaidaRecord[]>(() => getStoredNotasSaida());
  const [pdvVendas, setPdvVendas] = useState<any[]>(() => readLocalPdvVendas());
  const [isSyncing, setIsSyncing] = useState(false);

  const [preventiveAlerts, setPreventiveAlerts] = useState<PredictiveMaintenanceAlert[]>(() => {
    return calculatePredictiveMaintenanceAlerts(machineries, propFuelLogs);
  });

  const syncLocalFinancialSnapshots = useCallback(() => {
    setBankAccounts(getStoredBankAccounts());
    setNotasSaida(getStoredNotasSaida());
    setPdvVendas(readLocalPdvVendas());
  }, []);

  useEffect(() => {
    const handleRecalculateAlerts = () => {
      setPreventiveAlerts(calculatePredictiveMaintenanceAlerts(machineries, activeFuelLogs));
    };
    handleRecalculateAlerts();
    window.addEventListener('agrocontrol_plano_preventivo_grupos_updated', handleRecalculateAlerts);
    window.addEventListener('silagem_maintenance_updated', handleRecalculateAlerts);
    window.addEventListener('silagem_fuel_logs_updated', handleRecalculateAlerts);
    window.addEventListener('silagem_machineries_updated', handleRecalculateAlerts);
    window.addEventListener('storage', handleRecalculateAlerts);
    return () => {
      window.removeEventListener('agrocontrol_plano_preventivo_grupos_updated', handleRecalculateAlerts);
      window.removeEventListener('silagem_maintenance_updated', handleRecalculateAlerts);
      window.removeEventListener('silagem_fuel_logs_updated', handleRecalculateAlerts);
      window.removeEventListener('silagem_machineries_updated', handleRecalculateAlerts);
      window.removeEventListener('storage', handleRecalculateAlerts);
    };
  }, [machineries, activeFuelLogs]);

  useEffect(() => {
    setActiveExpenses((prev) => {
      const serPrev = JSON.stringify(prev || []);
      const serNext = JSON.stringify(propExpenses || []);
      if (serPrev === serNext) return prev;
      return propExpenses || [];
    });
  }, [propExpenses]);

  useEffect(() => {
    setActiveFuelLogs((prev) => {
      const serPrev = JSON.stringify(prev || []);
      const serNext = JSON.stringify(propFuelLogs || []);
      if (serPrev === serNext) return prev;
      return propFuelLogs || [];
    });
  }, [propFuelLogs]);

  const onExpensesChangeRef = useRef(onExpensesChange);
  useEffect(() => {
    onExpensesChangeRef.current = onExpensesChange;
  }, [onExpensesChange]);

  const refreshDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshDashboardData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsSyncing(true);
    syncLocalFinancialSnapshots();

    if (!isSupabaseConfigured) {
      if (showIndicator) setTimeout(() => setIsSyncing(false), 250);
      return;
    }

    try {
      const activeCompanyId = getActiveCompanyId();
      const [cloudContas, cloudFuels] = await Promise.all([
        fetchContasAPagar(activeCompanyId),
        fetchAbastecimentos(activeCompanyId)
      ]);

      if (cloudContas !== null && Array.isArray(cloudContas) && cloudContas.length > 0) {
        const currentStored = getStoredExpenses();
        const existingMap = new Map<string, Expense>();
        const uuidToKey = new Map<string, string>();
        currentStored.forEach((e) => {
          if (e?.id) {
            existingMap.set(e.id, e);
            uuidToKey.set(toValidUUID(e.id), e.id);
          }
        });

        const docsMap = new Map<string, any>();
        getStoredDocumentosEntrada().forEach((doc) => {
          if (doc?.id) {
            docsMap.set(doc.id, doc);
            docsMap.set(toValidUUID(doc.id), doc);
          }
        });
        getStoredFiscalRecords().forEach((fr) => {
          if (fr?.id) {
            docsMap.set(fr.id, fr);
            docsMap.set(toValidUUID(fr.id), fr);
          }
        });

        cloudContas.forEach((d: any) => {
          const matchedKey = existingMap.has(d.id) ? d.id : uuidToKey.get(toValidUUID(d.id));
          const existing = matchedKey ? existingMap.get(matchedKey) : undefined;
          const docMatch = d.nota_fiscal_id
            ? (docsMap.get(d.nota_fiscal_id) || docsMap.get(toValidUUID(d.nota_fiscal_id)))
            : undefined;

          const resolvedSupplier =
            (existing?.supplier && existing.supplier !== 'Fornecedor' && existing.supplier !== 'Fornecedor N/I' ? existing.supplier : '') ||
            d.fornecedor ||
            d.credor ||
            docMatch?.fornecedor ||
            docMatch?.fornecedor_nome ||
            docMatch?.supplier ||
            'Fornecedor N/I';

          const docNum = docMatch?.numero || docMatch?.numero_documento || docMatch?.invoiceNumber || existing?.invoiceNumber;
          const parcLabel = d.numero_parcela || (existing as any)?.numero_parcela;
          const resolvedDesc =
            existing?.description ||
            d.descricao ||
            (docNum
              ? `Compra ${docNum}${parcLabel && parcLabel !== '01/01' ? ` (${parcLabel})` : ''} - ${resolvedSupplier}`
              : d.centro_custo || 'Despesa Lançada');

          const reconciled: Expense = {
            ...(existing || {}),
            id: existing?.id || d.id,
            title: d.centro_custo || existing?.description || resolvedDesc,
            description: resolvedDesc,
            amount: Number(d.valor_parcela ?? existing?.amount ?? 0),
            date: (existing as any)?.date || (existing as any)?.issueDate || d.data_despesa || d.data_emissao || d.data_lancamento || (d.created_at ? String(d.created_at).slice(0, 10) : undefined),
            dueDate: d.data_vencimento || existing?.dueDate || new Date().toISOString().split('T')[0],
            status: d.status_pago ? 'pago' : 'pendente',
            categoryId: existing?.categoryId || 'despesa_geral',
            categoryColor: existing?.categoryColor || '#2563eb',
            category: existing?.category || d.centro_custo || 'Geral',
            categoryName: existing?.categoryName || d.centro_custo || 'Geral',
            paymentMethod: (d.forma_pagamento || existing?.paymentMethod || 'boleto') as any,
            supplier: resolvedSupplier,
            invoiceNumber: docNum,
            createdAt: existing?.createdAt || d.created_at || new Date().toISOString()
          } as unknown as Expense;

          if (d.nota_fiscal_id) (reconciled as any).notaId = (existing as any)?.notaId || d.nota_fiscal_id;
          if (parcLabel) (reconciled as any).numero_parcela = parcLabel;

          existingMap.set(reconciled.id, reconciled);
        });

        const mergedList = Array.from(existingMap.values());
        const serMapped = JSON.stringify(mergedList);
        const serStored = JSON.stringify(currentStored);
        if (serMapped !== serStored) {
          setActiveExpenses(mergedList);
          saveStoredExpenses(mergedList);
          onExpensesChangeRef.current?.(mergedList);
        }
      }

      if (cloudFuels !== null && Array.isArray(cloudFuels)) {
        const serFuels = JSON.stringify(cloudFuels);
        const curFuels = JSON.stringify(getStoredFuelLogs());
        if (serFuels !== curFuels) {
          setActiveFuelLogs(cloudFuels);
          saveStoredFuelLogs(cloudFuels);
        }
        if (cloudFuels.length === 0 && activeCompanyId) {
          saveCloudFuelLogs([], activeCompanyId).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Dashboard real-time refresh exception:', err);
    } finally {
      if (showIndicator) {
        setTimeout(() => setIsSyncing(false), 350);
      }
    }
  }, [syncLocalFinancialSnapshots]);

  const debouncedRefresh = useCallback(() => {
    if (refreshDebounceTimerRef.current) clearTimeout(refreshDebounceTimerRef.current);
    refreshDebounceTimerRef.current = setTimeout(() => {
      refreshDashboardData(false);
    }, 450);
  }, [refreshDashboardData]);

  useEffect(() => {
    let isMounted = true;
    refreshDashboardData(false);

    let channel: any = null;
    if (isSupabaseConfigured) {
      const channelId = 'dashboard_realtime_stream';
      const fuelTable = getAbastecimentosTableName() || 'abastecimentos';
      const tablesToListen = [
        'contas_a_pagar',
        fuelTable,
        'abastecimentos',
        'documentos_entrada',
        'documentos_entrada_itens',
        'notas_fiscais',
        'notas_entradas',
        'entradas_mercadorias',
        'veiculos_maquinas',
        'gestao_frotas',
        'manutencoes',
        'site_settings'
      ];

      const existingChannels = supabase.getChannels?.() || [];
      for (const ch of existingChannels) {
        if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
          try { supabase.removeChannel(ch); } catch (_) {}
        }
      }

      try {
        channel = supabase.channel(channelId);
        tablesToListen.forEach((table) => {
          channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table },
            (payload: any) => {
              if (!isMounted) return;
              if (payload.eventType === 'DELETE') {
                const deletedId = payload.old?.id;
                const oldNotaId = payload.old?.nota_fiscal_id;
                if (deletedId || oldNotaId) {
                  setActiveExpenses((prev) => {
                    const filtered = prev.filter((e) => {
                      if (deletedId && (e.id === deletedId || (e as any).nota_fiscal_id === deletedId)) return false;
                      if (oldNotaId && (e.id === oldNotaId || (e as any).nota_fiscal_id === oldNotaId)) return false;
                      return true;
                    });
                    saveStoredExpenses(filtered);
                    onExpensesChangeRef.current?.(filtered);
                    return filtered;
                  });
                  setActiveFuelLogs((prev) => {
                    const filtered = prev.filter((f) => f.id !== deletedId);
                    saveStoredFuelLogs(filtered);
                    return filtered;
                  });
                }
              }
              debouncedRefresh();
            }
          );
        });
        channel.subscribe();
      } catch (err) {
        console.warn('Dashboard Realtime channel initialization notice:', err);
      }
    }

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('silagem_dashboard_sync_channel');
        bc.onmessage = () => {
          if (isMounted) debouncedRefresh();
        };
      } catch (_) {}
    }

    const handleStorage = () => {
      if (isMounted) {
        syncLocalFinancialSnapshots();
        debouncedRefresh();
      }
    };
    const handleFocus = () => {
      if (isMounted) {
        syncLocalFinancialSnapshots();
        debouncedRefresh();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        syncLocalFinancialSnapshots();
        debouncedRefresh();
      }
    };
    const handleCustomSync = () => {
      if (isMounted) {
        syncLocalFinancialSnapshots();
        debouncedRefresh();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('silagem_documentos_entrada_updated', handleCustomSync);
    window.addEventListener('agrocontrol_vendas_updated', handleCustomSync);
    window.addEventListener('agrocontrol_vendas_change', handleCustomSync);
    window.addEventListener('colaca_services_updated', handleCustomSync);
    window.addEventListener('silagem_notas_saida_updated', handleCustomSync);
    window.addEventListener('agrocontrol_bancos_updated', handleCustomSync);

    return () => {
      isMounted = false;
      if (refreshDebounceTimerRef.current) clearTimeout(refreshDebounceTimerRef.current);
      if (channel) {
        try { supabase.removeChannel(channel); } catch (_) {}
      }
      if (bc) {
        try { bc.close(); } catch (_) {}
      }
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('silagem_documentos_entrada_updated', handleCustomSync);
      window.removeEventListener('agrocontrol_vendas_updated', handleCustomSync);
      window.removeEventListener('agrocontrol_vendas_change', handleCustomSync);
      window.removeEventListener('colaca_services_updated', handleCustomSync);
      window.removeEventListener('silagem_notas_saida_updated', handleCustomSync);
      window.removeEventListener('agrocontrol_bancos_updated', handleCustomSync);
    };
  }, [refreshDashboardData, debouncedRefresh, syncLocalFinancialSnapshots]);

  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Unified real revenue entries (Orders + Services + Notas de Saída + PDV Sales, deduplicated)
  const unifiedRevenues = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      clientName: string;
      dateIso: string;
      dueDateIso: string;
      amount: number;
      isPaid: boolean;
      isReceivable: boolean;
      sortKey: number;
    }> = [];

    const existingIds = new Set<string>();

    orders.forEach((o) => {
      if (o.status === 'cancelado') return;
      const key = o.orderNumber || o.id;
      if (key) existingIds.add(String(key));
      if (o.id) existingIds.add(String(o.id));
      const dateIso = normalizeIsoDate(o.deliveryDate || o.date || o.createdAt);
      const dueDateIso = normalizeIsoDate(o.dueDate || o.deliveryDate || o.date || o.createdAt);
      const amount = Number(o.totalAmount) || 0;
      const isPaid = o.paymentStatus === 'pago';
      items.push({
        id: `ord-${o.id}`,
        title: o.orderNumber ? `Pedido ${o.orderNumber}` : 'Pedido de Venda',
        clientName: o.clientName || 'Cliente',
        dateIso,
        dueDateIso,
        amount,
        isPaid,
        isReceivable: true,
        sortKey: new Date(o.createdAt || dateIso || 0).getTime() || 0
      });
    });

    services.forEach((s) => {
      if (s.status === 'cancelado') return;
      const key = s.orderNumber || s.id;
      if (key) existingIds.add(String(key));
      if (s.id) existingIds.add(String(s.id));
      const dateIso = normalizeIsoDate(s.startDate || s.date || (s as any).createdAt);
      const dueDateIso = normalizeIsoDate(s.dueDate || s.date || s.startDate || (s as any).createdAt);
      const amount = Number(s.totalAmount) || 0;
      const isPaid = s.status === 'finalizado' || s.paymentStatus === 'pago';
      const isBilled =
        s.status === 'faturado' ||
        s.billingStatus === 'faturado' ||
        !!s.billedAt ||
        (s.status === 'finalizado' && !!s.billedAt);

      items.push({
        id: `srv-${s.id}`,
        title: s.serviceType || (s.orderNumber ? `OS ${s.orderNumber}` : 'Prestação de Serviço'),
        clientName: s.clientName || 'Cliente',
        dateIso,
        dueDateIso,
        amount,
        isPaid,
        isReceivable: isBilled,
        sortKey: new Date((s as any).createdAt || s.billedAt || dateIso || 0).getTime() || 0
      });
    });

    notasSaida.forEach((n) => {
      if (!n.lancarContasReceber || n.status === 'CANCELADA' || n.status === 'RASCUNHO') return;
      const dateIso = normalizeIsoDate(n.dataEmissao || n.createdAt);
      const dueDateIso = normalizeIsoDate(n.dataVencimento || n.dataEmissao || n.createdAt);
      const amount = Number(n.valorTotal) || 0;
      const isPaid = n.receberStatus === 'pago';
      items.push({
        id: `nf-${n.id}`,
        title: `${(n.tipoDocumento || 'NF').split(' ')[0]} Nº ${n.numero || ''}`.trim(),
        clientName: n.destinatarioNome || 'Destinatário',
        dateIso,
        dueDateIso,
        amount,
        isPaid,
        isReceivable: true,
        sortKey: new Date(n.createdAt || dateIso || 0).getTime() || 0
      });
    });

    pdvVendas.forEach((v: any, idx: number) => {
      const st = String(v.status || '').toLowerCase();
      if (st === 'cancelado' || st === 'cancelada') return;
      const refId = String(v.orderNumber || v.id || '');
      if (refId && existingIds.has(refId)) return;
      const dateIso = normalizeIsoDate(v.data || v.date || v.createdAt);
      const dueDateIso = normalizeIsoDate(v.dataVencimento || v.dueDate || v.data || v.date || v.createdAt);
      const amount = Number(v.valorLiquido ?? v.totalLiquido ?? v.totalAmount ?? v.valorTotal) || 0;
      const payStatus = String(v.paymentStatus || v.statusPagamento || v.status || '').toLowerCase();
      const isPaid =
        payStatus === 'pago' ||
        payStatus === 'recebido' ||
        payStatus === 'concluida' ||
        payStatus === 'concluido' ||
        payStatus === 'finalizada';

      items.push({
        id: `pdv-${v.id || idx}`,
        title: v.numero ? `Venda #${v.numero}` : 'Venda Comercial',
        clientName: v.clienteNome || v.clientName || 'Consumidor',
        dateIso,
        dueDateIso,
        amount,
        isPaid,
        isReceivable: true,
        sortKey: new Date(v.createdAt || dateIso || 0).getTime() || 0
      });
    });

    return items;
  }, [orders, services, notasSaida, pdvVendas]);

  // 1. KPI: Faturamento & Receitas (Competência Ativa)
  const monthRevenueStats = useMemo(() => {
    const filtered = unifiedRevenues.filter((r) => matchesCompetence(r.dateIso || r.dueDateIso, activeCompetence));
    const total = filtered.reduce((acc, r) => acc + r.amount, 0);
    const received = filtered.filter((r) => r.isPaid).reduce((acc, r) => acc + r.amount, 0);
    return { total, received, count: filtered.length };
  }, [unifiedRevenues, activeCompetence]);

  const expenseMatchesCompetence = useCallback((e: Expense, competence: string): boolean => {
    const expDate = (e as any).date || (e as any).issueDate || (e as any).expenseDate || (e as any).data_despesa || (e as any).data_emissao;
    const dueDate = e.dueDate || (e as any).data_vencimento;
    if (expDate && matchesCompetence(expDate, competence)) return true;
    if (dueDate && matchesCompetence(dueDate, competence)) return true;
    if (!expDate && !dueDate && e.createdAt && matchesCompetence(e.createdAt, competence)) return true;
    return false;
  }, []);

  // 2. KPI: Despesas & Custos (Competência Ativa - considera Data da Despesa e Data de Vencimento)
  const monthExpenseStats = useMemo(() => {
    const filtered = activeExpenses.filter((e) => expenseMatchesCompetence(e, activeCompetence));

    let total = 0;
    let paid = 0;
    let pending = 0;
    let overdue = 0;

    filtered.forEach((e) => {
      const val = Number(e.amount) || 0;
      total += val;
      const st = String(e.status || '').toLowerCase();
      if (st === 'pago' || st === 'concluido') {
        paid += val;
      } else {
        pending += val;
        const dueIso = normalizeIsoDate(e.dueDate);
        if (dueIso && dueIso < todayIso) {
          overdue += val;
        }
      }
    });

    return { items: filtered, total, paid, pending, overdue, count: filtered.length };
  }, [activeExpenses, activeCompetence, todayIso]);

  // 3. KPI: Resultado Líquido & Margem
  const netResult = monthRevenueStats.total - monthExpenseStats.total;
  const netMarginPct = monthRevenueStats.total > 0 ? (netResult / monthRevenueStats.total) * 100 : 0;

  // 4. KPI: Saldo em Caixa & A Receber
  const openReceivablesStats = useMemo(() => {
    const openItems = unifiedRevenues.filter((r) => r.isReceivable && !r.isPaid && r.amount > 0);
    const totalOpen = openItems.reduce((acc, r) => acc + r.amount, 0);
    return { totalOpen, count: openItems.length };
  }, [unifiedRevenues]);

  const totalCashBalance = useMemo(() => {
    return bankAccounts.reduce((acc, accItem) => {
      const bal = Number(accItem.balance ?? accItem.currentBalance ?? 0);
      return acc + (isNaN(bal) ? 0 : bal);
    }, 0);
  }, [bankAccounts]);

  // Centro Esquerda: Fluxo Financeiro (Receitas vs. Despesas — Últimos 6 Meses)
  const sixMonthFlow = useMemo(() => {
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const { year: baseYear, month: baseMonth } = parseCompetenceYearMonth(activeCompetence);
    const rows = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseYear, baseMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const compStr = `${String(m).padStart(2, '0')}/${y}`;
      const label = `${monthNames[d.getMonth()]}/${String(y).slice(-2)}`;

      const receitas = unifiedRevenues
        .filter((r) => matchesCompetence(r.dateIso || r.dueDateIso, compStr))
        .reduce((sum, r) => sum + r.amount, 0);

      const despesas = activeExpenses
        .filter((e) => expenseMatchesCompetence(e, compStr))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      rows.push({
        name: label,
        receitas: Number(receitas.toFixed(2)),
        despesas: Number(despesas.toFixed(2))
      });
    }

    const hasAnyValue = rows.some((r) => r.receitas > 0 || r.despesas > 0);
    return { rows, hasAnyValue };
  }, [activeCompetence, unifiedRevenues, activeExpenses, expenseMatchesCompetence]);

  // Centro Direita: Distribuição de Despesas por Categoria (Competência Ativa)
  const categoryDistribution = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; color: string }>();

    monthExpenseStats.items.forEach((e) => {
      const catName = String(e.categoryName || (e as any).category || 'Sem Categoria').trim() || 'Sem Categoria';
      const existing = map.get(catName);
      if (existing) {
        existing.total += Number(e.amount) || 0;
        existing.count += 1;
      } else {
        map.set(catName, {
          name: catName,
          total: Number(e.amount) || 0,
          count: 1,
          color: e.categoryColor || ''
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((item, idx) => ({
        ...item,
        color: item.color || CATEGORY_BAR_PALETTE[idx % CATEGORY_BAR_PALETTE.length],
        percentage: monthExpenseStats.total > 0 ? (item.total / monthExpenseStats.total) * 100 : 0
      }));
  }, [monthExpenseStats]);

  // Rodapé Col 1: Atenção Imediata (Alertas Reais e Clicáveis)
  const immediateAlerts = useMemo(() => {
    let overduePayablesCount = 0;
    let dueTodayPayablesCount = 0;
    let overduePayablesAmount = 0;

    activeExpenses.forEach((e) => {
      const st = String(e.status || '').toLowerCase();
      if (st === 'pago' || st === 'concluido') return;
      const dueIso = normalizeIsoDate(e.dueDate);
      if (!dueIso) return;
      if (dueIso < todayIso) {
        overduePayablesCount += 1;
        overduePayablesAmount += Number(e.amount) || 0;
      } else if (dueIso === todayIso) {
        dueTodayPayablesCount += 1;
        overduePayablesAmount += Number(e.amount) || 0;
      }
    });

    const cnhReport = checkCnhStatus(employees);

    const effectiveInventory = inventory && inventory.length > 0 ? inventory : readLocalProductsFallback();
    const lowStockCount = effectiveInventory.filter((item: any) => {
      const min = Number(item.minQuantity ?? item.QUANTIDADE_MINIMA ?? item.quantidade_minima ?? item.estoque_minimo ?? 0);
      if (min <= 0) return false;
      const current = Number(item.quantity ?? item.QUANTIDADE_ATUAL ?? item.quantidade_atual ?? item.quantidade ?? 0);
      return current <= min;
    }).length;

    const overdueMaintenanceCount = preventiveAlerts.filter((a) => a.isOverdue).length;

    return {
      overduePayablesCount,
      dueTodayPayablesCount,
      totalUrgentPayables: overduePayablesCount + dueTodayPayablesCount,
      overduePayablesAmount,
      cnhExpired: cnhReport.expiredCount,
      cnhExpiring: cnhReport.expiringIn60DaysCount,
      cnhTotalAlerts: cnhReport.expiredCount + cnhReport.expiringIn60DaysCount,
      preventiveTotal: preventiveAlerts.length,
      overdueMaintenanceCount,
      lowStockCount
    };
  }, [activeExpenses, todayIso, employees, inventory, preventiveAlerts]);

  // Rodapé Col 2: Frota & Equipamentos Ativos
  const fleetSummary = useMemo(() => {
    const operational: Machinery[] = [];
    const maintenance: Machinery[] = [];

    machineries.forEach((m) => {
      const st = String(m.status || 'operacional').toLowerCase();
      if (st === 'manutencao' || st === 'em_manutencao' || st === 'parado' || st === 'inativo') {
        maintenance.push(m);
      } else {
        operational.push(m);
      }
    });

    return {
      operationalCount: operational.length,
      maintenanceCount: maintenance.length,
      totalCount: machineries.length,
      orderedList: [...maintenance, ...operational]
    };
  }, [machineries]);

  // Rodapé Col 3: Últimos 5 Lançamentos Registrados
  const recentEntries = useMemo<RecentActivityItem[]>(() => {
    const expenseItems: RecentActivityItem[] = activeExpenses.map((e) => {
      const dateIso = normalizeIsoDate(e.dueDate || (e as any).expenseDate || e.createdAt);
      const st = String(e.status || '').toLowerCase();
      const isPaid = st === 'pago' || st === 'concluido';
      const isOverdue = !isPaid && dateIso !== '' && dateIso < todayIso;
      return {
        id: `exp-${e.id}`,
        kind: 'despesa',
        title: e.description || e.categoryName || 'Despesa',
        subtitle: `${e.supplier && e.supplier !== 'Fornecedor N/I' ? e.supplier : e.categoryName || 'Geral'} · ${formatDateBR(dateIso)}`,
        dateIso,
        sortKey: new Date(e.createdAt || dateIso || 0).getTime() || 0,
        amount: Number(e.amount) || 0,
        statusLabel: isPaid ? 'Pago' : isOverdue ? 'Vencido' : 'Pendente',
        targetTab: 'despesas'
      };
    });

    const revenueItems: RecentActivityItem[] = unifiedRevenues.map((r) => ({
      id: r.id,
      kind: 'receita',
      title: r.title,
      subtitle: `${r.clientName} · ${formatDateBR(r.dateIso || r.dueDateIso)}`,
      dateIso: r.dateIso || r.dueDateIso,
      sortKey: r.sortKey,
      amount: r.amount,
      statusLabel: r.isPaid ? 'Recebido' : 'A Receber',
      targetTab: 'receber'
    }));

    return [...expenseItems, ...revenueItems]
      .sort((a, b) => b.sortKey - a.sortKey)
      .slice(0, 5);
  }, [activeExpenses, unifiedRevenues, todayIso]);

  return (
    <div
      id="main-dashboard-view"
      className="w-full max-w-none flex-1 min-h-0 flex flex-col gap-2 lg:overflow-hidden text-black dark:text-white"
    >
      {/* Cabeçalho Compacto (#cad4e6 + border-black) */}
      <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-700 text-white border border-black flex items-center justify-center shrink-0 shadow-2xs">
            <BarChart3 className="w-4 h-4 stroke-[2.4]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black tracking-tight text-black dark:text-white leading-tight truncate uppercase">
              PAINEL EXECUTIVO &amp; INDICADORES EM TEMPO REAL
            </h2>
            <p className="text-[11px] font-semibold text-slate-800 dark:text-stone-400 leading-tight truncate">
              Resumo consolidado financeiro, frota, alertas e movimentações
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            id="dashboard-competence-selector"
            className="flex items-center gap-1 shrink-0"
            title="Competência exibida nos indicadores do Dashboard"
          >
            <button
              type="button"
              onClick={() => setActiveCompetence((prev) => getPrevCompetence(prev))}
              title="Mês Anterior"
              aria-label="Mês Anterior"
              className="p-1.5 rounded-md bg-emerald-700! hover:bg-emerald-800! text-white! border border-black! font-bold transition cursor-pointer select-none active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            </button>

            <div className="bg-emerald-700! text-white! border border-black! font-bold px-2.5 py-1 rounded-md text-xs flex items-center gap-1.5 shadow-2xs select-none whitespace-nowrap">
              <span className="text-white font-bold">Competência:</span>
              <span className="text-white font-black font-mono tabular-nums">{activeCompetence}</span>
            </div>

            <button
              type="button"
              onClick={() => setActiveCompetence((prev) => getNextCompetence(prev))}
              title="Próximo Mês"
              aria-label="Próximo Mês"
              className="p-1.5 rounded-md bg-emerald-700! hover:bg-emerald-800! text-white! border border-black! font-bold transition cursor-pointer select-none active:scale-95"
            >
              <ChevronRight className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => refreshDashboardData(true)}
            disabled={isSyncing}
            title="Atualizar indicadores em tempo real"
            className="inline-flex items-center justify-center p-1.5 rounded-md text-xs font-bold bg-[#e0e6f1] hover:bg-white dark:bg-stone-800 dark:hover:bg-stone-700 text-black dark:text-stone-100 border border-black dark:border-stone-600 transition cursor-pointer shrink-0"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Cards KPIs Únicos no Topo (Borda Preta + Borda Lateral Colorida 4px + Ícones Coloridos) */}
      <div
        id="executive-kpi-row"
        className="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full"
      >
        {/* KPI 1: FATURAMENTO & RECEITAS (MÊS) */}
        <button
          type="button"
          id="kpi-card-faturamento"
          onClick={() => onNavigate('receber')}
          className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800/90 border border-black dark:border-stone-700 border-l-4 border-l-emerald-600 rounded-lg p-3 text-left transition flex flex-col justify-between cursor-pointer group shadow-2xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-black tracking-wide text-emerald-900 dark:text-emerald-400 uppercase block leading-tight">
                FATURAMENTO &amp; RECEITAS (MÊS)
              </span>
              <div className="text-lg xl:text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums tracking-tight mt-0.5 truncate">
                {formatCurrencyBRL(monthRevenueStats.total)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white border border-black flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition">
              <ArrowUpRight className="w-4 h-4 stroke-[2.6]" />
            </div>
          </div>
          <div className="text-[11px] font-semibold text-slate-800 dark:text-stone-300 flex items-center justify-between gap-1 border-t border-black/15 dark:border-stone-700 pt-1.5 mt-1.5">
            <span className="truncate">{monthRevenueStats.count} operações</span>
            <span className="font-mono tabular-nums font-bold text-emerald-800 dark:text-emerald-400 shrink-0">
              Recebido: {formatCurrencyBRL(monthRevenueStats.received)}
            </span>
          </div>
        </button>

        {/* KPI 2: DESPESAS & CUSTOS (MÊS) */}
        <button
          type="button"
          id="kpi-card-despesas"
          onClick={() => onNavigate('despesas')}
          className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800/90 border border-black dark:border-stone-700 border-l-4 border-l-rose-600 rounded-lg p-3 text-left transition flex flex-col justify-between cursor-pointer group shadow-2xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-black tracking-wide text-rose-900 dark:text-rose-400 uppercase block leading-tight">
                DESPESAS &amp; CUSTOS (MÊS)
              </span>
              <div className="text-lg xl:text-xl font-black text-rose-700 dark:text-rose-400 font-mono tabular-nums tracking-tight mt-0.5 truncate">
                {formatCurrencyBRL(monthExpenseStats.total)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white border border-black flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition">
              <ArrowDownRight className="w-4 h-4 stroke-[2.6]" />
            </div>
          </div>
          <div className="text-[11px] font-semibold text-slate-800 dark:text-stone-300 flex items-center justify-between gap-1 border-t border-black/15 dark:border-stone-700 pt-1.5 mt-1.5">
            <span className="font-mono tabular-nums text-emerald-800 dark:text-emerald-400 font-bold truncate">
              Pago: {formatCurrencyBRL(monthExpenseStats.paid)}
            </span>
            <span
              className={`font-mono tabular-nums font-bold shrink-0 ${
                monthExpenseStats.overdue > 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {monthExpenseStats.overdue > 0
                ? `Venc.: ${formatCurrencyBRL(monthExpenseStats.overdue)}`
                : `Pend.: ${formatCurrencyBRL(monthExpenseStats.pending)}`}
            </span>
          </div>
        </button>

        {/* KPI 3: RESULTADO LÍQUIDO & MARGEM */}
        <button
          type="button"
          id="kpi-card-resultado"
          onClick={() => onNavigate('financeiro')}
          className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800/90 border border-black dark:border-stone-700 border-l-4 border-l-blue-600 rounded-lg p-3 text-left transition flex flex-col justify-between cursor-pointer group shadow-2xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-black tracking-wide text-blue-900 dark:text-blue-400 uppercase block leading-tight">
                RESULTADO LÍQUIDO &amp; MARGEM
              </span>
              <div
                className={`text-lg xl:text-xl font-black font-mono tabular-nums tracking-tight mt-0.5 truncate ${
                  netResult >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {formatCurrencyBRL(netResult)}
              </div>
            </div>
            <div
              className={`w-8 h-8 rounded-lg text-white border border-black flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition ${
                netResult >= 0 ? 'bg-blue-600' : 'bg-rose-600'
              }`}
            >
              <Scale className="w-4 h-4 stroke-[2.4]" />
            </div>
          </div>
          <div className="text-[11px] font-semibold text-slate-800 dark:text-stone-300 flex items-center justify-between gap-1 border-t border-black/15 dark:border-stone-700 pt-1.5 mt-1.5">
            <span className="truncate">
              Margem:{' '}
              <strong
                className={`font-mono tabular-nums ${
                  netResult >= 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {netMarginPct.toFixed(1).replace('.', ',')}%
              </strong>
            </span>
            <span className="shrink-0 font-mono tabular-nums font-bold text-blue-900 dark:text-blue-300">
              {activeCompetence}
            </span>
          </div>
        </button>

        {/* KPI 4: SALDO EM CAIXA & A RECEBER */}
        <button
          type="button"
          id="kpi-card-caixa-receber"
          onClick={() => onNavigate('bancos')}
          className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800/90 border border-black dark:border-stone-700 border-l-4 border-l-indigo-600 rounded-lg p-3 text-left transition flex flex-col justify-between cursor-pointer group shadow-2xs"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-black tracking-wide text-indigo-900 dark:text-indigo-400 uppercase block leading-tight">
                SALDO EM CAIXA &amp; A RECEBER
              </span>
              <div className="text-lg xl:text-xl font-black text-indigo-800 dark:text-indigo-300 font-mono tabular-nums tracking-tight mt-0.5 truncate">
                {formatCurrencyBRL(totalCashBalance)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white border border-black flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition">
              <Wallet className="w-4 h-4 stroke-[2.4]" />
            </div>
          </div>
          <div className="text-[11px] font-semibold text-slate-800 dark:text-stone-300 flex items-center justify-between gap-1 border-t border-black/15 dark:border-stone-700 pt-1.5 mt-1.5">
            <span className="truncate">A Receber ({openReceivablesStats.count}):</span>
            <span className="font-mono tabular-nums font-bold text-indigo-900 dark:text-indigo-300 shrink-0">
              {formatCurrencyBRL(openReceivablesStats.totalOpen)}
            </span>
          </div>
        </button>
      </div>

      {/* Centro em 2 Colunas Vivas (#e0e6f1 + cabeçalho #cad4e6 + border-black) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 min-h-[220px] lg:min-h-0">
        {/* Esquerda: Gráfico Fluxo Financeiro (Receitas vs. Despesas — Últimos 6 Meses) */}
        <div className="lg:col-span-7 bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg overflow-hidden flex flex-col min-h-[220px] lg:min-h-0 shadow-2xs">
          <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-emerald-600 text-white border border-black flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 stroke-[2.4]" />
              </div>
              <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-tight truncate">
                Fluxo Financeiro: Receitas vs. Despesas (Últimos 6 Meses)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-900 dark:text-stone-300 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 border border-black inline-block" />
                Receitas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-rose-500 border border-black inline-block" />
                Despesas
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[160px] w-full flex items-center justify-center bg-[#e0e6f1] dark:bg-stone-900 p-3">
            {sixMonthFlow.hasAnyValue ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sixMonthFlow.rows} margin={{ top: 8, right: 10, left: -4, bottom: 0 }} barGap={5}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" strokeOpacity={0.35} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#0f172a', fontWeight: 700 }}
                    axisLine={{ stroke: '#0f172a' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#0f172a', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatCompactAxisBRL}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value: number | string | undefined, name: string | undefined) => [
                      formatCurrencyBRL(Number(value) || 0),
                      name === 'receitas' ? 'Receitas' : 'Despesas'
                    ]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #000000',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      fontSize: '12px',
                      fontWeight: 700
                    }}
                  />
                  <Bar dataKey="receitas" name="receitas" fill="#10b981" stroke="#065f46" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="despesas" name="despesas" fill="#f43f5e" stroke="#9f1239" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-4">
                <TrendingUp className="w-7 h-7 text-blue-700 dark:text-blue-400 mb-1.5 opacity-80" />
                <p className="text-xs font-bold text-black dark:text-stone-200">
                  Sem movimentações financeiras nos últimos 6 meses
                </p>
                <p className="text-[11px] text-slate-800 dark:text-stone-400 mt-0.5 mb-2">
                  Registre receitas ou despesas para visualizar o comparativo mensal.
                </p>
                <button
                  type="button"
                  onClick={onNewExpense}
                  className="px-3 py-1 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white border border-black transition cursor-pointer"
                >
                  + Nova Despesa
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Direita: Distribuição de Despesas por Categoria */}
        <div className="lg:col-span-5 bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg overflow-hidden flex flex-col min-h-[220px] lg:min-h-0 shadow-2xs">
          <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700 px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-indigo-600 text-white border border-black flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 stroke-[2.3]" />
              </div>
              <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-tight truncate">
                Distribuição de Despesas por Categoria
              </h3>
            </div>
            <span className="text-xs font-black font-mono tabular-nums text-rose-700 dark:text-rose-400 shrink-0">
              {formatCurrencyBRL(monthExpenseStats.total)}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto bg-[#e0e6f1] dark:bg-stone-900 p-3 space-y-2.5">
            {categoryDistribution.length > 0 ? (
              categoryDistribution.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-xs border border-black shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-bold text-black dark:text-stone-100 truncate">
                        {cat.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700 dark:text-stone-400 shrink-0">
                        ({cat.count})
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0">
                      <span className="font-black text-black dark:text-white">
                        {formatCurrencyBRL(cat.total)}
                      </span>
                      <span className="text-[11px] font-bold text-blue-900 dark:text-blue-400 ml-1.5">
                        {cat.percentage.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-[#cad4e6] dark:bg-stone-800 border border-black dark:border-stone-600 rounded-sm overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.max(cat.percentage, 3)}%`,
                        backgroundColor: cat.color
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-6">
                <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-1.5 opacity-70" />
                <p className="text-xs font-bold text-black dark:text-stone-200">
                  Nenhuma despesa na competência {activeCompetence}
                </p>
                <p className="text-[11px] text-slate-800 dark:text-stone-400 mt-0.5">
                  O ranking por categoria será exibido automaticamente ao lançar despesas.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé Executivo em 3 Colunas (#e0e6f1 + border-black) */}
      <div className="shrink-0 grid grid-cols-1 lg:grid-cols-3 gap-2 lg:h-[214px] xl:h-[228px]">
        {/* Coluna 1: 🚨 Atenção Imediata */}
        <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg p-3 flex flex-col min-h-0 overflow-hidden shadow-2xs">
          <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-black/25 dark:border-stone-700">
            <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-tight flex items-center gap-1.5">
              <span>🚨</span>
              <span>Atenção Imediata</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-700 dark:text-stone-400">
              Alertas em tempo real
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
            {/* Contas Vencidas */}
            <button
              type="button"
              onClick={() => onNavigate('pagar')}
              className="w-full px-2 py-1.5 rounded-md bg-white/75 hover:bg-white dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-black/30 dark:border-stone-700 transition flex items-center justify-between gap-2 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CalendarClock className={`w-4 h-4 shrink-0 ${immediateAlerts.totalUrgentPayables > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-black dark:text-white truncate">Contas Vencidas / Hoje</div>
                  <div className="text-[10px] font-semibold text-slate-700 dark:text-stone-400 truncate">
                    {immediateAlerts.totalUrgentPayables > 0
                      ? `${immediateAlerts.overduePayablesCount} venc. · ${formatCurrencyBRL(immediateAlerts.overduePayablesAmount)}`
                      : 'Tudo em dia'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums border border-black ${
                    immediateAlerts.totalUrgentPayables > 0
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {immediateAlerts.totalUrgentPayables}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 dark:text-stone-400 group-hover:translate-x-0.5 transition" />
              </div>
            </button>

            {/* CNHs Vencidas / A Vencer */}
            <button
              type="button"
              onClick={() => onNavigate('funcionarios')}
              className="w-full px-2 py-1.5 rounded-md bg-white/75 hover:bg-white dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-black/30 dark:border-stone-700 transition flex items-center justify-between gap-2 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <IdCard className={`w-4 h-4 shrink-0 ${immediateAlerts.cnhExpired > 0 ? 'text-rose-600' : immediateAlerts.cnhExpiring > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-black dark:text-white truncate">CNHs Vencidas / A Vencer</div>
                  <div className="text-[10px] font-semibold text-slate-700 dark:text-stone-400 truncate">
                    {immediateAlerts.cnhTotalAlerts > 0
                      ? `${immediateAlerts.cnhExpired} vencida(s) · ${immediateAlerts.cnhExpiring} em 60d`
                      : 'Documentação regular'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums border border-black ${
                    immediateAlerts.cnhExpired > 0
                      ? 'bg-rose-600 text-white'
                      : immediateAlerts.cnhExpiring > 0
                        ? 'bg-amber-500 text-black'
                        : 'bg-emerald-600 text-white'
                  }`}
                >
                  {immediateAlerts.cnhTotalAlerts}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 dark:text-stone-400 group-hover:translate-x-0.5 transition" />
              </div>
            </button>

            {/* Fluidos & Peças / Manutenções Preventivas */}
            <button
              type="button"
              onClick={() => onNavigate('manutencoes')}
              className="w-full py-1.5 px-2 rounded-md bg-white/75 hover:bg-white dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-black/30 dark:border-stone-700 transition flex items-center justify-between gap-2 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Wrench className={`w-4 h-4 shrink-0 ${immediateAlerts.overdueMaintenanceCount > 0 ? 'text-rose-600' : immediateAlerts.preventiveTotal > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-black dark:text-white truncate">Fluidos &amp; Peças (Preventivas)</div>
                  <div className="text-[10px] font-semibold text-slate-700 dark:text-stone-400 truncate">
                    {immediateAlerts.preventiveTotal > 0
                      ? `${immediateAlerts.overdueMaintenanceCount} vencida(s) · ${immediateAlerts.preventiveTotal - immediateAlerts.overdueMaintenanceCount} próx.`
                      : 'Preventivas em dia'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums border border-black ${
                    immediateAlerts.overdueMaintenanceCount > 0
                      ? 'bg-rose-600 text-white'
                      : immediateAlerts.preventiveTotal > 0
                        ? 'bg-amber-500 text-black'
                        : 'bg-emerald-600 text-white'
                  }`}
                >
                  {immediateAlerts.preventiveTotal}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 dark:text-stone-400 group-hover:translate-x-0.5 transition" />
              </div>
            </button>

            {/* Estoque Mínimo */}
            <button
              type="button"
              onClick={() => onNavigate('estoque')}
              className="w-full px-2 py-1.5 rounded-md bg-white/75 hover:bg-white dark:bg-stone-800/80 dark:hover:bg-stone-800 border border-black/30 dark:border-stone-700 transition flex items-center justify-between gap-2 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Package className={`w-4 h-4 shrink-0 ${immediateAlerts.lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-black dark:text-white truncate">Estoque Mínimo</div>
                  <div className="text-[10px] font-semibold text-slate-700 dark:text-stone-400 truncate">
                    {immediateAlerts.lowStockCount > 0
                      ? `${immediateAlerts.lowStockCount} item(ns) abaixo do mínimo`
                      : 'Níveis de estoque normais'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black font-mono tabular-nums border border-black ${
                    immediateAlerts.lowStockCount > 0
                      ? 'bg-amber-500 text-black'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {immediateAlerts.lowStockCount}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-700 dark:text-stone-400 group-hover:translate-x-0.5 transition" />
              </div>
            </button>
          </div>
        </div>

        {/* Coluna 2: 🚜 Frota & Equipamentos Ativos */}
        <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg p-3 flex flex-col min-h-0 shadow-2xs">
          <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-black/25 dark:border-stone-700">
            <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-tight flex items-center gap-1.5">
              <span>🚜</span>
              <span>Frota &amp; Equipamentos Ativos</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('frotas')}
              className="text-[11px] font-bold text-blue-800 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              Ver frota →
            </button>
          </div>

          {/* Contadores Coloridos (Operacionais em Verde vs. Manutenção em Âmbar) */}
          <div className="shrink-0 grid grid-cols-2 gap-1.5 mb-1.5">
            <button
              type="button"
              onClick={() => onNavigate('frotas')}
              className="px-2 py-1 rounded-md bg-emerald-600 text-white border border-black flex items-center justify-between text-xs font-bold cursor-pointer hover:bg-emerald-700 transition"
            >
              <span>Operacionais</span>
              <span className="font-mono tabular-nums font-black">{fleetSummary.operationalCount}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('manutencoes')}
              className="px-2 py-1 rounded-md bg-amber-500 text-black border border-black flex items-center justify-between text-xs font-bold cursor-pointer hover:bg-amber-400 transition"
            >
              <span>Manutenção</span>
              <span className="font-mono tabular-nums font-black">{fleetSummary.maintenanceCount}</span>
            </button>
          </div>

          {/* Lista Limpa dos Equipamentos */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 divide-y divide-black/15 dark:divide-stone-800">
            {fleetSummary.orderedList.length > 0 ? (
              fleetSummary.orderedList.slice(0, 6).map((m) => {
                const st = String(m.status || 'operacional').toLowerCase();
                const isMaintenance = st === 'manutencao' || st === 'em_manutencao' || st === 'parado' || st === 'inativo';
                const meterText =
                  m.currentKm && m.currentKm > 0
                    ? `${Number(m.currentKm).toLocaleString('pt-BR')} km`
                    : `${Number(m.currentHourMeter ?? m.hourMeter ?? 0).toLocaleString('pt-BR')} h`;
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => onNavigate('frotas')}
                    className="w-full py-1.5 px-1.5 rounded-sm hover:bg-[#cad4e6] dark:hover:bg-stone-800 transition flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Truck className={`w-3.5 h-3.5 shrink-0 ${isMaintenance ? 'text-amber-700' : 'text-emerald-700'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-black dark:text-white truncate">{m.name}</div>
                        <div className="text-[10px] font-semibold text-slate-700 dark:text-stone-400 truncate">
                          {[m.plate || m.model || m.type, meterText].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded-sm text-[10px] font-black uppercase border border-black/40 shrink-0 ${
                        isMaintenance
                          ? 'bg-amber-200 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200'
                          : 'bg-emerald-200 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-200'
                      }`}
                    >
                      {isMaintenance ? 'Manutenção' : 'Operacional'}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 mb-1 opacity-70" />
                <p className="text-xs font-bold text-black dark:text-stone-300">
                  Nenhum equipamento cadastrado
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Coluna 3: 🕒 Últimos Lançamentos Registrados */}
        <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg p-3 flex flex-col min-h-0 shadow-2xs">
          <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 mb-1 border-b border-black/25 dark:border-stone-700">
            <h3 className="text-xs font-black text-black dark:text-white uppercase tracking-tight flex items-center gap-1.5">
              <span>🕒</span>
              <span>Últimos Lançamentos Registrados</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('despesas')}
              className="text-[11px] font-bold text-blue-800 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              Ver tudo →
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 divide-y divide-black/15 dark:divide-stone-800">
            {recentEntries.length > 0 ? (
              recentEntries.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onNavigate(item.targetTab)}
                  className="w-full py-1.5 px-1.5 rounded-sm hover:bg-[#cad4e6] dark:hover:bg-stone-800 transition flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Receipt className={`w-3.5 h-3.5 shrink-0 ${item.kind === 'receita' ? 'text-emerald-700' : 'text-rose-600'}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-black dark:text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-700 dark:text-stone-400 truncate">
                        {item.subtitle} · {item.statusLabel}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-xs font-black font-mono tabular-nums shrink-0 ${
                      item.kind === 'receita'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {item.kind === 'receita' ? '+' : '-'}{formatCurrencyBRL(item.amount)}
                  </div>
                </button>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-4">
                <Receipt className="w-5 h-5 text-blue-700 mb-1 opacity-70" />
                <p className="text-xs font-bold text-black dark:text-stone-300">
                  Nenhum lançamento registrado
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
