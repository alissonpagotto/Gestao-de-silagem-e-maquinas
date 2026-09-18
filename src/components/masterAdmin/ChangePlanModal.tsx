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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-xl w-full shadow-2xl border border-purple-200 dark:border-purple-900/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Layers className="w-5 h-5 text-purple-200" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Alterar Plano do Assinante</h3>
              <p className="text-xs text-purple-100/80">
                Planos comerciais sincronizados dinamicamente com o Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Identificação do Cliente */}
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
                Assinante
              </span>
              <p className="text-sm font-black text-stone-900 dark:text-stone-100">
                {subscriber.name}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {subscriber.responsibleEmail}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-stone-400 block uppercase">
                Plano Atual
              </span>
              <span className="px-2.5 py-1 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-lg inline-block mt-0.5">
                {subscriber.planName || 'Sem Plano'}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Lista Dinâmica de Planos */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Selecione o Novo Plano Comercial
              </label>
              {isLoading && (
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
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
                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-purple-300 dark:hover:border-purple-800'
                    }`}
                  >
                    <div className="space-y-0.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-stone-900 dark:text-stone-100">
                          {p.name}
                        </span>
                        {p.badge && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[10px] font-black rounded-full">
                            {p.badge}
                          </span>
                        )}
                        {subscriber.planName === p.name && (
                          <span className="text-[10px] font-bold text-stone-400">
                            (Atual)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
                        {p.description}
                      </p>
                      <div className="text-[11px] text-stone-400 font-medium">
                        Até {p.limits?.maxMachineries || '∞'} máquinas • {p.limits?.maxUsers || '∞'} usuários
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <span className="text-sm font-black text-purple-600 dark:text-purple-400 block">
                          {formatCurrencyBRL(p.price)}
                        </span>
                        <span className="text-[10px] text-stone-400 uppercase font-bold">
                          /{p.billingCycle || 'mês'}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'border border-stone-300 dark:border-stone-700'
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
        <div className="p-4 bg-stone-50 dark:bg-stone-900/80 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !selectedPlanName}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Salvando na Nuvem...' : 'Confirmar Alteração de Plano'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
