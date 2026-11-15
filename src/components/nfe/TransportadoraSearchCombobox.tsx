import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check, Truck, Building2 } from 'lucide-react';
import { Supplier } from '../../types';

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

function isTransportSupplierCategory(category: string): boolean {
  const norm = normalizeSearchText(category);
  return (
    norm.includes('transport') ||
    norm.includes('frete') ||
    norm.includes('logistica') ||
    norm.includes('rodoviario') ||
    norm.includes('carga') ||
    norm.includes('motorista')
  );
}

export interface TransportadoraSearchComboboxProps {
  id?: string;
  value: string;
  selectedSupplierId?: string;
  isPropriaEmpresa?: boolean;
  suppliers: Supplier[];
  onChange: (value: string) => void;
  onSelectSupplier: (supplier: Supplier) => void;
  onClear?: () => void;
  placeholder?: string;
  compact?: boolean;
}

export const TransportadoraSearchCombobox: React.FC<TransportadoraSearchComboboxProps> = ({
  id,
  value,
  selectedSupplierId,
  isPropriaEmpresa = false,
  suppliers,
  onChange,
  onSelectSupplier,
  onClear,
  placeholder = 'BUSCAR FORNECEDOR / TRANSPORTADORA OU DIGITAR...',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
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

  // When Propria Empresa is selected, do not filter out suppliers when user opens dropdown to browse
  const filterQuery = useMemo(() => {
    if (!isOpen) return '';
    return value || '';
  }, [isOpen, value]);

  const { transportSuppliers, otherSuppliers } = useMemo(() => {
    const indexed = suppliers
      .map((s) => {
        const name = String(s.name || '').trim().toUpperCase();
        const tradeName = String(s.tradeName || '').trim().toUpperCase();
        const cnpj = String(s.cnpjOrCpf || '').trim();
        const cityUf = [s.city, s.state].filter(Boolean).join('/').toUpperCase();
        const cat = String(s.category || '').trim();
        const isTransport = isTransportSupplierCategory(cat) || normalizeSearchText(name + ' ' + tradeName).includes('transport');
        const haystack = [name, tradeName, cnpj, s.cnpjOrCpf?.replace(/\D/g, ''), cityUf, cat].filter(Boolean).join(' ');
        return {
          supplier: s,
          name,
          tradeName,
          cnpj,
          cityUf,
          cat,
          isTransport,
          haystack,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    // If the text matches the already selected supplier or company verbatim on open, keep query flexible or filter normally
    const matched = indexed.filter((entry) => matchesMultiTokenQuery(entry.haystack, filterQuery));
    const listToSplit =
      matched.length === 0 && (selectedSupplierId || isPropriaEmpresa) ? indexed : matched;

    return {
      transportSuppliers: listToSplit.filter((e) => e.isTransport),
      otherSuppliers: listToSplit.filter((e) => !e.isTransport),
    };
  }, [suppliers, filterQuery, selectedSupplierId, isPropriaEmpresa]);

  const flatSuppliers = useMemo(
    () => [...transportSuppliers, ...otherSuppliers],
    [transportSuppliers, otherSuppliers]
  );

  const updateDropdownPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minDropdownWidth = 380;
    const width = Math.min(Math.max(rect.width, minDropdownWidth), window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = rect.bottom + 3;
    const availableBelow = window.innerHeight - top - 12;
    const maxHeight = Math.min(260, Math.max(130, availableBelow));
    setDropdownRect({ top, left, width, maxHeight });
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
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [value, isOpen]);

  const handlePickSupplier = (sup: Supplier) => {
    onSelectSupplier(sup);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        updateDropdownPosition();
        return;
      }
      setHighlightedIndex((prev) =>
        flatSuppliers.length > 0 ? Math.min(prev + 1, flatSuppliers.length - 1) : 0
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Escape') {
      if (isOpen) {
        e.stopPropagation();
        setIsOpen(false);
      }
      return;
    }
    if (e.key === 'Enter' && isOpen && flatSuppliers.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const chosen = flatSuppliers[highlightedIndex];
      if (chosen) {
        handlePickSupplier(chosen.supplier);
      }
    }
  };

  const inputHeightClass = compact ? 'h-8 py-1 text-[11px]' : 'h-8 py-1.5 text-xs';

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <div className="relative flex items-center">
        <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none shrink-0" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onFocus={() => {
            setIsOpen(true);
            updateDropdownPosition();
          }}
          onClick={() => {
            if (!isOpen) {
              setIsOpen(true);
              updateDropdownPosition();
            }
          }}
          onChange={(e) => {
            if (!isOpen) {
              setIsOpen(true);
              updateDropdownPosition();
            }
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          title={value || placeholder}
          className={`w-full pl-6 pr-11 ${inputHeightClass} bg-white dark:bg-stone-900 border ${
            isPropriaEmpresa
              ? 'border-[#0369a1] ring-1 ring-[#0369a1]/30'
              : 'border-black/40 dark:border-stone-600'
          } rounded-lg font-bold text-black dark:text-stone-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 uppercase truncate`}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                if (onClear) onClear();
                else onChange('');
                inputRef.current?.focus();
              }}
              title="Limpar transportadora / motorista"
              className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (isOpen) setIsOpen(false);
              else {
                setIsOpen(true);
                updateDropdownPosition();
                inputRef.current?.focus();
              }
            }}
            title={isOpen ? 'Fechar lista de fornecedores' : 'Selecionar fornecedor / transportadora'}
            className="p-0.5 text-slate-500 hover:text-black dark:hover:text-white rounded cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
            className="z-[9999] bg-white dark:bg-stone-900 border border-black dark:border-stone-600 rounded-lg shadow-2xl overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800"
          >
            {flatSuppliers.length === 0 ? (
              <div className="px-3 py-3 text-[11px] font-medium text-slate-600 dark:text-stone-400 text-center">
                Nenhum fornecedor encontrado para &quot;{value}&quot;. Continue digitando para usar nome avulso.
              </div>
            ) : (
              <>
                {transportSuppliers.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1 bg-[#e0e6f1] dark:bg-stone-800 border-b border-black/20 dark:border-stone-700 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-200 flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                      <span>TRANSPORTADORAS &amp; FRETE (FORNECEDORES)</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-stone-800">
                      {transportSuppliers.map((entry, idx) => {
                        const isSelected = selectedSupplierId === entry.supplier.id;
                        const isHighlighted = idx === highlightedIndex;
                        return (
                          <button
                            key={entry.supplier.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickSupplier(entry.supplier);
                            }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={`w-full px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200'
                                : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold uppercase truncate">{entry.name}</div>
                              <div className="text-[9.5px] text-slate-500 dark:text-stone-400 font-mono truncate">
                                {[entry.cnpj, entry.cityUf, entry.cat].filter(Boolean).join(' • ') || 'SEM DOCUMENTO'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-[9px] font-black uppercase">
                                FRETE
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {otherSuppliers.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1 bg-[#e0e6f1] dark:bg-stone-800 border-b border-black/20 dark:border-stone-700 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-200 flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-slate-700 dark:text-stone-300" />
                      <span>DEMAIS FORNECEDORES CADASTRADOS</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-stone-800">
                      {otherSuppliers.map((entry, idx) => {
                        const flatIdx = transportSuppliers.length + idx;
                        const isSelected = selectedSupplierId === entry.supplier.id;
                        const isHighlighted = flatIdx === highlightedIndex;
                        return (
                          <button
                            key={entry.supplier.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickSupplier(entry.supplier);
                            }}
                            onMouseEnter={() => setHighlightedIndex(flatIdx)}
                            className={`w-full px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200'
                                : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold uppercase truncate">{entry.name}</div>
                              <div className="text-[9.5px] text-slate-500 dark:text-stone-400 font-mono truncate">
                                {[entry.cnpj, entry.cityUf, entry.cat].filter(Boolean).join(' • ') || 'SEM DOCUMENTO'}
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
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

export default TransportadoraSearchCombobox;
