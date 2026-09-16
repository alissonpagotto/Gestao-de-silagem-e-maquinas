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

interface ReportsCortesTabProps {
  services: ServiceOrder[];
  orders: SilageOrder[];
  seasons?: CropSeason[];
  startDate: string;
  endDate: string;
}

export const ReportsCortesTab: React.FC<ReportsCortesTabProps> = ({
  services,
  orders,
  seasons = [],
  startDate,
  endDate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');

  // Filtered Services (Cortes / Colheita de Silagem)
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      const matchDate = s.startDate >= startDate && s.startDate <= endDate;
      const matchSearch = 
        s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.farmName && s.farmName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.machineryAssigned && s.machineryAssigned.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.serviceType && s.serviceType.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = filterType === 'todos' || s.serviceType.toLowerCase().includes(filterType.toLowerCase());
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
    <div className="space-y-4 sm:space-y-6">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 flex items-center justify-center text-[#009688]">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Relatório de Cortes & Colheita de Silagem
            </h3>
            <p className="text-xs text-stone-500">
              Controle de áreas ensiladas, produtividade por talhão e faturamento de prestação de serviços
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar Cortes (CSV)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-[#009688]">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Área Total Cortada</span>
          <div className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-100 mt-0.5">
            {totalHectares.toFixed(1)} ha
          </div>
          <span className="text-[10px] text-stone-400">{filteredServices.length} talhões/serviços</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-emerald-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Volume Estimado</span>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {totalTonsEstimated.toFixed(0)} ton
          </div>
          <span className="text-[10px] text-stone-400">Média: {averageTonsPerHa.toFixed(1)} ton/ha</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-sky-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Faturamento Cortes</span>
          <div className="text-lg sm:text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
            {formatCurrencyBRL(totalServicesRevenue)}
          </div>
          <span className="text-[10px] text-stone-400">{filteredServices.filter(s => s.status === 'concluido').length} concluídos</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-amber-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Média R$ / Hectare</span>
          <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {formatCurrencyBRL(averagePricePerHa)}
          </div>
          <span className="text-[10px] text-stone-400">Receita média por ha</span>
        </div>

      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, fazenda ou máquina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-[#009688]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
          >
            <option value="todos">Todos os tipos de serviço</option>
            <option value="Ensilagem">Ensilagem</option>
            <option value="Colheita">Colheita</option>
            <option value="Compactação">Compactação de Silo</option>
            <option value="Plantio">Plantio</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-800/70 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="py-3 px-3.5">Data Início</th>
                <th className="py-3 px-3.5">Cliente / Produtor</th>
                <th className="py-3 px-3.5">Fazenda / Local</th>
                <th className="py-3 px-3.5">Serviço</th>
                <th className="py-3 px-3.5 text-right">Área (ha)</th>
                <th className="py-3 px-3.5 text-right">Volume Est. (ton)</th>
                <th className="py-3 px-3.5">Máquina / Ensiladeira</th>
                <th className="py-3 px-3.5 text-right">Valor Total (R$)</th>
                <th className="py-3 px-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredServices.length > 0 ? (
                filteredServices.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
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
