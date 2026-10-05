import React, { useState, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  ChevronDown 
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
  placeholder = 'Clique ou digite para buscar cargo...',
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
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [options]);

  // Exibe estritamente o texto digitado na busca ou o nome limpo do cargo por extenso
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
        <label className="block text-xs font-bold text-black">
          {label} {required && <span className="text-rose-600 ml-0.5">*</span>}
        </label>
      )}

      {/* Input Limpo e Reativo com Busca por Digitação */}
      <div 
        className={`relative flex items-center bg-white border rounded-lg transition-all duration-150 ${
          isSidePanelOpen
            ? 'border-[#0963cb] ring-2 ring-[#0963cb]/25 bg-sky-50/20 shadow-xs'
            : 'border-stone-300 hover:border-stone-400 focus-within:border-[#0963cb] focus-within:ring-1 focus-within:ring-[#0963cb]'
        }`}
      >
        {/* Ícone sutil de Busca */}
        <div className="pl-2.5 pr-1.5 flex items-center justify-center shrink-0 text-stone-400">
          <Search className="w-4 h-4 text-stone-400" />
        </div>

        {/* Campo de Input: Exibe EXCLUSIVAMENTE o nome limpo do cargo por extenso */}
        <input
          ref={inputRef}
          type="text"
          value={displayInputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="w-full py-1.5 text-xs sm:text-sm font-semibold text-stone-900 bg-transparent focus:outline-none placeholder:text-stone-400 placeholder:font-normal"
        />

        {/* Ações discretas na extremidade direita: Limpar (X) & Seta de abertura */}
        <div className="flex items-center space-x-0.5 pr-2 shrink-0">
          {(value || (isFocused && searchQuery)) && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded-full transition cursor-pointer"
              title="Limpar cargo selecionado"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleSidePanel}
            className={`p-1 rounded-md text-stone-400 hover:text-[#0963cb] hover:bg-stone-100 transition cursor-pointer ${
              isSidePanelOpen ? 'text-[#0963cb] bg-sky-50' : ''
            }`}
            title="Abrir painel lateral de seleção de cargos"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSidePanelOpen ? 'rotate-180 text-[#0963cb]' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};
