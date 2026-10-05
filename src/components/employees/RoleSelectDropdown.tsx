import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  ChevronRight, 
  Check, 
  Briefcase,
  SlidersHorizontal,
  Building2 
} from 'lucide-react';

export interface RoleOptionItem {
  id?: string;
  name: string;
  setor?: string;
  descricao?: string;
  permissoes?: {
    financeiro?: boolean;
    frotas?: boolean;
    rh?: boolean;
    estoque?: boolean;
    empresa?: boolean;
  };
}

interface RoleSelectDropdownProps {
  id?: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: (string | RoleOptionItem)[];
  onOpenManager?: () => void;
  placeholder?: string;
  isOptional?: boolean;
  disabledOption?: string;
  className?: string;
  onOpenSidePanel?: () => void;
  isSidePanelOpen?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export const RoleSelectDropdown: React.FC<RoleSelectDropdownProps> = ({
  id,
  label,
  required = false,
  value,
  onChange,
  options = [],
  onOpenManager,
  placeholder = 'Clique ou digite para buscar cargo...',
  isOptional = false,
  disabledOption,
  className = '',
  onOpenSidePanel,
  isSidePanelOpen = false,
  searchQuery,
  onSearchQueryChange,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalização e ORDEM ALFABÉTICA COMPULSÓRIA (A-Z)
  const normalizedOptions: RoleOptionItem[] = useMemo(() => {
    const seen = new Set<string>();
    const list: RoleOptionItem[] = [];
    for (const opt of options) {
      const item: RoleOptionItem = typeof opt === 'string' ? { name: opt } : opt;
      const normKey = (item.name || '').trim().toLowerCase();
      if (normKey && !seen.has(normKey)) {
        seen.add(normKey);
        list.push(item);
      }
    }
    // Ordem alfabética obrigatória (Padrão do Sistema)
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find(opt => opt.name.toLowerCase() === (value || '').trim().toLowerCase());
  }, [normalizedOptions, value]);

  // Se o usuário está digitando ativamente no input
  const displayInputValue = isFocused && searchQuery !== undefined ? searchQuery : (value || '');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    if (onSearchQueryChange) {
      onSearchQueryChange(text);
    }
    if (!isSidePanelOpen && onOpenSidePanel) {
      onOpenSidePanel();
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    if (onOpenSidePanel) {
      onOpenSidePanel();
    }
    if (onSearchQueryChange && !searchQuery) {
      onSearchQueryChange(value || '');
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (onSearchQueryChange) {
      onSearchQueryChange('');
    }
    inputRef.current?.focus();
  };

  const handleToggleSidePanel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenSidePanel) {
      onOpenSidePanel();
    }
    inputRef.current?.focus();
  };

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef} id={id}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-black">
            {label} {required && <span className="text-rose-600 ml-0.5">*</span>}
          </label>
          {isSidePanelOpen && (
            <span className="text-[10px] font-bold text-[#0963cb] bg-sky-100/70 px-1.5 py-0.5 rounded">
              Painel Lateral Ativo
            </span>
          )}
        </div>
      )}

      {/* Input Interativo com Busca por Digitação (Searchable Combobox) */}
      <div 
        className={`relative flex items-center bg-white border rounded-lg transition-all duration-150 ${
          isSidePanelOpen
            ? 'border-[#0963cb] ring-2 ring-[#0963cb]/25 bg-sky-50/20 shadow-sm'
            : 'border-stone-300 hover:border-stone-400 focus-within:border-[#0963cb] focus-within:ring-1 focus-within:ring-[#0963cb]'
        }`}
      >
        {/* Ícone de Busca / Briefcase */}
        <div className="pl-2.5 pr-1.5 flex items-center justify-center shrink-0 text-stone-400">
          <Search className="w-4 h-4 text-stone-400" />
        </div>

        {/* Campo de Input Real para Digitação Direta */}
        <input
          ref={inputRef}
          type="text"
          value={displayInputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="w-full py-2 text-xs sm:text-sm font-semibold text-stone-900 bg-transparent focus:outline-none placeholder:text-stone-400 placeholder:font-normal"
        />

        {/* Badge do Setor do Cargo Selecionado */}
        {selectedOption?.setor && !isFocused && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black text-stone-600 uppercase tracking-wider bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded mr-1.5 shrink-0">
            <Building2 className="w-2.5 h-2.5 opacity-60" />
            <span className="max-w-[120px] truncate">{selectedOption.setor}</span>
          </span>
        )}

        {/* Ações: Limpar (X) & Botão Abrir Painel Lateral */}
        <div className="flex items-center space-x-1 pr-1.5 shrink-0">
          {(value || (isFocused && searchQuery)) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded-full transition cursor-pointer"
              title="Limpar seleção"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleSidePanel}
            className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
              isSidePanelOpen
                ? 'bg-[#0963cb] text-white shadow-2xs'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
            title="Abrir painel lateral de seleção de cargos em ordem alfabética"
          >
            <span>Cargos A-Z</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSidePanelOpen ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
