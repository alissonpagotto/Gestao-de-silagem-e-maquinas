export interface VerbaRH {
  codigo: string;
  descricao: string;
  tipo: 'VENCIMENTO' | 'DESCONTO';
}

export const VERBAS_STORAGE_KEY = 'colaca_silagem_verbas_rh';

export const DEFAULT_VERBAS_RH: VerbaRH[] = [
  { codigo: '001', descricao: 'SALÁRIO BASE MENSAL', tipo: 'VENCIMENTO' },
  { codigo: '501', descricao: 'FALTAS INTEGRADAS (DIAS)', tipo: 'DESCONTO' },
  { codigo: '502', descricao: 'ADIANTAMENTO DE SALÁRIO (VALE)', tipo: 'DESCONTO' },
  { codigo: '503', descricao: 'DESCONTO DE EQUIPAMENTOS / AVARIAS', tipo: 'DESCONTO' },
  { codigo: '504', descricao: 'DESCONTO CONTRIBUIÇÃO SINDICAL', tipo: 'DESCONTO' },
  { codigo: '012', descricao: 'HORAS EXTRAS / ADICIONAL SAFRA & COLHEITA', tipo: 'VENCIMENTO' },
  { codigo: '024', descricao: 'INSALUBRIDADE / BÔNUS PRODUTIVIDADE', tipo: 'VENCIMENTO' },
  { codigo: '035', descricao: 'COMISSÕES VARIÁVEIS DE SILAGEM / PRODUÇÃO', tipo: 'VENCIMENTO' },
  { codigo: '101', descricao: 'DESCONTO PREVIDÊNCIA SOCIAL (INSS)', tipo: 'DESCONTO' },
  { codigo: '102', descricao: 'RETENÇÃO IMPOSTO DE RENDA (IRRF)', tipo: 'DESCONTO' },
  { codigo: '103', descricao: 'TAXA ASSISTENCIAL SINDICATO', tipo: 'DESCONTO' },
  { codigo: '110', descricao: 'ADIANTAMENTO SALARIAL / VALES DO MÊS', tipo: 'DESCONTO' },
];

/**
 * Carrega a lista de verbas salvas no LocalStorage ou inicializa com as verbas padrão oficiais.
 */
export function getStoredVerbasRH(): VerbaRH[] {
  try {
    const raw = localStorage.getItem(VERBAS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(VERBAS_STORAGE_KEY, JSON.stringify(DEFAULT_VERBAS_RH));
      return DEFAULT_VERBAS_RH;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Garantir que as 5 verbas obrigatórias (001, 501, 502, 503, 504) estejam presentes e em caixa alta
      let changed = false;
      const list = [...parsed].map((v) => ({
        ...v,
        codigo: String(v.codigo || '').trim().toUpperCase(),
        descricao: String(v.descricao || '').trim().toUpperCase(),
        tipo: (String(v.tipo || '').toUpperCase().includes('VENC') ? 'VENCIMENTO' : 'DESCONTO') as 'VENCIMENTO' | 'DESCONTO',
      }));

      DEFAULT_VERBAS_RH.forEach((def) => {
        const existing = list.find((v) => v.codigo === def.codigo);
        if (!existing) {
          list.push(def);
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(VERBAS_STORAGE_KEY, JSON.stringify(list));
      }
      return list;
    }
    localStorage.setItem(VERBAS_STORAGE_KEY, JSON.stringify(DEFAULT_VERBAS_RH));
    return DEFAULT_VERBAS_RH;
  } catch (e) {
    console.warn('[verbasRH] Erro ao carregar verbas do LocalStorage:', e);
    return DEFAULT_VERBAS_RH;
  }
}

/**
 * Salva a lista de verbas no LocalStorage.
 */
export function saveStoredVerbasRH(verbas: VerbaRH[]): void {
  try {
    localStorage.setItem(VERBAS_STORAGE_KEY, JSON.stringify(verbas));
  } catch (e) {
    console.error('[verbasRH] Erro ao salvar verbas no LocalStorage:', e);
  }
}

/**
 * Atualiza ou insere uma verba específica no LocalStorage.
 */
export function updateVerbaInStorage(codigo: string, descricao: string, tipo?: 'VENCIMENTO' | 'DESCONTO'): void {
  try {
    const verbas = getStoredVerbasRH();
    const cleanCod = codigo.trim().toUpperCase();
    const cleanDesc = descricao.trim().toUpperCase();
    const idx = verbas.findIndex((v) => v.codigo === cleanCod);

    if (idx >= 0) {
      verbas[idx] = {
        ...verbas[idx],
        descricao: cleanDesc,
        tipo: tipo || verbas[idx].tipo,
      };
    } else {
      verbas.push({
        codigo: cleanCod,
        descricao: cleanDesc,
        tipo: tipo || 'DESCONTO',
      });
    }

    saveStoredVerbasRH(verbas);
  } catch (e) {
    console.warn('[verbasRH] Erro ao atualizar verba:', e);
  }
}

/**
 * Encontra uma verba pelo código ou retorna undefined.
 */
export function findVerbaByCodigo(codigo: string): VerbaRH | undefined {
  const verbas = getStoredVerbasRH();
  return verbas.find((v) => v.codigo.trim() === codigo.trim().toUpperCase());
}

/**
 * Vinculação Inteligente de Descontos: Mapeia um tipo ou descrição de dedução
 * para o Código e Descrição oficiais da verba no LocalStorage (Falta é Falta: 501).
 */
export function getVerbaForDeduction(
  type?: string,
  description?: string
): { codigo: string; descricao: string; tipo: 'DESCONTO' } {
  const verbas = getStoredVerbasRH();
  const lowerType = (type || '').toLowerCase();
  const lowerDesc = (description || '').toLowerCase();

  // 1. FALTA É FALTA: Rubrica 501 - FALTAS INTEGRADAS (DIAS)
  if (
    lowerType.includes('falta') ||
    lowerType.includes('atraso') ||
    lowerDesc.includes('falta') ||
    lowerDesc.includes('dias anteriores')
  ) {
    const v501 = verbas.find((v) => v.codigo === '501');
    return {
      codigo: v501?.codigo || '501',
      descricao: v501?.descricao || 'FALTAS INTEGRADAS (DIAS)',
      tipo: 'DESCONTO',
    };
  }

  // 2. VALE / ADIANTAMENTO: Rubrica 502 (ou 110)
  if (
    lowerType.includes('vale') ||
    lowerType.includes('adiantamento') ||
    lowerDesc.includes('vale') ||
    lowerDesc.includes('adiantamento')
  ) {
    const v502 = verbas.find((v) => v.codigo === '502') || verbas.find((v) => v.codigo === '110');
    return {
      codigo: v502?.codigo || '502',
      descricao: v502?.descricao || 'ADIANTAMENTO DE SALÁRIO (VALE)',
      tipo: 'DESCONTO',
    };
  }

  // 3. EQUIPAMENTOS / AVARIAS / PEÇAS / OFICINA: Rubrica 503
  if (
    lowerType.includes('avaria') ||
    lowerType.includes('equipamento') ||
    lowerType.includes('peça') ||
    lowerType.includes('peca') ||
    lowerType.includes('oficina') ||
    lowerDesc.includes('peça') ||
    lowerDesc.includes('peca') ||
    lowerDesc.includes('avaria') ||
    lowerDesc.includes('equipamento')
  ) {
    const v503 = verbas.find((v) => v.codigo === '503');
    return {
      codigo: v503?.codigo || '503',
      descricao: v503?.descricao || 'DESCONTO DE EQUIPAMENTOS / AVARIAS',
      tipo: 'DESCONTO',
    };
  }

  // 4. CONTRIBUIÇÃO SINDICAL / TAXA SINDICATO: Rubrica 504 (ou 103)
  if (lowerType.includes('sindica') || lowerDesc.includes('sindica')) {
    const v504 = verbas.find((v) => v.codigo === '504') || verbas.find((v) => v.codigo === '103');
    return {
      codigo: v504?.codigo || '504',
      descricao: v504?.descricao || 'DESCONTO CONTRIBUIÇÃO SINDICAL',
      tipo: 'DESCONTO',
    };
  }

  // Padrão de contingência: buscar na lista ou retornar 503
  const v503Fallback = verbas.find((v) => v.codigo === '503');
  return {
    codigo: v503Fallback?.codigo || '503',
    descricao: v503Fallback?.descricao || 'DESCONTO DE EQUIPAMENTOS / AVARIAS',
    tipo: 'DESCONTO',
  };
}
