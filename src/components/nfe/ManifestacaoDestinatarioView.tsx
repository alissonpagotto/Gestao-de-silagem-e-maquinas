import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCheck2, 
  Search, 
  Eye, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  Clock, 
  RefreshCw, 
  ShieldAlert, 
  Building2, 
  Package, 
  DollarSign, 
  FileText, 
  Check, 
  X,
  Copy,
  ArrowUpRight,
  Layers,
  ArrowDownToLine,
  ExternalLink
} from 'lucide-react';
import { CompanyProfile, InventoryItem, Expense } from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getStoredInventory, 
  saveStoredInventory, 
  getStoredExpenses, 
  saveStoredExpenses 
} from '../../lib/storage';

export type TipoManifestacaoSefaz = 'PENDENTE' | 'CIENCIA' | 'CONFIRMADA' | 'NAO_REALIZADA' | 'DESCONHECIDA';

export interface ItemNotaManifestacao {
  id: string;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface NotaManifestacaoSefaz {
  id: string;
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  emitenteNome: string;
  emitenteCnpj: string;
  emitenteUf: string;
  emitenteMunicipio: string;
  destinatarioCnpj: string;
  destinatarioNome: string;
  valorTotal: number;
  statusManifestacao: TipoManifestacaoSefaz;
  protocoloManifestacao?: string;
  dataManifestacao?: string;
  justificativa?: string;
  categoriaGeral?: string;
  itens: ItemNotaManifestacao[];
  vencimento?: string;
  efetivadoEstoque?: boolean;
  efetivadoFinanceiro?: boolean;
  xmlDisponivel?: boolean;
  createdAt: string;
}

export const MANIFESTACOES_STORAGE_KEY = 'agrocontrol_manifestacoes_sefaz';

const INITIAL_NOTAS_MANIFESTACAO: NotaManifestacaoSefaz[] = [
  {
    id: 'manif_001',
    chaveAcesso: '35261001234567000188550010000458121098765432',
    numero: '045812',
    serie: '1',
    dataEmissao: new Date().toISOString(),
    emitenteNome: 'DISTRIBUIDORA DE PECAS E FILTROS VALE VERDE LTDA',
    emitenteCnpj: '01.234.567/0001-88',
    emitenteUf: 'SP',
    emitenteMunicipio: 'Ribeirão Preto',
    destinatarioCnpj: '12.345.678/0001-99',
    destinatarioNome: 'AGROCONTROL SILAGEM & GRAOS S/A',
    valorTotal: 14850.00,
    statusManifestacao: 'PENDENTE',
    categoriaGeral: 'PEÇAS & MANUTENÇÃO',
    vencimento: new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0],
    itens: [
      { id: 'item_1', codigo: 'FILT-098', descricao: 'ELEMENTO FILTRANTE DE AR PRIMARIO TRATOR JD', ncm: '84213100', cfop: '5102', unidade: 'UN', quantidade: 6, valorUnitario: 350.00, valorTotal: 2100.00 },
      { id: 'item_2', codigo: 'OLEO-15W40', descricao: 'OLEO LUBRIFICANTE MINERAL 15W40 CI-4 TAMBOR 200L', ncm: '27101932', cfop: '5102', unidade: 'TB', quantidade: 2, valorUnitario: 4200.00, valorTotal: 8400.00 },
      { id: 'item_3', codigo: 'LAM-SIL', descricao: 'FACA ROTATIVA DE CORTE SILAGEM TRITURADOR', ncm: '82084000', cfop: '5102', unidade: 'PC', quantidade: 15, valorUnitario: 290.00, valorTotal: 4350.00 }
    ],
    efetivadoEstoque: false,
    efetivadoFinanceiro: false,
    xmlDisponivel: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'manif_002',
    chaveAcesso: '35261098765432000144550010000098211087654321',
    numero: '009821',
    serie: '1',
    dataEmissao: new Date(Date.now() - 86400000 * 2).toISOString(),
    emitenteNome: 'IPIRANGA COMBUSTIVEIS & DERIVADOS S/A',
    emitenteCnpj: '98.765.432/0001-44',
    emitenteUf: 'SP',
    emitenteMunicipio: 'Paulinia',
    destinatarioCnpj: '12.345.678/0001-99',
    destinatarioNome: 'AGROCONTROL SILAGEM & GRAOS S/A',
    valorTotal: 58900.00,
    statusManifestacao: 'CIENCIA',
    protocoloManifestacao: '135260012398745',
    dataManifestacao: new Date(Date.now() - 86400000 * 1).toISOString(),
    categoriaGeral: 'COMBUSTÍVEL & ARLA',
    vencimento: new Date(Date.now() + 86400000 * 15).toISOString().split('T')[0],
    itens: [
      { id: 'item_4', codigo: 'DSL-S10', descricao: 'OLEO DIESEL B S10 GRANEL TRUCK', ncm: '27101921', cfop: '5653', unidade: 'LT', quantidade: 10000, valorUnitario: 5.89, valorTotal: 58900.00 }
    ],
    efetivadoEstoque: false,
    efetivadoFinanceiro: false,
    xmlDisponivel: true,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'manif_003',
    chaveAcesso: '31260955667788000122550010000321001076543210',
    numero: '032100',
    serie: '2',
    dataEmissao: new Date(Date.now() - 86400000 * 4).toISOString(),
    emitenteNome: 'YARA BRASIL FERTILIZANTES S/A',
    emitenteCnpj: '55.667.788/0001-22',
    emitenteUf: 'MG',
    emitenteMunicipio: 'Uberaba',
    destinatarioCnpj: '12.345.678/0001-99',
    destinatarioNome: 'AGROCONTROL SILAGEM & GRAOS S/A',
    valorTotal: 84600.00,
    statusManifestacao: 'CONFIRMADA',
    protocoloManifestacao: '131260098745123',
    dataManifestacao: new Date(Date.now() - 86400000 * 3).toISOString(),
    categoriaGeral: 'FERTILIZANTES & QUÍMICOS',
    vencimento: new Date(Date.now() + 86400000 * 28).toISOString().split('T')[0],
    itens: [
      { id: 'item_5', codigo: 'NPK-041408', descricao: 'ADUBO NPK 04-14-08 GRANULADO BIG BAG 1000KG', ncm: '31052000', cfop: '6102', unidade: 'TON', quantidade: 24, valorUnitario: 3525.00, valorTotal: 84600.00 }
    ],
    efetivadoEstoque: true,
    efetivadoFinanceiro: true,
    xmlDisponivel: true,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
  },
  {
    id: 'manif_004',
    chaveAcesso: '41260933221100000199550010000011501065432109',
    numero: '001150',
    serie: '1',
    dataEmissao: new Date(Date.now() - 86400000 * 6).toISOString(),
    emitenteNome: 'COMERCIO DE EQUIPAMENTOS FANTASMA LTDA',
    emitenteCnpj: '33.221.100/0001-99',
    emitenteUf: 'PR',
    emitenteMunicipio: 'Curitiba',
    destinatarioCnpj: '12.345.678/0001-99',
    destinatarioNome: 'AGROCONTROL SILAGEM & GRAOS S/A',
    valorTotal: 39500.00,
    statusManifestacao: 'DESCONHECIDA',
    protocoloManifestacao: '141260077441122',
    dataManifestacao: new Date(Date.now() - 86400000 * 5).toISOString(),
    categoriaGeral: 'DIVERSOS',
    vencimento: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    itens: [
      { id: 'item_6', codigo: 'DIV-99', descricao: 'EQUIPAMENTOS ELETRONICOS DIVERSOS', ncm: '85176279', cfop: '6102', unidade: 'UN', quantidade: 5, valorUnitario: 7900.00, valorTotal: 39500.00 }
    ],
    efetivadoEstoque: false,
    efetivadoFinanceiro: false,
    xmlDisponivel: false,
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString()
  }
];

export const getStoredManifestacoes = (): NotaManifestacaoSefaz[] => {
  try {
    const raw = localStorage.getItem(MANIFESTACOES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MANIFESTACOES_STORAGE_KEY, JSON.stringify(INITIAL_NOTAS_MANIFESTACAO));
      return INITIAL_NOTAS_MANIFESTACAO;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_NOTAS_MANIFESTACAO;
  } catch {
    return INITIAL_NOTAS_MANIFESTACAO;
  }
};

export const saveStoredManifestacoes = (data: NotaManifestacaoSefaz[]) => {
  try {
    localStorage.setItem(MANIFESTACOES_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Erro ao salvar manifestações SEFAZ:', err);
  }
};

interface ManifestacaoDestinatarioViewProps {
  companyProfile: CompanyProfile | null;
  inventory?: InventoryItem[];
  onSaveInventory?: (inv: InventoryItem[]) => void;
  expenses?: Expense[];
  onAddExpenseFromNfe?: (expenses: Expense[]) => void;
  onRefreshAll?: () => void;
}

export const ManifestacaoDestinatarioView: React.FC<ManifestacaoDestinatarioViewProps> = ({
  companyProfile,
  inventory = [],
  onSaveInventory,
  onAddExpenseFromNfe,
  onRefreshAll
}) => {
  const [notas, setNotas] = useState<NotaManifestacaoSefaz[]>(() => getStoredManifestacoes());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | TipoManifestacaoSefaz>('TODOS');
  const [isConsultingSefaz, setIsConsultingSefaz] = useState(false);

  // Modal Padrão Ouro
  const [selectedNota, setSelectedNota] = useState<NotaManifestacaoSefaz | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'DANFE' | 'ITENS' | 'MANIFESTACAO' | 'SEFAZ'>('DANFE');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'alert' | 'error' } | null>(null);

  useEffect(() => {
    saveStoredManifestacoes(notas);
  }, [notas]);

  const showNotification = (message: string, type: 'success' | 'alert' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const filteredNotas = useMemo(() => {
    return notas.filter(n => {
      const matchSearch = 
        n.numero.includes(searchTerm) ||
        n.chaveAcesso.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.emitenteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.emitenteCnpj.includes(searchTerm) ||
        (n.categoriaGeral && n.categoriaGeral.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchStatus = statusFilter === 'TODOS' || n.statusManifestacao === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [notas, searchTerm, statusFilter]);

  // Contadores & Totais
  const totalNotas = notas.length;
  const countCiencia = useMemo(() => notas.filter(n => n.statusManifestacao === 'CIENCIA').length, [notas]);
  const countConfirmada = useMemo(() => notas.filter(n => n.statusManifestacao === 'CONFIRMADA').length, [notas]);
  const countNaoRealizada = useMemo(() => notas.filter(n => n.statusManifestacao === 'NAO_REALIZADA').length, [notas]);
  const countDesconhecida = useMemo(() => notas.filter(n => n.statusManifestacao === 'DESCONHECIDA').length, [notas]);
  const countPendente = useMemo(() => notas.filter(n => n.statusManifestacao === 'PENDENTE').length, [notas]);

  // =========================================================================
  // MOTOR DE REGRAS DE MANIFESTAÇÃO DO DESTINATÁRIO
  // =========================================================================

  // 1. CIÊNCIA DA EMISSÃO
  const handleManifestarCiencia = (notaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const proto = `1352600${Math.floor(10000000 + Math.random() * 90000000)}`;
    const agora = new Date().toISOString();

    setNotas(prev => prev.map(n => {
      if (n.id === notaId) {
        return {
          ...n,
          statusManifestacao: 'CIENCIA',
          protocoloManifestacao: proto,
          dataManifestacao: agora,
          xmlDisponivel: true
        };
      }
      return n;
    }));

    showNotification('CIÊNCIA DA EMISSÃO REGISTRADA COM SUCESSO! DOWNLOAD DO XML LIBERADO.', 'success');
  };

  // 2. CONFIRMAÇÃO DA OPERAÇÃO:
  // Altera o status para "CONFIRMADA", efetiva a entrada dos itens no estoque (+),
  // e gera o lançamento automático no Contas a Pagar do Financeiro.
  const handleManifestarConfirmacao = (notaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const target = notas.find(n => n.id === notaId);
    if (!target) return;

    if (target.statusManifestacao === 'CONFIRMADA') {
      showNotification('ESTA NOTA FISCAL JÁ ESTÁ CONFIRMADA COM ENTRADA EM ESTOQUE E FINANCEIRO.', 'alert');
      return;
    }

    if (!window.confirm(`CONFIRMAR OPERAÇÃO DA NOTA Nº ${target.numero}?\n\nESTA AÇÃO IRÁ:\n1. REGISTRAR O EVENTO NA SEFAZ\n2. SOMAR OS ITENS NO ESTOQUE DA EMPRESA\n3. LANÇAR O VALOR NO CONTAS A PAGAR DO FINANCEIRO`)) {
      return;
    }

    const proto = `1352600${Math.floor(10000000 + Math.random() * 90000000)}`;
    const agora = new Date().toISOString();

    // 2.1 Efetivação no Estoque
    try {
      const currentInventory = inventory.length > 0 ? inventory : getStoredInventory();
      let updatedInv = [...currentInventory];

      target.itens.forEach(item => {
        const itemDescLower = item.descricao.trim().toLowerCase();
        const existingIdx = updatedInv.findIndex(p => 
          (p.code && p.code.toLowerCase().trim() === item.codigo.toLowerCase().trim()) ||
          (p.nome_comercial && p.nome_comercial.toLowerCase().trim() === itemDescLower) ||
          (p.name && p.name.toLowerCase().trim() === itemDescLower)
        );

        if (existingIdx >= 0) {
          const prod = updatedInv[existingIdx];
          const currQty = Number(prod.quantidade_atual ?? prod.quantity) || 0;
          const newQty = currQty + item.quantidade;
          updatedInv[existingIdx] = {
            ...prod,
            quantity: newQty,
            quantidade_atual: newQty,
            unitCost: item.valorUnitario > 0 ? item.valorUnitario : prod.unitCost,
            preco_custo_inicial: item.valorUnitario > 0 ? item.valorUnitario : prod.preco_custo_inicial
          };
        } else {
          const newProduct: InventoryItem = {
            id: `inv_sefaz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            code: item.codigo,
            name: item.descricao.toUpperCase(),
            nome_comercial: item.descricao.toUpperCase(),
            category: target.categoriaGeral || 'INSUMOS & ENTRADAS',
            categoria: target.categoriaGeral || 'INSUMOS & ENTRADAS',
            quantity: item.quantidade,
            unit: item.unidade,
            unitCost: item.valorUnitario,
            preco_custo_inicial: item.valorUnitario,
            minQuantity: 5,
            location: 'ALMOXARIFADO CENTRAL',
            createdAt: agora
          };
          updatedInv.push(newProduct);
        }
      });

      saveStoredInventory(updatedInv);
      if (onSaveInventory) {
        onSaveInventory(updatedInv);
      }
    } catch (err) {
      console.error('Erro ao somar itens ao estoque:', err);
    }

    // 2.2 Efetivação no Financeiro (Contas a Pagar)
    try {
      const currentExpenses = getStoredExpenses();
      const novoLancamento: Expense = {
        id: `pagar_sefaz_${target.id}`,
        description: `NF-E SEFAZ Nº ${target.numero} - ${target.emitenteNome}`.toUpperCase(),
        amount: target.valorTotal,
        categoryId: 'cat_manifestacao_sefaz',
        categoryName: (target.categoriaGeral || 'INSUMOS & ENTRADAS').toUpperCase(),
        category: (target.categoriaGeral || 'INSUMOS & ENTRADAS').toUpperCase(),
        costCenterName: 'OPERACIONAL GERAL',
        categoryColor: '#059669',
        dueDate: target.vencimento || new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
        status: 'pendente',
        paymentMethod: 'boleto',
        supplier: target.emitenteNome.toUpperCase(),
        invoiceNumber: `NF-E ${target.numero}`,
        notes: `CONFIRMAÇÃO DA OPERAÇÃO - MANIFESTAÇÃO SEFAZ. CHAVE: ${target.chaveAcesso}`.toUpperCase(),
        createdAt: agora
      };

      const updatedExpenses = [novoLancamento, ...currentExpenses.filter(e => e.id !== novoLancamento.id)];
      saveStoredExpenses(updatedExpenses);

      if (onAddExpenseFromNfe) {
        onAddExpenseFromNfe([novoLancamento]);
      }
    } catch (err) {
      console.error('Erro ao gerar lançamento financeiro:', err);
    }

    // Atualiza nota
    setNotas(prev => prev.map(n => {
      if (n.id === notaId) {
        return {
          ...n,
          statusManifestacao: 'CONFIRMADA',
          protocoloManifestacao: proto,
          dataManifestacao: agora,
          efetivadoEstoque: true,
          efetivadoFinanceiro: true,
          xmlDisponivel: true
        };
      }
      return n;
    }));

    showNotification(`OPERAÇÃO CONFIRMADA! ITENS INTEGRADOS AO ESTOQUE (+) E CONTAS A PAGAR GERADO COM SUCESSO!`, 'success');
  };

  // 3. OPERAÇÃO NÃO REALIZADA:
  // Altera o status para "NÃO REALIZADA" e bloqueia qualquer movimentação física ou financeira.
  const handleManifestarNaoRealizada = (notaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const motivo = window.prompt('INFORME A JUSTIFICATIVA DE OPERAÇÃO NÃO REALIZADA (MÍNIMO 15 CARACTERES):', 'MERCADORIA NÃO FOI RECEBIDA NO ESTABELECIMENTO');
    if (!motivo || motivo.trim().length < 10) {
      showNotification('JUSTIFICATIVA OBRIGATÓRIA PARA MANIFESTAÇÃO DE OPERAÇÃO NÃO REALIZADA.', 'alert');
      return;
    }

    const proto = `1352600${Math.floor(10000000 + Math.random() * 90000000)}`;
    const agora = new Date().toISOString();

    setNotas(prev => prev.map(n => {
      if (n.id === notaId) {
        return {
          ...n,
          statusManifestacao: 'NAO_REALIZADA',
          protocoloManifestacao: proto,
          dataManifestacao: agora,
          justificativa: motivo.trim().toUpperCase(),
          efetivadoEstoque: false,
          efetivadoFinanceiro: false
        };
      }
      return n;
    }));

    showNotification('OPERAÇÃO NÃO REALIZADA REGISTRADA NA SEFAZ. MOVIMENTAÇÃO FÍSICA E FINANCEIRA BLOQUEADA.', 'alert');
  };

  // 4. DESCONHECIMENTO DA OPERAÇÃO:
  // Altera o status para "DESCONHECIDA" (Alerta em vermelho) para proteção contra fraudes.
  const handleManifestarDesconhecimento = (notaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('ALERTA DE SEGURANÇA SEFAZ:\n\nCONFIRMA O DESCONHECIMENTO DESTA OPERAÇÃO?\nO CNPJ DA EMPRESA SERÁ PROTEGIDO CONTRA COBRANÇAS INDEVIDAS E FRAUDES FISCAIS.')) {
      return;
    }

    const proto = `1352600${Math.floor(10000000 + Math.random() * 90000000)}`;
    const agora = new Date().toISOString();

    setNotas(prev => prev.map(n => {
      if (n.id === notaId) {
        return {
          ...n,
          statusManifestacao: 'DESCONHECIDA',
          protocoloManifestacao: proto,
          dataManifestacao: agora,
          justificativa: 'DESCONHECIMENTO FORMAL DA EMISSÃO - PROTEÇÃO CONTRA FRAUDE',
          efetivadoEstoque: false,
          efetivadoFinanceiro: false
        };
      }
      return n;
    }));

    showNotification('DESCONHECIMENTO REGISTRADO NA SEFAZ COM SUCESSO! NOTA MARCADA COMO FRAUDE POTENCIAL.', 'error');
  };

  // 5. DOWNLOAD XML
  const handleDownloadXml = (nota: NotaManifestacaoSefaz, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${nota.chaveAcesso}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>${nota.numero}</cNF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>${nota.serie}</serie>
        <nNF>${parseInt(nota.numero)}</nNF>
        <dhEmi>${nota.dataEmissao}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
      </ide>
      <emit>
        <CNPJ>${nota.emitenteCnpj.replace(/\D/g, '')}</CNPJ>
        <xNome>${nota.emitenteNome}</xNome>
        <UF>${nota.emitenteUf}</UF>
        <xMun>${nota.emitenteMunicipio}</xMun>
      </emit>
      <dest>
        <CNPJ>${nota.destinatarioCnpj.replace(/\D/g, '')}</CNPJ>
        <xNome>${nota.destinatarioNome}</xNome>
      </dest>
      <total>
        <ICMSTot>
          <vNF>${nota.valorTotal.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SP_NFE_PL_009</verAplic>
      <chNFe>${nota.chaveAcesso}</chNFe>
      <dhRecbto>${nota.dataEmissao}</dhRecbto>
      <nProt>${nota.protocoloManifestacao || '135260098765432'}</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NFe_${nota.chaveAcesso}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification(`XML DA NOTA Nº ${nota.numero} BAIXADO COM SUCESSO!`);
  };

  // Simular Consulta SEFAZ
  const handleConsultarSefaz = () => {
    setIsConsultingSefaz(true);
    setTimeout(() => {
      setIsConsultingSefaz(false);
      showNotification('CONSULTA SEFAZ CONCLUÍDA: TODOS OS DOCUMENTOS SINCRONIZADOS COM A BASE NACIONAL.');
    }, 1200);
  };

  const handleOpenDetailModal = (nota: NotaManifestacaoSefaz) => {
    setSelectedNota(nota);
    setModalTab('DANFE');
    setIsDetailModalOpen(true);
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    showNotification('CHAVE DE ACESSO DA NOTA FISCAL COPIADA COM SUCESSO.');
  };

  return (
    <div className="w-full space-y-3">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200' 
            : notification.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200'
            : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
            {notification.type === 'error' && <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />}
            {notification.type === 'alert' && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. CARDS INDICADORES INTERNOS (MOLDURA FINA DE AÇO CINZA) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            NOTAS IDENTIFICADAS SEFAZ
          </span>
          <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
            {totalNotas} NF-E
          </div>
          <span className="text-[9px] font-bold text-amber-600 uppercase block">
            {countPendente} PENDENTE(S)
          </span>
        </div>

        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            CIÊNCIA DA EMISSÃO
          </span>
          <div className="text-base font-black text-sky-700 dark:text-sky-400 mt-0.5">
            {countCiencia} NOTA(S)
          </div>
          <span className="text-[9px] font-bold text-slate-500 uppercase block">
            XML LIBERADO
          </span>
        </div>

        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            CONFIRMADAS (ESTOQUE & FIN)
          </span>
          <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {countConfirmada} NOTA(S)
          </div>
          <span className="text-[9px] font-bold text-emerald-700 uppercase block">
            INTEGRADAS COM SUCESSO
          </span>
        </div>

        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            NÃO REALIZADAS
          </span>
          <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {countNaoRealizada} NOTA(S)
          </div>
          <span className="text-[9px] font-bold text-amber-700 uppercase block">
            BLOQUEADAS
          </span>
        </div>

        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            DESCONHECIDAS (FRAUDES)
          </span>
          <div className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {countDesconhecida} ALERTA(S)
          </div>
          <span className="text-[9px] font-bold text-rose-700 uppercase block">
            BLINDAGEM JURÍDICA
          </span>
        </div>
      </div>

      {/* 2. BARRA DE FERRAMENTAS E FILTROS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="BUSCAR POR NÚMERO, CHAVE, FORNECEDOR OU CNPJ..."
              className="w-full pl-8 pr-2.5 py-1 text-[11px] font-medium bg-slate-50 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-slate-900 dark:text-stone-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 uppercase"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1 text-[10px] font-bold uppercase bg-slate-50 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-slate-700 dark:text-stone-300 focus:outline-none cursor-pointer"
          >
            <option value="TODOS">TODAS AS MANIFESTAÇÕES</option>
            <option value="PENDENTE">PENDENTES DE MANIFESTAÇÃO</option>
            <option value="CIENCIA">CIÊNCIA DA EMISSÃO</option>
            <option value="CONFIRMADA">CONFIRMADAS</option>
            <option value="NAO_REALIZADA">NÃO REALIZADAS</option>
            <option value="DESCONHECIDA">DESCONHECIDAS (ALERTA FRAUDE)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleConsultarSefaz}
          disabled={isConsultingSefaz}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white text-[10px] font-bold uppercase rounded border border-slate-600 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isConsultingSefaz ? 'animate-spin' : ''}`} />
          <span>{isConsultingSefaz ? 'CONSULTANDO SEFAZ...' : 'CONSULTAR SEFAZ AGORA'}</span>
        </button>
      </div>

      {/* 3. TABELA SLIM PADRÃO OURO (PY-1, WHITESPACE-NOWRAP, TEXTOS EM UPPERCASE) */}
      <div className="border border-slate-300 dark:border-stone-700 rounded bg-white dark:bg-stone-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-[10px] font-bold text-slate-600 dark:text-stone-300 uppercase tracking-wider select-none">
                <th className="py-1 px-2.5 whitespace-nowrap">Nº NF-E</th>
                <th className="py-1 px-2.5 whitespace-nowrap">EMISSÃO</th>
                <th className="py-1 px-2.5 whitespace-nowrap">FORNECEDOR / EMITENTE</th>
                <th className="py-1 px-2.5 whitespace-nowrap text-right">VALOR TOTAL</th>
                <th className="py-1 px-2.5 whitespace-nowrap">STATUS MANIFESTAÇÃO</th>
                <th className="py-1 px-2.5 whitespace-nowrap text-center">AÇÕES DE MANIFESTAÇÃO (SEFAZ)</th>
                <th className="py-1 px-2.5 whitespace-nowrap text-center">XML</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-stone-800 text-[11px] font-medium text-slate-800 dark:text-stone-200">
              {filteredNotas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500 uppercase text-xs font-semibold">
                    NENHUMA NOTA FISCAL ENCONTRADA NA CONSULTA DA SEFAZ
                  </td>
                </tr>
              ) : (
                filteredNotas.map((n) => {
                  const statusBadges = {
                    PENDENTE: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700',
                    CIENCIA: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-700',
                    CONFIRMADA: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700',
                    NAO_REALIZADA: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700',
                    DESCONHECIDA: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700 font-black animate-pulse'
                  }[n.statusManifestacao];

                  const statusLabels = {
                    PENDENTE: 'PENDENTE',
                    CIENCIA: 'CIÊNCIA',
                    CONFIRMADA: 'CONFIRMADA',
                    NAO_REALIZADA: 'NÃO REALIZADA',
                    DESCONHECIDA: 'DESCONHECIDA (FRAUDE)'
                  }[n.statusManifestacao];

                  return (
                    <tr 
                      key={n.id}
                      onClick={() => handleOpenDetailModal(n)}
                      className="hover:bg-slate-50 dark:hover:bg-stone-850/60 transition cursor-pointer group"
                    >
                      {/* Nº NF-E */}
                      <td className="py-1 px-2.5 whitespace-nowrap font-bold text-slate-900 dark:text-white uppercase">
                        <span>{n.numero}</span>
                        <span className="text-[9px] text-slate-400 ml-1">S:{n.serie}</span>
                      </td>

                      {/* Emissão */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-slate-600 dark:text-stone-300 uppercase text-[10.5px]">
                        {formatDateBR(n.dataEmissao)}
                      </td>

                      {/* Emitente */}
                      <td className="py-1 px-2.5 whitespace-nowrap uppercase">
                        <div className="flex flex-col leading-tight max-w-xs">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {n.emitenteNome}
                          </span>
                          <span className="text-[9.5px] text-slate-500 font-mono">
                            {n.emitenteCnpj} ({n.emitenteMunicipio}/{n.emitenteUf})
                          </span>
                        </div>
                      </td>

                      {/* Valor Total */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-right font-black text-slate-900 dark:text-white font-mono text-[11px]">
                        {formatCurrencyBRL(n.valorTotal)}
                      </td>

                      {/* Status Manifestação */}
                      <td className="py-1 px-2.5 whitespace-nowrap uppercase">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${statusBadges}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          <span>{statusLabels}</span>
                        </span>
                      </td>

                      {/* 4 BOTÕES RÁPIDOS DE MANIFESTAÇÃO SEFAZ */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* 1. CIÊNCIA DA EMISSÃO */}
                          <button
                            type="button"
                            onClick={(e) => handleManifestarCiencia(n.id, e)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition cursor-pointer ${
                              n.statusManifestacao === 'CIENCIA'
                                ? 'bg-sky-600 text-white shadow-2xs'
                                : 'bg-sky-100 hover:bg-sky-200 text-sky-900 dark:bg-sky-950 dark:hover:bg-sky-900 dark:text-sky-300'
                            }`}
                            title="DECLARAR CIÊNCIA DA OPERAÇÃO PARA LIBERAR O DOWNLOAD DO XML"
                          >
                            CIÊNCIA
                          </button>

                          {/* 2. CONFIRMAÇÃO DA OPERAÇÃO */}
                          <button
                            type="button"
                            onClick={(e) => handleManifestarConfirmacao(n.id, e)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition cursor-pointer ${
                              n.statusManifestacao === 'CONFIRMADA'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300'
                            }`}
                            title="CONFIRMAR OPERAÇÃO: ENTRADA AUTOMÁTICA NO ESTOQUE E LANÇAMENTO NO FINANCEIRO"
                          >
                            CONFIRMAR
                          </button>

                          {/* 3. OPERAÇÃO NÃO REALIZADA */}
                          <button
                            type="button"
                            onClick={(e) => handleManifestarNaoRealizada(n.id, e)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition cursor-pointer ${
                              n.statusManifestacao === 'NAO_REALIZADA'
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300'
                            }`}
                            title="DECLARAR QUE A OPERAÇÃO NÃO FOI REALIZADA (BLOQUEIA ESTOQUE E FINANCEIRO)"
                          >
                            NÃO REALIZADA
                          </button>

                          {/* 4. DESCONHECIMENTO DA OPERAÇÃO */}
                          <button
                            type="button"
                            onClick={(e) => handleManifestarDesconhecimento(n.id, e)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition cursor-pointer ${
                              n.statusManifestacao === 'DESCONHECIDA'
                                ? 'bg-rose-600 text-white shadow-2xs font-black'
                                : 'bg-rose-100 hover:bg-rose-200 text-rose-900 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300'
                            }`}
                            title="DESCONHECER OPERAÇÃO - ALERTA CONTRA FRAUDES"
                          >
                            DESCONHECER
                          </button>

                          {/* Ver Detalhes */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(n)}
                            className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300 text-[9px] font-bold uppercase transition cursor-pointer ml-1"
                            title="VER DETALHES COMPLETOS DA NOTA SEFAZ"
                          >
                            DETALHES
                          </button>
                        </div>
                      </td>

                      {/* BOTÃO VERDE BAIXAR XML */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                        {(n.statusManifestacao === 'CIENCIA' || n.statusManifestacao === 'CONFIRMADA' || n.xmlDisponivel) ? (
                          <button
                            type="button"
                            onClick={(e) => handleDownloadXml(n, e)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase rounded shadow-2xs transition cursor-pointer whitespace-nowrap animate-in fade-in"
                            title="BAIXAR ARQUIVO XML OFICIAL SEFAZ"
                          >
                            <Download className="w-2.5 h-2.5 stroke-[2.5]" />
                            <span>BAIXAR XML</span>
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-bold uppercase" title="MANIFESTE CIÊNCIA OU CONFIRMAÇÃO PARA LIBERAR O XML">
                            BLOQUEADO
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL DETALHES DA NOTA SEFAZ (TAMANHO PADRÃO OURO: MAX-W-4XL H-[95VH]) */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header - Moldura Metálica 3D Acetinada */}
            <div className="px-4 py-2 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 flex items-center justify-between shrink-0 rounded-t-lg shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                  <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
                    <span>DETALHES DA NOTA SEFAZ Nº {selectedNota.numero}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 text-slate-800 dark:text-stone-200 font-bold">
                      {selectedNota.statusManifestacao}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-600 dark:text-stone-400 font-mono truncate max-w-lg">
                    CHAVE: {selectedNota.chaveAcesso}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyKey(selectedNota.chaveAcesso)}
                  className="p-1 rounded bg-white/80 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-white text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                  title="COPIAR CHAVE"
                >
                  <Copy className="w-3 h-3" />
                  <span className="hidden sm:inline">COPIAR CHAVE</span>
                </button>

                {(selectedNota.statusManifestacao === 'CIENCIA' || selectedNota.statusManifestacao === 'CONFIRMADA' || selectedNota.xmlDisponivel) && (
                  <button
                    type="button"
                    onClick={(e) => handleDownloadXml(selectedNota, e)}
                    className="p-1 rounded bg-emerald-600 text-white text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer hover:bg-emerald-700"
                    title="BAIXAR XML"
                  >
                    <Download className="w-3 h-3" />
                    <span className="hidden sm:inline">BAIXAR XML</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-abas do Modal */}
            <div className="bg-slate-200 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 px-3 py-1 flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-none">
              {(['DANFE', 'ITENS', 'MANIFESTACAO', 'SEFAZ'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setModalTab(tab)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition cursor-pointer whitespace-nowrap ${
                    modalTab === tab
                      ? 'bg-white text-slate-900 dark:bg-stone-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-stone-400 hover:text-slate-900'
                  }`}
                >
                  {tab === 'DANFE' ? 'ESPELHO DANFE' : tab === 'ITENS' ? 'ITENS DA NOTA' : tab === 'MANIFESTACAO' ? 'EVENTOS DE MANIFESTAÇÃO' : 'DADOS FISCAIS SEFAZ'}
                </button>
              ))}
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 text-xs space-y-3 bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-200">
              {modalTab === 'DANFE' && (
                <div className="border border-slate-400 rounded p-4 bg-white text-slate-950 font-sans space-y-3 shadow-xs">
                  {/* Cabeçalho DANFE */}
                  <div className="border-b-2 border-slate-950 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider">{selectedNota.emitenteNome}</h4>
                      <p className="text-[10px] text-slate-700 uppercase">
                        CNPJ: {selectedNota.emitenteCnpj} • {selectedNota.emitenteMunicipio} / {selectedNota.emitenteUf}
                      </p>
                    </div>
                    <div className="border border-slate-950 p-2 rounded text-center min-w-[200px] bg-slate-50">
                      <div className="text-[10px] font-bold uppercase">DANFE</div>
                      <div className="text-[8px] text-slate-600 uppercase">DOCUMENTO AUXILIAR DE NF-E</div>
                      <div className="text-sm font-black mt-1">Nº {selectedNota.numero}</div>
                      <div className="text-[9px] font-bold">SÉRIE {selectedNota.serie}</div>
                    </div>
                  </div>

                  {/* Chave de 44 dígitos */}
                  <div className="border border-slate-950 p-2 rounded bg-slate-50 text-center">
                    <span className="text-[9px] font-bold uppercase block text-slate-600">CHAVE DE ACESSO NF-E:</span>
                    <span className="font-mono text-xs font-black tracking-wider select-all">{selectedNota.chaveAcesso}</span>
                    <div className="text-[9px] text-slate-600 uppercase mt-0.5">
                      EMISSÃO: <strong>{formatDateBR(selectedNota.dataEmissao)}</strong> • VENCIMENTO: <strong>{selectedNota.vencimento ? formatDateBR(selectedNota.vencimento) : 'À VISTA'}</strong>
                    </div>
                  </div>

                  {/* Destinatário */}
                  <div className="border border-slate-300 p-2 rounded bg-slate-50 uppercase text-[10px]">
                    <span className="text-slate-500 font-bold block text-[8px]">DESTINATÁRIO / REMETENTE:</span>
                    <strong>{selectedNota.destinatarioNome}</strong> • CNPJ: {selectedNota.destinatarioCnpj}
                  </div>

                  {/* Tabela de Produtos */}
                  <div className="border border-slate-300 rounded overflow-hidden">
                    <div className="bg-slate-200 px-2 py-1 text-[9px] font-black uppercase text-slate-800">
                      ITENS E PRODUTOS IDENTIFICADOS NA NOTA FISCAL
                    </div>
                    <table className="w-full text-left text-[9.5px]">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50 text-slate-600 uppercase">
                          <th className="py-1 px-2">CÓDIGO</th>
                          <th className="py-1 px-2">DESCRIÇÃO</th>
                          <th className="py-1 px-2">NCM</th>
                          <th className="py-1 px-2 text-center">UN</th>
                          <th className="py-1 px-2 text-right">QTD</th>
                          <th className="py-1 px-2 text-right">VALOR UNIT.</th>
                          <th className="py-1 px-2 text-right">VALOR TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 uppercase">
                        {selectedNota.itens.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-1 px-2 font-mono font-bold">{item.codigo}</td>
                            <td className="py-1 px-2">{item.descricao}</td>
                            <td className="py-1 px-2 font-mono">{item.ncm}</td>
                            <td className="py-1 px-2 text-center font-bold">{item.unidade}</td>
                            <td className="py-1 px-2 text-right font-mono">{item.quantidade.toLocaleString('pt-BR')}</td>
                            <td className="py-1 px-2 text-right font-mono">{formatCurrencyBRL(item.valorUnitario)}</td>
                            <td className="py-1 px-2 text-right font-mono font-bold">{formatCurrencyBRL(item.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totalizador */}
                  <div className="flex justify-end p-2 bg-slate-100 rounded border border-slate-300 text-right">
                    <div>
                      <span className="text-[10px] text-slate-600 uppercase block font-bold">VALOR TOTAL DA NOTA FISCAL:</span>
                      <strong className="text-base font-black text-slate-950 font-mono">{formatCurrencyBRL(selectedNota.valorTotal)}</strong>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'ITENS' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase">
                    PRODUTOS COM ENTRADA PROGRAMADA PARA O ESTOQUE:
                  </div>
                  <div className="border border-slate-300 dark:border-stone-700 rounded overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-slate-600 dark:text-stone-300 uppercase font-bold text-[10px]">
                          <th className="p-2">CÓDIGO</th>
                          <th className="p-2">DESCRIÇÃO DO ITEM</th>
                          <th className="p-2">NCM</th>
                          <th className="p-2">CFOP</th>
                          <th className="p-2 text-center">UN</th>
                          <th className="p-2 text-right">QUANTIDADE</th>
                          <th className="p-2 text-right">VALOR UNITÁRIO</th>
                          <th className="p-2 text-right">VALOR TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-stone-800 uppercase font-medium">
                        {selectedNota.itens.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-stone-850">
                            <td className="p-2 font-mono font-bold">{it.codigo}</td>
                            <td className="p-2 font-bold">{it.descricao}</td>
                            <td className="p-2 font-mono text-[10px]">{it.ncm}</td>
                            <td className="p-2 font-mono text-[10px]">{it.cfop}</td>
                            <td className="p-2 text-center font-bold">{it.unidade}</td>
                            <td className="p-2 text-right font-mono font-bold">{it.quantidade.toLocaleString('pt-BR')}</td>
                            <td className="p-2 text-right font-mono">{formatCurrencyBRL(it.valorUnitario)}</td>
                            <td className="p-2 text-right font-mono font-black">{formatCurrencyBRL(it.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {modalTab === 'MANIFESTACAO' && (
                <div className="space-y-3">
                  <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-2 uppercase">
                    <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                      <FileCheck2 className="w-4 h-4 text-emerald-600" />
                      <span>HISTÓRICO DE MANIFESTAÇÃO SEFAZ (EVENTOS VINCULADOS)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px]">STATUS ATUAL:</span>
                        <strong className="text-sm font-black">{selectedNota.statusManifestacao}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px]">PROTOCOLO SEFAZ:</span>
                        <strong className="font-mono text-sm">{selectedNota.protocoloManifestacao || 'AGUARDANDO MANIFESTAÇÃO'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px]">DATA DO EVENTO:</span>
                        <strong>{selectedNota.dataManifestacao ? formatDateBR(selectedNota.dataManifestacao) : '-'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold block text-[10px]">ESTOQUE & FINANCEIRO:</span>
                        <strong>{selectedNota.efetivadoEstoque ? 'ENTRADA EFETIVADA (+)' : 'NÃO INTEGRADO'}</strong>
                      </div>
                    </div>

                    {selectedNota.justificativa && (
                      <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-amber-900 dark:text-amber-200 text-xs">
                        <strong>JUSTIFICATIVA REGISTRADA:</strong> {selectedNota.justificativa}
                      </div>
                    )}
                  </div>

                  {/* Disparadores rápidos dentro do modal */}
                  <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-white dark:bg-stone-900 space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-stone-300 uppercase block">
                      ALTERAR MANIFESTAÇÃO AGORA:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleManifestarCiencia(selectedNota.id);
                          setSelectedNota({ ...selectedNota, statusManifestacao: 'CIENCIA', xmlDisponivel: true });
                        }}
                        className="p-2 rounded border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 text-center font-bold text-[10px] uppercase cursor-pointer"
                      >
                        1. CIÊNCIA DA EMISSÃO
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleManifestarConfirmacao(selectedNota.id);
                          setSelectedNota({ ...selectedNota, statusManifestacao: 'CONFIRMADA', efetivadoEstoque: true, efetivadoFinanceiro: true, xmlDisponivel: true });
                        }}
                        className="p-2 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 text-center font-bold text-[10px] uppercase cursor-pointer"
                      >
                        2. CONFIRMAR OPERAÇÃO
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleManifestarNaoRealizada(selectedNota.id);
                          setSelectedNota({ ...selectedNota, statusManifestacao: 'NAO_REALIZADA' });
                        }}
                        className="p-2 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 text-center font-bold text-[10px] uppercase cursor-pointer"
                      >
                        3. NÃO REALIZADA
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleManifestarDesconhecimento(selectedNota.id);
                          setSelectedNota({ ...selectedNota, statusManifestacao: 'DESCONHECIDA' });
                        }}
                        className="p-2 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 text-center font-bold text-[10px] uppercase cursor-pointer"
                      >
                        4. DESCONHECER (FRAUDE)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'SEFAZ' && (
                <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-2 uppercase text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-stone-200">
                    <Building2 className="w-4 h-4 text-slate-600" />
                    <span>METADADOS DA COMUNICAÇÃO SEFAZ (AMBIENTE NACIONAL)</span>
                  </div>
                  <div><strong>WEBSERVICE:</strong> NfeDistribuicaoDFe • VERSÃO SCHEMA: 1.01</div>
                  <div><strong>CNPJ CONSULTADO:</strong> {selectedNota.destinatarioCnpj}</div>
                  <div><strong>ÚLTIMO NSU SINCRONIZADO:</strong> 000000000089123</div>
                  <div><strong>CHAVE DA NOTA FISCAL:</strong> <span className="font-mono">{selectedNota.chaveAcesso}</span></div>
                  <div><strong>PROTOCOLO AUTORIZAÇÃO:</strong> {selectedNota.protocoloManifestacao || '135260012398745'}</div>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="px-4 py-2 border-t border-slate-300 dark:border-stone-800 bg-slate-100 dark:bg-stone-850 flex items-center justify-between shrink-0">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                PORTAL FISCAL SEFAZ • MANIFESTAÇÃO ELETRÔNICA DO DESTINATÁRIO
              </div>
              <div className="flex items-center gap-2">
                {(selectedNota.statusManifestacao === 'CIENCIA' || selectedNota.statusManifestacao === 'CONFIRMADA' || selectedNota.xmlDisponivel) && (
                  <button
                    type="button"
                    onClick={(e) => handleDownloadXml(selectedNota, e)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase transition cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>BAIXAR XML</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-3 py-1 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-200 rounded text-[10px] font-bold uppercase transition cursor-pointer"
                >
                  FECHAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
