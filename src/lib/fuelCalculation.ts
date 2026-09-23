/**
 * fuelCalculation.ts
 * Motor de Cálculo de Consumo de Combustível e Nível de Tanque em Tempo Real
 * 
 * Regras de Negócio:
 * 1. CÁLCULO DE CONSUMO (Ao digitar Km ou Horímetro Atual):
 *    - distancia_ou_tempo = horimetro_km_atual - horimetro_km_anterior
 *    - combustivel_gasto = distancia_ou_tempo / media_consumo (se Km/l)
 *      OU combustivel_gasto = distancia_ou_tempo * media_consumo (se L/h)
 *    - nivel_atual = nivel_anterior - combustivel_gasto (piso em 0)
 * 
 * 2. CÁLCULO DE ABASTECIMENTO (Ao inserir Litros):
 *    - novo_nivel = nivel_atual + litros_abastecidos
 *    - novo_nivel nunca pode ultrapassar a capacidade_tanque (clamp)
 */

export type FuelConsumptionMode = 'km_l' | 'l_h';

export interface FuelCalculationInput {
  capacidadeTanque: number;
  mediaConsumo: number;
  tipoConsumo: FuelConsumptionMode;
  horimetroKmAnterior: number;
  horimetroKmAtual: number;
  litrosAbastecidos: number;
  nivelAnterior?: number; // Volume que estava no tanque antes do ciclo (L)
  isFirstRecord?: boolean; // Flag para identificar primeiro registro de abastecimento
}

export interface FuelCalculationResult {
  capacidadeTanque: number;
  tipoConsumo: FuelConsumptionMode;
  mediaConsumo: number;
  
  // Delta medido
  horimetroKmAnterior: number;
  horimetroKmAtual: number;
  distanciaOuTempo: number; // Km rodados ou Horas trabalhadas
  
  // Consumo no ciclo
  combustivelGasto: number; // Litros consumidos
  
  // Níveis do tanque (Litros e Porcentagem)
  nivelAnterior: number; // Volume inicial antes do consumo
  nivelAtual: number; // Volume no tanque após o consumo (antes do abastecimento)
  nivelAtualPorcentagem: number;
  
  litrosAbastecidos: number;
  adicionadoPorcentagem: number;
  
  novoNivelBruto: number; // nivelAtual + litrosAbastecidos sem corte
  novoNivel: number; // Clamp: Math.min(capacidadeTanque, novoNivelBruto)
  novoNivelPorcentagem: number;
  
  // Alertas e diagnósticos
  isOverflowing: boolean; // Se ultrapassou a capacidade do tanque
  excessoLitros: number;
  isReserve: boolean; // Se o nível atual ficou abaixo de 20%
  isFirstRecord?: boolean; // Flag para primeiro abastecimento
}

/**
 * Calcula a distância ou tempo percorrido e o volume de combustível gasto.
 */
export function calculateFuelConsumption(
  horimetroKmAnterior: number,
  horimetroKmAtual: number,
  mediaConsumo: number,
  tipoConsumo: FuelConsumptionMode
): { distanciaOuTempo: number; combustivelGasto: number } {
  const anterior = Number(horimetroKmAnterior) || 0;
  const atual = Number(horimetroKmAtual) || 0;
  const media = Number(mediaConsumo) || 0;

  if (atual <= anterior || media <= 0) {
    return { distanciaOuTempo: 0, combustivelGasto: 0 };
  }

  const distanciaOuTempo = parseFloat((atual - anterior).toFixed(2));

  let combustivelGasto = 0;
  if (tipoConsumo === 'km_l') {
    // Para veículos rodoviários: km rodados ÷ (km/l) = litros gastos
    combustivelGasto = parseFloat((distanciaOuTempo / media).toFixed(2));
  } else {
    // Para tratores / máquinas agrícolas: horas de motor × (litros/hora) = litros gastos
    combustivelGasto = parseFloat((distanciaOuTempo * media).toFixed(2));
  }

  return { distanciaOuTempo, combustivelGasto };
}

/**
 * Executa o cálculo completo do ciclo de combustível e telemetria do tanque.
 */
export function calculateTankLevelMetrics(input: FuelCalculationInput): FuelCalculationResult {
  const capacidadeTanque = Math.max(0, Number(input.capacidadeTanque) || 0);
  const mediaConsumo = Math.max(0, Number(input.mediaConsumo) || 0);
  const tipoConsumo = input.tipoConsumo;
  const anterior = Math.max(0, Number(input.horimetroKmAnterior) || 0);
  const atual = Math.max(0, Number(input.horimetroKmAtual) || 0);
  const litrosAbastecidos = Math.max(0, Number(input.litrosAbastecidos) || 0);
  const isFirstRecord = input.isFirstRecord !== undefined
    ? Boolean(input.isFirstRecord)
    : Boolean(anterior === 0);

  // 1. Cálculo de Consumo (se for primeiro registro, consumo é zero)
  const { distanciaOuTempo, combustivelGasto } = isFirstRecord
    ? { distanciaOuTempo: 0, combustivelGasto: 0 }
    : calculateFuelConsumption(
        anterior,
        atual,
        mediaConsumo,
        tipoConsumo
      );

  // Determina o volume inicial do ciclo (nivel_anterior):
  // Se for primeiro registro, o Nível Atual inicial DEVE obrigatoriamente começar em 0 L.
  // Caso contrário, parte da premissa de tanque cheio (capacidade do tanque) ou histórico do ciclo anterior.
  let nivelAnterior = isFirstRecord ? 0 : capacidadeTanque;
  if (!isFirstRecord && input.nivelAnterior !== undefined && input.nivelAnterior !== null && !isNaN(Number(input.nivelAnterior))) {
    nivelAnterior = Math.max(0, Math.min(capacidadeTanque, Number(input.nivelAnterior)));
  }

  // 2. Atualizar o volume estimado do tanque: nivel_atual = nivel_anterior - combustivel_gasto
  // Se for o primeiro registro, nivelAtual é obrigatoriamente 0 L
  const nivelAtual = isFirstRecord
    ? 0
    : Math.max(0, parseFloat((nivelAnterior - combustivelGasto).toFixed(2)));

  const nivelAtualPorcentagem = capacidadeTanque > 0 
    ? Math.max(0, Math.min(100, parseFloat(((nivelAtual / capacidadeTanque) * 100).toFixed(1))))
    : 0;

  // 3. Cálculo de Abastecimento: novo_nivel = nivel_atual + litros_abastecidos
  // No primeiro registro, Projeção = Litros Abastecidos (parte de 0L)
  const novoNivelBruto = isFirstRecord
    ? litrosAbastecidos
    : parseFloat((nivelAtual + litrosAbastecidos).toFixed(2));
  
  // O novo_nivel nunca pode ultrapassar a capacidade_tanque
  const novoNivel = capacidadeTanque > 0
    ? Math.min(capacidadeTanque, novoNivelBruto)
    : novoNivelBruto;

  const novoNivelPorcentagem = capacidadeTanque > 0
    ? Math.max(0, Math.min(100, parseFloat(((novoNivel / capacidadeTanque) * 100).toFixed(1))))
    : 0;

  const adicionadoPorcentagem = capacidadeTanque > 0 && litrosAbastecidos > 0
    ? parseFloat(((litrosAbastecidos / capacidadeTanque) * 100).toFixed(1))
    : 0;

  // Só acusa excesso se os litros abastecidos ultrapassarem a capacidade do tanque
  const isOverflowing = capacidadeTanque > 0 && novoNivelBruto > capacidadeTanque;
  const excessoLitros = isOverflowing ? parseFloat((novoNivelBruto - capacidadeTanque).toFixed(2)) : 0;
  const isReserve = !isFirstRecord && capacidadeTanque > 0 && (nivelAtual / capacidadeTanque) <= 0.20;

  return {
    capacidadeTanque,
    tipoConsumo,
    mediaConsumo,
    horimetroKmAnterior: anterior,
    horimetroKmAtual: atual,
    distanciaOuTempo,
    combustivelGasto,
    nivelAnterior,
    nivelAtual,
    nivelAtualPorcentagem,
    litrosAbastecidos,
    adicionadoPorcentagem,
    novoNivelBruto,
    novoNivel,
    novoNivelPorcentagem,
    isOverflowing,
    excessoLitros,
    isReserve,
    isFirstRecord,
  };
}

/**
 * Retorna as configurações de cor e tema visual com base na porcentagem de combustível.
 */
export function getTankColorTheme(percentage: number, isOverflowing = false) {
  if (isOverflowing) {
    return {
      gradient: 'from-rose-500 via-rose-600 to-rose-700',
      waveFront: 'fill-rose-500',
      waveBack: 'fill-rose-700',
      border: 'border-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      statusText: 'Transbordo / Capacidade Excedida',
      glow: 'shadow-[inset_0_2px_10px_rgba(244,63,94,0.8),inset_0_-8px_20px_rgba(159,18,57,0.6)]',
    };
  }

  if (percentage <= 20) {
    return {
      gradient: 'from-rose-500 via-rose-600 to-rose-700',
      waveFront: 'fill-rose-500',
      waveBack: 'fill-rose-700',
      border: 'border-rose-400',
      text: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
      statusText: 'Reserva Crítica',
      glow: 'shadow-[inset_0_2px_10px_rgba(244,63,94,0.7),inset_0_-8px_20px_rgba(190,18,60,0.5)]',
    };
  }

  if (percentage < 50) {
    return {
      gradient: 'from-amber-400 via-amber-500 to-amber-600',
      waveFront: 'fill-amber-400',
      waveBack: 'fill-amber-600',
      border: 'border-amber-400',
      text: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      statusText: 'Nível Regular',
      glow: 'shadow-[inset_0_2px_10px_rgba(251,191,36,0.8),inset_0_-8px_20px_rgba(180,83,9,0.5)]',
    };
  }

  if (percentage < 85) {
    return {
      gradient: 'from-yellow-400 via-amber-400 to-yellow-500',
      waveFront: 'fill-yellow-400',
      waveBack: 'fill-amber-500',
      border: 'border-yellow-400',
      text: 'text-yellow-600 dark:text-yellow-400',
      badgeBg: 'bg-yellow-100/80 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800',
      statusText: 'Nível Operacional Seguro',
      glow: 'shadow-[inset_0_2px_10px_rgba(250,204,21,0.8),inset_0_-8px_20px_rgba(202,138,4,0.5)]',
    };
  }

  return {
    gradient: 'from-emerald-400 via-emerald-500 to-teal-600',
    waveFront: 'fill-emerald-400',
    waveBack: 'fill-emerald-600',
    border: 'border-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    statusText: 'Tanque Completo',
    glow: 'shadow-[inset_0_2px_10px_rgba(52,211,153,0.8),inset_0_-8px_20px_rgba(5,150,105,0.5)]',
  };
}

/**
 * Localiza o veículo/máquina correspondente a partir do registro de combustível,
 * cruzando por ID, placa ou nome do maquinário.
 */
export function findVehicleForLog(log: any, machineries: any[] = []): any | null {
  if (!log || !machineries || !machineries.length) return null;
  if (log.machineryId) {
    const byId = machineries.find(m => m.id === log.machineryId);
    if (byId) return byId;
  }
  const search = String(log.machineryPlateOrName || log.vehicleName || log.vehiclePlate || '').toLowerCase().trim();
  if (!search) return null;
  const cleanSearch = search.replace(/[^a-z0-9]/gi, '');

  return machineries.find(m => {
    if (m.id && search === m.id.toLowerCase()) return true;
    const plate = String(m.licensePlateOrSerial || m.plate || m.plateOrSerial || '').toLowerCase().trim();
    const cleanPlate = plate.replace(/[^a-z0-9]/gi, '');
    if (plate && (search.includes(plate) || (cleanPlate && cleanSearch.includes(cleanPlate)))) return true;
    const name = String(m.name || m.nome || '').toLowerCase().trim();
    if (name && (search.includes(name) || (name.length > 3 && cleanSearch.includes(name.replace(/[^a-z0-9]/gi, ''))))) return true;
    const model = String(m.model || m.modelo || '').toLowerCase().trim();
    if (model && (search.includes(model) || (model.length > 3 && cleanSearch.includes(model.replace(/[^a-z0-9]/gi, ''))))) return true;
    return false;
  }) || null;
}

/**
 * Identifica se um veículo é Máquina Agrícola / Trator (opera por Horas - L/h)
 * ou se é Veículo Rodoviário (opera por KM - km/L).
 * 
 * Regra:
 * - Se veículo controla_por === 'horas' ou veiculo.tipo === 'maquina' -> L/h (true)
 * - Se veículo controla_por === 'km' ou veiculo.tipo === 'caminhao' / 'carro' -> km/L (false)
 */
export function isVehicleHoursControlled(
  vehicle?: any | null,
  logOrName?: any | string
): boolean {
  // 1. Validação prioritária por propriedade explícita: controla_por / controlBy
  const controlaPor = String(vehicle?.controla_por || vehicle?.controlBy || vehicle?.medidor_tipo || '').toLowerCase();
  if (controlaPor === 'horas' || controlaPor === 'horimetro' || controlaPor === 'hourmeter') {
    return true;
  }
  if (controlaPor === 'km' || controlaPor === 'quilometragem' || controlaPor === 'odometro') {
    return false;
  }

  // 2. Validação explícita por tipo de veículo (veiculo.tipo === 'maquina', 'trator', etc.)
  const tipo = String(vehicle?.tipo || vehicle?.type || vehicle?.categoryType || '').toLowerCase();
  if (
    tipo === 'maquina' || 
    tipo === 'máquina' || 
    tipo === 'trator' || 
    tipo === 'forrageira' || 
    tipo === 'ensiladeira' || 
    tipo === 'colhedora' || 
    tipo === 'colheitadeira' || 
    tipo === 'implemento' ||
    tipo.includes('trator') ||
    tipo.includes('maquina') ||
    tipo.includes('máquina') ||
    tipo.includes('ensilad') ||
    tipo.includes('forrageir') ||
    tipo.includes('colheit')
  ) {
    return true;
  }

  if (
    tipo === 'caminhao' || 
    tipo === 'caminhão' || 
    tipo === 'carro' || 
    tipo === 'veiculo' || 
    tipo === 'veículo' || 
    tipo === 'utilitario' || 
    tipo === 'utilitário' || 
    tipo === 'cavalo' || 
    tipo === 'onibus' || 
    tipo === 'ônibus' || 
    tipo === 'van' || 
    tipo === 'pickup' ||
    tipo.includes('caminh') ||
    tipo.includes('carro') ||
    tipo.includes('utilit')
  ) {
    return false;
  }

  // 3. Validação por Modelo ou Nome da Máquina / Veículo
  const modelName = String(vehicle?.model || vehicle?.modelo || vehicle?.name || vehicle?.nome || '').toLowerCase();
  if (
    modelName.includes('maq') ||
    modelName.includes('claas') ||
    modelName.includes('jaguar') ||
    modelName.includes('trator') ||
    modelName.includes('colheitadeira') ||
    modelName.includes('ensiladeira') ||
    modelName.includes('retroescavadeira') ||
    modelName.includes('carregadeira') ||
    modelName.includes('valtra') ||
    modelName.includes('massey') ||
    modelName.includes('case ih')
  ) {
    return true;
  }

  if (
    modelName.includes('caminh') ||
    modelName.includes('1944') ||
    modelName.includes('mercedes') ||
    modelName.includes('scania') ||
    modelName.includes('volvo') ||
    modelName.includes('iveco') ||
    modelName.includes('vw') ||
    modelName.includes('constellation') ||
    modelName.includes('strada') ||
    modelName.includes('saveiro') ||
    modelName.includes('hilux') ||
    modelName.includes('s10') ||
    modelName.includes('f-4000')
  ) {
    return false;
  }

  // 4. Identificação pelo texto do Registro / Placa
  const textToCheck = typeof logOrName === 'string'
    ? logOrName.toLowerCase()
    : String(logOrName?.machineryPlateOrName || logOrName?.vehicleName || '').toLowerCase();

  if (
    textToCheck.includes('maq') ||
    textToCheck.includes('claas') ||
    textToCheck.includes('jaguar') ||
    textToCheck.includes('trator') ||
    textToCheck.includes('colheit') ||
    textToCheck.includes('ensilad') ||
    textToCheck.includes('forrageir') ||
    textToCheck.includes('retro')
  ) {
    return true;
  }

  if (
    textToCheck.includes('caminh') ||
    textToCheck.includes('1944') ||
    textToCheck.includes('mercedes') ||
    textToCheck.includes('scania') ||
    textToCheck.includes('volvo') ||
    textToCheck.includes('iveco') ||
    textToCheck.includes('strada') ||
    textToCheck.includes('saveiro') ||
    textToCheck.includes('hilux') ||
    textToCheck.includes('s10') ||
    textToCheck.includes('acm')
  ) {
    return false;
  }

  // 5. Placas padrão Brasil / Mercosul (ex: ACM-5108, ACM5I08, ABC1234) indicam veículo rodoviário
  const platePattern = /[a-z]{3}-?[0-9][0-9a-z][0-9]{2}/i;
  if (platePattern.test(textToCheck)) {
    return false;
  }

  // 6. Odômetro elevado (> 25.000) é característico de KM rodoviário
  const reading = Number(typeof logOrName === 'object' ? (logOrName?.currentHourMeterOrKm || logOrName?.currentKm) : 0);
  if (reading > 25000) {
    return false;
  }

  // 7. Validação por campos numéricos do Log
  if (typeof logOrName === 'object' && logOrName !== null) {
    if (logOrName.averageKmPerLiter || logOrName.media_kml) return false;
    if (logOrName.averageLitersPerHour || logOrName.media_lh) return true;
    if (logOrName.currentKm && !logOrName.currentHourMeter) return false;
    if (logOrName.currentHourMeter && !logOrName.currentKm && reading <= 25000) return true;
  }

  // Padrão: Veículos Rodoviários (Caminhões, Carros) operam em KM
  return false;
}

// Alias para compatibilidade
export const isMachineOrTractor = isVehicleHoursControlled;

export interface DualFuelEfficiencyDisplay {
  kmPerLiter: FuelEfficiencyDisplay | null;
  litersPerHour: FuelEfficiencyDisplay | null;
  hasBoth: boolean;
}

export interface DualFuelReadingDisplay {
  km: number | null;
  kmFormatted: string | null;
  hours: number | null;
  hoursFormatted: string | null;
  hasBoth: boolean;
}

/**
 * Retorna as leituras mecânicas formatadas de um registro de abastecimento,
 * suportando KM, Horas ou AMBOS simultaneamente (controle misto, ex: FORD CARGO 2628).
 */
export function getFuelLogReadings(
  log: any,
  vehicle?: any | null
): DualFuelReadingDisplay {
  if (!log) {
    return { km: null, kmFormatted: null, hours: null, hoursFormatted: null, hasBoth: false };
  }

  // 1. Extração de KM Atual
  let kmVal: number | null = null;
  const rawKm = log.currentKm ?? (log as any).km_atual ?? (log as any).kmAtual;
  if (rawKm !== undefined && rawKm !== null && rawKm !== '') {
    const parsed = Number(rawKm);
    if (!isNaN(parsed) && parsed > 0) kmVal = parsed;
  }

  // 2. Extração de Horas Atual
  let hoursVal: number | null = null;
  const rawHours = log.currentHourMeter ?? (log as any).horas_atual ?? (log as any).horasAtual ?? (log as any).horimetro_atual;
  if (rawHours !== undefined && rawHours !== null && rawHours !== '') {
    const parsed = Number(rawHours);
    if (!isNaN(parsed) && parsed > 0) hoursVal = parsed;
  }

  // 3. Fallback inteligente para currentHourMeterOrKm se os campos específicos não foram preenchidos
  const fallbackVal = Number(log.currentHourMeterOrKm);
  if (!isNaN(fallbackVal) && fallbackVal > 0) {
    if (kmVal === null && hoursVal === null) {
      const isHours = vehicle?.controla_por
        ? (vehicle.controla_por.toLowerCase() === 'horas')
        : isVehicleHoursControlled(vehicle, log);
      if (isHours) {
        hoursVal = fallbackVal;
      } else {
        kmVal = fallbackVal;
      }
    }
  }

  return {
    km: kmVal,
    kmFormatted: kmVal !== null ? `${kmVal.toLocaleString('pt-BR')} km` : null,
    hours: hoursVal,
    hoursFormatted: hoursVal !== null ? `${hoursVal.toLocaleString('pt-BR')} h` : null,
    hasBoth: kmVal !== null && hoursVal !== null,
  };
}

/**
 * Calcula e formata individualmente as médias de consumo do abastecimento:
 * - KM: km/L (se houver KM e litros)
 * - Horas: L/h (se houver horas e litros)
 * Permite renderização empilhada simultânea quando o veículo opera em controle misto.
 */
export function formatDualFuelLogEfficiency(
  log: any,
  vehicle?: any | null
): DualFuelEfficiencyDisplay {
  if (!log) {
    return { kmPerLiter: null, litersPerHour: null, hasBoth: false };
  }

  const liters = Number(log.liters) || 0;

  // --- CÁLCULO KM/L ---
  let kmEff: FuelEfficiencyDisplay | null = null;
  const directKml = Number(log.media_kml ?? log.media_km_l ?? log.averageKmPerLiter);
  if (!isNaN(directKml) && directKml > 0) {
    const fixed = parseFloat(directKml.toFixed(2));
    kmEff = {
      value: fixed,
      formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`,
      unit: 'km/L',
    };
  } else {
    const currK = Number(log.currentKm ?? (log as any).km_atual);
    const prevK = Number(log.previousKm ?? (log as any).km_anterior);
    if (!isNaN(currK) && !isNaN(prevK) && currK > prevK && liters > 0) {
      const diffKm = currK - prevK;
      const calcKml = diffKm / liters;
      const fixed = parseFloat(calcKml.toFixed(2));
      kmEff = {
        value: fixed,
        formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`,
        unit: 'km/L',
      };
    } else {
      // Fallback: se não for máquina pura e houver averageCalculated
      const isPureHours = vehicle?.controla_por?.toLowerCase() === 'horas';
      if (!isPureHours) {
        const avgCalc = Number(log.averageCalculated);
        if (!isNaN(avgCalc) && avgCalc > 0 && !log.currentHourMeter && !log.media_lh) {
          const fixed = parseFloat(avgCalc.toFixed(2));
          kmEff = {
            value: fixed,
            formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`,
            unit: 'km/L',
          };
        }
      }
    }
  }

  // --- CÁLCULO L/h ---
  let lhEff: FuelEfficiencyDisplay | null = null;
  const directLh = Number(log.media_lh ?? log.media_l_h ?? log.averageLitersPerHour);
  if (!isNaN(directLh) && directLh > 0) {
    const fixed = parseFloat(directLh.toFixed(2));
    lhEff = {
      value: fixed,
      formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L/h`,
      unit: 'L/h',
    };
  } else {
    const currH = Number(log.currentHourMeter ?? (log as any).horas_atual);
    const prevH = Number(log.previousHourMeter ?? (log as any).horas_anterior);
    if (!isNaN(currH) && !isNaN(prevH) && currH > prevH && liters > 0) {
      const diffHours = currH - prevH;
      const calcLh = liters / diffHours;
      const fixed = parseFloat(calcLh.toFixed(2));
      lhEff = {
        value: fixed,
        formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L/h`,
        unit: 'L/h',
      };
    } else {
      // Fallback: se veículo ou registro for máquina e houver averageCalculated
      const isHoursControlled = isVehicleHoursControlled(vehicle, log);
      if (isHoursControlled && !kmEff) {
        const avgCalc = Number(log.averageCalculated);
        if (!isNaN(avgCalc) && avgCalc > 0) {
          const fixed = parseFloat(avgCalc.toFixed(2));
          lhEff = {
            value: fixed,
            formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L/h`,
            unit: 'L/h',
          };
        }
      }
    }
  }

  // Se nenhum dos dois específicos foi encontrado, tenta fallback padrão do formatFuelLogEfficiency
  if (!kmEff && !lhEff) {
    const standardEff = formatFuelLogEfficiency(log, vehicle);
    if (standardEff) {
      if (standardEff.unit === 'km/L') {
        kmEff = standardEff;
      } else {
        lhEff = standardEff;
      }
    }
  }

  return {
    kmPerLiter: kmEff,
    litersPerHour: lhEff,
    hasBoth: kmEff !== null && lhEff !== null,
  };
}

/**
 * Calcula e formata com precisão a média de consumo do abastecimento:
 * - Para Veículos Rodoviários (Caminhões, Carros): Exibir a média em "km/L" (Ex: 8,75 km/L)
 * - Para Máquinas Agrícolas / Tratores (Horímetro): Exibir a média em "L/h" (Ex: 14,34 L/h)
 */
export function formatFuelLogEfficiency(
  log: any,
  vehicle?: any | null
): FuelEfficiencyDisplay | null {
  if (!log) return null;

  const isHours = isVehicleHoursControlled(vehicle, log);
  const liters = Number(log.liters) || 0;

  if (isHours) {
    // 🚜 MÁQUINAS AGRÍCOLAS / TRATORES: Média em L/h
    // 1. Média já calculada especificamente em L/h
    const directLh = Number(log.media_lh ?? log.media_l_h ?? log.averageLitersPerHour);
    if (!isNaN(directLh) && directLh > 0) {
      const fixed = parseFloat(directLh.toFixed(2));
      return {
        value: fixed,
        formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L/h`,
        unit: 'L/h'
      };
    }

    // 2. Cálculo matemático estrito: Litros / Diferença de Horas
    const currH = Number(log.currentHourMeter ?? log.currentHourMeterOrKm);
    const prevH = Number(log.previousHourMeter ?? log.previousHourMeterOrKm);
    if (!isNaN(currH) && !isNaN(prevH) && currH > prevH && liters > 0) {
      const diffHours = currH - prevH;
      const calcLh = liters / diffHours;
      const fixed = parseFloat(calcLh.toFixed(2));
      return {
        value: fixed,
        formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L/h`,
        unit: 'L/h'
      };
    }

    // 3. Fallback do campo genérico averageCalculated para máquina
    const avgCalc = Number(log.averageCalculated);
    if (!isNaN(avgCalc) && avgCalc > 0) {
      const fixed = parseFloat(avgCalc.toFixed(2));
      return {
        value: fixed,
        formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L/h`,
        unit: 'L/h'
      };
    }

    return null;
  } else {
    // 🚚 VEÍCULOS RODOVIÁRIOS (CAMINHÕES, CARROS): Média em km/L
    // 1. Média já calculada especificamente em km/L
    const directKml = Number(log.media_kml ?? log.media_km_l ?? log.averageKmPerLiter);
    if (!isNaN(directKml) && directKml > 0) {
      const fixed = parseFloat(directKml.toFixed(2));
      return {
        value: fixed,
        formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`,
        unit: 'km/L'
      };
    }

    // 2. Cálculo matemático estrito: Diferença de KM / Litros
    const currK = Number(log.currentKm ?? log.currentHourMeterOrKm);
    const prevK = Number(log.previousKm ?? log.previousHourMeterOrKm);
    if (!isNaN(currK) && !isNaN(prevK) && currK > prevK && liters > 0) {
      const diffKm = currK - prevK;
      const calcKml = diffKm / liters;
      const fixed = parseFloat(calcKml.toFixed(2));
      return {
        value: fixed,
        formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`,
        unit: 'km/L'
      };
    }

    // 3. Fallback do campo genérico averageCalculated para veículo rodoviário
    // Se o log gravou a média no campo genérico averageCalculated ou até mesmo em averageLitersPerHour
    const avgCalc = Number(log.averageCalculated ?? log.averageLitersPerHour);
    if (!isNaN(avgCalc) && avgCalc > 0) {
      const fixed = parseFloat(avgCalc.toFixed(2));
      return {
        value: fixed,
        formatted: `${fixed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`,
        unit: 'km/L'
      };
    }

    return null;
  }
}
