import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  RotateCcw,
  AlertTriangle,
  FolderKanban,
  Check,
  X
} from 'lucide-react';
import { CostCenter } from '../../types';
import { 
  getStoredCentrosCusto, 
  saveStoredCentrosCusto, 
  INITIAL_CENTROS_CUSTO, 
  CADASTROS_STORAGE_KEYS 
} from '../../lib/cadastrosBaseStorage';

export const CentrosCustoTab: React.FC = () => {
  const [centros, setCentros] = useState<CostCenter[]>(() => getStoredCentrosCusto());
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCentro, setEditingCentro] = useState<CostCenter | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'operacional' | 'administrativo' | 'manutencao' | 'lavoura' | string>('operacional');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setCentros(e.detail);
      } else {
        setCentros(getStoredCentrosCusto());
      }
    };
    window.addEventListener('colaca_silagem_centros_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('colaca_silagem_centros_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredCentros = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return centros;
    return centros.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.type && c.type.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  }, [centros, searchTerm]);

  const handleOpenCreate = () => {
    setEditingCentro(null);
    setNome('');
    setTipo('operacional');
    setDescricao('');
    setAtivo(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (centro: CostCenter) => {
    setEditingCentro(centro);
    setNome(centro.name);
    setTipo(centro.type || 'operacional');
    setDescricao(centro.description || '');
    setAtivo(centro.active !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = nome.trim();
    if (!cleanNome) {
      setFormError('Informe o nome do centro de custo.');
      return;
    }

    const exists = centros.some(c => 
      c.name.trim().toLowerCase() === cleanNome.toLowerCase() && 
      c.id !== editingCentro?.id
    );
    if (exists) {
      setFormError(`Já existe um centro de custo com o nome "${cleanNome}".`);
      return;
    }

    let updatedList: CostCenter[];
    if (editingCentro) {
      const updated: CostCenter = {
        ...editingCentro,
        name: cleanNome,
        type: tipo,
        description: descricao.trim() || undefined,
        active: ativo,
      };
      updatedList = centros.map(c => c.id === editingCentro.id ? updated : c);
      showToast(`Centro de Custo "${cleanNome}" atualizado!`);
    } else {
      const newCentro: CostCenter = {
        id: `cc-${Date.now()}`,
        name: cleanNome,
        type: tipo,
        description: descricao.trim() || undefined,
        active: ativo,
      };
      updatedList = [...centros, newCentro];
      showToast(`Centro de Custo "${cleanNome}" cadastrado!`);
    }

    setCentros(updatedList);
    saveStoredCentrosCusto(updatedList);
    setIsModalOpen(false);
  };

  const handleDelete = (centro: CostCenter) => {
    if (!confirm(`Tem certeza que deseja excluir o Centro de Custo "${centro.name}"?`)) {
      return;
    }
    const updated = centros.filter(c => c.id !== centro.id);
    setCentros(updated);
    saveStoredCentrosCusto(updated);
    showToast(`Centro de Custo "${centro.name}" excluído.`);
  };

  const handleToggleActive = (centro: CostCenter) => {
    const updated = centros.map(c => 
      c.id === centro.id ? { ...c, active: c.active === false ? true : false } : c
    );
    setCentros(updated);
    saveStoredCentrosCusto(updated);
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar os Centros de Custo padrão do sistema?')) {
      setCentros(INITIAL_CENTROS_CUSTO);
      saveStoredCentrosCusto(INITIAL_CENTROS_CUSTO);
      showToast('Centros de custo restaurados para o padrão.');
    }
  };

  return (
    <div className="space-y-3">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <Building className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                Centros de Custo & Talhões
              </h3>
              <p className="text-xs text-zinc-500 dark:text-stone-400">
                Segmentação de custos operacionais e administrativos gravados localmente em <code>{CADASTROS_STORAGE_KEYS.CENTROS_CUSTO}</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Restaurar padrão inicial"
              className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-stone-800 border border-zinc-300 dark:border-stone-700 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Centro de Custo</span>
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou tipo do centro de custo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="text-xs font-bold text-zinc-500 dark:text-stone-400 shrink-0">
            Total: <span className="text-zinc-900 dark:text-white font-extrabold">{filteredCentros.length}</span> centro(s)
          </div>
        </div>
      </div>

      {/* Tabela de Centros de Custo */}
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-zinc-50 dark:bg-stone-800/60 border-b border-zinc-200 dark:border-stone-800 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-400">
              <tr>
                <th className="py-3.5 px-4">Nome do Centro de Custo</th>
                <th className="py-3.5 px-4">Tipo / Categoria</th>
                <th className="py-3.5 px-4">Descrição</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-stone-800">
              {filteredCentros.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500 dark:text-stone-400 font-semibold">
                    Nenhum centro de custo encontrado.
                  </td>
                </tr>
              ) : (
                filteredCentros.map((centro) => {
                  const isAtivo = centro.active !== false;
                  return (
                    <tr key={centro.id} className="hover:bg-zinc-50/70 dark:hover:bg-stone-800/40 transition">
                      <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                            <FolderKanban className="w-4 h-4" />
                          </div>
                          <span>{centro.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold capitalize bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border border-zinc-200 dark:border-stone-700">
                          {centro.type || 'Operacional'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-zinc-500 dark:text-stone-400 max-w-xs truncate">
                        {centro.description || '—'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(centro)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide border cursor-pointer transition ${
                            isAtivo 
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' 
                              : 'bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 border-zinc-300 dark:border-stone-700'
                          }`}
                        >
                          {isAtivo ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          <span>{isAtivo ? 'ATIVO' : 'INATIVO'}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(centro)}
                            title="Editar Centro de Custo"
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-amber-600 hover:bg-zinc-100 dark:text-stone-400 dark:hover:text-amber-400 dark:hover:bg-stone-800 transition cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(centro)}
                            title="Excluir Centro de Custo"
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-600 hover:bg-zinc-100 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-stone-800 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal Criar / Editar - Moldura Metálica 3D Acetinada */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden overflow-y-hidden">
          <div className="bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-2xl max-w-lg w-full shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] overflow-hidden overflow-y-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            
            {/* Header 3D Metálico Acetinado */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 rounded-t-2xl shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                  <FolderKanban className="w-4 h-4 text-slate-700 dark:text-stone-200" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100">
                    {editingCentro ? 'EDITAR CENTRO DE CUSTO' : 'NOVO CENTRO DE CUSTO'}
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                    Classificação contábil de talhões, sede, oficina e operações
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
              </button>
            </div>

            {formError && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="p-3 sm:p-4 space-y-2.5 text-xs bg-white dark:bg-stone-900 max-h-[82vh] overflow-y-auto scrollbar-none flex-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  Nome do Centro de Custo <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Talhão 01 - Milho, Sede Administrativa..."
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-2.5 py-1 sm:py-1.5 bg-zinc-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  Tipo / Categoria
                </label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full px-2.5 py-1 sm:py-1.5 bg-zinc-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                >
                  <option value="operacional">Operacional (Campo / Silagem)</option>
                  <option value="administrativo">Administrativo (Sede / Gestão)</option>
                  <option value="manutencao">Manutenção (Oficina / Peças)</option>
                  <option value="lavoura">Lavoura / Plantio</option>
                  <option value="transporte">Transporte & Logística</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Observações complementares..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="centro-ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-800 focus:ring-slate-400 border-slate-300 dark:border-stone-700 cursor-pointer"
                />
                <label htmlFor="centro-ativo" className="text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer">
                  Centro de Custo Ativo
                </label>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-stone-700 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 text-xs font-semibold text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 sm:py-1.5 rounded-lg bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer border border-amber-800"
                >
                  {editingCentro ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
