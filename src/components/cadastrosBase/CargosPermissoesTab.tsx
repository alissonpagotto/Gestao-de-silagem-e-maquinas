import React, { useState, useEffect, useMemo } from 'react';
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
  HeartHandshake,
  Package,
  Settings,
  Building,
  AlertTriangle,
  RotateCcw,
  LayoutGrid,
  List
} from 'lucide-react';
import { CargoPermissao, RolePermissions, Employee } from '../../types';
import { 
  getStoredCargosPermissoes, 
  saveStoredCargosPermissoes, 
  INITIAL_CARGOS_PERMISSOES,
  CADASTROS_STORAGE_KEYS 
} from '../../lib/cadastrosBaseStorage';
import { getStoredEmployees, saveStoredEmployees } from '../../lib/storage';

export const CargosPermissoesTab: React.FC = () => {
  const [cargos, setCargos] = useState<CargoPermissao[]>(() => getStoredCargosPermissoes());
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('silagem_cargos_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
    } catch {}
    return 'list'; // PADRÃO ATIVO
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<CargoPermissao | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [setor, setSetor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [permissoes, setPermissoes] = useState<RolePermissions>({
    financeiro: false,
    frotas: true,
    rh: false,
    estoque: false,
    empresa: false,
  });
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const filteredCargos = useMemo(() => {
    const sorted = [...cargos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.setor.toLowerCase().includes(term) ||
      (c.descricao && c.descricao.toLowerCase().includes(term))
    );
  }, [cargos, searchTerm]);

  const handleOpenCreateModal = () => {
    setEditingCargo(null);
    setNome('');
    setSetor('CAMPO & SILAGEM');
    setDescricao('');
    setPermissoes({
      financeiro: false,
      frotas: true,
      rh: false,
      estoque: false,
      empresa: false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cargo: CargoPermissao) => {
    setEditingCargo(cargo);
    setNome(cargo.nome);
    setSetor(cargo.setor || 'Geral');
    setDescricao(cargo.descricao || '');
    setPermissoes({
      financeiro: Boolean(cargo.permissoes?.financeiro),
      frotas: Boolean(cargo.permissoes?.frotas),
      rh: Boolean(cargo.permissoes?.rh),
      estoque: Boolean(cargo.permissoes?.estoque),
      empresa: Boolean(cargo.permissoes?.empresa),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const atualizarPermissao = (key: keyof RolePermissions, checked?: boolean) => {
    setPermissoes(prev => ({
      ...prev,
      [key]: typeof checked === 'boolean' ? checked : !prev[key],
    }));
  };

  const handleTogglePermission = (key: keyof RolePermissions) => {
    atualizarPermissao(key);
  };

  const handleSaveCargo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = nome.trim();
    const cleanSetor = setor.trim() || 'Geral';

    if (!cleanNome) {
      setFormError('Informe o nome do cargo obrigatoriamente.');
      return;
    }

    // Valida duplicação de nome
    const exists = cargos.some(c => 
      c.nome.trim().toLowerCase() === cleanNome.toLowerCase() && 
      c.id !== editingCargo?.id
    );
    if (exists) {
      setFormError(`Já existe um cargo cadastrado com o nome "${cleanNome}".`);
      return;
    }

    let updatedList: CargoPermissao[];
    let savedCargoId: string;

    if (editingCargo) {
      savedCargoId = editingCargo.id;
      const updatedCargo: CargoPermissao = {
        ...editingCargo,
        nome: cleanNome,
        setor: cleanSetor,
        descricao: descricao.trim() || undefined,
        permissoes: { ...permissoes },
        updatedAt: new Date().toISOString(),
      };
      updatedList = cargos.map(c => c.id === editingCargo.id ? updatedCargo : c);
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

    setIsModalOpen(false);
  };

  const handleDeleteCargo = (cargo: CargoPermissao) => {
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
  };

  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar a matriz padrão de cargos e permissões do sistema?')) {
      setCargos(INITIAL_CARGOS_PERMISSOES);
      saveStoredCargosPermissoes(INITIAL_CARGOS_PERMISSOES);
      showToast('Cargos e permissões restaurados para o padrão.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header com Ações e Busca */}
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <Shield className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                  Cargos, Setores & Permissões de Acesso
                </h3>
                <p className="text-xs text-zinc-500 dark:text-stone-400">
                  Gerenciamento de níveis de acesso por função com persistência local em <code>{CADASTROS_STORAGE_KEYS.CARGOS_PERMISSOES}</code>.
                </p>
              </div>
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
              className="w-full pl-9 pr-4 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="text-xs font-bold text-zinc-500 dark:text-stone-400">
              Total: <span className="text-zinc-900 dark:text-white font-extrabold">{filteredCargos.length}</span> cargo(s)
            </div>

            {/* Seletor de Visualização (Toggle Group: Lista / Grade) */}
            <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-lg">
              <button
                type="button"
                id="btn-cargos-view-list"
                onClick={() => {
                  setViewMode('list');
                  try { localStorage.setItem('silagem_cargos_view_mode', 'list'); } catch {}
                }}
                title="Visualização em Lista Compacta"
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

      {/* Renderização Condicional: Modo Lista Compacta vs Modo Grade */}
      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl shadow-xs overflow-hidden">
          {/* 1. LINHA DE CABEÇALHO DA LISTA (TÍTULOS DE COLUNA) */}
          <div className="bg-zinc-100/70 dark:bg-stone-800/80 border-b border-zinc-200 dark:border-stone-800 grid grid-cols-[minmax(200px,1.5fr)_minmax(140px,1.1fr)_minmax(260px,2fr)_minmax(130px,0.9fr)_64px] items-center px-4 py-2 gap-2 text-[11px] font-bold text-zinc-500 dark:text-stone-400 uppercase tracking-wider">
            <div>CARGO</div>
            <div>SETOR / ÁREA</div>
            <div>MÓDULOS LIBERADOS</div>
            <div>STATUS DE USO</div>
            <div className="text-right">AÇÕES</div>
          </div>

          {/* LINHAS DE CARGOS */}
          <div className="divide-y divide-zinc-200 dark:divide-stone-800">
            {filteredCargos.map((cargo, index) => {
              const empCount = employeeCountByCargo[cargo.id] || 0;
              return (
                <div 
                  key={`${cargo.id}-${index}`}
                  className="grid grid-cols-[minmax(200px,1.5fr)_minmax(140px,1.1fr)_minmax(260px,2fr)_minmax(130px,0.9fr)_64px] items-center px-4 py-1.5 sm:py-2 hover:bg-zinc-50/80 dark:hover:bg-stone-800/50 transition gap-2"
                >
                  {/* Coluna 1: CARGO (Texto completo sem reticências prematuras) */}
                  <div className="flex items-center space-x-2 min-w-0 pr-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-white whitespace-nowrap">
                      {cargo.nome}
                    </span>
                  </div>

                  {/* Coluna 2: SETOR / ÁREA */}
                  <div className="min-w-0">
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border border-zinc-200 dark:border-stone-700 whitespace-nowrap">
                      {cargo.setor || 'Geral'}
                    </span>
                  </div>

                  {/* Coluna 3: MÓDULOS LIBERADOS */}
                  <div className="flex items-center space-x-1.5 min-w-0 flex-wrap py-0.5">
                    {cargo.permissoes?.financeiro && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>Financeiro</span>
                      </span>
                    )}
                    {cargo.permissoes?.frotas && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                        <span>Frotas</span>
                      </span>
                    )}
                    {cargo.permissoes?.rh && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></span>
                        <span>RH</span>
                      </span>
                    )}
                    {cargo.permissoes?.estoque && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                        <span>Estoque/NF-e</span>
                      </span>
                    )}
                    {cargo.permissoes?.empresa && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                        <span>Empresa</span>
                      </span>
                    )}
                    {!cargo.permissoes?.financeiro && !cargo.permissoes?.frotas && !cargo.permissoes?.rh && !cargo.permissoes?.estoque && !cargo.permissoes?.empresa && (
                      <span className="text-[11px] text-zinc-400 italic">Sem módulos liberados</span>
                    )}
                  </div>

                  {/* Coluna 4: STATUS DE USO */}
                  <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-stone-400 min-w-0">
                    <div className="flex items-center space-x-1 shrink-0">
                      <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="text-zinc-700 dark:text-stone-300 font-semibold whitespace-nowrap">
                        {empCount} colaboradores
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono hidden xl:inline">
                      {cargo.id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Coluna 5: AÇÕES */}
                  <div className="flex items-center justify-end space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(cargo)}
                      title="Editar Cargo e Permissões"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100 dark:text-stone-400 dark:hover:text-indigo-400 dark:hover:bg-stone-800 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCargo(cargo)}
                      title="Excluir Cargo"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-zinc-100 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-stone-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grid de Cards / Tabela de Cargos (Modo Grade) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCargos.map((cargo, index) => {
            const empCount = employeeCountByCargo[cargo.id] || 0;
            return (
              <div 
                key={`${cargo.id}-${index}`}
                className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-4 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border border-zinc-200 dark:border-stone-700">
                        {cargo.setor || 'Geral'}
                      </span>
                      <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-1.5 tracking-tight">
                        {cargo.nome}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cargo)}
                        title="Editar Cargo e Permissões"
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-indigo-600 hover:bg-zinc-100 dark:text-stone-400 dark:hover:text-indigo-400 dark:hover:bg-stone-800 transition cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCargo(cargo)}
                        title="Excluir Cargo"
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-600 hover:bg-zinc-100 dark:text-stone-400 dark:hover:text-rose-400 dark:hover:bg-stone-800 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {cargo.descricao && (
                    <p className="text-xs text-zinc-600 dark:text-stone-400 mt-2 line-clamp-2">
                      {cargo.descricao}
                    </p>
                  )}

                  {/* Grade de Badges de Permissões */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-stone-800/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-zinc-600 dark:text-stone-400 uppercase tracking-wider">
                      Módulos Liberados:
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {cargo.permissoes?.financeiro ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Financeiro</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-70">
                          <XCircle className="w-3 h-3 shrink-0" />
                          <span>Financeiro</span>
                        </span>
                      )}

                      {cargo.permissoes?.frotas ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Frotas</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-70">
                          <XCircle className="w-3 h-3 shrink-0" />
                          <span>Frotas</span>
                        </span>
                      )}

                      {cargo.permissoes?.rh ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>RH</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-70">
                          <XCircle className="w-3 h-3 shrink-0" />
                          <span>RH</span>
                        </span>
                      )}

                      {cargo.permissoes?.estoque ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Estoque/NF-e</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-70">
                          <XCircle className="w-3 h-3 shrink-0" />
                          <span>Estoque/NF-e</span>
                        </span>
                      )}

                      {cargo.permissoes?.empresa ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>Minha Empresa</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-70">
                          <XCircle className="w-3 h-3 shrink-0" />
                          <span>Minha Empresa</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rodapé com contagem de colaboradores vinculados */}
                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-stone-800 flex items-center justify-between text-xs text-zinc-500 dark:text-stone-400">
                  <div className="flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span>
                      <strong className="text-zinc-800 dark:text-white">{empCount}</strong> colaborador(es)
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">ID: {cargo.id.slice(0, 12)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE CARGO COM FORMULÁRIO DIVIDIDO EM DUAS SEÇÕES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-hidden">
          <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl max-w-4xl w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-y-hidden max-h-[96vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-stone-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <Shield className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-zinc-900 dark:text-white tracking-tight">
                    {editingCargo ? `Editar Cargo: ${editingCargo.nome}` : 'Cadastrar Novo Cargo'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-stone-400">
                    Defina os dados cadastrais no lado esquerdo e configure a grade de permissões no lado direito.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center space-x-2 text-xs font-bold text-rose-700 dark:text-rose-300 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCargo} className="mt-3.5 space-y-3.5 flex-1 flex flex-col overflow-y-hidden">
              {/* LAYOUT DIVIDIDO EM DUAS SEÇÕES: LADO ESQUERDO E LADO DIREITO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                
                {/* LADO ESQUERDO: IDENTIFICAÇÃO DO CARGO */}
                <div className="bg-zinc-50 dark:bg-stone-800/50 p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-stone-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 pb-1.5 border-b border-zinc-200 dark:border-stone-700">
                      <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900 dark:text-white">
                        1. Identificação do Cargo
                      </h4>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                        Nome do Cargo <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Motorista de Caminhão, Mecânico, etc."
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                        Setor / Departamento <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Transporte, Campo, Financeiro, Oficina..."
                        value={setor}
                        onChange={(e) => setSetor(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />

                      {/* GRADE DE SETORES COM SELEÇÃO DE TAGS CLICÁVEIS */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          'DIRETORIA & ADMINISTRATIVO',
                          'FINANCEIRO & CONTABILIDADE',
                          'TRANSPORTE & LOGÍSTICA',
                          'CAMPO & SILAGEM',
                          'OFICINA & MANUTENÇÃO',
                          'RECURSOS HUMANOS'
                        ].map((s) => {
                          const isSelected = setor.trim().toUpperCase() === s.toUpperCase();
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSetor(s)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all duration-150 cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-800 scale-105'
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

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                        Descrição básica do Cargo
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Resumo das atribuições, responsabilidades e escopo..."
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs resize-none"
                      />
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[10px] sm:text-[11px] text-blue-900 dark:text-blue-300 flex items-start space-x-2">
                    <Info className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <span>
                      Ao vincular este cargo a um colaborador, estas permissões serão anexadas à sua ficha cadastral no módulo RH.
                    </span>
                  </div>
                </div>

                {/* LADO DIREITO: GRADE DE PERMISSÕES DE ACESSO (TOGGLE SWITCHES EDITÁVEIS) */}
                <div className="bg-zinc-50 dark:bg-stone-800/50 p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-stone-800 space-y-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-stone-700">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900 dark:text-white">
                        2. Grade de Permissões de Acesso
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-stone-400">
                      Liga / Desliga
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* Toggle 1: Financeiro */}
                    <label 
                      htmlFor="toggle-financeiro"
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                        permissoes.financeiro
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-xs ring-1 ring-emerald-400/30'
                          : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.financeiro ? 'bg-emerald-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
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
                          id="toggle-financeiro"
                          checked={Boolean(permissoes.financeiro)}
                          onChange={(e) => atualizarPermissao('financeiro', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.financeiro ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.financeiro ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </label>

                    {/* Toggle 2: Frotas & Veículos */}
                    <label 
                      htmlFor="toggle-frotas"
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                        permissoes.frotas
                          ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs ring-1 ring-blue-400/30'
                          : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.frotas ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
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
                          id="toggle-frotas"
                          checked={Boolean(permissoes.frotas)}
                          onChange={(e) => atualizarPermissao('frotas', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.frotas ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.frotas ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </label>

                    {/* Toggle 3: Recursos Humanos */}
                    <label 
                      htmlFor="toggle-rh"
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                        permissoes.rh
                          ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600 shadow-xs ring-1 ring-purple-400/30'
                          : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.rh ? 'bg-purple-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
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
                          id="toggle-rh"
                          checked={Boolean(permissoes.rh)}
                          onChange={(e) => atualizarPermissao('rh', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.rh ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.rh ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </label>

                    {/* Toggle 4: Estoque / Almoxarifado / NF-e */}
                    <label 
                      htmlFor="toggle-estoque"
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                        permissoes.estoque
                          ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-xs ring-1 ring-amber-400/30'
                          : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.estoque ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
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
                          id="toggle-estoque"
                          checked={Boolean(permissoes.estoque)}
                          onChange={(e) => atualizarPermissao('estoque', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.estoque ? 'bg-amber-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.estoque ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </label>

                    {/* Toggle 5: Dados da Empresa */}
                    <label 
                      htmlFor="toggle-empresa"
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                        permissoes.empresa
                          ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 shadow-xs ring-1 ring-rose-400/30'
                          : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.empresa ? 'bg-rose-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
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
                          id="toggle-empresa"
                          checked={Boolean(permissoes.empresa)}
                          onChange={(e) => atualizarPermissao('empresa', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.empresa ? 'bg-rose-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.empresa ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-100 dark:hover:bg-stone-800 font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95"
                >
                  {editingCargo ? 'Salvar Alterações' : 'Cadastrar Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
