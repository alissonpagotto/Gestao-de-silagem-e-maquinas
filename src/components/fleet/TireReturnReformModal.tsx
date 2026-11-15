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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-[#cad4e6] rounded-xl w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] border border-black shadow-2xl overflow-hidden flex flex-col justify-between mx-auto my-auto">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-black bg-[#cad4e6] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-black text-emerald-700 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-black font-['Outfit']">
                Pneu Pronto da Reforma (Recape)
              </h3>
              <p className="text-[11px] text-slate-800 font-semibold">
                Retornar pneu recapado para o Estoque Disponível
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-white/60 border border-transparent hover:border-black transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#cad4e6]">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
            <div className="max-w-3xl mx-auto bg-[#e0e6f1] border border-black rounded-xl p-4 sm:p-5 space-y-4">
              <div className="p-3 rounded-xl bg-white border border-black space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-black">
                    {tire.fireNumber || 'Pneu'} • {tire.brand} {tire.model || ''}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-400">
                    {(tire.retreadCount || 0) + 1}ª Recapagem
                  </span>
                </div>
                {workshop && (
                  <p className="text-[11px] text-slate-700">
                    Oficina: <strong className="text-black">{workshop}</strong>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
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
                    className="w-full px-3 py-2 text-xs font-black text-emerald-700 rounded-xl border border-gray-400 bg-white outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Custo do Recape (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-black">
                  Observações do Retorno
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-400 text-[11px] text-emerald-950 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  O pneu será adicionado à lista de <strong>Pneus Disponíveis (Estoque)</strong> com novo sulco pronto para rodar.
                </span>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="px-5 py-3 flex items-center justify-end space-x-2 border-t border-black bg-[#cad4e6] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-black bg-white text-black hover:bg-gray-100 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 shadow-xs transition cursor-pointer"
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
