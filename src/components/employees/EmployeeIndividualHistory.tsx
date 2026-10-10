import React, { useState, useMemo, useEffect } from 'react';
import {
  UserSquare2,
  Calendar,
  DollarSign,
  FileHeart,
  CalendarX2,
  FileText,
  CreditCard,
  Plus,
  Trash2,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Briefcase,
  Phone,
  Building2,
  Clock,
  ShieldCheck,
  TrendingUp,
  X,
  Check,
  FileCheck,
  Download
} from 'lucide-react';
import {
  Employee,
  CompanyProfile,
  SalaryChangeRecord,
  VacationRecord,
  MedicalCertificateRecord,
  AbsenceRecord,
  SalaryAdvance,
  TerminationRecord
} from '../../types';
import {
  formatDateBR,
  formatCurrencyBRL,
  getStoredVacations,
  getStoredSalaryAdvances,
  getStoredMedicalCertificates,
  getStoredAbsences,
  getStoredTerminations,
  saveStoredEmployees,
  getStoredEmployees
} from '../../lib/storage';
import { formatPhone, formatCpfCnpj } from '../../lib/formatters';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

interface EmployeeIndividualHistoryProps {
  employees: Employee[];
  selectedEmployeeId?: string;
  companyProfile: CompanyProfile;
  onSaveEmployees: (employees: Employee[]) => void;
  onSelectEmployee?: (id: string) => void;
}

type ProntuarioBlockType =
  | 'todos'
  | 'salarios'
  | 'ferias'
  | 'atestados'
  | 'faltas'
  | 'adiantamentos'
  | 'contrato';

export const EmployeeIndividualHistory: React.FC<EmployeeIndividualHistoryProps> = ({
  employees,
  selectedEmployeeId,
  companyProfile,
  onSaveEmployees,
  onSelectEmployee
}) => {
  // Colaborador Selecionado (Ativo ou Ex-Colaborador)
  const [currentEmpId, setCurrentEmpId] = useState<string>(() => {
    if (selectedEmployeeId) {
      return selectedEmployeeId;
    }
    return employees.length > 0 ? employees[0].id : '';
  });

  useEffect(() => {
    if (selectedEmployeeId) {
      setCurrentEmpId(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  // Busca do Seletor
  const [pickerSearch, setPickerSearch] = useState('');

  // Sub-aba ativa dentro do Histórico Individual
  const [activeBlock, setActiveBlock] = useState<ProntuarioBlockType>('todos');

  // Modal para Nova Alteração Salarial
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [newSalaryDate, setNewSalaryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newSalaryValue, setNewSalaryValue] = useState<string>('');
  const [newSalaryReason, setNewSalaryReason] = useState<string>('Reajuste Anual');
  const [newSalaryCargo, setNewSalaryCargo] = useState<string>('');
  const [newSalaryNotes, setNewSalaryNotes] = useState<string>('');

  // Colaborador Atual (busca na lista em memória e com fallback no LocalStorage agrocontrol_funcionarios)
  const currentEmployee = useMemo(() => {
    if (!currentEmpId) return employees[0] || null;
    const found = employees.find(e => e.id === currentEmpId);
    if (found) return found;
    try {
      const raw = localStorage.getItem('agrocontrol_funcionarios') ||
                  localStorage.getItem('colaca_silagem_funcionarios');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const directMatch = parsed.find((e: any) => e && e.id === currentEmpId);
          if (directMatch) return directMatch;
        }
      }
    } catch {}
    return employees[0] || null;
  }, [employees, currentEmpId]);

  // Lista de colaboradores filtrada para o selector
  const filteredEmployeesForPicker = useMemo(() => {
    if (!pickerSearch.trim()) return employees;
    const term = pickerSearch.toLowerCase();
    return employees.filter(e =>
      e.name.toLowerCase().includes(term) ||
      (e.cpf && e.cpf.includes(term)) ||
      (e.role && e.role.toLowerCase().includes(term))
    );
  }, [employees, pickerSearch]);

  // Férias do Colaborador (Local + Prop)
  const employeeVacations = useMemo<VacationRecord[]>(() => {
    if (!currentEmployee) return [];
    const all = getStoredVacations();
    return all.filter(v => v.employeeId === currentEmployee.id);
  }, [currentEmployee]);

  // Atestados do Colaborador
  const employeeCertificates = useMemo<MedicalCertificateRecord[]>(() => {
    if (!currentEmployee) return [];
    const all = getStoredMedicalCertificates();
    return all.filter(c => c.employeeId === currentEmployee.id);
  }, [currentEmployee]);

  // Faltas do Colaborador
  const employeeAbsences = useMemo<AbsenceRecord[]>(() => {
    if (!currentEmployee) return [];
    const all = getStoredAbsences();
    return all.filter(a => a.employeeId === currentEmployee.id);
  }, [currentEmployee]);

  // Adiantamentos do Colaborador
  const employeeAdvances = useMemo<SalaryAdvance[]>(() => {
    if (!currentEmployee) return [];
    const all = getStoredSalaryAdvances();
    return all.filter(a => a.employeeId === currentEmployee.id);
  }, [currentEmployee]);

  // Rescisão do Colaborador
  const employeeTermination = useMemo<TerminationRecord | null>(() => {
    if (!currentEmployee) return null;
    const all = getStoredTerminations();
    return all.find(t => t.employeeId === currentEmployee.id) || null;
  }, [currentEmployee]);

  // Linha do tempo de salários
  const salaryHistoryList = useMemo<SalaryChangeRecord[]>(() => {
    if (!currentEmployee) return [];
    const hist = currentEmployee.salaryHistory || [];
    // Ordena do mais recente ao mais antigo
    return [...hist].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [currentEmployee]);

  // Manipulador para registrar nova alteração de salário
  const handleSaveSalaryChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee) return;

    const rawNum = parseFloat(newSalaryValue.replace(/\./g, '').replace(',', '.'));
    if (isNaN(rawNum) || rawNum <= 0) {
      alert('Informe um valor de salário válido.');
      return;
    }

    const prevSalary = currentEmployee.salary || currentEmployee.baseSalary || 0;
    const newRecord: SalaryChangeRecord = {
      id: `sal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      employeeId: currentEmployee.id,
      date: newSalaryDate,
      previousSalary: prevSalary,
      newSalary: rawNum,
      reason: newSalaryReason,
      cargo: newSalaryCargo || currentEmployee.role,
      notes: newSalaryNotes,
      registeredBy: 'Operador RH',
      createdAt: new Date().toISOString()
    };

    const updatedHistory = [...(currentEmployee.salaryHistory || []), newRecord];
    const updatedEmployee: Employee = {
      ...currentEmployee,
      salary: rawNum,
      baseSalary: rawNum,
      role: newSalaryCargo ? newSalaryCargo : currentEmployee.role,
      salaryHistory: updatedHistory
    };

    const updatedEmployees = employees.map(emp => emp.id === currentEmployee.id ? updatedEmployee : emp);
    saveStoredEmployees(updatedEmployees);
    onSaveEmployees(updatedEmployees);

    // Reset modal
    setIsSalaryModalOpen(false);
    setNewSalaryValue('');
    setNewSalaryNotes('');
  };

  // Excluir registro de histórico salarial
  const handleDeleteSalaryRecord = (recordId: string) => {
    if (!currentEmployee) return;
    if (!confirm('Deseja realmente remover este registro de alteração salarial do histórico?')) return;

    const updatedHistory = (currentEmployee.salaryHistory || []).filter(r => r.id !== recordId);
    
    // Se ainda houver registros, o salário atual passa a ser o mais recente, senão mantém
    const sorted = [...updatedHistory].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestSalary = sorted.length > 0 ? sorted[0].newSalary : (currentEmployee.baseSalary || currentEmployee.salary || 0);

    const updatedEmployee: Employee = {
      ...currentEmployee,
      salary: latestSalary,
      baseSalary: latestSalary,
      salaryHistory: updatedHistory
    };

    const updatedEmployees = employees.map(emp => emp.id === currentEmployee.id ? updatedEmployee : emp);
    saveStoredEmployees(updatedEmployees);
    onSaveEmployees(updatedEmployees);
  };

  // Cálculo de tempo de casa
  const tempoDeCasa = useMemo(() => {
    if (!currentEmployee?.admissionDate) return 'Não informado';
    try {
      const adm = new Date(currentEmployee.admissionDate);
      const hoje = new Date();
      let anos = hoje.getFullYear() - adm.getFullYear();
      let meses = hoje.getMonth() - adm.getMonth();
      if (meses < 0) {
        anos--;
        meses += 12;
      }
      if (anos === 0) return `${meses} mês(es)`;
      return `${anos} ano(s) e ${meses} m`;
    } catch {
      return '-';
    }
  }, [currentEmployee]);

  // Função para imprimir prontuário A4 do colaborador
  const handlePrintProntuario = () => {
    window.print();
  };

  if (!currentEmployee) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded border border-slate-300">
        <UserSquare2 className="w-12 h-12 mx-auto text-slate-400 mb-2" />
        <p className="text-xs font-bold uppercase tracking-wider">Nenhum colaborador cadastrado no sistema</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in text-slate-800">
      
      {/* 1. BARRA SUPERIOR DE SELEÇÃO RÁPIDA DE COLABORADOR (MDI SLIM DESIGN) */}
      <div className="no-print bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-400 rounded-lg p-2.5 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.06)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        
        {/* Seletor de Colaborador */}
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <label className="text-[10px] font-black uppercase text-slate-700 whitespace-nowrap flex items-center gap-1.5">
            <UserSquare2 className="w-3.5 h-3.5 text-sky-700" />
            <span>COLABORADOR EM ANÁLISE:</span>
          </label>
          <div className="relative flex-1 max-w-md">
            <select
              value={currentEmpId}
              onChange={(e) => {
                setCurrentEmpId(e.target.value);
                onSelectEmployee?.(e.target.value);
              }}
              className="w-full text-xs font-bold uppercase py-1.5 pl-2.5 pr-8 bg-white border border-slate-400 rounded shadow-xs focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer text-slate-800"
            >
              {employees.map(emp => {
                const tag = emp.status === 'demitido' ? ' (DEMITIDO)' :
                            emp.status === 'afastado' ? ' (AFASTADO)' :
                            (emp.active === false || emp.status === 'inativo') ? ' (INATIVO)' : '';
                return (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.role ? `• ${emp.role}` : ''}{tag}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Ações: Imprimir Prontuário e Novo Reajuste */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={handlePrintProntuario}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
            title="Imprimir Prontuário Completo do Colaborador (A4)"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>IMPRIMIR PRONTUÁRIO</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewSalaryValue(currentEmployee.salary || currentEmployee.baseSalary ? String(currentEmployee.salary || currentEmployee.baseSalary) : '');
              setNewSalaryCargo(currentEmployee.role || '');
              setIsSalaryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase rounded bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ NOVO REAJUSTE SALARIAL</span>
          </button>
        </div>
      </div>

      {/* 2. CARD RESUMO DO COLABORADOR (CABEÇALHO COM AVATAR E DADOS ESSENCIAIS) */}
      <div className="border border-slate-300 rounded-lg bg-white p-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <EmployeeAvatar
                photoUrl={currentEmployee.photoUrl || currentEmployee.avatar_url || currentEmployee.foto_url}
                name={currentEmployee.name}
                size="lg"
                className="w-14 h-14 rounded-full border-2 border-slate-300 shadow-xs object-cover"
              />
              <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                currentEmployee.status === 'demitido' ? 'bg-rose-600' :
                currentEmployee.active === false ? 'bg-slate-500' :
                currentEmployee.status === 'ferias' ? 'bg-amber-500' :
                currentEmployee.status === 'afastado' ? 'bg-orange-500' : 'bg-emerald-500'
              }`} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  {currentEmployee.name}
                </h2>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                  currentEmployee.status === 'demitido' ? 'bg-rose-100 text-rose-900 border-rose-300' :
                  currentEmployee.active === false ? 'bg-slate-100 text-slate-700 border-slate-300' :
                  currentEmployee.status === 'ferias' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                  currentEmployee.status === 'afastado' ? 'bg-orange-50 text-orange-800 border-orange-300' :
                  'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}>
                  {currentEmployee.status === 'demitido' ? 'DEMITIDO / RESCISÃO' :
                   currentEmployee.active === false ? 'INATIVO' :
                   currentEmployee.status === 'ferias' ? 'EM FÉRIAS' :
                   currentEmployee.status === 'afastado' ? 'AFASTADO' : 'ATIVO'}
                </span>
                {currentEmployee.contractType && (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                    {currentEmployee.contractType}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 mt-1 uppercase font-semibold">
                <span className="flex items-center gap-1 text-slate-800 font-bold">
                  <Briefcase className="w-3.5 h-3.5 text-sky-600" />
                  {currentEmployee.role || 'FUNÇÃO NÃO DEFINIDA'}
                </span>
                {currentEmployee.cpf && (
                  <span className="text-slate-500">
                    CPF: {formatCpfCnpj(currentEmployee.cpf)}
                  </span>
                )}
                {currentEmployee.phone && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {formatPhone(currentEmployee.phone)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cards de Métricas Rápidas do Colaborador */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
            
            <div className="bg-slate-50 border border-slate-200 rounded p-2 text-center min-w-[100px]">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">SALÁRIO ATUAL</span>
              <span className="text-xs font-black text-emerald-700 font-['Outfit'] block mt-0.5">
                {formatCurrencyBRL(currentEmployee.salary || currentEmployee.baseSalary || 0)}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-2 text-center min-w-[100px]">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">ADMISSÃO</span>
              <span className="text-xs font-bold text-slate-800 block mt-0.5">
                {formatDateBR(currentEmployee.admissionDate)}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-2 text-center min-w-[100px]">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">TEMPO DE CASA</span>
              <span className="text-xs font-bold text-sky-800 block mt-0.5">
                {tempoDeCasa}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-2 text-center min-w-[100px]">
              <span className="text-[9px] font-bold text-slate-500 uppercase block">FÉRIAS GOZADAS</span>
              <span className="text-xs font-bold text-amber-700 block mt-0.5">
                {employeeVacations.length} período(s)
              </span>
            </div>

          </div>
        </div>

        {/* 3. NAVEGAÇÃO REATIVA ENTRE OS 6 BLOCOS DE PRONTUÁRIO */}
        <div className="no-print pt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100">
          {[
            { id: 'todos', label: 'TODOS OS BLOCOS', icon: UserSquare2 },
            { id: 'salarios', label: '💰 ALTERAÇÕES DE SALÁRIOS', icon: TrendingUp },
            { id: 'ferias', label: '🏖️ FÉRIAS & PERÍODOS', icon: Calendar },
            { id: 'atestados', label: '🩺 ATESTADOS MÉDICOS', icon: FileHeart },
            { id: 'faltas', label: '⚠️ FALTAS & OCORRÊNCIAS', icon: CalendarX2 },
            { id: 'adiantamentos', label: '💵 ADIANTAMENTOS & VALES', icon: DollarSign },
            { id: 'contrato', label: '📋 CONTRATO & DOCUMENTOS', icon: FileText }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveBlock(tab.id as ProntuarioBlockType)}
              className={`px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase rounded border transition-all cursor-pointer ${
                activeBlock === tab.id
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. BLOCO 1: [ALTERAÇÕES DE SALÁRIOS] ➔ LINHA DO TEMPO DE SALÁRIO */}
      {(activeBlock === 'todos' || activeBlock === 'salarios') && (
        <section className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
          
          <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 px-3 py-1.5 border-b border-slate-400 flex items-center justify-between shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)]">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">
                1. ALTERAÇÕES DE SALÁRIOS & EVOLUÇÃO SALARIAL (LINHA DO TEMPO)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewSalaryValue(currentEmployee.salary || currentEmployee.baseSalary ? String(currentEmployee.salary || currentEmployee.baseSalary) : '');
                setNewSalaryCargo(currentEmployee.role || '');
                setIsSalaryModalOpen(true);
              }}
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span>REGISTRAR ALTERAÇÃO</span>
            </button>
          </div>

          <div className="p-3">
            {salaryHistoryList.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center bg-slate-50/50">
                <p className="text-xs text-slate-600 font-semibold uppercase">
                  Salário Contratual Inicial: <span className="font-black text-emerald-700">{formatCurrencyBRL(currentEmployee.salary || currentEmployee.baseSalary || 0)}</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase">
                  Nenhum reajuste posterior lançado na linha do tempo. Clique em "Registrar Alteração" para adicionar aumentos, dissídios ou promoções.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-left text-xs uppercase border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100/80 text-[10px] font-black text-slate-700">
                      <th className="py-1.5 px-2.5">DATA DA VIGÊNCIA</th>
                      <th className="py-1.5 px-2.5 text-right">SALÁRIO ANTERIOR</th>
                      <th className="py-1.5 px-2.5 text-right">NOVO SALÁRIO</th>
                      <th className="py-1.5 px-2.5 text-center">VARIAÇÃO (R$)</th>
                      <th className="py-1.5 px-2.5">MOTIVO DO REAJUSTE</th>
                      <th className="py-1.5 px-2.5">CARGO / FUNÇÃO</th>
                      <th className="py-1.5 px-2.5">OBSERVAÇÕES</th>
                      <th className="py-1.5 px-2 text-center w-12 no-print">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {salaryHistoryList.map((rec, idx) => {
                      const diff = rec.newSalary - rec.previousSalary;
                      const pct = rec.previousSalary > 0 ? ((diff / rec.previousSalary) * 100).toFixed(1) : '0';
                      return (
                        <tr key={`${rec.id || 'sal'}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                            {formatDateBR(rec.date)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-medium text-slate-600 whitespace-nowrap">
                            {formatCurrencyBRL(rec.previousSalary)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-black text-emerald-800 whitespace-nowrap">
                            {formatCurrencyBRL(rec.newSalary)}
                          </td>
                          <td className="py-2 px-2.5 text-center whitespace-nowrap">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              diff >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {diff >= 0 ? `+ ${formatCurrencyBRL(diff)}` : formatCurrencyBRL(diff)} ({pct}%)
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-bold text-slate-800">
                            {rec.reason}
                          </td>
                          <td className="py-2 px-2.5 font-medium text-slate-700">
                            {rec.cargo || currentEmployee.role || '-'}
                          </td>
                          <td className="py-2 px-2.5 text-slate-500 normal-case max-w-xs truncate">
                            {rec.notes || '-'}
                          </td>
                          <td className="py-2 px-2 text-center no-print">
                            <button
                              type="button"
                              onClick={() => handleDeleteSalaryRecord(rec.id)}
                              className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                              title="Remover registro de alteração salarial"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. BLOCO 2: [FÉRIAS & PERÍODOS AQUISITIVOS] */}
      {(activeBlock === 'todos' || activeBlock === 'ferias') && (
        <section className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
          
          <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 px-3 py-1.5 border-b border-slate-400 flex items-center justify-between shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">
                2. FÉRIAS & PERÍODOS AQUISITIVOS
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase">
              TOTAL: {employeeVacations.length} REGISTRO(S)
            </span>
          </div>

          <div className="p-3">
            {employeeVacations.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3 uppercase font-medium">
                Nenhum registro de férias encontrado para este colaborador.
              </p>
            ) : (
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-left text-xs uppercase border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100/80 text-[10px] font-black text-slate-700">
                      <th className="py-1.5 px-2.5">PERÍODO AQUISITIVO</th>
                      <th className="py-1.5 px-2.5">PERÍODO DE GOZO</th>
                      <th className="py-1.5 px-2.5 text-center">DIAS</th>
                      <th className="py-1.5 px-2.5 text-right">VALOR BRUTO</th>
                      <th className="py-1.5 px-2.5 text-right">1/3 CONSTITUCIONAL</th>
                      <th className="py-1.5 px-2.5 text-right">VALOR LÍQUIDO</th>
                      <th className="py-1.5 px-2.5 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {employeeVacations.map((v, idx) => (
                      <tr key={`${v.id || 'vac'}_${idx}`} className="hover:bg-slate-50/80">
                        <td className="py-2 px-2.5 font-bold text-slate-800 whitespace-nowrap">
                          {v.acquisitionPeriodStart && v.acquisitionPeriodEnd ? (
                            `${formatDateBR(v.acquisitionPeriodStart)} até ${formatDateBR(v.acquisitionPeriodEnd)}`
                          ) : '-'}
                        </td>
                        <td className="py-2 px-2.5 font-bold text-sky-900 whitespace-nowrap">
                          {formatDateBR(v.startDate)} até {formatDateBR(v.endDate)}
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-slate-700 whitespace-nowrap">
                          {v.daysCount || 30} dias {v.sellDaysCount ? `(+${v.sellDaysCount} abono)` : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right font-medium text-slate-700 whitespace-nowrap">
                          {formatCurrencyBRL(v.baseSalary || 0)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-medium text-slate-700 whitespace-nowrap">
                          {formatCurrencyBRL(v.oneThirdBonus || 0)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-black text-emerald-800 whitespace-nowrap">
                          {formatCurrencyBRL(v.totalAmount || v.valor_liquido_pago || 0)}
                        </td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                            v.status === 'quitado' || v.status === 'concluido' || v.status === 'regular'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : v.status === 'em_gozo'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-sky-50 text-sky-800 border-sky-300'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. BLOCO 3: [ATESTADOS MÉDICOS] */}
      {(activeBlock === 'todos' || activeBlock === 'atestados') && (
        <section className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
          
          <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 px-3 py-1.5 border-b border-slate-400 flex items-center justify-between shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)]">
            <div className="flex items-center gap-1.5">
              <FileHeart className="w-3.5 h-3.5 text-rose-700" />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">
                3. ATESTADOS MÉDICOS & PRONTUÁRIO DE SAÚDE
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase">
              TOTAL: {employeeCertificates.length} REGISTRO(S)
            </span>
          </div>

          <div className="p-3">
            {employeeCertificates.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3 uppercase font-medium">
                Nenhum atestado médico registrado para este colaborador.
              </p>
            ) : (
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-left text-xs uppercase border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100/80 text-[10px] font-black text-slate-700">
                      <th className="py-1.5 px-2.5">PERÍODO</th>
                      <th className="py-1.5 px-2.5 text-center">DIAS</th>
                      <th className="py-1.5 px-2.5">TIPO DE ATESTADO</th>
                      <th className="py-1.5 px-2.5">CID</th>
                      <th className="py-1.5 px-2.5">MÉDICO / CRM</th>
                      <th className="py-1.5 px-2.5 text-center">STATUS</th>
                      <th className="py-1.5 px-2.5">OBSERVAÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {employeeCertificates.map((c, idx) => (
                      <tr key={`${c.id || 'cert'}_${idx}`} className="hover:bg-slate-50/80">
                        <td className="py-2 px-2.5 font-bold text-slate-800 whitespace-nowrap">
                          {formatDateBR(c.startDate)} {c.endDate ? `até ${formatDateBR(c.endDate)}` : ''}
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-rose-800 whitespace-nowrap">
                          {c.daysCount} dia(s)
                        </td>
                        <td className="py-2 px-2.5 font-medium text-slate-700">
                          {c.type}
                        </td>
                        <td className="py-2 px-2.5 font-mono font-bold text-slate-800">
                          {c.cid || '-'}
                        </td>
                        <td className="py-2 px-2.5 text-slate-700">
                          {c.doctorName || '-'} {c.crmCro ? `(${c.crmCro})` : ''}
                        </td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                            c.status === 'homologado' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            c.status === 'rejeitado' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                            'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-500 normal-case max-w-xs truncate">
                          {c.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 7. BLOCO 4: [FALTAS & OCORRÊNCIAS DISCIPLINARES] */}
      {(activeBlock === 'todos' || activeBlock === 'faltas') && (
        <section className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
          
          <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 px-3 py-1.5 border-b border-slate-400 flex items-center justify-between shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)]">
            <div className="flex items-center gap-1.5">
              <CalendarX2 className="w-3.5 h-3.5 text-purple-700" />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">
                4. FALTAS & OCORRÊNCIAS DISCIPLINARES
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase">
              TOTAL: {employeeAbsences.length} REGISTRO(S)
            </span>
          </div>

          <div className="p-3">
            {employeeAbsences.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3 uppercase font-medium">
                Nenhum registro de falta ou ocorrência disciplinar.
              </p>
            ) : (
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-left text-xs uppercase border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100/80 text-[10px] font-black text-slate-700">
                      <th className="py-1.5 px-2.5">DATA</th>
                      <th className="py-1.5 px-2.5">TIPO</th>
                      <th className="py-1.5 px-2.5 text-center">DURAÇÃO</th>
                      <th className="py-1.5 px-2.5 text-center">DESCONTO EM FOLHA</th>
                      <th className="py-1.5 px-2.5">MOTIVO / JUSTIFICATIVA</th>
                      <th className="py-1.5 px-2.5 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {employeeAbsences.map((a, idx) => (
                      <tr key={`${a.id || 'abs'}_${idx}`} className="hover:bg-slate-50/80">
                        <td className="py-2 px-2.5 font-bold text-slate-800 whitespace-nowrap">
                          {formatDateBR(a.date)}
                        </td>
                        <td className="py-2 px-2.5 font-bold text-purple-900">
                          {a.type}
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-slate-700 whitespace-nowrap">
                          {a.absenceUnit === 'horas' ? `${a.absenceHours || 0} hora(s)` : `${a.daysCount || 1} dia(s)`}
                        </td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          {a.discountPayroll ? (
                            <span className="text-rose-700 font-black">
                              SIM {a.discountAmount ? `(${formatCurrencyBRL(a.discountAmount)})` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-bold">NÃO</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-slate-700 normal-case max-w-xs truncate">
                          {a.reason || a.notes || '-'}
                        </td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                            a.status === 'descontada' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                            a.status === 'abonada' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 8. BLOCO 5: [ADIANTAMENTOS & VALES] */}
      {(activeBlock === 'todos' || activeBlock === 'adiantamentos') && (
        <section className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
          
          <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 px-3 py-1.5 border-b border-slate-400 flex items-center justify-between shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)]">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">
                5. ADIANTAMENTOS SALARIAIS & VALES
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase">
              TOTAL: {employeeAdvances.length} REGISTRO(S)
            </span>
          </div>

          <div className="p-3">
            {employeeAdvances.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3 uppercase font-medium">
                Nenhum adiantamento ou vale registrado para este colaborador.
              </p>
            ) : (
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-left text-xs uppercase border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100/80 text-[10px] font-black text-slate-700">
                      <th className="py-1.5 px-2.5">DATA</th>
                      <th className="py-1.5 px-2.5">MÊS REF.</th>
                      <th className="py-1.5 px-2.5 text-right">VALOR DO VALE</th>
                      <th className="py-1.5 px-2.5">PAGAMENTO</th>
                      <th className="py-1.5 px-2.5">MOTIVO</th>
                      <th className="py-1.5 px-2.5 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {employeeAdvances.map((adv, idx) => (
                      <tr key={`${adv.id || 'adv'}_${idx}`} className="hover:bg-slate-50/80">
                        <td className="py-2 px-2.5 font-bold text-slate-800 whitespace-nowrap">
                          {formatDateBR(adv.date)}
                        </td>
                        <td className="py-2 px-2.5 font-bold text-sky-800 whitespace-nowrap">
                          {adv.referenceMonth || '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-black text-emerald-800 whitespace-nowrap">
                          {formatCurrencyBRL(adv.amount)}
                        </td>
                        <td className="py-2 px-2.5 font-medium text-slate-700">
                          {adv.paymentMethod} {adv.installmentNumber ? `(P ${adv.installmentNumber}/${adv.totalInstallments})` : ''}
                        </td>
                        <td className="py-2 px-2.5 text-slate-700 normal-case max-w-xs truncate">
                          {adv.reason || adv.notes || '-'}
                        </td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                            adv.status === 'descontado'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {adv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 9. BLOCO 6: [CONTRATO, DADOS BANCÁRIOS & RESCISÃO / DOCUMENTOS] */}
      {(activeBlock === 'todos' || activeBlock === 'contrato') && (
        <section className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
          
          <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 px-3 py-1.5 border-b border-slate-400 flex items-center justify-between shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)]">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-800" />
              <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-wide">
                6. DADOS CONTRATUAIS, BANCÁRIOS & PRONTUÁRIO CADASTRAL
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase">
              REGIME: {currentEmployee.contractType || 'CLT'}
            </span>
          </div>

          <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* 6.1 Dados Cadastrais & Contratuais */}
            <div className="border border-slate-200 rounded p-3 bg-slate-50/50 space-y-2">
              <h4 className="text-[10px] font-black uppercase text-slate-700 border-b border-slate-200 pb-1 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-sky-700" />
                <span>VÍNCULO & DOCUMENTAÇÃO PESSOAL</span>
              </h4>
              <div className="text-xs space-y-1">
                <div><span className="text-slate-500 font-semibold uppercase">Tipo de Cadastro:</span> <strong className="text-slate-800 uppercase">{currentEmployee.registrationType || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">RG:</span> <strong className="text-slate-800">{currentEmployee.rg || currentEmployee.numero_rg || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">PIS:</span> <strong className="text-slate-800">{currentEmployee.pis || currentEmployee.numero_pis || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Nascimento:</span> <strong className="text-slate-800">{formatDateBR(currentEmployee.birthDate || currentEmployee.data_nascimento)}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Cidade:</span> <strong className="text-slate-800 uppercase">{currentEmployee.city || currentEmployee.cidade || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Veículo Fixo:</span> <strong className="text-slate-800 uppercase">{currentEmployee.machineryName || '-'}</strong></div>
              </div>
            </div>

            {/* 6.2 Habilitação & Motorista */}
            <div className="border border-slate-200 rounded p-3 bg-slate-50/50 space-y-2">
              <h4 className="text-[10px] font-black uppercase text-slate-700 border-b border-slate-200 pb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                <span>HABILITAÇÃO PROFISSIONAL (CNH)</span>
              </h4>
              <div className="text-xs space-y-1">
                <div><span className="text-slate-500 font-semibold uppercase">Número CNH:</span> <strong className="text-slate-800">{currentEmployee.cnhNumber || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Categoria:</span> <strong className="text-slate-800 uppercase">{currentEmployee.cnhCategory || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Validade:</span> <strong className="text-slate-800">{formatDateBR(currentEmployee.cnhExpiration)}</strong></div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase">Upgrade Categoria:</span>{' '}
                  <strong className="text-slate-800 uppercase">
                    {currentEmployee.cnhUpgradeDT ? `Sim (${currentEmployee.cnhUpgradeCategory || 'DT'})` : 'Não'}
                  </strong>
                </div>
              </div>
            </div>

            {/* 6.3 Dados Bancários & PIX */}
            <div className="border border-slate-200 rounded p-3 bg-slate-50/50 space-y-2">
              <h4 className="text-[10px] font-black uppercase text-slate-700 border-b border-slate-200 pb-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-indigo-700" />
                <span>DADOS DE PAGAMENTO & PIX</span>
              </h4>
              <div className="text-xs space-y-1">
                <div><span className="text-slate-500 font-semibold uppercase">Local de Recebimento:</span> <strong className="text-slate-800 uppercase">{currentEmployee.paymentLocation || currentEmployee.local_recebimento || 'PIX'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Banco / Instituição:</span> <strong className="text-slate-800 uppercase">{currentEmployee.bankPixKey || currentEmployee.banco_chave_pix || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Agência:</span> <strong className="text-slate-800">{currentEmployee.bankAgency || currentEmployee.agencia || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Conta Corrente:</span> <strong className="text-slate-800">{currentEmployee.bankAccount || currentEmployee.conta_corrente || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Chave PIX:</span> <strong className="text-slate-800">{currentEmployee.chavePix || currentEmployee.chave_pix || currentEmployee.pixKey || '-'}</strong></div>
                <div><span className="text-slate-500 font-semibold uppercase">Tipo da Chave:</span> <strong className="text-slate-800 uppercase">{currentEmployee.pixKeyType || currentEmployee.tipo_chave_pix || '-'}</strong></div>
              </div>
            </div>

          </div>

          {/* 6.4 Rescisão Registrada (se houver) */}
          {employeeTermination && (
            <div className="p-3 pt-0">
              <div className="border border-rose-300 rounded bg-rose-50/50 p-3">
                <h4 className="text-[10px] font-black uppercase text-rose-800 flex items-center gap-1.5 mb-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                  <span>TERMO DE RESCISÃO CONTRATUAL REGISTRADO</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div><span className="text-slate-500 font-semibold uppercase">Data de Demissão:</span> <strong className="text-slate-900 block">{formatDateBR(employeeTermination.terminationDate)}</strong></div>
                  <div><span className="text-slate-500 font-semibold uppercase">Motivo:</span> <strong className="text-slate-900 uppercase block">{employeeTermination.reason}</strong></div>
                  <div><span className="text-slate-500 font-semibold uppercase">Aviso Prévio:</span> <strong className="text-slate-900 uppercase block">{employeeTermination.noticeType}</strong></div>
                  <div><span className="text-slate-500 font-semibold uppercase">Saldo Rescisório:</span> <strong className="text-emerald-800 font-black block">{formatCurrencyBRL(employeeTermination.calculation?.salaryBalance || 0)}</strong></div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* MODAL PARA REGISTRO DE ALTERAÇÃO SALARIAL */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
          <div className="w-full max-w-[500px] bg-white rounded-lg shadow-xl border border-slate-400 overflow-hidden">
            
            <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400 px-3.5 py-2 flex items-center justify-between shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)]">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  REGISTRAR ALTERAÇÃO SALARIAL
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSalaryModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSalaryChange} className="p-3.5 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs">
                <span className="text-slate-500 uppercase font-semibold">Colaborador:</span>{' '}
                <strong className="text-slate-800 uppercase">{currentEmployee.name}</strong>
                <div className="mt-0.5">
                  <span className="text-slate-500 uppercase font-semibold">Salário Anterior:</span>{' '}
                  <strong className="text-slate-700">{formatCurrencyBRL(currentEmployee.salary || currentEmployee.baseSalary || 0)}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                    DATA DA VIGÊNCIA *
                  </label>
                  <input
                    type="date"
                    required
                    value={newSalaryDate}
                    onChange={(e) => setNewSalaryDate(e.target.value)}
                    className="w-full text-xs font-bold py-1.5 px-2 bg-white border border-slate-300 rounded shadow-xs focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                    NOVO SALÁRIO (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 3.500,00"
                    value={newSalaryValue}
                    onChange={(e) => setNewSalaryValue(e.target.value)}
                    className="w-full text-xs font-black py-1.5 px-2 bg-white border border-slate-300 rounded shadow-xs focus:ring-1 focus:ring-emerald-500 outline-none text-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                    MOTIVO DO REAJUSTE *
                  </label>
                  <select
                    value={newSalaryReason}
                    onChange={(e) => setNewSalaryReason(e.target.value)}
                    className="w-full text-xs font-bold uppercase py-1.5 px-2 bg-white border border-slate-300 rounded shadow-xs focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer"
                  >
                    <option value="Reajuste Anual">REAJUSTE ANUAL</option>
                    <option value="Dissídio / Acordo Coletivo">DISSÍDIO / ACORDO COLETIVO</option>
                    <option value="Promoção">PROMOÇÃO</option>
                    <option value="Mérito">MÉRITO</option>
                    <option value="Ajuste de Cargo">AJUSTE DE CARGO</option>
                    <option value="Outro">OUTRO MOTIVO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                    CARGO / FUNÇÃO ATUALIZADA
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Operador Especialista"
                    value={newSalaryCargo}
                    onChange={(e) => setNewSalaryCargo(e.target.value)}
                    className="w-full text-xs font-bold uppercase py-1.5 px-2 bg-white border border-slate-300 rounded shadow-xs focus:ring-1 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">
                  OBSERVAÇÕES / JUSTIFICATIVA DO REAJUSTE
                </label>
                <textarea
                  rows={2}
                  value={newSalaryNotes}
                  onChange={(e) => setNewSalaryNotes(e.target.value)}
                  placeholder="Informações adicionais do aumento salarial..."
                  className="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded shadow-xs focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold uppercase rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-black uppercase rounded bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-600 shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>SALVAR ALTERAÇÃO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
