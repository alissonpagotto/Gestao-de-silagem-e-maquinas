import React from 'react';
import { Building2 } from 'lucide-react';

interface BankLogoIconProps {
  code?: string;
  name?: string;
  className?: string;
  size?: number;
}

/**
 * Normaliza strings para busca e identificação sem acentos e minúsculas
 */
function normalizeString(str?: any): string {
  try {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  } catch (_) {
    return '';
  }
}

/**
 * Identifica o código padronizado do banco a partir do código ou nome
 */
export function identifyBankCode(code?: any, name?: any): string | null {
  try {
    const rawCode = typeof code === 'string' ? code : (code ? String(code) : '');
    const c = rawCode.trim().replace(/\D/g, '');
    if (c) {
      const padCode = c.padStart(3, '0');
      if (padCode === '074') return '748';
      if (padCode === '099') return '099';
      if (['001', '104', '341', '133', '756', '748', '237', '033', '260', '077', '099'].includes(padCode)) {
        return padCode;
      }
    }

    const n = normalizeString(name);
    if (!n) return null;

    if (n.includes('001') || n.includes('banco do brasil') || n.includes(' bb ') || n === 'bb') return '001';
    if (n.includes('104') || n.includes('caixa') || n.includes('cef')) return '104';
    if (n.includes('341') || n.includes('itau')) return '341';
    if (n.includes('133') || n.includes('cresol') || n.includes('cressol')) return '133';
    if (n.includes('756') || n.includes('sicoob') || n.includes('siccob')) return '756';
    if (n.includes('748') || n.includes('074') || n.includes('sicredi') || n.includes('sicred')) return '748';
    if (n.includes('237') || n.includes('bradesco')) return '237';
    if (n.includes('033') || n.includes('santander')) return '033';
    if (n.includes('260') || n.includes('nubank') || n.includes('nu pagamentos')) return '260';
    if (n.includes('077') || n.includes('inter') || n.includes('banco inter')) return '077';
    if (n.includes('099') || n.includes('caixa fisico') || n.includes('caixa sede') || n.includes('especie')) return '099';

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Componente que renderiza a identidade visual / logo simplificado em vetor SVG
 * dos principais bancos brasileiros e cooperativas (BB, Caixa, Itaú, Cresol, Sicoob, Sicredi, Bradesco, Santander, etc.)
 * Caso o banco seja personalizado ou desconhecido, renderiza o ícone clássico de banco (Building2).
 */
export const BankLogoIcon: React.FC<BankLogoIconProps> = ({
  code,
  name,
  className = '',
  size = 20,
}) => {
  try {
    const bankId = identifyBankCode(code, name);

    if (!bankId) {
      return <Building2 className={className || 'w-4 h-4'} style={{ width: size, height: size }} />;
    }

    switch (bankId) {
    // 001 - Banco do Brasil (Fundo quadrado amarelo puro com o logotipo oficial diagonal de raias azuis entrelaçadas)
    case '001':
      return (
        <svg
          viewBox="0 0 500 500"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fundo Amarelo Oficial BB com borda fina azul institucional */}
          <rect width="500" height="500" rx="40" fill="#FCDE00" stroke="#003882" strokeWidth="16" />
          {/* Monograma oficial diagonal de raias azuis entrelaçadas do Banco do Brasil */}
          <g transform="translate(60, 60) scale(0.76)">
            <path
              d="m500 0-104.16 69.482 52.076 34.705 52.087-34.705zm-250 0-250 166.69 104.17 69.434 125-83.325-52.087-34.717 67.7-45.129 145.83 97.205-239.56 159.69 52.075 34.729 296.88-197.89zm-250 333.33 250 166.67 250-166.67-104.16-69.434-125 83.325 52.075 34.705-67.7 45.142-145.82-97.217 239.56-159.69-52.076-34.718zm0 97.205v69.469l104.17-69.469-52.087-34.717z"
              fill="#003882"
            />
          </g>
        </svg>
      );

    // 104 - Caixa Econômica Federal (X bicolor em azul e laranja)
    case '104':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#0066B3" />
          {/* Braço Branco Esquerdo do X */}
          <path
            d="M7 8L15 16L7 24H11.5L19.5 16L11.5 8H7Z"
            fill="#FFFFFF"
          />
          {/* Braço Laranja Direito do X da Caixa */}
          <path
            d="M25 8L17 16L25 24H20.5L12.5 16L20.5 8H25Z"
            fill="#F37021"
          />
        </svg>
      );

    // 341 - Itaú Unibanco (Quadrado azul e escrita branca itau)
    case '341':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#EC7000" />
          <rect x="5.5" y="5.5" width="21" height="21" rx="4.5" fill="#003399" />
          <text
            x="16"
            y="19"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            letterSpacing="-0.5"
          >
            itau
          </text>
        </svg>
      );

    // 133 - Cresol (Dois losangos verdes entrelaçados circulados pelo anel laranja característico)
    case '133':
      return (
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fundo Branco e Anel Laranja Oficial Cresol */}
          <circle cx="50" cy="50" r="48" fill="#FFFFFF" />
          <circle cx="50" cy="50" r="43.5" fill="none" stroke="#F37021" strokeWidth="8.5" />
          {/* Dois elos/losangos verdes entrelaçados em 45 graus (Símbolo Oficial Cresol) */}
          <g>
            {/* Elo 1 (Inferior-Esquerdo) */}
            <rect
              x="22"
              y="33"
              width="34"
              height="34"
              rx="9"
              transform="rotate(45 39 50)"
              fill="none"
              stroke="#00573D"
              strokeWidth="7.5"
              strokeLinejoin="round"
            />
            {/* Elo 2 (Superior-Direito) */}
            <rect
              x="44"
              y="33"
              width="34"
              height="34"
              rx="9"
              transform="rotate(45 61 50)"
              fill="none"
              stroke="#00573D"
              strokeWidth="7.5"
              strokeLinejoin="round"
            />
            {/* Entrelaçamento 3D / Weave: Segmento sobreposto do Elo 1 com máscara de separação branca */}
            <path
              d="M 42 53 L 49.5 60.5 L 57 53"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="11.5"
              strokeLinecap="round"
            />
            <path
              d="M 42 53 L 49.5 60.5 L 57 53"
              fill="none"
              stroke="#00573D"
              strokeWidth="7.5"
              strokeLinecap="round"
            />
          </g>
        </svg>
      );

    // 756 - Sicoob (Setas do Sicoob)
    case '756':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#003641" />
          {/* Setas / Triângulos Sicoob */}
          <path d="M16 6L23 15L16 13Z" fill="#00AE9D" />
          <path d="M23 15L16 26L18 16Z" fill="#78BE20" />
          <path d="M16 26L9 17L16 19Z" fill="#008375" />
          <path d="M9 17L16 6L14 16Z" fill="#00AE9D" />
        </svg>
      );

    // 748 / 074 - Sicredi (Cata-vento / turbina de pás verdes rotativas oficial)
    case '748':
    case '074':
      return (
        <svg
          viewBox="0 0 120 120"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fundo Branco Nítido e Limpo para contraste perfeito */}
          <rect width="120" height="120" rx="22" fill="#FFFFFF" />
          <g transform="translate(4, 3) scale(0.94)">
            {/* Metades em verde escuro das pás rotativas da turbina Sicredi */}
            <path
              d="m87.156 52.94c-3.4348 2.8288-5.9942 3.3003-7.1392 2.1553-0.74058-0.74093-0.87549-2.2224-0.33657-4.1083 1.8184-5.9942 3.2325-12.056 4.3774-18.184 6.8697-3.0307 13.739-5.8593 21.35-6.6002-3.5694 9.7655-10.102 19.935-18.251 26.737zm-3.5023 20.137c-4.3103-0.87549-6.3308-2.761-6.1959-4.4449 0.06711-1.0775 1.0775-2.155 2.8285-2.8959 5.3878-2.2899 10.709-4.7818 15.759-7.8126 6.6677 3.2328 13.066 7.3412 18.184 12.527-9.3612 3.5023-20.878 4.6472-30.576 2.6265zm-17.78 10.641c-2.0879-4.3103-1.8859-7.2734-0.53892-8.2838 0.94294-0.67348 2.4245-0.53892 4.1083 0.40402 5.2533 2.9634 10.574 5.6573 16.231 7.8797v0.06745c2.0204 8.0817 3.2328 16.568 2.6939 24.919-9.3612-5.9268-17.847-15.355-22.494-24.987zm-20.137-7.7448c2.357-4.7147 4.8489-6.5331 6.5328-5.9942 1.1449 0.33691 1.953 1.6164 2.2224 3.7043 0.94294 6.6002 2.3573 13.066 4.0409 19.464-5.8593 7.8797-12.123 15.49-20.003 21.686-0.87549-12.729 1.5493-27.344 7.2066-38.86zm-6.0617-21.754c5.3207-1.0778 8.2166-0.20201 8.8901 1.4815 0.40402 1.0775-0.13456 2.5594-1.6164 4.1758-4.9838 5.1858-9.5636 10.641-13.941 16.298h-0.06735c-10.708 0.74058-21.888 0.33657-32.395-2.1553 10.708-9.0247 25.188-17.039 39.13-19.8zm13.604-17.645c3.9738 3.4345 5.0513 6.1288 4.1758 7.6103-0.60603 0.94294-2.0204 1.4144-4.1758 1.2124-7.1388-0.80838-14.278-1.1449-21.484-1.1449-6.8022-7.8126-12.998-16.501-16.972-25.862 13.537 3.0307 28.084 9.3615 38.456 18.184zm21.148 0.26912c0 4.8493-1.347 7.2737-2.9634 7.4086-1.0775 0.13456-2.2899-0.74093-3.4348-2.4919-3.6369-5.6573-7.6103-11.113-11.853-16.433 1.6161-8.486 4.2429-17.107 8.7552-24.582 5.6573 10.843 9.5636 24.044 9.4962 36.099z"
              fill="#005C29"
            />
            {/* Metades em verde claro/limão das pás rotativas */}
            <path
              d="m56.172 25.261c1.6164-8.4186 4.2429-17.039 8.7552-24.515-9.6307-1.347-19.531-0.20205-28.556 3.1654 5.5227 5.3879 10.978 10.843 15.894 16.703 0.5742 0.69489 1.1889 1.4169 1.7956 2.1295 0.74577 0.87594 1.4794 1.7377 2.1107 2.5175zm30.51-16.902c-0.40402 6.4655-0.87549 12.864-1.8184 19.194-0.11207 0.70157-0.22449 1.4616-0.33657 2.2216-0.15739 1.064-0.31443 2.128-0.47147 3.0316 6.8693-3.0307 13.739-5.8593 21.349-6.6002-4.7815-7.2063-11.18-13.335-18.723-17.847zm27.138 37.309c-4.3778 3.4348-8.8901 6.8022-13.672 9.6982-0.60949 0.36562-1.2463 0.77275-1.88 1.1775l-3.46e-4 3.46e-4c-0.76618 0.48946-1.5272 0.9758-2.228 1.3815 6.6677 3.2325 13.066 7.3408 18.184 12.527 1.2124-8.5532 1.145-16.231-0.40401-24.784zm-23.51 39.802c5.2533 1.9533 10.709 3.4348 16.163 4.7818-4.5123 7.2737-10.708 13.672-18.049 18.454 0.53892-8.3512-0.67348-16.837-2.6939-24.919v-0.06745c1.1183 0.50329 2.5154 1.0066 3.8057 1.4715l6.92e-4 3.46e-4h3.46e-4c0.26323 0.09478 0.52197 0.18783 0.7731 0.27914zm-23.231 31.519c-2.559-6.1288-4.9838-12.325-6.9368-18.521-0.13975-0.45452-0.28849-0.92668-0.43965-1.4058v-1e-3l-3.45e-4 -3.45e-4v-3.46e-4c-0.43065-1.366-0.87722-2.7839-1.1764-3.9803-5.8593 7.8797-12.123 15.49-19.935 21.686 9.429 2.7614 18.656 3.9734 28.488 2.2224zm-37.775-35.624c-4.5797 6.3979-8.7553 13.268-12.729 20.137-7.8125-7.6106-13.335-17.174-16.029-27.478 10.506 2.4919 21.686 2.8959 32.395 2.155h0.06735c-0.68697 0.92945-1.4467 2.0045-2.2064 3.0793l-5.53e-4 1e-3 -6.57e-4 6.92e-4c-0.50606 0.71602-1.0121 1.4321-1.4966 2.1052zm-29.303-34.823c8.4186-1.0104 16.905-1.8859 25.256-2.1553 0.70665-0.02179 1.4495-0.05119 2.1953-0.0806h5.19e-4c1.5286-0.06053 3.0697-0.12141 4.337-0.12141-6.8696-7.7448-12.998-16.433-16.972-25.794-7.4757 7.8798-12.594 17.713-14.817 28.152z"
              fill="#00A859"
            />
          </g>
        </svg>
      );

    // 237 - Bradesco (Fundo vermelho sólido com símbolo clássico da árvore/gráfico estilizado em vetor branco centralizado)
    case '237':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fundo Vermelho Sólido Bradesco com Cantos Arredondados */}
          <rect width="32" height="32" rx="7" fill="#CC092F" />
          {/* Símbolo clássico da árvore/gráfico estilizado em vetor branco centralizado */}
          <g transform="translate(4.5, 4.5) scale(0.96)">
            {/* Barra Esquerda Menor */}
            <path
              d="M11.6,16.4l-1.4.8c-.2.1-.2.2-.2.4v5.1c0,.2.1.3.2.3h1.4V16.4Z"
              fill="#FFFFFF"
            />
            {/* Barra Direita Maior */}
            <path
              d="M14.2,14.9l-1.8,1h-.1v6.9h2a.4.4,0,0,0,.4-.4V15.2A.3.3,0,0,0,14.2,14.9Z"
              fill="#FFFFFF"
            />
            {/* Arcos Curvos da Árvore / Gráfico */}
            <path
              d="M8.6,4.9A22.5,22.5,0,0,0,7,5.3a8.2,8.2,0,0,1,6.6-3.2A9,9,0,0,1,19,3.9c.2.2.4.3.6.1a.4.4,0,0,0,0-.6A9.3,9.3,0,0,0,12.2,0,9.5,9.5,0,0,0,3.5,6.1L.3,7.4q-.4.3-.3.6a.4.4,0,0,0,.6.2,18.3,18.3,0,0,1,2.5-.6A6.1,6.1,0,0,0,3,9a9.3,9.3,0,0,0,4.3,8c.2.1.5.1.6-.1s.1-.4-.1-.6a7.9,7.9,0,0,1-2.6-6,6.4,6.4,0,0,1,.7-3.1L8.7,7c6.8,0,12.6,2.3,12.6,5.2s-1.9,3-4.2,4c-.5.2-.5.4-.5.6s.3.3.6.2c4-1.2,6.9-3.4,6.9-5.9S18.5,4.9,11.4,4.9Z"
              fill="#FFFFFF"
            />
          </g>
        </svg>
      );

    // 033 - Santander (Fundo vermelho arredondado com a chama/fogo branca oficial subindo da base elíptica perfeitamente centralizada)
    case '033':
      return (
        <svg
          viewBox="0 0 54 54"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fundo Vermelho Arredondado Santander */}
          <rect width="54" height="54" rx="14" fill="#EA1D25" />
          {/* Chama/fogo branca oficial subindo da base elíptica perfeitamente centralizada */}
          <g transform="translate(5.1, 6.2)">
            <path
              d="M 31.5,19.5 C 31.4,18 31,16.5 30.2,15.2 L 23.4,3.3 C 22.9,2.4 22.5,1.4 22.3,0.4 L 22,0.9 c -1.7,2.9 -1.7,6.6 0,9.5 l 5.5,9.5 c 1.7,2.9 1.7,6.6 0,9.5 l -0.3,0.5 c -0.2,-1 -0.6,-2 -1.1,-2.9 l -5,-8.7 -3.2,-5.6 C 17.4,11.8 17,10.8 16.8,9.8 l -0.3,0.5 c -1.7,2.9 -1.7,6.5 0,9.5 v 0 l 5.5,9.5 c 1.7,2.9 1.7,6.6 0,9.5 l -0.3,0.5 c -0.2,-1 -0.6,-2 -1.1,-2.9 L 13.7,24.5 C 12.8,22.9 12.4,21.1 12.4,19.3 5.1,21.2 0,25.3 0,30 0,36.6 9.8,41.9 21.9,41.9 34,41.9 43.8,36.6 43.8,30 43.9,25.5 38.9,21.4 31.5,19.5 Z"
              fill="#FFFFFF"
            />
          </g>
        </svg>
      );

    // 260 - Nubank
    case '260':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#820AD1" />
          <text
            x="16"
            y="21"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="14"
            fontWeight="900"
            fontFamily="sans-serif"
            letterSpacing="-1"
          >
            nu
          </text>
        </svg>
      );

    // 077 - Inter
    case '077':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#FF7A00" />
          <text
            x="16"
            y="20"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="10"
            fontWeight="900"
            fontFamily="sans-serif"
          >
            inter
          </text>
        </svg>
      );

    // 099 - Caixa Físico / Sede
    case '099':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#475569" />
          <path
            d="M8 11C8 9.89543 8.89543 9 10 9H22C23.1046 9 24 9.89543 24 11V21C24 22.1046 23.1046 23 22 23H10C8.89543 23 8 22.1046 8 21V11Z"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <path
            d="M19 16C19 16.5523 19.4477 17 20 17H24V15H20C19.4477 15 19 15.4477 19 16Z"
            fill="#FFFFFF"
          />
          <circle cx="21.5" cy="16" r="0.75" fill="#475569" />
        </svg>
      );

    default:
      return <Building2 className={className || 'w-4 h-4'} style={{ width: size, height: size }} />;
    }
  } catch (err) {
    return <Building2 className={className || 'w-4 h-4'} style={{ width: size, height: size }} />;
  }
};
