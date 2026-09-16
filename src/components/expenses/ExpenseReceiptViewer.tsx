import React from 'react';
import { X, Download, FileText } from 'lucide-react';
import { Expense } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface ExpenseReceiptViewerProps {
  expense: Expense | null;
  onClose: () => void;
}

export const ExpenseReceiptViewer: React.FC<ExpenseReceiptViewerProps> = ({
  expense,
  onClose,
}) => {
  if (!expense || !expense.receiptUrl) return null;

  const isImage = expense.receiptUrl.startsWith('data:image/') || 
    expense.receiptUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Standardized Solid Teal Bar */}
        <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Comprovante / Recibo de Despesa
            </h3>
            <p className="text-xs text-white/80">
              {expense.description} &bull; {formatCurrencyBRL(expense.amount)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-stone-100/50 dark:bg-stone-800/30">
          {isImage ? (
            <img
              src={expense.receiptUrl}
              alt="Comprovante"
              className="max-h-[55vh] max-w-full rounded-xl shadow-sm border border-stone-300 dark:border-stone-700 object-contain"
            />
          ) : (
            <div className="text-center p-8 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-xs max-w-md">
              <FileText className="w-16 h-16 text-[#009688] mx-auto mb-3" />
              <p className="font-bold text-stone-900 dark:text-stone-100 text-sm mb-1">
                {expense.receiptName || 'Documento / NF-e'}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                Arquivo anexado ao lançamento de {formatDateBR(expense.dueDate)}
              </p>
              <a
                href={expense.receiptUrl}
                download={expense.receiptName || 'comprovante.pdf'}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Documento</span>
              </a>
            </div>
          )}
        </div>

        {/* Footer info - Standardized */}
        <div className="px-5 py-3.5 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-600 dark:text-stone-300">
          <div>
            <span>Fornecedor: <strong className="text-stone-900 dark:text-stone-100">{expense.supplier || 'Não informado'}</strong></span>
            {expense.invoiceNumber && <span className="ml-3">NF: <strong className="text-stone-900 dark:text-stone-100">{expense.invoiceNumber}</strong></span>}
          </div>
          <div className="flex items-center space-x-2">
            {isImage && (
              <a
                href={expense.receiptUrl}
                download={expense.receiptName || `comprovante_${expense.id}.png`}
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Salvar Imagem</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
