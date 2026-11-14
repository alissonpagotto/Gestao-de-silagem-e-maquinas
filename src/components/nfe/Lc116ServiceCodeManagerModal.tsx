import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit2, Plus, RotateCcw, Search, Settings, Trash2, X } from 'lucide-react';
import { Lc116ServiceCodeEntry } from '../../types';
import {
  DEFAULT_LC116_SERVICE_CODES,
  saveStoredLc116ServiceCodes,
} from '../../lib/cfopCatalog';

export interface Lc116ServiceCodeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  codes: Lc116ServiceCodeEntry[];
  onSaveCodes: (updated: Lc116ServiceCodeEntry[]) => void;
  onSelectCode?: (codigo: string) => void;
}

export const Lc116ServiceCodeManagerModal: React.FC<Lc116ServiceCodeManagerModalProps> = ({
  isOpen,
  onClose,
  codes,
  onSaveCodes,
  onSelectCode,
}) => {
  const [newCodigo, setNewCodigo] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [editingCodigo, setEditingCodigo] = useState<string | null>(null);
  const [editingDescricao, setEditingDescricao] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewCodigo('');
      setNewDescricao('');
      setEditingCodigo(null);
      setEditingDescricao('');
      setSearchTerm('');
      setFeedbackError('');
      setFeedbackSuccess('');
    }
  }, [isOpen]);

  const filteredCodes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return codes;
    return codes.filter(
      (c) =>
        c.codigo.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q)
    );
  }, [codes, searchTerm]);

  if (!isOpen) return null;

  const showTempSuccess = (msg: string) => {
    setFeedbackError('');
    setFeedbackSuccess(msg);
    setTimeout(() => {
      setFeedbackSuccess((curr) => (curr === msg ? '' : curr));
    }, 4000);
  };

  const handleAddCode = () => {
    const codigo = newCodigo.trim();
    const descricao = newDescricao.trim();
    if (!codigo) {
      setFeedbackError('Informe o código do serviço LC 116/03 (ex: 17.05, 14.01).');
      return;
    }
    if (!descricao) {
      setFeedbackError('Informe a descrição do serviço.');
      return;
    }
    if (codes.some((c) => c.codigo.toLowerCase() === codigo.toLowerCase())) {
      setFeedbackError(`O código ${codigo} já está cadastrado.`);
      return;
    }
    const updated = saveStoredLc116ServiceCodes([
      ...codes,
      { codigo, descricao, isDefault: false },
    ]);
    onSaveCodes(updated);
    if (onSelectCode) onSelectCode(codigo);
    setNewCodigo('');
    setNewDescricao('');
    showTempSuccess(`Código ${codigo} cadastrado com sucesso!`);
  };

  const handleSaveEdit = (codigo: string) => {
    const desc = editingDescricao.trim();
    if (!desc) {
      setFeedbackError('A descrição do serviço não pode ficar vazia.');
      return;
    }
    const updated = saveStoredLc116ServiceCodes(
      codes.map((c) => (c.codigo === codigo ? { ...c, descricao: desc } : c))
    );
    onSaveCodes(updated);
    setEditingCodigo(null);
    setEditingDescricao('');
    showTempSuccess(`Código ${codigo} atualizado com sucesso!`);
  };

  const handleDeleteCode = (codigo: string) => {
    const updated = saveStoredLc116ServiceCodes(
      codes.filter((c) => c.codigo !== codigo)
    );
    onSaveCodes(updated);
    if (editingCodigo === codigo) setEditingCodigo(null);
    showTempSuccess(`Código ${codigo} removido.`);
  };

  const handleRestoreDefaults = () => {
    const map = new Map<string, Lc116ServiceCodeEntry>();
    DEFAULT_LC116_SERVICE_CODES.forEach((d) => map.set(d.codigo, { ...d }));
    codes.forEach((c) => {
      if (!map.has(c.codigo)) map.set(c.codigo, c);
    });
    const updated = saveStoredLc116ServiceCodes(Array.from(map.values()));
    onSaveCodes(updated);
    showTempSuccess('Códigos padrão LC 116/03 restaurados!');
  };

  return (
    <div
      id="modal-gerenciar-lc116"
      className="fixed inset-0 z-[9999] bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 text-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2.5 bg-[#cad4e6] border-b border-black flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white border border-black flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-slate-800" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 truncate">
                GERENCIAR CÓDIGOS DE SERVIÇO (LC 116/03)
              </h3>
              <p className="text-[11px] font-semibold text-slate-700 truncate">
                Cadastre, edite ou exclua códigos municipais de serviço para NFS-e
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

        <div className="p-3.5 space-y-3 overflow-y-auto flex-1 bg-[#cad4e6]">
          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-900">
              CADASTRAR NOVO CÓDIGO LC 116/03
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <div className="sm:col-span-3">
                <input
                  id="lc116-novo-codigo-input"
                  type="text"
                  value={newCodigo}
                  onChange={(e) => {
                    setNewCodigo(e.target.value);
                    if (feedbackError) setFeedbackError('');
                  }}
                  placeholder="EX: 17.05"
                  className="w-full h-8 px-2.5 text-xs font-mono font-black text-center rounded-lg border border-black/50 bg-white text-black focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-6">
                <input
                  id="lc116-novo-descricao-input"
                  type="text"
                  value={newDescricao}
                  onChange={(e) => {
                    setNewDescricao(e.target.value);
                    if (feedbackError) setFeedbackError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCode();
                    }
                  }}
                  placeholder="Descrição do serviço rural / máquinas..."
                  className="w-full h-8 px-2.5 text-xs font-medium rounded-lg border border-black/50 bg-white text-black focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  id="btn-adicionar-lc116"
                  onClick={handleAddCode}
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

          <div className="bg-[#e0e6f1] border border-black rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                CÓDIGOS CADASTRADOS ({filteredCodes.length})
              </span>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar código ou serviço..."
                    className="h-7 pl-7 pr-2.5 text-xs rounded-lg border border-black/40 bg-white text-black w-48 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRestoreDefaults}
                  className="h-7 px-2.5 rounded-lg bg-white hover:bg-slate-100 border border-black/40 text-[10px] font-black uppercase inline-flex items-center gap-1 cursor-pointer"
                  title="Restaurar códigos padrão rurais e máquinas"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Padrões</span>
                </button>
              </div>
            </div>

            <div className="bg-white border border-black/50 rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 border-b border-black/30 text-[10px] font-black uppercase">
                  <tr>
                    <th className="p-2 text-center w-[80px]">CÓDIGO</th>
                    <th className="p-2 text-left">DESCRIÇÃO DO SERVIÇO</th>
                    <th className="p-2 text-center w-[125px]">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCodes.map((entry) => {
                    const isEditing = editingCodigo === entry.codigo;
                    return (
                      <tr key={entry.codigo} className="hover:bg-slate-50">
                        <td className="p-1.5 text-center font-mono font-black text-[#6d28d9]">
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
                          <div className="inline-flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(entry.codigo)}
                                  className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                  title="Salvar"
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
                                {onSelectCode && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectCode(entry.codigo);
                                      onClose();
                                    }}
                                    className="px-2 py-0.5 rounded bg-[#6d28d9] hover:bg-[#5b21b6] text-white text-[10px] font-black uppercase cursor-pointer"
                                  >
                                    Usar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCodigo(entry.codigo);
                                    setEditingDescricao(entry.descricao);
                                  }}
                                  className="p-1 rounded text-blue-700 hover:bg-blue-50 cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCode(entry.codigo)}
                                  className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

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
