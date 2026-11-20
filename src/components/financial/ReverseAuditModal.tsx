import React, { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, ShieldCheck, UserCheck, Clock, X } from 'lucide-react';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { formatCurrentAuditDateTimeBR, getLoggedAuditUserName } from '../../lib/financialAudit';

interface ReverseAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    reason: string;
    user: string;
    dateTime: string;
    isoTimestamp: string;
  }) => void;
  kind: 'pagar' | 'receber';
  titleDescription: string;
  partyName?: string;
  amount: number;
  dueDate?: string;
  paymentDate?: string;
  bankOrCashLabel?: string;
}

export const ReverseAuditModal: React.FC<ReverseAuditModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  kind,
  titleDescription,
  partyName,
  amount,
  dueDate,
  paymentDate,
  bankOrCashLabel,
}) => {
  const [reason, setReason] = useState('');
  const [auditUser, setAuditUser] = useState(() => getLoggedAuditUserName());
  const [auditDateTime, setAuditDateTime] = useState(() => formatCurrentAuditDateTimeBR());

  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setAuditUser(getLoggedAuditUserName());
    setAuditDateTime(formatCurrentAuditDateTimeBR());
    const timer = window.setInterval(() => {
      setAuditDateTime(formatCurrentAuditDateTimeBR());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= 5;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReasonValid) return;
    const now = new Date();
    onConfirm({
      reason: trimmedReason,
      user: auditUser,
      dateTime: formatCurrentAuditDateTimeBR(now),
      isoTimestamp: now.toISOString(),
    });
  };

  return (
    <div
      id="modal-confirmar-estorno-auditado"
      className="fixed inset-0 z-80 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden text-black dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center border border-black/40 shadow-2xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide">
                Estornar Baixa Financeira ({kind === 'pagar' ? 'A Pagar' : 'A Receber'})
              </h3>
              <p className="text-[10px] font-bold text-black/75 dark:text-stone-400 uppercase">
                Auditoria Obrigatória de Reabertura de Título
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-stone-800 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-3.5 sm:p-4 space-y-3 bg-[#cad4e6] dark:bg-stone-950">
          {/* Aviso de Segurança */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-700 dark:border-amber-700 text-amber-950 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs font-bold leading-relaxed">
              Tem certeza que deseja estornar esta baixa? O valor será estornado na conta bancária/caixa e o título voltará a ficar em aberto.
            </p>
          </div>

          {/* Resumo do Título */}
          <div className="p-3 rounded-xl bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase text-black/70 dark:text-stone-400 block">
                  {kind === 'pagar' ? 'Fornecedor / Título' : 'Cliente / Título'}
                </span>
                <div className="font-black text-black dark:text-white uppercase truncate">
                  {partyName || titleDescription}
                </div>
                {partyName && titleDescription && partyName !== titleDescription && (
                  <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 truncate uppercase">
                    {titleDescription}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-black uppercase text-black/70 dark:text-stone-400 block">
                  Valor a Estornar
                </span>
                <span className="text-sm font-black font-mono text-rose-700 dark:text-rose-400">
                  {formatCurrencyBRL(amount)}
                </span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-black/15 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-black/80 dark:text-stone-300">
              <span>
                Vencimento: <strong>{dueDate ? formatDateBR(dueDate) : '—'}</strong>
              </span>
              {paymentDate && (
                <span>
                  Baixa em: <strong>{formatDateBR(paymentDate)}</strong>
                </span>
              )}
              {bankOrCashLabel && (
                <span className="truncate max-w-[220px]">
                  Origem/Destino: <strong>{bankOrCashLabel}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Exibição Automática do Responsável & Data/Hora */}
          <div className="p-3 rounded-xl bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#0963cb] shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase text-black/70 dark:text-stone-400 block">
                  Usuário Responsável
                </span>
                <span className="font-black text-black dark:text-white uppercase truncate block">
                  {auditUser}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0963cb] shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase text-black/70 dark:text-stone-400 block">
                  Data e Hora do Estorno
                </span>
                <span className="font-mono font-black text-black dark:text-white block">
                  {auditDateTime}
                </span>
              </div>
            </div>
          </div>

          {/* Campo Obrigatório: Motivo do Estorno */}
          <div className="p-3 rounded-xl bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="textarea-motivo-estorno"
                className="text-[11px] font-black uppercase tracking-wider text-black dark:text-stone-200 flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                <span>Motivo do Estorno <span className="text-rose-600">*</span></span>
              </label>
              <span
                className={`text-[10px] font-bold uppercase ${
                  isReasonValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {trimmedReason.length}/5 mín. caracteres
              </span>
            </div>
            <textarea
              id="textarea-motivo-estorno"
              rows={3}
              required
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo do estorno (ex: Baixa lançada na conta bancária errada, pagamento não compensado, erro de digitação)..."
              className="w-full px-2.5 py-2 text-xs font-semibold rounded-lg border border-slate-500 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-600 resize-none"
            />
          </div>

          {/* Ações */}
          <div className="pt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              id="btn-cancelar-estorno-auditado"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold uppercase rounded-lg border border-black/40 bg-white hover:bg-slate-100 text-black transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              id="btn-confirmar-estorno-auditado"
              disabled={!isReasonValid}
              className={`px-4 py-1.5 text-xs font-black uppercase rounded-lg border border-black/40 flex items-center gap-1.5 transition ${
                isReasonValid
                  ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs active:scale-95'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'
              }`}
              title={
                isReasonValid
                  ? 'Confirmar estorno auditado'
                  : 'Informe pelo menos 5 caracteres no motivo do estorno'
              }
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Confirmar Estorno</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
