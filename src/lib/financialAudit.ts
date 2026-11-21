import { ReversalAuditEntry } from '../types';
import { getActiveCompanyId } from './storage';
import {
  getOperadorLogadoNome,
  getStoredCaixaOperacional,
  saveStoredCaixaOperacional,
} from './caixaStorage';

const AUDIT_STORAGE_KEY = 'agrocontrol_estornos_auditoria';

export function getLoggedAuditUserName(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const rawSession =
        localStorage.getItem('colaca_silagem_active_session') ||
        localStorage.getItem('agrocontrol_active_session') ||
        localStorage.getItem('colaca_silagem_cadastros_base_session');

      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          if (parsed) {
            if (parsed.name && String(parsed.name).trim()) {
              return String(parsed.name).trim().toUpperCase();
            }
            if (parsed.cargoNome && String(parsed.cargoNome).trim()) {
              return String(parsed.cargoNome).trim().toUpperCase();
            }
            if (parsed.type === 'admin') {
              return 'ADMINISTRADOR GERAL';
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      const explicitUser = localStorage.getItem('agrocontrol_usuario_logado');
      if (explicitUser && explicitUser.trim()) {
        return explicitUser.trim().toUpperCase();
      }

      const activeEmail = localStorage.getItem('silagem_active_user_email');
      if (activeEmail && activeEmail.trim()) {
        return activeEmail.trim();
      }
    }
  } catch {
    // ignore storage errors
  }

  return getOperadorLogadoNome() || 'ADMINISTRADOR GERAL';
}

export function formatCurrentAuditDateTimeBR(date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

export function formatReversalTooltip(item?: { lastReversal?: ReversalAuditEntry }): string | undefined {
  const rev = item?.lastReversal;
  if (!rev) return undefined;
  return `Estornado por ${rev.user} — Motivo: ${rev.reason}${rev.dateTime ? ` (${rev.dateTime})` : ''}`;
}

export function getStoredFinancialReversalAudits(): ReversalAuditEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const companyId = getActiveCompanyId();
    const scopedKey = companyId ? `${AUDIT_STORAGE_KEY}_${companyId}` : AUDIT_STORAGE_KEY;
    const raw = localStorage.getItem(scopedKey) || localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordFinancialReversalAudit(entry: ReversalAuditEntry): ReversalAuditEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [entry];
    const companyId = getActiveCompanyId();
    const scopedKey = companyId ? `${AUDIT_STORAGE_KEY}_${companyId}` : AUDIT_STORAGE_KEY;
    const current = getStoredFinancialReversalAudits();
    const updated = [entry, ...current.filter((item) => item.id !== entry.id)];
    const serialized = JSON.stringify(updated);
    localStorage.setItem(AUDIT_STORAGE_KEY, serialized);
    if (scopedKey !== AUDIT_STORAGE_KEY) {
      localStorage.setItem(scopedKey, serialized);
    }
    window.dispatchEvent(new CustomEvent('agrocontrol_estornos_auditoria_updated', { detail: updated }));
    return updated;
  } catch {
    return [entry];
  }
}

export function reverseCashRegisterSettlement(params: {
  type: 'pagar' | 'receber';
  targetId: string;
  amount: number;
  description?: string;
  partyName?: string;
  paymentMethod?: string;
  bankAccountId?: string;
  paidViaCashBox?: boolean;
  reason: string;
  user: string;
}): boolean {
  try {
    const caixa = getStoredCaixaOperacional();
    if (!caixa) return false;

    const amt = Number(params.amount) || 0;
    if (amt <= 0) return false;

    const isCashBox =
      Boolean(params.paidViaCashBox) ||
      params.bankAccountId === 'caixa_interno' ||
      (!params.bankAccountId && String(params.paymentMethod || '').toLowerCase() === 'dinheiro');

    if (caixa.status !== 'ABERTO' && !isCashBox) return false;

    const targetLower = String(params.targetId || '').toLowerCase();
    const refTagLower = targetLower ? `[ref:${targetLower}]` : '';
    const partyLower = String(params.partyName || '').trim().toLowerCase();
    const descLower = String(params.description || '').trim().toLowerCase();

    if (params.type === 'pagar') {
      const idx = (caixa.sangrias || []).findIndex((s) => {
        const m = String(s.motivo || '').toLowerCase();
        const d = String(s.destino || '').toLowerCase();
        const idStr = String(s.id || '').toLowerCase();
        if (targetLower && (idStr.includes(targetLower) || (refTagLower && m.includes(refTagLower)) || m.includes(targetLower) || d.includes(targetLower))) {
          return true;
        }
        return (
          Math.abs(Number(s.valor) - amt) < 0.02 &&
          ((partyLower && (m.includes(partyLower) || d.includes(partyLower))) ||
            (descLower && (m.includes(descLower) || d.includes(descLower))))
        );
      });

      if (idx >= 0) {
        const nextSangrias = caixa.sangrias.filter((_, i) => i !== idx);
        saveStoredCaixaOperacional({ ...caixa, sangrias: nextSangrias });
        return true;
      }

      if (isCashBox && caixa.status === 'ABERTO') {
        const estornoSuprimento = {
          id: `caixa_rev_pag_${Date.now()}`,
          dataHora: new Date().toISOString(),
          valor: amt,
          motivo: `ESTORNO BAIXA A PAGAR (${params.partyName || params.description || params.targetId}) — ${params.reason}`,
          destino: `CAIXA (ESTORNO POR ${params.user})`,
          tipo: 'SUPRIMENTO' as const,
        };
        saveStoredCaixaOperacional({
          ...caixa,
          suprimentos: [estornoSuprimento, ...(caixa.suprimentos || [])],
        });
        return true;
      }
    } else {
      const idx = (caixa.suprimentos || []).findIndex((s) => {
        const m = String(s.motivo || '').toLowerCase();
        const d = String(s.destino || '').toLowerCase();
        const idStr = String(s.id || '').toLowerCase();
        if (targetLower && (idStr.includes(targetLower) || (refTagLower && m.includes(refTagLower)) || m.includes(targetLower) || d.includes(targetLower))) {
          return true;
        }
        return (
          Math.abs(Number(s.valor) - amt) < 0.02 &&
          ((partyLower && (m.includes(partyLower) || d.includes(partyLower))) ||
            (descLower && (m.includes(descLower) || d.includes(descLower))))
        );
      });

      if (idx >= 0) {
        const nextSuprimentos = caixa.suprimentos.filter((_, i) => i !== idx);
        saveStoredCaixaOperacional({ ...caixa, suprimentos: nextSuprimentos });
        return true;
      }

      if (isCashBox && caixa.status === 'ABERTO') {
        const estornoSangria = {
          id: `caixa_rev_rec_${Date.now()}`,
          dataHora: new Date().toISOString(),
          valor: amt,
          motivo: `ESTORNO RECEBIMENTO (${params.partyName || params.description || params.targetId}) — ${params.reason}`,
          destino: `ESTORNO POR ${params.user}`,
          tipo: 'SANGRIA' as const,
        };
        saveStoredCaixaOperacional({
          ...caixa,
          sangrias: [estornoSangria, ...(caixa.sangrias || [])],
        });
        return true;
      }
    }
  } catch (err) {
    console.warn('Aviso ao estornar movimentação no Caixa Operacional:', err);
  }
  return false;
}
