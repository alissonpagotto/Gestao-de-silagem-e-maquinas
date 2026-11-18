import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Printer,
  Search,
  Landmark,
  ShieldCheck,
} from 'lucide-react';
import { Machinery, CompanyProfile } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';
import { PrintPreviewModal } from '../common/PrintPreviewModal';
import {
  CompetenceSelector,
  getPrevCompetence,
  getNextCompetence,
} from '../financial/CompetenceSelector';
import {
  buildAtivoImobilizadoReport,
  ReportPrintConfig,
} from './reportPrintBuilders';

interface ReportsAtivoImobilizadoTabProps {
  machineries: Machinery[];
  companyProfile: CompanyProfile;
  startDate?: string;
  endDate?: string;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
  onOpenPrintModal?: (config: ReportPrintConfig) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

export const ReportsAtivoImobilizadoTab: React.FC<ReportsAtivoImobilizadoTabProps> = ({
  machineries = [],
  companyProfile,
  startDate = '',
  competence,
  onCompetenceChange,
  onOpenPrintModal,
  onRegisterPrintGetter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [filterOwnership, setFilterOwnership] = useState<string>('todos');
  const [filterStatus] = useState<string>('todos');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const activeCompetence = useMemo(() => {
    if (competence) return competence;
    if (startDate && startDate.length >= 7) {
      const [y, m] = startDate.split('-');
      return `${m}/${y}`;
    }
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence, startDate]);

  const handlePrev = () => {
    onCompetenceChange?.(getPrevCompetence(activeCompetence));
  };

  const handleNext = () => {
    onCompetenceChange?.(getNextCompetence(activeCompetence));
  };

  const filteredVehicles = useMemo(() => {
    return machineries.filter((v) => {
      const matchesSearch =
        !searchTerm.trim() ||
        (v.name && String(v.name ?? '').toLowerCase().includes(String(searchTerm ?? '').toLowerCase())) ||
        (v.model && String(v.model ?? '').toLowerCase().includes(String(searchTerm ?? '').toLowerCase())) ||
        (v.brand && String(v.brand ?? '').toLowerCase().includes(String(searchTerm ?? '').toLowerCase())) ||
        (v.licensePlateOrSerial && String(v.licensePlateOrSerial ?? '').toLowerCase().includes(String(searchTerm ?? '').toLowerCase())) ||
        (v.fleetNumber && String(v.fleetNumber ?? '').toLowerCase().includes(String(searchTerm ?? '').toLowerCase())) ||
        (v.renavam && String(v.renavam ?? '').toLowerCase().includes(String(searchTerm ?? '').toLowerCase()));

      const matchesCat = filterCategory === 'todos' || v.categoryType === filterCategory;
      const matchesOwnership = filterOwnership === 'todos' || v.ownership === filterOwnership;
      const matchesStatus = filterStatus === 'todos' || v.status === filterStatus;

      return matchesSearch && matchesCat && matchesOwnership && matchesStatus;
    });
  }, [machineries, searchTerm, filterCategory, filterOwnership, filterStatus]);

  const metrics = useMemo(() => {
    let capitalTotalFipe = 0;
    let capitalTotalCompra = 0;
    let totalIpvaProjetado = 0;
    let totalLicenciamento = 0;
    let totalLicenciamentosPendentes = 0;
    let ipvaLancadosCount = 0;
    let ipvaPendentesCount = 0;

    machineries.forEach((v) => {
      const fipe = v.fipeValue || 0;
      const compra = v.purchaseValue || 0;
      capitalTotalFipe += fipe;
      capitalTotalCompra += compra;

      const baseVenal = v.ipvaBaseValue || 0;
      const rate = v.ipvaRatePercent || 0;
      const ipva = v.ipvaTotalAmount || (baseVenal > 0 && rate > 0 ? baseVenal * (rate / 100) : 0);
      totalIpvaProjetado += ipva;

      if (v.ipvaFinancialStatus === 'lancado') {
        ipvaLancadosCount += 1;
      } else if (ipva > 0) {
        ipvaPendentesCount += 1;
      }

      const lic = v.licensingValue || 0;
      totalLicenciamento += lic;
      if (v.licensingFinancialStatus !== 'lancado' && (v.licensePlateOrSerial || lic > 0)) {
        totalLicenciamentosPendentes += 1;
      }
    });

    const capitalTotalImobilizado = capitalTotalFipe > 0 ? capitalTotalFipe : capitalTotalCompra;

    return {
      capitalTotalImobilizado,
      capitalTotalFipe,
      capitalTotalCompra,
      totalIpvaProjetado,
      totalLicenciamento,
      totalLicenciamentosPendentes,
      ipvaLancadosCount,
      ipvaPendentesCount,
      totalFrota: machineries.length,
    };
  }, [machineries]);

  const filteredTotals = useMemo(() => {
    let fipeSum = 0;
    let ipvaBaseSum = 0;
    let ipvaTotalSum = 0;
    let licSum = 0;

    filteredVehicles.forEach((v) => {
      fipeSum += v.fipeValue || 0;
      ipvaBaseSum += v.ipvaBaseValue || 0;
      const rate = v.ipvaRatePercent || 0;
      const calcIpva = v.ipvaTotalAmount || (v.ipvaBaseValue && rate ? v.ipvaBaseValue * (rate / 100) : 0);
      ipvaTotalSum += calcIpva;
      licSum += v.licensingValue || 0;
    });

    return { fipeSum, ipvaBaseSum, ipvaTotalSum, licSum };
  }, [filteredVehicles]);

  const reportConfig = useMemo(
    () =>
      buildAtivoImobilizadoReport({
        companyProfile,
        filteredVehicles,
        allMachineries: machineries,
        competence: activeCompetence,
        searchTerm,
        filterCategory,
        filterOwnership,
      }),
    [companyProfile, filteredVehicles, machineries, activeCompetence, searchTerm, filterCategory, filterOwnership]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => reportConfig);
  }, [onRegisterPrintGetter, reportConfig]);

  const handlePrintClick = () => {
    if (onOpenPrintModal) {
      onOpenPrintModal(reportConfig);
    } else {
      setIsPrintModalOpen(true);
    }
  };

  return (
    <div className="space-y-2.5 animate-fade-in financial-subtab-clean">
      {/* 1. Três Cards de Resumo Finos e Compactos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5">
        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-[#0963cb] shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#0963cb] flex items-center justify-center shrink-0 border border-black/15">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              CAPITAL TOTAL IMOBILIZADO
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-[#0963cb] font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(metrics.capitalTotalImobilizado)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                {metrics.totalFrota} veículos e máquinas registrados
              </div>
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-amber-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0 border border-black/15">
            <Landmark className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              TOTAL DE IPVA PROJETADO
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-amber-700 dark:text-amber-400 font-['Outfit'] leading-tight truncate">
                {formatCurrencyBRL(metrics.totalIpvaProjetado)}
              </div>
              <div className="text-[10px] text-stone-600 leading-tight flex items-center space-x-1.5 truncate">
                <span className="text-emerald-700 font-bold">{metrics.ipvaLancadosCount} no Financeiro</span>
                <span>•</span>
                <span className="text-amber-700 font-semibold">{metrics.ipvaPendentesCount} a lançar</span>
              </div>
            </div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-500 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0 border border-black/15">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block leading-tight truncate">
              LICENCIAMENTOS PENDENTES
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] leading-tight truncate">
                {metrics.totalLicenciamentosPendentes} <span className="text-xs font-semibold text-stone-600">veículos</span>
              </div>
              <div className="text-[10px] text-stone-600 leading-tight truncate">
                Valor estimado: <strong className="text-stone-800 dark:text-stone-300">{formatCurrencyBRL(metrics.totalLicenciamento)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filtros, Busca, Competência e Impressão */}
      <div className="reports-filter-bar bg-[#cad4e6] dark:bg-stone-900 px-3 py-2 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por placa, modelo, marca ou nº de frota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0963cb]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0963cb]"
          >
            <option value="todos">Todas Categorias</option>
            <option value="forrageira">Forrageira / Ensiladeira</option>
            <option value="caminhao">Caminhão</option>
            <option value="trator">Trator Agrícola</option>
            <option value="reboque">Reboque / Carreta</option>
            <option value="utilitario">Utilitário / Apoio</option>
          </select>

          <select
            value={filterOwnership}
            onChange={(e) => setFilterOwnership(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0963cb]"
          >
            <option value="todos">Todos Regimes</option>
            <option value="proprio">Próprio</option>
            <option value="terceirizado">De Terceiros</option>
            <option value="alugado">Alugado</option>
            <option value="arrendado">Arrendado / Financiado</option>
          </select>

          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          <button
            type="button"
            onClick={handlePrintClick}
            className="py-1.5 px-3 rounded-lg border border-black bg-[#e0e6f1] hover:bg-[#d2dced] text-black text-xs font-bold transition flex items-center space-x-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Printer className="w-3.5 h-3.5 text-black" />
            <span>Imprimir Imobilizado</span>
          </button>
        </div>
      </div>

      {/* 3. Tabela Densa de Ativo Imobilizado com Totalizadores */}
      <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-lg border border-black dark:border-stone-800 shadow-xs overflow-hidden">
        <div className="max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 shadow-sm">
              <tr className="bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700 text-[11px] font-black uppercase text-black dark:text-stone-300 tracking-wider">
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-center w-16">Nº Frota</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 w-28">Placa</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 min-w-[200px]">Veículo / Modelo</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-right">Valor Comercial (FIPE)</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-right">Valor Venal (IPVA)</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-center w-20">Alíquota</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-right">Total IPVA</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-right">Licenc.</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-2.5 px-3 text-center w-28">Status Financeiro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/15 dark:divide-stone-800 text-xs">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-600 dark:text-stone-400 bg-[#e0e6f1] dark:bg-stone-900">
                    Nenhum veículo encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const rate = v.ipvaRatePercent || 0;
                  const calcIpva = v.ipvaTotalAmount || (v.ipvaBaseValue && rate ? v.ipvaBaseValue * (rate / 100) : 0);

                  return (
                    <tr key={v.id} className="even:bg-[#d6deec] odd:bg-[#e0e6f1] dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-[#cad4e6] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                      <td className="py-2 px-3 text-center font-black font-mono text-stone-900 dark:text-stone-100">
                        {v.fleetNumber ? (
                          <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-stone-800 border border-stone-400 dark:border-stone-700">
                            {v.fleetNumber}
                          </span>
                        ) : (
                          <span className="text-stone-400">--</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-black font-mono text-stone-900 dark:text-stone-100">
                        {(v.licensePlateOrSerial || '--').toUpperCase()}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-stone-900 dark:text-stone-100 uppercase">
                          {(v.brand || '').toUpperCase()} {(v.model || v.name || 'Veículo').toUpperCase()}
                        </div>
                        <div className="text-[10px] text-stone-600 flex items-center space-x-1.5 mt-0.5">
                          {v.year && <span>Ano: {v.year}</span>}
                          {v.year && <span>•</span>}
                          <span>{v.categoryType || 'Equipamento'}</span>
                          <span>•</span>
                          <span>{v.ownership === 'proprio' ? 'Próprio' : v.ownership}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-stone-900 dark:text-stone-100">
                        {v.fipeValue ? formatCurrencyBRL(v.fipeValue) : <span className="text-stone-400 font-normal">--</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-stone-700 dark:text-stone-300">
                        {v.ipvaBaseValue ? formatCurrencyBRL(v.ipvaBaseValue) : <span className="text-stone-400 font-normal">--</span>}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-stone-700 dark:text-stone-300">
                        {v.ipvaRatePercent ? `${v.ipvaRatePercent}%` : <span className="text-stone-400 font-normal">--</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-[#0963cb]">
                        {calcIpva > 0 ? formatCurrencyBRL(calcIpva) : <span className="text-stone-400 font-normal">R$ 0,00</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-stone-700 dark:text-stone-300">
                        {v.licensingValue ? formatCurrencyBRL(v.licensingValue) : <span className="text-stone-400 font-normal">--</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {v.ipvaFinancialStatus === 'lancado' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Lançado
                          </span>
                        ) : calcIpva > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Pendente
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-500">Isento / --</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#cad4e6] dark:bg-stone-800/80 border-t-2 border-[#0963cb] text-xs font-black text-stone-900 dark:text-stone-100">
                <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider">
                  Totalizador ({filteredVehicles.length} veículos):
                </td>
                <td className="py-3 px-3 text-right text-[#0963cb] text-sm">
                  {formatCurrencyBRL(filteredTotals.fipeSum)}
                </td>
                <td className="py-3 px-3 text-right text-sm">
                  {formatCurrencyBRL(filteredTotals.ipvaBaseSum)}
                </td>
                <td className="py-3 px-3 text-center">--</td>
                <td className="py-3 px-3 text-right text-[#0963cb] text-sm">
                  {formatCurrencyBRL(filteredTotals.ipvaTotalSum)}
                </td>
                <td className="py-3 px-3 text-right text-sm">
                  {formatCurrencyBRL(filteredTotals.licSum)}
                </td>
                <td className="py-3 px-3 text-center">--</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Fallback local Print Modal caso utilizado de forma isolada */}
      {!onOpenPrintModal && (
        <PrintPreviewModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          options={{
            ...reportConfig,
            company: companyProfile,
          }}
        />
      )}
    </div>
  );
};
