import {
  CfopCatalogEntry,
  CfopOperacaoTipo,
  Lc116ServiceCodeEntry,
  NotaSaidaModelKey,
  NotaSaidaRecord,
  TipoDocumentoSaida,
} from '../types';
import { cleanDigits } from './formatters';

export const CFOP_CATALOG_STORAGE_KEY = 'agrocontrol_catalogo_cfop';
export const NOTA_SAIDA_SEQUENCE_STORAGE_KEY = 'agrocontrol_sequencia_notas';

export const DEFAULT_CFOP_CATALOG: CfopCatalogEntry[] = [
  // VENDAS (5xxx / 6xxx)
  { codigo: '5101', descricao: 'Venda de produção do estabelecimento (Silagem / Grãos / Produção própria)', tipo: 'venda', isDefault: true },
  { codigo: '6101', descricao: 'Venda de produção do estabelecimento (Silagem / Grãos / Produção própria)', tipo: 'venda', isDefault: true },
  { codigo: '5102', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros (Peças / Insumos)', tipo: 'venda', isDefault: true },
  { codigo: '6102', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros (Peças / Insumos)', tipo: 'venda', isDefault: true },
  { codigo: '5401', descricao: 'Venda de produção do estabelecimento com Substituição Tributária (ST)', tipo: 'venda', isDefault: true },
  { codigo: '6401', descricao: 'Venda de produção do estabelecimento com Substituição Tributária (ST)', tipo: 'venda', isDefault: true },
  { codigo: '5403', descricao: 'Venda de mercadoria adquirida com ST (Contribuinte Substituto)', tipo: 'venda', isDefault: true },
  { codigo: '6403', descricao: 'Venda de mercadoria adquirida com ST (Contribuinte Substituto)', tipo: 'venda', isDefault: true },
  { codigo: '5405', descricao: 'Venda de mercadoria adquirida com ICMS retido anteriormente por ST', tipo: 'venda', isDefault: true },
  { codigo: '6405', descricao: 'Venda de mercadoria adquirida com ICMS retido anteriormente por ST', tipo: 'venda', isDefault: true },
  { codigo: '5656', descricao: 'Venda de combustível ou lubrificante adquirido para comercialização', tipo: 'venda', isDefault: true },
  { codigo: '6656', descricao: 'Venda de combustível ou lubrificante adquirido para comercialização', tipo: 'venda', isDefault: true },

  // REMESSAS, RETORNOS E OUTRAS SAÍDAS (5xxx / 6xxx)
  { codigo: '5901', descricao: 'Remessa para industrialização por encomenda', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6901', descricao: 'Remessa para industrialização por encomenda', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5902', descricao: 'Retorno de mercadoria utilizada na industrialização', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6902', descricao: 'Retorno de mercadoria utilizada na industrialização', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5905', descricao: 'Remessa para depósito fechado ou armazém geral', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6905', descricao: 'Remessa para depósito fechado ou armazém geral', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5906', descricao: 'Retorno de mercadoria depositada em depósito fechado ou armazém geral', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6906', descricao: 'Retorno de mercadoria depositada em depósito fechado ou armazém geral', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5908', descricao: 'Remessa de bem por conta de contrato de comodato / locação', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6908', descricao: 'Remessa de bem por conta de contrato de comodato / locação', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5909', descricao: 'Retorno de bem recebido por conta de contrato de comodato', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6909', descricao: 'Retorno de bem recebido por conta de contrato de comodato', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5910', descricao: 'Remessa em bonificação, doação ou brinde', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6910', descricao: 'Remessa em bonificação, doação ou brinde', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5912', descricao: 'Remessa de mercadoria ou bem para demonstração', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6912', descricao: 'Remessa de mercadoria ou bem para demonstração', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5915', descricao: 'Remessa de mercadoria ou bem para conserto ou reparo', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6915', descricao: 'Remessa de mercadoria ou bem para conserto ou reparo', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5916', descricao: 'Retorno de mercadoria ou bem recebido para conserto ou reparo', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6916', descricao: 'Retorno de mercadoria ou bem recebido para conserto ou reparo', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5920', descricao: 'Remessa de vasilhame ou sacaria', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6920', descricao: 'Remessa de vasilhame ou sacaria', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5921', descricao: 'Devolução de vasilhame ou sacaria', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6921', descricao: 'Devolução de vasilhame ou sacaria', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5949', descricao: 'Outra saída de mercadoria ou prestação de serviço não especificada (Simples Remessa / Garantia)', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6949', descricao: 'Outra saída de mercadoria ou prestação de serviço não especificada (Simples Remessa / Garantia)', tipo: 'remessa_retorno', isDefault: true },

  // DEVOLUÇÕES DE COMPRA (5xxx / 6xxx)
  { codigo: '5201', descricao: 'Devolução de compra para industrialização ou produção rural', tipo: 'devolucao', isDefault: true },
  { codigo: '6201', descricao: 'Devolução de compra para industrialização ou produção rural', tipo: 'devolucao', isDefault: true },
  { codigo: '5202', descricao: 'Devolução de compra para comercialização', tipo: 'devolucao', isDefault: true },
  { codigo: '6202', descricao: 'Devolução de compra para comercialização', tipo: 'devolucao', isDefault: true },
  { codigo: '5411', descricao: 'Devolução de compra para comercialização em operação com ST', tipo: 'devolucao', isDefault: true },
  { codigo: '6411', descricao: 'Devolução de compra para comercialização em operação com ST', tipo: 'devolucao', isDefault: true },
  { codigo: '5556', descricao: 'Devolução de compra de material de uso ou consumo', tipo: 'devolucao', isDefault: true },
  { codigo: '6556', descricao: 'Devolução de compra de material de uso ou consumo', tipo: 'devolucao', isDefault: true },

  // TRANSPORTE / CT-e (5xxx / 6xxx)
  { codigo: '5351', descricao: 'Prestação de serviço de transporte para execução de serviço da mesma natureza', tipo: 'transporte', isDefault: true },
  { codigo: '6351', descricao: 'Prestação de serviço de transporte para execução de serviço da mesma natureza', tipo: 'transporte', isDefault: true },
  { codigo: '5352', descricao: 'Prestação de serviço de transporte a estabelecimento industrial', tipo: 'transporte', isDefault: true },
  { codigo: '6352', descricao: 'Prestação de serviço de transporte a estabelecimento industrial', tipo: 'transporte', isDefault: true },
  { codigo: '5353', descricao: 'Prestação de serviço de transporte a estabelecimento comercial', tipo: 'transporte', isDefault: true },
  { codigo: '6353', descricao: 'Prestação de serviço de transporte a estabelecimento comercial', tipo: 'transporte', isDefault: true },
  { codigo: '5357', descricao: 'Prestação de serviço de transporte a não contribuinte (Produtor Rural / Pessoa Física)', tipo: 'transporte', isDefault: true },
  { codigo: '6357', descricao: 'Prestação de serviço de transporte a não contribuinte (Produtor Rural / Pessoa Física)', tipo: 'transporte', isDefault: true },
  { codigo: '5932', descricao: 'Prestação de serviço de transporte iniciada em UF diversa daquela onde inscrito o prestador', tipo: 'transporte', isDefault: true },
  { codigo: '6932', descricao: 'Prestação de serviço de transporte iniciada em UF diversa daquela onde inscrito o prestador', tipo: 'transporte', isDefault: true },
];

export const OFFICIAL_SEFAZ_EXPANDED_CFOP_CATALOG: CfopCatalogEntry[] = [
  ...DEFAULT_CFOP_CATALOG,
  // Operações Adicionais Oficiais SEFAZ (Rurais, Transferências, Entrega Futura, Ativo Imobilizado, Exportação e Transporte)
  { codigo: '5103', descricao: 'Venda de produção do estabelecimento efetuada fora do estabelecimento', tipo: 'venda', isDefault: true },
  { codigo: '6103', descricao: 'Venda de produção do estabelecimento efetuada fora do estabelecimento', tipo: 'venda', isDefault: true },
  { codigo: '5104', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros efetuada fora do estabelecimento', tipo: 'venda', isDefault: true },
  { codigo: '6104', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros efetuada fora do estabelecimento', tipo: 'venda', isDefault: true },
  { codigo: '5105', descricao: 'Venda de produção do estabelecimento que não deva por ele transitar', tipo: 'venda', isDefault: true },
  { codigo: '6105', descricao: 'Venda de produção do estabelecimento que não deva por ele transitar', tipo: 'venda', isDefault: true },
  { codigo: '5106', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros que não deva por ele transitar', tipo: 'venda', isDefault: true },
  { codigo: '6106', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros que não deva por ele transitar', tipo: 'venda', isDefault: true },
  { codigo: '6107', descricao: 'Venda de produção do estabelecimento destinada a não contribuinte', tipo: 'venda', isDefault: true },
  { codigo: '6108', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros destinada a não contribuinte', tipo: 'venda', isDefault: true },
  { codigo: '5116', descricao: 'Venda de produção do estabelecimento originada de encomenda para entrega futura', tipo: 'venda', isDefault: true },
  { codigo: '6116', descricao: 'Venda de produção do estabelecimento originada de encomenda para entrega futura', tipo: 'venda', isDefault: true },
  { codigo: '5117', descricao: 'Venda de mercadoria adquirida originada de encomenda para entrega futura', tipo: 'venda', isDefault: true },
  { codigo: '6117', descricao: 'Venda de mercadoria adquirida originada de encomenda para entrega futura', tipo: 'venda', isDefault: true },
  { codigo: '5118', descricao: 'Venda de produção do estabelecimento entregue ao destinatário por conta e ordem', tipo: 'venda', isDefault: true },
  { codigo: '6118', descricao: 'Venda de produção do estabelecimento entregue ao destinatário por conta e ordem', tipo: 'venda', isDefault: true },
  { codigo: '5151', descricao: 'Transferência de produção do estabelecimento', tipo: 'outros', isDefault: true },
  { codigo: '6151', descricao: 'Transferência de produção do estabelecimento', tipo: 'outros', isDefault: true },
  { codigo: '5152', descricao: 'Transferência de mercadoria adquirida ou recebida de terceiros', tipo: 'outros', isDefault: true },
  { codigo: '6152', descricao: 'Transferência de mercadoria adquirida ou recebida de terceiros', tipo: 'outros', isDefault: true },
  { codigo: '5208', descricao: 'Devolução de mercadoria recebida em transferência para industrialização ou produção rural', tipo: 'devolucao', isDefault: true },
  { codigo: '6208', descricao: 'Devolução de mercadoria recebida em transferência para industrialização ou produção rural', tipo: 'devolucao', isDefault: true },
  { codigo: '5209', descricao: 'Devolução de mercadoria recebida em transferência para comercialização', tipo: 'devolucao', isDefault: true },
  { codigo: '6209', descricao: 'Devolução de mercadoria recebida em transferência para comercialização', tipo: 'devolucao', isDefault: true },
  { codigo: '5402', descricao: 'Venda de produção do estabelecimento em operação com ST (Substituto)', tipo: 'venda', isDefault: true },
  { codigo: '6402', descricao: 'Venda de produção do estabelecimento em operação com ST (Substituto)', tipo: 'venda', isDefault: true },
  { codigo: '5409', descricao: 'Transferência de mercadoria adquirida ou recebida de terceiros em operação com ST', tipo: 'outros', isDefault: true },
  { codigo: '6409', descricao: 'Transferência de mercadoria adquirida ou recebida de terceiros em operação com ST', tipo: 'outros', isDefault: true },
  { codigo: '5410', descricao: 'Devolução de compra para industrialização ou produção rural em operação com ST', tipo: 'devolucao', isDefault: true },
  { codigo: '6410', descricao: 'Devolução de compra para industrialização ou produção rural em operação com ST', tipo: 'devolucao', isDefault: true },
  { codigo: '5501', descricao: 'Remessa de produção do estabelecimento com fim específico de exportação', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6501', descricao: 'Remessa de produção do estabelecimento com fim específico de exportação', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5502', descricao: 'Remessa de mercadoria adquirida ou recebida de terceiros com fim específico de exportação', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6502', descricao: 'Remessa de mercadoria adquirida ou recebida de terceiros com fim específico de exportação', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5551', descricao: 'Venda de bem do ativo imobilizado', tipo: 'venda', isDefault: true },
  { codigo: '6551', descricao: 'Venda de bem do ativo imobilizado', tipo: 'venda', isDefault: true },
  { codigo: '5552', descricao: 'Transferência de bem do ativo imobilizado', tipo: 'outros', isDefault: true },
  { codigo: '6552', descricao: 'Transferência de bem do ativo imobilizado', tipo: 'outros', isDefault: true },
  { codigo: '5553', descricao: 'Devolução de compra de bem para o ativo imobilizado', tipo: 'devolucao', isDefault: true },
  { codigo: '6553', descricao: 'Devolução de compra de bem para o ativo imobilizado', tipo: 'devolucao', isDefault: true },
  { codigo: '5554', descricao: 'Remessa de bem do ativo imobilizado para uso fora do estabelecimento', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6554', descricao: 'Remessa de bem do ativo imobilizado para uso fora do estabelecimento', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5555', descricao: 'Devolução de bem do ativo imobilizado de terceiro recebido para uso no estabelecimento', tipo: 'devolucao', isDefault: true },
  { codigo: '6555', descricao: 'Devolução de bem do ativo imobilizado de terceiro recebido para uso no estabelecimento', tipo: 'devolucao', isDefault: true },
  { codigo: '5653', descricao: 'Venda de combustível ou lubrificante adquirido para consumo do consumidor final', tipo: 'venda', isDefault: true },
  { codigo: '6653', descricao: 'Venda de combustível ou lubrificante adquirido para consumo do consumidor final', tipo: 'venda', isDefault: true },
  { codigo: '5911', descricao: 'Remessa de amostra grátis', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6911', descricao: 'Remessa de amostra grátis', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5913', descricao: 'Retorno de mercadoria ou bem recebido para demonstração', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6913', descricao: 'Retorno de mercadoria ou bem recebido para demonstração', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5914', descricao: 'Remessa de mercadoria ou bem para exposição ou feira', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6914', descricao: 'Remessa de mercadoria ou bem para exposição ou feira', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5917', descricao: 'Remessa de mercadoria em consignação mercantil ou industrial', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6917', descricao: 'Remessa de mercadoria em consignação mercantil ou industrial', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5922', descricao: 'Lançamento efetuado a título de simples faturamento decorrente de venda para entrega futura', tipo: 'outros', isDefault: true },
  { codigo: '6922', descricao: 'Lançamento efetuado a título de simples faturamento decorrente de venda para entrega futura', tipo: 'outros', isDefault: true },
  { codigo: '5923', descricao: 'Remessa de mercadoria por conta e ordem de terceiros em venda à ordem', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '6923', descricao: 'Remessa de mercadoria por conta e ordem de terceiros em venda à ordem', tipo: 'remessa_retorno', isDefault: true },
  { codigo: '5927', descricao: 'Lançamento efetuado a título de baixa de estoque decorrente de perda, roubo ou deterioração', tipo: 'outros', isDefault: true },
  { codigo: '5929', descricao: 'Lançamento efetuado em decorrência de emissão de NF-e relativa a operação registrada em NFC-e/ECF', tipo: 'outros', isDefault: true },
  { codigo: '5354', descricao: 'Prestação de serviço de transporte a estabelecimento de prestador de serviço de comunicação', tipo: 'transporte', isDefault: true },
  { codigo: '6354', descricao: 'Prestação de serviço de transporte a estabelecimento de prestador de serviço de comunicação', tipo: 'transporte', isDefault: true },
  { codigo: '5355', descricao: 'Prestação de serviço de transporte a estabelecimento de geradora ou distribuidora de energia', tipo: 'transporte', isDefault: true },
  { codigo: '6355', descricao: 'Prestação de serviço de transporte a estabelecimento de geradora ou distribuidora de energia', tipo: 'transporte', isDefault: true },
  { codigo: '5356', descricao: 'Prestação de serviço de transporte a estabelecimento de produtor rural', tipo: 'transporte', isDefault: true },
  { codigo: '6356', descricao: 'Prestação de serviço de transporte a estabelecimento de produtor rural', tipo: 'transporte', isDefault: true },
  { codigo: '5359', descricao: 'Prestação de serviço de transporte a contribuinte ou não contribuinte sem indicação específica', tipo: 'transporte', isDefault: true },
  { codigo: '6359', descricao: 'Prestação de serviço de transporte a contribuinte ou não contribuinte sem indicação específica', tipo: 'transporte', isDefault: true },
  { codigo: '5360', descricao: 'Prestação de serviço de transporte a contribuinte substituto em relação ao mesmo serviço', tipo: 'transporte', isDefault: true },
  { codigo: '6360', descricao: 'Prestação de serviço de transporte a contribuinte substituto em relação ao mesmo serviço', tipo: 'transporte', isDefault: true },
];

export const CFOP_TIPO_LABELS: Record<CfopOperacaoTipo, string> = {
  venda: 'Venda',
  remessa_retorno: 'Remessa / Retorno',
  devolucao: 'Devolução',
  transporte: 'Transporte (CT-e)',
  outros: 'Outros / Transferência',
};

const sortCfopCatalog = (entries: CfopCatalogEntry[]): CfopCatalogEntry[] => {
  return [...entries].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
};

const sanitizeCfopEntry = (raw: unknown): CfopCatalogEntry | null => {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const codigo = cleanDigits(String(obj.codigo || '')).slice(0, 4);
  const descricao = String(obj.descricao || '').trim();
  const tipoRaw = String(obj.tipo || 'outros') as CfopOperacaoTipo;
  const validTipo: CfopOperacaoTipo =
    tipoRaw === 'venda' ||
    tipoRaw === 'remessa_retorno' ||
    tipoRaw === 'devolucao' ||
    tipoRaw === 'transporte' ||
    tipoRaw === 'outros'
      ? tipoRaw
      : 'outros';
  if (codigo.length !== 4 || !descricao) return null;
  return {
    codigo,
    descricao,
    tipo: validTipo,
    isDefault: Boolean(obj.isDefault),
  };
};

export function getStoredCfopCatalog(): CfopCatalogEntry[] {
  try {
    const raw = localStorage.getItem(CFOP_CATALOG_STORAGE_KEY);
    if (!raw) return sortCfopCatalog(DEFAULT_CFOP_CATALOG);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return sortCfopCatalog(DEFAULT_CFOP_CATALOG);
    }
    const map = new Map<string, CfopCatalogEntry>();
    parsed.forEach((item) => {
      const clean = sanitizeCfopEntry(item);
      if (clean) {
        map.set(clean.codigo, clean);
      }
    });
    // Garante que os CFOPs essenciais padrão estejam sempre presentes se o catálogo salvo for muito antigo/incompleto
    if (map.size === 0) {
      return sortCfopCatalog(DEFAULT_CFOP_CATALOG);
    }
    return sortCfopCatalog(Array.from(map.values()));
  } catch {
    return sortCfopCatalog(DEFAULT_CFOP_CATALOG);
  }
}

export function saveStoredCfopCatalog(entries: CfopCatalogEntry[]): CfopCatalogEntry[] {
  const map = new Map<string, CfopCatalogEntry>();
  entries.forEach((entry) => {
    const clean = sanitizeCfopEntry(entry);
    if (clean) {
      map.set(clean.codigo, clean);
    }
  });
  const sorted = sortCfopCatalog(Array.from(map.values()));
  try {
    localStorage.setItem(CFOP_CATALOG_STORAGE_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent('agrocontrol_catalogo_cfop_updated', { detail: sorted }));
  } catch (e) {
    console.error('Erro ao salvar catálogo de CFOPs:', e);
  }
  return sorted;
}

export function importOfficialSefazCfopCatalog(existingEntries: CfopCatalogEntry[]): {
  catalog: CfopCatalogEntry[];
  addedCount: number;
} {
  const map = new Map<string, CfopCatalogEntry>();
  existingEntries.forEach((entry) => {
    const clean = sanitizeCfopEntry(entry);
    if (clean) map.set(clean.codigo, clean);
  });
  let addedCount = 0;
  OFFICIAL_SEFAZ_EXPANDED_CFOP_CATALOG.forEach((official) => {
    if (!map.has(official.codigo)) {
      addedCount += 1;
      map.set(official.codigo, { ...official });
    }
  });
  const catalog = saveStoredCfopCatalog(Array.from(map.values()));
  return { catalog, addedCount };
}

export function inferCfopTipoByCode(codigo: string): CfopOperacaoTipo {
  const suffix = codigo.slice(1);
  if (['351', '352', '353', '354', '355', '356', '357', '359', '360', '932'].includes(suffix)) {
    return 'transporte';
  }
  if (['201', '202', '208', '209', '410', '411', '553', '555', '556'].includes(suffix)) {
    return 'devolucao';
  }
  if (
    suffix.startsWith('10') ||
    suffix.startsWith('11') ||
    suffix.startsWith('40') ||
    ['551', '653', '656'].includes(suffix)
  ) {
    return 'venda';
  }
  if (
    [
      '501',
      '502',
      '554',
      '901',
      '902',
      '905',
      '906',
      '908',
      '909',
      '910',
      '911',
      '912',
      '913',
      '914',
      '915',
      '916',
      '917',
      '920',
      '921',
      '923',
      '949',
    ].includes(suffix)
  ) {
    return 'remessa_retorno';
  }
  return 'outros';
}

export function parseBatchCfopText(rawText: string, defaultTipo?: CfopOperacaoTipo): CfopCatalogEntry[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed: CfopCatalogEntry[] = [];
  lines.forEach((line) => {
    const match = line.match(/^(\d{4})\s*[-–—:;|,\t]?\s*(.*)$/);
    if (!match) return;
    const codigo = match[1];
    const desc = (match[2] || '').replace(/^[-–—:;|,\s]+/, '').trim();
    if (!codigo || !desc) return;
    parsed.push({
      codigo,
      descricao: desc,
      tipo: defaultTipo || inferCfopTipoByCode(codigo),
      isDefault: false,
    });
  });
  return parsed;
}

export function translateCfopByScope(cfop: string, escopo: 'estadual' | 'interestadual'): string {
  const digits = cleanDigits(cfop);
  if (digits.length !== 4) return cfop;
  const first = digits[0];
  if (escopo === 'estadual' && first === '6') return `5${digits.slice(1)}`;
  if (escopo === 'interestadual' && first === '5') return `6${digits.slice(1)}`;
  return digits;
}

// ==============================================================================
// NUMERAÇÃO SEQUENCIAL AUTOMÁTICA POR MODELO E SÉRIE
// ==============================================================================

export function getNotaSaidaModelKey(tipoDocumento: TipoDocumentoSaida | string): NotaSaidaModelKey {
  const t = String(tipoDocumento || '').toLowerCase();
  if (t.includes('nfs-e') || t.includes('nfse')) return 'NFSE';
  if (t.includes('ct-e') || t.includes('cte')) return 'CTE';
  if (t.includes('nfc-e') || t.includes('nfce')) return 'NFCE';
  if (t.includes('mdf-e') || t.includes('mdfe')) return 'MDFE';
  return 'NFE';
}

const normalizeSerie = (serie?: string): string => {
  const s = String(serie || '').trim();
  return s !== '' ? s : '1';
};

export function getStoredNotaSaidaSequences(): Record<string, number> {
  try {
    const raw = localStorage.getItem(NOTA_SAIDA_SEQUENCE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) {
        out[k] = Math.floor(n);
      }
    });
    return out;
  } catch {
    return {};
  }
}

export function formatNotaSaidaNumber(num: number): string {
  const safe = Math.max(1, Math.floor(num));
  return String(safe).padStart(6, '0');
}

export function getNextNotaSaidaNumber(
  tipoDocumento: TipoDocumentoSaida | string,
  serie: string | undefined,
  existingNotas: NotaSaidaRecord[]
): string {
  const modelKey = getNotaSaidaModelKey(tipoDocumento);
  const serieKey = normalizeSerie(serie);
  const compositeKey = `${modelKey}::${serieKey}`;

  const stored = getStoredNotaSaidaSequences();
  const storedLast = stored[compositeKey] || 0;

  let maxExisting = 0;
  existingNotas.forEach((n) => {
    if (getNotaSaidaModelKey(n.tipoDocumento) !== modelKey) return;
    if (normalizeSerie(n.serie) !== serieKey) return;
    const digits = cleanDigits(n.numero || '');
    if (!digits) return;
    const parsedNum = parseInt(digits, 10);
    if (Number.isFinite(parsedNum) && parsedNum > maxExisting) {
      maxExisting = parsedNum;
    }
  });

  const lastUsed = Math.max(storedLast, maxExisting);
  return formatNotaSaidaNumber(lastUsed + 1);
}

export function updateNotaSaidaSequenceCounter(
  tipoDocumento: TipoDocumentoSaida | string,
  serie: string | undefined,
  numeroEmitido: string
): void {
  const digits = cleanDigits(numeroEmitido || '');
  if (!digits) return;
  const parsedNum = parseInt(digits, 10);
  if (!Number.isFinite(parsedNum) || parsedNum <= 0) return;

  const modelKey = getNotaSaidaModelKey(tipoDocumento);
  const serieKey = normalizeSerie(serie);
  const compositeKey = `${modelKey}::${serieKey}`;

  const current = getStoredNotaSaidaSequences();
  const prevVal = current[compositeKey] || 0;
  if (parsedNum > prevVal) {
    current[compositeKey] = parsedNum;
    try {
      localStorage.setItem(NOTA_SAIDA_SEQUENCE_STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.error('Erro ao salvar sequência de notas:', e);
    }
  }
}

// ==============================================================================
// CATÁLOGO DE CÓDIGOS DE SERVIÇO (LC 116/03) PARA NFS-e
// ==============================================================================

export const LC116_SERVICE_CODES_STORAGE_KEY = 'agrocontrol_codigos_servico_lc116';

export const DEFAULT_LC116_SERVICE_CODES: Lc116ServiceCodeEntry[] = [
  {
    codigo: '17.05',
    descricao: 'Prestação de Serviços Agrícolas / Silagem / Colheita / Plantio',
    isDefault: true,
  },
  {
    codigo: '14.01',
    descricao: 'Lubrificação, limpeza, manutenção e conserto de máquinas e veículos',
    isDefault: true,
  },
  {
    codigo: '16.01',
    descricao: 'Serviços de transporte de natureza municipal',
    isDefault: true,
  },
  {
    codigo: '07.02',
    descricao: 'Terraplanagem, escavação e serviços com máquinas pesadas',
    isDefault: true,
  },
  {
    codigo: '07.10',
    descricao: 'Limpeza, preparo, conservação e manejo de solo',
    isDefault: true,
  },
  {
    codigo: '01.07',
    descricao: 'Suporte técnico e operacional especializado',
    isDefault: true,
  },
];

export function getStoredLc116ServiceCodes(): Lc116ServiceCodeEntry[] {
  try {
    const raw = localStorage.getItem(LC116_SERVICE_CODES_STORAGE_KEY);
    if (!raw) return [...DEFAULT_LC116_SERVICE_CODES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [...DEFAULT_LC116_SERVICE_CODES];
    }
    const map = new Map<string, Lc116ServiceCodeEntry>();
    parsed.forEach((item: unknown) => {
      if (!item || typeof item !== 'object') return;
      const obj = item as Record<string, unknown>;
      const codigo = String(obj.codigo || '').trim();
      const descricao = String(obj.descricao || '').trim();
      if (codigo && descricao) {
        map.set(codigo, { codigo, descricao, isDefault: Boolean(obj.isDefault) });
      }
    });
    return map.size > 0 ? Array.from(map.values()) : [...DEFAULT_LC116_SERVICE_CODES];
  } catch {
    return [...DEFAULT_LC116_SERVICE_CODES];
  }
}

export function saveStoredLc116ServiceCodes(entries: Lc116ServiceCodeEntry[]): Lc116ServiceCodeEntry[] {
  const map = new Map<string, Lc116ServiceCodeEntry>();
  entries.forEach((e) => {
    const codigo = String(e.codigo || '').trim();
    const descricao = String(e.descricao || '').trim();
    if (codigo && descricao) {
      map.set(codigo, { codigo, descricao, isDefault: Boolean(e.isDefault) });
    }
  });
  const list = Array.from(map.values());
  try {
    localStorage.setItem(LC116_SERVICE_CODES_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('agrocontrol_codigos_lc116_updated', { detail: list }));
  } catch (err) {
    console.error('Erro ao salvar códigos LC 116/03:', err);
  }
  return list;
}

// ==============================================================================
// GERADOR INTELIGENTE DE DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES
// ==============================================================================

export interface InformacoesComplementaresParams {
  tipoDocumento: TipoDocumentoSaida | string;
  naturezaOperacao?: string;
  nfeReferenciada?: string;
  veiculoPlaca?: string;
  motoristaNome?: string;
}

export function buildDefaultInformacoesComplementares(params: InformacoesComplementaresParams): string {
  const parts: string[] = [
    'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI.',
  ];

  const t = String(params.tipoDocumento || '').toLowerCase();
  const nat = String(params.naturezaOperacao || '').toLowerCase();
  const ref = String(params.nfeReferenciada || '').trim();
  const placa = String(params.veiculoPlaca || '').trim().toUpperCase();
  const motorista = String(params.motoristaNome || '').trim().toUpperCase();

  const isRemessaOuRetorno =
    t.includes('remessa') ||
    t.includes('retorno') ||
    nat.includes('remessa') ||
    nat.includes('retorno') ||
    nat.includes('conserto') ||
    nat.includes('comodato');

  if (isRemessaOuRetorno) {
    const refText = ref ? ` referente à NF-e nº ${ref}` : '';
    parts.push(
      `Operação de Remessa/Retorno${refText} - Suspensão/Não incidência de ICMS conforme RICMS.`
    );
  }

  const isTransporte = t.includes('ct-e') || t.includes('cte') || t.includes('mdf-e') || t.includes('mdfe');
  if (isTransporte && (placa || motorista)) {
    const placaPart = placa ? `veículo placa ${placa}` : 'veículo da frota';
    const motoristaPart = motorista ? ` - Motorista: ${motorista}` : '';
    parts.push(`Transporte realizado pelo ${placaPart}${motoristaPart}.`);
  }

  return parts.join('\n');
}

