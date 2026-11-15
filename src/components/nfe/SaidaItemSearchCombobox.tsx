import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, X, Check } from 'lucide-react';
import { InventoryItem, Machinery } from '../../types';

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

function formatQtyCompact(val: number): string {
  if (!Number.isFinite(val)) return '0';
  return Number.isInteger(val)
    ? val.toLocaleString('pt-BR')
    : val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

interface FlatOption {
  value: string;
  group: 'fleet' | 'inventory';
  label: string;
}

export interface SaidaItemSearchComboboxProps {
  includeFleet: boolean;
  value: string;
  vehicles: Machinery[];
  inventory: InventoryItem[];
  formatFleetOptionLabel: (v: Machinery) => string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

export const SaidaItemSearchCombobox: React.FC<SaidaItemSearchComboboxProps> = ({
  includeFleet,
  value,
  vehicles,
  inventory,
  formatFleetOptionLabel,
  onSelect,
  placeholder,
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

  // Determine display label for currently selected item
  const selectedLabel = useMemo(() => {
    if (!value) return '';
    if (value.startsWith('fleet:')) {
      const vehId = value.slice('fleet:'.length);
      const veh = vehicles.find((v) => v.id === vehId);
      return veh ? formatFleetOptionLabel(veh) : '';
    }
    const invId = value.startsWith('inv:') ? value.slice('inv:'.length) : value;
    const inv = inventory.find((p) => p.id === invId);
    if (!inv) return '';
    const name = String(inv.name || inv.nome_comercial || inv.nome || '').trim().toUpperCase();
    const qty = Number(inv.quantity ?? inv.quantidade_atual ?? 0);
    const unit = String(inv.unit || inv.unidade_medida || 'UN').trim().toUpperCase();
    return `${name} (EST: ${formatQtyCompact(qty)} ${unit})`;
  }, [value, vehicles, inventory, formatFleetOptionLabel]);

  // Indexed fleet entries
  const filteredVehicles = useMemo(() => {
    if (!includeFleet) return [];
    return vehicles
      .map((veh) => {
        const label = formatFleetOptionLabel(veh);
        const fleetCode = String(veh.fleetNumber || (veh as any).fleet_number || (veh as any).numero_frota || '').trim();
        const plate = String(veh.plate || veh.licensePlateOrSerial || (veh as any).placa_ou_serie || veh.plateOrSerial || '').trim();
        const serial = String(veh.serialNumber || (veh as any).numero_serie || '').trim();
        const haystack = [
          label,
          veh.name,
          veh.brand,
          veh.model,
          fleetCode,
          plate,
          serial,
          veh.categoriaVeiculo,
          veh.categoria,
          veh.categoryType,
          veh.type,
          (veh as any).tipo,
        ]
          .filter(Boolean)
          .join(' ');
        return {
          veh,
          optionValue: `fleet:${veh.id}`,
          label,
          fleetCode,
          plate,
          haystack,
        };
      })
      .filter((entry) => matchesMultiTokenQuery(entry.haystack, searchQuery));
  }, [includeFleet, vehicles, formatFleetOptionLabel, searchQuery]);

  // Indexed inventory entries
  const filteredInventory = useMemo(() => {
    return inventory
      .map((inv) => {
        const name = String(inv.name || inv.nome_comercial || inv.nome || '').trim().toUpperCase();
        const code = String(inv.code || inv.codigo_produto || '').trim().toUpperCase();
        const barcode = String(inv.barcode || inv.codigo_barras || '').trim().toUpperCase();
        const factoryRef = String(inv.factoryRef || inv.ref_fabrica || '').trim().toUpperCase();
        const brand = String(inv.brand || inv.marca || '').trim().toUpperCase();
        const ncm = String(inv.ncm || inv.codigo_ncm || '').trim();
        const qty = Number(inv.quantity ?? inv.quantidade_atual ?? 0);
        const unit = String(inv.unit || inv.unidade_medida || 'UN').trim().toUpperCase();
        const haystack = [name, inv.fiscalName, code, barcode, factoryRef, brand, ncm]
          .filter(Boolean)
          .join(' ');
        return {
          inv,
          optionValue: includeFleet ? `inv:${inv.id}` : inv.id,
          name,
          code,
          barcode,
          qty,
          unit,
          haystack,
        };
      })
      .filter((entry) => matchesMultiTokenQuery(entry.haystack, searchQuery));
  }, [inventory, includeFleet, searchQuery]);

  // Flat list of visible options for keyboard navigation
  const flatOptions: FlatOption[] = useMemo(() => {
    const list: FlatOption[] = [];
    for (const v of filteredVehicles) {
      list.push({ value: v.optionValue, group: 'fleet', label: v.label });
    }
    for (const p of filteredInventory) {
      list.push({ value: p.optionValue, group: 'inventory', label: p.name });
    }
    return list;
  }, [filteredVehicles, filteredInventory]);

  const updateDropdownPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minDropdownWidth = 380;
    const width = Math.min(Math.max(rect.width, minDropdownWidth), window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = rect.bottom + 2;
    const availableBelow = window.innerHeight - top - 12;
    const maxHeight = Math.min(240, Math.max(120, availableBelow));
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

  const handlePickOption = (val: string) => {
    onSelect(val);
    setIsOpen(false);
    setSearchQuery('');
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchQuery('');
    onSelect('');
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
    if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = flatOptions[highlightedIndex];
        if (chosen) {
          handlePickOption(chosen.value);
        }
      }
    }
  };

  const defaultPlaceholder = includeFleet
    ? 'BUSCAR ESTOQUE OU FROTA...'
    : 'BUSCAR PRODUTO DO ESTOQUE...';

  const inputDisplayValue = isOpen ? searchQuery : selectedLabel;
  const inputPlaceholder = isOpen
    ? selectedLabel || placeholder || defaultPlaceholder
    : placeholder || defaultPlaceholder;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="w-3 h-3 text-slate-400 absolute left-1.5 pointer-events-none shrink-0" />
        <input
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
          className="w-full pl-5 pr-9 py-1 bg-slate-50 dark:bg-stone-800 focus:bg-white dark:focus:bg-stone-900 border border-slate-300 dark:border-stone-600 focus:border-slate-600 rounded text-[11px] font-bold uppercase text-black dark:text-stone-100 placeholder:text-slate-400 focus:outline-none truncate"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {(value || (isOpen && searchQuery)) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              title="Limpar seleção"
              className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
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
            title={isOpen ? 'Fechar lista' : 'Abrir lista de itens'}
            className="p-0.5 text-slate-500 hover:text-black dark:hover:text-white rounded cursor-pointer"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
            className="z-[9999] bg-white dark:bg-stone-900 border border-black dark:border-stone-600 rounded-lg shadow-2xl overflow-y-auto max-h-60 divide-y divide-slate-100 dark:divide-stone-800"
          >
            {/* Opção para desvincular item */}
            {value && !searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handlePickOption('');
                }}
                className="w-full px-2.5 py-1.5 text-left text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 flex items-center justify-between cursor-pointer"
              >
                <span>× Limpar vínculo do item (digitar descrição manual)</span>
              </button>
            )}

            {flatOptions.length === 0 ? (
              <div className="px-3 py-3 text-[11px] font-medium text-slate-500 dark:text-stone-400 text-center">
                Nenhum item encontrado para &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <>
                {includeFleet && filteredVehicles.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1 bg-[#e0e6f1] dark:bg-stone-800 border-b border-black/20 dark:border-stone-700 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-200">
                      🚜 VEÍCULOS &amp; MÁQUINAS (GESTÃO DE FROTAS)
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-stone-800">
                      {filteredVehicles.map((entry, vIdx) => {
                        const isSelected = value === entry.optionValue;
                        const isHighlighted = vIdx === highlightedIndex;
                        return (
                          <button
                            key={entry.optionValue}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickOption(entry.optionValue);
                            }}
                            onMouseEnter={() => setHighlightedIndex(vIdx)}
                            className={`w-full px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                                : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold uppercase truncate">
                                {entry.label}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 text-[9px] font-black uppercase">
                                ATIVO FROTA
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredInventory.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1 bg-[#e0e6f1] dark:bg-stone-800 border-b border-black/20 dark:border-stone-700 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-200">
                      📦 PRODUTOS &amp; PEÇAS (ESTOQUE)
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-stone-800">
                      {filteredInventory.map((entry, pIdx) => {
                        const flatIdx = filteredVehicles.length + pIdx;
                        const isSelected = value === entry.optionValue;
                        const isHighlighted = flatIdx === highlightedIndex;
                        return (
                          <button
                            key={entry.optionValue}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickOption(entry.optionValue);
                            }}
                            onMouseEnter={() => setHighlightedIndex(flatIdx)}
                            className={`w-full px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200'
                                : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold uppercase truncate">
                                {entry.name}
                              </div>
                              {(entry.code || entry.barcode) && (
                                <div className="text-[9.5px] text-slate-500 dark:text-stone-400 font-mono truncate">
                                  {entry.code ? `CÓD: ${entry.code}` : ''}
                                  {entry.code && entry.barcode ? ' • ' : ''}
                                  {entry.barcode ? `EAN: ${entry.barcode}` : ''}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[9.5px] font-mono font-black uppercase ${
                                  entry.qty > 0
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                    : 'bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400 border-slate-300 dark:border-stone-600'
                                }`}
                              >
                                EST: {formatQtyCompact(entry.qty)} {entry.unit}
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
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

export default SaidaItemSearchCombobox;
