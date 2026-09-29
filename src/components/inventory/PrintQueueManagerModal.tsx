import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Printer,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Package,
  ArrowRight,
  Barcode,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { searchEstoqueProdutos } from '../../lib/supabaseService';
import { formatCurrencyBRL } from '../../lib/storage';
import { LabelProductItem } from './ProductLabelPrintModal';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteProducts, setRemoteProducts] = useState<InventoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Resolve o endereço formatado para conferência (ex: 04.10.45.03.01)
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
    if (item.code && item.code.trim()) return item.code.trim();
    if (item.codigo_produto && item.codigo_produto.trim()) return item.codigo_produto.trim();
    return `ID:${item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
  };

  // Busca conectada à tabela 'public.estoque_produtos'
  useEffect(() => {
    if (!isOpen) return;
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

  // Lista combinada e filtrada por nome ou código (conectada a public.estoque_produtos + estado atual)
  const searchResults = useMemo(() => {
    const map = new Map<string, InventoryItem>();

    // Prioriza dados sincronizados de public.estoque_produtos e enriquece com dados locais se necessário
    remoteProducts.forEach((item) => {
      map.set(item.id, item);
    });
    localInventory.forEach((localItem) => {
      const existing = map.get(localItem.id);
      if (existing) {
        map.set(localItem.id, {
          ...localItem,
          ...existing,
          endereco_formatado: existing.endereco_formatado || localItem.endereco_formatado,
          estoque_setor: existing.estoque_setor || localItem.estoque_setor,
          estoque_rua: existing.estoque_rua || localItem.estoque_rua,
          estoque_estante: existing.estoque_estante || localItem.estoque_estante,
          estoque_nivel: existing.estoque_nivel || localItem.estoque_nivel,
          estoque_box: existing.estoque_box || localItem.estoque_box,
          salePrice: existing.salePrice || localItem.salePrice,
          preco_venda_varejo: existing.preco_venda_varejo || localItem.preco_venda_varejo,
        });
      } else {
        map.set(localItem.id, localItem);
      }
    });

    const all = Array.from(map.values());
    const q = searchQuery.trim().toLowerCase();
    if (!q) return all.slice(0, 30);

    return all
      .filter((item) => {
        const name = (item.nome_comercial || item.name || '').toLowerCase();
        const code = (item.code || item.codigo_produto || '').toLowerCase();
        const barcode = (item.barcode || item.codigo_barras || '').toLowerCase();
        const address = resolveFormattedAddress(item).toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          barcode.includes(q) ||
          address.includes(q)
        );
      })
      .slice(0, 30);
  }, [remoteProducts, localInventory, searchQuery]);

  if (!isOpen) return null;

  // Ao selecionar um produto na busca, adiciona imediatamente na tabela de listagem abaixo
  const handleSelectProduct = (product: InventoryItem) => {
    onChangeQueue((prev) => {
      const existingIdx = prev.findIndex((entry) => entry.product.id === product.id);
      if (existingIdx >= 0) {
        return prev.map((entry, idx) =>
          idx === existingIdx
            ? { ...entry, product, quantity: (entry.quantity || 1) + 1 }
            : entry
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchQuery('');
    setIsDropdownOpen(false);
    searchInputRef.current?.focus();
  };

  // Atualiza a quantidade de etiquetas de um item específico
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    const validQty = Math.max(1, Math.min(999, isNaN(newQty) ? 1 : newQty));
    onChangeQueue((prev) =>
      prev.map((entry) =>
        entry.product.id === productId ? { ...entry, quantity: validQty } : entry
      )
    );
  };

  // Remove um item da fila de impressão
  const handleRemoveFromQueue = (productId: string) => {
    onChangeQueue((prev) => prev.filter((entry) => entry.product.id !== productId));
  };

  // Limpa toda a fila
  const handleClearQueue = () => {
    onChangeQueue([]);
  };

  const totalProductsInQueue = queue.length;
  const totalLabelsToPrint = queue.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="px-5 py-4 bg-stone-900 dark:bg-stone-950 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight font-['Outfit'] text-white">
                Gerenciador de Fila de Impressão
              </h3>
              <p className="text-[11px] text-stone-400">
                Pesquise produtos em <span className="font-mono text-sky-400">estoque_produtos</span>, defina a quantidade de etiquetas por peça e avance para a impressão em lote
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Barra de Busca Rápida conectada à tabela 'public.estoque_produtos' */}
          <div ref={searchContainerRef} className="relative">
            <label className="block text-[11px] font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Adicionar Produto à Fila de Impressão (Busca por Nome ou Código)</span>
              </span>
              {isSearching && (
                <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Consultando estoque_produtos...</span>
                </span>
              )}
            </label>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    e.preventDefault();
                    handleSelectProduct(searchResults[0]);
                  } else if (e.key === 'Escape') {
                    setIsDropdownOpen(false);
                  }
                }}
                placeholder="Digite o nome do produto, código interno ou código de barras para adicionar à fila..."
                className="w-full pl-10 pr-24 py-2.5 bg-stone-50 dark:bg-stone-800/90 border border-stone-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:bg-white dark:focus:bg-stone-800 focus:ring-2 focus:ring-sky-500 outline-none transition shadow-2xs"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 px-2 py-0.5 rounded bg-stone-200/70 dark:bg-stone-700 cursor-pointer"
                >
                  Limpar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-2.5 py-1 rounded-lg hover:bg-sky-100 transition cursor-pointer"
                >
                  {isDropdownOpen ? 'Ocultar Lista' : 'Ver Produtos'}
                </button>
              )}
            </div>

            {/* Dropdown de Resultados da Busca Rápida */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 z-30 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-stone-500 dark:text-stone-400 font-medium">
                    Nenhum produto encontrado em <span className="font-mono">public.estoque_produtos</span> para "{searchQuery}".
                  </div>
                ) : (
                  searchResults.map((item) => {
                    const displayName = item.nome_comercial || item.name;
                    const internalCode = resolveInternalCode(item);
                    const formattedAddr = resolveFormattedAddress(item);
                    const inQueueItem = queue.find((q) => q.product.id === item.id);
                    const salePrice = Number(item.salePrice ?? item.preco_venda_varejo ?? item.unitCost ?? 0);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectProduct(item)}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-sky-50/80 dark:hover:bg-sky-950/40 transition flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate group-hover:text-sky-700 dark:group-hover:text-sky-300">
                              {displayName}
                            </span>
                            {inQueueItem && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-black shrink-0">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Na fila ({inQueueItem.quantity}x)</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            <span className="font-mono font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.2 rounded">
                              CÓD: {internalCode}
                            </span>
                            <span className="inline-flex items-center space-x-1 font-mono font-semibold text-sky-700 dark:text-sky-400">
                              <MapPin className="w-3 h-3" />
                              <span>{formattedAddr}</span>
                            </span>
                            {salePrice > 0 && (
                              <span className="font-mono font-bold text-stone-700 dark:text-stone-300">
                                {formatCurrencyBRL(salePrice)} / {(item.unidade_medida || item.unit || 'UN').toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-sky-600 group-hover:bg-sky-700 text-white text-xs font-bold shadow-2xs transition">
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar</span>
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Cabeçalho da Tabela de Listagem da Fila */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase tracking-wider text-stone-800 dark:text-stone-200">
                Lista de Impressão ({totalProductsInQueue} {totalProductsInQueue === 1 ? 'item adicionado' : 'itens adicionados'})
              </span>
              {totalLabelsToPrint > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-mono text-[11px] font-black">
                  Total: {totalLabelsToPrint} {totalLabelsToPrint === 1 ? 'etiqueta' : 'etiquetas'}
                </span>
              )}
            </div>

            {queue.length > 0 && (
              <button
                type="button"
                onClick={handleClearQueue}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpar Fila</span>
              </button>
            )}
          </div>

          {/* Tabela de Itens Adicionados na Fila de Impressão */}
          <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-100 dark:bg-stone-800/90 border-b border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5 w-[42%]">
                      ITEM (NOME DO PRODUTO & CÓDIGO INTERNO)
                    </th>
                    <th className="py-2.5 px-3 w-[26%]">
                      LOCALIZAÇÃO (ENDEREÇO FORMATADO)
                    </th>
                    <th className="py-2.5 px-3 text-center w-[22%]">
                      QUANTIDADE DE ETIQUETAS
                    </th>
                    <th className="py-2.5 px-3.5 text-right w-[10%]">
                      AÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/70 dark:divide-stone-800">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 px-4 text-center">
                        <div className="max-w-sm mx-auto space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center mx-auto">
                            <Barcode className="w-5 h-5" />
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300">
                            Sua fila de impressão está vazia
                          </p>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                            Use a barra de busca rápida acima para pesquisar produtos por <strong>nome</strong> ou <strong>código</strong> e adicioná-los imediatamente a esta lista.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    queue.map(({ product: item, quantity = 1 }) => {
                      const displayName = item.nome_comercial || item.name;
                      const internalCode = resolveInternalCode(item);
                      const formattedAddress = resolveFormattedAddress(item);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition"
                        >
                          {/* 1. Item (Nome do produto e código interno) */}
                          <td className="py-2.5 px-3.5 align-middle">
                            <div className="font-bold text-stone-900 dark:text-stone-100 text-xs sm:text-sm leading-snug">
                              {displayName}
                            </div>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-[10.5px] font-bold">
                                CÓD: {internalCode}
                              </span>
                              {(item.brand || item.marca) && (
                                <span className="text-[10.5px] font-semibold text-stone-500 dark:text-stone-400">
                                  • {item.brand || item.marca}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Localização (Endereço formatado para conferência) */}
                          <td className="py-2.5 px-3 align-middle">
                            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200/80 dark:border-sky-800/70 text-sky-900 dark:text-sky-200 font-mono font-black text-xs">
                              <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                              <span>{formattedAddress}</span>
                            </div>
                            <div className="text-[9.5px] font-semibold text-stone-400 dark:text-stone-500 mt-0.5 font-mono pl-1">
                              SETOR.RUA.EST.NÍV.BOX
                            </div>
                          </td>

                          {/* 3. Quantidade de Etiquetas (Input number com botões - e +) */}
                          <td className="py-2.5 px-3 align-middle">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.id, quantity - 1)}
                                disabled={quantity <= 1}
                                className="w-7 h-7 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 transition flex items-center justify-center font-bold cursor-pointer"
                                title="Diminuir quantidade"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max="999"
                                value={quantity}
                                onChange={(e) =>
                                  handleUpdateQuantity(item.id, parseInt(e.target.value, 10) || 1)
                                }
                                className="w-14 h-7 text-center font-mono font-black text-xs sm:text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.id, quantity + 1)}
                                className="w-7 h-7 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 transition flex items-center justify-center font-bold cursor-pointer"
                                title="Aumentar quantidade"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* 4. Ações (Botão com ícone de LIXEIRA vermelha) */}
                          <td className="py-2.5 px-3.5 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromQueue(item.id)}
                              className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/80 border border-rose-200/60 dark:border-rose-800/50 transition cursor-pointer inline-flex items-center justify-center"
                              title="Remover item da fila de impressão"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* Rodapé do Modal com Gatilho de Impressão Final */}
        <div className="px-5 py-3.5 bg-stone-50 dark:bg-stone-950/90 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-600 dark:text-stone-400 font-medium">
            {queue.length > 0 ? (
              <span>
                Pronto para gerar <strong className="text-stone-900 dark:text-white font-mono">{totalLabelsToPrint}</strong> {totalLabelsToPrint === 1 ? 'etiqueta' : 'etiquetas'} de <strong className="text-stone-900 dark:text-white font-mono">{totalProductsInQueue}</strong> {totalProductsInQueue === 1 ? 'produto' : 'produtos'}.
              </span>
            ) : (
              <span>Selecione ao menos 1 produto na busca acima para avançar.</span>
            )}
          </div>

          <div className="flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={queue.length === 0}
              onClick={() => onAdvanceToPrint(queue)}
              className="px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-40 disabled:pointer-events-none rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>Avançar para Impressão</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
