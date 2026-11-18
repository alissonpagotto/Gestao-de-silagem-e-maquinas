import React from 'react';
import { CompanyProfile, Employee } from '../../types';
import {
  resolveBadgeCompanyBackInfo,
  resolveEmployeeEmergencyContact,
} from './badgeHelpers';
import {
  BadgeThemeConfig,
  DEFAULT_BADGE_THEME,
  getBadgeDimensions,
  isLightHexColor,
} from './badgeTheme';

interface EmployeeBadgeBackCardProps {
  employee?: Partial<Employee>;
  companyName: string;
  companyProfile?: CompanyProfile;
  theme?: BadgeThemeConfig;
}

export const EmployeeBadgeBackCard: React.FC<EmployeeBadgeBackCardProps> = ({
  employee,
  companyName,
  companyProfile,
  theme = DEFAULT_BADGE_THEME,
}) => {
  const dims = getBadgeDimensions(theme.size);
  const s = dims.scaleFactor;

  const px = (base: number) => `${(base * s).toFixed(1)}px`;

  const headerIsLight = isLightHexColor(theme.headerColor);
  const headerTextColor = headerIsLight ? '#0f172a' : '#ffffff';
  const headerSubColor = headerIsLight ? '#334155' : 'rgba(255,255,255,0.82)';

  const bodyIsLight = isLightHexColor(theme.bodyBgColor);
  const noticeBg = bodyIsLight ? 'rgba(15, 23, 42, 0.035)' : 'rgba(255, 255, 255, 0.09)';
  const noticeBorder = bodyIsLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.22)';
  const footerBg = bodyIsLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.1)';
  const footerBorder = bodyIsLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.2)';

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

  const showEmergency = Boolean(theme.showBackEmergencyContact && emergencyContact);

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
      {/* Faixa Superior Fina harmonizada com a Frente */}
      <div
        className="shrink-0"
        style={{
          padding: `${px(4)} ${px(8)} ${px(4.5)} ${px(8)}`,
          backgroundColor: theme.headerColor,
          borderBottom: `2px solid ${theme.accentColor}`,
        }}
      >
        <div
          className="rounded-full bg-white/30 mx-auto border border-white/20"
          style={{ width: px(28), height: px(3), marginBottom: px(2.5) }}
        />
        <div className="text-center min-w-0">
          <div
            className="font-black uppercase tracking-wide leading-tight truncate"
            style={{ color: headerTextColor, fontSize: px(8.5) }}
          >
            {companyName}
          </div>
          <div
            className="font-bold uppercase tracking-[0.14em] leading-tight truncate"
            style={{ color: headerSubColor, fontSize: px(6), marginTop: px(1) }}
          >
            Verso • Identificação Funcional
          </div>
        </div>
      </div>

      {/* Corpo do Verso */}
      <div
        className="flex-1 flex flex-col justify-evenly min-h-0 overflow-hidden"
        style={{ padding: `${px(5)} ${px(7.5)} ${px(4.5)} ${px(7.5)}`, gap: px(5) }}
      >
        {/* Aviso / Termo de Responsabilidade */}
        {noticeText && (
          <div
            className="rounded"
            style={{
              backgroundColor: noticeBg,
              border: `1px solid ${noticeBorder}`,
              padding: `${px(3.5)} ${px(5)}`,
            }}
          >
            <div
              className="font-black uppercase tracking-wider"
              style={{
                color: theme.accentColor,
                fontSize: px(7),
                marginBottom: px(1.5),
              }}
            >
              Aviso / Termo de Responsabilidade
            </div>
            <p
              className="font-medium leading-snug break-words"
              style={{
                color: theme.textColor,
                fontSize: px(9.5),
                lineHeight: 1.22,
                textAlign: 'justify',
                margin: 0,
              }}
            >
              {noticeText}
            </p>
          </div>
        )}

        {/* Dados Institucionais da Empresa */}
        {companyRows.length > 0 && (
          <div
            className="flex flex-col min-h-0"
            style={{ gap: px(4) }}
          >
            {companyRows.map((row) => (
              <div
                key={row.label}
                className="leading-snug break-words"
                style={{ fontSize: px(9.8), lineHeight: 1.22, margin: 0 }}
              >
                <span
                  className="font-black uppercase"
                  style={{ color: theme.accentColor, fontSize: px(8) }}
                >
                  {row.label}:{' '}
                </span>
                <span className="font-bold" style={{ color: theme.textColor }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Contato de Emergência do Colaborador */}
        {showEmergency && (
          <div
            className="rounded-sm shrink-0"
            style={{
              borderLeft: `2.5px solid ${theme.accentColor}`,
              backgroundColor: noticeBg,
              padding: `${px(3)} ${px(5)}`,
            }}
          >
            <div
              className="font-black uppercase tracking-wide"
              style={{ color: theme.accentColor, fontSize: px(7.2) }}
            >
              Contato de Emergência
            </div>
            <div
              className="font-extrabold leading-snug break-words"
              style={{ color: theme.textColor, fontSize: px(10), lineHeight: 1.2 }}
            >
              {emergencyContact}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé com Assinatura do Portador */}
      {theme.showBackSignatureLine ? (
        <div
          className="shrink-0"
          style={{
            padding: `${px(10.5)} ${px(10)} ${px(3)} ${px(10)}`,
            backgroundColor: footerBg,
            borderTop: `1px solid ${footerBorder}`,
          }}
        >
          <div
            style={{
              borderTop: `1px solid ${theme.textColor}`,
              opacity: 0.72,
              marginBottom: px(1.5),
            }}
          />
          <div
            className="text-center font-bold uppercase tracking-wider"
            style={{ color: theme.textColor, fontSize: px(6.8) }}
          >
            Assinatura do Portador
          </div>
        </div>
      ) : (
        <div
          className="shrink-0"
          style={{
            height: px(4),
            backgroundColor: theme.accentColor,
          }}
        />
      )}
    </div>
  );
};
