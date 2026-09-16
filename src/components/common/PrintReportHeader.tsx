import React from 'react';
import { CompanyProfile } from '../../types';
import { getStoredCompanyProfile } from '../../lib/storage';
import { Building2 } from 'lucide-react';

export interface PrintReportHeaderProps {
  companyProfile?: CompanyProfile | null;
  reportTitle?: string;
  reportSubtitle?: string;
  documentTypeBadge?: string;
  className?: string;
  showDivider?: boolean;
}

/**
 * Standardized Corporate Print Report Header
 * 2 Columns:
 * - Left: Company Logo (dynamically loaded from Company Settings) or stylized monogram fallback
 * - Right: Trade Name (Nome Fantasia) in bold highlight, with CNPJ and City/UF directly below
 * Separated by a subtle horizontal divider line in corporate blue / dark gray.
 */
export const PrintReportHeader: React.FC<PrintReportHeaderProps> = ({
  companyProfile,
  reportTitle,
  reportSubtitle,
  documentTypeBadge,
  className = '',
  showDivider = true,
}) => {
  const company = companyProfile || getStoredCompanyProfile();

  const tradeName =
    company?.tradeName ||
    company?.companyName ||
    company?.corporateName ||
    'Silagem Fácil - Gestão Agrícola';

  const corporateName = company?.corporateName && company.corporateName !== tradeName ? company.corporateName : null;

  const cnpj = company?.cnpjCpf || company?.cnpj || '';
  const cityUf = [company?.city, company?.state].filter(Boolean).join(' / ');
  const contact = [company?.phone, company?.email].filter(Boolean).join(' • ');
  const address = company?.address ? `${company.address}${company.number ? `, nº ${company.number}` : ''}` : '';

  return (
    <header className={`print-corporate-header w-full pb-3 mb-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center w-full">
        {/* LADO ESQUERDO: Logomarca da Empresa (Col 1-3) */}
        <div className="md:col-span-3 flex items-center gap-3">
          {company?.logoUrl ? (
            <div className="w-20 h-20 max-w-[90px] max-h-[90px] rounded-lg border border-stone-200 bg-white flex items-center justify-center p-1 overflow-hidden shadow-2xs shrink-0">
              <img
                src={company.logoUrl}
                alt={`Logomarca ${tradeName}`}
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg bg-blue-50 border border-blue-200 flex flex-col items-center justify-center text-[#0963cb] p-1 shadow-2xs shrink-0">
              <Building2 className="w-8 h-8 stroke-[1.8]" />
              <span className="text-[10px] font-black uppercase tracking-wider mt-0.5">ERP</span>
            </div>
          )}

          <div className="md:hidden">
            <h1 className="text-base font-black text-[#0963cb] tracking-tight uppercase font-['Outfit']">
              {tradeName}
            </h1>
            {cnpj && (
              <p className="text-[11px] font-semibold text-stone-600">
                CNPJ: {cnpj}
              </p>
            )}
          </div>
        </div>

        {/* CENTRO: Título do Laudo / OS e Subtítulo (Col 4-8) */}
        <div className="md:col-span-5 text-left md:text-center flex flex-col justify-center">
          {reportTitle && (
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900 uppercase tracking-tight font-['Outfit'] leading-snug">
                {reportTitle}
              </h2>
              {reportSubtitle && (
                <p className="text-xs text-stone-600 font-semibold mt-1 leading-relaxed">
                  {reportSubtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* LADO DIREITO: Dados Corporativos e Badge da OS (Col 9-12) */}
        <div className="md:col-span-4 text-left md:text-right flex flex-col items-start md:items-end justify-center">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {documentTypeBadge && (
              <span className="px-2.5 py-1 rounded-md text-[10.5px] font-black uppercase bg-[#0963cb] text-white tracking-wider shadow-2xs">
                {documentTypeBadge}
              </span>
            )}
          </div>

          <h1 className="hidden md:block text-base sm:text-lg font-black text-[#0963cb] tracking-tight uppercase leading-tight font-['Outfit']">
            {tradeName}
          </h1>

          {corporateName && (
            <p className="text-[11px] text-stone-700 font-semibold leading-tight mt-0.5">
              Razão Social: {corporateName}
            </p>
          )}

          <div className="text-xs text-stone-600 font-medium space-y-0.5 mt-1">
            <p className="font-bold text-stone-800 leading-tight">
              {cnpj ? `CNPJ: ${cnpj}` : 'CNPJ: Não cadastrado'}
              {cityUf ? ` • ${cityUf}` : ''}
            </p>
            {contact && (
              <p className="text-[11px] text-stone-500 leading-tight">
                {contact}
              </p>
            )}
            {address && (
              <p className="text-[10px] text-stone-400 leading-tight">
                {address}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Linha Divisória Horizontal Sutil */}
      {showDivider && (
        <div className="mt-3 w-full border-b-2 border-[#0963cb]/70 print:border-[#0963cb]" />
      )}
    </header>
  );
};
