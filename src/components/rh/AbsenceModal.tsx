import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Employee, AbsenceRecord } from '../../types';

export interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAbsence?: AbsenceRecord | null;
  employees: Employee[];
  currentMonthRef: string;
  selectedMonth?: string;
  onSave: (record: AbsenceRecord & { tipo?: string; tipo_registro?: string; desconto?: number }) => void;
}

export const AbsenceModal: React.FC<AbsenceModalProps> = ({
  isOpen,
  onClose,
  editingAbsence,
  employees,
  currentMonthRef,
  onSave,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [daysCount, setDaysCount] = useState<number>(1);
  const [absenceUnit, setAbsenceUnit] = useState<'dias' | 'horas'>('dias');
  const [absenceHours, setAbsenceHours] = useState<number>(2.5);
  const [type, setType] = useState<AbsenceRecord['type']>('injustificada');
  const [discountPayroll, setDiscountPayroll] = useState<boolean>(true);
  const [referenceMonth, setReferenceMonth] = useState<string>(currentMonthRef);
  const [status, setStatus] = useState<AbsenceRecord['status']>('pendente');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [calculationMemory, setCalculationMemory] = useState<string>('');

  const computeDiscount = (empId: string, unit: 'dias' | 'horas', days: number, hrs: number, shouldDiscount: boolean) => {
    if (!shouldDiscount || !empId) return { discountAmount: 0, calculationMemory: 'Sem desconto em folha.' };
    const emp = employees.find(e => e.id === empId);
    const salary = emp?.salary || emp?.baseSalary || 3500;
    const dailyRate = salary / 30;
    if (unit === 'horas') {
      const hourlyRate = dailyRate / 7.3333;
      const amt = Math.round(hourlyRate * hrs * 100) / 100;
      return { discountAmount: amt, calculationMemory: `${hrs} horas x R$ ${hourlyRate.toFixed(2)}/h` };
    }
    const amt = Math.round(dailyRate * days * 100) / 100;
    return { discountAmount: amt, calculationMemory: `${days} dia(s) x R$ ${dailyRate.toFixed(2)}/dia` };
  };

  useEffect(() => {
    if (!isOpen) return;

    if (editingAbsence) {
      setSelectedEmployeeId(editingAbsence.employeeId);
      setDate(editingAbsence.date);
      setEndDate(editingAbsence.endDate || editingAbsence.date);
      setDaysCount(editingAbsence.daysCount || 1);
      const unit = editingAbsence.absenceUnit || ((editingAbsence.absenceHours && editingAbsence.absenceHours > 0) ? 'horas' : 'dias');
      setAbsenceUnit(unit);
      setAbsenceHours(editingAbsence.absenceHours !== undefined ? Number(editingAbsence.absenceHours) : 2.5);
      setType(editingAbsence.type);
      setDiscountPayroll(editingAbsence.discountPayroll);
      const mRef = editingAbsence.referenceMonth || currentMonthRef;
      setReferenceMonth(mRef);
      setStatus(editingAbsence.status);
      setReason(editingAbsence.reason || '');
      setNotes(editingAbsence.notes || '');

      const res = computeDiscount(
        editingAbsence.employeeId,
        unit,
        editingAbsence.daysCount || 1,
        editingAbsence.absenceHours || 2.5,
        editingAbsence.discountPayroll
      );
      setDiscountAmount(editingAbsence.discountAmount !== undefined ? editingAbsence.discountAmount : res.discountAmount);
      setCalculationMemory(editingAbsence.calculationMemory || res.calculationMemory);
    } else {
      setSelectedEmployeeId('');
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setEndDate(today);
      setDaysCount(1);
      setAbsenceUnit('dias');
      setAbsenceHours(2.5);
      setType('injustificada');
      setDiscountPayroll(true);
      setReferenceMonth(currentMonthRef);
      setStatus('pendente');
      setReason('');
      setNotes('');
      setDiscountAmount(0);
      setCalculationMemory('Selecione um funcionário para calcular o desconto.');
    }
  }, [isOpen, editingAbsence, currentMonthRef]);

  if (!isOpen) return null;

  const handleEmployeeChange = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) {
      setDiscountAmount(0);
      setCalculationMemory('Selecione um funcionário para calcular o desconto.');
      return;
    }
    const res = computeDiscount(empId, absenceUnit, daysCount, absenceHours, discountPayroll);
    setDiscountAmount(res.discountAmount);
    setCalculationMemory(res.calculationMemory);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    const calc = computeDiscount(
      selectedEmployeeId,
      absenceUnit,
      daysCount,
      absenceHours,
      discountPayroll
    );

    const finalMemory = discountPayroll ? (calculationMemory || calc.calculationMemory) : undefined;
    const finalHours = absenceUnit === 'horas' ? Number(absenceHours) : undefined;
    const finalDiscount = discountPayroll ? (discountAmount || 83.33) : 0;

    const recordToSave = {
      id: editingAbsence ? editingAbsence.id : `abs_${Date.now()}_${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeRole: emp.role,
      date,
      endDate: endDate || undefined,
      daysCount: absenceUnit === 'horas' ? 1 : daysCount,
      absenceUnit,
      absenceHours: finalHours,
      calculationMemory: finalMemory,
      type,
      tipo: 'falta_injustificada',
      tipo_registro: 'falta_injustificada',
      discountPayroll,
      discountAmount: finalDiscount,
      desconto: finalDiscount,
      referenceMonth,
      status,
      reason: reason || undefined,
      notes: notes || undefined,
      createdAt: editingAbsence?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(recordToSave);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-300 dark:border-stone-700 flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0963cb] text-white">
          <h3 className="text-sm font-bold uppercase tracking-wider">
            {editingAbsence ? 'Editar Falta / Ocorrência' : 'Registrar Nova Falta / Ocorrência'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
              Colaborador *
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => handleEmployeeChange(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 font-bold"
            >
              <option value="">Selecione um funcionário...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} {emp.role ? `(${emp.role})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                Data do Ocorrido *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                Competência de Desconto *
              </label>
              <input
                type="text"
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                placeholder="MM/AAAA"
                required
                className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                Tipo da Ocorrência *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 font-bold"
              >
                <option value="injustificada">Falta Injustificada</option>
                <option value="justificada">Falta Justificada</option>
                <option value="suspensao">Suspensão Disciplinar</option>
                <option value="atraso">Atraso / Saída Antecipada</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 font-bold"
              >
                <option value="pendente">Pendente de Desconto</option>
                <option value="descontada">Já Descontada na Folha</option>
                <option value="abonada">Abonada / Cancelada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
              Motivo / Justificativa
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Ausência sem aviso prévio"
              className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-stone-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 font-bold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedEmployeeId}
              className="inline-flex items-center space-x-1.5 px-5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Falta / Ocorrência</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
