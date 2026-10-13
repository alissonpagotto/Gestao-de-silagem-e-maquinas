import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  FileText,
  X
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { formatCurrencyBRL } from '../../lib/formatters';

interface ComprasSubModuleProps {
  allItems: InventoryItem[];
  onOpenCreateItem?: () => void;
}

export interface PurchaseDraftItem {
  id: string;
  itemId?: string;
  code: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

const STORAGE_KEY = 'agrocontrol_rascunho_compras';
const LEGACY_STORAGE_KEY = 'colaca_silagem_compras_draft';

export const ComprasSubModule: React.FC<ComprasSubModuleProps> = ({
  allItems,
}) => {
  // 1. CARREGAMENTO REATIVO DE PRODUTOS CADASTRADOS (agrocontrol_produtos)
  const [storedProducts, setStoredProducts] = useState<InventoryItem[]>(() => {
    try {
      const raw = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return allItems || [];
  });

  useEffect(() => {
    const handleProductsUpdate = () => {
      try {
        const raw = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStoredProducts(parsed);
          }
        }
      } catch (_) {}
    };

    window.addEventListener('agrocontrol_produtos_updated', handleProductsUpdate);
    window.addEventListener('storage', handleProductsUpdate);
    return () => {
      window.removeEventListener('agrocontrol_produtos_updated', handleProductsUpdate);
      window.removeEventListener('storage', handleProductsUpdate);
    };
  }, []);

  const availableProducts = useMemo(() => {
    if (storedProducts && storedProducts.length > 0) return storedProducts;
    return allItems || [];
  }, [storedProducts, allItems]);

  // 2. LISTA DE RASCUNHO ISOLADA (agrocontrol_rascunho_compras)
  const [purchaseList, setPurchaseList] = useState<PurchaseDraftItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Normaliza registros caso tenham vindo do formato legado
          return parsed.map((p: any) => {
            if (p.item) {
              return {
                id: p.id || `draft_${p.item.id || Date.now()}`,
                itemId: p.item.id,
                code: (p.item.code || p.item.codigo_produto || 'S/CÓD').toUpperCase(),
                description: (p.item.nome_comercial || p.item.name || 'PRODUTO').toUpperCase(),
                category: (p.item.categoria || p.item.category || 'GERAL').toUpperCase(),
                quantity: Number(p.quantity) || 1,
                unit: p.item.unit || 'UN',
                unitCost: Number(p.item.preco_custo_inicial ?? p.item.unitCost ?? 0),
              };
            }
            return {
              id: p.id || `draft_${Date.now()}`,
              itemId: p.itemId,
              code: String(p.code || 'S/CÓD').toUpperCase(),
              description: String(p.description || 'ITEM').toUpperCase(),
              category: String(p.category || 'GERAL').toUpperCase(),
              quantity: Number(p.quantity) || 1,
              unit: String(p.unit || 'UN').toUpperCase(),
              unitCost: Number(p.unitCost) || 0,
            };
          });
        }
      }
    } catch (_) {}
    return [];
  });

  // 3. ESTADOS DA BARRA DE INSERÇÃO RÁPIDA (PDV)
  const [searchProductText, setSearchProductText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('1,00');
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // Estados de confirmação e avisos temporários
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

  const productInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Foco inicial e atalho F3
  useEffect(() => {
    productInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        productInputRef.current?.focus();
        productInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fechar dropdown de autocomplete ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        productInputRef.current &&
        !productInputRef.current.contains(e.target as Node)
      ) {
        setAutocompleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Timer para avisos temporários
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Produtos abaixo do estoque mínimo para injeção rápida opcional
  const belowStockItems = useMemo(() => {
    return availableProducts.filter(item => {
      const cur = Number(item.quantidade_atual ?? item.quantity ?? 0);
      const min = Number(item.minQuantity ?? (item as any).estoqueMinimo ?? 0);
      return cur <= min;
    });
  }, [availableProducts]);

  // Filtro preditivo para o autocomplete
  const filteredProducts = useMemo(() => {
    const term = searchProductText.trim().toLowerCase();
    if (!term) return [];
    return availableProducts.filter(p => {
      const name = String(p.nome_comercial || p.name || '').toLowerCase();
      const code = String(p.code || (p as any).codigo_produto || (p as any).barcode || '').toLowerCase();
      const cat = String(p.categoria || p.category || '').toLowerCase();
      return name.includes(term) || code.includes(term) || cat.includes(term);
    }).slice(0, 10);
  }, [availableProducts, searchProductText]);

  // Preço de referência do produto selecionado
  const refPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    return Number(
      selectedProduct.preco_custo_inicial ?? 
      selectedProduct.unitCost ?? 
      (selectedProduct as any).ultimoCusto ?? 
      0
    );
  }, [selectedProduct]);

  // Multiplicador por Asterisco no campo de busca do Produto
  const handleSearchChange = (val: string) => {
    const upperVal = val.toUpperCase();
    
    // Expressão regular para capturar multiplicador no início (ex: "5*" ou "10,5*")
    const match = upperVal.match(/^(\d+(?:[.,]\d+)?)\*(.*)$/);
    if (match) {
      const numPart = match[1];
      const restText = match[2];
      setQuantity(numPart);
      setSearchProductText(restText);
      setAutocompleteOpen(restText.trim().length > 0);
      productInputRef.current?.focus();
      return;
    }

    setSearchProductText(upperVal);
    setAutocompleteOpen(upperVal.trim().length > 0);
    setAutocompleteIndex(0);

    // Tenta correspondência exata por código ou código de barras
    const exact = availableProducts.find(p => {
      const code = String(p.code || (p as any).codigo_produto || '').trim().toUpperCase();
      const bar = String((p as any).barcode || '').trim().toUpperCase();
      return (code && code === upperVal.trim()) || (bar && bar === upperVal.trim());
    });

    if (exact) {
      setSelectedProduct(exact);
    } else if (selectedProduct && !upperVal.includes(String(selectedProduct.name || '').toUpperCase())) {
      setSelectedProduct(null);
    }
  };

  const handleSelectProduct = (prod: InventoryItem) => {
    setSelectedProduct(prod);
    setSearchProductText(`${prod.code ? `[${prod.code}] ` : ''}${prod.nome_comercial || prod.name}`.toUpperCase());
    setAutocompleteOpen(false);
    productInputRef.current?.focus();
  };

  // Disparo do Inserir Item no Rascunho (Enter ou Botão + INSERIR)
  const handleAddItemToOrder = () => {
    const rawQty = quantity.replace(',', '.');
    const numQty = parseFloat(rawQty);
    const finalQty = isNaN(numQty) || numQty <= 0 ? 1 : numQty;

    let targetItem = selectedProduct;
    if (!targetItem && filteredProducts.length > 0 && searchProductText.trim().length > 0) {
      targetItem = filteredProducts[autocompleteIndex] || filteredProducts[0];
    }

    const itemDesc = targetItem 
      ? (targetItem.nome_comercial || targetItem.name || 'PRODUTO').toUpperCase()
      : searchProductText.trim().toUpperCase();

    if (!itemDesc) {
      productInputRef.current?.focus();
      return;
    }

    const itemCode = (targetItem?.code || (targetItem as any)?.codigo_produto || 'S/CÓD').toUpperCase();
    const itemCat = (targetItem?.categoria || targetItem?.category || 'GERAL').toUpperCase();
    const itemUnit = (targetItem?.unit || 'UN').toUpperCase();
    const itemCost = targetItem ? Number(targetItem.preco_custo_inicial ?? targetItem.unitCost ?? (targetItem as any).ultimoCusto ?? 0) : 0;

    setPurchaseList(prev => {
      // Se já existir no rascunho com o mesmo código ou descrição, soma a quantidade
      const existingIdx = prev.findIndex(p => 
        (itemCode !== 'S/CÓD' && p.code === itemCode) || 
        p.description === itemDesc
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + finalQty,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          itemId: targetItem?.id,
          code: itemCode,
          description: itemDesc,
          category: itemCat,
          quantity: finalQty,
          unit: itemUnit,
          unitCost: itemCost,
        }
      ];
    });

    // Reset dos campos e retorno do foco com quantidade em 1,00
    setSearchProductText('');
    setSelectedProduct(null);
    setQuantity('1,00');
    setAutocompleteOpen(false);

    setTimeout(() => {
      productInputRef.current?.focus();
    }, 10);
  };

  const handleRemoveItem = (id: string) => {
    setPurchaseList(prev => prev.filter(p => p.id !== id));
    setTimeout(() => {
      productInputRef.current?.focus();
    }, 10);
  };

  // Incluir todos os itens que estão abaixo do estoque mínimo
  const handleImportBelowStockItems = () => {
    if (belowStockItems.length === 0) return;

    setPurchaseList(prev => {
      const updated = [...prev];
      belowStockItems.forEach(item => {
        const cur = Number(item.quantidade_atual ?? item.quantity ?? 0);
        const min = Number(item.minQuantity ?? (item as any).estoqueMinimo ?? 0);
        const deficit = Math.max(1, min - cur > 0 ? min - cur : min || 1);
        const itemCode = (item.code || (item as any).codigo_produto || 'S/CÓD').toUpperCase();
        const itemDesc = (item.nome_comercial || item.name || 'PRODUTO').toUpperCase();
        const itemCat = (item.categoria || item.category || 'GERAL').toUpperCase();
        const itemCost = Number(item.preco_custo_inicial ?? item.unitCost ?? (item as any).ultimoCusto ?? 0);

        const existingIdx = updated.findIndex(p => 
          (itemCode !== 'S/CÓD' && p.code === itemCode) || 
          p.description === itemDesc
        );

        if (existingIdx >= 0) {
          updated[existingIdx].quantity = Math.max(updated[existingIdx].quantity, deficit);
        } else {
          updated.push({
            id: `draft_${item.id || Date.now()}`,
            itemId: item.id,
            code: itemCode,
            description: itemDesc,
            category: itemCat,
            quantity: deficit,
            unit: (item.unit || 'UN').toUpperCase(),
            unitCost: itemCost,
          });
        }
      });
      return updated;
    });

    setToastMessage(`✓ ${belowStockItems.length} ITENS ABAIXO DO ESTOQUE MÍNIMO INCLUÍDOS NO RASCUNHO!`);
  };

  // Salvar rascunho no LocalStorage
  const handleSaveDraft = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(purchaseList));
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(purchaseList));
      setToastMessage('💾 RASCUNHO DA LISTA DE COMPRAS SALVO COM SUCESSO NO LOCALSTORAGE!');
    } catch (_) {
      setToastMessage('ERRO AO SALVAR RASCUNHO NO LOCALSTORAGE.');
    }
  };

  // Limpar lista e LocalStorage
  const handleConfirmClearDraft = () => {
    setPurchaseList([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (_) {}
    setShowClearConfirmModal(false);
    setToastMessage('🗑️ RASCUNHO DE COMPRAS ZERADO COM SUCESSO.');
    setTimeout(() => {
      productInputRef.current?.focus();
    }, 10);
  };

  // Cálculos de resumo
  const totalItemsCount = useMemo(() => {
    return purchaseList.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
  }, [purchaseList]);

  const totalEstimatedCost = useMemo(() => {
    return purchaseList.reduce((acc, p) => acc + ((Number(p.quantity) || 0) * (Number(p.unitCost) || 0)), 0);
  }, [purchaseList]);

  return (
    <div className="w-full flex flex-col space-y-2 h-[calc(100vh-210px)] min-h-[500px] max-h-[95vh] overflow-hidden">
      
      {/* AVISO TEMPORÁRIO DE SUCESSO */}
      {toastMessage && (
        <div className="px-3 py-2 rounded border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-black uppercase flex items-center justify-between shadow-xs animate-in fade-in duration-150 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* CABEÇALHO COMPACTO COM BOX DE RESUMO REATIVO NO TOPO DIREITO */}
      <div className="flex items-center justify-between gap-2 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-700 dark:text-stone-300" />
          <h3 className="text-xs font-black uppercase text-slate-800 dark:text-stone-100 tracking-wider">
            BLOCO DE RASCUNHO DE COMPRAS • DIGITAÇÃO RÁPIDA (PDV)
          </h3>
          <span className="text-[10px] text-slate-500 font-semibold hidden md:inline">
            [F3: FOCAR PRODUTO | EX: "5*" PARA MULTIPLICAR | ENTER: INSERIR]
          </span>
        </div>

        <div className="flex items-center gap-2">
          {belowStockItems.length > 0 && (
            <button
              type="button"
              onClick={handleImportBelowStockItems}
              title="Puxar produtos que atingiram ou estão abaixo do estoque mínimo"
              className="text-[10px] font-black uppercase px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 cursor-pointer transition shadow-xs"
            >
              <TrendingDown className="w-3 h-3 text-amber-600" />
              <span>PUXAR CRÍTICOS ({belowStockItems.length})</span>
            </button>
          )}

          {/* BOX DE RESUMO REATIVO EM SOFT COLOR NO TOPO DIREITO */}
          <div className="text-[10px] sm:text-xs font-black uppercase px-3 py-1 rounded bg-slate-100 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-200 shadow-xs flex items-center gap-1.5 whitespace-nowrap">
            <span>ITENS NO PEDIDO:</span>
            <span className="text-slate-900 dark:text-white font-mono">{purchaseList.length}</span>
            <span className="text-slate-500 font-mono">({totalItemsCount.toLocaleString('pt-BR')} UN)</span>
            <span className="text-slate-400">•</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-mono">
              TOTAL: {formatCurrencyBRL(totalEstimatedCost)}
            </span>
          </div>
        </div>
      </div>

      {/* 1. BARRA DE INSERÇÃO RÁPIDA SUPERIOR (ESTILO FRENTE DE CAIXA / PDV) */}
      <div className="bg-slate-100 dark:bg-stone-850 p-2 border border-slate-300 dark:border-stone-700 rounded flex items-center gap-2 grid grid-cols-12 shrink-0 shadow-xs">
        
        {/* Campo 1 (Col 7): PRODUTO / CÓDIGO [F3] com busca preditiva reativa */}
        <div className="col-span-12 sm:col-span-7 relative">
          <label className="block text-[9px] font-black text-slate-600 dark:text-stone-400 uppercase mb-0.5 tracking-wider">
            PRODUTO / CÓDIGO [F3]
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={productInputRef}
              type="text"
              value={searchProductText}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setAutocompleteIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setAutocompleteIndex(prev => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (autocompleteOpen && filteredProducts.length > 0 && !selectedProduct) {
                    handleSelectProduct(filteredProducts[autocompleteIndex] || filteredProducts[0]);
                  }
                  handleAddItemToOrder();
                } else if (e.key === 'Escape') {
                  setAutocompleteOpen(false);
                }
              }}
              placeholder="DIGITE NOME, CÓDIGO OU MULTIPLICADOR (EX: 5*)..."
              className="w-full pl-8 pr-3 py-1 text-xs font-bold uppercase rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-xs"
            />
          </div>

          {/* Autocomplete Dropdown Suspenso */}
          {autocompleteOpen && filteredProducts.length > 0 && (
            <div 
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800"
            >
              {filteredProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  onClick={() => handleSelectProduct(prod)}
                  className={`px-3 py-1.5 text-xs uppercase cursor-pointer flex items-center justify-between transition ${
                    idx === autocompleteIndex 
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-black' 
                      : 'hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-800 dark:text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-mono text-[10px] text-slate-500 font-bold shrink-0">
                      [{prod.code || (prod as any).codigo_produto || 'S/CÓD'}]
                    </span>
                    <span className="truncate font-bold">{prod.nome_comercial || prod.name}</span>
                    <span className="text-[9px] text-slate-400 shrink-0">
                      ({prod.categoria || prod.category || 'GERAL'})
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-2 font-mono text-[11px] font-bold text-slate-700 dark:text-stone-300">
                    {formatCurrencyBRL(Number(prod.preco_custo_inicial ?? prod.unitCost ?? (prod as any).ultimoCusto ?? 0))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campo 2 (Col 2): QTDE */}
        <div className="col-span-6 sm:col-span-2">
          <label className="block text-[9px] font-black text-slate-600 dark:text-stone-400 uppercase mb-0.5 tracking-wider">
            QTDE
          </label>
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddItemToOrder();
              }
            }}
            className="w-full px-2 py-1 text-xs font-black text-center rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
        </div>

        {/* Campo 3 (Col 2): PREÇO REF. (desabilitado) */}
        <div className="col-span-6 sm:col-span-2">
          <label className="block text-[9px] font-black text-slate-600 dark:text-stone-400 uppercase mb-0.5 tracking-wider">
            PREÇO REF.
          </label>
          <input
            type="text"
            disabled
            value={formatCurrencyBRL(refPrice)}
            className="w-full px-2 py-1 text-xs font-black text-right rounded border border-slate-300 dark:border-stone-700 bg-slate-200/80 dark:bg-stone-800 text-slate-700 dark:text-stone-300 font-mono select-none cursor-not-allowed shadow-xs"
          />
        </div>

        {/* Campo 4 (Col 1): Botão rígido + INSERIR */}
        <div className="col-span-12 sm:col-span-1 flex flex-col justify-end">
          <label className="block text-[9px] font-black text-transparent mb-0.5 select-none hidden sm:block">
            _
          </label>
          <button
            type="button"
            onClick={handleAddItemToOrder}
            className="w-full py-1 text-xs font-black uppercase rounded bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1 tracking-wider"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>INSERIR</span>
          </button>
        </div>
      </div>

      {/* 2. TABELA DE COMPRAS MANTIDA EM RASCUNHO (100% ISOLADA COM ROLAGEM INDEPENDENTE) */}
      <div className="flex-1 min-h-0 border border-slate-300 dark:border-stone-700 rounded bg-white dark:bg-stone-850 overflow-hidden flex flex-col shadow-xs">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-slate-100 dark:bg-stone-800 text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wide border-b border-slate-300 dark:border-stone-700 sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="py-1 px-3 w-28">CÓDIGO</th>
                <th className="py-1 px-3">DESCRIÇÃO</th>
                <th className="py-1 px-3 w-48">CATEGORIA</th>
                <th className="py-1 px-3 w-36 text-right">QUANTIDADE SOLICITADA</th>
                <th className="py-1 px-2 w-16 text-center">REMOVER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-stone-750">
              {purchaseList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-stone-500 uppercase font-bold text-xs">
                    <FileText className="w-8 h-8 text-slate-300 dark:text-stone-600 mx-auto mb-2" />
                    NENHUM ITEM NO BLOCO DE RASCUNHO AINDA.
                    <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-400">
                      Utilize a barra de digitação rápida no topo ou o atalho F3 para adicionar produtos.
                    </div>
                  </td>
                </tr>
              ) : (
                purchaseList.map((item) => (
                  <tr 
                    key={item.id} 
                    className="even:bg-[#eaeaea] odd:bg-white dark:even:bg-stone-800/60 dark:odd:bg-stone-900 hover:bg-slate-200/50 dark:hover:bg-stone-750 transition border-b border-slate-200 dark:border-stone-800"
                  >
                    <td className="py-1 px-3 font-mono font-bold text-slate-700 dark:text-stone-300 uppercase text-[10px]">
                      {item.code || 'S/CÓD'}
                    </td>
                    <td className="py-1 px-3 font-bold text-slate-900 dark:text-white uppercase truncate max-w-md">
                      {item.description}
                    </td>
                    <td className="py-1 px-3 text-slate-600 dark:text-stone-400 uppercase text-[10px]">
                      {item.category || 'GERAL'}
                    </td>
                    <td className="py-1 px-3 text-right font-black font-mono text-slate-900 dark:text-white">
                      {Number(item.quantity).toLocaleString('pt-BR')} {item.unit || 'UN'}
                    </td>
                    <td className="py-1 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 px-2 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950 font-black text-xs rounded transition cursor-pointer"
                        title="Remover item do rascunho"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. BOTÕES DE CONTROLE DA LISTA (RODAPÉ DO PAINEL) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-100 dark:bg-stone-850 p-2 border border-slate-300 dark:border-stone-700 rounded shrink-0 shadow-xs">
        <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-stone-400">
          * ESTE RASCUNHO É ISOLADO: NÃO ALTERA SALDO REAL DE ESTOQUE E NÃO GERA CONTAS A PAGAR.
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-black uppercase rounded bg-slate-800 hover:bg-slate-900 text-white transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1.5 tracking-wider"
          >
            <Save className="w-3.5 h-3.5" />
            <span>💾 SALVAR RASCUNHO DA LISTA</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClearConfirmModal(true)}
            disabled={purchaseList.length === 0}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-black uppercase rounded transition active:scale-95 flex items-center justify-center gap-1.5 tracking-wider ${
              purchaseList.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-stone-800 dark:text-stone-600'
                : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>🗑️ EXCLUIR LISTA COMPLETA</span>
          </button>
        </div>
      </div>

      {/* MODAL CUSTOMIZADO ANTI-SANDBOX DE CONFIRMAÇÃO PARA LIMPAR LISTA */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-2xl max-w-md w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-2">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-xs font-black uppercase tracking-wider">
                  CONFIRMAÇÃO DE EXCLUSÃO
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-2">
              <p className="text-xs font-bold uppercase text-slate-800 dark:text-stone-100 leading-relaxed">
                TEM CERTEZA QUE DESEJA ZERAR ESTE RASCUNHO?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-stone-400 mt-1">
                Todos os {purchaseList.length} itens serão removidos da tela e a chave 'agrocontrol_rascunho_compras' será apagada imediatamente.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-3 py-1.5 text-xs font-bold uppercase rounded bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-stone-800 dark:text-stone-300 transition cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleConfirmClearDraft}
                className="px-4 py-1.5 text-xs font-black uppercase rounded bg-rose-600 hover:bg-rose-700 text-white transition active:scale-95 cursor-pointer shadow-xs"
              >
                SIM, ZERAR RASCUNHO
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
