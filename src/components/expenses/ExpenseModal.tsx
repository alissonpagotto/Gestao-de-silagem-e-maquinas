import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Package,
  CreditCard,
  Coins,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Expense, ExpenseCategory, CostCenter, Machinery, ExpenseStatus, PaymentMethod, Employee, FleetTeam, Supplier, BankAccount, MaintenanceLog, ExpenseItem, CorporateCard } from '../../types';
import { INITIAL_CATEGORIES } from '../../lib/initialData';
import { getStoredMaintenanceLogs, saveStoredMaintenanceLogs, getStoredMachineries, saveStoredMachineries, getStoredBankAccounts } from '../../lib/storage';
import { formatCurrencyBRL, maskCurrencyLive, parseCurrencyToFloat, calculateCardInvoiceDueDate, formatDateBR, formatCpfCnpj, formatCurrencyInputDisplay } from '../../lib/formatters';
import { formatCorporateCardDisplay, syncExpenseWithCardsAndBank } from '../../lib/cardFinancialSync';
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
  onSaveBankAccounts?: (accounts: BankAccount[]) => void;
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
  onSaveBankAccounts,
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
    const catName = (selectedCat?.name || '').toUpperCase().trim();
    const isFuel = newCatId === 'cat_combustivel' || catName.includes('COMBUSTÍVEL') || catName.includes('COMBUSTIVEL') || catName.includes('DIESEL');
    if (isFuel) {
      onClose();
      if (onOpenFuelModal) {
        onOpenFuelModal();
      }
      return;
    }

    // Se o usuário mudar para qualquer categoria diferente de Alimentação, limpa os funcionários do rateio
    const newIsAlimentacao =
      catName === 'ALIMENTAÇÃO' ||
      catName === 'ALIMENTACAO' ||
      catName.includes('ALIMENT') ||
      catName.includes('REFEIÇ') ||
      catName.includes('REFEIC') ||
      catName.includes('RESTAURANTE');

    if (!newIsAlimentacao) {
      setSelectedTargets(['todos']);
      setTargetToAdd('');
    }

    setCategoryId(newCatId);
  };

  // Lista resiliente e unificada de contas bancárias
  const effectiveBankAccounts = useMemo(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw =
          localStorage.getItem('agrocontrol_bancos') ||
          localStorage.getItem('agrocontrol_contas_bancarias') ||
          localStorage.getItem('agrocontrol_financeiro_contas');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed as BankAccount[];
        }
      } catch {}
    }
    if (Array.isArray(bankAccounts) && bankAccounts.length > 0) return bankAccounts;
    return getStoredBankAccounts();
  }, [bankAccounts, isOpen]);

  // Identificação da conta prioritária ativa (com estrela amarela "PRIORITÁRIA" no módulo financeiro)
  const priorityBankAccountId = useMemo(() => {
    if (!Array.isArray(effectiveBankAccounts) || effectiveBankAccounts.length === 0) return '';
    const priority = effectiveBankAccounts.find(
      (b) =>
        b.isPriority === true ||
        b.prioritaria === true ||
        (b as any).is_priority === true ||
        (b as any).priority === true ||
        String((b as any).status || '').toUpperCase() === 'PRIORITÁRIA'
    );
    return priority ? priority.id : (effectiveBankAccounts[0]?.id || '');
  }, [effectiveBankAccounts]);

  const [supplierId, setSupplierId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [paymentDate, setPaymentDate] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('pendente');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('assinado_nota');
  const [bankAccountId, setBankAccountId] = useState<string>(() => priorityBankAccountId);
  const [corporateCardId, setCorporateCardId] = useState<string>('');

  const selectedAccount = useMemo(() => {
    return effectiveBankAccounts.find((a) => a.id === bankAccountId);
  }, [effectiveBankAccounts, bankAccountId]);

  const availableCards: CorporateCard[] = useMemo(() => {
    if (!selectedAccount || !Array.isArray(selectedAccount.corporateCards)) {
      return [];
    }
    return selectedAccount.corporateCards;
  }, [selectedAccount]);

  const selectedCard = useMemo(() => {
    return availableCards.find((c) => c.id === corporateCardId) ||
      effectiveBankAccounts.flatMap(a => a.corporateCards || []).find(c => c.id === corporateCardId);
  }, [availableCards, effectiveBankAccounts, corporateCardId]);

  const isCardPayment = paymentMethod === 'cartao_credito' || paymentMethod === 'cartao_debito';

  const handleStatusChange = (newStatus: ExpenseStatus) => {
    setStatus(newStatus);
    if (newStatus === 'pago') {
      if (!paymentDate) {
        setPaymentDate(dueDate || today);
      }
      if (paymentMethod !== 'dinheiro' && paymentMethod !== 'assinado_nota' && paymentMethod !== 'cheque') {
        if (!bankAccountId && priorityBankAccountId) {
          setBankAccountId(priorityBankAccountId);
        }
      }
      // Se estava em assinado_nota (típico de pendente), sugere pix ao liquidar
      if (paymentMethod === 'assinado_nota') {
        setPaymentMethod('pix');
        if (priorityBankAccountId) {
          setBankAccountId(priorityBankAccountId);
        }
      }
    } else {
      setPaymentDate('');
      // Sempre que alterar para "A PAGAR (PENDENTE)", se for cartão mantém o cartão
      if (paymentMethod !== 'cartao_credito' && paymentMethod !== 'cartao_debito') {
        setPaymentMethod('assinado_nota');
      }
    }
  };

  const handlePaymentMethodChange = (newMethod: PaymentMethod) => {
    setPaymentMethod(newMethod);
    if (newMethod === 'dinheiro' || newMethod === 'assinado_nota') {
      setBankAccountId('');
      setCorporateCardId('');
    } else if (newMethod === 'cheque') {
      setBankAccountId('');
      setCorporateCardId('');
      if (!checkAmount) {
        const currentAmountNum = parseFloat(amount) || 0;
        if (currentAmountNum > 0) {
          setCheckAmount(formatCurrencyInputDisplay(currentAmountNum));
        }
      }
    } else if (newMethod === 'cartao_credito' || newMethod === 'cartao_debito') {
      let currentAccId = bankAccountId;
      if (!currentAccId && priorityBankAccountId) {
        currentAccId = priorityBankAccountId;
        setBankAccountId(priorityBankAccountId);
      }
      const acc = effectiveBankAccounts.find((a) => a.id === currentAccId) || effectiveBankAccounts[0];
      const cards = acc?.corporateCards || [];
      if (cards.length > 0) {
        const matchingCard = cards.find((c) => c.id === corporateCardId) || cards[0];
        setCorporateCardId(matchingCard.id);
        if (newMethod === 'cartao_credito' && matchingCard.dueDay) {
          setDueDate(calculateCardInvoiceDueDate(matchingCard.dueDay));
          setStatus('pendente');
        } else if (newMethod === 'cartao_debito') {
          setStatus('pago');
          if (!paymentDate) {
            setPaymentDate(dueDate || today);
          }
        }
      } else {
        setCorporateCardId('');
      }
    } else {
      // Outras modalidades (Pix, Boleto, Transferência): remove cartão e restaura conta se necessário
      setCorporateCardId('');
      if (!bankAccountId && priorityBankAccountId) {
        setBankAccountId(priorityBankAccountId);
      }
    }
  };

  const handleCorporateCardChange = (cardId: string) => {
    setCorporateCardId(cardId);
    if (paymentMethod === 'cartao_credito' && cardId) {
      const card = availableCards.find((c) => c.id === cardId);
      if (card?.dueDay) {
        setDueDate(calculateCardInvoiceDueDate(card.dueDay));
      }
    }
  };

  const handleBankAccountChange = (accId: string) => {
    setBankAccountId(accId);
    if (paymentMethod === 'cartao_credito' || paymentMethod === 'cartao_debito') {
      const acc = effectiveBankAccounts.find((a) => a.id === accId);
      const cards = acc?.corporateCards || [];
      if (cards.length > 0) {
        const stillValid = cards.some((c) => c.id === corporateCardId);
        if (!stillValid) {
          setCorporateCardId(cards[0].id);
          if (paymentMethod === 'cartao_credito' && cards[0].dueDay) {
            setDueDate(calculateCardInvoiceDueDate(cards[0].dueDay));
          }
        }
      } else {
        setCorporateCardId('');
      }
    }
  };
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

  // Grade discriminada de produtos / itens da despesa
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [itemDescription, setItemDescription] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<string>('1');
  const [itemUnitValue, setItemUnitValue] = useState<string>('');

  const handleAddItem = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const desc = itemDescription.trim();
    if (!desc) {
      alert('Por favor, informe a descrição do item / gasto.');
      return;
    }
    const cleanQtyStr = itemQuantity.replace(',', '.');
    const qty = parseFloat(cleanQtyStr);
    if (isNaN(qty) || qty <= 0) {
      alert('Por favor, informe uma quantidade válida maior que zero.');
      return;
    }
    const unitVal = parseCurrencyToFloat(itemUnitValue);
    if (unitVal <= 0) {
      alert('Por favor, informe um valor unitário válido (R$).');
      return;
    }

    const totalVal = +(qty * unitVal).toFixed(2);
    const newItem: ExpenseItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      description: desc,
      quantity: qty,
      unit_value: unitVal,
      total_value: totalVal,
    };

    const nextItems = [...expenseItems, newItem];
    setExpenseItems(nextItems);
    const sum = nextItems.reduce((acc, it) => acc + ((it.quantity || 0) * (it.unit_value || 0)), 0);
    setAmount(sum.toFixed(2));

    setItemDescription('');
    setItemQuantity('1');
    setItemUnitValue('');
  };

  const handleRemoveItem = (index: number) => {
    const nextItems = expenseItems.filter((_, idx) => idx !== index);
    setExpenseItems(nextItems);
    if (nextItems.length > 0) {
      const sum = nextItems.reduce((acc, it) => acc + ((it.quantity || 0) * (it.unit_value || 0)), 0);
      setAmount(sum.toFixed(2));
    }
  };

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

  const isAlimentacao = useMemo(() => {
    return (
      selectedCategoryName === 'ALIMENTAÇÃO' ||
      selectedCategoryName === 'ALIMENTACAO' ||
      selectedCategoryName.includes('ALIMENT') ||
      selectedCategoryName.includes('REFEIÇ') ||
      selectedCategoryName.includes('REFEIC') ||
      selectedCategoryName.includes('RESTAURANTE')
    );
  }, [selectedCategoryName]);

  const activeEmployees = useMemo(() => {
    return Array.isArray(employees) ? employees.filter((e) => e.status !== 'inativo') : [];
  }, [employees]);

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

  // Busca inteligente de veículo vinculado ao colaborador selecionado
  const getLinkedVehicleForEmployee = useCallback(
    (empId: string): Machinery | undefined => {
      if (!empId) return undefined;
      const emp = activeEmployees.find((e) => e.id === empId) || (Array.isArray(employees) ? employees.find((e) => e.id === empId) : undefined);
      if (!emp) return undefined;

      const empIdLower = emp.id.toLowerCase();
      const empNameLower = (emp.name || '').trim().toLowerCase();
      const explicitVehId = String(
        emp.machineryId ||
        (emp as any).veiculo_id ||
        (emp as any).assigned_vehicle_id ||
        (emp as any).assignedVehicleId ||
        ''
      ).trim();

      // 1. Vínculo explícito por ID no cadastro do colaborador
      if (explicitVehId) {
        const found = availableMachineries.find(
          (m) =>
            m.id === explicitVehId ||
            String(m.id).toLowerCase() === explicitVehId.toLowerCase() ||
            (m.licensePlateOrSerial && m.licensePlateOrSerial.toLowerCase() === explicitVehId.toLowerCase()) ||
            (m.plate && m.plate.toLowerCase() === explicitVehId.toLowerCase())
        );
        if (found) return found;
      }

      // 2. Vínculo explícito por nome/placa no colaborador
      const explicitVehName = String(emp.machineryName || (emp as any).veiculo_vinculado || '').trim().toLowerCase();
      if (explicitVehName) {
        const found = availableMachineries.find(
          (m) =>
            (m.licensePlateOrSerial && m.licensePlateOrSerial.toLowerCase().includes(explicitVehName)) ||
            (m.plate && m.plate.toLowerCase().includes(explicitVehName)) ||
            (m.model && m.model.toLowerCase().includes(explicitVehName)) ||
            (m.name && m.name.toLowerCase().includes(explicitVehName))
        );
        if (found) return found;
      }

      // 3. Vínculo no cadastro da Frota (assignedDriverIds, driver_id, operatorOrDriver, assignedDrivers)
      const byDriver = availableMachineries.find((m) => {
        if (m.assignedDriverIds && Array.isArray(m.assignedDriverIds)) {
          if (m.assignedDriverIds.some((id) => id === emp.id || id.toLowerCase() === empIdLower)) {
            return true;
          }
        }
        if ((m as any).driver_id && ((m as any).driver_id === emp.id || String((m as any).driver_id).toLowerCase() === empIdLower)) {
          return true;
        }
        if (m.operatorOrDriver) {
          const parts = m.operatorOrDriver.split(',').map((s) => s.trim().toLowerCase());
          if (parts.includes(empNameLower) || (empNameLower && parts.some((p) => p.includes(empNameLower) || empNameLower.includes(p)))) {
            return true;
          }
        }
        if (m.assignedDrivers && Array.isArray(m.assignedDrivers)) {
          return m.assignedDrivers.some((d: any) => {
            if (typeof d === 'string') {
              return d.toLowerCase().includes(empNameLower);
            }
            if (d && typeof d === 'object') {
              return d.id === emp.id || (d.name && String(d.name).toLowerCase().includes(empNameLower));
            }
            return false;
          });
        }
        return false;
      });
      if (byDriver) return byDriver;

      // 4. Vínculo pela equipe da frota
      if (emp.teamId) {
        const team = teams.find((t) => t.id === emp.teamId);
        if (team?.machineryId) {
          const found = availableMachineries.find((m) => m.id === team.machineryId);
          if (found) return found;
        }
      }

      return undefined;
    },
    [activeEmployees, employees, availableMachineries, teams]
  );

  // Preenchimento automático inteligente do veículo ao escolher/alterar o responsável
  const handlePaidByEmployeeChange = useCallback(
    (empId: string) => {
      setPaidByEmployeeId(empId);

      if (!empId) {
        setMachineryId('');
        setCostCenterId('');
        setReadingKmOrHours('');
        return;
      }

      const linkedVeh = getLinkedVehicleForEmployee(empId);
      if (linkedVeh) {
        setMachineryId(linkedVeh.id);
        setCostCenterId('');
        const cur = linkedVeh.controlBy === 'km' 
          ? (linkedVeh.currentKm || linkedVeh.horimetro_ou_km_atual || '') 
          : (linkedVeh.hourMeter || linkedVeh.horimetro_ou_km_atual || '');
        if (cur) setReadingKmOrHours(String(cur));
      } else {
        // Colaborador sem veículo cadastrado: inicializa o campo limpo
        setMachineryId('');
        setCostCenterId('');
        setReadingKmOrHours('');
      }
    },
    [getLinkedVehicleForEmployee]
  );

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

  // Campos de Pagamento em Cheque e Pagamento Misto
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [checkIssuerName, setCheckIssuerName] = useState<string>('');
  const [checkIssuerCpf, setCheckIssuerCpf] = useState<string>('');
  const [checkBank, setCheckBank] = useState<string>('');
  const [checkAmount, setCheckAmount] = useState<string>('');

  // Linhas de Pagamento Complementar (Pagamento Misto quando Cheque < Total)
  interface ComplementaryPaymentRow {
    id: string;
    paymentMethod: PaymentMethod;
    amount: string;
    bankAccountId?: string;
  }
  const [complementaryPayments, setComplementaryPayments] = useState<ComplementaryPaymentRow[]>([]);

  // Helper to cleanly reset all form states avoiding carryover between launches
  const resetFormState = useCallback(() => {
    setExpenseItems([]);
    setItemDescription('');
    setItemQuantity('1');
    setItemUnitValue('');
    setAmount('');
    setCategoryId(safeCategories[0]?.id || '');
    setDueDate(today);
    setPaymentDate('');
    setStatus('pendente');
    setPaymentMethod('assinado_nota');
    setBankAccountId(priorityBankAccountId);
    setCorporateCardId('');
    setPaidByEmployeeId('');
    setSupplier('');
    setSupplierId('');
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
    setCheckNumber('');
    setCheckIssuerName('');
    setCheckIssuerCpf('');
    setCheckBank('');
    setCheckAmount('');
    setComplementaryPayments([]);
  }, [safeCategories, today, priorityBankAccountId]);

  const handleCloseModal = () => {
    resetFormState();
    onClose();
  };

  // Load existing data if editing or reset completely if new/closed
  useEffect(() => {
    if (!isOpen) {
      resetFormState();
      return;
    }

    if (editingExpense) {
      setAmount(editingExpense.amount.toString());
      setCategoryId(editingExpense.categoryId);
      setDueDate(editingExpense.dueDate);
      setStatus(editingExpense.status || 'pendente');
      setPaymentDate(editingExpense.status === 'pago' ? (editingExpense.paymentDate || '') : '');
      setPaymentMethod(editingExpense.paymentMethod);
      setBankAccountId(editingExpense.bankAccountId || (editingExpense.status === 'pago' ? priorityBankAccountId : ''));
      setCorporateCardId(editingExpense.corporateCardId || '');
      setPaidByEmployeeId(editingExpense.paidByEmployeeId || '');
      setSupplier(editingExpense.supplier || editingExpense.description || '');
      setSupplierId(editingExpense.supplierId || editingExpense.fornecedorId || '');
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

      // Dados de Cheque e Pagamento Misto
      setCheckNumber(editingExpense.checkNumber || '');
      setCheckIssuerName(editingExpense.checkIssuerName || '');
      setCheckIssuerCpf(editingExpense.checkIssuerCpf || '');
      setCheckBank(editingExpense.checkBank || '');
      setCheckAmount(editingExpense.checkAmount ? formatCurrencyInputDisplay(editingExpense.checkAmount) : '');
      setComplementaryPayments(
        Array.isArray(editingExpense.complementaryPayments)
          ? editingExpense.complementaryPayments.map((c) => ({
              id: c.id || `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              paymentMethod: c.paymentMethod,
              amount: formatCurrencyInputDisplay(c.amount),
              bankAccountId: c.bankAccountId,
            }))
          : []
      );
      
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
      const loadedItems = editingExpense.expense_items || (editingExpense as any).items || [];
      setExpenseItems(Array.isArray(loadedItems) ? loadedItems : []);
      setItemDescription('');
      setItemQuantity('1');
      setItemUnitValue('');
      setIsInstallment(false);
    } else {
      resetFormState();
    }
  }, [editingExpense, isOpen, resetFormState, priorityBankAccountId]);

  // Garante que, ao abrir o modal para uma nova despesa, a conta prioritária esteja pré-selecionada
  useEffect(() => {
    if (isOpen && !editingExpense && priorityBankAccountId) {
      setBankAccountId(priorityBankAccountId);
    }
  }, [isOpen, editingExpense, priorityBankAccountId]);

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
        // Se ainda não houver veículo ou centro de custo selecionado, preenche com o do colaborador adicionado
        if (!machineryId && !costCenterId) {
          const linkedVeh = getLinkedVehicleForEmployee(target);
          if (linkedVeh) {
            setMachineryId(linkedVeh.id);
            setCostCenterId('');
          }
        }
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

  const isCashOrSignedNote = paymentMethod === 'dinheiro' || paymentMethod === 'assinado_nota';
  const isCheckPayment = paymentMethod === 'cheque';

  const numCheckAmount = parseCurrencyToFloat(checkAmount);
  const checkChangeAmount = isCheckPayment && numCheckAmount > numAmount ? +(numCheckAmount - numAmount).toFixed(2) : 0;
  const complementaryPaymentsTotal = complementaryPayments.reduce((acc, c) => acc + parseCurrencyToFloat(c.amount), 0);
  const isCheckUnderpaid = isCheckPayment && numAmount > 0 && numCheckAmount > 0 && numCheckAmount < numAmount;
  const totalPaidWithCheckAndComp = +(numCheckAmount + complementaryPaymentsTotal).toFixed(2);
  const saldoADistribuir = isCheckUnderpaid ? Math.max(0, +(numAmount - totalPaidWithCheckAndComp).toFixed(2)) : 0;

  const handleAddComplementaryPayment = () => {
    const missingAmount = Math.max(0, +(numAmount - (numCheckAmount + complementaryPaymentsTotal)).toFixed(2));
    setComplementaryPayments((prev) => [
      ...prev,
      {
        id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        paymentMethod: 'pix',
        amount: missingAmount > 0 ? formatCurrencyInputDisplay(missingAmount) : '',
        bankAccountId: priorityBankAccountId || effectiveBankAccounts[0]?.id || '',
      },
    ]);
  };

  const handleUpdateComplementaryPayment = (
    id: string,
    field: 'paymentMethod' | 'amount' | 'bankAccountId',
    value: string
  ) => {
    setComplementaryPayments((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'amount') {
          return { ...item, amount: maskCurrencyLive(value) };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleRemoveComplementaryPayment = (id: string) => {
    setComplementaryPayments((prev) => prev.filter((item) => item.id !== id));
  };

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
  // Only resolve machinery if explicitly selected by the user (NO phantom auto-linking from employees)
  const primaryMachinery = machineryId
    ? availableMachineries.find((m) => m.id === machineryId)
    : undefined;
  const resolvedMachineryId = machineryId ? (primaryMachinery?.id || machineryId) : undefined;
  const resolvedMachineryName = machineryId && primaryMachinery
    ? (primaryMachinery.licensePlateOrSerial
        ? `${primaryMachinery.licensePlateOrSerial} - ${(primaryMachinery.model || primaryMachinery.name).toUpperCase()}`
        : (primaryMachinery.model || primaryMachinery.name).toUpperCase())
    : (machineryId ? machineryId : undefined);

  // Only resolve cost center if explicitly selected by the user (NO fallback to costCenters[0])
  const selectedCostCenter = costCenterId
    ? costCenters.find((cc) => cc.id === costCenterId)
    : undefined;
  const resolvedCostCenterId = costCenterId ? (selectedCostCenter?.id || costCenterId) : undefined;
  const resolvedCostCenterName = costCenterId ? (selectedCostCenter?.name || undefined) : undefined;

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

    if (isCheckPayment) {
      if (!checkNumber.trim()) {
        alert('POR FAVOR, INFORME O NÚMERO DO CHEQUE.');
        return;
      }
      if (numCheckAmount <= 0) {
        alert('POR FAVOR, INFORME O VALOR DO CHEQUE (R$).');
        return;
      }
      if (isCheckUnderpaid && saldoADistribuir > 0.009) {
        alert(`EXISTE UM SALDO RESTANTE DE ${formatCurrencyBRL(saldoADistribuir)} A DISTRIBUIR. ADICIONE UMA FORMA COMPLEMENTAR DE PAGAMENTO (EX: PIX OU DINHEIRO) ATÉ ZERAR O SALDO.`);
        return;
      }
      for (const comp of complementaryPayments) {
        const compVal = parseCurrencyToFloat(comp.amount);
        if (compVal <= 0) {
          alert('POR FAVOR, INFORME UM VALOR VÁLIDO PARA CADA FORMA COMPLEMENTAR.');
          return;
        }
      }
    }

    if (status === 'pago' && !bankAccountId && !isCardPayment && !isCashOrSignedNote && !isCheckPayment) {
      alert('POR FAVOR, SELECIONE A CONTA DE DÉBITO (ORIGEM) PARA A DESPESA PAGA.');
      return;
    }

    if (isCardPayment) {
      if (!bankAccountId) {
        alert('POR FAVOR, SELECIONE A CONTA BANCÁRIA VINCULADA AO CARTÃO.');
        return;
      }
      if (!corporateCardId) {
        alert('POR FAVOR, SELECIONE O CARTÃO CORPORATIVO UTILIZADO.');
        return;
      }
    }

    const selectedCat = safeCategories.find((c) => c.id === categoryId) || safeCategories[0];

    const matchedSupplier = suppliers.find(
      (s) => (supplierId && s.id === supplierId) || (s.name && s.name.trim().toLowerCase() === supplier.trim().toLowerCase())
    );
    const resolvedSupplierId = supplierId || matchedSupplier?.id || undefined;
    const effectiveDesc = supplier.trim() || 
      (editingExpense?.description ? editingExpense.description : (isAlimentacao ? `Refeição (${mealType === 'cafe' ? 'Café da Manhã' : mealType === 'almoco' ? 'Almoço' : 'Janta'})` : selectedCat?.name || 'Despesa Operacional'));

    const singleEmp = selectedTargets.length === 1 && activeEmployees.some((e) => e.id === selectedTargets[0])
      ? activeEmployees.find((e) => e.id === selectedTargets[0])
      : undefined;

    const selectedBankAccountObj = effectiveBankAccounts.find((b) => b.id === bankAccountId);
    const selectedPaidByEmpObj = employees.find((e) => e.id === paidByEmployeeId);

    const cardObj = isCardPayment
      ? (availableCards.find((c) => c.id === corporateCardId) || selectedCard)
      : undefined;
    const finalCorporateCardId = isCardPayment ? (cardObj?.id || corporateCardId) : undefined;
    const finalCorporateCardName = isCardPayment ? (cardObj?.name || 'Cartão Corporativo') : undefined;

    let finalDueDate = dueDate;
    let finalStatus = status;
    let finalPaymentDate = status === 'pago' ? (paymentDate || dueDate) : undefined;

    if (paymentMethod === 'cartao_credito') {
      finalStatus = 'pendente';
      if (cardObj?.dueDay) {
        finalDueDate = calculateCardInvoiceDueDate(cardObj.dueDay);
      }
      finalPaymentDate = undefined;
    } else if (paymentMethod === 'cartao_debito') {
      finalStatus = 'pago';
      finalPaymentDate = paymentDate || dueDate || today;
    }

    const finalBankAccountId = (finalStatus === 'pago' || isCardPayment) && !isCashOrSignedNote && !isCheckPayment ? selectedBankAccountObj?.id : undefined;
    const finalBankAccountName = (finalStatus === 'pago' || isCardPayment) && !isCashOrSignedNote && !isCheckPayment ? selectedBankAccountObj?.name : undefined;

    if (isInstallment && installmentCount > 1 && !editingExpense) {
      const installmentAmount = +(numAmount / installmentCount).toFixed(2);
      const installments: Expense[] = [];
      const [bYear, bMonth, bDay] = finalDueDate.split('-').map(Number);

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
          paymentDate: i === 0 && finalStatus === 'pago' ? (finalPaymentDate || dateStr) : undefined,
          status: i === 0 ? finalStatus : 'pendente',
          paymentMethod,
          bankAccountId: i === 0 && (finalStatus === 'pago' || isCardPayment) && !isCashOrSignedNote && !isCheckPayment ? finalBankAccountId : undefined,
          bankAccountName: i === 0 && (finalStatus === 'pago' || isCardPayment) && !isCashOrSignedNote && !isCheckPayment ? finalBankAccountName : undefined,
          paidByEmployeeId: i === 0 && finalStatus === 'pago' ? selectedPaidByEmpObj?.id : undefined,
          paidByEmployeeName: i === 0 && finalStatus === 'pago' ? selectedPaidByEmpObj?.name : undefined,
          corporateCardId: finalCorporateCardId,
          corporateCardName: finalCorporateCardName,
          checkNumber: isCheckPayment && checkNumber.trim() ? checkNumber.trim() : undefined,
          checkIssuerName: isCheckPayment && checkIssuerName.trim() ? checkIssuerName.trim() : undefined,
          checkIssuerCpf: isCheckPayment && checkIssuerCpf.trim() ? checkIssuerCpf.trim() : undefined,
          checkBank: isCheckPayment && checkBank.trim() ? checkBank.trim() : undefined,
          checkAmount: isCheckPayment && numCheckAmount > 0 ? numCheckAmount : undefined,
          checkChangeAmount: isCheckPayment && checkChangeAmount > 0 ? checkChangeAmount : undefined,
          complementaryPayments: isCheckPayment && complementaryPayments.length > 0
            ? complementaryPayments.map(c => ({
                id: c.id,
                paymentMethod: c.paymentMethod,
                amount: parseCurrencyToFloat(c.amount),
                bankAccountId: c.bankAccountId,
              }))
            : undefined,
          supplier: supplier.trim(),
          supplierId: resolvedSupplierId,
          fornecedorId: resolvedSupplierId,
          costCenterId: resolvedCostCenterId || undefined,
          costCenterName: resolvedCostCenterName || undefined,
          machineryId: resolvedMachineryId || undefined,
          machineryName: resolvedMachineryName || undefined,
          cost_center_id: resolvedCostCenterId || null,
          machine_id: resolvedMachineryId || null,
          employeeId: isAlimentacao && singleEmp ? singleEmp.id : undefined,
          employeeName: isAlimentacao ? resolvedEmployeeName : undefined,
          teamId: isAlimentacao ? resolvedTeamId : undefined,
          teamName: isAlimentacao ? resolvedTeamName : undefined,
          employeeApportionment: isAlimentacao ? selectedTargets.join(',') : undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          quantity: isFleetMaintenanceCategory && readingKmOrHours ? parseFloat(readingKmOrHours) : (hasQuantity && quantity ? parseFloat(quantity) / installmentCount : undefined),
          unit: isFleetMaintenanceCategory ? (primaryMachinery?.controlBy === 'km' ? 'km' : 'horas') : (hasQuantity ? unit : undefined),
          unitPrice: hasQuantity && unitPrice ? parseFloat(unitPrice) : undefined,
          receiptUrl: i === 0 ? receiptUrl : undefined,
          receiptName: i === 0 ? receiptName : undefined,
          expense_items: expenseItems.length > 0 ? expenseItems : undefined,
          items: expenseItems.length > 0 ? expenseItems : undefined,
          createdAt: new Date().toISOString(),
        });
      }

      // Sincroniza cada parcela que utilize cartão ou débito
      installments.forEach(inst => {
        const syncRes = syncExpenseWithCardsAndBank(inst, null, effectiveBankAccounts);
        if (onSaveBankAccounts && syncRes.updatedAccounts) {
          onSaveBankAccounts(syncRes.updatedAccounts);
        }
      });

      onSave(installments);
    } else {
      const expenseData: Expense = {
        id: editingExpense ? editingExpense.id : `exp_${Date.now()}`,
        description: effectiveDesc,
        amount: numAmount,
        categoryId: selectedCat?.id || 'geral',
        categoryName: selectedCat?.name || 'Geral',
        categoryColor: selectedCat?.color || '#10b981',
        dueDate: finalDueDate,
        paymentDate: finalPaymentDate,
        status: finalStatus,
        paymentMethod,
        bankAccountId: finalBankAccountId,
        bankAccountName: finalBankAccountName,
        paidByEmployeeId: finalStatus === 'pago' ? selectedPaidByEmpObj?.id : undefined,
        paidByEmployeeName: finalStatus === 'pago' ? selectedPaidByEmpObj?.name : undefined,
        corporateCardId: finalCorporateCardId,
        corporateCardName: finalCorporateCardName,
        checkNumber: isCheckPayment && checkNumber.trim() ? checkNumber.trim() : undefined,
        checkIssuerName: isCheckPayment && checkIssuerName.trim() ? checkIssuerName.trim() : undefined,
        checkIssuerCpf: isCheckPayment && checkIssuerCpf.trim() ? checkIssuerCpf.trim() : undefined,
        checkBank: isCheckPayment && checkBank.trim() ? checkBank.trim() : undefined,
        checkAmount: isCheckPayment && numCheckAmount > 0 ? numCheckAmount : undefined,
        checkChangeAmount: isCheckPayment && checkChangeAmount > 0 ? checkChangeAmount : undefined,
        complementaryPayments: isCheckPayment && complementaryPayments.length > 0
          ? complementaryPayments.map(c => ({
              id: c.id,
              paymentMethod: c.paymentMethod,
              amount: parseCurrencyToFloat(c.amount),
              bankAccountId: c.bankAccountId,
            }))
          : undefined,
        supplier: supplier.trim(),
        supplierId: resolvedSupplierId,
        fornecedorId: resolvedSupplierId,
        costCenterId: resolvedCostCenterId || undefined,
        costCenterName: resolvedCostCenterName || undefined,
        machineryId: resolvedMachineryId || undefined,
        machineryName: resolvedMachineryName || undefined,
        cost_center_id: resolvedCostCenterId || null,
        machine_id: resolvedMachineryId || null,
        employeeId: isAlimentacao && singleEmp ? singleEmp.id : undefined,
        employeeName: isAlimentacao ? resolvedEmployeeName : undefined,
        teamId: isAlimentacao ? resolvedTeamId : undefined,
        teamName: isAlimentacao ? resolvedTeamName : undefined,
        employeeApportionment: isAlimentacao ? selectedTargets.join(',') : undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        quantity: isFleetMaintenanceCategory && readingKmOrHours ? parseFloat(readingKmOrHours) : (hasQuantity && quantity ? parseFloat(quantity) : undefined),
        unit: isFleetMaintenanceCategory ? (primaryMachinery?.controlBy === 'km' ? 'km' : 'horas') : (hasQuantity ? unit : undefined),
        unitPrice: hasQuantity && unitPrice ? parseFloat(unitPrice) : undefined,
        receiptUrl,
        receiptName,
        expense_items: expenseItems.length > 0 ? expenseItems : undefined,
        items: expenseItems.length > 0 ? expenseItems : undefined,
        createdAt: editingExpense ? editingExpense.createdAt : new Date().toISOString(),
      };

      const syncRes = syncExpenseWithCardsAndBank(expenseData, editingExpense, effectiveBankAccounts);
      if (onSaveBankAccounts && syncRes.updatedAccounts) {
        onSaveBankAccounts(syncRes.updatedAccounts);
      }

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

    handleCloseModal();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-2 sm:px-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
        <div
          className="w-full max-w-4xl h-[95vh] flex flex-col mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          style={{ height: '95vh' }}
        >
        
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
            onClick={handleCloseModal}
            className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        {/* Form - Altura Total 95vh com Scroll Interno e Rodapé Fixo */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col bg-[#edf4ff] dark:bg-stone-900 overflow-hidden">
          {/* Bloco de Campos com Rolagem Vertical Reativa */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3.5 space-y-2.5">
          
          {/* LINHA SUPERIOR UNIFICADA: CATEGORIA (50%) + DATA (25%) + VALOR TOTAL (25%) */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">
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

            <div className="col-span-3">
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

            <div className="col-span-3">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                <span>VALOR TOTAL (R$) <span className="text-rose-600">*</span></span>
                {expenseItems.length > 0 && (
                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-700">
                    TRAVADO (SOMA ITENS)
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                readOnly={expenseItems.length > 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="R$ 0,00"
                className={`w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                  expenseItems.length > 0
                    ? 'bg-slate-100 dark:bg-stone-900/90 text-emerald-700 dark:text-emerald-400 cursor-not-allowed border-emerald-300 dark:border-emerald-800'
                    : ''
                }`}
                title={expenseItems.length > 0 ? 'Valor calculado automaticamente pelo somatório dos itens discriminados nesta despesa' : undefined}
              />
            </div>
          </div>

          {/* REFEIÇÃO CONDICIONAL (SE CATEGORIA FOR ALIMENTAÇÃO) */}
          {isAlimentacao && (
            <div className="p-1.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white/70 dark:bg-stone-800/70">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-1">
                TIPO DE REFEIÇÃO
              </label>
              <div className="grid grid-cols-3 gap-1.5 max-w-xs">
                <button
                  type="button"
                  onClick={() => setMealType('cafe')}
                  className={`h-7 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
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
                  className={`h-7 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
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
                  className={`h-7 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
                    mealType === 'janta'
                      ? 'bg-slate-800 text-white border-slate-700 font-bold shadow-xs'
                      : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-50'
                  }`}
                >
                  JANTA
                </button>
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
                          setSupplierId(s.id);
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

          {/* LINHA 3: RESPONSÁVEL PELO PAGAMENTO (100% DA LARGURA) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
              RESPONSÁVEL PELO PAGAMENTO {status === 'pago' && <span className="text-rose-600">*</span>}
            </label>
            <div className="relative">
              <select
                value={paidByEmployeeId}
                onChange={(e) => handlePaidByEmployeeChange(e.target.value)}
                className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase cursor-pointer"
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

          {/* BLOCO CENTRAL DINÂMICO: SE MANUTENÇÃO, BORRACHARIA, ELÉTRICA OU PEÇAS => SELETORES DE FROTA; SE ALIMENTAÇÃO => RATEIO; CASO CONTRÁRIO => OCULTO */}
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
          ) : isAlimentacao ? (
            /* Rateio por Funcionários e Equipes (Seleção Múltipla) - Subcontainer Micro Slim (Exclusivo para Alimentação) */
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
          ) : (
            /* CAMPO OPCIONAL DE VÍNCULO: CENTRO DE CUSTO / MÁQUINA (QUANDO NÃO FOR MANUTENÇÃO DIRETA NEM ALIMENTAÇÃO) */
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                CENTRO DE CUSTO / MÁQUINA (VÍNCULO OPCIONAL)
              </label>
              <div className="relative">
                <select
                  value={
                    machineryId
                      ? `mach_${machineryId}`
                      : costCenterId
                      ? `cc_${costCenterId}`
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setMachineryId('');
                      setCostCenterId('');
                      setReadingKmOrHours('');
                    } else if (val.startsWith('mach_')) {
                      const mId = val.replace('mach_', '');
                      setMachineryId(mId);
                      setCostCenterId('');
                      const mach = availableMachineries.find((m) => m.id === mId);
                      if (mach) {
                        const cur = mach.controlBy === 'km' 
                          ? (mach.currentKm || mach.horimetro_ou_km_atual || '') 
                          : (mach.hourMeter || mach.horimetro_ou_km_atual || '');
                        if (cur) setReadingKmOrHours(String(cur));
                      }
                    } else if (val.startsWith('cc_')) {
                      const cId = val.replace('cc_', '');
                      setCostCenterId(cId);
                      setMachineryId('');
                      setReadingKmOrHours('');
                    }
                  }}
                  className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase cursor-pointer"
                >
                  <option value="">SELECIONE UM CENTRO DE CUSTO / MÁQUINA... (OPCIONAL)</option>
                  {costCenters.length > 0 && (
                    <optgroup label="CENTROS DE CUSTO">
                      {costCenters.map((cc) => (
                        <option key={cc.id} value={`cc_${cc.id}`}>
                          {cc.name.toUpperCase()}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {availableMachineries.length > 0 && (
                    <optgroup label="VEÍCULOS / MÁQUINAS (FROTA)">
                      {availableMachineries.map((m) => (
                        <option key={m.id} value={`mach_${m.id}`}>
                          {(m.licensePlateOrSerial ? `${m.licensePlateOrSerial} · ${m.model || m.name}` : (m.model || m.name)).toUpperCase()}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}


          {/* BLOCO DE LIQUIDAÇÃO / PAGAMENTO: STATUS, FORMA, DATA E CONTA DE DÉBITO (ORIGEM) */}
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                STATUS DO PAGAMENTO
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as ExpenseStatus)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase cursor-pointer"
                >
                  <option value="pendente">A PAGAR (PENDENTE)</option>
                  <option value="pago">PAGO (LIQUIDADO)</option>
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
                  onChange={(e) => handlePaymentMethodChange(e.target.value as PaymentMethod)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase cursor-pointer"
                >
                  <option value="assinado_nota">ASSINADO NOTA</option>
                  <option value="boleto">BOLETO BANCÁRIO</option>
                  <option value="pix">PIX</option>
                  <option value="dinheiro">DINHEIRO EM ESPÉCIE</option>
                  <option value="cartao_credito">CARTÃO DE CRÉDITO</option>
                  <option value="cartao_debito">CARTÃO DE DÉBITO</option>
                  <option value="transferencia">TRANSFERÊNCIA BANCÁRIA (TED/DOC)</option>
                  <option value="cheque">CHEQUE</option>
                  <option value="prazo_carteira">A PRAZO (CARTEIRA)</option>
                  <option value="safra_prazo">SAFRA A PRAZO</option>
                </select>
                <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                DATA EFETIVA DA BAIXA {status === 'pago' ? <span className="text-rose-600 font-bold">*</span> : <span className="text-slate-400 font-normal lowercase">(desabilitado)</span>}
              </label>
              <input
                type="date"
                disabled={status !== 'pago'}
                required={status === 'pago'}
                value={status === 'pago' ? (paymentDate || dueDate) : ''}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={`w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 transition ${
                  status !== 'pago'
                    ? 'bg-slate-100 dark:bg-stone-850 text-slate-400 dark:text-stone-500 cursor-not-allowed border-dashed select-none'
                    : 'bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 cursor-pointer'
                }`}
              />
            </div>

            {/* CONTA DE DÉBITO (ORIGEM) - Ocultada para Dinheiro em Espécie, Assinado Nota e Cheque */}
            {!isCashOrSignedNote && !isCheckPayment && (
              <div className={isCardPayment ? "col-span-6" : "col-span-12"}>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  CONTA DE DÉBITO (ORIGEM) {(status === 'pago' || isCardPayment) ? <span className="text-rose-600 font-bold">* (OBRIGATÓRIO)</span> : <span className="text-slate-400 font-normal lowercase">(desabilitado - nenhum débito realizado)</span>}
                </label>
                <div className="relative">
                  <select
                    value={(status === 'pago' || isCardPayment) ? bankAccountId : ''}
                    onChange={(e) => handleBankAccountChange(e.target.value)}
                    disabled={status !== 'pago' && !isCardPayment}
                    required={status === 'pago' || isCardPayment}
                    className={`w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-7 uppercase transition ${
                      (status !== 'pago' && !isCardPayment)
                        ? 'bg-slate-100 dark:bg-stone-850 text-slate-400 dark:text-stone-500 cursor-not-allowed border-dashed select-none'
                        : 'bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 cursor-pointer'
                    }`}
                  >
                    {(status !== 'pago' && !isCardPayment) ? (
                      <option value="">-- CONTA BLOQUEADA (DESPESA PENDENTE DE PAGAMENTO) --</option>
                    ) : (
                      <>
                        <option value="">-- SELECIONE O BANCO / CONTA --</option>
                        {effectiveBankAccounts.map((acc) => {
                          const name = (acc.name || acc.accountName || '').trim();
                          const bank = (acc.bankName || '').trim();
                          const cleanLabel = name && bank && name.toUpperCase() !== bank.toUpperCase()
                            ? `${name} · ${bank}`
                            : (name || bank || 'CONTA BANCÁRIA');
                          return (
                            <option key={acc.id} value={acc.id} className="uppercase">
                              {cleanLabel.toUpperCase()}
                            </option>
                          );
                        })}
                      </>
                    )}
                  </select>
                  <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* CAMPO CONDICIONAL: SELECIONAR CARTÃO CORPORATIVO (INTERFACE REATIVA - PRINT 1) */}
            {isCardPayment && (
              <div className="col-span-6 animate-in fade-in">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    SELECIONAR CARTÃO CORPORATIVO <span className="text-rose-600 font-bold">*</span>
                  </span>
                  {selectedCard && (
                    <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                      Disp: {formatCurrencyBRL(Math.max(0, selectedCard.totalLimit - selectedCard.usedLimit))}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={corporateCardId}
                    onChange={(e) => handleCorporateCardChange(e.target.value)}
                    required
                    className="w-full px-2.5 h-7.5 rounded-md border border-blue-400 dark:border-blue-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none pr-7 cursor-pointer"
                  >
                    {availableCards.length === 0 ? (
                      <option value="">-- NENHUM CARTÃO VINCULADO A ESTA CONTA --</option>
                    ) : (
                      <>
                        <option value="">-- SELECIONE O CARTÃO CORPORATIVO * --</option>
                        {availableCards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {formatCorporateCardDisplay(card, selectedAccount)}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <ChevronDown className="w-3 h-3 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* NOTIFICAÇÃO DE REGRA FINANCEIRA AUTOMATIZADA POR TIPO DE CARTÃO */}
            {isCardPayment && (
              <div className="col-span-12">
                {paymentMethod === 'cartao_credito' ? (
                  <div className="flex items-center justify-between text-[10px] bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-md px-2.5 py-1 text-purple-900 dark:text-purple-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>
                        Fatura Aberta: O valor será lançado no Limite Utilizado do cartão. Saldo em conta não é debitado imediatamente.
                      </span>
                    </span>
                    {selectedCard && (
                      <span className="font-mono font-bold text-purple-700 dark:text-purple-300 shrink-0">
                        Vencimento da Fatura: {formatDateBR(calculateCardInvoiceDueDate(selectedCard.dueDay || 10))}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-md px-2.5 py-1 text-emerald-900 dark:text-emerald-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        Cartão de Débito: Baixa imediata de {formatCurrencyBRL(parseFloat(amount) || 0)} no saldo da conta com lançamento no extrato bancário.
                      </span>
                    </span>
                    <span className="font-bold text-emerald-800 dark:text-emerald-400 shrink-0 uppercase">
                      Débito Imediato em Conta
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* SUBFORMULÁRIO DINÂMICO PARA PAGAMENTO EM CHEQUE */}
            {isCheckPayment && (
              <div className="col-span-12 p-3 rounded-lg border border-amber-300 dark:border-amber-800/70 bg-gradient-to-br from-amber-50/60 to-orange-50/30 dark:from-stone-900 dark:to-stone-850 space-y-3 animate-in fade-in">
                {/* Cabeçalho do Bloco de Cheque */}
                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200 dark:border-amber-900/50">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-amber-900 dark:text-amber-300">
                      EMISSÃO E DADOS DO CHEQUE
                    </span>
                  </div>
                  {numAmount > 0 && (
                    <span className="text-[10px] font-semibold text-stone-600 dark:text-stone-400">
                      Total da Despesa: <strong className="font-mono text-stone-900 dark:text-stone-100">{formatCurrencyBRL(numAmount)}</strong>
                    </span>
                  )}
                </div>

                {/* Grid dos Campos do Cheque */}
                <div className="grid grid-cols-12 gap-2">
                  {/* Número do Cheque * (Obrigatório) */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider mb-0.5">
                      NÚMERO DO CHEQUE <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required={isCheckPayment}
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value.toUpperCase())}
                      placeholder="Ex: 000124"
                      className="w-full px-2.5 h-7.5 rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase tracking-wider"
                    />
                  </div>

                  {/* Valor do Cheque * (Obrigatório) */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider mb-0.5">
                      VALOR DO CHEQUE (R$) <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required={isCheckPayment}
                      value={checkAmount}
                      onChange={(e) => setCheckAmount(maskCurrencyLive(e.target.value))}
                      placeholder="R$ 0,00"
                      className="w-full px-2.5 h-7.5 rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-black font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Banco do Cheque (Opcional) */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider mb-0.5">
                      BANCO DO CHEQUE <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={checkBank}
                      onChange={(e) => setCheckBank(e.target.value.toUpperCase())}
                      placeholder="Ex: SICREDI, BB, BRADESCO..."
                      className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
                    />
                  </div>

                  {/* Nome do Emitente (Opcional) */}
                  <div className="col-span-12 sm:col-span-7">
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider mb-0.5">
                      NOME DO EMITENTE <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={checkIssuerName}
                      onChange={(e) => setCheckIssuerName(e.target.value.toUpperCase())}
                      placeholder="Ex: NOME DO TITULAR DA FOLHA DE CHEQUE"
                      className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
                    />
                  </div>

                  {/* CPF / CNPJ do Emitente (Opcional) */}
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wider mb-0.5">
                      CPF / CNPJ DO EMITENTE <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={checkIssuerCpf}
                      onChange={(e) => setCheckIssuerCpf(formatCpfCnpj(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={18}
                      className="w-full px-2.5 h-7.5 rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* CASO 1: VALOR DO CHEQUE MAIOR QUE A DESPESA (TROCO EM DINHEIRO) */}
                {checkChangeAmount > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Troco em Dinheiro:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                        (Valor do Cheque {formatCurrencyBRL(numCheckAmount)} - Total {formatCurrencyBRL(numAmount)})
                      </span>
                      <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60">
                        {formatCurrencyBRL(checkChangeAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* CASO 2: VALOR DO CHEQUE MENOR QUE A DESPESA (PAGAMENTO MISTO / COMPLEMENTAR) */}
                {isCheckUnderpaid && (
                  <div className="p-3 rounded-md bg-orange-50/70 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-800/60 space-y-2.5 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-orange-200 dark:border-orange-900/40 pb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-orange-900 dark:text-orange-200">
                        <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        <span>Pagamento Misto: Cheque Parcial ({formatCurrencyBRL(numCheckAmount)})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase text-stone-700 dark:text-stone-300">
                          Saldo a Distribuir:
                        </span>
                        <span
                          className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                            saldoADistribuir > 0.009
                              ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {formatCurrencyBRL(saldoADistribuir)}
                        </span>
                      </div>
                    </div>

                    {/* Linhas de Formas Complementares */}
                    {complementaryPayments.length > 0 && (
                      <div className="space-y-2">
                        {complementaryPayments.map((comp, idx) => {
                          const requiresAcc = comp.paymentMethod !== 'dinheiro';
                          return (
                            <div
                              key={comp.id}
                              className="grid grid-cols-12 gap-2 items-center bg-white dark:bg-stone-850 p-2 rounded border border-orange-200 dark:border-stone-700"
                            >
                              <div className="col-span-12 sm:col-span-4">
                                <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">
                                  Forma Complementar #{idx + 1}
                                </label>
                                <select
                                  value={comp.paymentMethod}
                                  onChange={(e) =>
                                    handleUpdateComplementaryPayment(comp.id, 'paymentMethod', e.target.value as PaymentMethod)
                                  }
                                  className="w-full px-2 h-7 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold uppercase text-slate-800 dark:text-stone-200 focus:outline-none"
                                >
                                  <option value="pix">PIX</option>
                                  <option value="dinheiro">DINHEIRO EM ESPÉCIE</option>
                                  <option value="cartao_debito">CARTÃO DE DÉBITO</option>
                                  <option value="transferencia">TRANSFERÊNCIA (TED)</option>
                                  <option value="boleto">BOLETO BANCÁRIO</option>
                                </select>
                              </div>

                              <div className="col-span-12 sm:col-span-3">
                                <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">
                                  Valor (R$)
                                </label>
                                <input
                                  type="text"
                                  value={comp.amount}
                                  onChange={(e) =>
                                    handleUpdateComplementaryPayment(comp.id, 'amount', e.target.value)
                                  }
                                  placeholder="R$ 0,00"
                                  className="w-full px-2 h-7 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black font-mono text-slate-900 dark:text-stone-100 focus:outline-none"
                                />
                              </div>

                              <div className="col-span-10 sm:col-span-4">
                                <label className="block text-[9px] font-bold text-stone-500 uppercase mb-0.5">
                                  {requiresAcc ? 'Conta Débito' : 'Espécie (Sem Conta)'}
                                </label>
                                {requiresAcc ? (
                                  <select
                                    value={comp.bankAccountId || ''}
                                    onChange={(e) =>
                                      handleUpdateComplementaryPayment(comp.id, 'bankAccountId', e.target.value)
                                    }
                                    className="w-full px-2 h-7 rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-[11px] font-semibold uppercase text-slate-800 dark:text-stone-200 focus:outline-none"
                                  >
                                    <option value="">-- SELECIONE CONTA --</option>
                                    {effectiveBankAccounts.map((acc) => (
                                      <option key={acc.id} value={acc.id}>
                                        {(acc.name || acc.accountName || acc.bankName || 'Conta').toUpperCase()}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="h-7 px-2 flex items-center bg-slate-100 dark:bg-stone-800 rounded text-[10px] text-slate-500 italic">
                                    Pagamento direto em mãos
                                  </div>
                                )}
                              </div>

                              <div className="col-span-2 sm:col-span-1 flex justify-end pt-3 sm:pt-3.5">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveComplementaryPayment(comp.id)}
                                  className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Remover forma complementar"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleAddComplementaryPayment}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold uppercase transition cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3 h-3" />
                        ADICIONAR FORMA COMPLEMENTAR
                      </button>

                      {saldoADistribuir > 0.009 && (
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          Complete os pagamentos para zerar o saldo
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
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

          {/* SEÇÃO: ITENS / PRODUTOS LANÇADOS NESTA DESPESA */}
          <div className="w-full rounded-lg border border-slate-300 dark:border-stone-700 bg-slate-50/70 dark:bg-stone-850 p-2.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-700 dark:text-stone-300" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-stone-200 uppercase tracking-wide">
                  ITENS / PRODUTOS LANÇADOS NESTA DESPESA
                </span>
                {expenseItems.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-600 dark:text-stone-300 bg-white dark:bg-stone-700 px-1.5 py-0.2 rounded border border-slate-200 dark:border-stone-600">
                    {expenseItems.length} {expenseItems.length === 1 ? 'item' : 'itens'}
                  </span>
                )}
              </div>
              {expenseItems.length > 0 && (
                <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                  TOTAL ITENS: {formatCurrencyBRL(expenseItems.reduce((acc, it) => acc + ((it.quantity || 0) * (it.unit_value || 0)), 0))}
                </div>
              )}
            </div>

            {/* Linha de Inclusão Rápida */}
            <div className="grid grid-cols-12 gap-1.5 items-end bg-white dark:bg-stone-800 p-2 rounded-md border border-slate-200 dark:border-stone-700">
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-[9px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  Item / Descrição do Gasto
                </label>
                <input
                  type="text"
                  placeholder="Ex: Filtro de Óleo, Marmita Equipe..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  className="w-full h-7.5 px-2 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-700 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase placeholder:normal-case"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="block text-[9px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  Qtd
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="1"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddItem();
                    }
                  }}
                  className="w-full h-7.5 px-2 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-700 text-slate-900 dark:text-stone-100 text-xs font-semibold text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="col-span-4 sm:col-span-3">
                <label className="block text-[9px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  Valor Unit. (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                    R$
                  </span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={itemUnitValue}
                    onChange={(e) => setItemUnitValue(maskCurrencyLive(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItem();
                      }
                    }}
                    className="w-full h-7.5 pl-7 pr-2 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-700 text-slate-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="col-span-4 sm:col-span-2 flex items-center">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full h-7.5 px-2 rounded bg-[#059669] hover:bg-emerald-700 active:bg-emerald-800 text-white text-[11px] font-bold uppercase transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  title="Inserir item na despesa"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">+ INSERIR</span>
                </button>
              </div>
            </div>

            {/* Tabela Dinâmica de Listagem Interna */}
            {expenseItems.length === 0 ? (
              <div className="py-2.5 px-3 text-center rounded border border-dashed border-slate-300 dark:border-stone-700 text-[11px] text-slate-500 dark:text-stone-400">
                Nenhum item discriminado. Adicione itens acima para discriminar produtos/serviços e calcular automaticamente o valor total.
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-stone-700 bg-white dark:bg-stone-850">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-200 dark:border-stone-700 text-[10px] font-bold text-slate-600 dark:text-stone-400 uppercase tracking-wider">
                      <th className="py-1 px-2.5">Item / Descrição</th>
                      <th className="py-1 px-2 text-center w-16">Qtd</th>
                      <th className="py-1 px-2 text-right w-28">Valor Unit. (R$)</th>
                      <th className="py-1 px-2 text-right w-28">Valor Total (R$)</th>
                      <th className="py-1 px-2 text-center w-12">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-stone-800">
                    {expenseItems.map((item, idx) => {
                      const totalItemVal = (item.quantity || 0) * (item.unit_value || 0);
                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-stone-800/50 transition">
                          <td className="py-1.5 px-2.5 font-medium text-slate-900 dark:text-stone-100 uppercase">
                            {item.description}
                          </td>
                          <td className="py-1.5 px-2 text-center font-semibold text-slate-700 dark:text-stone-300">
                            {item.quantity}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-700 dark:text-stone-300">
                            {formatCurrencyBRL(item.unit_value)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrencyBRL(totalItemVal)}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="w-6 h-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-stone-800/80 border-t border-slate-200 dark:border-stone-700 font-bold text-xs">
                      <td colSpan={3} className="py-1.5 px-2.5 text-right uppercase text-slate-700 dark:text-stone-300">
                        Total Geral dos Itens:
                      </td>
                      <td className="py-1.5 px-2 text-right font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatCurrencyBRL(expenseItems.reduce((acc, it) => acc + ((it.quantity || 0) * (it.unit_value || 0)), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          </div>

          {/* Botões de Ação - Rodapé 3D Compacto Fixo */}
          <div className="px-3.5 py-2 border-t border-slate-300 dark:border-stone-800 bg-slate-100 dark:bg-stone-850 flex items-center justify-end space-x-2 shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-3.5 py-1 rounded-md bg-gradient-to-b from-slate-100 to-slate-200 hover:from-white hover:to-slate-100 border border-slate-300 text-slate-700 text-xs font-bold uppercase shadow-[inset_0_1px_0px_rgba(255,255,255,0.8)] transition cursor-pointer"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={isCheckPayment && isCheckUnderpaid && saldoADistribuir > 0.009}
              title={
                isCheckPayment && isCheckUnderpaid && saldoADistribuir > 0.009
                  ? `Saldo restante de ${formatCurrencyBRL(saldoADistribuir)} a distribuir antes de salvar.`
                  : undefined
              }
              className={`px-4 py-1 rounded-md text-white text-xs font-bold uppercase transition shadow-xs ${
                isCheckPayment && isCheckUnderpaid && saldoADistribuir > 0.009
                  ? 'bg-slate-400 dark:bg-stone-700 cursor-not-allowed opacity-60'
                  : 'bg-[#059669] hover:bg-emerald-700 cursor-pointer'
              }`}
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
          setSupplierId(newSup.id);
          setIsSupplierModalOpen(false);
        }}
      />
    )}
  </>
  );
};
