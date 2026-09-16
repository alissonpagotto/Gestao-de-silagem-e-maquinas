import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  Calendar as CalendarIcon, 
  FileText, 
  Download, 
  Scissors, 
  ShoppingCart, 
  DollarSign, 
  Fuel,
  LayoutDashboard,
  ChevronDown,
  Building2
} from 'lucide-react';
import { 
  Expense, 
  SilageOrder, 
  ServiceOrder, 
  CompanyProfile, 
  FuelLog, 
  Client, 
  Machinery, 
  CropSeason 
} from '../../types';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import { ReportsDashboardTab } from './ReportsDashboardTab';
import { ReportsResumoTab } from './ReportsResumoTab';
import { ReportsExportTab } from './ReportsExportTab';
import { ReportsCortesTab } from './ReportsCortesTab';
import { ReportsVendasTab } from './ReportsVendasTab';
import { ReportsDespesasTab } from './ReportsDespesasTab';
import { ReportsConsumoTab } from './ReportsConsumoTab';
import { ReportsAtivoImobilizadoTab } from './ReportsAtivoImobilizadoTab';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

export interface ReportsModuleProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  companyProfile: CompanyProfile;
  fuelLogs?: FuelLog[];
  clients?: Client[];
  machineries?: Machinery[];
  seasons?: CropSeason[];
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  expenses,
  orders,
  services,
  companyProfile,
  fuelLogs = [],
  clients = [],
  machineries = [],
  seasons = [],
}) => {
  // Navigation Subtabs
  const [activeSubTab, setActiveSubTab] = useState<
    'dashboard' | 'resumo' | 'exportar' | 'cortes' | 'vendas' | 'despesas' | 'consumo' | 'imobilizado'
  >('dashboard');

  // Month & Year state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-indexed (8 = September)
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear()); // 2026

  // Filter Period Pill Selection
  const [quickPeriod, setQuickPeriod] = useState<'mes_atual' | '1_mes' | '3_meses' | '6_meses' | '12_meses'>('mes_atual');

  // Custom Date range
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultStart = `${selectedYear}-${pad(selectedMonth + 1)}-01`;
  const defaultEnd = `${selectedYear}-${pad(selectedMonth + 1)}-31`;
  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);

  // Print Preview Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [customPrintHtml, setCustomPrintHtml] = useState<string | null>(null);
  const [customWhatsAppText, setCustomWhatsAppText] = useState<string | null>(null);

  const monthsList = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  const handleMonthChange = (monthIdx: number) => {
    setSelectedMonth(monthIdx);
    const s = `${selectedYear}-${pad(monthIdx + 1)}-01`;
    const e = `${selectedYear}-${pad(monthIdx + 1)}-31`;
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

    setStartDate(`${startD.getFullYear()}-${pad(startD.getMonth() + 1)}-${pad(startD.getDate())}`);
    setEndDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
  };

  // General Consolidated Print HTML
  const generalPrintHtml = useMemo(() => {
    const periodOrders = orders.filter(o => o.deliveryDate >= startDate && o.deliveryDate <= endDate && o.status !== 'cancelado');
    const periodServices = services.filter(s => s.startDate >= startDate && s.startDate <= endDate && s.status !== 'cancelado');
    const periodExpenses = expenses.filter(e => e.dueDate >= startDate && e.dueDate <= endDate);
    const periodFuel = fuelLogs.filter(f => f.date >= startDate && f.date <= endDate);

    const ordersRev = periodOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const servicesRev = periodServices.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalRev = ordersRev + servicesRev;
    const totalExp = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const net = totalRev - totalExp;

    const totalTonsSilage = periodOrders.reduce((sum, o) => sum + (o.tons || 0), 0);
    const totalHectares = periodServices.reduce((sum, s) => sum + (s.areaHectares || 0), 0);
    const totalDieselLiters = periodFuel.reduce((sum, f) => sum + (f.liters || 0), 0);

    return `
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14pt; font-weight: bold; color: #0f172a; margin-bottom: 4px;">
          RELATÓRIO CONSOLIDADO EXECUTIVO DA SAFRA
        </h3>
        <p style="font-size: 10pt; color: #64748b; margin-top: 0;">
          Período Contábil e Operacional: <strong>${formatDateBR(startDate)}</strong> a <strong>${formatDateBR(endDate)}</strong>
        </p>
      </div>

      <!-- Resumo Financeiro -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #0f172a; color: white;">
            <th style="padding: 8px 12px; text-align: left;">Indicador Financeiro</th>
            <th style="padding: 8px 12px; text-align: right;">Total Realizado (R$)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background: #f0fdf4;">
            <td style="padding: 8px 12px; font-weight: bold;">(+) Receita com Vendas de Silagem</td>
            <td style="padding: 8px 12px; text-align: right; color: #047857; font-weight: bold;">${formatCurrencyBRL(ordersRev)}</td>
          </tr>
          <tr style="background: #f0fdf4;">
            <td style="padding: 8px 12px; font-weight: bold;">(+) Receita com Serviços de Colheita / Cortes</td>
            <td style="padding: 8px 12px; text-align: right; color: #047857; font-weight: bold;">${formatCurrencyBRL(servicesRev)}</td>
          </tr>
          <tr style="background: #e2e8f0; font-weight: bold;">
            <td style="padding: 8px 12px;">(=) RECEITA BRUTA TOTAL</td>
            <td style="padding: 8px 12px; text-align: right; color: #047857; font-size: 11pt;">${formatCurrencyBRL(totalRev)}</td>
          </tr>
          <tr style="background: #fff1f2;">
            <td style="padding: 8px 12px; font-weight: bold;">(-) Despesas e Custos Operacionais</td>
            <td style="padding: 8px 12px; text-align: right; color: #b91c1c; font-weight: bold;">${formatCurrencyBRL(totalExp)}</td>
          </tr>
          <tr style="background: #dcfce7; font-weight: 900; font-size: 12pt; border-top: 2px solid #047857;">
            <td style="padding: 10px 12px;">(=) RESULTADO LÍQUIDO OPERACIONAL</td>
            <td style="padding: 10px 12px; text-align: right; color: ${net >= 0 ? '#047857' : '#b91c1c'};">
              ${formatCurrencyBRL(net)} (${totalRev > 0 ? ((net / totalRev) * 100).toFixed(1) : 0}%)
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Resumo Físico e Operacional -->
      <h4 style="font-size: 11pt; font-weight: bold; margin-bottom: 8px; color: #1e293b;">
        MÉTRICAS FÍSICAS DE PRODUÇÃO E COLHEITA
      </h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background: #f8fafc;">
          <td style="padding: 8px; border: 1px solid #cbd5e1;">Área Total Colhida / Ensilada:</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: right;">${totalHectares.toFixed(1)} ha</td>
        </tr>
        <tr style="background: #ffffff;">
          <td style="padding: 8px; border: 1px solid #cbd5e1;">Volume Total de Silagem Comercializada:</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: right;">${totalTonsSilage.toFixed(1)} ton</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 8px; border: 1px solid #cbd5e1;">Consumo Total de Diesel / Combustível:</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: right;">${totalDieselLiters.toFixed(1)} Litros</td>
        </tr>
      </table>
    `;
  }, [orders, services, expenses, fuelLogs, startDate, endDate]);

  const generalWhatsAppText = useMemo(() => {
    const periodOrders = orders.filter(o => o.deliveryDate >= startDate && o.deliveryDate <= endDate && o.status !== 'cancelado');
    const periodServices = services.filter(s => s.startDate >= startDate && s.startDate <= endDate && s.status !== 'cancelado');
    const periodExpenses = expenses.filter(e => e.dueDate >= startDate && e.dueDate <= endDate);
    const ordersRev = periodOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const servicesRev = periodServices.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalRev = ordersRev + servicesRev;
    const totalExp = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const net = totalRev - totalExp;

    return `📊 *${companyProfile?.tradeName?.toUpperCase() || 'SILAGEM FÁCIL PRO'}*\n` +
      `📑 *RELATÓRIO GERAL CONSOLIDADO*\n` +
      `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)}\n\n` +
      `💰 *Receita Total:* ${formatCurrencyBRL(totalRev)}\n` +
      `💸 *Despesas Totais:* ${formatCurrencyBRL(totalExp)}\n` +
      `🟢 *Resultado Líquido:* ${formatCurrencyBRL(net)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🌱 Gerado automaticamente pelo Silagem Fácil Pro`;
  }, [companyProfile, orders, services, expenses, startDate, endDate]);

  const handleOpenPrintModal = (html?: string, whatsapp?: string) => {
    if (html) {
      setCustomPrintHtml(html);
      setCustomWhatsAppText(whatsapp || null);
    } else {
      setCustomPrintHtml(generalPrintHtml);
      setCustomWhatsAppText(generalWhatsAppText);
    }
    setIsPrintModalOpen(true);
  };

  const navSubTabs = [
    { id: 'dashboard', label: 'Dashboard Consolidado', icon: LayoutDashboard },
    { id: 'resumo', label: 'Resumo Geral', icon: FileText },
    { id: 'imobilizado', label: '📊 Ativo Imobilizado', icon: Building2 },
    { id: 'exportar', label: 'Exportar Excel', icon: Download },
    { id: 'cortes', label: 'Cortes', icon: Scissors },
    { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
    { id: 'despesas', label: 'Despesas', icon: DollarSign },
    { id: 'consumo', label: 'Consumo', icon: Fuel },
  ];

  return (
    <div className="w-full max-w-none space-y-4 sm:space-y-5 animate-fade-in">
      
      {/* 1. Header do Módulo (Conforme Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight font-['Outfit']">
            Relatórios
          </h1>
          <p className="text-xs text-black dark:text-stone-400 font-bold">
            Visão consolidada de receitas, despesas e margem operacional
          </p>
        </div>

        {/* Top-right Actions: Month Picker + Imprimir Geral */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Month Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-[#009688] shadow-2xs cursor-pointer"
            >
              {monthsList.map((m, idx) => (
                <option key={m} value={idx}>
                  {m} de {selectedYear}
                </option>
              ))}
            </select>
            <CalendarIcon className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Botão Imprimir Geral (Borda azul clara/sky conforme print) */}
          <button
            type="button"
            onClick={() => handleOpenPrintModal()}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-sky-400 dark:border-sky-700 text-sky-700 dark:text-sky-300 bg-white dark:bg-stone-900 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>Imprimir Geral</span>
          </button>

        </div>
      </div>

      {/* 2. Barra de Navegação de Abas (Sub-tabs) */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-lg border border-slate-400 dark:border-stone-800 p-1.5 shadow-sm flex items-center gap-1.5 overflow-x-auto scrollbar-none text-black dark:text-white">
        {navSubTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`
                inline-flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition cursor-pointer
                ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-black dark:text-stone-400 hover:text-black dark:hover:text-stone-200 hover:bg-black/10 dark:hover:bg-stone-800'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Conteúdo da Aba Ativa */}
      {activeSubTab === 'dashboard' && (
        <ReportsDashboardTab
          expenses={expenses}
          orders={orders}
          services={services}
          fuelLogs={fuelLogs}
          quickPeriod={quickPeriod}
          onQuickPeriodChange={handleQuickPeriodChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          selectedMonthName={monthsList[selectedMonth]}
          selectedYear={selectedYear}
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
          onOpenPrintModal={(html, whatsapp) => handleOpenPrintModal(html, whatsapp)}
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
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeSubTab === 'cortes' && (
        <ReportsCortesTab
          services={services}
          orders={orders}
          seasons={seasons}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeSubTab === 'vendas' && (
        <ReportsVendasTab
          orders={orders}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeSubTab === 'despesas' && (
        <ReportsDespesasTab
          expenses={expenses}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeSubTab === 'consumo' && (
        <ReportsConsumoTab
          fuelLogs={fuelLogs}
          machineries={machineries}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {activeSubTab === 'imobilizado' && (
        <ReportsAtivoImobilizadoTab
          machineries={machineries}
          companyProfile={companyProfile}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* Modal de Impressão e PDF */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setCustomPrintHtml(null);
          setCustomWhatsAppText(null);
        }}
        options={{
          title: 'Relatório Executivo Consolidado de Silagem',
          subtitle: `Demonstrativo contábil, operacional e de custos da safra (${formatDateBR(startDate)} a ${formatDateBR(endDate)})`,
          documentType: 'RELATÓRIO CONSOLIDADO',
          company: companyProfile,
          contentHtml: customPrintHtml || generalPrintHtml,
          signatureLabels: ['Diretoria Financeira / Controladoria', 'Gerência de Operações Agrícolas'],
          whatsappText: customWhatsAppText || generalWhatsAppText,
        }}
      />

    </div>
  );
};
