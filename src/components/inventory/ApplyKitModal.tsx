import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Package, X, Zap } from 'lucide-react';
import {
  CaixaFerramentaVeiculoRecord,
  InventoryItem,
  Machinery,
} from '../../types';
import { formatCurrencyBRL } from '../../lib/formatters';
import { resolveInventoryUnitCost, ToolKitRecord } from '../../lib/toolKitsStorage';

interface ApplyKitModalProps {
  isOpen: boolean;
  vehicle?: Machinery;
  toolKits: ToolKitRecord[];
  existingItems: CaixaFerramentaVeiculoRecord[];
  products: InventoryItem[];
  initialKitId?: string;
  isApplying?: boolean;
  onClose: () => void;
  onConfirmApply: (params: {
    kit: ToolKitRecord;
    deductFromStock: boolean;
  }) => Promise<void> | void;
}

export const ApplyKitModal: React.FC<ApplyKitModalProps> = ({
  isOpen,
  vehicle,
  toolKits,
  existingItems,
  products,
  initialKitId,
  isApplying = false,
  onClose,
  onConfirmApply,
}) => {
  const [selectedKitId, setSelectedKitId] = useState<string>(
    () => initialKitId || toolKits[0]?.id || ''
  );
  const [deductFromStock, setDeductFromStock] = useState<boolean>(true);

  const selectedKit = useMemo(() => {
    return toolKits.find(k => k.id === selectedKitId) || toolKits[0] || null;
  }, [toolKits, selectedKitId]);

  const previewRows = useMemo(() => {
    if (!selectedKit) return [];
    return selectedKit.itens.map(item => {
      const jaExiste = existingItems.some(
        ex =>
          String(ex.codigo_item_ferramenta ?? '').toLowerCase() ===
            String(item.codigo ?? '').toLowerCase() ||
          String(ex.nome_ferramenta ?? '').toLowerCase() ===
            String(item.nome ?? '').toLowerCase()
      );
      const linkedProd = item.produto_id
        ? products.find(p => p.id === item.produto_id)
        : undefined;
      const saldoAtual = linkedProd
        ? Number(linkedProd.quantidade_atual ?? linkedProd.quantity ?? 0)
        : null;
      const unitVal =
        Number(item.valor_unitario) > 0
          ? Number(item.valor_unitario)
          : resolveInventoryUnitCost(linkedProd);
      const insufficientStock =
        deductFromStock &&
        !jaExiste &&
        linkedProd !== undefined &&
        saldoAtual !== null &&
        saldoAtual < Number(item.quantidade || 0);

      return {
        item,
        jaExiste,
        linkedProd,
        saldoAtual,
        unitVal,
        subtotal: unitVal * Number(item.quantidade || 0),
        insufficientStock,
      };
    });
  }, [selectedKit, existingItems, products, deductFromStock]);

  if (!isOpen) return null;

  const newItemsCount = previewRows.filter(r => !r.jaExiste).length;
  const linkedNewCount = previewRows.filter(r => !r.jaExiste && r.linkedProd).length;
  const hasStockConflict = previewRows.some(r => r.insufficientStock);
  const kitTotalValue = previewRows.reduce((s, r) => s + r.subtotal, 0);

  return createPortal(
    <div className="no-print fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#cad4e6] border border-black rounded-xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Topo */}
        <div className="px-4 py-3 bg-[#cad4e6] border-b border-black flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white border border-black flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-black leading-tight">
                Aplicar Kit Padrão na Caixa do Veículo
              </h3>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
                Veículo: {vehicle?.name || 'Selecionado'}
                {vehicle?.plateOrSerial ? ` (${vehicle.plateOrSerial})` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-black/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-3.5 bg-[#e0e6f1] flex-1 min-h-0 overflow-y-auto space-y-3">
          {/* Seleção do Kit */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-8">
              <label className="block text-[10px] font-black uppercase text-slate-800 mb-1">
                Escolha o Kit Padrão Cadastrado *
              </label>
              <select
                value={selectedKit?.id || ''}
                onChange={e => setSelectedKitId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-400 bg-white text-xs font-black text-zinc-900"
              >
                {toolKits.map(kit => (
                  <option key={kit.id} value={kit.id}>
                    {kit.nome} ({kit.itens.length} itens • {kit.categoria})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4 px-3 py-1.5 rounded-lg bg-[#cad4e6] border border-black">
              <div className="text-[9.5px] font-black uppercase text-slate-700">
                Valor Total do Kit
              </div>
              <div className="text-sm font-black font-mono text-emerald-800">
                {formatCurrencyBRL(kitTotalValue)}
              </div>
            </div>
          </div>

          {/* Opção de Baixa no Estoque Geral */}
          <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#cad4e6] border border-black cursor-pointer">
            <input
              type="checkbox"
              checked={deductFromStock}
              onChange={e => setDeductFromStock(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-700 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-black text-zinc-900 block">
                Baixar quantidade do Estoque Geral ao confirmar ({linkedNewCount} item(ns) novo(s) vinculado(s) ao estoque)
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                Quando marcado, ferramentas do kit vinculadas a um produto do estoque serão abatidas do saldo disponível em Estoque Geral. Itens de referência sem vínculo direto são lançados normalmente na caixa.
              </span>
            </div>
          </label>

          {hasStockConflict && (
            <div className="p-2.5 rounded-lg bg-rose-100 border border-rose-500 text-rose-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
              <span>
                Saldo insuficiente no Estoque Geral para um ou mais itens vinculados marcados abaixo. Desmarque a baixa de estoque ou ajuste o saldo antes de continuar.
              </span>
            </div>
          )}

          {/* Tabela Prévia */}
          <div className="border border-black rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#cad4e6] border-b border-black">
                <tr className="text-[10px] font-black uppercase text-black">
                  <th className="py-1.5 px-2.5">Código</th>
                  <th className="py-1.5 px-2.5">Ferramenta</th>
                  <th className="py-1.5 px-2.5 text-center">Qtd</th>
                  <th className="py-1.5 px-2.5 text-right">Valor Unit.</th>
                  <th className="py-1.5 px-2.5 text-right">Subtotal</th>
                  <th className="py-1.5 px-2.5 text-center">Situação / Estoque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/15">
                {previewRows.map(row => (
                  <tr
                    key={row.item.id}
                    className={row.jaExiste ? 'bg-slate-100/70 opacity-75' : 'bg-[#e0e6f1]/45'}
                  >
                    <td className="py-1.5 px-2.5 font-mono font-bold text-zinc-900">
                      {row.item.codigo}
                    </td>
                    <td className="py-1.5 px-2.5 font-bold text-zinc-900">
                      {row.item.nome}
                    </td>
                    <td className="py-1.5 px-2.5 text-center font-black">
                      {row.item.quantidade} {row.item.unidade}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono">
                      {formatCurrencyBRL(row.unitVal)}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold">
                      {formatCurrencyBRL(row.subtotal)}
                    </td>
                    <td className="py-1.5 px-2.5 text-center">
                      {row.jaExiste ? (
                        <span className="px-2 py-0.5 rounded bg-slate-200 border border-slate-400 text-[10px] font-bold text-slate-700">
                          Já na caixa (ignorado)
                        </span>
                      ) : row.linkedProd ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black border ${
                            row.insufficientStock
                              ? 'bg-rose-100 border-rose-500 text-rose-900'
                              : 'bg-emerald-100 border-emerald-500 text-emerald-900'
                          }`}
                        >
                          <Package className="w-3 h-3" />
                          Est.: {row.saldoAtual}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-400 text-[10px] font-bold text-amber-900">
                          Novo • Referência
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-t border-black flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-800">
            {newItemsCount} novo(s) item(ns) será(ão) adicionado(s) ao veículo.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-slate-500 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selectedKit || newItemsCount === 0 || hasStockConflict || isApplying}
              onClick={() => selectedKit && onConfirmApply({ kit: selectedKit, deductFromStock })}
              className="px-4 py-1.5 rounded-md border border-black bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {isApplying
                  ? 'Aplicando Kit...'
                  : `Confirmar e Aplicar ${newItemsCount} Item(ns)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
