import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  Check,
  Edit2,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

export interface ClassificationListManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: string[];
  defaultItems?: string[];
  placeholder?: string;
  selectedValue?: string;
  onSaveItems: (updatedItems: string[]) => void;
  onSelectItem?: (item: string) => void;
  onRenameItem?: (oldValue: string, newValue: string) => void;
  onDeleteItem?: (deletedValue: string) => void;
  zIndexClass?: string;
}

export const ClassificationListManagerModal: React.FC<
  ClassificationListManagerModalProps
> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'Adicione, edite ou exclua opções desta lista',
  items,
  defaultItems,
  placeholder = 'Digite o nome da nova opção...',
  selectedValue = '',
  onSaveItems,
  onSelectItem,
  onRenameItem,
  onDeleteItem,
  zIndexClass = 'z-[9999]',
}) => {
  const [newItemName, setNewItemName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewItemName('');
      setEditingIndex(null);
      setEditingValue('');
      setSearchTerm('');
      setFeedbackError('');
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    if (items.some((it) => it.toLowerCase() === trimmed.toLowerCase())) {
      setFeedbackError(`"${trimmed}" já existe nesta lista.`);
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

    const oldVal = items[index];
    const hasDuplicate = items.some(
      (it, idx) => idx !== index && it.toLowerCase() === trimmed.toLowerCase()
    );
    if (hasDuplicate) {
      setFeedbackError(`"${trimmed}" já existe nesta lista.`);
      return;
    }

    setFeedbackError('');
    const updated = [...items];
    updated[index] = trimmed;
    onSaveItems(updated);
    if (onRenameItem && oldVal) {
      onRenameItem(oldVal, trimmed);
    }
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleDelete = (index: number) => {
    setFeedbackError('');
    const target = items[index];
    const updated = items.filter((_, idx) => idx !== index);
    onSaveItems(updated);
    if (onDeleteItem && target) {
      onDeleteItem(target);
    }
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const handleSortAZ = () => {
    setFeedbackError('');
    const sorted = [...items].sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    );
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

  const handleRestoreDefaults = () => {
    if (!defaultItems || defaultItems.length === 0) return;
    setFeedbackError('');
    onSaveItems([...defaultItems]);
  };

  const filteredItems = items.filter((it) =>
    it.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 text-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial AgroControl (#cad4e6 + border-black) */}
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

        {/* Corpo com Cards Internos #e0e6f1 + border-black */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 bg-[#cad4e6]">
          {/* Card 1: Incluir Nova Opção */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-900">
              INCLUIR NOVA OPÇÃO / CATEGORIA
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={newItemName}
                onChange={(e) => {
                  setNewItemName(e.target.value);
                  if (feedbackError) setFeedbackError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddItem();
                  } else if (e.key === 'Escape') {
                    onClose();
                  }
                }}
                placeholder={placeholder}
                className="flex-1 min-w-0 h-8 px-3 text-xs sm:text-sm font-medium rounded-lg border border-gray-400 bg-white text-black placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!newItemName.trim()}
                className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase border border-emerald-700 inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
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
          </div>

          {/* Card 2: Lista de Opções Cadastradas */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 block">
                  OPÇÕES CADASTRADAS ({items.length})
                </span>
                <span className="text-[10px] font-medium text-slate-700">
                  Clique nas setas para reordenar ou no botão A-Z
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {defaultItems && defaultItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-gray-100 text-black border border-gray-400 rounded-lg transition cursor-pointer shadow-2xs"
                    title="Restaurar opções padrão"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar Padrões</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSortAZ}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-gray-100 text-black border border-gray-400 rounded-lg transition cursor-pointer shadow-2xs"
                  title="Ordenar alfabeticamente de A a Z"
                >
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                  <span>Ordenar A-Z</span>
                </button>
              </div>
            </div>

            {items.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar nas opções..."
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-gray-400 bg-white text-black font-medium placeholder:text-gray-500 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-xs font-semibold text-slate-700 bg-white border border-gray-400 rounded-lg">
                  Nenhuma opção cadastrada.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const originalIndex = items.indexOf(item);
                  const isEditing = editingIndex === originalIndex;
                  const isCurrent =
                    Boolean(selectedValue) &&
                    item.toLowerCase() === selectedValue.trim().toLowerCase();

                  return (
                    <div
                      key={`${originalIndex}_${item}`}
                      className="px-3 py-2 flex items-center justify-between gap-2 bg-white text-black border border-gray-400 rounded-lg hover:bg-slate-50 transition shadow-2xs"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSaveEdit(originalIndex);
                              } else if (e.key === 'Escape') {
                                setEditingIndex(null);
                                setEditingValue('');
                              }
                            }}
                            className="flex-1 min-w-0 h-7 px-2.5 text-xs sm:text-sm font-semibold rounded-lg border border-gray-400 bg-white text-black focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                            onClick={() => {
                              setEditingIndex(null);
                              setEditingValue('');
                            }}
                            className="p-1.5 rounded-lg bg-white hover:bg-gray-100 text-black border border-gray-400 transition cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Tag className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span className="text-xs sm:text-sm font-semibold text-black truncate">
                              {item}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 border border-emerald-300 rounded shrink-0">
                                Atual
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
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
                                className="px-2 py-1 text-[10px] font-bold uppercase text-emerald-700 hover:bg-emerald-50 border border-emerald-400 rounded-lg transition cursor-pointer"
                                title="Selecionar esta opção"
                              >
                                Selecionar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(originalIndex, item)}
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Editar opção"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(originalIndex)}
                              className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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

        {/* Rodapé Oficial AgroControl (#cad4e6 + border-black) */}
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

