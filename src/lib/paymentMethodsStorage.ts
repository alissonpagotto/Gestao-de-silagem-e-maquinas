import { useEffect, useState, useCallback } from 'react';
import { FormaPagamentoItem, PaymentMethod } from '../types';

export const GLOBAL_PAYMENT_METHODS_KEY = 'agrocontrol_formas_pagamento';
export const GLOBAL_PAYMENT_METHODS_EVENT = 'agrocontrol_formas_pagamento_updated';
const LEGACY_PLANO_CONTAS_KEY = 'colaca_silagem_plano_contas';

export const DEFAULT_GLOBAL_PAYMENT_METHODS: FormaPagamentoItem[] = [
  {
    id: 'fp-pix',
    codigo: 'PIX',
    nome: 'PIX',
    tipo: 'pix',
    prazoDias: 0,
    taxaPercentual: 0,
    geraParcelaPrazo: false,
    ativo: true,
    ordem: 1,
  },
  {
    id: 'fp-dinheiro',
    codigo: 'DINHEIRO',
    nome: 'DINHEIRO',
    tipo: 'dinheiro',
    prazoDias: 0,
    taxaPercentual: 0,
    geraParcelaPrazo: false,
    ativo: true,
    ordem: 2,
  },
  {
    id: 'fp-cartao-credito',
    codigo: 'CARTAO_CREDITO',
    nome: 'CARTÃO DE CRÉDITO',
    tipo: 'cartao_credito',
    prazoDias: 30,
    taxaPercentual: 2.9,
    geraParcelaPrazo: false,
    ativo: true,
    ordem: 3,
  },
  {
    id: 'fp-cartao-debito',
    codigo: 'CARTAO_DEBITO',
    nome: 'CARTÃO DE DÉBITO',
    tipo: 'cartao_debito',
    prazoDias: 1,
    taxaPercentual: 1.4,
    geraParcelaPrazo: false,
    ativo: true,
    ordem: 4,
  },
  {
    id: 'fp-boleto',
    codigo: 'BOLETO',
    nome: 'BOLETO',
    tipo: 'boleto',
    prazoDias: 30,
    taxaPercentual: 0,
    geraParcelaPrazo: true,
    ativo: true,
    ordem: 5,
  },
  {
    id: 'fp-cheque',
    codigo: 'CHEQUE',
    nome: 'CHEQUE',
    tipo: 'cheque',
    prazoDias: 30,
    taxaPercentual: 0,
    geraParcelaPrazo: true,
    ativo: true,
    ordem: 6,
  },
  {
    id: 'fp-transferencia',
    codigo: 'TRANSFERENCIA',
    nome: 'TED / DOC / TRANSFERÊNCIA',
    tipo: 'transferencia',
    prazoDias: 0,
    taxaPercentual: 0,
    geraParcelaPrazo: false,
    ativo: true,
    ordem: 7,
  },
  {
    id: 'fp-prazo-carteira',
    codigo: 'PRAZO_CARTEIRA',
    nome: 'A PRAZO (CARTEIRA)',
    tipo: 'prazo_carteira',
    prazoDias: 30,
    taxaPercentual: 0,
    geraParcelaPrazo: true,
    ativo: true,
    ordem: 8,
  },
  {
    id: 'fp-safra-prazo',
    codigo: 'SAFRA_PRAZO',
    nome: 'SAFRA A PRAZO',
    tipo: 'safra_prazo',
    prazoDias: 180,
    taxaPercentual: 0,
    geraParcelaPrazo: true,
    ativo: true,
    ordem: 9,
  },
  {
    id: 'fp-assinado-nota',
    codigo: 'ASSINADO_NOTA',
    nome: 'ASSINADO NOTA',
    tipo: 'assinado_nota',
    prazoDias: 30,
    taxaPercentual: 0,
    geraParcelaPrazo: true,
    ativo: true,
    ordem: 10,
  },
];

const safeToString = (raw: unknown): string => {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.nome ?? obj.name ?? obj.codigo ?? obj.code ?? obj.id ?? '';
    return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : '';
  }
  try {
    return String(raw);
  } catch {
    return '';
  }
};

const normalizeText = (raw?: unknown): string => {
  try {
    return safeToString(raw)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  } catch {
    return safeToString(raw).toLowerCase().trim();
  }
};

/**
 * Converte um item do registro global para o código interno padronizado usado nos formulários e títulos
 */
export const getPaymentMethodKey = (item: FormaPagamentoItem): PaymentMethod => {
  if (!item || typeof item !== 'object') return 'pix';
  const code = normalizeText(item.codigo).replace(/\s+/g, '_');
  const tipo = normalizeText(item.tipo);

  // Modalidades nativas padronizadas (quando não duplicadas como customizadas)
  if (!item.isCustom) {
    if (tipo === 'pix' || code === 'pix') return 'pix';
    if (tipo === 'dinheiro' || code === 'dinheiro' || code === 'din') return 'dinheiro';
    if (tipo === 'cartao_credito' || code === 'cartao_credito' || code === 'cc') return 'cartao_credito';
    if (tipo === 'cartao_debito' || code === 'cartao_debito' || code === 'cd') return 'cartao_debito';
    if (tipo === 'boleto' || code === 'boleto' || code === 'bol') return 'boleto';
    if (tipo === 'cheque' || code === 'cheque') return 'cheque';
    if (tipo === 'transferencia' || code === 'transferencia' || code === 'ted') return 'transferencia';
    if (tipo === 'prazo_carteira' || code === 'prazo_carteira') return 'prazo_carteira';
    if (tipo === 'safra_prazo' || code === 'safra_prazo') return 'safra_prazo';
    if (tipo === 'assinado_nota' || code === 'assinado_nota') return 'assinado_nota';
  }

  // Modalidade customizada criada pelo usuário: gera chave única estável baseada no código ou id
  const slug = code.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return (slug || safeToString(item.id) || 'outro') as PaymentMethod;
};

const inferDefaultGeraParcelaPrazo = (tipo?: string, codigo?: string, nome?: string): boolean => {
  const ref = `${normalizeText(tipo)} ${normalizeText(codigo)} ${normalizeText(nome)}`;
  return (
    ref.includes('boleto') ||
    ref.includes('cheque') ||
    ref.includes('prazo') ||
    ref.includes('carteira') ||
    ref.includes('safra') ||
    ref.includes('assinado')
  );
};

const sanitizePaymentMethodItem = (item: any, fallbackOrder: number): FormaPagamentoItem | null => {
  try {
    if (!item || typeof item !== 'object') return null;
    const nome = safeToString(item.nome ?? item.name).trim();
    if (!nome) return null;

    const rawCode = safeToString(item.codigo ?? item.code).trim().toUpperCase();
    const codigo =
      rawCode ||
      nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') ||
      `FP_${fallbackOrder}`;

    const rawTipo = normalizeText(item.tipo || 'outro');
    const validTipos = new Set([
      'dinheiro',
      'pix',
      'boleto',
      'cartao_credito',
      'cartao_debito',
      'transferencia',
      'cheque',
      'prazo_carteira',
      'safra_prazo',
      'assinado_nota',
      'outro',
    ]);
    const tipo = (validTipos.has(rawTipo) ? rawTipo : 'outro') as FormaPagamentoItem['tipo'];

    return {
      id: safeToString(item.id) || `fp-${codigo.toLowerCase()}`,
      codigo,
      nome: nome.toUpperCase(),
      tipo,
      prazoDias: Number(item.prazoDias) || 0,
      taxaPercentual: Number(item.taxaPercentual) || 0,
      geraParcelaPrazo:
        typeof item.geraParcelaPrazo === 'boolean'
          ? item.geraParcelaPrazo
          : inferDefaultGeraParcelaPrazo(tipo, codigo, nome),
      ativo: item.ativo !== false,
      isCustom: Boolean(item.isCustom),
      ordem: typeof item.ordem === 'number' && Number.isFinite(item.ordem) ? item.ordem : fallbackOrder,
    };
  } catch {
    return null;
  }
};

let isInternalSyncRunning = false;

const syncToLegacyPlanoContas = (methods: FormaPagamentoItem[], dispatchLegacyEvent = true) => {
  if (typeof window === 'undefined' || isInternalSyncRunning) return;
  try {
    isInternalSyncRunning = true;
    const raw = localStorage.getItem(LEGACY_PLANO_CONTAS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const updated = {
      ...parsed,
      categorias: Array.isArray(parsed.categorias) ? parsed.categorias : [],
      formasPagamento: methods,
    };
    localStorage.setItem(LEGACY_PLANO_CONTAS_KEY, JSON.stringify(updated));
    if (dispatchLegacyEvent) {
      window.dispatchEvent(new CustomEvent('colaca_silagem_plano_updated', { detail: updated }));
    }
  } catch {
    // ignorar erros de sincronização silenciosa
  } finally {
    isInternalSyncRunning = false;
  }
};

/**
 * Lê o repositório oficial unificado de Formas de Pagamento (agrocontrol_formas_pagamento).
 * Caso ainda não exista no localStorage, inicializa com as 10 modalidades padrão e preserva
 * quaisquer formas personalizadas herdadas de `colaca_silagem_plano_contas`.
 */
export function getStoredGlobalPaymentMethods(): FormaPagamentoItem[] {
  if (typeof window === 'undefined') return DEFAULT_GLOBAL_PAYMENT_METHODS.map((d) => ({ ...d }));

  try {
    const raw = localStorage.getItem(GLOBAL_PAYMENT_METHODS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = parsed
          .map((item, idx) => sanitizePaymentMethodItem(item, idx + 1))
          .filter((item): item is FormaPagamentoItem => item !== null);
        if (sanitized.length > 0) {
          return sanitized.sort((a, b) => (a.ordem || 999) - (b.ordem || 999));
        }
      }
    }

    // Bootstrap inicial combinando defaults oficiais + possíveis customizados legados
    const merged: FormaPagamentoItem[] = DEFAULT_GLOBAL_PAYMENT_METHODS.map((d) => ({ ...d }));
    const existingKeys = new Set(merged.map((m) => getPaymentMethodKey(m)));

    try {
      const legacyRaw = localStorage.getItem(LEGACY_PLANO_CONTAS_KEY);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        const legacyList = Array.isArray(legacyParsed?.formasPagamento) ? legacyParsed.formasPagamento : [];
        legacyList.forEach((leg: any, idx: number) => {
          const item = sanitizePaymentMethodItem(leg, 100 + idx);
          if (!item) return;
          const normName = normalizeText(item.nome);
          // Ignora duplicatas óbvias da lista antiga parcial
          const isLegacyAlias =
            normName === 'pix instantaneo' ||
            normName === 'boleto bancario' ||
            normName === 'transferencia bancaria (ted/doc)' ||
            normName === 'cartao de credito corporativo' ||
            normName === 'dinheiro em especie' ||
            normName === 'cheque a vista' ||
            normName === 'cheque pre-datado';
          if (isLegacyAlias) return;

          const key = getPaymentMethodKey(item);
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            merged.push({ ...item, isCustom: true, ordem: merged.length + 1 });
          }
        });
      }
    } catch {
      // ignorar erros de migração
    }

    try {
      localStorage.setItem(GLOBAL_PAYMENT_METHODS_KEY, JSON.stringify(merged));
    } catch {
      // ignorar erros de quota
    }
    return merged;
  } catch {
    return DEFAULT_GLOBAL_PAYMENT_METHODS.map((d) => ({ ...d }));
  }
}

export function getActiveGlobalPaymentMethods(): FormaPagamentoItem[] {
  try {
    return getStoredGlobalPaymentMethods().filter((m) => m && m.ativo !== false);
  } catch {
    return DEFAULT_GLOBAL_PAYMENT_METHODS.map((d) => ({ ...d }));
  }
}

export function saveGlobalPaymentMethods(
  methods: FormaPagamentoItem[],
  options?: { skipLegacyEvent?: boolean }
): FormaPagamentoItem[] {
  const safeInput = Array.isArray(methods) ? methods : DEFAULT_GLOBAL_PAYMENT_METHODS;
  const sanitized = safeInput
    .map((m, idx) => sanitizePaymentMethodItem(m, idx + 1))
    .filter((m): m is FormaPagamentoItem => m !== null)
    .map((m, idx) => ({ ...m, ordem: idx + 1 }));

  const finalMethods =
    sanitized.length > 0 ? sanitized : DEFAULT_GLOBAL_PAYMENT_METHODS.map((d) => ({ ...d }));

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(GLOBAL_PAYMENT_METHODS_KEY, JSON.stringify(finalMethods));
      syncToLegacyPlanoContas(finalMethods, !options?.skipLegacyEvent);
      window.dispatchEvent(new CustomEvent(GLOBAL_PAYMENT_METHODS_EVENT, { detail: finalMethods }));
    } catch (e) {
      console.warn('Erro ao salvar formas de pagamento globais:', e);
    }
  }
  return finalMethods;
}

export function upsertGlobalPaymentMethod(item: FormaPagamentoItem): FormaPagamentoItem[] {
  const current = getStoredGlobalPaymentMethods();
  const idx = current.findIndex((m) => m.id === item.id);
  const next =
    idx >= 0
      ? current.map((m) => (m.id === item.id ? { ...item } : m))
      : [...current, { ...item, ordem: current.length + 1 }];
  return saveGlobalPaymentMethods(next);
}

export function resetGlobalPaymentMethodsToDefault(): FormaPagamentoItem[] {
  const defaults = DEFAULT_GLOBAL_PAYMENT_METHODS.map((d) => ({ ...d }));
  return saveGlobalPaymentMethods(defaults);
}

/**
 * Localiza o objeto FormaPagamentoItem correspondente a qualquer chave ou nome
 */
export function findGlobalPaymentMethod(valueOrLabel?: string | null): FormaPagamentoItem | undefined {
  try {
    if (!valueOrLabel) return undefined;
    const list = getStoredGlobalPaymentMethods();
    const norm = normalizeText(valueOrLabel);
    if (!norm) return undefined;

    // 1. Match direto por chave, id ou código
    const direct = list.find((m) => {
      const k = normalizeText(getPaymentMethodKey(m));
      return (
        k === norm ||
        normalizeText(m.id) === norm ||
        normalizeText(m.codigo) === norm ||
        normalizeText(m.nome) === norm
      );
    });
    if (direct) return direct;

    // 2. Normalização semântica de aliases comuns
    const canonical = normalizeGlobalPaymentMethodKey(valueOrLabel);
    if (!canonical) return undefined;
    return list.find((m) => normalizeText(getPaymentMethodKey(m)) === normalizeText(canonical));
  } catch {
    return undefined;
  }
}

/**
 * Normaliza qualquer string de forma de pagamento para a chave oficial do sistema
 * (incluindo modalidades personalizadas cadastradas pelo usuário).
 */
export function normalizeGlobalPaymentMethodKey(raw?: unknown): PaymentMethod | '' {
  try {
    if (!raw) return '';
    const cleaned = normalizeText(raw);
    if (!cleaned) return '';

    // Verifica se casa diretamente com uma forma personalizada ou padrão do repositório global
    const stored = getStoredGlobalPaymentMethods();
    const matchedStored = stored.find((m) => {
      const k = normalizeText(getPaymentMethodKey(m));
      return (
        k === cleaned ||
        normalizeText(m.codigo) === cleaned ||
        normalizeText(m.nome) === cleaned ||
        normalizeText(m.id) === cleaned
      );
    });
    if (matchedStored) return getPaymentMethodKey(matchedStored);

    // Aliases exatos
    const exactMap: Record<string, PaymentMethod> = {
      pix: 'pix',
      dinheiro: 'dinheiro',
      a_vista: 'dinheiro',
      'a vista': 'dinheiro',
      especie: 'dinheiro',
      boleto: 'boleto',
      cartao_credito: 'cartao_credito',
      credito: 'cartao_credito',
      cartao_debito: 'cartao_debito',
      debito: 'cartao_debito',
      transferencia: 'transferencia',
      ted: 'transferencia',
      doc: 'transferencia',
      cheque: 'cheque',
      prazo: 'prazo_carteira',
      a_prazo: 'prazo_carteira',
      prazo_carteira: 'prazo_carteira',
      carteira: 'prazo_carteira',
      safra_prazo: 'safra_prazo',
      assinado_nota: 'assinado_nota',
    };
    if (exactMap[cleaned]) return exactMap[cleaned];

    // Detecção textual parcial (descrições / notas de faturamento / XML)
    if (cleaned.includes('assinado') && cleaned.includes('nota')) return 'assinado_nota';
    if (cleaned.includes('debito')) return 'cartao_debito';
    if (cleaned.includes('credito') || cleaned.includes('cartao')) return 'cartao_credito';
    if (cleaned.includes('safra')) return 'safra_prazo';
    if (cleaned.includes('carteira') || cleaned.includes('a prazo')) return 'prazo_carteira';
    if (cleaned.includes('transfer') || /\bted\b/.test(cleaned) || /\bdoc\b/.test(cleaned)) return 'transferencia';
    if (/\bpix\b/.test(cleaned)) return 'pix';
    if (/\bboleto\b/.test(cleaned)) return 'boleto';
    if (/\bcheque\b/.test(cleaned)) return 'cheque';
    if (/\bdinheiro\b/.test(cleaned) || /\bespecie\b/.test(cleaned) || cleaned.includes('a vista')) return 'dinheiro';

    // Verifica se o texto contém o nome de alguma forma personalizada
    const customPartial = stored.find((m) => {
      const nName = normalizeText(m.nome);
      return Boolean(m.isCustom && nName && cleaned.includes(nName));
    });
    if (customPartial) return getPaymentMethodKey(customPartial);

    return '';
  } catch {
    return '';
  }
}

/**
 * Extrai a forma de pagamento original de qualquer registro financeiro (Receber, Pagar, Despesa, Serviço, Venda)
 */
export function extractGlobalPaymentMethodFromRecord(record: any): PaymentMethod | '' {
  try {
    if (!record || typeof record !== 'object') return '';

    const structuredCandidates = [
      record.paymentMethod,
      record.formaPagamento,
      record.forma_pagamento,
      record.receberPaymentMethod,
      record.condicaoPagamento,
      record.tipoCobranca,
    ];
    for (const candidate of structuredCandidates) {
      const resolved = normalizeGlobalPaymentMethodKey(candidate);
      if (resolved) return resolved;
    }

    const textSources = [
      record.billingNotes,
      record.notes,
      record.descricao,
      record.description,
      record.observacoes,
      record.volume,
    ]
      .map((s) => safeToString(s))
      .filter(Boolean)
      .join(' | ');

    if (!textSources) return '';

    const faturamentoMatch = textSources.match(/\[faturamento:\s*([^\]\-]+?)(?:\s*\(|\s*-|\])/i);
    if (faturamentoMatch?.[1]) {
      const fromTag = normalizeGlobalPaymentMethodKey(faturamentoMatch[1]);
      if (fromTag) return fromTag;
    }

    return normalizeGlobalPaymentMethodKey(textSources);
  } catch {
    return '';
  }
}

/**
 * Indica se a forma de pagamento selecionada gera parcela a prazo automaticamente
 */
export function doesPaymentMethodGenerateInstallment(methodKeyOrLabel?: string | null): boolean {
  try {
    if (!methodKeyOrLabel) return false;
    const matched = findGlobalPaymentMethod(methodKeyOrLabel);
    if (matched) return Boolean(matched.geraParcelaPrazo);

    const key = normalizeGlobalPaymentMethodKey(methodKeyOrLabel);
    return (
      key === 'boleto' ||
      key === 'cheque' ||
      key === 'prazo_carteira' ||
      key === 'safra_prazo' ||
      key === 'assinado_nota'
    );
  } catch {
    return false;
  }
}

/**
 * Retorna o rótulo amigável atualizado a partir da Fonte Única Global
 */
export function getGlobalPaymentMethodLabel(value?: string | null): string {
  try {
    const strVal = safeToString(value).trim();
    if (!strVal) return 'NÃO INFORMADO';
    const found = findGlobalPaymentMethod(strVal);
    if (found && found.nome) return found.nome;

    switch (strVal) {
      case 'pix':
        return 'PIX';
      case 'dinheiro':
      case 'a_vista':
        return 'DINHEIRO';
      case 'cartao_credito':
        return 'CARTÃO DE CRÉDITO';
      case 'cartao_debito':
        return 'CARTÃO DE DÉBITO';
      case 'boleto':
        return 'BOLETO';
      case 'cheque':
        return 'CHEQUE';
      case 'transferencia':
        return 'TED / DOC / TRANSFERÊNCIA';
      case 'prazo_carteira':
      case 'prazo':
        return 'A PRAZO (CARTEIRA)';
      case 'safra_prazo':
        return 'SAFRA A PRAZO';
      case 'assinado_nota':
        return 'ASSINADO NOTA';
      default:
        return strVal.toUpperCase();
    }
  } catch {
    return 'NÃO INFORMADO';
  }
}

/**
 * Hook React reativo para sincronização instantânea entre todos os módulos
 */
export function useGlobalPaymentMethods() {
  const [allMethods, setAllMethods] = useState<FormaPagamentoItem[]>(() =>
    getStoredGlobalPaymentMethods()
  );

  const refresh = useCallback(() => {
    try {
      const next = getStoredGlobalPaymentMethods();
      setAllMethods((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        } catch {}
        return next;
      });
    } catch {
      // manter estado atual seguro
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleEvent = () => refresh();
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === GLOBAL_PAYMENT_METHODS_KEY || e.key === LEGACY_PLANO_CONTAS_KEY) {
        refresh();
      }
    };

    window.addEventListener(GLOBAL_PAYMENT_METHODS_EVENT, handleEvent);
    window.addEventListener('colaca_silagem_plano_updated', handleEvent);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(GLOBAL_PAYMENT_METHODS_EVENT, handleEvent);
      window.removeEventListener('colaca_silagem_plano_updated', handleEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refresh]);

  const safeAllMethods = Array.isArray(allMethods) ? allMethods : DEFAULT_GLOBAL_PAYMENT_METHODS;
  const activeMethods = safeAllMethods.filter((m) => m && m.ativo !== false);

  return {
    allMethods: safeAllMethods,
    activeMethods,
    refresh,
  };
}
