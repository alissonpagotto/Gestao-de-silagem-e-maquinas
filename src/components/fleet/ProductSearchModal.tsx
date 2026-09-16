import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Package, Check, ArrowDown, ArrowUp } from 'lucide-react';
import { InventoryItem } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onSelectProduct: (product: InventoryItem) => void;
  initialQuery?: string;
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onSelectProduct,
  initialQuery = '',
}) => {
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(initialQuery);
      setSelectedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, initialQuery]);

  // Extrair categorias disponíveis no inventário
  const categories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [inventory]);

  // Filtragem dos itens de estoque
  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return inventory.filter(item => {
      const matchCategory = selectedCategory === 'todos' || item.category === selectedCategory;
      if (!matchCategory) return false;

      if (!term) return true;

      const codeMatch = (item.code || '').toLowerCase().includes(term);
      const idMatch = (item.id || '').toLowerCase().includes(term);
      const nameMatch = (item.name || '').toLowerCase().includes(term);
      const barcodeMatch = (item.barcode || '').toLowerCase().includes(term);
      const locMatch = (item.location || '').toLowerCase().includes(term);

      return codeMatch || idMatch || nameMatch || barcodeMatch || locMatch;
    });
  }, [inventory, searchTerm, selectedCategory]);

  // Garantir que o índice selecionado esteja dentro dos limites
  useEffect(() => {
    if (selectedIndex >= filteredProducts.length) {
      setSelectedIndex(Math.max(0, filteredProducts.length - 1));
    }
  }, [filteredProducts.length, selectedIndex]);

  // Rolagem suave para o item selecionado via teclado
  useEffect(() => {
    if (!tableContainerRef.current) return;
    const selectedRow = tableContainerRef.current.querySelector(`[data-row-index="${selectedIndex}"]`);
    if (selectedRow) {
      selectedRow.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Navegação via teclado (setas para cima/baixo, Enter para confirmar, Esc para fechar)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts[selectedIndex]) {
        handleConfirmSelection(filteredProducts[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleConfirmSelection = (product: InventoryItem) => {
    onSelectProduct(product);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-white dark:bg-stone-900 w-full max-w-4xl rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal ERP */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-100 dark:bg-stone-800/90 border-b border-stone-200 dark:border-stone-700">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-600/10 text-blue-700 dark:text-blue-400 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                Consulta Avançada de Produtos & Peças (F4)
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Localize peças pelo Código, Nome ou Código de Barras e pressione Enter ou clique duas vezes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-700/60 rounded-lg transition"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Filtros e Busca Rápida */}
        <div className="p-4 bg-stone-50/70 dark:bg-stone-900/40 border-b border-stone-200 dark:border-stone-800 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Digite o código (ID), descrição da peça ou código de barras..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="w-full sm:w-56">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full py-2 px-2.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-medium"
              >
                <option value="todos">TODAS AS CATEGORIAS</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <span>
              Mostrando <strong>{filteredProducts.length}</strong> itens encontrados no almoxarifado
            </span>
            <div className="hidden sm:flex items-center space-x-3 text-[10px] uppercase font-mono">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-stone-200 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-semibold">↑</kbd>
                <kbd className="px-1 py-0.5 bg-stone-200 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-semibold">↓</kbd>
                Navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-semibold">ENTER</kbd>
                Selecionar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-stone-200 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 font-semibold">ESC</kbd>
                Fechar
              </span>
            </div>
          </div>
        </div>

        {/* Tabela de Produtos ERP de Alta Densidade */}
        <div ref={tableContainerRef} className="flex-1 overflow-y-auto min-h-[300px]">
          <table className="w-full text-left border-collapse table-fixed text-xs">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[42%]" />
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-stone-100 dark:bg-stone-800 border-b border-stone-300 dark:border-stone-700">
              <tr className="text-[10px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                <th className="py-2.5 px-3">CÓDIGO (ID)</th>
                <th className="py-2.5 px-3">DESCRIÇÃO DO PRODUTO</th>
                <th className="py-2.5 px-3">CATEGORIA</th>
                <th className="py-2.5 px-3 text-right">VALOR UNIT.</th>
                <th className="py-2.5 px-3 text-right">DISPONÍVEL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-500 dark:text-stone-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                    <p className="font-semibold">Nenhum produto encontrado</p>
                    <p className="text-[11px] mt-0.5">Tente buscar com outros termos ou altere a categoria</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, idx) => {
                  const isSelected = idx === selectedIndex;
                  const displayCode = product.code || product.id.slice(0, 8).toUpperCase();
                  const isLowStock = product.quantity <= (product.minQuantity || 0);

                  return (
                    <tr
                      key={product.id}
                      data-row-index={idx}
                      onClick={() => {
                        setSelectedIndex(idx);
                        handleConfirmSelection(product);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium select-none'
                          : 'bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/60'
                      }`}
                    >
                      {/* Código */}
                      <td className="py-2 px-3 font-mono font-bold whitespace-nowrap">
                        <span className={isSelected ? 'text-white' : 'text-stone-900 dark:text-stone-100'}>
                          {displayCode}
                        </span>
                      </td>

                      {/* Descrição */}
                      <td className="py-2 px-3 truncate">
                        <div className="flex items-center space-x-1.5">
                          <span className="truncate">{product.name}</span>
                          {product.location && (
                            <span 
                              className={`text-[10px] px-1 rounded ${
                                isSelected 
                                  ? 'bg-blue-700 text-blue-100' 
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400'
                              }`}
                            >
                              {product.location}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-2 px-3 truncate uppercase text-[11px]">
                        <span className={isSelected ? 'text-blue-100' : 'text-stone-500 dark:text-stone-400'}>
                          {product.category?.replace(/_/g, ' ') || 'PEÇAS'}
                        </span>
                      </td>

                      {/* Valor Unitário */}
                      <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                        <span className={isSelected ? 'text-white font-bold' : 'text-stone-900 dark:text-stone-100 font-bold'}>
                          {formatCurrencyBRL(product.unitCost || 0)}
                        </span>
                      </td>

                      {/* Quantidade Disponível */}
                      <td className="py-2 px-3 text-right font-mono whitespace-nowrap">
                        <span 
                          className={`inline-block font-semibold ${
                            isSelected 
                              ? 'text-white' 
                              : isLowStock 
                              ? 'text-amber-600 dark:text-amber-400 font-bold' 
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {product.quantity} {product.unit}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé de Ações do Modal */}
        <div className="flex items-center justify-between px-5 py-3 bg-stone-100 dark:bg-stone-800/90 border-t border-stone-200 dark:border-stone-700">
          <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
            {filteredProducts[selectedIndex] ? (
              <span>
                Item selecionado: <strong className="text-stone-800 dark:text-stone-200">{filteredProducts[selectedIndex].name}</strong> ({formatCurrencyBRL(filteredProducts[selectedIndex].unitCost || 0)})
              </span>
            ) : (
              <span>Nenhum item selecionado</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-600 transition"
            >
              Cancelar (Esc)
            </button>
            <button
              type="button"
              disabled={filteredProducts.length === 0}
              onClick={() => {
                if (filteredProducts[selectedIndex]) {
                  handleConfirmSelection(filteredProducts[selectedIndex]);
                }
              }}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirmar Seleção (Enter)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
