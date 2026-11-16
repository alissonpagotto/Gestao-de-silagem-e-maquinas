import { CompanyProfile } from '../types';
import { getStoredCompanyProfile } from './storage';

export const SYSTEM_SUPPORT_PHONE_KEY = 'agrocontrol_system_support_phone';
export const PDV_AUTO_PRINT_KEY = 'agrocontrol_pdv_auto_print';
export const SYSTEM_NAME = 'Sistema AgroControl';
export const SYSTEM_VERSION = '1.0.3';

export interface SubscriberPrintIdentity {
  displayTitle: string; // Nome Fantasia em destaque (ou Razão Social se Fantasia não informado)
  tradeName: string;
  corporateName: string;
  cnpjCpf: string;
  stateRegistration: string;
  phone: string;
  email: string;
  fullAddress: string;
  cityState: string;
  logoUrl: string;
}

/**
 * Máscara brasileira de telefone/WhatsApp: (00) 0000-0000 ou (00) 00000-0000
 */
export function formatSystemSupportPhoneMask(value: string): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Lê o Telefone / WhatsApp de Suporte/Comercial do Sistema salvo no Painel Master Admin.
 */
export function getSystemSupportPhone(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    const direct = localStorage.getItem(SYSTEM_SUPPORT_PHONE_KEY);
    if (direct !== null) {
      return direct.trim();
    }
    const rawSettings = localStorage.getItem('silagem_master_settings_v1');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (parsed && typeof parsed.systemSupportPhone === 'string' && parsed.systemSupportPhone.trim()) {
        return parsed.systemSupportPhone.trim();
      }
    }
  } catch {
    // Fallback seguro
  }
  return '';
}

/**
 * Persiste o Telefone / WhatsApp de Suporte/Comercial do Sistema em `agrocontrol_system_support_phone`.
 */
export function saveSystemSupportPhone(phone: string): string {
  const formatted = formatSystemSupportPhoneMask(phone);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (formatted) {
        localStorage.setItem(SYSTEM_SUPPORT_PHONE_KEY, formatted);
      } else {
        localStorage.removeItem(SYSTEM_SUPPORT_PHONE_KEY);
      }
      window.dispatchEvent(new CustomEvent('agrocontrol_system_support_phone_updated', { detail: formatted }));
    }
  } catch (e) {
    console.warn('Erro ao salvar telefone de suporte do sistema:', e);
  }
  return formatted;
}

/**
 * Lê a preferência de Impressão Automática ao Finalizar no PDV (`agrocontrol_pdv_auto_print`).
 */
export function getPdvAutoPrintPreference(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return localStorage.getItem(PDV_AUTO_PRINT_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persiste a preferência de Impressão Automática ao Finalizar no PDV (`agrocontrol_pdv_auto_print`).
 */
export function savePdvAutoPrintPreference(enabled: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(PDV_AUTO_PRINT_KEY, enabled ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('agrocontrol_pdv_auto_print_updated', { detail: enabled }));
    }
  } catch (e) {
    console.warn('Erro ao salvar preferência de impressão automática do PDV:', e);
  }
}

/**
 * Resolve dinamicamente os dados da empresa assinante a partir de `companyProfile` (props)
 * mesclado com `getStoredCompanyProfile()` do LocalStorage — sem textos fixos mockados.
 */
export function resolveSubscriberPrintHeader(
  companyProfile?: Partial<CompanyProfile> | Record<string, any> | null
): SubscriberPrintIdentity {
  let stored: Record<string, any> = {};
  try {
    stored = (getStoredCompanyProfile() as Record<string, any>) || {};
  } catch {
    stored = {};
  }

  const passed = (companyProfile || {}) as Record<string, any>;
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const vPassed = passed[k];
      if (typeof vPassed === 'string' && vPassed.trim()) return vPassed.trim();
    }
    for (const k of keys) {
      const vStored = stored[k];
      if (typeof vStored === 'string' && vStored.trim()) return vStored.trim();
    }
    return '';
  };

  const tradeName = pick('tradeName', 'nomeFantasia', 'nome_fantasia');
  const corporateName = pick('corporateName', 'razaoSocial', 'razao_social', 'companyName', 'name');
  const displayTitle = tradeName || corporateName || 'EMPRESA ASSINANTE';

  const cnpjCpf = pick('cnpjCpf', 'cnpj', 'cpfCnpj', 'cpf_cnpj');
  const stateRegistration = pick('stateRegistration', 'inscricaoEstadual', 'ie');
  const phone = pick('phone', 'telefone', 'whatsapp');
  const email = pick('email');
  const address = pick('address', 'endereco', 'street', 'logradouro');
  const number = pick('number', 'numero');
  const neighborhood = pick('neighborhood', 'bairro');
  const city = pick('city', 'cidade');
  const state = pick('state', 'estado', 'uf');
  const zipCode = pick('zipCode', 'cep');
  const logoUrl = pick('logoUrl', 'logo');

  const streetLine = address ? `${address}${number ? `, nº ${number}` : ''}` : '';
  const cityState = city ? `${city}${state ? `/${state}` : ''}` : state;
  const fullAddress = [
    streetLine,
    neighborhood ? `${neighborhood}` : '',
    cityState,
    zipCode ? `CEP: ${zipCode}` : '',
  ]
    .filter(Boolean)
    .join(' - ');

  return {
    displayTitle,
    tradeName: tradeName || displayTitle,
    corporateName,
    cnpjCpf,
    stateRegistration,
    phone,
    email,
    fullAddress,
    cityState,
    logoUrl,
  };
}

/**
 * Formata DD/MM/AAAA às HH:mm a partir de uma data.
 */
export function formatPrintTimestampPtBr(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} às ${hours}:${mins}`;
}

/**
 * Retorna a string padronizada do rodapé discreto do sistema para todas as impressões.
 * Ex: "Sistema AgroControl • Versão 1.0.3 • Suporte/Contato: (66) 99999-9999 • Emitido em 15/11/2026 às 14:30"
 */
export function buildSystemPrintFooterText(date: Date = new Date()): string {
  const supportPhone = getSystemSupportPhone();
  const parts = [
    `${SYSTEM_NAME} • Versão ${SYSTEM_VERSION}`,
    supportPhone ? `Suporte/Contato: ${supportPhone}` : '',
    `Emitido em ${formatPrintTimestampPtBr(date)}`,
  ].filter(Boolean);
  return parts.join(' • ');
}

function escapeHtmlBasic(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Gera HTML padronizado e discreto (9px, cinza escuro) para o rodapé de documentos HTML standalone.
 */
export function buildSystemPrintFooterHtml(options?: {
  date?: Date;
  thermal?: boolean;
  extraRight?: string;
}): string {
  const footerText = escapeHtmlBasic(buildSystemPrintFooterText(options?.date));
  const extraRight = options?.extraRight ? ` • ${escapeHtmlBasic(options.extraRight)}` : '';
  const marginTop = options?.thermal ? '6px' : '12px';
  return `<div style="margin-top: ${marginTop}; padding-top: 4px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 9px; line-height: 1.3; color: #374151; font-weight: 500; text-transform: none; page-break-inside: avoid; break-inside: avoid;">${footerText}${extraRight}</div>`;
}
