import { CompanyProfile } from '../types';
import { formatDateBR } from './storage';

export interface PrintDocumentOptions {
  title: string;
  subtitle?: string;
  documentType?: string;
  company: CompanyProfile;
  contentHtml: string;
  orientation?: 'portrait' | 'landscape';
  showSignatures?: boolean;
  signatureLabels?: string[];
  footerNotes?: string;
  whatsappText?: string;
}

/**
 * Builds a complete, standalone, self-contained HTML document ready for crisp high-contrast printing,
 * embedding the company logo, full cadastral header, styling, and signature lines.
 */
export function generatePrintableHtml(options: PrintDocumentOptions): string {
  const {
    title,
    subtitle,
    documentType = 'DOCUMENTO OFICIAL',
    company,
    contentHtml,
    orientation = 'portrait',
    showSignatures = true,
    signatureLabels = ['Responsável Técnico / Encarregado', 'Gerência Operacional / Diretoria'],
    footerNotes,
  } = options;

  const now = new Date();
  const dateFormatted = formatDateBR(now.toISOString().split('T')[0]);
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fullAddress = [
    company.address,
    company.number ? `nº ${company.number}` : '',
    company.neighborhood ? `- ${company.neighborhood}` : '',
    company.city ? `${company.city}` : '',
    company.state ? `/${company.state}` : '',
    company.zipCode ? `- CEP: ${company.zipCode}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const logoSrc = company.logoUrl || '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${company.tradeName || 'Silagem Fácil'}</title>
  <style>
    @page {
      size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
      margin: ${orientation === 'landscape' ? '8mm 8mm 10mm 8mm' : '12mm 10mm 15mm 10mm'};
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1c1917;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.4;
    }
    .print-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    /* Company Header - 2 Columns Standard */
    .company-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2.5px solid #0963cb;
      padding-bottom: 12px;
      margin-bottom: 16px;
      gap: 16px;
    }
    .company-logo-box {
      width: 90px;
      height: 90px;
      min-width: 90px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #ffffff;
      padding: 4px;
    }
    .company-logo-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .company-info-right {
      flex: 1;
      text-align: right;
      padding-left: 12px;
    }
    .company-trade-name {
      font-size: 16pt;
      font-weight: 900;
      color: #0963cb;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .company-corporate-name {
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
      margin: 0 0 4px 0;
    }
    .company-details {
      font-size: 8.5pt;
      color: #334155;
      line-height: 1.35;
    }
    .doc-badge-box {
      margin-top: 6px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
    }
    .doc-type-badge {
      display: inline-block;
      background: #0963cb;
      color: #ffffff;
      font-size: 8pt;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-meta {
      font-size: 8pt;
      color: #64748b;
      line-height: 1.3;
    }
    .doc-meta strong {
      color: #1e293b;
    }

    /* Document Title */
    .document-headline {
      text-align: center;
      margin-bottom: 18px;
      padding: 6px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .document-headline h1 {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: -0.2px;
    }
    .document-headline p {
      font-size: 8.5pt;
      color: #64748b;
      margin: 2px 0 0 0;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: middle;
    }
    th {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.3px;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Grid columns for teams */
    .teams-print-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .team-print-card {
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .team-print-header {
      padding: 6px 8px;
      font-weight: 800;
      font-size: 11pt;
      text-align: center;
      border-bottom: 1.5px solid #0f172a;
    }
    .team-print-sub {
      font-size: 7.5pt;
      font-weight: 600;
      color: #334155;
      text-align: center;
      padding: 3px 6px;
      background: rgba(255,255,255,0.7);
      border-bottom: 1px solid #cbd5e1;
    }
    .team-member-row {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 8.5pt;
    }
    .team-member-row:last-child {
      border-bottom: none;
    }
    .member-name {
      font-weight: 700;
      color: #0f172a;
    }
    .member-role {
      font-size: 7.5pt;
      color: #64748b;
    }

    /* Signatures */
    .signatures-section {
      margin-top: 24px;
      padding-top: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
      display: flex;
      justify-content: space-around;
      gap: 24px;
    }
    .signature-box {
      flex: 1;
      text-align: center;
      max-width: 280px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .signature-line {
      border-top: 1.5px solid #334155;
      margin-bottom: 4px;
    }
    .signature-title {
      font-size: 8.5pt;
      font-weight: 700;
      color: #1e293b;
    }
    .signature-sub {
      font-size: 7.5pt;
      color: #64748b;
    }

    /* Footer */
    .print-footer {
      margin-top: 16px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      font-size: 7.5pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .no-print {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="print-container">
    
    <!-- Top Official Company Header (Standard 2 Columns) -->
    <header class="company-header">
      <!-- Lado Esquerdo: Logomarca da Empresa -->
      <div class="company-logo-box">
        ${logoSrc ? `<img src="${logoSrc}" alt="Logo ${company.tradeName}" />` : `<div style="font-weight:900;color:#0963cb;font-size:22pt;">SF</div>`}
      </div>

      <!-- Lado Direito: Nome Fantasia em destaque, CNPJ e Cidade/UF -->
      <div class="company-info-right">
        <h2 class="company-trade-name">${company.tradeName || company.corporateName || 'SILAGEM FÁCIL ERP'}</h2>
        ${company.corporateName && company.corporateName !== company.tradeName ? `<p class="company-corporate-name">Razão Social: ${company.corporateName}</p>` : ''}
        <div class="company-details">
          ${company.cnpjCpf ? `<strong>CNPJ:</strong> ${company.cnpjCpf}` : ''}
          ${company.city ? ` • <strong>${company.city}${company.state ? `/${company.state}` : ''}</strong>` : ''}
          ${company.phone ? ` &nbsp;|&nbsp; <strong>Contato:</strong> ${company.phone}` : ''}
          ${company.email ? ` &nbsp;|&nbsp; <strong>E-mail:</strong> ${company.email}` : ''}
          ${fullAddress ? `<br><span style="font-size:7.5pt;color:#64748b;">${fullAddress}</span>` : ''}
        </div>
        <div class="doc-badge-box">
          <span class="doc-type-badge">${documentType}</span>
          <div class="doc-meta">
            <span>Emissão: <strong>${dateFormatted} às ${timeFormatted}</strong></span>
            <span>• Autenticação: <strong>SF-${now.getTime().toString(36).toUpperCase()}</strong></span>
          </div>
        </div>
      </div>
    </header>

    <!-- Document Main Headline -->
    <div class="document-headline">
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>

    <!-- Document Content Body -->
    <main class="document-content">
      ${contentHtml}
    </main>

    <!-- Signatures -->
    ${showSignatures ? `
    <div class="signatures-section">
      ${signatureLabels.map(label => `
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-title">${label}</div>
          <div class="signature-sub">${company.tradeName} • Data: ____/____/________</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Footer (Standard Fixed) -->
    <footer class="print-footer">
      <div>Relatório gerado automaticamente por: Silagem Fácil ERP - Gestão Integrada de Silagem & Frotas Agrícolas</div>
      <div>Página 1 de 1</div>
    </footer>

  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        try {
          window.print();
        } catch(e) {
          console.error(e);
        }
      }, 350);
    });
  </script>
</body>
</html>`;
}

/**
 * Triggers safe and reliable printing by generating a Blob URL that opens with auto-print.
 * This 100% bypasses iframe sandbox blocks ('allow-modals' restrictions) in all browsers.
 */
export function executePrint(htmlContent: string): void {
  // Method 1: Try Blob URL in a new window with auto-print
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWin = window.open(url, '_blank');
    if (printWin) {
      printWin.focus();
      return;
    }
  } catch (e) {
    console.warn('Blob window.open print error:', e);
  }

  // Method 2: Hidden iframe print (works inside sandboxed frames and without popup permission)
  try {
    let iframe = document.getElementById('print-service-iframe') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-service-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (err) {
          console.warn('iframe.contentWindow.print error:', err);
          window.print();
        }
      }, 350);
      return;
    }
  } catch (err) {
    console.warn('Iframe print failed:', err);
  }

  // Fallback: try window.print() directly
  try {
    window.print();
  } catch (err) {
    console.error('Direct print fallback error:', err);
  }
}

/**
 * Clean and format Brazilian phone numbers for WhatsApp API.
 * e.g. "(42) 99188-3321" -> "5542991883321"
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/**
 * Generates and triggers a direct WhatsApp share URL
 */
export function sendViaWhatsApp(text: string, phone?: string): void {
  const encodedText = encodeURIComponent(text.trim());
  const cleanPhone = phone ? formatPhoneForWhatsApp(phone) : '';
  
  let url = '';
  if (cleanPhone) {
    url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  } else {
    // When no phone is passed, WhatsApp opens the contact/chat picker screen
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
