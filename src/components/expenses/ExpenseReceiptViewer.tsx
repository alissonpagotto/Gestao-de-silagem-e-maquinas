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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[2px] overflow-hidden">
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] border-b border-black text-black flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide text-black">
              Comprovante / Recibo de Despesa
            </h3>
            <p className="text-xs text-black/80 font-medium">
              {expense.description} &bull; {formatCurrencyBRL(expense.amount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-black/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#cad4e6] flex flex-col items-center justify-start">
          <div className="w-full flex-1 flex flex-col items-center justify-center bg-[#e0e6f1] border border-black rounded-xl p-4 sm:p-6">
            {isImage ? (
              <img
                src={expense.receiptUrl}
                alt="Comprovante"
                className="max-h-[68vh] max-w-full rounded-xl shadow-sm border border-black bg-white object-contain"
              />
            ) : (
              <div className="text-center p-8 bg-white rounded-xl border border-black shadow-xs max-w-md">
                <FileText className="w-16 h-16 text-emerald-700 mx-auto mb-3" />
                <p className="font-bold text-black text-sm mb-1">
                  {expense.receiptName || 'Documento / NF-e'}
                </p>
                <p className="text-xs text-slate-700 mb-4">
                  Arquivo anexado ao lançamento de {formatDateBR(expense.dueDate)}
                </p>
                <a
                  href={expense.receiptUrl}
                  download={expense.receiptName || 'comprovante.pdf'}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Documento</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] border-t border-black flex items-center justify-between text-xs text-black shrink-0">
          <div>
            <span>Fornecedor: <strong className="text-black">{expense.supplier || 'Não informado'}</strong></span>
            {expense.invoiceNumber && <span className="ml-3">NF: <strong className="text-black">{expense.invoiceNumber}</strong></span>}
          </div>
          <div className="flex items-center space-x-2">
            {isImage && (
              <a
                href={expense.receiptUrl}
                download={expense.receiptName || `comprovante_${expense.id}.png`}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 font-bold text-xs shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Salvar Imagem</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-black text-black font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
