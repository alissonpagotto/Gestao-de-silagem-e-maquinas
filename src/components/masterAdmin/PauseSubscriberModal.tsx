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
      <div className="bg-zinc-100 dark:bg-stone-900 rounded-2xl max-w-md w-full shadow-2xl border border-zinc-300 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-zinc-800 text-white flex items-center justify-between border-b border-zinc-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              {isCurrentlySuspended ? (
                <Play className="w-5 h-5 text-zinc-200" />
              ) : (
                <Pause className="w-5 h-5 text-zinc-200" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">
                {isCurrentlySuspended ? 'Reativar Assinatura' : 'Pausar / Suspender Assinatura'}
              </h3>
              <p className="text-xs text-zinc-300">
                Sincronização instantânea com o banco Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 bg-white dark:bg-stone-800 rounded-xl border border-zinc-300 dark:border-stone-700 space-y-1">
            <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
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
            <div className="flex items-start gap-3 p-3.5 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs text-zinc-800 dark:text-zinc-200">
              <ShieldCheck className="w-5 h-5 text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-zinc-900 dark:text-white">Deseja liberar e reativar o acesso?</p>
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  O status do cliente voltará para <strong>Ativa</strong> e os operadores desta fazenda poderão acessar e apontar silagem normalmente no ERP.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3.5 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs text-zinc-800 dark:text-zinc-200">
              <AlertTriangle className="w-5 h-5 text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-zinc-900 dark:text-white">Aviso de Suspensão de Acesso</p>
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Ao suspender, o status será definido como <strong>Suspenso</strong> no banco. Qualquer tentativa de login ou acesso ao ERP será bloqueada com a tela de pendência financeira.
                </p>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="pt-3 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold border border-zinc-900 flex items-center gap-1.5 transition shadow-sm cursor-pointer"
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
