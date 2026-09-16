import React, { useState, useMemo, useRef } from 'react';
import { 
  Building2, 
  UploadCloud, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Link2, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  Barcode, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Landmark,
  Layers,
  ChevronDown,
  X
} from 'lucide-react';
import { BankAccount, Expense, ExpenseCategory, BankTransaction } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { BankLogoIcon } from './BankLogoIcon';

interface BankIntegrationCardProps {
  accounts: BankAccount[];
  selectedAccountId?: string;
  onSelectAccount?: (id: string) => void;
  expenses: Expense[];
  onAddExpenseFromBankBill?: (expense: Partial<Expense>) => void;
  onImportBankTransactions?: (transactions: Omit<BankTransaction, 'id' | 'createdAt'>[]) => void;
  onLinkExpensesToAccount?: (expenseIds: string[], accountId: string) => void;
  categories?: ExpenseCategory[];
}

export const BankIntegrationCard: React.FC<BankIntegrationCardProps> = ({
  accounts = [],
  selectedAccountId: controlledAccountId,
  onSelectAccount,
  expenses = [],
  onAddExpenseFromBankBill,
  onImportBankTransactions,
  onLinkExpensesToAccount,
  categories = [],
}) => {
  const [internalAccountId, setInternalAccountId] = useState<string>(
    controlledAccountId || accounts[0]?.id || ''
  );

  const activeAccountId = controlledAccountId || internalAccountId || (accounts[0]?.id || '');
  const activeAccount = useMemo(() => {
    return accounts.find((a) => a.id === activeAccountId) || accounts[0];
  }, [accounts, activeAccountId]);

  // Modais de Ação do Card
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isLinkBatchModalOpen, setIsLinkBatchModalOpen] = useState(false);
  const [importNotification, setImportNotification] = useState<string | null>(null);

  // Form State: Inserir Conta / Boleto do Banco
  const [billBarcode, setBillBarcode] = useState('');
  const [billSupplier, setBillSupplier] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDate, setBillDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [billCategory, setBillCategory] = useState(categories[0]?.name || 'Geral');

  // Seleção de contas para vinculação em lote
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);

  // Contas a pagar pendentes ainda não vinculadas ou totais
  const pendingExpenses = useMemo(() => {
    return expenses.filter((e) => e.status === 'pendente');
  }, [expenses]);

  // Contas a pagar já vinculadas diretamente a esta conta
  const linkedExpenses = useMemo(() => {
    if (!activeAccount) return [];
    return expenses.filter((e) => e.bankAccountId === activeAccount.id);
  }, [expenses, activeAccount]);

  const linkedTotal = useMemo(() => {
    return linkedExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [linkedExpenses]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manipulador de Troca de Conta no Card
  const handleAccountChange = (id: string) => {
    setInternalAccountId(id);
    if (onSelectAccount) {
      onSelectAccount(id);
    }
  };

  // Simulação de Leitura de Código de Barras / Linha Digitável
  const handleBarcodeChange = (val: string) => {
    setBillBarcode(val);
    const digits = val.replace(/\D/g, '');
    
    // Tenta extrair valor se for linha digitável padrão boleto (últimos 10 dígitos = fator + valor)
    if (digits.length >= 44) {
      const rawVal = digits.slice(-10);
      const numVal = parseInt(rawVal, 10) / 100;
      if (!isNaN(numVal) && numVal > 0 && !billAmount) {
        setBillAmount(numVal.toFixed(2));
      }
    }
  };

  // Inserir Conta do Banco vinculada à conta ativa
  const handleSubmitBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) {
      alert('Selecione uma conta bancária ativa para vincular a conta.');
      return;
    }

    const val = parseFloat(billAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Informe um valor válido maior que zero.');
      return;
    }

    if (!billSupplier.trim()) {
      alert('Informe o fornecedor / cedente do boleto.');
      return;
    }

    if (onAddExpenseFromBankBill) {
      onAddExpenseFromBankBill({
        supplier: billSupplier.trim(),
        description: billDescription.trim() || `Boleto Bancário - ${billSupplier.trim()}`,
        amount: val,
        dueDate: billDueDate,
        categoryName: billCategory,
        categoryId: categories.find((c) => c.name === billCategory)?.id || 'cat_default',
        status: 'pendente',
        paymentMethod: 'boleto',
        bankAccountId: activeAccount.id,
        bankAccountName: activeAccount.name,
        invoiceNumber: billBarcode.slice(0, 15) || undefined,
        notes: billBarcode ? `Linha Digitável / Código de Barras: ${billBarcode}` : undefined,
      });
    }

    setIsBillModalOpen(false);
    setBillBarcode('');
    setBillSupplier('');
    setBillDescription('');
    setBillAmount('');
    setImportNotification(`Conta de ${formatCurrencyBRL(val)} inserida e vinculada com sucesso à conta ${activeAccount.name}!`);
    setTimeout(() => setImportNotification(null), 5000);
  };

  // Upload e Parse de Extrato Bancário (OFX / CSV)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAccount) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const transactionsToImport: Omit<BankTransaction, 'id' | 'createdAt'>[] = [];

      try {
        if (file.name.toLowerCase().endsWith('.ofx')) {
          // Parser simples de OFX bancário (STMTTRN)
          const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
          let match;
          while ((match = trnRegex.exec(content)) !== null) {
            const block = match[1];
            const typeMatch = block.match(/<TRNTYPE>([A-Z]+)/i);
            const dateMatch = block.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/i);
            const amountMatch = block.match(/<TRNAMT>([-\d.,]+)/i);
            const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i);

            if (amountMatch && dateMatch) {
              const rawAmt = parseFloat(amountMatch[1].replace(',', '.'));
              const isCredit = rawAmt > 0 || typeMatch?.[1] === 'CREDIT';
              const amt = Math.abs(rawAmt);
              const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
              const memo = memoMatch ? memoMatch[1].trim() : 'Lançamento Bancário OFX';

              transactionsToImport.push({
                bankAccountId: activeAccount.id,
                bankAccountName: activeAccount.name,
                date: dateStr,
                description: memo,
                type: isCredit ? 'entrada' : 'saida',
                amount: amt,
                category: isCredit ? 'Receitas / Créditos' : 'Débitos / Lançamentos Bancários',
                sourceType: 'ofx',
              });
            }
          }
        } else {
          // Parser de CSV bancário (Data, Descrição, Valor)
          const lines = content.split('\n');
          lines.forEach((line) => {
            const parts = line.split(/[;,]/);
            if (parts.length >= 3) {
              const dStr = parts[0].trim().replace(/"/g, '');
              const desc = parts[1].trim().replace(/"/g, '');
              const valStr = parts[2].trim().replace(/"/g, '').replace('R$', '').trim();
              const valNum = parseFloat(valStr.replace(/\./g, '').replace(',', '.'));

              if (!isNaN(valNum) && valNum !== 0 && desc && dStr) {
                // Converte data dd/mm/aaaa para aaaa-mm-dd
                let formattedDate = dStr;
                if (dStr.includes('/')) {
                  const [day, month, year] = dStr.split('/');
                  if (day && month && year) {
                    formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  }
                }

                transactionsToImport.push({
                  bankAccountId: activeAccount.id,
                  bankAccountName: activeAccount.name,
                  date: formattedDate,
                  description: desc,
                  type: valNum > 0 ? 'entrada' : 'saida',
                  amount: Math.abs(valNum),
                  category: 'Importação Extrato CSV',
                  sourceType: 'manual',
                });
              }
            }
          });
        }

        if (transactionsToImport.length > 0 && onImportBankTransactions) {
          onImportBankTransactions(transactionsToImport);
          setImportNotification(`Sucesso! ${transactionsToImport.length} movimentações importadas diretamente para a conta ${activeAccount.name}.`);
        } else {
          setImportNotification('Arquivo processado, mas nenhum lançamento reconhecido. Verifique se o formato é OFX ou CSV padrão bancário.');
        }
      } catch (err) {
        console.error('Erro ao processar arquivo bancário:', err);
        setImportNotification('Erro ao processar o arquivo bancário. Tente novamente com um arquivo OFX válido.');
      }

      setTimeout(() => setImportNotification(null), 6000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // Confirmar vinculação em lote de despesas pendentes à conta ativa
  const handleConfirmBatchLink = () => {
    if (!activeAccount || selectedExpenseIds.length === 0) return;

    if (onLinkExpensesToAccount) {
      onLinkExpensesToAccount(selectedExpenseIds, activeAccount.id);
      setImportNotification(`${selectedExpenseIds.length} conta(s) a pagar vinculada(s) com sucesso à conta ${activeAccount.name}!`);
      setTimeout(() => setImportNotification(null), 5000);
    }

    setSelectedExpenseIds([]);
    setIsLinkBatchModalOpen(false);
  };

  return (
    <div 
      id="card-integracao-contas-banco"
      className="bg-white rounded-xl border border-stone-200 shadow-2xs px-3 py-1.5 sm:px-3.5 sm:py-2 text-black transition-all"
    >
      {/* Notificação Temporária de Ações */}
      {importNotification && (
        <div className="mb-1.5 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-lg text-xs text-emerald-900 font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{importNotification}</span>
        </div>
      )}

      {/* BARRA HORIZONTAL COMPACTA ÚNICA */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2">
        {/* Esquerda: Identificação e Seletor de Conta Vinculada */}
        <div className="flex items-center space-x-2 min-w-0">
          {/* Logo pequeno da conta selecionada ou ícone geral */}
          {activeAccount ? (
            <div 
              className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs overflow-hidden"
              style={{ backgroundColor: activeAccount.color || '#0963cb' }}
              title={`${activeAccount.name} (${activeAccount.bankName})`}
            >
              <BankLogoIcon code={activeAccount.bankCode} name={activeAccount.bankName} size={14} className="text-white" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-md bg-[#0963cb] text-white flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Rótulo e Seletor CONTA VINCULADA */}
          <div className="flex items-center space-x-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 shrink-0">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider whitespace-nowrap">
              Conta Vinculada:
            </span>
            {accounts.length > 0 ? (
              <select
                id="select-conta-vinculada-card"
                value={activeAccountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="font-bold text-xs text-stone-900 bg-transparent outline-none cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.bankName})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-stone-400 font-semibold">Nenhuma conta</span>
            )}
          </div>

          {/* Saldo da Conta Selecionada em badge sutil */}
          {activeAccount && (
            <div className="hidden xl:flex items-center space-x-1.5 text-xs text-stone-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/80">
              <span className="text-[9.5px] text-stone-400 font-bold uppercase">Saldo:</span>
              <strong className={`font-black text-xs font-['Outfit'] ${activeAccount.balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {formatCurrencyBRL(activeAccount.balance)}
              </strong>
            </div>
          )}
        </div>

        {/* Direita: 3 Botões de Ação Dispostos Lado a Lado em Linha Horizontal */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* AÇÃO 1: Inserir Boleto */}
          <button
            type="button"
            id="btn-inserir-boleto-banco"
            onClick={() => setIsBillModalOpen(true)}
            disabled={!activeAccount}
            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0963cb] border border-blue-200/80 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 disabled:opacity-50"
            title="Inserir boleto ou conta a pagar neste banco"
          >
            <Barcode className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Inserir Boleto</span>
          </button>

          {/* AÇÃO 2: Importar Extrato */}
          <label 
            htmlFor="input-arquivo-extrato-card"
            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-lg text-xs font-black transition cursor-pointer active:scale-95"
            title="Importar extrato bancário OFX/CSV"
          >
            <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Importar Extrato</span>
          </label>
          <input
            id="input-arquivo-extrato-card"
            ref={fileInputRef}
            type="file"
            accept=".ofx,.csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* AÇÃO 3: Vincular Contas */}
          <button
            type="button"
            id="btn-vincular-contas-lote"
            onClick={() => setIsLinkBatchModalOpen(true)}
            disabled={!activeAccount}
            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 disabled:opacity-50"
            title="Vincular contas a pagar existentes a este banco"
          >
            <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Vincular Contas</span>
            {linkedExpenses.length > 0 && (
              <span className="bg-purple-200 text-purple-950 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                {linkedExpenses.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* MODAL 1: INSERIR CONTA / BOLETO DO BANCO VINCULADO */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto backdrop-blur-xs animate-in fade-in" style={{ backgroundColor: 'rgba(9, 99, 203, 0.45)' }}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-300 my-auto flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 flex items-center justify-between text-white shrink-0" style={{ backgroundColor: '#0963cb' }}>
              <div className="flex items-center space-x-2.5">
                <Barcode className="w-5 h-5" />
                <h4 className="font-black text-sm sm:text-base">Inserir Conta / Boleto do Banco</h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsBillModalOpen(false)} 
                className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBill} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 text-black">
              {/* Informação da conta vinculada */}
              {activeAccount && (
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 flex items-center space-x-2 text-xs font-bold text-blue-900">
                  <BankLogoIcon code={activeAccount.bankCode} name={activeAccount.bankName} size={20} />
                  <span>Vinculação Direta com a Conta: <strong>{activeAccount.name} ({activeAccount.bankName})</strong></span>
                </div>
              )}

              {/* Código de barras / Linha digitável */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Linha Digitável / Código de Barras do Boleto
                </label>
                <input
                  type="text"
                  value={billBarcode}
                  onChange={(e) => handleBarcodeChange(e.target.value)}
                  placeholder="Cole ou digite a linha digitável do boleto bancário..."
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                />
              </div>

              {/* Fornecedor / Cedente */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Fornecedor / Beneficiário <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={billSupplier}
                  onChange={(e) => setBillSupplier(e.target.value)}
                  placeholder="Ex: Cooperativa de Insumos, Concessionária de Energia..."
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Descrição da Despesa
                </label>
                <input
                  type="text"
                  value={billDescription}
                  onChange={(e) => setBillDescription(e.target.value)}
                  placeholder="Ex: Adubo NPK 20-05-20 / Parcela 1..."
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                />
              </div>

              {/* Valor e Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Valor do Título (R$) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-xs sm:text-sm font-black bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Data de Vencimento <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs"
                  />
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Categoria de Despesa
                </label>
                <select
                  value={billCategory}
                  onChange={(e) => setBillCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold bg-white text-black border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0963cb] outline-hidden shadow-2xs cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  <option value="Insumos Agrícolas">Insumos Agrícolas</option>
                  <option value="Combustível">Combustível</option>
                  <option value="Manutenção">Manutenção de Máquinas</option>
                  <option value="Geral">Geral</option>
                </select>
              </div>

              {/* Botões */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                >
                  Confirmar Inserção e Vinculação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VINCULAR CONTAS A PAGAR EXISTENTES EM LOTE */}
      {isLinkBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto backdrop-blur-xs animate-in fade-in" style={{ backgroundColor: 'rgba(9, 99, 203, 0.45)' }}>
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-300 my-auto flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 flex items-center justify-between text-white shrink-0" style={{ backgroundColor: '#0963cb' }}>
              <div className="flex items-center space-x-2.5">
                <Layers className="w-5 h-5" />
                <h4 className="font-black text-sm sm:text-base">Vincular Contas a Pagar em Lote</h4>
              </div>
              <button 
                type="button" 
                onClick={() => setIsLinkBatchModalOpen(false)} 
                className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 text-black">
              {activeAccount && (
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs font-bold text-purple-900 flex items-center space-x-2">
                  <Landmark className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Selecione as despesas pendentes que serão debitadas da conta: <strong>{activeAccount.name} ({activeAccount.bankName})</strong></span>
                </div>
              )}

              {pendingExpenses.length === 0 ? (
                <div className="py-8 text-center text-stone-500 font-medium text-xs">
                  Nenhuma conta a pagar pendente encontrada no momento.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {pendingExpenses.map((exp) => {
                    const isSelected = selectedExpenseIds.includes(exp.id);
                    const isAlreadyLinked = exp.bankAccountId === activeAccount?.id;

                    return (
                      <label
                        key={exp.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${isSelected ? 'bg-blue-50 border-[#0963cb]' : 'bg-stone-50/60 border-stone-200 hover:bg-stone-100/60'}`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedExpenseIds((prev) => [...prev, exp.id]);
                              } else {
                                setSelectedExpenseIds((prev) => prev.filter((id) => id !== exp.id));
                              }
                            }}
                            className="w-4 h-4 text-[#0963cb] rounded focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <div className="font-black text-black text-xs">
                              {exp.supplier || 'Fornecedor'}
                            </div>
                            <div className="text-[11px] text-stone-500">
                              {exp.description} • Venc: {formatDateBR(exp.dueDate || exp.date || '')}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-black text-black text-xs font-['Outfit']">
                            {formatCurrencyBRL(exp.amount)}
                          </div>
                          {isAlreadyLinked && (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                              Já Vinculada
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                <span className="text-xs text-stone-600 font-bold">
                  {selectedExpenseIds.length} conta(s) selecionada(s)
                </span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsLinkBatchModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBatchLink}
                    disabled={selectedExpenseIds.length === 0}
                    className="px-5 py-2 text-xs font-black rounded-xl bg-[#0963cb] hover:bg-blue-700 text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  >
                    Vincular à Conta
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
