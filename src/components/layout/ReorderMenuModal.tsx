import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Check, 
  GripVertical, 
  SlidersHorizontal,
  LayoutDashboard, 
  Tractor, 
  Package, 
  TrendingUp, 
  HeartHandshake, 
  FileSpreadsheet, 
  Users, 
  Truck, 
  Car, 
  Settings,
  ReceiptText,
  ShoppingCart,
  LucideIcon
} from 'lucide-react';

export interface MenuItemDef {
  id: string;
  label: string;
  icon: LucideIcon;
  hasSubmenu?: boolean;
}

export const ALL_MENU_ITEMS: MenuItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'servicos', label: 'Serviços', icon: Tractor },
  { id: 'venda', label: 'Venda', icon: ShoppingCart },
  { id: 'estoque', label: 'Estoque', icon: Package },
  { id: 'financeiro', label: 'Financeiro', icon: TrendingUp },
  { id: 'fiscal', label: 'Fiscal', icon: ReceiptText },
  { id: 'rh', label: 'RH', icon: HeartHandshake },
  { id: 'relatorios', label: 'Relatórios', icon: FileSpreadsheet },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'fornecedores', label: 'Fornecedores', icon: Truck },
  { id: 'frotas', label: 'Gestão de Frotas', icon: Car, hasSubmenu: true },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

export const DEFAULT_MENU_ORDER = ALL_MENU_ITEMS.map(item => item.id);

interface ReorderMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrder: string[];
  onSaveOrder: (newOrder: string[]) => void;
}

export const ReorderMenuModal: React.FC<ReorderMenuModalProps> = ({
  isOpen,
  onClose,
  currentOrder,
  onSaveOrder,
}) => {
  const [order, setOrder] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Ensure all ALL_MENU_ITEMS exist in order
      const validOrder = currentOrder.filter(id => ALL_MENU_ITEMS.some(m => m.id === id));
      if (!validOrder.includes('venda')) {
        const servIndex = validOrder.indexOf('servicos');
        if (servIndex !== -1) {
          validOrder.splice(servIndex + 1, 0, 'venda');
        } else {
          validOrder.push('venda');
        }
      }
      if (!validOrder.includes('fiscal')) {
        const finIndex = validOrder.indexOf('financeiro');
        if (finIndex !== -1) {
          validOrder.splice(finIndex + 1, 0, 'fiscal');
        } else {
          validOrder.push('fiscal');
        }
      }
      const missing = ALL_MENU_ITEMS.filter(m => !validOrder.includes(m.id)).map(m => m.id);
      setOrder([...validOrder, ...missing]);
    }
  }, [isOpen, currentOrder]);

  if (!isOpen) return null;

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...order];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setOrder(newOrder);
  };

  const moveToTop = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    const [item] = newOrder.splice(index, 1);
    newOrder.unshift(item);
    setOrder(newOrder);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...order];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleReset = () => {
    setOrder(DEFAULT_MENU_ORDER);
  };

  const handleSave = () => {
    onSaveOrder(order);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        
        {/* Header */}
        <div 
          className="px-5 py-3.5 bg-zinc-900 dark:bg-stone-800 text-white flex items-center justify-between shrink-0"
        >
          <div className="flex items-center space-x-2.5">
            <SlidersHorizontal className="w-5 h-5 text-white shrink-0" />
            <div>
              <h3 
                className="text-base font-bold tracking-tight text-white leading-snug"
              >
                Organizar Ordem do Menu
              </h3>
              <p 
                className="text-[11px] text-zinc-300 font-medium"
              >
                Mova os itens para cima ou para baixo conforme sua preferência
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/20 transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content list */}
        <div 
          className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1 scrollbar-thin bg-zinc-50 dark:bg-stone-900"
        >
          <div 
            className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-stone-800 text-[11px] font-extrabold text-zinc-500 dark:text-stone-300 uppercase tracking-wider"
          >
            <span>POSIÇÃO &amp; ITEM</span>
            <span>AÇÕES DE REORDENAÇÃO</span>
          </div>

          <div className="space-y-1.5">
            {order.map((itemId, index) => {
              const def = ALL_MENU_ITEMS.find(m => m.id === itemId);
              if (!def) return null;
              const Icon = def.icon;
              const isFirst = index === 0;
              const isLast = index === order.length - 1;

              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition select-none bg-white dark:bg-stone-800 shadow-xs
                    ${draggedIndex === index 
                      ? 'border-zinc-900 ring-2 ring-zinc-900/20 opacity-90 scale-[0.99]' 
                      : 'border-zinc-200 dark:border-stone-700 hover:border-zinc-400'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div 
                      className="cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div 
                      className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-stone-700 border border-zinc-200 dark:border-stone-600 flex items-center justify-center text-xs font-bold text-zinc-800 dark:text-white shrink-0"
                    >
                      {index + 1}
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-stone-700 border border-zinc-200 dark:border-stone-600 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-zinc-700 dark:text-white" />
                    </div>

                    <span 
                      className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate"
                    >
                      {def.label}
                    </span>
                  </div>

                  {/* Move buttons */}
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => moveToTop(index)}
                      disabled={isFirst}
                      title="Mover para o topo"
                      className="px-2 py-1 rounded-lg text-zinc-700 dark:text-stone-200 bg-zinc-100 dark:bg-stone-700 hover:bg-zinc-200 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer text-[10px] font-bold hidden sm:inline-flex border border-zinc-200 dark:border-stone-600 active:scale-95"
                    >
                      Topo
                    </button>

                    <button
                      type="button"
                      onClick={() => moveItem(index, 'up')}
                      disabled={isFirst}
                      title="Subir posição"
                      className="p-1.5 rounded-lg text-zinc-700 dark:text-stone-200 bg-zinc-100 dark:bg-stone-700 hover:bg-zinc-200 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer border border-zinc-200 dark:border-stone-600 active:scale-95"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => moveItem(index, 'down')}
                      disabled={isLast}
                      title="Descer posição"
                      className="p-1.5 rounded-lg text-zinc-700 dark:text-stone-200 bg-zinc-100 dark:bg-stone-700 hover:bg-zinc-200 disabled:opacity-25 disabled:pointer-events-none transition cursor-pointer border border-zinc-200 dark:border-stone-600 active:scale-95"
                    >
                      <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div 
          className="p-4 border-t border-zinc-200 dark:border-stone-800 bg-zinc-50 dark:bg-stone-900 flex items-center justify-between gap-2 shrink-0"
        >
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl text-zinc-600 dark:text-stone-300 hover:text-zinc-900 hover:bg-zinc-200 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl border border-zinc-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-800 dark:text-stone-200 hover:bg-zinc-100 transition cursor-pointer shadow-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-white shadow-sm transition cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Salvar Ordem</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
