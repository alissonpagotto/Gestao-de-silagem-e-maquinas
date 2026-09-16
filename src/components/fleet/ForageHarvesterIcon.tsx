import React from 'react';

interface ForageHarvesterIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * Ícone SVG personalizado da colhedora/forrageira verde e amarela com fundo 100% transparente,
 * área lateral verde limpa (sem símbolo de cifrão) e traços agrícolas de alta fidelidade.
 */
export const ForageHarvesterIcon: React.FC<ForageHarvesterIconProps> = ({
  className = 'w-6 h-5',
  size,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 54 40"
      fill="none"
      className={`shrink-0 transition-transform ${className}`}
      style={size ? { width: size, height: size } : undefined}
      {...props}
    >
      <defs>
        {/* Gradiente Verde da Lataria */}
        <linearGradient id="fhGreenBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="60%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>

        {/* Gradiente Amarelo do Tubo de Descarga e Rodas */}
        <linearGradient id="fhYellowSpout" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>

        {/* Gradiente do Vidro da Cabine */}
        <linearGradient id="fhCabinGlass" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="60%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      {/* 1. TUBO DE DESCARGA / BICA GIRATÓRIA (Spout) - Amarelo vibrante */}
      <path
        d="M24 16 C25 9, 31 5, 41 6 L43 7.5 L40 9 C32 8.5, 27.5 12, 26 17 Z"
        fill="url(#fhYellowSpout)"
        stroke="#a16207"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Quebra-jato / Ponteira ajustável da bica */}
      <path
        d="M40 5.8 L44 7.2 L43 9.2 L39 7.8 Z"
        fill="#eab308"
        stroke="#854d0e"
        strokeWidth="0.7"
      />

      {/* 2. CHASSI E CORPO DA MÁQUINA (Lataria Verde Lisa - SEM CIFRÃO) */}
      <path
        d="M10 24 L14 14 C14.5 13, 16 12.5, 18 12.5 L36 14 C38 14.5, 39 16, 39 18 L40 27 C40 28, 39 29, 38 29 L11 29 C9.5 29, 9 27.5, 10 24 Z"
        fill="url(#fhGreenBody)"
        stroke="#0f172a"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />

      {/* Friso / Faixa Amarela decorativa lateral */}
      <path
        d="M18 20.5 L38 21.5 L37.8 23 L17.5 22 Z"
        fill="#facc15"
        opacity="0.95"
      />

      {/* Grelha de Ventilação traseira do motor */}
      <line x1="33" y1="16.5" x2="36" y2="16.5" stroke="#14532d" strokeWidth="0.8" strokeLinecap="round" />
      <line x1="33" y1="18" x2="36" y2="18" stroke="#14532d" strokeWidth="0.8" strokeLinecap="round" />

      {/* 3. CABINE PANORÂMICA (Vidro Curvo azul claro) */}
      <path
        d="M14 13.5 L19 8 C20 7, 21.5 7, 24 7.2 L26 8 C26.5 8.2, 26.8 9, 26.5 11 L25 15.5 L14 13.5 Z"
        fill="url(#fhCabinGlass)"
        stroke="#0f172a"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Teto / Capota da Cabine (Verde escuro) */}
      <path
        d="M18.5 7.5 L24.5 6.8 C26.5 6.8, 27.5 7.5, 27.5 8.5 L24 8.8 L18.5 7.5 Z"
        fill="#166534"
        stroke="#0f172a"
        strokeWidth="0.6"
      />
      {/* Reflexo de Luz no Vidro da Cabine */}
      <path
        d="M17 11.5 L21 8.5 L22 9 L18 12.2 Z"
        fill="#ffffff"
        opacity="0.6"
      />

      {/* 4. PLATAFORMA DE CORTE DIANTEIRA (Bicos recolhedores) */}
      <path
        d="M4 25.5 L11 23 L12 28.5 L5 29.5 Z"
        fill="#ca8a04"
        stroke="#78350f"
        strokeWidth="0.8"
      />
      {/* Ponteira dos bicos de corte */}
      <polygon points="2,27 6,24.5 6,29.5" fill="#eab308" stroke="#78350f" strokeWidth="0.6" />
      <polygon points="4,28.5 8,26.5 8,31" fill="#ca8a04" stroke="#78350f" strokeWidth="0.6" />

      {/* 5. RODA TRASEIRA (Direcional menor) */}
      <circle cx="34.5" cy="28.5" r="5.2" fill="#18181b" stroke="#09090b" strokeWidth="1" />
      <circle cx="34.5" cy="28.5" r="3.2" fill="#eab308" stroke="#a16207" strokeWidth="0.8" />
      <circle cx="34.5" cy="28.5" r="1.2" fill="#b91c1c" />

      {/* 6. RODA DIANTEIRA GRANDE (Tração Pesada com Aro Amarelo) */}
      <circle cx="16.5" cy="28" r="7.5" fill="#18181b" stroke="#09090b" strokeWidth="1.2" />
      {/* Garras / Cravos do Pneu Agrícola */}
      <path
        d="M16.5 21.2 L17 22.8 M11.5 24 L12.8 25 M21.5 24 L20.2 25 M10 28 L11.8 28 M23 28 L21.2 28 M11.8 32 L13 31 M21.2 32 L20 31 M16.5 34.8 L17 33.2"
        stroke="#27272a"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Aro Amarelo Forrageira */}
      <circle cx="16.5" cy="28" r="4.8" fill="#facc15" stroke="#ca8a04" strokeWidth="0.9" />
      {/* Cubo Central Planetário */}
      <circle cx="16.5" cy="28" r="2.2" fill="#ca8a04" stroke="#854d0e" strokeWidth="0.7" />
      <circle cx="16.5" cy="28" r="0.9" fill="#dc2626" />
    </svg>
  );
};
