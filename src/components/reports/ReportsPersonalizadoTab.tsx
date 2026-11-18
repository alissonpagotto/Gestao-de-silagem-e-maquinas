import React, { useState, useMemo, useEffect } from 'react';
import {
  SlidersHorizontal,
  Search,
  Printer,
  Download,
  CheckSquare,
  Square,
  Database,
} from 'lucide-react';
import {
  CompanyProfile,
  Employee,
  Expense,
  FinanceiroCheque,
  FuelLog,
  InventoryItem,
  Machinery,
  NotaSaidaRecord,
  ServiceOrder,
  SilageOrder,
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredFinanceiroCheques,
  getStoredNotasSaida,
} from '../../lib/storage';
import { getPaymentMethodLabel } from '../financial/ReceivablesTab';
import {
  AdHocColumnDef,
  buildAdHocCustomReport,
  ReportPrintConfig,
} from './reportPrintBuilders';

export type AdHocDatasetKey =
  | 'pagar'
  | 'receber'
  | 'cheques'
  | 'despesas'
  | 'vendas'
  | 'servicos'
  | 'estoque'
  | 'abastecimentos'
  | 'frota'
  | 'rh';

interface DatasetSchema {
  key: AdHocDatasetKey;
  label: string;
  hasDateRange: boolean;
  statusOptions: Array<{ value: string; label: string }>;
  columns: AdHocColumnDef[];
}

const DATASET_SCHEMAS: DatasetSchema[] = [
  {
    key: 'pagar',
    label: 'Contas a Pagar',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'pago', label: 'Pago' },
      { value: 'pendente', label: 'Em Aberto / Pendente' },
    ],
    columns: [
      { key: 'dueDate', label: 'Vencimento', format: 'date' },
      { key: 'supplier', label: 'Fornecedor', format: 'text' },
      { key: 'description', label: 'Descrição', format: 'text' },
      { key: 'categoryName', label: 'Categoria', format: 'text' },
      { key: 'paymentMethod', label: 'Forma Pagto.', format: 'text' },
      { key: 'amount', label: 'Valor (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'receber',
    label: 'Contas a Receber',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'pago', label: 'Recebido' },
      { value: 'pendente', label: 'Em Aberto' },
    ],
    columns: [
      { key: 'dueDate', label: 'Vencimento', format: 'date' },
      { key: 'clientName', label: 'Cliente', format: 'text' },
      { key: 'origin', label: 'Origem', format: 'text' },
      { key: 'description', label: 'Referência', format: 'text' },
      { key: 'paymentMethod', label: 'Forma Pagto.', format: 'text' },
      { key: 'amount', label: 'Valor (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'cheques',
    label: 'Cheques',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'EM_NOSSO_PODER', label: 'A Compensar' },
      { value: 'COMPENSADO', label: 'Compensado' },
      { value: 'DEVOLVIDO', label: 'Devolvido' },
      { value: 'REPASSADO', label: 'Repassado' },
    ],
    columns: [
      { key: 'numero', label: 'Nº Cheque', format: 'text' },
      { key: 'banco', label: 'Banco', format: 'text' },
      { key: 'emitente', label: 'Emitente', format: 'text' },
      { key: 'destino', label: 'Favorecido / Cliente', format: 'text' },
      { key: 'bomPara', label: 'Bom Para', format: 'date' },
      { key: 'valor', label: 'Valor (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'despesas',
    label: 'Despesas',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'pago', label: 'Pagas' },
      { value: 'pendente', label: 'Pendentes' },
      { value: 'atrasado', label: 'Atrasadas' },
    ],
    columns: [
      { key: 'dueDate', label: 'Vencimento', format: 'date' },
      { key: 'description', label: 'Descrição', format: 'text' },
      { key: 'categoryName', label: 'Categoria', format: 'text' },
      { key: 'supplier', label: 'Fornecedor', format: 'text' },
      { key: 'costCenterName', label: 'Centro de Custo', format: 'text' },
      { key: 'machineryName', label: 'Veículo / Máquina', format: 'text' },
      { key: 'amount', label: 'Valor (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'vendas',
    label: 'Vendas',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'pago', label: 'Pago' },
      { value: 'pendente', label: 'Pendente' },
    ],
    columns: [
      { key: 'deliveryDate', label: 'Data Entrega', format: 'date' },
      { key: 'orderNumber', label: 'Nº Pedido', format: 'text' },
      { key: 'clientName', label: 'Cliente', format: 'text' },
      { key: 'productType', label: 'Produto', format: 'text' },
      { key: 'tons', label: 'Volume (Ton)', align: 'right', format: 'number', summable: true },
      { key: 'pricePerTon', label: 'R$ / Ton', align: 'right', format: 'currency' },
      { key: 'totalAmount', label: 'Total (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'paymentStatus', label: 'Pagto.', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'servicos',
    label: 'Prestação de Serviços',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'concluido', label: 'Concluído' },
      { value: 'faturado', label: 'Faturado' },
      { value: 'em_andamento', label: 'Em Andamento' },
    ],
    columns: [
      { key: 'startDate', label: 'Data', format: 'date' },
      { key: 'clientName', label: 'Cliente', format: 'text' },
      { key: 'farmName', label: 'Local / Fazenda', format: 'text' },
      { key: 'serviceType', label: 'Serviço', format: 'text' },
      { key: 'areaHectares', label: 'Área (ha)', align: 'right', format: 'number', summable: true },
      { key: 'machineryAssigned', label: 'Máquina', format: 'text' },
      { key: 'totalAmount', label: 'Valor Total (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'estoque',
    label: 'Estoque',
    hasDateRange: false,
    statusOptions: [
      { value: 'todos', label: 'Todos os Itens' },
      { value: 'baixo', label: 'Abaixo do Mínimo / Zerado' },
      { value: 'ok', label: 'Estoque Normal' },
    ],
    columns: [
      { key: 'code', label: 'Código', format: 'text' },
      { key: 'name', label: 'Produto / Item', format: 'text' },
      { key: 'category', label: 'Categoria', format: 'text' },
      { key: 'quantity', label: 'Saldo Atual', align: 'right', format: 'number', summable: true },
      { key: 'unit', label: 'Unid.', align: 'center', format: 'text' },
      { key: 'minQuantity', label: 'Est. Mínimo', align: 'right', format: 'number' },
      { key: 'unitCost', label: 'Custo Unit. (R$)', align: 'right', format: 'currency' },
      { key: 'totalValue', label: 'Valor em Estoque (R$)', align: 'right', format: 'currency', summable: true },
    ],
  },
  {
    key: 'abastecimentos',
    label: 'Abastecimentos',
    hasDateRange: true,
    statusOptions: [{ value: 'todos', label: 'Todos' }],
    columns: [
      { key: 'date', label: 'Data', format: 'date' },
      { key: 'vehicle', label: 'Veículo / Máquina', format: 'text' },
      { key: 'fuelType', label: 'Combustível', format: 'text' },
      { key: 'liters', label: 'Litros', align: 'right', format: 'number', summable: true },
      { key: 'pricePerLiter', label: 'R$ / Litro', align: 'right', format: 'currency' },
      { key: 'totalAmount', label: 'Total (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'operator', label: 'Motorista / Operador', format: 'text' },
      { key: 'station', label: 'Posto / Tanque', format: 'text' },
    ],
  },
  {
    key: 'frota',
    label: 'Veículos / Frota',
    hasDateRange: false,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'operacional', label: 'Operacional' },
      { value: 'em_manutencao', label: 'Em Manutenção' },
      { value: 'parado', label: 'Parado' },
    ],
    columns: [
      { key: 'fleetNumber', label: 'Nº Frota', align: 'center', format: 'text' },
      { key: 'plate', label: 'Placa / Série', format: 'text' },
      { key: 'name', label: 'Veículo / Modelo', format: 'text' },
      { key: 'year', label: 'Ano', align: 'center', format: 'text' },
      { key: 'ownership', label: 'Regime', format: 'text' },
      { key: 'fipeValue', label: 'Valor FIPE (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'ipvaTotalAmount', label: 'IPVA (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'rh',
    label: 'Funcionários / RH',
    hasDateRange: false,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'ativo', label: 'Ativos' },
      { value: 'ferias', label: 'Férias' },
      { value: 'inativo', label: 'Inativos' },
    ],
    columns: [
      { key: 'name', label: 'Colaborador', format: 'text' },
      { key: 'role', label: 'Cargo / Função', format: 'text' },
      { key: 'cpf', label: 'CPF', format: 'text' },
      { key: 'admissionDate', label: 'Admissão', format: 'date' },
      { key: 'cnhCategory', label: 'Cat. CNH', align: 'center', format: 'text' },
      { key: 'cnhExpiration', label: 'Validade CNH', format: 'date' },
      { key: 'baseSalary', label: 'Salário Base (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
];

interface ReportsPersonalizadoTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  inventory: InventoryItem[];
  fuelLogs: FuelLog[];
  machineries: Machinery[];
  employees: Employee[];
  companyProfile: CompanyProfile;
  startDate: string;
  endDate: string;
  onOpenPrintModal: (config: ReportPrintConfig) => void;
  onRegisterPrintGetter?: (getter: () => ReportPrintConfig) => void;
}

export const ReportsPersonalizadoTab: React.FC<ReportsPersonalizadoTabProps> = ({
  expenses = [],
  orders = [],
  services = [],
  inventory = [],
  fuelLogs = [],
  machineries = [],
  employees = [],
  companyProfile,
  startDate: defaultStart,
  endDate: defaultEnd,
  onOpenPrintModal,
  onRegisterPrintGetter,
}) => {
  const [selectedDataset, setSelectedDataset] = useState<AdHocDatasetKey>('pagar');
  const [customStartDate, setCustomStartDate] = useState(defaultStart);
  const [customEndDate, setCustomEndDate] = useState(defaultEnd);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [cheques] = useState<FinanceiroCheque[]>(() => getStoredFinanceiroCheques());
  const [notasSaida] = useState<NotaSaidaRecord[]>(() => getStoredNotasSaida());

  useEffect(() => {
    setCustomStartDate(defaultStart);
    setCustomEndDate(defaultEnd);
  }, [defaultStart, defaultEnd]);

  const activeSchema = useMemo(
    () => DATASET_SCHEMAS.find((d) => d.key === selectedDataset) || DATASET_SCHEMAS[0],
    [selectedDataset]
  );

  const [visibleColKeys, setVisibleColKeys] = useState<string[]>(() =>
    DATASET_SCHEMAS[0].columns.map((c) => c.key)
  );

  const handleSelectDataset = (key: AdHocDatasetKey) => {
    setSelectedDataset(key);
    setStatusFilter('todos');
    const nextSchema = DATASET_SCHEMAS.find((d) => d.key === key) || DATASET_SCHEMAS[0];
    setVisibleColKeys(nextSchema.columns.map((c) => c.key));
  };

  const toggleColumn = (colKey: string) => {
    setVisibleColKeys((prev) =>
      prev.includes(colKey) ? prev.filter((k) => k !== colKey) : [...prev, colKey]
    );
  };

  const visibleColumns = useMemo(
    () => activeSchema.columns.filter((c) => visibleColKeys.includes(c.key)),
    [activeSchema, visibleColKeys]
  );

  const rawRows = useMemo<Array<Record<string, unknown>>>(() => {
    if (selectedDataset === 'pagar' || selectedDataset === 'despesas') {
      return (expenses || []).map((e) => ({
        _date: (e.dueDate || '').split('T')[0],
        _status: e.status === 'pago' ? 'pago' : e.status === 'atrasado' ? 'atrasado' : 'pendente',
        dueDate: e.dueDate || '',
        supplier: e.supplier || 'Fornecedor N/I',
        description: e.description || '',
        categoryName: e.categoryName || '-',
        costCenterName: e.costCenterName || '-',
        machineryName: e.machineryName || '-',
        paymentMethod: getPaymentMethodLabel(e.paymentMethod),
        amount: Number(e.amount) || 0,
        status: e.status || 'pendente',
      }));
    }

    if (selectedDataset === 'receber') {
      const list: Array<Record<string, unknown>> = [];
      (orders || [])
        .filter((o) => o && o.status !== 'cancelado')
        .forEach((o) => {
          const d = (o.dueDate || o.deliveryDate || o.date || '').split('T')[0];
          list.push({
            _date: d,
            _status: o.paymentStatus === 'pago' ? 'pago' : 'pendente',
            dueDate: d,
            clientName: o.clientName || '',
            origin: 'Venda / Pedido',
            description: `${o.orderNumber ? `#${o.orderNumber} ` : ''}${o.productType || ''}`.trim(),
            paymentMethod: getPaymentMethodLabel(o.paymentMethod),
            amount: Number(o.totalAmount) || 0,
            status: o.paymentStatus === 'pago' ? 'Recebido' : 'Em Aberto',
          });
        });
      (services || [])
        .filter((s) => s && (s.status === 'faturado' || s.billingStatus === 'faturado' || !!s.billedAt))
        .forEach((s) => {
          const d = (s.dueDate || s.date || s.startDate || '').split('T')[0];
          const isPaid = s.status === 'finalizado' || s.paymentStatus === 'pago';
          list.push({
            _date: d,
            _status: isPaid ? 'pago' : 'pendente',
            dueDate: d,
            clientName: s.clientName || '',
            origin: 'Serviço',
            description: s.serviceType || 'Serviço',
            paymentMethod: getPaymentMethodLabel(s.paymentMethod),
            amount: Number(s.totalAmount) || 0,
            status: isPaid ? 'Recebido' : 'Em Aberto',
          });
        });
      (notasSaida || [])
        .filter((n) => n.lancarContasReceber && n.status !== 'CANCELADA' && n.status !== 'RASCUNHO')
        .forEach((n) => {
          const d = (n.dataVencimento || n.dataEmissao || '').split('T')[0];
          const isPaid = n.receberStatus === 'pago';
          list.push({
            _date: d,
            _status: isPaid ? 'pago' : 'pendente',
            dueDate: d,
            clientName: n.destinatarioNome || '',
            origin: 'Nota Fiscal Saída',
            description: `NF ${n.numero}`,
            paymentMethod: n.condicaoPagamento || '-',
            amount: Number(n.valorTotal) || 0,
            status: isPaid ? 'Recebido' : 'Em Aberto',
          });
        });
      return list;
    }

    if (selectedDataset === 'cheques') {
      return (cheques || []).map((c) => {
        const d = (c.data_vencimento || c.dataVencimento || '').split('T')[0];
        return {
          _date: d,
          _status: c.status,
          numero: c.numero_cheque || c.numeroCheque || '-',
          banco: c.banco || '-',
          emitente: c.emitente_nome || c.emitenteNome || '-',
          destino: c.fornecedor_destino || c.fornecedorDestino || c.cliente_nome || c.clienteNome || 'Custódia',
          bomPara: d,
          valor: Number(c.valor) || 0,
          status: c.status,
        };
      });
    }

    if (selectedDataset === 'vendas') {
      return (orders || [])
        .filter((o) => o && o.status !== 'cancelado')
        .map((o) => ({
          _date: (o.deliveryDate || o.date || '').split('T')[0],
          _status: o.paymentStatus === 'pago' ? 'pago' : 'pendente',
          deliveryDate: o.deliveryDate || o.date || '',
          orderNumber: o.orderNumber || o.id.slice(0, 8),
          clientName: o.clientName || '',
          productType: o.productType || '',
          tons: Number(o.tons) || 0,
          pricePerTon: Number(o.pricePerTon) || 0,
          totalAmount: Number(o.totalAmount) || 0,
          paymentStatus: o.paymentStatus || 'pendente',
        }));
    }

    if (selectedDataset === 'servicos') {
      return (services || []).map((s) => ({
        _date: (s.startDate || s.date || '').split('T')[0],
        _status: s.status || '',
        startDate: s.startDate || s.date || '',
        clientName: s.clientName || '',
        farmName: s.farmName || '-',
        serviceType: s.serviceType || '',
        areaHectares: Number(s.areaHectares) || 0,
        machineryAssigned: s.machineryAssigned || '-',
        totalAmount: Number(s.totalAmount) || 0,
        status: s.status || '',
      }));
    }

    if (selectedDataset === 'estoque') {
      return (inventory || []).map((i) => {
        const qty = Number(i.quantity ?? i.quantidade_atual ?? 0);
        const minQty = Number(i.minQuantity ?? 0);
        const unitCost = Number(i.unitCost ?? i.preco_custo_inicial ?? 0);
        const isLow = qty <= 0 || (minQty > 0 && qty <= minQty);
        return {
          _date: '',
          _status: isLow ? 'baixo' : 'ok',
          code: i.code || i.codigo_produto || '-',
          name: i.name || i.nome_comercial || '',
          category: i.category || '-',
          quantity: qty,
          unit: i.unit || 'un',
          minQuantity: minQty,
          unitCost,
          totalValue: qty * unitCost,
        };
      });
    }

    if (selectedDataset === 'abastecimentos') {
      return (fuelLogs || []).map((f) => ({
        _date: (f.date || '').split('T')[0],
        _status: 'todos',
        date: f.date || '',
        vehicle: f.machineryPlateOrName || '',
        fuelType: f.fuelType || '',
        liters: Number(f.liters) || 0,
        pricePerLiter: Number(f.pricePerLiter) || 0,
        totalAmount: Number(f.totalAmount) || 0,
        operator: f.driverOrOperator || '-',
        station: f.supplierStation || '-',
      }));
    }

    if (selectedDataset === 'frota') {
      return (machineries || []).map((m) => ({
        _date: '',
        _status: m.status || 'operacional',
        fleetNumber: m.fleetNumber || '-',
        plate: m.licensePlateOrSerial || m.plate || '-',
        name: `${m.brand ? `${m.brand} ` : ''}${m.model || m.name || ''}`.trim(),
        year: m.year ? String(m.year) : '-',
        ownership: m.ownership || 'Próprio',
        fipeValue: Number(m.fipeValue) || 0,
        ipvaTotalAmount: Number(m.ipvaTotalAmount) || 0,
        status: m.status || 'operacional',
      }));
    }

    // rh
    return (employees || []).map((emp) => ({
      _date: '',
      _status: emp.status || 'ativo',
      name: emp.name || '',
      role: emp.role || '-',
      cpf: emp.cpf || '-',
      admissionDate: emp.admissionDate || '',
      cnhCategory: emp.cnhCategory || '-',
      cnhExpiration: emp.cnhExpiration || '',
      baseSalary: Number(emp.baseSalary) || 0,
      status: emp.status || 'ativo',
    }));
  }, [selectedDataset, expenses, orders, services, notasSaida, cheques, inventory, fuelLogs, machineries, employees]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return rawRows.filter((row) => {
      if (activeSchema.hasDateRange) {
        const d = String(row._date || '');
        if (!d || (customStartDate && d < customStartDate) || (customEndDate && d > customEndDate)) {
          return false;
        }
      }
      if (statusFilter !== 'todos') {
        if (selectedDataset === 'pagar' && statusFilter === 'pendente') {
          if (row._status === 'pago') return false;
        } else if (String(row._status || '') !== statusFilter) {
          return false;
        }
      }
      if (term) {
        const joined = Object.values(row)
          .map((v) => String(v ?? '').toLowerCase())
          .join(' ');
        if (!joined.includes(term)) return false;
      }
      return true;
    });
  }, [rawRows, activeSchema.hasDateRange, customStartDate, customEndDate, statusFilter, selectedDataset, searchTerm]);

  const printConfig = useMemo(
    () =>
      buildAdHocCustomReport({
        companyProfile,
        datasetLabel: activeSchema.label,
        columns: visibleColumns,
        rows: filteredRows,
        startDate: activeSchema.hasDateRange ? customStartDate : '',
        endDate: activeSchema.hasDateRange ? customEndDate : '',
        statusFilter,
        searchTerm,
      }),
    [companyProfile, activeSchema, visibleColumns, filteredRows, customStartDate, customEndDate, statusFilter, searchTerm]
  );

  useEffect(() => {
    onRegisterPrintGetter?.(() => printConfig);
  }, [onRegisterPrintGetter, printConfig]);

  const formatCellDisplay = (val: unknown, col: AdHocColumnDef): string => {
    if (val === null || val === undefined || val === '') return '-';
    if (col.format === 'currency') return formatCurrencyBRL(Number(val) || 0);
    if (col.format === 'date') return formatDateBR(String(val));
    if (col.format === 'number') return Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return String(val);
  };

  const handleExportCsv = () => {
    if (visibleColumns.length === 0) return;
    const headerLine = visibleColumns.map((c) => `"${c.label}"`).join(',') + '\n';
    const bodyLines = filteredRows
      .map((row) =>
        visibleColumns
          .map((col) => {
            const raw = row[col.key];
            return `"${String(raw ?? '').replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([headerLine + bodyLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_personalizado_${selectedDataset}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden animate-fade-in financial-subtab-clean">
      {/* 1. Painel de Configuração (Base de Dados, Período & Ações) */}
      <div className="reports-filter-bar shrink-0 bg-[#cad4e6] dark:bg-stone-900 p-2.5 rounded-lg border border-black dark:border-stone-800 shadow-xs flex flex-wrap items-end gap-2">
        <div className="min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 mb-1">
            <span className="inline-flex items-center gap-1">
              <Database className="w-3 h-3" />
              1. Módulo / Base de Dados
            </span>
          </label>
          <select
            value={selectedDataset}
            onChange={(e) => handleSelectDataset(e.target.value as AdHocDatasetKey)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-black/60 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
          >
            {DATASET_SCHEMAS.map((ds) => (
              <option key={ds.key} value={ds.key}>
                {ds.label}
              </option>
            ))}
          </select>
        </div>

        {activeSchema.hasDateRange && (
          <>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold cursor-pointer"
          >
            {activeSchema.statusOptions.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-400 mb-1">
            Busca Textual
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por qualquer campo..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenPrintModal(printConfig)}
            disabled={visibleColumns.length === 0}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white border border-emerald-900 font-bold text-xs rounded-lg transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir A4 Personalizado</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={visibleColumns.length === 0}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#e0e6f1] hover:bg-[#d2dced] disabled:opacity-50 text-black border border-black font-bold text-xs rounded-lg transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV/Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Seletor de Colunas Visíveis (Checkboxes) */}
      <div className="reports-kpi-card shrink-0 bg-[#e0e6f1] dark:bg-stone-900 px-3 py-2 rounded-lg border border-black dark:border-stone-800 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-800 dark:text-stone-200 inline-flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
            3. Colunas Visíveis na Prévia e Impressão ({visibleColumns.length}/{activeSchema.columns.length})
          </span>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setVisibleColKeys(activeSchema.columns.map((c) => c.key))}
              className="text-emerald-700 hover:underline cursor-pointer"
            >
              Selecionar Todas
            </button>
            <span className="text-stone-400">•</span>
            <button
              type="button"
              onClick={() => setVisibleColKeys([])}
              className="text-rose-700 hover:underline cursor-pointer"
            >
              Limpar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeSchema.columns.map((col) => {
            const checked = visibleColKeys.includes(col.key);
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => toggleColumn(col.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer ${
                  checked
                    ? 'bg-emerald-700 text-white border-emerald-800'
                    : 'bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-slate-400 dark:border-stone-700 hover:bg-slate-100'
                }`}
              >
                {checked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                <span>{col.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Prévia em Tempo Real na Tela */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="shrink-0 px-3 py-1.5 bg-[#cad4e6] dark:bg-stone-800 border-b border-black dark:border-stone-700 flex items-center justify-between text-[11px] font-bold text-stone-900 dark:text-stone-200">
          <span>Prévia em Tempo Real — {activeSchema.label}</span>
          <span>{filteredRows.length} registro(s) encontrado(s)</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
          {visibleColumns.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-stone-600">
              Marque pelo menos uma coluna acima para visualizar os dados.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider border-b border-black dark:border-stone-700 shadow-sm">
                <tr>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`py-2.5 px-3.5 ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-[#e0e6f1] divide-y divide-black/15 dark:divide-stone-800">
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="bg-[#e0e6f1] dark:bg-stone-900 hover:bg-[#d2dced] dark:hover:bg-stone-800 transition border-b border-black/20 dark:border-stone-800"
                    >
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`py-2 px-3.5 ${
                            col.align === 'right'
                              ? 'text-right font-bold'
                              : col.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                          } ${
                            col.format === 'currency'
                              ? 'text-emerald-800 dark:text-emerald-400 font-black whitespace-nowrap'
                              : 'text-stone-800 dark:text-stone-200'
                          }`}
                        >
                          {formatCellDisplay(row[col.key], col)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={visibleColumns.length}
                      className="py-8 text-center text-stone-600 bg-[#e0e6f1] dark:bg-stone-900"
                    >
                      Nenhum registro encontrado com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredRows.length > 0 && visibleColumns.some((c) => c.summable) && (
                <tfoot className="bg-[#cad4e6] dark:bg-stone-800 border-t-2 border-black font-black text-xs">
                  <tr>
                    {visibleColumns.map((col, idx) => {
                      if (idx === 0 && !col.summable) {
                        return (
                          <td key={col.key} className="py-2 px-3.5 uppercase">
                            Totais ({filteredRows.length} reg.)
                          </td>
                        );
                      }
                      if (col.summable) {
                        const sum = filteredRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                        return (
                          <td
                            key={col.key}
                            className={`py-2 px-3.5 ${
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                            } text-emerald-800 dark:text-emerald-300`}
                          >
                            {col.format === 'currency'
                              ? formatCurrencyBRL(sum)
                              : sum.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                          </td>
                        );
                      }
                      return <td key={col.key} className="py-2 px-3.5" />;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
