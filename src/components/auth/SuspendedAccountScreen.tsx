import React from 'react';
import { AlertTriangle, Lock, MessageCircle, Mail, ArrowLeft, ShieldAlert } from 'lucide-react';

interface SuspendedAccountScreenProps {
  subscriberName?: string;
  subscriberEmail?: string;
  onBackToHome: () => void;
  onLogout: () => void;
}

export const SuspendedAccountScreen: React.FC<SuspendedAccountScreenProps> = ({
  subscriberName,
  subscriberEmail,
  onBackToHome,
  onLogout,
}) => {
  const supportWhatsapp = '5511999999999'; // número comercial
  const supportEmail = 'financeiro@silagempro.com.br';

  const handleOpenWhatsapp = () => {
    const text = encodeURIComponent(
      `Olá, gostaria de regularizar minha assinatura no AgroControl / Silagem Pro. Empresa: ${subscriberName || 'Minha Fazenda'} - Email: ${subscriberEmail || ''}`
    );
    window.open(`https://wa.me/${supportWhatsapp}?text=${text}`, '_blank');
  };

  const handleOpenEmail = () => {
    const subject = encodeURIComponent(`Regularização de Assinatura - ${subscriberName || 'Minha Fazenda'}`);
    const body = encodeURIComponent(`Olá equipe financeira,\n\nSolicito a regularização da minha assinatura para a conta ${subscriberEmail || ''}.\n\nObrigado.`);
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* Ícone de Alerta */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        {/* Título & Mensagem */}
        <div className="space-y-2">
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-black uppercase tracking-wider rounded-full inline-block">
            Status: Suspenso
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Acesso Suspenso
          </h2>
          <p className="text-xs text-amber-400 font-bold uppercase tracking-wide">
            Pendência Financeira
          </p>
          <p className="text-xs sm:text-sm text-stone-400 leading-relaxed pt-2">
            A assinatura da conta <strong className="text-stone-200">{subscriberName || 'sua fazenda'}</strong> ({subscriberEmail || 'seu email'}) encontra-se temporariamente pausada ou com pendência financeira em aberto.
          </p>
        </div>

        {/* Card informativo */}
        <div className="p-4 bg-stone-950/80 rounded-2xl border border-stone-800 text-left space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-300">
            <Lock className="w-4 h-4 text-amber-500" />
            <span>Como reativar meu acesso?</span>
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Seus tratores, frotas e históricos de apontamentos estão 100% seguros e preservados. Para liberar o acesso operacional imediatamente, contate nosso setor de atendimento ou financeiro.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleOpenWhatsapp}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow-lg cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Falar com o Financeiro via WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleOpenEmail}
            className="w-full py-2.5 px-4 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            <span>Enviar E-mail de Suporte</span>
          </button>
        </div>

        {/* Voltar / Desconectar */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onBackToHome}
            className="text-stone-400 hover:text-stone-200 flex items-center gap-1 cursor-pointer font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Início</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
};
