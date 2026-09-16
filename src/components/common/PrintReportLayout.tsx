import React from 'react';
import { CompanyProfile } from '../../types';
import { PrintReportHeader, PrintReportHeaderProps } from './PrintReportHeader';
import { PrintReportFooter, PrintReportFooterProps } from './PrintReportFooter';

export interface PrintReportLayoutProps {
  children: React.ReactNode;
  companyProfile?: CompanyProfile | null;
  reportTitle?: string;
  reportSubtitle?: string;
  documentTypeBadge?: string;
  className?: string;
  headerProps?: Partial<PrintReportHeaderProps>;
  footerProps?: Partial<PrintReportFooterProps>;
  showSignatures?: boolean;
  signatureLabels?: string[];
}

/**
 * Universal Wrapper for printable sheets, providing the standard 2-column header and fixed institutional footer.
 */
export const PrintReportLayout: React.FC<PrintReportLayoutProps> = ({
  children,
  companyProfile,
  reportTitle,
  reportSubtitle,
  documentTypeBadge,
  className = '',
  headerProps,
  footerProps,
  showSignatures,
  signatureLabels,
}) => {
  return (
    <div className={`print-report-container w-full bg-white text-stone-900 flex flex-col justify-between ${className}`}>
      <PrintReportHeader
        companyProfile={companyProfile}
        reportTitle={reportTitle}
        reportSubtitle={reportSubtitle}
        documentTypeBadge={documentTypeBadge}
        {...headerProps}
      />

      <div className="print-report-body flex-1 w-full">
        {children}
      </div>

      <PrintReportFooter
        companyName={companyProfile?.tradeName || companyProfile?.companyName || 'Silagem Fácil ERP'}
        showSignatures={showSignatures}
        signatureLabels={signatureLabels}
        {...footerProps}
      />
    </div>
  );
};
