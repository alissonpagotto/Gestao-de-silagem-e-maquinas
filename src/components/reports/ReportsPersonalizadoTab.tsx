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
  BankAccount,
  BankTransaction,
  BrokerSettlement,
  CaixaFerramentaVeiculoRecord,
  Client,
  CompanyProfile,
  DocumentoEntradaRecord,
  Employee,
  Expense,
  FinanceiroCheque,
  FuelLog,
  InventoryBalanceSession,
  InventoryItem,
  Machinery,
  MaintenanceLog,
  NotaSaidaRecord,
  PayrollRecord,
  SalaryAdvance,
  ServiceOrder,
  SilageOrder,
  Supplier,
  TerminationRecord,
  ThirdPartySettlement,
  TrocaDevolucaoRecord,
  VacationRecord,
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredBankAccounts,
  getStoredBankTransactions,
  getStoredBrokerSettlements,
  getStoredClients,
  getStoredDocumentosEntrada,
  getStoredFinanceiroCheques,
  getStoredInventoryBalances,
  getStoredNotasSaida,
  getStoredSettlements,
  getStoredSuppliers,
  getStoredTerminations,
  getStoredTrocasDevolucoes,
} from '../../lib/storage';
import {
  CaixaOperacional,
  calcularTotaisCaixa,
  getStoredCaixaOperacional,
  getStoredHistoricoCaixas,
  syncCaixaComVendas,
} from '../../lib/caixaStorage';
import {
  CaixaConferenciaRecord,
  getCaixaMetaMap,
  getStoredCaixaConferencias,
  getStoredToolKits,
  resolveCaixaItemMeta,
  resolveInventoryUnitCost,
  ToolKitRecord,
} from '../../lib/toolKitsStorage';
import { fetchCaixaFerramentasVeiculo } from '../../lib/supabaseService';
import { getPaymentMethodLabel } from '../financial/ReceivablesTab';
import {
  AdHocColumnDef,
  buildAdHocCustomReport,
  ReportPrintConfig,
} from './reportPrintBuilders';

export type AdHocDatasetKey =
  | 'pagar'
  | 'contas_pagas'
  | 'receber'
  | 'contas_recebidas'
  | 'bancos_extrato'
  | 'fluxo_caixa'
  | 'cheques'
  | 'acertos_terceiros'
  | 'despesas'
  | 'notas_entrada'
  | 'notas_saida'
  | 'devolucoes'
  | 'vendas'
  | 'servicos'
  | 'estoque'
  | 'balanco_estoque'
  | 'almoxarifado_kits'
  | 'frota'
  | 'abastecimentos'
  | 'rh'
  | 'rh_folha_rescisoes'
  | 'clientes'
  | 'fornecedores';

export type AdHocDatasetGroup =
  | 'Financeiro & Caixa'
  | 'Fiscal & Notas'
  | 'Comercial & Serviços'
  | 'Estoque & Patrimônio'
  | 'Frota & Combustível'
  | 'RH & Cadastros';

interface DatasetSchema {
  key: AdHocDatasetKey;
  group: AdHocDatasetGroup;
  label: string;
  hasDateRange: boolean;
  statusOptions: Array<{ value: string; label: string }>;
  columns: AdHocColumnDef[];
}

const DATASET_GROUPS: AdHocDatasetGroup[] = [
  'Financeiro & Caixa',
  'Fiscal & Notas',
  'Comercial & Serviços',
  'Estoque & Patrimônio',
  'Frota & Combustível',
  'RH & Cadastros',
];

const FINANCIAL_PAYABLE_COLUMNS: AdHocColumnDef[] = [
  { key: 'dueDate', label: 'Vencimento', format: 'date' },
  { key: 'paymentDate', label: 'Data Baixa / Pagto.', format: 'date' },
  { key: 'supplier', label: 'Fornecedor', format: 'text' },
  { key: 'description', label: 'Descrição', format: 'text' },
  { key: 'categoryName', label: 'Categoria', format: 'text' },
  { key: 'bankAccountName', label: 'Banco / Caixa', format: 'text' },
  { key: 'paymentMethod', label: 'Forma Pagto.', format: 'text' },
  { key: 'originalAmount', label: 'Valor Original (R$)', align: 'right', format: 'currency', summable: true },
  { key: 'fineAmount', label: '(+) Multa (R$)', align: 'right', format: 'currency', summable: true, tone: 'charge' },
  { key: 'interestAmount', label: '(+) Juros (R$)', align: 'right', format: 'currency', summable: true, tone: 'charge' },
  { key: 'discountAmount', label: '(-) Desconto / Abatimento (R$)', align: 'right', format: 'currency', summable: true, tone: 'discount' },
  { key: 'realAmount', label: '(=) Valor Real Pago / Recebido (R$)', align: 'right', format: 'currency', summable: true, tone: 'real' },
  { key: 'status', label: 'Status', align: 'center', format: 'text' },
];

const FINANCIAL_RECEIVABLE_COLUMNS: AdHocColumnDef[] = [
  { key: 'dueDate', label: 'Vencimento', format: 'date' },
  { key: 'paymentDate', label: 'Data Baixa / Pagto.', format: 'date' },
  { key: 'clientName', label: 'Cliente', format: 'text' },
  { key: 'origin', label: 'Origem', format: 'text' },
  { key: 'description', label: 'Referência', format: 'text' },
  { key: 'bankAccountName', label: 'Banco / Caixa', format: 'text' },
  { key: 'paymentMethod', label: 'Forma Pagto.', format: 'text' },
  { key: 'originalAmount', label: 'Valor Original (R$)', align: 'right', format: 'currency', summable: true },
  { key: 'fineAmount', label: '(+) Multa (R$)', align: 'right', format: 'currency', summable: true, tone: 'charge' },
  { key: 'interestAmount', label: '(+) Juros (R$)', align: 'right', format: 'currency', summable: true, tone: 'charge' },
  { key: 'discountAmount', label: '(-) Desconto / Abatimento (R$)', align: 'right', format: 'currency', summable: true, tone: 'discount' },
  { key: 'realAmount', label: '(=) Valor Real Pago / Recebido (R$)', align: 'right', format: 'currency', summable: true, tone: 'real' },
  { key: 'status', label: 'Status', align: 'center', format: 'text' },
];

const DATASET_SCHEMAS: DatasetSchema[] = [
  // 1. FINANCEIRO & CAIXA
  {
    key: 'pagar',
    group: 'Financeiro & Caixa',
    label: 'Contas a Pagar (Todas)',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'pago', label: 'Pago / Liquidado' },
      { value: 'pendente', label: 'Em Aberto / Pendente' },
      { value: 'atrasado', label: 'Vencido / Atrasado' },
      { value: 'com_acrescimos_descontos', label: 'Com Juros, Multas ou Descontos' },
    ],
    columns: FINANCIAL_PAYABLE_COLUMNS,
  },
  {
    key: 'contas_pagas',
    group: 'Financeiro & Caixa',
    label: 'Contas Pagas (Liquidadas — Juros, Multas & Descontos)',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todas as Liquidadas' },
      { value: 'com_acrescimos_descontos', label: 'Com Juros, Multas ou Descontos' },
    ],
    columns: FINANCIAL_PAYABLE_COLUMNS,
  },
  {
    key: 'receber',
    group: 'Financeiro & Caixa',
    label: 'Contas a Receber (Todas)',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'pago', label: 'Recebido / Liquidado' },
      { value: 'pendente', label: 'Em Aberto' },
      { value: 'com_acrescimos_descontos', label: 'Com Juros, Multas ou Descontos' },
    ],
    columns: FINANCIAL_RECEIVABLE_COLUMNS,
  },
  {
    key: 'contas_recebidas',
    group: 'Financeiro & Caixa',
    label: 'Contas Recebidas (Liquidadas)',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todas as Recebidas' },
      { value: 'com_acrescimos_descontos', label: 'Com Juros, Multas ou Descontos' },
    ],
    columns: FINANCIAL_RECEIVABLE_COLUMNS,
  },
  {
    key: 'bancos_extrato',
    group: 'Financeiro & Caixa',
    label: 'Extrato & Saldos Bancários',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Extrato + Saldos Atuais' },
      { value: 'entrada', label: 'Entradas / Créditos' },
      { value: 'saida', label: 'Saídas / Débitos' },
      { value: 'saldo_atual', label: 'Somente Saldos das Contas' },
    ],
    columns: [
      { key: 'date', label: 'Data / Atualização', format: 'date' },
      { key: 'bankAccountName', label: 'Conta / Banco', format: 'text' },
      { key: 'typeLabel', label: 'Tipo Movto.', align: 'center', format: 'text' },
      { key: 'category', label: 'Categoria / Origem', format: 'text' },
      { key: 'description', label: 'Histórico / Descrição', format: 'text' },
      { key: 'amount', label: 'Valor Movto. (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'balanceAfter', label: 'Saldo (R$)', align: 'right', format: 'currency', summable: true },
    ],
  },
  {
    key: 'fluxo_caixa',
    group: 'Financeiro & Caixa',
    label: 'Fluxo de Caixa & Sessões PDV',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todas as Sessões' },
      { value: 'ABERTO', label: 'Caixa Aberto' },
      { value: 'FECHADO', label: 'Caixa Fechado' },
    ],
    columns: [
      { key: 'dataAbertura', label: 'Abertura', format: 'text' },
      { key: 'caixaId', label: 'Nº Caixa / Sessão', format: 'text' },
      { key: 'operador', label: 'Operador', format: 'text' },
      { key: 'fundoInicial', label: 'Fundo Inicial (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'dinheiro', label: 'Vendas Dinheiro (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'pixCartoes', label: 'PIX / Cartões (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'suprimentos', label: 'Suprimentos (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'sangrias', label: 'Sangrias (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'saldoFinal', label: 'Saldo Final (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'diferenca', label: 'Quebra / Dif. (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'cheques',
    group: 'Financeiro & Caixa',
    label: 'Custódia de Cheques',
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
    key: 'acertos_terceiros',
    group: 'Financeiro & Caixa',
    label: 'Acertos Terceiros & Agenciadores',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'pago', label: 'Pago / Repassado' },
      { value: 'pendente', label: 'Pendente' },
      { value: 'terceiro', label: 'Somente Terceiros / Freteiros' },
      { value: 'agenciador', label: 'Somente Agenciadores' },
    ],
    columns: [
      { key: 'date', label: 'Data', format: 'date' },
      { key: 'originType', label: 'Tipo Acerto', format: 'text' },
      { key: 'personName', label: 'Terceiro / Agenciador', format: 'text' },
      { key: 'roleOrRegion', label: 'Função / Região', format: 'text' },
      { key: 'description', label: 'Descrição / Pedido', format: 'text' },
      { key: 'grossAmount', label: 'Valor Bruto (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'deductions', label: '(-) Deduções (R$)', align: 'right', format: 'currency', summable: true, tone: 'discount' },
      { key: 'netAmount', label: '(=) Valor Líquido (R$)', align: 'right', format: 'currency', summable: true, tone: 'real' },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'despesas',
    group: 'Financeiro & Caixa',
    label: 'Despesas Operacionais',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'pago', label: 'Pagas' },
      { value: 'pendente', label: 'Pendentes' },
      { value: 'atrasado', label: 'Atrasadas' },
      { value: 'com_acrescimos_descontos', label: 'Com Juros, Multas ou Descontos' },
    ],
    columns: [
      { key: 'dueDate', label: 'Vencimento', format: 'date' },
      { key: 'paymentDate', label: 'Data Baixa / Pagto.', format: 'date' },
      { key: 'description', label: 'Descrição', format: 'text' },
      { key: 'categoryName', label: 'Categoria', format: 'text' },
      { key: 'supplier', label: 'Fornecedor', format: 'text' },
      { key: 'costCenterName', label: 'Centro de Custo', format: 'text' },
      { key: 'machineryName', label: 'Veículo / Máquina', format: 'text' },
      { key: 'bankAccountName', label: 'Banco / Caixa', format: 'text' },
      { key: 'originalAmount', label: 'Valor Original (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'fineAmount', label: '(+) Multa (R$)', align: 'right', format: 'currency', summable: true, tone: 'charge' },
      { key: 'interestAmount', label: '(+) Juros (R$)', align: 'right', format: 'currency', summable: true, tone: 'charge' },
      { key: 'discountAmount', label: '(-) Desconto / Abatimento (R$)', align: 'right', format: 'currency', summable: true, tone: 'discount' },
      { key: 'realAmount', label: '(=) Valor Real Pago / Recebido (R$)', align: 'right', format: 'currency', summable: true, tone: 'real' },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },

  // 2. FISCAL & NOTAS
  {
    key: 'notas_entrada',
    group: 'Fiscal & Notas',
    label: 'Notas Fiscais de Entrada (XML & Manuais)',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todas' },
      { value: 'Finalizado', label: 'Finalizadas' },
      { value: 'Rascunho', label: 'Rascunho' },
    ],
    columns: [
      { key: 'data', label: 'Data Entrada', format: 'date' },
      { key: 'dataEmissao', label: 'Data Emissão', format: 'date' },
      { key: 'numero', label: 'Nº Nota / Doc.', format: 'text' },
      { key: 'serie', label: 'Série', align: 'center', format: 'text' },
      { key: 'tipoDocumento', label: 'Tipo Doc.', format: 'text' },
      { key: 'fornecedor', label: 'Fornecedor', format: 'text' },
      { key: 'cnpj', label: 'CNPJ', format: 'text' },
      { key: 'cfop', label: 'CFOP', align: 'center', format: 'text' },
      { key: 'chave', label: 'Chave de Acesso', format: 'text' },
      { key: 'valorTotal', label: 'Valor Total (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'notas_saida',
    group: 'Fiscal & Notas',
    label: 'Notas Fiscais de Saída',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todas' },
      { value: 'AUTORIZADA', label: 'Autorizadas / Emitidas' },
      { value: 'RASCUNHO', label: 'Rascunho' },
      { value: 'CANCELADA', label: 'Canceladas' },
    ],
    columns: [
      { key: 'dataEmissao', label: 'Data Emissão', format: 'date' },
      { key: 'numero', label: 'Nº Nota', format: 'text' },
      { key: 'serie', label: 'Série', align: 'center', format: 'text' },
      { key: 'tipoDocumento', label: 'Modelo / Tipo', format: 'text' },
      { key: 'destinatario', label: 'Destinatário / Cliente', format: 'text' },
      { key: 'cpfCnpj', label: 'CPF / CNPJ', format: 'text' },
      { key: 'cfop', label: 'CFOP', align: 'center', format: 'text' },
      { key: 'condicaoPagamento', label: 'Cond. Pagto.', format: 'text' },
      { key: 'valorTotal', label: 'Valor Total (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'devolucoes',
    group: 'Fiscal & Notas',
    label: 'Devoluções & Garantias',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todas' },
      { value: 'devolucao_cliente', label: 'Devolução de Cliente' },
      { value: 'troca_direta', label: 'Troca Direta / Garantia' },
      { value: 'devolucao_fornecedor', label: 'Devolução p/ Fornecedor' },
    ],
    columns: [
      { key: 'data', label: 'Data', format: 'date' },
      { key: 'protocolo', label: 'Protocolo', format: 'text' },
      { key: 'natureza', label: 'Natureza / Operação', format: 'text' },
      { key: 'envolvidoNome', label: 'Cliente / Fornecedor', format: 'text' },
      { key: 'numeroOrigem', label: 'Nº Nota / Venda Origem', format: 'text' },
      { key: 'motivo', label: 'Motivo', format: 'text' },
      { key: 'totalDevolvido', label: 'Total Devolvido (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'totalLevado', label: 'Total Levado (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'saldoFinal', label: 'Saldo Diferença (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'destinoFinanceiro', label: 'Destino Financeiro', format: 'text' },
      { key: 'fiscalStatus', label: 'Status Fiscal', align: 'center', format: 'text' },
    ],
  },

  // 3. COMERCIAL & SERVIÇOS
  {
    key: 'vendas',
    group: 'Comercial & Serviços',
    label: 'Vendas & Faturamento PDV',
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
      { key: 'productType', label: 'Produto / Mercadoria', format: 'text' },
      { key: 'tons', label: 'Volume / Qtd.', align: 'right', format: 'number', summable: true },
      { key: 'pricePerTon', label: 'Valor Unit. (R$)', align: 'right', format: 'currency' },
      { key: 'totalAmount', label: 'Total (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'paymentMethod', label: 'Forma Pagto.', format: 'text' },
      { key: 'paymentStatus', label: 'Pagto.', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'servicos',
    group: 'Comercial & Serviços',
    label: 'Prestação de Serviços & Ordens de Serviço',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'concluido', label: 'Concluído' },
      { value: 'faturado', label: 'Faturado' },
      { value: 'finalizado', label: 'Finalizado' },
      { value: 'em_andamento', label: 'Em Andamento' },
    ],
    columns: [
      { key: 'startDate', label: 'Data', format: 'date' },
      { key: 'clientName', label: 'Cliente', format: 'text' },
      { key: 'farmName', label: 'Local / Fazenda', format: 'text' },
      { key: 'serviceType', label: 'Serviço / OS', format: 'text' },
      { key: 'areaHectares', label: 'Área / Qtd.', align: 'right', format: 'number', summable: true },
      { key: 'machineryAssigned', label: 'Máquina / Frota', format: 'text' },
      { key: 'totalAmount', label: 'Valor Total (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },

  // 4. ESTOQUE & PATRIMÔNIO
  {
    key: 'estoque',
    group: 'Estoque & Patrimônio',
    label: 'Estoque Geral & Custo',
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
      { key: 'location', label: 'Endereço / Gôndola', format: 'text' },
      { key: 'quantity', label: 'Saldo Atual', align: 'right', format: 'number', summable: true },
      { key: 'unit', label: 'Unid.', align: 'center', format: 'text' },
      { key: 'minQuantity', label: 'Est. Mínimo', align: 'right', format: 'number' },
      { key: 'unitCost', label: 'Custo Unit. (R$)', align: 'right', format: 'currency' },
      { key: 'totalValue', label: 'Valor em Estoque (R$)', align: 'right', format: 'currency', summable: true },
    ],
  },
  {
    key: 'balanco_estoque',
    group: 'Estoque & Patrimônio',
    label: 'Balanço / Inventário de Estoque (Divergências)',
    hasDateRange: true,
    statusOptions: [
      { value: 'todos', label: 'Todos os Itens / Sessões' },
      { value: 'com_divergencia', label: 'Somente com Divergência' },
      { value: 'sobra', label: 'Somente Sobras (+)' },
      { value: 'falta', label: 'Somente Faltas (-)' },
    ],
    columns: [
      { key: 'date', label: 'Data Balanço', format: 'date' },
      { key: 'sessionCode', label: 'Cód. Balanço', format: 'text' },
      { key: 'sessionTitle', label: 'Inventário / Escopo', format: 'text' },
      { key: 'productCode', label: 'Cód. Prod.', format: 'text' },
      { key: 'productName', label: 'Produto', format: 'text' },
      { key: 'systemQty', label: 'Qtd. Sistema', align: 'right', format: 'number', summable: true },
      { key: 'countedQty', label: 'Qtd. Contada', align: 'right', format: 'number', summable: true },
      { key: 'diffQty', label: 'Divergência Qtd.', align: 'right', format: 'number', summable: true },
      { key: 'unitCost', label: 'Custo Unit. (R$)', align: 'right', format: 'currency' },
      { key: 'diffValue', label: 'Impacto Financeiro (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Situação', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'almoxarifado_kits',
    group: 'Estoque & Patrimônio',
    label: 'Almoxarifado & Kits de Ferramentas',
    hasDateRange: false,
    statusOptions: [
      { value: 'todos', label: 'Todos (Caixas de Veículos + Kits Padrão)' },
      { value: 'veiculo', label: 'Somente Caixas Fixas de Veículos' },
      { value: 'kit', label: 'Somente Kits Padrão' },
      { value: 'divergencia', label: 'Com Divergência / Faltando / Danificada' },
    ],
    columns: [
      { key: 'originType', label: 'Origem / Tipo', format: 'text' },
      { key: 'containerName', label: 'Veículo / Kit Padrão', format: 'text' },
      { key: 'codigo', label: 'Código', format: 'text' },
      { key: 'nome', label: 'Ferramenta / Item', format: 'text' },
      { key: 'qtyExpected', label: 'Qtd. Esperada', align: 'right', format: 'number', summable: true },
      { key: 'qtyCurrent', label: 'Qtd. Atual', align: 'right', format: 'number', summable: true },
      { key: 'unitCost', label: 'Valor Unit. (R$)', align: 'right', format: 'currency' },
      { key: 'totalValue', label: 'Subtotal Patrimônio (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'conferidoPor', label: 'Conferido Por / Resp.', format: 'text' },
      { key: 'status', label: 'Condição / Status', align: 'center', format: 'text' },
    ],
  },

  // 5. FROTA & COMBUSTÍVEL
  {
    key: 'frota',
    group: 'Frota & Combustível',
    label: 'Veículos, Máquinas & Manutenções',
    hasDateRange: false,
    statusOptions: [
      { value: 'todos', label: 'Todos (Veículos + Manutenções)' },
      { value: 'veiculo', label: 'Somente Veículos / Máquinas' },
      { value: 'manutencao', label: 'Somente Ordens de Manutenção (OS)' },
      { value: 'operacional', label: 'Operacional' },
      { value: 'em_manutencao', label: 'Em Manutenção' },
      { value: 'concluida', label: 'OS Concluída' },
    ],
    columns: [
      { key: 'recordType', label: 'Tipo Registro', format: 'text' },
      { key: 'refDate', label: 'Data Ref.', format: 'date' },
      { key: 'fleetNumber', label: 'Nº Frota / OS', align: 'center', format: 'text' },
      { key: 'plate', label: 'Placa / Série', format: 'text' },
      { key: 'name', label: 'Veículo / Serviço OS', format: 'text' },
      { key: 'categoryOrWorkshop', label: 'Categoria / Oficina', format: 'text' },
      { key: 'fipeValue', label: 'Valor FIPE (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'ipvaTotalAmount', label: 'IPVA (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'maintenanceCost', label: 'Custo Manutenção (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'abastecimentos',
    group: 'Frota & Combustível',
    label: 'Abastecimentos & Consumo',
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

  // 6. RH & CADASTROS
  {
    key: 'rh',
    group: 'RH & Cadastros',
    label: 'Funcionários (RH)',
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
  {
    key: 'rh_folha_rescisoes',
    group: 'RH & Cadastros',
    label: 'Folha de Pagamento, Férias & Rescisões (TRCT)',
    hasDateRange: false,
    statusOptions: [
      { value: 'todos', label: 'Todos (Folha + Férias + TRCT)' },
      { value: 'folha', label: 'Somente Folha / 13º' },
      { value: 'ferias', label: 'Somente Férias' },
      { value: 'rescisao', label: 'Somente Rescisões (TRCT)' },
      { value: 'pago', label: 'Pagos / Quitados' },
      { value: 'pendente', label: 'Pendentes / Agendados' },
    ],
    columns: [
      { key: 'competenceOrDate', label: 'Comp. / Data', format: 'text' },
      { key: 'recordType', label: 'Tipo Evento RH', format: 'text' },
      { key: 'employeeName', label: 'Colaborador', format: 'text' },
      { key: 'employeeRole', label: 'Cargo', format: 'text' },
      { key: 'baseSalary', label: 'Salário Base (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'grossAmount', label: 'Proventos / Bruto (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'discounts', label: '(-) Descontos (R$)', align: 'right', format: 'currency', summable: true, tone: 'discount' },
      { key: 'netAmount', label: '(=) Valor Líquido (R$)', align: 'right', format: 'currency', summable: true, tone: 'real' },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'clientes',
    group: 'RH & Cadastros',
    label: 'Clientes',
    hasDateRange: false,
    statusOptions: [
      { value: 'todos', label: 'Todos os Clientes' },
      { value: 'cliente_ativo', label: 'Ativos' },
      { value: 'cliente_vip', label: 'VIP' },
      { value: 'inadimplente', label: 'Inadimplentes' },
      { value: 'inativo', label: 'Inativos' },
    ],
    columns: [
      { key: 'code', label: 'Código', format: 'text' },
      { key: 'name', label: 'Nome / Razão Social', format: 'text' },
      { key: 'farmName', label: 'Fazenda / Fantasia', format: 'text' },
      { key: 'cpfCnpj', label: 'CPF / CNPJ', format: 'text' },
      { key: 'phone', label: 'Telefone', format: 'text' },
      { key: 'cityState', label: 'Cidade / UF', format: 'text' },
      { key: 'creditLimit', label: 'Limite Crédito (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'creditBalance', label: 'Crédito / Vale (R$)', align: 'right', format: 'currency', summable: true },
      { key: 'status', label: 'Status', align: 'center', format: 'text' },
    ],
  },
  {
    key: 'fornecedores',
    group: 'RH & Cadastros',
    label: 'Fornecedores & Transportadoras',
    hasDateRange: false,
    statusOptions: [
      { value: 'todos', label: 'Todos' },
      { value: 'transportadora', label: 'Somente Transportadoras' },
    ],
    columns: [
      { key: 'code', label: 'Código', format: 'text' },
      { key: 'name', label: 'Razão Social / Nome', format: 'text' },
      { key: 'tradeName', label: 'Nome Fantasia', format: 'text' },
      { key: 'category', label: 'Categoria / Ramo', format: 'text' },
      { key: 'cnpjOrCpf', label: 'CPF / CNPJ', format: 'text' },
      { key: 'phone', label: 'Telefone', format: 'text' },
      { key: 'cityState', label: 'Cidade / UF', format: 'text' },
      { key: 'defaultPaymentTerm', label: 'Condição Padrão', format: 'text' },
    ],
  },
];

function toIsoDateStr(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  return '';
}

interface ReportsPersonalizadoTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  services: ServiceOrder[];
  inventory: InventoryItem[];
  fuelLogs: FuelLog[];
  machineries: Machinery[];
  maintenanceLogs?: MaintenanceLog[];
  employees: Employee[];
  clients?: Client[];
  suppliers?: Supplier[];
  bankAccounts?: BankAccount[];
  payrolls?: PayrollRecord[];
  vacations?: VacationRecord[];
  advances?: SalaryAdvance[];
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
  maintenanceLogs = [],
  employees = [],
  clients = [],
  suppliers = [],
  bankAccounts = [],
  payrolls = [],
  vacations = [],
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

  // Fontes armazenadas em storage local / serviços auxiliares
  const [cheques] = useState<FinanceiroCheque[]>(() => getStoredFinanceiroCheques());
  const [notasSaida] = useState<NotaSaidaRecord[]>(() => getStoredNotasSaida());
  const [notasEntrada] = useState<DocumentoEntradaRecord[]>(() => getStoredDocumentosEntrada());
  const [devolucoes] = useState<TrocaDevolucaoRecord[]>(() => getStoredTrocasDevolucoes());
  const [bankTransactions] = useState<BankTransaction[]>(() => getStoredBankTransactions());
  const [storedBankAccounts] = useState<BankAccount[]>(() => getStoredBankAccounts());
  const [settlements] = useState<ThirdPartySettlement[]>(() => getStoredSettlements());
  const [brokerSettlements] = useState<BrokerSettlement[]>(() => getStoredBrokerSettlements());
  const [inventoryBalances] = useState<InventoryBalanceSession[]>(() => getStoredInventoryBalances());
  const [terminations] = useState<TerminationRecord[]>(() => getStoredTerminations());
  const [storedClients] = useState<Client[]>(() => getStoredClients());
  const [storedSuppliers] = useState<Supplier[]>(() => getStoredSuppliers());
  const [toolKits] = useState<ToolKitRecord[]>(() => getStoredToolKits());
  const [caixaConferencias] = useState<CaixaConferenciaRecord[]>(() => getStoredCaixaConferencias());
  const [caixaFerramentasItems, setCaixaFerramentasItems] = useState<CaixaFerramentaVeiculoRecord[]>([]);

  useEffect(() => {
    let active = true;
    fetchCaixaFerramentasVeiculo()
      .then((rows) => {
        if (active && Array.isArray(rows)) setCaixaFerramentasItems(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const caixasSessoes = useMemo<CaixaOperacional[]>(() => {
    const map = new Map<string, CaixaOperacional>();
    getStoredHistoricoCaixas().forEach((c) => {
      if (c?.id) map.set(c.id, c);
    });
    const current = getStoredCaixaOperacional();
    if (current?.id) {
      map.set(current.id, current.status === 'ABERTO' ? syncCaixaComVendas(current) : current);
    }
    return Array.from(map.values());
  }, []);

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

  const effectiveBankAccounts = bankAccounts.length > 0 ? bankAccounts : storedBankAccounts;
  const effectiveClients = clients.length > 0 ? clients : storedClients;
  const effectiveSuppliers = suppliers.length > 0 ? suppliers : storedSuppliers;

  const mapExpenseRow = (e: Expense, usePaymentDateForFilter = false): Record<string, unknown> => {
    const orig = Number(e.originalAmount ?? e.amount) || 0;
    const fine = Number(e.fineAmount) || 0;
    const interest = Number(e.interestAmount) || 0;
    const discount = Number(e.discountAmount) || 0;
    const isPaid = e.status === 'pago';
    const real = isPaid ? Number(e.paidAmount ?? e.amount) || 0 : 0;
    const payDate = toIsoDateStr(e.paymentDate || e.paidAt) || '';
    const dueIso = toIsoDateStr(e.dueDate || e.date) || '';
    const hasChargesOrDiscounts = fine + interest > 0.009 || discount > 0.009;
    return {
      _date: usePaymentDateForFilter ? payDate || dueIso : dueIso,
      _status: e.status === 'pago' ? 'pago' : e.status === 'atrasado' ? 'atrasado' : 'pendente',
      _hasAcrescimosDescontos: hasChargesOrDiscounts,
      dueDate: dueIso,
      paymentDate: payDate,
      supplier: e.supplier || 'Fornecedor N/I',
      description: e.description || '',
      categoryName: e.categoryName || e.category || '-',
      costCenterName: e.costCenterName || '-',
      machineryName: e.machineryName || '-',
      bankAccountName: e.bankAccountName || (e.paidViaCashBox ? 'Caixa Interno (PDV)' : '-'),
      paymentMethod: getPaymentMethodLabel(e.paymentMethod),
      originalAmount: orig,
      fineAmount: fine,
      interestAmount: interest,
      discountAmount: discount,
      realAmount: real,
      status: isPaid ? 'Pago' : e.status === 'atrasado' ? 'Atrasado' : 'Em Aberto',
    };
  };

  const buildReceivableRows = (onlyPaid: boolean): Array<Record<string, unknown>> => {
    const list: Array<Record<string, unknown>> = [];

    (orders || [])
      .filter((o) => o && o.status !== 'cancelado')
      .forEach((o) => {
        const isPaid = o.paymentStatus === 'pago';
        if (onlyPaid && !isPaid) return;
        const dueIso = toIsoDateStr(o.dueDate || o.deliveryDate || o.date || o.createdAt);
        const payDate = toIsoDateStr(o.paymentDate || o.paidAt);
        const orig = Number(o.originalAmount ?? o.totalAmount) || 0;
        const fine = Number(o.fineAmount) || 0;
        const interest = Number(o.interestAmount) || 0;
        const discount = Number(o.discountAmount) || 0;
        const real = isPaid ? Number(o.paidAmount ?? o.totalAmount) || 0 : 0;
        list.push({
          _date: onlyPaid ? payDate || dueIso : dueIso,
          _status: isPaid ? 'pago' : 'pendente',
          _hasAcrescimosDescontos: fine + interest > 0.009 || discount > 0.009,
          dueDate: dueIso,
          paymentDate: payDate,
          clientName: o.clientName || 'Cliente N/I',
          origin: 'Venda / Pedido',
          description: `${o.orderNumber ? `#${o.orderNumber} ` : ''}${o.productType || ''}`.trim(),
          bankAccountName: o.bankAccountName || (o.paidViaCashBox ? 'Caixa Interno (PDV)' : '-'),
          paymentMethod: getPaymentMethodLabel(o.paymentMethod),
          originalAmount: orig,
          fineAmount: fine,
          interestAmount: interest,
          discountAmount: discount,
          realAmount: real,
          status: isPaid ? 'Recebido' : 'Em Aberto',
        });
      });

    (services || [])
      .filter(
        (s) =>
          s &&
          s.status !== 'cancelado' &&
          (s.status === 'faturado' ||
            s.billingStatus === 'faturado' ||
            !!s.billedAt ||
            (s.status === 'finalizado' && !!s.billedAt))
      )
      .forEach((s) => {
        const isPaid = s.status === 'finalizado' || s.paymentStatus === 'pago';
        if (onlyPaid && !isPaid) return;
        const dueIso = toIsoDateStr(s.dueDate || s.date || s.startDate);
        const payDate = toIsoDateStr(s.paymentDate || s.paidAt);
        const orig = Number(s.originalAmount ?? s.totalAmount) || 0;
        const fine = Number(s.fineAmount) || 0;
        const interest = Number(s.interestAmount) || 0;
        const discount = Number(s.discountAmount) || 0;
        const real = isPaid ? Number(s.paidAmount ?? s.totalAmount) || 0 : 0;
        list.push({
          _date: onlyPaid ? payDate || dueIso : dueIso,
          _status: isPaid ? 'pago' : 'pendente',
          _hasAcrescimosDescontos: fine + interest > 0.009 || discount > 0.009,
          dueDate: dueIso,
          paymentDate: payDate,
          clientName: s.clientName || 'Cliente N/I',
          origin: 'Prestação de Serviço',
          description: s.serviceType || 'Serviço',
          bankAccountName: s.bankAccountName || (s.paidViaCashBox ? 'Caixa Interno (PDV)' : '-'),
          paymentMethod: getPaymentMethodLabel(s.paymentMethod),
          originalAmount: orig,
          fineAmount: fine,
          interestAmount: interest,
          discountAmount: discount,
          realAmount: real,
          status: isPaid ? 'Recebido' : 'Em Aberto',
        });
      });

    (notasSaida || [])
      .filter((n) => n.lancarContasReceber && n.status !== 'CANCELADA' && n.status !== 'RASCUNHO')
      .forEach((n) => {
        const isPaid = n.receberStatus === 'pago';
        if (onlyPaid && !isPaid) return;
        const dueIso = toIsoDateStr(n.dataVencimento || n.dataEmissao || n.createdAt);
        const payDate = toIsoDateStr(n.receberPaymentDate || n.paidAt);
        const orig = Number(n.originalAmount ?? n.valorTotal) || 0;
        const fine = Number(n.fineAmount) || 0;
        const interest = Number(n.interestAmount) || 0;
        const discount = Number(n.discountAmount) || 0;
        const real = isPaid ? Number(n.paidAmount ?? n.valorTotal) || 0 : 0;
        list.push({
          _date: onlyPaid ? payDate || dueIso : dueIso,
          _status: isPaid ? 'pago' : 'pendente',
          _hasAcrescimosDescontos: fine + interest > 0.009 || discount > 0.009,
          dueDate: dueIso,
          paymentDate: payDate,
          clientName: n.cteTomadorFinalNome || n.destinatarioNome || 'Destinatário N/I',
          origin: 'Nota Fiscal Saída',
          description: `NF ${n.numero}${n.serie ? `/${n.serie}` : ''}`,
          bankAccountName: n.bankAccountName || (n.paidViaCashBox ? 'Caixa Interno (PDV)' : '-'),
          paymentMethod: n.receberPaymentMethod || n.condicaoPagamento || '-',
          originalAmount: orig,
          fineAmount: fine,
          interestAmount: interest,
          discountAmount: discount,
          realAmount: real,
          status: isPaid ? 'Recebido' : 'Em Aberto',
        });
      });

    return list;
  };

  const rawRows = useMemo<Array<Record<string, unknown>>>(() => {
    if (selectedDataset === 'pagar' || selectedDataset === 'despesas') {
      return (expenses || []).map((e) => mapExpenseRow(e, false));
    }

    if (selectedDataset === 'contas_pagas') {
      return (expenses || [])
        .filter((e) => e && e.status === 'pago')
        .map((e) => mapExpenseRow(e, true));
    }

    if (selectedDataset === 'receber') {
      return buildReceivableRows(false);
    }

    if (selectedDataset === 'contas_recebidas') {
      return buildReceivableRows(true);
    }

    if (selectedDataset === 'bancos_extrato') {
      const accountNameMap = new Map<string, string>();
      effectiveBankAccounts.forEach((acc) => {
        accountNameMap.set(acc.id, acc.name || acc.accountName || acc.bankName || 'Conta Bancária');
      });

      const txRows: Array<Record<string, unknown>> = (bankTransactions || []).map((tx) => {
        const isEntrada = tx.type === 'entrada';
        return {
          _date: toIsoDateStr(tx.date || tx.createdAt),
          _status: tx.type,
          date: toIsoDateStr(tx.date || tx.createdAt),
          bankAccountName: tx.bankAccountName || accountNameMap.get(tx.bankAccountId) || 'Conta N/I',
          typeLabel: isEntrada ? 'Entrada (+)' : 'Saída (-)',
          category: tx.category || tx.sourceType || '-',
          description: tx.description || '-',
          amount: isEntrada ? Number(tx.amount) || 0 : -(Number(tx.amount) || 0),
          balanceAfter: Number(tx.balanceAfter) || 0,
        };
      });

      const balanceRows: Array<Record<string, unknown>> = effectiveBankAccounts.map((acc) => {
        const bal = Number(acc.balance ?? acc.currentBalance ?? 0);
        return {
          _date: '',
          _status: 'saldo_atual',
          _bypassDateRange: true,
          date: toIsoDateStr(acc.updatedAt || acc.updated_at || new Date().toISOString()),
          bankAccountName: `${acc.name || acc.accountName || acc.bankName} (${acc.bankName || 'Banco'})`,
          typeLabel: 'Saldo Atual',
          category: acc.accountType || 'corrente',
          description: `Ag: ${acc.agency || '-'} • CC: ${acc.accountNumber || '-'}`,
          amount: 0,
          balanceAfter: bal,
        };
      });

      return [...txRows, ...balanceRows];
    }

    if (selectedDataset === 'fluxo_caixa') {
      return caixasSessoes.map((cx) => {
        const t = calcularTotaisCaixa(cx);
        return {
          _date: toIsoDateStr(cx.dataAbertura),
          _status: cx.status,
          dataAbertura: cx.dataHoraAbertura || cx.dataAbertura || '-',
          caixaId: cx.id || '-',
          operador: cx.operadorAbertura || cx.operador || '-',
          fundoInicial: t.saldoInicial,
          dinheiro: t.vendasDinheiro,
          pixCartoes: t.vendasPix + t.vendasDebito + t.vendasCredito,
          suprimentos: t.totalSuprimentos,
          sangrias: t.totalSangrias,
          saldoFinal: t.saldoTotalGeral,
          diferenca: Number(cx.diferenca) || 0,
          status: cx.status,
        };
      });
    }

    if (selectedDataset === 'cheques') {
      return (cheques || []).map((c) => {
        const d = toIsoDateStr(c.data_vencimento || c.dataVencimento);
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

    if (selectedDataset === 'acertos_terceiros') {
      const list: Array<Record<string, unknown>> = [];
      (settlements || []).forEach((s) => {
        const d = toIsoDateStr(s.date || s.createdAt);
        list.push({
          _date: d,
          _status: s.status,
          _kind: 'terceiro',
          date: d,
          originType: 'Terceiro / Freteiro',
          personName: s.thirdPartyName || '-',
          roleOrRegion: s.role || '-',
          description: s.description || '-',
          grossAmount: Number(s.totalAmount) || 0,
          deductions: Number(s.deductions) || 0,
          netAmount: Number(s.netAmount) || 0,
          status: s.status || 'pendente',
        });
      });
      (brokerSettlements || []).forEach((b) => {
        const d = toIsoDateStr(b.date || b.createdAt);
        list.push({
          _date: d,
          _status: b.status,
          _kind: 'agenciador',
          date: d,
          originType: 'Agenciador / Comissão',
          personName: b.brokerName || '-',
          roleOrRegion: b.actingRegion || '-',
          description: b.description || '-',
          grossAmount: Number(b.grossAmount) || 0,
          deductions: Number(b.deductions) || 0,
          netAmount: Number(b.netAmount) || 0,
          status: b.status || 'pendente',
        });
      });
      return list;
    }

    if (selectedDataset === 'notas_entrada') {
      return (notasEntrada || []).map((doc) => {
        const dEnt = toIsoDateStr(doc.data_entrada || doc.data || doc.created_at);
        const dEmis = toIsoDateStr(doc.data_emissao || doc.data);
        return {
          _date: dEnt || dEmis,
          _status: doc.status || 'Finalizado',
          data: dEnt,
          dataEmissao: dEmis,
          numero: doc.numero || doc.numero_documento || '-',
          serie: doc.serie || '-',
          tipoDocumento: doc.tipo_documento || 'NF-e',
          fornecedor: doc.fornecedor || doc.fornecedor_nome || 'Fornecedor N/I',
          cnpj: doc.fornecedor_cnpj || '-',
          cfop: doc.cfop || '-',
          chave: doc.chave_acesso || '-',
          valorTotal: Number(doc.valor_total) || 0,
          status: doc.status || 'Finalizado',
        };
      });
    }

    if (selectedDataset === 'notas_saida') {
      return (notasSaida || []).map((ns) => {
        const dEmis = toIsoDateStr(ns.dataEmissao || ns.createdAt);
        const normalizedStatus =
          ns.status === 'EMITIDA' || ns.status === 'AUTORIZADA'
            ? 'AUTORIZADA'
            : ns.status || 'EMITIDA';
        return {
          _date: dEmis,
          _status: normalizedStatus,
          dataEmissao: dEmis,
          numero: ns.numero || '-',
          serie: ns.serie || '-',
          tipoDocumento: ns.tipoDocumento || 'NF-e',
          destinatario: ns.destinatarioNome || '-',
          cpfCnpj: ns.destinatarioCpfCnpj || '-',
          cfop: ns.nfeCfop || ns.cteCfop || '-',
          condicaoPagamento: ns.condicaoPagamento || '-',
          valorTotal: Number(ns.valorTotal) || 0,
          status: ns.status || 'EMITIDA',
        };
      });
    }

    if (selectedDataset === 'devolucoes') {
      return (devolucoes || []).map((dev) => {
        const d = toIsoDateStr(dev.data || dev.createdAt);
        return {
          _date: d,
          _status: dev.tipoOperacao,
          data: d,
          protocolo: dev.protocolo || '-',
          natureza:
            dev.naturezaOperacao ||
            (dev.tipoOperacao === 'devolucao_cliente'
              ? 'Devolução de Cliente'
              : dev.tipoOperacao === 'troca_direta'
              ? 'Troca Direta / Garantia'
              : 'Devolução p/ Fornecedor'),
          envolvidoNome: dev.envolvidoNome || '-',
          numeroOrigem: dev.numeroVendaOuNotaOrigem || '-',
          motivo: dev.motivo || '-',
          totalDevolvido: Number(dev.totalDevolvido) || 0,
          totalLevado: Number(dev.totalLevado) || 0,
          saldoFinal: Number(dev.saldoFinal) || 0,
          destinoFinanceiro: dev.destinoFinanceiroLabel || dev.destinoFinanceiro || '-',
          fiscalStatus: dev.fiscalStatus || 'Não Fiscal',
        };
      });
    }

    if (selectedDataset === 'vendas') {
      return (orders || [])
        .filter((o) => o && o.status !== 'cancelado')
        .map((o) => ({
          _date: toIsoDateStr(o.deliveryDate || o.date || o.createdAt),
          _status: o.paymentStatus === 'pago' ? 'pago' : 'pendente',
          deliveryDate: toIsoDateStr(o.deliveryDate || o.date || o.createdAt),
          orderNumber: o.orderNumber || o.id.slice(0, 8),
          clientName: o.clientName || '',
          productType: o.productType || '',
          tons: Number(o.tons ?? o.quantityTons) || 0,
          pricePerTon: Number(o.pricePerTon) || 0,
          totalAmount: Number(o.totalAmount) || 0,
          paymentMethod: getPaymentMethodLabel(o.paymentMethod),
          paymentStatus: o.paymentStatus || 'pendente',
        }));
    }

    if (selectedDataset === 'servicos') {
      return (services || []).map((s) => ({
        _date: toIsoDateStr(s.startDate || s.date || s.dueDate),
        _status: s.status || '',
        startDate: toIsoDateStr(s.startDate || s.date || s.dueDate),
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
        const unitCost = resolveInventoryUnitCost(i);
        const isLow = qty <= 0 || (minQty > 0 && qty <= minQty);
        return {
          _date: '',
          _status: isLow ? 'baixo' : 'ok',
          code: i.code || i.codigo_produto || '-',
          name: i.nome_comercial || i.name || i.nome || '',
          category: i.category || i.categoria || '-',
          location: i.endereco_formatado || i.location || i.localizacao_fisica || '-',
          quantity: qty,
          unit: i.unit || i.unidade_medida || 'un',
          minQuantity: minQty,
          unitCost,
          totalValue: qty * unitCost,
        };
      });
    }

    if (selectedDataset === 'balanco_estoque') {
      const list: Array<Record<string, unknown>> = [];
      (inventoryBalances || []).forEach((bal) => {
        const d = toIsoDateStr(bal.completedAt || bal.createdAt);
        if (Array.isArray(bal.items) && bal.items.length > 0) {
          bal.items.forEach((it) => {
            const sysQ = Number(it.systemQty) || 0;
            const cntQ = it.countedQty !== null && it.countedQty !== undefined ? Number(it.countedQty) : sysQ;
            const diffQ = Number((cntQ - sysQ).toFixed(3));
            const cost = Number(it.unitCost) || 0;
            const diffVal = Number((diffQ * cost).toFixed(2));
            const divType = diffQ > 0.001 ? 'sobra' : diffQ < -0.001 ? 'falta' : 'ok';
            list.push({
              _date: d,
              _status: divType,
              date: d,
              sessionCode: bal.code || '-',
              sessionTitle: bal.title || 'Balanço',
              productCode: it.code || '-',
              productName: it.name || '-',
              systemQty: sysQ,
              countedQty: cntQ,
              diffQty: diffQ,
              unitCost: cost,
              diffValue: diffVal,
              status: diffQ > 0.001 ? 'Sobra (+)' : diffQ < -0.001 ? 'Falta (-)' : 'Conferido OK',
            });
          });
        } else {
          const snap = bal.summarySnapshot;
          const net = Number(snap?.netFinancialImpact) || 0;
          list.push({
            _date: d,
            _status: Math.abs(net) > 0.01 ? (net > 0 ? 'sobra' : 'falta') : 'ok',
            date: d,
            sessionCode: bal.code || '-',
            sessionTitle: bal.title || 'Balanço',
            productCode: '-',
            productName: `${snap?.totalItems || 0} item(ns) no balanço`,
            systemQty: 0,
            countedQty: snap?.countedItems || 0,
            diffQty: snap?.adjustedItems || 0,
            unitCost: 0,
            diffValue: net,
            status: bal.status,
          });
        }
      });
      return list;
    }

    if (selectedDataset === 'almoxarifado_kits') {
      const list: Array<Record<string, unknown>> = [];
      const metaMap = getCaixaMetaMap();
      const invById = new Map<string, InventoryItem>();
      (inventory || []).forEach((it) => invById.set(it.id, it));

      const machById = new Map<string, Machinery>();
      (machineries || []).forEach((m) => machById.set(m.id, m));

      const latestConfByVehicle = new Map<string, CaixaConferenciaRecord>();
      (caixaConferencias || []).forEach((c) => {
        if (!latestConfByVehicle.has(c.veiculo_id)) {
          latestConfByVehicle.set(c.veiculo_id, c);
        }
      });

      (caixaFerramentasItems || []).forEach((item) => {
        const meta = resolveCaixaItemMeta(item, metaMap, inventory);
        const unitCost = Number(meta.valor_unitario_efetivo || meta.valor_unitario || item.valor_unitario || 0);
        const qtyExp = Number(item.quantidade_esperada) || 0;
        const qtyCur = Number(item.quantidade_atual) || 0;
        const mach = item.veiculo_id ? machById.get(item.veiculo_id) : undefined;
        const vehName =
          item.veiculo_nome ||
          (mach ? `${mach.fleetNumber ? `#${mach.fleetNumber} ` : ''}${mach.name || mach.model || ''}`.trim() : 'Sem Veículo');
        const cond = meta.status_conferencia || (qtyCur < qtyExp ? 'faltando' : 'ok');
        const latestConf = item.veiculo_id ? latestConfByVehicle.get(item.veiculo_id) : undefined;
        list.push({
          _date: '',
          _status: cond !== 'ok' ? 'divergencia' : 'veiculo',
          _kind: 'veiculo',
          originType: 'Caixa de Veículo',
          containerName: `${vehName}${item.veiculo_placa || mach?.licensePlateOrSerial ? ` (${item.veiculo_placa || mach?.licensePlateOrSerial})` : ''}`,
          codigo: item.codigo_item_ferramenta || '-',
          nome: item.nome_ferramenta || '-',
          qtyExpected: qtyExp,
          qtyCurrent: qtyCur,
          unitCost,
          totalValue: Number((qtyExp * unitCost).toFixed(2)),
          conferidoPor: item.conferido_por || latestConf?.responsavel_nome || '-',
          status: cond === 'ok' ? 'OK' : cond === 'faltando' ? 'Faltando' : 'Danificada',
        });
      });

      (toolKits || []).forEach((kit) => {
        (kit.itens || []).forEach((it) => {
          const prod = it.produto_id ? invById.get(it.produto_id) : undefined;
          const unitCost = prod ? resolveInventoryUnitCost(prod) : Number(it.valor_unitario || 0);
          const qty = Number(it.quantidade) || 1;
          list.push({
            _date: '',
            _status: 'kit',
            _kind: 'kit',
            originType: 'Kit Padrão',
            containerName: `${kit.nome} (${kit.categoria})`,
            codigo: it.codigo || '-',
            nome: it.nome || '-',
            qtyExpected: qty,
            qtyCurrent: qty,
            unitCost,
            totalValue: Number((qty * unitCost).toFixed(2)),
            conferidoPor: 'Padrão Almoxarifado',
            status: 'Kit Padrão',
          });
        });
      });

      return list;
    }

    if (selectedDataset === 'frota') {
      const maintByMachId = new Map<string, number>();
      (maintenanceLogs || []).forEach((ml) => {
        if (ml.machineryId) {
          maintByMachId.set(ml.machineryId, (maintByMachId.get(ml.machineryId) || 0) + (Number(ml.totalCost) || 0));
        }
      });

      const vehicleRows: Array<Record<string, unknown>> = (machineries || []).map((m) => ({
        _date: '',
        _status: m.status || 'operacional',
        _kind: 'veiculo',
        recordType: 'Veículo / Máquina',
        refDate: toIsoDateStr(m.lastMaintenanceDate || m.purchaseDate),
        fleetNumber: m.fleetNumber || '-',
        plate: m.licensePlateOrSerial || m.plate || m.serialNumber || '-',
        name: `${m.brand ? `${m.brand} ` : ''}${m.model || m.name || ''}`.trim(),
        categoryOrWorkshop: m.categoriaVeiculo || m.categoryType || m.ownership || 'Próprio',
        fipeValue: Number(m.fipeValue) || 0,
        ipvaTotalAmount: Number(m.ipvaTotalAmount) || 0,
        maintenanceCost: maintByMachId.get(m.id) || Number(m.totalMaintenanceExpenses) || 0,
        status: m.status || 'operacional',
      }));

      const maintenanceRows: Array<Record<string, unknown>> = (maintenanceLogs || []).map((ml) => ({
        _date: toIsoDateStr(ml.date),
        _status: ml.status || 'concluida',
        _kind: 'manutencao',
        recordType: 'Manutenção / OS',
        refDate: toIsoDateStr(ml.date),
        fleetNumber: ml.osNumber || ml.orderNumber || '-',
        plate: ml.machineryPlateOrName || '-',
        name: `${ml.serviceCategory || 'Manutenção'} — ${ml.description || ''}`.trim(),
        categoryOrWorkshop: ml.workshopOrMechanic || ml.location || '-',
        fipeValue: 0,
        ipvaTotalAmount: 0,
        maintenanceCost: Number(ml.totalCost) || 0,
        status: ml.status || 'concluida',
      }));

      return [...vehicleRows, ...maintenanceRows];
    }

    if (selectedDataset === 'abastecimentos') {
      return (fuelLogs || []).map((f) => ({
        _date: toIsoDateStr(f.date),
        _status: 'todos',
        date: toIsoDateStr(f.date),
        vehicle: f.machineryPlateOrName || '',
        fuelType: f.fuelType || '',
        liters: Number(f.liters) || 0,
        pricePerLiter: Number(f.pricePerLiter) || 0,
        totalAmount: Number(f.totalAmount) || 0,
        operator: f.driverOrOperator || '-',
        station: f.supplierStation || '-',
      }));
    }

    if (selectedDataset === 'rh_folha_rescisoes') {
      const empRoleById = new Map<string, string>();
      (employees || []).forEach((emp) => empRoleById.set(emp.id, emp.role || '-'));

      const list: Array<Record<string, unknown>> = [];

      (payrolls || []).forEach((p) => {
        const pType = p.payrollType || p.payroll_type || 'monthly';
        const tipoLabel =
          pType === '13_first_packet'
            ? '13º Salário (1ª Parc.)'
            : pType === '13_second_packet'
            ? '13º Salário (2ª Parc.)'
            : 'Folha Mensal';
        const gross =
          (Number(p.baseSalary) || 0) +
          (Number(p.overtimeAmount) || 0) +
          (Number(p.bonusAmount) || 0) +
          (Number(p.commissionAmount) || 0);
        const discounts =
          (Number(p.inssDiscount) || 0) +
          (Number(p.irrfDiscount) || 0) +
          (Number(p.sindicalDiscount ?? p.taxaSindical) || 0) +
          (Number(p.advancesDiscount) || 0) +
          (Number(p.otherDiscounts) || 0);
        const isPaid = p.status === 'pago' || p.status === 'integrado';
        list.push({
          _date: '',
          _status: isPaid ? 'pago' : 'pendente',
          _kind: 'folha',
          competenceOrDate: p.referenceMonth || '-',
          recordType: tipoLabel,
          employeeName: p.employeeName || '-',
          employeeRole: p.employeeRole || empRoleById.get(p.employeeId) || '-',
          baseSalary: Number(p.baseSalary) || 0,
          grossAmount: gross,
          discounts,
          netAmount: Number(p.netSalary) || 0,
          status: p.status || 'pendente',
        });
      });

      (vacations || []).forEach((v) => {
        const gross = Number(v.totalAmount) || 0;
        const discounts = Number(v.totalDiscounts) || 0;
        const net = Number(v.netAmount ?? v.valor_liquido_pago ?? gross) || 0;
        const isPaid =
          v.status === 'concluido' || v.status === 'quitado' || v.situacao_execucao === 'QUITADO';
        list.push({
          _date: '',
          _status: isPaid ? 'pago' : 'pendente',
          _kind: 'ferias',
          competenceOrDate: formatDateBR(v.startDate || ''),
          recordType: 'Férias',
          employeeName: v.employeeName || '-',
          employeeRole: empRoleById.get(v.employeeId) || '-',
          baseSalary: Number(v.baseSalary) || 0,
          grossAmount: gross,
          discounts,
          netAmount: net,
          status: v.situacao_execucao || v.status || 'programado',
        });
      });

      (terminations || []).forEach((t) => {
        const isPaid = t.status === 'pago' || t.status === 'integrado' || t.status === 'homologado';
        list.push({
          _date: '',
          _status: isPaid ? 'pago' : 'pendente',
          _kind: 'rescisao',
          competenceOrDate: formatDateBR(t.terminationDate || ''),
          recordType: 'Rescisão (TRCT)',
          employeeName: t.employeeName || '-',
          employeeRole: t.employeeRole || '-',
          baseSalary: Number(t.baseSalary) || 0,
          grossAmount: Number(t.calculation?.grossTotal) || 0,
          discounts: Number(t.calculation?.totalDeductions) || 0,
          netAmount: Number(t.calculation?.netTotal) || 0,
          status: t.status || 'rascunho',
        });
      });

      return list;
    }

    if (selectedDataset === 'clientes') {
      return (effectiveClients || []).map((c) => ({
        _date: '',
        _status: c.status || 'cliente_ativo',
        code: c.code || c.codigo || '-',
        name: c.name || c.nome || '-',
        farmName: c.farmName || c.fazenda || '-',
        cpfCnpj: c.cpfCnpj || '-',
        phone: c.phone || c.telefone || '-',
        cityState: `${c.city || c.cidade || '-'} / ${c.state || c.estado || '-'}`,
        creditLimit: Number(c.creditLimit) || 0,
        creditBalance: Number(c.creditBalance ?? c.saldoCredito) || 0,
        status: c.status || 'cliente_ativo',
      }));
    }

    if (selectedDataset === 'fornecedores') {
      return (effectiveSuppliers || []).map((s) => ({
        _date: '',
        _status: String(s.category || '').toLowerCase().includes('transport') ? 'transportadora' : 'fornecedor',
        code: s.code || s.codigo || '-',
        name: s.name || '-',
        tradeName: s.tradeName || '-',
        category: s.category || 'Geral',
        cnpjOrCpf: s.cnpjOrCpf || '-',
        phone: s.phone || '-',
        cityState: `${s.city || '-'} / ${s.state || '-'}`,
        defaultPaymentTerm: s.defaultPaymentTerm || '-',
      }));
    }

    // rh
    return (employees || []).map((emp) => ({
      _date: '',
      _status: emp.status || 'ativo',
      name: emp.name || '',
      role: emp.role || '-',
      cpf: emp.cpf || '-',
      admissionDate: toIsoDateStr(emp.admissionDate),
      cnhCategory: emp.cnhCategory || '-',
      cnhExpiration: toIsoDateStr(emp.cnhExpiration),
      baseSalary: Number(emp.baseSalary ?? emp.salary) || 0,
      status: emp.status || 'ativo',
    }));
  }, [
    selectedDataset,
    expenses,
    orders,
    services,
    notasSaida,
    notasEntrada,
    devolucoes,
    cheques,
    bankTransactions,
    effectiveBankAccounts,
    caixasSessoes,
    settlements,
    brokerSettlements,
    inventory,
    inventoryBalances,
    caixaFerramentasItems,
    toolKits,
    caixaConferencias,
    fuelLogs,
    machineries,
    maintenanceLogs,
    employees,
    payrolls,
    vacations,
    terminations,
    effectiveClients,
    effectiveSuppliers,
  ]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return rawRows.filter((row) => {
      if (activeSchema.hasDateRange && !row._bypassDateRange) {
        const d = String(row._date || '');
        if (!d || (customStartDate && d < customStartDate) || (customEndDate && d > customEndDate)) {
          return false;
        }
      }
      if (statusFilter !== 'todos') {
        if (statusFilter === 'com_acrescimos_descontos') {
          if (!row._hasAcrescimosDescontos) return false;
        } else if (
          (selectedDataset === 'pagar' || selectedDataset === 'receber' || selectedDataset === 'despesas') &&
          statusFilter === 'pendente'
        ) {
          if (row._status === 'pago') return false;
        } else if (selectedDataset === 'acertos_terceiros' && (statusFilter === 'terceiro' || statusFilter === 'agenciador')) {
          if (row._kind !== statusFilter) return false;
        } else if (selectedDataset === 'balanco_estoque' && statusFilter === 'com_divergencia') {
          if (row._status === 'ok') return false;
        } else if (selectedDataset === 'almoxarifado_kits') {
          if (statusFilter === 'divergencia') {
            if (row._status !== 'divergencia') return false;
          } else if (row._kind !== statusFilter) {
            return false;
          }
        } else if (selectedDataset === 'frota' && (statusFilter === 'veiculo' || statusFilter === 'manutencao')) {
          if (row._kind !== statusFilter) return false;
        } else if (
          selectedDataset === 'rh_folha_rescisoes' &&
          (statusFilter === 'folha' || statusFilter === 'ferias' || statusFilter === 'rescisao')
        ) {
          if (row._kind !== statusFilter) return false;
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
    const headerLine = visibleColumns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(';') + '\n';
    const bodyLines = filteredRows
      .map((row) =>
        visibleColumns
          .map((col) => {
            const formatted = formatCellDisplay(row[col.key], col);
            return `"${String(formatted).replace(/"/g, '""')}"`;
          })
          .join(';')
      )
      .join('\n');

    let totalsLine = '';
    if (filteredRows.length > 0 && visibleColumns.some((c) => c.summable)) {
      totalsLine =
        '\n' +
        visibleColumns
          .map((col, idx) => {
            if (idx === 0 && !col.summable) {
              return `"TOTAIS (${filteredRows.length} registros)"`;
            }
            if (col.summable) {
              const sum = filteredRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
              const valStr =
                col.format === 'currency'
                  ? formatCurrencyBRL(sum)
                  : sum.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
              return `"${valStr}"`;
            }
            return '""';
          })
          .join(';');
    }

    const blob = new Blob(['\uFEFF' + headerLine + bodyLines + totalsLine], {
      type: 'text/csv;charset=utf-8;',
    });
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
        <div className="min-w-[260px] max-w-[380px] flex-1">
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
            {DATASET_GROUPS.map((group) => (
              <optgroup key={group} label={group}>
                {DATASET_SCHEMAS.filter((ds) => ds.group === group).map((ds) => (
                  <option key={ds.key} value={ds.key}>
                    {ds.label}
                  </option>
                ))}
              </optgroup>
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
        <div className="flex flex-wrap items-center gap-1.5">
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
          <span>
            Prévia em Tempo Real — {activeSchema.group} &gt; {activeSchema.label}
          </span>
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
                      className={`py-2.5 px-3.5 whitespace-nowrap ${
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
                      {visibleColumns.map((col) => {
                        const numVal = Number(row[col.key]) || 0;
                        let valueColorClass = 'text-stone-800 dark:text-stone-200';
                        if (col.tone === 'charge') {
                          valueColorClass =
                            numVal > 0.009
                              ? 'text-red-700 dark:text-red-400 font-black whitespace-nowrap'
                              : 'text-stone-500 dark:text-stone-400 font-medium whitespace-nowrap';
                        } else if (col.tone === 'discount') {
                          valueColorClass =
                            numVal > 0.009
                              ? 'text-emerald-700 dark:text-emerald-400 font-black whitespace-nowrap'
                              : 'text-stone-500 dark:text-stone-400 font-medium whitespace-nowrap';
                        } else if (col.format === 'currency') {
                          valueColorClass = 'text-emerald-800 dark:text-emerald-400 font-black whitespace-nowrap';
                        }

                        return (
                          <td
                            key={col.key}
                            className={`py-2 px-3.5 ${
                              col.align === 'right'
                                ? 'text-right font-bold'
                                : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                            } ${valueColorClass}`}
                          >
                            {formatCellDisplay(row[col.key], col)}
                          </td>
                        );
                      })}
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
                <tfoot className="sticky bottom-0 z-10 bg-[#cad4e6] dark:bg-stone-800 border-t-2 border-black font-black text-xs">
                  <tr>
                    {visibleColumns.map((col, idx) => {
                      if (idx === 0 && !col.summable) {
                        return (
                          <td key={col.key} className="py-2 px-3.5 uppercase whitespace-nowrap">
                            Totais ({filteredRows.length} reg.)
                          </td>
                        );
                      }
                      if (col.summable) {
                        const sum = filteredRows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                        const totalToneClass =
                          col.tone === 'charge' && sum > 0.009
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-emerald-800 dark:text-emerald-300';
                        return (
                          <td
                            key={col.key}
                            className={`py-2 px-3.5 whitespace-nowrap ${
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                            } ${totalToneClass}`}
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
