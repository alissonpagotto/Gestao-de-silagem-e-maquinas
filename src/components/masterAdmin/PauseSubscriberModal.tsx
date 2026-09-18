import React, { useState } from 'react';
import { X, Pause, Play, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Subscriber } from '../../types/masterAdmin';
import { updateCloudSubscriberStatus } from '../../lib/supabaseService';

interface PauseSubscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  onSuccess: (updatedSubscriber: Subscriber) => void;
  onSuccessToast: (message: string) => void;
}

export const PauseSubscriberModal: React.FC<PauseSubscriberModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  onSuccess,
  onSuccessToast,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !subscriber) return null;

  const isCurrentlySuspended = subscriber.status?.toLowerCase() === 'suspensa' || subscriber.status?.toLowerCase() === 'suspenso';
  const targetStatus = isCurrentlySuspended ? 'Ativa' : 'Suspenso';
  const targetStatusLocal = isCurrentlySuspended ? 'ativa' : 'suspensa';

  const handleConfirm = async () => {
    setIsSaving(true);
    setErrorMsg('');
    try {
      // 1. Atualiza na nuvem do Supabase
      await updateCloudSubscriberStatus(subscriber.id, targetStatus);

      // 2. Atualiza estado local
      const updated: Subscriber = {
        ...subscriber,
        status: targetStatusLocal as any,
        updatedAt: new Date().toISOString(),
      };

      onSuccess(updated);
      onSuccessToast(
        isCurrentlySuspended
          ? `Assinatura de "${subscriber.name}" reativada com sucesso!`
          : `Assinatura de "${subscriber.name}" pausada. Acesso ao ERP suspenso.`
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao alterar status no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div
          className={`px-5 py-4 text-white flex items-center justify-between ${
            isCurrentlySuspended
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
              : 'bg-gradient-to-r from-amber-600 to-orange-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              {isCurrentlySuspended ? (
                <Play className="w-5 h-5 text-emerald-200" />
              ) : (
                <Pause className="w-5 h-5 text-amber-200" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                {isCurrentlySuspended ? 'Reativar Assinatura' : 'Pausar / Suspender Assinatura'}
              </h3>
              <p className="text-xs text-white/80">
                Sincronização instantânea com o banco Supabase
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

        {/* Conteúdo */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-1">
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
              Assinante
            </span>
            <p className="text-sm font-black text-stone-900 dark:text-stone-100">
              {subscriber.name}
            </p>
            <p className="text-xs text-stone-500 font-mono">
              {subscriber.responsibleEmail}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {isCurrentlySuspended ? (
            <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Deseja liberar e reativar o acesso?</p>
                <p className="text-[11px] leading-relaxed opacity-90">
                  O status do cliente voltará para <strong>Ativa</strong> e os operadores desta fazenda poderão acessar e apontar silagem normalmente no ERP.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Aviso de Suspensão de Acesso</p>
                <p className="text-[11px] leading-relaxed opacity-90">
                  Ao suspender, o status será definido como <strong>Suspenso</strong> no banco. Qualquer tentativa de login ou acesso ao ERP será bloqueada com a tela de pendência financeira.
                </p>
              </div>
            </div>
          )}

          {/* Botões */}
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
              type="button"
              onClick={handleConfirm}
              disabled={isSaving}
              className={`px-5 py-2.5 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50 ${
                isCurrentlySuspended
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {isCurrentlySuspended ? (
                <>
                  <Play className="w-4 h-4" />
                  <span>{isSaving ? 'Reativando...' : 'Reativar Assinatura'}</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  <span>{isSaving ? 'Suspendendo...' : 'Confirmar Suspensão'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
