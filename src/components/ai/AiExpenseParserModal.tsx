import React, { useState } from 'react';
import { Sparkles, X, Check, ArrowRight, Lightbulb } from 'lucide-react';
import { Expense, ExpenseCategory, CostCenter, Machinery, PaymentMethod } from '../../types';

interface AiExpenseParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: Expense) => void;
  categories: ExpenseCategory[];
  costCenters: CostCenter[];
  machineries: Machinery[];
}

export const AiExpenseParserModal: React.FC<AiExpenseParserModalProps> = ({
  isOpen,
  onClose,
  onAddExpense,
  categories,
  costCenters,
  machineries,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Partial<Expense> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const samplePrompts = [
    'Abasteci 400 litros de diesel no Trator John Deere ontem deu R$ 2.480 no Posto Trevo via Pix',
    'Comprei jogo de facas da ensiladeira JF C120 por R$ 1.850 no boleto com vencimento dia 15',
    'Paguei R$ 1.200 de diárias para equipe de compactação do silo 01 hoje no dinheiro',
    '3 rolos de lona dupla face para vedação de silagem por R$ 4.200 na AgroPlast',
  ];

  const handleParse = () => {
    if (!inputPrompt.trim()) return;
    setIsProcessing(true);

    const text = inputPrompt.toLowerCase();

    // 1. Extract Amount (R$ 1.200,50 or 1200 or 1450.00)
    let extractedAmount = 0;
    const amountMatch = text.match(/(?:r\$|reais)?\s*([\d\.,]+)/i);
    if (amountMatch) {
      let rawNum = amountMatch[1].replace(/\./g, '').replace(',', '.');
      const num = parseFloat(rawNum);
      if (!isNaN(num) && num > 0) {
        extractedAmount = num;
      }
    }

    // 2. Identify Category
    let matchedCat = categories[categories.length - 1]; // fallback
    if (text.includes('diesel') || text.includes('abastec') || text.includes('combustivel') || text.includes('arla')) {
      matchedCat = categories.find((c) => c.id === 'cat_combustivel') || categories[0];
    } else if (text.includes('faca') || text.includes('manut') || text.includes('peça') || text.includes('mecanic') || text.includes('oleo') || text.includes('filtro')) {
      matchedCat = categories.find((c) => c.id === 'cat_manutencao') || categories[1];
    } else if (text.includes('semente') || text.includes('adubo') || text.includes('inoculante') || text.includes('defensiv') || text.includes('quimic')) {
      matchedCat = categories.find((c) => c.id === 'cat_insumos') || categories[2];
    } else if (text.includes('diaria') || text.includes('mao de obra') || text.includes('operador') || text.includes('salario') || text.includes('equipe')) {
      matchedCat = categories.find((c) => c.id === 'cat_mao_de_obra') || categories[3];
    } else if (text.includes('lona') || text.includes('fita') || text.includes('embalag') || text.includes('saco')) {
      matchedCat = categories.find((c) => c.id === 'cat_lona_embalagem') || categories[6] || categories[0];
    } else if (text.includes('frete') || text.includes('transporte') || text.includes('carreta')) {
      matchedCat = categories.find((c) => c.id === 'cat_frete') || categories[4];
    } else if (text.includes('almoco') || text.includes('comida') || text.includes('marmita') || text.includes('refeic')) {
      matchedCat = categories.find((c) => c.id === 'cat_alimentacao') || categories[5];
    }

    // 3. Payment Method
    let paymentMethod: PaymentMethod = 'pix';
    if (text.includes('boleto')) paymentMethod = 'boleto';
    else if (text.includes('credito') || text.includes('cartao')) paymentMethod = 'cartao_credito';
    else if (text.includes('dinheiro') || text.includes('especie')) paymentMethod = 'dinheiro';
    else if (text.includes('safra') || text.includes('prazo')) paymentMethod = 'safra_prazo';

    // 4. Machinery match
    const matchedMach = machineries.find((m) => {
      const nameL = m.name.toLowerCase();
      const brandL = m.brand.toLowerCase();
      return text.includes(nameL) || text.includes(brandL) || 
        (text.includes('trator') && nameL.includes('trator')) ||
        (text.includes('ensiladeira') && nameL.includes('ensiladeira')) ||
        (text.includes('caminhao') && nameL.includes('caminhão'));
    });

    // 5. Cost center match
    const matchedCC = costCenters.find((cc) => text.includes(cc.name.toLowerCase()));

    // 6. Dates
    const today = new Date().toISOString().split('T')[0];
    let dueDate = today;
    let paymentDate = today;
    let status: any = 'pago';

    if (text.includes('ontem')) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      dueDate = d.toISOString().split('T')[0];
      paymentDate = dueDate;
    } else if (text.includes('vence') || text.includes('a pagar') || text.includes('pendente') || text.includes('boleto com vencimento')) {
      status = 'pendente';
      paymentDate = '';
    }

    const preview: Partial<Expense> = {
      description: inputPrompt.charAt(0).toUpperCase() + inputPrompt.slice(1),
      amount: extractedAmount || 100,
      categoryId: matchedCat.id,
      categoryName: matchedCat.name,
      categoryColor: matchedCat.color,
      dueDate,
      paymentDate: status === 'pago' ? paymentDate : undefined,
      status,
      paymentMethod,
      supplier: text.includes('posto') ? 'Posto de Combustíveis' : text.includes('agro') ? 'Revenda Agrícola' : 'Fornecedor Local',
      machineryId: matchedMach?.id,
      machineryName: matchedMach?.name,
      costCenterId: matchedCC?.id,
      costCenterName: matchedCC?.name,
    };

    setTimeout(() => {
      setParsedPreview(preview);
      setIsProcessing(false);
    }, 200);
  };

  const handleConfirm = () => {
    if (!parsedPreview) return;
    const finalExpense: Expense = {
      id: `exp_${Date.now()}_ai`,
      description: parsedPreview.description || 'Lançamento Rápido',
      amount: parsedPreview.amount || 0,
      categoryId: parsedPreview.categoryId || categories[0].id,
      categoryName: parsedPreview.categoryName || categories[0].name,
      categoryColor: parsedPreview.categoryColor || '#10b981',
      dueDate: parsedPreview.dueDate || new Date().toISOString().split('T')[0],
      paymentDate: parsedPreview.paymentDate,
      status: parsedPreview.status || 'pago',
      paymentMethod: parsedPreview.paymentMethod || 'pix',
      supplier: parsedPreview.supplier || '',
      machineryId: parsedPreview.machineryId,
      machineryName: parsedPreview.machineryName,
      costCenterId: parsedPreview.costCenterId,
      costCenterName: parsedPreview.costCenterName,
      createdAt: new Date().toISOString(),
    };

    onAddExpense(finalExpense);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Standardized Solid Teal Bar */}
        <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Lançamento Rápido com IA
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          
          <div>
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1.5">
              O QUE VOCÊ GASTOU?
            </label>
            <textarea
              rows={3}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ex: Abasteci 300 litros de diesel no trator ontem por R$ 1.860 via pix..."
              className="w-full p-3.5 text-xs sm:text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#009688] focus:outline-none resize-none font-medium"
            />
          </div>

          {/* Sample Prompts */}
          <div>
            <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Exemplos rápidos (clique para testar):
            </span>
            <div className="space-y-1.5">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputPrompt(p)}
                  className="w-full text-left p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 hover:bg-teal-50 dark:hover:bg-teal-950/20 text-xs text-stone-600 dark:text-stone-300 hover:text-[#009688] dark:hover:text-teal-400 border border-stone-200 dark:border-stone-700/60 transition truncate cursor-pointer"
                >
                  "{p}"
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleParse}
              disabled={!inputPrompt.trim() || isProcessing}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#009688] hover:bg-[#00796b] text-white text-xs sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isProcessing ? 'Analisando...' : 'Interpretar Lançamento'}</span>
            </button>
          </div>

          {/* Parsed Result Preview */}
          {parsedPreview && (
            <div className="mt-4 p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#009688]" />
                  Lançamento Identificado
                </span>
                <span className="text-base font-extrabold text-[#156f33] dark:text-emerald-400">
                  R$ {(parsedPreview.amount || 0).toFixed(2)}
                </span>
              </div>

              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">{parsedPreview.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-teal-200 dark:border-teal-800/60 text-xs">
                <div>
                  <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Categoria</span>
                  <strong className="text-stone-800 dark:text-stone-200">{parsedPreview.categoryName}</strong>
                </div>
                <div>
                  <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Forma</span>
                  <strong className="text-stone-800 dark:text-stone-200 uppercase">{parsedPreview.paymentMethod}</strong>
                </div>
                <div>
                  <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Status</span>
                  <strong className="text-[#156f33] dark:text-emerald-400 capitalize">{parsedPreview.status}</strong>
                </div>
                {parsedPreview.machineryName && (
                  <div>
                    <span className="text-stone-500 dark:text-stone-400 block text-[10px]">Máquina</span>
                    <strong className="text-blue-700 dark:text-blue-400">{parsedPreview.machineryName}</strong>
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex items-center space-x-2 px-6 py-2 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer transition"
                >
                  <span>Confirmar & Salvar Despesa</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
