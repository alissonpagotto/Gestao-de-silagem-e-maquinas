import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  MessageCircle, 
  Edit3, 
  Trash2, 
  Scale, 
  Filter,
  CheckCircle2,
  Calendar,
  Sparkles,
  Layers,
  Printer
} from 'lucide-react';
import { Client, SilageOrder } from '../../types';
import { formatCurrencyBRL, formatDateBR, saveStoredClients, ensureSequentialClientCodes, getStoredAtividades, getCrmStatusLabel } from '../../lib/storage';
import { supabase } from '../../lib/supabaseClient';
import { fetchClientes, mapRowToClient, toValidUUID, isSupabaseConfigured } from '../../lib/supabaseService';
import { mapCattleTypeToAtividade } from './ClientModal';
import { printClientRegistrationA4 } from './clientPrintUtils';

interface CrmModuleProps {
  clients: Client[];
  orders: SilageOrder[];
  onNewClient: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onNewOrder: (clientId?: string) => void;
  onUpdateClientStatus: (clientId: string, status: Client['status']) => void;
  onSaveClients?: (clients: Client[]) => void;
}

export const CrmModule: React.FC<CrmModuleProps> = ({
  clients,
  orders,
  onNewClient,
  onEditClient,
  onDeleteClient,
  onNewOrder,
  onUpdateClientStatus,
  onSaveClients,
}) => {
  const [localClients, setLocalClients] = useState<Client[]>(() => ensureSequentialClientCodes(clients).items);

  useEffect(() => {
    if (clients) {
      const { items, changed } = ensureSequentialClientCodes(clients);
      setLocalClients(items);
      if (changed) {
        saveStoredClients(items);
      }
    }
  }, [clients]);

  const onSaveClientsRef = useRef(onSaveClients);
  useEffect(() => {
    onSaveClientsRef.current = onSaveClients;
  }, [onSaveClients]);

  const crmDebounceTimerRef = useRef<any>(null);

  // Sincronização em tempo real multi-dispositivos (Supabase Realtime) escutando 'clientes'
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;

    const debouncedFetchClients = () => {
      if (crmDebounceTimerRef.current) clearTimeout(crmDebounceTimerRef.current);
      crmDebounceTimerRef.current = setTimeout(async () => {
        try {
          const fresh = await fetchClientes();
          if (isMounted && fresh && Array.isArray(fresh)) {
            setLocalClients(fresh);
            saveStoredClients(fresh);
            onSaveClientsRef.current?.(fresh);
          }
        } catch (_) {}
      }, 400);
    };

    const channelId = 'crm_clients_rt';
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
        { event: '*', schema: 'public', table: 'clientes' },
        (payload: any) => {
          // 1. Atualização imediata
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setLocalClients(prev => {
                const updated = prev.filter(c => c.id !== deletedId && toValidUUID(c.id) !== deletedId);
                saveStoredClients(updated);
                onSaveClientsRef.current?.(updated);
                return updated;
              });
            }
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const mapped = mapRowToClient(payload.new);
            setLocalClients(prev => {
              const exists = prev.some(c => c.id === mapped.id || toValidUUID(c.id) === mapped.id);
              const updated = exists
                ? prev.map(c => (c.id === mapped.id || toValidUUID(c.id) === mapped.id) ? { ...c, ...mapped } : c)
                : [mapped, ...prev].sort((a, b) => (a.name || a.nome || '').localeCompare(b.name || b.nome || '', 'pt-BR'));
              saveStoredClients(updated);
              onSaveClientsRef.current?.(updated);
              return updated;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const mapped = mapRowToClient(payload.new);
            setLocalClients(prev => {
              const updated = prev.map(c => (c.id === mapped.id || toValidUUID(c.id) === mapped.id) ? { ...c, ...mapped } : c);
              saveStoredClients(updated);
              onSaveClientsRef.current?.(updated);
              return updated;
            });
          }

          // 2. Reconciliação debounced
          debouncedFetchClients();
        }
      )
      .subscribe();

    const handleFocus = () => {
      debouncedFetchClients();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      if (crmDebounceTimerRef.current) {
        clearTimeout(crmDebounceTimerRef.current);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAtividade, setSelectedAtividade] = useState<string>('todos');
  const [atividadesList, setAtividadesList] = useState<string[]>(() => getStoredAtividades());
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');

  // Sincronização reativa instantânea de 'agrocontrol_atividades'
  useEffect(() => {
    const syncAtividades = () => {
      setAtividadesList(getStoredAtividades());
    };
    window.addEventListener('agrocontrol_atividades_updated', syncAtividades);
    window.addEventListener('storage', syncAtividades);
    return () => {
      window.removeEventListener('agrocontrol_atividades_updated', syncAtividades);
      window.removeEventListener('storage', syncAtividades);
    };
  }, []);

  const filteredClients = localClients.filter((c) => {
    const q = searchTerm.trim().toLowerCase();
    const clientName = c.nome || c.name || '';
    const farmName = c.fazenda || c.farmName || '';
    const clientCode = (c.code || c.codigo || '').toLowerCase();
    const clientDoc = (c.cpfCnpj || '').toLowerCase();
    const matchSearch =
      !q ||
      clientCode.includes(q) ||
      clientName.toLowerCase().includes(q) ||
      farmName.toLowerCase().includes(q) ||
      clientDoc.includes(q) ||
      (c.city || c.cidade || '').toLowerCase().includes(q);

    if (!matchSearch) return false;
    if (selectedAtividade !== 'todos') {
      const clientAtiv = (c.atividade || (c.cattleType ? mapCattleTypeToAtividade(c.cattleType) : '')).trim().toUpperCase();
      if (clientAtiv !== selectedAtividade.trim().toUpperCase()) {
        return false;
      }
    }
    return true;
  });

  const getCattleBadge = (clientOrType: any) => {
    let text = '';
    if (typeof clientOrType === 'object' && clientOrType !== null) {
      text = clientOrType.atividade || (clientOrType.cattleType ? mapCattleTypeToAtividade(clientOrType.cattleType) : 'MISTO/OUTRO');
    } else if (typeof clientOrType === 'string') {
      text = mapCattleTypeToAtividade(clientOrType);
    } else {
      text = 'MISTO/OUTRO';
    }
    const upper = (text || 'MISTO/OUTRO').toUpperCase();

    let colorClass = 'bg-slate-100 text-slate-700 border-slate-300';
    if (upper.includes('LEITE')) {
      colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
    } else if (upper.includes('CONFINAMENTO')) {
      colorClass = 'bg-amber-100 text-amber-800 border-amber-200';
    } else if (upper.includes('CORTE') || upper.includes('CRIA') || upper.includes('RECRU')) {
      colorClass = 'bg-rose-100 text-rose-800 border-rose-200';
    } else if (upper.includes('LAVOURA') || upper.includes('MILHO') || upper.includes('SOJA')) {
      colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    } else if (upper.includes('SUINO') || upper.includes('AVES') || upper.includes('EQUINO')) {
      colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${colorClass}`}>
        {upper}
      </span>
    );
  };

  const getWhatsAppLink = (client: Client) => {
    const rawPhone = client.phone || client.telefone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const clientName = client.nome || client.name || 'Produtor';
    const farmName = client.fazenda || client.farmName || 'sua propriedade';
    const text = encodeURIComponent(
      `Olá ${clientName}! Sou da equipe da Silagem Fácil. Gostaria de verificar como estão os estoques de silagem na ${farmName} e alinhar o próximo fornecimento.`
    );
    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  };

  // Pipeline columns
  const columns: { id: Client['status']; title: string; color: string }[] = [
    { id: 'lead', title: 'Leads & Contatos', color: 'border-stone-300 bg-stone-50/70' },
    { id: 'contatado', title: 'Em Negociação', color: 'border-blue-300 bg-blue-50/40' },
    { id: 'proposta', title: 'Proposta / Cotação', color: 'border-amber-300 bg-amber-50/40' },
    { id: 'cliente_ativo', title: 'Clientes Ativos', color: 'border-emerald-300 bg-emerald-50/40' },
  ];

  return (
    <div className="w-full max-w-none flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden p-2 sm:p-3">
      
      {/* Top Banner / Summary */}
      <div className="shrink-0 crm-card bg-[#cad4e6] dark:bg-stone-900 p-2 sm:p-2.5 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 text-black dark:text-white">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-black text-black dark:text-stone-100 uppercase tracking-tight">
              Carteira de Clientes
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-[#e0e6f1] dark:bg-stone-800 text-black dark:text-stone-300 border border-black dark:border-stone-700 text-[10px] font-bold">
              {filteredClients.filter(c => c.status === 'cliente_ativo').length} Clientes ativos
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          
          {/* Switch Kanban / List - Moldura Acetinada 3D */}
          <div 
            aria-label="Abas de Visualização de Clientes"
            className="flex items-center gap-1 p-1 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-xl border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.08),inset_-1px_-1px_0px_rgba(0,0,0,0.3)] text-xs"
          >
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                viewMode === 'kanban' 
                  ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600' 
                  : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60'
              }`}
            >
              Funil Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                viewMode === 'list' 
                  ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-xs border border-zinc-400 dark:border-stone-600' 
                  : 'text-zinc-700 dark:text-stone-400 hover:text-zinc-900 dark:hover:text-stone-200 hover:bg-zinc-300/60 dark:hover:bg-stone-800/60'
              }`}
            >
              Lista
            </button>
          </div>

          <button
            type="button"
            onClick={onNewClient}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Novo Cliente</span>
          </button>

        </div>
      </div>

      {/* Filters Bar */}
      <div className="shrink-0 bg-[#cad4e6] dark:bg-stone-900 p-2 rounded-lg border border-black dark:border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código (0001), nome, estabelecimento, CPF/CNPJ ou cidade..."
            className="w-full pl-7 pr-3 py-1 bg-white dark:bg-stone-800/50 rounded-lg border border-slate-400 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs text-black"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-black dark:text-stone-300 font-bold text-xs uppercase">Atividade:</span>
          <select
            value={selectedAtividade}
            onChange={(e) => setSelectedAtividade(e.target.value)}
            className="px-2 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 font-bold text-black dark:text-stone-200 text-xs cursor-pointer focus:ring-1 focus:ring-emerald-500"
          >
            <option value="todos">Todas as Atividades</option>
            {atividadesList.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {columns.map((col) => {
            const colClients = filteredClients.filter((c) => c.status === col.id);
            const totalDemand = colClients.reduce((acc, c) => acc + (c.monthlyDemandTons || 0), 0);

            return (
              <div key={col.id} className="rounded-lg border border-black bg-[#e0e6f1] p-3 flex flex-col min-h-[320px]">
                
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200/80 dark:border-stone-700">
                  <div>
                    <h3 className="font-extrabold text-stone-900 dark:text-white text-[11px] uppercase tracking-wider">
                      {col.title}
                    </h3>
                    <span className="text-[10px] text-stone-700 dark:text-stone-400 font-bold">
                      Demanda: <strong className="text-black dark:text-white">{totalDemand} ton/mês</strong>
                    </span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white dark:bg-stone-800 font-black text-black dark:text-white text-[10px] flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs">
                    {colClients.length}
                  </span>
                </div>

                {/* Cards in column */}
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {colClients.map((client) => {
                    const clientOrders = orders.filter((o) => o.clientId === client.id);

                    return (
                      <div
                        key={client.id}
                        className="crm-card bg-[#87AFE3] dark:bg-stone-900 p-2.5 rounded-xl border border-slate-400 dark:border-stone-700 shadow-2xs hover:shadow-xs transition space-y-2 text-black dark:text-white"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              {(client.code || client.codigo) && (
                                <span className="px-1.5 py-0.2 rounded bg-white/90 text-slate-900 border border-slate-400 font-mono text-[9.5px] font-black shrink-0">
                                  #{client.code || client.codigo}
                                </span>
                              )}
                              <span className="block font-black text-black dark:text-white text-xs">{client.nome || client.name}</span>
                            </div>
                            <span className="text-[11px] text-black/90 dark:text-stone-300 font-bold">{client.fazenda || client.farmName}</span>
                            {client.stateRegistration && (
                              <span className="block text-[9px] text-black/80 dark:text-stone-300 font-semibold">
                                IE/CADPRO: {client.stateRegistration}
                              </span>
                            )}
                          </div>
                          {getCattleBadge(client)}
                        </div>

                        <div className="text-[10px] text-black space-y-0.5 bg-white/80 dark:bg-stone-800/80 p-1.5 rounded-lg border border-slate-300 dark:border-stone-700">
                          <div className="flex items-center justify-between">
                            <span className="text-black/80 dark:text-stone-400 font-bold">Localização:</span>
                            <strong className="text-black dark:text-white font-black">{client.city}/{client.state}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-black/80 dark:text-stone-400 font-bold shrink-0">Porte / Rebanho:</span>
                            <strong className="text-black dark:text-white font-black truncate">
                              {client.porteCapacidade && /[^\d]/.test(client.porteCapacidade)
                                ? client.porteCapacidade
                                : `${client.headCount || 0} cab.`}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-black/80 dark:text-stone-400 font-bold shrink-0">Demanda / Potencial:</span>
                            <strong className="text-black dark:text-emerald-400 font-black truncate">
                              {client.potencialCompraMensal && /[^\d.,]/.test(client.potencialCompraMensal)
                                ? client.potencialCompraMensal
                                : `${client.monthlyDemandTons || 0} ton/mês`}
                            </strong>
                          </div>
                        </div>

                        {/* WhatsApp & Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-400/60 dark:border-stone-700 text-xs">
                          {client.phone ? (
                            <a
                              href={getWhatsAppLink(client)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1 text-black dark:text-emerald-300 hover:underline font-black bg-white/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-emerald-800 text-[10px]"
                            >
                              <MessageCircle className="w-3 h-3 text-black dark:text-emerald-400" />
                              <span>WhatsApp</span>
                            </a>
                          ) : (
                            <span className="text-black/70 dark:text-stone-400 text-[10px] font-semibold">Sem tel</span>
                          )}

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => onEditClient(client)}
                              className="p-1 text-black dark:text-stone-400 hover:bg-black/10 rounded cursor-pointer"
                              title="Editar"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteClient(client.id)}
                              className="p-1 text-rose-700 dark:text-rose-400 hover:bg-rose-100 rounded cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Stage Selector */}
                        <div className="pt-1">
                          <select
                            value={client.status}
                            onChange={(e) => onUpdateClientStatus(client.id, e.target.value as any)}
                            className="w-full text-[10px] py-1 px-1.5 rounded-lg bg-white/80 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-bold text-black dark:text-stone-200 focus:ring-1 focus:ring-sky-600 cursor-pointer"
                          >
                            <option value="lead">Mover para: Lead</option>
                            <option value="contatado">Mover para: Em Negociação</option>
                            <option value="proposta">Mover para: Cotação</option>
                            <option value="cliente_ativo">Mover para: Ativo</option>
                          </select>
                        </div>

                      </div>
                    );
                  })}

                  {colClients.length === 0 && (
                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-stone-200 rounded-xl text-stone-400 text-xs">
                      Nenhum produtor nesta etapa
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* List View - Formato Linha Única Slim Estrita */
        <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-lg overflow-hidden shadow-2xs">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#e0e6f1] dark:bg-stone-900">
            <table className="w-full text-left text-xs text-black dark:text-stone-200 border-collapse">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-black dark:text-stone-200 font-black border-b border-black dark:border-stone-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2.5 border-b border-black">Cliente & Estabelecimento</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2.5 border-b border-black">Cidade / UF</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2.5 border-b border-black">Atividade / Porte</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2.5 border-b border-black">Demanda / Potencial</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2.5 border-b border-black">Status</th>
                  <th className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 py-1.5 px-2.5 border-b border-black text-right">Ações</th>
                </tr>
              </thead>
            <tbody className="font-medium bg-[#e0e6f1] dark:bg-stone-900">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs font-semibold text-slate-700 dark:text-stone-400 uppercase bg-[#e0e6f1] dark:bg-stone-900">
                    NENHUM REGISTRO ENCONTRADO
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const clientServices = client.interestedServices || client.servicosInteresse || [];
                  const hasCustomPorte = Boolean(client.porteCapacidade && /[^\d]/.test(client.porteCapacidade));
                  const hasCustomPotencial = Boolean(client.potencialCompraMensal && /[^\d.,]/.test(client.potencialCompraMensal));
                  return (
                  <tr key={client.id} className="bg-[#e0e6f1] hover:bg-[#d2dced] dark:bg-stone-900 dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800">
                    {/* Nome, Estabelecimento e badges discretas dos serviços de interesse abaixo */}
                    <td className="py-1 px-2.5 align-middle">
                      <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                        {(client.code || client.codigo) && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-stone-200 border border-slate-300 dark:border-stone-700 font-mono text-[10px] font-black shrink-0">
                            #{client.code || client.codigo}
                          </span>
                        )}
                        <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                          {client.nome || client.name}
                        </span>
                        {(client.fazenda || client.farmName) && (
                          <span className="text-[10px] text-slate-500 dark:text-stone-400 font-medium truncate">
                            • {client.fazenda || client.farmName}
                          </span>
                        )}
                        {client.stateRegistration && (
                          <span className="text-[9.5px] px-1 py-0.2 rounded bg-slate-100 dark:bg-stone-800 text-slate-600 dark:text-stone-400 border border-slate-200 dark:border-stone-700 shrink-0">
                            IE: {client.stateRegistration}
                          </span>
                        )}
                      </div>
                      {clientServices.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {clientServices.map((srv) => (
                            <span
                              key={srv}
                              className="px-1.5 py-0 rounded text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            >
                              {srv}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-1 px-2.5 whitespace-nowrap text-xs text-zinc-700 dark:text-stone-300 align-middle">
                      {client.city}/{client.state}
                    </td>
                    <td className="py-1 px-2.5 align-middle">
                      <div className="flex items-center space-x-1.5 whitespace-nowrap">
                        {getCattleBadge(client)}
                        <span className="text-slate-500 dark:text-stone-400 text-[11px] font-medium truncate max-w-[180px]">
                          {hasCustomPorte ? client.porteCapacidade : `${client.headCount || 0} cab.`}
                        </span>
                      </div>
                    </td>
                    <td className="py-1 px-2.5 whitespace-nowrap align-middle">
                      <strong className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                        {hasCustomPotencial ? client.potencialCompraMensal : `${client.monthlyDemandTons || 0} ton/mês`}
                      </strong>
                    </td>
                    <td className="py-1 px-2.5 whitespace-nowrap align-middle">
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold border border-slate-300 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-zinc-700 dark:text-stone-300">
                        {getCrmStatusLabel(client.status)}
                      </span>
                    </td>
                    <td className="py-1 px-2.5 text-right whitespace-nowrap align-middle">
                      <div className="flex items-center justify-end space-x-1">
                        {client.phone && (
                          <a
                            href={getWhatsAppLink(client)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition cursor-pointer"
                            title="Conversar no WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            void printClientRegistrationA4(client);
                          }}
                          className="p-1 text-slate-600 dark:text-stone-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-stone-800 rounded transition cursor-pointer"
                          title="Imprimir Ficha Cadastral"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditClient(client)}
                          className="p-1 text-slate-600 dark:text-stone-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteClient(client.id)}
                          className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

    </div>
  );
};
