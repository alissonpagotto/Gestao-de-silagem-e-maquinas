import React, { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Wrench,
  AlertTriangle,
  Search,
  Download,
  DollarSign,
} from 'lucide-react';
import {
  CaixaFerramentaVeiculoRecord,
  CompanyProfile,
  Employee,
  InventoryItem,
  Machinery,
} from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { fetchCaixaFerramentasVeiculo } from '../../lib/supabaseService';
import {
  getCaixaMetaMap,
  resolveCaixaItemMeta,
  resolveInventoryUnitCost,
} from '../../lib/toolKitsStorage';
import {
  buildEstoqueFerramentasReport,
  EstoqueReportRow,
  FerramentaCaixaResumoRow,
  ReportPrintConfig,
} from './reportPrintBuilders';

interface ReportsEstoqueFerramentasTabProps {
  inventory: InventoryItem[];
  machineries: Machinery[];
  employees: Employee[];
  companyProfile: CompanyProfile;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

export const ReportsEstoqueFerramentasTab: React.FC<ReportsEstoqueFerramentasTabProps> = ({
  inventory = [],
  machineries = [],
  employees = [],
  companyProfile,
  onRegisterPrintGetter,
}) => {
  const [mode, setMode] = useState<'estoque' | 'ferramentas'>('estoque');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [caixaItems, setCaixaItems] = useState<CaixaFerramentaVeiculoRecord[]>([]);

  useEffect(() => {
    let active = true;
    fetchCaixaFerramentasVeiculo()
      .then((rows) => {
        if (active && Array.isArray(rows)) setCaixaItems(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const estoqueCategories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((it) => {
      if (it.category || it.categoria) set.add(String(it.category || it.categoria));
    });
    return Array.from(set).sort();
  }, [inventory]);

  const estoqueRows = useMemo<EstoqueReportRow[]>(() => {
    const term = searchTerm.toLowerCase().trim();
    return inventory
      .filter((it) => {
        const cat = String(it.category || it.categoria || 'Geral');
        if (categoryFilter !== 'todos' && cat !== categoryFilter) return false;
        if (term) {
          const hay = `${it.code || it.codigo_produto || ''} ${it.name || it.nome_comercial || ''} ${cat} ${it.location || it.localizacao_fisica || ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .map((it) => {
        const qty = Number(it.quantity ?? it.quantidade_atual ?? 0);
        const minQty = Number(it.minQuantity ?? 0);
        const unitCost = resolveInventoryUnitCost(it);
        const totalValue = Number((qty * unitCost).toFixed(2));
        return {
          id: it.id,
          code: String(it.code || it.codigo_produto || '-'),
          name: String(it.name || it.nome_comercial || it.nome || 'Produto'),
          category: String(it.category || it.categoria || 'Geral'),
          unit: String(it.unit || it.unidade_medida || 'UN'),
          quantity: qty,
          minQuantity: minQty,
          unitCost,
          totalValue,
          location: String(it.location || it.localizacao_fisica || '-'),
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [inventory, categoryFilter, searchTerm]);

  const ferramentaRows = useMemo<FerramentaCaixaResumoRow[]>(() => {
    const metaMap = getCaixaMetaMap();
    const byVehicle = new Map<
      string,
      {
        veiculoId: string;
        veiculoLabel: string;
        placa: string;
        responsavel: string;
        itensQtd: number;
        pecasTotais: number;
        valorTotal: number;
        divergencias: number;
        ultimaConferencia: string;
      }
    >();

    caixaItems.forEach((item) => {
      const vid = String(item.veiculo_id || 'sem_veiculo');
      const matchedVeh = machineries.find((m) => m.id === vid || m.licensePlateOrSerial === item.veiculo_placa);
      const driverName =
        matchedVeh?.operatorOrDriver ||
        employees.find((e) => e.machineryId === vid || matchedVeh?.assignedDriverIds?.includes(e.id))?.name ||
        item.conferido_por ||
        'Não vinculado';

      const meta = resolveCaixaItemMeta(item, metaMap, inventory);
      const qtyAtual = Number(item.quantidade_atual ?? 0);
      const qtyEsperada = Number(item.quantidade_esperada ?? 1);
      const valorItem = qtyAtual * meta.valor_unitario_efetivo;
      const isDiverg =
        qtyAtual < qtyEsperada ||
        meta.status_conferencia === 'faltando' ||
        meta.status_conferencia === 'danificada';

      const curr = byVehicle.get(vid) || {
        veiculoId: vid,
        veiculoLabel: matchedVeh?.name || matchedVeh?.model || item.veiculo_nome || 'Veículo / Máquina',
        placa: matchedVeh?.licensePlateOrSerial || item.veiculo_placa || '-',
        responsavel: driverName,
        itensQtd: 0,
        pecasTotais: 0,
        valorTotal: 0,
        divergencias: 0,
        ultimaConferencia: item.ultima_conferencia || '',
      };

      curr.itensQtd += 1;
      curr.pecasTotais += qtyAtual;
      curr.valorTotal += valorItem;
      if (isDiverg) curr.divergencias += 1;
      if (item.ultima_conferencia && item.ultima_conferencia > curr.ultimaConferencia) {
        curr.ultimaConferencia = item.ultima_conferencia;
      }

      byVehicle.set(vid, curr);
    });

    const term = searchTerm.toLowerCase().trim();
    return Array.from(byVehicle.values())
      .filter((r) => {
        if (!term) return true;
        const hay = `${r.placa} ${r.veiculoLabel} ${r.responsavel}`.toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => b.valorTotal - a.valorTotal);
  }, [caixaItems, machineries, employees, inventory, searchTerm]);

  const kpis = useMemo(() => {
    const totalEstoqueValor = estoqueRows.reduce((s, r) => s + r.totalValue, 0);
    const totalFerramentasValor = ferramentaRows.reduce((s, r) => s + r.valorTotal, 0);
    const abaixoMinimoCount = estoqueRows.filter(
      (r) => r.quantity <= 0 || (r.minQuantity > 0 && r.quantity <= r.minQuantity)
    ).length;
    return { totalEstoqueValor, totalFerramentasValor, abaixoMinimoCount };
  }, [estoqueRows, ferramentaRows]);

  const printConfig = useMemo(
    () =>
      buildEstoqueFerramentasReport({
        companyProfile,
        mode,
        estoqueRows,
        ferramentaRows,
        totalEstoqueValor: kpis.totalEstoqueValor,
        totalFerramentasValor: kpis.totalFerramentasValor,
        abaixoMinimoCount: kpis.abaixoMinimoCount,
        searchTerm,
      }),
    [companyProfile, mode, estoqueRows, ferramentaRows, kpis, searchTerm]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  const handleExportCsv = () => {
    if (mode === 'estoque') {
      const headers = 'Codigo,Produto,Categoria,Saldo,Unidade,Minimo,Custo_Unit_R$,Total_Imobilizado_R$,Local\n';
      const csvRows = estoqueRows
        .map(
          (r) =>
            `"${r.code}","${r.name}","${r.category}","${r.quantity}","${r.unit}","${r.minQuantity}","${r.unitCost.toFixed(2)}","${r.totalValue.toFixed(2)}","${r.location}"`
        )
        .join('\n');
      const blob = new Blob([headers + csvRows], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `posicao_estoque_almoxarifado.csv`;
      link.click();
      return;
    }

    const headers = 'Placa,Veiculo,Responsavel,Qtd_Itens,Pecas_Totais,Divergencias,Ultima_Conferencia,Patrimonio_R$\n';
    const csvRows = ferramentaRows
      .map(
        (r) =>
          `"${r.placa}","${r.veiculoLabel}","${r.responsavel}","${r.itensQtd}","${r.pecasTotais}","${r.divergencias}","${r.ultimaConferencia}","${r.valorTotal.toFixed(2)}"`
      )
      .join('\n');
    const blob = new Blob([headers + csvRows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `patrimonio_ferramentas_embarcadas.csv`;
    link.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in">
      {/* 1. KPIs */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-emerald-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 flex items-center justify-center shrink-0 border border-black/15">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Imobilizado em Estoque
            </span>
            <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalEstoqueValor)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">{estoqueRows.length} item(ns)</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-sky-700 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 flex items-center justify-center shrink-0 border border-black/15">
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Caixas de Ferramentas (Frota)
            </span>
            <div className="text-sm sm:text-base font-black text-sky-800 dark:text-sky-300 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalFerramentasValor)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">{ferramentaRows.length} veículo(s)</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-teal-700 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 flex items-center justify-center shrink-0 border border-black/15">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Patrimônio Total Almoxarifado
            </span>
            <div className="text-sm sm:text-base font-black text-teal-800 dark:text-teal-300 font-['Outfit'] truncate">
              {formatCurrencyBRL(kpis.totalEstoqueValor + kpis.totalFerramentasValor)}
            </div>
            <div className="text-[10px] text-stone-600 truncate">Estoque + Embarcadas</div>
          </div>
        </div>

        <div className="reports-kpi-card bg-[#e0e6f1] dark:bg-stone-900 rounded-lg py-2 px-3 border border-black dark:border-stone-800 border-l-[3px] border-l-rose-600 shadow-2xs flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 flex items-center justify-center shrink-0 border border-black/15">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 block truncate">
              Itens Abaixo do Mínimo
            </span>
            <div
              className={`text-sm sm:text-base font-black font-['Outfit'] truncate ${
                kpis.abaixoMinimoCount > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {kpis.abaixoMinimoCount} alerta(s)
            </div>
            <div className="text-[10px] text-stone-600 truncate">Saldo zerado ou mínimo</div>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros e Alternador */}
      <div className="shrink-0 reports-filter-bar bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="inline-flex rounded-lg border border-black/40 bg-white dark:bg-stone-800 p-0.5">
            <button
              type="button"
              onClick={() => setMode('estoque')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                mode === 'estoque'
                  ? 'bg-emerald-700 text-white'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-slate-100'
              }`}
            >
              📦 Posição de Estoque
            </button>
            <button
              type="button"
              onClick={() => setMode('ferramentas')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                mode === 'ferramentas'
                  ? 'bg-emerald-700 text-white'
                  : 'text-stone-700 dark:text-stone-300 hover:bg-slate-100'
              }`}
            >
              🧰 Caixas de Ferramentas (Frota)
            </button>
          </div>

          {mode === 'estoque' && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none"
            >
              <option value="todos">Todas Categorias</option>
              {estoqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                mode === 'estoque'
                  ? 'Buscar código, produto ou local...'
                  : 'Buscar placa, veículo ou motorista...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black dark:border-stone-700 bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-800 text-black dark:text-stone-100 text-xs font-bold transition cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>CSV</span>
        </button>
      </div>

      {/* 3. Tabela */}
      <div className="flex-1 min-h-0 bg-white dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg shadow-xs overflow-auto">
        {mode === 'estoque' ? (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-stone-900 dark:text-stone-100 font-black uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3">Código</th>
                <th className="py-2 px-3">Produto / Material</th>
                <th className="py-2 px-3">Categoria</th>
                <th className="py-2 px-3 text-right">Saldo Físico</th>
                <th className="py-2 px-3 text-right">Mínimo</th>
                <th className="py-2 px-3 text-right">Custo Unit.</th>
                <th className="py-2 px-3 text-right">Total Imobilizado</th>
                <th className="py-2 px-3">Localização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {estoqueRows.length > 0 ? (
                estoqueRows.map((row) => {
                  const isLow = row.quantity <= 0 || (row.minQuantity > 0 && row.quantity <= row.minQuantity);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/40">
                      <td className="py-2 px-3 font-mono font-bold text-stone-700 dark:text-stone-300">
                        {row.code}
                      </td>
                      <td className="py-2 px-3 font-bold text-stone-900 dark:text-stone-100">{row.name}</td>
                      <td className="py-2 px-3 text-stone-600">{row.category}</td>
                      <td
                        className={`py-2 px-3 text-right font-extrabold whitespace-nowrap ${
                          isLow ? 'text-rose-700' : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {row.quantity.toLocaleString('pt-BR')} {row.unit}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-500">
                        {row.minQuantity.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {formatCurrencyBRL(row.unitCost)}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-emerald-700 whitespace-nowrap">
                        {formatCurrencyBRL(row.totalValue)}
                      </td>
                      <td className="py-2 px-3 text-stone-600">{row.location}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-stone-500">
                    Nenhum item de estoque encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-stone-900 dark:text-stone-100 font-black uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3">Placa / Prefixo</th>
                <th className="py-2 px-3">Veículo / Máquina</th>
                <th className="py-2 px-3">Responsável</th>
                <th className="py-2 px-3 text-center">Qtd. Itens</th>
                <th className="py-2 px-3 text-center">Peças Totais</th>
                <th className="py-2 px-3 text-center">Divergências</th>
                <th className="py-2 px-3">Últ. Conferência</th>
                <th className="py-2 px-3 text-right">Patrimônio (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {ferramentaRows.length > 0 ? (
                ferramentaRows.map((row) => (
                  <tr key={row.veiculoId} className="hover:bg-slate-50 dark:hover:bg-stone-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-stone-900 dark:text-stone-100">
                      {row.placa}
                    </td>
                    <td className="py-2 px-3 font-bold text-stone-900 dark:text-stone-100">
                      {row.veiculoLabel}
                    </td>
                    <td className="py-2 px-3 text-stone-700 dark:text-stone-300">{row.responsavel}</td>
                    <td className="py-2 px-3 text-center font-semibold">{row.itensQtd}</td>
                    <td className="py-2 px-3 text-center">{row.pecasTotais}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          row.divergencias > 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {row.divergencias > 0 ? `${row.divergencias} pendência(s)` : 'Em dia'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-stone-600">
                      {row.ultimaConferencia ? formatDateBR(row.ultimaConferencia) : 'Não conferida'}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-sky-800 dark:text-sky-300 whitespace-nowrap">
                      {formatCurrencyBRL(row.valorTotal)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-stone-500">
                    Nenhuma caixa de ferramentas embarcada encontrada na frota.
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
