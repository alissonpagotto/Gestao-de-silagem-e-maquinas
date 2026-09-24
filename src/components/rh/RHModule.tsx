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
  saveStoredAbsences 
} from '../../lib/storage';
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

  // Ordenação automática e permanente de A a Z dos colaboradores para o RH
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => 
      (a.name || (a as any).nome_funcionario || '').localeCompare(b.name || (b as any).nome_funcionario || '', 'pt-BR')
    );
  }, [employees]);

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
