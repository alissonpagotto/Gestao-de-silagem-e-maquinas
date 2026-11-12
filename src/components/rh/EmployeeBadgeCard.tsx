import React, { useMemo, useState } from 'react';
import { IdCard, User } from 'lucide-react';
import { Employee } from '../../types';
import { formatDateBR } from '../../lib/storage';
import { isBrokenAvatarUrl } from '../common/EmployeeAvatar';
import { Code128Barcode } from './Code128Barcode';
import {
  BadgeThemeConfig,
  DEFAULT_BADGE_THEME,
  getBadgeDimensions,
  isLightHexColor,
} from './badgeTheme';

interface EmployeeBadgeCardProps {
  employee: Partial<Employee> & { name: string };
  registrationNumber: string;
  companyName: string;
  companyLogoUrl?: string;
  theme?: BadgeThemeConfig;
}

export const EmployeeBadgeCard: React.FC<EmployeeBadgeCardProps> = ({
  employee,
  registrationNumber,
  companyName,
  companyLogoUrl,
  theme = DEFAULT_BADGE_THEME,
}) => {
  const [imgError, setImgError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const dims = getBadgeDimensions(theme.size);
  const s = dims.scaleFactor;

  const rawPhoto = employee.avatar_url || employee.foto || employee.foto_url || employee.photoUrl;
  const hasPhoto = Boolean(rawPhoto && !isBrokenAvatarUrl(rawPhoto) && !imgError);
  const hasLogo = Boolean(
    theme.showLogo && companyLogoUrl && !isBrokenAvatarUrl(companyLogoUrl) && !logoError
  );

  const initials = useMemo(() => {
    const parts = (employee.name || 'C').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [employee.name]);

  const primaryRole = useMemo(() => {
    if (Array.isArray(employee.roles) && employee.roles.length > 0) {
      return employee.roles[0];
    }
    return (employee.role || 'Colaborador').split(',')[0].trim();
  }, [employee.role, employee.roles]);

  const formattedAdmission = useMemo(() => {
    if (!employee.admissionDate) return '—';
    return formatDateBR(employee.admissionDate) || '—';
  }, [employee.admissionDate]);

  const headerIsLight = isLightHexColor(theme.headerColor);
  const headerTextColor = headerIsLight ? '#0f172a' : '#ffffff';
  const headerSubColor = headerIsLight ? '#334155' : 'rgba(255,255,255,0.82)';

  const accentIsLight = isLightHexColor(theme.accentColor);
  const accentTextColor = accentIsLight ? '#0f172a' : '#ffffff';

  const bodyIsLight = isLightHexColor(theme.bodyBgColor);
  const footerBg = bodyIsLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.1)';
  const footerBorder = bodyIsLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.2)';

  const showFooter = theme.showCpf || theme.showAdmissionDate;

  const px = (base: number) => `${(base * s).toFixed(1)}px`;
  const mm = (base: number) => `${(base * s).toFixed(2)}mm`;

  const renderLogoBadge = () => {
    if (!theme.showLogo) return null;
    const boxPx = Math.round(28 * s);
    const iconPx = Math.round(16 * s);
    if (hasLogo) {
      return (
        <div
          className="rounded bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-2xs border border-black/10"
          style={{ width: `${boxPx}px`, height: `${boxPx}px`, padding: '2px' }}
        >
          <img
            src={companyLogoUrl}
            alt={companyName}
            className="w-full h-full object-contain"
            onError={() => setLogoError(true)}
          />
        </div>
      );
    }
    return (
      <div
        className="rounded flex items-center justify-center shrink-0 border"
        style={{
          width: `${boxPx}px`,
          height: `${boxPx}px`,
          backgroundColor: theme.accentColor,
          borderColor: 'rgba(255,255,255,0.35)',
          color: accentTextColor,
        }}
      >
        <IdCard style={{ width: `${iconPx}px`, height: `${iconPx}px` }} />
      </div>
    );
  };

  const renderFooter = () => {
    if (!showFooter) return null;
    return (
      <div
        className="flex items-center justify-between font-bold shrink-0"
        style={{
          padding: `${px(4)} ${px(10)}`,
          fontSize: px(7),
          backgroundColor: footerBg,
          borderTop: `1px solid ${footerBorder}`,
          color: theme.textColor,
        }}
      >
        {theme.showCpf ? (
          <span className="truncate">CPF: {employee.cpf || '—'}</span>
        ) : (
          <span />
        )}
        {theme.showAdmissionDate && (
          <span className="shrink-0 ml-1">Adm: {formattedAdmission}</span>
        )}
      </div>
    );
  };

  const barcodeHeight = Math.round(21 * s);
  const barcodeWidthMm = `${Math.round(dims.widthMm * 0.8)}mm`;

  // =========================================================================
  // ESTILO 3: MINIMALISTA CLEAN
  // =========================================================================
  if (theme.style === 'minimal_clean') {
    return (
      <div
        className="badge-pvc-card border border-slate-300 rounded-[3.5mm] overflow-hidden flex flex-col justify-between shadow-md select-none shrink-0"
        style={{
          width: `${dims.widthMm}mm`,
          height: `${dims.heightMm}mm`,
          boxSizing: 'border-box',
          backgroundColor: theme.bodyBgColor,
          color: theme.textColor,
        }}
      >
        <div className="shrink-0">
          <div style={{ height: mm(2.4), width: '100%', backgroundColor: theme.headerColor }} />
          <div
            className="flex flex-col items-center"
            style={{ padding: `${px(6)} ${px(10)} ${px(4)} ${px(10)}` }}
          >
            <div
              className="rounded-full bg-slate-300/80"
              style={{ width: px(30), height: px(4), marginBottom: px(5) }}
            />
            <div className="w-full flex items-center justify-center gap-1.5">
              {renderLogoBadge()}
              <div className="min-w-0 text-center">
                <div
                  className="font-black uppercase tracking-wide leading-tight truncate"
                  style={{ color: theme.textColor, fontSize: px(8.5) }}
                >
                  {companyName}
                </div>
                <div
                  className="font-bold uppercase tracking-[0.14em] leading-tight"
                  style={{ color: theme.accentColor, fontSize: px(6) }}
                >
                  CRACHÁ DE IDENTIFICAÇÃO
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex-1 flex flex-col items-center justify-between min-h-0"
          style={{ padding: `${px(4)} ${px(10)} ${px(4)} ${px(10)}` }}
        >
          <div
            className="rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0"
            style={{
              width: mm(19),
              height: mm(21.5),
              border: `1.5px solid ${theme.accentColor}`,
            }}
          >
            {hasPhoto ? (
              <img
                src={rawPhoto}
                alt={employee.name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500">
                <User className="text-slate-400 mb-0.5" style={{ width: px(20), height: px(20) }} />
                <span className="font-black tracking-wider" style={{ fontSize: px(8.5) }}>
                  {initials}
                </span>
              </div>
            )}
          </div>

          <div className="w-full text-center space-y-1 px-0.5">
            <div
              className="font-black uppercase leading-[1.15] line-clamp-2 break-words"
              style={{ color: theme.textColor, fontSize: px(10) }}
              title={employee.name}
            >
              {employee.name}
            </div>
            <div
              className="inline-block max-w-full rounded-full font-extrabold uppercase tracking-wide truncate border"
              style={{
                padding: `${px(2)} ${px(8)}`,
                fontSize: px(7.5),
                borderColor: theme.accentColor,
                color: theme.accentColor,
                backgroundColor: bodyIsLight ? '#ffffff' : 'rgba(255,255,255,0.9)',
              }}
            >
              {primaryRole}
            </div>
          </div>

          <div
            className="font-mono font-black tracking-widest"
            style={{ color: theme.textColor, fontSize: px(8.5) }}
          >
            REG: {registrationNumber}
          </div>

          <div className="w-full flex items-center justify-center bg-white rounded px-1 py-0.5 border border-slate-200/70">
            <div style={{ width: barcodeWidthMm }}>
              <Code128Barcode
                value={registrationNumber}
                height={barcodeHeight}
                showText={true}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {renderFooter()}
      </div>
    );
  }

  // =========================================================================
  // ESTILO 2: MODERNO AGRO
  // =========================================================================
  if (theme.style === 'modern_agro') {
    return (
      <div
        className="badge-pvc-card border border-slate-300 rounded-[3.5mm] overflow-hidden flex flex-col justify-between shadow-md select-none shrink-0"
        style={{
          width: `${dims.widthMm}mm`,
          height: `${dims.heightMm}mm`,
          boxSizing: 'border-box',
          backgroundColor: theme.bodyBgColor,
          color: theme.textColor,
        }}
      >
        <div
          className="shrink-0 relative"
          style={{
            padding: `${px(6)} ${px(10)} ${px(20)} ${px(10)}`,
            backgroundColor: theme.headerColor,
            borderBottom: `3px solid ${theme.accentColor}`,
          }}
        >
          <div
            className="rounded-full bg-white/35 mx-auto border border-white/20"
            style={{ width: px(30), height: px(4), marginBottom: px(5) }}
          />
          <div className="flex items-center gap-1.5">
            {renderLogoBadge()}
            <div className="min-w-0 flex-1">
              <div
                className="font-black uppercase tracking-wide leading-tight truncate"
                style={{ color: headerTextColor, fontSize: px(8.5) }}
              >
                {companyName}
              </div>
              <div
                className="font-bold uppercase tracking-[0.14em] leading-tight mt-0.5"
                style={{ color: headerSubColor, fontSize: px(6) }}
              >
                OPERACIONAL &amp; CAMPO
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex-1 flex flex-col items-center justify-between min-h-0 relative z-10"
          style={{
            padding: `0 ${px(10)} ${px(4)} ${px(10)}`,
            marginTop: `-${px(15)}`,
          }}
        >
          <div
            className="rounded-full bg-slate-100 overflow-hidden flex items-center justify-center shadow-sm shrink-0 ring-2 ring-white"
            style={{
              width: mm(21),
              height: mm(21),
              border: `2.5px solid ${theme.accentColor}`,
            }}
          >
            {hasPhoto ? (
              <img
                src={rawPhoto}
                alt={employee.name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 text-slate-600">
                <User className="text-slate-400" style={{ width: px(20), height: px(20) }} />
                <span className="font-black tracking-wider" style={{ fontSize: px(8.5) }}>
                  {initials}
                </span>
              </div>
            )}
          </div>

          <div className="w-full text-center px-0.5 mt-1">
            <div
              className="font-black uppercase leading-[1.15] line-clamp-2 break-words"
              style={{ color: theme.textColor, fontSize: px(10) }}
              title={employee.name}
            >
              {employee.name}
            </div>
          </div>

          <div
            className="w-full rounded-md flex items-center justify-between gap-1 shadow-2xs"
            style={{
              padding: `${px(4)} ${px(8)}`,
              backgroundColor: theme.accentColor,
              color: accentTextColor,
            }}
          >
            <span className="font-extrabold uppercase tracking-wide truncate" style={{ fontSize: px(7.5) }}>
              {primaryRole}
            </span>
            <span
              className="font-mono font-black tracking-wider shrink-0 bg-black/20 text-white rounded"
              style={{ fontSize: px(8), padding: `${px(1.5)} ${px(5)}` }}
            >
              {registrationNumber}
            </span>
          </div>

          <div className="w-full flex items-center justify-center bg-white rounded px-1 py-0.5">
            <div style={{ width: barcodeWidthMm }}>
              <Code128Barcode
                value={registrationNumber}
                height={barcodeHeight}
                showText={true}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {renderFooter()}
      </div>
    );
  }

  // =========================================================================
  // ESTILO 1 (PADRÃO): CLÁSSICO CORPORATIVO
  // =========================================================================
  return (
    <div
      className="badge-pvc-card border border-slate-300 rounded-[3.5mm] overflow-hidden flex flex-col justify-between shadow-md select-none shrink-0"
      style={{
        width: `${dims.widthMm}mm`,
        height: `${dims.heightMm}mm`,
        boxSizing: 'border-box',
        backgroundColor: theme.bodyBgColor,
        color: theme.textColor,
      }}
    >
      <div
        className="shrink-0"
        style={{
          padding: `${px(6)} ${px(10)} ${px(8)} ${px(10)}`,
          backgroundColor: theme.headerColor,
          borderBottom: `2.5px solid ${theme.accentColor}`,
        }}
      >
        <div
          className="rounded-full bg-white/30 mx-auto border border-white/20"
          style={{ width: px(30), height: px(4), marginBottom: px(5) }}
        />
        <div className="flex items-center gap-1.5">
          {renderLogoBadge()}
          <div className="min-w-0 flex-1">
            <div
              className="font-black uppercase tracking-wide leading-tight truncate"
              style={{ color: headerTextColor, fontSize: px(8.5) }}
            >
              {companyName}
            </div>
            <div
              className="font-bold uppercase tracking-[0.14em] leading-tight mt-0.5"
              style={{ color: headerSubColor, fontSize: px(6.5) }}
            >
              IDENTIFICAÇÃO FUNCIONAL
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex-1 flex flex-col items-center justify-between min-h-0"
        style={{ padding: `${px(7)} ${px(10)} ${px(4)} ${px(10)}` }}
      >
        <div
          className="rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shadow-2xs shrink-0"
          style={{
            width: mm(20),
            height: mm(22.5),
            border: `2px solid ${theme.accentColor}`,
          }}
        >
          {hasPhoto ? (
            <img
              src={rawPhoto}
              alt={employee.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 text-slate-600">
              <User className="text-slate-400 mb-0.5" style={{ width: px(22), height: px(22) }} />
              <span className="font-black tracking-wider" style={{ fontSize: px(9) }}>
                {initials}
              </span>
            </div>
          )}
        </div>

        <div className="w-full text-center space-y-1 px-0.5 mt-1">
          <div
            className="font-black uppercase leading-[1.15] line-clamp-2 break-words"
            style={{ color: theme.textColor, fontSize: px(10) }}
            title={employee.name}
          >
            {employee.name}
          </div>
          <div
            className="inline-block max-w-full rounded font-extrabold uppercase tracking-wide truncate"
            style={{
              padding: `${px(2)} ${px(8)}`,
              fontSize: px(7.5),
              backgroundColor: theme.accentColor,
              color: accentTextColor,
            }}
          >
            {primaryRole}
          </div>
        </div>

        <div className="w-full flex items-center justify-center mt-0.5">
          <span
            className="rounded font-mono font-black tracking-widest border"
            style={{
              padding: `${px(2)} ${px(8)}`,
              fontSize: px(8.5),
              borderColor: theme.accentColor,
              color: theme.textColor,
              backgroundColor: bodyIsLight ? '#f8fafc' : 'rgba(255,255,255,0.9)',
            }}
          >
            REG: {registrationNumber}
          </span>
        </div>

        <div className="w-full flex items-center justify-center bg-white rounded px-1 py-0.5">
          <div style={{ width: barcodeWidthMm }}>
            <Code128Barcode
              value={registrationNumber}
              height={barcodeHeight}
              showText={true}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {renderFooter()}
    </div>
  );
};
