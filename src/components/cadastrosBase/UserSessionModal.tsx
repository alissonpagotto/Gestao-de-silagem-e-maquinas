import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  ShieldCheck, 
  Users, 
  X, 
  CheckCircle2, 
  Lock,
  Briefcase
} from 'lucide-react';
import { CargoPermissao, Employee, SimulatedUserSession, RolePermissions } from '../../types';
import { 
  getActiveUserSession, 
  setActiveUserSession, 
  getStoredCargosPermissoes, 
  DEFAULT_ADMIN_PERMISSIONS,
  isDefaultContadorRole
} from '../../lib/cadastrosBaseStorage';
import { getStoredEmployees } from '../../lib/storage';

interface UserSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionChanged?: (session: SimulatedUserSession) => void;
}

export const UserSessionModal: React.FC<UserSessionModalProps> = ({
  isOpen,
  onClose,
  onSessionChanged,
}) => {
  const [currentSession, setCurrentSession] = useState<SimulatedUserSession>(() => getActiveUserSession());
  const [cargos, setCargos] = useState<CargoPermissao[]>(() => getStoredCargosPermissoes());
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [activeTab, setActiveTab] = useState<'colaboradores' | 'cargos'>('colaboradores');

  useEffect(() => {
    if (isOpen) {
      setCurrentSession(getActiveUserSession());
      setCargos(getStoredCargosPermissoes());
      setEmployees(getStoredEmployees());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAdmin = () => {
    const adminSession: SimulatedUserSession = {
      type: 'admin',
      name: 'Administrador do Sistema',
      cargoNome: 'Administrador Geral',
      setor: 'Diretoria',
      permissions: { ...DEFAULT_ADMIN_PERMISSIONS },
    };
    setActiveUserSession(adminSession);
    setCurrentSession(adminSession);
    onSessionChanged?.(adminSession);
    onClose();
  };

  const handleSelectCargo = (cargo: CargoPermissao) => {
    const isAdm = cargo.nome.toLowerCase().includes('admin');
    const session: SimulatedUserSession = {
      type: isAdm ? 'admin' : 'employee',
      cargoId: cargo.id,
      name: `Usuário (${cargo.nome})`,
      cargoNome: cargo.nome,
      setor: cargo.setor,
      permissions: { ...cargo.permissoes },
    };
    setActiveUserSession(session);
    setCurrentSession(session);
    onSessionChanged?.(session);
    onClose();
  };

  const handleSelectEmployee = (emp: Employee) => {
    const cleanRole = (emp.role || '').trim().toLowerCase();
    const primaryRole = cleanRole.split(',')[0].trim();

    const matchedCargo = cargos.find(c => 
      c.id === emp.cargoId || 
      c.nome.trim().toLowerCase() === cleanRole ||
      c.nome.trim().toLowerCase() === primaryRole ||
      cleanRole.includes(c.nome.trim().toLowerCase())
    );

    const isAdm = cleanRole.includes('admin') || cleanRole.includes('diretor') || (matchedCargo?.nome || '').toLowerCase().includes('admin');

    const permissions: RolePermissions = isAdm
      ? { ...DEFAULT_ADMIN_PERMISSIONS }
      : (matchedCargo?.permissoes || emp.permissoes || emp.permissions || {
          financeiro: false,
          frotas: true,
          rh: false,
          estoque: false,
          empresa: false,
          servicos: true,
        });

    const session: SimulatedUserSession = {
      type: isAdm ? 'admin' : 'employee',
      employeeId: emp.id,
      cargoId: matchedCargo?.id || emp.cargoId,
      name: emp.name,
      cargoNome: matchedCargo?.nome || emp.role || 'Colaborador',
      photoUrl: emp.photoUrl || (emp as any).foto_url,
      setor: matchedCargo?.setor || emp.cargo_setor || 'Operações',
      permissions,
    };

    setActiveUserSession(session);
    setCurrentSession(session);
    onSessionChanged?.(session);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60" style={{ backgroundColor: 'rgba(0, 0, 0, 0.60)' }}>
      <div className="bg-[#cad4e6] border border-black rounded-xl w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#cad4e6] border-b border-black flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white text-black border border-black">
              <UserCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-black tracking-tight">
                Simular Nível de Acesso (Sessão Ativa)
              </h3>
              <p className="text-xs text-slate-800 font-medium">
                Selecione um cargo ou colaborador para testar o bloqueio visual e a restrição de menus da sidebar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-black hover:bg-white/60 border border-transparent hover:border-black p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Principal */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#cad4e6]">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Perfil Atual */}
            <div className="p-3.5 rounded-xl bg-[#e0e6f1] border border-black flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-emerald-600 border border-emerald-800 text-white shadow-xs">
                  {currentSession.type === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Perfil Atual na Sessão
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-black">
                    {currentSession.name} ({currentSession.cargoNome})
                  </div>
                </div>
              </div>

              {currentSession.type !== 'admin' && (
                <button
                  type="button"
                  onClick={handleSelectAdmin}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 shadow-xs transition cursor-pointer"
                >
                  Voltar p/ Admin
                </button>
              )}
            </div>

            {/* Container de Tabs + Lista */}
            <div className="bg-[#e0e6f1] border border-black rounded-xl p-4 space-y-3">
              {/* Tabs de Seleção */}
              <div className="flex space-x-2 border-b border-black pb-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('cargos')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    activeTab === 'cargos'
                      ? 'bg-emerald-600 text-white border-emerald-800'
                      : 'bg-white text-black border-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Por Cargo ({cargos.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('colaboradores')}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    activeTab === 'colaboradores'
                      ? 'bg-emerald-600 text-white border-emerald-800'
                      : 'bg-white text-black border-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Por Colaborador Cadastrado ({employees.length})</span>
                </button>
              </div>

              {/* Lista de Opções */}
              <div className="space-y-2">
          {activeTab === 'cargos' && (
            <>
              {/* Botão Admin Especial */}
              <div
                onClick={handleSelectAdmin}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                  currentSession.type === 'admin'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                    : 'bg-white dark:bg-stone-800/80 border-zinc-200 dark:border-stone-700 hover:border-indigo-400'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-600 text-white">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-zinc-900 dark:text-white">
                      Administrador Geral
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-stone-400">
                      Acesso liberado a 100% dos módulos (Financeiro, Frotas, RH, Estoque e Empresa)
                    </div>
                  </div>
                </div>
                {currentSession.type === 'admin' && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </div>

              {/* Lista de Cargos */}
              {cargos.filter(c => !c.nome.toLowerCase().includes('admin')).map((cargo, index) => {
                const isSelected = currentSession.cargoId === cargo.id;
                return (
                  <div
                    key={`${cargo.id}-${index}`}
                    onClick={() => handleSelectCargo(cargo)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                        : 'bg-white dark:bg-stone-800/80 border-zinc-200 dark:border-stone-700 hover:border-indigo-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                          {cargo.nome}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-stone-700 text-zinc-600 dark:text-stone-300">
                          {cargo.setor}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1 text-[10px] text-zinc-500 dark:text-stone-400">
                        <span>Permissões:</span>
                        <span className={cargo.permissoes?.financeiro ? 'text-emerald-600 font-bold' : 'line-through text-zinc-400'}>Financeiro</span>
                        <span>•</span>
                        <span className={cargo.permissoes?.frotas ? 'text-blue-600 font-bold' : 'line-through text-zinc-400'}>Frotas</span>
                        <span>•</span>
                        <span className={cargo.permissoes?.rh ? 'text-purple-600 font-bold' : 'line-through text-zinc-400'}>RH</span>
                        <span>•</span>
                        <span className={cargo.permissoes?.estoque ? 'text-amber-600 font-bold' : 'line-through text-zinc-400'}>Estoque</span>
                        <span>•</span>
                        <span className={(typeof cargo.permissoes?.contador === 'boolean' ? cargo.permissoes.contador : isDefaultContadorRole(cargo.nome, cargo.setor)) ? 'text-indigo-600 font-bold' : 'line-through text-zinc-400'}>Contador</span>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>
                );
              })}
            </>
          )}

          {activeTab === 'colaboradores' && (
            <>
              {employees.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  Nenhum colaborador encontrado no cadastro.
                </div>
              ) : (
                employees.map(emp => {
                  const isSelected = currentSession.employeeId === emp.id;
                  const cleanRole = (emp.role || '').trim().toLowerCase();
                  const primaryRole = cleanRole.split(',')[0].trim();
                  const matchedCargo = cargos.find(c => 
                    c.id === emp.cargoId || 
                    c.nome.trim().toLowerCase() === cleanRole ||
                    c.nome.trim().toLowerCase() === primaryRole ||
                    cleanRole.includes(c.nome.trim().toLowerCase())
                  );
                  const perms = matchedCargo?.permissoes || emp.permissoes || emp.permissions || {
                    financeiro: false,
                    frotas: true,
                    rh: false,
                    estoque: false,
                    empresa: false,
                  };

                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-stone-800/80 border-zinc-200 dark:border-stone-700 hover:border-indigo-400'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {/* Avatar do Colaborador */}
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-zinc-200 dark:border-stone-700 bg-zinc-100 dark:bg-stone-700 flex items-center justify-center">
                          {emp.photoUrl ? (
                            <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-zinc-700 dark:text-stone-300">
                              {emp.name.charAt(0)}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase truncate">
                            {emp.name}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-stone-400 truncate">
                            Cargo: <strong className="text-zinc-700 dark:text-stone-300">{emp.role || matchedCargo?.nome || 'Colaborador'}</strong>
                            {matchedCargo?.setor && <span className="ml-1 text-zinc-400">({matchedCargo.setor})</span>}
                          </div>
                          <div className="flex items-center space-x-1.5 mt-1 text-[10px]">
                            <span className={perms.financeiro ? 'text-emerald-600 font-bold' : 'line-through text-zinc-400'}>Financeiro</span>
                            <span className="text-zinc-300">•</span>
                            <span className={perms.frotas ? 'text-blue-600 font-bold' : 'line-through text-zinc-400'}>Frotas</span>
                            <span className="text-zinc-300">•</span>
                            <span className={perms.rh ? 'text-purple-600 font-bold' : 'line-through text-zinc-400'}>RH</span>
                            <span className="text-zinc-300">•</span>
                            <span className={perms.estoque ? 'text-amber-600 font-bold' : 'line-through text-zinc-400'}>Estoque</span>
                            <span className="text-zinc-300">•</span>
                            <span className={(typeof perms.contador === 'boolean' ? perms.contador : isDefaultContadorRole(emp.role || matchedCargo?.nome, matchedCargo?.setor)) ? 'text-indigo-600 font-bold' : 'line-through text-zinc-400'}>Contador</span>
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 bg-[#cad4e6] border-t border-black flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-gray-100 border border-black text-xs font-bold text-black cursor-pointer transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
