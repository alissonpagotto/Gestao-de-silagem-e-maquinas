import React, { useState, useMemo } from 'react';
import { 
  Tractor, 
  Truck,
  Plus, 
  Wrench, 
  Fuel, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Edit3,
  Search,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  UserCheck,
  DollarSign,
  Car,
  X
} from 'lucide-react';
import { Machinery, Expense } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';

interface MachineryModuleProps {

  machineries: Machinery[];
  expenses: Expense[];
  onSaveMachineries: (machineries: Machinery[]) => void;
  onNewExpenseWithMachine: (machineId: string) => void;
}

export const MachineryModule: React.FC<MachineryModuleProps> = ({
  machineries,
  expenses,
  onSaveMachineries,
  onNewExpenseWithMachine,
}) => {
  const { confirm } = useConfirm();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterType, setFilterType] = useState<string>('todos');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machinery | null>(null);

  // Form states
  const [plate, setPlate] = useState('');
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [brand, setBrand] = useState('');
  const [year, setYear] = useState('');
  const [operator, setOperator] = useState('');
  const [status, setStatus] = useState<'operacional' | 'em_manutencao' | 'parado' | 'disponivel'>('disponivel');
  const [categoryType, setCategoryType] = useState<string>('caminhao');
  const [hourMeter, setHourMeter] = useState('');
  const [avgConsumption, setAvgConsumption] = useState('');

  const openAddModal = () => {
    setEditingMachine(null);
    setPlate('');
    setName('');
    setModel('');
    setBrand('');
    setYear('');
    setOperator('');
    setStatus('disponivel');
    setCategoryType('caminhao');
    setHourMeter('');
    setAvgConsumption('');
    setIsModalOpen(true);
  };

  const openEditModal = (machine: Machinery) => {
    setEditingMachine(machine);
    setPlate(machine.licensePlateOrSerial || '');
    setName(machine.name || '');
    setModel(machine.model || '');
    setBrand(machine.brand || '');
    setYear(machine.year ? String(machine.year) : '');
    setOperator(machine.operatorOrDriver || '');
    setStatus(machine.status || 'disponivel');
    setCategoryType(machine.categoryType || 'caminhao');
    setHourMeter(machine.hourMeter !== undefined ? String(machine.hourMeter) : '');
    setAvgConsumption(machine.averageConsumptionLitersPerHour !== undefined ? String(machine.averageConsumptionLitersPerHour) : '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() && !name.trim()) return;

    const formattedName = name.trim() || model.trim() || plate.trim();
    const formattedBrand = brand.trim() || 'Agrícola';
    const formattedModel = model.trim() || formattedName;

    if (editingMachine) {
      const updated = machineries.map((m) =>
        m.id === editingMachine.id
          ? {
              ...m,
              name: formattedName,
              model: formattedModel,
              brand: formattedBrand,
              year: year ? parseInt(year) : undefined,
              licensePlateOrSerial: plate.trim().toUpperCase(),
              operatorOrDriver: operator.trim() || undefined,
              status: status,
              categoryType: categoryType as any,
              hourMeter: hourMeter ? parseInt(hourMeter) : 0,
              averageConsumptionLitersPerHour: avgConsumption ? parseFloat(avgConsumption) : undefined,
            }
          : m
      );
      onSaveMachineries(updated);
    } else {
      const newMachine: Machinery = {
        id: `veh_${Date.now()}`,
        name: formattedName,
        model: formattedModel,
        brand: formattedBrand,
        year: year ? parseInt(year) : undefined,
        licensePlateOrSerial: plate.trim().toUpperCase(),
        operatorOrDriver: operator.trim() || undefined,
        status: status,
        categoryType: categoryType as any,
        hourMeter: hourMeter ? parseInt(hourMeter) : 0,
        averageConsumptionLitersPerHour: avgConsumption ? parseFloat(avgConsumption) : undefined,
        accumulatedCost: 0,
        revisionStatus: '--',
        reaisNotes: '--',
      };
      onSaveMachineries([...machineries, newMachine]);
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const item = machineries.find(m => m.id === id);
    const label = item?.licensePlateOrSerial ? `${item.name} (${item.licensePlateOrSerial})` : item?.name || 'este veículo';
    const isConfirmed = await confirm({
      title: 'Excluir Veículo / Máquina',
      message: `Deseja realmente excluir ${label} da frota?`,
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveMachineries(machineries.filter((m) => m.id !== id));
    }
  };


  // Filtered vehicles
  const filteredMachineries = useMemo(() => {
    return machineries.filter((m) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        (m.licensePlateOrSerial || '').toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.model || '').toLowerCase().includes(q) ||
        (m.brand || '').toLowerCase().includes(q) ||
        (m.operatorOrDriver || '').toLowerCase().includes(q);

      const matchStatus =
        filterStatus === 'todos'
          ? true
          : filterStatus === 'disponivel'
          ? m.status === 'disponivel' || m.status === 'operacional'
          : m.status === filterStatus;

      const matchType =
        filterType === 'todos' ? true : m.categoryType === filterType;

      return matchSearch && matchStatus && matchType;
    });
  }, [machineries, searchTerm, filterStatus, filterType]);

  // Statistics
  const totalVehicles = machineries.length;
  const availableCount = machineries.filter(
    (m) => m.status === 'disponivel' || m.status === 'operacional'
  ).length;
  const withDriverCount = machineries.filter(
    (m) => m.operatorOrDriver && m.operatorOrDriver.trim() !== ''
  ).length;

  return (
    <div id="machinery-vehicles-module" className="space-y-5">
      
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 tracking-tight font-['Outfit']">
            Gestão de Veículos, Frotas & Maquinários
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Cadastro de caminhões, ensiladeiras, tratores, operadores e controle de custos
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View toggle */}
          <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
              }`}
              title="Visualização em Tabela"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          <button
            id="btn-add-vehicle"
            onClick={openAddModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Veículo</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium block">Total Veículos</span>
            <span className="text-base font-extrabold text-stone-900 dark:text-stone-100">{totalVehicles}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium block">Disponíveis</span>
            <span className="text-base font-extrabold text-stone-900 dark:text-stone-100">{availableCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold">
            <UserCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium block">Com Motorista</span>
            <span className="text-base font-extrabold text-stone-900 dark:text-stone-100">{withDriverCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center font-bold">
            <Tractor className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium block">Em Operação</span>
            <span className="text-base font-extrabold text-stone-900 dark:text-stone-100">Silagem 2026</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-stone-900 p-3 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, modelo, marca ou motorista..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-stone-700 dark:text-stone-200 font-medium"
          >
            <option value="todos">Todos Status</option>
            <option value="disponivel">Disponível</option>
            <option value="em_manutencao">Em Manutenção</option>
            <option value="parado">Parado</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-2.5 py-1.5 text-stone-700 dark:text-stone-200 font-medium"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="caminhao">Caminhões</option>
            <option value="ensiladeira">Ensiladeiras</option>
            <option value="trator">Tratores</option>
            <option value="utilitario">Utilitários / Campo</option>
            <option value="onibus">Ônibus / Transporte</option>
            <option value="outro">Oficina / Outros</option>
          </select>
        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {viewMode === 'table' ? (
        /* TABLE VIEW (Exact layout matching the user's uploaded spreadsheet) */
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 font-bold text-stone-700 dark:text-stone-200 tracking-wider text-[11px] uppercase">
                  <th className="py-3 px-4 w-32">STATUS</th>
                  <th className="py-3 px-4 font-extrabold text-stone-900 dark:text-stone-100">IDENTIFICAÇÃO/PLACA</th>
                  <th className="py-3 px-4 font-extrabold text-stone-900 dark:text-stone-100">MODELO/MARCA</th>
                  <th className="py-3 px-4 font-bold text-stone-800 dark:text-stone-200">REAL (RESPONSÁVEL)</th>
                  <th className="py-3 px-4 text-center font-bold text-stone-500">REAIS</th>
                  <th className="py-3 px-4 text-center font-bold text-stone-500">REVISÃO</th>
                  <th className="py-3 px-4 text-right font-extrabold text-stone-900 dark:text-stone-100">ACUMULADO</th>
                  <th className="py-3 px-4 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredMachineries.map((veh, idx) => {
                  const vehExpenses = expenses.filter((e) => e.machineryId === veh.id);
                  const dynamicSpent = vehExpenses.reduce((acc, curr) => acc + curr.amount, 0);
                  const displaySpent = dynamicSpent > 0 ? dynamicSpent : (veh.accumulatedCost || 0);

                  return (
                    <tr
                      key={veh.id}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      {/* STATUS Badge */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight bg-white dark:bg-stone-800 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 shadow-2xs">
                          {veh.status === 'em_manutencao'
                            ? 'EM MANUTENÇÃO'
                            : veh.status === 'parado'
                            ? 'PARADO'
                            : 'DISPONÍVEL'}
                        </span>
                      </td>

                      {/* IDENTIFICAÇÃO / PLACA */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-stone-900 dark:text-stone-100 font-mono text-xs">
                          {veh.licensePlateOrSerial || veh.name}
                        </span>
                      </td>

                      {/* MODELO / MARCA */}
                      <td className="py-3 px-4 text-stone-700 dark:text-stone-300 font-medium">
                        {veh.model || `${veh.brand} ${veh.name}`}
                      </td>

                      {/* REAL (Responsável / Motorista) */}
                      <td className="py-3 px-4">
                        {veh.operatorOrDriver ? (
                          <span className="font-semibold text-stone-900 dark:text-stone-100">
                            {veh.operatorOrDriver}
                          </span>
                        ) : (
                          <span className="text-stone-400 font-medium">--</span>
                        )}
                      </td>

                      {/* REAIS */}
                      <td className="py-3 px-4 text-center text-stone-400">
                        {veh.reaisNotes || '--'}
                      </td>

                      {/* REVISÃO */}
                      <td className="py-3 px-4 text-center text-stone-400">
                        {veh.revisionStatus || '--'}
                      </td>

                      {/* ACUMULADO */}
                      <td className="py-3 px-4 text-right font-bold text-stone-900 dark:text-stone-100">
                        {formatCurrencyBRL(displaySpent)}
                      </td>

                      {/* AÇÕES */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onNewExpenseWithMachine(veh.id)}
                            className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Lançar Despesa"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(veh)}
                            className="p-1 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
                            title="Editar Veículo"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(veh.id)}
                            className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="Excluir Veículo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMachineries.map((veh) => {
            const vehExpenses = expenses.filter((e) => e.machineryId === veh.id);
            const totalSpent = vehExpenses.reduce((acc, curr) => acc + curr.amount, 0) || (veh.accumulatedCost || 0);

            return (
              <div
                key={veh.id}
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold">
                        {veh.categoryType === 'ensiladeira' || veh.categoryType === 'trator' ? (
                          <Tractor className="w-4 h-4" />
                        ) : (
                          <Truck className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-stone-900 dark:text-stone-100 font-mono">
                          {veh.licensePlateOrSerial || veh.name}
                        </h4>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1 uppercase">
                          {(veh.model || veh.brand || '').toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      DISPONÍVEL
                    </span>
                  </div>

                  <div className="bg-stone-50 dark:bg-stone-800/60 p-2.5 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between text-stone-600 dark:text-stone-300">
                      <span className="text-stone-400 text-[11px]">Responsável:</span>
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {veh.operatorOrDriver || 'Sem motorista fixo'}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-600 dark:text-stone-300">
                      <span className="text-stone-400 text-[11px]">Acumulado:</span>
                      <span className="font-bold text-stone-900 dark:text-stone-100">
                        {formatCurrencyBRL(totalSpent)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                  <button
                    onClick={() => onNewExpenseWithMachine(veh.id)}
                    className="font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Lançar Despesa
                  </button>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEditModal(veh)}
                      className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(veh.id)}
                      className="p-1 text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Vehicle Modal - Standardized */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header - Standardized Solid Teal Bar */}
            <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold tracking-tight">
                {editingMachine ? 'Editar Veículo / Frota' : 'Cadastrar Novo Veículo / Frota'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    IDENTIFICAÇÃO / PLACA <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="Ex: AKU-1C96 ou FORR 02 0799"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    TIPO DE VEÍCULO
                  </label>
                  <select
                    value={categoryType}
                    onChange={(e) => setCategoryType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  >
                    <option value="caminhao">Caminhão</option>
                    <option value="ensiladeira">Ensiladeira</option>
                    <option value="trator">Trator</option>
                    <option value="utilitario">Utilitário / Apoio</option>
                    <option value="onibus">Ônibus</option>
                    <option value="outro">Outro / Oficina</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  MODELO / MARCA COMPLETO <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Ex: FORD CARGO 2622 (2003) ou CLAAS JAGUAR 860"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    MOTORISTA / RESPONSÁVEL (REAL)
                  </label>
                  <input
                    type="text"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    placeholder="Ex: Nilton Pandolfi"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    STATUS OPERACIONAL
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="operacional">Operacional</option>
                    <option value="em_manutencao">Em Manutenção</option>
                    <option value="parado">Parado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    HORÍMETRO / KM
                  </label>
                  <input
                    type="number"
                    value={hourMeter}
                    onChange={(e) => setHourMeter(e.target.value)}
                    placeholder="5400"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    CONSUMO MÉDIO (L/H)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={avgConsumption}
                    onChange={(e) => setAvgConsumption(e.target.value)}
                    placeholder="18.0"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
                  />
                </div>
              </div>

              {/* Footer - Standardized */}
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
                >
                  {editingMachine ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
