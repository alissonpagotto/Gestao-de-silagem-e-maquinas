import React, { useState, useMemo } from 'react';
import { 
  Handshake, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Trash2, 
  Edit2, 
  DollarSign, 
  FileText, 
  Search,
  Printer,
  X,
  MapPin,
  Phone,
  Building2,
  Copy,
  Check,
  Calendar,
  Sparkles,
  Percent,
  Coins,
  ArrowUpRight,
  User,
  ExternalLink
} from 'lucide-react';
import { BrokerSettlement, Employee, SilageOrder, BankAccount, PaymentMethod } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { parseCurrencyInput, formatCurrencyInputDisplay } from '../../lib/formatters';

export const isBrokerEmployee = (emp?: Partial<Employee>): boolean => {
  if (!emp) return false;
  const roleStr = (emp.role || '').toLowerCase();
  const rolesList = Array.isArray(emp.roles) ? emp.roles.map(r => r.toLowerCase()) : [];
  return roleStr.includes('agenciador') || rolesList.some(r => r.includes('agenciador'));
};

interface BrokerSettlementsTabProps {
  settlements: BrokerSettlement[];
  onSaveSettlements: (settlements: BrokerSettlement[]) => void;
  employees?: Employee[];
  orders?: SilageOrder[];
  bankAccounts?: BankAccount[];
}

export const BrokerSettlementsTab: React.FC<BrokerSettlementsTabProps> = ({
  settlements,
  onSaveSettlements,
  employees = [],
  orders = [],
  bankAccounts = [],
}) => {
  const { confirm } = useConfirm();

  // Filtrar estritamente apenas colaboradores que possuem a função/cargo de Agenciador
  const brokerEmployees = useMemo(() => {
    return employees.filter(isBrokerEmployee);
  }, [employees]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'pago'>('all');
  const [selectedBrokerFilter, setSelectedBrokerFilter] = useState<string>('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // Month filter options: 1 previous, current, 5 next
  const monthFilterOptions = useMemo(() => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const options: { key: string; label: string; year: number; month: number }[] = [];
    for (let offset = -1; offset <= 5; offset++) {
      const d = new Date(currentYear, currentMonth + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const label = monthNames[m];
      options.push({ key, label, year: y, month: m });
    }
    return options;
  }, []);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BrokerSettlement | null>(null);

  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<BrokerSettlement | null>(null);
  const [settlePaymentDate, setSettlePaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<PaymentMethod>('pix');
  const [settleReceiptNumber, setSettleReceiptNumber] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [copiedPix, setCopiedPix] = useState(false);

  // Print Receipt Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<BrokerSettlement | null>(null);

  // Form State for Add / Edit
  const [formBrokerId, setFormBrokerId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formReferenceMonth, setFormReferenceMonth] = useState(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });
  const [formOrderId, setFormOrderId] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCommissionType, setFormCommissionType] = useState<string>('Porcentagem (%) sobre o valor do pedido');
  const [formCommissionRate, setFormCommissionRate] = useState<string>('5,00');
  const [formBaseValue, setFormBaseValue] = useState<string>('0,00');
  const [formDeductions, setFormDeductions] = useState<string>('0,00');
  const [formStatus, setFormStatus] = useState<'pendente' | 'pago'>('pendente');
  const [formBankAccountId, setFormBankAccountId] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('pix');
  const [formPaymentDate, setFormPaymentDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Selected employee in form
  const selectedFormBroker = useMemo(() => {
    return brokerEmployees.find(e => e.id === formBrokerId);
  }, [brokerEmployees, formBrokerId]);

  // Derived live amounts
  const parsedBaseValue = parseCurrencyInput(formBaseValue);
  const parsedRate = parseCurrencyInput(formCommissionRate);
  const parsedDeductions = parseCurrencyInput(formDeductions);

  const calculatedGrossAmount = useMemo(() => {
    if (formCommissionType === 'Valor Fixo por contrato/pedido') {
      return parsedRate;
    }
    // Percentage
    return (parsedBaseValue * parsedRate) / 100;
  }, [formCommissionType, parsedBaseValue, parsedRate]);

  const calculatedNetAmount = useMemo(() => {
    return Math.max(0, calculatedGrossAmount - parsedDeductions);
  }, [calculatedGrossAmount, parsedDeductions]);

  // Handler to open Add Modal
  const handleOpenAddModal = (presetBrokerId?: string) => {
    setEditingItem(null);
    const targetBrokerId = presetBrokerId || (brokerEmployees.length > 0 ? brokerEmployees[0].id : '');
    const broker = brokerEmployees.find(b => b.id === targetBrokerId);

    setFormBrokerId(targetBrokerId);
    setFormDate(new Date().toISOString().split('T')[0]);
    const now = new Date();
    setFormReferenceMonth(`${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
    setFormOrderId('');
    setFormClientName('');
    setFormDescription('');

    // Pre-populate from broker profile
    if (broker) {
      setFormCommissionType(broker.brokerCommissionType || 'Porcentagem (%) sobre o valor do pedido');
      setFormCommissionRate(
        broker.brokerCommissionValue !== undefined
          ? formatCurrencyInputDisplay(broker.brokerCommissionValue)
          : '5,00'
      );
    } else {
      setFormCommissionType('Porcentagem (%) sobre o valor do pedido');
      setFormCommissionRate('5,00');
    }

    setFormBaseValue('0,00');
    setFormDeductions('0,00');
    setFormStatus('pendente');
    setFormBankAccountId('');
    setFormPaymentMethod('pix');
    setFormPaymentDate('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  // Handler to open Edit Modal
  const handleOpenEditModal = (item: BrokerSettlement) => {
    setEditingItem(item);
    setFormBrokerId(item.brokerId);
    setFormDate(item.date || new Date().toISOString().split('T')[0]);
    setFormReferenceMonth(item.referenceMonth || '');
    setFormOrderId(item.orderId || '');
    setFormClientName(item.orderClientName || '');
    setFormDescription(item.description || '');
    setFormCommissionType(item.commissionType || 'Porcentagem (%) sobre o valor do pedido');
    setFormCommissionRate(formatCurrencyInputDisplay(item.commissionRate || 0));
    setFormBaseValue(formatCurrencyInputDisplay(item.baseValue || 0));
    setFormDeductions(formatCurrencyInputDisplay(item.deductions || 0));
    setFormStatus(item.status === 'pago' ? 'pago' : 'pendente');
    setFormBankAccountId(item.bankAccountId || '');
    setFormPaymentMethod((item.paymentMethod as PaymentMethod) || 'pix');
    setFormPaymentDate(item.paymentDate || '');
    setFormNotes(item.notes || '');
    setIsModalOpen(true);
  };

  // When changing broker in modal, auto-load rules
  const handleSelectBrokerInModal = (bId: string) => {
    setFormBrokerId(bId);
    const broker = brokerEmployees.find(b => b.id === bId);
    if (broker) {
      if (broker.brokerCommissionType) {
        setFormCommissionType(broker.brokerCommissionType);
      }
      if (broker.brokerCommissionValue !== undefined) {
        setFormCommissionRate(formatCurrencyInputDisplay(broker.brokerCommissionValue));
      }
    }
  };

  // When choosing an order from the list, auto-fill client and value
  const handleSelectOrderInModal = (orderId: string) => {
    setFormOrderId(orderId);
    const ord = orders.find(o => o.id === orderId);
    if (ord) {
      setFormClientName(ord.clientName);
      setFormDescription(`Pedido #${ord.orderNumber || ord.id.slice(-5)} - ${ord.productType} (${ord.tons}t)`);
      setFormBaseValue(formatCurrencyInputDisplay(ord.totalAmount));
    }
  };

  // Save Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const broker = brokerEmployees.find(b => b.id === formBrokerId);
    if (!broker) {
      alert('Selecione um agenciador válido.');
      return;
    }

    const selectedAccount = bankAccounts.find(a => a.id === formBankAccountId);

    const settlementData: BrokerSettlement = {
      id: editingItem?.id || `bset_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      brokerId: broker.id,
      brokerName: (broker.name || '').toUpperCase(),
      actingRegion: broker.actingRegion || undefined,
      date: formDate,
      referenceMonth: formReferenceMonth || undefined,
      orderId: formOrderId || undefined,
      orderClientName: formClientName.trim() ? formClientName.trim().toUpperCase() : undefined,
      description: formDescription.trim() || `Comissão de intermediação - ${broker.name}`,
      commissionType: formCommissionType,
      commissionRate: parsedRate,
      baseValue: parsedBaseValue,
      grossAmount: calculatedGrossAmount,
      deductions: parsedDeductions,
      netAmount: calculatedNetAmount,
      status: formStatus,
      paymentDate: formStatus === 'pago' ? (formPaymentDate || formDate) : undefined,
      bankAccountId: formStatus === 'pago' ? formBankAccountId || undefined : undefined,
      bankAccountName: formStatus === 'pago' ? selectedAccount?.accountName || selectedAccount?.bankName : undefined,
      paymentMethod: formStatus === 'pago' ? formPaymentMethod : undefined,
      pixKey: broker.bankPixKey || undefined,
      notes: formNotes.trim() || undefined,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
    };

    if (editingItem) {
      onSaveSettlements(settlements.map(s => s.id === editingItem.id ? settlementData : s));
    } else {
      onSaveSettlements([settlementData, ...settlements]);
    }

    setIsModalOpen(false);
  };

  // Quick Settle Payment (Dar Baixa)
  const handleOpenSettleModal = (item: BrokerSettlement) => {
    const broker = brokerEmployees.find(b => b.id === item.brokerId);
    setSettleTarget(item);
    setSettlePaymentDate(new Date().toISOString().split('T')[0]);
    setSettleAccountId(bankAccounts.length > 0 ? bankAccounts[0].id : '');
    setSettlePaymentMethod('pix');
    setSettleReceiptNumber('');
    setSettleNotes('');
    setCopiedPix(false);
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;

    const selectedAccount = bankAccounts.find(a => a.id === settleAccountId);

    const updated = settlements.map(s => {
      if (s.id === settleTarget.id) {
        return {
          ...s,
          status: 'pago' as const,
          paymentDate: settlePaymentDate,
          bankAccountId: settleAccountId || undefined,
          bankAccountName: selectedAccount?.accountName || selectedAccount?.bankName || undefined,
          paymentMethod: settlePaymentMethod,
          receiptNumber: settleReceiptNumber.trim() || undefined,
          notes: settleNotes.trim() ? `${s.notes ? s.notes + ' | ' : ''}${settleNotes.trim()}` : s.notes,
        };
      }
      return s;
    });

    onSaveSettlements(updated);
    setIsSettleModalOpen(false);
    setSettleTarget(null);
  };

  // Reopen / Reverse settlement to pending
  const handleReverseSettlement = async (item: BrokerSettlement) => {
    const isConfirmed = await confirm({
      title: 'Estornar Repasse do Agenciador',
      message: `Deseja realmente reabrir o acerto de "${item.brokerName}" no valor de ${formatCurrencyBRL(item.netAmount)}? O status retornará para Pendente.`,
      confirmLabel: 'Sim, Reabrir',
      cancelLabel: 'Cancelar',
      variant: 'warning',
    });
    if (isConfirmed) {
      const updated = settlements.map(s => {
        if (s.id === item.id) {
          return {
            ...s,
            status: 'pendente' as const,
            paymentDate: undefined,
            bankAccountId: undefined,
            bankAccountName: undefined,
            receiptNumber: undefined,
          };
        }
        return s;
      });
      onSaveSettlements(updated);
    }
  };

  // Delete settlement
  const handleDeleteSettlement = async (item: BrokerSettlement) => {
    const isConfirmed = await confirm({
      title: 'Excluir Acerto de Agenciador',
      message: `Deseja realmente excluir este lançamento de comissão para "${item.brokerName}" no valor de ${formatCurrencyBRL(item.netAmount)}?`,
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveSettlements(settlements.filter(s => s.id !== item.id));
    }
  };

  // Copy PIX key
  const handleCopyPix = (key?: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  // Print single receipt
  const handleOpenPrintReceipt = (item: BrokerSettlement) => {
    setPrintTarget(item);
    setIsPrintModalOpen(true);
  };

  // Filter settlements
  const filteredSettlements = useMemo(() => {
    return settlements.filter(s => {
      // Filter by broker
      if (selectedBrokerFilter !== 'all' && s.brokerId !== selectedBrokerFilter) {
        return false;
      }

      // Filter by status
      if (statusFilter === 'pendente' && s.status !== 'pendente' && s.status !== 'parcial') {
        return false;
      }
      if (statusFilter === 'pago' && s.status !== 'pago') {
        return false;
      }

      // Filter by Month
      if (selectedMonthKey) {
        if (!s.date || !s.date.startsWith(selectedMonthKey)) {
          return false;
        }
      }

      // Filter by Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = s.brokerName.toLowerCase().includes(q);
        const matchesDesc = (s.description || '').toLowerCase().includes(q);
        const matchesClient = (s.orderClientName || '').toLowerCase().includes(q);
        const matchesRegion = (s.actingRegion || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesClient && !matchesRegion) {
          return false;
        }
      }

      return true;
    });
  }, [settlements, selectedBrokerFilter, statusFilter, selectedMonthKey, searchTerm]);

  // Overall KPIs
  const totalPendingAmount = useMemo(() => {
    return settlements
      .filter(s => s.status === 'pendente' || s.status === 'parcial')
      .reduce((sum, s) => sum + s.netAmount, 0);
  }, [settlements]);

  const totalPaidAmount = useMemo(() => {
    return settlements
      .filter(s => s.status === 'pago')
      .reduce((sum, s) => sum + s.netAmount, 0);
  }, [settlements]);

  const totalSettlementsCount = settlements.length;
  const pendingCount = settlements.filter(s => s.status === 'pendente' || s.status === 'parcial').length;
  const paidCount = settlements.filter(s => s.status === 'pago').length;

  return (
    <div className="space-y-4">
      {/* 1. TOPO: Cabeçalho do Submódulo e Ações Rápidas */}
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-sky-600 text-white rounded-xl shadow-xs shrink-0">
              <Handshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-black dark:text-white uppercase tracking-wider">
                  Acertos & Repasses de Agenciadores
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  <Coins className="w-2.5 h-2.5 text-amber-700" />
                  Gestão Exclusiva do Financeiro
                </span>
              </div>
              <p className="text-xs text-black/80 dark:text-stone-300 mt-0.5 font-medium">
                Controle financeiro de comissões por contratos e pedidos agenciados. A baixa de repasse é realizada exclusivamente por aqui (sem impacto na folha do RH).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              disabled={brokerEmployees.length === 0}
              className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer shadow-xs ${
                brokerEmployees.length > 0
                  ? 'bg-sky-600 hover:bg-sky-700 text-white active:scale-98'
                  : 'bg-stone-300 text-stone-600 cursor-not-allowed'
              }`}
              title={brokerEmployees.length === 0 ? 'Cadastre um colaborador como Agenciador no RH primeiro' : 'Lançar nova comissão para agenciador'}
            >
              <Plus className="w-4 h-4" />
              <span>Novo Lançamento de Comissão</span>
            </button>
          </div>
        </div>
      </div>

      {/* AVISO SE NÃO HOUVER NENHUM AGENCIADOR CADASTRADO NO SISTEMA */}
      {brokerEmployees.length === 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-amber-950 space-y-2 shadow-2xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <h4 className="text-sm font-bold uppercase">
              Nenhum Colaborador com a função "Agenciador" Encontrado
            </h4>
          </div>
          <p className="text-xs text-amber-900 font-medium">
            Para gerenciar os acertos e comissões nesta aba, é necessário ter pelo menos um colaborador cadastrado com a função de <strong>Agenciador</strong> (na Função 1 ou Função 2).
          </p>
          <p className="text-xs text-amber-800">
            Vá até o menu lateral <strong>RH &gt; Funcionários</strong> e cadastre ou edite um colaborador selecionando <strong>"Agenciador"</strong> como função e informando a Região de Atuação e Regra de Comissão.
          </p>
        </div>
      )}

      {/* 2. CARDS DE MÉTRICAS (KPIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total a Repassar (Pendente) */}
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-300">
              Total a Repassar (Pendente)
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-300">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-amber-950 dark:text-amber-200 font-['Outfit']">
              {formatCurrencyBRL(totalPendingAmount)}
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] text-zinc-500 dark:text-stone-400 mt-1 font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-600"></span>
              <span>{pendingCount} lançamento(s) aguardando baixa</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Repassado (Pago / Baixado) */}
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-300">
              Total Repassado (Baixado)
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-900 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-200 font-['Outfit']">
              {formatCurrencyBRL(totalPaidAmount)}
            </div>
            <div className="flex items-center space-x-1.5 text-[11px] text-zinc-500 dark:text-stone-400 mt-1 font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>{paidCount} lançamento(s) quitados</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Geral Acumulado */}
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-300">
              Volume de Comissões
            </span>
            <span className="p-1.5 rounded-lg bg-zinc-100 dark:bg-sky-500/20 text-zinc-800 dark:text-sky-300">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white font-['Outfit']">
              {formatCurrencyBRL(totalPendingAmount + totalPaidAmount)}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-stone-400 mt-1 font-semibold">
              {totalSettlementsCount} comissão(ões) registradas
            </div>
          </div>
        </div>

        {/* Card 4: Agenciadores Ativos */}
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-300">
              Agenciadores Ativos
            </span>
            <span className="p-1.5 rounded-lg bg-orange-500/20 text-orange-900 dark:text-orange-300">
              <User className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-orange-950 dark:text-orange-200 font-['Outfit']">
              {brokerEmployees.length}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-stone-400 mt-1 font-semibold truncate">
              {brokerEmployees.length > 0 ? 'Profissionais no quadro de intermediação' : 'Cadastre em RH > Funcionários'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. QUADRO DE AGENCIADORES CADASTRADOS (ATALHO E VISÃO GERAL) */}
      {brokerEmployees.length > 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 rounded-xl p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-black dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Handshake className="w-3.5 h-3.5 text-sky-600" />
              <span>Agenciadores Credenciados ({brokerEmployees.length})</span>
            </h4>
            <span className="text-[11px] text-stone-500 font-medium">
              Clique em um agenciador para filtrar ou criar acerto rápido
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {brokerEmployees.map(broker => {
              const brokerSettlements = settlements.filter(s => s.brokerId === broker.id);
              const pending = brokerSettlements
                .filter(s => s.status === 'pendente' || s.status === 'parcial')
                .reduce((acc, s) => acc + s.netAmount, 0);
              const isSelected = selectedBrokerFilter === broker.id;

              return (
                <div 
                  key={broker.id}
                  className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                    isSelected 
                      ? 'border-sky-500 bg-sky-50/70 shadow-xs ring-1 ring-sky-400' 
                      : 'border-stone-200 bg-stone-50/60 hover:bg-white hover:border-sky-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-xs text-black uppercase tracking-tight flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                        <span>{broker.name}</span>
                      </div>
                      {broker.actingRegion && (
                        <div className="flex items-center space-x-1 text-[11px] text-orange-900 font-bold mt-0.5">
                          <MapPin className="w-3 h-3 text-orange-600 shrink-0" />
                          <span className="uppercase">{broker.actingRegion}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-stone-600 font-medium mt-1">
                        Regra: <strong className="text-black">{broker.brokerCommissionType || 'Comissão Padrão'}</strong>
                        {broker.brokerCommissionValue !== undefined && ` (${broker.brokerCommissionValue}%)`}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-stone-500 block uppercase">Pendente</span>
                      <span className={`text-xs font-black font-['Outfit'] ${pending > 0 ? 'text-amber-700' : 'text-stone-700'}`}>
                        {formatCurrencyBRL(pending)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/80 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedBrokerFilter(isSelected ? 'all' : broker.id)}
                      className={`text-[10px] font-bold px-2 py-1 rounded transition cursor-pointer ${
                        isSelected 
                          ? 'bg-sky-600 text-white' 
                          : 'bg-stone-200 text-stone-800 hover:bg-stone-300'
                      }`}
                    >
                      {isSelected ? 'Remover Filtro' : 'Filtrar Lançamentos'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(broker.id)}
                      className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Lançar Repasse</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. BARRA DE FILTROS */}
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca por texto */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              placeholder="Buscar por agenciador, pedido ou região..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-black font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
            />
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center space-x-1 bg-black/10 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-black dark:text-stone-300 hover:bg-black/10'
              }`}
            >
              Todos ({settlements.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pendente')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                statusFilter === 'pendente'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-black dark:text-stone-300 hover:bg-black/10'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pago')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                statusFilter === 'pago'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-black dark:text-stone-300 hover:bg-black/10'
              }`}
            >
              Pagos ({paidCount})
            </button>
          </div>

          {/* Filtro por Agenciador */}
          {brokerEmployees.length > 0 && (
            <select
              value={selectedBrokerFilter}
              onChange={(e) => setSelectedBrokerFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
            >
              <option value="all">Todos os Agenciadores</option>
              {brokerEmployees.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.actingRegion ? `(${b.actingRegion})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Filtro por Mês */}
        <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedMonthKey(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedMonthKey === null
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-black hover:bg-black/10'
            }`}
          >
            Todos os Meses
          </button>
          {monthFilterOptions.slice(0, 4).map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSelectedMonthKey(opt.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedMonthKey === opt.key
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-black hover:bg-black/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. TABELA PRINCIPAL DE ACERTOS & REPASSES */}
      <div className="bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Data / Mês</th>
                <th className="py-2.5 px-3">Agenciador / Região</th>
                <th className="py-2.5 px-3">Contrato / Pedido Agenciado</th>
                <th className="py-2.5 px-3">Regra de Comissão</th>
                <th className="py-2.5 px-3 text-right">Base Cálculo</th>
                <th className="py-2.5 px-3 text-right">Bruto</th>
                <th className="py-2.5 px-3 text-right">Dedução</th>
                <th className="py-2.5 px-3 text-right">Valor Líquido</th>
                <th className="py-2.5 px-3 text-center">Status / Baixa</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-stone-500 space-y-2">
                    <Handshake className="w-8 h-8 mx-auto text-stone-400" />
                    <p className="text-sm font-semibold">Nenhum acerto de agenciador encontrado para estes filtros.</p>
                    {brokerEmployees.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal()}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Lançar Primeiro Repasse</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((item) => {
                  const isPaid = item.status === 'pago';
                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-sky-50/40 dark:hover:bg-slate-800/40 transition ${
                        isPaid ? 'bg-white' : 'bg-amber-50/20'
                      }`}
                    >
                      {/* Data / Mês */}
                      <td className="py-3 px-3 font-semibold text-black whitespace-nowrap">
                        <div>{formatDateBR(item.date)}</div>
                        {item.referenceMonth && (
                          <div className="text-[10px] text-stone-500 font-medium">
                            Comp: {item.referenceMonth}
                          </div>
                        )}
                      </td>

                      {/* Agenciador / Região */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-black uppercase tracking-tight flex items-center gap-1.5">
                          <span>{item.brokerName}</span>
                        </div>
                        {item.actingRegion && (
                          <div className="flex items-center space-x-1 text-[10px] text-orange-900 font-bold mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-orange-600 shrink-0" />
                            <span className="uppercase">{item.actingRegion}</span>
                          </div>
                        )}
                        {item.pixKey && (
                          <div className="text-[10px] text-stone-500 font-medium mt-0.5 truncate max-w-[160px]" title={`Chave PIX: ${item.pixKey}`}>
                            PIX: {item.pixKey}
                          </div>
                        )}
                      </td>

                      {/* Contrato / Pedido Agenciado */}
                      <td className="py-3 px-3 max-w-[220px]">
                        <div className="font-bold text-stone-900 truncate" title={item.description}>
                          {item.description}
                        </div>
                        {item.orderClientName && (
                          <div className="text-[10px] text-sky-800 font-bold uppercase mt-0.5">
                            Cliente: {item.orderClientName}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-[10px] text-stone-500 italic mt-0.5 truncate" title={item.notes}>
                            Obs: {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Regra de Comissão */}
                      <td className="py-3 px-3 text-[11px] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-stone-100 text-stone-800 border border-stone-200">
                          {item.commissionType === 'Valor Fixo por contrato/pedido' ? (
                            <>
                              <Coins className="w-3 h-3 text-amber-600" />
                              <span>Fixo: {formatCurrencyBRL(item.commissionRate)}</span>
                            </>
                          ) : (
                            <>
                              <Percent className="w-3 h-3 text-sky-600" />
                              <span>{item.commissionRate}% {item.commissionType.includes('produção') ? 's/ Prod.' : 's/ Pedido'}</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Base de Cálculo */}
                      <td className="py-3 px-3 text-right font-medium text-stone-700 font-['Outfit'] whitespace-nowrap">
                        {formatCurrencyBRL(item.baseValue || 0)}
                      </td>

                      {/* Bruto */}
                      <td className="py-3 px-3 text-right font-medium text-stone-700 font-['Outfit'] whitespace-nowrap">
                        {formatCurrencyBRL(item.grossAmount || 0)}
                      </td>

                      {/* Dedução */}
                      <td className="py-3 px-3 text-right font-medium text-rose-600 font-['Outfit'] whitespace-nowrap">
                        {item.deductions && item.deductions > 0 ? `-${formatCurrencyBRL(item.deductions)}` : '—'}
                      </td>

                      {/* Valor Líquido */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="text-sm font-black text-black font-['Outfit']">
                          {formatCurrencyBRL(item.netAmount)}
                        </span>
                      </td>

                      {/* Status / Baixa */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isPaid ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>PAGO / BAIXADO</span>
                            </span>
                            {item.paymentDate && (
                              <span className="text-[9px] text-stone-500 font-medium mt-0.5">
                                em {formatDateBR(item.paymentDate)}
                              </span>
                            )}
                            {item.bankAccountName && (
                              <span className="text-[9px] text-stone-500 font-semibold truncate max-w-[120px]" title={item.bankAccountName}>
                                {item.bankAccountName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-700" />
                              <span>PENDENTE</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenSettleModal(item)}
                              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                            >
                              Dar Baixa
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Imprimir Recibo */}
                          <button
                            type="button"
                            onClick={() => handleOpenPrintReceipt(item)}
                            title="Imprimir Recibo de Repasse"
                            className="p-1 rounded text-stone-600 hover:text-sky-700 hover:bg-stone-100 transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Estornar se pago */}
                          {isPaid && (
                            <button
                              type="button"
                              onClick={() => handleReverseSettlement(item)}
                              title="Estornar / Reabrir lançamento"
                              className="p-1 rounded text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            title="Editar Acerto"
                            className="p-1 rounded text-stone-600 hover:text-amber-600 hover:bg-stone-100 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Excluir */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSettlement(item)}
                            title="Excluir Acerto"
                            className="p-1 rounded text-stone-600 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. MODAL DE NOVO / EDITAR LANÇAMENTO DE COMISSÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-sky-700 to-sky-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Handshake className="w-5 h-5 text-sky-200" />
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider">
                  {editingItem ? 'Editar Acerto de Agenciador' : 'Novo Lançamento de Comissão / Repasse'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Seleção do Agenciador */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-black uppercase">
                  Colaborador Agenciador <span className="text-rose-600">*</span>
                </label>
                <select
                  required
                  value={formBrokerId}
                  onChange={(e) => handleSelectBrokerInModal(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Selecione um Agenciador credenciado...</option>
                  {brokerEmployees.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.actingRegion ? `(Região: ${b.actingRegion})` : ''} - Regra: {b.brokerCommissionType || 'Padrão'}
                    </option>
                  ))}
                </select>
                {selectedFormBroker?.actingRegion && (
                  <div className="flex items-center space-x-1 text-[11px] text-orange-950 font-bold mt-1">
                    <MapPin className="w-3.5 h-3.5 text-orange-600" />
                    <span>Região de Atuação Cadastrada: {selectedFormBroker.actingRegion}</span>
                  </div>
                )}
              </div>

              {/* Data do Acerto & Mês de Competência */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Data do Lançamento <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Mês de Competência (MM/AAAA)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 09/2026"
                    value={formReferenceMonth}
                    onChange={(e) => setFormReferenceMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 uppercase"
                  />
                </div>
              </div>

              {/* Vínculo com Pedido de Silagem (Opcional) */}
              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    <span>Vincular Pedido de Silagem da Safra (Opcional)</span>
                  </label>
                  <span className="text-[10px] text-sky-700 font-semibold">Preenche valor e cliente automaticamente</span>
                </div>
                <select
                  value={formOrderId}
                  onChange={(e) => handleSelectOrderInModal(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-lg text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Nenhum pedido vinculado (digitar dados manualmente)</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      Pedido #{o.orderNumber || o.id.slice(-5)} - {o.clientName} ({o.tons}t) - Total: {formatCurrencyBRL(o.totalAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descrição e Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Nome do Cliente / Produtor
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: FAZENDA SANTA MARIA - JOÃO SILVA"
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Descrição do Serviço / Contrato Agenciado <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Intermediação colheita de silagem de milho"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Regra de Comissão e Valores */}
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                <div className="font-bold text-black uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span>Cálculo da Remuneração / Comissão</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Tipo de Comissão
                    </label>
                    <select
                      value={formCommissionType}
                      onChange={(e) => setFormCommissionType(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-bold focus:outline-none"
                    >
                      <option value="Porcentagem (%) sobre o valor do pedido">Porcentagem (%) sobre o valor do pedido</option>
                      <option value="Porcentagem (%) sobre a produção">Porcentagem (%) sobre a produção</option>
                      <option value="Valor Fixo por contrato/pedido">Valor Fixo por contrato/pedido</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Taxa / Valor ({formCommissionType === 'Valor Fixo por contrato/pedido' ? 'R$' : '%'})
                    </label>
                    <input
                      type="text"
                      required
                      value={formCommissionRate}
                      onChange={(e) => setFormCommissionRate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-bold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      Base de Cálculo (R$)
                    </label>
                    <input
                      type="text"
                      required
                      value={formBaseValue}
                      onChange={(e) => setFormBaseValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs font-bold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Deduções / Adiantamentos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-200">
                  <div>
                    <span className="text-[11px] text-stone-600 font-bold block">Comissão Bruta Calculada:</span>
                    <span className="text-sm font-black text-stone-900 font-['Outfit']">
                      {formatCurrencyBRL(calculatedGrossAmount)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-rose-800 mb-1">
                      (-) Deduções / Vales (R$)
                    </label>
                    <input
                      type="text"
                      value={formDeductions}
                      onChange={(e) => setFormDeductions(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-rose-800 text-xs font-bold focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] text-emerald-800 font-black uppercase block">Líquido a Repassar:</span>
                    <span className="text-base font-black text-emerald-950 font-['Outfit']">
                      {formatCurrencyBRL(calculatedNetAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Inicial & Dados de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Status do Lançamento
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-bold focus:outline-none"
                  >
                    <option value="pendente">Pendente (Aguardando Pagamento)</option>
                    <option value="pago">Já Pago (Baixar Imediatamente)</option>
                  </select>
                </div>

                {formStatus === 'pago' && (
                  <div>
                    <label className="block text-xs font-bold text-black mb-1">
                      Conta Bancária de Saída
                    </label>
                    <select
                      value={formBankAccountId}
                      onChange={(e) => setFormBankAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none"
                    >
                      <option value="">Selecione a conta de saída...</option>
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.accountName || acc.bankName} (Saldo: {formatCurrencyBRL(acc.currentBalance)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Observações / Dados Adicionais
                </label>
                <textarea
                  rows={2}
                  placeholder="Instruções de pagamento, referência de nota fiscal ou detalhes adicionais..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-stone-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 font-bold hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black transition cursor-pointer shadow-xs"
                >
                  {editingItem ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL DE BAIXA RÁPIDA / PAGAMENTO DO REPASSE */}
      {isSettleModalOpen && settleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-5 py-3.5 bg-emerald-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Efetivar Baixa de Repasse
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmSettle} className="p-5 space-y-4 text-xs">
              {/* Card de Resumo do Repasse */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-950 uppercase">Agenciador:</span>
                  <span className="text-xs font-black text-black uppercase">{settleTarget.brokerName}</span>
                </div>
                {settleTarget.actingRegion && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600">Região de Atuação:</span>
                    <span className="font-bold text-orange-950 uppercase">{settleTarget.actingRegion}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-600">Contrato / Descrição:</span>
                  <span className="font-bold text-stone-900 truncate max-w-[240px]">{settleTarget.description}</span>
                </div>
                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 uppercase">Valor Líquido a Pagar:</span>
                  <span className="text-lg font-black text-emerald-950 font-['Outfit']">
                    {formatCurrencyBRL(settleTarget.netAmount)}
                  </span>
                </div>
              </div>

              {/* Chave PIX com botão copiar */}
              {settleTarget.pixKey && (
                <div className="p-3 bg-stone-100 border border-stone-300 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Chave PIX Cadastrada:</span>
                    <span className="text-xs font-black text-black font-mono select-all">{settleTarget.pixKey}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyPix(settleTarget.pixKey)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] transition cursor-pointer shadow-2xs"
                  >
                    {copiedPix ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar PIX</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Data do Pagamento & Conta de Saída */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Data do Pagamento <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={settlePaymentDate}
                    onChange={(e) => setSettlePaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={settlePaymentMethod}
                    onChange={(e) => setSettlePaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none"
                  >
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência Bancária (TED/DOC)</option>
                    <option value="dinheiro">Dinheiro em Espécie</option>
                    <option value="cheque">Cheque</option>
                    <option value="outros">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Conta Bancária de Saída
                </label>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Selecione a conta bancária de saída...</option>
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName || acc.bankName} (Saldo: {formatCurrencyBRL(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Nº do Comprovante / Autenticação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Autenticação bancária ou código da transação PIX"
                  value={settleReceiptNumber}
                  onChange={(e) => setSettleReceiptNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Observações da Baixa
                </label>
                <input
                  type="text"
                  placeholder="Anotação complementar sobre o pagamento..."
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-black text-xs font-medium focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-stone-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 font-bold hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black transition cursor-pointer shadow-xs"
                >
                  Confirmar Baixa & Efetivar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL DE IMPRESSÃO DE RECIBO DE REPASSE */}
      {isPrintModalOpen && printTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 border border-stone-300 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Recibo de Quitação de Comissão de Agenciador
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-black bg-white" id="broker-receipt-printable">
              <div className="text-center border-b-2 border-stone-800 pb-3">
                <h2 className="text-base font-black uppercase tracking-wider">
                  RECIBO DE REPASSE DE COMISSÃO
                </h2>
                <p className="text-xs text-stone-600 font-semibold mt-0.5">
                  Intermediação Comercial e Agenciamento Agrícola
                </p>
              </div>

              <div className="text-xs leading-relaxed text-justify space-y-2">
                <p>
                  Recebi(emos) da empresa contratante o valor líquido de{' '}
                  <strong className="text-sm underline">{formatCurrencyBRL(printTarget.netAmount)}</strong>, 
                  referente ao pagamento e repasse de comissões pela intermediação do serviço abaixo especificado:
                </p>
              </div>

              {/* Tabela de Detalhamento */}
              <div className="border border-stone-300 rounded-lg overflow-hidden text-xs">
                <table className="w-full text-left">
                  <tbody>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <td className="p-2 font-bold text-stone-600 w-1/3">Agenciador Beneficiário:</td>
                      <td className="p-2 font-black uppercase">{printTarget.brokerName}</td>
                    </tr>
                    {printTarget.actingRegion && (
                      <tr className="border-b border-stone-200">
                        <td className="p-2 font-bold text-stone-600">Região de Atuação:</td>
                        <td className="p-2 font-bold uppercase text-orange-900">{printTarget.actingRegion}</td>
                      </tr>
                    )}
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <td className="p-2 font-bold text-stone-600">Contrato / Objeto:</td>
                      <td className="p-2 font-medium">{printTarget.description}</td>
                    </tr>
                    {printTarget.orderClientName && (
                      <tr className="border-b border-stone-200">
                        <td className="p-2 font-bold text-stone-600">Produtor / Cliente:</td>
                        <td className="p-2 font-bold uppercase">{printTarget.orderClientName}</td>
                      </tr>
                    )}
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <td className="p-2 font-bold text-stone-600">Base de Cálculo:</td>
                      <td className="p-2 font-semibold">{formatCurrencyBRL(printTarget.baseValue)}</td>
                    </tr>
                    <tr className="border-b border-stone-200">
                      <td className="p-2 font-bold text-stone-600">Regra de Comissão:</td>
                      <td className="p-2 font-semibold">{printTarget.commissionType} ({printTarget.commissionRate}%)</td>
                    </tr>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <td className="p-2 font-bold text-stone-600">Valor Bruto Calculado:</td>
                      <td className="p-2 font-semibold">{formatCurrencyBRL(printTarget.grossAmount)}</td>
                    </tr>
                    {printTarget.deductions && printTarget.deductions > 0 && (
                      <tr className="border-b border-stone-200 text-rose-700">
                        <td className="p-2 font-bold">(-) Deduções / Vales:</td>
                        <td className="p-2 font-bold">-{formatCurrencyBRL(printTarget.deductions)}</td>
                      </tr>
                    )}
                    <tr className="bg-emerald-50">
                      <td className="p-2 font-black text-emerald-950 uppercase">Valor Líquido Repassado:</td>
                      <td className="p-2 font-black text-sm text-emerald-950 font-['Outfit']">
                        {formatCurrencyBRL(printTarget.netAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {printTarget.pixKey && (
                <div className="text-[11px] text-stone-600">
                  <strong>Forma de Quitação:</strong> PIX - Chave: <span className="font-mono">{printTarget.pixKey}</span>
                  {printTarget.paymentDate && ` | Baixa efetuada em: ${formatDateBR(printTarget.paymentDate)}`}
                </div>
              )}

              {/* Data e Assinaturas */}
              <div className="pt-8 space-y-6">
                <div className="text-right text-xs text-stone-700">
                  Data de Emissão: {formatDateBR(printTarget.paymentDate || printTarget.date)}
                </div>

                <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="text-center">
                    <div className="border-t border-stone-800 pt-1.5 text-xs font-bold uppercase">
                      EMPRESA CONTRATANTE
                    </div>
                    <span className="text-[10px] text-stone-500">Silagem Fácil Gestão Agrícola</span>
                  </div>

                  <div className="text-center">
                    <div className="border-t border-stone-800 pt-1.5 text-xs font-bold uppercase">
                      {printTarget.brokerName}
                    </div>
                    <span className="text-[10px] text-stone-500">Agenciador Beneficiário</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-stone-100 border-t border-stone-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 font-bold hover:bg-stone-200 transition cursor-pointer text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-stone-900 hover:bg-black text-white font-bold transition cursor-pointer text-xs shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Recibo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
