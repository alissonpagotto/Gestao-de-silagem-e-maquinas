import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Building2, Check, ChevronDown, Search, X } from 'lucide-react';
import { BRAZILIAN_BANKS, BrazilianBank, bankMatchesQuery, findBankByQuery } from './brazilianBanks';
import { BankLogoIcon } from './BankLogoIcon';

interface BankComboboxProps {
  value: string;
  bankCode?: string;
  onChange: (bankName: string, bankCode?: string, suggestedColor?: string) => void;
  disabled?: boolean;
}

export const BankCombobox: React.FC<BankComboboxProps> = ({
  value,
  bankCode,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sincroniza quando o valor muda externamente
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Identifica o banco selecionado
  const selectedBank = useMemo(() => {
    if (bankCode) {
      const found = BRAZILIAN_BANKS.find((b) => b.code === bankCode);
      if (found) return found;
    }
    return findBankByQuery(searchTerm || value, bankCode);
  }, [bankCode, value, searchTerm]);

  // Clique fora para fechar e confirmar valor digitado
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (searchTerm.trim() && searchTerm !== value) {
          const matched = findBankByQuery(searchTerm);
          if (matched) {
            onChange(matched.displayName, matched.code, matched.color);
            setSearchTerm(matched.displayName);
          } else {
            onChange(searchTerm.trim(), undefined);
          }
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchTerm, value, onChange]);

  // Lista filtrada de bancos por código, nome, displayName ou apelidos
  const filteredBanks = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return BRAZILIAN_BANKS;

    return BRAZILIAN_BANKS.filter((b) => bankMatchesQuery(b, term));
  }, [searchTerm]);

  const handleSelectBank = (bank: BrazilianBank) => {
    onChange(bank.displayName, bank.code, bank.color);
    setSearchTerm(bank.displayName);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredBanks.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev <= 0 ? Math.max(0, filteredBanks.length - 1) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredBanks[highlightedIndex]) {
        handleSelectBank(filteredBanks[highlightedIndex]);
      } else if (searchTerm.trim()) {
        const matched = findBankByQuery(searchTerm);
        if (matched) {
          handleSelectBank(matched);
        } else {
          onChange(searchTerm.trim(), undefined);
          setIsOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Rolagem automática da lista ao navegar por setas
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        
        {/* Mini-ícone dentro do input: Logo oficial do banco ou Building2 clássico */}
        <div 
          id="mini-icone-banco-input"
          className="absolute left-2.5 flex items-center justify-center pointer-events-none z-10 w-5 h-5"
        >
          <BankLogoIcon
            code={selectedBank?.code || bankCode}
            name={searchTerm || value}
            size={20}
            className="text-stone-400"
          />
        </div>

        {/* Input de busca e digitação com autocomplete */}
        <input
          ref={inputRef}
          id="input-busca-instituicao"
          type="text"
          disabled={disabled}
          value={searchTerm}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onChange={(e) => {
            const newVal = e.target.value;
            setSearchTerm(newVal);
            setIsOpen(true);
            setHighlightedIndex(0);
            
            // Verifica se casou perfeitamente em tempo real
            const matched = findBankByQuery(newVal);
            if (matched) {
              onChange(newVal, matched.code, matched.color);
            } else {
              onChange(newVal, undefined);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por código (ex: 001, 133, 756) ou nome..."
          className="w-full py-2 pl-9.5 pr-16 text-xs sm:text-sm border border-stone-300 rounded-xl bg-white text-black font-semibold focus:ring-2 focus:ring-[#0963cb] focus:border-[#0963cb] outline-hidden shadow-2xs transition"
        />

        {/* Ações da Direita: Limpar & Dropdown Chevron */}
        <div className="absolute right-2 flex items-center space-x-1">
          {searchTerm && !disabled && (
            <button
              type="button"
              id="btn-limpar-banco"
              onClick={() => {
                setSearchTerm('');
                onChange('', undefined);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 transition cursor-pointer"
              title="Limpar campo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            id="btn-toggle-lista-bancos"
            disabled={disabled}
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 transition cursor-pointer"
            title="Ver lista de bancos"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0963cb]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown com Lista de Bancos */}
      {isOpen && !disabled && (
        <div 
          id="dropdown-lista-bancos"
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-stone-300 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="p-2 border-b border-stone-100 bg-stone-50 flex items-center justify-between text-[11px] font-bold text-stone-600">
            <span className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#0963cb]" />
              <span>Bancos e Cooperativas ({filteredBanks.length})</span>
            </span>
            <span className="text-[10px] text-stone-500 font-normal">
              Ex: 001, 104, Cresol, Sicoob, Sicredi
            </span>
          </div>

          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1 divide-y divide-stone-100 text-xs"
            role="listbox"
          >
            {filteredBanks.length === 0 ? (
              <li className="px-3 py-3 text-center text-stone-500 text-xs">
                <span>Nenhum banco registrado para "{searchTerm}".</span>
                <p className="text-[11px] text-stone-600 font-semibold mt-1">
                  Você pode pressionar Enter ou continuar para salvar este nome personalizado.
                </p>
              </li>
            ) : (
              filteredBanks.map((bank, index) => {
                const isSelected = selectedBank?.code === bank.code;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={bank.code}
                    id={`opcao-banco-${bank.code}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelectBank(bank)}
                    className={`px-3 py-2 flex items-center justify-between cursor-pointer transition ${
                      isHighlighted ? 'bg-[#b0d2ed]/45 text-black font-bold' : 'hover:bg-stone-50 text-stone-800'
                    } ${isSelected ? 'bg-sky-50 font-black' : ''}`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      {/* Logo / Identidade do Banco em Miniatura */}
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        <BankLogoIcon code={bank.code} name={bank.shortName} size={24} />
                      </div>

                      {/* Registro Exato e Nome Formatado */}
                      <div className="truncate">
                        <span className="font-bold text-black text-xs block truncate">
                          {bank.displayName}
                        </span>
                        <span className="text-[10px] text-stone-500 block truncate">
                          {bank.name}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-[#0963cb] shrink-0 ml-2 stroke-[2.5]" />
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Dica no rodapé do dropdown */}
          <div className="px-3 py-1.5 bg-stone-50 border-t border-stone-100 text-[10px] text-stone-500 font-medium flex justify-between items-center">
            <span>Dica: Use ↑ ↓ para navegar e Enter para selecionar</span>
            {searchTerm && !selectedBank && (
              <span className="text-emerald-700 font-bold">
                ✓ Usando nome personalizado
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
