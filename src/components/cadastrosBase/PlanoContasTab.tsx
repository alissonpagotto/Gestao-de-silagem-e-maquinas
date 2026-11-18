import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  CreditCard, 
  Plus, 
  Search, 
  Trash2, 
  CheckCircle2, 
  RotateCcw,
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  Pencil
} from 'lucide-react';
import { PlanoContaCategoria, PlanoContasEFormasData } from '../../types';
import { 
  getStoredPlanoContas, 
  saveStoredPlanoContas, 
  INITIAL_PLANO_CONTAS_E_FORMAS
} from '../../lib/cadastrosBaseStorage';
import { PaymentMethodsManagerPanel } from '../common/PaymentMethodsManager';
import { RestoreConfirmModal } from '../common/RestoreConfirmModal';

export const PlanoContasTab: React.FC = () => {
  const [data, setData] = useState<PlanoContasEFormasData>(() => getStoredPlanoContas());
  const [activeSubSection, setActiveSubSection] = useState<'contas' | 'formas'>('contas');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Categoria
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<PlanoContaCategoria | null>(null);
  const [catCodigo, setCatCodigo] = useState('');
  const [catNome, setCatNome] = useState('');
  const [catTipo, setCatTipo] = useState<'receita' | 'despesa' | 'ativo' | 'passivo'>('despesa');
  const [catDescricao, setCatDescricao] = useState('');
  const [catAtivo, setCatAtivo] = useState(true);
  const [catError, setCatError] = useState('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e && typeof e.key === 'string' && e.key && e.key !== 'colaca_silagem_plano_contas' && e.key !== 'agrocontrol_formas_pagamento') {
        return;
      }
      const next =
        e?.detail && Array.isArray(e.detail.categorias)
          ? {
              categorias: e.detail.categorias,
              formasPagamento: Array.isArray(e.detail.formasPagamento)
                ? e.detail.formasPagamento
                : getStoredPlanoContas().formasPagamento,
            }
          : getStoredPlanoContas();
      setData(next);
    };
    window.addEventListener('colaca_silagem_plano_updated', handleSync);
    window.addEventListener('agrocontrol_formas_pagamento_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('colaca_silagem_plano_updated', handleSync);
      window.removeEventListener('agrocontrol_formas_pagamento_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const safeCategorias = Array.isArray(data?.categorias) ? data.categorias : [];
  const safeFormasPagamento = Array.isArray(data?.formasPagamento) ? data.formasPagamento : [];

  const filteredCategorias = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return safeCategorias;
    return safeCategorias.filter(c => 
      String(c?.nome || '').toLowerCase().includes(term) ||
      String(c?.codigo || '').toLowerCase().includes(term) ||
      String(c?.tipo || '').toLowerCase().includes(term) ||
      (c?.descricao && String(c.descricao).toLowerCase().includes(term))
    );
  }, [safeCategorias, searchTerm]);

  // CRUD Categoria
  const handleOpenCreateCat = () => {
    setEditingCat(null);
    setCatCodigo('');
    setCatNome('');
    setCatTipo('despesa');
    setCatDescricao('');
    setCatAtivo(true);
    setCatError('');
    setIsCatModalOpen(true);
  };

  const handleOpenEditCat = (cat: PlanoContaCategoria) => {
    setEditingCat(cat);
    setCatCodigo(cat.codigo);
    setCatNome(cat.nome);
    setCatTipo(cat.tipo);
    setCatDescricao(cat.descricao || '');
    setCatAtivo(cat.ativo !== false);
    setCatError('');
    setIsCatModalOpen(true);
  };

  const handleSaveCat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = catNome.trim();
    const cleanCodigo = catCodigo.trim();
    if (!cleanNome || !cleanCodigo) {
      setCatError('Código e Nome da categoria são obrigatórios.');
      return;
    }

    let updatedCats: PlanoContaCategoria[];
    if (editingCat) {
      const updatedItem: PlanoContaCategoria = {
        ...editingCat,
        codigo: cleanCodigo,
        nome: cleanNome,
        tipo: catTipo,
        descricao: catDescricao.trim() || undefined,
        ativo: catAtivo,
      };
      updatedCats = safeCategorias.map(c => c.id === editingCat.id ? updatedItem : c);
      showToast(`Categoria "${cleanNome}" atualizada!`);
    } else {
      const newItem: PlanoContaCategoria = {
        id: `cat-${Date.now()}`,
        codigo: cleanCodigo,
        nome: cleanNome,
        tipo: catTipo,
        descricao: catDescricao.trim() || undefined,
        ativo: catAtivo,
      };
      updatedCats = [...safeCategorias, newItem];
      showToast(`Categoria "${cleanNome}" cadastrada!`);
    }

    const updatedData: PlanoContasEFormasData = {
      categorias: updatedCats,
      formasPagamento: safeFormasPagamento,
    };
    setData(updatedData);
    saveStoredPlanoContas(updatedData);
    setIsCatModalOpen(false);
  };

  const handleDeleteCat = (cat: PlanoContaCategoria) => {
    if (!confirm(`Deseja excluir a categoria de contas "${cat.nome}"?`)) return;
    const updatedCats = safeCategorias.filter(c => c.id !== cat.id);
    const updatedData = { categorias: updatedCats, formasPagamento: safeFormasPagamento };
    setData(updatedData);
    saveStoredPlanoContas(updatedData);
    showToast(`Categoria "${cat.nome}" removida.`);
  };

  const handleResetDefaults = () => {
    setIsResetConfirmOpen(true);
  };

  const handleConfirmResetDefaults = () => {
    setData(INITIAL_PLANO_CONTAS_E_FORMAS);
    saveStoredPlanoContas(INITIAL_PLANO_CONTAS_E_FORMAS);
    setIsResetConfirmOpen(false);
    showToast('Dados restaurados com sucesso.');
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
            <div className="w-7 h-7 rounded bg-white/85 border border-black/30 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white leading-tight truncate">
              PLANO DE CONTAS &amp; FORMAS DE PAGAMENTO
            </h3>
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

            {activeSubSection === 'contas' && (
              <button
                type="button"
                onClick={handleOpenCreateCat}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[#059669] hover:bg-[#047857] border border-emerald-900 text-white font-black text-[11px] uppercase tracking-wide whitespace-nowrap shadow-xs transition cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>NOVA CONTA / CATEGORIA</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tabs de Alternância e Busca na mesma linha */}
        <div className="pt-2 border-t border-black/20 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveSubSection('contas')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase whitespace-nowrap border transition cursor-pointer ${
                activeSubSection === 'contas'
                  ? 'bg-emerald-600 text-white border-black shadow-xs'
                  : 'bg-[#e0e6f1] hover:bg-white text-slate-900 border-black/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>PLANO DE CONTAS ({safeCategorias.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubSection('formas')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase whitespace-nowrap border transition cursor-pointer ${
                activeSubSection === 'formas'
                  ? 'bg-emerald-600 text-white border-black shadow-xs'
                  : 'bg-[#e0e6f1] hover:bg-white text-slate-900 border-black/40'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>FORMAS DE PAGAMENTO ({safeFormasPagamento.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64 ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filtrar nesta lista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1 bg-white dark:bg-stone-800 border border-black/40 dark:border-stone-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600"
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
        </div>
      </div>

      {/* SEÇÃO 1: PLANO DE CONTAS */}
      {activeSubSection === 'contas' && (
        <div className="border border-black rounded-lg overflow-hidden bg-[#e0e6f1] dark:bg-stone-900 shadow-xs">
          <div className="max-h-[calc(100vh-270px)] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-stone-300 select-none">
                <tr>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3">Código</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3">Nome da Conta</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3">Classificação</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3">Descrição</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3 text-center">Status</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black py-2 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredCategorias.length === 0 ? (
                  <tr className="bg-[#e0e6f1]">
                    <td colSpan={6} className="py-6 text-center text-slate-700 dark:text-stone-400 font-semibold uppercase text-xs">
                      Nenhuma conta cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredCategorias.map((cat) => {
                    const isReceita = cat.tipo === 'receita';
                    const isAtivo = cat.ativo !== false;
                    return (
                      <tr key={cat.id} className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800 border-b border-black/20 last:border-b-0 transition-colors">
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-800 dark:text-stone-300 whitespace-nowrap uppercase">
                          {cat.codigo}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap uppercase">
                          {cat.nome}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isReceita
                              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-400 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300 border-rose-400 dark:border-rose-800'
                          }`}>
                            {isReceita ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{cat.tipo}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-xs text-slate-700 dark:text-stone-400 max-w-xs truncate whitespace-nowrap uppercase">
                          {cat.descricao || '—'}
                        </td>
                        <td className="py-1.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wide border ${
                            isAtivo 
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-400' 
                              : 'bg-white/80 text-slate-600 border-slate-400'
                          }`}>
                            <span>{isAtivo ? 'ATIVO' : 'INATIVO'}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCat(cat)}
                              className="p-1 rounded bg-white/80 hover:bg-white border border-black/30 hover:border-black text-slate-800 hover:text-teal-700 transition cursor-pointer"
                              title="Editar conta"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCat(cat)}
                              className="p-1 rounded bg-white/80 hover:bg-rose-50 border border-black/30 hover:border-rose-600 text-rose-700 transition cursor-pointer"
                              title="Excluir conta"
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
      )}

      {/* SEÇÃO 2: FORMAS DE PAGAMENTO (UNIFICADA GLOBAL) */}
      {activeSubSection === 'formas' && (
        <PaymentMethodsManagerPanel />
      )}

      {/* Modal Categoria - Tema Oficial de Alto Contraste */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 overflow-y-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}>
          <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden">
            
            {/* Cabeçalho */}
            <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] border-b border-black flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white text-black flex items-center justify-center border border-black shadow-2xs shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black">
                    {editingCat ? 'EDITAR CONTA / CATEGORIA' : 'NOVA CONTA NO PLANO'}
                  </h3>
                  <p className="text-[11px] text-slate-800 font-medium">
                    Estruturação de receitas, despesas e centros financeiros
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="p-1.5 rounded-lg text-black hover:bg-white/60 border border-transparent hover:border-black transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {catError && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-400 text-xs font-bold text-rose-800 shrink-0">
                {catError}
              </div>
            )}

            <form onSubmit={handleSaveCat} className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#cad4e6] text-xs">
              <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto bg-[#e0e6f1] border border-black rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-1">
                      <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-1">
                        Código <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 2.01"
                        value={catCodigo}
                        onChange={(e) => setCatCodigo(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-1">
                        Nome da Conta / Categoria <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Combustíveis, Salários..."
                        value={catNome}
                        onChange={(e) => setCatNome(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-1">
                      Classificação da Conta
                    </label>
                    <select
                      value={catTipo}
                      onChange={(e) => setCatTipo(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-semibold text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
                    >
                      <option value="despesa">Despesa Operacional / Administrativa</option>
                      <option value="receita">Receita Operacional / Venda / Serviços</option>
                      <option value="ativo">Ativo Imobilizado / Bancos</option>
                      <option value="passivo">Passivo / Obrigações</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-1">
                      Descrição (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Detalhamento do escopo desta conta..."
                      value={catDescricao}
                      onChange={(e) => setCatDescricao(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 rounded-lg text-xs text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-600 resize-none"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="cat-ativo"
                      checked={catAtivo}
                      onChange={(e) => setCatAtivo(e.target.checked)}
                      className="w-4 h-4 rounded bg-white dark:bg-stone-800 text-emerald-600 focus:ring-emerald-600 border border-gray-400 dark:border-stone-700 cursor-pointer accent-emerald-600"
                    />
                    <label htmlFor="cat-ativo" className="text-xs font-bold text-black dark:text-stone-200 cursor-pointer">
                      Conta Ativa no Sistema
                    </label>
                  </div>
                </div>
              </div>

              {/* Rodapé */}
              <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-black dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-700 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer border border-emerald-800 transition"
                >
                  {editingCat ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RestoreConfirmModal
        isOpen={isResetConfirmOpen}
        message="TEM CERTEZA QUE DESEJA RESTAURAR O PLANO DE CONTAS E AS FORMAS DE PAGAMENTO PARA O PADRÃO DO SISTEMA? ESTA AÇÃO IRÁ SOBRESCREVER OS REGISTROS PERSONALIZADOS ATUAIS."
        onCancel={() => setIsResetConfirmOpen(false)}
        onConfirm={handleConfirmResetDefaults}
      />
    </div>
  );
};
