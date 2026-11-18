import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check, Star, FileText } from 'lucide-react';
import { NotaSaidaItem } from '../../types';

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

export interface NfeReferenciadaOption {
  id: string;
  sourceType: 'saida' | 'xml' | 'entrada' | 'legado';
  isRemessa: boolean;
  isRetorno?: boolean;
  numero: string;
  serie: string;
  dataEmissao: string;
  dataEmissaoBr: string;
  chaveAcesso: string;
  destinatarioId?: string;
  destinatarioNome: string;
  destinatarioCpfCnpj?: string;
  destinatarioIe?: string;
  destinatarioEndereco?: string;
  destinatarioCidadeUf?: string;
  nfeNaturezaOperacao?: string;
  itens: NotaSaidaItem[];
  valorTotal: number;
  itemsSummary: string;
  displayLabel: string;
}

export interface NfeReferenciadaSearchComboboxProps {
  id?: string;
  value: string;
  options: NfeReferenciadaOption[];
  onChange: (value: string) => void;
  onSelectNote: (option: NfeReferenciadaOption) => void;
  placeholder?: string;
  highlightAmber?: boolean;
}

export const NfeReferenciadaSearchCombobox: React.FC<NfeReferenciadaSearchComboboxProps> = ({
  id = 'saida-nfe-referenciada-input',
  value,
  options,
  onChange,
  onSelectNote,
  placeholder = 'DIGITE OU SELECIONE A NF-E DE REMESSA ORIGINAL...',
  highlightAmber = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTypingFilter, setIsTypingFilter] = useState(false);
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

  const filterText = isTypingFilter ? value : '';

  const filteredOptions = useMemo(() => {
    const base = options.filter((opt) => {
      const haystack = [
        opt.numero,
        opt.serie,
        opt.dataEmissaoBr,
        opt.destinatarioNome,
        opt.destinatarioCpfCnpj,
        opt.itemsSummary,
        opt.chaveAcesso,
        opt.nfeNaturezaOperacao,
        opt.displayLabel,
      ]
        .filter(Boolean)
        .join(' ');
      return matchesMultiTokenQuery(haystack, filterText);
    });
    return base;
  }, [options, filterText]);

  const remessaOptions = useMemo(
    () => filteredOptions.filter((opt) => opt.isRemessa),
    [filteredOptions]
  );

  const otherOptions = useMemo(
    () => filteredOptions.filter((opt) => !opt.isRemessa),
    [filteredOptions]
  );

  // Maintain flat navigation order: Remessa group first, then Others
  const flatOrderedOptions = useMemo(
    () => [...remessaOptions, ...otherOptions],
    [remessaOptions, otherOptions]
  );

  const updateDropdownPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minDropdownWidth = 540;
    const width = Math.min(Math.max(rect.width, minDropdownWidth), window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = rect.bottom + 3;
    const availableBelow = window.innerHeight - top - 16;
    const maxHeight = Math.min(290, Math.max(140, availableBelow));
    setDropdownRect({ top, left, width, maxHeight });
  }, []);

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
        setIsTypingFilter(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filterText, isOpen]);

  const handleOpenList = (filterMode = false) => {
    setIsTypingFilter(filterMode);
    setIsOpen(true);
    updateDropdownPosition();
  };

  const handlePickOption = (opt: NfeReferenciadaOption) => {
    onSelectNote(opt);
    setIsOpen(false);
    setIsTypingFilter(false);
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTypingFilter(false);
    onChange('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        handleOpenList(false);
        return;
      }
      setHighlightedIndex((prev) =>
        flatOrderedOptions.length > 0 ? Math.min(prev + 1, flatOrderedOptions.length - 1) : 0
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
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setIsTypingFilter(false);
      }
      return;
    }
    if (e.key === 'Enter' && isOpen) {
      const chosen = flatOrderedOptions[highlightedIndex];
      if (chosen) {
        e.preventDefault();
        e.stopPropagation();
        handlePickOption(chosen);
      }
    }
  };

  const isOptionSelected = (opt: NfeReferenciadaOption): boolean => {
    const valTrim = value.trim();
    if (!valTrim) return false;
    if (opt.chaveAcesso && valTrim === opt.chaveAcesso) return true;
    if (opt.numero && valTrim === `NF ${opt.numero} / Série ${opt.serie || '1'}`) return true;
    return false;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 absolute left-2 pointer-events-none shrink-0" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onFocus={() => handleOpenList(false)}
          onClick={() => {
            if (!isOpen) handleOpenList(false);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setIsTypingFilter(true);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          title={value || placeholder}
          className={`w-full h-8 pl-7 pr-11 py-1 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 focus:outline-none truncate ${
            highlightAmber
              ? 'bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-600 dark:border-amber-500 focus:ring-2 focus:ring-amber-500'
              : 'bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 focus:ring-2 focus:ring-[#1e40af]'
          }`}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              title="Limpar nota referenciada"
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
                setIsTypingFilter(false);
              } else {
                handleOpenList(false);
                inputRef.current?.focus();
              }
            }}
            title={isOpen ? 'Fechar lista de notas' : 'Listar notas emitidas no sistema'}
            className="p-0.5 text-slate-600 hover:text-black dark:text-stone-300 dark:hover:text-white rounded cursor-pointer"
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
            className="z-[9999] bg-white dark:bg-stone-900 border border-black dark:border-stone-600 rounded-lg shadow-2xl overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800"
          >
            {flatOrderedOptions.length === 0 ? (
              <div className="px-3 py-3 text-[11px] font-semibold text-slate-600 dark:text-stone-300 text-center space-y-0.5">
                <div>
                  {filterText
                    ? `Nenhuma nota emitida encontrada para "${filterText}".`
                    : 'Nenhuma nota emitida ou importada encontrada no sistema.'}
                </div>
                <div className="text-[10px] font-normal text-slate-500 dark:text-stone-400">
                  Você pode continuar digitando ou colando manualmente a Chave de Acesso (44 dígitos) ou Nº da NF-e.
                </div>
              </div>
            ) : (
              <>
                {remessaOptions.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1 bg-amber-100 dark:bg-amber-950/90 border-b border-amber-300 dark:border-amber-800 text-[10px] font-black uppercase tracking-wider text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-600 shrink-0" />
                      <span>NOTAS DE REMESSA EMITIDAS (PRIORITÁRIAS PARA RETORNO)</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-stone-800">
                      {remessaOptions.map((opt, idx) => {
                        const selected = isOptionSelected(opt);
                        const highlighted = idx === highlightedIndex;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickOption(opt);
                            }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={`w-full px-2.5 py-1.5 text-left text-[11px] flex items-start justify-between gap-2 transition cursor-pointer ${
                              highlighted
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
                                : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="font-bold uppercase leading-snug break-words">
                                {opt.displayLabel}
                              </div>
                              <div className="text-[9.5px] font-mono text-slate-500 dark:text-stone-400 truncate">
                                {opt.nfeNaturezaOperacao ? `${opt.nfeNaturezaOperacao.toUpperCase()} • ` : ''}
                                {opt.chaveAcesso ? `CHAVE: ${opt.chaveAcesso}` : 'SEM CHAVE DE 44 DÍGITOS'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[9px] font-black uppercase">
                                REMESSA
                              </span>
                              {selected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {otherOptions.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1 bg-[#e0e6f1] dark:bg-stone-800 border-b border-black/20 dark:border-stone-700 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-200 flex items-center gap-1.5">
                      <FileText className="w-3 h-3 shrink-0" />
                      <span>DEMAIS NOTAS EMITIDAS / REGISTRADAS NO SISTEMA</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-stone-800">
                      {otherOptions.map((opt, oIdx) => {
                        const flatIdx = remessaOptions.length + oIdx;
                        const selected = isOptionSelected(opt);
                        const highlighted = flatIdx === highlightedIndex;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickOption(opt);
                            }}
                            onMouseEnter={() => setHighlightedIndex(flatIdx)}
                            className={`w-full px-2.5 py-1.5 text-left text-[11px] flex items-start justify-between gap-2 transition cursor-pointer ${
                              highlighted
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100'
                                : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="font-bold uppercase leading-snug break-words">
                                {opt.displayLabel}
                              </div>
                              <div className="text-[9.5px] font-mono text-slate-500 dark:text-stone-400 truncate">
                                {opt.sourceType === 'saida'
                                  ? 'SAÍDA EMITIDA'
                                  : opt.sourceType === 'xml'
                                    ? 'XML IMPORTADO'
                                    : opt.sourceType === 'entrada'
                                      ? 'ENTRADA MANUAL'
                                      : 'REGISTRO FISCAL'}
                                {opt.chaveAcesso ? ` • CHAVE: ${opt.chaveAcesso}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                              {selected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
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

export default NfeReferenciadaSearchCombobox;
