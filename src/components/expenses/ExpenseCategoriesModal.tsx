import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, Tag, Building, ChevronDown, ArrowUp, ArrowDown, ArrowDownAZ } from 'lucide-react';
import { ExpenseCategory, CostCenter } from '../../types';

interface ExpenseCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  onSaveCategories: (categories: ExpenseCategory[]) => void;
  costCenters: CostCenter[];
  onSaveCostCenters: (centers: CostCenter[]) => void;
  onSelectCategory?: (categoryId: string) => void;
}

const PRESET_COLORS = [
  '#d97706', // amber
  '#dc2626', // red
  '#16a34a', // green
  '#0284c7', // light blue
  '#7c3aed', // purple
  '#ea580c', // orange
  '#0d9488', // teal
  '#854d0e', // brown
  '#475569', // slate
  '#db2777', // pink
  '#4f46e5', // indigo
  '#65a30d', // lime
];

export const ExpenseCategoriesModal: React.FC<ExpenseCategoriesModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveCategories,
  costCenters,
  onSaveCostCenters,
  onSelectCategory,
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'costCenters'>('categories');

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10b981');

  // Edit Category State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');
  const [editCatColor, setEditCatColor] = useState('#10b981');

  // New Cost Center State
  const [newCCName, setNewCCName] = useState('');
  const [newCCType, setNewCCType] = useState<'safra' | 'maquinario' | 'talhao' | 'instalacao' | 'geral'>('talhao');

  // Edit Cost Center State
  const [editingCCId, setEditingCCId] = useState<string | null>(null);
  const [editCCName, setEditCCName] = useState('');
  const [editCCType, setEditCCType] = useState<'safra' | 'maquinario' | 'talhao' | 'instalacao' | 'geral'>('talhao');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const newId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newCategory: ExpenseCategory = {
      id: newId,
      name: newCatName.trim(),
      color: newCatColor,
      description: newCatDesc.trim() || undefined,
      isCustom: true,
    };

    onSaveCategories([...categories, newCategory]);
    if (onSelectCategory) {
      onSelectCategory(newId);
    }
    setNewCatName('');
    setNewCatDesc('');
    setNewCatColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
  };

  const handleStartEditCategory = (cat: ExpenseCategory) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || '');
    setEditCatColor(cat.color || '#10b981');
  };

  const handleSaveEditCategory = (id: string) => {
    if (!editCatName.trim()) return;
    const updated = categories.map((c) =>
      c.id === id
        ? {
            ...c,
            name: editCatName.trim(),
            description: editCatDesc.trim() || undefined,
            color: editCatColor,
          }
        : c
    );
    onSaveCategories(updated);
    setEditingCatId(null);
  };

  const handleDeleteCategory = (id: string, name: string) => {
    if (categories.length <= 1) {
      return;
    }
    onSaveCategories(categories.filter((c) => c.id !== id));
    if (editingCatId === id) setEditingCatId(null);
  };

  // Reorder & Sort Category Handlers
  const handleSortCategoriesAZ = () => {
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    onSaveCategories(sorted);
  };

  const handleMoveCategoryUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...categories];
    const item = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = item;
    onSaveCategories(updated);
  };

  const handleMoveCategoryDown = (index: number) => {
    if (index >= categories.length - 1) return;
    const updated = [...categories];
    const item = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = item;
    onSaveCategories(updated);
  };

  const handleAddCostCenter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCCName.trim()) return;

    const newCenter: CostCenter = {
      id: `cc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newCCName.trim(),
      type: newCCType,
    };

    onSaveCostCenters([...costCenters, newCenter]);
    setNewCCName('');
  };

  const handleStartEditCC = (cc: CostCenter) => {
    setEditingCCId(cc.id);
    setEditCCName(cc.name);
    setEditCCType(cc.type);
  };

  const handleSaveEditCC = (id: string) => {
    if (!editCCName.trim()) return;
    const updated = costCenters.map((cc) =>
      cc.id === id
        ? { ...cc, name: editCCName.trim(), type: editCCType }
        : cc
    );
    onSaveCostCenters(updated);
    setEditingCCId(null);
  };

  const handleDeleteCostCenter = (id: string, name: string) => {
    onSaveCostCenters(costCenters.filter((cc) => cc.id !== id));
    if (editingCCId === id) setEditingCCId(null);
  };

  // Reorder & Sort Cost Center Handlers
  const handleSortCostCentersAZ = () => {
    const sorted = [...costCenters].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    onSaveCostCenters(sorted);
  };

  const handleMoveCostCenterUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...costCenters];
    const item = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = item;
    onSaveCostCenters(updated);
  };

  const handleMoveCostCenterDown = (index: number) => {
    if (index >= costCenters.length - 1) return;
    const updated = [...costCenters];
    const item = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = item;
    onSaveCostCenters(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Standardized Solid Teal Bar */}
        <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Gerenciar Categorias & Centros de Custo
            </h3>
            <p className="text-xs text-white/80">
              Inclua, edite ou exclua categorias de despesas e talhões
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition ${
              activeTab === 'categories'
                ? 'border-[#009688] text-[#009688] bg-white dark:bg-stone-900 shadow-2xs'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            Categorias de Despesas ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('costCenters')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition ${
              activeTab === 'costCenters'
                ? 'border-[#009688] text-[#009688] bg-white dark:bg-stone-900 shadow-2xs'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            Centros de Custo & Talhões ({costCenters.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {activeTab === 'categories' ? (
            <>
              {/* Add New Category Form */}
              <form onSubmit={handleAddCategory} className="bg-stone-50 dark:bg-stone-800/40 p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3">
                <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider block">
                  INCLUIR NOVA CATEGORIA
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">Nome da Categoria</label>
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Ex: Análise de Solo & Foliar"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#009688] font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">Descrição (opcional)</label>
                    <input
                      type="text"
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      placeholder="Ex: Amostragem e laudos de fertilidade"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#009688] font-medium"
                    />
                  </div>
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1.5">Cor de Destaque</label>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition ${
                          newCatColor === c ? 'border-stone-900 scale-110 shadow-xs' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Categoria</span>
                  </button>
                </div>
              </form>

              {/* Existing Categories List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider block">
                      CATEGORIAS CADASTRADAS ({categories.length})
                    </span>
                    <span className="text-[10px] text-stone-400">Clique nas setas para reordenar ou no botão A-Z</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSortCategoriesAZ}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-bold text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-[#009688] hover:text-white dark:hover:bg-[#009688] border border-stone-200 dark:border-stone-700 rounded-lg transition cursor-pointer shadow-2xs"
                    title="Ordenar lista alfabeticamente de A a Z"
                  >
                    <ArrowDownAZ className="w-3.5 h-3.5" />
                    <span>Ordenar A-Z</span>
                  </button>
                </div>

                <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-2xs">
                  {categories.map((cat, index) => {
                    const isEditing = editingCatId === cat.id;

                    if (isEditing) {
                      return (
                        <div key={cat.id} className="p-3 bg-teal-50/50 dark:bg-teal-950/20 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-300 mb-0.5">Nome da Categoria</label>
                              <input
                                type="text"
                                value={editCatName}
                                onChange={(e) => setEditCatName(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#009688] bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-stone-600 dark:text-stone-300 mb-0.5">Descrição</label>
                              <input
                                type="text"
                                value={editCatDesc}
                                onChange={(e) => setEditCatDesc(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center space-x-1.5">
                              {PRESET_COLORS.slice(0, 8).map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setEditCatColor(c)}
                                  className={`w-4 h-4 rounded-full border ${
                                    editCatColor === c ? 'border-stone-900 scale-125' : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => setEditingCatId(null)}
                                className="px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditCategory(cat.id)}
                                className="inline-flex items-center space-x-1 px-3 py-1 bg-[#156f33] hover:bg-[#0e5224] text-white text-xs font-bold rounded-lg shadow-xs transition"
                              >
                                <Check className="w-3 h-3" />
                                <span>Salvar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 transition">
                        <div className="flex items-center space-x-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: cat.color }}
                          />
                          <div>
                            <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{cat.name}</p>
                            {cat.description && (
                              <p className="text-[11px] text-stone-500 dark:text-stone-400">{cat.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {/* Move Up / Down Buttons */}
                          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5 border border-stone-200 dark:border-stone-700 mr-1.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveCategoryUp(index)}
                              className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-20 disabled:pointer-events-none hover:bg-white dark:hover:bg-stone-700 rounded transition cursor-pointer"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === categories.length - 1}
                              onClick={() => handleMoveCategoryDown(index)}
                              className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-20 disabled:pointer-events-none hover:bg-white dark:hover:bg-stone-700 rounded transition cursor-pointer"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          {onSelectCategory && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCategory(cat.id);
                                onClose();
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-[#009688] hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg transition cursor-pointer mr-1"
                            >
                              Selecionar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEditCategory(cat)}
                            className="p-1.5 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                            title="Editar Categoria"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Remover Categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Cost Centers Tab */}
              <form onSubmit={handleAddCostCenter} className="bg-stone-50 dark:bg-stone-800/40 p-4 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3">
                <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider block">
                  INCLUIR CENTRO DE CUSTO / TALHÃO
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">Nome do Centro</label>
                    <input
                      type="text"
                      required
                      value={newCCName}
                      onChange={(e) => setNewCCName(e.target.value)}
                      placeholder="Ex: Talhão 03 - Milho Irrigado"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#009688] font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">Tipo</label>
                    <div className="relative">
                      <select
                        value={newCCType}
                        onChange={(e) => setNewCCType(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#009688] font-medium appearance-none pr-8"
                      >
                        <option value="talhao">Talhão / Lavoura</option>
                        <option value="maquinario">Frota / Maquinários</option>
                        <option value="instalacao">Estrutura de Silo & Trincheira</option>
                        <option value="safra">Safra Geral</option>
                        <option value="geral">Administrativo & Vendas</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Centro</span>
                  </button>
                </div>
              </form>

              {/* Cost Center List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider block">
                      CENTROS CADASTRADOS ({costCenters.length})
                    </span>
                    <span className="text-[10px] text-stone-400">Clique nas setas para reordenar ou no botão A-Z</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSortCostCentersAZ}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-bold text-stone-700 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-[#009688] hover:text-white dark:hover:bg-[#009688] border border-stone-200 dark:border-stone-700 rounded-lg transition cursor-pointer shadow-2xs"
                    title="Ordenar centros alfabeticamente de A a Z"
                  >
                    <ArrowDownAZ className="w-3.5 h-3.5" />
                    <span>Ordenar A-Z</span>
                  </button>
                </div>

                <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-2xs">
                  {costCenters.map((cc, index) => {
                    const isEditing = editingCCId === cc.id;

                    if (isEditing) {
                      return (
                        <div key={cc.id} className="p-3 bg-teal-50/50 dark:bg-teal-950/20 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editCCName}
                              onChange={(e) => setEditCCName(e.target.value)}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#009688] bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                              autoFocus
                            />
                            <select
                              value={editCCType}
                              onChange={(e) => setEditCCType(e.target.value as any)}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800"
                            >
                              <option value="talhao">Talhão / Lavoura</option>
                              <option value="maquinario">Frota / Maquinários</option>
                              <option value="instalacao">Estrutura de Silo & Trincheira</option>
                              <option value="safra">Safra Geral</option>
                              <option value="geral">Administrativo & Vendas</option>
                            </select>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingCCId(null)}
                              className="px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-200 rounded-lg transition"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditCC(cc.id)}
                              className="inline-flex items-center space-x-1 px-3 py-1 bg-[#156f33] hover:bg-[#0e5224] text-white text-xs font-bold rounded-lg shadow-xs transition"
                            >
                              <Check className="w-3 h-3" />
                              <span>Salvar</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={cc.id} className="p-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 transition">
                        <div className="flex items-center space-x-2.5">
                          <Building className="w-4 h-4 text-[#009688] shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{cc.name}</p>
                            <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-wider">{cc.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {/* Move Up / Down Buttons */}
                          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5 border border-stone-200 dark:border-stone-700 mr-1.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveCostCenterUp(index)}
                              className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-20 disabled:pointer-events-none hover:bg-white dark:hover:bg-stone-700 rounded transition cursor-pointer"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === costCenters.length - 1}
                              onClick={() => handleMoveCostCenterDown(index)}
                              className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-20 disabled:pointer-events-none hover:bg-white dark:hover:bg-stone-700 rounded transition cursor-pointer"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleStartEditCC(cc)}
                            className="p-1.5 text-stone-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                            title="Editar Centro de Custo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCostCenter(cc.id, cc.name)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Remover Centro de Custo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer - Standardized */}
        <div className="px-5 py-3 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex justify-end space-x-3">
          <button
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
