import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface RestoreConfirmModalProps {
  isOpen: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  zIndexClass?: string;
}

export const RestoreConfirmModal: React.FC<RestoreConfirmModalProps> = ({
  isOpen,
  message,
  onCancel,
  onConfirm,
  zIndexClass = 'z-50',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
            <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
              CONFIRMAÇÃO DE RESTAURAÇÃO
            </h4>
            <p className="text-xs font-bold text-zinc-700 dark:text-stone-300 uppercase leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-100 dark:hover:bg-stone-800 text-[11px] font-bold uppercase transition cursor-pointer"
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-black uppercase tracking-wide shadow-xs transition cursor-pointer"
          >
            CONFIRMAR RESTAURAÇÃO
          </button>
        </div>
      </div>
    </div>
  );
};
