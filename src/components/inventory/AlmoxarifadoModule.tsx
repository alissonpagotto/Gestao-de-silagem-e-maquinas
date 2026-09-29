import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Clock
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
      .map(e => (e.name || e.nome || '').trim())
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
  // ESTADOS DA ABA 1: RETIRADA DE PEÇAS PARA MANUTENÇÃO
  // =========================================================================
  const [pecaVeiculoId, setPecaVeiculoId] = useState<string>('');
  const [pecaProdutoId, setPecaProdutoId] = useState<string>('');
  const [pecaQuantidade, setPecaQuantidade] = useState<string>('1');
  const [pecaOperadorAlmox, setPecaOperadorAlmox] = useState<string>('');
  const [pecaRetiradoPor, setPecaRetiradoPor] = useState<string>('');
  const [pecaDataRetirada, setPecaDataRetirada] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [pecaSearchFilter, setPecaSearchFilter] = useState<string>('');
  const [isSavingRetiradaPeca, setIsSavingRetiradaPeca] = useState<boolean>(false);
  const [saldoRealDbSelecionado, setSaldoRealDbSelecionado] = useState<number | null>(null);

  // Estado de Edição de Retirada de Peça (Botão Lápis)
  const [editingRetiradaPeca, setEditingRetiradaPeca] = useState<RetiradaPecaRecord | null>(null);

  // Estado de Impressão A4 de Retirada de Peça (Botão Impressora)
  const [termoRetiradaPecaPrint, setTermoRetiradaPecaPrint] = useState<RetiradaPecaRecord | null>(null);

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

  const saldoPrevistoAposRetirada = useMemo(() => {
    if (editingRetiradaPeca) {
      const isSameProd =
        editingRetiradaPeca.produto_id &&
        toValidUUID(editingRetiradaPeca.produto_id) === toValidUUID(pecaProdutoId);
      const diff = isSameProd
        ? qtdRetiradaNumerica - Number(editingRetiradaPeca.quantidade || 0)
        : qtdRetiradaNumerica;
      return Math.max(0, Number((saldoAtualProdutoSelecionado - diff).toFixed(3)));
    }
    return Math.max(0, Number((saldoAtualProdutoSelecionado - qtdRetiradaNumerica).toFixed(3)));
  }, [saldoAtualProdutoSelecionado, qtdRetiradaNumerica, editingRetiradaPeca, pecaProdutoId]);

  const handleIniciarEdicaoRetirada = (item: RetiradaPecaRecord) => {
    setEditingRetiradaPeca(item);
    const matchedVeh = frotasList.find(
      m =>
        m.id === item.veiculo_id ||
        (item.veiculo_id && toValidUUID(m.id) === toValidUUID(item.veiculo_id)) ||
        (item.veiculo_nome && m.name.toLowerCase() === item.veiculo_nome.toLowerCase())
    );
    const matchedProd = allProducts.find(
      p =>
        p.id === item.produto_id ||
        (item.produto_id && toValidUUID(p.id) === toValidUUID(item.produto_id)) ||
        (item.produto_nome &&
          (p.nome_comercial || p.name || '').toLowerCase() === item.produto_nome.toLowerCase())
    );

    setPecaVeiculoId(matchedVeh?.id || item.veiculo_id || '');
    setPecaProdutoId(matchedProd?.id || item.produto_id || '');
    setPecaQuantidade(String(item.quantidade || 1));
    setPecaOperadorAlmox(item.operador_almoxarifado || '');
    setPecaRetiradoPor(item.retirado_por || '');
    setPecaDataRetirada(
      item.data_retirada
        ? String(item.data_retirada).split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
  };

  const handleCancelarEdicaoRetirada = () => {
    setEditingRetiradaPeca(null);
    setPecaProdutoId('');
    setPecaQuantidade('1');
    setPecaDataRetirada(new Date().toISOString().split('T')[0]);
  };

  const handleSalvarRetiradaPeca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pecaVeiculoId) {
      showFeedback('error', 'Selecione o Veículo / Máquina que receberá a peça.');
      return;
    }
    if (!pecaProdutoId) {
      showFeedback('error', 'Selecione o Item do Estoque que está sendo retirado.');
      return;
    }
    if (qtdRetiradaNumerica <= 0) {
      showFeedback('error', 'A quantidade retirada deve ser maior que zero.');
      return;
    }
    if (!pecaOperadorAlmox.trim()) {
      showFeedback('error', 'Informe o nome do Operador do Almoxarifado.');
      return;
    }
    if (!pecaRetiradoPor.trim()) {
      showFeedback('error', 'Informe quem retirou a peça (Mecânico / Operador).');
      return;
    }

    setIsSavingRetiradaPeca(true);
    try {
      if (editingRetiradaPeca) {
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
          showFeedback('error', resUpdate.errorMessage || 'Não foi possível atualizar a retirada de peça.');
          return;
        }

        if (resUpdate.updatedInventory) {
          setLocalStockItems(ensureDieselProductsInInventory(resUpdate.updatedInventory));
        }
        if (resUpdate.novoSaldoEstoque !== undefined) {
          setSaldoRealDbSelecionado(resUpdate.novoSaldoEstoque);
        }
        if (resUpdate.record) {
          setRetiradasPecas(prev =>
            prev.map(r => (r.id === editingRetiradaPeca.id || r.id === resUpdate.record!.id ? resUpdate.record! : r))
          );
        }

        const prodNome =
          selectedProductForWithdrawal?.nome_comercial ||
          selectedProductForWithdrawal?.name ||
          'Peça';
        showFeedback(
          'success',
          `Lançamento atualizado com sucesso! Saldo atual de "${prodNome}" no estoque: ${resUpdate.novoSaldoEstoque} ${selectedProductForWithdrawal?.unidade_medida || selectedProductForWithdrawal?.unit || 'UN'}.`
        );

        setEditingRetiradaPeca(null);
        setPecaProdutoId('');
        setPecaQuantidade('1');
        return;
      }

      const res = await registrarRetiradaPeca({
        veiculo_id: pecaVeiculoId,
        produto_id: pecaProdutoId,
        quantidade: qtdRetiradaNumerica,
        operador_almoxarifado: pecaOperadorAlmox.trim(),
        retirado_por: pecaRetiradoPor.trim(),
        data_retirada: pecaDataRetirada,
        veiculo: selectedVehicleForWithdrawal,
        produto: selectedProductForWithdrawal || undefined,
      });

      if (!res.success) {
        showFeedback('error', res.errorMessage || 'Não foi possível salvar a retirada de peça.');
        return;
      }

      if (res.updatedInventory) {
        setLocalStockItems(ensureDieselProductsInInventory(res.updatedInventory));
      }
      if (res.novoSaldoEstoque !== undefined) {
        setSaldoRealDbSelecionado(res.novoSaldoEstoque);
      }
      if (res.record) {
        setRetiradasPecas(prev => [res.record!, ...prev.filter(r => r.id !== res.record!.id)]);
      }

      const prodNome =
        selectedProductForWithdrawal?.nome_comercial ||
        selectedProductForWithdrawal?.name ||
        'Peça';
      showFeedback(
        'success',
        `Retirada registrada com sucesso! O estoque de "${prodNome}" foi abatido automaticamente para ${res.novoSaldoEstoque} ${selectedProductForWithdrawal?.unidade_medida || selectedProductForWithdrawal?.unit || 'UN'}.`
      );

      // Limpa os campos de item/quantidade mantendo operador e data para agilizar múltiplos lançamentos
      setPecaProdutoId('');
      setPecaQuantidade('1');
    } finally {
      setIsSavingRetiradaPeca(false);
    }
  };

  const handleExcluirRetiradaPeca = async (item: RetiradaPecaRecord) => {
    const ok = await confirm({
      title: 'Estornar Retirada de Peça',
      message: `Deseja excluir este registro de retirada de "${item.produto_nome || 'Peça'}" (${item.quantidade} ${item.produto_unidade || 'UN'}) e devolver a quantidade automaticamente ao estoque?`,
      confirmLabel: 'Sim, Estornar ao Estoque',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;

    const res = await deleteRetiradaPeca(item.id, true, item.produto_id, item.quantidade);
    if (res.updatedInventory) {
      setLocalStockItems(ensureDieselProductsInInventory(res.updatedInventory));
    }
    if (editingRetiradaPeca?.id === item.id) {
      handleCancelarEdicaoRetirada();
    }
    setRetiradasPecas(prev => prev.filter(r => r.id !== item.id));
    showFeedback('success', 'Retirada excluída e saldo devolvido ao estoque com sucesso.');
  };

  const filteredRetiradasPecas = useMemo(() => {
    const q = pecaSearchFilter.toLowerCase().trim();
    if (!q) return retiradasPecas;
    return retiradasPecas.filter(r => {
      return (
        (r.veiculo_nome || '').toLowerCase().includes(q) ||
        (r.veiculo_placa || '').toLowerCase().includes(q) ||
        (r.produto_nome || '').toLowerCase().includes(q) ||
        (r.produto_codigo || '').toLowerCase().includes(q) ||
        (r.operador_almoxarifado || '').toLowerCase().includes(q) ||
        (r.retirado_por || '').toLowerCase().includes(q)
      );
    });
  }, [retiradasPecas, pecaSearchFilter]);

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
    setFerCodigo(prod.code || prod.codigo_produto || prod.barcode || `FER-${prod.id.slice(0, 4).toUpperCase()}`);
    setFerNome(prod.nome_comercial || prod.name || '');
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
        item.codigo_ferramenta.toLowerCase().includes(q) ||
        item.nome_ferramenta.toLowerCase().includes(q) ||
        item.retirado_por.toLowerCase().includes(q) ||
        item.operador_almoxarifado.toLowerCase().includes(q) ||
        (item.conferido_por || '').toLowerCase().includes(q)
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
            i.codigo_item_ferramenta.toLowerCase() === itemPadrao.codigo.toLowerCase() ||
            i.nome_ferramenta.toLowerCase() === itemPadrao.nome.toLowerCase()
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
    <div className="space-y-5">
      {/* Datalist global de colaboradores para sugestão rápida em campos de operador/mecânico */}
      <datalist id="almox-employees-list">
        {employeeNames.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* Cabeçalho Principal do Módulo */}
      <div className="no-print bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Wrench className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                  Gestão e Controle do Almoxarifado
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                  Supabase Ativo
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-stone-400 mt-0.5">
                Controle de saídas de peças para manutenção, cautela de ferramentas com assinatura e inventário de caixas por veículo
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigateToEstoque && (
              <button
                type="button"
                onClick={onNavigateToEstoque}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-zinc-300 dark:border-stone-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-800 dark:text-stone-200 transition cursor-pointer"
              >
                <Package className="w-4 h-4" />
                <span>Ver Estoque Geral</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => loadAlmoxarifadoData(false)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-zinc-200 dark:border-stone-700 bg-white hover:bg-zinc-50 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-700 dark:text-stone-200 transition cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar Dados</span>
            </button>
          </div>
        </div>

        {/* Cards de Resumo Rápido */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-stone-800">
          <div
            onClick={() => setActiveTab('retirada_pecas')}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeTab === 'retirada_pecas'
                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700'
                : 'bg-zinc-50 dark:bg-stone-800/50 border-zinc-200 dark:border-stone-800 hover:border-zinc-300'
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-stone-400">
                ABA 1 • Saídas de Peças
              </span>
              <p className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                {retiradasPecas.length} {retiradasPecas.length === 1 ? 'retirada' : 'retiradas'}
              </p>
              <span className="text-[11px] text-zinc-600 dark:text-stone-400">
                Baixa automática no estoque
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <PackageMinus className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('cautela_ferramentas')}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeTab === 'cautela_ferramentas'
                ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700'
                : 'bg-zinc-50 dark:bg-stone-800/50 border-zinc-200 dark:border-stone-800 hover:border-zinc-300'
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-stone-400">
                ABA 2 • Cautela de Ferramentas
              </span>
              <p className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                {totalEmprestimosAtivos} em uso agora
              </p>
              <span className="text-[11px] text-zinc-600 dark:text-stone-400">
                {movimentacoesFerramentas.length} movimentações registradas
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('caixa_veiculo')}
            className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              activeTab === 'caixa_veiculo'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
                : 'bg-zinc-50 dark:bg-stone-800/50 border-zinc-200 dark:border-stone-800 hover:border-zinc-300'
            }`}
          >
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-stone-400">
                ABA 3 • Caixa Fixa por Veículo
              </span>
              <p className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                {resumoCaixaVeiculoAtual.totalItens} itens no veículo
              </p>
              <span className="text-[11px] text-zinc-600 dark:text-stone-400">
                {resumoCaixaVeiculoAtual.itensFaltantes > 0
                  ? `${resumoCaixaVeiculoAtual.itensFaltantes} com divergência`
                  : 'Inventário de bordo por frota'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Barra de Navegação das 3 Abas */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-zinc-200 dark:border-stone-800">
          <button
            type="button"
            onClick={() => setActiveTab('retirada_pecas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              activeTab === 'retirada_pecas'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300'
            }`}
          >
            <PackageMinus className="w-4 h-4" />
            <span>1. Retirada de Peças para Manutenção</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cautela_ferramentas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              activeTab === 'cautela_ferramentas'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. Movimentação e Cautela de Ferramentas</span>
            {totalEmprestimosAtivos > 0 && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500 text-stone-950 font-black">
                {totalEmprestimosAtivos}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('caixa_veiculo')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
              activeTab === 'caixa_veiculo'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>3. Caixa de Ferramentas Fixa por Veículo</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`no-print p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          ABA 1: RETIRADA DE PEÇAS PARA MANUTENÇÃO
         ===================================================================== */}
      {activeTab === 'retirada_pecas' && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Formulário de Saída de Peça */}
          <div
            className={`lg:col-span-5 bg-white dark:bg-stone-900 border rounded-2xl p-5 shadow-xs h-fit transition ${
              editingRetiradaPeca
                ? 'border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20'
                : 'border-zinc-200 dark:border-stone-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2.5 pb-3.5 mb-4 border-b border-zinc-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    editingRetiradaPeca
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {editingRetiradaPeca ? (
                    <Pencil className="w-4 h-4 stroke-[2.4]" />
                  ) : (
                    <PackageMinus className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white">
                    {editingRetiradaPeca ? 'Editar Lançamento de Retirada' : 'Registrar Retirada de Peça'}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-stone-400">
                    {editingRetiradaPeca ? (
                      <span>Ajusta automaticamente a diferença em <code className="font-mono">estoque_produtos</code></span>
                    ) : (
                      <span>Abate automaticamente o saldo em <code className="font-mono">estoque_produtos</code></span>
                    )}
                  </p>
                </div>
              </div>

              {editingRetiradaPeca && (
                <button
                  type="button"
                  onClick={handleCancelarEdicaoRetirada}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-700 dark:text-stone-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSalvarRetiradaPeca} className="space-y-4">
              {/* Veículo / Máquina */}
              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Veículo / Máquina (Frota) *
                </label>
                <div className="relative">
                  <select
                    value={pecaVeiculoId}
                    onChange={e => setPecaVeiculoId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Selecione o veículo ou máquina...</option>
                    {frotasList.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.plateOrSerial ? `(${m.plateOrSerial})` : ''} {m.model ? `• ${m.model}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Item do Estoque */}
              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Item do Estoque (Peça / Insumo) *
                </label>
                <select
                  value={pecaProdutoId}
                  onChange={e => setPecaProdutoId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Selecione a peça ou item no estoque...</option>
                  {allProducts.map(item => {
                    const qtd = Number(item.quantidade_atual ?? item.quantity ?? 0);
                    const un = item.unidade_medida || item.unit || 'UN';
                    const codigo = item.code || item.codigo_produto ? `[${item.code || item.codigo_produto}] ` : '';
                    return (
                      <option key={item.id} value={item.id}>
                        {codigo}{item.nome_comercial || item.name} — Saldo: {qtd} {un}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Painel Reativo de Saldo do Item Selecionado */}
              {selectedProductForWithdrawal && (
                <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                      Saldo Atual no Estoque
                    </span>
                    <span className="text-base font-black text-zinc-900 dark:text-white">
                      {saldoAtualProdutoSelecionado}{' '}
                      {selectedProductForWithdrawal.unidade_medida || selectedProductForWithdrawal.unit || 'UN'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                      Saldo Após Retirada
                    </span>
                    <span
                      className={`text-base font-black ${
                        qtdRetiradaNumerica > saldoAtualProdutoSelecionado
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {saldoPrevistoAposRetirada}{' '}
                      {selectedProductForWithdrawal.unidade_medida || selectedProductForWithdrawal.unit || 'UN'}
                    </span>
                  </div>
                </div>
              )}

              {/* Quantidade e Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Quantidade Retirada *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={pecaQuantidade}
                    onChange={e => setPecaQuantidade(e.target.value)}
                    required
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Data da Retirada *
                  </label>
                  <input
                    type="date"
                    value={pecaDataRetirada}
                    onChange={e => setPecaDataRetirada(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Operador do Almoxarifado */}
              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Operador do Almoxarifado *
                </label>
                <input
                  type="text"
                  list="almox-employees-list"
                  value={pecaOperadorAlmox}
                  onChange={e => setPecaOperadorAlmox(e.target.value)}
                  required
                  placeholder="Nome do responsável pela entrega no almoxarifado"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Quem Retirou (Mecânico / Operador) */}
              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Quem Retirou (Mecânico / Operador) *
                </label>
                <input
                  type="text"
                  list="almox-employees-list"
                  value={pecaRetiradoPor}
                  onChange={e => setPecaRetiradoPor(e.target.value)}
                  required
                  placeholder="Nome do mecânico ou operador que retirou a peça"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2">
                {editingRetiradaPeca && (
                  <button
                    type="button"
                    onClick={handleCancelarEdicaoRetirada}
                    className="py-3 px-4 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-zinc-700 dark:text-stone-200 font-bold text-sm transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingRetiradaPeca}
                  className={`flex-1 py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50 ${
                    editingRetiradaPeca
                      ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                      : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isSavingRetiradaPeca
                      ? 'Salvando e Atualizando Estoque...'
                      : editingRetiradaPeca
                        ? 'Salvar Alterações da Retirada'
                        : 'Salvar Retirada e Abater do Estoque'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Lista / Histórico de Retiradas de Peças */}
          <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-4 border-b border-zinc-200 dark:border-stone-800">
              <div>
                <h2 className="text-base font-black text-zinc-900 dark:text-white">
                  Histórico de Saídas de Peças para Manutenção
                </h2>
                <p className="text-xs text-zinc-500 dark:text-stone-400">
                  Registros sincronizados em <code className="font-mono">public.retiradas_pecas</code>
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pecaSearchFilter}
                  onChange={e => setPecaSearchFilter(e.target.value)}
                  placeholder="Buscar veículo, peça, mecânico..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {filteredRetiradasPecas.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-400 mb-3">
                  <PackageMinus className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-zinc-700 dark:text-stone-300">
                  Nenhuma retirada de peça registrada ainda
                </p>
                <p className="text-xs text-zinc-500 dark:text-stone-400 max-w-sm mt-1">
                  Utilize o formulário ao lado para registrar saídas de peças para veículos ou máquinas. O saldo será abatido automaticamente do estoque.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-stone-800 text-[11px] font-extrabold text-zinc-500 dark:text-stone-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Veículo / Máquina</th>
                      <th className="py-2.5 px-3">Item / Peça Retirada</th>
                      <th className="py-2.5 px-3 text-center">Qtd.</th>
                      <th className="py-2.5 px-3">Almoxarife / Mecânico</th>
                      <th className="py-2.5 px-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-stone-800/80 text-xs">
                    {filteredRetiradasPecas.map(item => (
                      <tr
                        key={item.id}
                        className="hover:bg-zinc-50/80 dark:hover:bg-stone-800/40 transition"
                      >
                        <td className="py-3 px-3 font-bold text-zinc-700 dark:text-stone-300 whitespace-nowrap">
                          {formatDateOnlyPtBr(item.data_retirada)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-extrabold text-zinc-900 dark:text-white">
                            {item.veiculo_nome || 'Veículo da Frota'}
                          </div>
                          {item.veiculo_placa && (
                            <span className="text-[10px] font-mono text-zinc-500 dark:text-stone-400">
                              {item.veiculo_placa}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-zinc-900 dark:text-white">
                            {item.produto_nome || 'Item do Estoque'}
                          </div>
                          {item.produto_codigo && (
                            <span className="text-[10px] font-mono text-zinc-500 dark:text-stone-400">
                              Cód: {item.produto_codigo}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg font-black text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            -{item.quantidade} {item.produto_unidade || 'UN'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-zinc-800 dark:text-stone-200 font-bold">
                            Retirou: <span className="font-semibold">{item.retirado_por}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-stone-400">
                            Almox.: {item.operador_almoxarifado}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setTermoRetiradaPecaPrint(item)}
                              title="Imprimir Termo de Retirada de Peça (A4) para assinatura"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:text-stone-400 dark:hover:text-blue-400 dark:hover:bg-blue-950/40 transition cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleIniciarEdicaoRetirada(item)}
                              title="Editar lançamento de retirada"
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                editingRetiradaPeca?.id === item.id
                                  ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/60'
                                  : 'text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:text-stone-400 dark:hover:text-amber-400 dark:hover:bg-amber-950/40'
                              }`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExcluirRetiradaPeca(item)}
                              title="Estornar retirada e devolver ao estoque"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Formulário de Nova Cautela / Retirada de Ferramenta */}
          <div className="lg:col-span-4 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs h-fit">
            <div className="flex items-center gap-2.5 pb-3.5 mb-4 border-b border-zinc-200 dark:border-stone-800">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-zinc-900 dark:text-white">
                  Nova Cautela de Ferramenta
                </h2>
                <p className="text-xs text-zinc-500 dark:text-stone-400">
                  Controle de empréstimo de ferramentas de uso comum
                </p>
              </div>
            </div>

            <form
              onSubmit={e => handleRegistrarCautela(e, false)}
              className="space-y-3.5"
            >
              {/* Preenchimento rápido opcional a partir de itens cadastrados */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-stone-400 uppercase tracking-wider mb-1">
                  Preencher Rápido do Cadastro (Opcional)
                </label>
                <select
                  defaultValue=""
                  onChange={e => handleQuickSelectToolFromStock(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-700 dark:text-stone-300"
                >
                  <option value="">Digitar manualmente abaixo ou escolher item...</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `[${p.code}] ` : ''}{p.nome_comercial || p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={ferCodigo}
                    onChange={e => setFerCodigo(e.target.value)}
                    required
                    placeholder="Ex: FER-01"
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Nome da Ferramenta *
                  </label>
                  <input
                    type="text"
                    value={ferNome}
                    onChange={e => setFerNome(e.target.value)}
                    required
                    placeholder="Ex: Torquímetro de Estalo, Lixadeira..."
                    className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Data e Hora da Retirada *
                </label>
                <input
                  type="datetime-local"
                  value={ferDataHoraRetirada}
                  onChange={e => setFerDataHoraRetirada(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Operador do Almoxarifado *
                </label>
                <input
                  type="text"
                  list="almox-employees-list"
                  value={ferOperadorAlmox}
                  onChange={e => setFerOperadorAlmox(e.target.value)}
                  required
                  placeholder="Quem entregou a ferramenta"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-semibold text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Quem Retirou (Responsável) *
                </label>
                <input
                  type="text"
                  list="almox-employees-list"
                  value={ferRetiradoPor}
                  onChange={e => setFerRetiradoPor(e.target.value)}
                  required
                  placeholder="Mecânico / Colaborador que pegou"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-semibold text-zinc-900 dark:text-white"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSavingCautela}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Registrar Empréstimo / Cautela</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingCautela}
                  onClick={e => handleRegistrarCautela(e as any, true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Registrar e Imprimir Termo (A4)</span>
                </button>
              </div>
            </form>
          </div>

          {/* Lista Ativa de Ferramentas Emprestadas e Devolvidas */}
          <div className="lg:col-span-8 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-4 border-b border-zinc-200 dark:border-stone-800">
              <div>
                <h2 className="text-base font-black text-zinc-900 dark:text-white">
                  Controle Ativo de Empréstimos e Devoluções
                </h2>
                <p className="text-xs text-zinc-500 dark:text-stone-400">
                  Sincronizado com <code className="font-mono">public.movimentacao_ferramentas</code>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-stone-800 p-1">
                  <button
                    type="button"
                    onClick={() => setFerStatusFilter('todas')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      ferStatusFilter === 'devolvidas'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-zinc-600 dark:text-stone-400'
                    }`}
                  >
                    Devolvidas ({movimentacoesFerramentas.length - totalEmprestimosAtivos})
                  </button>
                </div>

                <div className="relative w-full sm:w-52">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ferSearchTerm}
                    onChange={e => setFerSearchTerm(e.target.value)}
                    placeholder="Buscar ferramenta ou nome..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-xs font-semibold text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {filteredMovimentacoesFerramentas.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-400 mb-3">
                  <Wrench className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-zinc-700 dark:text-stone-300">
                  Nenhuma movimentação de ferramenta encontrada
                </p>
                <p className="text-xs text-zinc-500 dark:text-stone-400 max-w-sm mt-1">
                  Registre a saída de torquímetros, lixadeiras ou outras ferramentas de uso comum e imprima o Termo de Cautela para assinatura.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
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
        <div className="no-print space-y-5">
          {/* Seletor de Veículo e Painel de Conferência */}
          <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="w-full lg:max-w-md">
                <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Selecione o Veículo / Máquina da Frota *
                </label>
                <select
                  value={selectedCaixaVeiculoId}
                  onChange={e => {
                    setSelectedCaixaVeiculoId(e.target.value);
                    setIsConferenciaMode(false);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                <div className="flex flex-wrap items-center gap-2.5">
                  {itensCaixaDoVeiculo.length === 0 && (
                    <button
                      type="button"
                      disabled={isAddingItemCaixa}
                      onClick={handlePopularKitPadraoVeiculo}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Carregar Kit Padrão (Macaco, Chave de Roda, Triângulo...)</span>
                    </button>
                  )}

                  {!isConferenciaMode ? (
                    <button
                      type="button"
                      disabled={itensCaixaDoVeiculo.length === 0}
                      onClick={handleIniciarConferenciaCaixa}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer disabled:opacity-40"
                    >
                      <ClipboardCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>Realizar Conferência de Caixa</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConferenciaMode(false)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-zinc-300 dark:border-stone-700 bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancelar Conferência</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Status da última conferência do veículo selecionado */}
            {selectedCaixaVeiculoId && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-stone-800 text-xs">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200/80 dark:border-stone-800">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-500 dark:text-stone-400 block">
                    Veículo Selecionado
                  </span>
                  <span className="font-black text-sm text-zinc-900 dark:text-white">
                    {selectedCaixaVehicle?.name || 'Veículo'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200/80 dark:border-stone-800">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-500 dark:text-stone-400 block">
                    Total de Ferramentas Fixas
                  </span>
                  <span className="font-black text-sm text-zinc-900 dark:text-white">
                    {resumoCaixaVeiculoAtual.totalItens} itens cadastrados
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200/80 dark:border-stone-800">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-500 dark:text-stone-400 block">
                    Situação da Caixa
                  </span>
                  {resumoCaixaVeiculoAtual.itensFaltantes > 0 ? (
                    <span className="font-black text-sm text-rose-600 dark:text-rose-400">
                      {resumoCaixaVeiculoAtual.itensFaltantes} item(ns) em falta
                    </span>
                  ) : (
                    <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                      100% Completa ({resumoCaixaVeiculoAtual.itensCompletos} OK)
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-stone-800/60 border border-zinc-200/80 dark:border-stone-800">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-500 dark:text-stone-400 block">
                    Última Conferência
                  </span>
                  <span className="font-bold text-zinc-900 dark:text-white block">
                    {resumoCaixaVeiculoAtual.ultimaConf
                      ? formatDateTimePtBr(resumoCaixaVeiculoAtual.ultimaConf)
                      : 'Ainda não conferida'}
                  </span>
                  {resumoCaixaVeiculoAtual.confPor && (
                    <span className="text-[11px] text-zinc-500 dark:text-stone-400">
                      Por: {resumoCaixaVeiculoAtual.confPor}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Painel de Conferência Ativa */}
          {isConferenciaMode && (
            <form
              onSubmit={handleSalvarConferenciaCaixa}
              className="bg-emerald-50/70 dark:bg-emerald-950/25 border-2 border-emerald-500 dark:border-emerald-700 rounded-2xl p-5 shadow-md space-y-4 animate-in fade-in duration-150"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-emerald-950 dark:text-emerald-100">
                      Modo de Conferência de Caixa Ativo — {selectedCaixaVehicle?.name}
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                      Verifique cada ferramenta abaixo, ajuste a Quantidade Atual caso falte algum item e informe quem realizou a conferência.
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
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-stone-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer self-start sm:self-auto"
                >
                  Marcar Todos Completos
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider mb-1">
                    Conferido Por (Operador / Responsável) *
                  </label>
                  <input
                    type="text"
                    list="almox-employees-list"
                    value={conferenciaConferidoPor}
                    onChange={e => setConferenciaConferidoPor(e.target.value)}
                    required
                    placeholder="Digite o nome de quem conferiu a caixa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-stone-900 text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider mb-1">
                    Data e Hora da Conferência *
                  </label>
                  <input
                    type="datetime-local"
                    value={conferenciaData}
                    onChange={e => setConferenciaData(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-stone-900 text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSavingConferencia}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {isSavingConferencia ? 'Gravando Conferência...' : 'Salvar Conferência de Caixa'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Grid: Adicionar Nova Ferramenta Fixa + Tabela de Inventário da Caixa */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Formulário para Adicionar Ferramenta Fixa ao Veículo */}
            <div className="lg:col-span-4 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs h-fit">
              <h3 className="text-sm font-black text-zinc-900 dark:text-white pb-3 mb-3.5 border-b border-zinc-200 dark:border-stone-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Adicionar Ferramenta Fixa à Caixa</span>
              </h3>

              <form onSubmit={handleAdicionarFerramentaCaixa} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Código do Item *
                  </label>
                  <input
                    type="text"
                    value={novaFerramentaCaixaCodigo}
                    onChange={e => setNovaFerramentaCaixaCodigo(e.target.value)}
                    required
                    placeholder="Ex: CX-001, MAC-12T"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Nome da Ferramenta *
                  </label>
                  <input
                    type="text"
                    value={novaFerramentaCaixaNome}
                    onChange={e => setNovaFerramentaCaixaNome(e.target.value)}
                    required
                    placeholder="Ex: Macaco Hidráulico, Chave de Roda, Triângulo"
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-bold text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
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
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-black text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-zinc-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                      Qtd. Atual *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={novaFerramentaCaixaQtdAtual}
                      onChange={e => setNovaFerramentaCaixaQtdAtual(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800 text-sm font-black text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAddingItemCaixa || !selectedCaixaVeiculoId}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Incluir na Caixa do Veículo</span>
                </button>
              </form>
            </div>

            {/* Tabela de Ferramentas Fixas do Veículo Selecionado */}
            <div className="lg:col-span-8 bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-200 dark:border-stone-800">
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white">
                    Inventário da Caixa de Ferramentas — {selectedCaixaVehicle?.name || 'Selecione um Veículo'}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-stone-400">
                    Sincronizado com <code className="font-mono">public.caixa_ferramentas_veiculo</code>
                  </p>
                </div>
              </div>

              {itensCaixaDoVeiculo.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-stone-800 flex items-center justify-center text-zinc-400 mb-3">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-zinc-700 dark:text-stone-300">
                    Nenhuma ferramenta fixa cadastrada para este veículo
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-stone-400 max-w-md mt-1 mb-4">
                    Adicione manualmente ao lado ou clique no botão abaixo para incluir o kit padrão (Macaco, Chave de Roda, Triângulo, Chaves Combinadas).
                  </p>
                  {selectedCaixaVeiculoId && (
                    <button
                      type="button"
                      onClick={handlePopularKitPadraoVeiculo}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Adicionar Kit Padrão Agora</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-stone-800 text-[11px] font-extrabold text-zinc-500 dark:text-stone-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Código do Item</th>
                        <th className="py-2.5 px-3">Nome da Ferramenta</th>
                        <th className="py-2.5 px-3 text-center">Qtd. Esperada</th>
                        <th className="py-2.5 px-3 text-center">Qtd. Atual</th>
                        <th className="py-2.5 px-3">Status / Conferência</th>
                        <th className="py-2.5 px-2 text-right">Ação</th>
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
          MODAL / DOCUMENTO A4: TERMO DE RETIRADA DE PEÇA PARA MANUTENÇÃO (ABA 1)
         ===================================================================== */}
      {termoRetiradaPecaPrint && (
        <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:bg-white print:p-0 print:block">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #termo-retirada-peca-a4-sheet,
              #termo-retirada-peca-a4-sheet * {
                visibility: visible !important;
              }
              #termo-retirada-peca-a4-sheet {
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
                    Termo de Retirada de Peça — Impressão A4
                  </h3>
                  <p className="text-[11px] text-zinc-300">
                    Documento limpo em formato A4 para assinatura física do mecânico / operador
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
                  onClick={() => setTermoRetiradaPecaPrint(null)}
                  className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/15 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Folha A4 Limpa */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-zinc-100 dark:bg-stone-950 print:p-0 print:bg-white">
              <div
                id="termo-retirada-peca-a4-sheet"
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
                      Termo de Responsabilidade e Retirada de Peça do Almoxarifado
                    </h1>
                    <p className="text-xs font-sans font-semibold text-zinc-600">
                      Comprovante de Saída de Material / Peça para Manutenção de Frota
                    </p>
                  </div>

                  {/* Quadro de Dados da Retirada de Peça */}
                  <div className="border border-black rounded-lg overflow-hidden font-sans">
                    <div className="bg-zinc-100 px-4 py-2 border-b border-black text-xs font-black uppercase tracking-wider">
                      Dados da Retirada de Material / Peça
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black border-b border-black">
                      <div className="p-3.5 sm:col-span-2">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Item / Peça Retirada do Estoque
                        </span>
                        <span className="text-base font-black text-black">
                          {termoRetiradaPecaPrint.produto_nome || 'Peça / Item do Estoque'}
                        </span>
                        {termoRetiradaPecaPrint.produto_codigo && (
                          <span className="block text-xs font-mono font-bold text-zinc-700 mt-0.5">
                            Código: {termoRetiradaPecaPrint.produto_codigo}
                          </span>
                        )}
                      </div>
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Quantidade Retirada
                        </span>
                        <span className="text-lg font-black font-mono text-black">
                          {termoRetiradaPecaPrint.quantidade}{' '}
                          {termoRetiradaPecaPrint.produto_unidade || 'UN'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-black border-b border-black">
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Veículo / Máquina Aplicada (Frota)
                        </span>
                        <span className="text-sm font-black text-black">
                          {termoRetiradaPecaPrint.veiculo_nome || 'Veículo da Frota'}
                          {termoRetiradaPecaPrint.veiculo_placa
                            ? ` (${termoRetiradaPecaPrint.veiculo_placa})`
                            : ''}
                        </span>
                      </div>
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Data da Retirada
                        </span>
                        <span className="text-sm font-bold text-black">
                          {formatDateOnlyPtBr(termoRetiradaPecaPrint.data_retirada)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-black bg-zinc-50">
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Operador do Almoxarifado (Entregue por)
                        </span>
                        <span className="text-sm font-black text-black">
                          {termoRetiradaPecaPrint.operador_almoxarifado}
                        </span>
                      </div>
                      <div className="p-3.5">
                        <span className="block text-[10px] font-bold uppercase text-zinc-600">
                          Quem Retirou (Mecânico / Operador Responsável)
                        </span>
                        <span className="text-base font-black text-black">
                          {termoRetiradaPecaPrint.retirado_por}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Declaração de Recebimento e Aplicação */}
                  <div className="space-y-3 text-sm leading-relaxed text-justify font-sans text-zinc-900 pt-2">
                    <p>
                      Declaro, para os devidos fins de controle de estoque e manutenção da frota,
                      que eu, <strong>{termoRetiradaPecaPrint.retirado_por}</strong>, retirei no
                      Almoxarifado na data de{' '}
                      <strong>{formatDateOnlyPtBr(termoRetiradaPecaPrint.data_retirada)}</strong>,
                      sob liberação do operador{' '}
                      <strong>{termoRetiradaPecaPrint.operador_almoxarifado}</strong>, o item{' '}
                      <strong>
                        {termoRetiradaPecaPrint.produto_nome || 'Peça / Insumo'}
                        {termoRetiradaPecaPrint.produto_codigo
                          ? ` (Cód. ${termoRetiradaPecaPrint.produto_codigo})`
                          : ''}
                      </strong>{' '}
                      na quantidade de{' '}
                      <strong>
                        {termoRetiradaPecaPrint.quantidade}{' '}
                        {termoRetiradaPecaPrint.produto_unidade || 'UN'}
                      </strong>
                      , destinado exclusivamente à manutenção/aplicação no veículo ou equipamento{' '}
                      <strong>
                        {termoRetiradaPecaPrint.veiculo_nome || 'da frota'}
                        {termoRetiradaPecaPrint.veiculo_placa
                          ? ` (${termoRetiradaPecaPrint.veiculo_placa})`
                          : ''}
                      </strong>
                      .
                    </p>
                  </div>
                </div>

                {/* Rodapé com Linha Pontilhada para Assinatura Física */}
                <div className="pt-16 pb-4 font-sans space-y-10">
                  <div className="text-center max-w-md mx-auto">
                    <div className="border-b-2 border-dotted border-black w-full mb-2 h-8" />
                    <p className="text-sm font-black uppercase text-black">
                      {termoRetiradaPecaPrint.retirado_por}
                    </p>
                    <p className="text-xs font-semibold text-zinc-600">
                      Assinatura Física de quem retirou a peça (Mecânico / Operador)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-10 pt-4 text-center text-xs">
                    <div>
                      <div className="border-b border-dotted border-zinc-500 w-full mb-1.5 h-6" />
                      <p className="font-bold text-zinc-800">
                        {termoRetiradaPecaPrint.operador_almoxarifado}
                      </p>
                      <p className="text-[11px] text-zinc-500">Operador do Almoxarifado</p>
                    </div>
                    <div>
                      <div className="border-b border-dotted border-zinc-500 w-full mb-1.5 h-6" />
                      <p className="font-bold text-zinc-800">Visto da Gestão / Manutenção</p>
                      <p className="text-[11px] text-zinc-500">Conferência de Aplicação</p>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-zinc-400 border-t border-zinc-200 pt-3">
                    Documento emitido em {formatDateTimePtBr(new Date().toISOString())} • ID Retirada:{' '}
                    {termoRetiradaPecaPrint.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
