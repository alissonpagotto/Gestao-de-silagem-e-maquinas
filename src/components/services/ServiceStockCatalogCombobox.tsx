import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check, Wrench, Package } from 'lucide-react';
import { InventoryItem } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';
import {
  getInventoryItemServicePrice,
  isInventoryItemService,
  normalizeNfseUnit,
} from '../../utils/nfsePrefill';

function normalizeSearchText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matchesMultiTokenQuery(haystack: string, query: string): boolean {
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return true;
  const normHaystack = normalizeSearchText(haystack);
  if (normHaystack.includes(normQuery)) return true;
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  return tokens.every((token) => normHaystack.includes(token));
}

interface CatalogEntry {
  item: InventoryItem;
  id: string;
  name: string;
  code: string;
  unit: string;
  price: number;
  categoryLabel: string;
  isService: boolean;
  haystack: string;
}

export interface ServiceStockCatalogComboboxProps {
  id?: string;
  inventory: InventoryItem[];
  selectedId: string;
  onSelectService: (item: InventoryItem | null) => void;
  placeholder?: string;
}

export const ServiceStockCatalogCombobox: React.FC<ServiceStockCatalogComboboxProps> = ({
  id = 'service-stock-catalog-select',
  inventory,
  selectedId,
  onSelectService,
  placeholder = 'DIGITE OU SELECIONE UM SERVIÇO CADASTRADO NO ESTOQUE...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allEntries: CatalogEntry[] = useMemo(() => {
    const entries = (inventory || []).map((item) => {
      const name = String(item.name || item.nome_comercial || item.nome || '').trim().toUpperCase();
      const code = String(item.code || item.codigo_produto || '').trim().toUpperCase();
      const rawUnit = String(item.unit || item.unidade_medida || 'UN').trim().toUpperCase();
      const unit = rawUnit || normalizeNfseUnit(rawUnit);
      const price = getInventoryItemServicePrice(item);
      const isService = isInventoryItemService(item);
      const categoryLabel = String(item.categoria || item.category || (isService ? 'SERVIÇOS' : 'ESTOQUE'))
        .trim()
        .toUpperCase();
      const haystack = [
        name,
        item.fiscalName,
        code,
        rawUnit,
        normalizeNfseUnit(rawUnit),
        categoryLabel,
        item.tipo_item,
        item.tipo_produto,
        item.grupo,
        item.subgrupo,
      ]
        .filter(Boolean)
        .join(' ');

      return {
        item,
        id: item.id,
        name,
        code,
        unit,
        price,
        categoryLabel,
        isService,
        haystack,
      };
    });

    return entries.sort((a, b) => {
      if (a.isService !== b.isService) return a.isService ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [inventory]);

  const filteredEntries = useMemo(() => {
    return allEntries.filter((entry) => matchesMultiTokenQuery(entry.haystack, searchQuery));
  }, [allEntries, searchQuery]);

  const serviceEntries = useMemo(
    () => filteredEntries.filter((e) => e.isService),
    [filteredEntries]
  );

  const otherEntries = useMemo(
    () => filteredEntries.filter((e) => !e.isService),
    [filteredEntries]
  );

  const flatOptions = useMemo(
    () => [...serviceEntries, ...otherEntries],
    [serviceEntries, otherEntries]
  );

  const selectedEntry = useMemo(
    () => allEntries.find((e) => e.id === selectedId) || null,
    [allEntries, selectedId]
  );

  const selectedLabel = useMemo(() => {
    if (!selectedEntry) return '';
    return `${selectedEntry.name} — ${formatCurrencyBRL(selectedEntry.price)} (${selectedEntry.unit})`;
  }, [selectedEntry]);

  const updateDropdownPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 420), window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const availableBelow = window.innerHeight - rect.bottom - 14;
    const availableAbove = rect.top - 14;
    const desiredHeight = 270;

    if (availableBelow < 150 && availableAbove > availableBelow) {
      const maxHeight = Math.min(desiredHeight, Math.max(120, availableAbove));
      const top = Math.max(12, rect.top - maxHeight - 2);
      setDropdownRect({ top, left, width, maxHeight });
    } else {
      const top = rect.bottom + 2;
      const maxHeight = Math.min(desiredHeight, Math.max(120, availableBelow));
      setDropdownRect({ top, left, width, maxHeight });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    const handleScrollOrResize = () => updateDropdownPosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, isOpen]);

  const handleOpen = () => {
    setSearchQuery('');
    setIsOpen(true);
    updateDropdownPosition();
  };

  const handlePickEntry = (entry: CatalogEntry | null) => {
    onSelectService(entry ? entry.item : null);
    setIsOpen(false);
    setSearchQuery('');
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery('');
    onSelectService(null);
    if (isOpen) {
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        handleOpen();
        return;
      }
      setHighlightedIndex((prev) =>
        flatOptions.length > 0 ? Math.min(prev + 1, flatOptions.length - 1) : 0
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
      return;
    }
    if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      const chosen = flatOptions[highlightedIndex];
      if (chosen) {
        handlePickEntry(chosen);
      }
    }
  };

  const inputDisplayValue = isOpen ? searchQuery : selectedLabel;
  const inputPlaceholder = isOpen ? selectedLabel || placeholder : placeholder;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-emerald-700 absolute left-2.5 pointer-events-none shrink-0" />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={inputDisplayValue}
          onFocus={handleOpen}
          onClick={() => {
            if (!isOpen) handleOpen();
          }}
          onChange={(e) => {
            if (!isOpen) setIsOpen(true);
            setSearchQuery(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
          autoComplete="off"
          title={selectedLabel || inputPlaceholder}
          className="w-full h-9 pl-8 pr-14 py-1.5 bg-white border border-gray-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/25 rounded-lg text-xs font-bold uppercase text-black placeholder:text-slate-500 focus:outline-none truncate shadow-2xs transition-colors"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {(selectedId || (isOpen && searchQuery)) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              title="Limpar serviço do catálogo"
              className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setSearchQuery('');
              } else {
                handleOpen();
                inputRef.current?.focus();
              }
            }}
            title={isOpen ? 'Fechar catálogo' : 'Abrir catálogo de serviços'}
            className="p-0.5 text-slate-700 hover:text-black rounded cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {isOpen &&
        dropdownRect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${dropdownRect.top}px`,
              left: `${dropdownRect.left}px`,
              width: `${dropdownRect.width}px`,
              maxHeight: `${dropdownRect.maxHeight}px`,
            }}
            className="z-[9999] bg-white border border-black rounded-lg shadow-2xl overflow-y-auto divide-y divide-slate-200"
          >
            {selectedId && !searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handlePickEntry(null);
                }}
                className="w-full px-3 py-1.5 text-left text-[10px] font-bold uppercase text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center justify-between cursor-pointer"
              >
                <span>× Desvincular serviço selecionado do catálogo</span>
              </button>
            )}

            {flatOptions.length === 0 ? (
              <div className="px-3 py-4 text-[11px] font-medium text-slate-600 text-center">
                {allEntries.length === 0
                  ? 'Nenhum serviço ou item cadastrado no Estoque ainda.'
                  : `Nenhum serviço ou item encontrado para "${searchQuery}".`}
              </div>
            ) : (
              <>
                {serviceEntries.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1.5 bg-[#e0e6f1] border-b border-black/20 text-[10px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                      <Wrench className="w-3 h-3 shrink-0 text-emerald-700" />
                      <span>SERVIÇOS / MÃO DE OBRA CADASTRADOS NO ESTOQUE ({serviceEntries.length})</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {serviceEntries.map((entry, idx) => {
                        const isSelected = selectedId === entry.id;
                        const isHighlighted = idx === highlightedIndex;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickEntry(entry);
                            }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-50 text-emerald-950'
                                : 'text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold uppercase truncate">
                                {entry.name} — {formatCurrencyBRL(entry.price)} ({entry.unit})
                              </div>
                              <div className="text-[10px] text-slate-600 font-semibold uppercase truncate">
                                {entry.code ? `CÓD: ${entry.code} • ` : ''}
                                {entry.categoryLabel}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-400 text-[10px] font-mono font-black uppercase">
                                {formatCurrencyBRL(entry.price)} / {entry.unit}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {otherEntries.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1.5 bg-[#e0e6f1] border-b border-black/20 text-[10px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Package className="w-3 h-3 shrink-0" />
                      <span>DEMAIS ITENS DO ESTOQUE ({otherEntries.length})</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {otherEntries.map((entry, idx) => {
                        const flatIdx = serviceEntries.length + idx;
                        const isSelected = selectedId === entry.id;
                        const isHighlighted = flatIdx === highlightedIndex;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickEntry(entry);
                            }}
                            onMouseEnter={() => setHighlightedIndex(flatIdx)}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-50 text-emerald-950'
                                : 'text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold uppercase truncate">
                                {entry.name} — {formatCurrencyBRL(entry.price)} ({entry.unit})
                              </div>
                              <div className="text-[10px] text-slate-600 font-semibold uppercase truncate">
                                {entry.code ? `CÓD: ${entry.code} • ` : ''}
                                {entry.categoryLabel}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300 text-[10px] font-mono font-black uppercase">
                                {formatCurrencyBRL(entry.price)} / {entry.unit}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default ServiceStockCatalogCombobox;
