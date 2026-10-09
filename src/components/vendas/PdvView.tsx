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
  Clock
} from 'lucide-react';
import { Client, CompanyProfile, ServiceOrder, InventoryItem } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredInventory, getActiveCompanyId } from '../../lib/storage';
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

interface PdvViewProps {
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onSaveService: (service: ServiceOrder) => void;
  salesCount: number;
}

const PDV_DRAFT_KEY = 'colaca_silagem_pdv_draft_itens';

export const PdvView: React.FC<PdvViewProps> = ({
  clients = [],
  companyProfile,
  onSaveService,
  salesCount,
}) => {
  const { confirm: confirmDialog } = useConfirm();
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

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
  
  // Sugestões de autocomplete na busca
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Cliente selecionado no PDV
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('CONSUMIDOR FINAL / BALCÃO');
  const [showClientSuggestions, setShowClientSuggestions] = useState<boolean>(false);

  // Controle de Pagamento
  const [formaPagamento, setFormaPagamento] = useState<'a_vista' | 'cartao_debito' | 'cartao_credito' | 'pix' | 'prazo'>('a_vista');
  const [valorPagoInput, setValorPagoInput] = useState<string>('');
  
  // Bloco Prazo
  const [prazoCondicao, setPrazoCondicao] = useState<string>('30 DIAS');
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [qtdeParcelas, setQtdeParcelas] = useState<number>(1);

  // Modal de Cupom / Comprovante
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [lastFinishedSale, setLastFinishedSale] = useState<{
    orderNumber: string;
    date: string;
    time: string;
    client: string;
    items: PdvItem[];
    totalBruto: number;
    totalDesconto: number;
    totalLiquido: number;
    forma: string;
    valorPago: number;
    troco: number;
    parcelas?: InstallmentRow[];
  } | null>(null);

  // Foco inicial no campo de busca ao montar
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Catálogo combinado de produtos (Estoque + Commodities de Silagem)
  const productCatalog = useMemo(() => {
    const commodities = [
      { id: 'com_silagem_milho', code: 'SIL-01', barcode: '7891001', name: 'SILAGEM DE MILHO PLANTA INTEIRA', unit: 'TON', price: 380.00 },
      { id: 'com_silagem_sorgo', code: 'SIL-02', barcode: '7891002', name: 'SILAGEM DE SORGO FORRAGEIRO', unit: 'TON', price: 320.00 },
      { id: 'com_silagem_capim', code: 'SIL-03', barcode: '7891003', name: 'SILAGEM DE CAPIM AÇU', unit: 'TON', price: 260.00 },
      { id: 'com_frete_ton', code: 'SRV-01', barcode: '7891004', name: 'TRANSPORTE / FRETE DE SILAGEM', unit: 'TON', price: 45.00 },
      { id: 'com_lona_200', code: 'INS-01', barcode: '7891005', name: 'LONA PLÁSTICA DUPLA FACE 200 MICRAS', unit: 'M', price: 18.50 },
      { id: 'com_inoculante', code: 'INS-02', barcode: '7891006', name: 'INOCULANTE BACTERIANO P/ SILAGEM 1L', unit: 'L', price: 145.00 },
    ];

    const stockMapped = stockItems.map(item => ({
      id: item.id,
      code: item.code || `EST-${item.id.slice(-4).toUpperCase()}`,
      barcode: item.barcode || '',
      name: (item.nome_comercial || item.name || '').toUpperCase(),
      unit: (item.unidade_medida || item.unit || 'UN').toUpperCase(),
      price: Number(item.preco_venda_varejo !== undefined ? item.preco_venda_varejo : item.salePrice || 0),
    }));

    return [...commodities, ...stockMapped];
  }, [stockItems]);

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

  // Clientes filtrados para sugestão de autocomplete
  const suggestedClients = useMemo(() => {
    if (!clientSearch.trim() || clientSearch === 'CONSUMIDOR FINAL / BALCÃO') return [];
    const q = clientSearch.toLowerCase().trim();
    return clients.filter(c => 
      (c.nome || c.name || '').toLowerCase().includes(q) ||
      (c.fazenda || c.farmName || '').toLowerCase().includes(q) ||
      (c.cpfCnpj || '').includes(q)
    ).slice(0, 6);
  }, [clientSearch, clients]);

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

  // Selecionar um produto do autocomplete
  const handleSelectProduct = (prod: typeof productCatalog[0]) => {
    setInputCodigo(prod.code);
    setInputDescricao(prod.name);
    setInputUnidade(prod.unit);
    setInputPreco(prod.price > 0 ? prod.price.toFixed(2).replace('.', ',') : '0,00');
    setInputBusca(prod.name);
    setShowSuggestions(false);
    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
  };

  // Adicionar item à grade
  const handleAdicionarItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const desc = (inputDescricao || inputBusca).trim().toUpperCase();
    if (!desc) {
      searchInputRef.current?.focus();
      return;
    }

    const qtd = parseFloat(inputQtde.replace(',', '.')) || 1;
    const preco = parseFloat(inputPreco.replace(/\./g, '').replace(',', '.')) || 0;
    const descPct = parseFloat(inputDesconto.replace(',', '.')) || 0;

    const totalBruto = Math.round(qtd * preco * 100) / 100;
    const valorDesc = Math.round(totalBruto * (descPct / 100) * 100) / 100;
    const totalLiquido = Math.max(0, totalBruto - valorDesc);

    const newItem: PdvItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      codigo: inputCodigo || `COD-${String(items.length + 1).padStart(3, '0')}`,
      descricao: desc,
      unidade: inputUnidade.trim().toUpperCase() || 'UN',
      quantidade: qtd,
      precoUnitario: preco,
      percentualDesconto: descPct,
      valorDesconto: valorDesc,
      totalBruto: totalBruto,
      totalLiquido: totalLiquido
    };

    setItems(prev => [...prev, newItem]);

    // Limpar campos de entrada para o próximo item e refocar na busca
    setInputBusca('');
    setInputCodigo('');
    setInputDescricao('');
    setInputQtde('1,00');
    setInputPreco('0,00');
    setInputDesconto('0,00');
    setShowSuggestions(false);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
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
    setValorPagoInput('');
    setClientSearch('CONSUMIDOR FINAL / BALCÃO');
    setSelectedClientId('');
    try {
      localStorage.removeItem(PDV_DRAFT_KEY);
    } catch {}
    searchInputRef.current?.focus();
  };

  // Finalizar a Venda no PDV (F2)
  const handleFinalizarVenda = () => {
    if (items.length === 0) {
      setWarningMessage('Nenhum item lançado no PDV. Insira ao menos um produto antes de finalizar a venda.');
      searchInputRef.current?.focus();
      setTimeout(() => setWarningMessage(null), 4000);
      return;
    }

    const orderNum = `PDV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const clientNameResolved = clientSearch.trim() || 'CONSUMIDOR FINAL (PDV BALCÃO)';
    const selectedClientObj = clients.find(c => c.id === selectedClientId);

    const newSaleOrder: ServiceOrder = {
      id: `srv_pdv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      orderNumber: orderNum,
      clientName: clientNameResolved,
      clientId: selectedClientId || undefined,
      farmName: selectedClientObj?.fazenda || selectedClientObj?.farmName || 'Venda Rápida Balcão PDV',
      serviceTab: 'venda',
      serviceType: 'Venda de Silagem & Insumos (PDV)',
      date: dateStr,
      startDate: dateStr,
      completionDate: dateStr,
      status: 'concluido',
      ratePerUnit: totals.totalLiquido,
      totalAmount: totals.totalLiquido,
      tonsEstimated: items.reduce((acc, it) => it.unidade.includes('TON') ? acc + it.quantidade : acc, 0),
      notes: `Venda gerada via Frente de Caixa PDV • Pagamento: ${formaPagamento.toUpperCase()} (${formaPagamento === 'prazo' ? 'PENDENTE' : 'PAGO'}) • Itens: ${items.map(i => `${i.quantidade}x ${i.descricao}`).join('; ')}`,
    };

    // Salvar reativamente
    onSaveService(newSaleOrder);

    // Preparar dados para o cupom
    const formaLabelMap = {
      a_vista: 'À VISTA (DINHEIRO)',
      cartao_debito: 'CARTÃO DE DÉBITO',
      cartao_credito: 'CARTÃO DE CRÉDITO',
      pix: 'PIX INSTANTÂNEO',
      prazo: `A PRAZO (${prazoCondicao} - ${qtdeParcelas}x)`
    };

    setLastFinishedSale({
      orderNumber: orderNum,
      date: formatDateBR(dateStr),
      time: timeStr,
      client: clientNameResolved,
      items: [...items],
      totalBruto: totals.totalBruto,
      totalDesconto: totals.totalDesconto,
      totalLiquido: totals.totalLiquido,
      forma: formaLabelMap[formaPagamento],
      valorPago: totals.valorPago,
      troco: totals.troco,
      parcelas: formaPagamento === 'prazo' ? [...parcelas] : undefined
    });

    // Limpar o PDV
    handleLimparPdv();

    // Abrir automaticamente comprovante de cupom
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
      // F5: Imprimir Último Cupom
      else if (e.key === 'F5') {
        e.preventDefault();
        if (lastFinishedSale) {
          setIsReceiptOpen(true);
        } else if (items.length > 0) {
          window.print();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, totals, formaPagamento, lastFinishedSale, confirmDialog]);

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
          {/* Linha de Identificação de Cliente & Atalhos Rápidos */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-semibold text-slate-700 dark:text-stone-300">
            <div className="relative flex items-center gap-1.5 flex-1 min-w-[260px]">
              <span className="font-extrabold uppercase text-[10px] text-slate-500 dark:text-stone-400 shrink-0 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-600 dark:text-stone-300" />
                CLIENTE:
              </span>
              <input
                type="text"
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value.toUpperCase());
                  setShowClientSuggestions(true);
                }}
                onFocus={() => setShowClientSuggestions(true)}
                placeholder="CONSUMIDOR FINAL / BALCÃO (OU BUSQUE O CLIENTE...)"
                className="flex-1 px-2 py-0.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold uppercase tracking-wide focus:ring-1 focus:ring-sky-500 outline-none"
              />

              {/* Sugestões de Clientes */}
              {showClientSuggestions && suggestedClients.length > 0 && (
                <div className="absolute top-full left-16 right-0 z-50 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-xl max-h-40 overflow-y-auto mt-0.5 divide-y divide-slate-100 dark:divide-stone-800">
                  {suggestedClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setClientSearch((c.nome || c.name || '').toUpperCase());
                        setShowClientSuggestions(false);
                        searchInputRef.current?.focus();
                      }}
                      className="w-full text-left px-2 py-1 text-xs hover:bg-sky-100 dark:hover:bg-stone-800 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="font-bold text-zinc-900 dark:text-white truncate">{c.nome || c.name}</span>
                      <span className="text-[10px] text-slate-500 dark:text-stone-400 truncate">{c.fazenda || c.farmName || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Teclas de Apoio Operacional */}
            <div className="hidden md:flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-stone-400">
              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F3] BUSCA</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[ENTER] INSERIR</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F2] FINALIZAR</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F4] LIMPAR</span>
            </div>
          </div>

          {/* Grid de Inputs Horizontais Estilo Supermercado */}
          <div className="grid grid-cols-12 gap-1.5 items-end">
            {/* 1. QTDE (Q) */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5">
                QTDE (Q)
              </label>
              <input
                ref={qtyInputRef}
                type="text"
                value={inputQtde}
                onChange={e => setInputQtde(e.target.value)}
                className="w-full text-center px-1 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                placeholder="1,00"
              />
            </div>

            {/* 2. DESCRIÇÃO / CÓD. / REFERÊNCIA COM FOCO AUTOMÁTICO (F3) */}
            <div className="col-span-6 sm:col-span-5 relative">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 flex items-center justify-between">
                <span>DESCRIÇÃO / CÓDIGO / REFERÊNCIA [F3]</span>
                <Barcode className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={inputBusca}
                  onChange={e => {
                    setInputBusca(e.target.value);
                    setInputDescricao(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="DIGITE O NOME, CÓDIGO OU PASSE O LEITOR DE CÓDIGO DE BARRAS..."
                  className="w-full pl-2 pr-7 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none placeholder:normal-case placeholder:font-medium placeholder:text-slate-400"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Sugestões de produtos */}
              {showSuggestions && suggestedProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-0.5 divide-y divide-slate-100 dark:divide-stone-800">
                  {suggestedProducts.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-sky-100 dark:hover:bg-stone-800 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] font-bold text-slate-500">[{p.code}]</span>
                        <span className="font-bold text-zinc-900 dark:text-white truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold text-slate-500">{p.unit}</span>
                        <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrencyBRL(p.price)}</strong>
                      </div>
                    </button>
                  ))}
                </div>
              )}
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

            {/* 4. PREÇO VENDA (R$) */}
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5">
                PREÇO VENDA (R$)
              </label>
              <input
                type="text"
                value={inputPreco}
                onChange={e => setInputPreco(e.target.value)}
                className="w-full text-right px-2 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                placeholder="0,00"
              />
            </div>

            {/* 5. % DESCONTO */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-right">
                % DESC.
              </label>
              <input
                type="text"
                value={inputDesconto}
                onChange={e => setInputDesconto(e.target.value)}
                className="w-full text-right px-1 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                placeholder="0,00"
              />
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
                    className="hover:bg-sky-50/80 dark:hover:bg-sky-950/30 transition bg-sky-50/30 dark:bg-stone-900/60"
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
                onClick={() => setIsReceiptOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 text-white border border-sky-400 shadow-xs transition active:scale-95 cursor-pointer"
                title="Reimprimir cupom fiscal da última venda"
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
          <div className="mt-2 pt-2 border-t border-slate-300 dark:border-stone-800 space-y-1.5 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  PRAZO:
                </label>
                <select
                  value={prazoCondicao}
                  onChange={e => setPrazoCondicao(e.target.value)}
                  className="w-full px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase"
                >
                  <option value="30 DIAS">30 DIAS</option>
                  <option value="30/60 DIAS">30/60 DIAS</option>
                  <option value="30/60/90 DIAS">30/60/90 DIAS</option>
                  <option value="SAFRA (FECHAMENTO)">SAFRA (FECHAMENTO)</option>
                  <option value="PERSONALIZADO">PERSONALIZADO</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  DATA 1ª PARCELA:
                </label>
                <input
                  type="date"
                  value={dataPrimeiraParcela}
                  onChange={e => setDataPrimeiraParcela(e.target.value)}
                  className="w-full px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  QTDE/PARCELAS:
                </label>
                <select
                  value={qtdeParcelas}
                  onChange={e => setQtdeParcelas(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white"
                >
                  <option value={1}>1x (Parcela Única)</option>
                  <option value={2}>2x Mensais</option>
                  <option value={3}>3x Mensais</option>
                  <option value={4}>4x Mensais</option>
                  <option value={6}>6x Mensais</option>
                  <option value={12}>12x Anual</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  VALOR TOTAL A PRAZO:
                </label>
                <div className="px-2 py-0.5 rounded-md border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-amber-700 dark:text-amber-400 font-mono">
                  {formatCurrencyBRL(totals.totalLiquido)}
                </div>
              </div>
            </div>

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
                      <tr key={p.numero}>
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
          5. MODAL DE CUPOM / COMPROVANTE TÉRMICO NÃO FISCAL (PDV)
         ===================================================================== */}
      {isReceiptOpen && lastFinishedSale && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 rounded-xl border border-slate-400 dark:border-stone-800 max-w-sm w-full p-4 shadow-2xl flex flex-col space-y-3">
            {/* Header do Cupom */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-stone-800">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase text-zinc-900 dark:text-white">
                  COMPROVANTE DE VENDA • PDV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo Estilo Cupom Térmico (Font Mono) */}
            <div id="cupom-pdv-imprimivel" className="bg-slate-50 dark:bg-stone-800/80 p-3 rounded-lg border border-slate-200 dark:border-stone-700 font-mono text-[11px] space-y-2 text-zinc-900 dark:text-stone-100">
              <div className="text-center pb-2 border-b border-dashed border-slate-300 dark:border-stone-700">
                <div className="font-bold text-xs">{companyProfile?.name || 'AGRO SILAGEM & FORRAGENS'}</div>
                <div className="text-[10px] text-slate-500">{companyProfile?.cnpjCpf || companyProfile?.cnpj ? `CNPJ/CPF: ${companyProfile.cnpjCpf || companyProfile.cnpj}` : 'SISTEMA DE VENDAS AGRÍCOLAS'}</div>
                <div className="text-[10px] text-slate-500">{lastFinishedSale.date} às {lastFinishedSale.time}</div>
                <div className="text-[10px] font-bold mt-1">CUPOM: {lastFinishedSale.orderNumber}</div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase">CLIENTE:</span>
                <div className="font-bold truncate">{lastFinishedSale.client}</div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 dark:border-stone-700 py-1 space-y-1">
                <div className="flex justify-between text-[9px] font-bold text-slate-500">
                  <span>ITEM / QTD x UN</span>
                  <span>TOTAL</span>
                </div>
                {lastFinishedSale.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-[10px] leading-tight">
                    <span className="truncate pr-1">{it.quantidade}x {it.descricao}</span>
                    <span className="font-bold shrink-0">{formatCurrencyBRL(it.totalLiquido)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-xs pt-1">
                <div className="flex justify-between">
                  <span>SUBTOTAL BRUTO:</span>
                  <span>{formatCurrencyBRL(lastFinishedSale.totalBruto)}</span>
                </div>
                {lastFinishedSale.totalDesconto > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>DESCONTOS:</span>
                    <span>-{formatCurrencyBRL(lastFinishedSale.totalDesconto)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-emerald-700 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-stone-700">
                  <span>TOTAL A PAGAR:</span>
                  <span>{formatCurrencyBRL(lastFinishedSale.totalLiquido)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 dark:text-stone-300 pt-1">
                  <span>PAGAMENTO:</span>
                  <span className="font-bold">{lastFinishedSale.forma}</span>
                </div>
                {lastFinishedSale.troco > 0 && (
                  <div className="flex justify-between text-[10px] text-blue-700 dark:text-blue-400">
                    <span>TROCO:</span>
                    <span className="font-bold">{formatCurrencyBRL(lastFinishedSale.troco)}</span>
                  </div>
                )}
              </div>

              {lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 && (
                <div className="border-t border-dashed border-slate-300 dark:border-stone-700 pt-1 text-[10px]">
                  <span className="font-bold text-slate-500">PROGRAMAÇÃO DE PARCELAS:</span>
                  {lastFinishedSale.parcelas.map(p => (
                    <div key={p.numero} className="flex justify-between">
                      <span>{p.numero}ª ({formatDateBR(p.vencimento)}):</span>
                      <span className="font-bold">{formatCurrencyBRL(p.valor)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center pt-2 text-[9px] text-slate-500 uppercase border-t border-dashed border-slate-300 dark:border-stone-700">
                OBRIGADO PELA PREFERÊNCIA • VOLTE SEMPRE!
              </div>
            </div>

            {/* Ações do Modal de Cupom */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 cursor-pointer"
              >
                FECHAR
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-black transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>IMPRIMIR CUPOM</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
