import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, MapPin, Info } from 'lucide-react';
import { ReverseCepItem, searchCepByAddress } from '../../lib/formatters';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

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
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ReverseCepItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const normalizedUf = (initialUf || 'PR').trim().toUpperCase();
    setUf(BRAZILIAN_STATES.includes(normalizedUf) ? normalizedUf : 'PR');
    setCity((initialCity || '').trim());
    setStreet((initialStreet || '').trim());
    setResults([]);
    setErrorMsg(null);
    setHasSearched(false);
  }, [isOpen, initialUf, initialCity, initialStreet]);

  const handleSearch = async () => {
    setErrorMsg(null);
    if (city.trim().length < 3) {
      setErrorMsg('Informe o nome da Cidade / Município (mínimo 3 caracteres).');
      return;
    }
    if (street.trim().length < 3) {
      setErrorMsg('Informe parte do Nome da Rua / Logradouro (mínimo 3 caracteres).');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await searchCepByAddress(uf, city, street);
      if (res.success) {
        setResults(res.items);
        if (res.items.length === 0) {
          setErrorMsg(res.message || 'Nenhum CEP encontrado para este endereço.');
        }
      } else {
        setResults([]);
        setErrorMsg(res.message || 'Não foi possível pesquisar o CEP.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      void handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-3 sm:p-4 bg-zinc-950/65 backdrop-blur-xs`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho Oficial */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-b border-black flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-white border border-black flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-slate-900" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900">
                BUSCAR CEP POR ENDEREÇO
              </h4>
              <p className="text-[11px] text-slate-800 font-medium">
                Descubra o CEP oficial informando UF, Cidade e nome da Rua
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

        {/* Corpo */}
        <div className="p-3.5 sm:p-4 space-y-3 bg-[#cad4e6] overflow-y-auto flex-1 text-slate-900">
          {/* Card de Filtros */}
          <div className="bg-[#e0e6f1] p-3.5 rounded-xl border border-black shadow-2xs space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  UF (ESTADO)
                </label>
                <select
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  className="w-full h-[36px] px-2.5 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-600 cursor-pointer"
                >
                  {BRAZILIAN_STATES.map((stateCode) => (
                    <option key={stateCode} value={stateCode}>
                      {stateCode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  CIDADE / MUNICÍPIO <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex: Dois Vizinhos"
                  className="w-full h-[36px] px-3 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  NOME DA RUA / LOGRADOURO <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex: Paraná ou Avenida (mín. 3 letras)"
                  className="w-full h-[36px] px-3 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-slate-800 flex items-start sm:items-center gap-1.5 font-medium">
                <Info className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  Para cidades pequenas com CEP único, digite <strong>&apos;Centro&apos;</strong> ou o nome da avenida principal no campo Rua.
                </span>
              </p>

              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={isSearching}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider border border-emerald-800 shadow-xs transition cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
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
            <div className="bg-amber-50 border border-amber-500 text-amber-950 rounded-xl px-3.5 py-2 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Lista de Resultados */}
          <div className="bg-[#e0e6f1] p-2.5 rounded-xl border border-black shadow-2xs">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
                RESULTADOS ENCONTRADOS ({results.length})
              </span>
              {results.length > 0 && (
                <span className="text-[10.5px] font-semibold text-emerald-800">
                  Clique em um endereço para preencher automaticamente
                </span>
              )}
            </div>

            <div className="bg-white border border-gray-400 rounded-lg max-h-60 overflow-y-auto divide-y divide-slate-200">
              {isSearching ? (
                <div className="py-8 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Consultando base de CEPs...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="py-7 px-4 text-center text-xs text-slate-600 font-medium">
                  {hasSearched
                    ? 'Nenhum endereço correspondente encontrado. Ajuste o nome da cidade ou da rua e tente novamente.'
                    : 'Preencha Cidade e Rua acima e clique em "Pesquisar CEP".'}
                </div>
              ) : (
                results.map((item, idx) => (
                  <button
                    key={`${item.cep}-${idx}`}
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
                        {item.bairro ? `Bairro: ${item.bairro} • ` : ''}
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
        </div>

        {/* Rodapé Oficial */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-t border-black flex items-center justify-end shrink-0">
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
