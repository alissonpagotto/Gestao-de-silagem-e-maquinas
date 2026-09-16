import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, Search, Tag, ArrowUp, ArrowDown, ArrowDownAZ, RotateCcw } from 'lucide-react';

interface CategoryOptionsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: string[];
  onSaveItems: (items: string[]) => void;
  defaultItems?: string[];
  placeholder?: string;
  onSelectItem?: (item: string) => void;
}

export const CategoryOptionsManagerModal: React.FC<CategoryOptionsManagerModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'Adicione, edite ou exclua opções desta categoria',
  items,
  onSaveItems,
  defaultItems,
  placeholder = 'Nome da nova opção / categoria...',
  onSelectItem,
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    // Check if duplicate
    if (items.some((it) => it.toLowerCase() === trimmed.toLowerCase())) {
      alert('Esta opção já existe na lista.');
      return;
    }

    const updated = [...items, trimmed];
    onSaveItems(updated);
    if (onSelectItem) {
      onSelectItem(trimmed);
    }
    setNewItemName('');
  };

  const handleStartEdit = (index: number, currentVal: string) => {
    setEditingIndex(index);
    setEditingValue(currentVal);
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingValue.trim();
    if (!trimmed) return;

    const updated = [...items];
    updated[index] = trimmed;
    onSaveItems(updated);
    if (onSelectItem) {
      onSelectItem(trimmed);
    }
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleDeleteItem = (index: number, itemName: string) => {
    if (items.length <= 1) {
      return;
    }
    const updated = items.filter((_, idx) => idx !== index);
    onSaveItems(updated);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleSortAZ = () => {
    const sorted = [...items].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    onSaveItems(sorted);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...items];
    const item = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = item;
    onSaveItems(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const updated = [...items];
    const item = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = item;
    onSaveItems(updated);
  };

  const filteredItems = items.filter((it) =>
    it.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        
        {/* Header - Standardized Solid Teal Bar */}
        <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-white/80">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Add Form */}
          <form onSubmit={handleAddItem} className="space-y-2 bg-stone-50 dark:bg-stone-800/40 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700/60">
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
              INCLUIR NOVA OPÇÃO / CATEGORIA
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#009688] font-medium outline-none"
              />
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#156f33] hover:bg-[#0e5224] disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar</span>
              </button>
            </div>
          </form>

          {/* Search if > 5 */}
          {items.length > 5 && (
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar nas opções..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#009688]"
              />
            </div>
          )}

          {/* List of items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider block">
                  OPÇÕES CADASTRADAS ({items.length})
                </label>
                <span className="text-[10px] text-stone-400">Clique nas setas para reordenar ou no botão A-Z</span>
              </div>

              <div className="flex items-center gap-1.5">
                {defaultItems && defaultItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Deseja restaurar as opções para a lista padrão original?')) {
                        const sorted = [...defaultItems].sort((a, b) => a.localeCompare(b, 'pt-BR'));
                        onSaveItems(sorted);
                      }
                    }}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-bold text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 rounded-lg transition cursor-pointer shadow-2xs"
                    title="Restaurar lista de opções padrão"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Padrões</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSortAZ}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-bold text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-[#009688] hover:text-white dark:hover:bg-[#009688] border border-stone-200 dark:border-stone-700 rounded-lg transition cursor-pointer shadow-2xs"
                  title="Ordenar alfabeticamente de A a Z"
                >
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                  <span>Ordenar A-Z</span>
                </button>
              </div>
            </div>

            <div className="border border-stone-200 dark:border-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-800 bg-white dark:bg-stone-900 overflow-hidden shadow-2xs">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-500">
                  Nenhuma opção encontrada.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const originalIndex = items.indexOf(item);
                  const isEditing = editingIndex === originalIndex;

                  return (
                    <div
                      key={originalIndex}
                      className="p-2.5 sm:p-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/40 transition gap-2"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-[#009688] bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#009688]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(originalIndex);
                              if (e.key === 'Escape') setEditingIndex(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(originalIndex)}
                            className="p-1.5 rounded-lg bg-[#156f33] hover:bg-[#0e5224] text-white transition cursor-pointer"
                            title="Salvar alteração"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="p-1.5 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition cursor-pointer"
                            title="Cancelar edição"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                            <Tag className="w-3.5 h-3.5 text-[#009688] shrink-0" />
                            <span className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-200 truncate">
                              {item}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            {/* Move Up / Down Buttons */}
                            <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5 border border-stone-200 dark:border-stone-700 mr-1">
                              <button
                                type="button"
                                disabled={originalIndex === 0}
                                onClick={() => handleMoveUp(originalIndex)}
                                className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-20 disabled:pointer-events-none hover:bg-white dark:hover:bg-stone-700 rounded transition cursor-pointer"
                                title="Mover para cima"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={originalIndex === items.length - 1}
                                onClick={() => handleMoveDown(originalIndex)}
                                className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-20 disabled:pointer-events-none hover:bg-white dark:hover:bg-stone-700 rounded transition cursor-pointer"
                                title="Mover para baixo"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>

                            {onSelectItem && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectItem(item);
                                  onClose();
                                }}
                                className="px-2 py-1 text-[11px] font-bold text-[#009688] hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg transition cursor-pointer mr-1"
                                title="Selecionar esta opção"
                              >
                                Selecionar
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartEdit(originalIndex, item)}
                              className="p-1.5 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                              title="Editar nome da opção"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(originalIndex, item)}
                              className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                              title="Excluir opção"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Footer - Standardized */}
        <div className="px-5 py-3 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            Concluir
          </button>
        </div>

      </div>
    </div>
  );
};
