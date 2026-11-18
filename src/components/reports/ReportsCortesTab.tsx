import React, { useState, useMemo, useEffect } from 'react';
import { 
  Scissors, 
  Search, 
  Download, 
  Tractor, 
  Scale,
  DollarSign
} from 'lucide-react';
import { CompanyProfile, ServiceOrder, SilageOrder, CropSeason } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { 
  CompetenceSelector, 
  getPrevCompetence, 
  getNextCompetence 
} from '../financial/CompetenceSelector';
import {
  buildCortesServicesReport,
  buildSyntheticSummaryRows,
  ReportPrintConfig,
  ReportViewMode,
  resolveReportSegmentContext,
} from './reportPrintBuilders';
import { ReportViewModeToggle } from './ReportViewModeToggle';

interface ReportsCortesTabProps {
  services: ServiceOrder[];
  orders: SilageOrder[];
  seasons?: CropSeason[];
  companyProfile?: CompanyProfile;
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onStartDateChange?: (d: string) => void;
  onEndDateChange?: (d: string) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

export const ReportsCortesTab: React.FC<ReportsCortesTabProps> = ({
  services,
  companyProfile = {} as CompanyProfile,
  startDate,
  endDate,
  competence,
  onCompetenceChange,
  onRegisterPrintGetter,
}) => {
  const segmentCtx = useMemo(() => resolveReportSegmentContext(companyProfile), [companyProfile]);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<ReportViewMode>('analitico');
  const [groupBy, setGroupBy] = useState<'cliente' | 'servico' | 'maquina'>('cliente');

  const groupByLabel = useMemo(() => {
    if (groupBy === 'servico') return 'Tipo de Serviço';
    if (groupBy === 'maquina') return 'Máquina / Equipamento';
    return 'Cliente / Produtor';
  }, [groupBy]);

  // Filtered Services (Cortes / Colheita de Silagem)
  const filteredServices = useMemo(() => {
    const term = String(searchTerm ?? '').toLowerCase().trim();
    const fType = String(filterType ?? '').toLowerCase().trim();
    return (services || []).filter(s => {
      const matchDate = s?.startDate ? (s.startDate >= startDate && s.startDate <= endDate) : false;
      const matchSearch = !term ||
        Boolean(String(s.clientName ?? '').toLowerCase().includes(term)) ||
        Boolean(String(s.farmName ?? '').toLowerCase().includes(term)) ||
        Boolean(String(s.machineryAssigned ?? '').toLowerCase().includes(term)) ||
        Boolean(String(s.serviceType ?? '').toLowerCase().includes(term));
      const matchType = fType === 'todos' || Boolean(String(s.serviceType ?? '').toLowerCase().includes(fType));
      return matchDate && matchSearch && matchType;
    });
  }, [services, startDate, endDate, searchTerm, filterType]);

  // KPIs
  const totalHectares = filteredServices.reduce((sum, s) => sum + (s.areaHectares || 0), 0);
  const totalTonsEstimated = filteredServices.reduce((sum, s) => sum + (s.tonsEstimated || 0), 0);
  const totalServicesRevenue = filteredServices.reduce((sum, s) => sum + s.totalAmount, 0);
  const averageTonsPerHa = totalHectares > 0 ? (totalTonsEstimated / totalHectares) : 0;
  const averagePricePerHa = totalHectares > 0 ? (totalServicesRevenue / totalHectares) : 0;

  const syntheticRows = useMemo(() => {
    return buildSyntheticSummaryRows(
      filteredServices,
      (s) => {
        if (groupBy === 'servico') return s.serviceType || 'Serviço N/I';
        if (groupBy === 'maquina') return s.machineryAssigned || 'Não informada';
        return s.clientName || 'Cliente N/I';
      },
      (s) => s.totalAmount || 0,
      {
        getSecondarySum: (s) => s.areaHectares || 0,
        formatSecondary: (ha) => `${ha.toFixed(1)} ha`,
      }
    );
  }, [filteredServices, groupBy]);

  const printConfig = useMemo(
    () =>
      buildCortesServicesReport({
        companyProfile,
        filteredServices,
        startDate,
        endDate,
        competence: activeCompetence,
        searchTerm,
        filterType,
        viewMode,
        groupByLabel,
        syntheticRows,
      }),
    [companyProfile, filteredServices, startDate, endDate, activeCompetence, searchTerm, filterType, viewMode, groupByLabel, syntheticRows]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  const handleExportCsv = () => {
    if (viewMode === 'sintetico') {
      const headers = `${groupByLabel.replace(/[^a-zA-Z0-9]/g, '_')},Qtd_Servicos,Area_ha,Valor_Total,Ticket_Medio,Participacao_Pct\n`;
      const rows = syntheticRows
        .map(
          (r) =>
            `"${r.groupKey}","${r.count}","${r.secondaryMetric || '0.0 ha'}","${r.totalAmount.toFixed(2)}","${r.avgTicket.toFixed(2)}","${r.sharePct.toFixed(1)}%"`
        )
        .join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_servicos_sintetico_${startDate}_a_${endDate}.csv`;
      link.click();
      return;
    }

    const headers = 'Data,Cliente,Fazenda,Servico,Area_Hectares,Toneladas_Estimadas,Maquina,Operador,Valor_Total,Status\n';
    const rows = filteredServices.map(s => 
      `"${s.startDate}","${s.clientName}","${s.farmName || ''}","${s.serviceType}","${s.areaHectares || 0}","${s.tonsEstimated || 0}","${s.machineryAssigned || ''}","${s.operatorAssigned || ''}","${s.totalAmount}","${s.status}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_servicos_${startDate}_a_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in financial-subtab-clean">
      
      {/* 1. Cards de Resumo Finos e Compactos */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        
        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-[#009688] shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-[#009688] flex items-center justify-center shrink-0 border border-black/15">
            <Scissors className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Área Total Cortada
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] leading-tight truncate">
                {totalHectares.toFixed(1)} ha
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                {filteredServices.length} talhões/serviços
              </div>
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 border border-black/15">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Volume Estimado
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] leading-tight truncate">
                {totalTonsEstimated.toFixed(0)} ton
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                Média: {averageTonsPerHa.toFixed(1)} ton/ha
              </div>
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center shrink-0 border border-black/15">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Faturamento Serviços
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-sky-700 dark:text-sky-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(totalServicesRevenue)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                {filteredServices.filter(s => s.status === 'concluido').length} concluídos
              </div>
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
            <Tractor className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Média R$ / Hectare
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(averagePricePerHa)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                Receita média por ha
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Filtros, Busca, Competência e Exportação */}
      <div className="reports-filter-bar shrink-0 bg-[#cad4e6] dark:bg-stone-900 px-3 py-2 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, fazenda ou máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688]"
          >
            <option value="todos">Todos os tipos de serviço</option>
            <option value="Ensilagem">Ensilagem</option>
            <option value="Colheita">Colheita</option>
            <option value="Compactação">Compactação de Silo</option>
            <option value="Plantio">Plantio</option>
          </select>

          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          <ReportViewModeToggle
            viewMode={viewMode}
            onChange={setViewMode}
            groupBy={groupBy}
            groupOptions={[
              { value: 'cliente', label: 'Cliente / Produtor' },
              { value: 'servico', label: 'Tipo de Serviço' },
              { value: 'maquina', label: 'Máquina / Equipamento' },
            ]}
            onGroupByChange={(val) => setGroupBy(val as 'cliente' | 'servico' | 'maquina')}
          />

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-[#e0e6f1] dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-[#d2dced] dark:hover:bg-stone-700 border border-black dark:border-stone-700 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Cortes (CSV)</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {viewMode === 'sintetico' ? (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">{groupByLabel}</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-center">Qtd. Serviços</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Área Total (ha)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Valor Total (R$)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Ticket Médio</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Participação</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {syntheticRows.length > 0 ? (
                  syntheticRows.map((row) => (
                    <tr key={row.groupKey} className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                      <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">{row.groupKey}</td>
                      <td className="py-2.5 px-3.5 text-center font-bold text-stone-700 dark:text-stone-300">{row.count}</td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-stone-800 dark:text-stone-200">{row.secondaryMetric || '-'}</td>
                      <td className="py-2.5 px-3.5 text-right font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatCurrencyBRL(row.totalAmount)}</td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-stone-700 dark:text-stone-300 whitespace-nowrap">{formatCurrencyBRL(row.avgTicket)}</td>
                      <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">{row.sharePct.toFixed(1)}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
                      {segmentCtx.servicesEmptyText}
                    </td>
                  </tr>
                )}
              </tbody>
              {syntheticRows.length > 0 && (
                <tfoot className="bg-[#cad4e6] dark:bg-stone-800 font-black text-xs border-t-2 border-black dark:border-stone-700">
                  <tr>
                    <td className="py-2.5 px-3.5 uppercase">Total Consolidado ({syntheticRows.length} grupos)</td>
                    <td className="py-2.5 px-3.5 text-center">{filteredServices.length}</td>
                    <td className="py-2.5 px-3.5 text-right">{totalHectares.toFixed(1)} ha</td>
                    <td className="py-2.5 px-3.5 text-right text-emerald-800 dark:text-emerald-300">{formatCurrencyBRL(totalServicesRevenue)}</td>
                    <td className="py-2.5 px-3.5 text-right">{formatCurrencyBRL(filteredServices.length > 0 ? totalServicesRevenue / filteredServices.length : 0)}</td>
                    <td className="py-2.5 px-3.5 text-right">100.0%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Data Início</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Cliente / Produtor</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Fazenda / Local</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Serviço</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Área (ha)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Volume Est. (ton)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Máquina / Ensiladeira</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Valor Total (R$)</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {filteredServices.length > 0 ? (
                  filteredServices.map((item) => (
                    <tr key={item.id} className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-700 dark:text-stone-400">
                        {formatDateBR(item.startDate)}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                        {item.clientName}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                        {item.farmName || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-stone-800 dark:text-stone-300">
                        {item.serviceType}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">
                        {item.areaHectares ? `${item.areaHectares} ha` : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        {item.tonsEstimated ? `${item.tonsEstimated} t` : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-400">
                        {item.machineryAssigned || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100 whitespace-nowrap">
                        {formatCurrencyBRL(item.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.status === 'concluido'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : item.status === 'em_andamento'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
                      {segmentCtx.servicesEmptyText}
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
