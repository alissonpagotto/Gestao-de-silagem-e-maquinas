import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  CreditCard,
  Layers,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Building2,
  FileCheck2,
  Send,
  HelpCircle,
  Percent,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { ServiceOrder, PaymentMethod } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

export const getPaymentMethodLabel = (method?: PaymentMethod | string): string => {
  switch (method) {
    case 'dinheiro':
      return 'Dinheiro';
    case 'pix':
      return 'PIX';
    case 'cartao_credito':
      return 'Cartão Crédito';
    case 'cartao_debito':
      return 'Cartão Débito';
    case 'transferencia':
      return 'TED / DOC';
    case 'cheque':
      return 'Cheque';
    case 'prazo_carteira':
      return 'A prazo (carteira)';
    case 'safra_prazo':
      return 'Safra a Prazo';
    case 'boleto':
      return 'Boleto';
    default:
      return method ? String(method).toUpperCase() : 'Não informado';
  }
};

export const isInstallmentEligible = (method: PaymentMethod | string): boolean => {
  return (
    method === 'cartao_credito' ||
    method === 'cheque' ||
    method === 'prazo_carteira' ||
    method === 'safra_prazo' ||
    method === 'boleto'
  );
};

export interface BillingPaymentLine {
  id: string;
  paymentMethod: PaymentMethod;
  amount: number; // Valor original de face alocado (ex: R$ 25.000,00)
  firstDueDate: string;
  installmentsCount: number; // 1 = à vista, 2..24
  installmentsIntervalDays: number; // default 30
  interestAmount?: number; // Juros / Acréscimos em R$
  interestPercentage?: number; // Juros / Acréscimos em %
  notes?: string;
}

interface BillingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceOrder | null;
  onConfirm: (splitOrders: ServiceOrder[]) => void;
}

// Auxiliar para somar dias a uma data no formato YYYY-MM-DD
const addDays = (dateStr: string, days: number): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dt = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
};

/**
 * Converte valor numérico em string monetária formatada no padrão PT-BR sem símbolo R$:
 * Ex: 10000 -> "10.000,00", 0 -> "0,00"
 */
export const formatCurrencyInputBRL = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '0,00';
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Converte a digitação da direita para a esquerda (máscara de centavos) em Float decimal puro:
 * Usuário digita "1" -> 0.01
 * Usuário digita "10" -> 0.10
 * Usuário digita "100" -> 1.00
 * Usuário digita "100000" -> 1000.00
 * Usuário digita "2500000" -> 25000.00
 */
export const parseCurrencyInputToFloat = (raw: string): number => {
  if (!raw) return 0;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const cents = parseInt(digits, 10);
  if (isNaN(cents)) return 0;
  return Number((cents / 100).toFixed(2));
};

export const BillingPaymentModal: React.FC<BillingPaymentModalProps> = ({
  isOpen,
  onClose,
  service,
  onConfirm,
}) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [lines, setLines] = useState<BillingPaymentLine[]>([]);
  const [billingNotesExtra, setBillingNotesExtra] = useState('');

  // Ao abrir o modal ou mudar o serviço selecionado, inicializa com 1 linha com o valor total
  useEffect(() => {
    if (!service || !isOpen) return;

    const baseAmount = Number(service.totalAmount) || 0;
    const baseDueDate = service.dueDate || service.startDate || today;

    setLines([
      {
        id: `line_${Date.now()}_1`,
        paymentMethod: (service.paymentMethod as PaymentMethod) || 'pix',
        amount: baseAmount,
        firstDueDate: baseDueDate,
        installmentsCount: 1,
        installmentsIntervalDays: 30,
        interestAmount: undefined,
        interestPercentage: undefined,
        notes: '',
      },
    ]);
    setBillingNotesExtra(service.billingNotes || '');
  }, [service, isOpen, today]);

  if (!isOpen || !service) return null;

  const totalService = Number(service.totalAmount) || 0;

  // Total de face alocado nas linhas (sem juros para validação do pedido)
  const totalAllocated = lines.reduce((acc, line) => acc + (Number(line.amount) || 0), 0);
  const remainingBalance = Math.round((totalService - totalAllocated) * 100) / 100;
  const isBalanced = Math.abs(remainingBalance) < 0.01;
  const isOverAllocated = remainingBalance < -0.009;
  const isUnderAllocated = remainingBalance > 0.009;

  // Total global de juros somados em todas as linhas
  const totalInterestAdded = lines.reduce(
    (acc, line) => acc + (Number(line.interestAmount) || 0),
    0
  );
  const totalFinalExpected = totalAllocated + totalInterestAdded;

  // Adicionar uma nova linha de pagamento
  const handleAddLine = () => {
    const nextAmount = remainingBalance > 0 ? remainingBalance : 0;
    const newLine: BillingPaymentLine = {
      id: `line_${Date.now()}_${lines.length + 1}`,
      paymentMethod:
        lines.length === 1 && lines[0].paymentMethod === 'pix' ? 'cartao_credito' : 'prazo_carteira',
      amount: nextAmount,
      firstDueDate: lines[0]?.firstDueDate || today,
      installmentsCount: 1,
      installmentsIntervalDays: 30,
      interestAmount: undefined,
      interestPercentage: undefined,
      notes: '',
    };
    setLines([...lines, newLine]);
  };

  // Remover linha
  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((l) => l.id !== id));
  };

  // Atualizar campo de uma linha
  const handleUpdateLine = <K extends keyof BillingPaymentLine>(
    id: string,
    field: K,
    value: BillingPaymentLine[K]
  ) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };

        // Se o valor de face foi alterado e havia porcentagem de juros, recalcula o valor em R$
        if (field === 'amount') {
          const newAmount = Number(value) || 0;
          if (l.interestPercentage && l.interestPercentage > 0) {
            updated.interestAmount = Number(
              ((newAmount * l.interestPercentage) / 100).toFixed(2)
            );
          } else if (l.interestAmount && newAmount > 0) {
            updated.interestPercentage = Number(
              ((l.interestAmount / newAmount) * 100).toFixed(2)
            );
          }
        }

        // Se mudou forma de pagamento para não-elegível a parcelamento, reseta parcelas e juros
        if (field === 'paymentMethod' && !isInstallmentEligible(value as string)) {
          updated.installmentsCount = 1;
          updated.interestAmount = undefined;
          updated.interestPercentage = undefined;
        }
        return updated;
      })
    );
  };

  // Alteração com máscara de moeda brasileira do Valor de Face da linha (R$)
  const handleAmountMaskChange = (id: string, rawVal: string) => {
    const floatVal = parseCurrencyInputToFloat(rawVal);
    handleUpdateLine(id, 'amount', floatVal);
  };

  // Alteração reativa de Juros em R$ com máscara de moeda brasileira -> calcula %
  const handleInterestAmountMaskChange = (id: string, rawVal: string) => {
    const floatVal = parseCurrencyInputToFloat(rawVal);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const baseAmount = Number(l.amount) || 0;
        const percentVal =
          baseAmount > 0 && floatVal > 0
            ? Number(((floatVal / baseAmount) * 100).toFixed(2))
            : undefined;

        return {
          ...l,
          interestAmount: floatVal > 0 ? floatVal : undefined,
          interestPercentage: percentVal,
        };
      })
    );
  };

  // Alteração reativa de Juros em % -> calcula R$
  const handleInterestPercentChange = (id: string, valStr: string) => {
    const percentVal = valStr === '' ? 0 : Number(valStr);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const baseAmount = Number(l.amount) || 0;
        const interestVal =
          baseAmount > 0 && percentVal > 0
            ? Number(((baseAmount * percentVal) / 100).toFixed(2))
            : undefined;

        return {
          ...l,
          interestPercentage: percentVal > 0 ? percentVal : undefined,
          interestAmount: interestVal,
        };
      })
    );
  };

  // Gerar cronograma de parcelas para visualização considerando o valor corrigido com juros
  const getInstallmentsBreakdown = (line: BillingPaymentLine) => {
    const count = Math.max(1, line.installmentsCount || 1);
    const baseAmount = Number(line.amount) || 0;
    const interest = Number(line.interestAmount) || 0;
    const totalLineWithInterest = baseAmount + interest;

    const baseVal = Math.floor((totalLineWithInterest / count) * 100) / 100;
    const remainder = Math.round((totalLineWithInterest - baseVal * count) * 100) / 100;

    const schedule = [];
    for (let i = 1; i <= count; i++) {
      const val = i === 1 ? Number((baseVal + remainder).toFixed(2)) : baseVal;
      const due = addDays(
        line.firstDueDate || today,
        (i - 1) * (line.installmentsIntervalDays || 30)
      );
      schedule.push({
        number: i,
        total: count,
        amount: val,
        dueDate: due,
      });
    }
    return schedule;
  };

  // Confirmação e Desmembramento de Ordens com Juros Persistidos
  const handleConfirm = () => {
    if (!isBalanced) return;

    const nowIso = new Date().toISOString();
    const isSingleLineNoInstallment = lines.length === 1 && lines[0].installmentsCount <= 1;

    // Caso 1: Pagamento Único à Vista (com ou sem acréscimo)
    if (isSingleLineNoInstallment) {
      const line = lines[0];
      const lineInterest = Number(line.interestAmount) || 0;
      const totalFinalAmount = Number(line.amount) + lineInterest;

      const interestSnippet =
        lineInterest > 0
          ? ` (COM JUROS DE ${formatCurrencyBRL(lineInterest)}${
              line.interestPercentage ? ` / ${line.interestPercentage}%` : ''
            })`
          : '';

      const updatedOriginal: ServiceOrder = {
        ...service,
        totalAmount: totalFinalAmount,
        status: 'faturado',
        billingStatus: 'faturado',
        billedAt: nowIso,
        billedBy: 'Escritório',
        paymentStatus: 'pendente',
        paymentMethod: line.paymentMethod,
        dueDate: line.firstDueDate || service.dueDate || today,
        billingNotes: [
          billingNotesExtra.trim(),
          `[FATURAMENTO: ${getPaymentMethodLabel(line.paymentMethod)} - ${formatCurrencyBRL(
            totalFinalAmount
          )}${interestSnippet}]`,
        ]
          .filter(Boolean)
          .join(' ')
          .toUpperCase(),
        updatedAt: nowIso,
      };
      onConfirm([updatedOriginal]);
      return;
    }

    // Caso 2: Pagamento Misto ou Parcelado (Desmembramento em títulos a receber corrigidos)
    const generatedOrders: ServiceOrder[] = [];
    let globalIndex = 0;

    lines.forEach((line, lineIdx) => {
      const lineBaseAmount = Number(line.amount) || 0;
      if (lineBaseAmount <= 0) return;

      const lineInterest = Number(line.interestAmount) || 0;
      const count = Math.max(1, line.installmentsCount || 1);
      const breakdown = getInstallmentsBreakdown(line);

      const interestSnippet =
        lineInterest > 0
          ? ` (COM JUROS DE ${formatCurrencyBRL(lineInterest)}${
              line.interestPercentage ? ` / ${line.interestPercentage}%` : ''
            })`
          : '';

      breakdown.forEach((item) => {
        globalIndex++;
        const isFirstGlobal = globalIndex === 1;

        const methodLabel = getPaymentMethodLabel(line.paymentMethod);
        const instLabel = count > 1 ? ` (PARCELA ${item.number}/${item.total})` : '';
        const orderNumberSuffix =
          count > 1
            ? `${service.orderNumber || ''}-P${item.number}/${item.total}`
            : lines.length > 1
            ? `${service.orderNumber || ''}-${lineIdx + 1}`
            : service.orderNumber;

        const noteSnippet = `[FATURAMENTO: ${methodLabel}${instLabel} - ${formatCurrencyBRL(
          item.amount
        )}${interestSnippet}]`;

        const childOrder: ServiceOrder = {
          ...service,
          id: isFirstGlobal
            ? service.id
            : `serv_bill_${service.id}_${lineIdx + 1}_${item.number}_${Date.now()}_${globalIndex}`,
          orderNumber: orderNumberSuffix || undefined,
          totalAmount: item.amount, // Valor com a cota exata de juros embutida
          startDate: item.dueDate,
          date: item.dueDate,
          dueDate: item.dueDate,
          paymentMethod: line.paymentMethod,
          paymentStatus: 'pendente',
          status: 'faturado',
          billingStatus: 'faturado',
          billedAt: nowIso,
          billedBy: 'Escritório',
          isInstallment: count > 1,
          installmentNumber: count > 1 ? item.number : undefined,
          totalInstallments: count > 1 ? count : undefined,
          parentOrderId: service.id,
          billingNotes: [billingNotesExtra.trim(), noteSnippet].filter(Boolean).join(' ').toUpperCase(),
          updatedAt: nowIso,
        };

        generatedOrders.push(childOrder);
      });
    });

    onConfirm(generatedOrders);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-xl shadow-2xl border border-slate-300 dark:border-stone-700 w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                  Definição de Recebimento e Condições Comerciais
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-200 dark:bg-stone-700 text-slate-800 dark:text-stone-200">
                  #{service.orderNumber || service.id.slice(-4)}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-stone-400 font-medium">
                Cliente: <span className="font-bold text-zinc-900 dark:text-white">{service.clientName}</span>
                {service.farmName ? ` • Fazenda: ${service.farmName}` : ''} • Serviço:{' '}
                <span className="font-bold text-zinc-800 dark:text-stone-200 uppercase">
                  {service.serviceType || 'Corte de Silagem'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200 hover:bg-slate-200 dark:hover:bg-stone-700 rounded-lg transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* PAINEL DE RESUMO E SALDO EM TEMPO REAL */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-stone-850 rounded-xl border border-slate-200 dark:border-stone-750">
            {/* Valor do Serviço */}
            <div className="bg-white dark:bg-stone-800 p-3 rounded-lg border border-slate-200 dark:border-stone-700">
              <span className="text-[10px] font-bold text-zinc-500 dark:text-stone-400 uppercase tracking-wider block">
                Valor Total Auditado
              </span>
              <span className="text-lg font-black text-zinc-900 dark:text-white">
                {formatCurrencyBRL(totalService)}
              </span>
            </div>

            {/* Total Distribuído */}
            <div className="bg-white dark:bg-stone-800 p-3 rounded-lg border border-slate-200 dark:border-stone-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 dark:text-stone-400 uppercase tracking-wider block">
                  Total Distribuído
                </span>
                {totalInterestAdded > 0 && (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                    +{formatCurrencyBRL(totalInterestAdded)} juros
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-blue-700 dark:text-blue-400">
                  {formatCurrencyBRL(totalAllocated)}
                </span>
                {totalInterestAdded > 0 && (
                  <span className="text-xs font-bold text-zinc-500 dark:text-stone-400">
                    ({formatCurrencyBRL(totalFinalExpected)} final)
                  </span>
                )}
              </div>
            </div>

            {/* Saldo Restante */}
            <div
              className={`p-3 rounded-lg border ${
                isBalanced
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                  : isOverAllocated
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider block ${
                  isBalanced
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : isOverAllocated
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                Saldo a Distribuir
              </span>
              <span
                className={`text-lg font-black ${
                  isBalanced
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : isOverAllocated
                    ? 'text-rose-800 dark:text-rose-200'
                    : 'text-amber-800 dark:text-amber-200'
                }`}
              >
                {formatCurrencyBRL(remainingBalance)}
              </span>
            </div>
          </div>

          {/* STATUS BANNER */}
          {isBalanced ? (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-lg text-emerald-900 dark:text-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Valor total 100% distribuído! Pronto para lançar e faturar no Contas a Receber.
                {totalInterestAdded > 0 && (
                  <span className="font-normal text-emerald-800 dark:text-emerald-300 ml-1">
                    (Total final a receber com acréscimos: {formatCurrencyBRL(totalFinalExpected)})
                  </span>
                )}
              </span>
            </div>
          ) : isUnderAllocated ? (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-900 dark:text-amber-200 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Faltam {formatCurrencyBRL(remainingBalance)} para cobrir o total do pedido. Adicione outra forma ou ajuste os valores.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-rose-100/70 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-lg text-rose-900 dark:text-rose-200 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                O valor distribuído excede o total em {formatCurrencyBRL(Math.abs(remainingBalance))}. Reduza o valor das formas de pagamento.
              </span>
            </div>
          )}

          {/* LISTA DE FORMAS DE RECEBIMENTO (PAGAMENTO MISTO) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">
                  Formas de Recebimento ({lines.length})
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-stone-400">
                  Configure múltiplas formas de pagamento e condições de parcelamento para este pedido.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 rounded-lg shadow-2xs transition cursor-pointer uppercase active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Adicionar Forma</span>
              </button>
            </div>

            {/* CARDS DAS LINHAS DE PAGAMENTO */}
            <div className="space-y-3">
              {lines.map((line, index) => {
                const isInstallment = isInstallmentEligible(line.paymentMethod);
                const breakdown = getInstallmentsBreakdown(line);
                const lineBaseAmount = Number(line.amount) || 0;
                const lineInterestAmount = Number(line.interestAmount) || 0;
                const lineTotalWithInterest = lineBaseAmount + lineInterestAmount;

                return (
                  <div
                    key={line.id}
                    className="p-4 bg-white dark:bg-stone-850 rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xs space-y-3.5"
                  >
                    {/* Linha Principal de Dados */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {/* Indicador de Linha */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-stone-700 text-zinc-800 dark:text-stone-200 text-xs font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                      </div>

                      {/* Forma de Pagamento */}
                      <div className="flex-1 min-w-[180px]">
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-1">
                          Forma de Pagamento
                        </label>
                        <select
                          value={line.paymentMethod}
                          onChange={(e) =>
                            handleUpdateLine(line.id, 'paymentMethod', e.target.value as PaymentMethod)
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-bold text-zinc-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase cursor-pointer"
                        >
                          <option value="pix">PIX</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="cartao_credito">Cartão de Crédito</option>
                          <option value="cartao_debito">Cartão de Débito</option>
                          <option value="transferencia">TED / DOC</option>
                          <option value="cheque">Cheque</option>
                          <option value="prazo_carteira">A Prazo (Carteira)</option>
                          <option value="safra_prazo">Safra a Prazo</option>
                          <option value="boleto">Boleto</option>
                        </select>
                      </div>

                      {/* Valor Alocado (R$) */}
                      <div className="w-full sm:w-44">
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-1">
                          Valor (R$)
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs font-bold text-zinc-400 pointer-events-none">
                            R$
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatCurrencyInputBRL(line.amount)}
                            onChange={(e) => handleAmountMaskChange(line.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0,00"
                            className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-black text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* 1º Vencimento / Data Base */}
                      <div className="w-full sm:w-40">
                        <label className="block text-[10px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-1">
                          {line.installmentsCount > 1 ? '1º Vencimento' : 'Data Vencimento'}
                        </label>
                        <input
                          type="date"
                          value={line.firstDueDate}
                          onChange={(e) => handleUpdateLine(line.id, 'firstDueDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-bold text-zinc-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Botão de Excluir Linha */}
                      <div className="flex items-end self-end sm:self-center pt-2 sm:pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          disabled={lines.length <= 1}
                          className={`p-1.5 rounded-lg border transition ${
                            lines.length <= 1
                              ? 'text-zinc-300 dark:text-stone-600 border-slate-200 dark:border-stone-800 cursor-not-allowed'
                              : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900 cursor-pointer'
                          }`}
                          title={lines.length <= 1 ? 'Mínimo de 1 forma obrigatória' : 'Remover forma'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* BLOCO DE JUROS / ACRÉSCIMOS E PARCELAMENTO (QUANDO MODALIDADE A PRAZO/PARCELÁVEL) */}
                    {isInstallment && (
                      <div className="mt-2 pt-3 border-t border-dashed border-slate-200 dark:border-stone-750 bg-slate-50/70 dark:bg-stone-800/50 p-3.5 rounded-lg space-y-3">
                        {/* 1. SEÇÃO DE JUROS / ACRÉSCIMOS (REATIVIDADE BIDIRECIONAL R$ <-> %) */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/60 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-amber-200/80 dark:bg-amber-900/60 flex items-center justify-center shrink-0">
                              <Percent className="w-3.5 h-3.5 text-amber-800 dark:text-amber-300 stroke-[2.5]" />
                            </div>
                            <div>
                              <span className="text-[11px] font-black text-amber-950 dark:text-amber-200 uppercase tracking-tight block">
                                Juros / Acréscimos desta Linha (Opcional)
                              </span>
                              <span className="text-[10px] text-amber-800/80 dark:text-amber-400/90 font-medium">
                                Incorpora no valor parcelado sem afetar a distribuição do saldo base do serviço
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Juros em R$ */}
                            <div className="w-32">
                              <label className="block text-[9px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-0.5">
                                Juros (R$)
                              </label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[10px] font-bold text-zinc-400 pointer-events-none">
                                  R$
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={formatCurrencyInputBRL(line.interestAmount || 0)}
                                  onChange={(e) => handleInterestAmountMaskChange(line.id, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  placeholder="0,00"
                                  className="w-full pl-7 pr-2 py-1 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-md text-xs font-black text-amber-950 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>
                            </div>

                            {/* Juros em % */}
                            <div className="w-28">
                              <label className="block text-[9px] font-bold text-zinc-600 dark:text-stone-400 uppercase mb-0.5">
                                Juros (%)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.interestPercentage === undefined ? '' : line.interestPercentage}
                                  onChange={(e) => handleInterestPercentChange(line.id, e.target.value)}
                                  placeholder="0,00"
                                  className="w-full pl-2.5 pr-6 py-1 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-md text-xs font-black text-amber-950 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <span className="absolute inset-y-0 right-0 pr-2 flex items-center text-[10px] font-bold text-zinc-400 pointer-events-none">
                                  %
                                </span>
                              </div>
                            </div>

                            {/* Resumo visual do Total Corrigido se houver juros */}
                            {lineInterestAmount > 0 && (
                              <div className="shrink-0 text-right pl-2 hidden sm:block border-l border-amber-200 dark:border-amber-800/60">
                                <span className="text-[9px] font-bold text-amber-900 dark:text-amber-300 uppercase block">
                                  Novo Total da Linha:
                                </span>
                                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">
                                  {formatCurrencyBRL(lineTotalWithInterest)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. CONDIÇÃO DE PARCELAMENTO */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-[11px] font-bold text-zinc-800 dark:text-stone-200 uppercase">
                              Condição de Parcelamento:
                            </span>
                          </div>

                          {/* Seletor de Parcelas */}
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-zinc-500 dark:text-stone-400 uppercase">
                              Nº Parcelas:
                            </label>
                            <select
                              value={line.installmentsCount}
                              onChange={(e) =>
                                handleUpdateLine(line.id, 'installmentsCount', Number(e.target.value))
                              }
                              className="px-2.5 py-1 bg-white dark:bg-stone-700 border border-slate-300 dark:border-stone-600 rounded-md text-xs font-bold text-zinc-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer uppercase"
                            >
                              <option value={1}>1x (À Vista)</option>
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                                <option key={n} value={n}>
                                  {n}x ({formatCurrencyBRL(lineTotalWithInterest / n)}/mês)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Intervalo de Dias */}
                          {line.installmentsCount > 1 && (
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-zinc-500 dark:text-stone-400 uppercase">
                                Intervalo:
                              </label>
                              <select
                                value={line.installmentsIntervalDays}
                                onChange={(e) =>
                                  handleUpdateLine(
                                    line.id,
                                    'installmentsIntervalDays',
                                    Number(e.target.value)
                                  )
                                }
                                className="px-2.5 py-1 bg-white dark:bg-stone-700 border border-slate-300 dark:border-stone-600 rounded-md text-xs font-bold text-zinc-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer uppercase"
                              >
                                <option value={15}>15 em 15 dias</option>
                                <option value={30}>30 dias (Mensal)</option>
                                <option value={45}>45 dias</option>
                                <option value={60}>60 dias (Bimestral)</option>
                                <option value={90}>90 dias (Trimestral)</option>
                                <option value={180}>180 dias (Semestral)</option>
                                <option value={365}>365 dias (Safra / Anual)</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* 3. DEMONSTRATIVO DINÂMICO DE PARCELAS COM JUROS RECALCULADOS */}
                        {line.installmentsCount > 1 && (
                          <div className="mt-2 overflow-x-auto">
                            <div className="inline-flex flex-wrap gap-2 py-1">
                              {breakdown.map((item) => (
                                <div
                                  key={item.number}
                                  className="flex items-center gap-2 px-2.5 py-1 bg-white dark:bg-stone-700 border border-slate-200 dark:border-stone-600 rounded-md text-[11px] font-semibold shadow-2xs"
                                >
                                  <span className="font-bold text-blue-700 dark:text-blue-300">
                                    {item.number}/{item.total}:
                                  </span>
                                  <span className="font-black text-zinc-900 dark:text-white">
                                    {formatCurrencyBRL(item.amount)}
                                  </span>
                                  <span className="text-zinc-500 dark:text-stone-400 text-[10px]">
                                    ({formatDateBR(item.dueDate)})
                                  </span>
                                  {lineInterestAmount > 0 && (
                                    <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 rounded">
                                      +juros
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* OBSERVAÇÕES / ANOTAÇÕES DO FATURAMENTO */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 dark:text-stone-300 uppercase mb-1">
              Anotações Gerais do Faturamento (Opcional)
            </label>
            <textarea
              rows={2}
              value={billingNotesExtra}
              onChange={(e) => setBillingNotesExtra(e.target.value.toUpperCase())}
              placeholder="OBSERVAÇÕES INTERNAS, ACORDOS DE PAGAMENTO OU REFERÊNCIAS..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-600 rounded-lg text-xs font-medium text-zinc-900 dark:text-white uppercase placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* RODAPÉ COM AÇÕES */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-100 dark:bg-stone-800 border-t border-slate-300 dark:border-stone-700">
          <div className="text-xs text-zinc-500 dark:text-stone-400 font-semibold">
            {isBalanced ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                ✓ Saldo validado com sucesso.
                {totalInterestAdded > 0 && ` (+ ${formatCurrencyBRL(totalInterestAdded)} em juros aplicados)`}
              </span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400 font-bold">
                Ajuste os valores para habilitar a confirmação.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-stone-300 hover:bg-slate-200 dark:hover:bg-stone-700 rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isBalanced}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-black rounded-lg shadow-sm transition uppercase active:scale-95 ${
                isBalanced
                  ? 'text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 cursor-pointer'
                  : 'text-slate-400 bg-slate-200 dark:bg-stone-700 dark:text-stone-500 cursor-not-allowed'
              }`}
              title={
                isBalanced
                  ? 'Confirmar faturamento e enviar ao Contas a Receber'
                  : 'Distribua o valor total para habilitar'
              }
            >
              <Send className="w-4 h-4 stroke-[2.2]" />
              <span>Confirmar Faturamento & Enviar ao Contas a Receber</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
