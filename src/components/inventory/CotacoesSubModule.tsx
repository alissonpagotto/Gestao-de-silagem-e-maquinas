import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Award, 
  Search, 
  RotateCcw, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { formatCurrencyBRL } from '../../lib/formatters';

interface CotacoesSubModuleProps {
  allItems: InventoryItem[];
}

interface CotacaoPrecos {
  [itemId: string]: {
    precoA?: number;
    precoB?: number;
    precoC?: number;
  };
}

export const CotacoesSubModule: React.FC<CotacoesSubModuleProps> = ({
  allItems,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Nomes dos 3 fornecedores concorrentes (persistidos)
  const [fornecedorA, setFornecedorA] = useState<string>(() => {
    return localStorage.getItem('colaca_cotacao_fornecedor_a') || 'FORNECEDOR A (DISTRIBUIDOR PRINCIPAL)';
  });
  const [fornecedorB, setFornecedorB] = useState<string>(() => {
    return localStorage.getItem('colaca_cotacao_fornecedor_b') || 'FORNECEDOR B (ATACADÃO REGIONAL)';
  });
  const [fornecedorC, setFornecedorC] = useState<string>(() => {
    return localStorage.getItem('colaca_cotacao_fornecedor_c') || 'FORNECEDOR C (COOPERATIVA AGRO)';
  });

  // Mapa de preços cotados por item: { [id]: { precoA, precoB, precoC } }
  const [cotacoes, setCotacoes] = useState<CotacaoPrecos>(() => {
    try {
      const saved = localStorage.getItem('colaca_cotacao_precos_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Salvar no localStorage sempre que alterar
  useEffect(() => {
    try {
      localStorage.setItem('colaca_cotacao_fornecedor_a', fornecedorA);
    } catch (_) {}
  }, [fornecedorA]);

  useEffect(() => {
    try {
      localStorage.setItem('colaca_cotacao_fornecedor_b', fornecedorB);
    } catch (_) {}
  }, [fornecedorB]);

  useEffect(() => {
    try {
      localStorage.setItem('colaca_cotacao_fornecedor_c', fornecedorC);
    } catch (_) {}
  }, [fornecedorC]);

  useEffect(() => {
    try {
      localStorage.setItem('colaca_cotacao_precos_map', JSON.stringify(cotacoes));
    } catch (_) {}
  }, [cotacoes]);

  // Atualizar preço de um fornecedor para determinado item
  const handlePriceChange = (itemId: string, supplier: 'precoA' | 'precoB' | 'precoC', valStr: string) => {
    const sanitized = valStr.replace(',', '.');
    const val = sanitized === '' ? undefined : parseFloat(sanitized);
    const validVal = val === undefined || isNaN(val) ? undefined : Math.max(0, val);

    setCotacoes(prev => {
      const currentItemPrices = prev[itemId] || {};
      return {
        ...prev,
        [itemId]: {
          ...currentItemPrices,
          [supplier]: validVal,
        },
      };
    });
  };

  // Limpar cotações
  const handleClearCotacoes = () => {
    if (confirm('Deseja limpar todos os valores digitados na cotação atual?')) {
      setCotacoes({});
    }
  };

  // Filtragem dos itens por termo de busca
  const filteredItems = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return allItems;
    return allItems.filter(item => {
      const name = String(item.nome_comercial || item.name || '').toLowerCase();
      const code = String(item.code || item.codigo_produto || item.barcode || '').toLowerCase();
      const cat = String(item.categoria || item.category || '').toLowerCase();
      return name.includes(s) || code.includes(s) || cat.includes(s);
    });
  }, [allItems, searchTerm]);

  // Cálculos reativos do somatório total de cada fornecedor
  const { totalA, totalB, totalC, countA, countB, countC } = useMemo(() => {
    let tA = 0;
    let tB = 0;
    let tC = 0;
    let cA = 0;
    let cB = 0;
    let cC = 0;

    Object.values(cotacoes).forEach(entry => {
      if (entry.precoA !== undefined && entry.precoA > 0) {
        tA += entry.precoA;
        cA += 1;
      }
      if (entry.precoB !== undefined && entry.precoB > 0) {
        tB += entry.precoB;
        cB += 1;
      }
      if (entry.precoC !== undefined && entry.precoC > 0) {
        tC += entry.precoC;
        cC += 1;
      }
    });

    return { totalA: tA, totalB: tB, totalC: tC, countA: cA, countB: cB, countC: cC };
  }, [cotacoes]);

  // Identificar qual fornecedor possui a menor soma geral com destaque de MELHOR OPÇÃO GLOBAL
  const bestSupplier = useMemo(() => {
    const candidates: { id: 'A' | 'B' | 'C'; name: string; total: number; count: number }[] = [];
    if (countA > 0) candidates.push({ id: 'A', name: fornecedorA || 'FORNECEDOR A', total: totalA, count: countA });
    if (countB > 0) candidates.push({ id: 'B', name: fornecedorB || 'FORNECEDOR B', total: totalB, count: countB });
    if (countC > 0) candidates.push({ id: 'C', name: fornecedorC || 'FORNECEDOR C', total: totalC, count: countC });

    if (candidates.length === 0) return null;

    // Ordenar pelo menor total
    candidates.sort((a, b) => a.total - b.total);
    return candidates[0];
  }, [totalA, totalB, totalC, countA, countB, countC, fornecedorA, fornecedorB, fornecedorC]);

  return (
    <div className="w-full flex flex-col h-[78vh] min-h-[500px] max-h-[82vh] overflow-hidden global bg-slate-50 dark:bg-stone-900 rounded-lg border border-slate-300 dark:border-stone-700 shadow-xs">
      
      {/* 1. CABEÇALHO FIXO SUPERIOR (STICKY/FIXED NO TOPO DO CONTAINER) */}
      <div className="shrink-0 z-20 bg-gradient-to-b from-slate-100 via-white to-slate-100 dark:from-stone-850 dark:via-stone-900 dark:to-stone-850 border-b border-slate-300 dark:border-stone-700 p-2.5 shadow-sm space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-800 dark:text-stone-100 flex items-center gap-1.5 tracking-wide">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>PAINEL DE COTAÇÕES & COMPARATIVO MULTIFORNECEDOR</span>
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-stone-400">
              Digite o nome dos 3 fornecedores concorrentes e os preços cotados para inteligência colorimétrica instantânea.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                placeholder="FILTRAR PRODUTOS..."
                className="w-full pl-7 pr-2 py-0.5 text-[10px] font-bold uppercase rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={handleClearCotacoes}
              className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-stone-750 dark:text-stone-300 cursor-pointer flex items-center gap-1"
              title="Limpar preços cotados"
            >
              <RotateCcw className="w-3 h-3" />
              <span>LIMPAR</span>
            </button>
          </div>
        </div>

        {/* INPUTS FIXOS DOS 3 FORNECEDORES CONCORRENTES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-stone-750">
          {/* FORNECEDOR A */}
          <div className="flex items-center gap-1.5 bg-blue-50/70 dark:bg-blue-950/30 p-1.5 rounded border border-blue-200 dark:border-blue-900/60">
            <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300 w-24 shrink-0">
              FORNECEDOR A:
            </span>
            <input
              type="text"
              value={fornecedorA}
              onChange={(e) => setFornecedorA(e.target.value.toUpperCase())}
              placeholder="NOME DO FORNECEDOR A..."
              className="w-full px-2 py-0.5 text-[10px] font-bold uppercase rounded border border-blue-300 dark:border-blue-800 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* FORNECEDOR B */}
          <div className="flex items-center gap-1.5 bg-amber-50/70 dark:bg-amber-950/30 p-1.5 rounded border border-amber-200 dark:border-amber-900/60">
            <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 w-24 shrink-0">
              FORNECEDOR B:
            </span>
            <input
              type="text"
              value={fornecedorB}
              onChange={(e) => setFornecedorB(e.target.value.toUpperCase())}
              placeholder="NOME DO FORNECEDOR B..."
              className="w-full px-2 py-0.5 text-[10px] font-bold uppercase rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* FORNECEDOR C */}
          <div className="flex items-center gap-1.5 bg-purple-50/70 dark:bg-purple-950/30 p-1.5 rounded border border-purple-200 dark:border-purple-900/60">
            <span className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300 w-24 shrink-0">
              FORNECEDOR C:
            </span>
            <input
              type="text"
              value={fornecedorC}
              onChange={(e) => setFornecedorC(e.target.value.toUpperCase())}
              placeholder="NOME DO FORNECEDOR C..."
              className="w-full px-2 py-0.5 text-[10px] font-bold uppercase rounded border border-purple-300 dark:border-purple-800 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* 2. LISTAGEM COM ROLAGEM INDEPENDENTE (OVERFLOW-Y-AUTO) */}
      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 bg-white dark:bg-stone-850">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead className="bg-slate-100 dark:bg-stone-800 text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wide border-b border-slate-300 dark:border-stone-700 sticky top-0 z-10 shadow-xs">
            <tr>
              <th className="py-1 px-3 w-72">CÓDIGO & DESCRIÇÃO DO PRODUTO (UPPERCASE)</th>
              <th className="py-1 px-2 w-28 text-right">ÚLTIMO VALOR (BASE)</th>
              <th className="py-1 px-2 w-40 text-center bg-blue-100/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300">
                {fornecedorA || 'FORNECEDOR A'}
              </th>
              <th className="py-1 px-2 w-40 text-center bg-amber-100/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300">
                {fornecedorB || 'FORNECEDOR B'}
              </th>
              <th className="py-1 px-2 w-40 text-center bg-purple-100/60 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300">
                {fornecedorC || 'FORNECEDOR C'}
              </th>
              <th className="py-1 px-2 w-32 text-center">MELHOR OFERTA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-stone-750">
            {filteredItems.map((item) => {
              const itemKey = item.id;
              const lastCost = Number(item.preco_custo_inicial ?? item.unitCost ?? 0);
              const pData = cotacoes[itemKey] || {};
              const pA = pData.precoA;
              const pB = pData.precoB;
              const pC = pData.precoC;

              // Identificar valores válidos digitados nesta linha
              const activePrices: { key: 'A' | 'B' | 'C'; val: number }[] = [];
              if (pA !== undefined && pA > 0) activePrices.push({ key: 'A', val: pA });
              if (pB !== undefined && pB > 0) activePrices.push({ key: 'B', val: pB });
              if (pC !== undefined && pC > 0) activePrices.push({ key: 'C', val: pC });

              let minVal = -1;
              let maxVal = -1;

              if (activePrices.length >= 2) {
                const vals = activePrices.map(x => x.val);
                minVal = Math.min(...vals);
                maxVal = Math.max(...vals);
              }

              // Função auxiliar para atribuir as cores inteligentes (Soft Cores)
              // Menor preço: VERDE SUAVE (bg-green-100 text-green-800 font-bold)
              // Maior preço: VERMELHA SUAVE (bg-red-100 text-red-800)
              const getCellHighlight = (val: number | undefined) => {
                if (val === undefined || val <= 0 || activePrices.length < 2) {
                  return 'border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-850 dark:text-white';
                }
                if (val === minVal) {
                  return 'bg-green-100 text-green-800 font-bold border-green-400 dark:bg-green-950/60 dark:text-green-300 dark:border-green-700';
                }
                if (val === maxVal && maxVal !== minVal) {
                  return 'bg-red-100 text-red-800 font-bold border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700';
                }
                return 'border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-white';
              };

              const bestInRow = activePrices.length > 0
                ? activePrices.reduce((prev, curr) => curr.val < prev.val ? curr : prev)
                : null;

              return (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/50 transition">
                  {/* CÓDIGO & DESCRIÇÃO DO PRODUTO (Tratado em UPPERCASE) */}
                  <td className="py-1 px-3 font-bold text-slate-900 dark:text-white uppercase">
                    <span className="font-mono text-slate-500 mr-1.5 text-[10px]">
                      {item.code || item.codigo_produto || 'S/CÓD'}
                    </span>
                    {(item.nome_comercial || item.name || '').toUpperCase()}
                  </td>

                  {/* ÚLTIMO VALOR DE COMPRA (Puxado do histórico do LocalStorage) */}
                  <td className="py-1 px-2 text-right font-mono font-semibold text-slate-600 dark:text-stone-300 text-[10px]">
                    {formatCurrencyBRL(lastCost)}
                  </td>

                  {/* COLUNA INPUT FORNECEDOR A */}
                  <td className="py-1 px-2 text-center">
                    <div className="relative inline-flex items-center w-full max-w-[130px]">
                      <span className="absolute left-1.5 text-[9px] text-slate-400 font-mono">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pA !== undefined ? pA : ''}
                        onChange={(e) => handlePriceChange(item.id, 'precoA', e.target.value)}
                        placeholder="0,00"
                        className={`w-full pl-6 pr-1.5 py-0.5 text-right text-[11px] font-mono rounded border transition ${getCellHighlight(pA)}`}
                      />
                    </div>
                  </td>

                  {/* COLUNA INPUT FORNECEDOR B */}
                  <td className="py-1 px-2 text-center">
                    <div className="relative inline-flex items-center w-full max-w-[130px]">
                      <span className="absolute left-1.5 text-[9px] text-slate-400 font-mono">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pB !== undefined ? pB : ''}
                        onChange={(e) => handlePriceChange(item.id, 'precoB', e.target.value)}
                        placeholder="0,00"
                        className={`w-full pl-6 pr-1.5 py-0.5 text-right text-[11px] font-mono rounded border transition ${getCellHighlight(pB)}`}
                      />
                    </div>
                  </td>

                  {/* COLUNA INPUT FORNECEDOR C */}
                  <td className="py-1 px-2 text-center">
                    <div className="relative inline-flex items-center w-full max-w-[130px]">
                      <span className="absolute left-1.5 text-[9px] text-slate-400 font-mono">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pC !== undefined ? pC : ''}
                        onChange={(e) => handlePriceChange(item.id, 'precoC', e.target.value)}
                        placeholder="0,00"
                        className={`w-full pl-6 pr-1.5 py-0.5 text-right text-[11px] font-mono rounded border transition ${getCellHighlight(pC)}`}
                      />
                    </div>
                  </td>

                  {/* INDICADOR DA MELHOR OFERTA NA LINHA */}
                  <td className="py-1 px-2 text-center">
                    {bestInRow ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <span>F-{bestInRow.key}</span>
                        <span className="font-mono">{formatCurrencyBRL(bestInRow.val)}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-mono">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. RODAPÉ FIXO COM SOMA TOTAL COMPARATIVA & DESTAQUE DE "MELHOR OPÇÃO GLOBAL" */}
      <div className="shrink-0 z-20 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-t border-slate-300 dark:border-stone-700 p-2 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
          
          {/* Card Total Fornecedor A */}
          <div className={`p-1.5 rounded border transition ${
            bestSupplier?.id === 'A'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-500'
              : 'border-blue-200 dark:border-blue-900 bg-white dark:bg-stone-850'
          }`}>
            <div className="flex items-center justify-between text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase">
              <span className="truncate">{fornecedorA || 'FORNECEDOR A'}</span>
              <span className="font-mono text-[9px]">({countA} cotados)</span>
            </div>
            <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {formatCurrencyBRL(totalA)}
            </div>
          </div>

          {/* Card Total Fornecedor B */}
          <div className={`p-1.5 rounded border transition ${
            bestSupplier?.id === 'B'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-500'
              : 'border-amber-200 dark:border-amber-900 bg-white dark:bg-stone-850'
          }`}>
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase">
              <span className="truncate">{fornecedorB || 'FORNECEDOR B'}</span>
              <span className="font-mono text-[9px]">({countB} cotados)</span>
            </div>
            <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {formatCurrencyBRL(totalB)}
            </div>
          </div>

          {/* Card Total Fornecedor C */}
          <div className={`p-1.5 rounded border transition ${
            bestSupplier?.id === 'C'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-500'
              : 'border-purple-200 dark:border-purple-900 bg-white dark:bg-stone-850'
          }`}>
            <div className="flex items-center justify-between text-[10px] font-bold text-purple-900 dark:text-purple-300 uppercase">
              <span className="truncate">{fornecedorC || 'FORNECEDOR C'}</span>
              <span className="font-mono text-[9px]">({countC} cotados)</span>
            </div>
            <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {formatCurrencyBRL(totalC)}
            </div>
          </div>

          {/* Destaque "MELHOR OPÇÃO GLOBAL" */}
          <div className="p-1.5 rounded border border-emerald-400 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-100">
                <Award className="w-3.5 h-3.5 text-amber-300" />
                <span>MELHOR OPÇÃO GLOBAL</span>
              </div>
              <div className="text-xs font-black uppercase truncate mt-0.5">
                {bestSupplier ? bestSupplier.name : 'NENHUMA COTAÇÃO'}
              </div>
            </div>
            {bestSupplier && (
              <div className="text-right">
                <span className="text-[8px] font-bold uppercase text-emerald-200 block">ECONOMIA</span>
                <span className="text-xs font-black font-mono text-amber-300">
                  {formatCurrencyBRL(bestSupplier.total)}
                </span>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};
