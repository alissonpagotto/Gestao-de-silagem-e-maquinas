import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, SlidersHorizontal } from 'lucide-react';

interface RoleSelectDropdownProps {
  id?: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onOpenManager: () => void;
  placeholder?: string;
  isOptional?: boolean;
  disabledOption?: string;
  className?: string;
}

export const RoleSelectDropdown: React.FC<RoleSelectDropdownProps> = ({
  id,
  label,
  required = false,
  value,
  onChange,
  options = [],
  onOpenManager,
  placeholder = 'Selecione a função...',
  isOptional = false,
  disabledOption,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora do componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fecha com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} id={id}>
      {label && (
        <label className="block text-xs font-bold text-black mb-1">
          {label} {required && <span className="text-rose-600 ml-0.5">*</span>}
        </label>
      )}

      {/* Botão Gatilho do Dropdown */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[38px] flex items-center justify-between px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] transition cursor-pointer text-left shadow-2xs"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate pr-2">
          {value ? (
            <span className="font-semibold text-stone-900">{value}</span>
          ) : (
            <span className="text-stone-400 font-normal">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          {isOptional && value && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded-full transition cursor-pointer"
              title="Remover função secundária"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-stone-500 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Menu Suspenso */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[220px]">
          
          {/* Lista de Opções */}
          <div className="max-h-56 overflow-y-auto divide-y divide-stone-100 no-scrollbar">
            {/* Opção de limpar / Nenhuma para o campo opcional */}
            {isOptional && (
              <div
                onClick={() => handleSelect('')}
                className={`px-3 py-2 text-xs sm:text-sm cursor-pointer transition flex items-center justify-between ${
                  !value
                    ? 'bg-sky-50/80 text-[#0963cb] font-bold'
                    : 'text-stone-500 hover:bg-stone-50 italic'
                }`}
              >
                <span>— Nenhuma (sem acúmulo de função) —</span>
                {!value && <Check className="w-4 h-4 text-[#0963cb] shrink-0 mr-1" />}
              </div>
            )}

            {options.map((opt) => {
              const isSelected = value.toLowerCase() === opt.toLowerCase();
              const isAlreadyChosen = disabledOption && disabledOption.toLowerCase() === opt.toLowerCase();

              return (
                <div
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={`group flex items-center justify-between px-3 py-2 text-xs sm:text-sm cursor-pointer transition ${
                    isSelected
                      ? 'bg-sky-50 text-[#0963cb] font-bold'
                      : 'text-stone-800 hover:bg-stone-50 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 truncate pr-2">
                    <span className="truncate">{opt}</span>
                    {isAlreadyChosen && (
                      <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                        Principal
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-[#0963cb] shrink-0 mr-1 stroke-[2.5]" />
                  )}
                </div>
              );
            })}

            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-stone-400 italic text-center">
                Nenhuma função disponível.
              </div>
            )}
          </div>

          {/* Rodapé: Opção para abrir o Gerenciador da Lista */}
          <div className="p-2 border-t border-stone-200 bg-stone-50">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onOpenManager();
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#0963cb] hover:text-[#0852a8] hover:bg-sky-100/70 bg-white border border-dashed border-[#0963cb]/40 transition cursor-pointer shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>+ Incluir ou Excluir Funções...</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
