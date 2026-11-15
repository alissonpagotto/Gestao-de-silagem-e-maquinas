import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check, Truck, BookmarkCheck } from 'lucide-react';
import { Machinery } from '../../types';
import { ThirdPartyPlateEntry, normalizePlateCode } from '../../lib/auxiliaryRegistries';

function normalizeSearchText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface PlateOption {
  key: string;
  placa: string;
  uf: string;
  subtitle: string;
  badge: string;
  source: 'fleet' | 'linked_third_party' | 'other_third_party';
}

export interface PlacaVeiculoSearchComboboxProps {
  id?: string;
  value: string;
  isPropriaEmpresa: boolean;
  defaultCompanyUf?: string;
  selectedTransportadoraId?: string;
  selectedTransportadoraNome?: string;
  vehicles: Machinery[];
  thirdPartyPlates: ThirdPartyPlateEntry[];
  onChange: (placa: string) => void;
  onSelectPlate: (payload: { placa: string; uf?: string }) => void;
  placeholder?: string;
  compact?: boolean;
}

export const PlacaVeiculoSearchCombobox: React.FC<PlacaVeiculoSearchComboboxProps> = ({
  id,
  value,
  isPropriaEmpresa,
  defaultCompanyUf = '',
  selectedTransportadoraId = '',
  selectedTransportadoraNome = '',
  vehicles,
  thirdPartyPlates,
  onChange,
  onSelectPlate,
  placeholder = 'PLACA (EX: ABC1D23)',
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

  const cleanCurrentValue = normalizePlateCode(value);

  const fleetPlateOptions = useMemo<PlateOption[]>(() => {
    if (!isPropriaEmpresa) return [];
    const list: PlateOption[] = [];
    const seen = new Set<string>();
    for (const v of vehicles) {
      const rawPlate = String(
        v.plate || v.licensePlateOrSerial || (v as any).placa_ou_serie || v.plateOrSerial || ''
      ).trim();
      const placa = normalizePlateCode(rawPlate);
      if (!placa || placa.length < 5 || seen.has(placa)) continue;
      seen.add(placa);

      const fleetCode = String(v.fleetNumber || (v as any).fleet_number || (v as any).numero_frota || '').trim().toUpperCase();
      const brand = String(v.brand || '').trim().toUpperCase();
      const model = String(v.model || v.name || '').trim().toUpperCase();
      const desc = brand && model && !model.includes(brand) ? `${brand} ${model}` : model || brand || 'VEÍCULO DA FROTA';
      const subtitle = fleetCode ? `Frota ${fleetCode} • ${desc}` : desc;
      const vUf = String((v as any).uf || (v as any).plateUf || (v as any).state || defaultCompanyUf || '')
        .trim()
        .toUpperCase()
        .slice(0, 2);

      list.push({
        key: `fleet_${v.id}_${placa}`,
        placa,
        uf: vUf,
        subtitle,
        badge: fleetCode ? `FROTA ${fleetCode}` : 'FROTA PRÓPRIA',
        source: 'fleet',
      });
    }
    return list.sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR'));
  }, [isPropriaEmpresa, vehicles, defaultCompanyUf]);

  const thirdPartyOptions = useMemo<{ linked: PlateOption[]; others: PlateOption[] }>(() => {
    if (isPropriaEmpresa) return { linked: [], others: [] };
    const normTranspNome = normalizeSearchText(selectedTransportadoraNome);
    const linked: PlateOption[] = [];
    const others: PlateOption[] = [];

    for (const entry of thirdPartyPlates) {
      const placa = normalizePlateCode(entry.placa);
      if (!placa) continue;

      const matchesById = Boolean(
        selectedTransportadoraId &&
          entry.transportadoraId &&
          entry.transportadoraId === selectedTransportadoraId
      );
      const matchesByName = Boolean(
        normTranspNome &&
          entry.transportadoraNome &&
          (normalizeSearchText(entry.transportadoraNome) === normTranspNome ||
            normalizeSearchText(entry.transportadoraNome).includes(normTranspNome) ||
            normTranspNome.includes(normalizeSearchText(entry.transportadoraNome)))
      );

      const subtitleParts = [
        entry.transportadoraNome || 'TERCEIRO AVULSO',
        entry.modeloVeiculo || '',
        entry.motoristaNome ? `Mot: ${entry.motoristaNome}` : '',
        entry.uf ? `UF: ${entry.uf}` : '',
      ].filter(Boolean);

      const opt: PlateOption = {
        key: `tp_${entry.id}_${placa}`,
        placa,
        uf: (entry.uf || '').toUpperCase().slice(0, 2),
        subtitle: subtitleParts.join(' • '),
        badge: matchesById || matchesByName ? 'VINCULADA' : 'TERCEIRO',
        source: matchesById || matchesByName ? 'linked_third_party' : 'other_third_party',
      };

      if (matchesById || matchesByName) linked.push(opt);
      else others.push(opt);
    }

    return { linked, others };
  }, [isPropriaEmpresa, thirdPartyPlates, selectedTransportadoraId, selectedTransportadoraNome]);

  const { primaryGroup, secondaryGroup, allOptions } = useMemo(() => {
    const queryNorm = normalizeSearchText(value);
    const filterFn = (opt: PlateOption) => {
      if (!queryNorm) return true;
      const hay = normalizeSearchText(`${opt.placa} ${opt.subtitle} ${opt.uf}`);
      return hay.includes(queryNorm) || normalizePlateCode(opt.placa).includes(cleanCurrentValue);
    };

    if (isPropriaEmpresa) {
      const filteredFleet = fleetPlateOptions.filter(filterFn);
      const list = filteredFleet.length === 0 && cleanCurrentValue ? fleetPlateOptions : filteredFleet;
      return { primaryGroup: list, secondaryGroup: [] as PlateOption[], allOptions: list };
    }

    const filteredLinked = thirdPartyOptions.linked.filter(filterFn);
    const filteredOthers = thirdPartyOptions.others.filter(filterFn);
    return {
      primaryGroup: filteredLinked,
      secondaryGroup: filteredOthers,
      allOptions: [...filteredLinked, ...filteredOthers],
    };
  }, [isPropriaEmpresa, fleetPlateOptions, thirdPartyOptions, value, cleanCurrentValue]);

  const updateDropdownPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minDropdownWidth = 310;
    const width = Math.min(Math.max(rect.width, minDropdownWidth), window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = rect.bottom + 3;
    const availableBelow = window.innerHeight - top - 12;
    const maxHeight = Math.min(240, Math.max(120, availableBelow));
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

  const handlePickOption = (opt: PlateOption) => {
    onSelectPlate({ placa: opt.placa, uf: opt.uf });
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
        allOptions.length > 0 ? Math.min(prev + 1, allOptions.length - 1) : 0
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
    if (e.key === 'Enter' && isOpen && allOptions.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const chosen = allOptions[highlightedIndex];
      if (chosen) handlePickOption(chosen);
    }
  };

  const inputHeightClass = compact ? 'h-8 py-1 text-[11px]' : 'h-8 py-1.5 text-xs';

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          maxLength={8}
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
            onChange(e.target.value.toUpperCase());
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          title={value || placeholder}
          className={`w-full pl-2 pr-10 ${inputHeightClass} bg-white dark:bg-stone-900 border border-black/40 dark:border-stone-600 rounded-lg font-mono font-bold text-black dark:text-stone-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 uppercase`}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                inputRef.current?.focus();
              }}
              title="Limpar placa"
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
            title={
              isPropriaEmpresa
                ? 'Selecionar placa da Frota Própria'
                : 'Selecionar placa memorizada de terceiros'
            }
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
            {allOptions.length === 0 ? (
              <div className="px-3 py-3 text-[11px] font-medium text-slate-600 dark:text-stone-400 text-center">
                {isPropriaEmpresa
                  ? 'Nenhuma placa encontrada na Gestão de Frotas. Digite manualmente.'
                  : cleanCurrentValue.length >= 5
                    ? `Placa "${cleanCurrentValue}" será memorizada automaticamente ao salvar/transmitir.`
                    : 'Nenhuma placa de terceiro memorizada ainda. Digite a placa para cadastrar automaticamente ao salvar.'}
              </div>
            ) : (
              <>
                {primaryGroup.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1 bg-[#e0e6f1] dark:bg-stone-800 border-b border-black/20 dark:border-stone-700 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-200 flex items-center gap-1.5">
                      {isPropriaEmpresa ? (
                        <>
                          <Truck className="w-3 h-3 text-[#0369a1]" />
                          <span>VEÍCULOS DA FROTA PRÓPRIA</span>
                        </>
                      ) : (
                        <>
                          <BookmarkCheck className="w-3 h-3 text-emerald-700" />
                          <span>PLACAS DA TRANSPORTADORA SELECIONADA</span>
                        </>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-stone-800">
                      {primaryGroup.map((opt, idx) => {
                        const isSelected = cleanCurrentValue === opt.placa;
                        const isHighlighted = idx === highlightedIndex;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickOption(opt);
                            }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={`w-full px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-950 dark:text-sky-200'
                                : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-mono font-black uppercase">
                                {opt.placa}
                                {opt.uf ? ` (${opt.uf})` : ''}
                              </div>
                              <div className="text-[9.5px] text-slate-500 dark:text-stone-400 truncate uppercase">
                                {opt.subtitle}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-700 text-[9px] font-black uppercase">
                                {opt.badge}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {secondaryGroup.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 px-2.5 py-1 bg-[#e0e6f1] dark:bg-stone-800 border-b border-black/20 dark:border-stone-700 text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-200 flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-slate-700 dark:text-stone-300" />
                      <span>OUTRAS PLACAS DE TERCEIROS MEMORIZADAS</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-stone-800">
                      {secondaryGroup.map((opt, idx) => {
                        const flatIdx = primaryGroup.length + idx;
                        const isSelected = cleanCurrentValue === opt.placa;
                        const isHighlighted = flatIdx === highlightedIndex;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handlePickOption(opt);
                            }}
                            onMouseEnter={() => setHighlightedIndex(flatIdx)}
                            className={`w-full px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                                : 'text-slate-900 dark:text-stone-100 hover:bg-slate-50 dark:hover:bg-stone-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-mono font-black uppercase">
                                {opt.placa}
                                {opt.uf ? ` (${opt.uf})` : ''}
                              </div>
                              <div className="text-[9.5px] text-slate-500 dark:text-stone-400 truncate uppercase">
                                {opt.subtitle}
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

export default PlacaVeiculoSearchCombobox;
