import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  Clock, 
  CreditCard, 
  FileText, 
  Paperclip, 
  Plus, 
  Trash2, 
  Divide, 
  FileCheck,
  Receipt
} from 'lucide-react';
import { formatCurrencyBRL } from '../../lib/storage';

export interface NfeDetailedInstallment {
  id: string;
  number: string; // Ex: "01", "02", "03"
  amount: number;
  daysInterval: number; // Ex: 30, 60, 90
  dueDate: string; // YYYY-MM-DD
  paymentMethodCode: string; // Ex: "01" (Boleto), "02" (PIX)
  paymentMethodLabel: string;
  creditAccount: string; // Código contábil Crédito
  debitAccount: string; // Código contábil Débito
  observations: string; // Ex: "001", "002"
  documentFileUrl?: string; // Data URL ou arquivo
  documentFileName?: string;
}

interface NfeInstallmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  supplierName: string;
  issueDate: string;
  totalAmount: number;
  initialInstallmentsCount?: number;
  existingInstallments?: Array<{ number: string; dueDate: string; amount: number }>;
  initialDetailedInstallments?: NfeDetailedInstallment[];
  defaultPaymentMethod?: string;
  suggestedCategory?: string;
  customTitle?: string;
  customSubtitle?: string;
  totalLabel?: string;
  onConfirmAndSave: (installments: NfeDetailedInstallment[]) => void;
}

// Opções de Meio de Pagamento com código contábil/fiscal
const PAYMENT_METHODS_OPTIONS = [
  { code: '01', label: '01 - Boleto Bancário', methodKey: 'boleto' },
  { code: '02', label: '02 - PIX', methodKey: 'pix' },
  { code: '03', label: '03 - Transferência Bancária (TED/DOC)', methodKey: 'transferencia' },
  { code: '04', label: '04 - Cartão de Crédito', methodKey: 'cartao_credito' },
  { code: '05', label: '05 - Cartão de Débito', methodKey: 'cartao_debito' },
  { code: '06', label: '06 - Dinheiro / Espécie', methodKey: 'dinheiro' },
  { code: '07', label: '07 - Cheque', methodKey: 'safra_prazo' },
  { code: '08', label: '08 - A Prazo / Safra Agrícola', methodKey: 'safra_prazo' },
  { code: '99', label: '99 - Outros', methodKey: 'boleto' },
];

function addDaysToDate(baseDate: string, days: number): string {
  try {
    const parts = baseDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      date.setDate(date.getDate() + days);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch (e) {
    console.error('Erro ao calcular data:', e);
  }
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function calculateDaysBetween(startDateStr: string, endDateStr: string): number {
  try {
    const p1 = startDateStr.split('-');
    const p2 = endDateStr.split('-');
    if (p1.length === 3 && p2.length === 3) {
      const d1 = new Date(parseInt(p1[0], 10), parseInt(p1[1], 10) - 1, parseInt(p1[2], 10));
      const d2 = new Date(parseInt(p2[0], 10), parseInt(p2[1], 10) - 1, parseInt(p2[2], 10));
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 ? diffDays : 0;
    }
  } catch (e) {
    // fallback
  }
  return 0;
}

export const NfeInstallmentsModal: React.FC<NfeInstallmentsModalProps> = ({
  isOpen,
  onClose,
  invoiceNumber,
  supplierName,
  issueDate,
  totalAmount,
  initialInstallmentsCount = 1,
  existingInstallments,
  initialDetailedInstallments,
  defaultPaymentMethod = 'boleto',
  suggestedCategory,
  customTitle,
  customSubtitle,
  totalLabel,
  onConfirmAndSave,
}) => {
  const [installments, setInstallments] = useState<NfeDetailedInstallment[]>([]);
  const [installmentsCountInput, setInstallmentsCountInput] = useState<number>(initialInstallmentsCount || 1);
  const [activeFileRowId, setActiveFileRowId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Determina conta padrão débito baseado na categoria
  const defaultDebitAccount = suggestedCategory === 'cat_combustivel' ? '3.1.2.01 - Combustíveis' :
                             suggestedCategory === 'cat_lona' ? '3.1.2.04 - Lonas & Embalagens' :
                             suggestedCategory === 'cat_inoculante' ? '3.1.2.08 - Inoculantes' :
                             suggestedCategory === 'cat_manutencao' ? '3.1.3.02 - Peças & Manutenção' :
                             '3.1.1.01 - Insumos Operacionais';

  // Determina meio de pagamento inicial
  const defaultPayOption = PAYMENT_METHODS_OPTIONS.find(o => o.methodKey === defaultPaymentMethod) || PAYMENT_METHODS_OPTIONS[0];

  // Inicializa parcelas ao abrir ou quando total/XML mudar
  useEffect(() => {
    if (!isOpen) return;

    setValidationError('');

    // 0. Se já existirem parcelas detalhadas previamente configuradas
    if (initialDetailedInstallments && initialDetailedInstallments.length > 0) {
      setInstallments(initialDetailedInstallments);
      setInstallmentsCountInput(initialDetailedInstallments.length);
      return;
    }

    // 1. Se já existirem parcelas extraídas do XML da NF-e (<dup>)
    if (existingInstallments && existingInstallments.length > 0) {
      const generated: NfeDetailedInstallment[] = existingInstallments.map((dup, idx) => {
        const numStr = String(idx + 1).padStart(2, '0');
        const dVenc = dup.dueDate || addDaysToDate(issueDate, (idx + 1) * 30);
        const prazo = calculateDaysBetween(issueDate, dVenc) || (idx + 1) * 30;

        return {
          id: `inst_${Date.now()}_${idx}`,
          number: numStr,
          amount: Math.round(dup.amount * 100) / 100,
          daysInterval: prazo,
          dueDate: dVenc,
          paymentMethodCode: defaultPayOption.code,
          paymentMethodLabel: defaultPayOption.label,
          creditAccount: '2.1.1.01 - Fornecedores Nacionais',
          debitAccount: defaultDebitAccount,
          observations: String(idx + 1).padStart(3, '0'),
        };
      });

      setInstallments(generated);
      setInstallmentsCountInput(generated.length);
    } else {
      // 2. Criação automática de parcelas baseada na contagem solicitada
      const count = Math.max(1, initialInstallmentsCount || 1);
      const generated = generateEqualInstallments(count, totalAmount, issueDate);
      setInstallments(generated);
      setInstallmentsCountInput(count);
    }
  }, [isOpen, totalAmount, issueDate, initialInstallmentsCount, existingInstallments, initialDetailedInstallments]);

  // Função para gerar parcelas divididas igualmente
  const generateEqualInstallments = (count: number, total: number, baseDate: string): NfeDetailedInstallment[] => {
    const validCount = Math.max(1, count);
    const baseValue = Math.floor((total / validCount) * 100) / 100;
    const diff = Math.round((total - baseValue * validCount) * 100) / 100;

    const list: NfeDetailedInstallment[] = [];
    for (let i = 0; i < validCount; i++) {
      const numStr = String(i + 1).padStart(2, '0');
      const prazo = (i + 1) * 30;
      const dVenc = addDaysToDate(baseDate, prazo);
      // Ajusta a diferença de centavos na última parcela
      const valorParcela = i === validCount - 1 ? Math.round((baseValue + diff) * 100) / 100 : baseValue;

      list.push({
        id: `inst_${Date.now()}_${i}`,
        number: numStr,
        amount: valorParcela,
        daysInterval: prazo,
        dueDate: dVenc,
        paymentMethodCode: defaultPayOption.code,
        paymentMethodLabel: defaultPayOption.label,
        creditAccount: '2.1.1.01 - Fornecedores Nacionais',
        debitAccount: defaultDebitAccount,
        observations: String(i + 1).padStart(3, '0'),
      });
    }
    return list;
  };

  // Cálculo da soma atual das parcelas e conferência com o valor total
  const currentSum = installments.reduce((acc, inst) => acc + (Number(inst.amount) || 0), 0);
  const roundedSum = Math.round(currentSum * 100) / 100;
  const roundedTotal = Math.round(totalAmount * 100) / 100;
  const difference = Math.round((roundedTotal - roundedSum) * 100) / 100;
  const isSumValid = Math.abs(difference) < 0.01;

  // Atualização de campos de uma parcela específica
  const handleUpdateInstallment = (id: string, field: keyof NfeDetailedInstallment, value: any) => {
    setValidationError('');
    setInstallments(prev => prev.map(inst => {
      if (inst.id !== id) return inst;

      const updated = { ...inst, [field]: value };

      // Se alterou o Prazo, recalcula a Data de Vencimento
      if (field === 'daysInterval') {
        const days = parseInt(value, 10) || 0;
        updated.dueDate = addDaysToDate(issueDate, days);
      }

      // Se alterou a Data de Vencimento, recalcula o Prazo em dias
      if (field === 'dueDate') {
        updated.daysInterval = calculateDaysBetween(issueDate, String(value));
      }

      // Se alterou o código de pagamento, atualiza o rótulo
      if (field === 'paymentMethodCode') {
        const opt = PAYMENT_METHODS_OPTIONS.find(o => o.code === value);
        if (opt) updated.paymentMethodLabel = opt.label;
      }

      return updated;
    }));
  };

  // Adicionar uma nova linha de parcela
  const handleAddInstallment = () => {
    setValidationError('');
    const nextIdx = installments.length;
    const numStr = String(nextIdx + 1).padStart(2, '0');
    const prazo = (nextIdx + 1) * 30;
    const dVenc = addDaysToDate(issueDate, prazo);
    // Sugere o valor da diferença restante se houver
    const sugerido = difference > 0 ? difference : 0;

    const newInst: NfeDetailedInstallment = {
      id: `inst_${Date.now()}_${nextIdx}`,
      number: numStr,
      amount: sugerido,
      daysInterval: prazo,
      dueDate: dVenc,
      paymentMethodCode: defaultPayOption.code,
      paymentMethodLabel: defaultPayOption.label,
      creditAccount: '2.1.1.01 - Fornecedores Nacionais',
      debitAccount: defaultDebitAccount,
      observations: String(nextIdx + 1).padStart(3, '0'),
    };

    const updated = [...installments, newInst];
    setInstallments(updated);
    setInstallmentsCountInput(updated.length);
  };

  // Remover uma linha de parcela
  const handleRemoveInstallment = (id: string) => {
    if (installments.length <= 1) {
      setValidationError('É obrigatório manter ao menos 01 parcela.');
      return;
    }
    setValidationError('');
    const updated = installments
      .filter(inst => inst.id !== id)
      .map((inst, idx) => ({
        ...inst,
        number: String(idx + 1).padStart(2, '0'),
        observations: String(idx + 1).padStart(3, '0'),
      }));
    setInstallments(updated);
    setInstallmentsCountInput(updated.length);
  };

  // Dividir igualmente entre a quantidade informada
  const handleApplyEqualDivision = (countToUse?: number) => {
    const count = countToUse !== undefined ? countToUse : installmentsCountInput;
    if (count < 1) return;
    setValidationError('');
    const generated = generateEqualInstallments(count, totalAmount, issueDate);
    setInstallments(generated);
    setInstallmentsCountInput(count);
  };

  // Ajustar a diferença de centavos na última parcela automaticamente
  const handleAdjustDifferenceOnLast = () => {
    if (installments.length === 0) return;
    setValidationError('');
    setInstallments(prev => {
      const copy = [...prev];
      const lastIndex = copy.length - 1;
      const last = copy[lastIndex];
      const adjustedAmount = Math.round((Number(last.amount) + difference) * 100) / 100;
      copy[lastIndex] = {
        ...last,
        amount: Math.max(0, adjustedAmount),
      };
      return copy;
    });
  };

  // Manipulação de anexo de documento (boleto/recibo)
  const handleOpenFilePicker = (rowId: string) => {
    setActiveFileRowId(rowId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeFileRowId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setInstallments(prev => prev.map(inst => {
        if (inst.id === activeFileRowId) {
          return {
            ...inst,
            documentFileUrl: dataUrl,
            documentFileName: file.name,
          };
        }
        return inst;
      }));
      setActiveFileRowId(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (rowId: string) => {
    setInstallments(prev => prev.map(inst => {
      if (inst.id === rowId) {
        const { documentFileUrl, documentFileName, ...rest } = inst;
        return rest as NfeDetailedInstallment;
      }
      return inst;
    }));
  };

  // Validação e Gravação Final
  const handleConfirm = () => {
    if (!isSumValid) {
      setValidationError(
        `Bloqueio de Validação: A soma de todas as parcelas (${formatCurrencyBRL(roundedSum)}) deve bater exatamente com o Valor Total (${formatCurrencyBRL(roundedTotal)}). Diferença: ${formatCurrencyBRL(Math.abs(difference))}.`
      );
      return;
    }

    // Validação de valores zerados ou negativos
    const hasInvalidAmount = installments.some(i => (Number(i.amount) || 0) <= 0);
    if (hasInvalidAmount) {
      setValidationError('Todas as parcelas devem conter um valor numérico maior que zero.');
      return;
    }

    // Validação de datas
    const hasInvalidDate = installments.some(i => !i.dueDate);
    if (hasInvalidDate) {
      setValidationError('Todas as parcelas devem conter uma data de vencimento válida.');
      return;
    }

    setValidationError('');
    onConfirmAndSave(installments);
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-janela-2-parcelas-nfe"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto backdrop-blur-xs animate-in fade-in"
      style={{ backgroundColor: 'rgba(10, 139, 193, 0.75)' }} // Azul intermediário #0a8bc1 com transparência
    >
      {/* Input de arquivo invisível para anexos de boleto/recibo */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg" 
      />

      <div 
        className="w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden border border-sky-300 dark:border-sky-700 my-auto flex flex-col max-h-[92vh]"
        style={{ backgroundColor: '#b0d2ed' }} // Fundo do bloco da grade: Azul claro #b0d2ed
      >
        {/* 1. TÍTULO DO CABEÇALHO: "Parcelas Geradas com Base no XML" - Azul forte #0963cb com texto em branco */}
        <div 
          className="px-5 py-4 flex items-center justify-between shrink-0 shadow-sm"
          style={{ backgroundColor: '#0963cb', color: '#ffffff' }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                {customTitle || 'Parcelas Geradas com Base no XML'}
              </h2>
              <p className="text-xs text-sky-100 font-medium">
                {customSubtitle || `NF-e Nº ${invoiceNumber} • Fornecedor: ${supplierName}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-janela-2-parcelas"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="Fechar Janela de Parcelas"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CORPO DO MODAL: Fundo Azul Claro #b0d2ed com textos e rótulos em Preto #000000 */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-black">
          
          {/* 2. Topo do Bloco: Destaque do "Valor Total" Consolidado & Controles de Divisão */}
          <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-[#96c1e5] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Bloco de Destaque: Valor Total */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#0963cb]/10 text-[#0963cb] flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-black block mb-0.5">
                  {totalLabel || 'Valor Total Consolidado da NF-e'}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-black font-mono tracking-tight">
                  {formatCurrencyBRL(totalAmount)}
                </span>
              </div>
            </div>

            {/* Controle de Divisão Rápida das Parcelas */}
            <div className="flex flex-wrap items-center gap-3 bg-[#b0d2ed]/60 p-2.5 rounded-xl border border-[#96c1e5]">
              <div className="flex items-center space-x-2">
                <label htmlFor="input-qtd-parcelas" className="text-xs font-black text-black">
                  Quantidade:
                </label>
                <div className="flex items-center bg-white rounded-lg border border-[#96c1e5] overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, installmentsCountInput - 1);
                      setInstallmentsCountInput(next);
                      handleApplyEqualDivision(next);
                    }}
                    className="px-2.5 py-1 text-black hover:bg-stone-100 font-black cursor-pointer"
                    title="Diminuir parcela"
                  >
                    -
                  </button>
                  <input 
                    id="input-qtd-parcelas"
                    type="number"
                    min="1"
                    max="60"
                    value={installmentsCountInput}
                    onChange={(e) => setInstallmentsCountInput(parseInt(e.target.value, 10) || 1)}
                    onBlur={() => handleApplyEqualDivision(installmentsCountInput)}
                    className="w-12 text-center text-xs font-black text-black py-1 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = installmentsCountInput + 1;
                      setInstallmentsCountInput(next);
                      handleApplyEqualDivision(next);
                    }}
                    className="px-2.5 py-1 text-black hover:bg-stone-100 font-black cursor-pointer"
                    title="Aumentar parcela"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                id="btn-dividir-igualmente"
                onClick={() => handleApplyEqualDivision()}
                className="px-3 py-1.5 bg-[#0963cb] hover:bg-[#0752a8] text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                title="Dividir valor total igualmente entre as parcelas"
              >
                <Divide className="w-3.5 h-3.5" />
                <span>Dividir Igualmente</span>
              </button>

              <button
                type="button"
                id="btn-adicionar-linha-parcela"
                onClick={handleAddInstallment}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 text-black border border-[#96c1e5] rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                title="Adicionar uma nova linha de parcela"
              >
                <Plus className="w-3.5 h-3.5 text-[#0963cb]" />
                <span>+ Linha</span>
              </button>
            </div>

            {/* Status da Conferência de Soma */}
            <div className="flex flex-col items-start lg:items-end justify-center">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-black uppercase text-black">
                  Soma das Parcelas:
                </span>
                <span className={`text-base font-black font-mono ${
                  isSumValid ? 'text-emerald-800' : 'text-rose-700'
                }`}>
                  {formatCurrencyBRL(roundedSum)}
                </span>
              </div>

              {isSumValid ? (
                <div className="flex items-center space-x-1 text-emerald-800 text-xs font-black mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Soma exata (100% Validado)</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-rose-800 text-xs font-black mt-0.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Divergência: {formatCurrencyBRL(Math.abs(difference))}</span>
                  <button
                    type="button"
                    onClick={handleAdjustDifferenceOnLast}
                    className="ml-1 px-1.5 py-0.5 bg-rose-200 hover:bg-rose-300 text-rose-950 rounded text-[10px] underline cursor-pointer"
                    title="Ajustar automaticamente os centavos na última parcela"
                  >
                    Ajustar na última
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Mensagem de Erro de Validação se houver */}
          {validationError && (
            <div 
              id="alerta-validacao-janela-2"
              className="p-3 bg-rose-100 border border-rose-400 rounded-xl flex items-center space-x-2 text-rose-900 text-xs font-black animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Grade / Tabela de Parcelas - Conforme Referência */}
          <div className="rounded-2xl border border-[#96c1e5] bg-white/70 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-black border-collapse">
                {/* Títulos das Colunas: Todas as fontes internas, títulos das colunas e rótulos na cor preta (#000000) */}
                <thead>
                  <tr className="bg-[#b0d2ed] border-b border-[#96c1e5] text-black font-black uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 w-16 text-center">Nº</th>
                    <th className="py-3 px-3 min-w-[140px]">Valor (R$)</th>
                    <th className="py-3 px-3 min-w-[90px]">Prazo (Dias)</th>
                    <th className="py-3 px-3 min-w-[130px]">Vencimento</th>
                    <th className="py-3 px-3 min-w-[160px]">Meio de Pagto (M. Pagto)</th>
                    <th className="py-3 px-3 min-w-[110px]">Crédito</th>
                    <th className="py-3 px-3 min-w-[110px]">Débito</th>
                    <th className="py-3 px-3 min-w-[110px]">Observações</th>
                    <th className="py-3 px-3 min-w-[110px] text-center">Documento</th>
                    <th className="py-3 px-2 w-10 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#96c1e5]/60 bg-transparent">
                  {installments.map((inst, index) => (
                    <tr 
                      key={inst.id} 
                      className="hover:bg-white/90 transition-colors"
                    >
                      {/* 1. Coluna Número: Indicador sequencial da parcela (ex: 01, 02, 03...) */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-1 bg-white font-black text-black rounded-lg border border-[#96c1e5] shadow-2xs font-mono text-xs">
                          {inst.number}
                        </span>
                      </td>

                      {/* 2. Coluna Valor: Caixa de texto numérica com o valor individual da parcela */}
                      <td className="py-2.5 px-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/70 font-black text-xs">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={inst.amount === 0 ? '' : inst.amount}
                            placeholder="0,00"
                            onChange={(e) => handleUpdateInstallment(inst.id, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full pl-8 pr-2.5 py-1.5 text-xs font-black bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden font-mono shadow-2xs"
                          />
                        </div>
                      </td>

                      {/* 3. Coluna Prazo: Dias de intervalo para o vencimento (ex: 30, 60, 90...) */}
                      <td className="py-2.5 px-3">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="3650"
                            value={inst.daysInterval}
                            onChange={(e) => handleUpdateInstallment(inst.id, 'daysInterval', parseInt(e.target.value, 10) || 0)}
                            className="w-full px-2.5 py-1.5 text-xs font-black bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden text-center font-mono shadow-2xs"
                          />
                        </div>
                      </td>

                      {/* 4. Coluna Vencimento: Campo do tipo Data (Datepicker) sugerida baseada no prazo */}
                      <td className="py-2.5 px-3">
                        <input
                          type="date"
                          value={inst.dueDate}
                          onChange={(e) => handleUpdateInstallment(inst.id, 'dueDate', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-black bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs cursor-pointer"
                        />
                      </td>

                      {/* 5. Coluna Meio de Pagamento (M. Pagto): Código ou seletor */}
                      <td className="py-2.5 px-3">
                        <select
                          value={inst.paymentMethodCode}
                          onChange={(e) => handleUpdateInstallment(inst.id, 'paymentMethodCode', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs cursor-pointer"
                        >
                          {PAYMENT_METHODS_OPTIONS.map(opt => (
                            <option key={opt.code} value={opt.code}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 6. Coluna Crédito: Código contábil de integração */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={inst.creditAccount}
                          placeholder="2.1.1.01"
                          onChange={(e) => handleUpdateInstallment(inst.id, 'creditAccount', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs"
                          title="Conta contábil de Crédito (Passivo / Fornecedor)"
                        />
                      </td>

                      {/* 6. Coluna Débito: Código contábil de integração */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={inst.debitAccount}
                          placeholder="3.1.2.01"
                          onChange={(e) => handleUpdateInstallment(inst.id, 'debitAccount', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs"
                          title="Conta contábil de Débito (Despesa / Custo)"
                        />
                      </td>

                      {/* 7. Coluna Observações: Caixa de texto curta para observações específicas (ex: 001, 002...) */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={inst.observations}
                          placeholder="001"
                          onChange={(e) => handleUpdateInstallment(inst.id, 'observations', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs"
                          title="Observações da Parcela"
                        />
                      </td>

                      {/* 8. Botão de Documento (Boleto/Recibo): Botão simples para vincular arquivos ou visualizar */}
                      <td className="py-2.5 px-3 text-center">
                        {inst.documentFileUrl ? (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setPreviewFile({ name: inst.documentFileName || `Doc_Parc_${inst.number}`, url: inst.documentFileUrl! })}
                              className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                              title={`Visualizar documento vinculado (${inst.documentFileName || 'Arquivo'})`}
                            >
                              <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                              <span className="text-[10px] font-black max-w-[50px] truncate">
                                {inst.documentFileName ? 'Ver' : 'Anexo'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(inst.id)}
                              className="p-1 text-rose-600 hover:text-rose-800 rounded cursor-pointer"
                              title="Remover anexo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenFilePicker(inst.id)}
                            className="px-2 py-1.5 bg-white hover:bg-stone-100 text-black border border-[#96c1e5] rounded-lg text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer shadow-2xs mx-auto"
                            title="Vincular boleto ou recibo desta parcela"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-[#0963cb]" />
                            <span>Vincular</span>
                          </button>
                        )}
                      </td>

                      {/* Ações: Excluir Linha */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveInstallment(inst.id)}
                          disabled={installments.length <= 1}
                          className={`p-1.5 rounded-lg transition ${
                            installments.length <= 1 
                              ? 'text-stone-300 cursor-not-allowed opacity-40' 
                              : 'text-rose-600 hover:text-rose-900 hover:bg-rose-100 cursor-pointer'
                          }`}
                          title={installments.length <= 1 ? 'Mínimo de 1 parcela' : 'Excluir esta parcela'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dica Informativa */}
          <div className="text-[11px] text-black font-semibold flex items-center justify-between flex-wrap gap-2 px-1">
            <span>
              * Cada parcela será gravada de forma individual no Contas a Pagar, mantendo vínculo com a NF-e Nº {invoiceNumber}.
            </span>
            <span>
              Total de Linhas: <strong className="font-black">{installments.length} parcela(s)</strong>
            </span>
          </div>

        </div>

        {/* 3. BOTÕES DO RODAPÉ E VALIDAÇÃO FINAL (Canto inferior direito) */}
        <div 
          className="px-5 py-3.5 bg-white/95 border-t border-[#96c1e5] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center space-x-2 text-xs text-black font-bold">
            <span className="text-black/80">Status de Validação:</span>
            {isSumValid ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded font-black text-[11px]">
                Pronto para Gravar
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-950 border border-rose-300 rounded font-black text-[11px]">
                Ajuste a soma antes de gravar
              </span>
            )}
          </div>

          {/* Canto inferior direito: [Cancelar] e [Confirmar e Gravar Lançamentos] */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="btn-cancelar-janela-2-parcelas"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black font-bold text-xs rounded-xl border border-[#96c1e5] transition cursor-pointer shadow-2xs min-h-[42px]"
            >
              Cancelar
            </button>

            <button
              type="button"
              id="btn-confirmar-gravar-lancamentos-janela-2"
              onClick={handleConfirm}
              disabled={!isSumValid}
              className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-md transition flex items-center space-x-2 min-h-[42px] ${
                isSumValid
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer active:scale-98'
                  : 'bg-stone-300 text-stone-500 border border-stone-300 cursor-not-allowed opacity-60'
              }`}
              title={isSumValid ? 'Confirmar e Gravar Lançamentos no Contas a Pagar' : 'Corrija a soma das parcelas para gravar'}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirmar e Gravar Lançamentos</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modal Simples de Visualização de Arquivo / Documento */}
      {previewFile && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-stone-300 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black text-black truncate">
                Visualização: {previewFile.name}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1 text-stone-400 hover:text-black rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-stone-100 rounded-xl p-4">
              {previewFile.url.startsWith('data:image/') ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-[50vh] object-contain rounded-lg" />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <FileText className="w-12 h-12 text-[#0963cb] mx-auto" />
                  <p className="text-xs font-bold text-black">Documento PDF ou arquivo vinculado</p>
                  <a 
                    href={previewFile.url} 
                    download={previewFile.name}
                    className="inline-block px-4 py-2 bg-[#0963cb] text-white rounded-xl text-xs font-black shadow cursor-pointer"
                  >
                    Baixar / Abrir Arquivo
                  </a>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-black font-bold text-xs rounded-xl cursor-pointer"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
