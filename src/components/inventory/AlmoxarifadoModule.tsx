import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { executePrint } from '../../lib/printService';
import {
  Wrench,
  PackageMinus,
  ClipboardCheck,
  Briefcase,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Trash2,
  Pencil,
  RefreshCw,
  Calendar,
  User,
  Car,
  Package,
  FileText,
  X,
  Check,
  ArrowLeftRight,
  ShieldAlert,
  Sparkles,
  Clock,
  Settings,
  Lock,
  Unlock,
  ListPlus,
  ChevronDown,
  ChevronRight,
  ChevronUp
} from 'lucide-react';
import {
  InventoryItem,
  Machinery,
  Employee,
  CompanyProfile,
  RetiradaPecaRecord,
  MovimentacaoFerramentaRecord,
  CaixaFerramentaVeiculoRecord
} from '../../types';
import {
  fetchRetiradasPecas,
  registrarRetiradaPeca,
  registrarPedidoRetiradaPecasLote,
  atualizarStatusLoteRetiradaPecas,
  atualizarRetiradaPeca,
  deleteRetiradaPeca,
  fetchSaldoRealProdutoEstoque,
  fetchMovimentacoesFerramentas,
  registrarRetiradaFerramenta,
  registrarDevolucaoFerramenta,
  deleteMovimentacaoFerramenta,
  fetchCaixaFerramentasVeiculo,
  upsertItemCaixaFerramentaVeiculo,
  realizarConferenciaCaixaVeiculo,
  deleteItemCaixaFerramentaVeiculo,
  fetchGestaoFrotas,
  fetchEstoque,
  fetchEnderecosReaisProdutosEstoque,
  resolverEnderecoProdutoEstoque,
  toValidUUID,
  subscribeToCloudTable
} from '../../lib/supabaseService';
import { ensureDieselProductsInInventory } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';

interface AlmoxarifadoModuleProps {
  inventory: InventoryItem[];
  machineries: Machinery[];
  employees: Employee[];
  companyProfile?: CompanyProfile;
  onSaveInventory: (inventory: InventoryItem[]) => void;
  onSaveMachineries?: (machineries: Machinery[]) => void;
  onNavigateToEstoque?: () => void;
  onLaunchBatchToMaintenanceOS?: (payload: {
    loteId: string;
    veiculo: Machinery;
    items: RetiradaPecaRecord[];
  }) => void;
}

interface CupomLotePrintData {
  loteId: string;
  veiculoNome: string;
  veiculoPlaca: string;
  operadorAlmoxarifado: string;
  retiradoPor: string;
  dataRetirada: string;
  status: string;
  items: RetiradaPecaRecord[];
}

interface CestaPecaVeiculoItem {
  produto_id: string;
  produto_nome: string;
  produto_codigo: string;
  produto_unidade: string;
  quantidade: number;
  saldo_estoque: number;
  produto?: InventoryItem;
}

type AlmoxTab = 'retirada_pecas' | 'cautela_ferramentas' | 'caixa_veiculo';

function toLocalDatetimeInputValue(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTimePtBr(isoOrDate?: string | null): string {
  if (!isoOrDate) return '—';
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoOrDate;
  }
}

function formatDateOnlyPtBr(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

const KIT_PADRAO_VEICULO = [
  { codigo: 'CX-001', nome: 'Macaco Hidráulico', qtd: 1 },
  { codigo: 'CX-002', nome: 'Chave de Roda Cruz / Cabo de Força', qtd: 1 },
  { codigo: 'CX-003', nome: 'Triângulo de Sinalização', qtd: 1 },
  { codigo: 'CX-004', nome: 'Jogo de Chaves Combinadas (8 a 24mm)', qtd: 1 },
  { codigo: 'CX-005', nome: 'Alicate Universal 8"', qtd: 1 },
  { codigo: 'CX-006', nome: 'Chave de Fenda e Phillips (Par)', qtd: 2 },
  { codigo: 'CX-007', nome: 'Cinta / Catraca de Amarração', qtd: 2 },
];

export const AlmoxarifadoModule: React.FC<AlmoxarifadoModuleProps> = ({
  inventory,
  machineries,
  employees,
  companyProfile,
  onSaveInventory,
  onSaveMachineries,
  onNavigateToEstoque,
  onLaunchBatchToMaintenanceOS,
}) => {
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<AlmoxTab>('retirada_pecas');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner(prev => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  // Listas sincronizadas com o Supabase
  const [retiradasPecas, setRetiradasPecas] = useState<RetiradaPecaRecord[]>([]);
  const [movimentacoesFerramentas, setMovimentacoesFerramentas] = useState<MovimentacaoFerramentaRecord[]>([]);
  const [caixaFerramentasAll, setCaixaFerramentasAll] = useState<CaixaFerramentaVeiculoRecord[]>([]);
  const [localStockItems, setLocalStockItems] = useState<InventoryItem[]>(() =>
    ensureDieselProductsInInventory(inventory)
  );
  const [localFrotasItems, setLocalFrotasItems] = useState<Machinery[]>(() => machineries);

  useEffect(() => {
    if (Array.isArray(inventory) && inventory.length > 0) {
      setLocalStockItems(ensureDieselProductsInInventory(inventory));
    }
  }, [inventory]);

  useEffect(() => {
    if (Array.isArray(machineries) && machineries.length > 0) {
      setLocalFrotasItems(machineries);
    }
  }, [machineries]);

  // Produtos e Frotas disponíveis
  const allProducts = useMemo(() => {
    return ensureDieselProductsInInventory(localStockItems.length > 0 ? localStockItems : inventory);
  }, [localStockItems, inventory]);

  const frotasList = useMemo(() => {
    return localFrotasItems.length > 0 ? localFrotasItems : machineries;
  }, [localFrotasItems, machineries]);

  const employeeNames = useMemo(() => {
    const names = employees
      .map(e => (e.name || (e as any).nome || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  // =========================================================================
  // CARGA REATIVA DE DADOS DO SUPABASE (SEM LOOP DE RE-RENDER / ZERO HTTP 400)
  // =========================================================================
  const loadAlmoxarifadoData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [retList, movList, cxList, freshStock, freshFrotas] = await Promise.all([
        fetchRetiradasPecas(),
        fetchMovimentacoesFerramentas(),
        fetchCaixaFerramentasVeiculo(),
        fetchEstoque(),
        fetchGestaoFrotas(),
      ]);

      setRetiradasPecas(retList);
      setMovimentacoesFerramentas(movList);
      setCaixaFerramentasAll(cxList);

      if (freshStock && freshStock.length > 0) {
        setLocalStockItems(ensureDieselProductsInInventory(freshStock));
      }
      if (freshFrotas && freshFrotas.length > 0) {
        setLocalFrotasItems(freshFrotas);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do Almoxarifado:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlmoxarifadoData();

    const unsub1 = subscribeToCloudTable('retiradas_pecas', () => {
      fetchRetiradasPecas().then(setRetiradasPecas);
    });
    const unsub2 = subscribeToCloudTable('movimentacao_ferramentas', () => {
      fetchMovimentacoesFerramentas().then(setMovimentacoesFerramentas);
    });
    const unsub3 = subscribeToCloudTable('caixa_ferramentas_veiculo', () => {
      fetchCaixaFerramentasVeiculo().then(setCaixaFerramentasAll);
    });
    const unsub4 = subscribeToCloudTable('estoque_produtos', () => {
      fetchEstoque().then(fresh => {
        if (fresh && fresh.length > 0) {
          setLocalStockItems(ensureDieselProductsInInventory(fresh));
        }
      });
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [loadAlmoxarifadoData]);

  // =========================================================================
  // ESTADOS DA ABA 1: PEDIDO / LISTA DE PEÇAS POR VEÍCULO (REGRA HÍBRIDA)
  // =========================================================================
  const [pecaVeiculoId, setPecaVeiculoId] = useState<string>('');
  const [isVeiculoFixado, setIsVeiculoFixado] = useState<boolean>(false);
  const [cestaPecasVeiculo, setCestaPecasVeiculo] = useState<CestaPecaVeiculoItem[]>([]);
  const [pecaProdutoId, setPecaProdutoId] = useState<string>('');
  const [pecaComboSearch, setPecaComboSearch] = useState<string>('');
  const [isPecaComboOpen, setIsPecaComboOpen] = useState<boolean>(false);
  const pecaComboContainerRef = useRef<HTMLDivElement | null>(null);
  const [pecaQuantidade, setPecaQuantidade] = useState<string>('1');
  const [pecaOperadorAlmox, setPecaOperadorAlmox] = useState<string>('');
  const [pecaRetiradoPor, setPecaRetiradoPor] = useState<string>('');
  const [pecaDataRetirada, setPecaDataRetirada] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [pecaSearchFilter, setPecaSearchFilter] = useState<string>('');
  const [isSavingRetiradaPeca, setIsSavingRetiradaPeca] = useState<boolean>(false);
  const [saldoRealDbSelecionado, setSaldoRealDbSelecionado] = useState<number | null>(null);

  // Estado de Edição de Retirada de Peça Individual ou Lote Completo (Botão Lápis)
  const [editingRetiradaPeca, setEditingRetiradaPeca] = useState<RetiradaPecaRecord | null>(null);
  const [editingLoteKey, setEditingLoteKey] = useState<string | null>(null);

  // Estado de Pedidos / Lotes Expandidos no Histórico (Accordion / Collapsible)
  const [expandedLotes, setExpandedLotes] = useState<Record<string, boolean>>({});

  // Estado de Impressão de Cupom de Retirada / Cautela em Lote
  const [cupomLotePrint, setCupomLotePrint] = useState<CupomLotePrintData | null>(null);

  // Fecha o dropdown pesquisável de peças ao clicar fora
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (
        pecaComboContainerRef.current &&
        !pecaComboContainerRef.current.contains(ev.target as Node)
      ) {
        setIsPecaComboOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lê estritamente o ID do produto selecionado na tabela 'public.estoque_produtos' sem filtros inválidos
  useEffect(() => {
    let active = true;
    if (!pecaProdutoId || !pecaProdutoId.trim()) {
      setSaldoRealDbSelecionado(null);
      return;
    }
    fetchSaldoRealProdutoEstoque(pecaProdutoId).then(saldo => {
      if (active && saldo !== null) {
        setSaldoRealDbSelecionado(saldo);
      }
    });
    return () => {
      active = false;
    };
  }, [pecaProdutoId]);

  const selectedProductForWithdrawal = useMemo(() => {
    if (!pecaProdutoId) return null;
    return (
      allProducts.find(
        p => p.id === pecaProdutoId || toValidUUID(p.id) === toValidUUID(pecaProdutoId)
      ) || null
    );
  }, [allProducts, pecaProdutoId]);

  // Filtro reativo do Combobox de Peças por Nome, Código Interno, Referência ou Código de Barras
  const filteredEstoqueComboItems = useMemo(() => {
    const q = String(pecaComboSearch || '').toLowerCase().trim();
    if (!q) return allProducts;
    return allProducts.filter(item => {
      const anyItem = item as any;
      const nome = String(
        item.nome_comercial || item.name || anyItem.nome || anyItem.descricao || ''
      ).toLowerCase();
      const codigoInterno = String(
        item.code ?? item.codigo_produto ?? anyItem.codigo_interno ?? anyItem.codigo ?? ''
      ).toLowerCase();
      const codigoFabrica = String(
        anyItem.codigo_fabrica ??
          anyItem.ref_fabrica ??
          anyItem.factoryRef ??
          anyItem.referencia_fabrica ??
          ''
      ).toLowerCase();
      const codigoBarras = String(
        anyItem.codigo_barras ?? anyItem.barcode ?? anyItem.gtin ?? ''
      ).toLowerCase();

      return (
        nome.includes(q) ||
        codigoInterno.includes(q) ||
        codigoFabrica.includes(q) ||
        codigoBarras.includes(q)
      );
    });
  }, [allProducts, pecaComboSearch]);

  const handleSelectProductFromCombobox = (item: InventoryItem) => {
    const anyItem = item as any;
    const codigo = item.code ?? item.codigo_produto ?? anyItem.codigo_interno ?? '';
    const prefix = codigo !== '' ? `[${codigo}] ` : '';
    const nome = item.nome_comercial || item.name || 'Peça';
    setPecaProdutoId(item.id);
    setPecaComboSearch(`${prefix}${nome}`);
    setIsPecaComboOpen(false);
  };

  const handleClearProductCombobox = () => {
    setPecaProdutoId('');
    setPecaComboSearch('');
    setIsPecaComboOpen(true);
  };

  const selectedVehicleForWithdrawal = useMemo(() => {
    if (!pecaVeiculoId) return undefined;
    return frotasList.find(
      m => m.id === pecaVeiculoId || toValidUUID(m.id) === toValidUUID(pecaVeiculoId)
    );
  }, [frotasList, pecaVeiculoId]);

  const saldoAtualProdutoSelecionado = useMemo(() => {
    if (saldoRealDbSelecionado !== null) return saldoRealDbSelecionado;
    if (!selectedProductForWithdrawal) return 0;
    return Number(
      selectedProductForWithdrawal.quantidade_atual ?? selectedProductForWithdrawal.quantity ?? 0
    );
  }, [selectedProductForWithdrawal, saldoRealDbSelecionado]);

  const qtdRetiradaNumerica = useMemo(() => {
    const parsed = parseFloat(String(pecaQuantidade).replace(',', '.'));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [pecaQuantidade]);

  const handleSelecionarVeiculoPedido = (vehId: string) => {
    setPecaVeiculoId(vehId);
    if (vehId) {
      setIsVeiculoFixado(true);
    } else {
      setIsVeiculoFixado(false);
    }
  };

  const handleAdicionarPecaNaCesta = () => {
    if (!pecaVeiculoId) {
      showFeedback('error', 'Selecione primeiro o Veículo / Máquina (Frota) para iniciar o pedido.');
      return;
    }
    if (!pecaProdutoId || !selectedProductForWithdrawal) {
      showFeedback('error', 'Pesquise e selecione uma peça do estoque para adicionar à lista.');
      return;
    }
    if (qtdRetiradaNumerica <= 0) {
      showFeedback('error', 'Informe uma quantidade maior que zero.');
      return;
    }

    const prodNome = String(
      selectedProductForWithdrawal.nome_comercial || selectedProductForWithdrawal.name || 'Peça'
    );
    const prodCodigo = String(
      selectedProductForWithdrawal.code ?? selectedProductForWithdrawal.codigo_produto ?? ''
    );
    const prodUnidade = String(
      selectedProductForWithdrawal.unidade_medida || selectedProductForWithdrawal.unit || 'UN'
    );

    setCestaPecasVeiculo(prev => {
      const existingIdx = prev.findIndex(i => i.produto_id === selectedProductForWithdrawal.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantidade: Number((updated[existingIdx].quantidade + qtdRetiradaNumerica).toFixed(3)),
        };
        return updated;
      }
      return [
        ...prev,
        {
          produto_id: selectedProductForWithdrawal.id,
          produto_nome: prodNome,
          produto_codigo: prodCodigo,
          produto_unidade: prodUnidade,
          quantidade: qtdRetiradaNumerica,
          saldo_estoque: saldoAtualProdutoSelecionado,
          produto: selectedProductForWithdrawal,
        },
      ];
    });

    setIsVeiculoFixado(true);
    setPecaProdutoId('');
    setPecaComboSearch('');
    setIsPecaComboOpen(false);
    setPecaQuantidade('1');
  };

  const handleAjustarQuantidadeCesta = (produtoId: string, novaQtd: number) => {
    if (isNaN(novaQtd) || novaQtd <= 0) return;
    setCestaPecasVeiculo(prev =>
      prev.map(item =>
        item.produto_id === produtoId
          ? { ...item, quantidade: Number(novaQtd.toFixed(3)) }
          : item
      )
    );
  };

  const handleRemoverItemDaCesta = (produtoId: string) => {
    setCestaPecasVeiculo(prev => prev.filter(item => item.produto_id !== produtoId));
  };

  const handleLimparCestaPedido = () => {
    setCestaPecasVeiculo([]);
    setPecaProdutoId('');
    setPecaComboSearch('');
    setIsPecaComboOpen(false);
    setPecaQuantidade('1');
    setEditingLoteKey(null);
  };

  const handleIniciarEdicaoRetirada = (item: RetiradaPecaRecord) => {
    setEditingLoteKey(null);
    setEditingRetiradaPeca(item);
    const matchedVeh = frotasList.find(
      m =>
        m.id === item.veiculo_id ||
        (item.veiculo_id && toValidUUID(m.id) === toValidUUID(item.veiculo_id)) ||
        (item.veiculo_nome && String(m.name || '').toLowerCase() === String(item.veiculo_nome || '').toLowerCase())
    );
    const matchedProd = allProducts.find(
      p =>
        p.id === item.produto_id ||
        (item.produto_id && toValidUUID(p.id) === toValidUUID(item.produto_id)) ||
        (item.produto_nome &&
          String(p.nome_comercial || p.name || '').toLowerCase() === String(item.produto_nome || '').toLowerCase())
    );

    setPecaVeiculoId(matchedVeh?.id || item.veiculo_id || '');
    setIsVeiculoFixado(true);
    setPecaProdutoId(matchedProd?.id || item.produto_id || '');
    const codigo = matchedProd?.code ?? matchedProd?.codigo_produto ?? item.produto_codigo ?? '';
    const prefix = codigo !== '' ? `[${codigo}] ` : '';
    setPecaComboSearch(`${prefix}${matchedProd?.nome_comercial || matchedProd?.name || item.produto_nome || ''}`);
    setPecaQuantidade(String(item.quantidade || 1));
    setPecaOperadorAlmox(item.operador_almoxarifado || '');
    setPecaRetiradoPor(item.retirado_por || '');
    setPecaDataRetirada(
      item.data_retirada
        ? String(item.data_retirada).split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
  };

  const handleIniciarEdicaoLote = (loteKey: string, items: RetiradaPecaRecord[]) => {
    if (!items || items.length === 0) return;
    const first = items[0];
    setEditingRetiradaPeca(null);
    setEditingLoteKey(loteKey);

    const matchedVeh = frotasList.find(
      m =>
        m.id === first.veiculo_id ||
        (first.veiculo_id && toValidUUID(m.id) === toValidUUID(first.veiculo_id)) ||
        (first.veiculo_nome &&
          String(m.name || '').toLowerCase() === String(first.veiculo_nome || '').toLowerCase())
    );

    setPecaVeiculoId(matchedVeh?.id || first.veiculo_id || '');
    setIsVeiculoFixado(true);
    setPecaOperadorAlmox(first.operador_almoxarifado || '');
    setPecaRetiradoPor(first.retirado_por || '');
    setPecaDataRetirada(
      first.data_retirada
        ? String(first.data_retirada).split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setPecaProdutoId('');
    setPecaComboSearch('');
    setPecaQuantidade('1');

    const mappedBasket: CestaPecaVeiculoItem[] = items.map(rec => {
      const matchedProd = allProducts.find(
        p =>
          p.id === rec.produto_id ||
          (rec.produto_id && toValidUUID(p.id) === toValidUUID(rec.produto_id)) ||
          (rec.produto_nome &&
            String(p.nome_comercial || p.name || '').toLowerCase() ===
              String(rec.produto_nome || '').toLowerCase())
      );
      const saldo = Number(matchedProd?.quantidade_atual ?? matchedProd?.quantity ?? 0);
      return {
        produto_id: matchedProd?.id || rec.produto_id || rec.id,
        produto_nome:
          matchedProd?.nome_comercial || matchedProd?.name || rec.produto_nome || 'Peça do Estoque',
        produto_codigo: String(
          matchedProd?.code ?? matchedProd?.codigo_produto ?? rec.produto_codigo ?? ''
        ),
        produto_unidade: String(
          matchedProd?.unidade_medida || matchedProd?.unit || rec.produto_unidade || 'UN'
        ),
        quantidade: Number(rec.quantidade) || 1,
        saldo_estoque: saldo,
        produto: matchedProd,
      };
    });

    setCestaPecasVeiculo(mappedBasket);
    showFeedback(
      'success',
      `Pedido ${loteKey} carregado na cesta à esquerda (${mappedBasket.length} peça(s)). Ajuste os itens e clique em Salvar!`
    );
  };

  const handleCancelarEdicaoRetirada = () => {
    setEditingRetiradaPeca(null);
    setEditingLoteKey(null);
    setCestaPecasVeiculo([]);
    setPecaProdutoId('');
    setPecaComboSearch('');
    setIsPecaComboOpen(false);
    setPecaQuantidade('1');
    setPecaDataRetirada(new Date().toISOString().split('T')[0]);
  };

  // Cruza os itens do lote com 'public.estoque_produtos' (endereço físico) e ordena sequencialmente por Rota de Coleta (Setor -> Rua -> Estante -> Nível -> Box)
  const enrichAndSortItemsByPickingRoute = useCallback(
    (
      rawItems: RetiradaPecaRecord[],
      realtimeDbMap?: Record<
        string,
        {
          endereco_formatado: string;
          estoque_setor: string;
          estoque_rua: string;
          estoque_estante: string;
          estoque_nivel: string;
          estoque_box: string;
        }
      >
    ): RetiradaPecaRecord[] => {
      const enriched = rawItems.map(it => {
        const prodId = String(it.produto_id || '').trim();
        const validProdUuid = prodId ? toValidUUID(prodId) : '';
        const matchedProd = allProducts.find(
          p =>
            p.id === prodId ||
            (validProdUuid && toValidUUID(p.id) === validProdUuid) ||
            (it.produto_codigo &&
              String(p.code ?? p.codigo_produto ?? '').trim() ===
                String(it.produto_codigo).trim())
        );

        const fromRealtime =
          (realtimeDbMap &&
            ((prodId && realtimeDbMap[prodId]) ||
              (validProdUuid && realtimeDbMap[validProdUuid]))) ||
          null;

        const resolvedAddr = fromRealtime
          ? resolverEnderecoProdutoEstoque(fromRealtime as any, matchedProd as any)
          : resolverEnderecoProdutoEstoque(matchedProd, it);

        return {
          ...it,
          endereco_formatado:
            resolvedAddr.endereco_formatado || it.endereco_formatado || '',
          estoque_setor: resolvedAddr.estoque_setor || it.estoque_setor || '',
          estoque_rua: resolvedAddr.estoque_rua || it.estoque_rua || '',
          estoque_estante: resolvedAddr.estoque_estante || it.estoque_estante || '',
          estoque_nivel: resolvedAddr.estoque_nivel || it.estoque_nivel || '',
          estoque_box: resolvedAddr.estoque_box || it.estoque_box || '',
        };
      });

      const cmpNum = (a: string, b: string) =>
        String(a || '').localeCompare(String(b || ''), 'pt-BR', {
          numeric: true,
          sensitivity: 'base',
        });

      return [...enriched].sort((a, b) => {
        const addrA = String(a.endereco_formatado || '').trim();
        const addrB = String(b.endereco_formatado || '').trim();
        const hasA = Boolean(addrA && addrA !== '—');
        const hasB = Boolean(addrB && addrB !== '—');

        // Peças com endereço físico cadastrado vêm primeiro na rota de caminhada
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;

        if (hasA && hasB) {
          const cSetor = cmpNum(a.estoque_setor || '', b.estoque_setor || '');
          if (cSetor !== 0) return cSetor;

          const cRua = cmpNum(a.estoque_rua || '', b.estoque_rua || '');
          if (cRua !== 0) return cRua;

          const cEstante = cmpNum(a.estoque_estante || '', b.estoque_estante || '');
          if (cEstante !== 0) return cEstante;

          const cNivel = cmpNum(a.estoque_nivel || '', b.estoque_nivel || '');
          if (cNivel !== 0) return cNivel;

          const cBox = cmpNum(a.estoque_box || '', b.estoque_box || '');
          if (cBox !== 0) return cBox;

          const cFull = cmpNum(addrA, addrB);
          if (cFull !== 0) return cFull;
        }

        return cmpNum(a.produto_nome || '', b.produto_nome || '');
      });
    },
    [allProducts]
  );

  // Gera o HTML autônomo e limpo do Cupom de Retirada / Lista de Separação para o Almoxarifado (A4)
  const buildCupomLoteStandaloneHtml = useCallback(
    (data: CupomLotePrintData) => {
      const sortedItems = enrichAndSortItemsByPickingRoute(data.items || []);
      const companyHeader = companyProfile?.tradeName
        ? `<p style="font-size:10pt;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#52525b;margin:0 0 4px 0;">${companyProfile.tradeName}${companyProfile.cnpj ? ` • CNPJ: ${companyProfile.cnpj}` : ''}</p>`
        : '';
      const veiculoLine = `${data.veiculoNome}${data.veiculoPlaca ? ` — PLACA: ${data.veiculoPlaca}` : ''}`;
      const dataFormatada = formatDateOnlyPtBr(data.dataRetirada);
      const rowsHtml = sortedItems
        .map((it, idx) => {
          const enderecoDisplay = String(it.endereco_formatado || '').trim();
          let addressSegments: string[] = [];
          if (enderecoDisplay && enderecoDisplay.includes('.')) {
            addressSegments = enderecoDisplay.split('.').map(s => s.trim());
          } else if (it.estoque_setor || it.estoque_rua || it.estoque_estante || it.estoque_nivel || it.estoque_box) {
            addressSegments = [
              it.estoque_setor || '00',
              it.estoque_rua || '00',
              it.estoque_estante || '00',
              it.estoque_nivel || '00',
              it.estoque_box || '00',
            ];
          }
          const isStructured = addressSegments.length >= 2;
          const LABELS = ['SETOR', 'RUA', 'EST.', 'NÍV.', 'BOX'];

          let locCellHtml = '';
          if (!enderecoDisplay && addressSegments.length === 0) {
            locCellHtml = `<span style="font-family:monospace;font-size:6.5pt;font-weight:500;color:#71717a;">NÃO ENDEREÇADO</span>`;
          } else if (isStructured) {
            const columnsHtml = addressSegments
              .map((seg, sIdx) => {
                const label = LABELS[sIdx] || `P${sIdx + 1}`;
                const col = `<div style="display:flex;flex-direction:column;align-items:center;min-width:13px;"><span style="font-family:monospace;font-weight:700;font-size:7.5pt;line-height:1;color:#000000;">${seg.trim()}</span><span style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:4.6pt;font-weight:700;color:#27272a;text-transform:uppercase;line-height:1;margin-top:1.5px;letter-spacing:-0.2px;">${label}</span></div>`;
                if (sIdx > 0) {
                  const sep = `<div style="display:flex;flex-direction:column;align-items:center;padding:0 0.8px;"><span style="font-family:monospace;font-weight:700;font-size:7.5pt;line-height:1;color:#000000;">.</span><span style="font-size:4.6pt;line-height:1;margin-top:1.5px;visibility:hidden;">.</span></div>`;
                  return `${sep}${col}`;
                }
                return col;
              })
              .join('');

            locCellHtml = `<div style="display:inline-flex;align-items:flex-start;justify-content:center;padding:1.5px 3.5px;border:1px solid #000000;border-radius:3px;background:#fef3c7;box-sizing:border-box;max-width:100%;">${columnsHtml}</div>`;
          } else {
            locCellHtml = `<div style="display:inline-block;max-width:100%;box-sizing:border-box;padding:2px 5px;border:1px solid #000000;border-radius:3px;background:#fef3c7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-weight:600;font-size:6.5pt;color:#000000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;">${enderecoDisplay}</div>`;
          }

          return `
          <tr style="border-bottom:1px solid #d4d4d8;">
            <td style="padding:2.5px 4px;text-align:center;font-family:monospace;font-weight:500;font-size:7.5pt;border-right:1px solid #000000;line-height:1.15;color:#27272a;">${String(idx + 1).padStart(2, '0')}</td>
            <td style="padding:2.5px 4px;font-family:monospace;font-weight:500;font-size:7.5pt;color:#3f3f46;border-right:1px solid #000000;white-space:nowrap;line-height:1.15;">${it.produto_codigo || '—'}</td>
            <td style="padding:2.5px 6px;font-weight:500;font-size:7.5pt;color:#18181b;border-right:1px solid #000000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;" title="${it.produto_nome || ''}">${it.produto_nome || 'Peça do Estoque'}</td>
            <td style="padding:1.5px 3px;text-align:center;border-right:1px solid #000000;background:#fafafa;line-height:1.1;max-width:125px;width:125px;overflow:hidden;box-sizing:border-box;">${locCellHtml}</td>
            <td style="padding:2.5px 4px;text-align:center;font-family:monospace;font-weight:600;font-size:8pt;color:#18181b;white-space:nowrap;line-height:1.15;">${it.quantidade} ${it.produto_unidade || 'UN'}</td>
          </tr>`;
        })
        .join('');

      return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Cupom de Retirada e Lista de Separação - Lote ${data.loteId}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 6mm 8mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background: #ffffff !important;
      }
    }
    .cupom-sheet {
      width: 100%;
      max-width: 198mm;
      min-height: auto;
      margin: 0 auto;
      padding: 3mm 2mm;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="cupom-sheet">
    <div>
      <div style="border-bottom:1.5px solid #000000;padding-bottom:5px;text-align:center;margin-bottom:6px;">
        ${companyHeader}
        <h1 style="font-size:12.5pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.2px;margin:0 0 2px 0;line-height:1.1;color:#000000;">
          CUPOM DE RETIRADA / CAUTELA DE PEÇAS
        </h1>
        <p style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#27272a;margin:0 0 2px 0;">
          LISTA DE SEPARAÇÃO PARA O ALMOXARIFADO (ROTA DE COLETA POR ENDEREÇO FÍSICO)
        </p>
        <p style="font-size:8pt;font-weight:500;color:#52525b;margin:0;">
          Pedido de Peças por Veículo • Lote: <strong style="font-family:monospace;font-weight:600;color:#000000;">${data.loteId}</strong> • Status: <span style="font-weight:500;color:#18181b;">${data.status || 'Aguardando Manutenção'}</span>
        </p>
      </div>

      <div style="border:1.5px solid #000000;border-radius:5px;overflow:hidden;margin-bottom:6px;">
        <div style="background:#18181b;color:#ffffff;padding:4px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="display:flex;align-items:baseline;gap:6px;min-width:0;overflow:hidden;">
            <span style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;opacity:0.85;white-space:nowrap;">
              VEÍCULO / DESTINO:
            </span>
            <span style="font-size:10pt;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${veiculoLine}
            </span>
          </div>
          <div style="display:flex;align-items:baseline;gap:4px;white-space:nowrap;flex-shrink:0;">
            <span style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;opacity:0.85;">
              DATA:
            </span>
            <span style="font-size:9pt;font-weight:600;font-family:monospace;">
              ${dataFormatada}
            </span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;background:#fafafa;border-top:1px solid #000000;">
          <div style="padding:2.5px 10px;border-right:1px solid #000000;display:flex;align-items:baseline;gap:4px;white-space:nowrap;overflow:hidden;">
            <span style="font-size:6.5pt;font-weight:500;text-transform:uppercase;color:#52525b;white-space:nowrap;">
              LIBERADO POR (ALMOXARIFADO):
            </span>
            <span style="font-size:7.5pt;font-weight:600;color:#18181b;overflow:hidden;text-overflow:ellipsis;">
              ${data.operadorAlmoxarifado}
            </span>
          </div>
          <div style="padding:2.5px 10px;display:flex;align-items:baseline;gap:4px;white-space:nowrap;overflow:hidden;">
            <span style="font-size:6.5pt;font-weight:500;text-transform:uppercase;color:#52525b;white-space:nowrap;">
              RETIRADO POR (MECÂNICO):
            </span>
            <span style="font-size:7.5pt;font-weight:600;color:#18181b;overflow:hidden;text-overflow:ellipsis;">
              ${data.retiradoPor}
            </span>
          </div>
        </div>
      </div>

      <div style="border:1px solid #000000;border-radius:5px;overflow:hidden;margin-bottom:6px;">
        <div style="background:#f4f4f5;padding:3px 8px;border-bottom:1px solid #000000;display:flex;align-items:center;justify-content:space-between;gap:6px;">
          <span style="font-size:7.5pt;font-weight:700;text-transform:uppercase;color:#000000;">
            RELAÇÃO DE PEÇAS / MATERIAIS RETIRADOS (${sortedItems.length} ${sortedItems.length === 1 ? 'ITEM' : 'ITENS'}) — LISTA DE SEPARAÇÃO
          </span>
          <span style="font-size:6.5pt;font-weight:600;color:#18181b;text-transform:uppercase;">
            Rota de Coleta: Setor → Rua → Estante
          </span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:8pt;table-layout:fixed;">
          <thead>
            <tr style="background:#fafafa;border-bottom:1px solid #000000;font-size:7pt;font-weight:700;text-transform:uppercase;color:#27272a;line-height:1.1;">
              <th style="padding:3px 4px;width:24px;text-align:center;border-right:1px solid #000000;">#</th>
              <th style="padding:3px 4px;width:66px;text-align:left;border-right:1px solid #000000;">CÓDIGO</th>
              <th style="padding:3px 6px;text-align:left;border-right:1px solid #000000;">DESCRIÇÃO DA PEÇA / MATERIAL</th>
              <th style="padding:3px 4px;width:125px;text-align:center;border-right:1px solid #000000;background:#fef3c7;color:#000000;">LOCALIZAÇÃO / ENDEREÇO</th>
              <th style="padding:3px 4px;width:65px;text-align:center;">QUANTIDADE</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <p style="font-size:7.5pt;line-height:1.25;text-align:justify;color:#27272a;margin:3px 0 0 0;">
        Declaro ter recebido do Almoxarifado as peças discriminadas neste cupom (Lote <strong>${data.loteId}</strong>), sob liberação do operador <strong>${data.operadorAlmoxarifado}</strong>, destinadas à manutenção do veículo/máquina <strong>${data.veiculoNome}${data.veiculoPlaca ? ` (${data.veiculoPlaca})` : ''}</strong>.
      </p>
    </div>

    <div style="padding-top:6px;margin-top:4px;">
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;text-align:center;">
        <div>
          <div style="border-bottom:1.5px dotted #000000;height:15px;margin-bottom:2px;"></div>
          <div style="font-size:7.5pt;font-weight:600;text-transform:uppercase;color:#18181b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${data.retiradoPor}
          </div>
          <div style="font-size:6pt;font-weight:400;color:#71717a;">
            Assinatura: Mecânico / Operador
          </div>
        </div>

        <div>
          <div style="border-bottom:1px dotted #71717a;height:15px;margin-bottom:2px;"></div>
          <div style="font-size:7.5pt;font-weight:600;color:#18181b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${data.operadorAlmoxarifado}
          </div>
          <div style="font-size:6pt;font-weight:400;color:#71717a;">
            Operador do Almoxarifado
          </div>
        </div>

        <div>
          <div style="border-bottom:1px dotted #71717a;height:15px;margin-bottom:2px;"></div>
          <div style="font-size:7.5pt;font-weight:600;color:#18181b;">
            Conferência na OS
          </div>
          <div style="font-size:6pt;font-weight:400;color:#71717a;">
            Visto da Manutenção
          </div>
        </div>
      </div>

      <div style="border-top:1px solid #e4e4e7;margin-top:4px;padding-top:2px;text-align:center;font-size:6.5pt;color:#a1a1aa;">
        Cupom emitido em ${formatDateTimePtBr(new Date().toISOString())} • Lote: ${data.loteId}
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      }, 250);
    });
  </script>
</body>
</html>`;
    },
    [companyProfile, enrichAndSortItemsByPickingRoute]
  );

  // Dispara a rotina de impressão física do Cupom de Retirada / Cautela
  const handleDispararImpressaoCupomLote = useCallback(
    async (explicitData?: CupomLotePrintData) => {
      const baseData = explicitData || cupomLotePrint;
      if (!baseData) return;

      // Garante cruzamento em tempo real com 'public.estoque_produtos' no Supabase antes de imprimir
      const realtimeMap = await fetchEnderecosReaisProdutosEstoque(
        (baseData.items || []).map(it => it.produto_id)
      );
      const sortedItems = enrichAndSortItemsByPickingRoute(baseData.items || [], realtimeMap);
      const targetData: CupomLotePrintData = {
        ...baseData,
        items: sortedItems,
      };
      setCupomLotePrint(targetData);

      document.body.classList.add('printing-almox-cupom');
      const cleanUp = () => {
        document.body.classList.remove('printing-almox-cupom');
        window.removeEventListener('afterprint', cleanUp);
      };
      window.addEventListener('afterprint', cleanUp);
      setTimeout(cleanUp, 3500);

      const isInsideIframe = (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();

      if (isInsideIframe) {
        const html = buildCupomLoteStandaloneHtml(targetData);
        executePrint(html);
        return;
      }

      try {
        window.focus();
        window.print();
      } catch {
        const html = buildCupomLoteStandaloneHtml(targetData);
        executePrint(html);
      }
    },
    [cupomLotePrint, buildCupomLoteStandaloneHtml, enrichAndSortItemsByPickingRoute]
  );

  const handleAbrirCupomLote = async (
    item: RetiradaPecaRecord,
    autoPrint = false,
    explicitItems?: RetiradaPecaRecord[]
  ) => {
    const batchItems =
      explicitItems && explicitItems.length > 0
        ? explicitItems
        : item.lote_id
          ? retiradasPecas.filter(r => r.lote_id === item.lote_id)
          : [item];
    const listToPrint = batchItems.length > 0 ? batchItems : [item];
    const first = listToPrint[0] || item;

    // 1. Abre imediatamente o modal com os endereços locais já ordenados por Rota de Coleta
    const initialSorted = enrichAndSortItemsByPickingRoute(listToPrint);
    const initialPayload: CupomLotePrintData = {
      loteId: first.lote_id || item.id.slice(0, 8).toUpperCase(),
      veiculoNome: first.veiculo_nome || 'Veículo da Frota',
      veiculoPlaca: first.veiculo_placa || '',
      operadorAlmoxarifado: first.operador_almoxarifado || '—',
      retiradoPor: first.retirado_por || '—',
      dataRetirada: first.data_retirada || new Date().toISOString().split('T')[0],
      status: first.status || 'Aguardando Manutenção',
      items: initialSorted,
    };
    setCupomLotePrint(initialPayload);

    // 2. Faz o cruzamento em tempo real com 'public.estoque_produtos' no Supabase para garantir o 'endereco_formatado' atualizado
    const realtimeMap = await fetchEnderecosReaisProdutosEstoque(
      listToPrint.map(it => it.produto_id)
    );
    const syncedSorted = enrichAndSortItemsByPickingRoute(listToPrint, realtimeMap);
    const syncedPayload: CupomLotePrintData = {
      ...initialPayload,
      items: syncedSorted,
    };
    setCupomLotePrint(syncedPayload);

    if (autoPrint) {
      setTimeout(() => {
        handleDispararImpressaoCupomLote(syncedPayload);
      }, 250);
    }
  };

  const handleLancarLoteNaManutencaoOS = (
    item: RetiradaPecaRecord,
    explicitItems?: RetiradaPecaRecord[]
  ) => {
    const batchItems =
      explicitItems && explicitItems.length > 0
        ? explicitItems
        : item.lote_id
          ? retiradasPecas.filter(r => r.lote_id === item.lote_id)
          : [item];
    const itemsToLaunch = batchItems.length > 0 ? batchItems : [item];

    const matchedVeh = frotasList.find(
      m =>
        m.id === item.veiculo_id ||
        (item.veiculo_id && toValidUUID(m.id) === toValidUUID(item.veiculo_id)) ||
        (item.veiculo_nome &&
          String(m.name || '').toLowerCase() === String(item.veiculo_nome || '').toLowerCase())
    );

    if (!matchedVeh) {
      showFeedback('error', 'Veículo vinculado ao lote não encontrado no cadastro de frotas.');
      return;
    }

    const loteKey = item.lote_id || item.id.slice(0, 8).toUpperCase();
    const updatedList = atualizarStatusLoteRetiradaPecas({
      loteId: item.lote_id,
      recordIds: itemsToLaunch.map(i => i.id),
      novoStatus: 'Em Manutenção (OS)',
    });
    setRetiradasPecas(prev =>
      prev.map(r => {
        const match = updatedList.find(u => u.id === r.id);
        return match ? { ...r, status: match.status } : r;
      })
    );

    if (onLaunchBatchToMaintenanceOS) {
      onLaunchBatchToMaintenanceOS({
        loteId: loteKey,
        veiculo: matchedVeh,
        items: itemsToLaunch,
      });
    } else {
      showFeedback(
        'success',
        `Lote ${loteKey} (${itemsToLaunch.length} peça(s)) marcado como pronto para Ordem de Serviço!`
      );
    }
  };

  const handleToggleExpandLote = (loteKey: string) => {
    setExpandedLotes(prev => ({
      ...prev,
      [loteKey]: !prev[loteKey],
    }));
  };

  const handleExcluirLoteCompleto = async (
    loteKey: string,
    pedidoLabel: string,
    items: RetiradaPecaRecord[]
  ) => {
    if (!items || items.length === 0) return;
    const ok = await confirm({
      title: 'Excluir Pedido / Lote Completo',
      message: `Deseja excluir o Pedido ${pedidoLabel} (${loteKey}) contendo ${items.length} peça(s) vinculada(s) ao veículo "${items[0]?.veiculo_nome || 'Veículo'}"?`,
      confirmLabel: 'Sim, Excluir Pedido',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    for (const item of items) {
      await deleteRetiradaPeca(item.id, false, item.produto_id, item.quantidade);
    }
    if (editingLoteKey === loteKey) {
      handleCancelarEdicaoRetirada();
    }
    const idsToRemove = new Set(items.map(i => i.id));
    setRetiradasPecas(prev => prev.filter(r => !idsToRemove.has(r.id)));
    showFeedback('success', `Pedido ${pedidoLabel} (${items.length} peça(s)) excluído do histórico.`);
  };

  const handleSalvarRetiradaPeca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pecaVeiculoId) {
      showFeedback('error', 'Selecione o Veículo / Máquina que receberá as peças.');
      return;
    }
    if (!pecaOperadorAlmox.trim()) {
      showFeedback('error', 'Informe o nome do Operador do Almoxarifado.');
      return;
    }
    if (!pecaRetiradoPor.trim()) {
      showFeedback('error', 'Informe quem retirou as peças (Mecânico / Operador).');
      return;
    }

    setIsSavingRetiradaPeca(true);
    try {
      if (editingRetiradaPeca) {
        if (!pecaProdutoId || qtdRetiradaNumerica <= 0) {
          showFeedback('error', 'Selecione o item e informe uma quantidade maior que zero.');
          return;
        }
        const resUpdate = await atualizarRetiradaPeca({
          id: editingRetiradaPeca.id,
          veiculo_id: pecaVeiculoId,
          produto_id: pecaProdutoId,
          quantidade: qtdRetiradaNumerica,
          operador_almoxarifado: pecaOperadorAlmox.trim(),
          retirado_por: pecaRetiradoPor.trim(),
          data_retirada: pecaDataRetirada,
          originalRecord: editingRetiradaPeca,
          veiculo: selectedVehicleForWithdrawal,
          produto: selectedProductForWithdrawal || undefined,
        });

        if (!resUpdate.success) {
          showFeedback('error', resUpdate.errorMessage || 'Não foi possível atualizar o lançamento.');
          return;
        }

        if (resUpdate.record) {
          setRetiradasPecas(prev =>
            prev.map(r => (r.id === editingRetiradaPeca.id || r.id === resUpdate.record!.id ? resUpdate.record! : r))
          );
        }

        showFeedback('success', 'Lançamento de retirada atualizado com sucesso!');
        setEditingRetiradaPeca(null);
        setPecaProdutoId('');
        setPecaComboSearch('');
        setPecaQuantidade('1');
        return;
      }

      // Monta a lista final de itens do pedido do veículo
      const itensParaSalvar = [...cestaPecasVeiculo];
      if (pecaProdutoId && selectedProductForWithdrawal && qtdRetiradaNumerica > 0) {
        const alreadyInBasket = itensParaSalvar.some(i => i.produto_id === selectedProductForWithdrawal.id);
        if (!alreadyInBasket) {
          itensParaSalvar.push({
            produto_id: selectedProductForWithdrawal.id,
            produto_nome: String(selectedProductForWithdrawal.nome_comercial || selectedProductForWithdrawal.name || 'Peça'),
            produto_codigo: String(selectedProductForWithdrawal.code ?? selectedProductForWithdrawal.codigo_produto ?? ''),
            produto_unidade: String(selectedProductForWithdrawal.unidade_medida || selectedProductForWithdrawal.unit || 'UN'),
            quantidade: qtdRetiradaNumerica,
            saldo_estoque: saldoAtualProdutoSelecionado,
            produto: selectedProductForWithdrawal,
          });
        }
      }

      if (itensParaSalvar.length === 0) {
        showFeedback('error', 'Adicione pelo menos uma peça à cesta do veículo antes de confirmar o pedido.');
        return;
      }

      // Se estava editando um Pedido/Lote existente, remove os itens antigos antes de regravar o lote atualizado
      let oldLoteIdsToRemove = new Set<string>();
      if (editingLoteKey) {
        const oldItems = retiradasPecas.filter(r => {
          const rKey =
            r.lote_id ||
            `${String(r.data_retirada || '').split('T')[0]}__${r.veiculo_id || r.veiculo_nome || ''}__${r.retirado_por || ''}`;
          return rKey === editingLoteKey || r.lote_id === editingLoteKey || r.id === editingLoteKey;
        });
        for (const oldItem of oldItems) {
          oldLoteIdsToRemove.add(oldItem.id);
          await deleteRetiradaPeca(oldItem.id, false, oldItem.produto_id, oldItem.quantidade);
        }
      }

      const resLote = await registrarPedidoRetiradaPecasLote({
        veiculo_id: pecaVeiculoId,
        veiculo: selectedVehicleForWithdrawal,
        operador_almoxarifado: pecaOperadorAlmox.trim(),
        retirado_por: pecaRetiradoPor.trim(),
        data_retirada: pecaDataRetirada,
        lote_id: editingLoteKey && editingLoteKey.startsWith('LOTE-') ? editingLoteKey : undefined,
        items: itensParaSalvar.map(item => ({
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          produto: item.produto,
        })),
      });

      if (!resLote.success || !resLote.records) {
        showFeedback('error', resLote.errorMessage || 'Não foi possível salvar o pedido de peças.');
        return;
      }

      const savedRecords = resLote.records;
      const savedIds = new Set(savedRecords.map(r => r.id));
      setRetiradasPecas(prev => [
        ...savedRecords,
        ...prev.filter(r => !savedIds.has(r.id) && !oldLoteIdsToRemove.has(r.id)),
      ]);

      showFeedback(
        'success',
        editingLoteKey
          ? `Pedido ${resLote.loteId} atualizado com sucesso (${savedRecords.length} peça(s))!`
          : `Pedido ${resLote.loteId} confirmado (${savedRecords.length} peça(s)) com status "Aguardando Manutenção"! Abrindo cupom para impressão...`
      );

      // Limpa a cesta de peças e abre automaticamente o Cupom de Retirada / Cautela para impressão
      setEditingLoteKey(null);
      setCestaPecasVeiculo([]);
      setPecaProdutoId('');
      setPecaComboSearch('');
      setPecaQuantidade('1');
      setExpandedLotes(prev => ({ ...prev, [resLote.loteId]: true }));
      const sortedSavedRecords = enrichAndSortItemsByPickingRoute(savedRecords);
      const newCupomPayload: CupomLotePrintData = {
        loteId: resLote.loteId,
        veiculoNome: selectedVehicleForWithdrawal?.name || savedRecords[0]?.veiculo_nome || 'Veículo da Frota',
        veiculoPlaca: selectedVehicleForWithdrawal?.plateOrSerial || savedRecords[0]?.veiculo_placa || '',
        operadorAlmoxarifado: pecaOperadorAlmox.trim(),
        retiradoPor: pecaRetiradoPor.trim(),
        dataRetirada: pecaDataRetirada,
        status: 'Aguardando Manutenção',
        items: sortedSavedRecords,
      };
      setCupomLotePrint(newCupomPayload);
      setTimeout(() => {
        handleDispararImpressaoCupomLote(newCupomPayload);
      }, 280);
    } finally {
      setIsSavingRetiradaPeca(false);
    }
  };

  const handleExcluirRetiradaPeca = async (item: RetiradaPecaRecord) => {
    const ok = await confirm({
      title: 'Excluir Peça do Pedido',
      message: `Deseja excluir a peça "${item.produto_nome || 'Peça'}" (${item.quantidade} ${item.produto_unidade || 'UN'}) deste pedido?`,
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    await deleteRetiradaPeca(item.id, false, item.produto_id, item.quantidade);
    if (editingRetiradaPeca?.id === item.id) {
      handleCancelarEdicaoRetirada();
    }
    setRetiradasPecas(prev => prev.filter(r => r.id !== item.id));
    showFeedback('success', 'Peça removida do pedido.');
  };

  const filteredRetiradasPecas = useMemo(() => {
    const q = String(pecaSearchFilter || '').toLowerCase().trim();
    if (!q) return retiradasPecas;
    return retiradasPecas.filter(r => {
      return (
        String(r.veiculo_nome || '').toLowerCase().includes(q) ||
        String(r.veiculo_placa || '').toLowerCase().includes(q) ||
        String(r.produto_nome || '').toLowerCase().includes(q) ||
        String(r.produto_codigo ?? '').toLowerCase().includes(q) ||
        String(r.operador_almoxarifado || '').toLowerCase().includes(q) ||
        String(r.retirado_por || '').toLowerCase().includes(q) ||
        String(r.lote_id || '').toLowerCase().includes(q) ||
        String(r.status || '').toLowerCase().includes(q)
      );
    });
  }, [retiradasPecas, pecaSearchFilter]);

  // Agrupamento inteligente por Pedido / Lote (numero_pedido / lote_id) para a tabela expansível
  const groupedPedidosLotes = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        loteKey: string;
        loteCodigo: string;
        dataRetirada: string;
        createdAt: string;
        veiculoId: string;
        veiculoNome: string;
        veiculoModelo: string;
        veiculoPlaca: string;
        veiculoDisplayCompleto: string;
        operadorAlmoxarifado: string;
        retiradoPor: string;
        status: string;
        items: RetiradaPecaRecord[];
        totalItens: number;
        totalQuantidade: number;
      }
    >();

    for (const r of retiradasPecas) {
      const anyR = r as any;
      const rawNumeroPedido = String(anyR.numero_pedido || r.lote_id || '').trim();
      const datePart = String(r.data_retirada || '').split('T')[0];
      const groupKey =
        rawNumeroPedido ||
        `${datePart}__${r.veiculo_id || r.veiculo_nome || 'veh'}__${(r.retirado_por || '').trim().toLowerCase()}`;

      if (!groupsMap.has(groupKey)) {
        const matchedVeh = frotasList.find(
          m =>
            m.id === r.veiculo_id ||
            (r.veiculo_id && toValidUUID(m.id) === toValidUUID(r.veiculo_id)) ||
            (r.veiculo_nome &&
              String(m.name || '').toLowerCase() === String(r.veiculo_nome || '').toLowerCase())
        );

        const vNome = matchedVeh?.name || r.veiculo_nome || 'Veículo da Frota';
        const vModelo = String(matchedVeh?.model || '').trim();
        const vPlaca = String(matchedVeh?.plateOrSerial || r.veiculo_placa || '').trim();

        const nomeComModelo =
          vModelo && !vNome.toLowerCase().includes(vModelo.toLowerCase())
            ? `${vNome} (${vModelo})`
            : vNome;
        const displayCompleto = vPlaca ? `${nomeComModelo} - ${vPlaca}` : nomeComModelo;

        groupsMap.set(groupKey, {
          loteKey: groupKey,
          loteCodigo: rawNumeroPedido || `LOTE-${r.id.slice(0, 6).toUpperCase()}`,
          dataRetirada: r.data_retirada || new Date().toISOString().split('T')[0],
          createdAt: r.created_at || r.data_retirada || '',
          veiculoId: matchedVeh?.id || r.veiculo_id || '',
          veiculoNome: nomeComModelo,
          veiculoModelo: vModelo,
          veiculoPlaca: vPlaca,
          veiculoDisplayCompleto: displayCompleto,
          operadorAlmoxarifado: r.operador_almoxarifado || '—',
          retiradoPor: r.retirado_por || '—',
          status: r.status || 'Aguardando Manutenção',
          items: [],
          totalItens: 0,
          totalQuantidade: 0,
        });
      }

      const grp = groupsMap.get(groupKey)!;
      grp.items.push(r);
      grp.totalItens = grp.items.length;
      grp.totalQuantidade = Number(
        (grp.totalQuantidade + (Number(r.quantidade) || 0)).toFixed(2)
      );
      if (r.status && r.status !== 'Aguardando Manutenção') {
        grp.status = r.status;
      }
    }

    const allGroups = Array.from(groupsMap.values());
    // Numeração sequencial de pedidos (#1001, #1002...) do mais antigo para o mais recente
    const chronological = [...allGroups].sort((a, b) =>
      String(a.createdAt || a.dataRetirada).localeCompare(String(b.createdAt || b.dataRetirada))
    );
    const pedidoNumMap = new Map<string, string>();
    chronological.forEach((g, idx) => {
      pedidoNumMap.set(g.loteKey, `#${1001 + idx}`);
    });

    const enriched = allGroups.map(g => ({
      ...g,
      items: enrichAndSortItemsByPickingRoute(g.items),
      numeroPedido: pedidoNumMap.get(g.loteKey) || '#1001',
    }));

    const q = String(pecaSearchFilter || '').toLowerCase().trim();
    if (!q) return enriched;

    return enriched.filter(g => {
      const headerMatch =
        g.numeroPedido.toLowerCase().includes(q) ||
        g.loteCodigo.toLowerCase().includes(q) ||
        g.veiculoDisplayCompleto.toLowerCase().includes(q) ||
        g.veiculoPlaca.toLowerCase().includes(q) ||
        g.operadorAlmoxarifado.toLowerCase().includes(q) ||
        g.retiradoPor.toLowerCase().includes(q) ||
        g.status.toLowerCase().includes(q);
      if (headerMatch) return true;
      return g.items.some(
        it =>
          String(it.produto_nome || '').toLowerCase().includes(q) ||
          String(it.produto_codigo ?? '').toLowerCase().includes(q) ||
          String(it.endereco_formatado ?? '').toLowerCase().includes(q)
      );
    });
  }, [retiradasPecas, frotasList, pecaSearchFilter, enrichAndSortItemsByPickingRoute]);

  // =========================================================================
  // ESTADOS DA ABA 2: MOVIMENTAÇÃO E CAUTELA DE FERRAMENTAS
  // =========================================================================
  const [ferCodigo, setFerCodigo] = useState<string>('');
  const [ferNome, setFerNome] = useState<string>('');
  const [ferOperadorAlmox, setFerOperadorAlmox] = useState<string>('');
  const [ferRetiradoPor, setFerRetiradoPor] = useState<string>('');
  const [ferDataHoraRetirada, setFerDataHoraRetirada] = useState<string>(() =>
    toLocalDatetimeInputValue()
  );
  const [ferStatusFilter, setFerStatusFilter] = useState<'todas' | 'ativas' | 'devolvidas'>('todas');
  const [ferSearchTerm, setFerSearchTerm] = useState<string>('');
  const [isSavingCautela, setIsSavingCautela] = useState<boolean>(false);

  // Modal de Registrar Devolução
  const [devolucaoTarget, setDevolucaoTarget] = useState<MovimentacaoFerramentaRecord | null>(null);
  const [devolucaoDataHora, setDevolucaoDataHora] = useState<string>(() =>
    toLocalDatetimeInputValue()
  );
  const [devolucaoConferidoPor, setDevolucaoConferidoPor] = useState<string>('');
  const [isSavingDevolucao, setIsSavingDevolucao] = useState<boolean>(false);

  // Modal de Impressão do Termo de Cautela (A4)
  const [termoPrintItem, setTermoPrintItem] = useState<MovimentacaoFerramentaRecord | null>(null);

  const handleQuickSelectToolFromStock = (prodId: string) => {
    if (!prodId) return;
    const prod = allProducts.find(p => p.id === prodId);
    if (!prod) return;
    setFerCodigo(String(prod.code || prod.codigo_produto || prod.barcode || `FER-${prod.id.slice(0, 4).toUpperCase()}`));
    setFerNome(String(prod.nome_comercial || prod.name || ''));
  };

  const handleRegistrarCautela = async (e: React.FormEvent, printAfterSave = false) => {
    e.preventDefault();
    if (!ferCodigo.trim() || !ferNome.trim()) {
      showFeedback('error', 'Informe o Código e o Nome da Ferramenta.');
      return;
    }
    if (!ferOperadorAlmox.trim()) {
      showFeedback('error', 'Informe o Operador do Almoxarifado.');
      return;
    }
    if (!ferRetiradoPor.trim()) {
      showFeedback('error', 'Informe o nome de quem retirou a ferramenta.');
      return;
    }

    setIsSavingCautela(true);
    try {
      const res = await registrarRetiradaFerramenta({
        codigo_ferramenta: ferCodigo.trim(),
        nome_ferramenta: ferNome.trim(),
        operador_almoxarifado: ferOperadorAlmox.trim(),
        retirado_por: ferRetiradoPor.trim(),
        data_retirada: ferDataHoraRetirada ? new Date(ferDataHoraRetirada).toISOString() : new Date().toISOString(),
      });

      if (!res.success || !res.record) {
        showFeedback('error', res.errorMessage || 'Erro ao registrar cautela de ferramenta.');
        return;
      }

      setMovimentacoesFerramentas(prev => [
        res.record!,
        ...prev.filter(item => item.id !== res.record!.id),
      ]);

      showFeedback(
        'success',
        `Cautela da ferramenta "${res.record.nome_ferramenta}" registrada para ${res.record.retirado_por}.`
      );

      setFerCodigo('');
      setFerNome('');
      setFerDataHoraRetirada(toLocalDatetimeInputValue());

      if (printAfterSave) {
        setTermoPrintItem(res.record);
      }
    } finally {
      setIsSavingCautela(false);
    }
  };

  const handleOpenDevolucaoModal = (item: MovimentacaoFerramentaRecord) => {
    setDevolucaoTarget(item);
    setDevolucaoDataHora(toLocalDatetimeInputValue(new Date()));
    setDevolucaoConferidoPor(item.operador_almoxarifado || ferOperadorAlmox || '');
  };

  const handleConfirmarDevolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devolucaoTarget) return;
    if (!devolucaoConferidoPor.trim()) {
      showFeedback('error', 'Preencha o campo obrigatório "Conferido por" para registrar a devolução.');
      return;
    }

    setIsSavingDevolucao(true);
    try {
      const res = await registrarDevolucaoFerramenta(devolucaoTarget.id, {
        conferido_por: devolucaoConferidoPor.trim(),
        data_devolucao: devolucaoDataHora ? new Date(devolucaoDataHora).toISOString() : new Date().toISOString(),
      });

      if (!res.success) {
        showFeedback('error', res.errorMessage || 'Não foi possível registrar a devolução.');
        return;
      }

      setMovimentacoesFerramentas(prev =>
        prev.map(item =>
          item.id === devolucaoTarget.id
            ? {
                ...item,
                data_devolucao: devolucaoDataHora
                  ? new Date(devolucaoDataHora).toISOString()
                  : new Date().toISOString(),
                conferido_por: devolucaoConferidoPor.trim(),
                status: 'Devolvido',
              }
            : item
        )
      );

      showFeedback(
        'success',
        `Devolução da ferramenta "${devolucaoTarget.nome_ferramenta}" conferida por ${devolucaoConferidoPor.trim()} e gravada com sucesso!`
      );
      setDevolucaoTarget(null);
    } finally {
      setIsSavingDevolucao(false);
    }
  };

  const handleExcluirCautela = async (item: MovimentacaoFerramentaRecord) => {
    const ok = await confirm({
      title: 'Excluir Registro de Cautela',
      message: `Deseja realmente excluir o registro da ferramenta "${item.nome_ferramenta}" retirada por "${item.retirado_por}"?`,
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    await deleteMovimentacaoFerramenta(item.id);
    setMovimentacoesFerramentas(prev => prev.filter(r => r.id !== item.id));
    showFeedback('success', 'Registro de movimentação removido.');
  };

  const filteredMovimentacoesFerramentas = useMemo(() => {
    const q = ferSearchTerm.toLowerCase().trim();
    return movimentacoesFerramentas.filter(item => {
      const isDevolvido = Boolean(item.data_devolucao) || String(item.status).toLowerCase() === 'devolvido';
      if (ferStatusFilter === 'ativas' && isDevolvido) return false;
      if (ferStatusFilter === 'devolvidas' && !isDevolvido) return false;

      if (!q) return true;
      return (
        String(item.codigo_ferramenta ?? '').toLowerCase().includes(q) ||
        String(item.nome_ferramenta || '').toLowerCase().includes(q) ||
        String(item.retirado_por || '').toLowerCase().includes(q) ||
        String(item.operador_almoxarifado || '').toLowerCase().includes(q) ||
        String(item.conferido_por || '').toLowerCase().includes(q)
      );
    });
  }, [movimentacoesFerramentas, ferStatusFilter, ferSearchTerm]);

  // =========================================================================
  // ESTADOS DA ABA 3: CAIXA DE FERRAMENTAS FIXA POR VEÍCULO
  // =========================================================================
  const [selectedCaixaVeiculoId, setSelectedCaixaVeiculoId] = useState<string>(() =>
    frotasList[0]?.id || ''
  );

  useEffect(() => {
    if (!selectedCaixaVeiculoId && frotasList.length > 0) {
      setSelectedCaixaVeiculoId(frotasList[0].id);
    }
  }, [frotasList, selectedCaixaVeiculoId]);

  const selectedCaixaVehicle = useMemo(() => {
    return frotasList.find(
      m =>
        m.id === selectedCaixaVeiculoId ||
        toValidUUID(m.id) === toValidUUID(selectedCaixaVeiculoId)
    );
  }, [frotasList, selectedCaixaVeiculoId]);

  const itensCaixaDoVeiculo = useMemo(() => {
    if (!selectedCaixaVeiculoId) return [];
    const targetUuid = toValidUUID(selectedCaixaVeiculoId);
    return caixaFerramentasAll.filter(
      item =>
        item.veiculo_id === selectedCaixaVeiculoId ||
        item.veiculo_id === targetUuid
    );
  }, [caixaFerramentasAll, selectedCaixaVeiculoId]);

  // Formulário para adicionar ferramenta fixa à caixa do veículo
  const [novaFerramentaCaixaCodigo, setNovaFerramentaCaixaCodigo] = useState<string>('');
  const [novaFerramentaCaixaNome, setNovaFerramentaCaixaNome] = useState<string>('');
  const [novaFerramentaCaixaQtdEsperada, setNovaFerramentaCaixaQtdEsperada] = useState<string>('1');
  const [novaFerramentaCaixaQtdAtual, setNovaFerramentaCaixaQtdAtual] = useState<string>('1');
  const [isAddingItemCaixa, setIsAddingItemCaixa] = useState<boolean>(false);

  // Estado de Conferência de Caixa
  const [isConferenciaMode, setIsConferenciaMode] = useState<boolean>(false);
  const [conferenciaQuantidades, setConferenciaQuantidades] = useState<Record<string, number>>({});
  const [conferenciaConferidoPor, setConferenciaConferidoPor] = useState<string>('');
  const [conferenciaData, setConferenciaData] = useState<string>(() =>
    toLocalDatetimeInputValue()
  );
  const [isSavingConferencia, setIsSavingConferencia] = useState<boolean>(false);

  const handleIniciarConferenciaCaixa = () => {
    const map: Record<string, number> = {};
    itensCaixaDoVeiculo.forEach(item => {
      map[item.id] = Number(item.quantidade_atual ?? item.quantidade_esperada ?? 1);
    });
    setConferenciaQuantidades(map);
    setConferenciaData(toLocalDatetimeInputValue());
    setIsConferenciaMode(true);
  };

  const handleAdicionarFerramentaCaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaixaVeiculoId) {
      showFeedback('error', 'Selecione um veículo da frota primeiro.');
      return;
    }
    if (!novaFerramentaCaixaCodigo.trim() || !novaFerramentaCaixaNome.trim()) {
      showFeedback('error', 'Informe o Código do Item e o Nome da Ferramenta.');
      return;
    }

    setIsAddingItemCaixa(true);
    try {
      const qtdEsp = Math.max(1, Number(novaFerramentaCaixaQtdEsperada) || 1);
      const qtdAtu = Math.max(0, Number(novaFerramentaCaixaQtdAtual ?? qtdEsp));

      const res = await upsertItemCaixaFerramentaVeiculo({
        veiculo_id: selectedCaixaVeiculoId,
        codigo_item_ferramenta: novaFerramentaCaixaCodigo.trim(),
        nome_ferramenta: novaFerramentaCaixaNome.trim(),
        quantidade_esperada: qtdEsp,
        quantidade_atual: qtdAtu,
        veiculo: selectedCaixaVehicle,
      });

      if (!res.success || !res.record) {
        showFeedback('error', res.errorMessage || 'Não foi possível adicionar a ferramenta.');
        return;
      }

      setCaixaFerramentasAll(prev => [...prev.filter(i => i.id !== res.record!.id), res.record!]);
      setNovaFerramentaCaixaCodigo('');
      setNovaFerramentaCaixaNome('');
      setNovaFerramentaCaixaQtdEsperada('1');
      setNovaFerramentaCaixaQtdAtual('1');
      showFeedback(
        'success',
        `Ferramenta "${res.record.nome_ferramenta}" adicionada à caixa fixa do veículo!`
      );
    } finally {
      setIsAddingItemCaixa(false);
    }
  };

  const handlePopularKitPadraoVeiculo = async () => {
    if (!selectedCaixaVeiculoId) {
      showFeedback('error', 'Selecione um veículo da frota primeiro.');
      return;
    }
    setIsAddingItemCaixa(true);
    try {
      const novosRegistros: CaixaFerramentaVeiculoRecord[] = [];
      for (const itemPadrao of KIT_PADRAO_VEICULO) {
        const jaExiste = itensCaixaDoVeiculo.some(
          i =>
            String(i.codigo_item_ferramenta ?? '').toLowerCase() === String(itemPadrao.codigo || '').toLowerCase() ||
            String(i.nome_ferramenta || '').toLowerCase() === String(itemPadrao.nome || '').toLowerCase()
        );
        if (jaExiste) continue;

        const res = await upsertItemCaixaFerramentaVeiculo({
          veiculo_id: selectedCaixaVeiculoId,
          codigo_item_ferramenta: itemPadrao.codigo,
          nome_ferramenta: itemPadrao.nome,
          quantidade_esperada: itemPadrao.qtd,
          quantidade_atual: itemPadrao.qtd,
          veiculo: selectedCaixaVehicle,
        });
        if (res.success && res.record) {
          novosRegistros.push(res.record);
        }
      }

      if (novosRegistros.length > 0) {
        setCaixaFerramentasAll(prev => [...prev, ...novosRegistros]);
        showFeedback(
          'success',
          `${novosRegistros.length} ferramentas padrão adicionadas à caixa do veículo!`
        );
      } else {
        showFeedback('success', 'Todas as ferramentas do kit padrão já estão cadastradas neste veículo.');
      }
    } finally {
      setIsAddingItemCaixa(false);
    }
  };

  const handleSalvarConferenciaCaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaixaVeiculoId) return;
    if (!conferenciaConferidoPor.trim()) {
      showFeedback('error', 'Informe o nome de quem realizou a conferência da caixa.');
      return;
    }

    setIsSavingConferencia(true);
    try {
      const itensPayload = itensCaixaDoVeiculo.map(item => ({
        id: item.id,
        quantidade_atual:
          conferenciaQuantidades[item.id] !== undefined
            ? conferenciaQuantidades[item.id]
            : item.quantidade_atual,
      }));

      const dataIso = conferenciaData
        ? new Date(conferenciaData).toISOString()
        : new Date().toISOString();

      const res = await realizarConferenciaCaixaVeiculo({
        veiculo_id: selectedCaixaVeiculoId,
        conferido_por: conferenciaConferidoPor.trim(),
        ultima_conferencia: dataIso,
        itens: itensPayload,
      });

      if (!res.success) {
        showFeedback('error', res.errorMessage || 'Erro ao gravar conferência no Supabase.');
        return;
      }

      setCaixaFerramentasAll(prev =>
        prev.map(row => {
          const isFromVehicle =
            row.veiculo_id === selectedCaixaVeiculoId ||
            row.veiculo_id === toValidUUID(selectedCaixaVeiculoId);
          if (!isFromVehicle) return row;
          return {
            ...row,
            quantidade_atual:
              conferenciaQuantidades[row.id] !== undefined
                ? conferenciaQuantidades[row.id]
                : row.quantidade_atual,
            conferido_por: conferenciaConferidoPor.trim(),
            ultima_conferencia: dataIso,
          };
        })
      );

      setIsConferenciaMode(false);
      showFeedback(
        'success',
        `Conferência de Caixa do veículo "${selectedCaixaVehicle?.name || ''}" gravada com sucesso por ${conferenciaConferidoPor.trim()}!`
      );
    } finally {
      setIsSavingConferencia(false);
    }
  };

  const handleRemoverItemCaixa = async (item: CaixaFerramentaVeiculoRecord) => {
    const ok = await confirm({
      title: 'Remover Ferramenta da Caixa',
      message: `Deseja remover "${item.nome_ferramenta}" (${item.codigo_item_ferramenta}) da caixa fixa deste veículo?`,
      confirmLabel: 'Sim, Remover',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    await deleteItemCaixaFerramentaVeiculo(item.id);
    setCaixaFerramentasAll(prev => prev.filter(i => i.id !== item.id));
    showFeedback('success', 'Ferramenta removida da caixa do veículo.');
  };

  // Resumo de KPIs do Almoxarifado
  const totalEmprestimosAtivos = useMemo(() => {
    return movimentacoesFerramentas.filter(
      m => !m.data_devolucao && String(m.status).toLowerCase() !== 'devolvido'
    ).length;
  }, [movimentacoesFerramentas]);

  const resumoCaixaVeiculoAtual = useMemo(() => {
    const totalItens = itensCaixaDoVeiculo.length;
    const itensCompletos = itensCaixaDoVeiculo.filter(
      i => Number(i.quantidade_atual) >= Number(i.quantidade_esperada)
    ).length;
    const itensFaltantes = totalItens - itensCompletos;
    const ultimaConf = itensCaixaDoVeiculo.find(i => i.ultima_conferencia)?.ultima_conferencia;
    const confPor = itensCaixaDoVeiculo.find(i => i.conferido_por)?.conferido_por;
    return { totalItens, itensCompletos, itensFaltantes, ultimaConf, confPor };
  }, [itensCaixaDoVeiculo]);

  return (
    <div className="flex flex-col lg:h-[calc(100vh-64px)] lg:overflow-hidden space-y-2.5">
      {/* Datalist global de colaboradores para sugestão rápida em campos de operador/mecânico */}
      <datalist id="almox-employees-list">
        {employeeNames.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* Cabeçalho Principal Compacto do Módulo */}
      <div className="no-print shrink-0 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl px-3.5 py-2.5 shadow-xs">
        {/* Linha 1: Título + Descrição à esquerda e Botões de Ação à direita na mesma linha */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Wrench className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
                  Gestão e Controle do Almoxarifado
                </h1>
                <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800 leading-none">
                  Supabase Ativo
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                Controle de saídas de peças para manutenção, cautela de ferramentas com assinatura e inventário de caixas por veículo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onNavigateToEstoque && (
              <button
                type="button"
                onClick={onNavigateToEstoque}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-zinc-300 dark:border-stone-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-800 dark:text-stone-200 transition cursor-pointer"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Ver Estoque Geral</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => loadAlmoxarifadoData(false)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-zinc-200 dark:border-stone-700 bg-white hover:bg-zinc-50 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-700 dark:text-stone-200 transition cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar Dados</span>
            </button>
          </div>
        </div>

        {/* Linha 2 Integrada: Botões de Alternância das Abas + Pílulas Horizontais Compactas de Resumo */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 mt-2 pt-2 border-t border-zinc-100 dark:border-stone-800">
          {/* Botões de Navegação das 3 Abas */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('retirada_pecas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'retirada_pecas'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300'
              }`}
            >
              <PackageMinus className="w-3.5 h-3.5" />
              <span>1. Retirada de Peças para Manutenção</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cautela_ferramentas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'cautela_ferramentas'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>2. Movimentação e Cautela de Ferramentas</span>
              {totalEmprestimosAtivos > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-amber-500 text-stone-950 font-black leading-none">
                  {totalEmprestimosAtivos}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('caixa_veiculo')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'caixa_veiculo'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>3. Caixa de Ferramentas Fixa por Veículo</span>
            </button>
          </div>

          {/* 3 Cartões/Pílulas de Resumo Horizontais Ultra-Compactos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <div
              onClick={() => setActiveTab('retirada_pecas')}
              className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 ${
                activeTab === 'retirada_pecas'
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700'
                  : 'bg-zinc-50 dark:bg-stone-800/50 border-zinc-200 dark:border-stone-800 hover:border-zinc-300'
              }`}
            >
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-stone-400 block leading-none">
                  ABA 1 • Saídas
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xs font-black text-zinc-900 dark:text-white leading-tight">
                    {retiradasPecas.length} {retiradasPecas.length === 1 ? 'retirada' : 'retiradas'}
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <PackageMinus className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('cautela_ferramentas')}
              className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 ${
                activeTab === 'cautela_ferramentas'
                  ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700'
                  : 'bg-zinc-50 dark:bg-stone-800/50 border-zinc-200 dark:border-stone-800 hover:border-zinc-300'
              }`}
            >
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-stone-400 block leading-none">
                  ABA 2 • Cautelas
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xs font-black text-zinc-900 dark:text-white leading-tight">
                    {totalEmprestimosAtivos} em uso
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-stone-400 leading-none">
                    ({movimentacoesFerramentas.length})
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('caixa_veiculo')}
              className={`px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 ${
                activeTab === 'caixa_veiculo'
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
                  : 'bg-zinc-50 dark:bg-stone-800/50 border-zinc-200 dark:border-stone-800 hover:border-zinc-300'
              }`}
            >
              <div className="min-w-0">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-stone-400 block leading-none">
                  ABA 3 • Caixa Fixa
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xs font-black text-zinc-900 dark:text-white leading-tight">
                    {resumoCaixaVeiculoAtual.totalItens} itens no veículo
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`no-print shrink-0 px-3.5 py-2 rounded-xl border flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          ABA 1: RETIRADA DE PEÇAS PARA MANUTENÇÃO (FLUXO DE LISTA / PEDIDO POR VEÍCULO)
         ===================================================================== */}
      {activeTab === 'retirada_pecas' && (
        <div className="no-print flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Formulário Esquerdo: Pedido / Lista de Peças por Veículo */}
          <div
            className={`lg:col-span-5 bg-white dark:bg-stone-900 border rounded-xl p-3 shadow-xs flex flex-col min-h-0 overflow-hidden transition ${
              editingRetiradaPeca || editingLoteKey
                ? 'border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20'
                : 'border-zinc-200 dark:border-stone-800'
            }`}
          >
            {/* Cabeçalho do Card da Esquerda */}
            <div className="shrink-0 flex items-center justify-between gap-2 pb-2 mb-2 border-b border-zinc-200 dark:border-stone-800">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    editingRetiradaPeca || editingLoteKey
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {editingRetiradaPeca || editingLoteKey ? (
                    <Pencil className="w-3.5 h-3.5 stroke-[2.4]" />
                  ) : (
                    <ListPlus className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white leading-tight truncate">
                    {editingRetiradaPeca
                      ? 'Editar Lançamento de Peça'
                      : editingLoteKey
                        ? `Editando Pedido (${editingLoteKey})`
                        : 'Pedido / Lista de Peças por Veículo'}
                  </h2>
                  <p className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                    {editingRetiradaPeca ? (
                      <span>Atualiza o registro selecionado em <code className="font-mono">retiradas_pecas</code></span>
                    ) : editingLoteKey ? (
                      <span>Altere as peças na cesta ou inclua novos itens no lote</span>
                    ) : (
                      <span>Monte a cesta do veículo • Baixa híbrida na Ordem de Serviço (OS)</span>
                    )}
                  </p>
                </div>
              </div>

              {(editingRetiradaPeca || editingLoteKey) && (
                <button
                  type="button"
                  onClick={handleCancelarEdicaoRetirada}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-700 dark:text-stone-300 cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>

            <form
              onSubmit={handleSalvarRetiradaPeca}
              className="flex-1 min-h-0 flex flex-col justify-between gap-2 overflow-y-auto pr-0.5"
            >
              <div className="space-y-2">
                {/* 1. VEÍCULO / MÁQUINA (FROTA) — FIXADO AO SELECIONAR */}
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200 dark:border-stone-700/80">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="flex items-center gap-1 text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider">
                      <Car className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>1. Veículo / Máquina (Frota) *</span>
                    </label>

                    {pecaVeiculoId && isVeiculoFixado && !editingRetiradaPeca && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Lock className="w-2.5 h-2.5" />
                          Veículo Fixado
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsVeiculoFixado(false)}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          title="Destravar para trocar de veículo"
                        >
                          <Unlock className="w-2.5 h-2.5" />
                          <span>Trocar</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <select
                    value={pecaVeiculoId}
                    onChange={e => handleSelecionarVeiculoPedido(e.target.value)}
                    disabled={Boolean(pecaVeiculoId && isVeiculoFixado && !editingRetiradaPeca)}
                    required
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition ${
                      pecaVeiculoId && isVeiculoFixado && !editingRetiradaPeca
                        ? 'border-amber-400 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 text-zinc-900 dark:text-white cursor-not-allowed'
                        : 'border-zinc-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white'
                    }`}
                  >
                    <option value="">Selecione o veículo ou máquina de destino...</option>
                    {frotasList.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.plateOrSerial ? `(${m.plateOrSerial})` : ''} {m.model ? `• ${m.model}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. COMBOBOX PESQUISÁVEL DE PEÇAS (BUSCA INTELIGENTE POR NOME, CÓDIGO INTERNO OU CÓD. BARRAS) */}
                <div className="p-2 rounded-lg border border-zinc-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider">
                      {editingRetiradaPeca
                        ? 'Item do Estoque e Quantidade *'
                        : '2. Adicionar Peças ao Pedido do Veículo'}
                    </label>
                    {selectedProductForWithdrawal && (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                        Disponível: <strong>{saldoAtualProdutoSelecionado}</strong>{' '}
                        {selectedProductForWithdrawal.unidade_medida || selectedProductForWithdrawal.unit || 'UN'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-1.5 items-center">
                    <div
                      ref={pecaComboContainerRef}
                      className={`relative ${editingRetiradaPeca ? 'col-span-8' : 'col-span-7'}`}
                    >
                      <div className="relative flex items-center">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={pecaComboSearch}
                          onFocus={() => setIsPecaComboOpen(true)}
                          onChange={e => {
                            const val = e.target.value;
                            setPecaComboSearch(val);
                            setIsPecaComboOpen(true);
                            if (!val.trim()) {
                              setPecaProdutoId('');
                            }
                          }}
                          placeholder="Digite nome, cód. interno ou cód. barras..."
                          className={`w-full pl-8 pr-12 py-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition ${
                            pecaProdutoId
                              ? 'border-amber-400 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 text-zinc-900 dark:text-white'
                              : 'border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-zinc-900 dark:text-white'
                          }`}
                        />
                        <div className="absolute right-1.5 flex items-center gap-0.5">
                          {(pecaComboSearch || pecaProdutoId) && (
                            <button
                              type="button"
                              onClick={handleClearProductCombobox}
                              title="Limpar seleção"
                              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-stone-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-white cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsPecaComboOpen(prev => !prev)}
                            title="Abrir lista de peças do estoque"
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-stone-700 text-zinc-500 dark:text-stone-400 cursor-pointer"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Lista flutuante filtrada reativamente de public.estoque_produtos */}
                      {isPecaComboOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl divide-y divide-zinc-100 dark:divide-stone-800">
                          {filteredEstoqueComboItems.length === 0 ? (
                            <div className="px-3 py-3 text-center text-[11px] text-zinc-500 dark:text-stone-400">
                              Nenhuma peça encontrada para &ldquo;{pecaComboSearch}&rdquo; em{' '}
                              <code className="font-mono">estoque_produtos</code>.
                            </div>
                          ) : (
                            filteredEstoqueComboItems.map(item => {
                              const anyItem = item as any;
                              const qtd = Number(item.quantidade_atual ?? item.quantity ?? 0);
                              const un = item.unidade_medida || item.unit || 'UN';
                              const codigo = String(
                                item.code ?? item.codigo_produto ?? anyItem.codigo_interno ?? ''
                              );
                              const codBarras = String(
                                anyItem.codigo_barras ?? anyItem.barcode ?? anyItem.ref_fabrica ?? ''
                              );
                              const isSelected = item.id === pecaProdutoId;

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectProductFromCombobox(item)}
                                  className={`w-full text-left px-2.5 py-2 flex items-center justify-between gap-2 transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200'
                                      : 'hover:bg-zinc-50 dark:hover:bg-stone-800/70 text-zinc-900 dark:text-white'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-extrabold truncate leading-tight">
                                      {item.nome_comercial || item.name}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500 dark:text-stone-400 font-mono">
                                      {codigo && (
                                        <span className="px-1 py-0.2 rounded bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 font-bold">
                                          Cód: {codigo}
                                        </span>
                                      )}
                                      {codBarras && <span>Ref/Barras: {codBarras}</span>}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black ${
                                        qtd > 0
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                      }`}
                                    >
                                      Saldo: {qtd} {un}
                                    </span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className={editingRetiradaPeca ? 'col-span-4' : 'col-span-2'}>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={pecaQuantidade}
                        onChange={e => setPecaQuantidade(e.target.value)}
                        placeholder="Qtd"
                        title="Quantidade da peça"
                        className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-black text-center text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {!editingRetiradaPeca && (
                      <div className="col-span-3">
                        <button
                          type="button"
                          onClick={handleAdicionarPecaNaCesta}
                          className="w-full py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-[11px] flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Incluir</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. TABELA TEMPORÁRIA (CESTA DE PEÇAS DO VEÍCULO) */}
                {!editingRetiradaPeca && (
                  <div className="border border-zinc-200 dark:border-stone-800 rounded-lg overflow-hidden bg-zinc-50/60 dark:bg-stone-800/30">
                    <div className="px-2.5 py-1.5 bg-zinc-100 dark:bg-stone-800 border-b border-zinc-200 dark:border-stone-700 flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-700 dark:text-stone-300">
                        Cesta do Veículo ({cestaPecasVeiculo.length}{' '}
                        {cestaPecasVeiculo.length === 1 ? 'peça' : 'peças'})
                      </span>
                      {cestaPecasVeiculo.length > 0 && (
                        <button
                          type="button"
                          onClick={handleLimparCestaPedido}
                          className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          Limpar Cesta
                        </button>
                      )}
                    </div>

                    {cestaPecasVeiculo.length === 0 ? (
                      <div className="py-3 px-3 text-center text-[11px] text-zinc-500 dark:text-stone-400">
                        Selecione o veículo acima e clique em <strong>+ Incluir</strong> para adicionar múltiplas peças ao pedido.
                      </div>
                    ) : (
                      <div className="max-h-28 overflow-y-auto divide-y divide-zinc-200/70 dark:divide-stone-700/60">
                        {cestaPecasVeiculo.map(item => (
                          <div
                            key={item.produto_id}
                            className="px-2.5 py-1.5 flex items-center justify-between gap-2 bg-white dark:bg-stone-900/70 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-zinc-900 dark:text-white truncate leading-tight">
                                {item.produto_nome}
                              </div>
                              <div className="text-[10px] text-zinc-500 dark:text-stone-400 font-mono leading-tight">
                                {item.produto_codigo ? `Cód: ${item.produto_codigo} • ` : ''}
                                Estoque: {item.saldo_estoque} {item.produto_unidade}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleAjustarQuantidadeCesta(
                                    item.produto_id,
                                    Math.max(1, Number((item.quantidade - 1).toFixed(2)))
                                  )
                                }
                                className="w-5 h-5 rounded bg-zinc-200 dark:bg-stone-700 font-black text-xs text-zinc-800 dark:text-white hover:bg-zinc-300 cursor-pointer flex items-center justify-center"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                value={item.quantidade}
                                onChange={e =>
                                  handleAjustarQuantidadeCesta(
                                    item.produto_id,
                                    parseFloat(e.target.value) || 1
                                  )
                                }
                                className="w-12 py-0.5 px-1 text-center rounded border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 font-black text-xs text-zinc-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleAjustarQuantidadeCesta(
                                    item.produto_id,
                                    Number((item.quantidade + 1).toFixed(2))
                                  )
                                }
                                className="w-5 h-5 rounded bg-zinc-200 dark:bg-stone-700 font-black text-xs text-zinc-800 dark:text-white hover:bg-zinc-300 cursor-pointer flex items-center justify-center"
                              >
                                +
                              </button>
                              <span className="text-[10px] font-bold text-zinc-500 w-6 truncate">
                                {item.produto_unidade}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoverItemDaCesta(item.produto_id)}
                                title="Remover item do pedido"
                                className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. DATA, OPERADOR DO ALMOXARIFADO E QUEM RETIROU */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-0.5">
                      Data *
                    </label>
                    <input
                      type="date"
                      value={pecaDataRetirada}
                      onChange={e => setPecaDataRetirada(e.target.value)}
                      required
                      className="w-full px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-0.5 truncate">
                      Operador Almox. *
                    </label>
                    <input
                      type="text"
                      list="almox-employees-list"
                      value={pecaOperadorAlmox}
                      onChange={e => setPecaOperadorAlmox(e.target.value)}
                      required
                      placeholder="Quem entregou"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-0.5 truncate">
                      Quem Retirou *
                    </label>
                    <input
                      type="text"
                      list="almox-employees-list"
                      value={pecaRetiradoPor}
                      onChange={e => setPecaRetiradoPor(e.target.value)}
                      required
                      placeholder="Mecânico / Operador"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* 5. BOTÃO PRINCIPAL PRETO: CONFIRMAR PEDIDO E IMPRIMIR CUPOM */}
              <div className="flex items-center gap-2 pt-1.5 shrink-0">
                {(editingRetiradaPeca || editingLoteKey) && (
                  <button
                    type="button"
                    onClick={handleCancelarEdicaoRetirada}
                    className="py-2 px-3 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-700 dark:text-stone-200 font-bold text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingRetiradaPeca}
                  className={`flex-1 py-2 px-3.5 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50 ${
                    editingRetiradaPeca || editingLoteKey
                      ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                      : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:border dark:border-stone-700 text-white'
                  }`}
                >
                  {editingRetiradaPeca || editingLoteKey ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <Printer className="w-3.5 h-3.5 stroke-[2.3]" />
                  )}
                  <span>
                    {isSavingRetiradaPeca
                      ? 'Confirmando Pedido e Gerando Cupom...'
                      : editingRetiradaPeca
                        ? 'Salvar Alterações do Lançamento'
                        : editingLoteKey
                          ? 'Salvar Alterações do Pedido e Imprimir'
                          : 'Confirmar Pedido e Imprimir Cupom'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Lista / Histórico Agrupado por Pedido / Lote Expansível (Accordion / Collapsible) */}
          <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 mb-2 border-b border-zinc-200 dark:border-stone-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">
                    Histórico de Saídas e Lotes de Peças para Manutenção
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    {groupedPedidosLotes.length}{' '}
                    {groupedPedidosLotes.length === 1 ? 'Pedido' : 'Pedidos'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight mt-0.5">
                  Clique em qualquer linha de <strong>Pedido</strong> para expandir as peças do lote ou gerencie pelas ações à direita
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pecaSearchFilter}
                  onChange={e => setPecaSearchFilter(e.target.value)}
                  placeholder="Buscar #pedido, placa, veículo, peça..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {groupedPedidosLotes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-400 mb-2">
                  <PackageMinus className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-zinc-700 dark:text-stone-300">
                  Nenhum pedido de peças registrado ainda
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-stone-400 max-w-sm mt-0.5">
                  Selecione um veículo ao lado, adicione as peças na cesta e clique em &ldquo;Confirmar Pedido e Imprimir Cupom&rdquo;.
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white dark:bg-stone-900 z-10">
                    <tr className="border-b border-zinc-200 dark:border-stone-800 text-[10px] font-extrabold text-zinc-500 dark:text-stone-400 uppercase tracking-wider">
                      <th className="py-2 px-2">Data / Pedido</th>
                      <th className="py-2 px-2">Veículo Destino (Modelo / Placa)</th>
                      <th className="py-2 px-2">Status / Lote</th>
                      <th className="py-2 px-2">Quem Retirou / Almox.</th>
                      <th className="py-2 px-2 text-right">Ações do Pedido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-stone-800/80 text-xs">
                    {groupedPedidosLotes.map(grupo => {
                      const isExpanded = Boolean(expandedLotes[grupo.loteKey]);
                      const isAguardando = grupo.status.toLowerCase().includes('aguardando');
                      const firstRecord = grupo.items[0];
                      const isEditingThisBatch =
                        editingLoteKey === grupo.loteKey ||
                        (editingRetiradaPeca &&
                          grupo.items.some(it => it.id === editingRetiradaPeca.id));

                      return (
                        <React.Fragment key={grupo.loteKey}>
                          {/* LINHA PRINCIPAL DO PEDIDO FECHADO (CLICÁVEL PARA EXPANDIR) */}
                          <tr
                            onClick={() => handleToggleExpandLote(grupo.loteKey)}
                            className={`cursor-pointer transition select-none ${
                              isEditingThisBatch
                                ? 'bg-amber-50/90 dark:bg-amber-950/40'
                                : isExpanded
                                  ? 'bg-zinc-50 dark:bg-stone-800/60'
                                  : 'hover:bg-zinc-50/80 dark:hover:bg-stone-800/40'
                            }`}
                          >
                            {/* 1. Data e Número do Pedido (#1024 + código do lote) */}
                            <td className="py-2.5 px-2 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 ${
                                    isExpanded
                                      ? 'bg-amber-500 text-stone-950'
                                      : 'bg-zinc-100 dark:bg-stone-800 text-zinc-600 dark:text-stone-300'
                                  }`}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                  )}
                                </span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-black text-zinc-900 dark:text-white text-xs">
                                      Pedido {grupo.numeroPedido}
                                    </span>
                                    <span className="text-[10px] font-semibold text-zinc-500 dark:text-stone-400">
                                      • {formatDateOnlyPtBr(grupo.dataRetirada)}
                                    </span>
                                  </div>
                                  <div className="text-[9px] font-mono font-bold text-zinc-500 dark:text-stone-400 leading-tight mt-0.5">
                                    {grupo.loteCodigo}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Veículo Destino com modelo e PLACA de forma clara */}
                            <td className="py-2.5 px-2">
                              <div className="font-black text-zinc-900 dark:text-white leading-tight flex flex-wrap items-center gap-1.5">
                                <span>{grupo.veiculoNome}</span>
                                {grupo.veiculoPlaca && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-900 text-white dark:bg-stone-700 dark:text-amber-300 font-mono text-[10px] font-black tracking-wider">
                                    {grupo.veiculoPlaca}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500 dark:text-stone-400 truncate max-w-[230px] mt-0.5">
                                {grupo.items
                                  .slice(0, 2)
                                  .map(i => i.produto_nome)
                                  .join(', ')}
                                {grupo.items.length > 2 ? ` +${grupo.items.length - 2}` : ''}
                              </div>
                            </td>

                            {/* 3. Status Geral e Contagem de Peças do Lote */}
                            <td className="py-2.5 px-2 whitespace-nowrap">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold leading-none ${
                                    isAguardando
                                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                      : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                  }`}
                                >
                                  {grupo.status}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-zinc-600 dark:text-stone-300">
                                  <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-black">
                                    {grupo.totalItens} {grupo.totalItens === 1 ? 'peça' : 'peças'}
                                  </span>
                                  <span className="text-zinc-400">•</span>
                                  <span>{grupo.totalQuantidade} un. total</span>
                                </span>
                              </div>
                            </td>

                            {/* 4. Identificação de "Quem retirou" e Operador na linha principal */}
                            <td className="py-2.5 px-2">
                              <div className="text-zinc-900 dark:text-white font-extrabold leading-tight">
                                Retirou:{' '}
                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                  {grupo.retiradoPor}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight mt-0.5">
                                Almox.: {grupo.operadorAlmoxarifado}
                              </div>
                            </td>

                            {/* 5. Botões de AÇÃO na linha principal do Pedido */}
                            <td
                              className="py-2.5 px-2 text-right whitespace-nowrap"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="inline-flex items-center justify-end gap-1">
                                {/* Engrenagem: Puxar Lote Completo para Nova Ordem de Serviço */}
                                {firstRecord && (
                                  <button
                                    type="button"
                                    onClick={() => handleLancarLoteNaManutencaoOS(firstRecord, grupo.items)}
                                    title={`Puxar Pedido ${grupo.numeroPedido} (${grupo.totalItens} peça(s)) para Nova Ordem de Serviço (OS)`}
                                    className="p-1.5 rounded-lg text-amber-600 hover:text-amber-950 bg-amber-50 hover:bg-amber-400 dark:bg-amber-950/50 dark:text-amber-400 dark:hover:bg-amber-500 dark:hover:text-stone-950 border border-amber-200 dark:border-amber-800 transition cursor-pointer"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Lápis: Carregar Pedido / Lote Completo na cesta à esquerda para edição */}
                                <button
                                  type="button"
                                  onClick={() => handleIniciarEdicaoLote(grupo.loteKey, grupo.items)}
                                  title={`Editar Pedido ${grupo.numeroPedido} completo na cesta à esquerda`}
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    editingLoteKey === grupo.loteKey
                                      ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60'
                                      : 'text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:text-stone-400 dark:hover:text-amber-400 dark:hover:bg-amber-950/40'
                                  }`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {/* Impressora de Cupom do Lote */}
                                {firstRecord && (
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirCupomLote(firstRecord, false, grupo.items)}
                                    title={`Imprimir Cupom de Retirada / Cautela do Pedido ${grupo.numeroPedido}`}
                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:text-stone-400 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 transition cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Lixeira: Excluir Pedido / Lote Completo */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleExcluirLoteCompleto(
                                      grupo.loteKey,
                                      grupo.numeroPedido,
                                      grupo.items
                                    )
                                  }
                                  title={`Excluir Pedido ${grupo.numeroPedido} completo`}
                                  className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* PAINEL EXPANSÍVEL (ACCORDION / COLLAPSIBLE): LISTA DE PEÇAS E QUANTIDADES DO PEDIDO */}
                          {isExpanded && (
                            <tr className="bg-zinc-50/90 dark:bg-stone-950/60">
                              <td colSpan={5} className="px-3 py-2.5 border-l-4 border-amber-500">
                                <div className="rounded-lg border border-zinc-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden shadow-2xs">
                                  <div className="px-3 py-1.5 bg-zinc-100/80 dark:bg-stone-800/80 border-b border-zinc-200 dark:border-stone-800 flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-stone-300">
                                      Itens contidos no Pedido {grupo.numeroPedido} ({grupo.loteCodigo}) •{' '}
                                      {grupo.veiculoDisplayCompleto}
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-stone-400">
                                      {grupo.totalItens} {grupo.totalItens === 1 ? 'item' : 'itens'} no lote
                                    </span>
                                  </div>

                                  <div className="divide-y divide-zinc-100 dark:divide-stone-800">
                                    {grupo.items.map((peca, idx) => (
                                      <div
                                        key={peca.id}
                                        className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-zinc-50/70 dark:hover:bg-stone-800/40"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-stone-800 text-zinc-600 dark:text-stone-400 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                                            {idx + 1}
                                          </span>
                                          <div className="min-w-0">
                                            <div className="font-bold text-zinc-900 dark:text-white truncate">
                                              {peca.produto_nome || 'Peça do Estoque'}
                                            </div>
                                            {peca.produto_codigo && (
                                              <div className="text-[10px] font-mono text-zinc-500 dark:text-stone-400">
                                                Código Interno / Barras: {peca.produto_codigo}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          {peca.endereco_formatado && (
                                            <span
                                              title="Localização física no Almoxarifado (Setor.Rua.Estante.Nível.Box)"
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-black text-[10px] bg-zinc-100 text-zinc-900 dark:bg-stone-800 dark:text-amber-300 border border-zinc-300 dark:border-stone-700"
                                            >
                                              End.: {peca.endereco_formatado}
                                            </span>
                                          )}
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-black text-[11px] bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                            {peca.quantidade} {peca.produto_unidade || 'UN'}
                                          </span>

                                          <button
                                            type="button"
                                            onClick={() => handleIniciarEdicaoRetirada(peca)}
                                            title="Editar apenas esta peça"
                                            className="p-1 rounded text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleExcluirRetiradaPeca(peca)}
                                            title="Remover apenas esta peça do lote"
                                            className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 2: MOVIMENTAÇÃO E CAUTELA DE FERRAMENTAS (COM DOCUMENTO DE ASSINATURA)
         ===================================================================== */}
      {activeTab === 'cautela_ferramentas' && (
        <div className="no-print flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Formulário de Nova Cautela / Retirada de Ferramenta */}
          <div className="lg:col-span-4 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs overflow-y-auto">
            <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-zinc-200 dark:border-stone-800">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">
                  Nova Cautela de Ferramenta
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight">
                  Controle de empréstimo de ferramentas de uso comum
                </p>
              </div>
            </div>

            <form
              onSubmit={e => handleRegistrarCautela(e, false)}
              className="space-y-2.5"
            >
              {/* Preenchimento rápido opcional a partir de itens cadastrados */}
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-stone-400 uppercase tracking-wider mb-1">
                  Preencher Rápido do Cadastro (Opcional)
                </label>
                <select
                  defaultValue=""
                  onChange={e => handleQuickSelectToolFromStock(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-700 dark:text-stone-300"
                >
                  <option value="">Digitar manualmente abaixo ou escolher item...</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `[${p.code}] ` : ''}{p.nome_comercial || p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={ferCodigo}
                    onChange={e => setFerCodigo(e.target.value)}
                    required
                    placeholder="Ex: FER-01"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Nome da Ferramenta *
                  </label>
                  <input
                    type="text"
                    value={ferNome}
                    onChange={e => setFerNome(e.target.value)}
                    required
                    placeholder="Ex: Torquímetro de Estalo, Lixadeira..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Data e Hora da Retirada *
                </label>
                <input
                  type="datetime-local"
                  value={ferDataHoraRetirada}
                  onChange={e => setFerDataHoraRetirada(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Operador Almox. *
                  </label>
                  <input
                    type="text"
                    list="almox-employees-list"
                    value={ferOperadorAlmox}
                    onChange={e => setFerOperadorAlmox(e.target.value)}
                    required
                    placeholder="Quem entregou"
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Quem Retirou *
                  </label>
                  <input
                    type="text"
                    list="almox-employees-list"
                    value={ferRetiradoPor}
                    onChange={e => setFerRetiradoPor(e.target.value)}
                    required
                    placeholder="Quem pegou"
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-1 space-y-1.5">
                <button
                  type="submit"
                  disabled={isSavingCautela}
                  className="w-full py-2 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Registrar Empréstimo / Cautela</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingCautela}
                  onClick={e => handleRegistrarCautela(e as any, true)}
                  className="w-full py-2 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Registrar e Imprimir Termo (A4)</span>
                </button>
              </div>
            </form>
          </div>

          {/* Lista Ativa de Ferramentas Emprestadas e Devolvidas */}
          <div className="lg:col-span-8 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 mb-2.5 border-b border-zinc-200 dark:border-stone-800">
              <div>
                <h2 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">
                  Controle Ativo de Empréstimos e Devoluções
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight">
                  Sincronizado com <code className="font-mono">public.movimentacao_ferramentas</code>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-stone-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setFerStatusFilter('todas')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      ferStatusFilter === 'todas'
                        ? 'bg-white dark:bg-stone-700 text-zinc-900 dark:text-white shadow-2xs'
                        : 'text-zinc-600 dark:text-stone-400'
                    }`}
                  >
                    Todas ({movimentacoesFerramentas.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFerStatusFilter('ativas')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      ferStatusFilter === 'ativas'
                        ? 'bg-amber-500 text-stone-950 shadow-2xs'
                        : 'text-zinc-600 dark:text-stone-400'
                    }`}
                  >
                    Em Uso ({totalEmprestimosAtivos})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFerStatusFilter('devolvidas')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      ferStatusFilter === 'devolvidas'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-zinc-600 dark:text-stone-400'
                    }`}
                  >
                    Devolvidas ({movimentacoesFerramentas.length - totalEmprestimosAtivos})
                  </button>
                </div>

                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ferSearchTerm}
                    onChange={e => setFerSearchTerm(e.target.value)}
                    placeholder="Buscar ferramenta ou nome..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {filteredMovimentacoesFerramentas.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-400 mb-2">
                  <Wrench className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-zinc-700 dark:text-stone-300">
                  Nenhuma movimentação de ferramenta encontrada
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-stone-400 max-w-sm mt-0.5">
                  Registre a saída de torquímetros, lixadeiras ou outras ferramentas de uso comum e imprima o Termo de Cautela para assinatura.
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                {filteredMovimentacoesFerramentas.map(item => {
                  const isDevolvido =
                    Boolean(item.data_devolucao) ||
                    String(item.status).toLowerCase() === 'devolvido';

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isDevolvido
                          ? 'bg-zinc-50/70 dark:bg-stone-800/40 border-zinc-200 dark:border-stone-800'
                          : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/70'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-zinc-200 dark:bg-stone-700 text-zinc-800 dark:text-stone-200">
                            {item.codigo_ferramenta}
                          </span>
                          <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                            {item.nome_ferramenta}
                          </h3>
                          {isDevolvido ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Devolvido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-200/80 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-400 dark:border-amber-700">
                              <Clock className="w-3 h-3" />
                              Em Uso (Pendente Devolução)
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-600 dark:text-stone-300">
                          <div>
                            <strong className="text-zinc-900 dark:text-white">Quem Retirou:</strong>{' '}
                            {item.retirado_por}
                          </div>
                          <div>
                            <strong className="text-zinc-900 dark:text-white">Operador Almox.:</strong>{' '}
                            {item.operador_almoxarifado}
                          </div>
                          <div>
                            <strong className="text-zinc-900 dark:text-white">Retirada em:</strong>{' '}
                            {formatDateTimePtBr(item.data_retirada)}
                          </div>
                          {isDevolvido && (
                            <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              <strong>Devolvido em:</strong> {formatDateTimePtBr(item.data_devolucao)}{' '}
                              {item.conferido_por ? `(Conferido por: ${item.conferido_por})` : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!isDevolvido && (
                          <button
                            type="button"
                            onClick={() => handleOpenDevolucaoModal(item)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Registrar Devolução</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setTermoPrintItem(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-zinc-300 dark:border-stone-700 bg-white hover:bg-zinc-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-800 dark:text-stone-200 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Imprimir Termo de Cautela</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExcluirCautela(item)}
                          title="Excluir registro"
                          className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 3: CAIXA DE FERRAMENTAS FIXA POR VEÍCULO
         ===================================================================== */}
      {activeTab === 'caixa_veiculo' && (
        <div className="no-print flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto">
          {/* Seletor de Veículo e Painel de Conferência */}
          <div className="shrink-0 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
              <div className="w-full lg:max-w-md">
                <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Selecione o Veículo / Máquina da Frota *
                </label>
                <select
                  value={selectedCaixaVeiculoId}
                  onChange={e => {
                    setSelectedCaixaVeiculoId(e.target.value);
                    setIsConferenciaMode(false);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Escolha um veículo da frota...</option>
                  {frotasList.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.plateOrSerial ? `(${m.plateOrSerial})` : ''} {m.model ? `• ${m.model}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCaixaVeiculoId && (
                <div className="flex flex-wrap items-center gap-2">
                  {itensCaixaDoVeiculo.length === 0 && (
                    <button
                      type="button"
                      disabled={isAddingItemCaixa}
                      onClick={handlePopularKitPadraoVeiculo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-300 dark:border-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Carregar Kit Padrão</span>
                    </button>
                  )}

                  {!isConferenciaMode ? (
                    <button
                      type="button"
                      disabled={itensCaixaDoVeiculo.length === 0}
                      onClick={handleIniciarConferenciaCaixa}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition cursor-pointer disabled:opacity-40"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Realizar Conferência de Caixa</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConferenciaMode(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-300 dark:border-stone-700 bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancelar Conferência</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Status da última conferência do veículo selecionado */}
            {selectedCaixaVeiculoId && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-stone-800 text-xs">
                <div className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200/80 dark:border-stone-800">
                  <span className="text-[9px] font-extrabold uppercase text-zinc-500 dark:text-stone-400 block leading-none">
                    Veículo Selecionado
                  </span>
                  <span className="font-black text-xs text-zinc-900 dark:text-white leading-tight block mt-0.5 truncate">
                    {selectedCaixaVehicle?.name || 'Veículo'}
                  </span>
                </div>

                <div className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200/80 dark:border-stone-800">
                  <span className="text-[9px] font-extrabold uppercase text-zinc-500 dark:text-stone-400 block leading-none">
                    Total de Ferramentas Fixas
                  </span>
                  <span className="font-black text-xs text-zinc-900 dark:text-white leading-tight block mt-0.5">
                    {resumoCaixaVeiculoAtual.totalItens} itens cadastrados
                  </span>
                </div>

                <div className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200/80 dark:border-stone-800">
                  <span className="text-[9px] font-extrabold uppercase text-zinc-500 dark:text-stone-400 block leading-none">
                    Situação da Caixa
                  </span>
                  {resumoCaixaVeiculoAtual.itensFaltantes > 0 ? (
                    <span className="font-black text-xs text-rose-600 dark:text-rose-400 leading-tight block mt-0.5">
                      {resumoCaixaVeiculoAtual.itensFaltantes} item(ns) em falta
                    </span>
                  ) : (
                    <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 leading-tight block mt-0.5">
                      100% Completa ({resumoCaixaVeiculoAtual.itensCompletos} OK)
                    </span>
                  )}
                </div>

                <div className="px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200/80 dark:border-stone-800">
                  <span className="text-[9px] font-extrabold uppercase text-zinc-500 dark:text-stone-400 block leading-none">
                    Última Conferência
                  </span>
                  <span className="font-bold text-xs text-zinc-900 dark:text-white leading-tight block mt-0.5 truncate">
                    {resumoCaixaVeiculoAtual.ultimaConf
                      ? formatDateTimePtBr(resumoCaixaVeiculoAtual.ultimaConf)
                      : 'Ainda não conferida'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Painel de Conferência Ativa Compacto */}
          {isConferenciaMode && (
            <form
              onSubmit={handleSalvarConferenciaCaixa}
              className="shrink-0 bg-emerald-50/70 dark:bg-emerald-950/25 border-2 border-emerald-500 dark:border-emerald-700 rounded-xl p-3.5 shadow-sm space-y-2.5 animate-in fade-in duration-150"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100 leading-tight">
                      Modo de Conferência de Caixa Ativo — {selectedCaixaVehicle?.name}
                    </h3>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight">
                      Verifique cada ferramenta abaixo, ajuste a Quantidade Atual e informe quem realizou a conferência.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const allOk: Record<string, number> = {};
                    itensCaixaDoVeiculo.forEach(i => {
                      allOk[i.id] = i.quantidade_esperada;
                    });
                    setConferenciaQuantidades(allOk);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-stone-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer self-start sm:self-auto"
                >
                  Marcar Todos Completos
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-extrabold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider mb-1">
                    Conferido Por (Operador / Responsável) *
                  </label>
                  <input
                    type="text"
                    list="almox-employees-list"
                    value={conferenciaConferidoPor}
                    onChange={e => setConferenciaConferidoPor(e.target.value)}
                    required
                    placeholder="Digite o nome de quem conferiu a caixa"
                    className="w-full px-3 py-1.5 rounded-lg border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-stone-900 text-xs font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider mb-1">
                    Data e Hora da Conferência *
                  </label>
                  <input
                    type="datetime-local"
                    value={conferenciaData}
                    onChange={e => setConferenciaData(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 rounded-lg border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-stone-900 text-xs font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSavingConferencia}
                    className="w-full py-1.5 px-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>
                      {isSavingConferencia ? 'Gravando Conferência...' : 'Salvar Conferência de Caixa'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Grid: Adicionar Nova Ferramenta Fixa + Tabela de Inventário da Caixa */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Formulário para Adicionar Ferramenta Fixa ao Veículo */}
            <div className="lg:col-span-4 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs h-fit">
              <h3 className="text-xs font-black text-zinc-900 dark:text-white pb-2 mb-2.5 border-b border-zinc-200 dark:border-stone-800 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Adicionar Ferramenta Fixa à Caixa</span>
              </h3>

              <form onSubmit={handleAdicionarFerramentaCaixa} className="space-y-2.5">
                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Código do Item *
                  </label>
                  <input
                    type="text"
                    value={novaFerramentaCaixaCodigo}
                    onChange={e => setNovaFerramentaCaixaCodigo(e.target.value)}
                    required
                    placeholder="Ex: CX-001, MAC-12T"
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Nome da Ferramenta *
                  </label>
                  <input
                    type="text"
                    value={novaFerramentaCaixaNome}
                    onChange={e => setNovaFerramentaCaixaNome(e.target.value)}
                    required
                    placeholder="Ex: Macaco Hidráulico, Chave de Roda"
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                      Qtd. Esperada *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={novaFerramentaCaixaQtdEsperada}
                      onChange={e => {
                        setNovaFerramentaCaixaQtdEsperada(e.target.value);
                        setNovaFerramentaCaixaQtdAtual(e.target.value);
                      }}
                      required
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                      Qtd. Atual *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={novaFerramentaCaixaQtdAtual}
                      onChange={e => setNovaFerramentaCaixaQtdAtual(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAddingItemCaixa || !selectedCaixaVeiculoId}
                  className="w-full py-2 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Incluir na Caixa do Veículo</span>
                </button>
              </form>
            </div>

            {/* Tabela de Ferramentas Fixas do Veículo Selecionado */}
            <div className="lg:col-span-8 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs flex flex-col min-h-0 overflow-hidden">
              <div className="shrink-0 flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-200 dark:border-stone-800">
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">
                    Inventário da Caixa de Ferramentas — {selectedCaixaVehicle?.name || 'Selecione um Veículo'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight">
                    Sincronizado com <code className="font-mono">public.caixa_ferramentas_veiculo</code>
                  </p>
                </div>
              </div>

              {itensCaixaDoVeiculo.length === 0 ? (
                <div className="flex-1 py-6 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-400 mb-2">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-zinc-700 dark:text-stone-300">
                    Nenhuma ferramenta fixa cadastrada para este veículo
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-stone-400 max-w-md mt-0.5 mb-3">
                    Adicione manualmente ao lado ou clique no botão abaixo para incluir o kit padrão (Macaco, Chave de Roda, Triângulo, Chaves Combinadas).
                  </p>
                  {selectedCaixaVeiculoId && (
                    <button
                      type="button"
                      onClick={handlePopularKitPadraoVeiculo}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Adicionar Kit Padrão Agora</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white dark:bg-stone-900 z-10">
                      <tr className="border-b border-zinc-200 dark:border-stone-800 text-[10px] font-extrabold text-zinc-500 dark:text-stone-400 uppercase tracking-wider">
                        <th className="py-2 px-2.5">Código do Item</th>
                        <th className="py-2 px-2.5">Nome da Ferramenta</th>
                        <th className="py-2 px-2.5 text-center">Qtd. Esperada</th>
                        <th className="py-2 px-2.5 text-center">Qtd. Atual</th>
                        <th className="py-2 px-2.5">Status / Conferência</th>
                        <th className="py-2 px-2 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-stone-800/80 text-xs">
                      {itensCaixaDoVeiculo.map(item => {
                        const qtdAtualExibida = isConferenciaMode
                          ? (conferenciaQuantidades[item.id] ?? item.quantidade_atual)
                          : item.quantidade_atual;
                        const falta = Number(item.quantidade_esperada) - Number(qtdAtualExibida);

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-zinc-50/80 dark:hover:bg-stone-800/40 transition"
                          >
                            <td className="py-3 px-3 font-mono font-black text-zinc-800 dark:text-stone-200">
                              {item.codigo_item_ferramenta}
                            </td>
                            <td className="py-3 px-3 font-bold text-zinc-900 dark:text-white">
                              {item.nome_ferramenta}
                            </td>
                            <td className="py-3 px-3 text-center font-black text-zinc-700 dark:text-stone-300">
                              {item.quantidade_esperada}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isConferenciaMode ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConferenciaQuantidades(prev => ({
                                        ...prev,
                                        [item.id]: Math.max(0, (prev[item.id] ?? item.quantidade_atual) - 1),
                                      }))
                                    }
                                    className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-stone-700 font-black text-zinc-900 dark:text-white hover:bg-zinc-300 cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={qtdAtualExibida}
                                    onChange={e =>
                                      setConferenciaQuantidades(prev => ({
                                        ...prev,
                                        [item.id]: Math.max(0, Number(e.target.value) || 0),
                                      }))
                                    }
                                    className="w-14 text-center py-1 rounded-lg border border-emerald-500 bg-white dark:bg-stone-900 font-black text-sm text-zinc-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConferenciaQuantidades(prev => ({
                                        ...prev,
                                        [item.id]: (prev[item.id] ?? item.quantidade_atual) + 1,
                                      }))
                                    }
                                    className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-stone-700 font-black text-zinc-900 dark:text-white hover:bg-zinc-300 cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black ${
                                    falta > 0
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  }`}
                                >
                                  {qtdAtualExibida}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {falta > 0 ? (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-extrabold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Faltando {falta} un.
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Completo / OK
                                </span>
                              )}
                              {item.conferido_por && (
                                <div className="text-[10px] text-zinc-500 dark:text-stone-400 mt-0.5">
                                  Conf.: {item.conferido_por} ({formatDateOnlyPtBr(item.ultima_conferencia)})
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoverItemCaixa(item)}
                                title="Remover ferramenta da caixa"
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: REGISTRAR DEVOLUÇÃO DE FERRAMENTA (ABA 2)
         ===================================================================== */}
      {devolucaoTarget && (
        <div className="no-print fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white">
                    Registrar Devolução de Ferramenta
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-stone-400">
                    [{devolucaoTarget.codigo_ferramenta}] {devolucaoTarget.nome_ferramenta}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDevolucaoTarget(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmarDevolucao} className="space-y-4">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-stone-800 text-xs space-y-1">
                <div>
                  <strong>Retirado por:</strong> {devolucaoTarget.retirado_por}
                </div>
                <div>
                  <strong>Data da Retirada:</strong> {formatDateTimePtBr(devolucaoTarget.data_retirada)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Data e Hora da Devolução (Preenchido Automaticamente) *
                </label>
                <input
                  type="datetime-local"
                  value={devolucaoDataHora}
                  onChange={e => setDevolucaoDataHora(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Conferido Por (Operador do Almoxarifado) *
                </label>
                <input
                  type="text"
                  list="almox-employees-list"
                  autoFocus
                  value={devolucaoConferidoPor}
                  onChange={e => setDevolucaoConferidoPor(e.target.value)}
                  required
                  placeholder="Nome de quem conferiu e recebeu a ferramenta"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-500 bg-white dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDevolucaoTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDevolucao}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingDevolucao ? 'Salvando...' : 'Confirmar Devolução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL / DOCUMENTO A4: TERMO DE RESPONSABILIDADE E RETIRADA DE FERRAMENTA
         ===================================================================== */}
      {termoPrintItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-white print:p-0 print:block">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #termo-cautela-a4-sheet,
              #termo-cautela-a4-sheet * {
                visibility: visible !important;
              }
              #termo-cautela-a4-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                min-height: 270mm !important;
                margin: 0 !important;
                padding: 18mm !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
                color: #000000 !important;
              }
            }
          `}</style>

          <div className="bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none">
            {/* Barra de Topo do Modal (Oculta na Impressão) */}
            <div className="no-print px-5 py-3.5 bg-zinc-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    Termo de Cautela — Visualização de Impressão (A4)
                  </h3>
                  <p className="text-[11px] text-zinc-300">
                    Documento pronto para impressão em folha A4 ou salvamento em PDF
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-stone-950 transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Gerar PDF (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTermoPrintItem(null)}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Folha A4 Limpa */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-zinc-100 dark:bg-stone-950 print:p-0 print:bg-white">
              <div
                id="termo-cautela-a4-sheet"
                className="bg-white text-black mx-auto max-w-[210mm] min-h-[260mm] p-8 sm:p-12 border border-zinc-300 shadow-md flex flex-col justify-between font-serif"
              >
                {/* Topo / Cabeçalho A4 */}
                <div className="space-y-6">
                  <div className="border-b-2 border-black pb-5 text-center space-y-1.5">
                    {companyProfile?.tradeName && (
                      <p className="text-xs font-sans font-bold uppercase tracking-widest text-zinc-600">
                        {companyProfile.tradeName}{' '}
                        {companyProfile.cnpj ? `• CNPJ: ${companyProfile.cnpj}` : ''}
                      </p>
                    )}
                    <h1 className="text-xl sm:text-2xl font-sans font-black uppercase tracking-tight text-black">
                      Termo de Responsabilidade e Retirada de Ferramenta
                    </h1>
                    <p className="text-xs font-sans font-semibold text-zinc-600">
                      Controle Interno de Cautela e Segurança de Ativos do Almoxarifado
                    </p>
                  </div>

                  {/* Quadro de Dados da Retirada */}
                  <div className="border border-black rounded-lg overflow-hidden font-sans">
                    <div className="bg-zinc-100 px-4 py-2 border-b border-black text-xs font-black uppercase tracking-wider">
                      Dados da Ferramenta e Movimentação
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-black border-b border-black">
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Código da Ferramenta
                        </span>
                        <span className="text-base font-black font-mono text-black">
                          {termoPrintItem.codigo_ferramenta}
                        </span>
                      </div>
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Nome / Descrição da Ferramenta
                        </span>
                        <span className="text-base font-black text-black">
                          {termoPrintItem.nome_ferramenta}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-black border-b border-black">
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Data e Hora da Retirada
                        </span>
                        <span className="text-sm font-bold text-black">
                          {formatDateTimePtBr(termoPrintItem.data_retirada)}
                        </span>
                      </div>
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Operador do Almoxarifado (Entregue por)
                        </span>
                        <span className="text-sm font-bold text-black">
                          {termoPrintItem.operador_almoxarifado}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-zinc-50">
                      <span className="block text-[10px] font-bold uppercase text-zinc-600">
                        Nome de Quem Retirou (Responsável pela Guarda e Uso)
                      </span>
                      <span className="text-base font-black text-black">
                        {termoPrintItem.retirado_por}
                      </span>
                    </div>
                  </div>

                  {/* Declaração de Responsabilidade */}
                  <div className="space-y-3 text-sm leading-relaxed text-justify font-sans text-zinc-900 pt-2">
                    <p>
                      Pelo presente <strong>Termo de Responsabilidade e Retirada de Ferramenta</strong>,
                      eu, <strong>{termoPrintItem.retirado_por}</strong>, declaro ter recebido do
                      Almoxarifado, entregue pelo operador{' '}
                      <strong>{termoPrintItem.operador_almoxarifado}</strong> na data e horário
                      acima discriminados, a ferramenta{' '}
                      <strong>
                        {termoPrintItem.nome_ferramenta} (Código: {termoPrintItem.codigo_ferramenta})
                      </strong>{' '}
                      em perfeitas condições de uso, conservação e funcionamento.
                    </p>
                    <p>
                      Comprometo-me a utilizar o equipamento exclusivamente para as atividades
                      operacionais e de manutenção da empresa, zelando por sua guarda e integridade,
                      bem como a devolvê-lo ao Almoxarifado imediatamente após o término do serviço
                      para baixa e conferência.
                    </p>
                  </div>

                  {/* Quadro opcional de Devolução (para preenchimento na entrega ou já devolvido) */}
                  <div className="border border-zinc-400 rounded-lg p-4 font-sans text-xs space-y-2 bg-zinc-50/50">
                    <div className="font-black uppercase tracking-wider text-zinc-700">
                      Comprovante de Devolução ao Almoxarifado
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div>
                        <span className="text-zinc-600 font-bold">Data/Hora da Devolução: </span>
                        <span className="font-bold">
                          {termoPrintItem.data_devolucao
                            ? formatDateTimePtBr(termoPrintItem.data_devolucao)
                            : '____/____/________ às ____:____'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-600 font-bold">Conferido por: </span>
                        <span className="font-bold">
                          {termoPrintItem.conferido_por || '____________________________________'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rodapé com Linha Pontilhada para Assinatura Física */}
                <div className="pt-16 pb-4 font-sans space-y-10">
                  <div className="text-center max-w-md mx-auto">
                    <div className="border-b-2 border-dotted border-black w-full mb-2 h-8" />
                    <p className="text-sm font-black uppercase text-black">
                      {termoPrintItem.retirado_por}
                    </p>
                    <p className="text-xs font-semibold text-zinc-600">
                      Assinatura Física de quem retirou o equipamento
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-10 pt-4 text-center text-xs">
                    <div>
                      <div className="border-b border-dotted border-zinc-500 w-full mb-1.5 h-6" />
                      <p className="font-bold text-zinc-800">
                        {termoPrintItem.operador_almoxarifado}
                      </p>
                      <p className="text-[11px] text-zinc-500">Operador do Almoxarifado</p>
                    </div>
                    <div>
                      <div className="border-b border-dotted border-zinc-500 w-full mb-1.5 h-6" />
                      <p className="font-bold text-zinc-800">Visto na Devolução</p>
                      <p className="text-[11px] text-zinc-500">Conferência de Retorno</p>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-zinc-400 border-t border-zinc-200 pt-3">
                    Documento emitido em {formatDateTimePtBr(new Date().toISOString())} • ID Cautela:{' '}
                    {termoPrintItem.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL / DOCUMENTO A4: CUPOM DE RETIRADA / CAUTELA DE PEÇAS EM LOTE (ABA 1)
         ===================================================================== */}
      {cupomLotePrint &&
        createPortal(
          <div
            id="cupom-retirada-lote-overlay"
            className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-white print:p-0 print:block"
          >
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 6mm 8mm;
                }
                body > #root,
                .no-print,
                .print\\:hidden,
                #cupom-retirada-lote-header-bar,
                #btn-imprimir-cupom-lote,
                #btn-fechar-cupom-lote {
                  display: none !important;
                  visibility: hidden !important;
                  height: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                html, body,
                #cupom-retirada-lote-overlay,
                #cupom-retirada-lote-modal-box,
                #cupom-retirada-lote-scroll-wrap {
                  position: static !important;
                  display: block !important;
                  visibility: visible !important;
                  background: #ffffff !important;
                  background-color: #ffffff !important;
                  backdrop-filter: none !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  max-height: none !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  overflow: visible !important;
                }
                #cupom-retirada-lote-a4-sheet,
                #cupom-retirada-lote-a4-sheet * {
                  visibility: visible !important;
                }
                #cupom-retirada-lote-a4-sheet {
                  position: static !important;
                  width: 100% !important;
                  max-width: 198mm !important;
                  min-height: auto !important;
                  height: auto !important;
                  margin: 0 auto !important;
                  padding: 4mm 6mm !important;
                  box-shadow: none !important;
                  border: none !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                }
                #cupom-retirada-lote-a4-sheet table {
                  table-layout: fixed !important;
                  width: 100% !important;
                }
                #cupom-retirada-lote-a4-sheet table th,
                #cupom-retirada-lote-a4-sheet table td {
                  padding-top: 2px !important;
                  padding-bottom: 2px !important;
                }
                #cupom-retirada-lote-a4-sheet table td.desc-cell,
                #cupom-retirada-lote-a4-sheet table td:nth-child(3) {
                  white-space: nowrap !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                  font-weight: 500 !important;
                }
                #cupom-retirada-lote-a4-sheet table td.loc-cell,
                #cupom-retirada-lote-a4-sheet table td:nth-child(4) {
                  max-width: 125px !important;
                  width: 125px !important;
                  overflow: hidden !important;
                  box-sizing: border-box !important;
                }
                #cupom-retirada-lote-a4-sheet table td.loc-cell > div,
                #cupom-retirada-lote-a4-sheet .loc-badge {
                  max-width: 100% !important;
                  box-sizing: border-box !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                  white-space: nowrap !important;
                }
              }
            `}</style>

            <div
              id="cupom-retirada-lote-modal-box"
              className="bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none"
            >
              {/* Barra de Topo do Modal (Oculta na Impressão via display: none) */}
              <div
                id="cupom-retirada-lote-header-bar"
                className="no-print print:hidden px-5 py-3.5 bg-zinc-900 text-white flex items-center justify-between shrink-0"
              >
                <div className="flex items-center gap-2.5">
                  <Printer className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm sm:text-base font-black">
                      Cupom de Retirada / Cautela de Peças — Lote #{cupomLotePrint.loteId}
                    </h3>
                    <p className="text-[11px] text-zinc-300">
                      Documento limpo com as peças vinculadas ao veículo e campo para assinatura física
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-imprimir-cupom-lote"
                    type="button"
                    onClick={() => handleDispararImpressaoCupomLote(cupomLotePrint)}
                    className="no-print print:hidden inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-stone-950 transition cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir Cupom (A4 / Térmica)</span>
                  </button>
                  <button
                    id="btn-fechar-cupom-lote"
                    type="button"
                    onClick={() => setCupomLotePrint(null)}
                    className="no-print print:hidden p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Folha Limpa do Cupom de Retirada / Cautela */}
              <div
                id="cupom-retirada-lote-scroll-wrap"
                className="p-3 sm:p-6 overflow-y-auto bg-zinc-100 dark:bg-stone-950 print:p-0 print:bg-white"
              >
                <div
                  id="cupom-retirada-lote-a4-sheet"
                  className="bg-white text-black mx-auto max-w-[210mm] p-5 sm:p-7 border border-zinc-300 shadow-md flex flex-col justify-between font-sans print:p-0 print:border-none print:shadow-none"
                >
                  {/* Topo / Cabeçalho do Cupom */}
                  <div className="space-y-2 print:space-y-1.5">
                    <div className="border-b-1.5 border-black pb-2 text-center space-y-0.5 print:pb-1 print:mb-1.5">
                      {companyProfile?.tradeName && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 print:text-[7.5pt] print:mb-0.5">
                          {companyProfile.tradeName}{' '}
                          {companyProfile.cnpj ? `• CNPJ: ${companyProfile.cnpj}` : ''}
                        </p>
                      )}
                      <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-black print:text-[12.5pt] print:leading-tight">
                        Cupom de Retirada / Cautela de Peças
                      </h1>
                      <p className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-800 print:text-[7.5pt]">
                        Lista de Separação para o Almoxarifado (Rota de Coleta por Endereço Físico)
                      </p>
                      <p className="text-xs font-medium text-zinc-600 print:text-[8pt]">
                        Pedido de Peças por Veículo • Lote:{' '}
                        <strong className="font-mono font-semibold text-black">{cupomLotePrint.loteId}</strong> •
                        Status:{' '}
                        <span className="font-medium text-zinc-900">
                          {cupomLotePrint.status || 'Aguardando Manutenção'}
                        </span>
                      </p>
                    </div>

                    {/* Destaque no Topo: Modelo / Placa do Veículo e Dados da Retirada (Bloco fino e horizontal) */}
                    <div className="border-1.5 border-black rounded-md overflow-hidden print:border print:mb-1.5">
                      <div className="bg-zinc-900 text-white print:bg-zinc-900 print:text-white px-3 py-1.5 border-b border-black flex items-center justify-between print:px-2.5 print:py-1">
                        <div className="flex items-baseline gap-2 min-w-0 overflow-hidden">
                          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80 whitespace-nowrap print:text-[6.5pt]">
                            VEÍCULO / DESTINO:
                          </span>
                          <span className="text-sm sm:text-base font-bold uppercase tracking-tight truncate print:text-[10pt]">
                            {cupomLotePrint.veiculoNome}
                            {cupomLotePrint.veiculoPlaca
                              ? ` — PLACA: ${cupomLotePrint.veiculoPlaca}`
                              : ''}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider opacity-80 print:text-[6.5pt]">
                            DATA:
                          </span>
                          <span className="text-xs sm:text-sm font-semibold font-mono print:text-[9pt]">
                            {formatDateOnlyPtBr(cupomLotePrint.dataRetirada)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-black bg-zinc-50 print:bg-zinc-50 border-t border-black">
                        <div className="px-3 py-1 flex items-baseline gap-1.5 truncate print:px-2.5 print:py-0.5">
                          <span className="text-[9px] font-medium uppercase text-zinc-600 whitespace-nowrap print:text-[6.5pt]">
                            LIBERADO POR (ALMOXARIFADO):
                          </span>
                          <span className="text-xs font-semibold text-zinc-900 truncate print:text-[7.5pt]">
                            {cupomLotePrint.operadorAlmoxarifado}
                          </span>
                        </div>
                        <div className="px-3 py-1 flex items-baseline gap-1.5 truncate print:px-2.5 print:py-0.5">
                          <span className="text-[9px] font-medium uppercase text-zinc-600 whitespace-nowrap print:text-[6.5pt]">
                            RETIRADO POR (MECÂNICO):
                          </span>
                          <span className="text-xs font-semibold text-zinc-900 truncate print:text-[7.5pt]">
                            {cupomLotePrint.retiradoPor}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tabela de Peças Retiradas no Lote + Lista de Separação para o Almoxarifado */}
                    <div className="border border-black rounded-md overflow-hidden print:rounded-md print:mb-1">
                      <div className="bg-zinc-100 px-3 py-1 border-b border-black flex flex-wrap items-center justify-between gap-1.5 print:px-2 print:py-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-black print:text-[7.5pt]">
                          Relação de Peças / Materiais Retirados ({cupomLotePrint.items.length}{' '}
                          {cupomLotePrint.items.length === 1 ? 'item' : 'itens'}) — Lista de Separação
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-800 bg-amber-100 px-1.5 py-0.5 rounded border border-black/20 print:text-[6.5pt]">
                          Rota de Coleta: Setor → Rua → Estante
                        </span>
                      </div>
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                          <tr className="border-b border-black bg-zinc-50 text-[10px] font-bold uppercase text-zinc-700 print:text-[7pt] print:bg-zinc-100 print:leading-tight">
                            <th className="py-1 px-1 w-7 text-center border-r border-black print:w-[24px] print:py-0.5 print:px-1 font-bold">#</th>
                            <th className="py-1 px-1.5 w-16 border-r border-black print:w-[66px] print:py-0.5 print:px-1 font-bold">Código</th>
                            <th className="py-1 px-2 border-r border-black print:py-0.5 print:px-1.5 font-bold">
                              Descrição da Peça / Material
                            </th>
                            <th className="py-1 px-1 w-32 text-center border-r border-black bg-amber-100/80 text-black print:w-[125px] print:max-w-[125px] print:py-0.5 print:px-1 font-bold">
                              Localização / Endereço
                            </th>
                            <th className="py-1 px-1 w-16 text-center print:w-[65px] print:py-0.5 print:px-1 font-bold">Quantidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-300 text-xs print:divide-zinc-300">
                          {enrichAndSortItemsByPickingRoute(cupomLotePrint.items).map(
                            (item, idx) => {
                              const enderecoDisplay = String(item.endereco_formatado || '').trim();
                              let addressSegments: string[] = [];
                              if (enderecoDisplay && enderecoDisplay.includes('.')) {
                                addressSegments = enderecoDisplay.split('.').map(s => s.trim());
                              } else if (item.estoque_setor || item.estoque_rua || item.estoque_estante || item.estoque_nivel || item.estoque_box) {
                                addressSegments = [
                                  item.estoque_setor || '00',
                                  item.estoque_rua || '00',
                                  item.estoque_estante || '00',
                                  item.estoque_nivel || '00',
                                  item.estoque_box || '00',
                                ];
                              }
                              const isStructured = addressSegments.length >= 2;
                              const LABELS = ['SETOR', 'RUA', 'EST.', 'NÍV.', 'BOX'];

                              return (
                                <tr key={item.id || idx} className="border-b border-zinc-300 print:border-zinc-300">
                                  <td className="py-1 px-1 text-center font-mono font-medium border-r border-black text-xs print:text-[7.5pt] print:py-0.5 text-zinc-600">
                                    {String(idx + 1).padStart(2, '0')}
                                  </td>
                                  <td className="py-1 px-1.5 font-mono font-medium text-zinc-700 border-r border-black text-xs print:text-[7.5pt] print:py-0.5 whitespace-nowrap">
                                    {item.produto_codigo || '—'}
                                  </td>
                                  <td className="py-1 px-2 font-medium text-zinc-900 border-r border-black text-xs print:text-[7.5pt] print:py-0.5 whitespace-nowrap overflow-hidden truncate desc-cell" title={item.produto_nome || ''}>
                                    {item.produto_nome || 'Peça do Estoque'}
                                  </td>
                                  <td className="py-1 px-1 text-center border-r border-black bg-zinc-50/70 print:py-0.5 print:px-0.5 loc-cell max-w-[125px] w-[125px] overflow-hidden">
                                    {!enderecoDisplay && addressSegments.length === 0 ? (
                                      <span className="font-mono text-[9px] print:text-[6.5pt] font-medium text-zinc-500">
                                        NÃO ENDEREÇADO
                                      </span>
                                    ) : isStructured ? (
                                      <div className="inline-flex items-start justify-center px-1.5 py-0.5 border border-black rounded-[3px] bg-amber-100 max-w-full box-border">
                                        {addressSegments.map((seg, sIdx) => {
                                          const label = LABELS[sIdx] || `P${sIdx + 1}`;
                                          return (
                                            <React.Fragment key={sIdx}>
                                              {sIdx > 0 && (
                                                <div className="flex flex-col items-center justify-start px-0.5 select-none" aria-hidden="true">
                                                  <span className="font-mono font-bold text-[8.5px] print:text-[7.5pt] leading-none text-black">
                                                    .
                                                  </span>
                                                  <span className="text-[5.5px] print:text-[4.6pt] leading-none mt-0.5 invisible select-none">
                                                    .
                                                  </span>
                                                </div>
                                              )}
                                              <div className="flex flex-col items-center justify-start min-w-[13px] print:min-w-[11px]">
                                                <span className="font-mono font-bold text-[8.5px] print:text-[7.5pt] leading-none text-black">
                                                  {seg.trim()}
                                                </span>
                                                <span className="font-sans font-bold text-[5.5px] print:text-[4.6pt] text-zinc-800 uppercase leading-none mt-0.5 tracking-tighter">
                                                  {label}
                                                </span>
                                              </div>
                                            </React.Fragment>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="loc-badge-simple inline-block max-w-full px-1.5 py-0.5 border border-black rounded-[3px] bg-amber-100 font-semibold text-black text-[9px] print:text-[6.5pt] truncate align-middle">
                                        {enderecoDisplay}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-1 px-1 text-center font-mono font-semibold text-xs print:text-[8pt] print:py-0.5 text-zinc-900 whitespace-nowrap">
                                    {item.quantidade} {item.produto_unidade || 'UN'}
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Termo Resumido de Cautela */}
                    <div className="text-xs leading-snug text-justify text-zinc-700 pt-1 print:text-[7.5pt] print:pt-0.5 print:leading-tight font-normal">
                      Declaro ter recebido do Almoxarifado as peças discriminadas neste cupom (Lote{' '}
                      <strong className="font-semibold text-black">{cupomLotePrint.loteId}</strong>), sob liberação do operador{' '}
                      <strong className="font-semibold text-black">{cupomLotePrint.operadorAlmoxarifado}</strong>, destinadas
                      à manutenção do veículo/máquina{' '}
                      <strong className="font-semibold text-black">
                        {cupomLotePrint.veiculoNome}
                        {cupomLotePrint.veiculoPlaca ? ` (${cupomLotePrint.veiculoPlaca})` : ''}
                      </strong>
                      .
                    </div>
                  </div>

                  {/* Rodapé com Campo Pontilhado para Assinatura Física (Compacto e Horizontal) */}
                  <div className="pt-3 sm:pt-4 pb-1 space-y-2 print:pt-1.5 print:space-y-1">
                    <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center pt-1 print:pt-0.5">
                      <div>
                        <div className="border-b-1.5 border-dotted border-black w-full mb-1 h-5 print:h-3.5 print:border-b-[1.5px]" />
                        <p className="text-xs font-semibold uppercase text-zinc-900 truncate print:text-[7.5pt]">
                          {cupomLotePrint.retiradoPor}
                        </p>
                        <p className="text-[10px] font-normal text-zinc-500 print:text-[6pt]">
                          Assinatura: Mecânico / Operador
                        </p>
                      </div>

                      <div>
                        <div className="border-b border-dotted border-zinc-500 w-full mb-1 h-5 print:h-3.5" />
                        <p className="text-xs font-semibold text-zinc-900 truncate print:text-[7.5pt]">
                          {cupomLotePrint.operadorAlmoxarifado}
                        </p>
                        <p className="text-[10px] font-normal text-zinc-500 print:text-[6pt]">Operador do Almoxarifado</p>
                      </div>

                      <div>
                        <div className="border-b border-dotted border-zinc-500 w-full mb-1 h-5 print:h-3.5" />
                        <p className="text-xs font-semibold text-zinc-900 print:text-[7.5pt]">
                          Conferência na OS
                        </p>
                        <p className="text-[10px] font-normal text-zinc-500 print:text-[6pt]">Visto da Manutenção</p>
                      </div>
                    </div>

                    <div className="text-center text-[10px] text-zinc-400 border-t border-zinc-200 pt-1.5 print:text-[6.5pt] print:pt-1 print:mt-1">
                      Cupom emitido em {formatDateTimePtBr(new Date().toISOString())} • Lote:{' '}
                      {cupomLotePrint.loteId}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
