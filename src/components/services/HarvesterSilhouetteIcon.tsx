import React, { useId } from 'react';

interface HarvesterSilhouetteIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * Ícone da silhueta vetorizada da Colhedora / Forrageira Agrícola (Ensiladeira Autopropelida)
 * com bica de descarga curvada, cabine panorâmica, plataforma de corte frontal e fundo 100% transparente.
 */
export const HarvesterSilhouetteIcon: React.FC<HarvesterSilhouetteIconProps> = ({
  className = 'w-4 h-4',
  size,
  ...props
}) => {
  const rawId = useId();
  const maskId = `harvester-mask-${rawId.replace(/:/g, '')}`;

  return (
    <svg
      viewBox="0 0 135 95"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        width: size || undefined,
        height: size || undefined,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <mask id={maskId}>
          {/* Base branca visível */}
          <rect width="135" height="95" fill="white" />

          {/* Janelas da Cabine (Espaço negativo transparente) */}
          {/* Janela Frontal (inclinada) */}
          <polygon points="54,34 61.5,34 62.5,46 56,46" fill="black" />
          {/* Janela Lateral / Traseira */}
          <polygon points="63.5,34 74,34 73,46 64.5,46" fill="black" />

          {/* Aletas de Refrigeração do Capô do Motor (2 linhas x 3 fendas) */}
          <rect x="85" y="47.5" width="4.5" height="1.1" rx="0.3" fill="black" />
          <rect x="91" y="47.5" width="4.5" height="1.1" rx="0.3" fill="black" />
          <rect x="85" y="49.8" width="4.5" height="1.1" rx="0.3" fill="black" />
          <rect x="91" y="49.8" width="4.5" height="1.1" rx="0.3" fill="black" />

          {/* Fendas / Aletas Traseiras */}
          <rect x="114" y="53.5" width="3" height="1" rx="0.3" fill="black" />
          <rect x="114" y="55.5" width="3" height="1" rx="0.3" fill="black" />
          <rect x="114" y="57.5" width="3" height="1" rx="0.3" fill="black" />

          {/* Vão do Aro da Roda Dianteira (Anel transparente deixando a roda com pneu + aro transparente + cubo central preto) */}
          <circle cx="67" cy="60.5" r="7.8" fill="black" />
          <circle cx="67" cy="60.5" r="4.3" fill="white" />

          {/* Vão do Aro da Roda Traseira (Anel transparente) */}
          <circle cx="106" cy="62.5" r="5.6" fill="black" />
          <circle cx="106" cy="62.5" r="3.1" fill="white" />
        </mask>
      </defs>

      {/* 
        BICA DE DESCARGA (CHUTE DE FORRAGEM)
        Curva arqueada elegante e bocal defletor na extremidade superior direita
      */}
      <path
        d="M79 44
           L79 40
           C79 39.5 82 28 92.5 20.5
           C98.5 15.8 108 13.5 117.5 18.5
           L119.5 20.2
           L116 22
           C107 17.5 98.5 20.5 94 26.5
           C89.5 32.5 86.5 38.5 86 44
           Z"
      />

      {/* Base Giratória da Bica */}
      <rect x="78" y="39.5" width="8.5" height="5" rx="0.8" />

      {/* Elementos que usam a máscara de recorte para transparência perfeita */}
      <g mask={`url(#${maskId})`}>
        {/* Teto e Moldura da Cabine */}
        <path
          d="M51 31
             L77 31
             L77 33.5
             L75.5 33.5
             L74.5 48.5
             L54.5 48.5
             L52.5 33.5
             L51 33.5
             Z"
        />

        {/* Chassi e Capô do Motor */}
        <path
          d="M74 44
             L95 44
             C97.5 44 99.5 44.5 101 45.8
             C103.5 47.5 105.5 48.5 112 48.5
             C114 48.5 115.5 49.5 116 51
             L118 55
             L117 60
             L113 62
             C112 58 109.5 56 106 56
             C102 56 100 58.5 99.8 63
             L86 63
             L86 57.5
             L82 57.5
             L82 51.5
             L74 51.5
             Z"
        />

        {/* Tubo de Escapamento com Curva Superior */}
        <path
          d="M98.5 44
             L98.5 37.5
             C98.5 36.8 99.5 36.5 100.5 37
             L100.5 44
             Z"
        />

        {/* Plataforma Base do Operador e Guarda-lamas */}
        <path
          d="M53.5 48.5
             L76.5 48.5
             L76.5 58
             L73 58
             L73 51
             C69 49.5 62 49.5 58 52
             L55.5 55
             L53.5 55
             Z"
        />

        {/* Roda Dianteira (Grande - Pneu de Alta Flutuação) */}
        <circle cx="67" cy="60.5" r="11" />

        {/* Roda Traseira (Menor - Direcional) */}
        <circle cx="106" cy="62.5" r="8" />

        {/* Plataforma Frontal de Corte (Recolhedor de Forragem) */}
        {/* Barra superior do recolhedor */}
        <path
          d="M25 58.5
             L23.5 61
             L44 61
             L44 59.5
             L26 59.5
             Z"
        />

        {/* Corpo principal e bico da plataforma de corte */}
        <path
          d="M19.5 63
             L43 58.5
             L46 58.5
             L48 57
             L53 57
             L53 64
             L46 64
             L45 66.5
             L34 66.5
             C27 67 21 65.5 19.5 63
             Z"
        />

        {/* Garganta do alimentador / bocal que conecta a plataforma à máquina */}
        <path
          d="M47 57
             L55 56
             L55 61
             L48 61
             Z"
        />
      </g>
    </svg>
  );
};

export default HarvesterSilhouetteIcon;
