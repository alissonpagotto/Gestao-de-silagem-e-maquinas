import React, { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  CheckSquare, 
  Square, 
  Calendar, 
  CheckCircle2, 
  Database,
  Tractor,
  DollarSign,
  ShoppingCart,
  Fuel,
  Users
} from 'lucide-react';
import { 
  Expense, 
  SilageOrder, 
  ServiceOrder, 
  FuelLog, 
  Client, 
  Machinery 
} from '../../types';
import { formatDateBR, formatCurrencyBRL } from '../../lib/storage';

interface ReportsExportTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  fuelLogs?: FuelLog[];
  clients?: Client[];
  machineries?: Machinery[];
  startDate: string;
  endDate: string;
}

export const ReportsExportTab: React.FC<ReportsExportTabProps> = ({
  expenses,
  orders,
  services,
  fuelLogs = [],
  clients = [],
  machineries = [],
  startDate,
  endDate,
}) => {
  const [selectedModules, setSelectedModules] = useState<{
    expenses: boolean;
    orders: boolean;
    services: boolean;
    fuel: boolean;
    clients: boolean;
  }>({
    expenses: true,
    orders: true,
    services: true,
    fuel: true,
    clients: false,
  });

  const toggleModule = (key: keyof typeof selectedModules) => {
    setSelectedModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportConsolidatedCsv = () => {
    let csvContent = '';

    if (selectedModules.expenses) {
      csvContent += '=== DESPESAS E CUSTOS OPERACIONAIS ===\n';
      csvContent += 'Vencimento,Descricao,Categoria,Fornecedor,Centro_Custo,Maquina,Valor_R$,Status,Data_Pagamento\n';
      const filteredExp = expenses.filter(e => e.dueDate >= startDate && e.dueDate <= endDate);
      filteredExp.forEach(e => {
        csvContent += `"${e.dueDate}","${e.description}","${e.categoryName}","${e.supplier || ''}","${e.costCenterName || ''}","${e.machineryName || ''}","${e.amount}","${e.status}","${e.paymentDate || ''}"\n`;
      });
      csvContent += '\n';
    }

    if (selectedModules.orders) {
      csvContent += '=== VENDAS DE SILAGEM ===\n';
      csvContent += 'Data_Entrega,Numero_Pedido,Cliente,Fazenda,Produto,Toneladas,Preco_Ton_R$,Total_Faturado_R$,Frete,Status_Pagto\n';
      const filteredOrd = orders.filter(o => o.deliveryDate >= startDate && o.deliveryDate <= endDate && o.status !== 'cancelado');
      filteredOrd.forEach(o => {
        csvContent += `"${o.deliveryDate}","${o.orderNumber || o.id}","${o.clientName}","${o.farmName || ''}","${o.productType}","${o.tons}","${o.pricePerTon}","${o.totalAmount}","${o.freightType}","${o.paymentStatus}"\n`;
      });
      csvContent += '\n';
    }

    if (selectedModules.services) {
      csvContent += '=== PRESTACAO DE SERVICOS / CORTES ===\n';
      csvContent += 'Data_Inicio,Cliente,Fazenda,Servico,Area_Hectares,Toneladas_Estimadas,Maquina,Operador,Total_R$,Status\n';
      const filteredServ = services.filter(s => s.startDate >= startDate && s.startDate <= endDate && s.status !== 'cancelado');
      filteredServ.forEach(s => {
        csvContent += `"${s.startDate}","${s.clientName}","${s.farmName || ''}","${s.serviceType}","${s.areaHectares || 0}","${s.tonsEstimated || 0}","${s.machineryAssigned || ''}","${s.operatorAssigned || ''}","${s.totalAmount}","${s.status}"\n`;
      });
      csvContent += '\n';
    }

    if (selectedModules.fuel) {
      csvContent += '=== CONSUMO DE COMBUSTIVEL (DIESEL) ===\n';
      csvContent += 'Data,Maquina_Veiculo,Combustivel,Litros,Preco_Litro_R$,Total_Gasto_R$,Horimetro_KM,Operador,Posto_Fornecedor\n';
      const filteredFuel = fuelLogs.filter(l => l.date >= startDate && l.date <= endDate);
      filteredFuel.forEach(l => {
        csvContent += `"${l.date}","${l.machineryPlateOrName}","${l.fuelType}","${l.liters}","${l.pricePerLiter}","${l.totalAmount}","${l.currentHourMeterOrKm}","${l.driverOrOperator || ''}","${l.supplierStation || ''}"\n`;
      });
      csvContent += '\n';
    }

    if (selectedModules.clients) {
      csvContent += '=== CADASTRO DE CLIENTES ===\n';
      csvContent += 'Nome_Produtor,Fazenda,Telefone,Cidade_UF,Rebanho,Status\n';
      clients.forEach(c => {
        csvContent += `"${c.name}","${c.farmName || ''}","${c.phone}","${c.city}/${c.state}","${c.cattleType}","${c.status}"\n`;
      });
      csvContent += '\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_consolidado_silagem_${startDate}_a_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Exportação para Planilhas Excel / CSV
            </h3>
            <p className="text-xs text-stone-500">
              Selecione os módulos e dados que deseja compilar em um único arquivo de dados para auditoria ou contabilidade.
            </p>
          </div>
        </div>
      </div>

      {/* Module Selection */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-500">
          Selecione os Módulos para Exportação
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          
          <div 
            onClick={() => toggleModule('expenses')}
            className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              selectedModules.expenses 
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200' 
                : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-stone-600 dark:text-stone-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              <DollarSign className="w-4 h-4 text-rose-500" />
              <div>
                <div className="text-xs font-bold">Despesas & Custos</div>
                <div className="text-[10px] text-stone-400">{expenses.length} lançamentos</div>
              </div>
            </div>
            {selectedModules.expenses ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-stone-400" />
            )}
          </div>

          <div 
            onClick={() => toggleModule('orders')}
            className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              selectedModules.orders 
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200' 
                : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-stone-600 dark:text-stone-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="text-xs font-bold">Vendas de Silagem</div>
                <div className="text-[10px] text-stone-400">{orders.length} pedidos</div>
              </div>
            </div>
            {selectedModules.orders ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-stone-400" />
            )}
          </div>

          <div 
            onClick={() => toggleModule('services')}
            className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              selectedModules.services 
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200' 
                : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-stone-600 dark:text-stone-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Tractor className="w-4 h-4 text-teal-600" />
              <div>
                <div className="text-xs font-bold">Serviços & Cortes</div>
                <div className="text-[10px] text-stone-400">{services.length} serviços</div>
              </div>
            </div>
            {selectedModules.services ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-stone-400" />
            )}
          </div>

          <div 
            onClick={() => toggleModule('fuel')}
            className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              selectedModules.fuel 
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200' 
                : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-stone-600 dark:text-stone-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Fuel className="w-4 h-4 text-amber-500" />
              <div>
                <div className="text-xs font-bold">Consumo de Combustível</div>
                <div className="text-[10px] text-stone-400">{fuelLogs.length} abastecimentos</div>
              </div>
            </div>
            {selectedModules.fuel ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-stone-400" />
            )}
          </div>

          <div 
            onClick={() => toggleModule('clients')}
            className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
              selectedModules.clients 
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200' 
                : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-stone-600 dark:text-stone-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Users className="w-4 h-4 text-sky-500" />
              <div>
                <div className="text-xs font-bold">Base de Clientes</div>
                <div className="text-[10px] text-stone-400">{clients.length} produtores</div>
              </div>
            </div>
            {selectedModules.clients ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-stone-400" />
            )}
          </div>

        </div>

        <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-stone-500">
            Período selecionado: <strong>{formatDateBR(startDate)}</strong> até <strong>{formatDateBR(endDate)}</strong>
          </div>

          <button
            type="button"
            onClick={handleExportConsolidatedCsv}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-[#009688] hover:bg-[#00796b] text-white font-extrabold text-xs transition shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Planilha Excel / CSV Consolidada</span>
          </button>
        </div>

      </div>

    </div>
  );
};
