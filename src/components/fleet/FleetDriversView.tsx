import React, { useState, useMemo, useRef } from 'react';
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
  LayoutGrid,
  Printer
} from 'lucide-react';
import { Employee, Machinery, CompanyProfile } from '../../types';
import { formatDateBR, checkCnhStatus, getActiveCompanyId } from '../../lib/storage';
import { 
  saveFleetDriverToSupabase, 
  deleteFleetDriverFromSupabase, 
  fetchRhFuncionarios,
  fetchFleetDriversFromSupabase, 
  upsertGestaoFrota, 
  isSupabaseConfigured, 
  toValidUUID 
} from '../../lib/supabaseService';
import { supabase } from '../../lib/supabaseClient';
import { useConfirm } from '../../context/ConfirmContext';
import { EmployeeAvatar } from '../common/EmployeeAvatar';

interface FleetDriversViewProps {
  employees: Employee[];
  machineries: Machinery[];
  onSaveEmployees: (employees: Employee[]) => void;
  onSaveMachineries?: (machineries: Machinery[]) => void;
  companyProfile?: CompanyProfile;
  onNavigateToVehicle?: (vehicleId: string) => void;
}

export const FleetDriversView: React.FC<FleetDriversViewProps> = ({
  employees,
  machineries,
  onSaveEmployees,
  onSaveMachineries,
  companyProfile,
  onNavigateToVehicle,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');

  const [filterCnh, setFilterCnh] = useState<'todos' | 'em_dia' | 'vencendo' | 'vencidas'>('todos');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isSaving, setIsSaving] = useState(false);
  const [dbDrivers, setDbDrivers] = useState<Employee[]>([]);

  // 2. LISTAGEM FILTRADA E TEMPO REAL:
  // Busca direta em public.rh_funcionarios filtrando por cargo 'Motorista'
  const loadDriversFromSupabase = React.useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const activeCid = companyProfile?.id || getActiveCompanyId();
      const fresh = await fetchFleetDriversFromSupabase(activeCid);
      if (fresh && Array.isArray(fresh)) {
        setDbDrivers(fresh);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar motoristas do Supabase:', err);
    }
  }, [companyProfile?.id]);

  const driversDebounceTimerRef = useRef<any>(null);

  // Realtime multi-dispositivos para a tabela rh_funcionarios com canal estável e desmonte obrigatório
  React.useEffect(() => {
    loadDriversFromSupabase();

    if (!isSupabaseConfigured) return;
    const companyId = companyProfile?.id || getActiveCompanyId();
    const channelId = `fleet_drivers_rt_${companyId || 'default'}`;

    const existingChannels = supabase.getChannels?.() || [];
    for (const ch of existingChannels) {
      if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
        try { supabase.removeChannel(ch); } catch (_) {}
      }
    }

    const debouncedLoad = () => {
      if (driversDebounceTimerRef.current) clearTimeout(driversDebounceTimerRef.current);
      driversDebounceTimerRef.current = setTimeout(() => {
        loadDriversFromSupabase();
      }, 400);
    };

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rh_funcionarios' },
        () => {
          debouncedLoad();
        }
      )
      .subscribe();

    return () => {
      if (driversDebounceTimerRef.current) {
        clearTimeout(driversDebounceTimerRef.current);
      }
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [companyProfile?.id, loadDriversFromSupabase]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Employee | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState('Motorista');
  const [phone, setPhone] = useState('');
  const [cnhNumber, setCnhNumber] = useState('');
  const [cnhCategory, setCnhCategory] = useState('E');
  const [cnhExpiration, setCnhExpiration] = useState('');
  const [assignedVehicle, setAssignedVehicle] = useState('');
  const [status, setStatus] = useState<Employee['status']>('ativo');

  // Mescla os motoristas buscados de rh_funcionarios com os colaboradores existentes
  const allDriversMerged = useMemo(() => {
    const map = new Map<string, Employee>();
    dbDrivers.forEach(d => {
      if (d.id) map.set(d.id, d);
    });
    employees.forEach(e => {
      if (e.id && !map.has(e.id)) {
        map.set(e.id, e);
      }
    });
    return Array.from(map.values());
  }, [dbDrivers, employees]);

  const cnhReport = checkCnhStatus(allDriversMerged);

  // Helper to find any machinery/vehicle linked to a driver/operator
  const findAssignedMachinery = (driver: Employee) => {
    const driverNameLower = String(driver?.name || '').trim().toLowerCase();
    return machineries.find(m => {
      // Check direct single or comma-separated operatorOrDriver string
      if (m.operatorOrDriver) {
        const parts = m.operatorOrDriver.split(',').map(s => s.trim().toLowerCase());
        if (parts.includes(driverNameLower)) return true;
      }
      // Check structured assignedDrivers array if available
      if (m.assignedDrivers && Array.isArray(m.assignedDrivers)) {
        if (m.assignedDrivers.some((d: any) => (typeof d === 'object' ? d?.id === driver.id || String(d?.name || '').trim().toLowerCase() === driverNameLower : String(d).trim().toLowerCase() === driverNameLower))) {
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
        m.assignedDrivers.forEach((d: any) => {
          if (typeof d === 'object' && d !== null) {
            if (d.id) linkedEmployeeIds.add(d.id);
            if (d.name) linkedEmployeeNames.add(d.name.trim().toLowerCase());
          } else if (typeof d === 'string') {
            linkedEmployeeNames.add(d.trim().toLowerCase());
          }
        });
      }
    });

    return allDriversMerged.filter(e => {
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
        String(e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.role && String(e.role).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (e.cnhNumber && String(e.cnhNumber).includes(searchTerm)) ||
        String(e.phone || '').includes(searchTerm);

      if (!isConductorOrOperator || !matchSearch) return false;

      const isExpired = cnhReport.expired.some(exp => exp.id === e.id);
      const isExpiring = cnhReport.expiringSoon.some(exp => exp.id === e.id);

      if (filterCnh === 'vencidas') return isExpired;
      if (filterCnh === 'vencendo') return isExpiring;
      if (filterCnh === 'em_dia') return !isExpired && !isExpiring;

      return true;
    });
  }, [allDriversMerged, machineries, searchTerm, filterCnh, cnhReport]);

  const openNewDriverModal = () => {
    setEditingDriver(null);
    setName('');
    setRole('Motorista');
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
    setRole(driver.role || 'Motorista');
    setPhone(driver.phone);
    setCnhNumber(driver.cnhNumber || '');
    setCnhCategory(driver.cnhCategory || 'E');
    setCnhExpiration(driver.cnhExpiration || '');
    // Find assigned vehicle
    const driverNameLower = String(driver.name || '').trim().toLowerCase();
    const vehicle = machineries.find(m => (m.operatorOrDriver || '').trim().toLowerCase() === driverNameLower);
    setAssignedVehicle(vehicle?.id || '');
    setStatus(driver.status);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const driver = allDriversMerged.find(e => e.id === id);
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
      // 1. Atualização imediata no estado da aplicação e lista reativa
      setDbDrivers(prev => prev.filter(e => e.id !== id && toValidUUID(e.id) !== toValidUUID(id)));
      onSaveEmployees(employees.filter(e => e.id !== id && toValidUUID(e.id) !== toValidUUID(id)));

      // 2. Exclusão física no Supabase (rh_funcionarios)
      try {
        const activeCid = companyProfile?.id || getActiveCompanyId();
        await deleteFleetDriverFromSupabase(id, activeCid);
      } catch (delErr) {
        console.warn('Aviso ao excluir motorista do Supabase:', delErr);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    const trimmedName = name.trim();
    const trimmedRole = 'Motorista'; // Valor fixo 'Motorista' conforme especificação do usuário
    const trimmedPhone = phone.trim();
    const trimmedCnh = cnhNumber.trim();
    const safeExpiry = cnhExpiration.trim() ? cnhExpiration.trim() : undefined;
    const targetId = editingDriver?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : toValidUUID(`emp_drv_${Date.now()}`));
    const activeCid = companyProfile?.id || getActiveCompanyId();

    const driverPayload: Employee = {
      ...(editingDriver || {}),
      id: targetId,
      name: trimmedName,
      role: trimmedRole,
      phone: trimmedPhone,
      cnhNumber: trimmedCnh || undefined,
      cnhCategory: cnhCategory || 'E',
      cnhExpiration: safeExpiry,
      status,
      admissionDate: editingDriver?.admissionDate || new Date().toISOString().split('T')[0],
      companyId: activeCid,
    };

    // 1. Atualização otimista imediata na UI reativa e contexto global
    setDbDrivers(prev => {
      const exists = prev.some(d => d.id === targetId || toValidUUID(d.id) === toValidUUID(targetId));
      if (exists) {
        return prev.map(d => (d.id === targetId || toValidUUID(d.id) === toValidUUID(targetId)) ? driverPayload : d);
      }
      return [driverPayload, ...prev];
    });

    const updatedEmployees = employees.some(e => e.id === targetId || toValidUUID(e.id) === toValidUUID(targetId))
      ? employees.map(emp => (emp.id === targetId || toValidUUID(emp.id) === toValidUUID(targetId)) ? driverPayload : emp)
      : [driverPayload, ...employees];
    onSaveEmployees(updatedEmployees);

    // 2. Persistência física direta no Supabase (public.rh_funcionarios)
    // Mapeia estritamente com as colunas físicas reais sem propriedades locais não aceitas
    try {
      const res = await saveFleetDriverToSupabase({
        id: targetId,
        name: trimmedName,
        role: trimmedRole,
        phone: trimmedPhone,
        cnhNumber: trimmedCnh,
        cnhCategory,
        cnhExpiration: safeExpiry,
        status,
        admissionDate: driverPayload.admissionDate,
        companyId: activeCid,
      }, activeCid);

      if (res.success && res.data) {
        // Sincroniza com a linha física gravada no Supabase
        const savedEmp = res.data;
        setDbDrivers(prev => {
          const filtered = prev.filter(d => d.id !== targetId && toValidUUID(d.id) !== toValidUUID(targetId));
          return [savedEmp, ...filtered];
        });
        const finalEmployees = updatedEmployees.map(emp => 
          (emp.id === targetId || toValidUUID(emp.id) === toValidUUID(targetId)) ? savedEmp : emp
        );
        onSaveEmployees(finalEmployees);
      }
    } catch (saveErr) {
      console.warn('Aviso ao persistir motorista no Supabase:', saveErr);
    }

    // 3. Vinculação com o veículo titular selecionado (se fornecido)
    if (assignedVehicle && onSaveMachineries) {
      const targetVehicle = machineries.find(m => m.id === assignedVehicle);
      if (targetVehicle) {
        const updatedVehicles = machineries.map(m => {
          if (m.id === assignedVehicle) {
            const updated: Machinery = {
              ...m,
              operatorOrDriver: trimmedName,
              assignedDriverIds: Array.from(new Set([...(m.assignedDriverIds || []), targetId])),
              assignedDrivers: Array.from(new Set([...(m.assignedDrivers || []), trimmedName]))
            };
            upsertGestaoFrota(updated).catch(err => console.warn('Erro ao atualizar titular do veículo:', err));
            return updated;
          }
          return m;
        });
        onSaveMachineries(updatedVehicles);
      }
    }

    setIsSaving(false);
    setIsModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      
      {/* Compact Top Bar: Title + Interactive CNH Stat Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-white dark:bg-stone-900 p-2.5 sm:p-3 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs no-print print:hidden">
        
        {/* Left: Title & Subtitle */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit'] leading-tight">
              Gestão de Motoristas & CNHs
            </h2>
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

      </div>

      {/* Compact Search & Filter Toolbar (conforme simetria da aba de Veículos) */}
      <div className="bg-white dark:bg-stone-900 p-2 sm:p-2.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-2.5 no-print print:hidden">
        
        {/* Lado Esquerdo: Busca + Botão Cadastrar Motorista + Botão Imprimir Lista */}
        <div className="flex flex-1 items-center gap-2 max-w-2xl min-w-0 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar motorista, CNH ou telefone..."
              className="w-full pl-8.5 pr-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          {/* 1. Botão "+ CADASTRAR MOTORISTA" (3D Metálico) */}
          <button
            onClick={openNewDriverModal}
            title="Cadastrar Novo Motorista"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 border border-slate-400 dark:border-stone-600 text-slate-800 dark:text-stone-100 hover:text-slate-900 text-xs font-bold uppercase shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1)] transition flex items-center space-x-1.5 shrink-0 cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-slate-700 dark:text-stone-300 stroke-[2.5]" />
            <span>+ CADASTRAR MOTORISTA</span>
          </button>

          {/* 2. Botão "IMPRIMIR LISTA" (3D Metálico) */}
          <button
            onClick={handlePrint}
            title="Visualizar e Imprimir Lista de Motoristas em Folha A4"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 border border-slate-400 dark:border-stone-600 text-slate-800 dark:text-stone-100 hover:text-slate-900 text-xs font-bold uppercase shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1)] transition flex items-center space-x-1.5 shrink-0 cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700 dark:text-stone-300" />
            <span>IMPRIMIR LISTA</span>
          </button>
        </div>

        {/* Lado Direito: Dropdown 'Todos os Motoristas (13)' + View Toggle */}
        <div className="flex items-center space-x-2 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
          <select
            value={filterCnh}
            onChange={(e) => setFilterCnh(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-600 cursor-pointer"
          >
            <option value="todos">Todos os Motoristas ({driversList.length})</option>
            <option value="em_dia">Apenas CNH em dia ({cnhReport.valid.length})</option>
            <option value="vencendo">Apenas CNH vencendo ({cnhReport.expiringSoon.length})</option>
            <option value="vencidas">Apenas CNH vencida ({cnhReport.expired.length})</option>
          </select>

          {/* View toggle */}
          <div className="flex items-center bg-zinc-100 dark:bg-stone-800 p-0.5 rounded-xl border border-zinc-300 dark:border-stone-700 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-zinc-800 text-white dark:bg-stone-700 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
              title="Visualização em Lista / Tabela"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-zinc-800 text-white dark:bg-stone-700 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Header exclusivo para impressão em papel A4 */}
      <div className="hidden print:block mb-4 border-b-2 border-black pb-2 text-black">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black uppercase tracking-wider">
              {companyProfile?.tradeName || companyProfile?.corporateName || 'COLAÇA SILAGEM'} — RELATÓRIO DE MOTORISTAS & CNH
            </h1>
            <p className="text-[11px] text-gray-700">
              Gestão de Frotas & Transporte • Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="text-right text-[11px]">
            <p className="font-bold">Total Listado: {driversList.length} motorista(s)</p>
            <p className="text-gray-700">Em dia: {cnhReport.valid.length} | Vencendo: {cnhReport.expiringSoon.length} | Vencidas: {cnhReport.expired.length}</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
          }
          aside, nav, header, .no-print, .print\\:hidden {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
          }
          th, td {
            border: 1px solid #d1d5db !important;
            padding: 5px 8px !important;
            color: #000000 !important;
          }
          th {
            background-color: #f3f4f6 !important;
            font-weight: 800 !important;
          }
        }
      `}</style>

      {/* Empty State */}
      {driversList.length === 0 && (
        <div className="bg-white rounded-2xl border border-zinc-300 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto mb-3 border border-zinc-300">
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
      {driversList.length > 0 && (
        <div className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden ${viewMode === 'table' ? 'block' : 'hidden print:block'}`}>
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
                  <th className="py-3.5 px-4 text-right no-print print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                {driversList.map((driver) => {
                  const isExpired = cnhReport.expired.some(e => e.id === driver.id);
                  const isExpiring = cnhReport.expiringSoon.some(e => e.id === driver.id);
                  const dName = String(driver.name || '').trim().toLowerCase();
                  const assignedTruck = machineries.find(m => (m.operatorOrDriver || '').trim().toLowerCase() === dName);

                  return (
                    <tr
                      key={driver.id}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-800/30 transition group"
                    >
                      {/* Motorista / Cargo */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <EmployeeAvatar
                            photoUrl={driver.photoUrl}
                            name={driver.name}
                            size="sm"
                            showInitials
                            className="bg-zinc-800 text-white border-zinc-700"
                          />
                          <div>
                            <div className="font-bold text-zinc-900 text-sm">
                              {driver.name}
                            </div>
                            <div className="text-xs text-zinc-600 font-medium">
                              {driver.role}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CNH & Categoria */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-zinc-800">
                            {driver.cnhNumber || 'Não informada'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 font-extrabold text-[10px]">
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
                      <td className="py-3.5 px-4 text-right whitespace-nowrap no-print print:hidden">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 no-print print:hidden">
        {driversList.map((driver) => {
          const isExpired = cnhReport.expired.some(e => e.id === driver.id);
          const isExpiring = cnhReport.expiringSoon.some(e => e.id === driver.id);
          const dNameCard = String(driver.name || '').trim().toLowerCase();
          const assignedTruck = machineries.find(m => (m.operatorOrDriver || '').trim().toLowerCase() === dNameCard);

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
                    <EmployeeAvatar
                      photoUrl={driver.photoUrl}
                      name={driver.name}
                      size="md"
                      showInitials
                      className="bg-zinc-800 text-white border-zinc-700"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900">
                        {driver.name}
                      </h4>
                      <p className="text-xs text-zinc-600 font-medium">
                        {driver.role}
                      </p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    driver.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                  }`}>
                    {driver.status}
                  </span>
                </div>

                {/* CNH Details Box */}
                <div className="mt-4 p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600 flex items-center space-x-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>CNH {driver.cnhNumber || 'Não informada'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 font-extrabold text-[10px]">
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

      {/* Driver Add/Edit Modal - Padrão 3D Acetinado Slim */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden overflow-y-hidden">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] border border-slate-400 dark:border-stone-700 overflow-hidden overflow-y-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[92vh]">
            
            {/* Header - Moldura Metálica 3D Acetinada */}
            <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 flex items-center justify-between shrink-0 rounded-t-2xl shadow-xs">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 font-['Outfit']">
                    {editingDriver ? 'EDITAR MOTORISTA' : 'NOVO MOTORISTA'}
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                    Controle de CNH, categorias, veículos vinculados e contatos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-3 sm:p-4 space-y-2 text-xs bg-white dark:bg-stone-900 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo Ramos"
                    className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                      Função / Cargo
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Ex: Motorista de Caminhão"
                      className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(45) 99999-9999"
                      className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                      Número CNH
                    </label>
                    <input
                      type="text"
                      value={cnhNumber}
                      onChange={(e) => setCnhNumber(e.target.value)}
                      placeholder="12345678900"
                      className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                      Categoria CNH
                    </label>
                    <select
                      value={cnhCategory}
                      onChange={(e) => setCnhCategory(e.target.value)}
                      className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-2xs cursor-pointer"
                    >
                      <option value="E">E (Pesados / Bitrem)</option>
                      <option value="D">D (Ônibus / Vans)</option>
                      <option value="C">C (Caminhões)</option>
                      <option value="B">B (Carros / Apoio)</option>
                      <option value="AB">AB</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                      Validade CNH
                    </label>
                    <input
                      type="date"
                      value={cnhExpiration}
                      onChange={(e) => setCnhExpiration(e.target.value)}
                      className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    Caminhão / Veículo Vinculado (Opcional)
                  </label>
                  <select
                    value={assignedVehicle}
                    onChange={(e) => setAssignedVehicle(e.target.value)}
                    className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-2xs cursor-pointer"
                  >
                    <option value="">Sem veículo titular fixo</option>
                    {machineries.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.model ? `- ${m.model}` : ''} {m.licensePlateOrSerial ? `(${m.licensePlateOrSerial})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-300 dark:border-stone-700 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-stone-600 text-slate-700 dark:text-stone-200 bg-slate-100 hover:bg-slate-200 text-xs font-bold transition cursor-pointer shadow-[inset_0_1px_0px_rgba(255,255,255,0.8)] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-bold shadow-[inset_0_1px_0px_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.2)] border border-blue-700 transition active:scale-98 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                  <span>{isSaving ? 'Gravando...' : 'Salvar Motorista'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
