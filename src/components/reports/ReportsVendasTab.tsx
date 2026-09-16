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

interface ReportsVendasTabProps {
  orders: SilageOrder[];
  startDate: string;
  endDate: string;
}

export const ReportsVendasTab: React.FC<ReportsVendasTabProps> = ({
  orders,
  startDate,
  endDate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('todos');

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchDate = o.deliveryDate >= startDate && o.deliveryDate <= endDate;
      const matchSearch = 
        o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.farmName && o.farmName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.orderNumber && o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()));
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
    <div className="space-y-4 sm:space-y-6">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Relatório Comercial de Vendas de Silagem
            </h3>
            <p className="text-xs text-stone-500">
              Acompanhamento de volume expedido, ticket médio por tonelada e recebíveis
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar Vendas (CSV)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-emerald-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Faturamento Vendas</span>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrencyBRL(totalRevenue)}
          </div>
          <span className="text-[10px] text-stone-400">{filteredOrders.length} pedidos faturados</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-teal-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Tonelagem Total</span>
          <div className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-100 mt-0.5">
            {totalTons.toFixed(1)} ton
          </div>
          <span className="text-[10px] text-stone-400">Silagem entregue</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-sky-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Preço Médio / Ton</span>
          <div className="text-lg sm:text-xl font-black text-sky-600 dark:text-sky-400 mt-0.5">
            {formatCurrencyBRL(avgPricePerTon)}
          </div>
          <span className="text-[10px] text-stone-400">Média ponderada</span>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3.5 shadow-2xs border-l-4 border-l-amber-500">
          <span className="text-[11px] font-bold text-stone-500 uppercase block">Status Pagamentos</span>
          <div className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-100 mt-0.5">
            <span className="text-emerald-600">{paidCount} pagos</span> / <span className="text-amber-600">{pendingCount} pend.</span>
          </div>
          <span className="text-[10px] text-stone-400">Recebíveis comerciais</span>
        </div>

      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, pedido ou fazenda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none focus:ring-1 focus:ring-[#009688]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
          >
            <option value="todos">Todos os tipos de silagem</option>
            <option value="Milho Planta Inteira">Milho Planta Inteira</option>
            <option value="Milho Grão Úmido">Milho Grão Úmido</option>
            <option value="Sorgo Forrageiro">Sorgo Forrageiro</option>
            <option value="Capiaçu">Capiaçu</option>
            <option value="Aveia / Azevém">Aveia / Azevém</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-800/70 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="py-3 px-3.5">Data Entrega</th>
                <th className="py-3 px-3.5">Cliente / Produtor</th>
                <th className="py-3 px-3.5">Produto</th>
                <th className="py-3 px-3.5 text-right">Volume (Ton)</th>
                <th className="py-3 px-3.5 text-right">R$ / Ton</th>
                <th className="py-3 px-3.5 text-right">Total Faturado</th>
                <th className="py-3 px-3.5 text-center">Frete</th>
                <th className="py-3 px-3.5 text-center">Status Pagto.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-stone-600 dark:text-stone-400">
                      {formatDateBR(item.deliveryDate)}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">
                      <div>{item.clientName}</div>
                      {item.farmName && <div className="text-[10px] text-stone-400">{item.farmName}</div>}
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-stone-700 dark:text-stone-300">
                      {item.productType}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-black text-stone-900 dark:text-stone-100">
                      {item.tons.toFixed(1)} t
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-semibold text-stone-600 dark:text-stone-400">
                      {formatCurrencyBRL(item.pricePerTon)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrencyBRL(item.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className="font-mono uppercase text-[10px] bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded font-bold">
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
                  <td colSpan={8} className="py-8 text-center text-stone-400">
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
