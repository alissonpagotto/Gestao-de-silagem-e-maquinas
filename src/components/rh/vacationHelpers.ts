import { Employee, VacationRecord } from '../../types';
import { toValidUUID } from '../../lib/supabaseService';

export interface UnifiedVacationItem extends VacationRecord {
  valor_ferias: number;
  isEmGozo: boolean;
  isProgramado: boolean;
}

export interface UnifiedVacationMetrics {
  activeVacationsList: UnifiedVacationItem[];
  emGozoCount: number;
  programadosCount: number;
  totalEmFeriasAgendado: number;
  totalInjected: number;
}

/**
 * Normaliza strings de nomes para comparação resiliente a duplicações de letras (ex: Casssiano -> Cassiano)
 */
export function normalizeNameForComparison(name?: string): string {
  if (!name) return '';
  return name.trim().toUpperCase().replace(/S{2,}/g, 'S');
}

/**
 * Calcula os totalizadores e a lista unificada de férias ativas (Em Gozo e Programadas)
 * garantindo alinhamento estrito entre o Dashboard de RH e a Aba Férias:
 * 1. Não soma registros invisíveis, duplicados ou de colaboradores inativos/excluídos.
 * 2. Deduplica por colaborador (máximo de 1 período de férias ativo por colaborador).
 * 3. Busca e aplica o salário base contratual real dinâmico para recalcular valor_ferias.
 */
export function computeUnifiedVacationMetrics(
  employees: Employee[],
  vacations: VacationRecord[],
  contractualSalaries?: Map<string, number>
): UnifiedVacationMetrics {
  const validEmployees = (employees || []).filter((e) => {
    if (!e || !e.name || e.name.trim() === '') return false;
    const st = String(e.status || '').toLowerCase();
    if (st === 'excluido' || st === 'inativo' || e.active === false) return false;
    if (
      e.id === 'ab80e2fa-5094-43b3-83bf-c34047bf1b42' ||
      (e.name.trim().toUpperCase() === 'ALISSON PAG' && !e.cpf)
    ) {
      return false;
    }
    return true;
  });

  const seenEmp = new Set<string>();
  const uniqueEmployees: Employee[] = [];
  for (const emp of validEmployees) {
    const key = emp.id ? String(emp.id) : `${emp.name.trim().toUpperCase()}_${emp.cpf || ''}`;
    if (!seenEmp.has(key)) {
      seenEmp.add(key);
      uniqueEmployees.push(emp);
    }
  }

  const activeVacationsList: UnifiedVacationItem[] = [];
  let emGozoCount = 0;
  let programadosCount = 0;

  for (const emp of uniqueEmployees) {
    const empUuid = toValidUUID(emp.id);
    const empNameNorm = (emp.name || '').trim().toUpperCase();
    const empNameReduced = normalizeNameForComparison(emp.name);

    // 1. Busca dinâmica de salário base real (tabela public.funcionarios / public.rh_funcionarios)
    const salaryFromDb =
      contractualSalaries?.get(emp.id) ||
      contractualSalaries?.get(empUuid) ||
      (empNameNorm ? contractualSalaries?.get(empNameNorm) : undefined) ||
      (empNameReduced ? contractualSalaries?.get(empNameReduced) : undefined);

    const activeSalary =
      salaryFromDb && salaryFromDb > 0
        ? salaryFromDb
        : Number(emp.salary || emp.baseSalary || (emp as any).salario || (emp as any).salario_base || 0);

    // 2. Busca registros de férias para este colaborador, ignorando cancelados ou quitados
    const empVacations = (vacations || [])
      .filter((v) => {
        if (!v || v.id === 'vac_alisson_pag_01') return false;
        const st = String(v.status || '').toLowerCase();
        const sit = String(v.situacao_execucao || '').toUpperCase();
        if (
          st === 'cancelado' ||
          sit === 'CANCELADO' ||
          st === 'concluido' ||
          sit === 'CONCLUIDO' ||
          sit === 'QUITADO' ||
          sit === 'REGULAR' ||
          sit === 'QUITADO/REGULAR'
        ) {
          return false;
        }

        const idMatch = v.employeeId === emp.id || toValidUUID(v.employeeId) === empUuid;
        const nameMatch = empNameNorm && (v.employeeName || '').trim().toUpperCase() === empNameNorm;
        const reducedMatch =
          empNameReduced && normalizeNameForComparison(v.employeeName) === empNameReduced;

        return idMatch || nameMatch || reducedMatch;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
      );

    if (empVacations.length === 0) continue;

    // Prioriza 'EM_GOZO' sobre 'PROGRAMADO'/'AGENDADO'
    const gozoVac = empVacations.find((v) => {
      const st = String(v.status || '').toLowerCase();
      const sit = String(v.situacao_execucao || '').toUpperCase();
      return st === 'em_gozo' || sit === 'EM_GOZO';
    });

    const progVac = !gozoVac
      ? empVacations.find((v) => {
          const st = String(v.status || '').toLowerCase();
          const sit = String(v.situacao_execucao || '').toUpperCase();
          return st === 'agendado' || st === 'programado' || sit === 'PROGRAMADO' || sit === 'AGENDADO';
        })
      : null;

    const matchedVac = gozoVac || progVac;
    if (!matchedVac) continue;

    const isEmGozo = Boolean(gozoVac);
    const isProgramado = !isEmGozo && Boolean(progVac);

    if (isEmGozo) emGozoCount++;
    if (isProgramado) programadosCount++;

    // Recalcula o valor bruto dinamicamente com base no salário contratual ativo atualizado daquele ID
    let valorFerias = Number(
      matchedVac.totalAmount || (matchedVac as any).valor_ferias || matchedVac.customVacationAmount || 0
    );

    if (activeSalary > 0) {
      const effectiveDays = matchedVac.daysCount || 30;
      const dailyRate = activeSalary / 30;
      const recalcFerias = Math.round(dailyRate * effectiveDays * 100) / 100;
      const recalcUmTerco = Math.round((recalcFerias / 3) * 100) / 100;
      const sellDays = matchedVac.sellDaysCount || 0;
      const recalcAbono = sellDays > 0 ? Math.round(dailyRate * sellDays * 100) / 100 : 0;
      const recalcUmTercoAbono = sellDays > 0 ? Math.round((recalcAbono / 3) * 100) / 100 : 0;
      const recalcDecimo = matchedVac.thirteenthAdvance
        ? Math.round((activeSalary / 2) * 100) / 100
        : 0;
      valorFerias = Math.round(
        (recalcFerias + recalcUmTerco + recalcAbono + recalcUmTercoAbono + recalcDecimo) * 100
      ) / 100;
    }

    activeVacationsList.push({
      ...matchedVac,
      baseSalary: activeSalary > 0 ? activeSalary : matchedVac.baseSalary,
      totalAmount: valorFerias,
      valor_ferias: valorFerias,
      isEmGozo,
      isProgramado,
    });
  }

  // SOMA DO CARD "TOTAL FÉRIAS LANÇADAS":
  // const totalInjected = activeVacationsList.reduce((acc, curr) => acc + (curr.valor_ferias || 0), 0);
  const totalInjected = activeVacationsList.reduce((acc, curr) => acc + (curr.valor_ferias || 0), 0);

  return {
    activeVacationsList,
    emGozoCount,
    programadosCount,
    totalEmFeriasAgendado: emGozoCount + programadosCount,
    totalInjected,
  };
}
