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
 * Ilustração 50% industrial de um Tanque Aéreo Horizontal de Fazenda (Metal/Aço)
 * - Formato oval deitado de metal com berços de apoio, boca de visita e visor de nível
 * - Preenchimento do líquido na cor Laranja/Âmbar (cor do Diesel)
 * - Altura do líquido sobe ou desce dinamicamente em tempo real de acordo com a porcentagem calculada:
 *   (quantidade_atual / capacidade_total * 100) do tanque selecionado
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
    <div className="bg-gradient-to-b from-stone-900 via-stone-850 to-stone-900 border border-stone-700/80 rounded-2xl p-3.5 shadow-xl text-stone-100 flex flex-col justify-between select-none relative overflow-hidden">
      
      {/* Luz ambiente de fundo no topo (efeito sutil de iluminação de hangar) */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-20 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

      {/* Cabeçalho do Tanque da Fazenda */}
      <div className="relative z-10 space-y-2 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Warehouse className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider font-['Outfit']">
                  Tanque Interno (Fazenda)
                </h4>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                  Aéreo
                </span>
              </div>
              <p className="text-[11px] font-bold text-stone-200 truncate max-w-[220px]">
                {tanque?.nome || 'Tanque Principal Diesel S10'}
              </p>
            </div>
          </div>

          {/* Badge de Status Operacional */}
          <div className="text-right">
            {isEstoqueInsuficiente ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                <span>Saldo Insuficiente</span>
              </span>
            ) : isNivelCritico ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-3 h-3" />
                <span>Nível Crítico</span>
              </span>
            ) : isNivelBaixo ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="w-3 h-3" />
                <span>Nível Baixo</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                <span>Operacional</span>
              </span>
            )}
          </div>
        </div>

        {/* Seletor rápido de tanques cadastrados (se houver múltiplos tanques) */}
        {tanques.length > 1 && onTanqueChange && (
          <div className="flex items-center space-x-1.5 pt-1">
            <span className="text-[10px] text-stone-400 font-semibold shrink-0">Trocar Tanque:</span>
            <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 w-full">
              {tanques.map((t) => {
                const isSelected = t.id === tanque?.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onTanqueChange(t.id)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 shadow-xs'
                        : 'bg-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-750 border border-stone-700/60'
                    }`}
                  >
                    {t.nome}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ILUSTRAÇÃO 50% INDUSTRIAL: TANQUE AÉREO HORIZONTAL (METAL / AÇO OVAL DEITADO) */}
      {/* ========================================================================= */}
      <div className="relative my-2 py-1 px-1 flex flex-col items-center justify-center">
        
        {/* SVG Tanque Horizontal Industrial Completo */}
        <div className="w-full max-w-[340px] aspect-[16/9] relative flex items-center justify-center">
          <svg
            viewBox="0 0 400 220"
            className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Gradiente Metálico do Corpo do Tanque (Aço Industrial) */}
              <linearGradient id="metalCylinderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="12%" stopColor="#94a3b8" />
                <stop offset="35%" stopColor="#cbd5e1" />
                <stop offset="55%" stopColor="#64748b" />
                <stop offset="85%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              {/* Gradiente da Tampa Abaulada Esquerda */}
              <radialGradient id="domedLeftGrad" cx="30%" cy="40%" r="70%">
                <stop offset="0%" stopColor="#cbd5e1" />
                <stop offset="50%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#1e293b" />
              </radialGradient>

              {/* Gradiente da Tampa Abaulada Direita */}
              <radialGradient id="domedRightGrad" cx="70%" cy="40%" r="70%">
                <stop offset="0%" stopColor="#cbd5e1" />
                <stop offset="50%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#1e293b" />
              </radialGradient>

              {/* Gradiente do Líquido Diesel S10 / S500 (Laranja / Âmbar Rico) */}
              <linearGradient id="dieselLiquidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.95" />
                <stop offset="15%" stopColor="#f59e0b" stopOpacity="0.92" />
                <stop offset="60%" stopColor="#d97706" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#92400e" stopOpacity="0.98" />
              </linearGradient>

              {/* Gradiente da Projeção de Saída de Combustível (Diferença) */}
              <linearGradient id="dieselDiffGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.25" />
              </linearGradient>

              {/* Gradiente Berço / Suporte Estrutural de Aço */}
              <linearGradient id="saddleSupportGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="50%" stopColor="#475569" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              {/* Máscara de recorte interna para o formato oval deitado com pontas abauladas */}
              <clipPath id="tankInnerChamberClip">
                {/* Corpo central cilíndrico e tampas arredondadas abauladas */}
                <rect x="75" y="45" width="250" height="120" rx="60" ry="60" />
              </clipPath>
            </defs>

            {/* Sombra de Contato no Solo Industrial */}
            <ellipse cx="200" cy="205" rx="160" ry="10" fill="#000000" opacity="0.6" filter="blur(4px)" />

            {/* Berços de Sustentação de Aço (Saddle Supports - Esquerdo e Direito) */}
            {/* Berço Esquerdo */}
            <path
              d="M 105 130 L 95 195 L 75 198 L 75 205 L 145 205 L 145 198 L 125 195 L 115 130 Z"
              fill="url(#saddleSupportGrad)"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            {/* Parafusos da sapata esquerda */}
            <circle cx="85" cy="201" r="2" fill="#94a3b8" />
            <circle cx="135" cy="201" r="2" fill="#94a3b8" />

            {/* Berço Direito */}
            <path
              d="M 285 130 L 275 195 L 255 198 L 255 205 L 325 205 L 325 198 L 305 195 L 295 130 Z"
              fill="url(#saddleSupportGrad)"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            {/* Parafusos da sapata direita */}
            <circle cx="265" cy="201" r="2" fill="#94a3b8" />
            <circle cx="315" cy="201" r="2" fill="#94a3b8" />

            {/* Barra estrutural de amarração horizontal entre os berços */}
            <rect x="125" y="185" width="150" height="6" fill="#334155" stroke="#1e293b" strokeWidth="1" />

            {/* Tubo de Aterramento Anti-estático (Haste) */}
            <line x1="80" y1="198" x2="65" y2="208" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2" />
            <circle cx="65" cy="208" r="3" fill="#d97706" />

            {/* Válvula / Tubulação de Saída Inferior (Dreno e Saída para Bomba) */}
            <rect x="190" y="160" width="20" height="25" fill="#475569" stroke="#1e293b" strokeWidth="1" />
            <polygon points="185,185 215,185 210,192 190,192" fill="#64748b" stroke="#1e293b" strokeWidth="1" />
            {/* Registro de esfera em bronze/latão */}
            <circle cx="200" cy="180" r="5" fill="#d97706" stroke="#92400e" strokeWidth="1" />
            <rect x="198" y="172" width="12" height="4" rx="2" fill="#b91c1c" />

            {/* Boca de Visita Superior / Flange com Tampa Parafusada */}
            <rect x="180" y="32" width="40" height="15" fill="#475569" stroke="#1e293b" strokeWidth="1.5" rx="3" />
            <ellipse cx="200" cy="32" rx="22" ry="6" fill="#64748b" stroke="#334155" strokeWidth="1.5" />
            {/* Parafusos da tampa superior */}
            <circle cx="184" cy="32" r="1.5" fill="#cbd5e1" />
            <circle cx="192" cy="34" r="1.5" fill="#cbd5e1" />
            <circle cx="200" cy="35" r="1.5" fill="#cbd5e1" />
            <circle cx="208" cy="34" r="1.5" fill="#cbd5e1" />
            <circle cx="216" cy="32" r="1.5" fill="#cbd5e1" />

            {/* Tubo de Respiro Tubular Curvo (Pescoço de Ganso) no Topo */}
            <path
              d="M 140 45 L 140 18 Q 140 10 148 10 Q 156 10 156 18 L 156 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Tela de proteção contra insetos do respiro */}
            <ellipse cx="156" cy="24" rx="3.5" ry="1.5" fill="#334155" stroke="#94a3b8" strokeWidth="0.8" />

            {/* ======================================================= */}
            {/* CASCA DO CORPO DO TANQUE HORIZONTAL (OVAL METÁLICO) */}
            {/* ======================================================= */}
            {/* Base sólida do tanque */}
            <rect
              x="75"
              y="45"
              width="250"
              height="120"
              rx="60"
              ry="60"
              fill="url(#metalCylinderGrad)"
              stroke="#1e293b"
              strokeWidth="2.5"
            />

            {/* Costuras de Solda Estruturais (Weld Lines Verticais) */}
            <line x1="140" y1="46" x2="140" y2="164" stroke="#475569" strokeWidth="1.5" opacity="0.7" />
            <line x1="200" y1="46" x2="200" y2="164" stroke="#475569" strokeWidth="1.5" opacity="0.7" />
            <line x1="260" y1="46" x2="260" y2="164" stroke="#475569" strokeWidth="1.5" opacity="0.7" />

            {/* ======================================================= */}
            {/* CÂMARA INTERNA COM O LÍQUIDO DIESEL (LARANJA / ÂMBAR) */}
            {/* ======================================================= */}
            <g clipPath="url(#tankInnerChamberClip)">
              {/* Fundo interno da câmara (vazio escurecido de metal) */}
              <rect x="75" y="45" width="250" height="120" fill="#0f172a" opacity="0.65" />

              {/* Grade de linhas de medição no fundo */}
              <line x1="85" y1="75" x2="315" y2="75" stroke="#334155" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.4" />
              <line x1="85" y1="105" x2="315" y2="105" stroke="#334155" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.4" />
              <line x1="85" y1="135" x2="315" y2="135" stroke="#334155" strokeWidth="0.8" strokeDasharray="4,4" opacity="0.4" />

              {/* 1. SE HOUVER ABASTECIMENTO EM CURSO: Área de saída (Litros deduzidos) */}
              {litrosDigitados > 0 && nivelAtualPorcentagem > nivelProjetadoPorcentagem && (
                <rect
                  x="75"
                  y={45 + (120 * (1 - nivelAtualPorcentagem / 100))}
                  width="250"
                  height={120 * ((nivelAtualPorcentagem - nivelProjetadoPorcentagem) / 100)}
                  fill="url(#dieselDiffGrad)"
                  className="animate-pulse"
                />
              )}

              {/* 2. LÍQUIDO EFETIVO DE DIESEL (Laranja/Âmbar) */}
              {alturaLiquidoEfetiva > 0 && (
                <g>
                  {/* Bloco principal do líquido de diesel */}
                  <rect
                    x="75"
                    y={45 + (120 * (1 - alturaLiquidoEfetiva / 100))}
                    width="250"
                    height={120 * (alturaLiquidoEfetiva / 100)}
                    fill="url(#dieselLiquidGrad)"
                    style={{
                      transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />

                  {/* Menisco / Superfície do líquido com brilho dourado e onda realista */}
                  <line
                    x1="75"
                    y1={45 + (120 * (1 - alturaLiquidoEfetiva / 100))}
                    x2="325"
                    y2={45 + (120 * (1 - alturaLiquidoEfetiva / 100))}
                    stroke="#fef08a"
                    strokeWidth="2.5"
                    style={{
                      transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />

                  {/* Partículas sutis e reflexos internos no líquido */}
                  <ellipse
                    cx="150"
                    cy={45 + (120 * (1 - alturaLiquidoEfetiva / 100)) + 15}
                    rx="40"
                    ry="6"
                    fill="#fbbf24"
                    opacity="0.35"
                    style={{
                      transition: 'cy 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                  <ellipse
                    cx="250"
                    cy={45 + (120 * (1 - alturaLiquidoEfetiva / 100)) + 25}
                    rx="30"
                    ry="5"
                    fill="#f59e0b"
                    opacity="0.3"
                    style={{
                      transition: 'cy 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </g>
              )}

              {/* Reflexo vítreo e metálico frontal curvado (Glossy Highlight Industrial) */}
              <ellipse cx="200" cy="60" rx="100" ry="12" fill="#ffffff" opacity="0.15" />
              <path
                d="M 85 55 Q 200 48 315 55 Q 200 68 85 55 Z"
                fill="#ffffff"
                opacity="0.2"
              />
            </g>

            {/* Borda externa com reforço metálico industrial */}
            <rect
              x="75"
              y="45"
              width="250"
              height="120"
              rx="60"
              ry="60"
              fill="none"
              stroke="#0f172a"
              strokeWidth="3"
            />

            {/* Aro de reforço das extremidades abauladas */}
            <path d="M 135 46 Q 142 105 135 164" fill="none" stroke="#334155" strokeWidth="2" opacity="0.6" />
            <path d="M 265 46 Q 258 105 265 164" fill="none" stroke="#334155" strokeWidth="2" opacity="0.6" />

            {/* Placa de Identificação de Risco (Diamante NFPA 704 / ONU 1202 DIESEL) */}
            <g transform="translate(182, 115)">
              <rect x="0" y="0" width="36" height="22" rx="2" fill="#f97316" stroke="#c2410c" strokeWidth="1" />
              <text x="18" y="10" fontSize="7" fontWeight="bold" textAnchor="middle" fill="#000000" fontFamily="sans-serif">
                1202
              </text>
              <text x="18" y="18" fontSize="6" fontWeight="bold" textAnchor="middle" fill="#000000" fontFamily="sans-serif">
                DIESEL
              </text>
            </g>

            {/* Tubo Visor Externo de Nível em Vidro com Graduação (Lado Direito) */}
            <rect x="330" y="55" width="8" height="100" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1" />
            <rect x="332" y="57" width="4" height="96" rx="2" fill="#1e293b" />
            {/* Coluna de líquido no visor de vidro */}
            {alturaLiquidoEfetiva > 0 && (
              <rect
                x="332"
                y={57 + (96 * (1 - alturaLiquidoEfetiva / 100))}
                width="4"
                height={96 * (alturaLiquidoEfetiva / 100)}
                fill="#f59e0b"
                rx="1"
                style={{
                  transition: 'y 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            )}
            {/* Marcas de graduação no visor */}
            <line x1="330" y1="57" x2="333" y2="57" stroke="#94a3b8" strokeWidth="1" />
            <line x1="330" y1="81" x2="333" y2="81" stroke="#94a3b8" strokeWidth="1" />
            <line x1="330" y1="105" x2="333" y2="105" stroke="#94a3b8" strokeWidth="1" />
            <line x1="330" y1="129" x2="333" y2="129" stroke="#94a3b8" strokeWidth="1" />
            <line x1="330" y1="153" x2="333" y2="153" stroke="#94a3b8" strokeWidth="1" />

            {/* Conectores do Visor de Vidro */}
            <rect x="325" y="58" width="5" height="4" fill="#64748b" />
            <rect x="325" y="148" width="5" height="4" fill="#64748b" />
          </svg>

          {/* Porcentagem Central Sobreposta com Tipografia Industrial */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-stone-950/80 backdrop-blur-xs px-3 py-1 rounded-xl border border-stone-700/80 shadow-lg flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                Nível do Tanque
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl sm:text-2xl font-black text-white font-['Outfit']">
                  {alturaLiquidoEfetiva.toFixed(1)}%
                </span>
                <span className="text-[10px] text-stone-400 font-bold">
                  {tanque?.tipo_combustivel || 'Diesel S10'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* PAINEL DE DADOS: CAPACIDADE, SALDO ATUAL E PROJEÇÃO DE SAÍDA */}
      {/* ========================================================================= */}
      <div className="relative z-10 space-y-2 mt-1">
        
        {/* Barra de Progresso Horizontal Secundária */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-stone-400 flex items-center space-x-1">
              <Droplets className="w-3 h-3 text-amber-500" />
              <span>Volume Disponível</span>
            </span>
            <span className="text-stone-200 font-mono">
              {quantidadeAtual.toLocaleString('pt-BR')} L / {capacidadeTotal.toLocaleString('pt-BR')} L
            </span>
          </div>

          <div className="w-full h-2.5 bg-stone-800 rounded-full overflow-hidden border border-stone-700 p-0.5 relative">
            {/* Nível Atual Base */}
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
          <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-300 font-semibold flex items-center space-x-1">
                <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
                <span>Saída Solicitada:</span>
              </span>
              <span className="font-mono font-black text-amber-400">
                - {litrosDigitados.toLocaleString('pt-BR')} L
              </span>
            </div>

            <div className="pt-1 border-t border-amber-500/20 flex items-center justify-between text-xs">
              <span className="text-stone-300 font-medium">Saldo Após Este Abastecimento:</span>
              <div className="text-right">
                <span className={`font-mono font-black ${isEstoqueInsuficiente ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {saldoProjetado.toLocaleString('pt-BR')} L
                </span>
                <span className="text-[10px] text-stone-400 block">
                  ({nivelProjetadoPorcentagem.toFixed(1)}% do tanque)
                </span>
              </div>
            </div>

            {isEstoqueInsuficiente && (
              <div className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-[10px] text-rose-300 font-bold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>Volume informado excede o saldo existente no tanque!</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2 rounded-xl bg-stone-800/60 border border-stone-700/60 flex items-center justify-between text-xs">
            <span className="text-stone-400 font-medium flex items-center space-x-1.5">
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              <span>Saldo Livre para Uso:</span>
            </span>
            <span className="font-mono font-black text-amber-300 text-sm">
              {quantidadeAtual.toLocaleString('pt-BR')} L
            </span>
          </div>
        )}

        {/* Rodapé com Localização e Tipo de Combustível */}
        <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5 border-t border-stone-800">
          <span className="truncate max-w-[180px]">
            📍 {tanque?.localizacao || 'Pátio Central / Barracão'}
          </span>
          <span className="font-bold text-amber-400">
            {tanque?.tipo_combustivel || 'Diesel S10'}
          </span>
        </div>

      </div>

    </div>
  );
};
