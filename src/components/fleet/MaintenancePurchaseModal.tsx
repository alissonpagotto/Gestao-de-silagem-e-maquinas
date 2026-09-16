import React, { useState } from 'react';
import { 
  X, 
  ShoppingCart, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Plus, 
  Trash2, 
  Truck, 
  Search,
  Filter,
  Package
} from 'lucide-react';
import { MaintenancePurchaseRequest, MaintenanceLog, Machinery } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

interface MaintenancePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseRequests: MaintenancePurchaseRequest[];
  onSavePurchaseRequests: (updated: MaintenancePurchaseRequest[]) => void;
  maintenanceLogs: MaintenanceLog[];
  machineries: Machinery[];
}

export const MaintenancePurchaseModal: React.FC<MaintenancePurchaseModalProps> = ({
  isOpen,
  onClose,
  purchaseRequests,
  onSavePurchaseRequests,
  maintenanceLogs,
  machineries,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('todos');

  const filteredRequests = purchaseRequests.filter((req) => {
    const matchSearch =
      req.vehiclePlateOrName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.osNumber && req.osNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      req.items.some(it => it.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchStatus = selectedStatus === 'todos' || req.status === selectedStatus;
    const matchUrgency = selectedUrgency === 'todos' || req.urgency === selectedUrgency;

    return matchSearch && matchStatus && matchUrgency;
  });

  const handleUpdateStatus = (id: string, newStatus: MaintenancePurchaseRequest['status']) => {
    const updated = purchaseRequests.map(r => r.id === id ? { ...r, status: newStatus } : r);
    onSavePurchaseRequests(updated);
  };

  const handleDeleteRequest = (id: string) => {
    if (window.confirm('Deseja excluir esta solicitação de compra?')) {
      onSavePurchaseRequests(purchaseRequests.filter(r => r.id !== id));
    }
  };

  const getUrgencyBadge = (urgency: MaintenancePurchaseRequest['urgency']) => {
    switch (urgency) {
      case 'urgente_veiculo_parado':
        return { label: '🚨 Veículo Parado', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300' };
      case 'alta':
        return { label: '⚡ Alta Prioridade', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300' };
      case 'media':
        return { label: '⚖ Média', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300' };
      default:
        return { label: '☕ Baixa', color: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-300' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 text-amber-600 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                Solicitações de Compra & Cotações da Roça
              </h3>
              <p className="text-xs text-stone-500">
                Peças identificadas em manutenções e quebras de campo para o setor de compras cotar
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar peça, veículo, OS..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-semibold"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-semibold"
            >
              <option value="todos">Todos Status</option>
              <option value="cotacao">Em Cotação</option>
              <option value="aprovado">Aprovado</option>
              <option value="comprado">Comprado</option>
              <option value="entregue">Entregue</option>
            </select>

            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-semibold"
            >
              <option value="todos">Todas Urgências</option>
              <option value="urgente_veiculo_parado">🚨 Veículo Parado</option>
              <option value="alta">⚡ Alta</option>
              <option value="media">⚖ Média</option>
            </select>
          </div>
        </div>

        {/* Body / List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-stone-400 space-y-2">
              <Package className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-xs">Nenhuma solicitação de compra cadastrada no momento.</p>
              <p className="text-[11px] text-stone-500">
                Ao abrir uma Ordem de Serviço e marcar peças para cotação, elas aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const uBadge = getUrgencyBadge(req.urgency);
              return (
                <div 
                  key={req.id}
                  className="p-4 bg-white dark:bg-stone-800/70 rounded-2xl border border-stone-200 dark:border-stone-700/80 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-700 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                        {req.osNumber || 'OS s/n'}
                      </span>
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        {req.vehiclePlateOrName}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${uBadge.color}`}>
                        {uBadge.label}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Status Selector */}
                      <select
                        value={req.status}
                        onChange={(e) => handleUpdateStatus(req.id, e.target.value as any)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer ${
                          req.status === 'entregue'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : req.status === 'comprado'
                            ? 'bg-sky-50 text-sky-700 border-sky-300'
                            : req.status === 'aprovado'
                            ? 'bg-purple-50 text-purple-700 border-purple-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300'
                        }`}
                      >
                        <option value="cotacao">⏳ Em Cotação</option>
                        <option value="aprovado">👍 Aprovado</option>
                        <option value="comprado">🛒 Comprado (A Caminho)</option>
                        <option value="entregue">✓ Entregue na Roça</option>
                      </select>

                      <button
                        onClick={() => handleDeleteRequest(req.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="space-y-1.5 text-xs">
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">Itens para Comprar:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {req.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800">
                          <span className="font-semibold text-stone-800 dark:text-stone-200">
                            • {it.description}
                          </span>
                          <span className="font-mono font-bold text-stone-600 dark:text-stone-400">
                            {it.quantity} {it.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-stone-400 pt-1">
                    <span>Solicitado em: {formatDateBR(req.createdAt.split('T')[0])}</span>
                    <span className="text-stone-500">ID da OS: {req.osId}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold rounded-xl transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
