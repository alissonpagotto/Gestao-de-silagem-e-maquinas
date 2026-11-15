import React, { useState } from 'react';
import { Plus, X, CircleDot, Check } from 'lucide-react';
import { TireItem } from '../../types';

interface NewInventoryTireModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newTire: TireItem) => void;
}

export const NewInventoryTireModal: React.FC<NewInventoryTireModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [fireNumber, setFireNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [size, setSize] = useState('');
  const [treadDepthMm, setTreadDepthMm] = useState('');
  const [originalTreadDepthMm, setOriginalTreadDepthMm] = useState('');
  const [pressurePsi, setPressurePsi] = useState('');
  const [retreadCount, setRetreadCount] = useState<number>(0);
  const [currentKm, setCurrentKm] = useState<string>('');
  const [notes, setNotes] = useState('');

  const brandOptions = [
    'Michelin',
    'Pirelli',
    'Bridgestone',
    'Goodyear',
    'Firestone',
    'Continental',
    'Dunlop',
    'Trelleborg',
    'Alliance',
    'Outro',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fireNumber.trim()) return;

    const newTire: TireItem = {
      id: `tire_inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      position: 'estoque',
      positionName: 'Estoque / Disponível',
      fireNumber: fireNumber.trim(),
      brand,
      model: model.trim() || undefined,
      size: size.trim(),
      treadDepthMm: parseFloat(treadDepthMm) || 12.0,
      originalTreadDepthMm: parseFloat(originalTreadDepthMm) || 18.0,
      pressurePsi: parseFloat(pressurePsi) || 110,
      status: 'estoque',
      retreadCount,
      currentKm: parseFloat(currentKm) || 0,
      notes: notes.trim() || undefined,
    };

    onSave(newTire);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-[#cad4e6] rounded-xl w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] border border-black shadow-2xl overflow-hidden flex flex-col justify-between mx-auto my-auto">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-black bg-[#cad4e6] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-black text-black flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-black font-['Outfit']">
                Cadastrar Pneu no Estoque
              </h3>
              <p className="text-[11px] text-slate-800 font-semibold">
                Pneu disponível para montagem e rodízio
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Nº de Fogo / Matrícula *
                  </label>
                  <input
                    type="text"
                    value={fireNumber}
                    onChange={(e) => setFireNumber(e.target.value)}
                    placeholder="Ex: #0920 ou P-115"
                    required
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Marca *
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="">Selecione a Marca...</option>
                    {brandOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Modelo da Banda
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ex: X Multi Z / KMAX"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Medida / Dimensão
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="Ex: 295/80 R22.5"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Sulco Atual (mm) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="30"
                    value={treadDepthMm}
                    onChange={(e) => setTreadDepthMm(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs font-black text-black rounded-xl border border-gray-400 bg-white outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Recapagens
                  </label>
                  <select
                    value={retreadCount}
                    onChange={(e) => setRetreadCount(parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs font-semibold rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value={0}>0 (Novo)</option>
                    <option value={1}>1ª Recap.</option>
                    <option value={2}>2ª Recap.</option>
                    <option value={3}>3ª Recap.</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-black mb-1">
                    Pressão (PSI)
                  </label>
                  <input
                    type="number"
                    value={pressurePsi}
                    onChange={(e) => setPressurePsi(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  KM Rodado Estimado
                </label>
                <input
                  type="number"
                  value={currentKm}
                  onChange={(e) => setCurrentKm(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Observações
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Pneu reserva recebido da colheitadeira, recém inspecionado..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-400 bg-white text-black outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Botões */}
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
              <span>Salvar no Estoque</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
