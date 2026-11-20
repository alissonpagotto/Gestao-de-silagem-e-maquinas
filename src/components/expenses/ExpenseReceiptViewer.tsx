import React from 'react';
import { X, Download, FileText, Printer, Receipt } from 'lucide-react';
import { CompanyProfile, Expense } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredCompanyProfile } from '../../lib/storage';
import { generatePrintableHtml, executePrint } from '../../lib/printService';

interface ExpenseReceiptViewerProps {
  expense: Expense | null;
  onClose: () => void;
}

const escapeHtml = (value: string | undefined | null): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const ExpenseReceiptViewer: React.FC<ExpenseReceiptViewerProps> = ({
  expense,
  onClose,
}) => {
  if (!expense) return null;

  const hasAttachment = Boolean(expense.receiptUrl);
  const isImage = Boolean(
    expense.receiptUrl &&
      (expense.receiptUrl.startsWith('data:image/') ||
        expense.receiptUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i))
  );

  const paymentLabel = String(expense.paymentMethod || 'A COMBINAR')
    .replace(/_/g, ' ')
    .toUpperCase();
  const statusLabel =
    expense.status === 'pago'
      ? 'PAGO / LIQUIDADO'
      : expense.status === 'atrasado'
      ? 'VENCIDO / ATRASADO'
      : 'EM ABERTO';

  const handlePrintExpenseReceipt = () => {
    const company = (getStoredCompanyProfile() || {}) as CompanyProfile;
    const imgBlock = isImage && expense.receiptUrl
      ? `<div style="margin-top:12px;text-align:center;border:1px solid #cbd5e1;border-radius:6px;padding:8px;background:#fff;">
           <div style="font-size:8.5pt;font-weight:900;text-transform:uppercase;color:#334155;margin-bottom:6px;">ANEXO / COMPROVANTE DIGITALIZADO</div>
           <img src="${expense.receiptUrl}" style="max-width:100%;max-height:420px;object-fit:contain;" />
         </div>`
      : '';

    const contentHtml = `
      <div style="border:1.5px solid #0f172a;border-radius:6px;padding:10px 12px;background:#f8fafc;margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:9.5pt;">
          <div><strong>DESCRIÇÃO:</strong> ${escapeHtml(expense.description)}</div>
          <div><strong>VALOR TOTAL:</strong> <span style="font-weight:900;color:#047857;font-size:11pt;">${formatCurrencyBRL(expense.amount)}</span></div>
          <div><strong>FORNECEDOR:</strong> ${escapeHtml(expense.supplier || 'NÃO INFORMADO')}</div>
          <div><strong>DOCUMENTO / NF:</strong> ${escapeHtml(expense.invoiceNumber || 'S/N')}</div>
          <div><strong>VENCIMENTO:</strong> ${expense.dueDate ? formatDateBR(expense.dueDate) : '-'}</div>
          <div><strong>PAGAMENTO:</strong> ${escapeHtml(paymentLabel)} (${escapeHtml(statusLabel)})</div>
          ${expense.categoryName ? `<div><strong>CATEGORIA:</strong> ${escapeHtml(expense.categoryName)}</div>` : ''}
          ${expense.costCenterName ? `<div><strong>CENTRO DE CUSTO:</strong> ${escapeHtml(expense.costCenterName)}</div>` : ''}
          ${expense.machineryName ? `<div><strong>VEÍCULO / FROTA:</strong> ${escapeHtml(expense.machineryName)}</div>` : ''}
        </div>
        ${expense.notes ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:8.5pt;"><strong>OBSERVAÇÕES:</strong> ${escapeHtml(expense.notes)}</div>` : ''}
      </div>
      ${imgBlock}
    `;

    const html = generatePrintableHtml({
      title: `COMPROVANTE / ESPELHO DE DESPESA${expense.invoiceNumber ? ` — NF ${expense.invoiceNumber}` : ''}`,
      subtitle: `${expense.supplier || 'Despesa'} • Vencimento: ${expense.dueDate ? formatDateBR(expense.dueDate) : '-'}`,
      documentType: 'COMPROVANTE DE DESPESA / NF',
      company,
      contentHtml,
      orientation: 'portrait',
      showSignatures: true,
      signatureLabels: ['Emitente / Favorecido', 'Responsável Financeiro'],
    });
    executePrint(html);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 overflow-hidden"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}
      onClick={onClose}
    >
      <div
        className="w-[88vw] max-w-[1000px] max-h-[92vh] flex flex-col justify-start mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] border-b border-black text-black flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded bg-white border border-black flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide text-black truncate">
                Comprovante / Espelho de Despesa {expense.invoiceNumber ? `— NF ${expense.invoiceNumber}` : ''}
              </h3>
              <p className="text-xs text-black/80 font-medium truncate">
                {expense.description} &bull; {formatCurrencyBRL(expense.amount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-black/10 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-[#cad4e6] space-y-3">
          {/* Espelho Estruturado da Despesa / NF */}
          <div className="bg-white border-2 border-black rounded-xl p-4 text-xs text-black space-y-3 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-200 pb-3">
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Fornecedor</span>
                <span className="font-black uppercase">{expense.supplier || 'Não informado'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Documento / NF</span>
                <span className="font-mono font-bold uppercase">{expense.invoiceNumber || 'S/N'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Vencimento</span>
                <span className="font-mono font-bold">{expense.dueDate ? formatDateBR(expense.dueDate) : '-'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Valor</span>
                <span className="font-mono font-black text-sm text-emerald-800">{formatCurrencyBRL(expense.amount)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Categoria</span>
                <span className="font-bold uppercase">{expense.categoryName || '-'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Pagamento</span>
                <span className="font-bold uppercase">{paymentLabel}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-500">Status</span>
                <span className="font-black uppercase">{statusLabel}</span>
              </div>
              {(expense.machineryName || expense.costCenterName) && (
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Frota / Centro de Custo</span>
                  <span className="font-bold uppercase">{expense.machineryName || expense.costCenterName}</span>
                </div>
              )}
            </div>
            {expense.notes && (
              <div className="text-[11px] uppercase text-slate-700 whitespace-pre-line">
                <strong className="text-black">Observações:</strong> {expense.notes}
              </div>
            )}
          </div>

          {hasAttachment && (
            <div className="w-full flex flex-col items-center justify-center bg-[#e0e6f1] border border-black rounded-xl p-4 sm:p-5">
              {isImage ? (
                <img
                  src={expense.receiptUrl}
                  alt="Comprovante"
                  className="max-h-[60vh] max-w-full rounded-xl shadow-sm border border-black bg-white object-contain"
                />
              ) : (
                <div className="text-center p-6 bg-white rounded-xl border border-black shadow-xs max-w-md">
                  <FileText className="w-12 h-12 text-emerald-700 mx-auto mb-2" />
                  <p className="font-bold text-black text-sm mb-1">
                    {expense.receiptName || 'Documento / NF-e'}
                  </p>
                  <p className="text-xs text-slate-700 mb-4">
                    Arquivo anexado ao lançamento de {formatDateBR(expense.dueDate)}
                  </p>
                  <a
                    href={expense.receiptUrl}
                    download={expense.receiptName || 'comprovante.pdf'}
                    className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Documento</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] border-t border-black flex flex-wrap items-center justify-between gap-2 text-xs text-black shrink-0">
          <div>
            <span>Fornecedor: <strong className="text-black">{expense.supplier || 'Não informado'}</strong></span>
            {expense.invoiceNumber && <span className="ml-3">NF: <strong className="text-black">{expense.invoiceNumber}</strong></span>}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrintExpenseReceipt}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white border border-black font-bold text-xs shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Documento</span>
            </button>
            {isImage && expense.receiptUrl && (
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
