import React, { useEffect, useMemo } from 'react';
import {
  FileText,
  Printer,
  MessageCircle,
} from 'lucide-react';
import { Expense, SilageOrder, ServiceOrder, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import {
  CompetenceSelector,
  getPrevCompetence,
  getNextCompetence,
} from '../financial/CompetenceSelector';
import {
  buildResumoDreReport,
  classifyDreExpenses,
  ReportPrintConfig,
  resolveReportSegmentContext,
} from './reportPrintBuilders';

interface ReportsResumoTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  companyProfile: CompanyProfile;
  startDate: string;
  endDate: string;
  onOpenPrintModal: (config: ReportPrintConfig) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onStartDateChange?: (d: string) => void;
  onEndDateChange?: (d: string) => void;
}

export const ReportsResumoTab: React.FC<ReportsResumoTabProps> = ({
  expenses,
  orders,
  services,
  companyProfile,
  startDate,
  endDate,
  onOpenPrintModal,
  onRegisterPrintGetter,
  competence,
  onCompetenceChange,
}) => {
  const activeCompetence = useMemo(() => {
    if (competence) return competence;
    if (startDate && startDate.length >= 7) {
      const [y, m] = startDate.split('-');
      return `${m}/${y}`;
    }
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence, startDate]);

  const handlePrev = () => {
    const nextComp = getPrevCompetence(activeCompetence);
    onCompetenceChange?.(nextComp);
  };

  const handleNext = () => {
    const nextComp = getNextCompetence(activeCompetence);
    onCompetenceChange?.(nextComp);
  };

  const segmentCtx = useMemo(
    () => resolveReportSegmentContext(companyProfile),
    [companyProfile]
  );

  const filteredOrders = useMemo(
    () =>
      (orders || []).filter(
        (o) =>
          o?.deliveryDate &&
          o.deliveryDate >= startDate &&
          o.deliveryDate <= endDate &&
          o.status !== 'cancelado'
      ),
    [orders, startDate, endDate]
  );

  const filteredServices = useMemo(
    () =>
      (services || []).filter(
        (s) =>
          s?.startDate &&
          s.startDate >= startDate &&
          s.startDate <= endDate &&
          s.status !== 'cancelado'
      ),
    [services, startDate, endDate]
  );

  const filteredExpenses = useMemo(
    () =>
      (expenses || []).filter(
        (e) => e?.dueDate && e.dueDate >= startDate && e.dueDate <= endDate
      ),
    [expenses, startDate, endDate]
  );

  const ordersRevenue = useMemo(
    () => filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    [filteredOrders]
  );
  const servicesRevenue = useMemo(
    () => filteredServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0),
    [filteredServices]
  );
  const grossRevenue = ordersRevenue + servicesRevenue;

  const cats = useMemo(
    () => classifyDreExpenses(filteredExpenses),
    [filteredExpenses]
  );

  const netResult = grossRevenue - cats.total;
  const marginPercent = grossRevenue > 0 ? (netResult / grossRevenue) * 100 : 0;

  const drePrintConfig = useMemo(
    () =>
      buildResumoDreReport({
        companyProfile,
        orders,
        services,
        expenses,
        startDate,
        endDate,
        competence: activeCompetence,
      }),
    [companyProfile, orders, services, expenses, startDate, endDate, activeCompetence]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => drePrintConfig);
  }, [onRegisterPrintGetter, drePrintConfig]);

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
            Período filtrado: {formatDateBR(startDate)} a {formatDateBR(endDate)} • Competência {activeCompetence}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          <button
            type="button"
            onClick={() => onOpenPrintModal(drePrintConfig)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold text-xs hover:bg-emerald-100 transition cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Enviar WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPrintModal(drePrintConfig)}
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
              <span>(+) {segmentCtx.ordersRevenueLabel.toUpperCase()}</span>
            </span>
            <span className="text-emerald-600 font-extrabold">{formatCurrencyBRL(ordersRevenue)}</span>
          </div>

          <div className="py-3 flex justify-between items-center font-bold text-stone-900 dark:text-stone-100">
            <span className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>(+) {segmentCtx.servicesRevenueLabel.toUpperCase()}</span>
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
            <span>(-) {segmentCtx.dreCategoryLabels.fuel}</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(cats.fuel)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) {segmentCtx.dreCategoryLabels.maintenance}</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(cats.maintenance)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) {segmentCtx.dreCategoryLabels.inputs}</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(cats.inputs)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) {segmentCtx.dreCategoryLabels.labor}</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(cats.labor)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) {segmentCtx.dreCategoryLabels.packaging}</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(cats.packaging)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) {segmentCtx.dreCategoryLabels.freight}</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(cats.freight)}</span>
          </div>

          <div className="py-2.5 pl-4 flex justify-between text-stone-600 dark:text-stone-400">
            <span>(-) {segmentCtx.dreCategoryLabels.other}</span>
            <span className="text-rose-600 font-bold">{formatCurrencyBRL(cats.other)}</span>
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
