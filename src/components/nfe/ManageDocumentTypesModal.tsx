import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  Lock, 
  FileText, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES } from '../../lib/storage';

interface ManageDocumentTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTypes: string[];
  onSaveDocumentTypes: (newTypes: string[]) => void;
  selectedType?: string;
  onSelectType?: (type: string) => void;
}

export const ManageDocumentTypesModal: React.FC<ManageDocumentTypesModalProps> = ({
  isOpen,
  onClose,
  documentTypes,
  onSaveDocumentTypes,
  selectedType,
  onSelectType,
}) => {
  const [newTypeName, setNewTypeName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const isDefaultType = (name: string): boolean => {
    return DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES.some(
      def => def.trim().toLowerCase() === name.trim().toLowerCase()
    );
  };

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const trimmed = newTypeName.trim();

    if (!trimmed) {
      setErrorMessage('Por favor, informe o nome do tipo de documento.');
      return;
    }

    if (trimmed.toLowerCase() === 'recibo') {
      setErrorMessage("A opção 'Recibo' foi descontinuada. Use 'Nota avulsa', 'Cupom sem valor fiscal' ou outro nome específico.");
      return;
    }

    if (documentTypes.some(t => t.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMessage(`O tipo "${trimmed}" já está cadastrado.`);
      return;
    }

    const updated = [...documentTypes, trimmed];
    onSaveDocumentTypes(updated);
    if (onSelectType) {
      onSelectType(trimmed);
    }
    setNewTypeName('');
  };

  const handleStartEdit = (index: number, currentVal: string) => {
    setErrorMessage('');
    setEditingIndex(index);
    setEditingValue(currentVal);
  };

  const handleSaveEdit = (index: number) => {
    setErrorMessage('');
    const trimmed = editingValue.trim();

    if (!trimmed) {
      setErrorMessage('O nome do tipo não pode ficar em branco.');
      return;
    }

    if (trimmed.toLowerCase() === 'recibo') {
      setErrorMessage("A opção 'Recibo' não é permitida.");
      return;
    }

    const isDuplicate = documentTypes.some(
      (t, idx) => idx !== index && t.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      setErrorMessage(`Já existe outro tipo com o nome "${trimmed}".`);
      return;
    }

    const oldName = documentTypes[index];
    const updated = [...documentTypes];
    updated[index] = trimmed;
    onSaveDocumentTypes(updated);

    if (selectedType === oldName && onSelectType) {
      onSelectType(trimmed);
    }

    setEditingIndex(null);
    setEditingValue('');
  };

  const handleDeleteType = (index: number, typeName: string) => {
    setErrorMessage('');
    if (isDefaultType(typeName)) {
      setErrorMessage(`O tipo "${typeName}" é padrão do sistema e não pode ser excluído.`);
      return;
    }

    const updated = documentTypes.filter((_, idx) => idx !== index);
    onSaveDocumentTypes(updated);

    if (selectedType === typeName && onSelectType) {
      onSelectType(updated[0] || 'Romaneio');
    }

    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Deseja restaurar a lista com as opções padrão do sistema? (Tipos personalizados serão mantidos)')) {
      const merged = [...DEFAULT_MANUAL_ENTRY_DOCUMENT_TYPES];
      documentTypes.forEach(t => {
        if (!isDefaultType(t) && !merged.includes(t)) {
          merged.push(t);
        }
      });
      onSaveDocumentTypes(merged);
    }
  };

  return (
    <div 
      id="modal-gerenciar-tipos-documento"
      className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-stone-900 dark:text-stone-100 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/90 dark:bg-stone-800/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white tracking-tight font-['Outfit']">
                Gerenciar Tipos de Documento
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Cadastre, edite ou remova tipos de documentos de entrada manual
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-700/60 transition cursor-pointer"
            title="Fechar gerenciador"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro/Aviso se houver */}
        {errorMessage && (
          <div className="mx-4 mt-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <span>{errorMessage}</span>
            <button 
              type="button"
              onClick={() => setErrorMessage('')}
              className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Corpo do Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* 1. Formulário para Cadastrar Novo Tipo */}
          <form 
            onSubmit={handleAddType}
            className="p-3.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 space-y-2"
          >
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              Cadastrar Novo Tipo Personalizado
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTypeName}
                onChange={(e) => {
                  setNewTypeName(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Ex: Recibo de Balança, Ticket de Pesagem..."
                className="flex-1 px-3.5 py-2 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-2xs"
              />
              <button
                type="submit"
                disabled={!newTypeName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Adicionar</span>
              </button>
            </div>
          </form>

          {/* 2. Lista de Tipos Cadastrados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                Tipos Disponíveis ({documentTypes.length})
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition cursor-pointer"
                title="Garante que as opções padrão do sistema estejam na lista"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar Padrões</span>
              </button>
            </div>

            <div className="border border-stone-200 dark:border-stone-800 rounded-xl divide-y divide-stone-100 dark:divide-stone-800 bg-white dark:bg-stone-900 overflow-hidden shadow-2xs">
              {documentTypes.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-400 italic">
                  Nenhum tipo de documento cadastrado.
                </div>
              ) : (
                documentTypes.map((typeName, index) => {
                  const isDefault = isDefaultType(typeName);
                  const isEditing = editingIndex === index;
                  const isSelected = selectedType === typeName;

                  return (
                    <div 
                      key={`${typeName}-${index}`}
                      className={`p-2.5 sm:p-3 flex items-center justify-between transition gap-2 ${
                        isSelected 
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20' 
                          : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(index);
                              if (e.key === 'Escape') setEditingIndex(null);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-emerald-500 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(index)}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
                            title="Salvar alteração"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="p-1.5 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition cursor-pointer"
                            title="Cancelar edição"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                            <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                              {typeName}
                            </span>

                            {isDefault ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700 shrink-0">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Padrão</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Personalizado</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            {/* Botão Selecionar / Usar este tipo */}
                            {onSelectType && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectType(typeName);
                                  onClose();
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
                                }`}
                                title="Selecionar este tipo de documento"
                              >
                                {isSelected ? 'Selecionado' : 'Selecionar'}
                              </button>
                            )}

                            {/* Botão Editar Nome */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(index, typeName)}
                              className="p-1.5 text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
                              title="Editar nome do tipo"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Botão Excluir (apenas para tipos personalizados) */}
                            {isDefault ? (
                              <div 
                                className="p-1.5 text-stone-300 dark:text-stone-600 cursor-not-allowed"
                                title="Opções padrão do sistema não podem ser excluídas"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteType(index, typeName)}
                                className="p-1.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                title="Excluir tipo personalizado"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-800/60 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
