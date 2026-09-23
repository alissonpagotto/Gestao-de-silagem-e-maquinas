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
  const isFirstRecord = Boolean(input.isFirstRecord || anterior === 0);

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
  // Se for primeiro registro e o nível inicial histórico for desconhecido (ou nulo), o Nível Atual parte de 0L.
  // Caso contrário, parte da premissa de tanque cheio (capacidade do tanque) do início do ciclo.
  let nivelAnterior = isFirstRecord ? 0 : capacidadeTanque;
  if (input.nivelAnterior !== undefined && input.nivelAnterior !== null && !isNaN(Number(input.nivelAnterior))) {
    nivelAnterior = Math.max(0, Math.min(capacidadeTanque, Number(input.nivelAnterior)));
  }

  // 2. Atualizar o volume estimado do tanque: nivel_atual = nivel_anterior - combustivel_gasto
  // Se for o primeiro registro sem histórico, nivelAtual = nivelAnterior (0 L)
  const nivelAtual = isFirstRecord
    ? nivelAnterior
    : Math.max(0, parseFloat((nivelAnterior - combustivelGasto).toFixed(2)));

  const nivelAtualPorcentagem = capacidadeTanque > 0 
    ? Math.max(0, Math.min(100, parseFloat(((nivelAtual / capacidadeTanque) * 100).toFixed(1))))
    : 0;

  // 3. Cálculo de Abastecimento: novo_nivel = nivel_atual + litros_abastecidos
  // No primeiro registro, se nivelAtual é 0, a Projeção reflete puramente os litros abastecidos
  const novoNivelBruto = parseFloat((nivelAtual + litrosAbastecidos).toFixed(2));
  
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
