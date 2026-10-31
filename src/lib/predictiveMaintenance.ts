import { Machinery, FuelLog, MaintenanceLog, PreventiveGroupItem } from '../types';
import { getStoredPreventiveGroupPlans, getStoredMachineries, getStoredFuelLogs, getStoredMaintenanceLogs } from './storage';

export interface PredictiveMaintenanceAlert {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehiclePlate?: string;
  category: string;
  ruleId?: string;
  itemName: string;
  subgroup?: string;
  metric: 'horas' | 'km';
  threshold: number;
  currentValue: number;
  lastServiceValue: number;
  delta: number; // remaining hours or km (can be <= 0 if overdue)
  isOverdue: boolean;
  message: string;
}

/**
 * Normaliza a categoria do maquinário para fazer correspondência com os nós do plano preventivo
 */
export function resolveVehiclePreventiveCategory(vehicle: Machinery): string {
  const directCat = String((vehicle as any).categoriaVeiculo || (vehicle as any).categoria || vehicle.categoryType || '').trim().toUpperCase();
  const rawType = String((vehicle as any).categoria_veiculo || vehicle.type || (vehicle as any).vehicleType || vehicle.model || vehicle.name || '').trim().toUpperCase();
  
  const normDirect = directCat.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normRaw = rawType.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (normDirect.includes('COLHEITADEIRA') || normRaw.includes('COLHEITADEIRA') || normRaw.includes('COLHEDOR') || normRaw.includes('DERE860')) {
    return 'COLHEITADEIRA';
  }
  if (normDirect.includes('FORRAGEIRA') || normDirect.includes('ENSILADEIRA') || normRaw.includes('FORRAGEIRA') || normRaw.includes('ENSILADEIRA') || normRaw.includes('JAGUAR')) {
    return 'FORRAGEIRA';
  }
  if (normDirect.includes('TRATOR') || normRaw.includes('TRATOR')) {
    return 'TRATOR';
  }
  if (normDirect.includes('CAMINHAO') || normRaw.includes('CAMINHAO') || normRaw.includes('CAVALO') || normRaw.includes('CARGO') || normRaw.includes('BASCULANTE') || normRaw.includes('KOMBI') || normRaw.includes('TORINO')) {
    return 'CAMINHÃO';
  }
  if (normDirect.includes('PESAD') || normRaw.includes('PESAD') || normRaw.includes('CARREGADEIRA') || normRaw.includes('ESCAVADEIRA') || normRaw.includes('RETRO')) {
    return 'MÁQUINAS PESADAS';
  }

  return directCat || 'COLHEITADEIRA';
}

/**
 * Motor preditivo que cruza leituras de abastecimentos (FuelLog), ordens executadas (MaintenanceLog)
 * e diretrizes da matriz preventiva para gerar alertas antecipados (delta <= 10 Horas ou KM).
 */
export function calculatePredictiveMaintenanceAlerts(
  machineries?: Machinery[],
  fuelLogs?: FuelLog[],
  maintenanceLogs?: MaintenanceLog[],
  customPlans?: Record<string, PreventiveGroupItem[]>
): PredictiveMaintenanceAlert[] {
  const vehicles = machineries && machineries.length > 0 ? machineries : getStoredMachineries();
  const fuels = fuelLogs && fuelLogs.length > 0 ? fuelLogs : getStoredFuelLogs();
  const maints = maintenanceLogs && maintenanceLogs.length > 0 ? maintenanceLogs : getStoredMaintenanceLogs();
  const plans = customPlans || getStoredPreventiveGroupPlans();

  const alerts: PredictiveMaintenanceAlert[] = [];

  vehicles.forEach((vehicle) => {
    if (!vehicle || (vehicle.status as string) === 'inativo') return;

    const categoryKey = resolveVehiclePreventiveCategory(vehicle);
    let rulesForCategory = plans[categoryKey] || [];
    if (rulesForCategory.length === 0 && categoryKey === 'CAMINHÃO') {
      rulesForCategory = plans['CAMINHAO'] || [];
    }
    if (rulesForCategory.length === 0 && categoryKey === 'MÁQUINAS PESADAS') {
      rulesForCategory = plans['MAQUINAS_PESADAS'] || [];
    }

    if (!rulesForCategory || rulesForCategory.length === 0) return;

    // 1. Apuração da leitura atual em tempo real (veículo vs abastecimentos mais recentes)
    const vehicleFuelLogs = fuels.filter(f => f.machineryId === vehicle.id || (f as any).vehicleId === vehicle.id);
    let maxFuelHours = 0;
    let maxFuelKm = 0;

    vehicleFuelLogs.forEach(f => {
      if (typeof f.currentHourMeter === 'number' && f.currentHourMeter > maxFuelHours) {
        maxFuelHours = f.currentHourMeter;
      }
      if (typeof f.currentHourMeterOrKm === 'number') {
        if (vehicle.controlBy === 'km') {
          if (f.currentHourMeterOrKm > maxFuelKm) maxFuelKm = f.currentHourMeterOrKm;
        } else {
          if (f.currentHourMeterOrKm > maxFuelHours) maxFuelHours = f.currentHourMeterOrKm;
        }
      }
      if (typeof f.currentKm === 'number' && f.currentKm > maxFuelKm) {
        maxFuelKm = f.currentKm;
      }
    });

    const currentHours = Math.max(Number(vehicle.hourMeter || (vehicle as any).horimetro || (vehicle as any).horimetro_ou_km_atual || 0), maxFuelHours);
    const currentKm = Math.max(Number(vehicle.currentKm || (vehicle as any).odometro || 0), maxFuelKm);

    // 2. Filtra manutenções prévias deste veículo
    const vehicleMaints = maints.filter(m => m.machineryId === vehicle.id || (m as any).vehicleId === vehicle.id);

    // 3. Avaliação de cada regra cadastrada na matriz do grupo
    rulesForCategory.forEach((rule) => {
      const intervalHours = rule.INTERVALO_HORAS !== undefined && rule.INTERVALO_HORAS > 0
        ? Number(rule.INTERVALO_HORAS)
        : (rule.INTERVALO_KM === undefined || rule.INTERVALO_KM === 0 ? Number(rule.INTERVALO_HORAS_KM || 0) : 0);
      
      const intervalKm = rule.INTERVALO_KM !== undefined && rule.INTERVALO_KM > 0
        ? Number(rule.INTERVALO_KM)
        : 0;

      if (intervalHours <= 0 && intervalKm <= 0) return;

      const itemName = (
        rule.ITEM_NOME_ESTOQUE ||
        rule.PRODUTO_NOME_REAL ||
        rule.PRODUTO_NOME_ESTOQUE ||
        rule.ITEM_NOME ||
        'INSUMO'
      ).toUpperCase().trim();

      // Busca a última manutenção que substituiu ou revisou este item
      let lastHoursAtService = 0;
      let lastKmAtService = 0;
      let foundPriorService = false;

      for (const mLog of vehicleMaints) {
        const hasPart = mLog.partsItems?.some(p => {
          const pAny = p as any;
          const pDesc = String(p.description || pAny.name || pAny.nome || '').toUpperCase();
          return (
            (rule.PRODUTO_ID && (p.id === rule.PRODUTO_ID || p.inventoryItemId === rule.PRODUTO_ID)) ||
            (pDesc && itemName.includes(pDesc)) ||
            (pDesc && pDesc.includes(rule.ITEM_NOME.toUpperCase()))
          );
        });
        const matchCategory = mLog.serviceCategory && rule.SUBGRUPO && mLog.serviceCategory.toUpperCase() === rule.SUBGRUPO.toUpperCase();
        const matchDesc = mLog.description && mLog.description.toUpperCase().includes(rule.ITEM_NOME.toUpperCase());

        if (hasPart || matchCategory || matchDesc) {
          const serviceReading = Number(mLog.hourMeterOrKmAtService || mLog.currentHourMeterOrKm || 0);
          if (serviceReading > 0) {
            lastHoursAtService = serviceReading;
            lastKmAtService = serviceReading;
            foundPriorService = true;
            break;
          }
        }
      }

      if (!foundPriorService) {
        lastHoursAtService = Number((vehicle as any).initialHourMeter || 0);
        lastKmAtService = Number((vehicle as any).initialKm || 0);
      }

      // Verificação por Horas
      let alertCandidateHours: { delta: number; threshold: number; current: number; last: number; trigger: number } | null = null;
      if (intervalHours > 0) {
        const triggerHours = rule.ALERTA_HORAS !== undefined && rule.ALERTA_HORAS > 0 ? Number(rule.ALERTA_HORAS) : 50;
        const elapsed = Math.max(0, currentHours - lastHoursAtService);
        const delta = intervalHours - elapsed;
        if (delta <= triggerHours) {
          alertCandidateHours = {
            delta,
            threshold: intervalHours,
            current: currentHours,
            last: lastHoursAtService,
            trigger: triggerHours,
          };
        }
      }

      // Verificação por KM
      let alertCandidateKm: { delta: number; threshold: number; current: number; last: number; trigger: number } | null = null;
      if (intervalKm > 0) {
        const triggerKm = rule.ALERTA_KM !== undefined && rule.ALERTA_KM > 0 ? Number(rule.ALERTA_KM) : 500;
        const elapsed = Math.max(0, currentKm - lastKmAtService);
        const delta = intervalKm - elapsed;
        if (delta <= triggerKm) {
          alertCandidateKm = {
            delta,
            threshold: intervalKm,
            current: currentKm,
            last: lastKmAtService,
            trigger: triggerKm,
          };
        }
      }

      // Se ambos dispararem, prioriza o mais crítico (menor delta)
      let chosenMetric: 'horas' | 'km' | null = null;
      let chosenData: { delta: number; threshold: number; current: number; last: number; trigger: number } | null = null;

      if (alertCandidateHours && alertCandidateKm) {
        if (alertCandidateHours.delta <= alertCandidateKm.delta) {
          chosenMetric = 'horas';
          chosenData = alertCandidateHours;
        } else {
          chosenMetric = 'km';
          chosenData = alertCandidateKm;
        }
      } else if (alertCandidateHours) {
        chosenMetric = 'horas';
        chosenData = alertCandidateHours;
      } else if (alertCandidateKm) {
        chosenMetric = 'km';
        chosenData = alertCandidateKm;
      }

      if (chosenMetric && chosenData) {
        const vName = (vehicle.model || vehicle.name || vehicle.licensePlateOrSerial || 'VEÍCULO').toUpperCase().trim();
        const metricLabel = chosenMetric === 'horas' ? 'HORAS' : 'KM';
        const isOverdue = chosenData.delta <= 0;
        
        let message = '';
        if (isOverdue) {
          const absOver = Math.abs(chosenData.delta);
          message = `⚠️ ALERTA PREVENTIVO: VEÍCULO ${vName} ESTÁ A 0 ${metricLabel} DE ATINGIR O PERÍODO DE TROCA DO ITEM ${itemName}.${absOver > 0 ? ` (${absOver} ${metricLabel} VENCIDO)` : ''}`;
        } else {
          message = `⚠️ ALERTA PREVENTIVO: VEÍCULO ${vName} ESTÁ A ${chosenData.delta} ${metricLabel} DE ATINGIR O PERÍODO DE TROCA DO ITEM ${itemName}.`;
        }

        alerts.push({
          id: `alert_${vehicle.id}_${rule.id || itemName}_${chosenMetric}`,
          vehicleId: vehicle.id,
          vehicleName: vName,
          vehiclePlate: vehicle.licensePlateOrSerial,
          category: categoryKey,
          ruleId: rule.id,
          itemName,
          subgroup: rule.SUBGRUPO,
          metric: chosenMetric,
          threshold: chosenData.threshold,
          currentValue: chosenData.current,
          lastServiceValue: chosenData.last,
          delta: chosenData.delta,
          isOverdue,
          message,
        });
      }
    });
  });

  // Ordena os alertas: mais urgentes (menor delta ou vencidos) primeiro
  return alerts.sort((a, b) => a.delta - b.delta);
}
