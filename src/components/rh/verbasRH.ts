export interface VerbaRH {
  codigo: string;
  descricao: string;
  tipo: 'VENCIMENTO' | 'DESCONTO';
}

export const VERBAS_STORAGE_KEY = 'colaca_silagem_verbas_rh';

export const DEFAULT_VERBAS_RH: VerbaRH[] = [
  { codigo: '001', descricao: 'SALÁRIO BASE MENSAL', tipo: 'VENCIMENTO' },
  { codigo: '012', descricao: 'HORAS EXTRAS / ADICIONAL SAFRA & COLHEITA', tipo: 'VENCIMENTO' },
  { codigo: '024', descricao: 'INSALUBRIDADE / BÔNUS PRODUTIVIDADE', tipo: 'VENCIMENTO' },
  { codigo: '035', descricao: 'COMISSÕES VARIÁVEIS DE SILAGEM / PRODUÇÃO', tipo: 'VENCIMENTO' },
  { codigo: '101', descricao: 'DESCONTO PREVIDÊNCIA SOCIAL (INSS)', tipo: 'DESCONTO' },
  { codigo: '102', descricao: 'RETENÇÃO IMPOSTO DE RENDA (IRRF)', tipo: 'DESCONTO' },
  { codigo: '103', descricao: 'TAXA ASSISTENCIAL SINDICATO', tipo: 'DESCONTO' },
  { codigo: '110', descricao: 'ADIANTAMENTO SALARIAL / VALES DO MÊS', tipo: 'DESCONTO' },
  { codigo: '501', descricao: 'FALTAS INTEGRADAS (DIAS)', tipo: 'DESCONTO' },
  { codigo: '502', descricao: 'ADIANTAMENTO DE SALÁRIO (VALE)', tipo: 'DESCONTO' },
  { codigo: '503', descricao: 'DESCONTO DE EQUIPAMENTOS / AVARIAS', tipo: 'DESCONTO' },
  { codigo: '504', descricao: 'DESCONTO CONTRIBUIÇÃO SINDICAL', tipo: 'DESCONTO' },
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
      // Garantir que as 5 verbas obrigatórias (001, 501, 502, 503, 504) estejam presentes
      let changed = false;
      const list = [...parsed];
      DEFAULT_VERBAS_RH.forEach((def) => {
        if (!list.some((v) => v.codigo === def.codigo)) {
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
 * Encontra uma verba pelo código ou retorna undefined.
 */
export function findVerbaByCodigo(codigo: string): VerbaRH | undefined {
  const verbas = getStoredVerbasRH();
  return verbas.find((v) => v.codigo.trim() === codigo.trim());
}
