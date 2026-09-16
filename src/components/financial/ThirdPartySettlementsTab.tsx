import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  DollarSign, 
  FileText, 
  Fuel, 
  Wrench, 
  User, 
  Search,
  Printer,
  X
} from 'lucide-react';
import { ThirdPartySettlement } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';

interface ThirdPartySettlementsTabProps {

  settlements: ThirdPartySettlement[];
  onSaveSettlements: (settlements: ThirdPartySettlement[]) => void;
}

export const ThirdPartySettlementsTab: React.FC<ThirdPartySettlementsTabProps> = ({
  settlements,
  onSaveSettlements,
}) => {
  const { confirm } = useConfirm();
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ThirdPartySettlement | null>(null);

  // Form State
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [role, setRole] = useState<ThirdPartySettlement['role']>('Freteiro / Caminhão');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [tons, setTons] = useState('');
  const [trips, setTrips] = useState('');
  const [hours, setHours] = useState('');
  const [rate, setRate] = useState('35');
  const [deductions, setDeductions] = useState('0');
  const [machineryPlateOrName, setMachineryPlateOrName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ThirdPartySettlement['status']>('pendente');

  // Calculations
  const pendingSettlements = settlements.filter(s => s.status === 'pendente' || s.status === 'parcial');
  const paidSettlements = settlements.filter(s => s.status === 'pago');

  const totalSettlementsAmount = settlements.reduce((acc, s) => acc + s.netAmount, 0);
  const pendingAmount = pendingSettlements.reduce((acc, s) => acc + s.netAmount, 0);
  const paidAmount = paidSettlements.reduce((acc, s) => acc + s.netAmount, 0);

  const handleOpenModal = (item?: ThirdPartySettlement) => {
    if (item) {
      setEditingItem(item);
      setThirdPartyName(item.thirdPartyName);
      setRole(item.role);
      setDate(item.date);
      setDescription(item.description);
      setTons(item.tons ? item.tons.toString() : '');
      setTrips(item.trips ? item.trips.toString() : '');
      setHours(item.hours ? item.hours.toString() : '');
      setRate(item.rate.toString());
      setDeductions(item.deductions ? item.deductions.toString() : '0');
      setMachineryPlateOrName(item.machineryPlateOrName || '');
      setPhone(item.phone || '');
      setNotes(item.notes || '');
      setStatus(item.status);
    } else {
      setEditingItem(null);
      setThirdPartyName('');
      setRole('Freteiro / Caminhão');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setTons('');
      setTrips('');
      setHours('');
      setRate('35');
      setDeductions('0');
      setMachineryPlateOrName('');
      setPhone('');
      setNotes('');
      setStatus('pendente');
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thirdPartyName.trim()) return;

    const numRate = parseFloat(rate) || 0;
    const numTons = parseFloat(tons) || 0;
    const numHours = parseFloat(hours) || 0;
    const numTrips = parseFloat(trips) || 0;
    const numDeductions = parseFloat(deductions) || 0;

    let calculatedGross = 0;
    if (numTons > 0) {
      calculatedGross = numTons * numRate;
    } else if (numHours > 0) {
      calculatedGross = numHours * numRate;
    } else if (numTrips > 0) {
      calculatedGross = numTrips * numRate;
    } else {
      calculatedGross = numRate;
    }

    const calculatedNet = Math.max(0, calculatedGross - numDeductions);

    if (editingItem) {
      const updated = settlements.map((s) =>
        s.id === editingItem.id
          ? {
              ...s,
              thirdPartyName: thirdPartyName.trim(),
              role,
              date,
              description: description.trim() || `Acerto com ${thirdPartyName}`,
              tons: numTons || undefined,
              trips: numTrips || undefined,
              hours: numHours || undefined,
              rate: numRate,
              totalAmount: calculatedGross,
              deductions: numDeductions,
              netAmount: calculatedNet,
              status,
              machineryPlateOrName: machineryPlateOrName.trim() || undefined,
              phone: phone.trim() || undefined,
              notes: notes.trim() || undefined,
            }
          : s
      );
      onSaveSettlements(updated);
    } else {
      const newItem: ThirdPartySettlement = {
        id: `set_${Date.now()}`,
        thirdPartyName: thirdPartyName.trim(),
        role,
        date,
        description: description.trim() || `Acerto de ${role} - ${thirdPartyName}`,
        tons: numTons || undefined,
        trips: numTrips || undefined,
        hours: numHours || undefined,
        rate: numRate,
        totalAmount: calculatedGross,
        deductions: numDeductions,
        netAmount: calculatedNet,
        status,
        machineryPlateOrName: machineryPlateOrName.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      onSaveSettlements([...settlements, newItem]);
    }
    setIsModalOpen(false);
  };

  const handleToggleStatus = (id: string) => {
    const updated = settlements.map((s) => {
      if (s.id === id) {
        const nextStatus = s.status === 'pago' ? 'pendente' : 'pago';
        return { ...s, status: nextStatus as any };
      }
      return s;
    });
    onSaveSettlements(updated);
  };

  const handleDelete = async (id: string) => {
    const item = settlements.find((s) => s.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Acerto de Terceiro',
      message: item?.thirdPartyName
        ? `Deseja realmente excluir o acerto de "${item.thirdPartyName}" no valor de ${formatCurrencyBRL(item.netAmount)}?`
        : 'Deseja realmente excluir este registro de acerto?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveSettlements(settlements.filter((s) => s.id !== id));
    }
  };


  const filtered = settlements.filter((s) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'pendente' && (s.status === 'pendente' || s.status === 'parcial')) ||
      (statusFilter === 'pago' && s.status === 'pago');

    // Monthly filter based on date (YYYY-MM)
    let matchesMonth = true;
    if (selectedMonthKey) {
      if (s.date) {
        matchesMonth = s.date.startsWith(selectedMonthKey);
      } else {
        matchesMonth = false;
      }
    }

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      s.thirdPartyName.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.orderNumber && s.orderNumber.toLowerCase().includes(q)) ||
      (s.orderClientName && s.orderClientName.toLowerCase().includes(q)) ||
      (s.machineryPlateOrName && s.machineryPlateOrName.toLowerCase().includes(q));

    return matchesStatus && matchesMonth && matchesSearch;
  });

  return (
    <div className="space-y-3">
      {/* Header & Quick Stats (Compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[11px] font-black text-black uppercase tracking-wider block">
              Acertos Pendentes
            </span>
            <div className="text-lg sm:text-xl font-black text-amber-700 mt-0.5 font-['Outfit']">
              {formatCurrencyBRL(pendingAmount)}
            </div>
            <p className="text-[11px] text-black/70 font-medium">
              Fretes e serviços pendentes
            </p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700 shrink-0 border border-amber-200">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[11px] font-black text-black uppercase tracking-wider block">
              Acertos Liquidados
            </span>
            <div className="text-lg sm:text-xl font-black text-emerald-700 mt-0.5 font-['Outfit']">
              {formatCurrencyBRL(paidAmount)}
            </div>
            <p className="text-[11px] text-black/70 font-medium">
              Pagamentos concluídos
            </p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 shrink-0 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between text-black">
          <div>
            <span className="text-[11px] font-black text-black uppercase tracking-wider block">
              Líquido Terceirização
            </span>
            <div className="text-lg sm:text-xl font-black text-black mt-0.5 font-['Outfit']">
              {formatCurrencyBRL(totalSettlementsAmount)}
            </div>
            <p className="text-[11px] text-black/70 font-medium">
              Com abatimento de diesel e adiantamentos
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 text-black shrink-0 border border-slate-200">
            <Truck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filters & Action Bar (Compact) */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs flex flex-col xl:flex-row items-center justify-between gap-2 text-black">
        <div className="flex items-center space-x-1.5 w-full xl:w-auto overflow-x-auto scrollbar-none pb-1 xl:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-black hover:bg-slate-200'
            }`}
          >
            Todos ({settlements.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pendente')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'pendente'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-black hover:bg-slate-200'
            }`}
          >
            Pendentes ({pendingSettlements.length})
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
            Liquidados ({paidSettlements.length})
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

        <div className="flex items-center space-x-2 w-full xl:w-auto justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por freteiro, operador, placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-black placeholder-slate-400 outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Acerto de Terceiro</span>
          </button>
        </div>
      </div>

      {/* Settlements List (Dense & Compact) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs text-black">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-black uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Data</th>
                <th className="py-2 px-3">Terceiro / Prestador</th>
                <th className="py-2 px-3">Função / Veículo</th>
                <th className="py-2 px-3">Produção</th>
                <th className="py-2 px-3 text-right">Bruto</th>
                <th className="py-2 px-3 text-right">Deduções</th>
                <th className="py-2 px-3 text-right">Líquido</th>
                <th className="py-2 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition border ${
                          item.status === 'pago'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : item.status === 'parcial'
                            ? 'bg-sky-50 border-sky-200 text-sky-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        {item.status === 'pago' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Pago</span>
                          </>
                        ) : item.status === 'parcial' ? (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Parcial</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>A Pagar</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-2 px-3 font-bold text-black whitespace-nowrap text-xs">
                      {formatDateBR(item.date)}
                    </td>

                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-black text-xs">
                          {item.thirdPartyName}
                        </span>
                        {item.orderNumber && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold font-mono">
                            OS #{item.orderNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-black/75 font-medium">
                        {item.description}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-bold text-black">
                        {item.role}
                      </span>
                      {item.machineryPlateOrName && (
                        <div className="text-[11px] text-black/80 mt-0.5 font-bold">
                          {item.machineryPlateOrName}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-black font-medium text-xs">
                      {item.tons ? `${item.tons}t` : ''}
                      {item.trips ? ` (${item.trips}v)` : ''}
                      {item.hours ? `${item.hours}h` : ''}
                      {!item.tons && !item.hours && !item.trips ? 'Global' : ''}
                    </td>

                    <td className="py-2 px-3 text-right text-black font-semibold whitespace-nowrap text-xs font-['Outfit']">
                      {formatCurrencyBRL(item.totalAmount)}
                    </td>

                    <td className="py-2 px-3 text-right text-rose-600 font-bold whitespace-nowrap text-xs font-['Outfit']">
                      {item.deductions ? `- ${formatCurrencyBRL(item.deductions)}` : 'R$ 0,00'}
                    </td>

                    <td className="py-2 px-3 text-right font-black text-black whitespace-nowrap text-xs font-['Outfit']">
                      {formatCurrencyBRL(item.netAmount)}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1 text-stone-400 hover:text-[#009688] transition rounded hover:bg-stone-100 dark:hover:bg-stone-800"
                          title="Editar Acerto"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-stone-400 hover:text-rose-600 transition rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Excluir Acerto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-500 font-medium text-xs">
                    {settlements.length === 0
                      ? 'Nenhum acerto de terceiro registrado.'
                      : 'Nenhum acerto encontrado para os filtros selecionados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Acerto de Terceiro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-[#b0d2ed] border border-[#0963cb]/30 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            {/* Header com azul padrão #0963cb e texto/ícone em branco #ffffff */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0963cb] text-white shrink-0">
              <h3 className="text-base font-bold text-white tracking-tight">
                {editingItem ? 'Editar Acerto de Terceiro' : 'Novo Acerto (Freteiro / Operador)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 bg-[#b0d2ed] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Nome do Terceiro / Motorista / Empresa <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={thirdPartyName}
                  onChange={(e) => setThirdPartyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Tipo de Terceiro
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                  >
                    <option value="Freteiro / Caminhão">Freteiro / Caminhão</option>
                    <option value="Operador Terceirizado">Operador Terceirizado</option>
                    <option value="Aluguel de Máquina">Aluguel de Máquina</option>
                    <option value="Prestador de Serviço">Prestador de Serviço</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Data do Fechamento
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Descrição do Trabalho
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Toneladas
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={tons}
                    onChange={(e) => setTons(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Viagens / Horas
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={trips || hours}
                    onChange={(e) => {
                      setTrips(e.target.value);
                      setHours(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Valor Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-rose-700 mb-1">
                    (-) Abatimento / Diesel (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-rose-300 rounded-xl bg-white text-rose-600 focus:ring-2 focus:ring-rose-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Status do Pagamento
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                  >
                    <option value="pendente">Pendente / A Pagar</option>
                    <option value="parcial">Pago Parcialmente</option>
                    <option value="pago">Totalmente Liquidado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Placa / Máquina
                  </label>
                  <input
                    type="text"
                    value={machineryPlateOrName}
                    onChange={(e) => setMachineryPlateOrName(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-[#0963cb] outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-black/15">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-[#0963cb] hover:bg-[#0852a8] text-white shadow-xs cursor-pointer transition"
                >
                  Salvar Acerto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
