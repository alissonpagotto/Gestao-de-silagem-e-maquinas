import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Wallet,
  Tractor,
  Package,
  Users,
  ChevronRight,
  ShieldCheck,
  Building2,
  Calendar,
  UserCheck,
  Receipt,
  ShoppingCart,
  Wrench,
  Fuel,
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import {
  getStoredCompanyProfile,
  getStoredExpenses,
  getStoredOrders,
  getStoredServices,
  getStoredNotasSaida,
  getStoredFinanceiroCheques,
  getStoredMachineries,
  getStoredFuelLogs,
  getStoredMaintenanceLogs,
  getStoredInventory,
  getStoredFiscalRecords,
  getStoredEmployees,
  getStoredClients,
  getStoredVacations,
  checkCnhStatus,
} from '../../lib/storage';
import { getActiveUserSession } from '../../lib/cadastrosBaseStorage';
import { calculatePredictiveMaintenanceAlerts } from '../../lib/predictiveMaintenance';
import { useResolvedMediaUrl } from '../../lib/imageStorage';
import { EnsiladeiraVector } from './EnsiladeiraVector';

export interface AgroControlHomeProps {
  onNavigate: (tab: string) => void;
  companyProfile?: CompanyProfile;
}

export interface HomeIndicatorValues {
  // Pilar 1: Contas a Receber
  receberVencidos: number;
  receberHoje: number;
  receberChequesHoje: number;
  // Pilar 2: Contas a Pagar
  pagarVencidas: number;
  pagarHoje: number;
  pagarChequesEmitidosHoje: number;
  // Pilar 3: Frota & Manutenção
  frotaFluidosVencidos: number;
  frotaRevisoesProximas: number;
  frotaEmManutencao: number;
  // Pilar 4: Estoque & Fiscal
  estoqueAbaixoMinimo: number;
  notasPendentes: number;
  monitorFiscalStatus: string;
  // Pilar 5: RH & Relacionamento
  cnhVencidas: number;
  cnhAVencer: number;
  cnhTotalAlertas: number;
  feriasAVencer: number;
  aniversariantesMes: number;
}

const DEFAULT_INDICATORS: HomeIndicatorValues = {
  receberVencidos: 0,
  receberHoje: 0,
  receberChequesHoje: 0,
  pagarVencidas: 0,
  pagarHoje: 0,
  pagarChequesEmitidosHoje: 0,
  frotaFluidosVencidos: 0,
  frotaRevisoesProximas: 0,
  frotaEmManutencao: 0,
  estoqueAbaixoMinimo: 0,
  notasPendentes: 0,
  monitorFiscalStatus: 'ATIVO',
  cnhVencidas: 0,
  cnhAVencer: 0,
  cnhTotalAlertas: 0,
  feriasAVencer: 0,
  aniversariantesMes: 0,
};

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeIsoDate(raw: unknown): string {
  if (!raw) return '';
  let val = String(raw).trim();
  if (!val) return '';

  if (val.includes('T')) {
    val = val.split('T')[0];
  } else if (val.includes(' ')) {
    val = val.split(' ')[0];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return val;
  }

  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      if (yyyy.length === 4) {
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
    }
  }

  return '';
}

function extractMonthNumber(raw: unknown): number | null {
  const iso = normalizeIsoDate(raw);
  if (iso) {
    const month = Number(iso.slice(5, 7));
    if (month >= 1 && month <= 12) return month;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const dmMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (dmMatch) {
      const month = Number(dmMatch[2]);
      if (month >= 1 && month <= 12) return month;
    }
  }
  return null;
}

function isSettledStatus(raw: unknown): boolean {
  const st = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    st === 'pago' ||
    st === 'paid' ||
    st === 'recebido' ||
    st === 'quitado' ||
    st === 'concluido' ||
    st === 'liquidado' ||
    st === 'baixado' ||
    st === 'cancelado' ||
    st === 'canceled' ||
    st === 'estornado'
  );
}

export function calculateRealIndicators(): HomeIndicatorValues {
  if (typeof window === 'undefined') return DEFAULT_INDICATORS;

  const todayIso = getLocalTodayIso();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  // =========================================================================
  // 1. CONTAS A RECEBER (Débitos Vencidos, Vencendo Hoje, Cheques Recebidos Hoje)
  // =========================================================================
  let receberVencidos = 0;
  let receberHoje = 0;
  const seenReceberIds = new Set<string>();

  try {
    const rawReceber =
      localStorage.getItem('agrocontrol_contas_receber') ||
      localStorage.getItem('agrocontrol_financeiro_receber') ||
      localStorage.getItem('agrocontrol_receber');

    let parsedReceber: any[] = [];
    if (rawReceber) {
      const parsed = JSON.parse(rawReceber);
      if (Array.isArray(parsed)) parsedReceber = parsed;
    }

    parsedReceber.forEach((item: any, idx: number) => {
      const idKey = String(item.id || `rec_${idx}`);
      if (seenReceberIds.has(idKey)) return;
      seenReceberIds.add(idKey);

      const status = item.status || item.STATUS || item.paymentStatus || '';
      if (isSettledStatus(status)) return;

      const venc = normalizeIsoDate(
        item.vencimento ||
          item.VENCIMENTO ||
          item.data_vencimento ||
          item.dueDate ||
          item.deliveryDate ||
          item.date
      );
      if (!venc) return;

      if (venc < todayIso) receberVencidos++;
      else if (venc === todayIso) receberHoje++;
    });

    // Complementa com Pedidos/Vendas, Serviços faturados e Notas de Saída pendentes (sem duplicar IDs)
    const orders = getStoredOrders();
    orders.forEach((order: any) => {
      const idKey = String(order.id || '');
      if (idKey && seenReceberIds.has(idKey)) return;
      if (isSettledStatus(order.paymentStatus || order.status)) return;
      if (String(order.status || '').toLowerCase() === 'cancelado') return;
      const total = Number(order.totalAmount || order.totalValue || 0);
      const paid = Number(order.paidAmount || 0);
      if (total <= 0 || paid >= total) return;

      const venc = normalizeIsoDate(
        order.dueDate || order.dataVencimento || order.deliveryDate || order.orderDate || order.date
      );
      if (!venc) return;
      if (idKey) seenReceberIds.add(idKey);
      if (venc < todayIso) receberVencidos++;
      else if (venc === todayIso) receberHoje++;
    });

    const services = getStoredServices();
    services.forEach((srv: any) => {
      const idKey = String(srv.id || '');
      if (idKey && seenReceberIds.has(idKey)) return;
      if (isSettledStatus(srv.paymentStatus)) return;
      const st = String(srv.status || '').toLowerCase();
      if (st === 'cancelado' || st === 'orcamento') return;
      const total = Number(srv.totalValue || srv.totalAmount || 0);
      const paid = Number(srv.paidAmount || 0);
      if (total <= 0 || paid >= total) return;

      const venc = normalizeIsoDate(srv.dueDate || srv.dataVencimento || srv.date);
      if (!venc) return;
      if (idKey) seenReceberIds.add(idKey);
      if (venc < todayIso) receberVencidos++;
      else if (venc === todayIso) receberHoje++;
    });

    const notasSaida = getStoredNotasSaida();
    notasSaida.forEach((nf: any) => {
      if (!nf.lancarContasReceber) return;
      const idKey = String(nf.id || '');
      if (idKey && seenReceberIds.has(idKey)) return;
      if (isSettledStatus(nf.paymentStatus || nf.statusFinanceiro || nf.status)) return;
      const st = String(nf.status || '').toUpperCase();
      if (st === 'CANCELADA' || st === 'CANCELADO') return;

      const venc = normalizeIsoDate(nf.dataVencimento || nf.dataEmissao);
      if (!venc) return;
      if (idKey) seenReceberIds.add(idKey);
      if (venc < todayIso) receberVencidos++;
      else if (venc === todayIso) receberHoje++;
    });
  } catch {
    // Mantém zero em caso de falha de leitura
  }

  let receberChequesHoje = 0;
  let pagarChequesEmitidosHoje = 0;
  try {
    const storedCheques = getStoredFinanceiroCheques();
    let fallbackCheques: any[] = [];
    if (storedCheques.length === 0) {
      const rawFallback = localStorage.getItem('agrocontrol_cheques');
      if (rawFallback) {
        const parsed = JSON.parse(rawFallback);
        if (Array.isArray(parsed)) fallbackCheques = parsed;
      }
    }
    const allCheques: any[] = storedCheques.length > 0 ? storedCheques : fallbackCheques;

    allCheques.forEach((c: any) => {
      const st = String(c.status || '').toUpperCase();
      if (
        st === 'COMPENSADO' ||
        st === 'DEPOSITADO' ||
        st === 'CANCELADO' ||
        st === 'DEVOLVIDO' ||
        st === 'PAGO'
      ) {
        return;
      }

      const dt = normalizeIsoDate(
        c.bom_para || c.bomPara || c.data_vencimento || c.dataVencimento || c.vencimento || c.data_emissao
      );
      if (dt !== todayIso) return;

      const tipo = String(c.tipo || c.natureza || c.direcao || c.origem || '')
        .trim()
        .toLowerCase();
      const isEmitido =
        tipo.includes('emitido') || tipo.includes('pagar') || tipo.includes('saida') || tipo.includes('despesa');

      if (isEmitido) {
        pagarChequesEmitidosHoje++;
      } else {
        receberChequesHoje++;
      }
    });
  } catch {
    // Mantém zero
  }

  // =========================================================================
  // 2. CONTAS A PAGAR (Contas Vencidas, Vencendo Hoje, Cheques Emitidos Hoje)
  // =========================================================================
  let pagarVencidas = 0;
  let pagarHoje = 0;
  try {
    const expenses = getStoredExpenses();
    const seenPagarIds = new Set<string>();

    expenses.forEach((exp: any) => {
      const idKey = String(exp.id || '');
      if (idKey) seenPagarIds.add(idKey);
      if (isSettledStatus(exp.status)) return;

      const due = normalizeIsoDate(exp.dueDate || exp.vencimento || exp.data_vencimento || exp.date);
      if (!due) return;

      if (due < todayIso) {
        pagarVencidas++;
      } else if (due === todayIso) {
        pagarHoje++;
        const payMethod = String(exp.paymentMethod || exp.formaPagamento || '').toLowerCase();
        if (payMethod.includes('cheque')) {
          pagarChequesEmitidosHoje++;
        }
      }
    });

    // Fallback complementar se existir chave legada 'agrocontrol_contas_pagar'
    const rawExtraPagar = localStorage.getItem('agrocontrol_contas_pagar');
    if (rawExtraPagar) {
      const parsed = JSON.parse(rawExtraPagar);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          const idKey = String(item.id || '');
          if (idKey && seenPagarIds.has(idKey)) return;
          if (isSettledStatus(item.status)) return;
          const due = normalizeIsoDate(item.dueDate || item.vencimento || item.data_vencimento || item.date);
          if (!due) return;
          if (due < todayIso) pagarVencidas++;
          else if (due === todayIso) pagarHoje++;
        });
      }
    }
  } catch {
    // Mantém zero
  }

  // =========================================================================
  // 3. FROTA & MANUTENÇÃO (Fluidos/Peças Vencidas, Revisões Próximas, Em Manutenção)
  // =========================================================================
  let frotaFluidosVencidos = 0;
  let frotaRevisoesProximas = 0;
  let frotaEmManutencao = 0;
  try {
    const machineries = getStoredMachineries();
    const fuelLogs = getStoredFuelLogs();
    const maintenanceLogs = getStoredMaintenanceLogs();

    const predictiveAlerts = calculatePredictiveMaintenanceAlerts(machineries, fuelLogs, maintenanceLogs);
    frotaFluidosVencidos = predictiveAlerts.filter((a) => a.isOverdue).length;
    frotaRevisoesProximas = predictiveAlerts.filter((a) => !a.isOverdue).length;

    frotaEmManutencao = machineries.filter((m: any) => {
      const st = String(m.status || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return st === 'manutencao' || st === 'em_manutencao' || st === 'parado' || st === 'oficina';
    }).length;
  } catch {
    // Mantém zero
  }

  // =========================================================================
  // 4. ESTOQUE & FISCAL (Estoque Abaixo do Mínimo, Notas/Lançamentos Pendentes, Monitor Fiscal)
  // =========================================================================
  let estoqueAbaixoMinimo = 0;
  try {
    const inventory = getStoredInventory();
    let itemsToCheck: any[] = inventory;
    if (itemsToCheck.length === 0) {
      const rawInv =
        localStorage.getItem('agrocontrol_produtos') ||
        localStorage.getItem('colaca_silagem_estoque_produtos');
      if (rawInv) {
        const parsed = JSON.parse(rawInv);
        if (Array.isArray(parsed)) itemsToCheck = parsed;
      }
    }

    estoqueAbaixoMinimo = itemsToCheck.filter((item: any) => {
      const qty = Number(item.quantity ?? item.quantidade ?? item.estoque_atual ?? 0);
      const min = Number(item.minQuantity ?? item.min_quantity ?? item.estoque_minimo ?? 0);
      return min > 0 && qty <= min;
    }).length;
  } catch {
    // Mantém zero
  }

  let notasPendentes = 0;
  try {
    const seenFiscalIds = new Set<string>();
    const isPendingDoc = (stRaw: unknown): boolean => {
      const st = String(stRaw || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return (
        st === 'PENDENTE' ||
        st === 'RASCUNHO' ||
        st === 'AGUARDANDO' ||
        st === 'EM_PROCESSAMENTO' ||
        st === 'EM_DIGITACAO' ||
        st === 'VENCIDO' ||
        st === 'REJEITADA' ||
        st === 'ERRO'
      );
    };

    const notasSaida = getStoredNotasSaida();
    notasSaida.forEach((nf: any) => {
      const key = `ns_${nf.id || ''}`;
      if (nf.id && seenFiscalIds.has(key)) return;
      if (isPendingDoc(nf.status)) {
        if (nf.id) seenFiscalIds.add(key);
        notasPendentes++;
      }
    });

    const fiscalRecords = getStoredFiscalRecords();
    fiscalRecords.forEach((rec: any) => {
      const key = `fr_${rec.id || ''}`;
      if (rec.id && seenFiscalIds.has(key)) return;
      if (isPendingDoc(rec.status || rec.fiscalStatus)) {
        if (rec.id) seenFiscalIds.add(key);
        notasPendentes++;
      }
    });

    const rawDocsEntrada =
      localStorage.getItem('silagem_facil_clean_v1_documentos_entrada') ||
      localStorage.getItem('agrocontrol_documentos_entrada');
    if (rawDocsEntrada) {
      const docs = JSON.parse(rawDocsEntrada);
      if (Array.isArray(docs)) {
        docs.forEach((doc: any) => {
          const key = `de_${doc.id || ''}`;
          if (doc.id && seenFiscalIds.has(key)) return;
          if (isPendingDoc(doc.status || doc.situacao)) {
            if (doc.id) seenFiscalIds.add(key);
            notasPendentes++;
          }
        });
      }
    }
  } catch {
    // Mantém zero
  }

  // =========================================================================
  // 5. RH & RELACIONAMENTO (CNHs Vencidas/A Vencer, Férias a Vencer, Aniversariantes do Mês)
  // =========================================================================
  let cnhVencidas = 0;
  let cnhAVencer = 0;
  let feriasAVencer = 0;
  let aniversariantesMes = 0;

  try {
    const employees = getStoredEmployees().filter((e: any) => {
      const st = String(e.status || 'ativo').toLowerCase();
      return st !== 'inativo' && st !== 'desligado' && st !== 'demitido';
    });

    const cnhReport = checkCnhStatus(employees);
    cnhVencidas = cnhReport.expiredCount;
    cnhAVencer = cnhReport.expiringIn60DaysCount;

    // Férias a vencer: combina férias programadas/pendentes + colaboradores próximos de 12 meses de período aquisitivo
    const vacations = getStoredVacations();
    const employeesWithVacationAlert = new Set<string>();
    const in60Days = new Date(now);
    in60Days.setDate(now.getDate() + 60);
    const in60DaysIso = `${in60Days.getFullYear()}-${String(in60Days.getMonth() + 1).padStart(2, '0')}-${String(in60Days.getDate()).padStart(2, '0')}`;

    const employeesWithRecentCompletedVacation = new Set<string>();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const oneYearAgoIso = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}-${String(oneYearAgo.getDate()).padStart(2, '0')}`;

    vacations.forEach((vac: any) => {
      const st = String(vac.status || '').toLowerCase();
      const startIso = normalizeIsoDate(vac.startDate);
      const empId = String(vac.employeeId || vac.id || '');

      if (st === 'concluida' || st === 'gozada' || st === 'paga') {
        if (startIso && startIso >= oneYearAgoIso && vac.employeeId) {
          employeesWithRecentCompletedVacation.add(String(vac.employeeId));
        }
        return;
      }

      if (st === 'cancelada') return;

      if (startIso && startIso <= in60DaysIso) {
        employeesWithVacationAlert.add(empId || `vac_${vac.id}`);
      }
    });

    employees.forEach((emp: any) => {
      const empId = String(emp.id || '');
      if (!empId || employeesWithVacationAlert.has(empId) || employeesWithRecentCompletedVacation.has(empId)) {
        return;
      }
      const admIso = normalizeIsoDate(emp.admissionDate || emp.dataAdmissao || emp.data_admissao);
      if (!admIso) return;

      const admDate = new Date(`${admIso}T12:00:00`);
      if (isNaN(admDate.getTime())) return;

      const monthsWorked =
        (now.getFullYear() - admDate.getFullYear()) * 12 + (now.getMonth() - admDate.getMonth());
      if (monthsWorked >= 10) {
        // Verifica se está no intervalo de alerta do período concessivo (>= 10 meses desde o último ciclo anual)
        const cycleMonth = monthsWorked % 12;
        if (cycleMonth >= 10 || monthsWorked >= 12) {
          employeesWithVacationAlert.add(empId);
        }
      }
    });

    feriasAVencer = employeesWithVacationAlert.size;

    // Aniversariantes do Mês (Funcionários ativos + Clientes cadastrados)
    const seenBirthdayKeys = new Set<string>();

    employees.forEach((emp: any) => {
      const birthMonth = extractMonthNumber(
        emp.birthDate || emp.dataNascimento || emp.data_nascimento || emp.aniversario
      );
      if (birthMonth === currentMonth) {
        seenBirthdayKeys.add(`emp_${emp.id || emp.name}`);
      }
    });

    const clients = getStoredClients();
    clients.forEach((cli: any) => {
      const birthMonth = extractMonthNumber(
        cli.birthDate || cli.dataNascimento || cli.data_nascimento || cli.aniversario
      );
      if (birthMonth === currentMonth) {
        seenBirthdayKeys.add(`cli_${cli.id || cli.name}`);
      }
    });

    aniversariantesMes = seenBirthdayKeys.size;
  } catch {
    // Mantém zero
  }

  return {
    receberVencidos,
    receberHoje,
    receberChequesHoje,
    pagarVencidas,
    pagarHoje,
    pagarChequesEmitidosHoje,
    frotaFluidosVencidos,
    frotaRevisoesProximas,
    frotaEmManutencao,
    estoqueAbaixoMinimo,
    notasPendentes,
    monitorFiscalStatus: 'ATIVO',
    cnhVencidas,
    cnhAVencer,
    cnhTotalAlertas: cnhVencidas + cnhAVencer,
    feriasAVencer,
    aniversariantesMes,
  };
}

export function getReactiveCompanyLogo(overrideProfile?: CompanyProfile): string {
  if (typeof window === 'undefined') return '';

  const sanitizeLogo = (val?: string | null): string => {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (
      trimmed.includes('a7f3d0') ||
      trimmed.includes('15803d') ||
      trimmed.includes('viewBox="0 0 200 160"') ||
      trimmed.startsWith('/upload/') ||
      trimmed.startsWith('/_upload/') ||
      trimmed.includes('/_upload/') ||
      trimmed.includes('/upload/')
    ) {
      return '';
    }
    return trimmed;
  };

  // 1. Prioridade máxima: chave direta 'agrocontrol_empresa_logo'
  try {
    const directLogo = localStorage.getItem('agrocontrol_empresa_logo');
    const cleanedDirect = sanitizeLogo(directLogo);
    if (cleanedDirect) return cleanedDirect;
  } catch (_) {}

  // 2. Chave 'dadosEmpresa' da tela Dados da Empresa
  try {
    const rawDados = localStorage.getItem('dadosEmpresa');
    if (rawDados) {
      const parsed = JSON.parse(rawDados);
      const cleaned = sanitizeLogo(parsed?.logoUrl || parsed?.logo);
      if (cleaned) return cleaned;
    }
  } catch (_) {}

  // 3. Chaves de perfil corporativo persistido
  try {
    const rawProfile =
      localStorage.getItem('silagem_facil_clean_v1_company_profile') ||
      localStorage.getItem('colaca_silagem_company_profile') ||
      localStorage.getItem('agrocontrol_empresa');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      const cleaned = sanitizeLogo(parsed?.logoUrl || parsed?.logo);
      if (cleaned) return cleaned;
    }
  } catch (_) {}

  // 4. Prop recebida do componente pai
  if (overrideProfile?.logoUrl) {
    const cleaned = sanitizeLogo(overrideProfile.logoUrl);
    if (cleaned) return cleaned;
  }

  // 5. getStoredCompanyProfile()
  try {
    const stored = getStoredCompanyProfile();
    const cleaned = sanitizeLogo(stored?.logoUrl);
    if (cleaned) return cleaned;
  } catch (_) {}

  return '';
}

interface PillarRowConfig {
  label: string;
  value: number | string;
  targetTab: string;
  badgeVariant: 'danger' | 'warning' | 'success' | 'neutral';
}

interface PillarCardConfig {
  id: string;
  title: string;
  icon: React.ReactNode;
  headerTab: string;
  rows: PillarRowConfig[];
}

export const AgroControlHome: React.FC<AgroControlHomeProps> = ({
  onNavigate,
  companyProfile,
}) => {
  const [imgError, setImgError] = useState(false);
  const [clientLogoError, setClientLogoError] = useState(false);

  const [companyLogo, setCompanyLogo] = useState<string>(() => getReactiveCompanyLogo(companyProfile));
  const resolvedCompanyLogo = useResolvedMediaUrl(companyLogo);

  const [indicators, setIndicators] = useState<HomeIndicatorValues>(() => calculateRealIndicators());
  const [activeUserName, setActiveUserName] = useState<string>(() => {
    try {
      const session = getActiveUserSession();
      return session?.name || 'Administrador';
    } catch {
      return 'Administrador';
    }
  });

  useEffect(() => {
    setClientLogoError(false);
  }, [resolvedCompanyLogo]);

  // Sincronização em tempo real do logotipo da empresa
  useEffect(() => {
    const updateLogo = () => {
      try {
        setCompanyLogo(getReactiveCompanyLogo(companyProfile));
        setClientLogoError(false);
      } catch (e) {
        console.error('Erro ao atualizar logotipo reativo:', e);
      }
    };

    updateLogo();

    const logoEvents = [
      'storage',
      'agrocontrol_logo_updated',
      'agrocontrol_empresa_logo_updated',
      'agrocontrol_company_profile_updated',
      'colaca_company_profile_live_change',
      'company_profile_updated',
    ];

    logoEvents.forEach((ev) => window.addEventListener(ev, updateLogo));
    return () => {
      logoEvents.forEach((ev) => window.removeEventListener(ev, updateLogo));
    };
  }, [companyProfile]);

  // Sincronização em tempo real dos 5 pilares e do usuário ativo
  useEffect(() => {
    const handleRefresh = () => {
      try {
        setIndicators(calculateRealIndicators());
        const session = getActiveUserSession();
        if (session?.name) setActiveUserName(session.name);
      } catch (e) {
        console.error('Erro ao recalcular indicadores da tela inicial:', e);
      }
    };

    handleRefresh();

    const events = [
      'storage',
      'focus',
      'visibilitychange',
      'agrocontrol_indicators_updated',
      'agrocontrol_produtos_updated',
      'colaca_silagem_estoque_produtos_updated',
      'inventory_updated',
      'silagem_inventory_updated',
      'agrocontrol_contas_receber_updated',
      'agrocontrol_financeiro_receber_updated',
      'agrocontrol_receber_updated',
      'financeiro_receber_updated',
      'agrocontrol_vendas_updated',
      'agrocontrol_vendas_change',
      'vendas_updated',
      'agrocontrol_clientes_updated',
      'colaca_silagem_clientes_updated',
      'expenses_updated',
      'agrocontrol_despesas_updated',
      'agrocontrol_plano_preventivo_grupos_updated',
      'agrocontrol_user_session_updated',
    ];

    events.forEach((ev) => window.addEventListener(ev, handleRefresh));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleRefresh));
    };
  }, []);

  const formattedCurrentDate = useMemo(() => {
    const raw = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  const quickActions = useMemo(
    () => [
      {
        id: 'quick-despesa',
        label: '+ Lançar Despesa',
        icon: <Receipt className="w-3.5 h-3.5 shrink-0" />,
        tab: 'despesas',
      },
      {
        id: 'quick-venda',
        label: '+ Nova Venda / PDV',
        icon: <ShoppingCart className="w-3.5 h-3.5 shrink-0" />,
        tab: 'venda',
      },
      {
        id: 'quick-servico',
        label: '+ Prestação de Serviço',
        icon: <Wrench className="w-3.5 h-3.5 shrink-0" />,
        tab: 'servicos',
      },
      {
        id: 'quick-abastecimento',
        label: '+ Abastecimento',
        icon: <Fuel className="w-3.5 h-3.5 shrink-0" />,
        tab: 'combustivel',
      },
    ],
    []
  );

  const pillars: PillarCardConfig[] = useMemo(
    () => [
      {
        id: 'pillar-receber',
        title: 'CONTAS A RECEBER',
        icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-200 shrink-0" />,
        headerTab: 'receber',
        rows: [
          {
            label: 'Débitos Vencidos',
            value: indicators.receberVencidos,
            targetTab: 'receber',
            badgeVariant: indicators.receberVencidos > 0 ? 'danger' : 'neutral',
          },
          {
            label: 'Vencendo Hoje',
            value: indicators.receberHoje,
            targetTab: 'receber',
            badgeVariant: indicators.receberHoje > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Cheques Recebidos Hoje',
            value: indicators.receberChequesHoje,
            targetTab: 'receber',
            badgeVariant: indicators.receberChequesHoje > 0 ? 'warning' : 'neutral',
          },
        ],
      },
      {
        id: 'pillar-pagar',
        title: 'CONTAS A PAGAR',
        icon: <Wallet className="w-3.5 h-3.5 text-emerald-200 shrink-0" />,
        headerTab: 'pagar',
        rows: [
          {
            label: 'Contas Vencidas',
            value: indicators.pagarVencidas,
            targetTab: 'pagar',
            badgeVariant: indicators.pagarVencidas > 0 ? 'danger' : 'neutral',
          },
          {
            label: 'Vencendo Hoje',
            value: indicators.pagarHoje,
            targetTab: 'pagar',
            badgeVariant: indicators.pagarHoje > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Cheques Emitidos Hoje',
            value: indicators.pagarChequesEmitidosHoje,
            targetTab: 'pagar',
            badgeVariant: indicators.pagarChequesEmitidosHoje > 0 ? 'warning' : 'neutral',
          },
        ],
      },
      {
        id: 'pillar-frota',
        title: 'FROTA & MANUTENÇÃO',
        icon: <Tractor className="w-3.5 h-3.5 text-emerald-200 shrink-0" />,
        headerTab: 'frotas',
        rows: [
          {
            label: 'Fluidos / Peças Vencidas',
            value: indicators.frotaFluidosVencidos,
            targetTab: 'manutencoes',
            badgeVariant: indicators.frotaFluidosVencidos > 0 ? 'danger' : 'neutral',
          },
          {
            label: 'Revisões Próximas',
            value: indicators.frotaRevisoesProximas,
            targetTab: 'manutencoes',
            badgeVariant: indicators.frotaRevisoesProximas > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Equipamentos em Manutenção',
            value: indicators.frotaEmManutencao,
            targetTab: 'frotas',
            badgeVariant: indicators.frotaEmManutencao > 0 ? 'warning' : 'neutral',
          },
        ],
      },
      {
        id: 'pillar-estoque-fiscal',
        title: 'ESTOQUE & FISCAL',
        icon: <Package className="w-3.5 h-3.5 text-emerald-200 shrink-0" />,
        headerTab: 'estoque',
        rows: [
          {
            label: 'Estoque Abaixo do Mínimo',
            value: indicators.estoqueAbaixoMinimo,
            targetTab: 'estoque',
            badgeVariant:
              indicators.estoqueAbaixoMinimo >= 5
                ? 'danger'
                : indicators.estoqueAbaixoMinimo > 0
                  ? 'warning'
                  : 'neutral',
          },
          {
            label: 'Notas / Lançamentos Pendentes',
            value: indicators.notasPendentes,
            targetTab: 'fiscal',
            badgeVariant: indicators.notasPendentes > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Monitor Fiscal',
            value: indicators.monitorFiscalStatus,
            targetTab: 'fiscal',
            badgeVariant: 'success',
          },
        ],
      },
      {
        id: 'pillar-rh-relacionamento',
        title: 'RH & RELACIONAMENTO',
        icon: <Users className="w-3.5 h-3.5 text-emerald-200 shrink-0" />,
        headerTab: 'rh',
        rows: [
          {
            label: 'CNHs Vencidas / A Vencer',
            value: indicators.cnhTotalAlertas,
            targetTab: 'funcionarios',
            badgeVariant:
              indicators.cnhVencidas > 0
                ? 'danger'
                : indicators.cnhAVencer > 0
                  ? 'warning'
                  : 'neutral',
          },
          {
            label: 'Férias a Vencer',
            value: indicators.feriasAVencer,
            targetTab: 'rh',
            badgeVariant: indicators.feriasAVencer > 0 ? 'warning' : 'neutral',
          },
          {
            label: 'Aniversariantes do Mês',
            value: indicators.aniversariantesMes,
            targetTab: 'clientes',
            badgeVariant: indicators.aniversariantesMes > 0 ? 'success' : 'neutral',
          },
        ],
      },
    ],
    [indicators]
  );

  const getBadgeClasses = (variant: PillarRowConfig['badgeVariant']) => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600! text-white! border border-rose-900/50 font-black';
      case 'warning':
        return 'bg-amber-600! text-white! border border-amber-900/40 font-black';
      case 'success':
        return 'bg-emerald-700! text-white! border border-emerald-950/40 font-black tracking-wide';
      default:
        return 'bg-[#cad4e6]! dark:bg-stone-800! text-slate-800! dark:text-stone-200! border border-black/30 dark:border-stone-600 font-bold';
    }
  };

  return (
    <div
      id="agrocontrol-home-root"
      className="flex flex-col h-full min-h-full justify-between gap-3 px-2 sm:px-4 py-2 sm:py-3 select-none bg-[#cad4e6]! dark:bg-stone-950!"
    >
      {/* =====================================================================
          FAIXA 1: LOGO DINÂMICA DA EMPRESA + SAUDAÇÃO + 4 ATALHOS RÁPIDOS
          Usa tag semântica <header> para isolamento limpo de regras legadas
         ===================================================================== */}
      <header className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center text-center shrink-0 pt-1">
        {/* Logotipo Dinâmico de Dados da Empresa */}
        <div className="w-full flex items-center justify-center min-h-[112px] sm:min-h-[136px] max-h-[168px]">
          {resolvedCompanyLogo && !clientLogoError ? (
            <img
              src={resolvedCompanyLogo}
              alt={companyProfile?.name || 'Logotipo da Empresa'}
              className="w-auto max-w-[90vw] sm:max-w-[460px] max-h-[136px] sm:max-h-[160px] object-contain mx-auto block drop-shadow-sm select-none"
              referrerPolicy="no-referrer"
              onError={() => setClientLogoError(true)}
            />
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('configuracoes')}
              className="w-full max-w-md flex flex-col items-center justify-center px-5 py-4 rounded-lg border border-black! bg-[#e0e6f1]! hover:bg-[#d2dced]! dark:bg-stone-900! dark:hover:bg-stone-800! dark:border-stone-600! transition-colors cursor-pointer group shadow-sm"
              title="Clique para configurar o logotipo em Dados da Empresa"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-800! text-white! border border-black! flex items-center justify-center mb-2 group-hover:bg-emerald-700! transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-stone-100">
                {companyProfile?.name || 'LOGOTIPO DA EMPRESA NÃO CONFIGURADO'}
              </span>
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 mt-0.5 group-hover:underline">
                Clique para anexar o logotipo em Dados da Empresa
              </span>
            </button>
          )}
        </div>

        {/* Linha discreta: Data atual + Usuário logado */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-800 dark:text-stone-300">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 shrink-0" />
            <span>{formattedCurrentDate}</span>
          </span>
          <span className="text-slate-500 dark:text-stone-600">•</span>
          <span className="inline-flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400 shrink-0" />
            <span>
              Olá, <strong className="font-extrabold text-slate-950 dark:text-white">{activeUserName}</strong>
            </span>
          </span>
        </div>

        {/* Fileira centralizada de 4 Botões de Acesso Rápido */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onNavigate(action.tab)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-black! bg-emerald-700! hover:bg-emerald-800! text-white! shadow-sm cursor-pointer transition-colors active:scale-[0.99]"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* =====================================================================
          FAIXA 2: 5 PILARES EXECUTIVOS PADRONIZADOS (#e0e6f1 + Borda Preta)
          Usa tag semântica <section> para evitar sobrescrita de div:nth-of-type
         ===================================================================== */}
      <section className="w-full max-w-7xl mx-auto shrink-0 my-auto py-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {pillars.map((pillar) => (
            <article
              key={pillar.id}
              className="flex flex-col h-full bg-[#e0e6f1]! dark:bg-stone-900! border border-black! dark:border-stone-700! rounded-lg overflow-hidden shadow-sm"
            >
              {/* Cabeçalho Verde Esmeralda Clicável */}
              <button
                type="button"
                onClick={() => onNavigate(pillar.headerTab)}
                className="w-full bg-emerald-800! hover:bg-emerald-900! text-white! border-b border-black! font-bold text-xs px-3 py-2 flex items-center justify-between gap-1.5 cursor-pointer transition-colors text-left shrink-0"
                title={`Abrir módulo ${pillar.title}`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  {pillar.icon}
                  <span className="truncate tracking-wide">{pillar.title}</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              </button>

              {/* Linhas Clicáveis do Pilar */}
              <div className="flex flex-col flex-1 divide-y divide-black/15 dark:divide-stone-800 bg-[#e0e6f1]! dark:bg-stone-900!">
                {pillar.rows.map((row) => {
                  const isMonitorFiscal = row.label === 'Monitor Fiscal';
                  return (
                    <button
                      key={`${pillar.id}-${row.label}`}
                      type="button"
                      onClick={() => onNavigate(row.targetTab)}
                      className="w-full flex-1 flex items-center justify-between gap-2 px-3 py-2.5 bg-transparent hover:bg-[#d2dced]! dark:hover:bg-stone-800! cursor-pointer transition-colors text-left"
                      title={`Abrir ${row.label}`}
                    >
                      <span className="text-[11px] font-bold text-slate-900 dark:text-stone-200 leading-tight flex items-center gap-1.5 min-w-0">
                        {isMonitorFiscal && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">{row.label}</span>
                      </span>
                      <span
                        className={`text-[11px] tabular-nums px-2 py-0.5 rounded min-w-[26px] text-center shrink-0 ${getBadgeClasses(row.badgeVariant)}`}
                      >
                        {row.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* =====================================================================
          FAIXA 3: RODAPÉ DISCRETO DA MARCA AGROCONTROL (COMPACTO, SEM SCROLL)
          Usa tag semântica <footer> para encaixe limpo na viewport desktop
         ===================================================================== */}
      <footer className="w-full flex flex-col items-center justify-center text-center shrink-0 pb-0.5">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-[#d2dced]/80 dark:hover:bg-stone-900 transition-colors cursor-pointer group"
          title="Abrir Painel Executivo (Dashboard)"
        >
          <div className="shrink-0">
            {!imgError ? (
              <img
                src="/src/assets/images/ensiladeira_moedas_1791492311961.jpg"
                alt="AgroControl"
                className="w-16 sm:w-20 h-auto block object-contain mix-blend-multiply dark:mix-blend-normal dark:rounded"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <EnsiladeiraVector size="sm" className="w-16 h-auto block" />
            )}
          </div>
          <div className="text-left leading-tight">
            <div className="text-sm font-black text-slate-900 dark:text-stone-100 tracking-tight group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">
              AgroControl
            </div>
            <div className="text-[9.5px] font-bold text-emerald-800 dark:text-emerald-400 tracking-widest uppercase">
              SISTEMA DE GESTÃO INTEGRADA
            </div>
          </div>
        </button>
      </footer>
    </div>
  );
};

export default AgroControlHome;
