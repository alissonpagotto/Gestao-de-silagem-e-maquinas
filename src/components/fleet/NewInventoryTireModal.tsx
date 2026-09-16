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
  const [brand, setBrand] = useState('Michelin');
  const [model, setModel] = useState('');
  const [size, setSize] = useState('295/80 R22.5');
  const [treadDepthMm, setTreadDepthMm] = useState('14.0');
  const [originalTreadDepthMm, setOriginalTreadDepthMm] = useState('18.0');
  const [pressurePsi, setPressurePsi] = useState('110');
  const [retreadCount, setRetreadCount] = useState<number>(0);
  const [currentKm, setCurrentKm] = useState<string>('0');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                Cadastrar Pneu no Estoque
              </h3>
              <p className="text-[11px] text-stone-500">
                Pneu disponível para montagem e rodízio
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

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Nº de Fogo / Matrícula *
              </label>
              <input
                type="text"
                value={fireNumber}
                onChange={(e) => setFireNumber(e.target.value)}
                placeholder="Ex: #0920 ou P-115"
                required
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Marca *
              </label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              >
                {brandOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Modelo da Banda
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: X Multi Z / KMAX"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Medida / Dimensão
              </label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="Ex: 295/80 R22.5"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
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
                className="w-full px-2.5 py-1.5 text-xs font-black text-sky-700 dark:text-sky-400 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Recapagens
              </label>
              <select
                value={retreadCount}
                onChange={(e) => setRetreadCount(parseInt(e.target.value) || 0)}
                className="w-full px-2 py-1.5 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={0}>0 (Novo)</option>
                <option value={1}>1ª Recap.</option>
                <option value={2}>2ª Recap.</option>
                <option value={3}>3ª Recap.</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Pressão (PSI)
              </label>
              <input
                type="number"
                value={pressurePsi}
                onChange={(e) => setPressurePsi(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              KM Rodado Estimado
            </label>
            <input
              type="number"
              value={currentKm}
              onChange={(e) => setCurrentKm(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Pneu reserva recebido da colheitadeira, recém inspecionado..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Botões */}
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
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition cursor-pointer"
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
