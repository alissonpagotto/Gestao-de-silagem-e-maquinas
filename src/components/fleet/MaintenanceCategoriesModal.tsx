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
      setFormError('O nome do subgrupo é obrigatório.');
      return;
    }

    // Check for duplicated name
    const exists = categories.some(
      c => c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.id !== editingId
    );
    if (exists) {
      setFormError('Já existe um subgrupo cadastrado com este nome.');
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
    if (window.confirm(`Tem certeza que deseja excluir o subgrupo "${catName}"?`)) {
      const updated = categories.filter(c => c.id !== id);
      onSaveCategories(updated);
      if (editingId === id) {
        cancelForm();
      }
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Deseja restaurar todos os subgrupos padrão do sistema? Seus subgrupos personalizados serão mantidos no final da lista.')) {
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
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-300/80 text-slate-700 flex items-center justify-center shadow-xs">
              <Tag className="w-5 h-5 text-slate-700 font-bold" />
            </div>
            <div>
              <h3 className="text-base text-slate-700 font-bold uppercase tracking-wider font-['Outfit']">
                GERENCIAR SUBGRUPOS DE MANUTENÇÃO
              </h3>
              <p className="text-[11px] text-slate-600 font-medium uppercase tracking-wide">
                INCLUA, EDITE OU REMOVA SUBGRUPOS DE MANUTENÇÃO DA FROTA AGRÍCOLA
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-300/50 transition cursor-pointer"
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
                placeholder="BUSCAR SUBGRUPO..."
                className="w-full pl-9 pr-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-bold uppercase focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleResetDefaults}
                title="RESTAURAR SUBGRUPOS PADRÃO"
                className="px-2.5 py-1.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer uppercase"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PADRÕES</span>
              </button>

              {!isAddingNew && !editingId && (
                <button
                  type="button"
                  onClick={startAddNew}
                  className="px-3 py-1.5 bg-[#059669] text-white hover:bg-emerald-700 font-bold uppercase rounded-xl text-xs transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>NOVO SUBGRUPO</span>
                </button>
              )}
            </div>
          </div>

          {/* Form when adding or editing */}
          {(isAddingNew || editingId) && (
            <form 
              onSubmit={handleSave}
              className="p-4 rounded-xl bg-slate-50 dark:bg-stone-850 border border-slate-300 dark:border-stone-700 space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-700 pb-2">
                <span className="text-xs font-black text-slate-800 dark:text-stone-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-700 dark:text-stone-300" />
                  <span>{editingId ? 'EDITAR SUBGRUPO' : 'NOVO SUBGRUPO DE MANUTENÇÃO'}</span>
                </span>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-stone-500 hover:text-stone-800 text-xs font-bold cursor-pointer uppercase"
                >
                  CANCELAR
                </button>
              </div>

              {formError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold uppercase flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError.toUpperCase()}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1 uppercase">
                    NOME DO SUBGRUPO *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (formError) setFormError('');
                    }}
                    placeholder="EX: PULVERIZADOR & BICOS, CARDAN & CRUZETAS..."
                    className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-bold uppercase text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-600 outline-none"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1 uppercase">
                    COR DE IDENTIFICAÇÃO
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PRESETS.slice(0, 6).map((cp) => (
                        <button
                          key={cp.value}
                          type="button"
                          onClick={() => setColor(cp.value)}
                          className={`w-5 h-5 rounded-full ${cp.bg} transition hover:scale-110 cursor-pointer ${
                            color === cp.value ? 'ring-2 ring-emerald-600 ring-offset-1' : ''
                          }`}
                          title={cp.label.toUpperCase()}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1 uppercase">
                  DESCRIÇÃO / EXEMPLOS DE SERVIÇOS (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="EX: REGULAGEM DE BARRAS, TROCA DE PONTAS CERÂMICAS..."
                  className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold uppercase text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-3 py-1.5 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 rounded-lg text-xs font-bold transition cursor-pointer uppercase"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#059669] text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer uppercase"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingId ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR SUBGRUPO'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Subgroups List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">
              <span>LISTA DE SUBGRUPOS ({filteredCategories.length})</span>
              <span>AÇÕES</span>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden bg-white dark:bg-stone-800/40">
              {filteredCategories.length === 0 ? (
                <div className="py-8 text-center text-stone-400 text-xs font-bold uppercase">
                  NENHUM SUBGRUPO ENCONTRADO COM O TERMO "{searchTerm.toUpperCase()}".
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
                          <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 uppercase truncate">
                            {cat.name.toUpperCase()}
                          </span>
                          {cat.isSystem && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-stone-700 text-stone-500 uppercase tracking-wider">
                              PADRÃO
                            </span>
                          )}
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-stone-500 uppercase truncate max-w-md font-medium">
                            {cat.description.toUpperCase()}
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
                          className="px-2.5 py-1 bg-emerald-100/90 text-emerald-900 border border-emerald-500/80 hover:bg-emerald-200 text-[10px] font-bold rounded-lg transition cursor-pointer uppercase shadow-2xs"
                        >
                          SELECIONAR
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        title="EDITAR SUBGRUPO"
                        className="p-1.5 text-stone-400 hover:text-emerald-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id, cat.name)}
                        title="EXCLUIR SUBGRUPO"
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
        <div className="p-4 border-t border-slate-300 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex justify-between items-center">
          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-bold uppercase">
            OS SUBGRUPOS CRIADOS FICAM DISPONÍVEIS EM TODAS AS ORDENS DE SERVIÇO (OS) E NO PLANO PREVENTIVO DA FROTA.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 text-white hover:bg-slate-800 font-bold uppercase text-xs rounded-xl transition cursor-pointer shadow-xs"
          >
            CONCLUIR
          </button>
        </div>

      </div>
    </div>
  );
};
