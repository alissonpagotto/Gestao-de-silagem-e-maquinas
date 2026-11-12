import { Employee } from '../../types';
import { formatDateBR } from '../../lib/storage';
import { isBrokenAvatarUrl } from '../common/EmployeeAvatar';
import { encodeCode128B } from './badgeHelpers';
import {
  BadgeThemeConfig,
  DEFAULT_BADGE_THEME,
  getBadgeDimensions,
  isLightHexColor,
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
  const hasLogo = Boolean(companyLogoUrl && !isBrokenAvatarUrl(companyLogoUrl));
  if (hasLogo) {
    return `
      <div style="width:${boxPx}px;height:${boxPx}px;border-radius:4px;background:#ffffff;padding:2px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:1px solid rgba(0,0,0,0.12);">
        <img src="${escapeHtml(companyLogoUrl)}" alt="${escapeHtml(companyName)}" style="width:100%;height:100%;object-fit:contain;display:block;" onerror="this.style.display='none'" />
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
  const rawPhoto = employee.avatar_url || employee.foto || employee.foto_url || employee.photoUrl;
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
      <div style="${sizeStyle}border-radius:${radiusCss};border:${borderCss};background:#f1f5f9;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;${extraStyle}">
        <img src="${escapeHtml(rawPhoto)}" alt="${escapeHtml(employee.name)}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.outerHTML='${fallbackHtml.replace(/\n/g, '').replace(/'/g, "\\'")}'" />
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
  const footerHtml = showFooter
    ? `
      <div style="background:${footerBg};border-top:1px solid ${footerBorder};padding:${px(4)} ${px(10)};display:flex;align-items:center;justify-content:space-between;font-size:${px(7)};font-weight:700;color:${theme.textColor};flex-shrink:0;">
        ${theme.showCpf ? `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">CPF: ${escapeHtml(employee.cpf || '—')}</span>` : '<span></span>'}
        ${theme.showAdmissionDate ? `<span style="flex-shrink:0;margin-left:4px;">Adm: ${escapeHtml(formattedAdmission)}</span>` : ''}
      </div>
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
      <div class="badge-cut-card" style="background:${theme.bodyBgColor};color:${theme.textColor};">
        <div style="flex-shrink:0;">
          <div style="height:${mm(2.4)};width:100%;background:${theme.headerColor};"></div>
          <div style="padding:${px(6)} ${px(10)} ${px(4)} ${px(10)};display:flex;flex-direction:column;align-items:center;">
            <div style="width:${px(30)};height:${px(4)};border-radius:9999px;background:rgba(148,163,184,0.65);margin-bottom:${px(5)};"></div>
            <div style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
              ${logoHtml}
              <div style="min-width:0;text-align:center;">
                <div style="font-size:${px(8.5)};font-weight:900;text-transform:uppercase;letter-spacing:0.03em;line-height:1.15;color:${theme.textColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${escapeHtml(companyName)}
                </div>
                <div style="font-size:${px(6)};font-weight:700;text-transform:uppercase;letter-spacing:0.14em;line-height:1.2;color:${theme.accentColor};">
                  CRACHÁ DE IDENTIFICAÇÃO
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="flex:1;padding:${px(4)} ${px(10)} ${px(4)} ${px(10)};display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:0;">
          ${photoHtml}
          <div style="width:100%;text-align:center;padding:0 2px;">
            <div style="font-size:${px(10)};font-weight:900;text-transform:uppercase;line-height:1.15;color:${theme.textColor};word-break:break-word;">
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
      <div class="badge-cut-card" style="background:${theme.bodyBgColor};color:${theme.textColor};">
        <div style="background:${theme.headerColor};border-bottom:3px solid ${theme.accentColor};padding:${px(6)} ${px(10)} ${px(20)} ${px(10)};flex-shrink:0;">
          <div style="width:${px(30)};height:${px(4)};border-radius:9999px;background:rgba(255,255,255,0.35);border:1px solid rgba(255,255,255,0.2);margin:0 auto ${px(5)} auto;"></div>
          <div style="display:flex;align-items:center;gap:6px;">
            ${logoHtml}
            <div style="min-width:0;flex:1;">
              <div style="font-size:${px(8.5)};font-weight:900;text-transform:uppercase;letter-spacing:0.03em;line-height:1.15;color:${headerTextColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHtml(companyName)}
              </div>
              <div style="font-size:${px(6)};font-weight:700;text-transform:uppercase;letter-spacing:0.14em;line-height:1.2;margin-top:1px;color:${headerSubColor};">
                OPERACIONAL &amp; CAMPO
              </div>
            </div>
          </div>
        </div>

        <div style="flex:1;padding:0 ${px(10)} ${px(4)} ${px(10)};display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:0;margin-top:-${px(15)};position:relative;z-index:2;">
          ${photoHtml}
          <div style="width:100%;text-align:center;padding:0 2px;margin-top:${px(3)};">
            <div style="font-size:${px(10)};font-weight:900;text-transform:uppercase;line-height:1.15;color:${theme.textColor};word-break:break-word;">
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
    <div class="badge-cut-card" style="background:${theme.bodyBgColor};color:${theme.textColor};">
      <div style="background:${theme.headerColor};border-bottom:2.5px solid ${theme.accentColor};padding:${px(6)} ${px(10)} ${px(8)} ${px(10)};flex-shrink:0;">
        <div style="width:${px(30)};height:${px(4)};border-radius:9999px;background:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.2);margin:0 auto ${px(5)} auto;"></div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${logoHtml}
          <div style="min-width:0;flex:1;">
            <div style="font-size:${px(8.5)};font-weight:900;text-transform:uppercase;letter-spacing:0.03em;line-height:1.15;color:${headerTextColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(companyName)}
            </div>
            <div style="font-size:${px(6.5)};font-weight:700;text-transform:uppercase;letter-spacing:0.13em;line-height:1.2;margin-top:1px;color:${headerSubColor};">
              IDENTIFICAÇÃO FUNCIONAL
            </div>
          </div>
        </div>
      </div>

      <div style="flex:1;padding:${px(7)} ${px(10)} ${px(4)} ${px(10)};display:flex;flex-direction:column;align-items:center;justify-content:space-between;min-height:0;">
        ${photoHtml}

        <div style="width:100%;text-align:center;padding:0 2px;margin-top:${px(3)};">
          <div style="font-size:${px(10)};font-weight:900;text-transform:uppercase;line-height:1.15;color:${theme.textColor};word-break:break-word;">
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

/**
 * Gera o documento HTML autônomo pronto para impressão A4 em grade dinâmica
 * (3 colunas para 54×86mm ou 2 colunas para 70×100mm / 85×120mm)
 * com disparo automático de window.focus() e window.print() após o carregamento das imagens.
 */
export function generateBadgesPrintHtml(
  entries: BadgePrintEntry[],
  companyName: string,
  companyLogoUrl?: string,
  theme: BadgeThemeConfig = DEFAULT_BADGE_THEME
): string {
  const dims = getBadgeDimensions(theme.size);
  const cardsHtml = entries
    .map((entry) => buildSingleBadgeHtml(entry, companyName, companyLogoUrl, theme))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Impressão de Crachás - ${escapeHtml(companyName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }

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
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px;
      background: #cad4e6;
      border-bottom: 1px solid #000000;
      margin-bottom: 12px;
    }

    .print-toolbar-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
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

    .badges-print-grid {
      display: grid;
      grid-template-columns: repeat(${dims.columnsPerA4Row}, ${dims.widthMm}mm);
      gap: ${dims.gapMm}mm;
      justify-content: center;
      align-content: start;
      width: 100%;
      padding: 2mm 0;
    }

    .badge-cut-card {
      width: ${dims.widthMm}mm;
      height: ${dims.heightMm}mm;
      min-width: ${dims.widthMm}mm;
      min-height: ${dims.heightMm}mm;
      max-width: ${dims.widthMm}mm;
      max-height: ${dims.heightMm}mm;
      border: 1px dashed #999999;
      border-radius: 3.5mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media print {
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
</head>
<body>
  <div class="print-toolbar">
    <span class="print-toolbar-title">Crachás Selecionados (${entries.length}) • ${escapeHtml(dims.label)} (A4)</span>
    <button type="button" class="print-toolbar-btn" onclick="window.focus(); window.print();">Imprimir Agora</button>
  </div>

  <div class="badges-print-grid">
    ${cardsHtml}
  </div>

  <script>
    (function () {
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
