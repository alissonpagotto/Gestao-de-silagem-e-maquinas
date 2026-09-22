import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  Printer, 
  Save, 
  Trash2, 
  FileText, 
  UserX, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  UserCheck, 
  X, 
  Plus, 
  Clock, 
  Eye, 
  Building2,
  Phone,
  RefreshCw,
  Scale,
  BookmarkCheck,
  FileEdit
} from 'lucide-react';
import { 
  Employee, 
  SalaryAdvance, 
  AbsenceRecord, 
  CompanyProfile,
  TerminationRecord, 
  TerminationReason, 
  NoticeType,
  TerminationCalculation 
} from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredTerminations, 
  saveStoredTerminations 
} from '../../lib/storage';
import {
  saveCloudTerminations,
  fetchCloudTerminations
} from '../../lib/supabaseService';
import { 
  formatMoneyBRL, 
  parseMoneyToFloat, 
  parseRawOrFormattedToFloat,
  formatNumberBRL,
  formatCPF, 
  formatEmployeeAdmissionDate 
} from './payrollHelpers';
import { useConfirm } from '../../context/ConfirmContext';

interface RescisaoTabProps {
  employees: Employee[];
  companyProfile?: CompanyProfile;
  advances?: SalaryAdvance[];
  absences?: AbsenceRecord[];
  onSaveEmployees?: (employees: Employee[]) => void;
}

export const RescisaoTab: React.FC<RescisaoTabProps> = ({
  employees = [],
  companyProfile,
  advances = [],
  absences = [],
  onSaveEmployees,
}) => {
  const { confirm } = useConfirm();

  // Histórico de Rescisões persistido
  const [terminations, setTerminations] = useState<TerminationRecord[]>(() => getStoredTerminations());

  // Estado do Formulário
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

  // Controles de Inclusão e Cálculo
  const [includeFgtsFine, setIncludeFgtsFine] = useState<boolean>(false);
  const [includeInssDiscount, setIncludeInssDiscount] = useState<boolean>(true);

  // Controle de Rascunhos e Persistência
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [draftBannerMessage, setDraftBannerMessage] = useState<string | null>(null);

  // Sincronização inicial com o Supabase
  useEffect(() => {
    fetchCloudTerminations().then((cloudList) => {
      if (cloudList && Array.isArray(cloudList) && cloudList.length > 0) {
        setTerminations((prev) => {
          const map = new Map<string, TerminationRecord>();
          prev.forEach((t) => map.set(t.id, t));
          cloudList.forEach((t) => map.set(t.id, t));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveStoredTerminations(merged);
          return merged;
        });
      }
    }).catch((err) => console.warn('Aviso ao sincronizar rescisões com o Supabase:', err));
  }, []);

  // Deduções adicionais ajustáveis
  const [customAbsencesDiscount, setCustomAbsencesDiscount] = useState<string>('0,00');
  const [customAdvancesDiscount, setCustomAdvancesDiscount] = useState<string>('0,00');
  const [otherDeductionsInput, setOtherDeductionsInput] = useState<string>('0,00');

  // Modal de Impressão / TRCT
  const [viewingTRCT, setViewingTRCT] = useState<TerminationRecord | null>(null);

  // Handlers para formatação monetária segura
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

  const handleBaseSalaryPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (!pasted) return;
    const num = parseRawOrFormattedToFloat(pasted);
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

  const handleMoneyPaste = (setter: (val: string) => void) => {
    return (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').trim();
      if (!pasted) return;
      const num = parseRawOrFormattedToFloat(pasted);
      setter(formatNumberBRL(num));
    };
  };

  // Colaborador Selecionado
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Ao selecionar funcionário, verifica se há rascunho salvo para restaurar ou preenche com dados cadastrais
  useEffect(() => {
    if (selectedEmployee) {
      // Verifica se já existe um rascunho 'Em Andamento' para este colaborador
      const existingDraft = terminations.find(
        (t) => t.employeeId === selectedEmployee.id && t.status === 'rascunho'
      );

      if (existingDraft) {
        // Carrega com fidelidade todos os campos salvos no rascunho
        setReason(existingDraft.reason || 'sem_justa_causa');
        setNoticeType(existingDraft.noticeType || 'indenizado');
        setAdmissionDate(existingDraft.admissionDate || selectedEmployee.admissionDate?.split('T')[0] || '');
        setTerminationDate(existingDraft.terminationDate || new Date().toISOString().split('T')[0]);

        const sal = existingDraft.baseSalary ?? (selectedEmployee.baseSalary ?? selectedEmployee.salary ?? 0);
        setBaseSalary(sal);
        setBaseSalaryDisplay(formatNumberBRL(sal));

        const vacCount = existingDraft.vacationExpiredPeriods ?? existingDraft.calculation?.vacationExpiredCount ?? 0;
        setVacationExpiredPeriods(vacCount);
        setVacationExpiredInput(vacCount > 0 ? String(vacCount) : '0');

        setCustomFgtsBalance(existingDraft.customFgtsBalance || '');
        setIsManualFgts(Boolean(existingDraft.isManualFgts || (existingDraft.customFgtsBalance && existingDraft.customFgtsBalance !== '0,00')));
        setIncludeFgtsFine(Boolean(existingDraft.includeFgtsFine));
        setIncludeInssDiscount(existingDraft.includeInssDiscount !== undefined ? existingDraft.includeInssDiscount : true);
        setCustomAbsencesDiscount(existingDraft.customAbsencesDiscount || '0,00');
        setCustomAdvancesDiscount(existingDraft.customAdvancesDiscount || '0,00');
        setOtherDeductionsInput(existingDraft.otherDeductionsInput || '0,00');
        setNotes(existingDraft.notes || '');
        setDraftBannerMessage(`Rascunho recuperado: Carregamos as informações salvas anteriormente para ${selectedEmployee.name}.`);
      } else {
        setDraftBannerMessage(null);
        const rawSal = selectedEmployee.baseSalary ?? selectedEmployee.salary ?? 0;
        const sal = typeof rawSal === 'number' ? rawSal : parseRawOrFormattedToFloat(rawSal);
        setBaseSalary(sal);
        setBaseSalaryDisplay(formatNumberBRL(sal));
        
        if (selectedEmployee.admissionDate) {
          const cleanDate = selectedEmployee.admissionDate.split('T')[0];
          setAdmissionDate(cleanDate);
        } else {
          setAdmissionDate('');
        }

        setTerminationDate(new Date().toISOString().split('T')[0]);
        setVacationExpiredPeriods(0);
        setVacationExpiredInput('0');

        // Buscar adiantamentos pendentes em aberto deste colaborador
        const pendingAdvances = advances
          .filter((a) => a.employeeId === selectedEmployee.id && a.status === 'pendente')
          .reduce((sum, a) => sum + (a.amount || 0), 0);
        setCustomAdvancesDiscount(pendingAdvances > 0 ? formatNumberBRL(pendingAdvances) : '0,00');

        // Buscar faltas injustificadas pendentes de desconto
        const pendingAbsences = absences
          .filter((ab) => ab.employeeId === selectedEmployee.id && ab.type === 'injustificada' && ab.status === 'pendente')
          .reduce((sum, ab) => sum + (ab.discountAmount || (sal > 0 ? (sal / 30) * ab.daysCount : 0)), 0);
        setCustomAbsencesDiscount(pendingAbsences > 0 ? formatNumberBRL(pendingAbsences) : '0,00');

        setIsManualFgts(false);
        setCustomFgtsBalance('');
        setIncludeFgtsFine(false);
        setIncludeInssDiscount(true);
        setOtherDeductionsInput('0,00');
        setNotes('');
      }
    } else {
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
    }
  }, [selectedEmployeeId, selectedEmployee, advances, absences, terminations]);

  // Cálculo de datas e proporções
  const dateAnalysis = useMemo(() => {
    if (!admissionDate || !terminationDate) {
      return {
        totalDays: 0,
        totalMonths: 0,
        yearsOfService: 0,
        workedDaysCurrentMonth: 0,
        thirteenthMonths: 0,
        vacationProportionalMonths: 0,
        noticeDays: 30,
      };
    }

    const start = new Date(admissionDate + 'T12:00:00');
    const end = new Date(terminationDate + 'T12:00:00');

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return {
        totalDays: 0,
        totalMonths: 0,
        yearsOfService: 0,
        workedDaysCurrentMonth: 0,
        thirteenthMonths: 0,
        vacationProportionalMonths: 0,
        noticeDays: 30,
      };
    }

    // Dias trabalhados no mês do desligamento (dia 1 até dia do término, limitado a 30)
    const endDay = end.getDate();
    const workedDaysCurrentMonth = Math.min(30, endDay);

    // Meses trabalhados no ano corrente para 13º salário proporcional
    const endMonth = end.getMonth(); // 0 a 11
    let thirteenthMonths = endMonth; // meses completos anteriores no ano
    if (endDay >= 15) {
      thirteenthMonths += 1; // 15 dias ou mais contam como 1 mês completo
    }

    // Se a admissão foi no mesmo ano do término, contar apenas a partir do mês de admissão
    if (start.getFullYear() === end.getFullYear()) {
      const startMonth = start.getMonth();
      const startDay = start.getDate();
      let startOffset = startMonth;
      if (startDay > 15) {
        startOffset += 1; // Se admitido após dia 15, não conta o primeiro mês
      }
      thirteenthMonths = Math.max(0, thirteenthMonths - startOffset);
    }
    thirteenthMonths = Math.min(12, Math.max(0, thirteenthMonths));

    // Meses para Férias Proporcionais (período aquisitivo incompleto)
    // Calcula o aniversário de admissão mais recente
    let lastAnniversary = new Date(start);
    while (true) {
      const nextAnniv = new Date(lastAnniversary);
      nextAnniv.setFullYear(nextAnniv.getFullYear() + 1);
      if (nextAnniv <= end) {
        lastAnniversary = nextAnniv;
      } else {
        break;
      }
    }

    // Diferença em meses entre último aniversário e a rescisão
    let diffMonths = (end.getFullYear() - lastAnniversary.getFullYear()) * 12 + (end.getMonth() - lastAnniversary.getMonth());
    if (end.getDate() - lastAnniversary.getDate() >= 15) {
      diffMonths += 1;
    }
    const vacationProportionalMonths = Math.min(12, Math.max(0, diffMonths));

    // Anos completos de serviço (para Lei do Aviso Prévio Proporcional: 3 dias por ano completo, até 90 dias)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const yearsOfService = Math.floor(totalDays / 365.25);
    const noticeDays = Math.min(90, 30 + yearsOfService * 3);

    const totalMonths = Math.max(1, Math.round(totalDays / 30.4375));

    return {
      totalDays,
      totalMonths,
      yearsOfService,
      workedDaysCurrentMonth,
      thirteenthMonths,
      vacationProportionalMonths,
      noticeDays,
    };
  }, [admissionDate, terminationDate]);

  // Função auxiliar de cálculo do INSS progressivo brasileiro
  const calculateINSS = (base: number): number => {
    if (base <= 0) return 0;
    // Tabela INSS vigente
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
    return Math.min(inss, 908.86); // Teto
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
        // Empregado não cumpriu e indeniza a empresa (desconto de 30 dias)
        noticeDeduction = Number((salary).toFixed(2));
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
    const vacationExpiredAmount = Number((vacationExpiredPeriods * salary).toFixed(2));

    // 5. Férias Proporcionais
    let vacationPropMonths = dateAnalysis.vacationProportionalMonths;
    let vacationProportionalAmount = 0;
    if (reason !== 'com_justa_causa') {
      vacationProportionalAmount = Number(((salary / 12) * vacationPropMonths).toFixed(2));
    } else {
      vacationPropMonths = 0;
    }

    // 6. 1/3 Constitucional de Férias (sobre vencidas + proporcionais)
    let vacationOneThirdBonus = 0;
    if (vacationExpiredAmount > 0 || vacationProportionalAmount > 0) {
      vacationOneThirdBonus = Number(((vacationExpiredAmount + vacationProportionalAmount) / 3).toFixed(2));
    }

    // 7. Estimativa do FGTS e Multa Rescisória
    let fgtsBase = 0;
    if (isManualFgts && customFgtsBalance !== '') {
      fgtsBase = parseRawOrFormattedToFloat(customFgtsBalance);
    } else {
      // 8% do salário por mês trabalhado
      fgtsBase = Number((salary * 0.08 * dateAnalysis.totalMonths).toFixed(2));
    }

    let fgtsFineRate = 0;
    if (reason === 'sem_justa_causa') {
      fgtsFineRate = 40;
    } else if (reason === 'acordo_mutuo') {
      fgtsFineRate = 20;
    }
    const calculatedFgtsFine = Number(((fgtsBase * fgtsFineRate) / 100).toFixed(2));
    // Se a opção "Calcular Multa do FGTS (40%)" estiver desmarcada, a multa é estritamente ZERADA
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

    // Descontos / Deduções
    const rawInssSalary = Number(calculateINSS(salaryBalance).toFixed(2));
    const rawInssThirteenth = Number(calculateINSS(thirteenthProportionalAmount).toFixed(2));

    const inssSalaryBalance = includeInssDiscount ? rawInssSalary : 0;
    const inssThirteenth = includeInssDiscount ? rawInssThirteenth : 0;
    
    // IRRF Simplificado (se aplicável após dedução INSS)
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

  // Salvar Rescisão no Histórico
  const handleSaveTermination = async () => {
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
      message: `Deseja registrar o desligamento de ${selectedEmployee.name} com valor líquido de ${formatMoneyBRL(calculation.netTotal)}?${
        markInactive ? ' O status do colaborador será alterado para inativo.' : ''
      }`,
      confirmLabel: 'Confirmar e Salvar',
      cancelLabel: 'Revisar',
      variant: 'primary',
    });

    if (!isConfirmed) return;

    const newRecord: TerminationRecord = {
      id: `term_${Date.now()}`,
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
      createdAt: new Date().toISOString(),
    };

    // Remove eventual rascunho anterior deste funcionário
    const otherTerminations = terminations.filter(
      (t) => !(t.employeeId === selectedEmployee.id && t.status === 'rascunho') && t.id !== newRecord.id
    );
    const updated = [newRecord, ...otherTerminations];
    setTerminations(updated);
    saveStoredTerminations(updated);
    saveCloudTerminations(updated).catch(() => {});
    setDraftBannerMessage(null);

    // Atualizar status do funcionário se solicitado
    if (markInactive && onSaveEmployees) {
      const updatedEmployees = employees.map((emp) => {
        if (emp.id === selectedEmployee.id) {
          return {
            ...emp,
            status: 'inativo' as const,
            active: false,
            terminationDate: terminationDate,
          };
        }
        return emp;
      });
      onSaveEmployees(updatedEmployees);
    }

    setViewingTRCT(newRecord);
  };

  // Salvar Rascunho (Em Andamento) sem alterar o status do colaborador para inativo
  const handleSaveDraft = async () => {
    if (!selectedEmployee) {
      await confirm({
        title: 'Selecione um Funcionário',
        message: 'Por favor, selecione um colaborador antes de salvar o rascunho da rescisão.',
        confirmLabel: 'Entendido',
        cancelLabel: '',
        variant: 'primary',
      });
      return;
    }

    setIsSavingDraft(true);
    try {
      const existingDraft = terminations.find(
        (t) => t.employeeId === selectedEmployee.id && t.status === 'rascunho'
      );

      const draftRecord: TerminationRecord = {
        id: existingDraft?.id || `draft_${Date.now()}`,
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
        markEmployeeInactive: false, // JAMAIS altera status para inativo em rascunho
        createdAt: existingDraft?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const otherTerminations = terminations.filter((t) => t.id !== draftRecord.id);
      const updated = [draftRecord, ...otherTerminations];

      setTerminations(updated);
      saveStoredTerminations(updated);

      // Persistência na nuvem (Supabase)
      await saveCloudTerminations(updated);

      setDraftBannerMessage(`Rascunho de "${selectedEmployee.name}" salvo com sucesso! O colaborador continua ATIVO.`);
    } catch (e) {
      console.error('Erro ao salvar rascunho no Supabase:', e);
      setDraftBannerMessage(`Rascunho de "${selectedEmployee.name}" salvo localmente.`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Retoma o preenchimento de um rascunho
  const handleResumeDraft = (draft: TerminationRecord) => {
    setSelectedEmployeeId(draft.employeeId);
    setReason(draft.reason || 'sem_justa_causa');
    setNoticeType(draft.noticeType || 'indenizado');
    setAdmissionDate(draft.admissionDate || '');
    setTerminationDate(draft.terminationDate || new Date().toISOString().split('T')[0]);
    setBaseSalary(draft.baseSalary || 0);
    setBaseSalaryDisplay(formatNumberBRL(draft.baseSalary || 0));

    const vac = draft.vacationExpiredPeriods ?? draft.calculation?.vacationExpiredCount ?? 0;
    setVacationExpiredPeriods(vac);
    setVacationExpiredInput(vac > 0 ? String(vac) : '0');

    setCustomFgtsBalance(draft.customFgtsBalance || '');
    setIsManualFgts(Boolean(draft.isManualFgts || (draft.customFgtsBalance && draft.customFgtsBalance !== '0,00')));
    setIncludeFgtsFine(Boolean(draft.includeFgtsFine));
    setIncludeInssDiscount(draft.includeInssDiscount !== undefined ? draft.includeInssDiscount : true);
    setCustomAbsencesDiscount(draft.customAbsencesDiscount || '0,00');
    setCustomAdvancesDiscount(draft.customAdvancesDiscount || '0,00');
    setOtherDeductionsInput(draft.otherDeductionsInput || '0,00');
    setNotes(draft.notes || '');
    setDraftBannerMessage(`Rascunho de "${draft.employeeName}" carregado nos campos com sucesso. Continue o preenchimento!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Excluir registro ou rascunho do histórico
  const handleDeleteTermination = async (id: string, empName: string) => {
    const targetItem = terminations.find((t) => t.id === id);
    const isDraft = targetItem?.status === 'rascunho';

    const isConfirmed = await confirm({
      title: isDraft ? 'Excluir Rascunho' : 'Excluir Rescisão',
      message: `Deseja realmente remover o ${isDraft ? 'rascunho em andamento' : 'registro de rescisão'} de "${empName}"?`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      const updated = terminations.filter((t) => t.id !== id);
      setTerminations(updated);
      saveStoredTerminations(updated);
      saveCloudTerminations(updated).catch(() => {});
    }
  };

  // Nome formatado do motivo
  const getReasonLabel = (r: TerminationReason): string => {
    switch (r) {
      case 'sem_justa_causa':
        return 'Demissão sem Justa Causa (Empregador)';
      case 'com_justa_causa':
        return 'Demissão com Justa Causa (Falta Grave)';
      case 'pedido_demissao':
        return 'Pedido de Demissão (Iniciativa do Empregado)';
      case 'acordo_mutuo':
        return 'Acordo entre as Partes (Art. 484-A CLT)';
      case 'termino_contrato':
        return 'Término de Contrato de Experiência / Prazo';
      default:
        return r;
    }
  };

  return (
    <div className="w-full space-y-4 antialiased">
      
      {/* 1. Grade Superior: Formulário de Cálculo & Resumo de Destaque */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Formulário Principal (8 colunas) */}
        <div className="lg:col-span-8 bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Simulador & Cálculo Rescisório CLT
                </h2>
                <p className="text-xs text-slate-500 dark:text-stone-400">
                  Preencha os dados do colaborador para apurar verbas, FGTS e deduções
                </p>
              </div>
            </div>
            
            {selectedEmployee && (
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300 border border-slate-200 dark:border-stone-700">
                Cargo: {selectedEmployee.role || 'Geral'}
              </span>
            )}
          </div>

          {/* Seção 1: Seleção de Funcionário e Motivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-stone-200 mb-1">
                Selecione o Funcionário <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
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
                onPaste={handleBaseSalaryPaste}
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

          {/* Seção 3: Parâmetros Férias e Saldo FGTS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-stone-800/40 rounded-xl border border-slate-200/80 dark:border-stone-800">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                Férias Vencidas (Períodos Integrais)
              </label>
              <select
                value={vacationExpiredPeriods}
                onChange={(e) => setVacationExpiredPeriods(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value={0}>0 períodos vencidos</option>
                <option value={1}>1 período (1 ano vencido)</option>
                <option value={2}>2 períodos (2 anos vencidos)</option>
              </select>
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
                <input
                  type="text"
                  inputMode="numeric"
                  value={customFgtsBalance}
                  onChange={handleMoneyChange(setCustomFgtsBalance)}
                  onPaste={handleMoneyPaste(setCustomFgtsBalance)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                />
              ) : (
                <div className="px-2.5 py-1.5 bg-slate-200/70 dark:bg-stone-700/60 rounded-lg text-xs text-slate-800 dark:text-stone-200 font-bold flex items-center justify-between">
                  <span>Estimado: {formatMoneyBRL(calculation.fgtsEstimatedBalance)}</span>
                  <span className="text-[10px] text-slate-500 dark:text-stone-400 font-normal">
                    (Multa: {formatMoneyBRL(calculation.fgtsFineAmount)})
                  </span>
                </div>
              )}

              {/* Checkbox Multa FGTS */}
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={includeFgtsFine}
                  onChange={(e) => setIncludeFgtsFine(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Calcular Multa do FGTS (40%)</span>
              </label>
            </div>
          </div>

          {/* Seção 4: Deduções e Ajustes Financeiros */}
          <div className="p-3 bg-slate-50 dark:bg-stone-800/40 rounded-xl border border-slate-200/80 dark:border-stone-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="block text-xs font-black text-slate-800 dark:text-stone-200">
                Ajuste de Deduções Rescisórias
              </span>

              {/* Checkbox Desconto de INSS */}
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
                  Vales / Adiantamentos em Aberto (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAdvancesDiscount}
                  onChange={handleMoneyChange(setCustomAdvancesDiscount)}
                  onPaste={handleMoneyPaste(setCustomAdvancesDiscount)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-1">
                  Faltas e Atrasos Injustificados (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAbsencesDiscount}
                  onChange={handleMoneyChange(setCustomAbsencesDiscount)}
                  onPaste={handleMoneyPaste(setCustomAbsencesDiscount)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-1">
                  Outras Deduções / Convênios (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otherDeductionsInput}
                  onChange={handleMoneyChange(setOtherDeductionsInput)}
                  onPaste={handleMoneyPaste(setOtherDeductionsInput)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>
          </div>

          {/* Opção de Inativar Funcionário e Observações */}
          <div className="pt-2 border-t border-slate-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer">
              <input
                type="checkbox"
                checked={markInactive}
                onChange={(e) => setMarkInactive(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span>Atualizar status do colaborador para "Inativo / Desligado" no sistema</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveTermination}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Homologar Rescisão</span>
              </button>
            </div>
          </div>

        </div>

        {/* Resumo em Destaque (4 colunas) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Card Principal de Valor Líquido */}
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
              {calculation.fgtsFineAmount > 0 && (
                <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-700/50">
                  <span>Multa FGTS ({calculation.fgtsFineRate}%):</span>
                  <span className="font-bold text-amber-300 flex items-center gap-1.5">
                    {formatMoneyBRL(calculation.fgtsFineAmount)}
                    {includeFgtsFine ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                        Inclusa
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-normal">
                        Não inclusa
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {selectedEmployee && (
              <button
                type="button"
                onClick={() => {
                  setViewingTRCT({
                    id: 'temp_preview',
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
                    status: 'rascunho',
                    createdAt: new Date().toISOString(),
                  });
                }}
                className="w-full mt-2 inline-flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Imprimir Termo de Rescisão (TRCT)</span>
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
                {includeInssDiscount ? (
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
                ) : (
                  <div className="flex justify-between text-slate-400 dark:text-stone-500 italic text-[11px]">
                    <span>Desconto de INSS:</span>
                    <span>Não aplicado (Isento)</span>
                  </div>
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

      {/* 2. Histórico de Rescisões Salvas */}
      <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-stone-800 pb-2.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700 dark:text-stone-300" />
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Histórico de Rescisões Homologadas
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300">
              {terminations.length} registro(s)
            </span>
          </div>
        </div>

        {terminations.length === 0 ? (
          <div className="py-8 text-center text-slate-400 dark:text-stone-500 text-xs">
            Nenhuma rescisão homologada até o momento. Utilize o formulário acima para calcular e salvar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-stone-800 text-slate-500 dark:text-stone-400 font-bold">
                  <th className="py-2.5 px-3">Funcionário</th>
                  <th className="py-2.5 px-3">Cargo</th>
                  <th className="py-2.5 px-3">Data Desligamento</th>
                  <th className="py-2.5 px-3">Motivo</th>
                  <th className="py-2.5 px-3 text-right">Total Líquido</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-stone-800 font-medium text-slate-800 dark:text-stone-200">
                {terminations.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/50 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      {t.employeeName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-stone-400">
                      {t.employeeRole || 'Geral'}
                    </td>
                    <td className="py-2.5 px-3">
                      {formatDateBR(t.terminationDate)}
                    </td>
                    <td className="py-2.5 px-3 max-w-[220px] truncate" title={getReasonLabel(t.reason)}>
                      {getReasonLabel(t.reason)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {formatMoneyBRL(t.calculation.netTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Homologado
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setViewingTRCT(t)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-stone-400 dark:hover:text-white bg-slate-100 dark:bg-stone-800 rounded-lg transition cursor-pointer"
                        title="Visualizar / Imprimir TRCT"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTermination(t.id, t.employeeName)}
                        className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 rounded-lg transition cursor-pointer"
                        title="Excluir do histórico"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL DE IMPRESSÃO DO TERMO DE RESCISÃO (TRCT OFICIAL)                 */}
      {/* ========================================================================= */}
      {viewingTRCT && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto no-print-bg">
          <div className="bg-white text-black w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-200">
            
            {/* Barra Superior com Controles */}
            <div className="no-print bg-slate-900 text-white p-3 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-black">
                  Termo de Rescisão do Contrato de Trabalho (TRCT)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTRCT(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Documento Imprimível A4 */}
            <div className="p-6 sm:p-8 space-y-4 text-xs font-sans bg-white print:p-0">
              
              {/* Cabeçalho da Empresa */}
              <div className="flex items-start justify-between border-b-2 border-black pb-3 gap-3">
                <div className="flex items-center gap-3">
                  {companyProfile?.logoUrl ? (
                    <img 
                      src={companyProfile.logoUrl} 
                      alt="Logo" 
                      className="h-14 w-auto max-w-[120px] object-contain" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-2 border-2 border-black font-black text-sm tracking-tighter">
                      {companyProfile?.tradeName || companyProfile?.corporateName || 'EMPRESA'}
                    </div>
                  )}
                  <div>
                    <h1 className="font-black text-sm sm:text-base uppercase tracking-tight">
                      {companyProfile?.corporateName || companyProfile?.tradeName || 'Razão Social da Empresa'}
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-700">
                      CNPJ/CPF: {companyProfile?.cnpjCpf || companyProfile?.cnpj || 'Não informado'}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {[companyProfile?.address, companyProfile?.number, companyProfile?.neighborhood, companyProfile?.city, companyProfile?.state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {companyProfile?.phone && (
                      <p className="text-[10px] font-bold text-slate-800 flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        {companyProfile.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-black text-sm uppercase tracking-tight block border border-black px-2 py-1 bg-slate-100">
                    TRCT - TERMO RESCISÓRIO
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono mt-0.5 block">
                    Emissão: {new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Dados do Contrato e Empregado */}
              <div className="border border-black p-3 rounded-md space-y-2 bg-slate-50/50">
                <div className="font-bold text-[11px] uppercase border-b border-slate-300 pb-1 text-slate-900">
                  Identificação do Empregado e do Contrato de Trabalho
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600">Nome do Empregado:</span>
                    <span className="font-bold text-xs">{viewingTRCT.employeeName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600">CPF:</span>
                    <span className="font-semibold">{formatCPF(viewingTRCT.employeeCpf)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600">Cargo / Função:</span>
                    <span className="font-semibold">{viewingTRCT.employeeRole || 'Geral'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600">Salário Base:</span>
                    <span className="font-bold text-emerald-700">{formatMoneyBRL(viewingTRCT.baseSalary)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600">Data Admissão:</span>
                    <span className="font-semibold">{formatEmployeeAdmissionDate(viewingTRCT.admissionDate)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600">Data Afastamento:</span>
                    <span className="font-semibold">{formatDateBR(viewingTRCT.terminationDate)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600">Aviso Prévio:</span>
                    <span className="font-semibold capitalize">{viewingTRCT.noticeType} ({viewingTRCT.calculation.noticeDays} dias)</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600">Causa do Afastamento:</span>
                    <span className="font-semibold">{getReasonLabel(viewingTRCT.reason)}</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Verbas Rescisórias (Proventos) */}
              <div className="border border-black rounded-md overflow-hidden">
                <div className="bg-slate-200 font-black text-[11px] uppercase p-1.5 border-b border-black">
                  Discriminação das Verbas Rescisórias (Proventos)
                </div>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50 font-bold">
                      <th className="py-1 px-2 w-16">Rubrica</th>
                      <th className="py-1 px-2">Descrição</th>
                      <th className="py-1 px-2 w-28 text-center">Referência</th>
                      <th className="py-1 px-2 text-right w-28">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-1 px-2 font-mono">01</td>
                      <td className="py-1 px-2">Saldo de Salário</td>
                      <td className="py-1 px-2 text-center">{viewingTRCT.calculation.workedDaysCurrentMonth} dias</td>
                      <td className="py-1 px-2 text-right font-bold">{formatMoneyBRL(viewingTRCT.calculation.salaryBalance)}</td>
                    </tr>
                    {viewingTRCT.calculation.noticeAmount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono">02</td>
                        <td className="py-1 px-2">Aviso Prévio Indenizado</td>
                        <td className="py-1 px-2 text-center">{viewingTRCT.calculation.noticeDays} dias</td>
                        <td className="py-1 px-2 text-right font-bold">{formatMoneyBRL(viewingTRCT.calculation.noticeAmount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-1 px-2 font-mono">03</td>
                      <td className="py-1 px-2">13º Salário Proporcional</td>
                      <td className="py-1 px-2 text-center">{viewingTRCT.calculation.thirteenthProportionalMonths}/12 avos</td>
                      <td className="py-1 px-2 text-right font-bold">{formatMoneyBRL(viewingTRCT.calculation.thirteenthProportionalAmount)}</td>
                    </tr>
                    {viewingTRCT.calculation.vacationExpiredAmount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono">04</td>
                        <td className="py-1 px-2">Férias Vencidas</td>
                        <td className="py-1 px-2 text-center">{viewingTRCT.calculation.vacationExpiredCount} período(s)</td>
                        <td className="py-1 px-2 text-right font-bold">{formatMoneyBRL(viewingTRCT.calculation.vacationExpiredAmount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-1 px-2 font-mono">05</td>
                      <td className="py-1 px-2">Férias Proporcionais</td>
                      <td className="py-1 px-2 text-center">{viewingTRCT.calculation.vacationProportionalMonths}/12 avos</td>
                      <td className="py-1 px-2 text-right font-bold">{formatMoneyBRL(viewingTRCT.calculation.vacationProportionalAmount)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-mono">06</td>
                      <td className="py-1 px-2">1/3 Constitucional sobre Férias</td>
                      <td className="py-1 px-2 text-center">Art. 7º CF</td>
                      <td className="py-1 px-2 text-right font-bold">{formatMoneyBRL(viewingTRCT.calculation.vacationOneThirdBonus)}</td>
                    </tr>
                    {viewingTRCT.calculation.includeFgtsFine && viewingTRCT.calculation.fgtsFineAmount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono">07</td>
                        <td className="py-1 px-2">Multa Rescisória FGTS ({viewingTRCT.calculation.fgtsFineRate}%)</td>
                        <td className="py-1 px-2 text-center">Art. 18 Lei 8.036</td>
                        <td className="py-1 px-2 text-right font-bold">{formatMoneyBRL(viewingTRCT.calculation.fgtsFineAmount)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black border-t border-black">
                      <td colSpan={3} className="py-1 px-2 text-right">TOTAL BRUTO DOS PROVENTOS:</td>
                      <td className="py-1 px-2 text-right text-emerald-800 font-black">{formatMoneyBRL(viewingTRCT.calculation.grossTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tabela de Deduções */}
              <div className="border border-black rounded-md overflow-hidden">
                <div className="bg-slate-200 font-black text-[11px] uppercase p-1.5 border-b border-black">
                  Deduções e Descontos Rescisórios
                </div>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50 font-bold">
                      <th className="py-1 px-2 w-16">Rubrica</th>
                      <th className="py-1 px-2">Descrição</th>
                      <th className="py-1 px-2 text-right w-28">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingTRCT.calculation.includeInssDiscount !== false ? (
                      <>
                        <tr>
                          <td className="py-1 px-2 font-mono">101</td>
                          <td className="py-1 px-2">Previdência Social (INSS Saldo de Salário)</td>
                          <td className="py-1 px-2 text-right font-bold text-rose-700">{formatMoneyBRL(viewingTRCT.calculation.inssSalaryBalance)}</td>
                        </tr>
                        {viewingTRCT.calculation.inssThirteenth > 0 && (
                          <tr>
                            <td className="py-1 px-2 font-mono">102</td>
                            <td className="py-1 px-2">Previdência Social (INSS sobre 13º Salário)</td>
                            <td className="py-1 px-2 text-right font-bold text-rose-700">{formatMoneyBRL(viewingTRCT.calculation.inssThirteenth)}</td>
                          </tr>
                        )}
                      </>
                    ) : (
                      <tr>
                        <td className="py-1 px-2 font-mono">101</td>
                        <td className="py-1 px-2 text-slate-500 italic">Previdência Social (INSS) - Desconto Desativado / Isento</td>
                        <td className="py-1 px-2 text-right font-bold text-slate-500">R$ 0,00</td>
                      </tr>
                    )}
                    {viewingTRCT.calculation.advancesDiscount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono">103</td>
                        <td className="py-1 px-2">Vales e Adiantamentos Salariais em Aberto</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700">{formatMoneyBRL(viewingTRCT.calculation.advancesDiscount)}</td>
                      </tr>
                    )}
                    {viewingTRCT.calculation.absenceDiscount > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono">104</td>
                        <td className="py-1 px-2">Faltas e Atrasos Injustificados</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700">{formatMoneyBRL(viewingTRCT.calculation.absenceDiscount)}</td>
                      </tr>
                    )}
                    {viewingTRCT.calculation.noticeDeduction > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono">105</td>
                        <td className="py-1 px-2">Aviso Prévio Não Cumprido (Desconto Art. 487 CLT)</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700">{formatMoneyBRL(viewingTRCT.calculation.noticeDeduction)}</td>
                      </tr>
                    )}
                    {viewingTRCT.calculation.otherDeductions > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono">106</td>
                        <td className="py-1 px-2">Outras Deduções Autorizadas</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700">{formatMoneyBRL(viewingTRCT.calculation.otherDeductions)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black border-t border-black">
                      <td colSpan={2} className="py-1 px-2 text-right">TOTAL GERAL DAS DEDUÇÕES:</td>
                      <td className="py-1 px-2 text-right text-rose-800 font-black">{formatMoneyBRL(viewingTRCT.calculation.totalDeductions)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Quadro Resumo com Líquido e Multa FGTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-2 border-black p-3 rounded-md bg-slate-50">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block uppercase">Multa Rescisória FGTS ({viewingTRCT.calculation.fgtsFineRate}%):</span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatMoneyBRL(viewingTRCT.calculation.fgtsFineAmount)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    (Base informada/estimada: {formatMoneyBRL(viewingTRCT.calculation.fgtsEstimatedBalance)})
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-600 block uppercase">VALOR LÍQUIDO A RECEBER:</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-800">
                    {formatMoneyBRL(viewingTRCT.calculation.netTotal)}
                  </span>
                </div>
              </div>

              {/* Termo de Quitação e Assinaturas */}
              <div className="pt-2 text-[10px] text-slate-600 text-justify leading-relaxed">
                Foi prestada, sem ônus para o empregado, a assistência e conferência da presente rescisão contratual, tendo o colaborador recebido os valores líquidos discriminados acima, dando plena e geral quitação das parcelas expressamente consignadas neste termo.
              </div>

              <div className="pt-6 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-black pt-1.5">
                  <span className="font-bold block uppercase">{companyProfile?.tradeName || companyProfile?.corporateName || 'Empregador'}</span>
                  <span className="text-[10px] text-slate-500">Assinatura do Empregador / Responsável</span>
                </div>

                <div className="border-t border-black pt-1.5">
                  <span className="font-bold block uppercase">{viewingTRCT.employeeName}</span>
                  <span className="text-[10px] text-slate-500">Assinatura do Empregado / Colaborador</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
