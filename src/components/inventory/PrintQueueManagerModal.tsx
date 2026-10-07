import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Printer,
  Trash2,
  Plus,
  Minus,
  MapPin,
  ArrowRight,
  Barcode,
  Loader2,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { searchEstoqueProdutos } from '../../lib/supabaseService';
import { formatCurrencyBRL } from '../../lib/storage';
import { LabelProductItem } from './ProductLabelPrintModal';

export const PRINT_QUEUE_STORAGE_KEY = 'colaca_silagem_fila_impressao_atual';

interface PrintQueueManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  localInventory: InventoryItem[];
  queue: LabelProductItem[];
  onChangeQueue: React.Dispatch<React.SetStateAction<LabelProductItem[]>>;
  onAdvanceToPrint: (queueItems: LabelProductItem[]) => void;
}

export const PrintQueueManagerModal: React.FC<PrintQueueManagerModalProps> = ({
  isOpen,
  onClose,
  localInventory,
  queue,
  onChangeQueue,
  onAdvanceToPrint,
}) => {
  // Inputs da barra superior estilo PDV Frente de Caixa
  const [inputQtde, setInputQtde] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  // Estados de busca remota e controle de sugestões
  const [remoteProducts, setRemoteProducts] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Controle para evitar reabertura involuntária do dropdown em focos programáticos
  const isProgrammaticFocusRef = useRef(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Foco programático seguro (não dispara abertura do dropdown)
  const focusSearchInputSafely = () => {
    isProgrammaticFocusRef.current = true;
    setIsDropdownOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
      setIsDropdownOpen(false);
      setTimeout(() => {
        isProgrammaticFocusRef.current = false;
      }, 120);
    }, 50);
  };

  // Resolve a categoria em caixa alta
  const resolveCategory = (item: InventoryItem): string => {
    const cat = item.category || item.categoria || item.tipo_item;
    if (cat && typeof cat === 'string' && cat.trim()) {
      return cat.trim().toUpperCase();
    }
    return 'GERAL';
  };

  // Resolve o endereço formatado para conferência
  const resolveFormattedAddress = (item: InventoryItem): string => {
    if (item.endereco_formatado && item.endereco_formatado.trim()) {
      return item.endereco_formatado.trim();
    }
    if (item.estoque_setor || item.estoque_rua || item.estoque_estante || item.estoque_nivel || item.estoque_box) {
      return [
        item.estoque_setor || '00',
        item.estoque_rua || '00',
        item.estoque_estante || '00',
        item.estoque_nivel || '00',
        item.estoque_box || '00',
      ].join('.');
    }
    if (item.setor || item.rua || item.estante || item.nivel || item.box) {
      return [
        item.setor || '00',
        item.rua || '00',
        item.estante || '00',
        item.nivel || '00',
        item.box || '00',
      ].join('.');
    }
    if (item.location && item.location.includes('.')) {
      return item.location.trim();
    }
    return item.localizacao_fisica || item.location || '00.00.00.00.00';
  };

  // Resolve o código interno do produto
  const resolveInternalCode = (item: InventoryItem): string => {
    if (item.code !== undefined && item.code !== null && String(item.code).trim()) return String(item.code).trim();
    if (item.codigo_produto !== undefined && item.codigo_produto !== null && String(item.codigo_produto).trim()) return String(item.codigo_produto).trim();
    return `ID:${String(item.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
  };

  // Carrega produtos da chave 'colaca_silagem_estoque_produtos' no LocalStorage
  const storageStockProducts = useMemo<InventoryItem[]>(() => {
    if (!isOpen) return [];
    try {
      const raw = localStorage.getItem('colaca_silagem_estoque_produtos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.warn('Erro ao ler colaca_silagem_estoque_produtos no PrintQueueManagerModal:', err);
    }
    return [];
  }, [isOpen]);

  // Restaura fila salva na chave 'colaca_silagem_fila_impressao_atual' ao abrir se estiver vazia
  useEffect(() => {
    if (isOpen && queue.length === 0) {
      try {
        const saved = localStorage.getItem(PRINT_QUEUE_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            onChangeQueue(parsed);
          }
        }
      } catch (e) {
        console.warn('Erro ao restaurar colaca_silagem_fila_impressao_atual:', e);
      }
    }
  }, [isOpen, queue.length, onChangeQueue]);

  // Abertura do modal: nasce OBRIGATORIAMENTE FECHADO e OCULTO
  useEffect(() => {
    if (isOpen) {
      setInputQtde('1');
      setSearchQuery('');
      setSelectedProduct(null);
      setIsDropdownOpen(false);
      setHighlightedIndex(0);
      focusSearchInputSafely();
    }
  }, [isOpen]);

  // Busca conectada à tabela 'public.estoque_produtos'
  useEffect(() => {
    if (!isOpen || !searchQuery.trim()) return;
    let isCancelled = false;

    const fetchFromEstoqueProdutos = async () => {
      setIsSearching(true);
      try {
        const results = await searchEstoqueProdutos(searchQuery);
        if (!isCancelled) {
          setRemoteProducts(results);
        }
      } catch (err) {
        console.warn('Erro ao buscar itens em public.estoque_produtos:', err);
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    };

    const timer = setTimeout(fetchFromEstoqueProdutos, 180);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen]);

  // Fecha o dropdown ao clicar fora da área de busca
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lista unificada: LocalStorage ('colaca_silagem_estoque_produtos') + localInventory + remoteProducts
  const allStockProducts = useMemo(() => {
    const map = new Map<string, InventoryItem>();

    // 1. Produtos do LocalStorage oficial
    storageStockProducts.forEach((item) => {
      map.set(item.id, item);
    });

    // 2. Inventário local passado por prop
    localInventory.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      } else {
        const current = map.get(item.id)!;
        map.set(item.id, { ...item, ...current });
      }
    });

    // 3. Resultados remotos do Supabase
    remoteProducts.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      } else {
        const current = map.get(item.id)!;
        map.set(item.id, { ...current, ...item });
      }
    });

    return Array.from(map.values());
  }, [storageStockProducts, localInventory, remoteProducts]);

  // Resultados filtrados da busca por Nome, Código interno ou Código de Barras
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allStockProducts.slice(0, 15);

    return allStockProducts
      .filter((item) => {
        const name = String(item.nome_comercial || item.name || '').toLowerCase();
        const code = String(item.code ?? item.codigo_produto ?? '').toLowerCase();
        const barcode = String(item.barcode ?? item.codigo_barras ?? '').toLowerCase();
        const address = resolveFormattedAddress(item).toLowerCase();
        const category = resolveCategory(item).toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          barcode.includes(q) ||
          address.includes(q) ||
          category.includes(q)
        );
      })
      .slice(0, 25);
  }, [allStockProducts, searchQuery]);

  // Atualiza a fila e persiste imediatamente em 'colaca_silagem_fila_impressao_atual'
  const persistQueueUpdate = (updater: (prev: LabelProductItem[]) => LabelProductItem[]) => {
    onChangeQueue((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(PRINT_QUEUE_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.warn('Erro ao persistir fila no LocalStorage:', err);
      }
      return next;
    });
  };

  // Ação de Inserir Item (+ INSERIR / ENTER)
  const handleInsertItem = () => {
    setIsDropdownOpen(false); // Fechamento imediato obrigatório
    const parsedQty = Math.max(1, Math.min(999, parseInt(inputQtde, 10) || 1));
    let productToInsert: InventoryItem | null = selectedProduct;

    // Se nenhum produto foi clicado explicitamente, tenta o primeiro resultado da busca ou o match exato de código
    if (!productToInsert && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const exactMatch = allStockProducts.find((p) => {
        const code = String(p.code ?? p.codigo_produto ?? '').toLowerCase();
        const barcode = String(p.barcode ?? p.codigo_barras ?? '').toLowerCase();
        return code === q || barcode === q;
      });
      productToInsert = exactMatch || (searchResults.length > 0 ? searchResults[0] : null);
    }

    if (!productToInsert) {
      focusSearchInputSafely();
      return;
    }

    const targetProduct = productToInsert;

    persistQueueUpdate((prev) => {
      const existingIdx = prev.findIndex((entry) => entry.product.id === targetProduct.id);
      if (existingIdx >= 0) {
        return prev.map((entry, idx) =>
          idx === existingIdx
            ? { ...entry, product: targetProduct, quantity: (entry.quantity || 1) + parsedQty }
            : entry
        );
      }
      return [...prev, { product: targetProduct, quantity: parsedQty }];
    });

    // Limpa os campos para o próximo item e refoca na busca com segurança
    setSearchQuery('');
    setSelectedProduct(null);
    setInputQtde('1');
    setIsDropdownOpen(false);
    setHighlightedIndex(0);

    focusSearchInputSafely();
  };

  // Seleciona produto nas sugestões do autocomplete
  const handleSelectSuggestion = (product: InventoryItem) => {
    setSelectedProduct(product);
    setSearchQuery(String(product.nome_comercial || product.name || '').toUpperCase());
    setIsDropdownOpen(false);
    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
  };

  // Atualização direta da quantidade editável na célula da tabela
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    const validQty = Math.max(1, Math.min(999, isNaN(newQty) ? 1 : newQty));
    persistQueueUpdate((prev) =>
      prev.map((entry) =>
        entry.product.id === productId ? { ...entry, quantity: validQty } : entry
      )
    );
  };

  // Remoção de item individual da fila
  const handleRemoveFromQueue = (productId: string) => {
    persistQueueUpdate((prev) => prev.filter((entry) => entry.product.id !== productId));
  };

  // Limpeza total da fila
  const handleClearQueue = () => {
    persistQueueUpdate(() => []);
  };

  if (!isOpen) return null;

  const totalProductsInQueue = queue.length;
  const totalLabelsToPrint = queue.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-2xl w-[75vw] max-w-5xl h-[95vh] max-h-[95vh] shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08),inset_-1px_-1px_0px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-slate-800 dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* 1. CABEÇALHO 3D METÁLICO ACETINADO COM ACABAMENTO TRIDIMENSIONAL */}
        {/* ============================================================== */}
        <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 flex items-center justify-between shrink-0 rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
              <Printer className="w-4 h-4 text-sky-600 dark:text-sky-400 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 font-['Outfit']">
                GERENCIADOR DE FILA DE IMPRESSÃO
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                Insira produtos na fila de impressão com a mesma agilidade e precisão do PDV Frente de Caixa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        {/* ============================================================== */}
        {/* CORPO DO MODAL - BLINDAGEM SLIM DESIGN (ZERO ROLAGEM GERAL)     */}
        {/* ============================================================== */}
        <div className="p-3 sm:p-4 space-y-3 overflow-hidden flex-1 flex flex-col min-h-0">
          
          {/* ============================================================== */}
          {/* 2. CONJUNTO DE INPUTS DE ENTRADA SUPERIOR (IGUAL AO PDV)       */}
          {/* ============================================================== */}
          <div className="bg-slate-50 dark:bg-stone-800/60 p-2.5 rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
            <div className="grid grid-cols-12 gap-2 items-end">
              
              {/* Input 'QTDE ETIQUETAS' */}
              <div className="col-span-3 sm:col-span-2">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-1">
                  QTDE ETIQUETAS
                </label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="1"
                  max="999"
                  value={inputQtde}
                  onChange={(e) => setInputQtde(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInsertItem();
                    }
                  }}
                  className="w-full text-center px-2 py-1.5 rounded-xl border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-slate-900 dark:text-white shadow-2xs focus:ring-2 focus:ring-sky-500 outline-none transition"
                  placeholder="1"
                />
              </div>

              {/* Input 'PESQUISAR PRODUTO' (Combobox / Autocomplete) */}
              <div ref={searchContainerRef} className="col-span-6 sm:col-span-7 relative">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-1 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Search className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    <span>PESQUISAR PRODUTO</span>
                  </span>
                  {isSearching && (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Buscando...</span>
                    </span>
                  )}
                </label>

                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onFocus={() => {
                      // A lista SÓ aparece quando o usuário clica ativamente (não em foco programático)
                      if (!isProgrammaticFocusRef.current && (searchQuery.trim().length > 0 || searchResults.length > 0)) {
                        setIsDropdownOpen(true);
                      }
                    }}
                    onClick={() => {
                      // Clique explícito dentro do campo
                      if (searchResults.length > 0) {
                        setIsDropdownOpen(true);
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setSearchQuery(val);
                      setSelectedProduct(null);
                      setIsDropdownOpen(true);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setIsDropdownOpen(true);
                        setHighlightedIndex((prev) => Math.min(searchResults.length - 1, prev + 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedIndex((prev) => Math.max(0, prev - 1));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        setIsDropdownOpen(false); // Fechamento imediato obrigatório
                        if (isDropdownOpen && searchResults.length > 0 && highlightedIndex >= 0) {
                          handleSelectSuggestion(searchResults[highlightedIndex]);
                        } else {
                          handleInsertItem();
                        }
                      } else if (e.key === 'Escape') {
                        setIsDropdownOpen(false);
                      }
                    }}
                    placeholder="DIGITE O NOME, CÓDIGO OU CÓDIGO DE BARRAS..."
                    className="w-full pl-3 pr-10 py-1.5 rounded-xl border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-slate-900 dark:text-white uppercase shadow-2xs focus:ring-2 focus:ring-sky-500 outline-none transition placeholder:normal-case placeholder:font-medium placeholder:text-slate-400"
                  />
                  <Barcode className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Dropdown de Sugestões do Autocomplete / Combobox */}
                {isDropdownOpen && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800 scrollbar-none">
                    {searchResults.map((item, idx) => {
                      const displayName = String(item.nome_comercial || item.name || '').toUpperCase();
                      const internalCode = resolveInternalCode(item);
                      const catName = resolveCategory(item);
                      const inQueueItem = queue.find((q) => q.product.id === item.id);
                      const salePrice = Number(item.salePrice ?? item.preco_venda_varejo ?? item.unitCost ?? 0);
                      const isHighlighted = idx === highlightedIndex;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDropdownOpen(false); // Fechamento imediato obrigatório
                            handleSelectSuggestion(item);
                          }}
                          className={`w-full px-3 py-2 text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                            isHighlighted
                              ? 'bg-sky-100 dark:bg-sky-950/60'
                              : 'hover:bg-sky-50/80 dark:hover:bg-sky-950/30'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs text-slate-900 dark:text-stone-100 truncate">
                                {displayName}
                              </span>
                              {inQueueItem && (
                                <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-black shrink-0">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>{inQueueItem.quantity}x na fila</span>
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500 dark:text-stone-400 mt-0.5">
                              <span className="font-mono font-bold text-slate-700 dark:text-stone-300 bg-slate-100 dark:bg-stone-800 px-1.5 py-0.2 rounded">
                                CÓD: {internalCode}
                              </span>
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded bg-slate-100 dark:bg-stone-800 font-semibold text-slate-600 dark:text-stone-300 uppercase text-[9.5px]">
                                <Tag className="w-2.5 h-2.5 text-slate-400" />
                                <span>{catName}</span>
                              </span>
                              {salePrice > 0 && (
                                <span className="font-mono font-bold text-slate-700 dark:text-stone-300">
                                  {formatCurrencyBRL(salePrice)}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0 uppercase bg-sky-50 dark:bg-sky-950/50 px-2 py-1 rounded-md border border-sky-200 dark:border-sky-800">
                            Selecionar
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botão '+ INSERIR (ENTER)' com gradiente azul e filete de luz interna */}
              <div className="col-span-3 sm:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDropdownOpen(false); // Fechamento imediato obrigatório
                    handleInsertItem();
                  }}
                  className="w-full h-[33px] inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold text-white uppercase rounded-xl bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 hover:from-sky-400 hover:to-sky-600 border border-sky-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ INSERIR (ENTER)</span>
                </button>
              </div>

            </div>
          </div>

          {/* ============================================================== */}
          {/* 3. GRADE CENTRAL DE ITENS ADICIONADOS À FILA DE IMPRESSÃO       */}
          {/* ============================================================== */}
          <div className="border border-slate-300 dark:border-stone-700 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-2xs flex-1 max-h-[calc(100vh-210px)] overflow-y-auto scrollbar-none flex flex-col min-h-0">
            <div className="overflow-x-auto overflow-y-auto scrollbar-none flex-1 min-h-0">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-stone-800/90 border-b border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-[12%] whitespace-nowrap">CÓDIGO</th>
                    <th className="py-2.5 px-3 w-[54%]">DESCRIÇÃO DO PRODUTO</th>
                    <th className="py-2.5 px-3 w-[16%] whitespace-nowrap">CATEGORIA</th>
                    <th className="py-2.5 px-3 text-center w-[10%] whitespace-nowrap">QTD ETIQUETAS</th>
                    <th className="py-2.5 px-3 text-right w-[8%] whitespace-nowrap">AÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-stone-800">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-stone-800 text-slate-400 flex items-center justify-center mx-auto shadow-2xs">
                            <Barcode className="w-5 h-5 text-slate-500 dark:text-stone-400" />
                          </div>
                          <p className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-stone-300">
                            FILA DE IMPRESSÃO VAZIA. BUSQUE E INSIRA PRODUTOS ACIMA.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    queue.map(({ product: item, quantity = 1 }) => {
                      const displayName = String(item.nome_comercial || item.name || '').toUpperCase();
                      const internalCode = resolveInternalCode(item);
                      const category = resolveCategory(item);
                      const formattedAddress = resolveFormattedAddress(item);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-stone-800/40 transition"
                        >
                          {/* [CÓDIGO] */}
                          <td className="py-2 px-3 align-middle whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-stone-200 font-mono text-[11px] font-bold border border-slate-200 dark:border-stone-700">
                              {internalCode}
                            </span>
                          </td>

                          {/* [DESCRIÇÃO DO PRODUTO] */}
                          <td className="py-2 px-3 align-middle">
                            <div className="font-bold text-slate-900 dark:text-stone-100 text-xs sm:text-[13px] leading-snug break-words">
                              {displayName}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              {formattedAddress && formattedAddress !== '00.00.00.00.00' && (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold text-sky-700 dark:text-sky-400">
                                  <MapPin className="w-2.5 h-2.5" />
                                  <span>{formattedAddress}</span>
                                </span>
                              )}
                              {(item.brand || item.marca) && (
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-stone-400 uppercase">
                                  • {String(item.brand || item.marca)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* [CATEGORIA] */}
                          <td className="py-2 px-3 align-middle whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-stone-800 dark:text-stone-300 border border-slate-200 dark:border-stone-700 uppercase">
                              {category}
                            </span>
                          </td>

                          {/* [QTD ETIQUETAS (Editável na célula)] */}
                          <td className="py-2 px-3 align-middle whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.id, quantity - 1)}
                                disabled={quantity <= 1}
                                className="w-6 h-6 rounded-md border border-slate-300 dark:border-stone-700 bg-gradient-to-b from-white to-slate-100 dark:from-stone-800 dark:to-stone-900 text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700 shadow-2xs disabled:opacity-40 transition flex items-center justify-center font-bold cursor-pointer active:scale-95"
                                title="Diminuir quantidade"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max="999"
                                value={quantity}
                                onChange={(e) =>
                                  handleUpdateQuantity(item.id, parseInt(e.target.value, 10) || 1)
                                }
                                className="w-12 h-6 text-center font-mono font-bold text-xs rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.id, quantity + 1)}
                                className="w-6 h-6 rounded-md border border-slate-300 dark:border-stone-700 bg-gradient-to-b from-white to-slate-100 dark:from-stone-800 dark:to-stone-900 text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700 shadow-2xs transition flex items-center justify-center font-bold cursor-pointer active:scale-95"
                                title="Aumentar quantidade"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* [AÇÃO (Ícone de Lixeira para remover da fila)] */}
                          <td className="py-2 px-3 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromQueue(item.id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 border border-rose-300/80 dark:border-rose-800/60 shadow-2xs transition cursor-pointer active:scale-95 inline-flex items-center justify-center"
                              title="Remover item da fila de impressão"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* 4. RODAPÉ 3D METÁLICO ACETINADO COM GATILHO DE IMPRESSÃO       */}
        {/* ============================================================== */}
        <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-t border-slate-300 dark:border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0 rounded-b-2xl">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-stone-300">
              FILA: <strong className="text-slate-900 dark:text-white font-mono">{totalProductsInQueue}</strong> {totalProductsInQueue === 1 ? 'PRODUTO' : 'PRODUTOS'} | TOTAL: <strong className="text-sky-600 dark:text-sky-400 font-mono">{totalLabelsToPrint}</strong> {totalLabelsToPrint === 1 ? 'ETIQUETA' : 'ETIQUETAS'}
            </span>

            {queue.length > 0 && (
              <button
                type="button"
                onClick={handleClearQueue}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>LIMPAR FILA</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-stone-300 border border-slate-300 dark:border-stone-700 bg-gradient-to-b from-white via-slate-50 to-slate-100 hover:bg-slate-100 dark:from-stone-800 dark:to-stone-900 shadow-[inset_0_1px_0px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.05)] rounded-xl transition cursor-pointer active:scale-95"
            >
              CANCELAR
            </button>

            <button
              type="button"
              disabled={queue.length === 0}
              onClick={() => onAdvanceToPrint(queue)}
              className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 hover:from-sky-400 hover:to-sky-600 border border-sky-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] rounded-xl transition flex items-center space-x-1.5 cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>AVANÇAR PARA IMPRESSÃO</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
