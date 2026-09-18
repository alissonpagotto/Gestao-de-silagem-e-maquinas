import React, { useState, useEffect, useMemo } from 'react';
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
import { PublicClientForm } from './components/crm/PublicClientForm';
import { PublicSupplierForm } from './components/suppliers/PublicSupplierForm';
import { FieldFormsView } from './components/services/FieldFormsView';
import { MasterAdminDashboard } from './components/masterAdmin/MasterAdminDashboard';
import { LandingPage } from './components/landing/LandingPage';
import { AuthPage } from './components/auth/AuthPage';
import { useAuth } from './context/AuthContext';
import { 
  syncAllDataToSupabase, 
  fetchAllDataFromSupabase,
  upsertCliente,
  deleteCliente,
  fetchClientes,
  subscribeToCloudTable
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
  const { currentUser, signOutUser, setIsSyncing, setLastSyncedAt } = useAuth();

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

  // When app boots or auth state is established, if Supabase cloud data exists, fetch it and populate
  useEffect(() => {
    let isMounted = true;
    const activeCompanyId = getActiveCompanyId(companyProfile);

    (async () => {
      try {
        const cloudData = await fetchAllDataFromSupabase(activeCompanyId);
        if (cloudData && isMounted) {
          if (cloudData.clientes && cloudData.clientes.length > 0) {
            setClients(prev => {
              const existingIds = new Set(prev.map(c => c.id));
              const newItems = cloudData.clientes.filter((c: any) => !existingIds.has(c.id));
              return [...prev, ...newItems];
            });
          }
          if (cloudData.fornecedores && cloudData.fornecedores.length > 0) {
            setSuppliers(prev => {
              const existingIds = new Set(prev.map(s => s.id));
              const newItems = cloudData.fornecedores.filter((s: any) => !existingIds.has(s.id));
              return [...prev, ...newItems];
            });
          }
          if (cloudData.estoque && cloudData.estoque.length > 0) {
            setInventory(prev => {
              const existingIds = new Set(prev.map(i => i.id));
              const newItems = cloudData.estoque.filter((i: any) => !existingIds.has(i.id));
              return [...prev, ...newItems];
            });
          }
          if (cloudData.rh_funcionarios && cloudData.rh_funcionarios.length > 0) {
            setEmployees(prev => {
              const existingIds = new Set(prev.map(e => e.id));
              const newItems = cloudData.rh_funcionarios.filter((e: any) => !existingIds.has(e.id));
              return [...prev, ...newItems];
            });
          }
          if (cloudData.gestao_frotas && cloudData.gestao_frotas.length > 0) {
            setMachineries(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newItems = cloudData.gestao_frotas.filter((m: any) => !existingIds.has(m.id));
              return [...prev, ...newItems];
            });
          }
          if (cloudData.contas_a_pagar && cloudData.contas_a_pagar.length > 0) {
            setExpenses(prev => {
              const existingIds = new Set(prev.map(d => d.id));
              const newItems = cloudData.contas_a_pagar
                .filter((d: any) => !existingIds.has(d.id))
                .map((d: any) => ({
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
                } as unknown as Expense));
              return [...prev, ...newItems];
            });
          }
          setLastSyncedAt(new Date());
        }
      } catch (e) {
        console.warn('Notice fetching cloud data from Supabase:', e);
      }
    })();

    // Assinaturas em tempo real para sincronização instantânea entre múltiplos dispositivos
    const unsubClientes = subscribeToCloudTable('clientes', () => {
      fetchClientes(activeCompanyId).then(fresh => {
        if (fresh && fresh.length > 0 && isMounted) {
          setClients(fresh);
        }
      });
    });

    return () => { 
      isMounted = false; 
      unsubClientes();
    };
  }, [currentUser?.uid, companyProfile?.cnpjCpf, companyProfile?.email]);

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

  // Expense Handlers
  const handleSaveExpense = (newOrUpdated: Expense | Expense[]) => {
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
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const handleToggleExpenseStatus = (id: string, newStatus?: ExpenseStatus) => {
    const today = new Date().toISOString().split('T')[0];
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const nextStatus = newStatus || (e.status === 'pago' ? 'pendente' : 'pago');
          return {
            ...e,
            status: nextStatus,
            paymentDate: nextStatus === 'pago' ? (e.paymentDate || today) : undefined,
          };
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
    setExpenses((prev) => [duplicated, ...prev]);
  };

  // Client Handlers
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
    upsertCliente(client).catch(err => {
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
      deleteCliente(id).catch(err => {
        console.warn('Notice deleting client from Supabase:', err);
      });
    }
  };

  const handleUpdateClientStatus = (clientId: string, status: Client['status']) => {
    setClients((prev) => {
      const updated = prev.map((c) => (c.id === clientId ? { ...c, status } : c));
      const target = updated.find(c => c.id === clientId);
      if (target) {
        upsertCliente(target).catch(err => console.warn('Notice syncing status to Supabase:', err));
      }
      return updated;
    });
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

  const handleOpenAuth = (planId?: string, authMode: 'signup' | 'login' = 'signup') => {
    try {
      const params = new URLSearchParams();
      params.set('mode', authMode);
      if (planId) {
        params.set('plan', planId);
      }
      window.history.pushState({}, '', `/auth?${params.toString()}`);
    } catch (e) {
      console.error(e);
    }
    setCurrentRoute('auth');
  };

  const handleOpenMasterAdmin = () => {
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
    return typeof localStorage !== 'undefined' && localStorage.getItem('is_admin_impersonating') === 'true';
  });
  const [impersonatedSubscriber, setImpersonatedSubscriber] = useState<{ id: string; name: string; email: string } | null>(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('is_admin_impersonating') === 'true') {
      return {
        id: localStorage.getItem('impersonated_subscriber_id') || '',
        name: localStorage.getItem('impersonated_subscriber_name') || 'Assinante',
        email: localStorage.getItem('impersonated_subscriber_email') || '',
      };
    }
    return null;
  });

  // Função para Personificar o Assinante
  const handleImpersonateSubscriber = async (sub: Subscriber) => {
    try {
      localStorage.setItem('is_admin_impersonating', 'true');
      localStorage.setItem('impersonated_subscriber_id', sub.id);
      localStorage.setItem('impersonated_subscriber_name', sub.name);
      localStorage.setItem('impersonated_subscriber_email', sub.responsibleEmail || '');
      localStorage.setItem('current_company_id', sub.id);
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('silagem_client_session', 'active');
    } catch (e) {
      console.error(e);
    }

    setIsAdminImpersonating(true);
    setImpersonatedSubscriber({
      id: sub.id,
      name: sub.name,
      email: sub.responsibleEmail || '',
    });

    const impersonatedProfile: CompanyProfile = {
      ...companyProfile,
      id: sub.id,
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

    // Carrega estritamente os tratores, frotas e dados reais da fazenda personificada
    try {
      const cloudData = await fetchAllDataFromSupabase(sub.id);
      if (cloudData) {
        if (cloudData.clientes) setClients(cloudData.clientes);
        if (cloudData.fornecedores) setSuppliers(cloudData.fornecedores);
        if (cloudData.estoque) setInventory(cloudData.estoque);
        if (cloudData.rh_funcionarios) setEmployees(cloudData.rh_funcionarios);
        if (cloudData.gestao_frotas) setMachineries(cloudData.gestao_frotas);
        if (cloudData.contas_a_pagar) setExpenses(cloudData.contas_a_pagar);
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
      localStorage.removeItem('is_admin_impersonating');
      localStorage.removeItem('impersonated_subscriber_id');
      localStorage.removeItem('impersonated_subscriber_name');
      localStorage.removeItem('impersonated_subscriber_email');
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

  // Verifica se o assinante atual está com a assinatura suspensa no Supabase/banco
  const isSuspendedAccount = useMemo(() => {
    if (isAdminImpersonating) return false;
    const currentSubEmail = (currentUser?.email || companyProfile?.email || '').toLowerCase().trim();
    const storedSubs = getStoredSubscribers();
    const matched = storedSubs.find(s => 
      (currentSubEmail && s.responsibleEmail?.toLowerCase().trim() === currentSubEmail) ||
      (companyProfile?.id && s.id === companyProfile.id)
    );
    if (matched) {
      return matched.status?.toLowerCase() === 'suspensa' || matched.status?.toLowerCase() === 'suspenso';
    }
    return false;
  }, [currentUser, companyProfile, isAdminImpersonating]);

  // 1. Rota Isolada: Admin Mestre (Acesso seguro em /master-admin com autenticação de Super Admin)
  if (currentRoute === 'master-admin') {
    return (
      <MasterAdminDashboard
        onBackToApp={handleEnterApp}
        onOpenLandingPage={handleOpenLandingPage}
        onImpersonate={handleImpersonateSubscriber}
      />
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

  // Se a conta do assinante estiver com status 'Suspenso', bloqueia o ERP e exibe a tela de regularização
  if (isSuspendedAccount) {
    return (
      <SuspendedAccountScreen
        subscriberName={companyProfile?.tradeName || companyProfile?.corporateName}
        subscriberEmail={currentUser?.email || companyProfile?.email}
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
        className="lg:pl-64 flex flex-col flex-1 min-h-screen bg-slate-100/70 dark:bg-stone-950"
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
        />

        {/* Dynamic Page Content (100% Full Width across all modules) */}
        <main 
          id="crm-main-content"
          className="flex-1 p-2.5 sm:p-3 lg:p-3.5 w-full max-w-none"
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
              onSaveInventory={setInventory}
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
              onSaveExpenses={setExpenses}
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
                onSaveInventory={(updatedInv) => setInventory(updatedInv)}
                suppliers={suppliers}
                onSaveSuppliers={(updatedSuppliers) => setSuppliers(updatedSuppliers)}
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
              onSaveEmployees={setEmployees}
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
              onSaveSuppliers={setSuppliers}
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
              onSaveMachineries={setMachineries}
              onSaveEmployees={setEmployees}
              onSaveTeams={setFleetTeams}
              onSaveFuelLogs={setFuelLogs}
              onSaveMaintenanceLogs={setMaintenanceLogs}
              onSaveInventory={setInventory}
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
