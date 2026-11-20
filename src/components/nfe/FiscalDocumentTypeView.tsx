import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  Truck, 
  FileSpreadsheet, 
  ShoppingBag, 
  Plus, 
  Search, 
  Trash2, 
  Eye, 
  Printer, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Calendar, 
  DollarSign, 
  Layers, 
  Package, 
  CreditCard,
  Check,
  RotateCcw,
  Clock,
  ArrowRight,
  Wrench,
  Pencil
} from 'lucide-react';
import { CompanyProfile, Machinery, Supplier } from '../../types';
import { resolveSubscriberPrintHeader, buildSystemPrintFooterHtml } from '../../lib/printIdentity';
import { executePrint } from '../../lib/printService';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredExpenses, 
  saveStoredExpenses,
  getStoredInventory,
  saveStoredInventory,
  getStoredMachineries,
  saveStoredMachineries,
  getActiveCompanyId,
  saveCompanyEstoque,
  removeStockEntryMovementsForInvoice,
  safeLocalStorageSetItem
} from '../../lib/storage';
import { 
  CompetenceSelector, 
  getPrevCompetence, 
  getNextCompetence, 
  matchesCompetence 
} from '../financial/CompetenceSelector';
import { upsertContaAPagar, deleteContaAPagar, isSupabaseConfigured } from '../../lib/supabaseService';
import { useModalUnsavedGuard } from '../../lib/modalUnsavedGuard';
import {
  useGlobalPaymentMethods,
  getPaymentMethodKey,
  getGlobalPaymentMethodLabel,
  normalizeGlobalPaymentMethodKey,
} from '../../lib/paymentMethodsStorage';
import { PaymentMethodsManagerModal } from '../common/PaymentMethodsManager';

export type FiscalDocumentCategory = 'nfe' | 'cte' | 'nfe_c' | 'pedido_compra' | 'nfse';

export interface FiscalDocumentItem {
  id: string;
  productId?: string;
  code?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface FiscalDocumentRecord {
  id: string;
  category: FiscalDocumentCategory;
  documentTypeLabel: string;
  number: string;
  series?: string;
  issueDate: string;
  supplierId?: string;
  supplierName: string;
  supplierCnpj?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  description?: string;
  items: FiscalDocumentItem[];
  totalAmount: number;
  // Campos de NFS-E (ISS Municipal e Retenções)
  issRetained?: boolean;
  issRate?: number;
  issAmount?: number;
  netPayableAmount?: number;
  paymentMethod: string;
  installmentsCount: number;
  installments: Array<{
    number: string;
    dueDate: string;
    amount: number;
    status: 'PENDENTE' | 'PAGO';
  }>;
  status: 'CONFIRMADO' | 'PENDENTE' | 'ATENDIDO' | 'CANCELADO';
  cfop?: string;
  enviarContador?: boolean;
  enviarContadorMotivo?: string;
  notes?: string;
  createdAt: string;
}

export interface FiscalDocumentTypeViewProps {
  category: FiscalDocumentCategory;
  companyProfile: CompanyProfile | null;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  hideCompetenceSelector?: boolean;
  onAddExpenseFromNfe?: (expenseOrList: any) => void;
  onRefreshAll?: () => void;
}

// Chaves de armazenamento específicas por categoria
export const FISCAL_DOCS_STORAGE_KEYS: Record<FiscalDocumentCategory, string> = {
  nfe: 'agrocontrol_notas_nfe',
  cte: 'agrocontrol_notas_cte',
  nfe_c: 'agrocontrol_notas_nfec',
  pedido_compra: 'agrocontrol_pedidos_compra',
  nfse: 'agrocontrol_notas_nfse'
};

const CATEGORY_CONFIG: Record<FiscalDocumentCategory, {
  title: string;
  subtitle: string;
  buttonLabel: string;
  defaultPrefix: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  requiresVehicle: boolean;
  movesStock: boolean;
  isPlanningOnly: boolean;
}> = {
  nfe: {
    title: 'NFE • NOTA FISCAL ELETRÔNICA (COMPRA DE MERCADORIAS/INSUMOS)',
    subtitle: 'Entrada oficial de produtos com incremento positivo no estoque (+) e contas a pagar',
    buttonLabel: 'LANÇAR NF-E (COMPRA)',
    defaultPrefix: 'NFE-',
    icon: FileText,
    color: 'emerald',
    requiresVehicle: false,
    movesStock: true,
    isPlanningOnly: false
  },
  cte: {
    title: 'CT-E • CONHECIMENTO DE TRANSPORTE ELETRÔNICO (FRETE / TRANSPORTE)',
    subtitle: 'Frete e transporte vinculado obrigatoriamente a um veículo da frota com rateio no DRE',
    buttonLabel: 'LANÇAR CT-E (FRETE / TRANSPORTE)',
    defaultPrefix: 'CTE-',
    icon: Truck,
    color: 'sky',
    requiresVehicle: true,
    movesStock: false,
    isPlanningOnly: false
  },
  nfe_c: {
    title: 'NFC-E • NOTA FISCAL DE CONSUMIDOR ELETRÔNICA (CONSUMIDOR FINAL)',
    subtitle: 'Venda a consumidor final e despesas de consumo com lançamento fiscal simplificado',
    buttonLabel: 'LANÇAR NFC-E (CONSUMIDOR FINAL)',
    defaultPrefix: 'NFCE-',
    icon: FileSpreadsheet,
    color: 'amber',
    requiresVehicle: false,
    movesStock: false,
    isPlanningOnly: false
  },
  pedido_compra: {
    title: 'PEDIDO DE COMPRA • RESERVA E PLANEJAMENTO DE SUPRIMENTOS',
    subtitle: 'Ordem de compra em planejamento com status PENDENTE sem débito financeiro imediato',
    buttonLabel: 'NOVO PEDIDO DE COMPRA',
    defaultPrefix: 'PED-',
    icon: ShoppingBag,
    color: 'indigo',
    requiresVehicle: false,
    movesStock: false,
    isPlanningOnly: true
  },
  nfse: {
    title: 'NFS-E • NOTA FISCAL DE SERVIÇO ELETRÔNICA (SERVIÇOS DE TERCEIROS / MANUTENÇÃO)',
    subtitle: 'Serviços tomados, mecânica/manutenção terceirizada da frota, retenção de ISS municipal e rateio no DRE do trator ou caminhão',
    buttonLabel: 'LANÇAR NFS-E (SERVIÇO)',
    defaultPrefix: 'NFSE-',
    icon: Wrench,
    color: 'sky',
    requiresVehicle: false,
    movesStock: false,
    isPlanningOnly: false
  }
};

export const FiscalDocumentTypeView: React.FC<FiscalDocumentTypeViewProps> = ({
  category,
  companyProfile,
  competence,
  onCompetenceChange,
  hideCompetenceSelector = false,
  onAddExpenseFromNfe,
  onRefreshAll
}) => {
  const config = CATEGORY_CONFIG[category];
  const storageKey = FISCAL_DOCS_STORAGE_KEYS[category];

  // Competência ativa
  const activeCompetence = useMemo(() => {
    if (competence && /^\d{2}\/\d{4}$/.test(competence)) return competence;
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence]);

  const handlePrevCompetence = () => {
    const prev = getPrevCompetence(activeCompetence);
    onCompetenceChange?.(prev);
  };

  const handleNextCompetence = () => {
    const next = getNextCompetence(activeCompetence);
    onCompetenceChange?.(next);
  };

  // Estado dos documentos carregados do LocalStorage
  const [documents, setDocuments] = useState<FiscalDocumentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modais de Criação, Visualização e Exclusão
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<FiscalDocumentRecord | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [blockedDeleteDocNumber, setBlockedDeleteDocNumber] = useState<string | null>(null);
  const [effectuatingDocId, setEffectuatingDocId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pull de dados reativo das chaves do LocalStorage (Produtos, Frotas, Fornecedores)
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Machinery[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<any[]>([]);

  // Estados do Formulário de Cadastro
  const [formNumber, setFormNumber] = useState('');
  const [formSeries, setFormSeries] = useState('1');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formFirstDueDate, setFormFirstDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formSupplierName, setFormSupplierName] = useState('');
  const [formSupplierCnpj, setFormSupplierCnpj] = useState('');
  const [formVehicleId, setFormVehicleId] = useState('');
  const { activeMethods: globalPaymentMethods } = useGlobalPaymentMethods();
  const [isPaymentMethodsManagerOpen, setIsPaymentMethodsManagerOpen] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('boleto');
  const [formInstallmentsCount, setFormInstallmentsCount] = useState<number>(1);
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<FiscalDocumentItem[]>([]);
  
  // Retenção de ISS Municipal (específico para NFS-E)
  const [formIssRetained, setFormIssRetained] = useState(false);
  const [formIssRate, setFormIssRate] = useState<number>(5);
  const [formIssAmount, setFormIssAmount] = useState<number>(0);

  // Item sendo adicionado no formulário
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState('UN');
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);
  const [editingFormItemId, setEditingFormItemId] = useState<string | null>(null);

  const fiscalDocGuard = useModalUnsavedGuard({
    isOpen: isCreateModalOpen,
    resetKey: `${category}_${isCreateModalOpen}`,
    snapshot: [
      formNumber,
      formSeries,
      formDate,
      formFirstDueDate,
      formSupplierId,
      formSupplierName,
      formSupplierCnpj,
      formVehicleId,
      formDescription,
      formPaymentMethod,
      formInstallmentsCount,
      formNotes,
      formItems,
      formIssRetained,
      formIssRate,
      itemDescription,
    ],
  });

  const handleAttemptCloseCreateModal = () => {
    fiscalDocGuard.confirmClose(() => setIsCreateModalOpen(false));
  };

  // Carregar dados e documentos reativamente
  const loadData = () => {
    // 1. Carregar documentos desta categoria
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDocuments(parsed);
        }
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.warn(`Erro ao carregar documentos de ${storageKey}:`, err);
      setDocuments([]);
    }

    // 2. Pull de Produtos (agrocontrol_produtos com fallback)
    try {
      const rawProd = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos');
      if (rawProd) {
        const parsed = JSON.parse(rawProd);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAvailableProducts(parsed);
        } else {
          setAvailableProducts(getStoredInventory());
        }
      } else {
        setAvailableProducts(getStoredInventory());
      }
    } catch {
      setAvailableProducts(getStoredInventory());
    }

    // 3. Pull de Veículos da Frota (agrocontrol_frotas_veiculos com fallback)
    try {
      const rawMach = localStorage.getItem('agrocontrol_frotas_veiculos') || 
                      localStorage.getItem('agrocontrol_veiculos') || 
                      localStorage.getItem('colaca_silagem_frotas_veiculos');
      if (rawMach) {
        const parsed = JSON.parse(rawMach);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAvailableVehicles(parsed);
        } else {
          setAvailableVehicles(getStoredMachineries());
        }
      } else {
        setAvailableVehicles(getStoredMachineries());
      }
    } catch {
      setAvailableVehicles(getStoredMachineries());
    }

    // 4. Pull de Fornecedores
    try {
      const rawSupp = localStorage.getItem('agrocontrol_fornecedores') || localStorage.getItem('silagem_facil_clean_v1_suppliers');
      if (rawSupp) {
        const parsed = JSON.parse(rawSupp);
        if (Array.isArray(parsed)) setAvailableSuppliers(parsed);
      }
    } catch (err) {
      console.warn('Erro ao carregar fornecedores:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [category, storageKey]);

  // Totalizador de Itens
  const totalFormAmount = useMemo(() => {
    return formItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
  }, [formItems]);

  const calculatedIssAmount = useMemo(() => {
    if (!formIssRetained) return 0;
    return Number(((totalFormAmount * formIssRate) / 100).toFixed(2));
  }, [formIssRetained, totalFormAmount, formIssRate]);

  const netPayableTotal = useMemo(() => {
    if (!formIssRetained) return totalFormAmount;
    return Math.max(0, Number((totalFormAmount - calculatedIssAmount).toFixed(2)));
  }, [totalFormAmount, formIssRetained, calculatedIssAmount]);

  // Gerar número sequencial padrão ao abrir modal
  const handleOpenCreateModal = () => {
    const nextSeq = String(documents.length + 1).padStart(4, '0');
    setFormNumber(`${config.defaultPrefix}${nextSeq}`);
    setFormSeries('1');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormSupplierId('');
    setFormSupplierName('');
    setFormSupplierCnpj('');
    setFormVehicleId('');
    setFormDescription(category === 'cte' ? 'Frete rodoviário de silagem / insumos agrícolas' : category === 'nfse' ? 'Serviços de mecânica / manutenção terceirizada da frota' : '');
    setFormPaymentMethod('boleto');
    setFormInstallmentsCount(1);
    setFormFirstDueDate(formDate || new Date().toISOString().split('T')[0]);
    setFormNotes('');
    setFormItems([]);
    setFormIssRetained(false);
    setFormIssRate(5);
    setFormIssAmount(0);
    setSelectedProductId('');
    setItemDescription('');
    setItemQuantity(1);
    setItemUnit('UN');
    setItemUnitPrice(0);
    setEditingFormItemId(null);
    setIsCreateModalOpen(true);
  };

  // Carregar item existente para edição na barra superior
  const handleEditItemFromForm = (item: FiscalDocumentItem) => {
    setSelectedProductId(item.productId || '');
    setItemDescription(item.description || '');
    setItemQuantity(Number(item.quantity) || 1);
    setItemUnit(item.unit || 'UN');
    setItemUnitPrice(Number(item.unitPrice) || 0);
    setEditingFormItemId(item.id);
  };

  // Adicionar ou atualizar item na tabela temporária do formulário
  const handleAddItemToForm = () => {
    if (!itemDescription.trim()) {
      alert('POR FAVOR, INFORME A DESCRIÇÃO DO ITEM.');
      return;
    }
    if (itemQuantity <= 0) {
      alert('A QUANTIDADE DEVE SER MAIOR QUE ZERO.');
      return;
    }
    if (itemUnitPrice < 0) {
      alert('O VALOR UNITÁRIO NÃO PODE SER NEGATIVO.');
      return;
    }

    const newItem: FiscalDocumentItem = {
      id: editingFormItemId || `it_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      productId: selectedProductId || undefined,
      description: itemDescription.trim().toUpperCase(),
      quantity: Number(itemQuantity),
      unit: itemUnit.toUpperCase().trim(),
      unitPrice: Number(itemUnitPrice),
      totalPrice: Number((itemQuantity * itemUnitPrice).toFixed(2))
    };

    if (editingFormItemId) {
      setFormItems(prev => prev.map(it => (it.id === editingFormItemId ? newItem : it)));
      setEditingFormItemId(null);
    } else {
      setFormItems(prev => [...prev, newItem]);
    }
    // Reseta campos do item
    setSelectedProductId('');
    setItemDescription('');
    setItemQuantity(1);
    setItemUnit('UN');
    setItemUnitPrice(0);
  };

  const handleRemoveItemFromForm = (itemId: string) => {
    setFormItems(prev => prev.filter(it => it.id !== itemId));
    if (editingFormItemId === itemId) setEditingFormItemId(null);
  };

  // Mudança do seletor de produtos
  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    if (!prodId) {
      setItemDescription('');
      setItemUnitPrice(0);
      setItemUnit('UN');
      return;
    }
    const found = availableProducts.find(p => p.id === prodId || p.code === prodId);
    if (found) {
      setItemDescription(found.name || found.description || '');
      setItemUnit(found.unit || 'UN');
      setItemUnitPrice(found.costPrice || found.price || found.unitPrice || 0);
    }
  };

  // Mudança do seletor de fornecedor
  const handleSelectSupplier = (suppId: string) => {
    setFormSupplierId(suppId);
    const found = availableSuppliers.find(s => s.id === suppId);
    if (found) {
      setFormSupplierName(found.name || found.tradeName || found.corporateName || '');
      setFormSupplierCnpj(found.cnpj || found.cpfCnpj || '');
    }
  };

  // ---------------------------------------------------------------------------
  // MOTOR DE INTEGRAÇÃO REATIVA AO SALVAR DOCUMENTO (100% OFFLINE LOCALSTORAGE)
  // ---------------------------------------------------------------------------
  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formNumber.trim()) {
      alert('O NÚMERO DO DOCUMENTO É OBRIGATÓRIO.');
      return;
    }

    if (!formSupplierName.trim()) {
      alert('O NOME DO FORNECEDOR / TRANSPORTADORA É OBRIGATÓRIO.');
      return;
    }

    // Validação obrigatória para CTE
    if (config.requiresVehicle && !formVehicleId) {
      alert('NA ABA CT-E, É OBRIGATÓRIO VINCULAR UM VEÍCULO DA FROTA.');
      return;
    }

    // Validação de itens para NFE e Pedido de Compra
    if ((category === 'nfe' || category === 'pedido_compra') && formItems.length === 0) {
      alert('ADICIONE AO MENOS UM ITEM NA LISTA DE PRODUTOS/INSUMOS.');
      return;
    }

    // Se for CTE, NFE-C ou NFS-E e não adicionou itens na tabela, gera 1 item padrão com o valor total
    let finalItems = [...formItems];
    let finalTotal = totalFormAmount;
    if (finalItems.length === 0 && (category === 'cte' || category === 'nfe_c' || category === 'nfse')) {
      const parsedVal = prompt(`INFORME O VALOR TOTAL DO ${category === 'nfse' ? 'SERVIÇO' : 'DOCUMENTO'} EM R$:`, '0.00');
      const numVal = parseFloat(String(parsedVal).replace(',', '.')) || 0;
      if (numVal <= 0) {
        alert('VALOR INVÁLIDO.');
        return;
      }
      finalTotal = numVal;
      finalItems = [{
        id: `it_${Date.now()}`,
        description: formDescription || (category === 'cte' ? 'FRETE E TRANSPORTE RODOVIÁRIO' : category === 'nfse' ? 'SERVIÇOS DE MANUTENÇÃO / MECÂNICA' : 'COMPLEMENTO FISCAL'),
        quantity: 1,
        unit: 'UN',
        unitPrice: numVal,
        totalPrice: numVal
      }];
    }

    const selectedVehicle = availableVehicles.find(v => v.id === formVehicleId);
    const plate = selectedVehicle ? (selectedVehicle.licensePlateOrSerial || (selectedVehicle as any).placa || '') : '';
    const model = selectedVehicle ? (selectedVehicle.model || selectedVehicle.name || '') : '';

    // Cálculo de Retenção de ISS Municipal
    const issAmountVal = formIssRetained ? Number(((finalTotal * formIssRate) / 100).toFixed(2)) : 0;
    const netPayableVal = formIssRetained ? Math.max(0, Number((finalTotal - issAmountVal).toFixed(2))) : finalTotal;
    const payableForInstallments = formIssRetained ? netPayableVal : finalTotal;

    // Geração de Parcelas no Contas a Pagar (aritmética de data local para evitar deslocamento UTC)
    const installments = [];
    const count = Math.max(1, formInstallmentsCount);
    const parcelValue = Number((payableForInstallments / count).toFixed(2));
    const anchorDate = (formFirstDueDate && /^\d{4}-\d{2}-\d{2}/.test(formFirstDueDate))
      ? formFirstDueDate
      : formDate;
    const [baseYear, baseMonth, baseDay] = (anchorDate && /^\d{4}-\d{2}-\d{2}/.test(anchorDate))
      ? anchorDate.split('T')[0].split('-').map(Number)
      : [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()];

    for (let i = 1; i <= count; i++) {
      const due = new Date(baseYear, baseMonth - 1, baseDay);
      due.setDate(due.getDate() + ((i - 1) * 30));
      const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      installments.push({
        number: `${String(i).padStart(2, '0')}/${String(count).padStart(2, '0')}`,
        dueDate: dueStr,
        amount: i === count ? Number((payableForInstallments - parcelValue * (count - 1)).toFixed(2)) : parcelValue,
        status: 'PENDENTE' as const
      });
    }

    const activeTenantId = getActiveCompanyId() || companyProfile?.id || 'default';
    const docId = `doc_${category}_${Date.now()}`;
    const newRecord: FiscalDocumentRecord = {
      id: docId,
      category,
      documentTypeLabel: config.title.split('•')[0].trim(),
      number: formNumber.trim().toUpperCase(),
      series: formSeries.trim().toUpperCase(),
      issueDate: formDate,
      supplierId: formSupplierId || undefined,
      supplierName: formSupplierName.trim().toUpperCase(),
      supplierCnpj: formSupplierCnpj.trim().toUpperCase(),
      vehicleId: formVehicleId || undefined,
      vehiclePlate: plate ? plate.toUpperCase() : undefined,
      vehicleModel: model ? model.toUpperCase() : undefined,
      description: formDescription.trim().toUpperCase(),
      items: finalItems,
      totalAmount: finalTotal,
      issRetained: formIssRetained,
      issRate: formIssRetained ? formIssRate : undefined,
      issAmount: formIssRetained ? issAmountVal : undefined,
      netPayableAmount: formIssRetained ? netPayableVal : finalTotal,
      paymentMethod: getGlobalPaymentMethodLabel(formPaymentMethod),
      installmentsCount: count,
      installments,
      status: config.isPlanningOnly ? 'PENDENTE' : 'CONFIRMADO',
      notes: formNotes.trim().toUpperCase(),
      createdAt: new Date().toISOString()
    };

    // 1. Salvar no array da respectiva categoria
    const updatedDocs = [newRecord, ...documents];
    setDocuments(updatedDocs);
    safeLocalStorageSetItem(storageKey, JSON.stringify(updatedDocs));

    // Salvar também em agrocontrol_notas_entradas com chave padronizada
    try {
      const rawUnified = localStorage.getItem('agrocontrol_notas_entradas');
      const listUnified = rawUnified ? JSON.parse(rawUnified) : [];
      if (Array.isArray(listUnified)) {
        listUnified.unshift(newRecord);
        safeLocalStorageSetItem('agrocontrol_notas_entradas', JSON.stringify(listUnified));
      }
    } catch (err) {
      console.warn('Erro ao unificar nota de entrada:', err);
    }

    // 2. DISPARO DE MOVIMENTOS OPERACIONAIS ESPECÍFICOS:
    // A) ABA NFE (COMPRA DE MERCADORIAS/INSUMOS):
    // Injeta quantidade positiva no estoque ('+') e gera Contas a Pagar
    if (category === 'nfe') {
      try {
        const storedInventory = getStoredInventory();
        let inventoryChanged = false;

        finalItems.forEach(item => {
          if (item.quantity > 0) {
            const idx = storedInventory.findIndex(p => 
              (item.productId && p.id === item.productId) || 
              (p.name && p.name.trim().toUpperCase() === item.description.trim().toUpperCase())
            );

            if (idx >= 0) {
              const currentQtd = (storedInventory[idx] as any).quantity ?? (storedInventory[idx] as any).currentStock ?? 0;
              (storedInventory[idx] as any).quantity = currentQtd + item.quantity;
              (storedInventory[idx] as any).currentStock = currentQtd + item.quantity;
              if (item.unitPrice > 0) {
                (storedInventory[idx] as any).unitCost = item.unitPrice;
                (storedInventory[idx] as any).costPrice = item.unitPrice;
              }
              inventoryChanged = true;
            } else {
              // Cadastra novo item no estoque se não existir
              storedInventory.push({
                id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                name: item.description,
                unit: item.unit || 'UN',
                quantity: item.quantity,
                minQuantity: 1,
                unitCost: item.unitPrice,
                category: 'Insumos Agrícolas'
              } as any);
              inventoryChanged = true;
            }
          }
        });

        if (inventoryChanged) {
          saveStoredInventory(storedInventory);
          window.dispatchEvent(new CustomEvent('silagem_inventory_updated', { detail: storedInventory }));
        }
      } catch (err) {
        console.warn('Erro ao atualizar estoque da NF-e:', err);
      }

      // Gera parcelas no Contas a Pagar (agrocontrol_financeiro + contas_a_pagar)
      try {
        const storedExpenses = getStoredExpenses().filter((e: any) => e.notaId !== docId);
        const newExpenses: any[] = installments.map((inst, idx) => ({
          id: `desp_nfe_${docId}_${idx + 1}`,
          companyId: activeTenantId,
          description: `NF-E ${newRecord.number} - ${newRecord.supplierName} (PARC ${inst.number})`,
          amount: inst.amount,
          valor_parcela: inst.amount,
          date: newRecord.issueDate,
          dueDate: inst.dueDate,
          data_vencimento: inst.dueDate,
          categoryId: 'cat_insumos',
          categoryName: 'Compras e Insumos Agrícolas',
          categoryColor: '#10b981',
          costCenterName: 'Almoxarifado & Estoque',
          status: 'pendente',
          paymentMethod: normalizeGlobalPaymentMethodKey(formPaymentMethod) || formPaymentMethod || 'boleto',
          supplier: newRecord.supplierName,
          fornecedor: newRecord.supplierName,
          supplierName: newRecord.supplierName,
          invoiceNumber: newRecord.number,
          notaId: docId,
          documento_entrada_id: docId,
          numero_parcela: inst.number,
          createdAt: new Date().toISOString()
        }));

        const updatedExpenses = [...newExpenses, ...storedExpenses];
        saveStoredExpenses(updatedExpenses as any);
        window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: updatedExpenses }));
        if (onAddExpenseFromNfe && newExpenses.length > 0) {
          onAddExpenseFromNfe(newExpenses);
        }
        if (isSupabaseConfigured) {
          newExpenses.forEach(exp => {
            upsertContaAPagar({
              id: exp.id,
              nota_fiscal_id: null,
              numero_parcela: exp.numero_parcela,
              valor_parcela: exp.amount,
              data_vencimento: exp.dueDate,
              forma_pagamento: exp.paymentMethod,
              centro_custo: exp.costCenterName,
              status_pago: false
            }, activeTenantId).catch(() => {});
          });
        }
      } catch (err) {
        console.warn('Erro ao gerar despesas financeiras da NF-e:', err);
      }
    }

    // B) ABA CTE (FRETE E LOGÍSTICA):
    // Não movimenta estoque ('='). Lança no Contas a Pagar e insere no DRE individual daquele veículo
    if (category === 'cte') {
      // 1. Atualiza DRE individual do veículo da frota
      if (selectedVehicle) {
        try {
          const storedMachineries = getStoredMachineries();
          const vIdx = storedMachineries.findIndex(m => m.id === selectedVehicle.id);
          if (vIdx >= 0) {
            storedMachineries[vIdx].accumulatedCost = (storedMachineries[vIdx].accumulatedCost || 0) + finalTotal;
            (storedMachineries[vIdx] as any).totalFreightExpenses = ((storedMachineries[vIdx] as any).totalFreightExpenses || 0) + finalTotal;
            saveStoredMachineries(storedMachineries);
            window.dispatchEvent(new CustomEvent('silagem_machineries_updated', { detail: storedMachineries }));
          }
        } catch (err) {
          console.warn('Erro ao ratear CT-e no veículo da frota:', err);
        }
      }

      // 2. Lança no Contas a Pagar
      try {
        const storedExpenses = getStoredExpenses().filter((e: any) => e.notaId !== docId);
        const newExpenses: any[] = installments.map((inst, idx) => ({
          id: `desp_cte_${docId}_${idx + 1}`,
          companyId: activeTenantId,
          description: `CT-E ${newRecord.number} - FRETE VEÍCULO ${plate || 'FROTA'} (${newRecord.supplierName})`,
          amount: inst.amount,
          valor_parcela: inst.amount,
          date: newRecord.issueDate,
          dueDate: inst.dueDate,
          data_vencimento: inst.dueDate,
          categoryId: 'cat_fretes',
          categoryName: 'Fretes e Logística de Frota',
          categoryColor: '#0284c7',
          costCenterName: plate ? `Veículo ${plate}` : 'Frotas & Logística',
          status: 'pendente',
          paymentMethod: normalizeGlobalPaymentMethodKey(formPaymentMethod) || formPaymentMethod || 'boleto',
          supplier: newRecord.supplierName,
          fornecedor: newRecord.supplierName,
          supplierName: newRecord.supplierName,
          invoiceNumber: newRecord.number,
          vehicleId: formVehicleId,
          vehiclePlate: plate,
          notaId: docId,
          documento_entrada_id: docId,
          numero_parcela: inst.number,
          createdAt: new Date().toISOString()
        }));

        const updatedExpenses = [...newExpenses, ...storedExpenses];
        saveStoredExpenses(updatedExpenses as any);
        window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: updatedExpenses }));
        if (onAddExpenseFromNfe && newExpenses.length > 0) {
          onAddExpenseFromNfe(newExpenses);
        }
        if (isSupabaseConfigured) {
          newExpenses.forEach(exp => {
            upsertContaAPagar({
              id: exp.id,
              nota_fiscal_id: null,
              numero_parcela: exp.numero_parcela,
              valor_parcela: exp.amount,
              data_vencimento: exp.dueDate,
              forma_pagamento: exp.paymentMethod,
              centro_custo: exp.costCenterName,
              status_pago: false
            }, activeTenantId).catch(() => {});
          });
        }
      } catch (err) {
        console.warn('Erro ao gerar despesas financeiras do CT-e:', err);
      }
    }

    // C) ABA NFE-C (NOTA FISCAL COMPLEMENTAR):
    // Lança valor complementar no Contas a Pagar sem movimentar estoque
    if (category === 'nfe_c') {
      try {
        const storedExpenses = getStoredExpenses().filter((e: any) => e.notaId !== docId);
        const newExpenses: any[] = installments.map((inst, idx) => ({
          id: `desp_nfec_${docId}_${idx + 1}`,
          companyId: activeTenantId,
          description: `NF-E COMPLEMENTAR ${newRecord.number} - ${newRecord.supplierName}`,
          amount: inst.amount,
          valor_parcela: inst.amount,
          date: newRecord.issueDate,
          dueDate: inst.dueDate,
          data_vencimento: inst.dueDate,
          categoryId: 'cat_fiscal',
          categoryName: 'Complementos e Ajustes Fiscais',
          categoryColor: '#d97706',
          costCenterName: 'Administrativo & Fiscal',
          status: 'pendente',
          paymentMethod: normalizeGlobalPaymentMethodKey(formPaymentMethod) || formPaymentMethod || 'boleto',
          supplier: newRecord.supplierName,
          fornecedor: newRecord.supplierName,
          supplierName: newRecord.supplierName,
          invoiceNumber: newRecord.number,
          notaId: docId,
          documento_entrada_id: docId,
          numero_parcela: inst.number,
          createdAt: new Date().toISOString()
        }));

        const updatedExpenses = [...newExpenses, ...storedExpenses];
        saveStoredExpenses(updatedExpenses as any);
        window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: updatedExpenses }));
        if (onAddExpenseFromNfe && newExpenses.length > 0) {
          onAddExpenseFromNfe(newExpenses);
        }
        if (isSupabaseConfigured) {
          newExpenses.forEach(exp => {
            upsertContaAPagar({
              id: exp.id,
              nota_fiscal_id: null,
              numero_parcela: exp.numero_parcela,
              valor_parcela: exp.amount,
              data_vencimento: exp.dueDate,
              forma_pagamento: exp.paymentMethod,
              centro_custo: exp.costCenterName,
              status_pago: false
            }, activeTenantId).catch(() => {});
          });
        }
      } catch (err) {
        console.warn('Erro ao gerar despesas financeiras da NF-e C:', err);
      }
    }

    // D) ABA NFS-E (NOTA FISCAL DE SERVIÇOS TOMADOS / MANUTENÇÃO TERCEIRIZADA):
    if (category === 'nfse') {
      // 1. Se vinculou veículo (trator, caminhão ou máquina), rateia no DRE e custos do veículo
      if (selectedVehicle) {
        try {
          const storedMachineries = getStoredMachineries();
          const vIdx = storedMachineries.findIndex(m => m.id === selectedVehicle.id);
          if (vIdx >= 0) {
            storedMachineries[vIdx].accumulatedCost = (storedMachineries[vIdx].accumulatedCost || 0) + finalTotal;
            (storedMachineries[vIdx] as any).totalMaintenanceExpenses = ((storedMachineries[vIdx] as any).totalMaintenanceExpenses || 0) + finalTotal;
            (storedMachineries[vIdx] as any).maintenanceCost = ((storedMachineries[vIdx] as any).maintenanceCost || 0) + finalTotal;
            saveStoredMachineries(storedMachineries);
            window.dispatchEvent(new CustomEvent('silagem_machineries_updated', { detail: storedMachineries }));
          }
        } catch (err) {
          console.warn('Erro ao ratear NFS-e no veículo da frota:', err);
        }
      }

      // 2. Lança parcelas automáticas no Contas a Pagar (agrocontrol_financeiro + contas_a_pagar)
      try {
        const storedExpenses = getStoredExpenses().filter((e: any) => e.notaId !== docId);
        const newExpenses: any[] = installments.map((inst, idx) => ({
          id: `desp_nfse_${docId}_${idx + 1}`,
          companyId: activeTenantId,
          description: `NFS-E ${newRecord.number} - ${newRecord.supplierName}${plate ? ` (VEÍCULO ${plate})` : ''} [PARC ${inst.number}]`,
          amount: inst.amount,
          valor_parcela: inst.amount,
          date: newRecord.issueDate,
          dueDate: inst.dueDate,
          data_vencimento: inst.dueDate,
          categoryId: 'cat_manutencao',
          categoryName: 'Serviços Terceirizados & Manutenção',
          categoryColor: '#0ea5e9',
          costCenterName: plate ? `Veículo ${plate}` : 'Oficina & Manutenção',
          status: 'pendente',
          paymentMethod: normalizeGlobalPaymentMethodKey(formPaymentMethod) || formPaymentMethod || 'boleto',
          supplier: newRecord.supplierName,
          fornecedor: newRecord.supplierName,
          supplierName: newRecord.supplierName,
          invoiceNumber: newRecord.number,
          vehicleId: formVehicleId || undefined,
          vehiclePlate: plate || undefined,
          notaId: docId,
          documento_entrada_id: docId,
          numero_parcela: inst.number,
          createdAt: new Date().toISOString()
        }));

        const updatedExpenses = [...newExpenses, ...storedExpenses];
        saveStoredExpenses(updatedExpenses as any);
        window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: updatedExpenses }));
        if (onAddExpenseFromNfe && newExpenses.length > 0) {
          onAddExpenseFromNfe(newExpenses);
        }
        if (isSupabaseConfigured) {
          newExpenses.forEach(exp => {
            upsertContaAPagar({
              id: exp.id,
              nota_fiscal_id: null,
              numero_parcela: exp.numero_parcela,
              valor_parcela: exp.amount,
              data_vencimento: exp.dueDate,
              forma_pagamento: exp.paymentMethod,
              centro_custo: exp.costCenterName,
              status_pago: false
            }, activeTenantId).catch(() => {});
          });
        }
      } catch (err) {
        console.warn('Erro ao gerar despesas financeiras da NFS-e:', err);
      }
    }

    // E) ABA PEDIDO DE COMPRA:
    // Não movimenta estoque nem financeiro imediato (permanece PENDENTE como reserva/planejamento)

    setIsCreateModalOpen(false);
    setFeedback({
      type: 'success',
      text: `${config.title.split('•')[0].trim()} ${newRecord.number} LANÇADO COM SUCESSO!`
    });
    setTimeout(() => setFeedback(null), 5000);

    if (onRefreshAll) onRefreshAll();
  };

  // Efetivar Pedido de Compra Pendente (converte em entrada e movimenta estoque/financeiro)
  const handleConfirmEffectuateOrder = (orderId: string) => {
    const target = documents.find(d => d.id === orderId);
    if (!target) return;

    // Atualiza status do pedido para ATENDIDO
    const updated = documents.map(d => {
      if (d.id === orderId) {
        return { ...d, status: 'ATENDIDO' as const };
      }
      return d;
    });
    setDocuments(updated);
    safeLocalStorageSetItem(storageKey, JSON.stringify(updated));

    // Injeta estoque (+) dos produtos do pedido
    try {
      const storedInventory = getStoredInventory();
      let inventoryChanged = false;

      target.items.forEach(item => {
        if (item.quantity > 0) {
          const idx = storedInventory.findIndex(p => 
            (item.productId && p.id === item.productId) || 
            (p.name && p.name.trim().toUpperCase() === item.description.trim().toUpperCase())
          );

          if (idx >= 0) {
            const currentQtd = (storedInventory[idx] as any).quantity ?? (storedInventory[idx] as any).currentStock ?? 0;
            (storedInventory[idx] as any).quantity = currentQtd + item.quantity;
            (storedInventory[idx] as any).currentStock = currentQtd + item.quantity;
            inventoryChanged = true;
          }
        }
      });

      if (inventoryChanged) {
        saveStoredInventory(storedInventory);
        window.dispatchEvent(new CustomEvent('silagem_inventory_updated', { detail: storedInventory }));
      }
    } catch (err) {
      console.warn('Erro ao efetivar estoque do pedido:', err);
    }

    // Gera parcelas no Contas a Pagar
    try {
      const activeTenantId = getActiveCompanyId() || companyProfile?.id || 'default';
      const storedExpenses = getStoredExpenses().filter((e: any) => e.notaId !== target.id);
      const newExpenses: any[] = target.installments.map((inst, idx) => ({
        id: `desp_ped_${target.id}_${idx + 1}`,
        companyId: activeTenantId,
        description: `PEDIDO EFETIVADO ${target.number} - ${target.supplierName}`,
        amount: inst.amount,
        valor_parcela: inst.amount,
        date: new Date().toISOString().split('T')[0],
        dueDate: inst.dueDate,
        data_vencimento: inst.dueDate,
        categoryId: 'cat_insumos',
        categoryName: 'Compras e Insumos Agrícolas',
        categoryColor: '#10b981',
        costCenterName: 'Almoxarifado & Estoque',
        status: 'pendente',
        paymentMethod: 'boleto',
        supplier: target.supplierName,
        fornecedor: target.supplierName,
        supplierName: target.supplierName,
        invoiceNumber: target.number,
        notaId: target.id,
        documento_entrada_id: target.id,
        numero_parcela: inst.number || `${idx + 1}/${target.installments.length}`,
        createdAt: new Date().toISOString()
      }));

      const updatedExpenses = [...newExpenses, ...storedExpenses];
      saveStoredExpenses(updatedExpenses as any);
      window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: updatedExpenses }));
      if (onAddExpenseFromNfe && newExpenses.length > 0) {
        onAddExpenseFromNfe(newExpenses);
      }
      if (isSupabaseConfigured) {
        newExpenses.forEach(exp => {
          upsertContaAPagar({
            id: exp.id,
            nota_fiscal_id: null,
            numero_parcela: exp.numero_parcela,
            valor_parcela: exp.amount,
            data_vencimento: exp.dueDate,
            forma_pagamento: exp.paymentMethod,
            centro_custo: exp.costCenterName,
            status_pago: false
          }, activeTenantId).catch(() => {});
        });
      }
    } catch (err) {
      console.warn('Erro ao efetivar financeiro do pedido:', err);
    }

    setEffectuatingDocId(null);
    setFeedback({
      type: 'success',
      text: `PEDIDO ${target.number} EFETIVADO COM SUCESSO! ESTOQUE E FINANCEIRO ATUALIZADOS.`
    });
    setTimeout(() => setFeedback(null), 5000);

    if (onRefreshAll) onRefreshAll();
  };

  const hasSettledPayableForDocument = (docId: string): boolean => {
    try {
      const storedExpenses = getStoredExpenses();
      return storedExpenses.some((e: any) => {
        const match =
          e?.notaId === docId ||
          e?.documento_entrada_id === docId ||
          (typeof e?.id === 'string' && e.id.includes(docId));
        if (!match) return false;
        const statusLower = String(e?.status || '').toLowerCase();
        return (
          statusLower === 'pago' ||
          statusLower === 'liquidado / abatido por devolução' ||
          e?.status_pago === true
        );
      });
    } catch {
      return false;
    }
  };

  const requestDeleteDocument = (doc: FiscalDocumentRecord) => {
    if (hasSettledPayableForDocument(doc.id)) {
      setBlockedDeleteDocNumber(doc.number || doc.id);
      return;
    }
    setDeletingDocId(doc.id);
  };

  // Excluir documento do histórico
  const handleConfirmDeleteDocument = () => {
    if (!deletingDocId) return;
    const targetDoc = documents.find(d => d.id === deletingDocId);
    if (targetDoc && hasSettledPayableForDocument(targetDoc.id)) {
      setDeletingDocId(null);
      setBlockedDeleteDocNumber(targetDoc.number || targetDoc.id);
      return;
    }

    const activeTenantId = getActiveCompanyId() || companyProfile?.id || 'default';

    // Reverte movimentação de estoque (+) aplicada pela entrada/efetivação, garantindo mínimo 0
    if (
      targetDoc &&
      (category === 'nfe' || (category === 'pedido_compra' && targetDoc.status === 'ATENDIDO')) &&
      Array.isArray(targetDoc.items) &&
      targetDoc.items.length > 0
    ) {
      try {
        const storedInventory = getStoredInventory();
        let inventoryChanged = false;

        targetDoc.items.forEach(item => {
          const qtyToRevert = Number(item.quantity) || 0;
          if (qtyToRevert <= 0) return;

          const idx = storedInventory.findIndex(p =>
            (item.productId && p.id === item.productId) ||
            (p.name && p.name.trim().toUpperCase() === item.description.trim().toUpperCase())
          );

          if (idx >= 0) {
            const currentQtd = Number((storedInventory[idx] as any).quantity ?? (storedInventory[idx] as any).currentStock ?? 0);
            const nextQtd = Math.max(0, currentQtd - qtyToRevert);
            (storedInventory[idx] as any).quantity = nextQtd;
            (storedInventory[idx] as any).currentStock = nextQtd;
            inventoryChanged = true;
          }
        });

        if (inventoryChanged) {
          saveStoredInventory(storedInventory);
          saveCompanyEstoque(storedInventory, activeTenantId);
          window.dispatchEvent(new CustomEvent('silagem_inventory_updated', { detail: storedInventory }));
        }
      } catch (err) {
        console.warn('Erro ao reverter estoque na exclusão do documento:', err);
      }

      try {
        removeStockEntryMovementsForInvoice({
          notaId: deletingDocId,
          invoiceNumber: targetDoc.number
        });
      } catch {}
    }

    const updated = documents.filter(d => d.id !== deletingDocId);
    setDocuments(updated);
    safeLocalStorageSetItem(storageKey, JSON.stringify(updated));

    // Remove também da chave unificada
    try {
      const rawUnified = localStorage.getItem('agrocontrol_notas_entradas');
      if (rawUnified) {
        const list = JSON.parse(rawUnified);
        if (Array.isArray(list)) {
          const filtered = list.filter(d => d.id !== deletingDocId);
          safeLocalStorageSetItem('agrocontrol_notas_entradas', JSON.stringify(filtered));
        }
      }
    } catch {}

    // Remove despesas vinculadas ao documento excluido no Contas a Pagar
    try {
      const storedExpenses = getStoredExpenses();
      const removedIds: string[] = [];
      const keptExpenses = storedExpenses.filter((e: any) => {
        const match =
          e?.notaId === deletingDocId ||
          e?.documento_entrada_id === deletingDocId ||
          (typeof e?.id === 'string' && e.id.includes(deletingDocId));
        if (match) {
          if (e?.id) removedIds.push(e.id);
          return false;
        }
        return true;
      });
      if (removedIds.length > 0) {
        saveStoredExpenses(keptExpenses);
        window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: keptExpenses }));
        if (isSupabaseConfigured) {
          removedIds.forEach(rid => deleteContaAPagar(rid, activeTenantId).catch(() => {}));
        }
      }
    } catch {}

    setDeletingDocId(null);
    setFeedback({
      type: 'success',
      text: 'DOCUMENTO EXCLUÍDO DO REGISTRO LOCAL E ESTOQUE REVERTIDO COM SUCESSO.'
    });
    setTimeout(() => setFeedback(null), 4000);
    if (onRefreshAll) onRefreshAll();
  };

  // ---------------------------------------------------------------------------
  // MOTOR DE IMPRESSÃO A4 COM BYPASS BLINDADO DE SANDBOX (NOVA ABA + ONLOAD)
  // ---------------------------------------------------------------------------
  const handlePrintDocument = (doc: FiscalDocumentRecord) => {
    try {
      const subHeader = resolveSubscriberPrintHeader(companyProfile);
      const subscriberTitle = subHeader.displayTitle;
      const subscriberCorporate = subHeader.corporateName && subHeader.corporateName !== subHeader.displayTitle ? subHeader.corporateName : '';
      const subscriberCnpj = subHeader.cnpjCpf;
      const subscriberPhone = subHeader.phone;
      const subscriberAddress = subHeader.fullAddress;

      const itemsHtml = doc.items.map((item, idx) => `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 4px 6px; text-align: center; font-size: 10px; font-weight: bold;">${String(idx + 1).padStart(2, '0')}</td>
          <td style="padding: 4px 6px; font-size: 10px; font-weight: bold;">${item.description}</td>
          <td style="padding: 4px 6px; text-align: center; font-size: 10px; font-weight: bold;">${item.quantity}</td>
          <td style="padding: 4px 6px; text-align: center; font-size: 10px;">${item.unit}</td>
          <td style="padding: 4px 6px; text-align: right; font-size: 10px;">${formatCurrencyBRL(item.unitPrice)}</td>
          <td style="padding: 4px 6px; text-align: right; font-size: 10px; font-weight: bold;">${formatCurrencyBRL(item.totalPrice)}</td>
        </tr>
      `).join('');

      const installmentsHtml = doc.installments.map(inst => `
        <div style="border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 6px; background-color: #f8fafc; font-size: 9px; text-align: center;">
          <div style="font-weight: bold; color: #334155;">PARC ${inst.number}</div>
          <div style="font-size: 10px; font-weight: 800; color: #047857;">${formatCurrencyBRL(inst.amount)}</div>
          <div style="color: #64748b; font-size: 8px;">VENC: ${formatDateBR(inst.dueDate)}</div>
        </div>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${doc.documentTypeLabel} ${doc.number} - ${subscriberTitle}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                @page { size: A4 portrait; margin: 10mm 10mm 10mm 10mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #0f172a;
                background-color: #ffffff;
                margin: 0;
                padding: 10mm;
                text-transform: uppercase;
              }
              .box {
                border: 1px solid #94a3b8;
                border-radius: 6px;
                padding: 8px 10px;
                margin-bottom: 8px;
              }
              .title-bar {
                background-color: #e2e8f0;
                font-size: 11px;
                font-weight: 900;
                padding: 4px 8px;
                border-bottom: 1px solid #94a3b8;
                margin: -8px -10px 8px -10px;
                border-radius: 5px 5px 0 0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th {
                background-color: #e2e8f0;
                border: 1px solid #cbd5e1;
                padding: 4px 6px;
                font-size: 9px;
                font-weight: 900;
              }
            </style>
          </head>
          <body onload="window.print();">
            <!-- CABEÇALHO DA EMPRESA -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px;">
              <div>
                <h1 style="font-size: 16px; font-weight: 900; margin: 0; color: #0f172a;">${subscriberTitle}</h1>
                ${subscriberCorporate ? `<div style="font-size: 10px; color: #334155; font-weight: 700;">${subscriberCorporate}</div>` : ''}
                ${(subscriberCnpj || subscriberPhone) ? `<div style="font-size: 10px; color: #334155; font-weight: bold;">${[subscriberCnpj ? `CNPJ/CPF: ${subscriberCnpj}` : '', subscriberPhone ? `CONTATO: ${subscriberPhone}` : ''].filter(Boolean).join(' • ')}</div>` : ''}
                ${subscriberAddress ? `<div style="font-size: 9px; color: #64748b;">${subscriberAddress}</div>` : ''}
              </div>
              <div style="text-align: right; border: 2px solid #0f172a; border-radius: 6px; padding: 6px 12px; background-color: #f1f5f9;">
                <div style="font-size: 11px; font-weight: 900; color: #047857;">${doc.documentTypeLabel}</div>
                <div style="font-size: 14px; font-weight: 900; color: #0f172a;">Nº ${doc.number}</div>
                <div style="font-size: 9px; font-weight: bold; color: #475569;">SÉRIE: ${doc.series || '1'} • EMISSÃO: ${formatDateBR(doc.issueDate)}</div>
              </div>
            </div>

            <!-- DADOS DO FORNECEDOR / TRANSPORTADORA -->
            <div class="box">
              <div class="title-bar">DADOS DO EMISSOR / FORNECEDOR / TRANSPORTADORA</div>
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; font-size: 10px;">
                <div><strong>RAZÃO SOCIAL / NOME:</strong> ${doc.supplierName}</div>
                <div><strong>CNPJ / CPF:</strong> ${doc.supplierCnpj || 'NÃO INFORMADO'}</div>
              </div>
              ${doc.vehiclePlate ? `
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; display: grid; grid-template-columns: 1fr 2fr; gap: 8px; font-size: 10px;">
                  <div><strong>VEÍCULO VINCULADO:</strong> <span style="background-color: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-weight: 900;">${doc.vehiclePlate}</span></div>
                  <div><strong>MODELO / DESCRIÇÃO:</strong> ${doc.vehicleModel || 'FROTA OPERACIONAL'}</div>
                </div>
              ` : ''}
              ${doc.description ? `
                <div style="margin-top: 4px; font-size: 9px; color: #475569;">
                  <strong>FINALIDADE / DESCRIÇÃO:</strong> ${doc.description}
                </div>
              ` : ''}
            </div>

            <!-- TABELA DE ITENS / INSUMOS / SERVIÇOS -->
            <div class="box" style="padding: 0; overflow: hidden;">
              <div class="title-bar" style="margin: 0; border-radius: 0;">DISCRIMINAÇÃO DOS ITENS E PRODUTOS</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 30px;">IT</th>
                    <th style="text-align: left;">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                    <th style="width: 50px;">QTD</th>
                    <th style="width: 40px;">UN</th>
                    <th style="width: 90px; text-align: right;">VALOR UNIT.</th>
                    <th style="width: 100px; text-align: right;">TOTAL (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f1f5f9; font-weight: 900; border-top: 2px solid #94a3b8;">
                    <td colspan="5" style="padding: 6px; text-align: right; font-size: 11px;">VALOR TOTAL DO DOCUMENTO:</td>
                    <td style="padding: 6px; text-align: right; font-size: 12px; color: #047857;">${formatCurrencyBRL(doc.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- CONDIÇÕES DE PAGAMENTO E PARCELAS -->
            <div class="box">
              <div class="title-bar">CONDIÇÕES FINANCEIRAS & VENCIMENTOS</div>
              <div style="font-size: 10px; margin-bottom: 6px;">
                <strong>FORMA DE PAGAMENTO:</strong> ${doc.paymentMethod} • <strong>PARCELAMENTO:</strong> ${doc.installmentsCount}X • <strong>STATUS:</strong> <span style="font-weight: 900; color: #047857;">${doc.status}</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 6px;">
                ${installmentsHtml}
              </div>
            </div>

            ${doc.notes ? `
              <div class="box">
                <div class="title-bar">OBSERVAÇÕES ADICIONAIS / INFORMAÇÕES FISCAIS</div>
                <div style="font-size: 9px; color: #334155; line-height: 1.4;">${doc.notes}</div>
              </div>
            ` : ''}

            <!-- CAMPOS DE ASSINATURA -->
            <div style="margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; text-align: center;">
              <div>
                <div style="border-top: 1px solid #0f172a; margin-top: 30px; padding-top: 4px; font-size: 9px; font-weight: 900;">
                  RESPONSÁVEL PELO RECEBIMENTO / CONFERÊNCIA
                </div>
                <div style="font-size: 8px; color: #64748b;">DATA: ____/____/________</div>
              </div>
              <div>
                <div style="border-top: 1px solid #0f172a; margin-top: 30px; padding-top: 4px; font-size: 9px; font-weight: 900;">
                  ALMOXARIFADO & GESTÃO DE FROTAS
                </div>
                <div style="font-size: 8px; color: #64748b;">${subscriberTitle}</div>
              </div>
            </div>
            ${buildSystemPrintFooterHtml()}
          </body>
        </html>
      `;
      executePrint(htmlContent);
    } catch (err) {
      console.warn('Erro ao abrir impressão do documento:', err);
    }
  };

  // Filtragem estrita por competência
  const competenceDocuments = useMemo(() => {
    return documents.filter(d => {
      if (d.issueDate && matchesCompetence(d.issueDate, activeCompetence)) return true;
      if (!d.issueDate && d.createdAt && matchesCompetence(d.createdAt, activeCompetence)) return true;
      return false;
    });
  }, [documents, activeCompetence]);

  // Filtragem dos documentos
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return competenceDocuments;
    const q = searchQuery.toUpperCase();
    return competenceDocuments.filter(d => 
      d.number.includes(q) ||
      d.supplierName.includes(q) ||
      (d.vehiclePlate && d.vehiclePlate.includes(q)) ||
      (d.description && d.description.includes(q))
    );
  }, [competenceDocuments, searchQuery]);

  const IconComp = config.icon;

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden">
      {/* 1. TOPO DA ABA COM CONTROLES E BOTÃO DE LANÇAMENTO */}
      <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2.5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 select-none">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 text-slate-800 dark:text-stone-200">
            <IconComp className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-white tracking-wide">
              {config.title}
            </h2>
            <p className="text-[10px] text-slate-600 dark:text-stone-400 font-semibold uppercase">
              {config.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-wider border border-emerald-800 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{config.buttonLabel}</span>
        </button>
      </div>

      {/* FEEDBACK INLINE */}
      {feedback && (
        <div className={`shrink-0 p-2.5 rounded-lg text-xs font-bold flex items-center justify-between border ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
            : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
        }`}>
          <span className="flex items-center space-x-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.text}</span>
          </span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. BARRA DE BUSCA RÁPIDA E RESUMO */}
      <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar por número, fornecedor, placa...`}
            className="w-full pl-8 pr-3 py-1 bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-center">
          {!hideCompetenceSelector && (
            <CompetenceSelector
              competence={activeCompetence}
              onPrev={handlePrevCompetence}
              onNext={handleNextCompetence}
            />
          )}

          <div className="flex items-center space-x-2 text-xs font-bold text-black dark:text-stone-300">
            <span className="px-2 py-0.5 rounded-md bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700">
              TOTAL DE REGISTROS: <strong className="text-black dark:text-white">{filteredDocuments.length}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#e0e6f1] dark:bg-emerald-950/40 border border-black dark:border-emerald-800 text-emerald-900 dark:text-emerald-300">
              SOMA: <strong>{formatCurrencyBRL(filteredDocuments.reduce((acc, d) => acc + (d.totalAmount || 0), 0))}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. TABELA HISTÓRICA COMPACTA SLIM PRO (PY-1) */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg shadow-2xs overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 shadow-sm">
              <tr className="bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700 text-[10px] font-black uppercase text-black dark:text-stone-300 select-none">
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2 border-b border-black border-r border-r-black/20 dark:border-stone-700">DOCUMENTO</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2 border-b border-black border-r border-r-black/20 dark:border-stone-700">FORNECEDOR / TRANSPORTADORA</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2 border-b border-black border-r border-r-black/20 dark:border-stone-700">VEÍCULO VINCULADO</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2 border-b border-black border-r border-r-black/20 dark:border-stone-700 text-center">DATA</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2 border-b border-black border-r border-r-black/20 dark:border-stone-700 text-right">VALOR TOTAL</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2 border-b border-black border-r border-r-black/20 dark:border-stone-700 text-center">STATUS</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2 border-b border-black text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="bg-[#e0e6f1] dark:bg-stone-900 divide-y divide-black/15 dark:divide-stone-800 text-slate-900 dark:text-stone-200">
              {filteredDocuments.length === 0 ? (
                <tr key="empty_fiscal_category_docs">
                  <td colSpan={7} className="py-8 text-center bg-[#e0e6f1] text-slate-600 font-semibold uppercase text-xs">
                    NENHUM REGISTRO ENCONTRADO
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc, docIdx) => (
                  <tr key={`fiscal_doc_${doc.id || docIdx}_${docIdx}`} className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                    <td className="py-1 px-2 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {doc.number}
                    </td>
                    <td className="py-1 px-2 font-bold truncate max-w-xs" title={doc.supplierName}>
                      {doc.supplierName}
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      {doc.vehiclePlate ? (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-sky-100 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[10px] font-black">
                          {doc.vehiclePlate} {doc.vehicleModel ? `• ${doc.vehicleModel}` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-bold">-</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-center font-semibold text-[11px] whitespace-nowrap">
                      {formatDateBR(doc.issueDate)}
                    </td>
                    <td className="py-1 px-2 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrencyBRL(doc.totalAmount)}
                    </td>
                    <td className="py-1 px-2 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                        doc.status === 'CONFIRMADO' 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' 
                          : doc.status === 'ATENDIDO'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-center whitespace-nowrap">
                      <div className="inline-flex items-center space-x-1">
                        {category === 'pedido_compra' && doc.status === 'PENDENTE' && (
                          <button
                            type="button"
                            onClick={() => setEffectuatingDocId(doc.id)}
                            className="p-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:hover:bg-emerald-800 dark:text-emerald-200 text-[10px] font-extrabold cursor-pointer border border-emerald-300 dark:border-emerald-700"
                            title="Efetivar Pedido (Movimentar Estoque e Financeiro)"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setViewingDoc(doc)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-300 cursor-pointer"
                          title="Visualizar Detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintDocument(doc)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-300 cursor-pointer"
                          title="Imprimir Folha A4 Retrato"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDeleteDocument(doc)}
                          className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 cursor-pointer"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL PADRÃO OURO DE INSERÇÃO: w-full max-w-4xl h-[95vh] */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in"
        >
          <div 
            className="w-[88vw] max-w-[1200px] max-h-[92vh] flex flex-col justify-start mx-auto my-auto bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-black dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* CABEÇALHO */}
            <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between text-black dark:text-stone-100 shrink-0 rounded-t-xl select-none">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded bg-white dark:bg-stone-800 text-black dark:text-stone-100 flex items-center justify-center border border-black dark:border-stone-700 shrink-0">
                  <IconComp className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wide text-black dark:text-stone-100">
                    {config.buttonLabel} • COLAÇA SILAGEM
                  </h3>
                  <p className="text-[10px] text-black/80 dark:text-stone-400 font-bold uppercase tracking-tight">
                    INTEGRAÇÃO REATIVA LOCALSTORAGE: {config.movesStock ? 'ESTOQUE (+)' : 'SEM INCREMENTO FÍSICO (=)'} • FINANCEIRO • FROTAS
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAttemptCloseCreateModal}
                className="p-1 rounded text-black hover:bg-black/10 dark:text-stone-300 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CORPO DO FORMULÁRIO SCROLLÁVEL */}
            <form onSubmit={handleSaveDocument} id="form-fiscal-doc" {...fiscalDocGuard.captureProps} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3.5 bg-[#cad4e6] dark:bg-stone-950">
              {/* BLOCO 1: DADOS PRINCIPAIS DO DOCUMENTO */}
              <div className="p-3 rounded-xl border border-black dark:border-stone-700 bg-[#e0e6f1] dark:bg-stone-800 space-y-2.5">
                <h4 className="text-[11px] font-black uppercase text-black dark:text-stone-200 flex items-center space-x-1.5 border-b border-black/30 dark:border-stone-700 pb-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>1. IDENTIFICAÇÃO DO DOCUMENTO FISCAL</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                      NÚMERO DO DOCUMENTO *
                    </label>
                    <input
                      type="text"
                      required
                      value={formNumber}
                      onChange={(e) => setFormNumber(e.target.value.toUpperCase())}
                      className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                      SÉRIE
                    </label>
                    <input
                      type="text"
                      value={formSeries}
                      onChange={(e) => setFormSeries(e.target.value.toUpperCase())}
                      className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                      DATA DE EMISSÃO *
                    </label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <label className="block text-[10px] font-bold uppercase text-black">
                        CONDIÇÃO DE PAGAMENTO
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsPaymentMethodsManagerOpen(true)}
                        className="inline-flex items-center gap-0.5 text-[9.5px] font-black uppercase text-sky-800 hover:text-black cursor-pointer"
                        title="Gerenciar Formas de Pagamento Globais"
                      >
                        <Wrench className="w-2.5 h-2.5" />
                        <span>Gerenciar</span>
                      </button>
                    </div>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white border border-black rounded-lg text-xs font-bold text-black uppercase outline-none focus:ring-1 focus:ring-[#0963cb] cursor-pointer"
                    >
                      {formPaymentMethod &&
                        !globalPaymentMethods.some(m => getPaymentMethodKey(m) === formPaymentMethod) && (
                          <option value={formPaymentMethod}>{getGlobalPaymentMethodLabel(formPaymentMethod)}</option>
                        )}
                      {globalPaymentMethods.map(m => {
                        const key = getPaymentMethodKey(m);
                        return (
                          <option key={m.id} value={key}>
                            {m.nome}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                      FORNECEDOR / TRANSPORTADORA * (SELECIONE OU DIGITE)
                    </label>
                    <div className="flex space-x-1.5">
                      <select
                        value={formSupplierId}
                        onChange={(e) => handleSelectSupplier(e.target.value)}
                        className="w-1/2 px-2 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white uppercase truncate outline-none focus:ring-1 focus:ring-[#0963cb]"
                      >
                        <option value="">-- FORNECEDORES CADASTRADOS --</option>
                        {availableSuppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name || s.tradeName || s.corporateName}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        placeholder="OU DIGITE O NOME DO FORNECEDOR..."
                        value={formSupplierName}
                        onChange={(e) => setFormSupplierName(e.target.value.toUpperCase())}
                        className="w-1/2 px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#0963cb]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                      CNPJ / CPF DO FORNECEDOR
                    </label>
                    <input
                      type="text"
                      placeholder="00.000.000/0000-00"
                      value={formSupplierCnpj}
                      onChange={(e) => setFormSupplierCnpj(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>
                </div>

                {/* VÍNCULO DE VEÍCULO DA FROTA (OBRIGATÓRIO PARA CTE, OPCIONAL PARA OUTROS) */}
                <div className={`p-2 rounded-lg border ${
                  config.requiresVehicle 
                    ? 'bg-sky-50 border-sky-600 dark:bg-sky-950/40 dark:border-sky-800' 
                    : category === 'nfse'
                      ? 'bg-sky-50/70 border-sky-500 dark:bg-sky-950/30 dark:border-sky-800'
                      : 'bg-white/60 border-gray-400 dark:bg-stone-900 dark:border-stone-700'
                }`}>
                  <label className="block text-[10px] font-black uppercase text-black dark:text-stone-200 mb-0.5">
                    VEÍCULO DA FROTA {
                      config.requiresVehicle 
                        ? '*(OBRIGATÓRIO PARA RATEIO DRE NO CT-E)' 
                        : category === 'nfse' 
                          ? '(OPCIONAL • VINCULAR TRATOR/CAMINHÃO PARA RATEIO NO DRE DA FROTA)' 
                          : '(OPCIONAL)'
                    }
                  </label>
                  <select
                    value={formVehicleId}
                    onChange={(e) => setFormVehicleId(e.target.value)}
                    required={config.requiresVehicle}
                    className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#0963cb]"
                  >
                    <option value="">-- SELECIONE O VEÍCULO / MÁQUINA DA FROTA --</option>
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.licensePlateOrSerial || (v as any).placa || 'S/ PLACA'} • {v.model || v.name} ({v.categoriaVeiculo || (v as any).tipo || 'FROTA'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BLOCO 2: DISCRIMINAÇÃO DE ITENS E PRODUTOS DO ESTOQUE */}
              <div className="p-3 rounded-xl border border-black dark:border-stone-700 bg-[#e0e6f1] dark:bg-stone-800 space-y-2.5">
                <div className="flex items-center justify-between border-b border-black/30 dark:border-stone-700 pb-1">
                  <h4 className="text-[11px] font-black uppercase text-black dark:text-stone-200 flex items-center space-x-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>2. ITENS, INSUMOS E VALORES DO DOCUMENTO</span>
                  </h4>
                  <span className="text-[10px] font-bold text-black/75 dark:text-stone-400 uppercase">
                    PULL REATIVO DE 'agrocontrol_produtos'
                  </span>
                </div>

                {/* Linha de Adição de Item */}
                <div className="p-2 bg-white/60 dark:bg-stone-900 rounded-lg border border-gray-400 dark:border-stone-700 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                        SELECIONAR DO ESTOQUE
                      </label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => handleSelectProduct(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-md text-xs font-bold text-black dark:text-white uppercase truncate outline-none focus:ring-1 focus:ring-[#0963cb]"
                      >
                        <option value="">-- DIGITAR MANUALMENTE OU SELECIONAR --</option>
                        {availableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.description} (ESTOQUE: {p.currentStock || 0} {p.unit || 'UN'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[9px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                        DESCRIÇÃO DO ITEM
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: SILAGEM DE MILHO, FRETE DIESEL..."
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-md text-xs font-bold text-black dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#0963cb]"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[9px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                        QTD
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-md text-xs font-bold text-black dark:text-white text-center outline-none focus:ring-1 focus:ring-[#0963cb]"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[9px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                        UNIDADE
                      </label>
                      <input
                        type="text"
                        value={itemUnit}
                        onChange={(e) => setItemUnit(e.target.value.toUpperCase())}
                        className="w-full px-1.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-md text-xs font-bold text-black dark:text-white text-center uppercase outline-none focus:ring-1 focus:ring-[#0963cb]"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[9px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                        VALOR UNIT. (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={itemUnitPrice}
                        onChange={(e) => setItemUnitPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-md text-xs font-bold text-black dark:text-white text-right font-mono outline-none focus:ring-1 focus:ring-[#0963cb]"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[9px] font-bold uppercase text-emerald-900 dark:text-emerald-300 mb-0.5">
                        SUBTOTAL (R$)
                      </label>
                      <div
                        className="w-full px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500 dark:border-emerald-700 rounded-md text-xs font-mono font-black text-emerald-900 dark:text-emerald-300 text-right select-none truncate"
                        title="Subtotal calculado automaticamente: Qtd × Valor Unitário"
                      >
                        {formatCurrencyBRL(Math.max(0, (Number(itemQuantity) || 0) * (Number(itemUnitPrice) || 0)))}
                      </div>
                    </div>

                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddItemToForm}
                        className="w-full inline-flex items-center justify-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-2 rounded-md text-xs whitespace-nowrap cursor-pointer border border-black shadow-xs transition"
                        title="Inserir item na lista"
                      >
                        <span>+ INSERIR NA LISTA</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabela de Itens Adicionados */}
                <div className="border border-black dark:border-stone-700 rounded-lg overflow-hidden bg-white dark:bg-stone-900">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700 text-[10px] font-black uppercase text-black dark:text-stone-300">
                        <th className="py-1 px-2">#</th>
                        <th className="py-1 px-2">DESCRIÇÃO</th>
                        <th className="py-1 px-2 text-center">QTD</th>
                        <th className="py-1 px-2 text-center">UN</th>
                        <th className="py-1 px-2 text-right">VALOR UNIT.</th>
                        <th className="py-1 px-2 text-right">SUBTOTAL</th>
                        <th className="py-1 px-2 text-center w-20">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 dark:divide-stone-800">
                      {formItems.length === 0 ? (
                        <tr key="empty_form_items_row">
                          <td colSpan={7} className="py-3 text-center text-gray-500 font-bold uppercase text-[11px]">
                            Nenhum item inserido ainda. Adicione acima.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => (
                          <tr
                            key={`${item.id || 'form_item'}_${idx}`}
                            className={`transition ${
                              editingFormItemId === item.id
                                ? 'bg-amber-50 dark:bg-amber-950/30'
                                : 'bg-white dark:bg-stone-900 hover:bg-gray-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <td className="py-1 px-2 text-[10px] font-bold text-gray-600">{idx + 1}</td>
                            <td className="py-1 px-2 font-bold text-black dark:text-stone-100">{item.description}</td>
                            <td className="py-1 px-2 text-center font-bold text-black dark:text-stone-100">{item.quantity}</td>
                            <td className="py-1 px-2 text-center text-[10px] text-black dark:text-stone-200">{item.unit}</td>
                            <td className="py-1 px-2 text-right text-black dark:text-stone-200">{formatCurrencyBRL(item.unitPrice)}</td>
                            <td className="py-1 px-2 text-right font-black text-emerald-700 dark:text-emerald-400">
                              {formatCurrencyBRL(item.totalPrice)}
                            </td>
                            <td className="py-1 px-2 text-center">
                              <div className="inline-flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditItemFromForm(item)}
                                  className="text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/40 p-1 rounded cursor-pointer"
                                  title="Editar item"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemFromForm(item.id)}
                                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1 rounded cursor-pointer"
                                  title="Remover item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#cad4e6] dark:bg-stone-800 font-black border-t border-black dark:border-stone-700 text-xs text-black dark:text-stone-100">
                        <td colSpan={5} className="py-1.5 px-2 text-right uppercase">
                          TOTAL DO DOCUMENTO:
                        </td>
                        <td className="py-1.5 px-2 text-right text-emerald-800 dark:text-emerald-400 text-sm">
                          {formatCurrencyBRL(totalFormAmount)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* BLOCO 3: PARCELAS E CONTAS A PAGAR */}
              <div className="p-3 rounded-xl border border-black dark:border-stone-700 bg-[#e0e6f1] dark:bg-stone-800 space-y-2">
                <h4 className="text-[11px] font-black uppercase text-black dark:text-stone-200 flex items-center space-x-1.5 border-b border-black/30 dark:border-stone-700 pb-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>3. PARCELAMENTO & INTEGRAÇÃO FINANCEIRA ('agrocontrol_financeiro')</span>
                </h4>

                {/* RETENÇÃO DE IMPOSTOS MUNICIPAIS (ISS) - EXCLUSIVO PARA NFS-E */}
                {category === 'nfse' && (
                  <div className="p-2.5 rounded-lg border border-sky-600 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formIssRetained}
                          onChange={(e) => setFormIssRetained(e.target.checked)}
                          className="w-4 h-4 text-sky-600 rounded border-gray-400 focus:ring-sky-500 cursor-pointer"
                        />
                        <span className="text-[11px] font-black uppercase text-sky-900 dark:text-sky-200">
                          RETER ISS MUNICIPAL NA FONTE (IMPOSTO MUNICIPAL)
                        </span>
                      </label>
                      {formIssRetained && (
                        <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 uppercase">
                          VALOR LÍQUIDO A PAGAR: <strong>{formatCurrencyBRL(netPayableTotal)}</strong>
                        </span>
                      )}
                    </div>

                    {formIssRetained && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-sky-300 dark:border-sky-800">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-black dark:text-stone-300 mb-0.5">
                            ALÍQUOTA ISS (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formIssRate}
                            onChange={(e) => setFormIssRate(parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase text-black dark:text-stone-300 mb-0.5">
                            VALOR DO ISS RETIDO (R$)
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={formatCurrencyBRL(calculatedIssAmount)}
                            className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-black text-rose-700 dark:text-rose-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase text-black dark:text-stone-300 mb-0.5">
                            TOTAL DAS PARCELAS (R$)
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={formatCurrencyBRL(netPayableTotal)}
                            className="w-full px-2.5 py-1 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-black text-emerald-800 dark:text-emerald-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                      NÚMERO DE PARCELAS
                    </label>
                    <select
                      value={formInstallmentsCount}
                      onChange={(e) => setFormInstallmentsCount(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb]"
                    >
                      <option value="1">1X (À Vista / Na Data)</option>
                      <option value="2">2X (Parcelado)</option>
                      <option value="3">3X (30 / 60 / 90 Dias)</option>
                      <option value="4">4X (Mensal)</option>
                      <option value="6">6X Semestral</option>
                      <option value="12">12X Safra Anual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                      1º VENCIMENTO
                    </label>
                    <input
                      type="date"
                      value={formFirstDueDate}
                      onChange={(e) => setFormFirstDueDate(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-300 mb-0.5">
                      OBSERVAÇÕES / HISTÓRICO FISCAL
                    </label>
                    <input
                      type="text"
                      placeholder="Informações adicionais para conferência..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value.toUpperCase())}
                      className="w-full px-2.5 py-1 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-white uppercase outline-none focus:ring-1 focus:ring-[#0963cb]"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* RODAPÉ DO MODAL COM BOTÕES DE AÇÃO */}
            <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-between shrink-0 rounded-b-xl select-none">
              <button
                type="button"
                onClick={handleAttemptCloseCreateModal}
                className="px-4 py-1.5 bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-black dark:text-white border border-gray-400 dark:border-stone-600 rounded-lg text-xs font-bold uppercase transition cursor-pointer"
              >
                CANCELAR
              </button>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-black dark:text-stone-300 mr-2">
                  VALOR: <strong className="text-emerald-800 dark:text-emerald-400 text-sm">{formatCurrencyBRL(totalFormAmount)}</strong>
                  {formIssRetained && (
                    <span className="text-[10px] text-sky-900 dark:text-sky-300 font-bold ml-1.5">
                      (LÍQUIDO A PAGAR: {formatCurrencyBRL(netPayableTotal)})
                    </span>
                  )}
                </span>

                <button
                  type="submit"
                  form="form-fiscal-doc"
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider border border-emerald-800 transition active:scale-95 cursor-pointer"
                >
                  GRAVAR E LANÇAR {config.defaultPrefix}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE VISUALIZAÇÃO DETALHADA: w-full max-w-4xl h-[95vh] */}
      {/* ========================================================================= */}
      {viewingDoc && (
        <div 
          className="fixed inset-0 z-70 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in"
        >
          <div 
            className="w-[90vw] max-w-[1100px] max-h-[92vh] flex flex-col justify-start mx-auto my-auto bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-black dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black flex items-center justify-between text-black dark:text-stone-100 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded bg-white dark:bg-stone-800 border border-black flex items-center justify-center shrink-0">
                  <IconComp className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <h3 className="text-xs sm:text-sm font-black uppercase text-black dark:text-stone-100">
                  ESPELHO / DANFE: {viewingDoc.documentTypeLabel} Nº {viewingDoc.number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="p-1 rounded text-black hover:bg-black/10 dark:text-stone-300 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-[#cad4e6] dark:bg-stone-950">
              <div className="bg-white text-black border-2 border-black rounded-lg shadow-md p-4 space-y-3 text-xs">
                {(() => {
                  const subHeader = resolveSubscriberPrintHeader(companyProfile);
                  return (
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-black pb-3">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-500 block">EMPRESA / DESTINATÁRIO</span>
                        <div className="text-sm font-black uppercase text-black">{subHeader.displayTitle}</div>
                        {subHeader.cnpjCpf && (
                          <div className="text-[10px] font-mono text-slate-700">CNPJ/CPF: {subHeader.cnpjCpf}{subHeader.stateRegistration ? ` • IE: ${subHeader.stateRegistration}` : ''}</div>
                        )}
                        {subHeader.fullAddress && (
                          <div className="text-[10px] text-slate-600 uppercase">{subHeader.fullAddress}</div>
                        )}
                      </div>
                      <div className="text-right border border-black rounded px-3 py-1.5 bg-slate-50">
                        <div className="text-[10px] font-black uppercase text-emerald-800">{viewingDoc.documentTypeLabel}</div>
                        <div className="text-sm font-black font-mono">Nº {viewingDoc.number}</div>
                        <div className="text-[10px] text-slate-600 font-bold">
                          SÉRIE {viewingDoc.series || '1'} • EMISSÃO: {formatDateBR(viewingDoc.issueDate)}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="p-3 bg-slate-50 rounded border border-black grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">FORNECEDOR / EMISSOR</div>
                    <div className="font-black uppercase">{viewingDoc.supplierName}</div>
                    {viewingDoc.supplierCnpj && <div className="text-[10px] font-mono text-slate-600">{viewingDoc.supplierCnpj}</div>}
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">PAGAMENTO</div>
                    <div className="font-bold uppercase">{viewingDoc.paymentMethod} ({viewingDoc.installmentsCount}X)</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">STATUS</div>
                    <div className="font-black uppercase">{viewingDoc.status}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">VALOR TOTAL</div>
                    <div className="font-mono font-black text-emerald-800 text-sm">{formatCurrencyBRL(viewingDoc.totalAmount)}</div>
                  </div>
                  {viewingDoc.vehiclePlate && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">VEÍCULO VINCULADO:</span>
                      <span className="font-black text-sky-800">{viewingDoc.vehiclePlate}</span> ({viewingDoc.vehicleModel || 'FROTA'})
                    </div>
                  )}
                  {viewingDoc.description && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">FINALIDADE:</span>
                      <span className="font-semibold uppercase">{viewingDoc.description}</span>
                    </div>
                  )}
                </div>

                <div className="border border-black rounded overflow-hidden bg-white">
                  <div className="bg-slate-200 px-3 py-1.5 border-b border-black text-[10px] font-black uppercase">ITENS DO DOCUMENTO ({viewingDoc.items.length})</div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black border-b border-black">
                        <th className="py-1.5 px-2 text-center w-10">#</th>
                        <th className="py-1.5 px-2 text-left">DESCRIÇÃO</th>
                        <th className="py-1.5 px-2 text-center">QTD</th>
                        <th className="py-1.5 px-2 text-center">UN</th>
                        <th className="py-1.5 px-2 text-right">UNITÁRIO</th>
                        <th className="py-1.5 px-2 text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {viewingDoc.items.map((it, idx) => (
                        <tr key={`${it.id || 'view_item'}_${idx}`} className="even:bg-slate-50 odd:bg-white">
                          <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-600">{String(idx + 1).padStart(2, '0')}</td>
                          <td className="py-1.5 px-2 font-bold uppercase">{it.description}</td>
                          <td className="py-1.5 px-2 text-center font-mono">{it.quantity}</td>
                          <td className="py-1.5 px-2 text-center text-[10px] uppercase">{it.unit}</td>
                          <td className="py-1.5 px-2 text-right font-mono">{formatCurrencyBRL(it.unitPrice)}</td>
                          <td className="py-1.5 px-2 text-right font-mono font-black text-emerald-800">{formatCurrencyBRL(it.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-black font-black">
                        <td colSpan={5} className="py-1.5 px-2 text-right uppercase">TOTAL DO DOCUMENTO:</td>
                        <td className="py-1.5 px-2 text-right font-mono text-sm text-emerald-800">{formatCurrencyBRL(viewingDoc.totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {viewingDoc.installments && viewingDoc.installments.length > 0 && (
                  <div className="border border-black rounded overflow-hidden">
                    <div className="bg-slate-200 px-3 py-1 border-b border-black text-[10px] font-black uppercase">PARCELAS FINANCEIRAS ({viewingDoc.installments.length})</div>
                    <div className="p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white">
                      {viewingDoc.installments.map((inst, iIdx) => (
                        <div key={`vd_inst_${iIdx}`} className="p-2 rounded border border-slate-300 bg-slate-50 text-[10px]">
                          <div className="font-black">PARC {inst.number} • {inst.status}</div>
                          <div className="font-mono font-black text-xs text-emerald-800">{formatCurrencyBRL(inst.amount)}</div>
                          <div className="text-slate-600">Venc: {formatDateBR(inst.dueDate)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingDoc.notes && (
                  <div className="p-2.5 bg-slate-50 border border-black rounded text-[11px] uppercase">
                    <span className="font-black block text-[10px] text-slate-600 mb-0.5">OBSERVAÇÕES:</span>
                    {viewingDoc.notes}
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-t border-black flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="px-4 py-1.5 bg-white hover:bg-gray-100 text-black border border-black rounded-lg text-xs font-bold uppercase cursor-pointer"
              >
                FECHAR
              </button>

              <button
                type="button"
                onClick={() => handlePrintDocument(viewingDoc)}
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 rounded-lg text-xs font-bold uppercase cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>IMPRIMIR FOLHA A4</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO CUSTOMIZADO ANTI-SANDBOX */}
      {deletingDocId && (
        <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-slate-400 rounded-xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-xs font-black uppercase">CONFIRMAÇÃO DE EXCLUSÃO</h3>
            </div>
            <p className="text-xs text-slate-700 dark:text-stone-300 font-semibold uppercase">
              DESEJA REALMENTE EXCLUIR ESTE DOCUMENTO FISCAL DO REGISTRO LOCAL? ESTA AÇÃO NÃO PODERÁ SER DESFEITA.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeletingDocId(null)}
                className="px-3 py-1 bg-slate-200 text-slate-800 rounded-lg text-xs font-bold uppercase cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDocument}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black uppercase cursor-pointer"
              >
                SIM, EXCLUIR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE BLOQUEIO DE EXCLUSÃO POR PARCELA LIQUIDADA NO FINANCEIRO */}
      {blockedDeleteDocNumber && (
        <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-md bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-rose-700 text-white border-b border-black">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="text-xs font-black uppercase tracking-wide">Exclusão Bloqueada — Documento {blockedDeleteDocNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setBlockedDeleteDocNumber(null)}
                className="p-1 rounded hover:bg-rose-800 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 bg-[#e0e6f1]">
              <p className="text-xs text-slate-900 font-semibold leading-relaxed">
                Não é possível excluir esta Nota Fiscal porque existem parcelas já baixadas no Financeiro. Acesse <strong>Financeiro &gt; A Pagar (ou A Receber)</strong>, estorne a baixa da parcela paga informando o motivo e depois exclua a nota.
              </p>
              <div className="flex items-center justify-end pt-2 border-t border-black/20">
                <button
                  type="button"
                  onClick={() => setBlockedDeleteDocNumber(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white border border-black rounded-lg text-xs font-black uppercase cursor-pointer"
                >
                  ENTENDI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EFETIVAÇÃO DE PEDIDO DE COMPRA */}
      {effectuatingDocId && (
        <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-emerald-400 rounded-xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-xs font-black uppercase">EFETIVAR PEDIDO DE COMPRA</h3>
            </div>
            <p className="text-xs text-slate-700 dark:text-stone-300 font-semibold uppercase">
              A EFETIVAÇÃO IRÁ INJETAR A QUANTIDADE DOS PRODUTOS NO ESTOQUE ATIVO E GERAR O CONTAS A PAGAR CORRESPONDENTE. DESEJA CONTINUAR?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEffectuatingDocId(null)}
                className="px-3 py-1 bg-slate-200 text-slate-800 rounded-lg text-xs font-bold uppercase cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => handleConfirmEffectuateOrder(effectuatingDocId)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase cursor-pointer"
              >
                SIM, EFETIVAR AGORA
              </button>
            </div>
          </div>
        </div>
      )}
      <PaymentMethodsManagerModal
        isOpen={isPaymentMethodsManagerOpen}
        onClose={() => setIsPaymentMethodsManagerOpen(false)}
        zIndexClass="z-[9999]"
        onSelectMethod={(key) => setFormPaymentMethod(key)}
      />
    </div>
  );
};
