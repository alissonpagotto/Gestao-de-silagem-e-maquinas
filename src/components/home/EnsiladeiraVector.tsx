import React from 'react';

interface EnsiladeiraVectorProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const EnsiladeiraVector: React.FC<EnsiladeiraVectorProps> = ({ 
  className = '',
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-16 h-10',
    md: 'w-28 h-18 sm:w-36 sm:h-22',
    lg: 'w-44 h-28 sm:w-56 sm:h-34',
    xl: 'w-64 h-40'
  };

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${sizeClasses[size]} ${className}`}>
      <svg
        viewBox="0 0 340 210"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md overflow-visible"
      >
        <defs>
          {/* Degradês de Pintura Verde Agro (John Deere / Claas Metallic Green) */}
          <linearGradient id="ens-green-body" x1="50" y1="60" x2="280" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="35%" stopColor="#16a34a" />
            <stop offset="85%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>

          <linearGradient id="ens-green-highlight" x1="100" y1="70" x2="100" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>

          <linearGradient id="ens-green-dark" x1="160" y1="100" x2="270" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#0f3d1e" />
          </linearGradient>

          {/* Degradê Bica de Descarga */}
          <linearGradient id="ens-chute" x1="160" y1="20" x2="270" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="30%" stopColor="#22c55e" />
            <stop offset="80%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>

          {/* Degradê Vidro da Cabine */}
          <linearGradient id="ens-cab-glass" x1="90" y1="50" x2="145" y2="105" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="25%" stopColor="#7dd3fc" />
            <stop offset="65%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>

          {/* Degradê Cifrão Dourado / Cifrão de Silagem */}
          <linearGradient id="ens-gold-badge" x1="170" y1="102" x2="202" y2="134" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="25%" stopColor="#facc15" />
            <stop offset="70%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ca8a04" />
          </linearGradient>

          <linearGradient id="ens-gold-inner" x1="172" y1="104" x2="200" y2="132" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>

          {/* Degradê Rodas e Aros */}
          <linearGradient id="ens-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#a16207" />
          </linearGradient>

          <linearGradient id="ens-tire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="60%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090d16" />
          </linearGradient>

          {/* Sombra de chão */}
          <radialGradient id="ens-ground-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(15,23,42,0.4)" />
            <stop offset="60%" stopColor="rgba(15,23,42,0.2)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </radialGradient>
        </defs>

        {/* 1. Sombra de solo / projeção no chão */}
        <ellipse cx="170" cy="192" rx="145" ry="12" fill="url(#ens-ground-shadow)" />

        {/* 2. BICA DE DESCARGA / TUBO DESCARREGADOR CURVADO */}
        {/* Base giratória da bica */}
        <rect x="155" y="80" width="16" height="12" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="1" />
        <path
          d="M162 82 C168 55, 190 28, 235 22 C262 18, 285 24, 298 32 C302 34, 304 38, 298 40 C285 36, 260 30, 236 34 C198 40, 178 64, 172 84 Z"
          fill="url(#ens-chute)"
          stroke="#0f3d1e"
          strokeWidth="1.2"
        />
        {/* Detalhe de reflexo na bica */}
        <path
          d="M168 76 C176 52, 198 34, 236 28 C258 24, 280 28, 292 34"
          stroke="#86efac"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.8"
        />
        {/* Ponteira / Defletor de Descarga com Listras de Segurança (Amarelo / Preto) */}
        <g transform="translate(288, 28) rotate(15)">
          <rect x="0" y="0" width="16" height="10" rx="1.5" fill="#eab308" stroke="#1e293b" strokeWidth="0.8" />
          <line x1="4" y1="0" x2="1" y2="10" stroke="#0f172a" strokeWidth="2.2" />
          <line x1="9" y1="0" x2="6" y2="10" stroke="#0f172a" strokeWidth="2.2" />
          <line x1="14" y1="0" x2="11" y2="10" stroke="#0f172a" strokeWidth="2.2" />
        </g>
        {/* Pistão hidráulico da bica */}
        <path d="M174 74 L196 54" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M173 75 L184 65" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />

        {/* 3. CORPO TRASEIRO / CAPÔ DO MOTOR */}
        <path
          d="M150 90 L268 96 C276 96, 284 104, 284 114 L282 154 C282 158, 278 162, 274 162 L248 162 L246 148 C244 135, 230 126, 218 128 L150 134 Z"
          fill="url(#ens-green-dark)"
          stroke="#0f3d1e"
          strokeWidth="1.2"
        />
        {/* Parte superior do capô com degradê mais claro */}
        <path
          d="M148 90 L266 96 C272 96, 278 101, 279 107 L200 105 L148 102 Z"
          fill="url(#ens-green-highlight)"
          opacity="0.7"
        />
        {/* Grelhas de ventilação do motor traseiro */}
        <g opacity="0.6">
          <line x1="228" y1="106" x2="264" y2="107" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="228" y1="112" x2="264" y2="113" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="228" y1="118" x2="264" y2="119" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="232" y1="124" x2="260" y2="125" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        {/* Escapamento cromado com ponteira curva */}
        <path d="M256 96 L256 68 C256 65, 258 63, 262 63 L265 63" stroke="#94a3b8" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M257 69 L257 65" stroke="#f1f5f9" strokeWidth="1.2" strokeLinecap="round" />

        {/* 4. CABINE DO OPERADOR (PANORÂMICA AERODINÂMICA) */}
        {/* Teto da cabine com saliência e faróis */}
        <path
          d="M86 52 C95 48, 140 48, 156 50 C160 51, 163 54, 162 58 L160 62 L84 62 L84 56 C84 53, 85 52, 86 52 Z"
          fill="#1e293b"
          stroke="#0f172a"
          strokeWidth="1"
        />
        {/* Faróis auxiliares de LED no teto */}
        <rect x="92" y="58" width="8" height="3" rx="1" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.5" />
        <rect x="104" y="58" width="8" height="3" rx="1" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.5" />
        <rect x="116" y="58" width="8" height="3" rx="1" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.5" />
        <rect x="128" y="58" width="8" height="3" rx="1" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.5" />
        
        {/* Vidro panorâmico curvo frontal */}
        <path
          d="M86 62 L159 62 L152 104 C151 108, 147 111, 142 111 L102 111 C96 111, 91 106, 88 100 L84 68 Z"
          fill="url(#ens-cab-glass)"
          stroke="#1e293b"
          strokeWidth="1.2"
        />
        {/* Coluna A da cabine (curvada e fina) */}
        <path d="M86 62 L89 100" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M158 62 L151 104" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
        
        {/* Silhueta interior do operador e volante */}
        <circle cx="126" cy="80" r="5" fill="rgba(15,23,42,0.4)" />
        <path d="M120 96 C120 89, 132 89, 132 96 Z" fill="rgba(15,23,42,0.45)" />
        <ellipse cx="112" cy="90" rx="3" ry="1.5" fill="rgba(15,23,42,0.5)" transform="rotate(-20 112 90)" />

        {/* Reflexo luminoso moderno no para-brisa curvo */}
        <path
          d="M93 65 L118 65 L106 106 L95 106 Z"
          fill="white"
          opacity="0.22"
        />

        {/* Retrovisor externo */}
        <rect x="80" y="70" width="3.5" height="10" rx="1" fill="#0f172a" />
        <line x1="83.5" y1="74" x2="86" y2="76" stroke="#0f172a" strokeWidth="1.2" />

        {/* Escada de acesso à cabine com corrimão */}
        <line x1="140" y1="112" x2="135" y2="152" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="146" y1="112" x2="141" y2="152" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="138" y1="124" x2="144" y2="124" stroke="#64748b" strokeWidth="1.5" />
        <line x1="137" y1="136" x2="143" y2="136" stroke="#64748b" strokeWidth="1.5" />
        <line x1="136" y1="148" x2="142" y2="148" stroke="#64748b" strokeWidth="1.5" />

        {/* 5. GABINETE CENTRAL LATERAL (CHASSI VERDE PRINCIPAL) */}
        <path
          d="M98 108 L170 102 L225 106 L224 148 L142 148 L138 132 L98 130 Z"
          fill="url(#ens-green-body)"
          stroke="#0f3d1e"
          strokeWidth="1.4"
        />
        {/* Vinco estilístico metálico na lateral */}
        <path d="M102 114 L220 110" stroke="#86efac" strokeWidth="1" opacity="0.6" />

        {/* 6. O CIFRÃO ($) DE SILAGEM NA LATERAL DA ENSILADEIRA (DESTAQUE ABSOLUTO DO PRINT 3) */}
        <g id="ensiladeira-cifrao-emblema" transform="translate(182, 124)">
          {/* Sombra do medalhão */}
          <circle cx="0" cy="1" r="15" fill="rgba(0,0,0,0.3)" />
          
          {/* Anel metálico externo dourado */}
          <circle cx="0" cy="0" r="14.5" fill="url(#ens-gold-badge)" stroke="#92400e" strokeWidth="1" />
          
          {/* Fundo do medalhão com gradiente quente */}
          <circle cx="0" cy="0" r="12" fill="url(#ens-gold-inner)" stroke="#fef08a" strokeWidth="0.8" />
          
          {/* Borda interna fina com brilho */}
          <circle cx="0" cy="0" r="10.5" fill="none" stroke="#fef9c3" strokeWidth="0.6" strokeDasharray="1.5 1" opacity="0.7" />
          
          {/* O Cifrão ($) em alto relevo tridimensional */}
          <text
            x="0"
            y="5.5"
            textAnchor="middle"
            fontSize="16"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            fill="#78350f"
            opacity="0.35"
            dx="0.8"
            dy="0.8"
          >
            $
          </text>
          <text
            x="0"
            y="5.5"
            textAnchor="middle"
            fontSize="16"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            fill="#ffffff"
          >
            $
          </text>
          <text
            x="0"
            y="5.5"
            textAnchor="middle"
            fontSize="15"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            fill="#854d0e"
          >
            $
          </text>
        </g>

        {/* 7. PLATAFORMA DE CORTE FRONTAL / CARRETILHA DE SILAGEM */}
        {/* Garganta alimentadora / Feederhouse */}
        <path d="M72 126 L98 120 L96 148 L68 152 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
        {/* Plataforma de corte de forragem / Tambores rotativos frontais */}
        <g transform="translate(18, 128)">
          {/* Base e suporte de corte */}
          <path d="M12 28 L54 18 L52 36 L10 40 Z" fill="#15803d" stroke="#0f3d1e" strokeWidth="1" />
          {/* Bicos divisores e carretilhas (Milho / Forragem) */}
          <polygon points="4,38 18,16 26,38" fill="#eab308" stroke="#a16207" strokeWidth="1" />
          <polygon points="18,38 32,14 40,38" fill="#16a34a" stroke="#14532d" strokeWidth="1" />
          <polygon points="32,38 46,16 54,38" fill="#eab308" stroke="#a16207" strokeWidth="1" />
          {/* Facas rotativas na parte inferior */}
          <circle cx="16" cy="36" r="5" fill="#334155" stroke="#94a3b8" strokeWidth="0.8" />
          <circle cx="34" cy="36" r="5" fill="#334155" stroke="#94a3b8" strokeWidth="0.8" />
          <line x1="2" y1="40" x2="56" y2="38" stroke="#e2e8f0" strokeWidth="1.6" strokeLinecap="round" />
        </g>

        {/* 8. RODA TRASEIRA (DIRECIONAL - MENOR) */}
        <g id="ens-rear-wheel">
          {/* Pneu */}
          <circle cx="242" cy="158" r="24" fill="url(#ens-tire)" stroke="#090d16" strokeWidth="2.5" />
          {/* Garras / Garras de tração do pneu */}
          <circle cx="242" cy="158" r="22" fill="none" stroke="#0f172a" strokeWidth="3" strokeDasharray="3 4" />
          {/* Aro amarelo agrícola */}
          <circle cx="242" cy="158" r="14" fill="url(#ens-rim)" stroke="#78350f" strokeWidth="1" />
          {/* Cubo da roda */}
          <circle cx="242" cy="158" r="6" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
          {/* Parafusos de roda */}
          <circle cx="242" cy="154" r="1" fill="#cbd5e1" />
          <circle cx="245" cy="156" r="1" fill="#cbd5e1" />
          <circle cx="245" cy="160" r="1" fill="#cbd5e1" />
          <circle cx="242" cy="162" r="1" fill="#cbd5e1" />
          <circle cx="239" cy="160" r="1" fill="#cbd5e1" />
          <circle cx="239" cy="156" r="1" fill="#cbd5e1" />
        </g>

        {/* 9. RODA DIANTEIRA DE TRAÇÃO (GIGANTE / REFORÇADA) */}
        <g id="ens-front-wheel">
          {/* Pneu dianteiro largo de alta tração */}
          <circle cx="112" cy="154" r="36" fill="url(#ens-tire)" stroke="#090d16" strokeWidth="3" />
          {/* Garras diagonais em V (Tread agressive) */}
          <circle cx="112" cy="154" r="33" fill="none" stroke="#090d16" strokeWidth="4.5" strokeDasharray="4 5" />
          {/* Borda interna do pneu */}
          <circle cx="112" cy="154" r="25" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
          {/* Aro Amarelo Agrícola Canário */}
          <circle cx="112" cy="154" r="21" fill="url(#ens-rim)" stroke="#92400e" strokeWidth="1.2" />
          {/* Rebaixo do cubo */}
          <circle cx="112" cy="154" r="14" fill="#ca8a04" stroke="#78350f" strokeWidth="0.8" />
          {/* Cubo central preto industrial */}
          <circle cx="112" cy="154" r="9" fill="#0f172a" stroke="#334155" strokeWidth="1" />
          {/* Centro do eixo */}
          <circle cx="112" cy="154" r="4" fill="#64748b" />
          {/* Parafusos industriais 8x */}
          <circle cx="112" cy="147" r="1.3" fill="#f8fafc" />
          <circle cx="117" cy="149" r="1.3" fill="#f8fafc" />
          <circle cx="119" cy="154" r="1.3" fill="#f8fafc" />
          <circle cx="117" cy="159" r="1.3" fill="#f8fafc" />
          <circle cx="112" cy="161" r="1.3" fill="#f8fafc" />
          <circle cx="107" cy="159" r="1.3" fill="#f8fafc" />
          <circle cx="105" cy="154" r="1.3" fill="#f8fafc" />
          <circle cx="107" cy="149" r="1.3" fill="#f8fafc" />
        </g>
      </svg>
    </div>
  );
};

export default EnsiladeiraVector;
