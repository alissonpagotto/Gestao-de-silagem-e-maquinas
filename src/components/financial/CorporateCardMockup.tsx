import React from 'react';
import { CorporateCard } from '../../types';

interface CorporateCardMockupProps {
  card: CorporateCard;
  bankName?: string;
  bankCode?: string;
  accountHolderName?: string;
  className?: string;
}

/**
 * Renderiza um mockup fidedigno e tridimensional de cartão de crédito físico corporativo.
 * Respeita as cores oficiais do banco (ex: Verde Limão Sicredi #00a859) e a bandeira (Mastercard / Visa).
 */
export const CorporateCardMockup: React.FC<CorporateCardMockupProps> = ({
  card,
  bankName = 'Sicredi',
  bankCode,
  accountHolderName,
  className = '',
}) => {
  // Normalização de dados para detecção
  const bankLower = (bankName || '').toLowerCase();
  const cardNameLower = (card.name || '').toLowerCase();

  // Detecção da bandeira (Mastercard por padrão no Sicredi e conforme solicitado)
  let brand: 'mastercard' | 'visa' | 'elo' = 'mastercard';
  if (card.brand) {
    brand = card.brand as any;
  } else if (cardNameLower.includes('visa')) {
    brand = 'visa';
  } else if (cardNameLower.includes('elo')) {
    brand = 'elo';
  } else if (cardNameLower.includes('master')) {
    brand = 'mastercard';
  } else if (bankLower.includes('sicredi')) {
    brand = 'mastercard';
  }

  // Extração dos 4 últimos dígitos
  const last4 = card.last4 || card.name.match(/\d{4}/)?.[0] || '4520';

  // Nome do portador em maiúsculas (lê dinamicamente o titular ou funcionário selecionado)
  const holderName = (card.titular_nome || card.responsibleEmployeeName || 'AUDIRLEI REOLAN').toUpperCase();

  // Definição da Paleta de Cores e Estilo Visual do Cartão por Instituição
  let cardBgClass = 'bg-gradient-to-br from-[#00a859] via-[#00924d] to-[#006e39]';
  let bankDisplay = 'Sicredi';
  let chipTone: 'gold' | 'silver' = 'silver';

  if (bankLower.includes('sicredi') || bankCode === '748') {
    // Sicredi Verde Corporativo Oficial
    cardBgClass = 'bg-gradient-to-br from-[#00a859] via-[#008f4a] to-[#006836] shadow-emerald-950/20';
    bankDisplay = 'Sicredi';
    chipTone = 'silver';
  } else if (bankLower.includes('nubank') || bankCode === '260') {
    cardBgClass = 'bg-gradient-to-br from-[#820ad1] via-[#6d07b0] to-[#450275] shadow-purple-950/20';
    bankDisplay = 'Nu';
    chipTone = 'silver';
  } else if (bankLower.includes('brasil') || bankCode === '001') {
    cardBgClass = 'bg-gradient-to-br from-[#003882] via-[#00275d] to-[#001438] shadow-blue-950/20';
    bankDisplay = 'Banco do Brasil';
    chipTone = 'gold';
  } else if (bankLower.includes('itau') || bankLower.includes('itaú') || bankCode === '341') {
    cardBgClass = 'bg-gradient-to-br from-[#ec7000] via-[#cd5f00] to-[#8f3f00] shadow-orange-950/20';
    bankDisplay = 'Itaú Personnalité';
    chipTone = 'silver';
  } else if (bankLower.includes('bradesco') || bankCode === '237') {
    cardBgClass = 'bg-gradient-to-br from-[#cc092f] via-[#b00828] to-[#700418] shadow-rose-950/20';
    bankDisplay = 'Bradesco';
    chipTone = 'silver';
  } else if (bankLower.includes('santander') || bankCode === '033') {
    cardBgClass = 'bg-gradient-to-br from-[#ec0000] via-[#c00000] to-[#7a0000] shadow-rose-950/20';
    bankDisplay = 'Santander';
    chipTone = 'silver';
  } else if (bankLower.includes('caixa') || bankCode === '104') {
    cardBgClass = 'bg-gradient-to-br from-[#005ca9] via-[#004785] to-[#002f5a] shadow-blue-950/20';
    bankDisplay = 'CAIXA';
    chipTone = 'gold';
  } else if (bankLower.includes('inter') || bankCode === '077') {
    cardBgClass = 'bg-gradient-to-br from-[#ff7a00] via-[#e06800] to-[#aa4c00] shadow-orange-950/20';
    bankDisplay = 'Inter Black';
    chipTone = 'silver';
  } else if (bankLower.includes('sicoob') || bankCode === '756') {
    cardBgClass = 'bg-gradient-to-br from-[#003641] via-[#004e5f] to-[#00232a] shadow-teal-950/20';
    bankDisplay = 'Sicoob';
    chipTone = 'silver';
  } else {
    // Padrão Executivo / Platinum Dark
    cardBgClass = 'bg-gradient-to-br from-slate-800 via-zinc-900 to-stone-950 shadow-black/30';
    bankDisplay = bankName || 'Corporativo';
    chipTone = 'silver';
  }

  return (
    <div
      className={`relative w-full aspect-[1.586/1] max-w-[340px] sm:max-w-[360px] mx-auto rounded-2xl p-4 sm:p-4.5 text-white shadow-xl overflow-hidden select-none transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl flex flex-col justify-between border border-white/15 ${cardBgClass} ${className}`}
      style={{
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Brilho e Textura de Relevo Metálico */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-black" 
      />
      <div 
        className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full border border-white/10 pointer-events-none opacity-30" 
      />

      {/* LINHA SUPERIOR: Logotipo do Banco + Categoria Corporativa */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            {/* Ícone estilizado do Sicredi se for Sicredi */}
            {bankDisplay === 'Sicredi' ? (
              <div className="flex items-center space-x-1.5">
                <svg 
                  className="w-5 h-5 text-white shrink-0 fill-current drop-shadow-xs" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2L3 9v11h6v-7h6v7h6V9l-9-7z" fill="none" />
                  <path d="M12 3.5L5 9v9.5h3.5v-6h7v6H19V9l-7-5.5zm0 2.5l4 3.2v7.3h-2v-5H10v5H8V9.2l4-3.2z" opacity="0.3"/>
                  <path d="M12 3l8 6.5v11.5h-5v-6H9v6H4V9.5L12 3m0-2L1 8v15h9v-6h4v6h9V8L12 1z" />
                </svg>
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white font-['Outfit'] drop-shadow-xs">
                  Sicredi
                </span>
              </div>
            ) : (
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white font-['Outfit'] drop-shadow-xs truncate max-w-[170px]">
                {bankDisplay}
              </span>
            )}
          </div>
          {/* Nome do Responsável Geral pela Conta Corrente (Topo Esquerdo) */}
          {accountHolderName && (
            <span 
              className="text-[9px] uppercase tracking-wider text-white/90 font-bold truncate max-w-[190px] drop-shadow-xs mt-0.5"
              title={`Responsável pela Conta: ${accountHolderName}`}
            >
              {accountHolderName}
            </span>
          )}
        </div>

        {/* Badge Business / Corporativo */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded bg-black/25 text-white/90 border border-white/15 backdrop-blur-xs">
            Business
          </span>
          {/* Símbolo de Pagamento por Aproximação (Contactless NFC) */}
          <svg
            className="w-4 h-4 text-white/80 shrink-0 transform rotate-90 drop-shadow-xs"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M8.5 16.5a5 5 0 0 1 0-9" />
            <path d="M12 19a8.5 8.5 0 0 0 0-14" />
            <path d="M15.5 21.5a12 12 0 0 0 0-19" />
          </svg>
        </div>
      </div>

      {/* LINHA CENTRAL: CHIP ELETRÔNICO FÍSICO REALISTA */}
      <div className="relative z-10 flex items-center justify-between mt-1 sm:mt-1.5">
        <div className="flex items-center space-x-3">
          {/* Chip EMV com linhas finas simuladas e acabamento metálico */}
          <div
            className={`w-10 h-7.5 sm:w-11 sm:h-8 rounded-md p-0.5 relative shadow-md border flex items-center justify-center overflow-hidden ${
              chipTone === 'gold'
                ? 'bg-gradient-to-br from-amber-200 via-amber-300 to-yellow-500 border-amber-400/80 shadow-amber-900/30'
                : 'bg-gradient-to-br from-zinc-200 via-zinc-300 to-slate-400 border-zinc-300 shadow-black/20'
            }`}
          >
            {/* Contornos internos dos contatos do chip */}
            <div className="w-full h-full border border-black/15 rounded-xs relative flex items-center justify-center">
              <div className="w-4 h-full border-x border-black/15 relative">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-black/20 -translate-y-1/2" />
              </div>
              <div className="absolute top-0 bottom-0 left-2 w-px bg-black/15" />
              <div className="absolute top-0 bottom-0 right-2 w-px bg-black/15" />
            </div>
          </div>
        </div>

        {/* Categoria Platinum / Gold em relevo */}
        <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-white/75 uppercase">
          Empresarial
        </span>
      </div>

      {/* NÚMERO DO CARTÃO MASCARADO */}
      <div className="relative z-10 my-1">
        <div className="font-mono text-sm sm:text-base font-bold tracking-[0.22em] text-white drop-shadow-md flex items-center space-x-2">
          <span>••••</span>
          <span>••••</span>
          <span>••••</span>
          <span className="font-black text-white">{last4}</span>
        </div>
      </div>

      {/* LINHA INFERIOR: Titular, Validade e Bandeira */}
      <div className="relative z-10 flex items-end justify-between pt-0.5 border-t border-white/10">
        <div className="space-y-0.5 max-w-[65%]">
          <div className="flex items-center space-x-3 text-[9px] text-white/75 font-semibold tracking-wider">
            <span>TITULAR</span>
            <span>VENC: DIA {String(card.dueDay || 10).padStart(2, '0')}</span>
          </div>
          <div className="text-xs sm:text-sm font-black tracking-wide text-white uppercase truncate drop-shadow-xs font-['Outfit']">
            {holderName}
          </div>
        </div>

        {/* LOGOTIPO OFICIAL DA BANDEIRA */}
        <div className="shrink-0 flex items-center justify-end">
          {brand === 'mastercard' && (
            <div className="flex flex-col items-center">
              {/* Dois círculos entrelaçados em degradê vermelho e laranja/amarelo puros */}
              <div className="flex items-center -space-x-3">
                <div 
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#eb001b] shadow-xs" 
                />
                <div 
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#f79e1b] mix-blend-screen shadow-xs" 
                />
              </div>
              <span className="text-[8px] font-bold tracking-tight text-white/90 lowercase mt-0.5">
                mastercard
              </span>
            </div>
          )}

          {brand === 'visa' && (
            <div className="italic font-black text-lg sm:text-xl tracking-tighter text-white font-serif drop-shadow-md pr-1">
              VISA
            </div>
          )}

          {brand === 'elo' && (
            <div className="flex items-center space-x-0.5">
              <span className="font-black text-xs sm:text-sm text-yellow-300 drop-shadow-xs">elo</span>
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
