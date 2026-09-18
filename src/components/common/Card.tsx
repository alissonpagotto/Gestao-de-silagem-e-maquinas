import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * Componente padrão de Card para o Silagem Fácil CRM.
 * - Fundo padrão no Modo Claro: bg-white
 * - Fundo padrão no Modo Noite: dark:bg-stone-900
 * - Borda sutil: border-zinc-200 / dark:border-stone-800
 * - Cantos arredondados: rounded-xl
 * - Sombra leve: shadow-xs
 * - Tipografia no Modo Claro: text-zinc-900
 */
export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`crm-card bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl shadow-xs text-zinc-900 dark:text-white transition-all ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`p-4 sm:p-5 border-b border-zinc-200 dark:border-stone-800 flex flex-col space-y-1.5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <h3
      className={`text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight font-['Outfit'] ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <p className={`text-xs sm:text-sm font-medium text-zinc-600 dark:text-stone-300 ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`p-4 sm:p-5 border-t border-zinc-200 dark:border-stone-800 flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;
