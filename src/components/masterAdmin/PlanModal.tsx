import React, { useState, useEffect } from 'react';
import { X, Save, Layers, Sliders, CheckSquare, Sparkles, AlertCircle } from 'lucide-react';
import { PlanDefinition } from '../../types/masterAdmin';
import { AGROCONTROL_PLANS_DATA_KEY, getStoredPlans } from '../../lib/masterAdminStorage';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanDefinition | null;
  onSave: (plan: PlanDefinition) => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  plan,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'limites' | 'recursos'>('geral');

  // Aba Geral
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(195);
  const [billingCycle, setBillingCycle] = useState<'mensal' | 'anual'>('mensal');
  const [badge, setBadge] = useState('');
  const [isFeatured, setIsFeatured] = useState(false); // Chave "Destaque"
  const [isActive, setIsActive] = useState(true); // Chave "Status do Plano (ATIVO)"
  const [displayOrder, setDisplayOrder] = useState<number>(1); // 'ORDEM DE EXIBIÇÃO'

  // Aba Limites
  const [maxUsers, setMaxUsers] = useState<string>('5');
  const [maxMachineries, setMaxMachineries] = useState<string>('10');
  const [maxClients, setMaxClients] = useState<string>('100');
  const [storageLimitGb, setStorageLimitGb] = useState<number>(5);

  // Aba Recursos
  const [featuresText, setFeaturesText] = useState(''); // 'FEATURES (UMA POR LINHA)'
  const [checkoutUrl, setCheckoutUrl] = useState(''); // 'URL DE CHECKOUT'

  const [error, setError] = useState('');

  useEffect(() => {
    if (plan) {
      setName(plan.name || '');
      setDescription(plan.description || '');
      setPrice(plan.price || 0);
      setBillingCycle(plan.billingCycle || 'mensal');
      setBadge(plan.badge || '');
      setIsFeatured(Boolean(plan.isFeatured));
      setIsActive(plan.isActive !== undefined ? plan.isActive : true);
      setDisplayOrder(plan.displayOrder || 1);

      setMaxUsers(plan.limits.maxUsers === 'unlimited' ? 'unlimited' : String(plan.limits.maxUsers || 5));
      setMaxMachineries(plan.limits.maxMachineries === 'unlimited' ? 'unlimited' : String(plan.limits.maxMachineries || 10));
      setMaxClients(plan.limits.maxClients === 'unlimited' ? 'unlimited' : String(plan.limits.maxClients || 100));
      setStorageLimitGb(plan.limits.storageLimitGb || 5);

      setFeaturesText(plan.featuresText || '');
      setCheckoutUrl(plan.checkoutUrl || '');
    } else {
      setName('');
      setDescription('');
      setPrice(299);
      setBillingCycle('mensal');
      setBadge('');
      setIsFeatured(false);
      setIsActive(true);
      setDisplayOrder(1);

      setMaxUsers('5');
      setMaxMachineries('10');
      setMaxClients('100');
      setStorageLimitGb(5);

      setFeaturesText('Até 10 veículos e máquinas cadastradas\n5 usuários simultâneos\nGestão de ordens de corte\nSuporte via WhatsApp');
      setCheckoutUrl('https://pay.kiwify.com.br/exemplo');
    }
    setActiveTab('geral');
    setError('');
  }, [plan, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do plano.');
      return;
    }

    const updatedPlan: PlanDefinition = {
      id: plan?.id || `plano-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      price: Number(price) || 0,
      billingCycle,
      badge: badge.trim() || undefined,
      isFeatured,
      isActive,
      displayOrder: Number(displayOrder) || 1,
      limits: {
        maxUsers: maxUsers === 'unlimited' ? 'unlimited' : Number(maxUsers) || 1,
        maxMachineries: maxMachineries === 'unlimited' ? 'unlimited' : Number(maxMachineries) || 1,
        maxClients: maxClients === 'unlimited' ? 'unlimited' : Number(maxClients) || 1,
        storageLimitGb: Number(storageLimitGb) || 1,
      },
      featuresText: featuresText.trim(),
      checkoutUrl: checkoutUrl.trim(),
    };

    // Garantia direta no localStorage e disparo de StorageEvent imediato
    try {
      if (typeof localStorage !== 'undefined') {
        const currentPlans = getStoredPlans();
        const exists = currentPlans.some(p => p.id === updatedPlan.id);
        const newPlansList = exists 
          ? currentPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
          : [...currentPlans, updatedPlan];
        newPlansList.sort((a, b) => a.displayOrder - b.displayOrder);
        const serialized = JSON.stringify(newPlansList);
        localStorage.setItem(AGROCONTROL_PLANS_DATA_KEY, serialized);
        localStorage.setItem('agrocontrol_plans_data', serialized);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error('Erro ao gravar plano diretamente no localStorage em PlanModal:', e);
    }

    onSave(updatedPlan);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-700 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-teal-200" />
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                {plan ? `Refatorar Plano: ${plan.name}` : 'Criar Novo Plano de Assinatura'}
              </h3>
              <p className="text-xs text-teal-100/80">
                Configure limites, precificação e exibição na Landing Page pública
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

        {/* Barra de Abas Obrigatórias (Geral, Limites, Recursos) */}
        <div className="bg-stone-100 dark:bg-stone-800/60 p-2 flex border-b border-stone-200 dark:border-stone-800 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'geral'
                ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Aba Geral</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('limites')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'limites'
                ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Aba Limites</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recursos')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'recursos'
                ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Aba Recursos</span>
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ABA GERAL */}
          {activeTab === 'geral' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    NOME DO PLANO *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Produtor Essencial, Frota Pro, Agro Enterprise"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-black text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    DESCRIÇÃO DO PLANO
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Pequena descrição ou público-alvo do plano"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    VALOR MENSAL (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-stone-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-black text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    ORDEM DE EXIBIÇÃO (1, 2, 3...)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 1)}
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-black text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    BADGE / SELO DE DESTAQUE (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="Ex: Mais Escolhido, Melhor Custo-Benefício"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Chaves de Controle: "Destaque" e "Status do Plano (ATIVO)" */}
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="text-xs font-black text-stone-900 dark:text-stone-100 block">
                        Plano em Destaque
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Ativa a borda verde com realce visual na Landing Page pública
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-stone-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-teal-600" />
                    <div>
                      <span className="text-xs font-black text-stone-900 dark:text-stone-100 block">
                        Status do Plano (ATIVO)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Se inativo, este plano desaparece da Landing Page e não aceita novos assinantes
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-stone-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ABA LIMITES */}
          {activeTab === 'limites' && (
            <div className="space-y-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Defina os limites de uso impostos no ERP para este plano (digite um número ou 'unlimited' para ilimitado):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    MÁXIMO DE USUÁRIOS
                  </label>
                  <input
                    type="text"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(e.target.value)}
                    placeholder="Ex: 5 ou unlimited"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    MÁXIMO DE MÁQUINAS & VEÍCULOS
                  </label>
                  <input
                    type="text"
                    value={maxMachineries}
                    onChange={(e) => setMaxMachineries(e.target.value)}
                    placeholder="Ex: 15 ou unlimited"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    MÁXIMO DE CLIENTES NO CRM
                  </label>
                  <input
                    type="text"
                    value={maxClients}
                    onChange={(e) => setMaxClients(e.target.value)}
                    placeholder="Ex: 100 ou unlimited"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    ARMAZENAMENTO EM NUVEM (GB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={storageLimitGb}
                    onChange={(e) => setStorageLimitGb(parseInt(e.target.value) || 1)}
                    placeholder="Ex: 5"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ABA RECURSOS */}
          {activeTab === 'recursos' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    FEATURES (UMA POR LINHA) *
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Renderiza com check verde no card da Landing Page
                  </span>
                </div>
                <textarea
                  rows={6}
                  required
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder="Até 10 veículos com controle de placa&#10;5 operadores no painel&#10;Gestão de ordens de serviço&#10;Suporte prioritário"
                  className="w-full p-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  URL DE CHECKOUT *
                </label>
                <input
                  type="url"
                  required
                  value={checkoutUrl}
                  onChange={(e) => setCheckoutUrl(e.target.value)}
                  placeholder="https://pay.kiwify.com.br/seu-link-de-checkout"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-mono text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <span className="text-[10px] text-stone-500 block mt-1">
                  Injetado diretamente no botão "Começar Agora" do card deste plano na Landing Page pública.
                </span>
              </div>
            </div>
          )}

          {/* Rodapé de Ações */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Plano</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
