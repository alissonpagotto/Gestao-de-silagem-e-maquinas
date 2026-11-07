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
  AlertTriangle
} from 'lucide-react';
import { ServiceOrder, Machinery, Employee, Client, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR, getActiveCompanyId } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { SaleDetailsEditModal } from './SaleDetailsEditModal';
import { PdvView } from './PdvView';
import { FluxoCaixaTab } from '../financial/FluxoCaixaTab';
import { isCaixaAbertoHojeParaOperador } from '../../lib/caixaStorage';
import { supabase } from '../../lib/supabaseClient';
import { fetchAllClientModulesFromSupabase, isSupabaseConfigured } from '../../lib/supabaseService';
import { CompetenceSelector, getPrevCompetence, getNextCompetence, matchesCompetence } from '../financial/CompetenceSelector';

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

  // Filtro por Competência Mensal Padronizado (MM/AAAA)
  const [competenceMonth, setCompetenceMonth] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('agrocontrol_vendas_competence') || localStorage.getItem('agrocontrol_financial_competence');
      if (saved && /^\d{2}\/\d{4}$/.test(saved)) return saved;
    } catch {}
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });

  const isNavigatingCompetenceRef = useRef(false);

  const handlePrevCompetence = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isNavigatingCompetenceRef.current) return;
    isNavigatingCompetenceRef.current = true;
    setTimeout(() => { isNavigatingCompetenceRef.current = false; }, 250);

    const next = getPrevCompetence(competenceMonth);
    try {
      localStorage.setItem('agrocontrol_vendas_competence', next);
    } catch {}
    setCompetenceMonth(next);
    window.dispatchEvent(new CustomEvent('agrocontrol_vendas_competence_changed', { detail: next }));
  };

  const handleNextCompetence = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isNavigatingCompetenceRef.current) return;
    isNavigatingCompetenceRef.current = true;
    setTimeout(() => { isNavigatingCompetenceRef.current = false; }, 250);

    const next = getNextCompetence(competenceMonth);
    try {
      localStorage.setItem('agrocontrol_vendas_competence', next);
    } catch {}
    setCompetenceMonth(next);
    window.dispatchEvent(new CustomEvent('agrocontrol_vendas_competence_changed', { detail: next }));
  };

  // Escuta atualizações de competência vindas da aba Fluxo de Caixa ou outros componentes
  useEffect(() => {
    const handleCompEvent = (e: any) => {
      if (e?.detail && typeof e.detail === 'string' && /^\d{2}\/\d{4}$/.test(e.detail)) {
        setCompetenceMonth((prev) => (prev === e.detail ? prev : e.detail));
      }
    };
    window.addEventListener('agrocontrol_vendas_competence_changed', handleCompEvent);
    return () => window.removeEventListener('agrocontrol_vendas_competence_changed', handleCompEvent);
  }, []);

  // Modal Exclusivo de Detalhes e Edição da Venda (Desvinculação de Serviços)
  const [isSaleEditModalOpen, setIsSaleEditModalOpen] = useState(false);
  const [selectedSaleForEdit, setSelectedSaleForEdit] = useState<ServiceOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ServiceOrder | null>(null);

  // Tab State: Dashboard, PDV ou Fluxo de Caixa
  type VendaTabType = 'dashboard' | 'pdv' | 'fluxo_caixa';
  const [activeTab, setActiveTab] = useState<VendaTabType>('dashboard');

  // Alerta / Toast de Bloqueio do PDV caso o caixa não esteja aberto
  const [caixaAlertToast, setCaixaAlertToast] = useState<string | null>(null);

  // Verificação de Status do Caixa Diário do Operador (Trava de Segurança)
  const verificarCaixaAbertoOperador = (): boolean => {
    const res = isCaixaAbertoHojeParaOperador();
    return res.aberto;
  };

  const handleSelectTab = (tab: VendaTabType) => {
    if (tab === 'pdv') {
      const caixaAberto = verificarCaixaAbertoOperador();
      if (!caixaAberto) {
        setActiveTab('fluxo_caixa');
        setCaixaAlertToast('Atenção: É necessário realizar a abertura do caixa com o fundo de troco antes de iniciar as vendas no PDV!');
        return;
      }
    }
    setActiveTab(tab);
  };

  // Escuta atualizações de abertura/fechamento de caixa para proteção dinâmica contínua
  useEffect(() => {
    const handleCaixaChange = () => {
      if (activeTab === 'pdv' && !verificarCaixaAbertoOperador()) {
        setActiveTab('fluxo_caixa');
        setCaixaAlertToast('Atenção: É necessário realizar a abertura do caixa com o fundo de troco antes de iniciar as vendas no PDV!');
      }
    };
    window.addEventListener('agrocontrol_caixa_operacional_updated', handleCaixaChange);
    window.addEventListener('agrocontrol_historico_caixas_updated', handleCaixaChange);
    window.addEventListener('storage', handleCaixaChange);
    return () => {
      window.removeEventListener('agrocontrol_caixa_operacional_updated', handleCaixaChange);
      window.removeEventListener('agrocontrol_historico_caixas_updated', handleCaixaChange);
      window.removeEventListener('storage', handleCaixaChange);
    };
  }, [activeTab]);

  // Auto-fechamento do Toast após 6 segundos
  useEffect(() => {
    if (!caixaAlertToast) return;
    const timer = setTimeout(() => {
      setCaixaAlertToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [caixaAlertToast]);

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

  // Vendas filtradas pela competência ativa
  const periodSales = useMemo(() => {
    return salesRecords.filter((srv) => {
      let srvDate = srv.startDate || srv.date || ((srv as any).createdAt ? (srv as any).createdAt.split('T')[0] : '');
      if (!srvDate) return false;
      return matchesCompetence(srvDate, competenceMonth);
    });
  }, [salesRecords, competenceMonth]);

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
                onClick={() => handleSelectTab('dashboard')}
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
                onClick={() => handleSelectTab('pdv')}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
                  activeTab === 'pdv'
                    ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>PDV</span>
              </button>

              <button
                type="button"
                id="tab-fluxo-caixa-vendas"
                onClick={() => handleSelectTab('fluxo_caixa')}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap ${
                  activeTab === 'fluxo_caixa'
                    ? 'bg-white text-zinc-900 dark:bg-stone-900 dark:text-white shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                    : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>FLUXO DE CAIXA</span>
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
          ) : activeTab === 'fluxo_caixa' ? (
            <FluxoCaixaTab
              companyProfile={companyProfile}
              competenceMonth={competenceMonth}
              onPrevCompetence={handlePrevCompetence}
              onNextCompetence={handleNextCompetence}
              onCompetenceChange={setCompetenceMonth}
            />
          ) : (
            <>
              {/* BLOCO SUPERIOR: SELETOR DE COMPETÊNCIA PADRONIZADO */}
              <div className="flex items-center justify-between gap-2">
                <CompetenceSelector
                  competence={competenceMonth}
                  onPrev={handlePrevCompetence}
                  onNext={handleNextCompetence}
                />
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
      {/* ALERTA / TOAST DE BLOQUEIO DO PDV */}
      {caixaAlertToast && (
        <div className="fixed top-5 right-5 z-[9999] max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3.5 p-4 bg-amber-500/10 dark:bg-amber-950/90 border-2 border-amber-500 rounded-xl shadow-2xl backdrop-blur-md text-amber-900 dark:text-amber-100">
            <div className="p-2.5 bg-amber-500 text-white rounded-lg shadow-sm shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 pr-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                Acesso ao PDV Bloqueado
              </h4>
              <p className="text-xs font-semibold mt-1 text-amber-950 dark:text-amber-100 leading-relaxed">
                {caixaAlertToast}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCaixaAlertToast(null)}
              className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-white p-1 rounded-md transition hover:bg-amber-200/50 dark:hover:bg-amber-900/50"
              title="Fechar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendaModule;
