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
import { CargoPermissao, Employee, SimulatedUserSession } from '../../types';
import { 
  getActiveUserSession, 
  setActiveUserSession, 
  getStoredCargosPermissoes, 
  DEFAULT_ADMIN_PERMISSIONS 
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
  const [activeTab, setActiveTab] = useState<'cargos' | 'colaboradores'>('cargos');

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
    const session: SimulatedUserSession = {
      type: cargo.nome.toLowerCase().includes('admin') ? 'admin' : 'employee',
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
    const matchedCargo = cargos.find(c => 
      c.id === emp.cargoId || 
      c.nome.trim().toLowerCase() === (emp.role || '').trim().toLowerCase()
    );

    const permissions = matchedCargo?.permissoes || emp.permissions || emp.permissoes || {
      financeiro: false,
      frotas: true,
      rh: false,
      estoque: false,
      empresa: false,
    };

    const isAdm = (emp.role || '').toLowerCase().includes('admin');

    const session: SimulatedUserSession = {
      type: isAdm ? 'admin' : 'employee',
      employeeId: emp.id,
      cargoId: matchedCargo?.id,
      name: emp.name,
      cargoNome: emp.role || matchedCargo?.nome || 'Colaborador',
      setor: matchedCargo?.setor || 'Operações',
      permissions,
    };

    setActiveUserSession(session);
    setCurrentSession(session);
    onSessionChanged?.(session);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-stone-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <UserCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Simular Nível de Acesso (Sessão Ativa)
              </h3>
              <p className="text-xs text-zinc-500 dark:text-stone-400">
                Selecione um cargo ou colaborador para testar o bloqueio visual e a restrição de menus da sidebar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Perfil Atual */}
        <div className="my-4 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              {currentSession.type === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Perfil Atual na Sessão
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-white">
                {currentSession.name} ({currentSession.cargoNome})
              </div>
            </div>
          </div>

          {currentSession.type !== 'admin' && (
            <button
              type="button"
              onClick={handleSelectAdmin}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
            >
              Voltar p/ Admin
            </button>
          )}
        </div>

        {/* Tabs de Seleção */}
        <div className="flex space-x-2 border-b border-zinc-200 dark:border-stone-800 pb-2 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab('cargos')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'cargos'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'text-zinc-600 dark:text-stone-400 hover:text-zinc-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Por Cargo ({cargos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('colaboradores')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'colaboradores'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'text-zinc-600 dark:text-stone-400 hover:text-zinc-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Por Colaborador Cadastrado ({employees.length})</span>
          </button>
        </div>

        {/* Lista de Opções */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
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
              {cargos.filter(c => !c.nome.toLowerCase().includes('admin')).map(cargo => {
                const isSelected = currentSession.cargoId === cargo.id;
                return (
                  <div
                    key={cargo.id}
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
                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-stone-800/80 border-zinc-200 dark:border-stone-700 hover:border-indigo-400'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase">
                          {emp.name}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-stone-400">
                          Cargo: <strong className="text-zinc-700 dark:text-stone-300">{emp.role || 'Sem cargo'}</strong>
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="pt-4 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-xs font-bold text-zinc-800 dark:text-stone-200 cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
