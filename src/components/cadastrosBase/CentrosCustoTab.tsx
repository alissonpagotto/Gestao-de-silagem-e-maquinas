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
  Pencil,
  X
} from 'lucide-react';
import { CostCenter } from '../../types';
import { 
  getStoredCentrosCusto, 
  saveStoredCentrosCusto, 
  INITIAL_CENTROS_CUSTO
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
    <div className="space-y-2">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Cabeçalho Compacto Unificado */}
      <div className="bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg p-2.5 shadow-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded bg-white/85 border border-black/30 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Building className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase leading-tight truncate">
                CENTROS DE CUSTO
              </h3>
              <p className="text-[11px] text-slate-700 dark:text-stone-400 leading-tight truncate">
                Unidades gerenciais, fazendas, frentes operacionais e departamentos para rateio de custos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Restaurar padrão inicial"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/85 hover:bg-white dark:bg-stone-800 dark:hover:bg-stone-700 text-slate-900 dark:text-stone-200 border border-black dark:border-stone-700 transition cursor-pointer text-[11px] font-bold uppercase"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurar Padrão</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-700 border border-amber-900 text-white font-black text-[11px] uppercase tracking-wide shadow-xs transition cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Novo Centro de Custo</span>
            </button>
          </div>
        </div>

        {/* Busca + Contagem */}
        <div className="pt-2 border-t border-black/20 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome, tipo ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1 bg-white dark:bg-stone-800/80 border border-black/40 dark:border-stone-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/85 border border-black/40 text-[11px] font-black uppercase text-slate-900 shrink-0 ml-auto">
            <span>{filteredCentros.length}</span>
            <span className="text-[10px] font-bold text-slate-700">
              {filteredCentros.length === 1 ? 'CENTRO' : 'CENTROS'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabela de Centros de Custo */}
      <div className="border border-black rounded-lg overflow-hidden bg-[#e0e6f1] dark:bg-stone-900 shadow-xs">
        <div className="max-h-[calc(100vh-270px)] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-300 select-none">
              <tr>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3">Nome do Centro de Custo</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3">Tipo / Categoria</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3">Descrição</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3 text-center">Status</th>
                <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {filteredCentros.length === 0 ? (
                <tr className="bg-[#e0e6f1]">
                  <td colSpan={5} className="py-6 text-center text-slate-700 dark:text-stone-400 font-semibold uppercase text-xs">
                    Nenhum centro de custo encontrado.
                  </td>
                </tr>
              ) : (
                filteredCentros.map((centro) => {
                  const isAtivo = centro.active !== false;
                  return (
                    <tr key={centro.id} className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800 border-b border-black/20 last:border-b-0 transition-colors">
                      <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap uppercase">
                        <div className="flex items-center space-x-2">
                          <div className="p-1 rounded bg-white/80 border border-black/20 text-amber-700 dark:text-amber-400 shrink-0">
                            <FolderKanban className="w-3.5 h-3.5" />
                          </div>
                          <span>{centro.name}</span>
                        </div>
                      </td>

                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-300 border border-slate-300 dark:border-stone-700">
                          {centro.type || 'Operacional'}
                        </span>
                      </td>

                      <td className="py-1.5 px-3 text-xs text-slate-700 dark:text-stone-400 max-w-xs truncate whitespace-nowrap uppercase">
                        {centro.description || '—'}
                      </td>

                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(centro)}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wide border cursor-pointer transition ${
                            isAtivo 
                              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700' 
                              : 'bg-white/80 text-slate-600 dark:bg-stone-800 dark:text-stone-400 border-slate-400 dark:border-stone-700'
                          }`}
                        >
                          {isAtivo ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          <span>{isAtivo ? 'ATIVO' : 'INATIVO'}</span>
                        </button>
                      </td>

                      <td className="py-1.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(centro)}
                            title="Editar Centro de Custo"
                            className="p-1 rounded bg-white/80 hover:bg-white border border-black/30 hover:border-black text-slate-800 hover:text-amber-700 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(centro)}
                            title="Excluir Centro de Custo"
                            className="p-1 rounded bg-white/80 hover:bg-rose-50 border border-black/30 hover:border-rose-600 text-rose-700 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal Criar / Editar - Tema Oficial de Alto Contraste */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 overflow-y-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}>
          <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden">
            
            {/* Cabeçalho */}
            <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] border-b border-black flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white text-black flex items-center justify-center border border-black shadow-2xs shrink-0">
                  <FolderKanban className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black">
                    {editingCentro ? 'EDITAR CENTRO DE CUSTO' : 'NOVO CENTRO DE CUSTO'}
                  </h3>
                  <p className="text-[11px] text-slate-800 font-medium">
                    Classificação contábil de talhões, sede, oficina e operações
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-black hover:bg-white/60 border border-transparent hover:border-black transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-400 text-xs font-bold text-rose-800 shrink-0">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#cad4e6] text-xs">
              <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto bg-[#e0e6f1] border border-black rounded-xl p-4 sm:p-5 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-1">
                      Nome do Centro de Custo <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Talhão 01 - Milho, Sede Administrativa..."
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-1">
                      Tipo / Categoria
                    </label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                    >
                      <option value="operacional">Operacional (Campo / Silagem)</option>
                      <option value="administrativo">Administrativo (Sede / Gestão)</option>
                      <option value="manutencao">Manutenção (Oficina / Peças)</option>
                      <option value="lavoura">Lavoura / Plantio</option>
                      <option value="transporte">Transporte & Logística</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-1">
                      Descrição (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Observações complementares..."
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600 resize-none"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="centro-ativo"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                      className="w-4 h-4 rounded bg-white dark:bg-stone-800 text-emerald-600 focus:ring-emerald-600 border border-gray-400 dark:border-stone-700 cursor-pointer accent-emerald-600"
                    />
                    <label htmlFor="centro-ativo" className="text-xs font-bold text-black dark:text-stone-200 cursor-pointer">
                      Centro de Custo Ativo
                    </label>
                  </div>
                </div>
              </div>

              {/* Rodapé */}
              <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-black dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-700 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer border border-emerald-800 transition"
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
