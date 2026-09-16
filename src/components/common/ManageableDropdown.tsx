import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Plus } from 'lucide-react';

interface ManageableDropdownProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onOptionsChange: (newOptions: string[]) => void;
  placeholder?: string;
  newItemPlaceholder?: string;
  className?: string;
  showCheckmark?: boolean;
}

export const ManageableDropdown: React.FC<ManageableDropdownProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  onOptionsChange,
  placeholder = 'Selecione...',
  newItemPlaceholder = 'Novo item...',
  className = '',
  showCheckmark = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
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

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
  };

  const handleAddNew = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed) return;

    if (!options.includes(trimmed)) {
      const updated = [...options, trimmed];
      onOptionsChange(updated);
    }
    onChange(trimmed);
    setNewItemText('');
    setIsOpen(false);
  };

  const handleDeleteOption = (e: React.MouseEvent, optToDelete: string) => {
    e.stopPropagation();
    const updated = options.filter(opt => opt !== optToDelete);
    onOptionsChange(updated);
    if (value === optToDelete) {
      onChange(updated.length > 0 ? updated[0] : '');
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef} id={id}>
      {label && (
        <label className="block text-xs font-bold text-black mb-1">
          {label}
        </label>
      )}

      {/* Button Header Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#0963cb] transition cursor-pointer text-left"
      >
        <span className="truncate min-h-[1.25rem] inline-block">{value === 'mecanico_especialista' ? 'Mecanico Especialista' : (value || placeholder || '\u00A0')}</span>
        <ChevronDown className={`w-4 h-4 text-stone-500 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu matching the user screenshot */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[200px] bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="max-h-48 overflow-y-auto divide-y divide-stone-100 no-scrollbar">
            {options.map((opt) => {
              const isSelected = 
                opt === value || 
                (opt === 'Mecanico Especialista' && value === 'mecanico_especialista') ||
                (opt.toLowerCase() === value.toLowerCase());
              return (
                <div
                  key={opt}
                  onClick={() => handleSelect(opt)}
                  className={`group flex items-center justify-between px-3 py-2 text-xs sm:text-sm cursor-pointer transition ${
                    isSelected
                      ? 'bg-sky-50 text-[#0963cb] font-semibold'
                      : 'text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  <span className="truncate pr-2">{opt}</span>
                  
                  <div className="flex items-center space-x-1 shrink-0">
                    {isSelected && showCheckmark && (
                      <Check className="w-4 h-4 text-[#0963cb] mr-1" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteOption(e, opt)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-rose-500 rounded transition cursor-pointer"
                      title="Excluir opção"
                    >
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    </button>
                  </div>
                </div>
              );
            })}

            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-stone-400 italic text-center">
                Nenhuma opção cadastrada
              </div>
            )}
          </div>

          {/* Bottom Add New Option Section */}
          <div className="p-2 border-t border-stone-200 bg-stone-50 flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNew();
                }
              }}
              placeholder={newItemPlaceholder}
              className="flex-1 px-2.5 py-1 text-xs bg-white border border-stone-300 rounded-lg text-black outline-none focus:ring-1 focus:ring-[#0963cb]"
            />
            <button
              type="button"
              onClick={() => handleAddNew()}
              disabled={!newItemText.trim()}
              className="shrink-0 inline-flex items-center space-x-0.5 px-2 py-1 text-xs font-semibold text-[#0963cb] hover:text-[#0852a8] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
