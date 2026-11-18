import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, Settings } from 'lucide-react';

function normalizeSearchText(text: string): string {
  return String((text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') ?? '').toLowerCase()
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

export interface FiscalCodeOption {
  codigo: string;
  descricao: string;
  badge?: string;
}

export interface FiscalCodeSearchComboboxProps {
  id?: string;
  value: string;
  options: FiscalCodeOption[];
  onSelect: (codigo: string) => void;
  onManageClick?: () => void;
  manageLabel?: string;
  placeholder?: string;
  codeColorClass?: string;
  borderColorClass?: string;
  dropdownMinWidth?: number;
}

export const FiscalCodeSearchCombobox: React.FC<FiscalCodeSearchComboboxProps> = ({
  id,
  value,
  options,
  onSelect,
  onManageClick,
  manageLabel = 'Gerenciar tabela de códigos...',
  placeholder = 'DIGITE CÓDIGO OU DESCRIÇÃO...',
  codeColorClass = 'text-black dark:text-stone-100',
  borderColorClass = 'border-black/50 dark:border-stone-600',
  dropdownMinWidth = 460,
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

  const selectedOption = useMemo(
    () => options.find((opt) => opt.codigo === value),
    [options, value]
  );

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    if (selectedOption) {
      return `${selectedOption.codigo} — ${selectedOption.descricao}`;
    }
    return value;
  }, [value, selectedOption]);

  const filteredOptions = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    const listWithCurrent = [...options];
    if (value && !listWithCurrent.some((o) => o.codigo === value)) {
      listWithCurrent.unshift({
        codigo: value,
        descricao: 'Código personalizado / informado manualmente',
        badge: 'Personalizado',
      });
    }

    if (!q) return listWithCurrent;

    const matched = listWithCurrent.filter((opt) =>
      matchesMultiTokenQuery(`${opt.codigo} ${opt.descricao} ${opt.badge || ''}`, q)
    );

    return matched.sort((a, b) => {
      const aCode = normalizeSearchText(a.codigo);
      const bCode = normalizeSearchText(b.codigo);
      const aExact = aCode === q ? 0 : aCode.startsWith(q) ? 1 : 2;
      const bExact = bCode === q ? 0 : bCode.startsWith(q) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
      return 0;
    });
  }, [options, value, searchQuery]);

  const updateDropdownPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, dropdownMinWidth), window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const availableBelow = window.innerHeight - rect.bottom - 14;
    const availableAbove = rect.top - 14;
    const desiredHeight = 240;

    if (availableBelow < 150 && availableAbove > availableBelow) {
      const maxHeight = Math.min(desiredHeight, Math.max(120, availableAbove));
      const top = Math.max(12, rect.top - maxHeight - 2);
      setDropdownRect({ top, left, width, maxHeight });
    } else {
      const maxHeight = Math.min(desiredHeight, Math.max(130, availableBelow));
      const top = rect.bottom + 2;
      setDropdownRect({ top, left, width, maxHeight });
    }
  }, [dropdownMinWidth]);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();

    const handleScrollOrResize = () => {
      updateDropdownPosition();
    };

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
    if (!isOpen) return;
    if (searchQuery) {
      setHighlightedIndex(0);
    } else {
      const idx = filteredOptions.findIndex((o) => o.codigo === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [searchQuery, isOpen, filteredOptions, value]);

  const handleOpen = () => {
    setSearchQuery('');
    setIsOpen(true);
    updateDropdownPosition();
  };

  const handlePickOption = (codigo: string) => {
    onSelect(codigo);
    setIsOpen(false);
    setSearchQuery('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        handleOpen();
        return;
      }
      setHighlightedIndex((prev) =>
        filteredOptions.length > 0 ? Math.min(prev + 1, filteredOptions.length - 1) : 0
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
    if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = filteredOptions[highlightedIndex];
        if (chosen) {
          handlePickOption(chosen.codigo);
        }
      }
    }
  };

  const inputDisplayValue = isOpen ? searchQuery : selectedLabel;
  const inputPlaceholder = isOpen
    ? selectedLabel || placeholder
    : placeholder;

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="relative flex items-center">
        <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none shrink-0" />
        <input
          ref={inputRef}
          id={id}
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
          className={`w-full h-8 pl-6 pr-6 py-1 bg-white dark:bg-stone-900 border ${borderColorClass} focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] rounded-lg text-xs font-mono font-bold ${codeColorClass} placeholder:text-slate-400 placeholder:font-sans placeholder:font-semibold focus:outline-none truncate cursor-text`}
        />
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
          title={isOpen ? 'Fechar lista' : 'Abrir lista de códigos'}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-black dark:hover:text-white rounded cursor-pointer"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
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
            className="z-[9999] bg-white dark:bg-stone-900 border border-black dark:border-stone-600 rounded-lg shadow-2xl overflow-y-auto max-h-60 flex flex-col"
          >
            <div className="divide-y divide-slate-100 dark:divide-stone-800 flex-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-[11px] font-medium text-slate-500 dark:text-stone-400 text-center">
                  Nenhum código encontrado para &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.codigo === value;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={opt.codigo}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePickOption(opt.codigo);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full px-2.5 py-2 text-left text-[11px] flex items-start justify-between gap-2 transition cursor-pointer ${
                        isHighlighted
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-slate-950 dark:text-blue-100'
                          : isSelected
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-slate-900 dark:text-stone-100'
                            : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 font-mono font-black text-[11px] text-[#1e40af] dark:text-blue-300 shrink-0">
                          {opt.codigo}
                        </span>
                        <span className="font-semibold text-[11px] leading-snug whitespace-normal break-words">
                          {opt.descricao}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        {opt.badge && (
                          <span className="px-1.5 py-0.5 rounded bg-[#e0e6f1] dark:bg-stone-800 text-slate-700 dark:text-stone-300 border border-black/15 dark:border-stone-700 text-[9px] font-black uppercase">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {onManageClick && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  setSearchQuery('');
                  onManageClick();
                }}
                className="sticky bottom-0 w-full px-2.5 py-1.5 bg-[#e0e6f1] hover:bg-[#cad4e6] dark:bg-stone-800 dark:hover:bg-stone-700 border-t border-black/20 dark:border-stone-700 text-[10px] font-black uppercase text-[#1e40af] dark:text-sky-300 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Settings className="w-3 h-3 shrink-0" />
                <span>{manageLabel}</span>
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default FiscalCodeSearchCombobox;
