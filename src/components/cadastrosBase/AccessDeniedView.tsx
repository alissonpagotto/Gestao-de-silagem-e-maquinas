import React from 'react';
import { 
  ShieldAlert, 
  ArrowLeft, 
  UserCheck, 
  Lock, 
  CheckCircle2, 
  XCircle,
  RotateCcw
} from 'lucide-react';
import { 
  getActiveUserSession, 
  setActiveUserSession, 
  DEFAULT_ACTIVE_SESSION 
} from '../../lib/cadastrosBaseStorage';

interface AccessDeniedViewProps {
  moduleName?: string;
  onNavigateHome?: () => void;
  onOpenSessionModal?: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  moduleName = 'este módulo',
  onNavigateHome,
  onOpenSessionModal,
}) => {
  const session = getActiveUserSession();

  const handleRestoreAdmin = () => {
    setActiveUserSession(DEFAULT_ACTIVE_SESSION);
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white dark:bg-stone-900 border border-rose-200 dark:border-rose-950/70 rounded-3xl max-w-xl w-full p-7 sm:p-9 shadow-xl text-center space-y-6">
        
        {/* Ícone de Escudo e Bloqueio */}
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 mx-auto shadow-sm">
          <ShieldAlert className="w-10 h-10 stroke-[2.2]" />
          <div className="absolute -bottom-1.5 -right-1.5 bg-rose-600 text-white p-1 rounded-full shadow">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Títulos e Mensagem */}
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            CONTROLE DE ACESSO & PERMISSÕES
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
            Acesso Restrito
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
            Seu cargo/perfil atual não possui autorização para acessar o módulo <strong className="text-zinc-900 dark:text-white">"{moduleName}"</strong>. Os dados confidenciais deste setor foram protegidos de acordo com a política de governança da empresa.
          </p>
        </div>

        {/* Caixa com detalhes da Sessão Ativa */}
        <div className="bg-zinc-50 dark:bg-stone-800/60 p-4 rounded-2xl border border-zinc-200 dark:border-stone-800 text-left space-y-2.5">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-200 dark:border-stone-700">
            <div className="flex items-center space-x-2 text-zinc-500 dark:text-stone-400 font-bold">
              <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Sessão / Perfil Ativo:</span>
            </div>
            <span className="font-extrabold text-zinc-900 dark:text-white">
              {session.cargoNome}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-stone-400">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">Usuário</span>
              <strong className="text-zinc-800 dark:text-stone-200">{session.name}</strong>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">Setor</span>
              <strong className="text-zinc-800 dark:text-stone-200">{session.setor || 'Operações'}</strong>
            </div>
          </div>

          {/* Resumo de Permissões */}
          <div className="pt-2 border-t border-zinc-200 dark:border-stone-700">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1.5">
              Grade de Acessos Deste Cargo:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(session.permissions || {}).map(([key, val]) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    val
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 opacity-75'
                  }`}
                >
                  {val ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span className="capitalize">{key}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl border border-zinc-300 dark:border-stone-700 text-xs sm:text-sm font-bold text-zinc-700 dark:text-stone-200 hover:bg-zinc-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Dashboard</span>
            </button>
          )}

          {session.type !== 'admin' && (
            <button
              type="button"
              onClick={handleRestoreAdmin}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restaurar Perfil Administrador</span>
            </button>
          )}

          {onOpenSessionModal && (
            <button
              type="button"
              onClick={onOpenSessionModal}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white text-xs sm:text-sm font-bold transition cursor-pointer"
            >
              <span>Alternar Simulação</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
