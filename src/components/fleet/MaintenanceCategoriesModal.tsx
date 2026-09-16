import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  RotateCcw, 
  Layers, 
  Search, 
  Tag, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { MaintenanceCategoryDefinition } from '../../types';
import { INITIAL_MAINTENANCE_CATEGORIES } from '../../lib/storage';

interface MaintenanceCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: MaintenanceCategoryDefinition[];
  onSaveCategories: (updated: MaintenanceCategoryDefinition[]) => void;
  onSelectCategory?: (categoryName: string) => void;
}

const COLOR_PRESETS = [
  { label: 'Azul Céu', value: '#0284c7', bg: 'bg-sky-500' },
  { label: 'Verde Campo', value: '#16a34a', bg: 'bg-emerald-600' },
  { label: 'Laranja Trator', value: '#ea580c', bg: 'bg-orange-600' },
  { label: 'Vermelho Motor', value: '#dc2626', bg: 'bg-rose-600' },
  { label: 'Azul Hidráulico', value: '#2563eb', bg: 'bg-blue-600' },
  { label: 'Roxo Freios', value: '#9333ea', bg: 'bg-purple-600' },
  { label: 'Amarelo Elétrica', value: '#ca8a04', bg: 'bg-yellow-600' },
  { label: 'Índigo Estrutura', value: '#4f46e5', bg: 'bg-indigo-600' },
  { label: 'Esmeralda Plataforma', value: '#059669', bg: 'bg-emerald-700' },
  { label: 'Marrom Transmissão', value: '#7c2d12', bg: 'bg-amber-900' },
  { label: 'Ciano Radiador', value: '#0891b2', bg: 'bg-cyan-600' },
  { label: 'Cinza Engraxamento', value: '#475569', bg: 'bg-slate-600' },
  { label: 'Teal Suspensão', value: '#0d9488', bg: 'bg-teal-600' },
  { label: 'Âmbar Injeção', value: '#b45309', bg: 'bg-amber-700' },
];

export const MaintenanceCategoriesModal: React.FC<MaintenanceCategoriesModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveCategories,
  onSelectCategory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // State for Add / Edit form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#0284c7');
  const [formError, setFormError] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  const filteredCategories = [...categories]
    .filter(cat => 
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

  const startAddNew = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setColor('#0284c7');
    setFormError('');
    setIsAddingNew(true);
  };

  const startEdit = (cat: MaintenanceCategoryDefinition) => {
    setIsAddingNew(false);
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
    setColor(cat.color || '#0284c7');
    setFormError('');
  };

  const cancelForm = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setName('');
    setDescription('');
    setFormError('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('O nome da categoria é obrigatório.');
      return;
    }

    // Check for duplicated name
    const exists = categories.some(
      c => c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.id !== editingId
    );
    if (exists) {
      setFormError('Já existe uma categoria cadastrada com este nome.');
      return;
    }

    if (editingId) {
      // Edit existing
      const updated = categories.map(c => 
        c.id === editingId 
          ? { ...c, name: name.trim(), description: description.trim(), color } 
          : c
      );
      onSaveCategories(updated);
      setEditingId(null);
    } else {
      // Add new
      const newCategory: MaintenanceCategoryDefinition = {
        id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        description: description.trim(),
        color,
        isSystem: false,
      };
      const updated = [...categories, newCategory];
      onSaveCategories(updated);
      setIsAddingNew(false);

      if (onSelectCategory) {
        onSelectCategory(newCategory.name);
      }
    }

    setName('');
    setDescription('');
    setFormError('');
  };

  const handleDelete = (id: string, catName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir a categoria "${catName}"?`)) {
      const updated = categories.filter(c => c.id !== id);
      onSaveCategories(updated);
      if (editingId === id) {
        cancelForm();
      }
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Deseja restaurar todas as categorias padrões do sistema? Suas categorias personalizadas serão mantidas no final da lista.')) {
      const customOnes = categories.filter(c => !c.isSystem);
      const updated = [...INITIAL_MAINTENANCE_CATEGORIES, ...customOnes];
      onSaveCategories(updated);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900 bg-blue-800 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">
                Gerenciamento de Categorias de Serviço
              </h3>
              <p className="text-xs text-blue-200">
                Inclua, edite ou remova áreas de manutenção da frota agrícola
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Top Actions: Search + Add Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar categoria..."
                className="w-full pl-9 pr-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleResetDefaults}
                title="Restaurar categorias padrão"
                className="px-2.5 py-1.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-xs font-semibold transition flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Padrões</span>
              </button>

              {!isAddingNew && !editingId && (
                <button
                  type="button"
                  onClick={startAddNew}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Categoria</span>
                </button>
              )}
            </div>
          </div>

          {/* Form when adding or editing */}
          {(isAddingNew || editingId) && (
            <form 
              onSubmit={handleSave}
              className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-800/80 pb-2">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <span>{editingId ? 'Editar Categoria' : 'Nova Categoria de Serviço'}</span>
                </span>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-stone-400 hover:text-stone-600 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {formError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-blue-900 dark:text-stone-300 mb-1">
                    Nome da Categoria *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (formError) setFormError('');
                    }}
                    placeholder="Ex: Pulverizador & Bicos, Cardan & Cruzetas..."
                    className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-blue-200 dark:border-stone-700 rounded-xl text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-600"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-blue-900 dark:text-stone-300 mb-1">
                    Cor de Identificação
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-stone-300 cursor-pointer p-0.5 bg-white"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PRESETS.slice(0, 6).map((cp) => (
                        <button
                          key={cp.value}
                          type="button"
                          onClick={() => setColor(cp.value)}
                          className={`w-5 h-5 rounded-full ${cp.bg} transition hover:scale-110 cursor-pointer ${
                            color === cp.value ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                          }`}
                          title={cp.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-blue-900 dark:text-stone-300 mb-1">
                  Descrição / Exemplos de Serviços (Opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Regulagem de barras, troca de pontas cerâmicas, vazamentos de veneno"
                  className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-blue-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-3 py-1.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingId ? 'Salvar Alterações' : 'Adicionar Categoria'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">
              <span>Lista de Categorias ({filteredCategories.length})</span>
              <span>Ações</span>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden bg-white dark:bg-stone-800/40">
              {filteredCategories.length === 0 ? (
                <div className="py-8 text-center text-stone-400 text-xs">
                  Nenhuma categoria encontrada com o termo "{searchTerm}".
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3 sm:px-4 flex items-center justify-between hover:bg-stone-50/80 dark:hover:bg-stone-800/60 transition group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color || '#6366f1' }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                            {cat.name}
                          </span>
                          {cat.isSystem && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-500 uppercase tracking-wider">
                              Padrão
                            </span>
                          )}
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-stone-500 truncate max-w-md">
                            {cat.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      {onSelectCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCategory(cat.name);
                            onClose();
                          }}
                          className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                        >
                          Selecionar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        title="Editar Categoria"
                        className="p-1.5 text-stone-400 hover:text-indigo-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id, cat.name)}
                        title="Excluir Categoria"
                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex justify-between items-center">
          <p className="text-[11px] text-stone-500">
            As categorias criadas ficam disponíveis em todas as Ordens de Serviço (OS).
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Concluir
          </button>
        </div>

      </div>
    </div>
  );
};
