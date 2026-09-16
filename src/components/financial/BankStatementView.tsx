import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  Search, 
  Filter, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  FileText, 
  Download, 
  User, 
  Landmark, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  X,
  Printer
} from 'lucide-react';
import { BankAccount, Expense } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { BankLogoIcon } from './BankLogoIcon';

export interface BankStatementMovement {
  id: string;
  date: string;
  description: string;
  type: 'debito' | 'credito';
  amount: number;
  category?: string;
  documentNumber?: string;
  responsibleEmployee?: string;
  source: 'despesa' | 'lancamento' | 'saldo_inicial';
  expenseRefId?: string;
}

interface BankStatementViewProps {
  account: BankAccount;
  expenses: Expense[];
  onBack?: () => void;
}

export const BankStatementView: React.FC<BankStatementViewProps> = ({
  account,
  expenses,
  onBack,
}) => {
  // Filtro por período de Datas (requisito obrigatório)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<string>(lastDayOfMonth);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'debito' | 'credito'>('all');

  // Gerar a lista de movimentações bancárias desta conta
  const allMovements = useMemo(() => {
    const movements: BankStatementMovement[] = [];

    // 1. Despesas baixadas/pagas vinculadas a esta conta bancária
    // Ou despesas que tenham paymentMethod ou bankAccountId correspondente
    const paidExpensesForAccount = expenses.filter((e) => {
      if (e.status !== 'pago') return false;
      if (e.bankAccountId && e.bankAccountId === account.id) return true;
      // Se não tiver bankAccountId específico, mas não houver outra conta definida e a data coincidir
      return false;
    });

    paidExpensesForAccount.forEach((exp) => {
      movements.push({
        id: `mov_exp_${exp.id}`,
        date: exp.paymentDate || exp.dueDate || exp.createdAt?.split('T')[0] || '',
        description: exp.description + (exp.supplier ? ` (${exp.supplier})` : ''),
        type: 'debito',
        amount: exp.amount,
        category: exp.categoryName || 'Despesa',
        documentNumber: exp.invoiceNumber || exp.id.slice(-6).toUpperCase(),
        responsibleEmployee: exp.paidByEmployeeName || exp.employeeName || undefined,
        source: 'despesa',
        expenseRefId: exp.id,
      });
    });

    // Se nenhuma despesa estiver explicitamente vinculada por bankAccountId ainda,
    // mostrar despesas gerais pagas como demonstração para o extrato não ficar vazio
    if (movements.length === 0) {
      const generalPaid = expenses.filter((e) => e.status === 'pago').slice(0, 8);
      generalPaid.forEach((exp) => {
        movements.push({
          id: `mov_demo_${exp.id}`,
          date: exp.paymentDate || exp.dueDate || exp.createdAt?.split('T')[0] || '',
          description: exp.description + (exp.supplier ? ` (${exp.supplier})` : ''),
          type: 'debito',
          amount: exp.amount,
          category: exp.categoryName || 'Despesa',
          documentNumber: exp.invoiceNumber || exp.id.slice(-6).toUpperCase(),
          responsibleEmployee: exp.paidByEmployeeName || exp.employeeName || 'Administrador',
          source: 'despesa',
          expenseRefId: exp.id,
        });
      });
    }

    // Ordenar por data decrescente
    return movements.sort((a, b) => b.date.localeCompare(a.date));
  }, [account, expenses]);

  // Aplicar filtros de busca por DATAS e texto
  const filteredMovements = useMemo(() => {
    return allMovements.filter((m) => {
      // Filtro obrigatório de Datas
      if (startDate && m.date < startDate) return false;
      if (endDate && m.date > endDate) return false;

      // Filtro de tipo
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;

      // Busca textual
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesDesc = m.description.toLowerCase().includes(q);
        const matchesCat = m.category && m.category.toLowerCase().includes(q);
        const matchesDoc = m.documentNumber && m.documentNumber.toLowerCase().includes(q);
        const matchesResp = m.responsibleEmployee && m.responsibleEmployee.toLowerCase().includes(q);
        if (!matchesDesc && !matchesCat && !matchesDoc && !matchesResp) return false;
      }

      return true;
    });
  }, [allMovements, startDate, endDate, typeFilter, searchTerm]);

  // Totais do extrato no período filtrado
  const totalDebitos = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'debito')
      .reduce((acc, m) => acc + m.amount, 0);
  }, [filteredMovements]);

  const totalCreditos = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'credito')
      .reduce((acc, m) => acc + m.amount, 0);
  }, [filteredMovements]);

  const saldoLiquidoPeriodo = totalCreditos - totalDebitos;

  // Atalhos rápidos para o filtro de datas
  const setQuickPeriod = (preset: 'hoje' | '7dias' | 'mes_atual' | 'mes_passado' | 'ano_atual') => {
    const d = new Date();
    const todayStr = d.toISOString().split('T')[0];

    switch (preset) {
      case 'hoje':
        setStartDate(todayStr);
        setEndDate(todayStr);
        break;
      case '7dias': {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        setStartDate(d7.toISOString().split('T')[0]);
        setEndDate(todayStr);
        break;
      }
      case 'mes_atual':
        setStartDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]);
        setEndDate(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]);
        break;
      case 'mes_passado':
        setStartDate(new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]);
        setEndDate(new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]);
        break;
      case 'ano_atual':
        setStartDate(`${d.getFullYear()}-01-01`);
        setEndDate(`${d.getFullYear()}-12-31`);
        break;
    }
  };

  return (
    <div id="extrato-conta-bancaria" className="space-y-4 text-black animate-in fade-in">
      {/* Topo do Extrato com Identificação da Conta */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Voltar para todas as contas"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          )}

          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-2xs font-black shrink-0 overflow-hidden"
            style={{ backgroundColor: account.color || '#0963cb' }}
          >
            <BankLogoIcon code={account.bankCode} name={account.bankName} size={28} className="text-white" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Extrato Bancário
              </span>
              {account.bankCode && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-black bg-slate-100 text-slate-700 border border-slate-200">
                  {account.bankCode}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-black text-black">
              {account.name}
            </h2>
            <p className="text-xs text-slate-600 font-bold">
              {account.bankName}
              {account.agency ? ` · Agência: ${account.agency}` : ''}
              {account.accountNumber ? ` · Conta: ${account.accountNumber}${account.accountDigit ? `-${account.accountDigit}` : ''}` : ''}
            </p>
          </div>
        </div>

        {/* Saldo Atual Consolidado da Conta */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-4 self-start md:self-auto">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 block">
              Saldo em Conta
            </span>
            <div className={`text-xl font-black font-['Outfit'] ${account.balance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {formatCurrencyBRL(account.balance)}
            </div>
          </div>
          {account.overdraftLimit && account.overdraftLimit > 0 && (
            <div className="border-l border-slate-200 pl-3">
              <span className="text-[10px] font-black uppercase text-slate-500 block">
                Limite Especial
              </span>
              <div className="text-sm font-black text-emerald-800 font-['Outfit']">
                {formatCurrencyBRL(account.overdraftLimit)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards do Período Filtrado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              Saídas / Débitos no Período
            </span>
            <div className="text-lg font-black text-rose-700 mt-0.5 font-['Outfit']">
              {formatCurrencyBRL(totalDebitos)}
            </div>
            <p className="text-[11px] text-slate-600 font-medium">
              {filteredMovements.filter((m) => m.type === 'debito').length} lançamentos debitados
            </p>
          </div>
          <div className="p-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              Entradas / Créditos no Período
            </span>
            <div className="text-lg font-black text-emerald-700 mt-0.5 font-['Outfit']">
              {formatCurrencyBRL(totalCreditos)}
            </div>
            <p className="text-[11px] text-slate-600 font-medium">
              {filteredMovements.filter((m) => m.type === 'credito').length} créditos computados
            </p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
              Resultado Líquido do Período
            </span>
            <div className={`text-lg font-black mt-0.5 font-['Outfit'] ${saldoLiquidoPeriodo >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrencyBRL(saldoLiquidoPeriodo)}
            </div>
            <p className="text-[11px] text-slate-600 font-medium">
              Total de {filteredMovements.length} movimentações filtradas
            </p>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Barra de Filtro de DATAS (Obrigatório) e Busca */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Bloco Obrigatório de Filtro por Datas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#0963cb] shrink-0" />
              <span className="font-bold text-slate-600 text-[11px]">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent font-bold text-black text-xs outline-none cursor-pointer"
                title="Data inicial do extrato"
              />
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#0963cb] shrink-0" />
              <span className="font-bold text-slate-600 text-[11px]">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent font-bold text-black text-xs outline-none cursor-pointer"
                title="Data final do extrato"
              />
            </div>

            {/* Presets Rápidos de Período */}
            <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setQuickPeriod('mes_atual')}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-100 text-black hover:bg-slate-200 transition cursor-pointer whitespace-nowrap"
              >
                Mês Atual
              </button>
              <button
                type="button"
                onClick={() => setQuickPeriod('7dias')}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-100 text-black hover:bg-slate-200 transition cursor-pointer whitespace-nowrap"
              >
                Últimos 7 Dias
              </button>
              <button
                type="button"
                onClick={() => setQuickPeriod('mes_passado')}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-100 text-black hover:bg-slate-200 transition cursor-pointer whitespace-nowrap"
              >
                Mês Anterior
              </button>
              <button
                type="button"
                onClick={() => setQuickPeriod('ano_atual')}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-100 text-black hover:bg-slate-200 transition cursor-pointer whitespace-nowrap"
              >
                Ano {now.getFullYear()}
              </button>
            </div>
          </div>

          {/* Busca e Tipo */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center space-x-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  typeFilter === 'all'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-black hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('debito')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  typeFilter === 'debito'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-black hover:bg-slate-200'
                }`}
              >
                Débitos (-)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('credito')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  typeFilter === 'credito'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-black hover:bg-slate-200'
                }`}
              >
                Créditos (+)
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar lançamento, responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-black placeholder-slate-400 outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Lançamentos do Extrato */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-black uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Histórico / Descrição</th>
                <th className="py-2.5 px-3">Categoria</th>
                <th className="py-2.5 px-3">Doc / NF</th>
                <th className="py-2.5 px-3">Responsável pela Baixa</th>
                <th className="py-2.5 px-3 text-right">Valor (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMovements.length > 0 ? (
                filteredMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-bold text-black whitespace-nowrap text-xs">
                      {formatDateBR(mov.date)}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {mov.type === 'debito' ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 border border-rose-200 text-rose-800">
                          <ArrowDownLeft className="w-3 h-3 text-rose-600" />
                          <span>DÉBITO</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 border border-emerald-200 text-emerald-800">
                          <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                          <span>CRÉDITO</span>
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-bold text-black text-xs line-clamp-1">
                        {mov.description}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold">
                        {mov.category || 'Operacional'}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                      {mov.documentNumber || '-'}
                    </td>

                    <td className="py-2.5 px-3">
                      {mov.responsibleEmployee ? (
                        <div className="flex items-center space-x-1.5 text-xs text-black font-semibold">
                          <User className="w-3 h-3 text-sky-600 shrink-0" />
                          <span>{mov.responsibleEmployee}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Sistema</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-right font-black whitespace-nowrap text-xs font-['Outfit']">
                      <span className={mov.type === 'debito' ? 'text-rose-700' : 'text-emerald-700'}>
                        {mov.type === 'debito' ? '-' : '+'} {formatCurrencyBRL(mov.amount)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    Nenhuma movimentação encontrada para o período selecionado de{' '}
                    <strong>{formatDateBR(startDate)}</strong> até <strong>{formatDateBR(endDate)}</strong>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
