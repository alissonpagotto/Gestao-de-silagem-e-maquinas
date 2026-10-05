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
    const handleCargosSync = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setCargos(e.detail);
      } else {
        setCargos(getStoredCargosPermissoes());
      }
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
    const term = searchTerm.trim().toLowerCase();
    if (!term) return cargos;
    return cargos.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.setor.toLowerCase().includes(term) ||
      (c.descricao && c.descricao.toLowerCase().includes(term))
    );
  }, [cargos, searchTerm]);

  const handleOpenCreateModal = () => {
    setEditingCargo(null);
    setNome('');
    setSetor('Operações');
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

  const handleTogglePermission = (key: keyof RolePermissions) => {
    setPermissoes(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
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
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl divide-y divide-zinc-200 dark:divide-stone-800 shadow-xs overflow-hidden">
          {filteredCargos.map((cargo) => {
            const empCount = employeeCountByCargo[cargo.id] || 0;
            return (
              <div 
                key={cargo.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between px-3.5 py-1.5 sm:py-2 hover:bg-zinc-50/80 dark:hover:bg-stone-800/50 transition gap-2 sm:gap-3"
              >
                {/* Coluna 1: Nome do Cargo & Selo do Setor */}
                <div className="flex items-center space-x-2 min-w-[200px] sm:min-w-[240px] max-w-[290px] shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                    {cargo.nome}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-stone-800 text-zinc-600 dark:text-stone-300 border border-zinc-200 dark:border-stone-700 shrink-0">
                    {cargo.setor || 'Geral'}
                  </span>
                </div>

                {/* Coluna 2: Módulos Liberados (Badges coloridos e compactos) */}
                <div className="flex items-center space-x-1.5 flex-1 min-w-0 flex-wrap py-0.5">
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

                {/* Coluna 3: Contadores */}
                <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-stone-400 shrink-0">
                  <div className="flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-zinc-700 dark:text-stone-300 font-semibold">
                      ({empCount} colaboradores)
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono hidden lg:inline">
                    {cargo.id.slice(0, 10)}
                  </span>
                </div>

                {/* Coluna 4: Ações */}
                <div className="flex items-center space-x-1 shrink-0">
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
      ) : (
        /* Grid de Cards / Tabela de Cargos (Modo Grade) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCargos.map((cargo) => {
            const empCount = employeeCountByCargo[cargo.id] || 0;
            return (
              <div 
                key={cargo.id}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-3xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-stone-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <Shield className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                    {editingCargo ? `Editar Cargo: ${editingCargo.nome}` : 'Cadastrar Novo Cargo'}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-stone-400">
                    Defina os dados cadastrais no lado esquerdo e configure a grade de permissões no lado direito.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center space-x-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCargo} className="mt-5 space-y-6">
              {/* LAYOUT DIVIDIDO EM DUAS SEÇÕES: LADO ESQUERDO E LADO DIREITO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* LADO ESQUERDO: IDENTIFICAÇÃO DO CARGO */}
                <div className="bg-zinc-50 dark:bg-stone-800/50 p-5 rounded-2xl border border-zinc-200 dark:border-stone-800 space-y-4">
                  <div className="flex items-center space-x-2 pb-2 border-b border-zinc-200 dark:border-stone-700">
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
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
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
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['Operações', 'Transporte', 'Oficina', 'Financeiro', 'Recursos Humanos', 'Diretoria'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSetor(s)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-indigo-100 hover:text-indigo-800 dark:hover:bg-indigo-900/60 dark:hover:text-indigo-300 transition cursor-pointer"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                      Descrição básica do Cargo
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Resumo das atribuições, responsabilidades e escopo..."
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-300 flex items-start space-x-2">
                    <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <span>
                      Ao vincular este cargo a um colaborador, estas permissões serão anexadas à sua ficha cadastral no módulo RH.
                    </span>
                  </div>
                </div>

                {/* LADO DIREITO: GRADE DE PERMISSÕES DE ACESSO (TOGGLE SWITCHES) */}
                <div className="bg-zinc-50 dark:bg-stone-800/50 p-5 rounded-2xl border border-zinc-200 dark:border-stone-800 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-stone-700">
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

                  {/* Toggle 1: Financeiro */}
                  <div 
                    onClick={() => handleTogglePermission('financeiro')}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      permissoes.financeiro
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 shadow-2xs'
                        : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3 pr-2">
                      <div className={`p-2 rounded-lg shrink-0 ${permissoes.financeiro ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          Acesso ao Módulo Financeiro
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight mt-0.5">
                          Bancos, Saldos, DRE, Contas a Pagar e Receber
                        </div>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer shrink-0 ${permissoes.financeiro ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${permissoes.financeiro ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  {/* Toggle 2: Frotas & Veículos */}
                  <div 
                    onClick={() => handleTogglePermission('frotas')}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      permissoes.frotas
                        ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-2xs'
                        : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3 pr-2">
                      <div className={`p-2 rounded-lg shrink-0 ${permissoes.frotas ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          Acesso ao Módulo de Gestão de Frotas & Veículos
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight mt-0.5">
                          Veículos, Manutenções, Abastecimento, Rodízio de Pneus
                        </div>
                      </div>
                    </div>

                    <div className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer shrink-0 ${permissoes.frotas ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${permissoes.frotas ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  {/* Toggle 3: Recursos Humanos */}
                  <div 
                    onClick={() => handleTogglePermission('rh')}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      permissoes.rh
                        ? 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 shadow-2xs'
                        : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3 pr-2">
                      <div className={`p-2 rounded-lg shrink-0 ${permissoes.rh ? 'bg-purple-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
                        <HeartHandshake className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          Acesso ao Módulo de Recursos Humanos
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight mt-0.5">
                          Folhas de Pagamento, Férias, Faltas e Atestados
                        </div>
                      </div>
                    </div>

                    <div className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer shrink-0 ${permissoes.rh ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${permissoes.rh ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  {/* Toggle 4: Estoque / Almoxarifado / NF-e */}
                  <div 
                    onClick={() => handleTogglePermission('estoque')}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      permissoes.estoque
                        ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 shadow-2xs'
                        : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3 pr-2">
                      <div className={`p-2 rounded-lg shrink-0 ${permissoes.estoque ? 'bg-amber-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          Acesso ao Módulo de Estoque / Almoxarifado / Notas Fiscais
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight mt-0.5">
                          Produtos, Insumos, Almoxarifado e Lançamento de NF-e
                        </div>
                      </div>
                    </div>

                    <div className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer shrink-0 ${permissoes.estoque ? 'bg-amber-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${permissoes.estoque ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                  {/* Toggle 5: Dados da Empresa / Minha Empresa (Configurações cadastrais) */}
                  <div 
                    onClick={() => handleTogglePermission('empresa')}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      permissoes.empresa
                        ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700 shadow-2xs'
                        : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start space-x-3 pr-2">
                      <div className={`p-2 rounded-lg shrink-0 ${permissoes.empresa ? 'bg-rose-600 text-white' : 'bg-zinc-100 dark:bg-stone-800 text-zinc-500'}`}>
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          Acesso à tela "Dados da Empresa"
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-stone-400 leading-tight mt-0.5">
                          Configurações cadastrais, CNPJ, Logotipo e Razão Social
                        </div>
                      </div>
                    </div>

                    <div className={`w-11 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer shrink-0 ${permissoes.empresa ? 'bg-rose-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ${permissoes.empresa ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>

                </div>

              </div>

              {/* Botões do Rodapé */}
              <div className="pt-4 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-100 dark:hover:bg-stone-800 font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95"
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
