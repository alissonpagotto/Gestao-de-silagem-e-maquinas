import React, { useState, useEffect } from 'react';
import { X, Check, Save } from 'lucide-react';

interface QuickMemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickMemoModal: React.FC<QuickMemoModalProps> = ({ isOpen, onClose }) => {
  const [memo, setMemo] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedMemo = localStorage.getItem('silagem_facil_quick_memo');
    if (savedMemo) setMemo(savedMemo);
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('silagem_facil_quick_memo', memo);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Standardized Solid Teal Bar */}
        <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold tracking-tight">
            Bloco de Notas Rápido da Safra
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
              ANOTAÇÕES E LEMBRETES OPERACIONAIS
            </label>
            <textarea
              rows={7}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Anote lembretes da ensilagem, calibragem de corte, contato de produtores, combustível ou diárias..."
              className="w-full p-3.5 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#009688] resize-none"
            />
          </div>

          {/* Footer - Standardized */}
          <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
            <span className="text-[11px] text-stone-500">Salvo no navegador local</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center space-x-1.5 px-6 py-2 bg-[#156f33] hover:bg-[#0e5224] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{saved ? 'Salvo!' : 'Salvar Nota'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
