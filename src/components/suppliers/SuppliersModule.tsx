import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchFornecedores, mapRowToSupplier, toValidUUID, isSupabaseConfigured, upsertFornecedor, deleteFornecedor } from '../../lib/supabaseService';
import { saveStoredSuppliers, ensureSequentialSupplierCodes, getActiveCompanyId } from '../../lib/storage';
import {
  Plus,
  Search,
  Trash2,
  MessageCircle,
  Pencil,
  Printer,
  Truck,
  Check,
  X,
  Edit3,
  Link2,
} from 'lucide-react';
import { Supplier } from '../../types';
import { cleanDigits, formatCpfCnpj, formatIE } from '../../lib/formatters';
import { SupplierModal } from './SupplierModal';
import { printSupplierRegistrationA4 } from './supplierPrintUtils';
import { useConfirm } from '../../context/ConfirmContext';
import {
  ThirdPartyPlateEntry,
  getStoredPlacasTerceiros,
  saveStoredPlacasTerceiros,
  normalizePlateCode,
  isTransportSupplierCategory,
  useAuxiliarySyncVersion,
} from '../../lib/auxiliaryRegistries';

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

interface SuppliersModuleProps {
  suppliers: Supplier[];
  onSaveSuppliers: (suppliers: Supplier[]) => void;
}

export const SuppliersModule: React.FC<SuppliersModuleProps> = ({
  suppliers,
  onSaveSuppliers,
}) => {
  const { confirm } = useConfirm();
  const auxSyncVersion = useAuxiliarySyncVersion();
  const [activeSubTab, setActiveSubTab] = useState<'fornecedores' | 'transportadoras'>('fornecedores');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [modalDefaultCategory, setModalDefaultCategory] = useState<string>('');
  const [modalInitialTab, setModalInitialTab] = useState<'cadastro' | 'veiculos' | 'historico'>('cadastro');
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(() =>
    ensureSequentialSupplierCodes(Array.isArray(suppliers) ? suppliers : []).items
  );

  // Placas & Veículos de Terceiros (Transportadoras) - sincronizado com agrocontrol_placas_terceiros
  const [thirdPartyPlates, setThirdPartyPlates] = useState<ThirdPartyPlateEntry[]>(() =>
    getStoredPlacasTerceiros()
  );

  // Estado do formulário inline por transportadora (ou avulso)
  const [inlineFormTargetId, setInlineFormTargetId] = useState<string | null>(null);
  const [inlineEditingPlateId, setInlineEditingPlateId] = useState<string | null>(null);
  const [inlinePlaca, setInlinePlaca] = useState('');
  const [inlineUf, setInlineUf] = useState('');
  const [inlineModelo, setInlineModelo] = useState('');
  const [inlineMotorista, setInlineMotorista] = useState('');
  const [inlineMotoristaCpf, setInlineMotoristaCpf] = useState('');
  const [inlineError, setInlineError] = useState('');

  useEffect(() => {
    setThirdPartyPlates(getStoredPlacasTerceiros());
  }, [auxSyncVersion]);

  useEffect(() => {
    if (suppliers) {
      const { items, changed } = ensureSequentialSupplierCodes(Array.isArray(suppliers) ? suppliers : []);
      setLocalSuppliers(items);
      if (changed) {
        saveStoredSuppliers(items);
      }
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

  const matchesSupplierPlate = (plate: ThirdPartyPlateEntry, sup: Supplier): boolean => {
    if (plate.transportadoraId && plate.transportadoraId === sup.id) return true;
    const pName = (plate.transportadoraNome || '').trim().toUpperCase();
    if (!plate.transportadoraId && pName) {
      if ((sup.name || '').trim().toUpperCase() === pName) return true;
      if ((sup.tradeName || '').trim().toUpperCase() === pName) return true;
    }
    return false;
  };

  const getCarrierPlatesForSupplier = (sup: Supplier): ThirdPartyPlateEntry[] =>
    thirdPartyPlates.filter((p) => matchesSupplierPlate(p, sup));

  // Aba 1: Listagem geral de fornecedores de produtos, insumos e serviços
  const generalSuppliers = useMemo(() => {
    return localSuppliers.filter((sup) => !isTransportSupplierCategory(sup.category));
  }, [localSuppliers]);

  // Aba 2: Todos os cadastros marcados como transportadoras/frete OU com placas vinculadas em agrocontrol_placas_terceiros
  const carrierSuppliers = useMemo(() => {
    return localSuppliers.filter(
      (sup) =>
        isTransportSupplierCategory(sup.category) ||
        thirdPartyPlates.some((p) => matchesSupplierPlate(p, sup))
    );
  }, [localSuppliers, thirdPartyPlates]);

  // Placas avulsas / não vinculadas a nenhum fornecedor listado em carrierSuppliers
  const unlinkedPlates = useMemo(() => {
    return thirdPartyPlates.filter(
      (p) => !localSuppliers.some((sup) => matchesSupplierPlate(p, sup))
    );
  }, [thirdPartyPlates, localSuppliers]);

  const supplierMatchesSearch = (sup: Supplier, q: string): boolean => {
    if (!q) return true;
    const supCode = (sup.code || sup.codigo || '').toLowerCase();
    if (
      supCode.includes(q) ||
      (sup.name || '').toLowerCase().includes(q) ||
      (sup.category || '').toLowerCase().includes(q) ||
      (sup.tradeName && sup.tradeName.toLowerCase().includes(q)) ||
      (sup.city && sup.city.toLowerCase().includes(q)) ||
      (sup.cnpjOrCpf && sup.cnpjOrCpf.toLowerCase().includes(q)) ||
      (sup.stateRegistration && sup.stateRegistration.toLowerCase().includes(q)) ||
      (sup.municipalRegistration && sup.municipalRegistration.toLowerCase().includes(q))
    ) {
      return true;
    }
    const linked = getCarrierPlatesForSupplier(sup);
    return linked.some(
      (p) =>
        p.placa.toLowerCase().includes(q) ||
        (p.modeloVeiculo || '').toLowerCase().includes(q) ||
        (p.motoristaNome || '').toLowerCase().includes(q) ||
        (p.uf || '').toLowerCase().includes(q)
    );
  };

  const filteredSuppliers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return generalSuppliers.filter((sup) => supplierMatchesSearch(sup, q));
  }, [generalSuppliers, searchTerm]);

  const filteredCarriers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return carrierSuppliers.filter((sup) => supplierMatchesSearch(sup, q));
  }, [carrierSuppliers, searchTerm, thirdPartyPlates]);

  const filteredUnlinkedPlates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return unlinkedPlates;
    return unlinkedPlates.filter(
      (p) =>
        p.placa.toLowerCase().includes(q) ||
        (p.uf || '').toLowerCase().includes(q) ||
        (p.modeloVeiculo || '').toLowerCase().includes(q) ||
        (p.motoristaNome || '').toLowerCase().includes(q) ||
        (p.transportadoraNome || '').toLowerCase().includes(q)
    );
  }, [unlinkedPlates, searchTerm]);

  const handleOpenNewFornecedor = () => {
    setEditingSupplier(null);
    setModalDefaultCategory('');
    setModalInitialTab('cadastro');
    setIsModalOpen(true);
  };

  const handleOpenNewTransportadora = () => {
    setEditingSupplier(null);
    setModalDefaultCategory('Transportadora / Frete');
    setModalInitialTab('cadastro');
    setIsModalOpen(true);
  };

  const handleEdit = (sup: Supplier, tab: 'cadastro' | 'veiculos' | 'historico' = 'cadastro') => {
    setEditingSupplier(sup);
    setModalDefaultCategory('');
    setModalInitialTab(tab);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    const sup = localSuppliers.find(s => s.id === id);
    const isConfirmed = await confirm({
      title: 'Excluir Cadastro',
      message: sup?.name
        ? `Deseja realmente excluir "${sup.name}"?`
        : 'Deseja realmente excluir este registro?',
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
      return true;
    }
    return false;
  };

  // Gerenciamento inline de placas/veículos/motoristas na aba Transportadoras
  const closeInlinePlateForm = () => {
    setInlineFormTargetId(null);
    setInlineEditingPlateId(null);
    setInlinePlaca('');
    setInlineUf('');
    setInlineModelo('');
    setInlineMotorista('');
    setInlineMotoristaCpf('');
    setInlineError('');
  };

  const openInlineAddPlate = (targetId: string) => {
    setInlineFormTargetId(targetId);
    setInlineEditingPlateId(null);
    setInlinePlaca('');
    setInlineUf('');
    setInlineModelo('');
    setInlineMotorista('');
    setInlineMotoristaCpf('');
    setInlineError('');
  };

  const openInlineEditPlate = (targetId: string, entry: ThirdPartyPlateEntry) => {
    setInlineFormTargetId(targetId);
    setInlineEditingPlateId(entry.id);
    setInlinePlaca(entry.placa);
    setInlineUf(entry.uf || '');
    setInlineModelo(entry.modeloVeiculo || '');
    setInlineMotorista(entry.motoristaNome || '');
    setInlineMotoristaCpf(entry.motoristaCpf || '');
    setInlineError('');
  };

  const handleSaveInlinePlate = (carrier: Supplier | null) => {
    const cleanedPlaca = normalizePlateCode(inlinePlaca);
    if (!cleanedPlaca || cleanedPlaca.length < 5) {
      setInlineError('Informe uma placa válida (ex: ABC1D23).');
      return;
    }

    const dup = thirdPartyPlates.find(
      (p) => normalizePlateCode(p.placa) === cleanedPlaca && p.id !== inlineEditingPlateId
    );
    if (dup) {
      setInlineError(
        dup.transportadoraNome
          ? `A placa ${cleanedPlaca} já está vinculada a "${dup.transportadoraNome}".`
          : `A placa ${cleanedPlaca} já está cadastrada.`
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const targetCarrierId = carrier ? carrier.id : '';
    const targetCarrierName = carrier ? (carrier.name || '').trim().toUpperCase() : '';

    const nextList: ThirdPartyPlateEntry[] = inlineEditingPlateId
      ? thirdPartyPlates.map((p) =>
          p.id === inlineEditingPlateId
            ? {
                ...p,
                placa: cleanedPlaca,
                uf: inlineUf.trim().toUpperCase().slice(0, 2),
                transportadoraId: carrier ? carrier.id : p.transportadoraId || '',
                transportadoraNome: carrier ? targetCarrierName : p.transportadoraNome || '',
                modeloVeiculo: inlineModelo.trim().toUpperCase(),
                motoristaNome: inlineMotorista.trim().toUpperCase(),
                motoristaCpf: inlineMotoristaCpf.trim(),
                updatedAt: nowIso,
              }
            : p
        )
      : [
          ...thirdPartyPlates,
          {
            id: `pt_${cleanedPlaca}_${Date.now()}`,
            placa: cleanedPlaca,
            uf: inlineUf.trim().toUpperCase().slice(0, 2),
            transportadoraId: targetCarrierId,
            transportadoraNome: targetCarrierName,
            modeloVeiculo: inlineModelo.trim().toUpperCase(),
            motoristaNome: inlineMotorista.trim().toUpperCase(),
            motoristaCpf: inlineMotoristaCpf.trim(),
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ];

    const saved = saveStoredPlacasTerceiros(nextList);
    setThirdPartyPlates(saved);
    closeInlinePlateForm();
  };

  const handleDeletePlateEntry = async (entry: ThirdPartyPlateEntry) => {
    const ok = await confirm({
      title: 'Excluir Placa / Veículo',
      message: `Deseja realmente excluir a placa ${entry.placa}${entry.motoristaNome ? ` (Motorista: ${entry.motoristaNome})` : ''}?`,
      confirmLabel: 'Sim, Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    const saved = saveStoredPlacasTerceiros(thirdPartyPlates.filter((p) => p.id !== entry.id));
    setThirdPartyPlates(saved);
    if (inlineEditingPlateId === entry.id) closeInlinePlateForm();
  };

  const handleLinkUnlinkedPlateToCarrier = (plateId: string, carrierId: string) => {
    const carrier = localSuppliers.find((s) => s.id === carrierId);
    if (!carrier) return;
    const nextList = thirdPartyPlates.map((p) =>
      p.id === plateId
        ? {
            ...p,
            transportadoraId: carrier.id,
            transportadoraNome: (carrier.name || '').trim().toUpperCase(),
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    const saved = saveStoredPlacasTerceiros(nextList);
    setThirdPartyPlates(saved);
  };

  return (
    <div id="suppliers-module" className="w-full max-w-none space-y-3 antialiased">

      {/* 1. Cabeçalho Padronizado 3D Slim */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] pb-2">
        <div>
          <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
            Fornecedores &amp; Transportadoras
          </h1>
        </div>

        {/* Botões e Ações com Moldura Acetinada 3D */}
        <div className="flex items-center gap-2">
          <div
            aria-label="Abas e Controles de Fornecedores e Transportadoras"
            className="flex items-center gap-1.5 p-1 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-xl border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08),inset_-1px_-1px_0px_rgba(0,0,0,0.3)]"
          >
            <div className="px-2.5 py-1 text-xs font-bold bg-white text-zinc-900 dark:bg-stone-800 dark:text-white rounded-lg shadow-xs border border-zinc-400 dark:border-stone-600">
              {activeSubTab === 'fornecedores'
                ? `${filteredSuppliers.length} Fornecedor(es)`
                : `${filteredCarriers.length} Transportadora(s)`}
            </div>
            {activeSubTab === 'fornecedores' ? (
              <button
                type="button"
                id="btn-cadastrar-fornecedor"
                onClick={handleOpenNewFornecedor}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Novo Fornecedor</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-cadastrar-transportadora"
                onClick={handleOpenNewTransportadora}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Nova Transportadora</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Sub-abas Oficiais no Topo do Módulo (bg-orange-400/40 + Tarja Verde na Aba Ativa) */}
      <div className="w-full bg-[#edf4ff] dark:bg-stone-850 border border-black/30 dark:border-stone-700 rounded-xl overflow-hidden shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)]">
        <nav
          aria-label="Sub-abas de Fornecedores e Transportadoras"
          className="w-full flex items-center overflow-x-auto whitespace-nowrap scrollbar-none"
        >
          <button
            type="button"
            id="subtab-fornecedores"
            onClick={() => setActiveSubTab('fornecedores')}
            style={activeSubTab === 'fornecedores' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2 text-xs tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap border-r border-slate-300/80 dark:border-stone-700/80 ${
              activeSubTab === 'fornecedores'
                ? 'bg-orange-400/40 text-black font-black shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
            }`}
          >
            <span>🏢 FORNECEDORES</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/80 text-slate-900 border border-black/20">
              {generalSuppliers.length}
            </span>
          </button>

          <button
            type="button"
            id="subtab-transportadoras"
            onClick={() => setActiveSubTab('transportadoras')}
            style={activeSubTab === 'transportadoras' ? { backgroundColor: 'rgba(251, 146, 60, 0.40)' } : undefined}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2 text-xs tracking-wide uppercase transition cursor-pointer select-none whitespace-nowrap ${
              activeSubTab === 'transportadoras'
                ? 'bg-orange-400/40 text-black font-black shadow-xs border-t-2 border-t-emerald-600 -mb-px z-10'
                : 'bg-slate-200/50 hover:bg-slate-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 font-bold dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200'
            }`}
          >
            <span>🚚 TRANSPORTADORAS &amp; VEÍCULOS</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/80 text-slate-900 border border-black/20">
              {carrierSuppliers.length} • {thirdPartyPlates.length} placa{thirdPartyPlates.length === 1 ? '' : 's'}
            </span>
          </button>
        </nav>
      </div>

      {/* 3. Barra de Pesquisa Superior Slim */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          id="input-buscar-fornecedor"
          placeholder={
            activeSubTab === 'fornecedores'
              ? 'Buscar fornecedor por código (0001), razão social, CNPJ/CPF, categoria ou cidade...'
              : 'Buscar transportadora por razão social, CNPJ, placa do veículo, modelo, motorista ou cidade...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-stone-900 text-zinc-900 dark:text-stone-100 placeholder:text-slate-400 border border-slate-300 dark:border-stone-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-zinc-900/10 outline-none transition"
        />
      </div>

      {/* CONTEÚDO ABA 1: FORNECEDORES */}
      {activeSubTab === 'fornecedores' && (
        <div className="bg-white dark:bg-stone-900 rounded-lg max-h-[calc(100vh-300px)] overflow-y-auto overflow-x-auto border border-slate-300 dark:border-stone-700 shadow-2xs">
          <table className="w-full text-left text-xs text-zinc-800 dark:text-stone-200 border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 shadow-sm text-slate-600 dark:text-stone-400 font-bold border-b border-slate-300 dark:border-stone-700 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5">Fornecedor & Fantasia</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5">CNPJ / CPF & IE</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5">Contato / Telefone</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5">Cidade / UF</th>
                <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-1.5 px-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-stone-800 font-medium bg-white dark:bg-stone-900">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase">
                    NENHUM FORNECEDOR ENCONTRADO
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
                    {/* Coluna 1: Código + Nome Principal + Fantasia + Tag em Linha Única Horizontal */}
                    <td className="py-1 px-2.5 align-middle">
                      <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                        {(sup.code || sup.codigo) && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-stone-200 border border-slate-300 dark:border-stone-700 font-mono text-[10px] font-black shrink-0">
                            #{sup.code || sup.codigo}
                          </span>
                        )}
                        <span className="font-bold text-xs text-zinc-900 dark:text-white truncate" title={sup.name}>
                          {sup.name}
                        </span>
                        {sup.tradeName && sup.tradeName !== sup.name && (
                          <span className="text-[10px] text-slate-500 dark:text-stone-400 font-medium truncate" title={sup.tradeName}>
                            • Fantasia: {sup.tradeName}
                          </span>
                        )}
                        {sup.category && (
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400 border border-slate-200 dark:border-stone-700 shrink-0">
                            {sup.category}
                          </span>
                        )}
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
                          onClick={() => {
                            void printSupplierRegistrationA4(sup);
                          }}
                          className="p-1 text-slate-600 dark:text-stone-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition cursor-pointer"
                          title="Imprimir Ficha Cadastral (A4)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(sup, 'cadastro')}
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
      )}

      {/* CONTEÚDO ABA 2: TRANSPORTADORAS & VEÍCULOS */}
      {activeSubTab === 'transportadoras' && (
        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-0.5">
          {filteredCarriers.length === 0 && filteredUnlinkedPlates.length === 0 ? (
            <div className="bg-white dark:bg-stone-900 rounded-xl border border-slate-300 dark:border-stone-700 p-8 text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 text-[#0369a1] mx-auto flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
              <p className="text-xs font-black uppercase text-zinc-900 dark:text-white">
                {carrierSuppliers.length === 0 && unlinkedPlates.length === 0
                  ? 'Nenhuma transportadora cadastrada ainda'
                  : 'Nenhuma transportadora ou veículo encontrado para a busca'}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 max-w-lg mx-auto">
                Clique em &quot;+ Nova Transportadora&quot; para cadastrar transportadoras e seus veículos/placas, ou emita uma NF-e / CT-e para memorização automática.
              </p>
              <div>
                <button
                  type="button"
                  onClick={handleOpenNewTransportadora}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#276d4b] hover:bg-[#1f573c] text-white text-xs font-black uppercase cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Nova Transportadora</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {filteredCarriers.map((carrier) => {
                const linkedPlates = getCarrierPlatesForSupplier(carrier);
                const isAddingHere = inlineFormTargetId === carrier.id;

                return (
                  <div
                    key={carrier.id}
                    className="bg-white dark:bg-stone-900 rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xs overflow-hidden"
                  >
                    {/* Cabeçalho da Transportadora */}
                    <div className="px-3 py-2 bg-slate-100/90 dark:bg-stone-800/80 border-b border-slate-300 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(carrier.code || carrier.codigo) && (
                            <span className="px-1.5 py-0.2 rounded bg-white dark:bg-stone-900 text-slate-900 dark:text-stone-200 border border-slate-300 dark:border-stone-700 font-mono text-[10px] font-black">
                              #{carrier.code || carrier.codigo}
                            </span>
                          )}
                          <span className="font-black text-xs text-zinc-900 dark:text-white uppercase">
                            {carrier.name}
                          </span>
                          {carrier.tradeName && carrier.tradeName !== carrier.name && (
                            <span className="text-[10.5px] font-semibold text-slate-600 dark:text-stone-400 uppercase">
                              ({carrier.tradeName})
                            </span>
                          )}
                          {carrier.category && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold uppercase">
                              {carrier.category}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-black uppercase">
                            {linkedPlates.length} {linkedPlates.length === 1 ? 'veículo' : 'veículos'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                          <span>
                            {carrier.cnpjOrCpf ? formatCpfCnpj(carrier.cnpjOrCpf) : 'Doc. não inf.'}
                            {carrier.stateRegistration ? ` • IE: ${formatIE(carrier.stateRegistration)}` : ''}
                          </span>
                          <span>{carrier.phone || 'Sem telefone'}</span>
                          <span>{carrier.city ? `${carrier.city}${carrier.state ? `/${carrier.state}` : ''}` : 'Cidade não inf.'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => (isAddingHere ? closeInlinePlateForm() : openInlineAddPlate(carrier.id))}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0369a1] hover:bg-[#075985] text-white text-[10.5px] font-black uppercase cursor-pointer shadow-2xs"
                          title="Adicionar placa / veículo e motorista vinculado"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Adicionar Placa / Veículo</span>
                        </button>

                        {carrier.phone && cleanDigits(carrier.phone).length >= 10 && (
                          <a
                            href={`https://wa.me/55${cleanDigits(carrier.phone)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition cursor-pointer"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            void printSupplierRegistrationA4(carrier);
                          }}
                          className="p-1.5 text-slate-600 dark:text-stone-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition cursor-pointer"
                          title="Imprimir Ficha Cadastral (A4)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(carrier, 'cadastro')}
                          className="p-1.5 text-slate-600 dark:text-stone-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition cursor-pointer"
                          title="Editar cadastro da transportadora"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(carrier.id)}
                          className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Excluir transportadora"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Formulário Inline de Placa / Veículo & Motorista */}
                    {isAddingHere && (
                      <div className="px-3 py-2.5 bg-[#edf4ff] dark:bg-stone-850 border-b border-slate-300 dark:border-stone-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-black uppercase text-slate-900 dark:text-stone-200">
                            {inlineEditingPlateId
                              ? `Editar Veículo / Placa — ${carrier.name}`
                              : `Novo Veículo / Placa para ${carrier.name}`}
                          </span>
                          <button
                            type="button"
                            onClick={closeInlinePlateForm}
                            className="text-slate-600 hover:text-black dark:text-stone-400 dark:hover:text-white p-0.5 cursor-pointer"
                            title="Fechar formulário"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {inlineError && (
                          <div className="px-2.5 py-1 rounded bg-rose-100 border border-rose-400 text-rose-800 text-[11px] font-bold">
                            {inlineError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                              Placa *
                            </label>
                            <input
                              type="text"
                              value={inlinePlaca}
                              maxLength={8}
                              onChange={(e) => setInlinePlaca(e.target.value.toUpperCase())}
                              placeholder="ABC1D23"
                              className="w-full h-8 px-2 bg-white dark:bg-stone-900 border border-black/30 dark:border-stone-700 rounded-lg text-xs font-mono font-black uppercase"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                              UF
                            </label>
                            <select
                              value={inlineUf}
                              onChange={(e) => setInlineUf(e.target.value)}
                              className="w-full h-8 px-1.5 bg-white dark:bg-stone-900 border border-black/30 dark:border-stone-700 rounded-lg text-xs font-bold uppercase"
                            >
                              <option value="">UF</option>
                              {BRAZIL_UFS.map((uf) => (
                                <option key={uf} value={uf}>
                                  {uf}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                              Modelo / Tipo
                            </label>
                            <input
                              type="text"
                              value={inlineModelo}
                              onChange={(e) => setInlineModelo(e.target.value.toUpperCase())}
                              placeholder="EX: SCANIA R450 / BITREM"
                              className="w-full h-8 px-2 bg-white dark:bg-stone-900 border border-black/30 dark:border-stone-700 rounded-lg text-xs font-bold uppercase"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                              Motorista Vinculado
                            </label>
                            <input
                              type="text"
                              value={inlineMotorista}
                              onChange={(e) => setInlineMotorista(e.target.value.toUpperCase())}
                              placeholder="NOME DO MOTORISTA"
                              className="w-full h-8 px-2 bg-white dark:bg-stone-900 border border-black/30 dark:border-stone-700 rounded-lg text-xs font-bold uppercase"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                              CPF Motorista (Opc.)
                            </label>
                            <input
                              type="text"
                              value={inlineMotoristaCpf}
                              onChange={(e) => setInlineMotoristaCpf(formatCpfCnpj(e.target.value))}
                              maxLength={14}
                              placeholder="000.000.000-00"
                              className="w-full h-8 px-2 bg-white dark:bg-stone-900 border border-black/30 dark:border-stone-700 rounded-lg text-xs font-medium"
                            />
                          </div>
                          <div className="sm:col-span-1 flex items-end">
                            <button
                              type="button"
                              onClick={() => handleSaveInlinePlate(carrier)}
                              className="w-full h-8 px-2 rounded-lg bg-[#276d4b] hover:bg-[#1f573c] text-white text-[11px] font-black uppercase inline-flex items-center justify-center gap-1 cursor-pointer"
                              title="Salvar veículo / placa"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Salvar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lista de Placas / Veículos e Motoristas Vinculados */}
                    {linkedPlates.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-stone-400 italic flex items-center justify-between">
                        <span>
                          Nenhum veículo/placa vinculado ainda. Cadastre clicando em &quot;Adicionar Placa / Veículo&quot; ou ao emitir NF-e / CT-e.
                        </span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead className="bg-slate-50 dark:bg-stone-900/80 text-slate-600 dark:text-stone-400 uppercase text-[9.5px] font-bold border-b border-slate-200 dark:border-stone-800">
                            <tr>
                              <th className="py-1 px-3">Placa</th>
                              <th className="py-1 px-3">UF</th>
                              <th className="py-1 px-3">Modelo / Tipo</th>
                              <th className="py-1 px-3">Motorista Vinculado</th>
                              <th className="py-1 px-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-stone-800">
                            {linkedPlates.map((entry) => (
                              <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/50">
                                <td className="py-1 px-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-black text-[11px] tracking-wider">
                                    {entry.placa}
                                  </span>
                                </td>
                                <td className="py-1 px-3 whitespace-nowrap font-bold text-slate-700 dark:text-stone-300">
                                  {entry.uf || '—'}
                                </td>
                                <td className="py-1 px-3 font-bold text-zinc-900 dark:text-stone-100 uppercase">
                                  {entry.modeloVeiculo || '—'}
                                </td>
                                <td className="py-1 px-3 font-semibold text-zinc-800 dark:text-stone-200 uppercase">
                                  {entry.motoristaNome || '—'}
                                  {entry.motoristaCpf ? (
                                    <span className="ml-1.5 text-[10px] font-mono text-slate-500">
                                      ({entry.motoristaCpf})
                                    </span>
                                  ) : null}
                                </td>
                                <td className="py-1 px-3 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openInlineEditPlate(carrier.id, entry)}
                                      className="p-1 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-stone-400 dark:hover:bg-indigo-950/40 rounded cursor-pointer"
                                      title="Editar placa / motorista"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleDeletePlateEntry(entry);
                                      }}
                                      className="p-1 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                                      title="Excluir placa"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Placas avulsas memorizadas em NF-e / CT-e sem transportadora vinculada */}
              {filteredUnlinkedPlates.length > 0 && (
                <div className="bg-white dark:bg-stone-900 rounded-xl border border-amber-400/80 dark:border-amber-700 shadow-2xs overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-300/80 dark:border-amber-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                      <div>
                        <h3 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase">
                          Placas Avulsas Memorizadas (NF-e / CT-e)
                        </h3>
                        <p className="text-[10.5px] font-medium text-amber-800 dark:text-amber-300">
                          Veículos salvos automaticamente durante emissão de notas sem vínculo a uma transportadora cadastrada
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        inlineFormTargetId === '__AVULSO__'
                          ? closeInlinePlateForm()
                          : openInlineAddPlate('__AVULSO__')
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-[10.5px] font-black uppercase cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Nova Placa Avulsa</span>
                    </button>
                  </div>

                  {inlineFormTargetId === '__AVULSO__' && (
                    <div className="px-3 py-2.5 bg-[#edf4ff] dark:bg-stone-850 border-b border-slate-300 dark:border-stone-700 space-y-2">
                      {inlineError && (
                        <div className="px-2.5 py-1 rounded bg-rose-100 border border-rose-400 text-rose-800 text-[11px] font-bold">
                          {inlineError}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                            Placa *
                          </label>
                          <input
                            type="text"
                            value={inlinePlaca}
                            maxLength={8}
                            onChange={(e) => setInlinePlaca(e.target.value.toUpperCase())}
                            placeholder="ABC1D23"
                            className="w-full h-8 px-2 bg-white dark:bg-stone-900 border border-black/30 rounded-lg text-xs font-mono font-black uppercase"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                            UF
                          </label>
                          <select
                            value={inlineUf}
                            onChange={(e) => setInlineUf(e.target.value)}
                            className="w-full h-8 px-1.5 bg-white dark:bg-stone-900 border border-black/30 rounded-lg text-xs font-bold uppercase"
                          >
                            <option value="">UF</option>
                            {BRAZIL_UFS.map((uf) => (
                              <option key={uf} value={uf}>
                                {uf}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                            Modelo / Tipo
                          </label>
                          <input
                            type="text"
                            value={inlineModelo}
                            onChange={(e) => setInlineModelo(e.target.value.toUpperCase())}
                            placeholder="EX: VOLVO FH 540"
                            className="w-full h-8 px-2 bg-white dark:bg-stone-900 border border-black/30 rounded-lg text-xs font-bold uppercase"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                            Motorista
                          </label>
                          <input
                            type="text"
                            value={inlineMotorista}
                            onChange={(e) => setInlineMotorista(e.target.value.toUpperCase())}
                            placeholder="NOME DO MOTORISTA"
                            className="w-full h-8 px-2 bg-white dark:bg-stone-900 border border-black/30 rounded-lg text-xs font-bold uppercase"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                            CPF Motorista
                          </label>
                          <input
                            type="text"
                            value={inlineMotoristaCpf}
                            onChange={(e) => setInlineMotoristaCpf(formatCpfCnpj(e.target.value))}
                            maxLength={14}
                            placeholder="000.000.000-00"
                            className="w-full h-8 px-2 bg-white dark:bg-stone-900 border border-black/30 rounded-lg text-xs font-medium"
                          />
                        </div>
                        <div className="sm:col-span-1 flex items-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveInlinePlate(null)}
                            className="w-full h-8 px-2 rounded-lg bg-[#276d4b] hover:bg-[#1f573c] text-white text-[11px] font-black uppercase inline-flex items-center justify-center cursor-pointer"
                            title="Salvar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={closeInlinePlateForm}
                            className="h-8 px-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-slate-50 dark:bg-stone-900/80 text-slate-600 dark:text-stone-400 uppercase text-[9.5px] font-bold border-b border-slate-200 dark:border-stone-800">
                        <tr>
                          <th className="py-1.5 px-3">Placa</th>
                          <th className="py-1.5 px-3">UF</th>
                          <th className="py-1.5 px-3">Portador / Origem</th>
                          <th className="py-1.5 px-3">Modelo / Motorista</th>
                          <th className="py-1.5 px-3">Vincular Transportadora</th>
                          <th className="py-1.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-stone-800">
                        {filteredUnlinkedPlates.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-stone-800/50">
                            <td className="py-1.5 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-black text-[11px] tracking-wider">
                                {entry.placa}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 whitespace-nowrap font-bold">
                              {entry.uf || '—'}
                            </td>
                            <td className="py-1.5 px-3 font-semibold uppercase text-slate-700 dark:text-stone-300">
                              {entry.transportadoraNome || 'AVULSO / TERCEIRO'}
                            </td>
                            <td className="py-1.5 px-3 uppercase text-slate-800 dark:text-stone-200">
                              {[entry.modeloVeiculo, entry.motoristaNome ? `Mot: ${entry.motoristaNome}` : '']
                                .filter(Boolean)
                                .join(' • ') || '—'}
                            </td>
                            <td className="py-1.5 px-3">
                              {carrierSuppliers.length > 0 ? (
                                <div className="inline-flex items-center gap-1">
                                  <Link2 className="w-3 h-3 text-slate-500 shrink-0" />
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleLinkUnlinkedPlateToCarrier(entry.id, e.target.value);
                                      }
                                    }}
                                    className="h-7 px-2 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-[10.5px] font-bold uppercase cursor-pointer"
                                  >
                                    <option value="">Vincular a transportadora...</option>
                                    {carrierSuppliers.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">Cadastre uma transportadora</span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openInlineEditPlate('__AVULSO__', entry)}
                                  className="p-1 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded cursor-pointer"
                                  title="Editar placa"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleDeletePlateEntry(entry);
                                  }}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  title="Excluir placa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal Reutilizável de Cadastro / Edição de Fornecedor & Transportadora */}
      <SupplierModal
        isOpen={isModalOpen}
        editingSupplier={editingSupplier}
        defaultCategory={modalDefaultCategory}
        initialTab={modalInitialTab}
        suppliersList={localSuppliers}
        onDeleteSupplier={handleDelete}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSupplier(null);
          setModalDefaultCategory('');
          setModalInitialTab('cadastro');
        }}
        onSave={(savedSup) => {
          const activeCompanyId = getActiveCompanyId();
          const index = localSuppliers.findIndex(s => s.id === savedSup.id);
          if (index >= 0) {
            const updated = [...localSuppliers];
            updated[index] = savedSup;
            const { items: normalized } = ensureSequentialSupplierCodes(updated);
            setLocalSuppliers(normalized);
            saveStoredSuppliers(normalized);
            onSaveSuppliers(normalized);
          } else {
            const updated = [savedSup, ...localSuppliers];
            const { items: normalized } = ensureSequentialSupplierCodes(updated);
            setLocalSuppliers(normalized);
            saveStoredSuppliers(normalized);
            onSaveSuppliers(normalized);
          }
          upsertFornecedor(savedSup, activeCompanyId).catch(err => console.warn('Supabase upsertFornecedor notice:', err));
        }}
      />

    </div>
  );
};
