import React, { useState } from 'react';
import { User } from 'lucide-react';

/**
 * Verifica se a URL do avatar é inválida, nula ou aponta para domínios conhecidos por quebra/404 (como wix_mp.com).
 * Isso impede que o navegador dispare requisições HTTP 404 desnecessárias no console.
 */
export function isBrokenAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed.includes('wix_mp.com') ||
    trimmed.includes('wix_mp') ||
    trimmed.includes('static.wixstatic.com') ||
    trimmed.includes('/_upload/') ||
    trimmed.includes('/upload/')
  ) {
    return true;
  }
  return false;
}

/**
 * Sanitiza a URL da foto de perfil, retornando undefined se ela for nula ou quebrada.
 */
export function sanitizeAvatarUrl(url?: string | null): string | undefined {
  if (isBrokenAvatarUrl(url)) return undefined;
  return url?.trim();
}

export interface EmployeeAvatarProps {
  photoUrl?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  fallbackIcon?: React.ReactNode;
  showInitials?: boolean;
}

export const EmployeeAvatar: React.FC<EmployeeAvatarProps> = ({
  photoUrl,
  name = '',
  size = 'sm',
  className = '',
  fallbackIcon,
  showInitials = false,
}) => {
  const [hasError, setHasError] = useState(false);

  // Tamanhos pré-configurados
  const sizeClasses: Record<string, { container: string; icon: string; text: string }> = {
    xs: { container: 'w-6 h-6 rounded-lg', icon: 'w-3.5 h-3.5', text: 'text-[10px]' },
    sm: { container: 'w-8 h-8 rounded-xl', icon: 'w-4 h-4', text: 'text-xs' },
    md: { container: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5', text: 'text-sm' },
    lg: { container: 'w-12 h-12 rounded-2xl', icon: 'w-6 h-6', text: 'text-base' },
    xl: { container: 'w-20 h-20 rounded-full', icon: 'w-8 h-8', text: 'text-xl' },
  };

  const currentSize = typeof size === 'string' && sizeClasses[size] ? sizeClasses[size] : sizeClasses.sm;
  const isBroken = isBrokenAvatarUrl(photoUrl) || hasError;

  const initials = (name || '').trim().substring(0, 2).toUpperCase() || 'OP';

  if (!isBroken && photoUrl) {
    return (
      <img
        src={photoUrl.trim()}
        alt={name || 'Colaborador'}
        onError={() => setHasError(true)}
        className={`${currentSize.container} object-cover shrink-0 border border-stone-200 dark:border-stone-700 shadow-xs ${className}`}
        loading="lazy"
      />
    );
  }

  // Fallback: Ícone padrão do Lucide ou Iniciais
  return (
    <div
      className={`${currentSize.container} bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold flex items-center justify-center shrink-0 border border-stone-300 dark:border-stone-700 shadow-xs select-none ${className}`}
      title={name || 'Colaborador'}
    >
      {showInitials && name ? (
        <span className={`${currentSize.text} font-black uppercase tracking-wider`}>
          {initials}
        </span>
      ) : fallbackIcon ? (
        fallbackIcon
      ) : (
        <User className={`${currentSize.icon} text-stone-500 dark:text-stone-400`} />
      )}
    </div>
  );
};
