import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  ArrowLeftRight,
  PackageCheck,
  AlertTriangle,
  Wallet,
  CreditCard,
  Printer,
  CheckCircle2,
  Eye,
  Receipt,
  Settings,
  ChevronDown,
  FileText,
  Building2,
  User,
} from 'lucide-react';
import {
  BoletoAbatidoInfo,
  Client,
  ClienteCredito,
  CompanyProfile,
  Expense,
  InventoryItem,
  PendenciaDevolucaoRecord,
  Supplier,
  TrocaDestinoFinanceiro,
  TrocaDevolucaoItem,
  TrocaDevolucaoRecord,
  TrocaMotivo,
  TrocaOperacaoTipo,
} from '../../types';
import {
  addPendenciasDevolucao,
  formatCurrencyBRL,
  formatDateBR,
  getActiveCompanyId,
  getNextTrocaProtocolo,
  getStoredClients,
  getStoredClienteCreditos,
  getStoredDocumentosEntrada,
  getStoredDocumentosEntradaItens,
  getStoredExpenses,
  getStoredInventory,
  getStoredServices,
  getStoredSuppliers,
  getStoredTrocasDevolucoes,
  saveStoredClients,
  saveStoredClienteCreditos,
  saveStoredExpenses,
  saveStoredInventory,
  saveStoredTrocasDevolucoes,
} from '../../lib/storage';
import {
  adicionarSangriaCaixa,
  getOperadorLogadoNome,
  isCaixaAbertoHojeParaOperador,
  registrarVendaNoCaixa,
} from '../../lib/caixaStorage';
import {
  getTipoOperacaoLabel,
  printTrocaDevolucaoA4,
  printTrocaDevolucaoCupom80mm,
} from './trocaDevolucaoPrintUtils';
import { CategoryOptionsManagerModal } from '../common/CategoryOptionsManagerModal';

interface NovaTrocaDevolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  companyProfile?: CompanyProfile;
  defaultTipoOperacao?: TrocaOperacaoTipo;
  onSaveClients?: (clients: Client[]) => void;
  onSuccess: (record: TrocaDevolucaoRecord, shouldAutoPrint: boolean) => void;
}

const TROCA_MOTIVOS_STORAGE_KEY = 'agrocontrol_trocas_motivos';

const DEFAULT_TROCA_MOTIVOS: string[] = [
  'Defeito de Fabricação',
  'Garantia',
  'Peça / Produto Enviado Errado (Divergência no Pedido)',
  'Especificação / Aplicação Incompatível',
  'Tamanho / Modelo Incorreto',
  'Desistência / Troca Comercial',
  'Avaria no Transporte',
];

function getStoredTrocaMotivos(): string[] {
  try {
    const raw = localStorage.getItem(TROCA_MOTIVOS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed
          .map((item) => String(item || '').trim())
          .filter(Boolean);
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch {}
  return [...DEFAULT_TROCA_MOTIVOS];
}

function saveStoredTrocaMotivos(items: string[]): void {
  try {
    const cleaned = items.map((i) => String(i || '').trim()).filter(Boolean);
    localStorage.setItem(TROCA_MOTIVOS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {}
}

interface OriginDocItemMatch {
  productId?: string;
  code?: string;
  description: string;
  unitPrice?: number;
}

interface OriginDocOption {
  id: string;
  value: string;
  label: string;
  number: string;
  dateStr: string;
  amount: number;
  sourceLabel: string;
  items: OriginDocItemMatch[];
}

function getItemDisplayName(item: InventoryItem): string {
  return String(item.nome_comercial || item.name || item.nome || 'Produto sem nome').trim();
}

function getItemCode(item: InventoryItem): string {
  return String(item.codigo_produto || item.code || '').trim();
}

function getItemStockQty(item: InventoryItem): number {
  return Number(item.quantidade_atual ?? item.quantity ?? 0);
}

function getItemSalePrice(item: InventoryItem): number {
  return Number(
    item.preco_venda_varejo ??
      item.salePrice ??
      item.preco_venda ??
      item.unitCost ??
      item.custo_nominal ??
      0
  );
}

function getItemCostPrice(item: InventoryItem): number {
  return Number(
    item.unitCost ??
      item.custo_com_imposto ??
      item.preco_custo_inicial ??
      item.custo_nominal ??
      item.salePrice ??
      0
  );
}

function normalizeText(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeDigits(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

function normalizeDateIso(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
}

function inventoryItemMatchesOriginItem(
  inv: InventoryItem,
  originItem: OriginDocItemMatch
): boolean {
  if (originItem.productId && String(inv.id) === String(originItem.productId)) {
    return true;
  }
  const invCode = normalizeText(inv.codigo_produto || inv.code);
  const orgCode = normalizeText(originItem.code);
  if (invCode && orgCode && invCode === orgCode) {
    return true;
  }
  const invName = normalizeText(inv.nome_comercial || inv.name || inv.nome);
  const orgDesc = normalizeText(originItem.description);
  if (invName && orgDesc && (invName === orgDesc || invName.includes(orgDesc) || orgDesc.includes(invName))) {
    return true;
  }
  return false;
}

function getExpenseOpenAmount(exp: Expense): number {
  const raw = exp.amount ?? (exp as any).valor_parcela ?? (exp as any).valor ?? 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const parsed = parseFloat(String(raw).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpensePendingForAbatement(exp: Expense): boolean {
  if (!exp || !exp.id) return false;
  const amt = getExpenseOpenAmount(exp);
  if (amt <= 0) return false;
  const st = normalizeText(exp.status);
  if (
    st === 'pago' ||
    st === 'compensado_estoque' ||
    st === 'liquidado / abatido por devolucao'
  ) {
    return false;
  }
  return (
    st === '' ||
    st === 'pendente' ||
    st === 'a pagar' ||
    st === 'atrasado' ||
    st === 'agendado' ||
    st === 'aberto'
  );
}

function getExpenseDocLabel(exp: Expense): string {
  const nf = String(exp.invoiceNumber || '').trim();
  const parc = String((exp as any).numero_parcela || '').trim();
  const parcSuffix = parc && parc !== '01/01' ? ` (Parc. ${parc})` : '';
  if (nf) {
    const prefix = nf.toUpperCase().startsWith('NF') ? nf : `NF ${nf}`;
    return `${prefix}${parcSuffix}`;
  }
  const desc = String(exp.description || '').trim();
  return desc ? `${desc}${parcSuffix}` : `Boleto #${String(exp.id).slice(-6)}`;
}

export const NovaTrocaDevolucaoModal: React.FC<NovaTrocaDevolucaoModalProps> = ({
  isOpen,
  onClose,
  clients,
  companyProfile,
  defaultTipoOperacao,
  onSaveClients,
  onSuccess,
}) => {
  const todayIso = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }, []);

  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [clientsList, setClientsList] = useState<Client[]>(clients);
  const [expensesList, setExpensesList] = useState<Expense[]>([]);
  const [motivosList, setMotivosList] = useState<string[]>(() => getStoredTrocaMotivos());
  const [isMotivoManagerOpen, setIsMotivoManagerOpen] = useState<boolean>(false);

  // Card 1: Operação e Envolvido
  const [tipoOperacao, setTipoOperacao] = useState<TrocaOperacaoTipo>('devolucao_cliente');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [avulsoNome, setAvulsoNome] = useState<string>('Consumidor Avulso');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [envolvidoSearch, setEnvolvidoSearch] = useState<string>('');
  const [isEnvolvidoDropdownOpen, setIsEnvolvidoDropdownOpen] = useState<boolean>(false);
  const [dataOperacao, setDataOperacao] = useState<string>(todayIso);
  const [numeroOrigem, setNumeroOrigem] = useState<string>('');
  const [selectedOriginDocId, setSelectedOriginDocId] = useState<string>('');
  const [isOriginDropdownOpen, setIsOriginDropdownOpen] = useState<boolean>(false);
  const [motivo, setMotivo] = useState<TrocaMotivo>('Defeito de Fabricação');
  const [observacoes, setObservacoes] = useState<string>('');

  // Card 2: Produtos Devolvidos (Combobox Unificado)
  const [searchDevolvido, setSearchDevolvido] = useState<string>('');
  const [selectedProdDevolvidoId, setSelectedProdDevolvidoId] = useState<string>('');
  const [isProdDevolvidoDropdownOpen, setIsProdDevolvidoDropdownOpen] = useState<boolean>(false);
  const [qtdDevolvida, setQtdDevolvida] = useState<string>('1');
  const [precoDevolvido, setPrecoDevolvido] = useState<string>('');
  const [retornarAoEstoque, setRetornarAoEstoque] = useState<boolean>(true);
  const [itensDevolvidos, setItensDevolvidos] = useState<TrocaDevolucaoItem[]>([]);

  // Card 3: Produtos Levados na Troca (Troca Direta - Combobox Unificado)
  const [searchLevado, setSearchLevado] = useState<string>('');
  const [selectedProdLevadoId, setSelectedProdLevadoId] = useState<string>('');
  const [isProdLevadoDropdownOpen, setIsProdLevadoDropdownOpen] = useState<boolean>(false);
  const [qtdLevada, setQtdLevada] = useState<string>('1');
  const [precoLevado, setPrecoLevado] = useState<string>('');
  const [itensLevados, setItensLevados] = useState<TrocaDevolucaoItem[]>([]);

  // Refs para fechar dropdowns ao clicar fora
  const envolvidoBoxRef = useRef<HTMLDivElement>(null);
  const originBoxRef = useRef<HTMLDivElement>(null);
  const prodDevolvidoBoxRef = useRef<HTMLDivElement>(null);
  const prodLevadoBoxRef = useRef<HTMLDivElement>(null);

  // Financeiro
  const [modoCreditoOuEstorno, setModoCreditoOuEstorno] = useState<'vale_credito' | 'estorno'>(
    'vale_credito'
  );
  const [formaEstorno, setFormaEstorno] = useState<'DINHEIRO' | 'PIX'>('DINHEIRO');
  const [formaPagamentoDiferenca, setFormaPagamentoDiferenca] = useState<string>('DINHEIRO');
  const [destinoFornecedor, setDestinoFornecedor] = useState<
    'credito_fornecedor' | 'abatimento_boleto' | 'diferenca_recebida' | 'sem_impacto'
  >('credito_fornecedor');
  const [selectedBoletoId, setSelectedBoletoId] = useState<string>('');
  const [autoPrintA4, setAutoPrintA4] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (envolvidoBoxRef.current && !envolvidoBoxRef.current.contains(target)) {
        setIsEnvolvidoDropdownOpen(false);
      }
      if (originBoxRef.current && !originBoxRef.current.contains(target)) {
        setIsOriginDropdownOpen(false);
      }
      if (prodDevolvidoBoxRef.current && !prodDevolvidoBoxRef.current.contains(target)) {
        setIsProdDevolvidoDropdownOpen(false);
      }
      if (prodLevadoBoxRef.current && !prodLevadoBoxRef.current.contains(target)) {
        setIsProdLevadoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Carrega dados atualizados ao abrir o modal (iniciando Cliente/Fornecedor em branco)
  useEffect(() => {
    if (!isOpen) return;
    setInventoryList(getStoredInventory());
    const sups = getStoredSuppliers();
    setSuppliersList(sups);
    setClientsList(clients && clients.length > 0 ? clients : getStoredClients());
    setExpensesList(getStoredExpenses());
    const loadedMotivos = getStoredTrocaMotivos();
    setMotivosList(loadedMotivos);
    setIsMotivoManagerOpen(false);

    const initialTipo: TrocaOperacaoTipo = defaultTipoOperacao || 'devolucao_cliente';
    setTipoOperacao(initialTipo);
    setSelectedClientId('');
    setAvulsoNome('Consumidor Avulso');
    setSelectedSupplierId('');
    setEnvolvidoSearch('');
    setIsEnvolvidoDropdownOpen(false);
    setDataOperacao(todayIso);
    setNumeroOrigem('');
    setSelectedOriginDocId('');
    setIsOriginDropdownOpen(false);
    const defaultReason =
      initialTipo === 'devolucao_fornecedor'
        ? loadedMotivos.find((m) => normalizeText(m) === 'garantia') || loadedMotivos[0] || 'Garantia'
        : loadedMotivos.find((m) => normalizeText(m).includes('defeito')) ||
          loadedMotivos[0] ||
          'Defeito de Fabricação';
    setMotivo(defaultReason);
    setObservacoes('');
    setSearchDevolvido('');
    setSelectedProdDevolvidoId('');
    setIsProdDevolvidoDropdownOpen(false);
    setQtdDevolvida('1');
    setPrecoDevolvido('');
    setRetornarAoEstoque(true);
    setItensDevolvidos([]);
    setSearchLevado('');
    setSelectedProdLevadoId('');
    setIsProdLevadoDropdownOpen(false);
    setQtdLevada('1');
    setPrecoLevado('');
    setItensLevados([]);
    setModoCreditoOuEstorno('vale_credito');
    setFormaEstorno('DINHEIRO');
    setFormaPagamentoDiferenca('DINHEIRO');
    setDestinoFornecedor('credito_fornecedor');
    setSelectedBoletoId('');
    setAutoPrintA4(true);
    setErrorMsg(null);
    setIsSaving(false);

    const refreshExpenses = () => setExpensesList(getStoredExpenses());
    window.addEventListener('agrocontrol_contas_a_pagar_updated', refreshExpenses);
    window.addEventListener('silagem_expenses_updated', refreshExpenses);
    return () => {
      window.removeEventListener('agrocontrol_contas_a_pagar_updated', refreshExpenses);
      window.removeEventListener('silagem_expenses_updated', refreshExpenses);
    };
  }, [isOpen, clients, todayIso, defaultTipoOperacao]);

  const selectedSupplier = useMemo(
    () => suppliersList.find((s) => String(s.id) === String(selectedSupplierId)) || null,
    [suppliersList, selectedSupplierId]
  );

  const selectedClient = useMemo(
    () =>
      selectedClientId && selectedClientId !== 'consumidor_avulso'
        ? clientsList.find((c) => String(c.id) === String(selectedClientId)) || null
        : null,
    [clientsList, selectedClientId]
  );

  // Filtragem do combobox de Fornecedor / Cliente
  const filteredSuppliersDropdown = useMemo(() => {
    const q = normalizeText(envolvidoSearch);
    const qDigits = normalizeDigits(envolvidoSearch);
    return suppliersList
      .filter((sup) => {
        if (!q) return true;
        const n1 = normalizeText(sup.name);
        const n2 = normalizeText(sup.tradeName);
        const doc = normalizeDigits(sup.cnpjOrCpf);
        return n1.includes(q) || n2.includes(q) || (qDigits.length > 0 && doc.includes(qDigits));
      })
      .slice(0, 40);
  }, [suppliersList, envolvidoSearch]);

  const filteredClientsDropdown = useMemo(() => {
    const q = normalizeText(envolvidoSearch);
    const qDigits = normalizeDigits(envolvidoSearch);
    return clientsList
      .filter((cli) => {
        if (!q) return true;
        const n1 = normalizeText(cli.name || cli.nome);
        const n2 = normalizeText(cli.farmName || cli.fazenda);
        const doc = normalizeDigits(cli.cpfCnpj);
        return n1.includes(q) || n2.includes(q) || (qDigits.length > 0 && doc.includes(qDigits));
      })
      .slice(0, 40);
  }, [clientsList, envolvidoSearch]);

  const showAvulsoOption = useMemo(() => {
    const q = normalizeText(envolvidoSearch);
    if (!q) return true;
    return (
      'consumidor avulso balcao'.includes(q) ||
      q.includes('avulso') ||
      q.includes('balcao')
    );
  }, [envolvidoSearch]);

  const supplierPendingBills = useMemo(() => {
    if (tipoOperacao !== 'devolucao_fornecedor' || !selectedSupplierId) return [];
    const sup = suppliersList.find((s) => String(s.id) === String(selectedSupplierId));
    if (!sup) return [];
    const supId = String(sup.id);
    const supName = normalizeText(sup.name);
    const supTrade = normalizeText(sup.tradeName);

    return expensesList
      .filter((exp) => {
        if (!isExpensePendingForAbatement(exp)) return false;
        const expSupId = String(exp.supplierId || exp.fornecedorId || '');
        if (expSupId && expSupId === supId) return true;
        const expSupName = normalizeText(exp.supplier || (exp as any).fornecedor || '');
        if (!expSupName) return false;
        if (supName && expSupName === supName) return true;
        if (supTrade && expSupName === supTrade) return true;
        return false;
      })
      .sort((a, b) =>
        String(a.dueDate || (a as any).data_vencimento || '').localeCompare(
          String(b.dueDate || (b as any).data_vencimento || '')
        )
      );
  }, [tipoOperacao, selectedSupplierId, suppliersList, expensesList]);

  useEffect(() => {
    if (supplierPendingBills.length === 0) {
      if (selectedBoletoId) setSelectedBoletoId('');
      return;
    }
    if (!supplierPendingBills.some((b) => String(b.id) === String(selectedBoletoId))) {
      setSelectedBoletoId(String(supplierPendingBills[0].id));
    }
  }, [supplierPendingBills, selectedBoletoId]);

  const selectedBoleto = useMemo(
    () => supplierPendingBills.find((b) => String(b.id) === String(selectedBoletoId)) || null,
    [supplierPendingBills, selectedBoletoId]
  );

  // Vinculação inteligente: consulta todas as Notas Fiscais de Entrada (Fornecedor) ou Vendas/Pedidos (Cliente)
  const relatedOriginDocs = useMemo<OriginDocOption[]>(() => {
    if (!isOpen) return [];
    const options: OriginDocOption[] = [];
    const seenKeys = new Set<string>();

    if (tipoOperacao === 'devolucao_fornecedor') {
      if (!selectedSupplier) return [];
      const supId = String(selectedSupplier.id);
      const supName = normalizeText(selectedSupplier.name);
      const supTrade = normalizeText(selectedSupplier.tradeName);
      const supDigits = normalizeDigits(selectedSupplier.cnpjOrCpf);

      const matchesSup = (
        id?: string | null,
        name?: string | null,
        cnpj?: string | null
      ): boolean => {
        if (id && String(id) === supId) return true;
        const docDigits = normalizeDigits(cnpj);
        if (supDigits && docDigits && supDigits === docDigits) return true;
        const normName = normalizeText(name);
        if (!normName) return false;
        if (supName && (normName === supName || normName.includes(supName) || supName.includes(normName))) {
          return true;
        }
        if (supTrade && (normName === supTrade || normName.includes(supTrade) || supTrade.includes(normName))) {
          return true;
        }
        return false;
      };

      const allDocItens = getStoredDocumentosEntradaItens();

      // 1) Documentos de Entrada (XML importados e entradas manuais)
      getStoredDocumentosEntrada().forEach((doc) => {
        const dName = doc.fornecedor_nome || doc.fornecedor;
        if (!matchesSup(doc.fornecedor_id, dName, doc.fornecedor_cnpj)) return;
        const numRaw = String(doc.numero || doc.numero_documento || '').trim();
        const numDisplay = numRaw
          ? numRaw.toUpperCase().startsWith('NF')
            ? numRaw
            : `NF ${numRaw}`
          : `DOC-${String(doc.id).slice(-5)}`;
        const dateIso = normalizeDateIso(doc.data_emissao || doc.data || doc.data_entrada);
        const amount = Number(doc.valor_total || 0);
        const dedupKey = `nf_${normalizeText(numRaw || doc.id)}`;
        if (seenKeys.has(dedupKey)) return;
        seenKeys.add(dedupKey);

        const docItemsFromTable = allDocItens.filter(
          (it) => String(it.documento_entrada_id) === String(doc.id)
        );
        const mergedItems = (
          doc.itens && doc.itens.length > 0 ? doc.itens : docItemsFromTable
        ).map((it) => ({
          productId: it.produto_id ? String(it.produto_id) : undefined,
          description: String(it.descricao || ''),
          unitPrice: Number(it.valor_unitario || 0),
        }));

        options.push({
          id: `doc_ent_${doc.id}`,
          value: numDisplay,
          number: numRaw || numDisplay,
          label: `${numDisplay}${dateIso ? ` - ${formatDateBR(dateIso)}` : ''} - ${formatCurrencyBRL(amount)}`,
          dateStr: dateIso,
          amount,
          sourceLabel: doc.tipo_documento || 'NF-e Entrada',
          items: mergedItems,
        });
      });

      // 2) Notas Fiscais diretas (agrocontrol_notas_nfe / agrocontrol_notas_nfec)
      ['agrocontrol_notas_nfe', 'agrocontrol_notas_nfec'].forEach((storageKey) => {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          parsed.forEach((n: any) => {
            if (!n || !matchesSup(n.supplierId, n.supplierName, n.supplierCnpj)) return;
            const numRaw = String(n.number || '').trim();
            const numDisplay = numRaw
              ? numRaw.toUpperCase().startsWith('NF')
                ? numRaw
                : `NF ${numRaw}`
              : `NF-${String(n.id).slice(-5)}`;
            const dateIso = normalizeDateIso(n.issueDate || n.createdAt);
            const amount = Number(n.totalAmount || 0);
            const dedupKey = `nf_${normalizeText(numRaw || n.id)}`;
            if (seenKeys.has(dedupKey)) return;
            seenKeys.add(dedupKey);

            const items: OriginDocItemMatch[] = Array.isArray(n.items)
              ? n.items.map((it: any) => ({
                  productId: it.productId ? String(it.productId) : undefined,
                  code: it.code ? String(it.code) : undefined,
                  description: String(it.description || ''),
                  unitPrice: Number(it.unitPrice || 0),
                }))
              : [];

            options.push({
              id: `${storageKey}_${n.id}`,
              value: numDisplay,
              number: numRaw || numDisplay,
              label: `${numDisplay}${dateIso ? ` - ${formatDateBR(dateIso)}` : ''} - ${formatCurrencyBRL(amount)}`,
              dateStr: dateIso,
              amount,
              sourceLabel: storageKey === 'agrocontrol_notas_nfec' ? 'NFC-e' : 'NF-e',
              items,
            });
          });
        } catch {}
      });

      // 3) Notas registradas no Contas a Pagar / Despesas vinculadas ao fornecedor
      const expGroups = new Map<
        string,
        { numRaw: string; numDisplay: string; dateIso: string; total: number; id: string }
      >();
      expensesList.forEach((exp) => {
        const expSupId = exp.supplierId || exp.fornecedorId;
        const expSupName = exp.supplier || (exp as any).fornecedor;
        if (!matchesSup(expSupId, expSupName, undefined)) return;
        const invNum = String(exp.invoiceNumber || '').trim();
        if (!invNum) return;
        const normInv = normalizeText(invNum.replace(/^nf[\s\-:]*/i, ''));
        if (!normInv || seenKeys.has(`nf_${normInv}`) || seenKeys.has(`nf_${normalizeText(invNum)}`)) {
          return;
        }
        const amt = getExpenseOpenAmount(exp);
        const dateIso = normalizeDateIso(exp.dueDate || exp.paymentDate || exp.createdAt);
        const existingGroup = expGroups.get(normInv);
        if (existingGroup) {
          existingGroup.total = Number((existingGroup.total + amt).toFixed(2));
        } else {
          const numDisplay = invNum.toUpperCase().startsWith('NF') ? invNum : `NF ${invNum}`;
          expGroups.set(normInv, {
            id: `exp_${exp.id}`,
            numRaw: invNum,
            numDisplay,
            dateIso,
            total: amt,
          });
        }
      });

      expGroups.forEach((grp, normInv) => {
        const dedupKey = `nf_${normInv}`;
        if (seenKeys.has(dedupKey)) return;
        seenKeys.add(dedupKey);
        options.push({
          id: grp.id,
          value: grp.numDisplay,
          number: grp.numRaw,
          label: `${grp.numDisplay}${grp.dateIso ? ` - ${formatDateBR(grp.dateIso)}` : ''} - ${formatCurrencyBRL(grp.total)}`,
          dateStr: grp.dateIso,
          amount: grp.total,
          sourceLabel: 'Conta / NF',
          items: [],
        });
      });
    } else if (selectedClientId) {
      const isAvulso = selectedClientId === 'consumidor_avulso';
      const cliId = selectedClient ? String(selectedClient.id) : '';
      const cliName = normalizeText(selectedClient?.name || selectedClient?.nome);
      const cliDigits = normalizeDigits(selectedClient?.cpfCnpj);

      const matchesCli = (
        id?: string | null,
        name?: string | null,
        doc?: string | null
      ): boolean => {
        if (isAvulso) {
          if (id === 'consumidor_avulso') return true;
          const n = normalizeText(name);
          return !id && (n === '' || n.includes('consumidor') || n.includes('avulso') || n.includes('balcao'));
        }
        if (id && cliId && String(id) === cliId) return true;
        const dDigits = normalizeDigits(doc);
        if (cliDigits && dDigits && cliDigits === dDigits) return true;
        const n = normalizeText(name);
        if (cliName && n && (n === cliName || n.includes(cliName) || cliName.includes(n))) {
          return true;
        }
        return false;
      };

      // 1) Vendas PDV (agrocontrol_vendas / agrocontrol_pdv_vendas / colaca_silagem_vendas_pdv)
      ['agrocontrol_vendas', 'agrocontrol_pdv_vendas', 'colaca_silagem_vendas_pdv'].forEach((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          parsed.forEach((v: any) => {
            if (!v) return;
            if (!matchesCli(v.clientId, v.cliente || v.clientName, v.clienteCpfCnpj)) return;
            const num = String(v.numeroPedido || v.orderNumber || v.numeroVenda || `PDV-${v.id}`).trim();
            const dedupKey = `venda_${normalizeText(num)}`;
            if (seenKeys.has(dedupKey)) return;
            seenKeys.add(dedupKey);
            const dateIso = normalizeDateIso(v.date || v.data || v.criadoEm || v.createdAt);
            const amount = Number(v.totalLiquido ?? v.valorLiquido ?? v.totalAmount ?? 0);
            const items: OriginDocItemMatch[] = Array.isArray(v.itens)
              ? v.itens.map((it: any) => ({
                  productId: it.productId ? String(it.productId) : it.id ? String(it.id) : undefined,
                  code: it.codigo ? String(it.codigo) : undefined,
                  description: String(it.descricao || it.description || ''),
                  unitPrice: Number(it.precoUnitario || it.unitPrice || 0),
                }))
              : [];
            options.push({
              id: `pdv_${v.id || num}`,
              value: num,
              number: num,
              label: `${num}${dateIso ? ` - ${formatDateBR(dateIso)}` : ''} - ${formatCurrencyBRL(amount)}`,
              dateStr: dateIso,
              amount,
              sourceLabel: 'Venda PDV',
              items,
            });
          });
        } catch {}
      });

      // 2) Pedidos / Vendas no módulo de Serviços
      getStoredServices().forEach((srv) => {
        const typeStr = normalizeText(srv.serviceType);
        const tabStr = normalizeText(srv.serviceTab);
        if (!typeStr.includes('venda') && tabStr !== 'venda') return;
        if (!matchesCli(srv.clientId, srv.clientName, undefined)) return;
        const num = String(srv.orderNumber || `VND-${String(srv.id).slice(-5)}`).trim();
        const dedupKey = `venda_${normalizeText(num)}`;
        if (seenKeys.has(dedupKey)) return;
        seenKeys.add(dedupKey);
        const dateIso = normalizeDateIso(srv.date || srv.startDate || (srv as any).createdAt);
        const amount = Number(srv.totalAmount || 0);
        options.push({
          id: `srv_${srv.id}`,
          value: num,
          number: num,
          label: `${num}${dateIso ? ` - ${formatDateBR(dateIso)}` : ''} - ${formatCurrencyBRL(amount)}`,
          dateStr: dateIso,
          amount,
          sourceLabel: 'Pedido / Venda',
          items: [],
        });
      });
    }

    return options.sort((a, b) => String(b.dateStr || '').localeCompare(String(a.dateStr || '')));
  }, [isOpen, tipoOperacao, selectedSupplier, selectedClient, selectedClientId, expensesList]);

  const activeOriginDoc = useMemo<OriginDocOption | null>(() => {
    if (selectedOriginDocId) {
      const byId = relatedOriginDocs.find((d) => d.id === selectedOriginDocId);
      if (byId) return byId;
    }
    const q = normalizeText(numeroOrigem);
    if (!q) return null;
    return (
      relatedOriginDocs.find(
        (d) => normalizeText(d.value) === q || normalizeText(d.number) === q
      ) || null
    );
  }, [relatedOriginDocs, selectedOriginDocId, numeroOrigem]);

  const filteredOriginDocsDropdown = useMemo(() => {
    const q = normalizeText(numeroOrigem);
    if (!q) return relatedOriginDocs.slice(0, 40);
    return relatedOriginDocs
      .filter((d) => normalizeText(d.label).includes(q) || normalizeText(d.value).includes(q))
      .slice(0, 40);
  }, [relatedOriginDocs, numeroOrigem]);

  // Mapa de produtos vinculados ao fornecedor selecionado (via notas do fornecedor ou campos no item)
  const supplierLinkedInvIds = useMemo(() => {
    const matchedIds = new Set<string>();
    if (tipoOperacao !== 'devolucao_fornecedor' || !selectedSupplier) return matchedIds;

    const supId = String(selectedSupplier.id);
    const supName = normalizeText(selectedSupplier.name);
    const supTrade = normalizeText(selectedSupplier.tradeName);

    const allOriginItems: OriginDocItemMatch[] = [];
    relatedOriginDocs.forEach((doc) => {
      doc.items.forEach((it) => allOriginItems.push(it));
    });

    inventoryList.forEach((inv) => {
      const rawSupId = String(
        (inv as any).supplierId || (inv as any).fornecedorId || (inv as any).fornecedor_id || ''
      );
      const rawSupName = normalizeText(
        (inv as any).supplier || (inv as any).fornecedor || (inv as any).fornecedor_nome || ''
      );
      const directMatch =
        (rawSupId && rawSupId === supId) ||
        (rawSupName &&
          ((supName && rawSupName.includes(supName)) ||
            (supTrade && rawSupName.includes(supTrade))));

      if (
        directMatch ||
        allOriginItems.some((orgIt) => inventoryItemMatchesOriginItem(inv, orgIt))
      ) {
        matchedIds.add(String(inv.id));
      }
    });

    return matchedIds;
  }, [tipoOperacao, selectedSupplier, relatedOriginDocs, inventoryList]);

  // Lista priorizada e filtrada para o campo unificado "PRODUTO DEVOLVIDO *"
  const groupedDevolvidoOptions = useMemo(() => {
    const q = normalizeText(searchDevolvido);
    const selectedItem = inventoryList.find(
      (i) => String(i.id) === String(selectedProdDevolvidoId)
    );
    const selectedDisplayStr = selectedItem
      ? normalizeText(
          `${getItemCode(selectedItem) ? `[${getItemCode(selectedItem)}] ` : ''}${getItemDisplayName(
            selectedItem
          )}`
        )
      : '';
    // Se o texto no input é exatamente o nome do produto recém-selecionado, mostra a lista completa ao reabrir
    const effectiveQuery = q && q === selectedDisplayStr ? '' : q;

    const matchesQuery = (item: InventoryItem) => {
      if (!effectiveQuery) return true;
      const name = normalizeText(getItemDisplayName(item));
      const code = normalizeText(getItemCode(item));
      const barcode = normalizeText(item.barcode || item.codigo_barras);
      return (
        name.includes(effectiveQuery) ||
        code.includes(effectiveQuery) ||
        barcode.includes(effectiveQuery)
      );
    };

    const noteItems: Array<{ item: InventoryItem; originUnitPrice?: number }> = [];
    const supplierItems: InventoryItem[] = [];
    const generalItems: InventoryItem[] = [];
    const seenIds = new Set<string>();

    // 1. Produtos da Nota / Venda de Origem selecionada
    if (activeOriginDoc && activeOriginDoc.items.length > 0) {
      inventoryList.forEach((item) => {
        if (!matchesQuery(item)) return;
        const matchedOrigin = activeOriginDoc.items.find((orgIt) =>
          inventoryItemMatchesOriginItem(item, orgIt)
        );
        if (matchedOrigin) {
          noteItems.push({ item, originUnitPrice: matchedOrigin.unitPrice });
          seenIds.add(String(item.id));
        }
      });
    }

    // 2. Produtos vinculados ao Fornecedor selecionado
    if (tipoOperacao === 'devolucao_fornecedor' && supplierLinkedInvIds.size > 0) {
      inventoryList.forEach((item) => {
        if (seenIds.has(String(item.id))) return;
        if (!matchesQuery(item)) return;
        if (supplierLinkedInvIds.has(String(item.id))) {
          supplierItems.push(item);
          seenIds.add(String(item.id));
        }
      });
    }

    // 3. Restante do estoque acessível logo abaixo
    inventoryList.forEach((item) => {
      if (seenIds.has(String(item.id))) return;
      if (!matchesQuery(item)) return;
      if (generalItems.length < 60) {
        generalItems.push(item);
      }
    });

    return { noteItems, supplierItems, generalItems };
  }, [
    inventoryList,
    searchDevolvido,
    selectedProdDevolvidoId,
    activeOriginDoc,
    tipoOperacao,
    supplierLinkedInvIds,
  ]);

  const filteredLevadoOptions = useMemo(() => {
    const q = normalizeText(searchLevado);
    const selectedItem = inventoryList.find((i) => String(i.id) === String(selectedProdLevadoId));
    const selectedDisplayStr = selectedItem
      ? normalizeText(
          `${getItemCode(selectedItem) ? `[${getItemCode(selectedItem)}] ` : ''}${getItemDisplayName(
            selectedItem
          )}`
        )
      : '';
    const effectiveQuery = q && q === selectedDisplayStr ? '' : q;

    return inventoryList
      .filter((item) => {
        if (!effectiveQuery) return true;
        const name = normalizeText(getItemDisplayName(item));
        const code = normalizeText(getItemCode(item));
        const barcode = normalizeText(item.barcode || item.codigo_barras);
        return (
          name.includes(effectiveQuery) ||
          code.includes(effectiveQuery) ||
          barcode.includes(effectiveQuery)
        );
      })
      .slice(0, 60);
  }, [inventoryList, searchLevado, selectedProdLevadoId]);

  const handleSelectProdDevolvido = (id: string, originUnitPrice?: number) => {
    setSelectedProdDevolvidoId(id);
    const found = inventoryList.find((i) => String(i.id) === String(id));
    if (found) {
      const codePrefix = getItemCode(found) ? `[${getItemCode(found)}] ` : '';
      setSearchDevolvido(`${codePrefix}${getItemDisplayName(found)}`);
      const fallbackPrice =
        tipoOperacao === 'devolucao_fornecedor'
          ? getItemCostPrice(found)
          : getItemSalePrice(found);
      const price =
        originUnitPrice !== undefined && originUnitPrice > 0
          ? originUnitPrice
          : fallbackPrice;
      setPrecoDevolvido(price > 0 ? price.toFixed(2) : '0.00');
    }
    setIsProdDevolvidoDropdownOpen(false);
  };

  const handleSelectProdLevado = (id: string) => {
    setSelectedProdLevadoId(id);
    const found = inventoryList.find((i) => String(i.id) === String(id));
    if (found) {
      const codePrefix = getItemCode(found) ? `[${getItemCode(found)}] ` : '';
      setSearchLevado(`${codePrefix}${getItemDisplayName(found)}`);
      const price = getItemSalePrice(found);
      setPrecoLevado(price > 0 ? price.toFixed(2) : '0.00');
    }
    setIsProdLevadoDropdownOpen(false);
  };

  const handleAddItemDevolvido = () => {
    setErrorMsg(null);
    const prod = inventoryList.find((i) => String(i.id) === String(selectedProdDevolvidoId));
    if (!prod) {
      setErrorMsg('Selecione um produto do estoque para adicionar aos itens devolvidos.');
      return;
    }
    const qty = Number(String(qtdDevolvida).replace(',', '.'));
    const unitPrice = Number(String(precoDevolvido || '0').replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg('Informe uma quantidade válida maior que zero para o produto devolvido.');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setErrorMsg('Informe um valor unitário válido.');
      return;
    }

    const newItem: TrocaDevolucaoItem = {
      id: `dev_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: prod.id,
      productCode: getItemCode(prod),
      productName: getItemDisplayName(prod),
      unit: prod.unit || prod.unidade_medida || 'UN',
      quantity: qty,
      unitPrice,
      totalPrice: Number((qty * unitPrice).toFixed(2)),
      returnToStock: retornarAoEstoque,
    };

    setItensDevolvidos((prev) => [...prev, newItem]);
    setSelectedProdDevolvidoId('');
    setSearchDevolvido('');
    setQtdDevolvida('1');
    setPrecoDevolvido('');
  };

  const handleAddItemLevado = () => {
    setErrorMsg(null);
    const prod = inventoryList.find((i) => String(i.id) === String(selectedProdLevadoId));
    if (!prod) {
      setErrorMsg('Selecione um produto do estoque para adicionar aos itens levados na troca.');
      return;
    }
    const qty = Number(String(qtdLevada).replace(',', '.'));
    const unitPrice = Number(String(precoLevado || '0').replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg('Informe uma quantidade válida maior que zero para o produto levado.');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setErrorMsg('Informe um valor unitário válido.');
      return;
    }

    const newItem: TrocaDevolucaoItem = {
      id: `lev_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: prod.id,
      productCode: getItemCode(prod),
      productName: getItemDisplayName(prod),
      unit: prod.unit || prod.unidade_medida || 'UN',
      quantity: qty,
      unitPrice,
      totalPrice: Number((qty * unitPrice).toFixed(2)),
      returnToStock: false,
    };

    setItensLevados((prev) => [...prev, newItem]);
    setSelectedProdLevadoId('');
    setSearchLevado('');
    setQtdLevada('1');
    setPrecoLevado('');
  };

  const totalDevolvido = useMemo(
    () =>
      Number(
        itensDevolvidos.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0).toFixed(2)
      ),
    [itensDevolvidos]
  );

  const totalLevado = useMemo(
    () =>
      tipoOperacao === 'troca_direta'
        ? Number(
            itensLevados.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0).toFixed(2)
          )
        : 0,
    [itensLevados, tipoOperacao]
  );

  // saldoFinal > 0: cliente paga diferença; saldoFinal < 0: cliente tem crédito/estorno
  const saldoFinal = useMemo(
    () => Number((totalLevado - totalDevolvido).toFixed(2)),
    [totalLevado, totalDevolvido]
  );

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (tipoOperacao === 'devolucao_fornecedor' && !selectedSupplierId) {
      setErrorMsg('Busque e selecione um Fornecedor no Card 1 antes de confirmar a operação.');
      return;
    }
    if (tipoOperacao !== 'devolucao_fornecedor' && !selectedClientId) {
      setErrorMsg('Busque e selecione um Cliente (ou "Consumidor Avulso") no Card 1.');
      return;
    }
    if (itensDevolvidos.length === 0) {
      setErrorMsg('Adicione pelo menos 1 produto devolvido antes de confirmar a operação.');
      return;
    }
    if (tipoOperacao === 'troca_direta' && itensLevados.length === 0) {
      setErrorMsg('Na Troca Direta, adicione pelo menos 1 produto levado pelo cliente.');
      return;
    }
    if (tipoOperacao === 'devolucao_fornecedor' && destinoFornecedor === 'abatimento_boleto') {
      if (!selectedBoleto) {
        setErrorMsg(
          'Nenhum boleto pendente selecionado para abatimento. Escolha um boleto em aberto ou selecione "Não abater agora / Aguardar Nota ou Crédito Futuro".'
        );
        return;
      }
      if (totalDevolvido <= 0) {
        setErrorMsg('O valor total devolvido deve ser maior que zero para abater um boleto.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const companyId = companyProfile?.id || getActiveCompanyId() || 'default';
      const existingTrocas = getStoredTrocasDevolucoes();
      const protocolo = getNextTrocaProtocolo(existingTrocas);

      // Resolver envolvido
      const isFornecedor = tipoOperacao === 'devolucao_fornecedor';
      let envolvidoId: string | undefined;
      let envolvidoNome = '';
      let envolvidoDocumento = '';
      let envolvidoTelefone = '';

      if (isFornecedor) {
        const sup = suppliersList.find((s) => String(s.id) === String(selectedSupplierId));
        envolvidoId = sup?.id;
        envolvidoNome = sup?.name || sup?.tradeName || 'Fornecedor Não Informado';
        envolvidoDocumento = sup?.cnpjOrCpf || '';
        envolvidoTelefone = sup?.phone || '';
      } else {
        if (selectedClientId === 'consumidor_avulso') {
          envolvidoId = 'consumidor_avulso';
          envolvidoNome = avulsoNome.trim() || 'Consumidor Avulso';
        } else {
          const cli = clientsList.find((c) => String(c.id) === String(selectedClientId));
          envolvidoId = cli?.id;
          envolvidoNome = cli?.name || cli?.nome || 'Consumidor Avulso';
          envolvidoDocumento = cli?.cpfCnpj || '';
          envolvidoTelefone = cli?.phone || cli?.telefone || '';
        }
      }

      // 1. ATUALIZAÇÃO IMEDIATA DO ESTOQUE NO LOCALSTORAGE
      const currentInventory = getStoredInventory();
      const updatedInventory = currentInventory.map((inv) => ({ ...inv }));

      const applyStockDelta = (prodId: string, prodCode: string | undefined, delta: number) => {
        if (!delta) return;
        const idx = updatedInventory.findIndex(
          (p) =>
            String(p.id) === String(prodId) ||
            (prodCode &&
              (String(p.codigo_produto || '').trim().toUpperCase() === prodCode.toUpperCase() ||
                String(p.code || '').trim().toUpperCase() === prodCode.toUpperCase()))
        );
        if (idx >= 0) {
          const p = updatedInventory[idx];
          const isService =
            String(p.categoria || '').toUpperCase() === 'SERVIÇOS' ||
            String(p.tipo_item || '').toUpperCase() === 'SERVIÇO';
          if (isService) return;
          const prevQty = Number(p.quantidade_atual ?? p.quantity ?? 0);
          const nextQty = Math.max(0, Number((prevQty + delta).toFixed(3)));
          updatedInventory[idx] = {
            ...p,
            quantity: nextQty,
            quantidade_atual: nextQty,
            updatedAt: now.toISOString(),
          };
        }
      };

      itensDevolvidos.forEach((item) => {
        if (item.returnToStock !== false) {
          // Cliente devolve para o estoque (+) | Empresa devolve para o fornecedor (-)
          const delta = isFornecedor ? -Math.abs(item.quantity) : Math.abs(item.quantity);
          applyStockDelta(item.productId, item.productCode, delta);
        }
      });

      if (tipoOperacao === 'troca_direta') {
        itensLevados.forEach((item) => {
          applyStockDelta(item.productId, item.productCode, -Math.abs(item.quantity));
        });
      }

      saveStoredInventory(updatedInventory);
      window.dispatchEvent(new CustomEvent('silagem_inventory_changed', { detail: updatedInventory }));
      window.dispatchEvent(new CustomEvent('silagem_inventory_updated', { detail: updatedInventory }));
      window.dispatchEvent(new CustomEvent('inventory_updated', { detail: updatedInventory }));

      // 2. INTEGRAÇÃO FINANCEIRA E VALE-CRÉDITO
      let destinoFinanceiro: TrocaDestinoFinanceiro = 'sem_impacto';
      let destinoFinanceiroLabel = 'Sem Impacto Financeiro';
      let valeCreditoId: string | undefined;
      let valeCreditoValor: number | undefined;
      let formaPagDif: string | undefined;
      let formaEstornoFinal: string | undefined;
      let boletoAbatidoInfo: BoletoAbatidoInfo | undefined;

      const dataBR = formatDateBR(dataOperacao);
      const horaStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      if (isFornecedor) {
        if (destinoFornecedor === 'abatimento_boleto' && selectedBoleto) {
          const allExpenses = getStoredExpenses();
          const targetIdx = allExpenses.findIndex(
            (exp) => String(exp.id) === String(selectedBoleto.id)
          );
          const targetExp = targetIdx >= 0 ? allExpenses[targetIdx] : selectedBoleto;
          const valorAnterior = getExpenseOpenAmount(targetExp);
          const valorAbatido = Number(Math.min(valorAnterior, totalDevolvido).toFixed(2));
          const saldoBruto = Number((valorAnterior - totalDevolvido).toFixed(2));
          const isQuitado = saldoBruto <= 0.005;
          const saldoRestante = isQuitado ? 0 : saldoBruto;
          const statusResultante = isQuitado
            ? 'Liquidado / Abatido por Devolução'
            : 'Pendente (Abatido Parcialmente)';
          const docLabel = getExpenseDocLabel(targetExp);
          const vencRaw = targetExp.dueDate || (targetExp as any).data_vencimento || '';
          const abatimentoNote = `Abatimento referente à Devolução Protocolo ${protocolo}`;
          const nextNotes = targetExp.notes
            ? `${targetExp.notes} | ${abatimentoNote}`
            : abatimentoNote;

          const updatedExp: Expense = {
            ...targetExp,
            amount: saldoRestante,
            valor_parcela: saldoRestante,
            status: isQuitado ? 'Liquidado / Abatido por Devolução' : targetExp.status,
            paymentDate: isQuitado ? dataOperacao : targetExp.paymentDate,
            notes: nextNotes,
          };
          if ((targetExp as any).valor !== undefined) {
            (updatedExp as any).valor = saldoRestante;
          }

          const nextExpenses =
            targetIdx >= 0
              ? allExpenses.map((exp, idx) => (idx === targetIdx ? updatedExp : exp))
              : [updatedExp, ...allExpenses];
          saveStoredExpenses(nextExpenses);

          boletoAbatidoInfo = {
            expenseId: targetExp.id,
            documento: docLabel,
            descricao: targetExp.description,
            vencimento: vencRaw,
            valorAnterior,
            valorAbatido,
            saldoRestante,
            statusResultante,
          };

          destinoFinanceiro = 'abatimento_boleto';
          destinoFinanceiroLabel = `Abatido no Boleto ${docLabel} (${formatCurrencyBRL(
            valorAbatido
          )}${isQuitado ? ' — Liquidado' : ` • Restante: ${formatCurrencyBRL(saldoRestante)}`})`;
        } else if (destinoFornecedor === 'credito_fornecedor') {
          destinoFinanceiro = 'credito_fornecedor';
          destinoFinanceiroLabel = `Aguardar Nota / Crédito Futuro Fornecedor (${formatCurrencyBRL(
            totalDevolvido
          )})`;
        } else if (destinoFornecedor === 'diferenca_recebida' && totalDevolvido > 0) {
          destinoFinanceiro = 'diferenca_recebida';
          destinoFinanceiroLabel = `Estorno Recebido Fornecedor (${formatCurrencyBRL(totalDevolvido)})`;
          const receitaItem = {
            id: `troca_forn_${Date.now()}`,
            numeroPedido: protocolo,
            data: dataBR,
            date: dataOperacao,
            hora: horaStr,
            cliente: envolvidoNome,
            valor: totalDevolvido,
            totalLiquido: totalDevolvido,
            totalAmount: totalDevolvido,
            amount: totalDevolvido,
            formaPagamento: 'PIX / ESTORNO FORNECEDOR',
            tipo: 'receita',
            type: 'entrada',
            status: 'liquidado',
            descricao: `Estorno Devolução Fornecedor ${protocolo} - ${envolvidoNome}`,
            createdAt: now.toISOString(),
          };
          try {
            const consolidado = JSON.parse(
              localStorage.getItem('agrocontrol_financeiro_consolidado') || '[]'
            );
            consolidado.unshift(receitaItem);
            localStorage.setItem(
              'agrocontrol_financeiro_consolidado',
              JSON.stringify(consolidado)
            );
            const liquidadas = JSON.parse(
              localStorage.getItem('agrocontrol_receitas_liquidadas') || '[]'
            );
            liquidadas.unshift(receitaItem);
            localStorage.setItem('agrocontrol_receitas_liquidadas', JSON.stringify(liquidadas));
            window.dispatchEvent(
              new CustomEvent('agrocontrol_financeiro_consolidado_updated', { detail: receitaItem })
            );
            window.dispatchEvent(
              new CustomEvent('agrocontrol_receitas_liquidadas_updated', { detail: receitaItem })
            );
          } catch {}
        } else {
          destinoFinanceiro = 'sem_impacto';
          destinoFinanceiroLabel = 'Garantia / Sem Impacto Financeiro';
        }
      } else if (tipoOperacao === 'troca_direta' && Math.abs(saldoFinal) < 0.005) {
        destinoFinanceiro = 'sem_impacto';
        destinoFinanceiroLabel = 'Troca Equivalente (Sem Diferença)';
      } else if (tipoOperacao === 'troca_direta' && saldoFinal > 0.005) {
        // Cliente deve pagar diferença
        const valorDif = Number(saldoFinal.toFixed(2));
        formaPagDif = formaPagamentoDiferenca;
        const isPrazo = formaPagamentoDiferenca.toUpperCase().includes('PRAZO');

        if (isPrazo) {
          destinoFinanceiro = 'diferenca_receber';
          destinoFinanceiroLabel = `A Receber (${formatCurrencyBRL(valorDif)}) - ${formaPagamentoDiferenca}`;

          const receberItem = {
            id: `rec_troca_${Date.now()}`,
            orderNumber: protocolo,
            numeroPedido: protocolo,
            clientId: envolvidoId !== 'consumidor_avulso' ? envolvidoId : undefined,
            clientName: envolvidoNome,
            cliente: envolvidoNome,
            date: dataOperacao,
            startDate: dataOperacao,
            data: dataBR,
            dueDate: dataOperacao,
            status: 'PENDENTE',
            tipo: 'receber',
            valor: valorDif,
            totalLiquido: valorDif,
            totalAmount: valorDif,
            amount: valorDif,
            formaPagamento: formaPagamentoDiferenca,
            descricao: `Diferença de Troca ${protocolo} - ${envolvidoNome}`,
            createdAt: now.toISOString(),
          };
          try {
            const receberAtuais = JSON.parse(
              localStorage.getItem('agrocontrol_financeiro_receber') ||
                localStorage.getItem('agrocontrol_receber') ||
                '[]'
            );
            receberAtuais.unshift(receberItem);
            localStorage.setItem('agrocontrol_contas_receber', JSON.stringify(receberAtuais));
            localStorage.setItem('agrocontrol_financeiro_receber', JSON.stringify(receberAtuais));
            localStorage.setItem('agrocontrol_receber', JSON.stringify(receberAtuais));
            window.dispatchEvent(
              new CustomEvent('agrocontrol_contas_receber_updated', { detail: receberAtuais })
            );
            window.dispatchEvent(
              new CustomEvent('agrocontrol_financeiro_receber_updated', { detail: receberAtuais })
            );
            window.dispatchEvent(
              new CustomEvent('agrocontrol_receber_updated', { detail: receberAtuais })
            );
          } catch {}

          if (isCaixaAbertoHojeParaOperador().aberto) {
            registrarVendaNoCaixa({
              id: `cx_troca_${Date.now()}`,
              numeroPedido: protocolo,
              cliente: envolvidoNome,
              valor: valorDif,
              formaPagamento: 'A PRAZO (CARTEIRA)',
              dataHora: `${dataBR} ${horaStr}`,
            });
          }
        } else {
          destinoFinanceiro = 'diferenca_recebida';
          destinoFinanceiroLabel = `Diferença Recebida (${formatCurrencyBRL(valorDif)}) - ${formaPagamentoDiferenca}`;

          const receitaItem = {
            id: `rec_troca_${Date.now()}`,
            numeroPedido: protocolo,
            data: dataBR,
            date: dataOperacao,
            hora: horaStr,
            cliente: envolvidoNome,
            valor: valorDif,
            totalLiquido: valorDif,
            totalAmount: valorDif,
            amount: valorDif,
            formaPagamento: formaPagamentoDiferenca,
            tipo: 'receita',
            type: 'entrada',
            status: 'liquidado',
            descricao: `Diferença de Troca ${protocolo} - ${envolvidoNome}`,
            createdAt: now.toISOString(),
          };
          try {
            const consolidado = JSON.parse(
              localStorage.getItem('agrocontrol_financeiro_consolidado') || '[]'
            );
            consolidado.unshift(receitaItem);
            localStorage.setItem(
              'agrocontrol_financeiro_consolidado',
              JSON.stringify(consolidado)
            );
            const liquidadas = JSON.parse(
              localStorage.getItem('agrocontrol_receitas_liquidadas') || '[]'
            );
            liquidadas.unshift(receitaItem);
            localStorage.setItem('agrocontrol_receitas_liquidadas', JSON.stringify(liquidadas));
            window.dispatchEvent(
              new CustomEvent('agrocontrol_financeiro_consolidado_updated', { detail: receitaItem })
            );
            window.dispatchEvent(
              new CustomEvent('agrocontrol_receitas_liquidadas_updated', { detail: receitaItem })
            );
          } catch {}

          if (isCaixaAbertoHojeParaOperador().aberto) {
            registrarVendaNoCaixa({
              id: `cx_troca_${Date.now()}`,
              numeroPedido: protocolo,
              cliente: envolvidoNome,
              valor: valorDif,
              formaPagamento: formaPagamentoDiferenca,
              dataHora: `${dataBR} ${horaStr}`,
            });
          }
        }
      } else {
        // Saldo a favor do cliente (Devolução de Cliente ou Troca com crédito residual)
        const valorCreditoOuEstorno =
          tipoOperacao === 'troca_direta' ? Math.abs(saldoFinal) : totalDevolvido;

        if (valorCreditoOuEstorno > 0) {
          if (modoCreditoOuEstorno === 'vale_credito') {
            destinoFinanceiro = 'vale_credito';
            destinoFinanceiroLabel = `Vale-Crédito (${formatCurrencyBRL(valorCreditoOuEstorno)})`;
            valeCreditoValor = valorCreditoOuEstorno;
            valeCreditoId = `cred_${Date.now()}`;
            formaEstornoFinal = 'CRÉDITO / VALE-TROCA';

            const novoCredito: ClienteCredito = {
              id: valeCreditoId,
              companyId,
              company_id: companyId,
              cliente_id: envolvidoId || 'consumidor_avulso',
              clienteId: envolvidoId || 'consumidor_avulso',
              cliente_nome: envolvidoNome,
              clienteNome: envolvidoNome,
              cheque_origem_id: protocolo,
              chequeOrigemId: protocolo,
              valor_credito: valorCreditoOuEstorno,
              valorCredito: valorCreditoOuEstorno,
              status: 'DISPONIVEL',
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            };
            const creditosAtuais = getStoredClienteCreditos();
            saveStoredClienteCreditos([novoCredito, ...creditosAtuais]);

            // Atualiza saldo de crédito na ficha do cliente cadastrado
            if (envolvidoId && envolvidoId !== 'consumidor_avulso') {
              const allClients = clientsList.length > 0 ? clientsList : getStoredClients();
              const nextClients = allClients.map((c) => {
                if (String(c.id) !== String(envolvidoId)) return c;
                const prevBal = Number(c.creditBalance ?? c.saldoCredito ?? 0);
                const nextBal = Number((prevBal + valorCreditoOuEstorno).toFixed(2));
                const prevHistory = Array.isArray(c.creditHistory) ? c.creditHistory : [];
                return {
                  ...c,
                  creditBalance: nextBal,
                  saldoCredito: nextBal,
                  creditHistory: [
                    {
                      date: dataOperacao,
                      amount: valorCreditoOuEstorno,
                      description: `Vale-Troca ${protocolo} (${motivo})`,
                      invoiceNumber: numeroOrigem || protocolo,
                    },
                    ...prevHistory,
                  ],
                  updatedAt: now.toISOString(),
                };
              });
              saveStoredClients(nextClients);
              onSaveClients?.(nextClients);
            }
          } else {
            // Estorno em Dinheiro ou PIX -> Lança Despesa Paga + Sangria se dinheiro com caixa aberto
            destinoFinanceiro = formaEstorno === 'PIX' ? 'estorno_pix' : 'estorno_dinheiro';
            destinoFinanceiroLabel = `Estorno ${formaEstorno} (${formatCurrencyBRL(
              valorCreditoOuEstorno
            )})`;
            formaEstornoFinal = formaEstorno;

            const novaDespesa: Expense = {
              id: `exp_dev_${Date.now()}`,
              companyId,
              description: `Estorno Devolução ${protocolo} - ${envolvidoNome}`,
              amount: valorCreditoOuEstorno,
              categoryId: 'estornos_devolucoes',
              categoryName: 'Estornos e Devoluções',
              categoryColor: '#f59e0b',
              dueDate: dataOperacao,
              paymentDate: dataOperacao,
              status: 'pago',
              paymentMethod: formaEstorno === 'PIX' ? 'pix' : 'dinheiro',
              supplier: envolvidoNome,
              invoiceNumber: protocolo,
              notes: `Operação ${protocolo} (${motivo})${
                numeroOrigem ? ` • Origem: ${numeroOrigem}` : ''
              }`,
              competenceMonth: dataOperacao.slice(0, 7),
              createdAt: now.toISOString(),
            };
            const currentExpenses = getStoredExpenses();
            saveStoredExpenses([novaDespesa, ...currentExpenses]);

            if (formaEstorno === 'DINHEIRO' && isCaixaAbertoHojeParaOperador().aberto) {
              adicionarSangriaCaixa(
                valorCreditoOuEstorno,
                `ESTORNO DEVOLUÇÃO ${protocolo}`,
                envolvidoNome
              );
            }
          }
        }
      }

      const itensParaFilaFiscal = itensDevolvidos.filter(
        (item) => isFornecedor || item.returnToStock === false
      );

      // 3. SALVAR PROTOCOLO NO HISTÓRICO UNIFICADO DE TROCAS E DEVOLUÇÕES
      const newRecord: TrocaDevolucaoRecord = {
        id: `troca_${Date.now()}`,
        companyId,
        protocolo,
        data: dataOperacao,
        tipoOperacao,
        envolvidoTipo: isFornecedor ? 'fornecedor' : 'cliente',
        envolvidoId,
        envolvidoNome,
        envolvidoDocumento,
        envolvidoTelefone,
        numeroVendaOuNotaOrigem: numeroOrigem.trim() || undefined,
        motivo,
        observacoes: observacoes.trim() || undefined,
        itensDevolvidos,
        itensLevados: tipoOperacao === 'troca_direta' ? itensLevados : [],
        totalDevolvido,
        totalLevado,
        saldoFinal,
        destinoFinanceiro,
        destinoFinanceiroLabel,
        formaPagamentoDiferenca: formaPagDif,
        formaEstorno: formaEstornoFinal,
        valeCreditoId,
        valeCreditoValor,
        boletoAbatido: boletoAbatidoInfo,
        fiscalStatus:
          itensParaFilaFiscal.length > 0 ? 'Aguardando Decisão Fiscal' : undefined,
        operador: getOperadorLogadoNome(),
        createdAt: now.toISOString(),
      };

      saveStoredTrocasDevolucoes([newRecord, ...existingTrocas]);

      // 4. SINCRONIZAÇÃO LEGADA COM FILA DE PENDÊNCIAS DE DEVOLUÇÃO / GARANTIA
      if (itensParaFilaFiscal.length > 0) {
        const pendenciasToQueue: PendenciaDevolucaoRecord[] = itensParaFilaFiscal.map(
          (item, idx) => ({
            id: `pend_dev_${now.getTime()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            companyId,
            trocaRecordId: newRecord.id,
            protocolo,
            data: dataOperacao,
            origemTipo: isFornecedor
              ? 'devolucao_fornecedor'
              : 'devolucao_cliente_defeito',
            fornecedorId: isFornecedor ? envolvidoId : undefined,
            fornecedorNome: isFornecedor
              ? envolvidoNome
              : 'A Definir (Devolução Balcão - Defeito)',
            fornecedorCnpj: isFornecedor ? envolvidoDocumento || undefined : undefined,
            clienteNome: !isFornecedor ? envolvidoNome : undefined,
            numeroNotaOuVendaOrigem: numeroOrigem.trim() || undefined,
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            unit: item.unit || 'UN',
            quantidade: Number(item.quantity || 0),
            valorUnitario: Number(item.unitPrice || 0),
            valorTotal: Number(item.totalPrice || 0),
            motivo: String(motivo || 'Defeito'),
            observacoes: observacoes.trim() || undefined,
            boletoAbatido: boletoAbatidoInfo,
            status: 'Aguardando Decisão Fiscal',
            createdAt: now.toISOString(),
          })
        );
        addPendenciasDevolucao(pendenciasToQueue);
      }

      onSuccess(newRecord, autoPrintA4);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar troca/devolução:', err);
      setErrorMsg('Ocorreu um erro ao processar a operação. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const nextProtoPreview = getNextTrocaProtocolo();
  const creditOrRefundAmount =
    tipoOperacao === 'troca_direta' ? Math.max(0, -saldoFinal) : totalDevolvido;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-[#cad4e6] border border-black rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[94vh] text-slate-900">
        {/* CABEÇALHO OFICIAL (#cad4e6 + border-black) */}
        <div className="bg-[#cad4e6] border-b border-black px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/80 border border-black rounded">
              <ArrowLeftRight className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-tight">
                NOVA TROCA / DEVOLUÇÃO DE PRODUTOS
              </h2>
              <p className="text-[11px] font-semibold text-slate-700">
                Protocolo Previsto: <span className="font-mono font-bold text-black">{nextProtoPreview}</span> • Integração Automática com Estoque, Financeiro e Vale-Crédito
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded bg-white/80 hover:bg-white border border-black text-slate-900 cursor-pointer transition"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CORPO COM SCROLL */}
        <form onSubmit={handleConfirmSave} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#cad4e6]">
          {errorMsg && (
            <div className="bg-rose-100 border border-rose-700 text-rose-950 px-3 py-2 rounded text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CARD 1 — TIPO DE OPERAÇÃO E ENVOLVIDO */}
          <section className="bg-[#e0e6f1] border border-black rounded-md p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-black/25 pb-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                1. Tipo de Operação e Envolvido
              </h3>
              <span className="text-[10px] font-bold uppercase text-slate-700">
                Dados Principais & Origem
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Tipo de Operação *
                </label>
                <select
                  value={tipoOperacao}
                  onChange={(e) => {
                    const nextTipo = e.target.value as TrocaOperacaoTipo;
                    const wasFornecedor = tipoOperacao === 'devolucao_fornecedor';
                    const isNextFornecedor = nextTipo === 'devolucao_fornecedor';
                    setTipoOperacao(nextTipo);
                    if (isNextFornecedor) {
                      setRetornarAoEstoque(true);
                    }
                    if (wasFornecedor !== isNextFornecedor) {
                      setSelectedSupplierId('');
                      setSelectedClientId('');
                      setEnvolvidoSearch('');
                      setIsEnvolvidoDropdownOpen(false);
                      setNumeroOrigem('');
                      setSelectedOriginDocId('');
                      setIsOriginDropdownOpen(false);
                      setSelectedProdDevolvidoId('');
                      setSearchDevolvido('');
                      setPrecoDevolvido('');
                    }
                  }}
                  className="w-full bg-white border border-gray-400 text-black text-xs font-bold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  <option value="devolucao_cliente">
                    Devolução de Cliente (Gera Crédito / Vale-Troca ou Estorno)
                  </option>
                  <option value="troca_direta">
                    Troca Direta por Outro Produto (Cliente)
                  </option>
                  <option value="devolucao_fornecedor">
                    Devolução para Fornecedor (Peça com Defeito / Garantia)
                  </option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Data da Operação *
                </label>
                <input
                  type="date"
                  value={dataOperacao}
                  onChange={(e) => setDataOperacao(e.target.value)}
                  required
                  className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Motivo *
                </label>
                <div className="flex items-center gap-1">
                  <select
                    value={motivo}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__manage__') {
                        setIsMotivoManagerOpen(true);
                      } else {
                        setMotivo(val);
                      }
                    }}
                    className="flex-1 min-w-0 bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600 cursor-pointer"
                  >
                    {!motivosList.includes(motivo) && motivo && (
                      <option value={motivo}>{motivo}</option>
                    )}
                    {motivosList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__manage__" className="text-sky-700 font-bold">
                      ⚙️ Gerenciar motivos...
                    </option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsMotivoManagerOpen(true)}
                    className="h-[30px] w-[30px] flex items-center justify-center bg-white hover:bg-gray-100 text-black border border-gray-400 rounded transition cursor-pointer shrink-0"
                    title="Gerenciar motivos personalizados"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* CAMPO BUSCA DIGITÁVEL: FORNECEDOR * OU CLIENTE * (INICIANDO EM BRANCO) */}
              {tipoOperacao === 'devolucao_fornecedor' ? (
                <div ref={envolvidoBoxRef} className="sm:col-span-5 relative">
                  <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                    Fornecedor *
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
                    <input
                      type="text"
                      value={envolvidoSearch}
                      onFocus={() => setIsEnvolvidoDropdownOpen(true)}
                      onChange={(e) => {
                        setEnvolvidoSearch(e.target.value);
                        if (selectedSupplierId) {
                          setSelectedSupplierId('');
                          setNumeroOrigem('');
                          setSelectedOriginDocId('');
                        }
                        setIsEnvolvidoDropdownOpen(true);
                      }}
                      placeholder="Digite parte do nome, CPF ou CNPJ para buscar..."
                      className={`w-full pl-8 pr-12 py-1.5 bg-white border text-black text-xs font-semibold rounded focus:outline-none focus:ring-2 focus:ring-slate-600 ${
                        selectedSupplierId ? 'border-emerald-700' : 'border-gray-400'
                      }`}
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      {(envolvidoSearch || selectedSupplierId) && (
                        <button
                          type="button"
                          onClick={() => {
                            setEnvolvidoSearch('');
                            setSelectedSupplierId('');
                            setNumeroOrigem('');
                            setSelectedOriginDocId('');
                            setIsEnvolvidoDropdownOpen(true);
                          }}
                          className="p-0.5 text-slate-500 hover:text-rose-700 rounded cursor-pointer"
                          title="Limpar fornecedor"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsEnvolvidoDropdownOpen((prev) => !prev)}
                        className="p-0.5 text-slate-600 hover:text-black rounded cursor-pointer"
                        title="Abrir lista de fornecedores"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isEnvolvidoDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-black rounded-md shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-gray-200">
                      {filteredSuppliersDropdown.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs font-semibold text-slate-600">
                          Nenhum fornecedor encontrado para "{envolvidoSearch}".
                        </div>
                      ) : (
                        filteredSuppliersDropdown.map((sup) => {
                          const displayName = sup.tradeName || sup.name;
                          const isSelected = String(sup.id) === String(selectedSupplierId);
                          return (
                            <button
                              key={sup.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSelectedSupplierId(String(sup.id));
                                setEnvolvidoSearch(displayName);
                                setIsEnvolvidoDropdownOpen(false);
                                setNumeroOrigem('');
                                setSelectedOriginDocId('');
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-sky-50 flex items-center justify-between gap-2 cursor-pointer ${
                                isSelected ? 'bg-emerald-50 font-bold text-emerald-950' : 'text-black'
                              }`}
                            >
                              <div className="min-w-0 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <div className="truncate">
                                  <span className="font-bold uppercase">{displayName}</span>
                                  {sup.tradeName && sup.name && sup.tradeName !== sup.name && (
                                    <span className="block text-[10px] text-slate-500 truncate">
                                      {sup.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {sup.cnpjOrCpf && (
                                <span className="text-[10px] font-mono font-semibold text-slate-600 shrink-0">
                                  {sup.cnpjOrCpf}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div
                    ref={envolvidoBoxRef}
                    className={`${
                      selectedClientId === 'consumidor_avulso' ? 'sm:col-span-3' : 'sm:col-span-5'
                    } relative`}
                  >
                    <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                      Cliente *
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
                      <input
                        type="text"
                        value={envolvidoSearch}
                        onFocus={() => setIsEnvolvidoDropdownOpen(true)}
                        onChange={(e) => {
                          setEnvolvidoSearch(e.target.value);
                          if (selectedClientId) {
                            setSelectedClientId('');
                            setNumeroOrigem('');
                            setSelectedOriginDocId('');
                          }
                          setIsEnvolvidoDropdownOpen(true);
                        }}
                        placeholder="Digite parte do nome, CPF ou CNPJ para buscar..."
                        className={`w-full pl-8 pr-12 py-1.5 bg-white border text-black text-xs font-semibold rounded focus:outline-none focus:ring-2 focus:ring-slate-600 ${
                          selectedClientId ? 'border-emerald-700' : 'border-gray-400'
                        }`}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {(envolvidoSearch || selectedClientId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEnvolvidoSearch('');
                              setSelectedClientId('');
                              setNumeroOrigem('');
                              setSelectedOriginDocId('');
                              setIsEnvolvidoDropdownOpen(true);
                            }}
                            className="p-0.5 text-slate-500 hover:text-rose-700 rounded cursor-pointer"
                            title="Limpar cliente"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsEnvolvidoDropdownOpen((prev) => !prev)}
                          className="p-0.5 text-slate-600 hover:text-black rounded cursor-pointer"
                          title="Abrir lista de clientes"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isEnvolvidoDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-black rounded-md shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-gray-200">
                        {showAvulsoOption && (
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSelectedClientId('consumidor_avulso');
                              setEnvolvidoSearch('Consumidor Avulso (Balcão)');
                              setIsEnvolvidoDropdownOpen(false);
                              setNumeroOrigem('');
                              setSelectedOriginDocId('');
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 flex items-center justify-between gap-2 cursor-pointer ${
                              selectedClientId === 'consumidor_avulso'
                                ? 'bg-amber-50 font-bold text-amber-950'
                                : 'text-slate-900 font-bold bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>Consumidor Avulso (Balcão)</span>
                            </span>
                            <span className="text-[10px] font-bold uppercase text-amber-800">
                              Balcão
                            </span>
                          </button>
                        )}
                        {filteredClientsDropdown.length === 0 ? (
                          !showAvulsoOption && (
                            <div className="px-3 py-2.5 text-xs font-semibold text-slate-600">
                              Nenhum cliente encontrado para "{envolvidoSearch}".
                            </div>
                          )
                        ) : (
                          filteredClientsDropdown.map((cli) => {
                            const displayName = cli.name || cli.nome || 'Cliente';
                            const farm = cli.farmName || cli.fazenda;
                            const isSelected = String(cli.id) === String(selectedClientId);
                            return (
                              <button
                                key={cli.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSelectedClientId(String(cli.id));
                                  setEnvolvidoSearch(
                                    farm ? `${displayName} — ${farm}` : displayName
                                  );
                                  setIsEnvolvidoDropdownOpen(false);
                                  setNumeroOrigem('');
                                  setSelectedOriginDocId('');
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-sky-50 flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected ? 'bg-emerald-50 font-bold text-emerald-950' : 'text-black'
                                }`}
                              >
                                <div className="min-w-0 flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <div className="truncate">
                                    <span className="font-bold uppercase">{displayName}</span>
                                    {farm && (
                                      <span className="block text-[10px] text-slate-500 truncate">
                                        {farm}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {cli.cpfCnpj && (
                                  <span className="text-[10px] font-mono font-semibold text-slate-600 shrink-0">
                                    {cli.cpfCnpj}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {selectedClientId === 'consumidor_avulso' && (
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                        Nome no Balcão
                      </label>
                      <input
                        type="text"
                        value={avulsoNome}
                        onChange={(e) => setAvulsoNome(e.target.value)}
                        placeholder="Consumidor Avulso"
                        className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                      />
                    </div>
                  )}
                </>
              )}

              {/* CAMPO INTELIGENTE: Nº VENDA / NOTA DE ORIGEM COM AUTOCOMPLETAR */}
              <div ref={originBoxRef} className="sm:col-span-4 relative">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-900 truncate">
                    Nº Venda / Nota de Origem (Opcional)
                  </label>
                  {relatedOriginDocs.length > 0 && (
                    <span className="text-[9.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-400 px-1.5 rounded shrink-0">
                      {relatedOriginDocs.length}{' '}
                      {tipoOperacao === 'devolucao_fornecedor'
                        ? relatedOriginDocs.length === 1
                          ? 'NF'
                          : 'NFs'
                        : relatedOriginDocs.length === 1
                          ? 'venda'
                          : 'vendas'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
                  <input
                    type="text"
                    value={numeroOrigem}
                    onFocus={() => {
                      if (relatedOriginDocs.length > 0) setIsOriginDropdownOpen(true);
                    }}
                    onChange={(e) => {
                      setNumeroOrigem(e.target.value);
                      setSelectedOriginDocId('');
                      if (relatedOriginDocs.length > 0) setIsOriginDropdownOpen(true);
                    }}
                    placeholder={
                      relatedOriginDocs.length > 0
                        ? 'Selecione da lista ou digite manualmente...'
                        : 'Ex: PDV-012 ou NF 4520'
                    }
                    className={`w-full pl-8 pr-11 py-1.5 bg-white border text-black text-xs font-semibold rounded focus:outline-none focus:ring-2 focus:ring-slate-600 ${
                      activeOriginDoc ? 'border-emerald-700' : 'border-gray-400'
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {numeroOrigem && (
                      <button
                        type="button"
                        onClick={() => {
                          setNumeroOrigem('');
                          setSelectedOriginDocId('');
                        }}
                        className="p-0.5 text-slate-500 hover:text-rose-700 rounded cursor-pointer"
                        title="Limpar nota/venda de origem"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {relatedOriginDocs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsOriginDropdownOpen((prev) => !prev)}
                        className="p-0.5 text-slate-600 hover:text-black rounded cursor-pointer"
                        title="Listar notas/vendas vinculadas"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isOriginDropdownOpen && relatedOriginDocs.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-black rounded-md shadow-xl max-h-52 overflow-y-auto z-50 divide-y divide-gray-200">
                    <div className="px-2.5 py-1 bg-slate-100 text-[10px] font-black uppercase text-slate-700 sticky top-0 border-b border-gray-300">
                      {tipoOperacao === 'devolucao_fornecedor'
                        ? 'Notas Fiscais de Entrada deste Fornecedor'
                        : 'Vendas / Pedidos deste Cliente'}
                    </div>
                    {filteredOriginDocsDropdown.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] font-semibold text-slate-600">
                        Nenhuma nota/venda correspondente — o texto digitado será mantido manualmente.
                      </div>
                    ) : (
                      filteredOriginDocsDropdown.map((docOpt) => {
                        const isSel = activeOriginDoc?.id === docOpt.id;
                        return (
                          <button
                            key={docOpt.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setNumeroOrigem(docOpt.value);
                              setSelectedOriginDocId(docOpt.id);
                              setIsOriginDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-sky-50 flex items-center justify-between gap-2 cursor-pointer ${
                              isSel ? 'bg-emerald-50 font-bold text-emerald-950' : 'text-black'
                            }`}
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-bold">{docOpt.label}</span>
                              {docOpt.items.length > 0 && (
                                <span className="block text-[10px] text-emerald-700 font-semibold">
                                  {docOpt.items.length} produto(s) vinculado(s) para filtro rápido
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-gray-300 text-slate-700 shrink-0">
                              {docOpt.sourceLabel}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Detalhes do defeito, embalagem ou acordo..."
                  className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
            </div>
          </section>

          {/* CARD 2 — PRODUTOS DEVOLVIDOS */}
          <section className="bg-[#e0e6f1] border border-black rounded-md p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/25 pb-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                2. Produtos Devolvidos ({itensDevolvidos.length})
              </h3>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 cursor-pointer bg-white/80 border border-black/40 rounded px-2 py-0.5">
                <input
                  type="checkbox"
                  checked={retornarAoEstoque}
                  onChange={(e) => setRetornarAoEstoque(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
                />
                <span>
                  {tipoOperacao === 'devolucao_fornecedor'
                    ? 'Baixar item do saldo disponível do Estoque? (Saída p/ Fornecedor)'
                    : 'Retornar item ao saldo disponível do Estoque?'}
                </span>
              </label>
            </div>

            {(tipoOperacao === 'devolucao_fornecedor' ||
              !retornarAoEstoque ||
              itensDevolvidos.some((i) => i.returnToStock === false)) && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-500 text-amber-950 px-2.5 py-1.5 rounded text-[11px] font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  Quarentena Fiscal: Nenhuma NF-e será emitida agora. O item será enviado para{' '}
                  <strong>Fiscal &amp; Notas → Devoluções &amp; Garantias</strong> (status: Aguardando Decisão Fiscal).
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              {/* CAMPO UNIFICADO INTELIGENTE: PRODUTO DEVOLVIDO * */}
              <div ref={prodDevolvidoBoxRef} className="sm:col-span-7 relative">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-900">
                    Produto Devolvido *
                  </label>
                  {activeOriginDoc && groupedDevolvidoOptions.noteItems.length > 0 ? (
                    <span className="text-[9.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-400 px-1.5 rounded">
                      Priorizando {groupedDevolvidoOptions.noteItems.length} item(ns) da{' '}
                      {activeOriginDoc.value}
                    </span>
                  ) : tipoOperacao === 'devolucao_fornecedor' &&
                    groupedDevolvidoOptions.supplierItems.length > 0 ? (
                    <span className="text-[9.5px] font-black text-sky-800 bg-sky-100 border border-sky-400 px-1.5 rounded">
                      Priorizando {groupedDevolvidoOptions.supplierItems.length} item(ns) do fornecedor
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchDevolvido}
                    onFocus={() => setIsProdDevolvidoDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchDevolvido(e.target.value);
                      if (selectedProdDevolvidoId) setSelectedProdDevolvidoId('');
                      setIsProdDevolvidoDropdownOpen(true);
                    }}
                    placeholder="Digite nome, código, código de barras ou selecione..."
                    className={`w-full pl-8 pr-12 py-1.5 bg-white border text-black text-xs font-semibold rounded focus:outline-none focus:ring-2 focus:ring-slate-600 ${
                      selectedProdDevolvidoId ? 'border-emerald-700' : 'border-gray-400'
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {(searchDevolvido || selectedProdDevolvidoId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchDevolvido('');
                          setSelectedProdDevolvidoId('');
                          setPrecoDevolvido('');
                          setIsProdDevolvidoDropdownOpen(true);
                        }}
                        className="p-0.5 text-slate-500 hover:text-rose-700 rounded cursor-pointer"
                        title="Limpar produto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsProdDevolvidoDropdownOpen((prev) => !prev)}
                      className="p-0.5 text-slate-600 hover:text-black rounded cursor-pointer"
                      title="Abrir lista de produtos"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isProdDevolvidoDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-black rounded-md shadow-xl max-h-64 overflow-y-auto z-50 divide-y divide-gray-200">
                    {groupedDevolvidoOptions.noteItems.length === 0 &&
                    groupedDevolvidoOptions.supplierItems.length === 0 &&
                    groupedDevolvidoOptions.generalItems.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs font-semibold text-slate-600">
                        Nenhum produto encontrado no estoque para "{searchDevolvido}".
                      </div>
                    ) : (
                      <>
                        {groupedDevolvidoOptions.noteItems.length > 0 && (
                          <div>
                            <div className="px-2.5 py-1 bg-emerald-100 text-[10px] font-black uppercase text-emerald-950 border-b border-emerald-300 sticky top-0">
                              📄 Itens da Nota / Venda ({activeOriginDoc?.value})
                            </div>
                            {groupedDevolvidoOptions.noteItems.map(({ item, originUnitPrice }) => {
                              const isSel = String(item.id) === String(selectedProdDevolvidoId);
                              return (
                                <button
                                  key={`note_${item.id}`}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectProdDevolvido(item.id, originUnitPrice);
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 flex items-center justify-between gap-2 cursor-pointer border-b border-gray-100 ${
                                    isSel ? 'bg-emerald-100 font-bold' : 'bg-emerald-50/30'
                                  }`}
                                >
                                  <span className="truncate font-bold text-black">
                                    {getItemCode(item) ? `[${getItemCode(item)}] ` : ''}
                                    {getItemDisplayName(item)}
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-900 shrink-0">
                                    Saldo: {getItemStockQty(item)}{' '}
                                    {item.unit || item.unidade_medida || 'UN'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {groupedDevolvidoOptions.supplierItems.length > 0 && (
                          <div>
                            <div className="px-2.5 py-1 bg-sky-100 text-[10px] font-black uppercase text-sky-950 border-b border-sky-300 sticky top-0">
                              🏭 Produtos deste Fornecedor
                            </div>
                            {groupedDevolvidoOptions.supplierItems.map((item) => {
                              const isSel = String(item.id) === String(selectedProdDevolvidoId);
                              return (
                                <button
                                  key={`sup_${item.id}`}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectProdDevolvido(item.id);
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-sky-50 flex items-center justify-between gap-2 cursor-pointer border-b border-gray-100 ${
                                    isSel ? 'bg-sky-100 font-bold' : 'bg-sky-50/30'
                                  }`}
                                >
                                  <span className="truncate font-bold text-black">
                                    {getItemCode(item) ? `[${getItemCode(item)}] ` : ''}
                                    {getItemDisplayName(item)}
                                  </span>
                                  <span className="text-[10px] font-bold text-sky-900 shrink-0">
                                    Saldo: {getItemStockQty(item)}{' '}
                                    {item.unit || item.unidade_medida || 'UN'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {groupedDevolvidoOptions.generalItems.length > 0 && (
                          <div>
                            {(groupedDevolvidoOptions.noteItems.length > 0 ||
                              groupedDevolvidoOptions.supplierItems.length > 0) && (
                              <div className="px-2.5 py-1 bg-slate-100 text-[10px] font-black uppercase text-slate-700 border-b border-gray-300 sticky top-0">
                                📦 Demais Produtos do Estoque
                              </div>
                            )}
                            {groupedDevolvidoOptions.generalItems.map((item) => {
                              const isSel = String(item.id) === String(selectedProdDevolvidoId);
                              return (
                                <button
                                  key={`gen_${item.id}`}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectProdDevolvido(item.id);
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 flex items-center justify-between gap-2 cursor-pointer border-b border-gray-100 ${
                                    isSel ? 'bg-emerald-50 font-bold text-emerald-950' : 'text-black'
                                  }`}
                                >
                                  <span className="truncate font-semibold">
                                    {getItemCode(item) ? `[${getItemCode(item)}] ` : ''}
                                    {getItemDisplayName(item)}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-600 shrink-0">
                                    Saldo: {getItemStockQty(item)}{' '}
                                    {item.unit || item.unidade_medida || 'UN'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Qtd.
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={qtdDevolvida}
                  onChange={(e) => setQtdDevolvida(e.target.value)}
                  className="w-full bg-white border border-gray-400 text-black text-xs font-bold rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Valor Unit. (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precoDevolvido}
                  onChange={(e) => setPrecoDevolvido(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-white border border-gray-400 text-black text-xs font-bold rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddItemDevolvido}
                  className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded border border-black cursor-pointer transition"
                  title="Adicionar item devolvido"
                >
                  <Plus className="w-4 h-4" />
                  <span className="sm:hidden">Adicionar</span>
                </button>
              </div>
            </div>

            {itensDevolvidos.length > 0 && (
              <div className="bg-white border border-gray-400 rounded overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-gray-400 text-[10px] font-bold uppercase text-slate-800">
                      <th className="px-2.5 py-1.5">Produto</th>
                      <th className="px-2.5 py-1.5 text-center">Qtd.</th>
                      <th className="px-2.5 py-1.5 text-right">Unitário</th>
                      <th className="px-2.5 py-1.5 text-right">Subtotal</th>
                      <th className="px-2.5 py-1.5 text-center">Destino Estoque</th>
                      <th className="px-2 py-1.5 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {itensDevolvidos.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1.5 font-bold text-black">
                          {item.productCode ? `[${item.productCode}] ` : ''}
                          {item.productName}
                        </td>
                        <td className="px-2.5 py-1.5 text-center font-semibold">
                          {item.quantity} {item.unit || 'UN'}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          {formatCurrencyBRL(item.unitPrice)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-black text-black">
                          {formatCurrencyBRL(item.totalPrice)}
                        </td>
                        <td className="px-2.5 py-1.5 text-center">
                          {item.returnToStock !== false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-400 text-[10px] font-bold">
                              <PackageCheck className="w-3 h-3" />
                              {tipoOperacao === 'devolucao_fornecedor'
                                ? 'Baixar Estoque'
                                : 'Retorna ao Estoque'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-400 text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              Avaria / Sem Alterar Saldo
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setItensDevolvidos((prev) => prev.filter((i) => i.id !== item.id))
                            }
                            className="p-1 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            title="Remover item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* CARD 3 — PRODUTOS LEVADOS NA TROCA (TROCA DIRETA) & RESUMO FINANCEIRO */}
          <section className="bg-[#e0e6f1] border border-black rounded-md p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-black/25 pb-1.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                {tipoOperacao === 'troca_direta'
                  ? `3. Produtos Levados na Troca (${itensLevados.length}) & Fechamento Financeiro`
                  : '3. Resumo Financeiro e Destino do Valor'}
              </h3>
              <span className="text-xs font-black text-slate-900">
                Total Devolvido: {formatCurrencyBRL(totalDevolvido)}
              </span>
            </div>

            {tipoOperacao === 'troca_direta' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div ref={prodLevadoBoxRef} className="sm:col-span-7 relative">
                    <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                      Produto Levado pelo Cliente *
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchLevado}
                        onFocus={() => setIsProdLevadoDropdownOpen(true)}
                        onChange={(e) => {
                          setSearchLevado(e.target.value);
                          if (selectedProdLevadoId) setSelectedProdLevadoId('');
                          setIsProdLevadoDropdownOpen(true);
                        }}
                        placeholder="Digite nome, código, código de barras ou selecione..."
                        className={`w-full pl-8 pr-12 py-1.5 bg-white border text-black text-xs font-semibold rounded focus:outline-none focus:ring-2 focus:ring-slate-600 ${
                          selectedProdLevadoId ? 'border-sky-700' : 'border-gray-400'
                        }`}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {(searchLevado || selectedProdLevadoId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchLevado('');
                              setSelectedProdLevadoId('');
                              setPrecoLevado('');
                              setIsProdLevadoDropdownOpen(true);
                            }}
                            className="p-0.5 text-slate-500 hover:text-rose-700 rounded cursor-pointer"
                            title="Limpar produto"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsProdLevadoDropdownOpen((prev) => !prev)}
                          className="p-0.5 text-slate-600 hover:text-black rounded cursor-pointer"
                          title="Abrir lista de produtos"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isProdLevadoDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-black rounded-md shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-gray-200">
                        {filteredLevadoOptions.length === 0 ? (
                          <div className="px-3 py-2.5 text-xs font-semibold text-slate-600">
                            Nenhum produto encontrado para "{searchLevado}".
                          </div>
                        ) : (
                          filteredLevadoOptions.map((item) => {
                            const isSel = String(item.id) === String(selectedProdLevadoId);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectProdLevado(item.id);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-sky-50 flex items-center justify-between gap-2 cursor-pointer ${
                                  isSel ? 'bg-sky-100 font-bold text-sky-950' : 'text-black'
                                }`}
                              >
                                <span className="truncate font-semibold">
                                  {getItemCode(item) ? `[${getItemCode(item)}] ` : ''}
                                  {getItemDisplayName(item)}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-600 shrink-0">
                                  Saldo: {getItemStockQty(item)}{' '}
                                  {item.unit || item.unidade_medida || 'UN'}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                      Qtd.
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={qtdLevada}
                      onChange={(e) => setQtdLevada(e.target.value)}
                      className="w-full bg-white border border-gray-400 text-black text-xs font-bold rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                      Valor Unit. (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precoLevado}
                      onChange={(e) => setPrecoLevado(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-white border border-gray-400 text-black text-xs font-bold rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddItemLevado}
                      className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded border border-black cursor-pointer transition"
                      title="Adicionar produto levado na troca"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="sm:hidden">Adicionar</span>
                    </button>
                  </div>
                </div>

                {itensLevados.length > 0 && (
                  <div className="bg-white border border-gray-400 rounded overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-gray-400 text-[10px] font-bold uppercase text-slate-800">
                          <th className="px-2.5 py-1.5">Produto Levado</th>
                          <th className="px-2.5 py-1.5 text-center">Qtd.</th>
                          <th className="px-2.5 py-1.5 text-right">Unitário</th>
                          <th className="px-2.5 py-1.5 text-right">Subtotal</th>
                          <th className="px-2.5 py-1.5 text-center">Estoque</th>
                          <th className="px-2 py-1.5 text-right w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {itensLevados.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-2.5 py-1.5 font-bold text-black">
                              {item.productCode ? `[${item.productCode}] ` : ''}
                              {item.productName}
                            </td>
                            <td className="px-2.5 py-1.5 text-center font-semibold">
                              {item.quantity} {item.unit || 'UN'}
                            </td>
                            <td className="px-2.5 py-1.5 text-right">
                              {formatCurrencyBRL(item.unitPrice)}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-black text-black">
                              {formatCurrencyBRL(item.totalPrice)}
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-400 text-[10px] font-bold">
                                Baixa Automática
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setItensLevados((prev) => prev.filter((i) => i.id !== item.id))
                                }
                                className="p-1 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                                title="Remover item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* BLOCO DE APURAÇÃO AUTOMÁTICA DE SALDO & DESTINO FINANCEIRO */}
            <div className="bg-white border border-black rounded p-3 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-100 border border-gray-300 rounded px-3 py-1.5">
                  <span className="block text-[10px] font-bold uppercase text-slate-600">
                    Total Devolvido
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {formatCurrencyBRL(totalDevolvido)}
                  </span>
                </div>
                {tipoOperacao === 'troca_direta' && (
                  <div className="bg-slate-100 border border-gray-300 rounded px-3 py-1.5">
                    <span className="block text-[10px] font-bold uppercase text-slate-600">
                      Total Levado na Troca
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {formatCurrencyBRL(totalLevado)}
                    </span>
                  </div>
                )}
                <div
                  className={`border rounded px-3 py-1.5 ${
                    tipoOperacao === 'troca_direta' && saldoFinal > 0.005
                      ? 'bg-sky-50 border-sky-500'
                      : 'bg-emerald-50 border-emerald-500'
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase text-slate-700">
                    {tipoOperacao === 'troca_direta'
                      ? saldoFinal > 0.005
                        ? 'Diferença a Receber do Cliente'
                        : saldoFinal < -0.005
                          ? 'Saldo / Crédito do Cliente'
                          : 'Saldo Final'
                      : tipoOperacao === 'devolucao_fornecedor'
                        ? 'Valor em Devolução ao Fornecedor'
                        : 'Valor a Creditar / Estornar'}
                  </span>
                  <span className="text-sm font-black text-slate-900">
                    {formatCurrencyBRL(
                      tipoOperacao === 'troca_direta' ? Math.abs(saldoFinal) : totalDevolvido
                    )}
                  </span>
                </div>
              </div>

              {/* OPÇÕES FINANCEIRAS CONFORME CENÁRIO */}
              {tipoOperacao === 'devolucao_fornecedor' && selectedSupplierId ? (
                <div className="space-y-2.5 bg-slate-50 border border-slate-300 rounded p-2.5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-900 mb-1.5">
                      DESTINO DO CRÉDITO COM FORNECEDOR
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`flex items-center gap-2 p-2 rounded border text-xs font-bold cursor-pointer transition ${
                          destinoFornecedor === 'credito_fornecedor'
                            ? 'bg-emerald-50 border-emerald-700 text-emerald-950'
                            : 'bg-white border-gray-300 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="destinoFornecedor"
                          checked={destinoFornecedor === 'credito_fornecedor'}
                          onChange={() => setDestinoFornecedor('credito_fornecedor')}
                          className="accent-emerald-600 shrink-0"
                        />
                        <span>Não abater agora / Aguardar Nota ou Crédito Futuro</span>
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2 rounded border text-xs font-bold cursor-pointer transition ${
                          destinoFornecedor === 'abatimento_boleto'
                            ? 'bg-sky-50 border-sky-700 text-sky-950'
                            : 'bg-white border-gray-300 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="destinoFornecedor"
                          checked={destinoFornecedor === 'abatimento_boleto'}
                          onChange={() => setDestinoFornecedor('abatimento_boleto')}
                          className="accent-sky-600 shrink-0"
                        />
                        <span>Abater valor devolvido em Boleto / Parcela Pendente deste Fornecedor</span>
                      </label>
                    </div>
                  </div>

                  {destinoFornecedor === 'abatimento_boleto' && (
                    <div className="bg-white border border-sky-400 rounded p-2.5 space-y-2">
                      {supplierPendingBills.length === 0 ? (
                        <p className="text-xs font-semibold text-slate-600 italic">
                          Nenhum boleto pendente encontrado para este fornecedor.
                        </p>
                      ) : (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                              Selecione o Boleto / Parcela em Aberto para Abatimento ({supplierPendingBills.length})
                            </label>
                            <select
                              value={selectedBoletoId}
                              onChange={(e) => setSelectedBoletoId(e.target.value)}
                              className="w-full bg-white border border-gray-400 text-black text-xs font-bold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-600"
                            >
                              {supplierPendingBills.map((bill) => {
                                const doc = getExpenseDocLabel(bill);
                                const venc =
                                  bill.dueDate || (bill as any).data_vencimento
                                    ? formatDateBR(bill.dueDate || (bill as any).data_vencimento)
                                    : 'Sem venc.';
                                const openAmt = getExpenseOpenAmount(bill);
                                return (
                                  <option key={bill.id} value={bill.id}>
                                    {doc} - Venc: {venc} - {formatCurrencyBRL(openAmt)}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {selectedBoleto && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                              <div className="bg-slate-100 border border-gray-300 rounded px-2.5 py-1.5">
                                <span className="block text-[10px] font-bold uppercase text-slate-600">
                                  Valor Atual em Aberto
                                </span>
                                <span className="font-black text-slate-900">
                                  {formatCurrencyBRL(getExpenseOpenAmount(selectedBoleto))}
                                </span>
                              </div>
                              <div className="bg-amber-50 border border-amber-300 rounded px-2.5 py-1.5">
                                <span className="block text-[10px] font-bold uppercase text-amber-800">
                                  Abatimento (Devolução)
                                </span>
                                <span className="font-black text-amber-950">
                                  - {formatCurrencyBRL(Math.min(getExpenseOpenAmount(selectedBoleto), totalDevolvido))}
                                </span>
                              </div>
                              <div className="bg-emerald-50 border border-emerald-400 rounded px-2.5 py-1.5">
                                <span className="block text-[10px] font-bold uppercase text-emerald-800">
                                  Saldo Restante no Boleto
                                </span>
                                <span className="font-black text-emerald-950">
                                  {formatCurrencyBRL(
                                    Math.max(0, getExpenseOpenAmount(selectedBoleto) - totalDevolvido)
                                  )}
                                  {getExpenseOpenAmount(selectedBoleto) - totalDevolvido <= 0.005 && (
                                    <span className="ml-1.5 text-[10px] font-black uppercase text-teal-800">
                                      (Liquidado / Abatido por Devolução)
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Opções complementares preservadas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    {[
                      {
                        id: 'diferenca_recebida',
                        label: 'Estorno Recebido em Dinheiro / PIX',
                      },
                      {
                        id: 'sem_impacto',
                        label: 'Apenas Baixa de Garantia (Sem Financeiro)',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] font-bold cursor-pointer ${
                          destinoFornecedor === opt.id
                            ? 'bg-emerald-50 border-emerald-700 text-emerald-950'
                            : 'bg-white border-gray-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="destinoFornecedor"
                          checked={destinoFornecedor === opt.id}
                          onChange={() => setDestinoFornecedor(opt.id as any)}
                          className="accent-emerald-600 shrink-0"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : tipoOperacao === 'devolucao_fornecedor' ? (
                <div className="text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2">
                  Selecione um Fornecedor no Card 1 para consultar boletos pendentes e definir o destino do crédito.
                </div>
              ) : tipoOperacao === 'troca_direta' && saldoFinal > 0.005 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center bg-sky-50 border border-sky-400 rounded p-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-950">
                    <CreditCard className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>
                      Diferença a Receber do Cliente:{' '}
                      <strong className="text-sm font-black">
                        {formatCurrencyBRL(saldoFinal)}
                      </strong>
                    </span>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                      Forma de Recebimento da Diferença
                    </label>
                    <select
                      value={formaPagamentoDiferenca}
                      onChange={(e) => setFormaPagamentoDiferenca(e.target.value)}
                      className="w-full bg-white border border-gray-400 text-black text-xs font-bold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-600"
                    >
                      <option value="DINHEIRO">Dinheiro (Lança no Caixa)</option>
                      <option value="PIX">PIX (Lança no Financeiro / Caixa)</option>
                      <option value="CARTÃO DE DÉBITO">Cartão de Débito</option>
                      <option value="CARTÃO DE CRÉDITO">Cartão de Crédito</option>
                      <option value="A PRAZO (CARTEIRA)">A Prazo / Carteira (Contas a Receber)</option>
                    </select>
                  </div>
                </div>
              ) : tipoOperacao === 'troca_direta' && Math.abs(saldoFinal) < 0.005 ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 rounded px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Troca Direta de mesmo valor ({formatCurrencyBRL(totalDevolvido)}) — Sem cobrança ou estorno financeiro adicional.
                  </span>
                </div>
              ) : creditOrRefundAmount > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <label
                    className={`sm:col-span-5 flex items-center gap-2 p-2.5 rounded border text-xs font-bold cursor-pointer ${
                      modoCreditoOuEstorno === 'vale_credito'
                        ? 'bg-emerald-50 border-emerald-700 text-emerald-950'
                        : 'bg-slate-50 border-gray-300 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modoCredito"
                      checked={modoCreditoOuEstorno === 'vale_credito'}
                      onChange={() => setModoCreditoOuEstorno('vale_credito')}
                      className="accent-emerald-600"
                    />
                    <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Gerar Vale-Crédito para Próxima Compra</span>
                  </label>

                  <label
                    className={`sm:col-span-5 flex items-center gap-2 p-2.5 rounded border text-xs font-bold cursor-pointer ${
                      modoCreditoOuEstorno === 'estorno'
                        ? 'bg-amber-50 border-amber-700 text-amber-950'
                        : 'bg-slate-50 border-gray-300 text-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modoCredito"
                      checked={modoCreditoOuEstorno === 'estorno'}
                      onChange={() => setModoCreditoOuEstorno('estorno')}
                      className="accent-amber-600"
                    />
                    <RefreshCw className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Devolver Dinheiro / PIX (Saída no Financeiro)</span>
                  </label>

                  {modoCreditoOuEstorno === 'estorno' && (
                    <div className="sm:col-span-2">
                      <select
                        value={formaEstorno}
                        onChange={(e) => setFormaEstorno(e.target.value as 'DINHEIRO' | 'PIX')}
                        className="w-full bg-white border border-gray-400 text-black text-xs font-bold rounded px-2 py-2"
                      >
                        <option value="DINHEIRO">Dinheiro</option>
                        <option value="PIX">PIX</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          {/* RODAPÉ OFICIAL (#cad4e6 + border-black) */}
          <div className="bg-[#cad4e6] border-t border-black pt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer bg-white/80 border border-black/40 rounded px-2.5 py-1.5">
              <input
                type="checkbox"
                checked={autoPrintA4}
                onChange={(e) => setAutoPrintA4(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
              />
              <Printer className="w-3.5 h-3.5 text-slate-800" />
              <span>Imprimir Comprovante A4 ao Salvar</span>
            </label>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 border border-black rounded text-xs font-bold uppercase cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white border border-emerald-900 rounded text-xs font-bold uppercase shadow-sm cursor-pointer transition"
              >
                {isSaving ? 'Processando...' : '💾 Confirmar e Salvar Operação'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Sub-modal: Gerenciador de Motivos Personalizados */}
      <CategoryOptionsManagerModal
        isOpen={isMotivoManagerOpen}
        onClose={() => setIsMotivoManagerOpen(false)}
        title="Gerenciar Motivos de Troca / Devolução"
        subtitle="Adicione, edite ou exclua motivos para o modal de Trocas & Devoluções"
        items={motivosList}
        defaultItems={DEFAULT_TROCA_MOTIVOS}
        placeholder="Ex: Divergência de quantidade, Validade próxima..."
        zIndexClass="z-[9999]"
        onSaveItems={(updated) => {
          saveStoredTrocaMotivos(updated);
          setMotivosList(updated);
          if (!updated.includes(motivo)) {
            setMotivo(updated[0] || DEFAULT_TROCA_MOTIVOS[0]);
          }
        }}
        onSelectItem={(item) => setMotivo(item)}
      />
    </div>
  );
};

interface TrocaDevolucaoDetailsModalProps {
  record: TrocaDevolucaoRecord | null;
  companyProfile?: CompanyProfile;
  onClose: () => void;
}

export const TrocaDevolucaoDetailsModal: React.FC<TrocaDevolucaoDetailsModalProps> = ({
  record,
  companyProfile,
  onClose,
}) => {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-3">
      <div className="w-full max-w-3xl bg-[#cad4e6] border border-black rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900">
        <div className="bg-[#cad4e6] border-b border-black px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-900" />
            <h2 className="text-sm font-bold text-slate-900 uppercase">
              Detalhes da Operação — {record.protocolo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded bg-white/80 hover:bg-white border border-black text-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#cad4e6]">
          <div className="bg-[#e0e6f1] border border-black rounded-md p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-600">Data</span>
              <span className="font-bold">{formatDateBR(record.data)}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-600">Tipo</span>
              <span className="font-bold">{getTipoOperacaoLabel(record.tipoOperacao)}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-600">
                {record.envolvidoTipo === 'fornecedor' ? 'Fornecedor' : 'Cliente'}
              </span>
              <span className="font-bold uppercase">{record.envolvidoNome}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-600">Motivo</span>
              <span className="font-bold">{record.motivo}</span>
            </div>
          </div>

          <div className="bg-[#e0e6f1] border border-black rounded-md p-3 space-y-2">
            <h3 className="text-xs font-black uppercase">Produtos Devolvidos</h3>
            <div className="bg-white border border-gray-400 rounded overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-gray-400 text-[10px] font-bold uppercase">
                    <th className="px-2.5 py-1.5">Produto</th>
                    <th className="px-2.5 py-1.5 text-center">Qtd.</th>
                    <th className="px-2.5 py-1.5 text-right">Unitário</th>
                    <th className="px-2.5 py-1.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {record.itensDevolvidos.map((it) => (
                    <tr key={it.id}>
                      <td className="px-2.5 py-1.5 font-bold">{it.productName}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        {it.quantity} {it.unit || 'UN'}
                      </td>
                      <td className="px-2.5 py-1.5 text-right">{formatCurrencyBRL(it.unitPrice)}</td>
                      <td className="px-2.5 py-1.5 text-right font-bold">
                        {formatCurrencyBRL(it.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {record.itensLevados && record.itensLevados.length > 0 && (
            <div className="bg-[#e0e6f1] border border-black rounded-md p-3 space-y-2">
              <h3 className="text-xs font-black uppercase">Produtos Levados na Troca</h3>
              <div className="bg-white border border-gray-400 rounded overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-gray-400 text-[10px] font-bold uppercase">
                      <th className="px-2.5 py-1.5">Produto</th>
                      <th className="px-2.5 py-1.5 text-center">Qtd.</th>
                      <th className="px-2.5 py-1.5 text-right">Unitário</th>
                      <th className="px-2.5 py-1.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {record.itensLevados.map((it) => (
                      <tr key={it.id}>
                        <td className="px-2.5 py-1.5 font-bold">{it.productName}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          {it.quantity} {it.unit || 'UN'}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">
                          {formatCurrencyBRL(it.unitPrice)}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-bold">
                          {formatCurrencyBRL(it.totalPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-[#e0e6f1] border border-black rounded-md p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-600">
                Destino Financeiro
              </span>
              <span className="font-black text-slate-900">{record.destinoFinanceiroLabel}</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-bold uppercase text-slate-600">
                Total Devolvido
              </span>
              <span className="text-sm font-black text-slate-900">
                {formatCurrencyBRL(record.totalDevolvido)}
              </span>
            </div>
          </div>

          {record.boletoAbatido && (
            <div className="bg-teal-50 border border-teal-700 rounded-md p-3 space-y-1.5 text-xs text-teal-950">
              <div className="font-black uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>Abatimento Aplicado no Contas a Pagar</span>
                <span className="px-2 py-0.5 rounded bg-teal-700 text-white text-[10px]">
                  {record.boletoAbatido.statusResultante}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-teal-800">Documento / NF</span>
                  <span className="font-bold">{record.boletoAbatido.documento || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-teal-800">Vencimento</span>
                  <span className="font-bold">
                    {record.boletoAbatido.vencimento ? formatDateBR(record.boletoAbatido.vencimento) : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-teal-800">Valor Abatido</span>
                  <span className="font-black">{formatCurrencyBRL(record.boletoAbatido.valorAbatido)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-teal-800">Saldo Restante</span>
                  <span className="font-black">{formatCurrencyBRL(record.boletoAbatido.saldoRestante)}</span>
                </div>
              </div>
            </div>
          )}

          {(record.fiscalStatus || record.notaDevolucaoNumber || record.justificativaDescarte) && (
            <div className="bg-[#e0e6f1] border border-black rounded-md p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black uppercase tracking-wider text-[11px]">
                  Situação Fiscal (Devoluções & Garantias)
                </span>
                <span className="px-2 py-0.5 rounded bg-white border border-gray-400 text-[10px] font-black">
                  {record.fiscalStatus || 'Aguardando Decisão Fiscal'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {record.notaDevolucaoNumber && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-600">
                      NF-e de Devolução
                    </span>
                    <span className="font-mono font-black">{record.notaDevolucaoNumber}</span>
                  </div>
                )}
                {record.numeroVendaOuNotaOrigem && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-600">
                      NF-e / Venda de Origem
                    </span>
                    <span className="font-mono font-bold">{record.numeroVendaOuNotaOrigem}</span>
                  </div>
                )}
                {record.notaDevolucaoChave && (
                  <div className="sm:col-span-2">
                    <span className="block text-[10px] font-bold uppercase text-slate-600">
                      Chave de Acesso
                    </span>
                    <span className="font-mono text-[11px] break-all">{record.notaDevolucaoChave}</span>
                  </div>
                )}
                {record.justificativaDescarte && (
                  <div className="sm:col-span-2">
                    <span className="block text-[10px] font-bold uppercase text-slate-600">
                      Justificativa de Descarte / Perda
                    </span>
                    <span className="font-semibold">{record.justificativaDescarte}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#cad4e6] border-t border-black px-4 py-2.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => printTrocaDevolucaoCupom80mm(record, companyProfile)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 border border-black rounded text-xs font-bold cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Cupom 80mm</span>
          </button>
          <button
            type="button"
            onClick={() => printTrocaDevolucaoA4(record, companyProfile)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-900 rounded text-xs font-bold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Comprovante A4</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 border border-black rounded text-xs font-bold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
