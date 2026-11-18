import {
  CaixaFerramentaVeiculoRecord,
  CompanyProfile,
  Employee,
  InventoryItem,
  Machinery,
} from '../types';
import { formatCurrencyBRL } from './formatters';
import {
  buildSystemPrintFooterHtml,
  resolveSubscriberPrintHeader,
} from './printIdentity';
import { getCachedMediaUrl } from './imageStorage';

export const TOOL_KITS_STORAGE_KEY = 'agrocontrol_tool_kits';
export const CAIXA_META_STORAGE_KEY = 'agrocontrol_caixa_ferramentas_meta';
export const CAIXA_CONFERENCIAS_STORAGE_KEY = 'agrocontrol_caixa_conferencias_history';

export type ToolboxItemCondition = 'ok' | 'faltando' | 'danificada';

export interface ToolKitItem {
  id: string;
  codigo: string;
  nome: string;
  quantidade: number;
  unidade: string;
  produto_id?: string | null;
  valor_unitario: number;
}

export interface ToolKitRecord {
  id: string;
  nome: string;
  categoria: string;
  descricao?: string;
  itens: ToolKitItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CaixaItemMetadata {
  produto_id?: string | null;
  valor_unitario?: number;
  status_conferencia?: ToolboxItemCondition;
  observacao_conferencia?: string;
  kit_origem_nome?: string;
}

export interface CaixaConferenciaItemSnapshot {
  item_id: string;
  codigo: string;
  nome: string;
  quantidade_esperada: number;
  quantidade_conferida: number;
  valor_unitario: number;
  subtotal: number;
  status: ToolboxItemCondition;
  valor_divergencia: number;
  observacao?: string;
}

export interface CaixaConferenciaRecord {
  id: string;
  veiculo_id: string;
  veiculo_nome: string;
  veiculo_placa?: string;
  veiculo_prefixo?: string;
  veiculo_modelo?: string;
  veiculo_categoria?: string;
  responsavel_id?: string;
  responsavel_nome: string;
  responsavel_cpf?: string;
  responsavel_cargo?: string;
  conferido_por: string;
  data_conferencia: string;
  assinatura_data_url?: string;
  assinatura_confirmada_nominal?: boolean;
  observacoes_gerais?: string;
  valor_total_patrimonio: number;
  valor_total_divergencia: number;
  itens: CaixaConferenciaItemSnapshot[];
}

function makeDefaultKitItem(
  kitKey: string,
  idx: number,
  codigo: string,
  nome: string,
  quantidade: number,
  unidade: string,
  valor_unitario = 0
): ToolKitItem {
  return {
    id: `kit_item_${kitKey}_${idx + 1}`,
    codigo,
    nome,
    quantidade,
    unidade,
    produto_id: null,
    valor_unitario,
  };
}

export function buildDefaultToolKits(): ToolKitRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'kit_forrageiras_colhedoras',
      nome: 'Kit Ferramentas Forrageiras / Colhedoras',
      categoria: 'Forrageira / Colhedora',
      descricao:
        'Kit reforçado para manutenção e ajustes de campo em ensiladeiras, forrageiras e colhedoras.',
      createdAt: now,
      updatedAt: now,
      itens: [
        makeDefaultKitItem('forr', 0, 'FOR-001', 'Jogo Chave Combinada 8 a 32mm', 1, 'JOGO'),
        makeDefaultKitItem('forr', 1, 'FOR-002', 'Chave Grifo 18"', 1, 'UN'),
        makeDefaultKitItem('forr', 2, 'FOR-003', 'Marreta 2kg', 1, 'UN'),
        makeDefaultKitItem('forr', 3, 'FOR-004', 'Engraxadeira Manual Alta Pressão', 1, 'UN'),
        makeDefaultKitItem('forr', 4, 'FOR-005', 'Cabo de Força 3/4" com Soquetes Pesados', 1, 'JOGO'),
        makeDefaultKitItem('forr', 5, 'FOR-006', 'Alicate Universal 8"', 1, 'UN'),
        makeDefaultKitItem('forr', 6, 'FOR-007', 'Alicate de Pressão 10"', 1, 'UN'),
        makeDefaultKitItem('forr', 7, 'FOR-008', 'Chave de Fenda e Philips Reforçada', 2, 'UN'),
        makeDefaultKitItem('forr', 8, 'FOR-009', 'Talhadeira e Punção', 1, 'JOGO'),
      ],
    },
    {
      id: 'kit_caminhao',
      nome: 'Kit Ferramentas Caminhão',
      categoria: 'Caminhão',
      descricao:
        'Ferramental obrigatório e operacional de bordo para caminhões basculantes, truck e apoio.',
      createdAt: now,
      updatedAt: now,
      itens: [
        makeDefaultKitItem('cam', 0, 'CAM-001', 'Chave de Roda Caminhão + Cabo de Força', 1, 'UN'),
        makeDefaultKitItem('cam', 1, 'CAM-002', 'Macaco Hidráulico Garrafa 12t/20t', 1, 'UN'),
        makeDefaultKitItem('cam', 2, 'CAM-003', 'Triângulo de Sinalização', 1, 'UN'),
        makeDefaultKitItem('cam', 3, 'CAM-004', 'Jogo Chave Boca/Estrela 8 a 24mm', 1, 'JOGO'),
        makeDefaultKitItem('cam', 4, 'CAM-005', 'Alicate Universal 8"', 1, 'UN'),
        makeDefaultKitItem('cam', 5, 'CAM-006', 'Chave Fenda e Philips', 2, 'UN'),
        makeDefaultKitItem('cam', 6, 'CAM-007', 'Calibrador de Pneus', 1, 'UN'),
        makeDefaultKitItem('cam', 7, 'CAM-008', 'Lanterna LED', 1, 'UN'),
      ],
    },
    {
      id: 'kit_trator',
      nome: 'Kit Ferramentas Trator',
      categoria: 'Trator',
      descricao:
        'Conjunto padrão de cabine para lubrificação, engate de implementos e pequenos reparos em tratores.',
      createdAt: now,
      updatedAt: now,
      itens: [
        makeDefaultKitItem('tra', 0, 'TRA-001', 'Jogo Chave Combinada 10 a 32mm', 1, 'JOGO'),
        makeDefaultKitItem('tra', 1, 'TRA-002', 'Engraxadeira Manual', 1, 'UN'),
        makeDefaultKitItem('tra', 2, 'TRA-003', 'Chave Ajustável / Inglesa 12"', 1, 'UN'),
        makeDefaultKitItem('tra', 3, 'TRA-004', "Alicate Bomba D'Água", 1, 'UN'),
        makeDefaultKitItem('tra', 4, 'TRA-005', 'Chave Fenda e Philips', 2, 'UN'),
        makeDefaultKitItem('tra', 5, 'TRA-006', 'Martelo Bola 500g', 1, 'UN'),
        makeDefaultKitItem('tra', 6, 'TRA-007', 'Kit Pinos Trava e Contra-Pinos', 1, 'CX'),
      ],
    },
    {
      id: 'kit_cavalo_mecanico',
      nome: 'Kit Ferramentas Cavalo Mecânico',
      categoria: 'Cavalo Mecânico',
      descricao:
        'Kit completo de segurança, ar comprimido, calços e socorro rodoviário para cavalos mecânicos.',
      createdAt: now,
      updatedAt: now,
      itens: [
        makeDefaultKitItem('cav', 0, 'CAV-001', 'Chave de Roda 32/33mm com Cabo', 1, 'UN'),
        makeDefaultKitItem('cav', 1, 'CAV-002', 'Macaco Hidráulico 20t', 1, 'UN'),
        makeDefaultKitItem('cav', 2, 'CAV-003', 'Par de Calços de Roda Borracha', 1, 'PAR'),
        makeDefaultKitItem('cav', 3, 'CAV-004', 'Mangueira Espiral + Bico de Limpeza de Ar', 1, 'UN'),
        makeDefaultKitItem('cav', 4, 'CAV-005', 'Jogo Chave Combinada 8 a 27mm', 1, 'JOGO'),
        makeDefaultKitItem('cav', 5, 'CAV-006', 'Alicate de Pressão 10"', 1, 'UN'),
        makeDefaultKitItem('cav', 6, 'CAV-007', 'Lanterna Recarregável', 1, 'UN'),
        makeDefaultKitItem('cav', 7, 'CAV-008', 'Colete Refletivo', 1, 'UN'),
      ],
    },
  ];
}

export function getStoredToolKits(): ToolKitRecord[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return buildDefaultToolKits();
    }
    const raw = localStorage.getItem(TOOL_KITS_STORAGE_KEY);
    if (raw === null) {
      const defaults = buildDefaultToolKits();
      localStorage.setItem(TOOL_KITS_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const defaults = buildDefaultToolKits();
      localStorage.setItem(TOOL_KITS_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return parsed.map((k: any) => ({
      id: String(k.id || `kit_${Date.now()}`),
      nome: String(k.nome || 'Kit Sem Nome'),
      categoria: String(k.categoria || 'Geral'),
      descricao: k.descricao ? String(k.descricao) : '',
      createdAt: String(k.createdAt || new Date().toISOString()),
      updatedAt: String(k.updatedAt || new Date().toISOString()),
      itens: Array.isArray(k.itens)
        ? k.itens.map((it: any, idx: number) => ({
            id: String(it.id || `kit_item_${idx}_${Date.now()}`),
            codigo: String(it.codigo || ''),
            nome: String(it.nome || ''),
            quantidade: Math.max(0.01, Number(it.quantidade) || 1),
            unidade: String(it.unidade || 'UN'),
            produto_id: it.produto_id ? String(it.produto_id) : null,
            valor_unitario: Math.max(0, Number(it.valor_unitario) || 0),
          }))
        : [],
    }));
  } catch {
    return buildDefaultToolKits();
  }
}

export function saveStoredToolKits(kits: ToolKitRecord[]): ToolKitRecord[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(TOOL_KITS_STORAGE_KEY, JSON.stringify(kits));
    }
  } catch (e) {
    console.warn('Erro ao salvar agrocontrol_tool_kits:', e);
  }
  return kits;
}

/**
 * Resolve o custo unitário (R$) de um item do estoque / última NF-e de entrada.
 */
export function resolveInventoryUnitCost(item?: InventoryItem | null): number {
  if (!item) return 0;
  const anyIt = item as any;
  const candidates = [
    item.custo_com_imposto,
    item.custoComImposto,
    item.unitCost,
    item.preco_custo_inicial,
    item.custo_nominal,
    item.custo_sem_imposto,
    item.custoSemImposto,
    anyIt.lastPurchaseCost,
    anyIt.custo_ultima_compra,
  ];
  for (const val of candidates) {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      return Number(num.toFixed(2));
    }
  }
  return 0;
}

export function getCaixaMetaMap(): Record<string, CaixaItemMetadata> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = localStorage.getItem(CAIXA_META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCaixaMetaForItem(
  itemId: string,
  meta: CaixaItemMetadata,
  fallbackKey?: string
): Record<string, CaixaItemMetadata> {
  const current = getCaixaMetaMap();
  const next: Record<string, CaixaItemMetadata> = {
    ...current,
    [itemId]: { ...(current[itemId] || {}), ...meta },
  };
  if (fallbackKey) {
    next[fallbackKey] = { ...(current[fallbackKey] || {}), ...meta };
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CAIXA_META_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {}
  return next;
}

export function buildCaixaFallbackKey(
  veiculoId?: string | null,
  codigoItem?: string | null
): string {
  return `${String(veiculoId || '').trim()}::${String(codigoItem || '').trim().toUpperCase()}`;
}

export function resolveCaixaItemMeta(
  item: CaixaFerramentaVeiculoRecord,
  metaMap: Record<string, CaixaItemMetadata>,
  products: InventoryItem[]
): CaixaItemMetadata & { valor_unitario_efetivo: number } {
  const fbKey = buildCaixaFallbackKey(item.veiculo_id, item.codigo_item_ferramenta);
  const direct = metaMap[item.id] || metaMap[fbKey] || {};
  const produtoId = item.produto_id ?? direct.produto_id ?? null;

  let valorUnit = Number(item.valor_unitario ?? direct.valor_unitario ?? 0);
  if ((!valorUnit || isNaN(valorUnit)) && produtoId) {
    const prod = products.find(p => p.id === produtoId);
    if (prod) {
      valorUnit = resolveInventoryUnitCost(prod);
    }
  }
  if ((!valorUnit || isNaN(valorUnit)) && item.codigo_item_ferramenta) {
    const codeNorm = String(item.codigo_item_ferramenta || '').trim().toLowerCase();
    const prodByCode = products.find(
      p =>
        String(p.code ?? p.codigo_produto ?? '').trim().toLowerCase() === codeNorm &&
        codeNorm !== ''
    );
    if (prodByCode) {
      valorUnit = resolveInventoryUnitCost(prodByCode);
    }
  }

  return {
    produto_id: produtoId,
    valor_unitario: isNaN(valorUnit) ? 0 : Number(valorUnit.toFixed(2)),
    status_conferencia: item.status_conferencia ?? direct.status_conferencia ?? 'ok',
    observacao_conferencia: item.observacao_conferencia ?? direct.observacao_conferencia ?? '',
    kit_origem_nome: item.kit_origem_nome ?? direct.kit_origem_nome ?? '',
    valor_unitario_efetivo: isNaN(valorUnit) ? 0 : Number(valorUnit.toFixed(2)),
  };
}

export function getStoredCaixaConferencias(): CaixaConferenciaRecord[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(CAIXA_CONFERENCIAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredCaixaConferencia(
  record: CaixaConferenciaRecord
): CaixaConferenciaRecord[] {
  const current = getStoredCaixaConferencias();
  const next = [record, ...current.filter(r => r.id !== record.id)].slice(0, 200);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CAIXA_CONFERENCIAS_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {}
  return next;
}

export function resolveVehicleResponsibleEmployee(
  vehicle: Machinery | undefined,
  employees: Employee[]
): {
  employee?: Employee;
  name: string;
  cpf: string;
  cargo: string;
} {
  if (!vehicle) {
    return { name: '', cpf: '', cargo: '' };
  }

  const assignedIds = Array.isArray(vehicle.assignedDriverIds)
    ? vehicle.assignedDriverIds
    : [];
  for (const id of assignedIds) {
    const found = employees.find(e => e.id === id);
    if (found) {
      return {
        employee: found,
        name: found.name || '',
        cpf: found.cpf || '',
        cargo: found.role || '',
      };
    }
  }

  const candidateNames = [
    ...(Array.isArray(vehicle.assignedDrivers) ? vehicle.assignedDrivers : []),
    vehicle.operatorOrDriver || '',
  ]
    .flatMap(s => String(s || '').split(/[,;/]/))
    .map(s => s.trim())
    .filter(Boolean);

  for (const cand of candidateNames) {
    const candLow = cand.toLowerCase();
    const found = employees.find(
      e => String(e.name || '').trim().toLowerCase() === candLow
    );
    if (found) {
      return {
        employee: found,
        name: found.name || cand,
        cpf: found.cpf || '',
        cargo: found.role || '',
      };
    }
  }

  return {
    name: candidateNames[0] || '',
    cpf: '',
    cargo: '',
  };
}

function escapeHtml(str: string | number | undefined | null): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTimeFullPtBr(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

export function buildTermoConferenciaCaixaHtml(
  conf: CaixaConferenciaRecord,
  companyProfile?: Partial<CompanyProfile> | null
): string {
  const sub = resolveSubscriberPrintHeader(companyProfile);
  const logoSrc = getCachedMediaUrl(sub.logoUrl || companyProfile?.logoUrl) || '';

  const statusLabel = (status: ToolboxItemCondition): string => {
    if (status === 'faltando') return '❌ Faltando / Extraviada';
    if (status === 'danificada') return '⚠️ Danificada';
    return '✅ OK / Presente';
  };

  const statusColor = (status: ToolboxItemCondition): string => {
    if (status === 'faltando') return 'background:#fee2e2;color:#991b1b;border:1px solid #ef4444;';
    if (status === 'danificada') return 'background:#fef3c7;color:#92400e;border:1px solid #f59e0b;';
    return 'background:#dcfce7;color:#166534;border:1px solid #16a34a;';
  };

  const rowsHtml = conf.itens
    .map((it, idx) => {
      const subtotalEsperado = Number(it.quantidade_esperada || 0) * Number(it.valor_unitario || 0);
      return `
        <tr>
          <td style="text-align:center;font-family:monospace;font-weight:700;">${String(idx + 1).padStart(2, '0')}</td>
          <td style="font-family:monospace;font-weight:700;white-space:nowrap;">${escapeHtml(it.codigo)}</td>
          <td style="font-weight:600;">${escapeHtml(it.nome)}${it.observacao ? `<div style="font-size:7.5pt;color:#475569;margin-top:1px;">Obs.: ${escapeHtml(it.observacao)}</div>` : ''}</td>
          <td style="text-align:center;font-weight:700;">${it.quantidade_esperada}</td>
          <td style="text-align:center;font-weight:700;">${it.quantidade_conferida}</td>
          <td style="text-align:right;font-family:monospace;white-space:nowrap;">${escapeHtml(formatCurrencyBRL(it.valor_unitario))}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700;white-space:nowrap;">${escapeHtml(formatCurrencyBRL(subtotalEsperado))}</td>
          <td style="text-align:center;white-space:nowrap;">
            <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:7.5pt;font-weight:700;${statusColor(it.status)}">
              ${statusLabel(it.status)}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Termo de Conferência e Responsabilidade - ${escapeHtml(conf.veiculo_nome)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.35;
    }
    .sheet {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .logo-box {
      width: 64px;
      height: 64px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 3px;
      flex-shrink: 0;
    }
    .logo-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .company-block {
      flex: 1;
      text-align: right;
    }
    .company-name {
      font-size: 13pt;
      font-weight: 900;
      text-transform: uppercase;
      margin: 0;
      color: #0f172a;
    }
    .company-sub {
      font-size: 8pt;
      color: #334155;
      margin-top: 2px;
    }
    .doc-title-box {
      text-align: center;
      background: #e0e6f1;
      border: 1.5px solid #000000;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 10px;
    }
    .doc-title-box h1 {
      margin: 0;
      font-size: 12pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .doc-title-box p {
      margin: 2px 0 0 0;
      font-size: 8pt;
      font-weight: 600;
      color: #334155;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }
    .info-card {
      border: 1px solid #000000;
      border-radius: 5px;
      overflow: hidden;
    }
    .info-card-header {
      background: #cad4e6;
      border-bottom: 1px solid #000000;
      padding: 3px 8px;
      font-size: 7.5pt;
      font-weight: 900;
      text-transform: uppercase;
    }
    .info-card-body {
      padding: 6px 8px;
      font-size: 8.5pt;
      line-height: 1.45;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8.5pt;
    }
    th, td {
      border: 1px solid #000000;
      padding: 4px 6px;
      vertical-align: middle;
    }
    th {
      background: #cad4e6;
      font-size: 7.5pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #000000;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .totals-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      border: 1.5px solid #000000;
      background: #e0e6f1;
      border-radius: 6px;
      padding: 7px 10px;
      margin-bottom: 10px;
      font-size: 9pt;
    }
    .clause-box {
      border: 1px solid #334155;
      background: #f8fafc;
      border-radius: 5px;
      padding: 7px 10px;
      font-size: 8pt;
      text-align: justify;
      line-height: 1.4;
      margin-bottom: 14px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-box {
      text-align: center;
    }
    .sig-img-wrap {
      height: 46px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      margin-bottom: 2px;
    }
    .sig-img-wrap img {
      max-height: 44px;
      max-width: 180px;
      object-fit: contain;
    }
    .sig-line {
      border-top: 1.5px dotted #000000;
      padding-top: 4px;
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
    }
    .sig-sub {
      font-size: 7.5pt;
      color: #475569;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="logo-box">
        ${logoSrc ? `<img src="${logoSrc}" alt="Logo" />` : `<span style="font-weight:900;font-size:16pt;color:#0f172a;">AC</span>`}
      </div>
      <div class="company-block">
        <p class="company-name">${escapeHtml(sub.corporateName || sub.displayTitle)}</p>
        ${sub.tradeName && sub.corporateName && sub.tradeName !== sub.corporateName ? `<div class="company-sub"><strong>Nome Fantasia:</strong> ${escapeHtml(sub.tradeName)}</div>` : ''}
        <div class="company-sub">
          ${sub.cnpjCpf ? `<strong>CNPJ/CPF:</strong> ${escapeHtml(sub.cnpjCpf)}` : ''}
          ${sub.phone ? ` • <strong>Telefone:</strong> ${escapeHtml(sub.phone)}` : ''}
          ${sub.fullAddress ? `<br/><strong>Endereço:</strong> ${escapeHtml(sub.fullAddress)}` : ''}
        </div>
      </div>
    </div>

    <div class="doc-title-box">
      <h1>Termo de Conferência &amp; Responsabilidade — Caixa de Ferramentas</h1>
      <p>Controle Patrimonial de Ferramental Fixo Embarcado em Frota • Documento #${escapeHtml(conf.id.slice(-8).toUpperCase())}</p>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-header">Identificação do Veículo / Máquina</div>
        <div class="info-card-body">
          <div><strong>Veículo / Equipamento:</strong> ${escapeHtml(conf.veiculo_nome)}</div>
          <div><strong>Placa / Prefixo / Série:</strong> ${escapeHtml(conf.veiculo_placa || conf.veiculo_prefixo || 'Não informado')}</div>
          <div><strong>Modelo:</strong> ${escapeHtml(conf.veiculo_modelo || '—')} • <strong>Categoria:</strong> ${escapeHtml(conf.veiculo_categoria || 'Frota')}</div>
        </div>
      </div>

      <div class="info-card">
        <div class="info-card-header">Colaborador Responsável &amp; Conferência</div>
        <div class="info-card-body">
          <div><strong>Motorista / Operador:</strong> ${escapeHtml(conf.responsavel_nome || 'Não informado')}</div>
          <div><strong>CPF:</strong> ${escapeHtml(conf.responsavel_cpf || '—')} • <strong>Cargo:</strong> ${escapeHtml(conf.responsavel_cargo || 'Operador / Motorista')}</div>
          <div><strong>Data da Conferência:</strong> ${escapeHtml(formatDateTimeFullPtBr(conf.data_conferencia))} • <strong>Conferente:</strong> ${escapeHtml(conf.conferido_por)}</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:28px;text-align:center;">#</th>
          <th style="width:76px;">Código</th>
          <th>Ferramenta / Descrição</th>
          <th style="width:52px;text-align:center;">Qtd Esp.</th>
          <th style="width:52px;text-align:center;">Qtd Conf.</th>
          <th style="width:86px;text-align:right;">Valor Unit.</th>
          <th style="width:92px;text-align:right;">Subtotal</th>
          <th style="width:128px;text-align:center;">Status Conferência</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="totals-bar">
      <div>
        <strong>Total de Itens Conferidos:</strong> ${conf.itens.length}
      </div>
      <div>
        <strong>Valor Total do Patrimônio Entregue:</strong>
        <span style="font-family:monospace;font-size:10.5pt;font-weight:900;margin-left:4px;">${escapeHtml(formatCurrencyBRL(conf.valor_total_patrimonio))}</span>
      </div>
      ${
        conf.valor_total_divergencia > 0
          ? `<div style="color:#991b1b;"><strong>Divergência / Falta / Dano:</strong> <span style="font-family:monospace;font-weight:900;">${escapeHtml(formatCurrencyBRL(conf.valor_total_divergencia))}</span></div>`
          : `<div style="color:#166534;"><strong>Divergência:</strong> <span style="font-family:monospace;font-weight:900;">R$ 0,00</span></div>`
      }
    </div>

    ${
      conf.observacoes_gerais
        ? `<div style="margin-bottom:8px;padding:5px 8px;border:1px solid #94a3b8;border-radius:4px;font-size:8pt;"><strong>Observações da Conferência:</strong> ${escapeHtml(conf.observacoes_gerais)}</div>`
        : ''
    }

    <div class="clause-box">
      <strong>CLÁUSULA DE GUARDA E RESPONSABILIDADE PATRIMONIAL:</strong>
      Pelo presente Termo de Conferência e Responsabilidade, eu, <strong>${escapeHtml(conf.responsavel_nome || '____________________________')}</strong>${conf.responsavel_cpf ? `, inscrito no CPF sob o nº <strong>${escapeHtml(conf.responsavel_cpf)}</strong>` : ''}, declaro ter recebido e conferido presencialmente todas as ferramentas acima discriminadas, pertencentes ao patrimônio da empresa <strong>${escapeHtml(sub.corporateName || sub.displayTitle)}</strong>, vinculadas ao veículo/máquina <strong>${escapeHtml(conf.veiculo_nome)}${conf.veiculo_placa ? ` (${escapeHtml(conf.veiculo_placa)})` : ''}</strong>, comprometendo-me a zelar por sua guarda, conservação e uso exclusivo em serviço, bem como a comunicar imediatamente ao Almoxarifado qualquer ocorrência de avaria, dano ou extravio para fins de apuração, reposição e controle patrimonial.
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-img-wrap">
          ${conf.assinatura_data_url ? `<img src="${conf.assinatura_data_url}" alt="Assinatura Digital" />` : ''}
        </div>
        <div class="sig-line">Assinatura do Motorista / Operador</div>
        <div class="sig-sub">${escapeHtml(conf.responsavel_nome || 'Responsável pelo Veículo')}${conf.responsavel_cpf ? ` • CPF: ${escapeHtml(conf.responsavel_cpf)}` : ''}</div>
      </div>

      <div class="sig-box">
        <div class="sig-img-wrap"></div>
        <div class="sig-line">Assinatura do Responsável Almoxarifado</div>
        <div class="sig-sub">${escapeHtml(conf.conferido_por || 'Almoxarifado')} • Data: ${escapeHtml(formatDateTimeFullPtBr(conf.data_conferencia))}</div>
      </div>
    </div>

    ${buildSystemPrintFooterHtml({ extraRight: `Patrimônio: ${formatCurrencyBRL(conf.valor_total_patrimonio)}` })}
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      }, 280);
    });
  </script>
</body>
</html>`;
}
