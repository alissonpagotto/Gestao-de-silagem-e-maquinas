import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  DollarSign, 
  Plus, 
  Trash2, 
  Divide, 
  Landmark, 
  Calendar,
  Car
} from 'lucide-react';
import { formatCurrencyBRL } from '../../lib/storage';
import { formatarMoeda, desformatarMoeda } from '../../lib/formatters';

export interface IpvaInstallmentRow {
  id: string;
  number: string; // Ex: "01", "02", "03"
  amount: number; // Valor base da parcela (R$)
  interest: number; // Juros / Encargos (R$)
  dueDate: string; // YYYY-MM-DD
  observations: string; // Ex: "Parcela IPVA 01/03"
}

export interface IpvaInstallmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleName: string;
  vehicleIdentifier: string; // Placa ou modelo
  totalAmount: number; // Total IPVA (R$) calculado
  initialInstallmentsCount?: number;
  year?: string | number;
  onConfirmAndSave: (installments: IpvaInstallmentRow[]) => void;
}

/**
 * Componente controlado de entrada com máscara monetária em tempo real (R$ 0,00)
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

export const IpvaInstallmentsModal: React.FC<IpvaInstallmentsModalProps> = ({
  isOpen,
  onClose,
  vehicleName,
  vehicleIdentifier,
  totalAmount,
  initialInstallmentsCount = 1,
  year,
  onConfirmAndSave,
}) => {
  const [installments, setInstallments] = useState<IpvaInstallmentRow[]>([]);
  const [installmentsCountInput, setInstallmentsCountInput] = useState<number>(initialInstallmentsCount || 1);
  const [validationError, setValidationError] = useState<string>('');

  // Auxiliar para gerar data de vencimento padrão sugerida
  const getDefaultDueDate = (index: number): string => {
    try {
      const today = new Date();
      // Se já passou do dia 20, projeta para o dia 20 do mês seguinte
      const startMonthOffset = today.getDate() > 20 ? 1 : 0;
      const targetDate = new Date(today.getFullYear(), today.getMonth() + startMonthOffset + index, 20);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      const now = new Date();
      return now.toISOString().split('T')[0];
    }
  };

  // Inicializa ou divide as parcelas igualmente
  const handleApplyEqualDivision = (overrideCount?: number) => {
    const count = overrideCount !== undefined ? overrideCount : installmentsCountInput;
    if (count < 1) return;

    setValidationError('');
    const baseValue = totalAmount > 0 ? totalAmount : 0;
    const quotient = Math.floor((baseValue / count) * 100) / 100;
    const remainder = Math.round((baseValue - quotient * count) * 100) / 100;

    const newInstallments: IpvaInstallmentRow[] = [];

    for (let i = 1; i <= count; i++) {
      const numStr = String(i).padStart(2, '0');
      let parcelValue = quotient;
      // Adiciona o resíduo de centavos na última parcela para garantir exatidão
      if (remainder > 0 && i === count) {
        parcelValue = Math.round((parcelValue + remainder) * 100) / 100;
      }

      const totalCountStr = String(count).padStart(2, '0');
      const obsDefault = count === 1 
        ? 'Parcela IPVA 01/01 (Cota Única)' 
        : `Parcela IPVA ${numStr}/${totalCountStr}`;

      newInstallments.push({
        id: `ipva_inst_${Date.now()}_${i}`,
        number: numStr,
        amount: parcelValue,
        interest: 0,
        dueDate: getDefaultDueDate(i - 1),
        observations: obsDefault,
      });
    }

    setInstallments(newInstallments);
  };

  // Carrega ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;
    setValidationError('');
    const count = Math.max(1, initialInstallmentsCount || 1);
    setInstallmentsCountInput(count);
    handleApplyEqualDivision(count);
  }, [isOpen, totalAmount, initialInstallmentsCount]);

  // Atualiza campo de uma parcela específica
  const handleUpdateInstallment = (
    id: string, 
    field: keyof IpvaInstallmentRow, 
    value: any
  ) => {
    setValidationError('');
    setInstallments(prev => prev.map(inst => {
      if (inst.id === id) {
        return { ...inst, [field]: value };
      }
      return inst;
    }));
  };

  // Adicionar uma nova linha de parcela
  const handleAddInstallment = () => {
    setValidationError('');
    const newCount = installments.length + 1;
    const newNumStr = String(newCount).padStart(2, '0');
    const totalCountStr = String(newCount).padStart(2, '0');

    const newRow: IpvaInstallmentRow = {
      id: `ipva_inst_${Date.now()}_${newCount}`,
      number: newNumStr,
      amount: 0,
      interest: 0,
      dueDate: getDefaultDueDate(newCount - 1),
      observations: `Parcela IPVA ${newNumStr}/${totalCountStr}`,
    };

    const updated = [...installments, newRow].map((item, idx) => {
      const currentNum = String(idx + 1).padStart(2, '0');
      const currentObs = item.observations.startsWith('Parcela IPVA')
        ? `Parcela IPVA ${currentNum}/${totalCountStr}`
        : item.observations;
      return {
        ...item,
        number: currentNum,
        observations: currentObs,
      };
    });

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
    const filtered = installments.filter(item => item.id !== id);
    const totalCountStr = String(filtered.length).padStart(2, '0');

    const renumbered = filtered.map((item, idx) => {
      const currentNum = String(idx + 1).padStart(2, '0');
      const currentObs = item.observations.startsWith('Parcela IPVA')
        ? (filtered.length === 1 ? 'Parcela IPVA 01/01 (Cota Única)' : `Parcela IPVA ${currentNum}/${totalCountStr}`)
        : item.observations;
      return {
        ...item,
        number: currentNum,
        observations: currentObs,
      };
    });

    setInstallments(renumbered);
    setInstallmentsCountInput(renumbered.length);
  };

  // Ajustar centavos de diferença na última parcela automaticamente
  const handleAdjustDifferenceOnLast = () => {
    if (installments.length === 0) return;
    const lastIdx = installments.length - 1;
    const sumOthers = installments.slice(0, lastIdx).reduce((acc, curr) => acc + curr.amount, 0);
    const correctedLastAmount = Math.max(0, Math.round((totalAmount - sumOthers) * 100) / 100);

    const updated = [...installments];
    updated[lastIdx] = {
      ...updated[lastIdx],
      amount: correctedLastAmount,
    };
    setInstallments(updated);
    setValidationError('');
  };

  // Cálculos de soma e validação
  const currentSum = installments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const currentTotalInterest = installments.reduce((acc, curr) => acc + (curr.interest || 0), 0);
  const roundedSum = Math.round(currentSum * 100) / 100;
  const roundedTotal = Math.round(totalAmount * 100) / 100;
  const difference = Math.round((roundedSum - roundedTotal) * 100) / 100;
  const isSumValid = Math.abs(difference) < 0.01;

  // Confirmação e gravação no Contas a Pagar
  const handleConfirm = () => {
    if (!isSumValid) {
      setValidationError(
        `Bloqueio de Validação: A soma das parcelas (${formatCurrencyBRL(roundedSum)}) deve bater exatamente com o Valor Total (${formatCurrencyBRL(roundedTotal)}). Diferença: ${formatCurrencyBRL(Math.abs(difference))}.`
      );
      return;
    }

    if (installments.some(inst => inst.amount <= 0)) {
      setValidationError('Todas as parcelas devem conter um valor numérico maior que zero.');
      return;
    }

    if (installments.some(inst => !inst.dueDate)) {
      setValidationError('Todas as parcelas devem conter uma data de vencimento válida.');
      return;
    }

    onConfirmAndSave(installments);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-parcelas-geradas-ipva"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto backdrop-blur-xs animate-in fade-in"
      style={{ backgroundColor: 'rgba(10, 139, 193, 0.75)' }} // Azul intermediário #0a8bc1 com transparência
    >
      <div 
        className="w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-sky-300 dark:border-sky-700 my-auto flex flex-col max-h-[92vh]"
        style={{ backgroundColor: '#b0d2ed' }} // Fundo do bloco da grade: Azul claro #b0d2ed
      >
        {/* 1. CABEÇALHO E TÍTULO: Azul forte #0963cb com texto em branco */}
        <div 
          className="px-5 py-4 flex items-center justify-between shrink-0 shadow-sm"
          style={{ backgroundColor: '#0963cb', color: '#ffffff' }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner text-white">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                Parcelas Geradas para IPVA
              </h2>
              <p className="text-xs text-sky-100 font-medium">
                Veículo: <strong className="text-white font-bold">{vehicleName}</strong> • Identificador / Placa: <strong className="text-white font-bold">{vehicleIdentifier || 'S/N'}</strong> {year ? `• Exercício: ${year}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-fechar-modal-ipva"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="Fechar Janela de Parcelas"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CORPO DO MODAL: Fundo Azul Claro #b0d2ed com textos e rótulos em Preto #000000 */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-black">
          
          {/* 2. Topo do Bloco: Destaque do "Valor Consolidado" & Controles do Topo */}
          <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-[#96c1e5] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Bloco de Destaque: Valor Total IPVA */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-[#0963cb]/10 text-[#0963cb] flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-black block mb-0.5">
                  Total IPVA (R$) Calculado
                </span>
                <span className="text-2xl sm:text-3xl font-black text-black font-mono tracking-tight">
                  {formatCurrencyBRL(totalAmount)}
                </span>
              </div>
            </div>

            {/* 3. Controles do Topo: Quantidade [-] [+], + Dividir Igualmente, + Linha */}
            <div className="flex flex-wrap items-center gap-3 bg-[#b0d2ed]/60 p-2.5 rounded-xl border border-[#96c1e5]">
              <div className="flex items-center space-x-2">
                <label htmlFor="input-qtd-parcelas-ipva" className="text-xs font-black text-black">
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
                    id="input-qtd-parcelas-ipva"
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
                id="btn-dividir-igualmente-ipva"
                onClick={() => handleApplyEqualDivision()}
                className="px-3 py-1.5 bg-[#0963cb] hover:bg-[#0752a8] text-white rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer active:scale-95"
                title="Dividir valor total igualmente entre as parcelas"
              >
                <Divide className="w-3.5 h-3.5" />
                <span>+ Dividir Igualmente</span>
              </button>

              <button
                type="button"
                id="btn-adicionar-linha-parcela-ipva"
                onClick={handleAddInstallment}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 text-black border border-[#96c1e5] rounded-lg text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer active:scale-95"
                title="Adicionar uma nova linha de parcela"
              >
                <Plus className="w-3.5 h-3.5 text-[#0963cb]" />
                <span>+ Linha</span>
              </button>
            </div>

            {/* Status da Conferência de Soma das Parcelas */}
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

              {currentTotalInterest > 0 && (
                <div className="text-[10px] font-bold text-amber-900 mt-1 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  + Juros/Encargos: {formatCurrencyBRL(currentTotalInterest)} • Total c/ Encargos: {formatCurrencyBRL(roundedSum + currentTotalInterest)}
                </div>
              )}
            </div>

          </div>

          {/* Mensagem de Erro de Validação se houver */}
          {validationError && (
            <div 
              id="alerta-validacao-ipva"
              className="p-3 bg-rose-100 border border-rose-400 rounded-xl flex items-center space-x-2 text-rose-900 text-xs font-black animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 4. Estrutura da Tabela (Colunas) */}
          <div className="rounded-2xl border border-[#96c1e5] bg-white/70 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-black border-collapse">
                <thead>
                  <tr className="bg-[#b0d2ed] border-b border-[#96c1e5] text-black font-black uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 w-16 text-center">Nº</th>
                    <th className="py-3 px-3 min-w-[150px]">Valor (R$)</th>
                    <th className="py-3 px-3 min-w-[150px]">Juros / Encargos (R$)</th>
                    <th className="py-3 px-3 min-w-[140px]">Vencimento</th>
                    <th className="py-3 px-3 min-w-[220px]">Observações</th>
                    <th className="py-3 px-2 w-12 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#96c1e5]/60 bg-transparent">
                  {installments.map((inst) => {
                    const totalRowAmount = Math.round((inst.amount + (inst.interest || 0)) * 100) / 100;
                    return (
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

                        {/* 2. Coluna Valor (R$): Campo editável com máscara monetária */}
                        <td className="py-2.5 px-3">
                          <MoneyCellInput
                            id={`input-ipva-valor-${inst.id}`}
                            value={inst.amount}
                            onChange={(num) => handleUpdateInstallment(inst.id, 'amount', num)}
                            placeholder="0,00"
                          />
                        </td>

                        {/* 3. Coluna Juros / Encargos (R$): Nova coluna inserida logo após o Valor, editável, que soma ao total */}
                        <td className="py-2.5 px-3">
                          <div>
                            <MoneyCellInput
                              id={`input-ipva-juros-${inst.id}`}
                              value={inst.interest}
                              onChange={(num) => handleUpdateInstallment(inst.id, 'interest', num)}
                              placeholder="0,00"
                            />
                            {inst.interest > 0 && (
                              <span className="text-[10px] font-bold text-emerald-800 block mt-0.5">
                                Total Parcela: {formatCurrencyBRL(totalRowAmount)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Coluna Vencimento: Campo de data */}
                        <td className="py-2.5 px-3">
                          <input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => handleUpdateInstallment(inst.id, 'dueDate', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs font-black bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs cursor-pointer"
                          />
                        </td>

                        {/* 5. Coluna Observações: Campo de texto sugerindo por padrão "Parcela IPVA [XX]/[Total]" */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={inst.observations}
                            placeholder={`Parcela IPVA ${inst.number}/${String(installments.length).padStart(2, '0')}`}
                            onChange={(e) => handleUpdateInstallment(inst.id, 'observations', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold bg-white text-black border border-[#96c1e5] rounded-lg focus:ring-2 focus:ring-[#0963cb]/30 focus:outline-hidden shadow-2xs"
                            title="Observações da Parcela"
                          />
                        </td>

                        {/* 6. Ações: Botão de lixeira para remover linha */}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dica Informativa */}
          <div className="text-[11px] text-black font-semibold flex items-center justify-between flex-wrap gap-2 px-1">
            <span>
              * Cada parcela será gravada de forma individual no Contas a Pagar com categoria <strong>"IPVA / Impostos de Frotas"</strong>, vinculada ao veículo <strong>{vehicleName}</strong> ({vehicleIdentifier}).
            </span>
            <span>
              Total de Linhas: <strong className="font-black">{installments.length} parcela(s)</strong>
            </span>
          </div>

        </div>

        {/* 5. RODAPÉ: Botões Cancelar e Confirmar e Gravar Lançamentos */}
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

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="btn-cancelar-modal-ipva"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black font-bold text-xs rounded-xl border border-[#96c1e5] transition cursor-pointer shadow-2xs min-h-[42px]"
            >
              Cancelar
            </button>

            <button
              type="button"
              id="btn-confirmar-gravar-lancamentos-ipva"
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
    </div>
  );
};
