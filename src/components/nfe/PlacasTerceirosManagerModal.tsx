import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Edit3, Check, Search, Truck } from 'lucide-react';
import { Supplier } from '../../types';
import {
  ThirdPartyPlateEntry,
  getStoredPlacasTerceiros,
  saveStoredPlacasTerceiros,
  normalizePlateCode,
} from '../../lib/auxiliaryRegistries';
import { getStoredSuppliers } from '../../lib/storage';

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

export interface PlacasTerceirosManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers?: Supplier[];
  initialTransportadoraId?: string;
  initialTransportadoraNome?: string;
  onSelectPlate?: (entry: ThirdPartyPlateEntry) => void;
}

export const PlacasTerceirosManagerModal: React.FC<PlacasTerceirosManagerModalProps> = ({
  isOpen,
  onClose,
  suppliers: externalSuppliers,
  initialTransportadoraId = '',
  initialTransportadoraNome = '',
  onSelectPlate,
}) => {
  const [items, setItems] = useState<ThirdPartyPlateEntry[]>(() => getStoredPlacasTerceiros());
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formPlaca, setFormPlaca] = useState('');
  const [formUf, setFormUf] = useState('');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formTransportadoraNome, setFormTransportadoraNome] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formMotoristaNome, setFormMotoristaNome] = useState('');
  const [formMotoristaCpf, setFormMotoristaCpf] = useState('');
  const [formError, setFormError] = useState('');

  const availableSuppliers = useMemo(() => {
    const base = externalSuppliers && externalSuppliers.length > 0 ? externalSuppliers : getStoredSuppliers();
    return [...base].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }, [externalSuppliers, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setItems(getStoredPlacasTerceiros());
    setSearchTerm('');
    setEditingId(null);
    setFormPlaca('');
    setFormUf('');
    setFormSupplierId(initialTransportadoraId || '');
    setFormTransportadoraNome(initialTransportadoraNome || '');
    setFormModelo('');
    setFormMotoristaNome('');
    setFormMotoristaCpf('');
    setFormError('');
  }, [isOpen, initialTransportadoraId, initialTransportadoraNome]);

  if (!isOpen) return null;

  const filteredItems = items.filter((it) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      it.placa.toLowerCase().includes(q) ||
      (it.uf || '').toLowerCase().includes(q) ||
      (it.transportadoraNome || '').toLowerCase().includes(q) ||
      (it.modeloVeiculo || '').toLowerCase().includes(q) ||
      (it.motoristaNome || '').toLowerCase().includes(q)
    );
  });

  const resetForm = () => {
    setEditingId(null);
    setFormPlaca('');
    setFormUf('');
    setFormSupplierId(initialTransportadoraId || '');
    setFormTransportadoraNome(initialTransportadoraNome || '');
    setFormModelo('');
    setFormMotoristaNome('');
    setFormMotoristaCpf('');
    setFormError('');
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPlaca = normalizePlateCode(formPlaca);
    if (!cleanedPlaca || cleanedPlaca.length < 5) {
      setFormError('Informe uma placa válida (ex: ABC1D23).');
      return;
    }

    const dup = items.find(
      (p) => normalizePlateCode(p.placa) === cleanedPlaca && p.id !== editingId
    );
    if (dup) {
      setFormError(`A placa ${cleanedPlaca} já está cadastrada.`);
      return;
    }

    const matchedSup = availableSuppliers.find((s) => s.id === formSupplierId);
    const resolvedTranspName = (
      matchedSup?.name ||
      formTransportadoraNome ||
      ''
    )
      .trim()
      .toUpperCase();

    const nowIso = new Date().toISOString();
    let nextList: ThirdPartyPlateEntry[];

    if (editingId) {
      nextList = items.map((it) =>
        it.id === editingId
          ? {
              ...it,
              placa: cleanedPlaca,
              uf: formUf.trim().toUpperCase().slice(0, 2),
              transportadoraId: formSupplierId || '',
              transportadoraNome: resolvedTranspName,
              modeloVeiculo: formModelo.trim().toUpperCase(),
              motoristaNome: formMotoristaNome.trim().toUpperCase(),
              motoristaCpf: formMotoristaCpf.trim(),
              updatedAt: nowIso,
            }
          : it
      );
    } else {
      const created: ThirdPartyPlateEntry = {
        id: `pt_${cleanedPlaca}_${Date.now()}`,
        placa: cleanedPlaca,
        uf: formUf.trim().toUpperCase().slice(0, 2),
        transportadoraId: formSupplierId || '',
        transportadoraNome: resolvedTranspName,
        modeloVeiculo: formModelo.trim().toUpperCase(),
        motoristaNome: formMotoristaNome.trim().toUpperCase(),
        motoristaCpf: formMotoristaCpf.trim(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextList = [...items, created];
    }

    const saved = saveStoredPlacasTerceiros(nextList);
    setItems(saved);
    resetForm();
  };

  const handleStartEdit = (entry: ThirdPartyPlateEntry) => {
    setEditingId(entry.id);
    setFormPlaca(entry.placa);
    setFormUf(entry.uf || '');
    setFormSupplierId(entry.transportadoraId || '');
    setFormTransportadoraNome(entry.transportadoraNome || '');
    setFormModelo(entry.modeloVeiculo || '');
    setFormMotoristaNome(entry.motoristaNome || '');
    setFormMotoristaCpf(entry.motoristaCpf || '');
    setFormError('');
  };

  const handleDelete = (id: string) => {
    const nextList = items.filter((it) => it.id !== id);
    const saved = saveStoredPlacasTerceiros(nextList);
    setItems(saved);
    if (editingId === id) resetForm();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/55 flex items-center justify-center p-4">
      <div className="bg-[#cad4e6] dark:bg-stone-950 w-full max-w-3xl rounded-xl border border-black dark:border-stone-700 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Cabeçalho */}
        <div className="px-4 py-3 bg-[#e0e6f1] dark:bg-stone-900 border-b border-black/30 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0369a1] text-white flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-black dark:text-white uppercase">
                🚚 Placas &amp; Veículos de Terceiros (Transportadoras)
              </h3>
              <p className="text-[11px] font-medium text-black/70 dark:text-stone-400">
                Catálogo automático de placas de transportadoras e motoristas externos vinculados às NF-e
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-black/70 hover:text-black dark:text-stone-400 dark:hover:text-white hover:bg-black/10 rounded-lg cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Formulário Adicionar / Editar */}
          <form
            onSubmit={handleSaveEntry}
            className="p-3 bg-[#e0e6f1] dark:bg-stone-900 rounded-xl border border-black/25 dark:border-stone-700 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-black dark:text-stone-200">
                {editingId ? 'Editar Placa de Terceiro' : 'Cadastrar Nova Placa de Terceiro'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[10px] font-bold text-slate-600 hover:text-black underline cursor-pointer"
                >
                  Cancelar Edição
                </button>
              )}
            </div>

            {formError && (
              <div className="px-2.5 py-1.5 rounded-lg bg-rose-100 border border-rose-400 text-rose-800 text-[11px] font-bold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-black uppercase text-black/80 dark:text-stone-300 mb-0.5">
                  Placa *
                </label>
                <input
                  type="text"
                  value={formPlaca}
                  maxLength={8}
                  onChange={(e) => setFormPlaca(e.target.value.toUpperCase())}
                  placeholder="ABC1D23"
                  className="w-full h-8 px-2.5 bg-white dark:bg-stone-950 border border-black/40 dark:border-stone-700 rounded-lg text-xs font-mono font-bold text-black dark:text-stone-100 uppercase"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-black uppercase text-black/80 dark:text-stone-300 mb-0.5">
                  UF Veículo
                </label>
                <select
                  value={formUf}
                  onChange={(e) => setFormUf(e.target.value)}
                  className="w-full h-8 px-2 bg-white dark:bg-stone-950 border border-black/40 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                >
                  <option value="">UF...</option>
                  {BRAZIL_UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[10px] font-black uppercase text-black/80 dark:text-stone-300 mb-0.5">
                  Transportadora / Fornecedor (Opcional)
                </label>
                <select
                  value={formSupplierId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setFormSupplierId(id);
                    const sup = availableSuppliers.find((s) => s.id === id);
                    if (sup) setFormTransportadoraNome((sup.name || '').toUpperCase());
                  }}
                  className="w-full h-8 px-2 bg-white dark:bg-stone-950 border border-black/40 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                >
                  <option value="">Avulso / Sem vínculo</option>
                  {availableSuppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {(sup.name || '').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-black uppercase text-black/80 dark:text-stone-300 mb-0.5">
                  Modelo / Tipo (Opcional)
                </label>
                <input
                  type="text"
                  value={formModelo}
                  onChange={(e) => setFormModelo(e.target.value)}
                  placeholder="EX: SCANIA R450"
                  className="w-full h-8 px-2.5 bg-white dark:bg-stone-950 border border-black/40 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-6">
                <label className="block text-[10px] font-black uppercase text-black/80 dark:text-stone-300 mb-0.5">
                  Motorista Vinculado (Opcional)
                </label>
                <input
                  type="text"
                  value={formMotoristaNome}
                  onChange={(e) => setFormMotoristaNome(e.target.value)}
                  placeholder="EX: JOÃO DA SILVA"
                  className="w-full h-8 px-2.5 bg-white dark:bg-stone-950 border border-black/40 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[10px] font-black uppercase text-black/80 dark:text-stone-300 mb-0.5">
                  CPF do Motorista (Opcional)
                </label>
                <input
                  type="text"
                  value={formMotoristaCpf}
                  onChange={(e) => setFormMotoristaCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full h-8 px-2.5 bg-white dark:bg-stone-950 border border-black/40 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100"
                />
              </div>
            </div>

            {!formSupplierId && (
              <div>
                <label className="block text-[10px] font-black uppercase text-black/80 dark:text-stone-300 mb-0.5">
                  Nome do Portador / Transportadora Avulsa (Opcional)
                </label>
                <input
                  type="text"
                  value={formTransportadoraNome}
                  onChange={(e) => setFormTransportadoraNome(e.target.value)}
                  placeholder="EX: TRANSPORTES SILVA LTDA"
                  className="w-full h-8 px-2.5 bg-white dark:bg-stone-950 border border-black/40 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100 uppercase"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#276d4b] hover:bg-[#1f573c] text-white text-xs font-black uppercase cursor-pointer shadow-xs"
              >
                {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Salvar Alterações' : 'Adicionar Placa'}</span>
              </button>
            </div>
          </form>

          {/* Barra de busca */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por placa, transportadora, UF ou modelo..."
              className="w-full h-8 pl-8 pr-3 bg-white dark:bg-stone-900 border border-black/30 dark:border-stone-700 rounded-lg text-xs font-bold text-black dark:text-stone-100"
            />
          </div>

          {/* Lista */}
          <div className="bg-white dark:bg-stone-900 border border-black/25 dark:border-stone-700 rounded-xl divide-y divide-slate-200 dark:divide-stone-800 max-h-64 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-xs font-medium text-slate-500 dark:text-stone-400">
                {items.length === 0
                  ? 'Nenhuma placa de terceiro cadastrada ainda. Placas digitadas em NF-e de terceiros também serão memorizadas automaticamente.'
                  : 'Nenhuma placa encontrada com os critérios da busca.'}
              </div>
            ) : (
              filteredItems.map((entry) => (
                <div
                  key={entry.id}
                  className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-stone-800/70"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-black text-xs tracking-wider">
                        {entry.placa}
                      </span>
                      {entry.uf && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-black">
                          {entry.uf}
                        </span>
                      )}
                      {entry.modeloVeiculo && (
                        <span className="text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase truncate">
                          {entry.modeloVeiculo}
                        </span>
                      )}
                    </div>
                    <div className="text-[10.5px] font-semibold text-slate-500 dark:text-stone-400 uppercase mt-0.5 truncate">
                      {entry.transportadoraNome
                        ? `TRANSPORTADORA: ${entry.transportadoraNome}`
                        : 'TRANSPORTADORA AVULSA / SEM VÍNCULO'}
                      {entry.motoristaNome ? ` • MOTORISTA: ${entry.motoristaNome}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onSelectPlate && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPlate(entry);
                          onClose();
                        }}
                        className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase cursor-pointer"
                        title="Usar esta placa na nota"
                      >
                        Usar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(entry)}
                      className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md cursor-pointer"
                      title="Editar placa"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                      title="Excluir placa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-4 py-2.5 bg-[#e0e6f1] dark:bg-stone-900 border-t border-black/30 dark:border-stone-800 flex items-center justify-between">
          <span className="text-[11px] font-bold text-black/70 dark:text-stone-400">
            {items.length} {items.length === 1 ? 'placa cadastrada' : 'placas cadastradas'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-black uppercase cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlacasTerceirosManagerModal;
