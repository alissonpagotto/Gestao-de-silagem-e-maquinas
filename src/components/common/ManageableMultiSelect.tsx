import React, { useState } from 'react';
import { Check, X, Plus, Tag } from 'lucide-react';

interface ManageableMultiSelectProps {
  id?: string;
  label?: string;
  values: string[];
  onChange: (newValues: string[]) => void;
  options: string[];
  onOptionsChange: (newOptions: string[]) => void;
  defaultOptions?: string[];
  placeholder?: string;
  newItemPlaceholder?: string;
  className?: string;
}

export const ManageableMultiSelect: React.FC<ManageableMultiSelectProps> = ({
  id,
  label,
  values = [],
  onChange,
  options = [],
  onOptionsChange,
  defaultOptions = [],
  newItemPlaceholder = 'Novo cargo...',
  className = '',
}) => {
  const [newItemText, setNewItemText] = useState('');

  // Alterna a seleção de uma opção
  const handleToggleOption = (opt: string) => {
    const isAlreadySelected = values.some(
      v => v.toLowerCase() === opt.toLowerCase()
    );

    let updated: string[];
    if (isAlreadySelected) {
      updated = values.filter(v => v.toLowerCase() !== opt.toLowerCase());
    } else {
      updated = [...values, opt];
    }
    onChange(updated);
  };

  // Cadastra novo item e já o seleciona
  const handleAddNew = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed) return;

    // Adiciona na lista de opções se ainda não existir
    if (!options.some(opt => opt.toLowerCase() === trimmed.toLowerCase())) {
      const updatedOpts = [...options, trimmed].sort((a, b) => a.localeCompare('pt-BR'));
      onOptionsChange(updatedOpts);
    }

    // Seleciona automaticamente o novo cargo adicionado
    if (!values.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...values, trimmed]);
    }

    setNewItemText('');
  };

  // Exclui uma opção customizada da lista
  const handleDeleteOption = (e: React.MouseEvent, optToDelete: string) => {
    e.stopPropagation();
    const updatedOpts = options.filter(opt => opt.toLowerCase() !== optToDelete.toLowerCase());
    onOptionsChange(updatedOpts);
    if (values.some(v => v.toLowerCase() === optToDelete.toLowerCase())) {
      onChange(values.filter(v => v.toLowerCase() !== optToDelete.toLowerCase()));
    }
  };

  // Limpa todas as seleções
  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange([]);
  };

  return (
    <div className={`space-y-1.5 ${className}`} id={id}>
      {/* Cabeçalho com Label e Contador de Seleção */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <Tag className="w-3.5 h-3.5 text-black" />
          <span className="text-xs font-bold text-black">
            {label || 'Cargo / Função'}
          </span>
          {values.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0963cb] text-white shadow-2xs">
              {values.length} selecionado{values.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {values.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] font-medium text-stone-600 hover:text-rose-600 underline transition cursor-pointer"
          >
            Limpar seleção
          </button>
        )}
      </div>

      {/* Container de Chips / Pills */}
      <div className="p-3 bg-white border border-stone-300 rounded-xl space-y-3 shadow-2xs">
        
        {/* Lista de tags clicáveis lado a lado */}
        <div className="flex flex-wrap gap-2 items-center">
          {options.map((opt) => {
            const isSelected = values.some(
              v => v.toLowerCase() === opt.toLowerCase()
            );
            const isDefault = defaultOptions.some(
              d => d.toLowerCase() === opt.toLowerCase()
            );

            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleToggleOption(opt)}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer select-none border shadow-2xs ${
                  isSelected
                    ? 'bg-[#0963cb] hover:bg-[#0852a8] text-white border-[#0963cb]'
                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-300 hover:border-stone-400'
                }`}
                title={`Clique para ${isSelected ? 'desmarcar' : 'selecionar'} ${opt}`}
              >
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />
                )}
                <span>{opt}</span>

                {/* Botão de exclusão para opções customizadas */}
                {!isDefault && defaultOptions.length > 0 && (
                  <span
                    role="button"
                    onClick={(e) => handleDeleteOption(e, opt)}
                    className={`p-0.5 rounded-full transition cursor-pointer shrink-0 ml-0.5 ${
                      isSelected
                        ? 'text-white/70 hover:text-white hover:bg-white/20'
                        : 'text-stone-400 hover:text-rose-600 hover:bg-stone-200'
                    }`}
                    title={`Excluir cargo customizado "${opt}"`}
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}

          {options.length === 0 && (
            <span className="text-xs text-stone-500 italic py-1">
              Nenhum cargo disponível. Adicione um abaixo.
            </span>
          )}
        </div>

        {/* Rodapé: Input para Adicionar Novo Cargo */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-stone-200">
          <span className="text-[11px] font-bold text-stone-700">
            Adicionar novo cargo:
          </span>
          <div className="flex items-center gap-1.5 flex-1 max-w-sm">
            <input
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
              className="flex-1 min-w-[140px] px-2.5 py-1 text-xs bg-stone-50 border border-stone-300 rounded-lg text-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0963cb]"
            />
            <button
              type="button"
              onClick={() => handleAddNew()}
              disabled={!newItemText.trim()}
              className="inline-flex items-center space-x-1 px-3 py-1 text-xs font-bold rounded-lg bg-[#0963cb] hover:bg-[#0852a8] text-white disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

