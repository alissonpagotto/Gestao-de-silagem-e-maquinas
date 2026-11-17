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
  Settings,
} from 'lucide-react';
import { Expense, ExpenseCategory, CostCenter, Machinery, ExpenseStatus, PaymentMethod, Employee, FleetTeam, Supplier, BankAccount, MaintenanceLog, ExpenseItem, CorporateCard } from '../../types';
import { INITIAL_CATEGORIES } from '../../lib/initialData';
import { getStoredMaintenanceLogs, saveStoredMaintenanceLogs, getStoredMachineries, saveStoredMachineries, getStoredBankAccounts, getStoredSuppliers, saveStoredSuppliers, ensureSequentialSupplierCodes } from '../../lib/storage';
import { formatCurrencyBRL, maskCurrencyLive, parseCurrencyToFloat, calculateCardInvoiceDueDate, formatDateBR, formatCpfCnpj, formatCurrencyInputDisplay } from '../../lib/formatters';
import { formatCorporateCardDisplay, syncExpenseWithCardsAndBank } from '../../lib/cardFinancialSync';
import { ExpenseCategoriesModal } from './ExpenseCategoriesModal';
import { SupplierModal } from '../suppliers/SupplierModal';
import { useModalUnsavedGuard } from '../../lib/modalUnsavedGuard';
import {
  useGlobalPaymentMethods,
  getPaymentMethodKey,
  getGlobalPaymentMethodLabel,
} from '../../lib/paymentMethodsStorage';
import { PaymentMethodsManagerModal } from '../common/PaymentMethodsManager';

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
  const [isPaymentMethodsManagerOpen, setIsPaymentMethodsManagerOpen] = useState(false);
  const { activeMethods: activeGlobalPaymentMethods } = useGlobalPaymentMethods();

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
  const formScrollRef = useRef<HTMLFormElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(() => {
    const stored = getStoredSuppliers();
    const base = Array.isArray(suppliers) && suppliers.length > 0 ? suppliers : stored;
    return ensureSequentialSupplierCodes(Array.isArray(base) ? base : []).items;
  });

  useEffect(() => {
    const stored = getStoredSuppliers();
    const mergedMap = new Map<string, Supplier>();
    [...(Array.isArray(stored) ? stored : []), ...(Array.isArray(suppliers) ? suppliers : [])].forEach((s) => {
      if (s && s.id) mergedMap.set(s.id, s);
    });
    setLocalSuppliers(ensureSequentialSupplierCodes(Array.from(mergedMap.values())).items);
  }, [suppliers, isOpen]);

  useEffect(() => {
    const handleSuppliersUpdated = (e?: Event) => {
      const detail = (e as CustomEvent | undefined)?.detail;
      const source = Array.isArray(detail) ? detail : getStoredSuppliers();
      setLocalSuppliers(ensureSequentialSupplierCodes(Array.isArray(source) ? source : []).items);
    };
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'agrocontrol_fornecedores' || e.key.includes('suppliers')) {
        handleSuppliersUpdated();
      }
    };
    window.addEventListener('agrocontrol_fornecedores_updated', handleSuppliersUpdated);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('agrocontrol_fornecedores_updated', handleSuppliersUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const [costCenterId, setCostCenterId] = useState('');
  const [machineryId, setMachineryId] = useState('');
  const [readingKmOrHours, setReadingKmOrHours] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [mealType, setMealType] = useState<'cafe' | 'almoco' | 'janta'>('almoco');
  
  // Apportionment multi-targets (exclusive employee IDs; legacy team/group IDs preserved only when editing old records)
  const [enableApportionment, setEnableApportionment] = useState<boolean>(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [employeeRateioSearch, setEmployeeRateioSearch] = useState<string>('');

  // Grade discriminada de produtos / itens da despesa
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [itemDescription, setItemDescription] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<string>('1');
  const [itemUnitValue, setItemUnitValue] = useState<string>('');

  const handleAddItem = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const desc = itemDescription.trim();
    if (!desc) {
      setFormError('Por favor, informe a descrição do item / gasto.');
      formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const cleanQtyStr = itemQuantity.replace(',', '.');
    const qty = parseFloat(cleanQtyStr);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Por favor, informe uma quantidade válida maior que zero.');
      formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const unitVal = parseCurrencyToFloat(itemUnitValue);
    if (unitVal <= 0) {
      setFormError('Por favor, informe um valor unitário válido (R$).');
      formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setFormError(null);

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
    setEnableApportionment(false);
    setSelectedTargets([]);
    setEmployeeRateioSearch('');
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
    setFormError(null);
  }, [safeCategories, today, priorityBankAccountId]);

  const expenseGuard = useModalUnsavedGuard({
    isOpen,
    resetKey: editingExpense?.id || (isOpen ? 'new' : 'closed'),
    snapshot: [
      supplierId,
      supplier,
      amount,
      categoryId,
      dueDate,
      paymentDate,
      status,
      paymentMethod,
      bankAccountId,
      corporateCardId,
      paidByEmployeeId,
      costCenterId,
      machineryId,
      readingKmOrHours,
      invoiceNumber,
      notes,
      mealType,
      enableApportionment,
      selectedTargets,
      expenseItems,
      hasQuantity,
      quantity,
      unit,
      unitPrice,
      isInstallment,
      installmentCount,
      receiptName,
      checkNumber,
      checkIssuerName,
      checkIssuerCpf,
      checkBank,
      checkAmount,
      complementaryPayments,
    ],
  });

  const handleImmediateClose = useCallback(() => {
    setFormError(null);
    setIsSupplierDropdownOpen(false);
    expenseGuard.resetDirty();
    resetFormState();
    onClose();
  }, [expenseGuard, resetFormState, onClose]);

  const handleCloseModal = handleImmediateClose;

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

      if (editingExpense.employeeApportionment && editingExpense.employeeApportionment.trim()) {
        const parts = editingExpense.employeeApportionment.split(',').map((s) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          setEnableApportionment(true);
          setSelectedTargets(parts);
        } else {
          setEnableApportionment(false);
          setSelectedTargets([]);
        }
      } else if (editingExpense.employeeId) {
        setEnableApportionment(true);
        setSelectedTargets([editingExpense.employeeId]);
      } else if (editingExpense.teamId) {
        setEnableApportionment(true);
        setSelectedTargets([editingExpense.teamId]);
      } else if (editingExpense.employeeName && editingExpense.employeeName.trim()) {
        setEnableApportionment(true);
        setSelectedTargets(['todos']);
      } else {
        setEnableApportionment(false);
        setSelectedTargets([]);
      }
      setEmployeeRateioSearch('');
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

  const filteredSuppliers = localSuppliers.filter((s) => {
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

  const handleToggleEmployeeTarget = (empId: string) => {
    const cleaned = selectedTargets.filter((t) => t !== 'todos');
    const exists = cleaned.includes(empId);
    const nextTargets = exists
      ? cleaned.filter((t) => t !== empId)
      : [...cleaned, empId];
    setSelectedTargets(nextTargets);

    if (!exists) {
      if (!machineryId && !costCenterId) {
        const linkedVeh = getLinkedVehicleForEmployee(empId);
        if (linkedVeh) {
          setMachineryId(linkedVeh.id);
          setCostCenterId('');
        }
      }
    } else if (!costCenterId) {
      const removedVeh = getLinkedVehicleForEmployee(empId);
      if (removedVeh && machineryId === removedVeh.id) {
        const nextLinked = nextTargets
          .map((id) => getLinkedVehicleForEmployee(id))
          .find(Boolean);
        setMachineryId(nextLinked ? nextLinked.id : '');
      }
    }
  };

  const handleRemoveTarget = (idToRemove: string) => {
    const remaining = selectedTargets.filter((t) => t !== idToRemove);
    setSelectedTargets(remaining);
    if (!costCenterId) {
      const removedVeh = getLinkedVehicleForEmployee(idToRemove);
      if (removedVeh && machineryId === removedVeh.id) {
        const nextLinked = remaining
          .map((id) => getLinkedVehicleForEmployee(id))
          .find(Boolean);
        setMachineryId(nextLinked ? nextLinked.id : '');
      }
    }
  };

  const filteredRateioEmployees = useMemo(() => {
    const q = employeeRateioSearch.trim().toLowerCase();
    if (!q) return activeEmployees;
    return activeEmployees.filter((emp) => {
      const empVeh = getLinkedVehicleForEmployee(emp.id);
      const vehLabel = empVeh
        ? `${empVeh.licensePlateOrSerial || ''} ${empVeh.plate || ''} ${empVeh.model || ''} ${empVeh.name || ''}`.toLowerCase()
        : '';
      return (
        (emp.name || '').toLowerCase().includes(q) ||
        (emp.role || '').toLowerCase().includes(q) ||
        vehLabel.includes(q)
      );
    });
  }, [activeEmployees, employeeRateioSearch, getLinkedVehicleForEmployee]);

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

  // Linked machineries inferred automatically from resolved employees
  const linkedMachineries: Machinery[] = [];
  const linkedMachIdSet = new Set<string>();

  resolvedUniqueEmployees.forEach((emp) => {
    const m = getLinkedVehicleForEmployee(emp.id);
    if (m && !linkedMachIdSet.has(m.id)) {
      linkedMachIdSet.add(m.id);
      linkedMachineries.push(m);
    }
  });

  resolvedTargetTeams.forEach((t) => {
    if (t.machineryId) {
      const m = availableMachineries.find((mach) => mach.id === t.machineryId);
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

  const primaryTeam = resolvedTargetTeams[0];
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
    setFormError(null);

    const showValidationError = (msg: string) => {
      setFormError(msg);
      formScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!dueDate) {
      showValidationError('Por favor, informe a data de vencimento / lançamento.');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      showValidationError('Por favor, informe um valor válido para a despesa.');
      return;
    }

    if (isFleetMaintenanceCategory && !machineryId) {
      showValidationError('POR FAVOR, SELECIONE O VEÍCULO / MÁQUINA DA FROTA PARA O VÍNCULO DE MANUTENÇÃO.');
      return;
    }

    if (isCheckPayment) {
      if (!checkNumber.trim()) {
        showValidationError('POR FAVOR, INFORME O NÚMERO DO CHEQUE.');
        return;
      }
      if (numCheckAmount <= 0) {
        showValidationError('POR FAVOR, INFORME O VALOR DO CHEQUE (R$).');
        return;
      }
      if (isCheckUnderpaid && saldoADistribuir > 0.009) {
        showValidationError(`EXISTE UM SALDO RESTANTE DE ${formatCurrencyBRL(saldoADistribuir)} A DISTRIBUIR. ADICIONE UMA FORMA COMPLEMENTAR DE PAGAMENTO (EX: PIX OU DINHEIRO) ATÉ ZERAR O SALDO.`);
        return;
      }
      for (const comp of complementaryPayments) {
        const compVal = parseCurrencyToFloat(comp.amount);
        if (compVal <= 0) {
          showValidationError('POR FAVOR, INFORME UM VALOR VÁLIDO PARA CADA FORMA COMPLEMENTAR.');
          return;
        }
      }
    }

    if (status === 'pago' && !bankAccountId && !isCardPayment && !isCashOrSignedNote && !isCheckPayment) {
      showValidationError('POR FAVOR, SELECIONE A CONTA DE DÉBITO (ORIGEM) PARA A DESPESA PAGA.');
      return;
    }

    if (isCardPayment) {
      if (!bankAccountId) {
        showValidationError('POR FAVOR, SELECIONE A CONTA BANCÁRIA VINCULADA AO CARTÃO.');
        return;
      }
      if (!corporateCardId) {
        showValidationError('POR FAVOR, SELECIONE O CARTÃO CORPORATIVO UTILIZADO.');
        return;
      }
    }

    const selectedCat = safeCategories.find((c) => c.id === categoryId) || safeCategories[0];

    const matchedSupplier = localSuppliers.find(
      (s) => (supplierId && s.id === supplierId) || (s.name && s.name.trim().toLowerCase() === supplier.trim().toLowerCase())
    );
    const resolvedSupplierId = supplierId || matchedSupplier?.id || undefined;
    const effectiveDesc = supplier.trim() || 
      (editingExpense?.description ? editingExpense.description : (isAlimentacao ? `Refeição (${mealType === 'cafe' ? 'Café da Manhã' : mealType === 'almoco' ? 'Almoço' : 'Janta'})` : selectedCat?.name || 'Despesa Operacional'));

    const shouldApplyApportionment = enableApportionment && !isFleetMaintenanceCategory && selectedTargets.length > 0;
    const singleEmp = shouldApplyApportionment && selectedTargets.length === 1 && activeEmployees.some((e) => e.id === selectedTargets[0])
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
          employeeId: shouldApplyApportionment && singleEmp ? singleEmp.id : undefined,
          employeeName: shouldApplyApportionment && resolvedEmployeeName ? resolvedEmployeeName : undefined,
          teamId: shouldApplyApportionment ? resolvedTeamId : undefined,
          teamName: shouldApplyApportionment ? resolvedTeamName : undefined,
          employeeApportionment: shouldApplyApportionment ? selectedTargets.join(',') : undefined,
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
        employeeId: shouldApplyApportionment && singleEmp ? singleEmp.id : undefined,
        employeeName: shouldApplyApportionment && resolvedEmployeeName ? resolvedEmployeeName : undefined,
        teamId: shouldApplyApportionment ? resolvedTeamId : undefined,
        teamName: shouldApplyApportionment ? resolvedTeamName : undefined,
        employeeApportionment: shouldApplyApportionment ? selectedTargets.join(',') : undefined,
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

    handleImmediateClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div id="modal-nova-despesa" className="fixed inset-0 z-50 flex items-center justify-center px-2 sm:px-4 bg-black/60 overflow-hidden" style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}>
        <div
          className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
        
        {/* Seção 1: Cabeçalho Fixo */}
        <div className="shrink-0 relative z-30 px-3.5 py-2 border-b border-black bg-[#cad4e6] text-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center border border-black shadow-2xs shrink-0">
              <Receipt className="w-3.5 h-3.5 text-slate-800" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-black">
                {editingExpense ? 'EDITAR DESPESA' : 'NOVA DESPESA'}
              </h2>
              <p className="text-[10px] text-slate-800 font-medium uppercase mt-0.5">
                LANÇAMENTO FINANCEIRO, RATEIO E CENTRO DE CUSTO
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleImmediateClose}
            className="p-1 rounded-md text-slate-800 hover:text-black hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-black" />
          </button>
        </div>

        {/* Seção 2: Corpo Rolável */}
        <form
          id="expense-modal-form"
          ref={formScrollRef}
          noValidate
          onSubmit={handleSubmit}
          {...expenseGuard.captureProps}
          className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 sm:p-3.5 space-y-2.5 bg-[#cad4e6] text-black"
        >
          {formError && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-rose-700 bg-rose-100 text-rose-900 text-xs font-bold uppercase shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
                <span className="truncate sm:whitespace-normal">{formError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="p-0.5 rounded hover:bg-rose-200 text-rose-800 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          
          {/* BLOCO 1 (CARD): CATEGORIA (50%) + DATA (25%) + VALOR TOTAL (25%) */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-2.5 grid grid-cols-12 gap-2 shadow-2xs">
            <div className="col-span-6">
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider">
                  CATEGORIA <span className="text-rose-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="inline-flex items-center space-x-1 text-[9px] font-bold text-black hover:bg-slate-100 px-1.5 py-0.5 rounded bg-white transition cursor-pointer border border-gray-400 uppercase"
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
                    className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] appearance-none pr-7 uppercase cursor-pointer"
                  >
                    {safeCategories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="uppercase">
                        {cat.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="w-7.5 h-7.5 shrink-0 rounded-md bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center transition border border-black cursor-pointer"
                  title="Incluir nova categoria ou gerenciar existentes"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="col-span-3">
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                DATA <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
              />
            </div>

            <div className="col-span-3">
              <label className="text-[10px] font-bold text-black uppercase tracking-wider mb-0.5 flex flex-wrap items-center justify-between gap-1">
                <span>VALOR TOTAL (R$) <span className="text-rose-600">*</span></span>
                {expenseItems.length > 0 && (
                  <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-400">
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
                className={`w-full px-2.5 h-7.5 rounded-md border border-gray-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#0963cb] ${
                  expenseItems.length > 0
                    ? 'bg-gray-100 text-emerald-800 cursor-not-allowed'
                    : 'bg-white text-black'
                }`}
                title={expenseItems.length > 0 ? 'Valor calculado automaticamente pelo somatório dos itens discriminados nesta despesa' : undefined}
              />
            </div>
          </div>

          {/* REFEIÇÃO CONDICIONAL (SE CATEGORIA FOR ALIMENTAÇÃO) */}
          {isAlimentacao && (
            <div className="p-2.5 rounded-xl border border-black bg-[#e0e6f1] shadow-2xs">
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1">
                TIPO DE REFEIÇÃO
              </label>
              <div className="grid grid-cols-3 gap-1.5 max-w-xs">
                <button
                  type="button"
                  onClick={() => setMealType('cafe')}
                  className={`h-7 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
                    mealType === 'cafe'
                      ? 'bg-slate-800 text-white border-black font-bold shadow-xs'
                      : 'bg-white border-gray-400 text-black hover:bg-slate-100'
                  }`}
                >
                  CAFÉ
                </button>
                <button
                  type="button"
                  onClick={() => setMealType('almoco')}
                  className={`h-7 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
                    mealType === 'almoco'
                      ? 'bg-slate-800 text-white border-black font-bold shadow-xs'
                      : 'bg-white border-gray-400 text-black hover:bg-slate-100'
                  }`}
                >
                  ALMOÇO
                </button>
                <button
                  type="button"
                  onClick={() => setMealType('janta')}
                  className={`h-7 px-1.5 text-xs font-bold uppercase rounded-md border transition cursor-pointer ${
                    mealType === 'janta'
                      ? 'bg-slate-800 text-white border-black font-bold shadow-xs'
                      : 'bg-white border-gray-400 text-black hover:bg-slate-100'
                  }`}
                >
                  JANTA
                </button>
              </div>
            </div>
          )}

          {/* BLOCO 2 (CARD): IDENTIFICAÇÃO — FORNECEDOR, RESPONSÁVEL PELO PAGAMENTO E CENTRO DE CUSTO / MÁQUINA */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-2.5 space-y-2 shadow-2xs">
            {/* FORNECEDOR */}
            <div ref={supplierContainerRef} className="relative">
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                FORNECEDOR
              </label>
              <div className="flex items-center space-x-1">
                <div className="relative flex-1">
                  <Search className="w-3 h-3 text-slate-600 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="BUSCAR FORNECEDOR CADASTRADO..."
                    value={supplier}
                    onChange={(e) => {
                      setSupplier(e.target.value);
                      setIsSupplierDropdownOpen(true);
                    }}
                    onFocus={() => setIsSupplierDropdownOpen(true)}
                    className="w-full pl-7 pr-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase placeholder:uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSupplierModalOpen(true);
                    setIsSupplierDropdownOpen(false);
                  }}
                  className="w-7.5 h-7.5 rounded-md border border-gray-400 bg-white hover:bg-slate-100 text-black flex items-center justify-center transition cursor-pointer shrink-0"
                  title="Cadastrar Novo Fornecedor"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Dropdown Lista de Fornecedores */}
              {isSupplierDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white border border-black rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {filteredSuppliers.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {filteredSuppliers.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSupplier(s.name);
                            setSupplierId(s.id);
                            setIsSupplierDropdownOpen(false);
                          }}
                          className="p-1.5 hover:bg-slate-100 cursor-pointer transition flex flex-col justify-center text-left group uppercase"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-black text-xs">
                              {s.name.toUpperCase()}
                            </span>
                            {s.category && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 border border-gray-300 text-slate-700 font-medium shrink-0">
                                {s.category.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-600 flex items-center gap-1.5 mt-0.5">
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
                    <div className="p-2 text-xs text-slate-600 text-center uppercase">
                      Nenhum fornecedor cadastrado com esse termo.
                    </div>
                  )}

                  {/* Opção de Cadastrar Novo Fornecedor */}
                  <div className="border-t border-black/20 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSupplierModalOpen(true);
                        setIsSupplierDropdownOpen(false);
                      }}
                      className="w-full p-1.5 flex items-center space-x-1.5 text-black hover:bg-slate-100 text-xs font-semibold transition cursor-pointer text-left uppercase"
                    >
                      <Plus className="w-3 h-3 text-black" />
                      <span>+ CADASTRAR NOVO FORNECEDOR</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* LINHA 3: RESPONSÁVEL PELO PAGAMENTO (100% DA LARGURA) */}
            <div>
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                RESPONSÁVEL PELO PAGAMENTO {status === 'pago' && <span className="text-rose-600">*</span>}
              </label>
              <div className="relative">
                <select
                  value={paidByEmployeeId}
                  onChange={(e) => handlePaidByEmployeeChange(e.target.value)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] appearance-none pr-7 uppercase cursor-pointer"
                >
                  <option value="">-- SELECIONE O COLABORADOR --</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="uppercase">
                      {emp.name.toUpperCase()} {emp.role ? `(${emp.role.toUpperCase()})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* CAMPO OPCIONAL DE VÍNCULO: CENTRO DE CUSTO / MÁQUINA (QUANDO NÃO FOR MANUTENÇÃO DIRETA) */}
            {!isFleetMaintenanceCategory && (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
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
                    className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] appearance-none pr-7 uppercase cursor-pointer"
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
                  <ChevronDown className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* BLOCO CENTRAL DINÂMICO (CARD CONDICIONAL): MANUTENÇÃO & FROTAS OU RATEIO ALIMENTAÇÃO */}
          {isFleetMaintenanceCategory ? (
            <div className="border border-black rounded-xl p-2.5 bg-[#e0e6f1] shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3 h-3 text-amber-600" />
                  <span>VÍNCULO DE MANUTENÇÃO & FROTAS</span>
                </label>
                <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-400 px-1.5 py-0.2 rounded uppercase">
                  CUSTO DIRETO DO MAQUINÁRIO PESADO
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-7">
                  <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
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
                      className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] appearance-none pr-7 uppercase cursor-pointer"
                    >
                      <option value="">-- SELECIONE O VEÍCULO / MÁQUINA --</option>
                      {availableMachineries.map((m) => (
                        <option key={m.id} value={m.id}>
                          {(m.licensePlateOrSerial ? `${m.licensePlateOrSerial} · ${m.model || m.name}` : (m.model || m.name)).toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="col-span-5">
                  <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                    HORÍMETRO / ODÔMETRO <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="EX: 1250"
                    value={readingKmOrHours}
                    onChange={(e) => setReadingKmOrHours(e.target.value)}
                    className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                  />
                </div>
              </div>

              <div className="px-2 py-0.5 rounded border border-gray-400 bg-white text-[9px] flex items-center justify-between text-black">
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
            /* Checkbox Opcional de Rateio Exclusivo por Funcionários */
            <div className="border border-black rounded-xl p-2.5 bg-[#e0e6f1] shadow-2xs space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableApportionment}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnableApportionment(checked);
                    if (!checked) {
                      setSelectedTargets([]);
                      setEmployeeRateioSearch('');
                    }
                  }}
                  className="w-4 h-4 rounded border border-black bg-white text-emerald-700 focus:ring-emerald-600 cursor-pointer accent-emerald-700"
                />
                <span className="text-[11px] font-bold text-black uppercase tracking-wider">
                  RATEAR ESTA DESPESA ENTRE FUNCIONÁRIOS?
                </span>
              </label>

              {enableApportionment && (
                <div className="border-t border-black/20 pt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-black uppercase tracking-wider">
                      FUNCIONÁRIOS NO RATEIO ({selectedTargets.length === 0 ? 0 : totalParticipantsCount}{' '}
                      {(selectedTargets.length === 0 ? 0 : totalParticipantsCount) === 1 ? 'SELECIONADO' : 'SELECIONADOS'})
                    </label>
                    {selectedTargets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTargets([]);
                          setEmployeeRateioSearch('');
                        }}
                        className="text-[9px] text-slate-700 hover:text-black font-bold cursor-pointer uppercase"
                      >
                        LIMPAR
                      </button>
                    )}
                  </div>

                  {/* Campo de Busca Digitável Exclusivo de Funcionários */}
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={employeeRateioSearch}
                      onChange={(e) => setEmployeeRateioSearch(e.target.value)}
                      placeholder="PESQUISAR FUNCIONÁRIO PELO NOME OU FUNÇÃO..."
                      className="w-full pl-7 pr-7 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase placeholder:uppercase"
                    />
                    {employeeRateioSearch && (
                      <button
                        type="button"
                        onClick={() => setEmployeeRateioSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-black cursor-pointer"
                        title="Limpar busca"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Lista de Seleção Contendo Apenas os Funcionários Cadastrados */}
                  <div className="max-h-36 overflow-y-auto rounded-md border border-gray-400 bg-white divide-y divide-gray-200">
                    {filteredRateioEmployees.length === 0 ? (
                      <div className="p-2 text-center text-[10px] font-semibold text-slate-600 uppercase">
                        NENHUM FUNCIONÁRIO CADASTRADO ENCONTRADO.
                      </div>
                    ) : (
                      filteredRateioEmployees.map((emp) => {
                        const isChecked = selectedTargets.includes(emp.id);
                        const empMach = getLinkedVehicleForEmployee(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 cursor-pointer transition text-xs ${
                              isChecked ? 'bg-emerald-50 font-bold text-black' : 'hover:bg-slate-100 text-black font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleEmployeeTarget(emp.id)}
                                className="w-3.5 h-3.5 rounded border-gray-400 text-emerald-700 accent-emerald-700 cursor-pointer shrink-0"
                              />
                              <span className="truncate uppercase">{emp.name.toUpperCase()}</span>
                              <span className="text-[9px] text-slate-600 font-semibold uppercase shrink-0">
                                ({(emp.role || 'FUNCIONÁRIO').toUpperCase()})
                              </span>
                            </div>
                            {empMach && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-gray-300 text-[9px] font-bold text-emerald-800 uppercase shrink-0">
                                <Tractor className="w-2.5 h-2.5" />
                                <span>
                                  {empMach.licensePlateOrSerial
                                    ? `${empMach.licensePlateOrSerial} · ${empMach.model || empMach.name}`
                                    : (empMach.model || empMach.name)}
                                </span>
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* Chips dos Funcionários Selecionados */}
                  {selectedTargets.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto scrollbar-none py-0.5">
                      {selectedTargets.map((targetId) => {
                        const empMatch = activeEmployees.find((e) => e.id === targetId);
                        if (empMatch) {
                          const empMach = getLinkedVehicleForEmployee(empMatch.id);
                          return (
                            <div
                              key={empMatch.id}
                              className="inline-flex items-center space-x-1 bg-white border border-gray-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                            >
                              <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[8px] flex items-center justify-center font-bold">
                                {empMatch.name.charAt(0).toUpperCase()}
                              </div>
                              <span>{empMatch.name.toUpperCase()}</span>
                              {empMach && (
                                <span className="text-[9px] text-emerald-700 font-semibold">
                                  · {(empMach.licensePlateOrSerial || empMach.model || empMach.name).toUpperCase()}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveTarget(empMatch.id)}
                                className="w-3.5 h-3.5 rounded hover:bg-slate-200 flex items-center justify-center text-black cursor-pointer ml-0.5"
                                title="Remover funcionário do rateio"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={targetId}
                            className="inline-flex items-center space-x-1 bg-white border border-gray-400 text-black px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                          >
                            <Users className="w-3 h-3 text-slate-700" />
                            <span>{targetId === 'todos' ? `TODOS (${activeEmployees.length})` : targetId}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTarget(targetId)}
                              className="w-3.5 h-3.5 rounded hover:bg-slate-200 flex items-center justify-center text-black cursor-pointer ml-0.5"
                              title="Remover do rateio"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Resumo Claro de Rateio e Vínculo Automático com Veículo no DRE */}
                  <div className="px-2 py-1 rounded border border-gray-400 bg-white text-[10px] flex flex-wrap items-center justify-between gap-1">
                    <div className="flex flex-wrap items-center gap-1 font-bold text-black uppercase">
                      <Calculator className="w-3 h-3 text-blue-600 shrink-0" />
                      {selectedTargets.length === 0 ? (
                        <span>SELECIONE UM OU MAIS FUNCIONÁRIOS PARA O RATEIO</span>
                      ) : (
                        <>
                          <span>
                            Rateio entre {totalParticipantsCount} funcionário(s)
                          </span>
                          {linkedMachineries.length > 0 && (
                            <span className="text-emerald-700 font-bold">
                              {'->'} Vinculado automaticamente ao(s) veículo(s):{' '}
                              {linkedMachineries
                                .map((m) =>
                                  m.licensePlateOrSerial
                                    ? `${m.licensePlateOrSerial} / ${m.model || m.name}`
                                    : (m.model || m.name)
                                )
                                .join(', ')
                                .toUpperCase()}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {numAmount > 0 && selectedTargets.length > 0 && (
                      <span className="text-emerald-700 font-extrabold text-xs shrink-0">
                        R$ {rateioPerPerson.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / PESSOA
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BLOCO 3 (CARD): PAGAMENTO — STATUS, FORMA, DATA EFETIVA E CONTA DE DÉBITO / CARTÃO / CHEQUE */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-2.5 grid grid-cols-12 gap-2 shadow-2xs">
            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                STATUS DO PAGAMENTO
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as ExpenseStatus)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#0963cb] appearance-none pr-7 uppercase cursor-pointer"
                >
                  <option value="pendente">A PAGAR (PENDENTE)</option>
                  <option value="pago">PAGO (LIQUIDADO)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="col-span-4">
              <div className="flex items-center justify-between mb-0.5">
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider">
                  FORMA DE PAGAMENTO
                </label>
                <button
                  type="button"
                  onClick={() => setIsPaymentMethodsManagerOpen(true)}
                  title="Gerenciar Formas de Pagamento"
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-white hover:bg-slate-100 border border-black text-[9px] font-black text-black uppercase cursor-pointer"
                >
                  <Settings className="w-2.5 h-2.5" />
                  <span>Gerenciar</span>
                </button>
              </div>
              <div className="relative">
                <select
                  value={paymentMethod}
                  onChange={(e) => handlePaymentMethodChange(e.target.value as PaymentMethod)}
                  className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] appearance-none pr-7 uppercase cursor-pointer"
                >
                  {activeGlobalPaymentMethods.map((m) => {
                    const key = getPaymentMethodKey(m);
                    return (
                      <option key={m.id} value={key}>
                        {m.nome}
                      </option>
                    );
                  })}
                  {paymentMethod &&
                    !activeGlobalPaymentMethods.some((m) => getPaymentMethodKey(m) === paymentMethod) && (
                      <option value={paymentMethod}>
                        {getGlobalPaymentMethodLabel(paymentMethod)}
                      </option>
                    )}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                DATA EFETIVA DA BAIXA {status === 'pago' ? <span className="text-rose-600 font-bold">*</span> : <span className="text-slate-600 font-normal lowercase">(desabilitado)</span>}
              </label>
              <input
                type="date"
                disabled={status !== 'pago'}
                required={status === 'pago'}
                value={status === 'pago' ? (paymentDate || dueDate) : ''}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={`w-full px-2.5 h-7.5 rounded-md border border-gray-400 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] transition ${
                  status !== 'pago'
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-dashed select-none'
                    : 'bg-white text-black cursor-pointer'
                }`}
              />
            </div>

            {/* CONTA DE DÉBITO (ORIGEM) - Ocultada para Dinheiro em Espécie, Assinado Nota e Cheque */}
            {!isCashOrSignedNote && !isCheckPayment && (
              <div className={isCardPayment ? "col-span-6" : "col-span-12"}>
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                  CONTA DE DÉBITO (ORIGEM) {(status === 'pago' || isCardPayment) ? <span className="text-rose-600 font-bold">* (OBRIGATÓRIO)</span> : <span className="text-slate-600 font-normal lowercase">(desabilitado - nenhum débito realizado)</span>}
                </label>
                <div className="relative">
                  <select
                    value={(status === 'pago' || isCardPayment) ? bankAccountId : ''}
                    onChange={(e) => handleBankAccountChange(e.target.value)}
                    disabled={status !== 'pago' && !isCardPayment}
                    required={status === 'pago' || isCardPayment}
                    className={`w-full px-2.5 h-7.5 rounded-md border border-gray-400 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] appearance-none pr-7 uppercase transition ${
                      (status !== 'pago' && !isCardPayment)
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-dashed select-none'
                        : 'bg-white text-black cursor-pointer'
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
                  <ChevronDown className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* CAMPO CONDICIONAL: SELECIONAR CARTÃO CORPORATIVO */}
            {isCardPayment && (
              <div className="col-span-6 animate-in fade-in">
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-blue-700" />
                    SELECIONAR CARTÃO CORPORATIVO <span className="text-rose-600 font-bold">*</span>
                  </span>
                  {selectedCard && (
                    <span className="text-[9px] font-mono text-emerald-800 font-bold">
                      Disp: {formatCurrencyBRL(Math.max(0, selectedCard.totalLimit - selectedCard.usedLimit))}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={corporateCardId}
                    onChange={(e) => handleCorporateCardChange(e.target.value)}
                    required
                    className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#0963cb] appearance-none pr-7 cursor-pointer"
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
                  <ChevronDown className="w-3 h-3 text-slate-600 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {/* NOTIFICAÇÃO DE REGRA FINANCEIRA AUTOMATIZADA POR TIPO DE CARTÃO */}
            {isCardPayment && (
              <div className="col-span-12">
                {paymentMethod === 'cartao_credito' ? (
                  <div className="flex items-center justify-between text-[10px] bg-white border border-black rounded-md px-2.5 py-1 text-purple-950">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      <span>
                        Fatura Aberta: O valor será lançado no Limite Utilizado do cartão. Saldo em conta não é debitado imediatamente.
                      </span>
                    </span>
                    {selectedCard && (
                      <span className="font-mono font-bold text-purple-800 shrink-0">
                        Vencimento da Fatura: {formatDateBR(calculateCardInvoiceDueDate(selectedCard.dueDay || 10))}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] bg-white border border-black rounded-md px-2.5 py-1 text-emerald-950">
                    <span className="font-semibold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Cartão de Débito: Baixa imediata de {formatCurrencyBRL(parseFloat(amount) || 0)} no saldo da conta com lançamento no extrato bancário.
                      </span>
                    </span>
                    <span className="font-bold text-emerald-800 shrink-0 uppercase">
                      Débito Imediato em Conta
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* SUBFORMULÁRIO DINÂMICO PARA PAGAMENTO EM CHEQUE */}
            {isCheckPayment && (
              <div className="col-span-12 p-3 rounded-lg border border-black bg-[#e0e6f1] space-y-3 animate-in fade-in">
                {/* Cabeçalho do Bloco de Cheque */}
                <div className="flex items-center justify-between pb-1.5 border-b border-black/20">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-800" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-black">
                      EMISSÃO E DADOS DO CHEQUE
                    </span>
                  </div>
                  {numAmount > 0 && (
                    <span className="text-[10px] font-semibold text-slate-800">
                      Total da Despesa: <strong className="font-mono text-black">{formatCurrencyBRL(numAmount)}</strong>
                    </span>
                  )}
                </div>

                {/* Grid dos Campos do Cheque */}
                <div className="grid grid-cols-12 gap-2">
                  {/* Número do Cheque * (Obrigatório) */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                      NÚMERO DO CHEQUE <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required={isCheckPayment}
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value.toUpperCase())}
                      placeholder="Ex: 000124"
                      className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase tracking-wider"
                    />
                  </div>

                  {/* Valor do Cheque * (Obrigatório) */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                      VALOR DO CHEQUE (R$) <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required={isCheckPayment}
                      value={checkAmount}
                      onChange={(e) => setCheckAmount(maskCurrencyLive(e.target.value))}
                      placeholder="R$ 0,00"
                      className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-black font-mono focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  {/* Banco do Cheque (Opcional) */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                      BANCO DO CHEQUE <span className="text-slate-700 font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={checkBank}
                      onChange={(e) => setCheckBank(e.target.value.toUpperCase())}
                      placeholder="Ex: SICREDI, BB, BRADESCO..."
                      className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase"
                    />
                  </div>

                  {/* Nome do Emitente (Opcional) */}
                  <div className="col-span-12 sm:col-span-7">
                    <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                      NOME DO EMITENTE <span className="text-slate-700 font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={checkIssuerName}
                      onChange={(e) => setCheckIssuerName(e.target.value.toUpperCase())}
                      placeholder="Ex: NOME DO TITULAR DA FOLHA DE CHEQUE"
                      className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase"
                    />
                  </div>

                  {/* CPF / CNPJ do Emitente (Opcional) */}
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                      CPF / CNPJ DO EMITENTE <span className="text-slate-700 font-normal lowercase">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={checkIssuerCpf}
                      onChange={(e) => setCheckIssuerCpf(formatCpfCnpj(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={18}
                      className="w-full px-2.5 h-7.5 rounded-md border border-gray-400 bg-white text-black text-xs font-medium font-mono focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>
                </div>

                {/* CASO 1: VALOR DO CHEQUE MAIOR QUE A DESPESA (TROCO EM DINHEIRO) */}
                {checkChangeAmount > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-md bg-white border border-black text-emerald-950 text-xs animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Coins className="w-4 h-4 text-emerald-700" />
                      <span>Troco em Dinheiro:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-700 font-medium">
                        (Valor do Cheque {formatCurrencyBRL(numCheckAmount)} - Total {formatCurrencyBRL(numAmount)})
                      </span>
                      <span className="font-mono font-black text-sm text-emerald-800 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-400">
                        {formatCurrencyBRL(checkChangeAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* CASO 2: VALOR DO CHEQUE MENOR QUE A DESPESA (PAGAMENTO MISTO / COMPLEMENTAR) */}
                {isCheckUnderpaid && (
                  <div className="p-3 rounded-md bg-[#e0e6f1] border border-black space-y-2.5 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-black/20 pb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-black">
                        <AlertCircle className="w-4 h-4 text-amber-700" />
                        <span>Pagamento Misto: Cheque Parcial ({formatCurrencyBRL(numCheckAmount)})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase text-black">
                          Saldo a Distribuir:
                        </span>
                        <span
                          className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                            saldoADistribuir > 0.009
                              ? 'bg-rose-100 text-rose-800 border border-rose-400'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-400'
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
                              className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-gray-400"
                            >
                              <div className="col-span-12 sm:col-span-4">
                                <label className="block text-[9px] font-bold text-black uppercase mb-0.5">
                                  Forma Complementar #{idx + 1}
                                </label>
                                <select
                                  value={comp.paymentMethod}
                                  onChange={(e) =>
                                    handleUpdateComplementaryPayment(comp.id, 'paymentMethod', e.target.value as PaymentMethod)
                                  }
                                  className="w-full px-2 h-7 rounded border border-gray-400 bg-white text-xs font-bold uppercase text-black focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                                >
                                  <option value="pix">PIX</option>
                                  <option value="dinheiro">DINHEIRO EM ESPÉCIE</option>
                                  <option value="cartao_debito">CARTÃO DE DÉBITO</option>
                                  <option value="transferencia">TRANSFERÊNCIA (TED)</option>
                                  <option value="boleto">BOLETO BANCÁRIO</option>
                                </select>
                              </div>

                              <div className="col-span-12 sm:col-span-3">
                                <label className="block text-[9px] font-bold text-black uppercase mb-0.5">
                                  Valor (R$)
                                </label>
                                <input
                                  type="text"
                                  value={comp.amount}
                                  onChange={(e) =>
                                    handleUpdateComplementaryPayment(comp.id, 'amount', e.target.value)
                                  }
                                  placeholder="R$ 0,00"
                                  className="w-full px-2 h-7 rounded border border-gray-400 bg-white text-xs font-black font-mono text-black focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                                />
                              </div>

                              <div className="col-span-10 sm:col-span-4">
                                <label className="block text-[9px] font-bold text-black uppercase mb-0.5">
                                  {requiresAcc ? 'Conta Débito' : 'Espécie (Sem Conta)'}
                                </label>
                                {requiresAcc ? (
                                  <select
                                    value={comp.bankAccountId || ''}
                                    onChange={(e) =>
                                      handleUpdateComplementaryPayment(comp.id, 'bankAccountId', e.target.value)
                                    }
                                    className="w-full px-2 h-7 rounded border border-gray-400 bg-white text-[11px] font-semibold uppercase text-black focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                                  >
                                    <option value="">-- SELECIONE CONTA --</option>
                                    {effectiveBankAccounts.map((acc) => (
                                      <option key={acc.id} value={acc.id}>
                                        {(acc.name || acc.accountName || acc.bankName || 'Conta').toUpperCase()}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="h-7 px-2 flex items-center bg-gray-100 border border-gray-400 rounded text-[10px] text-gray-600 italic">
                                    Pagamento direto em mãos
                                  </div>
                                )}
                              </div>

                              <div className="col-span-2 sm:col-span-1 flex justify-end pt-3 sm:pt-3.5">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveComplementaryPayment(comp.id)}
                                  className="p-1 rounded text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white border border-black text-[11px] font-bold uppercase transition cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3 h-3" />
                        ADICIONAR FORMA COMPLEMENTAR
                      </button>

                      {saldoADistribuir > 0.009 && (
                        <span className="text-[10px] font-bold text-rose-700">
                          Complete os pagamentos para zerar o saldo
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BLOCO 4 (CARD): FOTO / COMPROVANTE & OBSERVAÇÕES LADO A LADO */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-2.5 grid grid-cols-2 gap-2 shadow-2xs">
            <div>
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                FOTO / COMPROVANTE
              </label>
              <label className="cursor-pointer border border-dashed border-gray-400 hover:border-black rounded-md h-7.5 px-2 flex items-center justify-center gap-1.5 text-black transition bg-white">
                <Camera className="w-3 h-3 text-slate-700 shrink-0" />
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
              <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-0.5">
                OBSERVAÇÕES
              </label>
              <input
                type="text"
                placeholder="OBSERVAÇÕES SOBRE A DESPESA..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-7.5 px-2.5 rounded-md border border-gray-400 bg-white text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase placeholder:uppercase"
              />
            </div>
          </div>

          {/* BLOCO 5 (CARD): ITENS / PRODUTOS LANÇADOS NESTA DESPESA */}
          <div className="w-full rounded-xl border border-black bg-[#e0e6f1] p-2.5 space-y-2 shadow-2xs overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-black" />
                <span className="text-[11px] font-bold text-black uppercase tracking-wide">
                  ITENS / PRODUTOS LANÇADOS NESTA DESPESA
                </span>
                {expenseItems.length > 0 && (
                  <span className="text-[10px] font-bold text-black bg-white px-1.5 py-0.2 rounded border border-gray-400">
                    {expenseItems.length} {expenseItems.length === 1 ? 'item' : 'itens'}
                  </span>
                )}
              </div>
              {expenseItems.length > 0 && (
                <div className="text-[11px] font-extrabold text-emerald-800">
                  TOTAL ITENS: {formatCurrencyBRL(expenseItems.reduce((acc, it) => acc + ((it.quantity || 0) * (it.unit_value || 0)), 0))}
                </div>
              )}
            </div>

            {/* Linha de Inclusão Rápida */}
            <div className="grid grid-cols-12 gap-1.5 items-end bg-[#e0e6f1] p-2 rounded-lg border border-black">
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-[9px] font-bold text-black uppercase tracking-wider mb-0.5">
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
                  className="w-full h-7.5 px-2 rounded border border-gray-400 bg-white text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] uppercase placeholder:normal-case"
                />
              </div>

              <div className="col-span-4 sm:col-span-2">
                <label className="block text-[9px] font-bold text-black uppercase tracking-wider mb-0.5">
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
                  className="w-full h-7.5 px-2 rounded border border-gray-400 bg-white text-black text-xs font-semibold text-center focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                />
              </div>

              <div className="col-span-4 sm:col-span-3">
                <label className="block text-[9px] font-bold text-black uppercase tracking-wider mb-0.5">
                  Valor Unit. (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600 pointer-events-none">
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
                    className="w-full h-7.5 pl-7 pr-2 rounded border border-gray-400 bg-white text-black text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
                  />
                </div>
              </div>

              <div className="col-span-4 sm:col-span-2 flex items-center">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full h-7.5 px-2 rounded bg-[#059669] hover:bg-emerald-700 active:bg-emerald-800 text-white border border-black text-[11px] font-bold uppercase transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  title="Inserir item na despesa"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">+ INSERIR</span>
                </button>
              </div>
            </div>

            {/* Tabela Dinâmica de Listagem Interna */}
            {expenseItems.length === 0 ? (
              <div className="py-2.5 px-3 text-center rounded-lg border border-dashed border-gray-400 bg-white text-[11px] text-slate-700 font-medium">
                Nenhum item discriminado. Adicione itens acima para discriminar produtos/serviços e calcular automaticamente o valor total.
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto overflow-x-auto rounded-lg border border-black bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#cad4e6] border-b border-black text-[10px] font-bold text-black uppercase tracking-wider">
                      <th className="py-1 px-2.5">Item / Descrição</th>
                      <th className="py-1 px-2 text-center w-16">Qtd</th>
                      <th className="py-1 px-2 text-right w-28">Valor Unit. (R$)</th>
                      <th className="py-1 px-2 text-right w-28">Valor Total (R$)</th>
                      <th className="py-1 px-2 text-center w-12">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {expenseItems.map((item, idx) => {
                      const totalItemVal = (item.quantity || 0) * (item.unit_value || 0);
                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                          <td className="py-1.5 px-2.5 font-medium text-black uppercase">
                            {item.description}
                          </td>
                          <td className="py-1.5 px-2 text-center font-semibold text-black">
                            {item.quantity}
                          </td>
                          <td className="py-1.5 px-2 text-right text-black">
                            {formatCurrencyBRL(item.unit_value)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-emerald-800">
                            {formatCurrencyBRL(totalItemVal)}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="w-6 h-6 inline-flex items-center justify-center rounded text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
                    <tr className="bg-[#e0e6f1] border-t border-black font-bold text-xs">
                      <td colSpan={3} className="py-1.5 px-2.5 text-right uppercase text-black">
                        Total Geral dos Itens:
                      </td>
                      <td className="py-1.5 px-2 text-right font-extrabold text-emerald-800">
                        {formatCurrencyBRL(expenseItems.reduce((acc, it) => acc + ((it.quantity || 0) * (it.unit_value || 0)), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

        </form>

        {/* Seção 3: Rodapé Fixo no Topo de Camada */}
        <div className="shrink-0 relative z-30 px-3.5 py-2.5 border-t border-black bg-[#cad4e6] flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={handleImmediateClose}
            className="px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-black text-black text-xs font-bold uppercase transition cursor-pointer"
          >
            CANCELAR
          </button>
          <button
            type="submit"
            form="expense-modal-form"
            disabled={isCheckPayment && isCheckUnderpaid && saldoADistribuir > 0.009}
            title={
              isCheckPayment && isCheckUnderpaid && saldoADistribuir > 0.009
                ? `Saldo restante de ${formatCurrencyBRL(saldoADistribuir)} a distribuir antes de salvar.`
                : undefined
            }
            className={`px-4 py-1.5 rounded-md text-white border border-black text-xs font-bold uppercase transition shadow-xs ${
              isCheckPayment && isCheckUnderpaid && saldoADistribuir > 0.009
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-[#059669] hover:bg-emerald-700 cursor-pointer'
            }`}
          >
            {editingExpense ? 'ATUALIZAR DESPESA' : 'SALVAR DESPESA'}
          </button>
        </div>

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
        suppliersList={localSuppliers}
        onSave={(newSup) => {
          const currentStored = getStoredSuppliers();
          const mergedMap = new Map<string, Supplier>();
          [...currentStored, ...localSuppliers].forEach((s) => {
            if (s && s.id) mergedMap.set(s.id, s);
          });
          mergedMap.set(newSup.id, newSup);
          const { items: normalized } = ensureSequentialSupplierCodes(Array.from(mergedMap.values()));
          const savedSup = normalized.find((s) => s.id === newSup.id) || newSup;
          saveStoredSuppliers(normalized);
          setLocalSuppliers(normalized);
          if (onSaveSuppliers) {
            onSaveSuppliers(normalized);
          }
          window.dispatchEvent(new CustomEvent('agrocontrol_fornecedores_updated', { detail: normalized }));
          window.dispatchEvent(new Event('storage'));
          setSupplier(savedSup.name);
          setSupplierId(savedSup.id);
          setIsSupplierDropdownOpen(false);
          setIsSupplierModalOpen(false);
        }}
      />
    )}

    <PaymentMethodsManagerModal
      isOpen={isPaymentMethodsManagerOpen}
      onClose={() => setIsPaymentMethodsManagerOpen(false)}
    />
  </>
  );
};
