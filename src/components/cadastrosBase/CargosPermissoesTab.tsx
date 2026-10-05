import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shield, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Users, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Info,
  DollarSign,
  Truck,
  Tractor,
  Eye,
  HeartHandshake,
  Package,
  Building,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ChevronRight,
  Check,
  X,
  Layers,
  Sparkles,
  Save,
  CheckSquare,
  Square,
  ShieldCheck,
  LayoutGrid,
  List
} from 'lucide-react';
import { CargoPermissao, RolePermissions, Employee, ServicesSubPermissions, FrotasSubPermissions } from '../../types';
import { 
  getStoredCargosPermissoes, 
  saveStoredCargosPermissoes, 
  INITIAL_CARGOS_PERMISSOES,
  CADASTROS_STORAGE_KEYS 
} from '../../lib/cadastrosBaseStorage';
import { getStoredEmployees, saveStoredEmployees } from '../../lib/storage';
import { CargoEmployeesModal } from './CargoEmployeesModal';

const SETORES_DISPONIVEIS = [
  'DIRETORIA & ADMINISTRATIVO',
  'FINANCEIRO & CONTABILIDADE',
  'TRANSPORTE & LOGÍSTICA',
  'CAMPO & SILAGEM',
  'OFICINA & MANUTENÇÃO',
  'RECURSOS HUMANOS'
];

const DEFAULT_FORM_PERMISSOES: RolePermissions = {
  financeiro: false,
  frotas: true,
  rh: false,
  estoque: false,
  empresa: false,
  servicos: true,
  sub_servicos: {
    agenda: true,
    corte: true,
    colheita: true,
    trator: true,
    maquina: true,
    frete: true,
    orcamento: true,
  },
  sub_frotas: {
    painel: true,
    veiculos: true,
    motoristas: true,
    equipes: true,
    combustivel: true,
    manutencoes: true,
    pneus: true,
  },
};

export const CargosPermissoesTab: React.FC = () => {
  const [cargos, setCargos] = useState<CargoPermissao[]>(() => getStoredCargosPermissoes());
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('silagem_cargos_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
    } catch {}
    return 'list'; // Tabela limpa como padrão
  });

  // Modal Expandido em 3 Colunas (Editor / Novo Cargo)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editorSearchTerm, setEditorSearchTerm] = useState('');

  // Modal Slim de Colaboradores
  const [selectedCargoForEmployees, setSelectedCargoForEmployees] = useState<CargoPermissao | null>(null);

  // Form State (Coluna Central do Editor)
  const [nome, setNome] = useState('');
  const [setor, setSetor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [permissoes, setPermissoes] = useState<RolePermissions>({ ...DEFAULT_FORM_PERMISSOES });
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Combobox Autocomplete State
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Sincronização em tempo real de eventos locais
  useEffect(() => {
    const handleCargosSync = () => {
      setCargos(getStoredCargosPermissoes());
    };
    const handleEmployeesSync = () => {
      setEmployees(getStoredEmployees());
    };

    window.addEventListener('colaca_silagem_cargos_updated', handleCargosSync);
    window.addEventListener('storage', handleCargosSync);
    window.addEventListener('silagem_employees_updated', handleEmployeesSync);

    return () => {
      window.removeEventListener('colaca_silagem_cargos_updated', handleCargosSync);
      window.removeEventListener('storage', handleCargosSync);
      window.removeEventListener('silagem_employees_updated', handleEmployeesSync);
    };
  }, []);

  // Fechar combobox ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Contagem de funcionários por cargo
  const employeeCountByCargo = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach(emp => {
      const roleStr = (emp.role || '').trim().toLowerCase();
      const cargoId = emp.cargoId;
      if (cargoId) {
        map[cargoId] = (map[cargoId] || 0) + 1;
      }
      cargos.forEach(c => {
        if (c.nome.trim().toLowerCase() === roleStr) {
          map[c.id] = (map[c.id] || 0) + 1;
        }
      });
    });
    return map;
  }, [employees, cargos]);

  // Lista de cargos ordenada compulsoriamente de A a Z
  const sortedCargos = useMemo(() => {
    return [...cargos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [cargos]);

  // Lista filtrada para a Tabela Principal (Print 2)
  const filteredCargos = useMemo(() => {
    if (!searchTerm.trim()) return sortedCargos;
    const term = searchTerm.toLowerCase();
    return sortedCargos.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.setor.toLowerCase().includes(term) ||
      (c.descricao && c.descricao.toLowerCase().includes(term))
    );
  }, [sortedCargos, searchTerm]);

  // Lista filtrada para o painel lateral interno do editor (Coluna 1)
  const editorFilteredCargos = useMemo(() => {
    if (!editorSearchTerm.trim()) return sortedCargos;
    const term = editorSearchTerm.toLowerCase();
    return sortedCargos.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.setor.toLowerCase().includes(term)
    );
  }, [sortedCargos, editorSearchTerm]);

  // Nomes de cargos cadastrados para o combobox
  const existingCargoSuggestions = useMemo(() => {
    const unique = Array.from(new Set(cargos.map(c => c.nome.trim()))).filter(Boolean);
    const query = nome.trim().toLowerCase();
    const sorted = unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!query) return sorted;
    return sorted.filter(n => n.toLowerCase().includes(query));
  }, [cargos, nome]);

  // Cargo selecionado atual no editor
  const selectedCargo = useMemo(() => {
    if (!selectedCargoId) return null;
    return cargos.find(c => c.id === selectedCargoId) || null;
  }, [cargos, selectedCargoId]);

  // Carregar dados de um cargo no form do editor
  const handleSelectCargo = (cargo: CargoPermissao) => {
    setIsCreatingNew(false);
    setSelectedCargoId(cargo.id);
    setNome(cargo.nome);
    setSetor(cargo.setor);
    setDescricao(cargo.descricao || '');
    setPermissoes({
      financeiro: Boolean(cargo.permissoes?.financeiro),
      frotas: Boolean(cargo.permissoes?.frotas),
      rh: Boolean(cargo.permissoes?.rh),
      estoque: Boolean(cargo.permissoes?.estoque),
      empresa: Boolean(cargo.permissoes?.empresa),
      servicos: cargo.permissoes?.servicos !== undefined ? Boolean(cargo.permissoes.servicos) : true,
      sub_servicos: cargo.permissoes?.sub_servicos || {
        agenda: true,
        corte: true,
        colheita: true,
        trator: true,
        maquina: true,
        frete: true,
        orcamento: true,
      },
      sub_frotas: cargo.permissoes?.sub_frotas || {
        painel: true,
        veiculos: true,
        motoristas: true,
        equipes: true,
        combustivel: true,
        manutencoes: true,
        pneus: true,
      },
    });
    setFormError('');
  };

  // Abrir Modal de Edição a partir de uma linha da Tabela (Print 1 & 3)
  const handleOpenEditModal = (cargo: CargoPermissao) => {
    handleSelectCargo(cargo);
    setIsEditorOpen(true);
  };

  // Abrir Modal de Cadastro de Novo Cargo (Print 1 & 3)
  const handleOpenCreateModal = () => {
    setIsCreatingNew(true);
    setSelectedCargoId(null);
    setNome('');
    setSetor('CAMPO & SILAGEM');
    setDescricao('');
    setPermissoes({ ...DEFAULT_FORM_PERMISSOES });
    setFormError('');
    setIsEditorOpen(true);
  };

  // Fechar Modal Expandido e Retornar à Tabela Geral Limpa
  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setFormError('');
  };

  // Manipulador de Toggle de Permissão Principal
  const atualizarPermissao = (modulo: keyof RolePermissions, valor: boolean) => {
    setPermissoes(prev => {
      const next = { ...prev, [modulo]: valor };
      if (modulo === 'servicos' && valor && !next.sub_servicos) {
        next.sub_servicos = {
          agenda: true, corte: true, colheita: true, trator: true, maquina: true, frete: true, orcamento: true,
        };
      }
      if (modulo === 'frotas' && valor && !next.sub_frotas) {
        next.sub_frotas = {
          painel: true, veiculos: true, motoristas: true, equipes: true, combustivel: true, manutencoes: true, pneus: true,
        };
      }
      return next;
    });
  };

  // Manipulador de Sub-permissão de Serviços
  const atualizarSubServico = (subKey: keyof ServicesSubPermissions, valor: boolean) => {
    setPermissoes(prev => ({
      ...prev,
      sub_servicos: {
        ...(prev.sub_servicos || {}),
        [subKey]: valor,
      },
    }));
  };

  // Manipulador de Sub-permissão de Frotas
  const atualizarSubFrota = (subKey: keyof FrotasSubPermissions, valor: boolean) => {
    setPermissoes(prev => ({
      ...prev,
      sub_frotas: {
        ...(prev.sub_frotas || {}),
        [subKey]: valor,
      },
    }));
  };

  // Salvar Cargo (Criação ou Edição) e Retornar à Tabela Geral
  const handleSaveCargo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNome = nome.trim();
    const cleanSetor = setor.trim();

    if (!cleanNome) {
      setFormError('Informe o nome do cargo obrigatoriamente.');
      return;
    }
    if (!cleanSetor) {
      setFormError('Informe o setor / departamento.');
      return;
    }

    // Valida duplicação de nome
    const exists = cargos.some(c => 
      c.nome.trim().toLowerCase() === cleanNome.toLowerCase() && 
      c.id !== selectedCargoId
    );
    if (exists) {
      setFormError(`Já existe um cargo cadastrado com o nome "${cleanNome}".`);
      return;
    }

    let updatedList: CargoPermissao[];
    let savedCargoId: string;

    if (selectedCargoId && !isCreatingNew) {
      savedCargoId = selectedCargoId;
      const existing = cargos.find(c => c.id === selectedCargoId);
      const updatedCargo: CargoPermissao = {
        id: selectedCargoId,
        nome: cleanNome,
        setor: cleanSetor,
        descricao: descricao.trim() || undefined,
        permissoes: { ...permissoes },
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedList = cargos.map(c => c.id === selectedCargoId ? updatedCargo : c);
      showToast(`Cargo "${cleanNome}" atualizado com sucesso!`);
    } else {
      savedCargoId = `cargo-${Date.now()}`;
      const newCargo: CargoPermissao = {
        id: savedCargoId,
        nome: cleanNome,
        setor: cleanSetor,
        descricao: descricao.trim() || undefined,
        permissoes: { ...permissoes },
        createdAt: new Date().toISOString(),
      };
      updatedList = [...cargos, newCargo];
      showToast(`Novo cargo "${cleanNome}" cadastrado com sucesso!`);
    }

    setCargos(updatedList);
    saveStoredCargosPermissoes(updatedList);
    setFormError('');

    // Propaga atualização de permissões aos colaboradores associados a este cargo
    const currentEmps = getStoredEmployees();
    let empsModified = false;
    const refreshedEmps = currentEmps.map(emp => {
      const matchByName = emp.role && emp.role.trim().toLowerCase() === cleanNome.toLowerCase();
      const matchById = emp.cargoId === savedCargoId;
      if (matchByName || matchById) {
        empsModified = true;
        return {
          ...emp,
          cargoId: savedCargoId,
          cargo_setor: cleanSetor,
          permissions: { ...permissoes },
          permissoes: { ...permissoes },
        };
      }
      return emp;
    });

    if (empsModified) {
      saveStoredEmployees(refreshedEmps);
      setEmployees(refreshedEmps);
    }

    // Fecha o modal e retorna para a tabela geral limpa (Passo 1 & 3)
    setIsEditorOpen(false);
  };

  // Excluir Cargo
  const handleDeleteCargo = (cargoId: string) => {
    const cargo = cargos.find(c => c.id === cargoId);
    if (!cargo) return;

    const count = employeeCountByCargo[cargo.id] || 0;
    if (count > 0) {
      if (!confirm(`Atenção: Existem ${count} colaborador(es) associados ao cargo "${cargo.nome}". Deseja realmente remover? As permissões serão revogadas.`)) {
        return;
      }
    } else {
      if (!confirm(`Tem certeza que deseja excluir o cargo "${cargo.nome}"?`)) {
        return;
      }
    }

    const updated = cargos.filter(c => c.id !== cargo.id);
    setCargos(updated);
    saveStoredCargosPermissoes(updated);
    showToast(`Cargo "${cargo.nome}" removido.`);

    // Se estava editando este cargo no modal, seleciona o primeiro restante ou fecha
    if (selectedCargoId === cargoId) {
      if (updated.length > 0) {
        const sorted = [...updated].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        handleSelectCargo(sorted[0]);
      } else {
        setIsEditorOpen(false);
      }
    }
  };

  // Restaurar padrão
  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar a matriz padrão de cargos e permissões do sistema?')) {
      setCargos(INITIAL_CARGOS_PERMISSOES);
      saveStoredCargosPermissoes(INITIAL_CARGOS_PERMISSOES);
      showToast('Cargos e permissões restaurados para o padrão.');
    }
  };

  // Contadores de sub-permissões ativas no editor
  const activeSubServicosCount = useMemo(() => {
    if (!permissoes.servicos || !permissoes.sub_servicos) return 0;
    return Object.values(permissoes.sub_servicos).filter(Boolean).length;
  }, [permissoes.servicos, permissoes.sub_servicos]);

  const activeSubFrotasCount = useMemo(() => {
    if (!permissoes.frotas || !permissoes.sub_frotas) return 0;
    return Object.values(permissoes.sub_frotas).filter(Boolean).length;
  }, [permissoes.frotas, permissoes.sub_frotas]);

  // Estilo de badge do setor
  const getSectorBadgeStyle = (setorName?: string) => {
    const s = (setorName || '').toUpperCase();
    if (s.includes('DIRETORIA') || s.includes('ADMINISTRATIVO')) {
      return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    }
    if (s.includes('FINANCEIRO') || s.includes('CONTABILIDADE')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (s.includes('TRANSPORTE') || s.includes('LOGÍSTICA')) {
      return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    }
    if (s.includes('CAMPO') || s.includes('SILAGEM')) {
      return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    }
    if (s.includes('OFICINA') || s.includes('MANUTENÇÃO')) {
      return 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800';
    }
    if (s.includes('RECURSOS') || s.includes('HUMANOS') || s.includes('RH')) {
      return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
    }
    return 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700';
  };

  return (
    <div className="space-y-3 pb-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TELA INICIAL LIMPA: CABEÇALHO COM AÇÕES E BUSCA      */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                  Cargos, Setores & Permissões de Acesso
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  MATRIZ DE CONTROLE
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-stone-400">
                Gerenciamento de níveis de acesso por função com persistência local em <code>{CADASTROS_STORAGE_KEYS.CARGOS_PERMISSOES}</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Restaurar matriz padrão inicial de cargos"
              className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-stone-800 border border-zinc-300 dark:border-stone-700 transition cursor-pointer text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurar Padrão</span>
            </button>

            {/* BOTÃO + NOVO CARGO: ABRE O PAINEL DE 3 COLUNAS EM MODO EXPANDIDO */}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Cargo</span>
            </button>
          </div>
        </div>

        {/* Barra de Busca e Filtros */}
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome do cargo, setor ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="text-xs font-bold text-zinc-500 dark:text-stone-400">
              Total: <span className="text-zinc-900 dark:text-white font-extrabold">{filteredCargos.length}</span> cargo(s)
            </div>

            {/* Alternador de Visualização: Tabela (Padrão) ou Grade de Cards */}
            <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-lg">
              <button
                type="button"
                id="btn-cargos-view-list"
                onClick={() => {
                  setViewMode('list');
                  try { localStorage.setItem('silagem_cargos_view_mode', 'list'); } catch {}
                }}
                title="Visualização em Tabela Horizontal (Recomendado)"
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-stone-900 text-indigo-600 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id="btn-cargos-view-grid"
                onClick={() => {
                  setViewMode('grid');
                  try { localStorage.setItem('silagem_cargos_view_mode', 'grid'); } catch {}
                }}
                title="Visualização em Grade de Cards"
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-stone-900 text-indigo-600 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TELA INICIAL: TABELA GERAL LIMPA E AMPLA (PRINT 2)    */}
      {/* ======================================================== */}
      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-stone-800/80 border-b border-zinc-200 dark:border-stone-700 text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-400">
                  <th className="py-3 px-4">Cargo / Função</th>
                  <th className="py-3 px-4">Setor / Área</th>
                  <th className="py-3 px-4">Módulos Liberados</th>
                  <th className="py-3 px-4">Status de Uso</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-stone-800 text-xs">
                {filteredCargos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500 dark:text-stone-400">
                      Nenhum cargo encontrado para a busca "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  filteredCargos.map((cargo) => {
                    const empCount = employeeCountByCargo[cargo.id] || 0;

                    return (
                      <tr 
                        key={cargo.id} 
                        className="hover:bg-zinc-50/80 dark:hover:bg-stone-800/50 transition-colors group"
                      >
                        {/* 1. Coluna Cargo / Função */}
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-zinc-900 dark:text-white text-xs sm:text-sm">
                            {cargo.nome}
                          </div>
                          {cargo.descricao && (
                            <div className="text-[11px] text-zinc-500 dark:text-stone-400 truncate max-w-xs mt-0.5">
                              {cargo.descricao}
                            </div>
                          )}
                        </td>

                        {/* 2. Coluna Setor / Área */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-md border uppercase tracking-wider ${getSectorBadgeStyle(cargo.setor)}`}>
                            {cargo.setor || 'GERAL'}
                          </span>
                        </td>

                        {/* 3. Coluna Módulos Liberados */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                            {/* Serviços */}
                            {cargo.permissoes?.servicos ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Serviços</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Serviços</span>
                              </span>
                            )}

                            {/* Frotas */}
                            {cargo.permissoes?.frotas ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Frotas</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Frotas</span>
                              </span>
                            )}

                            {/* Financeiro */}
                            {cargo.permissoes?.financeiro ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Financeiro</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Financeiro</span>
                              </span>
                            )}

                            {/* RH */}
                            {cargo.permissoes?.rh ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>RH</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>RH</span>
                              </span>
                            )}

                            {/* Estoque */}
                            {cargo.permissoes?.estoque ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Estoque</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Estoque</span>
                              </span>
                            )}

                            {/* Minha Empresa */}
                            {cargo.permissoes?.empresa ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Empresa</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Empresa</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Coluna Status de Uso (Botão Reativo com Modal Slim - Print 1) */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedCargoForEmployees(cargo)}
                            className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 transition cursor-pointer"
                            title={`Clique para listar os colaboradores vinculados ao cargo "${cargo.nome}"`}
                          >
                            <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>
                              <strong>{empCount}</strong> {empCount === 1 ? 'colaborador' : 'colaboradores'}
                            </span>
                            <Eye className="w-3 h-3 text-blue-400 ml-0.5 opacity-70" />
                          </button>
                        </td>

                        {/* 5. Coluna Ações (Editar com Lápis aciona o Modal Expandido de 3 Colunas) */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* BOTÃO EDITAR: ABRE O PAINEL DE 3 COLUNAS */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(cargo)}
                              className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition cursor-pointer flex items-center space-x-1 font-bold text-xs"
                              title={`Editar cargo "${cargo.nome}"`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCargo(cargo.id)}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition cursor-pointer"
                              title={`Excluir cargo "${cargo.nome}"`}
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
      ) : (
        /* Visualização Alternativa em Grade de Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredCargos.map((cargo) => {
            const empCount = employeeCountByCargo[cargo.id] || 0;

            return (
              <div
                key={cargo.id}
                className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                        {cargo.nome}
                      </h4>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border uppercase mt-1 ${getSectorBadgeStyle(cargo.setor)}`}>
                        {cargo.setor || 'GERAL'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cargo)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCargo(cargo.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {cargo.descricao && (
                    <p className="text-[11px] text-zinc-500 dark:text-stone-400 mt-2 line-clamp-2">
                      {cargo.descricao}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-stone-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedCargoForEmployees(cargo)}
                    className="flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span><strong>{empCount}</strong> colaborador(es)</span>
                  </button>

                  <span className="text-[10px] text-zinc-400">
                    ID: {cargo.id.slice(0, 10)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL EXPANDIDO DE TELA CHEIA (3 COLUNAS) PARA EDIÇÃO/NOVO CARGO       */}
      {/*    (ACIONADO APENAS AO CLICAR EM '+ NOVO CARGO' OU 'EDITAR')              */}
      {/* ========================================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150 overflow-hidden">
          <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header Amplo do Modal de 3 Colunas */}
            <div className="px-4 sm:px-5 py-3.5 bg-zinc-50 dark:bg-stone-850 border-b border-zinc-200 dark:border-stone-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0 pr-3">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
                  <Shield className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white truncate">
                      {isCreatingNew ? 'Cadastrar Novo Cargo' : `Editar Cargo: ${nome || selectedCargo?.nome}`}
                    </h3>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                      isCreatingNew ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300' : 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-300'
                    }`}>
                      {isCreatingNew ? 'Novo Cadastro' : 'Edição Dinâmica'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-stone-400 truncate">
                    Painel integrado de 3 seções: seleção rápida A-Z, dados e chaves centrais, e refinamento granular de telas.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    isCreatingNew 
                      ? 'bg-amber-600 text-white border-amber-600' 
                      : 'bg-white dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border-zinc-300 dark:border-stone-700 hover:bg-zinc-100'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo</span>
                </button>

                {/* Botão Fechar/Sair */}
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-stone-800 transition cursor-pointer"
                  title="Sair e retornar para a Tabela Geral"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CORPO DO MODAL: AS 3 COLUNAS PARALELAS */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-zinc-100/60 dark:bg-stone-950/40">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                
                {/* ======================================================== */}
                {/* COLUNA 1 (EXTREMIDADE ESQUERDA - LISTAGEM FIXA A-Z)      */}
                {/* ======================================================== */}
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
                  <div className="p-3 bg-zinc-50 dark:bg-stone-800/60 border-b border-zinc-200 dark:border-stone-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                          1. Lista de Cargos
                        </h4>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-stone-700 text-zinc-800 dark:text-stone-200">
                        {editorFilteredCargos.length} A-Z
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Filtrar cargos..."
                        value={editorSearchTerm}
                        onChange={(e) => setEditorSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />
                      {editorSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setEditorSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-stone-800 max-h-[66vh] overflow-y-auto custom-scrollbar">
                    {editorFilteredCargos.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-500">
                        Nenhum cargo encontrado.
                      </div>
                    ) : (
                      editorFilteredCargos.map((cargo) => {
                        const isSelected = !isCreatingNew && selectedCargoId === cargo.id;
                        const empCount = employeeCountByCargo[cargo.id] || 0;

                        return (
                          <div
                            key={cargo.id}
                            onClick={() => handleSelectCargo(cargo)}
                            className={`p-2.5 transition-all duration-150 cursor-pointer border-l-4 text-left select-none relative group ${
                              isSelected
                                ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-white shadow-2xs font-semibold'
                                : 'border-transparent hover:bg-zinc-50 dark:hover:bg-stone-800/50 text-zinc-800 dark:text-stone-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5">
                                  <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-900 dark:text-white'}`}>
                                    {cargo.nome}
                                  </span>
                                  {isSelected && (
                                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-500 dark:text-stone-400 uppercase tracking-tight truncate mt-0.5">
                                  {cargo.setor || 'Geral'}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCargoForEmployees(cargo);
                                }}
                                className="shrink-0 flex items-center space-x-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline px-1.5 py-0.5 rounded bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 transition cursor-pointer"
                                title={`Colaboradores vinculados`}
                              >
                                <Users className="w-3 h-3 text-blue-500 shrink-0" />
                                <span>{empCount}</span>
                              </button>
                            </div>

                            <div className="mt-1.5 flex items-center space-x-1">
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.servicos ? 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300' : 'bg-zinc-100 text-zinc-400'}`}>S</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.frotas ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300' : 'bg-zinc-100 text-zinc-400'}`}>F</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.financeiro ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-400'}`}>$</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.rh ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300' : 'bg-zinc-100 text-zinc-400'}`}>RH</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.estoque ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' : 'bg-zinc-100 text-zinc-400'}`}>Est</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.empresa ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300' : 'bg-zinc-100 text-zinc-400'}`}>Emp</span>
                              <div className="flex-1" />
                              <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-zinc-300 dark:text-stone-600'}`} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ======================================================== */}
                {/* COLUNA 2 (CENTRAL - PAINEL DE IDENTIFICAÇÃO E CHAVES)    */}
                {/* ======================================================== */}
                <div className="lg:col-span-4 xl:col-span-5 flex flex-col bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl shadow-xs p-3.5 sm:p-4 space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-stone-800 shrink-0">
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white truncate">
                          2. Identificação & Chaves Principais
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-stone-400 truncate">
                          {isCreatingNew ? 'Cadastrando um novo cargo' : `Editando: ${selectedCargo?.nome || 'Cargo selecionado'}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center space-x-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Formulário com Autocomplete e Chaves Principais */}
                  <form onSubmit={handleSaveCargo} className="space-y-3.5">
                    {/* Campo 1: Nome do Cargo (Textbox Inteligente / Combobox com Busca) */}
                    <div className="relative" ref={comboboxRef}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-zinc-700 dark:text-stone-300 flex items-center gap-1">
                          <span>Nome do Cargo</span>
                          <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[10px] text-zinc-400">Sugestões inteligentes ativas</span>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Ex: Motorista de Caminhão, Mecânico, etc."
                          value={nome}
                          onFocus={() => setIsComboboxOpen(true)}
                          onChange={(e) => {
                            setNome(e.target.value);
                            setIsComboboxOpen(true);
                          }}
                          className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        />

                        {nome && (
                          <button
                            type="button"
                            onClick={() => {
                              setNome('');
                              setIsComboboxOpen(true);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown de Sugestões de Nomes de Cargos */}
                      {isComboboxOpen && existingCargoSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-xl shadow-xl divide-y divide-zinc-100 dark:divide-stone-700 animate-in fade-in zoom-in-95 duration-100">
                          <div className="p-1.5 bg-zinc-50 dark:bg-stone-800 text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Cargos já cadastrados:</span>
                            <button 
                              type="button" 
                              onClick={() => setIsComboboxOpen(false)}
                              className="text-zinc-400 hover:text-zinc-700"
                            >
                              ✕
                            </button>
                          </div>
                          {existingCargoSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setNome(suggestion);
                                setIsComboboxOpen(false);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-zinc-800 dark:text-stone-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 transition flex items-center justify-between cursor-pointer"
                            >
                              <span>{suggestion}</span>
                              <Sparkles className="w-3 h-3 text-indigo-400 opacity-60" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Campo 2: Setor / Departamento (Textbox Interativo + Grade de Tags Clicáveis '+') */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-zinc-700 dark:text-stone-300 flex items-center gap-1">
                          <span>Setor / Departamento</span>
                          <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[10px] text-zinc-400">Clique nas tags abaixo para preencher</span>
                      </div>

                      <input
                        type="text"
                        required
                        placeholder="Ex: Transporte, Campo, Financeiro, Oficina..."
                        value={setor}
                        onChange={(e) => setSetor(e.target.value)}
                        className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />

                      {/* GRADE DE SETORES COM SELEÇÃO DE TAGS CLICÁVEIS */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {SETORES_DISPONIVEIS.map((s) => {
                          const isSelected = setor.trim().toUpperCase() === s.toUpperCase();
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSetor(s)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all duration-150 cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-800 scale-102'
                                  : 'bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border-zinc-200 dark:border-stone-700 hover:bg-zinc-200 dark:hover:bg-stone-700 hover:border-zinc-400'
                              }`}
                              title={`Selecionar setor ${s}`}
                            >
                              <span>{isSelected ? '✓' : '+'}</span>
                              <span>{s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Campo 3: Descrição Básica do Cargo */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                        Descrição básica do Cargo
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Resumo das atribuições, responsabilidades e escopo..."
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs resize-none"
                      />
                    </div>

                    {/* Chaves Centrais Liga/Desliga */}
                    <div className="pt-2 border-t border-zinc-200 dark:border-stone-800 space-y-2">
                      <div className="flex items-center justify-between pb-1">
                        <div className="flex items-center space-x-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                            Chaves de Acesso Principais
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-semibold">
                          Toggles Ativos
                        </span>
                      </div>

                      {/* 1. Módulo Serviços */}
                      <label 
                        htmlFor="modal-toggle-servicos"
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.servicos
                            ? 'bg-teal-50/90 dark:bg-teal-950/40 border-teal-400 dark:border-teal-600 shadow-xs ring-1 ring-teal-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.servicos ? 'bg-teal-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Tractor className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Serviços</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.servicos ? 'bg-teal-200 text-teal-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.servicos ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Agenda, Corte, Colheita, Trator, Máquinas e Orçamento
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-servicos"
                            checked={Boolean(permissoes.servicos)}
                            onChange={(e) => atualizarPermissao('servicos', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.servicos ? 'bg-teal-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.servicos ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 2. Módulo Frotas & Veículos */}
                      <label 
                        htmlFor="modal-toggle-frotas"
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.frotas
                            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs ring-1 ring-blue-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.frotas ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso a Frotas & Veículos</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.frotas ? 'bg-blue-200 text-blue-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.frotas ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Veículos, Manutenções, Abastecimento, Pneus
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-frotas"
                            checked={Boolean(permissoes.frotas)}
                            onChange={(e) => atualizarPermissao('frotas', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.frotas ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.frotas ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 3. Módulo Financeiro */}
                      <label 
                        htmlFor="modal-toggle-financeiro"
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.financeiro
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-xs ring-1 ring-emerald-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.financeiro ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <DollarSign className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Financeiro</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.financeiro ? 'bg-emerald-200 text-emerald-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.financeiro ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Bancos, Saldos, DRE, Contas a Pagar e Receber
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-financeiro"
                            checked={Boolean(permissoes.financeiro)}
                            onChange={(e) => atualizarPermissao('financeiro', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.financeiro ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.financeiro ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 4. Recursos Humanos */}
                      <label 
                        htmlFor="modal-toggle-rh"
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.rh
                            ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600 shadow-xs ring-1 ring-purple-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.rh ? 'bg-purple-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <HeartHandshake className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso a Recursos Humanos</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.rh ? 'bg-purple-200 text-purple-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.rh ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Folha de Pagamento, Férias, Faltas e Atestados
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-rh"
                            checked={Boolean(permissoes.rh)}
                            onChange={(e) => atualizarPermissao('rh', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.rh ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.rh ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 5. Estoque & Almoxarifado */}
                      <label 
                        htmlFor="modal-toggle-estoque"
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.estoque
                            ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-xs ring-1 ring-amber-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.estoque ? 'bg-amber-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Package className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Estoque & Almoxarifado</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.estoque ? 'bg-amber-200 text-amber-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.estoque ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Produtos, Insumos e Lançamento de NF-e
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-estoque"
                            checked={Boolean(permissoes.estoque)}
                            onChange={(e) => atualizarPermissao('estoque', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.estoque ? 'bg-amber-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.estoque ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 6. Dados da Empresa */}
                      <label 
                        htmlFor="modal-toggle-empresa"
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.empresa
                            ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 shadow-xs ring-1 ring-rose-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.empresa ? 'bg-rose-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Building className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Dados da Empresa</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.empresa ? 'bg-rose-200 text-rose-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.empresa ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Configurações cadastrais, CNPJ e Razão Social
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-empresa"
                            checked={Boolean(permissoes.empresa)}
                            onChange={(e) => atualizarPermissao('empresa', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.empresa ? 'bg-rose-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.empresa ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Botões de Ação na Base da Coluna 2 */}
                    <div className="pt-3 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-between gap-2">
                      <div>
                        {!isCreatingNew && selectedCargoId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCargo(selectedCargoId)}
                            className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition cursor-pointer text-xs font-bold flex items-center gap-1.5"
                            title="Excluir este cargo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleCloseEditor}
                          className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-100 dark:hover:bg-stone-800 font-bold text-xs transition cursor-pointer"
                        >
                          Sair
                        </button>

                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95 flex items-center space-x-1.5"
                        >
                          <Save className="w-4 h-4" />
                          <span>{isCreatingNew ? 'Cadastrar Cargo' : 'Salvar Alterações'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* ======================================================== */}
                {/* COLUNA 3 (EXTREMIDADE DIREITA - SUB-PERMISSÕES POR TELA)  */}
                {/* ======================================================== */}
                <div className="lg:col-span-4 xl:col-span-4 flex flex-col bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl shadow-xs p-3.5 sm:p-4 space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-stone-800 shrink-0">
                    <div className="flex items-center space-x-2 min-w-0 pr-2">
                      <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shrink-0">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white truncate">
                          3. Sub-permissões por Tela
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-stone-400 truncate">
                          Controle granular por tela e aba interna
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 dark:bg-teal-950/80 dark:text-teal-300 uppercase shrink-0">
                      Granular
                    </span>
                  </div>

                  <div className="space-y-3.5 max-h-[66vh] overflow-y-auto pr-1 custom-scrollbar">
                    {/* Bloco 1: Sub-permissões do Módulo Serviços */}
                    {permissoes.servicos ? (
                      <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20 p-3 space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-1.5 border-b border-teal-200/80 dark:border-teal-800/60">
                          <div className="flex items-center space-x-2">
                            <Tractor className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            <span className="text-xs font-black text-teal-950 dark:text-teal-200 uppercase">
                              Módulo de Serviços
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                setPermissoes(prev => ({
                                  ...prev,
                                  sub_servicos: {
                                    agenda: true, corte: true, colheita: true, trator: true, maquina: true, frete: true, orcamento: true,
                                  },
                                }));
                              }}
                              className="text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                            >
                              Marcar Todas
                            </button>
                            <span className="text-teal-400">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                setPermissoes(prev => ({
                                  ...prev,
                                  sub_servicos: {
                                    agenda: false, corte: false, colheita: false, trator: false, maquina: false, frete: false, orcamento: false,
                                  },
                                }));
                              }}
                              className="text-teal-700 dark:text-teal-300 hover:underline cursor-pointer"
                            >
                              Desmarcar
                            </button>
                          </div>
                        </div>

                        <div className="text-[10px] text-teal-800 dark:text-teal-300 leading-tight">
                          Selecione quais telas operacionais o cargo poderá visualizar e registrar:
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_servicos?.agenda !== false}
                              onChange={(e) => atualizarSubServico('agenda', e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Agenda de Serviços</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_servicos?.corte !== false}
                              onChange={(e) => atualizarSubServico('corte', e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Corte</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_servicos?.colheita !== false}
                              onChange={(e) => atualizarSubServico('colheita', e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Colheita</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_servicos?.trator !== false}
                              onChange={(e) => atualizarSubServico('trator', e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Serviço de Trator</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_servicos?.maquina !== false}
                              onChange={(e) => atualizarSubServico('maquina', e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Serviço de Máquina</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_servicos?.frete !== false}
                              onChange={(e) => atualizarSubServico('frete', e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Serviço de Frete</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-teal-200/80 dark:border-teal-900/60 hover:border-teal-400 cursor-pointer select-none sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_servicos?.orcamento !== false}
                              onChange={(e) => atualizarSubServico('orcamento', e.target.checked)}
                              className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Orçamento</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-zinc-200 dark:border-stone-800 bg-zinc-50 dark:bg-stone-850 text-zinc-500 dark:text-stone-400 text-xs flex items-start space-x-2.5">
                        <Tractor className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-zinc-700 dark:text-stone-300">Serviços Bloqueado</strong>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Ative a chave "Acesso ao Módulo Serviços" na coluna central para liberar e configurar as sub-telas operacionais.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bloco 2: Sub-permissões do Módulo Frotas & Veículos */}
                    {permissoes.frotas ? (
                      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20 p-3 space-y-2.5 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/80 dark:border-blue-800/60">
                          <div className="flex items-center space-x-2">
                            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-black text-blue-950 dark:text-blue-200 uppercase">
                              Gestão de Frotas & Veículos
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                setPermissoes(prev => ({
                                  ...prev,
                                  sub_frotas: {
                                    painel: true, veiculos: true, motoristas: true, equipes: true, combustivel: true, manutencoes: true, pneus: true,
                                  },
                                }));
                              }}
                              className="text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
                            >
                              Marcar Todas
                            </button>
                            <span className="text-blue-400">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                setPermissoes(prev => ({
                                  ...prev,
                                  sub_frotas: {
                                    painel: false, veiculos: false, motoristas: false, equipes: false, combustivel: false, manutencoes: false, pneus: false,
                                  },
                                }));
                              }}
                              className="text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
                            >
                              Desmarcar
                            </button>
                          </div>
                        </div>

                        <div className="text-[10px] text-blue-800 dark:text-blue-300 leading-tight">
                          Selecione quais telas do módulo de frotas o cargo poderá operar:
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_frotas?.painel !== false}
                              onChange={(e) => atualizarSubFrota('painel', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Painel Frotas</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_frotas?.veiculos !== false}
                              onChange={(e) => atualizarSubFrota('veiculos', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Veículos</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_frotas?.motoristas !== false}
                              onChange={(e) => atualizarSubFrota('motoristas', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Motoristas</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_frotas?.equipes !== false}
                              onChange={(e) => atualizarSubFrota('equipes', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Equipes</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_frotas?.combustivel !== false}
                              onChange={(e) => atualizarSubFrota('combustivel', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Combustível</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_frotas?.manutencoes !== false}
                              onChange={(e) => atualizarSubFrota('manutencoes', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Manutenções</span>
                          </label>

                          <label className="flex items-center space-x-2 p-1.5 rounded-lg bg-white dark:bg-stone-900 border border-blue-200/80 dark:border-blue-900/60 hover:border-blue-400 cursor-pointer select-none sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={permissoes.sub_frotas?.pneus !== false}
                              onChange={(e) => atualizarSubFrota('pneus', e.target.checked)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-stone-200">Rodízio de Pneus</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-zinc-200 dark:border-stone-800 bg-zinc-50 dark:bg-stone-850 text-zinc-500 dark:text-stone-400 text-xs flex items-start space-x-2.5">
                        <Truck className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-zinc-700 dark:text-stone-300">Frotas Bloqueado</strong>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Ative a chave "Acesso a Frotas & Veículos" na coluna central para liberar e configurar os itens de veículos e manutenções.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Resumo Granular */}
                    <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-[11px] text-indigo-950 dark:text-indigo-300 space-y-1">
                      <div className="font-extrabold flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>Resumo das Sub-telas Ativas:</span>
                      </div>
                      <p className="text-[10px] text-indigo-800/80 dark:text-indigo-300/80">
                        • Serviços: <strong>{activeSubServicosCount}</strong> de 7 telas ativas.
                        <br />
                        • Frotas: <strong>{activeSubFrotasCount}</strong> de 7 telas ativas.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL SLIM: COLABORADORES VINCULADOS AO CARGO (PRINT 1) */}
      <CargoEmployeesModal
        isOpen={Boolean(selectedCargoForEmployees)}
        onClose={() => setSelectedCargoForEmployees(null)}
        cargo={selectedCargoForEmployees}
        employees={employees}
      />
    </div>
  );
};
