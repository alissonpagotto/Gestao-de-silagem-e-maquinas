import React from 'react';
import { formatDateBR, getStoredCompanyProfile } from '../../lib/storage';
import { CompanyProfile } from '../../types';
import { buildSystemPrintFooterText, resolveSubscriberPrintHeader } from '../../lib/printIdentity';

export interface PrintReportFooterProps {
  className?: string;
  customInstitutionalText?: string;
  pageText?: string;
  showSignatures?: boolean;
  signatureLabels?: string[];
  companyName?: string;
  authCode?: string;
  companyProfile?: CompanyProfile | null;
  leftSignatureLabel?: string;
  leftSignatureRole?: string;
  rightSignatureLabel?: string;
  rightSignatureRole?: string;
}

/**
 * Standardized Corporate Print Report Footer
 * Fixed at the bottom of printed sheets:
 * - Institutional fixed text: "Relatório gerado automaticamente por: Silagem Fácil ERP - Gestão Integrada de Silagem & Frotas Agrícolas"
 * - Issue timestamp (Data/Hora de emissão) and Page number (Página 1 de 1)
 * - Subtle divider line at the top
 */
export const PrintReportFooter: React.FC<PrintReportFooterProps> = ({
  className = '',
  customInstitutionalText,
  pageText = 'Página 1 de 1',
  showSignatures = false,
  signatureLabels = ['Responsável Técnico / Mecânico', 'Gestor de Frota / Encarregado'],
  companyName,
  authCode,
  companyProfile,
  leftSignatureLabel,
  leftSignatureRole,
  rightSignatureLabel,
  rightSignatureRole,
}) => {
  const profile = companyProfile || getStoredCompanyProfile();
  const identity = resolveSubscriberPrintHeader(profile);
  const effectiveCompanyName = companyName || identity.displayTitle;

  const now = new Date();
  const dateFormatted = formatDateBR(now.toISOString().split('T')[0]);
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const generatedAuth = authCode || `SF-${now.getTime().toString(36).toUpperCase()}`;

  const hasSpecificDualSignatures = Boolean(leftSignatureLabel || rightSignatureLabel);

  return (
    <footer className={`print-corporate-footer w-full mt-6 pt-3 text-stone-600 print:text-black ${className}`}>
      {/* Assinaturas Opcionais */}
      {showSignatures && (
        hasSpecificDualSignatures ? (
          <div className="mb-6 pt-4 grid grid-cols-2 gap-8 text-center text-xs page-break-inside-avoid break-inside-avoid">
            <div className="border-t-2 border-stone-800 pt-2">
              <span className="font-bold text-stone-900 block text-xs">{leftSignatureLabel || 'Responsável'}</span>
              {leftSignatureRole && (
                <span className="text-[11px] text-stone-600 block mt-0.5">{leftSignatureRole}</span>
              )}
              <span className="text-[10px] text-stone-500 block mt-0.5">{effectiveCompanyName} • Data: ____/____/________</span>
            </div>
            <div className="border-t-2 border-stone-800 pt-2">
              <span className="font-bold text-stone-900 block text-xs">{rightSignatureLabel || 'Responsável'}</span>
              {rightSignatureRole && (
                <span className="text-[11px] text-stone-600 block mt-0.5">{rightSignatureRole}</span>
              )}
              <span className="text-[10px] text-stone-500 block mt-0.5">{effectiveCompanyName} • Data: ____/____/________</span>
            </div>
          </div>
        ) : signatureLabels && signatureLabels.length > 0 ? (
          <div className="mb-6 pt-4 grid grid-cols-2 gap-8 text-center text-xs page-break-inside-avoid break-inside-avoid">
            {signatureLabels.map((label, idx) => (
              <div key={idx} className="border-t-2 border-stone-800 pt-2">
                <span className="font-bold text-stone-900 block text-xs">{label}</span>
                <span className="text-[10px] text-stone-500 block mt-0.5">{effectiveCompanyName} • Data: ____/____/________</span>
              </div>
            ))}
          </div>
        ) : null
      )}

      {/* Linha Divisória Horizontal Sutil */}
      <div className="w-full border-t border-stone-300 dark:border-stone-700 print:border-stone-400 mb-2.5" />

      {/* Linha de Metadados e Institucional */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-[9px] text-gray-700 font-medium leading-tight">
        <div className="text-left font-medium text-gray-700">
          {customInstitutionalText || buildSystemPrintFooterText(now)}
        </div>

        <div className="text-right flex items-center gap-2 text-gray-700 text-[9px] shrink-0">
          <span>Autenticação: <strong className="font-mono">{generatedAuth}</strong></span>
          <span>•</span>
          <span className="font-bold">{pageText}</span>
        </div>
      </div>
    </footer>
  );
};
