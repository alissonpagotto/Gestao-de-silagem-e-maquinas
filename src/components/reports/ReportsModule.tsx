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
  SlidersHorizontal
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
  BankAccount
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
}

const PRINT_BUTTON_LABELS: Record<ReportSubTabId, string> = {
  dashboard: 'Imprimir Relatório Consolidado',
  resumo: 'Imprimir DRE Gerencial',
  financeiro: 'Imprimir Relatório Financeiro',
  excecoes: 'Imprimir Pauta de Pendências',
  personalizado: 'Imprimir Relatório Personalizado',
  imobilizado: 'Imprimir Inventário & IPVA',
  cortes: 'Imprimir Relatório de Serviços',
  vendas: 'Imprimir Relatório de Vendas',
  despesas: 'Imprimir Relatório de Despesas',
  consumo: 'Imprimir Relatório de Consumo',
  exportar: 'Imprimir Relatório Consolidado',
};

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
}) => {
  const segmentCtx = useMemo(() => resolveReportSegmentContext(companyProfile), [companyProfile]);

  // Navigation Subtabs
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTabId>('dashboard');
  const [financeiroSubTab, setFinanceiroSubTab] = useState<FinanceiroSubTab>('pagar');

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
      financeiro: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.financeiro = getter;
      },
      excecoes: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.excecoes = getter;
      },
      personalizado: (getter: () => ReportPrintConfig) => {
        tabPrintGettersRef.current.personalizado = getter;
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
        const getter = tabPrintGettersRef.current[activeSubTab];
        const resolved = getter ? getter() : consolidatedPrintConfig;
        setActivePrintConfig(resolved);
      }
      setIsPrintModalOpen(true);
    },
    [activeSubTab, consolidatedPrintConfig]
  );

  const navSubTabs: Array<{ id: ReportSubTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard Consolidado', icon: LayoutDashboard },
    { id: 'resumo', label: 'Resumo Geral', icon: FileText },
    { id: 'financeiro', label: '💰 Financeiro', icon: WalletCards },
    { id: 'excecoes', label: '🚨 Exceções & Alertas', icon: ShieldAlert },
    { id: 'personalizado', label: '🛠️ Personalizado', icon: SlidersHorizontal },
    { id: 'imobilizado', label: '📊 Ativo Imobilizado', icon: Building2 },
    { id: 'exportar', label: 'Exportar Excel', icon: Download },
    { id: 'cortes', label: segmentCtx.servicesTabNavLabel, icon: Scissors },
    { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
    { id: 'despesas', label: 'Despesas', icon: DollarSign },
    { id: 'consumo', label: 'Consumo', icon: Fuel },
  ];

  const printButtonLabel = useMemo(() => {
    if (activeSubTab === 'financeiro') {
      if (financeiroSubTab === 'receber') return 'Imprimir Contas a Receber';
      if (financeiroSubTab === 'cheques') return 'Imprimir Custódia de Cheques';
      return 'Imprimir Contas a Pagar';
    }
    return PRINT_BUTTON_LABELS[activeSubTab] || 'Imprimir Relatório';
  }, [activeSubTab, financeiroSubTab]);
  const modalConfig = activePrintConfig || consolidatedPrintConfig;

  return (
    <div id="reports-module-root" className="w-full max-w-none flex-1 min-h-0 h-full max-h-full flex flex-col gap-2 overflow-hidden animate-fade-in">
      
      {/* 1. Header do Módulo 3D Slim */}
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg px-3 py-1.5 shadow-xs">
        <div>
          <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-stone-100 tracking-tight font-['Outfit']">
            Relatórios
          </h1>
        </div>

        {/* Top-right Actions: Month Picker + Botão Contextual por Aba */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Month Selector Dropdown (Sincronizado bidirecionalmente com Competência MM/AAAA) */}
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

          {/* Botão Imprimir Contextual 3D Acetinado */}
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

      {/* 2. ESTRUTURA INTEGRADA DE ABAS SUPERIORES E MOLDURA GERAL (PADRÃO OURO) */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* BASE DE FUNDO DAS ABAS: MOLDURA MDI TRIDIMENSIONAL ACETINADA */}
        <div className="shrink-0 w-full bg-[#cad4e6] dark:bg-stone-900 border border-b-0 border-black dark:border-stone-700 rounded-t-lg overflow-x-auto scrollbar-none">
          <nav 
            aria-label="Abas de Relatórios"
            className="w-full flex items-center overflow-x-auto whitespace-nowrap scrollbar-none"
          >
            {navSubTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  style={isActive ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
                  className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 last:border-r-0 ${
                    isActive
                      ? 'bg-orange-400/40 text-black font-semibold shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                      : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* MOLDURA GERAL INTEGRADA DE PONTA A PONTA (SEM VÃO LIVRE) */}
        <div className={`w-full flex-1 min-h-0 border border-black dark:border-stone-700 rounded-b-lg bg-[#e0e6f1]/40 dark:bg-stone-900 shadow-sm ${
          activeSubTab === 'cortes' ||
          activeSubTab === 'vendas' ||
          activeSubTab === 'despesas' ||
          activeSubTab === 'consumo' ||
          activeSubTab === 'financeiro' ||
          activeSubTab === 'excecoes' ||
          activeSubTab === 'personalizado'
            ? 'flex flex-col overflow-hidden p-2.5'
            : 'overflow-y-auto overflow-x-hidden p-3 space-y-3'
        }`}>
          {/* 3. Conteúdo da Aba Ativa */}
          {activeSubTab === 'dashboard' && (
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

          {activeSubTab === 'resumo' && (
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

          {activeSubTab === 'exportar' && (
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

          {activeSubTab === 'cortes' && (
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

          {activeSubTab === 'vendas' && (
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

          {activeSubTab === 'despesas' && (
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

          {activeSubTab === 'consumo' && (
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

          {activeSubTab === 'imobilizado' && (
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

          {activeSubTab === 'financeiro' && (
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
              onSubTabChange={setFinanceiroSubTab}
            />
          )}

          {activeSubTab === 'excecoes' && (
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

          {activeSubTab === 'personalizado' && (
            <ReportsPersonalizadoTab
              expenses={expenses}
              orders={orders}
              services={services}
              inventory={inventory}
              fuelLogs={fuelLogs}
              machineries={machineries}
              employees={employees}
              companyProfile={companyProfile}
              startDate={startDate}
              endDate={endDate}
              onOpenPrintModal={(config) => handleOpenPrintModal(config)}
              onRegisterPrintGetter={registerPrintGetter.personalizado}
            />
          )}
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
