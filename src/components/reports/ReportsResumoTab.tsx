import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  MessageCircle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Expense, SilageOrder, ServiceOrder, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface ReportsResumoTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  companyProfile: CompanyProfile;
  startDate: string;
  endDate: string;
  onOpenPrintModal: (html: string, whatsappText: string) => void;
}

export const ReportsResumoTab: React.FC<ReportsResumoTabProps> = ({
  expenses,
  orders,
  services,
  companyProfile,
  startDate,
  endDate,
  onOpenPrintModal,
}) => {
  // Period filter
  const filteredOrders = orders.filter(o => o.deliveryDate >= startDate && o.deliveryDate <= endDate && o.status !== 'cancelado');
  const filteredServices = services.filter(s => s.startDate >= startDate && s.startDate <= endDate && s.status !== 'cancelado');
  const filteredExpenses = expenses.filter(e => e.dueDate >= startDate && e.dueDate <= endDate);

  // Totals
  const ordersRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const servicesRevenue = filteredServices.reduce((sum, s) => sum + s.totalAmount, 0);
  const grossRevenue = ordersRevenue + servicesRevenue;

  // Categories breakdown
  const fuelExpense = filteredExpenses.filter(e => e.categoryId === 'cat_combustivel' || e.categoryName.toLowerCase().includes('combust') || e.categoryName.toLowerCase().includes('diesel')).reduce((sum, e) => sum + e.amount, 0);
  const maintenanceExpense = filteredExpenses.filter(e => e.categoryId === 'cat_manutencao' || e.categoryName.toLowerCase().includes('manuten') || e.categoryName.toLowerCase().includes('peça')).reduce((sum, e) => sum + e.amount, 0);
  const inputsExpense = filteredExpenses.filter(e => e.categoryId === 'cat_insumos' || e.categoryName.toLowerCase().includes('insumo') || e.categoryName.toLowerCase().includes('sement') || e.categoryName.toLowerCase().includes('inocul')).reduce((sum, e) => sum + e.amount, 0);
  const laborExpense = filteredExpenses.filter(e => e.categoryId === 'cat_mao_de_obra' || e.categoryName.toLowerCase().includes('mão') || e.categoryName.toLowerCase().includes('salár') || e.categoryName.toLowerCase().includes('diária')).reduce((sum, e) => sum + e.amount, 0);
  const packagingExpense = filteredExpenses.filter(e => e.categoryId === 'cat_lona_embalagem' || e.categoryName.toLowerCase().includes('lona') || e.categoryName.toLowerCase().includes('embalag')).reduce((sum, e) => sum + e.amount, 0);
  const freightExpense = filteredExpenses.filter(e => e.categoryId === 'cat_frete' || e.categoryName.toLowerCase().includes('frete') || e.categoryName.toLowerCase().includes('transp')).reduce((sum, e) => sum + e.amount, 0);
  
  const categorizedSum = fuelExpense + maintenanceExpense + inputsExpense + laborExpense + packagingExpense + freightExpense;
  const otherExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0) - categorizedSum;
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const netResult = grossRevenue - totalExpenses;
  const marginPercent = grossRevenue > 0 ? (netResult / grossRevenue) * 100 : 0;

  // Build Print HTML
  const dreHtml = useMemo(() => {
    return `
      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px; margin-bottom:16px;">
        <table style="width:100%; border:none; margin:0;">
          <tr style="background:transparent;">
            <td style="border:none; padding:4px 8px; font-size:11pt;"><strong>Receita Operacional Bruta:</strong></td>
            <td style="border:none; padding:4px 8px; text-align:right; color:#047857; font-weight:bold; font-size:12pt;">${formatCurrencyBRL(grossRevenue)}</td>
          </tr>
          <tr style="background:transparent;">
            <td style="border:none; padding:4px 8px; font-size:11pt;"><strong>Despesas Operacionais Totais:</strong></td>
            <td style="border:none; padding:4px 8px; text-align:right; color:#b91c1c; font-weight:bold; font-size:12pt;">${formatCurrencyBRL(totalExpenses)}</td>
          </tr>
          <tr style="background:#e2e8f0; font-weight:bold;">
            <td style="border:none; padding:8px; font-size:11pt;">Resultado Líquido do Período:</td>
            <td style="border:none; padding:8px; text-align:right; color:${netResult >= 0 ? '#047857' : '#b91c1c'}; font-size:13pt; font-weight:900;">${formatCurrencyBRL(netResult)} (${marginPercent.toFixed(1)}%)</td>
          </tr>
        </table>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-top:12px;">
        <thead>
          <tr style="background:#0f172a; color:#ffffff;">
            <th style="padding:8px 12px; text-align:left;">Conta / Descritivo Contábil</th>
            <th style="padding:8px 12px; text-align:right;">Valor Realizado</th>
            <th style="padding:8px 12px; text-align:right;">% Rec.</th>
          </tr>
        </thead>
        <tbody>
          <tr style="font-weight:bold; background:#ecfdf5;">
            <td style="padding:8px 12px;">(+) RECEITA COM VENDAS DE SILAGEM</td>
            <td style="padding:8px 12px; text-align:right; color:#047857;">${formatCurrencyBRL(ordersRevenue)}</td>
            <td style="padding:8px 12px; text-align:right;">${grossRevenue > 0 ? ((ordersRevenue / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr style="font-weight:bold; background:#ecfdf5;">
            <td style="padding:8px 12px;">(+) RECEITA COM PRESTAÇÃO DE SERVIÇOS (COLHEITA / ENSILAGEM)</td>
            <td style="padding:8px 12px; text-align:right; color:#047857;">${formatCurrencyBRL(servicesRevenue)}</td>
            <td style="padding:8px 12px; text-align:right;">${grossRevenue > 0 ? ((servicesRevenue / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr style="font-weight:900; background:#e2e8f0;">
            <td style="padding:8px 12px;">(=) RECEITA OPERACIONAL BRUTA</td>
            <td style="padding:8px 12px; text-align:right; color:#047857;">${formatCurrencyBRL(grossRevenue)}</td>
            <td style="padding:8px 12px; text-align:right;">100.0%</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; padding-left:24px;">(-) Combustível, Diesel S10 & Arla</td>
            <td style="padding:6px 12px; text-align:right; color:#b91c1c;">${formatCurrencyBRL(fuelExpense)}</td>
            <td style="padding:6px 12px; text-align:right;">${grossRevenue > 0 ? ((fuelExpense / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; padding-left:24px;">(-) Manutenção de Ensiladeiras & Tratores</td>
            <td style="padding:6px 12px; text-align:right; color:#b91c1c;">${formatCurrencyBRL(maintenanceExpense)}</td>
            <td style="padding:6px 12px; text-align:right;">${grossRevenue > 0 ? ((maintenanceExpense / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; padding-left:24px;">(-) Insumos, Inoculantes & Sementes</td>
            <td style="padding:6px 12px; text-align:right; color:#b91c1c;">${formatCurrencyBRL(inputsExpense)}</td>
            <td style="padding:6px 12px; text-align:right;">${grossRevenue > 0 ? ((inputsExpense / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; padding-left:24px;">(-) Mão de Obra, Diárias & Operadores</td>
            <td style="padding:6px 12px; text-align:right; color:#b91c1c;">${formatCurrencyBRL(laborExpense)}</td>
            <td style="padding:6px 12px; text-align:right;">${grossRevenue > 0 ? ((laborExpense / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; padding-left:24px;">(-) Lonas, Embalagens & Fechamento de Silo</td>
            <td style="padding:6px 12px; text-align:right; color:#b91c1c;">${formatCurrencyBRL(packagingExpense)}</td>
            <td style="padding:6px 12px; text-align:right;">${grossRevenue > 0 ? ((packagingExpense / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; padding-left:24px;">(-) Fretes & Logística de Transporte</td>
            <td style="padding:6px 12px; text-align:right; color:#b91c1c;">${formatCurrencyBRL(freightExpense)}</td>
            <td style="padding:6px 12px; text-align:right;">${grossRevenue > 0 ? ((freightExpense / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr>
            <td style="padding:6px 12px; padding-left:24px;">(-) Outras Despesas Gerais & Administrativas</td>
            <td style="padding:6px 12px; text-align:right; color:#b91c1c;">${formatCurrencyBRL(otherExpenses > 0 ? otherExpenses : 0)}</td>
            <td style="padding:6px 12px; text-align:right;">${grossRevenue > 0 ? (((otherExpenses > 0 ? otherExpenses : 0) / grossRevenue) * 100).toFixed(1) : 0}%</td>
          </tr>
          <tr style="font-weight:900; background:#dcfce7; font-size:11pt; border-top:2px solid #047857;">
            <td style="padding:10px 12px;">(=) RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO OPERACIONAL)</td>
            <td style="padding:10px 12px; text-align:right; color:${netResult >= 0 ? '#047857' : '#b91c1c'};">${formatCurrencyBRL(netResult)}</td>
            <td style="padding:10px 12px; text-align:right; color:${netResult >= 0 ? '#047857' : '#b91c1c'};">${marginPercent.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    `;
  }, [grossRevenue, totalExpenses, netResult, marginPercent, ordersRevenue, servicesRevenue, fuelExpense, maintenanceExpense, inputsExpense, laborExpense, packagingExpense, freightExpense, otherExpenses]);

  // WhatsApp text
  const whatsappText = useMemo(() => {
    let msg = `📊 *${companyProfile?.tradeName?.toUpperCase() || 'SILAGEM FÁCIL PRO'}*\n`;
    msg += `📑 *RESUMO GERAL / DRE OPERACIONAL*\n`;
    msg += `📅 *Período:* ${formatDateBR(startDate)} até ${formatDateBR(endDate)}\n\n`;
    msg += `💰 *RECEITA BRUTA:* ${formatCurrencyBRL(grossRevenue)}\n`;
    msg += `  • Vendas de Silagem: ${formatCurrencyBRL(ordersRevenue)}\n`;
    msg += `  • Prestação de Serviços: ${formatCurrencyBRL(servicesRevenue)}\n\n`;
    msg += `💸 *DESPESAS OPERACIONAIS:* ${formatCurrencyBRL(totalExpenses)}\n`;
    msg += `  • Diesel / Combustível: ${formatCurrencyBRL(fuelExpense)}\n`;
    msg += `  • Manutenção & Peças: ${formatCurrencyBRL(maintenanceExpense)}\n`;
    msg += `  • Insumos / Sementes: ${formatCurrencyBRL(inputsExpense)}\n`;
    msg += `  • Mão de Obra / Diárias: ${formatCurrencyBRL(laborExpense)}\n`;
    msg += `  • Outros Custos: ${formatCurrencyBRL(packagingExpense + freightExpense + otherExpenses)}\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🟢 *RESULTADO LÍQUIDO:* ${formatCurrencyBRL(netResult)}\n`;
    msg += `📈 *Margem Líquida:* ${marginPercent.toFixed(1)}%\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    return msg;
  }, [companyProfile, startDate, endDate, grossRevenue, ordersRevenue, servicesRevenue, totalExpenses, fuelExpense, maintenanceExpense, inputsExpense, laborExpense, packagingExpense, freightExpense, otherExpenses, netResult, marginPercent]);

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Action Header */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#009688]" />
            <span>Demonstrativo do Resultado do Exercício (DRE Sintético e Analítico)</span>
          </h3>
          <p className="text-xs text-stone-500">
            Período filtrado: {formatDateBR(startDate)} a {formatDateBR(endDate)}
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onOpenPrintModal(dreHtml, whatsappText)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold text-xs hover:bg-emerald-100 transition cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Enviar WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPrintModal(dreHtml, whatsappText)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#009688] hover:bg-[#00796b] text-white font-bold text-xs transition shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir DRE</span>
          </button>
        </div>
      </div>

      {/* DRE Sintética Box */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        
        <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs sm:text-sm">
          
          {/* Receitas */}
          <div className="py-3 flex justify-between items-center font-bold text-stone-900 dark:text-stone-100">
            <span className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>(+) RECEITA COM VENDAS DE SILAGEM</span>
            </span>
            <span className="text-emerald-600 font-extrabold">{formatCurrencyBRL(ordersRevenue)}</span>
          </div>

          <div className="py-3 flex justify-between items-center font-bold text-stone-900 dark:text-stone-100">
            <span className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>(+) RECEITA COM PRESTAÇÃO DE SERVIÇOS AGRÍCOLAS</span>
            </span>
            <span className="text-emerald-600 font-extrabold">{formatCurrencyBRL(servicesRevenue)}</span>
          </div>

          {/* Subtotal Receita */}
          <div className="py-3 px-3 flex justify-between items-center font-black bg-stone-50 dark:bg-stone-800/60 rounded-xl">
            <span className="text-stone-900 dark:text-stone-100">(=) RECEITA OPERACIONAL BRUTA</span>
            <span className="text-emerald-600 text-base">{formatCurrencyBRL(grossRevenue)}</span>
          </div>

          {/* Despesas Discriminadas */}
          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) Combustível, Diesel S10 & Arla</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(fuelExpense)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) Manutenção, Peças & Mecânica</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(maintenanceExpense)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) Insumos, Inoculantes & Sementes</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(inputsExpense)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) Mão de Obra, Operadores & Diárias de Safra</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(laborExpense)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) Lonas, Embalagens & Fechamento de Silo</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(packagingExpense)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) Fretes & Logística de Caminhão</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(freightExpense)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) Despesas Administrativas e Outros Custos</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(otherExpenses > 0 ? otherExpenses : 0)}</span>
          </div>

          {/* Resultado Líquido */}
          <div className="py-4 px-4 mt-2 flex justify-between items-center font-black text-sm sm:text-base bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <span className="text-stone-900 dark:text-stone-100">(=) RESULTADO OPERACIONAL LÍQUIDO</span>
            <div className="text-right">
              <span className={netResult >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600'}>
                {formatCurrencyBRL(netResult)}
              </span>
              <span className="text-xs font-semibold block text-stone-500">
                Margem: {marginPercent.toFixed(1)}%
              </span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
