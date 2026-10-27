import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ShoppingCart,
  Search,
  Plus,
  ChevronDown,
  X,
  Trash2,
  Pencil,
  TrendingUp,
  Scale,
  DollarSign,
  FileCheck2,
  Calendar
} from 'lucide-react';
import { ServiceOrder, Machinery, Employee, Client, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR, getActiveCompanyId } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { SaleDetailsEditModal } from './SaleDetailsEditModal';
import { PdvView } from './PdvView';
import { supabase } from '../../lib/supabaseClient';
import { fetchAllClientModulesFromSupabase, isSupabaseConfigured } from '../../lib/supabaseService';

interface VendaModuleProps {
  services?: ServiceOrder[];
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onSaveServices?: (services: ServiceOrder[]) => void;
  onSaveClients?: (clients: Client[]) => void;
}

export const VendaModule: React.FC<VendaModuleProps> = ({
  services = [],
  machineries = [],
  employees = [],
  clients = [],
  companyProfile,
  onSaveServices,
  onSaveClients,
}) => {
  const { confirm } = useConfirm();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [isPdvFullscreen, setIsPdvFullscreen] = useState(false);

  useEffect(() => {
    const handlePdvFullscreen = (e: any) => {
      setIsPdvFullscreen(!!e?.detail?.fullscreen);
    };
    window.addEventListener('agrocontrol_pdv_fullscreen', handlePdvFullscreen);
    return () => window.removeEventListener('agrocontrol_pdv_fullscreen', handlePdvFullscreen);
  }, []);

  // Filtro por Período e Atalhos Rápidos (Gabarito Mestre de Relatórios)
  const [quickPeriod, setQuickPeriod] = useState<'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses'>('mes_atual');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const [startDate, setStartDate] = useState(() => `${currentYear}-${pad(currentMonth + 1)}-01`);
  const [endDate, setEndDate] = useState(() => {
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    return `${currentYear}-${pad(currentMonth + 1)}-${pad(lastDay)}`;
  });

  const handleQuickPeriodChange = (p: 'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses') => {
    setQuickPeriod(p);
    const today = new Date();
    let startD = new Date();

    if (p === 'mes_atual') {
      startD = new Date(today.getFullYear(), today.getMonth(), 1);
      const endD = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(`${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-01`);
      setEndDate(`${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`);
      return;
    } else if (p === '1_mes') {
      startD.setMonth(today.getMonth() - 1);
    } else if (p === '3_meses') {
      startD.setMonth(today.getMonth() - 3);
    } else if (p === '6_meses') {
      startD.setMonth(today.getMonth() - 6);
    } else if (p === '12_meses') {
      startD.setMonth(today.getMonth() - 12);
    }

    setStartDate(`${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`);
    setEndDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
  };

  // Modal Exclusivo de Detalhes e Edição da Venda (Desvinculação de Serviços)
  const [isSaleEditModalOpen, setIsSaleEditModalOpen] = useState(false);
  const [selectedSaleForEdit, setSelectedSaleForEdit] = useState<ServiceOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ServiceOrder | null>(null);

  // Tab State: Dashboard ou PDV
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pdv'>('dashboard');

  const [localServices, setLocalServices] = useState<ServiceOrder[]>(services);

  useEffect(() => {
    if (services) {
      setLocalServices(services);
    }
  }, [services]);

  const onSaveServicesRef = useRef(onSaveServices);
  useEffect(() => {
    onSaveServicesRef.current = onSaveServices;
  }, [onSaveServices]);

  const vendaDebounceTimerRef = useRef<any>(null);

  // Sincronização em tempo real multi-dispositivos (Supabase Realtime) escutando 'site_settings'
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;
    const companyId = companyProfile?.id || getActiveCompanyId();
    const channelId = `venda_module_rt_${companyId || 'default'}`;

    const existingChannels = supabase.getChannels?.() || [];
    for (const ch of existingChannels) {
      if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
        try { supabase.removeChannel(ch); } catch (_) {}
      }
    }

    const debouncedFetchSales = () => {
      if (vendaDebounceTimerRef.current) clearTimeout(vendaDebounceTimerRef.current);
      vendaDebounceTimerRef.current = setTimeout(async () => {
        try {
          const fresh = await fetchAllClientModulesFromSupabase(companyId);
          if (isMounted && fresh && Array.isArray(fresh.services)) {
            setLocalServices(fresh.services);
            onSaveServicesRef.current?.(fresh.services);
          }
        } catch (_) {}
      }, 400);
    };

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        () => {
          debouncedFetchSales();
        }
      )
      .subscribe();

    const handleFocus = () => {
      debouncedFetchSales();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      if (vendaDebounceTimerRef.current) {
        clearTimeout(vendaDebounceTimerRef.current);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [companyProfile?.id]);

  const [salesUpdateTick, setSalesUpdateTick] = useState(0);
  useEffect(() => {
    const handleSalesUpdate = () => setSalesUpdateTick(t => t + 1);
    window.addEventListener('agrocontrol_vendas_updated', handleSalesUpdate);
    window.addEventListener('agrocontrol_vendas_change', handleSalesUpdate);
    window.addEventListener('vendas_updated', handleSalesUpdate);
    return () => {
      window.removeEventListener('agrocontrol_vendas_updated', handleSalesUpdate);
      window.removeEventListener('agrocontrol_vendas_change', handleSalesUpdate);
      window.removeEventListener('vendas_updated', handleSalesUpdate);
    };
  }, []);

  // Filtragem exclusiva de Vendas (serviceTab === 'venda' ou serviceType com 'venda')
  const salesRecords = useMemo(() => {
    const list = localServices.filter((srv) => {
      const typeStr = (srv.serviceType || '').toLowerCase();
      const tabStr = (srv.serviceTab || '').toLowerCase();
      return typeStr.includes('venda') || tabStr === 'venda';
    });

    try {
      const raw = localStorage.getItem('agrocontrol_vendas') || localStorage.getItem('agrocontrol_pdv_vendas');
      if (raw) {
        const pdvList = JSON.parse(raw);
        if (Array.isArray(pdvList)) {
          pdvList.forEach((v: any) => {
            const vId = v.orderNumber || v.numeroPedido || v.id;
            if (!list.some(s => (s.orderNumber || s.id) === vId)) {
              let dIso = v.date || '';
              if (!dIso && v.data && v.data.includes('/')) {
                const parts = v.data.split('/');
                if (parts.length === 3) dIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
              if (!dIso && v.criadoEm) dIso = v.criadoEm.split('T')[0];
              if (!dIso) dIso = new Date().toISOString().split('T')[0];

              list.unshift({
                id: String(v.id || Date.now()),
                orderNumber: v.numeroPedido || v.orderNumber || `PDV-${v.id}`,
                clientName: v.cliente || v.clientName || 'Consumidor Final',
                farmName: v.fazenda || v.farmName || '',
                serviceTab: 'venda',
                serviceType: 'Venda Balcão PDV',
                date: dIso,
                startDate: dIso,
                totalAmount: Number(v.valorLiquido ?? v.totalLiquido ?? v.totalAmount ?? 0),
                status: v.status === 'pendente' ? 'em_andamento' : 'concluido',
                ratePerUnit: Number(v.valorLiquido ?? v.totalLiquido ?? v.totalAmount ?? 0),
              } as ServiceOrder);
            }
          });
        }
      }
    } catch {}

    return list;
  }, [localServices, salesUpdateTick]);

  // Vendas filtradas pelo período selecionado
  const periodSales = useMemo(() => {
    return salesRecords.filter((srv) => {
      let srvDate = srv.startDate || srv.date || ((srv as any).createdAt ? (srv as any).createdAt.split('T')[0] : '');
      if (srvDate && srvDate.includes('/')) {
        const parts = srvDate.split('/');
        if (parts.length === 3) srvDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      if (!srvDate) return true;
      if (startDate && srvDate < startDate) return false;
      if (endDate && srvDate > endDate) return false;
      return true;
    });
  }, [salesRecords, startDate, endDate]);

  // Vendas filtradas por busca e status
  const filteredSales = useMemo(() => {
    return periodSales.filter((srv) => {
      // Filtro de status
      if (statusFilter !== 'todos' && srv.status !== statusFilter) {
        return false;
      }

      // Filtro por busca
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesClient = (srv.clientName || '').toLowerCase().includes(query);
        const matchesFarm = (srv.farmName || '').toLowerCase().includes(query);
        const matchesNumber = (srv.orderNumber || srv.id || '').toLowerCase().includes(query);
        if (!matchesClient && !matchesFarm && !matchesNumber) return false;
      }

      return true;
    });
  }, [periodSales, statusFilter, searchTerm]);

  // Indicadores (KPIs) com base no período selecionado
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalTons = 0;
    let completedCount = 0;

    periodSales.forEach((s) => {
      totalRevenue += s.totalAmount || 0;
      if (s.tonsEstimated) {
        totalTons += s.tonsEstimated;
      } else if (s.areaQuantity && s.areaUnit === 'hectares') {
        totalTons += s.areaQuantity;
      }
      if (s.status === 'concluido') {
        completedCount += 1;
      }
    });

    const averageTicket = periodSales.length > 0 ? totalRevenue / periodSales.length : 0;

    return {
      totalRevenue,
      totalTons,
      totalCount: periodSales.length,
      completedCount,
      averageTicket,
    };
  }, [periodSales]);

  // Abrir PDV para Nova Venda
  const handleOpenNew = () => {
    setActiveTab('pdv');
  };

  // Abrir Modal Exclusivo para Editar Venda (Desvinculação de Serviços)
  const handleOpenEdit = (record: ServiceOrder) => {
    setSelectedSaleForEdit(record);
    setIsSaleEditModalOpen(true);
  };

  // Salvar Venda (Fallback)
  const handleSaveService = (savedService: ServiceOrder) => {
    if (!onSaveServices) return;

    // Garantir que a ordem fique gravada como Venda
    const recordToSave: ServiceOrder = {
      ...savedService,
      serviceTab: 'venda',
      serviceType: savedService.serviceType || 'Venda de Silagem',
    };

    const exists = services.some((s) => s.id === recordToSave.id);
    if (exists) {
      onSaveServices(services.map((s) => (s.id === recordToSave.id ? recordToSave : s)));
    } else {
      onSaveServices([recordToSave, ...services]);
    }

    setEditRecord(recordToSave);
  };

  // Excluir Venda com Estorno Reativo de Estoque
  const handleDeleteService = async (id: string, clientName: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Venda',
      message: `Deseja realmente remover o registro de venda para "${clientName}"?`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      if (onSaveServices) {
        onSaveServices(services.filter((s) => s.id !== id));
      }
      try {
        const rawV = localStorage.getItem('agrocontrol_vendas') || localStorage.getItem('agrocontrol_pdv_vendas') || '[]';
        const list = JSON.parse(rawV);
        if (Array.isArray(list)) {
          const removed = list.find((v: any) => String(v.id) === String(id) || v.orderNumber === id || v.numeroPedido === id);
          if (removed && removed.itens && Array.isArray(removed.itens)) {
            try {
              const rawP = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos') || '[]';
              const prods = JSON.parse(rawP);
              if (Array.isArray(prods)) {
                removed.itens.forEach((it: any) => {
                  const p = prods.find((prod: any) => String(prod.id) === String(it.id) || (it.codigo && prod.codigo === it.codigo));
                  if (p && p.categoria !== 'SERVIÇOS' && p.category !== 'SERVIÇOS') {
                    p.quantity = Number(p.quantity || 0) + Number(it.qtd || 1);
                    p.quantidade_atual = p.quantity;
                  }
                });
                localStorage.setItem('agrocontrol_produtos', JSON.stringify(prods));
                localStorage.setItem('colaca_silagem_estoque_produtos', JSON.stringify(prods));
                window.dispatchEvent(new CustomEvent('agrocontrol_produtos_updated', { detail: prods }));
                window.dispatchEvent(new CustomEvent('inventory_updated', { detail: prods }));
              }
            } catch {}
          }
          const updatedVendas = list.filter((v: any) => String(v.id) !== String(id) && v.orderNumber !== id && v.numeroPedido !== id);
          localStorage.setItem('agrocontrol_vendas', JSON.stringify(updatedVendas));
          localStorage.setItem('agrocontrol_pdv_vendas', JSON.stringify(updatedVendas));
          localStorage.setItem('colaca_silagem_vendas_pdv', JSON.stringify(updatedVendas));
          window.dispatchEvent(new CustomEvent('agrocontrol_vendas_updated', { detail: updatedVendas }));
          window.dispatchEvent(new CustomEvent('agrocontrol_vendas_change', { detail: updatedVendas }));
          window.dispatchEvent(new CustomEvent('vendas_updated', { detail: updatedVendas }));
        }
      } catch {}
      setSalesUpdateTick(t => t + 1);
    }
  };

  return (
    <div 
      id="venda-module-root"
      className={`w-full max-w-none antialiased ${isPdvFullscreen && activeTab === 'pdv' ? 'h-full overflow-hidden' : activeTab === 'pdv' ? 'space-y-1 overflow-hidden global' : 'space-y-2.5'}`}
    >
      {/* 1. CABEÇALHO PADRONIZADO SLIM COM TÍTULO */}
      {(!isPdvFullscreen || activeTab !== 'pdv') && (
        <header className="no-print flex items-center justify-between gap-2 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] pb-1.5 shrink-0">
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
              Venda
            </h1>
          </div>
        </header>
      )}

      {/* 2. ESTRUTURA INTEGRADA DE ABAS SUPERIORES E MOLDURA GERAL (PADRÃO OURO) */}
      <div className={`w-full flex flex-col ${isPdvFullscreen && activeTab === 'pdv' ? 'h-full' : ''}`}>
        {/* BASE DE FUNDO DAS ABAS: MOLDURA MDI TRIDIMENSIONAL ACETINADA */}
        {(!isPdvFullscreen || activeTab !== 'pdv') && (
          <div className="w-full bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] rounded-t-lg border border-b-0 border-slate-300 dark:border-stone-700 overflow-x-auto scrollbar-none">
            <nav 
              aria-label="Abas de Venda e PDV"
              className="w-full flex items-center overflow-x-auto whitespace-nowrap scrollbar-none"
            >
              <button
                type="button"
                id="tab-dashboard-vendas"
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>DASHBOARD VENDAS</span>
              </button>

              <button
                type="button"
                id="tab-pdv-frente-caixa"
                onClick={() => setActiveTab('pdv')}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap ${
                  activeTab === 'pdv'
                    ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>PDV</span>
              </button>
            </nav>
          </div>
        )}

        {/* MOLDURA GERAL INTEGRADA (ALINHAMENTO SETA VERDE) */}
        <div className={`w-full ${isPdvFullscreen && activeTab === 'pdv' ? 'h-full border-0 rounded-none p-0 bg-[#edf4ff] dark:bg-stone-900' : 'border border-slate-300 dark:border-stone-700 rounded-b-lg bg-[#edf4ff] dark:bg-stone-900 shadow-sm overflow-hidden global ' + (activeTab === 'pdv' ? 'p-1.5' : 'p-3 space-y-3')}`}>
          {activeTab === 'pdv' ? (
            <PdvView
              clients={clients}
              companyProfile={companyProfile}
              onSaveService={handleSaveService}
              salesCount={salesRecords.length}
            />
          ) : (
            <>
              {/* BLOCO DE FILTROS SUPERIOR (FILTRAR POR PERÍODO...) */}
              <div className="border border-slate-300/80 dark:border-stone-700/80 rounded bg-slate-100/60 dark:bg-stone-800/60 p-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-stone-300 uppercase">
                {/* Esquerda: Rótulo + Seleção por Data De / Até */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 text-slate-700 dark:text-stone-300">
                    <Calendar className="w-3.5 h-3.5 text-slate-600 dark:text-stone-400" />
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                      FILTRAR POR PERÍODO:
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setQuickPeriod('' as any);
                      }}
                      className="px-2.5 py-0.5 text-xs font-semibold rounded border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-stone-400 font-bold lowercase">até</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setQuickPeriod('' as any);
                      }}
                      className="px-2.5 py-0.5 text-xs font-semibold rounded border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Direita: Sequência Contínua de Botões de Atalhos Rápidos */}
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'mes_atual', label: 'Mês atual' },
                    { id: '1_mes', label: '1 mês' },
                    { id: '3_meses', label: '3 meses' },
                    { id: '6_meses', label: '6 meses' },
                    { id: '12_meses', label: '12 meses' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleQuickPeriodChange(item.id as any)}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer select-none ${
                        quickPeriod === item.id
                          ? 'bg-slate-700 text-white dark:bg-stone-200 dark:text-stone-900 shadow-xs'
                          : 'bg-white dark:bg-stone-800 text-slate-700 dark:text-stone-300 hover:bg-slate-100 border border-slate-300 dark:border-stone-700 shadow-2xs'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>


              {/* GRADE DE 4 CARDS DE INDICADORES (TOTAL FATURADO, VOLUME TOTAL, CONTRATOS, TICKET MÉDIO) */}
              <section aria-label="Indicadores de Vendas" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="border border-slate-300/80 dark:border-stone-700/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase tracking-wider">Total Faturado</span>
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {formatCurrencyBRL(metrics.totalRevenue)}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-stone-400 font-medium block uppercase">Vendas no período</span>
                </div>

                <div className="border border-slate-300/80 dark:border-stone-700/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase tracking-wider">Volume Total</span>
                    <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {metrics.totalTons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span className="text-xs font-bold text-slate-600 dark:text-stone-400 uppercase">Ton</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-stone-400 font-medium block uppercase">Silagem comercializada</span>
                </div>

                <div className="border border-slate-300/80 dark:border-stone-700/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase tracking-wider">Contratos / Pedidos</span>
                    <FileCheck2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {metrics.totalCount} <span className="text-xs font-semibold text-slate-500 dark:text-stone-400">({metrics.completedCount} concl.)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-stone-400 font-medium block uppercase">Volume de operações</span>
                </div>

                <div className="border border-slate-300/80 dark:border-stone-700/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase tracking-wider">Ticket Médio</span>
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {formatCurrencyBRL(metrics.averageTicket)}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-stone-400 font-medium block uppercase">Média por venda</span>
                </div>
              </section>

              {/* CONTAINER DA TABELA HISTÓRICA */}
              <div className="border border-slate-300/80 dark:border-stone-700/80 rounded bg-white dark:bg-stone-900 overflow-hidden">
                {/* BARRA DE FILTROS (SEARCH & DROPDOWN) */}
                <div className="p-2 sm:p-2.5 border-b border-slate-200 dark:border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50/50 dark:bg-stone-850/50">
                  {/* Campo de Busca */}
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar cliente, fazenda ou nº da venda..."
                      className="w-full pl-8 pr-7 py-1 text-xs bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded text-slate-900 dark:text-white font-semibold placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown de Status */}
                  <div className="relative sm:w-44">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full appearance-none pl-2.5 pr-7 py-1 text-xs bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded font-bold text-slate-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs cursor-pointer"
                    >
                      <option value="todos">Todos os Status</option>
                      <option value="agendado">Agendado</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* TABELA DE VENDAS */}
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-stone-700 bg-slate-100/80 dark:bg-stone-800">
                        <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider w-16 whitespace-nowrap">
                          Nº
                        </th>
                        <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap">
                          CLIENTE
                        </th>
                        <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap">
                          DATA DA VENDA
                        </th>
                        <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-center whitespace-nowrap">
                          TONELADAS / QTD
                        </th>
                        <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-center whitespace-nowrap">
                          STATUS
                        </th>
                        <th scope="col" className="px-3 py-1.5 text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-right whitespace-nowrap">
                          TOTAL
                        </th>
                        <th scope="col" className="px-2.5 py-1.5 text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider text-right w-20 whitespace-nowrap">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-stone-800 bg-white dark:bg-stone-900">
                      {filteredSales.length === 0 ? (
                        <tr className="bg-white dark:bg-stone-900">
                          <td colSpan={7} className="py-4 text-center text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase">
                            NENHUM REGISTRO ENCONTRADO
                          </td>
                        </tr>
                      ) : (
                        filteredSales.map((sale, index) => {
                          const itemNumber = (index + 1).toString().padStart(3, '0');
                          const statusColors: Record<string, string> = {
                            agendado: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-stone-800 dark:text-amber-400 dark:border-stone-700 font-bold',
                            em_andamento: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-stone-800 dark:text-blue-400 dark:border-stone-700 font-bold',
                            concluido: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-stone-800 dark:text-emerald-400 dark:border-stone-700 font-bold',
                            cancelado: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-stone-800 dark:text-rose-400 dark:border-stone-700 font-bold',
                          };

                          const statusLabels: Record<string, string> = {
                            agendado: 'AGENDADO',
                            em_andamento: 'EM ANDAMENTO',
                            concluido: 'CONCLUÍDO',
                            cancelado: 'CANCELADO',
                          };

                          const currentStatus = sale.status || 'agendado';

                          // Quantidade de Toneladas
                          let quantityDisplay = '--';
                          if (sale.tonsEstimated) {
                            quantityDisplay = `${sale.tonsEstimated.toLocaleString('pt-BR')} Ton`;
                          } else if (sale.areaQuantity) {
                            quantityDisplay = `${sale.areaQuantity} ${sale.areaUnit || 'un'}`;
                          }

                          return (
                            <tr 
                              key={sale.id}
                              className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition-colors duration-150 group border-b border-slate-200 dark:border-stone-800"
                            >
                              {/* Nº */}
                              <td className="px-3 py-1.5 text-xs font-mono text-slate-600 dark:text-stone-400 font-bold whitespace-nowrap">
                                #{itemNumber}
                              </td>

                              {/* Cliente */}
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug uppercase">
                                  {sale.clientName}
                                </div>
                                {sale.farmName && (
                                  <div className="text-[10px] text-slate-500 dark:text-stone-400 font-medium uppercase">
                                    {sale.farmName}
                                  </div>
                                )}
                                {sale.orderNumber && (
                                  <div className="text-[10px] text-slate-500 font-medium uppercase">
                                    Pedido: {sale.orderNumber}
                                  </div>
                                )}
                              </td>

                              {/* Data */}
                              <td className="px-3 py-1.5 text-xs text-slate-700 dark:text-stone-300 font-semibold whitespace-nowrap">
                                {sale.startDate ? formatDateBR(sale.startDate) : '--'}
                              </td>

                              {/* Quantidade / Toneladas */}
                              <td className="px-3 py-1.5 text-xs text-center text-slate-900 dark:text-white font-bold whitespace-nowrap uppercase">
                                {quantityDisplay}
                              </td>

                              {/* Status */}
                              <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                <span 
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                                    statusColors[currentStatus] || 'bg-slate-100 text-slate-900 border-slate-300'
                                  }`}
                                >
                                  {statusLabels[currentStatus] || currentStatus}
                                </span>
                              </td>

                              {/* Total */}
                              <td className="px-3 py-1.5 text-right font-black text-slate-900 dark:text-white text-xs whitespace-nowrap">
                                {formatCurrencyBRL(sale.totalAmount || 0)}
                              </td>

                              {/* Ações */}
                              <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(sale)}
                                    className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-stone-400 dark:hover:text-emerald-400 dark:hover:bg-stone-800 rounded transition-colors cursor-pointer"
                                    title="Editar venda"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteService(sale.id, sale.clientName)}
                                    className="p-1 text-slate-600 hover:text-rose-700 hover:bg-rose-50 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-stone-800 rounded transition-colors cursor-pointer"
                                    title="Excluir venda"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
            </>
          )}
        </div>
      </div>

      {/* 5. JANELA EXCLUSIVA DE VISUALIZAÇÃO E EDIÇÃO DA VENDA RÁPIDA (SLIM DESIGN PRO) */}
      <SaleDetailsEditModal
        isOpen={isSaleEditModalOpen}
        onClose={() => {
          setIsSaleEditModalOpen(false);
          setSelectedSaleForEdit(null);
        }}
        saleRecord={selectedSaleForEdit}
        companyProfile={companyProfile}
        onSaveSuccess={(updatedSale) => {
          setSalesUpdateTick(t => t + 1);
          if (onSaveServices && selectedSaleForEdit) {
            const updated = services.map(s => {
              if (s.id === selectedSaleForEdit.id || (s.orderNumber && s.orderNumber === selectedSaleForEdit.orderNumber)) {
                return {
                  ...s,
                  clientName: updatedSale.cliente,
                  startDate: updatedSale.date,
                  date: updatedSale.date,
                  totalAmount: updatedSale.totalLiquido,
                  ratePerUnit: updatedSale.totalLiquido,
                };
              }
              return s;
            });
            onSaveServices(updated);
          }
        }}
      />
    </div>
  );
};

export default VendaModule;
