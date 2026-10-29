import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Receipt,
  Wrench,
} from 'lucide-react';
import { Expense, ExpenseCategory, CostCenter, Machinery, ExpenseStatus, PaymentMethod, Employee, FleetTeam, Supplier, BankAccount, MaintenanceLog } from '../../types';
import { INITIAL_CATEGORIES } from '../../lib/initialData';
import { getStoredMaintenanceLogs, saveStoredMaintenanceLogs, getStoredMachineries, saveStoredMachineries } from '../../lib/storage';
import { ExpenseCategoriesModal } from './ExpenseCategoriesModal';
import { SupplierModal } from '../suppliers/SupplierModal';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense | Expense[]) => void;
  onOpenFuelModal?: () => void;
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
  onOpenFuelModal,
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

  const safeCategories: ExpenseCategory[] = useMemo(() => {
    let list: ExpenseCategory[] = INITIAL_CATEGORIES;
    if (Array.isArray(categories) && categories.length > 0) {
      list = categories;
    } else if (categories && typeof categories === 'object' && Array.isArray((categories as any).categorias) && (categories as any).categorias.length > 0) {
      list = (categories as any).categorias.map((c: any) => ({
        id: c.id || c.codigo || 'cat_geral',
        name: c.nome || c.name || 'Geral',
        color: c.cor || c.color || '#0284c7',
        icon: c.icon || 'Tag',
        description: c.descricao || c.description,
      }));
    }

    const officialMap = new Map<string, ExpenseCategory>(
      INITIAL_CATEGORIES.map((c) => [(c.name || '').trim().toUpperCase(), c])
    );

    list.forEach((c) => {
      const n = (c.name || '').trim().toUpperCase();
      if (!n) return;
      if (n.includes('COMBUST')) return;
      if (n === 'ADMINISTRATIVO & COMERCIAL') return;
      if (n === 'ALIMENTAÇÃO & CAMPO') return;
      if (n === 'ARRENDAMENTO & TERRA') return;
      if (n === 'FRETE & LOGÍSTICA') return;
      if (n === 'LONA, FITA & EMBALAGENS') return;
      if (n === 'MANUTENÇÃO & PEÇAS') return;
      if (n === 'MÃO DE OBRA & DIÁRIAS') return;

      if (!officialMap.has(n)) {
        officialMap.set(n, { ...c, name: n });
      }
    });

    return Array.from(officialMap.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
    );
  }, [categories]);

  const handleSelectCategory = (newCatId: string) => {
    const selectedCat = safeCategories.find((c) => c.id === newCatId);
    const catName = (selectedCat?.name || '').toUpperCase();
    const isFuel = newCatId === 'cat_combustivel' || catName.includes('COMBUSTÍVEL') || catName.includes('COMBUSTIVEL') || catName.includes('DIESEL');
    if (isFuel) {
      onClose();
      if (onOpenFuelModal) {
        onOpenFuelModal();
      }
      return;
    }
    setCategoryId(newCatId);
  };

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
  const [readingKmOrHours, setReadingKmOrHours] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [mealType, setMealType] = useState<'cafe' | 'almoco' | 'janta'>('almoco');
  
  // Apportionment multi-targets (list of employee IDs, team IDs, or 'todos'/'grupo_operadores'/'grupo_motoristas')
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['todos']);
  const [targetToAdd, setTargetToAdd] = useState<string>('');

  const selectedCategoryObj = safeCategories.find((c) => c.id === categoryId);
  const selectedCategoryName = (selectedCategoryObj?.name || '').toUpperCase().trim();
  const isFleetMaintenanceCategory = useMemo(() => {
    return (
      selectedCategoryName === 'MANUTENÇÃO' ||
      selectedCategoryName === 'MANUTENCAO' ||
      selectedCategoryName.includes('MANUTENÇÃO') ||
      selectedCategoryName.includes('MANUTENCAO') ||
      selectedCategoryName === 'BORRACHARIA' ||
      selectedCategoryName === 'ELÉTRICA' ||
      selectedCategoryName === 'ELETRICA' ||
      selectedCategoryName === 'PEÇAS' ||
      selectedCategoryName === 'PECAS'
    );
  }, [selectedCategoryName]);

  const availableMachineries = useMemo(() => {
    if (Array.isArray(machineries) && machineries.length > 0) return machineries;
    try {
      const raw = localStorage.getItem('agrocontrol_frotas') || localStorage.getItem('agrocontrol_frotas_veiculos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return getStoredMachineries();
  }, [machineries]);

  const selectedMachinery = useMemo(() => {
    return availableMachineries.find((m) => m.id === machineryId);
  }, [availableMachineries, machineryId]);

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
      if (editingExpense.quantity) {
        setReadingKmOrHours(String(editingExpense.quantity));
      } else {
        setReadingKmOrHours('');
      }
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
      setCategoryId(safeCategories[0]?.id || '');
      setDueDate(today);
      setPaymentDate(today);
      setStatus('pago');
      setPaymentMethod('pix');
      setBankAccountId(bankAccounts[0]?.id || '');
      setPaidByEmployeeId(employees[0]?.id || '');
      setSupplier('');
      setCostCenterId('');
      setMachineryId('');
      setReadingKmOrHours('');
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
  }, [editingExpense, isOpen, safeCategories]);

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
    if (!supplier || !supplier.trim()) return true;
    const q = (supplier || '').toLowerCase().trim();
    const cleanQ = q.replace(/\D/g, '');
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
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

  const selectedCategory = safeCategories.find((c) => c.id === categoryId);
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
    const empName = (emp?.name || '').toLowerCase();
    const m = machineries.find(
      (mach) =>
        mach.assignedDriverIds?.includes(emp.id) ||
        (empName && mach.operatorOrDriver?.toLowerCase().includes(empName))
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
  const primaryMachinery = isFleetMaintenanceCategory
    ? (machineryId ? availableMachineries.find((m) => m.id === machineryId) : undefined)
    : (linkedMachineries[0] || (machineryId ? availableMachineries.find((m) => m.id === machineryId) : undefined));
  const resolvedMachineryId = primaryMachinery?.id || (isFleetMaintenanceCategory ? machineryId : undefined);
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

    if (isFleetMaintenanceCategory && !machineryId) {
      alert('POR FAVOR, SELECIONE O VEÍCULO / MÁQUINA DA FROTA PARA O VÍNCULO DE MANUTENÇÃO.');
      return;
    }

    const effectiveDesc = description.trim() || 
      (isAlimentacao ? `Refeição (${mealType === 'cafe' ? 'Café da Manhã' : mealType === 'almoco' ? 'Almoço' : 'Janta'})` : selectedCategory?.name || 'Despesa Operacional');

    const selectedCat = safeCategories.find((c) => c.id === categoryId) || safeCategories[0];

    const singleEmp = selectedTargets.length === 1 && activeEmployees.some((e) => e.id === selectedTargets[0])
      ? activeEmployees.find((e) => e.id === selectedTargets[0])
      : undefined;

    const selectedBankAccountObj = bankAccounts.find((b) => b.id === bankAccountId);
    const selectedPaidByEmpObj = employees.find((e) => e.id === paidByEmployeeId);

    if (isInstallment && installmentCount > 1 && !editingExpense) {
      const installmentAmount = +(numAmount / installmentCount).toFixed(2);
      const installments: Expense[] = [];
      const [bYear, bMonth, bDay] = dueDate.split('-').map(Number);

      for (let i = 0; i < installmentCount; i++) {
        const totalMonths = (bMonth - 1) + i;
        const targetYear = bYear + Math.floor(totalMonths / 12);
        const targetMonth = ((totalMonths % 12) + 12) % 12;
        const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
        const targetDay = Math.min(bDay || 1, maxDays);
        const yyyy = targetYear;
        const mm = String(targetMonth + 1).padStart(2, '0');
        const dd = String(targetDay).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

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
          employeeId: !isFleetMaintenanceCategory && singleEmp ? singleEmp.id : undefined,
          employeeName: !isFleetMaintenanceCategory ? resolvedEmployeeName : undefined,
          teamId: !isFleetMaintenanceCategory ? resolvedTeamId : undefined,
          teamName: !isFleetMaintenanceCategory ? resolvedTeamName : undefined,
          employeeApportionment: !isFleetMaintenanceCategory ? selectedTargets.join(',') : undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          quantity: isFleetMaintenanceCategory && readingKmOrHours ? parseFloat(readingKmOrHours) : (hasQuantity && quantity ? parseFloat(quantity) / installmentCount : undefined),
          unit: isFleetMaintenanceCategory ? (primaryMachinery?.controlBy === 'km' ? 'km' : 'horas') : (hasQuantity ? unit : undefined),
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
        employeeId: !isFleetMaintenanceCategory && singleEmp ? singleEmp.id : undefined,
        employeeName: !isFleetMaintenanceCategory ? resolvedEmployeeName : undefined,
        teamId: !isFleetMaintenanceCategory ? resolvedTeamId : undefined,
        teamName: !isFleetMaintenanceCategory ? resolvedTeamName : undefined,
        employeeApportionment: !isFleetMaintenanceCategory ? selectedTargets.join(',') : undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        quantity: isFleetMaintenanceCategory && readingKmOrHours ? parseFloat(readingKmOrHours) : (hasQuantity && quantity ? parseFloat(quantity) : undefined),
        unit: isFleetMaintenanceCategory ? (primaryMachinery?.controlBy === 'km' ? 'km' : 'horas') : (hasQuantity ? unit : undefined),
        unitPrice: hasQuantity && unitPrice ? parseFloat(unitPrice) : undefined,
        receiptUrl,
        receiptName,
        createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
      };
      onSave(expenseData);
    }

    // Vínculo compulsório ao histórico de manutenção da frota pesada
    if (isFleetMaintenanceCategory && (resolvedMachineryId || machineryId) && primaryMachinery) {
      try {
        const storedLogs = getStoredMaintenanceLogs();
        const readingNum = readingKmOrHours ? parseFloat(readingKmOrHours) : undefined;
        const serviceCategory = selectedCategoryName.includes('BORRACH') 
          ? 'Pneus, Rodas & Esteiras' 
          : selectedCategoryName.includes('ELÉTR') 
            ? 'Elétrica & Ar-Condicionado' 
            : selectedCategoryName.includes('PEÇAS') 
              ? 'Peças de Reposição' 
              : 'Outro';

        const targetMachId = resolvedMachineryId || machineryId;
        const newLog: MaintenanceLog = {
          id: `maint_exp_${Date.now()}`,
          machineryId: targetMachId,
          machineryPlateOrName: primaryMachinery.licensePlateOrSerial || primaryMachinery.name,
          date: dueDate,
          type: 'corretiva',
          serviceCategory,
          description: effectiveDesc,
          workshopOrMechanic: supplier || 'OFICINA / FORNECEDOR',
          partsCost: selectedCategoryName.includes('PEÇAS') ? numAmount : 0,
          laborCost: !selectedCategoryName.includes('PEÇAS') ? numAmount : 0,
          totalCost: numAmount,
          currentHourMeterOrKm: readingNum || 0,
          status: status === 'pago' ? 'concluida' : 'em_andamento',
          hourMeterOrKmAtService: readingNum,
          notes: notes.trim() || `LANÇAMENTO FINANCEIRO NA CATEGORIA ${selectedCategoryName}`,
          createdAt: new Date().toISOString(),
        };

        const updatedLogs = [newLog, ...storedLogs];
        saveStoredMaintenanceLogs(updatedLogs);

        // Atualiza horímetro/odômetro da máquina se a leitura informada for superior à atual
        if (readingNum && readingNum > 0) {
          const currentMachineries = getStoredMachineries();
          const updatedMachineries = currentMachineries.map((m) => {
            if (m.id === targetMachId) {
              const prevHour = m.hourMeter || 0;
              const prevKm = m.currentKm || 0;
              const newHour = m.controlBy !== 'km' ? Math.max(prevHour, readingNum) : prevHour;
              const newKm = m.controlBy === 'km' ? Math.max(prevKm, readingNum) : prevKm;
              const prevExpenses = m.totalMaintenanceExpenses || 0;
              return {
                ...m,
                hourMeter: newHour,
                currentKm: newKm,
                horimetro_ou_km_atual: m.controlBy === 'km' ? newKm : newHour,
                totalMaintenanceExpenses: prevExpenses + numAmount,
              };
            }
            return m;
          });
          saveStoredMachineries(updatedMachineries);
        }
      } catch (err) {
        console.warn('Erro ao vincular histórico de manutenção:', err);
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
        <div className="w-full max-w-4xl max-h-[96vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Moldura Metálica 3D Acetinada Compacta */}
        <div className="px-3.5 py-2 border-b border-slate-400 dark:border-stone-700 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 text-slate-800 dark:text-stone-200 flex items-center justify-between shrink-0 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
              <Receipt className="w-3.5 h-3.5 text-slate-700 dark:text-stone-200" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100">
                {editingExpense ? 'EDITAR DESPESA' : 'NOVA DESPESA'}
              </h2>
              <p className="text-[10px] text-slate-600 dark:text-stone-400 font-medium uppercase mt-0.5">
                LANÇAMENTO FINANCEIRO, RATEIO E CENTRO DE CUSTO
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        {/* Form - Compacto Slim com Zero Rolagem Global */}
        <form onSubmit={handleSubmit} className="p-2.5 sm:p-3 space-y-2 bg-[#edf4ff] dark:bg-stone-900 flex-1 overflow-hidden">
          
          {/* LINHA 1: CATEGORIA (60%) + DATA (40%) */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-7">
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider">
                  CATEGORIA <span className="text-rose-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="inline-flex items-center space-x-1 text-[9px] font-bold text-slate-700 dark:text-stone-300 hover:text-black dark:hover:text-white px-1.5 py-0.5 rounded bg-gradient-to-b from-slate-100 to-slate-200 hover:from-white hover:to-slate-100 transition cursor-pointer border border-slate-300 dark:border-stone-600 shadow-[inset_0_1px_0px_rgba(255,255,255,0.8)] uppercase"
                  title="Incluir, editar ou excluir categorias de despesas"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                  <span>EDITAR / INCLUIR</span>
                </button>
              </div>
              <div className="flex items-center space-x-1">
                <div className="relative flex-1">
                  <select
                    value={categoryId}
                    onChange={(e) => handleSelectCategory(e.target.value)}
                    className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase"
                  >
                    {safeCategories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="uppercase">
                        {cat.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="w-7.5 h-7.5 shrink-0 rounded-md bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white flex items-center justify-center transition border border-slate-600 shadow-[inset_0_1px_0px_rgba(255,255,255,0.25)] cursor-pointer"
                  title="Incluir nova categoria ou gerenciar existentes"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="col-span-5">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                DATA <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* LINHA 2: DESCRIÇÃO DA DESPESA (60%) + VALOR TOTAL (R$) (40%) */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-7">
              {isAlimentacao ? (
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    TIPO DE REFEIÇÃO
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setMealType('cafe')}
                      className={`h-7.5 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
                        mealType === 'cafe'
                          ? 'bg-slate-800 text-white border-slate-700 font-bold shadow-xs'
                          : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-50'
                      }`}
                    >
                      CAFÉ
                    </button>
                    <button
                      type="button"
                      onClick={() => setMealType('almoco')}
                      className={`h-7.5 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
                        mealType === 'almoco'
                          ? 'bg-slate-800 text-white border-slate-700 font-bold shadow-xs'
                          : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-50'
                      }`}
                    >
                      ALMOÇO
                    </button>
                    <button
                      type="button"
                      onClick={() => setMealType('janta')}
                      className={`h-7.5 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
                        mealType === 'janta'
                          ? 'bg-slate-800 text-white border-slate-700 font-bold shadow-xs'
                          : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-50'
                      }`}
                    >
                      JANTA
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    DESCRIÇÃO DA DESPESA
                  </label>
                  <input
                    type="text"
                    placeholder="DESCRIÇÃO DETALHADA DA DESPESA..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 uppercase placeholder:uppercase"
                  />
                </div>
              )}
            </div>

            <div className="col-span-5">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                VALOR TOTAL (R$) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="R$ 0,00"
                className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* BLOCO CENTRAL DINÂMICO: SE MANUTENÇÃO, BORRACHARIA, ELÉTRICA OU PEÇAS => SELETORES DE FROTA; CASO CONTRÁRIO => RATEIO ADMINISTRATIVO GERAL */}
          {isFleetMaintenanceCategory ? (
            <div className="border border-slate-300 dark:border-stone-700 rounded-lg p-1.5 bg-gradient-to-b from-slate-50 to-white dark:from-stone-900/60 dark:to-stone-850/60 shadow-[inset_0_1px_0px_rgba(255,255,255,0.9)] space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 text-amber-600" />
                  <span>VÍNCULO DE MANUTENÇÃO & FROTAS</span>
                </label>
                <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 px-1.5 py-0.2 rounded uppercase">
                  CUSTO DIRETO DO MAQUINÁRIO PESADO
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-7">
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    VEÍCULO / MÁQUINA <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={machineryId}
                      onChange={(e) => {
                        const mId = e.target.value;
                        setMachineryId(mId);
                        const mach = availableMachineries.find((m) => m.id === mId);
                        if (mach) {
                          const cur = mach.controlBy === 'km' ? (mach.currentKm || mach.horimetro_ou_km_atual || '') : (mach.hourMeter || mach.horimetro_ou_km_atual || '');
                          if (cur && !readingKmOrHours) setReadingKmOrHours(String(cur));
                        }
                      }}
                      required={isFleetMaintenanceCategory}
                      className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase cursor-pointer"
                    >
                      <option value="">-- SELECIONE O VEÍCULO / MÁQUINA --</option>
                      {availableMachineries.map((m) => (
                        <option key={m.id} value={m.id}>
                          {(m.licensePlateOrSerial ? `${m.licensePlateOrSerial} · ${m.model || m.name}` : (m.model || m.name)).toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="col-span-5">
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    HORÍMETRO / ODÔMETRO <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="EX: 1250"
                    value={readingKmOrHours}
                    onChange={(e) => setReadingKmOrHours(e.target.value)}
                    className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 text-[9px] flex items-center justify-between text-amber-950 dark:text-amber-200">
                <span className="font-semibold uppercase truncate">
                  {selectedMachinery
                    ? `EQUIPAMENTO: ${(selectedMachinery.licensePlateOrSerial || selectedMachinery.name).toUpperCase()} (${(selectedMachinery.categoriaVeiculo || selectedMachinery.categoryType || 'FROTA').toUpperCase()})`
                    : 'SELECIONE UM EQUIPAMENTO PARA VINCULAR AO HISTÓRICO DE MANUTENÇÃO'}
                </span>
                {selectedMachinery?.operatorOrDriver && (
                  <span className="font-bold shrink-0 ml-2 uppercase">
                    OPERADOR: {selectedMachinery.operatorOrDriver.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Rateio por Funcionários e Equipes (Seleção Múltipla) - Subcontainer Micro Slim */
            <div className="border border-slate-300 dark:border-stone-700 rounded-lg p-1.5 bg-gradient-to-b from-slate-50 to-white dark:from-stone-900/60 dark:to-stone-850/60 shadow-[inset_0_1px_0px_rgba(255,255,255,0.9)] space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider">
                  FUNCIONÁRIOS E EQUIPES NO RATEIO ({totalParticipantsCount} {totalParticipantsCount === 1 ? 'PESSOA' : 'PESSOAS'})
                </label>
                <div className="flex items-center space-x-2 text-[9px]">
                  {!selectedTargets.includes('todos') && (
                    <button
                      type="button"
                      onClick={() => setSelectedTargets(['todos'])}
                      className="text-slate-800 dark:text-stone-100 font-bold hover:underline cursor-pointer uppercase"
                    >
                      + TODOS DA EMPRESA
                    </button>
                  )}
                  {selectedTargets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTargets(['todos'])}
                      className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer uppercase"
                    >
                      LIMPAR
                    </button>
                  )}
                </div>
              </div>

              {/* Linha de Seleção com Dropdown e Botão + ADICIONAR */}
              <div className="flex items-center space-x-1">
                <div className="relative flex-1">
                  <select
                    value={targetToAdd}
                    onChange={(e) => {
                      setTargetToAdd(e.target.value);
                      if (e.target.value) {
                        handleAddTarget(e.target.value);
                      }
                    }}
                    className="w-full px-2 h-7 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 cursor-pointer uppercase"
                  >
                    <option value="">+ SELECIONE PARA ADICIONAR AO RATEIO...</option>
                    
                    <optgroup label="RATEIO COLETIVO & GRUPOS">
                      <option value="todos">
                        TODOS OS FUNCIONÁRIOS ({activeEmployees.length} PESSOAS NA EMPRESA)
                      </option>
                      {operadoresCount > 0 && (
                        <option value="grupo_operadores">
                          EQUIPE DE CAMPO / OPERADORES ({operadoresCount} PESSOAS)
                        </option>
                      )}
                      {motoristasCount > 0 && (
                        <option value="grupo_motoristas">
                          MOTORISTAS DE CAMINHÃO ({motoristasCount} PESSOAS)
                        </option>
                      )}
                    </optgroup>

                    {teams.length > 0 && (
                      <optgroup label="EQUIPES DA FROTA">
                        {teams.map((team) => {
                          const teamMembers = activeEmployees.filter((e) => e.teamId === team.id);
                          return (
                            <option key={team.id} value={team.id}>
                              EQUIPE {team.name.toUpperCase()} ({teamMembers.length} PESSOAS){team.machineryName ? ` · ${team.machineryName.toUpperCase()}` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    {activeEmployees.length > 0 && (
                      <optgroup label={`FUNCIONÁRIOS CADASTRADOS (${activeEmployees.length})`}>
                        {activeEmployees.map((emp) => {
                          const empTeam = teams.find((t) => t.id === emp.teamId);
                          const empName = (emp?.name || '').toLowerCase();
                          const empMach = machineries.find(
                            (m) =>
                              m.assignedDriverIds?.includes(emp.id) ||
                              (empName && m.operatorOrDriver?.toLowerCase().includes(empName))
                          );
                          return (
                            <option key={emp.id} value={emp.id}>
                              {emp.name.toUpperCase()} ({(emp.role || 'FUNCIONÁRIO').toUpperCase()}{empTeam ? ` · EQUIPE ${empTeam.name.toUpperCase()}` : ''}{empMach ? ` · ${empMach.licensePlateOrSerial || empMach.name}` : ''})
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                  <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                
                <button
                  type="button"
                  onClick={() => handleAddTarget()}
                  className="h-7 px-2.5 shrink-0 rounded-md bg-[#059669] hover:bg-emerald-700 text-white flex items-center space-x-1 shadow-xs text-[10px] font-bold uppercase transition cursor-pointer"
                  title="Adicionar equipe ou funcionário ao rateio"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ ADICIONAR</span>
                </button>
              </div>

              {/* Chips de Funcionários / Equipes Selecionados - Linha Contínua Micro */}
              <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto scrollbar-none py-0.5">
                {selectedTargets.map((targetId) => {
                  if (targetId === 'todos') {
                    return (
                      <div
                        key="todos"
                        className="inline-flex items-center space-x-1 bg-blue-100/90 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      >
                        <Users className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>TODOS OS FUNCIONÁRIOS ({activeEmployees.length} PESSOAS)</span>
                      </div>
                    );
                  }

                  if (targetId === 'grupo_operadores') {
                    return (
                      <div
                        key="grupo_operadores"
                        className="inline-flex items-center space-x-1 bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      >
                        <Tractor className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>OPERADORES & TRATORISTAS ({operadoresCount})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTarget('grupo_operadores')}
                          className="w-3.5 h-3.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900 flex items-center justify-center text-emerald-900 dark:text-emerald-300 cursor-pointer ml-0.5"
                          title="Remover do rateio"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  }

                  if (targetId === 'grupo_motoristas') {
                    return (
                      <div
                        key="grupo_motoristas"
                        className="inline-flex items-center space-x-1 bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      >
                        <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>MOTORISTAS DE CAMINHÃO ({motoristasCount})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTarget('grupo_motoristas')}
                          className="w-3.5 h-3.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900 flex items-center justify-center text-emerald-900 dark:text-emerald-300 cursor-pointer ml-0.5"
                          title="Remover do rateio"
                        >
                          <X className="w-2.5 h-2.5" />
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
                        className="inline-flex items-center space-x-1 bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      >
                        <Users className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                        <span>EQUIPE {teamMatch.name.toUpperCase()} ({teamMembers.length} FUNC.)</span>
                        {teamMatch.machineryName && (
                          <span className="text-[9px] opacity-75 font-normal">· {teamMatch.machineryName.toUpperCase()}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveTarget(teamMatch.id)}
                          className="w-3.5 h-3.5 rounded hover:bg-amber-200 dark:hover:bg-amber-900 flex items-center justify-center text-amber-900 dark:text-amber-300 cursor-pointer ml-0.5"
                          title="Remover equipe do rateio"
                        >
                          <X className="w-2.5 h-2.5" />
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
                        className="inline-flex items-center space-x-1 bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[8px] flex items-center justify-center font-bold">
                          {empMatch.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{empMatch.name.toUpperCase()}</span>
                        <span className="text-[9px] text-emerald-800 dark:text-emerald-400 font-normal">
                          ({(empMatch.role || 'FUNCIONÁRIO').toUpperCase()}{empTeam ? ` · EQ. ${empTeam.name.toUpperCase()}` : ''})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTarget(empMatch.id)}
                          className="w-3.5 h-3.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900 flex items-center justify-center text-emerald-900 dark:text-emerald-300 cursor-pointer ml-0.5"
                          title="Remover funcionário do rateio"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>

              {/* Informative Rateio / Auto-Linking Feedback Box Compacto */}
              <div className="px-2 py-1 rounded border border-stone-200 dark:border-stone-700 bg-white/90 dark:bg-stone-900/60 text-[10px] flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-stone-800 dark:text-stone-200 uppercase">
                  <Calculator className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>RATEIO: {totalParticipantsCount} {totalParticipantsCount === 1 ? 'PESSOA' : 'PESSOAS'} NO TOTAL</span>
                  {linkedMachineries.length > 0 && (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold ml-2">
                      · MÁQ: {linkedMachineries.map((m) => m.licensePlateOrSerial || m.model || m.name).join(', ').toUpperCase()}
                    </span>
                  )}
                </div>
                {numAmount > 0 && (
                  <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-xs">
                    R$ {rateioPerPerson.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / PESSOA
                  </span>
                )}
              </div>
            </div>
          )}

          {/* FORNECEDOR */}
          <div ref={supplierContainerRef} className="relative">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
              FORNECEDOR
            </label>
            <div className="flex items-center space-x-1">
              <div className="relative flex-1">
                <Search className="w-3 h-3 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="BUSCAR FORNECEDOR CADASTRADO..."
                  value={supplier}
                  onChange={(e) => {
                    setSupplier(e.target.value);
                    setIsSupplierDropdownOpen(true);
                  }}
                  onFocus={() => setIsSupplierDropdownOpen(true)}
                  className="w-full pl-7 pr-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 uppercase placeholder:uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSupplierModalOpen(true);
                  setIsSupplierDropdownOpen(false);
                }}
                className="w-7.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-gradient-to-b from-slate-100 to-slate-200 hover:from-white hover:to-slate-100 text-slate-700 dark:text-stone-300 flex items-center justify-center transition cursor-pointer shrink-0 shadow-[inset_0_1px_0px_rgba(255,255,255,0.8)]"
                title="Cadastrar Novo Fornecedor"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Dropdown Lista de Fornecedores */}
            {isSupplierDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                {filteredSuppliers.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-stone-700">
                    {filteredSuppliers.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSupplier(s.name);
                          setIsSupplierDropdownOpen(false);
                        }}
                        className="p-1.5 hover:bg-slate-50 dark:hover:bg-stone-700/60 cursor-pointer transition flex flex-col justify-center text-left group uppercase"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-stone-100 text-xs group-hover:text-black dark:group-hover:text-white">
                            {s.name.toUpperCase()}
                          </span>
                          {s.category && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-medium shrink-0">
                              {s.category.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                          {s.cnpjOrCpf && <span>{s.cnpjOrCpf}</span>}
                          {s.tradeName && s.tradeName !== s.name && (
                            <span>· {s.tradeName.toUpperCase()}</span>
                          )}
                          {s.city && (
                            <span>· {s.city.toUpperCase()}{s.state ? `/${s.state.toUpperCase()}` : ''}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 text-xs text-slate-500 dark:text-stone-400 text-center uppercase">
                    Nenhum fornecedor cadastrado com esse termo.
                  </div>
                )}

                {/* Opção de Cadastrar Novo Fornecedor */}
                <div className="border-t border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSupplierModalOpen(true);
                      setIsSupplierDropdownOpen(false);
                    }}
                    className="w-full p-1.5 flex items-center space-x-1.5 text-slate-800 dark:text-stone-200 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-stone-700 text-xs font-semibold transition cursor-pointer text-left uppercase"
                  >
                    <Plus className="w-3 h-3 text-slate-800 dark:text-stone-200" />
                    <span>+ CADASTRAR NOVO FORNECEDOR</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* LINHA 3 (DADOS DA BAIXA): RESPONSÁVEL PELO PAGAMENTO (50%) + CONTA DE DÉBITO (ORIGEM) (50%) */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                RESPONSÁVEL PELO PAGAMENTO {status === 'pago' && <span className="text-rose-600">*</span>}
              </label>
              <div className="relative">
                <select
                  value={paidByEmployeeId}
                  onChange={(e) => setPaidByEmployeeId(e.target.value)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase"
                >
                  <option value="">-- SELECIONE O COLABORADOR --</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="uppercase">
                      {emp.name.toUpperCase()} {emp.role ? `(${emp.role.toUpperCase()})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="col-span-6">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                CONTA DE DÉBITO (ORIGEM) {status === 'pago' && <span className="text-rose-600">*</span>}
              </label>
              <div className="relative">
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase"
                >
                  <option value="">-- SELECIONE O BANCO / CONTA --</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id} className="uppercase">
                      {acc.name.toUpperCase()} · {acc.bankName.toUpperCase()} (SALDO: R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* LINHA 4: STATUS DO PAGAMENTO (33%) + FORMA DE PAGAMENTO (33%) + DATA EFETIVA DA BAIXA (34%) */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                STATUS DO PAGAMENTO
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase"
                >
                  <option value="pago">PAGO (LIQUIDADO)</option>
                  <option value="pendente">A PAGAR (PENDENTE)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                FORMA DE PAGAMENTO
              </label>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase"
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">DINHEIRO EM ESPÉCIE</option>
                  <option value="boleto">BOLETO BANCÁRIO</option>
                  <option value="cartao_credito">CARTÃO DE CRÉDITO</option>
                  <option value="cartao_debito">CARTÃO DE DÉBITO</option>
                  <option value="transferencia">TRANSFERÊNCIA BANCÁRIA (TED/DOC)</option>
                  <option value="cheque">CHEQUE</option>
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                DATA EFETIVA DA BAIXA
              </label>
              <input
                type="date"
                value={paymentDate || dueDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          {/* ADAPTAÇÃO DE BLOCOS SECUNDÁRIOS: FOTO / COMPROVANTE & OBSERVAÇÕES LADO A LADO */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                FOTO / COMPROVANTE
              </label>
              <label className="cursor-pointer border border-dashed border-slate-300 dark:border-stone-700 hover:border-slate-500 rounded-md h-7.5 px-2 flex items-center justify-center gap-1.5 text-slate-600 dark:text-stone-400 hover:text-black dark:hover:text-white transition bg-white dark:bg-stone-800">
                <Camera className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="text-[10px] font-bold truncate uppercase">
                  {receiptName ? `ANEXADO: ${receiptName.toUpperCase()}` : 'TIRAR FOTO OU SELECIONAR IMAGEM'}
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                OBSERVAÇÕES
              </label>
              <input
                type="text"
                placeholder="OBSERVAÇÕES SOBRE A DESPESA..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-7.5 px-2.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 uppercase placeholder:uppercase"
              />
            </div>
          </div>

          {/* Botões de Ação - Rodapé 3D Compacto */}
          <div className="pt-2 border-t border-slate-200 dark:border-stone-800 flex items-center justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1 rounded-md bg-gradient-to-b from-slate-100 to-slate-200 hover:from-white hover:to-slate-100 border border-slate-300 text-slate-700 text-xs font-bold uppercase shadow-[inset_0_1px_0px_rgba(255,255,255,0.8)] transition cursor-pointer"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              className="px-4 py-1 rounded-md bg-[#059669] hover:bg-emerald-700 text-white text-xs font-bold uppercase transition cursor-pointer shadow-xs"
            >
              {editingExpense ? 'ATUALIZAR DESPESA' : 'SALVAR DESPESA'}
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
        categories={safeCategories}
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
          handleSelectCategory(newCatId);
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
