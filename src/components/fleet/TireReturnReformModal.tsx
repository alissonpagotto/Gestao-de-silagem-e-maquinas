import React, { useState } from 'react';
import { RotateCcw, Check, X, ShieldCheck } from 'lucide-react';
import { TireItem } from '../../types';

interface TireReturnReformModalProps {
  isOpen: boolean;
  onClose: () => void;
  tire: TireItem | null;
  onConfirmReturn: (tire: TireItem, newTreadMm: number, retreadIncrement: number, cost?: number, notes?: string) => void;
}

export const TireReturnReformModal: React.FC<TireReturnReformModalProps> = ({
  isOpen,
  onClose,
  tire,
  onConfirmReturn,
}) => {
  const [newTreadMm, setNewTreadMm] = useState<string>('15.0');
  const [cost, setCost] = useState<string>(tire?.reformCost ? String(tire.reformCost) : '');
  const [workshop, setWorkshop] = useState<string>(tire?.reformWorkshop || '');
  const [notes, setNotes] = useState<string>('Retorno de recapagem em perfeito estado de carcaça e banda nova.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tire) return;
    onConfirmReturn(
      tire,
      parseFloat(newTreadMm) || 15.0,
      1, // increment retread count by 1
      parseFloat(cost) || undefined,
      notes
    );
    onClose();
  };

  if (!isOpen || !tire) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-100 dark:border-emerald-950/50 bg-emerald-50/80 dark:bg-emerald-950/30 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-100 font-['Outfit']">
                Pneu Pronto da Reforma (Recape)
              </h3>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                Retornar pneu recapado para o Estoque Disponível
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-stone-900 dark:text-stone-100">
                {tire.fireNumber || 'Pneu'} • {tire.brand} {tire.model || ''}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {(tire.retreadCount || 0) + 1}ª Recapagem
              </span>
            </div>
            {workshop && (
              <p className="text-[11px] text-stone-500">
                Oficina: <strong>{workshop}</strong>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Novo Sulco Após Recape (mm) *
              </label>
              <input
                type="number"
                step="0.1"
                min="5"
                max="25"
                value={newTreadMm}
                onChange={(e) => setNewTreadMm(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-black text-emerald-600 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Custo do Recape (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
              Observações do Retorno
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              O pneu será adicionado à lista de <strong>Pneus Disponíveis (Estoque)</strong> com novo sulco pronto para rodar.
            </span>
          </div>

          {/* Ações */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Concluir e Voltar ao Estoque</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
