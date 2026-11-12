import React, { useMemo } from 'react';
import { encodeCode128B } from './badgeHelpers';

interface Code128BarcodeProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Renderiza um código de barras Code 128B vetorial (SVG) autêntico e legível por leitores ópticos.
 */
export const Code128Barcode: React.FC<Code128BarcodeProps> = ({
  value,
  height = 28,
  showText = true,
  className = '',
}) => {
  const cleanValue = String(value || '').trim() || '00000';

  const encoded = useMemo(() => encodeCode128B(cleanValue), [cleanValue]);

  return (
    <div className={`inline-flex flex-col items-center justify-center bg-white select-none ${className}`}>
      <svg
        viewBox={`0 0 ${encoded.totalWidth} ${height}`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        className="w-full"
        style={{ height: `${height}px` }}
        role="img"
        aria-label={`Código de barras Code 128 ${cleanValue}`}
      >
        <rect x={0} y={0} width={encoded.totalWidth} height={height} fill="#ffffff" />
        {encoded.bars.map((bar, index) => (
          <rect
            key={`${bar.x}-${index}`}
            x={bar.x}
            y={0}
            width={bar.width}
            height={height}
            fill="#000000"
          />
        ))}
      </svg>
      {showText && (
        <span className="mt-0.5 font-mono text-[8.5px] font-bold tracking-[0.22em] text-black leading-none">
          {cleanValue}
        </span>
      )}
    </div>
  );
};
