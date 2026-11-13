import React, { useState, useMemo, useEffect } from 'react';
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
  getStoredExpenses,
  getStoredInventory,
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

interface NovaTrocaDevolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  companyProfile?: CompanyProfile;
  defaultTipoOperacao?: TrocaOperacaoTipo;
  onSaveClients?: (clients: Client[]) => void;
  onSuccess: (record: TrocaDevolucaoRecord, shouldAutoPrint: boolean) => void;
}

const MOTIVOS_PADRAO: TrocaMotivo[] = [
  'Defeito',
  'Tamanho/Modelo Incorreto',
  'Desistência',
  'Garantia',
];

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

  // Card 1: Operação e Envolvido
  const [tipoOperacao, setTipoOperacao] = useState<TrocaOperacaoTipo>('devolucao_cliente');
  const [selectedClientId, setSelectedClientId] = useState<string>('consumidor_avulso');
  const [avulsoNome, setAvulsoNome] = useState<string>('Consumidor Avulso');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [dataOperacao, setDataOperacao] = useState<string>(todayIso);
  const [numeroOrigem, setNumeroOrigem] = useState<string>('');
  const [motivo, setMotivo] = useState<TrocaMotivo>('Defeito');
  const [observacoes, setObservacoes] = useState<string>('');

  // Card 2: Produtos Devolvidos
  const [searchDevolvido, setSearchDevolvido] = useState<string>('');
  const [selectedProdDevolvidoId, setSelectedProdDevolvidoId] = useState<string>('');
  const [qtdDevolvida, setQtdDevolvida] = useState<string>('1');
  const [precoDevolvido, setPrecoDevolvido] = useState<string>('');
  const [retornarAoEstoque, setRetornarAoEstoque] = useState<boolean>(true);
  const [itensDevolvidos, setItensDevolvidos] = useState<TrocaDevolucaoItem[]>([]);

  // Card 3: Produtos Levados na Troca (Troca Direta)
  const [searchLevado, setSearchLevado] = useState<string>('');
  const [selectedProdLevadoId, setSelectedProdLevadoId] = useState<string>('');
  const [qtdLevada, setQtdLevada] = useState<string>('1');
  const [precoLevado, setPrecoLevado] = useState<string>('');
  const [itensLevados, setItensLevados] = useState<TrocaDevolucaoItem[]>([]);

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

  // Carrega dados atualizados ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;
    setInventoryList(getStoredInventory());
    const sups = getStoredSuppliers();
    setSuppliersList(sups);
    setClientsList(clients && clients.length > 0 ? clients : getStoredClients());
    setExpensesList(getStoredExpenses());

    const initialTipo: TrocaOperacaoTipo = defaultTipoOperacao || 'devolucao_cliente';
    setTipoOperacao(initialTipo);
    setSelectedClientId('consumidor_avulso');
    setAvulsoNome('Consumidor Avulso');
    setSelectedSupplierId(sups[0]?.id || '');
    setDataOperacao(todayIso);
    setNumeroOrigem('');
    setMotivo(initialTipo === 'devolucao_fornecedor' ? 'Garantia' : 'Defeito');
    setObservacoes('');
    setSearchDevolvido('');
    setSelectedProdDevolvidoId('');
    setQtdDevolvida('1');
    setPrecoDevolvido('');
    setRetornarAoEstoque(true);
    setItensDevolvidos([]);
    setSearchLevado('');
    setSelectedProdLevadoId('');
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

  const filteredDevolvidoOptions = useMemo(() => {
    const q = searchDevolvido.trim().toLowerCase();
    return inventoryList
      .filter((item) => {
        if (!q) return true;
        const name = getItemDisplayName(item).toLowerCase();
        const code = getItemCode(item).toLowerCase();
        const barcode = String(item.barcode || item.codigo_barras || '').toLowerCase();
        return name.includes(q) || code.includes(q) || barcode.includes(q);
      })
      .slice(0, 60);
  }, [inventoryList, searchDevolvido]);

  const filteredLevadoOptions = useMemo(() => {
    const q = searchLevado.trim().toLowerCase();
    return inventoryList
      .filter((item) => {
        if (!q) return true;
        const name = getItemDisplayName(item).toLowerCase();
        const code = getItemCode(item).toLowerCase();
        const barcode = String(item.barcode || item.codigo_barras || '').toLowerCase();
        return name.includes(q) || code.includes(q) || barcode.includes(q);
      })
      .slice(0, 60);
  }, [inventoryList, searchLevado]);

  const handleSelectProdDevolvido = (id: string) => {
    setSelectedProdDevolvidoId(id);
    const found = inventoryList.find((i) => String(i.id) === String(id));
    if (found) {
      const price =
        tipoOperacao === 'devolucao_fornecedor'
          ? getItemCostPrice(found)
          : getItemSalePrice(found);
      setPrecoDevolvido(price > 0 ? price.toFixed(2) : '0.00');
    }
  };

  const handleSelectProdLevado = (id: string) => {
    setSelectedProdLevadoId(id);
    const found = inventoryList.find((i) => String(i.id) === String(id));
    if (found) {
      const price = getItemSalePrice(found);
      setPrecoLevado(price > 0 ? price.toFixed(2) : '0.00');
    }
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
              <div className="sm:col-span-6">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Tipo de Operação *
                </label>
                <select
                  value={tipoOperacao}
                  onChange={(e) => {
                    const nextTipo = e.target.value as TrocaOperacaoTipo;
                    setTipoOperacao(nextTipo);
                    if (nextTipo === 'devolucao_fornecedor') {
                      setRetornarAoEstoque(true);
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

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Motivo *
                </label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  {MOTIVOS_PADRAO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {tipoOperacao === 'devolucao_fornecedor' ? (
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                    Fornecedor *
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  >
                    {suppliersList.length === 0 && (
                      <option value="">Nenhum fornecedor cadastrado</option>
                    )}
                    {suppliersList.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} {sup.cnpjOrCpf ? `(${sup.cnpjOrCpf})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className={selectedClientId === 'consumidor_avulso' ? 'sm:col-span-3' : 'sm:col-span-5'}>
                    <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                      Cliente *
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                    >
                      <option value="consumidor_avulso">Consumidor Avulso (Balcão)</option>
                      {clientsList.map((cli) => (
                        <option key={cli.id} value={cli.id}>
                          {cli.name || cli.nome} {cli.farmName ? `— ${cli.farmName}` : ''}
                        </option>
                      ))}
                    </select>
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

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Nº Venda / Nota de Origem (Opcional)
                </label>
                <input
                  type="text"
                  value={numeroOrigem}
                  onChange={(e) => setNumeroOrigem(e.target.value)}
                  placeholder="Ex: PDV-012 ou NF 4520"
                  className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="sm:col-span-4">
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
                  <strong>Fiscal &amp; Notas → Pendências de Devolução / Garantia</strong> (status: Aguardando Decisão Fiscal).
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Filtrar Estoque
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchDevolvido}
                    onChange={(e) => setSearchDevolvido(e.target.value)}
                    placeholder="Nome, código ou barras..."
                    className="w-full pl-7 pr-2 py-1.5 bg-white border border-gray-400 text-black text-xs rounded focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                  Produto Devolvido *
                </label>
                <select
                  value={selectedProdDevolvidoId}
                  onChange={(e) => handleSelectProdDevolvido(e.target.value)}
                  className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  <option value="">-- Selecione o produto --</option>
                  {filteredDevolvidoOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getItemCode(item) ? `[${getItemCode(item)}] ` : ''}
                      {getItemDisplayName(item)} (Saldo: {getItemStockQty(item)}{' '}
                      {item.unit || item.unidade_medida || 'UN'})
                    </option>
                  ))}
                </select>
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
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                      Filtrar Estoque (Saída)
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchLevado}
                        onChange={(e) => setSearchLevado(e.target.value)}
                        placeholder="Nome, código ou barras..."
                        className="w-full pl-7 pr-2 py-1.5 bg-white border border-gray-400 text-black text-xs rounded focus:outline-none focus:ring-2 focus:ring-slate-600"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold uppercase text-slate-900 mb-1">
                      Produto Levado pelo Cliente *
                    </label>
                    <select
                      value={selectedProdLevadoId}
                      onChange={(e) => handleSelectProdLevado(e.target.value)}
                      className="w-full bg-white border border-gray-400 text-black text-xs font-semibold rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
                    >
                      <option value="">-- Selecione o produto --</option>
                      {filteredLevadoOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {getItemCode(item) ? `[${getItemCode(item)}] ` : ''}
                          {getItemDisplayName(item)} (Saldo: {getItemStockQty(item)}{' '}
                          {item.unit || item.unidade_medida || 'UN'})
                        </option>
                      ))}
                    </select>
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
