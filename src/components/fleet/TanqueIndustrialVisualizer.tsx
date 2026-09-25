import React, { useMemo } from 'react';
import { TanqueCombustivel } from '../../types';
import { Droplets, ShieldCheck, AlertTriangle, ArrowDownRight, Warehouse, Fuel } from 'lucide-react';

interface TanqueIndustrialVisualizerProps {
  tanque?: TanqueCombustivel | null;
  addedLitersInput?: string;
  tanques?: TanqueCombustivel[];
  onTanqueChange?: (tanqueId: string) => void;
}

/**
 * TanqueIndustrialVisualizer:
 * Ilustração industrial de um Tanque Aéreo Horizontal de Fazenda (Metal/Aço)
 * - Card destacado em cinza médio-escuro (bg-zinc-800 / #2c2c2e) com borda fina (border-zinc-700)
 * - Proporções confortáveis e alto contraste visual em relação ao fundo do modal
 */
export const TanqueIndustrialVisualizer: React.FC<TanqueIndustrialVisualizerProps> = ({
  tanque,
  addedLitersInput = '',
  tanques = [],
  onTanqueChange,
}) => {
  // Capacidade total e Saldo atual do tanque
  const capacidadeTotal = useMemo(() => {
    const cap = Number(tanque?.capacidade_total);
    return !isNaN(cap) && cap > 0 ? cap : 15000;
  }, [tanque]);

  const quantidadeAtual = useMemo(() => {
    const q = Number(tanque?.quantidade_atual);
    return !isNaN(q) && q >= 0 ? q : 11200;
  }, [tanque]);

  // Litros que o usuário digitou no formulário para abastecer o veículo
  const litrosDigitados = useMemo(() => {
    const raw = String(addedLitersInput || '').trim().replace(',', '.');
    const parsed = parseFloat(raw);
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  }, [addedLitersInput]);

  // Nível Atual em Porcentagem (0% - 100%)
  const nivelAtualPorcentagem = useMemo(() => {
    if (capacidadeTotal <= 0) return 0;
    return Math.min(100, Math.max(0, parseFloat(((quantidadeAtual / capacidadeTotal) * 100).toFixed(1))));
  }, [quantidadeAtual, capacidadeTotal]);

  // Saldo projetado após o abastecimento do veículo
  const saldoProjetado = useMemo(() => {
    return Math.max(0, parseFloat((quantidadeAtual - litrosDigitados).toFixed(2)));
  }, [quantidadeAtual, litrosDigitados]);

  // Porcentagem projetada após o abastecimento
  const nivelProjetadoPorcentagem = useMemo(() => {
    if (capacidadeTotal <= 0) return 0;
    return Math.min(100, Math.max(0, parseFloat(((saldoProjetado / capacidadeTotal) * 100).toFixed(1))));
  }, [saldoProjetado, capacidadeTotal]);

  // Alerta de estoque insuficiente
  const isEstoqueInsuficiente = litrosDigitados > quantidadeAtual;
  const isNivelBaixo = nivelProjetadoPorcentagem <= 20 && nivelProjetadoPorcentagem > 10;
  const isNivelCritico = nivelProjetadoPorcentagem <= 10;

  // Altura do líquido dinâmico (baseado no saldo projetado se houver digitação, ou saldo atual)
  const alturaLiquidoEfetiva = litrosDigitados > 0 ? nivelProjetadoPorcentagem : nivelAtualPorcentagem;

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-lg text-zinc-100 flex flex-col justify-between select-none relative overflow-hidden flex-1">
      
      {/* 1. MONITORAMENTO DO ESTOQUE (Topo do Painel: ORIGEM) */}
      <div className="relative z-10 space-y-2 pb-2.5 border-b border-zinc-700">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Warehouse className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider font-['Outfit'] truncate">
                  1. MONITORAMENTO DO ESTOQUE (ORIGEM)
                </h4>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-700 text-amber-300 border border-amber-500/40 font-mono shrink-0">
                  {tanque?.tipo_combustivel?.toLowerCase().includes('s500') ? 'S500' : 'S10'}
                </span>
              </div>
              <p className="text-xs font-semibold text-zinc-200 truncate mt-0.5">
                {tanque?.nome || 'Tanque Principal Diesel S10'}
              </p>
            </div>
          </div>

          {/* Volume Disponível e Porcentagem em Destaque */}
          <div className="text-right shrink-0">
            <div className="flex items-baseline justify-end space-x-1">
              <span className="text-sm font-black text-amber-400 font-mono">
                {quantidadeAtual.toLocaleString('pt-BR')} L
              </span>
              <span className="text-[11px] font-semibold text-zinc-300 font-mono">
                ({nivelAtualPorcentagem.toFixed(1)}%)
              </span>
            </div>
            {isEstoqueInsuficiente ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                <span>Saldo Insuficiente</span>
              </span>
            ) : isNivelCritico ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <AlertTriangle className="w-3 h-3" />
                <span>Nível Crítico</span>
              </span>
            ) : isNivelBaixo ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <AlertTriangle className="w-3 h-3" />
                <span>Nível Baixo</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <ShieldCheck className="w-3 h-3" />
                <span>Estoque OK</span>
              </span>
            )}
          </div>
        </div>

        {/* Seletor rápido de tanques cadastrados (S10 vs S500) */}
        {tanques.length > 1 && onTanqueChange && (
          <div className="flex items-center space-x-2 pt-0.5">
            <span className="text-[11px] text-zinc-300 font-semibold shrink-0">Tanques:</span>
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar w-full">
              {tanques.map((t) => {
                const isSelected = t.id === tanque?.id;
                const isS500 = t.tipo_combustivel?.toLowerCase().includes('s500') || t.nome.toLowerCase().includes('s500');
                const badge = isS500 ? 'S500' : 'S10';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTanqueChange(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 shadow-xs'
                        : 'bg-zinc-700/80 text-zinc-200 hover:text-white hover:bg-zinc-700 border border-zinc-600'
                    }`}
                  >
                    <span>{t.nome}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded ${isSelected ? 'bg-zinc-950/25 text-zinc-950 font-black' : 'bg-zinc-800 text-zinc-300'}`}>
                      {badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ILUSTRAÇÃO INDUSTRIAL: TANQUE AÉREO HORIZONTAL COM RESPIRO ELEGANTE */}
      {/* ========================================================================= */}
      <div className="relative my-2 flex flex-col items-center justify-center py-1 bg-zinc-700/25 rounded-xl border border-zinc-700/80">
        <div className="w-full max-w-[300px] h-[125px] relative flex items-center justify-center">
          <svg
            viewBox="0 0 400 210"
            className="w-full h-full drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="metalCylinderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a1a1aa" />
                <stop offset="18%" stopColor="#d4d4d8" />
                <stop offset="42%" stopColor="#e4e4e7" />
                <stop offset="65%" stopColor="#a1a1aa" />
                <stop offset="88%" stopColor="#52525b" />
                <stop offset="100%" stopColor="#3f3f46" />
              </linearGradient>

              <linearGradient id="dieselLiquidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.95" />
                <stop offset="15%" stopColor="#f59e0b" stopOpacity="0.92" />
                <stop offset="60%" stopColor="#d97706" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.98" />
              </linearGradient>

              <linearGradient id="dieselDiffGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
              </linearGradient>

              <linearGradient id="saddleSupportGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3f3f46" />
                <stop offset="50%" stopColor="#71717a" />
                <stop offset="100%" stopColor="#27272a" />
              </linearGradient>

              <clipPath id="tankInnerChamberClip">
                <rect x="75" y="42" width="250" height="120" rx="60" ry="60" />
              </clipPath>
            </defs>

            {/* Sombra Suave na Base */}
            <ellipse cx="200" cy="198" rx="150" ry="8" fill="#18181b" opacity="0.35" />

            {/* Berço Esquerdo */}
            <path
              d="M 105 128 L 95 190 L 75 193 L 75 199 L 145 199 L 145 193 L 125 190 L 115 128 Z"
              fill="url(#saddleSupportGrad)"
              stroke="#3f3f46"
              strokeWidth="1.5"
            />
            <circle cx="85" cy="196" r="2" fill="#d4d4d8" />
            <circle cx="135" cy="196" r="2" fill="#d4d4d8" />

            {/* Berço Direito */}
            <path
              d="M 285 128 L 275 190 L 255 193 L 255 199 L 325 199 L 325 193 L 305 190 L 295 128 Z"
              fill="url(#saddleSupportGrad)"
              stroke="#3f3f46"
              strokeWidth="1.5"
            />
            <circle cx="265" cy="196" r="2" fill="#d4d4d8" />
            <circle cx="315" cy="196" r="2" fill="#d4d4d8" />

            {/* Barra estrutural horizontal */}
            <rect x="125" y="180" width="150" height="5" fill="#52525b" stroke="#3f3f46" strokeWidth="1" />

            {/* Válvula Inferior */}
            <rect x="190" y="158" width="20" height="22" fill="#71717a" stroke="#3f3f46" strokeWidth="1" />
            <circle cx="200" cy="175" r="4.5" fill="#f59e0b" stroke="#92400e" strokeWidth="1" />

            {/* Boca de Visita Superior */}
            <rect x="180" y="30" width="40" height="14" fill="#71717a" stroke="#3f3f46" strokeWidth="1.5" rx="3" />
            <ellipse cx="200" cy="30" rx="22" ry="5" fill="#a1a1aa" stroke="#52525b" strokeWidth="1.5" />

            {/* Tubo de Respiro Superior */}
            <path
              d="M 140 42 L 140 18 Q 140 10 148 10 Q 156 10 156 18 L 156 23"
              fill="none"
              stroke="#a1a1aa"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Corpo Metálico do Tanque */}
            <rect
              x="75"
              y="42"
              width="250"
              height="120"
              rx="60"
              ry="60"
              fill="url(#metalCylinderGrad)"
              stroke="#52525b"
              strokeWidth="2.5"
            />

            {/* Costuras de Solda */}
            <line x1="140" y1="43" x2="140" y2="161" stroke="#52525b" strokeWidth="1.5" opacity="0.6" />
            <line x1="200" y1="43" x2="200" y2="161" stroke="#52525b" strokeWidth="1.5" opacity="0.6" />
            <line x1="260" y1="43" x2="260" y2="161" stroke="#52525b" strokeWidth="1.5" opacity="0.6" />

            {/* Câmara Interna com Líquido Diesel */}
            <g clipPath="url(#tankInnerChamberClip)">
              <rect x="75" y="42" width="250" height="120" fill="#3f3f46" opacity="0.55" />

              <line x1="85" y1="72" x2="315" y2="72" stroke="#a1a1aa" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.45" />
              <line x1="85" y1="102" x2="315" y2="102" stroke="#a1a1aa" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.45" />
              <line x1="85" y1="132" x2="315" y2="132" stroke="#a1a1aa" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.45" />

              {litrosDigitados > 0 && nivelAtualPorcentagem > nivelProjetadoPorcentagem && (
                <rect
                  x="75"
                  y={42 + (120 * (1 - nivelAtualPorcentagem / 100))}
                  width="250"
                  height={120 * ((nivelAtualPorcentagem - nivelProjetadoPorcentagem) / 100)}
                  fill="url(#dieselDiffGrad)"
                  className="animate-pulse"
                />
              )}

              {alturaLiquidoEfetiva > 0 && (
                <g>
                  <rect
                    x="75"
                    y={42 + (120 * (1 - alturaLiquidoEfetiva / 100))}
                    width="250"
                    height={120 * (alturaLiquidoEfetiva / 100)}
                    fill="url(#dieselLiquidGrad)"
                    style={{
                      transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                  <line
                    x1="75"
                    y1={42 + (120 * (1 - alturaLiquidoEfetiva / 100))}
                    x2="325"
                    y2={42 + (120 * (1 - alturaLiquidoEfetiva / 100))}
                    stroke="#fef08a"
                    strokeWidth="2"
                    style={{
                      transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </g>
              )}

              <ellipse cx="200" cy="56" rx="100" ry="10" fill="#ffffff" opacity="0.2" />
            </g>

            {/* Contorno externo */}
            <rect
              x="75"
              y="42"
              width="250"
              height="120"
              rx="60"
              ry="60"
              fill="none"
              stroke="#52525b"
              strokeWidth="2.5"
            />

            {/* Placa ONU 1202 DIESEL */}
            <g transform="translate(182, 114)">
              <rect x="0" y="0" width="36" height="20" rx="2" fill="#f97316" stroke="#c2410c" strokeWidth="1" />
              <text x="18" y="9" fontSize="6.5" fontWeight="bold" textAnchor="middle" fill="#18181b" fontFamily="sans-serif">
                1202
              </text>
              <text x="18" y="16.5" fontSize="5.5" fontWeight="bold" textAnchor="middle" fill="#18181b" fontFamily="sans-serif">
                DIESEL
              </text>
            </g>

            {/* Visor Lateral de Nível */}
            <rect x="330" y="52" width="8" height="100" rx="3" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
            <rect x="332" y="54" width="4" height="96" rx="2" fill="#52525b" />
            {alturaLiquidoEfetiva > 0 && (
              <rect
                x="332"
                y={54 + (96 * (1 - alturaLiquidoEfetiva / 100))}
                width="4"
                height={96 * (alturaLiquidoEfetiva / 100)}
                fill="#f59e0b"
                rx="1"
                style={{
                  transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            )}
            <rect x="325" y="55" width="5" height="4" fill="#a1a1aa" />
            <rect x="325" y="145" width="5" height="4" fill="#a1a1aa" />
          </svg>

          {/* Badge Central Sobreposto */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-zinc-800/90 backdrop-blur-xs px-3 py-1 rounded-xl border border-zinc-600 shadow-lg flex flex-col items-center">
              <span className="text-[9px] uppercase font-bold text-amber-400 tracking-wider leading-tight">
                Nível do Tanque
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black text-white font-['Outfit'] leading-tight">
                  {alturaLiquidoEfetiva.toFixed(1)}%
                </span>
                <span className="text-[10px] text-zinc-300 font-semibold">
                  {tanque?.tipo_combustivel || 'Diesel S10'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PAINEL DE DADOS: CAPACIDADE, SALDO ATUAL E PROJEÇÃO */}
      {/* ========================================================================= */}
      <div className="relative z-10 space-y-2 pt-2 border-t border-zinc-700">
        
        {/* Barra de Progresso Horizontal */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-zinc-300 flex items-center space-x-1.5">
              <Droplets className="w-3.5 h-3.5 text-amber-400" />
              <span>Volume Disponível</span>
            </span>
            <span className="text-zinc-100 font-mono font-bold">
              {quantidadeAtual.toLocaleString('pt-BR')} L / {capacidadeTotal.toLocaleString('pt-BR')} L
            </span>
          </div>

          <div className="w-full h-2.5 bg-zinc-700 rounded-full overflow-hidden border border-zinc-600 p-0.5 relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isNivelCritico
                  ? 'bg-rose-500'
                  : isNivelBaixo
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, nivelAtualPorcentagem))}%` }}
            />
          </div>
        </div>

        {/* Quadro Dinâmico: Saída e Saldo Restante */}
        {litrosDigitados > 0 ? (
          <div className="px-3 py-2 rounded-lg bg-zinc-700/60 border border-amber-500/40 space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-300 font-semibold flex items-center space-x-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
                <span>Saída Solicitada:</span>
              </span>
              <span className="font-mono font-black text-amber-400">
                - {litrosDigitados.toLocaleString('pt-BR')} L
              </span>
            </div>

            <div className="pt-1 border-t border-zinc-600/80 flex items-center justify-between text-xs">
              <span className="text-zinc-200 font-medium">Saldo Após Abastecimento:</span>
              <div className="flex items-baseline space-x-1">
                <span className={`font-mono font-black ${isEstoqueInsuficiente ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {saldoProjetado.toLocaleString('pt-BR')} L
                </span>
                <span className="text-[10px] text-zinc-300 font-mono">
                  ({nivelProjetadoPorcentagem.toFixed(1)}%)
                </span>
              </div>
            </div>

            {isEstoqueInsuficiente && (
              <div className="px-2.5 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-[11px] text-rose-200 font-semibold flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>Volume informado excede o saldo do tanque!</span>
              </div>
            )}
          </div>
        ) : (
          <div className="px-3 py-2 rounded-lg bg-zinc-700/55 border border-zinc-600/80 flex items-center justify-between text-xs">
            <span className="text-zinc-200 font-medium flex items-center space-x-1.5">
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              <span>Saldo Livre para Uso:</span>
            </span>
            <span className="font-mono font-bold text-amber-300 text-xs">
              {quantidadeAtual.toLocaleString('pt-BR')} L
            </span>
          </div>
        )}

        {/* Rodapé com Localização e Tipo de Combustível */}
        <div className="flex items-center justify-between text-[11px] text-zinc-300 pt-0.5">
          <span className="truncate max-w-[210px]">
            📍 {tanque?.localizacao || 'Pátio Central / Barracão'}
          </span>
          <span className="font-semibold text-amber-400">
            {tanque?.tipo_combustivel || 'Diesel S10'}
          </span>
        </div>

      </div>

    </div>
  );
};
