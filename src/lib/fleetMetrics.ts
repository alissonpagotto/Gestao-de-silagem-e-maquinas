import { FuelLog, Machinery, MaintenanceLog } from '../types';

export interface VehicleConsumptionMetrics {
  totalLiters: number;
  totalFuelCost: number;
  fuelLogsCount: number;
  avgKmPerLiter: number | null; // km/L
  avgLitersPerHour: number | null; // L/h
  avgCostPerKm?: number | null; // R$/km
  avgCostPerHour?: number | null; // R$/h
  totalKmDriven?: number;
  totalHoursWorked?: number;
  avgFuelPricePerLiter?: number | null; // R$/L
  lastHourMeter?: number;
  lastKm?: number;
}

/**
 * Recalculates consumption metrics (km/L and L/h) for a specific vehicle based on all its fuel logs.
 */
export function calculateVehicleConsumptionMetrics(
  machineryId: string,
  fuelLogs: FuelLog[]
): VehicleConsumptionMetrics {
  const vehicleLogs = fuelLogs
    .filter((log) => log.machineryId === machineryId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let totalLiters = 0;
  let totalFuelCost = 0;
  let totalKmDelta = 0;
  let kmLitersSum = 0;
  let totalHourDelta = 0;
  let hourLitersSum = 0;

  let lastHourMeter: number | undefined = undefined;
  let lastKm: number | undefined = undefined;

  for (const log of vehicleLogs) {
    totalLiters += log.liters || 0;
    totalFuelCost += log.totalAmount || 0;

    // Track latest recorded meters
    if (log.currentKm !== undefined && log.currentKm > 0) {
      lastKm = log.currentKm;
    }
    if (log.currentHourMeter !== undefined && log.currentHourMeter > 0) {
      lastHourMeter = log.currentHourMeter;
    }
    if (log.currentHourMeterOrKm && log.currentHourMeterOrKm > 0) {
      if (!lastHourMeter && !lastKm) {
        lastHourMeter = log.currentHourMeterOrKm;
      }
    }

    // 1. Calculate KM consumption if delta is valid
    const currKm = log.currentKm !== undefined ? log.currentKm : (log.currentHourMeterOrKm > 5000 ? log.currentHourMeterOrKm : undefined);
    const prevKm = log.previousKm !== undefined ? log.previousKm : (log.previousHourMeterOrKm && log.previousHourMeterOrKm > 5000 ? log.previousHourMeterOrKm : undefined);

    if (currKm !== undefined && prevKm !== undefined && currKm > prevKm && log.liters > 0) {
      const deltaKm = currKm - prevKm;
      totalKmDelta += deltaKm;
      kmLitersSum += log.liters;
    } else if (log.averageKmPerLiter && log.averageKmPerLiter > 0) {
      // If manually calculated per record
      totalKmDelta += (log.averageKmPerLiter * log.liters);
      kmLitersSum += log.liters;
    }

    // 2. Calculate Hours consumption (L/h) if delta is valid
    const currH = log.currentHourMeter !== undefined ? log.currentHourMeter : (log.currentHourMeterOrKm <= 50000 ? log.currentHourMeterOrKm : undefined);
    const prevH = log.previousHourMeter !== undefined ? log.previousHourMeter : (log.previousHourMeterOrKm && log.previousHourMeterOrKm <= 50000 ? log.previousHourMeterOrKm : undefined);

    if (currH !== undefined && prevH !== undefined && currH > prevH && log.liters > 0) {
      const deltaH = currH - prevH;
      totalHourDelta += deltaH;
      hourLitersSum += log.liters;
    } else if (log.averageLitersPerHour && log.averageLitersPerHour > 0) {
      totalHourDelta += (log.liters / log.averageLitersPerHour);
      hourLitersSum += log.liters;
    }
  }

  const avgKmPerLiter = kmLitersSum > 0 && totalKmDelta > 0 
    ? parseFloat((totalKmDelta / kmLitersSum).toFixed(2)) 
    : null;

  const avgLitersPerHour = totalHourDelta > 0 && hourLitersSum > 0 
    ? parseFloat((hourLitersSum / totalHourDelta).toFixed(2)) 
    : null;

  const avgFuelPricePerLiter = totalLiters > 0 
    ? parseFloat((totalFuelCost / totalLiters).toFixed(2)) 
    : null;

  const avgCostPerKm = totalKmDelta > 0 && totalFuelCost > 0 
    ? parseFloat(((kmLitersSum > 0 && totalLiters > 0 ? (totalFuelCost * (kmLitersSum / totalLiters)) : totalFuelCost) / totalKmDelta).toFixed(2))
    : (avgKmPerLiter && avgFuelPricePerLiter ? parseFloat((avgFuelPricePerLiter / avgKmPerLiter).toFixed(2)) : null);

  const avgCostPerHour = totalHourDelta > 0 && totalFuelCost > 0 
    ? parseFloat(((hourLitersSum > 0 && totalLiters > 0 ? (totalFuelCost * (hourLitersSum / totalLiters)) : totalFuelCost) / totalHourDelta).toFixed(2))
    : (avgLitersPerHour && avgFuelPricePerLiter ? parseFloat((avgLitersPerHour * avgFuelPricePerLiter).toFixed(2)) : null);

  return {
    totalLiters,
    totalFuelCost,
    fuelLogsCount: vehicleLogs.length,
    avgKmPerLiter,
    avgLitersPerHour,
    avgCostPerKm,
    avgCostPerHour,
    totalKmDriven: totalKmDelta > 0 ? parseFloat(totalKmDelta.toFixed(1)) : 0,
    totalHoursWorked: totalHourDelta > 0 ? parseFloat(totalHourDelta.toFixed(1)) : 0,
    avgFuelPricePerLiter,
    lastHourMeter,
    lastKm,
  };
}

/**
 * Updates a vehicle object with the freshly calculated averages from fuel supply logs.
 */
export function updateVehicleWithCalculatedMetrics(
  vehicle: Machinery,
  fuelLogs: FuelLog[]
): Machinery {
  const metrics = calculateVehicleConsumptionMetrics(vehicle.id, fuelLogs);

  return {
    ...vehicle,
    averageConsumptionKmPerLiter: metrics.avgKmPerLiter !== null ? metrics.avgKmPerLiter : vehicle.averageConsumptionKmPerLiter,
    averageConsumptionLitersPerHour: metrics.avgLitersPerHour !== null ? metrics.avgLitersPerHour : vehicle.averageConsumptionLitersPerHour,
    hourMeter: metrics.lastHourMeter !== undefined && metrics.lastHourMeter > (vehicle.hourMeter || 0) 
      ? metrics.lastHourMeter 
      : vehicle.hourMeter,
    currentKm: metrics.lastKm !== undefined && metrics.lastKm > (vehicle.currentKm || 0)
      ? metrics.lastKm
      : vehicle.currentKm,
  };
}
