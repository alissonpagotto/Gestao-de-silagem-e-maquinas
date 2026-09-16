import React, { useState, useMemo } from 'react';
import { 
  Fuel, 
  Wrench, 
  Users, 
  Receipt, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Gauge, 
  Clock, 
  Utensils, 
  Briefcase, 
  FileText, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  X,
  FileCheck,
  Calendar,
  Wallet,
  Car,
  Eye
} from 'lucide-react';
import { MaintenanceDetailModal } from './MaintenanceDetailModal';
import { 
  Machinery, 
  Employee, 
  FuelLog, 
  MaintenanceLog, 
  Expense, 
  ServiceOrder, 
  SilageOrder, 
  PayrollRecord 
} from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredExpenses, 
  saveStoredExpenses,
  getStoredServices, 
  getStoredOrders, 
  getStoredPayrolls,
  getStoredCompanyProfile 
} from '../../lib/storage';
import { calculateVehicleConsumptionMetrics } from '../../lib/fleetMetrics';
import { PrintReportHeader } from '../common/PrintReportHeader';
import { PrintReportFooter } from '../common/PrintReportFooter';

interface VehicleHistoryDreTabProps {
  vehicle: Machinery | null;
  employees: Employee[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  expenses?: Expense[];
  services?: ServiceOrder[];
  orders?: SilageOrder[];
  onAddExpense?: (expense: any) => void;
  onClose?: () => void;
}

type HistorySubTab = 'resumo_consumo' | 'dre' | 'motoristas' | 'abastecimentos' | 'manutencoes';

export const VehicleHistoryDreTab: React.FC<VehicleHistoryDreTabProps> = ({
  vehicle,
  employees,
  fuelLogs = [],
  maintenanceLogs = [],
  expenses: propExpenses,
  services: propServices,
  orders: propOrders,
  onAddExpense,
  onClose,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<HistorySubTab>('resumo_consumo');
  const [viewingMaintenanceLog, setViewingMaintenanceLog] = useState<MaintenanceLog | null>(null);
  const [isAddingDriverExpense, setIsAddingDriverExpense] = useState(false);
  const [localExpenses, setLocalExpenses] = useState<Expense[]>(() => {
    return propExpenses && propExpenses.length > 0 ? propExpenses : getStoredExpenses();
  });

  // Keep localExpenses in sync if propExpenses changes
  React.useEffect(() => {
    if (propExpenses && propExpenses.length > 0) {
      setLocalExpenses(propExpenses);
    }
  }, [propExpenses]);

  // Quick form for driver expense
  const [expenseDriverId, setExpenseDriverId] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'alimentacao' | 'salario' | 'rescisao' | 'diaria' | 'outro'>('alimentacao');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'pix' | 'dinheiro' | 'transferencia' | 'boleto'>('pix');
  const [expenseNotes, setExpenseNotes] = useState('');

  // Fallback services and orders
  const services = useMemo(() => {
    return propServices && propServices.length > 0 ? propServices : getStoredServices();
  }, [propServices]);

  const orders = useMemo(() => {
    return propOrders && propOrders.length > 0 ? propOrders : getStoredOrders();
  }, [propOrders]);

  const payrolls = useMemo(() => {
    return getStoredPayrolls();
  }, []);

  if (!vehicle) {
    return (
      <div className="flex-1 p-8 text-center flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center">
          <Car className="w-6 h-6" />
        </div>
        <div className="max-w-md">
          <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">Veículo Não Salvo Ainda</h4>
          <p className="text-xs text-stone-500 mt-1">
            Cadastre os dados básicos e clique em <strong>Salvar Veículo</strong> para habilitar o registro de abastecimentos, despesas com motorista, consumo por hora/KM e apuração do DRE.
          </p>
        </div>
      </div>
    );
  }

  // --- 1. Filter Fuel and Maintenance Logs for this Vehicle ---
  const vehicleFuelLogs = useMemo(() => {
    return fuelLogs
      .filter((f) => f.machineryId === vehicle.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vehicle.id, fuelLogs]);

  const vehicleMaintenanceLogs = useMemo(() => {
    return maintenanceLogs
      .filter((m) => m.machineryId === vehicle.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vehicle.id, maintenanceLogs]);

  // --- 2. Calculate Consumption Metrics (KM and Hours) ---
  const consumptionMetrics = useMemo(() => {
    return calculateVehicleConsumptionMetrics(vehicle.id, fuelLogs);
  }, [vehicle.id, fuelLogs]);

  // --- 3. Identify Assigned Drivers ---
  const assignedDriverIds = useMemo(() => {
    if (vehicle.assignedDriverIds && vehicle.assignedDriverIds.length > 0) {
      return vehicle.assignedDriverIds;
    }
    if (vehicle.operatorOrDriver) {
      const names = vehicle.operatorOrDriver.split(',').map((s) => s.trim().toLowerCase());
      return employees
        .filter((emp) => names.includes(emp.name.toLowerCase()))
        .map((emp) => emp.id);
    }
    return [];
  }, [vehicle, employees]);

  const assignedDrivers = useMemo(() => {
    return employees.filter((e) => assignedDriverIds.includes(e.id));
  }, [employees, assignedDriverIds]);

  const assignedDriverNames = useMemo(() => {
    if (assignedDrivers.length > 0) return assignedDrivers.map((d) => d.name);
    if (vehicle.operatorOrDriver) return vehicle.operatorOrDriver.split(',').map((s) => s.trim());
    return [];
  }, [assignedDrivers, vehicle.operatorOrDriver]);

  // Set default driver in form
  React.useEffect(() => {
    if (!expenseDriverId && assignedDrivers.length > 0) {
      setExpenseDriverId(assignedDrivers[0].id);
    } else if (!expenseDriverId && employees.length > 0) {
      setExpenseDriverId(employees[0].id);
    }
  }, [assignedDrivers, employees, expenseDriverId]);

  // --- 4. Driver Expenses Breakdown (Alimentação, Salários, Rescisão, Diárias, etc.) ---
  const vehicleDriverExpenses = useMemo(() => {
    const plateClean = (vehicle.licensePlateOrSerial || '').toLowerCase().trim();
    const modelClean = (vehicle.model || vehicle.name || '').toLowerCase().trim();

    return localExpenses.filter((exp) => {
      // Direct machineryId match
      if (exp.machineryId === vehicle.id) {
        const cat = (exp.categoryName || exp.categoryId || '').toLowerCase();
        const desc = (exp.description || '').toLowerCase();
        const isDriverRelated = 
          cat.includes('aliment') || 
          cat.includes('refei') || 
          cat.includes('marmit') || 
          cat.includes('salár') || 
          cat.includes('salar') || 
          cat.includes('rescis') || 
          cat.includes('diári') || 
          cat.includes('diari') || 
          cat.includes('motorist') || 
          cat.includes('mão de obra') || 
          cat.includes('adiant') ||
          desc.includes('aliment') || 
          desc.includes('refei') || 
          desc.includes('marmit') || 
          desc.includes('salár') || 
          desc.includes('salar') || 
          desc.includes('rescis') || 
          desc.includes('diári') || 
          desc.includes('diari') || 
          desc.includes('motorist');
        if (isDriverRelated || exp.employeeId) return true;
      }

      // If associated to one of the assigned drivers
      if (exp.employeeId && assignedDriverIds.includes(exp.employeeId)) {
        return true;
      }

      // If description contains vehicle identification AND driver name
      const desc = (exp.description || '').toLowerCase();
      const hasVehicleTag = (plateClean && desc.includes(plateClean)) || (modelClean && desc.includes(modelClean));
      const hasDriverTag = assignedDriverNames.some((n) => n.length > 2 && desc.includes(n.toLowerCase()));

      return hasVehicleTag && hasDriverTag;
    }).sort((a, b) => new Date(b.dueDate || b.paymentDate || b.createdAt).getTime() - new Date(a.dueDate || a.paymentDate || a.createdAt).getTime());
  }, [localExpenses, vehicle, assignedDriverIds, assignedDriverNames]);

  // Driver Payroll Records
  const driverPayrolls = useMemo(() => {
    if (assignedDriverIds.length === 0) return [];
    return payrolls.filter((p) => assignedDriverIds.includes(p.employeeId));
  }, [payrolls, assignedDriverIds]);

  // Categorize Driver Costs
  const driverExpensesByCategory = useMemo(() => {
    let alimentacao = 0;
    let salarios = 0;
    let rescisao = 0;
    let diarias = 0;
    let outros = 0;

    vehicleDriverExpenses.forEach((exp) => {
      const text = `${exp.categoryName || ''} ${exp.description || ''}`.toLowerCase();
      if (text.includes('rescis') || text.includes('acerto') || text.includes('demiss') || text.includes('indeniz')) {
        rescisao += exp.amount;
      } else if (text.includes('aliment') || text.includes('refei') || text.includes('marmit') || text.includes('almoço') || text.includes('jantar')) {
        alimentacao += exp.amount;
      } else if (text.includes('diári') || text.includes('diari') || text.includes('viagem') || text.includes('pedágio')) {
        diarias += exp.amount;
      } else if (text.includes('salár') || text.includes('salar') || text.includes('adiant') || text.includes('folha') || text.includes('vale')) {
        salarios += exp.amount;
      } else {
        outros += exp.amount;
      }
    });

    // If no direct salary expense logged but payroll records exist, include net salaries from payrolls
    if (salarios === 0 && driverPayrolls.length > 0) {
      salarios = driverPayrolls.reduce((sum, p) => sum + (p.netSalary || p.baseSalary || 0), 0);
    } else if (salarios === 0 && assignedDrivers.length > 0) {
      // Contextual base salary
      salarios = assignedDrivers.reduce((sum, d) => sum + (d.salary || 0), 0);
    }

    const total = alimentacao + salarios + rescisao + diarias + outros;

    return {
      alimentacao,
      salarios,
      rescisao,
      diarias,
      outros,
      total,
    };
  }, [vehicleDriverExpenses, driverPayrolls, assignedDrivers]);

  // --- 5. Revenues from Services and Silage Delivery Orders ---
  const vehicleServices = useMemo(() => {
    return services.filter((srv) => {
      if (srv.machineryId === vehicle.id) return true;
      if (vehicle.licensePlateOrSerial && srv.machineryAssigned?.toLowerCase().includes(vehicle.licensePlateOrSerial.toLowerCase())) return true;
      if (vehicle.model && srv.machineryAssigned?.toLowerCase().includes(vehicle.model.toLowerCase())) return true;
      return false;
    });
  }, [services, vehicle]);

  const vehicleSilageOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (ord.machineryId === vehicle.id) return true;
      if (vehicle.licensePlateOrSerial && ord.machineryPlateOrName?.toLowerCase().includes(vehicle.licensePlateOrSerial.toLowerCase())) return true;
      if (vehicle.model && ord.machineryPlateOrName?.toLowerCase().includes(vehicle.model.toLowerCase())) return true;
      if (assignedDriverNames.some((n) => n.length > 2 && ord.driverName?.toLowerCase().includes(n.toLowerCase()))) return true;
      return false;
    });
  }, [orders, vehicle, assignedDriverNames]);

  const totalServicesRevenue = useMemo(() => {
    return vehicleServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }, [vehicleServices]);

  const totalFreightRevenue = useMemo(() => {
    return vehicleSilageOrders.reduce((sum, o) => {
      return sum + (o.freightCost || (o.freightType === 'CIF' ? o.totalAmount * 0.15 : o.totalAmount));
    }, 0);
  }, [vehicleSilageOrders]);

  const totalGrossRevenue = totalServicesRevenue + totalFreightRevenue;

  // --- 6. Direct Machinery Operating Costs ---
  const totalFuelCost = consumptionMetrics.totalFuelCost;
  const totalMaintenanceCost = vehicleMaintenanceLogs.reduce((sum, m) => sum + (m.totalCost || 0), 0);

  // Other vehicle direct expenses (IPVA, seguro, licenciamento, pneus)
  const otherVehicleCosts = useMemo(() => {
    return localExpenses
      .filter((exp) => {
        if (exp.machineryId !== vehicle.id) return false;
        const cat = (exp.categoryName || exp.categoryId || '').toLowerCase();
        const desc = (exp.description || '').toLowerCase();
        // Exclude fuel, maintenance and driver
        const isFuel = cat.includes('combust') || desc.includes('combust') || desc.includes('diesel');
        const isMaint = cat.includes('manut') || desc.includes('manut') || desc.includes('oficina') || desc.includes('peça');
        const isDriver = cat.includes('aliment') || cat.includes('salár') || cat.includes('rescis') || cat.includes('diári') || exp.employeeId;
        return !isFuel && !isMaint && !isDriver;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [localExpenses, vehicle.id]);

  const totalDirectVehicleCosts = totalFuelCost + totalMaintenanceCost + otherVehicleCosts;
  const totalDriverCosts = driverExpensesByCategory.total;
  const totalOperatingCosts = totalDirectVehicleCosts + totalDriverCosts;

  // --- 7. DRE Net Profit and Operational Margins ---
  const netProfit = totalGrossRevenue - totalOperatingCosts;
  const profitMargin = totalGrossRevenue > 0 ? (netProfit / totalGrossRevenue) * 100 : 0;

  // Unit costs: Total cost per KM and per Hour
  const totalKmRecorded = consumptionMetrics.totalKmDriven || (vehicle.currentKm ? vehicle.currentKm : 0);
  const totalHoursRecorded = consumptionMetrics.totalHoursWorked || (vehicle.hourMeter ? vehicle.hourMeter : 0);

  const costPerKmAllInclusive = totalKmRecorded > 0 ? parseFloat((totalOperatingCosts / totalKmRecorded).toFixed(2)) : null;
  const costPerHourAllInclusive = totalHoursRecorded > 0 ? parseFloat((totalOperatingCosts / totalHoursRecorded).toFixed(2)) : null;

  // --- 8. Save Driver Expense Handler ---
  const handleSaveQuickDriverExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) {
      alert('Por favor, preencha a descrição e o valor da despesa.');
      return;
    }

    const matchedEmp = employees.find((emp) => emp.id === expenseDriverId);
    const driverName = matchedEmp?.name || assignedDriverNames[0] || 'Motorista / Operador';

    const categoryMap = {
      alimentacao: { id: 'cat_alimentacao', name: 'Alimentação & Refeições de Campo', color: '#ea580c' },
      salario: { id: 'cat_salarios', name: 'Salários & Remunerações', color: '#0284c7' },
      rescisao: { id: 'cat_rescisao', name: 'Rescisão & Encargos Trabalhistas', color: '#dc2626' },
      diaria: { id: 'cat_diarias', name: 'Diárias & Viagens de Campo', color: '#7c3aed' },
      outro: { id: 'cat_outros', name: 'Outras Despesas de Motorista', color: '#64748b' },
    };

    const catObj = categoryMap[expenseCategory];

    const newExpense: Expense = {
      id: `exp_drv_${Date.now()}`,
      description: `[${vehicle.licensePlateOrSerial || vehicle.name}] ${expenseDesc.trim()} (${driverName})`,
      amount: parseFloat(expenseAmount.replace(',', '.')) || 0,
      categoryId: catObj.id,
      categoryName: catObj.name,
      categoryColor: catObj.color,
      dueDate: expenseDate,
      paymentDate: expenseDate,
      status: 'pago',
      paymentMethod: expensePaymentMethod,
      supplier: driverName,
      machineryId: vehicle.id,
      machineryName: vehicle.licensePlateOrSerial || vehicle.name,
      employeeId: matchedEmp?.id,
      employeeName: driverName,
      notes: `${expenseNotes.trim()} • Categoria: ${catObj.name}. Lançamento vinculado ao veículo ${vehicle.licensePlateOrSerial || vehicle.name}`.trim(),
      createdAt: new Date().toISOString(),
    };

    // 1. Call onAddExpense callback if provided
    if (onAddExpense) {
      onAddExpense(newExpense);
    }

    // 2. Persist to storage and local state
    const currentStored = getStoredExpenses();
    const updatedExpenses = [newExpense, ...currentStored];
    saveStoredExpenses(updatedExpenses);
    setLocalExpenses(updatedExpenses);

    // Reset form and close
    setIsAddingDriverExpense(false);
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseNotes('');
  };

  const handlePrintDRE = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
      
      {/* Sub-tabs Header - 100% da largura de ponta a ponta, sem barra de rolagem */}
      <div className="w-full pb-2.5 border-b border-stone-200 dark:border-stone-800">
        <div className="w-full grid grid-cols-5 gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('resumo_consumo')}
            className={`w-full py-1.5 px-1 sm:px-2 rounded-lg text-xs sm:text-[13px] font-bold transition flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeSubTab === 'resumo_consumo'
                ? 'bg-blue-100 dark:bg-blue-950/70 border-2 border-[#0963cb]'
                : 'bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}
            style={{ color: '#000000' }}
          >
            <Gauge className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'resumo_consumo' ? 'text-[#0963cb]' : 'text-stone-700 dark:text-stone-300'}`} />
            <span className="truncate" style={{ color: '#000000' }}>Médias de Consumo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('dre')}
            className={`w-full py-1.5 px-1 sm:px-2 rounded-lg text-xs sm:text-[13px] font-bold transition flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeSubTab === 'dre'
                ? 'bg-blue-100 dark:bg-blue-950/70 border-2 border-[#0963cb]'
                : 'bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}
            style={{ color: '#000000' }}
          >
            <Receipt className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'dre' ? 'text-[#0963cb]' : 'text-stone-700 dark:text-stone-300'}`} />
            <span className="truncate" style={{ color: '#000000' }}>DRE do Veículo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('motoristas')}
            className={`w-full py-1.5 px-1 sm:px-2 rounded-lg text-xs sm:text-[13px] font-bold transition flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeSubTab === 'motoristas'
                ? 'bg-blue-100 dark:bg-blue-950/70 border-2 border-[#0963cb]'
                : 'bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}
            style={{ color: '#000000' }}
          >
            <Users className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'motoristas' ? 'text-[#0963cb]' : 'text-stone-700 dark:text-stone-300'}`} />
            <span className="truncate" style={{ color: '#000000' }}>Despesas do Motorista</span>
            {vehicleDriverExpenses.length > 0 && (
              <span className="text-[10px] font-bold opacity-80 shrink-0" style={{ color: '#000000' }}>
                ({vehicleDriverExpenses.length})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('abastecimentos')}
            className={`w-full py-1.5 px-1 sm:px-2 rounded-lg text-xs sm:text-[13px] font-bold transition flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeSubTab === 'abastecimentos'
                ? 'bg-blue-100 dark:bg-blue-950/70 border-2 border-[#0963cb]'
                : 'bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}
            style={{ color: '#000000' }}
          >
            <Fuel className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'abastecimentos' ? 'text-[#0963cb]' : 'text-stone-700 dark:text-stone-300'}`} />
            <span className="truncate" style={{ color: '#000000' }}>Abastecimentos</span>
            {vehicleFuelLogs.length > 0 && (
              <span className="text-[10px] font-bold opacity-80 shrink-0" style={{ color: '#000000' }}>
                ({vehicleFuelLogs.length})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('manutencoes')}
            className={`w-full py-1.5 px-1 sm:px-2 rounded-lg text-xs sm:text-[13px] font-bold transition flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer whitespace-nowrap shadow-2xs ${
              activeSubTab === 'manutencoes'
                ? 'bg-blue-100 dark:bg-blue-950/70 border-2 border-[#0963cb]'
                : 'bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}
            style={{ color: '#000000' }}
          >
            <Wrench className={`w-3.5 h-3.5 shrink-0 ${activeSubTab === 'manutencoes' ? 'text-[#0963cb]' : 'text-stone-700 dark:text-stone-300'}`} />
            <span className="truncate" style={{ color: '#000000' }}>Manutenções</span>
            {vehicleMaintenanceLogs.length > 0 && (
              <span className="text-[10px] font-bold opacity-80 shrink-0" style={{ color: '#000000' }}>
                ({vehicleMaintenanceLogs.length})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SUB-TAB 1: MÉDIAS DE CONSUMO EM HORAS E KM                   */}
      {/* ============================================================ */}
      {activeSubTab === 'resumo_consumo' && (
        <div className="space-y-4">
          
          {/* Main 2-Column Focus: KM Consumption vs Hours Consumption */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: Consumo em KM (Quilômetros) */}
            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
                      Consumo em Quilômetros (KM)
                    </h4>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">
                      Para caminhões, carretas, picapes e veículos de rodagem
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Odômetro
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-blue-100 dark:border-stone-800">
                  <span className="text-[10px] font-bold uppercase text-stone-500">Média de Consumo</span>
                  <div className="text-xl font-black text-blue-700 dark:text-blue-400 mt-0.5">
                    {consumptionMetrics.avgKmPerLiter !== null ? (
                      <span>{consumptionMetrics.avgKmPerLiter.toLocaleString('pt-BR')} <span className="text-xs font-semibold">km/L</span></span>
                    ) : (
                      <span className="text-stone-400 text-sm font-semibold">Sem dados de KM</span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Quilômetros percorridos por litro
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-blue-100 dark:border-stone-800">
                  <span className="text-[10px] font-bold uppercase text-stone-500">Custo Combustível / KM</span>
                  <div className="text-xl font-black text-blue-900 dark:text-blue-200 mt-0.5">
                    {consumptionMetrics.avgCostPerKm !== null && consumptionMetrics.avgCostPerKm !== undefined ? (
                      <span>{formatCurrencyBRL(consumptionMetrics.avgCostPerKm)} <span className="text-xs font-semibold">/ km</span></span>
                    ) : (
                      <span className="text-stone-400 text-sm font-semibold">--</span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Gasto direto de diesel por KM
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-blue-900 dark:text-blue-200 font-medium px-1">
                <span>🚗 Odômetro Atual: <strong>{vehicle.currentKm ? `${vehicle.currentKm.toLocaleString('pt-BR')} km` : '--'}</strong></span>
                <span>🛣️ Total KM no Histórico: <strong>{consumptionMetrics.totalKmDriven ? `${consumptionMetrics.totalKmDriven.toLocaleString('pt-BR')} km` : '--'}</strong></span>
              </div>
            </div>

            {/* Card 2: Consumo em Horas (Horímetro) */}
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Consumo em Horas (Horímetro)
                    </h4>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Para tratores, forrageiras, ensiladeiras e pás carregadeiras
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Horímetro
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-amber-100 dark:border-stone-800">
                  <span className="text-[10px] font-bold uppercase text-stone-500">Média de Consumo</span>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {consumptionMetrics.avgLitersPerHour !== null ? (
                      <span>{consumptionMetrics.avgLitersPerHour.toLocaleString('pt-BR')} <span className="text-xs font-semibold">L/hora</span></span>
                    ) : (
                      <span className="text-stone-400 text-sm font-semibold">Sem dados de Horas</span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Litros consumidos por hora trabalhada
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-amber-100 dark:border-stone-800">
                  <span className="text-[10px] font-bold uppercase text-stone-500">Custo Combustível / Hora</span>
                  <div className="text-xl font-black text-amber-900 dark:text-amber-200 mt-0.5">
                    {consumptionMetrics.avgCostPerHour !== null && consumptionMetrics.avgCostPerHour !== undefined ? (
                      <span>{formatCurrencyBRL(consumptionMetrics.avgCostPerHour)} <span className="text-xs font-semibold">/ h</span></span>
                    ) : (
                      <span className="text-stone-400 text-sm font-semibold">--</span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    Gasto direto de diesel por hora
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-amber-900 dark:text-amber-200 font-medium px-1">
                <span>⏱️ Horímetro Atual: <strong>{vehicle.hourMeter ? `${vehicle.hourMeter.toLocaleString('pt-BR')} h` : '--'}</strong></span>
                <span>🚜 Total Horas no Histórico: <strong>{consumptionMetrics.totalHoursWorked ? `${consumptionMetrics.totalHoursWorked.toLocaleString('pt-BR')} h` : '--'}</strong></span>
              </div>
            </div>

          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="text-[10px] font-bold uppercase text-stone-500">Abastecimento Total</span>
              <div className="text-lg font-black text-amber-600 mt-0.5">
                {consumptionMetrics.totalLiters.toLocaleString('pt-BR')} <span className="text-xs font-semibold">Litros</span>
              </div>
              <p className="text-[11px] text-stone-500">
                {formatCurrencyBRL(consumptionMetrics.totalFuelCost)} ({vehicleFuelLogs.length} abastecimentos)
              </p>
              {consumptionMetrics.avgFuelPricePerLiter && (
                <div className="text-[10px] text-stone-400 font-medium mt-1">
                  Preço médio: {formatCurrencyBRL(consumptionMetrics.avgFuelPricePerLiter)} / L
                </div>
              )}
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="text-[10px] font-bold uppercase text-stone-500">Manutenção & Peças</span>
              <div className="text-lg font-black text-sky-600 mt-0.5">
                {formatCurrencyBRL(totalMaintenanceCost)}
              </div>
              <p className="text-[11px] text-stone-500">
                {vehicleMaintenanceLogs.length} ordens de serviço realizadas
              </p>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
              <span className="text-[10px] font-bold uppercase text-stone-500">Despesas com Motoristas</span>
              <div className="text-lg font-black text-emerald-600 mt-0.5">
                {formatCurrencyBRL(driverExpensesByCategory.total)}
              </div>
              <p className="text-[11px] text-stone-500">
                Alimentação, salários, rescisões e diárias
              </p>
            </div>
          </div>

          {/* Quick Preview Table of Recent Fuelings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center space-x-1.5">
                <Fuel className="w-4 h-4 text-amber-600" />
                <span>Últimos Abastecimentos & Médias Registradas</span>
              </h4>
              <button
                type="button"
                onClick={() => setActiveSubTab('abastecimentos')}
                className="text-xs text-cyan-700 dark:text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                Ver todos ({vehicleFuelLogs.length})
              </button>
            </div>

            {vehicleFuelLogs.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-stone-200 dark:border-stone-700 rounded-xl text-stone-400 text-xs">
                Nenhum abastecimento registrado ainda para este veículo.
              </div>
            ) : (
              <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold border-b border-stone-200 dark:border-stone-700">
                    <tr>
                      <th className="p-2.5">Data</th>
                      <th className="p-2.5">Combustível</th>
                      <th className="p-2.5">Litros</th>
                      <th className="p-2.5">Total</th>
                      <th className="p-2.5">Horímetro / KM</th>
                      <th className="p-2.5">Média Calculada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {vehicleFuelLogs.slice(0, 5).map((log) => (
                      <tr key={log.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                        <td className="p-2.5 font-medium">{formatDateBR(log.date)}</td>
                        <td className="p-2.5">{log.fuelType}</td>
                        <td className="p-2.5 font-bold text-amber-600">{log.liters.toLocaleString('pt-BR')} L</td>
                        <td className="p-2.5 font-bold">{formatCurrencyBRL(log.totalAmount)}</td>
                        <td className="p-2.5 font-mono">
                          {log.currentKm ? `${log.currentKm.toLocaleString('pt-BR')} km` : ''}
                          {log.currentHourMeter ? `${log.currentHourMeter.toLocaleString('pt-BR')} h` : ''}
                          {!log.currentKm && !log.currentHourMeter ? (log.currentHourMeterOrKm || '--') : ''}
                        </td>
                        <td className="p-2.5">
                          {log.averageKmPerLiter ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                              {log.averageKmPerLiter} km/L
                            </span>
                          ) : log.averageLitersPerHour ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                              {log.averageLitersPerHour} L/h
                            </span>
                          ) : (
                            <span className="text-stone-400">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 2: DRE DO VEÍCULO (DEMONSTRATIVO DE RESULTADO)       */}
      {/* ============================================================ */}
      {activeSubTab === 'dre' && (
        <div className="space-y-4">
          {/* Print Header */}
          <div className="hidden print:block mb-3">
            <PrintReportHeader
              companyProfile={getStoredCompanyProfile()}
              reportTitle="DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO (DRE)"
              reportSubtitle={`Veículo: ${vehicle.licensePlateOrSerial || vehicle.name} • ${vehicle.brand || ''} ${vehicle.model || ''}`}
              documentTypeBadge="DRE DO VEÍCULO"
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
            <div>
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                Demonstrativo de Resultado do Exercício (DRE)
              </h3>
              <p className="text-xs text-stone-500">
                Veículo: <strong className="text-stone-800 dark:text-stone-200">{vehicle.licensePlateOrSerial || vehicle.name}</strong> • {vehicle.brand} {vehicle.model}
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrintDRE}
              className="px-3 py-1.5 bg-[#0963cb] hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir DRE</span>
            </button>
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 space-y-4 shadow-xs">
            
            {/* 1. (+) RECEITA BRUTA OPERACIONAL */}
            <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-2">
              <div className="flex justify-between items-center text-sm font-black text-emerald-900 dark:text-emerald-200">
                <span className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-xs">+</span>
                  <span>RECEITA BRUTA OPERACIONAL (FATURAMENTO)</span>
                </span>
                <span className="text-base font-extrabold">{formatCurrencyBRL(totalGrossRevenue)}</span>
              </div>
              <div className="pl-7 space-y-1 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                <div className="flex justify-between">
                  <span>• Serviços de Colheita, Ensilagem & Corte ({vehicleServices.length} ordens)</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(totalServicesRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Faturamento de Fretes & Entregas de Silagem ({vehicleSilageOrders.length} entregas)</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(totalFreightRevenue)}</span>
                </div>
              </div>
            </div>

            {/* 2. (-) CUSTOS OPERACIONAIS DIRETOS DO VEÍCULO */}
            <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-2">
              <div className="flex justify-between items-center text-sm font-black text-amber-900 dark:text-amber-200">
                <span className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-amber-600 text-white flex items-center justify-center text-xs">-</span>
                  <span>CUSTOS OPERACIONAIS DIRETOS DO VEÍCULO</span>
                </span>
                <span className="text-base font-extrabold">{formatCurrencyBRL(totalDirectVehicleCosts)}</span>
              </div>
              <div className="pl-7 space-y-1 text-xs text-amber-800 dark:text-amber-300 font-medium">
                <div className="flex justify-between">
                  <span>• Combustível ({consumptionMetrics.totalLiters.toLocaleString('pt-BR')} L abastecidos em {vehicleFuelLogs.length} notas)</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(totalFuelCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Manutenções Preventivas & Corretivas, Peças e Óleos ({vehicleMaintenanceLogs.length} manutenções)</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(totalMaintenanceCost)}</span>
                </div>
                {otherVehicleCosts > 0 && (
                  <div className="flex justify-between">
                    <span>• Outros Custos Diretos (Pneus, IPVA, Licenciamento, Seguro)</span>
                    <span className="font-mono font-bold">{formatCurrencyBRL(otherVehicleCosts)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. (-) DESPESAS COM MOTORISTAS & OPERADORES */}
            <div className="p-3.5 bg-sky-50/70 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-900/60 space-y-2">
              <div className="flex justify-between items-center text-sm font-black text-sky-900 dark:text-sky-200">
                <span className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-md bg-sky-600 text-white flex items-center justify-center text-xs">-</span>
                  <span>DESPESAS COM MOTORISTAS & OPERADORES</span>
                </span>
                <span className="text-base font-extrabold">{formatCurrencyBRL(totalDriverCosts)}</span>
              </div>
              <div className="pl-7 space-y-1 text-xs text-sky-800 dark:text-sky-300 font-medium">
                <div className="flex justify-between">
                  <span>• Salários e Remunerações dos Motoristas ({assignedDriverNames.join(', ') || 'Motoristas'})</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(driverExpensesByCategory.salarios)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Alimentação, Marmitas & Refeições de Campo</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(driverExpensesByCategory.alimentacao)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Rescisões Trabalhistas, Encargos & Férias</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatCurrencyBRL(driverExpensesByCategory.rescisao)}</span>
                </div>
                {driverExpensesByCategory.diarias > 0 && (
                  <div className="flex justify-between">
                    <span>• Diárias de Viagem & Despesas de Campo</span>
                    <span className="font-mono font-bold">{formatCurrencyBRL(driverExpensesByCategory.diarias)}</span>
                  </div>
                )}
                {driverExpensesByCategory.outros > 0 && (
                  <div className="flex justify-between">
                    <span>• Outros Reembolsos / Despesas do Motorista</span>
                    <span className="font-mono font-bold">{formatCurrencyBRL(driverExpensesByCategory.outros)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 4. (=) RESULTADO / LUCRO LÍQUIDO DO VEÍCULO */}
            <div className="p-4 bg-stone-900 dark:bg-stone-850 text-white rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-xs uppercase font-bold text-stone-400 tracking-wider">
                  (=) RESULTADO OPERACIONAL LÍQUIDO DO VEÍCULO
                </span>
                <div className="text-xs text-stone-300 mt-0.5">
                  Margem Líquida sobre Faturamento: <strong className={profitMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{profitMargin.toFixed(1)}%</strong>
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrencyBRL(netProfit)}
              </div>
            </div>

            {/* Unit Performance Indicators: Cost per KM and Cost per Hour */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] font-bold uppercase text-stone-500">Custo Operacional Total por KM</span>
                <div className="text-base font-black text-stone-800 dark:text-stone-200 mt-0.5">
                  {costPerKmAllInclusive ? `${formatCurrencyBRL(costPerKmAllInclusive)} / km` : '--'}
                </div>
                <p className="text-[10px] text-stone-400">
                  Inclui combustível + manutenção + motorista por KM
                </p>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-[10px] font-bold uppercase text-stone-500">Custo Operacional Total por Hora</span>
                <div className="text-base font-black text-stone-800 dark:text-stone-200 mt-0.5">
                  {costPerHourAllInclusive ? `${formatCurrencyBRL(costPerHourAllInclusive)} / h` : '--'}
                </div>
                <p className="text-[10px] text-stone-400">
                  Inclui combustível + manutenção + motorista por hora
                </p>
              </div>
            </div>

          </div>

          {/* Print Footer */}
          <div className="hidden print:block mt-4">
            <PrintReportFooter
              showSignatures={true}
              signatureLabels={['Controladoria / Gestão de Frota', 'Diretoria / Operações']}
              companyName={getStoredCompanyProfile()?.tradeName || 'Silagem Fácil ERP'}
              authCode={`DRE-${(vehicle.licensePlateOrSerial || vehicle.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`}
            />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 3: DESPESAS DO MOTORISTA (ALIMENTAÇÃO, SALÁRIOS...)   */}
      {/* ============================================================ */}
      {activeSubTab === 'motoristas' && (
        <div className="space-y-4">
          
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                Despesas Vinculadas aos Motoristas / Operadores
              </h3>
              <p className="text-xs text-stone-500">
                Alimentação de campo, marmitas, salários, rescisões e diárias somadas aos custos do veículo
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingDriverExpense(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Lançar Despesa do Motorista</span>
            </button>
          </div>

          {/* 4 Cards breakdown by driver category */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60 rounded-xl">
              <div className="flex items-center space-x-1.5 text-orange-800 dark:text-orange-200 text-xs font-bold">
                <Utensils className="w-3.5 h-3.5" />
                <span>Alimentação</span>
              </div>
              <div className="text-base font-black text-orange-900 dark:text-orange-100 mt-1">
                {formatCurrencyBRL(driverExpensesByCategory.alimentacao)}
              </div>
              <p className="text-[10px] text-orange-700 dark:text-orange-300">Marmitas e refeições</p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl">
              <div className="flex items-center space-x-1.5 text-blue-800 dark:text-blue-200 text-xs font-bold">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Salários</span>
              </div>
              <div className="text-base font-black text-blue-900 dark:text-blue-100 mt-1">
                {formatCurrencyBRL(driverExpensesByCategory.salarios)}
              </div>
              <p className="text-[10px] text-blue-700 dark:text-blue-300">Remuneração & vales</p>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl">
              <div className="flex items-center space-x-1.5 text-rose-800 dark:text-rose-200 text-xs font-bold">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Rescisão & Encargos</span>
              </div>
              <div className="text-base font-black text-rose-900 dark:text-rose-100 mt-1">
                {formatCurrencyBRL(driverExpensesByCategory.rescisao)}
              </div>
              <p className="text-[10px] text-rose-700 dark:text-rose-300">Rescisões trabalhistas</p>
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 rounded-xl">
              <div className="flex items-center space-x-1.5 text-purple-800 dark:text-purple-200 text-xs font-bold">
                <Wallet className="w-3.5 h-3.5" />
                <span>Diárias & Outros</span>
              </div>
              <div className="text-base font-black text-purple-900 dark:text-purple-100 mt-1">
                {formatCurrencyBRL(driverExpensesByCategory.diarias + driverExpensesByCategory.outros)}
              </div>
              <p className="text-[10px] text-purple-700 dark:text-purple-300">Viagens e reembolsos</p>
            </div>
          </div>

          {/* Assigned Drivers Info */}
          {assignedDrivers.length > 0 && (
            <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-stone-600 dark:text-stone-300">
                Motoristas Atribuídos ao Veículo:
              </span>
              <div className="flex flex-wrap gap-2">
                {assignedDrivers.map((drv) => (
                  <span
                    key={drv.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 shadow-2xs"
                  >
                    👤 {drv.name} <span className="text-stone-400 ml-1">({drv.role})</span>
                    {drv.salary ? <strong className="ml-1.5 text-emerald-600">{formatCurrencyBRL(drv.salary)}/mês</strong> : null}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Driver Expenses List Table */}
          {vehicleDriverExpenses.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-stone-200 dark:border-stone-700 rounded-xl text-stone-400 text-xs space-y-2">
              <Utensils className="w-6 h-6 mx-auto text-stone-300" />
              <p>Nenhuma despesa de motorista registrada especificamente para este veículo ainda.</p>
              <button
                type="button"
                onClick={() => setIsAddingDriverExpense(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                + Registrar Primeira Despesa (Alimentação, Salário, Rescisão)
              </button>
            </div>
          ) : (
            <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="p-2.5">Data</th>
                    <th className="p-2.5">Motorista</th>
                    <th className="p-2.5">Categoria</th>
                    <th className="p-2.5">Descrição</th>
                    <th className="p-2.5">Pagamento</th>
                    <th className="p-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {vehicleDriverExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                      <td className="p-2.5 font-medium whitespace-nowrap">{formatDateBR(exp.dueDate || exp.paymentDate || exp.createdAt)}</td>
                      <td className="p-2.5 font-bold text-stone-800 dark:text-stone-200">{exp.employeeName || exp.supplier || '--'}</td>
                      <td className="p-2.5">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: exp.categoryColor || '#0284c7' }}
                        >
                          {exp.categoryName || 'Despesa'}
                        </span>
                      </td>
                      <td className="p-2.5 font-medium text-stone-700 dark:text-stone-300 max-w-xs truncate" title={exp.description}>
                        {exp.description}
                      </td>
                      <td className="p-2.5 uppercase text-[10px] font-bold text-stone-500">
                        {exp.paymentMethod}
                      </td>
                      <td className="p-2.5 text-right font-black font-mono text-rose-600 dark:text-rose-400">
                        {formatCurrencyBRL(exp.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 4: ABASTECIMENTOS COMPLETOS                          */}
      {/* ============================================================ */}
      {activeSubTab === 'abastecimentos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                Histórico Completo de Abastecimentos ({vehicleFuelLogs.length})
              </h3>
              <p className="text-xs text-stone-500">
                Total de <strong>{consumptionMetrics.totalLiters.toLocaleString('pt-BR')} L</strong> ({formatCurrencyBRL(consumptionMetrics.totalFuelCost)})
              </p>
            </div>
          </div>

          {vehicleFuelLogs.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-stone-200 dark:border-stone-700 rounded-xl text-stone-400 text-xs">
              Nenhum abastecimento registrado ainda para este veículo.
            </div>
          ) : (
            <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="p-2.5">Data</th>
                    <th className="p-2.5">Combustível</th>
                    <th className="p-2.5">Litros</th>
                    <th className="p-2.5">Preço/L</th>
                    <th className="p-2.5">Valor Total</th>
                    <th className="p-2.5">Leitura</th>
                    <th className="p-2.5">Média Pontual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {vehicleFuelLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                      <td className="p-2.5 font-medium whitespace-nowrap">{formatDateBR(log.date)}</td>
                      <td className="p-2.5">{log.fuelType}</td>
                      <td className="p-2.5 font-bold text-amber-600">{log.liters.toLocaleString('pt-BR')} L</td>
                      <td className="p-2.5 font-mono">{log.pricePerLiter ? formatCurrencyBRL(log.pricePerLiter) : '--'}</td>
                      <td className="p-2.5 font-bold">{formatCurrencyBRL(log.totalAmount)}</td>
                      <td className="p-2.5 font-mono">
                        {log.currentKm ? `${log.currentKm.toLocaleString('pt-BR')} km` : ''}
                        {log.currentHourMeter ? `${log.currentHourMeter.toLocaleString('pt-BR')} h` : ''}
                        {!log.currentKm && !log.currentHourMeter ? (log.currentHourMeterOrKm || '--') : ''}
                      </td>
                      <td className="p-2.5">
                        {log.averageKmPerLiter ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                            {log.averageKmPerLiter} km/L
                          </span>
                        ) : log.averageLitersPerHour ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            {log.averageLitersPerHour} L/h
                          </span>
                        ) : (
                          <span className="text-stone-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-TAB 5: MANUTENÇÕES REALIZADAS                            */}
      {/* ============================================================ */}
      {activeSubTab === 'manutencoes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                Ordens de Manutenção Realizadas ({vehicleMaintenanceLogs.length})
              </h3>
              <p className="text-xs text-stone-500">
                Total acumulado de <strong>{formatCurrencyBRL(totalMaintenanceCost)}</strong>
              </p>
            </div>
          </div>

          {vehicleMaintenanceLogs.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-stone-200 dark:border-stone-700 rounded-xl text-stone-400 text-xs">
              Nenhuma ordem de manutenção registrada ainda para este veículo.
            </div>
          ) : (
            <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="p-2.5">Data</th>
                    <th className="p-2.5">Serviço / Descrição</th>
                    <th className="p-2.5">Tipo</th>
                    <th className="p-2.5">Leitura</th>
                    <th className="p-2.5">Custo Total</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {vehicleMaintenanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50">
                      <td className="p-2.5 font-medium whitespace-nowrap">{formatDateBR(log.date)}</td>
                      <td className="p-2.5 font-semibold text-stone-800 dark:text-stone-200">
                        {log.serviceCategory || log.description}
                      </td>
                      <td className="p-2.5 capitalize">{log.type}</td>
                      <td className="p-2.5 font-mono">{log.currentHourMeterOrKm || '--'}</td>
                      <td className="p-2.5 font-bold text-rose-600">{formatCurrencyBRL(log.totalCost)}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'concluida' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {log.status === 'concluida' ? 'Concluída' : 'Em andamento'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setViewingMaintenanceLog(log)}
                          title="Abrir itens / Visualizar detalhes da OS"
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 text-[11px] font-bold transition cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Abrir itens</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL RÁPIDO: LANÇAR DESPESA DO MOTORISTA                   */}
      {/* ============================================================ */}
      {isAddingDriverExpense && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-stone-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-stone-900 dark:text-stone-100">
                    Lançar Despesa do Motorista
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Alimentação, Salários, Rescisões e Diárias ligadas ao veículo {vehicle.licensePlateOrSerial || vehicle.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingDriverExpense(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickDriverExpense} className="space-y-3">
              
              {/* Motorista */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Motorista / Operador Beneficiário *
                </label>
                <select
                  value={expenseDriverId}
                  onChange={(e) => setExpenseDriverId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                  required
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role || 'Colaborador'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Despesa */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Tipo / Natureza da Despesa *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseCategory('alimentacao')}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                      expenseCategory === 'alimentacao'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Alimentação</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseCategory('salario')}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                      expenseCategory === 'salario'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Salários / Vales</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseCategory('rescisao')}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                      expenseCategory === 'rescisao'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Rescisão / Acerto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseCategory('diaria')}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer ${
                      expenseCategory === 'diaria'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Diárias de Campo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseCategory('outro')}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 cursor-pointer col-span-2 sm:col-span-2 ${
                      expenseCategory === 'outro'
                        ? 'bg-stone-700 text-white border-stone-700 shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Outras Despesas de Motorista</span>
                  </button>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Descrição do Lançamento *
                </label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Marmitas equipe colheita, Rescisão de contrato, Adiantamento de diária..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                  required
                />
              </div>

              {/* Valor e Data */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                    required
                  />
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={expensePaymentMethod}
                  onChange={(e) => setExpensePaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência Bancária</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Observações adicionais (opcional)
                </label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Ex: Refeições durante colheita de silagem na Fazenda Primavera"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddingDriverExpense(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar e Lançar</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Footer Close Button */}
      <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-end">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold hover:bg-stone-300 transition cursor-pointer"
          >
            Fechar
          </button>
        )}
      </div>

      {/* Modal de Impressão / Detalhamento da OS */}
      <MaintenanceDetailModal
        isOpen={!!viewingMaintenanceLog}
        onClose={() => setViewingMaintenanceLog(null)}
        log={viewingMaintenanceLog}
        machinery={vehicle || undefined}
        companyProfile={getStoredCompanyProfile()}
      />

    </div>
  );
};
