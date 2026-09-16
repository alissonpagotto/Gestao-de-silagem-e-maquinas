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
function normalizeString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Identifica o código padronizado do banco a partir do código ou nome
 */
export function identifyBankCode(code?: string, name?: string): string | null {
  const c = (code || '').trim().replace(/\D/g, '');
  if (c) {
    const padCode = c.padStart(3, '0');
    if (['001', '104', '341', '133', '756', '748', '237', '033', '260', '077'].includes(padCode)) {
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
  if (n.includes('748') || n.includes('sicredi') || n.includes('sicred')) return '748';
  if (n.includes('237') || n.includes('bradesco')) return '237';
  if (n.includes('033') || n.includes('santander')) return '033';
  if (n.includes('260') || n.includes('nubank') || n.includes('nu pagamentos')) return '260';
  if (n.includes('077') || n.includes('inter') || n.includes('banco inter')) return '077';

  return null;
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
  const bankId = identifyBankCode(code, name);

  if (!bankId) {
    return <Building2 className={className || 'w-4 h-4'} style={{ width: size, height: size }} />;
  }

  switch (bankId) {
    // 001 - Banco do Brasil (Símbolo entrelaçado BB em azul e amarelo)
    case '001':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#003882" />
          <path
            d="M8.5 9.5C8.5 7.84 9.84 6.5 11.5 6.5H19C21.48 6.5 23.5 8.52 23.5 11C23.5 12.25 23 13.38 22.18 14.18L17.5 18.86V22.5C17.5 23.6 16.6 24.5 15.5 24.5H12C9.52 24.5 7.5 22.48 7.5 20C7.5 18.75 8 17.62 8.82 16.82L13.5 12.14V8.5H11.5C10.95 8.5 10.5 8.95 10.5 9.5V11H8.5V9.5Z"
            fill="#FCDE00"
          />
          <path
            d="M23.5 22.5C23.5 24.16 22.16 25.5 20.5 25.5H13C10.52 25.5 8.5 23.48 8.5 21C8.5 19.75 9 18.62 9.82 17.82L14.5 13.14V9.5C14.5 8.4 15.4 7.5 16.5 7.5H20C22.48 7.5 24.5 9.52 24.5 12C24.5 13.25 24 14.38 23.18 15.18L18.5 19.86V23.5H20.5C21.05 23.5 21.5 23.05 21.5 22.5V21H23.5V22.5Z"
            fill="#003882"
            opacity="0.25"
          />
          <path
            d="M11 11H21V13.5L16 18.5L11 13.5V11Z"
            fill="#FCDE00"
          />
          <path
            d="M21 21H11V18.5L16 13.5L21 18.5V21Z"
            fill="#FCDE00"
          />
        </svg>
      );

    // 104 - Caixa Econômica Federal (X icônico em laranja e branco sobre azul royal)
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

    // 341 - Itaú Unibanco (Squircle laranja com tipografia e destaque itau)
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
          <rect x="5" y="5" width="22" height="22" rx="5" fill="#003399" />
          <text
            x="16"
            y="19"
            textAnchor="middle"
            fill="#FFD200"
            fontSize="10"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            letterSpacing="-0.5"
          >
            Itaú
          </text>
        </svg>
      );

    // 133 - Cresol (Símbolo circular orgânico em laranja e verde de cooperativismo)
    case '133':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#006837" />
          {/* Arco em Laranja Cresol */}
          <circle cx="16" cy="16" r="9" stroke="#F37021" strokeWidth="3" strokeDasharray="24 10" />
          {/* Folha/Semente Central Verde e Laranja */}
          <path
            d="M16 8C12 11 12 17 16 23C20 17 20 11 16 8Z"
            fill="#FFFFFF"
          />
          <path
            d="M16 11C14 13.5 14 18 16 21C18 18 18 13.5 16 11Z"
            fill="#F37021"
          />
        </svg>
      );

    // 756 - Sicoob (Símbolo prisma/triângulo estilizado em turquesa e ciano)
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
          {/* Triângulo 1 (Topo Turquesa) */}
          <path d="M16 6L24 16L16 14Z" fill="#00AE9D" />
          {/* Triângulo 2 (Direita Verde Claro) */}
          <path d="M24 16L16 26L18 17Z" fill="#78BE20" />
          {/* Triângulo 3 (Base Verde Oliva) */}
          <path d="M16 26L8 16L16 18Z" fill="#008375" />
          {/* Triângulo 4 (Esquerda Ciano Escuro) */}
          <path d="M8 16L16 6L14 15Z" fill="#006272" />
        </svg>
      );

    // 748 - Sicredi (Catavento / Pinwheel verde cooperativo de 5 pontas)
    case '748':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#00843D" />
          {/* Pás do Catavento Sicredi */}
          <g fill="#FFFFFF">
            <path d="M16 16V7C18.5 7 20 8.5 20 10.5L16 16Z" fill="#FFFFFF" />
            <path d="M16 16L24.5 13C25.5 15 25 17 23 18L16 16Z" fill="#E2F5DD" />
            <path d="M16 16L21 23.5C19.5 25 17.5 25 15.5 24L16 16Z" fill="#FFFFFF" />
            <path d="M16 16L7.5 20C6.5 18 7 16 9 14.5L16 16Z" fill="#E2F5DD" />
            <path d="M16 16L11 8.5C12.5 7 14.5 7 16 8V16Z" fill="#FFFFFF" />
          </g>
          <circle cx="16" cy="16" r="2.5" fill="#00843D" />
        </svg>
      );

    // 237 - Bradesco (Símbolo clássico da árvore/galhos curvos Bradesco em vermelho)
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
          <rect width="32" height="32" rx="7" fill="#CC092F" />
          {/* Coluna Central */}
          <rect x="14.5" y="14" width="3" height="11" rx="1.5" fill="#FFFFFF" />
          {/* Arco Esquerdo */}
          <path
            d="M8.5 25C8.5 18.5 12 14 16 14"
            stroke="#FFFFFF"
            strokeWidth="2.75"
            strokeLinecap="round"
          />
          {/* Arco Direito */}
          <path
            d="M23.5 25C23.5 18.5 20 14 16 14"
            stroke="#FFFFFF"
            strokeWidth="2.75"
            strokeLinecap="round"
          />
          {/* Círculo do Topo */}
          <circle cx="16" cy="9.5" r="2.5" fill="#FFFFFF" />
        </svg>
      );

    // 033 - Santander (Chama clássica Santander sobre fundo vermelho)
    case '033':
      return (
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          className={`shrink-0 ${className}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="32" height="32" rx="7" fill="#EA1D25" />
          {/* Três chamas estilizadas Santander */}
          <path
            d="M16 7C14.5 11 12 13.5 12 17C12 21 14 24 16 25C18 24 20 21 20 17C20 13.5 17.5 11 16 7Z"
            fill="#FFFFFF"
          />
          <path
            d="M11 14C9.8 16.5 9 18.5 9 20.5C9 23 10.2 24.5 12 25.2C10.5 23.5 10.5 21 11.5 18.5C12 17.2 12.3 15.5 11 14Z"
            fill="#FFFFFF"
          />
          <path
            d="M21 14C22.2 16.5 23 18.5 23 20.5C23 23 21.8 24.5 20 25.2C21.5 23.5 21.5 21 20.5 18.5C20 17.2 19.7 15.5 21 14Z"
            fill="#FFFFFF"
          />
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

    default:
      return <Building2 className={className || 'w-4 h-4'} style={{ width: size, height: size }} />;
  }
};
