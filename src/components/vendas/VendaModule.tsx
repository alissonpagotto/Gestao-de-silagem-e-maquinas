import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart,
  Search,
  Plus,
  ChevronDown,
  X,
  Trash2,
  Pencil,
  TrendingUp,
  Scale,
  DollarSign,
  FileCheck2
} from 'lucide-react';
import { ServiceOrder, Machinery, Employee, Client, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { useConfirm } from '../../context/ConfirmContext';
import { ServiceFormModal } from '../services/ServiceFormModal';

interface VendaModuleProps {
  services?: ServiceOrder[];
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onSaveServices?: (services: ServiceOrder[]) => void;
  onSaveClients?: (clients: Client[]) => void;
}

export const VendaModule: React.FC<VendaModuleProps> = ({
  services = [],
  machineries = [],
  employees = [],
  clients = [],
  companyProfile,
  onSaveServices,
  onSaveClients,
}) => {
  const { confirm } = useConfirm();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Modal State for "+ Nova Venda" & Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ServiceOrder | null>(null);

  // Filtragem exclusiva de Vendas (serviceTab === 'venda' ou serviceType com 'venda')
  const salesRecords = useMemo(() => {
    return services.filter((srv) => {
      const typeStr = (srv.serviceType || '').toLowerCase();
      const tabStr = (srv.serviceTab || '').toLowerCase();
      return typeStr.includes('venda') || tabStr === 'venda';
    });
  }, [services]);

  // Vendas filtradas por busca e status
  const filteredSales = useMemo(() => {
    return salesRecords.filter((srv) => {
      // Filtro de status
      if (statusFilter !== 'todos' && srv.status !== statusFilter) {
        return false;
      }

      // Filtro por busca
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesClient = (srv.clientName || '').toLowerCase().includes(query);
        const matchesFarm = (srv.farmName || '').toLowerCase().includes(query);
        const matchesNumber = (srv.orderNumber || srv.id || '').toLowerCase().includes(query);
        if (!matchesClient && !matchesFarm && !matchesNumber) return false;
      }

      return true;
    });
  }, [salesRecords, statusFilter, searchTerm]);

  // Indicadores (KPIs)
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalTons = 0;
    let completedCount = 0;

    salesRecords.forEach((s) => {
      totalRevenue += s.totalAmount || 0;
      if (s.tonsEstimated) {
        totalTons += s.tonsEstimated;
      } else if (s.areaQuantity && s.areaUnit === 'hectares') {
        totalTons += s.areaQuantity;
      }
      if (s.status === 'concluido') {
        completedCount += 1;
      }
    });

    const averageTicket = salesRecords.length > 0 ? totalRevenue / salesRecords.length : 0;

    return {
      totalRevenue,
      totalTons,
      totalCount: salesRecords.length,
      completedCount,
      averageTicket,
    };
  }, [salesRecords]);

  // Abrir Modal para Nova Venda
  const handleOpenNew = () => {
    setEditRecord(null);
    setIsModalOpen(true);
  };

  // Abrir Modal para Editar Venda
  const handleOpenEdit = (record: ServiceOrder) => {
    setEditRecord(record);
    setIsModalOpen(true);
  };

  // Salvar Venda (Novo ou Editado)
  const handleSaveService = (savedService: ServiceOrder) => {
    if (!onSaveServices) return;

    // Garantir que a ordem fique gravada como Venda
    const recordToSave: ServiceOrder = {
      ...savedService,
      serviceTab: 'venda',
      serviceType: savedService.serviceType || 'Venda de Silagem',
    };

    const exists = services.some((s) => s.id === recordToSave.id);
    if (exists) {
      onSaveServices(services.map((s) => (s.id === recordToSave.id ? recordToSave : s)));
    } else {
      onSaveServices([recordToSave, ...services]);
    }

    setEditRecord(recordToSave);
  };

  // Excluir Venda
  const handleDeleteService = async (id: string, clientName: string) => {
    const isConfirmed = await confirm({
      title: 'Excluir Venda',
      message: `Deseja realmente remover o registro de venda para "${clientName}"?`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed && onSaveServices) {
      onSaveServices(services.filter((s) => s.id !== id));
    }
  };

  return (
    <div 
      id="venda-module-root"
      className="w-full max-w-none min-h-screen bg-[#2e65aa] text-black antialiased p-3 sm:p-4 lg:p-6 space-y-3.5 rounded-2xl shadow-md"
      style={{ backgroundColor: '#2e65aa' }}
    >
      {/* 1. CABEÇALHO */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/20 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-lg text-white">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Venda
              </h1>
              <p className="text-xs text-blue-100 font-medium">
                Gestão e controle de vendas agrícolas, fornecimento de silagem e contratos.
              </p>
            </div>
          </div>
        </div>

        {/* Botão Nova Venda */}
        <div className="flex items-center gap-2">
          <button
            id="btn-nova-venda"
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-sm transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Nova Venda</span>
          </button>
        </div>
      </header>

      {/* 2. CARDS DE INDICADORES (KPIS) */}
      <section aria-label="Indicadores de Vendas" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-lg p-2.5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Total Faturado</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
          </div>
          <div className="text-lg sm:text-xl font-black mt-1">
            {formatCurrencyBRL(metrics.totalRevenue)}
          </div>
          <span className="text-[10px] text-blue-100 font-medium">Todas as vendas registradas</span>
        </div>

        <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-lg p-2.5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Volume Total</span>
            <Scale className="w-3.5 h-3.5 text-amber-300" />
          </div>
          <div className="text-lg sm:text-xl font-black mt-1">
            {metrics.totalTons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span className="text-xs font-bold">Ton</span>
          </div>
          <span className="text-[10px] text-blue-100 font-medium">Silagem comercializada</span>
        </div>

        <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-lg p-2.5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Contratos / Pedidos</span>
            <FileCheck2 className="w-3.5 h-3.5 text-sky-300" />
          </div>
          <div className="text-lg sm:text-xl font-black mt-1">
            {metrics.totalCount} <span className="text-xs font-semibold text-blue-200">({metrics.completedCount} concl.)</span>
          </div>
          <span className="text-[10px] text-blue-100 font-medium">Volume de operações</span>
        </div>

        <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-lg p-2.5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">Ticket Médio</span>
            <TrendingUp className="w-3.5 h-3.5 text-indigo-300" />
          </div>
          <div className="text-lg sm:text-xl font-black mt-1">
            {formatCurrencyBRL(metrics.averageTicket)}
          </div>
          <span className="text-[10px] text-blue-100 font-medium">Média por venda</span>
        </div>
      </section>

      {/* 3. BARRA DE FILTROS */}
      <section 
        aria-label="Filtros de Vendas"
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full"
      >
        {/* Campo de Busca */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente, fazenda ou nº da venda..."
            className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm text-black font-semibold placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-2xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-500 hover:text-black cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown de Status */}
        <div className="relative sm:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-1.5 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm font-bold text-black focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-2xs cursor-pointer"
          >
            <option value="todos" className="text-black font-semibold">Todos os Status</option>
            <option value="agendado" className="text-black font-semibold">Agendado</option>
            <option value="em_andamento" className="text-black font-semibold">Em Andamento</option>
            <option value="concluido" className="text-black font-semibold">Concluído</option>
            <option value="cancelado" className="text-black font-semibold">Cancelado</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-gray-500">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </section>

      {/* 4. TABELA DE VENDAS */}
      <section 
        aria-label="Lista de Vendas"
        className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl shadow-md overflow-hidden"
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-blue-200/80 dark:border-stone-800 bg-[#87AFE3] dark:bg-stone-900">
                <th scope="col" className="px-3 py-1.5 text-xs font-black text-black dark:text-white uppercase tracking-wider w-16">
                  Nº
                </th>
                <th scope="col" className="px-3 py-1.5 text-xs font-black text-black dark:text-white uppercase tracking-wider">
                  CLIENTE
                </th>
                <th scope="col" className="px-3 py-1.5 text-xs font-black text-black dark:text-white uppercase tracking-wider">
                  DATA DA VENDA
                </th>
                <th scope="col" className="px-3 py-1.5 text-xs font-black text-black dark:text-white uppercase tracking-wider text-center">
                  TONELADAS / QTD
                </th>
                <th scope="col" className="px-3 py-1.5 text-xs font-black text-black dark:text-white uppercase tracking-wider text-center">
                  STATUS
                </th>
                <th scope="col" className="px-3 py-1.5 text-xs font-black text-black dark:text-white uppercase tracking-wider text-right">
                  TOTAL
                </th>
                <th scope="col" className="px-2.5 py-1.5 text-xs font-black text-black dark:text-white uppercase tracking-wider text-right w-20">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800 bg-[#87AFE3] dark:bg-stone-900">
              {filteredSales.length === 0 ? (
                <tr className="bg-[#87AFE3] dark:bg-stone-900">
                  <td colSpan={7} className="px-4 py-8 text-center bg-[#87AFE3] dark:bg-stone-900">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-2 bg-blue-100 rounded-full text-blue-700">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-black dark:text-white">
                        Nenhuma venda encontrada
                      </p>
                      <p className="text-[11px] text-black/70 dark:text-stone-300 max-w-sm">
                        {searchTerm || statusFilter !== 'todos' 
                          ? 'Tente ajustar os filtros ou o termo de busca para visualizar os registros.' 
                          : 'Cadastre a primeira venda de silagem clicando no botão abaixo.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenNew}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Cadastrar Venda</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale, index) => {
                  const itemNumber = (index + 1).toString().padStart(3, '0');
                  const statusColors: Record<string, string> = {
                    agendado: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
                    em_andamento: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
                    concluido: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
                    cancelado: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
                  };

                  const statusLabels: Record<string, string> = {
                    agendado: 'Agendado',
                    em_andamento: 'Em Andamento',
                    concluido: 'Concluído',
                    cancelado: 'Cancelado',
                  };

                  const currentStatus = sale.status || 'agendado';

                  // Quantidade de Toneladas
                  let quantityDisplay = '--';
                  if (sale.tonsEstimated) {
                    quantityDisplay = `${sale.tonsEstimated.toLocaleString('pt-BR')} Ton`;
                  } else if (sale.areaQuantity) {
                    quantityDisplay = `${sale.areaQuantity} ${sale.areaUnit || 'un'}`;
                  }

                  return (
                    <tr 
                      key={sale.id}
                      className="bg-[#87AFE3] dark:bg-stone-900 hover:bg-blue-200/50 dark:hover:bg-stone-800 transition-colors duration-150 group border-b border-blue-200/60 dark:border-stone-800"
                    >
                      {/* Nº */}
                      <td className="px-3 py-1.5 text-xs font-mono text-black font-bold">
                        #{itemNumber}
                      </td>

                      {/* Cliente */}
                      <td className="px-3 py-1.5">
                        <div className="font-bold text-black text-sm leading-snug">
                          {sale.clientName}
                        </div>
                        {sale.farmName && (
                          <div className="text-[11px] text-black font-semibold">
                            {sale.farmName}
                          </div>
                        )}
                        {sale.orderNumber && (
                          <div className="text-[11px] text-blue-950 font-medium">
                            Pedido: {sale.orderNumber}
                          </div>
                        )}
                      </td>

                      {/* Data */}
                      <td className="px-3 py-1.5 text-xs text-black font-semibold whitespace-nowrap">
                        {sale.startDate ? formatDateBR(sale.startDate) : '--'}
                      </td>

                      {/* Quantidade / Toneladas */}
                      <td className="px-3 py-1.5 text-xs text-center text-black font-black whitespace-nowrap">
                        {quantityDisplay}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-1.5 text-center whitespace-nowrap">
                        <span 
                          className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold border ${
                            statusColors[currentStatus] || 'bg-gray-100 text-black border-gray-300'
                          }`}
                        >
                          {statusLabels[currentStatus] || currentStatus}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-1.5 text-right font-black text-black text-xs sm:text-sm whitespace-nowrap">
                        {formatCurrencyBRL(sale.totalAmount || 0)}
                      </td>

                      {/* Ações */}
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(sale)}
                            className="p-1 text-black hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                            title="Editar venda"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(sale.id, sale.clientName)}
                            className="p-1 text-black hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Excluir venda"
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
      </section>

      {/* 5. MODAL DE CADASTRO / EDIÇÃO */}
      <ServiceFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditRecord(null);
        }}
        onSave={handleSaveService}
        activeTab="venda"
        clients={clients}
        machineries={machineries}
        employees={employees}
        companyProfile={companyProfile}
        nextNumber={`#VND-${String(salesRecords.length + 1).padStart(3, '0')}`}
        editRecord={editRecord}
        onSaveClient={(newClient) => {
          if (onSaveClients) {
            onSaveClients([newClient, ...clients]);
          }
        }}
      />
    </div>
  );
};

export default VendaModule;
