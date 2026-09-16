import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  Check, 
  Tractor, 
  Truck, 
  Wrench, 
  AlertCircle,
  Tag,
  ShieldCheck,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Machinery } from '../../types';
import { HarvesterSilhouetteIcon } from './HarvesterSilhouetteIcon';

interface ColumnInfo {
  id: string;
  name: string;
  machineryId?: string;
  machineryName?: string;
  frontNumber?: number;
  headerBgColor?: string;
}

interface SelectColumnMachineryModalProps {
  isOpen: boolean;
  onClose: () => void;
  column: ColumnInfo | null;
  machineries: Machinery[];
  onSelectMachinery: (columnId: string, machinery: Machinery, customColumnName?: string) => void;
}

export const SelectColumnMachineryModal: React.FC<SelectColumnMachineryModalProps> = ({
  isOpen,
  onClose,
  column,
  machineries = [],
  onSelectMachinery,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(column?.machineryId || null);
  const [customName, setCustomName] = useState(column?.name || '');

  // Sincronizar quando a coluna mudar
  React.useEffect(() => {
    if (column) {
      setSelectedMachineId(column.machineryId || null);
      setCustomName(column.name || '');
      setSearchTerm('');
      setCategoryFilter('todos');
    }
  }, [column]);

  // Lista de Categorias dinâmicas
  const categories = useMemo(() => {
    const set = new Set<string>();
    machineries.forEach(m => {
      if (m.categoryType) set.add(m.categoryType);
    });
    return ['todos', ...Array.from(set)];
  }, [machineries]);

  // Filtragem de Máquinas
  const filteredMachineries = useMemo(() => {
    return machineries.filter(m => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        m.name?.toLowerCase().includes(term) ||
        m.model?.toLowerCase().includes(term) ||
        m.brand?.toLowerCase().includes(term) ||
        m.fleetNumber?.toLowerCase().includes(term) ||
        m.licensePlateOrSerial?.toLowerCase().includes(term) ||
        m.operatorOrDriver?.toLowerCase().includes(term);

      const matchCategory =
        categoryFilter === 'todos' ||
        m.categoryType?.toLowerCase() === categoryFilter.toLowerCase();

      return matchSearch && matchCategory;
    });
  }, [machineries, searchTerm, categoryFilter]);

  if (!isOpen || !column) return null;

  const handleConfirm = (machine: Machinery) => {
    onSelectMachinery(column.id, machine, customName.trim() || column.name);
    onClose();
  };

  const getVehicleIcon = (category?: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('ensiladeira') || cat.includes('forrageira') || cat.includes('colhedora')) {
      return <HarvesterSilhouetteIcon className="w-5 h-5 text-stone-900 dark:text-stone-100" />;
    }
    if (cat.includes('trator')) {
      return <Tractor className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />;
    }
    if (cat.includes('caminhão') || cat.includes('caminhao')) {
      return <Truck className="w-5 h-5 text-blue-700 dark:text-blue-400" />;
    }
    return <HarvesterSilhouetteIcon className="w-5 h-5 text-stone-800 dark:text-stone-200" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-800/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-black text-white dark:bg-stone-100 dark:text-black shadow-xs">
              <HarvesterSilhouetteIcon className="w-6 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                  Definir Máquina da Frente #{column.frontNumber || 1}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  {column.name}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Selecione o veículo cadastrado em <strong className="text-stone-700 dark:text-stone-300">Gestão de Frotas &gt; Veículos</strong> para liderar esta coluna.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Busca e Filtros */}
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 space-y-2.5 bg-white dark:bg-stone-900">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por prefixo, modelo, marca, placa ou operador..."
              className="w-full pl-9 pr-8 py-2 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#2e65aa]"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtros rápidos de categoria */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-stone-400 uppercase mr-1">Filtrar:</span>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-[#2e65aa] text-white shadow-2xs'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                }`}
              >
                {cat === 'todos' ? 'Todos os Veículos' : cat}
              </button>
            ))}
          </div>

          {/* Nome da Coluna (Editável opcionalmente) */}
          <div className="flex items-center gap-2 pt-1 border-t border-stone-100 dark:border-stone-800">
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 shrink-0">
              Nome de Exibição da Coluna:
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ex: Maq 02"
              className="flex-1 max-w-[200px] px-2.5 py-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100"
            />
            <span className="text-[10px] text-stone-400 italic">
              (identificador exibido no topo da frente)
            </span>
          </div>
        </div>

        {/* Lista de Máquinas */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredMachineries.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">Nenhum veículo encontrado com esse filtro.</p>
              <p className="text-[11px] mt-1">Verifique o termo de busca ou cadastre novas máquinas em Frotas.</p>
            </div>
          ) : (
            filteredMachineries.map((m) => {
              const isCurrent = column.machineryId === m.id;
              const isSelected = selectedMachineId === m.id;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMachineId(m.id)}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-[#2e65aa] bg-blue-50/70 dark:bg-blue-950/30 shadow-xs ring-1 ring-[#2e65aa]'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/40 bg-white dark:bg-stone-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 shrink-0 border border-stone-200 dark:border-stone-700">
                      {getVehicleIcon(m.categoryType)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {m.fleetNumber && (
                          <span className="px-1.5 py-0.5 rounded bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-mono text-[10px] font-black">
                            {m.fleetNumber}
                          </span>
                        )}
                        <h4 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100 truncate">
                          {m.name}
                        </h4>
                        {m.licensePlateOrSerial && (
                          <span className="text-[10px] font-bold text-stone-500 font-mono">
                            ({m.licensePlateOrSerial})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-500 dark:text-stone-400 flex-wrap">
                        <span>{m.brand} {m.model}</span>
                        {m.categoryType && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{m.categoryType}</span>
                          </>
                        )}
                        {m.operatorOrDriver && (
                          <>
                            <span>•</span>
                            <span className="text-stone-700 dark:text-stone-300 font-medium">
                              👤 {m.operatorOrDriver}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300">
                        Atual
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirm(m);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#2e65aa] hover:bg-[#25528c] text-white'
                          : 'bg-stone-900 hover:bg-black text-white dark:bg-stone-100 dark:text-stone-900'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Selecionar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-800/50 flex items-center justify-between gap-3">
          <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span>A troca da máquina atualiza os títulos da coluna e o vínculo com frotas.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
