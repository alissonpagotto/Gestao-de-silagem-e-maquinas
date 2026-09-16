import React, { useState, useMemo } from 'react';
import { 
  UserCheck, 
  Plus, 
  Search, 
  Phone, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  Trash2, 
  CreditCard, 
  Truck,
  Car,
  X,
  Save,
  MessageSquare,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';
import { Employee, Machinery } from '../../types';
import { formatDateBR, checkCnhStatus } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';

interface FleetDriversViewProps {

  employees: Employee[];
  machineries: Machinery[];
  onSaveEmployees: (employees: Employee[]) => void;
  onNavigateToVehicle?: (vehicleId: string) => void;
}

export const FleetDriversView: React.FC<FleetDriversViewProps> = ({
  employees,
  machineries,
  onSaveEmployees,
  onNavigateToVehicle,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');

  const [filterCnh, setFilterCnh] = useState<'todos' | 'em_dia' | 'vencendo' | 'vencidas'>('todos');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Employee | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState('Motorista de Caminhão');
  const [phone, setPhone] = useState('');
  const [cnhNumber, setCnhNumber] = useState('');
  const [cnhCategory, setCnhCategory] = useState('E');
  const [cnhExpiration, setCnhExpiration] = useState('');
  const [assignedVehicle, setAssignedVehicle] = useState('');
  const [status, setStatus] = useState<Employee['status']>('ativo');

  const cnhReport = checkCnhStatus(employees);

  // Helper to find any machinery/vehicle linked to a driver/operator
  const findAssignedMachinery = (driver: Employee) => {
    const driverNameLower = driver.name.trim().toLowerCase();
    return machineries.find(m => {
      // Check direct single or comma-separated operatorOrDriver string
      if (m.operatorOrDriver) {
        const parts = m.operatorOrDriver.split(',').map(s => s.trim().toLowerCase());
        if (parts.includes(driverNameLower)) return true;
      }
      // Check structured assignedDrivers array if available
      if (m.assignedDrivers && Array.isArray(m.assignedDrivers)) {
        if (m.assignedDrivers.some(d => d.id === driver.id || d.name?.trim().toLowerCase() === driverNameLower)) {
          return true;
        }
      }
      return false;
    });
  };

  // Filter drivers and machinery/tractor/harvester operators
  const driversList = useMemo(() => {
    // Set of IDs of employees that are currently linked to any machinery/vehicle
    const linkedEmployeeIds = new Set<string>();
    const linkedEmployeeNames = new Set<string>();

    machineries.forEach(m => {
      if (m.operatorOrDriver) {
        m.operatorOrDriver.split(',').forEach(namePart => {
          const trimmed = namePart.trim().toLowerCase();
          if (trimmed) linkedEmployeeNames.add(trimmed);
        });
      }
      if (m.assignedDrivers && Array.isArray(m.assignedDrivers)) {
        m.assignedDrivers.forEach(d => {
          if (d.id) linkedEmployeeIds.add(d.id);
          if (d.name) linkedEmployeeNames.add(d.name.trim().toLowerCase());
        });
      }
    });

    return employees.filter(e => {
      const roleLower = (e.role || '').toLowerCase();
      const isLinkedToVehicle = 
        linkedEmployeeIds.has(e.id) || 
        linkedEmployeeNames.has(e.name.trim().toLowerCase());

      const isDriverOrOperatorRole = 
        roleLower.includes('motorista') || 
        roleLower.includes('transporte') ||
        roleLower.includes('caminhão') ||
        roleLower.includes('operador') ||
        roleLower.includes('trator') ||
        roleLower.includes('ensiladeira') ||
        roleLower.includes('forrageira') ||
        roleLower.includes('máquina') ||
        roleLower.includes('maquina') ||
        Boolean(e.cnhNumber);

      const isConductorOrOperator = isDriverOrOperatorRole || isLinkedToVehicle;

      const matchSearch =
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.role && e.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.cnhNumber && e.cnhNumber.includes(searchTerm)) ||
        e.phone.includes(searchTerm);

      if (!isConductorOrOperator || !matchSearch) return false;

      const isExpired = cnhReport.expired.some(exp => exp.id === e.id);
      const isExpiring = cnhReport.expiringSoon.some(exp => exp.id === e.id);

      if (filterCnh === 'vencidas') return isExpired;
      if (filterCnh === 'vencendo') return isExpiring;
      if (filterCnh === 'em_dia') return !isExpired && !isExpiring;

      return true;
    });
  }, [employees, machineries, searchTerm, filterCnh, cnhReport]);

  const openNewDriverModal = () => {
    setEditingDriver(null);
    setName('');
    setRole('Motorista de Caminhão');
    setPhone('');
    setCnhNumber('');
    setCnhCategory('E');
    setCnhExpiration('');
    setAssignedVehicle('');
    setStatus('ativo');
    setIsModalOpen(true);
  };

  const openEditDriverModal = (driver: Employee) => {
    setEditingDriver(driver);
    setName(driver.name);
    setRole(driver.role);
    setPhone(driver.phone);
    setCnhNumber(driver.cnhNumber || '');
    setCnhCategory(driver.cnhCategory || 'E');
    setCnhExpiration(driver.cnhExpiration || '');
    // Find assigned vehicle
    const vehicle = machineries.find(m => m.operatorOrDriver?.toLowerCase() === driver.name.toLowerCase());
    setAssignedVehicle(vehicle?.id || '');
    setStatus(driver.status);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const driver = employees.find(e => e.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Motorista / Operador',
      message: driver?.name 
        ? `Deseja realmente remover o motorista "${driver.name}" do cadastro?`
        : 'Deseja realmente remover este motorista do cadastro?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      onSaveEmployees(employees.filter(e => e.id !== id));
    }
  };


  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingDriver) {
      const updated = employees.map(emp =>
        emp.id === editingDriver.id
          ? {
              ...emp,
              name: name.trim(),
              role: role.trim(),
              phone: phone.trim(),
              cnhNumber: cnhNumber.trim() || undefined,
              cnhCategory: cnhCategory || undefined,
              cnhExpiration: cnhExpiration || undefined,
              status,
            }
          : emp
      );
      onSaveEmployees(updated);
    } else {
      const newDriver: Employee = {
        id: `emp_drv_${Date.now()}`,
        name: name.trim(),
        role: role.trim() || 'Motorista de Caminhão',
        phone: phone.trim(),
        cnhNumber: cnhNumber.trim() || undefined,
        cnhCategory: cnhCategory || 'E',
        cnhExpiration: cnhExpiration || undefined,
        status,
        admissionDate: new Date().toISOString().split('T')[0],
      };
      onSaveEmployees([newDriver, ...employees]);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      
      {/* Compact Top Bar: Title + Interactive CNH Stat Badges + Action Button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-white dark:bg-stone-900 p-2.5 sm:p-3 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
        
        {/* Left: Title & Subtitle */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit'] leading-tight">
              Gestão de Motoristas & CNHs
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Controle de habilitações, vencimentos e caminhões titulares
            </p>
          </div>
        </div>

        {/* Middle: Interactive Compact CNH Badges */}
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCnh(filterCnh === 'em_dia' ? 'todos' : 'em_dia')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center space-x-1.5 ${
              filterCnh === 'em_dia'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
            }`}
            title="Filtrar CNH em dia"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Em dia: <strong>{cnhReport.valid.length}</strong></span>
          </button>

          <button
            onClick={() => setFilterCnh(filterCnh === 'vencendo' ? 'todos' : 'vencendo')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center space-x-1.5 ${
              filterCnh === 'vencendo'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 hover:bg-amber-100'
            }`}
            title="Filtrar CNH a vencer em 30 dias"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Vencendo (30d): <strong>{cnhReport.expiringSoon.length}</strong></span>
          </button>

          <button
            onClick={() => setFilterCnh(filterCnh === 'vencidas' ? 'todos' : 'vencidas')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center space-x-1.5 ${
              filterCnh === 'vencidas'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100'
            }`}
            title="Filtrar CNH vencida"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Vencidas: <strong>{cnhReport.expired.length}</strong></span>
          </button>
        </div>

        {/* Right: Cadastrar Motorista Button */}
        <button
          onClick={openNewDriverModal}
          className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Cadastrar Motorista</span>
        </button>

      </div>

      {/* Compact Search & Filter Toolbar */}
      <div className="bg-white dark:bg-stone-900 p-2 sm:p-2.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar motorista, CNH ou telefone..."
            className="w-full pl-8.5 pr-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={filterCnh}
            onChange={(e) => setFilterCnh(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="todos">Todos os Motoristas ({driversList.length})</option>
            <option value="em_dia">Apenas CNH em dia ({cnhReport.valid.length})</option>
            <option value="vencendo">Apenas CNH vencendo ({cnhReport.expiringSoon.length})</option>
            <option value="vencidas">Apenas CNH vencida ({cnhReport.expired.length})</option>
          </select>

          {/* View toggle */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-xl border border-stone-200 dark:border-stone-700 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
              }`}
              title="Visualização em Lista / Tabela"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {driversList.length === 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
            Nenhum motorista encontrado
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            Não há motoristas cadastrados que correspondam aos filtros ou termo de busca aplicados.
          </p>
        </div>
      )}

      {/* Drivers Table / List View */}
      {driversList.length > 0 && viewMode === 'table' && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50/75 dark:bg-stone-800/40 text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Motorista / Cargo</th>
                  <th className="py-3.5 px-4">CNH & Categoria</th>
                  <th className="py-3.5 px-4">Validade CNH</th>
                  <th className="py-3.5 px-4">Veículo Habitual</th>
                  <th className="py-3.5 px-4">Contato / WhatsApp</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                {driversList.map((driver) => {
                  const isExpired = cnhReport.expired.some(e => e.id === driver.id);
                  const isExpiring = cnhReport.expiringSoon.some(e => e.id === driver.id);
                  const assignedTruck = machineries.find(m => m.operatorOrDriver?.toLowerCase() === driver.name.toLowerCase());

                  return (
                    <tr
                      key={driver.id}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/30 transition group"
                    >
                      {/* Motorista / Cargo */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {driver.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 dark:text-stone-100 text-sm">
                              {driver.name}
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              {driver.role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CNH & Categoria */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-stone-800 dark:text-stone-200">
                            {driver.cnhNumber || 'Não informada'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-extrabold text-[10px]">
                            Cat. {driver.cnhCategory || 'E'}
                          </span>
                        </div>
                      </td>

                      {/* Validade CNH */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          {isExpired ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-800/60">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>{formatDateBR(driver.cnhExpiration)} (Vencida)</span>
                            </span>
                          ) : isExpiring ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 font-bold text-xs border border-amber-200 dark:border-amber-800/60">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>{formatDateBR(driver.cnhExpiration)} (Vence logo)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold text-xs border border-emerald-200 dark:border-emerald-800/60">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{formatDateBR(driver.cnhExpiration)}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Veículo Habitual */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {assignedTruck ? (
                          <div className="flex items-center space-x-1.5 text-sky-700 dark:text-sky-400 font-bold">
                            <Truck className="w-3.5 h-3.5 shrink-0" />
                            <span>{assignedTruck.licensePlateOrSerial || assignedTruck.model}</span>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic text-xs">Livre / Rotativo</span>
                        )}
                      </td>

                      {/* Contato / WhatsApp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {driver.phone ? (
                          <a
                            href={`https://wa.me/55${driver.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{driver.phone}</span>
                          </a>
                        ) : (
                          <span className="text-stone-400 italic">Sem telefone</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          driver.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:border-emerald-800' : 'bg-stone-100 text-stone-600'
                        }`}>
                          {driver.status}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => openEditDriverModal(driver)}
                            className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition cursor-pointer"
                            title="Editar Motorista"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(driver.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition cursor-pointer"
                            title="Remover Motorista"
                          >
                            <Trash2 className="w-4 h-4" />
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
      )}

      {/* Drivers Cards Grid View */}
      {driversList.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {driversList.map((driver) => {
          const isExpired = cnhReport.expired.some(e => e.id === driver.id);
          const isExpiring = cnhReport.expiringSoon.some(e => e.id === driver.id);
          const assignedTruck = machineries.find(m => m.operatorOrDriver?.toLowerCase() === driver.name.toLowerCase());

          return (
            <div
              key={driver.id}
              className={`bg-white dark:bg-stone-900 rounded-2xl border p-5 shadow-xs transition flex flex-col justify-between space-y-4 ${
                isExpired
                  ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/20'
                  : isExpiring
                  ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/20'
                  : 'border-stone-200 dark:border-stone-800 hover:border-blue-300'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-blue-600/20">
                      {driver.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {driver.name}
                      </h4>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        {driver.role}
                      </p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    driver.status === 'ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {driver.status}
                  </span>
                </div>

                {/* CNH Details Box */}
                <div className="mt-4 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500 flex items-center space-x-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>CNH {driver.cnhNumber || 'Não informada'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-extrabold text-[10px]">
                      Cat. {driver.cnhCategory || 'E'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500">Validade:</span>
                    <span className={`font-bold ${
                      isExpired ? 'text-rose-600' : isExpiring ? 'text-amber-600' : 'text-emerald-700'
                    }`}>
                      {formatDateBR(driver.cnhExpiration)} {isExpired ? '(Vencida)' : isExpiring ? '(Vence logo)' : ''}
                    </span>
                  </div>
                </div>

                {/* Assigned Vehicle */}
                <div className="mt-3 text-xs flex items-center justify-between text-stone-600 dark:text-stone-300">
                  <span className="text-stone-400">Veículo habitual:</span>
                  {assignedTruck ? (
                    <span className="font-bold text-sky-700 dark:text-sky-400">
                      🚛 {assignedTruck.licensePlateOrSerial || assignedTruck.model}
                    </span>
                  ) : (
                    <span className="text-stone-400 italic">Livre / Rotativo</span>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                {driver.phone ? (
                  <a
                    href={`https://wa.me/55${driver.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{driver.phone}</span>
                  </a>
                ) : (
                  <span className="text-[11px] text-stone-400">Sem telefone</span>
                )}

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditDriverModal(driver)}
                    className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-white rounded-lg transition cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(driver.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Driver Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-blue-700 text-white flex items-center justify-between">
              <h3 className="text-base font-bold font-['Outfit']">
                {editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Ramos"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Função / Cargo
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Ex: Motorista de Caminhão"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(45) 99999-9999"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Número CNH
                  </label>
                  <input
                    type="text"
                    value={cnhNumber}
                    onChange={(e) => setCnhNumber(e.target.value)}
                    placeholder="12345678900"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Categoria CNH
                  </label>
                  <select
                    value={cnhCategory}
                    onChange={(e) => setCnhCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="E">E (Pesados / Bitrem)</option>
                    <option value="D">D (Ônibus / Vans)</option>
                    <option value="C">C (Caminhões)</option>
                    <option value="B">B (Carros / Apoio)</option>
                    <option value="AB">AB</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                    Validade CNH
                  </label>
                  <input
                    type="date"
                    value={cnhExpiration}
                    onChange={(e) => setCnhExpiration(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Motorista</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
