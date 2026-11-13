import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, Search, Tag, ArrowUp, ArrowDown, ArrowDownAZ, RotateCcw, Settings } from 'lucide-react';

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
  zIndexClass?: string;
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
  zIndexClass = 'z-50',
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    // Check if duplicate
    if (items.some((it) => it.toLowerCase() === trimmed.toLowerCase())) {
      setFeedbackError('Esta opção já existe na lista.');
      return;
    }

    setFeedbackError('');
    const updated = [...items, trimmed];
    onSaveItems(updated);
    if (onSelectItem) {
      onSelectItem(trimmed);
    }
    setNewItemName('');
  };

  const handleStartEdit = (index: number, currentVal: string) => {
    setFeedbackError('');
    setEditingIndex(index);
    setEditingValue(currentVal);
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingValue.trim();
    if (!trimmed) return;

    const hasDuplicate = items.some(
      (it, idx) => idx !== index && it.toLowerCase() === trimmed.toLowerCase()
    );
    if (hasDuplicate) {
      setFeedbackError('Esta opção já existe na lista.');
      return;
    }

    setFeedbackError('');
    const updated = [...items];
    updated[index] = trimmed;
    onSaveItems(updated);
    if (onSelectItem) {
      onSelectItem(trimmed);
    }
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) {
      return;
    }
    setFeedbackError('');
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
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs`}
      onClick={onClose}
    >
      <div
        className="bg-[#cad4e6] rounded-xl max-w-lg w-full shadow-2xl border border-black overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Tema Oficial AgroControl (#cad4e6 + border-black) */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-b border-black flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white border border-black flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-slate-800" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900 truncate">
                {title}
              </h3>
              <p className="text-[11px] font-semibold text-slate-700 truncate">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-400 text-black transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content (#cad4e6 base com cards #e0e6f1 + border-black) */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 bg-[#cad4e6]">
          {/* Card 1: Incluir Nova Opção / Categoria */}
          <form
            onSubmit={handleAddItem}
            className="space-y-2 bg-[#e0e6f1] p-3 rounded-xl border border-black"
          >
            <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider">
              INCLUIR NOVA OPÇÃO / CATEGORIA
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => {
                  setNewItemName(e.target.value);
                  if (feedbackError) setFeedbackError('');
                }}
                placeholder={placeholder}
                className="flex-1 min-w-0 h-8 px-3 text-xs sm:text-sm rounded-lg border border-gray-400 bg-white text-black font-medium placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newItemName.trim()}
                className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase rounded-lg border border-emerald-700 shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>
            {feedbackError && (
              <p className="text-[11px] font-bold text-rose-700">
                {feedbackError}
              </p>
            )}
          </form>

          {/* Card 2: Opções Cadastradas */}
          <div className="space-y-2.5 bg-[#e0e6f1] p-3 rounded-xl border border-black">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                  OPÇÕES CADASTRADAS ({items.length})
                </label>
                <span className="text-[10px] font-medium text-slate-700">
                  Clique nas setas para reordenar ou no botão A-Z
                </span>
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
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-black bg-white hover:bg-gray-100 border border-gray-400 rounded-lg transition cursor-pointer shadow-2xs"
                    title="Restaurar lista de opções padrão"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar Padrões</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSortAZ}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-black bg-white hover:bg-gray-100 border border-gray-400 rounded-lg transition cursor-pointer shadow-2xs"
                  title="Ordenar alfabeticamente de A a Z"
                >
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                  <span>Ordenar A-Z</span>
                </button>
              </div>
            </div>

            {/* Search if > 5 */}
            {items.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar nas opções..."
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-gray-400 bg-white text-black font-medium placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            )}

            {/* Lista de Opções (linhas/cartões individuais em branco puro com borda cinza escura) */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-xs font-semibold text-slate-700 bg-white border border-gray-400 rounded-lg">
                  Nenhuma opção encontrada.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const originalIndex = items.indexOf(item);
                  const isEditing = editingIndex === originalIndex;

                  return (
                    <div
                      key={`${originalIndex}_${item}`}
                      className="px-3 py-2 flex items-center justify-between bg-white text-black border border-gray-400 rounded-lg hover:bg-slate-50 transition gap-2 shadow-2xs"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="flex-1 min-w-0 h-7 px-2.5 text-xs sm:text-sm font-semibold rounded-lg border border-gray-400 bg-white text-black focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(originalIndex);
                              if (e.key === 'Escape') setEditingIndex(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(originalIndex)}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
                            title="Salvar alteração"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="p-1.5 rounded-lg bg-white hover:bg-gray-100 text-black border border-gray-400 transition cursor-pointer"
                            title="Cancelar edição"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                            <Tag className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span className="text-xs sm:text-sm font-semibold text-black truncate">
                              {item}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            {/* Move Up / Down Buttons */}
                            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-400 mr-1">
                              <button
                                type="button"
                                disabled={originalIndex === 0}
                                onClick={() => handleMoveUp(originalIndex)}
                                className="p-1 text-slate-700 hover:text-black disabled:opacity-25 disabled:pointer-events-none hover:bg-white rounded transition cursor-pointer"
                                title="Mover para cima"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={originalIndex === items.length - 1}
                                onClick={() => handleMoveDown(originalIndex)}
                                className="p-1 text-slate-700 hover:text-black disabled:opacity-25 disabled:pointer-events-none hover:bg-white rounded transition cursor-pointer"
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
                                className="px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-400 rounded-lg transition cursor-pointer mr-1"
                                title="Selecionar esta opção"
                              >
                                Selecionar
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartEdit(originalIndex, item)}
                              className="p-1.5 text-slate-600 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                              title="Editar nome da opção"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(originalIndex)}
                              className="p-1.5 text-slate-600 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition cursor-pointer"
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

        {/* Footer - Tema Oficial AgroControl (#cad4e6 + border-black) */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-t border-black flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold uppercase border border-emerald-700 shadow-xs transition cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};

