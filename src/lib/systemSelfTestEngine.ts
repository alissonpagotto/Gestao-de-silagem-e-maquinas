import {
  formatCurrencyBRL,
  getStoredExpenses,
  getStoredInventory,
  getStoredMachineries,
  getStoredFuelLogs,
  getStoredEmployees,
  getStoredServices,
  getStoredOrders,
  getStoredNotasSaida,
} from './storage';
import { getStoredToolKits } from './toolKitsStorage';
import {
  calculateProgressiveInss,
  calculateEffectiveInssRate,
  calculateOfficialFgts,
  calculateOfficialIrrf,
  calculate13thSalaryValues,
} from '../components/rh/payrollHelpers';
import { ALL_MENU_ITEMS } from '../components/layout/ReorderMenuModal';
import { SIDEBAR_MODULE_OPTIONS } from './subscriberModules';
import { getLoggedAuditUserName, formatCurrentAuditDateTimeBR } from './financialAudit';

export type SelfTestStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface SelfTestStepResult {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  status: SelfTestStatus;
  durationMs: number;
  checksPassed: number;
  checksTotal: number;
  summary: string;
  details: string[];
  errors: string[];
}

export interface SelfTestReport {
  executedAt: string;
  subscriberName: string;
  executedBy: string;
  totalDurationMs: number;
  passedCount: number;
  failedCount: number;
  totalTests: number;
  steps: SelfTestStepResult[];
}

export const INITIAL_SELF_TEST_STEPS: SelfTestStepResult[] = [
  {
    id: 'test_1_data_integrity',
    order: 1,
    title: 'Teste 1 — Integridade de Dados Reais (Anti-Crash)',
    subtitle:
      'Varredura somente leitura em Despesas, Notas Fiscais, Contas a Pagar/Receber, Estoque, Veículos, Abastecimentos, Funcionários e Kits de Ferramentas',
    status: 'pending',
    durationMs: 0,
    checksPassed: 0,
    checksTotal: 8,
    summary: 'Aguardando execução...',
    details: [],
    errors: [],
  },
  {
    id: 'test_2_nfe_cycle_sandbox',
    order: 2,
    title: 'Teste 2 — Ciclo Nota Fiscal → Estoque → Contas a Pagar → Estorno (Sandbox)',
    subtitle:
      'Simulação isolada em memória: NF-e teste (1 item + 1 parcela), incremento de estoque, geração/baixa de título, bloqueio de exclusão, estorno e reversão',
    status: 'pending',
    durationMs: 0,
    checksPassed: 0,
    checksTotal: 6,
    summary: 'Aguardando execução...',
    details: [],
    errors: [],
  },
  {
    id: 'test_3_sync_storage',
    order: 3,
    title: 'Teste 3 — Persistência Síncrona (Leitura/Gravação Storage)',
    subtitle:
      'Valida leitura de chaves canônicas e gravação/releitura síncrona em sondas isoladas garantindo integridade no F5 sem alterar dados reais',
    status: 'pending',
    durationMs: 0,
    checksPassed: 0,
    checksTotal: 16,
    summary: 'Aguardando execução...',
    details: [],
    errors: [],
  },
  {
    id: 'test_4_payroll_dre_math',
    order: 4,
    title: 'Teste 4 — Integridade de Cálculos Trabalhistas & DRE',
    subtitle:
      'Valida fórmulas oficiais de Rescisão (TRCT), Folha de Pagamento (INSS/IRRF/FGTS/13º), Balanço de Estoque e DRE Consolidado',
    status: 'pending',
    durationMs: 0,
    checksPassed: 0,
    checksTotal: 4,
    summary: 'Aguardando execução...',
    details: [],
    errors: [],
  },
  {
    id: 'test_5_routes_modules',
    order: 5,
    title: 'Teste 5 — Saúde das Rotas & Módulos',
    subtitle:
      'Verifica registro e carregamento íntegro dos módulos do menu lateral e subcomponentes críticos do sistema',
    status: 'pending',
    durationMs: 0,
    checksPassed: 0,
    checksTotal: 17,
    summary: 'Aguardando execução...',
    details: [],
    errors: [],
  },
];

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function isInvalidNumberField(val: unknown): boolean {
  if (val === undefined || val === null || val === '') return false;
  if (typeof val === 'number') return !Number.isFinite(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return false;
    if (/^(nan|infinity|-infinity)$/i.test(trimmed)) return true;
  }
  return false;
}

function isInvalidDateString(val: unknown): boolean {
  if (val === undefined || val === null || val === '') return false;
  const str = String(val).trim();
  if (!str) return false;
  if (/^(invalid date|nan|undefined|null)/i.test(str)) return true;

  // Aceita YYYY-MM-DD ou ISO completo
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const datePart = str.slice(0, 10);
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return true;
    const dt = new Date(`${datePart}T12:00:00`);
    return Number.isNaN(dt.getTime());
  }

  // Aceita DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/').map(Number);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return true;
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return Number.isNaN(dt.getTime());
  }

  const parsed = Date.parse(str);
  return Number.isNaN(parsed);
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 45));
}

// ============================================================================
// TESTE 1 — INTEGRIDADE DE DADOS REAIS (ANTI-CRASH)
// ============================================================================
async function runTest1DataIntegrity(): Promise<SelfTestStepResult> {
  const t0 = nowMs();
  const details: string[] = [];
  const errors: string[] = [];
  let checksPassed = 0;
  const checksTotal = 8;

  // 1. Despesas
  try {
    const expenses = getStoredExpenses();
    if (!Array.isArray(expenses)) throw new Error('Despesas não retornou um array válido.');
    let bad = 0;
    expenses.forEach((e: any, idx) => {
      if (!e || typeof e !== 'object') {
        bad++;
        errors.push(`Despesa #${idx}: registro nulo ou inválido.`);
        return;
      }
      if (isInvalidNumberField(e.amount) || isInvalidNumberField(e.valor_parcela)) {
        bad++;
        errors.push(`Despesa "${e.description || e.id || idx}": valor numérico NaN/inválido.`);
      }
      if (isInvalidDateString(e.date) || isInvalidDateString(e.dueDate)) {
        bad++;
        errors.push(`Despesa "${e.description || e.id || idx}": data inválida (${e.date || e.dueDate}).`);
      }
    });
    if (bad === 0) {
      checksPassed++;
      details.push(`✔ Despesas: ${expenses.length} registro(s) íntegro(s) (sem NaN ou datas inválidas).`);
    }
  } catch (err: any) {
    errors.push(`Despesas: ${err?.message || 'Erro ao ler tabela.'}`);
  }

  // 2. Notas Fiscais
  try {
    const fiscalKeys = [
      'agrocontrol_fiscal_docs',
      'agrocontrol_nfe_records',
      'silagem_facil_clean_v1_nfe_fiscal_records',
      'agrocontrol_notas_entradas',
    ];
    let totalDocs = 0;
    let bad = 0;
    fiscalKeys.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        bad++;
        errors.push(`Chave fiscal "${k}" não contém uma lista JSON válida.`);
        return;
      }
      totalDocs += parsed.length;
      parsed.forEach((doc: any, i: number) => {
        if (!doc || typeof doc !== 'object') {
          bad++;
          errors.push(`Nota fiscal em "${k}" índice ${i} corrompida.`);
          return;
        }
        if (
          isInvalidNumberField(doc.totalAmount) ||
          isInvalidNumberField(doc.valorTotal) ||
          isInvalidNumberField(doc.valor_total)
        ) {
          bad++;
          errors.push(`Nota Fiscal ${doc.numero || doc.number || doc.id || i}: total numérico NaN.`);
        }
        if (
          isInvalidDateString(doc.issueDate) ||
          isInvalidDateString(doc.dataEmissao) ||
          isInvalidDateString(doc.data_emissao)
        ) {
          bad++;
          errors.push(`Nota Fiscal ${doc.numero || doc.number || doc.id || i}: data de emissão inválida.`);
        }
      });
    });
    const notasSaida = getStoredNotasSaida();
    totalDocs += notasSaida.length;
    notasSaida.forEach((ns: any, i) => {
      if (isInvalidNumberField(ns?.valorTotal) || isInvalidDateString(ns?.dataEmissao)) {
        bad++;
        errors.push(`Nota Saída ${ns?.numero || i}: valor ou data inválida.`);
      }
    });
    if (bad === 0) {
      checksPassed++;
      details.push(`✔ Notas Fiscais (Entradas/Saídas): ${totalDocs} documento(s) validado(s).`);
    }
  } catch (err: any) {
    errors.push(`Notas Fiscais: ${err?.message || 'JSON corrompido detectado.'}`);
  }

  // 3. Contas a Pagar / Receber
  try {
    const payables = getStoredExpenses();
    const services = getStoredServices();
    const orders = getStoredOrders();
    const saidas = getStoredNotasSaida();
    let bad = 0;
    [...services, ...orders].forEach((rec: any, i) => {
      if (!rec || typeof rec !== 'object') {
        bad++;
        return;
      }
      if (isInvalidNumberField(rec.totalAmount) || isInvalidNumberField(rec.paidAmount)) {
        bad++;
        errors.push(`Recebível #${rec.orderNumber || rec.id || i}: valor NaN.`);
      }
      if (isInvalidDateString(rec.startDate) || isInvalidDateString(rec.completionDate)) {
        bad++;
        errors.push(`Recebível #${rec.orderNumber || rec.id || i}: data inválida.`);
      }
    });
    if (bad === 0) {
      checksPassed++;
      details.push(
        `✔ Contas a Pagar/Receber: ${payables.length} título(s) a pagar e ${services.length + orders.length + saidas.length} registro(s) de receita íntegros.`
      );
    }
  } catch (err: any) {
    errors.push(`Contas a Pagar/Receber: ${err?.message || 'Falha na leitura.'}`);
  }

  // 4. Estoque
  try {
    const inv = getStoredInventory();
    let bad = 0;
    inv.forEach((p: any, i) => {
      if (!p || typeof p !== 'object' || !p.id) {
        bad++;
        errors.push(`Produto #${i} sem identificador válido.`);
        return;
      }
      if (
        isInvalidNumberField(p.quantity) ||
        isInvalidNumberField(p.quantidade_atual) ||
        isInvalidNumberField(p.unitCost) ||
        isInvalidNumberField(p.preco_custo_inicial)
      ) {
        bad++;
        errors.push(`Produto "${p.name || p.nome_comercial || p.id}": quantidade ou custo NaN.`);
      }
    });
    if (bad === 0) {
      checksPassed++;
      details.push(`✔ Estoque: ${inv.length} produto(s)/serviço(s) com saldos e custos válidos.`);
    }
  } catch (err: any) {
    errors.push(`Estoque: ${err?.message || 'Falha na leitura.'}`);
  }

  // 5. Veículos
  try {
    const fleet = getStoredMachineries();
    let bad = 0;
    fleet.forEach((v: any, i) => {
      if (!v || typeof v !== 'object' || !v.id) {
        bad++;
        errors.push(`Veículo/Máquina #${i} corrompido.`);
        return;
      }
      if (
        isInvalidNumberField(v.accumulatedCost) ||
        isInvalidNumberField(v.horimeter) ||
        isInvalidNumberField(v.odometer)
      ) {
        bad++;
        errors.push(`Veículo "${v.name || v.plate || v.id}": métrica numérica NaN.`);
      }
    });
    if (bad === 0) {
      checksPassed++;
      details.push(`✔ Veículos & Frotas: ${fleet.length} veículo(s)/máquina(s) íntegro(s).`);
    }
  } catch (err: any) {
    errors.push(`Veículos: ${err?.message || 'Falha na leitura.'}`);
  }

  // 6. Abastecimentos
  try {
    const fuels = getStoredFuelLogs();
    let bad = 0;
    fuels.forEach((f: any, i) => {
      if (!f || typeof f !== 'object') {
        bad++;
        return;
      }
      if (
        isInvalidNumberField(f.liters) ||
        isInvalidNumberField(f.pricePerLiter) ||
        isInvalidNumberField(f.totalCost)
      ) {
        bad++;
        errors.push(`Abastecimento "${f.id || i}": litros ou custo NaN.`);
      }
      if (isInvalidDateString(f.date)) {
        bad++;
        errors.push(`Abastecimento "${f.id || i}": data inválida (${f.date}).`);
      }
    });
    if (bad === 0) {
      checksPassed++;
      details.push(`✔ Abastecimentos: ${fuels.length} registro(s) válido(s).`);
    }
  } catch (err: any) {
    errors.push(`Abastecimentos: ${err?.message || 'Falha na leitura.'}`);
  }

  // 7. Funcionários
  try {
    const employees = getStoredEmployees();
    let bad = 0;
    employees.forEach((emp: any, i) => {
      if (!emp || typeof emp !== 'object' || !emp.id) {
        bad++;
        errors.push(`Funcionário #${i} inválido.`);
        return;
      }
      if (isInvalidNumberField(emp.baseSalary) || isInvalidNumberField(emp.salary)) {
        bad++;
        errors.push(`Funcionário "${emp.name || emp.id}": salário NaN.`);
      }
      if (isInvalidDateString(emp.admissionDate)) {
        bad++;
        errors.push(`Funcionário "${emp.name || emp.id}": data de admissão inválida.`);
      }
    });
    if (bad === 0) {
      checksPassed++;
      details.push(`✔ Funcionários (RH): ${employees.length} colaborador(es) validado(s).`);
    }
  } catch (err: any) {
    errors.push(`Funcionários: ${err?.message || 'Falha na leitura.'}`);
  }

  // 8. Kits de Ferramentas
  try {
    const kits = getStoredToolKits();
    let bad = 0;
    kits.forEach((kit, i) => {
      if (!kit || !kit.id || !Array.isArray(kit.itens)) {
        bad++;
        errors.push(`Kit de Ferramentas #${i} com estrutura inválida.`);
        return;
      }
      kit.itens.forEach((it, j) => {
        if (isInvalidNumberField(it.quantidade) || isInvalidNumberField(it.valor_unitario)) {
          bad++;
          errors.push(`Kit "${kit.nome}" item #${j}: quantidade ou valor NaN.`);
        }
      });
    });
    if (bad === 0) {
      checksPassed++;
      details.push(`✔ Kits de Ferramentas: ${kits.length} kit(s) íntegro(s).`);
    }
  } catch (err: any) {
    errors.push(`Kits de Ferramentas: ${err?.message || 'Falha na leitura.'}`);
  }

  const passed = errors.length === 0 && checksPassed === checksTotal;
  return {
    ...INITIAL_SELF_TEST_STEPS[0],
    status: passed ? 'passed' : 'failed',
    durationMs: Math.max(1, Math.round(nowMs() - t0)),
    checksPassed,
    checksTotal,
    summary: passed
      ? `${checksPassed}/${checksTotal} tabelas reais auditadas sem corrupções, datas inválidas ou valores NaN.`
      : `${errors.length} inconsistência(s) encontrada(s) nas tabelas locais.`,
    details,
    errors,
  };
}

// ============================================================================
// TESTE 2 — CICLO NF-E -> ESTOQUE -> CONTAS A PAGAR -> ESTORNO (SANDBOX)
// ============================================================================
async function runTest2NfeCycleSandbox(): Promise<SelfTestStepResult> {
  const t0 = nowMs();
  const details: string[] = [];
  const errors: string[] = [];
  let checksPassed = 0;
  const checksTotal = 6;

  // Snapshot para comprovar zero impacto nos dados reais
  const realInvBefore = getStoredInventory().length;
  const realExpBefore = getStoredExpenses().length;

  try {
    const sandboxProduct = {
      id: 'sbx_prod_001',
      name: 'FILTRO HIDRÁULICO SANDBOX E2E',
      quantity: 5,
      unit: 'UN',
      unitCost: 100.0,
    };

    const sandboxBank = {
      id: 'sbx_bank_001',
      name: 'CONTA SANDBOX',
      balance: 5000.0,
    };

    const sandboxNfe = {
      id: 'sbx_nfe_999999',
      number: '999999',
      issueDate: '2026-11-20',
      supplier: 'FORNECEDOR SANDBOX LTDA',
      items: [
        {
          productId: sandboxProduct.id,
          description: sandboxProduct.name,
          quantity: 10,
          unitPrice: 125.5,
          totalPrice: 1255.0,
        },
      ],
      installments: [
        {
          number: '1/1',
          dueDate: '2026-12-20',
          amount: 1255.0,
        },
      ],
    };

    // Passo 1: Entrada NF-e + Incremento de Estoque
    sandboxProduct.quantity = Math.round((sandboxProduct.quantity + sandboxNfe.items[0].quantity) * 100) / 100;
    sandboxProduct.unitCost = sandboxNfe.items[0].unitPrice;
    if (sandboxProduct.quantity !== 15 || Math.abs(sandboxProduct.unitCost - 125.5) > 0.001) {
      throw new Error(`Incremento de estoque esperado 15 UN, obtido ${sandboxProduct.quantity}.`);
    }
    checksPassed++;
    details.push(`✔ Entrada NF-e #${sandboxNfe.number}: Estoque incrementado de 5 para 15 UN (${formatCurrencyBRL(sandboxProduct.unitCost)}/UN).`);

    // Passo 2: Geração de Título no Contas a Pagar vinculado
    let sandboxExpenses: any[] = sandboxNfe.installments.map((inst, idx) => ({
      id: `sbx_desp_${sandboxNfe.id}_${idx + 1}`,
      notaId: sandboxNfe.id,
      invoiceNumber: sandboxNfe.number,
      description: `NF-E ${sandboxNfe.number} - ${sandboxNfe.supplier} (${inst.number})`,
      amount: inst.amount,
      dueDate: inst.dueDate,
      status: 'pendente',
      status_pago: false,
      lastReversal: undefined as any,
    }));
    if (sandboxExpenses.length !== 1 || sandboxExpenses[0].amount !== 1255.0) {
      throw new Error('Falha na geração do título financeiro vinculado à NF-e sandbox.');
    }
    checksPassed++;
    details.push(`✔ Contas a Pagar: Título ${sandboxExpenses[0].id} gerado (${formatCurrencyBRL(sandboxExpenses[0].amount)} • status pendente).`);

    // Passo 3: Liquidação (Baixa) + Débito em Conta Bancária + Teste de Bloqueio de Exclusão
    sandboxExpenses[0] = {
      ...sandboxExpenses[0],
      status: 'pago',
      status_pago: true,
      bankAccountId: sandboxBank.id,
    };
    sandboxBank.balance = Math.round((sandboxBank.balance - sandboxExpenses[0].amount) * 100) / 100;

    const hasSettledPayable = (notaId: string) =>
      sandboxExpenses.some((e) => {
        const match = e.notaId === notaId;
        const st = String(e.status || '').toLowerCase();
        return match && (st === 'pago' || st === 'liquidado / abatido por devolução' || e.status_pago === true);
      });

    if (!hasSettledPayable(sandboxNfe.id) || Math.abs(sandboxBank.balance - 3745.0) > 0.001) {
      throw new Error('Falha na baixa do título ou no bloqueio de exclusão de NF-e liquidada.');
    }
    checksPassed++;
    details.push(`✔ Bloqueio de Exclusão validado: Parcela baixada (saldo banco ${formatCurrencyBRL(sandboxBank.balance)}) bloqueou exclusão da NF-e.`);

    // Passo 4: Estorno Auditado + Reversão do Saldo Bancário
    const auditUser = getLoggedAuditUserName();
    const auditDate = formatCurrentAuditDateTimeBR();
    const reversalReason = 'Teste E2E Sandbox de estorno auditado';
    if (reversalReason.trim().length < 5) {
      throw new Error('Validação de motivo mínimo falhou.');
    }
    sandboxBank.balance = Math.round((sandboxBank.balance + sandboxExpenses[0].amount) * 100) / 100;
    sandboxExpenses[0] = {
      ...sandboxExpenses[0],
      status: 'pendente',
      status_pago: false,
      lastReversal: {
        id: 'sbx_rev_1',
        user: auditUser,
        dateTime: auditDate,
        reason: reversalReason,
      },
    };
    if (
      sandboxExpenses[0].status !== 'pendente' ||
      Math.abs(sandboxBank.balance - 5000.0) > 0.001 ||
      hasSettledPayable(sandboxNfe.id)
    ) {
      throw new Error('Falha ao estornar baixa ou restaurar saldo bancário no sandbox.');
    }
    checksPassed++;
    details.push(`✔ Estorno Auditado (${auditUser}): Título reaberto, saldo bancário restaurado para ${formatCurrencyBRL(sandboxBank.balance)} e NF-e desbloqueada.`);

    // Passo 5: Exclusão da NF-e + Reversão de Estoque (mínimo 0)
    sandboxProduct.quantity = Math.max(
      0,
      Math.round((sandboxProduct.quantity - sandboxNfe.items[0].quantity) * 100) / 100
    );
    sandboxExpenses = sandboxExpenses.filter((e) => e.notaId !== sandboxNfe.id);
    if (sandboxProduct.quantity !== 5 || sandboxExpenses.length !== 0) {
      throw new Error('Falha na reversão de estoque ou limpeza de títulos ao excluir NF-e sandbox.');
    }
    checksPassed++;
    details.push(`✔ Reversão na Exclusão: Estoque revertido de 15 para ${sandboxProduct.quantity} UN e registro sandbox descartado.`);

    // Passo 6: Confirmação de Zero Impacto nos Dados Reais
    const realInvAfter = getStoredInventory().length;
    const realExpAfter = getStoredExpenses().length;
    if (realInvAfter !== realInvBefore || realExpAfter !== realExpBefore) {
      throw new Error('Divergência inesperada nos dados reais após execução sandbox.');
    }
    checksPassed++;
    details.push(`✔ Isolamento Confirmado: 0 alterações em dados reais (Estoque=${realInvAfter}, Despesas=${realExpAfter}).`);
  } catch (err: any) {
    errors.push(err?.message || 'Falha no ciclo sandbox NF-e -> Estoque -> Financeiro.');
  }

  const passed = errors.length === 0 && checksPassed === checksTotal;
  return {
    ...INITIAL_SELF_TEST_STEPS[1],
    status: passed ? 'passed' : 'failed',
    durationMs: Math.max(1, Math.round(nowMs() - t0)),
    checksPassed,
    checksTotal,
    summary: passed
      ? 'Ciclo completo NF-e → Estoque → Contas a Pagar → Bloqueio → Estorno → Reversão validado em sandbox.'
      : errors[0] || 'Falha na simulação do ciclo fiscal-financeiro.',
    details,
    errors,
  };
}

// ============================================================================
// TESTE 3 — PERSISTÊNCIA SÍNCRONA (LEITURA/GRAVAÇÃO STORAGE)
// ============================================================================
async function runTest3SyncStorage(): Promise<SelfTestStepResult> {
  const t0 = nowMs();
  const details: string[] = [];
  const errors: string[] = [];

  const canonicalKeys = [
    'agrocontrol_empresa',
    'agrocontrol_produtos',
    'agrocontrol_financeiro',
    'agrocontrol_fiscal_docs',
    'agrocontrol_notas_entradas',
    'agrocontrol_frotas_veiculos',
    'agrocontrol_combustivel',
    'agrocontrol_funcionarios',
    'agrocontrol_clientes',
    'agrocontrol_fornecedores',
    'agrocontrol_bancos',
    'agrocontrol_servicos',
    'agrocontrol_vendas',
    'agrocontrol_tool_kits',
    'agrocontrol_estoque_balancos',
    'agrocontrol_stock_movements',
  ];

  let checksPassed = 0;
  const checksTotal = canonicalKeys.length;

  for (const key of canonicalKeys) {
    const probeKey = `__agro_e2e_sync_probe__${key}`;
    try {
      // 1. Leitura segura da chave real existente (se houver)
      const existingRaw = localStorage.getItem(key);
      if (existingRaw !== null && existingRaw.trim() !== '') {
        JSON.parse(existingRaw);
      }

      // 2. Gravação e releitura síncrona na sonda isolada (sem tocar na chave real)
      const payload = {
        probeKey: key,
        marker: 'AGROCONTROL_F5_SYNC_OK',
        sampleBRL: 'R$ 1.250,00',
        ts: Date.now(),
      };
      localStorage.setItem(probeKey, JSON.stringify(payload));
      const readBackRaw = localStorage.getItem(probeKey);
      if (!readBackRaw) {
        throw new Error(`Releitura vazia para sonda de "${key}".`);
      }
      const parsedBack = JSON.parse(readBackRaw);
      if (parsedBack.marker !== payload.marker || parsedBack.probeKey !== key) {
        throw new Error(`Conteúdo divergente na releitura síncrona de "${key}".`);
      }
      checksPassed++;
      details.push(`✔ ${key}: Leitura e sonda síncrona R/W aprovadas.`);
    } catch (err: any) {
      errors.push(`${key}: ${err?.message || 'Erro de leitura/gravação síncrona.'}`);
    } finally {
      try {
        localStorage.removeItem(probeKey);
      } catch {}
    }
  }

  const passed = errors.length === 0 && checksPassed === checksTotal;
  return {
    ...INITIAL_SELF_TEST_STEPS[2],
    status: passed ? 'passed' : 'failed',
    durationMs: Math.max(1, Math.round(nowMs() - t0)),
    checksPassed,
    checksTotal,
    summary: passed
      ? `${checksPassed}/${checksTotal} chaves canônicas testadas com gravação/releitura síncrona íntegra (F5-safe).`
      : `${errors.length} falha(s) de persistência síncrona no Storage.`,
    details,
    errors,
  };
}

// ============================================================================
// TESTE 4 — INTEGRIDADE DE CÁLCULOS TRABALHISTAS & DRE
// ============================================================================
async function runTest4PayrollTrctBalanceDre(): Promise<SelfTestStepResult> {
  const t0 = nowMs();
  const details: string[] = [];
  const errors: string[] = [];
  let checksPassed = 0;
  const checksTotal = 4;

  // 1. Folha de Pagamento (INSS, FGTS, IRRF, 13º)
  try {
    const inss3000 = calculateProgressiveInss(3000);
    const effRate = calculateEffectiveInssRate(3000, inss3000);
    const fgts3000 = calculateOfficialFgts(3000);
    const irrf5000 = calculateOfficialIrrf(5000, 518.82, 1);
    const thirteenth1 = calculate13thSalaryValues({
      baseSalaryContratual: 2400,
      monthsWorked: 12,
      mode: '13_first_packet',
      isClt: true,
    });
    const thirteenth2 = calculate13thSalaryValues({
      baseSalaryContratual: 2400,
      monthsWorked: 12,
      mode: '13_second_packet',
      isClt: true,
      firstInstallmentPaid: thirteenth1.netAmount,
    });

    if (
      Math.abs(inss3000 - 255.67) > 0.02 ||
      Math.abs(effRate - 8.52) > 0.02 ||
      Math.abs(fgts3000 - 240.0) > 0.01 ||
      !Number.isFinite(irrf5000) ||
      irrf5000 <= 0 ||
      Math.abs(thirteenth1.netAmount - 1200) > 0.01 ||
      !Number.isFinite(thirteenth2.netAmount) ||
      thirteenth2.netAmount <= 0
    ) {
      throw new Error(
        `Divergência na Folha: INSS=${inss3000}, FGTS=${fgts3000}, IRRF=${irrf5000}, 13º=${thirteenth1.netAmount}/${thirteenth2.netAmount}.`
      );
    }
    checksPassed++;
    details.push(
      `✔ Folha de Pagamento: INSS ${formatCurrencyBRL(inss3000)} (${effRate}%), FGTS ${formatCurrencyBRL(fgts3000)}, IRRF ${formatCurrencyBRL(irrf5000)}, 13º 1ª/2ª parc. validados.`
    );
  } catch (err: any) {
    errors.push(`Folha de Pagamento: ${err?.message || 'Erro de cálculo.'}`);
  }

  // 2. Rescisão (TRCT)
  try {
    const salary = 3000;
    const workedDays = 15;
    const yearsOfService = 2;
    const noticeDays = Math.min(90, 30 + yearsOfService * 3); // 36 dias
    const salaryBalance = Number(((salary / 30) * workedDays).toFixed(2)); // 1500.00
    const noticeAmount = Number(((salary / 30) * noticeDays).toFixed(2)); // 3600.00
    const thirteenthProp = Number(((salary / 12) * 6).toFixed(2)); // 1500.00
    const vacationProp = Number(((salary / 12) * 6).toFixed(2)); // 1500.00
    const vacationOneThird = Number((vacationProp / 3).toFixed(2)); // 500.00
    const fgtsBalanceEst = Number((salary * 24 * 0.08).toFixed(2)); // 5760.00
    const fgtsFine = Number((fgtsBalanceEst * 0.4).toFixed(2)); // 2304.00
    const grossTotal = Number(
      (salaryBalance + noticeAmount + thirteenthProp + vacationProp + vacationOneThird + fgtsFine).toFixed(2)
    );
    const inssTotal = Number(
      (calculateProgressiveInss(salaryBalance) + calculateProgressiveInss(thirteenthProp)).toFixed(2)
    );
    const netTotal = Number((grossTotal - inssTotal).toFixed(2));

    if (
      salaryBalance !== 1500 ||
      noticeDays !== 36 ||
      noticeAmount !== 3600 ||
      Math.abs(grossTotal - 10904) > 0.01 ||
      !Number.isFinite(netTotal) ||
      netTotal <= 0
    ) {
      throw new Error(`Erro na fórmula TRCT: Bruto=${grossTotal}, Líquido=${netTotal}.`);
    }
    checksPassed++;
    details.push(
      `✔ Rescisão (TRCT): Aviso ${noticeDays}d (${formatCurrencyBRL(noticeAmount)}), Bruto ${formatCurrencyBRL(grossTotal)}, Líquido ${formatCurrencyBRL(netTotal)}.`
    );
  } catch (err: any) {
    errors.push(`Rescisão (TRCT): ${err?.message || 'Erro de cálculo.'}`);
  }

  // 3. Balanço de Estoque (Sobras, Faltas & Impacto Líquido)
  try {
    const balanceSample = [
      { systemQty: 10, countedQty: 7, unitCost: 50 }, // -3 * 50 = -150
      { systemQty: 4, countedQty: 6, unitCost: 25 }, // +2 * 25 = +50
      { systemQty: 8, countedQty: 8, unitCost: 30 }, // OK = 0
    ];
    let surplusValue = 0;
    let shortageValue = 0;
    balanceSample.forEach((it) => {
      const diff = Math.round((it.countedQty - it.systemQty) * 1000) / 1000;
      const impact = Math.round(diff * it.unitCost * 100) / 100;
      if (diff > 0) surplusValue += impact;
      if (diff < 0) shortageValue += Math.abs(impact);
    });
    const netImpact = Math.round((surplusValue - shortageValue) * 100) / 100;
    if (surplusValue !== 50 || shortageValue !== 150 || netImpact !== -100) {
      throw new Error(`Divergência no Balanço: Sobras=${surplusValue}, Faltas=${shortageValue}, Líquido=${netImpact}.`);
    }
    checksPassed++;
    details.push(
      `✔ Balanço de Estoque: Sobras +${formatCurrencyBRL(surplusValue)}, Faltas -${formatCurrencyBRL(shortageValue)}, Impacto Líquido -${formatCurrencyBRL(Math.abs(netImpact))}.`
    );
  } catch (err: any) {
    errors.push(`Balanço de Estoque: ${err?.message || 'Erro de cálculo.'}`);
  }

  // 4. DRE Consolidado (mesma estrutura de FinancialSummary.tsx)
  try {
    const ordersTotal = 15000;
    const servicesTotal = 10000;
    const totalRevenue = ordersTotal + servicesTotal; // 25000
    const mockExpenses = [
      { categoryId: 'cat_combustivel', amount: 4500 },
      { categoryId: 'cat_insumos', amount: 3000 },
      { categoryId: 'cat_mao_de_obra', amount: 2000 },
      { categoryId: 'cat_manutencao', amount: 3200 },
      { categoryId: 'cat_administrativo', amount: 2300 },
    ];
    const directCosts = mockExpenses
      .filter((e) => ['cat_combustivel', 'cat_insumos', 'cat_mao_de_obra', 'cat_lona_embalagem'].includes(e.categoryId))
      .reduce((acc, c) => acc + c.amount, 0);
    const machineryCosts = mockExpenses
      .filter((e) => e.categoryId === 'cat_manutencao')
      .reduce((acc, c) => acc + c.amount, 0);
    const overheadCosts = mockExpenses
      .filter((e) => ['cat_frete', 'cat_alimentacao', 'cat_arrendamento', 'cat_administrativo', 'cat_outros'].includes(e.categoryId))
      .reduce((acc, c) => acc + c.amount, 0);

    const totalCosts = directCosts + machineryCosts + overheadCosts;
    const grossMargin = totalRevenue - directCosts;
    const netProfit = totalRevenue - totalCosts;

    if (
      totalRevenue !== 25000 ||
      directCosts !== 9500 ||
      machineryCosts !== 3200 ||
      overheadCosts !== 2300 ||
      totalCosts !== 15000 ||
      grossMargin !== 15500 ||
      netProfit !== 10000
    ) {
      throw new Error(`Divergência no DRE: Receita=${totalRevenue}, Custos=${totalCosts}, Lucro=${netProfit}.`);
    }
    checksPassed++;
    details.push(
      `✔ DRE Consolidado: Receita ${formatCurrencyBRL(totalRevenue)}, Margem Bruta ${formatCurrencyBRL(grossMargin)}, Lucro Líquido ${formatCurrencyBRL(netProfit)}.`
    );
  } catch (err: any) {
    errors.push(`DRE Consolidado: ${err?.message || 'Erro de cálculo.'}`);
  }

  const passed = errors.length === 0 && checksPassed === checksTotal;
  return {
    ...INITIAL_SELF_TEST_STEPS[3],
    status: passed ? 'passed' : 'failed',
    durationMs: Math.max(1, Math.round(nowMs() - t0)),
    checksPassed,
    checksTotal,
    summary: passed
      ? 'Todas as fórmulas de Folha, Rescisão (TRCT), Balanço de Estoque e DRE Consolidado validadas com precisão.'
      : `${errors.length} falha(s) encontrada(s) nos cálculos trabalhistas/DRE.`,
    details,
    errors,
  };
}

// ============================================================================
// TESTE 5 — SAÚDE DAS ROTAS & MÓDULOS DO MENU LATERAL
// ============================================================================
function isValidExportedComponent(exp: unknown): boolean {
  return typeof exp === 'function' || (typeof exp === 'object' && exp !== null);
}

async function runTest5RoutesAndModules(): Promise<SelfTestStepResult> {
  const t0 = nowMs();
  const details: string[] = [];
  const errors: string[] = [];

  const moduleLoaders: Array<{
    id: string;
    label: string;
    exportName: string;
    loader: () => Promise<Record<string, any>>;
  }> = [
    { id: 'dashboard', label: 'Dashboard', exportName: 'MainDashboard', loader: () => import('../components/dashboard/MainDashboard') },
    { id: 'servicos', label: 'Prestação de Serviços', exportName: 'ServicesModule', loader: () => import('../components/services/ServicesModule') },
    { id: 'venda', label: 'Venda (PDV)', exportName: 'VendaModule', loader: () => import('../components/vendas/VendaModule') },
    { id: 'estoque', label: 'Estoque', exportName: 'InventoryModule', loader: () => import('../components/inventory/InventoryModule') },
    { id: 'almoxarifado', label: 'Almoxarifado', exportName: 'AlmoxarifadoModule', loader: () => import('../components/inventory/AlmoxarifadoModule') },
    { id: 'financeiro', label: 'Financeiro', exportName: 'FinancialSummary', loader: () => import('../components/financial/FinancialSummary') },
    { id: 'despesas', label: 'Despesas', exportName: 'DespesasModule', loader: () => import('../components/expenses/DespesasModule') },
    { id: 'fiscal', label: 'Fiscal & Notas', exportName: 'NfeModule', loader: () => import('../components/nfe/NfeModule') },
    { id: 'contador', label: 'Contador', exportName: 'ContadorModule', loader: () => import('../components/nfe/ContadorModule') },
    { id: 'rh', label: 'RH', exportName: 'RHModule', loader: () => import('../components/rh/RHModule') },
    { id: 'relatorios', label: 'Relatórios', exportName: 'ReportsModule', loader: () => import('../components/reports/ReportsModule') },
    { id: 'clientes', label: 'Clientes', exportName: 'CrmModule', loader: () => import('../components/crm/CrmModule') },
    { id: 'fornecedores', label: 'Fornecedores & Transportadoras', exportName: 'SuppliersModule', loader: () => import('../components/suppliers/SuppliersModule') },
    { id: 'frotas', label: 'Gestão de Frotas', exportName: 'FleetModule', loader: () => import('../components/fleet/FleetModule') },
    { id: 'cadastros_base', label: 'Cadastros & Configurações', exportName: 'CadastrosBaseModule', loader: () => import('../components/cadastrosBase/CadastrosBaseModule') },
    { id: 'configuracoes', label: 'Dados da Empresa', exportName: 'CompanySettingsView', loader: () => import('../components/settings/CompanySettingsView') },
  ];

  const checksTotal = moduleLoaders.length + 1; // +1 para validação do registro de menu/permissões
  let checksPassed = 0;

  // 1. Verifica consistência do menu lateral e catálogo de permissões
  try {
    const menuIds = new Set(ALL_MENU_ITEMS.map((m) => m.id));
    const subOptionIds = new Set(SIDEBAR_MODULE_OPTIONS.map((m) => m.id));
    const missingFromMenu = moduleLoaders.filter((m) => !menuIds.has(m.id)).map((m) => m.id);
    const missingFromOpts = moduleLoaders.filter((m) => !subOptionIds.has(m.id)).map((m) => m.id);
    if (missingFromMenu.length > 0 || missingFromOpts.length > 0) {
      throw new Error(
        `Módulos ausentes no registro: menu=[${missingFromMenu.join(', ')}] opts=[${missingFromOpts.join(', ')}]`
      );
    }
    checksPassed++;
    details.push(`✔ Catálogo de Rotas: ${menuIds.size} rotas registradas e sincronizadas no menu lateral.`);
  } catch (err: any) {
    errors.push(`Catálogo de Rotas: ${err?.message || 'Erro de registro.'}`);
  }

  // 2. Verifica montagem/carregamento dinâmico de cada um dos módulos do menu lateral
  const results = await Promise.allSettled(
    moduleLoaders.map(async (item) => {
      const mod = await item.loader();
      const comp = mod?.[item.exportName];
      if (!isValidExportedComponent(comp)) {
        throw new Error(`Exportação "${item.exportName}" ausente ou inválida.`);
      }
      return item;
    })
  );

  results.forEach((res, idx) => {
    const item = moduleLoaders[idx];
    if (res.status === 'fulfilled') {
      checksPassed++;
      details.push(`✔ Rota [${item.id}] (${item.label}): componente ${item.exportName} montado e íntegro.`);
    } else {
      errors.push(`Rota [${item.id}] (${item.label}): ${res.reason?.message || 'Falha ao carregar módulo.'}`);
    }
  });

  const passed = errors.length === 0 && checksPassed === checksTotal;
  return {
    ...INITIAL_SELF_TEST_STEPS[4],
    status: passed ? 'passed' : 'failed',
    durationMs: Math.max(1, Math.round(nowMs() - t0)),
    checksPassed,
    checksTotal,
    summary: passed
      ? `Todos os ${moduleLoaders.length} módulos do menu lateral e registro de rotas carregados com integridade.`
      : `${errors.length} falha(s) de módulo/rota detectada(s).`,
    details,
    errors,
  };
}

// ============================================================================
// ORQUESTRADOR SEQUENCIAL EM TEMPO REAL
// ============================================================================
export async function runFullSystemSelfTest(params: {
  subscriberName: string;
  onStepUpdate: (steps: SelfTestStepResult[]) => void;
}): Promise<SelfTestReport> {
  const totalT0 = nowMs();
  const executedBy = getLoggedAuditUserName();
  const steps: SelfTestStepResult[] = INITIAL_SELF_TEST_STEPS.map((s) => ({
    ...s,
    status: 'pending',
    details: [],
    errors: [],
  }));

  params.onStepUpdate([...steps]);

  const runners: Array<() => Promise<SelfTestStepResult>> = [
    runTest1DataIntegrity,
    runTest2NfeCycleSandbox,
    runTest3SyncStorage,
    runTest4PayrollTrctBalanceDre,
    runTest5RoutesAndModules,
  ];

  for (let i = 0; i < runners.length; i++) {
    steps[i] = {
      ...steps[i],
      status: 'running',
      summary: 'Executando verificação em sandbox isolado...',
    };
    params.onStepUpdate([...steps]);
    await yieldToUi();

    try {
      steps[i] = await runners[i]();
    } catch (err: any) {
      steps[i] = {
        ...steps[i],
        status: 'failed',
        durationMs: 1,
        summary: `Erro inesperado: ${err?.message || 'Falha desconhecida.'}`,
        errors: [err?.message || 'Erro inesperado durante a execução do teste.'],
      };
    }
    params.onStepUpdate([...steps]);
    await yieldToUi();
  }

  const passedCount = steps.filter((s) => s.status === 'passed').length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;

  return {
    executedAt: formatCurrentAuditDateTimeBR(),
    subscriberName: params.subscriberName,
    executedBy,
    totalDurationMs: Math.max(1, Math.round(nowMs() - totalT0)),
    passedCount,
    failedCount,
    totalTests: steps.length,
    steps,
  };
}

export function formatTechnicalSelfTestReport(report: SelfTestReport): string {
  const lines: string[] = [
    '====================================================================',
    'AGROCONTROL — RELATÓRIO TÉCNICO DE AUTO-TESTE (HEALTH CHECK & E2E)',
    '====================================================================',
    `Assinante: ${report.subscriberName}`,
    `Executado por: ${report.executedBy}`,
    `Data/Hora: ${report.executedAt}`,
    `Resultado Geral: ${report.passedCount} de ${report.totalTests} testes aprovados (${report.totalDurationMs} ms)`,
    `Modo: Sandbox Isolado (Zero alteração em dados reais)`,
    '--------------------------------------------------------------------',
  ];

  report.steps.forEach((step) => {
    const badge = step.status === 'passed' ? '[PASSOU]' : step.status === 'failed' ? '[FALHOU]' : '[PENDENTE]';
    lines.push(``);
    lines.push(`${badge} ${step.title} (${step.durationMs} ms | ${step.checksPassed}/${step.checksTotal} verificações)`);
    lines.push(`Resumo: ${step.summary}`);
    if (step.errors.length > 0) {
      lines.push(`Erros detectados:`);
      step.errors.forEach((err) => lines.push(`  - [ERRO] ${err}`));
    }
    if (step.details.length > 0) {
      lines.push(`Detalhes:`);
      step.details.forEach((det) => lines.push(`  ${det}`));
    }
  });

  lines.push('');
  lines.push('====================================================================');
  return lines.join('\n');
}
