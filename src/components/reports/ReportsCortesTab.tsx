import React, { useState, useMemo } from 'react';
import { 
  Scissors, 
  Search, 
  Download, 
  Printer, 
  Tractor, 
  Calendar, 
  MapPin, 
  Layers, 
  Scale,
  DollarSign
} from 'lucide-react';
import { ServiceOrder, SilageOrder, CropSeason } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { 
  CompetenceSelector, 
  getPrevCompetence, 
  getNextCompetence 
} from '../financial/CompetenceSelector';

interface ReportsCortesTabProps {
  services: ServiceOrder[];
  orders: SilageOrder[];
  seasons?: CropSeason[];
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onStartDateChange?: (d: string) => void;
  onEndDateChange?: (d: string) => void;
}

export const ReportsCortesTab: React.FC<ReportsCortesTabProps> = ({
  services,
  orders,
  seasons = [],
  startDate,
  endDate,
  competence,
  onCompetenceChange,
  onStartDateChange,
  onEndDateChange,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');

  // Filtered Services (Cortes / Colheita de Silagem)
  const filteredServices = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();
    const fType = (filterType || '').toLowerCase().trim();
    return (services || []).filter(s => {
      const matchDate = s?.startDate ? (s.startDate >= startDate && s.startDate <= endDate) : false;
      const matchSearch = !term ||
        Boolean(s.clientName?.toLowerCase().includes(term)) ||
        Boolean(s.farmName?.toLowerCase().includes(term)) ||
        Boolean(s.machineryAssigned?.toLowerCase().includes(term)) ||
        Boolean(s.serviceType?.toLowerCase().includes(term));
      const matchType = fType === 'todos' || Boolean(s.serviceType?.toLowerCase().includes(fType));
      return matchDate && matchSearch && matchType;
    });
  }, [services, startDate, endDate, searchTerm, filterType]);

  // KPIs
  const totalHectares = filteredServices.reduce((sum, s) => sum + (s.areaHectares || 0), 0);
  const totalTonsEstimated = filteredServices.reduce((sum, s) => sum + (s.tonsEstimated || 0), 0);
  const totalServicesRevenue = filteredServices.reduce((sum, s) => sum + s.totalAmount, 0);
  const averageTonsPerHa = totalHectares > 0 ? (totalTonsEstimated / totalHectares) : 0;
  const averagePricePerHa = totalHectares > 0 ? (totalServicesRevenue / totalHectares) : 0;

  const handleExportCsv = () => {
    const headers = 'Data,Cliente,Fazenda,Servico,Area_Hectares,Toneladas_Estimadas,Maquina,Operador,Valor_Total,Status\n';
    const rows = filteredServices.map(s => 
      `"${s.startDate}","${s.clientName}","${s.farmName || ''}","${s.serviceType}","${s.areaHectares || 0}","${s.tonsEstimated || 0}","${s.machineryAssigned || ''}","${s.operatorAssigned || ''}","${s.totalAmount}","${s.status}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_cortes_silagem_${startDate}_a_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-2.5 animate-fade-in financial-subtab-clean">
      
      {/* 1. Cards de Resumo Finos e Compactos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        
        <div className="bg-white dark:bg-stone-900 rounded-xl py-2 px-3 border border-stone-200 dark:border-stone-800 border-l-[3px] border-l-[#009688] shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-[#009688] flex items-center justify-center shrink-0">
            <Scissors className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block leading-tight truncate">
              Área Total Cortada
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] leading-tight truncate">
                {totalHectares.toFixed(1)} ha
              </div>
              <div className="text-[10px] text-stone-500 leading-tight truncate">
                {filteredServices.length} talhões/serviços
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-xl py-2 px-3 border border-stone-200 dark:border-stone-800 border-l-[3px] border-l-emerald-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block leading-tight truncate">
              Volume Estimado
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-['Outfit'] leading-tight truncate">
                {totalTonsEstimated.toFixed(0)} ton
              </div>
              <div className="text-[10px] text-stone-500 leading-tight truncate">
                Média: {averageTonsPerHa.toFixed(1)} ton/ha
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-xl py-2 px-3 border border-stone-200 dark:border-stone-800 border-l-[3px] border-l-sky-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block leading-tight truncate">
              Faturamento Cortes
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-sky-600 dark:text-sky-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(totalServicesRevenue)}
              </div>
              <div className="text-[10px] text-stone-500 leading-tight truncate">
                {filteredServices.filter(s => s.status === 'concluido').length} concluídos
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-xl py-2 px-3 border border-stone-200 dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
            <Tractor className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block leading-tight truncate">
              Média R$ / Hectare
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(averagePricePerHa)}
              </div>
              <div className="text-[10px] text-stone-500 leading-tight truncate">
                Receita média por ha
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Filtros, Busca, Competência e Exportação */}
      <div className="bg-white dark:bg-stone-900 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, fazenda ou máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688]"
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

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Cortes (CSV)</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela */}
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider border-b border-slate-300 dark:border-stone-700 shadow-sm">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Data Início</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Cliente / Produtor</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Fazenda / Local</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Serviço</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-right">Área (ha)</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-right">Volume Est. (ton)</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5">Máquina / Ensiladeira</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-right">Valor Total (R$)</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-3 px-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredServices.length > 0 ? (
                filteredServices.map((item) => (
                  <tr key={item.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-600 dark:text-stone-400">
                      {formatDateBR(item.startDate)}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                      {item.clientName}
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
                      {item.farmName || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-stone-700 dark:text-stone-300">
                      {item.serviceType}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">
                      {item.areaHectares ? `${item.areaHectares} ha` : '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.tonsEstimated ? `${item.tonsEstimated} t` : '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">
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
                  <td colSpan={9} className="py-8 text-center text-stone-400">
                    Nenhum registro de corte ou serviço de colheita no período filtrado.
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
