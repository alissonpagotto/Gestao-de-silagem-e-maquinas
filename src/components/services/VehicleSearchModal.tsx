import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Check, 
  Truck, 
  Scissors, 
  Tractor, 
  Tag,
  AlertCircle
} from 'lucide-react';
import { Machinery } from '../../types';
import { ForageHarvesterIcon } from '../fleet/ForageHarvesterIcon';
import { isForrageira, isCaminhao, isTrator, formatMachineryOptionLabel } from './serviceHelpers';

interface VehicleSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnName: string;
  currentMachineryId?: string;
  machineries: Machinery[];
  onSelectVehicle: (vehicle: { id: string; name: string; prefix?: string }) => void;
}

export const VehicleSearchModal: React.FC<VehicleSearchModalProps> = ({
  isOpen,
  onClose,
  columnName,
  currentMachineryId,
  machineries = [],
  onSelectVehicle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'todas' | 'forrageira' | 'trator' | 'caminhao'>('todas');

  // Lista real de veículos cadastrados na frota do assinante
  const allAvailableVehicles = useMemo(() => {
    return [...machineries];
  }, [machineries]);

  // Filtragem por busca e categoria
  const filteredVehicles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allAvailableVehicles.filter(v => {
      // Categoria
      if (selectedCategory === 'forrageira' && !isForrageira(v)) return false;
      if (selectedCategory === 'trator' && !isTrator(v)) return false;
      if (selectedCategory === 'caminhao' && !isCaminhao(v)) return false;

      if (!term) return true;

      const name = (v.name || '').toLowerCase();
      const prefix = (v.fleetNumber || '').toLowerCase();
      const plate = (v.licensePlateOrSerial || v.serialNumber || '').toLowerCase();
      const model = (v.model || '').toLowerCase();
      const brand = (v.brand || '').toLowerCase();

      return name.includes(term) || prefix.includes(term) || plate.includes(term) || model.includes(term) || brand.includes(term);
    });
  }, [allAvailableVehicles, searchTerm, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        
        {/* Cabeçalho do Modal - Moldura Metálica 3D Acetinada */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-b border-slate-400 dark:border-stone-700 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 text-slate-800 dark:text-stone-200 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
              <ForageHarvesterIcon className="w-5 h-4 text-slate-700 dark:text-stone-200" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 flex items-center gap-2">
                <span>VINCULAR VEÍCULO DA FROTA</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/90 dark:bg-stone-800 text-slate-800 dark:text-stone-100 font-bold border border-slate-400 dark:border-stone-600 shadow-2xs">
                  {columnName}
                </span>
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium mt-0.5">
                Selecione a máquina principal que operará nesta coluna da agenda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        {/* Barra de Busca e Filtros de Categoria */}
        <div className="p-3.5 bg-slate-50 dark:bg-stone-800/40 border-b border-slate-300 dark:border-stone-800 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por prefixo (ex: FORR 05), modelo, placa ou nome..."
              className="w-full pl-9 pr-8 py-1.5 sm:py-2 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-slate-500"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('todas')}
              className={`px-2.5 py-1 text-xs rounded-lg transition cursor-pointer ${
                selectedCategory === 'todas'
                  ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                  : 'bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 font-semibold'
              }`}
            >
              Todas ({allAvailableVehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('forrageira')}
              className={`px-2.5 py-1 text-xs rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'forrageira'
                  ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                  : 'bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 font-semibold'
              }`}
            >
              <Scissors className="w-3 h-3 text-slate-600" />
              <span>Forrageiras / Ensiladeiras</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('trator')}
              className={`px-2.5 py-1 text-xs rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'trator'
                  ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                  : 'bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 font-semibold'
              }`}
            >
              <Tractor className="w-3 h-3 text-slate-600" />
              <span>Tratores</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('caminhao')}
              className={`px-2.5 py-1 text-xs rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'caminhao'
                  ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                  : 'bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 font-semibold'
              }`}
            >
              <Truck className="w-3 h-3 text-slate-600" />
              <span>Caminhões</span>
            </button>
          </div>
        </div>

        {/* Lista de Veículos para Seleção */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-10 text-xs text-stone-500 space-y-2">
              <AlertCircle className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="font-semibold">Nenhum veículo encontrado com esse filtro.</p>
            </div>
          ) : (
            filteredVehicles.map(veh => {
              const isSelected = currentMachineryId === veh.id;
              const isForr = isForrageira(veh);
              const isTrat = isTrator(veh);

              return (
                <div
                  key={veh.id}
                  onClick={() => {
                    onSelectVehicle({
                      id: veh.id,
                      name: veh.name,
                      prefix: veh.fleetNumber || veh.name,
                    });
                    onClose();
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-[#2e65aa] bg-blue-50/70 dark:bg-blue-950/30 ring-2 ring-[#2e65aa]/30'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isForr 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : isTrat
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {isForr ? (
                        <ForageHarvesterIcon className="w-6 h-5" />
                      ) : isTrat ? (
                        <Tractor className="w-5 h-5" />
                      ) : (
                        <Truck className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
                          {veh.fleetNumber ? `[${veh.fleetNumber}] ` : ''}{veh.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#2e65aa] text-white">
                            Vinculado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500 dark:text-stone-400 flex-wrap">
                        {veh.model && <span>{veh.model}</span>}
                        {veh.licensePlateOrSerial && (
                          <span className="font-mono font-bold bg-stone-100 dark:bg-stone-800 px-1.5 py-0.2 rounded text-stone-700 dark:text-stone-300">
                            Placa/Série: {veh.licensePlateOrSerial}
                          </span>
                        )}
                        <span className="capitalize">{veh.categoryType || 'Equipamento'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs font-black shrink-0 transition ${
                      isSelected
                        ? 'bg-[#2e65aa] text-white'
                        : 'bg-stone-100 hover:bg-[#2e65aa] hover:text-white text-stone-800 dark:bg-stone-800 dark:text-stone-200'
                    }`}
                  >
                    {isSelected ? 'Selecionado' : 'Selecionar'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800/80 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
          <span>{filteredVehicles.length} veículos listados</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-50 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
