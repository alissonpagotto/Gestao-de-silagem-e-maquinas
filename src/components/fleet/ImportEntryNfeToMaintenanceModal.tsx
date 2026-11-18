import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  ChevronDown,
  Download,
  FileText,
  Package,
  Search,
  Square,
  Wrench,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  DocumentoEntradaRecord,
  InventoryItem,
  MaintenancePartItem,
} from '../../types';
import {
  formatCurrencyBRL,
  getStoredInventory,
  saveStoredInventory,
} from '../../lib/storage';
import { upsertEstoqueItem } from '../../lib/supabaseService';
import {
  ResolvedEntryInvoiceItem,
  buildMaintenancePartFromEntryItem,
  getAllAvailableEntryDocuments,
  getDocumentoEntradaDate,
  getDocumentoEntradaNumber,
  getDocumentoEntradaSupplier,
  getDocumentoEntradaTotal,
  resolveDocumentoEntradaItems,
} from '../../utils/entryToMaintenancePrefill';

interface ImportEntryNfeToMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  onSaveInventory?: (updated: InventoryItem[]) => void;
  initialDocument?: DocumentoEntradaRecord | null;
  onConfirmImport: (payload: {
    documentoEntrada: DocumentoEntradaRecord;
    partsItems: MaintenancePartItem[];
  }) => void;
}

interface SelectableEntryItemRow {
  item: ResolvedEntryInvoiceItem;
  selected: boolean;
  qtyAppliedInput: string;
}

const formatDatePtBr = (isoDate?: string): string => {
  if (!isoDate) return 'S/ Data';
  const clean = isoDate.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
};

const parseDecimalInput = (raw: string): number => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
};

export const ImportEntryNfeToMaintenanceModal: React.FC<ImportEntryNfeToMaintenanceModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onSaveInventory,
  initialDocument,
  onConfirmImport,
}) => {
  const [availableDocs, setAvailableDocs] = useState<DocumentoEntradaRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState<boolean>(false);
  const [rows, setRows] = useState<SelectableEntryItemRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const comboboxRef = useRef<HTMLDivElement>(null);

  const liveInventory = useMemo(() => {
    const stored = getStoredInventory();
    return stored.length > 0 ? stored : inventory;
  }, [inventory, isOpen]);

  const formatDocLabel = (doc: DocumentoEntradaRecord): string => {
    const num = getDocumentoEntradaNumber(doc) || 'S/N';
    const datePt = formatDatePtBr(getDocumentoEntradaDate(doc));
    const sup = getDocumentoEntradaSupplier(doc);
    const total = formatCurrencyBRL(getDocumentoEntradaTotal(doc));
    return `NF-e Nº ${num} - ${datePt} - ${sup} - ${total}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    const docs = getAllAvailableEntryDocuments();
    if (initialDocument && !docs.some((d) => d.id === initialDocument.id)) {
      docs.unshift(initialDocument);
    }
    setAvailableDocs(docs);
    setErrorMsg('');

    if (initialDocument) {
      setSelectedDocId(initialDocument.id);
      setDocSearchQuery(formatDocLabel(initialDocument));
      setIsDocDropdownOpen(false);
    } else if (docs.length > 0) {
      setSelectedDocId('');
      setDocSearchQuery('');
      setIsDocDropdownOpen(true);
    } else {
      setSelectedDocId('');
      setDocSearchQuery('');
      setIsDocDropdownOpen(false);
    }
  }, [isOpen, initialDocument]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsDocDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selectedDoc = useMemo(
    () => availableDocs.find((d) => d.id === selectedDocId) || null,
    [availableDocs, selectedDocId]
  );

  useEffect(() => {
    if (!isOpen || !selectedDoc) {
      setRows([]);
      return;
    }
    const resolvedItems = resolveDocumentoEntradaItems(selectedDoc, liveInventory);
    setRows(
      resolvedItems.map((item) => ({
        item,
        selected: true,
        qtyAppliedInput: String(item.quantidade).replace('.', ','),
      }))
    );
    setErrorMsg('');
  }, [isOpen, selectedDoc, liveInventory]);

  const filteredDocs = useMemo(() => {
    const q = String(docSearchQuery ?? '').trim().toLowerCase();
    if (!q || (selectedDoc && docSearchQuery === formatDocLabel(selectedDoc))) {
      return availableDocs;
    }
    return availableDocs.filter((doc) => {
      const label = String(formatDocLabel(doc) ?? '').toLowerCase();
      const nat = String(doc.natureza_operacao || doc.tipo_documento || '').toLowerCase();
      return label.includes(q) || nat.includes(q);
    });
  }, [availableDocs, docSearchQuery, selectedDoc]);

  if (!isOpen) return null;

  const selectedCount = rows.filter((r) => r.selected).length;
  const totalSelectedValue = rows.reduce((acc, row) => {
    if (!row.selected) return acc;
    const qty = Math.max(0, parseDecimalInput(row.qtyAppliedInput));
    return acc + qty * (Number(row.item.valor_unitario) || 0);
  }, 0);

  const handleSelectDoc = (doc: DocumentoEntradaRecord) => {
    setSelectedDocId(doc.id);
    setDocSearchQuery(formatDocLabel(doc));
    setIsDocDropdownOpen(false);
    setErrorMsg('');
  };

  const handleToggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
    setErrorMsg('');
  };

  const handleConfirm = () => {
    if (!selectedDoc) {
      setErrorMsg('Selecione uma Nota Fiscal de Entrada no Passo 1 para continuar.');
      return;
    }
    const activeRows = rows.filter((r) => r.selected);
    if (activeRows.length === 0) {
      setErrorMsg('Marque pelo menos 1 item da nota para lançar na Ordem de Serviço.');
      return;
    }

    const partsToInsert: MaintenancePartItem[] = [];
    for (const row of activeRows) {
      const qtyApplied = parseDecimalInput(row.qtyAppliedInput);
      if (qtyApplied <= 0) {
        setErrorMsg(
          `Informe uma quantidade maior que zero para o item "${row.item.descricao}".`
        );
        return;
      }
      partsToInsert.push(buildMaintenancePartFromEntryItem(row.item, qtyApplied, selectedDoc));
    }

    // Executa imediatamente a baixa proporcional (apenas qtyApplied) no estoque local + Supabase
    const stored = getStoredInventory();
    const baseStock = stored.length > 0 ? [...stored] : [...liveInventory];
    const modifiedProducts: InventoryItem[] = [];

    if (baseStock.length > 0) {
      partsToInsert.forEach((part) => {
        const targetIdx = baseStock.findIndex(
          (inv) =>
            (part.inventoryItemId && inv.id === part.inventoryItemId) ||
            (inv.name &&
              part.description &&
              String(inv.name ?? '').trim().toLowerCase() === String(part.description ?? '').trim().toLowerCase()) ||
            (inv.nome_comercial &&
              part.description &&
              String(inv.nome_comercial ?? '').trim().toLowerCase() === String(part.description ?? '').trim().toLowerCase())
        );

        if (targetIdx !== -1) {
          const currentQty =
            Number(baseStock[targetIdx].quantidade_atual ?? baseStock[targetIdx].quantity) || 0;
          const nextQty = Math.round((currentQty - part.quantity) * 100) / 100;
          const updatedItem: InventoryItem = {
            ...baseStock[targetIdx],
            quantity: nextQty,
            quantidade_atual: nextQty,
            updatedAt: new Date().toISOString(),
          };
          baseStock[targetIdx] = updatedItem;
          modifiedProducts.push(updatedItem);
        }
      });

      if (modifiedProducts.length > 0) {
        saveStoredInventory(baseStock);
        onSaveInventory?.(baseStock);
        window.dispatchEvent(new CustomEvent('silagem_inventory_changed'));
        modifiedProducts.forEach((prod) => {
          upsertEstoqueItem(prod).catch((err) =>
            console.warn('Supabase upsertEstoqueItem proporcional OS notice:', err)
          );
        });
      }
    }

    onConfirmImport({
      documentoEntrada: selectedDoc,
      partsItems: partsToInsert,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-4xl bg-[#cad4e6] border-2 border-black rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial */}
        <div className="bg-[#233248] text-white px-4 py-3 flex items-center justify-between border-b border-black shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-emerald-600 border border-emerald-400 flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide">
                Importar Peças de Nota Fiscal de Entrada para a OS
              </h3>
              <p className="text-[11px] text-slate-300">
                Selecione a NF-e e informe a quantidade exata a aplicar — o restante permanece no saldo do Estoque.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com Scroll Vertical */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-500 text-rose-800 px-3 py-2 rounded text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* PASSO 1: SELECIONAR NOTA FISCAL DE ENTRADA */}
          <div className="bg-[#e0e6f1] border border-black rounded p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-slate-800" />
                <span>Passo 1: Selecionar a Nota Fiscal de Entrada Salva</span>
              </span>
              <span className="text-[11px] font-bold text-slate-700">
                {availableDocs.length} nota(s) disponível(is)
              </span>
            </div>

            <div ref={comboboxRef} className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={docSearchQuery}
                  onFocus={() => setIsDocDropdownOpen(true)}
                  onChange={(e) => {
                    setDocSearchQuery(e.target.value);
                    setIsDocDropdownOpen(true);
                  }}
                  placeholder="Digite nº da nota, fornecedor ou data para filtrar..."
                  className="w-full pl-9 pr-16 py-2 bg-white border border-black rounded text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                />
                {docSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDocId('');
                      setDocSearchQuery('');
                      setIsDocDropdownOpen(true);
                    }}
                    className="absolute right-8 p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
                    title="Limpar seleção"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDocDropdownOpen((v) => !v)}
                  className="absolute right-2 p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Expandir lista de notas"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {isDocDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border-2 border-black rounded shadow-xl z-30 divide-y divide-slate-200">
                  {filteredDocs.length === 0 ? (
                    <div className="p-3 text-xs text-slate-600 font-semibold text-center">
                      Nenhuma nota de entrada encontrada com esse filtro.
                    </div>
                  ) : (
                    filteredDocs.map((doc) => {
                      const isSelected = doc.id === selectedDocId;
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => handleSelectDoc(doc)}
                          className={`w-full text-left px-3 py-2 text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-sky-100 text-sky-950 font-black'
                              : 'hover:bg-slate-100 text-slate-800 font-semibold'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate">{formatDocLabel(doc)}</div>
                            {(doc.natureza_operacao || doc.tipo_documento) && (
                              <div className="text-[10px] text-slate-500 font-medium truncate">
                                {doc.tipo_documento}
                                {doc.natureza_operacao ? ` • ${doc.natureza_operacao}` : ''}
                              </div>
                            )}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-sky-700 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PASSO 2: CHECKLIST DE ITENS + BAIXA PROPORCIONAL */}
          <div className="bg-[#e0e6f1] border border-black rounded p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5">
                <Package className="w-4 h-4 text-slate-800" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Passo 2: Selecione os Itens e a Quantidade Aplicada na OS
                </span>
              </div>

              {rows.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAll(true)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-black rounded text-[11px] font-bold text-slate-800 cursor-pointer"
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAll(false)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-black rounded text-[11px] font-bold text-slate-800 cursor-pointer"
                  >
                    Desmarcar Todos
                  </button>
                </div>
              )}
            </div>

            {!selectedDoc ? (
              <div className="bg-white border border-slate-400 rounded p-6 text-center text-xs font-semibold text-slate-600">
                Escolha uma Nota Fiscal no Passo 1 para carregar a lista de peças e produtos.
              </div>
            ) : rows.length === 0 ? (
              <div className="bg-white border border-amber-500 rounded p-5 text-center space-y-1">
                <div className="text-xs font-black text-amber-800">
                  Esta nota de entrada não possui itens detalhados vinculados.
                </div>
                <div className="text-[11px] text-slate-600">
                  Verifique se os produtos foram lançados na revisão da NF-e ou na Entrada Manual antes de importar para a OS.
                </div>
              </div>
            ) : (
              <div className="bg-white border border-black rounded overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#233248] text-white text-[10px] uppercase tracking-wider">
                      <th className="p-2 text-center w-10 border-r border-slate-600">Usar</th>
                      <th className="p-2 text-left border-r border-slate-600">
                        Item da Nota / Produto Estoque (De-Para)
                      </th>
                      <th className="p-2 text-center w-24 border-r border-slate-600">Qtd na Nota</th>
                      <th className="p-2 text-center w-28 border-r border-slate-600">
                        Qtd a Aplicar na OS
                      </th>
                      <th className="p-2 text-right w-28 border-r border-slate-600">
                        Valor Unit.
                      </th>
                      <th className="p-2 text-right w-28">Subtotal OS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {rows.map((row, idx) => {
                      const qtyApplied = Math.max(0, parseDecimalInput(row.qtyAppliedInput));
                      const subtotal = qtyApplied * (Number(row.item.valor_unitario) || 0);
                      const invMatch = row.item.matchedInventory;
                      const currentStock = invMatch
                        ? Number(invMatch.quantidade_atual ?? invMatch.quantity) || 0
                        : null;

                      return (
                        <tr
                          key={row.item.id || idx}
                          className={row.selected ? 'bg-emerald-50/60' : 'bg-slate-50 opacity-70'}
                        >
                          <td className="p-2 text-center border-r border-slate-200">
                            <button
                              type="button"
                              onClick={() =>
                                setRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, selected: !r.selected } : r
                                  )
                                )
                              }
                              className="inline-flex items-center justify-center text-slate-800 cursor-pointer"
                            >
                              {row.selected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-700" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>
                          <td className="p-2 border-r border-slate-200">
                            <div className="font-bold text-slate-900">
                              {row.item.descricao}
                            </div>
                            <div className="text-[10px] text-slate-600 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                              {invMatch ? (
                                <span className="text-emerald-800 font-bold">
                                  Estoque: {invMatch.nome_comercial || invMatch.name} (Saldo atual:{' '}
                                  {currentStock} {invMatch.unit || row.item.unidade})
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold">
                                  Sem vínculo direto no catálogo (será lançado pelo custo da nota)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                            {row.item.quantidade} {row.item.unidade}
                          </td>
                          <td className="p-2 text-center border-r border-slate-200">
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={!row.selected}
                              value={row.qtyAppliedInput}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, qtyAppliedInput: val } : r
                                  )
                                );
                              }}
                              className="w-20 text-center px-2 py-1 bg-white border border-black rounded text-xs font-black text-slate-900 disabled:bg-slate-200"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                            {formatCurrencyBRL(row.item.valor_unitario)}
                          </td>
                          <td className="p-2 text-right font-mono font-black text-emerald-800">
                            {row.selected ? formatCurrencyBRL(subtotal) : 'R$ 0,00'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-white border border-slate-400 rounded px-3 py-2 text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Regra de Saldo e Financeiro:</strong> Apenas a quantidade aplicada será
                subtraída do Estoque. A NF-e vinculada ativa o modo{' '}
                <strong>DRE Gerencial</strong> para evitar duplicação no Contas a Pagar.
              </span>
              <span className="font-mono font-black text-xs text-slate-900">
                {selectedCount} item(ns) • Total na OS: {formatCurrencyBRL(totalSelectedValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-[#e0e6f1] border-t border-black px-4 py-3 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-black rounded text-xs font-bold text-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDoc || rows.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white border border-black rounded text-xs font-black flex items-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>✅ Lançar Itens Selecionados na OS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
