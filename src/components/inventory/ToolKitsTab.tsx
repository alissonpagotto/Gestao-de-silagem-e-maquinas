import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Check,
  Copy,
  Link2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Unlink,
  Wrench,
  Zap,
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { formatCurrencyBRL } from '../../lib/formatters';
import {
  buildDefaultToolKits,
  resolveInventoryUnitCost,
  ToolKitItem,
  ToolKitRecord,
} from '../../lib/toolKitsStorage';
import { useConfirm } from '../../context/ConfirmContext';

interface ToolKitsTabProps {
  toolKits: ToolKitRecord[];
  products: InventoryItem[];
  onSaveToolKits: (nextKits: ToolKitRecord[]) => void;
  onShowFeedback: (type: 'success' | 'error', message: string) => void;
  onApplyKitShortcut?: (kitId: string) => void;
}

const KIT_CATEGORIES = [
  'Forrageira / Colhedora',
  'Caminhão',
  'Trator',
  'Cavalo Mecânico',
  'Utilitário / Apoio',
  'Oficina / Geral',
];

const UNIT_OPTIONS = ['UN', 'JOGO', 'PAR', 'CX', 'KIT', 'PC'];

const MATCH_STOPWORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'a',
  'o',
  'as',
  'os',
  'com',
  'para',
  'em',
  'na',
  'no',
  'nas',
  'nos',
]);

function normalizeMatchText(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/["'´`.,;:()[\]{}/\\+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeMatchText(normalized: string): string[] {
  return normalized
    .split(' ')
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !MATCH_STOPWORDS.has(t));
}

function findBestMatchingInventoryProduct(
  item: ToolKitItem,
  products: InventoryItem[]
): InventoryItem | undefined {
  if (!products.length) return undefined;

  const itemCodeNorm = String(item.codigo || '').trim().toLowerCase();
  if (itemCodeNorm) {
    const byCode = products.find(p => {
      const pCode = String(p.code ?? p.codigo_produto ?? '').trim().toLowerCase();
      return pCode !== '' && pCode === itemCodeNorm;
    });
    if (byCode) return byCode;
  }

  const itemNorm = normalizeMatchText(item.nome);
  if (!itemNorm) return undefined;
  const itemTokens = tokenizeMatchText(itemNorm);
  const itemNumbers = new Set(itemNorm.match(/\d+(?:[.,]\d+)?/g) || []);

  let bestProd: InventoryItem | undefined;
  let bestScore = 0;

  for (const prod of products) {
    const prodName = String(prod.nome_comercial || prod.name || '').trim();
    const prodNorm = normalizeMatchText(prodName);
    if (!prodNorm) continue;

    if (prodNorm === itemNorm) {
      return prod;
    }

    let score = 0;

    if (itemNorm.length >= 4 && prodNorm.length >= 4) {
      if (prodNorm.includes(itemNorm)) {
        score = Math.max(score, 0.92);
      } else if (itemNorm.includes(prodNorm)) {
        score = Math.max(score, 0.85);
      }
    }

    const prodTokens = tokenizeMatchText(prodNorm);
    if (itemTokens.length > 0 && prodTokens.length > 0) {
      const prodSet = new Set(prodTokens);
      let matchedCount = 0;
      for (const tok of itemTokens) {
        if (
          prodSet.has(tok) ||
          prodTokens.some(
            pt =>
              (tok.length >= 4 && pt.includes(tok)) ||
              (pt.length >= 4 && tok.includes(pt))
          )
        ) {
          matchedCount++;
        }
      }

      const itemCoverage = matchedCount / itemTokens.length;
      const prodCoverage = matchedCount / prodTokens.length;
      const minMatchedRequired = itemTokens.length === 1 ? 1 : 2;

      if (matchedCount >= minMatchedRequired && itemCoverage >= 0.55) {
        let tokenScore = itemCoverage * 0.65 + prodCoverage * 0.35;

        if (itemNumbers.size > 0) {
          const prodNumbers = new Set(prodNorm.match(/\d+(?:[.,]\d+)?/g) || []);
          let numMatches = 0;
          for (const n of itemNumbers) {
            if (prodNumbers.has(n)) numMatches++;
          }
          if (numMatches > 0) {
            tokenScore += 0.12;
          } else if (prodNumbers.size > 0) {
            tokenScore -= 0.18;
          }
        }

        if (tokenScore >= 0.55) {
          score = Math.max(score, tokenScore);
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestProd = prod;
    }
  }

  return bestProd;
}

export const ToolKitsTab: React.FC<ToolKitsTabProps> = ({
  toolKits,
  products,
  onSaveToolKits,
  onShowFeedback,
  onApplyKitShortcut,
}) => {
  const { confirm } = useConfirm();
  const [selectedKitId, setSelectedKitId] = useState<string>(() => toolKits[0]?.id || '');
  const [kitListSearch, setKitListSearch] = useState<string>('');

  // Form to create a new Kit
  const [isCreatingKit, setIsCreatingKit] = useState<boolean>(false);
  const [newKitName, setNewKitName] = useState<string>('');
  const [newKitCategory, setNewKitCategory] = useState<string>('Forrageira / Colhedora');
  const [newKitDesc, setNewKitDesc] = useState<string>('');

  // Add item form inside selected kit
  const [stockSearch, setStockSearch] = useState<string>('');
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState<boolean>(false);
  const [itemLinkedProductId, setItemLinkedProductId] = useState<string>('');
  const [itemCodigo, setItemCodigo] = useState<string>('');
  const [itemNome, setItemNome] = useState<string>('');
  const [itemQtd, setItemQtd] = useState<string>('1');
  const [itemUnidade, setItemUnidade] = useState<string>('UN');
  const [itemValorUnit, setItemValorUnit] = useState<string>('0');

  const activeKit = useMemo(() => {
    return toolKits.find(k => k.id === selectedKitId) || toolKits[0] || null;
  }, [toolKits, selectedKitId]);

  const filteredKits = useMemo(() => {
    const q = String(kitListSearch ?? '').toLowerCase().trim();
    if (!q) return toolKits;
    return toolKits.filter(
      k =>
        String(k.nome ?? '').toLowerCase().includes(q) ||
        String(k.categoria ?? '').toLowerCase().includes(q) ||
        k.itens.some(it => String(it.nome ?? '').toLowerCase().includes(q))
    );
  }, [toolKits, kitListSearch]);

  const filteredStockProducts = useMemo(() => {
    const q = String(stockSearch ?? '').toLowerCase().trim();
    const list = q
      ? products.filter(p => {
          const nome = String(p.nome_comercial || p.name || '').toLowerCase();
          const cod = String(p.code ?? p.codigo_produto ?? '').toLowerCase();
          const bar = String(p.codigo_barras ?? p.barcode ?? '').toLowerCase();
          return nome.includes(q) || cod.includes(q) || bar.includes(q);
        })
      : products;
    return list.slice(0, 60);
  }, [products, stockSearch]);

  const calcKitTotalValue = (kit: ToolKitRecord): number => {
    return kit.itens.reduce(
      (sum, it) => sum + Math.max(0, Number(it.quantidade) || 0) * Math.max(0, Number(it.valor_unitario) || 0),
      0
    );
  };

  const handleCreateKit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitName.trim()) {
      onShowFeedback('error', 'Informe o nome do novo Kit de Ferramentas.');
      return;
    }
    const now = new Date().toISOString();
    const newKit: ToolKitRecord = {
      id: `kit_${Date.now()}`,
      nome: newKitName.trim(),
      categoria: newKitCategory.trim() || 'Oficina / Geral',
      descricao: newKitDesc.trim(),
      itens: [],
      createdAt: now,
      updatedAt: now,
    };
    const next = [newKit, ...toolKits];
    onSaveToolKits(next);
    setSelectedKitId(newKit.id);
    setIsCreatingKit(false);
    setNewKitName('');
    setNewKitDesc('');
    onShowFeedback('success', `Kit "${newKit.nome}" criado com sucesso!`);
  };

  const handleDuplicateKit = (kit: ToolKitRecord) => {
    const now = new Date().toISOString();
    const copy: ToolKitRecord = {
      ...kit,
      id: `kit_${Date.now()}`,
      nome: `${kit.nome} (Cópia)`,
      createdAt: now,
      updatedAt: now,
      itens: kit.itens.map((it, idx) => ({
        ...it,
        id: `kit_item_${Date.now()}_${idx}`,
      })),
    };
    const next = [...toolKits, copy];
    onSaveToolKits(next);
    setSelectedKitId(copy.id);
    onShowFeedback('success', `Kit duplicado como "${copy.nome}".`);
  };

  const handleDeleteKit = async (kit: ToolKitRecord) => {
    const ok = await confirm({
      title: 'Excluir Kit de Ferramentas',
      message: `Deseja realmente excluir o kit "${kit.nome}" (${kit.itens.length} itens)? As caixas já aplicadas nos veículos não serão removidas.`,
      confirmLabel: 'Sim, Excluir Kit',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    const next = toolKits.filter(k => k.id !== kit.id);
    onSaveToolKits(next);
    if (selectedKitId === kit.id) {
      setSelectedKitId(next[0]?.id || '');
    }
    onShowFeedback('success', `Kit "${kit.nome}" removido.`);
  };

  const handleRestoreDefaults = async () => {
    const ok = await confirm({
      title: 'Restaurar Kits Padrão',
      message:
        'Deseja adicionar/restaurar os 4 Kits Padrão iniciais (Forrageiras, Caminhão, Trator e Cavalo Mecânico)? Kits personalizados com outros nomes serão mantidos.',
      confirmLabel: 'Sim, Restaurar Padrões',
      cancelLabel: 'Cancelar',
      variant: 'warning',
    });
    if (!ok) return;
    const defaults = buildDefaultToolKits();
    const existingIds = new Set(toolKits.map(k => k.id));
    const merged = [
      ...toolKits,
      ...defaults.filter(d => !existingIds.has(d.id)),
    ];
    onSaveToolKits(merged);
    if (!selectedKitId && merged[0]) setSelectedKitId(merged[0].id);
    onShowFeedback('success', 'Kits padrão restaurados com sucesso!');
  };

  const handleUpdateActiveKitField = (patch: Partial<ToolKitRecord>) => {
    if (!activeKit) return;
    const next = toolKits.map(k =>
      k.id === activeKit.id ? { ...k, ...patch, updatedAt: new Date().toISOString() } : k
    );
    onSaveToolKits(next);
  };

  const handlePickStockProduct = (prod: InventoryItem) => {
    const prodCode = String(prod.code ?? prod.codigo_produto ?? '').trim();
    const prodName = String(prod.nome_comercial || prod.name || '').trim();
    const prodUnit = String(prod.unidade_medida || prod.unit || 'UN').toUpperCase();
    const unitCost = resolveInventoryUnitCost(prod);

    setItemLinkedProductId(prod.id);
    setStockSearch(prodCode ? `[${prodCode}] ${prodName}` : prodName);
    setItemCodigo(prodCode || `EST-${prod.id.slice(0, 5).toUpperCase()}`);
    setItemNome(prodName);
    setItemUnidade(UNIT_OPTIONS.includes(prodUnit) ? prodUnit : 'UN');
    setItemValorUnit(unitCost > 0 ? String(unitCost) : '0');
    setIsStockDropdownOpen(false);
  };

  const handleAddItemToKit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKit) return;
    if (!itemNome.trim()) {
      onShowFeedback('error', 'Informe o nome da ferramenta para incluir no kit.');
      return;
    }
    const qtd = Math.max(0.01, parseFloat(String(itemQtd).replace(',', '.')) || 1);
    const val = Math.max(0, parseFloat(String(itemValorUnit).replace(',', '.')) || 0);
    const cod =
      itemCodigo.trim() ||
      `KIT-${String(activeKit.itens.length + 1).padStart(3, '0')}`;

    const newItem: ToolKitItem = {
      id: `kit_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      codigo: cod,
      nome: itemNome.trim(),
      quantidade: qtd,
      unidade: itemUnidade || 'UN',
      produto_id: itemLinkedProductId || null,
      valor_unitario: Number(val.toFixed(2)),
    };

    handleUpdateActiveKitField({
      itens: [...activeKit.itens, newItem],
    });

    setItemLinkedProductId('');
    setStockSearch('');
    setItemCodigo('');
    setItemNome('');
    setItemQtd('1');
    setItemUnidade('UN');
    setItemValorUnit('0');
    onShowFeedback('success', `Ferramenta "${newItem.nome}" incluída no kit!`);
  };

  const handleUpdateKitItem = (itemId: string, patch: Partial<ToolKitItem>) => {
    if (!activeKit) return;
    const nextItens = activeKit.itens.map(it =>
      it.id === itemId ? { ...it, ...patch } : it
    );
    handleUpdateActiveKitField({ itens: nextItens });
  };

  const handleLinkExistingItemToStock = (itemId: string, productId: string) => {
    if (!activeKit) return;
    if (!productId) {
      handleUpdateKitItem(itemId, { produto_id: null });
      return;
    }
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const cost = resolveInventoryUnitCost(prod);
    handleUpdateKitItem(itemId, {
      produto_id: prod.id,
      ...(cost > 0 ? { valor_unitario: cost } : {}),
    });
    onShowFeedback(
      'success',
      `Vínculo com estoque atualizado (${prod.nome_comercial || prod.name}${cost > 0 ? ` • ${formatCurrencyBRL(cost)}` : ''}).`
    );
  };

  const handleSyncAllCostsFromStock = () => {
    if (!activeKit) return;
    let updatedCount = 0;
    const nextItens = activeKit.itens.map(it => {
      let prod = it.produto_id ? products.find(p => p.id === it.produto_id) : undefined;
      if (!prod && it.codigo) {
        const cLow = String(it.codigo).trim().toLowerCase();
        prod = products.find(
          p => String(p.code ?? p.codigo_produto ?? '').trim().toLowerCase() === cLow
        );
      }
      if (prod) {
        const cost = resolveInventoryUnitCost(prod);
        if (cost > 0) {
          updatedCount++;
          return { ...it, produto_id: prod.id, valor_unitario: cost };
        }
      }
      return it;
    });
    handleUpdateActiveKitField({ itens: nextItens });
    onShowFeedback(
      updatedCount > 0 ? 'success' : 'error',
      updatedCount > 0
        ? `Custos atualizados a partir do Estoque/NF-e em ${updatedCount} item(ns)!`
        : 'Nenhum item deste kit possui produto vinculado com custo maior que R$ 0,00 no estoque.'
    );
  };

  const handleAutoLinkStockItems = () => {
    if (!activeKit) return;
    let unlinkedCount = 0;
    let linkedCount = 0;
    let costUpdatedCount = 0;

    const nextItens = activeKit.itens.map(it => {
      const alreadyLinked = Boolean(
        it.produto_id && products.some(p => p.id === it.produto_id)
      );
      if (alreadyLinked) return it;

      unlinkedCount++;
      const matchedProd = findBestMatchingInventoryProduct(it, products);
      if (!matchedProd) return it;

      linkedCount++;
      const cost = resolveInventoryUnitCost(matchedProd);
      if (cost > 0) {
        costUpdatedCount++;
      }
      return {
        ...it,
        produto_id: matchedProd.id,
        ...(cost > 0 ? { valor_unitario: cost } : {}),
      };
    });

    if (unlinkedCount === 0) {
      onShowFeedback('success', 'Todos os itens deste kit já estão vinculados ao Estoque Geral.');
      return;
    }

    if (linkedCount > 0) {
      handleUpdateActiveKitField({ itens: nextItens });
      onShowFeedback(
        'success',
        `${linkedCount} item(ns) vinculado(s) automaticamente ao Estoque Geral${
          costUpdatedCount > 0 ? ` com custo da última entrada em ${costUpdatedCount} item(ns)` : ''
        }!`
      );
    } else {
      onShowFeedback(
        'error',
        'Nenhum produto com nome correspondente foi encontrado no Estoque Geral para os itens sem vínculo.'
      );
    }
  };

  const handleRemoveKitItem = (itemId: string) => {
    if (!activeKit) return;
    handleUpdateActiveKitField({
      itens: activeKit.itens.filter(it => it.id !== itemId),
    });
  };

  const activeKitTotal = activeKit ? calcKitTotalValue(activeKit) : 0;

  return (
    <div className="no-print flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-3">
      {/* COLUNA ESQUERDA: LISTA DE KITS PADRÃO */}
      <div className="lg:col-span-4 bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-xl p-3 shadow-xs flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-2 pb-2 mb-2 border-b border-black/25 dark:border-stone-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white leading-tight truncate">
                Kits Padrão Cadastrados ({toolKits.length})
              </h2>
              <p className="text-[10px] text-slate-700 dark:text-stone-400 leading-tight">
                Modelos prontos para aplicar nos veículos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingKit(prev => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white border border-black cursor-pointer shrink-0 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Kit</span>
          </button>
        </div>

        {/* Formulário de Novo Kit */}
        {isCreatingKit && (
          <form
            onSubmit={handleCreateKit}
            className="shrink-0 mb-2.5 p-2.5 rounded-lg bg-[#cad4e6] border border-black space-y-2"
          >
            <div className="text-[11px] font-black uppercase text-black">
              Criar Novo Kit de Ferramentas
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-800 mb-0.5">
                Nome do Kit *
              </label>
              <input
                type="text"
                value={newKitName}
                onChange={e => setNewKitName(e.target.value)}
                placeholder="Ex: Kit Ferramentas Carreta Basculante"
                required
                className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-800 mb-0.5">
                Categoria / Aplicação
              </label>
              <select
                value={newKitCategory}
                onChange={e => setNewKitCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
              >
                {KIT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-800 mb-0.5">
                Descrição (Opcional)
              </label>
              <input
                type="text"
                value={newKitDesc}
                onChange={e => setNewKitDesc(e.target.value)}
                placeholder="Observação do kit..."
                className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-medium text-zinc-900"
              />
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsCreatingKit(false)}
                className="px-2.5 py-1 rounded-md border border-slate-400 bg-white text-slate-800 text-[11px] font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded-md border border-black bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Criar Kit</span>
              </button>
            </div>
          </form>
        )}

        {/* Busca de Kits */}
        <div className="shrink-0 relative mb-2">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={kitListSearch}
            onChange={e => setKitListSearch(e.target.value)}
            placeholder="Filtrar kits ou ferramenta..."
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-400 bg-white text-xs font-semibold text-zinc-900"
          />
        </div>

        {/* Lista de Cards dos Kits */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
          {filteredKits.length === 0 ? (
            <div className="py-6 text-center text-xs font-semibold text-slate-700">
              Nenhum kit encontrado. Clique em &ldquo;Novo Kit&rdquo; ou restaure os padrões abaixo.
            </div>
          ) : (
            filteredKits.map(kit => {
              const isSelected = activeKit?.id === kit.id;
              const kitTotal = calcKitTotalValue(kit);
              return (
                <div
                  key={kit.id}
                  onClick={() => setSelectedKitId(kit.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#cad4e6] border-black ring-2 ring-emerald-700/40 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-black/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-700 text-white mb-1">
                        {kit.categoria}
                      </span>
                      <h3 className="text-xs font-black text-zinc-900 leading-snug">
                        {kit.nome}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-bold text-slate-700">
                        <span>{kit.itens.length} ferramentas</span>
                        <span>•</span>
                        <span className="font-mono text-emerald-800 font-black">
                          {formatCurrencyBRL(kitTotal)}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleDuplicateKit(kit)}
                        title="Duplicar kit"
                        className="p-1 rounded hover:bg-black/10 text-slate-700 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteKit(kit)}
                        title="Excluir kit"
                        className="p-1 rounded hover:bg-rose-100 text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 pt-2 mt-2 border-t border-black/20 flex items-center justify-between">
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="text-[11px] font-bold text-slate-800 hover:text-black underline cursor-pointer inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Restaurar Kits Padrão</span>
          </button>
          <span className="text-[10px] font-bold text-slate-600">
            Salvo localmente
          </span>
        </div>
      </div>

      {/* COLUNA DIREITA: EDITOR DO KIT SELECIONADO */}
      <div className="lg:col-span-8 bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-xl p-3.5 shadow-xs flex flex-col min-h-0 overflow-hidden">
        {!activeKit ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <Wrench className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm font-black text-zinc-900">
              Selecione ou crie um Kit de Ferramentas ao lado
            </p>
          </div>
        ) : (
          <>
            {/* Cabeçalho editável do Kit */}
            <div className="shrink-0 pb-2.5 mb-2.5 border-b border-black/25 space-y-2">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 flex-1">
                  <div className="sm:col-span-7">
                    <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                      Nome do Kit (Editável)
                    </label>
                    <input
                      type="text"
                      value={activeKit.nome}
                      onChange={e => handleUpdateActiveKitField({ nome: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-black text-zinc-900"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                      Categoria / Tipo de Máquina
                    </label>
                    <select
                      value={activeKit.categoria}
                      onChange={e => handleUpdateActiveKitField({ categoria: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
                    >
                      {!KIT_CATEGORIES.includes(activeKit.categoria) && (
                        <option value={activeKit.categoria}>{activeKit.categoria}</option>
                      )}
                      {KIT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Totalizador Patrimonial do Kit */}
                <div className="px-3 py-1.5 rounded-lg bg-[#cad4e6] border border-black flex items-center gap-3 shrink-0">
                  <div>
                    <div className="text-[9px] font-black uppercase text-slate-700 leading-none">
                      Valor Total do Kit
                    </div>
                    <div className="text-sm font-black font-mono text-emerald-800 leading-tight">
                      {formatCurrencyBRL(activeKitTotal)}
                    </div>
                  </div>
                  {onApplyKitShortcut && (
                    <button
                      type="button"
                      onClick={() => onApplyKitShortcut(activeKit.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white border border-black text-[11px] font-bold cursor-pointer transition"
                      title="Ir para Caixa Fixa e aplicar este kit em um veículo"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Aplicar em Veículo</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <input
                  type="text"
                  value={activeKit.descricao || ''}
                  onChange={e => handleUpdateActiveKitField({ descricao: e.target.value })}
                  placeholder="Descrição ou observação técnica do kit..."
                  className="flex-1 min-w-0 px-2.5 py-1 rounded-md border border-slate-400 bg-white text-[11px] font-medium text-zinc-800"
                />
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAutoLinkStockItems}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-black bg-[#cad4e6] hover:bg-[#b8c6de] text-black text-[11px] font-bold cursor-pointer shrink-0"
                    title="Busca no Estoque Geral produtos com nome correspondente aos itens ainda sem vínculo e preenche vínculo e custo R$ da última entrada fiscal"
                  >
                    <span>🔗 Auto-Vincular Estoque</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncAllCostsFromStock}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-black bg-[#cad4e6] hover:bg-[#b8c6de] text-black text-[11px] font-bold cursor-pointer shrink-0"
                    title="Atualiza o valor unitário R$ dos itens vinculados com o custo atual do estoque / última NF-e"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Atualizar Custos do Estoque</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Formulário para Adicionar Nova Ferramenta ao Kit (Com vínculo ao Estoque / NF-e) */}
            <form
              onSubmit={handleAddItemToKit}
              className="shrink-0 mb-2.5 p-2.5 rounded-lg bg-[#cad4e6]/80 border border-black space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10.5px] font-black uppercase text-black flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Adicionar Ferramenta ao Kit (Puxe do Estoque ou Digite Manualmente)</span>
                </span>
                {itemLinkedProductId && (
                  <button
                    type="button"
                    onClick={() => {
                      setItemLinkedProductId('');
                      setStockSearch('');
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Desvincular produto do estoque</span>
                  </button>
                )}
              </div>

              {/* Busca no Estoque */}
              <div className="relative">
                <Package className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stockSearch}
                  onFocus={() => setIsStockDropdownOpen(true)}
                  onChange={e => {
                    setStockSearch(e.target.value);
                    setIsStockDropdownOpen(true);
                  }}
                  placeholder="Opcional: Pesquisar produto no Estoque Geral para puxar custo R$ da NF-e..."
                  className="w-full pl-8 pr-20 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-semibold text-zinc-900"
                />
                {isStockDropdownOpen && (
                  <button
                    type="button"
                    onClick={() => setIsStockDropdownOpen(false)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600 hover:text-black cursor-pointer"
                  >
                    Fechar
                  </button>
                )}

                {isStockDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-40 max-h-48 overflow-y-auto rounded-lg border border-black bg-white shadow-xl divide-y divide-slate-200">
                    {filteredStockProducts.length === 0 ? (
                      <div className="px-3 py-2.5 text-center text-[11px] text-slate-600">
                        Nenhum produto encontrado no estoque para &ldquo;{stockSearch}&rdquo;.
                      </div>
                    ) : (
                      filteredStockProducts.map(prod => {
                        const cost = resolveInventoryUnitCost(prod);
                        const qty = Number(prod.quantidade_atual ?? prod.quantity ?? 0);
                        const un = prod.unidade_medida || prod.unit || 'UN';
                        const code = prod.code ?? prod.codigo_produto ?? '';
                        return (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => handlePickStockProduct(prod)}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#e0e6f1] flex items-center justify-between gap-2 cursor-pointer text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-zinc-900">
                                {code ? `[${code}] ` : ''}
                                {prod.nome_comercial || prod.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-[11px]">
                              <span className="font-mono font-bold text-emerald-800">
                                Custo: {formatCurrencyBRL(cost)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-bold text-slate-700">
                                Saldo: {qty} {un}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-[9.5px] font-bold uppercase text-slate-800 mb-0.5">
                    Código
                  </label>
                  <input
                    type="text"
                    value={itemCodigo}
                    onChange={e => setItemCodigo(e.target.value)}
                    placeholder="Auto"
                    className="w-full px-2 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-mono font-bold text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[9.5px] font-bold uppercase text-slate-800 mb-0.5">
                    Nome da Ferramenta *
                  </label>
                  <input
                    type="text"
                    value={itemNome}
                    onChange={e => setItemNome(e.target.value)}
                    required
                    placeholder="Ex: Chave Combinada 19mm"
                    className="w-full px-2 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[9.5px] font-bold uppercase text-slate-800 mb-0.5">
                    Qtd
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={itemQtd}
                    onChange={e => setItemQtd(e.target.value)}
                    className="w-full px-1.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-black text-center text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9.5px] font-bold uppercase text-slate-800 mb-0.5">
                    Unid.
                  </label>
                  <select
                    value={itemUnidade}
                    onChange={e => setItemUnidade(e.target.value)}
                    className="w-full px-1.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
                  >
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9.5px] font-bold uppercase text-slate-800 mb-0.5">
                    Valor Unit. (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemValorUnit}
                    onChange={e => setItemValorUnit(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-mono font-bold text-right text-zinc-900"
                  />
                </div>
                <div className="sm:col-span-1">
                  <button
                    type="submit"
                    className="w-full py-1.5 px-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white border border-black text-xs font-bold flex items-center justify-center cursor-pointer"
                    title="Adicionar ao Kit"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>

            {/* Tabela de Itens do Kit (Totalmente Editável e Sem Rolagem Horizontal) */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden border border-black rounded-lg bg-[#e0e6f1]">
              <table className="w-full table-fixed text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-[#cad4e6] border-b border-black">
                  <tr className="text-[10px] font-black uppercase text-black tracking-tight">
                    <th className="py-1.5 px-1.5 border-b border-black w-16">Código</th>
                    <th className="py-1.5 px-1.5 border-b border-black w-auto min-w-0">Ferramenta / Vínculo Estoque</th>
                    <th className="py-1.5 px-1.5 border-b border-black text-center w-14">Qtd</th>
                    <th className="py-1.5 px-1.5 border-b border-black text-center w-20">Unid.</th>
                    <th className="py-1.5 px-1.5 border-b border-black text-right w-20">Valor Unit. (R$)</th>
                    <th className="py-1.5 px-1.5 border-b border-black text-right w-22">Subtotal</th>
                    <th className="py-1.5 px-1.5 border-b border-black text-center w-10">Ação</th>
                  </tr>
                </thead>
                <tbody className="bg-[#e0e6f1] divide-y divide-black/15">
                  {activeKit.itens.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs font-bold text-slate-700">
                        Este kit ainda não possui ferramentas. Adicione itens no formulário acima.
                      </td>
                    </tr>
                  ) : (
                    activeKit.itens.map(item => {
                      const subtotal =
                        Math.max(0, Number(item.quantidade) || 0) *
                        Math.max(0, Number(item.valor_unitario) || 0);
                      const linkedProd = item.produto_id
                        ? products.find(p => p.id === item.produto_id)
                        : undefined;
                      return (
                        <tr key={item.id} className="bg-[#e0e6f1] hover:bg-[#d2dced] transition">
                          <td className="py-1.5 px-1.5 align-middle">
                            <input
                              type="text"
                              value={item.codigo}
                              onChange={e =>
                                handleUpdateKitItem(item.id, { codigo: e.target.value })
                              }
                              className="w-full min-w-0 px-1 py-1 rounded border border-slate-400 bg-white font-mono font-bold text-[11px] text-zinc-900"
                            />
                          </td>
                          <td className="py-1.5 px-1.5 align-middle space-y-1 min-w-0">
                            <input
                              type="text"
                              value={item.nome}
                              onChange={e =>
                                handleUpdateKitItem(item.id, { nome: e.target.value })
                              }
                              className="w-full min-w-0 px-1.5 py-1 rounded border border-slate-400 bg-white font-bold text-xs text-zinc-900"
                            />
                            <div className="flex items-center gap-1 min-w-0 w-full">
                              <Link2 className="w-3 h-3 text-slate-600 shrink-0" />
                              <select
                                value={item.produto_id || ''}
                                onChange={e =>
                                  handleLinkExistingItemToStock(item.id, e.target.value)
                                }
                                className="flex-1 min-w-0 w-full truncate px-1 py-0.5 rounded border border-slate-400 bg-white text-[10.5px] font-semibold text-slate-800"
                              >
                                <option value="">Sem vínculo direto (Valor manual R$)</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.code ? `[${p.code}] ` : ''}
                                    {p.nome_comercial || p.name} (Est.:{' '}
                                    {Number(p.quantidade_atual ?? p.quantity ?? 0)} •{' '}
                                    {formatCurrencyBRL(resolveInventoryUnitCost(p))})
                                  </option>
                                ))}
                              </select>
                              {linkedProd && (
                                <span className="px-1 py-0.5 rounded bg-emerald-100 border border-emerald-400 text-emerald-900 text-[9px] font-black shrink-0 whitespace-nowrap">
                                  Est: {Number(linkedProd.quantidade_atual ?? linkedProd.quantity ?? 0)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-1.5 align-middle text-center">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantidade}
                              onChange={e =>
                                handleUpdateKitItem(item.id, {
                                  quantidade: Math.max(0.01, parseFloat(e.target.value) || 1),
                                })
                              }
                              className="w-full min-w-0 px-1 py-1 rounded border border-slate-400 bg-white font-black text-xs text-center text-zinc-900"
                            />
                          </td>
                          <td className="py-1.5 px-1.5 align-middle text-center">
                            <select
                              value={item.unidade}
                              onChange={e =>
                                handleUpdateKitItem(item.id, { unidade: e.target.value })
                              }
                              className="w-full min-w-0 px-1 py-1 rounded border border-slate-400 bg-white font-bold text-[11px] text-zinc-900"
                            >
                              {!UNIT_OPTIONS.includes(item.unidade) && (
                                <option value={item.unidade}>{item.unidade}</option>
                              )}
                              {UNIT_OPTIONS.map(u => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-1.5 align-middle text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.valor_unitario}
                              onChange={e =>
                                handleUpdateKitItem(item.id, {
                                  valor_unitario: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-full min-w-0 px-1 py-1 rounded border border-slate-400 bg-white font-mono font-bold text-xs text-right text-zinc-900"
                            />
                          </td>
                          <td className="py-1.5 px-1.5 align-middle text-right font-mono font-black text-[11px] text-zinc-900 whitespace-nowrap truncate">
                            {formatCurrencyBRL(subtotal)}
                          </td>
                          <td className="py-1.5 px-1.5 align-middle text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveKitItem(item.id)}
                              title="Remover ferramenta do kit"
                              className="p-1 rounded text-rose-700 hover:bg-rose-100 cursor-pointer inline-flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
