import React from 'react';

interface ColacaSilagemEmblemProps {
  className?: string;
}

export const ColacaSilagemEmblem: React.FC<ColacaSilagemEmblemProps> = ({ 
  className = 'w-[580px] max-w-[95vw] h-auto mb-2 sm:mb-3 mx-auto block' 
}) => {
  return (
    <svg 
      viewBox="0 0 460 220" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Gradiente do Escudo */}
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* Gradiente da Placa Verde */}
        <linearGradient id="bannerGreen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="30%" stopColor="#22c55e" />
          <stop offset="70%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>

        {/* Gradiente do Texto COLAÇA */}
        <linearGradient id="textColaca" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* Gradiente Metálico da Borda */}
        <linearGradient id="metallicBorder" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Filtro de Sombra 3D */}
        <filter id="emblemShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.4" />
        </filter>
        <filter id="bannerShadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* 1. Base do Escudo Angular Escuro */}
      <path 
        d="M 50 25 L 410 25 L 435 75 L 410 185 L 230 215 L 50 185 L 25 75 Z" 
        fill="url(#shieldGrad)" 
        stroke="url(#metallicBorder)" 
        strokeWidth="6" 
        strokeLinejoin="round"
        filter="url(#emblemShadow)"
      />

      {/* Borda interna estilizada */}
      <path 
        d="M 60 35 L 400 35 L 420 78 L 398 175 L 230 203 L 62 175 L 40 78 Z" 
        fill="none" 
        stroke="#334155" 
        strokeWidth="2" 
        strokeDasharray="6 3"
      />

      {/* 2. Texto Principal: COLAÇA em caixa alta robusta */}
      <text 
        x="230" 
        y="98" 
        textAnchor="middle" 
        fill="url(#textColaca)" 
        stroke="#020617" 
        strokeWidth="5" 
        paintOrder="stroke fill"
        fontFamily="Impact, 'Arial Black', sans-serif" 
        fontSize="68" 
        fontWeight="900" 
        letterSpacing="4"
      >
        COLAÇA
      </text>

      {/* 3. Banner / Placa Verde com SILAGEM */}
      <g filter="url(#bannerShadow)">
        {/* Faixa chanfrada verde */}
        <path 
          d="M 100 115 L 360 115 L 380 160 L 350 160 L 230 168 L 110 160 L 80 160 Z" 
          fill="url(#bannerGreen)" 
          stroke="#f8fafc" 
          strokeWidth="3.5" 
          strokeLinejoin="round"
        />
        {/* Linha de brilho do topo da faixa */}
        <path 
          d="M 104 120 L 356 120" 
          stroke="#86efac" 
          strokeWidth="2" 
          strokeLinecap="round" 
          opacity="0.8" 
        />
        {/* Texto SILAGEM */}
        <text 
          x="230" 
          y="150" 
          textAnchor="middle" 
          fill="#ffffff" 
          stroke="#14532d" 
          strokeWidth="3" 
          paintOrder="stroke fill"
          fontFamily="Impact, 'Arial Black', sans-serif" 
          fontSize="36" 
          fontWeight="900" 
          letterSpacing="8"
        >
          SILAGEM
        </text>
      </g>

      {/* 4. Grafismo sutil de ensiladeira / rotor na ponta inferior do escudo */}
      <g transform="translate(195, 172) scale(0.35)" opacity="0.95">
        {/* Corpo compacto da máquina */}
        <rect x="0" y="20" width="160" height="60" rx="8" fill="#22c55e" stroke="#14532d" strokeWidth="4" />
        {/* Cabine */}
        <path d="M 90 20 L 115 -15 L 155 -15 L 160 20 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="4" />
        {/* Tubo de descarga */}
        <path d="M 50 20 C 40 -35, 120 -55, 140 -40" fill="none" stroke="#eab308" strokeWidth="10" strokeLinecap="round" />
        {/* Rodas */}
        <circle cx="45" cy="80" r="24" fill="#1e293b" stroke="#f8fafc" strokeWidth="4" />
        <circle cx="135" cy="80" r="18" fill="#1e293b" stroke="#f8fafc" strokeWidth="4" />
      </g>
    </svg>
  );
};

export default ColacaSilagemEmblem;
