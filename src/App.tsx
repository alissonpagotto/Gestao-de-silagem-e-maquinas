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
  MaintenancePartItem,
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
  ensureStockServicesInitialized,
  ensureStockCategoriesInitialized,
  ensureServicesInInventory,
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
  getActiveCompanyId,
  saveCompanyRhFolhas,
  getCompanyRhFolhas,
  saveCompanyRhFerias,
  getCompanyRhFerias,
  saveCompanyRhFaltas,
  getCompanyRhFaltas,
  saveCompanyFrotas,
  getCompanyFrotas,
  saveCompanyFuncionarios,
  getCompanyFuncionarios,
  saveCompanyFornecedores,
  getCompanyFornecedores,
  saveCompanyClientes,
  getCompanyClientes,
  saveCompanyDespesas,
  getCompanyDespesas,
  saveCompanyServicos,
  getCompanyServicos,
  saveCompanyEstoque,
  getCompanyEstoque,
  saveCompanyAbastecimentos,
  getCompanyAbastecimentos
} from './lib/storage';
import { IS_OFFLINE_LOCAL_STORAGE_MODE } from './lib/supabase';
import { useConfirm } from './context/ConfirmContext';


import { Sidebar } from './components/layout/Sidebar';
import { SupabaseStatusControl } from './components/layout/SupabaseStatusControl';
import { MainDashboard } from './components/dashboard/MainDashboard';

import { PlusCircle, Sparkles, ArrowLeft, Shield, Menu } from 'lucide-react';
import { UserSessionModal } from './components/cadastrosBase/UserSessionModal';
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
import { AlmoxarifadoModule } from './components/inventory/AlmoxarifadoModule';
import { SuppliersModule } from './components/suppliers/SuppliersModule';
import { ReportsModule } from './components/reports/ReportsModule';
import { CompanySettingsView } from './components/settings/CompanySettingsView';
import { CadastrosBaseModule } from './components/cadastrosBase/CadastrosBaseModule';
import { AccessDeniedView } from './components/cadastrosBase/AccessDeniedView';
import { 
  getActiveUserSession, 
  SimulatedUserSession, 
  ModulePermissionKey 
} from './lib/cadastrosBaseStorage';

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
  isSupabaseConfigured,
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
  mapRowToEmployee,
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
  fetchAllClientModulesFromSupabase,
  fetchAbastecimentos,
  saveCloudFuelLogs,
  saveCloudMaintenanceLogs,
  fetchCloudMaintenanceLogs,
  saveCloudBankAccounts,
  fetchCloudBankAccounts,
  saveCloudVacations,
  fetchCloudVacations,
  getAbastecimentosTableName,
  fetchFrentesTrabalho,
  fetchFrentesTrabalhoMembros,
  notifyDocumentosEntradaSync
} from './lib/supabaseService';
import { supabase } from './lib/supabaseClient';

export default function App() {
  // State Initialization from LocalStorage (resiliente, amarrado à empresa/PC)
  const [expenses, setExpenses] = useState<Expense[]>(() => getCompanyDespesas());
  const [categories, setCategories] = useState<ExpenseCategory[]>(() => getStoredCategories());
  const [costCenters, setCostCenters] = useState<CostCenter[]>(() => getStoredCostCenters());
  const [clients, setClients] = useState<Client[]>(() => getCompanyClientes());
  const [orders, setOrders] = useState<SilageOrder[]>(() => getStoredOrders());
  const [machineries, setMachineries] = useState<Machinery[]>(() => getCompanyFrotas());
  const [seasons, setSeasons] = useState<CropSeason[]>(() => getStoredSeasons());
  const [employees, setEmployees] = useState<Employee[]>(() => getCompanyFuncionarios());
  const [fleetTeams, setFleetTeams] = useState<FleetTeam[]>(() => getStoredFleetTeams());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => getCompanyFornecedores());
  const [inventory, setInventory] = useState<InventoryItem[]>(() => getCompanyEstoque());
  const [services, setServices] = useState<ServiceOrder[]>(() => getCompanyServicos());
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(() => getCompanyAbastecimentos());
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(() => getStoredMaintenanceLogs());
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => getStoredCompanyProfile());
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => getStoredBankAccounts());
  const [settlements, setSettlements] = useState<ThirdPartySettlement[]>(() => getStoredSettlements());
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(() => getCompanyRhFolhas());
  const [vacations, setVacations] = useState<VacationRecord[]>(() => getCompanyRhFerias());
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
          if (!valid.includes('almoxarifado')) {
            const estIndex = valid.indexOf('estoque');
            if (estIndex !== -1) {
              valid.splice(estIndex + 1, 0, 'almoxarifado');
            } else {
              valid.push('almoxarifado');
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
  const [draftMaintenanceLogFromAlmox, setDraftMaintenanceLogFromAlmox] = useState<MaintenanceLog | null>(null);

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
    return activeCompanyId || (companyProfile?.id ? String(companyProfile.id).trim() : 'default');
  }, [activeCompanyId, companyProfile?.id]);

  // Sincronização e Carga em Nuvem de Todos os Módulos do Assinante Logado (Supabase)
  const isInitialLoadDone = useRef(false);

  // Hash/Serialização defensiva para quebrar qualquer ciclo de re-render ou eco de sincronização
  const lastSyncedState = useRef<{
    services?: string;
    inventory?: string;
    orders?: string;
    companyProfile?: string;
    clients?: string;
    machineries?: string;
    expenses?: string;
    fuelLogs?: string;
    maintenanceLogs?: string;
    vacations?: string;
    rel_clients?: string;
    rel_suppliers?: string;
    rel_inventory?: string;
    rel_employees?: string;
    rel_machineries?: string;
    rel_expenses?: string;
    bankAccounts?: string;
  }>({});

  useEffect(() => {
    let isMounted = true;
    isInitialLoadDone.current = false;

    // Carga inicial mandatória dos 13 serviços oficiais no estoque (LocalStorage: 'colaca_silagem_estoque_produtos')
    ensureStockServicesInitialized();
    // Carga inicial mandatória das categorias de estoque e serviços de mão de obra (LocalStorage: 'colaca_silagem_categorias_estoque')
    ensureStockCategoriesInitialized();

    const loadCloudData = async () => {
      try {
        // 0. Carrega perfil fiscal e cadastral da nuvem
        const cloudCompany = await fetchCloudCompanyProfile(activeTenantId);
        if (cloudCompany && isMounted) {
          const serProfile = JSON.stringify(cloudCompany);
          lastSyncedState.current.companyProfile = serProfile;
          setCompanyProfile(prev => ({ ...prev, ...cloudCompany }));
        }

        // 1. Carrega dados relacionais com isolamento estrito por company_id
        const cloudData = await fetchAllDataFromSupabase(activeTenantId);
        if (cloudData && isMounted) {
          if (cloudData.clientes && cloudData.clientes.length > 0) {
            lastSyncedState.current.rel_clients = JSON.stringify(cloudData.clientes);
            setClients(cloudData.clientes);
          }
          if (cloudData.fornecedores && cloudData.fornecedores.length > 0) {
            lastSyncedState.current.rel_suppliers = JSON.stringify(cloudData.fornecedores);
            setSuppliers(cloudData.fornecedores);
          }
          if (cloudData.estoque && cloudData.estoque.length > 0) {
            const estoqueWithServices = ensureServicesInInventory(cloudData.estoque);
            lastSyncedState.current.rel_inventory = JSON.stringify(estoqueWithServices);
            setInventory(estoqueWithServices);
          }
          if (cloudData.rh_funcionarios !== undefined && Array.isArray(cloudData.rh_funcionarios) && cloudData.rh_funcionarios.length > 0) {
            const validTenantUuid = toValidUUID(activeTenantId);
            const tenantFilteredRh = cloudData.rh_funcionarios.filter(e => {
              if (!e || !e.name || e.name.trim() === '') return false;
              const st = String(e.status || '').toLowerCase();
              if (st === 'excluido' || st === 'inativo' || e.active === false) return false;
              if (e.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' || (e.name.trim().toUpperCase() === 'ALISSON PAG' && !e.cpf)) {
                return false;
              }
              const cid = String(e.companyId || (e as any).company_id || (e as any).tenant_id || '').trim();
              const uid = String(e.userId || (e as any).user_id || '').trim();
              if (cid && (cid === activeTenantId || (validTenantUuid && cid === validTenantUuid))) return true;
              if (uid && (uid === activeTenantId || (validTenantUuid && uid === validTenantUuid))) return true;
              if (currentUser?.id && (uid === currentUser.id || cid === currentUser.id)) return true;
              return !cid && !uid;
            });

            setEmployees(prev => {
              const currentStored = prev.length > 0 ? prev : getStoredEmployees();
              const mergedInitial = tenantFilteredRh.map(cloudEmp => {
                const localEmp = currentStored.find(l => toValidUUID(l.id) === cloudEmp.id || l.id === cloudEmp.id);
                if (!localEmp) return cloudEmp;
                const recComm = localEmp.receivesCommission !== undefined
                  ? Boolean(localEmp.receivesCommission)
                  : Boolean(cloudEmp.receivesCommission || (cloudEmp.commissionPerHour && cloudEmp.commissionPerHour > 0));
                const commH = recComm
                  ? ((localEmp.commissionPerHour !== undefined && localEmp.commissionPerHour > 0)
                      ? localEmp.commissionPerHour
                      : (cloudEmp.commissionPerHour || 0))
                  : 0;
                const commA = recComm
                  ? ((localEmp.commissionPerAlqueire !== undefined && localEmp.commissionPerAlqueire > 0)
                      ? localEmp.commissionPerAlqueire
                      : (cloudEmp.commissionPerAlqueire || 0))
                  : 0;
                const commHa = recComm
                  ? ((localEmp.commissionPerHectare !== undefined && localEmp.commissionPerHectare > 0)
                      ? localEmp.commissionPerHectare
                      : (cloudEmp.commissionPerHectare || 0))
                  : 0;
                return {
                  ...cloudEmp,
                  ...localEmp,
                  photoUrl: localEmp.photoUrl || cloudEmp.photoUrl || (cloudEmp as any).foto_url || (cloudEmp as any).avatar_url,
                  foto_url: localEmp.foto_url || cloudEmp.foto_url || localEmp.photoUrl || cloudEmp.photoUrl || (cloudEmp as any).avatar_url,
                  avatar_url: (localEmp as any).avatar_url || (cloudEmp as any).avatar_url || localEmp.foto_url || cloudEmp.foto_url || localEmp.photoUrl || cloudEmp.photoUrl,
                  commissionPerHour: commH,
                  commissionPerAlqueire: commA,
                  commissionPerHectare: commHa,
                  comissao_hora: commH,
                  comissao_alqueire: commA,
                  comissao_hectare: commHa,
                  recebe_comissao: recComm,
                  bankPixKey: cloudEmp.bankPixKey || localEmp.bankPixKey,
                  bankAgency: cloudEmp.bankAgency || localEmp.bankAgency,
                  bankAccount: cloudEmp.bankAccount || localEmp.bankAccount,
                  paymentLocation: cloudEmp.paymentLocation || localEmp.paymentLocation,
                  aso_url: cloudEmp.aso_url || localEmp.aso_url,
                  contrato_experiencia_url: cloudEmp.contrato_experiencia_url || localEmp.contrato_experiencia_url,
                  cnh_url: cloudEmp.cnh_url || localEmp.cnh_url,
                  ficha_registro_url: cloudEmp.ficha_registro_url || localEmp.ficha_registro_url,
                  admissionExamDoc: cloudEmp.admissionExamDoc || localEmp.admissionExamDoc,
                  experienceContractDoc: cloudEmp.experienceContractDoc || localEmp.experienceContractDoc,
                  generalDocs: cloudEmp.generalDocs || localEmp.generalDocs,
                  signedRegistrationDoc: cloudEmp.signedRegistrationDoc || localEmp.signedRegistrationDoc,
                };
              });

              const cloudIds = new Set(mergedInitial.map(e => e.id));
              const localOnly = currentStored.filter(e => !cloudIds.has(e.id) && !cloudIds.has(toValidUUID(e.id)));
              const finalEmployees = [...mergedInitial, ...localOnly].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
              lastSyncedState.current.rel_employees = JSON.stringify(finalEmployees);
              saveStoredEmployees(finalEmployees);
              return finalEmployees;
            });
          }
          if (cloudData.gestao_frotas && cloudData.gestao_frotas.length > 0) {
            lastSyncedState.current.rel_machineries = JSON.stringify(cloudData.gestao_frotas);
            setMachineries(cloudData.gestao_frotas);
          }
          if (cloudData.contas_a_pagar !== undefined && Array.isArray(cloudData.contas_a_pagar) && cloudData.contas_a_pagar.length > 0) {
            const mappedExpenses = cloudData.contas_a_pagar.map((d: any) => ({
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

            setExpenses(prev => {
              const map = new Map(prev.map(e => [e.id, e]));
              mappedExpenses.forEach(e => map.set(e.id, e));
              const merged = Array.from(map.values());
              lastSyncedState.current.rel_expenses = JSON.stringify(merged);
              return merged;
            });
          }
        }

        // 2. Carrega todos os módulos operacionais dedicados (Serviços, Vendas, Estoque, Configurações)
        const cloudModules = await fetchAllClientModulesFromSupabase(activeTenantId);
        if (cloudModules && isMounted) {
          if (cloudModules.companyProfile) {
            lastSyncedState.current.companyProfile = JSON.stringify(cloudModules.companyProfile);
            setCompanyProfile(cloudModules.companyProfile);
          }
          if (Array.isArray(cloudModules.services) && cloudModules.services.length > 0) {
            lastSyncedState.current.services = JSON.stringify(cloudModules.services);
            setServices(cloudModules.services);
          }
          if (Array.isArray(cloudModules.orders) && cloudModules.orders.length > 0) {
            lastSyncedState.current.orders = JSON.stringify(cloudModules.orders);
            setOrders(cloudModules.orders);
          }
          if ((!cloudData?.estoque || cloudData.estoque.length === 0) && Array.isArray(cloudModules.inventory) && cloudModules.inventory.length > 0) {
            lastSyncedState.current.inventory = JSON.stringify(cloudModules.inventory);
            setInventory(cloudModules.inventory);
          }
          if (Array.isArray(cloudModules.clients) && cloudModules.clients.length > 0) {
            lastSyncedState.current.clients = JSON.stringify(cloudModules.clients);
            setClients(cloudModules.clients);
          }
          if (Array.isArray(cloudModules.machineries) && cloudModules.machineries.length > 0) {
            setMachineries(prev => {
              const map = new Map(prev.map(m => [m.id, m]));
              cloudModules.machineries.forEach((m: Machinery) => {
                const existing = map.get(m.id);
                if (existing) {
                  map.set(m.id, {
                    ...m,
                    ...existing,
                    hourMeter: Math.max(existing.hourMeter || 0, m.hourMeter || 0),
                    currentKm: Math.max(existing.currentKm || 0, m.currentKm || 0),
                    totalMaintenanceExpenses: Math.max(existing.totalMaintenanceExpenses || 0, m.totalMaintenanceExpenses || 0),
                  });
                } else {
                  map.set(m.id, m);
                }
              });
              const merged = Array.from(map.values());
              lastSyncedState.current.machineries = JSON.stringify(merged);
              return merged;
            });
          }
          if (Array.isArray(cloudModules.expenses) && cloudModules.expenses.length > 0) {
            setExpenses(prev => {
              const map = new Map(prev.map(e => [e.id, e]));
              cloudModules.expenses!.forEach(e => map.set(e.id, e));
              const merged = Array.from(map.values());
              lastSyncedState.current.expenses = JSON.stringify(merged);
              return merged;
            });
          }
          if (Array.isArray(cloudModules.terminations) && cloudModules.terminations.length > 0) {
            saveStoredTerminations(cloudModules.terminations);
          }
          if (Array.isArray(cloudModules.maintenanceLogs) && cloudModules.maintenanceLogs.length > 0) {
            setMaintenanceLogs(prev => {
              const map = new Map(prev.map(m => [m.id, m]));
              cloudModules.maintenanceLogs!.forEach(m => map.set(m.id, m));
              const merged = Array.from(map.values());
              lastSyncedState.current.maintenanceLogs = JSON.stringify(merged);
              return merged;
            });
          }
          if (Array.isArray(cloudModules.vacations) && cloudModules.vacations.length > 0) {
            setVacations(prev => {
              const map = new Map(prev.map(v => [v.id, v]));
              cloudModules.vacations!.forEach(v => map.set(v.id, v));
              const merged = Array.from(map.values());
              lastSyncedState.current.vacations = JSON.stringify(merged);
              return merged;
            });
          }
        }

        // 3. Carrega Ordens de Serviço de Manutenção em nuvem (ex: OS de R$ 300,48 do veículo RHX3E15)
        const cloudMaint = await fetchCloudMaintenanceLogs(activeTenantId, currentUser?.id || currentUser?.uid);
        if (Array.isArray(cloudMaint) && isMounted) {
          setMaintenanceLogs(cloudMaint);
          lastSyncedState.current.maintenanceLogs = JSON.stringify(cloudMaint);
          saveStoredMaintenanceLogs(cloudMaint);
        }

        // 3.1 Carrega Contas Bancárias em nuvem (tabela 'financeiro_contas')
        const cloudAccs = await fetchCloudBankAccounts(activeTenantId, currentUser?.id || currentUser?.uid);
        if (Array.isArray(cloudAccs) && cloudAccs.length > 0 && isMounted) {
          const ser = JSON.stringify(cloudAccs);
          if (ser !== lastSyncedState.current.bankAccounts) {
            lastSyncedState.current.bankAccounts = ser;
            setBankAccounts(cloudAccs);
            saveStoredBankAccounts(cloudAccs);
          }
        }

        // 3.2 Carrega Fornecedores em nuvem (tabela 'fornecedores')
        const cloudSups = await fetchFornecedores(activeTenantId);
        if (Array.isArray(cloudSups) && cloudSups.length > 0 && isMounted) {
          setSuppliers(cloudSups);
          saveStoredSuppliers(cloudSups);
        }

        // 4. Carrega Férias da nuvem
        const cloudVacs = await fetchCloudVacations(activeTenantId);
        if (Array.isArray(cloudVacs) && cloudVacs.length > 0 && isMounted) {
          setVacations(prev => {
            const map = new Map(prev.map(v => [v.id, v]));
            cloudVacs.forEach(v => map.set(v.id, v));
            const merged = Array.from(map.values());
            lastSyncedState.current.vacations = JSON.stringify(merged);
            return merged;
          });
        }

        // 5. Carrega abastecimentos sincronizados em nuvem (tabela abastecimentos / site_settings)
        const cloudFuels = await fetchAbastecimentos(activeTenantId);
        if (cloudFuels !== null && Array.isArray(cloudFuels) && cloudFuels.length > 0 && isMounted) {
          setFuelLogs(prev => {
            const map = new Map(prev.map(f => [f.id, f]));
            cloudFuels.forEach(f => map.set(f.id, f));
            const merged = Array.from(map.values());
            lastSyncedState.current.fuelLogs = JSON.stringify(merged);
            saveStoredFuelLogs(merged);
            return merged;
          });
        }

        // 4. Carrega frentes de trabalho e alocações de equipe em nuvem (tabelas frentes_trabalho e frentes_trabalho_membros)
        try {
          const cloudFrentes = await fetchFrentesTrabalho(activeTenantId);
          if (cloudFrentes && cloudFrentes.length > 0 && isMounted) {
            const mappedTeams = cloudFrentes.map(f => ({
              id: String(f.id),
              name: f.nome,
              headerBg: f.cor || '#eab308',
              headerBgColor: f.cor || '#eab308',
              borderColor: '#ca8a04',
              columnBgColor: '#fefce8',
              companyId: f.company_id || undefined,
            }));
            setFleetTeams(mappedTeams);
            saveStoredFleetTeams(mappedTeams);
          }
          const membrosData = await fetchFrentesTrabalhoMembros();
          if (membrosData && isMounted) {
            const membrosMap = new Map<string, string>();
            membrosData.forEach(m => {
              if (m.funcionario_id && m.frente_id) {
                membrosMap.set(String(m.funcionario_id), String(m.frente_id));
              }
            });
            setEmployees(prev => prev.map(emp => {
              const assigned = membrosMap.get(emp.id) || (emp.id ? membrosMap.get(String(emp.id)) : undefined);
              return { ...emp, teamId: assigned || undefined };
            }));
          }
        } catch (_) {}

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

    // Sincronização forçada sob demanda via REST (desencadeada por ações manuais como 'Sincronizar Leituras')
    let lastForceSyncTime = 0;
    const handleForceRestSync = () => {
      const now = Date.now();
      if (now - lastForceSyncTime < 4000) return;
      lastForceSyncTime = now;
      loadCloudData();
    };
    window.addEventListener('silagem_force_rest_sync', handleForceRestSync);

    // Assinaturas em tempo real com checagem de integridade (elimina loops de eco)
    const unsubClientes = subscribeToCloudTable('clientes', () => {
      fetchClientes(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          const ser = JSON.stringify(fresh);
          if (ser !== lastSyncedState.current.rel_clients) {
            lastSyncedState.current.rel_clients = ser;
            setClients(fresh);
          }
        }
      });
    });

    const unsubFornecedores = subscribeToCloudTable('fornecedores', () => {
      fetchFornecedores(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          const ser = JSON.stringify(fresh);
          if (ser !== lastSyncedState.current.rel_suppliers) {
            lastSyncedState.current.rel_suppliers = ser;
            setSuppliers(fresh);
          }
        }
      });
    });

    const unsubEstoque = subscribeToCloudTable('estoque', () => {
      fetchEstoque(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          const ser = JSON.stringify(fresh);
          if (ser !== lastSyncedState.current.rel_inventory) {
            lastSyncedState.current.rel_inventory = ser;
            setInventory(fresh);
          }
        }
      });
    });

    const unsubEstoqueProdutos = subscribeToCloudTable('estoque_produtos', () => {
      fetchEstoque(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          const ser = JSON.stringify(fresh);
          if (ser !== lastSyncedState.current.rel_inventory) {
            lastSyncedState.current.rel_inventory = ser;
            lastSyncedState.current.inventory = ser;
            setInventory(fresh);
          }
        }
      });
    });

    const unsubTanquesCombustivel = subscribeToCloudTable('tanques_combustivel', () => {
      fetchEstoque(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          const ser = JSON.stringify(fresh);
          if (ser !== lastSyncedState.current.rel_inventory) {
            lastSyncedState.current.rel_inventory = ser;
            lastSyncedState.current.inventory = ser;
            setInventory(fresh);
          }
        }
      });
    });

    const handleInventoryChanged = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && isMounted) {
        const ser = JSON.stringify(e.detail);
        lastSyncedState.current.rel_inventory = ser;
        lastSyncedState.current.inventory = ser;
        setInventory(e.detail);
      } else {
        fetchEstoque(activeTenantId).then(fresh => {
          if (fresh && isMounted) {
            const ser = JSON.stringify(fresh);
            lastSyncedState.current.rel_inventory = ser;
            lastSyncedState.current.inventory = ser;
            setInventory(fresh);
          }
        });
      }
    };
    window.addEventListener('silagem_inventory_changed', handleInventoryChanged);

    const handleTanksChanged = () => {
      fetchEstoque(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          const ser = JSON.stringify(fresh);
          lastSyncedState.current.rel_inventory = ser;
          lastSyncedState.current.inventory = ser;
          setInventory(fresh);
        }
      });
    };
    window.addEventListener('silagem_tanks_changed', handleTanksChanged);

    const unsubRH = subscribeToCloudTable('rh_funcionarios', (payload: any) => {
      // 1. Atualização ultra-rápida de foto e dados a partir do payload Realtime (.on)
      if ((payload?.eventType === 'INSERT' || payload?.eventType === 'UPDATE') && payload.new) {
        const row = payload.new;
        const currentAuthUid = currentUser?.id;
        const rowUid = String(row.user_id || '').trim();

        // Blindagem estrita de isolamento de assinante: ignora qualquer evento de outro usuário
        if (currentAuthUid && rowUid && rowUid !== currentAuthUid) {
          return;
        }

        const rowCid = String(row.company_id || row.tenant_id || row.user_id || '').trim();
        const validTenantUuid = toValidUUID(activeTenantId);
        const isThisTenant = (currentAuthUid && rowUid === currentAuthUid) || (rowCid && (rowCid === activeTenantId || (validTenantUuid && rowCid === validTenantUuid)));

        if (isThisTenant) {
          const livePhoto = row.foto_url || row.avatar_url || row.photo_url || row.photoUrl;
          const targetId = row.id;
          const mapped = mapRowToEmployee(row);
          if (livePhoto) {
            mapped.photoUrl = String(livePhoto).trim();
            mapped.foto_url = String(livePhoto).trim();
            (mapped as any).avatar_url = String(livePhoto).trim();
          }

          setEmployees(prev => {
            const exists = prev.some(e => e.id === targetId || toValidUUID(e.id) === targetId || toValidUUID(e.id) === toValidUUID(targetId));
            const updated = exists
              ? prev.map(e => (e.id === targetId || toValidUUID(e.id) === targetId || toValidUUID(e.id) === toValidUUID(targetId)) ? { ...e, ...mapped } : e)
              : [...prev, mapped].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
            saveStoredEmployees(updated);
            return updated;
          });
        }
      }

      const currentAuthUid = currentUser?.id;
      fetchRhFuncionarios(activeTenantId, currentAuthUid).then(fresh => {
        if (fresh && isMounted && fresh.length > 0) {
          const validTenantUuid = toValidUUID(activeTenantId);
          const strictlyFilteredFresh = fresh.filter(e => {
            const cid = String(e.companyId || (e as any).company_id || (e as any).tenant_id || '').trim();
            const uid = String(e.userId || (e as any).user_id || '').trim();
            if (cid && (cid === activeTenantId || (validTenantUuid && cid === validTenantUuid))) return true;
            if (uid && (uid === activeTenantId || (validTenantUuid && uid === validTenantUuid))) return true;
            if (currentAuthUid && (uid === currentAuthUid || cid === currentAuthUid)) return true;
            return !cid && !uid;
          });
          const currentStored = getStoredEmployees();
          const merged = strictlyFilteredFresh.map(cloudEmp => {
            const localEmp = currentStored.find(l => toValidUUID(l.id) === cloudEmp.id || l.id === cloudEmp.id);
            if (!localEmp) return cloudEmp;
            const recComm = localEmp.receivesCommission !== undefined
              ? Boolean(localEmp.receivesCommission)
              : Boolean(cloudEmp.receivesCommission || (cloudEmp.commissionPerHour && cloudEmp.commissionPerHour > 0));
            const commH = recComm
              ? ((localEmp.commissionPerHour !== undefined && localEmp.commissionPerHour > 0)
                  ? localEmp.commissionPerHour
                  : (cloudEmp.commissionPerHour || 0))
              : 0;
            const commA = recComm
              ? ((localEmp.commissionPerAlqueire !== undefined && localEmp.commissionPerAlqueire > 0)
                  ? localEmp.commissionPerAlqueire
                  : (cloudEmp.commissionPerAlqueire || 0))
              : 0;
            const commHa = recComm
              ? ((localEmp.commissionPerHectare !== undefined && localEmp.commissionPerHectare > 0)
                  ? localEmp.commissionPerHectare
                  : (cloudEmp.commissionPerHectare || 0))
              : 0;

            const livePhoto = cloudEmp.photoUrl || (cloudEmp as any).foto_url || (cloudEmp as any).avatar_url;

            return {
              ...localEmp,
              ...cloudEmp,
              photoUrl: livePhoto || (!localEmp.photoUrl?.startsWith('blob:') ? localEmp.photoUrl : undefined),
              foto_url: livePhoto || (!localEmp.foto_url?.startsWith('blob:') ? localEmp.foto_url : undefined),
              avatar_url: livePhoto || (!localEmp.avatar_url?.startsWith('blob:') ? (localEmp as any).avatar_url : undefined),
              commissionPerHour: commH,
              commissionPerAlqueire: commA,
              commissionPerHectare: commHa,
              comissao_hora: commH,
              comissao_alqueire: commA,
              comissao_hectare: commHa,
              recebe_comissao: recComm,
              bankPixKey: cloudEmp.bankPixKey || localEmp.bankPixKey,
              bankAgency: cloudEmp.bankAgency || localEmp.bankAgency,
              bankAccount: cloudEmp.bankAccount || localEmp.bankAccount,
              paymentLocation: cloudEmp.paymentLocation || localEmp.paymentLocation,
              aso_url: cloudEmp.aso_url || localEmp.aso_url,
              contrato_experiencia_url: cloudEmp.contrato_experiencia_url || localEmp.contrato_experiencia_url,
              cnh_url: cloudEmp.cnh_url || localEmp.cnh_url,
              ficha_registro_url: cloudEmp.ficha_registro_url || localEmp.ficha_registro_url,
              admissionExamDoc: cloudEmp.admissionExamDoc || localEmp.admissionExamDoc,
              experienceContractDoc: cloudEmp.experienceContractDoc || localEmp.experienceContractDoc,
              generalDocs: cloudEmp.generalDocs || localEmp.generalDocs,
              signedRegistrationDoc: cloudEmp.signedRegistrationDoc || localEmp.signedRegistrationDoc,
            };
          });
          const ser = JSON.stringify(merged);
          if (ser !== lastSyncedState.current.rel_employees) {
            lastSyncedState.current.rel_employees = ser;
            setEmployees(merged);
            saveStoredEmployees(merged);
          }
        }
      });
    });

    const unsubFuncionarios = subscribeToCloudTable('funcionarios', () => {
      const authUid = currentUser?.id;
      fetchRhFuncionarios(activeTenantId, authUid).then(fresh => {
        if (fresh && isMounted) {
          const validTenantUuid = toValidUUID(activeTenantId);
          const strictlyFilteredFresh = fresh.filter(e => {
            const cid = String(e.companyId || (e as any).company_id || (e as any).tenant_id || (e as any).user_id || '').trim();
            if (!cid) return false;
            return cid === activeTenantId || (validTenantUuid && cid === validTenantUuid);
          });
          const currentStored = getStoredEmployees().filter(e => {
            const cid = String(e.companyId || (e as any).company_id || (e as any).tenant_id || (e as any).user_id || '').trim();
            if (!cid) return false;
            return cid === activeTenantId || (validTenantUuid && cid === validTenantUuid);
          });
          const merged = strictlyFilteredFresh.map(cloudEmp => {
            const localEmp = currentStored.find(l => toValidUUID(l.id) === cloudEmp.id || l.id === cloudEmp.id);
            if (!localEmp) return cloudEmp;
            const commH = (cloudEmp.commissionPerHour && cloudEmp.commissionPerHour > 0) ? cloudEmp.commissionPerHour : (localEmp.commissionPerHour || 0);
            const commA = (cloudEmp.commissionPerAlqueire && cloudEmp.commissionPerAlqueire > 0) ? cloudEmp.commissionPerAlqueire : (localEmp.commissionPerAlqueire || 0);
            const commHa = (cloudEmp.commissionPerHectare && cloudEmp.commissionPerHectare > 0) ? cloudEmp.commissionPerHectare : (localEmp.commissionPerHectare || 0);
            const recComm = cloudEmp.receivesCommission || localEmp.receivesCommission || Boolean(commH > 0 || commA > 0 || commHa > 0);
            const livePhoto = cloudEmp.photoUrl || (cloudEmp as any).foto_url || (cloudEmp as any).avatar_url;
            return {
              ...localEmp,
              ...cloudEmp,
              photoUrl: livePhoto || (!localEmp.photoUrl?.startsWith('blob:') ? localEmp.photoUrl : undefined),
              foto_url: livePhoto || (!localEmp.foto_url?.startsWith('blob:') ? localEmp.foto_url : undefined),
              avatar_url: livePhoto || (!localEmp.avatar_url?.startsWith('blob:') ? (localEmp as any).avatar_url : undefined),
              commissionPerHour: recComm ? commH : 0,
              commissionPerAlqueire: recComm ? commA : 0,
              commissionPerHectare: recComm ? commHa : 0,
              comissao_hora: recComm ? commH : 0,
              comissao_alqueire: recComm ? commA : 0,
              comissao_hectare: recComm ? commHa : 0,
              recebe_comissao: recComm,
              bankPixKey: cloudEmp.bankPixKey || localEmp.bankPixKey,
              bankAgency: cloudEmp.bankAgency || localEmp.bankAgency,
              bankAccount: cloudEmp.bankAccount || localEmp.bankAccount,
              paymentLocation: cloudEmp.paymentLocation || localEmp.paymentLocation,
              aso_url: cloudEmp.aso_url || localEmp.aso_url,
              contrato_experiencia_url: cloudEmp.contrato_experiencia_url || localEmp.contrato_experiencia_url,
              cnh_url: cloudEmp.cnh_url || localEmp.cnh_url,
              ficha_registro_url: cloudEmp.ficha_registro_url || localEmp.ficha_registro_url,
              admissionExamDoc: cloudEmp.admissionExamDoc || localEmp.admissionExamDoc,
              experienceContractDoc: cloudEmp.experienceContractDoc || localEmp.experienceContractDoc,
              generalDocs: cloudEmp.generalDocs || localEmp.generalDocs,
              signedRegistrationDoc: cloudEmp.signedRegistrationDoc || localEmp.signedRegistrationDoc,
            };
          });
          const ser = JSON.stringify(merged);
          if (ser !== lastSyncedState.current.rel_employees) {
            lastSyncedState.current.rel_employees = ser;
            setEmployees(merged);
            saveStoredEmployees(merged);
          }
        }
      });
    });

    const handleFrotasUpdate = () => {
      fetchGestaoFrotas(activeTenantId).then(fresh => {
        if (fresh && isMounted && Array.isArray(fresh) && fresh.length > 0) {
          setMachineries(prev => {
            const merged = fresh.map(f => {
              const existing = prev.find(p => p.id === f.id || toValidUUID(p.id) === toValidUUID(f.id));
              if (existing) {
                const assignedDrivers = (f.assignedDrivers && f.assignedDrivers.length > 0)
                  ? f.assignedDrivers
                  : (existing.assignedDrivers || []);
                const assignedDriverIds = (f.assignedDriverIds && f.assignedDriverIds.length > 0)
                  ? f.assignedDriverIds
                  : (existing.assignedDriverIds || []);
                const operatorOrDriver = f.operatorOrDriver || existing.operatorOrDriver || (assignedDrivers.length > 0 ? assignedDrivers.join(', ') : '');
                return {
                  ...existing,
                  ...f,
                  hasCoupledTrailer: f.hasCoupledTrailer,
                  coupledTrailerId: f.coupledTrailerId,
                  reboque_vinculado_id: f.reboque_vinculado_id,
                  reboque_id: f.reboque_id,
                  coupledTrailerName: f.coupledTrailerName,
                  coupledTrailerType: f.coupledTrailerType,
                  trailerPlate: f.trailerPlate,
                  trailerModel: f.trailerModel,
                  compositionType: f.compositionType,
                  assignedDrivers,
                  assignedDriverIds,
                  operatorOrDriver
                };
              }
              return f;
            });
            const ser = JSON.stringify(merged);
            if (ser !== lastSyncedState.current.rel_machineries) {
              lastSyncedState.current.rel_machineries = ser;
              saveStoredMachineries(merged);
            }
            return merged;
          });
        }
      });
    };

    const unsubFrotasVM = subscribeToCloudTable('veiculos_maquinas', handleFrotasUpdate);
    const unsubFrotas = subscribeToCloudTable('gestao_frotas', handleFrotasUpdate);
    const unsubManut = subscribeToCloudTable('manutencoes', () => {
      fetchCloudMaintenanceLogs(activeTenantId, currentUser?.id || currentUser?.uid).then(fresh => {
        if (fresh && isMounted) {
          setMaintenanceLogs(fresh);
          saveStoredMaintenanceLogs(fresh);
        }
      });
    });

    const unsubContas = subscribeToCloudTable('contas_a_pagar', () => {
      fetchContasAPagar(activeTenantId).then(fresh => {
        if (fresh && isMounted && fresh.length > 0) {
          const ser = JSON.stringify(fresh);
          if (ser !== lastSyncedState.current.rel_expenses) {
            lastSyncedState.current.rel_expenses = ser;
            const mapped = fresh.map((d: any) => ({
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
            setExpenses(prev => {
              const map = new Map(prev.map(e => [e.id, e]));
              mapped.forEach(e => {
                const existing = map.get(e.id);
                map.set(
                  e.id,
                  existing
                    ? {
                        ...e,
                        ...existing,
                        amount: e.amount,
                        dueDate: e.dueDate,
                        status: e.status,
                      }
                    : e
                );
              });
              const merged = Array.from(map.values());
              return merged;
            });
          }
        }
      });
    });

    const handleLocalExpensesUpdated = (ev: any) => {
      const updated = ev?.detail;
      if (Array.isArray(updated)) {
        setExpenses(prev => {
          if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
          return updated;
        });
      }
    };
    window.addEventListener('silagem_expenses_updated', handleLocalExpensesUpdated);

    const unsubSettings = subscribeToCloudTable('site_settings', () => {
      fetchAllClientModulesFromSupabase(activeTenantId).then(fresh => {
        if (fresh && isMounted) {
          if (fresh.companyProfile) {
            const ser = JSON.stringify(fresh.companyProfile);
            if (ser !== lastSyncedState.current.companyProfile) {
              lastSyncedState.current.companyProfile = ser;
              setCompanyProfile(fresh.companyProfile);
            }
          }
          if (Array.isArray(fresh.services) && fresh.services.length > 0) {
            const ser = JSON.stringify(fresh.services);
            if (ser !== lastSyncedState.current.services) {
              lastSyncedState.current.services = ser;
              setServices(fresh.services);
            }
          }
          if (Array.isArray(fresh.orders) && fresh.orders.length > 0) {
            const ser = JSON.stringify(fresh.orders);
            if (ser !== lastSyncedState.current.orders) {
              lastSyncedState.current.orders = ser;
              setOrders(fresh.orders);
            }
          }
          if (!lastSyncedState.current.rel_inventory && Array.isArray(fresh.inventory) && fresh.inventory.length > 0) {
            const ser = JSON.stringify(fresh.inventory);
            if (ser !== lastSyncedState.current.inventory) {
              lastSyncedState.current.inventory = ser;
              setInventory(fresh.inventory);
            }
          }
          if (Array.isArray(fresh.clients) && fresh.clients.length > 0) {
            const ser = JSON.stringify(fresh.clients);
            if (ser !== lastSyncedState.current.clients) {
              lastSyncedState.current.clients = ser;
              setClients(fresh.clients);
            }
          }
          if (Array.isArray(fresh.machineries) && fresh.machineries.length > 0) {
            const ser = JSON.stringify(fresh.machineries);
            if (ser !== lastSyncedState.current.machineries) {
              lastSyncedState.current.machineries = ser;
              setMachineries(fresh.machineries);
            }
          }
          if (Array.isArray(fresh.expenses) && fresh.expenses.length > 0) {
            const ser = JSON.stringify(fresh.expenses);
            if (ser !== lastSyncedState.current.expenses) {
              lastSyncedState.current.expenses = ser;
              setExpenses(prev => {
                const map = new Map(prev.map(e => [e.id, e]));
                fresh.expenses!.forEach(e => map.set(e.id, e));
                const merged = Array.from(map.values());
                return merged;
              });
            }
          }
          if (Array.isArray(fresh.maintenanceLogs) && fresh.maintenanceLogs.length > 0) {
            const ser = JSON.stringify(fresh.maintenanceLogs);
            if (ser !== lastSyncedState.current.maintenanceLogs) {
              lastSyncedState.current.maintenanceLogs = ser;
              setMaintenanceLogs(prev => {
                const map = new Map(prev.map(m => [m.id, m]));
                fresh.maintenanceLogs!.forEach(m => map.set(m.id, m));
                const merged = Array.from(map.values());
                return merged;
              });
            }
          }
          if (Array.isArray(fresh.vacations) && fresh.vacations.length > 0) {
            const ser = JSON.stringify(fresh.vacations);
            if (ser !== lastSyncedState.current.vacations) {
              lastSyncedState.current.vacations = ser;
              setVacations(prev => {
                const map = new Map(prev.map(v => [v.id, v]));
                fresh.vacations!.forEach(v => map.set(v.id, v));
                const merged = Array.from(map.values());
                return merged;
              });
            }
          }
        }
      });
    });

    const unsubFrentes = subscribeToCloudTable('frentes_trabalho', () => {
      Promise.all([
        fetchFrentesTrabalho(activeTenantId),
        fetchFrentesTrabalhoMembros()
      ]).then(([cloudFrentes, membrosData]) => {
        if (cloudFrentes && isMounted) {
          const mappedTeams = cloudFrentes.map(f => ({
            id: String(f.id),
            name: f.nome,
            headerBg: f.cor || '#eab308',
            headerBgColor: f.cor || '#eab308',
            borderColor: '#ca8a04',
            columnBgColor: '#fefce8',
            companyId: f.company_id || undefined,
          }));
          setFleetTeams(mappedTeams);
          saveStoredFleetTeams(mappedTeams);
        }
        if (membrosData && isMounted) {
          const membrosMap = new Map<string, string>();
          membrosData.forEach(m => {
            if (m.funcionario_id && m.frente_id) {
              membrosMap.set(String(m.funcionario_id), String(m.frente_id));
            }
          });
          setEmployees(prev => prev.map(emp => {
            const assigned = membrosMap.get(emp.id) || (emp.id ? membrosMap.get(String(emp.id)) : undefined);
            return { ...emp, teamId: assigned || undefined };
          }));
        }
      }).catch(() => {});
    });

    const unsubMembros = subscribeToCloudTable('frentes_trabalho_membros', () => {
      fetchFrentesTrabalhoMembros().then(membrosData => {
        if (membrosData && isMounted) {
          const membrosMap = new Map<string, string>();
          membrosData.forEach(m => {
            if (m.funcionario_id && m.frente_id) {
              membrosMap.set(String(m.funcionario_id), String(m.frente_id));
            }
          });
          setEmployees(prev => prev.map(emp => {
            const assigned = membrosMap.get(emp.id) || (emp.id ? membrosMap.get(String(emp.id)) : undefined);
            return { ...emp, teamId: assigned || undefined };
          }));
        }
      }).catch(() => {});
    });

    const unsubDocsEntrada = subscribeToCloudTable('documentos_entrada', () => {
      notifyDocumentosEntradaSync();
    });

    const unsubNotasFiscais = subscribeToCloudTable('notas_fiscais', () => {
      notifyDocumentosEntradaSync();
    });

    // 1. ATIVAÇÃO DO ESCUTADOR DE EVENTOS REALTIME (Postgres Changes):
    // Escuta as alterações no banco de dados na tabela 'abastecimentos' e em 'site_settings'
    const fuelTable = getAbastecimentosTableName() || 'abastecimentos';
    const canalAbastecimentos = supabase
      .channel('mudancas-abastecimentos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: fuelTable },
        (_payload) => {
          fetchAbastecimentos(activeTenantId).then(fresh => {
            if (fresh && isMounted) {
              const ser = JSON.stringify(fresh);
              if (ser !== lastSyncedState.current.fuelLogs) {
                lastSyncedState.current.fuelLogs = ser;
                setFuelLogs(fresh);
                saveStoredFuelLogs(fresh);
              }
            }
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        (_payload) => {
          fetchAbastecimentos(activeTenantId).then(fresh => {
            if (fresh && isMounted) {
              const ser = JSON.stringify(fresh);
              if (ser !== lastSyncedState.current.fuelLogs) {
                lastSyncedState.current.fuelLogs = ser;
                setFuelLogs(fresh);
                saveStoredFuelLogs(fresh);
              }
            }
          });
        }
      );

    canalAbastecimentos.subscribe();

    // 2. Realtime para Contas Bancárias (tabela 'financeiro_contas')
    const canalContasBancarias = supabase
      .channel('app_financeiro_contas_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financeiro_contas' },
        (_payload) => {
          fetchCloudBankAccounts(activeTenantId, currentUser?.id || currentUser?.uid).then(fresh => {
            if (isMounted) {
              const safeAccs = Array.isArray(fresh) ? fresh : [];
              const ser = JSON.stringify(safeAccs);
              if (ser !== lastSyncedState.current.bankAccounts) {
                lastSyncedState.current.bankAccounts = ser;
                setBankAccounts(safeAccs);
                if (safeAccs.length > 0) saveStoredBankAccounts(safeAccs);
              }
            }
          });
        }
      );
    canalContasBancarias.subscribe();

    // 3. Realtime para Fornecedores (tabela 'fornecedores')
    const canalFornecedores = supabase
      .channel('app_fornecedores_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fornecedores' },
        (_payload) => {
          fetchFornecedores(activeTenantId).then(fresh => {
            if (isMounted) {
              const safeSups = Array.isArray(fresh) ? fresh : [];
              const ser = JSON.stringify(safeSups);
              if (ser !== lastSyncedState.current.rel_suppliers) {
                lastSyncedState.current.rel_suppliers = ser;
                setSuppliers(safeSups);
                if (safeSups.length > 0) saveStoredSuppliers(safeSups);
              }
            }
          });
        }
      );
    canalFornecedores.subscribe();

    // 4. Realtime para Manutenções de Frotas (tabela física oficial 'manutencoes')
    const canalManutencoes = supabase
      .channel('app_manutencoes_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'manutencoes' },
        (_payload) => {
          fetchCloudMaintenanceLogs(activeTenantId, currentUser?.id || currentUser?.uid).then(fresh => {
            if (isMounted) {
              const safeLogs = Array.isArray(fresh) ? fresh : [];
              setMaintenanceLogs(safeLogs);
              if (safeLogs.length > 0) saveStoredMaintenanceLogs(safeLogs);
            }
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'frotas_manutencoes' },
        (_payload) => {
          fetchCloudMaintenanceLogs(activeTenantId, currentUser?.id || currentUser?.uid).then(fresh => {
            if (isMounted) {
              const safeLogs = Array.isArray(fresh) ? fresh : [];
              setMaintenanceLogs(safeLogs);
              if (safeLogs.length > 0) saveStoredMaintenanceLogs(safeLogs);
            }
          });
        }
      );
    canalManutencoes.subscribe();

    // 4.1 Realtime para Veículos e Máquinas (tabela física oficial 'veiculos_maquinas')
    const canalVeiculosMaquinas = supabase
      .channel('app_veiculos_maquinas_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'veiculos_maquinas' },
        (_payload) => {
          fetchGestaoFrotas(activeTenantId).then(fresh => {
            if (fresh && Array.isArray(fresh) && fresh.length > 0 && isMounted) {
              setMachineries(fresh);
              saveStoredMachineries(fresh);
            }
          });
        }
      );
    canalVeiculosMaquinas.subscribe();

    // 5. RECUPERAÇÃO INSTANTÂNEA AO RETORNAR PARA A ABA (Visibility / Focus) - sem polling contínuo para evitar consumo excessivo de Egress
    const handleFocusSync = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        fetchAbastecimentos(activeTenantId).then(fresh => {
          if (fresh && fresh.length > 0 && isMounted) {
            const ser = JSON.stringify(fresh);
            if (ser !== lastSyncedState.current.fuelLogs) {
              lastSyncedState.current.fuelLogs = ser;
              setFuelLogs(fresh);
              saveStoredFuelLogs(fresh);
            }
          }
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleFocusSync);
    window.addEventListener('focus', handleFocusSync);

    return () => { 
      isMounted = false; 
      window.removeEventListener('silagem_force_rest_sync', handleForceRestSync);
      window.removeEventListener('silagem_inventory_changed', handleInventoryChanged);
      window.removeEventListener('silagem_tanks_changed', handleTanksChanged);
      unsubClientes();
      unsubFornecedores();
      unsubEstoque();
      unsubEstoqueProdutos();
      unsubTanquesCombustivel();
      unsubRH();
      unsubFuncionarios();
      unsubFrotasVM();
      unsubFrotas();
      unsubManut();
      unsubContas();
      unsubSettings();
      unsubFrentes();
      unsubMembros();
      unsubDocsEntrada();
      unsubNotasFiscais();
      supabase.removeChannel(canalAbastecimentos);
      supabase.removeChannel(canalContasBancarias);
      supabase.removeChannel(canalFornecedores);
      supabase.removeChannel(canalManutencoes);
      supabase.removeChannel(canalVeiculosMaquinas);
      document.removeEventListener('visibilitychange', handleFocusSync);
      window.removeEventListener('focus', handleFocusSync);
    };
  }, [activeTenantId, currentUser?.uid]);

  const handleSaveBankAccounts = (newAccounts: BankAccount[]) => {
    const ser = JSON.stringify(newAccounts);
    if (ser !== lastSyncedState.current.bankAccounts) {
      lastSyncedState.current.bankAccounts = ser;
      setBankAccounts(newAccounts);
      saveStoredBankAccounts(newAccounts);
      saveCloudBankAccounts(newAccounts, activeTenantId, currentUser?.id || currentUser?.uid).catch(err =>
        console.warn('Supabase saveCloudBankAccounts notice:', err)
      );
    }
  };

  const handleSaveMaintenanceLogs = (newLogs: MaintenanceLog[]) => {
    setMaintenanceLogs(newLogs);
    saveStoredMaintenanceLogs(newLogs);
    saveCloudMaintenanceLogs(newLogs, activeTenantId, currentUser?.id || currentUser?.uid).catch(err =>
      console.warn('Supabase saveCloudMaintenanceLogs notice:', err)
    );
  };

  const handleSaveSettlements = (newSettlements: ThirdPartySettlement[]) => {
    setSettlements(newSettlements);
    saveStoredSettlements(newSettlements);
  };

  const handleSavePayrolls = (newPayrolls: PayrollRecord[]) => {
    setPayrolls(newPayrolls);
    saveStoredPayrolls(newPayrolls);
    saveCompanyRhFolhas(newPayrolls, activeTenantId);
  };

  const handleSaveVacations = (newVacations: VacationRecord[]) => {
    setVacations(newVacations);
    saveStoredVacations(newVacations);
    saveCompanyRhFerias(newVacations, activeTenantId);
  };

  const handleSaveLeaves = (newLeaves: LeaveRecord[]) => {
    setLeaves(newLeaves);
    saveStoredLeaves(newLeaves);
  };

  const handleSaveAdvances = (newAdvances: SalaryAdvance[]) => {
    setAdvances(newAdvances);
    saveStoredSalaryAdvances(newAdvances);
  };

  // Active Navigation Tab (Defaults to 'dashboard' matching the requested view or URL query parameter/path)
  const getResolvedActiveTab = (): string => {
    if (typeof window === 'undefined') return 'dashboard';
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab') || params.get('modulo');
      if (urlTab === 'formularios' || urlTab === 'agenda' || urlTab === 'servicos') {
        return 'servicos';
      }
      if (urlTab) {
        return urlTab;
      }
      const rawPath = (window.location.pathname || '').replace(/^\//, '').toLowerCase().trim();
      const pathSegment = rawPath.split('/')[0];
      if (['frotas', 'frota', 'veiculos', 'manutencoes', 'combustivel', 'motoristas', 'equipe', 'rodizio', 'rodizio_pneus'].includes(pathSegment)) {
        return pathSegment === 'frota' ? 'frotas' : pathSegment;
      }
      if (['financeiro', 'contas', 'pagar', 'receber', 'bancos', 'fiscal', 'nfe'].includes(pathSegment)) {
        return pathSegment;
      }
      if (['rh', 'funcionarios', 'folha', 'ferias', 'colaboradores'].includes(pathSegment)) {
        return pathSegment === 'colaboradores' ? 'funcionarios' : pathSegment;
      }
      if (['almoxarifado', 'estoque'].includes(pathSegment)) {
        return pathSegment;
      }
      if (['clientes', 'crm', 'fornecedores', 'servicos', 'relatorios', 'configuracoes'].includes(pathSegment)) {
        return pathSegment;
      }
    } catch (e) {
      console.error(e);
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<string>(getResolvedActiveTab);

  // Sessão Ativa / Simulação de Cargo para Controle de Nível de Acesso (Modo Offline)
  const [activeSession, setActiveSession] = useState<SimulatedUserSession>(() => getActiveUserSession());
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Controle de Janela Desktop (Maximizar tela cheia e Minimizar painel)
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [isWindowMinimized, setIsWindowMinimized] = useState(false);

  useEffect(() => {
    const handleSessionSync = (e: any) => {
      if (e?.detail) {
        setActiveSession(e.detail);
      } else {
        setActiveSession(getActiveUserSession());
      }
    };
    window.addEventListener('colaca_silagem_session_updated', handleSessionSync);
    window.addEventListener('storage', handleSessionSync);

    const handleAppNavigate = (e: any) => {
      const target = typeof e?.detail === 'string' ? e.detail : e?.detail?.tab;
      if (target && typeof target === 'string') {
        setActiveTab(target);
      }
    };
    window.addEventListener('app:navigate', handleAppNavigate);
    window.addEventListener('navigate-tab', handleAppNavigate);

    return () => {
      window.removeEventListener('colaca_silagem_session_updated', handleSessionSync);
      window.removeEventListener('storage', handleSessionSync);
      window.removeEventListener('app:navigate', handleAppNavigate);
      window.removeEventListener('navigate-tab', handleAppNavigate);
    };
  }, []);

  const getRequiredModulePermission = (tab: string): ModulePermissionKey | null => {
    if (tab === 'financeiro' || tab === 'despesas' || tab === 'contas' || tab === 'bancos' || tab === 'pagar' || tab === 'receber') return 'financeiro';
    if (tab === 'frotas' || tab === 'frota' || tab === 'veiculos' || tab === 'manutencoes' || tab === 'combustivel' || tab === 'motoristas' || tab === 'equipe' || tab === 'rodizio' || tab === 'rodizio_pneus') return 'frotas';
    if (tab === 'rh' || tab === 'funcionarios' || tab === 'folha' || tab === 'colaboradores') return 'rh';
    if (tab === 'estoque' || tab === 'almoxarifado' || tab === 'fiscal' || tab === 'documentos_entrada' || tab === 'entradas' || tab === 'nfe_importar' || tab === 'nfe_notas') return 'estoque';
    if (tab === 'configuracoes') return 'empresa';
    return null;
  };

  const currentRestrictedPerm = getRequiredModulePermission(activeTab);
  const isCurrentTabDenied = activeSession.type !== 'admin' && currentRestrictedPerm !== null && activeSession.permissions && activeSession.permissions[currentRestrictedPerm] === false;

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
  // Protegido por hash defensivo para evitar loops de salvamento e consumo desnecessário de API

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(services);
    if (currentSerialized === lastSyncedState.current.services) return;

    const t = setTimeout(() => {
      lastSyncedState.current.services = currentSerialized;
      saveCloudServices(services, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [services, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(inventory);
    if (currentSerialized === lastSyncedState.current.inventory) return;

    const t = setTimeout(() => {
      lastSyncedState.current.inventory = currentSerialized;
      saveCloudInventory(inventory, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [inventory, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(orders);
    if (currentSerialized === lastSyncedState.current.orders) return;

    const t = setTimeout(() => {
      lastSyncedState.current.orders = currentSerialized;
      saveCloudOrders(orders, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [orders, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(companyProfile);
    if (currentSerialized === lastSyncedState.current.companyProfile) return;

    const t = setTimeout(() => {
      lastSyncedState.current.companyProfile = currentSerialized;
      saveCloudCompanyProfile(companyProfile, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [companyProfile, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(clients);
    if (currentSerialized === lastSyncedState.current.clients) return;

    const t = setTimeout(() => {
      lastSyncedState.current.clients = currentSerialized;
      saveCloudClients(clients, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [clients, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(machineries);
    if (currentSerialized === lastSyncedState.current.machineries) return;

    const t = setTimeout(() => {
      lastSyncedState.current.machineries = currentSerialized;
      saveCloudMachineries(machineries, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [machineries, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(expenses);
    if (currentSerialized === lastSyncedState.current.expenses) return;

    const t = setTimeout(() => {
      lastSyncedState.current.expenses = currentSerialized;
      saveCloudExpenses(expenses, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [expenses, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(fuelLogs);
    if (currentSerialized === lastSyncedState.current.fuelLogs) return;

    const t = setTimeout(() => {
      lastSyncedState.current.fuelLogs = currentSerialized;
      saveCloudFuelLogs(fuelLogs, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [fuelLogs, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId) return;
    const currentSerialized = JSON.stringify(maintenanceLogs);
    if (currentSerialized === lastSyncedState.current.maintenanceLogs) return;

    const t = setTimeout(() => {
      lastSyncedState.current.maintenanceLogs = currentSerialized;
      saveCloudMaintenanceLogs(maintenanceLogs, activeTenantId, currentUser?.uid || currentUser?.id);
    }, 1200);
    return () => clearTimeout(t);
  }, [maintenanceLogs, activeTenantId]);

  useEffect(() => {
    if (!isInitialLoadDone.current || !activeTenantId || vacations.length === 0) return;
    const currentSerialized = JSON.stringify(vacations);
    if (currentSerialized === lastSyncedState.current.vacations) return;

    const t = setTimeout(() => {
      lastSyncedState.current.vacations = currentSerialized;
      saveCloudVacations(vacations, activeTenantId);
    }, 1200);
    return () => clearTimeout(t);
  }, [vacations, activeTenantId]);

  // Keep third-party settlements state fresh across component interactions
  useEffect(() => {
    const handleSettlementsUpdate = (e: any) => {
      if (e?.type === 'storage' && e?.key && e.key !== 'silagem_facil_settlements_v1' && e.key !== 'colaca_silagem_settlements') return;
      const current = getStoredSettlements();
      setSettlements(prev => {
        if (JSON.stringify(prev) === JSON.stringify(current)) return prev;
        return current;
      });
    };
    window.addEventListener('silagem_settlements_updated', handleSettlementsUpdate);
    window.addEventListener('storage', handleSettlementsUpdate);
    return () => {
      window.removeEventListener('silagem_settlements_updated', handleSettlementsUpdate);
      window.removeEventListener('storage', handleSettlementsUpdate);
    };
  }, []);

  // Sincronização em tempo real de Centros de Custo (atualizados pelo Cadastros Base ou Notas)
  useEffect(() => {
    const handleCostCentersUpdate = (e: any) => {
      const current = (e?.detail && Array.isArray(e.detail)) ? e.detail : getStoredCostCenters();
      setCostCenters(prev => {
        if (JSON.stringify(prev) === JSON.stringify(current)) return prev;
        return current;
      });
    };
    window.addEventListener('colaca_silagem_centros_updated', handleCostCentersUpdate);
    window.addEventListener('silagem_cost_centers_updated', handleCostCentersUpdate);
    window.addEventListener('storage', handleCostCentersUpdate);
    return () => {
      window.removeEventListener('colaca_silagem_centros_updated', handleCostCentersUpdate);
      window.removeEventListener('silagem_cost_centers_updated', handleCostCentersUpdate);
      window.removeEventListener('storage', handleCostCentersUpdate);
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
      // Se for lançamento exclusivo de DRE / abatimento de estoque, NÃO insere na tabela contas_a_pagar
      if (exp.isDreOnly || exp.skipAccountsPayable || exp.status === 'compensado_estoque') {
        return;
      }
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
    saveCloudMachineries(newMachineries, activeTenantId).catch(err => console.warn('Supabase saveCloudMachineries notice:', err));
    saveStoredMachineries(newMachineries);
    saveCompanyFrotas(newMachineries, activeTenantId);

    setMachineries(newMachineries);
  };

  // RH Funcionários Handlers (Multi-Tenant Persistência no Supabase)
  const handleDeleteEmployee = async (id: string) => {
    if (!id) return;
    const targetUuid = toValidUUID(id);
    // 1. Atualização imediata na UI e armazenamento local
    setEmployees(prev => prev.filter(e => e.id !== id && e.id !== targetUuid && toValidUUID(e.id) !== targetUuid));
    const currentStored = getStoredEmployees().filter(e => e.id !== id && e.id !== targetUuid && toValidUUID(e.id) !== targetUuid);
    saveStoredEmployees(currentStored);
    saveCompanyFuncionarios(currentStored, activeTenantId);
    lastSyncedState.current.rel_employees = JSON.stringify(currentStored);

    // 2. Chama explicitamente o método .delete().eq('id', id) do Supabase SEM qualquer insert ou upsert
    try {
      await deleteRhFuncionario(id, activeTenantId, currentUser?.id);
    } catch (err) {
      console.warn('Supabase handleDeleteEmployee notice:', err);
    }
  };

  const handleSaveEmployees = async (newEmployees: Employee[]) => {
    // 1. Deduplicação preventiva para garantir lista sem linhas repetidas
    const seen = new Set<string>();
    const deduplicatedEmployees: Employee[] = [];
    for (const emp of newEmployees) {
      if (!emp || !emp.name || emp.name.trim() === '') continue;
      const st = String(emp.status || '').toLowerCase();
      if (st === 'excluido' || st === 'inativo' || emp.active === false) continue;
      if (emp.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' || (emp.name.trim().toUpperCase() === 'ALISSON PAG' && !emp.cpf)) {
        continue;
      }
      const k = emp.id ? String(emp.id) : (emp.cpf ? `cpf_${emp.cpf}` : `name_${emp.name}`);
      if (!seen.has(k)) {
        seen.add(k);
        deduplicatedEmployees.push(emp);
      }
    }

    // Identifica apenas colaboradores novos ou efetivamente alterados para evitar PATCH em lote desnecessário
    const serializeComparableEmployee = (e: Employee) => {
      const { updated_at: _u, ...rest } = (e || {}) as any;
      return JSON.stringify(rest);
    };
    const prevEmployeeMap = new Map<string, string>();
    for (const prevEmp of employees) {
      if (prevEmp?.id) {
        const ser = serializeComparableEmployee(prevEmp);
        prevEmployeeMap.set(prevEmp.id, ser);
        prevEmployeeMap.set(toValidUUID(prevEmp.id), ser);
      }
    }

    const changedEmployees = deduplicatedEmployees.filter(emp => {
      const prevSer = prevEmployeeMap.get(emp.id) || prevEmployeeMap.get(toValidUUID(emp.id));
      return !prevSer || prevSer !== serializeComparableEmployee(emp);
    });

    // 2. Atualização otimista imediata na UI e armazenamento local
    setEmployees(deduplicatedEmployees);
    saveStoredEmployees(deduplicatedEmployees);
    saveCompanyFuncionarios(deduplicatedEmployees, activeTenantId);

    if (changedEmployees.length === 0) {
      return;
    }

    try {
      // 3. Salva ou atualiza apenas os colaboradores alterados com injeção obrigatória do user_id autenticado para RLS
      let currentAuthUid = currentUser?.id;
      if (!currentAuthUid && isSupabaseConfigured) {
        try {
          const { data: u } = await supabase.auth.getUser();
          currentAuthUid = u?.user?.id || (await supabase.auth.getSession()).data.session?.user?.id;
        } catch (_) {}
      }
      const upsertPromises = changedEmployees.map(emp => upsertRhFuncionario(emp, activeTenantId, currentAuthUid));
      await Promise.allSettled(upsertPromises);

      // 5. Re-busca no banco para sincronizar colunas com filtro estrito .eq('user_id', currentAuthUid)
      const fresh = await fetchRhFuncionarios(activeTenantId, currentAuthUid);
      if (fresh && fresh.length > 0) {
        const merged = fresh.map(f => {
          const local = deduplicatedEmployees.find(e => toValidUUID(e.id) === f.id || e.id === f.id);
          if (!local) return f;

          // Dados locais recém-salvos pelo usuário têm precedência absoluta
          const recComm = local.receivesCommission !== undefined
            ? Boolean(local.receivesCommission)
            : Boolean(f.receivesCommission || (f.commissionPerHour && f.commissionPerHour > 0));

          const commH = recComm
            ? ((local.commissionPerHour !== undefined && local.commissionPerHour > 0)
                ? local.commissionPerHour
                : (f.commissionPerHour || 0))
            : 0;

          const commA = recComm
            ? ((local.commissionPerAlqueire !== undefined && local.commissionPerAlqueire > 0)
                ? local.commissionPerAlqueire
                : (f.commissionPerAlqueire || 0))
            : 0;

          const commHa = recComm
            ? ((local.commissionPerHectare !== undefined && local.commissionPerHectare > 0)
                ? local.commissionPerHectare
                : (f.commissionPerHectare || 0))
            : 0;

          const resolvedRg = local.numero_rg || local.rg || f.numero_rg || f.rg;
          const resolvedBirth = local.data_nascimento || local.birthDate || f.data_nascimento || f.birthDate;
          const resolvedPis = local.numero_pis || local.pis || f.numero_pis || f.pis;
          const rawRegime = local.regime_contratacao || local.contractType || f.regime_contratacao || f.contractType || 'Registrado (CLT)';
          const resolvedRegime = rawRegime === 'Funcionário' ? 'Registrado (CLT)' : rawRegime;

          return {
            ...f,
            ...local,
            id: local.id || f.id,
            rg: resolvedRg,
            numero_rg: resolvedRg,
            birthDate: resolvedBirth,
            data_nascimento: resolvedBirth,
            pis: resolvedPis,
            numero_pis: resolvedPis,
            contractType: resolvedRegime,
            regime_contratacao: resolvedRegime,
            photoUrl: local.photoUrl || f.photoUrl || (f as any).foto_url || (f as any).avatar_url,
            foto_url: local.foto_url || f.foto_url || local.photoUrl || f.photoUrl || (f as any).avatar_url,
            avatar_url: (local as any).avatar_url || (f as any).avatar_url || local.foto_url || f.foto_url || local.photoUrl || f.photoUrl,
            commissionPerHour: commH,
            commissionPerAlqueire: commA,
            commissionPerHectare: commHa,
            comissao_hora: commH,
            comissao_alqueire: commA,
            comissao_hectare: commHa,
            recebe_comissao: recComm,
            bankPixKey: local.bankPixKey || f.bankPixKey || (f as any).banco_chave_pix,
            banco_chave_pix: local.banco_chave_pix || (f as any).banco_chave_pix || local.bankPixKey || f.bankPixKey,
            bankAgency: local.bankAgency || f.bankAgency || (f as any).agencia,
            agencia: local.agencia || (f as any).agencia || local.bankAgency || f.bankAgency,
            bankAccount: local.bankAccount || f.bankAccount || (f as any).conta_corrente,
            conta_corrente: local.conta_corrente || (f as any).conta_corrente || local.bankAccount || f.bankAccount,
            paymentLocation: local.paymentLocation || f.paymentLocation || (f as any).local_recebimento,
            local_recebimento: local.local_recebimento || (f as any).local_recebimento || local.paymentLocation || f.paymentLocation,
            aso_url: (f as any).aso_url || local.aso_url,
            contrato_experiencia_url: (f as any).contrato_experiencia_url || local.contrato_experiencia_url,
            cnh_url: (f as any).cnh_url || local.cnh_url,
            ficha_registro_url: (f as any).ficha_registro_url || local.ficha_registro_url,
            admissionExamDoc: f.admissionExamDoc || local.admissionExamDoc,
            experienceContractDoc: f.experienceContractDoc || local.experienceContractDoc,
            generalDocs: f.generalDocs || local.generalDocs,
            signedRegistrationDoc: f.signedRegistrationDoc || local.signedRegistrationDoc,
          };
        });

        // Preserva colaboradores locais recém-criados que ainda estejam em propagação no Supabase
        const freshIds = new Set(fresh.map(f => f.id));
        const extraLocal = deduplicatedEmployees.filter(e => e.id && !freshIds.has(e.id) && !freshIds.has(toValidUUID(e.id)));
        const finalMerged = [...merged, ...extraLocal];

        // Deduplica estritamente finalMerged por ID
        const seenFinal = new Set<string>();
        const strictMerged: Employee[] = [];
        for (const emp of finalMerged) {
          const k = emp.id ? String(emp.id) : (emp.cpf ? `cpf_${emp.cpf}` : `name_${emp.name}`);
          if (!seenFinal.has(k)) {
            seenFinal.add(k);
            strictMerged.push(emp);
          }
        }

        lastSyncedState.current.rel_employees = JSON.stringify(strictMerged);
        setEmployees(strictMerged);
        saveStoredEmployees(strictMerged);
      }
    } catch (err: any) {
      console.error('[Supabase handleSaveEmployees Catch] Erro detalhado ao salvar funcionários:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        fullError: err,
      });
    }
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
    const oldMap = new Map<string, string>(inventory.map(i => [i.id, JSON.stringify(i)]));
    const newIds = new Set(newInventory.map(i => i.id));

    for (const oldId of oldMap.keys()) {
      if (!newIds.has(oldId)) {
        deleteEstoqueItem(oldId, activeTenantId).catch(err => console.warn('Supabase deleteEstoqueItem notice:', err));
      }
    }

    for (const item of newInventory) {
      const prevSer = oldMap.get(item.id);
      if (!prevSer || prevSer !== JSON.stringify(item)) {
        upsertEstoqueItem(item, activeTenantId).catch(err => console.warn('Supabase upsertEstoqueItem notice:', err));
      }
    }

    const ser = JSON.stringify(newInventory);
    lastSyncedState.current.inventory = ser;
    lastSyncedState.current.rel_inventory = ser;
    saveStoredInventory(newInventory);
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
  // 3. Painel Interno de Gestão de Silagem (ERP): rota padrão para renderizar a interface visual completa
  const getResolvedRoute = (): 'master-admin' | 'operador-campo' | 'ficha-cliente' | 'ficha-fornecedor' | 'landing' | 'auth' | 'dashboard' => {
    if (typeof window === 'undefined') return 'dashboard';
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

    // 3. Rota de Autenticação apenas se explicitamente solicitada
    if (
      path.includes('/auth') ||
      path.includes('/cadastro') ||
      path.includes('/login') ||
      path.includes('/signup') ||
      search.includes('view=auth') ||
      search.includes('tab=auth') ||
      hash.includes('auth') ||
      hash.includes('cadastro') ||
      hash.includes('signup')
    ) {
      return 'auth';
    }

    // 4. Forçar Landing Page APENAS se requisitado explicitamente via URL
    if (
      path === '/landing' ||
      search.includes('view=landing') ||
      search.includes('tab=landing') ||
      search.includes('site=publico') ||
      hash.includes('landing')
    ) {
      return 'landing';
    }

    // 5. Garantir sessão ativa localmente para operação offline imediata
    try {
      if (typeof localStorage !== 'undefined' && !localStorage.getItem('silagem_client_session')) {
        localStorage.setItem('silagem_client_session', 'active');
      }
    } catch (_) {}

    // 6. Rota padrão do ERP: Dashboard operacional com todas as tabelas, botões e painel visual
    return 'dashboard';
  };

  const [currentRoute, setCurrentRoute] = useState<'master-admin' | 'operador-campo' | 'ficha-cliente' | 'ficha-fornecedor' | 'landing' | 'auth' | 'dashboard'>(getResolvedRoute);

  // Sincronizar com mudanças de URL (popstate e hashchange)
  useEffect(() => {
    const handleUrlChange = () => {
      setCurrentRoute(getResolvedRoute());
      const resolvedTab = getResolvedActiveTab();
      if (resolvedTab) {
        setActiveTab(resolvedTab);
      }
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
    const hasActiveSession = 
      IS_OFFLINE_LOCAL_STORAGE_MODE ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('silagem_client_session') === 'active') || 
      Boolean(currentUser);
    if (hasActiveSession) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('silagem_client_session', 'active');
        }
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

  const handleCloseWindowLogout = async () => {
    try {
      const confirmed = await confirm({
        title: 'Encerrar Sessão',
        message: 'Deseja realmente sair e fechar o Sistema Colaca Silagem?',
        confirmLabel: 'Sair e Fechar',
        cancelLabel: 'Continuar no Sistema',
        variant: 'danger'
      });
      if (confirmed) {
        handleLogout();
      }
    } catch {
      handleLogout();
    }
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
          const currentAuthUid = currentUser?.id;
          const tenantOnly = cloudData.rh_funcionarios.filter(e => {
            const uid = String(e.userId || (e as any).user_id || '').trim();
            if (currentAuthUid && uid) return uid === currentAuthUid;
            const cid = String(e.companyId || (e as any).company_id || (e as any).tenant_id || '').trim();
            return currentAuthUid && cid === currentAuthUid;
          });
          setEmployees(tenantOnly);
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

  const lastCheckTimeRef = useRef<number>(0);

  const performSubscriptionCheck = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheckTimeRef.current < 30000) {
      return; // Evita requisições redundantes se checado há menos de 30 segundos
    }
    lastCheckTimeRef.current = now;

    if (isAdminImpersonating) {
      const nextAdminCheck = {
        isChecking: false,
        hasAccess: true,
        status: 'active' as const,
        daysRemaining: 999,
        blockMessage: '',
        subscriberName: impersonatedSubscriber?.name,
        subscriberEmail: impersonatedSubscriber?.email,
        planName: impersonatedSubscriber?.planName || 'Produtor Essencial',
      };
      setSubscriptionCheck((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(nextAdminCheck)) return prev;
        return nextAdminCheck;
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

    const nextCheck = {
      isChecking: false,
      hasAccess: result.hasAccess,
      status: result.status,
      daysRemaining: result.daysRemaining,
      blockMessage: result.errorMessage || 'Sua assinatura expirou. Entre em contato com o administrador',
      subscriberName: result.subscriberName || companyProfile?.tradeName || companyProfile?.corporateName,
      subscriberEmail: result.subscriberEmail || userEmail,
      planName: result.planName || companyProfile?.planName || 'Produtor Essencial',
    };
    setSubscriptionCheck((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(nextCheck)) return prev;
      return nextCheck;
    });
  }, [isAdminImpersonating, currentUser?.email, companyProfile?.id, companyProfile?.email, impersonatedSubscriber]);

  const performSubCheckRef = useRef(performSubscriptionCheck);
  useEffect(() => {
    performSubCheckRef.current = performSubscriptionCheck;
  }, [performSubscriptionCheck]);

  // Executa checagem de assinatura ao iniciar ou ao retomar foco (com throttle e canal persistente)
  useEffect(() => {
    performSubCheckRef.current(false);

    const handleFocus = () => {
      performSubCheckRef.current();
    };
    window.addEventListener('focus', handleFocus);

    // Escuta eventos em tempo real para sincronização imediata sem F5
    const handleImmediateSync = (e?: any) => {
      if (e?.type === 'storage' && e?.key && !['assinantes', 'subscribers', 'company_profile', 'silagem_active_subscriber_id'].includes(e.key)) return;
      performSubCheckRef.current(false);
    };
    window.addEventListener('master_admin_data_changed', handleImmediateSync);
    window.addEventListener('company_profile_updated', handleImmediateSync);
    window.addEventListener('storage', handleImmediateSync);

    // Escuta em tempo real nas tabelas de assinantes do Supabase
    const unsubAssinantes = subscribeToCloudTable('assinantes', () => {
      performSubCheckRef.current(true);
    });
    const unsubSubs = subscribeToCloudTable('subscribers', () => {
      performSubCheckRef.current(true);
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('master_admin_data_changed', handleImmediateSync);
      window.removeEventListener('company_profile_updated', handleImmediateSync);
      window.removeEventListener('storage', handleImmediateSync);
      unsubAssinantes();
      unsubSubs();
    };
  }, []);

  // Mapeamento dinâmico de dias de vencimento da assinatura (Painel Master / Supabase / LocalStorage)
  const activeSubscriber = useMemo(() => {
    if (isAdminImpersonating && impersonatedSubscriber) {
      return impersonatedSubscriber;
    }
    try {
      const subs = getStoredSubscribers();
      const activeSubId = typeof localStorage !== 'undefined' ? localStorage.getItem('silagem_active_subscriber_id') : null;
      const activeEmail = (typeof localStorage !== 'undefined' ? localStorage.getItem('silagem_active_user_email') || localStorage.getItem('silagem_client_email') : '') || currentUser?.email || companyProfile?.email;
      if (activeSubId) {
        const found = subs.find(s => s.id === activeSubId);
        if (found) return found;
      }
      if (activeEmail) {
        const found = subs.find(s => s.responsibleEmail?.toLowerCase() === activeEmail.toLowerCase());
        if (found) return found;
      }
      if (subs.length > 0) return subs[0];
    } catch (e) {}
    return null;
  }, [isAdminImpersonating, impersonatedSubscriber, currentUser?.email, companyProfile?.email]);

  const daysUntilDue = useMemo(() => {
    if (isAdminImpersonating && impersonatedSubscriber) {
      try {
        const subs = getStoredSubscribers();
        const match = subs.find(s => s.id === impersonatedSubscriber.id || s.responsibleEmail === impersonatedSubscriber.email);
        if (match?.trialUntil) {
          const diff = new Date(match.trialUntil + 'T23:59:59').getTime() - Date.now();
          return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }
      } catch (e) {}
    }
    if (subscriptionCheck?.daysRemaining !== undefined && subscriptionCheck.daysRemaining !== null) {
      return subscriptionCheck.daysRemaining;
    }
    if (activeSubscriber && 'trialUntil' in activeSubscriber && (activeSubscriber as any).trialUntil) {
      try {
        const diff = new Date((activeSubscriber as any).trialUntil + 'T23:59:59').getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      } catch (e) {}
    }
    return 30; // Prazo longo padrão
  }, [isAdminImpersonating, impersonatedSubscriber, subscriptionCheck?.daysRemaining, activeSubscriber]);

  const isSubscriptionExpiringSoon = daysUntilDue <= 6;
  const subscriptionPlanDisplayName = useMemo(() => {
    const p = subscriptionCheck?.planName || companyProfile?.planName || activeSubscriber?.planName;
    if (!p || p.trim() === '') return 'PRODUTOR ESSENCIAL';
    return p.toUpperCase();
  }, [subscriptionCheck?.planName, companyProfile?.planName, activeSubscriber?.planName]);

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
  const isUserAuthenticated = 
    IS_OFFLINE_LOCAL_STORAGE_MODE ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('silagem_client_session') === 'active') || 
    Boolean(currentUser);

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
  // bloqueia o acesso e redireciona imediatamente para a tela de bloqueio (apenas em modo nuvem com assinatura checada)
  if (!IS_OFFLINE_LOCAL_STORAGE_MODE && !subscriptionCheck.hasAccess && !isAdminImpersonating) {
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
    <div 
      id="desktop-outer-frame-container"
      className={`h-screen w-screen overflow-hidden bg-[#eef2f6] dark:bg-[#0c0d0e] ${isWindowMaximized ? 'p-0' : 'p-2.5 sm:p-3 lg:p-3.5'} flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-blue-200 selection:text-blue-900 box-border text-stone-900 dark:text-stone-100 transition-all duration-150`}
    >
      {/* Moldura da Janela Desktop (Container Principal de Software) */}
      <div 
        id="desktop-window-mother-frame"
        className={`flex-1 w-full h-full min-h-0 flex flex-col ${isWindowMaximized ? 'rounded-none border-0 shadow-none' : 'rounded-lg border-2 border-slate-300 dark:border-stone-700 shadow-2xl'} bg-zinc-100 dark:bg-stone-950 overflow-hidden relative transition-all duration-150 ${isWindowMinimized ? 'max-h-[64px] flex-none' : ''}`}
      >
        {/* Barra de Título Superior Simulada (Windows Desktop Titlebar) */}
        <header
          id="desktop-window-titlebar"
          className="h-7 min-h-[28px] max-h-[28px] bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-stone-850 dark:via-stone-800 dark:to-stone-850 border-b border-slate-300 dark:border-stone-700 px-2 sm:px-2.5 flex items-center justify-between select-none shrink-0 z-50 text-slate-800 dark:text-stone-200 gap-2 overflow-hidden"
        >
          {/* Lado Esquerdo: Ícone + Título, Versão, Build e Status de Assinatura contínuos da Esquerda para a Direita */}
          <div className="flex items-center space-x-1.5 min-w-0 font-mono uppercase text-[10px] sm:text-[10.5px] truncate font-bold text-slate-700 dark:text-stone-300">
            {/* Botão de menu mobile */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-0.5 rounded text-slate-700 dark:text-stone-300 hover:bg-slate-300/80 dark:hover:bg-stone-700 transition cursor-pointer shrink-0"
              aria-label="Abrir Menu"
            >
              <Menu className="w-3.5 h-3.5" />
            </button>
            <div className="w-3.5 h-3.5 rounded bg-emerald-600 flex items-center justify-center text-[8px] font-black text-white shrink-0 shadow-2xs">
              C
            </div>
            
            {/* Título & Versão & Build */}
            <span className="truncate">
              SISTEMA COLACA SILAGEM RETAGUARDA - VERSÃO: 1.0.3 - BUILD: 06/10/2026
            </span>

            {/* Separador */}
            <span className="text-slate-400 dark:text-stone-500 shrink-0 select-none">-</span>

            {/* Status da Assinatura (Mesmo tamanho de fonte, mesma cor cinza discreta; se ≤ 6 dias, apenas o texto fica vermelho) */}
            {isSubscriptionExpiringSoon ? (
              <span 
                className="text-red-600 dark:text-red-400 font-extrabold animate-pulse whitespace-nowrap shrink-0"
                title={`Atenção: Assinatura a vencer em ${daysUntilDue} ${daysUntilDue === 1 ? 'dia' : 'dias'}.`}
              >
                ● ASSINATURA A VENCER ({daysUntilDue} {daysUntilDue === 1 ? 'DIA' : 'DIAS'}) - {subscriptionPlanDisplayName}
              </span>
            ) : (
              <span className="text-slate-700 dark:text-stone-300 whitespace-nowrap shrink-0">
                ● ASSINATURA ATIVA - {subscriptionPlanDisplayName}
              </span>
            )}

            {/* Separador */}
            <span className="text-slate-400 dark:text-stone-500 shrink-0 select-none">-</span>

            {/* Modalidade / Versão do Sistema */}
            <span className="text-slate-700 dark:text-stone-300 whitespace-nowrap shrink-0">
              ⚡ SILAGEM FÁCIL PRO • MODO COMPLETO
            </span>
          </div>

          {/* Lado Direito: Botão Supabase + Perfil do Usuário Slim + Trio de Controle da Janela */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            {/* Botão [ Supabase ] Slim Minimalista */}
            <SupabaseStatusControl dropdownPosition="down" variant="titlebar" />

            <span className="text-slate-400 dark:text-stone-600 text-[10px] select-none">|</span>

            {/* Bloco de Perfil do Usuário Slim Horizontal */}
            <div className="flex items-center space-x-1.5 px-0.5 py-0.5 rounded text-[10px] sm:text-[10.5px] font-medium text-slate-700 dark:text-stone-300">
              {/* Foto / Avatar redondo (compacto w-4.5 h-4.5 sm:w-5 sm:h-5) */}
              <div className="relative w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full overflow-hidden shrink-0 border border-slate-300 dark:border-stone-600 bg-slate-100 dark:bg-stone-700 flex items-center justify-center">
                {activeSession?.photoUrl ? (
                  <img 
                    src={activeSession.photoUrl} 
                    alt={activeSession.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : activeSession?.type === 'admin' ? (
                  <div className="w-full h-full bg-slate-800 text-white flex items-center justify-center">
                    <Shield className="w-2.5 h-2.5 text-emerald-400" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-indigo-600 text-white flex items-center justify-center text-[8px] font-black">
                    {activeSession?.name?.charAt(0) || 'U'}
                  </div>
                )}
                <span className={`absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full border border-white dark:border-stone-800 ${activeSession?.type === 'admin' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
              </div>

              {/* Nome: ADMINISTRADOR GERAL - text-[10px] sm:text-[10.5px] font-medium text-slate-700 dark:text-stone-300 */}
              <span className="text-[10px] sm:text-[10.5px] font-medium text-slate-700 dark:text-stone-300 tracking-tight whitespace-nowrap hidden sm:inline">
                {activeSession?.type === 'admin' ? 'ADMINISTRADOR GERAL' : (activeSession?.cargoNome || activeSession?.name || 'ADMINISTRADOR GERAL').toUpperCase()}
              </span>

              {/* Botão Trocar - text-[10px] sm:text-[10.5px] font-medium */}
              <button
                type="button"
                onClick={() => setIsSessionModalOpen(true)}
                className="text-[10px] sm:text-[10.5px] font-medium text-slate-700 dark:text-stone-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition cursor-pointer px-0.5 py-0.5"
                title="Simular outro Cargo ou Usuário"
              >
                Trocar
              </button>

              {/* Separador e Botão Sair - text-[10px] sm:text-[10.5px] font-medium */}
              <span className="text-slate-400 dark:text-stone-600 text-[10px] select-none">•</span>
              <button
                type="button"
                onClick={handleCloseWindowLogout}
                className="text-[10px] sm:text-[10.5px] font-medium text-slate-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 hover:underline transition cursor-pointer px-0.5 py-0.5"
                title="Encerrar Sessão e Sair do Sistema"
              >
                Sair
              </button>
            </div>

            {/* Separador sutil */}
            <div className="h-3 w-px bg-slate-300 dark:bg-stone-700 shrink-0" />

            {/* Trio Clássico de Mini-Botões de Controle da Janela Desktop */}
            <div className="flex items-center space-x-0.5 shrink-0 -mr-1">
              {/* Minimizar [ _ ] */}
              <button
                type="button"
                onClick={() => setIsWindowMinimized(prev => !prev)}
                className={`w-5.5 h-4.5 flex items-center justify-center rounded text-xs transition cursor-pointer ${
                  isWindowMinimized
                    ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                    : 'text-slate-600 dark:text-stone-400 hover:bg-slate-300/80 dark:hover:bg-stone-700'
                }`}
                title={isWindowMinimized ? "Restaurar Janela" : "Minimizar Janela"}
                aria-label="Minimizar Janela"
              >
                <span className="leading-none pb-1 font-bold text-[11px]">—</span>
              </button>

              {/* Maximizar [ ▢ ] */}
              <button
                type="button"
                onClick={() => setIsWindowMaximized(prev => !prev)}
                className={`w-5.5 h-4.5 flex items-center justify-center rounded text-xs transition cursor-pointer ${
                  isWindowMaximized
                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-stone-400 hover:bg-slate-300/80 dark:hover:bg-stone-700'
                }`}
                title={isWindowMaximized ? "Restaurar Tamanho da Janela" : "Maximizar Janela (Tela Cheia)"}
                aria-label="Maximizar Janela"
              >
                {isWindowMaximized ? (
                  <span className="relative w-2 h-2 inline-block">
                    <span className="absolute -top-0.5 -right-0.5 border border-slate-600 dark:border-stone-400 w-1.5 h-1.5 rounded-[1px] inline-block"></span>
                    <span className="absolute bottom-0 left-0 border border-slate-600 dark:border-stone-400 w-1.5 h-1.5 bg-slate-100 dark:bg-stone-850 rounded-[1px] inline-block"></span>
                  </span>
                ) : (
                  <span className="border border-slate-600 dark:border-stone-400 w-2 h-2 rounded-[1px] inline-block"></span>
                )}
              </button>

              {/* Fechar [ X ] -> Encerra a Sessão Local e Desloga */}
              <button
                type="button"
                onClick={handleCloseWindowLogout}
                className="w-5.5 h-4.5 flex items-center justify-center text-slate-600 dark:text-stone-400 hover:bg-red-600 hover:text-white rounded text-xs transition cursor-pointer font-bold"
                title="Fechar e Encerrar Sessão"
                aria-label="Fechar Janela e Sair"
              >
                <span className="leading-none font-bold text-[10px]">✕</span>
              </button>
            </div>
          </div>
        </header>

        {/* Barra de Restauração quando Minimizado */}
        {isWindowMinimized && (
          <div 
            onClick={() => setIsWindowMinimized(false)}
            className="px-3 py-1.5 bg-slate-200/90 dark:bg-stone-850 border-t border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 text-xs font-semibold flex items-center justify-between cursor-pointer select-none hover:bg-slate-300/70 dark:hover:bg-stone-800 transition"
          >
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Painel minimizado • Clique aqui ou no botão acima para restaurar a janela</span>
            </div>
            <button 
              type="button" 
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-0.5 rounded bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 shadow-2xs cursor-pointer"
            >
              Restaurar Janela ▢
            </button>
          </div>
        )}

        {/* Conteúdo Principal do Painel (Ocultado quando Minimizado) */}
        {!isWindowMinimized && (
          <>
            {/* Barra Fixa Amarela de Personificação (Impersonate) no topo do ERP */}
        {isAdminImpersonating && (
          <div className="shrink-0 w-full bg-amber-400 text-stone-950 font-bold px-4 py-2 flex items-center justify-between shadow-xs border-b border-amber-500 z-40">
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

        {/* Workspace Interno da Janela (Sidebar + Conteúdo Principal) */}
        <div className="flex-1 w-full min-h-0 relative flex flex-row overflow-hidden bg-zinc-100 dark:bg-stone-950">
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
              className="absolute inset-0 z-30 bg-black/50 lg:hidden backdrop-blur-xs"
            />
          )}

          {/* Main Body Area with left padding for desktop sidebar */}
          <div 
            className="lg:pl-64 flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden bg-zinc-100 dark:bg-stone-950"
          >
            {/* Dynamic Page Content (100% Full Width across all modules) */}
            <main 
              id="crm-main-content"
              className={`flex-1 min-h-0 overflow-y-auto p-2 sm:p-2.5 lg:p-3 ${activeTab === 'configuracoes' ? 'pb-2 lg:pb-2 overflow-hidden' : 'pb-20 lg:pb-3.5'} w-full max-w-none bg-zinc-100 dark:bg-stone-950`}
            >
          {/* TRAVA DE SEGURANÇA: INTERCEPÇÃO VISUAL DE ACESSO RESTRITO POR PERMISSÃO DE CARGO */}
          {(isCurrentTabDenied || activeTab.startsWith('acesso_restrito_')) ? (
            <AccessDeniedView
              moduleName={
                (currentRestrictedPerm === 'financeiro' || activeTab.includes('financeiro') || activeTab.includes('despesas') || activeTab.includes('contas')) ? 'Financeiro (Bancos, Saldos, DRE)' :
                (currentRestrictedPerm === 'frotas' || activeTab.includes('frotas') || activeTab.includes('veiculos')) ? 'Gestão de Frotas & Veículos' :
                (currentRestrictedPerm === 'rh' || activeTab.includes('rh') || activeTab.includes('funcionarios')) ? 'Recursos Humanos (Folhas, Férias, Faltas)' :
                (currentRestrictedPerm === 'estoque' || activeTab.includes('estoque') || activeTab.includes('fiscal') || activeTab.includes('almoxarifado')) ? 'Estoque / Almoxarifado / Notas Fiscais' :
                (currentRestrictedPerm === 'empresa' || activeTab.includes('configuracoes')) ? 'Dados da Empresa (Configurações cadastrais)' : 'este módulo'
              }
              onNavigateHome={() => setActiveTab('dashboard')}
            />
          ) : (
            <>
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
              onExpensesChange={setExpenses}
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
              onOpenAlmoxarifado={() => setActiveTab('almoxarifado')}
            />
          )}

          {/* TAB: Gestão e Controle do Almoxarifado */}
          {activeTab === 'almoxarifado' && (
            <AlmoxarifadoModule
              inventory={inventory}
              machineries={machineries}
              employees={employees}
              companyProfile={companyProfile}
              onSaveInventory={handleSaveInventory}
              onSaveMachineries={handleSaveMachineries}
              onNavigateToEstoque={() => setActiveTab('estoque')}
              onLaunchBatchToMaintenanceOS={({ loteId, veiculo, items }) => {
                const partsItems: MaintenancePartItem[] = items.map((item, idx) => {
                  const invItem: any = inventory.find(
                    (inv: any) =>
                      inv.id === item.produto_id ||
                      (inv.codigo && item.produto_codigo && inv.codigo === item.produto_codigo) ||
                      (inv.code && item.produto_codigo && inv.code === item.produto_codigo)
                  );
                  const unitCost = Number(invItem?.valor_unitario ?? invItem?.unitCost ?? invItem?.costPrice ?? invItem?.unitPrice ?? 0);
                  const qty = Number(item.quantidade) || 1;
                  return {
                    id: `part_lote_${loteId}_${idx}_${Date.now()}`,
                    description: item.produto_nome || invItem?.nome_comercial || invItem?.name || 'Peça do Almoxarifado',
                    quantity: qty,
                    unit: item.produto_unidade || invItem?.unit || 'UN',
                    unitCost,
                    totalCost: Number((qty * unitCost).toFixed(2)),
                    origin: 'almoxarifado_interno' as const,
                    stockDeducted: false,
                    inventoryItemId: item.produto_id || invItem?.id,
                  };
                });
                const partsTotal = partsItems.reduce((acc, p) => acc + (p.totalCost || 0), 0);
                const firstItem = items[0];
                const newDraftOS: MaintenanceLog = {
                  id: `maint_lote_${loteId}_${Date.now()}`,
                  osNumber: String(1000 + maintenanceLogs.length + 1),
                  machineryId: veiculo.id,
                  machineryPlateOrName: veiculo.name || veiculo.plate || veiculo.model || 'Veículo da Frota',
                  date: firstItem?.data_retirada || new Date().toISOString().split('T')[0],
                  type: 'corretiva',
                  serviceCategory: 'Troca de Óleo & Filtros',
                  description: `Aplicação de Pedido de Peças do Almoxarifado — Lote #${loteId} (${items.length} ${items.length === 1 ? 'item' : 'itens'})`,
                  workshopOrMechanic: firstItem?.retirado_por || 'Oficina Interna',
                  executorType: 'mecanico_interno',
                  executorName: firstItem?.retirado_por || 'Mecânico Interno',
                  partsCost: partsTotal,
                  laborCost: 0,
                  totalCost: partsTotal,
                  currentHourMeterOrKm: veiculo.hourMeter || veiculo.currentKm || 0,
                  partsItems,
                  partsOriginSummary: 'almoxarifado',
                  status: 'em_andamento',
                  notes: `Ordem de Serviço gerada automaticamente a partir do Lote de Peças #${loteId} retirado no Almoxarifado por ${firstItem?.retirado_por || 'Mecânico'} (Liberado por: ${firstItem?.operador_almoxarifado || 'Almoxarifado'}). Ao salvar esta OS, o estoque será baixado definitivamente.`,
                  createdAt: new Date().toISOString(),
                };
                setDraftMaintenanceLogFromAlmox(newDraftOS);
                setActiveTab('manutencoes');
              }}
            />
          )}

          {/* TAB: Financeiro (Consolidado, Despesas, Contas, A Pagar, A Receber, Acertos, Exportar) */}
          {(activeTab === 'financeiro' || activeTab === 'despesas' || activeTab === 'contas' || activeTab === 'bancos' || activeTab === 'pagar' || activeTab === 'receber') && (
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
              initialSubTab={
                activeTab === 'despesas' ? 'despesas' :
                (activeTab === 'contas' || activeTab === 'bancos') ? 'contas' :
                activeTab === 'pagar' ? 'a_pagar' :
                activeTab === 'receber' ? 'a_receber' : undefined
              }
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
              onSaveOrders={setOrders}
              onSaveServices={setServices}
            />
          )}

          {/* TAB: Notas e Entradas (NF-e, Notas Fiscais, Entradas Manuais, Romaneios, Recibos) */}
          {(activeTab === 'fiscal' || activeTab === 'documentos_entrada' || activeTab === 'entradas' || activeTab === 'nfe_importar' || activeTab === 'nfe_notas') && (
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
                onNavigate={(tab) => setActiveTab(tab)}
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
              onDeleteEmployee={handleDeleteEmployee}
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
              onSaveClients={setClients}
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
          {(activeTab === 'frotas' || activeTab === 'frota' || activeTab === 'veiculos' || activeTab === 'manutencoes' || activeTab === 'combustivel' || activeTab === 'motoristas' || activeTab === 'equipe' || activeTab === 'rodizio' || activeTab === 'rodizio_pneus') && (
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
              bankAccounts={bankAccounts}
              onSaveBankAccounts={handleSaveBankAccounts}
              companyProfile={companyProfile}
              initialDraftMaintenanceLog={draftMaintenanceLogFromAlmox}
              onClearInitialDraftMaintenanceLog={() => setDraftMaintenanceLogFromAlmox(null)}
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
              onSaveMaintenanceLogs={handleSaveMaintenanceLogs}
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
                    paymentDate: newExp.paymentDate || (newExp.status === 'pago' ? (newExp.date || new Date().toISOString().split('T')[0]) : undefined),
                    status: (newExp.status as any) || 'pendente',
                    paymentMethod: (newExp.paymentMethod as any) || 'boleto',
                    supplier: newExp.supplier || 'Fornecedor',
                    costCenterId: newExp.costCenterId,
                    costCenterName: newExp.costCenterName || newExp.costCenter,
                    machineryId: newExp.machineryId,
                    machineryName: newExp.machineryName,
                    invoiceNumber: newExp.invoiceNumber,
                    notes: newExp.notes,
                    isDreOnly: Boolean(newExp.isDreOnly),
                    skipAccountsPayable: Boolean(newExp.skipAccountsPayable),
                    createdAt: newExp.createdAt || new Date().toISOString(),
                  };
                });
                handleSaveExpense(createdList.length === 1 ? createdList[0] : createdList);
              }}
              onNavigate={(tab) => setActiveTab(tab)}
              onNavigateToFiscal={() => setActiveTab('fiscal')}
            />
          )}

          {/* TAB 12: Dados da Empresa */}
          {(activeTab === 'configuracoes' || activeTab === 'empresa') && (
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

          {/* TAB 13: Cadastros Base (Centros de Custo, Plano de Contas, Cargos & Permissões) */}
          {(activeTab === 'cadastros_base' || activeTab.startsWith('cadastros_base_') || ['centros_custo', 'plano_contas', 'cargos_permissoes'].includes(activeTab)) && (
            <CadastrosBaseModule
              initialSubTab={activeTab}
            />
          )}

          {/* Fallback Visual Seguro para MainDashboard se a aba não for reconhecida */}
          {!['dashboard', 'servicos', 'venda', 'vendas', 'clientes', 'crm', 'frotas', 'frota', 'veiculos', 'manutencoes', 'combustivel', 'motoristas', 'equipe', 'rodizio', 'rodizio_pneus', 'fornecedores', 'rh', 'folha', 'colaboradores', 'funcionarios', 'almoxarifado', 'estoque', 'financeiro', 'contas', 'pagar', 'receber', 'bancos', 'fiscal', 'nfe', 'relatorios', 'reports', 'configuracoes', 'cadastros_base', 'cadastros_base_centros_custo', 'cadastros_base_plano_contas', 'cadastros_base_cargos_permissoes', 'centros_custo', 'plano_contas', 'cargos_permissoes'].includes(activeTab) && (
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
              onExpensesChange={setExpenses}
            />
          )}
            </>
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

          </div>
        </>
      )}
      </div>

      {/* Global Modals */}
      
      {/* Modal de Simulação de Sessão / Troca de Perfil de Acesso */}
      <UserSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        onSessionChanged={(session) => {
          setActiveSession(session);
        }}
      />

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
