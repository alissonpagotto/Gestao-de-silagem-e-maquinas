import React, { useState, useEffect } from 'react';
import { 
  X, 
  CircleDot, 
  Check, 
  ShieldCheck, 
  AlertTriangle, 
  Gauge, 
  Calendar,
  Layers,
  Info
} from 'lucide-react';
import { TireItem } from '../../types';
import { getPositionReadableLabel, getTireCondition } from '../../lib/tireAndAxlePresets';

interface TireInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tire: TireItem | null;
  vehiclePlate: string;
  onSaveTire: (updatedTire: TireItem) => void;
}

export const TireInspectionModal: React.FC<TireInspectionModalProps> = ({
  isOpen,
  onClose,
  tire,
  vehiclePlate,
  onSaveTire,
}) => {
  const [fireNumber, setFireNumber] = useState(tire?.fireNumber || '');
  const [brand, setBrand] = useState(tire?.brand || '');
  const [model, setModel] = useState(tire?.model || '');
  const [size, setSize] = useState(tire?.size || '295/80 R22.5');
  const [treadDepthMm, setTreadDepthMm] = useState<string>(String(tire?.treadDepthMm || 12));
  const [originalTreadDepthMm, setOriginalTreadDepthMm] = useState<string>(String(tire?.originalTreadDepthMm || 18));
  const [pressurePsi, setPressurePsi] = useState<string>(String(tire?.pressurePsi || 110));
  const [status, setStatus] = useState<TireItem['status']>(tire?.status || 'em_uso');
  const [retreadCount, setRetreadCount] = useState<number>(tire?.retreadCount || 0);
  const [notes, setNotes] = useState(tire?.notes || '');

  useEffect(() => {
    if (tire) {
      setFireNumber(tire.fireNumber || '');
      setBrand(tire.brand || '');
      setModel(tire.model || '');
      setSize(tire.size || '295/80 R22.5');
      setTreadDepthMm(String(tire.treadDepthMm || 12));
      setOriginalTreadDepthMm(String(tire.originalTreadDepthMm || 18));
      setPressurePsi(String(tire.pressurePsi || 110));
      setStatus(tire.status || 'em_uso');
      setRetreadCount(tire.retreadCount || 0);
      setNotes(tire.notes || '');
    }
  }, [tire]);

  const numTread = parseFloat(treadDepthMm) || 0;
  const condition = getTireCondition(numTread);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: TireItem = {
      ...tire,
      fireNumber: fireNumber.trim(),
      brand: brand.trim(),
      model: model.trim(),
      size: size.trim(),
      treadDepthMm: numTread,
      originalTreadDepthMm: parseFloat(originalTreadDepthMm) || 18,
      pressurePsi: parseFloat(pressurePsi) || 110,
      status,
      retreadCount,
      notes: notes.trim(),
    };
    onSaveTire(updated);
    onClose();
  };

  if (!isOpen || !tire) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <CircleDot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                  Pneu: {getPositionReadableLabel(tire.position)}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
                  {vehiclePlate}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Posição: <strong className="text-sky-600 dark:text-sky-400">{tire.position}</strong> • Código: {fireNumber || 'Sem código'}
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Card de Diagnóstico do Sulco Atual */}
          <div className={`p-3.5 rounded-xl border ${condition.badgeBg} ${condition.borderClass} flex items-center justify-between`}>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Diagnóstico de Desgaste
              </span>
              <div className={`text-base font-black ${condition.badgeText} flex items-center space-x-1.5`}>
                <span>{condition.label}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black font-['Outfit'] text-stone-900 dark:text-stone-100">
                {numTread.toFixed(1)} <span className="text-xs font-bold text-stone-500">mm</span>
              </div>
              <span className="text-[10px] text-stone-500">Limite TWI: 1.6 mm</span>
            </div>
          </div>

          {/* Dados do Pneu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Código de Fogo / Matrícula *
              </label>
              <input
                type="text"
                value={fireNumber}
                onChange={(e) => setFireNumber(e.target.value)}
                placeholder="Ex: P-102, F-4089"
                required
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Marca do Pneu *
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex: Michelin, Pirelli, Goodyear"
                required
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Modelo / Desenho
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: X Multi Z, M729, TM900"
                className="w-full px-3 py-2 text-xs font-normal rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Medida / Aro
              </label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="Ex: 295/80 R22.5, 710/70 R38"
                className="w-full px-3 py-2 text-xs font-normal rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Medições Técnicas: Sulco, Sulco Original e Calibragem */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-stone-600 dark:text-stone-400 mb-1">
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
                className="w-full px-2.5 py-1.5 text-xs font-black rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-stone-600 dark:text-stone-400 mb-1">
                Sulco Novo (mm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={originalTreadDepthMm}
                onChange={(e) => setOriginalTreadDepthMm(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-stone-600 dark:text-stone-400 mb-1">
                Pressão (PSI)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="200"
                value={pressurePsi}
                onChange={(e) => setPressurePsi(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Ciclo de Vida & Recapagem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Ciclo / Vida do Pneu
              </label>
              <select
                value={retreadCount}
                onChange={(e) => setRetreadCount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={0}>Original / Novo (0 Recapagens)</option>
                <option value={1}>1ª Recapagem / Reforma (R1)</option>
                <option value={2}>2ª Recapagem / Reforma (R2)</option>
                <option value={3}>3ª Recapagem / Reforma (R3)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Status Atual
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="em_uso">Montado no Veículo (Em Uso)</option>
                <option value="estepe">Estepe / Reserva</option>
                <option value="reforma">Enviado para Recapagem / Reforma</option>
                <option value="descartado">Descartado / Sucata</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Observações &amp; Histórico do Pneu
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex: Pneu sem vulcanizações, calibrado semanalmente..."
              className="w-full px-3 py-2 text-xs font-normal rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Dados do Pneu</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
