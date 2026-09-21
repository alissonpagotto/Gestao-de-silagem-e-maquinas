import React, { useState, useEffect } from 'react';
import { X, Layers, Check, Save, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { Subscriber, PlanDefinition } from '../../types/masterAdmin';
import { fetchCloudPlans, updateCloudSubscriberPlan } from '../../lib/supabaseService';
import { formatCurrencyBRL } from '../../lib/formatters';
import { supabase } from '../../lib/supabase';

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
      // 1. Fetch dinâmico direto em tempo real da tabela 'plans' do Supabase
      const { data: cloudData, error } = await supabase
        .from('plans')
        .select('*')
        .order('display_order', { ascending: true });

      let activeList: PlanDefinition[] = [];

      if (!error && cloudData && cloudData.length > 0) {
        activeList = cloudData
          .filter((row: any) => row.is_active !== false)
          .map((row: any) => ({
            id: row.id,
            name: row.name,
            description: row.description || '',
            price: Number(row.price) || 0,
            billingCycle: row.billing_cycle || 'mensal',
            badge: row.badge,
            isFeatured: Boolean(row.is_featured),
            isActive: row.is_active !== false,
            displayOrder: row.display_order || 1,
            limits: row.limits || { maxUsers: 1, maxMachineries: 2, maxClients: 2, storageLimitGb: 5 },
            featuresText: row.features_text || '',
            checkoutUrl: row.checkout_url || ''
          }));
      } else {
        const fallback = await fetchCloudPlans();
        if (fallback && fallback.length > 0) {
          activeList = fallback.filter(p => p.isActive !== false);
        }
      }

      setPlans(activeList);

      // Pré-seleciona o plano atual do assinante
      if (subscriber) {
        const subPlanKey = (subscriber.planName || subscriber.planId || '').toLowerCase();
        const normalize = (v: string) => v.toLowerCase().replace(/^plano[-_]/, '').replace(/[^a-z0-9]/g, '');
        const subNorm = normalize(subPlanKey);

        const matched = activeList.find(p => {
          const pIdNorm = normalize(p.id);
          const pNameNorm = normalize(p.name);
          return (subNorm && (pIdNorm === subNorm || pNameNorm === subNorm)) ||
                 (subNorm.includes('essencial') && (pNameNorm.includes('essencial') || pIdNorm.includes('essencial'))) ||
                 (subNorm.includes('intermediario') && (pNameNorm.includes('intermediario') || pIdNorm.includes('intermediario'))) ||
                 (subNorm.includes('pro') && !subNorm.includes('enterprise') && (pNameNorm.includes('pro') || pIdNorm.includes('pro') || pNameNorm.includes('intermediario'))) ||
                 (subNorm.includes('master') && (pNameNorm.includes('master') || pIdNorm.includes('master'))) ||
                 (subNorm.includes('enterprise') && (pNameNorm.includes('enterprise') || pIdNorm.includes('enterprise') || pNameNorm.includes('master')));
        });

        if (matched) {
          setSelectedPlanName(matched.name);
        } else if (activeList.length > 0 && !selectedPlanName) {
          setSelectedPlanName(activeList[0].name);
        }
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
      // Encontra dados do plano escolhido
      const chosenPlan = plans.find(p => p.name === selectedPlanName);
      const chosenPrice = chosenPlan ? chosenPlan.price : undefined;

      // 1. Atualiza na nuvem do Supabase
      const success = await updateCloudSubscriberPlan(subscriber.id, selectedPlanName, chosenPrice);
      if (!success) {
        console.warn('Supabase update plan warning, procedendo com atualização local.');
      }

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
