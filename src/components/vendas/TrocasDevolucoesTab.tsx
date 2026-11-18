import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  X,
  Eye,
  Printer,
  Receipt,
  Wallet,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import {
  Client,
  ClienteCredito,
  CompanyProfile,
  TrocaDevolucaoRecord,
  TrocaOperacaoTipo,
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredClienteCreditos,
  getStoredTrocasDevolucoes,
} from '../../lib/storage';
import { CompetenceSelector, matchesCompetence } from '../financial/CompetenceSelector';
import {
  NovaTrocaDevolucaoModal,
  TrocaDevolucaoDetailsModal,
} from './NovaTrocaDevolucaoModal';
import {
  printTrocaDevolucaoA4,
  printTrocaDevolucaoCupom80mm,
} from './trocaDevolucaoPrintUtils';

interface TrocasDevolucoesTabProps {
  clients: Client[];
  companyProfile?: CompanyProfile;
  competenceMonth: string;
  onPrevCompetence: (e?: React.MouseEvent) => void;
  onNextCompetence: (e?: React.MouseEvent) => void;
  onSaveClients?: (clients: Client[]) => void;
}

export const TrocasDevolucoesTab: React.FC<TrocasDevolucoesTabProps> = ({
  clients,
  companyProfile,
  competenceMonth,
  onPrevCompetence,
  onNextCompetence,
  onSaveClients,
}) => {
  const [records, setRecords] = useState<TrocaDevolucaoRecord[]>(() =>
    getStoredTrocasDevolucoes()
  );
  const [creditos, setCreditos] = useState<ClienteCredito[]>(() =>
    getStoredClienteCreditos()
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'todos' | TrocaOperacaoTipo>('todos');

  const [isNovaModalOpen, setIsNovaModalOpen] = useState(false);
  const [selectedDetailsRecord, setSelectedDetailsRecord] =
    useState<TrocaDevolucaoRecord | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    const syncData = () => {
      setRecords(getStoredTrocasDevolucoes());
      setCreditos(getStoredClienteCreditos());
    };
    window.addEventListener('agrocontrol_trocas_updated', syncData);
    window.addEventListener('silagem_cliente_creditos_updated', syncData);
    window.addEventListener('storage', syncData);
    return () => {
      window.removeEventListener('agrocontrol_trocas_updated', syncData);
      window.removeEventListener('silagem_cliente_creditos_updated', syncData);
      window.removeEventListener('storage', syncData);
    };
  }, []);

  useEffect(() => {
    if (!successNotice) return;
    const t = setTimeout(() => setSuccessNotice(null), 5000);
    return () => clearTimeout(t);
  }, [successNotice]);

  // Registros na competência selecionada
  const monthRecords = useMemo(() => {
    return records.filter((r) => matchesCompetence(r.data, competenceMonth));
  }, [records, competenceMonth]);

  // Filtros aplicados na tabela
  const filteredRecords = useMemo(() => {
    const q = String(searchTerm ?? '').trim().toLowerCase();
    return monthRecords.filter((rec) => {
      if (tipoFilter !== 'todos' && rec.tipoOperacao !== tipoFilter) return false;
      if (!q) return true;
      const matchesProto = String(rec?.protocolo ?? '').toLowerCase().includes(q);
      const matchesName = String(rec?.envolvidoNome ?? '').toLowerCase().includes(q);
      const matchesOrig = String(rec?.numeroVendaOuNotaOrigem ?? '').toLowerCase().includes(q);
      const matchesProd =
        (Array.isArray(rec.itensDevolvidos) && rec.itensDevolvidos.some((i) => String(i?.productName ?? '').toLowerCase().includes(q))) ||
        (Array.isArray(rec.itensLevados) && rec.itensLevados.some((i) => String(i?.productName ?? '').toLowerCase().includes(q)));
      return matchesProto || matchesName || matchesOrig || matchesProd;
    });
  }, [monthRecords, tipoFilter, searchTerm]);

  // 3 KPIs do Topo
  const kpis = useMemo(() => {
    const totalDevolvidoMes = monthRecords.reduce(
      (sum, r) => sum + Number(r.totalDevolvido || 0),
      0
    );
    const activeCredits = creditos.filter(
      (c) => String(c.status || '').toUpperCase() === 'DISPONIVEL'
    );
    const totalCreditosAtivos = activeCredits.reduce(
      (sum, c) => sum + Number(c.valor_credito ?? c.valorCredito ?? 0),
      0
    );
    const trocasRealizadasMes = monthRecords.length;
    const trocasDiretasCount = monthRecords.filter(
      (r) => r.tipoOperacao === 'troca_direta'
    ).length;

    return {
      totalDevolvidoMes,
      totalCreditosAtivos,
      activeCreditsCount: activeCredits.length,
      trocasRealizadasMes,
      trocasDiretasCount,
    };
  }, [monthRecords, creditos]);

  const handleSaveSuccess = async (
    newRecord: TrocaDevolucaoRecord,
    shouldAutoPrint: boolean
  ) => {
    setRecords(getStoredTrocasDevolucoes());
    setCreditos(getStoredClienteCreditos());
    const sentToFiscalQueue =
      newRecord.tipoOperacao === 'devolucao_fornecedor' ||
      newRecord.itensDevolvidos.some((i) => i.returnToStock === false);
    setSuccessNotice(
      sentToFiscalQueue
        ? `Operação ${newRecord.protocolo} registrada! Estoque atualizado e item(ns) enviado(s) para Fiscal & Notas → Devoluções & Garantias.`
        : `Operação ${newRecord.protocolo} registrada com sucesso! Estoque e financeiro atualizados.`
    );
    if (shouldAutoPrint) {
      await printTrocaDevolucaoA4(newRecord, companyProfile);
    }
  };

  const getTipoBadge = (tipo: TrocaOperacaoTipo) => {
    switch (tipo) {
      case 'troca_direta':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-sky-50 text-sky-800 border-sky-300 dark:bg-stone-800 dark:text-sky-400 dark:border-stone-700 uppercase whitespace-nowrap">
            Troca Direta
          </span>
        );
      case 'devolucao_cliente':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-300 dark:bg-stone-800 dark:text-amber-400 dark:border-stone-700 uppercase whitespace-nowrap">
            Devolução Cliente
          </span>
        );
      case 'devolucao_fornecedor':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-800 border-rose-300 dark:bg-stone-800 dark:text-rose-400 dark:border-stone-700 uppercase whitespace-nowrap">
            Devolução Fornecedor
          </span>
        );
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden">
      {/* BARRA SUPERIOR: COMPETÊNCIA + BOTÃO PRINCIPAL */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 bg-[#cad4e6] border border-black rounded-lg px-2.5 py-1.5">
        <CompetenceSelector
          competence={competenceMonth}
          onPrev={onPrevCompetence}
          onNext={onNextCompetence}
        />

        <button
          type="button"
          id="btn-nova-troca-devolucao"
          onClick={() => setIsNovaModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider border border-black shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ NOVA TROCA / DEVOLUÇÃO</span>
        </button>
      </div>

      {successNotice && (
        <div className="shrink-0 flex items-center justify-between gap-2 bg-emerald-50 border border-black text-emerald-950 px-3 py-2 rounded-lg text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3 CARDS COMPACTOS NO TOPO */}
      <section
        aria-label="Indicadores de Trocas e Devoluções"
        className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2"
      >
        <div className="border border-black dark:border-stone-700/80 rounded-lg bg-[#e0e6f1] dark:bg-stone-850 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-700 dark:text-stone-400 uppercase tracking-wider">
              Total Devolvido no Mês (R$)
            </span>
            <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {formatCurrencyBRL(kpis.totalDevolvidoMes)}
          </div>
          <span className="text-[10px] text-slate-700 dark:text-stone-400 font-semibold block uppercase">
            Competência {competenceMonth}
          </span>
        </div>

        <div className="border border-black dark:border-stone-700/80 rounded-lg bg-[#e0e6f1] dark:bg-stone-850 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-700 dark:text-stone-400 uppercase tracking-wider">
              Créditos Ativos de Clientes (Vale-Troca)
            </span>
            <Wallet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-400 mt-0.5">
            {formatCurrencyBRL(kpis.totalCreditosAtivos)}
          </div>
          <span className="text-[10px] text-slate-700 dark:text-stone-400 font-semibold block uppercase">
            {kpis.activeCreditsCount} {kpis.activeCreditsCount === 1 ? 'vale ativo' : 'vales ativos'}
          </span>
        </div>

        <div className="border border-black dark:border-stone-700/80 rounded-lg bg-[#e0e6f1] dark:bg-stone-850 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-700 dark:text-stone-400 uppercase tracking-wider">
              Trocas Realizadas
            </span>
            <ArrowLeftRight className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {kpis.trocasRealizadasMes}{' '}
            <span className="text-xs font-semibold text-slate-700 dark:text-stone-400">
              ({kpis.trocasDiretasCount} diretas)
            </span>
          </div>
          <span className="text-[10px] text-slate-700 dark:text-stone-400 font-semibold block uppercase">
            Total histórico: {records.length} operações
          </span>
        </div>
      </section>

      {/* CONTAINER DA TABELA HISTÓRICA */}
      <div className="flex-1 min-h-0 flex flex-col border border-black dark:border-stone-700 rounded-lg bg-[#e0e6f1] dark:bg-stone-900 overflow-hidden">
        {/* BARRA DE BUSCA E FILTRO */}
        <div className="shrink-0 p-2 border-b border-black dark:border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#cad4e6] dark:bg-stone-850">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar protocolo (DEV-...), cliente, fornecedor ou produto..."
              className="w-full pl-8 pr-7 py-1 text-xs bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 rounded text-slate-900 dark:text-white font-semibold placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-600 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative sm:w-56">
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as any)}
              className="w-full appearance-none pl-2.5 pr-7 py-1 text-xs bg-white dark:bg-stone-800 border border-slate-400 dark:border-stone-700 rounded font-bold text-slate-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-slate-600 shadow-2xs cursor-pointer"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="troca_direta">Troca Direta</option>
              <option value="devolucao_cliente">Devolução Cliente</option>
              <option value="devolucao_fornecedor">Devolução Fornecedor</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-slate-500">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* TABELA COM STICKY HEADER & ROLAGEM DEDICADA */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#e0e6f1] dark:bg-stone-900">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black">
              <tr className="border-b border-black dark:border-stone-700 bg-[#cad4e6] dark:bg-stone-800">
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-3 py-1.5 text-[10px] font-black text-slate-900 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap"
                >
                  Data
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-3 py-1.5 text-[10px] font-black text-slate-900 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap"
                >
                  Nº Protocolo
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-3 py-1.5 text-[10px] font-black text-slate-900 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap"
                >
                  Tipo
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-3 py-1.5 text-[10px] font-black text-slate-900 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap"
                >
                  Cliente / Fornecedor
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-3 py-1.5 text-[10px] font-black text-slate-900 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap"
                >
                  Produto(s)
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-3 py-1.5 text-[10px] font-black text-slate-900 dark:text-stone-300 uppercase tracking-wider text-right whitespace-nowrap"
                >
                  Valor (R$)
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-3 py-1.5 text-[10px] font-black text-slate-900 dark:text-stone-300 uppercase tracking-wider whitespace-nowrap"
                >
                  Destino Financeiro
                </th>
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 px-3 py-1.5 text-[10px] font-black text-slate-900 dark:text-stone-300 uppercase tracking-wider text-right whitespace-nowrap"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#e0e6f1] dark:bg-stone-900">
              {filteredRecords.length === 0 ? (
                <tr className="bg-[#e0e6f1]">
                  <td
                    colSpan={8}
                    className="py-8 text-center text-xs font-bold text-slate-700 dark:text-stone-400 uppercase bg-[#e0e6f1]"
                  >
                    Nenhuma troca ou devolução registrada nesta competência
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const firstReturned = rec.itensDevolvidos[0]?.productName || 'Item devolvido';
                  const extraReturned =
                    rec.itensDevolvidos.length > 1
                      ? ` (+${rec.itensDevolvidos.length - 1})`
                      : '';
                  const exchangedSummary =
                    rec.itensLevados && rec.itensLevados.length > 0
                      ? ` → ${rec.itensLevados[0].productName}${
                          rec.itensLevados.length > 1 ? ` (+${rec.itensLevados.length - 1})` : ''
                        }`
                      : '';

                  return (
                    <tr
                      key={rec.id}
                      className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800 transition-colors duration-150 border-b border-black/20 dark:border-stone-800"
                    >
                      <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-stone-300 whitespace-nowrap">
                        {formatDateBR(rec.data)}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {rec.protocolo}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5">
                          {getTipoBadge(rec.tipoOperacao)}
                          {rec.fiscalStatus && (
                            <span
                              className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${
                                rec.fiscalStatus === 'Nota de Devolução Emitida'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : rec.fiscalStatus === 'Descartado pela Empresa'
                                    ? 'bg-stone-100 text-stone-700 border-stone-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              {rec.notaDevolucaoNumber
                                ? `NF-e ${rec.notaDevolucaoNumber}`
                                : rec.fiscalStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                          {rec.envolvidoNome}
                        </div>
                        {rec.numeroVendaOuNotaOrigem && (
                          <div className="text-[10px] text-slate-600 dark:text-stone-400 font-medium">
                            Origem: {rec.numeroVendaOuNotaOrigem}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-900 dark:text-stone-200 max-w-[260px] truncate">
                        <span className="font-semibold">
                          {firstReturned}
                          {extraReturned}
                        </span>
                        {exchangedSummary && (
                          <span className="block text-[10px] font-bold text-sky-800 dark:text-sky-400 truncate">
                            {exchangedSummary}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrencyBRL(rec.totalDevolvido)}
                      </td>
                      <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-stone-200 whitespace-nowrap">
                        {rec.destinoFinanceiroLabel}
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailsRecord(rec)}
                            className="p-1 text-slate-700 hover:text-slate-950 hover:bg-slate-200/70 dark:text-stone-300 dark:hover:text-white dark:hover:bg-stone-800 rounded transition cursor-pointer"
                            title="Visualizar detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printTrocaDevolucaoA4(rec, companyProfile)}
                            className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                            title="Imprimir Comprovante A4"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => printTrocaDevolucaoCupom80mm(rec, companyProfile)}
                            className="p-1 text-sky-700 hover:text-sky-900 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                            title="Imprimir Cupom 80mm"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
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

      {/* MODAL NOVA TROCA / DEVOLUÇÃO */}
      <NovaTrocaDevolucaoModal
        isOpen={isNovaModalOpen}
        onClose={() => setIsNovaModalOpen(false)}
        clients={clients}
        companyProfile={companyProfile}
        onSaveClients={onSaveClients}
        onSuccess={handleSaveSuccess}
      />

      {/* MODAL VISUALIZAR DETALHES */}
      <TrocaDevolucaoDetailsModal
        record={selectedDetailsRecord}
        companyProfile={companyProfile}
        onClose={() => setSelectedDetailsRecord(null)}
      />
    </div>
  );
};

export default TrocasDevolucoesTab;
