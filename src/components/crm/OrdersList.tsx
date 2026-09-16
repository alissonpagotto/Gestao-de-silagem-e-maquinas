import React, { useState } from 'react';
import { ShoppingCart, Plus, Calendar, Truck, CheckCircle2, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { SilageOrder } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface OrdersListProps {
  orders: SilageOrder[];
  onNewOrder: () => void;
  onDeleteOrder: (id: string) => void;
  onUpdateOrderStatus: (id: string, status: SilageOrder['status']) => void;
  onUpdatePaymentStatus: (id: string, paymentStatus: SilageOrder['paymentStatus']) => void;
}

export const OrdersList: React.FC<OrdersListProps> = ({
  orders,
  onNewOrder,
  onDeleteOrder,
  onUpdateOrderStatus,
  onUpdatePaymentStatus,
}) => {
  const [filterStatus, setFilterStatus] = useState('todos');

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'todos' && o.status !== filterStatus) return false;
    return true;
  });

  const totalTons = filteredOrders.reduce((acc, curr) => acc + curr.tons, 0);
  const totalRevenue = filteredOrders.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="space-y-2.5">
      
      {/* Header */}
      <div className="bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight font-['Outfit']">
            Vendas & Entregas de Silagem
          </h2>
          <p className="text-xs text-stone-500">
            Contratos de fornecimento, carregamentos e faturamento por tonelada
          </p>
        </div>

        <button
          onClick={onNewOrder}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition shadow-xs active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Novo Pedido</span>
        </button>
      </div>

      {/* Metric summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white p-2.5 rounded-lg border border-stone-200">
          <span className="text-[10px] font-bold text-stone-500 uppercase">Volume Vendido</span>
          <p className="text-lg font-extrabold text-stone-900 mt-0.5">{totalTons} <span className="text-[10px] font-normal text-stone-500">toneladas</span></p>
        </div>
        <div className="bg-white p-2.5 rounded-lg border border-stone-200">
          <span className="text-[10px] font-bold text-stone-500 uppercase">Faturamento Projetado</span>
          <p className="text-lg font-extrabold text-emerald-600 mt-0.5">{formatCurrencyBRL(totalRevenue)}</p>
        </div>
        <div className="bg-white p-2.5 rounded-lg border border-stone-200">
          <span className="text-[10px] font-bold text-stone-500 uppercase">Preço Médio</span>
          <p className="text-lg font-extrabold text-stone-800 mt-0.5">
            {formatCurrencyBRL(totalTons > 0 ? totalRevenue / totalTons : 0)} <span className="text-[10px] font-normal text-stone-500">/ ton</span>
          </p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
        <div className="px-3 py-1.5 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <span className="text-xs font-bold text-stone-700">Lista de Pedidos ({filteredOrders.length})</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs px-2 py-0.5 rounded-lg border border-stone-300 bg-white cursor-pointer"
          >
            <option value="todos">Todos os Pedidos</option>
            <option value="orcamento">Orçamentos</option>
            <option value="confirmado">Confirmados</option>
            <option value="em_entrega">Em Entrega</option>
            <option value="entregue">Entregues</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-1.5 px-3">Produtor / Fazenda</th>
                <th className="py-1.5 px-3">Produto</th>
                <th className="py-1.5 px-3">Volume (Ton)</th>
                <th className="py-1.5 px-3">Preço / Ton</th>
                <th className="py-1.5 px-3">Total</th>
                <th className="py-1.5 px-3">Entrega</th>
                <th className="py-1.5 px-3">Status</th>
                <th className="py-1.5 px-3">Pagamento</th>
                <th className="py-1.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {filteredOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-stone-50">
                  <td className="py-1.5 px-3">
                    <div className="font-bold text-stone-900 leading-snug">{ord.clientName}</div>
                    <div className="text-[10px] text-stone-500">{ord.farmName}</div>
                  </td>
                  <td className="py-1.5 px-3 font-semibold text-stone-800">
                    {ord.productType}
                  </td>
                  <td className="py-1.5 px-3 font-bold text-stone-900">
                    {ord.tons} ton
                  </td>
                  <td className="py-1.5 px-3">
                    {formatCurrencyBRL(ord.pricePerTon)}
                  </td>
                  <td className="py-1.5 px-3 font-extrabold text-emerald-700">
                    {formatCurrencyBRL(ord.totalAmount)}
                  </td>
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <div>{formatDateBR(ord.deliveryDate)}</div>
                    <span className="text-[9px] text-stone-400 font-bold uppercase">{ord.freightType}</span>
                  </td>
                  <td className="py-1.5 px-3">
                    <select
                      value={ord.status}
                      onChange={(e) => onUpdateOrderStatus(ord.id, e.target.value as any)}
                      className="text-xs py-0.5 px-1.5 rounded-md border border-stone-200 font-semibold bg-white cursor-pointer"
                    >
                      <option value="orcamento">Orçamento</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="em_entrega">Em Entrega</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-3">
                    <select
                      value={ord.paymentStatus}
                      onChange={(e) => onUpdatePaymentStatus(ord.id, e.target.value as any)}
                      className={`text-xs py-0.5 px-1.5 rounded-md border font-bold cursor-pointer ${
                        ord.paymentStatus === 'pago'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : ord.paymentStatus === 'parcial'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-stone-50 text-stone-700 border-stone-200'
                      }`}
                    >
                      <option value="pendente">A Receber</option>
                      <option value="parcial">Parcial</option>
                      <option value="pago">Quitado</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    <button
                      onClick={() => onDeleteOrder(ord.id)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                      title="Excluir Pedido"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
