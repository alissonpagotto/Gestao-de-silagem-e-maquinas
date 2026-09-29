import React, { useMemo } from 'react';
import { Package, Droplets, AlertTriangle, MapPin, CheckCircle2 } from 'lucide-react';
import { InventoryItem } from '../../types';

interface ArlaGalaoVisualizerProps {
  galaoProduct?: InventoryItem | null;
  addedLitersInput?: string;
  onSetQuickLiters?: (liters: string) => void;
}

export const ArlaGalaoVisualizer: React.FC<ArlaGalaoVisualizerProps> = ({
  galaoProduct,
  addedLitersInput = '',
  onSetQuickLiters,
}) => {
  // Saldo de galões vindo direto da tabela 'estoque_produtos' (Almoxarifado Principal)
  const saldoGaloes = useMemo(() => {
    if (!galaoProduct) return 0;
    const q = galaoProduct.quantidade_atual !== undefined ? Number(galaoProduct.quantidade_atual) : Number(galaoProduct.quantity ?? 0);
    return isNaN(q) ? 0 : Math.max(0, q);
  }, [galaoProduct]);

  const saldoLitrosTotal = saldoGaloes * 20;

  // Litros ou galões informados pelo usuário
  const { litrosDigitados, galoesConsumidos, isInputUnitGalao } = useMemo(() => {
    const raw = String(addedLitersInput || '').trim().replace(',', '.');
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed <= 0) {
      return { litrosDigitados: 0, galoesConsumidos: 0, isInputUnitGalao: false };
    }

    // Se o usuário digitou um número pequeno como 1, 2, 3 galões (<= 5), ou se digitou em litros (ex: 20, 40)
    // Se digitou <= 5, tratamos como unidades de galão se não especificado; se digitou >= 10, tratamos como litros (20L = 1 galão)
    if (parsed <= 5 && Number.isInteger(parsed)) {
      return {
        litrosDigitados: parsed * 20,
        galoesConsumidos: parsed,
        isInputUnitGalao: true,
      };
    }

    const gal = Math.max(1, Math.ceil(parsed / 20));
    return {
      litrosDigitados: parsed,
      galoesConsumidos: gal,
      isInputUnitGalao: false,
    };
  }, [addedLitersInput]);

  const saldoRestanteGaloes = Math.max(0, saldoGaloes - galoesConsumidos);
  const saldoRestanteLitros = saldoRestanteGaloes * 20;
  const isEstoqueInsuficiente = galoesConsumidos > saldoGaloes;
  const localizacao = galaoProduct?.localizacao_fisica || galaoProduct?.location || 'Almoxarifado Principal';

  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-xs text-zinc-900 dark:text-zinc-100 space-y-2.5 select-none flex flex-col justify-between flex-1 animate-in fade-in duration-200">
      
      {/* 1. CABEÇALHO: ORIGEM NO ALMOXARIFADO */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 dark:bg-sky-500/20 border border-sky-500/30 dark:border-sky-500/40 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-2xs">
            <Package className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h4 className="text-[11px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider font-['Outfit']">
                1. MONITORAMENTO DO ESTOQUE (GALÃO)
              </h4>
              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40 font-mono">
                20 LITROS / UN
              </span>
            </div>
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
              <span>{localizacao}</span>
            </p>
          </div>
        </div>

        {/* Saldo de Galões Disponível */}
        <div className="text-right shrink-0">
          <div className="flex items-baseline justify-end space-x-1">
            <span className="text-sm font-black font-mono text-sky-600 dark:text-sky-400">
              {saldoGaloes} {saldoGaloes === 1 ? 'galão' : 'galões'}
            </span>
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 font-mono">
              ({saldoLitrosTotal} L)
            </span>
          </div>
          {isEstoqueInsuficiente ? (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 animate-pulse">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>Estoque Insuficiente</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              <span>Estoque Almoxarifado</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. ILUSTRAÇÃO DO GALÃO INDUSTRIAL DE ARLA 32 (20L) */}
      <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-gradient-to-b from-sky-50/60 via-white to-sky-50/40 dark:from-zinc-900 dark:via-zinc-800/90 dark:to-zinc-900 p-2.5 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* SVG do Galão 20L */}
        <div className="w-28 h-32 relative shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 120 140" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="jugBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f0f9ff" />
                <stop offset="40%" stopColor="#e0f2fe" />
                <stop offset="85%" stopColor="#bae6fd" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>

              <linearGradient id="jugBlueCapGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0369a1" />
                <stop offset="50%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#075985" />
              </linearGradient>

              <linearGradient id="jugLiquidLevelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
              </linearGradient>
            </defs>

            {/* Tampa Azul Roscada no Bocal Esquerdo */}
            <rect x="22" y="10" width="22" height="12" rx="3" fill="url(#jugBlueCapGrad)" stroke="#0c4a6e" strokeWidth="1" />
            <line x1="26" y1="13" x2="26" y2="19" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
            <line x1="30" y1="13" x2="30" y2="19" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
            <line x1="34" y1="13" x2="34" y2="19" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
            <line x1="38" y1="13" x2="38" y2="19" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
            <rect x="25" y="21" width="16" height="5" fill="#0284c7" />

            {/* Alça Anatômica Superior Centralizada */}
            <path
              d="M 50 24 C 50 14, 90 14, 90 24 L 90 32 L 80 32 L 80 25 C 80 20, 60 20, 60 25 L 60 32 L 50 32 Z"
              fill="#bae6fd"
              stroke="#0284c7"
              strokeWidth="1.5"
            />

            {/* Corpo Principal do Galão Retangular com Cantos Arredondados */}
            <rect
              x="16"
              y="26"
              width="88"
              height="104"
              rx="12"
              fill="url(#jugBodyGrad)"
              stroke="#0284c7"
              strokeWidth="2"
            />

            {/* Visor de Nível Translúcido Vertical à Esquerda */}
            <rect x="24" y="38" width="8" height="80" rx="3" fill="#ffffff" opacity="0.7" stroke="#7dd3fc" strokeWidth="1" />
            
            {/* Líquido no visor de nível */}
            {saldoGaloes > 0 && (
              <rect x="25" y="44" width="6" height="72" rx="2" fill="url(#jugLiquidLevelGrad)" />
            )}

            {/* Marcações de Litragem no Visor (5L, 10L, 15L, 20L) */}
            <line x1="24" y1="46" x2="32" y2="46" stroke="#0369a1" strokeWidth="1" />
            <line x1="24" y1="64" x2="32" y2="64" stroke="#0369a1" strokeWidth="1" />
            <line x1="24" y1="82" x2="32" y2="82" stroke="#0369a1" strokeWidth="1" />
            <line x1="24" y1="100" x2="32" y2="100" stroke="#0369a1" strokeWidth="1" />

            {/* Rótulo Frontal Elegante do Galão Arla 32 */}
            <g transform="translate(38, 44)">
              <rect x="0" y="0" width="58" height="70" rx="4" fill="#ffffff" stroke="#38bdf8" strokeWidth="1" />
              <rect x="0" y="0" width="58" height="15" rx="3" fill="#0284c7" />
              <text x="29" y="11" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                ARLA 32
              </text>

              {/* Símbolo Eco / Arla */}
              <circle cx="29" cy="30" r="9" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1" />
              <path d="M 29 24 Q 34 30 29 35 Q 24 30 29 24 Z" fill="#0284c7" />

              <text x="29" y="48" fill="#0369a1" fontSize="6.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                GALÃO 20L
              </text>
              <text x="29" y="56" fill="#64748b" fontSize="5" textAnchor="middle" fontFamily="sans-serif">
                UREIA TÉCNICA
              </text>
              <rect x="6" y="60" width="46" height="6" rx="2" fill="#0284c7" opacity="0.15" />
              <text x="29" y="64.5" fill="#0284c7" fontSize="4.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                ALMOXARIFADO
              </text>
            </g>
          </svg>
        </div>

        {/* Informações de Consumo e Projeção */}
        <div className="flex-1 w-full space-y-2">
          <div className="p-2 rounded-lg bg-white/90 dark:bg-zinc-800/80 border border-sky-200 dark:border-sky-900/60 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-600 dark:text-zinc-300 font-medium">Consumo Solicitado:</span>
              <span className="font-mono font-black text-sky-600 dark:text-sky-400">
                {galoesConsumidos} {galoesConsumidos === 1 ? 'galão' : 'galões'} ({litrosDigitados} L)
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-100 dark:border-zinc-700/60">
              <span className="text-zinc-600 dark:text-zinc-300 font-medium">Saldo Restante:</span>
              <span className={`font-mono font-bold ${isEstoqueInsuficiente ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-zinc-800 dark:text-zinc-200'}`}>
                {saldoRestanteGaloes} {saldoRestanteGaloes === 1 ? 'galão' : 'galões'} ({saldoRestanteLitros} L)
              </span>
            </div>
          </div>

          {/* Botões de Seleção Rápida de Galões */}
          {onSetQuickLiters && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 block">
                Atalhos de Galão (20L cada):
              </span>
              <div className="flex flex-wrap gap-1">
                {[1, 2, 3, 4].map((num) => {
                  const lts = num * 20;
                  const isCurrent = litrosDigitados === lts || (isInputUnitGalao && galoesConsumidos === num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => onSetQuickLiters(String(lts))}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-600 text-white border-sky-700 shadow-2xs'
                          : 'bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-600 hover:bg-sky-50 dark:hover:bg-zinc-600'
                      }`}
                    >
                      {num} {num === 1 ? 'Galão' : 'Galões'} ({lts}L)
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 3. RODAPÉ DE REGRAS E AVISO DO ALMOXARIFADO */}
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1 py-0.5 rounded bg-sky-50/60 dark:bg-zinc-800/60 border border-sky-100 dark:border-zinc-700/50 flex items-center justify-between">
        <span className="flex items-center gap-1 font-semibold text-sky-800 dark:text-sky-300">
          <Droplets className="w-3 h-3 text-sky-500" />
          <span>Baixa direta por unidade no Almoxarifado</span>
        </span>
        <span className="font-mono text-zinc-600 dark:text-zinc-300">
          Tanque industrial de 1.000L preservado
        </span>
      </div>

    </div>
  );
};
