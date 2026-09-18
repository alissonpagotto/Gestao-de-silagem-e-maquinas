import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  Plus, 
  Calendar, 
  Camera,
  Search,
  Users,
  Tractor,
  Layers,
  Calculator,
  ChevronDown,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { Expense, ExpenseCategory, CostCenter, Machinery, ExpenseStatus, PaymentMethod, Employee, FleetTeam, Supplier, BankAccount } from '../../types';
import { ExpenseCategoriesModal } from './ExpenseCategoriesModal';
import { SupplierModal } from '../suppliers/SupplierModal';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense | Expense[]) => void;
  editingExpense?: Expense | null;
  categories: ExpenseCategory[];
  costCenters: CostCenter[];
  machineries: Machinery[];
  employees?: Employee[];
  teams?: FleetTeam[];
  suppliers?: Supplier[];
  bankAccounts?: BankAccount[];
  onOpenCategoryManager: () => void;
  onSaveCategories?: (categories: ExpenseCategory[]) => void;
  onSaveCostCenters?: (costCenters: CostCenter[]) => void;
  onSaveEmployees?: (employees: Employee[]) => void;
  onSaveTeams?: (teams: FleetTeam[]) => void;
  onSaveSuppliers?: (suppliers: Supplier[]) => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingExpense,
  categories,
  costCenters,
  machineries,
  employees = [],
  teams = [],
  suppliers = [],
  bankAccounts = [],
  onOpenCategoryManager,
  onSaveCategories,
  onSaveCostCenters,
  onSaveEmployees,
  onSaveTeams,
  onSaveSuppliers,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [paymentDate, setPaymentDate] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('pago');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [paidByEmployeeId, setPaidByEmployeeId] = useState<string>('');
  const [supplier, setSupplier] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const supplierContainerRef = useRef<HTMLDivElement>(null);
  const [costCenterId, setCostCenterId] = useState('');
  const [machineryId, setMachineryId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [mealType, setMealType] = useState<'cafe' | 'almoco' | 'janta'>('almoco');
  
  // Apportionment multi-targets (list of employee IDs, team IDs, or 'todos'/'grupo_operadores'/'grupo_motoristas')
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['todos']);
  const [targetToAdd, setTargetToAdd] = useState<string>('');

  // Sub-modal state for direct category & cost center management
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  // Quantity / Unit calculations
  const [hasQuantity, setHasQuantity] = useState(false);
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('litros');
  const [unitPrice, setUnitPrice] = useState<string>('');

  // Installments / Parcelas
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState<number>(2);

  // Receipt
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  const [receiptName, setReceiptName] = useState<string | undefined>(undefined);

  // Load existing data if editing
  useEffect(() => {
    if (editingExpense) {
      setDescription(editingExpense.description);
      setAmount(editingExpense.amount.toString());
      setCategoryId(editingExpense.categoryId);
      setDueDate(editingExpense.dueDate);
      setPaymentDate(editingExpense.paymentDate || '');
      setStatus(editingExpense.status);
      setPaymentMethod(editingExpense.paymentMethod);
      setBankAccountId(editingExpense.bankAccountId || '');
      setPaidByEmployeeId(editingExpense.paidByEmployeeId || '');
      setSupplier(editingExpense.supplier || '');
      setCostCenterId(editingExpense.costCenterId || '');
      setMachineryId(editingExpense.machineryId || '');
      setInvoiceNumber(editingExpense.invoiceNumber || '');
      setNotes(editingExpense.notes || '');
      setReceiptUrl(editingExpense.receiptUrl);
      setReceiptName(editingExpense.receiptName);
      
      if (editingExpense.quantity && editingExpense.quantity > 0) {
        setHasQuantity(true);
        setQuantity(editingExpense.quantity.toString());
        setUnit(editingExpense.unit || 'litros');
        setUnitPrice(editingExpense.unitPrice ? editingExpense.unitPrice.toString() : '');
      } else {
        setHasQuantity(false);
        setQuantity('');
        setUnitPrice('');
      }

      if (editingExpense.employeeApportionment) {
        const parts = editingExpense.employeeApportionment.split(',').map((s) => s.trim()).filter(Boolean);
        setSelectedTargets(parts.length > 0 ? parts : ['todos']);
      } else if (editingExpense.employeeId) {
        setSelectedTargets([editingExpense.employeeId]);
      } else if (editingExpense.teamId) {
        setSelectedTargets([editingExpense.teamId]);
      } else {
        setSelectedTargets(['todos']);
      }
      setIsInstallment(false);
    } else {
      // Defaults for new expense
      setDescription('');
      setAmount('');
      setCategoryId(categories[0]?.id || '');
      setDueDate(today);
      setPaymentDate(today);
      setStatus('pago');
      setPaymentMethod('pix');
      setBankAccountId(bankAccounts[0]?.id || '');
      setPaidByEmployeeId(employees[0]?.id || '');
      setSupplier('');
      setCostCenterId('');
      setMachineryId('');
      setInvoiceNumber('');
      setNotes('');
      setMealType('almoco');
      setSelectedTargets(['todos']);
      setTargetToAdd('');
      setHasQuantity(false);
      setQuantity('');
      setUnit('litros');
      setUnitPrice('');
      setIsInstallment(false);
      setInstallmentCount(2);
      setReceiptUrl(undefined);
      setReceiptName(undefined);
    }
  }, [editingExpense, isOpen, categories]);

  // Close supplier dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        supplierContainerRef.current &&
        !supplierContainerRef.current.contains(event.target as Node)
      ) {
        setIsSupplierDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredSuppliers = suppliers.filter((s) => {
    if (!supplier.trim()) return true;
    const q = supplier.toLowerCase().trim();
    const cleanQ = q.replace(/\D/g, '');
    return (
      s.name.toLowerCase().includes(q) ||
      (s.tradeName && s.tradeName.toLowerCase().includes(q)) ||
      (s.category && s.category.toLowerCase().includes(q)) ||
      (cleanQ.length > 0 && s.cnpjOrCpf && s.cnpjOrCpf.replace(/\D/g, '').includes(cleanQ))
    );
  });

  // Handle calculation when quantity or unit price changes
  const handleQuantityChange = (q: string, p: string) => {
    setQuantity(q);
    setUnitPrice(p);
    const numQ = parseFloat(q);
    const numP = parseFloat(p);
    if (!isNaN(numQ) && !isNaN(numP) && numQ > 0 && numP > 0) {
      setAmount((numQ * numP).toFixed(2));
    }
  };

  // Handle file attachment (converts to base64 for browser preview)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptUrl(undefined);
    setReceiptName(undefined);
  };

  const activeEmployees = employees.filter((e) => e.status !== 'inativo');
  const motoristasCount = activeEmployees.filter(
    (e) => e.role?.toLowerCase().includes('motorista') || e.role?.toLowerCase().includes('caminh')
  ).length;
  const operadoresCount = activeEmployees.filter(
    (e) =>
      e.role?.toLowerCase().includes('ensiladeira') ||
      e.role?.toLowerCase().includes('operador') ||
      e.role?.toLowerCase().includes('trator')
  ).length;

  const handleAddTarget = (idToAdd?: string) => {
    const target = idToAdd || targetToAdd;
    if (!target) return;

    if (target === 'todos') {
      setSelectedTargets(['todos']);
    } else {
      const withoutTodos = selectedTargets.filter((t) => t !== 'todos');
      if (!withoutTodos.includes(target)) {
        setSelectedTargets([...withoutTodos, target]);
      }
    }
    setTargetToAdd('');
  };

  const handleRemoveTarget = (idToRemove: string) => {
    const remaining = selectedTargets.filter((t) => t !== idToRemove);
    if (remaining.length === 0) {
      setSelectedTargets(['todos']);
    } else {
      setSelectedTargets(remaining);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isAlimentacao = selectedCategory?.name?.toLowerCase().includes('aliment') || 
                        selectedCategory?.name?.toLowerCase().includes('refeiç') || 
                        selectedCategory?.name?.toLowerCase().includes('restaurante');

  // Multi-target resolution: calculate unique participating employees and target teams
  const resolvedUniqueEmployees: Employee[] = [];
  const resolvedTargetTeams: FleetTeam[] = [];
  const uniqueEmpIdSet = new Set<string>();

  if (selectedTargets.includes('todos')) {
    activeEmployees.forEach((emp) => {
      if (!uniqueEmpIdSet.has(emp.id)) {
        uniqueEmpIdSet.add(emp.id);
        resolvedUniqueEmployees.push(emp);
      }
    });
  } else {
    selectedTargets.forEach((tId) => {
      if (tId === 'grupo_operadores') {
        activeEmployees
          .filter(
            (e) =>
              e.role?.toLowerCase().includes('ensiladeira') ||
              e.role?.toLowerCase().includes('operador') ||
              e.role?.toLowerCase().includes('trator')
          )
          .forEach((emp) => {
            if (!uniqueEmpIdSet.has(emp.id)) {
              uniqueEmpIdSet.add(emp.id);
              resolvedUniqueEmployees.push(emp);
            }
          });
      } else if (tId === 'grupo_motoristas') {
        activeEmployees
          .filter(
            (e) =>
              e.role?.toLowerCase().includes('motorista') ||
              e.role?.toLowerCase().includes('caminh')
          )
          .forEach((emp) => {
            if (!uniqueEmpIdSet.has(emp.id)) {
              uniqueEmpIdSet.add(emp.id);
              resolvedUniqueEmployees.push(emp);
            }
          });
      } else {
        const matchedTeam = teams.find((team) => team.id === tId);
        if (matchedTeam) {
          if (!resolvedTargetTeams.some((t) => t.id === matchedTeam.id)) {
            resolvedTargetTeams.push(matchedTeam);
          }
          activeEmployees
            .filter((e) => e.teamId === matchedTeam.id)
            .forEach((emp) => {
              if (!uniqueEmpIdSet.has(emp.id)) {
                uniqueEmpIdSet.add(emp.id);
                resolvedUniqueEmployees.push(emp);
              }
            });
        } else {
          const matchedEmp = activeEmployees.find((e) => e.id === tId);
          if (matchedEmp && !uniqueEmpIdSet.has(matchedEmp.id)) {
            uniqueEmpIdSet.add(matchedEmp.id);
            resolvedUniqueEmployees.push(matchedEmp);
          }
        }
      }
    });
  }

  // Linked machineries inferred automatically from resolved employees and teams
  const linkedMachineries: Machinery[] = [];
  const linkedMachIdSet = new Set<string>();

  resolvedUniqueEmployees.forEach((emp) => {
    const m = machineries.find(
      (mach) =>
        mach.assignedDriverIds?.includes(emp.id) ||
        mach.operatorOrDriver?.toLowerCase().includes(emp.name.toLowerCase())
    );
    if (m && !linkedMachIdSet.has(m.id)) {
      linkedMachIdSet.add(m.id);
      linkedMachineries.push(m);
    }
  });

  resolvedTargetTeams.forEach((t) => {
    if (t.machineryId) {
      const m = machineries.find((mach) => mach.id === t.machineryId);
      if (m && !linkedMachIdSet.has(m.id)) {
        linkedMachIdSet.add(m.id);
        linkedMachineries.push(m);
      }
    }
  });

  const totalParticipantsCount = resolvedUniqueEmployees.length > 0 ? resolvedUniqueEmployees.length : 1;
  const numAmount = parseFloat(amount) || 0;
  const rateioPerPerson = numAmount > 0 ? numAmount / totalParticipantsCount : 0;

  // Resolve display name for lists and reports
  let resolvedEmployeeName = '';
  if (selectedTargets.includes('todos')) {
    resolvedEmployeeName = `Todos os Funcionários (${activeEmployees.length} pessoas)`;
  } else if (selectedTargets.length === 1) {
    const single = selectedTargets[0];
    const emp = activeEmployees.find((e) => e.id === single);
    const team = teams.find((t) => t.id === single);
    if (emp) resolvedEmployeeName = emp.name;
    else if (team) resolvedEmployeeName = `Equipe ${team.name}`;
    else if (single === 'grupo_operadores') resolvedEmployeeName = 'Equipe de Campo / Operadores';
    else if (single === 'grupo_motoristas') resolvedEmployeeName = 'Motoristas de Caminhão';
  } else {
    const names = selectedTargets.map((tId) => {
      const emp = activeEmployees.find((e) => e.id === tId);
      if (emp) return emp.name;
      const team = teams.find((t) => t.id === tId);
      if (team) return `Equipe ${team.name}`;
      if (tId === 'grupo_operadores') return 'Operadores';
      if (tId === 'grupo_motoristas') return 'Motoristas';
      return tId;
    });
    resolvedEmployeeName = names.join(' + ');
  }

  const primaryTeam = resolvedTargetTeams[0] || (resolvedUniqueEmployees[0]?.teamId ? teams.find((t) => t.id === resolvedUniqueEmployees[0].teamId) : undefined);
  const resolvedTeamId = primaryTeam?.id;
  const resolvedTeamName = primaryTeam?.name ? `Equipe ${primaryTeam.name}` : undefined;
  const primaryMachinery = linkedMachineries[0] || (machineryId ? machineries.find((m) => m.id === machineryId) : undefined);
  const resolvedMachineryId = primaryMachinery?.id;
  const resolvedMachineryName = primaryMachinery
    ? (primaryMachinery.licensePlateOrSerial ? `${primaryMachinery.licensePlateOrSerial} - ${(primaryMachinery.model || primaryMachinery.name).toUpperCase()}` : (primaryMachinery.model || primaryMachinery.name).toUpperCase())
    : undefined;
  const defaultCostCenter = costCenterId ? costCenters.find((cc) => cc.id === costCenterId) : costCenters[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Por favor, informe um valor válido para a despesa.');
      return;
    }

    const effectiveDesc = description.trim() || 
      (isAlimentacao ? `Refeição (${mealType === 'cafe' ? 'Café da Manhã' : mealType === 'almoco' ? 'Almoço' : 'Janta'})` : selectedCategory?.name || 'Despesa Operacional');

    const selectedCat = categories.find((c) => c.id === categoryId) || categories[0];

    const singleEmp = selectedTargets.length === 1 && activeEmployees.some((e) => e.id === selectedTargets[0])
      ? activeEmployees.find((e) => e.id === selectedTargets[0])
      : undefined;

    const selectedBankAccountObj = bankAccounts.find((b) => b.id === bankAccountId);
    const selectedPaidByEmpObj = employees.find((e) => e.id === paidByEmployeeId);

    if (isInstallment && installmentCount > 1 && !editingExpense) {
      const installmentAmount = +(numAmount / installmentCount).toFixed(2);
      const installments: Expense[] = [];
      const baseDueDate = new Date(dueDate + 'T12:00:00');

      for (let i = 0; i < installmentCount; i++) {
        const itemDueDate = new Date(baseDueDate);
        itemDueDate.setMonth(baseDueDate.getMonth() + i);
        const dateStr = itemDueDate.toISOString().split('T')[0];

        installments.push({
          id: `exp_${Date.now()}_${i + 1}`,
          description: `${effectiveDesc} (${i + 1}/${installmentCount})`,
          amount: installmentAmount,
          categoryId: selectedCat?.id || 'geral',
          categoryName: selectedCat?.name || 'Geral',
          categoryColor: selectedCat?.color || '#10b981',
          dueDate: dateStr,
          paymentDate: i === 0 && status === 'pago' ? (paymentDate || dateStr) : undefined,
          status: i === 0 ? status : 'pendente',
          paymentMethod,
          bankAccountId: i === 0 && status === 'pago' ? selectedBankAccountObj?.id : undefined,
          bankAccountName: i === 0 && status === 'pago' ? selectedBankAccountObj?.name : undefined,
          paidByEmployeeId: i === 0 && status === 'pago' ? selectedPaidByEmpObj?.id : undefined,
          paidByEmployeeName: i === 0 && status === 'pago' ? selectedPaidByEmpObj?.name : undefined,
          supplier: supplier.trim(),
          costCenterId: defaultCostCenter?.id || undefined,
          costCenterName: defaultCostCenter?.name || undefined,
          machineryId: resolvedMachineryId,
          machineryName: resolvedMachineryName,
          employeeId: singleEmp ? singleEmp.id : undefined,
          employeeName: resolvedEmployeeName,
          teamId: resolvedTeamId,
          teamName: resolvedTeamName,
          employeeApportionment: selectedTargets.join(','),
          invoiceNumber: invoiceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          quantity: hasQuantity && quantity ? parseFloat(quantity) / installmentCount : undefined,
          unit: hasQuantity ? unit : undefined,
          unitPrice: hasQuantity && unitPrice ? parseFloat(unitPrice) : undefined,
          receiptUrl: i === 0 ? receiptUrl : undefined,
          receiptName: i === 0 ? receiptName : undefined,
          createdAt: new Date().toISOString(),
        });
      }
      onSave(installments);
    } else {
      const expenseData: Expense = {
        id: editingExpense ? editingExpense.id : `exp_${Date.now()}`,
        description: effectiveDesc,
        amount: numAmount,
        categoryId: selectedCat?.id || 'geral',
        categoryName: selectedCat?.name || 'Geral',
        categoryColor: selectedCat?.color || '#10b981',
        dueDate,
        paymentDate: status === 'pago' ? (paymentDate || dueDate) : undefined,
        status,
        paymentMethod,
        bankAccountId: status === 'pago' ? selectedBankAccountObj?.id : undefined,
        bankAccountName: status === 'pago' ? selectedBankAccountObj?.name : undefined,
        paidByEmployeeId: status === 'pago' ? selectedPaidByEmpObj?.id : undefined,
        paidByEmployeeName: status === 'pago' ? selectedPaidByEmpObj?.name : undefined,
        supplier: supplier.trim(),
        costCenterId: defaultCostCenter?.id || undefined,
        costCenterName: defaultCostCenter?.name || undefined,
        machineryId: resolvedMachineryId,
        machineryName: resolvedMachineryName,
        employeeId: singleEmp ? singleEmp.id : undefined,
        employeeName: resolvedEmployeeName,
        teamId: resolvedTeamId,
        teamName: resolvedTeamName,
        employeeApportionment: selectedTargets.join(','),
        invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        quantity: hasQuantity && quantity ? parseFloat(quantity) : undefined,
        unit: hasQuantity ? unit : undefined,
        unitPrice: hasQuantity && unitPrice ? parseFloat(unitPrice) : undefined,
        receiptUrl,
        receiptName,
        createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
      };
      onSave(expenseData);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white border border-zinc-300 rounded-2xl max-w-2xl w-full my-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Charcoal bg-zinc-800 with White Text */}
        <div className="px-5 py-3.5 bg-zinc-800 text-white flex items-center justify-between border-b border-zinc-700">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
            {editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto bg-white">
          
          {/* Row 1: Categoria & Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider">
                  CATEGORIA <span className="text-rose-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="inline-flex items-center space-x-1 text-[10px] font-bold text-zinc-700 dark:text-stone-300 hover:text-black dark:hover:text-white px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-zinc-50 transition cursor-pointer border border-zinc-200 dark:border-stone-700"
                  title="Incluir, editar ou excluir categorias de despesas"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                  <span>Editar / Incluir</span>
                </button>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="relative flex-1">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/20 appearance-none pr-9"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="w-9 h-9 shrink-0 rounded-xl bg-zinc-900 dark:bg-stone-700 hover:bg-zinc-800 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                  title="Incluir nova categoria ou gerenciar existentes"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                DATA <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Tipo de Refeição (ou Descrição) & Valor Total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isAlimentacao ? (
              <div>
                <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                  TIPO DE REFEIÇÃO
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMealType('cafe')}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                      mealType === 'cafe'
                        ? 'bg-zinc-900 dark:bg-stone-700 text-white border-zinc-900 dark:border-stone-700 font-bold shadow-xs'
                        : 'bg-white dark:bg-stone-800 border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-50'
                    }`}
                  >
                    Café da Manhã
                  </button>
                  <button
                    type="button"
                    onClick={() => setMealType('almoco')}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                      mealType === 'almoco'
                        ? 'bg-zinc-900 dark:bg-stone-700 text-white border-zinc-900 dark:border-stone-700 font-bold shadow-xs'
                        : 'bg-white dark:bg-stone-800 border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-50'
                    }`}
                  >
                    Almoço
                  </button>
                  <button
                    type="button"
                    onClick={() => setMealType('janta')}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                      mealType === 'janta'
                        ? 'bg-zinc-900 dark:bg-stone-700 text-white border-zinc-900 dark:border-stone-700 font-bold shadow-xs'
                        : 'bg-white dark:bg-stone-800 border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-50'
                    }`}
                  >
                    Janta
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                  DESCRIÇÃO DA DESPESA
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                VALOR TOTAL (R$) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              />
            </div>
          </div>

          {/* Rateio por Funcionários e Equipes (Seleção Múltipla) - Fundo Branco */}
          <div className="border border-stone-300 rounded-xl p-3.5 bg-white shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-black uppercase tracking-wider">
                FUNCIONÁRIOS E EQUIPES NO RATEIO ({totalParticipantsCount} {totalParticipantsCount === 1 ? 'PESSOA' : 'PESSOAS'})
              </label>
              <div className="flex items-center space-x-2 text-[10px]">
                {!selectedTargets.includes('todos') && (
                  <button
                    type="button"
                    onClick={() => setSelectedTargets(['todos'])}
                    className="text-zinc-900 dark:text-stone-100 font-bold hover:underline cursor-pointer"
                  >
                    + Todos da Empresa
                  </button>
                )}
                {selectedTargets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTargets(['todos'])}
                    className="text-stone-500 hover:text-stone-700 font-medium cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Input / Dropdown de Adição com botão + Adicionar */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <select
                  value={targetToAdd}
                  onChange={(e) => {
                    setTargetToAdd(e.target.value);
                    if (e.target.value) {
                      handleAddTarget(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688] appearance-none pr-8 cursor-pointer"
                >
                  <option value="">+ Selecione para Adicionar ao Rateio...</option>
                  
                  <optgroup label="RATEIO COLETIVO & GRUPOS">
                    <option value="todos">
                      Todos os Funcionários ({activeEmployees.length} pessoas na empresa)
                    </option>
                    {operadoresCount > 0 && (
                      <option value="grupo_operadores">
                        Equipe de Campo / Operadores ({operadoresCount} pessoas)
                      </option>
                    )}
                    {motoristasCount > 0 && (
                      <option value="grupo_motoristas">
                        Motoristas de Caminhão ({motoristasCount} pessoas)
                      </option>
                    )}
                  </optgroup>

                  {teams.length > 0 && (
                    <optgroup label="EQUIPES DA FROTA">
                      {teams.map((team) => {
                        const teamMembers = activeEmployees.filter((e) => e.teamId === team.id);
                        return (
                          <option key={team.id} value={team.id}>
                            Equipe {team.name} ({teamMembers.length} pessoas){team.machineryName ? ` · ${team.machineryName}` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}

                  {activeEmployees.length > 0 && (
                    <optgroup label={`FUNCIONÁRIOS CADASTRADOS (${activeEmployees.length})`}>
                      {activeEmployees.map((emp) => {
                        const empTeam = teams.find((t) => t.id === emp.teamId);
                        const empMach = machineries.find(
                          (m) =>
                            m.assignedDriverIds?.includes(emp.id) ||
                            m.operatorOrDriver?.toLowerCase().includes(emp.name.toLowerCase())
                        );
                        return (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.role || 'Funcionário'}{empTeam ? ` · Equipe ${empTeam.name}` : ''}{empMach ? ` · ${empMach.licensePlateOrSerial || empMach.name}` : ''})
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              
              <button
                type="button"
                onClick={() => handleAddTarget()}
                className="h-9 px-3.5 shrink-0 rounded-lg bg-[#156f33] hover:bg-[#0e5224] text-white flex items-center space-x-1.5 transition cursor-pointer shadow-2xs text-xs font-bold"
                title="Adicionar mais equipe ou funcionário ao rateio"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar</span>
              </button>
            </div>

            {/* Chips de Funcionários / Equipes Selecionados */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedTargets.map((targetId) => {
                if (targetId === 'todos') {
                  return (
                    <div
                      key="todos"
                      className="inline-flex items-center space-x-1.5 bg-blue-100/90 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Todos os Funcionários ({activeEmployees.length} pessoas)</span>
                    </div>
                  );
                }

                if (targetId === 'grupo_operadores') {
                  return (
                    <div
                      key="grupo_operadores"
                      className="inline-flex items-center space-x-1.5 bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    >
                      <Tractor className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Operadores & Tratoristas ({operadoresCount})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTarget('grupo_operadores')}
                        className="w-4 h-4 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900 flex items-center justify-center text-emerald-900 dark:text-emerald-300 cursor-pointer ml-1"
                        title="Remover do rateio"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                if (targetId === 'grupo_motoristas') {
                  return (
                    <div
                      key="grupo_motoristas"
                      className="inline-flex items-center space-x-1.5 bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    >
                      <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Motoristas de Caminhão ({motoristasCount})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTarget('grupo_motoristas')}
                        className="w-4 h-4 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900 flex items-center justify-center text-emerald-900 dark:text-emerald-300 cursor-pointer ml-1"
                        title="Remover do rateio"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                const teamMatch = teams.find((t) => t.id === targetId);
                if (teamMatch) {
                  const teamMembers = activeEmployees.filter((e) => e.teamId === teamMatch.id);
                  return (
                    <div
                      key={teamMatch.id}
                      className="inline-flex items-center space-x-1.5 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    >
                      <Users className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                      <span>Equipe {teamMatch.name} ({teamMembers.length} func.)</span>
                      {teamMatch.machineryName && (
                        <span className="text-[10px] opacity-75 font-normal">· {teamMatch.machineryName}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveTarget(teamMatch.id)}
                        className="w-4 h-4 rounded hover:bg-amber-200 dark:hover:bg-amber-900 flex items-center justify-center text-amber-900 dark:text-amber-300 cursor-pointer ml-1"
                        title="Remover equipe do rateio"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                const empMatch = activeEmployees.find((e) => e.id === targetId);
                if (empMatch) {
                  const empTeam = teams.find((t) => t.id === empMatch.teamId);
                  return (
                    <div
                      key={empMatch.id}
                      className="inline-flex items-center space-x-1.5 bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    >
                      <div className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">
                        {empMatch.name.charAt(0)}
                      </div>
                      <span>{empMatch.name}</span>
                      <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-normal">
                        ({empMatch.role}{empTeam ? ` · Equipe ${empTeam.name}` : ''})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTarget(empMatch.id)}
                        className="w-4 h-4 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900 flex items-center justify-center text-emerald-900 dark:text-emerald-300 cursor-pointer ml-1"
                        title="Remover funcionário do rateio"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                return null;
              })}
            </div>

            {/* Informative Rateio / Auto-Linking Feedback Box */}
            <div className="p-2.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white/90 dark:bg-stone-900/60 text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-stone-800 dark:text-stone-200">
                <div className="flex items-center space-x-1.5">
                  <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Rateio: {totalParticipantsCount} {totalParticipantsCount === 1 ? 'pessoa' : 'pessoas'} no total</span>
                </div>
                {numAmount > 0 && (
                  <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                    R$ {rateioPerPerson.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / pessoa
                  </span>
                )}
              </div>

              {/* Informações vinculadas automaticamente */}
              <div className="text-[11px] text-stone-600 dark:text-stone-400 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t border-stone-100 dark:border-stone-800">
                {linkedMachineries.length > 0 && (
                  <span className="flex items-center space-x-1 text-emerald-800 dark:text-emerald-400 font-medium">
                    <Tractor className="w-3 h-3 shrink-0" />
                    <span>Máquina(s): {linkedMachineries.map((m) => m.licensePlateOrSerial ? `${m.licensePlateOrSerial} (${(m.model || m.name || '').toUpperCase()})` : (m.model || m.name || '').toUpperCase()).join(', ')}</span>
                  </span>
                )}
                {resolvedTargetTeams.length > 0 && (
                  <span className="flex items-center space-x-1 text-amber-800 dark:text-amber-400 font-medium">
                    <Users className="w-3 h-3 shrink-0" />
                    <span>Equipe(s): {resolvedTargetTeams.map((t) => t.name).join(', ')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Fornecedor */}
          <div ref={supplierContainerRef} className="relative">
            <label className="block text-[11px] font-bold text-black uppercase tracking-wider mb-1">
              FORNECEDOR
            </label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => {
                    setSupplier(e.target.value);
                    setIsSupplierDropdownOpen(true);
                  }}
                  onFocus={() => setIsSupplierDropdownOpen(true)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSupplierModalOpen(true);
                  setIsSupplierDropdownOpen(false);
                }}
                className="w-9 h-9 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-zinc-50 dark:hover:bg-stone-700 text-zinc-700 dark:text-stone-300 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Cadastrar Novo Fornecedor"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Dropdown Lista de Fornecedores */}
            {isSupplierDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                {filteredSuppliers.length > 0 ? (
                  <div className="divide-y divide-zinc-100 dark:divide-stone-700">
                    {filteredSuppliers.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSupplier(s.name);
                          setIsSupplierDropdownOpen(false);
                        }}
                        className="p-3 hover:bg-zinc-50 dark:hover:bg-stone-700/60 cursor-pointer transition flex flex-col justify-center text-left group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-zinc-900 dark:text-stone-100 text-xs sm:text-sm group-hover:text-black dark:group-hover:text-white">
                            {s.name}
                          </span>
                          {s.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-stone-700 text-zinc-600 dark:text-stone-300 font-medium shrink-0">
                              {s.category}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                          {s.cnpjOrCpf && <span>{s.cnpjOrCpf}</span>}
                          {s.tradeName && s.tradeName !== s.name && (
                            <span>· {s.tradeName}</span>
                          )}
                          {s.city && (
                            <span>· {s.city}{s.state ? `/${s.state}` : ''}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-xs text-zinc-500 dark:text-stone-400 text-center">
                    Nenhum fornecedor cadastrado com esse termo.
                  </div>
                )}

                {/* Opção de Cadastrar Novo Fornecedor */}
                <div className="border-t border-zinc-200 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSupplierModalOpen(true);
                      setIsSupplierDropdownOpen(false);
                    }}
                    className="w-full p-2.5 sm:p-3 flex items-center space-x-2 text-zinc-800 dark:text-stone-200 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-stone-700 text-xs sm:text-sm font-semibold transition cursor-pointer text-left"
                  >
                    <Plus className="w-4 h-4 text-zinc-800 dark:text-stone-200" />
                    <span>+ Cadastrar novo fornecedor</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Status e Forma de Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                STATUS DO PAGAMENTO
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 appearance-none pr-9"
                >
                  <option value="pago">Pago (Liquidado)</option>
                  <option value="pendente">A Pagar (Pendente)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                FORMA DE PAGAMENTO
              </label>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/20 appearance-none pr-9"
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro em Espécie</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="transferencia">Transferência Bancária (TED/DOC)</option>
                  <option value="cheque">Cheque</option>
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Se o status for Pago: Identificar Responsável e Conta de Débito */}
          {status === 'pago' && (
            <div className="p-3.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-200 dark:border-stone-700 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-zinc-800 dark:text-stone-200 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-zinc-800 dark:text-stone-200" />
                <span>Dados da Baixa / Liquidação do Pagamento</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Quem realizou o pagamento */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                    Quem Realizou o Pagamento (Responsável) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={paidByEmployeeId}
                      onChange={(e) => setPaidByEmployeeId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 appearance-none pr-8"
                    >
                      <option value="">-- Selecione o colaborador responsável --</option>
                      {activeEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} {emp.role ? `(${emp.role})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* De qual banco debitar */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                    Conta Bancária de Débito (Origem) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-900/20 appearance-none pr-8"
                    >
                      <option value="">-- Selecione o Banco / Conta --</option>
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} · {acc.bankName} (Saldo: R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
                  Data Efetiva da Baixa
                </label>
                <input
                  type="date"
                  value={paymentDate || dueDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full sm:w-1/2 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                />
              </div>
            </div>
          )}

          {/* Foto / Comprovante Upload Box */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
              FOTO / COMPROVANTE
            </label>
            <label className="cursor-pointer border-2 border-dashed border-zinc-300 dark:border-stone-700 hover:border-zinc-500 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-center gap-2 text-zinc-600 dark:text-stone-400 hover:text-black dark:hover:text-white transition bg-white dark:bg-stone-800 shadow-xs">
              <Camera className="w-4 h-4 text-stone-500" />
              <span className="text-xs font-medium">
                {receiptName ? `Anexado: ${receiptName}` : 'Tirar foto ou selecionar imagem'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-900 dark:text-stone-100 uppercase tracking-wider mb-1">
              OBSERVAÇÕES
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
            />
          </div>

          {/* Action Buttons - Standardized Footer */}
          <div className="pt-3 border-t border-zinc-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white border border-zinc-300 text-zinc-700 text-xs sm:text-sm font-semibold hover:bg-zinc-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
            >
              {editingExpense ? 'Atualizar Despesa' : 'Salvar Despesa'}
            </button>
          </div>

        </form>

      </div>
    </div>

    {/* Integrated Sub-Modal to Add, Edit, Delete Categories & Cost Centers */}
    {isCategoryModalOpen && (
      <ExpenseCategoriesModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onSaveCategories={(newCats) => {
          if (onSaveCategories) {
            onSaveCategories(newCats);
          }
        }}
        costCenters={costCenters}
        onSaveCostCenters={(newCCs) => {
          if (onSaveCostCenters) {
            onSaveCostCenters(newCCs);
          }
        }}
        onSelectCategory={(newCatId) => {
          setCategoryId(newCatId);
        }}
      />
    )}

    {/* Integrated Supplier Modal */}
    {isSupplierModalOpen && (
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        initialName={supplier}
        onSave={(newSup) => {
          const updated = [...suppliers, newSup];
          if (onSaveSuppliers) {
            onSaveSuppliers(updated);
          }
          setSupplier(newSup.name);
          setIsSupplierModalOpen(false);
        }}
      />
    )}
  </>
  );
};
