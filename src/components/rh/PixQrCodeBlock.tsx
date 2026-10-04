import React, { useEffect, useState, useMemo } from 'react';
import { generatePixPayload, generateQrCodeDataUrl } from './pixQrCodeHelper';

interface PixQrCodeBlockProps {
  pixKey?: string | null;
  amount: number;
  label: string;
  receiverName?: string;
  city?: string;
  className?: string;
}

export const PixQrCodeBlock: React.FC<PixQrCodeBlockProps> = ({
  pixKey,
  amount,
  label,
  receiverName = 'COLABORADOR',
  city = 'BRASIL',
  className = '',
}) => {
  const cleanPixKey = (pixKey || '').trim();

  // Se não houver chave PIX cadastrada, o espaço permanece totalmente limpo e em branco
  if (!cleanPixKey) {
    return null;
  }

  // Gera o payload oficial do Banco Central
  const payload = useMemo(() => {
    return generatePixPayload(cleanPixKey, amount, receiverName, city);
  }, [cleanPixKey, amount, receiverName, city]);

  const [qrUrl, setQrUrl] = useState<string>(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(payload)}`;
  });

  useEffect(() => {
    let isMounted = true;
    if (!payload) return;

    generateQrCodeDataUrl(payload).then((dataUrl) => {
      if (isMounted && dataUrl) {
        setQrUrl(dataUrl);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [payload]);

  return (
    <div
      className={`pix-qrcode-container flex flex-col items-center justify-center shrink-0 text-center select-none ${className}`}
      data-testid="pix-qrcode-block"
      style={{ minWidth: '80px', maxWidth: '100px' }}
    >
      <div className="w-[80px] h-[80px] bg-white border border-black/30 rounded-xs p-0.5 shadow-2xs flex items-center justify-center">
        <img
          src={qrUrl}
          alt={label}
          width={80}
          height={80}
          className="w-full h-full object-contain block"
          loading="eager"
        />
      </div>
      <span className="text-[8.5px] sm:text-[9px] font-black text-black leading-tight mt-1 text-center block max-w-[95px] uppercase">
        {label}
      </span>
    </div>
  );
};
