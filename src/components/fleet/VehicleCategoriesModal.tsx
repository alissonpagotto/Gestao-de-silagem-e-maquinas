import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  RotateCcw, 
  Tag, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { DEFAULT_VEHICLE_SYSTEM_CATEGORIES } from '../../lib/storage';

interface VehicleCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onSaveCategories: (categories: string[]) => void;
  onSelectCategory?: (category: string) => void;
}

export const VehicleCategoriesModal: React.FC<VehicleCategoriesModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveCategories,
  onSelectCategory,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAddCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCategoryName.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg('Informe o nome da categoria para incluir.');
      return;
    }

    if (categories.some(c => c.toUpperCase() === trimmed)) {
      setErrorMsg('Esta categoria já existe na lista.');
      return;
    }

    const updated = [...categories.map(c => c.toUpperCase()), trimmed]
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    onSaveCategories(updated);
    setNewCategoryName('');
    setErrorMsg('');
    setSuccessMsg(`Categoria "${trimmed}" adicionada com sucesso!`);
    setTimeout(() => setSuccessMsg(''), 2500);

    if (onSelectCategory) {
      onSelectCategory(trimmed);
    }
  };

  const handleDeleteCategory = (catToDelete: string) => {
    if (categories.length <= 1) {
      setErrorMsg('A lista precisa ter pelo menos uma categoria.');
      return;
    }
    const updated = categories
      .filter(c => c.toUpperCase() !== catToDelete.toUpperCase())
      .map(c => c.toUpperCase())
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    onSaveCategories(updated);
    setErrorMsg('');
  };

  const handleStartEdit = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingName(currentName.toUpperCase());
    setErrorMsg('');
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingName.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg('O nome da categoria não pode ficar vazio.');
      return;
    }
    if (categories.some((c, i) => i !== index && c.toUpperCase() === trimmed)) {
      setErrorMsg('Já existe outra categoria com este nome.');
      return;
    }

    const updated = [...categories];
    const oldName = updated[index];
    updated[index] = trimmed;
    const sorted = updated
      .map(c => c.toUpperCase())
      .filter((v, i, a) => v && a.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    onSaveCategories(sorted);
    setEditingIndex(null);
    setEditingName('');
    setErrorMsg('');

    if (onSelectCategory && oldName) {
      onSelectCategory(trimmed);
    }
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Deseja restaurar as categorias padrão do sistema? Suas categorias personalizadas serão reiniciadas.')) {
      const sortedDefaults = [...DEFAULT_VEHICLE_SYSTEM_CATEGORIES].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      onSaveCategories(sortedDefaults);
      setErrorMsg('');
      setSuccessMsg('Categorias padrão restauradas com sucesso!');
      setTimeout(() => setSuccessMsg(''), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header - Aço Cinza MDI Acetinado */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-slate-300/80 text-slate-700">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                EDITAR LISTA DE CATEGORIAS
              </h3>
              <p className="text-[11px] text-slate-600 font-semibold uppercase">
                INCLUA NOVAS CATEGORIAS OU EXCLUA OPÇÕES EXISTENTES DO SELETOR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center space-x-2 text-rose-700 dark:text-rose-300 text-xs font-bold uppercase">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg.toUpperCase()}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold uppercase">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg.toUpperCase()}</span>
            </div>
          )}

          {/* Form: Incluir Nova Categoria */}
          <form onSubmit={handleAddCategory} className="p-3.5 bg-slate-50 dark:bg-stone-850 rounded-xl border border-slate-300 dark:border-stone-700 space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-stone-300 uppercase">
              INCLUIR NOVA CATEGORIA NA LISTA:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value.toUpperCase());
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="EX: RETROESCAVADEIRA, MOTONIVELADORA, COLHEITADEIRA..."
                className="flex-1 px-3.5 py-2 text-xs uppercase font-bold rounded-xl border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#059669] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0 uppercase"
              >
                <Plus className="w-4 h-4" />
                <span>+ INCLUIR</span>
              </button>
            </div>
          </form>

          {/* List of Existing Categories */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 px-1 uppercase">
              <span>CATEGORIAS EXISTENTES ({categories.length})</span>
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="text-[11px] text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 flex items-center space-x-1 font-bold hover:underline cursor-pointer uppercase"
                title="Voltar para a lista original"
              >
                <RotateCcw className="w-3 h-3" />
                <span>RESTAURAR PADRÕES</span>
              </button>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-white dark:bg-stone-800/40">
              {categories.map((cat, idx) => {
                const isEditing = editingIndex === idx;

                return (
                  <div
                    key={`${cat}-${idx}`}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50/80 dark:hover:bg-stone-800/80 transition"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-semibold uppercase rounded-lg border border-cyan-500 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(idx);
                            if (e.key === 'Escape') setEditingIndex(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                          title="Salvar alteração"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="p-1.5 bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-lg cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-cyan-600 dark:bg-cyan-400 shrink-0" />
                          <span className="text-sm font-semibold uppercase text-stone-800 dark:text-stone-200 truncate">
                            {cat.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          {onSelectCategory && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCategory(cat);
                                onClose();
                              }}
                              className="px-2.5 py-1 bg-emerald-100/90 text-emerald-900 border border-emerald-500/80 hover:bg-emerald-200 text-[10px] font-bold rounded-lg transition cursor-pointer uppercase shadow-2xs"
                              title="SELECIONAR ESTA CATEGORIA NO FORMULÁRIO"
                            >
                              SELECIONAR
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx, cat)}
                            className="p-1.5 text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition cursor-pointer"
                            title="EDITAR NOME DESTA CATEGORIA"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title="EXCLUIR ESTA CATEGORIA DA LISTA"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center bg-stone-50 dark:bg-stone-800/40">
          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-bold uppercase">
            CATEGORIAS PARAMETRIZADAS PARA GESTÃO DE FROTAS
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition cursor-pointer uppercase shadow-xs"
          >
            CONCLUIR
          </button>
        </div>

      </div>
    </div>
  );
};
