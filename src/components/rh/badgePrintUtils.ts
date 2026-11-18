import { CompanyProfile, Employee } from '../../types';
import { formatDateBR } from '../../lib/storage';
import { getCachedMediaUrl } from '../../lib/imageStorage';
import { isBrokenAvatarUrl } from '../common/EmployeeAvatar';
import {
  encodeCode128B,
  resolveBadgeCompanyBackInfo,
  resolveEmployeeEmergencyContact,
} from './badgeHelpers';
import {
  BADGE_PAPER_OPTIONS,
  BADGE_PAPER_ORDER,
  BADGE_PAPER_STORAGE_KEY,
  BadgePaperSize,
  BadgeThemeConfig,
  DEFAULT_BADGE_THEME,
  getBadgeDimensions,
  isLightHexColor,
  isValidBadgePaperSize,
} from './badgeTheme';

export interface BadgePrintEntry {
  employee: Employee;
  regNumber: string;
}

function escapeHtml(raw: string | undefined | null): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(name: string | undefined): string {
  const parts = String(name || 'C').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] || 'C').slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function buildCode128SvgHtml(
  value: string,
  height = 21,
  widthMm = 43,
  scaleFactor = 1
): string {
  const cleanValue = String(value || '').trim() || '00000';
  const encoded = encodeCode128B(cleanValue);
  const rects = encoded.bars
    .map(
      (bar) =>
        `<rect x="${bar.x}" y="0" width="${bar.width}" height="${height}" fill="#000000" />`
    )
    .join('');

  const labelFontPx = (8.5 * scaleFactor).toFixed(1);

  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:#ffffff;width:${widthMm}mm;padding:1px 0;">
      <svg viewBox="0 0 ${encoded.totalWidth} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:${height}px;display:block;">
        <rect x="0" y="0" width="${encoded.totalWidth}" height="${height}" fill="#ffffff" />
        ${rects}
      </svg>
      <div style="margin-top:1.5px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:${labelFontPx}px;font-weight:700;letter-spacing:0.22em;color:#000000;line-height:1;">
        ${escapeHtml(cleanValue)}
      </div>
    </div>
  `;
}

function buildLogoHtml(
  theme: BadgeThemeConfig,
  companyName: string,
  companyLogoUrl: string | undefined,
  accentTextColor: string,
  scaleFactor = 1
): string {
  if (!theme.showLogo) return '';
  const boxPx = Math.round(28 * scaleFactor);
  const fontPx = Math.round(10 * scaleFactor);
  const resolvedLogoUrl = getCachedMediaUrl(companyLogoUrl);
  const hasLogo = Boolean(resolvedLogoUrl && !isBrokenAvatarUrl(resolvedLogoUrl));
  if (hasLogo) {
    return `
      <div style="width:${boxPx}px;height:${boxPx}px;border-radius:4px;background:#ffffff;padding:2px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:1px solid rgba(0,0,0,0.12);">
        <img src="${escapeHtml(resolvedLogoUrl)}" alt="${escapeHtml(companyName)}" style="width:100%;height:100%;object-fit:contain;display:block;" onerror="this.style.display='none'" />
      </div>
    `;
  }
  return `
    <div style="width:${boxPx}px;height:${boxPx}px;border-radius:4px;background:${theme.accentColor};border:1px solid rgba(255,255,255,0.35);color:${accentTextColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:${fontPx}px;font-weight:900;">
      ID
    </div>
  `;
}

function buildPhotoHtml(
  employee: Employee,
  borderCss: string,
  sizeStyle: string,
  radiusCss: string,
  extraStyle = '',
  scaleFactor = 1
): string {
  const rawPhotoRef = employee.avatar_url || employee.foto || employee.foto_url || employee.photoUrl;
  const rawPhoto = getCachedMediaUrl(rawPhotoRef);
  const hasPhoto = Boolean(rawPhoto && !isBrokenAvatarUrl(rawPhoto));
  const initials = escapeHtml(getInitials(employee.name));
  const iconSize = Math.round(20 * scaleFactor);
  const initialsFont = (9 * scaleFactor).toFixed(1);

  const fallbackHtml = `
    <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#e2e8f0;color:#475569;">
      <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:2px;">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      <span style="font-size:${initialsFont}px;font-weight:900;letter-spacing:0.06em;">${initials}</span>
    </div>
  `;

  if (hasPhoto) {
    return `
      <div style="${sizeStyle}border-radius:${radiusCss};border:${borderCss};background:#f1f5f9;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;${extraStyle}">
        <img src="${escapeHtml(rawPhoto)}" alt="${escapeHtml(employee.name)}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" />
        <div style="display:none;width:100%;height:100%;flex-direction:column;align-items:center;justify-content:center;background:#e2e8f0;color:#475569;">
          <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:2px;">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span style="font-size:${initialsFont}px;font-weight:900;letter-spacing:0.06em;">${initials}</span>
        </div>
      </div>
    `;
  }

  return `
    <div style="${sizeStyle}border-radius:${radiusCss};border:${borderCss};background:#e2e8f0;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;${extraStyle}">
      ${fallbackHtml}
    </div>
  `;
}

function buildSingleBadgeHtml(
  entry: BadgePrintEntry,
  companyName: string,
  companyLogoUrl: string | undefined,
  theme: BadgeThemeConfig
): string {
  const { employee, regNumber } = entry;
  const dims = getBadgeDimensions(theme.size);
  const s = dims.scaleFactor;
  const px = (base: number) => `${(base * s).toFixed(1)}px`;
  const mm = (base: number) => `${(base * s).toFixed(2)}mm`;

  const primaryRole =
    Array.isArray(employee.roles) && employee.roles.length > 0
      ? employee.roles[0]
      : (employee.role || 'Colaborador').split(',')[0].trim();

  const formattedAdmission = employee.admissionDate
    ? formatDateBR(employee.admissionDate) || '—'
    : '—';

  const headerIsLight = isLightHexColor(theme.headerColor);
  const headerTextColor = headerIsLight ? '#0f172a' : '#ffffff';
  const headerSubColor = headerIsLight ? '#334155' : 'rgba(255,255,255,0.84)';

  const accentIsLight = isLightHexColor(theme.accentColor);
  const accentTextColor = accentIsLight ? '#0f172a' : '#ffffff';

  const bodyIsLight = isLightHexColor(theme.bodyBgColor);
  const footerBg = bodyIsLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.1)';
  const footerBorder = bodyIsLight ? 'rgba(15, 23, 42, 0.18)' : 'rgba(255, 255, 255, 0.2)';

  const logoHtml = buildLogoHtml(theme, companyName, companyLogoUrl, accentTextColor, s);
  const barcodeHeight = Math.round(21 * s);
  const barcodeWidthMm = Math.round(dims.widthMm * 0.8);
  const barcodeHtml = buildCode128SvgHtml(regNumber, barcodeHeight, barcodeWidthMm, s);

  const showFooter = theme.showCpf || theme.showAdmissionDate;
  const headerSubtitle = (theme.headerSubtitle || '').trim();
  const companyFontBase = theme.companyNameFontSize ?? DEFAULT_BADGE_THEME.companyNameFontSize;
  const employeeFontBase = theme.employeeNameFontSize ?? DEFAULT_BADGE_THEME.employeeNameFontSize;
  const headerSubtitleHtmlMinimal = headerSubtitle
    ? `<div style="font-size:${px(6.5)};font-weight:700;text-transform:uppercase;letter-spacing:0.14em;line-height:1.2;margin-top:1px;color:${theme.accentColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(headerSubtitle)}</div>`
    : '';
  const headerSubtitleHtmlBanner = headerSubtitle
    ? `<div style="font-size:${px(6.5)};font-weight:700;text-transform:uppercase;letter-spacing:0.14em;line-height:1.2;margin-top:1px;color:${headerSubColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(headerSubtitle)}</div>`
    : '';
  const footerHtml = showFooter
    ? `
      <footer class="badge-footer" style="width:100%;box-sizing:border-box;background:${footerBg};border-top:1px solid ${footerBorder};padding:1.2mm 4mm 2.5mm 4mm;display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:${px(7)};font-weight:700;color:${theme.textColor};flex-shrink:0;">
        ${theme.showCpf ? `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">CPF: ${escapeHtml(employee.cpf || '—')}</span>` : '<span></span>'}
        ${theme.showAdmissionDate ? `<span style="flex-shrink:0;white-space:nowrap;">Adm: ${escapeHtml(formattedAdmission)}</span>` : ''}
      </footer>
    `
    : '';

  if (theme.style === 'minimal_clean') {
    const photoHtml = buildPhotoHtml(
      employee,
      `1.5px solid ${theme.accentColor}`,
      `width:${mm(19)};height:${mm(21.5)};`,
      '8px',
      '',
      s
    );

    return `
      <div class="badge-card badge-cut-card" style="background:${theme.bodyBgColor};color:${theme.textColor};">
        <div style="flex-shrink:0;">
          <div style="height:${mm(2.4)};width:100%;background:${theme.headerColor};"></div>
          <div style="padding:${px(6)} ${px(10)} ${px(4)} ${px(10)};display:flex;flex-direction:column;align-items:center;">
            <div style="width:${px(30)};height:${px(4)};border-radius:9999px;background:rgba(148,163,184,0.65);margin-bottom:${px(5)};"></div>
            <div style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
              ${logoHtml}
              <div style="min-width:0;text-align:center;">
                <div style="font-size:${px(companyFontBase)};font-weight:900;text-transform:uppercase;letter-spacing:0.03em;line-height:1.15;color:${theme.textColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${escapeHtml(companyName)}
                </div>
                ${headerSubtitleHtmlMinimal}
              </div>
            </div>
          </div>
        </div>

        <div style="flex:1;padding:${px(4)} ${px(10)} ${px(4)} ${px(10)};display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:0;overflow:hidden;">
          ${photoHtml}
          <div style="width:100%;text-align:center;padding:0 2px;">
            <div style="font-size:${px(employeeFontBase)};font-weight:900;text-transform:uppercase;line-height:1.15;color:${theme.textColor};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;">
              ${escapeHtml(employee.name)}
            </div>
            <div style="display:inline-block;max-width:100%;margin-top:${px(3)};padding:${px(2)} ${px(8)};border-radius:9999px;border:1px solid ${theme.accentColor};background:${bodyIsLight ? '#ffffff' : 'rgba(255,255,255,0.92)'};color:${theme.accentColor};font-size:${px(7.5)};font-weight:800;text-transform:uppercase;letter-spacing:0.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(primaryRole)}
            </div>
          </div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:${px(8.5)};font-weight:900;letter-spacing:0.14em;color:${theme.textColor};">
            REG: ${escapeHtml(regNumber)}
          </div>
          <div style="width:100%;display:flex;align-items:center;justify-content:center;background:#ffffff;border-radius:4px;padding:1px 3px;border:1px solid rgba(203,213,225,0.7);">
            ${barcodeHtml}
          </div>
        </div>

        ${footerHtml}
      </div>
    `;
  }

  if (theme.style === 'modern_agro') {
    const photoHtml = buildPhotoHtml(
      employee,
      `2.5px solid ${theme.accentColor}`,
      `width:${mm(21)};height:${mm(21)};`,
      '9999px',
      'box-shadow:0 0 0 2px #ffffff;',
      s
    );

    return `
      <div class="badge-card badge-cut-card" style="background:${theme.bodyBgColor};color:${theme.textColor};">
        <div style="background:${theme.headerColor};border-bottom:3px solid ${theme.accentColor};padding:${px(6)} ${px(10)} ${px(20)} ${px(10)};flex-shrink:0;">
          <div style="width:${px(30)};height:${px(4)};border-radius:9999px;background:rgba(255,255,255,0.35);border:1px solid rgba(255,255,255,0.2);margin:0 auto ${px(5)} auto;"></div>
          <div style="display:flex;align-items:center;gap:6px;${headerSubtitle ? '' : 'justify-content:center;'}">
            ${logoHtml}
            <div style="min-width:0;${headerSubtitle ? 'flex:1;' : 'text-align:center;'}">
              <div style="font-size:${px(companyFontBase)};font-weight:900;text-transform:uppercase;letter-spacing:0.03em;line-height:1.15;color:${headerTextColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHtml(companyName)}
              </div>
              ${headerSubtitleHtmlBanner}
            </div>
          </div>
        </div>

        <div style="flex:1;padding:0 ${px(10)} ${px(4)} ${px(10)};display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:0;overflow:hidden;margin-top:-${px(15)};position:relative;z-index:2;">
          ${photoHtml}
          <div style="width:100%;text-align:center;padding:0 2px;margin-top:${px(3)};">
            <div style="font-size:${px(employeeFontBase)};font-weight:900;text-transform:uppercase;line-height:1.15;color:${theme.textColor};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;">
              ${escapeHtml(employee.name)}
            </div>
          </div>
          <div style="width:100%;border-radius:5px;padding:${px(4)} ${px(8)};background:${theme.accentColor};color:${accentTextColor};display:flex;align-items:center;justify-content:space-between;gap:4px;">
            <span style="font-size:${px(7.5)};font-weight:800;text-transform:uppercase;letter-spacing:0.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(primaryRole)}
            </span>
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:${px(8)};font-weight:900;letter-spacing:0.06em;flex-shrink:0;background:rgba(0,0,0,0.22);color:#ffffff;padding:${px(1.5)} ${px(5)};border-radius:3px;">
              ${escapeHtml(regNumber)}
            </span>
          </div>
          <div style="width:100%;display:flex;align-items:center;justify-content:center;background:#ffffff;border-radius:4px;padding:1px 3px;">
            ${barcodeHtml}
          </div>
        </div>

        ${footerHtml}
      </div>
    `;
  }

  // ESTILO PADRÃO: CLÁSSICO CORPORATIVO
  const photoHtml = buildPhotoHtml(
    employee,
    `2px solid ${theme.accentColor}`,
    `width:${mm(20)};height:${mm(22.5)};`,
    '6px',
    '',
    s
  );

  return `
    <div class="badge-card badge-cut-card" style="background:${theme.bodyBgColor};color:${theme.textColor};">
      <div style="background:${theme.headerColor};border-bottom:2.5px solid ${theme.accentColor};padding:${px(6)} ${px(10)} ${px(8)} ${px(10)};flex-shrink:0;">
        <div style="width:${px(30)};height:${px(4)};border-radius:9999px;background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.2);margin:0 auto ${px(5)} auto;"></div>
        <div style="display:flex;align-items:center;gap:6px;${headerSubtitle ? '' : 'justify-content:center;'}">
          ${logoHtml}
          <div style="min-width:0;${headerSubtitle ? 'flex:1;' : 'text-align:center;'}">
            <div style="font-size:${px(companyFontBase)};font-weight:900;text-transform:uppercase;letter-spacing:0.03em;line-height:1.15;color:${headerTextColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(companyName)}
            </div>
            ${headerSubtitleHtmlBanner}
          </div>
        </div>
      </div>

      <div style="flex:1;padding:${px(7)} ${px(10)} ${px(4)} ${px(10)};display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:0;overflow:hidden;">
        ${photoHtml}

        <div style="width:100%;text-align:center;padding:0 2px;margin-top:${px(3)};">
          <div style="font-size:${px(employeeFontBase)};font-weight:900;text-transform:uppercase;line-height:1.15;color:${theme.textColor};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;">
            ${escapeHtml(employee.name)}
          </div>
          <div style="display:inline-block;max-width:100%;margin-top:${px(3)};padding:${px(2)} ${px(8)};border-radius:4px;background:${theme.accentColor};color:${accentTextColor};font-size:${px(7.5)};font-weight:800;text-transform:uppercase;letter-spacing:0.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHtml(primaryRole)}
          </div>
        </div>

        <div style="width:100%;display:flex;align-items:center;justify-content:center;margin-top:2px;">
          <span style="padding:${px(2)} ${px(8)};border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:${px(8.5)};font-weight:900;letter-spacing:0.12em;border:1px solid ${theme.accentColor};color:${theme.textColor};background:${bodyIsLight ? '#f8fafc' : 'rgba(255,255,255,0.92)'};">
            REG: ${escapeHtml(regNumber)}
          </span>
        </div>

        <div style="width:100%;display:flex;align-items:center;justify-content:center;background:#ffffff;border-radius:4px;padding:1px 3px;">
          ${barcodeHtml}
        </div>
      </div>

      ${footerHtml}
    </div>
  `;
}

function buildSingleBadgeBackHtml(
  entry: BadgePrintEntry,
  companyName: string,
  theme: BadgeThemeConfig,
  companyProfile?: CompanyProfile
): string {
  const { employee } = entry;
  const dims = getBadgeDimensions(theme.size);
  const s = dims.scaleFactor;
  const px = (base: number) => `${(base * s).toFixed(1)}px`;

  const headerIsLight = isLightHexColor(theme.headerColor);
  const headerTextColor = headerIsLight ? '#0f172a' : '#ffffff';
  const headerSubColor = headerIsLight ? '#334155' : 'rgba(255,255,255,0.84)';

  const bodyIsLight = isLightHexColor(theme.bodyBgColor);
  const noticeBg = bodyIsLight ? 'rgba(15, 23, 42, 0.035)' : 'rgba(255, 255, 255, 0.09)';
  const noticeBorder = bodyIsLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.22)';
  const footerBg = bodyIsLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.1)';
  const footerBorder = bodyIsLight ? 'rgba(15, 23, 42, 0.18)' : 'rgba(255, 255, 255, 0.2)';

  const companyInfo = resolveBadgeCompanyBackInfo(companyProfile, companyName);
  const emergencyContact = resolveEmployeeEmergencyContact(employee);
  const noticeText = (theme.backNoticeText ?? DEFAULT_BADGE_THEME.backNoticeText).trim();

  const companyRows: { label: string; value: string }[] = [];
  if (theme.showBackCorporateName && companyInfo.corporateName) {
    companyRows.push({ label: 'RAZÃO SOCIAL', value: companyInfo.corporateName });
  }
  if (theme.showBackCnpj && companyInfo.cnpj) {
    companyRows.push({ label: 'CNPJ', value: companyInfo.cnpj });
  }
  if (theme.showBackIe && companyInfo.stateRegistration) {
    companyRows.push({ label: 'INSC. ESTADUAL', value: companyInfo.stateRegistration });
  }
  if (theme.showBackAddress && companyInfo.fullAddress) {
    companyRows.push({ label: 'ENDEREÇO', value: companyInfo.fullAddress });
  }
  if (theme.showBackPhone && companyInfo.phone) {
    companyRows.push({ label: 'TELEFONE / WHATSAPP', value: companyInfo.phone });
  }

  const noticeHtml = noticeText
    ? `
      <div style="border-radius:4px;background:${noticeBg};border:1px solid ${noticeBorder};padding:${px(3.5)} ${px(5)};">
        <div style="font-size:${px(7)};font-weight:900;text-transform:uppercase;letter-spacing:0.06em;color:${theme.accentColor};margin-bottom:${px(1.5)};">
          Aviso / Termo de Responsabilidade
        </div>
        <p style="margin:0;font-size:${px(9.5)};font-weight:500;line-height:1.22;text-align:justify;color:${theme.textColor};word-break:break-word;">
          ${escapeHtml(noticeText)}
        </p>
      </div>
    `
    : '';

  const companyRowsHtml =
    companyRows.length > 0
      ? `
      <div style="display:flex;flex-direction:column;gap:${px(4)};min-height:0;">
        ${companyRows
          .map(
            (row) => `
          <div style="font-size:${px(9.8)};line-height:1.22;word-break:break-word;margin:0;">
            <span style="font-size:${px(8)};font-weight:900;text-transform:uppercase;color:${theme.accentColor};">${escapeHtml(row.label)}: </span>
            <span style="font-weight:700;color:${theme.textColor};">${escapeHtml(row.value)}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `
      : '';

  const emergencyHtml =
    theme.showBackEmergencyContact && emergencyContact
      ? `
      <div style="border-left:2.5px solid ${theme.accentColor};background:${noticeBg};padding:${px(3)} ${px(5)};border-radius:2px;flex-shrink:0;">
        <div style="font-size:${px(7.2)};font-weight:900;text-transform:uppercase;letter-spacing:0.04em;color:${theme.accentColor};">
          Contato de Emergência
        </div>
        <div style="font-size:${px(10)};font-weight:800;line-height:1.2;color:${theme.textColor};word-break:break-word;">
          ${escapeHtml(emergencyContact)}
        </div>
      </div>
    `
      : '';

  const signatureFooterHtml = theme.showBackSignatureLine
    ? `
      <footer class="badge-footer" style="width:100%;box-sizing:border-box;background:${footerBg};border-top:1px solid ${footerBorder};padding:${px(10.5)} ${px(10)} ${px(3)} ${px(10)};flex-shrink:0;">
        <div style="border-top:1px solid ${theme.textColor};opacity:0.72;margin-bottom:${px(1.5)};"></div>
        <div style="text-align:center;font-size:${px(6.8)};font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${theme.textColor};">
          Assinatura do Portador
        </div>
      </footer>
    `
    : `<div style="height:${px(4)};width:100%;background:${theme.accentColor};flex-shrink:0;"></div>`;

  return `
    <div class="badge-card badge-cut-card badge-back-card" style="background:${theme.bodyBgColor};color:${theme.textColor};">
      <div style="background:${theme.headerColor};border-bottom:2px solid ${theme.accentColor};padding:${px(4)} ${px(8)} ${px(4.5)} ${px(8)};flex-shrink:0;">
        <div style="width:${px(28)};height:${px(3)};border-radius:9999px;background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.2);margin:0 auto ${px(2.5)} auto;"></div>
        <div style="text-align:center;min-width:0;">
          <div style="font-size:${px(8.5)};font-weight:900;text-transform:uppercase;letter-spacing:0.03em;line-height:1.15;color:${headerTextColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHtml(companyName)}
          </div>
          <div style="font-size:${px(6)};font-weight:700;text-transform:uppercase;letter-spacing:0.14em;line-height:1.2;margin-top:${px(1)};color:${headerSubColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            Verso • Identificação Funcional
          </div>
        </div>
      </div>

      <div style="flex:1;padding:${px(5)} ${px(7.5)} ${px(4.5)} ${px(7.5)};display:flex;flex-direction:column;justify-content:space-evenly;gap:${px(5)};min-height:0;overflow:hidden;">
        ${noticeHtml}
        ${companyRowsHtml}
        ${emergencyHtml}
      </div>

      ${signatureFooterHtml}
    </div>
  `;
}

function buildDynamicPageCss(
  paperSize: BadgePaperSize,
  widthMm: number,
  heightMm: number,
  badgeId: string
): string {
  if (paperSize === 'pvc_card') {
    return `
      @page {
        size: ${widthMm}mm ${heightMm}mm;
        margin: 0;
      }

      .badges-pvc-pages {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6mm;
        width: 100%;
        padding: 4mm 0;
      }

      .pvc-page-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5mm;
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: always;
        break-after: page;
      }

      .pvc-page-wrapper:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .pvc-page-label {
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #475569;
      }

      .pvc-page-card-slot {
        width: ${widthMm}mm;
        height: ${heightMm}mm;
        overflow: hidden;
      }

      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
        }

        .badges-pvc-pages {
          display: block !important;
          padding: 0 !important;
          gap: 0 !important;
        }

        .pvc-page-wrapper {
          width: ${widthMm}mm !important;
          height: ${heightMm}mm !important;
          margin: 0 !important;
          padding: 0 !important;
          gap: 0 !important;
          display: block !important;
        }

        .pvc-page-card-slot .badge-card,
        .pvc-page-card-slot .badge-cut-card {
          border: none !important;
          border-radius: 0 !important;
        }
      }
    `;
  }

  if (paperSize === 'a4_landscape') {
    return `
      @page {
        size: A4 landscape;
        margin: 6mm;
      }

      .badges-print-grid {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
        align-items: flex-start;
        gap: 4mm 8mm;
        width: 100%;
        padding: 2mm 0;
      }
    `;
  }

  if (paperSize === 'a5_portrait') {
    return `
      @page {
        size: A5 portrait;
        margin: 6mm;
      }

      .badges-print-grid {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4mm;
        width: 100%;
        padding: 2mm 0;
      }
    `;
  }

  // Padrão: A4 Retrato (210 x 297 mm) — Máximo Aproveitamento (3 pares 54x86mm por folha)
  const rowGapMm = badgeId === 'pvc_54x86' ? 3.5 : 5;
  return `
    @page {
      size: A4 portrait;
      margin: 6mm;
    }

    .badges-print-grid {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: ${rowGapMm}mm;
      width: 100%;
      padding: 2mm 0;
    }
  `;
}

/**
 * Gera o documento HTML autônomo pronto para impressão (A4 Retrato, A4 Paisagem,
 * A5 ou Cartão PVC / Etiqueta Térmica 1 face por página) com disparo automático
 * de window.focus() e window.print() após o carregamento das imagens.
 */
export function generateBadgesPrintHtml(
  entries: BadgePrintEntry[],
  companyName: string,
  companyLogoUrl?: string,
  theme: BadgeThemeConfig = DEFAULT_BADGE_THEME,
  companyProfile?: CompanyProfile,
  initialPaperSize: BadgePaperSize = 'a4_portrait'
): string {
  const dims = getBadgeDimensions(theme.size);
  const paperSize: BadgePaperSize = isValidBadgePaperSize(initialPaperSize)
    ? initialPaperSize
    : 'a4_portrait';
  const validEntries = entries.filter((entry) => Boolean(entry && entry.employee));
  const centerGapMm = 8;

  const builtCards = validEntries.map((entry, idx) => ({
    index: idx,
    name: entry.employee.name || `Colaborador ${idx + 1}`,
    frontHtml: buildSingleBadgeHtml(entry, companyName, companyLogoUrl, theme),
    backHtml: buildSingleBadgeBackHtml(entry, companyName, theme, companyProfile),
  }));

  const pairsHtml = builtCards
    .map(
      ({ frontHtml, backHtml }) => `
        <div class="badge-pair-wrapper">
          <div class="badge-pair-label">
            <span>FRENTE</span>
            <span>RECORTE</span>
            <span>VERSO</span>
          </div>
          <div class="badge-pair">
            ${frontHtml}
            <div class="badge-cut-spacer" title="Espaço de recorte (${centerGapMm}mm) entre Frente e Verso">
              <div class="badge-cut-center-line"></div>
              <span class="badge-cut-scissors" aria-hidden="true">✂️</span>
            </div>
            ${backHtml}
          </div>
        </div>
      `
    )
    .join('\n');

  const pvcPagesHtml = builtCards
    .map(
      ({ name, frontHtml, backHtml }) => `
        <div class="pvc-page-wrapper">
          <div class="pvc-page-label no-print">${escapeHtml(name)} • Página 1 (Frente)</div>
          <div class="pvc-page-card-slot">${frontHtml}</div>
        </div>
        <div class="pvc-page-wrapper">
          <div class="pvc-page-label no-print">${escapeHtml(name)} • Página 2 (Verso)</div>
          <div class="pvc-page-card-slot">${backHtml}</div>
        </div>
      `
    )
    .join('\n');

  const cssByPaperSize: Record<BadgePaperSize, string> = {
    a4_portrait: buildDynamicPageCss('a4_portrait', dims.widthMm, dims.heightMm, dims.id),
    a4_landscape: buildDynamicPageCss('a4_landscape', dims.widthMm, dims.heightMm, dims.id),
    a5_portrait: buildDynamicPageCss('a5_portrait', dims.widthMm, dims.heightMm, dims.id),
    pvc_card: buildDynamicPageCss('pvc_card', dims.widthMm, dims.heightMm, dims.id),
  };

  const paperSelectOptionsHtml = BADGE_PAPER_ORDER.map((id) => {
    const opt = BADGE_PAPER_OPTIONS[id];
    const selectedAttr = id === paperSize ? ' selected' : '';
    return `<option value="${id}"${selectedAttr}>${escapeHtml(opt.label)}</option>`;
  }).join('');

  const initialBodyContent =
    paperSize === 'pvc_card'
      ? `<div class="badges-pvc-pages">${pvcPagesHtml}</div>`
      : `<div class="badges-print-grid">${pairsHtml}</div>`;

  const serializedCssMap = JSON.stringify(cssByPaperSize).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Impressão de Crachás (Frente & Verso) - ${escapeHtml(companyName)}</title>
  <style id="base-print-style">
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    .print-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px 14px;
      padding: 10px 16px;
      background: #cad4e6;
      border-bottom: 1px solid #000000;
      margin-bottom: 10px;
    }

    .print-toolbar-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
    }

    .print-toolbar-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .print-toolbar-label {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
    }

    .print-toolbar-select {
      padding: 6px 10px;
      border-radius: 6px;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #64748b;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      max-width: 340px;
    }

    .print-toolbar-btn {
      padding: 7px 14px;
      border-radius: 6px;
      background: #059669;
      color: #ffffff;
      border: 1px solid #065f46;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }

    .badge-pair-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .badge-pair-label {
      width: 100%;
      display: grid;
      grid-template-columns: ${dims.widthMm}mm ${centerGapMm}mm ${dims.widthMm}mm;
      align-items: center;
      text-align: center;
      font-size: 6.5px;
      font-weight: 800;
      line-height: 1;
      letter-spacing: 0.08em;
      color: #64748b;
      text-transform: uppercase;
      padding-bottom: 0.6mm;
    }

    .badge-pair {
      display: inline-flex;
      flex-direction: row;
      align-items: stretch;
      justify-content: center;
      padding: 0;
    }

    .badge-cut-spacer {
      position: relative;
      width: ${centerGapMm}mm;
      min-width: ${centerGapMm}mm;
      height: ${dims.heightMm}mm;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .badge-cut-center-line {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 50%;
      width: 0;
      transform: translateX(-50%);
      border-left: 1.2px dashed #64748b;
    }

    .badge-cut-scissors {
      position: relative;
      z-index: 1;
      background: #ffffff;
      padding: 2px 0;
      font-size: 11px;
      line-height: 1;
      color: #475569;
    }

    .badge-card,
    .badge-cut-card {
      width: ${dims.widthMm}mm;
      height: ${dims.heightMm}mm;
      min-width: ${dims.widthMm}mm;
      min-height: ${dims.heightMm}mm;
      max-width: ${dims.widthMm}mm;
      max-height: ${dims.heightMm}mm;
      box-sizing: border-box;
      position: relative;
      border: 1px dashed #64748b;
      border-radius: 3.5mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media print {
      .no-print,
      .print-toolbar {
        display: none !important;
      }

      body {
        background: #ffffff !important;
      }

      .badges-print-grid {
        padding: 0 !important;
      }
    }
  </style>
  <style id="dynamic-page-style">
    ${cssByPaperSize[paperSize]}
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <span class="print-toolbar-title">Crachás Selecionados (${validEntries.length}) • ${escapeHtml(dims.label)}</span>
    <div class="print-toolbar-controls">
      <label for="paper-size-select" class="print-toolbar-label">Formato do Papel / Impressora:</label>
      <select id="paper-size-select" class="print-toolbar-select">
        ${paperSelectOptionsHtml}
      </select>
      <button type="button" class="print-toolbar-btn" onclick="window.focus(); window.print();">Imprimir Agora</button>
    </div>
  </div>

  <div id="badges-print-root">
    ${initialBodyContent}
  </div>

  <template id="tpl-pair-mode">
    <div class="badges-print-grid">${pairsHtml}</div>
  </template>

  <template id="tpl-pvc-mode">
    <div class="badges-pvc-pages">${pvcPagesHtml}</div>
  </template>

  <script>
    (function () {
      var cssByPaperSize = ${serializedCssMap};
      var currentMode = ${JSON.stringify(paperSize === 'pvc_card' ? 'pvc' : 'pair')};
      var storageKey = ${JSON.stringify(BADGE_PAPER_STORAGE_KEY)};

      var selectEl = document.getElementById('paper-size-select');
      var styleEl = document.getElementById('dynamic-page-style');
      var rootEl = document.getElementById('badges-print-root');
      var tplPair = document.getElementById('tpl-pair-mode');
      var tplPvc = document.getElementById('tpl-pvc-mode');

      function applyPaperSize(nextSize) {
        if (!cssByPaperSize[nextSize]) return;
        if (styleEl) {
          styleEl.textContent = cssByPaperSize[nextSize];
        }
        var nextMode = nextSize === 'pvc_card' ? 'pvc' : 'pair';
        if (nextMode !== currentMode && rootEl) {
          var sourceTpl = nextMode === 'pvc' ? tplPvc : tplPair;
          if (sourceTpl) {
            rootEl.innerHTML = sourceTpl.innerHTML;
          }
          currentMode = nextMode;
        }
        try {
          localStorage.setItem(storageKey, nextSize);
        } catch (e) {}
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'agrocontrol_badge_paper_size', paperSize: nextSize }, '*');
          }
        } catch (e) {}
      }

      if (selectEl) {
        selectEl.addEventListener('change', function (evt) {
          applyPaperSize(evt.target.value);
        });
      }

      var printed = false;
      function triggerPrint() {
        if (printed) return;
        printed = true;
        setTimeout(function () {
          try {
            window.focus();
            window.print();
          } catch (err) {
            console.error('Erro ao acionar impressão:', err);
          }
        }, 180);
      }

      function waitForImagesAndPrint() {
        var imgs = Array.prototype.slice.call(document.images || []);
        if (imgs.length === 0) {
          triggerPrint();
          return;
        }
        var pending = 0;
        var done = function () {
          pending--;
          if (pending <= 0) triggerPrint();
        };
        imgs.forEach(function (img) {
          if (!img.complete) {
            pending++;
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          }
        });
        if (pending === 0) {
          triggerPrint();
        } else {
          setTimeout(triggerPrint, 1200);
        }
      }

      if (document.readyState === 'complete') {
        waitForImagesAndPrint();
      } else {
        window.addEventListener('load', waitForImagesAndPrint, { once: true });
      }
    })();
  </script>
</body>
</html>`;
}
