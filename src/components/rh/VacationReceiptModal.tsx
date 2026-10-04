import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Printer, Palmtree, Wifi } from 'lucide-react';
import { VacationRecord, Employee, CompanyProfile } from '../../types';
import { formatDateBR, getStoredCompanyProfile, getActiveCompanyId, getStoredVacations, saveStoredVacations } from '../../lib/storage';
import { PixQrCodeBlock } from './PixQrCodeBlock';
import { resolveEmployeePixKey } from './pixQrCodeHelper';
import { getEmployeePixKey, findEmployeeFromStorage } from './pixUtils';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  saveCloudVacations,
  upsertRhFeriasRecord,
  mapRowToVacationRecord,
  toValidUUID,
} from '../../lib/supabaseService';
import { useAuth } from '../../context/AuthContext';

export interface VacationReceiptModalProps {
  vacation?: VacationRecord | null;
  vacationData?: VacationRecord | null;
  employee?: Employee;
  companyProfile?: CompanyProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaveVacation?: (updated: VacationRecord) => void;
}

/**
 * Formata moeda estritamente no padrão comercial brasileiro: R$ #.##0,00
 * Conforme instrução obrigatória persistente do projeto (RULE[AGENTS_md])
 */
function formatBRL(val?: number): string {
  const num = Number(val) || 0;
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Converte texto digitado em número decimal flexível (padrão PT-BR ou numérico direto)
 */
function parseFlexibleCurrency(val: string | number | undefined | null): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, Math.round(val * 100) / 100);
  if (!val) return 0;
  const cleaned = String(val).replace(/[R$\s-]/g, '').trim();
  if (!cleaned) return 0;

  if (cleaned.includes('.') && cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
  }

  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
  }

  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      const normalized = cleaned.replace(/\./g, '');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
  }

  const num = parseFloat(cleaned.replace(/[^\d]/g, ''));
  return isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100);
}

/**
 * Tabela Oficial Progressiva do INSS Brasileiro
 */
function calculateVacationINSS(base: number): { inssAmount: number; effectiveRate: number } {
  if (base <= 0) return { inssAmount: 0, effectiveRate: 0 };
  const faixas = [
    { limite: 1412.00, aliq: 0.075 },
    { limite: 2666.68, aliq: 0.09 },
    { limite: 4000.03, aliq: 0.12 },
    { limite: 7786.02, aliq: 0.14 }
  ];

  let inss = 0;
  let anterior = 0;
  for (const f of faixas) {
    if (base > anterior) {
      const baseFaixa = Math.min(base, f.limite) - anterior;
      inss += baseFaixa * f.aliq;
      anterior = f.limite;
    } else {
      break;
    }
  }
  const inssTeto = 908.86;
  const inssFinal = Math.min(inss, inssTeto);
  const roundedInss = Math.round(inssFinal * 100) / 100;
  const effectiveRate = base > 0 ? (roundedInss / base) * 100 : 0;
  return { inssAmount: roundedInss, effectiveRate };
}

/**
 * Tabela Oficial de Retenção do IRRF na Fonte com Dedução por Faixa
 */
function calculateVacationIRRF(baseIRRF: number): { irrfAmount: number; irrfRate: number } {
  if (baseIRRF <= 2259.20) {
    return { irrfAmount: 0, irrfRate: 0 };
  }
  let aliq = 0;
  let deducao = 0;
  if (baseIRRF <= 2826.65) {
    aliq = 0.075;
    deducao = 169.44;
  } else if (baseIRRF <= 3751.05) {
    aliq = 0.15;
    deducao = 381.44;
  } else if (baseIRRF <= 4664.68) {
    aliq = 0.225;
    deducao = 662.77;
  } else {
    aliq = 0.275;
    deducao = 896.00;
  }

  const irrf = Math.max(0, (baseIRRF * aliq) - deducao);
  const roundedIrrf = Math.round(irrf * 100) / 100;
  return { irrfAmount: roundedIrrf, irrfRate: aliq * 100 };
}

/**
 * Input numérico discreto (sem bordas grossas, estilo border-bottom que se destaca ao focar)
 */
interface DiscreteNumericInputProps {
  value: number;
  onChange: (newVal: number) => void;
  colorClass?: string;
  ariaLabel?: string;
}

const DiscreteNumericInput: React.FC<DiscreteNumericInputProps> = ({
  value,
  onChange,
  colorClass = 'text-emerald-700',
  ariaLabel,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [rawText, setRawText] = useState(() => formatBRL(value));

  useEffect(() => {
    if (!isFocused) {
      setRawText(formatBRL(value));
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    const formattedNum = (Number(value) || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setRawText(formattedNum);
    setTimeout(() => {
      try {
        e.target.select();
      } catch (_) {}
    }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setRawText(valStr);
    const parsed = parseFlexibleCurrency(valStr);
    onChange(parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setRawText(formatBRL(value));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={isFocused ? rawText : formatBRL(value)}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-28 text-right font-black font-mono text-[13px] leading-tight bg-transparent border-0 border-b border-transparent hover:border-stone-400 focus:border-[#0963cb] focus:bg-blue-50/70 focus:outline-none px-1 py-0.5 rounded-t-xs transition-colors cursor-text ${colorClass}`}
    />
  );
};

/**
 * Componente Toggle Switch Liga/Desliga para INSS e IRRF
 */
interface DiscountSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

const DiscountSwitch: React.FC<DiscountSwitchProps> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={checked ? `${label}: Ativado (clique para zerar)` : `${label}: Desativado (clique para calcular)`}
    onClick={() => onChange(!checked)}
    className={`no-print relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0963cb] ${
      checked ? 'bg-[#0963cb]' : 'bg-stone-300'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);

/**
 * Gerenciador Singleton de Canal Realtime por Locatário (Tenant)
 * Impede o erro "cannot add postgres_changes callbacks after subscribe()" quando
 * múltiplos componentes (VacationsTab e VacationReceiptModal) escutam o mesmo canal simultaneamente.
 */
interface TenantRealtimeEntry {
  channel: any;
  broadcastListeners: Set<(payload: any) => void>;
  postgresListeners: Set<(vacations: VacationRecord[]) => void>;
}

const tenantRealtimeRegistry = new Map<string, TenantRealtimeEntry>();

export function subscribeToVacationRealtimeChannel(
  tenantId: string,
  onBroadcastPayload: (payload: any) => void,
  onPostgresVacations: (vacations: VacationRecord[]) => void
): () => void {
  if (!isSupabaseConfigured || !tenantId) {
    return () => {};
  }

  let entry = tenantRealtimeRegistry.get(tenantId);

  if (!entry) {
    const channelTopic = `vacation_realtime_sync_${tenantId}`;
    const broadcastListeners = new Set<(payload: any) => void>();
    const postgresListeners = new Set<(vacations: VacationRecord[]) => void>();
    let channelInstance: any = null;

    try {
      // Remove qualquer instância órfã com o mesmo tópico antes de criar e assinar
      const existingChannels = supabase.getChannels?.() || [];
      for (const ch of existingChannels) {
        if (ch.topic === channelTopic || ch.topic === `realtime:${channelTopic}`) {
          try {
            supabase.removeChannel(ch);
          } catch (_) {}
        }
      }

      channelInstance = supabase
        .channel(channelTopic, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'vacation_mutation' }, (msg: any) => {
          const payload = msg?.payload || msg;
          broadcastListeners.forEach((listener) => {
            try {
              listener(payload);
            } catch (_) {}
          });
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rh_ferias',
          },
          (payload: any) => {
            const eventType = payload?.eventType;
            if (eventType === 'DELETE') {
              const oldId = payload?.old?.id;
              if (oldId) {
                broadcastListeners.forEach((listener) => {
                  try {
                    listener({
                      tenantId,
                      senderId: 'postgres_rh_ferias',
                      eventType: 'DELETE',
                      deletedId: String(oldId),
                    });
                  } catch (_) {}
                });
              }
              return;
            }

            const row = payload?.new;
            if (!row) return;
            if (row.company_id && String(row.company_id) !== String(tenantId)) return;

            const mapped = mapRowToVacationRecord(row);
            if (mapped) {
              broadcastListeners.forEach((listener) => {
                try {
                  listener({
                    tenantId,
                    senderId: 'postgres_rh_ferias',
                    eventType: eventType || 'UPDATE',
                    vacation: mapped,
                  });
                } catch (_) {}
              });
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('⚠️ [Realtime Channel Notice] Aviso ao inicializar canal de férias:', err);
    }

    entry = {
      channel: channelInstance,
      broadcastListeners,
      postgresListeners,
    };
    tenantRealtimeRegistry.set(tenantId, entry);
  }

  entry.broadcastListeners.add(onBroadcastPayload);
  entry.postgresListeners.add(onPostgresVacations);

  return () => {
    const currentEntry = tenantRealtimeRegistry.get(tenantId);
    if (!currentEntry) return;

    currentEntry.broadcastListeners.delete(onBroadcastPayload);
    currentEntry.postgresListeners.delete(onPostgresVacations);

    if (currentEntry.broadcastListeners.size === 0 && currentEntry.postgresListeners.size === 0) {
      tenantRealtimeRegistry.delete(tenantId);
      if (currentEntry.channel) {
        try {
          supabase.removeChannel(currentEntry.channel);
        } catch (_) {}
      }
    }
  };
}

export function sendVacationRealtimeBroadcast(
  tenantId: string,
  senderId: string,
  vacation: VacationRecord
): void {
  if (!isSupabaseConfigured || !tenantId) return;
  const entry = tenantRealtimeRegistry.get(tenantId);
  if (!entry?.channel) return;
  try {
    entry.channel.send({
      type: 'broadcast',
      event: 'vacation_mutation',
      payload: {
        tenantId,
        senderId,
        vacation,
      },
    });
  } catch (_) {}
}

export function VacationReceiptModal({
  isOpen,
  onClose,
  vacationData,
  vacation,
  employee,
  companyProfile: propCompanyProfile,
  onSaveVacation,
}: VacationReceiptModalProps) {
  // =========================================================================
  // 1. REPOSICIONAMENTO DOS HOOKS NO TOPO ABSOLUTO DO COMPONENTE
  // =========================================================================

  const { currentUser, companyId: authCompanyId } = useAuth();
  const activeTenantId = useMemo(() => {
    return authCompanyId || currentUser?.id || getActiveCompanyId() || 'default';
  }, [authCompanyId, currentUser?.id]);

  const clientInstanceIdRef = useRef<string>(`vac_modal_${Math.random().toString(36).slice(2, 10)}`);

  // Efeito para isolar e otimizar a impressão quando o modal de recibo estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('has-vacation-receipt-open');
      return () => {
        document.body.classList.remove('has-vacation-receipt-open');
      };
    }
  }, [isOpen]);

  // Hook 1: Estado de impressão
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Hook 2: Consolidação dos dados iniciais de férias
  const sourceVacation = useMemo(() => {
    return vacationData || vacation || null;
  }, [vacationData, vacation]);

  // Hook 3: Estados locais editáveis do modal (.useState) vinculados ao canal Realtime
  const [valorFerias, setValorFerias] = useState<number>(0);
  const [valorUmTerco, setValorUmTerco] = useState<number>(0);
  const [valorAbono, setValorAbono] = useState<number>(0);
  const [valorDecimo, setValorDecimo] = useState<number>(0);
  const [inssEnabled, setInssEnabled] = useState<boolean>(true);
  const [irrfEnabled, setIrrfEnabled] = useState<boolean>(true);
  const [customInssDiscount, setCustomInssDiscount] = useState<number | null>(null);
  const [customIrrfDiscount, setCustomIrrfDiscount] = useState<number | null>(null);

  // Inicializa os estados locais sempre que a programação de férias mudar
  useEffect(() => {
    if (!sourceVacation) return;
    const baseSal = Number(sourceVacation.baseSalary || 0);
    const days = sourceVacation.daysCount || 30;
    const dailyRate = baseSal / 30;
    const initialFerias = sourceVacation.customVacationAmount !== undefined
      ? sourceVacation.customVacationAmount
      : Math.round((dailyRate * days) * 100) / 100;
    const initialUmTerco = sourceVacation.oneThirdBonus !== undefined
      ? sourceVacation.oneThirdBonus
      : Math.round((initialFerias / 3) * 100) / 100;
    const initialAbono = sourceVacation.pecuniaryAllowance || 0;
    const initialDecimo = sourceVacation.thirteenthAmount || 0;

    const initialInssEnabled = sourceVacation.inssEnabled !== undefined
      ? sourceVacation.inssEnabled
      : true;
    const initialIrrfEnabled = sourceVacation.irrfEnabled !== undefined
      ? sourceVacation.irrfEnabled
      : true;

    setValorFerias(initialFerias);
    setValorUmTerco(initialUmTerco);
    setValorAbono(initialAbono);
    setValorDecimo(initialDecimo);
    setInssEnabled(initialInssEnabled);
    setIrrfEnabled(initialIrrfEnabled);
    setCustomInssDiscount(sourceVacation.inssDiscount !== undefined ? sourceVacation.inssDiscount : null);
    setCustomIrrfDiscount(sourceVacation.irrfDiscount !== undefined ? sourceVacation.irrfDiscount : null);
  }, [sourceVacation?.id]);

  // Hook 4: Perfil da Empresa Empregadora
  const company = useMemo(() => {
    return propCompanyProfile || getStoredCompanyProfile();
  }, [propCompanyProfile]);

  // Hook 5: Endereço completo formatado da Empresa
  const companyAddress = useMemo(() => {
    if (!company) return 'Sede Administrativa / Área Operacional';
    return [
      company.address ? `${company.address}${company.number ? `, nº ${company.number}` : ''}` : '',
      company.neighborhood ? `Bairro ${company.neighborhood}` : '',
      company.city ? `${company.city}${company.state ? `/${company.state}` : ''}` : '',
      company.zipCode ? `CEP: ${company.zipCode}` : '',
    ].filter(Boolean).join(' • ') || 'Sede Administrativa / Área Operacional';
  }, [company]);

  // Hook 6: Cálculo da data de retorno ao trabalho
  const returnDate = useMemo(() => {
    if (!sourceVacation?.endDate) return '-';
    try {
      const parts = sourceVacation.endDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + 1);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (_) {}
    return '-';
  }, [sourceVacation?.endDate]);

  // Hook 7: Recálculo Instantâneo no Front-End (Total Bruto, Total de Descontos, Bases e Valor Líquido)
  const calculatedAmounts = useMemo(() => {
    const totalBruto = Math.round((valorFerias + valorUmTerco + valorAbono + valorDecimo) * 100) / 100;

    // Regra de Negócio INSS: Se ativado, calcula Base Previdenciária e desconto; se desativado, zera ambos
    const rawBaseINSS = Math.round((valorFerias + valorUmTerco) * 100) / 100;
    const baseINSS = inssEnabled ? rawBaseINSS : 0;
    const autoInss = calculateVacationINSS(baseINSS);
    const inssDiscount = inssEnabled
      ? (customInssDiscount !== null ? customInssDiscount : autoInss.inssAmount)
      : 0;
    const inssEffectiveRate = inssEnabled && baseINSS > 0
      ? (inssDiscount / baseINSS) * 100
      : 0;

    // Regra de Negócio IRRF: Se ativado, calcula Base IRRF e desconto; se desativado, zera ambos
    const rawBaseIRRF = Math.max(0, Math.round((rawBaseINSS - inssDiscount) * 100) / 100);
    const baseIRRF = irrfEnabled ? rawBaseIRRF : 0;
    const autoIrrf = calculateVacationIRRF(baseIRRF);
    const irrfDiscount = irrfEnabled
      ? (customIrrfDiscount !== null ? customIrrfDiscount : autoIrrf.irrfAmount)
      : 0;
    const irrfRate = irrfEnabled ? autoIrrf.irrfRate : 0;

    const totalDescontos = Math.round((inssDiscount + irrfDiscount) * 100) / 100;
    const valorLiquido = Math.max(0, Math.round((totalBruto - totalDescontos) * 100) / 100);

    return {
      valorFerias,
      valorUmTerco,
      valorAbono,
      valorDecimo,
      totalBruto,
      baseINSS,
      inssDiscount,
      inssEffectiveRate,
      baseIRRF,
      irrfDiscount,
      irrfRate,
      totalDescontos,
      valorLiquido,
    };
  }, [valorFerias, valorUmTerco, valorAbono, valorDecimo, inssEnabled, irrfEnabled, customInssDiscount, customIrrfDiscount]);

  // Função para propagar mutações em tempo real para outros dispositivos sob o mesmo tenantId
  const propagateRealtimeMutation = useCallback((overrides: Partial<{
    valorFerias: number;
    valorUmTerco: number;
    valorAbono: number;
    valorDecimo: number;
    inssEnabled: boolean;
    irrfEnabled: boolean;
    customInssDiscount: number | null;
    customIrrfDiscount: number | null;
  }>) => {
    if (!sourceVacation) return;

    const nextFerias = overrides.valorFerias !== undefined ? overrides.valorFerias : valorFerias;
    const nextUmTerco = overrides.valorUmTerco !== undefined ? overrides.valorUmTerco : valorUmTerco;
    const nextAbono = overrides.valorAbono !== undefined ? overrides.valorAbono : valorAbono;
    const nextDecimo = overrides.valorDecimo !== undefined ? overrides.valorDecimo : valorDecimo;
    const nextInssEnabled = overrides.inssEnabled !== undefined ? overrides.inssEnabled : inssEnabled;
    const nextIrrfEnabled = overrides.irrfEnabled !== undefined ? overrides.irrfEnabled : irrfEnabled;
    const nextCustomInss = overrides.customInssDiscount !== undefined ? overrides.customInssDiscount : customInssDiscount;
    const nextCustomIrrf = overrides.customIrrfDiscount !== undefined ? overrides.customIrrfDiscount : customIrrfDiscount;

    const nextBruto = Math.round((nextFerias + nextUmTerco + nextAbono + nextDecimo) * 100) / 100;
    const rawBInss = Math.round((nextFerias + nextUmTerco) * 100) / 100;
    const nextBaseINSS = nextInssEnabled ? rawBInss : 0;
    const nextInss = nextInssEnabled
      ? (nextCustomInss !== null ? nextCustomInss : calculateVacationINSS(nextBaseINSS).inssAmount)
      : 0;

    const rawBIrrf = Math.max(0, Math.round((rawBInss - nextInss) * 100) / 100);
    const nextBaseIRRF = nextIrrfEnabled ? rawBIrrf : 0;
    const nextIrrf = nextIrrfEnabled
      ? (nextCustomIrrf !== null ? nextCustomIrrf : calculateVacationIRRF(nextBaseIRRF).irrfAmount)
      : 0;

    const nextDescontos = Math.round((nextInss + nextIrrf) * 100) / 100;
    const nextLiquido = Math.max(0, Math.round((nextBruto - nextDescontos) * 100) / 100);

    const canonicalId = toValidUUID(sourceVacation.id);
    const updatedRecord: VacationRecord = {
      ...sourceVacation,
      id: canonicalId,
      companyId: activeTenantId,
      customVacationAmount: nextFerias,
      oneThirdBonus: nextUmTerco,
      pecuniaryAllowance: nextAbono,
      thirteenthAmount: nextDecimo,
      inssEnabled: nextInssEnabled,
      irrfEnabled: nextIrrfEnabled,
      baseINSS: nextBaseINSS,
      baseIRRF: nextBaseIRRF,
      inssDiscount: nextInss,
      irrfDiscount: nextIrrf,
      totalDiscounts: nextDescontos,
      totalAmount: nextBruto,
      netAmount: nextLiquido,
      valor_liquido_pago: nextLiquido,
      updatedAt: new Date().toISOString(),
    };

    // 1. Atualiza estado pai e armazenamento local
    if (onSaveVacation) {
      onSaveVacation(updatedRecord);
    }
    const stored = getStoredVacations();
    const updatedList = stored.some(v => toValidUUID(v.id) === canonicalId)
      ? stored.map(v => (toValidUUID(v.id) === canonicalId ? updatedRecord : v))
      : [updatedRecord, ...stored];
    saveStoredVacations(updatedList);

    // 2. Dispara evento local para sincronizar abas/modais na mesma janela
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('silagem_vacation_realtime_mutation', {
          detail: {
            tenantId: activeTenantId,
            senderId: clientInstanceIdRef.current,
            vacation: updatedRecord,
          },
        })
      );
    }

    // 3. Propaga via Broadcast e Upsert na tabela rh_ferias do Supabase para outros dispositivos
    if (isSupabaseConfigured) {
      sendVacationRealtimeBroadcast(activeTenantId, clientInstanceIdRef.current, updatedRecord);
      upsertRhFeriasRecord(updatedRecord, activeTenantId).catch(() => {});
      saveCloudVacations(updatedList, activeTenantId).catch(() => {});
    }
  }, [
    sourceVacation,
    valorFerias,
    valorUmTerco,
    valorAbono,
    valorDecimo,
    inssEnabled,
    irrfEnabled,
    customInssDiscount,
    customIrrfDiscount,
    activeTenantId,
    onSaveVacation,
  ]);

  // Hook 8: Canal de Escuta Ativa (Supabase Realtime Channel - Broadcast & Postgres Changes)
  useEffect(() => {
    if (!isOpen) return;

    const applyIncomingVacation = (incoming: VacationRecord) => {
      if (!incoming) return;
      if (sourceVacation && toValidUUID(incoming.id) !== toValidUUID(sourceVacation.id)) return;

      const baseSal = Number(incoming.baseSalary || 0);
      const days = incoming.daysCount || 30;
      const dailyRate = baseSal / 30;

      if (incoming.customVacationAmount !== undefined) {
        setValorFerias(incoming.customVacationAmount);
      } else {
        setValorFerias(Math.round((dailyRate * days) * 100) / 100);
      }
      if (incoming.oneThirdBonus !== undefined) {
        setValorUmTerco(incoming.oneThirdBonus);
      }
      if (incoming.pecuniaryAllowance !== undefined) {
        setValorAbono(incoming.pecuniaryAllowance);
      }
      if (incoming.thirteenthAmount !== undefined) {
        setValorDecimo(incoming.thirteenthAmount);
      }
      if (incoming.inssEnabled !== undefined) {
        setInssEnabled(incoming.inssEnabled);
      }
      if (incoming.irrfEnabled !== undefined) {
        setIrrfEnabled(incoming.irrfEnabled);
      }
      if (incoming.inssDiscount !== undefined) {
        setCustomInssDiscount(incoming.inssDiscount);
      }
      if (incoming.irrfDiscount !== undefined) {
        setCustomIrrfDiscount(incoming.irrfDiscount);
      }
    };

    const handleLocalEvent = (e: any) => {
      const detail = e?.detail;
      if (!detail || detail.senderId === clientInstanceIdRef.current) return;
      if (detail.tenantId && detail.tenantId !== activeTenantId) return;
      if (detail.vacation) {
        applyIncomingVacation(detail.vacation);
      }
    };

    window.addEventListener('silagem_vacation_realtime_mutation', handleLocalEvent);

    const unsubscribeRealtime = subscribeToVacationRealtimeChannel(
      activeTenantId,
      (payload: any) => {
        if (!payload || payload.senderId === clientInstanceIdRef.current) return;
        if (payload.tenantId && payload.tenantId !== activeTenantId) return;
        if (payload.vacation) {
          applyIncomingVacation(payload.vacation);
        }
      },
      (parsedVacations: VacationRecord[]) => {
        if (sourceVacation) {
          const matched = parsedVacations.find((v) => v.id === sourceVacation.id);
          if (matched) {
            applyIncomingVacation(matched);
          }
        }
      }
    );

    return () => {
      window.removeEventListener('silagem_vacation_realtime_mutation', handleLocalEvent);
      unsubscribeRealtime();
    };
  }, [isOpen, activeTenantId, sourceVacation?.id]);

  // Hook 9: Efeito de classes e listeners de impressão global
  useEffect(() => {
    if (!isOpen || !sourceVacation) return;

    document.body.classList.add('has-vacation-receipt-open');
    const handleBeforePrint = () => {
      setIsPrinting(true);
      document.body.classList.add('printing-vacation-receipt');
    };
    const handleAfterPrint = () => {
      setIsPrinting(false);
      document.body.classList.remove('printing-vacation-receipt');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      document.body.classList.remove('has-vacation-receipt-open');
      document.body.classList.remove('printing-vacation-receipt');
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isOpen, sourceVacation]);

  // =========================================================================
  // 2. CONDICIONAIS DE RENDERIZAÇÃO LIMPA E SEGURA
  // =========================================================================

  if (!isOpen || !sourceVacation) {
    return null;
  }

  // =========================================================================
  // 3. RENDERIZAÇÃO DO DOCUMENTO CONSOLIDADO (COMPACTADO E SEM SCROLL VERTICAL)
  // =========================================================================

  const companyName = company?.tradeName || company?.companyName || company?.corporateName || 'COLACA SILAGEM LTDA';
  const companyCnpj = company?.cnpjCpf || '46.097.636/0001-02';

  const employeeName = sourceVacation.employeeName || employee?.name || 'ALISSON PAGOTTO DA SILVA';
  const employeeRole = employee?.role || (employee as any)?.cargo || 'Colaborador';
  const employeeCpf = employee?.cpf || (employee as any)?.document || (employee as any)?.cpfCnpj || 'Não Informado';

  const acquisitionStart = sourceVacation.acquisitionPeriodStart ? formatDateBR(sourceVacation.acquisitionPeriodStart) : '01/01/2025';
  const acquisitionEnd = sourceVacation.acquisitionPeriodEnd ? formatDateBR(sourceVacation.acquisitionPeriodEnd) : '31/12/2025';
  const periodAcquisitive = `${acquisitionStart} a ${acquisitionEnd}`;

  const periodGozoStart = formatDateBR(sourceVacation.startDate) || '01/10/2026';
  const periodGozoEnd = formatDateBR(sourceVacation.endDate) || '31/10/2026';
  const periodGozo = `${periodGozoStart} até ${periodGozoEnd}`;

  const daysCount = sourceVacation.daysCount || 30;
  const sellDaysCount = sourceVacation.sellDaysCount || 0;

  const {
    totalBruto,
    baseINSS,
    inssDiscount,
    inssEffectiveRate,
    baseIRRF,
    irrfDiscount,
    irrfRate,
    totalDescontos,
    valorLiquido,
  } = calculatedAmounts;

  const issueCity = company?.city || 'Brasil';
  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Resolução simples e direta da chave PIX em variável JavaScript (sem hooks)
  const resolvedEmp = employee || findEmployeeFromStorage(sourceVacation.employeeId || sourceVacation.employeeName);
  const pixKey = getEmployeePixKey(resolvedEmp || employee) || resolveEmployeePixKey(
    employee || sourceVacation.employeeId || sourceVacation.employeeName
  );

  // Rotina de impressão com janela isolada (window.open) com fallback para window.print
  const handlePrint = () => {
    const reciboElement = document.getElementById('recibo-ferias-branco');
    if (!reciboElement) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (printWindow) {
      const estilosPai = Array.from(document.styleSheets)
        .map(styleSheet => {
          try {
            return Array.from(styleSheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch (e) {
            return '';
          }
        })
        .join('\n');

      printWindow.document.write(`
        <html>
          <head>
            <title>Recibo de Férias - ${employeeName}</title>
            <style>
              ${estilosPai}
              body { background: white !important; color: black !important; padding: 20px; font-family: sans-serif; }
              @media print {
                @page { size: A4 portrait; margin: 1cm; }
                body { padding: 0; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body class="bg-white text-black antialiased">
            <div class="w-full max-w-4xl mx-auto p-2 bg-white border border-gray-200 rounded-xl shadow-none">
              ${reciboElement.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    } else {
      window.print();
    }
  };

  const handleToggleInss = (checked: boolean) => {
    setInssEnabled(checked);
    setCustomInssDiscount(checked ? null : 0);
    propagateRealtimeMutation({
      inssEnabled: checked,
      customInssDiscount: checked ? null : 0,
    });
  };

  const handleToggleIrrf = (checked: boolean) => {
    setIrrfEnabled(checked);
    setCustomIrrfDiscount(checked ? null : 0);
    propagateRealtimeMutation({
      irrfEnabled: checked,
      customIrrfDiscount: checked ? null : 0,
    });
  };

  const handleCloseModal = () => {
    propagateRealtimeMutation({});
    onClose();
  };

  return (
    <div
      className="vacation-modal-container fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/70 backdrop-blur-xs overflow-y-auto print:p-0 print:m-0 print:static print:bg-white print:backdrop-filter-none print:overflow-visible"
    >
      {/* Estilos CSS Nativos de Impressão A4 Portrait em 1 Página */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
          body, html {
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .recibo-ferias-container {
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .no-print {
            display: none !important;
          }
          .recibo-ferias-container input {
            border: none !important;
            background: transparent !important;
            color: #000000 !important;
            padding: 0 !important;
            width: auto !important;
          }
        }
      `}</style>

      {/* Janela Modal do Sistema - Compactada sem barra de rolagem vertical (overflow-y: hidden) */}
      <div
        className="vacation-modal-wrapper bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto flex flex-col print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none print:my-0 print:p-0 print:overflow-visible"
      >
        {/* Barra de Ações Superior (no-print) */}
        <div className="no-print flex items-center justify-between px-4 py-2.5 bg-[#0963cb] text-white border-b border-blue-400/30 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-white/15">
              <Palmtree className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs sm:text-sm font-black tracking-wide text-white uppercase">
                  Aviso e Recibo de Férias
                </h3>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-100 border border-emerald-400/30">
                  <Wifi className="w-2.5 h-2.5 text-emerald-300" />
                  <span>Sincronizado em Tempo Real</span>
                </span>
              </div>
              <p className="text-[10px] text-white/80 font-medium">
                Documento legal consolidado (Art. 135 e Art. 145 da CLT) • {employeeName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handlePrint()}
              className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer active:scale-95"
              title="Imprimir Aviso/Recibo de Férias (A4 em uma página)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Documento</span>
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              title="Fechar Janela"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Área de Visualização Compacta: padding 16px, gap 0.75rem, overflow-y hidden */}
        <div
          className="p-4 overflow-y-hidden bg-stone-100 dark:bg-stone-950 flex justify-center"
          style={{ padding: '16px', overflowY: 'hidden' }}
        >
          {/* Documento Centralizado - Padding 16px e Gap 0.75rem entre blocos */}
          <div
            id="recibo-ferias-branco"
            className="recibo-ferias-container bg-white text-black w-full max-w-[210mm] border border-stone-300 p-4 rounded-lg shadow-sm text-xs leading-snug font-sans flex flex-col gap-3 overflow-y-hidden"
            style={{ padding: '16px', gap: '0.75rem', overflowY: 'hidden' }}
          >
            {/* CABEÇALHO EMPRESARIAL COMPACTO */}
            <div className="border-b-2 border-black pb-2 text-center flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="text-left">
                <h1 className="text-sm font-black uppercase tracking-wider text-black">
                  {companyName}
                </h1>
                <p className="text-[10px] font-bold text-stone-700">
                  CNPJ/MF: {companyCnpj} {companyAddress ? `• ${companyAddress}` : ''}
                </p>
              </div>
              <div className="inline-block border-2 border-black px-3 py-0.5 rounded-sm bg-stone-50 self-center sm:self-auto shrink-0">
                <span className="text-[11px] font-black tracking-wider uppercase text-black">
                  AVISO E RECIBO DE FÉRIAS
                </span>
              </div>
            </div>

            {/* SEÇÃO 1: AVISO PRÉVIO DE FÉRIAS (ART. 135 CLT) */}
            <div className="border border-stone-400 rounded-sm p-2.5 bg-stone-50/50">
              <div className="font-black uppercase text-[10px] border-b border-stone-300 pb-1 mb-1.5 text-stone-900 flex items-center justify-between">
                <span>1. AVISO PRÉVIO DE FÉRIAS (Art. 135 da CLT)</span>
                <span className="text-[9px] font-semibold text-stone-600">Comunicação Formal ao Empregado</span>
              </div>

              {/* Tabela dos Dados Cadastrais e Períodos com Grid Horizontal + QR Code */}
              <div className="flex flex-row items-center justify-between gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 border border-stone-300 p-2 bg-white rounded-xs text-[11px] flex-1">
                  <div className="sm:col-span-2">
                    <span className="block text-[9px] font-bold text-stone-500 uppercase">Colaborador(a):</span>
                    <span className="font-black text-black text-[11px] truncate block">{employeeName}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-stone-500 uppercase">Cargo / Função:</span>
                    <span className="font-bold text-stone-900 truncate block">{employeeRole}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-stone-500 uppercase">CPF:</span>
                    <span className="font-bold text-stone-900">{employeeCpf}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-stone-500 uppercase">Per. Aquisitivo:</span>
                    <span className="font-black text-stone-900 text-[10px]">{periodAcquisitive}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-stone-500 uppercase">Gozo ({daysCount}d):</span>
                    <span className="font-black text-blue-900 text-[10px]">{periodGozo}</span>
                  </div>
                </div>

                {pixKey ? (
                  <div className="shrink-0 pl-1 self-center">
                    <PixQrCodeBlock
                      pixKey={pixKey}
                      amount={valorLiquido}
                      label="PIX para Adiantamento de Férias"
                      receiverName={employeeName}
                      city={issueCity}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {/* SEÇÃO 2: DEMONSTRATIVO DE CÁLCULO E QUITAÇÃO (ART. 145 CLT) */}
            <div className="border border-stone-400 rounded-sm p-2.5 bg-stone-50/50 flex flex-col gap-2">
              <div className="font-black uppercase text-[10px] border-b border-stone-300 pb-1 text-stone-900 flex items-center justify-between">
                <span>2. DEMONSTRATIVO DE PROVENTOS E DESCONTOS (Art. 145 da CLT)</span>
                <span className="text-[9px] font-semibold text-stone-600">
                  Retorno ao trabalho: {returnDate} • Valores editáveis em tempo real
                </span>
              </div>

              {/* Tabela de Proventos e Descontos (Fonte 13px e linhas compactas) */}
              <table
                className="w-full border-collapse border border-stone-300 text-[13px] leading-tight bg-white"
                style={{ fontSize: '13px' }}
              >
                <thead>
                  <tr className="bg-stone-100 text-stone-800 border-b border-stone-300 text-left">
                    <th className="py-1 px-2.5 border-r border-stone-300 font-bold uppercase text-[11px]">
                      Rubrica / Discriminação
                    </th>
                    <th className="py-1 px-2 border-r border-stone-300 font-bold uppercase text-[11px] text-center w-24">
                      Referência
                    </th>
                    <th className="py-1 px-2.5 border-r border-stone-300 font-bold uppercase text-[11px] text-right w-32 text-emerald-700">
                      PROVENTOS (+)
                    </th>
                    <th className="py-1 px-2.5 font-bold uppercase text-[11px] text-right w-32 text-rose-700">
                      DESCONTOS (-)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-[13px]">
                  {/* Linha 1: Valor das Férias */}
                  <tr className="hover:bg-stone-50/80">
                    <td className="py-1 px-2.5 border-r border-stone-300 font-semibold">
                      Valor das Férias (Remuneração Normal CLT)
                    </td>
                    <td className="py-1 px-2 border-r border-stone-300 text-center font-bold text-stone-700">
                      {daysCount} dias
                    </td>
                    <td className="py-1 px-2.5 border-r border-stone-300 text-right">
                      <DiscreteNumericInput
                        value={valorFerias}
                        ariaLabel="Valor das Férias"
                        colorClass="text-emerald-700"
                        onChange={(val) => {
                          setValorFerias(val);
                          propagateRealtimeMutation({ valorFerias: val });
                        }}
                      />
                    </td>
                    <td className="py-1 px-2.5 text-right font-mono text-stone-400">-</td>
                  </tr>

                  {/* Linha 2: 1/3 Constitucional */}
                  <tr className="hover:bg-stone-50/80">
                    <td className="py-1 px-2.5 border-r border-stone-300 font-semibold">
                      Adicional de 1/3 Constitucional (Art. 7º, XVII da CF/88)
                    </td>
                    <td className="py-1 px-2 border-r border-stone-300 text-center font-bold text-stone-700">
                      33,33%
                    </td>
                    <td className="py-1 px-2.5 border-r border-stone-300 text-right">
                      <DiscreteNumericInput
                        value={valorUmTerco}
                        ariaLabel="Adicional de 1/3 Constitucional"
                        colorClass="text-emerald-700"
                        onChange={(val) => {
                          setValorUmTerco(val);
                          propagateRealtimeMutation({ valorUmTerco: val });
                        }}
                      />
                    </td>
                    <td className="py-1 px-2.5 text-right font-mono text-stone-400">-</td>
                  </tr>

                  {/* Linha 3: Abono Pecuniário (se aplicável) */}
                  {(sellDaysCount > 0 || valorAbono > 0) && (
                    <tr className="hover:bg-stone-50/80">
                      <td className="py-1 px-2.5 border-r border-stone-300 font-semibold">
                        Abono Pecuniário de Férias ({sellDaysCount || 10} dias)
                      </td>
                      <td className="py-1 px-2 border-r border-stone-300 text-center font-bold text-stone-700">
                        {sellDaysCount || 10} dias
                      </td>
                      <td className="py-1 px-2.5 border-r border-stone-300 text-right">
                        <DiscreteNumericInput
                          value={valorAbono}
                          ariaLabel="Abono Pecuniário"
                          colorClass="text-emerald-700"
                          onChange={(val) => {
                            setValorAbono(val);
                            propagateRealtimeMutation({ valorAbono: val });
                          }}
                        />
                      </td>
                      <td className="py-1 px-2.5 text-right font-mono text-stone-400">-</td>
                    </tr>
                  )}

                  {/* Linha 4: Adiantamento 13º Salário (se aplicável) */}
                  {(sourceVacation.thirteenthAdvance || valorDecimo > 0) && (
                    <tr className="hover:bg-stone-50/80">
                      <td className="py-1 px-2.5 border-r border-stone-300 font-semibold">
                        Adiantamento da 1ª Parcela do 13º Salário
                      </td>
                      <td className="py-1 px-2 border-r border-stone-300 text-center font-bold text-stone-700">
                        50,00%
                      </td>
                      <td className="py-1 px-2.5 border-r border-stone-300 text-right">
                        <DiscreteNumericInput
                          value={valorDecimo}
                          ariaLabel="Adiantamento 13º Salário"
                          colorClass="text-emerald-700"
                          onChange={(val) => {
                            setValorDecimo(val);
                            propagateRealtimeMutation({ valorDecimo: val });
                          }}
                        />
                      </td>
                      <td className="py-1 px-2.5 text-right font-mono text-stone-400">-</td>
                    </tr>
                  )}

                  {/* Linha 5: Desconto de INSS com Toggle Switch */}
                  <tr className="hover:bg-stone-50/80">
                    <td className="py-1 px-2.5 border-r border-stone-300 font-semibold">
                      <div className="flex items-center justify-between gap-2">
                        <span className={inssEnabled ? 'text-stone-900' : 'text-stone-400 line-through'}>
                          Desconto de INSS sobre Férias (Tabela Progressiva)
                        </span>
                        <DiscountSwitch
                          checked={inssEnabled}
                          onChange={handleToggleInss}
                          label="Desconto de INSS"
                        />
                      </div>
                    </td>
                    <td className="py-1 px-2 border-r border-stone-300 text-center font-bold text-stone-600">
                      {inssEnabled ? `${inssEffectiveRate.toFixed(2).replace('.', ',')}%` : 'Isento'}
                    </td>
                    <td className="py-1 px-2.5 border-r border-stone-300 text-right font-mono text-stone-400">-</td>
                    <td className="py-1 px-2.5 text-right">
                      <DiscreteNumericInput
                        value={inssDiscount}
                        ariaLabel="Desconto de INSS"
                        colorClass={inssEnabled ? 'text-rose-700' : 'text-stone-400'}
                        onChange={(val) => {
                          const nextEnabled = val > 0 ? true : inssEnabled;
                          setInssEnabled(nextEnabled);
                          setCustomInssDiscount(val);
                          propagateRealtimeMutation({
                            inssEnabled: nextEnabled,
                            customInssDiscount: val,
                          });
                        }}
                      />
                    </td>
                  </tr>

                  {/* Linha 6: Desconto de IRRF com Toggle Switch */}
                  <tr className="hover:bg-stone-50/80">
                    <td className="py-1 px-2.5 border-r border-stone-300 font-semibold">
                      <div className="flex items-center justify-between gap-2">
                        <span className={irrfEnabled ? 'text-stone-900' : 'text-stone-400 line-through'}>
                          Desconto de IRRF sobre Férias (Retenção na Fonte)
                        </span>
                        <DiscountSwitch
                          checked={irrfEnabled}
                          onChange={handleToggleIrrf}
                          label="Desconto de IRRF"
                        />
                      </div>
                    </td>
                    <td className="py-1 px-2 border-r border-stone-300 text-center font-bold text-stone-600">
                      {irrfEnabled && irrfRate > 0 ? `${irrfRate.toFixed(1).replace('.', ',')}%` : 'Isento'}
                    </td>
                    <td className="py-1 px-2.5 border-r border-stone-300 text-right font-mono text-stone-400">-</td>
                    <td className="py-1 px-2.5 text-right">
                      <DiscreteNumericInput
                        value={irrfDiscount}
                        ariaLabel="Desconto de IRRF"
                        colorClass={irrfEnabled ? 'text-rose-700' : 'text-stone-400'}
                        onChange={(val) => {
                          const nextEnabled = val > 0 ? true : irrfEnabled;
                          setIrrfEnabled(nextEnabled);
                          setCustomIrrfDiscount(val);
                          propagateRealtimeMutation({
                            irrfEnabled: nextEnabled,
                            customIrrfDiscount: val,
                          });
                        }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Bloco Resumo de Totais e Bases Previdenciárias */}
              <div className="grid grid-cols-1 sm:grid-cols-12 border border-stone-300 rounded-sm overflow-hidden bg-white">
                <div className="sm:col-span-7 p-2 flex flex-col justify-between space-y-1 border-b sm:border-b-0 sm:border-r border-stone-300 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-700 uppercase">TOTAL BRUTO (PROVENTOS):</span>
                    <span className="font-black font-mono text-emerald-700 text-xs">{formatBRL(totalBruto)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-700 uppercase">TOTAL DE DESCONTOS (INSS + IRRF):</span>
                    <span className="font-black font-mono text-rose-700 text-xs">{formatBRL(totalDescontos)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5 border-t border-stone-200">
                    <span>Base Previdenciária: <strong>{formatBRL(baseINSS)}</strong></span>
                    <span>Base IRRF: <strong>{formatBRL(baseIRRF)}</strong></span>
                  </div>
                </div>

                <div className="sm:col-span-5 bg-blue-50/70 p-2 flex flex-col justify-center text-right">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#0963cb]">
                    VALOR LÍQUIDO A PAGAR
                  </span>
                  <span className="text-lg font-black text-[#0963cb] font-mono leading-tight">
                    {formatBRL(valorLiquido)}
                  </span>
                </div>
              </div>

              {/* Texto do Recibo de Quitação */}
              <p className="text-[10px] text-justify text-stone-800 leading-snug border-t border-stone-300 pt-1.5">
                <strong>RECIBO DE QUITAÇÃO:</strong> Recebi de <strong>{companyName}</strong>, inscrita no CNPJ/MF sob o nº <strong>{companyCnpj}</strong>, a importância líquida supra de <strong>{formatBRL(valorLiquido)}</strong>, correspondente à quitação das férias regulamentares e do respectivo adicional constitucional ora concedidos, das quais dou plena, rasa e irrevogável quitação.
              </p>
            </div>

            {/* SEÇÃO 3: DATA E ASSINATURAS CLÁSSICAS COMPACTADAS */}
            <div className="pt-1 border-t border-stone-400">
              <div className="text-center font-medium text-stone-700 text-[10px] mb-4">
                {issueCity}, {todayFormatted}.
              </div>

              <div className="grid grid-cols-2 gap-6 text-center text-[10px]">
                <div className="flex flex-col items-center">
                  <div className="w-full border-t border-black mb-1"></div>
                  <span className="font-black text-black uppercase">{companyName}</span>
                  <span className="text-[9px] text-stone-600">Empregador • CNPJ: {companyCnpj}</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-full border-t border-black mb-1"></div>
                  <span className="font-black text-black uppercase">{employeeName}</span>
                  <span className="text-[9px] text-stone-600">Empregado(a) • CPF: {employeeCpf}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal (no-print) */}
        <div className="no-print flex items-center justify-between px-4 py-2 bg-stone-100 dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 text-xs shrink-0">
          <span className="text-[11px] text-stone-500 font-medium">
            Padrão de Impressão: Folha A4 Retrato • Ajustado para 1 Página
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handlePrint()}
              className="inline-flex items-center space-x-1 px-3 py-1 bg-[#0963cb] hover:bg-blue-700 text-white font-bold rounded-lg transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-3 py-1 bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold rounded-lg transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VacationReceiptModal;
