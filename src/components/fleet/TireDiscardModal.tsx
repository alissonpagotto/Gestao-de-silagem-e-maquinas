import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Check } from 'lucide-react';
import { TireItem } from '../../types';
import { getPositionReadableLabel } from '../../lib/tireAndAxlePresets';

interface TireDiscardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tire: TireItem | null;
  fromSource: 'vehicle' | 'inventory';
  vehiclePlate?: string;
  onConfirmDiscard: (tire: TireItem, reason: string, notes: string) => void;
}

export const TireDiscardModal: React.FC<TireDiscardModalProps> = ({
  isOpen,
  onClose,
  tire,
  fromSource,
  vehiclePlate,
  onConfirmDiscard,
}) => {
  const [reason, setReason] = useState<string>('Fim de vida útil / TWI atingido');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');

  const commonReasons = [
    'Fim de vida útil / TWI atingido',
    'Rasgo lateral / Corte na carcaça',
    'Bolha / Separação de lonas',
    'Desgaste irregular acentuado / Deformação',
    'Carcaça rejeitada para recapagem',
    'Dano por impacto / Acidente',
    'Outro motivo',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = reason === 'Outro motivo' ? (customReason.trim() || 'Descarte sem motivo especificado') : reason;
    onConfirmDiscard(tire, finalReason, notes);
    onClose();
  };

  if (!isOpen || !tire) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden">
        
        {/* Header com destaque vermelho */}
        <div className="px-5 py-4 border-b border-rose-100 dark:border-rose-950/50 bg-rose-50/80 dark:bg-rose-950/30 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-rose-950 dark:text-rose-100 font-['Outfit']">
                Confirmar Descarte de Pneu
              </h3>
              <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                Baixa definitiva do pneu no sistema
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

        {/* Resumo do Pneu */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-stone-900 dark:text-stone-100">
                {tire.fireNumber || 'Pneu'} • {tire.brand} {tire.model || ''}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                Sulco: {tire.treadDepthMm.toFixed(1)} mm
              </span>
            </div>
            
            <div className="text-[11px] text-stone-500 dark:text-stone-400 flex justify-between">
              <span>Origem:</span>
              <span className="font-semibold text-stone-700 dark:text-stone-300">
                {fromSource === 'vehicle' 
                  ? `Veículo ${vehiclePlate || ''} (${getPositionReadableLabel(tire.position)})`
                  : 'Estoque de Pneus'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
              Motivo do Descarte *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            >
              {commonReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === 'Outro motivo' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                Especifique o Motivo *
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Descreva o motivo da baixa..."
                required
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
              Observações Adicionais (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Laudo da borracharia, autorização do encarregado de frotas..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Ao confirmar, a posição no veículo ficará <strong>+ Vazio</strong> e o pneu será movido para o histórico de baixas.
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
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Confirmar Baixa &amp; Descarte</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
