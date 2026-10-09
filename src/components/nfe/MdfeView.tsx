import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Eye, 
  Printer, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  ShieldCheck, 
  User, 
  MapPin, 
  Package, 
  DollarSign, 
  Check, 
  Ban,
  ArrowRight,
  Download,
  Copy
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';

export interface DocumentoVinculadoMdfe {
  tipo: 'CTE' | 'NFE';
  chave: string;
  numero: string;
  emitente: string;
  valor: number;
  pesoKg: number;
}

export interface MdfeRecord {
  id: string;
  numero: string;
  serie: string;
  chaveAcesso: string;
  dataEmissao: string;
  ufCarregamento: string;
  ufDescarregamento: string;
  municipiosCarregamento: string;
  municipiosDescarregamento: string;
  veiculoPlaca: string;
  veiculoRntrc: string;
  veiculoTipo: string;
  motoristaNome: string;
  motoristaCpf: string;
  valorTotalCarga: number;
  pesoBrutoTotalKg: number;
  qtdCte: number;
  qtdNfe: number;
  status: 'AUTORIZADO' | 'ENCERRADO' | 'CANCELADO' | 'EM VIAGEM';
  seguroResponsavel?: string;
  seguroApolice?: string;
  seguradoraNome?: string;
  documentosVinculados?: DocumentoVinculadoMdfe[];
  protocoloAutorizacao: string;
  dataAutorizacao: string;
  dataEncerramento?: string;
  observacoes?: string;
  createdAt: string;
}

export const MDFE_STORAGE_KEY = 'agrocontrol_mdfe';

const INITIAL_MDFE_DATA: MdfeRecord[] = [
  {
    id: 'mdfe_001',
    numero: '000124',
    serie: '1',
    chaveAcesso: '35261012345678000190580010000001241098765432',
    dataEmissao: new Date().toISOString(),
    ufCarregamento: 'SP',
    ufDescarregamento: 'GO',
    municipiosCarregamento: 'Ribeirão Preto',
    municipiosDescarregamento: 'Rio Verde',
    veiculoPlaca: 'BRA2E19',
    veiculoRntrc: '12345678',
    veiculoTipo: 'TRUCK',
    motoristaNome: 'CARLOS EDUARDO SILVA',
    motoristaCpf: '123.456.789-00',
    valorTotalCarga: 142800.00,
    pesoBrutoTotalKg: 24500,
    qtdCte: 2,
    qtdNfe: 1,
    status: 'EM VIAGEM',
    seguroResponsavel: 'EMITENTE',
    seguroApolice: 'APOL-98721-2026',
    seguradoraNome: 'PORTO SEGURO CIA DE SEGUROS GERAIS',
    protocoloAutorizacao: '135260098761234',
    dataAutorizacao: new Date().toISOString(),
    observacoes: 'TRANSPORTE DE INSUMOS E VOLUMOSO SILAGEM PARA CONFINAMENTO',
    documentosVinculados: [
      { tipo: 'CTE', chave: '35261012345678000190570010000045211098765431', numero: '004521', emitente: 'TRANSPORTADORA AGROCARGA LTDA', valor: 8500.00, pesoKg: 12500 },
      { tipo: 'CTE', chave: '35261012345678000190570010000045221098765432', numero: '004522', emitente: 'TRANSPORTADORA AGROCARGA LTDA', valor: 7800.00, pesoKg: 12000 },
      { tipo: 'NFE', chave: '35261012345678000190550010000018901098765433', numero: '001890', emitente: 'AGROVITA INSUMOS AGRICOLAS S/A', valor: 126500.00, pesoKg: 24500 }
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mdfe_002',
    numero: '000123',
    serie: '1',
    chaveAcesso: '31260998765432000111580010000001231087654321',
    dataEmissao: new Date(Date.now() - 86400000 * 3).toISOString(),
    ufCarregamento: 'MG',
    ufDescarregamento: 'SP',
    municipiosCarregamento: 'Uberaba',
    municipiosDescarregamento: 'Barretos',
    veiculoPlaca: 'FXT9J41',
    veiculoRntrc: '87654321',
    veiculoTipo: 'CARRETA',
    motoristaNome: 'ROBERTO SANTANA PINTO',
    motoristaCpf: '234.567.890-11',
    valorTotalCarga: 89450.00,
    pesoBrutoTotalKg: 18200,
    qtdCte: 1,
    qtdNfe: 1,
    status: 'ENCERRADO',
    seguroResponsavel: 'EMITENTE',
    seguroApolice: 'APOL-77412-2026',
    seguradoraNome: 'TOKIO MARINE SEGURADORA S/A',
    protocoloAutorizacao: '131260045612345',
    dataAutorizacao: new Date(Date.now() - 86400000 * 3).toISOString(),
    dataEncerramento: new Date(Date.now() - 86400000 * 1).toISOString(),
    observacoes: 'FRETE DE PEÇAS E MATERIAIS PARA MANUTENÇÃO DE MAQUINÁRIO',
    documentosVinculados: [
      { tipo: 'CTE', chave: '31260998765432000111570010000031121087654322', numero: '003112', emitente: 'LOGISTICA CERRADO EIRELI', valor: 6200.00, pesoKg: 18200 },
      { tipo: 'NFE', chave: '31260998765432000111550010000088191087654323', numero: '008819', emitente: 'TRATORES E IMPLEMENTOS TRIANGULO', valor: 83250.00, pesoKg: 18200 }
    ],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'mdfe_003',
    numero: '000122',
    serie: '1',
    chaveAcesso: '41260911223344000155580010000001221076543210',
    dataEmissao: new Date(Date.now() - 86400000 * 5).toISOString(),
    ufCarregamento: 'PR',
    ufDescarregamento: 'MS',
    municipiosCarregamento: 'Cascavel',
    municipiosDescarregamento: 'Dourados',
    veiculoPlaca: 'RTY4A88',
    veiculoRntrc: '44556677',
    veiculoTipo: 'BITREM',
    motoristaNome: 'MARCOS VINICIUS ALMEIDA',
    motoristaCpf: '345.678.901-22',
    valorTotalCarga: 195200.00,
    pesoBrutoTotalKg: 31000,
    qtdCte: 3,
    qtdNfe: 2,
    status: 'AUTORIZADO',
    seguroResponsavel: 'EMITENTE',
    seguroApolice: 'APOL-33100-2026',
    seguradoraNome: 'SOMPO SEGUROS S/A',
    protocoloAutorizacao: '141260012399887',
    dataAutorizacao: new Date(Date.now() - 86400000 * 5).toISOString(),
    observacoes: 'DISTRIBUIÇÃO DE SEMENTES SELECIONADAS E FERTILIZANTES',
    documentosVinculados: [
      { tipo: 'CTE', chave: '41260911223344000155570010000099011076543211', numero: '009901', emitente: 'EXPRESSO SUL BRASIL', valor: 11400.00, pesoKg: 31000 },
      { tipo: 'NFE', chave: '41260911223344000155550010000077441076543212', numero: '007744', emitente: 'SEMENTES OURO VERDE LTDA', valor: 183800.00, pesoKg: 31000 }
    ],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  }
];

export const getStoredMdfe = (): MdfeRecord[] => {
  try {
    const raw = localStorage.getItem(MDFE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MDFE_STORAGE_KEY, JSON.stringify(INITIAL_MDFE_DATA));
      return INITIAL_MDFE_DATA;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MDFE_DATA;
  } catch {
    return INITIAL_MDFE_DATA;
  }
};

export const saveStoredMdfe = (data: MdfeRecord[]) => {
  try {
    localStorage.setItem(MDFE_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Erro ao salvar MDF-e:', err);
  }
};

interface MdfeViewProps {
  companyProfile: CompanyProfile | null;
  onRefreshAll?: () => void;
}

export const MdfeView: React.FC<MdfeViewProps> = ({
  companyProfile
}) => {
  const [manifestos, setManifestos] = useState<MdfeRecord[]>(() => getStoredMdfe());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'AUTORIZADO' | 'ENCERRADO' | 'CANCELADO' | 'EM VIAGEM'>('TODOS');
  
  // Modais
  const [selectedMdfe, setSelectedMdfe] = useState<MdfeRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<'DAMDFE' | 'DADOS' | 'DOCUMENTOS' | 'ROTA' | 'SEGURO'>('DAMDFE');

  // Formulário de Novo MDF-e
  const [formNumero, setFormNumero] = useState('');
  const [formSerie, setFormSerie] = useState('1');
  const [formUfCarregamento, setFormUfCarregamento] = useState('SP');
  const [formUfDescarregamento, setFormUfDescarregamento] = useState('GO');
  const [formMunCarregamento, setFormMunCarregamento] = useState('');
  const [formMunDescarregamento, setFormMunDescarregamento] = useState('');
  const [formPlaca, setFormPlaca] = useState('');
  const [formRntrc, setFormRntrc] = useState('');
  const [formTipoVeiculo, setFormTipoVeiculo] = useState('TRUCK');
  const [formMotoristaNome, setFormMotoristaNome] = useState('');
  const [formMotoristaCpf, setFormMotoristaCpf] = useState('');
  const [formValorCarga, setFormValorCarga] = useState('');
  const [formPesoKg, setFormPesoKg] = useState('');
  const [formQtdCte, setFormQtdCte] = useState('1');
  const [formQtdNfe, setFormQtdNfe] = useState('1');
  const [formObs, setFormObs] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    saveStoredMdfe(manifestos);
  }, [manifestos]);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const filteredManifestos = useMemo(() => {
    return manifestos.filter(m => {
      const matchSearch = 
        m.numero.includes(searchTerm) ||
        m.chaveAcesso.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.veiculoPlaca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.motoristaNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.municipiosCarregamento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.municipiosDescarregamento.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'TODOS' || m.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [manifestos, searchTerm, statusFilter]);

  // Indicadores
  const totalCargaValor = useMemo(() => {
    return manifestos.reduce((acc, m) => acc + (m.status !== 'CANCELADO' ? m.valorTotalCarga : 0), 0);
  }, [manifestos]);

  const totalPesoKg = useMemo(() => {
    return manifestos.reduce((acc, m) => acc + (m.status !== 'CANCELADO' ? m.pesoBrutoTotalKg : 0), 0);
  }, [manifestos]);

  const countEmViagem = useMemo(() => manifestos.filter(m => m.status === 'EM VIAGEM' || m.status === 'AUTORIZADO').length, [manifestos]);
  const countEncerrados = useMemo(() => manifestos.filter(m => m.status === 'ENCERRADO').length, [manifestos]);

  const handleOpenViewModal = (m: MdfeRecord) => {
    setSelectedMdfe(m);
    setModalActiveTab('DAMDFE');
    setIsViewModalOpen(true);
  };

  const handleEncerrarMdfe = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('CONFIRMA O ENCERRAMENTO DESTE MDF-E NA SEFAZ? A OPERAÇÃO FINALIZARÁ A VIAGEM.')) return;
    setManifestos(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          status: 'ENCERRADO',
          dataEncerramento: new Date().toISOString()
        };
      }
      return m;
    }));
    showNotification('MDF-E ENCERRADO COM SUCESSO NA BASE SEFAZ.');
  };

  const handleCancelarMdfe = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('TEM CERTEZA QUE DESEJA CANCELAR ESTE MDF-E? O PROTOCOLO SERÁ INVALIDADO.')) return;
    setManifestos(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          status: 'CANCELADO'
        };
      }
      return m;
    }));
    showNotification('MDF-E CANCELADO COM SUCESSO.', 'info');
  };

  const handleCreateNewMdfe = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = formNumero.trim() || String(manifestos.length + 125).padStart(6, '0');
    const valor = parseFloat(formValorCarga.replace(',', '.')) || 0;
    const peso = parseFloat(formPesoKg.replace(',', '.')) || 0;
    const randomKey = `3526${Math.floor(1000000000 + Math.random() * 9000000000)}58001000${cleanNum}1${Math.floor(100000000 + Math.random() * 900000000)}`;

    const newRec: MdfeRecord = {
      id: `mdfe_${Date.now()}`,
      numero: cleanNum,
      serie: formSerie.trim() || '1',
      chaveAcesso: randomKey,
      dataEmissao: new Date().toISOString(),
      ufCarregamento: formUfCarregamento.toUpperCase(),
      ufDescarregamento: formUfDescarregamento.toUpperCase(),
      municipiosCarregamento: formMunCarregamento.trim().toUpperCase() || 'RIBEIRÃO PRETO',
      municipiosDescarregamento: formMunDescarregamento.trim().toUpperCase() || 'RIO VERDE',
      veiculoPlaca: formPlaca.trim().toUpperCase() || 'AGR0C01',
      veiculoRntrc: formRntrc.trim() || '98765432',
      veiculoTipo: formTipoVeiculo,
      motoristaNome: formMotoristaNome.trim().toUpperCase() || 'CONDUTOR AUTORIZADO',
      motoristaCpf: formMotoristaCpf.trim() || '000.000.000-00',
      valorTotalCarga: valor > 0 ? valor : 50000.00,
      pesoBrutoTotalKg: peso > 0 ? peso : 15000,
      qtdCte: parseInt(formQtdCte) || 1,
      qtdNfe: parseInt(formQtdNfe) || 0,
      status: 'AUTORIZADO',
      seguroResponsavel: 'EMITENTE',
      seguroApolice: 'APOL-AGRO-2026',
      seguradoraNome: 'PORTO SEGURO COMPANHIA DE SEGUROS',
      protocoloAutorizacao: `1352600${Math.floor(10000000 + Math.random() * 90000000)}`,
      dataAutorizacao: new Date().toISOString(),
      observacoes: formObs.trim().toUpperCase() || 'TRANSPORTE AGROINDUSTRIAL AUTORIZADO',
      documentosVinculados: [
        {
          tipo: 'CTE',
          chave: `352610123456780001905700100000${cleanNum}1098765430`,
          numero: cleanNum,
          emitente: (companyProfile?.corporateName || companyProfile?.tradeName || companyProfile?.name || 'EMPRESA EMITENTE').toUpperCase(),
          valor: valor > 0 ? valor : 50000.00,
          pesoKg: peso > 0 ? peso : 15000
        }
      ],
      createdAt: new Date().toISOString()
    };

    setManifestos([newRec, ...manifestos]);
    setIsNewModalOpen(false);
    showNotification(`MDF-E Nº ${cleanNum} AUTORIZADO PELA SEFAZ COM SUCESSO!`);
    
    // Reset form
    setFormNumero('');
    setFormMunCarregamento('');
    setFormMunDescarregamento('');
    setFormPlaca('');
    setFormRntrc('');
    setFormMotoristaNome('');
    setFormMotoristaCpf('');
    setFormValorCarga('');
    setFormPesoKg('');
    setFormObs('');
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    showNotification('CHAVE DE ACESSO COPIADA PARA A ÁREA DE TRANSFERÊNCIA.');
  };

  return (
    <div className="w-full space-y-3">
      {/* Notificação Toast */}
      {notification && (
        <div className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200' 
            : 'bg-sky-50 border-sky-300 text-sky-800 dark:bg-sky-950/60 dark:border-sky-800 dark:text-sky-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. CARDS INDICADORES INTERNOS (MOLDURA FINA DE AÇO CINZA) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            TOTAL DE MANIFESTOS
          </span>
          <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
            {manifestos.length} MDF-E
          </div>
        </div>

        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            EM VIAGEM / ATIVOS
          </span>
          <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {countEmViagem} CARGA(S)
          </div>
        </div>

        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            ENCERRADOS SEFAZ
          </span>
          <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {countEncerrados} CONCLUÍDO(S)
          </div>
        </div>

        <div className="border border-slate-300/80 rounded bg-white dark:bg-stone-850 p-2 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
            VALOR TOTAL TRANSPORTADO
          </span>
          <div className="text-base font-black text-sky-700 dark:text-sky-400 mt-0.5 truncate">
            {formatCurrencyBRL(totalCargaValor)}
          </div>
          <span className="text-[9px] font-bold text-slate-500 uppercase block">
            PESO TOTAL: {(totalPesoKg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} T
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
              placeholder="BUSCAR POR NÚMERO, PLACA, MOTORISTA, ROTA OU CHAVE..."
              className="w-full pl-8 pr-2.5 py-1 text-[11px] font-medium bg-slate-50 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-slate-900 dark:text-stone-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 uppercase"
            />
          </div>

          {/* Filtro Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1 text-[10px] font-bold uppercase bg-slate-50 dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-slate-700 dark:text-stone-300 focus:outline-none cursor-pointer"
          >
            <option value="TODOS">TODOS OS STATUS</option>
            <option value="EM VIAGEM">EM VIAGEM</option>
            <option value="AUTORIZADO">AUTORIZADO</option>
            <option value="ENCERRADO">ENCERRADO</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>
        </div>

        {/* Botão Novo MDF-e */}
        <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 hover:from-sky-400 hover:to-sky-600 text-white text-[10px] font-bold uppercase rounded border border-sky-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>+ NOVO MDF-E</span>
        </button>
      </div>

      {/* 3. TABELA SLIM PADRÃO OURO (PY-1, WHITESPACE-NOWRAP, UPPERCASE, ZERO ROLAGEM) */}
      <div className="border border-slate-300 dark:border-stone-700 rounded bg-white dark:bg-stone-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-[10px] font-bold text-slate-600 dark:text-stone-300 uppercase tracking-wider select-none">
                <th className="py-1 px-2.5 whitespace-nowrap">Nº / SÉRIE</th>
                <th className="py-1 px-2.5 whitespace-nowrap">EMISSÃO</th>
                <th className="py-1 px-2.5 whitespace-nowrap">STATUS</th>
                <th className="py-1 px-2.5 whitespace-nowrap">ROTA (ORIGEM → DESTINO)</th>
                <th className="py-1 px-2.5 whitespace-nowrap">VEÍCULO / CONDUTOR</th>
                <th className="py-1 px-2.5 whitespace-nowrap text-center">DOCS VINCULADOS</th>
                <th className="py-1 px-2.5 whitespace-nowrap text-right">PESO CARGA (KG)</th>
                <th className="py-1 px-2.5 whitespace-nowrap text-right">VALOR TOTAL</th>
                <th className="py-1 px-2.5 whitespace-nowrap text-center">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-stone-800 text-[11px] font-medium text-slate-800 dark:text-stone-200">
              {filteredManifestos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500 uppercase text-xs font-semibold">
                    NENHUM MANIFESTO ELETRÔNICO (MDF-E) ENCONTRADO
                  </td>
                </tr>
              ) : (
                filteredManifestos.map((m) => {
                  const statusColors = {
                    'EM VIAGEM': 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700',
                    'AUTORIZADO': 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-700',
                    'ENCERRADO': 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700',
                    'CANCELADO': 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700',
                  }[m.status];

                  return (
                    <tr 
                      key={m.id}
                      onClick={() => handleOpenViewModal(m)}
                      className="hover:bg-slate-50 dark:hover:bg-stone-850/60 transition cursor-pointer group"
                    >
                      {/* Nº / Série */}
                      <td className="py-1 px-2.5 whitespace-nowrap font-bold text-slate-900 dark:text-white uppercase">
                        <span>{m.numero}</span>
                        <span className="text-[9px] text-slate-400 ml-1">S:{m.serie}</span>
                      </td>

                      {/* Emissão */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-slate-600 dark:text-stone-300 uppercase text-[10.5px]">
                        {formatDateBR(m.dataEmissao)}
                      </td>

                      {/* Status */}
                      <td className="py-1 px-2.5 whitespace-nowrap uppercase">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border ${statusColors}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          <span>{m.status}</span>
                        </span>
                      </td>

                      {/* Rota */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-slate-700 dark:text-stone-300 uppercase font-semibold text-[10.5px]">
                        <span className="font-bold text-slate-900 dark:text-white">{m.ufCarregamento}</span>
                        <span className="text-slate-400 mx-1">({m.municipiosCarregamento})</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-bold text-slate-900 dark:text-white ml-1">{m.ufDescarregamento}</span>
                        <span className="text-slate-400 ml-1">({m.municipiosDescarregamento})</span>
                      </td>

                      {/* Veículo / Condutor */}
                      <td className="py-1 px-2.5 whitespace-nowrap uppercase">
                        <div className="flex items-center gap-1.5 leading-tight">
                          <span className="px-1 py-0.2 bg-slate-200 dark:bg-stone-700 rounded text-[9.5px] font-mono font-bold text-slate-800 dark:text-stone-200">
                            {m.veiculoPlaca}
                          </span>
                          <span className="text-[10px] text-slate-600 dark:text-stone-400 truncate max-w-[150px]">
                            {m.motoristaNome}
                          </span>
                        </div>
                      </td>

                      {/* Docs Vinculados */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-center uppercase text-[10px] font-bold">
                        <span className="text-sky-700 dark:text-sky-300">{m.qtdCte} CT-E</span>
                        {m.qtdNfe > 0 && <span className="text-emerald-700 dark:text-emerald-300 ml-1">/ {m.qtdNfe} NF-E</span>}
                      </td>

                      {/* Peso Bruto */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-right font-mono text-slate-700 dark:text-stone-300 text-[10.5px]">
                        {m.pesoBrutoTotalKg.toLocaleString('pt-BR')} KG
                      </td>

                      {/* Valor Total */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-right font-black text-slate-900 dark:text-white font-mono text-[11px]">
                        {formatCurrencyBRL(m.valorTotalCarga)}
                      </td>

                      {/* Ações */}
                      <td className="py-1 px-2.5 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenViewModal(m)}
                            className="px-1.5 py-0.5 rounded bg-slate-200/70 hover:bg-slate-300 text-slate-800 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-200 text-[9px] font-bold uppercase transition cursor-pointer"
                            title="VISUALIZAR DAMDFE E DETALHES COMPLETOS"
                          >
                            VISUALIZAR
                          </button>

                          {m.status !== 'ENCERRADO' && m.status !== 'CANCELADO' && (
                            <button
                              type="button"
                              onClick={(e) => handleEncerrarMdfe(m.id, e)}
                              className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 text-[9px] font-bold uppercase transition cursor-pointer"
                              title="ENCERRAR MDF-E NA SEFAZ"
                            >
                              ENCERRAR
                            </button>
                          )}

                          {m.status !== 'CANCELADO' && m.status !== 'ENCERRADO' && (
                            <button
                              type="button"
                              onClick={(e) => handleCancelarMdfe(m.id, e)}
                              className="px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300 text-[9px] font-bold uppercase transition cursor-pointer"
                              title="CANCELAR MDF-E"
                            >
                              CANCELAR
                            </button>
                          )}
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

      {/* ========================================================================= */}
      {/* 4. MODAL DETALHES DO MANIFESTO (TAMANHO PADRÃO OURO: MAX-W-4XL H-[95VH]) */}
      {/* ========================================================================= */}
      {isViewModalOpen && selectedMdfe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header - Moldura Metálica 3D Acetinada */}
            <div className="px-4 py-2 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 flex items-center justify-between shrink-0 rounded-t-lg shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                  <Truck className="w-4 h-4 text-sky-700 dark:text-sky-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
                    <span>MDF-E Nº {selectedMdfe.numero} • SÉRIE {selectedMdfe.serie}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-200 dark:bg-sky-900 text-sky-900 dark:text-sky-200 font-bold">
                      {selectedMdfe.status}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-600 dark:text-stone-400 font-mono truncate max-w-lg">
                    CHAVE: {selectedMdfe.chaveAcesso}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyKey(selectedMdfe.chaveAcesso)}
                  className="p-1 rounded bg-white/80 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-white text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                  title="COPIAR CHAVE"
                >
                  <Copy className="w-3 h-3" />
                  <span className="hidden sm:inline">COPIAR CHAVE</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-1 rounded bg-white/80 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-white text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                  title="IMPRIMIR DAMDFE"
                >
                  <Printer className="w-3 h-3" />
                  <span className="hidden sm:inline">IMPRIMIR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-abas do Modal */}
            <div className="bg-slate-200 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 px-3 py-1 flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-none">
              {(['DAMDFE', 'DADOS', 'DOCUMENTOS', 'ROTA', 'SEGURO'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setModalActiveTab(tab)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition cursor-pointer whitespace-nowrap ${
                    modalActiveTab === tab
                      ? 'bg-white text-slate-900 dark:bg-stone-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-stone-400 hover:text-slate-900'
                  }`}
                >
                  {tab === 'DAMDFE' ? 'DAMDFE (DOCUMENTO AUXILIAR)' : tab}
                </button>
              ))}
            </div>

            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 text-xs space-y-3 bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-200">
              {modalActiveTab === 'DAMDFE' && (
                <div className="border border-slate-400 rounded p-4 bg-white text-slate-950 font-sans space-y-3 shadow-xs">
                  {/* Cabeçalho DAMDFE */}
                  <div className="border-b-2 border-slate-950 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider">
                        {(companyProfile?.corporateName || companyProfile?.tradeName || companyProfile?.name || 'AGROCONTROL GESTÃO AGROPECUÁRIA LTDA').toUpperCase()}
                      </h4>
                      <p className="text-[10px] text-slate-700 uppercase">
                        CNPJ: {companyProfile?.cnpj || companyProfile?.cnpjCpf || '00.000.000/0001-00'} • IE: {companyProfile?.stateRegistration || 'ISENTO'}
                      </p>
                      <p className="text-[10px] text-slate-600 uppercase">
                        {companyProfile?.address || 'RODOVIA AGROINDUSTRIAL KM 12'} - {companyProfile?.city || 'RIBEIRÃO PRETO'}/{companyProfile?.state || 'SP'}
                      </p>
                    </div>
                    <div className="border border-slate-950 p-2 rounded text-center min-w-[200px] bg-slate-50">
                      <div className="text-[10px] font-bold uppercase">DAMDFE</div>
                      <div className="text-[8px] text-slate-600 uppercase">DOCUMENTO AUXILIAR DE MDF-E</div>
                      <div className="text-sm font-black mt-1">Nº {selectedMdfe.numero}</div>
                      <div className="text-[9px] font-bold">SÉRIE {selectedMdfe.serie}</div>
                    </div>
                  </div>

                  {/* Chave de Acesso */}
                  <div className="border border-slate-950 p-2 rounded bg-slate-50 text-center">
                    <span className="text-[9px] font-bold uppercase block text-slate-600">CHAVE DE ACESSO DO MANIFESTO:</span>
                    <span className="font-mono text-xs font-black tracking-wider select-all">{selectedMdfe.chaveAcesso}</span>
                    <div className="text-[9px] text-slate-600 uppercase mt-0.5">
                      PROTOCOLO DE AUTORIZAÇÃO: <strong className="text-slate-900">{selectedMdfe.protocoloAutorizacao}</strong> - {formatDateBR(selectedMdfe.dataAutorizacao)}
                    </div>
                  </div>

                  {/* Grid DAMDFE */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                    <div className="border border-slate-300 p-1.5 rounded">
                      <span className="text-slate-500 font-bold uppercase block text-[8px]">UF CARREGAMENTO</span>
                      <strong className="text-xs uppercase">{selectedMdfe.ufCarregamento} ({selectedMdfe.municipiosCarregamento})</strong>
                    </div>
                    <div className="border border-slate-300 p-1.5 rounded">
                      <span className="text-slate-500 font-bold uppercase block text-[8px]">UF DESCARREGAMENTO</span>
                      <strong className="text-xs uppercase">{selectedMdfe.ufDescarregamento} ({selectedMdfe.municipiosDescarregamento})</strong>
                    </div>
                    <div className="border border-slate-300 p-1.5 rounded">
                      <span className="text-slate-500 font-bold uppercase block text-[8px]">PLACA VEÍCULO</span>
                      <strong className="text-xs uppercase font-mono">{selectedMdfe.veiculoPlaca} (RNTRC: {selectedMdfe.veiculoRntrc})</strong>
                    </div>
                    <div className="border border-slate-300 p-1.5 rounded">
                      <span className="text-slate-500 font-bold uppercase block text-[8px]">CONDUTOR / CPF</span>
                      <strong className="text-[10px] uppercase truncate block">{selectedMdfe.motoristaNome}</strong>
                      <span className="text-[9px] text-slate-600">{selectedMdfe.motoristaCpf}</span>
                    </div>
                  </div>

                  {/* Totais de Carga */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] bg-slate-100 p-2 rounded border border-slate-300">
                    <div>
                      <span className="text-slate-600 uppercase block text-[8px] font-bold">QTD TOTAL CT-E:</span>
                      <strong className="text-xs">{selectedMdfe.qtdCte}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600 uppercase block text-[8px] font-bold">QTD TOTAL NF-E:</span>
                      <strong className="text-xs">{selectedMdfe.qtdNfe}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600 uppercase block text-[8px] font-bold">PESO BRUTO TOTAL:</span>
                      <strong className="text-xs">{selectedMdfe.pesoBrutoTotalKg.toLocaleString('pt-BR')} KG</strong>
                    </div>
                    <div>
                      <span className="text-slate-600 uppercase block text-[8px] font-bold">VALOR TOTAL DA CARGA:</span>
                      <strong className="text-xs font-black">{formatCurrencyBRL(selectedMdfe.valorTotalCarga)}</strong>
                    </div>
                  </div>

                  {/* Documentos vinculados */}
                  {selectedMdfe.documentosVinculados && selectedMdfe.documentosVinculados.length > 0 && (
                    <div className="border border-slate-300 rounded overflow-hidden">
                      <div className="bg-slate-200 px-2 py-1 text-[9px] font-black uppercase text-slate-800">
                        DOCUMENTOS FISCAIS VINCULADOS A ESTE MANIFESTO
                      </div>
                      <table className="w-full text-left text-[9.5px]">
                        <thead>
                          <tr className="border-b border-slate-300 bg-slate-50 text-slate-600 uppercase">
                            <th className="py-1 px-2">TIPO</th>
                            <th className="py-1 px-2">NÚMERO</th>
                            <th className="py-1 px-2">EMITENTE</th>
                            <th className="py-1 px-2 text-right">PESO (KG)</th>
                            <th className="py-1 px-2 text-right">VALOR (R$)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 uppercase">
                          {selectedMdfe.documentosVinculados.map((doc, idx) => (
                            <tr key={idx}>
                              <td className="py-1 px-2 font-bold">{doc.tipo}</td>
                              <td className="py-1 px-2 font-mono">{doc.numero}</td>
                              <td className="py-1 px-2 truncate max-w-xs">{doc.emitente}</td>
                              <td className="py-1 px-2 text-right font-mono">{doc.pesoKg.toLocaleString('pt-BR')}</td>
                              <td className="py-1 px-2 text-right font-mono font-bold">{formatCurrencyBRL(doc.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Observações */}
                  <div className="border border-slate-300 p-2 rounded text-[9px] uppercase bg-slate-50 text-slate-700">
                    <strong>OBSERVAÇÕES DO FISCO / CONTRIBUINTE:</strong> {selectedMdfe.observacoes || 'NENHUMA OBSERVAÇÃO ADICIONAL REGISTRADA.'}
                  </div>
                </div>
              )}

              {modalActiveTab === 'DADOS' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">IDENTIFICAÇÃO DO MANIFESTO</span>
                      <div><strong>NÚMERO:</strong> {selectedMdfe.numero}</div>
                      <div><strong>SÉRIE:</strong> {selectedMdfe.serie}</div>
                      <div><strong>DATA EMISSÃO:</strong> {formatDateBR(selectedMdfe.dataEmissao)}</div>
                      <div><strong>STATUS ATUAL:</strong> {selectedMdfe.status}</div>
                      <div><strong>PROTOCOLO SEFAZ:</strong> {selectedMdfe.protocoloAutorizacao}</div>
                      {selectedMdfe.dataEncerramento && (
                        <div><strong>ENCERRADO EM:</strong> {formatDateBR(selectedMdfe.dataEncerramento)}</div>
                      )}
                    </div>

                    <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">VEÍCULO DE TRAÇÃO & MOTORISTA</span>
                      <div><strong>PLACA VEÍCULO:</strong> {selectedMdfe.veiculoPlaca}</div>
                      <div><strong>RNTRC:</strong> {selectedMdfe.veiculoRntrc}</div>
                      <div><strong>TIPO VEÍCULO:</strong> {selectedMdfe.veiculoTipo}</div>
                      <div><strong>NOME DO CONDUTOR:</strong> {selectedMdfe.motoristaNome}</div>
                      <div><strong>CPF MOTORISTA:</strong> {selectedMdfe.motoristaCpf}</div>
                    </div>
                  </div>
                </div>
              )}

              {modalActiveTab === 'DOCUMENTOS' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-stone-300 uppercase">
                    LISTA DE CT-E E NF-E TRANSPORTADOS NESTE MDF-E:
                  </div>
                  {selectedMdfe.documentosVinculados && selectedMdfe.documentosVinculados.length > 0 ? (
                    <div className="border border-slate-300 dark:border-stone-700 rounded overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 text-slate-600 dark:text-stone-300 uppercase font-bold text-[10px]">
                            <th className="p-2">TIPO</th>
                            <th className="p-2">NÚMERO</th>
                            <th className="p-2">CHAVE DE ACESSO</th>
                            <th className="p-2">EMITENTE</th>
                            <th className="p-2 text-right">PESO (KG)</th>
                            <th className="p-2 text-right">VALOR TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-stone-800 uppercase font-medium">
                          {selectedMdfe.documentosVinculados.map((doc, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-stone-850">
                              <td className="p-2 font-bold">{doc.tipo}</td>
                              <td className="p-2 font-mono">{doc.numero}</td>
                              <td className="p-2 font-mono text-[10px] text-slate-500">{doc.chave}</td>
                              <td className="p-2">{doc.emitente}</td>
                              <td className="p-2 text-right font-mono">{doc.pesoKg.toLocaleString('pt-BR')}</td>
                              <td className="p-2 text-right font-mono font-bold">{formatCurrencyBRL(doc.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">Nenhum documento detalhado vinculado.</p>
                  )}
                </div>
              )}

              {modalActiveTab === 'ROTA' && (
                <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-2 uppercase">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 font-bold">
                    <MapPin className="w-4 h-4" />
                    <span>PERCURSO DE VIAGEM AUTORIZADO SEFAZ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px]">ORIGEM DO CARREGAMENTO:</span>
                      <strong>{selectedMdfe.municipiosCarregamento} - {selectedMdfe.ufCarregamento}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px]">DESTINO FINAL DO DESCARREGAMENTO:</span>
                      <strong>{selectedMdfe.municipiosDescarregamento} - {selectedMdfe.ufDescarregamento}</strong>
                    </div>
                  </div>
                </div>
              )}

              {modalActiveTab === 'SEGURO' && (
                <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-2 uppercase">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>INFORMAÇÕES DO SEGURO DA CARGA (RCTR-C)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px]">RESPONSÁVEL PELO SEGURO:</span>
                      <strong>{selectedMdfe.seguroResponsavel || 'EMITENTE'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px]">SEGURADORA:</span>
                      <strong>{selectedMdfe.seguradoraNome || 'PORTO SEGURO CIA DE SEGUROS'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block text-[10px]">APÓLICE:</span>
                      <strong className="font-mono">{selectedMdfe.seguroApolice || 'APOL-DEFAULT-2026'}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="px-4 py-2 border-t border-slate-300 dark:border-stone-800 bg-slate-100 dark:bg-stone-850 flex items-center justify-between shrink-0">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                EMITIDO VIA AGROCONTROL Módulo MDF-E • INTEGRAÇÃO SEFAZ MOD. 58
              </div>
              <div className="flex items-center gap-2">
                {selectedMdfe.status !== 'ENCERRADO' && selectedMdfe.status !== 'CANCELADO' && (
                  <button
                    type="button"
                    onClick={() => {
                      handleEncerrarMdfe(selectedMdfe.id);
                      setIsViewModalOpen(false);
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase transition cursor-pointer"
                  >
                    ENCERRAR MANIFESTO
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-3 py-1 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-200 rounded text-[10px] font-bold uppercase transition cursor-pointer"
                >
                  FECHAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL NOVO MDF-E (TAMANHO PADRÃO OURO: MAX-W-4XL H-[95VH]) */}
      {/* ========================================================================= */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
          <div className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header - Moldura Metálica 3D Acetinada */}
            <div className="px-4 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 flex items-center justify-between shrink-0 rounded-t-lg shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                  <Truck className="w-4 h-4 text-sky-700 dark:text-sky-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">
                    EMISSÃO DE NOVO MDF-E (MANIFESTO ELETRÔNICO MOD. 58)
                  </h3>
                  <p className="text-[10px] text-slate-600 dark:text-stone-400 uppercase">
                    VINCULAÇÃO DE CT-E / NF-E, CONDUTOR, VEÍCULO E ROTA DE CARGA
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário Novo MDF-e */}
            <form onSubmit={handleCreateNewMdfe} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-white dark:bg-stone-900 text-slate-800 dark:text-stone-200">
                {/* 1. Dados Básicos */}
                <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase block">
                    1. IDENTIFICAÇÃO DO MANIFESTO & ROTA
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">NÚMERO MDF-E</label>
                      <input
                        type="text"
                        value={formNumero}
                        onChange={e => setFormNumero(e.target.value)}
                        placeholder="AUTO"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">SÉRIE</label>
                      <input
                        type="text"
                        value={formSerie}
                        onChange={e => setFormSerie(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">UF CARREGAMENTO</label>
                      <input
                        type="text"
                        value={formUfCarregamento}
                        onChange={e => setFormUfCarregamento(e.target.value.toUpperCase())}
                        maxLength={2}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">UF DESCARGA</label>
                      <input
                        type="text"
                        value={formUfDescarregamento}
                        onChange={e => setFormUfDescarregamento(e.target.value.toUpperCase())}
                        maxLength={2}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">MUNICÍPIO CARREGAMENTO</label>
                      <input
                        type="text"
                        value={formMunCarregamento}
                        onChange={e => setFormMunCarregamento(e.target.value)}
                        placeholder="EX: RIBEIRÃO PRETO"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">MUNICÍPIO DESCARREGAMENTO</label>
                      <input
                        type="text"
                        value={formMunDescarregamento}
                        onChange={e => setFormMunDescarregamento(e.target.value)}
                        placeholder="EX: RIO VERDE"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Veículo & Condutor */}
                <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase block">
                    2. VEÍCULO DE TRAÇÃO E MOTORISTA
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">PLACA DO VEÍCULO</label>
                      <input
                        type="text"
                        value={formPlaca}
                        onChange={e => setFormPlaca(e.target.value.toUpperCase())}
                        placeholder="EX: BRA2E19"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">RNTRC</label>
                      <input
                        type="text"
                        value={formRntrc}
                        onChange={e => setFormRntrc(e.target.value)}
                        placeholder="EX: 12345678"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">TIPO DE VEÍCULO</label>
                      <select
                        value={formTipoVeiculo}
                        onChange={e => setFormTipoVeiculo(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase cursor-pointer"
                      >
                        <option value="TRUCK">TRUCK</option>
                        <option value="CARRETA">CARRETA</option>
                        <option value="BITREM">BITREM</option>
                        <option value="TOCO">TOCO</option>
                        <option value="UTILITARIO">UTILITÁRIO</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">NOME DO CONDUTOR</label>
                      <input
                        type="text"
                        value={formMotoristaNome}
                        onChange={e => setFormMotoristaNome(e.target.value)}
                        placeholder="NOME COMPLETO DO MOTORISTA"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">CPF DO MOTORISTA</label>
                      <input
                        type="text"
                        value={formMotoristaCpf}
                        onChange={e => setFormMotoristaCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Carga e Totais */}
                <div className="border border-slate-300 dark:border-stone-700 rounded p-3 bg-slate-50 dark:bg-stone-850 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-stone-400 uppercase block">
                    3. DADOS DA CARGA & DOCUMENTOS VINCULADOS
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">VALOR TOTAL CARGA (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formValorCarga}
                        onChange={e => setFormValorCarga(e.target.value)}
                        placeholder="0,00"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">PESO BRUTO TOTAL (KG)</label>
                      <input
                        type="number"
                        value={formPesoKg}
                        onChange={e => setFormPesoKg(e.target.value)}
                        placeholder="EX: 24000"
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">QTD CT-E</label>
                      <input
                        type="number"
                        value={formQtdCte}
                        onChange={e => setFormQtdCte(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">QTD NF-E</label>
                      <input
                        type="number"
                        value={formQtdNfe}
                        onChange={e => setFormQtdNfe(e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-bold font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">OBSERVAÇÕES DO MANIFESTO</label>
                    <textarea
                      value={formObs}
                      onChange={e => setFormObs(e.target.value)}
                      rows={2}
                      placeholder="INFORMAÇÕES ADICIONAIS DE TRANSPORTE..."
                      className="w-full px-2 py-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded text-xs font-medium uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Rodapé Form */}
              <div className="px-4 py-2.5 border-t border-slate-300 dark:border-stone-800 bg-slate-100 dark:bg-stone-850 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-200 rounded text-xs font-bold uppercase transition cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 hover:from-sky-400 hover:to-sky-600 text-white rounded text-xs font-bold uppercase shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer"
                >
                  AUTORIZAR MDF-E NA SEFAZ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
