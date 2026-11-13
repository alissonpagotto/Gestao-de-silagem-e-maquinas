import { CompanyProfile, Employee, Supplier } from '../../types';
import { formatDateBR } from '../../lib/storage';
import { getCachedMediaUrl } from '../../lib/imageStorage';
import { isBrokenAvatarUrl } from '../common/EmployeeAvatar';
import { getEmployeeBadgeNumber } from '../rh/badgeHelpers';
import { formatEmployeeFullAddress } from './employeePrintUtils';

export type AsoExamPurpose =
  | 'Admissional (Contratação)'
  | 'Periódico'
  | 'Mudança de Função'
  | 'Retorno ao Trabalho'
  | 'Demissional';

export const ASO_EXAM_PURPOSES: AsoExamPurpose[] = [
  'Admissional (Contratação)',
  'Periódico',
  'Mudança de Função',
  'Retorno ao Trabalho',
  'Demissional',
];

export interface AsoExamOption {
  id: string;
  label: string;
}

export const ASO_EXAM_OPTIONS: AsoExamOption[] = [
  { id: 'aso_clinico', label: 'Exame Clínico Ocupacional (ASO)' },
  { id: 'acuidade_visual', label: 'Acuidade Visual' },
  { id: 'audiometria', label: 'Audiometria Tonal e Vocal' },
  { id: 'toxicologico', label: 'Exame Toxicológico' },
  { id: 'ecg', label: 'Eletrocardiograma (ECG)' },
  { id: 'eeg', label: 'Eletroencefalograma (EEG)' },
  { id: 'hemograma_glicemia', label: 'Hemograma Completo / Glicemia' },
  { id: 'raio_x', label: 'Raio-X de Tórax / Coluna' },
];

export interface AsoClinicInfo {
  supplierId?: string;
  isManual: boolean;
  name: string;
  cnpj?: string;
  address?: string;
  phone?: string;
}

export interface AsoGuidePayload {
  purpose: AsoExamPurpose;
  clinic: AsoClinicInfo;
  scheduledDate?: string;
  scheduledTime?: string;
  selectedExamIds: string[];
  customNotes?: string;
  badgeNumber: string;
}

function escapeHtml(raw?: string | null): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatSupplierFullAddress(supplier: Partial<Supplier>): string {
  const parts = [
    supplier.address?.trim(),
    supplier.neighborhood?.trim() ? `Bairro ${supplier.neighborhood.trim()}` : '',
    supplier.city?.trim()
      ? `${supplier.city.trim()}${supplier.state?.trim() ? `/${supplier.state.trim().toUpperCase()}` : ''}`
      : supplier.state?.trim()?.toUpperCase() || '',
    supplier.zipCode?.trim() ? `CEP: ${supplier.zipCode.trim()}` : '',
  ].filter(Boolean);
  return parts.join(' • ');
}

export function isDriverOrOperatorRole(employee: Partial<Employee>): boolean {
  const combinedRoles = [
    employee.role || '',
    ...(Array.isArray(employee.roles) ? employee.roles : []),
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return combinedRoles.includes('motorista') || combinedRoles.includes('operador');
}

export function getDefaultSelectedAsoExams(employee: Partial<Employee>): string[] {
  const defaults = ['aso_clinico'];
  if (isDriverOrOperatorRole(employee)) {
    defaults.push('toxicologico');
  }
  return defaults;
}

export function generateAsoGuideHtml(
  employee: Partial<Employee>,
  company: CompanyProfile | null | undefined,
  payload: AsoGuidePayload
): string {
  const badgeNumber = payload.badgeNumber || getEmployeeBadgeNumber(employee, 1);
  const rawPhoto = employee.avatar_url || employee.foto || employee.foto_url || employee.photoUrl;
  const resolvedPhoto = getCachedMediaUrl(rawPhoto);
  const hasValidPhoto = Boolean(resolvedPhoto && !isBrokenAvatarUrl(resolvedPhoto));

  const photoBlock = hasValidPhoto
    ? `<div style="width: 102px; height: 128px; border: 1.5px solid #334155; border-radius: 6px; overflow: hidden; margin: 0 auto; background: #fff;">
        <img src="${resolvedPhoto}" alt="Foto do Colaborador" onerror="this.parentElement.style.display='none'" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>`
    : `<div style="width: 102px; height: 128px; border: 1.5px dashed #94a3b8; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; margin: 0 auto; color: #64748b; font-size: 8pt; font-weight: bold;">
        <span style="font-size: 16pt; margin-bottom: 3px;">👤</span>
        <span>FOTO 3x4</span>
        <span style="font-size: 6.5pt; font-weight: normal; margin-top: 2px;">Identificação</span>
      </div>`;

  const selectedExams = ASO_EXAM_OPTIONS.filter((opt) =>
    payload.selectedExamIds.includes(opt.id)
  );

  const scheduleText = (() => {
    const dateStr = payload.scheduledDate ? formatDateBR(payload.scheduledDate) : '';
    const timeStr = payload.scheduledTime?.trim() || '';
    if (dateStr && timeStr) return `${dateStr} às ${timeStr}`;
    if (dateStr) return `${dateStr} (Horário comercial / Ordem de chegada)`;
    if (timeStr) return `Às ${timeStr}`;
    return 'Atendimento conforme agenda / Ordem de chegada';
  })();

  const companyDisplayName =
    company?.corporateName || company?.tradeName || company?.name || 'EMPRESA CONTRATANTE';
  const companyTrade = company?.tradeName || companyDisplayName;
  const companyCnpj = company?.cnpjCpf || company?.cnpj || 'Não informado';
  const roleText =
    Array.isArray(employee.roles) && employee.roles.length > 0
      ? employee.roles.join(', ')
      : employee.role || 'Não informado';

  const rgValue = employee.rg || employee.numero_rg || 'Não informado';
  const birthValue = employee.birthDate || employee.data_nascimento;

  const clinicName = payload.clinic.name?.trim() || 'Clínica / Laboratório Autorizado';
  const clinicCnpj = payload.clinic.cnpj?.trim() || 'Não informado';
  const clinicAddress = payload.clinic.address?.trim() || 'Não informado';
  const clinicPhone = payload.clinic.phone?.trim() || 'Não informado';

  const customNotes = payload.customNotes?.trim() || '';

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 9pt; line-height: 1.4;">

      <!-- FAIXA DE FINALIDADE & PROTOCOLO -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #eff6ff; border: 1.5px solid #0963cb; border-radius: 6px; padding: 7px 12px; margin-bottom: 12px;">
        <div>
          <span style="font-size: 7.5pt; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.4px;">Finalidade do Encaminhamento:</span>
          <div style="font-size: 11pt; font-weight: 900; color: #0963cb; text-transform: uppercase;">${escapeHtml(payload.purpose)}</div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase;">Registro / Crachá do Colaborador</span>
          <div style="display: inline-block; margin-top: 2px; background: #0f172a; color: #ffffff; font-family: monospace; font-size: 11pt; font-weight: 900; padding: 2px 10px; border-radius: 4px; letter-spacing: 1px;">
            REG: ${escapeHtml(badgeNumber)}
          </div>
        </div>
      </div>

      <!-- QUADRO 1: CLÍNICA / LABORATÓRIO CONVENIADO -->
      <div style="background: #0f766e; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 4px 4px 0 0; letter-spacing: 0.5px;">
        1. Clínica / Laboratório Autorizado para Realização dos Exames
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 8.5pt;">
        <tbody>
          <tr>
            <td style="width: 22%; background: #f8fafc; font-weight: bold; color: #334155; padding: 6px 8px; border: 1px solid #cbd5e1;">Clínica / Razão Social:</td>
            <td colspan="3" style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9.5pt; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              ${escapeHtml(clinicName)}
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 6px 8px; border: 1px solid #cbd5e1;">CNPJ da Clínica:</td>
            <td style="width: 28%; padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700;">
              ${escapeHtml(clinicCnpj)}
            </td>
            <td style="width: 20%; background: #f8fafc; font-weight: bold; color: #334155; padding: 6px 8px; border: 1px solid #cbd5e1;">Telefone / Contato:</td>
            <td style="width: 30%; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">
              ${escapeHtml(clinicPhone)}
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 6px 8px; border: 1px solid #cbd5e1;">Endereço Completo:</td>
            <td colspan="3" style="padding: 6px 8px; border: 1px solid #cbd5e1;">
              ${escapeHtml(clinicAddress)}
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 6px 8px; border: 1px solid #cbd5e1;">Data / Hora Agendada:</td>
            <td colspan="3" style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 800; color: #047857;">
              ${escapeHtml(scheduleText)}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- QUADRO 2: IDENTIFICAÇÃO DO COLABORADOR -->
      <div style="background: #0f766e; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 4px 4px 0 0; letter-spacing: 0.5px;">
        2. Identificação do Colaborador Encaminhado
      </div>
      <div style="display: flex; gap: 12px; border: 1px solid #cbd5e1; border-top: none; padding: 10px; margin-bottom: 12px; background: #ffffff; align-items: stretch;">
        <div style="width: 112px; flex-shrink: 0; text-align: center; display: flex; flex-direction: column; justify-content: center;">
          ${photoBlock}
          <div style="margin-top: 5px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 4px; font-size: 7.5pt; font-weight: 800; font-family: monospace; color: #0f172a;">
            CRACHÁ Nº ${escapeHtml(badgeNumber)}
          </div>
        </div>

        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 8.5pt;">
            <tbody>
              <tr>
                <td style="width: 24%; background: #f8fafc; font-weight: bold; color: #334155; padding: 5px 8px; border: 1px solid #cbd5e1;">Nome Completo:</td>
                <td colspan="3" style="padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 10pt; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                  ${escapeHtml(employee.name || '—')}
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 5px 8px; border: 1px solid #cbd5e1;">CPF:</td>
                <td style="width: 26%; padding: 5px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 700;">
                  ${escapeHtml(employee.cpf || 'Não informado')}
                </td>
                <td style="width: 20%; background: #f8fafc; font-weight: bold; color: #334155; padding: 5px 8px; border: 1px solid #cbd5e1;">RG (Identidade):</td>
                <td style="width: 30%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 700;">
                  ${escapeHtml(rgValue)}
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 5px 8px; border: 1px solid #cbd5e1;">Data Nascimento:</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 600;">
                  ${birthValue ? escapeHtml(formatDateBR(birthValue)) : 'Não informada'}
                </td>
                <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 5px 8px; border: 1px solid #cbd5e1;">Nº Registro / Crachá:</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 900; color: #0963cb; font-size: 9.5pt;">
                  ${escapeHtml(badgeNumber)}
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 5px 8px; border: 1px solid #cbd5e1;">Cargo / Função:</td>
                <td colspan="3" style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 800; color: #047857; text-transform: uppercase;">
                  ${escapeHtml(roleText)}
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 5px 8px; border: 1px solid #cbd5e1;">Endereço Residencial:</td>
                <td colspan="3" style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 600;">
                  ${escapeHtml(formatEmployeeFullAddress(employee))}
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #334155; padding: 5px 8px; border: 1px solid #cbd5e1;">Finalidade do Exame:</td>
                <td colspan="3" style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 800; color: #1e40af; text-transform: uppercase;">
                  ${escapeHtml(payload.purpose)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- QUADRO 3: RELAÇÃO DE EXAMES AUTORIZADOS -->
      <div style="background: #0f766e; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 4px 4px 0 0; letter-spacing: 0.5px;">
        3. Relação de Exames Médicos e Complementares Autorizados
      </div>
      <div style="border: 1px solid #cbd5e1; border-top: none; padding: 10px 12px; margin-bottom: 12px; background: #ffffff;">
        ${
          selectedExams.length > 0
            ? `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px;">
                ${selectedExams
                  .map(
                    (exam) => `
                  <div style="display: flex; align-items: center; gap: 8px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; font-size: 8.5pt; font-weight: 700; color: #0f172a;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 3px; background: #047857; color: #ffffff; font-size: 9pt; font-weight: 900; flex-shrink: 0;">✓</span>
                    <span>${escapeHtml(exam.label)}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>`
            : `<p style="margin: 0; font-size: 8.5pt; color: #475569; font-style: italic;">Consultar observações específicas abaixo.</p>`
        }
        ${
          customNotes
            ? `<div style="margin-top: 8px; padding: 7px 10px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; font-size: 8.5pt; color: #78350f;">
                <strong>Outros Exames / Observações Específicas:</strong> ${escapeHtml(customNotes)}
              </div>`
            : ''
        }
      </div>

      <!-- QUADRO 4: TEXTO FORMAL DE AUTORIZAÇÃO PARA FATURAMENTO -->
      <div style="border: 1.5px solid #334155; border-radius: 6px; padding: 10px 12px; background: #f8fafc; font-size: 8.5pt; color: #1e293b; text-align: justify; line-height: 1.45;">
        <div style="font-weight: 800; color: #0f172a; text-transform: uppercase; font-size: 8.5pt; margin-bottom: 4px;">
          Autorização Formal de Atendimento e Faturamento (RH)
        </div>
        Autorizamos a clínica / laboratório <strong>${escapeHtml(clinicName)}</strong> a realizar exclusivamente os exames ocupacionais listados nesta guia no colaborador identificado acima (Registro / Crachá <strong>${escapeHtml(badgeNumber)}</strong>), na modalidade <strong>${escapeHtml(payload.purpose)}</strong>, com faturamento direto em nome da empresa contratante <strong>${escapeHtml(companyDisplayName)}</strong> (${escapeHtml(companyTrade)}), inscrita no CNPJ sob nº <strong>${escapeHtml(companyCnpj)}</strong>. Solicitamos a emissão do respectivo Atestado de Saúde Ocupacional (ASO) em duas vias (empresa e colaborador) após a conclusão clínica.
      </div>

    </div>
  `;
}

export function generateAsoGuideWhatsAppText(
  employee: Partial<Employee>,
  company: CompanyProfile | null | undefined,
  payload: AsoGuidePayload
): string {
  const companyName = (company?.tradeName || company?.corporateName || 'AGROCONTROL').toUpperCase();
  const badgeNumber = payload.badgeNumber || getEmployeeBadgeNumber(employee, 1);
  const selectedLabels = ASO_EXAM_OPTIONS.filter((opt) =>
    payload.selectedExamIds.includes(opt.id)
  ).map((o) => `• ${o.label}`);

  const employeeAddress = formatEmployeeFullAddress(employee);
  const lines: string[] = [
    `🏥 *${companyName}*`,
    `📋 *GUIA DE ENCAMINHAMENTO E AUTORIZAÇÃO DE EXAMES (ASO)*`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📌 *Finalidade:* ${payload.purpose}`,
    `👤 *Colaborador:* ${employee.name || 'Não informado'}`,
    `🪪 *Reg. Crachá:* ${badgeNumber}`,
    employee.cpf ? `📄 *CPF:* ${employee.cpf}` : '',
    `💼 *Cargo / Função:* ${employee.role || 'Não informado'}`,
    employeeAddress !== 'Não informado' ? `🏠 *Endereço:* ${employeeAddress}` : '',
    ``,
    `🏨 *Clínica / Laboratório:* ${payload.clinic.name}`,
    payload.clinic.cnpj ? `• CNPJ: ${payload.clinic.cnpj}` : '',
    payload.clinic.address ? `• Endereço: ${payload.clinic.address}` : '',
    payload.clinic.phone ? `• Telefone: ${payload.clinic.phone}` : '',
    payload.scheduledDate
      ? `📅 *Agendamento:* ${formatDateBR(payload.scheduledDate)}${payload.scheduledTime ? ` às ${payload.scheduledTime}` : ''}`
      : '',
    ``,
    `🩺 *Exames Autorizados:*`,
    ...selectedLabels,
    payload.customNotes?.trim() ? `📝 *Observações:* ${payload.customNotes.trim()}` : '',
    ``,
    `_Documento emitido eletronicamente via AgroControl / Silagem Fácil_`,
  ].filter((l) => l !== '');

  return lines.join('\n');
}
