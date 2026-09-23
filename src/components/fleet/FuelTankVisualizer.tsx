import React, { useMemo } from 'react';
import { AlertCircle, Droplets, Fuel, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Machinery } from '../../types';

interface FuelTankVisualizerProps {
  machinery?: Machinery | null;
  addedLitersInput: string;
  currentHourMeterInput?: string;
  previousHourMeterInput?: string;
  currentKmInput?: string;
  previousKmInput?: string;
  liveLitersPerHour?: number | null;
  liveKmPerLiter?: number | null;
  historicalAvgLitersPerHour?: number | null;
  historicalAvgKmPerLiter?: number | null;
}

export const FuelTankVisualizer: React.FC<FuelTankVisualizerProps> = ({
  machinery,
  addedLitersInput,
  currentHourMeterInput,
  previousHourMeterInput,
  currentKmInput,
  previousKmInput,
  liveLitersPerHour,
  liveKmPerLiter,
  historicalAvgLitersPerHour,
  historicalAvgKmPerLiter,
}) => {
  // 1. Capacidade Total do Tanque
  const tankCapacity = useMemo(() => {
    if (!machinery) return 0;
    const cap = (machinery as any).tank_capacity ?? (machinery as any).tankCapacity ?? machinery.fuelCapacityLiters;
    const num = Number(cap);
    return !isNaN(num) && num > 0 ? num : 0;
  }, [machinery]);

  // 2. Litros adicionados digitados pelo usuário
  const addedLiters = useMemo(() => {
    const parsed = parseFloat(addedLitersInput);
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  }, [addedLitersInput]);

  // 3. Deltas de Horímetro (Horas) e Odômetro (KM)
  const deltaHours = useMemo(() => {
    const c = parseFloat(currentHourMeterInput || '');
    const p = parseFloat(previousHourMeterInput || '');
    return !isNaN(c) && !isNaN(p) && c > p ? (c - p) : 0;
  }, [currentHourMeterInput, previousHourMeterInput]);

  const deltaKm = useMemo(() => {
    const c = parseFloat(currentKmInput || '');
    const p = parseFloat(previousKmInput || '');
    return !isNaN(c) && !isNaN(p) && c > p ? (c - p) : 0;
  }, [currentKmInput, previousKmInput]);

  // 4. Médias de Consumo Eficazes (L/h ou km/L)
  const effectiveLitersPerHour = useMemo(() => {
    if (liveLitersPerHour && liveLitersPerHour > 0) return liveLitersPerHour;
    if (machinery?.averageConsumptionLitersPerHour && machinery.averageConsumptionLitersPerHour > 0) {
      return machinery.averageConsumptionLitersPerHour;
    }
    if (historicalAvgLitersPerHour && historicalAvgLitersPerHour > 0) {
      return historicalAvgLitersPerHour;
    }
    if (deltaHours > 0 && addedLiters > 0) {
      return addedLiters / deltaHours;
    }
    return null;
  }, [liveLitersPerHour, machinery, historicalAvgLitersPerHour, deltaHours, addedLiters]);

  const effectiveKmPerLiter = useMemo(() => {
    if (liveKmPerLiter && liveKmPerLiter > 0) return liveKmPerLiter;
    if (machinery?.averageConsumptionKmPerLiter && machinery.averageConsumptionKmPerLiter > 0) {
      return machinery.averageConsumptionKmPerLiter;
    }
    if (historicalAvgKmPerLiter && historicalAvgKmPerLiter > 0) {
      return historicalAvgKmPerLiter;
    }
    if (deltaKm > 0 && addedLiters > 0) {
      return deltaKm / addedLiters;
    }
    return null;
  }, [liveKmPerLiter, machinery, historicalAvgKmPerLiter, deltaKm, addedLiters]);

  // PASSO 1: Cálculo do Combustível Consumido
  const consumedData = useMemo(() => {
    if (deltaHours > 0 && effectiveLitersPerHour && effectiveLitersPerHour > 0) {
      const consumed = deltaHours * effectiveLitersPerHour;
      return {
        consumedLiters: consumed,
        mode: 'hours' as const,
        delta: deltaHours,
        rate: effectiveLitersPerHour,
      };
    }
    if (deltaKm > 0 && effectiveKmPerLiter && effectiveKmPerLiter > 0) {
      const consumed = deltaKm / effectiveKmPerLiter;
      return {
        consumedLiters: consumed,
        mode: 'km' as const,
        delta: deltaKm,
        rate: effectiveKmPerLiter,
      };
    }
    return {
      consumedLiters: 0,
      mode: 'none' as const,
      delta: 0,
      rate: 0,
    };
  }, [deltaHours, effectiveLitersPerHour, deltaKm, effectiveKmPerLiter]);

  // PASSO 2: Subtrair o consumo do volume inicial do ciclo para achar o "NÍVEL ATUAL" real (o que sobrou)
  const { initialLiters, initialPercentage } = useMemo(() => {
    if (tankCapacity <= 0) return { initialLiters: 0, initialPercentage: 0 };

    // Ponto de partida do ciclo: o veículo partiu com tanque cheio (capacidade do tanque)
    const baseCycleVolume = tankCapacity;

    if (consumedData.consumedLiters > 0) {
      const remaining = Math.max(0, baseCycleVolume - consumedData.consumedLiters);
      const remainingPercentage = (remaining / tankCapacity) * 100;
      return {
        initialLiters: remaining,
        initialPercentage: remainingPercentage,
      };
    }

    // Se o usuário já preencheu os litros abastecidos mas não há horímetro ou delta = 0,
    // estima o nível residual para não inflar artificialmente acima de 100% se coube no tanque:
    if (addedLiters > 0 && addedLiters <= tankCapacity) {
      const remaining = Math.max(0, tankCapacity - addedLiters);
      return {
        initialLiters: remaining,
        initialPercentage: (remaining / tankCapacity) * 100,
      };
    }

    // Fallback: se houver currentFuelPercentage registrado no veículo
    const curr = machinery?.currentFuelPercentage;
    if (curr !== undefined && curr !== null && !isNaN(Number(curr))) {
      const p = Math.max(0, Math.min(100, Number(curr)));
      return {
        initialLiters: (p / 100) * tankCapacity,
        initialPercentage: p,
      };
    }

    return {
      initialLiters: tankCapacity * 0.5,
      initialPercentage: 50,
    };
  }, [tankCapacity, consumedData, addedLiters, machinery]);

  // PASSO 3: Quando preencher "Litros Abastecidos", somar ao NÍVEL ATUAL para obter a PROJEÇÃO
  const projectedLiters = useMemo(() => {
    return initialLiters + addedLiters;
  }, [initialLiters, addedLiters]);

  const projectedPercentage = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    return (projectedLiters / tankCapacity) * 100;
  }, [projectedLiters, tankCapacity]);

  // PASSO 4: Altura visual do líquido (clamp entre 0% e 100%)
  const visualLiquidHeight = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    return Math.max(0, Math.min(100, projectedPercentage));
  }, [tankCapacity, projectedPercentage]);

  const isOverflowing = projectedPercentage > 100;
  const isNearlyEmpty = initialPercentage > 0 && initialPercentage <= 15;
  const hasNoTankCapacity = tankCapacity <= 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-sky-50/50 via-slate-50/70 to-blue-50/40 dark:from-stone-900/60 dark:to-stone-900/40 p-4 sm:p-5 rounded-2xl border border-sky-100 dark:border-stone-800 shadow-sm relative overflow-hidden">
      
      {/* Estilos CSS dedicados para animação fluida da onda de líquido e ondas acústicas */}
      <style>{`
        @keyframes tankWaveBack {
          0% { transform: translateX(0) scaleY(1); }
          50% { transform: translateX(-25%) scaleY(1.15); }
          100% { transform: translateX(-50%) scaleY(1); }
        }
        @keyframes tankWaveFront {
          0% { transform: translateX(-50%) scaleY(1); }
          50% { transform: translateX(-25%) scaleY(0.9); }
          100% { transform: translateX(0) scaleY(1); }
        }
        @keyframes ultrasonicPulse {
          0% { opacity: 0.2; transform: scale(0.9); }
          50% { opacity: 0.8; transform: scale(1.05); }
          100% { opacity: 0.2; transform: scale(0.9); }
        }
        @keyframes bubbleFloat {
          0% { transform: translateY(0px) translateX(0px); opacity: 0; }
          40% { opacity: 0.7; }
          100% { transform: translateY(-70px) translateX(6px); opacity: 0; }
        }
        .anim-wave-back {
          animation: tankWaveBack 7s ease-in-out infinite;
        }
        .anim-wave-front {
          animation: tankWaveFront 5s ease-in-out infinite;
        }
        .anim-ultrasonic {
          animation: ultrasonicPulse 2.5s ease-in-out infinite;
        }
        .bubble-1 {
          animation: bubbleFloat 4s ease-in infinite;
          left: 20%;
          bottom: 15%;
        }
        .bubble-2 {
          animation: bubbleFloat 5s ease-in infinite 1.2s;
          left: 45%;
          bottom: 10%;
        }
        .bubble-3 {
          animation: bubbleFloat 3.8s ease-in infinite 2.5s;
          left: 75%;
          bottom: 20%;
        }
        .bubble-4 {
          animation: bubbleFloat 4.6s ease-in infinite 0.7s;
          left: 85%;
          bottom: 8%;
        }
      `}</style>

      {/* Cabeçalho do Card de Visualização */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/70 dark:border-stone-800">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Fuel className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
            Nível do Tanque em Tempo Real
          </span>
        </div>

        {tankCapacity > 0 && (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 dark:bg-stone-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-stone-700 shadow-2xs">
            <span>Tanque:</span>
            <strong className="text-amber-600 dark:text-amber-400 font-mono">{tankCapacity} L</strong>
          </span>
        )}
      </div>

      {/* CONTAINER DO TANQUE 3D GLASS COMPOSTO IGUAL À IMAGEM DE REFERÊNCIA */}
      <div className="flex-1 flex flex-col items-center justify-center my-2 relative py-2">
        
        {/* Tampa do bocal superior esquerdo + Sensor preto no topo central com ondas acústicas */}
        <div className="w-full max-w-[340px] flex items-end justify-between px-10 h-6 relative z-20 pointer-events-none">
          {/* Bocal esquerdo com tampa chanfrada */}
          <div className="relative left-1 flex flex-col items-center">
            <div className="w-7 h-2.5 bg-gradient-to-r from-zinc-300 via-zinc-100 to-zinc-400 dark:from-stone-600 dark:to-stone-700 rounded-t-sm shadow-xs border border-zinc-400/60" />
            <div className="w-5 h-1.5 bg-zinc-400 dark:bg-stone-600" />
          </div>

          {/* Sensor Ultrasônico central com emissor de ondas */}
          <div className="relative -left-2 flex flex-col items-center">
            <div className="w-9 h-3.5 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 rounded-t-md shadow-md border border-zinc-700/80 flex items-center justify-center">
              <div className="w-5 h-1 bg-zinc-700/60 rounded-full" />
            </div>
            <div className="w-6 h-1 bg-zinc-800" />
          </div>

          {/* Tampa de alívio / respiro secundário à direita */}
          <div className="w-3.5 h-1.5 bg-zinc-300 dark:bg-stone-600 rounded-t-xs border border-zinc-400/40" />
        </div>

        {/* CORPO DO TANQUE (Estrutura Glassmorphism Horizontal com Bordas Arredondadas) */}
        <div className="w-full max-w-[350px] h-[195px] relative rounded-[28px] p-1.5 bg-gradient-to-br from-white/90 via-slate-100/40 to-white/70 dark:from-stone-800/80 dark:via-stone-900/50 dark:to-stone-800/60 border-2 border-white/90 dark:border-stone-700 shadow-[0_15px_35px_-10px_rgba(0,0,0,0.18),inset_0_1px_3px_rgba(255,255,255,0.9),inset_0_-2px_8px_rgba(0,0,0,0.06)] overflow-hidden backdrop-blur-md flex flex-col justify-end">
          
          {/* Ondas Ultrasônicas emitidas pelo sensor para baixo (igual à imagem) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-20 pointer-events-none z-15 flex flex-col items-center anim-ultrasonic opacity-40">
            <svg viewBox="0 0 100 60" className="w-full h-full stroke-slate-500/70 dark:stroke-slate-300/60 fill-none" strokeWidth="2.5" strokeLinecap="round">
              <path d="M 40 8 A 12 12 0 0 0 60 8" />
              <path d="M 30 18 A 24 24 0 0 0 70 18" />
              <path d="M 20 30 A 36 36 0 0 0 80 30" />
              <path d="M 10 44 A 48 48 0 0 0 90 44" />
            </svg>
          </div>

          {/* Cinta 1: Braçadeira metálica vertical esquerda */}
          <div className="absolute top-0 bottom-0 left-[22%] w-4.5 bg-gradient-to-r from-zinc-200/90 via-white to-zinc-300/90 dark:from-stone-600/90 dark:via-stone-500/90 dark:to-stone-700/90 shadow-[0_0_6px_rgba(0,0,0,0.12)] z-25 pointer-events-none border-x border-zinc-300/60 flex flex-col justify-between items-center py-1">
            <div className="w-2 h-1 bg-zinc-400 dark:bg-stone-800 rounded-xs opacity-60" />
            <div className="w-2 h-1 bg-zinc-400 dark:bg-stone-800 rounded-xs opacity-60" />
          </div>

          {/* Cinta 2: Braçadeira metálica vertical direita */}
          <div className="absolute top-0 bottom-0 right-[24%] w-4.5 bg-gradient-to-r from-zinc-200/90 via-white to-zinc-300/90 dark:from-stone-600/90 dark:via-stone-500/90 dark:to-stone-700/90 shadow-[0_0_6px_rgba(0,0,0,0.12)] z-25 pointer-events-none border-x border-zinc-300/60 flex flex-col justify-between items-center py-1">
            <div className="w-2 h-1 bg-zinc-400 dark:bg-stone-800 rounded-xs opacity-60" />
            <div className="w-2 h-1 bg-zinc-400 dark:bg-stone-800 rounded-xs opacity-60" />
          </div>

          {/* Brilho especular superior do vidro (Reflexo de luz curva acrílica) */}
          <div className="absolute top-1.5 left-4 right-4 h-6 rounded-full bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-20" />
          <div className="absolute top-3 left-6 w-20 h-2 rounded-full bg-white/90 pointer-events-none z-20 blur-[0.5px]" />

          {/* CAMADA DE COMBUSTÍVEL LÍQUIDO AMARELO / DOURADO DINÂMICO */}
          {!hasNoTankCapacity && visualLiquidHeight > 0 && (
            <div 
              className="w-full relative transition-all duration-700 ease-out z-10 overflow-hidden rounded-b-[24px]"
              style={{ height: `${visualLiquidHeight}%` }}
            >
              {/* ONDA SUPERIOR DA SUPERFÍCIE LÍQUIDA (Wave Effect com SVG Duplo Animado) */}
              <div className="absolute top-0 left-0 right-0 h-7 -translate-y-4 overflow-hidden pointer-events-none">
                {/* Onda traseira com tom âmbar mais escuro e sutil */}
                <div className="w-[200%] h-7 absolute top-0 left-0 anim-wave-back opacity-50">
                  <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="w-full h-full fill-amber-600">
                    <path d="M 0 50 Q 100 20, 200 50 T 400 50 T 600 50 T 800 50 L 800 100 L 0 100 Z" />
                  </svg>
                </div>
                {/* Onda frontal com brilho dourado e amarelo vibrante */}
                <div className="w-[200%] h-7 absolute top-0 left-0 anim-wave-front opacity-90">
                  <svg viewBox="0 0 800 100" preserveAspectRatio="none" className="w-full h-full fill-amber-400">
                    <path d="M 0 50 Q 100 70, 200 50 T 400 50 T 600 50 T 800 50 L 800 100 L 0 100 Z" />
                  </svg>
                </div>
              </div>

              {/* Corpo do Líquido com Gradiente Dourado Âmbar Transparente */}
              <div className="w-full h-full bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 relative opacity-95 shadow-[inset_0_2px_10px_rgba(251,191,36,0.8),inset_0_-8px_20px_rgba(180,83,9,0.5)]">
                
                {/* Linha de reflexo dourado logo abaixo da superfície */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent opacity-80" />

                {/* Bolhas sutis de combustível em movimento */}
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 absolute bubble-1" />
                <span className="w-1 h-1 rounded-full bg-white/60 absolute bubble-2" />
                <span className="w-2 h-2 rounded-full bg-white/50 absolute bubble-3" />
                <span className="w-1 h-1 rounded-full bg-white/70 absolute bubble-4" />

                {/* Profundidade inferior */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-amber-700/40 to-transparent pointer-events-none" />
              </div>
            </div>
          )}

          {/* TEXTO CENTRAL COM A PORCENTAGEM (Exato à imagem de referência: '50%') */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            {hasNoTankCapacity ? (
              <div className="flex flex-col items-center justify-center p-3 text-center bg-white/80 dark:bg-stone-900/80 rounded-xl backdrop-blur-xs border border-slate-200 dark:border-stone-700 max-w-[240px] shadow-xs">
                <AlertCircle className="w-6 h-6 text-amber-500 mb-1" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  Capacidade Não Definida
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Defina a capacidade do tanque no cadastro do veículo
                </span>
              </div>
            ) : (
              <div className="flex items-baseline select-none">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-700 dark:text-slate-100 font-['Outfit'] drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {Math.round(projectedPercentage)}
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-600 dark:text-slate-300 ml-0.5 font-['Outfit'] drop-shadow-[0_2px_3px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
                  %
                </span>
              </div>
            )}
          </div>

          {/* Brilho inferior de base do tanque */}
          <div className="absolute bottom-1 left-8 right-8 h-2 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-20" />
        </div>

        {/* Pés de sustentação do tanque embaixo de cada cinta (apoio de borracha/chassi) */}
        <div className="w-full max-w-[340px] flex items-start justify-between px-16 h-2.5 relative z-10 pointer-events-none">
          <div className="w-6 h-2 bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-xs shadow-xs relative left-3 border-t border-zinc-600" />
          <div className="w-6 h-2 bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-xs shadow-xs relative -left-3 border-t border-zinc-600" />
        </div>

      </div>

      {/* PAINEL INFORMATIVO / TELEMETRIA EM TEMPO REAL */}
      <div className="mt-2 space-y-2">
        {hasNoTankCapacity ? (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
              <strong>Aviso:</strong> A capacidade deste veículo está zerada. Edite o veículo em <em>Gestão de Frotas &gt; Veículos</em> e preencha a <strong>Capacidade do Tanque (L)</strong> para habilitar o cálculo automático.
            </div>
          </div>
        ) : (
          <>
            {/* Grid com indicadores: Nível Atual, Adicionado e Nível Previsto */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-white/90 dark:bg-stone-800/80 border border-slate-200/80 dark:border-stone-700/80 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                  Nível Atual
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {initialLiters.toFixed(0)} L
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  ({Math.round(initialPercentage)}%)
                </span>
              </div>

              <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 block uppercase">
                  + Abastecido
                </span>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  {addedLiters > 0 ? `+${addedLiters.toFixed(1)} L` : '--'}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-mono">
                  {addedLiters > 0 ? `+${((addedLiters / tankCapacity) * 100).toFixed(0)}%` : '0 L'}
                </span>
              </div>

              <div className={`p-2 rounded-xl border shadow-2xs ${
                isOverflowing
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60'
              }`}>
                <span className={`text-[10px] font-semibold block uppercase ${
                  isOverflowing ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  Projeção
                </span>
                <span className={`text-xs font-bold ${
                  isOverflowing ? 'text-rose-800 dark:text-rose-300' : 'text-emerald-800 dark:text-emerald-300'
                }`}>
                  {projectedLiters.toFixed(0)} L
                </span>
                <span className={`text-[10px] block font-mono ${
                  isOverflowing ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  ({Math.round(projectedPercentage)}%)
                </span>
              </div>
            </div>

            {/* Passo 1 & 2: Detalhamento do Consumo Calculado no Período */}
            {consumedData.consumedLiters > 0 && (
              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 text-[11px] text-sky-900 dark:text-sky-200 flex items-center justify-between shadow-2xs">
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>
                    Consumo gasto: <strong>{consumedData.delta} {consumedData.mode === 'hours' ? 'h' : 'km'}</strong> {consumedData.mode === 'hours' ? '×' : '÷'} <strong>{consumedData.rate.toFixed(2)} {consumedData.mode === 'hours' ? 'L/h' : 'km/L'}</strong>
                  </span>
                </span>
                <span className="font-bold text-sky-700 dark:text-sky-300 font-mono">
                  -{consumedData.consumedLiters.toFixed(1)} L
                </span>
              </div>
            )}

            {/* Aviso de Transbordo / Capacidade Excedida */}
            {isOverflowing && (
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300 flex items-center space-x-1.5 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span>
                  <strong>Atenção:</strong> A soma ({projectedLiters.toFixed(0)} L) ultrapassa a capacidade máxima do tanque ({tankCapacity} L).
                </span>
              </div>
            )}

            {/* Alerta de Nível Crítico Inicial */}
            {isNearlyEmpty && !isOverflowing && (
              <div className="p-2 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-center space-x-1.5">
                <Droplets className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Tanque na reserva antes deste abastecimento.</span>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};
