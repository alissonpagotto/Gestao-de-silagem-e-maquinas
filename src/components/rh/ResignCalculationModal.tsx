import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calculator,
  Printer,
  Save,
  FileText,
  AlertCircle,
  Clock,
  X,
  BookmarkCheck,
  RefreshCw,
  Calendar,
  Building2,
  DollarSign
} from 'lucide-react';
import {
  Employee,
  SalaryAdvance,
  AbsenceRecord,
  CompanyProfile,
  TerminationRecord,
  TerminationReason,
  NoticeType,
  TerminationCalculation,
  VacationRecord,
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
} from '../../lib/storage';
import { toValidUUID } from '../../lib/supabaseService';
import {
  formatMoneyBRL,
  parseRawOrFormattedToFloat,
  formatNumberBRL,
} from './payrollHelpers';
import { useConfirm } from '../../context/ConfirmContext';

interface ResignCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  vacations?: VacationRecord[];
  companyProfile?: CompanyProfile;
  advances?: SalaryAdvance[];
  absences?: AbsenceRecord[];
  initialTermination?: TerminationRecord | null;
  activeTenantId: string;
  onSaveTermination: (record: TerminationRecord, markInactive: boolean) => Promise<void>;
  onSaveDraft: (record: TerminationRecord) => Promise<void>;
  onViewTRCT: (record: TerminationRecord) => void;
}

export const ResignCalculationModal: React.FC<ResignCalculationModalProps> = ({
  isOpen,
  onClose,
  employees = [],
  vacations = [],
  companyProfile,
  advances = [],
  absences = [],
  initialTermination = null,
  activeTenantId,
  onSaveTermination,
  onSaveDraft,
  onViewTRCT,
}) => {
  const { confirm } = useConfirm();

  // Estados do Formulário de Rescisão
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [reason, setReason] = useState<TerminationReason>('sem_justa_causa');
  const [noticeType, setNoticeType] = useState<NoticeType>('indenizado');
  const [admissionDate, setAdmissionDate] = useState<string>('');
  const [terminationDate, setTerminationDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [baseSalaryDisplay, setBaseSalaryDisplay] = useState<string>('0,00');

  // Parâmetros de Férias e FGTS
  const [vacationExpiredPeriods, setVacationExpiredPeriods] = useState<number>(0);
  const [vacationExpiredInput, setVacationExpiredInput] = useState<string>('0');
  const [customFgtsBalance, setCustomFgtsBalance] = useState<string>('');
  const [isManualFgts, setIsManualFgts] = useState<boolean>(false);
  const [markInactive, setMarkInactive] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  // Controles de Inclusão e Deduções
  const [includeFgtsFine, setIncludeFgtsFine] = useState<boolean>(false);
  const [includeInssDiscount, setIncludeInssDiscount] = useState<boolean>(true);
  const [customAbsencesDiscount, setCustomAbsencesDiscount] = useState<string>('0,00');
  const [customAdvancesDiscount, setCustomAdvancesDiscount] = useState<string>('0,00');
  const [otherDeductionsInput, setOtherDeductionsInput] = useState<string>('0,00');

  // Feedbacks
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [draftBannerMessage, setDraftBannerMessage] = useState<string | null>(null);
  const [vacationAlert, setVacationAlert] = useState<string | null>(null);

  // Carrega ou reseta os campos sempre que o modal abre ou initialTermination muda
  useEffect(() => {
    if (!isOpen) return;

    if (initialTermination) {
      // Modo Edição / Visualização de Rescisão Existente
      setSelectedEmployeeId(initialTermination.employeeId || '');
      setReason(initialTermination.reason || 'sem_justa_causa');
      setNoticeType(initialTermination.noticeType || 'indenizado');
      setAdmissionDate(initialTermination.admissionDate || '');
      setTerminationDate(initialTermination.terminationDate || new Date().toISOString().split('T')[0]);
      
      const sal = initialTermination.baseSalary ?? 0;
      setBaseSalary(sal);
      setBaseSalaryDisplay(formatNumberBRL(sal));

      const vac = initialTermination.vacationExpiredPeriods ?? initialTermination.calculation?.vacationExpiredCount ?? 0;
      setVacationExpiredPeriods(vac);
      setVacationExpiredInput(vac > 0 ? String(vac) : '0');

      setCustomFgtsBalance(initialTermination.customFgtsBalance || '');
      setIsManualFgts(Boolean(initialTermination.isManualFgts || (initialTermination.customFgtsBalance && initialTermination.customFgtsBalance !== '0,00')));
      setIncludeFgtsFine(Boolean(initialTermination.includeFgtsFine));
      setIncludeInssDiscount(initialTermination.includeInssDiscount !== undefined ? initialTermination.includeInssDiscount : true);
      setCustomAbsencesDiscount(initialTermination.customAbsencesDiscount || '0,00');
      setCustomAdvancesDiscount(initialTermination.customAdvancesDiscount || '0,00');
      setOtherDeductionsInput(initialTermination.otherDeductionsInput || '0,00');
      setNotes(initialTermination.notes || '');
      setMarkInactive(Boolean(initialTermination.markEmployeeInactive ?? (initialTermination.status === 'homologado')));
      setDraftBannerMessage(
        initialTermination.status === 'rascunho'
          ? `Rascunho de "${initialTermination.employeeName}" carregado. Faça os ajustes e salve ou homologue.`
          : null
      );
      setVacationAlert(null);
    } else {
      // Modo Novo Cálculo (Campos limpos)
      setSelectedEmployeeId('');
      setReason('sem_justa_causa');
      setNoticeType('indenizado');
      setAdmissionDate('');
      setTerminationDate(new Date().toISOString().split('T')[0]);
      setBaseSalary(0);
      setBaseSalaryDisplay('0,00');
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setCustomFgtsBalance('');
      setIsManualFgts(false);
      setIncludeFgtsFine(false);
      setIncludeInssDiscount(true);
      setCustomAbsencesDiscount('0,00');
      setCustomAdvancesDiscount('0,00');
      setOtherDeductionsInput('0,00');
      setNotes('');
      setMarkInactive(true);
      setDraftBannerMessage(null);
      setVacationAlert(null);
    }
  }, [isOpen, initialTermination]);

  // Colaborador Selecionado
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Ao selecionar um funcionário em um novo cálculo, preenche dados iniciais
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) {
      setBaseSalary(0);
      setBaseSalaryDisplay('0,00');
      setAdmissionDate('');
      setCustomAdvancesDiscount('0,00');
      setCustomAbsencesDiscount('0,00');
      setOtherDeductionsInput('0,00');
      setCustomFgtsBalance('');
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setDraftBannerMessage(null);
      setVacationAlert(null);
      return;
    }

    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    const rawSal = emp.baseSalary ?? emp.salary ?? 0;
    const sal = typeof rawSal === 'number' ? rawSal : parseRawOrFormattedToFloat(rawSal);
    setBaseSalary(sal);
    setBaseSalaryDisplay(formatNumberBRL(sal));

    const cleanAdm = emp.admissionDate ? emp.admissionDate.split('T')[0] : '';
    setAdmissionDate(cleanAdm);
    const todayIso = new Date().toISOString().split('T')[0];
    setTerminationDate(todayIso);

    // Calcular períodos de férias vencidas conforme tempo de contrato
    let initialExpiredVacations = 0;
    if (cleanAdm) {
      const s = new Date(cleanAdm + 'T12:00:00');
      const e = new Date(todayIso + 'T12:00:00');
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        let completedP = 0;
        let anniv = new Date(s);
        while (true) {
          const nextA = new Date(anniv);
          nextA.setFullYear(nextA.getFullYear() + 1);
          if (nextA <= e) {
            completedP++;
            anniv = nextA;
          } else {
            break;
          }
        }
        if (completedP > 0) {
          const empVacs = (vacations || []).filter(
            (v) => v.employeeId === emp.id && (v.status === 'concluido' || v.status === 'em_gozo' || v.daysCount >= 20)
          );
          initialExpiredVacations = Math.max(0, completedP - empVacs.length);
        }
      }
    }
    setVacationExpiredPeriods(initialExpiredVacations);
    setVacationExpiredInput(String(initialExpiredVacations));

    // Buscar adiantamentos pendentes em aberto deste colaborador
    const pendingAdvances = advances
      .filter((a) => a.employeeId === emp.id && a.status === 'pendente')
      .reduce((sum, a) => sum + (a.amount || 0), 0);
    setCustomAdvancesDiscount(pendingAdvances > 0 ? formatNumberBRL(pendingAdvances) : '0,00');

    // Buscar faltas injustificadas pendentes de desconto
    const pendingAbsences = absences
      .filter((ab) => ab.employeeId === emp.id && ab.type === 'injustificada' && ab.status === 'pendente')
      .reduce((sum, ab) => sum + (ab.discountAmount || (sal > 0 ? (sal / 30) * ab.daysCount : 0)), 0);
    setCustomAbsencesDiscount(pendingAbsences > 0 ? formatNumberBRL(pendingAbsences) : '0,00');

    setIsManualFgts(false);
    setCustomFgtsBalance('');
    setIncludeFgtsFine(false);
    setIncludeInssDiscount(true);
    setOtherDeductionsInput('0,00');
    setNotes('');
  };

  // Análise de Datas e Proporções Rigorosamente CLT
  const dateAnalysis = useMemo(() => {
    if (!admissionDate || !terminationDate) {
      return {
        totalDays: 0,
        totalMonths: 0,
        yearsOfService: 0,
        completedAcquisitionPeriods: 0,
        unexhaustedExpiredPeriods: 0,
        workedDaysCurrentMonth: 0,
        thirteenthMonths: 0,
        thirteenthMonthsWorked: 0,
        thirteenthMonthsProjectedNotice: 0,
        vacationProportionalMonths: 0,
        vacationMonthsWorked: 0,
        vacationMonthsProjectedNotice: 0,
        noticeDays: 30,
        projectedTerminationDate: '',
        isProjectedNotice: false,
        contractHasLessThanOneYear: true,
      };
    }

    const start = new Date(admissionDate + 'T12:00:00');
    const end = new Date(terminationDate + 'T12:00:00');

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return {
        totalDays: 0,
        totalMonths: 0,
        yearsOfService: 0,
        completedAcquisitionPeriods: 0,
        unexhaustedExpiredPeriods: 0,
        workedDaysCurrentMonth: 0,
        thirteenthMonths: 0,
        thirteenthMonthsWorked: 0,
        thirteenthMonthsProjectedNotice: 0,
        vacationProportionalMonths: 0,
        vacationMonthsWorked: 0,
        vacationMonthsProjectedNotice: 0,
        noticeDays: 30,
        projectedTerminationDate: '',
        isProjectedNotice: false,
        contractHasLessThanOneYear: true,
      };
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const totalMonths = Math.max(1, Math.round(totalDays / 30.4375));

    let completedAcquisitionPeriods = 0;
    let lastAnniversary = new Date(start);
    while (true) {
      const nextAnniv = new Date(lastAnniversary);
      nextAnniv.setFullYear(nextAnniv.getFullYear() + 1);
      if (nextAnniv <= end) {
        completedAcquisitionPeriods++;
        lastAnniversary = nextAnniv;
      } else {
        break;
      }
    }
    const contractHasLessThanOneYear = completedAcquisitionPeriods === 0;

    const empVacations = (vacations || []).filter(
      (v) => v.employeeId === selectedEmployee?.id && (v.status === 'concluido' || v.status === 'em_gozo' || v.daysCount >= 20)
    );
    const enjoyedVacationsCount = empVacations.length;
    const unexhaustedExpiredPeriods = contractHasLessThanOneYear
      ? 0
      : Math.max(0, completedAcquisitionPeriods - enjoyedVacationsCount);

    const yearsOfService = completedAcquisitionPeriods;
    const noticeDays = Math.min(90, 30 + yearsOfService * 3);

    const isProjectedNotice = noticeType === 'indenizado' && (reason === 'sem_justa_causa' || reason === 'acordo_mutuo');
    const projectedEnd = isProjectedNotice
      ? new Date(end.getTime() + noticeDays * 24 * 60 * 60 * 1000)
      : end;
    const projectedTerminationDate = projectedEnd.toISOString().split('T')[0];

    const endDay = end.getDate();
    const workedDaysCurrentMonth = Math.min(30, endDay);

    const calcThirteenthAvos = (cutoff: Date): number => {
      const targetYear = cutoff.getFullYear();
      let avos = 0;
      const startM = (start.getFullYear() === targetYear) ? start.getMonth() : 0;
      const endM = cutoff.getMonth();

      for (let m = startM; m <= endM; m++) {
        let days = 0;
        if (m === startM && start.getFullYear() === targetYear) {
          const daysInFirst = new Date(targetYear, m + 1, 0).getDate();
          days = daysInFirst - start.getDate() + 1;
        } else if (m === endM) {
          days = cutoff.getDate();
        } else {
          days = 30;
        }
        if (days >= 15) {
          avos++;
        }
      }
      return Math.min(12, Math.max(0, avos));
    };

    const thirteenthMonthsWorked = calcThirteenthAvos(end);
    const thirteenthMonthsTotal = isProjectedNotice ? calcThirteenthAvos(projectedEnd) : thirteenthMonthsWorked;
    const thirteenthMonthsProjectedNotice = Math.max(0, thirteenthMonthsTotal - thirteenthMonthsWorked);

    const calcVacationAvos = (cutoff: Date): number => {
      let avos = 0;
      let curr = new Date(lastAnniversary);
      while (avos < 12) {
        const next = new Date(curr);
        next.setMonth(next.getMonth() + 1);
        if (next <= cutoff) {
          avos++;
          curr = next;
        } else {
          const diffMs = cutoff.getTime() - curr.getTime();
          const rem = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (rem >= 15) {
            avos++;
          }
          break;
        }
      }
      return Math.min(12, Math.max(0, avos));
    };

    const vacationMonthsWorked = calcVacationAvos(end);
    const vacationMonthsTotal = isProjectedNotice ? calcVacationAvos(projectedEnd) : vacationMonthsWorked;
    const vacationMonthsProjectedNotice = Math.max(0, vacationMonthsTotal - vacationMonthsWorked);

    return {
      totalDays,
      totalMonths,
      yearsOfService,
      completedAcquisitionPeriods,
      unexhaustedExpiredPeriods,
      workedDaysCurrentMonth,
      thirteenthMonths: thirteenthMonthsTotal,
      thirteenthMonthsWorked,
      thirteenthMonthsProjectedNotice,
      vacationProportionalMonths: vacationMonthsTotal,
      vacationMonthsWorked,
      vacationMonthsProjectedNotice,
      noticeDays,
      projectedTerminationDate,
      isProjectedNotice,
      contractHasLessThanOneYear,
    };
  }, [admissionDate, terminationDate, noticeType, reason, vacations, selectedEmployee]);

  // Função auxiliar de cálculo do INSS progressivo brasileiro
  const calculateINSS = (base: number): number => {
    if (base <= 0) return 0;
    let inss = 0;
    const faixas = [
      { limite: 1412.00, aliq: 0.075 },
      { limite: 2666.68, aliq: 0.09 },
      { limite: 4000.03, aliq: 0.12 },
      { limite: 7786.02, aliq: 0.14 }
    ];

    let anterior = 0;
    for (const f of faixas) {
      if (base > anterior) {
        const baseFaixa = Math.min(base, f.limite) - anterior;
        inss += baseFaixa * f.aliq;
        anterior = f.limite;
      } else {
        break;
      }
    }
    return Math.min(inss, 908.86);
  };

  // Motor de Cálculo da Rescisão
  const calculation: TerminationCalculation = useMemo(() => {
    const salary = typeof baseSalary === 'number' ? baseSalary : parseRawOrFormattedToFloat(baseSalaryDisplay);
    if (salary <= 0 || !selectedEmployee) {
      return {
        workedDaysCurrentMonth: 0,
        salaryBalance: 0,
        thirteenthProportionalMonths: 0,
        thirteenthProportionalAmount: 0,
        vacationExpiredCount: 0,
        vacationExpiredAmount: 0,
        vacationProportionalMonths: 0,
        vacationProportionalAmount: 0,
        vacationOneThirdBonus: 0,
        noticeDays: 30,
        noticeAmount: 0,
        fgtsEstimatedBalance: 0,
        fgtsFineRate: 0,
        fgtsFineAmount: 0,
        grossTotal: 0,
        includeFgtsFine,
        includeInssDiscount,
        inssSalaryBalance: 0,
        inssThirteenth: 0,
        irrfDiscount: 0,
        absenceDiscount: 0,
        advancesDiscount: 0,
        noticeDeduction: 0,
        otherDeductions: 0,
        totalDeductions: 0,
        netTotal: 0,
      };
    }

    const dailyRate = salary / 30;
    const workedDays = dateAnalysis.workedDaysCurrentMonth;

    // 1. Saldo de Salário
    const salaryBalance = Number((dailyRate * workedDays).toFixed(2));

    // 2. Aviso Prévio
    let noticeAmount = 0;
    let noticeDeduction = 0;
    if (reason === 'sem_justa_causa') {
      if (noticeType === 'indenizado') {
        noticeAmount = Number((dailyRate * dateAnalysis.noticeDays).toFixed(2));
      }
    } else if (reason === 'acordo_mutuo') {
      if (noticeType === 'indenizado') {
        noticeAmount = Number(((dailyRate * dateAnalysis.noticeDays) / 2).toFixed(2));
      }
    } else if (reason === 'pedido_demissao') {
      if (noticeType === 'dispensado') {
        noticeDeduction = 0;
      } else if (noticeType === 'indenizado') {
        noticeDeduction = Number(salary.toFixed(2));
      }
    }

    // 3. 13º Salário Proporcional
    let thirteenthMonths = dateAnalysis.thirteenthMonths;
    let thirteenthProportionalAmount = 0;
    if (reason !== 'com_justa_causa') {
      thirteenthProportionalAmount = Number(((salary / 12) * thirteenthMonths).toFixed(2));
    } else {
      thirteenthMonths = 0;
    }

    // 4. Férias Vencidas
    const effectiveExpiredCount = dateAnalysis.contractHasLessThanOneYear
      ? 0
      : Math.min(dateAnalysis.completedAcquisitionPeriods, Math.max(0, vacationExpiredPeriods));
    const vacationExpiredAmount = Number((effectiveExpiredCount * salary).toFixed(2));

    // 5. Férias Proporcionais
    let vacationPropMonths = dateAnalysis.vacationProportionalMonths;
    let vacationProportionalAmount = 0;
    if (reason !== 'com_justa_causa') {
      vacationProportionalAmount = Number(((salary / 12) * vacationPropMonths).toFixed(2));
    } else {
      vacationPropMonths = 0;
    }

    // 6. 1/3 Constitucional de Férias
    let vacationOneThirdBonus = 0;
    if (vacationExpiredAmount > 0 || vacationProportionalAmount > 0) {
      vacationOneThirdBonus = Number(((vacationExpiredAmount + vacationProportionalAmount) / 3).toFixed(2));
    }

    // 7. Estimativa do FGTS e Multa Rescisória
    let fgtsBase = 0;
    if (isManualFgts && customFgtsBalance !== '') {
      fgtsBase = parseRawOrFormattedToFloat(customFgtsBalance);
    } else {
      fgtsBase = Number((salary * 0.08 * dateAnalysis.totalMonths).toFixed(2));
    }

    let fgtsFineRate = 0;
    if (reason === 'sem_justa_causa') {
      fgtsFineRate = 40;
    } else if (reason === 'acordo_mutuo') {
      fgtsFineRate = 20;
    }
    const calculatedFgtsFine = Number(((fgtsBase * fgtsFineRate) / 100).toFixed(2));
    const fgtsFineAmount = includeFgtsFine ? calculatedFgtsFine : 0;

    // Total Bruto dos Proventos
    const grossTotal = Number((
      salaryBalance +
      noticeAmount +
      thirteenthProportionalAmount +
      vacationExpiredAmount +
      vacationProportionalAmount +
      vacationOneThirdBonus +
      fgtsFineAmount
    ).toFixed(2));

    // Deduções
    const rawInssSalary = Number(calculateINSS(salaryBalance).toFixed(2));
    const rawInssThirteenth = Number(calculateINSS(thirteenthProportionalAmount).toFixed(2));

    const inssSalaryBalance = includeInssDiscount ? rawInssSalary : 0;
    const inssThirteenth = includeInssDiscount ? rawInssThirteenth : 0;

    const irrfBase = Math.max(0, salaryBalance - inssSalaryBalance);
    let irrfDiscount = 0;
    if (irrfBase > 2826.65) {
      irrfDiscount = Number(((irrfBase * 0.075) - 169.44).toFixed(2));
    }

    const absenceDiscount = parseRawOrFormattedToFloat(customAbsencesDiscount);
    const advancesDiscount = parseRawOrFormattedToFloat(customAdvancesDiscount);
    const otherDeductions = parseRawOrFormattedToFloat(otherDeductionsInput);

    const totalDeductions = Number((
      inssSalaryBalance +
      inssThirteenth +
      irrfDiscount +
      absenceDiscount +
      advancesDiscount +
      noticeDeduction +
      otherDeductions
    ).toFixed(2));

    const netTotal = Math.max(0, Number((grossTotal - totalDeductions).toFixed(2)));

    return {
      workedDaysCurrentMonth: workedDays,
      salaryBalance,
      thirteenthProportionalMonths: thirteenthMonths,
      thirteenthProportionalAmount,
      vacationExpiredCount: vacationExpiredPeriods,
      vacationExpiredAmount,
      vacationProportionalMonths: vacationPropMonths,
      vacationProportionalAmount,
      vacationOneThirdBonus,
      noticeDays: dateAnalysis.noticeDays,
      noticeAmount,
      fgtsEstimatedBalance: fgtsBase,
      fgtsFineRate,
      fgtsFineAmount,
      grossTotal,
      includeFgtsFine,
      includeInssDiscount,
      inssSalaryBalance,
      inssThirteenth,
      irrfDiscount,
      absenceDiscount,
      advancesDiscount,
      noticeDeduction,
      otherDeductions,
      totalDeductions,
      netTotal,
    };
  }, [
    baseSalary,
    baseSalaryDisplay,
    selectedEmployee,
    reason,
    noticeType,
    dateAnalysis,
    vacationExpiredPeriods,
    isManualFgts,
    customFgtsBalance,
    customAbsencesDiscount,
    customAdvancesDiscount,
    otherDeductionsInput,
    includeFgtsFine,
    includeInssDiscount,
  ]);

  // Manipuladores de Input Monetário
  const handleBaseSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      setBaseSalary(0);
      setBaseSalaryDisplay('0,00');
      return;
    }
    const num = parseInt(digits, 10) / 100;
    setBaseSalary(num);
    setBaseSalaryDisplay(formatNumberBRL(num));
  };

  const handleMoneyChange = (setter: (val: string) => void) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '');
      if (!digits) {
        setter('0,00');
        return;
      }
      const num = parseInt(digits, 10) / 100;
      setter(formatNumberBRL(num));
    };
  };

  const handleVacationExpiredChange = (valStr: string) => {
    if (dateAnalysis.contractHasLessThanOneYear) {
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setVacationAlert(
        `Trava CLT: O contrato possui menos de 12 meses (${dateAnalysis.totalDays} dias trabalhados). É vedado lançar férias vencidas integrais (Art. 130 CLT). O período trabalhado é pago nas Férias Proporcionais (${dateAnalysis.vacationProportionalMonths}/12).`
      );
      return;
    }

    const normalized = valStr.replace(',', '.').trim();
    if (!normalized) {
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setVacationAlert(null);
      return;
    }
    const num = Math.floor(parseFloat(normalized));
    if (isNaN(num) || num <= 0) {
      setVacationExpiredPeriods(0);
      setVacationExpiredInput('0');
      setVacationAlert(null);
      return;
    }

    const maxAllowed = dateAnalysis.completedAcquisitionPeriods;
    if (num > maxAllowed) {
      setVacationAlert(
        `O contrato possui ${maxAllowed} período(s) aquisitivo(s) completo(s) de 12 meses. O valor foi ajustado para ${maxAllowed} para evitar pagamento em duplicidade.`
      );
      setVacationExpiredPeriods(maxAllowed);
      setVacationExpiredInput(String(maxAllowed));
      return;
    }

    setVacationAlert(null);
    setVacationExpiredPeriods(num);
    setVacationExpiredInput(String(num));
  };

  // Salvar Rescisão Definitiva (Homologação)
  const handleSave = async () => {
    if (!selectedEmployee) {
      await confirm({
        title: 'Selecione um Funcionário',
        message: 'Por favor, selecione o colaborador para calcular e registrar a rescisão.',
        confirmLabel: 'Entendido',
        variant: 'primary',
      });
      return;
    }

    const isConfirmed = await confirm({
      title: 'Confirmar Homologação da Rescisão',
      message: `Deseja registrar a rescisão de ${selectedEmployee.name} com valor líquido de ${formatMoneyBRL(calculation.netTotal)}?${
        markInactive ? ' O status do colaborador será alterado para inativo.' : ''
      }`,
      confirmLabel: 'Confirmar e Homologar',
      cancelLabel: 'Revisar',
      variant: 'primary',
    });

    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      const canonicalId = toValidUUID(
        initialTermination?.id || `term_${activeTenantId}_${selectedEmployee.id}_${terminationDate}`
      );

      const newRecord: TerminationRecord = {
        id: canonicalId,
        companyId: activeTenantId,
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeRole: selectedEmployee.role,
        employeeCpf: selectedEmployee.cpf,
        admissionDate: admissionDate || selectedEmployee.admissionDate || '',
        terminationDate: terminationDate,
        reason,
        noticeType,
        baseSalary,
        calculation,
        includeFgtsFine,
        includeInssDiscount,
        vacationExpiredPeriods,
        customFgtsBalance,
        isManualFgts,
        customAbsencesDiscount,
        customAdvancesDiscount,
        otherDeductionsInput,
        notes,
        status: 'homologado',
        markEmployeeInactive: markInactive,
        createdAt: initialTermination?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSaveTermination(newRecord, markInactive);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar rescisão:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Salvar como Rascunho
  const handleSaveDraftClick = async () => {
    if (!selectedEmployee) {
      await confirm({
        title: 'Selecione um Funcionário',
        message: 'Por favor, selecione um colaborador antes de salvar o rascunho da rescisão.',
        confirmLabel: 'Entendido',
        variant: 'primary',
      });
      return;
    }

    setIsSavingDraft(true);
    try {
      const canonicalId = toValidUUID(
        initialTermination?.id || `draft_${activeTenantId}_${selectedEmployee.id}`
      );

      const draftRecord: TerminationRecord = {
        id: canonicalId,
        companyId: activeTenantId,
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        employeeRole: selectedEmployee.role || 'Colaborador',
        employeeCpf: selectedEmployee.cpf,
        admissionDate: admissionDate || selectedEmployee.admissionDate || '',
        terminationDate: terminationDate,
        reason,
        noticeType,
        baseSalary,
        calculation,
        includeFgtsFine,
        includeInssDiscount,
        vacationExpiredPeriods,
        customFgtsBalance,
        isManualFgts,
        customAbsencesDiscount,
        customAdvancesDiscount,
        otherDeductionsInput,
        notes,
        status: 'rascunho',
        markEmployeeInactive: false,
        createdAt: initialTermination?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSaveDraft(draftRecord);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar rascunho:', err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden overflow-y-hidden">
      <div className="bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-2xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
      {/* Top Header do Modal - Moldura Metálica 3D Acetinada */}
      <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 text-slate-800 dark:text-stone-100 flex items-center justify-between border-b border-slate-400 dark:border-stone-700 shrink-0 rounded-t-2xl shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
            <Calculator className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 flex items-center gap-2">
                <span>{initialTermination ? 'EDITAR CÁLCULO RESCISÓRIO' : 'NOVA RESCISÃO DE COLABORADOR'}</span>
                {initialTermination?.status === 'rascunho' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    Rascunho em Andamento
                  </span>
                )}
              </h2>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
              {selectedEmployee 
                ? `Colaborador: ${selectedEmployee.name} (${selectedEmployee.role || 'Geral'})` 
                : 'Selecione o funcionário e configure os parâmetros da rescisão oficial CLT'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          title="Fechar"
        >
          <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
        </button>
      </div>

        {/* Corpo com Scroll: Grid de Formulário (8 col) e Painel Resumo (4 col) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          
          {draftBannerMessage && (
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-semibold">{draftBannerMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setDraftBannerMessage(null)}
                className="text-amber-600 hover:text-amber-900 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Coluna da Esquerda: Formulário Completo (8 colunas) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Seção 1: Seleção de Funcionário e Motivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-stone-200 mb-1">
                    Selecione o Funcionário <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => handleSelectEmployee(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">-- Selecione o colaborador --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role || 'Colaborador'}) {emp.status === 'inativo' ? '— [Inativo]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 dark:text-stone-200 mb-1">
                    Motivo do Desligamento <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as TerminationReason)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="sem_justa_causa">Demissão sem Justa Causa (Empregador)</option>
                    <option value="pedido_demissao">Pedido de Demissão (Empregado)</option>
                    <option value="com_justa_causa">Demissão com Justa Causa</option>
                    <option value="acordo_mutuo">Acordo entre as Partes (Art. 484-A CLT)</option>
                    <option value="termino_contrato">Término de Contrato de Experiência / Prazo</option>
                  </select>
                </div>
              </div>

              {/* Seção 2: Datas, Salário Base e Aviso Prévio */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Data de Admissão
                  </label>
                  <input
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Data de Desligamento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={terminationDate}
                    onChange={(e) => setTerminationDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Salário Base (R$) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={baseSalaryDisplay}
                    onChange={handleBaseSalaryChange}
                    onFocus={(e) => e.target.select()}
                    placeholder="0,00"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Aviso Prévio
                  </label>
                  <select
                    value={noticeType}
                    onChange={(e) => setNoticeType(e.target.value as NoticeType)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="indenizado">Indenizado</option>
                    <option value="trabalhado">Trabalhado</option>
                    <option value="dispensado">Dispensado / N/A</option>
                  </select>
                </div>
              </div>

              {/* Seção 3: Férias Vencidas e FGTS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-stone-800/40 rounded-xl border border-slate-200/80 dark:border-stone-800">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300">
                      Férias Vencidas (Períodos CLT)
                    </label>
                    {dateAnalysis.contractHasLessThanOneYear ? (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        Trava CLT (&lt; 1 ano)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 dark:text-stone-400">
                        Máx: {dateAnalysis.completedAcquisitionPeriods} per.
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max={dateAnalysis.completedAcquisitionPeriods}
                      disabled={dateAnalysis.contractHasLessThanOneYear}
                      value={vacationExpiredInput}
                      onChange={(e) => handleVacationExpiredChange(e.target.value)}
                      placeholder="0"
                      className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        dateAnalysis.contractHasLessThanOneYear
                          ? 'bg-slate-100 dark:bg-stone-900 border-slate-200 dark:border-stone-800 text-slate-400 cursor-not-allowed'
                          : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-900 dark:text-white'
                      }`}
                    />

                    {/* Presets de Períodos */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {!dateAnalysis.contractHasLessThanOneYear &&
                        Array.from({ length: Math.min(4, dateAnalysis.completedAcquisitionPeriods + 1) }, (_, i) => i).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleVacationExpiredChange(String(preset))}
                            className={`px-2 py-0.5 text-[10px] rounded-md font-bold transition border cursor-pointer ${
                              vacationExpiredPeriods === preset
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                : 'bg-white dark:bg-stone-800 text-slate-600 dark:text-stone-300 border-slate-200 dark:border-stone-700 hover:bg-slate-100'
                            }`}
                          >
                            {preset === 0 ? '0 per.' : `${preset} per.`}
                          </button>
                        ))}
                    </div>

                    {vacationAlert && (
                      <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 flex items-start justify-between gap-1.5">
                        <div className="flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span className="whitespace-pre-line leading-tight font-medium">{vacationAlert}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVacationAlert(null)}
                          className="text-amber-700 hover:text-amber-900 cursor-pointer shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-stone-300">
                      Saldo FGTS para Multa ({calculation.fgtsFineRate}%)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualFgts(!isManualFgts)}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline cursor-pointer"
                    >
                      {isManualFgts ? 'Calcular automaticamente' : 'Informar saldo exato'}
                    </button>
                  </div>

                  {isManualFgts ? (
                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customFgtsBalance}
                        onChange={handleMoneyChange(setCustomFgtsBalance)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0,00"
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                      />
                      {parseRawOrFormattedToFloat(customFgtsBalance) > 0 && includeFgtsFine && calculation.fgtsFineAmount > 0 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1">
                          (Base informada: {formatMoneyBRL(parseRawOrFormattedToFloat(customFgtsBalance))})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 bg-slate-200/70 dark:bg-stone-700/60 rounded-lg text-xs text-slate-800 dark:text-stone-200 font-bold flex items-center justify-between">
                      {includeFgtsFine && calculation.fgtsFineAmount > 0 ? (
                        <>
                          <span className="text-slate-700 dark:text-stone-300 font-medium">Estimativa automática</span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                            (Multa {calculation.fgtsFineRate}%: {formatMoneyBRL(calculation.fgtsFineAmount)})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500 dark:text-stone-400 font-normal text-[11px]">
                          Multa FGTS não inclusa / Sem saldo real informado
                        </span>
                      )}
                    </div>
                  )}

                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={includeFgtsFine}
                      onChange={(e) => setIncludeFgtsFine(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Calcular Multa do FGTS ({calculation.fgtsFineRate}%)</span>
                  </label>
                </div>
              </div>

              {/* Seção 4: Deduções e Ajustes Financeiros */}
              <div className="p-3 bg-slate-50 dark:bg-stone-800/40 rounded-xl border border-slate-200/80 dark:border-stone-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="block text-xs font-black text-slate-800 dark:text-stone-200">
                    Ajuste de Deduções Rescisórias
                  </span>

                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer bg-white dark:bg-stone-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-stone-700 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={includeInssDiscount}
                      onChange={(e) => setIncludeInssDiscount(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Calcular Desconto de INSS</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-1">
                      Vales / Adiantamentos (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customAdvancesDiscount}
                      onChange={handleMoneyChange(setCustomAdvancesDiscount)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0,00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-1">
                      Faltas / Atrasos (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customAbsencesDiscount}
                      onChange={handleMoneyChange(setCustomAbsencesDiscount)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0,00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-1">
                      Outras Deduções (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={otherDeductionsInput}
                      onChange={handleMoneyChange(setOtherDeductionsInput)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0,00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 5: Observações e Inativação */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300">
                  Observações Gerais / Anotações
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais sobre o desligamento, entrega de EPIs, CTPS..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />

                <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={markInactive}
                    onChange={(e) => setMarkInactive(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Atualizar status do colaborador para "Inativo / Desligado" no sistema ao homologar</span>
                </label>
              </div>

            </div>

            {/* Coluna da Direita: Painel Escuro de Valor Líquido & Discriminação (4 colunas) */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Card Escuro Principal: Líquido a Pagar */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl border border-slate-700 shadow-md space-y-3">
                <div className="flex items-center justify-between text-slate-300 text-xs">
                  <span className="uppercase font-bold tracking-wider">Valor Líquido da Rescisão</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    CLT Oficial
                  </span>
                </div>

                <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                  {formatMoneyBRL(calculation.netTotal)}
                </div>

                <div className="pt-3 border-t border-slate-700/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Total Bruto Proventos:</span>
                    <span className="font-bold text-white">{formatMoneyBRL(calculation.grossTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Total Deduções:</span>
                    <span className="font-bold text-rose-400">- {formatMoneyBRL(calculation.totalDeductions)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-700/50">
                    <span>Multa FGTS ({calculation.fgtsFineRate}%):</span>
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      {includeFgtsFine ? formatMoneyBRL(calculation.fgtsFineAmount) : 'R$ 0,00'}
                    </span>
                  </div>
                </div>

                {selectedEmployee && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewTRCT({
                        id: initialTermination?.id || 'temp_preview',
                        companyId: activeTenantId,
                        employeeId: selectedEmployee.id,
                        employeeName: selectedEmployee.name,
                        employeeRole: selectedEmployee.role,
                        employeeCpf: selectedEmployee.cpf,
                        admissionDate: admissionDate || selectedEmployee.admissionDate || '',
                        terminationDate,
                        reason,
                        noticeType,
                        baseSalary,
                        calculation,
                        includeFgtsFine,
                        includeInssDiscount,
                        customFgtsBalance,
                        isManualFgts,
                        status: initialTermination?.status || 'rascunho',
                        createdAt: initialTermination?.createdAt || new Date().toISOString(),
                      });
                    }}
                    className="w-full mt-2 inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Visualizar Termo de Rescisão (TRCT)</span>
                  </button>
                )}
              </div>

              {/* Discriminação Rápida das Verbas */}
              <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl p-4 shadow-xs space-y-2 text-xs">
                <h3 className="font-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-stone-800 pb-2 flex items-center justify-between">
                  <span>Discriminação das Verbas</span>
                  <span className="text-[10px] font-normal text-slate-500">Regras CLT</span>
                </h3>

                <div className="space-y-1.5 text-slate-600 dark:text-stone-300">
                  <div className="flex justify-between">
                    <span>Saldo Salário ({calculation.workedDaysCurrentMonth}d):</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.salaryBalance)}</span>
                  </div>

                  {calculation.noticeAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Aviso Prévio ({calculation.noticeDays}d):</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.noticeAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>13º Salário ({calculation.thirteenthProportionalMonths}/12):</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.thirteenthProportionalAmount)}</span>
                  </div>

                  {calculation.vacationExpiredAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Férias Vencidas ({calculation.vacationExpiredCount} per.):</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.vacationExpiredAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Férias Prop. ({calculation.vacationProportionalMonths}/12):</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.vacationProportionalAmount)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>1/3 Constitucional Férias:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatMoneyBRL(calculation.vacationOneThirdBonus)}</span>
                  </div>

                  {includeFgtsFine && calculation.fgtsFineAmount > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                      <span>Multa Rescisória FGTS ({calculation.fgtsFineRate}%):</span>
                      <span>{formatMoneyBRL(calculation.fgtsFineAmount)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 dark:border-stone-800 space-y-1 text-rose-600 dark:text-rose-400">
                    {includeInssDiscount && (
                      <>
                        <div className="flex justify-between">
                          <span>INSS Saldo de Salário:</span>
                          <span className="font-bold">- {formatMoneyBRL(calculation.inssSalaryBalance)}</span>
                        </div>
                        {calculation.inssThirteenth > 0 && (
                          <div className="flex justify-between">
                            <span>INSS 13º Salário:</span>
                            <span className="font-bold">- {formatMoneyBRL(calculation.inssThirteenth)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {calculation.advancesDiscount > 0 && (
                      <div className="flex justify-between">
                        <span>Vales e Adiantamentos:</span>
                        <span className="font-bold">- {formatMoneyBRL(calculation.advancesDiscount)}</span>
                      </div>
                    )}
                    {calculation.absenceDiscount > 0 && (
                      <div className="flex justify-between">
                        <span>Faltas e Atrasos:</span>
                        <span className="font-bold">- {formatMoneyBRL(calculation.absenceDiscount)}</span>
                      </div>
                    )}
                    {calculation.noticeDeduction > 0 && (
                      <div className="flex justify-between">
                        <span>Aviso Prévio Não Cumprido:</span>
                        <span className="font-bold">- {formatMoneyBRL(calculation.noticeDeduction)}</span>
                      </div>
                    )}
                    {calculation.otherDeductions > 0 && (
                      <div className="flex justify-between">
                        <span>Outras Deduções:</span>
                        <span className="font-bold">- {formatMoneyBRL(calculation.otherDeductions)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Rodapé Fixo com Ações */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-stone-900 border-t border-slate-200 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraftClick}
              disabled={isSavingDraft || isSubmitting || !selectedEmployee}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Salvar rascunho sem inativar colaborador"
            >
              {isSavingDraft ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <BookmarkCheck className="w-4 h-4" />
              )}
              <span>{isSavingDraft ? 'Salvando...' : 'Salvar Rascunho'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || isSavingDraft || !selectedEmployee}
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'Homologando...' : 'Homologar Rescisão'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
