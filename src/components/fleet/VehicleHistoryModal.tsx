import React, { useState, useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Fuel, 
  Wrench, 
  UserCheck, 
  Users, 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Gauge, 
  Utensils, 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  Box, 
  MapPin, 
  AlertCircle,
  Truck,
  Tractor,
  Layers,
  Sparkles,
  ChevronRight,
  Receipt
} from 'lucide-react';
import { Machinery, Employee, FuelLog, MaintenanceLog, Expense, ServiceOrder, SilageOrder } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredCompanyProfile } from '../../lib/storage';
import { calculateVehicleConsumptionMetrics } from '../../lib/fleetMetrics';
import { PrintReportHeader } from '../common/PrintReportHeader';
import { PrintReportFooter } from '../common/PrintReportFooter';

interface VehicleHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle?: Machinery | null;
  machinery?: Machinery | null;
  employees: Employee[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  expenses: Expense[];
  services?: ServiceOrder[];
  orders?: SilageOrder[];
  onNewFuel?: (vehicleId: string) => void;
  onNewMaintenance?: (vehicleId: string) => void;
  onAddService?: (service: Partial<ServiceOrder>) => void;
  onAddExpense?: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
}

const VehicleHistoryModalContent: React.FC<VehicleHistoryModalProps & { vehicle: Machinery }> = ({
  isOpen,
  onClose,
  vehicle,
  employees,
  fuelLogs,
  maintenanceLogs,
  expenses,
  services = [],
  orders = [],
  onNewFuel,
  onNewMaintenance,
  onAddService,
  onAddExpense,
}) => {
  // Tabs: 'resumo' | 'pedidos' | 'combustivel' | 'manutencoes' | 'motoristas' | 'dre'
  const [activeTab, setActiveTab] = useState<'resumo' | 'pedidos' | 'combustivel' | 'manutencoes' | 'motoristas' | 'dre'>('pedidos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'todos' | '30d' | '90d' | 'safra'>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Quick Service Creation Modal state within Vehicle History
  const [isAddingService, setIsAddingService] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newFarmName, setNewFarmName] = useState('');
  const [newOrderNumber, setNewOrderNumber] = useState(`OS-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newServiceType, setNewServiceType] = useState('Ensilagem');
  const [newAreaHectares, setNewAreaHectares] = useState<number | ''>(25);
  const [newTonsEstimated, setNewTonsEstimated] = useState<number | ''>(1000);
  const [newRatePerUnit, setNewRatePerUnit] = useState<number | ''>(120);
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDriverSelected, setNewDriverSelected] = useState(
    vehicle?.assignedDrivers && vehicle.assignedDrivers.length > 0
      ? vehicle.assignedDrivers[0]
      : (vehicle?.operatorOrDriver || '')
  );

  // Quick Driver Expense Creation Modal state
  const [isAddingDriverExpense, setIsAddingDriverExpense] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseCategory, setExpenseCategory] = useState<'alimentacao' | 'diaria' | 'salario' | 'rescisao' | 'outro'>('alimentacao');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseDriver, setExpenseDriver] = useState(
    vehicle?.assignedDrivers && vehicle.assignedDrivers.length > 0
      ? vehicle.assignedDrivers[0]
      : (vehicle?.operatorOrDriver || '')
  );

  // --- 1. Identify Drivers Associated With Vehicle ---
  const assignedDriverNames = useMemo(() => {
    const list: string[] = [];
    if (vehicle.assignedDrivers && vehicle.assignedDrivers.length > 0) {
      list.push(...vehicle.assignedDrivers);
    }
    if (vehicle.operatorOrDriver) {
      const parts = vehicle.operatorOrDriver.split(',').map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        if (!list.includes(p)) list.push(p);
      });
    }
    return list;
  }, [vehicle]);

  const assignedDriverObjs = useMemo(() => {
    return employees.filter(emp => {
      if (vehicle.assignedDriverIds && vehicle.assignedDriverIds.includes(emp.id)) return true;
      if (assignedDriverNames.some(name => emp.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(emp.name.toLowerCase()))) {
        return true;
      }
      return false;
    });
  }, [employees, vehicle, assignedDriverNames]);

  // --- 2. Filter Fuel Logs for Vehicle ---
  const vehicleFuelLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      if (log.machineryId === vehicle.id) return true;
      if (vehicle.licensePlateOrSerial && log.machineryPlateOrName?.toLowerCase().includes(vehicle.licensePlateOrSerial.toLowerCase())) return true;
      if (vehicle.name && log.machineryPlateOrName?.toLowerCase().includes(vehicle.name.toLowerCase())) return true;
      return false;
    });
  }, [fuelLogs, vehicle]);

  // --- 3. Filter Maintenance Logs for Vehicle ---
  const vehicleMaintenanceLogs = useMemo(() => {
    return maintenanceLogs.filter(log => {
      if (log.machineryId === vehicle.id) return true;
      if (vehicle.licensePlateOrSerial && log.machineryPlateOrName?.toLowerCase().includes(vehicle.licensePlateOrSerial.toLowerCase())) return true;
      if (vehicle.name && log.machineryPlateOrName?.toLowerCase().includes(vehicle.name.toLowerCase())) return true;
      return false;
    });
  }, [maintenanceLogs, vehicle]);

  // --- 4. Filter General Expenses Directly Assigned to Vehicle ---
  const vehicleDirectExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (exp.machineryId === vehicle.id) return true;
      if (vehicle.licensePlateOrSerial && exp.description.toLowerCase().includes(vehicle.licensePlateOrSerial.toLowerCase())) return true;
      if (vehicle.name && exp.description.toLowerCase().includes(vehicle.name.toLowerCase())) return true;
      return false;
    });
  }, [expenses, vehicle]);

  // --- 5. Filter Driver Expenses (Salários, Alimentação, Diárias) ---
  const driverExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Check if linked to assigned drivers
      if (exp.employeeId && assignedDriverObjs.some(d => d.id === exp.employeeId)) return true;
      if (exp.employeeName && assignedDriverNames.some(name => exp.employeeName?.toLowerCase().includes(name.toLowerCase()))) return true;
      
      // Check if description mentions driver name
      const mentionsDriver = assignedDriverNames.some(name => 
        name.length > 2 && exp.description.toLowerCase().includes(name.toLowerCase())
      );
      if (mentionsDriver) return true;

      // Check if category relates to food / personnel and belongs to the vehicle's context
      const isPersonnel = exp.categoryId === 'cat_alimentacao' || 
                          exp.categoryId === 'cat_mao_de_obra' || 
                          exp.categoryId === 'cat_salarios' ||
                          exp.categoryId === 'cat_rescisao' ||
                          exp.categoryId === 'cat_diarias' ||
                          exp.categoryName?.toLowerCase().includes('aliment') || 
                          exp.categoryName?.toLowerCase().includes('mão de obra') ||
                          exp.categoryName?.toLowerCase().includes('salár') ||
                          exp.categoryName?.toLowerCase().includes('salar') ||
                          exp.categoryName?.toLowerCase().includes('rescis') ||
                          exp.categoryName?.toLowerCase().includes('acerto') ||
                          exp.categoryName?.toLowerCase().includes('diária') ||
                          exp.categoryName?.toLowerCase().includes('diaria');

      if (isPersonnel && (exp.machineryId === vehicle.id || (vehicle.licensePlateOrSerial && exp.description.toLowerCase().includes(vehicle.licensePlateOrSerial.toLowerCase())))) {
        return true;
      }

      return false;
    });
  }, [expenses, assignedDriverObjs, assignedDriverNames, vehicle]);

  // --- 6. Services & Silage Orders (Proventos / Revenue Generated by Vehicle) ---
  const vehicleServices = useMemo(() => {
    return services.filter(srv => {
      if (srv.machineryId === vehicle.id) return true;
      if (vehicle.licensePlateOrSerial && srv.machineryAssigned?.toLowerCase().includes(vehicle.licensePlateOrSerial.toLowerCase())) return true;
      if (vehicle.name && srv.machineryAssigned?.toLowerCase().includes(vehicle.name.toLowerCase())) return true;
      if (vehicle.model && srv.machineryAssigned?.toLowerCase().includes(vehicle.model.toLowerCase())) return true;
      if (assignedDriverNames.some(name => name.length > 2 && srv.operatorAssigned?.toLowerCase().includes(name.toLowerCase()))) return true;
      return false;
    });
  }, [services, vehicle, assignedDriverNames]);

  const vehicleSilageOrders = useMemo(() => {
    return orders.filter(ord => {
      if (ord.machineryId === vehicle.id) return true;
      if (vehicle.licensePlateOrSerial && ord.machineryPlateOrName?.toLowerCase().includes(vehicle.licensePlateOrSerial.toLowerCase())) return true;
      if (vehicle.name && ord.machineryPlateOrName?.toLowerCase().includes(vehicle.name.toLowerCase())) return true;
      if (assignedDriverNames.some(name => name.length > 2 && ord.driverName?.toLowerCase().includes(name.toLowerCase()))) return true;
      return false;
    });
  }, [orders, vehicle, assignedDriverNames]);

  // --- 7. Unified Order / Service Revenue Items ---
  interface UnifiedOrderItem {
    id: string;
    orderNumber: string;
    date: string;
    clientName: string;
    farmName?: string;
    description: string;
    type: 'servico' | 'pedido_silagem';
    revenue: number;
    fuelCost: number;
    driverCost: number;
    netProfit: number;
    marginPercent: number;
    status: string;
    operatorName?: string;
    metricsDetails?: string;
  }

  const unifiedOrders: UnifiedOrderItem[] = useMemo(() => {
    const list: UnifiedOrderItem[] = [];

    // From Services
    vehicleServices.forEach(srv => {
      const rev = srv.totalAmount || 0;
      // Allocated costs: if srv has fuelCostAllocated use it, else approximate from vehicle logs proportion
      const fCost = srv.fuelCostAllocated !== undefined ? srv.fuelCostAllocated : (rev > 0 ? rev * 0.18 : 0);
      const dCost = srv.driverCostAllocated !== undefined ? srv.driverCostAllocated : (rev > 0 ? rev * 0.08 : 0);
      const profit = rev - (fCost + dCost);
      const margin = rev > 0 ? (profit / rev) * 100 : 0;

      list.push({
        id: srv.id,
        orderNumber: srv.orderNumber || `OS-${srv.id.replace('srv_', '')}`,
        date: srv.startDate,
        clientName: srv.clientName,
        farmName: srv.farmName || 'Propriedade Rural',
        description: `${srv.serviceType} ${srv.areaHectares ? `(${srv.areaHectares} ha)` : ''} ${srv.tonsEstimated ? `(${srv.tonsEstimated} tons)` : ''}`,
        type: 'servico',
        revenue: rev,
        fuelCost: fCost,
        driverCost: dCost,
        netProfit: profit,
        marginPercent: margin,
        status: srv.status,
        operatorName: srv.operatorAssigned || vehicle.operatorOrDriver,
        metricsDetails: srv.areaHectares ? `${srv.areaHectares} ha @ ${formatCurrencyBRL(srv.ratePerUnit)}/ha` : `${srv.tonsEstimated} tons @ ${formatCurrencyBRL(srv.ratePerUnit)}/t`,
      });
    });

    // From Silage Orders (Freight & Delivery with this truck)
    vehicleSilageOrders.forEach(ord => {
      const freightRev = ord.freightCost || (ord.freightType === 'CIF' ? ord.totalAmount * 0.12 : ord.totalAmount);
      const fCost = freightRev * 0.22;
      const dCost = freightRev * 0.10;
      const profit = freightRev - (fCost + dCost);
      const margin = freightRev > 0 ? (profit / freightRev) * 100 : 0;

      list.push({
        id: ord.id,
        orderNumber: ord.orderNumber || `PED-${ord.id.replace('ord_', '')}`,
        date: ord.deliveryDate || ord.createdAt.split('T')[0],
        clientName: ord.clientName,
        farmName: ord.farmName,
        description: `Entrega Silagem (${ord.productType} - ${ord.tons}t)`,
        type: 'pedido_silagem',
        revenue: freightRev,
        fuelCost: fCost,
        driverCost: dCost,
        netProfit: profit,
        marginPercent: margin,
        status: ord.status,
        operatorName: ord.driverName || vehicle.operatorOrDriver,
        metricsDetails: `${ord.tons} Toneladas • Frete ${ord.freightType}`,
      });
    });

    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vehicleServices, vehicleSilageOrders, vehicle]);

  // --- 8. Financial Totals Calculations ---
  const totalRevenue = useMemo(() => {
    return unifiedOrders.reduce((acc, curr) => acc + curr.revenue, 0);
  }, [unifiedOrders]);

  const totalFuelCost = useMemo(() => {
    return vehicleFuelLogs.reduce((acc, curr) => acc + curr.totalAmount, 0);
  }, [vehicleFuelLogs]);

  const totalMaintenanceCost = useMemo(() => {
    return vehicleMaintenanceLogs.reduce((acc, curr) => acc + curr.totalCost, 0);
  }, [vehicleMaintenanceLogs]);

  const totalOtherVehicleExpenses = useMemo(() => {
    return vehicleDirectExpenses
      .filter(e => !e.categoryId?.includes('combust') && !e.categoryId?.includes('manut'))
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [vehicleDirectExpenses]);

  const totalVehicleExpenses = totalFuelCost + totalMaintenanceCost + totalOtherVehicleExpenses;

  // Consumption Metrics (Average KM, Hours, Cost/KM, Cost/Hour)
  const consumptionMetrics = useMemo(() => {
    return calculateVehicleConsumptionMetrics(vehicle.id, fuelLogs);
  }, [vehicle.id, fuelLogs]);

  // Driver Expenses Breakdown (Alimentação, Salários, Rescisão, Diárias, Outros)
  const driverExpensesBreakdown = useMemo(() => {
    let alimentacao = 0;
    let salarios = 0;
    let rescisao = 0;
    let diarias = 0;
    let outros = 0;

    driverExpenses.forEach(exp => {
      const text = `${exp.categoryName || ''} ${exp.description || ''}`.toLowerCase();
      if (text.includes('rescis') || text.includes('acerto') || text.includes('demiss') || text.includes('indeniz')) {
        rescisao += exp.amount;
      } else if (text.includes('aliment') || text.includes('refei') || text.includes('marmit') || text.includes('almoço') || text.includes('jantar') || text.includes('café')) {
        alimentacao += exp.amount;
      } else if (text.includes('diári') || text.includes('diari') || text.includes('pernoite') || text.includes('viagem')) {
        diarias += exp.amount;
      } else if (text.includes('salár') || text.includes('salar') || text.includes('adiant') || text.includes('folha') || text.includes('vale')) {
        salarios += exp.amount;
      } else {
        outros += exp.amount;
      }
    });

    const totalFromLogs = alimentacao + salarios + rescisao + diarias + outros;
    return { alimentacao, salarios, rescisao, diarias, outros, totalFromLogs };
  }, [driverExpenses]);

  // Driver Expenses Breakdown
  const totalDriverExpensesFromLogs = useMemo(() => {
    return driverExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  }, [driverExpenses]);

  // Driver monthly base salary sum (for context)
  const totalDriversMonthlySalary = useMemo(() => {
    return assignedDriverObjs.reduce((acc, curr) => acc + (curr.salary || 0), 0);
  }, [assignedDriverObjs]);

  const totalDriverCosts = useMemo(() => {
    if (totalDriverExpensesFromLogs > 0) {
      // If driver expenses logged has salaries, use full total
      if (driverExpensesBreakdown.salarios > 0) {
        return totalDriverExpensesFromLogs;
      }
      // If driver expenses logged does not have salaries, combine logged expenses + base monthly salary
      return totalDriverExpensesFromLogs + (totalDriversMonthlySalary || 0);
    }
    return totalDriversMonthlySalary || 0;
  }, [totalDriverExpensesFromLogs, driverExpensesBreakdown.salarios, totalDriversMonthlySalary]);

  const totalOperatingCosts = totalVehicleExpenses + totalDriverCosts;
  const netVehicleProfit = totalRevenue - totalOperatingCosts;
  const profitMargin = totalRevenue > 0 ? (netVehicleProfit / totalRevenue) * 100 : 0;

  // Unit operational cost indicators
  const totalKmRecorded = consumptionMetrics.totalKmDriven || (vehicle.currentKm ? vehicle.currentKm : 0);
  const totalHoursRecorded = consumptionMetrics.totalHoursWorked || (vehicle.hourMeter ? vehicle.hourMeter : 0);
  const costPerKmAllInclusive = totalKmRecorded > 0 ? parseFloat((totalOperatingCosts / totalKmRecorded).toFixed(2)) : null;
  const costPerHourAllInclusive = totalHoursRecorded > 0 ? parseFloat((totalOperatingCosts / totalHoursRecorded).toFixed(2)) : null;

  // Filtered orders list by search
  const filteredOrders = useMemo(() => {
    return unifiedOrders.filter(ord => {
      const matchesSearch = 
        ord.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ord.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ord.farmName && ord.farmName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ord.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'todos' || ord.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [unifiedOrders, searchTerm, statusFilter]);

  // Handler to quickly register a new Service for this vehicle
  const handleSaveQuickService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const qty = Number(newTonsEstimated) || Number(newAreaHectares) || 1;
    const rate = Number(newRatePerUnit) || 0;
    const total = qty * rate;

    const newSrv: ServiceOrder = {
      id: `srv_${Date.now()}`,
      orderNumber: newOrderNumber || `OS-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: newClientName,
      farmName: newFarmName,
      serviceType: newServiceType as any,
      areaHectares: newAreaHectares ? Number(newAreaHectares) : undefined,
      tonsEstimated: newTonsEstimated ? Number(newTonsEstimated) : undefined,
      ratePerUnit: rate,
      totalAmount: total,
      startDate: newStartDate,
      status: 'concluido',
      machineryId: vehicle.id,
      machineryAssigned: `${vehicle.licensePlateOrSerial || ''} - ${vehicle.model || vehicle.name}`,
      operatorAssigned: newDriverSelected,
      fuelCostAllocated: total * 0.18,
      driverCostAllocated: total * 0.08,
      notes: `Ordem executada pelo veículo ${vehicle.licensePlateOrSerial || vehicle.name}`,
    };

    if (onAddService) {
      onAddService(newSrv);
    }

    setIsAddingService(false);
    setNewClientName('');
    setNewFarmName('');
  };

  // Handler to register driver expense (Alimentação / Salário)
  const handleSaveDriverExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) return;

    const matchedEmp = employees.find(emp => emp.name.toLowerCase().includes(expenseDriver.toLowerCase()));

    const categoryMapping = {
      alimentacao: { id: 'cat_alimentacao', name: 'Alimentação & Campo', color: '#ea580c' },
      diaria: { id: 'cat_mao_de_obra', name: 'Mão de Obra & Diárias', color: '#0284c7' },
      salario: { id: 'cat_mao_de_obra', name: 'Salários & Adiantamentos', color: '#0284c7' },
      rescisao: { id: 'cat_rescisao', name: 'Rescisão & Encargos Trabalhistas', color: '#dc2626' },
      outro: { id: 'cat_outros', name: 'Outras Despesas de Motorista', color: '#6b7280' },
    };

    const selectedCat = categoryMapping[expenseCategory];

    if (onAddExpense) {
      onAddExpense({
        description: `[${vehicle.licensePlateOrSerial || vehicle.name}] ${expenseDesc} (${expenseDriver})`,
        amount: Number(expenseAmount),
        categoryId: selectedCat.id,
        categoryName: selectedCat.name,
        categoryColor: selectedCat.color,
        dueDate: expenseDate,
        paymentDate: expenseDate,
        status: 'pago',
        paymentMethod: 'pix',
        supplier: expenseDriver || 'Motorista / Operador',
        machineryId: vehicle.id,
        machineryName: vehicle.licensePlateOrSerial || vehicle.name,
        employeeId: matchedEmp?.id,
        employeeName: expenseDriver,
        notes: `Despesa de ${expenseCategory} do motorista vinculada ao veículo ${vehicle.licensePlateOrSerial}`,
      });
    }

    setIsAddingDriverExpense(false);
    setExpenseDesc('');
    setExpenseAmount('');
  };

  const handlePrint = () => {
    window.print();
  };

  const companyProfile = getStoredCompanyProfile();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 print:p-0 print:bg-white print:static">
      <div 
        id="vehicle-history-modal"
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full"
      >
        
        {/* --- PRINT HEADER (Corporate 2 Columns) --- */}
        <div className="hidden print:block p-4 pb-0 bg-white">
          <PrintReportHeader
            companyProfile={companyProfile}
            reportTitle="HISTÓRICO OPERACIONAL & DRE DO VEÍCULO"
            reportSubtitle={`Veículo: ${vehicle.licensePlateOrSerial || 'SEM PLACA'} • ${vehicle.model || vehicle.name || ''}`}
            documentTypeBadge="DRE DO VEÍCULO"
          />
        </div>

        {/* --- HEADER --- */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-850/80 flex items-center justify-between gap-3 print:border-none print:bg-white">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 flex items-center justify-center font-bold shrink-0 border border-pink-200 dark:border-pink-800 print:hidden">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-md bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 tracking-wider">
                  {vehicle.licensePlateOrSerial || 'SEM PLACA'}
                </span>
                <h2 className="text-base font-bold text-stone-900 dark:text-stone-100 truncate font-['Outfit']">
                  {vehicle.model || vehicle.name}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  vehicle.status === 'operacional'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-300'
                }`}>
                  {vehicle.status || 'Disponível'}
                </span>
                {vehicle.capacityM3 && (
                  <span className="text-[11px] font-black text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800 flex items-center space-x-1">
                    <Box className="w-3 h-3" />
                    <span>{vehicle.capacityM3} m³</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center space-x-2">
                <span>Motoristas Vinculados: <strong className="text-stone-700 dark:text-stone-300">{assignedDriverNames.join(', ') || 'Nenhum'}</strong></span>
                <span>•</span>
                <span>Horímetro: <strong className="text-stone-700 dark:text-stone-300">{vehicle.hourMeter || 0} h</strong></span>
                {vehicle.currentKm ? <span>• KM: <strong className="text-stone-700 dark:text-stone-300">{vehicle.currentKm.toLocaleString('pt-BR')} km</strong></span> : null}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 print:hidden">
            <button
              onClick={handlePrint}
              title="Imprimir Relatório de Lucratividade"
              className="px-3 py-1.5 bg-[#0963cb] hover:bg-blue-700 text-white rounded-lg transition cursor-pointer flex items-center space-x-1.5 text-xs font-bold shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir DRE</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* --- FINANCIAL HIGHLIGHTS & DRE SUMMARY CARDS --- */}
        <div className="px-5 py-4 bg-gradient-to-r from-stone-50 via-white to-stone-50 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-stone-200 dark:border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          {/* 1. Proventos / Receita */}
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              <span>(+) Proventos (Serviços)</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-900 dark:text-emerald-100 font-['Outfit'] mt-1">
              {formatCurrencyBRL(totalRevenue)}
            </div>
            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">
              {unifiedOrders.length} ordens de serviço / fretes
            </div>
          </div>

          {/* 2. Custos do Veículo */}
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              <span>(-) Custos do Veículo</span>
              <Fuel className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-amber-900 dark:text-amber-100 font-['Outfit'] mt-1">
              {formatCurrencyBRL(totalVehicleExpenses)}
            </div>
            <div className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5">
              Comb: {formatCurrencyBRL(totalFuelCost)} • Manut: {formatCurrencyBRL(totalMaintenanceCost)}
            </div>
          </div>

          {/* 3. Despesas do Motorista */}
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              <span>(-) Despesas Motoristas</span>
              <Utensils className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black text-blue-900 dark:text-blue-100 font-['Outfit'] mt-1">
              {formatCurrencyBRL(totalDriverCosts)}
            </div>
            <div className="text-[10px] text-blue-700/80 dark:text-blue-400 mt-0.5">
              Salários, alimentação e diárias
            </div>
          </div>

          {/* 4. Lucro Líquido do Veículo */}
          <div className={`p-3 rounded-xl border ${
            netVehicleProfit >= 0
              ? 'bg-stone-900 text-white dark:bg-emerald-950/80 dark:border-emerald-700 border-stone-800'
              : 'bg-rose-50 text-rose-900 dark:bg-rose-950/80 dark:border-rose-700 border-rose-200'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-bold opacity-90 uppercase tracking-wider">
              <span>(=) Lucro Líquido</span>
              <Percent className="w-3.5 h-3.5" />
            </div>
            <div className="text-base sm:text-lg font-black font-['Outfit'] mt-1">
              {formatCurrencyBRL(netVehicleProfit)}
            </div>
            <div className="text-[10px] opacity-80 mt-0.5 flex items-center space-x-1">
              <span>Margem Líquida:</span>
              <span className="font-bold">{profitMargin.toFixed(1)}%</span>
            </div>
          </div>

        </div>

        {/* --- TABS NAVIGATION --- */}
        <div className="px-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2 overflow-x-auto bg-stone-50/50 dark:bg-stone-850/50">
          <div className="flex space-x-1 py-2">
            
            <button
              onClick={() => setActiveTab('pedidos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'pedidos'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lucro por Pedido ({unifiedOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('dre')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'dre'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>DRE Completo</span>
            </button>

            <button
              onClick={() => setActiveTab('combustivel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'combustivel'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800'
              }`}
            >
              <Fuel className="w-3.5 h-3.5" />
              <span>Abastecimentos ({vehicleFuelLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('manutencoes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'manutencoes'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Manutenções ({vehicleMaintenanceLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('motoristas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'motoristas'
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Despesas Motoristas ({driverExpenses.length})</span>
            </button>

          </div>

          <div className="flex items-center space-x-1.5 py-2 shrink-0">
            <button
              onClick={() => setIsAddingService(true)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vincular Serviço / Pedido</span>
            </button>
            <button
              onClick={() => setIsAddingDriverExpense(true)}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center space-x-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Despesa Motorista</span>
            </button>
          </div>
        </div>

        {/* --- MODAL CONTENT BODY --- */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: LUCRO POR PEDIDO / SERVIÇOS (PROVENTOS) */}
          {activeTab === 'pedidos' && (
            <div className="space-y-4">
              
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-50 dark:bg-stone-800/40 p-3 rounded-xl border border-stone-200 dark:border-stone-800">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar por nº do pedido, cliente, serviço..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 dark:text-stone-100 placeholder-stone-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-700 dark:text-stone-300 font-medium focus:outline-none"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="concluido">Concluídos</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="agendado">Agendados</option>
                    <option value="confirmado">Confirmados</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 dark:bg-stone-800/80 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
                      <tr>
                        <th className="py-3 px-3.5">Pedido / OS #</th>
                        <th className="py-3 px-3.5">Data</th>
                        <th className="py-3 px-3.5">Cliente & Fazenda</th>
                        <th className="py-3 px-3.5">Serviço Realizado</th>
                        <th className="py-3 px-3.5 text-right">(+) Receita</th>
                        <th className="py-3 px-3.5 text-right">(-) Combustível</th>
                        <th className="py-3 px-3.5 text-right">(-) Motorista</th>
                        <th className="py-3 px-3.5 text-right">(=) Lucro Líquido</th>
                        <th className="py-3 px-3.5 text-center">Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-stone-400">
                            <div className="flex flex-col items-center space-y-2">
                              <FileText className="w-8 h-8 text-stone-300 dark:text-stone-700" />
                              <p>Nenhum serviço ou pedido vinculado a este veículo no momento.</p>
                              <button
                                onClick={() => setIsAddingService(true)}
                                className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                              >
                                + Lançar primeiro serviço para este veículo
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                            
                            {/* Pedido # */}
                            <td className="py-3 px-3.5">
                              <div className="font-extrabold text-stone-900 dark:text-stone-100 font-mono">
                                {order.orderNumber}
                              </div>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                order.status === 'concluido' || order.status === 'confirmado' || order.status === 'entregue'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {order.status}
                              </span>
                            </td>

                            {/* Data */}
                            <td className="py-3 px-3.5 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                              {formatDateBR(order.date)}
                            </td>

                            {/* Cliente & Fazenda */}
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-stone-900 dark:text-stone-100">
                                {order.clientName}
                              </div>
                              {order.farmName && (
                                <div className="text-[10px] text-stone-500 dark:text-stone-400 flex items-center space-x-1">
                                  <MapPin className="w-2.5 h-2.5 text-stone-400" />
                                  <span>{order.farmName}</span>
                                </div>
                              )}
                            </td>

                            {/* Serviço Realizado */}
                            <td className="py-3 px-3.5">
                              <div className="text-stone-800 dark:text-stone-200 font-semibold">
                                {order.description}
                              </div>
                              {order.metricsDetails && (
                                <div className="text-[10px] text-stone-500 dark:text-stone-400">
                                  {order.metricsDetails}
                                </div>
                              )}
                              {order.operatorName && (
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-medium">
                                  👤 {order.operatorName}
                                </div>
                              )}
                            </td>

                            {/* Receita */}
                            <td className="py-3 px-3.5 text-right font-bold text-emerald-700 dark:text-emerald-400 font-['Outfit']">
                              {formatCurrencyBRL(order.revenue)}
                            </td>

                            {/* Combustível */}
                            <td className="py-3 px-3.5 text-right font-medium text-amber-700 dark:text-amber-400">
                              {formatCurrencyBRL(order.fuelCost)}
                            </td>

                            {/* Motorista */}
                            <td className="py-3 px-3.5 text-right font-medium text-blue-700 dark:text-blue-400">
                              {formatCurrencyBRL(order.driverCost)}
                            </td>

                            {/* Lucro Líquido */}
                            <td className="py-3 px-3.5 text-right font-black font-['Outfit']">
                              <span className={order.netProfit >= 0 ? 'text-stone-900 dark:text-stone-100' : 'text-rose-600 dark:text-rose-400'}>
                                {formatCurrencyBRL(order.netProfit)}
                              </span>
                            </td>

                            {/* Margem */}
                            <td className="py-3 px-3.5 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                                order.marginPercent >= 50
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : order.marginPercent >= 25
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {order.marginPercent.toFixed(1)}%
                              </span>
                            </td>

                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredOrders.length > 0 && (
                      <tfoot className="bg-stone-50 dark:bg-stone-850 font-bold text-xs border-t-2 border-stone-200 dark:border-stone-700">
                        <tr>
                          <td colSpan={4} className="py-3 px-3.5 text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                            Total dos Pedidos Selecionados ({filteredOrders.length}):
                          </td>
                          <td className="py-3 px-3.5 text-right text-emerald-700 dark:text-emerald-300 font-black font-['Outfit']">
                            {formatCurrencyBRL(filteredOrders.reduce((a, c) => a + c.revenue, 0))}
                          </td>
                          <td className="py-3 px-3.5 text-right text-amber-700 dark:text-amber-300 font-bold">
                            {formatCurrencyBRL(filteredOrders.reduce((a, c) => a + c.fuelCost, 0))}
                          </td>
                          <td className="py-3 px-3.5 text-right text-blue-700 dark:text-blue-300 font-bold">
                            {formatCurrencyBRL(filteredOrders.reduce((a, c) => a + c.driverCost, 0))}
                          </td>
                          <td className="py-3 px-3.5 text-right text-stone-900 dark:text-stone-100 font-black font-['Outfit']">
                            {formatCurrencyBRL(filteredOrders.reduce((a, c) => a + c.netProfit, 0))}
                          </td>
                          <td className="py-3 px-3.5 text-center text-emerald-700 dark:text-emerald-300 font-black">
                            {profitMargin.toFixed(1)}%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: DRE COMPLETO DO VEÍCULO */}
          {activeTab === 'dre' && (
            <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                  Demonstrativo de Resultado do Exercício (DRE) - {vehicle.licensePlateOrSerial || vehicle.name}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Apuração detalhada de faturamento, custos de maquinário e despesas com pessoal / motoristas
                </p>
              </div>

              <div className="space-y-3 font-mono text-xs">
                
                {/* 1. Receita Bruta */}
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex justify-between items-center font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                    <span>(+) RECEITA BRUTA OPERACIONAL (PROVENTOS)</span>
                    <span className="font-['Outfit']">{formatCurrencyBRL(totalRevenue)}</span>
                  </div>
                  <div className="pl-4 mt-2 space-y-1 text-emerald-700 dark:text-emerald-400 text-xs">
                    <div className="flex justify-between">
                      <span>• Ordens de Serviços de Ensilagem / Colheita / Corte</span>
                      <span>{formatCurrencyBRL(vehicleServices.reduce((a, c) => a + c.totalAmount, 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Faturamento de Fretes & Entregas de Silagem</span>
                      <span>{formatCurrencyBRL(vehicleSilageOrders.reduce((a, c) => a + (c.freightCost || c.totalAmount), 0))}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Custos Diretos do Maquinário */}
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/40">
                  <div className="flex justify-between items-center font-bold text-amber-900 dark:text-amber-200 text-sm">
                    <span>(-) CUSTOS DIRETOS DO VEÍCULO</span>
                    <span className="font-['Outfit']">{formatCurrencyBRL(totalVehicleExpenses)}</span>
                  </div>
                  <div className="pl-4 mt-2 space-y-1 text-amber-700 dark:text-amber-400 text-xs">
                    <div className="flex justify-between">
                      <span>• Combustível ({consumptionMetrics.totalLiters.toLocaleString('pt-BR')} L em {vehicleFuelLogs.length} abastecimentos)</span>
                      <span>{formatCurrencyBRL(totalFuelCost)}</span>
                    </div>
                    {(consumptionMetrics.avgKmPerLiter || consumptionMetrics.avgLitersPerHour) && (
                      <div className="flex justify-between text-[11px] text-amber-800 dark:text-amber-300 font-semibold pl-2">
                        <span>
                          ↳ Média Consumo: {consumptionMetrics.avgKmPerLiter ? `${consumptionMetrics.avgKmPerLiter} km/L` : ''} 
                          {consumptionMetrics.avgKmPerLiter && consumptionMetrics.avgLitersPerHour ? ' • ' : ''}
                          {consumptionMetrics.avgLitersPerHour ? `${consumptionMetrics.avgLitersPerHour} L/h` : ''}
                        </span>
                        <span>
                          {consumptionMetrics.avgCostPerKm ? `${formatCurrencyBRL(consumptionMetrics.avgCostPerKm)}/km` : ''}
                          {consumptionMetrics.avgCostPerKm && consumptionMetrics.avgCostPerHour ? ' • ' : ''}
                          {consumptionMetrics.avgCostPerHour ? `${formatCurrencyBRL(consumptionMetrics.avgCostPerHour)}/h` : ''}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>• Manutenção Preventiva, Corretiva & Peças - {vehicleMaintenanceLogs.length} ordens</span>
                      <span>{formatCurrencyBRL(totalMaintenanceCost)}</span>
                    </div>
                    {totalOtherVehicleExpenses > 0 && (
                      <div className="flex justify-between">
                        <span>• Outras Despesas do Veículo (Seguros, Licenciamento, Pneus)</span>
                        <span>{formatCurrencyBRL(totalOtherVehicleExpenses)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Despesas com Pessoal / Motoristas */}
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/40">
                  <div className="flex justify-between items-center font-bold text-blue-900 dark:text-blue-200 text-sm">
                    <span>(-) DESPESAS COM MOTORISTAS & OPERADORES</span>
                    <span className="font-['Outfit']">{formatCurrencyBRL(totalDriverCosts)}</span>
                  </div>
                  <div className="pl-4 mt-2 space-y-1 text-blue-700 dark:text-blue-400 text-xs">
                    <div className="flex justify-between">
                      <span>• Salários e Remuneração ({assignedDriverNames.join(', ') || 'Motoristas'})</span>
                      <span>{formatCurrencyBRL(driverExpensesBreakdown.salarios > 0 ? driverExpensesBreakdown.salarios : totalDriversMonthlySalary)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Alimentação, Marmitas & Refeições de Campo</span>
                      <span>{formatCurrencyBRL(driverExpensesBreakdown.alimentacao)}</span>
                    </div>
                    {driverExpensesBreakdown.rescisao > 0 && (
                      <div className="flex justify-between text-rose-600 dark:text-rose-400 font-bold">
                        <span>• Rescisões Trabalhistas, Acertos & Encargos</span>
                        <span>{formatCurrencyBRL(driverExpensesBreakdown.rescisao)}</span>
                      </div>
                    )}
                    {driverExpensesBreakdown.diarias > 0 && (
                      <div className="flex justify-between">
                        <span>• Diárias de Viagem & Pernoites</span>
                        <span>{formatCurrencyBRL(driverExpensesBreakdown.diarias)}</span>
                      </div>
                    )}
                    {driverExpensesBreakdown.outros > 0 && (
                      <div className="flex justify-between">
                        <span>• Outras Despesas de Motoristas</span>
                        <span>{formatCurrencyBRL(driverExpensesBreakdown.outros)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Lucro Líquido Final */}
                <div className="p-4 bg-stone-900 text-white dark:bg-stone-800 rounded-xl flex justify-between items-center text-sm sm:text-base font-black">
                  <div>
                    <span>(=) LUCRO LÍQUIDO DO VEÍCULO</span>
                    <div className="text-xs text-stone-400 font-normal mt-0.5">
                      Margem Líquida sobre Faturamento: <strong className="text-emerald-400">{profitMargin.toFixed(1)}%</strong>
                    </div>
                  </div>
                  <span className={`text-lg sm:text-xl font-['Outfit'] ${netVehicleProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrencyBRL(netVehicleProfit)}
                  </span>
                </div>

                {/* 5. Indicadores Unitários Operacionais (Custo por KM e por Hora) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 font-sans">
                    <span className="text-[10px] font-bold uppercase text-stone-500">Custo Total por KM Rodado</span>
                    <div className="text-base font-black text-stone-800 dark:text-stone-200 mt-0.5 font-mono">
                      {costPerKmAllInclusive ? `${formatCurrencyBRL(costPerKmAllInclusive)} / km` : '--'}
                    </div>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      (Combustível + Manutenção + Motorista) ÷ KM rodados
                    </p>
                  </div>

                  <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 font-sans">
                    <span className="text-[10px] font-bold uppercase text-stone-500">Custo Total por Hora de Operação</span>
                    <div className="text-base font-black text-stone-800 dark:text-stone-200 mt-0.5 font-mono">
                      {costPerHourAllInclusive ? `${formatCurrencyBRL(costPerHourAllInclusive)} / h` : '--'}
                    </div>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      (Combustível + Manutenção + Motorista) ÷ Horas trabalhadas
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: ABASTECIMENTOS (COMBUSTÍVEL) */}
          {activeTab === 'combustivel' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                    Histórico de Abastecimentos ({vehicleFuelLogs.length})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Consumo total: {vehicleFuelLogs.reduce((a, c) => a + c.liters, 0).toLocaleString('pt-BR')} Litros
                  </p>
                </div>
                {onNewFuel && (
                  <button
                    onClick={() => onNewFuel(vehicle.id)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lançar Abastecimento</span>
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-800/80 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="py-3 px-3.5">Data</th>
                      <th className="py-3 px-3.5">Combustível</th>
                      <th className="py-3 px-3.5">Litros</th>
                      <th className="py-3 px-3.5">Preço / Litro</th>
                      <th className="py-3 px-3.5">Horímetro / KM</th>
                      <th className="py-3 px-3.5">Média Calculada</th>
                      <th className="py-3 px-3.5">Motorista</th>
                      <th className="py-3 px-3.5 text-right">Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                    {vehicleFuelLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-stone-400">
                          Nenhum registro de abastecimento para este veículo.
                        </td>
                      </tr>
                    ) : (
                      vehicleFuelLogs.map(log => (
                        <tr key={log.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                          <td className="py-2.5 px-3.5 whitespace-nowrap">{formatDateBR(log.date)}</td>
                          <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">{log.fuelType}</td>
                          <td className="py-2.5 px-3.5 font-mono">{log.liters} L</td>
                          <td className="py-2.5 px-3.5 font-mono">{formatCurrencyBRL(log.pricePerLiter)}</td>
                          <td className="py-2.5 px-3.5 font-mono text-stone-600 dark:text-stone-400">{log.currentHourMeterOrKm || '--'}</td>
                          <td className="py-2.5 px-3.5">
                            {log.averageCalculated ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                {log.averageCalculated} {log.averageCalculated > 10 ? 'L/h' : 'km/L'}
                              </span>
                            ) : '--'}
                          </td>
                          <td className="py-2.5 px-3.5 text-stone-700 dark:text-stone-300">{log.driverOrOperator || '--'}</td>
                          <td className="py-2.5 px-3.5 text-right font-black text-amber-700 dark:text-amber-400 font-['Outfit']">
                            {formatCurrencyBRL(log.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: MANUTENÇÕES & PEÇAS */}
          {activeTab === 'manutencoes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                    Histórico de Manutenções & Peças ({vehicleMaintenanceLogs.length})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Total investido em manutenção: {formatCurrencyBRL(totalMaintenanceCost)}
                  </p>
                </div>
                {onNewMaintenance && (
                  <button
                    onClick={() => onNewMaintenance(vehicle.id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lançar Manutenção</span>
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-800/80 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="py-3 px-3.5">Data</th>
                      <th className="py-3 px-3.5">Tipo</th>
                      <th className="py-3 px-3.5">Descrição do Serviço</th>
                      <th className="py-3 px-3.5">Oficina / Mecânico</th>
                      <th className="py-3 px-3.5">Horímetro / KM</th>
                      <th className="py-3 px-3.5">Peças</th>
                      <th className="py-3 px-3.5">Mão de Obra</th>
                      <th className="py-3 px-3.5 text-right">Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                    {vehicleMaintenanceLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-stone-400">
                          Nenhuma manutenção registrada para este veículo.
                        </td>
                      </tr>
                    ) : (
                      vehicleMaintenanceLogs.map(log => (
                        <tr key={log.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                          <td className="py-2.5 px-3.5 whitespace-nowrap">{formatDateBR(log.date)}</td>
                          <td className="py-2.5 px-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              log.type === 'preventiva' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                              log.type === 'corretiva' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                              'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">{log.description}</td>
                          <td className="py-2.5 px-3.5 text-stone-600 dark:text-stone-400">{log.workshop || '--'}</td>
                          <td className="py-2.5 px-3.5 font-mono">{log.hourMeterOrKmAtService || '--'}</td>
                          <td className="py-2.5 px-3.5 font-mono">{formatCurrencyBRL(log.partsCost || 0)}</td>
                          <td className="py-2.5 px-3.5 font-mono">{formatCurrencyBRL(log.laborCost || 0)}</td>
                          <td className="py-2.5 px-3.5 text-right font-black text-rose-700 dark:text-rose-400 font-['Outfit']">
                            {formatCurrencyBRL(log.totalCost)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: DESPESAS DOS MOTORISTAS (SALÁRIOS, ALIMENTAÇÃO, DIÁRIAS) */}
          {activeTab === 'motoristas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                    Despesas Vinculadas aos Motoristas do Veículo
                  </h3>
                  <p className="text-xs text-stone-500">
                    Alimentação, diárias de campo, salários e reembolsos somados aos custos operacionais
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingDriverExpense(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Despesa Motorista</span>
                </button>
              </div>

              {/* Assigned Drivers Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignedDriverObjs.map(drv => (
                  <div key={drv.id} className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-stone-900 dark:text-stone-100 text-xs">
                        👤 {drv.name}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {drv.role} • CNH: {drv.cnhCategory || '--'}
                      </div>
                    </div>
                    {drv.salary && (
                      <div className="text-right">
                        <div className="text-[10px] text-stone-400 uppercase font-bold">Salário Base</div>
                        <div className="text-xs font-black text-stone-800 dark:text-stone-200 font-['Outfit']">
                          {formatCurrencyBRL(drv.salary)} / mês
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Driver Expenses List */}
              <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-800/80 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="py-3 px-3.5">Data</th>
                      <th className="py-3 px-3.5">Motorista / Beneficiário</th>
                      <th className="py-3 px-3.5">Categoria</th>
                      <th className="py-3 px-3.5">Descrição</th>
                      <th className="py-3 px-3.5">Fornecedor / Local</th>
                      <th className="py-3 px-3.5 text-right">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                    {driverExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-stone-400">
                          Nenhuma despesa direta de alimentação/diária registrada para os motoristas deste veículo.
                        </td>
                      </tr>
                    ) : (
                      driverExpenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition">
                          <td className="py-2.5 px-3.5 whitespace-nowrap">{formatDateBR(exp.dueDate || exp.paymentDate)}</td>
                          <td className="py-2.5 px-3.5 font-bold text-stone-900 dark:text-stone-100">{exp.employeeName || exp.supplier}</td>
                          <td className="py-2.5 px-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              {exp.categoryName || 'Alimentação / Diária'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-stone-800 dark:text-stone-200">{exp.description}</td>
                          <td className="py-2.5 px-3.5 text-stone-500">{exp.supplier || '--'}</td>
                          <td className="py-2.5 px-3.5 text-right font-black text-blue-700 dark:text-blue-400 font-['Outfit']">
                            {formatCurrencyBRL(exp.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>

        {/* --- MODAL FOOTER --- */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-850/80 flex items-center justify-between text-xs print:hidden">
          <div className="text-stone-500">
            Veículo: <strong className="text-stone-700 dark:text-stone-300">{vehicle.model || vehicle.name}</strong> • Placa: <strong className="text-stone-700 dark:text-stone-300">{vehicle.licensePlateOrSerial || '--'}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-white dark:text-stone-900 rounded-lg font-bold transition cursor-pointer"
          >
            Fechar Histórico
          </button>
        </div>

        {/* --- PRINT FOOTER (Corporate Fixed) --- */}
        <div className="hidden print:block p-4 pt-0 bg-white">
          <PrintReportFooter
            showSignatures={true}
            signatureLabels={['Gestão de Frota / Controladoria', 'Diretoria / Operações']}
            companyName={companyProfile?.tradeName || 'Silagem Fácil ERP'}
            authCode={`VEIC-${(vehicle.licensePlateOrSerial || vehicle.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`}
          />
        </div>

      </div>

      {/* --- SUB-MODAL 1: VINCULAR NOVO SERVIÇO / PROVENTO --- */}
      {isAddingService && (
        <div className="fixed inset-0 z-60 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit'] flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Lançar / Vincular Serviço a {vehicle.licensePlateOrSerial || vehicle.name}</span>
              </h3>
              <button onClick={() => setIsAddingService(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickService} className="space-y-3 text-xs">
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Nº do Pedido / OS</label>
                  <input
                    type="text"
                    value={newOrderNumber}
                    onChange={e => setNewOrderNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Data de Realização</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={e => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Nome do Produtor / Cliente</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Fontes"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Fazenda / Propriedade</label>
                <input
                  type="text"
                  value={newFarmName}
                  onChange={e => setNewFarmName(e.target.value)}
                  placeholder="Ex: Fazenda Bela Vista"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Tipo de Serviço</label>
                  <select
                    value={newServiceType}
                    onChange={e => setNewServiceType(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  >
                    <option value="Ensilagem">Ensilagem de Milho</option>
                    <option value="Colheita">Colheita & Transporte</option>
                    <option value="Compactação de Silo">Compactação de Silo</option>
                    <option value="Transporte / Frete">Transporte / Frete de Silagem</option>
                    <option value="Plantio">Plantio & Preparo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Motorista / Operador</label>
                  <select
                    value={newDriverSelected}
                    onChange={e => setNewDriverSelected(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  >
                    {assignedDriverNames.map((d, i) => (
                      <option key={i} value={d}>{d}</option>
                    ))}
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.name}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Hectares (ha)</label>
                  <input
                    type="number"
                    value={newAreaHectares}
                    onChange={e => setNewAreaHectares(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Toneladas (t)</label>
                  <input
                    type="number"
                    value={newTonsEstimated}
                    onChange={e => setNewTonsEstimated(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Valor Unitário (R$)</label>
                  <input
                    type="number"
                    value={newRatePerUnit}
                    onChange={e => setNewRatePerUnit(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-mono font-bold text-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs flex justify-between items-center font-bold">
                <span className="text-emerald-800 dark:text-emerald-300">Receita Total Estimada:</span>
                <span className="text-emerald-900 dark:text-emerald-100 text-sm font-black font-['Outfit']">
                  {formatCurrencyBRL((Number(newTonsEstimated) || Number(newAreaHectares) || 1) * (Number(newRatePerUnit) || 0))}
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingService(false)}
                  className="px-3 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Salvar Serviço & Atualizar Lucro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SUB-MODAL 2: LANÇAR DESPESA DE MOTORISTA (ALIMENTAÇÃO / DIÁRIA) --- */}
      {isAddingDriverExpense && (
        <div className="fixed inset-0 z-60 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-['Outfit'] flex items-center space-x-2">
                <Utensils className="w-4 h-4 text-blue-600" />
                <span>Lançar Despesa do Motorista (Alimentação / Diária / Salário)</span>
              </h3>
              <button onClick={() => setIsAddingDriverExpense(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDriverExpense} className="space-y-3 text-xs">
              
              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Motorista / Operador</label>
                <select
                  value={expenseDriver}
                  onChange={e => setExpenseDriver(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                >
                  {assignedDriverNames.map((d, i) => (
                    <option key={i} value={d}>{d}</option>
                  ))}
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name} ({emp.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Tipo de Despesa</label>
                  <select
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  >
                    <option value="alimentacao">Alimentação / Marmita / Café</option>
                    <option value="salario">Salário / Adiantamento</option>
                    <option value="rescisao">Rescisão de Contrato / Encargos</option>
                    <option value="diaria">Diária de Campo / Pernoite</option>
                    <option value="outro">Outras Despesas de Viagem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Data</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Descrição do Gasto</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={e => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Almoço da equipe de corte no Restaurante Estrada"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">Valor da Despesa (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0,00"
                  className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 font-mono font-bold text-rose-600 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingDriverExpense(false)}
                  className="px-3 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Lançar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export const VehicleHistoryModal: React.FC<VehicleHistoryModalProps> = (props) => {
  const activeVehicle = props.vehicle || props.machinery || null;
  if (!props.isOpen || !activeVehicle) return null;
  return <VehicleHistoryModalContent {...props} vehicle={activeVehicle} />;
};
