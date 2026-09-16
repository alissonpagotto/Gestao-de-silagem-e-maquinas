import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  RotateCcw, 
  Building, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { DEFAULT_VEHICLE_OWNERSHIP_REGIMES } from '../../lib/storage';

interface VehicleOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  regimes: string[];
  onSaveRegimes: (regimes: string[]) => void;
  onSelectRegime?: (regime: string) => void;
}

export const VehicleOwnershipModal: React.FC<VehicleOwnershipModalProps> = ({
  isOpen,
  onClose,
  regimes,
  onSaveRegimes,
  onSelectRegime,
}) => {
  const [newRegimeName, setNewRegimeName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAddRegime = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newRegimeName.trim();
    if (!trimmed) {
      setErrorMsg('Informe o nome do regime de propriedade para incluir.');
      return;
    }

    if (regimes.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Este regime já existe na lista.');
      return;
    }

    const updated = [...regimes, trimmed];
    onSaveRegimes(updated);
    setNewRegimeName('');
    setErrorMsg('');
    setSuccessMsg(`Regime "${trimmed}" adicionado com sucesso!`);
    setTimeout(() => setSuccessMsg(''), 2500);

    if (onSelectRegime) {
      onSelectRegime(trimmed);
    }
  };

  const handleDeleteRegime = (regimeToDelete: string) => {
    if (regimes.length <= 1) {
      setErrorMsg('A lista precisa ter pelo menos uma opção de regime.');
      return;
    }
    const updated = regimes.filter(r => r !== regimeToDelete);
    onSaveRegimes(updated);
    setErrorMsg('');
  };

  const handleStartEdit = (index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingName(currentName);
    setErrorMsg('');
  };

  const handleSaveEdit = (index: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setErrorMsg('O nome do regime não pode ficar vazio.');
      return;
    }
    if (regimes.some((r, i) => i !== index && r.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Já existe outro regime com este nome.');
      return;
    }

    const updated = [...regimes];
    const oldName = updated[index];
    updated[index] = trimmed;
    onSaveRegimes(updated);
    setEditingIndex(null);
    setEditingName('');
    setErrorMsg('');

    if (onSelectRegime && oldName) {
      onSelectRegime(trimmed);
    }
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Deseja restaurar as opções padrão de regime? Suas opções personalizadas serão reiniciadas.')) {
      onSaveRegimes(DEFAULT_VEHICLE_OWNERSHIP_REGIMES);
      setErrorMsg('');
      setSuccessMsg('Regimes padrão restaurados com sucesso!');
      setTimeout(() => setSuccessMsg(''), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-800/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Editar Lista de Regimes de Posse / Propriedade
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Inclua ou exclua regimes do veículo (ex: Próprio, Alugado, Comodato, etc.)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-700/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center space-x-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form: Incluir Novo Regime */}
          <form onSubmit={handleAddRegime} className="p-3.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2.5">
            <label className="block text-xs font-bold text-stone-800 dark:text-stone-200">
              Incluir Novo Regime de Posse / Propriedade:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRegimeName}
                onChange={(e) => {
                  setNewRegimeName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Ex: Comodato, Leasing, Demonstração, Cessão..."
                className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Incluir</span>
              </button>
            </div>
          </form>

          {/* List of Existing Regimes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 px-1">
              <span>Opções Existentes ({regimes.length})</span>
              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="text-[11px] text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 flex items-center space-x-1 font-semibold hover:underline cursor-pointer"
                title="Voltar para os regimes padrão"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar Padrões</span>
              </button>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-white dark:bg-stone-800/40">
              {regimes.map((reg, idx) => {
                const isEditing = editingIndex === idx;

                return (
                  <div
                    key={`${reg}-${idx}`}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50/80 dark:hover:bg-stone-800/80 transition"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(idx);
                            if (e.key === 'Escape') setEditingIndex(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(idx)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                          title="Salvar alteração"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="p-1.5 bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-lg cursor-pointer"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                          <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 truncate">
                            {reg}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          {onSelectRegime && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectRegime(reg);
                                onClose();
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-md transition cursor-pointer"
                              title="Selecionar este regime no formulário"
                            >
                              Selecionar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx, reg)}
                            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition cursor-pointer"
                            title="Editar nome deste regime"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRegime(reg)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title="Excluir este regime da lista"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 flex justify-end bg-stone-50 dark:bg-stone-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-800 hover:bg-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Concluir & Voltar
          </button>
        </div>

      </div>
    </div>
  );
};
