import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Search,
  X,
  User,
  Clock,
  CheckSquare,
  Package,
  ShieldAlert,
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';
import {
  getLoggedAuditUserName,
  formatCurrentAuditDateTimeBR,
} from '../../lib/financialAudit';

interface ZeroStockAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: InventoryItem[];
  onConfirmZeroItems: (params: {
    selectedIds: string[];
    reason: string;
    auditUser: string;
    auditDateTime: string;
    totalValue: number;
  }) => void;
}

interface ZeroStockRow {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

function roundQty(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

function formatQtyBR(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export const ZeroStockAuditModal: React.FC<ZeroStockAuditModalProps> = ({
  isOpen,
  onClose,
  allItems,
  onConfirmZeroItems,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('TODAS');
  const [onlyPositiveBalance, setOnlyPositiveBalance] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Pop-up de confirmação auditada
  const [isConfirmPopupOpen, setIsConfirmPopupOpen] = useState(false);
  const [zeroReason, setZeroReason] = useState('');
  const [auditUser, setAuditUser] = useState('');
  const [auditDateTime, setAuditDateTime] = useState('');

  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setCategoryFilter('TODAS');
    setOnlyPositiveBalance(true);
    setSelectedIds(new Set());
    setIsConfirmPopupOpen(false);
    setZeroReason('');
    setAuditUser(getLoggedAuditUserName());
    setAuditDateTime(formatCurrentAuditDateTimeBR());
  }, [isOpen]);

  // Lista normalizada de itens físicos (exclui SERVIÇO)
  const normalizedRows = useMemo<ZeroStockRow[]>(() => {
    return allItems
      .filter((item) => {
        if (!item || !item.id) return false;
        const tipo = String(item.tipo_item || '').toUpperCase();
        const cat = String(item.categoria || item.category || '').toUpperCase();
        if (tipo === 'SERVIÇO' || tipo === 'SERVICO' || cat === 'SERVIÇO' || cat === 'SERVICO') {
          return false;
        }
        return true;
      })
      .map((item) => {
        const quantity = roundQty(Number(item.quantidade_atual ?? item.quantity ?? 0) || 0);
        const unitCost = Number(item.preco_custo_inicial ?? item.unitCost ?? 0) || 0;
        const subtotal = Math.round(quantity * unitCost * 100) / 100;
        return {
          id: item.id,
          code: String(item.code || item.codigo_produto || '').trim() || '—',
          name: String(item.nome_comercial || item.name || item.nome || 'Produto sem nome').trim(),
          category: String(item.categoria || item.category || 'Outros Insumos').trim(),
          unit: String(item.unidade_medida || item.unit || 'UN').toUpperCase(),
          quantity,
          unitCost,
          subtotal,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [allItems]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    normalizedRows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [normalizedRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return normalizedRows.filter((row) => {
      if (onlyPositiveBalance && row.quantity <= 0) return false;
      if (categoryFilter !== 'TODAS' && row.category !== categoryFilter) return false;
      if (q) {
        const matchName = row.name.toLowerCase().includes(q);
        const matchCode = row.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [normalizedRows, searchQuery, categoryFilter, onlyPositiveBalance]);

  const allFilteredSelected = useMemo(() => {
    if (filteredRows.length === 0) return false;
    return filteredRows.every((r) => selectedIds.has(r.id));
  }, [filteredRows, selectedIds]);

  const someFilteredSelected = useMemo(() => {
    if (filteredRows.length === 0) return false;
    const selectedInFilter = filteredRows.filter((r) => selectedIds.has(r.id)).length;
    return selectedInFilter > 0 && selectedInFilter < filteredRows.length;
  }, [filteredRows, selectedIds]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someFilteredSelected;
    }
  }, [someFilteredSelected]);

  const selectedRows = useMemo(() => {
    return normalizedRows.filter((r) => selectedIds.has(r.id));
  }, [normalizedRows, selectedIds]);

  const totalSelectedValue = useMemo(() => {
    return (
      Math.round(selectedRows.reduce((acc, r) => acc + r.subtotal, 0) * 100) / 100
    );
  }, [selectedRows]);

  const handleToggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredRows.forEach((r) => next.delete(r.id));
      } else {
        filteredRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenConfirmPopup = () => {
    if (selectedRows.length === 0) return;
    setAuditUser(getLoggedAuditUserName());
    setAuditDateTime(formatCurrentAuditDateTimeBR());
    setZeroReason('');
    setIsConfirmPopupOpen(true);
  };

  const handleConfirmExecution = () => {
    if (selectedRows.length === 0 || zeroReason.trim().length < 5) return;
    const finalDateTime = formatCurrentAuditDateTimeBR();
    const finalUser = getLoggedAuditUserName();
    onConfirmZeroItems({
      selectedIds: selectedRows.map((r) => r.id),
      reason: zeroReason.trim(),
      auditUser: finalUser,
      auditDateTime: finalDateTime,
      totalValue: totalSelectedValue,
    });
  };

  if (!isOpen) return null;

  const trimmedReasonLen = zeroReason.trim().length;
  const canConfirmZero = trimmedReasonLen >= 5 && selectedRows.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-3">
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#e0e6f1] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-b border-black flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 border border-black flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-black leading-tight">
                🚨 Zerar Estoque — Seleção Item a Item (Modo Balanço)
              </h3>
              <p className="text-[11px] font-semibold text-slate-800">
                Selecione os produtos cujo saldo físico será zerado (0) com registro auditável de responsável e motivo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-black/10 text-black cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-[#cad4e6] border border-black rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-xs">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                  Itens Selecionados
                </div>
                <div className="text-xl font-black font-mono text-black mt-0.5">
                  {selectedRows.length}{' '}
                  <span className="text-xs font-sans font-bold text-slate-700">
                    produto(s) marcado(s)
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#e0e6f1] border border-black flex items-center justify-center shrink-0">
                <CheckSquare className="w-4 h-4 text-red-700" />
              </div>
            </div>

            <div className="bg-[#cad4e6] border border-black rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-xs">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                  Valor Total do Saldo a Zerar (R$)
                </div>
                <div className="text-xl font-black font-mono text-red-700 mt-0.5">
                  {formatCurrencyBRL(totalSelectedValue)}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-red-100 border border-black flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-red-700" />
              </div>
            </div>
          </div>

          {/* Barra de Filtros & Seleção Rápida */}
          <div className="bg-[#cad4e6] border border-black rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome ou código..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-md bg-white border border-black text-xs font-semibold text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-md bg-white border border-black text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="TODAS">Todas as Categorias</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-black cursor-pointer select-none bg-[#e0e6f1] border border-black rounded-md px-2.5 py-1">
                <input
                  type="checkbox"
                  checked={onlyPositiveBalance}
                  onChange={(e) => setOnlyPositiveBalance(e.target.checked)}
                  className="rounded border-black text-red-600 focus:ring-red-600 cursor-pointer"
                />
                <span>Apenas itens com saldo &gt; 0</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs font-black text-black cursor-pointer select-none bg-white border border-black rounded-md px-2.5 py-1">
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={handleToggleSelectAllFiltered}
                  disabled={filteredRows.length === 0}
                  className="rounded border-black text-red-600 focus:ring-red-600 cursor-pointer"
                />
                <span>Selecionar Todos (Itens Filtrados: {filteredRows.length})</span>
              </label>
            </div>
          </div>

          {/* Tabela de Conferência */}
          <div className="bg-white border border-black rounded-lg overflow-hidden shadow-xs">
            <div className="max-h-[46vh] overflow-y-auto overflow-x-auto">
              <table className="w-full table-auto text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#cad4e6] border-b border-black text-black uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={handleToggleSelectAllFiltered}
                        disabled={filteredRows.length === 0}
                        aria-label="Selecionar todos os itens filtrados"
                        className="rounded border-black text-red-600 focus:ring-red-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2 px-2.5 whitespace-nowrap">Código</th>
                    <th className="py-2 px-3">Produto</th>
                    <th className="py-2 px-2.5">Categoria</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Saldo Atual</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Custo Unit. (R$)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Subtotal a Zerar (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/15">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-xs font-bold uppercase text-slate-600 bg-[#e0e6f1]"
                      >
                        Nenhum produto encontrado para os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const isChecked = selectedIds.has(row.id);
                      return (
                        <tr
                          key={row.id}
                          onClick={() => handleToggleRow(row.id)}
                          className={`cursor-pointer transition ${
                            isChecked
                              ? 'bg-red-50 hover:bg-red-100/80'
                              : 'bg-[#e0e6f1] hover:bg-[#d2dced]'
                          }`}
                        >
                          <td
                            className="py-2 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRow(row.id)}
                              aria-label={`Selecionar ${row.name}`}
                              className="rounded border-black text-red-600 focus:ring-red-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {row.code}
                          </td>
                          <td className="py-2 px-3 font-bold text-black uppercase">
                            {row.name}
                          </td>
                          <td className="py-2 px-2.5 text-[11px] font-semibold text-slate-800">
                            {row.category}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                            {formatQtyBR(row.quantity)}{' '}
                            <span className="text-[10px] font-semibold text-slate-700">
                              {row.unit}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {formatCurrencyBRL(row.unitCost)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-black whitespace-nowrap ${
                              isChecked ? 'text-red-700' : 'text-slate-900'
                            }`}
                          >
                            {formatCurrencyBRL(row.subtotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal de Seleção */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-t border-black flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-bold text-slate-800">
            Somente os itens marcados serão alterados para saldo <strong className="text-black">0</strong>.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-black text-xs font-bold uppercase cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              id="btn-zerar-itens-selecionados"
              onClick={handleOpenConfirmPopup}
              disabled={selectedRows.length === 0}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-black font-bold px-4 py-1.5 rounded-md text-xs shadow-sm uppercase transition active:scale-95 cursor-pointer"
            >
              <span>🚨 Zerar Itens Selecionados ({selectedRows.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* POP-UP DE CONFIRMAÇÃO AUDITADA EM DESTAQUE VERMELHO                   */}
      {/* ===================================================================== */}
      {isConfirmPopupOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-[#e0e6f1] border-2 border-red-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Cabeçalho Vermelho */}
            <div className="px-4 py-3 bg-red-600 text-white border-b border-black flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide">
                  Confirmação Auditada — Zerar Estoque
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmPopupOpen(false)}
                className="p-1 rounded hover:bg-red-700 text-white cursor-pointer"
                title="Voltar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Pergunta de Segurança */}
              <div className="p-3 rounded-lg bg-red-50 border border-red-700 text-red-950 text-xs font-bold leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <span>
                  Tem certeza absoluta que deseja zerar o saldo físico dos{' '}
                  <strong className="font-black underline">{selectedRows.length}</strong> itens
                  selecionados (Total:{' '}
                  <strong className="font-black font-mono">
                    {formatCurrencyBRL(totalSelectedValue)}
                  </strong>
                  )? Esta ação não pode ser desfeita.
                </span>
              </div>

              {/* Responsável Automático + Data/Hora */}
              <div className="bg-[#cad4e6] border border-black rounded-lg p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-800 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase text-slate-700">
                      Responsável (Usuário Logado)
                    </div>
                    <div className="font-black text-black truncate">{auditUser}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-800 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase text-slate-700">
                      Data / Hora do Registro
                    </div>
                    <div className="font-black font-mono text-black">{auditDateTime}</div>
                  </div>
                </div>
              </div>

              {/* Campo Obrigatório: Motivo da Zeragem * */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="textarea-motivo-zeragem-estoque"
                    className="block text-[11px] font-black uppercase text-black"
                  >
                    Motivo da Zeragem *
                  </label>
                  <span
                    className={`text-[10px] font-bold ${
                      trimmedReasonLen >= 5 ? 'text-emerald-800' : 'text-red-700'
                    }`}
                  >
                    {trimmedReasonLen >= 5
                      ? 'Motivo válido'
                      : `Mínimo 5 caracteres (${trimmedReasonLen}/5)`}
                  </span>
                </div>
                <textarea
                  id="textarea-motivo-zeragem-estoque"
                  rows={3}
                  value={zeroReason}
                  onChange={(e) => setZeroReason(e.target.value)}
                  placeholder="Descreva o motivo obrigatório para zerar estes itens (ex: Limpeza de inventário antigo, descarte de itens vencidos, recontagem geral)..."
                  className="w-full px-3 py-2 rounded-md bg-white border border-black text-xs font-semibold text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                  autoFocus
                />
              </div>

              {/* Ações do Pop-up */}
              <div className="pt-2 border-t border-black/20 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmPopupOpen(false)}
                  className="px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  id="btn-confirmar-zeragem-estoque-agora"
                  onClick={handleConfirmExecution}
                  disabled={!canConfirmZero}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-black font-black px-4 py-1.5 rounded-md text-xs shadow-sm uppercase transition active:scale-95 cursor-pointer"
                >
                  <span>SIM, ZERAR ESTOQUE AGORA</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
