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

  // Garante que há uma lista de opções de frota mesmo se machineries estiver com poucos dados cadastrados
  const allAvailableVehicles = useMemo(() => {
    const list: Machinery[] = [...machineries];

    // Se a frota estiver vazia ou não tiver os modelos padrão, mescla sugestões conhecidas do CRM
    const defaultSuggestions: Machinery[] = [
      {
        id: 'veh_forr_05_2023',
        name: 'Claas Jaguar 870',
        fleetNumber: 'FORR 05',
        model: 'Claas Jaguar 870',
        brand: 'Claas',
        year: 2023,
        licensePlateOrSerial: 'CLAAS-870-05',
        categoryType: 'Forrageira',
        status: 'disponivel',
      },
      {
        id: 'veh_colh_02_2022',
        name: 'Claas Jaguar 860',
        fleetNumber: 'COLH 02',
        model: 'Claas Jaguar 860',
        brand: 'Claas',
        year: 2022,
        licensePlateOrSerial: 'CLAAS-860-02',
        categoryType: 'Forrageira',
        status: 'disponivel',
      },
      {
        id: 'veh_trator_jd_6110',
        name: 'John Deere 6110J + JF C120',
        fleetNumber: 'TRAT 01',
        model: 'JD 6110J + Ensiladeira JF C120',
        brand: 'John Deere',
        year: 2021,
        licensePlateOrSerial: 'TRAT-6110-01',
        categoryType: 'Trator',
        status: 'disponivel',
      },
      {
        id: 'veh_evd_2j61',
        name: 'Mercedes-Benz 2726 Basculante',
        fleetNumber: 'CAM 04',
        model: 'MB 2726 6x4 Silagem',
        brand: 'Mercedes-Benz',
        year: 2020,
        licensePlateOrSerial: 'EVD-2J61',
        categoryType: 'Caminhão',
        status: 'disponivel',
      },
      {
        id: 'veh_forr_krone_8500',
        name: 'Krone Big X 850',
        fleetNumber: 'FORR 03',
        model: 'Big X 850 High Performance',
        brand: 'Krone',
        year: 2024,
        licensePlateOrSerial: 'KRN-8500-03',
        categoryType: 'Forrageira',
        status: 'disponivel',
      },
      {
        id: 'veh_trator_nh_t7',
        name: 'New Holland T7.240',
        fleetNumber: 'TRAT 02',
        model: 'T7.240 Heavy Duty',
        brand: 'New Holland',
        year: 2022,
        licensePlateOrSerial: 'NHT-7240-02',
        categoryType: 'Trator',
        status: 'disponivel',
      }
    ];

    defaultSuggestions.forEach(sug => {
      if (!list.some(m => m.id === sug.id || (m.licensePlateOrSerial && m.licensePlateOrSerial === sug.licensePlateOrSerial))) {
        list.push(sug);
      }
    });

    return list;
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
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#2e65aa] text-white border-b border-blue-700">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/15 rounded-lg">
              <ForageHarvesterIcon className="w-6 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                <span>Vincular Veículo da Frota</span>
                <span className="text-xs px-2 py-0.5 rounded bg-white/20 text-white font-mono">
                  {columnName}
                </span>
              </h3>
              <p className="text-[11px] text-blue-100">
                Selecione a máquina principal que operará nesta coluna da agenda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Busca e Filtros de Categoria */}
        <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 border-b border-stone-200 dark:border-stone-800 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por prefixo (ex: FORR 05), modelo, placa ou nome..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#2e65aa]"
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
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                selectedCategory === 'todas'
                  ? 'bg-[#2e65aa] text-white shadow-2xs'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
            >
              Todas ({allAvailableVehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('forrageira')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'forrageira'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <Scissors className="w-3 h-3" />
              <span>Forrageiras / Ensiladeiras</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('trator')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'trator'
                  ? 'bg-amber-700 text-white shadow-2xs'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50'
              }`}
            >
              <Tractor className="w-3 h-3" />
              <span>Tratores</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('caminhao')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${
                selectedCategory === 'caminhao'
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-blue-800 dark:text-blue-300 hover:bg-blue-50'
              }`}
            >
              <Truck className="w-3 h-3" />
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
