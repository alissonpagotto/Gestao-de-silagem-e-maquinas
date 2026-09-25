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
    return !isNaN(q) && q >= 0 ? q : 0;
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
    <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-xs text-zinc-900 dark:text-zinc-100 flex flex-col justify-between select-none relative overflow-hidden flex-1">
      
      {/* 1. MONITORAMENTO DO ESTOQUE (Topo do Painel: ORIGEM) */}
      <div className="relative z-10 space-y-1 pb-1.5 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-6.5 h-6.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Warehouse className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider font-['Outfit'] truncate">
                  1. MONITORAMENTO DO ESTOQUE (ORIGEM)
                </h4>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-amber-800 dark:text-amber-300 border border-zinc-300 dark:border-amber-500/40 font-mono shrink-0">
                  {tanque?.tipo_combustivel?.toLowerCase().includes('s500') ? 'S500' : (tanque?.tipo_combustivel?.toLowerCase().includes('arla') ? 'ARLA 32' : 'S10')}
                </span>
              </div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                {tanque?.nome || 'Tanque Principal Diesel S10'}
              </p>
            </div>
          </div>

          {/* Volume Disponível e Porcentagem em Destaque */}
          <div className="text-right shrink-0">
            <div className="flex items-baseline justify-end space-x-1">
              <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                {quantidadeAtual.toLocaleString('pt-BR')} L
              </span>
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-300 font-mono">
                ({nivelAtualPorcentagem.toFixed(1)}%)
              </span>
            </div>
            {isEstoqueInsuficiente ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 animate-pulse">
                <AlertTriangle className="w-2.5 h-2.5" />
                <span>Saldo Insuficiente</span>
              </span>
            ) : isNivelCritico ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40">
                <AlertTriangle className="w-2.5 h-2.5" />
                <span>Nível Crítico</span>
              </span>
            ) : isNivelBaixo ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40">
                <AlertTriangle className="w-2.5 h-2.5" />
                <span>Nível Baixo</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>Estoque OK</span>
              </span>
            )}
          </div>
        </div>

        {/* Seletor rápido de tanques cadastrados (S10 vs S500) */}
        {tanques.length > 1 && onTanqueChange && (
          <div className="flex items-center space-x-2 pt-0.5">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-300 font-semibold shrink-0">Tanques:</span>
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar w-full">
              {tanques.map((t) => {
                const isSelected = t.id === tanque?.id;
                const isS500 = t.tipo_combustivel?.toLowerCase().includes('s500') || t.nome.toLowerCase().includes('s500');
                const isArla = t.tipo_combustivel?.toLowerCase().includes('arla') || t.nome.toLowerCase().includes('arla');
                const badge = isS500 ? 'S500' : (isArla ? 'ARLA' : 'S10');
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTanqueChange(t.id)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition whitespace-nowrap cursor-pointer flex items-center space-x-1 ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 shadow-xs'
                        : 'bg-white dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 shadow-2xs'
                    }`}
                  >
                    <span>{t.nome}</span>
                    <span className={`text-[8px] px-1 py-0.2 rounded ${isSelected ? 'bg-zinc-950/25 text-zinc-950 font-black' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
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
      <div className="relative my-0.5 flex flex-col items-center justify-center py-1 bg-white/70 dark:bg-zinc-700/25 rounded-xl border border-zinc-200 dark:border-zinc-700/80 shadow-2xs">
        <div className="w-full max-w-md h-[106px] sm:h-[112px] px-1 relative flex items-center justify-center">
          <svg
            viewBox="0 0 400 135"
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
                <rect x="24" y="24" width="348" height="84" rx="42" ry="42" />
              </clipPath>
            </defs>

            {/* Sombra Suave na Base */}
            <ellipse cx="198" cy="130" rx="175" ry="5" fill="#18181b" opacity="0.3" />

            {/* Berço Esquerdo */}
            <path
              d="M 88 92 L 80 123 L 66 125 L 66 130 L 120 130 L 120 125 L 106 123 L 98 92 Z"
              fill="url(#saddleSupportGrad)"
              stroke="#3f3f46"
              strokeWidth="1.5"
            />
            <circle cx="74" cy="128" r="1.5" fill="#d4d4d8" />
            <circle cx="112" cy="128" r="1.5" fill="#d4d4d8" />

            {/* Berço Direito */}
            <path
              d="M 298 92 L 290 123 L 276 125 L 276 130 L 330 130 L 330 125 L 316 123 L 308 92 Z"
              fill="url(#saddleSupportGrad)"
              stroke="#3f3f46"
              strokeWidth="1.5"
            />
            <circle cx="284" cy="128" r="1.5" fill="#d4d4d8" />
            <circle cx="322" cy="128" r="1.5" fill="#d4d4d8" />

            {/* Barra estrutural horizontal entre berços */}
            <rect x="106" y="119" width="184" height="4" fill="#52525b" stroke="#3f3f46" strokeWidth="1" />

            {/* Válvula Inferior de Dreno */}
            <rect x="190" y="108" width="16" height="14" fill="#71717a" stroke="#3f3f46" strokeWidth="1" />
            <circle cx="198" cy="120" r="3.5" fill="#f59e0b" stroke="#92400e" strokeWidth="1" />

            {/* Boca de Visita Superior */}
            <rect x="178" y="14" width="40" height="12" fill="#71717a" stroke="#3f3f46" strokeWidth="1.5" rx="2.5" />
            <ellipse cx="198" cy="14" rx="22" ry="4.5" fill="#a1a1aa" stroke="#52525b" strokeWidth="1.5" />

            {/* Tubo de Respiro Superior */}
            <path
              d="M 120 24 L 120 8 Q 120 2 127 2 Q 134 2 134 8 L 134 13"
              fill="none"
              stroke="#a1a1aa"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Corpo Metálico do Tanque */}
            <rect
              x="24"
              y="24"
              width="348"
              height="84"
              rx="42"
              ry="42"
              fill="url(#metalCylinderGrad)"
              stroke="#52525b"
              strokeWidth="2.5"
            />

            {/* Costuras de Solda Verticais */}
            <line x1="95" y1="25" x2="95" y2="107" stroke="#52525b" strokeWidth="1.5" opacity="0.6" />
            <line x1="164" y1="25" x2="164" y2="107" stroke="#52525b" strokeWidth="1.5" opacity="0.6" />
            <line x1="232" y1="25" x2="232" y2="107" stroke="#52525b" strokeWidth="1.5" opacity="0.6" />
            <line x1="301" y1="25" x2="301" y2="107" stroke="#52525b" strokeWidth="1.5" opacity="0.6" />

            {/* Câmara Interna com Líquido Diesel */}
            <g clipPath="url(#tankInnerChamberClip)">
              <rect x="24" y="24" width="348" height="84" fill="#3f3f46" opacity="0.55" />

              <line x1="38" y1="45" x2="358" y2="45" stroke="#a1a1aa" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.45" />
              <line x1="38" y1="66" x2="358" y2="66" stroke="#a1a1aa" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.45" />
              <line x1="38" y1="87" x2="358" y2="87" stroke="#a1a1aa" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.45" />

              {litrosDigitados > 0 && nivelAtualPorcentagem > nivelProjetadoPorcentagem && (
                <rect
                  x="24"
                  y={24 + (84 * (1 - nivelAtualPorcentagem / 100))}
                  width="348"
                  height={84 * ((nivelAtualPorcentagem - nivelProjetadoPorcentagem) / 100)}
                  fill="url(#dieselDiffGrad)"
                  className="animate-pulse"
                />
              )}

              {alturaLiquidoEfetiva > 0 && (
                <g>
                  <rect
                    x="24"
                    y={24 + (84 * (1 - alturaLiquidoEfetiva / 100))}
                    width="348"
                    height={84 * (alturaLiquidoEfetiva / 100)}
                    fill="url(#dieselLiquidGrad)"
                    style={{
                      transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                  <line
                    x1="24"
                    y1={24 + (84 * (1 - alturaLiquidoEfetiva / 100))}
                    x2="372"
                    y2={24 + (84 * (1 - alturaLiquidoEfetiva / 100))}
                    stroke="#fef08a"
                    strokeWidth="2"
                    style={{
                      transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </g>
              )}

              <ellipse cx="198" cy="35" rx="140" ry="7" fill="#ffffff" opacity="0.22" />
            </g>

            {/* Contorno externo */}
            <rect
              x="24"
              y="24"
              width="348"
              height="84"
              rx="42"
              ry="42"
              fill="none"
              stroke="#52525b"
              strokeWidth="2.5"
            />

            {/* Placa ONU 1202 DIESEL */}
            <g transform="translate(180, 76)">
              <rect x="0" y="0" width="36" height="19" rx="2" fill="#f97316" stroke="#c2410c" strokeWidth="1" />
              <text x="18" y="8.5" fontSize="6.5" fontWeight="bold" textAnchor="middle" fill="#18181b" fontFamily="sans-serif">
                1202
              </text>
              <text x="18" y="16" fontSize="5.5" fontWeight="bold" textAnchor="middle" fill="#18181b" fontFamily="sans-serif">
                DIESEL
              </text>
            </g>

            {/* Visor Lateral de Nível */}
            <rect x="372" y="36" width="5" height="3" fill="#a1a1aa" />
            <rect x="372" y="94" width="5" height="3" fill="#a1a1aa" />
            <rect x="377" y="32" width="7" height="68" rx="2.5" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
            <rect x="379" y="34" width="3" height="64" rx="1.5" fill="#52525b" />
            {alturaLiquidoEfetiva > 0 && (
              <rect
                x="379"
                y={34 + (64 * (1 - alturaLiquidoEfetiva / 100))}
                width="3"
                height={64 * (alturaLiquidoEfetiva / 100)}
                fill="#f59e0b"
                rx="1"
                style={{
                  transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            )}
          </svg>

          {/* Badge Central Sobreposto */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/95 dark:bg-zinc-800/90 backdrop-blur-xs px-3 py-1 rounded-xl border border-zinc-200 dark:border-zinc-600 shadow-md flex flex-col items-center">
              <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider leading-tight">
                Nível do Tanque
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black text-zinc-900 dark:text-white font-['Outfit'] leading-tight">
                  {alturaLiquidoEfetiva.toFixed(1)}%
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-300 font-semibold">
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
      <div className="relative z-10 space-y-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
        
        {/* Barra de Progresso Horizontal */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] font-semibold">
            <span className="text-zinc-600 dark:text-zinc-300 flex items-center space-x-1">
              <Droplets className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Volume Disponível</span>
            </span>
            <span className="text-zinc-900 dark:text-zinc-100 font-mono font-bold">
              {quantidadeAtual.toLocaleString('pt-BR')} L / {capacidadeTotal.toLocaleString('pt-BR')} L
            </span>
          </div>

          <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-600 p-0.5 relative">
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
          <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-700/60 border border-amber-300 dark:border-amber-500/40 space-y-1 shadow-2xs animate-in fade-in">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-700 dark:text-amber-300 font-semibold flex items-center space-x-1">
                <ArrowDownRight className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Saída Solicitada:</span>
              </span>
              <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                - {litrosDigitados.toLocaleString('pt-BR')} L
              </span>
            </div>

            <div className="pt-0.5 border-t border-zinc-100 dark:border-zinc-600/80 flex items-center justify-between text-[11px]">
              <span className="text-zinc-700 dark:text-zinc-200 font-medium">Saldo Após Abastecimento:</span>
              <div className="flex items-baseline space-x-1">
                <span className={`font-mono font-black ${isEstoqueInsuficiente ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {saldoProjetado.toLocaleString('pt-BR')} L
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-300 font-mono">
                  ({nivelProjetadoPorcentagem.toFixed(1)}%)
                </span>
              </div>
            </div>

            {isEstoqueInsuficiente && (
              <div className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/40 text-[10px] text-rose-700 dark:text-rose-200 font-semibold flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Volume informado excede o saldo do tanque!</span>
              </div>
            )}
          </div>
        ) : (
          <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-700/55 border border-zinc-200 dark:border-zinc-600/80 flex items-center justify-between text-[11px] shadow-2xs">
            <span className="text-zinc-700 dark:text-zinc-200 font-medium flex items-center space-x-1">
              <Fuel className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Saldo Livre para Uso:</span>
            </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-300 text-xs">
              {quantidadeAtual.toLocaleString('pt-BR')} L
            </span>
          </div>
        )}

        {/* Rodapé com Localização e Tipo de Combustível */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-300">
          <span className="truncate max-w-[210px]">
            📍 {tanque?.localizacao || 'Pátio Central / Barracão'}
          </span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {tanque?.tipo_combustivel || 'Diesel S10'}
          </span>
        </div>

      </div>

    </div>
  );
};
