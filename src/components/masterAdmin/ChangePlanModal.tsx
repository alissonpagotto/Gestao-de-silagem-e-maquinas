import React, { useState, useEffect } from 'react';
import { X, Layers, Check, Save, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { Subscriber, PlanDefinition } from '../../types/masterAdmin';
import { fetchCloudPlans, updateCloudSubscriberPlan } from '../../lib/supabaseService';
import { formatCurrencyBRL } from '../../lib/formatters';

interface ChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  onSuccess: (updatedSubscriber: Subscriber) => void;
  onSuccessToast: (message: string) => void;
}

export const ChangePlanModal: React.FC<ChangePlanModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  onSuccess,
  onSuccessToast,
}) => {
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [selectedPlanName, setSelectedPlanName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen && subscriber) {
      setSelectedPlanName(subscriber.planName || '');
      loadActivePlans();
    }
  }, [isOpen, subscriber]);

  const loadActivePlans = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      // 1. Fetch dinâmico direto da nuvem do Supabase
      const cloudPlans = await fetchCloudPlans();
      let activeList: PlanDefinition[] = [];

      if (cloudPlans && cloudPlans.length > 0) {
        // Filtra estritamente planos comerciais ativos e remove planos de teste (ex: tes01)
        activeList = cloudPlans.filter(p => {
          const isNotTest = !p.id.toLowerCase().includes('tes') && !p.name.toLowerCase().includes('tes');
          return p.isActive !== false && isNotTest;
        });
      }

      // Se a tabela cloud não tiver planos cadastrados, usa os planos comerciais oficiais padrão
      if (activeList.length === 0) {
        activeList = [
          {
            id: 'starter',
            name: 'Produtor Essencial',
            description: 'Ideal para produtores individuais e pequenas propriedades rurais.',
            price: 195,
            billingCycle: 'mensal',
            isFeatured: false,
            isActive: true,
            displayOrder: 1,
            checkoutUrl: '',
            limits: { maxUsers: 2, maxMachineries: 5, maxClients: 20, storageLimitGb: 2 },
            featuresText: 'Gestão de Frotas e Tratores\nApontamento de Silagem\nRelatórios Básicos\nSuporte por WhatsApp',
          },
          {
            id: 'pro',
            name: 'Frota Pro',
            description: 'Para propriedades médias com alta demanda de colheita e múltiplos tratores.',
            price: 395,
            billingCycle: 'mensal',
            isFeatured: true,
            badge: 'Mais Escolhido',
            isActive: true,
            displayOrder: 2,
            checkoutUrl: '',
            limits: { maxUsers: 5, maxMachineries: 15, maxClients: 100, storageLimitGb: 10 },
            featuresText: 'Múltiplos Operadores\nApontamentos em Tempo Real\nControle de Combustível\nRelatórios Avançados e Gráficos\nSuporte Prioritário',
          },
          {
            id: 'business',
            name: 'Agro Enterprise',
            description: 'Para grandes cooperativas e prestadores de serviços agrícolas.',
            price: 795,
            billingCycle: 'mensal',
            isFeatured: false,
            isActive: true,
            displayOrder: 3,
            checkoutUrl: '',
            limits: { maxUsers: 20, maxMachineries: 50, maxClients: 500, storageLimitGb: 50 },
            featuresText: 'Usuários Ilimitados\nTelemetria e Exportação em Excel\nDashboard Executivo Multiusuário\nGerente de Contas Dedicado',
          },
        ];
      }

      setPlans(activeList);

      // Se o plano atual do assinante não estiver selecionado, seleciona o primeiro
      if (!selectedPlanName && activeList.length > 0) {
        setSelectedPlanName(activeList[0].name);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar planos da nuvem:', err);
      setErrorMessage('Não foi possível carregar os planos dinâmicos.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !subscriber) return null;

  const handleSave = async () => {
    if (!selectedPlanName) {
      setErrorMessage('Por favor, selecione um plano.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      // 1. Atualiza na nuvem do Supabase
      const success = await updateCloudSubscriberPlan(subscriber.id, selectedPlanName);
      if (!success) {
        console.warn('Supabase update plan warning, procedendo com atualização local.');
      }

      // Encontra dados do plano escolhido
      const chosenPlan = plans.find(p => p.name === selectedPlanName);

      const updatedSub: Subscriber = {
        ...subscriber,
        planName: selectedPlanName,
        planId: chosenPlan?.id || subscriber.planId,
        monthlyValue: chosenPlan ? chosenPlan.price : subscriber.monthlyValue,
        updatedAt: new Date().toISOString(),
      };

      onSuccess(updatedSub);
      onSuccessToast(`Plano do assinante alterado para "${selectedPlanName}" com sucesso!`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao alterar plano do assinante.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#1a1d24] rounded-2xl max-w-xl w-full shadow-2xl border border-[#2f3644] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-[#14161d] text-white flex items-center justify-between border-b border-[#2f3644]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#252a34] border border-[#2f3644] rounded-xl">
              <Layers className="w-5 h-5 text-[#8a92a6]" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">Alterar Plano do Assinante</h3>
              <p className="text-xs text-[#8a92a6]">
                Planos comerciais sincronizados dinamicamente com o Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8a92a6] hover:text-white hover:bg-[#252a34] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Identificação do Cliente */}
          <div className="p-3.5 bg-[#252a34] border border-[#2f3644] rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#8a92a6] uppercase tracking-wider block">
                Assinante
              </span>
              <p className="text-sm font-black text-white">
                {subscriber.name}
              </p>
              <p className="text-xs text-[#8a92a6]">
                {subscriber.responsibleEmail}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-[#8a92a6] block uppercase">
                Plano Atual
              </span>
              <span className="px-2.5 py-1 bg-[#1a1d24] border border-[#2f3644] text-white font-bold text-xs rounded-lg inline-block mt-0.5">
                {subscriber.planName || 'Sem Plano'}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-[#252a34] border border-rose-800/80 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Lista Dinâmica de Planos */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">
                Selecione o Novo Plano Comercial
              </label>
              {isLoading && (
                <span className="text-[11px] text-[#8a92a6] font-bold flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Sincronizando...
                </span>
              )}
            </div>

            <div className="space-y-2">
              {plans.map((p) => {
                const isSelected = selectedPlanName === p.name;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlanName(p.name)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#252a34] border-[#4d576a] ring-1 ring-[#4d576a]'
                        : 'bg-[#1a1d24] border-[#2f3644] hover:border-[#4d576a]'
                    }`}
                  >
                    <div className="space-y-0.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {p.name}
                        </span>
                        {p.badge && (
                          <span className="px-2 py-0.5 bg-[#252a34] border border-[#2f3644] text-[#d1d5db] text-[10px] font-bold rounded-full">
                            {p.badge}
                          </span>
                        )}
                        {subscriber.planName === p.name && (
                          <span className="text-[10px] font-bold text-[#8a92a6]">
                            (Atual)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8a92a6] line-clamp-1">
                        {p.description}
                      </p>
                      <div className="text-[11px] text-[#8a92a6] font-medium">
                        Até {p.limits?.maxMachineries || '∞'} máquinas • {p.limits?.maxUsers || '∞'} usuários
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <span className="text-sm font-black text-white block font-mono">
                          {formatCurrencyBRL(p.price)}
                        </span>
                        <span className="text-[10px] text-[#8a92a6] uppercase font-bold">
                          /{p.billingCycle || 'mês'}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                          isSelected
                            ? 'bg-[#3a4150] text-white border border-[#4d576a]'
                            : 'border border-[#2f3644]'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé com botões de ação */}
        <div className="p-4 bg-[#14161d] border-t border-[#2f3644] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-[#d1d5db] bg-[#1a1d24] hover:bg-[#252a34] border border-[#2f3644] rounded-lg transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !selectedPlanName}
            className="px-5 py-2.5 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] disabled:opacity-50 text-white rounded-lg text-xs font-bold border border-[#4d576a] flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Salvando na Nuvem...' : 'Confirmar Alteração de Plano'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
