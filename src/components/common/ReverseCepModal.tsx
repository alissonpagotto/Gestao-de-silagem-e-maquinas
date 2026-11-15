import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Search, Loader2, MapPin, Info, ChevronDown, Check } from 'lucide-react';
import {
  ReverseCepItem,
  fetchCitiesByUf,
  searchCepByAddress,
  searchCepByCity,
} from '../../lib/formatters';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const NO_BAIRRO_KEY = '__SEM_BAIRRO__';

function normalizeSearchText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface ReverseCepModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUf?: string;
  initialCity?: string;
  initialStreet?: string;
  onSelectResult: (result: {
    cep: string;
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  }) => void;
  zIndexClass?: string;
}

export const ReverseCepModal: React.FC<ReverseCepModalProps> = ({
  isOpen,
  onClose,
  initialUf = 'PR',
  initialCity = '',
  initialStreet = '',
  onSelectResult,
  zIndexClass = 'z-[10010]',
}) => {
  const [uf, setUf] = useState('PR');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');

  // IBGE Municipalities autocomplete state
  const [ibgeCities, setIbgeCities] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [highlightedCityIndex, setHighlightedCityIndex] = useState(0);
  const cityContainerRef = useRef<HTMLDivElement>(null);

  // ViaCEP Results & Neighborhood Filter state
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ReverseCepItem[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Track latest async CEP query to ignore stale responses
  const activeQueryIdRef = useRef(0);
  // Prevent auto-debounce from firing immediately on modal open reset
  const skipNextStreetEffectRef = useRef(false);

  const runSearch = useCallback(async (targetUf: string, targetCity: string, targetStreet: string) => {
    const cleanCity = targetCity.trim();
    const cleanStreet = targetStreet.trim();
    setErrorMsg(null);

    if (cleanCity.length < 3) {
      setErrorMsg('Selecione ou informe uma Cidade / Município (mínimo 3 caracteres).');
      return;
    }

    const queryId = ++activeQueryIdRef.current;
    setIsSearching(true);
    setHasSearched(true);
    setSelectedNeighborhood(null);

    try {
      const res =
        cleanStreet.length >= 3
          ? await searchCepByAddress(targetUf, cleanCity, cleanStreet)
          : await searchCepByCity(targetUf, cleanCity);

      if (queryId !== activeQueryIdRef.current) return;

      if (res.success) {
        setResults(res.items);
        if (res.items.length === 0) {
          setErrorMsg(res.message || 'Nenhum CEP encontrado para os critérios informados.');
        }
      } else {
        setResults([]);
        setErrorMsg(res.message || 'Não foi possível pesquisar o CEP.');
      }
    } finally {
      if (queryId === activeQueryIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  // Initialize state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const normalizedUf = (initialUf || 'PR').trim().toUpperCase();
    const validUf = BRAZILIAN_STATES.includes(normalizedUf) ? normalizedUf : 'PR';
    const cleanInitialCity = (initialCity || '').trim();
    const cleanInitialStreet = (initialStreet || '').trim();

    setUf(validUf);
    setCity(cleanInitialCity);
    setStreet(cleanInitialStreet);
    setResults([]);
    setSelectedNeighborhood(null);
    setErrorMsg(null);
    setHasSearched(false);
    setIsCityDropdownOpen(false);
    skipNextStreetEffectRef.current = true;

    if (cleanInitialCity.length >= 3) {
      void runSearch(validUf, cleanInitialCity, cleanInitialStreet);
    }
  }, [isOpen, initialUf, initialCity, initialStreet, runSearch]);

  // Fetch IBGE municipalities whenever modal is open and UF changes
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoadingCities(true);

    void fetchCitiesByUf(uf).then((res) => {
      if (cancelled) return;
      setIbgeCities(res.cities);
      setIsLoadingCities(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, uf]);

  // Close city dropdown when clicking outside
  useEffect(() => {
    if (!isCityDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (cityContainerRef.current && !cityContainerRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isCityDropdownOpen]);

  // Filtered IBGE cities (accent-insensitive)
  const filteredCities = useMemo(() => {
    const query = normalizeSearchText(city);
    if (!query) return ibgeCities;
    const startsWith: string[] = [];
    const includes: string[] = [];
    for (const c of ibgeCities) {
      const norm = normalizeSearchText(c);
      if (norm.startsWith(query)) {
        startsWith.push(c);
      } else if (norm.includes(query)) {
        includes.push(c);
      }
    }
    return [...startsWith, ...includes];
  }, [ibgeCities, city]);

  useEffect(() => {
    setHighlightedCityIndex(0);
  }, [city, uf, isCityDropdownOpen]);

  // Dynamic ViaCEP search when user types in optional street field (3+ chars or cleared back to empty)
  useEffect(() => {
    if (!isOpen) return;
    if (skipNextStreetEffectRef.current) {
      skipNextStreetEffectRef.current = false;
      return;
    }

    const cleanCity = city.trim();
    if (cleanCity.length < 3) return;

    const cleanStreet = street.trim();
    if (cleanStreet.length > 0 && cleanStreet.length < 3) return;

    const timer = setTimeout(() => {
      void runSearch(uf, cleanCity, cleanStreet);
    }, 450);

    return () => clearTimeout(timer);
  }, [street, isOpen, uf, city, runSearch]);

  // Extract distinct neighborhoods from loaded results with counts
  const neighborhoodOptions = useMemo(() => {
    const counts = new Map<string, { key: string; label: string; count: number }>();
    for (const item of results) {
      const rawBairro = item.bairro.trim();
      const key = rawBairro || NO_BAIRRO_KEY;
      const label = rawBairro || 'Centro / CEP Único (Sem bairro)';
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { key, label, count: 1 });
      }
    }
    return Array.from(counts.values()).sort((a, b) => {
      if (a.key === NO_BAIRRO_KEY) return 1;
      if (b.key === NO_BAIRRO_KEY) return -1;
      return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });
    });
  }, [results]);

  // Filter left results by selected neighborhood
  const displayedResults = useMemo(() => {
    if (selectedNeighborhood === null) return results;
    return results.filter((item) => {
      const key = item.bairro.trim() || NO_BAIRRO_KEY;
      return key === selectedNeighborhood;
    });
  }, [results, selectedNeighborhood]);

  const handleSelectCity = (chosenCity: string) => {
    setCity(chosenCity);
    setIsCityDropdownOpen(false);
    skipNextStreetEffectRef.current = true;
    void runSearch(uf, chosenCity, street);
  };

  const handleUfChange = (nextUf: string) => {
    activeQueryIdRef.current += 1;
    setUf(nextUf);
    setCity('');
    setResults([]);
    setSelectedNeighborhood(null);
    setErrorMsg(null);
    setHasSearched(false);
    setIsCityDropdownOpen(false);
  };

  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsCityDropdownOpen(true);
      setHighlightedCityIndex((prev) =>
        filteredCities.length > 0 ? Math.min(prev + 1, filteredCities.length - 1) : 0
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedCityIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Escape') {
      setIsCityDropdownOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (isCityDropdownOpen && filteredCities.length > 0 && filteredCities[highlightedCityIndex]) {
        handleSelectCity(filteredCities[highlightedCityIndex]);
      } else {
        setIsCityDropdownOpen(false);
        void runSearch(uf, city, street);
      }
    }
  };

  const handleStreetKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      void runSearch(uf, city, street);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-2 sm:p-4 bg-black/60 overflow-hidden`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}
    >
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho Oficial */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] border-b border-black flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-black flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900">
                BUSCAR CEP POR ENDEREÇO
              </h4>
              <p className="text-[11px] text-slate-800 font-medium">
                Selecione a UF e Cidade (IBGE) para listar bairros e CEPs automaticamente, ou filtre pelo nome da rua
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Fechar busca de CEP"
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo Principal */}
        <div className="p-3.5 sm:p-4 flex flex-col gap-3 bg-[#cad4e6] flex-1 min-h-0 overflow-hidden text-slate-900">
          {/* Card de Filtros */}
          <div className="bg-[#e0e6f1] p-3.5 rounded-xl border border-black shadow-2xs space-y-2.5 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              {/* UF */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  UF (ESTADO)
                </label>
                <select
                  value={uf}
                  onChange={(e) => handleUfChange(e.target.value)}
                  className="w-full h-[36px] px-2.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-600 cursor-pointer"
                >
                  {BRAZILIAN_STATES.map((stateCode) => (
                    <option key={stateCode} value={stateCode}>
                      {stateCode}
                    </option>
                  ))}
                </select>
              </div>

              {/* Combobox Inteligente de Cidade (IBGE) */}
              <div className="sm:col-span-5 relative" ref={cityContainerRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                    CIDADE / MUNICÍPIO <span className="text-rose-600">*</span>
                  </label>
                  {isLoadingCities ? (
                    <span className="text-[10px] font-semibold text-slate-700 inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      IBGE...
                    </span>
                  ) : (
                    ibgeCities.length > 0 && (
                      <span className="text-[10px] font-semibold text-slate-600">
                        {ibgeCities.length} municípios ({uf})
                      </span>
                    )
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={city}
                    onFocus={() => setIsCityDropdownOpen(true)}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setIsCityDropdownOpen(true);
                    }}
                    onKeyDown={handleCityKeyDown}
                    placeholder={isLoadingCities ? 'Carregando cidades do IBGE...' : 'Digite ou selecione a cidade...'}
                    autoComplete="off"
                    className="w-full h-[36px] pl-3 pr-14 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {city && (
                      <button
                        type="button"
                        onClick={() => {
                          setCity('');
                          setResults([]);
                          setSelectedNeighborhood(null);
                          setHasSearched(false);
                          setIsCityDropdownOpen(true);
                        }}
                        title="Limpar cidade"
                        className="p-1 text-slate-500 hover:text-black rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCityDropdownOpen((prev) => !prev)}
                      title="Abrir lista de municípios"
                      className="p-1 text-slate-700 hover:text-black rounded cursor-pointer"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isCityDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {isCityDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-black rounded-xl shadow-2xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {isLoadingCities ? (
                      <div className="px-3 py-3 text-xs text-slate-600 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>Carregando municípios de {uf} via IBGE...</span>
                      </div>
                    ) : filteredCities.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-slate-600">
                        Nenhuma cidade correspondente encontrada no IBGE.
                      </div>
                    ) : (
                      filteredCities.slice(0, 120).map((cityOption, idx) => {
                        const isSelected = normalizeSearchText(cityOption) === normalizeSearchText(city);
                        const isHighlighted = idx === highlightedCityIndex;
                        return (
                          <button
                            key={cityOption}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectCity(cityOption);
                            }}
                            onMouseEnter={() => setHighlightedCityIndex(idx)}
                            className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-50 text-emerald-950 font-bold'
                                : 'text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            <span>{cityOption}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Nome da Rua / Logradouro (Opcional) */}
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  NOME DA RUA / LOGRADOURO <span className="text-slate-600 font-semibold">(OPCIONAL)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    onKeyDown={handleStreetKeyDown}
                    placeholder="Opcional: digite 3+ letras da rua para filtrar"
                    className="w-full h-[36px] pl-3 pr-8 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                  {street && (
                    <button
                      type="button"
                      onClick={() => setStreet('')}
                      title="Limpar filtro de rua"
                      className="p-1 text-slate-500 hover:text-black rounded cursor-pointer absolute right-1.5 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
              <p className="text-[11px] text-slate-800 flex items-start sm:items-center gap-1.5 font-medium">
                <Info className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  Ao escolher a <strong>Cidade</strong>, os CEPs e bairros principais são carregados automaticamente — não é obrigatório informar a rua.
                </span>
              </p>

              <button
                type="button"
                onClick={() => void runSearch(uf, city, street)}
                disabled={isSearching}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider border border-emerald-800 shadow-xs transition cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                {isSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>{isSearching ? 'Pesquisando...' : 'Pesquisar CEP'}</span>
              </button>
            </div>
          </div>

          {/* Mensagem de erro / alerta */}
          {errorMsg && (
            <div className="bg-amber-50 border border-amber-500 text-amber-950 rounded-xl px-3.5 py-2 text-xs font-semibold shrink-0">
              {errorMsg}
            </div>
          )}

          {/* Área Dividida em 2 Colunas: Esquerda (CEPs/Ruas) + Direita (Bairros Encontrados) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
            {/* Coluna Esquerda (8 cols): Resultados Encontrados */}
            <div className="lg:col-span-8 flex flex-col min-h-0 bg-[#e0e6f1] p-2.5 rounded-xl border border-black shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1.5 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                    RESULTADOS ENCONTRADOS ({displayedResults.length})
                  </span>
                  {selectedNeighborhood !== null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-600 text-emerald-900 text-[10px] font-bold">
                      <span>
                        Bairro:{' '}
                        {selectedNeighborhood === NO_BAIRRO_KEY
                          ? 'Centro / CEP Único'
                          : selectedNeighborhood}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedNeighborhood(null)}
                        title="Limpar filtro de bairro"
                        className="hover:text-black cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>

                {displayedResults.length > 0 && (
                  <span className="text-[10.5px] font-semibold text-emerald-800">
                    Clique em um endereço para preencher automaticamente
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-0 bg-white border border-gray-400 rounded-lg overflow-y-auto divide-y divide-slate-200">
                {isSearching ? (
                  <div className="h-full min-h-[160px] flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Consultando CEPs e logradouros no ViaCEP...</span>
                  </div>
                ) : displayedResults.length === 0 ? (
                  <div className="h-full min-h-[160px] flex items-center justify-center px-6 text-center text-xs text-slate-600 font-medium">
                    {hasSearched
                      ? 'Nenhum endereço encontrado com os critérios selecionados. Tente ajustar o nome da rua ou limpar o filtro de bairro.'
                      : 'Selecione uma Cidade acima para carregar automaticamente os CEPs e bairros disponíveis.'}
                  </div>
                ) : (
                  displayedResults.map((item, idx) => (
                    <button
                      key={`${item.cep}-${item.logradouro}-${idx}`}
                      type="button"
                      onClick={() => {
                        onSelectResult({
                          cep: item.cep,
                          street: item.logradouro,
                          neighborhood: item.bairro,
                          city: item.localidade,
                          state: item.uf,
                        });
                        onClose();
                      }}
                      className="w-full px-3 py-2.5 text-left hover:bg-emerald-50 transition flex items-start justify-between gap-3 cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-900">
                            {item.logradouro || 'CEP Único / Logradouro não especificado'}
                          </span>
                          {item.complemento && (
                            <span className="text-[11px] text-slate-600 font-medium">
                              ({item.complemento})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-700 font-medium">
                          {item.bairro ? `Bairro: ${item.bairro} • ` : 'CEP Geral / Sem bairro específico • '}
                          {item.localidade}/{item.uf}
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-900 border border-slate-300 group-hover:border-emerald-700 font-mono text-xs font-black shrink-0 transition">
                        {item.cep}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Coluna Direita (4 cols): Bairros Encontrados na Cidade */}
            <div className="lg:col-span-4 flex flex-col min-h-0 bg-[#e0e6f1] p-2.5 rounded-xl border border-black shadow-2xs">
              <div className="flex items-center justify-between px-1 pb-1.5 shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                  BAIRROS ENCONTRADOS NA CIDADE ({neighborhoodOptions.length})
                </span>
              </div>

              <div className="flex-1 min-h-0 bg-white border border-gray-400 rounded-lg overflow-y-auto divide-y divide-slate-200">
                {isSearching ? (
                  <div className="h-full min-h-[120px] flex items-center justify-center gap-2 text-xs text-slate-600 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Mapeando bairros...</span>
                  </div>
                ) : results.length === 0 ? (
                  <div className="h-full min-h-[120px] flex items-center justify-center px-4 text-center text-xs text-slate-500 font-medium">
                    Os bairros encontrados aparecerão aqui após selecionar a cidade.
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedNeighborhood(null)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        selectedNeighborhood === null
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-900 hover:bg-slate-50 font-semibold'
                      }`}
                    >
                      <span className="truncate">Todos os Bairros</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                          selectedNeighborhood === null
                            ? 'bg-emerald-800 text-white'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {results.length}
                      </span>
                    </button>

                    {neighborhoodOptions.map((option) => {
                      const isActive = selectedNeighborhood === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() =>
                            setSelectedNeighborhood((prev) =>
                              prev === option.key ? null : option.key
                            )
                          }
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'text-slate-800 hover:bg-emerald-50 font-medium'
                          }`}
                        >
                          <span className="truncate">{option.label}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                              isActive
                                ? 'bg-emerald-800 text-white'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {option.count}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé Oficial */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] border-t border-black flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold border border-black uppercase shadow-2xs transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReverseCepModal;
