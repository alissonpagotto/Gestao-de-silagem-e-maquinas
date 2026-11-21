import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Printer,
  Calendar as CalendarIcon,
  FileText,
  Download,
  Scissors,
  ShoppingCart,
  DollarSign,
  Fuel,
  LayoutDashboard,
  Building2,
  WalletCards,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
  Tractor,
  Users,
  Wallet,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import {
  Expense,
  SilageOrder,
  ServiceOrder,
  CompanyProfile,
  FuelLog,
  Client,
  Machinery,
  CropSeason,
  Employee,
  InventoryItem,
  MaintenanceLog,
  Supplier,
  BankAccount,
  PayrollRecord,
  VacationRecord,
  SalaryAdvance,
  LeaveRecord,
} from '../../types';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { ReportsDashboardTab } from './ReportsDashboardTab';
import { ReportsResumoTab } from './ReportsResumoTab';
import { ReportsExportTab } from './ReportsExportTab';
import { ReportsCortesTab } from './ReportsCortesTab';
import { getLastDayOfMonth } from '../../lib/storage';
import { ReportsVendasTab } from './ReportsVendasTab';
import { ReportsDespesasTab } from './ReportsDespesasTab';
import { ReportsConsumoTab } from './ReportsConsumoTab';
import { ReportsAtivoImobilizadoTab } from './ReportsAtivoImobilizadoTab';
import { ReportsFinanceiroTab, FinanceiroSubTab } from './ReportsFinanceiroTab';
import { ReportsExcecoesTab } from './ReportsExcecoesTab';
import { ReportsPersonalizadoTab } from './ReportsPersonalizadoTab';
import { ReportsCaixaTab } from './ReportsCaixaTab';
import { ReportsDreVeiculoTab } from './ReportsDreVeiculoTab';
import { ReportsEstoqueFerramentasTab } from './ReportsEstoqueFerramentasTab';
import { ReportsRhFolhaTab } from './ReportsRhFolhaTab';
import { getCompetenceDateRange } from '../financial/CompetenceSelector';
import {
  buildDashboardConsolidatedReport,
  ReportPrintConfig,
  ReportSubTabId,
  resolveReportSegmentContext,
  STANDARD_REPORT_SIGNATURES,
} from './reportPrintBuilders';

export interface ReportsModuleProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  companyProfile: CompanyProfile;
  fuelLogs?: FuelLog[];
  clients?: Client[];
  machineries?: Machinery[];
  seasons?: CropSeason[];
  employees?: Employee[];
  inventory?: InventoryItem[];
  maintenanceLogs?: MaintenanceLog[];
  suppliers?: Supplier[];
  bankAccounts?: BankAccount[];
  payrolls?: PayrollRecord[];
  vacations?: VacationRecord[];
  advances?: SalaryAdvance[];
  leaves?: LeaveRecord[];
}

export type ReportPillarId =
  | 'estrategico'
  | 'financeiro_caixa'
  | 'operacional_vendas'
  | 'frota_estoque'
  | 'rh_despesas'
  | 'excecoes'
  | 'personalizado';

export type ReportViewKey =
  | Exclude<ReportSubTabId, 'financeiro'>
  | 'pagar'
  | 'receber'
  | 'cheques';

interface SubPillDef {
  key: ReportViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PillarDef {
  id: ReportPillarId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems: SubPillDef[];
}

const PRINT_BUTTON_LABELS: Record<ReportViewKey, string> = {
  dashboard: 'Imprimir Relatório Consolidado',
  resumo: 'Imprimir DRE Gerencial',
  dre_veiculo: 'Imprimir DRE por Veículo',
  caixa: 'Imprimir Situação de Caixas',
  pagar: 'Imprimir Contas a Pagar',
  receber: 'Imprimir Contas a Receber',
  cheques: 'Imprimir Custódia de Cheques',
  cortes: 'Imprimir Relatório de Serviços',
  vendas: 'Imprimir Relatório de Vendas',
  consumo: 'Imprimir Relatório de Consumo',
  estoque_ferramentas: 'Imprimir Estoque & Ferramentas',
  imobilizado: 'Imprimir Inventário & IPVA',
  despesas: 'Imprimir Relatório de Despesas',
  rh_folha: 'Imprimir Resumo Folha & RH',
  excecoes: 'Imprimir Pauta de Pendências',
  personalizado: 'Imprimir Relatório Personalizado',
  exportar: 'Imprimir Relatório Consolidado',
};

const FULL_HEIGHT_VIEWS = new Set<ReportViewKey>([
  'dre_veiculo',
  'caixa',
  'pagar',
  'receber',
  'cheques',
  'cortes',
  'vendas',
  'consumo',
  'estoque_ferramentas',
  'despesas',
  'rh_folha',
  'excecoes',
  'personalizado',
]);

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  expenses,
  orders,
  services,
  companyProfile,
  fuelLogs = [],
  clients = [],
  machineries = [],
  seasons = [],
  employees = [],
  inventory = [],
  maintenanceLogs = [],
  suppliers = [],
  bankAccounts = [],
  payrolls = [],
  vacations = [],
  advances = [],
}) => {
  const segmentCtx = useMemo(() => resolveReportSegmentContext(companyProfile), [companyProfile]);

  const pillars = useMemo<PillarDef[]>(
    () => [
      {
        id: 'estrategico',
        label: '📊 Estratégico & DRE',
        icon: TrendingUp,
        subItems: [
          { key: 'dashboard', label: 'Dashboard Consolidado', icon: LayoutDashboard },
          { key: 'resumo', label: 'DRE Gerencial Completo', icon: FileText },
          { key: 'dre_veiculo', label: 'DRE por Veículo / Máquina', icon: Tractor },
        ],
      },
      {
        id: 'personalizado',
        label: '🛠️ RELATÓRIO PERSONALIZADO',
        icon: SlidersHorizontal,
        subItems: [
          { key: 'personalizado', label: 'Construtor Ad-Hoc', icon: SlidersHorizontal },
          { key: 'exportar', label: 'Exportar Excel', icon: Download },
        ],
      },
      {
        id: 'financeiro_caixa',
        label: '💰 Financeiro & Caixa',
        icon: WalletCards,
        subItems: [
          { key: 'caixa', label: 'Situação de Caixa (Nº Caixa)', icon: Wallet },
          { key: 'pagar', label: 'Contas a Pagar', icon: ArrowUpRight },
          { key: 'receber', label: 'Contas a Receber', icon: ArrowDownLeft },
          { key: 'cheques', label: 'Custódia de Cheques', icon: WalletCards },
        ],
      },
      {
        id: 'operacional_vendas',
        label: '🚜 Operacional & Vendas',
        icon: Scissors,
        subItems: [
          { key: 'cortes', label: segmentCtx.servicesTabNavLabel, icon: Scissors },
          { key: 'vendas', label: 'Relatório de Vendas', icon: ShoppingCart },
        ],
      },
      {
        id: 'frota_estoque',
        label: '⛽ Frota, Estoque & Patrimônio',
        icon: Fuel,
        subItems: [
          { key: 'consumo', label: 'Consumo de Combustível', icon: Fuel },
          { key: 'estoque_ferramentas', label: 'Posição de Estoque & Ferramentas', icon: Package },
          { key: 'imobilizado', label: 'Ativo Imobilizado & IPVA', icon: Building2 },
        ],
      },
      {
        id: 'rh_despesas',
        label: '👥 RH & Despesas',
        icon: Users,
        subItems: [
          { key: 'despesas', label: 'Controle de Despesas', icon: DollarSign },
          { key: 'rh_folha', label: 'Resumo Folha, Vales & Vencimentos RH', icon: Users },
        ],
      },
      {
        id: 'excecoes',
        label: '🚨 Exceções & Alertas',
        icon: ShieldAlert,
        subItems: [{ key: 'excecoes', label: 'Pendências Críticas', icon: ShieldAlert }],
      },
    ],
    [segmentCtx.servicesTabNavLabel]
  );

  // Navigation State: 7 Pilares + Sub-visão ativa
  const [activePillarId, setActivePillarId] = useState<ReportPillarId>('estrategico');
  const [activeViewKey, setActiveViewKey] = useState<ReportViewKey>('dashboard');

  const activePillar = useMemo(
    () => pillars.find((p) => p.id === activePillarId) || pillars[0],
    [pillars, activePillarId]
  );

  const handleSelectPillar = (pillar: PillarDef) => {
    setActivePillarId(pillar.id);
    const belongs = pillar.subItems.some((s) => s.key === activeViewKey);
    if (!belongs && pillar.subItems.length > 0) {
      setActiveViewKey(pillar.subItems[0].key);
    }
  };

  // Month & Year state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Filter Period Selection
  const [quickPeriod, setQuickPeriod] = useState<'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses'>('mes_atual');

  // Custom Date range
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${selectedYear}-${pad(selectedMonth + 1)}-01`;
  const defaultEnd = getLastDayOfMonth(selectedYear, selectedMonth);
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);

  // Competence string MM/AAAA
  const competence = useMemo(() => {
    return `${pad(selectedMonth + 1)}/${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  const handleCompetenceChange = useCallback((newComp: string) => {
    const range = getCompetenceDateRange(newComp);
    const [mStr, yStr] = newComp.split('/');
    const m = parseInt(mStr, 10);
    const y = parseInt(yStr, 10);
    if (!isNaN(m) && m >= 1 && m <= 12) setSelectedMonth(m - 1);
    if (!isNaN(y)) setSelectedYear(y);
    setStartDate(range.start);
    setEndDate(range.end);
    setQuickPeriod('mes_atual');
  }, []);

  const handleStartDateChange = useCallback((newStart: string) => {
    setStartDate(newStart);
    if (/^\d{4}-\d{2}-\d{2}$/.test(newStart)) {
      const [yStr, mStr] = newStart.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        setSelectedYear(y);
        setSelectedMonth(m - 1);
      }
    }
  }, []);

  // Print Preview Modal & Dynamic Active Tab Getter Registry
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [activePrintConfig, setActivePrintConfig] = useState<ReportPrintConfig | null>(null);
  const tabPrintGettersRef = useRef<Partial<Record<ReportSubTabId, () => ReportPrintConfig>>>({});

  const registerPrintGetter = useMemo(
    () => ({
      resumo: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.resumo = getter;
      },
      dre_veiculo: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.dre_veiculo = getter;
      },
      caixa: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.caixa = getter;
      },
      financeiro: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.financeiro = getter;
      },
      excecoes: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.excecoes = getter;
      },
      personalizado: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.personalizado = getter;
      },
      estoque_ferramentas: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.estoque_ferramentas = getter;
      },
      rh_folha: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.rh_folha = getter;
      },
      imobilizado: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.imobilizado = getter;
      },
      cortes: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.cortes = getter;
      },
      vendas: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.vendas = getter;
      },
      despesas: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.despesas = getter;
      },
      consumo: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.consumo = getter;
      },
    }),
    []
  );

  const monthsList = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const handleMonthChange = (monthIdx: number) => {
    setSelectedMonth(monthIdx);
    const s = `${selectedYear}-${pad(monthIdx + 1)}-01`;
    const e = getLastDayOfMonth(selectedYear, monthIdx);
    setStartDate(s);
    setEndDate(e);
    setQuickPeriod('mes_atual');
  };

  const handleQuickPeriodChange = (p: 'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses') => {
    setQuickPeriod(p);
    const today = new Date();
    let startD = new Date();

    if (p === 'mes_atual') {
      startD = new Date(selectedYear, selectedMonth, 1);
      const endD = new Date(selectedYear, selectedMonth + 1, 0);
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

    const nextStart = `${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`;
    setStartDate(nextStart);
    setEndDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
  };

  // Consolidated Print Fallback (used on Dashboard Consolidado & Exportar tabs)
  const consolidatedPrintConfig = useMemo(
    () =>
      buildDashboardConsolidatedReport({
        companyProfile,
        orders,
        services,
        expenses,
        fuelLogs,
        startDate,
        endDate,
        competence,
      }),
    [companyProfile, orders, services, expenses, fuelLogs, startDate, endDate, competence]
  );

  const handleOpenPrintModal = useCallback(
    (explicitConfig?: ReportPrintConfig) => {
      if (explicitConfig && typeof explicitConfig.contentHtml === 'string') {
        setActivePrintConfig(explicitConfig);
      } else {
        const getterKey: ReportSubTabId =
          activeViewKey === 'pagar' || activeViewKey === 'receber' || activeViewKey === 'cheques'
            ? 'financeiro'
            : activeViewKey;
        const getter = tabPrintGettersRef.current[getterKey];
        const resolved = getter ? getter() : consolidatedPrintConfig;
        setActivePrintConfig(resolved);
      }
      setIsPrintModalOpen(true);
    },
    [activeViewKey, consolidatedPrintConfig]
  );

  const printButtonLabel = PRINT_BUTTON_LABELS[activeViewKey] || 'Imprimir Relatório Atual';
  const modalConfig = activePrintConfig || consolidatedPrintConfig;
  const isFinanceiroSubView =
    activeViewKey === 'pagar' || activeViewKey === 'receber' || activeViewKey === 'cheques';
  const isFullHeight = FULL_HEIGHT_VIEWS.has(activeViewKey);

  return (
    <div id="reports-module-root" className="w-full max-w-none flex-1 min-h-0 h-full max-h-full flex flex-col gap-2 overflow-hidden animate-fade-in">
      {/* 1. Header do Módulo 3D Slim */}
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg px-3 py-1.5 shadow-xs">
        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-stone-100 tracking-tight font-['Outfit']">
            Central de Relatórios & Inteligência Gerencial
          </h1>
        </div>

        {/* Top-right Actions: Month Picker + Botão Contextual por Aba */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              aria-label="Selecionar mês de competência dos relatórios"
              className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-slate-500 shadow-2xs cursor-pointer"
            >
              {monthsList.map((m, idx) => (
                <option key={m} value={idx}>
                  {m} de {selectedYear}
                </option>
              ))}
            </select>
            <CalendarIcon className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => handleOpenPrintModal()}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-black dark:border-stone-700 bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 text-black shadow-2xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-black dark:text-stone-300" />
            <span>{printButtonLabel}</span>
          </button>
        </div>
      </header>

      {/* 2. ESTRUTURA INTEGRADA DE 7 PILARES + SUB-PÍLULAS */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* BASE DE FUNDO DOS 7 PILARES: MOLDURA MDI TRIDIMENSIONAL ACETINADA */}
        <div className="shrink-0 w-full bg-[#cad4e6] dark:bg-stone-900 border border-b-0 border-black dark:border-stone-700 rounded-t-lg overflow-x-auto scrollbar-none">
          <nav
            aria-label="Pilares de Relatórios"
            className="w-full flex items-center overflow-x-auto whitespace-nowrap scrollbar-none"
          >
            {pillars.map((pillar) => {
              const isActive = activePillarId === pillar.id;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => handleSelectPillar(pillar)}
                  style={isActive ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                  className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 last:border-r-0 ${
                    isActive
                      ? 'bg-orange-400/40 text-black font-bold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                      : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                  }`}
                >
                  <span>{pillar.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* MOLDURA GERAL INTEGRADA */}
        <div className="w-full flex-1 min-h-0 border border-black dark:border-stone-700 rounded-b-lg bg-[#e0e6f1]/40 dark:bg-stone-900 shadow-sm flex flex-col overflow-hidden">
          {/* Sub-pílulas compactas do Pilar Ativo */}
          {activePillar.subItems.length > 1 && (
            <div className="shrink-0 bg-[#cad4e6]/80 dark:bg-stone-850 border-b border-black/30 dark:border-stone-700 px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
              {activePillar.subItems.map((sub) => {
                const SubIcon = sub.icon;
                const isSubActive = activeViewKey === sub.key;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => setActiveViewKey(sub.key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      isSubActive
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                        : 'bg-white dark:bg-stone-800 border-slate-400 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Área de Conteúdo da Sub-Visão Ativa */}
          <div
            className={`w-full flex-1 min-h-0 ${
              isFullHeight
                ? 'flex flex-col overflow-hidden p-2.5'
                : 'overflow-y-auto overflow-x-hidden p-3 space-y-3'
            }`}
          >
            {activeViewKey === 'dashboard' && (
              <ReportsDashboardTab
                expenses={expenses}
                orders={orders}
                services={services}
                fuelLogs={fuelLogs}
                companyProfile={companyProfile}
                quickPeriod={quickPeriod}
                onQuickPeriodChange={handleQuickPeriodChange}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={setEndDate}
                selectedMonthName={monthsList[selectedMonth]}
                selectedYear={selectedYear}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
              />
            )}

            {activeViewKey === 'resumo' && (
              <ReportsResumoTab
                expenses={expenses}
                orders={orders}
                services={services}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={setEndDate}
                onOpenPrintModal={(config) => handleOpenPrintModal(config)}
                onRegisterPrintGetter={registerPrintGetter.resumo}
              />
            )}

            {activeViewKey === 'dre_veiculo' && (
              <ReportsDreVeiculoTab
                machineries={machineries}
                orders={orders}
                services={services}
                expenses={expenses}
                fuelLogs={fuelLogs}
                maintenanceLogs={maintenanceLogs}
                employees={employees}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onRegisterPrintGetter={registerPrintGetter.dre_veiculo}
              />
            )}

            {activeViewKey === 'caixa' && (
              <ReportsCaixaTab
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onOpenPrintModal={(config) => handleOpenPrintModal(config)}
                onRegisterPrintGetter={registerPrintGetter.caixa}
              />
            )}

            {isFinanceiroSubView && (
              <ReportsFinanceiroTab
                expenses={expenses}
                orders={orders}
                services={services}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onRegisterPrintGetter={registerPrintGetter.financeiro}
                controlledSubTab={activeViewKey as FinanceiroSubTab}
                hideInternalSubPills
              />
            )}

            {activeViewKey === 'cortes' && (
              <ReportsCortesTab
                services={services}
                orders={orders}
                seasons={seasons}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={setEndDate}
                onRegisterPrintGetter={registerPrintGetter.cortes}
              />
            )}

            {activeViewKey === 'vendas' && (
              <ReportsVendasTab
                orders={orders}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={setEndDate}
                onRegisterPrintGetter={registerPrintGetter.vendas}
              />
            )}

            {activeViewKey === 'consumo' && (
              <ReportsConsumoTab
                fuelLogs={fuelLogs}
                machineries={machineries}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={setEndDate}
                onRegisterPrintGetter={registerPrintGetter.consumo}
              />
            )}

            {activeViewKey === 'estoque_ferramentas' && (
              <ReportsEstoqueFerramentasTab
                inventory={inventory}
                machineries={machineries}
                employees={employees}
                companyProfile={companyProfile}
                onRegisterPrintGetter={registerPrintGetter.estoque_ferramentas}
              />
            )}

            {activeViewKey === 'imobilizado' && (
              <ReportsAtivoImobilizadoTab
                machineries={machineries}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onOpenPrintModal={(config) => handleOpenPrintModal(config)}
                onRegisterPrintGetter={registerPrintGetter.imobilizado}
              />
            )}

            {activeViewKey === 'despesas' && (
              <ReportsDespesasTab
                expenses={expenses}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={setEndDate}
                onRegisterPrintGetter={registerPrintGetter.despesas}
              />
            )}

            {activeViewKey === 'rh_folha' && (
              <ReportsRhFolhaTab
                employees={employees}
                payrolls={payrolls}
                vacations={vacations}
                advances={advances}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onRegisterPrintGetter={registerPrintGetter.rh_folha}
              />
            )}

            {activeViewKey === 'excecoes' && (
              <ReportsExcecoesTab
                expenses={expenses}
                orders={orders}
                services={services}
                inventory={inventory}
                machineries={machineries}
                maintenanceLogs={maintenanceLogs}
                employees={employees}
                companyProfile={companyProfile}
                onOpenPrintModal={(config) => handleOpenPrintModal(config)}
                onRegisterPrintGetter={registerPrintGetter.excecoes}
              />
            )}

            {activeViewKey === 'personalizado' && (
              <ReportsPersonalizadoTab
                expenses={expenses}
                orders={orders}
                services={services}
                inventory={inventory}
                fuelLogs={fuelLogs}
                machineries={machineries}
                maintenanceLogs={maintenanceLogs}
                employees={employees}
                clients={clients}
                suppliers={suppliers}
                bankAccounts={bankAccounts}
                payrolls={payrolls}
                vacations={vacations}
                advances={advances}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                onOpenPrintModal={(config) => handleOpenPrintModal(config)}
                onRegisterPrintGetter={registerPrintGetter.personalizado}
              />
            )}

            {activeViewKey === 'exportar' && (
              <ReportsExportTab
                expenses={expenses}
                orders={orders}
                services={services}
                fuelLogs={fuelLogs}
                clients={clients}
                machineries={machineries}
                companyProfile={companyProfile}
                startDate={startDate}
                endDate={endDate}
                competence={competence}
                onCompetenceChange={handleCompetenceChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={setEndDate}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modal de Impressão e PDF Contextual da Aba Ativa */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setActivePrintConfig(null);
        }}
        options={{
          title: modalConfig.title,
          subtitle: modalConfig.subtitle,
          documentType: modalConfig.documentType,
          company: companyProfile,
          contentHtml: modalConfig.contentHtml,
          orientation: modalConfig.orientation || 'portrait',
          signatureLabels: modalConfig.signatureLabels || STANDARD_REPORT_SIGNATURES,
          whatsappText: modalConfig.whatsappText,
        }}
      />
    </div>
  );
};
