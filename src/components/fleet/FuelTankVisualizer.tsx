import React, { useMemo, useEffect } from 'react';
import { AlertCircle, Droplets, Fuel, Info, CheckCircle2, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';
import { Machinery } from '../../types';
import { 
  calculateTankLevelMetrics, 
  getTankColorTheme, 
  FuelCalculationResult,
  FuelConsumptionMode 
} from '../../lib/fuelCalculation';

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
  isFirstRecord?: boolean;
  onCalculationChange?: (result: FuelCalculationResult) => void;
}

export const FuelTankVisualizer: React.FC<FuelTankVisualizerProps> = ({
  machinery,
  addedLitersInput,
  currentHourMeterInput = '',
  previousHourMeterInput = '',
  currentKmInput = '',
  previousKmInput = '',
  liveLitersPerHour,
  liveKmPerLiter,
  historicalAvgLitersPerHour,
  historicalAvgKmPerLiter,
  isFirstRecord,
  onCalculationChange,
}) => {
  // 1. Capacidade Total do Tanque (capacidade_tanque)
  const tankCapacity = useMemo(() => {
    if (!machinery) return 0;
    const cap = (machinery as any).tank_capacity ?? (machinery as any).tankCapacity ?? machinery.fuelCapacityLiters;
    const num = Number(cap);
    return !isNaN(num) && num > 0 ? num : 0;
  }, [machinery]);

  // 2. Litros Abastecidos (litros_abastecidos)
  const addedLiters = useMemo(() => {
    const parsed = parseFloat(addedLitersInput);
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  }, [addedLitersInput]);

  // 3. Leituras de Horímetro e Odômetro
  const currH = parseFloat(currentHourMeterInput);
  const prevH = parseFloat(previousHourMeterInput);
  const deltaH = !isNaN(currH) && !isNaN(prevH) && currH > prevH ? (currH - prevH) : 0;

  const currK = parseFloat(currentKmInput);
  const prevK = parseFloat(previousKmInput);
  const deltaK = !isNaN(currK) && !isNaN(prevK) && currK > prevK ? (currK - prevK) : 0;

  // 4. Determinação do Tipo de Consumo (Km/l para rodoviários ou l/h para tratores/máquinas)
  const tipoConsumo: FuelConsumptionMode = useMemo(() => {
    // Se o usuário digitou no campo de horas e há delta positivo
    if (deltaH > 0 && deltaK <= 0) return 'l_h';
    if (deltaK > 0 && deltaH <= 0) return 'km_l';
    
    // Análise da categoria do veículo
    const cat = (machinery?.categoryType || machinery?.tipo || '').toLowerCase();
    if (cat.includes('caminhao') || cat.includes('caminhão') || cat.includes('onibus') || cat.includes('ônibus') || cat.includes('utilitario') || cat.includes('utilitário')) {
      return 'km_l';
    }
    if (cat.includes('trator') || cat.includes('ensiladeira') || cat.includes('forrageira') || cat.includes('colheitadeira') || cat.includes('maquina') || cat.includes('máquina')) {
      return 'l_h';
    }

    // Se o veículo possui média de L/h cadastrada
    if (machinery?.averageConsumptionLitersPerHour && machinery.averageConsumptionLitersPerHour > 0) {
      return 'l_h';
    }
    if (machinery?.averageConsumptionKmPerLiter && machinery.averageConsumptionKmPerLiter > 0) {
      return 'km_l';
    }

    return deltaH > 0 ? 'l_h' : 'km_l';
  }, [deltaH, deltaK, machinery]);

  // 5. Média de Consumo (media_consumo) cadastrada ou histórica
  const mediaConsumo = useMemo(() => {
    if (tipoConsumo === 'l_h') {
      if (machinery?.averageConsumptionLitersPerHour && machinery.averageConsumptionLitersPerHour > 0) {
        return machinery.averageConsumptionLitersPerHour;
      }
      if (historicalAvgLitersPerHour && historicalAvgLitersPerHour > 0) {
        return historicalAvgLitersPerHour;
      }
      if (liveLitersPerHour && liveLitersPerHour > 0) {
        return liveLitersPerHour;
      }
      return 22.0; // Padrão comercial para maquinário pesado
    } else {
      if (machinery?.averageConsumptionKmPerLiter && machinery.averageConsumptionKmPerLiter > 0) {
        return machinery.averageConsumptionKmPerLiter;
      }
      if (historicalAvgKmPerLiter && historicalAvgKmPerLiter > 0) {
        return historicalAvgKmPerLiter;
      }
      if (liveKmPerLiter && liveKmPerLiter > 0) {
        return liveKmPerLiter;
      }
      return 2.8; // Padrão comercial para caminhão pesado carregado
    }
  }, [tipoConsumo, machinery, historicalAvgLitersPerHour, liveLitersPerHour, historicalAvgKmPerLiter, liveKmPerLiter]);

  // Flag efetiva de primeiro abastecimento
  const isFirstRecordEffective = isFirstRecord ?? (
    (!prevH || prevH === 0) && (!prevK || prevK === 0)
  );

  // 6. Volume inicial do ciclo (nivel_anterior):
  // Se for primeiro registro e o nível inicial for desconhecido, parte de 0L.
  // Se o veículo tem nível em litros ou porcentagem salvo no cadastro, calcula a partir dele.
  // Senão, assume tanque completo do ciclo anterior (capacidade do tanque).
  const nivelAnterior = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    if (isFirstRecordEffective) {
      if ((machinery as any)?.currentFuelLiters !== undefined && (machinery as any)?.currentFuelLiters !== null) {
        const lit = Number((machinery as any).currentFuelLiters);
        if (!isNaN(lit) && lit > 0) return Math.min(tankCapacity, lit);
      }
      if (machinery?.currentFuelPercentage !== undefined && machinery.currentFuelPercentage !== null) {
        const p = Math.max(0, Math.min(100, Number(machinery.currentFuelPercentage)));
        if (!isNaN(p) && p > 0) return (p / 100) * tankCapacity;
      }
      return 0; // Primeiro registro sem nível anterior registrado: parte de 0L
    }
    if ((machinery as any)?.currentFuelLiters !== undefined && (machinery as any)?.currentFuelLiters !== null) {
      const lit = Number((machinery as any).currentFuelLiters);
      if (!isNaN(lit) && lit >= 0) return Math.min(tankCapacity, lit);
    }
    if (machinery?.currentFuelPercentage !== undefined && machinery.currentFuelPercentage !== null) {
      const p = Math.max(0, Math.min(100, Number(machinery.currentFuelPercentage)));
      if (!isNaN(p)) return (p / 100) * tankCapacity;
    }
    return tankCapacity;
  }, [tankCapacity, machinery, isFirstRecordEffective]);

  // 7. Cálculo das Métricas de Consumo e Níveis do Tanque
  const calculationResult: FuelCalculationResult = useMemo(() => {
    const isHours = tipoConsumo === 'l_h';
    const horimetroKmAnterior = isHours ? (!isNaN(prevH) ? prevH : 0) : (!isNaN(prevK) ? prevK : 0);
    const horimetroKmAtual = isHours ? (!isNaN(currH) ? currH : 0) : (!isNaN(currK) ? currK : 0);

    return calculateTankLevelMetrics({
      capacidadeTanque: tankCapacity,
      mediaConsumo,
      tipoConsumo,
      horimetroKmAnterior,
      horimetroKmAtual,
      litrosAbastecidos: addedLiters,
      nivelAnterior,
      isFirstRecord: isFirstRecordEffective,
    });
  }, [tankCapacity, mediaConsumo, tipoConsumo, prevH, currH, prevK, currK, addedLiters, nivelAnterior, isFirstRecordEffective]);

  // Notifica o componente pai sempre que os cálculos atualizarem
  useEffect(() => {
    if (onCalculationChange) {
      onCalculationChange(calculationResult);
    }
  }, [calculationResult, onCalculationChange]);

  // 8. Tema Dinâmico de Cor com base no novo_nivel e transbordo
  const theme = useMemo(() => {
    return getTankColorTheme(calculationResult.novoNivelPorcentagem, calculationResult.isOverflowing);
  }, [calculationResult.novoNivelPorcentagem, calculationResult.isOverflowing]);

  // Altura visual em porcentagem (clamp entre 0% e 100%)
  const visualHeight = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    return Math.max(0, Math.min(100, calculationResult.novoNivelPorcentagem));
  }, [tankCapacity, calculationResult.novoNivelPorcentagem]);

  // Altura da camada base (nível_atual que sobrou após consumo)
  const baseLevelHeight = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    return Math.max(0, Math.min(100, calculationResult.nivelAtualPorcentagem));
  }, [tankCapacity, calculationResult.nivelAtualPorcentagem]);

  const hasNoTankCapacity = tankCapacity <= 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-sky-50/50 via-slate-50/70 to-blue-50/40 dark:from-stone-900/60 dark:to-stone-900/40 p-4 sm:p-5 rounded-2xl border border-sky-100 dark:border-stone-800 shadow-sm relative overflow-hidden">
      
      {/* Estilos CSS dedicados para animação de ondas do combustível líquido e ultrassom */}
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

      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/70 dark:border-stone-800">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Fuel className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
            Nível do Tanque em Tempo Real
          </span>
        </div>

        {tankCapacity > 0 ? (
          <div className="flex items-center space-x-1.5">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 dark:bg-stone-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-stone-700 shadow-2xs">
              <span>Tanque:</span>
              <strong className="text-amber-600 dark:text-amber-400 font-mono">{tankCapacity} L</strong>
            </span>
          </div>
        ) : null}
      </div>

      {/* CONTAINER DO TANQUE 3D HORIZONTAL */}
      <div className="flex-1 flex flex-col items-center justify-center my-2 relative py-2">
        
        {/* Topo do Tanque: Bocal esquerdo + Sensor Ultrassônico + Respiro */}
        <div className="w-full max-w-[340px] flex items-end justify-between px-10 h-6 relative z-20 pointer-events-none">
          {/* Bocal esquerdo com tampa chanfrada */}
          <div className="relative left-1 flex flex-col items-center">
            <div className="w-7 h-2.5 bg-gradient-to-r from-zinc-300 via-zinc-100 to-zinc-400 dark:from-stone-600 dark:to-stone-700 rounded-t-sm shadow-xs border border-zinc-400/60" />
            <div className="w-5 h-1.5 bg-zinc-400 dark:bg-stone-600" />
          </div>

          {/* Sensor Ultrassônico central no topo */}
          <div className="relative -left-2 flex flex-col items-center">
            <div className="w-9 h-3.5 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 rounded-t-md shadow-md border border-zinc-700/80 flex items-center justify-center">
              <div className="w-5 h-1 bg-zinc-700/60 rounded-full" />
            </div>
            <div className="w-6 h-1 bg-zinc-800" />
          </div>

          {/* Respiro secundário à direita */}
          <div className="w-3.5 h-1.5 bg-zinc-300 dark:bg-stone-600 rounded-t-xs border border-zinc-400/40" />
        </div>

        {/* CORPO DO TANQUE (Vidro Glassmorphism com Bordas Arredondadas) */}
        <div className={`w-full max-w-[350px] h-[195px] relative rounded-[28px] p-1.5 bg-gradient-to-br from-white/90 via-slate-100/40 to-white/70 dark:from-stone-800/80 dark:via-stone-900/50 dark:to-stone-800/60 border-2 ${
          calculationResult.isOverflowing ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]' : 'border-white/90 dark:border-stone-700 shadow-[0_15px_35px_-10px_rgba(0,0,0,0.18),inset_0_1px_3px_rgba(255,255,255,0.9),inset_0_-2px_8px_rgba(0,0,0,0.06)]'
        } overflow-hidden backdrop-blur-md flex flex-col justify-end transition-colors duration-500`}>
          
          {/* Ondas Ultrassônicas emitidas pelo sensor central */}
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

          {/* Brilhos especulares do vidro */}
          <div className="absolute top-1.5 left-4 right-4 h-6 rounded-full bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-20" />
          <div className="absolute top-3 left-6 w-20 h-2 rounded-full bg-white/90 pointer-events-none z-20 blur-[0.5px]" />

          {/* CAMADA DE COMBUSTÍVEL LÍQUIDO DINÂMICO (Muda de Altura e Cor em Tempo Real) */}
          {!hasNoTankCapacity && visualHeight > 0 && (
            <div 
              className="w-full relative transition-all duration-700 ease-out z-10 overflow-hidden rounded-b-[24px]"
              style={{ height: `${visualHeight}%` }}
            >
              {/* ONDAS SUPERIORES DA SUPERFÍCIE LÍQUIDA (Muda de cor com o tema) */}
              <div className="absolute top-0 left-0 right-0 h-7 -translate-y-4 overflow-hidden pointer-events-none">
                {/* Onda traseira */}
                <div className="w-[200%] h-7 absolute top-0 left-0 anim-wave-back opacity-60">
                  <svg viewBox="0 0 800 100" preserveAspectRatio="none" className={`w-full h-full ${theme.waveBack} transition-colors duration-500`}>
                    <path d="M 0 50 Q 100 20, 200 50 T 400 50 T 600 50 T 800 50 L 800 100 L 0 100 Z" />
                  </svg>
                </div>
                {/* Onda frontal */}
                <div className="w-[200%] h-7 absolute top-0 left-0 anim-wave-front opacity-95">
                  <svg viewBox="0 0 800 100" preserveAspectRatio="none" className={`w-full h-full ${theme.waveFront} transition-colors duration-500`}>
                    <path d="M 0 50 Q 100 70, 200 50 T 400 50 T 600 50 T 800 50 L 800 100 L 0 100 Z" />
                  </svg>
                </div>
              </div>

              {/* Corpo do Líquido com Gradiente Dinâmico e Brilho */}
              <div className={`w-full h-full bg-gradient-to-b ${theme.gradient} relative opacity-95 ${theme.glow} transition-colors duration-500 flex flex-col justify-end`}>
                
                {/* Linha divisória sutil indicando o nível_atual antes do novo abastecimento */}
                {addedLiters > 0 && baseLevelHeight > 0 && baseLevelHeight < visualHeight && (
                  <div 
                    className="absolute left-0 right-0 border-t-2 border-white/50 border-dashed pointer-events-none z-15"
                    style={{ bottom: `${(baseLevelHeight / visualHeight) * 100}%` }}
                  >
                    <span className="absolute right-2 -top-4 text-[9px] font-bold text-white/90 drop-shadow-xs bg-black/30 px-1 rounded">
                      Nível pré-abastecimento: {calculationResult.nivelAtual.toFixed(0)}L
                    </span>
                  </div>
                )}

                {/* Linha de reflexo dourado sob a superfície */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-80" />

                {/* Bolhas flutuantes */}
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 absolute bubble-1" />
                <span className="w-1 h-1 rounded-full bg-white/60 absolute bubble-2" />
                <span className="w-2 h-2 rounded-full bg-white/50 absolute bubble-3" />
                <span className="w-1 h-1 rounded-full bg-white/70 absolute bubble-4" />

                {/* Profundidade inferior */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
            </div>
          )}

          {/* NÚMERO CENTRAL DE PORCENTAGEM (Exato à imagem de referência: '100%') */}
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
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-800 dark:text-slate-100 font-['Outfit'] drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {Math.round(calculationResult.novoNivelPorcentagem)}
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-700 dark:text-slate-200 ml-0.5 font-['Outfit'] drop-shadow-[0_2px_3px_rgba(255,255,255,0.9)] dark:drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
                  %
                </span>
              </div>
            )}
          </div>

          {/* Brilho inferior da base */}
          <div className="absolute bottom-1 left-8 right-8 h-2 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-20" />
        </div>

        {/* Pés de sustentação metálicos */}
        <div className="w-full max-w-[340px] flex items-start justify-between px-16 h-2.5 relative z-10 pointer-events-none">
          <div className="w-6 h-2 bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-xs shadow-xs relative left-3 border-t border-zinc-600" />
          <div className="w-6 h-2 bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-xs shadow-xs relative -left-3 border-t border-zinc-600" />
        </div>

      </div>

      {/* PAINEL DE TELEMETRIA EM TEMPO REAL: 3 CARDS INFERIORES */}
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
            {/* Grid dos 3 Cards: NÍVEL ATUAL, + ABASTECIDO, PROJEÇÃO / NOVO NÍVEL */}
            <div className="grid grid-cols-3 gap-2 text-center">
              
              {/* Card 1: NÍVEL ATUAL (Sobrou no tanque após consumo) */}
              <div className="p-2 rounded-xl bg-white/90 dark:bg-stone-800/80 border border-slate-200/80 dark:border-stone-700/80 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                  Nível Atual
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {calculationResult.nivelAtual.toFixed(0)} L
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  ({Math.round(calculationResult.nivelAtualPorcentagem)}%)
                </span>
              </div>

              {/* Card 2: + ABASTECIDO */}
              <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 block uppercase">
                  + Abastecido
                </span>
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  {calculationResult.litrosAbastecidos > 0 ? `+${calculationResult.litrosAbastecidos.toFixed(1)} L` : '--'}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-mono">
                  {calculationResult.litrosAbastecidos > 0 ? `+${Math.round(calculationResult.adicionadoPorcentagem)}%` : '0 L'}
                </span>
              </div>

              {/* Card 3: PROJEÇÃO / NOVO NÍVEL (com clamp em 100% / capacidade) */}
              <div className={`p-2 rounded-xl border shadow-2xs ${
                calculationResult.isOverflowing
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60'
              }`}>
                <span className={`text-[10px] font-semibold block uppercase ${
                  calculationResult.isOverflowing ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  Projeção
                </span>
                <span className={`text-xs font-bold ${
                  calculationResult.isOverflowing ? 'text-rose-800 dark:text-rose-300' : 'text-emerald-800 dark:text-emerald-300'
                }`}>
                  {calculationResult.novoNivel.toFixed(0)} L
                </span>
                <span className={`text-[10px] block font-mono ${
                  calculationResult.isOverflowing ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  ({Math.round(calculationResult.novoNivelPorcentagem)}%)
                </span>
              </div>
            </div>

            {/* Detalhe do Cálculo do Consumo (Passo 1 das regras de negócio) */}
            {calculationResult.combustivelGasto > 0 && (
              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 text-[11px] text-sky-900 dark:text-sky-200 flex items-center justify-between shadow-2xs">
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>
                    Consumo: <strong>Δ {calculationResult.distanciaOuTempo} {calculationResult.tipoConsumo === 'l_h' ? 'h' : 'km'}</strong> {calculationResult.tipoConsumo === 'l_h' ? '×' : '÷'} <strong>{calculationResult.mediaConsumo.toFixed(2)} {calculationResult.tipoConsumo === 'l_h' ? 'L/h' : 'km/L'}</strong>
                  </span>
                </span>
                <span className="font-bold text-sky-700 dark:text-sky-300 font-mono">
                  -{calculationResult.combustivelGasto.toFixed(1)} L
                </span>
              </div>
            )}

            {/* Aviso de Transbordo / Capacidade Excedida (Regra: O novo_nivel nunca ultrapassa capacidade_tanque) */}
            {calculationResult.isOverflowing && (
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300 flex items-center space-x-1.5 animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span>
                  <strong>Atenção:</strong> Abastecimento ultrapassa o tanque ({calculationResult.capacidadeTanque} L). Excesso estimado: <strong>+{calculationResult.excessoLitros.toFixed(1)} L</strong>. Nível limitado a 100%.
                </span>
              </div>
            )}

            {/* Alerta de Reserva Crítica */}
            {calculationResult.isReserve && !calculationResult.isOverflowing && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 flex items-center space-x-1.5">
                <Droplets className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>Veículo estava na reserva ({calculationResult.nivelAtual.toFixed(0)}L restantes) antes deste abastecimento.</span>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};
