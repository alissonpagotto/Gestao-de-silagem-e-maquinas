import React, { useState, useEffect } from 'react';
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
import { Subscriber, PlanDefinition } from '../../types/masterAdmin';
import { formatCurrencyBRL } from '../../lib/formatters';
import { fetchSubscriberFullDetails } from '../../lib/supabaseService';

interface SubscriberDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  onEdit: (subscriber: Subscriber) => void;
  plans?: PlanDefinition[];
}

export const SubscriberDetailModal: React.FC<SubscriberDetailModalProps> = ({
  isOpen,
  onClose,
  subscriber: initialSubscriber,
  onEdit,
  plans,
}) => {
  const [subscriber, setSubscriber] = useState<Subscriber | null>(initialSubscriber);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && initialSubscriber) {
      setSubscriber(initialSubscriber);
      fetchSubscriberFullDetails(initialSubscriber).then((enriched) => {
        if (isMounted && enriched) {
          setSubscriber(enriched);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, initialSubscriber]);

  if (!isOpen || !subscriber) return null;

  // Resolução dinâmica de plano e valor caso a lista de planos esteja disponível
  let displayPlanName = subscriber.planName || 'Produtor Essencial';
  let displayPlanValue = Number(subscriber.monthlyValue) || 0;

  if (plans && plans.length > 0) {
    const subPlanId = String(subscriber.planId || '').trim().toLowerCase();
    const subPlanName = String(subscriber.planName || '').trim().toLowerCase();
    const normalizeKey = (val: string) =>
      val.toLowerCase().replace(/^plano[-_]/, '').replace(/[^a-z0-9]/g, '');

    const normSubId = normalizeKey(subPlanId);
    const normSubName = normalizeKey(subPlanName);

    const found = plans.find((p) => {
      if (!p) return false;
      const pId = String(p.id || '').trim().toLowerCase();
      const pName = String(p.name || '').trim().toLowerCase();
      const normPId = normalizeKey(pId);
      const normPName = normalizeKey(pName);

      if (subPlanId && (pId === subPlanId || normPId === normSubId)) return true;
      if (subPlanName && (pName === subPlanName || normPName === normSubName)) return true;
      if (normSubId.includes('essencial') && (normPId.includes('essencial') || normPName.includes('essencial'))) return true;
      if (normSubId.includes('pro') && !normSubId.includes('enterprise') && (normPId.includes('pro') || normPName.includes('pro')) && !normPId.includes('enterprise')) return true;
      if (normSubId.includes('enterprise') && (normPId.includes('enterprise') || normPName.includes('enterprise'))) return true;
      if (subPlanName && pName && (pName.includes(subPlanName) || subPlanName.includes(pName))) return true;
      return false;
    });

    if (found) {
      displayPlanName = found.name || displayPlanName;
      displayPlanValue = typeof found.price === 'number' ? found.price : (Number(found.price) || 0);
    }
  }

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
              {(subscriber.name || 'AS').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {subscriber.name || 'Assinante'}
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
              {displayPlanName}
            </span>
            <span className="font-bold text-white">
              {formatCurrencyBRL(displayPlanValue)}/mês
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
                  {(() => {
                    if (!subscriber.trialUntil) return 'Sem trial';
                    try {
                      const raw = String(subscriber.trialUntil).trim();
                      const iso = raw.includes('T') ? raw : `${raw}T12:00:00`;
                      const d = new Date(iso);
                      return !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : raw;
                    } catch {
                      return String(subscriber.trialUntil);
                    }
                  })()}
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
                  {subscriber?.city ? `${subscriber.city}${subscriber.state ? ` - ${subscriber.state}` : ''}` : 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">CEP:</span>
                <span className="font-mono font-bold text-white">
                  {subscriber?.cep || 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-[#8a92a6] font-medium block">Cadastrado em:</span>
                <span className="font-medium text-[#d1d5db]">
                  {(() => {
                    if (!subscriber?.createdAt) return '-';
                    try {
                      const d = new Date(subscriber.createdAt);
                      return !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : String(subscriber.createdAt);
                    } catch {
                      return '-';
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3.5 bg-[#14161d] border-t border-[#2f3644] flex items-center justify-between">
          <span className="text-[11px] text-[#8a92a6]">
            {(() => {
              const dt = subscriber?.updatedAt || subscriber?.createdAt;
              if (!dt) return 'Registro ativo';
              try {
                const d = new Date(dt);
                return !isNaN(d.getTime()) ? `Última alteração em ${d.toLocaleString('pt-BR')}` : 'Registro ativo';
              } catch {
                return 'Registro ativo';
              }
            })()}
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
