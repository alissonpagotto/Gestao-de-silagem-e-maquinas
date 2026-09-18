import React, { useState } from 'react';
import { X, Calendar, Clock, Plus, Save, AlertCircle, Sparkles } from 'lucide-react';
import { Subscriber } from '../../types/masterAdmin';
import { updateCloudSubscriberTrial } from '../../lib/supabaseService';
import { formatDateBR } from '../../lib/formatters';

interface ExtendTrialModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  onSuccess: (updatedSubscriber: Subscriber) => void;
  onSuccessToast: (message: string) => void;
}

export const ExtendTrialModal: React.FC<ExtendTrialModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  onSuccess,
  onSuccessToast,
}) => {
  const [daysToAdd, setDaysToAdd] = useState<number>(15);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !subscriber) return null;

  // Calcula a base de data: se o trial atual for futuro, soma em cima dele, senão soma em cima de hoje
  const currentExpirationDate = subscriber.trialUntil ? new Date(subscriber.trialUntil) : new Date();
  const baseDate = currentExpirationDate > new Date() ? currentExpirationDate : new Date();

  const newExpirationDate = new Date(baseDate);
  newExpirationDate.setDate(newExpirationDate.getDate() + (Number(daysToAdd) || 0));
  const newExpirationIso = newExpirationDate.toISOString();
  const newExpirationDateString = newExpirationIso.split('T')[0];

  const handleQuickAdd = (days: number) => {
    setDaysToAdd(days);
    setErrorMessage('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (daysToAdd <= 0) {
      setErrorMessage('O número de dias adicionais deve ser maior que zero.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      // 1. Atualiza na coluna trial_ends_at do Supabase
      const success = await updateCloudSubscriberTrial(subscriber.id, newExpirationIso);
      if (!success) {
        console.warn('Supabase trial update warning, procedendo com atualização local.');
      }

      // 2. Atualiza o estado do assinante local
      const updatedSub: Subscriber = {
        ...subscriber,
        trialUntil: newExpirationDateString,
        updatedAt: new Date().toISOString(),
      };

      onSuccess(updatedSub);
      onSuccessToast(`Trial de "${subscriber.name}" estendido até ${formatDateBR(newExpirationDateString)}!`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao estender período de teste.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full shadow-2xl border border-amber-900/30 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-800 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Calendar className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Estender Período de Trial</h3>
              <p className="text-xs text-amber-100/80">Atualização em tempo real na nuvem do Supabase</p>
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

        {/* Conteúdo */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Informações do Assinante */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1">
            <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
              Assinante
            </span>
            <p className="text-sm font-black text-stone-900 dark:text-stone-100">
              {subscriber.name}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Vencimento atual do Trial: </span>
              <strong className="text-stone-900 dark:text-stone-200">
                {subscriber.trialUntil ? formatDateBR(subscriber.trialUntil) : 'Não definido'}
              </strong>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Seleção de dias */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
              DIAS ADICIONAIS DE TESTE
            </label>
            
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                required
                value={daysToAdd}
                onChange={(e) => setDaysToAdd(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-sm font-black text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400 shrink-0">
                dias
              </span>
            </div>

            {/* Atalhos Rápidos */}
            <div className="flex items-center gap-2 pt-1">
              {[7, 15, 30, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => handleQuickAdd(days)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                    daysToAdd === days
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100 dark:hover:bg-amber-950/40'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>+{days} dias</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pré-visualização do Novo Vencimento */}
          <div className="p-3.5 bg-stone-100 dark:bg-stone-800/80 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 block">
                Nova Data de Término do Trial
              </span>
              <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                {formatDateBR(newExpirationDateString)}
              </span>
            </div>
            <span className="px-2 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-black rounded-lg">
              +{daysToAdd} dias adicionados
            </span>
          </div>

          {/* Ações */}
          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Gravando...' : 'Confirmar Prorrogação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
