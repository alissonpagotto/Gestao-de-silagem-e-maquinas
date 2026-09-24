import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Sprout, 
  DollarSign, 
  Package, 
  TrendingUp, 
  HardHat, 
  Users, 
  ShieldCheck, 
  Car, 
  Wrench, 
  Truck, 
  UserSquare2, 
  UploadCloud, 
  FileSpreadsheet, 
  Settings,
  ReceiptText,
  ShoppingCart,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  LayoutDashboard,
  Fuel,
  CircleDot,
  LucideIcon 
} from 'lucide-react';

export interface ShortcutDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
}

export const ALL_SHORTCUTS: ShortcutDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40', iconColor: 'text-blue-500' },
  { id: 'servicos', label: 'Serviços', icon: Sprout, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', iconColor: 'text-emerald-500' },
  { id: 'venda', label: 'Venda', icon: ShoppingCart, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40', iconColor: 'text-rose-500' },
  { id: 'despesas', label: 'Despesas', icon: DollarSign, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40', iconColor: 'text-rose-500' },
  { id: 'estoque', label: 'Estoque', icon: Package, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40', iconColor: 'text-sky-500' },
  { id: 'financeiro', label: 'Financeiro', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', iconColor: 'text-emerald-500' },
  { id: 'fiscal', label: 'Notas e Entradas', icon: ReceiptText, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40', iconColor: 'text-sky-500' },
  { id: 'rh', label: 'RH', icon: HardHat, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40', iconColor: 'text-amber-500' },
  { id: 'clientes', label: 'Clientes', icon: Users, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40', iconColor: 'text-indigo-500' },
  { id: 'frotas', label: 'Painel Frota', icon: ShieldCheck, color: 'text-stone-700 bg-stone-100 dark:bg-stone-800', iconColor: 'text-slate-600 dark:text-slate-400' },
  { id: 'veiculos', label: 'Veículos', icon: Car, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40', iconColor: 'text-cyan-500' },
  { id: 'manutencoes', label: 'Manutenções', icon: Wrench, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40', iconColor: 'text-rose-500' },
  { id: 'combustivel', label: 'Combustível', icon: Fuel, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40', iconColor: 'text-amber-500' },
  { id: 'rodizio', label: 'Rodízio Pneus', icon: CircleDot, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40', iconColor: 'text-cyan-500' },
  { id: 'fornecedores', label: 'Fornecedores', icon: Truck, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40', iconColor: 'text-purple-500' },
  { id: 'funcionarios', label: 'Funcionários', icon: UserSquare2, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40', iconColor: 'text-amber-500' },
  { id: 'nfe_importar', label: 'Importar NF-e', icon: UploadCloud, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40', iconColor: 'text-sky-500' },
  { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40', iconColor: 'text-teal-500' },
  { id: 'configuracoes', label: 'Ajustes', icon: Settings, color: 'text-stone-600 bg-stone-100 dark:bg-stone-800', iconColor: 'text-stone-500' },
];

export const DEFAULT_SHORTCUT_IDS = [
  'servicos',
  'venda',
  'despesas',
  'estoque',
  'financeiro',
  'fiscal',
  'rh',
  'clientes',
  'frotas',
  'veiculos',
  'manutencoes',
  'fornecedores',
  'funcionarios',
  'nfe_importar',
  'relatorios',
  'configuracoes',
];

interface CustomizeShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedShortcuts: string[];
  onSave: (newSelected: string[]) => void;
}

export const CustomizeShortcutsModal: React.FC<CustomizeShortcutsModalProps> = ({
  isOpen,
  onClose,
  selectedShortcuts,
  onSave,
}) => {
  const [currentSelected, setCurrentSelected] = useState<string[]>(selectedShortcuts);
  const [activeTab, setActiveTab] = useState<'visibilidade' | 'ordem'>('visibilidade');

  useEffect(() => {
    if (isOpen) {
      setCurrentSelected(selectedShortcuts);
    }
  }, [isOpen, selectedShortcuts]);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    setCurrentSelected(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const moveShortcut = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentSelected];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setCurrentSelected(newOrder);
  };

  const handleSavePreferences = () => {
    onSave(currentSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        
        {/* Header */}
        <div 
          className="px-5 py-3.5 bg-zinc-900 dark:bg-stone-800 text-white flex items-center justify-between shrink-0"
        >
          <div className="flex items-center space-x-2.5">
            <SlidersHorizontal className="w-5 h-5 text-white shrink-0" />
            <div>
              <h3 
                className="text-base sm:text-lg font-bold tracking-tight text-white leading-snug"
              >
                Personalizar Atalhos do Topo
              </h3>
              <p 
                className="text-[11px] text-zinc-300 font-medium"
              >
                Escolha os módulos exibidos e organize a ordem de exibição
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/20 transition cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Sub-tabs: Visibilidade vs Ordem */}
        <div className="flex items-center border-b border-zinc-200 dark:border-stone-800 px-5 pt-2.5 bg-zinc-50 dark:bg-stone-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('visibilidade')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'visibilidade'
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white'
            }`}
          >
            1. Selecionar Atalhos ({currentSelected.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ordem')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'ordem'
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white'
            }`}
          >
            2. Organizar Ordem
          </button>
        </div>

        {/* Shortcuts Content */}
        <div 
          className="p-5 sm:p-6 space-y-4 bg-zinc-50 dark:bg-stone-900 flex-1 overflow-hidden flex flex-col"
        >
          {activeTab === 'visibilidade' ? (
            <>
              <label 
                className="block text-[11px] font-extrabold text-zinc-500 dark:text-stone-400 uppercase tracking-wider shrink-0"
              >
                SELECIONE OS MÓDULOS DE ACESSO RÁPIDO:
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {ALL_SHORTCUTS.map((shortcut) => {
                  const isChecked = currentSelected.includes(shortcut.id);
                  const Icon = shortcut.icon;

                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      onClick={() => handleToggle(shortcut.id)}
                      className={`
                        w-full px-3.5 py-2.5 rounded-xl border flex items-center space-x-3 transition cursor-pointer text-left select-none shadow-xs
                        ${
                          isChecked
                            ? 'border-zinc-900 bg-white dark:bg-stone-800 ring-1 ring-zinc-900 dark:border-white dark:ring-white'
                            : 'border-zinc-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-zinc-400'
                        }
                      `}
                    >
                      {/* Custom Checkbox */}
                      <div className={`
                        w-5 h-5 rounded-md flex items-center justify-center transition shrink-0
                        ${isChecked ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'border-2 border-zinc-300 dark:border-stone-600 bg-white dark:bg-stone-700'}
                      `}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      {/* Shortcut Icon */}
                      <Icon className={`w-4 h-4 shrink-0 ${isChecked ? 'text-zinc-900 dark:text-white' : shortcut.iconColor}`} />

                      {/* Shortcut Label */}
                      <span 
                        className="text-xs font-bold tracking-tight truncate text-zinc-900 dark:text-white"
                      >
                        {shortcut.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <label 
                className="block text-[11px] font-extrabold text-zinc-500 dark:text-stone-400 uppercase tracking-wider shrink-0"
              >
                ORDENAR ATALHOS ATIVOS (SUBIR / DESCER):
              </label>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {currentSelected.length === 0 ? (
                  <div className="p-6 text-center bg-white dark:bg-stone-800 rounded-xl border border-zinc-200 dark:border-stone-700 shadow-xs">
                    <p className="text-xs font-bold text-zinc-600 dark:text-stone-300">
                      Nenhum atalho selecionado. Selecione atalhos na aba anterior.
                    </p>
                  </div>
                ) : (
                  currentSelected.map((id, index) => {
                    const def = ALL_SHORTCUTS.find(s => s.id === id);
                    if (!def) return null;
                    const Icon = def.icon;
                    const isFirst = index === 0;
                    const isLast = index === currentSelected.length - 1;

                    return (
                      <div
                        key={id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-xs"
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          {/* Número sequencial em destaque limpo */}
                          <span 
                            className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-stone-700 border border-zinc-200 dark:border-stone-600 text-zinc-800 dark:text-white text-xs font-bold flex items-center justify-center shrink-0"
                          >
                            {index + 1}
                          </span>
                          <Icon className="w-4 h-4 shrink-0 text-zinc-700 dark:text-white" />
                          {/* Nome do módulo */}
                          <span 
                            className="text-xs font-bold text-zinc-900 dark:text-white truncate"
                          >
                            {def.label}
                          </span>
                        </div>

                        {/* Setas de subir / descer */}
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveShortcut(index, 'up')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg text-zinc-700 dark:text-stone-200 bg-zinc-100 dark:bg-stone-700 hover:bg-zinc-200 disabled:opacity-25 transition cursor-pointer border border-zinc-200 dark:border-stone-600 active:scale-95"
                            title="Subir na lista"
                          >
                            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveShortcut(index, 'down')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg text-zinc-700 dark:text-stone-200 bg-zinc-100 dark:bg-stone-700 hover:bg-zinc-200 disabled:opacity-25 transition cursor-pointer border border-zinc-200 dark:border-stone-600 active:scale-95"
                            title="Descer na lista"
                          >
                            <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Actions do Rodapé */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-stone-800 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentSelected(DEFAULT_SHORTCUT_IDS)}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-zinc-600 dark:text-stone-300 hover:text-zinc-900 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border border-zinc-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-800 dark:text-stone-200 hover:bg-zinc-100 transition cursor-pointer shadow-xs"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleSavePreferences}
                className="px-5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-white shadow-sm transition cursor-pointer flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Salvar Preferências</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
