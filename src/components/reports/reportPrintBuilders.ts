import {
  CompanyProfile,
  Expense,
  FuelLog,
  Machinery,
  ServiceOrder,
  SilageOrder,
} from '../../types';
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
  | 'imobilizado'
  | 'exportar'
  | 'cortes'
  | 'vendas'
  | 'despesas'
  | 'consumo';

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
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredServices,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    filterType = 'todos',
  } = params;
  const seg = resolveReportSegmentContext(companyProfile);
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalHectares = filteredServices.reduce((s, item) => s + (item.areaHectares || 0), 0);
  const totalTons = filteredServices.reduce((s, item) => s + (item.tonsEstimated || 0), 0);
  const totalRevenue = filteredServices.reduce((s, item) => s + (item.totalAmount || 0), 0);
  const avgPerHa = totalHectares > 0 ? totalRevenue / totalHectares : 0;

  const filtersHtml = buildFilterChipsHtml([
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

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
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

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO DE SERVIÇOS EXECUTADOS*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `📋 *Ordens Filtradas:* ${filteredServices.length}\n` +
    `🌾 *Área Total:* ${totalHectares.toFixed(1)} ha\n` +
    `⚖️ *Volume Estimado:* ${totalTons.toFixed(1)} ton\n` +
    `💰 *Faturamento Total:* ${formatCurrencyBRL(totalRevenue)}`;

  return {
    title: seg.servicesDocTitle,
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
}): ReportPrintConfig {
  const {
    companyProfile,
    filteredOrders,
    startDate,
    endDate,
    competence,
    searchTerm = '',
    productFilter = 'todos',
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

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
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

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO ANALÍTICO DE VENDAS*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `🛒 *Pedidos:* ${filteredOrders.length}\n` +
    `⚖️ *Volume Total:* ${totalTons.toFixed(1)} ton\n` +
    `💰 *Faturamento Total:* ${formatCurrencyBRL(totalRevenue)}\n` +
    `🎯 *Ticket Médio:* ${formatCurrencyBRL(ticketMedio)}\n` +
    `✅ *Pago:* ${formatCurrencyBRL(paidAmount)} (${paidOrders.length}) | ⏳ *Pendente:* ${formatCurrencyBRL(pendingAmount)} (${pendingOrders.length})`;

  return {
    title: 'Relatório Analítico de Vendas & Faturamento',
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
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalAmount = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const paidItems = filteredExpenses.filter((e) => e.status === 'pago');
  const pendingItems = filteredExpenses.filter((e) => e.status !== 'pago');
  const paidAmount = paidItems.reduce((s, e) => s + (e.amount || 0), 0);
  const pendingAmount = pendingItems.reduce((s, e) => s + (e.amount || 0), 0);

  // Category aggregation
  const catMap = new Map<string, { count: number; paid: number; pending: number; total: number }>();
  filteredExpenses.forEach((e) => {
    const key = e.categoryName || 'Outras Despesas';
    const curr = catMap.get(key) || { count: 0, paid: 0, pending: 0, total: 0 };
    curr.count += 1;
    curr.total += e.amount || 0;
    if (e.status === 'pago') curr.paid += e.amount || 0;
    else curr.pending += e.amount || 0;
    catMap.set(key, curr);
  });
  const categoryBreakdown = Array.from(catMap.entries()).sort((a, b) => b[1].total - a[1].total);

  const filtersHtml = buildFilterChipsHtml([
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

  const catTableHtml =
    categoryBreakdown.length > 0
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
          ${categoryBreakdown
            .map(([cat, stats]) => {
              const pct = totalAmount > 0 ? (stats.total / totalAmount) * 100 : 0;
              return `
                <tr style="font-size:8.5pt;">
                  <td style="font-weight:700;">${escapeHtml(cat)}</td>
                  <td style="text-align:center;">${stats.count}</td>
                  <td style="text-align:right;color:#047857;">${formatCurrencyBRL(stats.paid)}</td>
                  <td style="text-align:right;color:#b45309;">${formatCurrencyBRL(stats.pending)}</td>
                  <td style="text-align:right;font-weight:800;color:#b91c1c;">${formatCurrencyBRL(stats.total)}</td>
                  <td style="text-align:right;">${pct.toFixed(1)}%</td>
                </tr>
              `;
            })
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

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
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

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO ANALÍTICO DE DESPESAS*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `💸 *Total Geral:* ${formatCurrencyBRL(totalAmount)} (${filteredExpenses.length} lançamentos)\n` +
    `✅ *Total Pago:* ${formatCurrencyBRL(paidAmount)} (${paidItems.length})\n` +
    `⏳ *Total Pendente:* ${formatCurrencyBRL(pendingAmount)} (${pendingItems.length})`;

  return {
    title: 'Relatório Analítico de Despesas & Custos',
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
  } = params;
  const subHeader = resolveSubscriberPrintHeader(companyProfile);

  const totalLiters = filteredLogs.reduce((s, l) => s + (l.liters || 0), 0);
  const totalAmount = filteredLogs.reduce((s, l) => s + (l.totalAmount || 0), 0);
  const avgPricePerLiter = totalLiters > 0 ? totalAmount / totalLiters : 0;

  const filtersHtml = buildFilterChipsHtml([
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

  const contentHtml = `
    ${filtersHtml}
    ${kpiHtml}
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

  const whatsappText =
    `📊 *${subHeader.displayTitle.toUpperCase()}*\n` +
    `📑 *RELATÓRIO DE CONSUMO DE COMBUSTÍVEL*\n` +
    `📅 *Período:* ${formatDateBR(startDate)} a ${formatDateBR(endDate)} (Comp. ${competence})\n\n` +
    `⛽ *Abastecimentos:* ${filteredLogs.length}\n` +
    `💧 *Litros Totais:* ${totalLiters.toFixed(1)} L\n` +
    `⚖️ *Preço Médio / Litro:* ${formatCurrencyBRL(avgPricePerLiter)}\n` +
    `💸 *Custo Total:* ${formatCurrencyBRL(totalAmount)}`;

  return {
    title: 'Relatório de Consumo de Combustível & Eficiência',
    subtitle: `Competência ${competence} • Período: ${formatDateBR(startDate)} a ${formatDateBR(endDate)}`,
    documentType: 'RELATÓRIO DE CONSUMO',
    contentHtml,
    whatsappText,
    orientation: 'landscape',
    signatureLabels: STANDARD_REPORT_SIGNATURES,
  };
}
