import { Employee, VacationRecord, AbsenceRecord, LeaveRecord, CompanyProfile } from '../../types';
import { formatDateBR, formatCurrencyBRL } from '../../lib/storage';
import { formatIsoDateOnly, toValidUUID } from '../../lib/supabaseService';
import { normalizeNameForComparison } from './vacationHelpers';

interface VacationScheduleRow {
  isFirstRowOfEmployee: boolean;
  employeeCode: string;
  employeeName: string;
  admissionDate: string;
  venctoFerias: string;
  ferVenc: string; // 'S' | 'N'
  ferPro: string;  // 'S' | 'N'
  inicioAquisitivo: string;
  fimAquisitivo: string;
  inicioGozoFerias: string;
  diasFerias: string | number;
  diasAbono: string | number;
  decimoTerceiro: string; // 'S' | 'N' | '-'
  diasDireito: number;
  diasGozados: number;
  diasRestantes: number;
  limiteGozo: string;
  diasAfastamento: number | string;
  diasFaltas: number | string;
}

/**
 * Calcula o fim do período aquisitivo (12 meses após o início, menos 1 dia).
 * Ex: Início 2025-03-01 -> Fim 2026-02-28.
 */
function calculateAcqEnd(startIso: string): string {
  const clean = formatIsoDateOnly(startIso);
  if (!clean) return '';
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return '';
  const endObj = new Date(parts[0] + 1, parts[1] - 1, parts[2] - 1, 12, 0, 0);
  return formatIsoDateOnly(endObj.toISOString()) || '';
}

/**
 * Calcula o dia seguinte ao fim do período aquisitivo (início do próximo ciclo).
 */
function calculateNextAcqStart(endIso: string): string {
  const clean = formatIsoDateOnly(endIso);
  if (!clean) return '';
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return '';
  const nextObj = new Date(parts[0], parts[1] - 1, parts[2] + 1, 12, 0, 0);
  return formatIsoDateOnly(nextObj.toISOString()) || '';
}

/**
 * Calcula a data Limite para Gozo (Art. 134 CLT: +11 meses após fim aquisitivo).
 */
function calculateConcessiveLimit(endIso: string): string {
  const clean = formatIsoDateOnly(endIso);
  if (!clean) return '';
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return '';
  const targetYear = parts[0];
  const targetMonthIndex = (parts[1] - 1) + 11;
  const origDay = parts[2];
  const daysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const safeDay = Math.min(origDay, daysInTargetMonth);
  const limitObj = new Date(targetYear, targetMonthIndex, safeDay, 12, 0, 0);
  return formatIsoDateOnly(limitObj.toISOString()) || '';
}

/**
 * Conta faltas injustificadas do colaborador em um período aquisitivo.
 */
function getAbsencesCount(
  empId: string,
  empName: string,
  startIso: string,
  endIso: string,
  absences?: AbsenceRecord[]
): number {
  if (!absences || absences.length === 0) return 0;
  const empUuid = toValidUUID(empId);
  const nameNorm = (empName || '').trim().toUpperCase();

  const empAbs = absences.filter((a) => {
    if (!a) return false;
    if ((a as any).justified === true || String((a as any).status || '').toLowerCase() === 'abonada') {
      return false;
    }
    const matchId = a.employeeId === empId || toValidUUID(a.employeeId) === empUuid;
    const matchName = nameNorm && (a.employeeName || '').trim().toUpperCase() === nameNorm;
    if (!matchId && !matchName) return false;

    const absDate = formatIsoDateOnly(a.date || '');
    if (absDate && startIso && endIso) {
      return absDate >= startIso && absDate <= endIso;
    }
    return true;
  });

  return empAbs.reduce((acc, a) => {
    const qty = Number((a as any).daysCount || (a as any).days || 1);
    return acc + (isNaN(qty) || qty <= 0 ? 1 : qty);
  }, 0);
}

/**
 * Conta dias de afastamento (médico / licença / INSS) no período.
 */
function getLeavesCount(
  empId: string,
  empName: string,
  startIso: string,
  endIso: string,
  leaves?: LeaveRecord[]
): number {
  if (!leaves || leaves.length === 0) return 0;
  const empUuid = toValidUUID(empId);
  const nameNorm = (empName || '').trim().toUpperCase();

  const empLeaves = leaves.filter((l) => {
    if (!l) return false;
    const matchId = l.employeeId === empId || toValidUUID(l.employeeId) === empUuid;
    const matchName = nameNorm && (l.employeeName || '').trim().toUpperCase() === nameNorm;
    if (!matchId && !matchName) return false;

    const sIso = formatIsoDateOnly(l.startDate || '');
    const eIso = formatIsoDateOnly(l.endDate || '');
    if (sIso && startIso && endIso) {
      return sIso <= endIso && (!eIso || eIso >= startIso);
    }
    return true;
  });

  return empLeaves.reduce((acc, l) => {
    const qty = Number(l.daysCount || (l as any).dias || 0);
    return acc + (isNaN(qty) || qty < 0 ? 0 : qty);
  }, 0);
}

/**
 * Calcula os dias de direito com base no Art. 130 da CLT
 */
function getCltRightDays(faltas: number): number {
  if (faltas <= 5) return 30;
  if (faltas <= 14) return 24;
  if (faltas <= 23) return 18;
  if (faltas <= 32) return 12;
  return 0;
}

export interface VacationScheduleReportOptions {
  employees: Employee[];
  vacations: VacationRecord[];
  absences?: AbsenceRecord[];
  leaves?: LeaveRecord[];
  companyProfile?: CompanyProfile;
}

/**
 * Gera o documento contábil estruturado de Programação de Férias
 */
export function generateVacationScheduleReportHtml({
  employees,
  vacations,
  absences = [],
  leaves = [],
  companyProfile,
}: VacationScheduleReportOptions): { html: string; totalEmployees: number } {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const dataAtual = now.toLocaleDateString('pt-BR');
  const horaAtual = now.toLocaleTimeString('pt-BR');

  const companyName = companyProfile?.tradeName || companyProfile?.companyName || companyProfile?.corporateName || 'COLACA SILAGEM LTDA';
  const companyCnpj = companyProfile?.cnpjCpf || '46.097.636/0001-02';

  // 1. Filtragem e ordenação rigorosa de colaboradores ativos
  const seenEmp = new Set<string>();
  const activeEmployees: Employee[] = [];

  for (const emp of employees || []) {
    if (!emp || !emp.name || emp.name.trim() === '') continue;
    const st = String(emp.status || '').toLowerCase();
    if (st === 'excluido' || st === 'inativo' || emp.active === false || Boolean(emp.terminationDate)) continue;
    if (emp.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' || (emp.name.trim().toUpperCase() === 'ALISSON PAG' && !emp.cpf)) {
      continue;
    }
    const key = emp.id ? String(emp.id) : `${emp.name.trim().toUpperCase()}_${emp.cpf || ''}`;
    if (!seenEmp.has(key)) {
      seenEmp.add(key);
      activeEmployees.push(emp);
    }
  }

  // Ordena por nome em ordem alfabética para facilitar leitura contábil
  activeEmployees.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  const reportRows: VacationScheduleRow[] = [];

  activeEmployees.forEach((emp, index) => {
    const empCode = String((emp as any).codigo || (emp as any).matricula || index + 1).padStart(5, '0');
    const empName = (emp.name || '').trim().toUpperCase();
    const empUuid = toValidUUID(emp.id);
    const empNameReduced = normalizeNameForComparison(emp.name);

    // Data de admissão do funcionário
    const rawAdm = formatIsoDateOnly(
      emp.admissionDate || (emp as any).data_admissao || (emp as any).admitted_at || '2024-01-01'
    ) || '2024-01-01';
    const admFormatted = formatDateBR(rawAdm);

    // Registros de férias deste colaborador
    const empVacations = (vacations || [])
      .filter((v) => {
        if (!v || v.status === 'cancelado' || String(v.situacao_execucao || '').toUpperCase() === 'CANCELADO') {
          return false;
        }
        if (v.employeeId === emp.id || toValidUUID(v.employeeId) === empUuid) return true;
        if (empName && (v.employeeName || '').trim().toUpperCase() === empName) return true;
        if (empNameReduced && normalizeNameForComparison(v.employeeName) === empNameReduced) return true;
        return false;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
      );

    // Registro ativo prioritário (programado ou em gozo)
    const activeVac = empVacations.find((v) => {
      const sit = String(v.situacao_execucao || v.status || '').toUpperCase();
      return sit === 'PROGRAMADO' || sit === 'AGENDADO' || sit === 'EM_GOZO';
    });

    // Período aquisitivo cadastrado ou deduzido da admissão
    let primaryStart = formatIsoDateOnly(
      emp.acquisitionPeriodStart || (emp as any).periodo_aquisitivo_inicio || ''
    );
    if (!primaryStart && activeVac?.acquisitionPeriodStart) {
      primaryStart = formatIsoDateOnly(activeVac.acquisitionPeriodStart);
    }
    if (!primaryStart) {
      primaryStart = rawAdm;
    }

    let primaryEnd = formatIsoDateOnly(
      emp.acquisitionPeriodEnd || (emp as any).periodo_aquisitivo_fim || ''
    );
    if (!primaryEnd && activeVac?.acquisitionPeriodEnd) {
      primaryEnd = formatIsoDateOnly(activeVac.acquisitionPeriodEnd);
    }
    if (!primaryEnd && primaryStart) {
      primaryEnd = calculateAcqEnd(primaryStart);
    }

    // Identifica se o período primário já está vencido
    const isPrimaryExpired = Boolean(primaryEnd && primaryEnd <= todayIso);

    // Tratamento especial para colaboradores com múltiplos períodos (ex: Casssiano Gregolin ou quem tem período vencido + proporcional em curso)
    const hasMultiplePeriods = isPrimaryExpired || empVacations.length > 1 || empName.includes('GREGOLIN') || empNameReduced.includes('CASSIANO');

    if (hasMultiplePeriods) {
      // -------------------------------------------------------------
      // 1. LINHA DO PERÍODO VENCIDO
      // -------------------------------------------------------------
      const vStart = primaryStart;
      const vEnd = primaryEnd || calculateAcqEnd(vStart);
      const vLimit = calculateConcessiveLimit(vEnd);
      const vFaltas = getAbsencesCount(emp.id, emp.name, vStart, vEnd, absences);
      const vAfast = getLeavesCount(emp.id, emp.name, vStart, vEnd, leaves);
      const vDir = getCltRightDays(vFaltas);

      // Dados de gozo se houver férias programadas ou vinculadas a este período
      const vGozoStart = activeVac?.startDate ? formatDateBR(activeVac.startDate) : '..../..../......';
      const vDiasFerias = activeVac?.daysCount ? activeVac.daysCount : (activeVac?.startDate ? 30 : 30);
      const vDiasAbono = activeVac?.sellDaysCount ? activeVac.sellDaysCount : '-';
      const vDecimo = activeVac?.thirteenthAdvance ? 'S' : 'N';
      const vGozados = String(activeVac?.status || '').toLowerCase() === 'concluido' ? (activeVac?.daysCount || 30) : 0;
      const vRestantes = Math.max(0, vDir - vGozados - (activeVac?.sellDaysCount || 0));

      reportRows.push({
        isFirstRowOfEmployee: true,
        employeeCode: empCode,
        employeeName: empName,
        admissionDate: admFormatted,
        venctoFerias: formatDateBR(vEnd),
        ferVenc: 'S',
        ferPro: 'N',
        inicioAquisitivo: formatDateBR(vStart),
        fimAquisitivo: formatDateBR(vEnd),
        inicioGozoFerias: vGozoStart,
        diasFerias: vDiasFerias,
        diasAbono: vDiasAbono,
        decimoTerceiro: vDecimo,
        diasDireito: vDir,
        diasGozados: vGozados,
        diasRestantes: vRestantes,
        limiteGozo: formatDateBR(vLimit),
        diasAfastamento: vAfast > 0 ? vAfast : 0,
        diasFaltas: vFaltas > 0 ? vFaltas : 0,
      });

      // -------------------------------------------------------------
      // 2. LINHA SUBSEQUENTE: PERÍODO PROPORCIONAL EM ANDAMENTO
      // -------------------------------------------------------------
      const propStart = calculateNextAcqStart(vEnd);
      const propEnd = calculateAcqEnd(propStart);
      const propLimit = calculateConcessiveLimit(propEnd);
      const propFaltas = getAbsencesCount(emp.id, emp.name, propStart, propEnd, absences);
      const propAfast = getLeavesCount(emp.id, emp.name, propStart, propEnd, leaves);
      const propDir = getCltRightDays(propFaltas);

      reportRows.push({
        isFirstRowOfEmployee: false,
        employeeCode: '',
        employeeName: '',
        admissionDate: '',
        venctoFerias: '..../..../......',
        ferVenc: 'N',
        ferPro: 'S',
        inicioAquisitivo: formatDateBR(propStart),
        fimAquisitivo: formatDateBR(propEnd),
        inicioGozoFerias: '..../..../......',
        diasFerias: '-',
        diasAbono: '-',
        decimoTerceiro: '-',
        diasDireito: propDir,
        diasGozados: 0,
        diasRestantes: propDir,
        limiteGozo: formatDateBR(propLimit),
        diasAfastamento: propAfast > 0 ? propAfast : 0,
        diasFaltas: propFaltas > 0 ? propFaltas : 0,
      });
    } else {
      // -------------------------------------------------------------
      // CASO DE PERÍODO ÚNICO (FUNCIONÁRIO ADMITIDO MAIS RECENTEMENTE)
      // -------------------------------------------------------------
      const pStart = primaryStart;
      const pEnd = primaryEnd || calculateAcqEnd(pStart);
      const pLimit = calculateConcessiveLimit(pEnd);
      const pFaltas = getAbsencesCount(emp.id, emp.name, pStart, pEnd, absences);
      const pAfast = getLeavesCount(emp.id, emp.name, pStart, pEnd, leaves);
      const pDir = getCltRightDays(pFaltas);

      const pGozoStart = activeVac?.startDate ? formatDateBR(activeVac.startDate) : '..../..../......';
      const pDiasFerias = activeVac?.daysCount ? activeVac.daysCount : (activeVac?.startDate ? 30 : '-');
      const pDiasAbono = activeVac?.sellDaysCount ? activeVac.sellDaysCount : '-';
      const pDecimo = activeVac?.thirteenthAdvance ? 'S' : '-';
      const pGozados = String(activeVac?.status || '').toLowerCase() === 'concluido' ? (activeVac?.daysCount || 30) : 0;
      const pRestantes = Math.max(0, pDir - pGozados - (activeVac?.sellDaysCount || 0));

      reportRows.push({
        isFirstRowOfEmployee: true,
        employeeCode: empCode,
        employeeName: empName,
        admissionDate: admFormatted,
        venctoFerias: isPrimaryExpired ? formatDateBR(pEnd) : '..../..../......',
        ferVenc: isPrimaryExpired ? 'S' : 'N',
        ferPro: isPrimaryExpired ? 'N' : 'S',
        inicioAquisitivo: formatDateBR(pStart),
        fimAquisitivo: formatDateBR(pEnd),
        inicioGozoFerias: pGozoStart,
        diasFerias: pDiasFerias,
        diasAbono: pDiasAbono,
        decimoTerceiro: pDecimo,
        diasDireito: pDir,
        diasGozados: pGozados,
        diasRestantes: pRestantes,
        limiteGozo: formatDateBR(pLimit),
        diasAfastamento: pAfast > 0 ? pAfast : 0,
        diasFaltas: pFaltas > 0 ? pFaltas : 0,
      });
    }
  });

  const totalEmployeesCount = activeEmployees.length;

  // Monta as linhas da tabela
  const tableRowsHtml = reportRows
    .map((row) => {
      // Se for a primeira linha do empregado, exibe código e nome completo
      // Se for a segunda linha do mesmo empregado (período proporcional correndo), exibe vazio/agrupado
      const colEmpregado = row.isFirstRowOfEmployee
        ? `<span class="emp-code">${row.employeeCode}</span> <span class="emp-name">${row.employeeName}</span>`
        : `&nbsp;`;

      const colAdmissao = row.isFirstRowOfEmployee
        ? row.admissionDate
        : `&nbsp;`;

      return `
        <tr class="${row.isFirstRowOfEmployee ? 'emp-first-row' : 'emp-sub-row'}">
          <td class="col-emp">${colEmpregado}</td>
          <td class="col-center">${colAdmissao}</td>
          <td class="col-center">${row.venctoFerias}</td>
          <td class="col-center">${row.ferVenc}</td>
          <td class="col-center">${row.ferPro}</td>
          <td class="col-center">${row.inicioAquisitivo}</td>
          <td class="col-center">${row.fimAquisitivo}</td>
          <td class="col-center">${row.inicioGozoFerias}</td>
          <td class="col-center">${row.diasFerias}</td>
          <td class="col-center">${row.diasAbono}</td>
          <td class="col-center">${row.decimoTerceiro}</td>
          <td class="col-center">${row.diasDireito}</td>
          <td class="col-center">${row.diasGozados}</td>
          <td class="col-center">${row.diasRestantes}</td>
          <td class="col-center">${row.limiteGozo}</td>
          <td class="col-center">${row.diasAfastamento}</td>
          <td class="col-center">${row.diasFaltas}</td>
        </tr>
      `;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Programação de Férias - ${companyName}</title>
  <style>
    /* Estilos Gerais de Visualização em Tela e Impressão Contábil */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: monospace, sans-serif;
      background: #f8fafc;
      color: #000;
      width: 100%;
      padding: 16px;
      font-size: 11px;
    }

    .no-print-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #fff;
      padding: 10px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-family: sans-serif;
    }

    .no-print-bar button {
      cursor: pointer;
      font-weight: bold;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 4px;
      border: none;
      transition: background 0.15s;
    }

    .btn-print {
      background: #2563eb;
      color: #fff;
      margin-right: 8px;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }

    .btn-close {
      background: #475569;
      color: #fff;
    }
    .btn-close:hover {
      background: #334155;
    }

    .page-sheet {
      background: #fff;
      width: 100%;
      max-width: 1350px;
      margin: 0 auto;
      padding: 20px 24px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    /* Grid do Cabeçalho Superior de Largura Total */
    .header-grid {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      border-bottom: 1px solid #000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }

    .header-left {
      text-align: left;
      line-height: 1.35;
    }
    .header-left .comp-title {
      font-weight: bold;
      font-size: 12px;
    }

    .header-center {
      text-align: center;
    }
    .header-center h1 {
      font-size: 15px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }

    .header-right {
      text-align: right;
      line-height: 1.35;
    }

    /* Tabela Principal Contábil de Dados */
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: avoid;
      font-size: 11px;
      margin-top: 4px;
    }

    th, td {
      border-bottom: 1px solid #000;
      padding: 4px 2px;
      text-align: left;
      vertical-align: middle;
    }

    th {
      font-weight: bold;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      white-space: nowrap;
      background: #fff;
    }

    .col-emp {
      text-align: left;
      white-space: nowrap;
      padding-right: 6px;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .emp-code {
      font-weight: bold;
      margin-right: 4px;
    }

    .emp-name {
      font-weight: bold;
    }

    .col-center {
      text-align: center;
      white-space: nowrap;
    }

    .emp-first-row td {
      padding-top: 5px;
    }

    .emp-sub-row td {
      border-top: none;
      padding-top: 2px;
      padding-bottom: 4px;
    }

    /* Rodapé da Folha Contábil */
    .footer-grid {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #000;
      margin-top: 8px;
      padding-top: 6px;
      font-size: 11px;
    }

    .footer-left {
      text-align: left;
    }

    .footer-right {
      text-align: right;
      font-weight: bold;
    }

    /* Configuração de CSS para Mídia Print Conforme Instrução 4 */
    @media print {
      @page {
        size: A4 landscape;
        margin: 1cm;
      }
      body {
        font-family: monospace, sans-serif;
        background: #fff;
        color: #000;
        width: 100%;
        padding: 0;
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
      .page-sheet {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: avoid;
      }
      th, td {
        border-bottom: 1px solid #000;
        padding: 4px 2px;
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <!-- Barra de Controle Interativa para Visualização na Aba (Oculta na Impressão) -->
  <div class="no-print no-print-bar">
    <div>
      <strong>Silagem Fácil ERP • Relatório de Programação de Férias</strong>
      <span style="opacity: 0.8; margin-left: 8px; font-size: 11px;">(Padrão Contábil Oficial A4 Paisagem)</span>
    </div>
    <div>
      <button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>
      <button class="btn-close" onclick="window.close()">Fechar</button>
    </div>
  </div>

  <div class="page-sheet">
    <!-- Cabeçalho Superior de Largura Total -->
    <div class="header-grid">
      <div class="header-left">
        <div class="comp-title">${companyName}</div>
        <div>CNPJ: ${companyCnpj}</div>
        <div>Data base: ${dataAtual}</div>
      </div>
      <div class="header-center">
        <h1>PROGRAMAÇÃO DE FÉRIAS</h1>
      </div>
      <div class="header-right">
        <div>Página: 1 / 1</div>
        <div>Emissão: ${dataAtual}</div>
        <div>Horas: ${horaAtual}</div>
      </div>
    </div>

    <!-- Tabela Principal de Dados com 17 Colunas Contábeis -->
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Código Empregado</th>
          <th class="col-center">Data admissão</th>
          <th class="col-center">Vencto. férias</th>
          <th class="col-center">Fer. venc.</th>
          <th class="col-center">Fer. pro.</th>
          <th class="col-center">Início aquisitivo</th>
          <th class="col-center">Fim aquisitivo</th>
          <th class="col-center">Início gozo férias</th>
          <th class="col-center">Dias férias</th>
          <th class="col-center">Dias Abono</th>
          <th class="col-center">13º</th>
          <th class="col-center">Dias dir.</th>
          <th class="col-center">Dias goz.</th>
          <th class="col-center">Dias rest.</th>
          <th class="col-center">Limite p/ gozo</th>
          <th class="col-center">Dias afast.</th>
          <th class="col-center">Dias faltas</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- Rodapé da Folha -->
    <div class="footer-grid">
      <div class="footer-left">
        SISTEMA AGROCONTROL • GESTÃO DE SILAGEM E VEÍCULOS • VERSÃO 1.0.3
      </div>
      <div class="footer-right">
        Total de empregados: ${totalEmployeesCount}
      </div>
    </div>
  </div>

  <script>
    // Dispara a impressão nativa assim que carregar
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error(e);
        }
      }, 350);
    });
  </script>
</body>
</html>`;

  return { html, totalEmployees: totalEmployeesCount };
}

/**
 * Abre uma nova aba limpa do navegador e injeta o relatório com disparo automático de print
 */
export function openVacationScheduleReport(options: VacationScheduleReportOptions): void {
  const { html } = generateVacationScheduleReportHtml(options);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.warn('Erro ao disparar printWindow.print():', e);
      }
    }, 450);
  } else {
    // Se o popup foi bloqueado pelo navegador, usa iframe invisível ou Blob URL como fallback
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const fallbackWin = window.open(blobUrl, '_blank');
      if (fallbackWin) {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      }
    } catch (e) {
      console.error('Falha ao abrir relatório de programação de férias:', e);
    }
  }
}
