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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-[#cad4e6] rounded-xl w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] border border-black shadow-2xl overflow-hidden flex flex-col justify-between mx-auto my-auto">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-black bg-[#cad4e6] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-black text-rose-700 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-black font-['Outfit']">
                Confirmar Descarte de Pneu
              </h3>
              <p className="text-[11px] text-slate-800 font-semibold">
                Baixa definitiva do pneu no sistema
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

        {/* Resumo do Pneu */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#cad4e6]">
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
            <div className="max-w-3xl mx-auto bg-[#e0e6f1] border border-black rounded-xl p-4 sm:p-5 space-y-4">
              <div className="p-3 rounded-xl bg-white border border-black space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-black">
                    {tire.fireNumber || 'Pneu'} • {tire.brand} {tire.model || ''}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 border border-rose-300 text-rose-900">
                    Sulco: {tire.treadDepthMm.toFixed(1)} mm
                  </span>
                </div>
                
                <div className="text-[11px] text-slate-700 flex justify-between">
                  <span>Origem:</span>
                  <span className="font-semibold text-black">
                    {fromSource === 'vehicle' 
                      ? `Veículo ${vehiclePlate || ''} (${getPositionReadableLabel(tire.position)})`
                      : 'Estoque de Pneus'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-black">
                  Motivo do Descarte *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-rose-600"
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
                  <label className="block text-xs font-bold text-black">
                    Especifique o Motivo *
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Descreva o motivo da baixa..."
                    required
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-rose-600"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-black">
                  Observações Adicionais (Opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Laudo da borracharia, autorização do encarregado de frotas..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-rose-600 resize-none"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-400 text-[11px] text-amber-950 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Ao confirmar, a posição no veículo ficará <strong>+ Vazio</strong> e o pneu será movido para o histórico de baixas.
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
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-800 shadow-xs transition cursor-pointer"
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
