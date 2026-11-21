import {
  CompanyProfile,
  Expense,
  FinanceiroCheque,
  FuelLog,
  Machinery,
  ServiceOrder,
  SilageOrder,
} from '../../types';
import { CaixaOperacional, calcularTotaisCaixa } from '../../lib/caixaStorage';
import { SubscriberSegmentProfile } from '../../types/masterAdmin';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import {
  getEffectiveModulesConfig,
  getSegmentShortLabel,
} from '../../lib/subscriberModules';
import {
  findVehicleForLog,
  formatDualFuelLogEfficiency,
  formatFuelLogEfficiency,
  getFuelLogReadings,
} from '../../lib/fuelCalculation';
import { resolveSubscriberPrintHeader, SYSTEM_NAME } from '../../lib/printIdentity';

export type ReportSubTabId =
  | 'dashboard'
  | 'resumo'
  | 'dre_veiculo'
  | 'caixa'
  | 'financeiro'
  | 'excecoes'
  | 'personalizado'
  | 'estoque_ferramentas'
  | 'rh_folha'
  | 'imobilizado'
  | 'exportar'
  | 'cortes'
  | 'vendas'
  | 'despesas'
  | 'consumo';

export type ReportViewMode = 'analitico' | 'sintetico';

export interface SyntheticSummaryRow {
  groupKey: string;
  count: number;
  totalAmount: number;
  avgTicket: number;
  sharePct: number;
  secondaryMetric?: string;
  paidAmount?: number;
  pendingAmount?: number;
}

export function buildSyntheticSummaryRows<T>(
  items: T[],
  getGroupKey: (item: T) => string,
  getAmount: (item: T) => number,
  options?: {
    getPaidAmount?: (item: T) => number;
    getPendingAmount?: (item: T) => number;
    getSecondarySum?: (item: T) => number;
    formatSecondary?: (sum: number, count: number, totalAmount: number) => string;
  }
): SyntheticSummaryRow[] {
  const map = new Map<
    string,
    { count: number; totalAmount: number; paidAmount: number; pendingAmount: number; secondarySum: number }
  >();

  let grandTotal = 0;
  items.forEach((item) => {
    const key = (getGroupKey(item) || 'Não informado').trim() || 'Não informado';
    const amt = Number(getAmount(item)) || 0;
    grandTotal += amt;

    const curr = map.get(key) || {
      count: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      secondarySum: 0,
    };
    curr.count += 1;
    curr.totalAmount += amt;
    if (options?.getPaidAmount) curr.paidAmount += Number(options.getPaidAmount(item)) || 0;
    if (options?.getPendingAmount) curr.pendingAmount += Number(options.getPendingAmount(item)) || 0;
    if (options?.getSecondarySum) curr.secondarySum += Number(options.getSecondarySum(item)) || 0;
    map.set(key, curr);
  });

  return Array.from(map.entries())
    .map(([groupKey, stats]) => ({
      groupKey,
      count: stats.count,
      totalAmount: stats.totalAmount,
      avgTicket: stats.count > 0 ? stats.totalAmount / stats.count : 0,
      sharePct: grandTotal > 0 ? (stats.totalAmount / grandTotal) * 100 : 0,
      secondaryMetric: options?.formatSecondary
        ? options.formatSecondary(stats.secondarySum, stats.count, stats.totalAmount)
        : undefined,
      paidAmount: options?.getPaidAmount ? stats.paidAmount : undefined,
      pendingAmount: options?.getPendingAmount ? stats.pendingAmount : undefined,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

function renderSyntheticTableHtml(params: {
  groupColumnLabel: string;
  secondaryColumnLabel?: string;
  showPaidBreakdown?: boolean;
  rows: SyntheticSummaryRow[];
  totalLabel: string;
  accentColor?: string;
  emptyText?: string;
}): string {
  const {
    groupColumnLabel,
    secondaryColumnLabel,
    showPaidBreakdown = false,
    rows,
    totalLabel,
    accentColor = '#047857',
    emptyText = 'Nenhum registro localizado para agrupamento no período.',
  } = params;

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalPaid = rows.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const totalPending = rows.reduce((s, r) => s + (r.pendingAmount || 0), 0);
  const overallAvg = totalCount > 0 ? totalAmount / totalCount : 0;

  const colCount =
    5 + (secondaryColumnLabel ? 1 : 0) + (showPaidBreakdown ? 2 : 0);

  const bodyRows =
    rows.length > 0
      ? rows
          .map(
            (r) => `
          <tr style="font-size:8.5pt;">
            <td style="font-weight:700;">${escapeHtml(r.groupKey)}</td>
            <td style="text-align:center;font-weight:700;">${r.count}</td>
            ${secondaryColumnLabel ? `<td style="text-align:right;font-weight:600;">${escapeHtml(r.secondaryMetric || '-')}</td>` : ''}
            ${showPaidBreakdown ? `<td style="text-align:right;color:#047857;font-weight:600;">${formatCurrencyBRL(r.paidAmount || 0)}</td><td style="text-align:right;color:#b45309;font-weight:600;">${formatCurrencyBRL(r.pendingAmount || 0)}</td>` : ''}
            <td style="text-align:right;font-weight:800;color:${accentColor};">${formatCurrencyBRL(r.totalAmount)}</td>
            <td style="text-align:right;">${formatCurrencyBRL(r.avgTicket)}</td>
            <td style="text-align:right;font-weight:700;">${r.sharePct.toFixed(1)}%</td>
          </tr>
        `
          )
          .join('')
      : `<tr><td colspan="${colCount}" style="text-align:center;padding:16px;color:#64748b;">${escapeHtml(emptyText)}</td></tr>`;

  return `
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(groupColumnLabel)}</th>
          <th style="text-align:center;width:75px;">Qtd. Lanç.</th>
          ${secondaryColumnLabel ? `<th style="text-align:right;width:120px;">${escapeHtml(secondaryColumnLabel)}</th>` : ''}
          ${showPaidBreakdown ? `<th style="text-align:right;width:110px;">Liquidado (R$)</th><th style="text-align:right;width:110px;">Em Aberto (R$)</th>` : ''}
          <th style="text-align:right;width:120px;">Valor Total (R$)</th>
          <th style="text-align:right;width:110px;">Ticket Médio</th>
          <th style="text-align:right;width:75px;">Partic. (%)</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr style="background:#f1f5f9;border-top:2px solid ${accentColor};font-weight:900;">
          <td style="text-transform:uppercase;">${escapeHtml(totalLabel)} (${rows.length} grupos)</td>
          <td style="text-align:center;">${totalCount}</td>
          ${secondaryColumnLabel ? `<td style="text-align:right;">--</td>` : ''}
          ${showPaidBreakdown ? `<td style="text-align:right;color:#047857;">${formatCurrencyBRL(totalPaid)}</td><td style="text-align:right;color:#b45309;">${formatCurrencyBRL(totalPending)}</td>` : ''}
          <td style="text-align:right;color:${accentColor};">${formatCurrencyBRL(totalAmount)}</td>
          <td style="text-align:right;">${formatCurrencyBRL(overallAvg)}</td>
          <td style="text-align:right;">100.0%</td>
        </tr>
      </tfoot>
    </table>
  `;
}

export interface ReportPrintConfig {
  title: string;
  subtitle: string;
  documentType: string;
  contentHtml: string;
  whatsappText: string;
  orientation?: 'portrait' | 'landscape';
  signatureLabels?: string[];
}

export interface ReportSegmentContext {
  segmentProfile: SubscriberSegmentProfile;
  segmentLabel: string;
  enabledModules: string[];
  hasVenda: boolean;
  hasServicos: boolean;
  hasFrotas: boolean;
  isAgroSilage: boolean;
  ordersRevenueLabel: string;
  servicesRevenueLabel: string;
  chartTitle: string;
  servicesTabNavLabel: string;
  servicesDocTitle: string;
  servicesEmptyText: string;
  ordersProductColLabel: string;
  ordersVolumeLabel: string;
  ordersEmptyText: string;
  physicalMetricsTitle: string;
  dreCategoryLabels: {
    fuel: string;
    maintenance: string;
    inputs: string;
    labor: string;
    packaging: string;
    freight: string;
    other: string;
  };
}

export const STANDARD_REPORT_SIGNATURES = [
  'Diretoria / Controladoria',
  'Responsável Operacional',
];

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveReportSegmentContext(
  companyProfile?: CompanyProfile | null
): ReportSegmentContext {
  const effective = getEffectiveModulesConfig(companyProfile);
  const segmentProfile = effective.segmentProfile;
  const enabledModules = effective.enabledModules || [];
  const hasVenda = enabledModules.includes('venda');
  const hasServicos = enabledModules.includes('servicos');
  const hasFrotas = enabledModules.includes('frotas');
  const sectorLower = String(companyProfile?.activitySector || '').toLowerCase();
  const isAgroBySector =
    sectorLower.includes('silag') ||
    sectorLower.includes('agro') ||
    sectorLower.includes('forrag') ||
    sectorLower.includes('pecu') ||
    sectorLower.includes('rural');

  const isAgroSilage =
    segmentProfile === 'completo' ||
    (segmentProfile === 'servicos_operacoes' && isAgroBySector) ||
    (segmentProfile === 'personalizado' && hasServicos && isAgroBySector);

  if (segmentProfile === 'comercio_varejo') {
    return {
      segmentProfile,
      segmentLabel: getSegmentShortLabel(segmentProfile),
      enabledModules,
      hasVenda,
      hasServicos,
      hasFrotas,
      isAgroSilage: false,
      ordersRevenueLabel: 'Receita com Vendas Comerciais (PDV / Pedidos)',
      servicesRevenueLabel: 'Receita com Serviços / Entregas Complementares',
      chartTitle: 'Entradas (Vendas & Faturamento) vs Saídas (Despesas)',
      servicesTabNavLabel: 'Serviços',
      servicesDocTitle: 'Relatório Analítico de Serviços Executados',
      servicesEmptyText: 'Nenhum serviço registrado no período filtrado.',
      ordersProductColLabel: 'Produto / Mercadoria',
      ordersVolumeLabel: 'Volume / Qtd Comercializada',
      ordersEmptyText: 'Nenhuma venda registrada no período filtrado.',
      physicalMetricsTitle: 'INDICADORES COMERCIAIS E OPERACIONAIS DO PERÍODO',
      dreCategoryLabels: {
        fuel: 'Combustível, Frota de Entrega & Deslocamento',
        maintenance: 'Manutenção de Instalações, Equipamentos & Frota',
        inputs: 'Compras de Mercadorias, Insumos & Reposição',
        labor: 'Folha de Pagamento, Comissões & Encargos',
        packaging: 'Embalagens, Sacolas & Materiais de Loja',
        freight: 'Fretes, Correios & Logística',
        other: 'Despesas Administrativas, Fixas e Outras',
      },
    };
  }

  if (segmentProfile === 'transportadora_logistica') {
    return {
      segmentProfile,
      segmentLabel: getSegmentShortLabel(segmentProfile),
      enabledModules,
      hasVenda,
      hasServicos,
      hasFrotas,
      isAgroSilage: false,
      ordersRevenueLabel: 'Receita com Contratos de Carga / Pedidos',
      servicesRevenueLabel: 'Receita com Fretes & Operações Logísticas',
      chartTitle: 'Entradas (Fretes & Operações) vs Saídas (Despesas)',
      servicesTabNavLabel: 'Operações / Fretes',
      servicesDocTitle: 'Relatório Analítico de Operações e Serviços',
      servicesEmptyText: 'Nenhuma operação registrada no período filtrado.',
      ordersProductColLabel: 'Carga / Operação',
      ordersVolumeLabel: 'Tonelagem / Volume Transportado',
      ordersEmptyText: 'Nenhum faturamento registrado no período filtrado.',
      physicalMetricsTitle: 'INDICADORES OPERACIONAIS DE LOGÍSTICA E FROTA',
      dreCategoryLabels: {
        fuel: 'Combustível, Diesel S10 & Arla 32',
        maintenance: 'Manutenção Preventiva, Corretiva, Peças & Pneus',
        inputs: 'Pedágios, Insumos Operacionais & Suprimentos',
        labor: 'Motoristas, Diárias de Viagem & Folha de Pagamento',
        packaging: 'Lonas, Amarração, Materiais de Carga & Apoio',
        freight: 'Terceirização de Fretes & Logística',
        other: 'Despesas Administrativas, Seguros e Taxas',
      },
    };
  }

  if (segmentProfile === 'servicos_operacoes') {
    return {
      segmentProfile,
      segmentLabel: getSegmentShortLabel(segmentProfile),
      enabledModules,
      hasVenda,
      hasServicos,
      hasFrotas,
      isAgroSilage,
      ordersRevenueLabel: isAgroSilage
        ? 'Receita com Vendas & Fornecimento de Materiais'
        : 'Receita com Vendas & Fornecimento',
      servicesRevenueLabel: 'Receita com Prestação de Serviços Executados',
      chartTitle: 'Entradas (Prestação de Serviços) vs Saídas (Despesas)',
      servicesTabNavLabel: isAgroSilage ? 'Cortes / Serviços' : 'Serviços',
      servicesDocTitle: 'Relatório Analítico de Serviços Executados',
      servicesEmptyText: 'Nenhum serviço executado encontrado no período filtrado.',
      ordersProductColLabel: 'Item / Produto / Serviço',
      ordersVolumeLabel: 'Volume Total Movimentado',
      ordersEmptyText: 'Nenhum pedido faturado encontrado no período filtrado.',
      physicalMetricsTitle: 'INDICADORES OPERACIONAIS DE SERVIÇOS E FROTA',
      dreCategoryLabels: {
        fuel: 'Combustível, Diesel S10 & Arla',
        maintenance: 'Manutenção de Máquinas, Equipamentos & Veículos',
        inputs: 'Insumos, Materiais Aplicados & Suprimentos',
        labor: 'Mão de Obra, Operadores & Folha de Pagamento',
        packaging: 'Consumíveis, Embalagens & Materiais de Apoio',
        freight: 'Fretes, Mobilização & Transporte',
        other: 'Despesas Administrativas e Outros Custos',
      },
    };
  }

  if (segmentProfile === 'personalizado') {
    return {
      segmentProfile,
      segmentLabel: getSegmentShortLabel(segmentProfile),
      enabledModules,
      hasVenda,
      hasServicos,
      hasFrotas,
      isAgroSilage,
      ordersRevenueLabel: 'Receita com Vendas / Comercialização',
      servicesRevenueLabel: 'Receita com Prestação de Serviços',
      chartTitle: 'Entradas (Vendas & Serviços) vs Saídas (Despesas)',
      servicesTabNavLabel: isAgroSilage ? 'Cortes' : 'Serviços',
      servicesDocTitle: 'Relatório Analítico de Serviços Executados',
      servicesEmptyText: 'Nenhum serviço registrado no período filtrado.',
      ordersProductColLabel: 'Produto / Item',
      ordersVolumeLabel: 'Volume / Quantidade Faturada',
      ordersEmptyText: 'Nenhuma venda registrada no período filtrado.',
      physicalMetricsTitle: 'INDICADORES FÍSICOS E OPERACIONAIS DO PERÍODO',
      dreCategoryLabels: {
        fuel: 'Combustível, Diesel S10 & Arla',
        maintenance: 'Manutenção, Peças & Equipamentos',
        inputs: 'Insumos, Mercadorias & Suprimentos',
        labor: 'Mão de Obra, Operadores & Folha de Pagamento',
        packaging: 'Embalagens & Materiais de Apoio',
        freight: 'Fretes & Logística de Transporte',
        other: 'Despesas Administrativas e Outros Custos',
      },
    };
  }

  // Padrão 'completo'
  return {
    segmentProfile: 'completo',
    segmentLabel: getSegmentShortLabel('completo'),
    enabledModules,
    hasVenda,
    hasServicos,
    hasFrotas,
    isAgroSilage: true,
    ordersRevenueLabel: 'Receita com Vendas (Silagem & Produtos)',
    servicesRevenueLabel: 'Receita com Serviços (Colheita / Cortes / Operações)',
    chartTitle: 'Entradas (Vendas & Serviços) vs Saídas (Despesas)',
    servicesTabNavLabel: 'Cortes',
    servicesDocTitle: 'Relatório Analítico de Serviços Executados',
    servicesEmptyText: 'Nenhum registro de corte ou serviço no período filtrado.',
    ordersProductColLabel: 'Produto',
    ordersVolumeLabel: 'Volume Total Comercializado',
    ordersEmptyText: 'Nenhuma venda registrada no período filtrado.',
    physicalMetricsTitle: 'MÉTRICAS FÍSICAS DE PRODUÇÃO E OPERAÇÃO',
    dreCategoryLabels: {
      fuel: 'Combustível, Diesel S10 & Arla',
      maintenance: 'Manutenção de Ensiladeiras, Máquinas & Tratores',
      inputs: 'Insumos, Inoculantes & Sementes',
      labor: 'Mão de Obra, Diárias & Operadores',
      packaging: 'Lonas, Embalagens & Materiais de Apoio',
      freight: 'Fretes & Logística de Transporte',
      other: 'Outras Despesas Gerais & Administrativas',
    },
  };
}

function buildFilterChipsHtml(filters: Array<{ label: string; value: string }>): string {
  const active = filters.filter((f) => f.value && f.value !== 'todos' && f.value !== 'todas');
  if (active.length === 0) return '';
  return `
    <div style="margin-bottom: 12px; padding: 6px 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 8.5pt; color: #334155;">
      <strong style="text-transform: uppercase; font-size: 8pt; color: #0f172a;">Filtros Ativos:</strong>
      ${active
        .map(
          (f) =>
            `<span style="display:inline-block; margin-left:8px; padding:1px 6px; background:#e2e8f0; border-radius:4px;"><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.value)}</span>`
        )
        .join('')}
    </div>
  `;
}

function renderSummaryCardsRow(
  cards: Array<{ label: string; value: string; sub?: string; color: string }>
): string {
  const cols = Math.min(cards.length, 4);
  return `
    <div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 10px; margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid;">
      ${cards
        .map(
          (c) => `
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid ${c.color}; border-radius: 6px; padding: 9px 11px;">
            <div style="font-size: 7.5pt; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.3px;">${escapeHtml(c.label)}</div>
            <div style="font-size: 13pt; font-weight: 900; color: ${c.color}; margin-top: 2px;">${escapeHtml(c.value)}</div>
            ${c.sub ? `<div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">${escapeHtml(c.sub)}</div>` : ''}
          </div>
        `
        )
        .join('')}
    </div>
  `;
}

export function classifyDreExpenses(filteredExpenses: Expense[]) {
  let fuel = 0;
  let maintenance = 0;
  let inputs = 0;
  let labor = 0;
  let packaging = 0;
  let freight = 0;
  let other = 0;

  filteredExpenses.forEach((e) => {
    const amt = e.amount || 0;
    const catId = String(e.categoryId || '').toLowerCase();
    const catName = String(e.categoryName || '').toLowerCase();

    if (
      catId === 'cat_combustivel' ||
      catName.includes('combust') ||
      catName.includes('diesel') ||
      catName.includes('arla') ||
      catName.includes('gasolina')
    ) {
      fuel += amt;
    } else if (
      catId === 'cat_manutencao' ||
      catName.includes('manuten') ||
      catName.includes('peça') ||
      catName.includes('mecân') ||
      catName.includes('pneu')
    ) {
      maintenance += amt;
    } else if (
      catId === 'cat_insumos' ||
      catName.includes('insumo') ||
      catName.includes('sement') ||
      catName.includes('inocul') ||
      catName.includes('mercador') ||
      catName.includes('pedágio')
    ) {
      inputs += amt;
    } else if (
      catId === 'cat_mao_de_obra' ||
      catName.includes('mão') ||
      catName.includes('salár') ||
      catName.includes('folha') ||
      catName.includes('diária') ||
      catName.includes('colaborador') ||
      catName.includes('motorista')
    ) {
      labor += amt;
    } else if (
      catId === 'cat_lona_embalagem' ||
      catName.includes('lona') ||
      catName.includes('embalag') ||
      catName.includes('sacola')
    ) {
      packaging += amt;
    } else if (
      catId === 'cat_frete' ||
      catName.includes('frete') ||
      catName.includes('transp') ||
      catName.includes('logíst')
    ) {
      freight += amt;
    } else {
      other += amt;
    }
  });

  const total = fuel + maintenance + inputs + labor + packaging + freight + other;
  return { fuel, maintenance, inputs, labor, packaging, freight, other, total };
}

/**
 * 1. DASHBOARD CONSOLIDADO
 */
export function buildDashboardConsolidatedReport(params: {
  companyProfile: CompanyProfile;
  orders: SilageOrder[];
  services: ServiceOrder[];
  expenses: Expense[];
  fuelLogs: FuelLog[];
  startDate: string;
  endDate: string;
  competence: string;
}): ReportPrintConfig {
  const { companyProfile, orders, services, expenses, fuelLogs, startDate, endDate, competence } = params;
  const seg = resolveReportSegmentContext(companyProfile);
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const periodOrders = (orders || []).filter(
    (o) => o?.deliveryDate && o.deliveryDate >= startDate && o.deliveryDate <= endDate && o.status !== 'cancelado'
  );
  const periodServices = (services || []).filter(
    (s) => s?.startDate && s.startDate >= startDate && s.startDate <= endDate && s.status !== 'cancelado'
  );
  const periodExpenses = (expenses || []).filter(
    (e) => e?.dueDate && e.dueDate >= startDate && e.dueDate <= endDate
  );
  const periodFuel = (fuelLogs || []).filter(
    (f) => f?.date && f.date >= startDate && f.date <= endDate
  );

  const ordersRev = periodOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const servicesRev = periodServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalRev = ordersRev + servicesRev;
  const totalExp = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const net = totalRev - totalExp;
  const marginPct = totalRev > 0 ? (net / totalRev) * 100 : 0;

  const totalTons = periodOrders.reduce((sum, o) => sum + (o.tons || 0), 0);
  const totalHectares = periodServices.reduce((sum, s) => sum + (s.areaHectares || 0), 0);
  const totalDieselLiters = periodFuel.reduce((sum, f) => sum + (f.liters || 0), 0);
  const totalFuelCost = periodFuel.reduce((sum, f) => sum + (f.totalAmount || 0), 0);

  // Expense categories ranking
  const catMap = new Map<string, number>();
  periodExpenses.forEach((e) => {
    const cat = e.categoryName || 'Outras Despesas';
    catMap.set(cat, (catMap.get(cat) || 0) + (e.amount || 0));
  });
  const topCategories = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);

  // Monthly Evolution (6 months ending on active competence)
  const [compMStr, compYStr] = competence.split('/');
  const compM = (parseInt(compMStr, 10) || new Date().getMonth() + 1) - 1;
  const compY = parseInt(compYStr, 10) || new Date().getFullYear();
  const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthMap = new Map<string, { label: string; entradas: number; saidas: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(compY, compM - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { label: `${shortMonths[d.getMonth()]}/${d.getFullYear()}`, entradas: 0, saidas: 0 });
  }
  (orders || []).forEach((o) => {
    if (o && o.status !== 'cancelado' && typeof o.deliveryDate === 'string' && o.deliveryDate.length >= 7) {
      const slot = monthMap.get(o.deliveryDate.slice(0, 7));
      if (slot) slot.entradas += o.totalAmount || 0;
    }
  });
  (services || []).forEach((s) => {
    if (s && s.status !== 'cancelado' && typeof s.startDate === 'string' && s.startDate.length >= 7) {
      const slot = monthMap.get(s.startDate.slice(0, 7));
      if (slot) slot.entradas += s.totalAmount || 0;
    }
  });
  (expenses || []).forEach((e) => {
    if (e && typeof e.dueDate === 'string' && e.dueDate.length >= 7) {
      const slot = monthMap.get(e.dueDate.slice(0, 7));
      if (slot) slot.saidas += e.amount || 0;
    }
  });
  const monthlySeries = Array.from(monthMap.values());

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Receita Bruta Realizada',
      value: formatCurrencyBRL(totalRev),
      sub: `${periodOrders.length} venda(s) • ${periodServices.length} serviço(s)`,
      color: '#047857',
    },
    {
      label: 'Despesas Operacionais',
      value: formatCurrencyBRL(totalExp),
      sub: `${periodExpenses.length} lançamento(s) no período`,
      color: '#b91c1c',
    },
    {
      label: 'Resultado Líquido',
      value: formatCurrencyBRL(net),
      sub: `Margem Operacional: ${marginPct.toFixed(1)}%`,
      color: net >= 0 ? '#0369a1' : '#b91c1c',
    },
  ]);

  const physicalRows: string[] = [];
  if (seg.hasVenda || periodOrders.length > 0) {
    physicalRows.push(`
      <tr>
        <td>Pedidos / Faturamentos Comerciais</td>
        <td style="text-align:right;font-weight:bold;">${periodOrders.length} pedido(s)</td>
      </tr>
      <tr>
        <td>${escapeHtml(seg.ordersVolumeLabel)}</td>
        <td style="text-align:right;font-weight:bold;">${totalTons.toFixed(1)} ton</td>
      </tr>
    `);
  }
  if (seg.hasServicos || periodServices.length > 0) {
    physicalRows.push(`
      <tr>
        <td>Ordens de Serviço Executadas</td>
        <td style="text-align:right;font-weight:bold;">${periodServices.length} ordem(ns)</td>
      </tr>
    `);
    if (seg.isAgroSilage || totalHectares > 0) {
      physicalRows.push(`
        <tr>
          <td>Área Total Atendida / Executada</td>
          <td style="text-align:right;font-weight:bold;">${totalHectares.toFixed(1)} ha</td>
        </tr>
      `);
    }
  }
  if (seg.hasFrotas || periodFuel.length > 0) {
    physicalRows.push(`
      <tr>
        <td>Consumo Total de Combustível (${periodFuel.length} abastec.)</td>
        <td style="text-align:right;font-weight:bold;">${totalDieselLiters.toFixed(1)} L (${formatCurrencyBRL(totalFuelCost)})</td>
      </tr>
    `);
  }

  const contentHtml = `
    ${kpiHtml}

    <h4 style="font-size: 10pt; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; text-transform: uppercase;">
      1. Resumo Executivo Financeiro (${escapeHtml(seg.segmentLabel)})
    </h4>
    <table>
      <thead>
        <tr>
          <th>Indicador Financeiro</th>
          <th style="text-align: right; width: 170px;">Total Realizado (R$)</th>
          <th style="text-align: right; width: 90px;">% Rec.</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#f0fdf4;">
          <td style="font-weight:bold;">(+) ${escapeHtml(seg.ordersRevenueLabel)}</td>
          <td style="text-align:right;color:#047857;font-weight:bold;">${formatCurrencyBRL(ordersRev)}</td>
          <td style="text-align:right;">${totalRev > 0 ? ((ordersRev / totalRev) * 100).toFixed(1) : '0.0'}%</td>
        </tr>
        <tr style="background:#f0fdf4;">
          <td style="font-weight:bold;">(+) ${escapeHtml(seg.servicesRevenueLabel)}</td>
          <td style="text-align:right;color:#047857;font-weight:bold;">${formatCurrencyBRL(servicesRev)}</td>
          <td style="text-align:right;">${totalRev > 0 ? ((servicesRev / totalRev) * 100).toFixed(1) : '0.0'}%</td>
        </tr>
        <tr style="background:#e2e8f0;font-weight:800;">
          <td>(=) RECEITA BRUTA TOTAL DO PERÍODO</td>
          <td style="text-align:right;color:#047857;">${formatCurrencyBRL(totalRev)}</td>
          <td style="text-align:right;">100.0%</td>
        </tr>
        <tr style="background:#fff1f2;">
          <td style="font-weight:bold;">(-) Despesas e Custos Operacionais</td>
          <td style="text-align:right;color:#b91c1c;font-weight:bold;">${formatCurrencyBRL(totalExp)}</td>
          <td style="text-align:right;">${totalRev > 0 ? ((totalExp / totalRev) * 100).toFixed(1) : '0.0'}%</td>
        </tr>
        <tr style="background:#dcfce7;font-weight:900;border-top:2px solid #047857;">
          <td>(=) RESULTADO LÍQUIDO OPERACIONAL</td>
          <td style="text-align:right;color:${net >= 0 ? '#047857' : '#b91c1c'};font-size:10.5pt;">${formatCurrencyBRL(net)}</td>
          <td style="text-align:right;color:${net >= 0 ? '#047857' : '#b91c1c'};">${marginPct.toFixed(1)}%</td>
        </tr>
      </tbody>
    </table>

    <h4 style="font-size: 10pt; font-weight: 800; color: #0f172a; margin: 14px 0 6px 0; text-transform: uppercase;">
      2. Evolução Mensal (Últimos 6 Meses até ${escapeHtml(competence)})
    </h4>
    <table>
      <thead>
        <tr>
          <th>Competência</th>
          <th style="text-align: right;">Entradas (R$)</th>
          <th style="text-align: right;">Saídas (R$)</th>
          <th style="text-align: right;">Saldo Líquido (R$)</th>
        </tr>
      </thead>
      <tbody>
        ${monthlySeries
          .map((m) => {
            const saldo = m.entradas - m.saidas;
            return `
              <tr>
                <td style="font-weight:700;">${escapeHtml(m.label)}</td>
                <td style="text-align:right;color:#047857;font-weight:600;">${formatCurrencyBRL(m.entradas)}</td>
                <td style="text-align:right;color:#b91c1c;font-weight:600;">${formatCurrencyBRL(m.saidas)}</td>
                <td style="text-align:right;font-weight:800;color:${saldo >= 0 ? '#0369a1' : '#b91c1c'};">${formatCurrencyBRL(saldo)}</td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>

    ${
      topCategories.length > 0
        ? `
      <h4 style="font-size: 10pt; font-weight: 800; color: #0f172a; margin: 14px 0 6px 0; text-transform: uppercase;">
        3. Composição de Despesas por Categoria
      </h4>
      <table>
        <thead>
          <tr>
            <th>Categoria de Despesa</th>
            <th style="text-align: right; width: 170px;">Valor Realizado (R$)</th>
            <th style="text-align: right; width: 90px;">% Desp.</th>
          </tr>
        </thead>
        <tbody>
          ${topCategories
            .slice(0, 8)
            .map(([cat, val]) => {
              const pct = totalExp > 0 ? (val / totalExp) * 100 : 0;
              return `
                <tr>
                  <td style="font-weight:600;">${escapeHtml(cat)}</td>
                  <td style="text-align:right;color:#b91c1c;font-weight:700;">${formatCurrencyBRL(val)}</td>
                  <td style="text-align:right;">${pct.toFixed(1)}%</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `
        : ''
    }

    ${
      physicalRows.length > 0
        ? `
      <h4 style="font-size: 10pt; font-weight: 800; color: #0f172a; margin: 14px 0 6px 0; text-transform: uppercase;">
        ${topCategories.length > 0 ? '4' : '3'}. ${escapeHtml(seg.physicalMetricsTitle)}
      </h4>
      <table>
        <tbody>
          ${physicalRows.join('')}
        </tbody>
      </table>
    `
        : ''
    }
  `;

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO EXECUTIVO CONSOLIDADO*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `💰 *Receita Bruta:* ${formatCurrencyBRL(totalRev)}\n` +
    `💸 *Despesas Totais:* ${formatCurrencyBRL(totalExp)}\n` +
    `🟢 *Resultado Líquido:* ${formatCurrencyBRL(net)} (${marginPct.toFixed(1)}%)\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Gerado via ${SYSTEM_NAME}`;

  return {
    title: 'Relatório Executivo Consolidado',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)} • Perfil: ${seg.segmentLabel}`,
    documentType: 'RELATÓRIO CONSOLIDADO',
    contentHtml,
    whatsappText,
    orientation: 'portrait',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 2. RESUMO GERAL (DRE GERENCIAL)
 */
export function buildResumoDreReport(params: {
  companyProfile: CompanyProfile;
  orders: SilageOrder[];
  services: ServiceOrder[];
  expenses: Expense[];
  startDate: string;
  endDate: string;
  competence: string;
}): ReportPrintConfig {
  const { companyProfile, orders, services, expenses, startDate, endDate, competence } = params;
  const seg = resolveReportSegmentContext(companyProfile);
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const filteredOrders = (orders || []).filter(
    (o) => o?.deliveryDate && o.deliveryDate >= startDate && o.deliveryDate <= endDate && o.status !== 'cancelado'
  );
  const filteredServices = (services || []).filter(
    (s) => s?.startDate && s.startDate >= startDate && s.startDate <= endDate && s.status !== 'cancelado'
  );
  const filteredExpenses = (expenses || []).filter(
    (e) => e?.dueDate && e.dueDate >= startDate && e.dueDate <= endDate
  );

  const ordersRevenue = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const servicesRevenue = filteredServices.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const grossRevenue = ordersRevenue + servicesRevenue;

  const cats = classifyDreExpenses(filteredExpenses);
  const totalExpenses = cats.total;
  const netResult = grossRevenue - totalExpenses;
  const marginPercent = grossRevenue > 0 ? (netResult / grossRevenue) * 100 : 0;
  const pctOfRev = (v: number) => (grossRevenue > 0 ? ((v / grossRevenue) * 100).toFixed(1) : '0.0');

  const kpiHtml = renderSummaryCardsRow([
    { label: 'Receita Operacional Bruta', value: formatCurrencyBRL(grossRevenue), color: '#047857' },
    { label: 'Custos e Despesas Totais', value: formatCurrencyBRL(totalExpenses), color: '#b91c1c' },
    {
      label: 'Resultado Líquido (Margem)',
      value: `${formatCurrencyBRL(netResult)} (${marginPercent.toFixed(1)}%)`,
      color: netResult >= 0 ? '#0369a1' : '#b91c1c',
    },
  ]);

  const contentHtml = `
    ${kpiHtml}
    <table>
      <thead>
        <tr>
          <th>Conta / Descritivo Contábil</th>
          <th style="text-align:right;width:160px;">Valor Realizado</th>
          <th style="text-align:right;width:85px;">% Rec.</th>
        </tr>
      </thead>
      <tbody>
        <tr style="font-weight:bold;background:#ecfdf5;">
          <td>(+) ${escapeHtml(seg.ordersRevenueLabel.toUpperCase())}</td>
          <td style="text-align:right;color:#047857;">${formatCurrencyBRL(ordersRevenue)}</td>
          <td style="text-align:right;">${pctOfRev(ordersRevenue)}%</td>
        </tr>
        <tr style="font-weight:bold;background:#ecfdf5;">
          <td>(+) ${escapeHtml(seg.servicesRevenueLabel.toUpperCase())}</td>
          <td style="text-align:right;color:#047857;">${formatCurrencyBRL(servicesRevenue)}</td>
          <td style="text-align:right;">${pctOfRev(servicesRevenue)}%</td>
        </tr>
        <tr style="font-weight:900;background:#e2e8f0;">
          <td>(=) RECEITA OPERACIONAL BRUTA</td>
          <td style="text-align:right;color:#047857;">${formatCurrencyBRL(grossRevenue)}</td>
          <td style="text-align:right;">100.0%</td>
        </tr>
        <tr>
          <td style="padding-left:20px;">(-) ${escapeHtml(seg.dreCategoryLabels.fuel)}</td>
          <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(cats.fuel)}</td>
          <td style="text-align:right;">${pctOfRev(cats.fuel)}%</td>
        </tr>
        <tr>
          <td style="padding-left:20px;">(-) ${escapeHtml(seg.dreCategoryLabels.maintenance)}</td>
          <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(cats.maintenance)}</td>
          <td style="text-align:right;">${pctOfRev(cats.maintenance)}%</td>
        </tr>
        <tr>
          <td style="padding-left:20px;">(-) ${escapeHtml(seg.dreCategoryLabels.inputs)}</td>
          <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(cats.inputs)}</td>
          <td style="text-align:right;">${pctOfRev(cats.inputs)}%</td>
        </tr>
        <tr>
          <td style="padding-left:20px;">(-) ${escapeHtml(seg.dreCategoryLabels.labor)}</td>
          <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(cats.labor)}</td>
          <td style="text-align:right;">${pctOfRev(cats.labor)}%</td>
        </tr>
        <tr>
          <td style="padding-left:20px;">(-) ${escapeHtml(seg.dreCategoryLabels.packaging)}</td>
          <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(cats.packaging)}</td>
          <td style="text-align:right;">${pctOfRev(cats.packaging)}%</td>
        </tr>
        <tr>
          <td style="padding-left:20px;">(-) ${escapeHtml(seg.dreCategoryLabels.freight)}</td>
          <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(cats.freight)}</td>
          <td style="text-align:right;">${pctOfRev(cats.freight)}%</td>
        </tr>
        <tr>
          <td style="padding-left:20px;">(-) ${escapeHtml(seg.dreCategoryLabels.other)}</td>
          <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(cats.other)}</td>
          <td style="text-align:right;">${pctOfRev(cats.other)}%</td>
        </tr>
        <tr style="font-weight:900;background:#dcfce7;font-size:10.5pt;border-top:2px solid #047857;">
          <td>(=) RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO OPERACIONAL)</td>
          <td style="text-align:right;color:${netResult >= 0 ? '#047857' : '#b91c1c'};">${formatCurrencyBRL(netResult)}</td>
          <td style="text-align:right;color:${netResult >= 0 ? '#047857' : '#b91c1c'};">${marginPercent.toFixed(1)}%</td>
        </tr>
      </tbody>
    </table>
  `;

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *DRE GERENCIAL OPERACIONAL*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `💰 *RECEITA BRUTA:* ${formatCurrencyBRL(grossRevenue)}\n` +
    `  • ${seg.ordersRevenueLabel}: ${formatCurrencyBRL(ordersRevenue)}\n` +
    `  • ${seg.servicesRevenueLabel}: ${formatCurrencyBRL(servicesRevenue)}\n\n` +
    `💸 *DESPESAS OPERACIONAIS:* ${formatCurrencyBRL(totalExpenses)}\n` +
    `  • Combustível: ${formatCurrencyBRL(cats.fuel)}\n` +
    `  • Manutenção & Peças: ${formatCurrencyBRL(cats.maintenance)}\n` +
    `  • Insumos / Suprimentos: ${formatCurrencyBRL(cats.inputs)}\n` +
    `  • Mão de Obra: ${formatCurrencyBRL(cats.labor)}\n` +
    `  • Outros Custos: ${formatCurrencyBRL(cats.packaging + cats.freight + cats.other)}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🟢 *RESULTADO LÍQUIDO:* ${formatCurrencyBRL(netResult)}\n` +
    `📈 *Margem Líquida:* ${marginPercent.toFixed(1)}%`;

  return {
    title: 'Demonstrativo do Resultado do Exercício (DRE Gerencial)',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'DRE GERENCIAL',
    contentHtml,
    whatsappText,
    orientation: 'portrait',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 3. ATIVO IMOBILIZADO (INVENTÁRIO & IPVA)
 */
export function buildAtivoImobilizadoReport(params: {
  companyProfile: CompanyProfile;
  filteredVehicles: Machinery[];
  allMachineries: Machinery[];
  competence: string;
  searchTerm?: string;
  filterCategory?: string;
  filterOwnership?: string;
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredVehicles,
    allMachineries,
    competence,
    searchTerm = '',
    filterCategory = 'todos',
    filterOwnership = 'todos',
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  let fipeSum = 0;
  let ipvaBaseSum = 0;
  let ipvaTotalSum = 0;
  let licSum = 0;
  let ipvaLancadosCount = 0;
  let ipvaPendentesCount = 0;
  let licPendentesCount = 0;

  filteredVehicles.forEach((v) => {
    const fipe = v.fipeValue || 0;
    const baseVenal = v.ipvaBaseValue || 0;
    const rate = v.ipvaRatePercent || 0;
    const calcIpva = v.ipvaTotalAmount || (baseVenal > 0 && rate > 0 ? baseVenal * (rate / 100) : 0);
    const lic = v.licensingValue || 0;

    fipeSum += fipe;
    ipvaBaseSum += baseVenal;
    ipvaTotalSum += calcIpva;
    licSum += lic;

    if (v.ipvaFinancialStatus === 'lancado') ipvaLancadosCount += 1;
    else if (calcIpva > 0) ipvaPendentesCount += 1;

    if (v.licensingFinancialStatus !== 'lancado' && (v.licensePlateOrSerial || lic > 0)) {
      licPendentesCount += 1;
    }
  });

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Categoria', value: filterCategory },
    { label: 'Regime', value: filterOwnership },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Capital Imobilizado (FIPE)',
      value: formatCurrencyBRL(fipeSum),
      sub: `${filteredVehicles.length} veículo(s) filtrado(s) de ${allMachineries.length}`,
      color: '#0963cb',
    },
    {
      label: 'Total IPVA Projetado',
      value: formatCurrencyBRL(ipvaTotalSum),
      sub: `${ipvaLancadosCount} lançado(s) • ${ipvaPendentesCount} pendente(s)`,
      color: '#d97706',
    },
    {
      label: 'Licenciamento Total',
      value: formatCurrencyBRL(licSum),
      sub: `${licPendentesCount} licenciamento(s) pendente(s)`,
      color: '#059669',
    },
  ]);

  const rowsHtml =
    filteredVehicles.length > 0
      ? filteredVehicles
          .map((v) => {
            const fipeVal = v.fipeValue ? formatCurrencyBRL(v.fipeValue) : '--';
            const baseVenal = v.ipvaBaseValue ? formatCurrencyBRL(v.ipvaBaseValue) : '--';
            const rateStr = v.ipvaRatePercent ? `${v.ipvaRatePercent}%` : '--';
            const calcIpva =
              v.ipvaTotalAmount ||
              (v.ipvaBaseValue && v.ipvaRatePercent ? v.ipvaBaseValue * (v.ipvaRatePercent / 100) : 0);
            const ipvaVal = calcIpva > 0 ? formatCurrencyBRL(calcIpva) : 'R$ 0,00';
            const licVal = v.licensingValue ? formatCurrencyBRL(v.licensingValue) : '--';

            const ipvaStatusBadge =
              v.ipvaFinancialStatus === 'lancado'
                ? '<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:8pt;">Lançado</span>'
                : calcIpva > 0
                ? '<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:8pt;">Pendente</span>'
                : '<span style="color:#64748b;font-size:8pt;">Isento / --</span>';

            return `
              <tr style="font-size:8.5pt;">
                <td style="text-align:center;font-weight:800;font-family:monospace;">${escapeHtml(v.fleetNumber || '--')}</td>
                <td style="font-weight:700;font-family:monospace;">${escapeHtml((v.licensePlateOrSerial || '--').toUpperCase())}</td>
                <td>
                  <strong style="text-transform:uppercase;">${escapeHtml(v.brand || '')} ${escapeHtml(v.model || v.name || '')}</strong>
                  <div style="font-size:7.5pt;color:#64748b;">
                    ${v.year ? `Ano: ${escapeHtml(v.year)} • ` : ''}${v.renavam ? `Renavam: ${escapeHtml(v.renavam)} • ` : ''}${v.ownership === 'proprio' ? 'Próprio' : escapeHtml(v.ownership || 'Próprio')}
                  </div>
                </td>
                <td style="text-align:right;font-weight:700;">${fipeVal}</td>
                <td style="text-align:right;">${baseVenal}</td>
                <td style="text-align:center;">${rateStr}</td>
                <td style="text-align:right;font-weight:800;color:#0963cb;">${ipvaVal}</td>
                <td style="text-align:right;">${licVal}</td>
                <td style="text-align:center;">${ipvaStatusBadge}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="9" style="text-align:center;padding:16px;color:#64748b;">Nenhum veículo encontrado com os filtros selecionados.</td></tr>`;

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:60px;">Nº Frota</th>
          <th style="width:90px;">Placa / Série</th>
          <th>Veículo / Modelo</th>
          <th style="text-align:right;width:105px;">Valor FIPE</th>
          <th style="text-align:right;width:105px;">Base IPVA</th>
          <th style="text-align:center;width:55px;">Alíq.</th>
          <th style="text-align:right;width:95px;">Total IPVA</th>
          <th style="text-align:right;width:85px;">Licenc.</th>
          <th style="text-align:center;width:85px;">Status Fin.</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr style="background:#f1f5f9;border-top:2px solid #0963cb;font-weight:900;">
          <td colspan="3" style="text-align:right;text-transform:uppercase;">Totais (${filteredVehicles.length} veículos):</td>
          <td style="text-align:right;color:#0963cb;">${formatCurrencyBRL(fipeSum)}</td>
          <td style="text-align:right;">${formatCurrencyBRL(ipvaBaseSum)}</td>
          <td style="text-align:center;">--</td>
          <td style="text-align:right;color:#0963cb;">${formatCurrencyBRL(ipvaTotalSum)}</td>
          <td style="text-align:right;">${formatCurrencyBRL(licSum)}</td>
          <td style="text-align:center;">--</td>
        </tr>
      </tfoot>
    </table>
  `;

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *INVENTÁRIO DE ATIVO IMOBILIZADO, FIPE & IPVA*\n` +
    `📅 *Referência:* Competência ${competence}\n\n` +
    `🚜 *Veículos Filtrados:* ${filteredVehicles.length}\n` +
    `🏛️ *Capital Imobilizado (FIPE):* ${formatCurrencyBRL(fipeSum)}\n` +
    `💰 *IPVA Total Projetado:* ${formatCurrencyBRL(ipvaTotalSum)}\n` +
    `📋 *Licenciamento Total:* ${formatCurrencyBRL(licSum)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `Gerado via ${SYSTEM_NAME}`;

  return {
    title: 'Relatório Patrimonial — Ativo Imobilizado, FIPE & IPVA',
    subtitle: `Inventário da frota, valor de mercado FIPE, base venal e licenciamento • Competência ${competence}`,
    documentType: 'INVENTÁRIO & IPVA',
    contentHtml,
    whatsappText,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 4. CORTES / PRESTAÇÃO DE SERVIÇOS
 */
export function buildCortesServicesReport(params: {
  companyProfile: CompanyProfile;
  filteredServices: ServiceOrder[];
  startDate: string;
  endDate: string;
  competence: string;
  searchTerm?: string;
  filterType?: string;
  viewMode?: ReportViewMode;
  groupByLabel?: string;
  syntheticRows?: SyntheticSummaryRow[];
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredServices,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    filterType = 'todos',
    viewMode = 'analitico',
    groupByLabel = 'Cliente / Produtor',
    syntheticRows,
  } = params;
  const seg = resolveReportSegmentContext(companyProfile);
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalHectares = filteredServices.reduce((s, item) => s + (item.areaHectares || 0), 0);
  const totalTons = filteredServices.reduce((s, item) => s + (item.tonsEstimated || 0), 0);
  const totalRevenue = filteredServices.reduce((s, item) => s + (item.totalAmount || 0), 0);
  const avgPerHa = totalHectares > 0 ? totalRevenue / totalHectares : 0;

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Formato', value: viewMode === 'sintetico' ? `Sintético (${groupByLabel})` : 'Analítico (Detalhado)' },
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Tipo de Serviço', value: filterType },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Serviços Executados',
      value: `${filteredServices.length} ordem(ns)`,
      sub: `${filteredServices.filter((s) => s.status === 'concluido').length} concluído(s)`,
      color: '#0f766e',
    },
    {
      label: 'Área Total Atendida',
      value: `${totalHectares.toFixed(1)} ha`,
      sub: totalHectares > 0 ? `Média R$/ha: ${formatCurrencyBRL(avgPerHa)}` : 'Sem área informada',
      color: '#0369a1',
    },
    {
      label: 'Volume / Produção Est.',
      value: `${totalTons.toFixed(1)} ton`,
      sub: totalHectares > 0 ? `Média: ${(totalTons / totalHectares).toFixed(1)} ton/ha` : 'Volume acumulado',
      color: '#047857',
    },
    {
      label: 'Faturamento Total',
      value: formatCurrencyBRL(totalRevenue),
      sub: 'Receita de serviços filtrados',
      color: '#047857',
    },
  ]);

  const resolvedSynthetic =
    syntheticRows ||
    buildSyntheticSummaryRows(
      filteredServices,
      (s) => s.clientName || 'Cliente N/I',
      (s) => s.totalAmount || 0,
      {
        getSecondarySum: (s) => s.areaHectares || 0,
        formatSecondary: (ha) => `${ha.toFixed(1)} ha`,
      }
    );

  const tableHtml =
    viewMode === 'sintetico'
      ? renderSyntheticTableHtml({
          groupColumnLabel: groupByLabel,
          secondaryColumnLabel: 'Área Total (ha)',
          rows: resolvedSynthetic,
          totalLabel: 'Total Consolidado',
          accentColor: '#047857',
          emptyText: seg.servicesEmptyText,
        })
      : (() => {
          const rowsHtml =
            filteredServices.length > 0
              ? filteredServices
                  .map(
                    (item) => `
                  <tr style="font-size:8.5pt;">
                    <td style="white-space:nowrap;">${formatDateBR(item.startDate)}</td>
                    <td style="font-weight:700;">${escapeHtml(item.clientName)}</td>
                    <td>${escapeHtml(item.farmName || '-')}</td>
                    <td>${escapeHtml(item.serviceType)}</td>
                    <td style="text-align:right;font-weight:700;">${item.areaHectares ? `${Number(item.areaHectares).toFixed(1)} ha` : '-'}</td>
                    <td style="text-align:right;color:#047857;font-weight:600;">${item.tonsEstimated ? `${Number(item.tonsEstimated).toFixed(1)} t` : '-'}</td>
                    <td>${escapeHtml(item.machineryAssigned || '-')}</td>
                    <td style="text-align:right;font-weight:800;">${formatCurrencyBRL(item.totalAmount || 0)}</td>
                    <td style="text-align:center;text-transform:uppercase;font-size:7.5pt;font-weight:700;">${escapeHtml(item.status)}</td>
                  </tr>
                `
                  )
                  .join('')
              : `<tr><td colspan="9" style="text-align:center;padding:16px;color:#64748b;">${escapeHtml(seg.servicesEmptyText)}</td></tr>`;

          return `
            <table>
              <thead>
                <tr>
                  <th style="width:80px;">Data</th>
                  <th>Cliente / Produtor</th>
                  <th>Local / Fazenda</th>
                  <th>Serviço</th>
                  <th style="text-align:right;width:75px;">Área (ha)</th>
                  <th style="text-align:right;width:85px;">Volume (t)</th>
                  <th>Máquina / Equip.</th>
                  <th style="text-align:right;width:105px;">Total (R$)</th>
                  <th style="text-align:center;width:80px;">Status</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#f1f5f9;border-top:2px solid #0f766e;font-weight:900;">
                  <td colspan="4" style="text-align:right;text-transform:uppercase;">Totais (${filteredServices.length} serviços):</td>
                  <td style="text-align:right;">${totalHectares.toFixed(1)} ha</td>
                  <td style="text-align:right;color:#047857;">${totalTons.toFixed(1)} t</td>
                  <td>--</td>
                  <td style="text-align:right;color:#047857;">${formatCurrencyBRL(totalRevenue)}</td>
                  <td style="text-align:center;">--</td>
                </tr>
              </tfoot>
            </table>
          `;
        })();

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
    ${tableHtml}
  `;

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO ${viewMode === 'sintetico' ? 'SINTÉTICO' : 'ANALÍTICO'} DE SERVIÇOS*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `📋 *Ordens Filtradas:* ${filteredServices.length}\n` +
    `🌾 *Área Total:* ${totalHectares.toFixed(1)} ha\n` +
    `⚖️ *Volume Estimado:* ${totalTons.toFixed(1)} ton\n` +
    `💰 *Faturamento Total:* ${formatCurrencyBRL(totalRevenue)}`;

  return {
    title: `${seg.servicesDocTitle}${viewMode === 'sintetico' ? ' (Sintético)' : ''}`,
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'RELATÓRIO DE SERVIÇOS',
    contentHtml,
    whatsappText,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 5. VENDAS & FATURAMENTO
 */
export function buildVendasReport(params: {
  companyProfile: CompanyProfile;
  filteredOrders: SilageOrder[];
  startDate: string;
  endDate: string;
  competence: string;
  searchTerm?: string;
  productFilter?: string;
  viewMode?: ReportViewMode;
  groupByLabel?: string;
  syntheticRows?: SyntheticSummaryRow[];
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredOrders,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    productFilter = 'todos',
    viewMode = 'analitico',
    groupByLabel = 'Cliente / Produtor',
    syntheticRows,
  } = params;
  const seg = resolveReportSegmentContext(companyProfile);
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalRevenue = filteredOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalTons = filteredOrders.reduce((s, o) => s + (o.tons || 0), 0);
  const avgPricePerTon = totalTons > 0 ? totalRevenue / totalTons : 0;
  const ticketMedio = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
  const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'pago');
  const pendingOrders = filteredOrders.filter((o) => o.paymentStatus !== 'pago');
  const paidAmount = paidOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const pendingAmount = pendingOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Formato', value: viewMode === 'sintetico' ? `Sintético (${groupByLabel})` : 'Analítico (Detalhado)' },
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Produto', value: productFilter },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Total Faturado',
      value: formatCurrencyBRL(totalRevenue),
      sub: `${filteredOrders.length} pedido(s) • Ticket Médio: ${formatCurrencyBRL(ticketMedio)}`,
      color: '#047857',
    },
    {
      label: 'Volume / Tonelagem Total',
      value: `${totalTons.toFixed(1)} ton`,
      sub: `Preço Médio / Ton: ${formatCurrencyBRL(avgPricePerTon)}`,
      color: '#0369a1',
    },
    {
      label: 'Recebido (Pago)',
      value: formatCurrencyBRL(paidAmount),
      sub: `${paidOrders.length} pedido(s) quitado(s)`,
      color: '#059669',
    },
    {
      label: 'A Receber / Pendente',
      value: formatCurrencyBRL(pendingAmount),
      sub: `${pendingOrders.length} pedido(s) pendente(s)/parciais`,
      color: '#d97706',
    },
  ]);

  const resolvedSynthetic =
    syntheticRows ||
    buildSyntheticSummaryRows(
      filteredOrders,
      (o) => o.clientName || 'Cliente N/I',
      (o) => o.totalAmount || 0,
      {
        getSecondarySum: (o) => o.tons || 0,
        formatSecondary: (t) => `${t.toFixed(1)} t`,
        getPaidAmount: (o) => (o.paymentStatus === 'pago' ? o.totalAmount || 0 : 0),
        getPendingAmount: (o) => (o.paymentStatus !== 'pago' ? o.totalAmount || 0 : 0),
      }
    );

  const tableHtml =
    viewMode === 'sintetico'
      ? renderSyntheticTableHtml({
          groupColumnLabel: groupByLabel,
          secondaryColumnLabel: 'Volume (t)',
          showPaidBreakdown: true,
          rows: resolvedSynthetic,
          totalLabel: 'Total Consolidado de Vendas',
          accentColor: '#047857',
          emptyText: seg.ordersEmptyText,
        })
      : (() => {
          const rowsHtml =
            filteredOrders.length > 0
              ? filteredOrders
                  .map(
                    (item) => `
                  <tr style="font-size:8.5pt;">
                    <td style="white-space:nowrap;">${formatDateBR(item.deliveryDate)}</td>
                    <td style="font-family:monospace;">${escapeHtml(item.orderNumber || item.id)}</td>
                    <td>
                      <strong>${escapeHtml(item.clientName)}</strong>
                      ${item.farmName ? `<div style="font-size:7.5pt;color:#64748b;">${escapeHtml(item.farmName)}</div>` : ''}
                    </td>
                    <td>${escapeHtml(item.productType)}</td>
                    <td style="text-align:right;font-weight:700;">${Number(item.tons || 0).toFixed(1)} t</td>
                    <td style="text-align:right;">${formatCurrencyBRL(item.pricePerTon || 0)}</td>
                    <td style="text-align:center;text-transform:uppercase;font-size:7.5pt;">${escapeHtml(item.freightType || '-')}</td>
                    <td style="text-align:right;font-weight:800;color:#047857;">${formatCurrencyBRL(item.totalAmount || 0)}</td>
                    <td style="text-align:center;text-transform:uppercase;font-size:7.5pt;font-weight:700;">${escapeHtml(item.paymentStatus)}</td>
                  </tr>
                `
                  )
                  .join('')
              : `<tr><td colspan="9" style="text-align:center;padding:16px;color:#64748b;">${escapeHtml(seg.ordersEmptyText)}</td></tr>`;

          return `
            <table>
              <thead>
                <tr>
                  <th style="width:80px;">Entrega</th>
                  <th style="width:75px;">Pedido</th>
                  <th>Cliente / Local</th>
                  <th>${escapeHtml(seg.ordersProductColLabel)}</th>
                  <th style="text-align:right;width:80px;">Volume (t)</th>
                  <th style="text-align:right;width:90px;">R$ / Ton</th>
                  <th style="text-align:center;width:65px;">Frete</th>
                  <th style="text-align:right;width:110px;">Total Faturado</th>
                  <th style="text-align:center;width:85px;">Pagto.</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#f1f5f9;border-top:2px solid #047857;font-weight:900;">
                  <td colspan="4" style="text-align:right;text-transform:uppercase;">Totais (${filteredOrders.length} pedidos • Ticket Médio ${formatCurrencyBRL(ticketMedio)}):</td>
                  <td style="text-align:right;">${totalTons.toFixed(1)} t</td>
                  <td style="text-align:right;">${formatCurrencyBRL(avgPricePerTon)}</td>
                  <td style="text-align:center;">--</td>
                  <td style="text-align:right;color:#047857;">${formatCurrencyBRL(totalRevenue)}</td>
                  <td style="text-align:center;font-size:7.5pt;">${paidOrders.length}P / ${pendingOrders.length}A</td>
                </tr>
              </tfoot>
            </table>
          `;
        })();

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
    ${tableHtml}
  `;

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO ${viewMode === 'sintetico' ? 'SINTÉTICO' : 'ANALÍTICO'} DE VENDAS*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `🛒 *Pedidos:* ${filteredOrders.length}\n` +
    `⚖️ *Volume Total:* ${totalTons.toFixed(1)} ton\n` +
    `💰 *Faturamento Total:* ${formatCurrencyBRL(totalRevenue)}\n` +
    `🎯 *Ticket Médio:* ${formatCurrencyBRL(ticketMedio)}\n` +
    `✅ *Pago:* ${formatCurrencyBRL(paidAmount)} (${paidOrders.length}) | ⏳ *Pendente:* ${formatCurrencyBRL(pendingAmount)} (${pendingOrders.length})`;

  return {
    title:
      viewMode === 'sintetico'
        ? `Relatório Sintético de Vendas & Faturamento (${groupByLabel})`
        : 'Relatório Analítico de Vendas & Faturamento',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'RELATÓRIO DE VENDAS',
    contentHtml,
    whatsappText,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 6. DESPESAS & CUSTOS
 */
export function buildDespesasReport(params: {
  companyProfile: CompanyProfile;
  filteredExpenses: Expense[];
  startDate: string;
  endDate: string;
  competence: string;
  searchTerm?: string;
  selectedCategory?: string;
  selectedStatus?: string;
  viewMode?: ReportViewMode;
  groupByLabel?: string;
  syntheticRows?: SyntheticSummaryRow[];
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredExpenses,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    selectedCategory = 'todas',
    selectedStatus = 'todos',
    viewMode = 'analitico',
    groupByLabel = 'Categoria',
    syntheticRows,
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalAmount = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const paidItems = filteredExpenses.filter((e) => e.status === 'pago');
  const pendingItems = filteredExpenses.filter((e) => e.status !== 'pago');
  const paidAmount = paidItems.reduce((s, e) => s + (e.amount || 0), 0);
  const pendingAmount = pendingItems.reduce((s, e) => s + (e.amount || 0), 0);

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Formato', value: viewMode === 'sintetico' ? `Sintético (${groupByLabel})` : 'Analítico (Detalhado)' },
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Categoria', value: selectedCategory },
    { label: 'Status', value: selectedStatus },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Total Geral de Despesas',
      value: formatCurrencyBRL(totalAmount),
      sub: `${filteredExpenses.length} lançamento(s) filtrado(s)`,
      color: '#b91c1c',
    },
    {
      label: 'Total Pago (Quitado)',
      value: formatCurrencyBRL(paidAmount),
      sub: `${paidItems.length} conta(s) quitada(s)`,
      color: '#047857',
    },
    {
      label: 'Total Pendente / A Pagar',
      value: formatCurrencyBRL(pendingAmount),
      sub: `${pendingItems.length} pendência(s)`,
      color: '#d97706',
    },
  ]);

  const resolvedSynthetic =
    syntheticRows ||
    buildSyntheticSummaryRows(
      filteredExpenses,
      (e) => e.categoryName || 'Outras Despesas',
      (e) => e.amount || 0,
      {
        getPaidAmount: (e) => (e.status === 'pago' ? e.amount || 0 : 0),
        getPendingAmount: (e) => (e.status !== 'pago' ? e.amount || 0 : 0),
      }
    );

  const bodyHtml =
    viewMode === 'sintetico'
      ? renderSyntheticTableHtml({
          groupColumnLabel: groupByLabel,
          showPaidBreakdown: true,
          rows: resolvedSynthetic,
          totalLabel: 'Total Consolidado de Despesas',
          accentColor: '#b91c1c',
          emptyText: 'Nenhuma despesa localizada no período e filtros selecionados.',
        })
      : (() => {
          const catTableHtml =
            resolvedSynthetic.length > 0
              ? `
              <h4 style="font-size: 9.5pt; font-weight: 800; color: #0f172a; margin: 8px 0 6px 0; text-transform: uppercase;">
                Resumo por Categoria de Custo
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th style="text-align:center;width:60px;">Qtd</th>
                    <th style="text-align:right;width:120px;">Pago (R$)</th>
                    <th style="text-align:right;width:120px;">Pendente (R$)</th>
                    <th style="text-align:right;width:125px;">Total (R$)</th>
                    <th style="text-align:right;width:70px;">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${resolvedSynthetic
                    .map(
                      (stats) => `
                        <tr style="font-size:8.5pt;">
                          <td style="font-weight:700;">${escapeHtml(stats.groupKey)}</td>
                          <td style="text-align:center;">${stats.count}</td>
                          <td style="text-align:right;color:#047857;">${formatCurrencyBRL(stats.paidAmount || 0)}</td>
                          <td style="text-align:right;color:#b45309;">${formatCurrencyBRL(stats.pendingAmount || 0)}</td>
                          <td style="text-align:right;font-weight:800;color:#b91c1c;">${formatCurrencyBRL(stats.totalAmount)}</td>
                          <td style="text-align:right;">${stats.sharePct.toFixed(1)}%</td>
                        </tr>
                      `
                    )
                    .join('')}
                </tbody>
              </table>
            `
              : '';

          const rowsHtml =
            filteredExpenses.length > 0
              ? filteredExpenses
                  .map(
                    (item) => `
                  <tr style="font-size:8.5pt;">
                    <td style="white-space:nowrap;">${formatDateBR(item.dueDate)}</td>
                    <td style="font-weight:700;">${escapeHtml(item.description)}</td>
                    <td>${escapeHtml(item.categoryName || '-')}</td>
                    <td>${escapeHtml(item.supplier || '-')}</td>
                    <td>${escapeHtml(item.costCenterName || '-')}</td>
                    <td>${escapeHtml(item.machineryName || '-')}</td>
                    <td style="text-align:right;font-weight:800;color:#b91c1c;white-space:nowrap;">${formatCurrencyBRL(item.amount || 0)}</td>
                    <td style="text-align:center;text-transform:uppercase;font-size:7.5pt;font-weight:700;">${escapeHtml(item.status)}</td>
                  </tr>
                `
                  )
                  .join('')
              : `<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;">Nenhuma despesa localizada no período e filtros selecionados.</td></tr>`;

          return `
            ${catTableHtml}
            <h4 style="font-size: 9.5pt; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; text-transform: uppercase;">
              Detalhamento dos Lançamentos
            </h4>
            <table>
              <thead>
                <tr>
                  <th style="width:80px;">Vencimento</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Fornecedor</th>
                  <th>Centro de Custo</th>
                  <th>Máquina / Veículo</th>
                  <th style="text-align:right;width:105px;">Valor (R$)</th>
                  <th style="text-align:center;width:85px;">Status</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#f1f5f9;border-top:2px solid #b91c1c;font-weight:900;">
                  <td colspan="6" style="text-align:right;text-transform:uppercase;">
                    Totais (${filteredExpenses.length} lançamentos • Pago: ${formatCurrencyBRL(paidAmount)} • Pendente: ${formatCurrencyBRL(pendingAmount)}):
                  </td>
                  <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(totalAmount)}</td>
                  <td style="text-align:center;">--</td>
                </tr>
              </tfoot>
            </table>
          `;
        })();

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
    ${bodyHtml}
  `;

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO ${viewMode === 'sintetico' ? 'SINTÉTICO' : 'ANALÍTICO'} DE DESPESAS*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `💸 *Total Geral:* ${formatCurrencyBRL(totalAmount)} (${filteredExpenses.length} lançamentos)\n` +
    `✅ *Total Pago:* ${formatCurrencyBRL(paidAmount)} (${paidItems.length})\n` +
    `⏳ *Total Pendente:* ${formatCurrencyBRL(pendingAmount)} (${pendingItems.length})`;

  return {
    title:
      viewMode === 'sintetico'
        ? `Relatório Sintético de Despesas & Custos (${groupByLabel})`
        : 'Relatório Analítico de Despesas & Custos',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'RELATÓRIO DE DESPESAS',
    contentHtml,
    whatsappText,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 7. CONSUMO DE COMBUSTÍVEL & EFICIÊNCIA
 */
export interface MachineryFuelSummaryStat {
  id?: string;
  name: string;
  liters: number;
  totalCost: number;
  count: number;
  isMachine: boolean;
  avgEfficiencyText: string | null;
}

export function buildConsumoReport(params: {
  companyProfile: CompanyProfile;
  filteredLogs: FuelLog[];
  machineryStats: MachineryFuelSummaryStat[];
  machineries: Machinery[];
  startDate: string;
  endDate: string;
  competence: string;
  searchTerm?: string;
  selectedVehicleLabel?: string;
  fuelTypeFilter?: string;
  viewMode?: ReportViewMode;
  groupByLabel?: string;
  syntheticRows?: SyntheticSummaryRow[];
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredLogs,
    machineryStats,
    machineries,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    selectedVehicleLabel = 'todos',
    fuelTypeFilter = 'todos',
    viewMode = 'analitico',
    groupByLabel = 'Veículo / Máquina',
    syntheticRows,
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalLiters = filteredLogs.reduce((s, l) => s + (l.liters || 0), 0);
  const totalAmount = filteredLogs.reduce((s, l) => s + (l.totalAmount || 0), 0);
  const avgPricePerLiter = totalLiters > 0 ? totalAmount / totalLiters : 0;

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Formato', value: viewMode === 'sintetico' ? `Sintético (${groupByLabel})` : 'Analítico (Detalhado)' },
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Veículo', value: selectedVehicleLabel },
    { label: 'Combustível', value: fuelTypeFilter },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Abastecimentos',
      value: `${filteredLogs.length} registro(s)`,
      sub: `${machineryStats.length} equipamento(s)/veículo(s)`,
      color: '#0369a1',
    },
    {
      label: 'Litros Totais Consumidos',
      value: `${totalLiters.toFixed(1)} L`,
      sub: 'Volume consolidado no período',
      color: '#d97706',
    },
    {
      label: 'Preço Médio / Litro',
      value: formatCurrencyBRL(avgPricePerLiter),
      sub: 'Média ponderada por litro',
      color: '#0f766e',
    },
    {
      label: 'Custo Total de Combustível',
      value: formatCurrencyBRL(totalAmount),
      sub: 'Despesa total de abastecimento',
      color: '#b91c1c',
    },
  ]);

  const summaryByVehicleHtml =
    machineryStats.length > 0
      ? `
      <h4 style="font-size: 9.5pt; font-weight: 800; color: #0f172a; margin: 8px 0 6px 0; text-transform: uppercase;">
        Resumo Consolidado por Veículo / Máquina e Média de Consumo
      </h4>
      <table>
        <thead>
          <tr>
            <th>Veículo / Máquina</th>
            <th style="text-align:center;width:110px;">Tipo Controle</th>
            <th style="text-align:center;width:80px;">Abastec.</th>
            <th style="text-align:right;width:105px;">Litros Totais</th>
            <th style="text-align:right;width:115px;">Média Consumo</th>
            <th style="text-align:right;width:120px;">Custo Total (R$)</th>
          </tr>
        </thead>
        <tbody>
          ${machineryStats
            .map(
              (m) => `
              <tr style="font-size:8.5pt;">
                <td style="font-weight:700;">${escapeHtml(m.name)}</td>
                <td style="text-align:center;">${m.isMachine ? 'Horímetro (L/h)' : 'Hodômetro (km/L)'}</td>
                <td style="text-align:center;">${m.count}</td>
                <td style="text-align:right;font-weight:700;color:#b45309;">${m.liters.toFixed(1)} L</td>
                <td style="text-align:right;font-weight:800;color:${m.isMachine ? '#b45309' : '#047857'};">${escapeHtml(m.avgEfficiencyText || '--')}</td>
                <td style="text-align:right;font-weight:800;color:#b91c1c;">${formatCurrencyBRL(m.totalCost)}</td>
              </tr>
            `
            )
            .join('')}
        </tbody>
      </table>
    `
      : '';

  const resolvedSynthetic =
    syntheticRows ||
    buildSyntheticSummaryRows(
      filteredLogs,
      (l) => l.machineryPlateOrName || 'Veículo N/I',
      (l) => l.totalAmount || 0,
      {
        getSecondarySum: (l) => l.liters || 0,
        formatSecondary: (lit) => `${lit.toFixed(1)} L`,
      }
    );

  const detailedOrSyntheticHtml =
    viewMode === 'sintetico'
      ? `
        ${summaryByVehicleHtml}
        <h4 style="font-size: 9.5pt; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; text-transform: uppercase;">
          Participação Agrupada por ${escapeHtml(groupByLabel)}
        </h4>
        ${renderSyntheticTableHtml({
          groupColumnLabel: groupByLabel,
          secondaryColumnLabel: 'Volume (Litros)',
          rows: resolvedSynthetic,
          totalLabel: 'Total Consolidado de Consumo',
          accentColor: '#b91c1c',
          emptyText: 'Nenhum registro de abastecimento localizado no período selecionado.',
        })}
      `
      : (() => {
          const rowsHtml =
            filteredLogs.length > 0
              ? filteredLogs
                  .map((item) => {
                    const vehicle = findVehicleForLog(item, machineries);
                    const readings = getFuelLogReadings(item, vehicle);
                    const dualEff = formatDualFuelLogEfficiency(item, vehicle);

                    const readingText = readings.hasBoth
                      ? `${readings.kmFormatted} / ${readings.hoursFormatted}`
                      : readings.kmFormatted || readings.hoursFormatted || '-';

                    let effText = '-';
                    if (dualEff.hasBoth) {
                      effText = `${dualEff.kmPerLiter?.formatted || ''} / ${dualEff.litersPerHour?.formatted || ''}`;
                    } else if (dualEff.kmPerLiter) {
                      effText = dualEff.kmPerLiter.formatted;
                    } else if (dualEff.litersPerHour) {
                      effText = dualEff.litersPerHour.formatted;
                    } else {
                      const single = formatFuelLogEfficiency(item, vehicle);
                      if (single) effText = single.formatted;
                    }

                    return `
                      <tr style="font-size:8.5pt;">
                        <td style="white-space:nowrap;">${formatDateBR(item.date)}</td>
                        <td style="font-weight:700;">${escapeHtml(item.machineryPlateOrName)}</td>
                        <td>${escapeHtml(item.fuelType)}</td>
                        <td style="text-align:right;font-weight:700;">${Number(item.liters || 0).toFixed(1)} L</td>
                        <td style="text-align:right;">${formatCurrencyBRL(item.pricePerLiter || 0)}</td>
                        <td style="text-align:right;font-weight:800;color:#b91c1c;">${formatCurrencyBRL(item.totalAmount || 0)}</td>
                        <td style="text-align:right;font-family:monospace;">${escapeHtml(readingText)}</td>
                        <td style="text-align:right;font-weight:700;color:#047857;">${escapeHtml(effText)}</td>
                        <td>${escapeHtml(item.driverOrOperator || '-')}</td>
                        <td>${escapeHtml(item.supplierStation || '-')}</td>
                      </tr>
                    `;
                  })
                  .join('')
              : `<tr><td colspan="10" style="text-align:center;padding:16px;color:#64748b;">Nenhum registro de abastecimento localizado no período selecionado.</td></tr>`;

          return `
            ${summaryByVehicleHtml}
            <h4 style="font-size: 9.5pt; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; text-transform: uppercase;">
              Detalhamento de Abastecimentos (${filteredLogs.length} registros)
            </h4>
            <table>
              <thead>
                <tr>
                  <th style="width:75px;">Data</th>
                  <th>Máquina / Veículo</th>
                  <th style="width:90px;">Combustível</th>
                  <th style="text-align:right;width:75px;">Litros</th>
                  <th style="text-align:right;width:75px;">R$/Litro</th>
                  <th style="text-align:right;width:95px;">Total (R$)</th>
                  <th style="text-align:right;width:105px;">Leitura Atual</th>
                  <th style="text-align:right;width:85px;">Média</th>
                  <th>Operador</th>
                  <th>Posto / Local</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#f1f5f9;border-top:2px solid #d97706;font-weight:900;">
                  <td colspan="3" style="text-align:right;text-transform:uppercase;">Totais (${filteredLogs.length} abastecimentos):</td>
                  <td style="text-align:right;">${totalLiters.toFixed(1)} L</td>
                  <td style="text-align:right;">${formatCurrencyBRL(avgPricePerLiter)}</td>
                  <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(totalAmount)}</td>
                  <td colspan="4" style="text-align:center;">--</td>
                </tr>
              </tfoot>
            </table>
          `;
        })();

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
    ${detailedOrSyntheticHtml}
  `;

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO ${viewMode === 'sintetico' ? 'SINTÉTICO' : 'ANALÍTICO'} DE CONSUMO DE COMBUSTÍVEL*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `⛽ *Abastecimentos:* ${filteredLogs.length}\n` +
    `💧 *Litros Totais:* ${totalLiters.toFixed(1)} L\n` +
    `⚖️ *Preço Médio / Litro:* ${formatCurrencyBRL(avgPricePerLiter)}\n` +
    `💸 *Custo Total:* ${formatCurrencyBRL(totalAmount)}`;

  return {
    title:
      viewMode === 'sintetico'
        ? `Relatório Sintético de Consumo & Eficiência (${groupByLabel})`
        : 'Relatório de Consumo de Combustível & Eficiência',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'RELATÓRIO DE CONSUMO',
    contentHtml,
    whatsappText,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 8. FINANCEIRO — CONTAS A PAGAR, CONTAS A RECEBER & CHEQUES
 */
export interface ReceivableReportRow {
  id: string;
  dueDate: string;
  issueDate: string;
  clientName: string;
  originLabel: string;
  description: string;
  paymentMethodLabel: string;
  amount: number;
  originalAmount?: number;
  fineAmount?: number;
  interestAmount?: number;
  discountAmount?: number;
  paidAmount?: number;
  status: 'pago' | 'a_vencer' | 'vencido';
}

export function buildFinanceiroPagarReport(params: {
  companyProfile: CompanyProfile;
  filteredPayables: Expense[];
  startDate: string;
  endDate: string;
  competence: string;
  todayIso: string;
  searchTerm?: string;
  statusFilter?: string;
  viewMode?: ReportViewMode;
  groupByLabel?: string;
  syntheticRows?: SyntheticSummaryRow[];
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredPayables,
    startDate,
    endDate,
    competence,
    todayIso,
    searchTerm = '',
    statusFilter = 'todos',
    viewMode = 'analitico',
    groupByLabel = 'Categoria',
    syntheticRows,
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalOriginal = filteredPayables.reduce(
    (s, e) => s + (Number(e.originalAmount ?? e.amount) || 0),
    0
  );
  const totalCharges = filteredPayables.reduce(
    (s, e) => s + (Number(e.fineAmount) || 0) + (Number(e.interestAmount) || 0),
    0
  );
  const totalDiscounts = filteredPayables.reduce((s, e) => s + (Number(e.discountAmount) || 0), 0);

  const paidItems = filteredPayables.filter((e) => e.status === 'pago');
  const openItems = filteredPayables.filter((e) => e.status !== 'pago' && (!e.dueDate || e.dueDate >= todayIso));
  const overdueItems = filteredPayables.filter((e) => e.status !== 'pago' && e.dueDate && e.dueDate < todayIso);

  const paidAmount = paidItems.reduce((s, e) => s + (Number(e.paidAmount ?? e.amount) || 0), 0);
  const openAmount = openItems.reduce((s, e) => s + (Number(e.originalAmount ?? e.amount) || 0), 0);
  const overdueAmount = overdueItems.reduce((s, e) => s + (Number(e.originalAmount ?? e.amount) || 0), 0);
  const totalAmount = paidAmount + openAmount + overdueAmount;

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Formato', value: viewMode === 'sintetico' ? `Sintético (${groupByLabel})` : 'Analítico (Detalhado)' },
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Status', value: statusFilter },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Total no Período',
      value: formatCurrencyBRL(totalAmount),
      sub: `${filteredPayables.length} título(s) a pagar`,
      color: '#0f172a',
    },
    {
      label: 'Pago / Liquidado (Real)',
      value: formatCurrencyBRL(paidAmount),
      sub: `${paidItems.length} conta(s) liquidada(s)`,
      color: '#047857',
    },
    {
      label: 'Em Aberto (A Vencer)',
      value: formatCurrencyBRL(openAmount),
      sub: `${openItems.length} título(s) no prazo`,
      color: '#d97706',
    },
    {
      label: 'Vencido / Em Atraso',
      value: formatCurrencyBRL(overdueAmount),
      sub: `${overdueItems.length} título(s) vencido(s)`,
      color: '#b91c1c',
    },
  ]);

  const adjustmentKpiHtml = renderSummaryCardsRow([
    {
      label: 'Valor Original (Nominal)',
      value: formatCurrencyBRL(totalOriginal),
      sub: 'Soma base dos títulos',
      color: '#334155',
    },
    {
      label: '(+) Juros e Multas',
      value: formatCurrencyBRL(totalCharges),
      sub: 'Encargos aplicados na baixa',
      color: '#b91c1c',
    },
    {
      label: '(-) Descontos',
      value: formatCurrencyBRL(totalDiscounts),
      sub: 'Abatimentos obtidos',
      color: '#047857',
    },
    {
      label: '(=) Valor Real Pago',
      value: formatCurrencyBRL(paidAmount),
      sub: `${paidItems.length} título(s) efetivado(s)`,
      color: '#0f172a',
    },
  ]);

  const resolvedSynthetic =
    syntheticRows ||
    buildSyntheticSummaryRows(
      filteredPayables,
      (e) => e.categoryName || 'Outras Categorias',
      (e) => (e.status === 'pago' ? Number(e.paidAmount ?? e.amount) || 0 : Number(e.amount) || 0),
      {
        getPaidAmount: (e) => (e.status === 'pago' ? Number(e.paidAmount ?? e.amount) || 0 : 0),
        getPendingAmount: (e) => (e.status !== 'pago' ? Number(e.amount) || 0 : 0),
      }
    );

  const tableHtml =
    viewMode === 'sintetico'
      ? renderSyntheticTableHtml({
          groupColumnLabel: groupByLabel,
          showPaidBreakdown: true,
          rows: resolvedSynthetic,
          totalLabel: 'Total Contas a Pagar',
          accentColor: '#b91c1c',
          emptyText: 'Nenhuma conta a pagar encontrada no período e filtros selecionados.',
        })
      : (() => {
          const rowsHtml =
            filteredPayables.length > 0
              ? filteredPayables
                  .map((e) => {
                    const isOverdue = e.status !== 'pago' && e.dueDate && e.dueDate < todayIso;
                    const statusText = e.status === 'pago' ? 'PAGO' : isOverdue ? 'VENCIDO' : 'EM ABERTO';
                    const statusColor = e.status === 'pago' ? '#047857' : isOverdue ? '#b91c1c' : '#b45309';
                    const origVal = Number(e.originalAmount ?? e.amount) || 0;
                    const chargesVal = (Number(e.fineAmount) || 0) + (Number(e.interestAmount) || 0);
                    const discVal = Number(e.discountAmount) || 0;
                    const realVal = e.status === 'pago' ? (Number(e.paidAmount ?? e.amount) || 0) : 0;
                    return `
                    <tr style="font-size:8pt;">
                      <td style="white-space:nowrap;">${formatDateBR(e.dueDate)}</td>
                      <td style="font-weight:700;">${escapeHtml(e.supplier || 'Fornecedor N/I')}</td>
                      <td>${escapeHtml(e.description)}</td>
                      <td>${escapeHtml(e.categoryName || '-')}</td>
                      <td style="text-transform:uppercase;font-size:7pt;">${escapeHtml(e.paymentMethod || '-')}</td>
                      <td style="text-align:right;font-weight:700;color:#0f172a;">${formatCurrencyBRL(origVal)}</td>
                      <td style="text-align:right;font-weight:600;color:#b91c1c;">${chargesVal > 0 ? `+ ${formatCurrencyBRL(chargesVal)}` : '—'}</td>
                      <td style="text-align:right;font-weight:600;color:#047857;">${discVal > 0 ? `- ${formatCurrencyBRL(discVal)}` : '—'}</td>
                      <td style="text-align:right;font-weight:800;color:#b91c1c;">${e.status === 'pago' ? formatCurrencyBRL(realVal) : '—'}</td>
                      <td style="text-align:center;font-weight:800;color:${statusColor};font-size:7pt;">${statusText}</td>
                    </tr>
                  `;
                  })
                  .join('')
              : `<tr><td colspan="10" style="text-align:center;padding:16px;color:#64748b;">Nenhuma conta a pagar encontrada no período e filtros selecionados.</td></tr>`;

          return `
            <table>
              <thead>
                <tr>
                  <th style="width:76px;">Vencimento</th>
                  <th>Fornecedor</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th style="width:82px;">Forma Pagto.</th>
                  <th style="text-align:right;width:88px;">Valor Original</th>
                  <th style="text-align:right;width:82px;">(+) Juros/Multa</th>
                  <th style="text-align:right;width:82px;">(-) Desconto</th>
                  <th style="text-align:right;width:92px;">(=) Valor Real Pago</th>
                  <th style="text-align:center;width:72px;">Status</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#f1f5f9;border-top:2px solid #b91c1c;font-weight:900;font-size:8pt;">
                  <td colspan="5" style="text-align:right;text-transform:uppercase;">
                    Totais (${filteredPayables.length} títulos):
                  </td>
                  <td style="text-align:right;color:#0f172a;">${formatCurrencyBRL(totalOriginal)}</td>
                  <td style="text-align:right;color:#b91c1c;">+ ${formatCurrencyBRL(totalCharges)}</td>
                  <td style="text-align:right;color:#047857;">- ${formatCurrencyBRL(totalDiscounts)}</td>
                  <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(paidAmount)}</td>
                  <td style="text-align:center;">--</td>
                </tr>
              </tfoot>
            </table>
          `;
        })();

  return {
    title:
      viewMode === 'sintetico'
        ? `Relatório Sintético de Contas a Pagar (${groupByLabel})`
        : 'Relatório de Contas a Pagar',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'CONTAS A PAGAR',
    contentHtml: `${filtersHtml}${kpiHtml}${adjustmentKpiHtml}${tableHtml}`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `💸 *RELATÓRIO DE CONTAS A PAGAR*\n` +
      `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
      `📌 *Valor Original:* ${formatCurrencyBRL(totalOriginal)} (${filteredPayables.length} títulos)\n` +
      `📈 *(+) Juros e Multas:* ${formatCurrencyBRL(totalCharges)}\n` +
      `📉 *(-) Descontos:* ${formatCurrencyBRL(totalDiscounts)}\n` +
      `✅ *(=) Valor Real Pago:* ${formatCurrencyBRL(paidAmount)}\n` +
      `⏳ *Em Aberto:* ${formatCurrencyBRL(openAmount)}\n` +
      `🚨 *Vencido / Atraso:* ${formatCurrencyBRL(overdueAmount)}`,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

export function buildFinanceiroReceberReport(params: {
  companyProfile: CompanyProfile;
  filteredReceivables: ReceivableReportRow[];
  startDate: string;
  endDate: string;
  competence: string;
  searchTerm?: string;
  statusFilter?: string;
  viewMode?: ReportViewMode;
  groupByLabel?: string;
  syntheticRows?: SyntheticSummaryRow[];
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredReceivables,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    statusFilter = 'todos',
    viewMode = 'analitico',
    groupByLabel = 'Cliente',
    syntheticRows,
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalOriginal = filteredReceivables.reduce(
    (s, r) => s + (Number(r.originalAmount ?? r.amount) || 0),
    0
  );
  const totalCharges = filteredReceivables.reduce(
    (s, r) => s + (Number(r.fineAmount) || 0) + (Number(r.interestAmount) || 0),
    0
  );
  const totalDiscounts = filteredReceivables.reduce(
    (s, r) => s + (Number(r.discountAmount) || 0),
    0
  );

  const paidItems = filteredReceivables.filter((r) => r.status === 'pago');
  const openItems = filteredReceivables.filter((r) => r.status === 'a_vencer');
  const overdueItems = filteredReceivables.filter((r) => r.status === 'vencido');

  const paidAmount = paidItems.reduce((s, r) => s + (Number(r.paidAmount ?? r.amount) || 0), 0);
  const openAmount = openItems.reduce((s, r) => s + (Number(r.originalAmount ?? r.amount) || 0), 0);
  const overdueAmount = overdueItems.reduce((s, r) => s + (Number(r.originalAmount ?? r.amount) || 0), 0);
  const totalAmount = paidAmount + openAmount + overdueAmount;

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Formato', value: viewMode === 'sintetico' ? `Sintético (${groupByLabel})` : 'Analítico (Detalhado)' },
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Status', value: statusFilter },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Total a Receber',
      value: formatCurrencyBRL(totalAmount),
      sub: `${filteredReceivables.length} título(s) no período`,
      color: '#0369a1',
    },
    {
      label: 'Recebido (Liquidado Real)',
      value: formatCurrencyBRL(paidAmount),
      sub: `${paidItems.length} título(s) recebido(s)`,
      color: '#047857',
    },
    {
      label: 'A Vencer (No Prazo)',
      value: formatCurrencyBRL(openAmount),
      sub: `${openItems.length} título(s) em aberto`,
      color: '#d97706',
    },
    {
      label: 'Inadimplente / Vencido',
      value: formatCurrencyBRL(overdueAmount),
      sub: `${overdueItems.length} título(s) em atraso`,
      color: '#b91c1c',
    },
  ]);

  const adjustmentKpiHtml = renderSummaryCardsRow([
    {
      label: 'Valor Original (Nominal)',
      value: formatCurrencyBRL(totalOriginal),
      sub: 'Soma base dos títulos',
      color: '#334155',
    },
    {
      label: '(+) Juros e Multas',
      value: formatCurrencyBRL(totalCharges),
      sub: 'Encargos recebidos',
      color: '#b91c1c',
    },
    {
      label: '(-) Descontos',
      value: formatCurrencyBRL(totalDiscounts),
      sub: 'Abatimentos concedidos',
      color: '#047857',
    },
    {
      label: '(=) Valor Real Recebido',
      value: formatCurrencyBRL(paidAmount),
      sub: `${paidItems.length} título(s) liquidado(s)`,
      color: '#047857',
    },
  ]);

  const resolvedSynthetic =
    syntheticRows ||
    buildSyntheticSummaryRows(
      filteredReceivables,
      (r) => r.clientName || 'Cliente N/I',
      (r) => (r.status === 'pago' ? Number(r.paidAmount ?? r.amount) || 0 : Number(r.amount) || 0),
      {
        getPaidAmount: (r) => (r.status === 'pago' ? Number(r.paidAmount ?? r.amount) || 0 : 0),
        getPendingAmount: (r) => (r.status !== 'pago' ? Number(r.amount) || 0 : 0),
      }
    );

  const tableHtml =
    viewMode === 'sintetico'
      ? renderSyntheticTableHtml({
          groupColumnLabel: groupByLabel,
          showPaidBreakdown: true,
          rows: resolvedSynthetic,
          totalLabel: 'Total Contas a Receber',
          accentColor: '#047857',
          emptyText: 'Nenhum título a receber localizado no período e filtros selecionados.',
        })
      : (() => {
          const rowsHtml =
            filteredReceivables.length > 0
              ? filteredReceivables
                  .map((r) => {
                    const statusText = r.status === 'pago' ? 'RECEBIDO' : r.status === 'vencido' ? 'VENCIDO' : 'A VENCER';
                    const statusColor = r.status === 'pago' ? '#047857' : r.status === 'vencido' ? '#b91c1c' : '#b45309';
                    const origVal = Number(r.originalAmount ?? r.amount) || 0;
                    const chargesVal = (Number(r.fineAmount) || 0) + (Number(r.interestAmount) || 0);
                    const discVal = Number(r.discountAmount) || 0;
                    const realVal = r.status === 'pago' ? (Number(r.paidAmount ?? r.amount) || 0) : 0;
                    return `
                    <tr style="font-size:8pt;">
                      <td style="white-space:nowrap;">${formatDateBR(r.dueDate)}</td>
                      <td style="font-weight:700;">${escapeHtml(r.clientName)}</td>
                      <td>${escapeHtml(r.originLabel)}</td>
                      <td>${escapeHtml(r.description)}</td>
                      <td style="text-transform:uppercase;font-size:7pt;">${escapeHtml(r.paymentMethodLabel)}</td>
                      <td style="text-align:right;font-weight:700;color:#0f172a;">${formatCurrencyBRL(origVal)}</td>
                      <td style="text-align:right;font-weight:600;color:#b91c1c;">${chargesVal > 0 ? `+ ${formatCurrencyBRL(chargesVal)}` : '—'}</td>
                      <td style="text-align:right;font-weight:600;color:#047857;">${discVal > 0 ? `- ${formatCurrencyBRL(discVal)}` : '—'}</td>
                      <td style="text-align:right;font-weight:800;color:#047857;">${r.status === 'pago' ? formatCurrencyBRL(realVal) : '—'}</td>
                      <td style="text-align:center;font-weight:800;color:${statusColor};font-size:7pt;">${statusText}</td>
                    </tr>
                  `;
                  })
                  .join('')
              : `<tr><td colspan="10" style="text-align:center;padding:16px;color:#64748b;">Nenhum título a receber localizado no período e filtros selecionados.</td></tr>`;

          return `
            <table>
              <thead>
                <tr>
                  <th style="width:76px;">Vencimento</th>
                  <th>Cliente / Tomador</th>
                  <th style="width:110px;">Origem</th>
                  <th>Referência / Descrição</th>
                  <th style="width:82px;">Forma Pagto.</th>
                  <th style="text-align:right;width:88px;">Valor Original</th>
                  <th style="text-align:right;width:82px;">(+) Juros/Multa</th>
                  <th style="text-align:right;width:82px;">(-) Desconto</th>
                  <th style="text-align:right;width:96px;">(=) Valor Real Recebido</th>
                  <th style="text-align:center;width:72px;">Status</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#f1f5f9;border-top:2px solid #047857;font-weight:900;font-size:8pt;">
                  <td colspan="5" style="text-align:right;text-transform:uppercase;">
                    Totais (${filteredReceivables.length} títulos):
                  </td>
                  <td style="text-align:right;color:#0f172a;">${formatCurrencyBRL(totalOriginal)}</td>
                  <td style="text-align:right;color:#b91c1c;">+ ${formatCurrencyBRL(totalCharges)}</td>
                  <td style="text-align:right;color:#047857;">- ${formatCurrencyBRL(totalDiscounts)}</td>
                  <td style="text-align:right;color:#047857;">${formatCurrencyBRL(paidAmount)}</td>
                  <td style="text-align:center;">--</td>
                </tr>
              </tfoot>
            </table>
          `;
        })();

  return {
    title:
      viewMode === 'sintetico'
        ? `Relatório Sintético de Contas a Receber (${groupByLabel})`
        : 'Relatório de Contas a Receber',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'CONTAS A RECEBER',
    contentHtml: `${filtersHtml}${kpiHtml}${adjustmentKpiHtml}${tableHtml}`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `💰 *RELATÓRIO DE CONTAS A RECEBER*\n` +
      `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
      `📌 *Valor Original:* ${formatCurrencyBRL(totalOriginal)} (${filteredReceivables.length} títulos)\n` +
      `📈 *(+) Juros e Multas:* ${formatCurrencyBRL(totalCharges)}\n` +
      `📉 *(-) Descontos:* ${formatCurrencyBRL(totalDiscounts)}\n` +
      `✅ *(=) Valor Real Recebido:* ${formatCurrencyBRL(paidAmount)}\n` +
      `⏳ *A Vencer:* ${formatCurrencyBRL(openAmount)}\n` +
      `🚨 *Inadimplente / Vencido:* ${formatCurrencyBRL(overdueAmount)}`,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

export function buildFinanceiroChequesReport(params: {
  companyProfile: CompanyProfile;
  filteredCheques: FinanceiroCheque[];
  startDate: string;
  endDate: string;
  competence: string;
  searchTerm?: string;
  statusFilter?: string;
  viewMode?: ReportViewMode;
  groupByLabel?: string;
  syntheticRows?: SyntheticSummaryRow[];
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredCheques,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    statusFilter = 'todos',
    viewMode = 'analitico',
    groupByLabel = 'Banco / Instituição',
    syntheticRows,
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const getChqDate = (c: FinanceiroCheque) => c.data_vencimento || c.dataVencimento || '';
  const getChqNum = (c: FinanceiroCheque) => c.numero_cheque || c.numeroCheque || '-';
  const getChqEmitente = (c: FinanceiroCheque) => c.emitente_nome || c.emitenteNome || c.cliente_nome || c.clienteNome || 'N/I';

  const totalAmount = filteredCheques.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const emPoder = filteredCheques.filter((c) => c.status === 'EM_NOSSO_PODER');
  const compensados = filteredCheques.filter((c) => c.status === 'COMPENSADO');
  const devolvidos = filteredCheques.filter((c) => c.status === 'DEVOLVIDO');

  const emPoderAmt = emPoder.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const compAmt = compensados.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const devAmt = devolvidos.reduce((s, c) => s + (Number(c.valor) || 0), 0);

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Formato', value: viewMode === 'sintetico' ? `Sintético (${groupByLabel})` : 'Analítico (Detalhado)' },
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Status', value: statusFilter },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Total em Custódia / Carteira',
      value: formatCurrencyBRL(totalAmount),
      sub: `${filteredCheques.length} cheque(s) listado(s)`,
      color: '#0369a1',
    },
    {
      label: 'A Compensar (Em Poder)',
      value: formatCurrencyBRL(emPoderAmt),
      sub: `${emPoder.length} cheque(s) em custódia`,
      color: '#d97706',
    },
    {
      label: 'Compensados',
      value: formatCurrencyBRL(compAmt),
      sub: `${compensados.length} cheque(s) compensado(s)`,
      color: '#047857',
    },
    {
      label: 'Devolvidos',
      value: formatCurrencyBRL(devAmt),
      sub: `${devolvidos.length} ocorrência(s)`,
      color: '#b91c1c',
    },
  ]);

  const resolvedSynthetic =
    syntheticRows ||
    buildSyntheticSummaryRows(
      filteredCheques,
      (c) => c.banco || 'Banco N/I',
      (c) => Number(c.valor) || 0
    );

  const tableHtml =
    viewMode === 'sintetico'
      ? renderSyntheticTableHtml({
          groupColumnLabel: groupByLabel,
          rows: resolvedSynthetic,
          totalLabel: 'Total Custódia de Cheques',
          accentColor: '#0369a1',
          emptyText: 'Nenhum cheque localizado no período e filtros selecionados.',
        })
      : (() => {
          const rowsHtml =
            filteredCheques.length > 0
              ? filteredCheques
                  .map((c) => {
                    const statusColor =
                      c.status === 'COMPENSADO'
                        ? '#047857'
                        : c.status === 'DEVOLVIDO'
                        ? '#b91c1c'
                        : '#b45309';
                    return `
                    <tr style="font-size:8.5pt;">
                      <td style="font-family:monospace;font-weight:700;">${escapeHtml(getChqNum(c))}</td>
                      <td>${escapeHtml(c.banco || '-')}</td>
                      <td style="font-weight:700;">${escapeHtml(getChqEmitente(c))}</td>
                      <td>${escapeHtml(c.fornecedor_destino || c.fornecedorDestino || c.cliente_nome || c.clienteNome || '-')}</td>
                      <td style="white-space:nowrap;">${formatDateBR(getChqDate(c))}</td>
                      <td style="text-align:right;font-weight:800;color:#0369a1;">${formatCurrencyBRL(Number(c.valor) || 0)}</td>
                      <td style="text-align:center;font-weight:800;color:${statusColor};font-size:7.5pt;">${escapeHtml(c.status)}</td>
                    </tr>
                  `;
                  })
                  .join('')
              : `<tr><td colspan="7" style="text-align:center;padding:16px;color:#64748b;">Nenhum cheque localizado no período e filtros selecionados.</td></tr>`;

          return `
            <table>
              <thead>
                <tr>
                  <th style="width:90px;">Nº Cheque</th>
                  <th>Banco</th>
                  <th>Emitente</th>
                  <th>Cliente / Destino Repasse</th>
                  <th style="width:90px;">Bom Para</th>
                  <th style="text-align:right;width:110px;">Valor (R$)</th>
                  <th style="text-align:center;width:110px;">Status</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr style="background:#f1f5f9;border-top:2px solid #0369a1;font-weight:900;">
                  <td colspan="5" style="text-align:right;text-transform:uppercase;">
                    Totais (${filteredCheques.length} cheques):
                  </td>
                  <td style="text-align:right;color:#0369a1;">${formatCurrencyBRL(totalAmount)}</td>
                  <td style="text-align:center;">--</td>
                </tr>
              </tfoot>
            </table>
          `;
        })();

  return {
    title:
      viewMode === 'sintetico'
        ? `Relatório Sintético de Custódia de Cheques (${groupByLabel})`
        : 'Relatório de Custódia & Controle de Cheques',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'CUSTÓDIA DE CHEQUES',
    contentHtml: `${filtersHtml}${kpiHtml}${tableHtml}`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `🧾 *RELATÓRIO DE CUSTÓDIA DE CHEQUES*\n` +
      `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
      `📌 *Total em Custódia:* ${formatCurrencyBRL(totalAmount)} (${filteredCheques.length} cheques)\n` +
      `⏳ *A Compensar:* ${formatCurrencyBRL(emPoderAmt)}\n` +
      `✅ *Compensados:* ${formatCurrencyBRL(compAmt)}\n` +
      `🚨 *Devolvidos:* ${formatCurrencyBRL(devAmt)}`,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 9. EXCEÇÕES & ALERTAS EM TEMPO REAL
 */
export interface ExceptionAlertItem {
  id: string;
  area: 'financeiro' | 'estoque' | 'frota_rh';
  areaLabel: string;
  severity: 'critico' | 'alto' | 'atencao';
  category: string;
  title: string;
  detail: string;
  referenceDate?: string;
  amountOrMetric?: string;
}

export function buildExcecoesAlertasReport(params: {
  companyProfile: CompanyProfile;
  alerts: ExceptionAlertItem[];
  areaFilter?: string;
  severityFilter?: string;
  searchTerm?: string;
}): ReportPrintConfig {
  const {
    companyProfile,
    alerts,
    areaFilter = 'todas',
    severityFilter = 'todas',
    searchTerm = '',
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const critCount = alerts.filter((a) => a.severity === 'critico').length;
  const finCount = alerts.filter((a) => a.area === 'financeiro').length;
  const estCount = alerts.filter((a) => a.area === 'estoque').length;
  const frotaRhCount = alerts.filter((a) => a.area === 'frota_rh').length;

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Área', value: areaFilter },
    { label: 'Criticidade', value: severityFilter },
    { label: 'Busca', value: searchTerm.trim() },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Total de Exceções',
      value: `${alerts.length} alerta(s)`,
      sub: `${critCount} ocorrência(s) crítica(s)`,
      color: '#b91c1c',
    },
    {
      label: 'Pendências Financeiras',
      value: `${finCount}`,
      sub: 'Vencidos, cheques e inadimplência',
      color: '#d97706',
    },
    {
      label: 'Alertas de Estoque',
      value: `${estCount}`,
      sub: 'Saldo zerado ou abaixo do mínimo',
      color: '#0369a1',
    },
    {
      label: 'Frota & RH',
      value: `${frotaRhCount}`,
      sub: 'Revisões, IPVA/Licenc. e CNH',
      color: '#7c3aed',
    },
  ]);

  const rowsHtml =
    alerts.length > 0
      ? alerts
          .map((a) => {
            const sevColor =
              a.severity === 'critico' ? '#b91c1c' : a.severity === 'alto' ? '#d97706' : '#0369a1';
            const sevLabel =
              a.severity === 'critico' ? 'CRÍTICO' : a.severity === 'alto' ? 'ALTO' : 'ATENÇÃO';
            return `
              <tr style="font-size:8.5pt;">
                <td style="text-align:center;font-weight:800;color:${sevColor};font-size:7.5pt;">${sevLabel}</td>
                <td style="font-weight:700;">${escapeHtml(a.areaLabel)}</td>
                <td>${escapeHtml(a.category)}</td>
                <td>
                  <strong>${escapeHtml(a.title)}</strong>
                  <div style="font-size:7.5pt;color:#475569;">${escapeHtml(a.detail)}</div>
                </td>
                <td style="white-space:nowrap;">${a.referenceDate ? formatDateBR(a.referenceDate) : '-'}</td>
                <td style="text-align:right;font-weight:800;color:${sevColor};">${escapeHtml(a.amountOrMetric || '-')}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="6" style="text-align:center;padding:18px;color:#047857;font-weight:700;">Nenhuma exceção ou alerta crítico detectado no momento. Operação em conformidade.</td></tr>`;

  return {
    title: 'Pauta de Exceções & Alertas Operacionais (Tempo Real)',
    subtitle: `Auditoria automática de pendências financeiras, estoque mínimo, frota e CNH • Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
    documentType: 'PAUTA DE PENDÊNCIAS',
    contentHtml: `
      ${filtersHtml}
      ${kpiHtml}
      <table>
        <thead>
          <tr>
            <th style="text-align:center;width:78px;">Severidade</th>
            <th style="width:115px;">Área</th>
            <th style="width:145px;">Tipo de Alerta</th>
            <th>Ocorrência / Ação Recomendada</th>
            <th style="width:85px;">Data Ref.</th>
            <th style="text-align:right;width:115px;">Valor / Saldo</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `,
    whatsappText:
      `🚨 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `📋 *PAUTA DE EXCEÇÕES & ALERTAS (TEMPO REAL)*\n\n` +
      `🔴 *Críticos:* ${critCount} | 📌 *Total:* ${alerts.length}\n` +
      `💰 *Financeiro:* ${finCount}\n` +
      `📦 *Estoque:* ${estCount}\n` +
      `🚜 *Frota & RH:* ${frotaRhCount}`,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 10. CONSTRUTOR PERSONALIZADO (AD-HOC)
 */
export interface AdHocColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'date' | 'number' | 'text';
  summable?: boolean;
  tone?: 'charge' | 'discount' | 'real' | 'default';
}

export function buildAdHocCustomReport(params: {
  companyProfile: CompanyProfile;
  datasetLabel: string;
  columns: AdHocColumnDef[];
  rows: Array<Record<string, unknown>>;
  startDate?: string;
  endDate?: string;
  statusFilter?: string;
  searchTerm?: string;
}): ReportPrintConfig {
  const {
    companyProfile,
    datasetLabel,
    columns,
    rows,
    startDate = '',
    endDate = '',
    statusFilter = 'todos',
    searchTerm = '',
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Base', value: datasetLabel },
    { label: 'Período', value: startDate && endDate ? `${formatDateBR(startDate)} a ${formatDateBR(endDate)}` : '' },
    { label: 'Status', value: statusFilter },
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Colunas', value: `${columns.length} selecionada(s)` },
  ]);

  const formatCell = (val: unknown, col: AdHocColumnDef): string => {
    if (val === null || val === undefined || val === '') return '-';
    if (col.format === 'currency') return formatCurrencyBRL(Number(val) || 0);
    if (col.format === 'date') return formatDateBR(String(val));
    if (col.format === 'number') return Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return escapeHtml(String(val));
  };

  const bodyHtml =
    columns.length === 0
      ? '<p style="padding:16px;text-align:center;color:#64748b;">Nenhuma coluna selecionada para exibição.</p>'
      : `
      <table>
        <thead>
          <tr>
            ${columns
              .map(
                (col) =>
                  `<th style="text-align:${col.align || 'left'};">${escapeHtml(col.label)}</th>`
              )
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${
            rows.length > 0
              ? rows
                  .map(
                    (row) => `
                  <tr style="font-size:8.5pt;">
                    ${columns
                      .map((col) => {
                        const align = col.align || 'left';
                        const numVal = Number(row[col.key]) || 0;
                        let colorCss = '';
                        if (col.tone === 'charge') {
                          colorCss = numVal > 0.009 ? 'color:#b91c1c;font-weight:800;' : 'color:#64748b;';
                        } else if (col.tone === 'discount') {
                          colorCss = numVal > 0.009 ? 'color:#047857;font-weight:800;' : 'color:#64748b;';
                        } else if (col.format === 'currency') {
                          colorCss = 'font-weight:700;';
                        }
                        return `<td style="text-align:${align};${colorCss}">${formatCell(row[col.key], col)}</td>`;
                      })
                      .join('')}
                  </tr>
                `
                  )
                  .join('')
              : `<tr><td colspan="${columns.length}" style="text-align:center;padding:16px;color:#64748b;">Nenhum registro encontrado com os filtros aplicados.</td></tr>`
          }
        </tbody>
        ${
          rows.length > 0 && columns.some((c) => c.summable)
            ? `
          <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #047857;font-weight:900;">
              ${columns
                .map((col, idx) => {
                  if (idx === 0 && !col.summable) {
                    return `<td>TOTAIS (${rows.length} registros)</td>`;
                  }
                  if (col.summable) {
                    const sum = rows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                    const totalColor =
                      col.tone === 'charge' && sum > 0.009
                        ? '#b91c1c'
                        : col.tone === 'discount' && sum > 0.009
                        ? '#047857'
                        : '#047857';
                    return `<td style="text-align:${col.align || 'right'};color:${totalColor};">${
                      col.format === 'currency'
                        ? formatCurrencyBRL(sum)
                        : sum.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                    }</td>`;
                  }
                  return `<td></td>`;
                })
                .join('')}
            </tr>
          </tfoot>
        `
            : ''
        }
      </table>
    `;

  return {
    title: `Relatório Personalizado — ${datasetLabel}`,
    subtitle: `${rows.length} registro(s) • ${columns.length} coluna(s) selecionada(s)${
      startDate && endDate ? ` • ${formatDateBR(startDate)} a ${formatDateBR(endDate)}` : ''
    }`,
    documentType: 'RELATÓRIO AD-HOC',
    contentHtml: `${filtersHtml}${bodyHtml}`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `🛠️ *RELATÓRIO PERSONALIZADO: ${datasetLabel.toUpperCase()}*\n` +
      `📋 *Registros:* ${rows.length} | *Colunas:* ${columns.length}`,
    orientation: columns.length > 5 ? 'landscape' : 'portrait',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 11. SITUAÇÃO & FECHAMENTO DE CAIXA (CONSOLIDADO & INDIVIDUAL POR Nº CAIXA)
 */
export interface CaixaSessionSummaryRow {
  caixa: CaixaOperacional;
  id: string;
  dataHoraAbertura: string;
  dataHoraFechamento: string;
  operador: string;
  fundoInicial: number;
  dinheiro: number;
  pixCartoes: number;
  suprimentos: number;
  sangrias: number;
  totalEntradas: number;
  saldoFinal: number;
  diferenca: number;
  status: 'ABERTO' | 'FECHADO';
}

export function buildCaixaSessoesReport(params: {
  companyProfile: CompanyProfile;
  rows: CaixaSessionSummaryRow[];
  startDate?: string;
  endDate?: string;
  competence: string;
  selectedCaixaId?: string;
  statusFilter?: string;
  searchTerm?: string;
  viewMode?: ReportViewMode;
  groupByLabel?: string;
  syntheticRows?: SyntheticSummaryRow[];
}): ReportPrintConfig {
  const {
    companyProfile,
    rows,
    startDate = '',
    endDate = '',
    competence,
    selectedCaixaId = 'todos',
    statusFilter = 'todos',
    searchTerm = '',
    viewMode = 'analitico',
    groupByLabel = 'Operador',
    syntheticRows,
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const openCount = rows.filter((r) => r.status === 'ABERTO').length;
  const closedCount = rows.filter((r) => r.status === 'FECHADO').length;
  const totalEntradas = rows.reduce((s, r) => s + r.totalEntradas, 0);
  const totalSangrias = rows.reduce((s, r) => s + r.sangrias, 0);
  const totalSaldo = rows.reduce((s, r) => s + r.saldoFinal, 0);

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Formato', value: viewMode === 'sintetico' ? `Sintético (${groupByLabel})` : 'Analítico (Detalhado)' },
    { label: 'Nº Caixa', value: selectedCaixaId },
    { label: 'Status', value: statusFilter },
    { label: 'Busca', value: searchTerm.trim() },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Caixas no Período',
      value: `${rows.length} sessão(ões)`,
      sub: `${openCount} aberto(s) • ${closedCount} fechado(s)`,
      color: '#1e293b',
    },
    {
      label: 'Total Entradas (Vendas + Supr.)',
      value: formatCurrencyBRL(totalEntradas),
      sub: 'Dinheiro, PIX, Cartões e Suprimentos',
      color: '#047857',
    },
    {
      label: 'Total Sangrias / Saídas',
      value: formatCurrencyBRL(totalSangrias),
      sub: 'Retiradas registradas no período',
      color: '#b91c1c',
    },
    {
      label: 'Saldo Líquido em Caixa',
      value: formatCurrencyBRL(totalSaldo),
      sub: 'Soma dos saldos finais das sessões',
      color: '#0369a1',
    },
  ]);

  const resolvedSynthetic =
    syntheticRows ||
    buildSyntheticSummaryRows(
      rows,
      (r) => r.operador || 'ADMINISTRADOR GERAL',
      (r) => r.saldoFinal,
      {
        getPaidAmount: (r) => r.totalEntradas,
        getPendingAmount: (r) => r.sangrias,
      }
    );

  const tableHtml =
    viewMode === 'sintetico'
      ? renderSyntheticTableHtml({
          groupColumnLabel: groupByLabel,
          showPaidBreakdown: false,
          rows: resolvedSynthetic,
          totalLabel: 'Total Consolidado de Caixas',
          accentColor: '#0369a1',
          emptyText: 'Nenhuma sessão de caixa localizada com os filtros aplicados.',
        })
      : `
      <table>
        <thead>
          <tr>
            <th style="width:105px;">Nº Caixa</th>
            <th style="width:105px;">Abertura</th>
            <th style="width:105px;">Fechamento</th>
            <th>Operador</th>
            <th style="text-align:right;width:85px;">Fundo Inicial</th>
            <th style="text-align:right;width:85px;">Dinheiro</th>
            <th style="text-align:right;width:90px;">PIX / Cartões</th>
            <th style="text-align:right;width:85px;">Sangrias</th>
            <th style="text-align:right;width:95px;">Saldo Final</th>
            <th style="text-align:center;width:70px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length > 0
              ? rows
                  .map(
                    (r) => `
                  <tr style="font-size:8pt;">
                    <td style="font-family:monospace;font-weight:800;">${escapeHtml(r.id)}</td>
                    <td style="white-space:nowrap;">${escapeHtml(r.dataHoraAbertura || '-')}</td>
                    <td style="white-space:nowrap;">${escapeHtml(r.dataHoraFechamento || '-')}</td>
                    <td style="font-weight:700;">${escapeHtml(r.operador)}</td>
                    <td style="text-align:right;">${formatCurrencyBRL(r.fundoInicial)}</td>
                    <td style="text-align:right;color:#047857;font-weight:600;">${formatCurrencyBRL(r.dinheiro)}</td>
                    <td style="text-align:right;color:#0369a1;font-weight:600;">${formatCurrencyBRL(r.pixCartoes)}</td>
                    <td style="text-align:right;color:#b91c1c;font-weight:600;">${formatCurrencyBRL(r.sangrias)}</td>
                    <td style="text-align:right;font-weight:900;color:#0f172a;">${formatCurrencyBRL(r.saldoFinal)}</td>
                    <td style="text-align:center;font-weight:800;color:${r.status === 'ABERTO' ? '#047857' : '#475569'};">${escapeHtml(r.status)}</td>
                  </tr>
                `
                  )
                  .join('')
              : `<tr><td colspan="10" style="text-align:center;padding:16px;color:#64748b;">Nenhuma sessão de caixa localizada.</td></tr>`
          }
        </tbody>
        ${
          rows.length > 0
            ? `
          <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #0369a1;font-weight:900;">
              <td colspan="4" style="text-align:right;text-transform:uppercase;">Totais (${rows.length} caixas):</td>
              <td style="text-align:right;">${formatCurrencyBRL(rows.reduce((s, r) => s + r.fundoInicial, 0))}</td>
              <td style="text-align:right;color:#047857;">${formatCurrencyBRL(rows.reduce((s, r) => s + r.dinheiro, 0))}</td>
              <td style="text-align:right;color:#0369a1;">${formatCurrencyBRL(rows.reduce((s, r) => s + r.pixCartoes, 0))}</td>
              <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(totalSangrias)}</td>
              <td style="text-align:right;color:#0369a1;">${formatCurrencyBRL(totalSaldo)}</td>
              <td style="text-align:center;">--</td>
            </tr>
          </tfoot>
        `
            : ''
        }
      </table>
    `;

  return {
    title:
      viewMode === 'sintetico'
        ? `Relatório Sintético de Caixas (${groupByLabel})`
        : 'Relatório de Situação & Fechamento de Caixas',
    subtitle: `Competência ${competence}${startDate && endDate ? ` • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}` : ''}`,
    documentType: 'SITUAÇÃO DE CAIXAS',
    contentHtml: `${filtersHtml}${kpiHtml}${tableHtml}`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `💵 *SITUAÇÃO & FECHAMENTO DE CAIXAS*\n` +
      `📋 *Sessões:* ${rows.length} (${openCount} abertos / ${closedCount} fechados)\n` +
      `🟢 *Entradas:* ${formatCurrencyBRL(totalEntradas)}\n` +
      `🔴 *Sangrias:* ${formatCurrencyBRL(totalSangrias)}\n` +
      `💰 *Saldo Líquido:* ${formatCurrencyBRL(totalSaldo)}`,
    orientation: 'landscape',
    signatureLabels: ['Operador / Tesouraria', 'Gerência / Auditoria'],
  };
}

export function buildIndividualCaixaPrintConfig(
  caixa: CaixaOperacional,
  companyProfile: CompanyProfile
): ReportPrintConfig {
  const totais = calcularTotaisCaixa(caixa);
  const subHeader = resolveSubscriberPrintHeader(companyProfile);
  const operadorAb = (caixa.operadorAbertura || caixa.operador || 'ADMINISTRADOR GERAL').toUpperCase();
  const operadorFe = (caixa.operadorFechamento || caixa.operador || 'ADMINISTRADOR GERAL').toUpperCase();
  const vendas = Array.isArray(caixa.vendasPdv) ? caixa.vendasPdv : [];
  const suprimentos = Array.isArray(caixa.suprimentos) ? caixa.suprimentos : [];
  const sangrias = Array.isArray(caixa.sangrias) ? caixa.sangrias : [];
  const valorSistema = Number(caixa.valorFechamentoSistema ?? totais.saldoAtualDinheiro);
  const valorReal = Number(caixa.valorFechamentoReal || 0);
  const diferenca = Number(caixa.diferenca ?? (caixa.status === 'FECHADO' ? valorReal - valorSistema : 0));

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Fundo Inicial / Troco',
      value: formatCurrencyBRL(totais.saldoInicial),
      sub: `Suprimentos: ${formatCurrencyBRL(totais.totalSuprimentos)}`,
      color: '#1d4ed8',
    },
    {
      label: 'Recebimentos Dinheiro',
      value: formatCurrencyBRL(totais.vendasDinheiro),
      sub: `PIX: ${formatCurrencyBRL(totais.vendasPix)} • Cartões: ${formatCurrencyBRL(totais.vendasDebito + totais.vendasCredito)}`,
      color: '#047857',
    },
    {
      label: 'Sangrias / Retiradas',
      value: formatCurrencyBRL(totais.totalSangrias),
      sub: `${sangrias.length} retirada(s) registrada(s)`,
      color: '#b91c1c',
    },
    {
      label: caixa.status === 'FECHADO' ? 'Saldo Apurado (Físico)' : 'Saldo Esperado (Gaveta)',
      value: formatCurrencyBRL(caixa.status === 'FECHADO' ? valorReal : valorSistema),
      sub: caixa.status === 'FECHADO' ? `Sistema: ${formatCurrencyBRL(valorSistema)} • Dif: ${formatCurrencyBRL(diferenca)}` : 'Sessão em andamento',
      color: '#0369a1',
    },
  ]);

  const infoBox = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;font-size:8.5pt;">
      <div><strong>Nº CAIXA:</strong><br/>${escapeHtml(caixa.id)}</div>
      <div><strong>ABERTURA:</strong><br/>${escapeHtml(caixa.dataHoraAbertura || caixa.dataAbertura || '-')}</div>
      <div><strong>FECHAMENTO:</strong><br/>${escapeHtml(caixa.dataHoraFechamento || caixa.dataFechamento || 'Em aberto')}</div>
      <div><strong>OPERADOR(ES):</strong><br/>Ab: ${escapeHtml(operadorAb)} / Fe: ${escapeHtml(operadorFe)}</div>
    </div>
  `;

  const vendasTable = `
    <h4 style="font-size:9.5pt;font-weight:800;color:#0f172a;margin:10px 0 5px 0;text-transform:uppercase;">
      1. Movimentações e Vendas Vinculadas ao Caixa (${vendas.length})
    </h4>
    <table>
      <thead>
        <tr>
          <th style="width:110px;">Data / Hora</th>
          <th style="width:95px;">Pedido</th>
          <th>Cliente / Origem</th>
          <th style="width:130px;">Forma Pagto.</th>
          <th style="text-align:right;width:110px;">Valor (R$)</th>
        </tr>
      </thead>
      <tbody>
        ${
          vendas.length > 0
            ? vendas
                .map(
                  (v) => `
                <tr style="font-size:8.5pt;">
                  <td>${escapeHtml(v.dataHora || '-')}</td>
                  <td style="font-family:monospace;font-weight:700;">${escapeHtml(v.numeroPedido || v.id)}</td>
                  <td>${escapeHtml(v.cliente || 'CONSUMIDOR BALCÃO')}</td>
                  <td style="font-weight:700;">${escapeHtml(v.formaPagamento || '-')}</td>
                  <td style="text-align:right;font-weight:800;color:#047857;">${formatCurrencyBRL(v.valor || 0)}</td>
                </tr>
              `
                )
                .join('')
            : `<tr><td colspan="5" style="text-align:center;padding:12px;color:#64748b;">Nenhuma venda lançada nesta sessão de caixa.</td></tr>`
        }
      </tbody>
    </table>
  `;

  const movTable =
    suprimentos.length > 0 || sangrias.length > 0
      ? `
      <h4 style="font-size:9.5pt;font-weight:800;color:#0f172a;margin:12px 0 5px 0;text-transform:uppercase;">
        2. Suprimentos & Sangrias (${suprimentos.length + sangrias.length})
      </h4>
      <table>
        <thead>
          <tr>
            <th style="width:115px;">Data / Hora</th>
            <th style="width:95px;">Tipo</th>
            <th>Motivo / Destino</th>
            <th style="text-align:right;width:115px;">Valor (R$)</th>
          </tr>
        </thead>
        <tbody>
          ${[...suprimentos, ...sangrias]
            .map(
              (m) => `
              <tr style="font-size:8.5pt;">
                <td>${escapeHtml(m.dataHora || '-')}</td>
                <td style="font-weight:800;color:${m.tipo === 'SUPRIMENTO' ? '#047857' : '#b91c1c'};">${escapeHtml(m.tipo)}</td>
                <td>${escapeHtml(m.motivo)}${m.destino ? ` (${escapeHtml(m.destino)})` : ''}</td>
                <td style="text-align:right;font-weight:800;color:${m.tipo === 'SUPRIMENTO' ? '#047857' : '#b91c1c'};">${formatCurrencyBRL(m.valor || 0)}</td>
              </tr>
            `
            )
            .join('')}
        </tbody>
      </table>
    `
      : '';

  return {
    title: `Comprovante de Situação / Fechamento — Caixa ${caixa.id}`,
    subtitle: `Status: ${caixa.status} • Operador: ${operadorFe}`,
    documentType: 'FECHAMENTO INDIVIDUAL DE CAIXA',
    contentHtml: `${infoBox}${kpiHtml}${vendasTable}${movTable}${
      caixa.observacoes
        ? `<div style="margin-top:10px;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:8.5pt;"><strong>Observações:</strong> ${escapeHtml(caixa.observacoes)}</div>`
        : ''
    }`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `💵 *FECHAMENTO CAIXA ${caixa.id}* (${caixa.status})\n` +
      `👤 *Operador:* ${operadorFe}\n` +
      `🟢 *Fundo + Vendas + Suprimentos:* ${formatCurrencyBRL(totais.saldoInicial + totais.totalVendasPdv + totais.totalSuprimentos)}\n` +
      `🔴 *Sangrias:* ${formatCurrencyBRL(totais.totalSangrias)}\n` +
      `💰 *Saldo Gaveta:* ${formatCurrencyBRL(caixa.status === 'FECHADO' ? valorReal : valorSistema)}`,
    orientation: 'portrait',
    signatureLabels: [`Operador (${operadorFe})`, 'Conferente / Gerência'],
  };
}

/**
 * 12. DRE COMPARATIVO POR VEÍCULO / MÁQUINA
 */
export interface VehicleDreReportRow {
  machineryId: string;
  plateOrSerial: string;
  name: string;
  category: string;
  revenue: number;
  fuelCost: number;
  maintenanceCost: number;
  apportionedExpenses: number;
  totalCosts: number;
  netResult: number;
  marginPct: number;
}

export function buildDreVeiculoReport(params: {
  companyProfile: CompanyProfile;
  rows: VehicleDreReportRow[];
  startDate: string;
  endDate: string;
  competence: string;
  searchTerm?: string;
  categoryFilter?: string;
}): ReportPrintConfig {
  const {
    companyProfile,
    rows,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    categoryFilter = 'todos',
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  const totalFuel = rows.reduce((s, r) => s + r.fuelCost, 0);
  const totalMaint = rows.reduce((s, r) => s + r.maintenanceCost, 0);
  const totalApportioned = rows.reduce((s, r) => s + r.apportionedExpenses, 0);
  const totalCosts = rows.reduce((s, r) => s + r.totalCosts, 0);
  const totalNet = totalRev - totalCosts;
  const overallMargin = totalRev > 0 ? (totalNet / totalRev) * 100 : 0;

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Busca', value: searchTerm.trim() },
    { label: 'Categoria', value: categoryFilter },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Receita Gerada (Frota)',
      value: formatCurrencyBRL(totalRev),
      sub: `${rows.length} veículo(s) / máquina(s)`,
      color: '#047857',
    },
    {
      label: 'Combustível + Manutenção',
      value: formatCurrencyBRL(totalFuel + totalMaint),
      sub: `Comb: ${formatCurrencyBRL(totalFuel)} • Manut: ${formatCurrencyBRL(totalMaint)}`,
      color: '#b45309',
    },
    {
      label: 'Rateio Despesas / Pessoal',
      value: formatCurrencyBRL(totalApportioned),
      sub: 'Salários, férias, taxas e rateios',
      color: '#b91c1c',
    },
    {
      label: 'Resultado Líquido Frota',
      value: formatCurrencyBRL(totalNet),
      sub: `Margem consolidada: ${overallMargin.toFixed(1)}%`,
      color: totalNet >= 0 ? '#0369a1' : '#b91c1c',
    },
  ]);

  const tableHtml = `
    <table>
      <thead>
        <tr>
          <th style="width:95px;">Placa / Série</th>
          <th>Veículo / Máquina</th>
          <th style="text-align:right;width:105px;">Receita Gerada</th>
          <th style="text-align:right;width:95px;">Combustível</th>
          <th style="text-align:right;width:100px;">Manutenção/Peças</th>
          <th style="text-align:right;width:105px;">Rateio Despesas</th>
          <th style="text-align:right;width:105px;">Resultado Líquido</th>
          <th style="text-align:right;width:70px;">Margem</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length > 0
            ? rows
                .map(
                  (r) => `
                <tr style="font-size:8.5pt;">
                  <td style="font-family:monospace;font-weight:800;">${escapeHtml(r.plateOrSerial)}</td>
                  <td>
                    <strong>${escapeHtml(r.name)}</strong>
                    <div style="font-size:7pt;color:#64748b;">${escapeHtml(r.category)}</div>
                  </td>
                  <td style="text-align:right;color:#047857;font-weight:700;">${formatCurrencyBRL(r.revenue)}</td>
                  <td style="text-align:right;color:#b45309;">${formatCurrencyBRL(r.fuelCost)}</td>
                  <td style="text-align:right;color:#b45309;">${formatCurrencyBRL(r.maintenanceCost)}</td>
                  <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(r.apportionedExpenses)}</td>
                  <td style="text-align:right;font-weight:900;color:${r.netResult >= 0 ? '#0369a1' : '#b91c1c'};">${formatCurrencyBRL(r.netResult)}</td>
                  <td style="text-align:right;font-weight:800;color:${r.marginPct >= 0 ? '#047857' : '#b91c1c'};">${r.marginPct.toFixed(1)}%</td>
                </tr>
              `
                )
                .join('')
            : `<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;">Nenhum veículo ou máquina encontrado para apuração.</td></tr>`
        }
      </tbody>
      ${
        rows.length > 0
          ? `
        <tfoot>
          <tr style="background:#f1f5f9;border-top:2px solid #0369a1;font-weight:900;">
            <td colspan="2" style="text-align:right;text-transform:uppercase;">Totais Consolidados (${rows.length} equipamentos):</td>
            <td style="text-align:right;color:#047857;">${formatCurrencyBRL(totalRev)}</td>
            <td style="text-align:right;color:#b45309;">${formatCurrencyBRL(totalFuel)}</td>
            <td style="text-align:right;color:#b45309;">${formatCurrencyBRL(totalMaint)}</td>
            <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(totalApportioned)}</td>
            <td style="text-align:right;color:${totalNet >= 0 ? '#0369a1' : '#b91c1c'};">${formatCurrencyBRL(totalNet)}</td>
            <td style="text-align:right;color:${overallMargin >= 0 ? '#047857' : '#b91c1c'};">${overallMargin.toFixed(1)}%</td>
          </tr>
        </tfoot>
      `
          : ''
      }
    </table>
  `;

  return {
    title: 'DRE Comparativo por Veículo / Máquina',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'DRE POR VEÍCULO / MÁQUINA',
    contentHtml: `${filtersHtml}${kpiHtml}${tableHtml}`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `🚜 *DRE COMPARATIVO POR VEÍCULO / MÁQUINA*\n` +
      `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)}\n\n` +
      `🟢 *Receita Gerada:* ${formatCurrencyBRL(totalRev)}\n` +
      `💸 *Custos Totais:* ${formatCurrencyBRL(totalCosts)}\n` +
      `💰 *Resultado Líquido:* ${formatCurrencyBRL(totalNet)} (${overallMargin.toFixed(1)}%)`,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}

/**
 * 13. POSIÇÃO DE ESTOQUE & PATRIMÔNIO EMBARCADO EM FERRAMENTAS
 */
export interface EstoqueReportRow {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  unitCost: number;
  totalValue: number;
  location: string;
}

export interface FerramentaCaixaResumoRow {
  veiculoId: string;
  veiculoLabel: string;
  placa: string;
  responsavel: string;
  itensQtd: number;
  pecasTotais: number;
  valorTotal: number;
  divergencias: number;
  ultimaConferencia: string;
}

export function buildEstoqueFerramentasReport(params: {
  companyProfile: CompanyProfile;
  mode: 'estoque' | 'ferramentas';
  estoqueRows: EstoqueReportRow[];
  ferramentaRows: FerramentaCaixaResumoRow[];
  totalEstoqueValor: number;
  totalFerramentasValor: number;
  abaixoMinimoCount: number;
  searchTerm?: string;
}): ReportPrintConfig {
  const {
    companyProfile,
    mode,
    estoqueRows,
    ferramentaRows,
    totalEstoqueValor,
    totalFerramentasValor,
    abaixoMinimoCount,
    searchTerm = '',
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Visão', value: mode === 'estoque' ? 'Posição de Estoque Geral' : 'Patrimônio de Ferramentas Embarcadas' },
    { label: 'Busca', value: searchTerm.trim() },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Valor Imobilizado em Estoque',
      value: formatCurrencyBRL(totalEstoqueValor),
      sub: `${estoqueRows.length} item(ns) filtrado(s)`,
      color: '#047857',
    },
    {
      label: 'Patrimônio Caixas Ferramentas',
      value: formatCurrencyBRL(totalFerramentasValor),
      sub: `${ferramentaRows.length} veículo(s) equipado(s)`,
      color: '#0369a1',
    },
    {
      label: 'Patrimônio Total Almoxarifado',
      value: formatCurrencyBRL(totalEstoqueValor + totalFerramentasValor),
      sub: 'Estoque Geral + Ferramentas',
      color: '#0f766e',
    },
    {
      label: 'Itens Abaixo do Mínimo',
      value: `${abaixoMinimoCount} alerta(s)`,
      sub: 'Necessidade de reposição',
      color: abaixoMinimoCount > 0 ? '#b91c1c' : '#047857',
    },
  ]);

  const tableHtml =
    mode === 'estoque'
      ? `
      <table>
        <thead>
          <tr>
            <th style="width:75px;">Código</th>
            <th>Produto / Material</th>
            <th style="width:110px;">Categoria</th>
            <th style="text-align:right;width:80px;">Saldo</th>
            <th style="text-align:right;width:70px;">Mínimo</th>
            <th style="text-align:right;width:95px;">Custo Unit.</th>
            <th style="text-align:right;width:110px;">Total Imob. (R$)</th>
            <th style="width:110px;">Localização</th>
          </tr>
        </thead>
        <tbody>
          ${
            estoqueRows.length > 0
              ? estoqueRows
                  .map(
                    (r) => `
                  <tr style="font-size:8.5pt;">
                    <td style="font-family:monospace;">${escapeHtml(r.code || '-')}</td>
                    <td style="font-weight:700;">${escapeHtml(r.name)}</td>
                    <td>${escapeHtml(r.category)}</td>
                    <td style="text-align:right;font-weight:800;color:${r.quantity <= r.minQuantity ? '#b91c1c' : '#0f172a'};">${r.quantity.toLocaleString('pt-BR')} ${escapeHtml(r.unit)}</td>
                    <td style="text-align:right;">${r.minQuantity.toLocaleString('pt-BR')}</td>
                    <td style="text-align:right;">${formatCurrencyBRL(r.unitCost)}</td>
                    <td style="text-align:right;font-weight:800;color:#047857;">${formatCurrencyBRL(r.totalValue)}</td>
                    <td>${escapeHtml(r.location || '-')}</td>
                  </tr>
                `
                  )
                  .join('')
              : `<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;">Nenhum item de estoque localizado.</td></tr>`
          }
        </tbody>
        ${
          estoqueRows.length > 0
            ? `
          <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #047857;font-weight:900;">
              <td colspan="6" style="text-align:right;text-transform:uppercase;">Total Valorizado (${estoqueRows.length} itens):</td>
              <td style="text-align:right;color:#047857;">${formatCurrencyBRL(estoqueRows.reduce((s, r) => s + r.totalValue, 0))}</td>
              <td></td>
            </tr>
          </tfoot>
        `
            : ''
        }
      </table>
    `
      : `
      <table>
        <thead>
          <tr>
            <th style="width:95px;">Placa / Prefixo</th>
            <th>Veículo / Máquina</th>
            <th>Responsável</th>
            <th style="text-align:center;width:80px;">Itens</th>
            <th style="text-align:center;width:85px;">Peças Totais</th>
            <th style="text-align:center;width:90px;">Divergências</th>
            <th style="width:95px;">Últ. Conferência</th>
            <th style="text-align:right;width:115px;">Patrimônio (R$)</th>
          </tr>
        </thead>
        <tbody>
          ${
            ferramentaRows.length > 0
              ? ferramentaRows
                  .map(
                    (r) => `
                  <tr style="font-size:8.5pt;">
                    <td style="font-family:monospace;font-weight:800;">${escapeHtml(r.placa || '-')}</td>
                    <td style="font-weight:700;">${escapeHtml(r.veiculoLabel)}</td>
                    <td>${escapeHtml(r.responsavel || '-')}</td>
                    <td style="text-align:center;font-weight:700;">${r.itensQtd}</td>
                    <td style="text-align:center;">${r.pecasTotais}</td>
                    <td style="text-align:center;font-weight:800;color:${r.divergencias > 0 ? '#b91c1c' : '#047857'};">${r.divergencias}</td>
                    <td>${r.ultimaConferencia ? formatDateBR(r.ultimaConferencia) : 'Não conf.'}</td>
                    <td style="text-align:right;font-weight:900;color:#0369a1;">${formatCurrencyBRL(r.valorTotal)}</td>
                  </tr>
                `
                  )
                  .join('')
              : `<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;">Nenhuma caixa de ferramentas embarcada encontrada.</td></tr>`
          }
        </tbody>
        ${
          ferramentaRows.length > 0
            ? `
          <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #0369a1;font-weight:900;">
              <td colspan="7" style="text-align:right;text-transform:uppercase;">Patrimônio Embarcado Total (${ferramentaRows.length} veículos):</td>
              <td style="text-align:right;color:#0369a1;">${formatCurrencyBRL(ferramentaRows.reduce((s, r) => s + r.valorTotal, 0))}</td>
            </tr>
          </tfoot>
        `
            : ''
        }
      </table>
    `;

  return {
    title:
      mode === 'estoque'
        ? 'Posição Consolidada de Estoque & Custos'
        : 'Patrimônio Embarcado — Caixas de Ferramentas da Frota',
    subtitle: `Almoxarifado & Frota • ${formatDateBR(new Date().toISOString().split('T')[0])}`,
    documentType: 'ESTOQUE & FERRAMENTAS',
    contentHtml: `${filtersHtml}${kpiHtml}${tableHtml}`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `📦 *POSIÇÃO DE ESTOQUE & FERRAMENTAS*\n` +
      `💰 *Estoque Geral:* ${formatCurrencyBRL(totalEstoqueValor)}\n` +
      `🧰 *Caixas Embarcadas:* ${formatCurrencyBRL(totalFerramentasValor)}\n` +
      `⚠️ *Itens Abaixo do Mínimo:* ${abaixoMinimoCount}`,
    orientation: 'landscape',
    signatureLabels: ['Almoxarife / Suprimentos', 'Diretoria / Controladoria'],
  };
}

/**
 * 14. RESUMO DE FOLHA, VALES & VENCIMENTOS RH
 */
export interface RhFolhaReportRow {
  employeeId: string;
  employeeName: string;
  role: string;
  status: string;
  baseSalary: number;
  overtimeAndBonus: number;
  commissions: number;
  advancesDiscount: number;
  otherDiscounts: number;
  netSalary: number;
  cnhExpiration?: string;
  cnhDaysLeft?: number | null;
  vacationDueStatus: string;
}

export function buildRhFolhaReport(params: {
  companyProfile: CompanyProfile;
  rows: RhFolhaReportRow[];
  competence: string;
  statusFilter?: string;
  searchTerm?: string;
}): ReportPrintConfig {
  const {
    companyProfile,
    rows,
    competence,
    statusFilter = 'todos',
    searchTerm = '',
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalBase = rows.reduce((s, r) => s + r.baseSalary, 0);
  const totalVar = rows.reduce((s, r) => s + r.overtimeAndBonus + r.commissions, 0);
  const totalVales = rows.reduce((s, r) => s + r.advancesDiscount, 0);
  const totalNet = rows.reduce((s, r) => s + r.netSalary, 0);
  const cnhAlerts = rows.filter((r) => typeof r.cnhDaysLeft === 'number' && r.cnhDaysLeft <= 30).length;

  const filtersHtml = buildFilterChipsHtml([
    { label: 'Competência', value: competence },
    { label: 'Status', value: statusFilter },
    { label: 'Busca', value: searchTerm.trim() },
  ]);

  const kpiHtml = renderSummaryCardsRow([
    {
      label: 'Salários Base (Equipe)',
      value: formatCurrencyBRL(totalBase),
      sub: `${rows.length} colaborador(es) listado(s)`,
      color: '#1e293b',
    },
    {
      label: 'Horas Extras & Comissões',
      value: formatCurrencyBRL(totalVar),
      sub: 'Variáveis apuradas na competência',
      color: '#0369a1',
    },
    {
      label: 'Vales & Adiantamentos',
      value: formatCurrencyBRL(totalVales),
      sub: 'Descontos e consumos particulares',
      color: '#b45309',
    },
    {
      label: 'Total Líquido Folha / RH',
      value: formatCurrencyBRL(totalNet),
      sub: `${cnhAlerts} alerta(s) CNH <= 30d`,
      color: '#047857',
    },
  ]);

  const tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Colaborador</th>
          <th>Cargo / Função</th>
          <th style="text-align:right;width:90px;">Salário Base</th>
          <th style="text-align:right;width:90px;">H.E. / Bônus</th>
          <th style="text-align:right;width:90px;">Comissões</th>
          <th style="text-align:right;width:90px;">Vales / Desc.</th>
          <th style="text-align:right;width:95px;">Líquido (R$)</th>
          <th style="text-align:center;width:85px;">Venc. CNH</th>
          <th style="width:110px;">Situação Férias</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length > 0
            ? rows
                .map(
                  (r) => `
                <tr style="font-size:8pt;">
                  <td style="font-weight:700;">${escapeHtml(r.employeeName)}</td>
                  <td>${escapeHtml(r.role)}</td>
                  <td style="text-align:right;">${formatCurrencyBRL(r.baseSalary)}</td>
                  <td style="text-align:right;color:#0369a1;">${formatCurrencyBRL(r.overtimeAndBonus)}</td>
                  <td style="text-align:right;color:#047857;">${formatCurrencyBRL(r.commissions)}</td>
                  <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(r.advancesDiscount + r.otherDiscounts)}</td>
                  <td style="text-align:right;font-weight:900;color:#0f172a;">${formatCurrencyBRL(r.netSalary)}</td>
                  <td style="text-align:center;font-weight:700;color:${
                    typeof r.cnhDaysLeft === 'number' && r.cnhDaysLeft <= 30 ? '#b91c1c' : '#334155'
                  };">${r.cnhExpiration ? formatDateBR(r.cnhExpiration) : '--'}</td>
                  <td>${escapeHtml(r.vacationDueStatus)}</td>
                </tr>
              `
                )
                .join('')
            : `<tr><td colspan="9" style="text-align:center;padding:16px;color:#64748b;">Nenhum colaborador ou folha localizada na competência.</td></tr>`
        }
      </tbody>
      ${
        rows.length > 0
          ? `
        <tfoot>
          <tr style="background:#f1f5f9;border-top:2px solid #047857;font-weight:900;">
            <td colspan="2" style="text-align:right;text-transform:uppercase;">Totais (${rows.length} colaboradores):</td>
            <td style="text-align:right;">${formatCurrencyBRL(totalBase)}</td>
            <td style="text-align:right;color:#0369a1;">${formatCurrencyBRL(rows.reduce((s, r) => s + r.overtimeAndBonus, 0))}</td>
            <td style="text-align:right;color:#047857;">${formatCurrencyBRL(rows.reduce((s, r) => s + r.commissions, 0))}</td>
            <td style="text-align:right;color:#b91c1c;">${formatCurrencyBRL(rows.reduce((s, r) => s + r.advancesDiscount + r.otherDiscounts, 0))}</td>
            <td style="text-align:right;color:#047857;">${formatCurrencyBRL(totalNet)}</td>
            <td colspan="2" style="text-align:center;">${cnhAlerts} CNH em atenção</td>
          </tr>
        </tfoot>
      `
          : ''
      }
    </table>
  `;

  return {
    title: `Resumo Consolidado de Folha, Vales & Vencimentos RH`,
    subtitle: `Competência ${competence} • ${rows.length} colaborador(es)`,
    documentType: 'RELATÓRIO GERENCIAL RH',
    contentHtml: `${filtersHtml}${kpiHtml}${tableHtml}`,
    whatsappText:
      `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
      `👥 *RESUMO RH (COMP. ${competence})*\n` +
      `💵 *Salários Base:* ${formatCurrencyBRL(totalBase)}\n` +
      `📈 *H.E. + Comissões:* ${formatCurrencyBRL(totalVar)}\n` +
      `🧾 *Vales / Adiantamentos:* ${formatCurrencyBRL(totalVales)}\n` +
      `💰 *Líquido Folha:* ${formatCurrencyBRL(totalNet)}`,
    orientation: 'landscape',
    signatureLabels: ['Recursos Humanos / DP', 'Diretoria Financeira'],
  };
}


