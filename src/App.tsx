import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Expense, 
  ExpenseCategory, 
  CostCenter, 
  Client, 
  SilageOrder, 
  Machinery, 
  CropSeason,
  Employee,
  FleetTeam,
  Supplier,
  InventoryItem,
  ServiceOrder,
  FuelLog,
  MaintenanceLog,
  ExpenseStatus,
  CompanyProfile,
  BankAccount,
  ThirdPartySettlement,
  PayrollRecord,
  VacationRecord,
  LeaveRecord,
  SalaryAdvance
} from './types';
import { Subscriber } from './types/masterAdmin';
import { getStoredSubscribers } from './lib/masterAdminStorage';
import { 
  getStoredExpenses, 
  saveStoredExpenses,
  getStoredCategories,
  saveStoredCategories,
  getStoredCostCenters,
  saveStoredCostCenters,
  getStoredClients,
  saveStoredClients,
  getStoredOrders,
  saveStoredOrders,
  getStoredMachineries,
  saveStoredMachineries,
  getStoredSeasons,
  saveStoredSeasons,
  getStoredEmployees,
  saveStoredEmployees,
  getStoredFleetTeams,
  saveStoredFleetTeams,
  getStoredSuppliers,
  saveStoredSuppliers,
  getStoredInventory,
  saveStoredInventory,
  getStoredServices,
  saveStoredServices,
  getStoredFuelLogs,
  saveStoredFuelLogs,
  getStoredMaintenanceLogs,
  saveStoredMaintenanceLogs,
  getStoredCompanyProfile,
  saveStoredCompanyProfile,
  getStoredBankAccounts,
  saveStoredBankAccounts,
  getStoredSettlements,
  saveStoredSettlements,
  getStoredPayrolls,
  saveStoredPayrolls,
  getStoredVacations,
  saveStoredVacations,
  getStoredLeaves,
  saveStoredLeaves,
  getStoredSalaryAdvances,
  saveStoredSalaryAdvances,
  saveStoredTerminations,
  formatCurrencyBRL,
  getActiveCompanyId
} from './lib/storage';
import { useConfirm } from './context/ConfirmContext';


import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MainDashboard } from './components/dashboard/MainDashboard';

import { PlusCircle, Sparkles, ArrowLeft } from 'lucide-react';
import { ExpenseModal } from './components/expenses/ExpenseModal';
import { ExpenseReceiptViewer } from './components/expenses/ExpenseReceiptViewer';
import { ExpenseCategoriesModal } from './components/expenses/ExpenseCategoriesModal';
import { AiExpenseParserModal } from './components/ai/AiExpenseParserModal';
import { SuspendedAccountScreen } from './components/auth/SuspendedAccountScreen';

import { CrmModule } from './components/crm/CrmModule';
import { ClientModal } from './components/crm/ClientModal';
import { OrderModal } from './components/crm/OrderModal';
import { OrdersList } from './components/crm/OrdersList';

import { FinancialSummary } from './components/financial/FinancialSummary';
import { PaymentSettlementData } from './components/financial/PaymentSettlementModal';
import { NfeModule } from './components/nfe/NfeModule';
import { FleetModule } from './components/fleet/FleetModule';
import { EmployeesModule } from './components/employees/EmployeesModule';
import { RHModule } from './components/rh/RHModule';
import { ServicesModule } from './components/services/ServicesModule';
import { VendaModule } from './components/vendas/VendaModule';
import { InventoryModule } from './components/inventory/InventoryModule';
import { SuppliersModule } from './components/suppliers/SuppliersModule';
import { ReportsModule } from './components/reports/ReportsModule';
import { CompanySettingsView } from './components/settings/CompanySettingsView';

import { QuickMemoModal } from './components/quick/QuickMemoModal';
import { TrialInfoModal } from './components/quick/TrialInfoModal';
import { LovableIntegrationModal } from './components/integration/LovableIntegrationModal';
import { CustomizeShortcutsModal, DEFAULT_SHORTCUT_IDS } from './components/layout/CustomizeShortcutsModal';
import { ReorderMenuModal, ALL_MENU_ITEMS, DEFAULT_MENU_ORDER } from './components/layout/ReorderMenuModal';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { PublicClientForm } from './components/crm/PublicClientForm';
import { PublicSupplierForm } from './components/suppliers/PublicSupplierForm';
import { FieldFormsView } from './components/services/FieldFormsView';
import { MasterAdminDashboard } from './components/masterAdmin/MasterAdminDashboard';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LandingPage } from './components/landing/LandingPage';
import { AuthPage } from './components/auth/AuthPage';
import { useAuth } from './context/AuthContext';
import { 
  syncAllDataToSupabase, 
  fetchAllDataFromSupabase,
  upsertCliente,
  deleteCliente,
  fetchClientes,
  upsertFornecedor,
  deleteFornecedor,
  fetchFornecedores,
  upsertEstoqueItem,
  deleteEstoqueItem,
  fetchEstoque,
  upsertRhFuncionario,
  deleteRhFuncionario,
  fetchRhFuncionarios,
  upsertGestaoFrota,
  deleteGestaoFrota,
  fetchGestaoFrotas,
  upsertContaAPagar,
  deleteContaAPagar,
  fetchContasAPagar,
  toValidUUID,
  subscribeToCloudTable,
  checkSubscriberAccessStatus,
  saveCloudCompanyProfile,
  fetchCloudCompanyProfile,
  saveCloudServices,
  fetchCloudServices,
  saveCloudOrders,
  fetchCloudOrders,
  saveCloudInventory,
  fetchCloudInventory,
  saveCloudClients,
  fetchCloudClients,
  saveCloudMachineries,
  saveCloudExpenses,
  fetchAllClientModulesFromSupabase
} from './lib/supabaseService';

export default function App() {
  // State Initialization from LocalStorage
  const [expenses, setExpenses] = useState<Expense[]>(() => getStoredExpenses());
  const [categories, setCategories] = useState<ExpenseCategory[]>(() => getStoredCategories());
  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => getStoredCostCenters());
  const [clients, setClients] = useState<Client[]>(() => getStoredClients());
  const [orders, setOrders] = useState<SilageOrder[]>(() => getStoredOrders());
  const [machineries, setMachineries] = useState<Machinery[]>(() => getStoredMachineries());
  const [seasons, setSeasons] = useState<CropSeason[]>(() => getStoredSeasons());
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [fleetTeams, setFleetTeams] = useState<FleetTeam[]>(() => getStoredFleetTeams());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => getStoredSuppliers());
  const [inventory, setInventory] = useState<InventoryItem[]>(() => getStoredInventory());
  const [services, setServices] = useState<ServiceOrder[]>(() => getStoredServices());
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(() => getStoredFuelLogs());
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(() => getStoredMaintenanceLogs());
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => getStoredCompanyProfile());
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => getStoredBankAccounts());
  const [settlements, setSettlements] = useState<ThirdPartySettlement[]>(() => getStoredSettlements());
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(() => getStoredPayrolls());
  const [vacations, setVacations] = useState<VacationRecord[]>(() => getStoredVacations());
  const [leaves, setLeaves] = useState<LeaveRecord[]>(() => getStoredLeaves());
  const [advances, setAdvances] = useState<SalaryAdvance[]>(() => getStoredSalaryAdvances());

  // TopBar shortcuts customization state
  const [selectedShortcuts, setSelectedShortcuts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('silagem_facil_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SHORTCUT_IDS;
  });
  const [isCustomizeShortcutsOpen, setIsCustomizeShortcutsOpen] = useState(false);

  const handleSaveShortcuts = (newShortcuts: string[]) => {
    setSelectedShortcuts(newShortcuts);
    try {
      localStorage.setItem('silagem_facil_shortcuts', JSON.stringify(newShortcuts));
    } catch (e) {
      console.error(e);
    }
  };

  // Sidebar menu order state
  const [menuOrder, setMenuOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('silagem_facil_sidebar_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(id => ALL_MENU_ITEMS.some(m => m.id === id));
          if (!valid.includes('venda')) {
            const servIndex = valid.indexOf('servicos');
            if (servIndex !== -1) {
              valid.splice(servIndex + 1, 0, 'venda');
            } else {
              valid.push('venda');
            }
          }
          if (!valid.includes('fiscal')) {
            const finIndex = valid.indexOf('financeiro');
            if (finIndex !== -1) {
              valid.splice(finIndex + 1, 0, 'fiscal');
            } else {
              valid.push('fiscal');
            }
          }
          const missing = ALL_MENU_ITEMS.filter(m => !valid.includes(m.id)).map(m => m.id);
          return [...valid, ...missing];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_MENU_ORDER;
  });
  const [isReorderMenuOpen, setIsReorderMenuOpen] = useState(false);

  const handleSaveMenuOrder = (newOrder: string[]) => {
    setMenuOrder(newOrder);
    try {
      localStorage.setItem('silagem_facil_sidebar_order', JSON.stringify(newOrder));
      window.dispatchEvent(new CustomEvent('silagem_sidebar_order_changed', { detail: newOrder }));
    } catch (e) {
      console.error(e);
    }
  };

  const { confirm } = useConfirm();
  const { currentUser, signOutUser, setIsSyncing, setLastSyncedAt, startImpersonation, stopImpersonation, activeCompanyId } = useAuth();

  const handleSyncSupabase = async () => {
    setIsSyncing(true);
    try {
      await syncAllDataToSupabase({
        clientes: clients,
        fornecedores: suppliers,
        estoque: inventory,
        rh_funcionarios: employees,
        gestao_frotas: machineries,
        despesas: expenses,
        companyProfile
      });
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to sync to Supabase:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Identificação e isolamento rigoroso de Tenant (Multi-Tenant)
  // Consome prioritariamente activeCompanyId resolvido pelo AuthContext/Supabase
  const activeTenantId = useMemo(() => {
    return activeCompanyId || getActiveCompanyId(companyProfile);
  }, [activeCompanyId, companyProfile]);

  // Sincronização e Carga em Nuvem de Todos os Módulos do Assinante Logado (Supabase)
  const isInitialLoadDone = useRef(false);

  useEffect(() => {
    let isMounted = true;
    isInitialLoadDone.current = false;

    const loadCloudData = async () => {
      try {
        // 0. Carrega perfil fiscal e cadastral da nuvem
        const cloudCompany = await fetchCloudCompanyProfile(activeTenantId);
        if (cloudCompany && isMounted) {
          setCompanyProfile(prev => ({ ...prev, ...cloudCompany }));
        }

        // 1. Carrega dados relacionais com isolamento estrito por company_id
        const cloudData = await fetchAllDataFromSupabase(activeTenantId);
        if (cloudData && isMounted) {
          if (cloudData.clientes) {
            setClients(cloudData.clientes);
          }
          if (cloudData.fornecedores) {
            setSuppliers(cloudData.fornecedores);
          }
          if (cloudData.estoque) {
            setInventory(cloudData.estoque);
          }
          if (cloudData.rh_funcionarios) {
            setEmployees(cloudData.rh_funcionarios);
          }
          if (cloudData.gestao_frotas) {
            setMachineries(cloudData.gestao_frotas);
          }
          if (cloudData.contas_a_pagar) {
            setExpenses(cloudData.contas_a_pagar.map((d: any) => ({
              id: d.id,
              title: d.centro_custo || 'Parcela Fornecedor',
              description: d.centro_custo || 'Parcela Fornecedor',
              amount: Number(d.valor_parcela) || 0,
              dueDate: d.data_vencimento || new Date().toISOString().split('T')[0],
              status: d.status_pago ? 'pago' : 'pendente',
              categoryId: 'despesa_geral',
              categoryColor: '#10b981',
              category: 'despesa_geral',
              categoryName: d.centro_custo || 'Geral',
              paymentMethod: d.forma_pagamento || 'Boleto',
              supplier: 'Fornecedor',
              createdAt: d.created_at || new Date().toISOString()
            } as unknown as Expense)));
          }
        }

        // 2. Carrega todos os módulos operacionais dedicados (Serviços, Vendas, Estoque, Configurações)
        const cloudModules = await fetchAllClientModulesFromSupabase(activeTenantId);
        if (cloudModules && isMounted) {
          if (cloudModules.companyProfile) {
            setCompanyProfile(cloudModules.companyProfile);
          }
          if (cloudModules.services !== null && cloudModules.services !== undefined) {
            setServices(cloudModules.services);
          }
          if (cloudModules.orders !== null && cloudModules.orders !== undefined) {
            setOrders(cloudModules.orders);
          }
          if (cloudModules.inventory !== null && cloudModules.inventory !== undefined) {
            setInventory(cloudModules.inventory);
          }
          if (cloudModules.clients !== null && cloudModules.clients !== undefined) {
            setClients(cloudModules.clients);
          }
          if (cloudModules.machineries !== null && cloudModules.machineries !== undefined) {
            setMachineries(cloudModules.machineries);
          }
          if (cloudModules.expenses !== null && cloudModules.expenses !== undefined) {
            setExpenses(cloudModules.expenses);
          }
          if (cloudModules.terminations !== null && cloudModules.terminations !== undefined) {
            saveStoredTerminations(cloudModules.terminations);
          }
        }

        setLastSyncedAt(new Date());
      } catch (e) {
        console.warn('Notice fetching cloud data from Supabase:', e);
      } finally {
        if (isMounted) {
          isInitialLoadDone.current = true;
        }
      }
    };

    loadCloudData();

    // Assinaturas em tempo real para sincronização instantânea entre múltiplos dispositivos
    const unsubClientes = subscribeToCloudTable('clientes', () => {
      fetchClientes(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          setClients(fresh);
        }
      });
    });

    const unsubFornecedores = subscribeToCloudTable('fornecedores', () => {
      fetchFornecedores(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          setSuppliers(fresh);
        }
      });
    });

    const unsubEstoque = subscribeToCloudTable('estoque', () => {
      fetchEstoque(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          setInventory(fresh);
        }
      });
    });

    const unsubRH = subscribeToCloudTable('rh_funcionarios', () => {
      fetchRhFuncionarios(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          setEmployees(fresh);
        }
      });
    });

    const unsubFrotas = subscribeToCloudTable('gestao_frotas', () => {
      fetchGestaoFrotas(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          setMachineries(fresh);
        }
      });
    });

    const unsubContas = subscribeToCloudTable('contas_a_pagar', () => {
      fetchContasAPagar(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          setExpenses(fresh.map((d: any) => ({
            id: d.id,
            title: d.centro_custo || 'Parcela Fornecedor',
            description: d.centro_custo || 'Parcela Fornecedor',
            amount: Number(d.valor_parcela) || 0,
            dueDate: d.data_vencimento || new Date().toISOString().split('T')[0],
            status: d.status_pago ? 'pago' : 'pendente',
            categoryId: 'despesa_geral',
            categoryColor: '#10b981',
            category: 'despesa_geral',
            categoryName: d.centro_custo || 'Geral',
            paymentMethod: d.forma_pagamento || 'Boleto',
            supplier: 'Fornecedor',
            createdAt: d.created_at || new Date().toISOString()
          } as unknown as Expense)));
        }
      });
    });

    const unsubSettings = subscribeToCloudTable('site_settings', () => {
      fetchAllClientModulesFromSupabase(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          if (fresh.companyProfile) setCompanyProfile(fresh.companyProfile);
          if (fresh.services) setServices(fresh.services);
          if (fresh.orders) setOrders(fresh.orders);
          if (fresh.inventory) setInventory(fresh.inventory);
          if (fresh.clients) setClients(fresh.clients);
          if (fresh.machineries) setMachineries(fresh.machineries);
          if (fresh.expenses) setExpenses(fresh.expenses);
        }
      });
    });

    return () => { 
      isMounted = false; 
      unsubClientes();
      unsubFornecedores();
      unsubEstoque();
      unsubRH();
      unsubFrotas();
      unsubContas();
      unsubSettings();
    };
  }, [activeTenantId, currentUser?.uid, companyProfile?.cnpjCpf, companyProfile?.email]);

  const handleSaveBankAccounts = (newAccounts: BankAccount[]) => {

    setBankAccounts(newAccounts);
    saveStoredBankAccounts(newAccounts);
  };

  const handleSaveSettlements = (newSettlements: ThirdPartySettlement[]) => {
    setSettlements(newSettlements);
    saveStoredSettlements(newSettlements);
  };

  const handleSavePayrolls = (newPayrolls: PayrollRecord[]) => {
    setPayrolls(newPayrolls);
    saveStoredPayrolls(newPayrolls);
  };

  const handleSaveVacations = (newVacations: VacationRecord[]) => {
    setVacations(newVacations);
    saveStoredVacations(newVacations);
  };

  const handleSaveLeaves = (newLeaves: LeaveRecord[]) => {
    setLeaves(newLeaves);
    saveStoredLeaves(newLeaves);
  };

  const handleSaveAdvances = (newAdvances: SalaryAdvance[]) => {
    setAdvances(newAdvances);
    saveStoredSalaryAdvances(newAdvances);
  };

  // Active Navigation Tab (Defaults to 'dashboard' matching the requested view or URL query parameter)
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get('tab') || params.get('modulo');
        if (urlTab === 'formularios' || urlTab === 'agenda' || urlTab === 'servicos') {
          return 'servicos';
        }
        if (urlTab) {
          return urlTab;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return 'dashboard';
  });

  // UI state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem('silagem_facil_theme');
      if (savedTheme === 'dark') return true;
      if (savedTheme === 'light') return false;
      return false; // Modo Claro (Modo Dia) padrão
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingReceiptExpense, setViewingReceiptExpense] = useState<Expense | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isAiParserOpen, setIsAiParserOpen] = useState(false);
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isQuickMemoOpen, setIsQuickMemoOpen] = useState(false);
  const [isTrialInfoOpen, setIsTrialInfoOpen] = useState(false);

  // Apply dark mode class to html
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('silagem_facil_theme', 'dark');
      } catch (err) {
        console.error(err);
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('silagem_facil_theme', 'light');
      } catch (err) {
        console.error(err);
      }
    }
  }, [isDarkMode]);

  // Sync to localStorage
  useEffect(() => { saveStoredExpenses(expenses); }, [expenses]);
  useEffect(() => { saveStoredCategories(categories); }, [categories]);
  useEffect(() => { saveStoredCostCenters(costCenters); }, [costCenters]);
  useEffect(() => { saveStoredClients(clients); }, [clients]);
  useEffect(() => { saveStoredOrders(orders); }, [orders]);
  useEffect(() => { saveStoredMachineries(machineries); }, [machineries]);
  useEffect(() => { saveStoredSeasons(seasons); }, [seasons]);
  useEffect(() => { saveStoredEmployees(employees); }, [employees]);
  useEffect(() => { saveStoredFleetTeams(fleetTeams); }, [fleetTeams]);
  useEffect(() => { saveStoredSuppliers(suppliers); }, [suppliers]);
  useEffect(() => { saveStoredInventory(inventory); }, [inventory]);
  useEffect(() => { saveStoredServices(services); }, [services]);
  useEffect(() => { saveStoredFuelLogs(fuelLogs); }, [fuelLogs]);
  useEffect(() => { saveStoredMaintenanceLogs(maintenanceLogs); }, [maintenanceLogs]);
  useEffect(() => { saveStoredCompanyProfile(companyProfile); }, [companyProfile]);

  // Persistência e Sincronização Automática em Nuvem (Supabase) dos Módulos Principais do Cliente

  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    const t = setTimeout(() => {
      saveCloudServices(services, activeTenantId);
    }, 700);
    return () => clearTimeout(t);
  }, [services, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    const t = setTimeout(() => {
      saveCloudInventory(inventory, activeTenantId);
    }, 700);
    return () => clearTimeout(t);
  }, [inventory, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    const t = setTimeout(() => {
      saveCloudOrders(orders, activeTenantId);
    }, 700);
    return () => clearTimeout(t);
  }, [orders, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    const t = setTimeout(() => {
      saveCloudCompanyProfile(companyProfile, activeTenantId);
    }, 700);
    return () => clearTimeout(t);
  }, [companyProfile, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    const t = setTimeout(() => {
      saveCloudClients(clients, activeTenantId);
    }, 700);
    return () => clearTimeout(t);
  }, [clients, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    const t = setTimeout(() => {
      saveCloudMachineries(machineries, activeTenantId);
    }, 700);
    return () => clearTimeout(t);
  }, [machineries, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current) return;
    const t = setTimeout(() => {
      saveCloudExpenses(expenses, activeTenantId);
    }, 700);
    return () => clearTimeout(t);
  }, [expenses, activeTenantId]);

  // Keep third-party settlements state fresh across component interactions
  useEffect(() => {
    const handleSettlementsUpdate = () => {
      setSettlements(getStoredSettlements());
    };
    window.addEventListener('silagem_settlements_updated', handleSettlementsUpdate);
    window.addEventListener('storage', handleSettlementsUpdate);
    return () => {
      window.removeEventListener('silagem_settlements_updated', handleSettlementsUpdate);
      window.removeEventListener('storage', handleSettlementsUpdate);
    };
  }, []);

  // Reload everything when imported from backup
  const handleDataReload = () => {
    setExpenses(getStoredExpenses());
    setCategories(getStoredCategories());
    setCostCenters(getStoredCostCenters());
    setClients(getStoredClients());
    setOrders(getStoredOrders());
    setMachineries(getStoredMachineries());
    setSeasons(getStoredSeasons());
    setEmployees(getStoredEmployees());
    setFleetTeams(getStoredFleetTeams());
    setSuppliers(getStoredSuppliers());
    setInventory(getStoredInventory());
    setServices(getStoredServices());
    setFuelLogs(getStoredFuelLogs());
    setMaintenanceLogs(getStoredMaintenanceLogs());
    setCompanyProfile(getStoredCompanyProfile());
  };

  // Expense Handlers (Multi-Tenant Persistência no Supabase)
  const handleSaveExpense = (newOrUpdated: Expense | Expense[]) => {
    const items = Array.isArray(newOrUpdated) ? newOrUpdated : [newOrUpdated];
    items.forEach(exp => {
      upsertContaAPagar({
        id: exp.id,
        nota_fiscal_id: exp.invoiceNumber ? toValidUUID(exp.invoiceNumber) : null,
        numero_parcela: '01/01',
        valor_parcela: Number(exp.amount) || 0,
        data_vencimento: exp.dueDate || new Date().toISOString().split('T')[0],
        forma_pagamento: exp.paymentMethod || 'Boleto',
        centro_custo: exp.costCenterName || exp.description || 'Geral',
        status_pago: exp.status === 'pago'
      }, activeTenantId).catch(err => console.warn('Supabase upsertContaAPagar notice:', err));
    });

    if (Array.isArray(newOrUpdated)) {
      setExpenses((prev) => {
        const newIds = new Set(newOrUpdated.map((n) => n.id));
        // Coleta identificadores base das parcelas para substituir com segurança versões antigas da mesma OS ou NF-e
        const baseKeys = new Set(
          newOrUpdated
            .map((n) => {
              if (n.id && n.id.includes('_parc_')) {
                return n.id.split('_parc_')[0];
              }
              return '';
            })
            .filter(Boolean)
        );

        const filtered = prev.filter((e) => {
          if (newIds.has(e.id)) return false;
          if (baseKeys.size > 0) {
            const eBase = e.id.includes('_parc_') ? e.id.split('_parc_')[0] : e.id;
            if (baseKeys.has(eBase)) return false;
          }
          return true;
        });

        return [...newOrUpdated, ...filtered];
      });
    } else {
      setExpenses((prev) => {
        const index = prev.findIndex((e) => e.id === newOrUpdated.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = newOrUpdated;
          return updated;
        }
        return [newOrUpdated, ...prev];
      });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Lançamento Financeiro',
      message: 'Tem certeza que deseja excluir permanentemente este lançamento financeiro?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      deleteContaAPagar(id, activeTenantId).catch(err => console.warn('Supabase deleteContaAPagar notice:', err));
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const handleToggleExpenseStatus = (id: string, newStatus?: ExpenseStatus) => {
    const today = new Date().toISOString().split('T')[0];
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const nextStatus = newStatus || (e.status === 'pago' ? 'pendente' : 'pago');
          const updated = {
            ...e,
            status: nextStatus,
            paymentDate: nextStatus === 'pago' ? (e.paymentDate || today) : undefined,
          };
          upsertContaAPagar({
            id: updated.id,
            valor_parcela: Number(updated.amount) || 0,
            data_vencimento: updated.dueDate || today,
            status_pago: updated.status === 'pago',
            centro_custo: updated.costCenterName || updated.description || 'Geral',
            forma_pagamento: updated.paymentMethod || 'Boleto'
          }, activeTenantId).catch(err => console.warn('Supabase toggle status notice:', err));
          return updated;
        }
        return e;
      })
    );
  };

  const handleSettlePayment = (expenseId: string, settlementData: PaymentSettlementData) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expenseId
          ? {
              ...e,
              status: 'pago',
              paymentDate: settlementData.paymentDate,
              paidByEmployeeId: settlementData.paidByEmployeeId,
              paidByEmployeeName: settlementData.paidByEmployeeName,
              bankAccountId: settlementData.bankAccountId,
              bankAccountName: settlementData.bankAccountName,
              creditSupplier: settlementData.creditSupplier,
            }
          : e
      )
    );

    // Atualiza saldo da conta bancária debitando o valor da despesa
    const exp = expenses.find((e) => e.id === expenseId);
    if (exp && settlementData.bankAccountId) {
      setBankAccounts((prev) =>
        prev.map((acc) =>
          acc.id === settlementData.bankAccountId
            ? {
                ...acc,
                balance: (acc.balance || 0) - exp.amount,
              }
            : acc
        )
      );
    }
  };

  const handleDuplicateExpense = (expense: Expense) => {
    const duplicated: Expense = {
      ...expense,
      id: `exp_${Date.now()}_copy`,
      description: `${expense.description} (Cópia)`,
      createdAt: new Date().toISOString(),
    };
    handleSaveExpense(duplicated);
  };

  // Client Handlers (Multi-Tenant Persistência no Supabase)
  const handleSaveClient = (client: Client) => {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === client.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = client;
        return updated;
      }
      return [client, ...prev];
    });
    upsertCliente(client, activeTenantId).catch(err => {
      console.warn('Notice syncing client to Supabase:', err);
    });
  };

  const handleDeleteClient = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Cliente / Produtor',
      message: 'Deseja realmente excluir este produtor da sua base CRM?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      setClients((prev) => prev.filter((c) => c.id !== id));
      deleteCliente(id, activeTenantId).catch(err => {
        console.warn('Notice deleting client from Supabase:', err);
      });
    }
  };

  const handleUpdateClientStatus = (clientId: string, status: Client['status']) => {
    setClients((prev) => {
      const updated = prev.map((c) => (c.id === clientId ? { ...c, status } : c));
      const target = updated.find(c => c.id === clientId);
      if (target) {
        upsertCliente(target, activeTenantId).catch(err => console.warn('Notice syncing status to Supabase:', err));
      }
      return updated;
    });
  };

  // Gestão de Frotas Handlers (Multi-Tenant Persistência no Supabase)
  const handleSaveMachineries = (newMachineries: Machinery[]) => {
    const oldIds = new Set(machineries.map(m => m.id));
    const newIds = new Set(newMachineries.map(m => m.id));

    // Exclusões no Supabase
    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        deleteGestaoFrota(oldId, activeTenantId).catch(err => console.warn('Supabase deleteGestaoFrota notice:', err));
      }
    }

    // Inserções / Atualizações no Supabase
    for (const m of newMachineries) {
      upsertGestaoFrota(m, activeTenantId).catch(err => console.warn('Supabase upsertGestaoFrota notice:', err));
    }

    setMachineries(newMachineries);
  };

  // RH Funcionários Handlers (Multi-Tenant Persistência no Supabase)
  const handleSaveEmployees = (newEmployees: Employee[]) => {
    const oldIds = new Set(employees.map(e => e.id));
    const newIds = new Set(newEmployees.map(e => e.id));

    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        deleteRhFuncionario(oldId, activeTenantId).catch(err => console.warn('Supabase deleteRhFuncionario notice:', err));
      }
    }

    for (const emp of newEmployees) {
      upsertRhFuncionario(emp, activeTenantId).catch(err => console.warn('Supabase upsertRhFuncionario notice:', err));
    }

    setEmployees(newEmployees);
  };

  // Fornecedores Handlers (Multi-Tenant Persistência no Supabase)
  const handleSaveSuppliers = (newSuppliers: Supplier[]) => {
    const oldIds = new Set(suppliers.map(s => s.id));
    const newIds = new Set(newSuppliers.map(s => s.id));

    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        deleteFornecedor(oldId, activeTenantId).catch(err => console.warn('Supabase deleteFornecedor notice:', err));
      }
    }

    for (const sup of newSuppliers) {
      upsertFornecedor(sup, activeTenantId).catch(err => console.warn('Supabase upsertFornecedor notice:', err));
    }

    setSuppliers(newSuppliers);
  };

  // Estoque Handlers (Multi-Tenant Persistência no Supabase)
  const handleSaveInventory = (newInventory: InventoryItem[]) => {
    const oldIds = new Set(inventory.map(i => i.id));
    const newIds = new Set(newInventory.map(i => i.id));

    for (const oldId of oldIds) {
      if (!newIds.has(oldId)) {
        deleteEstoqueItem(oldId, activeTenantId).catch(err => console.warn('Supabase deleteEstoqueItem notice:', err));
      }
    }

    for (const item of newInventory) {
      upsertEstoqueItem(item, activeTenantId).catch(err => console.warn('Supabase upsertEstoqueItem notice:', err));
    }

    setInventory(newInventory);
  };

  // Order Handlers
  const handleSaveOrder = (order: SilageOrder) => {
    setOrders((prev) => [order, ...prev]);
  };

  const handleDeleteOrder = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Pedido',
      message: 'Deseja realmente excluir este pedido de silagem do sistema?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    }
  };


  const handleUpdateOrderStatus = (id: string, status: SilageOrder['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
  };

  const handleUpdatePaymentStatus = (id: string, paymentStatus: SilageOrder['paymentStatus']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, paymentStatus } : o))
    );
  };

  // Determinação de Rota com Isolamento Estrito de Ambientes
  // 1. Admin Mestre: rota limpa /master-admin ou /master-login com autenticação de Super Admin
  // 2. Formulários Públicos Externos: ?ficha=cliente, ?ficha=fornecedor, ?agendamento=...
  // 3. Painel Interno de Gestão de Silagem (ERP): rota /dashboard ou usuário com sessão ativa
  // 4. Landing Page Pública: Rota raiz "/" como padrão se o usuário não estiver logado
  const getResolvedRoute = (): 'master-admin' | 'operador-campo' | 'ficha-cliente' | 'ficha-fornecedor' | 'landing' | 'auth' | 'dashboard' => {
    if (typeof window === 'undefined') return 'landing';
    const path = window.location.pathname || '';
    const search = window.location.search || '';
    const hash = window.location.hash || '';

    // 1. Admin Mestre (Acesso seguro e estritamente isolado sem Sidebar do cliente)
    if (
      path.includes('master-admin') ||
      path.includes('master-login') ||
      search.includes('master-admin') ||
      search.includes('master-login') ||
      hash.includes('master-admin') ||
      hash.includes('master-login')
    ) {
      return 'master-admin';
    }

    // 2. Formulários Públicos Externos
    if (search.includes('ficha=cliente') || search.includes('form=cliente') || hash.includes('ficha=cliente')) {
      return 'ficha-cliente';
    }
    if (search.includes('ficha=fornecedor') || search.includes('form=fornecedor') || hash.includes('ficha=fornecedor')) {
      return 'ficha-fornecedor';
    }
    if (
      search.includes('agendamento=') ||
      hash.includes('agendamento=') ||
      (search.includes('cargo=') && search.includes('formularios'))
    ) {
      return 'operador-campo';
    }

    // 3. Rota de Autenticação / Cadastro / Sign-up / Login
    if (
      path.includes('/auth') ||
      path.includes('/cadastro') ||
      path.includes('/login') ||
      path.includes('/signup') ||
      search.includes('view=auth') ||
      search.includes('tab=auth') ||
      search.includes('mode=signup') ||
      search.includes('mode=login') ||
      hash.includes('auth') ||
      hash.includes('cadastro') ||
      hash.includes('signup')
    ) {
      return 'auth';
    }

    // 4. Forçar Landing Page se requisitado explicitamente via URL
    if (
      path === '/landing' ||
      search.includes('view=landing') ||
      search.includes('tab=landing') ||
      search.includes('site=publico') ||
      hash.includes('landing')
    ) {
      return 'landing';
    }

    // 5. Painel Interno do Cliente (ERP Gestão de Silagem) - Protegido por Auth Guard
    const hasActiveSession = typeof localStorage !== 'undefined' && localStorage.getItem('silagem_client_session') === 'active';
    const isDashboardPath =
      path.includes('/dashboard') ||
      path.includes('/app') ||
      search.includes('view=dashboard') ||
      search.includes('tab=dashboard') ||
      search.includes('app=true') ||
      hash.includes('dashboard');

    const isAuthenticated = hasActiveSession || Boolean(currentUser);

    // Bloqueio por URL Direta (Auth Guard):
    // Se tentar acessar o dashboard operacional sem autenticação (login e senha),
    // bloqueia o acesso e força o redirecionamento imediato para a tela de login (/auth?mode=login)
    if (isDashboardPath) {
      if (isAuthenticated) {
        return 'dashboard';
      } else {
        try {
          window.history.replaceState({}, '', '/auth?mode=login');
        } catch (e) {
          console.error(e);
        }
        return 'auth';
      }
    }

    // Se já estiver autenticado com sessão ativa e não especificou outra rota pública, libera o dashboard
    if (isAuthenticated && (path === '/app' || path === '/dashboard')) {
      return 'dashboard';
    }

    // 6. Rota padrão da raiz "/": Landing Page Pública
    return 'landing';
  };

  const [currentRoute, setCurrentRoute] = useState<'master-admin' | 'operador-campo' | 'ficha-cliente' | 'ficha-fornecedor' | 'landing' | 'auth' | 'dashboard'>(getResolvedRoute);

  // Sincronizar com mudanças de URL (popstate e hashchange)
  useEffect(() => {
    const handleUrlChange = () => {
      setCurrentRoute(getResolvedRoute());
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [currentUser]);

  // Sincronizar perfil da empresa instantaneamente quando um novo assinante se cadastrar ou for editado
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e?.detail) {
        setCompanyProfile(e.detail);
      } else {
        setCompanyProfile(getStoredCompanyProfile());
      }
    };
    window.addEventListener('silagem_company_profile_updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('silagem_company_profile_updated', handleProfileUpdate);
    };
  }, []);

  // Se o usuário autenticar via login ou cadastro, ativar a sessão e direcionar para o dashboard
  useEffect(() => {
    if (currentUser && currentRoute === 'auth') {
      try {
        localStorage.setItem('silagem_client_session', 'active');
        window.history.pushState({}, '', '/dashboard');
      } catch (e) {
        console.error(e);
      }
      setCurrentRoute('dashboard');
    }
  }, [currentUser, currentRoute]);

  // Transições de Navegação entre Ambientes com Verificação Estrita (Auth Guard)
  const handleEnterApp = () => {
    const hasActiveSession = (typeof localStorage !== 'undefined' && localStorage.getItem('silagem_client_session') === 'active') || Boolean(currentUser);
    if (hasActiveSession) {
      try {
        window.history.pushState({}, '', '/dashboard');
      } catch (e) {
        console.error(e);
      }
      setCurrentRoute('dashboard');
    } else {
      // Se NÃO estiver logado, redireciona imediatamente para a tela de login na rota /auth?mode=login
      handleOpenAuth(undefined, 'login');
    }
  };

  const handleOpenAuth = (planId?: string, authMode: 'signup' | 'login' = 'signup', trialParam?: boolean) => {
    try {
      const params = new URLSearchParams();
      params.set('mode', authMode);
      if (planId) {
        params.set('plan', planId);
      }
      if (trialParam !== undefined) {
        params.set('trial', trialParam ? 'true' : 'false');
      }
      window.history.pushState({}, '', `/auth?${params.toString()}`);
    } catch (e) {
      console.error(e);
    }
    setCurrentRoute('auth');
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const handleOpenMasterAdmin = () => {
    try {
      localStorage.removeItem('admin_impersonated_company_id');
      localStorage.removeItem('is_admin_impersonating');
      localStorage.removeItem('impersonated_subscriber_id');
      localStorage.removeItem('impersonated_subscriber_name');
      localStorage.removeItem('impersonated_subscriber_email');
      localStorage.removeItem('impersonated_subscriber_plan');
      localStorage.removeItem('current_company_id');
    } catch (e) {
      console.error(e);
    }
    try {
      stopImpersonation();
    } catch (e) {
      console.error(e);
    }
    setIsAdminImpersonating(false);
    setImpersonatedSubscriber(null);
    try {
      window.history.pushState({}, '', '/master-admin');
    } catch (e) {
      console.error(e);
    }
    setCurrentRoute('master-admin');
  };

  const handleOpenLandingPage = () => {
    try {
      window.history.pushState({}, '', '/');
    } catch (e) {
      console.error(e);
    }
    setCurrentRoute('landing');
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('admin_impersonated_company_id');
      localStorage.removeItem('is_admin_impersonating');
      localStorage.removeItem('impersonated_subscriber_id');
      localStorage.removeItem('impersonated_subscriber_name');
      localStorage.removeItem('impersonated_subscriber_email');
      localStorage.removeItem('impersonated_subscriber_plan');
      localStorage.removeItem('current_company_id');
      stopImpersonation();
      if (currentUser) {
        await signOutUser();
      }
      localStorage.removeItem('silagem_client_session');
    } catch (e) {
      console.error(e);
    }
    try {
      window.history.pushState({}, '', '/');
    } catch (e) {
      console.error(e);
    }
    setCurrentRoute('landing');
  };

  // Estado de Personificação (Impersonate) pelo Admin Mestre
  const [isAdminImpersonating, setIsAdminImpersonating] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && (
      Boolean(localStorage.getItem('admin_impersonated_company_id')) ||
      localStorage.getItem('is_admin_impersonating') === 'true'
    );
  });
  const [impersonatedSubscriber, setImpersonatedSubscriber] = useState<{ id: string; name: string; email: string; planName?: string } | null>(() => {
    if (typeof localStorage !== 'undefined') {
      const targetId = localStorage.getItem('admin_impersonated_company_id') || localStorage.getItem('impersonated_subscriber_id');
      if (targetId && (localStorage.getItem('is_admin_impersonating') === 'true' || localStorage.getItem('admin_impersonated_company_id'))) {
        return {
          id: targetId,
          name: localStorage.getItem('impersonated_subscriber_name') || 'Assinante',
          email: localStorage.getItem('impersonated_subscriber_email') || '',
          planName: localStorage.getItem('impersonated_subscriber_plan') || 'Produtor Essencial',
        };
      }
    }
    return null;
  });

  // Função para Personificar o Assinante (Botão Verde "→ Entrar")
  const handleImpersonateSubscriber = async (sub: Subscriber) => {
    const targetCompanyId = (sub as any).companyId || sub.id;

    try {
      localStorage.setItem('admin_impersonated_company_id', targetCompanyId);
      localStorage.setItem('is_admin_impersonating', 'true');
      localStorage.setItem('impersonated_subscriber_id', targetCompanyId);
      localStorage.setItem('impersonated_subscriber_name', sub.name);
      localStorage.setItem('impersonated_subscriber_email', sub.responsibleEmail || '');
      localStorage.setItem('impersonated_subscriber_plan', sub.planName || 'Produtor Essencial');
      localStorage.setItem('current_company_id', targetCompanyId);
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('silagem_client_session', 'active');
    } catch (e) {
      console.error(e);
    }

    try {
      startImpersonation(targetCompanyId, {
        name: sub.name,
        email: sub.responsibleEmail,
        planName: sub.planName,
      });
    } catch (e) {
      console.error(e);
    }

    setIsAdminImpersonating(true);
    setImpersonatedSubscriber({
      id: targetCompanyId,
      name: sub.name,
      email: sub.responsibleEmail || '',
      planName: sub.planName || 'Produtor Essencial',
    });

    const impersonatedProfile: CompanyProfile = {
      ...companyProfile,
      id: targetCompanyId,
      companyId: targetCompanyId,
      corporateName: sub.name,
      tradeName: sub.name,
      email: sub.responsibleEmail || '',
      cnpjCpf: sub.cpfCnpj || '',
      stateRegistration: sub.stateRegistration || '',
      phone: sub.phone || '',
      cep: sub.cep || '',
      address: sub.street || '',
      neighborhood: sub.neighborhood || '',
      city: sub.city || '',
      state: sub.state || '',
      planName: sub.planName || 'Produtor Essencial',
    };
    setCompanyProfile(impersonatedProfile);

    // Carrega estritamente os tratores, frotas, RH, clientes e dados reais da fazenda personificada
    try {
      const [cloudData, cloudModules] = await Promise.all([
        fetchAllDataFromSupabase(targetCompanyId),
        fetchAllClientModulesFromSupabase(targetCompanyId)
      ]);

      if (cloudData) {
        if (cloudData.clientes && cloudData.clientes.length > 0) {
          setClients(cloudData.clientes);
        } else if (cloudModules?.clients && cloudModules.clients.length > 0) {
          setClients(cloudModules.clients);
        } else {
          setClients([]);
        }

        if (cloudData.fornecedores && cloudData.fornecedores.length > 0) {
          setSuppliers(cloudData.fornecedores);
        } else {
          setSuppliers([]);
        }

        if (cloudData.estoque && cloudData.estoque.length > 0) {
          setInventory(cloudData.estoque);
        } else if (cloudModules?.inventory && cloudModules.inventory.length > 0) {
          setInventory(cloudModules.inventory);
        } else {
          setInventory([]);
        }

        if (cloudData.rh_funcionarios && cloudData.rh_funcionarios.length > 0) {
          setEmployees(cloudData.rh_funcionarios);
        } else {
          setEmployees([]);
        }

        if (cloudData.gestao_frotas && cloudData.gestao_frotas.length > 0) {
          setMachineries(cloudData.gestao_frotas);
        } else if (cloudModules?.machineries && cloudModules.machineries.length > 0) {
          setMachineries(cloudModules.machineries);
        } else {
          setMachineries([]);
        }

        if (cloudData.contas_a_pagar && cloudData.contas_a_pagar.length > 0) {
          setExpenses(cloudData.contas_a_pagar as Expense[]);
        } else if (cloudModules?.expenses && cloudModules.expenses.length > 0) {
          setExpenses(cloudModules.expenses);
        } else {
          setExpenses([]);
        }
      } else if (cloudModules) {
        if (cloudModules.clients) setClients(cloudModules.clients);
        if (cloudModules.inventory) setInventory(cloudModules.inventory);
        if (cloudModules.machineries) setMachineries(cloudModules.machineries);
        if (cloudModules.expenses) setExpenses(cloudModules.expenses);
      }
    } catch (e) {
      console.warn('Erro ao carregar dados da empresa personificada:', e);
    }

    try {
      window.history.pushState({}, '', '/dashboard');
    } catch (e) {
      console.error(e);
    }
    setCurrentRoute('dashboard');
  };

  // Função para Encerrar a Personificação e Retornar ao Master Admin
  const handleExitImpersonation = () => {
    try {
      localStorage.removeItem('admin_impersonated_company_id');
      localStorage.removeItem('is_admin_impersonating');
      localStorage.removeItem('impersonated_subscriber_id');
      localStorage.removeItem('impersonated_subscriber_name');
      localStorage.removeItem('impersonated_subscriber_email');
      localStorage.removeItem('impersonated_subscriber_plan');
      localStorage.removeItem('current_company_id');
    } catch (e) {
      console.error(e);
    }

    try {
      stopImpersonation();
    } catch (e) {
      console.error(e);
    }

    setIsAdminImpersonating(false);
    setImpersonatedSubscriber(null);
    setCompanyProfile(getStoredCompanyProfile());

    try {
      window.history.pushState({}, '', '/master-admin');
    } catch (e) {
      console.error(e);
    }
    setCurrentRoute('master-admin');
  };

  // Validação de Acesso em Tempo Real com o Supabase (Bloqueio por Inadimplência, Trial Vencido ou Assinante Excluído)
  const [subscriptionCheck, setSubscriptionCheck] = useState<{
    isChecking: boolean;
    hasAccess: boolean;
    status: 'active' | 'trial' | 'expired' | 'suspended' | 'not_found';
    daysRemaining: number;
    blockMessage: string;
    subscriberName?: string;
    subscriberEmail?: string;
    planName?: string;
  }>({
    isChecking: false,
    hasAccess: true,
    status: 'active',
    daysRemaining: 7,
    blockMessage: 'Sua assinatura expirou. Entre em contato com o administrador',
  });

  const performSubscriptionCheck = useCallback(async () => {
    if (isAdminImpersonating) {
      setSubscriptionCheck({
        isChecking: false,
        hasAccess: true,
        status: 'active',
        daysRemaining: 999,
        blockMessage: '',
        subscriberName: impersonatedSubscriber?.name,
        subscriberEmail: impersonatedSubscriber?.email,
        planName: impersonatedSubscriber?.planName || 'Produtor Essencial',
      });
      return;
    }

    const userEmail = (
      currentUser?.email ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('silagem_active_user_email') || localStorage.getItem('silagem_client_email') : '') ||
      companyProfile?.email ||
      ''
    ).toLowerCase().trim();

    const subId = typeof localStorage !== 'undefined' ? localStorage.getItem('silagem_active_subscriber_id') : undefined;

    const result = await checkSubscriberAccessStatus({
      email: userEmail,
      id: subId || companyProfile?.id,
      companyId: companyProfile?.id,
    });

    setSubscriptionCheck({
      isChecking: false,
      hasAccess: result.hasAccess,
      status: result.status,
      daysRemaining: result.daysRemaining,
      blockMessage: result.errorMessage || 'Sua assinatura expirou. Entre em contato com o administrador',
      subscriberName: result.subscriberName || companyProfile?.tradeName || companyProfile?.corporateName,
      subscriberEmail: result.subscriberEmail || userEmail,
      planName: result.planName || companyProfile?.planName || 'Produtor Essencial',
    });
  }, [isAdminImpersonating, currentUser, companyProfile, impersonatedSubscriber]);

  // Executa checagem de assinatura ao iniciar, ao mudar de rota ou ao retomar foco
  useEffect(() => {
    performSubscriptionCheck();

    const handleFocus = () => {
      performSubscriptionCheck();
    };
    window.addEventListener('focus', handleFocus);

    // Escuta eventos em tempo real para sincronização imediata sem F5
    const handleImmediateSync = () => {
      performSubscriptionCheck();
    };
    window.addEventListener('master_admin_data_changed', handleImmediateSync);
    window.addEventListener('company_profile_updated', handleImmediateSync);
    window.addEventListener('storage', handleImmediateSync);

    // Escuta em tempo real nas tabelas de assinantes do Supabase
    const unsubAssinantes = subscribeToCloudTable('assinantes', () => {
      performSubscriptionCheck();
    });
    const unsubSubs = subscribeToCloudTable('subscribers', () => {
      performSubscriptionCheck();
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('master_admin_data_changed', handleImmediateSync);
      window.removeEventListener('company_profile_updated', handleImmediateSync);
      window.removeEventListener('storage', handleImmediateSync);
      unsubAssinantes();
      unsubSubs();
    };
  }, [performSubscriptionCheck, currentRoute]);

  // 1. Rota Isolada: Admin Mestre (Acesso seguro em /master-admin com autenticação de Super Admin)
  if (currentRoute === 'master-admin') {
    return (
      <ErrorBoundary
        fallbackTitle="Painel Admin Mestre"
        fallbackDescription="Ocorreu uma falha ao renderizar os dados do painel mestre. Clique abaixo para reiniciar a visualização com proteção total."
      >
        <MasterAdminDashboard
          onBackToApp={handleEnterApp}
          onOpenLandingPage={handleOpenLandingPage}
          onImpersonate={handleImpersonateSubscriber}
        />
      </ErrorBoundary>
    );
  }

  // 2. Rota Isolada: Autenticação & Cadastro com 15 Dias Grátis (/auth?mode=signup)
  if (currentRoute === 'auth') {
    return (
      <AuthPage
        onEnterApp={handleEnterApp}
        onOpenLandingPage={handleOpenLandingPage}
        onCompanyCreated={(newProfile) => {
          setCompanyProfile(newProfile);
        }}
      />
    );
  }

  // 3. Rota Isolada: Landing Page Pública (Na rota raiz "/" ou deslogado)
  if (currentRoute === 'landing') {
    return (
      <LandingPage
        onEnterApp={handleEnterApp}
        onOpenMasterAdmin={handleOpenMasterAdmin}
        onNavigateToAuth={handleOpenAuth}
      />
    );
  }

  // 3. Rota Isolada: Formulário Externo de Operador de Campo
  if (currentRoute === 'operador-campo') {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-4xl space-y-3">
          <FieldFormsView
            companyProfile={companyProfile}
            machineries={machineries}
            employees={employees}
            clients={clients}
            isExternalOperatorMode={true}
            onExitOperatorMode={() => {
              handleEnterApp();
            }}
          />
        </div>
      </div>
    );
  }

  // 4. Rota Isolada: Ficha Pública de Produtor (CRM)
  if (currentRoute === 'ficha-cliente') {
    return (
      <PublicClientForm
        onBackToApp={handleEnterApp}
      />
    );
  }

  // 5. Rota Isolada: Ficha Pública de Fornecedor
  if (currentRoute === 'ficha-fornecedor') {
    return (
      <PublicSupplierForm
        onBackToApp={handleEnterApp}
      />
    );
  }

  // 6. Painel de Gestão de Silagem (ERP Interno do Cliente, visível em /dashboard com login ativo)
  const isUserAuthenticated = (typeof localStorage !== 'undefined' && localStorage.getItem('silagem_client_session') === 'active') || Boolean(currentUser);
  if (!isUserAuthenticated) {
    return (
      <AuthPage
        onEnterApp={handleEnterApp}
        onOpenLandingPage={handleOpenLandingPage}
        onCompanyCreated={(newProfile) => {
          setCompanyProfile(newProfile);
        }}
      />
    );
  }

  // Se o status for diferente de 'active' ou se os dias de trial forem menores ou iguais a 0 (ou assinante excluído),
  // bloqueia o acesso e redireciona imediatamente para a tela de bloqueio
  if (!subscriptionCheck.hasAccess && !isAdminImpersonating) {
    return (
      <SuspendedAccountScreen
        subscriberName={subscriptionCheck.subscriberName || companyProfile?.tradeName || companyProfile?.corporateName}
        subscriberEmail={subscriptionCheck.subscriberEmail || currentUser?.email || companyProfile?.email}
        blockMessage="Sua assinatura expirou. Entre em contato com o administrador"
        reason={subscriptionCheck.status === 'expired' ? 'expired' : subscriptionCheck.status === 'not_found' ? 'deleted' : 'suspended'}
        onBackToHome={handleOpenLandingPage}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-blue-50/50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-blue-200 selection:text-blue-900">
      
      {/* Barra Fixa Amarela de Personificação (Impersonate) no topo do ERP */}
      {isAdminImpersonating && (
        <div className="sticky top-0 z-50 w-full bg-amber-400 text-stone-950 font-bold px-4 py-2.5 flex items-center justify-between shadow-md border-b border-amber-500">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-700 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-800"></span>
            </span>
            <span>
              Você está visualizando o sistema como{' '}
              <strong className="font-black text-stone-950 underline decoration-stone-950 underline-offset-2">
                {impersonatedSubscriber?.name || 'Assinante'}
              </strong>{' '}
              <span className="hidden sm:inline text-stone-800 font-mono text-xs">
                ({impersonatedSubscriber?.email || ''})
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={handleExitImpersonation}
            className="px-3.5 py-1.5 bg-stone-950 hover:bg-stone-800 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Painel Master</span>
          </button>
        </div>
      )}

      {/* Left Fixed Sidebar - Limpa, sem links da Landing Page ou Admin Mestre */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        companyProfile={companyProfile}
        menuOrder={menuOrder}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onLogout={handleLogout}
      />

      {/* Backdrop for mobile sidebar */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Main Body Area with left padding for desktop sidebar */}
      <div 
        className="lg:pl-64 flex flex-col flex-1 min-h-screen bg-zinc-100 dark:bg-stone-950"
      >
        
        {/* Top Bar with Trial Notice and Horizontal Pill Carousel */}
        <TopBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenQuickMemo={() => setIsQuickMemoOpen(true)}
          onOpenTrialInfo={() => setIsTrialInfoOpen(true)}
          selectedShortcuts={selectedShortcuts}
          onOpenCustomizeShortcuts={() => setIsCustomizeShortcutsOpen(true)}
          trialDaysRemaining={subscriptionCheck.daysRemaining}
          subscriptionStatus={subscriptionCheck.status}
          subscriptionPlanName={subscriptionCheck.planName || companyProfile?.planName}
        />

        {/* Dynamic Page Content (100% Full Width across all modules) */}
        <main 
          id="crm-main-content"
          className="flex-1 p-2.5 sm:p-3 lg:p-3.5 pb-20 lg:pb-3.5 w-full max-w-none bg-zinc-100 dark:bg-stone-950"
        >
          
          {/* TAB 1: Main Dashboard (Matching Screenshot) */}
          {activeTab === 'dashboard' && (
            <MainDashboard
              expenses={expenses}
              clients={clients}
              machineries={machineries}
              employees={employees}
              orders={orders}
              services={services}
              inventory={inventory}
              fuelLogs={fuelLogs}
              seasons={seasons}
              onNavigate={(tab) => setActiveTab(tab)}
              onNewExpense={() => {
                setEditingExpense(null);
                setIsExpenseModalOpen(true);
              }}
              onOpenAiParser={() => setIsAiParserOpen(true)}
              onOpenIntegration={() => setIsIntegrationModalOpen(true)}
            />
          )}

          {/* TAB: Serviços de Silagem & Colheita */}
          {activeTab === 'servicos' && (
            <ServicesModule
              services={services}
              machineries={machineries}
              employees={employees}
              clients={clients}
              companyProfile={companyProfile}
              onSaveServices={setServices}
              onSaveClients={setClients}
            />
          )}

          {/* TAB: Venda (Vendas Agrícolas, Fornecimento de Silagem e Contratos) */}
          {(activeTab === 'venda' || activeTab === 'vendas') && (
            <VendaModule
              services={services}
              machineries={machineries}
              employees={employees}
              clients={clients}
              companyProfile={companyProfile}
              onSaveServices={setServices}
              onSaveClients={setClients}
            />
          )}

          {/* TAB: Estoque & Insumos */}
          {activeTab === 'estoque' && (
            <InventoryModule
              inventory={inventory}
              onSaveInventory={handleSaveInventory}
            />
          )}

          {/* TAB: Financeiro (Consolidado, Despesas, Contas, A Pagar, A Receber, Acertos, Exportar) */}
          {(activeTab === 'financeiro' || activeTab === 'despesas') && (
            <FinancialSummary
              expenses={expenses}
              orders={orders}
              seasons={seasons}
              services={services}
              bankAccounts={bankAccounts}
              settlements={settlements}
              categories={categories}
              costCenters={costCenters}
              employees={employees}
              fleetTeams={fleetTeams}
              machineries={machineries}
              companyProfile={companyProfile}
              initialSubTab={activeTab === 'despesas' ? 'despesas' : undefined}
              onSaveBankAccounts={handleSaveBankAccounts}
              onSaveExpenses={handleSaveExpense}
              onSaveSettlements={handleSaveSettlements}
              onToggleExpenseStatus={handleToggleExpenseStatus}
              onSettlePayment={handleSettlePayment}
              onSettleExpense={(params) => handleSettlePayment(params.expenseId, params)}
              onEditExpense={(exp) => {
                setEditingExpense(exp);
                setIsExpenseModalOpen(true);
              }}
              onNewExpense={() => {
                setEditingExpense(null);
                setIsExpenseModalOpen(true);
              }}
              onDeleteExpense={handleDeleteExpense}
              onViewReceipt={(exp) => setViewingReceiptExpense(exp)}
              onDuplicateExpense={handleDuplicateExpense}
              onOpenAiParser={() => setIsAiParserOpen(true)}
            />
          )}

          {/* TAB: Fiscal (NF-e, Notas Fiscais Eletrônicas, Importação XML) */}
          {(activeTab === 'fiscal' || activeTab === 'nfe_importar' || activeTab === 'nfe_notas') && (
            <div id="fiscal-module-container" className="w-full max-w-none space-y-6">
              <NfeModule
                expenses={expenses}
                companyProfile={companyProfile}
                viewMode="import"
                inventory={inventory}
                onSaveInventory={handleSaveInventory}
                suppliers={suppliers}
                onSaveSuppliers={handleSaveSuppliers}
                costCenters={costCenters}
                onSaveCostCenters={(updatedCostCenters) => setCostCenters(updatedCostCenters)}
                categories={categories}
                onDeleteExpense={(idOrNumber) => {
                  setExpenses((prev) => prev.filter((e) => e.id !== idOrNumber && e.invoiceNumber !== idOrNumber));
                }}
                onAddExpenseFromNfe={(newExpOrList) => {
                  const list = Array.isArray(newExpOrList) ? newExpOrList : [newExpOrList];
                  const createdList: Expense[] = list.map((newExp, idx) => {
                    const cat = categories.find(c => c.id === newExp.categoryId);
                    const cc = costCenters.find(c => c.id === newExp.costCenterId);
                    return {
                      id: newExp.id || `exp_nfe_${Date.now()}_${idx}`,
                      description: newExp.description || 'Despesa Importada via NF-e',
                      amount: newExp.amount || 0,
                      categoryId: newExp.categoryId || 'cat_combustivel',
                      categoryName: newExp.categoryName || cat?.name || 'Combustível & Arla (Diesel)',
                      categoryColor: newExp.categoryColor || cat?.color || '#d97706',
                      dueDate: newExp.dueDate || new Date().toISOString().split('T')[0],
                      paymentDate: newExp.paymentDate,
                      status: newExp.status || 'pendente',
                      paymentMethod: newExp.paymentMethod || 'boleto',
                      supplier: newExp.supplier || 'Fornecedor NF-e',
                      invoiceNumber: newExp.invoiceNumber || 'NF-e',
                      costCenterId: newExp.costCenterId || cc?.id,
                      costCenterName: newExp.costCenterName || cc?.name,
                      notes: newExp.notes,
                      nfeItems: newExp.nfeItems,
                      createdAt: newExp.createdAt || new Date().toISOString(),
                    };
                  });
                  handleSaveExpense(createdList.length === 1 ? createdList[0] : createdList);
                }}
              />
            </div>
          )}

          {/* TAB: RH (Recursos Humanos: Dashboard, Funcionários, Folha, Férias, Afastamentos, Adiantamentos) */}
          {(activeTab === 'rh' || activeTab === 'funcionarios') && (
            <RHModule
              employees={employees}
              payrolls={payrolls}
              vacations={vacations}
              leaves={leaves}
              advances={advances}
              services={services}
              companyProfile={companyProfile}
              initialSubTab={activeTab === 'funcionarios' ? 'funcionarios' : undefined}
              onSaveEmployees={handleSaveEmployees}
              onSavePayrolls={handleSavePayrolls}
              onSaveVacations={handleSaveVacations}
              onSaveLeaves={handleSaveLeaves}
              onSaveAdvances={handleSaveAdvances}
            />
          )}

          {/* TAB 7: Relatórios */}
          {activeTab === 'relatorios' && (
            <ReportsModule
              expenses={expenses}
              orders={orders}
              services={services}
              companyProfile={companyProfile}
              fuelLogs={fuelLogs}
              clients={clients}
              machineries={machineries}
              seasons={seasons}
            />
          )}

          {/* TAB 8: Clientes CRM */}
          {activeTab === 'clientes' && (
            <CrmModule
              clients={clients}
              orders={orders}
              onNewClient={() => {
                setEditingClient(null);
                setIsClientModalOpen(true);
              }}
              onEditClient={(c) => {
                setEditingClient(c);
                setIsClientModalOpen(true);
              }}
              onDeleteClient={handleDeleteClient}
              onNewOrder={(clientId) => {
                setIsOrderModalOpen(true);
              }}
              onUpdateClientStatus={handleUpdateClientStatus}
            />
          )}

          {/* TAB: Fornecedores */}
          {activeTab === 'fornecedores' && (
            <SuppliersModule
              suppliers={suppliers}
              onSaveSuppliers={handleSaveSuppliers}
            />
          )}

          {/* TAB: Gestão de Frotas / Veículos / Manutenções / Motoristas / Equipe / Combustível / Rodízio */}
          {(activeTab === 'frotas' || activeTab === 'veiculos' || activeTab === 'manutencoes' || activeTab === 'combustivel' || activeTab === 'motoristas' || activeTab === 'equipe' || activeTab === 'rodizio' || activeTab === 'rodizio_pneus') && (
            <FleetModule
              machineries={machineries}
              employees={employees}
              teams={fleetTeams}
              fuelLogs={fuelLogs}
              maintenanceLogs={maintenanceLogs}
              expenses={expenses}
              inventory={inventory}
              suppliers={suppliers}
              services={services}
              orders={orders}
              companyProfile={companyProfile}
              initialSubTab={
                activeTab === 'veiculos' ? 'veiculos' :
                activeTab === 'motoristas' ? 'motoristas' :
                activeTab === 'equipe' ? 'equipe' :
                activeTab === 'combustivel' ? 'combustivel' :
                activeTab === 'manutencoes' ? 'manutencoes' :
                (activeTab === 'rodizio' || activeTab === 'rodizio_pneus') ? 'rodizio' : undefined
              }
              onSaveMachineries={handleSaveMachineries}
              onSaveEmployees={handleSaveEmployees}
              onSaveTeams={setFleetTeams}
              onSaveFuelLogs={setFuelLogs}
              onSaveMaintenanceLogs={setMaintenanceLogs}
              onSaveInventory={handleSaveInventory}
              onSaveServices={setServices}
              onSaveOrders={setOrders}
              onAddExpense={(newExpOrList: any) => {
                const list = Array.isArray(newExpOrList) ? newExpOrList : [newExpOrList];
                const baseTime = Date.now();
                const createdList: Expense[] = list.map((newExp, idx) => {
                  const uniqueId = newExp.id || (list.length > 1 ? `exp_fleet_${baseTime}_parc_${idx + 1}` : `exp_fleet_${baseTime}_${idx}`);
                  return {
                    id: uniqueId,
                    description: newExp.description || 'Despesa de Frota',
                    amount: Number(newExp.amount) || 0,
                    categoryId: newExp.categoryId || (newExp.category?.toLowerCase().includes('combust') ? 'cat_combustivel' : 'cat_manutencao'),
                    categoryName: newExp.categoryName || newExp.category || 'Gestão de Frotas',
                    categoryColor: newExp.categoryColor || (newExp.category?.toLowerCase().includes('combust') ? '#d97706' : '#6366f1'),
                    dueDate: newExp.dueDate || newExp.date || new Date().toISOString().split('T')[0],
                    status: (newExp.status as any) || 'pendente',
                    paymentMethod: (newExp.paymentMethod as any) || 'boleto',
                    supplier: newExp.supplier || 'Fornecedor',
                    invoiceNumber: newExp.invoiceNumber,
                    notes: newExp.notes,
                    createdAt: newExp.createdAt || new Date().toISOString(),
                  };
                });
                handleSaveExpense(createdList.length === 1 ? createdList[0] : createdList);
              }}
            />
          )}

          {/* TAB 12: Configurações da Empresa & Lovable Sync */}
          {activeTab === 'configuracoes' && (
            <CompanySettingsView
              companyProfile={companyProfile}
              onSaveCompanyProfile={(updated) => {
                setCompanyProfile(updated);
                saveStoredCompanyProfile(updated);
                saveCloudCompanyProfile(updated, activeTenantId);
              }}
              categories={categories}
              costCenters={costCenters}
              onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
              onOpenIntegrationModal={() => setIsIntegrationModalOpen(true)}
              onSyncSupabase={handleSyncSupabase}
              onOpenCustomizeShortcuts={() => setIsCustomizeShortcutsOpen(true)}
              onOpenReorderMenu={() => setIsReorderMenuOpen(true)}
            />
          )}

        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (RWD Mobile First) */}
      <BottomNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        onNewExpense={() => {
          setEditingExpense(null);
          setIsExpenseModalOpen(true);
        }}
      />

      {/* Global Modals */}
      
      {/* Expense Modal (Create & Edit) */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        editingExpense={editingExpense}
        categories={categories}
        costCenters={costCenters}
        machineries={machineries}
        employees={employees}
        teams={fleetTeams}
        suppliers={suppliers}
        bankAccounts={bankAccounts}
        onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
        onSaveCategories={setCategories}
        onSaveCostCenters={setCostCenters}
        onSaveEmployees={setEmployees}
        onSaveTeams={setFleetTeams}
        onSaveSuppliers={setSuppliers}
      />

      {/* Receipt / Invoice Viewer Modal */}
      <ExpenseReceiptViewer
        expense={viewingReceiptExpense}
        onClose={() => setViewingReceiptExpense(null)}
      />

      {/* Category & Cost Center Manager Modal */}
      <ExpenseCategoriesModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onSaveCategories={setCategories}
        costCenters={costCenters}
        onSaveCostCenters={setCostCenters}
      />

      {/* AI Fast Entry Modal */}
      <AiExpenseParserModal
        isOpen={isAiParserOpen}
        onClose={() => setIsAiParserOpen(false)}
        onAddExpense={(exp) => handleSaveExpense(exp)}
        categories={categories}
        costCenters={costCenters}
        machineries={machineries}
      />

      {/* Client Modal */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
        editingClient={editingClient}
      />

      {/* Order Modal */}
      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSave={handleSaveOrder}
        clients={clients}
      />

      {/* Lovable Integration / Import Modal */}
      <LovableIntegrationModal
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
        onDataImported={handleDataReload}
      />

      {/* Quick Memo Modal */}
      <QuickMemoModal
        isOpen={isQuickMemoOpen}
        onClose={() => setIsQuickMemoOpen(false)}
      />

      {/* Trial Info Modal */}
      <TrialInfoModal
        isOpen={isTrialInfoOpen}
        onClose={() => setIsTrialInfoOpen(false)}
      />

      {/* Modal de Personalizar Atalhos do Topo (Checkboxes & Ordem) */}
      <CustomizeShortcutsModal
        isOpen={isCustomizeShortcutsOpen}
        onClose={() => setIsCustomizeShortcutsOpen(false)}
        selectedShortcuts={selectedShortcuts}
        onSave={handleSaveShortcuts}
      />

      {/* Modal de Organizar Ordem do Menu Lateral */}
      <ReorderMenuModal
        isOpen={isReorderMenuOpen}
        onClose={() => setIsReorderMenuOpen(false)}
        currentOrder={menuOrder}
        onSaveOrder={handleSaveMenuOrder}
      />

    </div>
  );
}
