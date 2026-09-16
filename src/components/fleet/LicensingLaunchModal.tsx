import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  DollarSign, 
  FileText, 
  Calendar,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { formatCurrencyBRL } from '../../lib/storage';
import { formatarMoeda, desformatarMoeda } from '../../lib/formatters';

export interface LicensingLaunchData {
  baseAmount: number;
  interestAmount: number;
  totalAmount: number;
  dueDate: string;
  observations: string;
}

export interface LicensingLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleName: string;
  vehicleIdentifier: string; // Placa ou modelo
  baseValue: number; // Valor vindo do input "Valor do Licenciamento" (R$)
  year?: string | number;
  onConfirmAndSave: (data: LicensingLaunchData) => void;
}

/**
 * Componente controlado de entrada com máscara monetária em tempo real (R$ 0,00)
 */
const MoneyCellInput: React.FC<{
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}> = ({ value, onChange, placeholder = '0,00', id, disabled = false }) => {
  const display = value === 0 ? '' : formatarMoeda(Math.round(value * 100));

  return (
    <div className="relative w-full">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/70 font-black text-xs pointer-events-none select-none">
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          const formatted = formatarMoeda(raw);
          const num = desformatarMoeda(formatted);
          onChange(num);
        }}
        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-black bg-white text-black border border-[#96c1e5] rounded-xl focus:ring-2 focus:ring-[#0963cb]/40 focus:outline-hidden font-mono shadow-2xs disabled:bg-stone-100 disabled:text-stone-500"
      />
    </div>
  );
};

export const LicensingLaunchModal: React.FC<LicensingLaunchModalProps> = ({
  isOpen,
  onClose,
  vehicleName,
  vehicleIdentifier,
  baseValue,
  year,
  onConfirmAndSave,
}) => {
  const [baseAmount, setBaseAmount] = useState<number>(baseValue || 0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');

  // Sugestão de vencimento padrão (30 dias à frente ou dia 20 do próximo mês)
  const getDefaultDueDate = (): string => {
    try {
      const today = new Date();
      // Projeta vencimento para 30 dias à frente
      const targetDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      const now = new Date();
      return now.toISOString().split('T')[0];
    }
  };

  // Inicializa os dados ao abrir a modal
  useEffect(() => {
    if (!isOpen) return;
    setValidationError('');
    const initialBase = baseValue > 0 ? baseValue : 0;
    setBaseAmount(initialBase);
    setInterestAmount(0);
    setDueDate(getDefaultDueDate());

    const currentYear = year || new Date().getFullYear();
    setObservations(
      `Taxa de Licenciamento Anual CRLV ${currentYear} - ${vehicleName} (${vehicleIdentifier})`
    );
  }, [isOpen, baseValue, vehicleName, vehicleIdentifier, year]);

  const totalAmount = Math.round((baseAmount + (interestAmount || 0)) * 100) / 100;
  const isValid = totalAmount > 0 && !!dueDate;

  const handleConfirm = () => {
    if (baseAmount <= 0) {
      setValidationError('O Valor Base do Licenciamento deve ser maior que zero.');
      return;
    }

    if (!dueDate) {
      setValidationError('Selecione uma Data de Vencimento válida.');
      return;
    }

    onConfirmAndSave({
      baseAmount,
      interestAmount: interestAmount || 0,
      totalAmount,
      dueDate,
      observations: observations.trim(),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-confirmacao-licenciamento-crlv"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto backdrop-blur-xs animate-in fade-in"
      style={{ backgroundColor: 'rgba(10, 139, 193, 0.75)' }} // Azul intermediário #0a8bc1 com transparência
    >
      <div 
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-sky-300 dark:border-sky-700 my-auto flex flex-col max-h-[92vh]"
        style={{ backgroundColor: '#b0d2ed' }} // Fundo do bloco: Azul claro #b0d2ed
      >
        {/* 1. CABEÇALHO E TÍTULO: Azul forte #0963cb com texto em branco */}
        <div 
          className="px-5 py-4 flex items-center justify-between shrink-0 shadow-sm"
          style={{ backgroundColor: '#0963cb', color: '#ffffff' }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner text-white shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Lançamento da Taxa Anual CRLV (Licenciamento)
              </h2>
              <p className="text-xs text-sky-100 font-medium">
                Veículo: <strong className="text-white font-bold">{vehicleName}</strong> • Placa / Identificador: <strong className="text-white font-bold">{vehicleIdentifier || 'S/N'}</strong> {year ? `• Exercício: ${year}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-modal-licenciamento"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="Fechar Janela de Licenciamento"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CORPO DO MODAL: Fundo Azul Claro #b0d2ed com textos em Preto #000000 */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-black">
          
          {/* Card de Destaque: Total Consolidado do Licenciamento */}
          <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-[#96c1e5] shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#0963cb]/10 text-[#0963cb] flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-black block mb-0.5">
                  Total a Lançar no Contas a Pagar
                </span>
                <span className="text-2xl sm:text-3xl font-black text-black font-mono tracking-tight">
                  {formatCurrencyBRL(totalAmount)}
                </span>
              </div>
            </div>

            {interestAmount > 0 && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-1 rounded-lg border border-amber-300 block">
                  + Juros/Acréscimos: {formatCurrencyBRL(interestAmount)}
                </span>
              </div>
            )}
          </div>

          {/* Mensagem de Erro de Validação se houver */}
          {validationError && (
            <div 
              id="alerta-validacao-licenciamento"
              className="p-3 bg-rose-100 border border-rose-400 rounded-xl flex items-center space-x-2 text-rose-900 text-xs font-black animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Card dos Campos Principais */}
          <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-[#96c1e5] shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* 1. Valor Base (R$) - Preenchido automaticamente */}
              <div>
                <label 
                  htmlFor="input-licenciamento-valor-base" 
                  className="block text-xs font-black text-black mb-1.5 flex items-center justify-between"
                >
                  <span>Valor Base (R$)</span>
                  <span className="text-[10px] text-stone-500 font-semibold">(Taxa Estadual)</span>
                </label>
                <MoneyCellInput
                  id="input-licenciamento-valor-base"
                  value={baseAmount}
                  onChange={(val) => {
                    setValidationError('');
                    setBaseAmount(val);
                  }}
                  placeholder="0,00"
                />
              </div>

              {/* 2. Juros / Encargos (R$) - Editável se houver atraso */}
              <div>
                <label 
                  htmlFor="input-licenciamento-juros" 
                  className="block text-xs font-black text-black mb-1.5 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-700" />
                    <span>Juros / Encargos (R$)</span>
                  </span>
                  <span className="text-[10px] text-stone-500 font-semibold">(Se em atraso)</span>
                </label>
                <MoneyCellInput
                  id="input-licenciamento-juros"
                  value={interestAmount}
                  onChange={(val) => {
                    setValidationError('');
                    setInterestAmount(val);
                  }}
                  placeholder="0,00"
                />
              </div>

            </div>

            {/* 3. Data de Vencimento & Categoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              
              <div>
                <label 
                  htmlFor="input-licenciamento-vencimento" 
                  className="block text-xs font-black text-black mb-1.5 flex items-center gap-1"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#0963cb]" />
                  <span>Data de Vencimento *</span>
                </label>
                <input
                  id="input-licenciamento-vencimento"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setValidationError('');
                    setDueDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-black bg-white text-black border border-[#96c1e5] rounded-xl focus:ring-2 focus:ring-[#0963cb]/40 focus:outline-hidden shadow-2xs cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black mb-1.5">
                  Categoria Contas a Pagar
                </label>
                <div className="px-3 py-2 text-xs font-bold bg-stone-100 text-stone-700 rounded-xl border border-stone-300 flex items-center justify-between select-none">
                  <span>Licenciamento / Taxas Detran</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                    Automático
                  </span>
                </div>
              </div>

            </div>

            {/* 4. Observações / Descrição do Lançamento */}
            <div>
              <label 
                htmlFor="input-licenciamento-observacoes" 
                className="block text-xs font-black text-black mb-1.5 flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5 text-[#0963cb]" />
                <span>Observações do Lançamento</span>
              </label>
              <input
                id="input-licenciamento-observacoes"
                type="text"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Descrição para controle financeiro..."
                className="w-full px-3 py-2 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-xl focus:ring-2 focus:ring-[#0963cb]/40 focus:outline-hidden shadow-2xs"
              />
            </div>

          </div>

          {/* Dica Informativa */}
          <div className="text-[11px] text-black font-semibold flex items-center justify-between px-1">
            <span>
              * O lançamento será gerado diretamente no <strong>Contas a Pagar</strong> como pendência financeira sob a titularidade do Detran.
            </span>
          </div>

        </div>

        {/* 5. RODAPÉ: Botões Cancelar e Confirmar e Gravar Lançamento */}
        <div 
          className="px-5 py-3.5 bg-white/95 border-t border-[#96c1e5] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center space-x-2 text-xs text-black font-bold">
            <span className="text-black/80">Status:</span>
            {isValid ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded font-black text-[11px]">
                Pronto para Gravar
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-950 border border-amber-300 rounded font-black text-[11px]">
                Informe o valor e vencimento
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="btn-cancelar-modal-licenciamento"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black font-bold text-xs rounded-xl border border-[#96c1e5] transition cursor-pointer shadow-2xs min-h-[42px]"
            >
              Cancelar
            </button>

            <button
              type="button"
              id="btn-confirmar-gravar-licenciamento"
              onClick={handleConfirm}
              disabled={!isValid}
              className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-md transition flex items-center space-x-2 min-h-[42px] ${
                isValid
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer active:scale-98'
                  : 'bg-stone-300 text-stone-500 border border-stone-300 cursor-not-allowed opacity-60'
              }`}
              title={isValid ? 'Confirmar e Gravar Lançamento no Contas a Pagar' : 'Preencha os campos obrigatórios'}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirmar e Gravar Lançamento</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
