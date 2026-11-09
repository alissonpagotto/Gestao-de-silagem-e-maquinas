import React, { useState, useEffect, useMemo } from 'react';
import { 
  WalletCards, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowUpRight, 
  Landmark, 
  Eye, 
  X, 
  Plus, 
  Calendar, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Undo2, 
  Building2,
  DollarSign,
  User,
  Check,
  AlertCircle
} from 'lucide-react';
import { 
  FinanceiroCheque, 
  BankAccount, 
  CompanyProfile, 
  BankTransaction,
  ChequeStatus
} from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredFinanceiroCheques, 
  saveStoredFinanceiroCheques, 
  getStoredBankAccounts, 
  saveStoredBankAccounts, 
  getStoredBankTransactions, 
  saveStoredBankTransactions, 
  getActiveCompanyId,
  getStoredOrders,
  saveStoredOrders,
  getStoredServices,
  saveStoredServices
} from '../../lib/storage';
import { saveFinanceiroCheque, toValidUUID } from '../../lib/supabaseService';
import { CompetenceSelector, matchesCompetence } from './CompetenceSelector';
import { BankCombobox } from './BankCombobox';

interface ChequesCustodiaTabProps {
  bankAccounts?: BankAccount[];
  companyProfile?: CompanyProfile;
  competenceMonth?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onSaveBankAccounts?: (accounts: BankAccount[]) => void;
}

export const ChequesCustodiaTab: React.FC<ChequesCustodiaTabProps> = ({
  bankAccounts = [],
  companyProfile,
  competenceMonth,
  onPrevMonth,
  onNextMonth,
  onSaveBankAccounts
}) => {
  const today = new Date().toISOString().split('T')[0];

  // Cheques State
  const [cheques, setCheques] = useState<FinanceiroCheque[]>(() => getStoredFinanceiroCheques());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ChequeStatus>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [filterByCompetence, setFilterByCompetence] = useState<boolean>(false);

  // Modals & Feedback
  const [compensatingCheque, setCompensatingCheque] = useState<FinanceiroCheque | null>(null);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [compensationDate, setCompensationDate] = useState<string>(today);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [viewingImageUrl, setViewingImageUrl] = useState<string>('');
  const [isNewChequeModalOpen, setIsNewChequeModalOpen] = useState<boolean>(false);

  // Novo Cheque Avulso Form State
  const [novoBanco, setNovoBanco] = useState('001 - Banco do Brasil');
  const [novoBancoCodigo, setNovoBancoCodigo] = useState('001');
  const [novoNumero, setNovoNumero] = useState('');
  const [novoEmitente, setNovoEmitente] = useState('');
  const [novoDoc, setNovoDoc] = useState('');
  const [novoValor, setNovoValor] = useState<number | ''>('');
  const [novoVencimento, setNovoVencimento] = useState(today);
  const [novoContaDestino, setNovoContaDestino] = useState('');
  const [novoModalError, setNovoModalError] = useState('');

  // Sincroniza lista de cheques com eventos do sistema
  const refreshCheques = () => {
    setCheques(getStoredFinanceiroCheques());
  };

  useEffect(() => {
    refreshCheques();

    const handleUpdate = () => refreshCheques();
    window.addEventListener('financeiro_cheques_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('financeiro_cheques_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Mostra toast com fade-out
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Filtragem dos Cheques
  const filteredCheques = useMemo(() => {
    return cheques.filter(c => {
      // 1. Filtro de Competência (opcional)
      if (filterByCompetence && competenceMonth) {
        if (!matchesCompetence(c.data_vencimento || (c as any).dataVencimento, competenceMonth)) {
          return false;
        }
      }

      // 2. Filtro de Status
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      // 3. Filtro por Conta Bancária de Destino
      if (accountFilter !== 'all') {
        if (c.conta_bancaria_destino_id !== accountFilter && (c as any).contaBancariaDestinoId !== accountFilter) {
          return false;
        }
      }

      // 4. Busca por Texto (Número, Emitente, CPF/CNPJ, Banco)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const num = (c.numero_cheque || (c as any).numeroCheque || '').toLowerCase();
        const emitente = (c.emitente_nome || (c as any).emitenteNome || '').toLowerCase();
        const doc = (c.emitente_documento || (c as any).emitenteDocumento || '').toLowerCase();
        const banco = (c.banco || '').toLowerCase();
        const cliente = (c.cliente_nome || (c as any).clienteNome || '').toLowerCase();

        return (
          num.includes(query) ||
          emitente.includes(query) ||
          doc.includes(query) ||
          banco.includes(query) ||
          cliente.includes(query)
        );
      }

      return true;
    });
  }, [cheques, statusFilter, accountFilter, searchTerm, filterByCompetence, competenceMonth]);

  // Cálculos de Totais para os Cards KPI
  const stats = useMemo(() => {
    let totalCustodia = 0;
    let countCustodia = 0;
    let totalCompensado = 0;
    let countCompensado = 0;
    let totalDevolvido = 0;
    let countDevolvido = 0;

    cheques.forEach(c => {
      const val = Number(c.valor) || 0;
      if (c.status === 'EM_NOSSO_PODER') {
        totalCustodia += val;
        countCustodia++;
      } else if (c.status === 'COMPENSADO') {
        totalCompensado += val;
        countCompensado++;
      } else if (c.status === 'DEVOLVIDO') {
        totalDevolvido += val;
        countDevolvido++;
      }
    });

    return {
      totalCustodia,
      countCustodia,
      totalCompensado,
      countCompensado,
      totalDevolvido,
      countDevolvido,
      totalGeral: totalCustodia + totalCompensado + totalDevolvido,
      countGeral: cheques.length
    };
  }, [cheques]);

  // Atualização em linha da Conta de Destino
  const handleUpdateDestinationAccount = async (cheque: FinanceiroCheque, accountId: string) => {
    try {
      const updated: FinanceiroCheque = {
        ...cheque,
        conta_bancaria_destino_id: accountId,
        contaBancariaDestinoId: accountId,
        updated_at: new Date().toISOString()
      };
      await saveFinanceiroCheque(updated);
      refreshCheques();
      showToast(`Conta de destino do Cheque nº ${cheque.numero_cheque} atualizada!`);
    } catch (err) {
      console.error('Erro ao atualizar conta de destino:', err);
    }
  };

  // Abrir Modal de Compensação / Depósito
  const handleOpenCompensateModal = (cheque: FinanceiroCheque) => {
    setCompensatingCheque(cheque);
    setCompensationDate(today);
    // Pré-seleciona a conta de destino já vinculada ou a primeira da empresa
    const defaultAcc = cheque.conta_bancaria_destino_id || (cheque as any).contaBancariaDestinoId || (bankAccounts[0]?.id || '');
    setTargetAccountId(defaultAcc);
  };

  // Confirmação da Compensação e Liquidação no Saldo Real da Conta
  const handleConfirmCompensate = async () => {
    if (!compensatingCheque) return;
    if (!targetAccountId) {
      alert('Por favor, selecione a Conta Bancária de destino para creditar o valor do cheque.');
      return;
    }

    setIsProcessing(true);
    try {
      const chequeAmount = Number(compensatingCheque.valor) || 0;
      const chqNum = compensatingCheque.numero_cheque || (compensatingCheque as any).numeroCheque || '';
      const emitente = compensatingCheque.emitente_nome || (compensatingCheque as any).emitenteNome || '';
      const targetAcc = bankAccounts.find(a => a.id === targetAccountId);
      const accName = targetAcc ? `${targetAcc.name} (${targetAcc.bankName})` : 'Conta Bancária';

      // 1. Atualiza Status do Cheque para COMPENSADO
      const updatedCheque: FinanceiroCheque = {
        ...compensatingCheque,
        status: 'COMPENSADO',
        conta_bancaria_destino_id: targetAccountId,
        contaBancariaDestinoId: targetAccountId,
        data_compensacao: compensationDate,
        dataCompensacao: compensationDate,
        updated_at: new Date().toISOString()
      };
      await saveFinanceiroCheque(updatedCheque);

      // 2. Credita Saldo Real na Conta Bancária de Destino
      const currentAccounts = getStoredBankAccounts();
      const updatedAccounts = currentAccounts.map(acc => {
        if (acc.id === targetAccountId) {
          return {
            ...acc,
            balance: Number(((Number(acc.balance) || 0) + chequeAmount).toFixed(2)),
            updatedAt: new Date().toISOString()
          };
        }
        return acc;
      });
      saveStoredBankAccounts(updatedAccounts);
      if (onSaveBankAccounts) onSaveBankAccounts(updatedAccounts);

      // 3. Registra Lançamento de Entrada no Extrato Bancário Consolidado
      const currentTx = getStoredBankTransactions();
      const newTx: BankTransaction = {
        id: toValidUUID(),
        bankAccountId: targetAccountId,
        type: 'entrada',
        sourceType: 'receita',
        category: 'Compensação de Cheque',
        description: `Compensação de Cheque nº ${chqNum} - ${emitente} (${compensatingCheque.banco})`,
        amount: chequeAmount,
        date: compensationDate,
        createdAt: new Date().toISOString()
      };
      saveStoredBankTransactions([newTx, ...currentTx]);

      // 4. Se o cheque possui ordem vinculada, marca a respectiva parcela como paga
      if (compensatingCheque.ordem_id) {
        const oId = compensatingCheque.ordem_id;
        const currentOrders = getStoredOrders();
        let orderUpdated = false;
        const newOrders = currentOrders.map(o => {
          if (o.id === oId && o.paymentStatus !== 'pago') {
            orderUpdated = true;
            return {
              ...o,
              paymentStatus: 'pago' as const,
              paidAmount: chequeAmount,
              paymentDate: compensationDate,
              updatedAt: new Date().toISOString()
            };
          }
          return o;
        });
        if (orderUpdated) saveStoredOrders(newOrders);

        const currentServices = getStoredServices();
        let serviceUpdated = false;
        const newServices = currentServices.map(s => {
          if (s.id === oId && s.paymentStatus !== 'pago') {
            serviceUpdated = true;
            return {
              ...s,
              paymentStatus: 'pago' as const,
              status: 'finalizado' as const,
              paidAmount: chequeAmount,
              paymentDate: compensationDate,
              updatedAt: new Date().toISOString()
            };
          }
          return s;
        });
        if (serviceUpdated) saveStoredServices(newServices);
      }

      // Notifica todos os módulos
      refreshCheques();
      window.dispatchEvent(new CustomEvent('financeiro_cheques_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(`Cheque nº ${chqNum} compensado com sucesso! ${formatCurrencyBRL(chequeAmount)} creditado em ${accName}.`);
      setCompensatingCheque(null);

    } catch (err) {
      console.error('Erro ao compensar cheque:', err);
      alert('Ocorreu um erro ao compensar o cheque. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Estornar Compensação (Voltar para Custódia)
  const handleReverseCompensation = async (cheque: FinanceiroCheque) => {
    const confirmAction = window.confirm(
      `Deseja realmente estornar a compensação do Cheque nº ${cheque.numero_cheque}? O valor de ${formatCurrencyBRL(cheque.valor)} será debitado da conta de destino e o cheque voltará para "Em Carteira".`
    );
    if (!confirmAction) return;

    try {
      const chequeAmount = Number(cheque.valor) || 0;
      const accId = cheque.conta_bancaria_destino_id || (cheque as any).contaBancariaDestinoId;

      // 1. Retorna status para EM_NOSSO_PODER
      const updatedCheque: FinanceiroCheque = {
        ...cheque,
        status: 'EM_NOSSO_PODER',
        data_compensacao: undefined,
        dataCompensacao: undefined,
        updated_at: new Date().toISOString()
      };
      await saveFinanceiroCheque(updatedCheque);

      // 2. Debita do saldo da conta se houver conta vinculada
      if (accId) {
        const currentAccounts = getStoredBankAccounts();
        const updatedAccounts = currentAccounts.map(acc => {
          if (acc.id === accId) {
            return {
              ...acc,
              balance: Number(((Number(acc.balance) || 0) - chequeAmount).toFixed(2)),
              updatedAt: new Date().toISOString()
            };
          }
          return acc;
        });
        saveStoredBankAccounts(updatedAccounts);
        if (onSaveBankAccounts) onSaveBankAccounts(updatedAccounts);

        // 3. Registra estorno no extrato
        const currentTx = getStoredBankTransactions();
        const newTx: BankTransaction = {
          id: toValidUUID(),
          bankAccountId: accId,
          type: 'saida',
          sourceType: 'despesa',
          category: 'Estorno de Cheque',
          description: `Estorno de Compensação - Cheque nº ${cheque.numero_cheque} (${cheque.emitente_nome})`,
          amount: chequeAmount,
          date: today,
          createdAt: new Date().toISOString()
        };
        saveStoredBankTransactions([newTx, ...currentTx]);
      }

      refreshCheques();
      window.dispatchEvent(new CustomEvent('financeiro_cheques_updated'));
      window.dispatchEvent(new Event('storage'));
      showToast(`Compensação estornada. Cheque nº ${cheque.numero_cheque} retornou para a carteira.`);

    } catch (err) {
      console.error('Erro ao estornar compensação:', err);
    }
  };

  // Marcar como Devolvido
  const handleMarkAsReturned = async (cheque: FinanceiroCheque) => {
    const confirmAction = window.confirm(
      `Confirmar devolução do Cheque nº ${cheque.numero_cheque}? O status será marcado como DEVOLVIDO.`
    );
    if (!confirmAction) return;

    try {
      const updatedCheque: FinanceiroCheque = {
        ...cheque,
        status: 'DEVOLVIDO',
        updated_at: new Date().toISOString()
      };
      await saveFinanceiroCheque(updatedCheque);
      refreshCheques();
      showToast(`Cheque nº ${cheque.numero_cheque} marcado como DEVOLVIDO.`);
    } catch (err) {
      console.error('Erro ao marcar devolução:', err);
    }
  };

  // Reapresentar Cheque Devolvido
  const handleReopenCheque = async (cheque: FinanceiroCheque) => {
    try {
      const updatedCheque: FinanceiroCheque = {
        ...cheque,
        status: 'EM_NOSSO_PODER',
        updated_at: new Date().toISOString()
      };
      await saveFinanceiroCheque(updatedCheque);
      refreshCheques();
      showToast(`Cheque nº ${cheque.numero_cheque} reapresentado e em carteira!`);
    } catch (err) {
      console.error('Erro ao reapresentar cheque:', err);
    }
  };

  // Salvar Novo Cheque Avulso
  const handleSaveNovoCheque = async () => {
    setNovoModalError('');
    if (!novoBanco.trim()) {
      setNovoModalError('Informe o Banco de Origem do cheque.');
      return;
    }
    if (!novoNumero.trim()) {
      setNovoModalError('Informe o Número da Folha do cheque.');
      return;
    }
    if (!novoEmitente.trim()) {
      setNovoModalError('Informe o Nome do Emitente.');
      return;
    }
    if (!novoValor || Number(novoValor) <= 0) {
      setNovoModalError('Informe um valor válido maior que zero.');
      return;
    }
    if (!novoVencimento) {
      setNovoModalError('Informe a Data de Vencimento.');
      return;
    }

    try {
      const activeCid = toValidUUID(companyProfile?.id || getActiveCompanyId());
      const newCheque: FinanceiroCheque = {
        id: toValidUUID(),
        company_id: activeCid,
        companyId: activeCid,
        banco: novoBanco,
        numero_cheque: novoNumero.trim(),
        numeroCheque: novoNumero.trim(),
        emitente_nome: novoEmitente.trim(),
        emitenteNome: novoEmitente.trim(),
        emitente_documento: novoDoc.trim(),
        emitenteDocumento: novoDoc.trim(),
        data_vencimento: novoVencimento,
        dataVencimento: novoVencimento,
        valor: Number(novoValor),
        conta_bancaria_destino_id: novoContaDestino,
        contaBancariaDestinoId: novoContaDestino,
        status: 'EM_NOSSO_PODER',
        created_at: new Date().toISOString()
      };

      await saveFinanceiroCheque(newCheque);
      refreshCheques();
      setIsNewChequeModalOpen(false);

      // Reseta form
      setNovoNumero('');
      setNovoEmitente('');
      setNovoDoc('');
      setNovoValor('');
      setNovoVencimento(today);

      showToast(`Cheque nº ${newCheque.numero_cheque} cadastrado com sucesso na custódia!`);
    } catch (err: any) {
      setNovoModalError(err.message || 'Erro ao salvar novo cheque.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 p-3.5 bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CARDS KPI SUPERIORES: ESTATÍSTICAS DA CUSTÓDIA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Em Carteira (Custódia Ativa) */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
              Total em Carteira (Custódia)
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              <WalletCards className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-['Outfit'] mt-1.5">
            {formatCurrencyBRL(stats.totalCustodia)}
          </div>
          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-1 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{stats.countCustodia} {stats.countCustodia === 1 ? 'folha pendente' : 'folhas pendentes'}</span>
          </div>
        </div>

        {/* Card 2: Compensados */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
              Total Compensado / Liquidado
            </span>
            <span className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-['Outfit'] mt-1.5">
            {formatCurrencyBRL(stats.totalCompensado)}
          </div>
          <div className="text-[11px] font-bold text-sky-700 dark:text-sky-400 mt-1 flex items-center space-x-1">
            <Check className="w-3.5 h-3.5" />
            <span>{stats.countCompensado} {stats.countCompensado === 1 ? 'cheque compensado' : 'cheques compensados'}</span>
          </div>
        </div>

        {/* Card 3: Devolvidos / Sustados */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
              Devolvidos / Sustados
            </span>
            <span className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-['Outfit'] mt-1.5">
            {formatCurrencyBRL(stats.totalDevolvido)}
          </div>
          <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 mt-1 flex items-center space-x-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{stats.countDevolvido} {stats.countDevolvido === 1 ? 'cheque devolvido' : 'cheques devolvidos'}</span>
          </div>
        </div>

        {/* Card 4: Volume Geral Cadastrado */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
              Volume Total de Cheques
            </span>
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-stone-300">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-['Outfit'] mt-1.5">
            {formatCurrencyBRL(stats.totalGeral)}
          </div>
          <div className="text-[11px] font-bold text-slate-600 dark:text-stone-400 mt-1">
            {stats.countGeral} folhas no histórico
          </div>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS E FILTROS */}
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Busca por texto */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por n° do cheque, emitente, CPF/CNPJ ou banco emissor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Navegador de Competência Opcional */}
          {competenceMonth && (
            <div className="flex items-center space-x-2 shrink-0">
              <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-stone-300 select-none">
                <input
                  type="checkbox"
                  checked={filterByCompetence}
                  onChange={(e) => setFilterByCompetence(e.target.checked)}
                  className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-[11px] uppercase tracking-wide">Filtrar mês:</span>
              </label>

              {filterByCompetence && (
                <CompetenceSelector
                  competence={competenceMonth}
                  onPrev={onPrevMonth || (() => {})}
                  onNext={onNextMonth || (() => {})}
                />
              )}
            </div>
          )}

          {/* Botão Novo Cheque Avulso */}
          <button
            type="button"
            onClick={() => setIsNewChequeModalOpen(true)}
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cheque Avulso</span>
          </button>
        </div>

        {/* Linha de Filtros Rápidos de Status e Conta */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400 mr-1">
              Status:
            </span>
            {[
              { id: 'all', label: `Todos (${cheques.length})` },
              { id: 'EM_NOSSO_PODER', label: `Em Carteira (${stats.countCustodia})` },
              { id: 'COMPENSADO', label: `Compensados (${stats.countCompensado})` },
              { id: 'DEVOLVIDO', label: `Devolvidos (${stats.countDevolvido})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs'
                    : 'bg-white dark:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-700/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
              Conta de Destino:
            </span>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-800 dark:text-stone-200 font-semibold outline-none cursor-pointer"
            >
              <option value="all">Todas as Contas</option>
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.bankName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE CONTROLE E CUSTÓDIA DE CHEQUES */}
      <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-stone-850/90 border-b border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 font-black uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">N° Cheque</th>
                <th className="py-3 px-3.5">Vencimento / Bom Para</th>
                <th className="py-3 px-3.5">Emitente / CPF-CNPJ</th>
                <th className="py-3 px-3.5">Banco de Origem</th>
                <th className="py-3 px-3.5">Valor (R$)</th>
                <th className="py-3 px-3.5 min-w-[220px]">Conta de Destino da Empresa</th>
                <th className="py-3 px-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-stone-800">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-stone-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <WalletCards className="w-8 h-8 text-slate-400 stroke-[1.5]" />
                      <p className="font-semibold text-xs">Nenhum cheque encontrado para os filtros selecionados.</p>
                      <button
                        type="button"
                        onClick={() => { setSearchTerm(''); setStatusFilter('all'); setAccountFilter('all'); }}
                        className="text-[11px] text-emerald-600 font-bold hover:underline cursor-pointer"
                      >
                        Limpar todos os filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCheques.map((c) => {
                  const chqNum = c.numero_cheque || (c as any).numeroCheque || 'S/N';
                  const emitente = c.emitente_nome || (c as any).emitenteNome || 'Não informado';
                  const doc = c.emitente_documento || (c as any).emitenteDocumento || '';
                  const dueDate = c.data_vencimento || (c as any).dataVencimento || '';
                  const isEmCarteira = c.status === 'EM_NOSSO_PODER';
                  const isCompensado = c.status === 'COMPENSADO';
                  const isDevolvido = c.status === 'DEVOLVIDO';
                  const hasImage = Boolean(c.imagem_url || (c as any).imagemUrl);
                  const imageUrl = c.imagem_url || (c as any).imagemUrl || '';

                  // Cheque vencendo hoje ou atrasado
                  const isOverdue = isEmCarteira && dueDate && dueDate < today;
                  const isDueToday = isEmCarteira && dueDate && dueDate === today;

                  return (
                    <tr 
                      key={c.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-stone-850/50 transition"
                    >
                      {/* 1. Status do Cheque */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isEmCarteira && (
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                            isOverdue
                              ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
                              : isDueToday
                                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{isOverdue ? 'Atrasado' : isDueToday ? 'Bom P/ Hoje' : 'Em Carteira'}</span>
                          </span>
                        )}
                        {isCompensado && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-800 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Compensado</span>
                          </span>
                        )}
                        {isDevolvido && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-400 dark:bg-rose-950/60 dark:text-rose-300">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Devolvido</span>
                          </span>
                        )}
                      </td>

                      {/* 2. N° do Cheque */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-black text-slate-900 dark:text-white text-xs">
                            {chqNum}
                          </span>
                          {hasImage && (
                            <button
                              type="button"
                              onClick={() => setViewingImageUrl(imageUrl)}
                              className="p-1 rounded text-sky-700 hover:bg-sky-100 dark:text-sky-400 dark:hover:bg-stone-800 transition cursor-pointer"
                              title="Visualizar Imagem da Folha Física"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 3. Vencimento / Bom Para */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-stone-200">
                          {formatDateBR(dueDate)}
                        </div>
                        {isCompensado && (c.data_compensacao || (c as any).dataCompensacao) && (
                          <span className="text-[10px] text-slate-500 dark:text-stone-400 block">
                            Compensado em: {formatDateBR(c.data_compensacao || (c as any).dataCompensacao)}
                          </span>
                        )}
                      </td>

                      {/* 4. Emitente / CPF-CNPJ */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 dark:text-white truncate max-w-xs">
                          {emitente}
                        </div>
                        {doc && (
                          <span className="text-[11px] text-slate-500 dark:text-stone-400 font-mono block">
                            {doc}
                          </span>
                        )}
                        {c.cliente_nome && c.cliente_nome !== emitente && (
                          <span className="text-[10px] text-slate-400 dark:text-stone-500 block truncate">
                            Ref. Cliente: {c.cliente_nome}
                          </span>
                        )}
                      </td>

                      {/* 5. Banco de Origem */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-stone-200">
                          {c.banco}
                        </span>
                      </td>

                      {/* 6. Valor de Face (R$) */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-black text-slate-900 dark:text-white font-['Outfit'] text-sm">
                          {formatCurrencyBRL(c.valor)}
                        </span>
                      </td>

                      {/* 7. Conta de Destino da Empresa */}
                      <td className="py-3 px-3.5">
                        <select
                          disabled={isCompensado}
                          value={c.conta_bancaria_destino_id || (c as any).contaBancariaDestinoId || ''}
                          onChange={(e) => handleUpdateDestinationAccount(c, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 font-semibold outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 dark:disabled:bg-stone-850 disabled:opacity-70 cursor-pointer"
                        >
                          <option value="">-- Selecione a Conta de Destino --</option>
                          {bankAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.bankName} - Ag: {acc.agency} / Cc: {acc.accountNumber})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 8. Ações */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isEmCarteira && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenCompensateModal(c)}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition cursor-pointer shadow-2xs active:scale-95"
                                title="Depositar e Compensar no Banco de Destino"
                              >
                                <Landmark className="w-3.5 h-3.5" />
                                <span>Depositar / Compensar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleMarkAsReturned(c)}
                                className="p-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-stone-800 transition cursor-pointer"
                                title="Marcar como Devolvido"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {isCompensado && (
                            <button
                              type="button"
                              onClick={() => handleReverseCompensation(c)}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-stone-700 hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-300 font-bold text-xs transition cursor-pointer"
                              title="Estornar Compensação do Cheque"
                            >
                              <Undo2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>Estornar</span>
                            </button>
                          )}

                          {isDevolvido && (
                            <button
                              type="button"
                              onClick={() => handleReopenCheque(c)}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
                              title="Reapresentar Cheque para a Carteira"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Reapresentar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DEPOSITAR / COMPENSAR */}
      {compensatingCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Depositar e Compensar Cheque
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-stone-400">
                    Lançamento automático de crédito na Conta Bancária e Extrato
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompensatingCheque(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumo do Cheque */}
            <div className="bg-slate-50 dark:bg-stone-850 p-3 rounded-xl border border-slate-200 dark:border-stone-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-stone-400 uppercase">Cheque nº:</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-xs">
                  {compensatingCheque.numero_cheque || (compensatingCheque as any).numeroCheque}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-stone-400 uppercase">Emitente:</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  {compensatingCheque.emitente_nome || (compensatingCheque as any).emitenteNome}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-stone-400 uppercase">Banco de Origem:</span>
                <span className="font-semibold text-slate-800 dark:text-stone-200 text-xs">
                  {compensatingCheque.banco}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-stone-700">
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase">Valor a Creditar:</span>
                <span className="text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit']">
                  {formatCurrencyBRL(compensatingCheque.valor)}
                </span>
              </div>
            </div>

            {/* Formulário de Compensação */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-stone-300 mb-1">
                  Conta Bancária de Destino (Onde o valor entrará) <span className="text-rose-600">*</span>
                </label>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">-- Selecione a Conta Bancária --</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bankName} - Saldo Atual: {formatCurrencyBRL(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-stone-300 mb-1">
                  Data da Compensação / Depósito <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={compensationDate}
                  onChange={(e) => setCompensationDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setCompensatingCheque(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmCompensate}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center space-x-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isProcessing ? 'Liquidando...' : 'Confirmar Compensação'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DA IMAGEM DO CHEQUE */}
      {viewingImageUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="relative max-w-3xl w-full bg-white dark:bg-stone-900 p-3 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-stone-800">
              <span className="text-xs font-bold text-slate-800 dark:text-stone-200 uppercase tracking-wide">
                Folha do Cheque Digitalizada
              </span>
              <button
                type="button"
                onClick={() => setViewingImageUrl('')}
                className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl flex items-center justify-center bg-slate-950/20 p-2">
              <img
                src={viewingImageUrl}
                alt="Folha do Cheque Físico"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO CHEQUE AVULSO */}
      {isNewChequeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Novo Cheque na Custódia
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-stone-400">
                    Cadastrar folha recebida em carteira
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChequeModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {novoModalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{novoModalError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Banco de Origem <span className="text-rose-600">*</span>
                  </label>
                  <BankCombobox
                    value={novoBanco}
                    bankCode={novoBancoCodigo}
                    onChange={(bName, bCode) => {
                      setNovoBanco(bName);
                      if (bCode) setNovoBancoCodigo(bCode);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Número do Cheque <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 000421"
                    value={novoNumero}
                    onChange={(e) => setNovoNumero(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Nome do Emitente <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nome de quem assinou"
                    value={novoEmitente}
                    onChange={(e) => setNovoEmitente(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    CPF ou CNPJ do Emitente
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={novoDoc}
                    onChange={(e) => setNovoDoc(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Valor de Face (R$) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={novoValor}
                    onChange={(e) => setNovoValor(parseFloat(e.target.value) || '')}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-black text-sm outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                    Vencimento / "Bom para" <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={novoVencimento}
                    onChange={(e) => setNovoVencimento(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 mb-1">
                  Conta de Destino Prevista
                </label>
                <select
                  value={novoContaDestino}
                  onChange={(e) => setNovoContaDestino(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-800 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">-- Selecione a Conta Bancária --</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bankName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsNewChequeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNovoCheque}
                className="px-4 py-2 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs active:scale-95"
              >
                Salvar Cheque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
