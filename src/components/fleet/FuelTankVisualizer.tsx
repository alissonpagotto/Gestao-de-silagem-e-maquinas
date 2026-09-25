import React, { useMemo, useEffect } from 'react';
import { AlertCircle, Droplets, Fuel, Info, CheckCircle2, ShieldAlert, Sparkles, ArrowRight, Truck } from 'lucide-react';
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
  dbTankLevel?: number;
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
  dbTankLevel,
  onCalculationChange,
}) => {
  // 1. Capacidade Total do Tanque (capacidade_tanque)
  const tankCapacity = useMemo(() => {
    if (!machinery) return 0;
    const cap = (machinery as any).tank_capacity ?? (machinery as any).tankCapacity ?? machinery.fuelCapacityLiters;
    const num = Number(cap);
    return !isNaN(num) && num > 0 ? num : 0;
  }, [machinery]);

  // Flag efetiva de primeiro abastecimento
  const isFirstRecordEffective = Boolean(isFirstRecord);

  // 2. NÍVEL ATUAL: Reflete estritamente o valor que vem do banco de dados antes deste abastecimento
  const nivelAtual = useMemo(() => {
    if (isFirstRecordEffective) return 0;
    if (dbTankLevel !== undefined && dbTankLevel !== null && !isNaN(Number(dbTankLevel)) && Number(dbTankLevel) >= 0) {
      return Number(dbTankLevel);
    }
    const machLiters = (machinery as any)?.currentFuelLiters ?? (machinery as any)?.current_fuel_liters;
    if (machLiters !== undefined && machLiters !== null && !isNaN(Number(machLiters)) && Number(machLiters) >= 0) {
      return Number(machLiters);
    }
    if (machinery?.currentFuelPercentage !== undefined && machinery.currentFuelPercentage !== null && tankCapacity > 0) {
      const p = Number(machinery.currentFuelPercentage);
      if (!isNaN(p)) return parseFloat(((p / 100) * tankCapacity).toFixed(1));
    }
    return tankCapacity > 0 ? tankCapacity : 0;
  }, [dbTankLevel, machinery, tankCapacity, isFirstRecordEffective]);

  // 3. Litros Abastecidos (digitado pelo usuário no input 'Litros Abastecidos')
  const addedLiters = useMemo(() => {
    const raw = String(addedLitersInput || '').trim().replace(',', '.');
    const parsed = parseFloat(raw);
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  }, [addedLitersInput]);

  // 4. PROJEÇÃO: Soma matemática estrita: (Nível Atual vindo do banco + Litros Digitados)
  // Se o nível atual era 1105 e o usuário digitou 50, a projeção DEVE exibir 1155L.
  // Nunca trava em 100% ou muda o nível atual de forma arbitrária.
  const projecaoLiters = useMemo(() => {
    if (isFirstRecordEffective) return addedLiters;
    return parseFloat((nivelAtual + addedLiters).toFixed(2));
  }, [nivelAtual, addedLiters, isFirstRecordEffective]);

  // 5. Porcentagens calculadas com base na capacidade do tanque
  const nivelAtualPorcentagem = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    return parseFloat(((nivelAtual / tankCapacity) * 100).toFixed(1));
  }, [nivelAtual, tankCapacity]);

  const adicionadoPorcentagem = useMemo(() => {
    if (tankCapacity <= 0 || addedLiters <= 0) return 0;
    return parseFloat(((addedLiters / tankCapacity) * 100).toFixed(1));
  }, [addedLiters, tankCapacity]);

  // Projeção em porcentagem (pode ultrapassar 100% se ultrapassar o tanque)
  const projecaoPorcentagem = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    return parseFloat(((projecaoLiters / tankCapacity) * 100).toFixed(1));
  }, [projecaoLiters, tankCapacity]);

  // 6. Alerta de excesso de capacidade teórica (sem bloqueios)
  const isOverflowing = useMemo(() => {
    return tankCapacity > 0 && projecaoLiters > tankCapacity;
  }, [tankCapacity, projecaoLiters]);

  const excessoLitros = useMemo(() => {
    return isOverflowing ? parseFloat((projecaoLiters - tankCapacity).toFixed(2)) : 0;
  }, [isOverflowing, projecaoLiters, tankCapacity]);

  const isReserve = useMemo(() => {
    return !isFirstRecordEffective && tankCapacity > 0 && (nivelAtual / tankCapacity) <= 0.20;
  }, [isFirstRecordEffective, tankCapacity, nivelAtual]);

  // 7. Leituras de Horímetro e Odômetro
  const currH = parseFloat(String(currentHourMeterInput || '').trim().replace(',', '.'));
  const prevH = parseFloat(String(previousHourMeterInput || '').trim().replace(',', '.'));
  const deltaH = !isNaN(currH) && !isNaN(prevH) && currH > prevH ? (currH - prevH) : 0;

  const currK = parseFloat(String(currentKmInput || '').trim().replace(',', '.'));
  const prevK = parseFloat(String(previousKmInput || '').trim().replace(',', '.'));
  const deltaK = !isNaN(currK) && !isNaN(prevK) && currK > prevK ? (currK - prevK) : 0;

  // 8. Determinação do Tipo de Consumo (Km/l para rodoviários ou l/h para tratores/máquinas)
  const tipoConsumo: FuelConsumptionMode = useMemo(() => {
    if (deltaH > 0 && deltaK <= 0) return 'l_h';
    if (deltaK > 0 && deltaH <= 0) return 'km_l';
    
    const cat = (machinery?.categoryType || machinery?.tipo || '').toLowerCase();
    if (cat.includes('caminhao') || cat.includes('caminhão') || cat.includes('onibus') || cat.includes('ônibus') || cat.includes('utilitario') || cat.includes('utilitário')) {
      return 'km_l';
    }
    if (cat.includes('trator') || cat.includes('ensiladeira') || cat.includes('forrageira') || cat.includes('colheitadeira') || cat.includes('maquina') || cat.includes('máquina')) {
      return 'l_h';
    }

    if (machinery?.averageConsumptionLitersPerHour && machinery.averageConsumptionLitersPerHour > 0) {
      return 'l_h';
    }
    if (machinery?.averageConsumptionKmPerLiter && machinery.averageConsumptionKmPerLiter > 0) {
      return 'km_l';
    }

    return deltaH > 0 ? 'l_h' : 'km_l';
  }, [deltaH, deltaK, machinery]);

  const mediaConsumo = useMemo(() => {
    if (tipoConsumo === 'l_h') {
      if (liveLitersPerHour && liveLitersPerHour > 0) return liveLitersPerHour;
      if (historicalAvgLitersPerHour && historicalAvgLitersPerHour > 0) return historicalAvgLitersPerHour;
      if (machinery?.averageConsumptionLitersPerHour && machinery.averageConsumptionLitersPerHour > 0) {
        return machinery.averageConsumptionLitersPerHour;
      }
      return 22.0;
    } else {
      if (liveKmPerLiter && liveKmPerLiter > 0) return liveKmPerLiter;
      if (historicalAvgKmPerLiter && historicalAvgKmPerLiter > 0) return historicalAvgKmPerLiter;
      if (machinery?.averageConsumptionKmPerLiter && machinery.averageConsumptionKmPerLiter > 0) {
        return machinery.averageConsumptionKmPerLiter;
      }
      return 2.8;
    }
  }, [tipoConsumo, liveLitersPerHour, historicalAvgLitersPerHour, machinery, liveKmPerLiter, historicalAvgKmPerLiter]);

  // 9. Resultado do Cálculo
  const calculationResult: FuelCalculationResult = useMemo(() => {
    const isHours = tipoConsumo === 'l_h';
    const horimetroKmAnterior = isHours ? (!isNaN(prevH) ? prevH : 0) : (!isNaN(prevK) ? prevK : 0);
    const horimetroKmAtual = isHours ? (!isNaN(currH) ? currH : 0) : (!isNaN(currK) ? currK : 0);
    const distanciaOuTempo = isHours ? deltaH : deltaK;

    return {
      capacidadeTanque: tankCapacity,
      tipoConsumo,
      mediaConsumo,
      horimetroKmAnterior,
      horimetroKmAtual,
      distanciaOuTempo,
      combustivelGasto: addedLiters,
      nivelAnterior: nivelAtual,
      nivelAtual,
      nivelAtualPorcentagem,
      litrosAbastecidos: addedLiters,
      adicionadoPorcentagem,
      novoNivelBruto: projecaoLiters,
      novoNivel: projecaoLiters,
      novoNivelPorcentagem: projecaoPorcentagem,
      isOverflowing,
      excessoLitros,
      isReserve,
      isFirstRecord: isFirstRecordEffective,
    };
  }, [
    tankCapacity,
    tipoConsumo,
    mediaConsumo,
    prevH,
    currH,
    deltaH,
    prevK,
    currK,
    deltaK,
    addedLiters,
    nivelAtual,
    nivelAtualPorcentagem,
    adicionadoPorcentagem,
    projecaoLiters,
    projecaoPorcentagem,
    isOverflowing,
    excessoLitros,
    isReserve,
    isFirstRecordEffective,
  ]);

  // Notifica o componente pai sempre que os cálculos atualizarem
  useEffect(() => {
    if (onCalculationChange) {
      onCalculationChange(calculationResult);
    }
  }, [calculationResult, onCalculationChange]);

  // 10. Tema Dinâmico de Cor com base na projeção e se excede o tanque
  const theme = useMemo(() => {
    return getTankColorTheme(projecaoPorcentagem, isOverflowing);
  }, [projecaoPorcentagem, isOverflowing]);

  // Altura visual em porcentagem do líquido (clamp físico entre 0% e 100% da caixa visual)
  const visualHeight = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    return Math.max(0, Math.min(100, projecaoPorcentagem));
  }, [tankCapacity, projecaoPorcentagem]);

  // Altura da camada base (nível_atual que já estava no tanque)
  const baseLevelHeight = useMemo(() => {
    if (tankCapacity <= 0) return 0;
    return Math.max(0, Math.min(100, nivelAtualPorcentagem));
  }, [tankCapacity, nivelAtualPorcentagem]);

  const hasNoTankCapacity = tankCapacity <= 0;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-stone-900 via-stone-850 to-stone-900 border border-stone-700/80 rounded-2xl p-3 text-stone-100 shadow-xl relative overflow-hidden select-none">
      
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

      {/* 2. MONITORAMENTO DO VEÍCULO (DESTINO) */}
      <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-stone-800">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h4 className="text-xs font-black text-blue-400 uppercase tracking-wider font-['Outfit'] truncate">
                2. MONITORAMENTO DO VEÍCULO (DESTINO)
              </h4>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 border border-stone-700 shrink-0">
                Máquina
              </span>
            </div>
            <p className="text-[11px] font-bold text-stone-200 truncate">
              {machinery ? (
                <>
                  <span>{machinery.nome || machinery.name}</span>
                  {machinery.licensePlateOrSerial && (
                    <span className="ml-1 text-[10px] font-mono font-bold px-1 rounded bg-stone-800 text-amber-300 border border-stone-700">
                      {machinery.licensePlateOrSerial}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-stone-400 italic">Selecione o veículo à esquerda</span>
              )}
            </p>
          </div>
        </div>

        {tankCapacity > 0 ? (
          <div className="flex items-center space-x-1 shrink-0">
            {liveKmPerLiter ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800 shadow-2xs">
                {liveKmPerLiter.toFixed(2).replace('.', ',')} km/L
              </span>
            ) : null}

            {liveLitersPerHour ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800 shadow-2xs">
                {liveLitersPerHour.toFixed(2).replace('.', ',')} L/h
              </span>
            ) : null}

            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700 shadow-2xs">
              <span>Cap:</span>
              <strong className="text-amber-400 font-mono">{tankCapacity} L</strong>
            </span>
          </div>
        ) : null}
      </div>

      {/* CONTAINER DO TANQUE 3D COMPACTO */}
      <div className="flex-1 flex flex-col items-center justify-center my-0.5 relative py-1">
        
        {/* Topo do Tanque: Bocal esquerdo + Sensor Ultrassônico + Respiro */}
        <div className="w-full max-w-[260px] flex items-end justify-between px-6 h-4 relative z-20 pointer-events-none">
          {/* Bocal esquerdo com tampa chanfrada */}
          <div className="relative left-1 flex flex-col items-center">
            <div className="w-5 h-2 bg-gradient-to-r from-zinc-300 via-zinc-100 to-zinc-400 dark:from-stone-600 dark:to-stone-700 rounded-t-xs shadow-xs border border-zinc-400/60" />
            <div className="w-3.5 h-1 bg-zinc-400 dark:bg-stone-600" />
          </div>

          {/* Sensor Ultrassônico central no topo */}
          <div className="relative -left-1 flex flex-col items-center">
            <div className="w-7 h-2.5 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-950 rounded-t-xs shadow-xs border border-zinc-700/80 flex items-center justify-center">
              <div className="w-3.5 h-0.5 bg-zinc-700/60 rounded-full" />
            </div>
            <div className="w-4 h-0.5 bg-zinc-800" />
          </div>

          {/* Respiro secundário à direita */}
          <div className="w-2.5 h-1 bg-zinc-300 dark:bg-stone-600 rounded-t-xs border border-zinc-400/40" />
        </div>

        {/* CORPO DO TANQUE (Vidro Glassmorphism Compacto Escuro) */}
        <div className={`w-full max-w-[260px] h-[120px] relative rounded-[18px] p-1 bg-gradient-to-br from-stone-900/90 via-stone-950/80 to-stone-900/90 border-2 ${
          calculationResult.isOverflowing ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'border-stone-700/80 shadow-[0_10px_25px_-8px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.1),inset_0_-1px_6px_rgba(0,0,0,0.4)]'
        } overflow-hidden backdrop-blur-md flex flex-col justify-end transition-colors duration-500`}>
          
          {/* Ondas Ultrassônicas emitidas pelo sensor central */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-14 pointer-events-none z-15 flex flex-col items-center anim-ultrasonic opacity-40">
            <svg viewBox="0 0 100 60" className="w-full h-full stroke-slate-500/70 dark:stroke-slate-300/60 fill-none" strokeWidth="2.5" strokeLinecap="round">
              <path d="M 40 8 A 12 12 0 0 0 60 8" />
              <path d="M 30 18 A 24 24 0 0 0 70 18" />
              <path d="M 20 30 A 36 36 0 0 0 80 30" />
              <path d="M 10 44 A 48 48 0 0 0 90 44" />
            </svg>
          </div>

          {/* Cinta 1: Braçadeira metálica vertical esquerda */}
          <div className="absolute top-0 bottom-0 left-[22%] w-3.5 bg-gradient-to-r from-zinc-200/90 via-white to-zinc-300/90 dark:from-stone-600/90 dark:via-stone-500/90 dark:to-stone-700/90 shadow-[0_0_4px_rgba(0,0,0,0.12)] z-25 pointer-events-none border-x border-zinc-300/60 flex flex-col justify-between items-center py-1">
            <div className="w-1.5 h-0.5 bg-zinc-400 dark:bg-stone-800 rounded-xs opacity-60" />
            <div className="w-1.5 h-0.5 bg-zinc-400 dark:bg-stone-800 rounded-xs opacity-60" />
          </div>

          {/* Cinta 2: Braçadeira metálica vertical direita */}
          <div className="absolute top-0 bottom-0 right-[24%] w-3.5 bg-gradient-to-r from-zinc-200/90 via-white to-zinc-300/90 dark:from-stone-600/90 dark:via-stone-500/90 dark:to-stone-700/90 shadow-[0_0_4px_rgba(0,0,0,0.12)] z-25 pointer-events-none border-x border-zinc-300/60 flex flex-col justify-between items-center py-1">
            <div className="w-1.5 h-0.5 bg-zinc-400 dark:bg-stone-800 rounded-xs opacity-60" />
            <div className="w-1.5 h-0.5 bg-zinc-400 dark:bg-stone-800 rounded-xs opacity-60" />
          </div>

          {/* Brilhos especulares do vidro */}
          <div className="absolute top-1 left-3 right-3 h-4 rounded-full bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-20" />
          <div className="absolute top-2 left-4 w-14 h-1.5 rounded-full bg-white/90 pointer-events-none z-20 blur-[0.5px]" />

          {/* CAMADA DE COMBUSTÍVEL LÍQUIDO DINÂMICO */}
          {!hasNoTankCapacity && visualHeight > 0 && (
            <div 
              className="w-full relative transition-all duration-700 ease-out z-10 overflow-hidden rounded-b-[18px]"
              style={{ height: `${visualHeight}%` }}
            >
              {/* ONDAS SUPERIORES DA SUPERFÍCIE LÍQUIDA */}
              <div className="absolute top-0 left-0 right-0 h-5 -translate-y-3 overflow-hidden pointer-events-none">
                {/* Onda traseira */}
                <div className="w-[200%] h-5 absolute top-0 left-0 anim-wave-back opacity-60">
                  <svg viewBox="0 0 800 100" preserveAspectRatio="none" className={`w-full h-full ${theme.waveBack} transition-colors duration-500`}>
                    <path d="M 0 50 Q 100 20, 200 50 T 400 50 T 600 50 T 800 50 L 800 100 L 0 100 Z" />
                  </svg>
                </div>
                {/* Onda frontal */}
                <div className="w-[200%] h-5 absolute top-0 left-0 anim-wave-front opacity-95">
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
                    className="absolute left-0 right-0 border-t border-white/50 border-dashed pointer-events-none z-15"
                    style={{ bottom: `${(baseLevelHeight / visualHeight) * 100}%` }}
                  >
                    <span className="absolute right-1 -top-3.5 text-[8px] font-bold text-white/90 drop-shadow-xs bg-black/40 px-1 rounded">
                      Pré: {calculationResult.nivelAtual.toFixed(0)}L
                    </span>
                  </div>
                )}

                {/* Linha de reflexo dourado sob a superfície */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-80" />

                {/* Bolhas flutuantes */}
                <span className="w-1 h-1 rounded-full bg-white/70 absolute bubble-1" />
                <span className="w-1 h-1 rounded-full bg-white/60 absolute bubble-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/50 absolute bubble-3" />
                <span className="w-1 h-1 rounded-full bg-white/70 absolute bubble-4" />

                {/* Profundidade inferior */}
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
            </div>
          )}

          {/* NÚMERO CENTRAL DE PORCENTAGEM */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            {hasNoTankCapacity ? (
              <div className="flex flex-col items-center justify-center p-2 text-center bg-white/80 dark:bg-stone-900/80 rounded-lg backdrop-blur-xs border border-slate-200 dark:border-stone-700 max-w-[200px] shadow-xs">
                <AlertCircle className="w-4 h-4 text-amber-500 mb-0.5" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  Capacidade Não Definida
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Defina a capacidade do tanque no cadastro
                </span>
              </div>
            ) : (
              <div className="flex items-baseline select-none">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100 font-['Outfit'] drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {Math.round(calculationResult.novoNivelPorcentagem)}
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-slate-700 dark:text-slate-200 ml-0.5 font-['Outfit'] drop-shadow-[0_2px_3px_rgba(255,255,255,0.9)] dark:drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
                  %
                </span>
              </div>
            )}
          </div>

          {/* Brilho inferior da base */}
          <div className="absolute bottom-0.5 left-6 right-6 h-1.5 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-20" />
        </div>

        {/* Pés de sustentação metálicos */}
        <div className="w-full max-w-[260px] flex items-start justify-between px-12 h-2 relative z-10 pointer-events-none">
          <div className="w-5 h-1.5 bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-xs shadow-xs relative left-2 border-t border-zinc-600" />
          <div className="w-5 h-1.5 bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-xs shadow-xs relative -left-2 border-t border-zinc-600" />
        </div>

      </div>

      {/* PAINEL DE TELEMETRIA EM TEMPO REAL: 3 CARDS INFERIORES */}
      <div className="mt-1 space-y-1.5">
        {hasNoTankCapacity ? (
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start space-x-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-800 dark:text-amber-300 leading-snug">
              <strong>Aviso:</strong> A capacidade deste veículo está zerada. Edite o veículo em <em>Gestão de Frotas &gt; Veículos</em> e preencha a <strong>Capacidade do Tanque (L)</strong>.
            </div>
          </div>
        ) : (
          <>
            {/* Grid dos 3 Cards: NÍVEL ATUAL, + ABASTECIDO, PROJEÇÃO / NOVO NÍVEL */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              
              {/* Card 1: NÍVEL ATUAL - Reflete estritamente o valor que vem do banco de dados */}
              <div className="p-1.5 rounded-lg bg-stone-800/90 border border-stone-700/80 shadow-2xs">
                <span className="text-[9px] font-semibold text-stone-400 block uppercase">
                  Nível Atual
                </span>
                <span className="text-xs font-bold text-stone-200">
                  {nivelAtual.toFixed(0)} L
                </span>
                <span className="text-[9px] text-stone-400 block font-mono">
                  ({Math.round(nivelAtualPorcentagem)}%)
                </span>
              </div>

              {/* Card 2: + ABASTECIDO - Exatamente os litros digitados pelo usuário */}
              <div className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-600/50 shadow-2xs">
                <span className="text-[9px] font-semibold text-amber-400 block uppercase">
                  + Abastecido
                </span>
                <span className="text-xs font-bold text-amber-300">
                  {addedLiters > 0 ? `+${addedLiters.toFixed(1)} L` : '--'}
                </span>
                <span className="text-[9px] text-amber-400/80 block font-mono">
                  {addedLiters > 0 ? `+${Math.round(adicionadoPorcentagem)}%` : '0 L'}
                </span>
              </div>

              {/* Card 3: PROJEÇÃO - Soma matemática exata (Nível Atual + Litros Digitados) */}
              <div className={`p-1.5 rounded-lg border shadow-2xs ${
                isOverflowing
                  ? 'bg-rose-950/50 border-rose-600/60'
                  : 'bg-emerald-950/50 border-emerald-600/60'
              }`}>
                <span className={`text-[9px] font-semibold block uppercase ${
                  isOverflowing ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  Projeção Real
                </span>
                <span className={`text-xs font-bold ${
                  isOverflowing ? 'text-rose-300' : 'text-emerald-300'
                }`}>
                  {projecaoLiters.toFixed(0)} L
                </span>
                <span className={`text-[9px] block font-mono ${
                  isOverflowing ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  ({Math.round(projecaoPorcentagem)}%)
                </span>
              </div>
            </div>

            {/* Primeiro Abastecimento: Projeção direta dos litros abastecidos */}
            {isFirstRecordEffective && !isOverflowing && (
              <div className="p-1.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-[10px] text-amber-900 dark:text-amber-200 flex items-center justify-between shadow-2xs">
                <span className="flex items-center space-x-1.5">
                  <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    Registro inicial: Nível base 0L (Projeção = Litros abastecidos).
                  </span>
                </span>
              </div>
            )}

            {/* Detalhe do Cálculo de Médias em Tempo Real (Sómente após digitar os litros) */}
            {addedLiters > 0 && (deltaH > 0 || deltaK > 0) && (
              <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/60 text-[10px] text-sky-900 dark:text-sky-200 flex items-center justify-between shadow-2xs animate-in fade-in">
                <span className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>
                    {deltaH > 0 ? (
                      <>Trabalho: <strong>Δ {deltaH.toFixed(1)} h</strong></>
                    ) : (
                      <>Percurso: <strong>Δ {deltaK.toFixed(1)} km</strong></>
                    )}
                  </span>
                </span>
                <span className="font-bold text-sky-700 dark:text-sky-300 font-mono">
                  {deltaH > 0 ? (
                    `Média: ${(addedLiters / deltaH).toFixed(2).replace('.', ',')} L/h`
                  ) : (
                    `Média: ${(deltaK / addedLiters).toFixed(2).replace('.', ',')} km/L`
                  )}
                </span>
              </div>
            )}

            {/* Aviso de Transbordo / Capacidade Excedida */}
            {calculationResult.isOverflowing && (
              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-[10px] text-rose-800 dark:text-rose-300 flex items-center space-x-1 animate-pulse">
                <ShieldAlert className="w-3 h-3 shrink-0 text-rose-600" />
                <span>
                  <strong>Atenção:</strong> Abastecimento ultrapassa o tanque ({calculationResult.capacidadeTanque} L). Excesso: <strong>+{calculationResult.excessoLitros.toFixed(1)} L</strong>.
                </span>
              </div>
            )}

            {/* Alerta de Reserva Crítica */}
            {calculationResult.isReserve && !calculationResult.isOverflowing && (
              <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[10px] text-rose-700 dark:text-rose-300 flex items-center space-x-1">
                <Droplets className="w-3 h-3 shrink-0 text-rose-500" />
                <span>Veículo na reserva ({calculationResult.nivelAtual.toFixed(0)}L restantes).</span>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};
