import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Download, 
  Scale, 
  DollarSign, 
  TrendingUp, 
  Truck, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { SilageOrder } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { 
  CompetenceSelector, 
  getPrevCompetence, 
  getNextCompetence 
} from '../financial/CompetenceSelector';

interface ReportsVendasTabProps {
  orders: SilageOrder[];
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onStartDateChange?: (d: string) => void;
  onEndDateChange?: (d: string) => void;
}

export const ReportsVendasTab: React.FC<ReportsVendasTabProps> = ({
  orders,
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
  const [productFilter, setProductFilter] = useState('todos');

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const term = String(searchTerm ?? '').toLowerCase().trim();
    return (orders || []).filter(o => {
      const matchDate = o?.deliveryDate ? (o.deliveryDate >= startDate && o.deliveryDate <= endDate) : false;
      const matchSearch = !term ||
        Boolean(String(o.clientName ?? '').toLowerCase().includes(term)) ||
        Boolean(String(o.farmName ?? '').toLowerCase().includes(term)) ||
        Boolean(String(o.orderNumber ?? '').toLowerCase().includes(term));
      const matchProduct = productFilter === 'todos' || o.productType === productFilter;
      return matchDate && matchSearch && matchProduct && o.status !== 'cancelado';
    });
  }, [orders, startDate, endDate, searchTerm, productFilter]);

  // KPIs
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalTons = filteredOrders.reduce((sum, o) => sum + (o.tons || 0), 0);
  const avgPricePerTon = totalTons > 0 ? (totalRevenue / totalTons) : 0;
  const paidCount = filteredOrders.filter(o => o.paymentStatus === 'pago').length;
  const pendingCount = filteredOrders.filter(o => o.paymentStatus !== 'pago').length;

  const handleExportCsv = () => {
    const headers = 'Numero,Data_Entrega,Cliente,Fazenda,Produto,Toneladas,Preco_Ton,Total_R$,Frete,Status_Pagamento\n';
    const rows = filteredOrders.map(o => 
      `"${o.orderNumber || o.id}","${o.deliveryDate}","${o.clientName}","${o.farmName || ''}","${o.productType}","${o.tons}","${o.pricePerTon}","${o.totalAmount}","${o.freightType}","${o.paymentStatus}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_vendas_silagem_${startDate}_a_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in financial-subtab-clean">
      
      {/* 1. Cards de Resumo Finos e Compactos */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        
        <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 border border-black/15">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Faturamento Vendas
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(totalRevenue)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                {filteredOrders.length} pedidos faturados
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-teal-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center shrink-0 border border-black/15">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Tonelagem Total
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] leading-tight truncate">
                {totalTons.toFixed(1)} ton
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                Silagem entregue
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center shrink-0 border border-black/15">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Preço Médio / Ton
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-sky-700 dark:text-sky-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(avgPricePerTon)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                Média ponderada
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              Status Pagamentos
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-1.5">
              <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] leading-tight truncate">
                <span className="text-emerald-700">{paidCount} pagos</span> / <span className="text-amber-700">{pendingCount} pend.</span>
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                Recebíveis comerciais
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Filtros, Busca, Competência e Exportação */}
      <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-900 px-3 py-2 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, pedido ou fazenda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009688]"
          >
            <option value="todos">Todos os tipos de silagem</option>
            <option value="Milho Planta Inteira">Milho Planta Inteira</option>
            <option value="Milho Grão Úmido">Milho Grão Úmido</option>
            <option value="Sorgo Forrageiro">Sorgo Forrageiro</option>
            <option value="Capiaçu">Capiaçu</option>
            <option value="Aveia / Azevém">Aveia / Azevém</option>
          </select>

          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-[#e0e6f1] dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-[#d2dced] dark:hover:bg-stone-700 border border-black dark:border-stone-700 font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Vendas (CSV)</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
              <tr>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Data Entrega</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Cliente / Produtor</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5">Produto</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Volume (Ton)</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">R$ / Ton</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-right">Total Faturado</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-center">Frete</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3.5 text-center">Status Pagto.</th>
              </tr>
            </thead>
            <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((item) => (
                  <tr key={item.id} className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-700 dark:text-stone-400">
                      {formatDateBR(item.deliveryDate)}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                      <div>{item.clientName}</div>
                      {item.farmName && <div className="text-[10px] text-stone-600">{item.farmName}</div>}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-stone-800 dark:text-stone-300">
                      {item.productType}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">
                      {item.tons.toFixed(1)} t
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-stone-700 dark:text-stone-400">
                      {formatCurrencyBRL(item.pricePerTon)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrencyBRL(item.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className="font-mono uppercase text-[10px] bg-white/80 dark:bg-stone-800 border border-black/20 px-1.5 py-0.5 rounded font-bold">
                        {item.freightType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.paymentStatus === 'pago'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : item.paymentStatus === 'parcial'
                          ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      }`}>
                        {item.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900">
                    Nenhuma venda de silagem registrada no período filtrado.
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
