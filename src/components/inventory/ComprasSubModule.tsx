import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Trash2, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Award,
  ArrowRight
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { formatCurrencyBRL } from '../../lib/formatters';

interface ComprasSubModuleProps {
  allItems: InventoryItem[];
  onOpenCreateItem?: () => void;
}

interface PurchaseItemDraft {
  item: InventoryItem;
  quantity: number;
  unitCost: number;
}

export const ComprasSubModule: React.FC<ComprasSubModuleProps> = ({
  allItems,
}) => {
  const [comprasSubTab, setComprasSubTab] = useState<'avulsos' | 'abaixo_estoque'>('avulsos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  
  // Lista de compras em rascunho / cotação de compra local
  const [purchaseList, setPurchaseList] = useState<PurchaseItemDraft[]>(() => {
    try {
      const saved = localStorage.getItem('colaca_silagem_compras_draft');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orderFinalizedMessage, setOrderFinalizedMessage] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('colaca_silagem_compras_draft', JSON.stringify(purchaseList));
    } catch (_) {}
  }, [purchaseList]);

  // Produtos que estão abaixo ou igual ao estoque mínimo (lógica de negócio mandatória)
  const belowStockItems = useMemo(() => {
    return allItems.filter(item => {
      const cur = Number(item.quantidade_atual ?? item.quantity ?? 0);
      const min = Number(item.minQuantity ?? item.estoqueMinimo ?? 0);
      return cur <= min;
    });
  }, [allItems]);

  // Lista de categorias únicas para filtro
  const categories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach(i => {
      const cat = (i.categoria || i.category || 'GERAL').trim().toUpperCase();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [allItems]);

  // Itens filtrados para a busca manual de itens avulsos
  const filteredAvulsos = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    return allItems.filter(item => {
      const name = String(item.nome_comercial || item.name || '').toLowerCase();
      const code = String(item.code || item.codigo_produto || item.barcode || '').toLowerCase();
      const cat = String(item.categoria || item.category || '').toUpperCase();
      
      const matchesSearch = !s || name.includes(s) || code.includes(s);
      const matchesCategory = selectedCategory === 'TODAS' || cat === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allItems, searchTerm, selectedCategory]);

  const handleAddItemToPurchase = (item: InventoryItem, suggestedQty: number = 1) => {
    setPurchaseList(prev => {
      const existing = prev.find(p => p.item.id === item.id);
      const cost = Number(item.preco_custo_inicial ?? item.unitCost ?? 0);
      if (existing) {
        return prev.map(p => 
          p.item.id === item.id 
            ? { ...p, quantity: p.quantity + suggestedQty }
            : p
        );
      }
      return [...prev, { item, quantity: suggestedQty, unitCost: cost }];
    });
  };

  const handleAddAllBelowStock = () => {
    belowStockItems.forEach(item => {
      const cur = Number(item.quantidade_atual ?? item.quantity ?? 0);
      const min = Number(item.minQuantity ?? item.estoqueMinimo ?? 0);
      const suggested = Math.max(1, min - cur > 0 ? min - cur : min || 1);
      handleAddItemToPurchase(item, suggested);
    });
  };

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setPurchaseList(prev => prev.map(p => p.item.id === itemId ? { ...p, quantity: newQty } : p));
  };

  const handleUpdateCost = (itemId: string, newCost: number) => {
    setPurchaseList(prev => prev.map(p => p.item.id === itemId ? { ...p, unitCost: Math.max(0, newCost) } : p));
  };

  const handleRemoveItem = (itemId: string) => {
    setPurchaseList(prev => prev.filter(p => p.item.id !== itemId));
  };

  const totalPurchaseValue = useMemo(() => {
    return purchaseList.reduce((acc, p) => acc + (p.quantity * p.unitCost), 0);
  }, [purchaseList]);

  const totalPurchaseQty = useMemo(() => {
    return purchaseList.reduce((acc, p) => acc + p.quantity, 0);
  }, [purchaseList]);

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* 1. SEGUNDO NÍVEL: SUB-LINHA DE BOTÕES MICRO HORIZONTAIS */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-stone-850 p-2 rounded-lg border border-slate-300 dark:border-stone-700 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setComprasSubTab('avulsos')}
            className={`text-[10px] font-bold tracking-wide uppercase px-3 py-1 rounded border transition-all cursor-pointer ${
              comprasSubTab === 'avulsos'
                ? 'border-slate-800 bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 border-slate-300 bg-white hover:bg-slate-100 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-600'
            }`}
          >
            <span>🛒 COMPRAS DE ITENS AVULSOS</span>
          </button>

          <button
            type="button"
            onClick={() => setComprasSubTab('abaixo_estoque')}
            className={`text-[10px] font-bold tracking-wide uppercase px-3 py-1 rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
              comprasSubTab === 'abaixo_estoque'
                ? 'border-rose-800 bg-rose-700 text-white shadow-xs'
                : 'text-rose-700 border-rose-300 bg-rose-50/60 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            <TrendingDown className="w-3 h-3" />
            <span>📉 COMPRA DE PRODUTOS ABAIXO DO ESTOQUE</span>
            {belowStockItems.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-900 text-white text-[9px] font-black">
                {belowStockItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Totais do Rascunho da Ordem de Compra */}
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-slate-600 dark:text-stone-300 font-semibold uppercase">
            Itens no Pedido: <span className="font-bold text-slate-900 dark:text-white">{purchaseList.length}</span> ({totalPurchaseQty.toLocaleString('pt-BR')} un)
          </div>
          <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
            TOTAL: {formatCurrencyBRL(totalPurchaseValue)}
          </div>
          {purchaseList.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Deseja limpar todos os itens deste rascunho de compras?')) {
                  setPurchaseList([]);
                }
              }}
              className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-stone-700 dark:text-stone-300 cursor-pointer"
            >
              LIMPAR
            </button>
          )}
        </div>
      </div>

      {orderFinalizedMessage && (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>PEDIDO DE COMPRA GERADO E PERSISTIDO COM SUCESSO! ITENS ENVIADOS PARA COTAÇÃO/FINANCEIRO.</span>
          </div>
          <button 
            type="button" 
            onClick={() => setOrderFinalizedMessage(false)}
            className="text-[10px] underline uppercase cursor-pointer"
          >
            FECHAR
          </button>
        </div>
      )}

      {/* CONTEÚDO DA SUB-ABA 1: COMPRA DE PRODUTOS ABAIXO DO ESTOQUE */}
      {comprasSubTab === 'abaixo_estoque' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white dark:bg-stone-850 p-2.5 rounded-lg border border-slate-300 dark:border-stone-700 shadow-xs">
            <div>
              <h4 className="text-xs font-black uppercase text-slate-800 dark:text-stone-100 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>VARREDURA REATIVA: PRODUTOS EM NÍVEL CRÍTICO OU ABAIXO DO ESTOQUE MÍNIMO</span>
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-stone-400">
                Comparação automática de 'quantidade' atual versus 'estoqueMinimo' no cadastro global.
              </p>
            </div>

            {belowStockItems.length > 0 && (
              <button
                type="button"
                onClick={handleAddAllBelowStock}
                className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase rounded bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>INCLUIR TODOS OS {belowStockItems.length} ITENS NO PEDIDO</span>
              </button>
            )}
          </div>

          {belowStockItems.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-stone-850 rounded-lg border border-slate-300 dark:border-stone-700">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 dark:text-stone-200 uppercase">
                EXCELENTE! NENHUM PRODUTO ABAIXO DO ESTOQUE MÍNIMO NESTE MOMENTO.
              </p>
              <p className="text-[10px] text-slate-500 dark:text-stone-400 mt-1">
                Todos os itens cadastrados estão com quantidades confortáveis no almoxarifado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-850">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-100 dark:bg-stone-800 text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wide border-b border-slate-300 dark:border-stone-700">
                  <tr>
                    <th className="py-1.5 px-3">CÓDIGO & PRODUTO</th>
                    <th className="py-1.5 px-2">CATEGORIA</th>
                    <th className="py-1.5 px-2 text-right">QTD. ATUAL</th>
                    <th className="py-1.5 px-2 text-right">ESTOQUE MÍNIMO</th>
                    <th className="py-1.5 px-2 text-right text-rose-600">DÉFICIT</th>
                    <th className="py-1.5 px-2 text-right">ÚLTIMO CUSTO</th>
                    <th className="py-1.5 px-2 text-right">TOTAL ESTIMADO</th>
                    <th className="py-1.5 px-3 text-center">AÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-stone-750">
                  {belowStockItems.map((item) => {
                    const cur = Number(item.quantidade_atual ?? item.quantity ?? 0);
                    const min = Number(item.minQuantity ?? item.estoqueMinimo ?? 0);
                    const deficit = Math.max(1, min - cur > 0 ? min - cur : 1);
                    const cost = Number(item.preco_custo_inicial ?? item.unitCost ?? 0);
                    const isAlreadyAdded = purchaseList.some(p => p.item.id === item.id);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/60 transition">
                        <td className="py-1 px-3 font-bold text-slate-900 dark:text-white uppercase">
                          <span className="font-mono text-slate-500 mr-1.5 text-[10px]">
                            {item.code || item.codigo_produto || 'S/CÓD'}
                          </span>
                          {item.nome_comercial || item.name}
                        </td>
                        <td className="py-1 px-2 text-slate-600 dark:text-stone-400 uppercase text-[10px]">
                          {item.categoria || item.category || 'GERAL'}
                        </td>
                        <td className="py-1 px-2 text-right font-black text-rose-600 font-mono">
                          {cur.toLocaleString('pt-BR')} {item.unit}
                        </td>
                        <td className="py-1 px-2 text-right text-slate-700 dark:text-stone-300 font-mono">
                          {min.toLocaleString('pt-BR')} {item.unit}
                        </td>
                        <td className="py-1 px-2 text-right font-black text-rose-700 dark:text-rose-400 font-mono">
                          -{deficit.toLocaleString('pt-BR')} {item.unit}
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-slate-700 dark:text-stone-300">
                          {formatCurrencyBRL(cost)}
                        </td>
                        <td className="py-1 px-2 text-right font-black font-mono text-slate-900 dark:text-white">
                          {formatCurrencyBRL(deficit * cost)}
                        </td>
                        <td className="py-1 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleAddItemToPurchase(item, deficit)}
                            disabled={isAlreadyAdded}
                            className={`px-2 py-0.5 text-[9px] font-black uppercase rounded transition cursor-pointer ${
                              isAlreadyAdded
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 cursor-default'
                                : 'bg-slate-800 text-white hover:bg-slate-700 active:scale-95'
                            }`}
                          >
                            {isAlreadyAdded ? '✓ ADICIONADO' : '+ COMPRAR'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA SUB-ABA 2: COMPRAS DE ITENS AVULSOS (BUSCA MANUAL GERAL) */}
      {comprasSubTab === 'avulsos' && (
        <div className="space-y-3">
          {/* Barra de Busca e Filtro de Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white dark:bg-stone-850 p-2.5 rounded-lg border border-slate-300 dark:border-stone-700 shadow-xs">
            <div className="sm:col-span-2 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                placeholder="BUSCAR ITEM POR NOME, CÓDIGO OU CÓDIGO DE BARRAS..."
                className="w-full pl-8 pr-3 py-1 text-xs font-bold uppercase rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2 py-1 text-xs font-bold uppercase rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="TODAS">TODAS AS CATEGORIAS</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabela de Produtos Cadastrados Disponíveis para Compra */}
          <div className="overflow-x-auto border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-850 max-h-[350px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-100 dark:bg-stone-800 text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wide border-b border-slate-300 dark:border-stone-700 sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="py-1.5 px-3">CÓDIGO & DESCRIÇÃO (UPPERCASE)</th>
                  <th className="py-1.5 px-2">CATEGORIA</th>
                  <th className="py-1.5 px-2 text-right">ESTOQUE ATUAL</th>
                  <th className="py-1.5 px-2 text-right">ESTOQUE MÍN.</th>
                  <th className="py-1.5 px-2 text-right">ÚLTIMO CUSTO</th>
                  <th className="py-1.5 px-3 text-center">AÇÃO RÁPIDA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-stone-750">
                {filteredAvulsos.map((item) => {
                  const cur = Number(item.quantidade_atual ?? item.quantity ?? 0);
                  const min = Number(item.minQuantity ?? item.estoqueMinimo ?? 0);
                  const cost = Number(item.preco_custo_inicial ?? item.unitCost ?? 0);
                  const isBelow = cur <= min;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/60 transition">
                      <td className="py-1 px-3 font-bold text-slate-900 dark:text-white uppercase">
                        <span className="font-mono text-slate-500 mr-1.5 text-[10px]">
                          {item.code || item.codigo_produto || 'S/CÓD'}
                        </span>
                        {item.nome_comercial || item.name}
                      </td>
                      <td className="py-1 px-2 text-slate-600 dark:text-stone-400 uppercase text-[10px]">
                        {item.categoria || item.category || 'GERAL'}
                      </td>
                      <td className={`py-1 px-2 text-right font-mono font-bold ${isBelow ? 'text-rose-600 font-black' : 'text-slate-800 dark:text-stone-200'}`}>
                        {cur.toLocaleString('pt-BR')} {item.unit}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-slate-500">
                        {min.toLocaleString('pt-BR')} {item.unit}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-slate-700 dark:text-stone-300">
                        {formatCurrencyBRL(cost)}
                      </td>
                      <td className="py-1 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleAddItemToPurchase(item, 1)}
                          className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-700 hover:bg-emerald-800 text-white transition active:scale-95 cursor-pointer shadow-xs"
                        >
                          + INSERIR ITEM
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RASCUNHO / ITENS SELECIONADOS PARA O PEDIDO DE COMPRA ATUAL */}
      {purchaseList.length > 0 && (
        <div className="border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-850 p-2.5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-700 pb-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wide">
                LISTA DE PRODUTOS PARA COMPRA CONSOLIDADA ({purchaseList.length} ITENS)
              </h4>
            </div>
            <span className="text-[10px] text-slate-500">
              Ajuste as quantidades e o valor unitário estimado antes de fechar o pedido
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead className="bg-slate-50 dark:bg-stone-800 text-[10px] font-black text-slate-600 dark:text-stone-400 uppercase tracking-wide border-b border-slate-200 dark:border-stone-700">
                <tr>
                  <th className="py-1 px-2">ITEM / DESCRIÇÃO</th>
                  <th className="py-1 px-2 w-28 text-center">QUANTIDADE</th>
                  <th className="py-1 px-2 w-32 text-right">VALOR UNIT. (R$)</th>
                  <th className="py-1 px-2 text-right">SUBTOTAL</th>
                  <th className="py-1 px-2 w-12 text-center">REMOVER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-stone-750">
                {purchaseList.map((entry) => {
                  const subtotal = entry.quantity * entry.unitCost;
                  return (
                    <tr key={entry.item.id} className="hover:bg-slate-50/50 dark:hover:bg-stone-800/40">
                      <td className="py-1 px-2 font-bold uppercase text-slate-900 dark:text-white">
                        <span className="font-mono text-slate-500 text-[10px] mr-1">
                          {entry.item.code || entry.item.codigo_produto || 'S/CÓD'}
                        </span>
                        {entry.item.nome_comercial || entry.item.name}
                      </td>
                      <td className="py-1 px-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={entry.quantity}
                            onChange={(e) => handleUpdateQty(entry.item.id, parseFloat(e.target.value) || 0)}
                            className="w-16 px-1 py-0.5 text-center text-xs font-bold rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-900 dark:text-white font-mono"
                          />
                          <span className="text-[10px] text-slate-500 font-mono">{entry.item.unit}</span>
                        </div>
                      </td>
                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.unitCost}
                          onChange={(e) => handleUpdateCost(entry.item.id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-1 py-0.5 text-right text-xs font-bold rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-900 dark:text-white font-mono"
                        />
                      </td>
                      <td className="py-1 px-2 text-right font-black font-mono text-slate-900 dark:text-white">
                        {formatCurrencyBRL(subtotal)}
                      </td>
                      <td className="py-1 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(entry.item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Remover item"
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

          {/* Rodapé da Compra com Ação Final */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-900/60 p-2 rounded">
            <div className="text-[11px] font-bold text-slate-700 dark:text-stone-300">
              VALOR TOTAL ESTIMADO DA COMPRA:{' '}
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono ml-1">
                {formatCurrencyBRL(totalPurchaseValue)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setOrderFinalizedMessage(true);
                // Grava compra registrada no histórico de pedidos de compras
                try {
                  const rawHistory = localStorage.getItem('colaca_silagem_compras_historico');
                  const history = rawHistory ? JSON.parse(rawHistory) : [];
                  const newRecord = {
                    id: `compra_${Date.now()}`,
                    date: new Date().toISOString(),
                    items: purchaseList,
                    totalValue: totalPurchaseValue,
                    status: 'PENDENTE',
                  };
                  history.unshift(newRecord);
                  localStorage.setItem('colaca_silagem_compras_historico', JSON.stringify(history));
                  setPurchaseList([]);
                } catch (_) {}
              }}
              className="px-4 py-1.5 text-xs font-black uppercase rounded bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>FINALIZAR & SALVAR PEDIDO DE COMPRA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
