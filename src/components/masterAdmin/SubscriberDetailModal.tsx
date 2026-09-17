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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ATIVA / EM DIA
          </span>
        );
      case 'trial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            EM TESTE (TRIAL)
          </span>
        );
      case 'inadimplente':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            INADIMPLENTE
          </span>
        );
      case 'suspensa':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <ShieldAlert className="w-3.5 h-3.5" />
            SUSPENSA
          </span>
        );
      case 'cancelada':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
            CANCELADA
          </span>
        );
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-base shadow-xs">
              {subscriber.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {subscriber.name}
                </h3>
              </div>
              <p className="text-xs text-stone-400">
                Ficha Detalhada do Assinante • ID: <span className="font-mono text-stone-300">{subscriber.id}</span>
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
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-stone-50 dark:bg-stone-800/60 px-5 py-3 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Situação:</span>
            {getStatusBadge(subscriber.status)}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-500 font-bold uppercase tracking-wider">Plano:</span>
            <span className="px-2.5 py-0.5 rounded-md font-black bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              {subscriber.planName}
            </span>
            <span className="font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrencyBRL(subscriber.monthlyValue)}/mês
            </span>
          </div>
        </div>

        {/* Conteúdo Dinâmico Completo */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* 1. Informações de Acesso e Responsável */}
          <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-700/60 pb-2">
              <span className="text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600" />
                Responsável & Acesso ao Sistema
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-500 font-medium block">E-mail de Login:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 select-all">
                  {subscriber.responsibleEmail}
                </span>
              </div>

              <div>
                <span className="text-stone-500 font-medium block">Senha do Painel:</span>
                <span className="font-mono text-stone-800 dark:text-stone-200 font-bold">
                  {subscriber.password || '••••••••'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 font-medium block">Telefone / WhatsApp:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {subscriber.phone || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 font-medium block">Vencimento do Trial:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  {subscriber.trialUntil ? new Date(subscriber.trialUntil + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem trial'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Dados Fiscais e Cadastrais */}
          <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-700/60 pb-2">
              <span className="text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Dados Cadastrais & Fiscais
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-500 font-medium block">CPF ou CNPJ:</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100 select-all">
                  {subscriber.cpfCnpj || 'Não cadastrado'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 font-medium block">Inscrição Estadual (IE):</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  {subscriber.stateRegistration || 'ISENTO'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Endereço e Localização */}
          <div className="p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-700/60 pb-2">
              <span className="text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Endereço Operacional / Fiscal
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-2">
                <span className="text-stone-500 font-medium block">Logradouro e Número:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {subscriber.street ? `${subscriber.street}, Nº ${subscriber.number || 'S/N'}` : 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 font-medium block">Bairro:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {subscriber.neighborhood || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 font-medium block">Cidade / UF:</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {subscriber.city ? `${subscriber.city} - ${subscriber.state}` : 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 font-medium block">CEP:</span>
                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                  {subscriber.cep || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-stone-500 font-medium block">Cadastrado em:</span>
                <span className="font-medium text-stone-700 dark:text-stone-300">
                  {subscriber.createdAt ? new Date(subscriber.createdAt).toLocaleDateString('pt-BR') : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3.5 bg-stone-100 dark:bg-stone-800/80 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            Última alteração em {new Date(subscriber.updatedAt || subscriber.createdAt).toLocaleString('pt-BR')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
