import React from 'react';
import { X, CheckCircle } from 'lucide-react';

interface TrialInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrialInfoModal: React.FC<TrialInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Standardized Solid Teal Bar */}
        <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold tracking-tight">
            Silagem Fácil Pro
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm text-stone-600 dark:text-stone-300">
          <p className="leading-relaxed">
            Você está utilizando a versão completa do <strong>Silagem Fácil CRM & Gestão Agrícola</strong>.
          </p>

          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-emerald-900 dark:text-emerald-300 font-bold text-xs">
              <CheckCircle className="w-4 h-4 text-[#156f33]" />
              <span>Todos os recursos estão liberados:</span>
            </div>
            <ul className="list-disc list-inside text-xs text-stone-700 dark:text-stone-300 pl-1 space-y-1">
              <li>Lançamentos de despesas operacionais ilimitados</li>
              <li>CRM de clientes e pedidos de silagem</li>
              <li>Gestão de frota, maquinários e controle de CNH</li>
              <li>Importação de XML de Notas Fiscais (NF-e)</li>
              <li>Demonstrativo DRE e relatórios de custo/tonelada</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-[#156f33] hover:bg-[#0e5224] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              Continuar Utilizando
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
