import React, { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Search,
  Download,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';
import {
  CaixaOperacional,
  calcularTotaisCaixa,
  getStoredCaixaOperacional,
  getStoredHistoricoCaixas,
  syncCaixaComVendas,
} from '../../lib/caixaStorage';
import {
  CompetenceSelector,
  getNextCompetence,
  getPrevCompetence,
} from '../financial/CompetenceSelector';
import {
  buildCaixaSessoesReport,
  buildIndividualCaixaPrintConfig,
  buildSyntheticSummaryRows,
  CaixaSessionSummaryRow,
  ReportPrintConfig,
  ReportViewMode,
} from './reportPrintBuilders';
import { ReportViewModeToggle } from './ReportViewModeToggle';

interface ReportsCaixaTabProps {
  companyProfile: CompanyProfile;
  startDate: string;
  endDate: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onOpenPrintModal: (config: ReportPrintConfig) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

function toIsoDate(raw?: string): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return '';
}

export const ReportsCaixaTab: React.FC<ReportsCaixaTabProps> = ({
  companyProfile,
  startDate,
  endDate,
  competence,
  onCompetenceChange,
  onOpenPrintModal,
  onRegisterPrintGetter,
}) => {
  const activeCompetence = useMemo(() => {
    if (competence) return competence;
    if (startDate && startDate.length >= 7) {
      const [y, m] = startDate.split('-');
      return `${m}/${y}`;
    }
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence, startDate]);

  const [caixasList, setCaixasList] = useState<CaixaOperacional[]>([]);
  const [selectedCaixaId, setSelectedCaixaId] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ABERTO' | 'FECHADO'>('todos');
  const [periodScope, setPeriodScope] = useState<'todos' | 'periodo'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ReportViewMode>('analitico');
  const [groupBy, setGroupBy] = useState<'operador' | 'status' | 'mes'>('operador');

  const loadCaixas = () => {
    const map = new Map<string, CaixaOperacional>();
    const hist = getStoredHistoricoCaixas();
    hist.forEach((c) => {
      if (c && c.id) {
        map.set(c.id, c);
      }
    });

    const current = getStoredCaixaOperacional();
    if (current && current.id) {
      const resolvedCurrent =
        current.status === 'ABERTO' ? syncCaixaComVendas(current) : current;
      map.set(resolvedCurrent.id, resolvedCurrent);
    }

    const sorted = Array.from(map.values()).sort((a, b) => {
      const da = toIsoDate(a.dataAbertura) || '';
      const db = toIsoDate(b.dataAbertura) || '';
      if (db !== da) return db.localeCompare(da);
      return String(b.id).localeCompare(String(a.id));
    });
    setCaixasList(sorted);
  };

  useEffect(() => {
    loadCaixas();
    const onUpdate = () => loadCaixas();
    window.addEventListener('storage', onUpdate);
    window.addEventListener('agrocontrol_caixa_operacional_updated', onUpdate);
    window.addEventListener('agrocontrol_historico_caixas_updated', onUpdate);
    window.addEventListener('silagem_orders_updated', onUpdate);
    return () => {
      window.removeEventListener('storage', onUpdate);
      window.removeEventListener('agrocontrol_caixa_operacional_updated', onUpdate);
      window.removeEventListener('agrocontrol_historico_caixas_updated', onUpdate);
      window.removeEventListener('silagem_orders_updated', onUpdate);
    };
  }, []);

  const summaryRows = useMemo<CaixaSessionSummaryRow[]>(() => {
    return caixasList.map((caixa) => {
      const totais = calcularTotaisCaixa(caixa);
      const pixCartoes =
        totais.vendasPix +
        totais.vendasDebito +
        totais.vendasCredito +
        totais.vendasCarteiraBoleto;
      const totalEntradas = totais.totalVendasPdv + totais.totalSuprimentos;
      const saldoFinal =
        caixa.status === 'FECHADO'
          ? Number(caixa.valorFechamentoReal ?? totais.saldoAtualDinheiro)
          : totais.saldoAtualDinheiro;

      return {
        caixa,
        id: caixa.id,
        dataHoraAbertura: caixa.dataHoraAbertura || caixa.dataAbertura || '-',
        dataHoraFechamento:
          caixa.status === 'FECHADO'
            ? caixa.dataHoraFechamento || caixa.dataFechamento || '-'
            : 'Em aberto',
        operador: (
          caixa.operadorFechamento ||
          caixa.operador ||
          caixa.operadorAbertura ||
          'ADMINISTRADOR GERAL'
        ).toUpperCase(),
        fundoInicial: totais.saldoInicial,
        dinheiro: totais.vendasDinheiro,
        pixCartoes,
        suprimentos: totais.totalSuprimentos,
        sangrias: totais.totalSangrias,
        totalEntradas,
        saldoFinal,
        diferenca: Number(caixa.diferenca ?? 0),
        status: caixa.status,
      };
    });
  }, [caixasList]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return summaryRows.filter((row) => {
      if (selectedCaixaId !== 'todos' && row.id !== selectedCaixaId) return false;
      if (statusFilter !== 'todos' && row.status !== statusFilter) return false;

      if (periodScope === 'periodo' && startDate && endDate) {
        const openIso = toIsoDate(row.caixa.dataAbertura);
        const closeIso = toIsoDate(row.caixa.dataFechamento);
        const refDate = closeIso || openIso;
        if (refDate && (refDate < startDate || refDate > endDate)) return false;
      }

      if (term) {
        const hay = `${row.id} ${row.operador} ${row.dataHoraAbertura} ${row.dataHoraFechamento} ${row.caixa.observacoes || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [summaryRows, selectedCaixaId, statusFilter, periodScope, startDate, endDate, searchTerm]);

  const kpis = useMemo(() => {
    const abertos = filteredRows.filter((r) => r.status === 'ABERTO').length;
    const fechados = filteredRows.filter((r) => r.status === 'FECHADO').length;
    const totalEntradas = filteredRows.reduce((s, r) => s + r.totalEntradas, 0);
    const totalSangrias = filteredRows.reduce((s, r) => s + r.sangrias, 0);
    const saldoLiquido = filteredRows.reduce((s, r) => s + r.saldoFinal, 0);
    return { abertos, fechados, totalEntradas, totalSangrias, saldoLiquido };
  }, [filteredRows]);

  const groupByLabel = useMemo(() => {
    if (groupBy === 'status') return 'Status do Caixa';
    if (groupBy === 'mes') return 'Mês de Abertura';
    return 'Operador Responsável';
  }, [groupBy]);

  const syntheticRows = useMemo(() => {
    const getKey = (r: CaixaSessionSummaryRow) => {
      if (groupBy === 'status') return r.status === 'ABERTO' ? 'Caixas Abertos' : 'Caixas Fechados';
      if (groupBy === 'mes') {
        const iso = toIsoDate(r.caixa.dataAbertura);
        return iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : 'Sem Data';
      }
      return r.operador || 'ADMINISTRADOR GERAL';
    };
    return buildSyntheticSummaryRows(filteredRows, getKey, (r) => r.saldoFinal, {
      getPaidAmount: (r) => r.totalEntradas,
      getPendingAmount: (r) => r.sangrias,
    });
  }, [filteredRows, groupBy]);

  const printConfig = useMemo(
    () =>
      buildCaixaSessoesReport({
        companyProfile,
        rows: filteredRows,
        startDate: periodScope === 'periodo' ? startDate : '',
        endDate: periodScope === 'periodo' ? endDate : '',
        competence: activeCompetence,
        selectedCaixaId,
        statusFilter,
        searchTerm,
        viewMode,
        groupByLabel,
        syntheticRows,
      }),
    [
      companyProfile,
      filteredRows,
      periodScope,
      startDate,
      endDate,
      activeCompetence,
      selectedCaixaId,
      statusFilter,
      searchTerm,
      viewMode,
      groupByLabel,
      syntheticRows,
    ]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  const handleExportCsv = () => {
    if (viewMode === 'sintetico') {
      const headers = `Agrupamento (${groupByLabel}),Sessoes,Saldo_Final_R$,Ticket_Medio_R$,Participacao_%\n`;
      const rows = syntheticRows
        .map(
          (r) =>
            `"${r.groupKey}","${r.count}","${r.totalAmount.toFixed(2)}","${r.avgTicket.toFixed(2)}","${r.sharePct.toFixed(1)}%"`
        )
        .join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio_caixas_sintetico_${activeCompetence.replace('/', '-')}.csv`;
      link.click();
      return;
    }

    const headers =
      'Numero_Caixa,Abertura,Fechamento,Operador,Fundo_Inicial,Dinheiro,PIX_Cartoes,Suprimentos,Sangrias,Saldo_Final,Status\n';
    const rows = filteredRows
      .map(
        (r) =>
          `"${r.id}","${r.dataHoraAbertura}","${r.dataHoraFechamento}","${r.operador}","${r.fundoInicial.toFixed(2)}","${r.dinheiro.toFixed(2)}","${r.pixCartoes.toFixed(2)}","${r.suprimentos.toFixed(2)}","${r.sangrias.toFixed(2)}","${r.saldoFinal.toFixed(2)}","${r.status}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_situacao_caixas_${activeCompetence.replace('/', '-')}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in">
      {/* 1. Cards de Resumo */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-slate-700 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-stone-800 text-slate-700 flex items-center justify-center shrink-0 border border-black/15">
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Caixas no Período
            </span>
            <div className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit'] truncate">
              {filteredRows.length} sessão(ões)
            </div>
            <div className="text-[10px] text-stone-600 truncate">
              {kpis.abertos} aberto(s) • {kpis.fechados} fechado(s)
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 flex items-center justify-center shrink-0 border border-black/15">
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Total Entradas (Vendas / Supr.)
            </span>
            <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalEntradas)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">PDV, Dinheiro, PIX, Cartões</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 flex items-center justify-center shrink-0 border border-black/15">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Total Sangrias / Saídas
            </span>
            <div className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-400 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalSangrias)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">Retiradas registradas</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-700 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 flex items-center justify-center shrink-0 border border-black/15">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Saldo Líquido em Caixa
            </span>
            <div className="text-sm sm:text-base font-black text-sky-800 dark:text-sky-300 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.saldoLiquido)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">Gaveta física / esperada</div>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros Oficiais */}
      <div className="shrink-0 reports-filter-bar bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {periodScope === 'periodo' && (
            <CompetenceSelector
              competence={activeCompetence}
              onPrev={() => onCompetenceChange?.(getPrevCompetence(activeCompetence))}
              onNext={() => onCompetenceChange?.(getNextCompetence(activeCompetence))}
            />
          )}

          <select
            value={periodScope}
            onChange={(e) => setPeriodScope(e.target.value as 'todos' | 'periodo')}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none"
          >
            <option value="todos">Todo o Histórico de Caixas</option>
            <option value="periodo">Somente Competência {activeCompetence}</option>
          </select>

          <select
            value={selectedCaixaId}
            onChange={(e) => setSelectedCaixaId(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none max-w-[200px]"
          >
            <option value="todos">Todos os Caixas ({caixasList.length})</option>
            {caixasList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} ({c.status})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'todos' | 'ABERTO' | 'FECHADO')}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none"
          >
            <option value="todos">Status: Todos</option>
            <option value="ABERTO">Somente ABERTO</option>
            <option value="FECHADO">Somente FECHADO</option>
          </select>

          <div className="relative flex-1 min-w-[160px] max-w-[240px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar Nº caixa ou operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ReportViewModeToggle
            viewMode={viewMode}
            onChange={setViewMode}
            groupBy={groupBy}
            onGroupByChange={(val) => setGroupBy(val as 'operador' | 'status' | 'mes')}
            groupOptions={[
              { value: 'operador', label: 'Por Operador' },
              { value: 'status', label: 'Por Status' },
              { value: 'mes', label: 'Por Mês' },
            ]}
          />

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black dark:border-stone-700 bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-800 text-black dark:text-stone-100 text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela Principal */}
      <div className="flex-1 min-h-0 bg-white dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg shadow-xs overflow-auto">
        {viewMode === 'sintetico' ? (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-stone-900 dark:text-stone-100 font-black uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3">{groupByLabel}</th>
                <th className="py-2 px-3 text-center">Sessões</th>
                <th className="py-2 px-3 text-right">Entradas (Vendas + Supr.)</th>
                <th className="py-2 px-3 text-right">Sangrias / Saídas</th>
                <th className="py-2 px-3 text-right">Saldo Líquido (R$)</th>
                <th className="py-2 px-3 text-right">Média / Sessão</th>
                <th className="py-2 px-3 text-right">% Part.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {syntheticRows.length > 0 ? (
                syntheticRows.map((row) => (
                  <tr key={row.groupKey} className="hover:bg-slate-50 dark:hover:bg-stone-800/40">
                    <td className="py-2 px-3 font-bold text-stone-900 dark:text-stone-100">{row.groupKey}</td>
                    <td className="py-2 px-3 text-center font-semibold">{row.count}</td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-700">
                      {formatCurrencyBRL(row.paidAmount || 0)}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-rose-700">
                      {formatCurrencyBRL(row.pendingAmount || 0)}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-sky-800 dark:text-sky-300">
                      {formatCurrencyBRL(row.totalAmount)}
                    </td>
                    <td className="py-2 px-3 text-right text-stone-600">{formatCurrencyBRL(row.avgTicket)}</td>
                    <td className="py-2 px-3 text-right font-bold">{row.sharePct.toFixed(1)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-stone-500">
                    Nenhuma sessão de caixa encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-stone-900 dark:text-stone-100 font-black uppercase text-[10px]">
              <tr>
                <th className="py-2 px-2.5">Nº do Caixa</th>
                <th className="py-2 px-2.5">Abertura</th>
                <th className="py-2 px-2.5">Fechamento</th>
                <th className="py-2 px-2.5">Operador</th>
                <th className="py-2 px-2.5 text-right">Fundo Inicial</th>
                <th className="py-2 px-2.5 text-right">Dinheiro</th>
                <th className="py-2 px-2.5 text-right">PIX / Cartões</th>
                <th className="py-2 px-2.5 text-right">Sangrias / Saídas</th>
                <th className="py-2 px-2.5 text-right">Saldo Final</th>
                <th className="py-2 px-2.5 text-center">Status</th>
                <th className="py-2 px-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/40">
                    <td className="py-2 px-2.5 font-mono font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">
                      {row.id}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap text-stone-700 dark:text-stone-300">
                      {row.dataHoraAbertura}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap text-stone-700 dark:text-stone-300">
                      {row.dataHoraFechamento}
                    </td>
                    <td className="py-2 px-2.5 font-semibold text-stone-800 dark:text-stone-200">
                      {row.operador}
                    </td>
                    <td className="py-2 px-2.5 text-right whitespace-nowrap">
                      {formatCurrencyBRL(row.fundoInicial)}
                    </td>
                    <td className="py-2 px-2.5 text-right whitespace-nowrap font-semibold text-emerald-700">
                      {formatCurrencyBRL(row.dinheiro)}
                    </td>
                    <td className="py-2 px-2.5 text-right whitespace-nowrap font-semibold text-sky-700">
                      {formatCurrencyBRL(row.pixCartoes)}
                    </td>
                    <td className="py-2 px-2.5 text-right whitespace-nowrap font-semibold text-rose-700">
                      {formatCurrencyBRL(row.sangrias)}
                    </td>
                    <td className="py-2 px-2.5 text-right whitespace-nowrap font-black text-stone-900 dark:text-stone-100">
                      {formatCurrencyBRL(row.saldoFinal)}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          row.status === 'ABERTO'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                            : 'bg-slate-200 text-slate-700 border-slate-400'
                        }`}
                      >
                        {row.status === 'ABERTO' ? (
                          <Clock className="w-2.5 h-2.5" />
                        ) : (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        )}
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPrintModal(buildIndividualCaixaPrintConfig(row.caixa, companyProfile))
                        }
                        title={`Imprimir comprovante individual do caixa ${row.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-black/40 bg-[#e0e6f1] hover:bg-[#d2dced] text-stone-900 text-[10px] font-bold transition cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Imprimir</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-stone-500">
                    Nenhuma sessão de caixa encontrada. Abra ou feche um caixa no Financeiro / PDV para consultar aqui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
