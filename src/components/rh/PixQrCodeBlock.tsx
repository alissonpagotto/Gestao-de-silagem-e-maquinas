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
      className={`pix-qrcode-container flex flex-col items-center justify-center p-2 border border-slate-200 rounded bg-white shrink-0 text-center select-none ${className}`}
      data-testid="pix-qrcode-block"
      style={{ minWidth: '95px', maxWidth: '120px' }}
    >
      <QRCode value={payload} size={90} className="mx-auto" alt={effectiveLabel} />
      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight text-center mt-1.5 w-full block">
        {effectiveLabel}
      </span>
    </div>
  );
};
