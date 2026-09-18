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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#1a1d24] rounded-2xl max-w-md w-full shadow-2xl border border-[#2f3644] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-[#14161d] text-white flex items-center justify-between border-b border-[#2f3644]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#252a34] border border-[#2f3644] rounded-xl">
              {isCurrentlySuspended ? (
                <Play className="w-5 h-5 text-[#8a92a6]" />
              ) : (
                <Pause className="w-5 h-5 text-[#8a92a6]" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">
                {isCurrentlySuspended ? 'Reativar Assinatura' : 'Pausar / Suspender Assinatura'}
              </h3>
              <p className="text-xs text-[#8a92a6]">
                Sincronização instantânea com o banco Supabase
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

        {/* Conteúdo */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 bg-[#252a34] rounded-xl border border-[#2f3644] space-y-1">
            <span className="text-[10px] font-bold text-[#8a92a6] uppercase tracking-wider block">
              Assinante
            </span>
            <p className="text-sm font-black text-white">
              {subscriber.name}
            </p>
            <p className="text-xs text-[#8a92a6] font-mono">
              {subscriber.responsibleEmail}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-[#252a34] border border-rose-800/80 rounded-xl text-xs font-bold text-rose-300">
              {errorMsg}
            </div>
          )}

          {isCurrentlySuspended ? (
            <div className="flex items-start gap-3 p-3.5 bg-[#252a34] border border-[#2f3644] rounded-xl text-xs text-[#d1d5db]">
              <ShieldCheck className="w-5 h-5 text-[#8a92a6] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-white">Deseja liberar e reativar o acesso?</p>
                <p className="text-[11px] leading-relaxed text-[#8a92a6]">
                  O status do cliente voltará para <strong>Ativa</strong> e os operadores desta fazenda poderão acessar e apontar silagem normalmente no ERP.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3.5 bg-[#252a34] border border-[#2f3644] rounded-xl text-xs text-[#d1d5db]">
              <AlertTriangle className="w-5 h-5 text-[#8a92a6] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-white">Aviso de Suspensão de Acesso</p>
                <p className="text-[11px] leading-relaxed text-[#8a92a6]">
                  Ao suspender, o status será definido como <strong>Suspenso</strong> no banco. Qualquer tentativa de login ou acesso ao ERP será bloqueada com a tela de pendência financeira.
                </p>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="pt-3 border-t border-[#2f3644] flex items-center justify-end gap-2">
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
              onClick={handleConfirm}
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] disabled:opacity-50 text-white rounded-lg text-xs font-bold border border-[#4d576a] flex items-center gap-1.5 transition shadow-xs cursor-pointer"
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
