import React, { useState, useEffect } from 'react';
import { 
  CalendarX2, 
  Clock, 
  AlertCircle, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { Employee, AbsenceRecord } from '../../types';
import { 
  formatMoneyBRL, 
  formatEmployeeAdmissionDate,
  getAdmissionProportionality 
} from './payrollHelpers';
import { formatDateBR } from '../../lib/storage';

export interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAbsence: AbsenceRecord | null;
  employees: Employee[];
  currentMonthRef: string;
  selectedMonth: string;
  onSave: (recordToSave: AbsenceRecord & { tipo?: string; tipo_registro?: string; desconto?: number }) => void;
}

export const AbsenceModal: React.FC<AbsenceModalProps> = ({
  isOpen,
  onClose,
  editingAbsence,
  employees,
  currentMonthRef,
  selectedMonth,
  onSave,
}) => {
  // 1. RESET HARDCODED DOS ESTADOS INICIAIS (PADRÃO ESTRITO: 'hours'/'horas' e 8)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [absenceUnit, setAbsenceUnit] = useState<'hours' | 'horas' | 'days' | 'dias'>('hours');
  const [absenceHours, setAbsenceHours] = useState<number>(8);
  const [daysCount, setDaysCount] = useState<number>(1);
  const [type, setType] = useState<AbsenceRecord['type']>('injustificada');
  const [discountPayroll, setDiscountPayroll] = useState<boolean>(true);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [calculationMemory, setCalculationMemory] = useState<string>('');
  const [referenceMonth, setReferenceMonth] = useState<string>(() => selectedMonth || currentMonthRef || '10/2026');
  const [status, setStatus] = useState<AbsenceRecord['status']>('pendente');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const isHours = absenceUnit === 'hours' || absenceUnit === 'horas';

  // 2. CICLO DE VIDA DO MODAL: Inicialização limpa e descarte total de estados legados
  useEffect(() => {
    if (!isOpen) return;

    if (editingAbsence) {
      setSelectedEmployeeId(editingAbsence.employeeId || '');
      setDate(editingAbsence.date || new Date().toISOString().split('T')[0]);
      setEndDate(editingAbsence.endDate || editingAbsence.date || new Date().toISOString().split('T')[0]);
      const isRecordDays = editingAbsence.absenceUnit === 'dias' || (editingAbsence.absenceUnit as unknown as string) === 'days';
      setAbsenceUnit(isRecordDays ? 'dias' : 'hours');
      const hrs = (editingAbsence.absenceHours !== undefined && editingAbsence.absenceHours !== null && Number(editingAbsence.absenceHours) > 0)
        ? Number(editingAbsence.absenceHours)
        : 8;
      setAbsenceHours(hrs);
      setDaysCount(editingAbsence.daysCount || 1);
      setType(editingAbsence.type || 'injustificada');
      setDiscountPayroll(editingAbsence.discountPayroll !== false);
      const mRef = editingAbsence.referenceMonth || selectedMonth || currentMonthRef || '10/2026';
      setReferenceMonth(mRef);
      setStatus(editingAbsence.status || 'pendente');
      setReason(editingAbsence.reason || '');
      setNotes(editingAbsence.notes || '');
    } else {
      // FORMULÁRIO LIMPO: Força total em HORAS ('hours') e 8 horas
      setSelectedEmployeeId('');
      const today = new Date().toISOString().split('T')[0];
      setDate(today);
      setEndDate(today);
      setAbsenceUnit('hours');
      setAbsenceHours(8);
      setDaysCount(1);
      setType('injustificada');
      setDiscountPayroll(true);
      const mRef = selectedMonth || currentMonthRef || '10/2026';
      setReferenceMonth(mRef);
      setStatus('pendente');
      setReason('');
      setNotes('');
      setDiscountAmount(0);
      setCalculationMemory('Selecione um funcionário para calcular o desconto.');
    }
  }, [isOpen, editingAbsence]);

  // Função pura de cálculo matemático com total precisão decimal
  const calculateDiscount = (
    empId: string,
    unitIsHours: boolean,
    days: number,
    hours: number,
    isDiscount: boolean,
    mRef: string
  ) => {
    const emp = employees.find(e => e.id === empId);
    const contractualSalary = Number(emp?.salary || emp?.baseSalary) || 2500;

    if (!isDiscount || !emp) {
      const fallbackHourlyRate = contractualSalary / 220;
      const fallbackDailyRate = fallbackHourlyRate * 8;
      return {
        discountAmount: 0,
        calculationMemory: 'Desconto não aplicável em folha de pagamento.',
        isProportional: false,
        proportionalSalary: contractualSalary,
        contractualSalary,
        dailyRate: Math.round(fallbackDailyRate * 100) / 100,
        hourlyRate: Math.round(fallbackHourlyRate * 100) / 100,
        daysWorkedMonth: 30,
        admissionDateFormatted: emp?.admissionDate ? formatEmployeeAdmissionDate(emp.admissionDate) : '',
      };
    }

    const admInfo = getAdmissionProportionality(emp.admissionDate, mRef, contractualSalary);
    const isProportional = admInfo.isAdmittedInCompetenceMonth;
    const baseSalaryToUse = isProportional ? admInfo.proportionalSalary : contractualSalary;
    const daysWorkedInMonth = isProportional ? admInfo.daysWorked : 30;

    // Valor da Hora Bruto: baseSalary / 220
    const rawHourlyRate = baseSalaryToUse / 220;

    // Valor do Dia de Trabalho: (baseSalary / 220) * 8 (Equivalente a 8h de jornada)
    const rawDailyRate = rawHourlyRate * 8;

    let calculatedDiscount = 0;
    let memoryText = '';

    const baseLabel = isProportional
      ? `Salário Proporcional Admissão (${formatMoneyBRL(baseSalaryToUse)})`
      : `Salário Base (${formatMoneyBRL(contractualSalary)})`;

    if (unitIsHours) {
      const validHours = Math.max(0, Number(hours) || 0);
      // Valor da Hora Bruto * Quantidade de Horas da Falta sem arredondamento prévio
      const rawDiscount = rawHourlyRate * validHours;
      calculatedDiscount = Math.round(rawDiscount * 100) / 100;
      const hoursFormatted = validHours.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      memoryText = `Base de cálculo: ${baseLabel} | Valor da Hora: ${formatMoneyBRL(rawHourlyRate)} | Desconto aplicado para ${hoursFormatted} horas.`;
    } else {
      const validDays = Math.max(0, Number(days) || 0);
      const rawDiscount = rawDailyRate * validDays;
      calculatedDiscount = Math.round(rawDiscount * 100) / 100;
      const daysDesc = isProportional && daysWorkedInMonth < 30
        ? `Salário Proporcional Admissão (${formatMoneyBRL(baseSalaryToUse)} pelos ${daysWorkedInMonth} dias trabalhados)`
        : baseLabel;
      memoryText = `Base de cálculo: ${daysDesc} | Valor do Dia (8h): ${formatMoneyBRL(rawDailyRate)} | Desconto aplicado para ${validDays} dia(s).`;
    }

    return {
      discountAmount: calculatedDiscount,
      calculationMemory: memoryText,
      isProportional,
      proportionalSalary: baseSalaryToUse,
      contractualSalary,
      dailyRate: Math.round(rawDailyRate * 100) / 100,
      hourlyRate: Math.round(rawHourlyRate * 100) / 100,
      rawDailyRate,
      rawHourlyRate,
      daysWorkedMonth: daysWorkedInMonth,
      admissionDateFormatted: admInfo.admissionDate ? formatEmployeeAdmissionDate(admInfo.admissionDate) : '',
    };
  };

  // Cálculo memoizado de leitura para os cards de reflexo financeiro
  const currentCalc = calculateDiscount(
    selectedEmployeeId,
    isHours,
    daysCount,
    absenceHours,
    discountPayroll,
    referenceMonth
  );

  // 4. RECÁLCULO IMEDIATO: Dispara automaticamente na abertura ou na seleção do colaborador
  useEffect(() => {
    if (!isOpen) return;
    if (!selectedEmployeeId) {
      setDiscountAmount(0);
      setCalculationMemory('Selecione um funcionário para calcular o desconto.');
      return;
    }

    const calc = calculateDiscount(
      selectedEmployeeId,
      isHours,
      daysCount,
      absenceHours,
      discountPayroll,
      referenceMonth
    );
    setDiscountAmount(calc.discountAmount);
    setCalculationMemory(calc.calculationMemory);
  }, [isOpen, selectedEmployeeId, absenceUnit, absenceHours, daysCount, discountPayroll, referenceMonth]);

  if (!isOpen) return null;

  // Handlers
  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) {
      setDiscountAmount(0);
      setCalculationMemory('Selecione um funcionário para calcular o desconto.');
      return;
    }
    const calc = calculateDiscount(
      empId,
      isHours,
      daysCount,
      absenceHours,
      discountPayroll,
      referenceMonth
    );
    setDiscountAmount(calc.discountAmount);
    setCalculationMemory(calc.calculationMemory);
  };

  const handleUnitToggle = (newUnit: 'hours' | 'dias') => {
    setAbsenceUnit(newUnit);
  };

  const handleHoursChange = (hrs: number) => {
    setAbsenceHours(hrs);
  };

  const handleDaysChange = (days: number) => {
    setDaysCount(days);
    if (date && days > 0) {
      const d1 = new Date(date + 'T00:00:00');
      const endD = new Date(d1.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
      setEndDate(endD.toISOString().split('T')[0]);
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (daysCount === 1 || !endDate) {
      setEndDate(newDate);
    }
  };

  const handlePrevMonth = () => {
    const rawMonth = referenceMonth || selectedMonth || currentMonthRef || '10/2026';
    const parts = rawMonth.split('/');
    let month = Number(parts[0]) || 1;
    let year = Number(parts[1]) || 2026;
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    const newRef = `${String(newMonth).padStart(2, '0')}/${newYear}`;
    setReferenceMonth(newRef);
  };

  const handleNextMonth = () => {
    const rawMonth = referenceMonth || selectedMonth || currentMonthRef || '10/2026';
    const parts = rawMonth.split('/');
    let month = Number(parts[0]) || 1;
    let year = Number(parts[1]) || 2026;
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const newRef = `${String(newMonth).padStart(2, '0')}/${newYear}`;
    setReferenceMonth(newRef);
  };

  const handleResetToStandard = () => {
    if (!selectedEmployeeId) return;
    const calc = calculateDiscount(
      selectedEmployeeId,
      isHours,
      daysCount,
      absenceHours,
      discountPayroll,
      referenceMonth
    );
    setDiscountAmount(calc.discountAmount);
    setCalculationMemory(calc.calculationMemory);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    const calc = calculateDiscount(
      selectedEmployeeId,
      isHours,
      daysCount,
      absenceHours,
      discountPayroll,
      referenceMonth
    );

    const finalMemory = discountPayroll ? (calculationMemory || calc.calculationMemory) : undefined;
    const finalHours = isHours ? Number(absenceHours) : undefined;
    const finalDiscount = discountPayroll ? (discountAmount !== undefined && discountAmount !== null ? Number(discountAmount) : calc.discountAmount) : 0;

    const baseRecord: AbsenceRecord & { tipo?: string; tipo_registro?: string; desconto?: number } = {
      id: editingAbsence ? editingAbsence.id : `abs_${Date.now()}_${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeRole: emp.role,
      date,
      endDate: endDate || undefined,
      daysCount: isHours ? 1 : daysCount,
      absenceUnit: isHours ? 'horas' : 'dias',
      unit: isHours ? 'horas' : 'dias',
      absenceHours: finalHours,
      calculationMemory: finalMemory,
      isProportionalAdmission: calc.isProportional,
      proportionalBaseSalary: calc.isProportional ? calc.proportionalSalary : undefined,
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

    onSave(baseRecord);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden overflow-y-hidden">
      <div className="bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-2xl w-[94%] max-w-5xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] overflow-hidden overflow-y-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Header 3D Metálico Acetinado */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 rounded-t-2xl shrink-0 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
              <CalendarX2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 font-['Outfit']">
                {editingAbsence ? 'EDITAR FALTA / OCORRÊNCIA' : 'REGISTRAR FALTA / OCORRÊNCIA'}
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                Cálculo de horas fracionadas, proporcionalidade de admissão e reflexos na folha
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-2.5 text-xs bg-slate-100 dark:bg-stone-900 max-h-[82vh] overflow-y-auto scrollbar-none flex-1">
          
          {/* CARD 1: DADOS DO COLABORADOR, COMPETÊNCIA E SITUAÇÃO */}
          <div className="bg-white border border-stone-300 rounded-xl p-4 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
              
              {/* Colaborador */}
              <div className="md:col-span-5">
                <label className="block font-bold text-black mb-1">
                  Colaborador / Funcionário <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => handleEmployeeSelect(e.target.value)}
                  className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] font-semibold text-xs h-[38px]"
                  required
                >
                  <option value="">Selecione um funcionário...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role}) - Salário Base: {formatMoneyBRL(emp.salary || emp.baseSalary || 2500)}
                      {emp.admissionDate ? ` • Adm: ${formatDateBR(emp.admissionDate)}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Competência da Folha */}
              <div className="md:col-span-4">
                <label className="block font-bold text-black mb-1">
                  Competência da Folha <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center space-x-1.5 h-[38px]">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 h-[38px] px-2.5 rounded-lg border border-blue-300 dark:border-stone-700 bg-blue-100/50 dark:bg-stone-800 hover:bg-blue-200/70 dark:hover:bg-stone-700 transition cursor-pointer text-black dark:text-white shrink-0 flex items-center justify-center"
                    title="Competência Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <div 
                    style={{ backgroundColor: '#cefebd', borderColor: '#4fd716' }}
                    className="flex-1 h-[38px] flex items-center justify-center space-x-2 px-3 py-1 rounded-lg text-xs font-black text-black dark:text-white border border-[#4fd716] shadow-xs select-none"
                  >
                    <span>Competência:</span>
                    <span className="text-black font-black text-sm">{referenceMonth || selectedMonth || '10/2026'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 h-[38px] px-2.5 rounded-lg border border-blue-300 dark:border-stone-700 bg-blue-100/50 dark:bg-stone-800 hover:bg-blue-200/70 dark:hover:bg-stone-700 transition cursor-pointer text-black dark:text-white shrink-0 flex items-center justify-center"
                    title="Próxima Competência"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Situação / Status */}
              <div className="md:col-span-3">
                <label className="block font-bold text-black mb-1">
                  Situação / Status
                </label>
                <select
                  value={status}
                  disabled={!selectedEmployeeId}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-xs disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed h-[38px]"
                >
                  <option value="pendente">Pendente de Aplicação</option>
                  <option value="descontada">Já Descontada na Folha</option>
                  <option value="justificada">Justificada pela Diretoria</option>
                  <option value="abonada">Abonada (Sem Prejuízo)</option>
                </select>
              </div>

            </div>

            {/* ALERTA DE PROPORCIONALIDADE DE ADMISSÃO */}
            {selectedEmployeeId && currentCalc.isProportional && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-[#0963cb] shrink-0 mt-0.5" />
                <div className="text-[11px] text-blue-900 leading-relaxed">
                  <span className="font-bold">Regra de Proporcionalidade de Admissão:</span> Colaborador admitido no mês em{' '}
                  <strong>{currentCalc.admissionDateFormatted}</strong>. Salário Proporcional da competência:{' '}
                  <strong className="text-blue-950">{formatMoneyBRL(currentCalc.proportionalSalary)}</strong>{' '}
                  ({currentCalc.daysWorkedMonth} dias trabalhados de 30). O valor do dia é calculado por{' '}
                  <strong>{currentCalc.daysWorkedMonth}</strong> e a hora pela jornada padrão de <strong>220h</strong>.
                </div>
              </div>
            )}
          </div>

          {/* CARD 2: DETALHES DA AUSÊNCIA E REFLEXO FINANCEIRO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            
            {/* COLUNA ESQUERDA: ENQUADRAMENTO DA FALTA */}
            <div className="bg-white border border-stone-300 rounded-xl p-4 shadow-xs space-y-3">
              <h4 className="font-bold text-black text-xs uppercase tracking-wider flex items-center space-x-1.5 pb-2 border-b border-stone-200">
                <CalendarX2 className="w-4 h-4 text-[#0963cb]" />
                <span>Enquadramento & Medição da Ausência</span>
              </h4>

              {/* Tipo de Ocorrência */}
              <div>
                <label className="block font-bold text-black mb-1">
                  Tipo da Ocorrência <span className="text-rose-600">*</span>
                </label>
                <select
                  value={type}
                  disabled={!selectedEmployeeId}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-semibold outline-none focus:ring-1 focus:ring-[#0963cb] disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                >
                  <option value="injustificada">Falta Injustificada</option>
                  <option value="suspensao">Suspensão Disciplinar</option>
                  <option value="justificada">Falta Justificada (Sem Atestado)</option>
                  <option value="atraso">Atraso / Saída Antecipada</option>
                </select>
              </div>

              {/* Datas da Ausência */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Data Inicial da Ausência <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    disabled={!selectedEmployeeId}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb] disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    disabled={!selectedEmployeeId}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black font-medium outline-none focus:ring-1 focus:ring-[#0963cb] disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 3. UNIDADE DE MEDIDA: SELETOR TOGGLE [ Dia Todo ] ou [ Horas ] */}
              <div>
                <label className="block font-bold text-black mb-1.5">
                  Tipo de Ausência (Unidade de Medida) <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 border border-stone-300 rounded-xl">
                  {/* BOTÃO DIA TODO */}
                  <button
                    type="button"
                    disabled={!selectedEmployeeId}
                    onClick={() => handleUnitToggle('dias')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      !isHours
                        ? 'bg-[#0963cb] text-white shadow-xs'
                        : 'text-stone-700 hover:text-black hover:bg-stone-200/60'
                    }`}
                  >
                    <span>📅 Dia Todo</span>
                  </button>

                  {/* BOTÃO HORAS: PADRÃO ESTRITO ATIVO (AZUL) */}
                  <button
                    type="button"
                    disabled={!selectedEmployeeId}
                    onClick={() => handleUnitToggle('hours')}
                    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isHours
                        ? 'bg-[#0963cb] text-white shadow-xs'
                        : 'text-stone-700 hover:text-black hover:bg-stone-200/60'
                    }`}
                  >
                    <span>⏱️ Horas</span>
                  </button>
                </div>
              </div>

              {/* QUANTIDADE CONFORME UNIDADE SELECIONADA */}
              {!isHours ? (
                <div>
                  <label className="block font-bold text-black mb-1">
                    Dias de Ausência (Números Inteiros) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={!selectedEmployeeId}
                    value={daysCount || ''}
                    onChange={(e) => handleDaysChange(parseInt(e.target.value) || 1)}
                    className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-sm disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Cálculo diário proporcional aos dias trabalhados do mês.
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-black mb-1">
                    Quantidade de Horas (Horas Fracionadas) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    disabled={!selectedEmployeeId}
                    value={absenceHours !== undefined ? absenceHours : 8}
                    onChange={(e) => handleHoursChange(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 8 (oito horas), 2.5 (duas horas e meia)..."
                    className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-black font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-sm disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    required
                  />
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Aceita frações decimais (ex: 8 horas, 4 horas, 2.5 horas). Jornada padrão: 220 horas mensais.
                  </span>
                </div>
              )}

              {/* Motivo e Observações */}
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block font-bold text-black mb-1">
                    Motivo Apresentado / Relato da Falta
                  </label>
                  <input
                    type="text"
                    value={reason}
                    disabled={!selectedEmployeeId}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex: Não compareceu ao corte de silagem / Atraso no início do turno..."
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] text-xs font-medium disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block font-bold text-black mb-1">
                    Observações Internas (RH / Supervisão de Campo)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    disabled={!selectedEmployeeId}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Registro sobre contato, advertência aplicada, compensação de jornada..."
                    className="w-full p-2 border border-stone-300 rounded-lg bg-white text-black outline-none focus:ring-1 focus:ring-[#0963cb] text-xs font-medium disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* COLUNA DIREITA: REFLEXO FINANCEIRO */}
            <div className="bg-white border border-stone-300 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <h4 className="font-bold text-black text-xs uppercase tracking-wider flex items-center space-x-1.5">
                    <span className="text-[#0963cb] font-black">$</span>
                    <span>Reflexo Financeiro na Folha de Pagamento</span>
                  </h4>
                  <label className="flex items-center space-x-2 text-xs font-bold text-black cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={discountPayroll}
                      disabled={!selectedEmployeeId}
                      onChange={(e) => setDiscountPayroll(e.target.checked)}
                      className="rounded border-stone-300 text-[#0963cb] focus:ring-[#0963cb] w-4 h-4 cursor-pointer"
                    />
                    <span>Aplicar Desconto</span>
                  </label>
                </div>

                {discountPayroll ? (
                  <div className="space-y-3 pt-3">
                    
                    {/* Linha com valores de referência */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-stone-50 border border-stone-200 rounded-xl">
                      <div>
                        <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                          Salário Contratual Cheio
                        </span>
                        <span className="text-xs font-bold text-stone-800">
                          {formatMoneyBRL(currentCalc.contractualSalary)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                          Base Utilizada no Cálculo
                        </span>
                        <span className="text-xs font-bold text-blue-900">
                          {formatMoneyBRL(currentCalc.proportionalSalary)}
                          {currentCalc.isProportional && (
                            <span className="text-[10px] text-blue-700 block font-normal">
                              (Proporcional Admissão)
                            </span>
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                          Valor do Dia de Trabalho
                        </span>
                        <span className="text-xs font-bold text-stone-800">
                          {formatMoneyBRL(currentCalc.dailyRate)} / dia
                          <span className="text-[10px] text-stone-500 block font-normal">
                            (Equivalente a 8h de jornada)
                          </span>
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wider">
                          Valor da Hora de Trabalho
                        </span>
                        <span className="text-xs font-bold text-stone-800">
                          {formatMoneyBRL(currentCalc.hourlyRate)} / hora
                          <span className="text-[10px] text-stone-500 block font-normal">
                            (÷ 220 horas jornada)
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Input do Valor Total do Desconto */}
                    <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-black uppercase tracking-wider text-rose-950">
                          Valor Total do Desconto em Folha
                        </label>
                        <button
                          type="button"
                          disabled={!selectedEmployeeId}
                          onClick={handleResetToStandard}
                          className="text-[10px] text-[#0963cb] hover:underline font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Recalcular valor exato pela fórmula"
                        >
                          ↺ Recalcular Padrão
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-800 font-bold text-base">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!selectedEmployeeId}
                          value={discountAmount !== undefined ? discountAmount : ''}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          className="w-full pl-10 pr-3 py-2 border border-rose-300 rounded-lg bg-white text-rose-800 font-black text-lg outline-none focus:ring-2 focus:ring-rose-500 shadow-inner disabled:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed"
                          required
                        />
                      </div>
                    </div>

                    {/* Detalhamento do Reflexo Financeiro (Memória de Cálculo) */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                      <div className="flex items-center space-x-1.5 text-amber-900 font-bold text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>Memória de Cálculo do Desconto:</span>
                      </div>
                      <p className="text-[11px] text-amber-950 leading-relaxed font-mono bg-white/80 p-2.5 rounded-lg border border-amber-200/80 break-words">
                        {calculationMemory || currentCalc.calculationMemory}
                      </p>
                      <span className="text-[10px] text-stone-500 block italic">
                        Exibição transparente para controle da folha de pagamento e auditoria de RH.
                      </span>
                    </div>

                  </div>
                ) : (
                  <div className="py-8 text-center bg-stone-50 border border-dashed border-stone-300 rounded-xl text-stone-500">
                    <Check className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
                    <p className="font-bold text-xs text-stone-700">Ocorrência sem impacto financeiro</p>
                    <p className="text-[11px] text-stone-500 max-w-xs mx-auto mt-1">
                      O colaborador terá a justificativa registrada no histórico, sem dedução no contracheque.
                    </p>
                  </div>
                )}
              </div>

              {/* Resumo Rodapé da Coluna Direita */}
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-600">
                <span>Unidade ativa: <strong>{isHours ? 'Horas Fracionadas' : 'Dias Inteiros'}</strong></span>
                <span>Status: <strong className="uppercase text-black">{status}</strong></span>
              </div>
            </div>

          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex items-center justify-between pt-3 border-t border-black/15">
            <div className="text-[11px] text-blue-950 font-medium hidden sm:block">
              Sincronizado automaticamente via Supabase Realtime (tabela <code className="bg-white/60 px-1 py-0.5 rounded text-[#0963cb] font-bold">public.rh_faltas</code>)
            </div>
            <div className="flex items-center space-x-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white border border-stone-300 text-stone-700 font-bold hover:bg-stone-50 cursor-pointer transition shadow-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!selectedEmployeeId}
                className="px-5 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Falta / Ocorrência</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
