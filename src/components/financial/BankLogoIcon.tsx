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
    // 001 - Banco do Brasil (Raias Azuis entrelaçadas sobre fundo amarelo corporativo)
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
          <rect width="32" height="32" rx="7" fill="#FCDE00" />
          {/* Raias Azuis do Banco do Brasil */}
          <path
            d="M9 10.5L14 6L23 15L18 19.5L9 10.5Z"
            fill="#003882"
          />
          <path
            d="M23 21.5L18 26L9 17L14 12.5L23 21.5Z"
            fill="#003882"
          />
          <path
            d="M10.5 9L6 14L15 23L19.5 18L10.5 9Z"
            fill="#003882"
          />
          <path
            d="M21.5 23L26 18L17 9L12.5 14L21.5 23Z"
            fill="#003882"
          />
          <rect x="13.2" y="13.2" width="5.6" height="5.6" transform="rotate(45 16 16)" fill="#FCDE00" />
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

    // 133 - Cresol (Folha dupla estilizada Cresol)
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
          {/* Folha dupla estilizada Cresol */}
          <path
            d="M16 6C11 10 10 16 14 22C14.5 17 17 12 16 6Z"
            fill="#FFFFFF"
          />
          <path
            d="M16 8C20 12 21 18 17 24C17.5 19 15 14 16 8Z"
            fill="#F37021"
          />
          <circle cx="15.5" cy="19" r="1.5" fill="#FFFFFF" />
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

    // 748 / 074 - Sicredi (Logo oficial de esferas / catavento cooperativo)
    case '748':
    case '074':
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
          {/* Esferas do símbolo oficial Sicredi */}
          <circle cx="16" cy="10" r="3.2" fill="#FFFFFF" />
          <circle cx="21.5" cy="13.5" r="3" fill="#FFFFFF" />
          <circle cx="20" cy="20" r="3" fill="#FFFFFF" />
          <circle cx="13" cy="20.5" r="3" fill="#FFFFFF" />
          <circle cx="11" cy="14" r="3" fill="#FFFFFF" />
          <circle cx="16" cy="16" r="2.2" fill="#00843D" />
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
