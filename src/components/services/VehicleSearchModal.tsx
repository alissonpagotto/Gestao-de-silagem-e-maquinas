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
    const term = String(searchTerm ?? '').trim().toLowerCase();
    return allAvailableVehicles.filter(v => {
      // Categoria
      if (selectedCategory === 'forrageira' && !isForrageira(v)) return false;
      if (selectedCategory === 'trator' && !isTrator(v)) return false;
      if (selectedCategory === 'caminhao' && !isCaminhao(v)) return false;

      if (!term) return true;

      const name = String(v.name ?? '').toLowerCase();
      const prefix = String(v.fleetNumber ?? '').toLowerCase();
      const plate = String((v.licensePlateOrSerial || v.serialNumber) ?? '').toLowerCase();
      const model = String(v.model ?? '').toLowerCase();
      const brand = String(v.brand ?? '').toLowerCase();

      return name.includes(term) || prefix.includes(term) || plate.includes(term) || model.includes(term) || brand.includes(term);
    });
  }, [allAvailableVehicles, searchTerm, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-2 sm:p-4">
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden text-black animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-black bg-[#cad4e6] text-black shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#e0e6f1] text-black flex items-center justify-center border border-black shadow-2xs shrink-0">
              <ForageHarvesterIcon className="w-5 h-4 text-black" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black flex items-center gap-2">
                <span>VINCULAR VEÍCULO DA FROTA</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white text-black font-bold border border-black shadow-2xs">
                  {columnName}
                </span>
              </h3>
              <p className="text-[11px] text-slate-800 font-medium mt-0.5">
                Selecione a máquina principal que operará nesta coluna da agenda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-[#e0e6f1] border border-transparent hover:border-black transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Barra de Busca e Filtros de Categoria */}
        <div className="p-3.5 sm:p-4 bg-[#e0e6f1] border-b border-black space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por prefixo (ex: FORR 05), modelo, placa ou nome..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-black rounded-lg text-xs font-semibold text-black placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-black"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-black cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('todas')}
              className={`px-3 py-1 text-xs rounded-lg transition cursor-pointer ${
                selectedCategory === 'todas'
                  ? 'bg-white text-black font-bold border border-black shadow-2xs'
                  : 'bg-[#cad4e6] border border-black/40 text-black hover:bg-white/70 font-semibold'
              }`}
            >
              Todas ({allAvailableVehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('forrageira')}
              className={`px-3 py-1 text-xs rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'forrageira'
                  ? 'bg-white text-black font-bold border border-black shadow-2xs'
                  : 'bg-[#cad4e6] border border-black/40 text-black hover:bg-white/70 font-semibold'
              }`}
            >
              <Scissors className="w-3 h-3 text-black" />
              <span>Forrageiras / Ensiladeiras</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('trator')}
              className={`px-3 py-1 text-xs rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'trator'
                  ? 'bg-white text-black font-bold border border-black shadow-2xs'
                  : 'bg-[#cad4e6] border border-black/40 text-black hover:bg-white/70 font-semibold'
              }`}
            >
              <Tractor className="w-3 h-3 text-black" />
              <span>Tratores</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('caminhao')}
              className={`px-3 py-1 text-xs rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'caminhao'
                  ? 'bg-white text-black font-bold border border-black shadow-2xs'
                  : 'bg-[#cad4e6] border border-black/40 text-black hover:bg-white/70 font-semibold'
              }`}
            >
              <Truck className="w-3 h-3 text-black" />
              <span>Caminhões</span>
            </button>
          </div>
        </div>

        {/* Lista de Veículos para Seleção */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 bg-[#cad4e6]">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-10 text-xs text-black bg-[#e0e6f1] border border-black rounded-xl space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-700 mx-auto" />
              <p className="font-bold">Nenhum veículo encontrado com esse filtro.</p>
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
                      ? 'border-black bg-white ring-2 ring-emerald-600/40 shadow-sm'
                      : 'border-black bg-[#e0e6f1] hover:bg-white shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg border border-black shrink-0 ${
                      isForr 
                        ? 'bg-emerald-100 text-emerald-900'
                        : isTrat
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-blue-100 text-blue-900'
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
                        <span className="font-black text-xs sm:text-sm text-black truncate">
                          {veh.fleetNumber ? `[${veh.fleetNumber}] ` : ''}{veh.name}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white border border-emerald-800">
                            Vinculado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-800 flex-wrap font-medium">
                        {veh.model && <span>{veh.model}</span>}
                        {veh.licensePlateOrSerial && (
                          <span className="font-mono font-bold bg-white border border-black/40 px-1.5 py-0.5 rounded text-black">
                            Placa/Série: {veh.licensePlateOrSerial}
                          </span>
                        )}
                        <span className="capitalize">{veh.categoryType || 'Equipamento'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-800'
                        : 'bg-white hover:bg-emerald-600 hover:text-white text-black border-black'
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
        <div className="px-5 py-3 bg-[#cad4e6] border-t border-black flex items-center justify-between text-xs text-black shrink-0">
          <span className="font-bold">{filteredVehicles.length} veículos listados</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black hover:bg-gray-100 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
