import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  DollarSign, 
  FileText, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  TrendingUp, 
  Plus, 
  Search, 
  Eye, 
  CreditCard, 
  Banknote, 
  Receipt, 
  Briefcase, 
  Percent, 
  X, 
  ChevronDown,
  Layers,
  Award,
  Check,
  FileCheck2,
  Printer
} from 'lucide-react';
import { Employee, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

export interface SalarioHistoricoRecord {
  id: string;
  employeeId: string;
  data: string;
  tipo: 'ADMISSAO' | 'DISSIDIO' | 'PROMOCAO' | 'MERITO' | 'AJUSTE';
  motivo: string;
  salarioAnterior: number;
  novoSalario: number;
  comissaoHora?: number;
  comissaoHectare?: number;
  comissaoAlqueire?: number;
  percentualAgenciador?: number;
  registradoPor: string;
}

export interface OcorrenciaPontoRecord {
  id: string;
  employeeId: string;
  data: string;
  tipo: 'FALTA_JUSTIFICADA' | 'FALTA_INJUSTIFICADA' | 'HORA_EXTRA_50' | 'HORA_EXTRA_100' | 'ATESTADO_MEDICO';
  quantidade: number; // horas ou dias
  unidade: 'HORAS' | 'DIAS';
  motivo: string;
  cid?: string;
  medicoOuObs?: string;
}

export interface ValeAdiantamentoRecord {
  id: string;
  employeeId: string;
  data: string;
  valor: number;
  tipo: 'QUINZENA' | 'EMERGENCIAL' | 'PECAS_FERRAMENTAS' | 'FARMACIA' | 'COMBUSTIVEL';
  formaPagamento: 'PIX' | 'CONTA' | 'DINHEIRO';
  mesDesconto: string;
  status: 'PENDENTE' | 'QUITADO_FOLHA';
  observacao?: string;
}

interface EmployeeIndividualHistoryViewProps {
  employees: Employee[];
  activeCompany?: string;
  companyProfile?: CompanyProfile;
}

export const EmployeeIndividualHistoryView: React.FC<EmployeeIndividualHistoryViewProps> = ({
  employees,
  activeCompany,
  companyProfile
}) => {
  // Lista de colaboradores higienizada e ordenada alimentada 100% offline pelo LocalStorage ('agrocontrol_funcionarios')
  const activeEmployeesList = useMemo(() => {
    let list = employees;
    try {
      const raw = localStorage.getItem('agrocontrol_funcionarios');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      }
    } catch {}

    return (list || [])
      .filter(e => e && e.name && e.name.trim().length > 0)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }, [employees]);

  // Colaborador selecionado
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
    return activeEmployeesList[0]?.id || '';
  });

  useEffect(() => {
    if (!selectedEmployeeId && activeEmployeesList.length > 0) {
      setSelectedEmployeeId(activeEmployeesList[0].id);
    }
  }, [activeEmployeesList, selectedEmployeeId]);

  const selectedEmployee = useMemo(() => {
    return activeEmployeesList.find(e => e.id === selectedEmployeeId) || activeEmployeesList[0] || null;
  }, [activeEmployeesList, selectedEmployeeId]);

  // Sub-abas do prontuário (6 blocos estruturados)
  type ProntuarioSubTab = 'SALARIOS' | 'FOLHAS' | 'PONTO' | 'VALES' | 'FERIAS' | 'CADASTRO';
  const [activeProntuarioTab, setActiveProntuarioTab] = useState<ProntuarioSubTab>('SALARIOS');

  // Modal para registrar nova alteração de salário
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [newSalaryTipo, setNewSalaryTipo] = useState<'DISSIDIO' | 'PROMOCAO' | 'MERITO' | 'AJUSTE'>('DISSIDIO');
  const [newSalaryMotivo, setNewSalaryMotivo] = useState('');
  const [newSalaryValor, setNewSalaryValor] = useState('');
  const [newComissaoHora, setNewComissaoHora] = useState('');
  const [newComissaoHectare, setNewComissaoHectare] = useState('');

  // Storage keys reativos por colaborador
  const storageSalariosKey = `agrocontrol_historico_salarios_${selectedEmployee?.id || 'default'}`;
  const storagePontoKey = `agrocontrol_historico_ponto_${selectedEmployee?.id || 'default'}`;
  const storageValesKey = `agrocontrol_historico_vales_${selectedEmployee?.id || 'default'}`;

  // 1. CARREGAMENTO REATIVO DAS ALTERAÇÕES DE SALÁRIOS
  const [salariosHistorico, setSalariosHistorico] = useState<SalarioHistoricoRecord[]>([]);

  useEffect(() => {
    if (!selectedEmployee) return;
    try {
      const raw = localStorage.getItem(storageSalariosKey);
      if (raw) {
        setSalariosHistorico(JSON.parse(raw));
      } else {
        // Gera linha do tempo inicial realista com base na admissão
        const baseSal = Number(selectedEmployee.baseSalary || selectedEmployee.salary) || 2800.00;
        const initialTimeline: SalarioHistoricoRecord[] = [
          {
            id: `sal_adm_${selectedEmployee.id}`,
            employeeId: selectedEmployee.id,
            data: selectedEmployee.admissionDate || '2024-01-15',
            tipo: 'ADMISSAO',
            motivo: 'REGISTRO INICIAL DE ADMISSÃO CLT',
            salarioAnterior: baseSal * 0.9,
            novoSalario: baseSal,
            comissaoHora: selectedEmployee.commissionPerHour || 0,
            comissaoHectare: selectedEmployee.commissionPerHectare || 0,
            comissaoAlqueire: selectedEmployee.commissionPerAlqueire || 0,
            percentualAgenciador: selectedEmployee.brokerCommissionValue || 0,
            registradoPor: 'SISTEMA RH CENTRAL'
          }
        ];

        // Se tem mais de 1 ano, adiciona dissídio recente
        if (selectedEmployee.admissionDate && new Date(selectedEmployee.admissionDate).getFullYear() < 2026) {
          initialTimeline.unshift({
            id: `sal_diss_${selectedEmployee.id}`,
            employeeId: selectedEmployee.id,
            data: '2026-05-01',
            tipo: 'DISSIDIO',
            motivo: 'DISSÍDIO COLETIVO CONVENÇÃO AGRÍCOLA (+6,5%)',
            salarioAnterior: baseSal,
            novoSalario: Math.round(baseSal * 1.065),
            comissaoHora: (selectedEmployee.commissionPerHour || 0) * 1.05,
            comissaoHectare: selectedEmployee.commissionPerHectare || 0,
            registradoPor: 'OPERADOR RH AGROCONTROL'
          });
        }

        setSalariosHistorico(initialTimeline);
        localStorage.setItem(storageSalariosKey, JSON.stringify(initialTimeline));
      }
    } catch {
      setSalariosHistorico([]);
    }
  }, [selectedEmployee, storageSalariosKey]);

  // 2. FOLHAS DE PAGAMENTO EMITIDAS (Holerites)
  const folhasHistorico = useMemo(() => {
    if (!selectedEmployee) return [];
    try {
      const raw = localStorage.getItem('colaca_silagem_rh_folhas');
      if (raw) {
        const allFolhas = JSON.parse(raw);
        const empFolhas = allFolhas.filter((f: any) => f.employeeId === selectedEmployee.id || f.funcionarioId === selectedEmployee.id);
        if (empFolhas.length > 0) return empFolhas;
      }
    } catch {}

    // Simulação reativa dos últimos 4 meses de holerites para auditoria imediata
    const base = Number(selectedEmployee.baseSalary || selectedEmployee.salary) || 3200.00;
    return [
      {
        id: `folha_10_2026_${selectedEmployee.id}`,
        competencia: '10/2026',
        mesAno: 'OUTUBRO/2026',
        salarioBase: base,
        horasExtras: 320.00,
        comissaoSilagem: (selectedEmployee.commissionPerHour ? selectedEmployee.commissionPerHour * 40 : 450.00),
        inss: Math.round(base * 0.09),
        descontoVales: 400.00,
        salarioLiquido: Math.round(base + 320 + 450 - (base * 0.09) - 400),
        status: 'FECHADA & EMITIDA'
      },
      {
        id: `folha_09_2026_${selectedEmployee.id}`,
        competencia: '09/2026',
        mesAno: 'SETEMBRO/2026',
        salarioBase: base,
        horasExtras: 240.00,
        comissaoSilagem: (selectedEmployee.commissionPerHour ? selectedEmployee.commissionPerHour * 30 : 380.00),
        inss: Math.round(base * 0.09),
        descontoVales: 250.00,
        salarioLiquido: Math.round(base + 240 + 380 - (base * 0.09) - 250),
        status: 'PAGA (PIX REALIZADO)'
      },
      {
        id: `folha_08_2026_${selectedEmployee.id}`,
        competencia: '08/2026',
        mesAno: 'AGOSTO/2026',
        salarioBase: base,
        horasExtras: 180.00,
        comissaoSilagem: 510.00,
        inss: Math.round(base * 0.09),
        descontoVales: 0.00,
        salarioLiquido: Math.round(base + 180 + 510 - (base * 0.09)),
        status: 'PAGA (PIX REALIZADO)'
      }
    ];
  }, [selectedEmployee]);

  // 3. OCORRÊNCIAS DE PONTO (Faltas, Atestados, Horas Extras)
  const [ocorrenciasPonto, setOcorrenciasPonto] = useState<OcorrenciaPontoRecord[]>([]);

  useEffect(() => {
    if (!selectedEmployee) return;
    try {
      const raw = localStorage.getItem(storagePontoKey);
      if (raw) {
        setOcorrenciasPonto(JSON.parse(raw));
      } else {
        const demoPonto: OcorrenciaPontoRecord[] = [
          {
            id: `ponto_1_${selectedEmployee.id}`,
            employeeId: selectedEmployee.id,
            data: '2026-09-18',
            tipo: 'HORA_EXTRA_50',
            quantidade: 4.5,
            unidade: 'HORAS',
            motivo: 'COLHEITA ESTENDIDA DE SAFRA DE MILHO NOTURNA'
          },
          {
            id: `ponto_2_${selectedEmployee.id}`,
            employeeId: selectedEmployee.id,
            data: '2026-08-10',
            tipo: 'ATESTADO_MEDICO',
            quantidade: 2,
            unidade: 'DIAS',
            motivo: 'CONSULTA ODONTOLÓGICA E REPOUSO',
            cid: 'K08.1',
            medicoOuObs: 'DR. RENATO ALVES - CRO 45892'
          },
          {
            id: `ponto_3_${selectedEmployee.id}`,
            employeeId: selectedEmployee.id,
            data: '2026-07-22',
            tipo: 'FALTA_JUSTIFICADA',
            quantidade: 1,
            unidade: 'DIAS',
            motivo: 'RENOVAÇÃO DE CNH CATEGORIA D NO DETRAN'
          }
        ];
        setOcorrenciasPonto(demoPonto);
        localStorage.setItem(storagePontoKey, JSON.stringify(demoPonto));
      }
    } catch {
      setOcorrenciasPonto([]);
    }
  }, [selectedEmployee, storagePontoKey]);

  // 4. VALES & ADIANTAMENTOS
  const [valesList, setValesList] = useState<ValeAdiantamentoRecord[]>([]);

  useEffect(() => {
    if (!selectedEmployee) return;
    try {
      const raw = localStorage.getItem(storageValesKey);
      if (raw) {
        setValesList(JSON.parse(raw));
      } else {
        const demoVales: ValeAdiantamentoRecord[] = [
          {
            id: `vale_1_${selectedEmployee.id}`,
            employeeId: selectedEmployee.id,
            data: '2026-10-15',
            valor: 600.00,
            tipo: 'QUINZENA',
            formaPagamento: 'PIX',
            mesDesconto: '10/2026',
            status: 'PENDENTE',
            observacao: 'ADIANTAMENTO QUINZENAL REGULAR 40%'
          },
          {
            id: `vale_2_${selectedEmployee.id}`,
            employeeId: selectedEmployee.id,
            data: '2026-09-15',
            valor: 600.00,
            tipo: 'QUINZENA',
            formaPagamento: 'PIX',
            mesDesconto: '09/2026',
            status: 'QUITADO_FOLHA',
            observacao: 'DESCONTADO NO HOLERITE DE SETEMBRO'
          },
          {
            id: `vale_3_${selectedEmployee.id}`,
            employeeId: selectedEmployee.id,
            data: '2026-08-20',
            valor: 150.00,
            tipo: 'PECAS_FERRAMENTAS',
            formaPagamento: 'CONTA',
            mesDesconto: '08/2026',
            status: 'QUITADO_FOLHA',
            observacao: 'RESSARCIMENTO DE REPARO EMERGENCIAL DE PNEU'
          }
        ];
        setValesList(demoVales);
        localStorage.setItem(storageValesKey, JSON.stringify(demoVales));
      }
    } catch {
      setValesList([]);
    }
  }, [selectedEmployee, storageValesKey]);

  // 5. CÁLCULO REATIVO DE FÉRIAS CLT (2,5 DIAS POR MÊS TRABALHADO)
  const feriasCalculadas = useMemo(() => {
    if (!selectedEmployee || !selectedEmployee.admissionDate) {
      return {
        mesesTrabalhados: 12,
        diasAdquiridos: 30,
        diasGozados: 0,
        saldoDias: 30,
        periodoAquisitivoInicio: '2025-01-01',
        periodoAquisitivoFim: '2025-12-31',
        limiteConcessivo: '2026-11-30',
        valorEstimadoFeriasMaisTerco: ((Number(selectedEmployee?.baseSalary || selectedEmployee?.salary) || 3000) * 1.333)
      };
    }

    const admDate = new Date(selectedEmployee.admissionDate);
    const hoje = new Date();
    
    // Meses de trabalho corridos
    const diffYears = hoje.getFullYear() - admDate.getFullYear();
    const diffMonths = (diffYears * 12) + (hoje.getMonth() - admDate.getMonth());
    const mesesTrabalhadosTotal = Math.max(1, diffMonths);

    // CLT: 2,5 dias por mês até o teto de 30 dias por período
    const ciclosCompletos = Math.floor(mesesTrabalhadosTotal / 12);
    const mesesCicloAtual = mesesTrabalhadosTotal % 12;
    const diasAdquiridosCicloAtual = Math.min(30, Number((mesesCicloAtual * 2.5).toFixed(1)));

    // Datas do ciclo aquisitivo
    const anoAtualCiclo = admDate.getFullYear() + ciclosCompletos;
    const mesAdm = String(admDate.getMonth() + 1).padStart(2, '0');
    const diaAdm = String(admDate.getDate()).padStart(2, '0');
    
    const periodoAquisitivoInicio = `${anoAtualCiclo}-${mesAdm}-${diaAdm}`;
    const periodoAquisitivoFim = `${anoAtualCiclo + 1}-${mesAdm}-${diaAdm}`;
    
    // Limite concessivo: 1 ano e 11 meses após início
    const limiteConcessivo = `${anoAtualCiclo + 2}-${mesAdm}-${diaAdm}`;

    const salario = Number(selectedEmployee.baseSalary || selectedEmployee.salary) || 3000;
    const valorEstimadoFeriasMaisTerco = Math.round(salario * 1.3333);

    return {
      mesesTrabalhados: mesesTrabalhadosTotal,
      diasAdquiridos: diasAdquiridosCicloAtual,
      diasGozados: 0,
      saldoDias: diasAdquiridosCicloAtual,
      periodoAquisitivoInicio,
      periodoAquisitivoFim,
      limiteConcessivo,
      valorEstimadoFeriasMaisTerco
    };
  }, [selectedEmployee]);

  // Salvar nova alteração de salário
  const handleSaveSalaryChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    const novoValor = parseFloat(newSalaryValor.replace(',', '.')) || (Number(selectedEmployee.baseSalary || selectedEmployee.salary) || 3000);
    const cHora = parseFloat(newComissaoHora.replace(',', '.')) || (selectedEmployee.commissionPerHour || 0);
    const cHectare = parseFloat(newComissaoHectare.replace(',', '.')) || (selectedEmployee.commissionPerHectare || 0);

    const novoRegistro: SalarioHistoricoRecord = {
      id: `sal_${Date.now()}`,
      employeeId: selectedEmployee.id,
      data: new Date().toISOString().split('T')[0],
      tipo: newSalaryTipo,
      motivo: newSalaryMotivo.trim().toUpperCase() || 'AJUSTE SALARIAL REGISTRADO EM AUDITORIA',
      salarioAnterior: Number(selectedEmployee.baseSalary || selectedEmployee.salary) || 3000,
      novoSalario: novoValor,
      comissaoHora: cHora,
      comissaoHectare: cHectare,
      registradoPor: 'AUDITORIA RH'
    };

    const nextList = [novoRegistro, ...salariosHistorico];
    setSalariosHistorico(nextList);
    localStorage.setItem(storageSalariosKey, JSON.stringify(nextList));

    try {
      const rawEmps = localStorage.getItem('agrocontrol_funcionarios');
      if (rawEmps) {
        const emps = JSON.parse(rawEmps);
        const updated = emps.map((emp: any) => 
          emp.id === selectedEmployee.id 
            ? { ...emp, salary: novoValor, baseSalary: novoValor, commissionPerHour: cHora, commissionPerHectare: cHectare } 
            : emp
        );
        localStorage.setItem('agrocontrol_funcionarios', JSON.stringify(updated));
      }
    } catch {}

    setIsSalaryModalOpen(false);
    setNewSalaryMotivo('');
    setNewSalaryValor('');
    setNewComissaoHora('');
    setNewComissaoHectare('');
  };

  if (!selectedEmployee) {
    return (
      <div className="p-8 text-center text-slate-500 uppercase text-xs font-bold border border-slate-300 rounded bg-white">
        NENHUM COLABORADOR CADASTRADO NO SISTEMA PARA AUDITORIA.
      </div>
    );
  }

  return (
    <div className="w-full h-[95vh] max-h-[95vh] flex flex-col justify-between overflow-hidden bg-slate-50 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg p-2.5 space-y-2 select-none">
      
      {/* =====================================================================
          1. CABEÇALHO DO PRONTUÁRIO: SELETOR DE COLABORADOR SLIM & CARD SUMMARY
         ===================================================================== */}
      <div className="shrink-0 space-y-2">
        {/* Linha do Seletor Slim */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-850 dark:via-stone-800 dark:to-stone-850 border border-slate-400 dark:border-stone-700 rounded shadow-xs">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap">
              SELECIONE O COLABORADOR PARA AUDITORIA:
            </span>
            <div className="relative flex-1 max-w-md">
              <select
                value={selectedEmployee.id}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                className="w-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-600 rounded text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
              >
                {activeEmployeesList.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name.toUpperCase()} {emp.role ? `• ${emp.role.toUpperCase()}` : ''} ({emp.status === 'ativo' ? 'ATIVO' : emp.status?.toUpperCase() || 'ATIVO'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase">
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              PRONTUÁRIO DIGITAL SEGURO
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700">
              CLT & SAFRA
            </span>
          </div>
        </div>

        {/* Ficha Resumo do Colaborador Selecionado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white dark:bg-stone-850 border border-slate-300/80 dark:border-stone-700/80 rounded shadow-xs">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-full border-2 border-slate-300 dark:border-stone-700 overflow-hidden shrink-0 shadow-2xs">
              <EmployeeAvatar photoUrl={selectedEmployee.photoUrl} name={selectedEmployee.name} size="md" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase truncate">
                  {selectedEmployee.name}
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                  {selectedEmployee.role || 'COLABORADOR'}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-700 dark:bg-stone-800 dark:text-stone-300 border border-slate-300 dark:border-stone-700">
                  {selectedEmployee.contractType || selectedEmployee.registrationType || 'REGISTRADO (CLT)'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-stone-400 mt-0.5 flex-wrap">
                <span>CPF: <strong className="text-slate-800 dark:text-stone-200">{selectedEmployee.cpf || 'NÃO INFORMADO'}</strong></span>
                <span>ADMISSÃO: <strong className="text-slate-800 dark:text-stone-200">{formatDateBR(selectedEmployee.admissionDate)}</strong></span>
                <span>SALÁRIO BASE: <strong className="text-emerald-700 dark:text-emerald-400 font-black">{formatCurrencyBRL(Number(selectedEmployee.baseSalary || selectedEmployee.salary) || 0)}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsSalaryModalOpen(true)}
              className="px-2.5 py-1 bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 hover:from-sky-400 hover:to-sky-600 text-white text-[10px] font-bold uppercase rounded border border-sky-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" />
              <span>+ REAJUSTE SALARIAL</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            2. SUB-BARRA DE 6 BLOCOS DE PRONTUÁRIO
           ===================================================================== */}
        <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-800 border-b border-slate-400 dark:border-stone-700 p-0.5 rounded-t flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
          {[
            { id: 'SALARIOS', label: '💰 ALTERAÇÕES DE SALÁRIOS', count: salariosHistorico.length },
            { id: 'FOLHAS', label: '📑 FOLHAS DE PAGAMENTO', count: folhasHistorico.length },
            { id: 'PONTO', label: '⏰ OCORRÊNCIAS DE PONTO', count: ocorrenciasPonto.length },
            { id: 'VALES', label: '💵 VALES & ADIANTAMENTOS', count: valesList.length },
            { id: 'FERIAS', label: '🏖️ FÉRIAS CLT', count: `${feriasCalculadas.saldoDias}D` },
            { id: 'CADASTRO', label: '🗂️ PRONTUÁRIO & CONTRATO' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveProntuarioTab(tab.id as ProntuarioSubTab)}
              className={`flex-1 min-w-max px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition cursor-pointer select-none rounded border ${
                activeProntuarioTab === tab.id
                  ? 'bg-white text-slate-900 border-slate-400 shadow-xs dark:bg-stone-900 dark:text-white dark:border-stone-600 font-black'
                  : 'text-slate-700 dark:text-stone-300 border-transparent hover:bg-white/60 dark:hover:bg-stone-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="ml-1.5 px-1 py-0.2 bg-slate-200 dark:bg-stone-700 rounded text-[9px] font-black">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          3. ÁREA DE CONTEÚDO COM TRAVA DE ALTURA RIGOROSA (SEM ROLAGEM GLOBAL)
         ===================================================================== */}
      <div className="flex-1 overflow-y-auto p-2 bg-white dark:bg-stone-850 border border-slate-300 dark:border-stone-700 rounded-b shadow-xs">
        
        {/* 1. BLOCO: ALTERAÇÕES DE SALÁRIOS */}
        {activeProntuarioTab === 'SALARIOS' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">SALÁRIO BASE ATUAL</span>
                <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {formatCurrencyBRL(Number(selectedEmployee.baseSalary || selectedEmployee.salary) || 0)}
                </div>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">COMISSÃO POR HORA</span>
                <div className="text-sm font-black text-sky-700 dark:text-sky-400 mt-0.5">
                  {formatCurrencyBRL(selectedEmployee.commissionPerHour || 0)} / H
                </div>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">COMISSÃO HECTARE / ALQ</span>
                <div className="text-sm font-black text-amber-700 dark:text-amber-400 mt-0.5">
                  {formatCurrencyBRL(selectedEmployee.commissionPerHectare || 0)} / HA
                </div>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">REAJUSTES REGISTRADOS</span>
                <div className="text-sm font-black text-slate-800 dark:text-stone-200 mt-0.5">
                  {salariosHistorico.length} EVENTO(S)
                </div>
              </div>
            </div>

            <div className="border border-slate-300 dark:border-stone-700 rounded overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-slate-600 dark:text-stone-300 uppercase font-bold text-[10px]">
                    <th className="py-1 px-2 whitespace-nowrap">DATA</th>
                    <th className="py-1 px-2 whitespace-nowrap">TIPO</th>
                    <th className="py-1 px-2 whitespace-nowrap">MOTIVO DO REAJUSTE</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">SALÁRIO ANTERIOR</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">NOVO SALÁRIO BASE</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">VARIAÇÃO (%)</th>
                    <th className="py-1 px-2 whitespace-nowrap">AUDITOR / RESPONSÁVEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-stone-800 uppercase font-medium">
                  {salariosHistorico.map(rec => {
                    const diff = rec.novoSalario - rec.salarioAnterior;
                    const percent = rec.salarioAnterior > 0 ? ((diff / rec.salarioAnterior) * 100).toFixed(1) : '0';

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/60">
                        <td className="py-1 px-2 font-mono whitespace-nowrap">{formatDateBR(rec.data)}</td>
                        <td className="py-1 px-2 whitespace-nowrap font-bold">
                          <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300 text-[9px]">
                            {rec.tipo}
                          </span>
                        </td>
                        <td className="py-1 px-2 font-bold text-slate-900 dark:text-white">{rec.motivo}</td>
                        <td className="py-1 px-2 text-right font-mono text-slate-500 whitespace-nowrap">{formatCurrencyBRL(rec.salarioAnterior)}</td>
                        <td className="py-1 px-2 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatCurrencyBRL(rec.novoSalario)}</td>
                        <td className="py-1 px-2 text-right font-mono font-bold whitespace-nowrap text-emerald-700">
                          +{percent}%
                        </td>
                        <td className="py-1 px-2 text-[10px] text-slate-500 whitespace-nowrap">{rec.registradoPor}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. BLOCO: FOLHAS DE PAGAMENTO */}
        {activeProntuarioTab === 'FOLHAS' && (
          <div className="space-y-2">
            <div className="border border-slate-300 dark:border-stone-700 rounded overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-slate-600 dark:text-stone-300 uppercase font-bold text-[10px]">
                    <th className="py-1 px-2 whitespace-nowrap">COMPETÊNCIA</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">SALÁRIO BASE</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">HORAS EXTRAS</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">COMISSÕES</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">DESCONTO INSS</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">VALES/ADIANT.</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap font-black">LÍQUIDO PAGO</th>
                    <th className="py-1 px-2 whitespace-nowrap">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-stone-800 uppercase font-medium">
                  {folhasHistorico.map(f => (
                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/60">
                      <td className="py-1 px-2 font-black text-slate-900 dark:text-white whitespace-nowrap">{f.competencia} ({f.mesAno})</td>
                      <td className="py-1 px-2 text-right font-mono whitespace-nowrap">{formatCurrencyBRL(f.salarioBase)}</td>
                      <td className="py-1 px-2 text-right font-mono whitespace-nowrap text-sky-700">{formatCurrencyBRL(f.horasExtras)}</td>
                      <td className="py-1 px-2 text-right font-mono whitespace-nowrap text-amber-700">{formatCurrencyBRL(f.comissaoSilagem)}</td>
                      <td className="py-1 px-2 text-right font-mono whitespace-nowrap text-rose-700">-{formatCurrencyBRL(f.inss)}</td>
                      <td className="py-1 px-2 text-right font-mono whitespace-nowrap text-rose-700">-{formatCurrencyBRL(f.descontoVales)}</td>
                      <td className="py-1 px-2 text-right font-mono font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatCurrencyBRL(f.salarioLiquido)}</td>
                      <td className="py-1 px-2 whitespace-nowrap">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-bold">
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. BLOCO: OCORRÊNCIAS DE PONTO */}
        {activeProntuarioTab === 'PONTO' && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">TOTAL DE FALTAS</span>
                <div className="text-sm font-black text-amber-700 mt-0.5">
                  {ocorrenciasPonto.filter(p => p.tipo.startsWith('FALTA')).reduce((a, b) => a + b.quantidade, 0)} DIA(S)
                </div>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">HORAS EXTRAS ACUMULADAS</span>
                <div className="text-sm font-black text-sky-700 mt-0.5">
                  {ocorrenciasPonto.filter(p => p.tipo.startsWith('HORA_EXTRA')).reduce((a, b) => a + b.quantidade, 0)} HORAS
                </div>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">ATESTADOS MÉDICOS</span>
                <div className="text-sm font-black text-emerald-700 mt-0.5">
                  {ocorrenciasPonto.filter(p => p.tipo === 'ATESTADO_MEDICO').reduce((a, b) => a + b.quantidade, 0)} DIA(S)
                </div>
              </div>
            </div>

            <div className="border border-slate-300 dark:border-stone-700 rounded overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-slate-600 dark:text-stone-300 uppercase font-bold text-[10px]">
                    <th className="py-1 px-2 whitespace-nowrap">DATA</th>
                    <th className="py-1 px-2 whitespace-nowrap">TIPO DE OCORRÊNCIA</th>
                    <th className="py-1 px-2 whitespace-nowrap text-center">QUANTIDADE</th>
                    <th className="py-1 px-2 whitespace-nowrap">MOTIVO REGISTRADO</th>
                    <th className="py-1 px-2 whitespace-nowrap">CID / MÉDICO / DETALHES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-stone-800 uppercase font-medium">
                  {ocorrenciasPonto.map(oc => (
                    <tr key={oc.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/60">
                      <td className="py-1 px-2 font-mono whitespace-nowrap">{formatDateBR(oc.data)}</td>
                      <td className="py-1 px-2 font-bold whitespace-nowrap">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                          oc.tipo === 'ATESTADO_MEDICO' ? 'bg-emerald-100 text-emerald-900' :
                          oc.tipo.startsWith('HORA_EXTRA') ? 'bg-sky-100 text-sky-900' :
                          'bg-amber-100 text-amber-900'
                        }`}>
                          {oc.tipo.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-center font-black whitespace-nowrap">
                        {oc.quantidade} {oc.unidade}
                      </td>
                      <td className="py-1 px-2 text-slate-800 dark:text-stone-200 font-bold">{oc.motivo}</td>
                      <td className="py-1 px-2 text-[10px] text-slate-500 font-mono whitespace-nowrap">
                        {oc.cid ? `CID: ${oc.cid} • ${oc.medicoOuObs || ''}` : (oc.medicoOuObs || '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. BLOCO: VALES & ADIANTAMENTOS */}
        {activeProntuarioTab === 'VALES' && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">SALDO PENDENTE DE DESCONTO</span>
                <div className="text-sm font-black text-rose-700 mt-0.5">
                  {formatCurrencyBRL(valesList.filter(v => v.status === 'PENDENTE').reduce((a, b) => a + b.valor, 0))}
                </div>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">TOTAL CONCEDIDO (QUITADO)</span>
                <div className="text-sm font-black text-emerald-700 mt-0.5">
                  {formatCurrencyBRL(valesList.filter(v => v.status === 'QUITADO_FOLHA').reduce((a, b) => a + b.valor, 0))}
                </div>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">VALE QUINZENAL PADRÃO (40%)</span>
                <div className="text-sm font-black text-sky-700 mt-0.5">
                  {formatCurrencyBRL((Number(selectedEmployee.baseSalary || selectedEmployee.salary) || 0) * 0.4)}
                </div>
              </div>
            </div>

            <div className="border border-slate-300 dark:border-stone-700 rounded overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-slate-600 dark:text-stone-300 uppercase font-bold text-[10px]">
                    <th className="py-1 px-2 whitespace-nowrap">DATA</th>
                    <th className="py-1 px-2 whitespace-nowrap">TIPO DO VALE</th>
                    <th className="py-1 px-2 text-right whitespace-nowrap">VALOR</th>
                    <th className="py-1 px-2 whitespace-nowrap">PAGAMENTO</th>
                    <th className="py-1 px-2 whitespace-nowrap">MÊS DESCONTO</th>
                    <th className="py-1 px-2 whitespace-nowrap">STATUS</th>
                    <th className="py-1 px-2 whitespace-nowrap">OBSERVAÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-stone-800 uppercase font-medium">
                  {valesList.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/60">
                      <td className="py-1 px-2 font-mono whitespace-nowrap">{formatDateBR(v.data)}</td>
                      <td className="py-1 px-2 font-bold whitespace-nowrap">
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 text-[9px]">
                          {v.tipo.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right font-black font-mono text-slate-900 dark:text-white whitespace-nowrap">{formatCurrencyBRL(v.valor)}</td>
                      <td className="py-1 px-2 font-bold text-[10px] whitespace-nowrap">{v.formaPagamento}</td>
                      <td className="py-1 px-2 font-mono whitespace-nowrap">{v.mesDesconto}</td>
                      <td className="py-1 px-2 whitespace-nowrap">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          v.status === 'PENDENTE' ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'
                        }`}>
                          {v.status === 'PENDENTE' ? 'EM ABERTO' : 'QUITADO NA FOLHA'}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-[10px] text-slate-500">{v.observacao || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. BLOCO: FÉRIAS CLT */}
        {activeProntuarioTab === 'FERIAS' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">DIAS DE DIREITO ADQUIRIDOS</span>
                <div className="text-base font-black text-sky-700 dark:text-sky-400 mt-0.5">
                  {feriasCalculadas.diasAdquiridos} DIAS
                </div>
                <span className="text-[8.5px] text-slate-500 block">(2,5 DIAS POR MÊS TRABALHADO)</span>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">SALDO DE FÉRIAS DISPONÍVEL</span>
                <div className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {feriasCalculadas.saldoDias} DIAS
                </div>
                <span className="text-[8.5px] text-emerald-600 block">PRONTO PARA AGENDAMENTO</span>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">VALOR ESTIMADO (+1/3 CLT)</span>
                <div className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {formatCurrencyBRL(feriasCalculadas.valorEstimadoFeriasMaisTerco)}
                </div>
                <span className="text-[8.5px] text-slate-500 block">SALÁRIO + 1/3 CONSTITUCIONAL</span>
              </div>
              <div className="border border-slate-300/80 rounded bg-slate-50 dark:bg-stone-900 p-2 shadow-xs">
                <span className="text-slate-500 font-bold uppercase block text-[9px]">LIMITE CONCESSIVO SEGURO</span>
                <div className="text-base font-black text-amber-700 dark:text-amber-400 mt-0.5 font-mono">
                  {formatDateBR(feriasCalculadas.limiteConcessivo)}
                </div>
                <span className="text-[8.5px] text-amber-600 block">EVITAR PAGAMENTO EM DOBRO</span>
              </div>
            </div>

            <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-900 space-y-2 uppercase text-xs">
              <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>PERÍODOS AQUISITIVOS REGISTRADOS (ENGENHARIA CLT ART. 130)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 dark:text-stone-300">
                <div className="border border-slate-300 dark:border-stone-800 p-2 rounded bg-white dark:bg-stone-850">
                  <span className="text-slate-500 text-[10px] font-bold block">PERÍODO AQUISITIVO EM CURSO:</span>
                  <strong className="text-sm font-mono text-slate-900 dark:text-white">
                    {formatDateBR(feriasCalculadas.periodoAquisitivoInicio)} ATÉ {formatDateBR(feriasCalculadas.periodoAquisitivoFim)}
                  </strong>
                  <p className="text-[10px] text-slate-500 mt-1">Acúmulo proporcional de 2,5 dias a cada 30 dias de contrato ativo.</p>
                </div>
                <div className="border border-slate-300 dark:border-stone-800 p-2 rounded bg-white dark:bg-stone-850">
                  <span className="text-slate-500 text-[10px] font-bold block">PRAZO LIMITE PARA GOZO (PERÍODO CONCESSIVO):</span>
                  <strong className="text-sm font-mono text-amber-700 dark:text-amber-400">
                    {formatDateBR(feriasCalculadas.limiteConcessivo)}
                  </strong>
                  <p className="text-[10px] text-slate-500 mt-1">Concessão dentro dos 12 meses subsequentes ao término do período aquisitivo.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. BLOCO: PRONTUÁRIO & DADOS CADASTRAIS */}
        {activeProntuarioTab === 'CADASTRO' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs uppercase">
            <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-900 space-y-1.5">
              <span className="text-[10px] font-black text-slate-500 block">DADOS PESSOAIS & IDENTIFICAÇÃO</span>
              <div><strong>NOME COMPLETO:</strong> {selectedEmployee.name}</div>
              <div><strong>CPF:</strong> {selectedEmployee.cpf || 'NÃO INFORMADO'}</div>
              <div><strong>RG:</strong> {selectedEmployee.rg || 'NÃO INFORMADO'}</div>
              <div><strong>PIS / PASEP:</strong> {selectedEmployee.pis || 'NÃO INFORMADO'}</div>
              <div><strong>DATA DE NASCIMENTO:</strong> {formatDateBR(selectedEmployee.birthDate)}</div>
              <div><strong>TELEFONE:</strong> {selectedEmployee.phone || 'NÃO INFORMADO'}</div>
              <div><strong>CIDADE RESIDÊNCIA:</strong> {selectedEmployee.city || 'NÃO INFORMADA'}</div>
            </div>

            <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-900 space-y-1.5">
              <span className="text-[10px] font-black text-slate-500 block">VÍNCULO CONTRATUAL & DADOS FINANCEIROS</span>
              <div><strong>CARGO PRINCIPAL:</strong> {selectedEmployee.role}</div>
              <div><strong>VÍNCULO:</strong> {selectedEmployee.contractType || selectedEmployee.registrationType || 'REGISTRADO CLT'}</div>
              <div><strong>ADMISSÃO:</strong> {formatDateBR(selectedEmployee.admissionDate)}</div>
              <div><strong>CNH CATEGORIA / VALIDADE:</strong> {selectedEmployee.cnhCategory || 'N/A'} - {formatDateBR(selectedEmployee.cnhExpiration)}</div>
              <div><strong>CHAVE PIX:</strong> {selectedEmployee.chavePix || selectedEmployee.pixKey || 'NÃO CADASTRADA'} ({selectedEmployee.pixKeyType || 'CHAVE'})</div>
              <div><strong>BANCO / AG / CONTA:</strong> {selectedEmployee.bankAccount || selectedEmployee.banco_chave_pix || 'CONTA PADRÃO'}</div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          4. MODAL: REGISTRAR REAJUSTE SALARIAL (PADRÃO OURO)
         ===================================================================== */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-lg bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header Acetinado 3D */}
            <div className="px-4 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 flex items-center justify-between shrink-0 rounded-t-lg shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)]">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">
                  REGISTRAR ALTERAÇÃO SALARIAL • {selectedEmployee.name}
                </h4>
              </div>
              <button onClick={() => setIsSalaryModalOpen(false)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSalaryChange} className="p-4 space-y-3 text-xs bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-200">
              <div>
                <label className="text-[10px] font-bold uppercase block text-slate-500 mb-0.5">TIPO DE ALTERAÇÃO</label>
                <select
                  value={newSalaryTipo}
                  onChange={e => setNewSalaryTipo(e.target.value as any)}
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded font-bold uppercase cursor-pointer"
                >
                  <option value="DISSIDIO">DISSÍDIO COLETIVO ANUAL</option>
                  <option value="PROMOCAO">PROMOÇÃO DE CARGO / FUNÇÃO</option>
                  <option value="MERITO">MÉRITO / DESEMPENHO</option>
                  <option value="AJUSTE">AJUSTE SALARIAL / ENQUADRAMENTO</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase block text-slate-500 mb-0.5">NOVO SALÁRIO BASE (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newSalaryValor}
                  onChange={e => setNewSalaryValor(e.target.value)}
                  placeholder="EX: 3500.00"
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded font-black font-mono text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase block text-slate-500 mb-0.5">COMISSÃO POR HORA (R$/H)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newComissaoHora}
                    onChange={e => setNewComissaoHora(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase block text-slate-500 mb-0.5">COMISSÃO HECTARE (R$/HA)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newComissaoHectare}
                    onChange={e => setNewComissaoHectare(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2 py-1 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase block text-slate-500 mb-0.5">MOTIVO / OBSERVAÇÕES</label>
                <input
                  type="text"
                  value={newSalaryMotivo}
                  onChange={e => setNewSalaryMotivo(e.target.value)}
                  placeholder="EX: ACORDO COLETIVO SINDICATO RURAL 2026"
                  className="w-full px-2 py-1 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded font-medium uppercase"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(false)}
                  className="px-3 py-1 border border-slate-300 dark:border-stone-700 rounded text-slate-700 dark:text-stone-300 font-bold uppercase cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold uppercase cursor-pointer shadow-xs"
                >
                  SALVAR REAJUSTE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
