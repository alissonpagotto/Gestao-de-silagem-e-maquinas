import React from 'react';
import { 
  X, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Calendar, 
  Key, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldAlert,
  Edit,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Subscriber } from '../../types/masterAdmin';
import { formatCurrencyBRL } from '../../lib/formatters';

interface SubscriberDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  onEdit: (subscriber: Subscriber) => void;
}

export const SubscriberDetailModal: React.FC<SubscriberDetailModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  onEdit,
}) => {
  if (!isOpen || !subscriber) return null;

  const getStatusBadge = (status: Subscriber['status']) => {
    switch (status) {
      case 'ativa':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1a1d24] text-[#d1d5db] border border-[#2f3644]">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>ATIVA / EM DIA</span>
          </span>
        );
      case 'trial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1a1d24] text-[#d1d5db] border border-[#2f3644]">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>EM TESTE (TRIAL)</span>
          </span>
        );
      case 'inadimplente':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1a1d24] text-[#d1d5db] border border-[#2f3644]">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>INADIMPLENTE</span>
          </span>
        );
      case 'suspensa':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1a1d24] text-[#d1d5db] border border-[#2f3644]">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            <span>SUSPENSA</span>
          </span>
        );
      case 'cancelada':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1a1d24] text-[#8a92a6] border border-[#2f3644]">
            <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
            <span>CANCELADA</span>
          </span>
        );
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#1a1d24] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#2f3644] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-[#14161d] text-white flex items-center justify-between border-b border-[#2f3644]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#252a34] border border-[#2f3644] flex items-center justify-center text-white font-black text-base shadow-xs">
              {subscriber.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {subscriber.name}
                </h3>
              </div>
              <p className="text-xs text-[#8a92a6]">
                Ficha Detalhada do Assinante • ID: <span className="font-mono text-[#d1d5db]">{subscriber.id}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(subscriber);
              }}
              className="px-3 py-1.5 bg-[#252a34] hover:bg-[#323846] text-[#d1d5db] hover:text-white rounded-lg text-xs font-bold border border-[#2f3644] flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8a92a6] hover:text-white hover:bg-[#252a34] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-[#14161d]/80 px-5 py-3 border-b border-[#2f3644] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-[#8a92a6] font-bold uppercase tracking-wider">Situação:</span>
            {getStatusBadge(subscriber.status)}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#8a92a6] font-bold uppercase tracking-wider">Plano:</span>
            <span className="px-2.5 py-0.5 rounded-md font-bold bg-[#252a34] text-white border border-[#2f3644]">
              {subscriber.planName}
            </span>
            <span className="font-bold text-white">
              {formatCurrencyBRL(subscriber.monthlyValue)}/mês
            </span>
          </div>
        </div>

        {/* Conteúdo Dinâmico Completo */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* 1. Informações de Acesso e Responsável */}
          <div className="p-4 bg-[#252a34] rounded-xl border border-[#2f3644] space-y-3">
            <div className="flex items-center justify-between border-b border-[#2f3644] pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#8a92a6]" />
                Responsável & Acesso ao Sistema
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#8a92a6] font-medium block">E-mail de Login:</span>
                <span className="font-bold text-white select-all">
                  {subscriber.responsibleEmail}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">Senha do Painel:</span>
                <span className="font-mono text-[#d1d5db] font-bold">
                  {subscriber.password || '••••••••'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">Telefone / WhatsApp:</span>
                <span className="font-bold text-white">
                  {subscriber.phone || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">Vencimento do Trial:</span>
                <span className="font-bold text-white flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#8a92a6]" />
                  {subscriber.trialUntil ? new Date(subscriber.trialUntil + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem trial'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Dados Fiscais e Cadastrais */}
          <div className="p-4 bg-[#252a34] rounded-xl border border-[#2f3644] space-y-3">
            <div className="flex items-center justify-between border-b border-[#2f3644] pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#8a92a6]" />
                Dados Cadastrais & Fiscais
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#8a92a6] font-medium block">CPF ou CNPJ:</span>
                <span className="font-mono font-bold text-white select-all">
                  {subscriber.cpfCnpj || 'Não cadastrado'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">Inscrição Estadual (IE):</span>
                <span className="font-mono font-bold text-white">
                  {subscriber.stateRegistration || 'ISENTO'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Endereço e Localização */}
          <div className="p-4 bg-[#252a34] rounded-xl border border-[#2f3644] space-y-3">
            <div className="flex items-center justify-between border-b border-[#2f3644] pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#8a92a6]" />
                Endereço Operacional / Fiscal
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-2">
                <span className="text-[#8a92a6] font-medium block">Logradouro e Número:</span>
                <span className="font-bold text-white">
                  {subscriber.street ? `${subscriber.street}, Nº ${subscriber.number || 'S/N'}` : 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">Bairro:</span>
                <span className="font-bold text-white">
                  {subscriber.neighborhood || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">Cidade / UF:</span>
                <span className="font-bold text-white">
                  {subscriber.city ? `${subscriber.city} - ${subscriber.state}` : 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">CEP:</span>
                <span className="font-mono font-bold text-white">
                  {subscriber.cep || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">Cadastrado em:</span>
                <span className="font-medium text-[#d1d5db]">
                  {subscriber.createdAt ? new Date(subscriber.createdAt).toLocaleDateString('pt-BR') : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3.5 bg-[#14161d] border-t border-[#2f3644] flex items-center justify-between">
          <span className="text-[11px] text-[#8a92a6]">
            Última alteração em {new Date(subscriber.updatedAt || subscriber.createdAt).toLocaleString('pt-BR')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#252a34] hover:bg-[#323846] text-[#d1d5db] hover:text-white border border-[#2f3644] rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
