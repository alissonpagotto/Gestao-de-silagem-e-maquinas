import React, { useRef } from 'react';
import { formatarMoeda, desformatarMoeda } from '../../lib/formatters';

export interface CurrencyInputProps {
  id?: string;
  label?: string;
  value: number | string | undefined | null;
  onChange: (numericValue: number, formattedValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  helpText?: string;
  showCurrencySymbol?: boolean;
}

/**
 * CurrencyInput - Componente de input monetário BRL controlado
 * Aplica máscara dinâmica em tempo real (centavos deslocados à medida que digita)
 * Mantém o cursor na posição correta e atualiza o estado com o valor numérico puro e a string formatada.
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = '0,00',
  disabled = false,
  className = '',
  inputClassName = '',
  required = false,
  helpText,
  showCurrencySymbol = true,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Computa o valor exibido no input
  const displayValue = React.useMemo(() => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'number') {
      if (isNaN(value) || value === 0) return '';
      return formatarMoeda(Math.round(value * 100));
    }
    // Se for string numérica pura ou já com pontuação
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return '';
    return formatarMoeda(digits);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;
    const formatted = formatarMoeda(rawInput);
    const numeric = desformatarMoeda(formatted);

    // Notifica componente pai
    onChange(numeric, formatted);

    // Assegura que o cursor fique no final após re-render
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    });
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-xs font-bold mb-1 text-[#000000]"
          style={{ color: '#000000' }}
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        {showCurrencySymbol && (
          <span 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500 pointer-events-none select-none"
          >
            R$
          </span>
        )}

        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          className={`w-full ${showCurrencySymbol ? 'pl-9' : 'pl-3'} pr-3 py-2 rounded-xl border border-stone-300 bg-white text-[#000000] text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0963cb] disabled:opacity-50 disabled:bg-stone-100 ${inputClassName}`}
        />
      </div>

      {helpText && (
        <p className="mt-1 text-[11px] text-stone-500">{helpText}</p>
      )}
    </div>
  );
};
