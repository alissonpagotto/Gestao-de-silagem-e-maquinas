import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchFornecedores, mapRowToSupplier, toValidUUID, isSupabaseConfigured, upsertFornecedor, deleteFornecedor } from '../../lib/supabaseService';
import { saveStoredSuppliers, getActiveCompanyId } from '../../lib/storage';
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Building, 
  Trash2, 
  MessageCircle,
  Pencil,
} from 'lucide-react';
import { Supplier } from '../../types';
import { cleanDigits, formatCpfCnpj, formatIE } from '../../lib/formatters';
import { SupplierModal } from './SupplierModal';
import { useConfirm } from '../../context/ConfirmContext';

interface SuppliersModuleProps {
  suppliers: Supplier[];
  onSaveSuppliers: (suppliers: Supplier[]) => void;
}

export const SuppliersModule: React.FC<SuppliersModuleProps> = ({
  suppliers,
  onSaveSuppliers,
}) => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(() => Array.isArray(suppliers) ? suppliers : []);

  useEffect(() => {
    if (suppliers) {
      setLocalSuppliers(Array.isArray(suppliers) ? suppliers : []);
    }
  }, [suppliers]);

  const onSaveSuppliersRef = useRef(onSaveSuppliers);
  useEffect(() => {
    onSaveSuppliersRef.current = onSaveSuppliers;
  }, [onSaveSuppliers]);

  const supDebounceTimerRef = useRef<any>(null);

  // Sincronização em tempo real multi-dispositivos (Supabase Realtime) escutando 'fornecedores'
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;

    const debouncedFetch = () => {
      if (supDebounceTimerRef.current) clearTimeout(supDebounceTimerRef.current);
      supDebounceTimerRef.current = setTimeout(() => {
        fetchFornecedores().then(fresh => {
          if (isMounted && fresh && Array.isArray(fresh)) {
            setLocalSuppliers(fresh);
            saveStoredSuppliers(fresh);
            onSaveSuppliersRef.current?.(fresh);
          }
        }).catch(() => {});
      }, 400);
    };

    const handlePayload = (payload: any) => {
      // 1. Atualização imediata
      if (payload.eventType === 'DELETE') {
        const delId = payload.old?.id;
        if (delId) {
          setLocalSuppliers(prev => {
            const updated = prev.filter(s => s.id !== delId && toValidUUID(s.id) !== delId);
            saveStoredSuppliers(updated);
            onSaveSuppliersRef.current?.(updated);
            return updated;
          });
        }
      } else if (payload.eventType === 'INSERT' && payload.new) {
        const mapped = mapRowToSupplier(payload.new);
        setLocalSuppliers(prev => {
          const exists = prev.some(s => s.id === mapped.id || toValidUUID(s.id) === mapped.id);
          const updated = exists
            ? prev.map(s => (s.id === mapped.id || toValidUUID(s.id) === mapped.id) ? { ...s, ...mapped } : s)
            : [mapped, ...prev].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
          saveStoredSuppliers(updated);
          onSaveSuppliersRef.current?.(updated);
          return updated;
        });
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        const mapped = mapRowToSupplier(payload.new);
        setLocalSuppliers(prev => {
          const updated = prev.map(s => (s.id === mapped.id || toValidUUID(s.id) === mapped.id) ? { ...s, ...mapped } : s);
          saveStoredSuppliers(updated);
          onSaveSuppliersRef.current?.(updated);
          return updated;
        });
      }

      // 2. Reconciliação debounced
      debouncedFetch();
    };

    const channelId = 'suppliers_module_rt';
    const existingChannels = supabase.getChannels?.() || [];
    for (const ch of existingChannels) {
      if (ch.topic === channelId || ch.topic === `realtime:${channelId}`) {
        try { supabase.removeChannel(ch); } catch (_) {}
      }
    }

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fornecedores' },
        handlePayload
      )
      .subscribe();

    const handleFocus = () => {
      debouncedFetch();
    };
    handleFocus();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      if (supDebounceTimerRef.current) {
        clearTimeout(supDebounceTimerRef.current);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, []);

  const filteredSuppliers = localSuppliers.filter(sup =>
    sup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sup.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sup.tradeName && sup.tradeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (sup.city && sup.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (sup.cnpjOrCpf && sup.cnpjOrCpf.includes(searchTerm)) ||
    (sup.stateRegistration && sup.stateRegistration.includes(searchTerm)) ||
    (sup.municipalRegistration && sup.municipalRegistration.includes(searchTerm))
  );

  const handleOpenNew = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const sup = localSuppliers.find(s => s.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Fornecedor',
      message: sup?.name
        ? `Deseja realmente excluir o fornecedor "${sup.name}"?`
        : 'Deseja realmente excluir este fornecedor?',
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (isConfirmed) {
      const activeCompanyId = getActiveCompanyId();
      const updated = localSuppliers.filter(s => s.id !== id);
      setLocalSuppliers(updated);
      saveStoredSuppliers(updated);
      onSaveSuppliers(updated);
      deleteFornecedor(id, activeCompanyId).catch(err => console.warn('Supabase deleteFornecedor notice:', err));
    }
  };

  return (
    <div id="suppliers-module" className="w-full max-w-none space-y-3 antialiased">
      
      {/* 1. Cabeçalho Padronizado 3D Slim */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] pb-2">
        <div>
          <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
            Fornecedores
          </h1>
        </div>

        {/* Botões e Ações com Moldura Acetinada 3D */}
        <div className="flex items-center gap-2">
          <div 
            aria-label="Abas e Controles de Fornecedores"
            className="flex items-center gap-1.5 p-1 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-xl border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08),inset_-1px_-1px_0px_rgba(0,0,0,0.3)]"
          >
            <div className="px-2.5 py-1 text-xs font-bold bg-white text-zinc-900 dark:bg-stone-800 dark:text-white rounded-lg shadow-xs border border-zinc-400 dark:border-stone-600">
              {filteredSuppliers.length} Cadastrado(s)
            </div>
            <button
              type="button"
              id="btn-cadastrar-fornecedor"
              onClick={handleOpenNew}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Novo Fornecedor</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Barra de Pesquisa Superior Slim */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          id="input-buscar-fornecedor"
          placeholder="Buscar fornecedor por razão social, CNPJ, categoria ou cidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 placeholder:text-slate-400 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-zinc-900/10 outline-none transition"
        />
      </div>

      {/* 3. Tabela em Linha Única Slim Estrita */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-slate-300 dark:border-stone-800 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs text-zinc-800 dark:text-stone-200">
          <thead className="bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400 font-bold border-b border-slate-300 dark:border-stone-700 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-1 px-2.5">Fornecedor & Fantasia</th>
              <th className="py-1 px-2.5">CNPJ / CPF & IE</th>
              <th className="py-1 px-2.5">Contato / Telefone</th>
              <th className="py-1 px-2.5">Cidade / UF</th>
              <th className="py-1 px-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-stone-800 font-medium bg-white dark:bg-stone-900">
            {filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-stone-500">
                  <Building className="w-6 h-6 text-slate-300 dark:text-stone-600 mx-auto mb-1" />
                  <span>Nenhum fornecedor encontrado</span>
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-slate-100/70 dark:hover:bg-stone-800/50 transition">
                  {/* Coluna 1: Nome Principal + Fantasia + Tag em Linha Única Horizontal */}
                  <td className="py-1 px-2.5 align-middle">
                    <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                      <span className="font-bold text-xs text-zinc-900 dark:text-white truncate" title={sup.name}>
                        {sup.name}
                      </span>
                      {sup.tradeName && sup.tradeName !== sup.name && (
                        <span className="text-[10px] text-slate-500 dark:text-stone-400 font-medium truncate" title={sup.tradeName}>
                          • Fantasia: {sup.tradeName}
                        </span>
                      )}
                      <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400 border border-slate-200 dark:border-stone-700 shrink-0">
                        {sup.category}
                      </span>
                    </div>
                  </td>

                  {/* Coluna 2: CNPJ/CPF & IE */}
                  <td className="py-1 px-2.5 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-stone-300">
                      <span className="font-semibold text-zinc-900 dark:text-stone-100">
                        {sup.cnpjOrCpf ? formatCpfCnpj(sup.cnpjOrCpf) : 'Não inf.'}
                      </span>
                      {sup.stateRegistration ? (
                        <span className="text-[10px] text-slate-500 dark:text-stone-400">
                          • IE: {formatIE(sup.stateRegistration)}
                        </span>
                      ) : (
                        sup.municipalRegistration && (
                          <span className="text-[10px] text-slate-500 dark:text-stone-400">
                            • IM: {sup.municipalRegistration}
                          </span>
                        )
                      )}
                    </div>
                  </td>

                  {/* Coluna 3: Telefone & Email */}
                  <td className="py-1 px-2.5 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-stone-300">
                      <span>{sup.phone || 'Sem telefone'}</span>
                      {sup.email && (
                        <span className="text-[10px] text-slate-500 dark:text-stone-400 truncate max-w-[140px]" title={sup.email}>
                          • {sup.email}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Coluna 4: Endereço / Cidade */}
                  <td className="py-1 px-2.5 align-middle whitespace-nowrap text-xs text-zinc-700 dark:text-stone-300">
                    {sup.city ? `${sup.city}${sup.state ? `/${sup.state}` : ''}` : 'Não inf.'}
                  </td>

                  {/* Coluna 5: Ações */}
                  <td className="py-1 px-2.5 text-right whitespace-nowrap align-middle">
                    <div className="flex items-center justify-end space-x-1">
                      {sup.phone && cleanDigits(sup.phone).length >= 10 && (
                        <a
                          href={`https://wa.me/55${cleanDigits(sup.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition cursor-pointer"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEdit(sup)}
                        className="p-1 text-slate-600 dark:text-stone-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition cursor-pointer"
                        title="Editar fornecedor"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sup.id)}
                        className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                        title="Excluir fornecedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Reutilizável de Cadastro / Edição de Fornecedor */}
      <SupplierModal
        isOpen={isModalOpen}
        editingSupplier={editingSupplier}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSupplier(null);
        }}
        onSave={(savedSup) => {
          const activeCompanyId = getActiveCompanyId();
          const index = suppliers.findIndex(s => s.id === savedSup.id);
          if (index >= 0) {
            const updated = [...suppliers];
            updated[index] = savedSup;
            setLocalSuppliers(updated);
            saveStoredSuppliers(updated);
            onSaveSuppliers(updated);
          } else {
            const updated = [...suppliers, savedSup];
            setLocalSuppliers(updated);
            saveStoredSuppliers(updated);
            onSaveSuppliers(updated);
          }
          upsertFornecedor(savedSup, activeCompanyId).catch(err => console.warn('Supabase upsertFornecedor notice:', err));
        }}
      />

    </div>
  );
};
