import { CompanyProfile, Employee } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { getCachedMediaUrl } from '../../lib/imageStorage';
import { getEmployeeBadgeNumber } from '../rh/badgeHelpers';

export type EmployeePrintScope = 'active' | 'all' | 'vacation_alerts';

export type EmployeePrintColumnKey =
  | 'name'
  | 'photo'
  | 'badge'
  | 'cpf'
  | 'rg'
  | 'phone'
  | 'role'
  | 'contractType'
  | 'admissionDate'
  | 'baseSalary'
  | 'commission'
  | 'cnh'
  | 'vacationStatus'
  | 'signatureLine';

export interface EmployeePrintColumnDef {
  key: EmployeePrintColumnKey;
  label: string;
  shortLabel: string;
  defaultChecked: boolean;
  fixed?: boolean;
  align?: 'left' | 'center' | 'right';
}

export const EMPLOYEE_PRINT_COLUMNS: EmployeePrintColumnDef[] = [
  { key: 'name', label: 'Nome Completo', shortLabel: 'Nome Completo', defaultChecked: true, fixed: true },
  { key: 'photo', label: 'Foto do Colaborador', shortLabel: 'Foto', defaultChecked: false, align: 'center' },
  { key: 'badge', label: 'Número do Registro / Crachá', shortLabel: 'Reg. / Crachá', defaultChecked: true, align: 'center' },
  { key: 'cpf', label: 'CPF', shortLabel: 'CPF', defaultChecked: true },
  { key: 'rg', label: 'RG / Documento', shortLabel: 'RG / Documento', defaultChecked: false },
  { key: 'phone', label: 'Telefone / Contato', shortLabel: 'Telefone / Contato', defaultChecked: true },
  { key: 'role', label: 'Cargo / Função', shortLabel: 'Cargo / Função', defaultChecked: true },
  { key: 'contractType', label: 'Regime de Contratação (CLT / Temporário)', shortLabel: 'Regime', defaultChecked: false },
  { key: 'admissionDate', label: 'Data de Admissão', shortLabel: 'Admissão', defaultChecked: true, align: 'center' },
  { key: 'baseSalary', label: 'Salário Base (R$)', shortLabel: 'Salário Base (R$)', defaultChecked: false, align: 'right' },
  { key: 'commission', label: 'Comissão / Valores por Hora', shortLabel: 'Comissão', defaultChecked: false },
  { key: 'cnh', label: 'CNH (Categoria e Validade)', shortLabel: 'CNH / Validade', defaultChecked: false },
  { key: 'vacationStatus', label: 'Status de Férias', shortLabel: 'Status de Férias', defaultChecked: false },
  { key: 'signatureLine', label: 'Linha em Branco para Assinatura', shortLabel: 'Assinatura', defaultChecked: false, align: 'center' },
];

export const DEFAULT_SELECTED_PRINT_COLUMNS: EmployeePrintColumnKey[] = EMPLOYEE_PRINT_COLUMNS
  .filter((col) => col.defaultChecked)
  .map((col) => col.key);

export function isEmployeeActiveRecord(emp: Partial<Employee> | null | undefined): boolean {
  if (!emp) return false;
  const st = String(emp.status || '').toLowerCase().trim();
  const isInactiveStatus =
    st === 'inativo' ||
    st === 'inativo_sazonal' ||
    st === 'inativo (sazonal)' ||
    st === 'fora_periodo' ||
    st === 'fora de período' ||
    st === 'demitido' ||
    st === 'desligado' ||
    st === 'excluido';
  return emp.active !== false && !isInactiveStatus && !emp.terminationDate;
}

function escapeHtml(raw?: string | null): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmployeeInitials(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'CO';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function formatCommissionSummary(emp: Employee): string {
  if (emp.brokerCommissionValue !== undefined && Number(emp.brokerCommissionValue) > 0) {
    if (emp.brokerCommissionType === 'Valor Fixo por contrato/pedido') {
      return `Agenciador: ${formatCurrencyBRL(Number(emp.brokerCommissionValue))} /pedido`;
    }
    return `Agenciador: ${Number(emp.brokerCommissionValue).toFixed(2).replace('.', ',')}%`;
  }

  const parts: string[] = [];
  const perHour = Number(emp.commissionPerHour || (emp as any).comissao_hora || 0);
  const perAlq = Number(emp.commissionPerAlqueire || (emp as any).comissao_alqueire || 0);
  const perHa = Number(emp.commissionPerHectare || (emp as any).comissao_hectare || 0);
  const pct = Number(emp.commissionPercentage || (emp as any).comissao_porcentagem || 0);

  if (emp.receivesCommission || perHour > 0 || perAlq > 0 || perHa > 0 || pct > 0) {
    if (perHour > 0) parts.push(`${formatCurrencyBRL(perHour)}/h`);
    if (perAlq > 0) parts.push(`${formatCurrencyBRL(perAlq)}/alq`);
    if (perHa > 0) parts.push(`${formatCurrencyBRL(perHa)}/ha`);
    if (pct > 0) parts.push(`${pct.toFixed(2).replace('.', ',')}%`);
  }

  return parts.length > 0 ? parts.join(' • ') : '—';
}

function formatCnhCell(emp: Employee): string {
  const cat = emp.cnhCategory ? `Cat. ${emp.cnhCategory}` : '';
  const exp = emp.cnhExpiration ? formatDateBR(emp.cnhExpiration) : '';
  if (!emp.cnhNumber && !exp) return '—';

  if (exp) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expDate = new Date(`${String(emp.cnhExpiration).split('T')[0]}T12:00:00`);
    const in60Days = new Date(now);
    in60Days.setDate(in60Days.getDate() + 60);

    if (!isNaN(expDate.getTime()) && expDate < now) {
      return `<span style="color:#b91c1c;font-weight:700;">${escapeHtml(cat || 'CNH')} • Vencida (${escapeHtml(exp)})</span>`;
    }
    if (!isNaN(expDate.getTime()) && expDate <= in60Days) {
      return `<span style="color:#b45309;font-weight:700;">${escapeHtml(cat || 'CNH')} • Vence ${escapeHtml(exp)}</span>`;
    }
    return `<span style="color:#15803d;font-weight:700;">${escapeHtml(cat || 'CNH')} • Val. ${escapeHtml(exp)}</span>`;
  }

  return escapeHtml(cat || emp.cnhNumber || '—');
}

export interface GenerateEmployeeListPrintHtmlParams {
  company: CompanyProfile;
  employees: Employee[];
  badgeSequenceSource?: Employee[];
  selectedColumns: EmployeePrintColumnKey[];
  scope: EmployeePrintScope;
  getVacationStatusLabel: (emp: Employee) => {
    text: string;
    level: 'expired' | 'warning' | 'none';
  };
  resolvedLogoUrl?: string;
  resolvedPhotosByKey?: Record<string, string>;
}

export function getEmployeePrintPhotoKey(emp: Employee, index: number): string {
  return emp?.id ? String(emp.id) : `row_${index}_${String(emp?.name || '').trim()}`;
}

export function generateEmployeeListPrintHtml({
  company,
  employees,
  badgeSequenceSource = [],
  selectedColumns,
  scope,
  getVacationStatusLabel,
  resolvedLogoUrl,
  resolvedPhotosByKey = {},
}: GenerateEmployeeListPrintHtmlParams): string {
  const filteredColumns = EMPLOYEE_PRINT_COLUMNS.filter(
    (col) => col.key === 'name' || selectedColumns.includes(col.key)
  );
  // Quando "Foto do Colaborador" está marcada, posiciona a coluna estreita à esquerda (antes de Nome Completo)
  const photoCol = filteredColumns.find((col) => col.key === 'photo');
  const activeColumns = photoCol
    ? [photoCol, ...filteredColumns.filter((col) => col.key !== 'photo')]
    : filteredColumns;
  const orientation: 'portrait' | 'landscape' =
    activeColumns.length > 7 ? 'landscape' : 'portrait';

  const scopeLabel =
    scope === 'active'
      ? 'Apenas Colaboradores Ativos'
      : scope === 'vacation_alerts'
      ? 'Apenas com Férias Vencidas / A Vencer'
      : 'Todos (Ativos + Ex-Colaboradores)';

  const now = new Date();
  const dateFormatted = formatDateBR(now.toISOString().split('T')[0]);
  const timeFormatted = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const logoSrc = resolvedLogoUrl || getCachedMediaUrl(company?.logoUrl) || '';
  const tradeName = company?.tradeName || company?.corporateName || 'AgroControl';
  const corporateName = company?.corporateName || '';
  const cnpj = company?.cnpjCpf || company?.cnpj || '';
  const phone = company?.phone || '';
  const fullAddress = [
    company?.address,
    company?.number ? `nº ${company.number}` : '',
    company?.neighborhood ? `- ${company.neighborhood}` : '',
    company?.city ? `${company.city}` : '',
    company?.state ? `/${company.state}` : '',
    company?.zipCode ? `- CEP: ${company.zipCode}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const includeSalary = activeColumns.some((col) => col.key === 'baseSalary');
  const salaryColumnIdx = activeColumns.findIndex((col) => col.key === 'baseSalary');
  const totalBaseSalary = employees.reduce((acc, emp) => {
    const val = Number(emp.baseSalary ?? emp.salary ?? 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const badgeIndexMap = new Map<string, number>();
  badgeSequenceSource.forEach((item, idx) => {
    if (item?.id) badgeIndexMap.set(item.id, idx + 1);
  });

  const headerCellsHtml = `
    <th style="width: 30px; text-align: center;">#</th>
    ${activeColumns
      .map(
        (col) => `
      <th style="text-align: ${col.align || 'left'};${
          col.key === 'signatureLine'
            ? ' min-width: 145px;'
            : col.key === 'photo'
            ? ' width: 46px;'
            : ''
        }">${escapeHtml(col.shortLabel)}</th>
    `
      )
      .join('')}
  `;

  const bodyRowsHtml =
    employees.length === 0
      ? `<tr>
          <td colspan="${activeColumns.length + 1}" style="text-align: center; padding: 20px; color: #64748b; font-weight: bold;">
            Nenhum colaborador encontrado para o filtro selecionado.
          </td>
        </tr>`
      : employees
          .map((emp, rowIdx) => {
            const isActive = isEmployeeActiveRecord(emp);
            const seqIdx =
              (emp.id && badgeIndexMap.get(emp.id)) || rowIdx + 1;
            const badgeNumber = getEmployeeBadgeNumber(emp, seqIdx);
            const salaryVal = Number(emp.baseSalary ?? emp.salary ?? 0);
            const vacInfo = getVacationStatusLabel(emp);

            const cellsHtml = activeColumns
              .map((col) => {
                switch (col.key) {
                  case 'photo': {
                    const photoKey = getEmployeePrintPhotoKey(emp, rowIdx);
                    const photoSrc = resolvedPhotosByKey[photoKey];
                    const initials = getEmployeeInitials(emp.name);
                    if (photoSrc) {
                      return `<td style="width: 46px; padding: 4px; text-align: center;">
                        <img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(emp.name || 'Foto')}" style="width: 34px; height: 34px; border-radius: 6px; object-fit: cover; border: 1px solid #cbd5e1; display: block; margin: 0 auto;" />
                      </td>`;
                    }
                    return `<td style="width: 46px; padding: 4px; text-align: center;">
                      <div style="width: 34px; height: 34px; border-radius: 6px; background: #e2e8f0; border: 1px solid #cbd5e1; color: #334155; font-size: 9pt; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto; letter-spacing: 0.4px;">${escapeHtml(initials)}</div>
                    </td>`;
                  }
                  case 'name': {
                    const statusBadge =
                      scope === 'all'
                        ? isActive
                          ? ' <span style="display:inline-block;margin-left:4px;font-size:6.5pt;font-weight:800;padding:1px 4px;border-radius:3px;background:#dcfce7;color:#166534;border:1px solid #86efac;">ATIVO</span>'
                          : ' <span style="display:inline-block;margin-left:4px;font-size:6.5pt;font-weight:800;padding:1px 4px;border-radius:3px;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;">EX-COLAB.</span>'
                        : '';
                    return `<td style="font-weight: 800; color: #0f172a; text-transform: uppercase;">${escapeHtml(
                      emp.name || '—'
                    )}${statusBadge}</td>`;
                  }
                  case 'badge':
                    return `<td style="text-align: center; font-family: monospace; font-weight: 800; color: #0f172a;">${escapeHtml(
                      badgeNumber
                    )}</td>`;
                  case 'cpf':
                    return `<td style="font-family: monospace; white-space: nowrap;">${escapeHtml(
                      emp.cpf || '—'
                    )}</td>`;
                  case 'rg':
                    return `<td style="white-space: nowrap;">${escapeHtml(
                      emp.rg || emp.numero_rg || '—'
                    )}</td>`;
                  case 'phone':
                    return `<td style="white-space: nowrap;">${escapeHtml(
                      emp.phone || '—'
                    )}</td>`;
                  case 'role': {
                    const roleText =
                      Array.isArray(emp.roles) && emp.roles.length > 0
                        ? emp.roles.join(', ')
                        : emp.role || '—';
                    return `<td style="font-weight: 600;">${escapeHtml(roleText)}</td>`;
                  }
                  case 'contractType':
                    return `<td>${escapeHtml(
                      emp.contractType || emp.regime_contratacao || 'Registrado (CLT)'
                    )}</td>`;
                  case 'admissionDate':
                    return `<td style="text-align: center; white-space: nowrap;">${
                      emp.admissionDate ? escapeHtml(formatDateBR(emp.admissionDate)) : '—'
                    }</td>`;
                  case 'baseSalary':
                    return `<td style="text-align: right; font-weight: 700; white-space: nowrap;">${escapeHtml(
                      formatCurrencyBRL(isNaN(salaryVal) ? 0 : salaryVal)
                    )}</td>`;
                  case 'commission':
                    return `<td>${escapeHtml(formatCommissionSummary(emp))}</td>`;
                  case 'cnh':
                    return `<td>${formatCnhCell(emp)}</td>`;
                  case 'vacationStatus': {
                    const color =
                      vacInfo.level === 'expired'
                        ? '#b91c1c'
                        : vacInfo.level === 'warning'
                        ? '#b45309'
                        : '#15803d';
                    return `<td style="font-weight: 700; color: ${color};">${escapeHtml(
                      vacInfo.text
                    )}</td>`;
                  }
                  case 'signatureLine':
                    return `<td style="padding: 12px 8px 4px 8px; text-align: center;">
                      <div style="border-bottom: 1px solid #334155; width: 100%; min-width: 130px; height: 12px;"></div>
                    </td>`;
                  default:
                    return '<td>—</td>';
                }
              })
              .join('');

            return `
              <tr>
                <td style="text-align: center; font-weight: 700; color: #475569;">${rowIdx + 1}</td>
                ${cellsHtml}
              </tr>
            `;
          })
          .join('');

  // Rodapé com Total Geral de Salários alinhado na coluna Salário Base (quando marcada)
  const salaryFooterHtml = includeSalary
    ? (() => {
        const beforeColSpan = 1 + salaryColumnIdx; // coluna # + colunas anteriores ao Salário Base
        const afterCount = activeColumns.length - salaryColumnIdx - 1;
        return `
          <tfoot>
            <tr class="total-row">
              <td colspan="${beforeColSpan}" style="text-align: right; font-weight: 800; text-transform: uppercase; color: #0f172a;">
                Total Geral de Salários (${employees.length} ${employees.length === 1 ? 'colaborador' : 'colaboradores'}):
              </td>
              <td style="text-align: right; font-weight: 900; color: #047857; white-space: nowrap;">
                ${escapeHtml(formatCurrencyBRL(totalBaseSalary))}
              </td>
              ${
                afterCount > 0
                  ? `<td colspan="${afterCount}" style="font-size: 7.5pt; color: #64748b;"></td>`
                  : ''
              }
            </tr>
          </tfoot>
        `;
      })()
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relação de Colaboradores - ${escapeHtml(tradeName)}</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: ${orientation === 'landscape' ? '8.2pt' : '8.8pt'};
      line-height: 1.35;
    }
    .sheet {
      width: 100%;
      margin: 0 auto;
    }
    .report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 2.5px solid #0963cb;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .logo-box {
      width: 72px;
      height: 72px;
      min-width: 72px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #ffffff;
      padding: 4px;
    }
    .logo-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .company-block {
      flex: 1;
      min-width: 0;
    }
    .company-trade {
      margin: 0;
      font-size: 14pt;
      font-weight: 900;
      color: #0963cb;
      text-transform: uppercase;
      letter-spacing: -0.2px;
    }
    .company-corporate {
      margin: 1px 0 3px 0;
      font-size: 8.5pt;
      font-weight: 600;
      color: #475569;
    }
    .company-meta {
      font-size: 8pt;
      color: #334155;
      line-height: 1.3;
    }
    .report-meta {
      text-align: right;
      shrink: 0;
    }
    .report-badge {
      display: inline-block;
      background: #0963cb;
      color: #ffffff;
      font-size: 9pt;
      font-weight: 900;
      padding: 4px 10px;
      border-radius: 5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .report-meta-lines {
      margin-top: 5px;
      font-size: 8pt;
      color: #334155;
      line-height: 1.4;
    }
    .summary-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 8.5pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${orientation === 'landscape' ? '7.8pt' : '8.2pt'};
    }
    thead {
      display: table-header-group;
    }
    th {
      background: #0f766e;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 7.3pt;
      letter-spacing: 0.3px;
      padding: 6px 6px;
      border: 1px solid #0d9488;
    }
    td {
      padding: 5px 6px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    tbody tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    tfoot tr.total-row td {
      background: #ecfdf5;
      border-top: 2px solid #047857;
      padding: 7px 6px;
      font-size: 8.5pt;
    }
    .print-footer {
      margin-top: 12px;
      padding-top: 6px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #64748b;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="report-header">
      <div class="logo-box">
        ${
          logoSrc
            ? `<img src="${logoSrc}" alt="Logotipo ${escapeHtml(tradeName)}" />`
            : `<span style="font-weight: 900; color: #0963cb; font-size: 16pt;">AC</span>`
        }
      </div>
      <div class="company-block">
        <h1 class="company-trade">${escapeHtml(tradeName)}</h1>
        ${
          corporateName && corporateName !== tradeName
            ? `<div class="company-corporate">Razão Social: ${escapeHtml(corporateName)}</div>`
            : ''
        }
        <div class="company-meta">
          ${cnpj ? `<strong>CNPJ:</strong> ${escapeHtml(cnpj)}` : ''}
          ${phone ? ` &nbsp;|&nbsp; <strong>Tel:</strong> ${escapeHtml(phone)}` : ''}
          ${fullAddress ? `<br/>${escapeHtml(fullAddress)}` : ''}
        </div>
      </div>
      <div class="report-meta">
        <div class="report-badge">RELAÇÃO DE COLABORADORES</div>
        <div class="report-meta-lines">
          <div>Emissão: <strong>${escapeHtml(dateFormatted)} às ${escapeHtml(timeFormatted)}</strong></div>
          <div>Total listado: <strong>${employees.length} ${employees.length === 1 ? 'funcionário' : 'funcionários'}</strong></div>
        </div>
      </div>
    </header>

    <div class="summary-bar">
      <div><strong>Filtro aplicado:</strong> ${escapeHtml(scopeLabel)}</div>
      <div><strong>Formato:</strong> A4 ${orientation === 'landscape' ? 'Paisagem' : 'Retrato'} (${activeColumns.length} colunas)</div>
    </div>

    <table>
      <thead>
        <tr>
          ${headerCellsHtml}
        </tr>
      </thead>
      <tbody>
        ${bodyRowsHtml}
      </tbody>
      ${salaryFooterHtml}
    </table>

    <footer class="print-footer">
      <span>AgroControl ERP — Relatório de Recursos Humanos</span>
      <span>Emitido em ${escapeHtml(dateFormatted)} às ${escapeHtml(timeFormatted)}</span>
    </footer>
  </div>

  <script>
    (function() {
      var printed = false;
      function triggerPrint() {
        if (printed) return;
        printed = true;
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      }
      window.addEventListener('load', function() {
        setTimeout(triggerPrint, 250);
      });
      if (document.readyState === 'complete') {
        setTimeout(triggerPrint, 250);
      }
    })();
  </script>
</body>
</html>`;
}
