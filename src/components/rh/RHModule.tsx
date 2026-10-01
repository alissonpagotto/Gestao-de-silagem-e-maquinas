import React, { useState, useMemo } from 'react';
import { 
  Users, 
  FileText, 
  Calendar, 
  AlertCircle, 
  DollarSign, 
  UserSquare2,
  UserCheck,
  ShieldCheck,
  UserPlus,
  FileHeart,
  CalendarX2,
  UserX,
  Printer,
  Plus
} from 'lucide-react';
import { 
  Employee, 
  PayrollRecord, 
  VacationRecord, 
  LeaveRecord, 
  SalaryAdvance,
  CompanyProfile,
  MedicalCertificateRecord,
  AbsenceRecord,
  ServiceOrder
} from '../../types';
import { 
  getStoredMedicalCertificates, 
  saveStoredMedicalCertificates, 
  getStoredAbsences, 
  saveStoredAbsences,
  getStoredEmployees,
  saveStoredEmployees,
  getStoredVacations,
  saveStoredVacations,
  getStoredTerminations,
  saveStoredTerminations,
  getActiveCompanyId
} from '../../lib/storage';
import {
  toValidUUID,
  fetchRhFuncionarios,
  isSupabaseConfigured,
  mapRowToEmployee,
  fetchCloudVacations,
  fetchCloudTerminations,
  mapRowToVacationRecord,
  mapRowToTerminationRecord,
} from '../../lib/supabaseService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { RHDashboardTab } from './RHDashboardTab';
import { PayrollTab } from './PayrollTab';
import { VacationsTab } from './VacationsTab';
import { LeavesTab } from './LeavesTab';
import { AdvancesTab } from './AdvancesTab';
import { AtestadosTab } from './AtestadosTab';
import { FaltasTab } from './FaltasTab';
import { RescisaoTab } from './RescisaoTab';
import { PayslipModal } from './PayslipModal';
import { EmployeesModule } from '../employees/EmployeesModule';

interface RHModuleProps {
  employees: Employee[];
  payrolls: PayrollRecord[];
  vacations: VacationRecord[];
  leaves: LeaveRecord[];
  advances: SalaryAdvance[];
  services?: ServiceOrder[];
  certificates?: MedicalCertificateRecord[];
  absences?: AbsenceRecord[];
  companyProfile: CompanyProfile;
  initialSubTab?: RHTabType;
  onSaveEmployees: (employees: Employee[]) => void;
  onDeleteEmployee?: (id: string) => Promise<void> | void;
  onSavePayrolls: (payrolls: PayrollRecord[]) => void;
  onSaveVacations: (vacations: VacationRecord[]) => void;
  onSaveLeaves: (leaves: LeaveRecord[]) => void;
  onSaveAdvances: (advances: SalaryAdvance[]) => void;
  onSaveCertificates?: (certificates: MedicalCertificateRecord[]) => void;
  onSaveAbsences?: (absences: AbsenceRecord[]) => void;
  onNavigateToEmployees?: () => void;
}

export type RHTabType = 
  | 'dashboard' 
  | 'funcionarios' 
  | 'folha' 
  | 'ferias' 
  | 'afastamentos' 
  | 'adiantamentos' 
  | 'atestados' 
  | 'faltas'
  | 'rescisao';

export const RHModule: React.FC<RHModuleProps> = ({
  employees,
  payrolls,
  vacations,
  leaves,
  advances,
  services,
  certificates: propCertificates,
  absences: propAbsences,
  companyProfile,
  initialSubTab,
  onSaveEmployees,
  onDeleteEmployee,
  onSavePayrolls,
  onSaveVacations,
  onSaveLeaves,
  onSaveAdvances,
  onSaveCertificates,
  onSaveAbsences,
  onNavigateToEmployees,
}) => {
  const [activeTab, setActiveTab] = useState<RHTabType>(initialSubTab || 'dashboard');
  const [currentMonthRef, setCurrentMonthRef] = useState<string>('09/2026');

  // Estado e persistência de Atestados Médicos
  const [certificates, setCertificates] = useState<MedicalCertificateRecord[]>(() => {
    return propCertificates || getStoredMedicalCertificates();
  });

  const handleSaveCertificates = (updated: MedicalCertificateRecord[]) => {
    setCertificates(updated);
    saveStoredMedicalCertificates(updated);
    if (onSaveCertificates) {
      onSaveCertificates(updated);
    }
  };

  // Estado e persistência de Faltas e Ausências
  const [absences, setAbsences] = useState<AbsenceRecord[]>(() => {
    return propAbsences || getStoredAbsences();
  });

  const handleSaveAbsences = (updated: AbsenceRecord[]) => {
    setAbsences(updated);
    saveStoredAbsences(updated);
    if (onSaveAbsences) {
      onSaveAbsences(updated);
    }
  };

  // Aplicar desconto de falta na folha de pagamento
  const handleApplyDiscountToPayroll = (absence: AbsenceRecord) => {
    if (!absence.discountAmount || absence.discountAmount <= 0) return;
    
    // Procura a folha do colaborador para o mês correspondente
    const targetPayroll = payrolls.find(p => p.employeeId === absence.employeeId && p.referenceMonth === absence.referenceMonth);
    if (targetPayroll) {
      const updatedPayrolls = payrolls.map(p => {
        if (p.id === targetPayroll.id) {
          const currentOther = p.otherDiscounts || 0;
          const newOther = currentOther + (absence.discountAmount || 0);
          const newNet = Math.max(0, (p.baseSalary + (p.overtimeAmount || 0) + (p.bonusAmount || 0)) - ((p.inssDiscount || 0) + (p.advancesDiscount || 0) + newOther));
          return {
            ...p,
            otherDiscounts: newOther,
            netSalary: newNet,
          };
        }
        return p;
      });
      onSavePayrolls(updatedPayrolls);
    }
  };

  const { currentUser, companyId: authCompanyId } = useAuth();
  const currentUserId = currentUser?.id;

  // Isolamento estrito por Usuário Autenticado (RLS auth.uid() = user_id):
  // Garante que todas as abas do RH exibam ÚNICA E EXCLUSIVAMENTE colaboradores associados à minha conta
  const tenantEmployees = useMemo(() => {
    if (!currentUserId) return [];

    return employees.filter(emp => {
      if (!emp || !emp.name || emp.name.trim() === '') return false;
      const st = String(emp.status || '').toLowerCase();
      if (st === 'excluido' || st === 'inativo' || emp.active === false) return false;
      // Ignora registro duplicado/antigo do ALISSON PAG sem CPF
      if (emp.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' || (emp.name.trim().toUpperCase() === 'ALISSON PAG' && !emp.cpf)) {
        return false;
      }
      const empUid = String(emp.userId || (emp as any).user_id || '').trim();
      if (!empUid) {
        const empCid = String(emp.companyId || (emp as any).company_id || '').trim();
        return empCid === currentUserId;
      }
      return empUid === currentUserId;
    });
  }, [employees, currentUserId]);

  // Ordenação automática e permanente de A a Z dos colaboradores para o RH
  const sortedEmployees = useMemo(() => {
    return [...tenantEmployees].sort((a, b) => 
      (a.name || (a as any).nome_funcionario || '').localeCompare(b.name || (b as any).nome_funcionario || '', 'pt-BR')
    );
  }, [tenantEmployees]);

  // 3. Limpeza Imediata da Tela e Sincronização Estrita do RH por Usuário Autenticado (RLS auth.uid() = user_id)
  React.useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const setupRHAuthSync = async () => {
      // 1. Obtém o ID do usuário autenticado no sistema (auth.uid)
      let activeUid = currentUserId;
      if (!activeUid && isSupabaseConfigured) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          activeUid = authData?.user?.id;
          if (!activeUid) {
            const { data: sessData } = await supabase.auth.getSession();
            activeUid = sessData?.session?.user?.id;
          }
        } catch (_) {}
      }

      // 2. Elimina qualquer tentativa de buscar registros sem essa cláusula de amarração
      if (!activeUid) return;

      // 3. Limpeza Imediata da Tela:
      // Ao carregar a página, qualquer dado residual de terceiros preso no estado local é totalmente descartado
      const stored = getStoredEmployees();
      const strictlyMine = stored.filter(emp => {
        const uid = String(emp.userId || (emp as any).user_id || '').trim();
        if (uid) return uid === activeUid;
        const cid = String(emp.companyId || (emp as any).company_id || '').trim();
        return cid === activeUid;
      });

      if (strictlyMine.length !== stored.length) {
        saveStoredEmployees(strictlyMine);
        if (onSaveEmployees) onSaveEmployees(strictlyMine);
      }

      // Query de listagem inicial (fetch) aplicando estritamente .eq('user_id', activeUid)
      if (isSupabaseConfigured) {
        try {
          const fresh = await fetchRhFuncionarios(undefined, activeUid);
          if (isMounted && fresh && Array.isArray(fresh)) {
            const verifiedFresh = fresh.filter(emp => {
              const uid = String(emp.userId || (emp as any).user_id || '').trim();
              return uid === activeUid;
            });
            saveStoredEmployees(verifiedFresh);
            if (onSaveEmployees) onSaveEmployees(verifiedFresh);
          }
        } catch (err) {
          console.warn('[RHModule] Erro ao sincronizar funcionários:', err);
        }

        // Sincroniza férias e rescisões iniciais do locatário
        const activeTenant = authCompanyId || activeUid || getActiveCompanyId() || 'default';
        fetchCloudVacations(activeTenant)
          .then((cloudVacs) => {
            if (isMounted && cloudVacs && Array.isArray(cloudVacs) && cloudVacs.length > 0) {
              saveStoredVacations(cloudVacs);
              if (onSaveVacations) onSaveVacations(cloudVacs);
            }
          })
          .catch(() => {});

        fetchCloudTerminations(activeTenant)
          .then((cloudTerms) => {
            if (isMounted && cloudTerms && Array.isArray(cloudTerms) && cloudTerms.length > 0) {
              saveStoredTerminations(cloudTerms);
            }
          })
          .catch(() => {});

        // Canal de escuta Realtime (.on) para tabelas do RH (rh_funcionarios, rh_ferias, rh_rescisoes)
        const channelId = `rh_module_rt_${activeUid}_${Date.now()}`;
        channel = supabase
          .channel(channelId)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'rh_funcionarios',
              filter: `user_id=eq.${activeUid}`,
            },
            async (payload: any) => {
              if (!isMounted) return;
              console.info('📡 [Realtime RH] Alteração em rh_funcionarios filtrada por user_id:', payload.eventType);

              // Validação de segurança: se vier de outro user_id, ignora
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const row = payload.new;
                if (row && String(row.user_id || '').trim() !== activeUid) {
                  return;
                }
              }

              // Re-sincroniza com filtro estrito por user_id
              const fresh = await fetchRhFuncionarios(undefined, activeUid);
              if (isMounted && fresh && Array.isArray(fresh)) {
                const strictlyMineFresh = fresh.filter(e => String(e.userId || (e as any).user_id || '').trim() === activeUid);
                saveStoredEmployees(strictlyMineFresh);
                if (onSaveEmployees) onSaveEmployees(strictlyMineFresh);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'rh_ferias',
            },
            (payload: any) => {
              if (!isMounted) return;
              const eventType = payload?.eventType;
              if (eventType === 'DELETE') {
                const oldId = payload?.old?.id;
                if (oldId) {
                  const targetId = toValidUUID(String(oldId));
                  const nextList = getStoredVacations().filter((v) => toValidUUID(v.id) !== targetId);
                  saveStoredVacations(nextList);
                  if (onSaveVacations) onSaveVacations(nextList);
                }
                return;
              }
              const row = payload?.new;
              if (!row) return;
              if (row.company_id && String(row.company_id) !== String(activeTenant)) return;
              const mapped = mapRowToVacationRecord(row);
              if (mapped) {
                const current = getStoredVacations();
                const exists = current.some((v) => toValidUUID(v.id) === toValidUUID(mapped.id));
                const nextList = exists
                  ? current.map((v) => (toValidUUID(v.id) === toValidUUID(mapped.id) ? { ...v, ...mapped } : v))
                  : [mapped, ...current];
                saveStoredVacations(nextList);
                if (onSaveVacations) onSaveVacations(nextList);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'rh_rescisoes',
            },
            (payload: any) => {
              if (!isMounted) return;
              const eventType = payload?.eventType;
              if (eventType === 'DELETE') {
                const oldId = payload?.old?.id;
                if (oldId) {
                  const targetId = toValidUUID(String(oldId));
                  const nextList = getStoredTerminations().filter((t) => toValidUUID(t.id) !== targetId);
                  saveStoredTerminations(nextList);
                }
                return;
              }
              const row = payload?.new;
              if (!row) return;
              if (row.company_id && String(row.company_id) !== String(activeTenant)) return;
              const mapped = mapRowToTerminationRecord(row);
              if (mapped) {
                const current = getStoredTerminations();
                const exists = current.some((t) => toValidUUID(t.id) === toValidUUID(mapped.id));
                const nextList = exists
                  ? current.map((t) => (toValidUUID(t.id) === toValidUUID(mapped.id) ? { ...t, ...mapped } : t))
                  : [mapped, ...current];
                saveStoredTerminations(nextList);
              }
            }
          )
          .subscribe();
      }
    };

    setupRHAuthSync();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUserId, onSaveEmployees]);

  // Payslip Modal State
  const [viewingPayslip, setViewingPayslip] = useState<PayrollRecord | null>(null);

  const selectedPayslipEmployee = viewingPayslip 
    ? sortedEmployees.find(e => e.id === viewingPayslip.employeeId)
    : undefined;

  const handleOpenNewPayroll = () => {
    setActiveTab('folha');
  };

  const handleOpenNewVacation = () => {
    setActiveTab('ferias');
  };

  const handleOpenNewLeave = () => {
    setActiveTab('afastamentos');
  };

  const handleOpenNewAdvance = () => {
    setActiveTab('adiantamentos');
  };

  // Triggers para acionar ações de Funcionários a partir do cabeçalho superior
  const [externalNewEmployeeTrigger, setExternalNewEmployeeTrigger] = useState(0);
  const [externalPrintEmployeesTrigger, setExternalPrintEmployeesTrigger] = useState(0);

  return (
    <div className="w-full max-w-none space-y-3 sm:space-y-4">
      
      {/* Top Header com Título, Subtítulo e Botões de Ação */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/20 pb-2 sm:pb-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#000000] tracking-tight">
            Recursos Humanos
          </h1>
          <p className="text-xs text-[#000000] font-medium">
            Quadro de funcionários, folha de pagamento, férias e afastamentos
          </p>
        </div>

        {activeTab === 'funcionarios' ? (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Botão Imprimir Lista reposicionado */}
            <button
              type="button"
              onClick={() => setExternalPrintEmployeesTrigger(prev => prev + 1)}
              title="Imprimir relatório completo de funcionários e operadores com logotipo e dados cadastrais"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-bold text-black bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-black" />
              <span>Imprimir Lista</span>
            </button>

            {/* Botão + Novo Cadastro reposicionado */}
            <button
              type="button"
              onClick={() => setExternalNewEmployeeTrigger(prev => prev + 1)}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cadastro</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setActiveTab('funcionarios')}
            className="self-start sm:self-auto inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-blue-200/80 dark:border-stone-800 bg-[#87AFE3] dark:bg-stone-900 text-black dark:text-white hover:bg-blue-200/60 dark:hover:bg-stone-800 text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <UserSquare2 className="w-3.5 h-3.5 text-black dark:text-sky-400" />
            <span>Cadastros & CNH</span>
          </button>
        )}
      </div>

      {/* Navegação por Abas - Mais compacta */}
      <div className="no-print crm-card bg-[#87AFE3] dark:bg-stone-900 rounded-xl border border-blue-200/80 dark:border-stone-800 p-1 sm:p-1.5 flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto shadow-xs">
        
        {/* Aba 1: Dashboard */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        {/* Aba 2: Funcionários */}
        <button
          type="button"
          onClick={() => setActiveTab('funcionarios')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'funcionarios'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <UserSquare2 className="w-3.5 h-3.5" />
          <span>Funcionários</span>
        </button>

        {/* Aba 3: Folha de Pagamento */}
        <button
          type="button"
          onClick={() => setActiveTab('folha')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'folha'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Folha de Pagamento</span>
        </button>

        {/* Aba 4: Férias */}
        <button
          type="button"
          onClick={() => setActiveTab('ferias')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'ferias'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Férias</span>
        </button>

        {/* Aba 5: Afastamentos */}
        <button
          type="button"
          onClick={() => setActiveTab('afastamentos')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'afastamentos'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Afastamentos</span>
        </button>

        {/* Aba 6: Adiantamentos */}
        <button
          type="button"
          onClick={() => setActiveTab('adiantamentos')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'adiantamentos'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Adiantamentos</span>
        </button>

        {/* Aba 7: Atestados (Nova Aba RH) */}
        <button
          type="button"
          onClick={() => setActiveTab('atestados')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'atestados'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <FileHeart className="w-3.5 h-3.5" />
          <span>Atestados</span>
        </button>

        {/* Aba 8: Faltas (Nova Aba RH) */}
        <button
          type="button"
          onClick={() => setActiveTab('faltas')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'faltas'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <CalendarX2 className="w-3.5 h-3.5" />
          <span>Faltas</span>
        </button>

        {/* Aba 9: Rescisão (Nova Aba RH) */}
        <button
          type="button"
          onClick={() => setActiveTab('rescisao')}
          className={`inline-flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'rescisao'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-blue-100/70 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-100 dark:hover:bg-stone-700'
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          <span>Rescisão</span>
        </button>

      </div>

      {/* Renderização do Conteúdo de Cada Aba */}
      {activeTab === 'dashboard' && (
        <RHDashboardTab
          employees={sortedEmployees}
          payrolls={payrolls}
          vacations={vacations}
          leaves={leaves}
          advances={advances}
          currentMonthRef={currentMonthRef}
          onNavigateTab={(tab) => {
            setActiveTab(tab);
          }}
          onOpenNewPayroll={handleOpenNewPayroll}
          onOpenNewVacation={handleOpenNewVacation}
          onOpenNewLeave={handleOpenNewLeave}
          onOpenNewAdvance={handleOpenNewAdvance}
          onViewPayslip={(p) => setViewingPayslip(p)}
        />
      )}

      {activeTab === 'funcionarios' && (
        <EmployeesModule
          employees={sortedEmployees}
          companyProfile={companyProfile}
          onSaveEmployees={onSaveEmployees}
          onDeleteEmployee={onDeleteEmployee}
          externalNewEmployeeTrigger={externalNewEmployeeTrigger}
          externalPrintEmployeesTrigger={externalPrintEmployeesTrigger}
        />
      )}

      {activeTab === 'folha' && (
        <PayrollTab
          employees={sortedEmployees}
          payrolls={payrolls}
          advances={advances}
          absences={absences}
          services={services}
          currentMonthRef={currentMonthRef}
          onChangeMonthRef={setCurrentMonthRef}
          onSavePayrolls={onSavePayrolls}
          onViewPayslip={(p) => setViewingPayslip(p)}
        />
      )}

      {activeTab === 'ferias' && (
        <VacationsTab
          employees={sortedEmployees}
          vacations={vacations}
          onSaveVacations={onSaveVacations}
          onSaveEmployees={onSaveEmployees}
        />
      )}

      {activeTab === 'afastamentos' && (
        <LeavesTab
          employees={sortedEmployees}
          leaves={leaves}
          onSaveLeaves={onSaveLeaves}
        />
      )}

      {activeTab === 'adiantamentos' && (
        <AdvancesTab
          employees={sortedEmployees}
          advances={advances}
          currentMonthRef={currentMonthRef}
          onSaveAdvances={onSaveAdvances}
        />
      )}

      {activeTab === 'atestados' && (
        <AtestadosTab
          employees={sortedEmployees}
          certificates={certificates}
          onSaveCertificates={handleSaveCertificates}
        />
      )}

      {activeTab === 'faltas' && (
        <FaltasTab
          employees={sortedEmployees}
          absences={absences}
          payrolls={payrolls}
          currentMonthRef={currentMonthRef}
          onSaveAbsences={handleSaveAbsences}
          onApplyDiscountToPayroll={handleApplyDiscountToPayroll}
        />
      )}

      {activeTab === 'rescisao' && (
        <RescisaoTab
          employees={sortedEmployees}
          vacations={vacations}
          companyProfile={companyProfile}
          advances={advances}
          absences={absences}
          onSaveEmployees={onSaveEmployees}
        />
      )}

      {/* Modal de Holerite / Recibo de Salário */}
      <PayslipModal
        payroll={viewingPayslip}
        employee={selectedPayslipEmployee}
        companyProfile={companyProfile}
        isOpen={!!viewingPayslip}
        onClose={() => setViewingPayslip(null)}
        advances={advances}
        absences={absences}
        services={services}
        allEmployees={sortedEmployees}
      />

    </div>
  );
};
