import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  CalendarX2, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  X, 
  DollarSign, 
  ArrowRight,
  ShieldAlert,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { Employee, AbsenceRecord, PayrollRecord } from '../../types';
import { formatDateBR, formatCurrencyBRL } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';

interface FaltasTabProps {
  employees: Employee[];
  absences: AbsenceRecord[];
  payrolls?: PayrollRecord[];
  currentMonthRef: string;
  onSaveAbsences: (absences: AbsenceRecord[]) => void;
  onApplyDiscountToPayroll?: (absence: AbsenceRecord) => void;
}

export const FaltasTab: React.FC<FaltasTabProps> = ({
  employees,
  absences,
  payrolls = [],
  currentMonthRef,
  onSaveAbsences,
  onApplyDiscountToPayroll,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthRef);
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [discountFilter, setDiscountFilter] = useState<string>('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<AbsenceRecord | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState<number>(1);
  const [type, setType] = useState<AbsenceRecord['type']>('injustificada');
  const [discountPayroll, setDiscountPayroll] = useState<boolean>(true);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [referenceMonth, setReferenceMonth] = useState<string>(currentMonthRef);
  const [status, setStatus] = useState<AbsenceRecord['status']>('pendente');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Calculate estimated daily discount
  const recalculateDiscount = (empId: string, days: number, isDiscount: boolean) => {
    if (!isDiscount) {
      setDiscountAmount(0);
      return;
    }
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const salary = emp.salary || emp.baseSalary || 0;
      const dailyRate = salary > 0 ? salary / 30 : 0;
      const calculated = Math.round(dailyRate * days * 100) / 100;
      setDiscountAmount(calculated);
    }
  };

  const handleEmployeeChange = (empId: string) => {
    setSelectedEmployeeId(empId);
    recalculateDiscount(empId, daysCount, discountPayroll);
  };

  const handleDaysChange = (days: number) => {
    setDaysCount(days);
    recalculateDiscount(selectedEmployeeId, days, discountPayroll);
    if (date && days > 0) {
      const d1 = new Date(date + 'T00:00:00');
      const endD = new Date(d1.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
      setEndDate(endD.toISOString().split('T')[0]);
    }
  };

  const handleToggleDiscount = (checked: boolean) => {
    setDiscountPayroll(checked);
    recalculateDiscount(selectedEmployeeId, daysCount, checked);
  };

  // Filtered List
  const filtered = absences.filter(a => {
    const matchesSearch = 
      a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.reason && a.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.notes && a.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMonth = !selectedMonth || a.referenceMonth === selectedMonth || a.date.startsWith(selectedMonth.split('/').reverse().join('-'));
    const matchesType = typeFilter === 'todos' || a.type === typeFilter;
    const matchesDiscount = 
      discountFilter === 'todos' || 
      (discountFilter === 'com_desconto' && a.discountPayroll) ||
      (discountFilter === 'sem_desconto' && !a.discountPayroll) ||
      (discountFilter === a.status);

    return matchesSearch && matchesMonth && matchesType && matchesDiscount;
  });

  // KPIs for the selected month or total
  const monthAbsences = selectedMonth ? absences.filter(a => a.referenceMonth === selectedMonth) : absences;
  const totalOccurrences = monthAbsences.length;
  const unjustifiedCount = monthAbsences.filter(a => a.type === 'injustificada' || a.type === 'suspensao').length;
  const justifiedCount = monthAbsences.filter(a => a.type === 'justificada').length;
  const totalDiscountAmount = monthAbsences
    .filter(a => a.discountPayroll)
    .reduce((sum, a) => sum + (a.discountAmount || 0), 0);

  const handleOpenModal = (item?: AbsenceRecord) => {
    if (item) {
      setEditingAbsence(item);
      setSelectedEmployeeId(item.employeeId);
      setDate(item.date);
      setEndDate(item.endDate || '');
      setDaysCount(item.daysCount || 1);
      setType(item.type);
      setDiscountPayroll(item.discountPayroll);
      setDiscountAmount(item.discountAmount || 0);
      setReferenceMonth(item.referenceMonth || currentMonthRef);
      setStatus(item.status);
      setReason(item.reason || '');
      setNotes(item.notes || '');
    } else {
      setEditingAbsence(null);
      const activeEmps = employees.filter(e => e.status !== 'inativo');
      const firstId = activeEmps.length > 0 ? activeEmps[0].id : '';
      setSelectedEmployeeId(firstId);
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setEndDate(today);
      setDaysCount(1);
      setType('injustificada');
      setDiscountPayroll(true);
      setReferenceMonth(currentMonthRef);
      setStatus('pendente');
      setReason('');
      setNotes('');

      // Auto estimate
      if (firstId) {
        const emp = employees.find(e => e.id === firstId);
        const salary = emp?.salary || emp?.baseSalary || 0;
        setDiscountAmount(salary > 0 ? Math.round((salary / 30) * 100) / 100 : 0);
      } else {
        setDiscountAmount(0);
      }
    }
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    if (editingAbsence) {
      const updated = absences.map(a => a.id === editingAbsence.id ? {
        ...a,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        date,
        endDate: endDate || undefined,
        daysCount,
        type,
        discountPayroll,
        discountAmount: discountPayroll ? discountAmount : 0,
        referenceMonth,
        status,
        reason: reason || undefined,
        notes: notes || undefined,
      } : a);
      onSaveAbsences(updated);
    } else {
      const newAbsence: AbsenceRecord = {
        id: `abs_${Date.now()}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        date,
        endDate: endDate || undefined,
        daysCount,
        type,
        discountPayroll,
        discountAmount: discountPayroll ? discountAmount : 0,
        referenceMonth,
        status,
        reason: reason || undefined,
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
      };
      onSaveAbsences([newAbsence, ...absences]);
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const isOk = await confirm({
      title: 'Excluir Ocorrência',
      message: 'Deseja remover este registro de falta/ausência? Se ela já foi descontada na folha, os valores deverão ser revistos manualmente.',
      confirmLabel: 'Sim, excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isOk) {
      onSaveAbsences(absences.filter(a => a.id !== id));
    }
  };

  const handleMarkAsDiscounted = (item: AbsenceRecord) => {
    const updated = absences.map(a => a.id === item.id ? {
      ...a,
      status: 'descontada' as const
    } : a);
    onSaveAbsences(updated);
    if (onApplyDiscountToPayroll) {
      onApplyDiscountToPayroll(item);
    }
  };

  return (
    <div className="w-full max-w-none space-y-4 text-black dark:text-white">
      
      {/* 4 Cards de Métricas (Pink / Rose Theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-pink-100/90 dark:bg-pink-950/60 border border-pink-300 dark:border-pink-800 flex items-center justify-center text-pink-700 dark:text-pink-300 shrink-0">
            <CalendarX2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Faltas no Mês ({selectedMonth})
            </span>
            <span className="text-2xl font-black text-black dark:text-white mt-0.5 block font-['Outfit']">
              {totalOccurrences}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-100/80 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-700 dark:text-rose-300 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Injustificadas / Suspensões
            </span>
            <span className="text-2xl font-black text-black dark:text-rose-400 mt-0.5 block font-['Outfit']">
              {unjustifiedCount}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Justificadas / Abonadas
            </span>
            <span className="text-2xl font-black text-black dark:text-emerald-400 mt-0.5 block font-['Outfit']">
              {justifiedCount}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-800 dark:text-amber-300 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-black dark:text-stone-300 uppercase tracking-wider block">
              Descontos em Folha (R$)
            </span>
            <span className="text-xl sm:text-2xl font-black text-black dark:text-rose-400 mt-0.5 block font-['Outfit']">
              {formatCurrencyBRL(totalDiscountAmount)}
            </span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros & Ações */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Competência Mês */}
          <div className="flex items-center space-x-1.5 bg-white border border-stone-300 px-2.5 py-1.5 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-black/60" />
            <span className="text-[11px] font-bold text-black">Mês:</span>
            <input
              type="text"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              placeholder="MM/YYYY"
              className="w-20 text-xs font-bold text-black outline-none"
            />
          </div>

          {/* Campo de Busca */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-black/60 dark:text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador ou motivo..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-pink-600 font-medium"
            />
          </div>

          {/* Filtro por Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium outline-none focus:ring-1 focus:ring-pink-600 cursor-pointer"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="injustificada">Falta Injustificada</option>
            <option value="justificada">Falta Justificada</option>
            <option value="atraso">Atraso Expressivo</option>
            <option value="suspensao">Suspensão Disciplinar</option>
          </select>

          {/* Filtro por Desconto */}
          <select
            value={discountFilter}
            onChange={(e) => setDiscountFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium outline-none focus:ring-1 focus:ring-pink-600 cursor-pointer"
          >
            <option value="todos">Todos os Descontos</option>
            <option value="com_desconto">Com Desconto em Folha</option>
            <option value="sem_desconto">Sem Desconto (Abonada)</option>
            <option value="descontada">Já Descontada na Folha</option>
            <option value="pendente">Pendente de Aplicação</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Falta</span>
        </button>

      </div>

      {/* Tabela de Faltas */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
              <tr>
                <th className="py-2.5 px-3">Situação</th>
                <th className="py-2.5 px-3">Colaborador</th>
                <th className="py-2.5 px-3">Tipo de Falta</th>
                <th className="py-2.5 px-3 text-center">Data / Período</th>
                <th className="py-2.5 px-3 text-center">Qtd. Dias</th>
                <th className="py-2.5 px-3">Motivo / Justificativa</th>
                <th className="py-2.5 px-3 text-right">Desconto Estimado</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        item.status === 'descontada'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                          : item.status === 'abonada'
                          ? 'bg-blue-100 border-blue-300 text-blue-900'
                          : 'bg-amber-100 border-amber-300 text-amber-900'
                      }`}>
                        {item.status === 'descontada' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Descontada</span>
                          </>
                        ) : item.status === 'abonada' ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Abonada</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Pendente</span>
                          </>
                        )}
                      </span>
                    </td>

                    <td className="py-2 px-3">
                      <div className="font-bold text-black dark:text-white">
                        {item.employeeName}
                      </div>
                      <div className="text-[10px] text-black/80 dark:text-stone-300 font-medium">
                        {item.employeeRole} • Comp: {item.referenceMonth}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                        item.type === 'injustificada'
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300'
                          : item.type === 'suspensao'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-300'
                          : item.type === 'atraso'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200'
                      }`}>
                        {item.type === 'injustificada' && 'Falta Injustificada'}
                        {item.type === 'justificada' && 'Falta Justificada'}
                        {item.type === 'atraso' && 'Atraso Expressivo'}
                        {item.type === 'suspensao' && 'Suspensão'}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-center text-black dark:text-stone-200 font-medium">
                      {formatDateBR(item.date)}
                      {item.endDate && item.endDate !== item.date && (
                        <> até {formatDateBR(item.endDate)}</>
                      )}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <span className="font-bold text-black dark:text-white">
                        {item.daysCount} dia(s)
                      </span>
                    </td>

                    <td className="py-2 px-3 max-w-xs">
                      <div className="text-black dark:text-stone-200 font-medium truncate">
                        {item.reason || 'Sem justificativa informada'}
                      </div>
                      {item.notes && (
                        <div className="text-[10px] text-black/75 dark:text-stone-400 truncate">
                          {item.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-right">
                      {item.discountPayroll && item.discountAmount ? (
                        <span className="font-bold text-rose-900 dark:text-rose-400 font-['Outfit']">
                          - {formatCurrencyBRL(item.discountAmount)}
                        </span>
                      ) : (
                        <span className="text-stone-500 font-medium text-[11px]">
                          Isento (R$ 0,00)
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {item.discountPayroll && item.status !== 'descontada' && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsDiscounted(item)}
                            className="p-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60 rounded transition cursor-pointer"
                            title="Marcar como Descontada na Folha"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1 text-black/70 hover:text-black dark:text-stone-400 dark:hover:text-white hover:bg-blue-200/50 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Editar Registro"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-100/50 dark:hover:bg-rose-950/50 rounded transition cursor-pointer"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-black/70 dark:text-stone-400 font-medium">
                    Nenhuma falta ou ocorrência encontrada para o filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Cadastro / Edição de Falta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="crm-card bg-[#87AFE3] border border-blue-200/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0963cb] text-white">
              <div className="flex items-center space-x-2">
                <CalendarX2 className="w-4 h-4 text-pink-300" />
                <h3 className="font-bold text-sm">
                  {editingAbsence ? 'Editar Falta / Ocorrência' : 'Registrar Falta / Ocorrência'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-5 space-y-4 text-xs bg-[#b0d2ed]">
              
              {/* Colaborador */}
              <div>
                <label className="block font-bold text-black mb-1">
                  Colaborador / Funcionário <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] font-medium"
                  required
                >
                  <option value="">Selecione um funcionário...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role}) - Salário Base: {formatCurrencyBRL(emp.salary || emp.baseSalary || 3500)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grid: Tipo & Situação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-black mb-1">
                    Tipo da Ocorrência <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] font-medium"
                    required
                  >
                    <option value="injustificada">Falta Injustificada</option>
                    <option value="justificada">Falta Justificada (Sem desconto ou abonada)</option>
                    <option value="atraso">Atraso Expressivo / Saída Antecipada</option>
                    <option value="suspensao">Suspensão Disciplinar</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-black mb-1">
                    Situação / Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb]"
                  >
                    <option value="pendente">Pendente de Aplicação</option>
                    <option value="descontada">Já Descontada na Folha</option>
                    <option value="justificada">Justificada pela Diretoria</option>
                    <option value="abonada">Abonada (Sem Prejuízo)</option>
                  </select>
                </div>
              </div>

              {/* Card de Datas e Duração */}
              <div className="p-3.5 bg-white border border-stone-300 rounded-xl space-y-3 shadow-xs">
                <span className="text-[11px] font-black uppercase text-black block tracking-wider">
                  Período da Ocorrência
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-black mb-1">
                      Data da Falta <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        if (daysCount === 1) setEndDate(e.target.value);
                      }}
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black mb-1">
                      Dias de Ausência <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={daysCount || ''}
                      onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)}
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black mb-1">
                      Competência da Folha
                    </label>
                    <input
                      type="text"
                      value={referenceMonth}
                      onChange={(e) => setReferenceMonth(e.target.value)}
                      placeholder="MM/YYYY (ex: 09/2026)"
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb]"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Card de Desconto em Folha */}
              <div className="p-3.5 bg-white border border-stone-300 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-black tracking-wider">
                    Reflexo Financeiro na Folha
                  </span>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={discountPayroll}
                      onChange={(e) => handleToggleDiscount(e.target.checked)}
                      className="rounded text-pink-600 focus:ring-pink-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-xs text-black">
                      Aplicar Desconto em Folha
                    </span>
                  </label>
                </div>

                {discountPayroll && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-black mb-1">
                        Valor Total do Desconto (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={discountAmount || ''}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-rose-700 font-bold outline-none focus:ring-1 focus:ring-pink-600"
                        required
                      />
                    </div>
                    <div className="flex items-center text-[11px] text-stone-600 pt-3">
                      <span>
                        Calculado automaticamente: <strong>(Salário Base / 30) × {daysCount} dia(s)</strong>. Editável se houver desconto parcial.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Motivo & Observações */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-black mb-1">
                    Motivo Apresentado / Relato da Falta
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: Não compareceu ao corte de silagem sem aviso prévio"
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-black mb-1">
                    Observações Internas (RH / Supervisão de Campo)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] resize-none text-xs"
                    placeholder="Registro sobre advertência aplicada, contato com o colaborador..."
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-black/15">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold hover:bg-stone-50 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-bold transition shadow-xs cursor-pointer"
                >
                  Salvar Falta
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
