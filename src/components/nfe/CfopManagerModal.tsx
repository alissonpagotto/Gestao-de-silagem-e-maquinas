import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  Edit2,
  FileSpreadsheet,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { CfopCatalogEntry, CfopOperacaoTipo } from '../../types';
import {
  CFOP_TIPO_LABELS,
  importOfficialSefazCfopCatalog,
  parseBatchCfopText,
  saveStoredCfopCatalog,
} from '../../lib/cfopCatalog';
import { cleanDigits } from '../../lib/formatters';

export interface CfopManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: CfopCatalogEntry[];
  onSaveCatalog: (updated: CfopCatalogEntry[]) => void;
  onSelectCfop?: (codigo: string) => void;
  initialScopeFilter?: 'all' | '5' | '6';
  initialTipoFilter?: 'all' | CfopOperacaoTipo;
}

export const CfopManagerModal: React.FC<CfopManagerModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onSaveCatalog,
  onSelectCfop,
  initialScopeFilter = 'all',
  initialTipoFilter = 'all',
}) => {
  const [newCodigo, setNewCodigo] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newTipo, setNewTipo] = useState<CfopOperacaoTipo>('venda');

  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);
  const [editingDescricao, setEditingDescricao] = useState('');
  const [editingTipo, setEditingTipo] = useState<CfopOperacaoTipo>('venda');

  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | '5' | '6'>(initialScopeFilter);
  const [tipoFilter, setTipoFilter] = useState<'all' | CfopOperacaoTipo>(initialTipoFilter);

  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [batchText, setBatchText] = useState('');

  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewCodigo('');
      setNewDescricao('');
      setNewTipo(initialTipoFilter !== 'all' ? initialTipoFilter : 'venda');
      setEditingCodigo(null);
      setEditingDescricao('');
      setSearchTerm('');
      setScopeFilter(initialScopeFilter);
      setTipoFilter('all');
      setShowBatchPanel(false);
      setBatchText('');
      setFeedbackError('');
      setFeedbackSuccess('');
    }
  }, [isOpen, initialScopeFilter, initialTipoFilter]);

  const filteredCatalog = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return catalog.filter((item) => {
      if (scopeFilter !== 'all' && !item.codigo.startsWith(scopeFilter)) return false;
      if (tipoFilter !== 'all' && item.tipo !== tipoFilter) return false;
      if (!q) return true;
      return (
        item.codigo.toLowerCase().includes(q) ||
        item.descricao.toLowerCase().includes(q) ||
        CFOP_TIPO_LABELS[item.tipo].toLowerCase().includes(q)
      );
    });
  }, [catalog, scopeFilter, tipoFilter, searchTerm]);

  if (!isOpen) return null;

  const showTempSuccess = (msg: string) => {
    setFeedbackError('');
    setFeedbackSuccess(msg);
    setTimeout(() => {
      setFeedbackSuccess((curr) => (curr === msg ? '' : curr));
    }, 4500);
  };

  const handleAddCfop = () => {
    const code = cleanDigits(newCodigo).slice(0, 4);
    const desc = newDescricao.trim();
    if (code.length !== 4) {
      setFeedbackError('Informe um código CFOP válido com exatamente 4 dígitos (ex: 5102 ou 6915).');
      return;
    }
    if (!desc) {
      setFeedbackError('Informe a descrição da operação fiscal do CFOP.');
      return;
    }
    if (catalog.some((c) => c.codigo === code)) {
      setFeedbackError(`O CFOP ${code} já está cadastrado no catálogo. Edite-o na lista abaixo.`);
      return;
    }
    const updated = saveStoredCfopCatalog([
      ...catalog,
      { codigo: code, descricao: desc, tipo: newTipo, isDefault: false },
    ]);
    onSaveCatalog(updated);
    setNewCodigo('');
    setNewDescricao('');
    showTempSuccess(`CFOP ${code} cadastrado com sucesso!`);
  };

  const handleStartEdit = (entry: CfopCatalogEntry) => {
    setFeedbackError('');
    setEditingCodigo(entry.codigo);
    setEditingDescricao(entry.descricao);
    setEditingTipo(entry.tipo);
  };

  const handleSaveEdit = (codigo: string) => {
    const desc = editingDescricao.trim();
    if (!desc) {
      setFeedbackError('A descrição do CFOP não pode ficar vazia.');
      return;
    }
    const updated = saveStoredCfopCatalog(
      catalog.map((c) =>
        c.codigo === codigo ? { ...c, descricao: desc, tipo: editingTipo } : c
      )
    );
    onSaveCatalog(updated);
    setEditingCodigo(null);
    setEditingDescricao('');
    showTempSuccess(`CFOP ${codigo} atualizado com sucesso!`);
  };

  const handleDeleteCfop = (codigo: string) => {
    const updated = saveStoredCfopCatalog(catalog.filter((c) => c.codigo !== codigo));
    onSaveCatalog(updated);
    if (editingCodigo === codigo) {
      setEditingCodigo(null);
    }
    showTempSuccess(`CFOP ${codigo} removido do catálogo.`);
  };

  const handleImportOfficialSefaz = () => {
    const { catalog: updated, addedCount } = importOfficialSefazCfopCatalog(catalog);
    onSaveCatalog(updated);
    showTempSuccess(
      addedCount > 0
        ? `Tabela Oficial SEFAZ importada! ${addedCount} novos CFOPs adicionados (total: ${updated.length}).`
        : `Catálogo já possui todos os ${updated.length} CFOPs da Tabela Oficial SEFAZ.`
    );
  };

  const handleImportBatch = () => {
    const parsed = parseBatchCfopText(batchText);
    if (parsed.length === 0) {
      setFeedbackError(
        'Nenhum CFOP válido encontrado. Use um código de 4 dígitos por linha seguido da descrição (ex: 5108 - Venda a não contribuinte).'
      );
      return;
    }
    const map = new Map<string, CfopCatalogEntry>();
    catalog.forEach((c) => map.set(c.codigo, c));
    let added = 0;
    let updatedCount = 0;
    parsed.forEach((entry) => {
      if (map.has(entry.codigo)) {
        updatedCount += 1;
      } else {
        added += 1;
      }
      map.set(entry.codigo, entry);
    });
    const updated = saveStoredCfopCatalog(Array.from(map.values()));
    onSaveCatalog(updated);
    setBatchText('');
    setShowBatchPanel(false);
    showTempSuccess(
      `Importação em lote concluída: ${added} adicionado(s) e ${updatedCount} atualizado(s)!`
    );
  };

  return (
    <div
      id="modal-gerenciar-cfop"
      className="fixed inset-0 z-[9999] bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150 text-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial AgroControl (#cad4e6 + border-black) */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-b border-black flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white border border-black flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-slate-800" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 truncate">
                GERENCIAR CATÁLOGO DE CFOPs (TABELA SEFAZ & PERSONALIZADOS)
              </h3>
              <p className="text-[11px] font-semibold text-slate-700 truncate">
                Cadastre, edite ou importe em 1 clique a Tabela Oficial SEFAZ para Vendas, Remessas, Devoluções e CT-e
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-400 text-black transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo (#cad4e6 com cards #e0e6f1 + border-black) */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 bg-[#cad4e6]">
          {/* Barra de Importação Oficial & Lote */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-slate-800">
              <span className="uppercase font-black block text-slate-900">
                Importação Rápida & Sincronização Contábil
              </span>
              <span>
                Restaure/amplie toda a tabela oficial SEFAZ ou cole códigos enviados pela sua contabilidade.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="btn-importar-tabela-sefaz-cfop"
                onClick={handleImportOfficialSefaz}
                className="px-3 py-1.5 rounded-lg bg-[#1e40af] hover:bg-[#1e3a8a] text-white text-xs font-black uppercase border border-black inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>📥 Importar Tabela Oficial SEFAZ (Catálogo Completo)</span>
              </button>
              <button
                type="button"
                id="btn-toggle-lote-cfop"
                onClick={() => setShowBatchPanel((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-black text-xs font-black uppercase border border-black inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{showBatchPanel ? 'Fechar Lote' : 'Colar Códigos em Lote'}</span>
              </button>
            </div>
          </div>

          {showBatchPanel && (
            <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-900">
                IMPORTAR CFOPs EM LOTE (1 POR LINHA: CÓDIGO - DESCRIÇÃO)
              </label>
              <textarea
                rows={4}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={`EXEMPLO:\n5108 - Venda de mercadoria adquirida para não contribuinte\n6108 - Venda interestadual para não contribuinte\n5949 - Outra saída não especificada`}
                className="w-full p-2.5 text-xs font-mono rounded-lg border border-black/50 bg-white text-black focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchPanel(false)}
                  className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border border-black/50 text-xs font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImportBatch}
                  className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 text-xs font-black uppercase cursor-pointer"
                >
                  Importar Lote
                </button>
              </div>
            </div>
          )}

          {/* Card 1: Cadastrar Novo CFOP Manualmente */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-900">
              CADASTRAR NOVO CFOP MANUALMENTE
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-2">
                <input
                  id="cfop-novo-codigo-input"
                  type="text"
                  maxLength={4}
                  value={newCodigo}
                  onChange={(e) => {
                    setNewCodigo(cleanDigits(e.target.value).slice(0, 4));
                    if (feedbackError) setFeedbackError('');
                  }}
                  placeholder="CÓD (5102)"
                  className="w-full h-8 px-2.5 text-xs font-mono font-black text-center rounded-lg border border-black/50 bg-white text-black focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-5">
                <input
                  id="cfop-novo-descricao-input"
                  type="text"
                  value={newDescricao}
                  onChange={(e) => {
                    setNewDescricao(e.target.value);
                    if (feedbackError) setFeedbackError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCfop();
                    }
                  }}
                  placeholder="Descrição fiscal da operação..."
                  className="w-full h-8 px-2.5 text-xs font-medium rounded-lg border border-black/50 bg-white text-black focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <select
                  value={newTipo}
                  onChange={(e) => setNewTipo(e.target.value as CfopOperacaoTipo)}
                  className="w-full h-8 px-2 text-xs font-bold rounded-lg border border-black/50 bg-white text-black uppercase cursor-pointer"
                >
                  <option value="venda">VENDA</option>
                  <option value="remessa_retorno">REMESSA / RETORNO</option>
                  <option value="devolucao">DEVOLUÇÃO</option>
                  <option value="transporte">TRANSPORTE (CT-E)</option>
                  <option value="outros">OUTROS / TRANSF.</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  id="btn-adicionar-cfop"
                  onClick={handleAddCfop}
                  className="w-full h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase border border-emerald-800 inline-flex items-center justify-center gap-1 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>
            {feedbackError && (
              <p className="text-[11px] font-bold text-rose-700">{feedbackError}</p>
            )}
            {feedbackSuccess && (
              <p className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-400 rounded-lg px-2.5 py-1">
                {feedbackSuccess}
              </p>
            )}
          </div>

          {/* Card 2: Lista de CFOPs Cadastrados */}
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                CFOPs CADASTRADOS ({filteredCatalog.length} DE {catalog.length})
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar código ou descrição..."
                    className="h-7 pl-7 pr-2.5 text-xs rounded-lg border border-black/40 bg-white text-black w-48 focus:outline-none focus:ring-1 focus:ring-[#1e40af]"
                  />
                </div>
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as 'all' | '5' | '6')}
                  className="h-7 px-2 text-[11px] font-bold rounded-lg border border-black/40 bg-white text-black uppercase cursor-pointer"
                >
                  <option value="all">UF: TODOS (5XXX + 6XXX)</option>
                  <option value="5">ESTADUAL (5XXX)</option>
                  <option value="6">INTERESTADUAL (6XXX)</option>
                </select>
                <select
                  value={tipoFilter}
                  onChange={(e) => setTipoFilter(e.target.value as 'all' | CfopOperacaoTipo)}
                  className="h-7 px-2 text-[11px] font-bold rounded-lg border border-black/40 bg-white text-black uppercase cursor-pointer"
                >
                  <option value="all">TIPO: TODOS</option>
                  <option value="venda">VENDA</option>
                  <option value="remessa_retorno">REMESSA / RETORNO</option>
                  <option value="devolucao">DEVOLUÇÃO</option>
                  <option value="transporte">TRANSPORTE (CT-E)</option>
                  <option value="outros">OUTROS</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-black/50 rounded-lg overflow-hidden max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 border-b border-black/30 text-[10px] font-black uppercase">
                  <tr>
                    <th className="p-2 text-center w-[72px]">CÓDIGO</th>
                    <th className="p-2 text-left">DESCRIÇÃO FISCAL</th>
                    <th className="p-2 text-center w-[140px]">OPERAÇÃO</th>
                    <th className="p-2 text-center w-[125px]">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCatalog.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 font-semibold">
                        Nenhum CFOP encontrado para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredCatalog.map((entry) => {
                      const isEditing = editingCodigo === entry.codigo;
                      return (
                        <tr key={entry.codigo} className="hover:bg-slate-50">
                          <td className="p-1.5 text-center font-mono font-black text-[#1e40af]">
                            {entry.codigo}
                          </td>
                          <td className="p-1.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingDescricao}
                                onChange={(e) => setEditingDescricao(e.target.value)}
                                className="w-full px-2 py-1 text-xs rounded border border-black/50 bg-white"
                              />
                            ) : (
                              <span className="font-semibold text-slate-800">
                                {entry.descricao}
                              </span>
                            )}
                          </td>
                          <td className="p-1.5 text-center">
                            {isEditing ? (
                              <select
                                value={editingTipo}
                                onChange={(e) =>
                                  setEditingTipo(e.target.value as CfopOperacaoTipo)
                                }
                                className="w-full px-1.5 py-1 text-[11px] font-bold rounded border border-black/50 bg-white uppercase"
                              >
                                <option value="venda">VENDA</option>
                                <option value="remessa_retorno">REMESSA / RETORNO</option>
                                <option value="devolucao">DEVOLUÇÃO</option>
                                <option value="transporte">TRANSPORTE (CT-E)</option>
                                <option value="outros">OUTROS</option>
                              </select>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase text-slate-700">
                                {CFOP_TIPO_LABELS[entry.tipo]}
                              </span>
                            )}
                          </td>
                          <td className="p-1.5 text-center">
                            <div className="inline-flex items-center gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(entry.codigo)}
                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                    title="Salvar edição"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCodigo(null)}
                                    className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {onSelectCfop && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onSelectCfop(entry.codigo);
                                        onClose();
                                      }}
                                      className="px-2 py-0.5 rounded bg-[#1e40af] hover:bg-[#1e3a8a] text-white text-[10px] font-black uppercase cursor-pointer"
                                      title={`Selecionar CFOP ${entry.codigo}`}
                                    >
                                      Usar
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(entry)}
                                    className="p-1 rounded text-blue-700 hover:bg-blue-50 cursor-pointer"
                                    title="Editar CFOP"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCfop(entry.codigo)}
                                    className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    title="Excluir CFOP"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
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
        </div>

        {/* Rodapé */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-t border-black flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-black text-xs font-black uppercase cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
