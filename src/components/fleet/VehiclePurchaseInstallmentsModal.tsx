import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  DollarSign, 
  FileText, 
  Paperclip, 
  Calendar, 
  Trash2, 
  Divide, 
  FileCheck,
  Truck,
  CreditCard
} from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';
import { formatCurrencyBRL } from '../../lib/storage';
import { formatarMoeda, desformatarMoeda } from '../../lib/formatters';

export interface VehiclePurchaseInstallmentRow {
  id: string;
  number: string; // Ex: "01", "02", "03"
  amount: number; // Valor da parcela (R$)
  daysInterval: number; // Prazo em dias (ex: 30, 60, 90, 180, 365)
  dueDate: string; // YYYY-MM-DD
  paymentMethodCode: string; // Ex: "01", "02", "04"
  paymentMethodLabel: string;
  creditAccount: string; // Código contábil Crédito
  debitAccount: string; // Código contábil Débito
  observations: string; // Ex: "Parcela 01/36 - Financiamento"
  documentFileUrl?: string; // Arquivo vinculado (PDF / imagem)
  documentFileName?: string;
}

export interface VehiclePurchaseInstallmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleName: string;
  vehicleIdentifier: string; // Placa ou Chassi/Série
  purchaseValue: number; // Valor de Compra (R$) informado na tela anterior
  baseDate?: string; // Data de Compra (YYYY-MM-DD) ou data base
  firstDueDate?: string; // Data do 1º Vencimento vinda da tela anterior
  initialInstallmentsCount?: number;
  existingInstallments?: VehiclePurchaseInstallmentRow[];
  initialIntervalDays?: number | null; // Intervalo salvo (30, 90, 180, 365)
  supplierName?: string;
  invoiceNumber?: string;
  financialInstitution?: string;
  onConfirmAndSave: (installments: VehiclePurchaseInstallmentRow[], intervalDays: number | null) => void;
}

// Opções de Meio de Pagamento com código contábil/fiscal
const PAYMENT_METHODS_OPTIONS = [
  { code: '01', label: '01 - Boleto Bancário', methodKey: 'boleto' },
  { code: '02', label: '02 - PIX', methodKey: 'pix' },
  { code: '03', label: '03 - Transferência Bancária (TED/DOC)', methodKey: 'transferencia' },
  { code: '04', label: '04 - Financiamento Bancário / CDC', methodKey: 'financiamento' },
  { code: '05', label: '05 - Finame / Crédito Rural BNDES', methodKey: 'financiamento' },
  { code: '06', label: '06 - Cartão de Crédito', methodKey: 'cartao_credito' },
  { code: '07', label: '07 - Cheque / A Prazo', methodKey: 'safra_prazo' },
  { code: '08', label: '08 - Débito Automático / DDA', methodKey: 'transferencia' },
  { code: '09', label: '09 - Consórcio Contemplado', methodKey: 'financiamento' },
  { code: '99', label: '99 - Outros', methodKey: 'boleto' },
];

// Sugestões de Contas Contábeis (Plano de Contas)
const DEFAULT_CREDIT_ACCOUNTS = [
  '2.1.2.01 - Financiamentos Bancários a Pagar',
  '2.1.1.01 - Fornecedores Nacionais / Concessionárias',
  '2.1.2.02 - Finame / Crédito Rural BNDES a Pagar',
  '2.1.2.05 - Consórcios Contemplados a Pagar',
  '1.1.1.02 - Bancos Conta Movimento',
];

const DEFAULT_DEBIT_ACCOUNTS = [
  '1.2.3.01 - Ativo Imobilizado: Veículos da Frota',
  '1.2.3.02 - Ativo Imobilizado: Máquinas e Tratores',
  '1.2.3.03 - Ativo Imobilizado: Reboques e Implementos',
  '1.2.3.04 - Ativo Imobilizado: Equipamentos Agrícolas',
  '3.1.2.01 - Custos e Despesas com Frota Própria',
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

function addCalendarInterval(baseDateStr: string, index: number, intervalDays: number): string {
  if (index === 0) return baseDateStr;
  try {
    const parts = baseDateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      // Anual (1 ano / 365 dias) -> mantém dia e mês exatos nos anos subsequentes
      if (intervalDays === 365) {
        const targetYear = year + index;
        const maxDays = new Date(targetYear, month + 1, 0).getDate();
        const targetDay = Math.min(day, maxDays);
        return `${targetYear}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
      }

      // Semestral (6 meses / 180 dias) -> adiciona 6 meses por parcela
      if (intervalDays === 180) {
        const totalMonths = month + (index * 6);
        const targetYear = year + Math.floor(totalMonths / 12);
        const targetMonth = ((totalMonths % 12) + 12) % 12;
        const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
        const targetDay = Math.min(day, maxDays);
        return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
      }

      // Trimestral (3 meses / 90 dias) -> adiciona 3 meses por parcela
      if (intervalDays === 90) {
        const totalMonths = month + (index * 3);
        const targetYear = year + Math.floor(totalMonths / 12);
        const targetMonth = ((totalMonths % 12) + 12) % 12;
        const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
        const targetDay = Math.min(day, maxDays);
        return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
      }

      // Mensal (1 mês / 30 dias) -> adiciona 1 mês por parcela mantendo o dia
      if (intervalDays === 30) {
        const totalMonths = month + index;
        const targetYear = year + Math.floor(totalMonths / 12);
        const targetMonth = ((totalMonths % 12) + 12) % 12;
        const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
        const targetDay = Math.min(day, maxDays);
        return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
      }
    }
  } catch (e) {
    console.error('Erro ao calcular intervalo do calendário:', e);
  }
  return addDaysToDate(baseDateStr, index * intervalDays);
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

/**
 * Função utilitária para detectar intervalo (30, 90, 180, 365) a partir das parcelas existentes
 */
export function detectIntervalFromInstallments(rows?: VehiclePurchaseInstallmentRow[]): number | null {
  if (!rows || rows.length < 2) {
    if (rows && rows.length === 1 && rows[0].daysInterval) {
      if (rows[0].daysInterval >= 350) return 365;
      if (rows[0].daysInterval >= 170 && rows[0].daysInterval <= 190) return 180;
      if (rows[0].daysInterval >= 80 && rows[0].daysInterval <= 100) return 90;
      if (rows[0].daysInterval >= 25 && rows[0].daysInterval <= 35) return 30;
    }
    return null;
  }

  try {
    const d1Str = rows[0].dueDate;
    const d2Str = rows[1].dueDate;
    if (!d1Str || !d2Str) return null;

    const p1 = d1Str.split('-');
    const p2 = d2Str.split('-');
    if (p1.length === 3 && p2.length === 3) {
      const y1 = parseInt(p1[0], 10);
      const m1 = parseInt(p1[1], 10);
      const d1 = parseInt(p1[2], 10);

      const y2 = parseInt(p2[0], 10);
      const m2 = parseInt(p2[1], 10);
      const d2 = parseInt(p2[2], 10);

      const date1 = new Date(y1, m1 - 1, d1);
      const date2 = new Date(y2, m2 - 1, d2);
      const diffDays = Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
      const monthDiff = (y2 * 12 + m2) - (y1 * 12 + m1);

      // Anual (1 ano / ~365 dias)
      if (monthDiff === 12 || (diffDays >= 350 && diffDays <= 370)) {
        return 365;
      }
      // Semestral (6 meses / ~180 dias)
      if (monthDiff === 6 || (diffDays >= 170 && diffDays <= 190)) {
        return 180;
      }
      // Trimestral (3 meses / ~90 dias)
      if (monthDiff === 3 || (diffDays >= 80 && diffDays <= 100)) {
        return 90;
      }
      // Mensal (1 mês / ~30 dias)
      if (monthDiff === 1 || (diffDays >= 25 && diffDays <= 35)) {
        return 30;
      }
    }
  } catch (e) {
    console.error('Erro ao detectar intervalo das parcelas:', e);
  }

  return null;
}

/**
 * Componente controlado de entrada monetária em tempo real com máscara BRL
 */
const MoneyCellInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  id?: string;
}> = ({ value, onChange, placeholder = '0,00', id }) => {
  const display = value === 0 ? '' : formatarMoeda(Math.round(value * 100));

  return (
    <div className="relative w-full">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/70 font-black text-xs pointer-events-none select-none">
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          const formatted = formatarMoeda(raw);
          const num = desformatarMoeda(formatted);
          onChange(num);
        }}
        className="w-full pl-8 pr-2.5 py-1.5 text-xs font-black bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden font-mono shadow-2xs"
      />
    </div>
  );
};

export const VehiclePurchaseInstallmentsModal: React.FC<VehiclePurchaseInstallmentsModalProps> = ({
  isOpen,
  onClose,
  vehicleName,
  vehicleIdentifier,
  purchaseValue,
  baseDate,
  firstDueDate,
  initialInstallmentsCount = 1,
  existingInstallments,
  initialIntervalDays,
  supplierName,
  invoiceNumber,
  financialInstitution,
  onConfirmAndSave,
}) => {
  const { confirm } = useConfirm();
  const [installments, setInstallments] = useState<VehiclePurchaseInstallmentRow[]>([]);
  const [installmentsCountInput, setInstallmentsCountInput] = useState<number>(initialInstallmentsCount || 1);
  const [selectedInterval, setSelectedInterval] = useState<number | null>(initialIntervalDays ?? 30);
  const [firstDueDateInput, setFirstDueDateInput] = useState<string>('');
  const [activeFileRowId, setActiveFileRowId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const [validationError, setValidationError] = useState<string>('');
  const [hasSavedInstallmentsLock, setHasSavedInstallmentsLock] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveBaseDate = baseDate || new Date().toISOString().split('T')[0];

  // Inicialização e bloqueio estrito de reset
  useEffect(() => {
    if (!isOpen) return;

    // 1. Persistência Estrita das Parcelas Salvas (Bloqueio de Reset):
    // Se os dados já existirem, renderize exatamente os valores salvos. É estritamente proibido rodar recálculo na abertura.
    if (existingInstallments && existingInstallments.length > 0) {
      setInstallments(existingInstallments);
      setInstallmentsCountInput(existingInstallments.length);

      // 2. Salvar e Destacar o Botão de Período Selecionado:
      const activeInterval = initialIntervalDays ?? detectIntervalFromInstallments(existingInstallments);
      setSelectedInterval(activeInterval);

      setFirstDueDateInput(existingInstallments[0].dueDate || '');
      setValidationError('');
      setHasSavedInstallmentsLock(true);
      return;
    }

    // Se NÃO existirem parcelas gravadas ainda:
    setHasSavedInstallmentsLock(false);
    const count = Math.max(1, initialInstallmentsCount || 1);
    setInstallmentsCountInput(count);

    const initialFirst = firstDueDate || addDaysToDate(effectiveBaseDate, 30);
    setFirstDueDateInput(initialFirst);
    const defaultInterval = initialIntervalDays ?? 30;
    setSelectedInterval(defaultInterval);
    generateInitialInstallments(count, initialFirst, defaultInterval);
    setValidationError('');
  }, [isOpen, existingInstallments, initialIntervalDays]);

  // Gerador inicial das parcelas
  const generateInitialInstallments = (count: number, customFirstDate?: string, customInterval: number = 30) => {
    const total = Math.max(0, purchaseValue || 0);
    const safeCount = Math.max(1, count);
    
    // Divisão matemática com centavos exatos
    const baseAmount = total > 0 ? Math.floor((total / safeCount) * 100) / 100 : 0;
    const diff = total > 0 ? Math.round((total - baseAmount * safeCount) * 100) / 100 : 0;

    const defaultPayment = financialInstitution 
      ? PAYMENT_METHODS_OPTIONS.find(p => p.code === '04') || PAYMENT_METHODS_OPTIONS[0]
      : PAYMENT_METHODS_OPTIONS[0];

    const generated: VehiclePurchaseInstallmentRow[] = [];
    const firstDate = customFirstDate || firstDueDateInput || addDaysToDate(effectiveBaseDate, customInterval);

    for (let i = 1; i <= safeCount; i++) {
      const isLast = i === safeCount;
      const amount = isLast ? Math.round((baseAmount + diff) * 100) / 100 : baseAmount;
      const dueDate = addCalendarInterval(firstDate, i - 1, customInterval);
      const days = calculateDaysBetween(effectiveBaseDate, dueDate);
      const numberStr = String(i).padStart(2, '0');

      generated.push({
        id: `vinst_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        number: numberStr,
        amount,
        daysInterval: days,
        dueDate,
        paymentMethodCode: defaultPayment.code,
        paymentMethodLabel: defaultPayment.label,
        creditAccount: financialInstitution 
          ? '2.1.2.01 - Financiamentos Bancários a Pagar'
          : '2.1.1.01 - Fornecedores Nacionais / Concessionárias',
        debitAccount: '1.2.3.01 - Ativo Imobilizado: Veículos da Frota',
        observations: `Parcela ${numberStr}/${String(safeCount).padStart(2, '0')} - Aquisição ${vehicleName || 'Veículo'}`,
      });
    }

    setInstallments(generated);
    setSelectedInterval(customInterval);
  };

  // 3. Alerta de Confirmação para Alteração de Datas (Trava de Segurança):
  // Exibe imediatamente pop-up com o texto exato solicitado caso haja parcelas salvas
  const confirmRecalculationIfLocked = async (): Promise<boolean> => {
    if (!hasSavedInstallmentsLock) return true;

    const isConfirmed = await confirm({
      title: 'Atenção: Alteração de Condições',
      message: 'Atenção: Você está alterando as condições originais do financiamento. Isso irá recalcular e substituir todas as datas e prazos das parcelas atuais. Tem certeza que deseja prosseguir?',
      confirmLabel: 'Sim, Confirmar',
      cancelLabel: 'Não, Cancelar',
      variant: 'warning',
    });

    if (isConfirmed) {
      setHasSavedInstallmentsLock(false);
      return true;
    }
    return false;
  };

  // Trava de segurança ao clicar nos botões de período (Mensal, Trimestral, Semestral, Anual)
  const handleIntervalClick = async (daysPerPeriod: number) => {
    if (selectedInterval === daysPerPeriod) return;

    const canProceed = await confirmRecalculationIfLocked();
    if (!canProceed) {
      // Mantém os dados originais intactos e reverte a ação
      return;
    }

    handleApplyInterval(daysPerPeriod);
  };

  // Trava de segurança ao alterar o campo 1º Vencimento
  const handleFirstDueDateChange = async (newDate: string) => {
    if (!newDate || newDate === firstDueDateInput) return;

    const canProceed = await confirmRecalculationIfLocked();
    if (!canProceed) {
      // Reverte e mantém os dados originais intactos
      return;
    }

    handleApplyFirstDueDate(newDate);
  };

  // Trava de segurança ao clicar em Dividir Igualmente
  const handleEqualDivisionClick = async () => {
    const canProceed = await confirmRecalculationIfLocked();
    if (!canProceed) return;

    handleApplyEqualDivision();
  };

  // Trava de segurança ao alterar quantidade de parcelas [-] [+]
  const handleQuantityStep = async (nextCount: number) => {
    const safeNext = Math.max(1, Math.min(120, nextCount));
    if (safeNext === installmentsCountInput) return;

    const canProceed = await confirmRecalculationIfLocked();
    if (!canProceed) return;

    setInstallmentsCountInput(safeNext);
    handleApplyEqualDivision(safeNext);
  };

  // Recálculo inteligente em cascata a partir do 1º Vencimento (Topo -> Tabela)
  const handleApplyFirstDueDate = (newFirstDueDate: string) => {
    setFirstDueDateInput(newFirstDueDate);
    if (!newFirstDueDate) return;

    setInstallments(prev => {
      if (prev.length === 0) return prev;

      const intervalUnit = selectedInterval || 30;

      return prev.map((inst, index) => {
        if (index === 0) {
          const days = calculateDaysBetween(effectiveBaseDate, newFirstDueDate);
          return {
            ...inst,
            dueDate: newFirstDueDate,
            daysInterval: days,
          };
        }

        // Para as parcelas subsequentes (02, 03, etc.):
        // Recalcula o vencimento aplicando o intervalo de calendário (anual, semestral, trimestral ou mensal)
        const dueDate = addCalendarInterval(newFirstDueDate, index, intervalUnit);
        const daysInterval = calculateDaysBetween(effectiveBaseDate, dueDate);

        return {
          ...inst,
          dueDate,
          daysInterval,
        };
      });
    });
    setValidationError('');
  };

  // Aplicar Divisão Igualitária baseada no número de parcelas
  const handleApplyEqualDivision = (customCount?: number) => {
    const count = customCount || installmentsCountInput || installments.length || 1;
    const safeCount = Math.max(1, Math.min(120, count));
    setInstallmentsCountInput(safeCount);

    const total = Math.max(0, purchaseValue || 0);
    const baseAmount = total > 0 ? Math.floor((total / safeCount) * 100) / 100 : 0;
    const diff = total > 0 ? Math.round((total - baseAmount * safeCount) * 100) / 100 : 0;

    const intervalUnit = selectedInterval || 30;
    const currentFirstDate = firstDueDateInput || installments[0]?.dueDate || addCalendarInterval(effectiveBaseDate, 1, intervalUnit);
    setFirstDueDateInput(currentFirstDate);

    const updated: VehiclePurchaseInstallmentRow[] = [];

    for (let i = 1; i <= safeCount; i++) {
      const existing = installments[i - 1];
      const isLast = i === safeCount;
      const amount = isLast ? Math.round((baseAmount + diff) * 100) / 100 : baseAmount;
      const dueDate = existing ? existing.dueDate : addCalendarInterval(currentFirstDate, i - 1, intervalUnit);
      const days = existing ? existing.daysInterval : calculateDaysBetween(effectiveBaseDate, dueDate);
      const numberStr = String(i).padStart(2, '0');

      updated.push({
        id: existing ? existing.id : `vinst_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        number: numberStr,
        amount,
        daysInterval: days,
        dueDate,
        paymentMethodCode: existing?.paymentMethodCode || (financialInstitution ? '04' : '01'),
        paymentMethodLabel: existing?.paymentMethodLabel || (financialInstitution ? '04 - Financiamento Bancário / CDC' : '01 - Boleto Bancário'),
        creditAccount: existing?.creditAccount || (financialInstitution ? '2.1.2.01 - Financiamentos Bancários a Pagar' : '2.1.1.01 - Fornecedores Nacionais / Concessionárias'),
        debitAccount: existing?.debitAccount || '1.2.3.01 - Ativo Imobilizado: Veículos da Frota',
        observations: existing?.observations || `Parcela ${numberStr}/${String(safeCount).padStart(2, '0')} - Aquisição ${vehicleName || 'Veículo'}`,
        documentFileUrl: existing?.documentFileUrl,
        documentFileName: existing?.documentFileName,
      });
    }

    setInstallments(updated);
    setValidationError('');
  };

  // Aplicar Intervalo Inteligente (Mensal = 30d, Trimestral = 90d, Semestral = 180d, Anual = 365d)
  const handleApplyInterval = (daysPerPeriod: number) => {
    setSelectedInterval(daysPerPeriod);
    const targetCount = installmentsCountInput || installments.length || 1;
    const safeCount = Math.max(1, Math.min(120, targetCount));

    const currentFirstDate = firstDueDateInput || installments[0]?.dueDate || addCalendarInterval(effectiveBaseDate, 1, daysPerPeriod);
    setFirstDueDateInput(currentFirstDate);

    // Se o número de parcelas na tela for diferente do input selecionado, equaliza a quantidade
    if (installments.length !== safeCount) {
      setInstallmentsCountInput(safeCount);
      const total = Math.max(0, purchaseValue || 0);
      const baseAmount = total > 0 ? Math.floor((total / safeCount) * 100) / 100 : 0;
      const diff = total > 0 ? Math.round((total - baseAmount * safeCount) * 100) / 100 : 0;

      const updated: VehiclePurchaseInstallmentRow[] = [];
      for (let i = 1; i <= safeCount; i++) {
        const existing = installments[i - 1];
        const isLast = i === safeCount;
        const amount = isLast ? Math.round((baseAmount + diff) * 100) / 100 : baseAmount;
        const dueDate = addCalendarInterval(currentFirstDate, i - 1, daysPerPeriod);
        const days = calculateDaysBetween(effectiveBaseDate, dueDate);
        const numberStr = String(i).padStart(2, '0');

        updated.push({
          id: existing ? existing.id : `vinst_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
          number: numberStr,
          amount,
          daysInterval: days,
          dueDate,
          paymentMethodCode: existing?.paymentMethodCode || (financialInstitution ? '04' : '01'),
          paymentMethodLabel: existing?.paymentMethodLabel || (financialInstitution ? '04 - Financiamento Bancário / CDC' : '01 - Boleto Bancário'),
          creditAccount: existing?.creditAccount || (financialInstitution ? '2.1.2.01 - Financiamentos Bancários a Pagar' : '2.1.1.01 - Fornecedores Nacionais / Concessionárias'),
          debitAccount: existing?.debitAccount || '1.2.3.01 - Ativo Imobilizado: Veículos da Frota',
          observations: existing?.observations || `Parcela ${numberStr}/${String(safeCount).padStart(2, '0')} - Aquisição ${vehicleName || 'Veículo'}`,
          documentFileUrl: existing?.documentFileUrl,
          documentFileName: existing?.documentFileName,
        });
      }
      setInstallments(updated);
      setValidationError('');
      return;
    }

    // Recalcula PRAZO (DIAS) e VENCIMENTO de todas as parcelas da lista respeitando o 1º Vencimento
    setInstallments(prev => prev.map((inst, index) => {
      const dueDate = index === 0 ? currentFirstDate : addCalendarInterval(currentFirstDate, index, daysPerPeriod);
      const days = calculateDaysBetween(effectiveBaseDate, dueDate);
      return {
        ...inst,
        daysInterval: days,
        dueDate,
      };
    }));
    setValidationError('');
  };

  // Remover uma linha de parcela
  const handleRemoveInstallment = (id: string) => {
    if (installments.length <= 1) {
      alert('É necessário manter ao menos 01 parcela.');
      return;
    }

    const filtered = installments.filter(i => i.id !== id);
    // Renumera as parcelas sequencialmente (01, 02, 03...)
    const renumbered = filtered.map((item, idx) => ({
      ...item,
      number: String(idx + 1).padStart(2, '0'),
    }));

    setInstallments(renumbered);
    setInstallmentsCountInput(renumbered.length);
    if (renumbered[0]) {
      setFirstDueDateInput(renumbered[0].dueDate);
    }
    setValidationError('');
  };

  // Atualização em tempo real de qualquer campo da linha
  const handleUpdateInstallment = (
    id: string, 
    field: keyof VehiclePurchaseInstallmentRow, 
    value: any
  ) => {
    const isFirstRow = installments.length > 0 && (installments[0].id === id || installments[0].number === '01');

    // Sincronização Inversa (Linha da Tabela -> Topo & Restante da Lista):
    // Se o usuário alterar a data de vencimento digitando diretamente no campo 'VENCIMENTO' da linha '01',
    // atualiza o campo do topo de forma síncrona e dispara o recálculo em cascata para as demais
    if (field === 'dueDate' && isFirstRow) {
      handleFirstDueDateChange(value);
      return;
    }

    setInstallments(prev => prev.map(inst => {
      if (inst.id !== id) return inst;

      const updated = { ...inst, [field]: value };

      // Se alterou Prazo (dias), recalcula Vencimento automaticamente
      // (ex: se digitar 180 dias, joga a data 6 meses para a frente; se digitar 365, joga 1 ano)
      if (field === 'daysInterval') {
        const days = parseInt(value, 10) || 0;
        updated.daysInterval = days;
        updated.dueDate = addDaysToDate(effectiveBaseDate, days);
        setSelectedInterval(null);
        if (inst.id === prev[0]?.id || inst.number === '01') {
          setFirstDueDateInput(updated.dueDate);
        }
      }

      // Se alterou Vencimento (data) de linha intermediária (não a primeira)
      if (field === 'dueDate') {
        updated.dueDate = value;
        updated.daysInterval = calculateDaysBetween(effectiveBaseDate, value);
        setSelectedInterval(null);
      }

      // Se alterou o código de Meio de Pagamento, atualiza também o rótulo
      if (field === 'paymentMethodCode') {
        const found = PAYMENT_METHODS_OPTIONS.find(opt => opt.code === value);
        if (found) {
          updated.paymentMethodLabel = found.label;
        }
      }

      return updated;
    }));
    setValidationError('');
  };

  // Ajuste automático de centavos / diferença na última parcela
  const handleAdjustDifferenceOnLast = () => {
    if (installments.length === 0) return;
    const currentSum = Math.round(installments.reduce((acc, i) => acc + (Number(i.amount) || 0), 0) * 100) / 100;
    const total = Math.round((purchaseValue || 0) * 100) / 100;
    const delta = Math.round((total - currentSum) * 100) / 100;

    setInstallments(prev => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];
      const newAmount = Math.max(0, Math.round((last.amount + delta) * 100) / 100);
      next[lastIndex] = { ...last, amount: newAmount };
      return next;
    });
    setValidationError('');
  };

  // Upload e vínculo de documento (PDF / imagem)
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
    reader.onload = () => {
      const result = reader.result as string;
      setInstallments(prev => prev.map(inst => {
        if (inst.id === activeFileRowId) {
          return {
            ...inst,
            documentFileUrl: result,
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
        return {
          ...inst,
          documentFileUrl: undefined,
          documentFileName: undefined,
        };
      }
      return inst;
    }));
  };

  // Cálculos de validação matemática em tempo real
  const roundedSum = Math.round(installments.reduce((acc, i) => acc + (Number(i.amount) || 0), 0) * 100) / 100;
  const roundedTotal = Math.round((purchaseValue || 0) * 100) / 100;
  const difference = Math.round((roundedSum - roundedTotal) * 100) / 100;
  const isSumValid = Math.abs(difference) < 0.01 && roundedSum > 0;

  // Validação e Gravação Final
  const handleConfirm = () => {
    if (!isSumValid) {
      setValidationError(
        `Bloqueio de Validação: A soma de todas as parcelas (${formatCurrencyBRL(roundedSum)}) deve bater exatamente com o Valor de Compra (${formatCurrencyBRL(roundedTotal)}). Diferença: ${formatCurrencyBRL(Math.abs(difference))}.`
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
    onConfirmAndSave(installments, selectedInterval);
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-parcelas-compra-financiamento"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto backdrop-blur-xs animate-in fade-in"
      style={{ backgroundColor: 'rgba(10, 139, 193, 0.75)' }} // Azul intermediário com transparência (idêntico à referência)
    >
      {/* Datalists para plano de contas */}
      <datalist id="credit-accounts-list">
        {DEFAULT_CREDIT_ACCOUNTS.map((acc, idx) => (
          <option key={`cred_${idx}`} value={acc} />
        ))}
      </datalist>
      <datalist id="debit-accounts-list">
        {DEFAULT_DEBIT_ACCOUNTS.map((acc, idx) => (
          <option key={`deb_${idx}`} value={acc} />
        ))}
      </datalist>

      {/* Input de arquivo invisível para anexos de comprovantes */}
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
        {/* 1. CABEÇALHO E DADOS INICIAIS: Azul forte #0963cb com texto em branco */}
        <div 
          className="px-5 py-4 flex items-center justify-between shrink-0 shadow-sm"
          style={{ backgroundColor: '#0963cb', color: '#ffffff' }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner text-white">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                Parcelas Geradas para Compra / Financiamento
              </h2>
              <p className="text-xs text-sky-100 font-medium flex items-center gap-1.5 flex-wrap">
                <span>{vehicleName || 'Veículo da Frota'}</span>
                <span>•</span>
                <span className="font-mono">{vehicleIdentifier || 'S/PLACA'}</span>
                {supplierName && (
                  <>
                    <span>•</span>
                    <span>Fornecedor: {supplierName}</span>
                  </>
                )}
                {invoiceNumber && (
                  <>
                    <span>•</span>
                    <span>NF: {invoiceNumber}</span>
                  </>
                )}
                {financialInstitution && (
                  <>
                    <span>•</span>
                    <span>Banco: {financialInstitution}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-modal-parcelas-compra"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="Fechar Janela de Parcelas"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CORPO DO MODAL: Fundo Azul Claro #b0d2ed com textos e rótulos em Preto #000000 */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-black">
          
          {/* 2. Topo do Bloco: Valor de Compra Consolidado & Controles de Geração Automática */}
          <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-[#96c1e5] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Bloco de Destaque: Valor Consolidado puxado da tela anterior */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#0963cb]/10 text-[#0963cb] flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-black block mb-0.5">
                  Valor de Compra Consolidado (R$)
                </span>
                <span className="text-2xl sm:text-3xl font-black text-black font-mono tracking-tight">
                  {formatCurrencyBRL(purchaseValue)}
                </span>
              </div>
            </div>

            {/* Controles de Geração Automática: Quantidade [-] [+], + Dividir Igualmente, + Linha */}
            <div className="flex flex-wrap items-center gap-3 bg-[#b0d2ed]/60 p-2.5 rounded-xl border border-[#96c1e5]">
              
              {/* Seletor de Quantidade com [-] e [+] */}
              <div className="flex items-center space-x-2">
                <label 
                  htmlFor="input-qtd-parcelas-veiculo"
                  className="text-xs font-black uppercase text-black"
                >
                  Quantidade:
                </label>
                <div className="flex items-center bg-white rounded-lg border border-[#96c1e5] overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleQuantityStep(installmentsCountInput - 1)}
                    className="px-2.5 py-1 text-black hover:bg-stone-100 font-black cursor-pointer"
                    title="Diminuir parcela"
                  >
                    -
                  </button>
                  <input 
                    id="input-qtd-parcelas-veiculo"
                    type="number"
                    min="1"
                    max="120"
                    value={installmentsCountInput}
                    onChange={(e) => setInstallmentsCountInput(parseInt(e.target.value, 10) || 1)}
                    onBlur={() => handleQuantityStep(installmentsCountInput)}
                    className="w-12 text-center text-xs font-black text-black py-1 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuantityStep(installmentsCountInput + 1)}
                    className="px-2.5 py-1 text-black hover:bg-stone-100 font-black cursor-pointer"
                    title="Aumentar parcela"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Botão + Dividir Igualmente */}
              <button
                type="button"
                id="btn-dividir-igualmente-veiculo"
                onClick={() => handleEqualDivisionClick()}
                className="px-3 py-1.5 bg-[#0963cb] hover:bg-[#0752a8] text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                title="Dividir valor de compra igualmente entre as parcelas"
              >
                <Divide className="w-3.5 h-3.5" />
                <span>+ Dividir Igualmente</span>
              </button>

              {/* Divisor sutil */}
              <div className="h-5 w-px bg-[#96c1e5] hidden sm:block" />

              {/* Botões de Intervalo Inteligente: Mensal, Trimestral, Semestral, Anual */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Botão Mensal (30 dias) */}
                <button
                  type="button"
                  id="btn-intervalo-mensal-30d"
                  onClick={() => handleIntervalClick(30)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-2xs cursor-pointer ${
                    selectedInterval === 30
                      ? 'bg-[#0963cb] text-white border border-[#0963cb]'
                      : 'bg-white hover:bg-sky-50 text-black hover:text-[#0963cb] border border-[#96c1e5]'
                  }`}
                  title="Recalcular prazos e vencimentos para intervalo Mensal (30 dias)"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Mensal (30 dias)</span>
                </button>

                {/* Botão Trimestral (90 dias) */}
                <button
                  type="button"
                  id="btn-intervalo-trimestral-90d"
                  onClick={() => handleIntervalClick(90)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-2xs cursor-pointer ${
                    selectedInterval === 90
                      ? 'bg-[#0963cb] text-white border border-[#0963cb]'
                      : 'bg-white hover:bg-sky-50 text-black hover:text-[#0963cb] border border-[#96c1e5]'
                  }`}
                  title="Recalcular prazos e vencimentos para intervalo Trimestral (90 dias)"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Trimestral (90 dias)</span>
                </button>

                {/* Botão Semestral (6 meses) */}
                <button
                  type="button"
                  id="btn-intervalo-semestral-6m"
                  onClick={() => handleIntervalClick(180)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-2xs cursor-pointer ${
                    selectedInterval === 180
                      ? 'bg-[#0963cb] text-white border border-[#0963cb]'
                      : 'bg-white hover:bg-sky-50 text-black hover:text-[#0963cb] border border-[#96c1e5]'
                  }`}
                  title="Recalcular prazos e vencimentos para intervalo Semestral (6 meses / 180 dias)"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Semestral (6 meses)</span>
                </button>

                {/* Botão Anual (1 ano) */}
                <button
                  type="button"
                  id="btn-intervalo-anual-1a"
                  onClick={() => handleIntervalClick(365)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-2xs cursor-pointer ${
                    selectedInterval === 365
                      ? 'bg-[#0963cb] text-white border border-[#0963cb]'
                      : 'bg-white hover:bg-sky-50 text-black hover:text-[#0963cb] border border-[#96c1e5]'
                  }`}
                  title="Recalcular prazos e vencimentos para intervalo Anual (1 ano / 365 dias)"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Anual (1 ano)</span>
                </button>
              </div>

              {/* Divisor sutil */}
              <div className="h-5 w-px bg-[#96c1e5] hidden sm:block" />

              {/* Campo 1º Vencimento (Demarcado pelo Retângulo Rosa ao lado dos botões de intervalo) */}
              <div className="flex items-center space-x-2">
                <label 
                  htmlFor="input-primeiro-vencimento-topo"
                  className="text-xs font-black uppercase text-black flex items-center space-x-1.5 whitespace-nowrap"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#0963cb]" />
                  <span>1º Vencimento:</span>
                </label>
                <input
                  id="input-primeiro-vencimento-topo"
                  type="date"
                  value={firstDueDateInput}
                  onChange={(e) => handleFirstDueDateChange(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-black bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs cursor-pointer"
                  title="Data do 1º Vencimento (atualiza a parcela 01 e projeta as subsequentes em cascata)"
                />
              </div>
            </div>

            {/* Status da Conferência de Soma das Parcelas em Tempo Real */}
            <div className="flex flex-col items-start lg:items-end justify-center">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-black uppercase text-black">
                  SOMA DAS PARCELAS:
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
                    className="ml-1 px-1.5 py-0.5 bg-rose-200 hover:bg-rose-300 text-rose-950 rounded text-[10px] underline cursor-pointer font-bold"
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
              id="alerta-validacao-parcelas-veiculo"
              className="p-3 bg-rose-100 border border-rose-400 rounded-xl flex items-center space-x-2 text-rose-900 text-xs font-black animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 3. ESTRUTURA DE COLUNAS DA TABELA (Idêntica à Imagem) */}
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
                    <th className="py-3 px-3 min-w-[170px]">Meio de Pagto</th>
                    <th className="py-3 px-3 min-w-[120px]">Crédito</th>
                    <th className="py-3 px-3 min-w-[120px]">Débito</th>
                    <th className="py-3 px-3 min-w-[120px]">Observações</th>
                    <th className="py-3 px-3 min-w-[110px] text-center">Documento</th>
                    <th className="py-3 px-2 w-10 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#96c1e5]/60 bg-transparent">
                  {installments.map((inst) => (
                    <tr 
                      key={inst.id} 
                      className="hover:bg-white/90 transition-colors"
                    >
                      {/* 1. Coluna Nº: Indicador sequencial da parcela (ex: 01, 02, 03...) */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-1 bg-white font-black text-black rounded-lg border border-[#96c1e5] shadow-2xs font-mono text-xs">
                          {inst.number}
                        </span>
                      </td>

                      {/* 2. Coluna VALOR (R$): Input editável com máscara monetária em tempo real */}
                      <td className="py-2.5 px-3">
                        <MoneyCellInput
                          id={`input-valor-${inst.id}`}
                          value={inst.amount}
                          onChange={(val) => handleUpdateInstallment(inst.id, 'amount', val)}
                          placeholder="0,00"
                        />
                      </td>

                      {/* 3. Coluna PRAZO (DIAS): Input numérico que calcula a data automaticamente */}
                      <td className="py-2.5 px-3">
                        <input
                          id={`input-prazo-${inst.id}`}
                          type="number"
                          min="0"
                          max="3650"
                          value={inst.daysInterval}
                          onChange={(e) => handleUpdateInstallment(inst.id, 'daysInterval', parseInt(e.target.value, 10) || 0)}
                          className="w-full px-2.5 py-1.5 text-xs font-black bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden text-center font-mono shadow-2xs"
                          title="Prazo em dias a partir da data base da compra"
                        />
                      </td>

                      {/* 4. Coluna VENCIMENTO: Campo de seleção de data livre (calendário) */}
                      <td className="py-2.5 px-3">
                        <input
                          id={`input-vencimento-${inst.id}`}
                          type="date"
                          value={inst.dueDate}
                          onChange={(e) => handleUpdateInstallment(inst.id, 'dueDate', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-black bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs cursor-pointer"
                        />
                      </td>

                      {/* 5. Coluna MEIO DE PAGTO: Menu drop-down */}
                      <td className="py-2.5 px-3">
                        <select
                          id={`select-meio-pagto-${inst.id}`}
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

                      {/* 6. Coluna CRÉDITO: Campo de seleção/edição do plano de contas */}
                      <td className="py-2.5 px-3">
                        <input
                          id={`input-credito-${inst.id}`}
                          type="text"
                          list="credit-accounts-list"
                          value={inst.creditAccount}
                          placeholder="2.1.2.01"
                          onChange={(e) => handleUpdateInstallment(inst.id, 'creditAccount', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs"
                          title="Conta contábil de Crédito (Passivo / Financiamento / Fornecedor)"
                        />
                      </td>

                      {/* 7. Coluna DÉBITO: Campo de seleção/edição do plano de contas */}
                      <td className="py-2.5 px-3">
                        <input
                          id={`input-debito-${inst.id}`}
                          type="text"
                          list="debit-accounts-list"
                          value={inst.debitAccount}
                          placeholder="1.2.3.01"
                          onChange={(e) => handleUpdateInstallment(inst.id, 'debitAccount', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs"
                          title="Conta contábil de Débito (Ativo Imobilizado / Máquinas e Veículos)"
                        />
                      </td>

                      {/* 8. Coluna OBSERVAÇÕES: Campo de texto livre */}
                      <td className="py-2.5 px-3">
                        <input
                          id={`input-obs-${inst.id}`}
                          type="text"
                          value={inst.observations}
                          placeholder={`Parcela ${inst.number}`}
                          onChange={(e) => handleUpdateInstallment(inst.id, 'observations', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs"
                          title="Observações específicas desta parcela"
                        />
                      </td>

                      {/* 9. Coluna DOCUMENTO: Botão "Vincular" para anexar comprovantes se necessário */}
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
                            title="Vincular boleto, carnê ou comprovante desta parcela"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-[#0963cb]" />
                            <span>Vincular</span>
                          </button>
                        )}
                      </td>

                      {/* 10. Coluna AÇÕES: Botão de lixeira vermelha para deletar a linha da parcela */}
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

          {/* Dica Informativa e Contador Total de Linhas */}
          <div className="text-[11px] text-black font-semibold flex items-center justify-between flex-wrap gap-2 px-1">
            <span>
              * Cada parcela será gravada individualmente no Contas a Pagar vinculado a este veículo específico ({vehicleName} - {vehicleIdentifier}).
            </span>
            <span>
              Total de Linhas: <strong className="font-black">{installments.length} parcela(s)</strong>
            </span>
          </div>

        </div>

        {/* 4. RODAPÉ E SALVAMENTO: Canto inferior direito */}
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

          {/* Canto inferior direito: [Cancelar] e [✓ Confirmar e Gravar Lançamentos] */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="btn-cancelar-modal-parcelas-compra"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black font-bold text-xs rounded-xl border border-[#96c1e5] transition cursor-pointer shadow-2xs min-h-[42px]"
            >
              Cancelar
            </button>

            <button
              type="button"
              id="btn-confirmar-gravar-lancamentos-compra"
              onClick={handleConfirm}
              disabled={!isSumValid}
              className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-md transition flex items-center space-x-2 min-h-[42px] ${
                isSumValid
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer active:scale-98'
                  : 'bg-stone-300 text-stone-500 border border-stone-300 cursor-not-allowed opacity-60'
              }`}
              title={isSumValid ? 'Confirmar e Gravar Lançamentos no Contas a Pagar deste veículo' : 'Corrija a soma das parcelas para gravar'}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>✓ Confirmar e Gravar Lançamentos</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modal Simples de Visualização de Arquivo / Comprovante */}
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
                  <p className="text-xs font-bold text-black">Documento PDF ou comprovante vinculado</p>
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
