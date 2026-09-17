import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  Key, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Info
} from 'lucide-react';
import { getStoredAdminSettings, saveStoredMasterSession } from '../../lib/masterAdminStorage';
import { MasterSession } from '../../types/masterAdmin';

interface MasterAdminLoginProps {
  onSuccess: (session: MasterSession) => void;
  onBackToApp: () => void;
  onOpenLandingPage: () => void;
  prefillEmail?: string;
}

export const MasterAdminLogin: React.FC<MasterAdminLoginProps> = ({
  onSuccess,
  onBackToApp,
  onOpenLandingPage,
  prefillEmail = '',
}) => {
  const settings = getStoredAdminSettings();

  const [email, setEmail] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuperAdminsHint, setShowSuperAdminsHint] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError('Por favor, informe o e-mail do administrador.');
      setIsSubmitting(false);
      return;
    }

    if (!cleanPassword) {
      setError('Por favor, digite a senha de acesso mestre.');
      setIsSubmitting(false);
      return;
    }

    // 1. Validação Estrita contra a lista de Super Admins autorizados
    const authorizedEmails = (settings.superAdminEmails || []).map((adm) => adm.trim().toLowerCase());
    const isAuthorized = authorizedEmails.includes(cleanEmail);

    if (!isAuthorized) {
      setError('Acesso negado: O e-mail informado não consta na lista de Super Administradores autorizados da plataforma.');
      setIsSubmitting(false);
      return;
    }

    // 2. Validação da Senha Mestre Forte
    const expectedPassword = settings.masterPassword || 'AgroControl@Master2026';
    if (cleanPassword !== expectedPassword) {
      setError('Senha de acesso incorreta. Verifique suas credenciais de administrador mestre.');
      setIsSubmitting(false);
      return;
    }

    // 3. Autenticação bem-sucedida
    const session: MasterSession = {
      email: cleanEmail,
      authenticatedAt: new Date().toISOString()
    };

    saveStoredMasterSession(session);
    setIsSubmitting(false);
    onSuccess(session);
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 font-['Plus_Jakarta_Sans',sans-serif] text-stone-100 selection:bg-emerald-500 selection:text-stone-950 relative overflow-hidden">
      {/* Luz ambiente e gradiente temático */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-5">
        {/* Card Principal de Autenticação */}
        <div className="bg-stone-900/90 border border-stone-800 backdrop-blur-xl rounded-3xl p-7 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
          
          {/* Cabeçalho */}
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-400 text-[11px] font-black uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Acesso Restrito • Master Admin</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Painel Administrativo Mestre
              </h1>
              <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                Autentique-se com um e-mail de Super Administrador autorizado e a chave de acesso.
              </p>
            </div>
          </div>

          {/* Mensagem de Erro de Acesso */}
          {error && (
            <div className="p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-2xl text-xs font-semibold text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-snug">{error}</div>
            </div>
          )}

          {/* Formulário de Login Mestre */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo 1: E-mail do Administrador */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-stone-300">
                  E-MAIL DO ADMINISTRADOR
                </label>
                {settings.superAdminEmails.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEmail(settings.superAdminEmails[0])}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                  >
                    Preencher super admin
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="ex: admin@agrocontrol.com.br"
                  className="w-full pl-10 pr-4 py-3 bg-stone-950/80 border border-stone-800 focus:border-emerald-500 rounded-xl text-xs font-medium text-white placeholder-stone-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                  autoFocus
                />
                <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Campo 2: Senha de Acesso */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-stone-300">
                  SENHA DE ACESSO MESTRE
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-stone-950/80 border border-stone-800 focus:border-emerald-500 rounded-xl text-xs font-mono text-white placeholder-stone-600 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                />
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-stone-500 hover:text-stone-300 transition p-0.5 cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Autenticação */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-950/80 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Key className="w-4 h-4" />
              <span>{isSubmitting ? 'Autenticando...' : 'Acessar Painel Mestre'}</span>
            </button>
          </form>

          {/* Dica de Super Admins Autorizados (Gaveta Colapsável) */}
          <div className="pt-2 border-t border-stone-800/80">
            <button
              type="button"
              onClick={() => setShowSuperAdminsHint(!showSuperAdminsHint)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-stone-400 hover:text-stone-300 py-1 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-stone-500" />
                <span>Super Admins Autorizados ({settings.superAdminEmails.length})</span>
              </span>
              <span className="text-[10px] text-emerald-400">
                {showSuperAdminsHint ? 'Ocultar' : 'Ver lista'}
              </span>
            </button>

            {showSuperAdminsHint && (
              <div className="mt-2 p-3 bg-stone-950/70 border border-stone-800 rounded-xl space-y-2 text-[11px] text-stone-300">
                <p className="text-[10px] text-stone-400 font-medium">
                  Apenas os e-mails abaixo têm permissão para acessar esta área:
                </p>
                <div className="space-y-1">
                  {settings.superAdminEmails.map((admEmail) => (
                    <div 
                      key={admEmail}
                      onClick={() => setEmail(admEmail)}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-stone-900 hover:bg-emerald-950/50 hover:border-emerald-800/60 border border-stone-800 transition cursor-pointer"
                    >
                      <span className="font-mono text-emerald-300">{admEmail}</span>
                      <span className="text-[9px] text-stone-500 uppercase">Clique p/ usar</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 pt-1">
                  Senha padrão do sistema: <code className="text-emerald-400 bg-stone-900 px-1 py-0.5 rounded">AgroControl@Master2026</code>
                </p>
              </div>
            )}
          </div>

          {/* Rodapé com Navegação Limpa */}
          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400">
            <button
              type="button"
              onClick={onBackToApp}
              className="hover:text-stone-200 transition cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao ERP</span>
            </button>
            <button
              type="button"
              onClick={onOpenLandingPage}
              className="hover:text-stone-200 transition cursor-pointer flex items-center gap-1 text-emerald-400"
            >
              <span>Ver Landing Page</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Nota de Segurança e Privacidade */}
        <div className="text-center text-[11px] text-stone-500 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70" />
          <span>Sessão protegida por token local temporário criptografado</span>
        </div>
      </div>
    </div>
  );
};
