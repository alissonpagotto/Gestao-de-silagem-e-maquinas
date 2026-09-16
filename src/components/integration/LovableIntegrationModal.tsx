import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  ExternalLink, 
  ArrowRight
} from 'lucide-react';
import { exportFullBackup, importFullBackup } from '../../lib/storage';

interface LovableIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataImported: () => void;
}

export const LovableIntegrationModal: React.FC<LovableIntegrationModalProps> = ({
  isOpen,
  onClose,
  onDataImported,
}) => {
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleDownloadBackup = () => {
    const jsonStr = exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silagem_facil_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    if (!rawJsonInput.trim()) return;
    const res = importFullBackup(rawJsonInput);
    setImportStatus(res);
    if (res.success) {
      onDataImported();
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawJsonInput(text);
      };
      reader.readAsText(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Standardized Solid Teal Bar */}
        <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Integração & Migração Lovable (Silagem Fácil)
            </h3>
            <p className="text-xs text-white/80">
              Como trazer seus dados e componentes do Lovable para cá
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Lovable Connected URL Callout */}
          <div className="p-3.5 bg-teal-50/60 dark:bg-teal-950/20 rounded-xl border border-teal-200 dark:border-teal-800/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-teal-900 dark:text-teal-300 uppercase tracking-wider block">
                PROJETO DE ORIGEM VINCULADO
              </span>
              <a
                href="https://silagemfacil.lovable.app"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#009688] dark:text-teal-400 hover:underline flex items-center gap-1.5 mt-0.5"
              >
                https://silagemfacil.lovable.app
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <span className="text-[10px] bg-[#009688] text-white px-2.5 py-1 rounded-full font-bold">
              Compatível
            </span>
          </div>

          {/* Guide Steps */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
              COMO MIGRAR OU CONECTAR DADOS DO LOVABLE:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-1.5">
                <div className="flex items-center space-x-2 font-bold text-stone-900 dark:text-stone-100">
                  <span className="w-5 h-5 rounded-full bg-[#009688] text-white flex items-center justify-center text-[10px]">1</span>
                  <span>Exportar Dados / JSON</span>
                </div>
                <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">
                  No seu projeto do Lovable / Supabase, exporte suas tabelas em JSON ou CSV.
                </p>
              </div>

              <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/60 space-y-1.5">
                <div className="flex items-center space-x-2 font-bold text-stone-900 dark:text-stone-100">
                  <span className="w-5 h-5 rounded-full bg-[#009688] text-white flex items-center justify-center text-[10px]">2</span>
                  <span>Colar ou Fazer Upload</span>
                </div>
                <p className="text-stone-600 dark:text-stone-400 text-[11px] leading-relaxed">
                  Cole o conteúdo no campo abaixo ou faça upload do arquivo `.json` para carregar imediatamente.
                </p>
              </div>
            </div>
          </div>

          {/* Import Area */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                COLAR JSON DE DADOS OU BACKUP:
              </label>
              <label className="cursor-pointer text-xs text-[#009688] hover:text-[#00796b] font-bold flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>Carregar Arquivo .json</span>
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <textarea
              rows={3}
              value={rawJsonInput}
              onChange={(e) => setRawJsonInput(e.target.value)}
              placeholder='Cole aqui seu JSON de dados (ex: {"expenses": [...], "clients": [...]})'
              className="w-full p-3 font-mono text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-[#009688] focus:outline-none"
            />

            {importStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  importStatus.success
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                {importStatus.message}
              </div>
            )}
          </div>

        </div>

        {/* Footer - Standardized */}
        <div className="px-5 py-3 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Baixar Backup Completo</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleImportJson}
              disabled={!rawJsonInput.trim()}
              className="inline-flex items-center space-x-1.5 px-6 py-2 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <span>Importar Dados</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
