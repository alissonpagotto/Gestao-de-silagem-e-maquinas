import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { ClientSelectOption } from '../../lib/storage';

export interface ClientOptionsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  inputLabel: string;
  inputPlaceholder: string;
  items: ClientSelectOption[];
  onSave: (
    updatedItems: ClientSelectOption[],
    newlyAdded?: ClientSelectOption | null,
    renamedLabels?: Record<string, string>
  ) => void;
  zIndexClass?: string;
}

export const ClientOptionsManagerModal: React.FC<ClientOptionsManagerModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  inputLabel,
  inputPlaceholder,
  items,
  onSave,
  zIndexClass = 'z-[9999]',
}) => {
  const [draftItems, setDraftItems] = useState<ClientSelectOption[]>([]);
  const [newOptionText, setNewOptionText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastAdded, setLastAdded] = useState<ClientSelectOption | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [renamedLabels, setRenamedLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setDraftItems(items.map((it) => ({ ...it })));
      setNewOptionText('');
      setSearchTerm('');
      setErrorMsg('');
      setLastAdded(null);
      setEditingId(null);
      setEditingText('');
      setRenamedLabels({});
    }
  }, [isOpen, items]);

  const filteredItems = useMemo(() => {
    const q = String(searchTerm ?? '').trim().toLowerCase();
    if (!q) return draftItems;
    return draftItems.filter(
      (it) =>
        String(it.label ?? '').toLowerCase().includes(q) ||
        (it.group && String(it.group ?? '').toLowerCase().includes(q))
    );
  }, [draftItems, searchTerm]);

  const activeCount = useMemo(
    () => draftItems.filter((it) => it.active).length,
    [draftItems]
  );

  if (!isOpen) return null;

  const handleAddOption = () => {
    const trimmed = newOptionText.trim();
    if (!trimmed) return;

    const exists = draftItems.some(
      (it) => String(it.label ?? '').toLowerCase() === String(trimmed ?? '').toLowerCase()
    );
    if (exists) {
      setErrorMsg(`"${trimmed}" já existe nesta lista.`);
      return;
    }

    const generatedId =
      String(trimmed ?? '').toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || `custom_${Date.now()}`;

    const uniqueId = draftItems.some((it) => it.id === generatedId)
      ? `${generatedId}_${Date.now()}`
      : generatedId;

    const created: ClientSelectOption = {
      id: uniqueId,
      label: trimmed,
      active: true,
      group: 'Personalizada',
    };

    setErrorMsg('');
    setDraftItems((prev) => [created, ...prev]);
    setLastAdded(created);
    setNewOptionText('');
  };

  const handleToggleItem = (id: string) => {
    setDraftItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, active: !it.active } : it))
    );
  };

  const handleCheckAll = () => {
    if (searchTerm.trim()) {
      const visibleIds = new Set(filteredItems.map((it) => it.id));
      setDraftItems((prev) =>
        prev.map((it) => (visibleIds.has(it.id) ? { ...it, active: true } : it))
      );
    } else {
      setDraftItems((prev) => prev.map((it) => ({ ...it, active: true })));
    }
  };

  const handleUncheckAll = () => {
    if (searchTerm.trim()) {
      const visibleIds = new Set(filteredItems.map((it) => it.id));
      setDraftItems((prev) =>
        prev.map((it) => (visibleIds.has(it.id) ? { ...it, active: false } : it))
      );
    } else {
      setDraftItems((prev) => prev.map((it) => ({ ...it, active: false })));
    }
  };

  const handleRemoveCustom = (id: string) => {
    setDraftItems((prev) => prev.filter((it) => it.id !== id));
    if (lastAdded?.id === id) {
      setLastAdded(null);
    }
    if (editingId === id) {
      setEditingId(null);
      setEditingText('');
    }
  };

  const handleStartEdit = (item: ClientSelectOption) => {
    setEditingId(item.id);
    setEditingText(item.label);
    setErrorMsg('');
  };

  const handleConfirmEdit = (id: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      setEditingId(null);
      setEditingText('');
      return;
    }
    const duplicate = draftItems.some(
      (it) => it.id !== id && String(it.label ?? '').toLowerCase() === String(trimmed ?? '').toLowerCase()
    );
    if (duplicate) {
      setErrorMsg(`"${trimmed}" já existe nesta lista.`);
      return;
    }
    const target = draftItems.find((it) => it.id === id);
    if (target && target.label !== trimmed) {
      setRenamedLabels((prev) => ({ ...prev, [target.label]: trimmed }));
      setDraftItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, label: trimmed } : it))
      );
      if (lastAdded?.id === id) {
        setLastAdded({ ...lastAdded, label: trimmed });
      }
    }
    setErrorMsg('');
    setEditingId(null);
    setEditingText('');
  };

  const handleSaveAndClose = () => {
    onSave(draftItems, lastAdded, renamedLabels);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}
    >
      <div
        className="w-full max-w-xl bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial (#cad4e6 + border-black) */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-b border-black flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white border border-black flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-slate-900" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900 truncate">
                {title}
              </h3>
              <p className="text-[11px] font-medium text-slate-800 truncate">
                {subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-black text-slate-900 transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com Cards Internos (#e0e6f1 + border-black) */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 bg-[#cad4e6]">
          {/* Card 1: Cadastro Livre de Nova Opção */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-900">
              {inputLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={newOptionText}
                onChange={(e) => {
                  setNewOptionText(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddOption();
                  }
                }}
                placeholder={inputPlaceholder}
                className="flex-1 min-w-0 h-8.5 px-3 text-xs sm:text-sm font-medium rounded-lg border border-gray-400 bg-white text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="button"
                onClick={handleAddOption}
                disabled={!newOptionText.trim()}
                className="h-8.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase border border-emerald-800 inline-flex items-center gap-1 shadow-xs transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>
            {errorMsg && (
              <p className="text-[11px] font-bold text-rose-700">{errorMsg}</p>
            )}
          </div>

          {/* Card 2: Busca, Marcar/Desmarcar Todas e Checkboxes de Visibilidade */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900 block">
                  OPÇÕES VISÍVEIS NO FORMULÁRIO ({activeCount} DE {draftItems.length} ATIVAS)
                </span>
                <span className="text-[10px] font-medium text-slate-700">
                  Marque os itens que devem aparecer no seletor do cadastro
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCheckAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-900 border border-black rounded-lg transition cursor-pointer shadow-2xs"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Marcar Todas</span>
                </button>
                <button
                  type="button"
                  onClick={handleUncheckAll}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-900 border border-black rounded-lg transition cursor-pointer shadow-2xs"
                >
                  <Square className="w-3.5 h-3.5 text-slate-700" />
                  <span>Desmarcar Todas</span>
                </button>
              </div>
            </div>

            {/* Barra de Busca */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar na lista..."
                className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border border-gray-400 bg-white text-black font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-600 hover:text-black cursor-pointer"
                  title="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Lista com Checkboxes */}
            <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-xs font-semibold text-slate-700 bg-white border border-gray-400 rounded-lg">
                  Nenhuma opção encontrada para "{searchTerm}".
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isCustom =
                    item.group === 'Personalizada' || item.group === 'Personalizadas';
                  const isEditingThis = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (!isEditingThis) handleToggleItem(item.id);
                      }}
                      className={`px-3 py-1.5 flex items-center justify-between gap-2 rounded-lg border transition select-none ${
                        isEditingThis ? '' : 'cursor-pointer'
                      } ${
                        item.active
                          ? 'bg-white border-gray-400 text-black hover:bg-slate-50'
                          : 'bg-slate-100/80 border-gray-300 text-slate-500 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={item.active}
                          onChange={() => {}}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleItem(item.id);
                          }}
                          className="w-4 h-4 accent-emerald-600 rounded border-gray-400 cursor-pointer shrink-0"
                        />
                        {isEditingThis ? (
                          <div
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleConfirmEdit(item.id);
                                } else if (e.key === 'Escape') {
                                  e.stopPropagation();
                                  setEditingId(null);
                                  setEditingText('');
                                }
                              }}
                              className="flex-1 min-w-0 h-7 px-2 text-xs sm:text-sm font-semibold rounded border border-black bg-white text-black focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmEdit(item.id)}
                              className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 cursor-pointer shrink-0"
                              title="Confirmar edição"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditingText('');
                              }}
                              className="p-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-gray-400 cursor-pointer shrink-0"
                              title="Cancelar edição"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`text-xs sm:text-sm font-semibold truncate ${
                              item.active ? 'text-black' : 'text-slate-500 line-through'
                            }`}
                          >
                            {item.label}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.group && !isEditingThis && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-[#e0e6f1] text-slate-800 border border-slate-400">
                            {item.group}
                          </span>
                        )}
                        {!isEditingThis && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(item);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition cursor-pointer"
                            title="Editar nome desta opção"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isCustom && !isEditingThis && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCustom(item.id);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Remover opção personalizada"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Rodapé Oficial (#cad4e6 + border-black) */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-t border-black flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold uppercase border border-black shadow-2xs transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold uppercase border border-emerald-800 shadow-xs transition cursor-pointer"
          >
            Salvar e Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
