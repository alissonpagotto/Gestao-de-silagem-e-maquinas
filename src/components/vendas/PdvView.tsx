import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Trash2, 
  Printer, 
  Check, 
  X, 
  DollarSign, 
  CreditCard, 
  QrCode, 
  Calendar, 
  Barcode, 
  Receipt, 
  Percent, 
  ArrowRight,
  Package,
  User,
  AlertCircle,
  Clock,
  ChevronDown,
  FileCheck2,
  Tractor,
  Key,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Download,
  Copy,
  FileText,
  CheckCheck
} from 'lucide-react';
import { Client, CompanyProfile, ServiceOrder, InventoryItem } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredInventory, getActiveCompanyId, getStoredClients } from '../../lib/storage';
import { getActiveUserSession, SimulatedUserSession } from '../../lib/cadastrosBaseStorage';
import { getStoredAdminSettings } from '../../lib/masterAdminStorage';
import { useConfirm } from '../../context/ConfirmContext';

export interface PdvItem {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  percentualDesconto: number;
  valorDesconto: number;
  totalBruto: number;
  totalLiquido: number;
}

interface InstallmentRow {
  numero: number;
  vencimento: string;
  valor: number;
}

export type PriceTable = 'venda' | 'custo' | 'atacado' | 'promocional';

export interface CatalogProduct {
  id: string;
  code: string;
  barcode: string;
  name: string;
  unit: string;
  price: number;
  salePrice: number;
  unitCost: number;
  wholesalePrice?: number;
  promoPrice?: number;
  rawItem?: any;
}

export function calculatePriceByTable(
  item: {
    salePrice?: number;
    unitCost?: number;
    wholesalePrice?: number;
    promoPrice?: number;
    precoVenda?: number;
    precoCusto?: number;
    precoAtacado?: number;
    precoPromocional?: number;
    name?: string;
    nome_comercial?: string;
    price?: number;
  },
  table: PriceTable
): number {
  const nameStr = (item.name || item.nome_comercial || '').toUpperCase();
  const isDieselS10 = nameStr.includes('DIESEL S10');
  const isDieselS500 = nameStr.includes('DIESEL S500');

  let cost = Number(item.precoCusto ?? item.unitCost ?? 0);
  let sale = Number(item.precoVenda ?? item.salePrice ?? item.price ?? 0);
  let atacado = Number(item.precoAtacado ?? item.wholesalePrice ?? 0);
  let promo = Number(item.precoPromocional ?? item.promoPrice ?? 0);

  // Fallbacks para garantir que produtos com custo preenchido ou combustíveis não fiquem zerados
  if (cost <= 0) {
    if (isDieselS10) cost = 5.85;
    else if (isDieselS500) cost = 5.60;
    else if (sale > 0) cost = Math.round(sale * 0.75 * 100) / 100;
  }

  if (sale <= 0) {
    if (cost > 0) sale = cost;
    else if (isDieselS10) sale = 5.85;
    else if (isDieselS500) sale = 5.60;
  }

  switch (table) {
    case 'venda':
      return sale > 0 ? sale : cost;
    case 'custo':
      return cost > 0 ? cost : sale;
    case 'atacado':
      if (atacado > 0) return atacado;
      const baseAtacado = sale > 0 ? sale : cost;
      return Math.round(baseAtacado * 0.90 * 100) / 100; // Desconto automático de 10% sobre a venda
    case 'promocional':
      if (promo > 0) return promo;
      const basePromo = sale > 0 ? sale : cost;
      return Math.round(basePromo * 0.85 * 100) / 100; // Desconto automático de 15% sobre a venda
    default:
      return sale;
  }
}

interface PdvViewProps {
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onSaveService: (service: ServiceOrder) => void;
  salesCount: number;
}

const PDV_DRAFT_KEY = 'colaca_silagem_pdv_draft_itens';

// Carregador reativo e unificador dos clientes e produtores rurais (agrocontrol_clientes)
export const loadAgrocontrolClientes = (fallback: Client[] = []): Client[] => {
  const map = new Map<string, Client>();

  // 1. Array oficial 'agrocontrol_clientes' salvo no LocalStorage
  try {
    const rawAgro = localStorage.getItem('agrocontrol_clientes');
    if (rawAgro) {
      const parsed = JSON.parse(rawAgro);
      if (Array.isArray(parsed)) {
        parsed.forEach((c: any) => {
          if (!c) return;
          const id = c.id || `ag_${c.name || c.nome || Math.random().toString(36).substr(2, 6)}`;
          map.set(id, {
            id,
            name: c.name || c.nome || 'PRODUTOR RURAL',
            nome: c.nome || c.name || 'PRODUTOR RURAL',
            farmName: c.farmName || c.fazenda || '',
            fazenda: c.fazenda || c.farmName || '',
            cpfCnpj: c.cpfCnpj || c.cnpjCpf || c.documento || '',
            phone: c.phone || c.telefone || '',
            telefone: c.telefone || c.phone || '',
            city: c.city || c.cidade || '',
            state: c.state || c.estado || c.uf || '',
            ...c,
          });
        });
      }
    }
  } catch (e) {
    console.warn('Erro ao ler agrocontrol_clientes:', e);
  }

  // 2. Chave de clientes da aplicação
  try {
    const stored = getStoredClients();
    if (Array.isArray(stored)) {
      stored.forEach(c => {
        if (c && c.id && !map.has(c.id)) {
          map.set(c.id, c);
        }
      });
    }
  } catch (_) {}

  // 3. Fallback dos props
  if (Array.isArray(fallback)) {
    fallback.forEach(c => {
      if (c && c.id && !map.has(c.id)) {
        map.set(c.id, c);
      }
    });
  }

  return Array.from(map.values());
};

// Carregador reativo da conta bancária com status de 'PRIORITÁRIA' ou primeira ativa
export const getPrioritaryBankAccount = (): { bankName: string; agency: string; accountNumber: string; rawText: string } => {
  try {
    const raw = localStorage.getItem('agrocontrol_bancos_contas') ||
                localStorage.getItem('agrocontrol_bancos') ||
                localStorage.getItem('agrocontrol_contas_bancarias') ||
                localStorage.getItem('agrocontrol_financeiro_contas') ||
                localStorage.getItem('colaca_silagem_financeiro_contas');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        const priority = list.find((a: any) => 
          String(a.status || '').toUpperCase() === 'PRIORITÁRIA' || 
          String(a.status || '').toUpperCase() === 'PRIORITARIA' || 
          a.prioritaria === true || 
          a.isDefault === true || 
          a.padrao === true ||
          String(a.status || '').toLowerCase() === 'ativa' ||
          String(a.status || '').toLowerCase() === 'ativo'
        ) || list[0];

        const bName = (priority.bankName || priority.banco || priority.nome || 'SICREDI').toUpperCase();
        const ag = priority.agency || priority.agencia || '0725';
        const num = priority.accountNumber || priority.conta || priority.numeroConta || '12345-6';
        return {
          bankName: bName,
          agency: ag,
          accountNumber: num,
          rawText: `${bName} - AG: ${ag} C/C: ${num}`
        };
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar conta prioritária do LocalStorage:', e);
  }
  return {
    bankName: 'SICREDI',
    agency: '0725',
    accountNumber: '12345-6',
    rawText: 'SICREDI - AG: 0725 C/C: 12345-6'
  };
};

export const PdvView: React.FC<PdvViewProps> = ({
  clients = [],
  companyProfile,
  onSaveService,
  salesCount,
}) => {
  const { confirm: confirmDialog } = useConfirm();
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Modo de operação no PDV: Venda Balcão ou Lançamento de Contrato de Silagem
  const [operacaoTipo, setOperacaoTipo] = useState<'venda_balcao' | 'contrato_silagem'>('venda_balcao');

  // Clientes e Produtores rurais carregados e sincronizados reativamente de 'agrocontrol_clientes'
  const [agroClientes, setAgroClientes] = useState<Client[]>(() => loadAgrocontrolClientes(clients));

  useEffect(() => {
    setAgroClientes(loadAgrocontrolClientes(clients));
  }, [clients]);

  useEffect(() => {
    const syncClients = () => {
      setAgroClientes(loadAgrocontrolClientes(clients));
    };
    window.addEventListener('storage', syncClients);
    window.addEventListener('agrocontrol_clientes_updated', syncClients);
    window.addEventListener('clients_updated', syncClients);
    window.addEventListener('colaca_clientes_sync', syncClients);
    return () => {
      window.removeEventListener('storage', syncClients);
      window.removeEventListener('agrocontrol_clientes_updated', syncClients);
      window.removeEventListener('clients_updated', syncClients);
      window.removeEventListener('colaca_clientes_sync', syncClients);
    };
  }, [clients]);

  // Itens lançados na grade
  const [items, setItems] = useState<PdvItem[]>(() => {
    try {
      const raw = localStorage.getItem(PDV_DRAFT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Salvar rascunho dos itens no LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(PDV_DRAFT_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Erro ao salvar rascunho do PDV no LocalStorage:', e);
    }
  }, [items]);

  // Produtos do estoque para busca rápida
  const [stockItems, setStockItems] = useState<InventoryItem[]>([]);
  useEffect(() => {
    setStockItems(getStoredInventory());
  }, []);

  // Campos do Painel Superior de Entrada
  const [inputQtde, setInputQtde] = useState<string>('1,00');
  const [inputBusca, setInputBusca] = useState<string>('');
  const [inputCodigo, setInputCodigo] = useState<string>('');
  const [inputDescricao, setInputDescricao] = useState<string>('');
  const [inputUnidade, setInputUnidade] = useState<string>('UN');
  const [inputPreco, setInputPreco] = useState<string>('0,00');
  const [inputDesconto, setInputDesconto] = useState<string>('0,00');
  
  // Tabela de Preços Ativa e Objeto de Produto Selecionado
  const [tabelaPreco, setTabelaPreco] = useState<PriceTable>('venda');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  // Sugestões de autocomplete na busca
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const productSearchContainerRef = useRef<HTMLDivElement>(null);

  // Cliente selecionado no PDV
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('CONSUMIDOR FINAL / BALCÃO');
  const [showClientSuggestions, setShowClientSuggestions] = useState<boolean>(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdowns de sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientSuggestions(false);
      }
      if (productSearchContainerRef.current && !productSearchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =========================================================================
  // REGRAS DE SEGURANÇA E ALÇADA MÁXIMA DE DESCONTO (% DESC) POR CARGO
  // =========================================================================
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('agrocontrol_usuario_logado') || localStorage.getItem('usuario_logado');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) return parsed;
      }
    } catch {}
    return getActiveUserSession();
  });

  useEffect(() => {
    const handleSyncUser = () => {
      try {
        const raw = localStorage.getItem('agrocontrol_usuario_logado') || localStorage.getItem('usuario_logado');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed) {
            setCurrentUser(parsed);
            return;
          }
        }
      } catch {}
      setCurrentUser(getActiveUserSession());
    };

    window.addEventListener('colaca_silagem_session_updated', handleSyncUser);
    window.addEventListener('storage', handleSyncUser);
    return () => {
      window.removeEventListener('colaca_silagem_session_updated', handleSyncUser);
      window.removeEventListener('storage', handleSyncUser);
    };
  }, []);

  // 1. Trava de Teto Máximo por Perfil de Usuário:
  // Administrador Geral: teto de 15.00% | Caixa / Operador: teto rigoroso de 5.00%
  const isAdministradorGeral = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.type === 'admin') return true;
    const roleStr = (currentUser.cargoNome || currentUser.cargo || currentUser.name || currentUser.role || '').toUpperCase();
    return roleStr.includes('ADMINISTRADOR') || roleStr.includes('ADMIN') || roleStr.includes('DIRETOR') || roleStr.includes('GERENTE GERAL');
  }, [currentUser]);

  const maxDiscountAllowed = isAdministradorGeral ? 15.00 : 5.00;
  const roleBadgeLabel = isAdministradorGeral ? 'ADMINISTRADOR GERAL' : 'CAIXA / OPERADOR';

  // Estados de Alerta e Modal de Autorização Master
  const [isDiscountExceeded, setIsDiscountExceeded] = useState<boolean>(false);
  const [attemptedDiscount, setAttemptedDiscount] = useState<number>(0);
  const [isMasterAuthModalOpen, setIsMasterAuthModalOpen] = useState<boolean>(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState<string>('');
  const [masterAuthError, setMasterAuthError] = useState<string>('');
  const [showMasterPassword, setShowMasterPassword] = useState<boolean>(false);
  const discountAlertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validador de Senha Administrativa contra 'agrocontrol_cargos_permissoes' e configurações mestre
  const validateAdminPassword = (enteredPass: string): boolean => {
    const cleanPass = enteredPass.trim();
    if (!cleanPass) return false;

    // 1. Varre 'agrocontrol_cargos_permissoes' e 'colaca_silagem_cargos_permissoes'
    const storageKeys = [
      'agrocontrol_cargos_permissoes',
      'colaca_silagem_cargos_permissoes',
      'cargos_permissoes'
    ];

    for (const key of storageKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item?.senha && item.senha.trim() === cleanPass) return true;
              if (item?.password && item.password.trim() === cleanPass) return true;
              if (item?.senha_admin && item.senha_admin.trim() === cleanPass) return true;
              if (item?.admin_password && item.admin_password.trim() === cleanPass) return true;
            }
          } else if (parsed && typeof parsed === 'object') {
            if (parsed.senha && parsed.senha.trim() === cleanPass) return true;
            if (parsed.password && parsed.password.trim() === cleanPass) return true;
            if (parsed.senha_admin && parsed.senha_admin.trim() === cleanPass) return true;
            if (parsed.admin_password && parsed.admin_password.trim() === cleanPass) return true;
          }
        }
      } catch {}
    }

    // 2. Senha mestre das configurações administrativas do ERP
    try {
      const adminSettings = getStoredAdminSettings();
      if (adminSettings?.masterPassword && adminSettings.masterPassword.trim() === cleanPass) {
        return true;
      }
    } catch {}

    // 3. Padrões de senhas administrativas padrão do sistema
    const defaultMasterPasswords = [
      'AgroControl@Master2026',
      'admin123',
      'admin',
      'agro2026',
      '123456',
      'agrocontrol'
    ];

    return defaultMasterPasswords.some(p => p.toLowerCase() === cleanPass.toLowerCase());
  };

  // Interceptação e Correção Automática no campo % DESC
  const handleDescontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleanNum = parseFloat(raw.replace(/\./g, '').replace(',', '.'));

    // Se o operador digitar um valor maior do que o teto permitido pelo seu cargo
    if (!isNaN(cleanNum) && cleanNum > maxDiscountAllowed) {
      // 1. Captura o valor excedido para autorização
      setAttemptedDiscount(cleanNum);
      // 2. Reajusta o input automaticamente para o teto máximo permitido (5.00% ou 15.00%)
      setInputDesconto(maxDiscountAllowed.toFixed(2).replace('.', ','));
      // 3. Aplica alerta e borda amarela temporária
      setIsDiscountExceeded(true);

      if (discountAlertTimeoutRef.current) {
        clearTimeout(discountAlertTimeoutRef.current);
      }
      discountAlertTimeoutRef.current = setTimeout(() => {
        setIsDiscountExceeded(false);
      }, 5000);
      return;
    }

    setInputDesconto(raw);
    if (isNaN(cleanNum) || cleanNum <= maxDiscountAllowed) {
      setIsDiscountExceeded(false);
      setAttemptedDiscount(0);
    }
  };

  // Controle de Pagamento
  const [formaPagamento, setFormaPagamento] = useState<'a_vista' | 'cartao_debito' | 'cartao_credito' | 'pix' | 'prazo'>('a_vista');
  const [valorPagoInput, setValorPagoInput] = useState<string>('');
  
  // Bloco Prazo: Condição, Cobrança, Formato e Parcelas
  const [prazoCondicao, setPrazoCondicao] = useState<string>('30 DIAS');
  const [tipoCobranca, setTipoCobranca] = useState<'carteira' | 'boleto'>('carteira');
  const [formatoImpressao, setFormatoImpressao] = useState<'a4' | 'termica'>('termica');
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [qtdeParcelas, setQtdeParcelas] = useState<number>(1);

  // Busca reativa da Conta Prioritária para Boleto Bancário
  const [prioritaryAccount, setPrioritaryAccount] = useState<{
    bankName: string;
    agency: string;
    accountNumber: string;
    rawText: string;
  }>(() => getPrioritaryBankAccount());

  useEffect(() => {
    const syncAccount = () => {
      setPrioritaryAccount(getPrioritaryBankAccount());
    };
    window.addEventListener('storage', syncAccount);
    window.addEventListener('agrocontrol_bancos_updated', syncAccount);
    window.addEventListener('agrocontrol_bancos_contas_updated', syncAccount);
    window.addEventListener('bank_accounts_updated', syncAccount);
    return () => {
      window.removeEventListener('storage', syncAccount);
      window.removeEventListener('agrocontrol_bancos_updated', syncAccount);
      window.removeEventListener('agrocontrol_bancos_contas_updated', syncAccount);
      window.removeEventListener('bank_accounts_updated', syncAccount);
    };
  }, []);

  // Modal de Cupom / Espelho de Venda A4 com Suporte Anti-Sandbox
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [activePrintFormat, setActivePrintFormat] = useState<'a4' | 'termica'>('termica');
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [lastFinishedSale, setLastFinishedSale] = useState<{
    orderNumber: string;
    date: string;
    time: string;
    client: string;
    clientId?: string;
    farmName?: string;
    items: PdvItem[];
    totalBruto: number;
    totalDesconto: number;
    totalLiquido: number;
    forma: string;
    tipoCobranca?: string;
    bancoEmissor?: string;
    formatoImpressao?: 'a4' | 'termica';
    valorPago: number;
    troco: number;
    parcelas?: InstallmentRow[];
  } | null>(null);

  // Foco inicial no campo de busca ao montar
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Catálogo combinado de produtos (Contratos de Prestação de Serviços de Silagem + Commodities + Estoque)
  const productCatalog = useMemo<CatalogProduct[]>(() => {
    const commodities: CatalogProduct[] = [
      // 1. Contratos de Prestação de Serviços de Silagem
      { id: 'ctr_corte_ensilagem_ton', code: 'CTR-01', barcode: '7892001', name: 'CONTRATO: CORTE, ENSILAGEM & TRANSPORTE (POR TONELADA)', unit: 'TON', price: 45.00, salePrice: 45.00, unitCost: 32.00, wholesalePrice: 40.50, promoPrice: 38.25 },
      { id: 'ctr_corte_ensilagem_ha', code: 'CTR-02', barcode: '7892002', name: 'CONTRATO: PRESTAÇÃO DE SERVIÇO DE CORTE E ENSILAGEM (POR HECTARE)', unit: 'HA', price: 1250.00, salePrice: 1250.00, unitCost: 900.00, wholesalePrice: 1125.00, promoPrice: 1062.50 },
      { id: 'ctr_embalagem_sacas', code: 'CTR-03', barcode: '7892003', name: 'CONTRATO: EMBALAGEM / ENSACAMENTO DE SILAGEM', unit: 'TON', price: 65.00, salePrice: 65.00, unitCost: 48.00, wholesalePrice: 58.50, promoPrice: 55.25 },
      { id: 'ctr_fechamento_silo', code: 'CTR-04', barcode: '7892004', name: 'CONTRATO: COMPACTAÇÃO E FECHAMENTO DE SILO TRINCHEIRA', unit: 'UN', price: 1800.00, salePrice: 1800.00, unitCost: 1300.00, wholesalePrice: 1620.00, promoPrice: 1530.00 },
      { id: 'ctr_inoculante_ha', code: 'CTR-05', barcode: '7892005', name: 'CONTRATO: APLICAÇÃO DE INOCULANTE BACTERIANO EM ÁREA', unit: 'HA', price: 85.00, salePrice: 85.00, unitCost: 60.00, wholesalePrice: 76.50, promoPrice: 72.25 },
      { id: 'ctr_fornecimento_prog', code: 'CTR-06', barcode: '7892006', name: 'CONTRATO: FORNECIMENTO PROGRAMADO DE SILAGEM DE MILHO', unit: 'TON', price: 380.00, salePrice: 380.00, unitCost: 280.00, wholesalePrice: 342.00, promoPrice: 323.00 },

      // 2. Commodities e Insumos Rápidos de Silagem
      { id: 'com_silagem_milho', code: 'SIL-01', barcode: '7891001', name: 'SILAGEM DE MILHO PLANTA INTEIRA', unit: 'TON', price: 380.00, salePrice: 380.00, unitCost: 280.00, wholesalePrice: 342.00, promoPrice: 323.00 },
      { id: 'com_silagem_sorgo', code: 'SIL-02', barcode: '7891002', name: 'SILAGEM DE SORGO FORRAGEIRO', unit: 'TON', price: 320.00, salePrice: 320.00, unitCost: 230.00, wholesalePrice: 288.00, promoPrice: 272.00 },
      { id: 'com_silagem_capim', code: 'SIL-03', barcode: '7891003', name: 'SILAGEM DE CAPIM AÇU', unit: 'TON', price: 260.00, salePrice: 260.00, unitCost: 180.00, wholesalePrice: 234.00, promoPrice: 221.00 },
      { id: 'com_frete_ton', code: 'SRV-01', barcode: '7891004', name: 'TRANSPORTE / FRETE DE SILAGEM', unit: 'TON', price: 45.00, salePrice: 45.00, unitCost: 32.00, wholesalePrice: 40.50, promoPrice: 38.25 },
      { id: 'com_lona_200', code: 'INS-01', barcode: '7891005', name: 'LONA PLÁSTICA DUPLA FACE 200 MICRAS', unit: 'M', price: 18.50, salePrice: 18.50, unitCost: 13.00, wholesalePrice: 16.65, promoPrice: 15.72 },
      { id: 'com_inoculante', code: 'INS-02', barcode: '7891006', name: 'INOCULANTE BACTERIANO P/ SILAGEM 1L', unit: 'L', price: 145.00, salePrice: 145.00, unitCost: 105.00, wholesalePrice: 130.50, promoPrice: 123.25 },
    ];

    const stockMapped: CatalogProduct[] = stockItems.map(item => {
      const name = (item.nome_comercial || item.name || '').toUpperCase();
      const unit = (item.unidade_medida || item.unit || 'UN').toUpperCase();
      const isDieselS10 = name.includes('DIESEL S10');
      const isDieselS500 = name.includes('DIESEL S500');

      let cost = Number(item.preco_custo_inicial ?? item.custo_nominal ?? item.custo_com_imposto ?? item.unitCost ?? (item as any).precoCusto ?? 0);
      let sale = Number(item.preco_venda_varejo ?? item.preco_venda ?? item.salePrice ?? (item as any).precoVenda ?? 0);
      let atacado = Number(item.wholesalePrice ?? item.preco_venda_atacado ?? item.preco_atacado ?? (item as any).precoAtacado ?? 0);
      let promo = Number(item.promoPrice ?? item.preco_venda_promo ?? item.preco_promocional ?? (item as any).precoPromocional ?? 0);

      if (cost <= 0) {
        if (isDieselS10) cost = 5.85;
        else if (isDieselS500) cost = 5.60;
        else if (sale > 0) cost = Math.round(sale * 0.75 * 100) / 100;
      }

      if (sale <= 0) {
        if (cost > 0) sale = cost;
        else if (isDieselS10) sale = 5.85;
        else if (isDieselS500) sale = 5.60;
      }

      const activePrice = calculatePriceByTable({
        salePrice: sale,
        unitCost: cost,
        wholesalePrice: atacado,
        promoPrice: promo,
        name,
      }, tabelaPreco);

      return {
        id: item.id,
        code: item.code || (item as any).codigo_produto || `EST-${item.id.slice(-4).toUpperCase()}`,
        barcode: item.barcode || (item as any).codigo_barras || '',
        name,
        unit,
        price: activePrice > 0 ? activePrice : (sale > 0 ? sale : cost),
        salePrice: sale,
        unitCost: cost,
        wholesalePrice: atacado,
        promoPrice: promo,
        rawItem: item,
      };
    });

    return [...commodities, ...stockMapped];
  }, [stockItems, tabelaPreco]);

  // Itens filtrados para sugestão de autocomplete
  const suggestedProducts = useMemo(() => {
    if (!inputBusca.trim()) return [];
    const q = inputBusca.toLowerCase().trim();
    return productCatalog.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [inputBusca, productCatalog]);

  // Clientes e Produtores rurais filtrados para sugestão de autocomplete reativo
  const suggestedClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const isDefault = !q || q === 'consumidor final / balcão' || q === 'consumidor final (pdv balcão)';

    if (isDefault) {
      return agroClientes.slice(0, 15);
    }

    const cleanQ = q.replace(/\D/g, '');
    return agroClientes.filter(c => {
      const name = (c.nome || c.name || '').toLowerCase();
      const farm = (c.fazenda || c.farmName || '').toLowerCase();
      const doc = (c.cpfCnpj || '').replace(/\D/g, '');
      const phone = (c.telefone || c.phone || '').replace(/\D/g, '');
      const city = (c.city || c.cidade || '').toLowerCase();
      return (
        name.includes(q) ||
        farm.includes(q) ||
        city.includes(q) ||
        (cleanQ.length > 2 && doc.includes(cleanQ)) ||
        (cleanQ.length > 3 && phone.includes(cleanQ))
      );
    }).slice(0, 12);
  }, [clientSearch, agroClientes]);

  // Totais do PDV
  const totals = useMemo(() => {
    let bruto = 0;
    let desconto = 0;
    let totalItensContagem = 0;

    items.forEach(it => {
      bruto += it.totalBruto;
      desconto += it.valorDesconto;
      totalItensContagem += it.quantidade;
    });

    const liquido = Math.max(0, bruto - desconto);
    const pagoNumerico = valorPagoInput ? parseFloat(valorPagoInput.replace(/\./g, '').replace(',', '.')) || 0 : liquido;
    const troco = Math.max(0, pagoNumerico - liquido);

    return {
      totalBruto: bruto,
      totalDesconto: desconto,
      totalLiquido: liquido,
      totalItens: items.length,
      totalQuantidade: totalItensContagem,
      valorPago: pagoNumerico,
      troco: troco
    };
  }, [items, valorPagoInput]);

  // Parcelas do Bloco a Prazo
  const parcelas = useMemo<InstallmentRow[]>(() => {
    if (formaPagamento !== 'prazo' || totals.totalLiquido <= 0 || qtdeParcelas <= 0) return [];
    
    const count = Math.max(1, qtdeParcelas);
    const valorBase = Math.round((totals.totalLiquido / count) * 100) / 100;
    const rows: InstallmentRow[] = [];
    
    const startDate = new Date(dataPrimeiraParcela || new Date());
    
    for (let i = 1; i <= count; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + ((i - 1) * 30));
      
      // Ajuste de centavos na última parcela
      const valor = i === count 
        ? Math.round((totals.totalLiquido - (valorBase * (count - 1))) * 100) / 100
        : valorBase;

      rows.push({
        numero: i,
        vencimento: dueDate.toISOString().split('T')[0],
        valor: Math.max(0, valor)
      });
    }

    return rows;
  }, [formaPagamento, totals.totalLiquido, qtdeParcelas, dataPrimeiraParcela]);

  // Interceptação do gatilho de multiplicação por asterisco ("QTD *") no campo de busca do PDV
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setSelectedSuggestionIndex(0);

    // 1. Identificação do padrão de quantidade multiplicada por asterisco via Regex (ex: "5*", "12*", "10*7891001")
    const match = rawVal.match(/^\s*([0-9]+(?:[.,][0-9]+)?)\s*\*(.*)$/);
    if (match) {
      const qtdStr = match[1];
      const rest = match[2];
      const numQtd = parseFloat(qtdStr.replace(',', '.'));

      if (!isNaN(numQtd) && numQtd > 0) {
        // Atualiza instantaneamente o campo "QTDE (Q)" no padrão BRL (ex: 10,00 ou 5,00)
        const formattedQtde = numQtd.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setInputQtde(formattedQtde);

        // Limpa o prefixo do campo e deixa apenas o que veio após o asterisco em CAIXA ALTA
        const cleanRest = (rest || '').trimStart().toUpperCase();
        setInputBusca(cleanRest);
        setInputDescricao(cleanRest);
        setShowSuggestions(cleanRest.trim().length > 0);
        return;
      }
    }

    // Caso alternativo com split por asterisco
    if (rawVal.includes('*')) {
      const [qtd, ...restArr] = rawVal.split('*');
      const cleanQtd = qtd.trim().replace(',', '.');
      const num = parseFloat(cleanQtd);
      if (!isNaN(num) && num > 0 && cleanQtd !== '') {
        const formattedQtde = num.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setInputQtde(formattedQtde);
        const cleanRest = restArr.join('*').trimStart().toUpperCase();
        setInputBusca(cleanRest);
        setInputDescricao(cleanRest);
        setShowSuggestions(cleanRest.trim().length > 0);
        return;
      }
    }

    // Fluxo normal mantendo strings sempre em CAIXA ALTA
    const upperVal = rawVal.toUpperCase();
    setInputBusca(upperVal);
    setInputDescricao(upperVal);
    setShowSuggestions(upperVal.trim().length > 0);
  };

  // Selecionar um produto do autocomplete e saltar foco imediatamente para a Quantidade
  const handleSelectProduct = (prod: CatalogProduct) => {
    setSelectedProduct(prod);
    setInputCodigo(prod.code);
    setInputDescricao(prod.name);
    setInputUnidade(prod.unit);
    
    // Injeção compulsória do valor financeiro do objeto com base na tabela ativa no momento
    const precoTabela = calculatePriceByTable(prod, tabelaPreco);
    setInputPreco(precoTabela > 0 ? precoTabela.toFixed(2).replace('.', ',') : '0,00');
    setInputBusca(prod.name);
    
    // 1. FECHAMENTO IMEDIATO DA LISTA FLUTUANTE (SUGESTÕES)
    setShowSuggestions(false);
    setSelectedSuggestionIndex(0);

    // Auto-detectar contrato caso o item seja de prestação de serviços de silagem
    if (prod.code.startsWith('CTR-') || prod.name.includes('CONTRATO')) {
      setOperacaoTipo('contrato_silagem');
    }

    // 2. SALTO DE FOCO AUTOMÁTICO PARA O PRÓXIMO CAMPO ("QTDE") COM SELEÇÃO DO TEXTO
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 10);
  };

  // Manipulação do teclado no input de busca (OnKeyDown: ENTER, Setas Cima/Baixo, ESC)
  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (suggestedProducts.length > 0) {
        e.preventDefault();
        if (!showSuggestions) {
          setShowSuggestions(true);
        } else {
          setSelectedSuggestionIndex(prev => (prev + 1) % suggestedProducts.length);
        }
      }
    } else if (e.key === 'ArrowUp') {
      if (suggestedProducts.length > 0 && showSuggestions) {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev - 1 + suggestedProducts.length) % suggestedProducts.length);
      }
    } else if (e.key === 'Enter') {
      // 1. Se a lista de sugestões estiver aberta e houver itens, seleciona automaticamente o item ativo
      if (showSuggestions && suggestedProducts.length > 0) {
        e.preventDefault();
        const targetProd = suggestedProducts[selectedSuggestionIndex] || suggestedProducts[0];
        handleSelectProduct(targetProd);
      } else if (inputBusca.trim().length > 0) {
        // Se houver apenas 1 sugestão exata ou filtrada
        if (suggestedProducts.length === 1) {
          e.preventDefault();
          handleSelectProduct(suggestedProducts[0]);
        } else {
          // Se não houver lista aberta mas houver texto digitado, fecha e pula para o campo de quantidade
          e.preventDefault();
          setShowSuggestions(false);
          setTimeout(() => {
            qtyInputRef.current?.focus();
            qtyInputRef.current?.select();
          }, 10);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
    }
  };

  // Alteração reativa da tabela de preços em tempo real
  const handleTableChange = (newTable: PriceTable) => {
    setTabelaPreco(newTable);

    // Se já houver um produto selecionado na barra de inserção, recalcula e reflete instantaneamente
    let target = selectedProduct;
    if (!target) {
      const q = (inputDescricao || inputBusca || inputCodigo).trim().toLowerCase();
      if (q) {
        target = productCatalog.find(p => 
          p.code.toLowerCase() === q ||
          p.barcode.toLowerCase() === q ||
          p.name.toLowerCase() === q
        ) || (suggestedProducts.length > 0 ? suggestedProducts[0] : null);
      }
    }

    if (target) {
      const novoPreco = calculatePriceByTable(target, newTable);
      setInputPreco(novoPreco > 0 ? novoPreco.toFixed(2).replace('.', ',') : '0,00');
    }
  };

  // Função compartilhada para inserir o item com desconto autorizado
  const inserirItemComDesconto = (descontoFinal: number) => {
    let descResolved = (inputDescricao || inputBusca).trim().toUpperCase();
    if (!descResolved) {
      searchInputRef.current?.focus();
      return;
    }

    const qtd = parseFloat(inputQtde.replace(/\./g, '').replace(',', '.')) || 1;
    let preco = parseFloat(inputPreco.replace(/\./g, '').replace(',', '.')) || 0;
    let cod = inputCodigo;
    let un = inputUnidade.trim().toUpperCase() || 'UN';

    // Se o preço for 0 ou código não estiver preenchido, resolve produto do catálogo por código de barras, código ou nome
    if (preco <= 0 || !cod) {
      const q = (inputBusca || descResolved).trim().toLowerCase();
      const matched = productCatalog.find(p => 
        p.barcode.toLowerCase() === q ||
        p.code.toLowerCase() === q ||
        p.name.toLowerCase() === q
      ) || (suggestedProducts.length === 1 ? suggestedProducts[0] : null);

      if (matched) {
        cod = matched.code;
        descResolved = matched.name;
        un = matched.unit;
        preco = calculatePriceByTable(matched, tabelaPreco);
      }
    }

    const descPct = Math.max(0, descontoFinal);

    // Cálculo exato: Valor Total = Preço Unitário * Quantidade Atualizada
    const totalBruto = Math.round(qtd * preco * 100) / 100;
    const valorDesc = Math.round(totalBruto * (descPct / 100) * 100) / 100;
    const totalLiquido = Math.max(0, totalBruto - valorDesc);

    const newItem: PdvItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      codigo: cod || `COD-${String(items.length + 1).padStart(3, '0')}`,
      descricao: descResolved,
      unidade: un,
      quantidade: qtd,
      precoUnitario: preco,
      percentualDesconto: descPct,
      valorDesconto: valorDesc,
      totalBruto: totalBruto,
      totalLiquido: totalLiquido
    };

    setItems(prev => [...prev, newItem]);

    // Limpar campos de entrada para o próximo item e resetar quantidade de volta para "1,00"
    setInputBusca('');
    setInputCodigo('');
    setInputDescricao('');
    setInputQtde('1,00');
    setInputPreco('0,00');
    setInputDesconto('0,00');
    setSelectedProduct(null);
    setShowSuggestions(false);
    setIsDiscountExceeded(false);
    setAttemptedDiscount(0);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Adicionar item à grade com validação rigorosa de teto de desconto por cargo
  const handleAdicionarItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let descResolved = (inputDescricao || inputBusca).trim().toUpperCase();
    if (!descResolved) {
      searchInputRef.current?.focus();
      return;
    }

    const descPct = parseFloat(inputDesconto.replace(',', '.')) || 0;

    // Se o desconto exceder o teto máximo permitido pelo perfil, abre o modal de autorização master
    if (attemptedDiscount > maxDiscountAllowed || descPct > maxDiscountAllowed) {
      const requested = attemptedDiscount > maxDiscountAllowed ? attemptedDiscount : descPct;
      setAttemptedDiscount(requested);
      setIsMasterAuthModalOpen(true);
      return;
    }

    inserirItemComDesconto(descPct);
  };

  // Confirmação de Autorização Master com Senha do Administrador
  const handleConfirmMasterAuth = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!masterPasswordInput.trim()) {
      setMasterAuthError('INFORME A SENHA DO ADMINISTRADOR.');
      return;
    }

    const isValid = validateAdminPassword(masterPasswordInput);
    if (!isValid) {
      setMasterAuthError('SENHA DO ADMINISTRADOR INCORRETA OU ACESSO NÃO AUTORIZADO.');
      return;
    }

    // Senha correta: libera o desconto maior exclusivamente para aquele item
    const authorizedPct = attemptedDiscount > 0 ? attemptedDiscount : (parseFloat(inputDesconto.replace(',', '.')) || maxDiscountAllowed);
    inserirItemComDesconto(authorizedPct);

    // Fecha o modal e limpa os campos
    setIsMasterAuthModalOpen(false);
    setMasterPasswordInput('');
    setMasterAuthError('');
  };

  // Remover item da grade
  const handleRemoverItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  // Limpar todo o PDV (F4)
  const handleLimparPdv = () => {
    setItems([]);
    setInputBusca('');
    setInputCodigo('');
    setInputDescricao('');
    setInputQtde('1,00');
    setInputPreco('0,00');
    setInputDesconto('0,00');
    setSelectedProduct(null);
    setValorPagoInput('');
    setClientSearch('CONSUMIDOR FINAL / BALCÃO');
    setSelectedClientId('');
    setOperacaoTipo('venda_balcao');
    setIsDiscountExceeded(false);
    setAttemptedDiscount(0);
    try {
      localStorage.removeItem(PDV_DRAFT_KEY);
    } catch {}
    searchInputRef.current?.focus();
  };

  // Finalizar a Venda ou Contrato de Silagem no PDV (F2)
  const handleFinalizarVenda = () => {
    if (items.length === 0) {
      setWarningMessage('Nenhum item lançado no PDV. Insira ao menos um produto ou serviço antes de finalizar.');
      searchInputRef.current?.focus();
      setTimeout(() => setWarningMessage(null), 4000);
      return;
    }

    const isContract = operacaoTipo === 'contrato_silagem' || items.some(it => 
      it.codigo.startsWith('CTR-') ||
      it.descricao.includes('CONTRATO') || 
      it.descricao.includes('PRESTAÇÃO') || 
      it.descricao.includes('ENSILAGEM')
    );

    const orderNum = isContract
      ? `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
      : `PDV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const clientNameResolved = clientSearch.trim() || (isContract ? 'PRODUTOR RURAL (CONTRATO)' : 'CONSUMIDOR FINAL (PDV BALCÃO)');
    const selectedClientObj = agroClientes.find(c => c.id === selectedClientId);
    const farmNameResolved = selectedClientObj?.fazenda || selectedClientObj?.farmName || (isContract ? 'Fazenda do Produtor' : 'Venda Rápida Balcão PDV');

    const totalTons = items.reduce((acc, it) => it.unidade.includes('TON') ? acc + it.quantidade : acc, 0);
    const totalHa = items.reduce((acc, it) => it.unidade.includes('HA') ? acc + it.quantidade : acc, 0);

    const newSaleOrder: ServiceOrder = {
      id: isContract 
        ? `srv_ctr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` 
        : `srv_pdv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      orderNumber: orderNum,
      clientName: clientNameResolved,
      clientId: selectedClientId || undefined,
      farmName: farmNameResolved,
      serviceTab: 'venda',
      serviceType: isContract 
        ? 'Contrato de Prestação de Serviços de Silagem' 
        : 'Venda Rápida de Balcão (PDV)',
      date: dateStr,
      startDate: dateStr,
      completionDate: dateStr,
      status: isContract && formaPagamento === 'prazo' ? 'em_andamento' : 'concluido',
      ratePerUnit: totals.totalLiquido,
      totalAmount: totals.totalLiquido,
      tonsEstimated: totalTons > 0 ? totalTons : undefined,
      areaQuantity: totalHa > 0 ? totalHa : undefined,
      areaUnit: totalHa > 0 ? 'hectares' : undefined,
      notes: `${isContract ? 'Contrato de Prestação de Serviços de Silagem emitido via PDV Slim' : 'Venda gerada via Frente de Caixa PDV'} • Pagamento: ${formaPagamento.toUpperCase()} (${formaPagamento === 'prazo' ? 'PENDENTE / A PRAZO' : 'PAGO'}) • Produtor/Cliente: ${clientNameResolved} • Fazenda: ${farmNameResolved} • Itens: ${items.map(i => `${i.quantidade} ${i.unidade} - ${i.descricao}`).join('; ')}`,
    };

    // Salvar offline no LocalStorage e emitir evento reativo para sincronização imediata
    try {
      const rawServices = localStorage.getItem('colaca_silagem_services');
      const parsed = rawServices ? JSON.parse(rawServices) : [];
      const updated = [newSaleOrder, ...(Array.isArray(parsed) ? parsed : [])];
      localStorage.setItem('colaca_silagem_services', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('colaca_services_updated', { detail: updated }));
    } catch (e) {
      console.warn('Erro ao persistir venda no LocalStorage:', e);
    }

    // Salvar reativamente via callback
    onSaveService(newSaleOrder);

    // Preparar dados para o cupom e espelho
    const cobrancaLabel = tipoCobranca === 'carteira' ? 'CARTEIRA (CONTA INTERNA)' : 'BOLETO BANCÁRIO';
    const formaLabelMap = {
      a_vista: 'À VISTA (DINHEIRO)',
      cartao_debito: 'CARTÃO DE DÉBITO',
      cartao_credito: 'CARTÃO DE CRÉDITO',
      pix: 'PIX INSTANTÂNEO',
      prazo: `A PRAZO [${cobrancaLabel}] (${prazoCondicao} - ${qtdeParcelas}x)`
    };

    // 2. REGRA DE LANÇAMENTO PARA COMPRA EM CARTEIRA:
    // Ao finalizar a venda em 'CARTEIRA' (ou A PRAZO), a função 'handleFinalizarVenda' gera automaticamente 
    // as parcelas de recebimento e as injeta na chave 'agrocontrol_financeiro_receber' do LocalStorage vinculadas ao cliente.
    if (formaPagamento === 'prazo') {
      const clienteNomeFinal = clientSearch.trim() || clientNameResolved || 'MARCOS ROBERTO COELHO';
      const parcelasList = parcelas.length > 0 ? parcelas : [
        { numero: 1, vencimento: dataPrimeiraParcela, valor: totals.totalLiquido }
      ];

      const novasParcelasReceber = parcelasList.map(p => ({
        id: `rec_pdv_${Date.now()}_${p.numero}_${Math.random().toString(36).substr(2, 6)}`,
        orderNumber: orderNum,
        numeroDocumento: `${orderNum}-${p.numero}/${parcelasList.length}`,
        clientId: selectedClientId || undefined,
        clienteId: selectedClientId || undefined,
        clientName: clienteNomeFinal,
        clienteNome: clienteNomeFinal,
        descricao: `Venda PDV [${cobrancaLabel}] - Parcela ${p.numero}/${parcelasList.length} - ${clienteNomeFinal}`,
        valor: p.valor,
        valorOriginal: p.valor,
        dataEmissao: dateStr,
        dataVencimento: p.vencimento,
        status: 'pendente',
        status_pago: false,
        formaPagamento: 'prazo',
        tipoCobranca: cobrancaLabel,
        bancoEmissor: tipoCobranca === 'boleto' ? prioritaryAccount.rawText : undefined,
        categoria: 'Venda de Balcão / Silagem',
        criadoEm: new Date().toISOString()
      }));

      try {
        const rawRec = localStorage.getItem('agrocontrol_financeiro_receber');
        const parsedRec = rawRec ? JSON.parse(rawRec) : [];
        const updatedRec = [...novasParcelasReceber, ...(Array.isArray(parsedRec) ? parsedRec : [])];
        localStorage.setItem('agrocontrol_financeiro_receber', JSON.stringify(updatedRec));
        window.dispatchEvent(new CustomEvent('agrocontrol_financeiro_receber_updated', { detail: updatedRec }));
        window.dispatchEvent(new CustomEvent('financeiro_receber_updated', { detail: updatedRec }));
      } catch (e) {
        console.warn('Erro ao salvar em agrocontrol_financeiro_receber:', e);
      }
    }

    setLastFinishedSale({
      orderNumber: orderNum,
      date: formatDateBR(dateStr),
      time: timeStr,
      client: clientNameResolved,
      clientId: selectedClientId || undefined,
      farmName: farmNameResolved,
      items: [...items],
      totalBruto: totals.totalBruto,
      totalDesconto: totals.totalDesconto,
      totalLiquido: totals.totalLiquido,
      forma: formaLabelMap[formaPagamento],
      tipoCobranca: formaPagamento === 'prazo' ? cobrancaLabel : undefined,
      bancoEmissor: formaPagamento === 'prazo' && tipoCobranca === 'boleto' ? prioritaryAccount.rawText : undefined,
      formatoImpressao: formatoImpressao,
      valorPago: totals.valorPago,
      troco: totals.troco,
      parcelas: formaPagamento === 'prazo' ? [...parcelas] : undefined
    });

    // Limpar o PDV
    handleLimparPdv();

    // Ativar o formato de impressão selecionado e abrir o comprovante/espelho
    setActivePrintFormat(formatoImpressao);
    setIsReceiptOpen(true);
  };

  // Teclas de Atalho do PDV (F2, F3, F4, F5)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // F2: Finalizar Venda
      if (e.key === 'F2') {
        e.preventDefault();
        handleFinalizarVenda();
      }
      // F3: Focar Busca de Produtos
      else if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // F4: Cancelar / Limpar Venda
      else if (e.key === 'F4') {
        e.preventDefault();
        if (items.length === 0) {
          handleLimparPdv();
          return;
        }
        const isConfirmed = await confirmDialog({
          title: 'Limpar Frente de Caixa',
          message: 'Deseja realmente cancelar e limpar todos os itens deste cupom de venda?',
          confirmLabel: 'Limpar Caixa',
          cancelLabel: 'Manter Itens',
          variant: 'danger',
        });
        if (isConfirmed) {
          handleLimparPdv();
        }
      }
      // F5: Cupom / Espelho de Venda
      else if (e.key === 'F5') {
        e.preventDefault();
        if (lastFinishedSale) {
          setActivePrintFormat(formatoImpressao);
          setIsReceiptOpen(true);
        } else if (items.length > 0) {
          handlePrintSafe();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, totals, formaPagamento, lastFinishedSale, confirmDialog, formatoImpressao]);

  // Funções Anti-Sandbox para Impressão, Download e Cópia Segura
  const handlePrintSafe = () => {
    try {
      window.print();
    } catch (err) {
      console.warn('Sandbox restrita para window.print():', err);
    }
  };

  const handleCopyComprovante = () => {
    if (!lastFinishedSale) return;
    try {
      const isA4 = activePrintFormat === 'a4';
      const text = `================================================
${companyProfile?.name || 'AGROCONTROL • SOLUÇÕES AGRÍCOLAS & FORRAGENS'}
${companyProfile?.cnpjCpf || companyProfile?.cnpj ? `CNPJ/CPF: ${companyProfile.cnpjCpf || companyProfile.cnpj}` : ''}
${isA4 ? 'NOTA DE VENDA & ESPELHO DE PEDIDO DE BALCÃO (A4)' : 'CUPOM NÃO FISCAL DE VENDA (80MM)'}
================================================
PEDIDO Nº: ${lastFinishedSale.orderNumber}
DATA/HORA: ${lastFinishedSale.date} às ${lastFinishedSale.time}
CLIENTE:   ${lastFinishedSale.client}
${lastFinishedSale.farmName ? `FAZENDA:   ${lastFinishedSale.farmName}\n` : ''}PAGAMENTO: ${lastFinishedSale.forma}
${lastFinishedSale.tipoCobranca ? `COBRANÇA:  ${lastFinishedSale.tipoCobranca}\n` : ''}${lastFinishedSale.bancoEmissor ? `BANCO:     ${lastFinishedSale.bancoEmissor}\n` : ''}------------------------------------------------
ITENS DO PEDIDO:
${lastFinishedSale.items.map((it, idx) => `${idx + 1}. [${it.codigo}] ${it.quantidade} ${it.unidade} - ${it.descricao} | Unit: ${formatCurrencyBRL(it.precoUnitario)} | Total: ${formatCurrencyBRL(it.totalLiquido)}`).join('\n')}
------------------------------------------------
SUBTOTAL BRUTO: ${formatCurrencyBRL(lastFinishedSale.totalBruto)}
DESCONTO:       ${formatCurrencyBRL(lastFinishedSale.totalDesconto)}
TOTAL LÍQUIDO:  ${formatCurrencyBRL(lastFinishedSale.totalLiquido)}
${lastFinishedSale.troco > 0 ? `TROCO:          ${formatCurrencyBRL(lastFinishedSale.troco)}\n` : ''}${lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 ? `\nPROGRAMAÇÃO DE PARCELAS:\n` + lastFinishedSale.parcelas.map(p => `• Parcela ${p.numero} (${formatDateBR(p.vencimento)}): ${formatCurrencyBRL(p.valor)}`).join('\n') : ''}
================================================
AGROCONTROL - GESTÃO AGRÍCOLA INTELIGENTE
`;
      navigator.clipboard.writeText(text);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2500);
    } catch (err) {
      console.warn('Erro ao copiar comprovante:', err);
    }
  };

  const handleDownloadComprovante = () => {
    if (!lastFinishedSale) return;
    try {
      const isA4 = activePrintFormat === 'a4';
      const text = `================================================
${companyProfile?.name || 'AGROCONTROL • SOLUÇÕES AGRÍCOLAS & FORRAGENS'}
${companyProfile?.cnpjCpf || companyProfile?.cnpj ? `CNPJ/CPF: ${companyProfile.cnpjCpf || companyProfile.cnpj}` : ''}
${isA4 ? 'NOTA DE VENDA & ESPELHO DE PEDIDO DE BALCÃO (A4)' : 'CUPOM NÃO FISCAL DE VENDA (80MM)'}
================================================
PEDIDO Nº: ${lastFinishedSale.orderNumber}
DATA/HORA: ${lastFinishedSale.date} às ${lastFinishedSale.time}
CLIENTE:   ${lastFinishedSale.client}
${lastFinishedSale.farmName ? `FAZENDA:   ${lastFinishedSale.farmName}\n` : ''}PAGAMENTO: ${lastFinishedSale.forma}
${lastFinishedSale.tipoCobranca ? `COBRANÇA:  ${lastFinishedSale.tipoCobranca}\n` : ''}${lastFinishedSale.bancoEmissor ? `BANCO:     ${lastFinishedSale.bancoEmissor}\n` : ''}------------------------------------------------
ITENS DO PEDIDO:
${lastFinishedSale.items.map((it, idx) => `${idx + 1}. [${it.codigo}] ${it.quantidade} ${it.unidade} - ${it.descricao} | Unit: ${formatCurrencyBRL(it.precoUnitario)} | Total: ${formatCurrencyBRL(it.totalLiquido)}`).join('\n')}
------------------------------------------------
SUBTOTAL BRUTO: ${formatCurrencyBRL(lastFinishedSale.totalBruto)}
DESCONTO:       ${formatCurrencyBRL(lastFinishedSale.totalDesconto)}
TOTAL LÍQUIDO:  ${formatCurrencyBRL(lastFinishedSale.totalLiquido)}
${lastFinishedSale.troco > 0 ? `TROCO:          ${formatCurrencyBRL(lastFinishedSale.troco)}\n` : ''}${lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 ? `\nPROGRAMAÇÃO DE PARCELAS:\n` + lastFinishedSale.parcelas.map(p => `• Parcela ${p.numero} (${formatDateBR(p.vencimento)}): ${formatCurrencyBRL(p.valor)}`).join('\n') : ''}
================================================
AGROCONTROL - GESTÃO AGRÍCOLA INTELIGENTE
`;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${isA4 ? 'espelho_a4' : 'cupom_80mm'}_${lastFinishedSale.orderNumber}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Erro ao baixar comprovante:', err);
    }
  };

  return (
    <div 
      id="pdv-frente-de-caixa-container"
      className="w-full h-[calc(100vh-175px)] max-h-[calc(100vh-170px)] flex flex-col justify-between overflow-hidden global antialiased select-none gap-1.5"
    >
      {/* Alerta Não-Bloqueante de Validação */}
      {warningMessage && (
        <div className="p-2 rounded-lg bg-amber-500 text-amber-950 font-bold text-xs flex items-center justify-between shadow-xs border border-amber-600 animate-in fade-in duration-150 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{warningMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setWarningMessage(null)}
            className="p-0.5 hover:bg-amber-600/30 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          1. PAINEL SUPERIOR DE ENTRADA (MOLDURA BEGE/CINZA 3D)
         ===================================================================== */}
      <section 
        aria-label="Painel Superior de Entrada PDV"
        className="p-1.5 sm:p-2 bg-gradient-to-b from-stone-100 via-stone-50 to-stone-200 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-xl border border-stone-300 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.1)] shrink-0"
      >
        <form onSubmit={handleAdicionarItem} className="space-y-1.5">
          {/* Linha de Identificação de Operação, Cliente (Agrocontrol) & Atalhos Rápidos */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-stone-300">
            {/* Seletor Rápido de Modo de Operação (Venda Balcão vs Contrato de Silagem) */}
            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-stone-800 p-0.5 rounded-md border border-slate-300 dark:border-stone-700 shrink-0">
              <button
                type="button"
                onClick={() => setOperacaoTipo('venda_balcao')}
                className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded transition cursor-pointer flex items-center gap-1 ${
                  operacaoTipo === 'venda_balcao'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-700 dark:text-stone-300 hover:bg-slate-300/60 dark:hover:bg-stone-700'
                }`}
                title="Venda Rápida de Balcão (PDV)"
              >
                <ShoppingCart className="w-3 h-3" />
                <span>VENDA BALCÃO</span>
              </button>

              <button
                type="button"
                onClick={() => setOperacaoTipo('contrato_silagem')}
                className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded transition cursor-pointer flex items-center gap-1 ${
                  operacaoTipo === 'contrato_silagem'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-700 dark:text-stone-300 hover:bg-slate-300/60 dark:hover:bg-stone-700'
                }`}
                title="Contrato de Prestação de Serviços de Silagem"
              >
                <FileCheck2 className="w-3 h-3" />
                <span>CONTRATO DE SILAGEM</span>
              </button>
            </div>

            {/* Campo CLIENTE: Seleção Reativa de Produtores Rurais do LocalStorage (agrocontrol_clientes) */}
            <div ref={clientDropdownRef} className="relative flex items-center gap-1.5 flex-1 min-w-[280px]">
              <span className="font-extrabold uppercase text-[10px] text-slate-600 dark:text-stone-400 shrink-0 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-600 dark:text-stone-300" />
                CLIENTE:
              </span>
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value.toUpperCase());
                    setShowClientSuggestions(true);
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  placeholder="CONSUMIDOR FINAL / BALCÃO (OU BUSQUE O PRODUTOR RURAL...)"
                  className="w-full pl-2 pr-12 py-0.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold uppercase tracking-wide focus:ring-1 focus:ring-sky-500 outline-none"
                />

                <div className="absolute right-1 flex items-center gap-0.5">
                  {clientSearch && clientSearch !== 'CONSUMIDOR FINAL / BALCÃO' && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientSearch('CONSUMIDOR FINAL / BALCÃO');
                        setSelectedClientId('');
                        setShowClientSuggestions(false);
                      }}
                      title="Voltar para Consumidor Final"
                      className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowClientSuggestions(prev => !prev)}
                    title="Listar Produtores Rurais / Clientes"
                    className="p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-stone-200 transition cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sugestões Reativas de Produtores Rurais / Clientes (agrocontrol_clientes) */}
              {showClientSuggestions && (
                <div className="absolute top-full left-16 right-0 z-50 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-xl max-h-56 overflow-y-auto mt-0.5 divide-y divide-slate-100 dark:divide-stone-800">
                  {/* Opção Rápida: Consumidor Final */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientId('');
                      setClientSearch('CONSUMIDOR FINAL / BALCÃO');
                      setShowClientSuggestions(false);
                      searchInputRef.current?.focus();
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-sky-50 dark:hover:bg-stone-800 flex items-center justify-between transition cursor-pointer bg-slate-50/70 dark:bg-stone-850"
                  >
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-sky-600" />
                      <span className="font-extrabold text-sky-900 dark:text-sky-300 uppercase">
                        CONSUMIDOR FINAL / BALCÃO
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-stone-400 font-semibold uppercase">
                      Venda Rápida
                    </span>
                  </button>

                  {/* Lista de Produtores Rurais Cadastrados no LocalStorage */}
                  {suggestedClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClientId(c.id);
                        const name = (c.nome || c.name || '').toUpperCase();
                        const farm = (c.fazenda || c.farmName || '').toUpperCase();
                        setClientSearch(farm ? `${name} (${farm})` : name);
                        setShowClientSuggestions(false);
                        searchInputRef.current?.focus();
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-emerald-50 dark:hover:bg-stone-800 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-zinc-900 dark:text-white truncate uppercase">
                          {c.nome || c.name}
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate uppercase">
                          {c.fazenda || c.farmName ? `Fazenda: ${c.fazenda || c.farmName}` : 'Produtor Rural'}
                          {c.city || c.cidade ? ` • ${c.city || c.cidade}` : ''}
                          {c.cpfCnpj ? ` • ${c.cpfCnpj}` : ''}
                        </span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black uppercase shrink-0">
                        PRODUTOR RURAL
                      </span>
                    </button>
                  ))}

                  {suggestedClients.length === 0 && clientSearch && clientSearch !== 'CONSUMIDOR FINAL / BALCÃO' && (
                    <div className="px-3 py-2 text-xs text-slate-500 dark:text-stone-400 text-center font-medium">
                      Nenhum produtor rural encontrado para "{clientSearch}".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Teclas de Apoio Operacional */}
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-stone-400">
              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F3] BUSCA</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[ENTER] INSERIR</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F2] FINALIZAR</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F4] LIMPAR</span>
            </div>
          </div>

          {/* Grid de Inputs Horizontais Estilo Supermercado */}
          <div className="grid grid-cols-12 gap-1.5 items-end">
            {/* 1. DESCRIÇÃO / CÓD. / REFERÊNCIA COM FOCO AUTOMÁTICO (F3) */}
            <div ref={productSearchContainerRef} className="col-span-12 sm:col-span-4 relative">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 flex items-center justify-between">
                <span>DESCRIÇÃO / CÓDIGO / REFERÊNCIA [F3]</span>
                <Barcode className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  value={inputBusca}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchInputKeyDown}
                  onFocus={() => {
                    if (inputBusca.trim().length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="DIGITE O NOME, CÓDIGO OU PASSE O LEITOR DE CÓDIGO DE BARRAS..."
                  className="w-full pl-2 pr-7 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none placeholder:normal-case placeholder:font-medium placeholder:text-slate-400"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Sugestões de produtos com valor financeiro em tempo real */}
              {showSuggestions && suggestedProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-0.5 divide-y divide-slate-100 dark:divide-stone-800">
                  {suggestedProducts.map((p, idx) => {
                    const precoCalculado = calculatePriceByTable(p, tabelaPreco);
                    const isSelected = idx === selectedSuggestionIndex;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                        onClick={() => handleSelectProduct(p)}
                        className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-sky-100 dark:bg-sky-950/70 border-l-4 border-sky-600 pl-1.5'
                            : 'hover:bg-sky-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-[10px] font-bold text-slate-500">[{p.code}]</span>
                          <span className="font-bold text-zinc-900 dark:text-white truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-semibold text-slate-500">{p.unit}</span>
                          <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrencyBRL(precoCalculado)}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. QTDE (Q) */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5">
                QTDE (Q)
              </label>
              <input
                ref={qtyInputRef}
                type="text"
                value={inputQtde}
                onChange={e => setInputQtde(e.target.value)}
                onFocus={e => e.target.select()}
                className="w-full text-center px-1 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                placeholder="1,00"
              />
            </div>

            {/* 3. UNIDADE */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-center">
                UN
              </label>
              <input
                type="text"
                value={inputUnidade}
                onChange={e => setInputUnidade(e.target.value.toUpperCase())}
                className="w-full text-center px-1 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                placeholder="UN"
              />
            </div>

            {/* 4. BLOCO COMBINADO: SELETOR MICRO-SLIM + PREÇO (R$) */}
            <div className="col-span-8 sm:col-span-3">
              <div className="flex items-end gap-1.5">
                {/* Seletor Micro-Slim de Tabela de Preços (Sistema de Siglas Reativas) */}
                <div className="shrink-0">
                  <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-center truncate" title="TABELA PREÇO">
                    TABELA PREÇO
                  </label>
                  <div className="relative w-[65px]">
                    <div className="w-[65px] text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded px-1 py-0.5 text-center leading-none cursor-pointer focus:outline-none select-none flex items-center justify-center min-h-[25px]">
                      {tabelaPreco === 'custo' ? '1-PC' : tabelaPreco === 'venda' ? '2-PF' : tabelaPreco === 'atacado' ? '3-PA' : '4-PP'}
                    </div>
                    <select
                      value={tabelaPreco}
                      onChange={e => handleTableChange(e.target.value as PriceTable)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="TABELA PREÇO"
                    >
                      <option value="custo">1-PC - CUSTO</option>
                      <option value="venda">2-PF - FINAL</option>
                      <option value="atacado">3-PA - ATACADO</option>
                      <option value="promocional">4-PP - PROMO</option>
                    </select>
                  </div>
                </div>

                {/* Input de Preço de Venda */}
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-right truncate">
                    PREÇO (R$)
                  </label>
                  <input
                    type="text"
                    value={inputPreco}
                    onChange={e => setInputPreco(e.target.value)}
                    className="w-full text-right px-2 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            {/* 5. % DESCONTO COM TRAVA DE SEGURANÇA E ALÇADA POR CARGO */}
            <div className="col-span-2 sm:col-span-1 relative">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-right flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const currentDesc = parseFloat(inputDesconto.replace(',', '.')) || maxDiscountAllowed;
                    setAttemptedDiscount(currentDesc > maxDiscountAllowed ? currentDesc : maxDiscountAllowed + 5);
                    setIsMasterAuthModalOpen(true);
                  }}
                  title="Autorização de Desconto Master (Administrador)"
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 p-0 cursor-pointer"
                >
                  <Key className="w-3 h-3" />
                </button>
                <span>% DESC.</span>
              </label>
              <input
                type="text"
                value={inputDesconto}
                onChange={handleDescontoChange}
                className={`w-full text-right px-1 py-1 rounded-lg border text-xs font-bold shadow-2xs outline-none transition ${
                  isDiscountExceeded
                    ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200'
                    : 'border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white focus:ring-1 focus:ring-sky-500'
                }`}
                placeholder="0,00"
              />
              {/* Texto explicativo micro em UPPERCASE logo abaixo do campo quando violado */}
              {isDiscountExceeded && (
                <div 
                  onClick={() => setIsMasterAuthModalOpen(true)}
                  title="Clique para autorizar desconto master"
                  className="text-[7.5px] font-black uppercase text-amber-600 dark:text-amber-400 leading-tight mt-0.5 cursor-pointer hover:underline truncate"
                >
                  * LIMITE MÁXIMO DE DESCONTO PERMITIDO PARA SEU CARGO EXCEDIDO.
                </div>
              )}
            </div>

            {/* 6. BOTÃO INSERIR ITEM */}
            <div className="col-span-10 sm:col-span-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 py-1 px-3 text-xs font-bold text-white rounded-lg bg-gradient-to-b from-sky-600 via-sky-700 to-sky-800 hover:from-sky-500 hover:to-sky-700 border border-sky-500/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>INSERIR (ENTER)</span>
              </button>
            </div>
          </div>

          {/* Alerta Operacional Slim de Teto de Desconto Excedido */}
          {isDiscountExceeded && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-[10px] font-black uppercase shadow-2xs animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">
                  * LIMITE MÁXIMO DE DESCONTO PERMITIDO PARA SEU CARGO EXCEDIDO. (PERFIL: {roleBadgeLabel} • TETO: {maxDiscountAllowed.toFixed(2).replace('.', ',')}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMasterAuthModalOpen(true)}
                className="shrink-0 ml-2 inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-900 dark:text-amber-100 hover:text-amber-700 dark:hover:text-amber-300 underline cursor-pointer"
              >
                <Key className="w-3 h-3" />
                <span>🔑 AUTORIZAR DESCONTO MASTER</span>
              </button>
            </div>
          )}
        </form>
      </section>

      {/* =====================================================================
          2. GRADE CENTRAL DOS ITENS LANÇADOS (CABEÇALHO PRETO & LINHAS AZUIS)
         ===================================================================== */}
      <section 
        aria-label="Grade de Itens do Cupom"
        className="flex-1 min-h-[160px] bg-white dark:bg-stone-900 rounded-xl border border-slate-400 dark:border-stone-800 overflow-hidden flex flex-col shadow-2xs"
      >
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-340px)] scrollbar-none flex flex-col">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-zinc-950 text-white font-black text-[10px] tracking-wider uppercase border-b border-zinc-800">
                  <tr>
                    <th className="py-1 px-2 w-10 text-center">ITEM</th>
                    <th className="py-1 px-2.5 w-24">CÓDIGO (F3)</th>
                    <th className="py-1 px-2.5">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                    <th className="py-1 px-1.5 w-12 text-center">UN</th>
                    <th className="py-1 px-2 w-16 text-right">QTDE</th>
                    <th className="py-1 px-2 w-24 text-right">PREÇO UNIT.</th>
                    <th className="py-1 px-1.5 w-16 text-right">% DESC.</th>
                    <th className="py-1 px-2 w-20 text-right">R$ DESC.</th>
                    <th className="py-1 px-2.5 w-24 text-right">TOTAL BRUTO</th>
                    <th className="py-1 px-2.5 w-24 text-right text-amber-300">TOTAL LÍQUIDO</th>
                    <th className="py-1 px-1.5 w-10 text-center">AÇÃO</th>
                  </tr>
                </thead>
              </table>
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-stone-500 font-bold gap-2">
                <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-stone-600 stroke-[1.5]" />
                <span className="text-xs uppercase tracking-wide">CAIXA LIVRE • DIGITE O CÓDIGO OU BUSQUE O PRODUTO PARA INICIAR A VENDA</span>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-zinc-950 text-white font-black text-[10px] tracking-wider uppercase border-b border-zinc-800">
                <tr>
                  <th className="py-1 px-2 w-10 text-center">ITEM</th>
                  <th className="py-1 px-2.5 w-24">CÓDIGO (F3)</th>
                  <th className="py-1 px-2.5">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                  <th className="py-1 px-1.5 w-12 text-center">UN</th>
                  <th className="py-1 px-2 w-16 text-right">QTDE</th>
                  <th className="py-1 px-2 w-24 text-right">PREÇO UNIT.</th>
                  <th className="py-1 px-1.5 w-16 text-right">% DESC.</th>
                  <th className="py-1 px-2 w-20 text-right">R$ DESC.</th>
                  <th className="py-1 px-2.5 w-24 text-right">TOTAL BRUTO</th>
                  <th className="py-1 px-2.5 w-24 text-right text-amber-300">TOTAL LÍQUIDO</th>
                  <th className="py-1 px-1.5 w-10 text-center">AÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 dark:divide-stone-800 font-semibold text-zinc-900 dark:text-stone-100">
                {items.map((it, idx) => (
                  <tr 
                    key={it.id} 
                    className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-sky-100/70 dark:hover:bg-sky-950/40 transition border-b border-slate-200 dark:border-stone-800"
                  >
                    <td className="py-1 px-2 text-center font-mono text-[10px] text-slate-500">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-1 px-2.5 font-mono text-[11px] font-bold text-slate-700 dark:text-stone-300">
                      {it.codigo}
                    </td>
                    <td className="py-1 px-2.5 font-bold text-xs uppercase truncate max-w-[280px]" title={it.descricao}>
                      {it.descricao}
                    </td>
                    <td className="py-1 px-1.5 text-center font-bold text-slate-600 dark:text-stone-400 text-[11px]">
                      {it.unidade}
                    </td>
                    <td className="py-1 px-2 text-right font-black text-xs">
                      {it.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 px-2 text-right font-semibold text-xs">
                      {formatCurrencyBRL(it.precoUnitario)}
                    </td>
                    <td className="py-1 px-1.5 text-right font-medium text-slate-500 text-[11px]">
                      {it.percentualDesconto > 0 ? `${it.percentualDesconto}%` : '-'}
                    </td>
                    <td className="py-1 px-2 text-right font-medium text-slate-500 text-[11px]">
                      {it.valorDesconto > 0 ? formatCurrencyBRL(it.valorDesconto) : '-'}
                    </td>
                    <td className="py-1 px-2.5 text-right font-semibold text-xs text-slate-700 dark:text-stone-300">
                      {formatCurrencyBRL(it.totalBruto)}
                    </td>
                    <td className="py-1 px-2.5 text-right font-black text-xs text-emerald-700 dark:text-emerald-400">
                      {formatCurrencyBRL(it.totalLiquido)}
                    </td>
                    <td className="py-1 px-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoverItem(it.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                        title="Remover item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* =====================================================================
          3. BLOCO INFERIOR DE FECHAMENTO E TOTAIS (CARDS HORIZONTAIS)
         ===================================================================== */}
      <section 
        aria-label="Totais de Fechamento PDV"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 shrink-0"
      >
        {/* TOTAL BRUTO */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            TOTAL BRUTO
          </span>
          <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white font-mono">
            {formatCurrencyBRL(totals.totalBruto)}
          </span>
        </div>

        {/* DESCONTO */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            DESCONTO
          </span>
          <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
            {formatCurrencyBRL(totals.totalDesconto)}
          </span>
        </div>

        {/* TOTAL LÍQUIDO (DESTAQUE AMARELO TEXT-BASE FONT-BOLD) */}
        <div className="bg-amber-300 dark:bg-amber-400 border border-amber-500 rounded-xl px-2.5 py-1 text-left shadow-xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-amber-950">
            TOTAL LÍQUIDO
          </span>
          <span className="text-sm sm:text-base font-black text-amber-950 font-mono tracking-tight leading-tight block">
            {formatCurrencyBRL(totals.totalLiquido)}
          </span>
        </div>

        {/* TOTAL DE ITENS */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            TOTAL DE ITENS
          </span>
          <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-mono">
            {totals.totalItens} <span className="text-[10px] text-slate-500 font-semibold">({totals.totalQuantidade.toFixed(1)} un/kg/ton)</span>
          </span>
        </div>

        {/* TOTAL PAGO */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            TOTAL PAGO
          </span>
          <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {formatCurrencyBRL(totals.valorPago)}
          </span>
        </div>

        {/* TROCO */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            TROCO
          </span>
          <span className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400 font-mono">
            {formatCurrencyBRL(totals.troco)}
          </span>
        </div>
      </section>

      {/* =====================================================================
          4. CONTROLE DE PAGAMENTO INTEGRADO & BOTÕES DE AÇÃO (RODAPÉ)
         ===================================================================== */}
      <section 
        aria-label="Controle de Pagamento Integrado"
        className="p-1.5 sm:p-2 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-xl border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.1)] shrink-0"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
          
          {/* Seletor de Formas de Pagamento Rápidas */}
          <div className="lg:col-span-5 flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mr-1 shrink-0">
              PAGAMENTO:
            </span>
            <button
              type="button"
              onClick={() => setFormaPagamento('a_vista')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                formaPagamento === 'a_vista'
                  ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600'
                  : 'text-zinc-700 dark:text-stone-400 hover:bg-slate-300/60 dark:hover:bg-stone-800/60'
              }`}
            >
              À VISTA
            </button>
            <button
              type="button"
              onClick={() => setFormaPagamento('pix')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                formaPagamento === 'pix'
                  ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600'
                  : 'text-zinc-700 dark:text-stone-400 hover:bg-slate-300/60 dark:hover:bg-stone-800/60'
              }`}
            >
              PIX
            </button>
            <button
              type="button"
              onClick={() => setFormaPagamento('cartao_debito')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                formaPagamento === 'cartao_debito'
                  ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600'
                  : 'text-zinc-700 dark:text-stone-400 hover:bg-slate-300/60 dark:hover:bg-stone-800/60'
              }`}
            >
              DÉBITO
            </button>
            <button
              type="button"
              onClick={() => setFormaPagamento('cartao_credito')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                formaPagamento === 'cartao_credito'
                  ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600'
                  : 'text-zinc-700 dark:text-stone-400 hover:bg-slate-300/60 dark:hover:bg-stone-800/60'
              }`}
            >
              CRÉDITO
            </button>
            <button
              type="button"
              onClick={() => setFormaPagamento('prazo')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                formaPagamento === 'prazo'
                  ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600'
                  : 'text-zinc-700 dark:text-stone-400 hover:bg-slate-300/60 dark:hover:bg-stone-800/60'
              }`}
            >
              A PRAZO
            </button>
          </div>

          {/* Valor Pago pelo Cliente */}
          <div className="lg:col-span-3 flex items-center gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 shrink-0">
              VALOR PAGO (R$):
            </label>
            <input
              type="text"
              value={valorPagoInput}
              onChange={e => setValorPagoInput(e.target.value)}
              placeholder={totals.totalLiquido > 0 ? totals.totalLiquido.toFixed(2).replace('.', ',') : '0,00'}
              className="w-full text-right px-2 py-0.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white font-mono shadow-2xs outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Trio de Botões de Ação do PDV */}
          <div className="lg:col-span-4 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={async () => {
                if (items.length === 0) {
                  handleLimparPdv();
                  return;
                }
                const isConfirmed = await confirmDialog({
                  title: 'Limpar Frente de Caixa',
                  message: 'Deseja realmente cancelar e limpar todos os itens deste cupom de venda?',
                  confirmLabel: 'Limpar Caixa',
                  cancelLabel: 'Manter Itens',
                  variant: 'danger',
                });
                if (isConfirmed) {
                  handleLimparPdv();
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-900 text-slate-700 dark:text-stone-300 border border-slate-400 dark:border-stone-700 hover:bg-slate-300 shadow-2xs transition active:scale-95 cursor-pointer"
              title="Cancelar itens da venda atual"
            >
              <X className="w-3.5 h-3.5 text-rose-500" />
              <span>[F4] LIMPAR</span>
            </button>

            {lastFinishedSale && (
              <button
                type="button"
                onClick={() => {
                  setActivePrintFormat(formatoImpressao);
                  setIsReceiptOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 text-white border border-sky-400 shadow-xs transition active:scale-95 cursor-pointer"
                title="Reimprimir cupom / espelho da última venda"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>[F5] CUPOM</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleFinalizarVenda}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer"
              title="Finalizar e gravar venda no sistema"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>[F2] FINALIZAR VENDA</span>
            </button>
          </div>

        </div>

        {/* Bloco Condição para Pagamento a Prazo (Abre dinamicamente) */}
        {formaPagamento === 'prazo' && (
          <div className="mt-2 pt-2 border-t border-slate-300 dark:border-stone-800 space-y-2 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              {/* 1. PRAZO */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  PRAZO:
                </label>
                <select
                  value={prazoCondicao}
                  onChange={e => setPrazoCondicao(e.target.value)}
                  className="w-full px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="30 DIAS">30 DIAS</option>
                  <option value="30/60 DIAS">30/60 DIAS</option>
                  <option value="30/60/90 DIAS">30/60/90 DIAS</option>
                  <option value="SAFRA (FECHAMENTO)">SAFRA (FECHAMENTO)</option>
                  <option value="PERSONALIZADO">PERSONALIZADO</option>
                </select>
              </div>

              {/* 2. TIPO COBRANÇA * */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  TIPO COBRANÇA *:
                </label>
                <select
                  value={tipoCobranca}
                  onChange={e => setTipoCobranca(e.target.value as 'carteira' | 'boleto')}
                  className="w-full px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="carteira">💳 CARTEIRA (CONTA INTERNA)</option>
                  <option value="boleto">📄 BOLETO BANCÁRIO</option>
                </select>
              </div>

              {/* 3. FORMATO IMPRESSÃO * */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  FORMATO IMPRESSÃO *:
                </label>
                <select
                  value={formatoImpressao}
                  onChange={e => setFormatoImpressao(e.target.value as 'a4' | 'termica')}
                  className="w-full px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="a4">🖨️ FOLHA A4 RETRATO</option>
                  <option value="termica">📟 TÉRMICA 80MM (CUPOM RAPIDO)</option>
                </select>
              </div>

              {/* 4. DATA 1ª PARCELA */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  DATA 1ª PARCELA:
                </label>
                <input
                  type="date"
                  value={dataPrimeiraParcela}
                  onChange={e => setDataPrimeiraParcela(e.target.value)}
                  className="w-full px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white shadow-2xs outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* 5. QTDE/PARCELAS */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  QTDE/PARCELAS:
                </label>
                <select
                  value={qtdeParcelas}
                  onChange={e => setQtdeParcelas(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white shadow-2xs outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value={1}>1x (Parcela Única)</option>
                  <option value={2}>2x Mensais</option>
                  <option value={3}>3x Mensais</option>
                  <option value={4}>4x Mensais</option>
                  <option value={6}>6x Mensais</option>
                  <option value={12}>12x Anual</option>
                </select>
              </div>

              {/* 6. VALOR TOTAL A PRAZO */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  VALOR TOTAL A PRAZO:
                </label>
                <div className="px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-amber-700 dark:text-amber-400 font-mono shadow-2xs">
                  {formatCurrencyBRL(totals.totalLiquido)}
                </div>
              </div>
            </div>

            {/* Micro badge / feedback informativo do banco emissor logo abaixo do seletor de cobrança */}
            {tipoCobranca === 'boleto' && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 text-[10px] text-sky-800 dark:text-sky-300 shadow-2xs animate-in fade-in duration-150">
                <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="font-bold text-slate-500 dark:text-stone-400 uppercase">BANCO EMISSOR DO BOLETO:</span>
                <span className="font-mono text-xs font-black uppercase text-sky-950 dark:text-sky-100">{prioritaryAccount.rawText}</span>
                <span className="ml-auto inline-flex items-center px-1.5 py-0.2 rounded bg-sky-600 text-white text-[9px] font-black uppercase tracking-wider">
                  CONTA PRIORITÁRIA
                </span>
              </div>
            )}

            {/* Tabela Compacta de Parcelas Geradas */}
            {parcelas.length > 0 && (
              <div className="bg-white dark:bg-stone-900 rounded-lg border border-slate-300 dark:border-stone-800 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-stone-800 text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 border-b border-slate-200 dark:border-stone-700">
                    <tr>
                      <th className="py-0.5 px-2">PARCELA</th>
                      <th className="py-0.5 px-2">VENCIMENTO</th>
                      <th className="py-0.5 px-2 text-right">VALOR PARCELA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-stone-800 font-semibold text-[11px]">
                    {parcelas.map(p => (
                      <tr key={p.numero} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
                        <td className="py-0.5 px-2 text-slate-700 dark:text-stone-300">
                          {p.numero}ª Parcela
                        </td>
                        <td className="py-0.5 px-2 text-slate-700 dark:text-stone-300">
                          {formatDateBR(p.vencimento)}
                        </td>
                        <td className="py-0.5 px-2 text-right font-black text-zinc-900 dark:text-white font-mono">
                          {formatCurrencyBRL(p.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* =====================================================================
          5. MODAL DE COMPROVANTE DUPLO • A4 RETRATO & TÉRMICA 80MM (ANTI-SANDBOX)
         ===================================================================== */}
      {isReceiptOpen && lastFinishedSale && (
        <div 
          className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setIsReceiptOpen(false)}
        >
          <div 
            className={`bg-white dark:bg-stone-900 rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xl flex flex-col my-auto transition-all duration-200 overflow-hidden ${
              activePrintFormat === 'a4' ? 'max-w-4xl w-full' : 'max-w-md w-full'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header do Modal com Seletor de Formato */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                  COMPROVANTE DE VENDA • PDV
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-stone-700 text-slate-700 dark:text-stone-300">
                  {lastFinishedSale.orderNumber}
                </span>
              </div>

              {/* Seletor Rápido de Formato (Térmica 80mm vs Folha A4 Retrato) */}
              <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-stone-900 p-0.5 rounded-lg border border-slate-300 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setActivePrintFormat('termica')}
                  className={`px-2.5 py-1 rounded text-[10px] font-black uppercase transition cursor-pointer flex items-center gap-1 ${
                    activePrintFormat === 'termica'
                      ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-stone-400 hover:text-black dark:hover:text-white'
                  }`}
                  title="Formato Bobina Térmica 80mm"
                >
                  <Receipt className="w-3 h-3" />
                  <span>📟 TÉRMICA 80MM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePrintFormat('a4')}
                  className={`px-2.5 py-1 rounded text-[10px] font-black uppercase transition cursor-pointer flex items-center gap-1 ${
                    activePrintFormat === 'a4'
                      ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-stone-400 hover:text-black dark:hover:text-white'
                  }`}
                  title="Formato Folha A4 Retrato"
                >
                  <FileText className="w-3 h-3" />
                  <span>🖨️ FOLHA A4 RETRATO</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-black dark:hover:text-white cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Faixa Informativa Anti-Sandbox */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/60 px-4 py-1.5 flex items-center justify-between text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>PROTEÇÃO ANTI-SANDBOX: Visualização na tela com opções de impressão direta, cópia para WhatsApp/e-mail e download do espelho de venda.</span>
              </span>
              {copiedFeedback && (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-black uppercase animate-in fade-in">
                  <CheckCheck className="w-3.5 h-3.5" />
                  COPIADO COM SUCESSO!
                </span>
              )}
            </div>

            {/* Área de Conteúdo Scrollável */}
            <div className="p-3 sm:p-4 max-h-[75vh] overflow-y-auto bg-slate-100 dark:bg-stone-950">
              {/* =============================================================
                  FORMATO 1: FOLHA A4 RETRATO (ESPELHO DE PEDIDO / NOTA DE VENDA)
                 ============================================================= */}
              {activePrintFormat === 'a4' ? (
                <div id="espelho-a4-imprimivel" className="bg-white text-zinc-900 p-6 sm:p-8 rounded-lg border border-slate-300 shadow-md font-sans text-xs space-y-4">
                  {/* Cabeçalho Formal A4 */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b-2 border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <Tractor className="w-6 h-6 text-emerald-700" />
                        <h2 className="text-base font-black uppercase tracking-tight text-zinc-900">
                          {companyProfile?.name || 'AGROCONTROL • SOLUÇÕES AGRÍCOLAS & FORRAGENS'}
                        </h2>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                        <div>
                          <span className="font-bold">CNPJ/CPF:</span> {companyProfile?.cnpjCpf || companyProfile?.cnpj || '12.345.678/0001-90'}
                          {companyProfile?.stateRegistration && <span className="ml-2"><span className="font-bold">IE:</span> {companyProfile.stateRegistration}</span>}
                        </div>
                        <div>
                          <span className="font-bold">ENDEREÇO:</span> {companyProfile?.address || 'Rodovia BR-163, KM 120'} • {companyProfile?.city || 'Sorriso'} - {companyProfile?.state || 'MT'}
                        </div>
                        <div>
                          <span className="font-bold">CONTATO:</span> {companyProfile?.phone || '(66) 99988-7766'} • {companyProfile?.email || 'contato@agrocontrol.com.br'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-slate-300 sm:pl-4 min-w-[200px]">
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black text-[10px] uppercase tracking-wider mb-1">
                        ESPELHO DE PEDIDO DE BALCÃO
                      </span>
                      <div className="text-lg font-black font-mono text-zinc-900">
                        {lastFinishedSale.orderNumber}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        EMISSÃO: {lastFinishedSale.date} às {lastFinishedSale.time}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        STATUS: <span className="font-bold text-emerald-700 uppercase">FATURADO / CONCLUÍDO</span>
                      </div>
                    </div>
                  </div>

                  {/* Dados do Cliente / Produtor Rural */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="block text-[9px] font-black text-slate-500 uppercase">PRODUTOR / CLIENTE:</span>
                      <span className="font-bold text-zinc-900 uppercase truncate block">
                        {lastFinishedSale.client}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-500 uppercase">FAZENDA / DESTINO:</span>
                      <span className="font-semibold text-zinc-800 uppercase truncate block">
                        {lastFinishedSale.farmName || 'Fazenda do Produtor'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-500 uppercase">FORMA DE PAGAMENTO:</span>
                      <span className="font-bold text-emerald-800 uppercase truncate block">
                        {lastFinishedSale.forma}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-500 uppercase">TIPO COBRANÇA:</span>
                      <span className="font-bold text-sky-800 uppercase truncate block">
                        {lastFinishedSale.tipoCobranca || 'CARTEIRA (CONTA INTERNA)'}
                      </span>
                    </div>
                    {lastFinishedSale.bancoEmissor && (
                      <div className="sm:col-span-4 bg-sky-50 border border-sky-200 rounded px-2 py-1 text-[10px] flex items-center gap-1.5 font-bold text-sky-900">
                        <Building2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                        <span className="uppercase">CONTA EMISSORA DO BOLETO (PRIORITÁRIA):</span>
                        <span className="font-mono font-black">{lastFinishedSale.bancoEmissor}</span>
                      </div>
                    )}
                  </div>

                  {/* Grade de Itens (Tabela Zebrada com Padrão AgroControl) */}
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-200 text-slate-800 text-[10px] font-black uppercase border-b border-slate-300">
                        <tr>
                          <th className="py-1.5 px-2 w-8 text-center">#</th>
                          <th className="py-1.5 px-2 w-20">CÓDIGO</th>
                          <th className="py-1.5 px-2">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                          <th className="py-1.5 px-2 w-14 text-center">UNID</th>
                          <th className="py-1.5 px-2 w-16 text-right">QTDE</th>
                          <th className="py-1.5 px-2 w-24 text-right">VALOR UNIT.</th>
                          <th className="py-1.5 px-2 w-20 text-right">DESC.</th>
                          <th className="py-1.5 px-2 w-28 text-right">TOTAL LÍQUIDO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px] font-medium">
                        {lastFinishedSale.items.map((it, idx) => (
                          <tr key={idx} className="even:bg-[#eaeaea] odd:bg-white hover:bg-slate-100 transition">
                            <td className="py-1 px-2 text-center text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                            <td className="py-1 px-2 font-mono font-bold text-slate-700 text-[10px]">{it.codigo || 'DIV'}</td>
                            <td className="py-1 px-2 font-bold text-zinc-900">{it.descricao}</td>
                            <td className="py-1 px-2 text-center font-bold text-slate-600">{it.unidade}</td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-zinc-900">
                              {it.quantidade.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-slate-700">
                              {formatCurrencyBRL(it.precoUnitario)}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-rose-600">
                              {it.percentualDesconto > 0 ? `${it.percentualDesconto.toFixed(1).replace('.', ',')}%` : '-'}
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-black text-zinc-900">
                              {formatCurrencyBRL(it.totalLiquido)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bloco Inferior: Parcelas & Totais Financeiros */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Programação de Parcelas (se a prazo) */}
                    <div>
                      {lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 ? (
                        <div className="border border-slate-300 rounded-lg overflow-hidden">
                          <div className="bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-700 border-b border-slate-300 flex justify-between items-center">
                            <span>PROGRAMAÇÃO DE PARCELAS A RECEBER</span>
                            <span className="text-emerald-700 font-mono">{lastFinishedSale.parcelas.length}x PARCELAS</span>
                          </div>
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-500 border-b border-slate-200">
                              <tr>
                                <th className="py-1 px-2">PARCELA</th>
                                <th className="py-1 px-2">VENCIMENTO</th>
                                <th className="py-1 px-2 text-right">VALOR (R$)</th>
                                <th className="py-1 px-2 text-center">SITUAÇÃO</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10px]">
                              {lastFinishedSale.parcelas.map(p => (
                                <tr key={p.numero} className="even:bg-slate-50 odd:bg-white">
                                  <td className="py-1 px-2 font-bold text-slate-700">{p.numero}ª Parcela</td>
                                  <td className="py-1 px-2 font-semibold text-slate-700">{formatDateBR(p.vencimento)}</td>
                                  <td className="py-1 px-2 text-right font-mono font-black text-zinc-900">{formatCurrencyBRL(p.valor)}</td>
                                  <td className="py-1 px-2 text-center font-bold text-amber-700 uppercase text-[9px]">A RECEBER</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600">
                          <span className="font-bold block uppercase text-slate-700 mb-1">OBSERVAÇÕES DA OPERAÇÃO:</span>
                          <p>Venda faturada e liquidada integralmente no balcão de atendimento via {lastFinishedSale.forma}.</p>
                        </div>
                      )}
                    </div>

                    {/* Resumo de Fechamento Financeiro */}
                    <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 space-y-1.5 self-start">
                      <div className="flex justify-between text-xs text-slate-700">
                        <span className="font-bold uppercase">SUBTOTAL BRUTO:</span>
                        <span className="font-mono font-bold">{formatCurrencyBRL(lastFinishedSale.totalBruto)}</span>
                      </div>
                      {lastFinishedSale.totalDesconto > 0 && (
                        <div className="flex justify-between text-xs text-rose-600">
                          <span className="font-bold uppercase">DESCONTOS CONCEDIDOS:</span>
                          <span className="font-mono font-bold">-{formatCurrencyBRL(lastFinishedSale.totalDesconto)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-emerald-800 pt-1.5 border-t-2 border-slate-300">
                        <span className="uppercase">TOTAL LÍQUIDO A PAGAR:</span>
                        <span className="font-mono">{formatCurrencyBRL(lastFinishedSale.totalLiquido)}</span>
                      </div>
                      {lastFinishedSale.valorPago > 0 && (
                        <div className="flex justify-between text-xs text-slate-700 pt-1 border-t border-dashed border-slate-200">
                          <span className="font-semibold uppercase">VALOR RECEBIDO:</span>
                          <span className="font-mono font-bold">{formatCurrencyBRL(lastFinishedSale.valorPago)}</span>
                        </div>
                      )}
                      {lastFinishedSale.troco > 0 && (
                        <div className="flex justify-between text-xs text-blue-700">
                          <span className="font-bold uppercase">TROCO DEVOLVIDO:</span>
                          <span className="font-mono font-black">{formatCurrencyBRL(lastFinishedSale.troco)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Termo de Recebimento e Assinaturas */}
                  <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-600 space-y-4">
                    <p className="italic text-center text-slate-500">
                      "Declaro ter conferido e recebido os produtos/serviços acima relacionados em perfeita ordem, concordando com as condições comerciais e datas de vencimento discriminadas neste documento."
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                      <div className="text-center">
                        <div className="border-t border-slate-400 w-4/5 mx-auto mb-1"></div>
                        <span className="font-bold uppercase text-zinc-900 block truncate">{lastFinishedSale.client}</span>
                        <span className="text-[9px] text-slate-500 uppercase">ASSINATURA DO CLIENTE / PRODUTOR</span>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-slate-400 w-4/5 mx-auto mb-1"></div>
                        <span className="font-bold uppercase text-zinc-900 block">{companyProfile?.name || 'AGROCONTROL'}</span>
                        <span className="text-[9px] text-slate-500 uppercase">RESPONSÁVEL PELO CAIXA / EMISSOR</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* =============================================================
                   FORMATO 2: TÉRMICA 80MM (CUPOM RÁPIDO NÃO FISCAL)
                   ============================================================= */
                <div id="cupom-pdv-imprimivel" className="w-full max-w-[340px] mx-auto bg-white text-zinc-900 p-4 rounded-lg border border-slate-300 shadow-md font-mono text-[11px] space-y-2">
                  <div className="text-center pb-2 border-b border-dashed border-slate-400">
                    <div className="font-black text-xs uppercase">{companyProfile?.name || 'AGROCONTROL SILAGEM'}</div>
                    <div className="text-[10px] text-slate-600">{companyProfile?.cnpjCpf || companyProfile?.cnpj ? `CNPJ/CPF: ${companyProfile.cnpjCpf || companyProfile.cnpj}` : 'SISTEMA DE VENDAS AGRÍCOLAS'}</div>
                    <div className="text-[10px] text-slate-600">{lastFinishedSale.date} às {lastFinishedSale.time}</div>
                    <div className="text-[11px] font-black mt-1 uppercase text-zinc-900">
                      CUPOM: {lastFinishedSale.orderNumber}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">CLIENTE:</span>
                    <div className="font-bold truncate uppercase">{lastFinishedSale.client}</div>
                    {lastFinishedSale.farmName && (
                      <div className="text-[10px] text-slate-600 truncate uppercase">{lastFinishedSale.farmName}</div>
                    )}
                  </div>

                  <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1">
                    <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase">
                      <span>ITEM / QTD x UN</span>
                      <span>TOTAL</span>
                    </div>
                    {lastFinishedSale.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-[10.5px] leading-tight">
                        <span className="truncate pr-1">
                          {it.quantidade.toFixed(1).replace('.', ',')}x {it.descricao}
                        </span>
                        <span className="font-bold shrink-0">{formatCurrencyBRL(it.totalLiquido)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-0.5 text-xs pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-bold">SUBTOTAL:</span>
                      <span className="font-mono font-bold">{formatCurrencyBRL(lastFinishedSale.totalBruto)}</span>
                    </div>
                    {lastFinishedSale.totalDesconto > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span className="font-bold">DESCONTOS:</span>
                        <span className="font-mono font-bold">-{formatCurrencyBRL(lastFinishedSale.totalDesconto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm text-emerald-800 pt-1 border-t border-slate-300">
                      <span>TOTAL LÍQUIDO:</span>
                      <span>{formatCurrencyBRL(lastFinishedSale.totalLiquido)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-700 pt-1">
                      <span className="font-bold">PAGAMENTO:</span>
                      <span className="font-black uppercase text-right">{lastFinishedSale.forma}</span>
                    </div>
                    {lastFinishedSale.bancoEmissor && (
                      <div className="text-[9.5px] text-sky-800 font-bold pt-0.5">
                        BANCO: {lastFinishedSale.bancoEmissor}
                      </div>
                    )}
                    {lastFinishedSale.troco > 0 && (
                      <div className="flex justify-between text-[10px] text-blue-700">
                        <span className="font-bold">TROCO:</span>
                        <span className="font-bold">{formatCurrencyBRL(lastFinishedSale.troco)}</span>
                      </div>
                    )}
                  </div>

                  {lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 && (
                    <div className="border-t border-dashed border-slate-400 pt-1.5 text-[10px] space-y-0.5">
                      <span className="font-black text-slate-600 uppercase block">PARCELAS A RECEBER:</span>
                      {lastFinishedSale.parcelas.map(p => (
                        <div key={p.numero} className="flex justify-between">
                          <span>{p.numero}ª ({formatDateBR(p.vencimento)}):</span>
                          <span className="font-bold">{formatCurrencyBRL(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-center pt-2 text-[9px] text-slate-500 uppercase border-t border-dashed border-slate-400">
                    OBRIGADO PELA PREFERÊNCIA • VOLTE SEMPRE!
                  </div>
                </div>
              )}
            </div>

            {/* Ações do Modal com Suporte Anti-Sandbox */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-stone-850 border-t border-slate-300 dark:border-stone-700 rounded-b-xl">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyComprovante}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700 transition cursor-pointer shadow-2xs"
                  title="Copiar dados do comprovante para enviar no WhatsApp ou e-mail"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{copiedFeedback ? 'COPIADO!' : 'COPIAR DADOS'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadComprovante}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700 transition cursor-pointer shadow-2xs"
                  title="Baixar espelho ou cupom de venda em arquivo texto"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>BAIXAR ARQUIVO</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  FECHAR
                </button>
                <button
                  type="button"
                  onClick={handlePrintSafe}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-black dark:bg-stone-100 dark:text-zinc-900 dark:hover:bg-white transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>IMPRIMIR {activePrintFormat === 'a4' ? 'ESPELHO A4' : 'CUPOM 80MM'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          6. MODAL DE AUTORIZAÇÃO DE DESCONTO MASTER (PADRÃO OURO)
         ===================================================================== */}
      {isMasterAuthModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => {
            setIsMasterAuthModalOpen(false);
            setMasterAuthError('');
            setMasterPasswordInput('');
          }}
        >
          <div 
            className="bg-white dark:bg-stone-900 border-2 border-amber-500/90 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden select-none animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho Dourado Padrão Ouro */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 px-3.5 py-2.5 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-100" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  🔑 AUTORIZAÇÃO DE DESCONTO MASTER
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMasterAuthModalOpen(false);
                  setMasterAuthError('');
                  setMasterPasswordInput('');
                }}
                className="p-1 hover:bg-black/20 rounded transition text-amber-100 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário de Autorização */}
            <form onSubmit={handleConfirmMasterAuth} className="p-3.5 space-y-3">
              {/* Quadro Informativo de Alçadas */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg p-2.5 text-[11px] space-y-1">
                <div className="flex justify-between items-center text-slate-700 dark:text-stone-300">
                  <span className="font-bold text-[10px] uppercase text-slate-500 dark:text-stone-400">ITEM:</span>
                  <span className="font-black truncate max-w-[200px] text-right uppercase">
                    {(inputDescricao || inputBusca || 'PRODUTO SELECIONADO').trim()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[10px] uppercase text-slate-500 dark:text-stone-400">DESCONTO SOLICITADO:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={attemptedDiscount > 0 ? attemptedDiscount : parseFloat(inputDesconto.replace(',', '.')) || maxDiscountAllowed}
                      onChange={e => setAttemptedDiscount(parseFloat(e.target.value) || 0)}
                      className="w-16 px-1 py-0.5 text-right font-black text-rose-600 dark:text-rose-400 text-xs border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-stone-800"
                    />
                    <span className="font-black text-rose-600 dark:text-rose-400 text-xs">%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-semibold text-slate-500 dark:text-stone-400 uppercase">TETO PERMITIDO ({roleBadgeLabel}):</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {maxDiscountAllowed.toFixed(2).replace('.', ',')}%
                  </span>
                </div>
              </div>

              {/* Input da Senha do Administrador */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-stone-300 tracking-wider mb-1 flex items-center justify-between">
                  <span>SENHA DO ADMINISTRADOR</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    autoFocus
                    value={masterPasswordInput}
                    onChange={e => {
                      setMasterPasswordInput(e.target.value);
                      if (masterAuthError) setMasterAuthError('');
                    }}
                    placeholder="DIGITE A SENHA DO ADMINISTRADOR..."
                    className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-amber-400 dark:border-amber-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(prev => !prev)}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 cursor-pointer p-0.5"
                    title={showMasterPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showMasterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {masterAuthError && (
                  <p className="mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase animate-in fade-in">
                    * {masterAuthError}
                  </p>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsMasterAuthModalOpen(false);
                    setMasterAuthError('');
                    setMasterPasswordInput('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-extrabold uppercase shadow-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>AUTORIZAR E INSERIR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
