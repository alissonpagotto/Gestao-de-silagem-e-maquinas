import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, Save, Key, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Subscriber } from '../../types/masterAdmin';
import { updateCloudSubscriberPassword } from '../../lib/supabaseService';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  onSuccessToast: (message: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  onSuccessToast,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !subscriber) return null;

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let pass = 'Agro#';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassword(true);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      setErrorMsg('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const result = await updateCloudSubscriberPassword(subscriber.id, newPassword.trim());
      if (result.success) {
        onSuccessToast(`Senha do assinante "${subscriber.name}" redefinida com sucesso!`);
        setNewPassword('');
        setShowPassword(false);
        onClose();
      } else {
        setErrorMsg(result.message || 'Falha ao redefinir senha no Supabase.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro de conexão com o banco Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#1a1d24] rounded-2xl max-w-md w-full shadow-2xl border border-[#2f3644] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho */}
        <div className="px-5 py-4 bg-[#14161d] text-white flex items-center justify-between border-b border-[#2f3644]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#252a34] border border-[#2f3644] rounded-xl">
              <Lock className="w-5 h-5 text-[#8a92a6]" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">Redefinir Senha do Assinante</h3>
              <p className="text-xs text-[#8a92a6]">Atualização direta na nuvem do Supabase</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8a92a6] hover:text-white hover:bg-[#252a34] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-[#252a34] border border-[#2f3644] rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-[#8a92a6] block uppercase tracking-wider">
              Assinante Selecionado
            </span>
            <p className="text-sm font-black text-white">
              {subscriber.name}
            </p>
            <p className="text-xs text-[#8a92a6] font-mono">
              {subscriber.responsibleEmail} (ID: {subscriber.id.substring(0, 13)}...)
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-[#252a34] border border-rose-800/80 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-[#252a34] p-3.5 rounded-xl border border-[#2f3644]">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#8a92a6] uppercase tracking-wider">
                NOVA SENHA DO CLIENTE *
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-xs font-bold text-[#d1d5db] hover:text-white hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#8a92a6]" />
                <span>Gerar Senha Segura</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite ou gere a nova senha"
                className="w-full pl-3 pr-10 py-2.5 bg-[#1a1d24] border border-[#2f3644] rounded-xl text-sm font-mono text-white focus:border-[#4d576a] focus:ring-1 focus:ring-[#4d576a] outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-[#8a92a6] hover:text-white absolute right-2.5 top-2.5 cursor-pointer"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#8a92a6] mt-1">
              Esta senha permitirá que o produtor acesse o ERP com o email cadastrado.
            </p>
          </div>

          <div className="pt-3 border-t border-[#2f3644] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-[#d1d5db] bg-[#1a1d24] hover:bg-[#252a34] border border-[#2f3644] rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#3a4150] hover:bg-[#475062] active:bg-[#2d3340] disabled:opacity-50 text-white rounded-lg text-xs font-bold border border-[#4d576a] flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Nova Senha'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
