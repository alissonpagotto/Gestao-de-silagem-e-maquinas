import React, { useEffect, useState, useMemo } from 'react';
import { generatePixPayload, generateQrCodeDataUrl, buildOfficialPixBrCode } from './pixQrCodeHelper';

export interface PixQrCodeBlockProps {
  pixKey?: string | null;
  amount: number;
  label?: string;
  receiverName?: string;
  city?: string;
  className?: string;
}

export const QRCode: React.FC<{
  value: string;
  size?: number;
  alt?: string;
  className?: string;
}> = ({ value, size = 80, alt = 'QR CODE PIX PARA PAGAMENTO', className = '' }) => {
  const [dataUrl, setDataUrl] = useState<string>(() =>
    value ? `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}` : ''
  );

  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setDataUrl('');
      return;
    }

    setDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}`);

    generateQrCodeDataUrl(value).then((url) => {
      if (isMounted && url) {
        setDataUrl(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (!value || !dataUrl) return null;

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={`w-full h-full object-contain block ${className}`}
      loading="eager"
      crossOrigin="anonymous"
      data-qr-value={value}
    />
  );
};

export const PixQrCodeBlock: React.FC<PixQrCodeBlockProps> = ({
  pixKey,
  amount,
  label = 'QR CODE PIX PARA PAGAMENTO',
  receiverName = 'COLABORADOR',
  city = 'DOIS VIZINHOS',
  className = '',
}) => {
  const cleanPixKey = (pixKey || '').trim();

  // Gera o payload oficial do Banco Central
  const payload = useMemo(() => {
    if (!cleanPixKey) return '';
    return buildOfficialPixBrCode(cleanPixKey, amount, receiverName);
  }, [cleanPixKey, amount, receiverName]);

  // Se não houver chave PIX cadastrada, o espaço permanece totalmente limpo e em branco
  if (!cleanPixKey || !payload) {
    return null;
  }

  const effectiveLabel = label || 'QR CODE PIX PARA PAGAMENTO';

  return (
    <div
      className={`pix-qrcode-container flex flex-col items-center justify-center shrink-0 text-center select-none ${className}`}
      data-testid="pix-qrcode-block"
      style={{ minWidth: '80px', maxWidth: '100px' }}
    >
      <div className="w-[80px] h-[80px] bg-white border border-black/30 rounded-xs p-0.5 shadow-2xs flex items-center justify-center">
        <QRCode value={payload} size={80} alt={effectiveLabel} />
      </div>
      <span className="text-[9px] font-bold text-slate-500 leading-tight mt-1 text-center block max-w-[95px] uppercase">
        {effectiveLabel}
      </span>
    </div>
  );
};
