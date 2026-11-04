import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Search, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  X,
  CreditCard,
  Banknote,
  Receipt,
  ShieldCheck,
  Lock,
  Upload,
  Paperclip,
  Eye,
  FileText,
  Calendar,
  Layers,
  Percent,
  Info
} from 'lucide-react';
import { Employee, SalaryAdvance, PaymentMethod } from '../../types';
import { formatCurrencyBRL, formatDateBR, saveStoredSalaryAdvances } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { useAuth } from '../../context/AuthContext';
import { getActiveUserSession } from '../../lib/cadastrosBaseStorage';
import { 
  formatMoneyBRL, 
  calculateAdvanceInstallmentPlan, 
  getNextReferenceMonths 
} from './payrollHelpers';

interface AdvancesTabProps {
  employees: Employee[];
  advances: SalaryAdvance[];
  currentMonthRef: string;
  onSaveAdvances: (advances: SalaryAdvance[]) => void;
}

export const AdvancesTab: React.FC<AdvancesTabProps> = ({
  employees,
  advances,
  currentMonthRef,
  onSaveAdvances,
}) => {
  const { confirm } = useConfirm();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  // Identificação do Usuário Responsável Autorizado (Administrador / RH / Sessão Logada)
  const getAuthorizedAuditorName = React.useCallback((): string => {
    try {
      const session = getActiveUserSession();
      if (session && session.name && session.name.trim().length > 0 && session.name !== 'Administrador do Sistema') {
        return session.name.toUpperCase();
      }
    } catch {}

    if (currentUser?.displayName && currentUser.displayName.trim().length > 0) {
      return currentUser.displayName.toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0].toUpperCase();
    }
    const adminEmp = employees.find(e => 
      e.role === 'Administrador' || 
      e.role === 'Administrador Geral' || 
      String(e.role || '').toLowerCase().includes('administrador')
    );
    if (adminEmp) {
      return adminEmp.name.toUpperCase();
    }
    return 'ADMINISTRADOR GERAL';
  }, [currentUser, employees]);

  // Lista dinâmica de responsáveis autorizados para o lançamento (auditores / colaboradores)
  const responsibleOptions = React.useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const seen = new Set<string>();

    const auditor = getAuthorizedAuditorName();
    if (auditor) {
      list.push({ label: `${auditor} (Usuário Logado)`, value: auditor });
      seen.add(auditor.toUpperCase());
    }

    // Puxa dinamicamente a mesma lista global de funcionários/colaboradores do sistema
    employees.forEach(emp => {
      if (!emp || !emp.name || emp.name.trim() === '') return;
      const upper = emp.name.trim().toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        const roleLabel = emp.role ? ` (${emp.role})` : '';
        list.push({ label: `${emp.name}${roleLabel}`, value: emp.name });
      }
    });

    return list;
  }, [employees, getAuthorizedAuditorName]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<SalaryAdvance | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [referenceMonth, setReferenceMonth] = useState(currentMonthRef);
  const [status, setStatus] = useState<'pendente' | 'descontado'>('pendente');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // Parcelamento & Juros
  const [discountType, setDiscountType] = useState<'Cota Única' | 'Parcelado'>('Cota Única');
  const [installmentsCount, setInstallmentsCount] = useState<number>(2);
  const [monthlyInterestRate, setMonthlyInterestRate] = useState<number>(0);

  // Auditoria (Responsável pelo Lançamento)
  const [responsibleUser, setResponsibleUser] = useState<string>(getAuthorizedAuditorName());

  // Comprovante Anexo (PDF ou Imagem)
  const [receiptName, setReceiptName] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal para Visualização do Comprovante
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; name?: string } | null>(null);

  // Filtro rígido contra registros fakes ou oriundos de faltas (ELIMINAÇÃO DE FAKES):
  // Exibe APENAS registros que foram criados manualmente nesta aba e que possuam valor maior do que zero.
  // Bloqueia completamente a exibição de qualquer registro com valor 'R$ 0,00' ou que venha da chave de faltas.
  const isRealAdvance = React.useCallback((a: SalaryAdvance): boolean => {
    if (!a) return false;
    const val = Number(a.amount ?? (a as any).valor ?? 0);
    if (val <= 0 || isNaN(val)) return false;

    const t = String(a.type || (a as any).tipo || (a as any).tipo_registro || '').toLowerCase();
    if (t === 'injustificada' || t === 'falta_injustificada' || t.includes('injustificada') || (a as any).isAbsence) return false;

    const r = String(a.reason || a.notes || '').toLowerCase();
    if (r.includes('falta injustificada')) return false;
    if (r.includes('adiantamento quinzenal') && val === 0) return false;

    return true;
  }, []);

  const realAdvances = React.useMemo(() => {
    return advances.filter(isRealAdvance);
  }, [advances, isRealAdvance]);

  // Purga reativa imediata se o estado tiver registros com valor 0 ou faltas
  React.useEffect(() => {
    if (advances.length > 0 && advances.length !== realAdvances.length) {
      onSaveAdvances(realAdvances);
    }
  }, [advances, realAdvances, onSaveAdvances]);

  // Filtered
  const filtered = realAdvances.filter(a => 
    a.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.reason && a.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // KPIs
  const currentMonthAdvances = realAdvances.filter(a => a.referenceMonth === currentMonthRef);
  const totalValesMonth = currentMonthAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const pendentesCount = realAdvances.filter(a => a.status === 'pendente').length;
  const descontadosCount = realAdvances.filter(a => a.status === 'descontado').length;
  const totalGeralVales = realAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Cálculo da Projeção de Parcelamento Dinâmico
  const activePlan = calculateAdvanceInstallmentPlan(
    amount,
    installmentsCount,
    monthlyInterestRate,
    referenceMonth || currentMonthRef
  );

  const handleOpenModal = (advance?: SalaryAdvance) => {
    const auditor = getAuthorizedAuditorName();
    if (advance) {
      setEditingAdvance(advance);
      setSelectedEmployeeId(advance.employeeId);
      setDate(advance.date);
      setAmount(advance.amount);
      setPaymentMethod(advance.paymentMethod);
      setReferenceMonth(advance.referenceMonth || currentMonthRef);
      setStatus(advance.status);
      setReason(advance.reason || '');
      setNotes(advance.notes || '');
      setDiscountType(advance.discountType || (advance.totalInstallments && advance.totalInstallments > 1 ? 'Parcelado' : 'Cota Única'));
      setInstallmentsCount(advance.totalInstallments || 2);
      setMonthlyInterestRate(advance.monthlyInterestRate || 0);
      setResponsibleUser(advance.responsibleUser || auditor);
      setReceiptName(advance.attachmentName || '');
      setReceiptUrl(advance.attachmentUrl || '');
    } else {
      setEditingAdvance(null);
      setSelectedEmployeeId('');
      setDate(new Date().toISOString().split('T')[0]);
      setAmount(0);
      setPaymentMethod('pix');
      setReferenceMonth(currentMonthRef);
      setStatus('pendente');
      setReason('');
      setNotes('');
      setDiscountType('Cota Única');
      setInstallmentsCount(2);
      setMonthlyInterestRate(0);
      setResponsibleUser(auditor);
      setReceiptName('');
      setReceiptUrl('');
    }
    setIsModalOpen(true);
  };

  // Manipulador da Máscara Monetária BRL em Tempo Real
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/\D/g, '');
    if (!cleanDigits) {
      setAmount(0);
      return;
    }
    const num = parseInt(cleanDigits, 10) / 100;
    setAmount(num);
  };

  // Upload e Arrastar-e-Soltar de Comprovante (PDF ou Imagem)
  const processUploadedFile = (file: File) => {
    if (!file) return;
    setReceiptName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptName('');
    setReceiptUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      alert('Por favor, selecione um funcionário.');
      return;
    }
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) {
      alert('Por favor, selecione um colaborador.');
      return;
    }

    if (amount <= 0) {
      alert('Por favor, informe um valor válido para o adiantamento.');
      return;
    }

    const currentAuditor = responsibleUser || getAuthorizedAuditorName();

    if (discountType === 'Parcelado' && installmentsCount > 1) {
      // Provisionamento automático para as próximas competências consecutivas
      const groupId = editingAdvance?.installmentGroupId || `adv_grp_${Date.now()}`;
      const plan = calculateAdvanceInstallmentPlan(
        amount,
        installmentsCount,
        monthlyInterestRate,
        referenceMonth || currentMonthRef
      );

      const newInstallmentRecords: (SalaryAdvance & { tipo: string; tipo_registro: string; valor: number })[] = plan.installments.map((inst) => ({
        id: `adv_${Date.now()}_${inst.number}`,
        employeeId: emp.id,
        employeeName: emp.name,
        date,
        amount: inst.amount,
        valor: inst.amount,
        tipo: 'vale_salarial',
        tipo_registro: 'vale_salarial',
        paymentMethod,
        referenceMonth: inst.referenceMonth,
        status: status,
        reason: reason
          ? `${reason} (Parcela ${inst.number}/${installmentsCount})`
          : `Adiantamento Salarial (Parcela ${inst.number}/${installmentsCount})`,
        notes: notes || undefined,
        discountType: 'Parcelado',
        installmentNumber: inst.number,
        totalInstallments: installmentsCount,
        installmentGroupId: groupId,
        monthlyInterestRate: monthlyInterestRate > 0 ? monthlyInterestRate : undefined,
        totalAmountWithInterest: plan.totalWithInterest,
        responsibleUser: currentAuditor,
        attachmentName: receiptName || undefined,
        attachmentUrl: receiptUrl || undefined,
        createdAt: new Date().toISOString(),
      }));

      // Se estiver editando, substitui o registro antigo ou grupo
      let updatedList = realAdvances;
      if (editingAdvance) {
        if (editingAdvance.installmentGroupId) {
          updatedList = updatedList.filter(a => a.installmentGroupId !== editingAdvance.installmentGroupId);
        } else {
          updatedList = updatedList.filter(a => a.id !== editingAdvance.id);
        }
      }

      const nextList = [...newInstallmentRecords, ...updatedList];
      saveStoredSalaryAdvances(nextList);
      onSaveAdvances(nextList);
      try {
        localStorage.setItem('agrocontrol_adiantamentos', JSON.stringify(nextList));
        localStorage.setItem('colaca_silagem_rh_adiantamentos', JSON.stringify(nextList));
      } catch (_) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('silagem_advances_updated', { detail: nextList }));
        window.dispatchEvent(new CustomEvent('agrocontrol_adiantamentos_updated', { detail: nextList }));
      }
    } else {
      // Cota Única (1x)
      let nextList: SalaryAdvance[];
      if (editingAdvance) {
        nextList = realAdvances.map(a => a.id === editingAdvance.id ? {
          ...a,
          employeeId: emp.id,
          employeeName: emp.name,
          date,
          amount,
          valor: amount,
          tipo: 'vale_salarial',
          tipo_registro: 'vale_salarial',
          paymentMethod,
          referenceMonth,
          status,
          reason,
          notes,
          discountType: 'Cota Única' as const,
          installmentNumber: 1,
          totalInstallments: 1,
          monthlyInterestRate: 0,
          totalAmountWithInterest: amount,
          responsibleUser: currentAuditor,
          attachmentName: receiptName || undefined,
          attachmentUrl: receiptUrl || undefined,
        } : a);
      } else {
        const newAdv = {
          id: `adv_${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          date,
          amount,
          valor: amount,
          tipo: 'vale_salarial',
          tipo_registro: 'vale_salarial',
          paymentMethod,
          referenceMonth,
          status,
          reason,
          notes,
          discountType: 'Cota Única' as const,
          installmentNumber: 1,
          totalInstallments: 1,
          monthlyInterestRate: 0,
          totalAmountWithInterest: amount,
          responsibleUser: currentAuditor,
          attachmentName: receiptName || undefined,
          attachmentUrl: receiptUrl || undefined,
          createdAt: new Date().toISOString(),
        };
        nextList = [newAdv, ...realAdvances];
      }
      saveStoredSalaryAdvances(nextList);
      onSaveAdvances(nextList);
      try {
        localStorage.setItem('agrocontrol_adiantamentos', JSON.stringify(nextList));
        localStorage.setItem('colaca_silagem_rh_adiantamentos', JSON.stringify(nextList));
      } catch (_) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('silagem_advances_updated', { detail: nextList }));
        window.dispatchEvent(new CustomEvent('agrocontrol_adiantamentos_updated', { detail: nextList }));
      }
    }

    setIsModalOpen(false);
  };

  const handleToggleStatus = (id: string, currentStatus: 'pendente' | 'descontado') => {
    const nextStatus: 'pendente' | 'descontado' = currentStatus === 'pendente' ? 'descontado' : 'pendente';
    const nextList: SalaryAdvance[] = realAdvances.map(a => a.id === id ? { ...a, status: nextStatus } : a);
    saveStoredSalaryAdvances(nextList);
    onSaveAdvances(nextList);
    try {
      localStorage.setItem('agrocontrol_adiantamentos', JSON.stringify(nextList));
      localStorage.setItem('colaca_silagem_rh_adiantamentos', JSON.stringify(nextList));
    } catch (_) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('silagem_advances_updated', { detail: nextList }));
      window.dispatchEvent(new CustomEvent('agrocontrol_adiantamentos_updated', { detail: nextList }));
    }
  };

  const handleDelete = async (id: string) => {
    const adv = realAdvances.find(a => a.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Adiantamento / Vale',
      message: adv?.employeeName
        ? `Deseja realmente excluir o vale de "${adv.employeeName}" no valor de ${formatCurrencyBRL(adv.amount)}?`
        : 'Deseja realmente excluir este adiantamento?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      const nextList = realAdvances.filter(a => a.id !== id);
      saveStoredSalaryAdvances(nextList);
      onSaveAdvances(nextList);
      try {
        localStorage.setItem('agrocontrol_adiantamentos', JSON.stringify(nextList));
        localStorage.setItem('colaca_silagem_rh_adiantamentos', JSON.stringify(nextList));
      } catch (_) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('silagem_advances_updated', { detail: nextList }));
        window.dispatchEvent(new CustomEvent('agrocontrol_adiantamentos_updated', { detail: nextList }));
      }
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      
      {/* Top Header & Actions */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-black dark:text-white">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-blue-100/70 dark:bg-stone-800 border border-blue-200/80 dark:border-stone-700 text-black dark:text-white">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-black dark:text-white">
              Adiantamentos Salariais & Vales
            </h3>
            <p className="text-xs text-black/85 dark:text-stone-300 font-medium">
              Registro, parcelamento automático e abatimento auditado na folha mensal do colaborador
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Adiantamento / Vale</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Vales do Mês ({currentMonthRef})</span>
          <span className="text-base font-black text-black dark:text-white font-['Outfit']">
            {formatCurrencyBRL(totalValesMonth)}
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-amber-400 block uppercase">Pendentes de Desconto</span>
          <span className="text-base font-black text-black dark:text-amber-400 font-['Outfit']">
            {pendentesCount} vale(s)
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-emerald-400 block uppercase">Descontados na Folha</span>
          <span className="text-base font-black text-black dark:text-emerald-400 font-['Outfit']">
            {descontadosCount} vale(s)
          </span>
        </div>
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 shadow-xs text-black dark:text-white">
          <span className="text-[11px] font-black text-black dark:text-stone-300 block uppercase">Total Acumulado</span>
          <span className="text-base font-black text-black dark:text-white font-['Outfit']">
            {formatCurrencyBRL(totalGeralVales)}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl px-3 py-2 shadow-xs flex items-center justify-between text-black dark:text-white">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-black dark:text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por colaborador ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-blue-300 dark:border-stone-700 rounded-lg bg-blue-100/50 dark:bg-stone-800 text-black dark:text-white placeholder-black/60 dark:placeholder-stone-400 outline-none focus:ring-1 focus:ring-sky-600"
          />
        </div>
        <span className="text-xs text-black/85 dark:text-stone-300 font-bold hidden sm:block">
          {filtered.length} vale(s) registrado(s)
        </span>
      </div>

      {/* Table */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs text-black dark:text-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
              <tr>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Colaborador</th>
                <th className="py-2.5 px-3">Data do Vale</th>
                <th className="py-2.5 px-3">Competência</th>
                <th className="py-2.5 px-3">Forma Pagto.</th>
                <th className="py-2.5 px-3">Motivo / Descrição</th>
                <th className="py-2.5 px-3 text-center">Comprovante</th>
                <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-stone-800">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id, item.status)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition border ${
                          item.status === 'descontado'
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-900'
                            : 'bg-amber-100 border-amber-300 text-amber-900'
                        }`}
                      >
                        {item.status === 'descontado' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Descontado</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Pendente</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-2 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-black dark:text-white text-xs">
                          {item.employeeName}
                        </span>
                        {item.totalInstallments && item.totalInstallments > 1 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-[#0963cb] text-[10px] font-black border border-blue-300 shrink-0">
                            {item.installmentNumber || 1}/{item.totalInstallments}
                          </span>
                        )}
                      </div>
                      {item.responsibleUser && (
                        <div className="text-[10px] text-stone-600 dark:text-stone-400 font-medium flex items-center space-x-1 mt-0.5">
                          <ShieldCheck className="w-2.5 h-2.5 text-blue-700 dark:text-blue-400 shrink-0" />
                          <span className="truncate">Auditado por: {item.responsibleUser}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-medium text-xs whitespace-nowrap">
                      {formatDateBR(item.date)}
                    </td>

                    <td className="py-2 px-3 text-black dark:text-white font-bold text-xs">
                      {item.referenceMonth}
                    </td>

                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-mono text-[11px] uppercase">
                      {item.paymentMethod}
                    </td>

                    <td className="py-2 px-3 text-black/85 dark:text-stone-300 font-medium text-xs">
                      {item.reason || item.notes || 'Adiantamento quinzenal'}
                    </td>

                    {/* Comprovante */}
                    <td className="py-2 px-3 text-center">
                      {item.attachmentUrl ? (
                        <button
                          type="button"
                          onClick={() => setViewingReceipt({ url: item.attachmentUrl!, name: item.attachmentName })}
                          className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-blue-50 border border-blue-300 text-[#0963cb] rounded-lg text-[11px] font-bold shadow-2xs transition cursor-pointer"
                          title={`Ver comprovante: ${item.attachmentName || 'Anexo'}`}
                        >
                          <Paperclip className="w-3 h-3" />
                          <span className="hidden sm:inline">Ver</span>
                        </button>
                      ) : (
                        <span className="text-stone-500 text-[11px]">-</span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-right font-black text-rose-900 dark:text-rose-400 text-xs whitespace-nowrap font-['Outfit']">
                      {formatMoneyBRL(item.amount)}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1 text-black dark:text-sky-400 hover:bg-blue-200/60 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Editar Vale"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-black/70 dark:text-stone-400 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Excluir Vale"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-stone-500 dark:text-stone-400 text-xs font-semibold uppercase">
                    NENHUM REGISTRO ENCONTRADO
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lançar / Editar Vale Refatorado - Moldura Metálica 3D Acetinada */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden overflow-y-hidden">
          <div className="bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-2xl w-full max-w-2xl shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 transition-all flex flex-col max-h-[92vh]">
            
            {/* Header 3D Metálico Acetinado */}
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 rounded-t-2xl shrink-0">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100">
                  {editingAdvance ? 'EDITAR ADIANTAMENTO / VALE' : 'LANÇAR ADIANTAMENTO / VALE'}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                  {discountType === 'Parcelado' 
                    ? `Parcelamento em ${installmentsCount}x com provisionamento automático`
                    : 'Lançamento em cota única para folha de pagamento'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-4 sm:p-5 space-y-3.5 text-xs bg-white dark:bg-stone-900 max-h-[82vh] overflow-y-auto scrollbar-none flex-1">
              
              {/* Linha 1: Responsável pelo Lançamento e Colaborador / Funcionário lado a lado no novo espaço horizontal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Responsável pelo Lançamento (Auditoria RH) - Campo desbloqueado e dinâmico */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-black dark:text-stone-100 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0963cb]" />
                      <span>Responsável pelo Lançamento</span>
                    </label>
                    <span className="text-[10px] font-bold text-sky-800 bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 px-2 py-0.5 rounded-full border border-sky-300 dark:border-sky-800 flex items-center space-x-1">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      <span>Auditoria RH</span>
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={responsibleUser}
                      onChange={(e) => setResponsibleUser(e.target.value)}
                      className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-xs shadow-2xs cursor-pointer"
                      title="Selecione o responsável/auditor deste lançamento"
                    >
                      {responsibleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      {responsibleUser && !responsibleOptions.some(o => o.value.toUpperCase() === responsibleUser.toUpperCase()) && (
                        <option value={responsibleUser}>{responsibleUser}</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* 2. Colaborador */}
                <div>
                  <label className="block font-bold text-black dark:text-stone-100 mb-1">
                    Colaborador / Funcionário <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb] font-bold text-xs"
                    required
                  >
                    <option value="">Selecione um funcionário...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linha 2: Data & Valor do Vale com Máscara BRL em Tempo Real */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-black dark:text-stone-100 mb-1">
                    Data do Pagamento <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb] text-xs font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-black dark:text-stone-100 mb-1">
                    Valor do Vale (R$) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount > 0 ? formatMoneyBRL(amount) : ''}
                    onChange={handleAmountChange}
                    onFocus={(e) => e.target.select()}
                    placeholder="R$ 0,00"
                    className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 font-black outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                    required
                  />
                </div>
              </div>

              {/* Linha 3: Opção de Parcelamento do Adiantamento (Cota Única vs Parcelado) */}
              <div className="p-3.5 bg-white/95 dark:bg-stone-850 border border-stone-300 dark:border-stone-700 rounded-xl space-y-3 shadow-2xs">
                <div>
                  <label className="block font-bold text-black dark:text-stone-100 mb-1.5">
                    Tipo de Desconto <span className="text-rose-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDiscountType('Cota Única')}
                      className={`py-2 px-3 rounded-lg font-bold text-xs border transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                        discountType === 'Cota Única'
                          ? 'bg-[#0963cb] text-white border-[#0963cb] shadow-xs'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-750'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Cota Única (1x)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('Parcelado')}
                      className={`py-2 px-3 rounded-lg font-bold text-xs border transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                        discountType === 'Parcelado'
                          ? 'bg-[#0963cb] text-white border-[#0963cb] shadow-xs'
                          : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-750'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Parcelado (2x a 12x)</span>
                    </button>
                  </div>
                </div>

                {/* Campos Dinâmicos do Parcelamento: Qtd. Parcelas & Taxa de Juros */}
                {discountType === 'Parcelado' && (
                  <div className="pt-2.5 border-t border-stone-200 dark:border-stone-700 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block font-bold text-black dark:text-stone-100 mb-1">
                          Qtd. Parcelas <span className="text-rose-600">*</span>
                        </label>
                        <select
                          value={installmentsCount}
                          onChange={(e) => setInstallmentsCount(parseInt(e.target.value, 10) || 2)}
                          className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                        >
                          {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                            <option key={n} value={n}>
                              {n}x parcelas mensais
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-black dark:text-stone-100 mb-1">
                          Taxa de Juros Mensal (%) <span className="text-[10px] font-normal text-stone-500">(0 para sem juros)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={monthlyInterestRate === 0 ? '' : monthlyInterestRate}
                            placeholder="0 (Sem Juros)"
                            onChange={(e) => setMonthlyInterestRate(parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 font-medium outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card de Projeção Financeira e Competências Consecutivas */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-stone-800 border border-blue-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[#0963cb] dark:text-sky-400 flex items-center space-x-1">
                          <Info className="w-3.5 h-3.5" />
                          <span>Resumo do Parcelamento</span>
                        </span>
                        <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          {monthlyInterestRate > 0 ? (
                            <span className="text-amber-800 dark:text-amber-400">
                              Juros: +{formatMoneyBRL(activePlan.totalInterest)} ({monthlyInterestRate}% a.m.)
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400">Sem juros adicionais</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between text-xs pt-1 border-t border-blue-200/60 dark:border-stone-700">
                        <span className="text-stone-600 dark:text-stone-400 font-medium">
                          {installmentsCount} parcelas de:
                        </span>
                        <span className="text-sm font-black text-rose-800 dark:text-rose-400 font-['Outfit']">
                          {formatMoneyBRL(activePlan.installmentAmount)} / mês
                        </span>
                      </div>

                      {monthlyInterestRate > 0 && (
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-stone-600 dark:text-stone-400 font-medium">Total com juros:</span>
                          <span className="font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                            {formatMoneyBRL(activePlan.totalWithInterest)}
                          </span>
                        </div>
                      )}

                      {/* Visualização das Competências Consecutivas Provisionadas */}
                      <div className="pt-1.5 border-t border-blue-200/60 dark:border-stone-700">
                        <span className="text-[10px] font-bold text-stone-600 dark:text-stone-400 uppercase block mb-1">
                          Competências Provisionadas na Folha:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {activePlan.installments.map((inst) => (
                            <span
                              key={inst.number}
                              className="px-2.5 py-0.5 rounded bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 text-[10px] font-bold border border-blue-300 dark:border-stone-700 shadow-2xs"
                            >
                              {inst.referenceMonth} ({formatMoneyBRL(inst.amount)})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Linha 4: Forma Pagto & Mês de Desconto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-black dark:text-stone-100 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb] text-xs font-medium"
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência Bancária</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-black dark:text-stone-100 mb-1">
                    {discountType === 'Parcelado' ? 'Competência Inicial' : 'Competência de Desconto'} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={referenceMonth}
                    placeholder="MM/AAAA (ex: 09/2026)"
                    onChange={(e) => setReferenceMonth(e.target.value)}
                    className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 font-bold outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                    required
                  />
                </div>
              </div>

              {/* Linha 5: Motivo / Justificativa */}
              <div>
                <label className="block font-bold text-black dark:text-stone-100 mb-1">
                  Motivo / Justificativa
                </label>
                <input
                  type="text"
                  value={reason}
                  placeholder="Ex: Adiantamento emergencial, despesas médicas, compra de insumo..."
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2 border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb] text-xs"
                />
              </div>

              {/* Linha 6: Anexar Comprovante de Pagamento (Upload / Drag-and-Drop) */}
              <div>
                <label className="block font-bold text-black dark:text-stone-100 mb-1">
                  Anexar Comprovante de Pagamento <span className="text-[10px] font-normal text-stone-600 dark:text-stone-400">(PDF ou Imagem)</span>
                </label>
                
                {receiptName ? (
                  <div className="p-3 bg-white dark:bg-stone-850 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between shadow-2xs">
                    <div className="flex items-center space-x-2.5 overflow-hidden">
                      <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shrink-0">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-stone-900 dark:text-stone-100 text-xs truncate" title={receiptName}>
                          {receiptName}
                        </p>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block">
                          Comprovante anexado com sucesso
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      {receiptUrl && (
                        <button
                          type="button"
                          onClick={() => setViewingReceipt({ url: receiptUrl, name: receiptName })}
                          className="p-1.5 text-[#0963cb] hover:bg-blue-50 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
                          title="Visualizar Comprovante"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                        title="Remover Comprovante"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 transition text-center ${
                      isDragging
                        ? 'cursor-pointer border-[#0963cb] bg-blue-50/80 dark:bg-stone-800 scale-[0.99]'
                        : 'cursor-pointer border-stone-300 dark:border-stone-700 hover:border-[#0963cb] bg-white/90 dark:bg-stone-850 hover:bg-white dark:hover:bg-stone-800'
                    }`}
                  >
                    <Upload className="w-5 h-5 text-[#0963cb]" />
                    <div>
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                        Arraste ou clique para selecionar o comprovante
                      </span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">
                        Suporta imagens (PNG, JPG) e comprovantes em PDF (PIX / Transferência)
                      </span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Linha 7: Status */}
              <div>
                <label className="block font-bold text-black dark:text-stone-100 mb-1">
                  Situação do Desconto
                </label>
                <div className="flex items-center space-x-4 mt-1">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="advanceStatus"
                      checked={status === 'pendente'}
                      onChange={() => setStatus('pendente')}
                      className="text-[#0963cb] focus:ring-[#0963cb] accent-[#0963cb] cursor-pointer"
                    />
                    <span className="font-bold text-amber-900 dark:text-amber-400">Pendente de Desconto</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="advanceStatus"
                      checked={status === 'descontado'}
                      onChange={() => setStatus('descontado')}
                      className="text-[#0963cb] focus:ring-[#0963cb] accent-[#0963cb] cursor-pointer"
                    />
                    <span className="font-bold text-emerald-900 dark:text-emerald-400">Já Descontado na Folha</span>
                  </label>
                </div>
              </div>

              {/* Linha 8: Action Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-3.5 border-t border-black/15 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-bold hover:bg-stone-50 dark:hover:bg-stone-750 cursor-pointer transition text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedEmployeeId}
                  className="px-5 py-2 rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold transition shadow-xs cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {discountType === 'Parcelado' 
                    ? `Salvar e Provisionar ${installmentsCount}x` 
                    : 'Salvar Vale'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Modal de Prévia de Comprovante de Pagamento */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0963cb] text-white">
              <div className="flex items-center space-x-2 overflow-hidden">
                <Paperclip className="w-4 h-4 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold truncate">
                  {viewingReceipt.name || 'Comprovante de Pagamento'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="p-1 text-white hover:bg-white/20 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-stone-100">
              {viewingReceipt.url.startsWith('data:application/pdf') || viewingReceipt.name?.endsWith('.pdf') ? (
                <iframe
                  src={viewingReceipt.url}
                  title="Comprovante PDF"
                  className="w-full h-[65vh] rounded-lg border border-stone-300 bg-white"
                />
              ) : (
                <img
                  src={viewingReceipt.url}
                  alt="Comprovante"
                  className="max-h-[70vh] max-w-full object-contain rounded-lg border border-stone-300 shadow-sm"
                />
              )}
            </div>
            <div className="p-3 bg-white border-t border-stone-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="px-4 py-1.5 rounded-lg bg-[#0963cb] text-white font-bold text-xs hover:bg-[#0852a8] transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

