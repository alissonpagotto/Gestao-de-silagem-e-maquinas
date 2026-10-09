import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  CreditCard, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  RotateCcw,
  Check, 
  X,
  TrendingUp,
  TrendingDown,
  Layers,
  Percent,
  Pencil,
  Clock
} from 'lucide-react';
import { PlanoContaCategoria, FormaPagamentoItem, PlanoContasEFormasData } from '../../types';
import { 
  getStoredPlanoContas, 
  saveStoredPlanoContas, 
  INITIAL_PLANO_CONTAS_E_FORMAS, 
  CADASTROS_STORAGE_KEYS 
} from '../../lib/cadastrosBaseStorage';

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

  // Modal Forma Pagamento
  const [isFormaModalOpen, setIsFormaModalOpen] = useState(false);
  const [editingForma, setEditingForma] = useState<FormaPagamentoItem | null>(null);
  const [formaCodigo, setFormaCodigo] = useState('');
  const [formaNome, setFormaNome] = useState('');
  const [formaTipo, setFormaTipo] = useState<any>('pix');
  const [formaPrazo, setFormaPrazo] = useState<number>(0);
  const [formaTaxa, setFormaTaxa] = useState<number>(0);
  const [formaAtivo, setFormaAtivo] = useState(true);
  const [formaError, setFormaError] = useState('');

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail && e.detail.categorias) {
        setData(e.detail);
      } else {
        setData(getStoredPlanoContas());
      }
    };
    window.addEventListener('colaca_silagem_plano_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('colaca_silagem_plano_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredCategorias = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.categorias;
    return data.categorias.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.codigo.toLowerCase().includes(term) ||
      c.tipo.toLowerCase().includes(term) ||
      (c.descricao && c.descricao.toLowerCase().includes(term))
    );
  }, [data.categorias, searchTerm]);

  const filteredFormas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.formasPagamento;
    return data.formasPagamento.filter(f => 
      f.nome.toLowerCase().includes(term) ||
      f.codigo.toLowerCase().includes(term) ||
      f.tipo.toLowerCase().includes(term)
    );
  }, [data.formasPagamento, searchTerm]);

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
      updatedCats = data.categorias.map(c => c.id === editingCat.id ? updatedItem : c);
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
      updatedCats = [...data.categorias, newItem];
      showToast(`Categoria "${cleanNome}" cadastrada!`);
    }

    const updatedData: PlanoContasEFormasData = {
      ...data,
      categorias: updatedCats,
    };
    setData(updatedData);
    saveStoredPlanoContas(updatedData);
    setIsCatModalOpen(false);
  };

  const handleDeleteCat = (cat: PlanoContaCategoria) => {
    if (!confirm(`Deseja excluir a categoria de contas "${cat.nome}"?`)) return;
    const updatedCats = data.categorias.filter(c => c.id !== cat.id);
    const updatedData = { ...data, categorias: updatedCats };
    setData(updatedData);
    saveStoredPlanoContas(updatedData);
    showToast(`Categoria "${cat.nome}" removida.`);
  };

  // CRUD Formas de Pagamento
  const handleOpenCreateForma = () => {
    setEditingForma(null);
    setFormaCodigo('');
    setFormaNome('');
    setFormaTipo('pix');
    setFormaPrazo(0);
    setFormaTaxa(0);
    setFormaAtivo(true);
    setFormaError('');
    setIsFormaModalOpen(true);
  };

  const handleOpenEditForma = (forma: FormaPagamentoItem) => {
    setEditingForma(forma);
    setFormaCodigo(forma.codigo);
    setFormaNome(forma.nome);
    setFormaTipo(forma.tipo);
    setFormaPrazo(forma.prazoDias || 0);
    setFormaTaxa(forma.taxaPercentual || 0);
    setFormaAtivo(forma.ativo !== false);
    setFormaError('');
    setIsFormaModalOpen(true);
  };

  const handleSaveForma = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = formaNome.trim();
    const cleanCodigo = formaCodigo.trim();
    if (!cleanNome || !cleanCodigo) {
      setFormaError('Código e Nome da forma de pagamento são obrigatórios.');
      return;
    }

    let updatedFormas: FormaPagamentoItem[];
    if (editingForma) {
      const updated: FormaPagamentoItem = {
        ...editingForma,
        codigo: cleanCodigo,
        nome: cleanNome,
        tipo: formaTipo,
        prazoDias: Number(formaPrazo) || 0,
        taxaPercentual: Number(formaTaxa) || 0,
        ativo: formaAtivo,
      };
      updatedFormas = data.formasPagamento.map(f => f.id === editingForma.id ? updated : f);
      showToast(`Forma "${cleanNome}" atualizada!`);
    } else {
      const newForma: FormaPagamentoItem = {
        id: `fp-${Date.now()}`,
        codigo: cleanCodigo,
        nome: cleanNome,
        tipo: formaTipo,
        prazoDias: Number(formaPrazo) || 0,
        taxaPercentual: Number(formaTaxa) || 0,
        ativo: formaAtivo,
      };
      updatedFormas = [...data.formasPagamento, newForma];
      showToast(`Forma "${cleanNome}" cadastrada!`);
    }

    const updatedData: PlanoContasEFormasData = {
      ...data,
      formasPagamento: updatedFormas,
    };
    setData(updatedData);
    saveStoredPlanoContas(updatedData);
    setIsFormaModalOpen(false);
  };

  const handleDeleteForma = (forma: FormaPagamentoItem) => {
    if (!confirm(`Deseja excluir a forma de pagamento "${forma.nome}"?`)) return;
    const updatedFormas = data.formasPagamento.filter(f => f.id !== forma.id);
    const updatedData = { ...data, formasPagamento: updatedFormas };
    setData(updatedData);
    saveStoredPlanoContas(updatedData);
    showToast(`Forma "${forma.nome}" removida.`);
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar o Plano de Contas e as Formas de Pagamento para o padrão de fábrica?')) {
      setData(INITIAL_PLANO_CONTAS_E_FORMAS);
      saveStoredPlanoContas(INITIAL_PLANO_CONTAS_E_FORMAS);
      showToast('Dados restaurados com sucesso.');
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
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
              <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                Plano de Contas & Formas de Pagamento
              </h3>
              <p className="text-xs text-zinc-500 dark:text-stone-400">
                Estrutura contábil e modalidades de recebimento/pagamento salvas em <code>{CADASTROS_STORAGE_KEYS.PLANO_CONTAS}</code>.
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

            {activeSubSection === 'contas' ? (
              <button
                type="button"
                onClick={handleOpenCreateCat}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nova Conta / Categoria</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCreateForma}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nova Forma de Pagamento</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tabs de Alternância e Busca */}
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 p-1 bg-zinc-100 dark:bg-stone-800 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveSubSection('contas')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubSection === 'contas'
                  ? 'bg-white dark:bg-stone-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-600 dark:text-stone-400 hover:text-zinc-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Plano de Contas ({data.categorias.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubSection('formas')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubSection === 'formas'
                  ? 'bg-white dark:bg-stone-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-600 dark:text-stone-400 hover:text-zinc-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Formas de Pagamento ({data.formasPagamento.length})</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Filtrar nesta lista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: PLANO DE CONTAS */}
      {activeSubSection === 'contas' && (
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-zinc-50 dark:bg-stone-800/60 border-b border-zinc-200 dark:border-stone-800 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-400 select-none">
                <tr>
                  <th className="py-1.5 px-3">Código</th>
                  <th className="py-1.5 px-3">Nome da Conta</th>
                  <th className="py-1.5 px-3">Classificação</th>
                  <th className="py-1.5 px-3">Descrição</th>
                  <th className="py-1.5 px-3 text-center">Status</th>
                  <th className="py-1.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-stone-800 text-xs">
                {filteredCategorias.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500 dark:text-stone-400 font-semibold uppercase text-xs">
                      Nenhuma conta cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredCategorias.map((cat) => {
                    const isReceita = cat.tipo === 'receita';
                    const isAtivo = cat.ativo !== false;
                    return (
                      <tr key={cat.id} className="hover:bg-zinc-50/70 dark:hover:bg-stone-800/40 transition">
                        <td className="py-1.5 px-3 font-mono font-bold text-zinc-700 dark:text-stone-300 whitespace-nowrap uppercase">
                          {cat.codigo}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-zinc-900 dark:text-white whitespace-nowrap uppercase">
                          {cat.nome}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isReceita
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          }`}>
                            {isReceita ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{cat.tipo}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-xs text-zinc-500 dark:text-stone-400 max-w-xs truncate whitespace-nowrap uppercase">
                          {cat.descricao || '—'}
                        </td>
                        <td className="py-1.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wide border ${
                            isAtivo 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : 'bg-zinc-100 text-zinc-500 border-zinc-300'
                          }`}>
                            <span>{isAtivo ? 'ATIVO' : 'INATIVO'}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCat(cat)}
                              className="p-1 rounded text-zinc-600 hover:text-teal-600 hover:bg-zinc-100 transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCat(cat)}
                              className="p-1 rounded text-zinc-600 hover:text-rose-600 hover:bg-zinc-100 transition cursor-pointer"
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

      {/* SEÇÃO 2: FORMAS DE PAGAMENTO */}
      {activeSubSection === 'formas' && (
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-zinc-50 dark:bg-stone-800/60 border-b border-zinc-200 dark:border-stone-800 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-400 select-none">
                <tr>
                  <th className="py-1.5 px-3">Sigla / Cód.</th>
                  <th className="py-1.5 px-3">Forma de Pagamento</th>
                  <th className="py-1.5 px-3">Modalidade</th>
                  <th className="py-1.5 px-3">Prazo Padrão</th>
                  <th className="py-1.5 px-3">Taxa Estimada</th>
                  <th className="py-1.5 px-3 text-center">Status</th>
                  <th className="py-1.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-stone-800 text-xs">
                {filteredFormas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-500 dark:text-stone-400 font-semibold uppercase text-xs">
                      Nenhuma forma de pagamento cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredFormas.map((forma) => {
                    const isAtivo = forma.ativo !== false;
                    return (
                      <tr key={forma.id} className="hover:bg-zinc-50/70 dark:hover:bg-stone-800/40 transition">
                        <td className="py-1.5 px-3 font-mono font-bold text-zinc-700 dark:text-stone-300 whitespace-nowrap uppercase">
                          {forma.codigo}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-zinc-900 dark:text-white whitespace-nowrap uppercase">
                          <div className="flex items-center space-x-2">
                            <CreditCard className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                            <span>{forma.nome}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border border-zinc-200 dark:border-stone-700">
                            {forma.tipo}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-xs text-zinc-600 dark:text-stone-400 whitespace-nowrap uppercase">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span>{forma.prazoDias ? `${forma.prazoDias} DIAS` : 'À VISTA (0 DIAS)'}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-xs font-semibold text-zinc-700 dark:text-stone-300 whitespace-nowrap uppercase">
                          <div className="flex items-center space-x-1">
                            <Percent className="w-3 h-3 text-zinc-400" />
                            <span>{forma.taxaPercentual ? `${forma.taxaPercentual.toFixed(2).replace('.', ',')}%` : '0,00%'}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wide border ${
                            isAtivo 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : 'bg-zinc-100 text-zinc-500 border-zinc-300'
                          }`}>
                            <span>{isAtivo ? 'ATIVO' : 'INATIVO'}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditForma(forma)}
                              className="p-1 rounded text-zinc-600 hover:text-teal-600 hover:bg-zinc-100 transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteForma(forma)}
                              className="p-1 rounded text-zinc-600 hover:text-rose-600 hover:bg-zinc-100 transition cursor-pointer"
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

      {/* Modal Categoria - Tamanho Padrão Ouro */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 border border-slate-400 rounded-lg overflow-hidden global">
            
            {/* Header 3D Metálico Acetinado */}
            <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100">
                    {editingCat ? 'EDITAR CONTA / CATEGORIA' : 'NOVA CONTA NO PLANO'}
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                    Estruturação de receitas, despesas e centros financeiros
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
              </button>
            </div>

            {catError && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
                {catError}
              </div>
            )}

            <form onSubmit={handleSaveCat} className="p-3 sm:p-4 space-y-2.5 text-xs bg-slate-50 dark:bg-stone-900 overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                      Código <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 2.01"
                      value={catCodigo}
                      onChange={(e) => setCatCodigo(e.target.value)}
                      className="w-full px-2.5 py-1 sm:py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                      Nome da Conta / Categoria <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Combustíveis, Salários..."
                      value={catNome}
                      onChange={(e) => setCatNome(e.target.value)}
                      className="w-full px-2.5 py-1 sm:py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    Classificação da Conta
                  </label>
                  <select
                    value={catTipo}
                    onChange={(e) => setCatTipo(e.target.value as any)}
                    className="w-full px-2.5 py-1 sm:py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                  >
                    <option value="despesa">Despesa Operacional / Administrativa</option>
                    <option value="receita">Receita Operacional / Venda / Serviços</option>
                    <option value="ativo">Ativo Imobilizado / Bancos</option>
                    <option value="passivo">Passivo / Obrigações</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    Descrição (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detalhamento do escopo desta conta..."
                    value={catDescricao}
                    onChange={(e) => setCatDescricao(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 resize-none"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="cat-ativo"
                    checked={catAtivo}
                    onChange={(e) => setCatAtivo(e.target.checked)}
                    className="w-4 h-4 rounded text-slate-800 focus:ring-slate-400 border-slate-300 dark:border-stone-700 cursor-pointer"
                  />
                  <label htmlFor="cat-ativo" className="text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer">
                    Conta Ativa no Sistema
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-stone-700 flex items-center justify-end space-x-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-3.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 text-xs font-semibold text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 sm:py-1.5 rounded-lg bg-gradient-to-b from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white text-xs font-bold shadow-xs cursor-pointer border border-teal-800"
                >
                  {editingCat ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Forma Pagamento - Tamanho Padrão Ouro */}
      {isFormaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 border border-slate-400 rounded-lg overflow-hidden global">
            
            {/* Header 3D Metálico Acetinado */}
            <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-b border-slate-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100">
                    {editingForma ? 'EDITAR FORMA DE PAGAMENTO' : 'NOVA FORMA DE PAGAMENTO'}
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                    Modalidade de quitação, prazos médios e taxas financeiras
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormaModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
              </button>
            </div>

            {formaError && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
                {formaError}
              </div>
            )}

            <form onSubmit={handleSaveForma} className="p-3 sm:p-4 space-y-2.5 text-xs bg-white dark:bg-stone-900 max-h-[82vh] overflow-y-auto scrollbar-none flex-1">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    Sigla / Cód. <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PIX, BOL"
                    value={formaCodigo}
                    onChange={(e) => setFormaCodigo(e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1 sm:py-1.5 bg-zinc-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    Nome da Modalidade <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Boleto Bancário 30DD"
                    value={formaNome}
                    onChange={(e) => setFormaNome(e.target.value)}
                    className="w-full px-2.5 py-1 sm:py-1.5 bg-zinc-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                  Tipo Base
                </label>
                <select
                  value={formaTipo}
                  onChange={(e) => setFormaTipo(e.target.value)}
                  className="w-full px-2.5 py-1 sm:py-1.5 bg-zinc-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                >
                  <option value="pix">PIX Instantâneo</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="transferencia">Transferência Bancária (TED/DOC)</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="dinheiro">Dinheiro em Espécie</option>
                  <option value="cheque">Cheque</option>
                  <option value="outro">Outro / Negociado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    Prazo Médio (Dias)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formaPrazo}
                    onChange={(e) => setFormaPrazo(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1 sm:py-1.5 bg-zinc-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                    Taxa Estimada (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formaTaxa}
                    onChange={(e) => setFormaTaxa(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1 sm:py-1.5 bg-zinc-50 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="forma-ativo"
                  checked={formaAtivo}
                  onChange={(e) => setFormaAtivo(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-800 focus:ring-slate-400 border-slate-300 dark:border-stone-700 cursor-pointer"
                />
                <label htmlFor="forma-ativo" className="text-xs font-bold text-slate-800 dark:text-stone-200 cursor-pointer">
                  Forma de Pagamento Ativa
                </label>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-stone-700 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFormaModalOpen(false)}
                  className="px-3.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 text-xs font-semibold text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 sm:py-1.5 rounded-lg bg-gradient-to-b from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white text-xs font-bold shadow-xs cursor-pointer border border-teal-800"
                >
                  {editingForma ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
