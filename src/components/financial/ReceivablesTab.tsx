import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Search, 
  TrendingUp, 
  DollarSign, 
  User, 
  FileText,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { SilageOrder, ServiceOrder } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface ReceivablesTabProps {
  orders: SilageOrder[];
  services?: ServiceOrder[];
  onToggleOrderStatus?: (orderId: string) => void;
}

export const ReceivablesTab: React.FC<ReceivablesTabProps> = ({
  orders,
  services = [],
  onToggleOrderStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'pago'>('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // Month options based on current date: 1 previous, current, 5 next
  const monthFilterOptions = React.useMemo(() => {
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    const options: { key: string; label: string; year: number; month: number }[] = [];

    // -1 (Mês Anterior), 0 (Mês Atual), +1..+5 (5 Próximos Meses)
    for (let offset = -1; offset <= 5; offset++) {
      const d = new Date(currentYear, currentMonth + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth(); // 0-11
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = monthNames[m];
      options.push({ key, label, year: y, month: m });
    }

    return options;
  }, []);

  // Combined Receivables Items
  const receivablesFromOrders = orders.map((o) => ({
    id: o.id,
    type: 'Venda de Silagem' as const,
    clientName: o.clientName,
    date: o.date,
    dueDate: o.date, // In silage operations usually settlement on delivery
    volume: `${o.tons} tons`,
    totalAmount: o.totalAmount,
    status: o.paymentStatus === 'pago' ? ('pago' as const) : ('pendente' as const),
    notes: o.notes || '',
  }));

  const receivablesFromServices = services.map((s) => ({
    id: s.id,
    type: 'Prestação de Serviço' as const,
    clientName: s.clientName,
    date: s.date,
    dueDate: s.date,
    volume: `${s.tonsHarvested || 0} tons / ${s.hoursWorked || 0} hrs`,
    totalAmount: s.totalAmount || 0,
    status: s.status === 'finalizado' ? ('pago' as const) : ('pendente' as const),
    notes: s.farmLocation || '',
  }));

  const allReceivables = [...receivablesFromOrders, ...receivablesFromServices];

  const pendingList = allReceivables.filter((r) => r.status === 'pendente');
  const paidList = allReceivables.filter((r) => r.status === 'pago');

  const totalPending = pendingList.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalPaid = paidList.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalOverall = allReceivables.reduce((acc, r) => acc + r.totalAmount, 0);

  const filtered = allReceivables.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    // Monthly filter based on dueDate (or date as fallback)
    let matchesMonth = true;
    if (selectedMonthKey) {
      const targetDate = r.dueDate || r.date;
      if (targetDate) {
        matchesMonth = targetDate.startsWith(selectedMonthKey);
      } else {
        matchesMonth = false;
      }
    }

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      r.clientName.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q);
    return matchesStatus && matchesMonth && matchesSearch;
  });

  return (
    <div className="space-y-3">
      {/* KPI Cards (Compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[11px] font-black text-black uppercase tracking-wider block">
              A Receber (Em Aberto)
            </span>
            <div className="text-lg sm:text-xl font-black text-sky-700 mt-0.5 font-['Outfit']">
              {formatCurrencyBRL(totalPending)}
            </div>
            <p className="text-[11px] text-black/70 font-medium">
              {pendingList.length} pedidos a receber
            </p>
          </div>
          <div className="p-2 rounded-lg bg-sky-50 text-sky-700 shrink-0 border border-sky-200">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[11px] font-black text-black uppercase tracking-wider block">
              Recebido (Liquidado)
            </span>
            <div className="text-lg sm:text-xl font-black text-emerald-700 mt-0.5 font-['Outfit']">
              {formatCurrencyBRL(totalPaid)}
            </div>
            <p className="text-[11px] text-black/70 font-medium">
              {paidList.length} faturamentos confirmados
            </p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 shrink-0 border border-emerald-200">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[11px] font-black text-black uppercase tracking-wider block">
              Faturamento Total
            </span>
            <div className="text-lg sm:text-xl font-black text-black mt-0.5 font-['Outfit']">
              {formatCurrencyBRL(totalOverall)}
            </div>
            <p className="text-[11px] text-black/70 font-medium">
              Vendas + Prestação de serviços
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 text-black shrink-0 border border-slate-200">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filters Bar (Compact) */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-black">
        <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-black hover:bg-slate-200'
            }`}
          >
            Todos ({allReceivables.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pendente')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'pendente'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-black hover:bg-slate-200'
            }`}
          >
            A Receber ({pendingList.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pago')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'pago'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-black hover:bg-slate-200'
            }`}
          >
            Recebidos ({paidList.length})
          </button>

          {/* Divisor sutil entre status e meses */}
          <div className="h-4 w-px bg-slate-300 mx-0.5 shrink-0 hidden sm:block" />

          {/* Botões de Filtro por Mês */}
          {monthFilterOptions.map((m) => {
            const isSelected = selectedMonthKey === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMonthKey(isSelected ? null : m.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-black hover:bg-slate-200'
                }`}
                title={`Filtrar por ${m.label}/${m.year}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-black placeholder-slate-400 outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
      </div>

      {/* Receivables Table (Dense & Compact) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs text-black">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-black uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Data</th>
                <th className="py-2 px-3">Cliente / Produtor</th>
                <th className="py-2 px-3">Origem / Tipo</th>
                <th className="py-2 px-3">Volume</th>
                <th className="py-2 px-3 text-right">Valor Total (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          item.status === 'pago'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-sky-50 border-sky-200 text-sky-800'
                        }`}
                      >
                        {item.status === 'pago' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Recebido</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>A Receber</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-2 px-3 font-bold text-black whitespace-nowrap text-xs">
                      {formatDateBR(item.date)}
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-bold text-black text-xs">
                        {item.clientName}
                      </div>
                      {item.notes && (
                        <div className="text-[11px] text-black/75 font-medium truncate max-w-xs">
                          {item.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                        item.type === 'Venda de Silagem' 
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}>
                        {item.type}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-black font-medium text-xs">
                      {item.volume}
                    </td>

                    <td className="py-2 px-3 text-right font-black text-black whitespace-nowrap text-xs font-['Outfit']">
                      {formatCurrencyBRL(item.totalAmount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-black font-medium text-xs">
                    Nenhum título a receber encontrado para os filtros selecionados.
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
