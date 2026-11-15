import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  MessageCircle,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Landmark,
  FileText,
  Calendar,
  Percent,
  CheckCircle2,
  Barcode,
} from 'lucide-react';
import { BankAccount, Client, CompanyProfile } from '../../types';
import { formatCpfCnpj } from '../../lib/formatters';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredCompanyProfile,
} from '../../lib/storage';
import {
  BoletoDocumentInput,
  buildBoletoMailtoUrl,
  buildBoletoShareMessage,
  buildBoletoWhatsAppUrl,
  calculateFebrabanBoletoData,
  formatClientFullAddress,
  generateI2of5BarcodeLayout,
  generateNextNossoNumero,
  openBoletoPrintWindow,
  resolveBeneficiaryDefaults,
  resolveBoletoBankMeta,
} from '../../utils/boletoUtils';

export interface BoletoInitialData {
  numeroDocumento: string;
  dueDate: string;
  amount: number;
  parcelaLabel?: string;
  referenceDescription?: string;
  bankAccountId?: string;
}

interface BoletoGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: BoletoInitialData | null;
  bankAccounts: BankAccount[];
  companyProfile?: CompanyProfile | null;
  client?: Client | null;
  clientNameFallback?: string;
}

const formatCentsMask = (val: number): string => {
  const n = Number(val) || 0;
  if (n === 0) return '0,00';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCentsMask = (raw: string): number => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return 0;
  return Number((parseInt(digits, 10) / 100).toFixed(2));
};

export type DescontoCondicao =
  | 'ate_vencimento'
  | 'antecipado_data'
  | 'abatimento_direto';

interface BuildInstructionsParams {
  multaPercent: number;
  carenciaMultaDias: number;
  jurosDiaPercent: number;
  carenciaJurosDias: number;
  descontoValor: number;
  descontoCondicao: DescontoCondicao;
  descontoDataLimite: string;
  dueDate: string;
  refText?: string;
  parcelaLabel?: string;
}

const buildDefaultInstructions = ({
  multaPercent,
  carenciaMultaDias,
  jurosDiaPercent,
  carenciaJurosDias,
  descontoValor,
  descontoCondicao,
  descontoDataLimite,
  dueDate,
  refText,
  parcelaLabel,
}: BuildInstructionsParams): string => {
  const lines: string[] = [];
  if (refText) {
    lines.push(
      `REFERENTE A: ${refText}${parcelaLabel ? ` (${parcelaLabel})` : ''}`
    );
  } else if (parcelaLabel) {
    lines.push(`COBRANÇA REFERENTE A ${parcelaLabel}`);
  }

  const multaStr = multaPercent.toFixed(2).replace('.', ',');
  const jurosStr = jurosDiaPercent.toFixed(3).replace('.', ',');
  const vencBr = formatDateBR(dueDate);

  const multaPart =
    multaPercent > 0
      ? carenciaMultaDias <= 0
        ? `APÓS O VENCIMENTO (${vencBr}), COBRAR MULTA DE ${multaStr}%`
        : `APÓS ${carenciaMultaDias} ${carenciaMultaDias === 1 ? 'DIA' : 'DIAS'} DO VENCIMENTO (${vencBr}), COBRAR MULTA DE ${multaStr}%`
      : '';

  const jurosPart =
    jurosDiaPercent > 0
      ? carenciaJurosDias <= 0
        ? `JUROS DE MORA DE ${jurosStr}% AO DIA A PARTIR DO 1º DIA APÓS VENCIMENTO`
        : `JUROS DE MORA DE ${jurosStr}% AO DIA APÓS ${carenciaJurosDias} ${carenciaJurosDias === 1 ? 'DIA' : 'DIAS'} DO VENCIMENTO`
      : '';

  if (multaPart && jurosPart) {
    lines.push(`${multaPart} E ${jurosPart}.`);
  } else if (multaPart) {
    lines.push(`${multaPart}.`);
  } else if (jurosPart) {
    lines.push(`APÓS O VENCIMENTO (${vencBr}), COBRAR ${jurosPart}.`);
  }

  if (descontoValor > 0) {
    const descBr = formatCurrencyBRL(descontoValor);
    if (descontoCondicao === 'antecipado_data') {
      const limitBr = formatDateBR(descontoDataLimite || dueDate);
      lines.push(
        `CONCEDER DESCONTO/ABATIMENTO DE ${descBr} PARA PAGAMENTO ANTECIPADO ATÉ ${limitBr}.`
      );
    } else if (descontoCondicao === 'abatimento_direto') {
      lines.push(
        `CONCEDER DESCONTO/ABATIMENTO DE ${descBr} (ABATIMENTO DIRETO / DEVOLUÇÃO DE ITEM).`
      );
    } else {
      lines.push(
        `CONCEDER DESCONTO/ABATIMENTO DE ${descBr} PARA PAGAMENTO ATÉ O VENCIMENTO (${vencBr}).`
      );
    }
  }

  lines.push('NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO SEM AUTORIZAÇÃO DO CEDENTE.');
  return lines.join('\n');
};

export const BoletoGeneratorModal: React.FC<BoletoGeneratorModalProps> = ({
  isOpen,
  onClose,
  initialData,
  bankAccounts = [],
  companyProfile,
  client,
  clientNameFallback,
}) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const effectiveCompany = useMemo(
    () => companyProfile || getStoredCompanyProfile(),
    [companyProfile]
  );
  const beneficiary = useMemo(
    () => resolveBeneficiaryDefaults(effectiveCompany),
    [effectiveCompany]
  );

  // Estados editáveis do boleto (Coluna Esquerda)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [nossoNumero, setNossoNumero] = useState<string>('');
  const [numeroDocumento, setNumeroDocumento] = useState<string>('');
  const [dataVencimento, setDataVencimento] = useState<string>(today);
  const [valorDocumento, setValorDocumento] = useState<number>(0);
  const [carteira, setCarteira] = useState<string>('109');
  const [especieDoc, setEspecieDoc] = useState<string>('DM');
  const [aceite, setAceite] = useState<'N' | 'S'>('N');

  // Card 3: Multa, Juros, Carência e Desconto/Abatimento
  const [multaPercent, setMultaPercent] = useState<number>(2.0);
  const [carenciaMultaDias, setCarenciaMultaDias] = useState<number>(0);
  const [jurosDiaPercent, setJurosDiaPercent] = useState<number>(0.033);
  const [carenciaJurosDias, setCarenciaJurosDias] = useState<number>(0);
  const [descontoValor, setDescontoValor] = useState<number>(0);
  const [descontoCondicao, setDescontoCondicao] =
    useState<DescontoCondicao>('ate_vencimento');
  const [descontoDataLimite, setDescontoDataLimite] = useState<string>(today);

  const [instrucoes, setInstrucoes] = useState<string>('');
  const [instructionsEditedManually, setInstructionsEditedManually] = useState(false);

  const [copiedBarcodeLine, setCopiedBarcodeLine] = useState(false);
  const [actionToast, setActionToast] = useState<string>('');

  // Inicialização ao abrir o modal
  useEffect(() => {
    if (!isOpen || !initialData) return;

    const defaultAcc =
      bankAccounts.find((a) => a.id === initialData.bankAccountId) ||
      bankAccounts.find((a) => a.isPriority || a.prioritaria) ||
      bankAccounts[0];

    const initialAccId = defaultAcc?.id || '';
    const initialBankMeta = resolveBoletoBankMeta(defaultAcc);
    const initDue = initialData.dueDate || today;

    const initMulta = 2.0;
    const initCarenciaMulta = 0;
    const initJuros = 0.033;
    const initCarenciaJuros = 0;
    const initDesc = 0;
    const initDescCondicao: DescontoCondicao = 'ate_vencimento';

    setSelectedAccountId(initialAccId);
    setNossoNumero(generateNextNossoNumero(initialData.numeroDocumento));
    setNumeroDocumento(initialData.numeroDocumento || 'DOC-0001');
    setDataVencimento(initDue);
    setValorDocumento(Number(initialData.amount) || 0);
    setCarteira(initialBankMeta.defaultCarteira);
    setEspecieDoc('DM');
    setAceite('N');
    setMultaPercent(initMulta);
    setCarenciaMultaDias(initCarenciaMulta);
    setJurosDiaPercent(initJuros);
    setCarenciaJurosDias(initCarenciaJuros);
    setDescontoValor(initDesc);
    setDescontoCondicao(initDescCondicao);
    setDescontoDataLimite(initDue);
    setInstructionsEditedManually(false);
    setInstrucoes(
      buildDefaultInstructions({
        multaPercent: initMulta,
        carenciaMultaDias: initCarenciaMulta,
        jurosDiaPercent: initJuros,
        carenciaJurosDias: initCarenciaJuros,
        descontoValor: initDesc,
        descontoCondicao: initDescCondicao,
        descontoDataLimite: initDue,
        dueDate: initDue,
        refText: initialData.referenceDescription,
        parcelaLabel: initialData.parcelaLabel,
      })
    );
    setCopiedBarcodeLine(false);
    setActionToast('');
  }, [isOpen, initialData, bankAccounts, today]);

  // Atualiza automaticamente instruções se operador ainda não editou texto livre
  useEffect(() => {
    if (!isOpen || !initialData || instructionsEditedManually) return;
    setInstrucoes(
      buildDefaultInstructions({
        multaPercent,
        carenciaMultaDias,
        jurosDiaPercent,
        carenciaJurosDias,
        descontoValor,
        descontoCondicao,
        descontoDataLimite,
        dueDate: dataVencimento,
        refText: initialData.referenceDescription,
        parcelaLabel: initialData.parcelaLabel,
      })
    );
  }, [
    isOpen,
    initialData,
    instructionsEditedManually,
    multaPercent,
    carenciaMultaDias,
    jurosDiaPercent,
    carenciaJurosDias,
    descontoValor,
    descontoCondicao,
    descontoDataLimite,
    dataVencimento,
  ]);

  const selectedAccount = useMemo(
    () =>
      bankAccounts.find((a) => a.id === selectedAccountId) || bankAccounts[0] || null,
    [bankAccounts, selectedAccountId]
  );

  const bankMeta = useMemo(
    () => resolveBoletoBankMeta(selectedAccount),
    [selectedAccount]
  );

  const handleAccountChange = (accId: string) => {
    setSelectedAccountId(accId);
    const acc = bankAccounts.find((a) => a.id === accId);
    const meta = resolveBoletoBankMeta(acc);
    setCarteira(meta.defaultCarteira);
  };

  const calculated = useMemo(() => {
    return calculateFebrabanBoletoData({
      bankCode: bankMeta.code,
      agency: selectedAccount?.agency || effectiveCompany?.bankAgency || '0001',
      accountNumber:
        selectedAccount?.accountNumber || effectiveCompany?.bankAccount || '000001',
      carteira,
      nossoNumero,
      dueDate: dataVencimento,
      amount: valorDocumento,
    });
  }, [
    bankMeta.code,
    selectedAccount,
    effectiveCompany,
    carteira,
    nossoNumero,
    dataVencimento,
    valorDocumento,
  ]);

  const barcodeLayout = useMemo(
    () => generateI2of5BarcodeLayout(calculated.barcode),
    [calculated.barcode]
  );

  const pagadorNome = useMemo(
    () => (client?.name || client?.nome || clientNameFallback || 'CLIENTE PAGADOR').toUpperCase(),
    [client, clientNameFallback]
  );

  const pagadorDocumento = useMemo(() => {
    if (!client?.cpfCnpj) return 'Não cadastrado';
    return formatCpfCnpj(client.cpfCnpj);
  }, [client]);

  const pagadorEndereco = useMemo(
    () => formatClientFullAddress(client),
    [client]
  );

  const boletoDocument: BoletoDocumentInput = useMemo(
    () => ({
      bankMeta,
      agenciaCodigoCedente: calculated.agenciaCodigoCedente,
      beneficiarioNome: beneficiary.nome,
      beneficiarioCnpj: beneficiary.cnpj,
      beneficiarioEndereco: beneficiary.endereco,
      pagadorNome,
      pagadorDocumento,
      pagadorEndereco,
      nossoNumero: calculated.nossoNumeroFormatted,
      numeroDocumento,
      especieDoc,
      aceite,
      carteira,
      dataDocumento: today,
      dataVencimento,
      valorDocumento,
      valorDesconto: descontoValor,
      descontoCondicao,
      multaPercent,
      jurosDiaPercent,
      instrucoes,
      demonstrativoParcela: initialData?.parcelaLabel,
      linhaDigitavel: calculated.linhaDigitavel,
      barcode: calculated.barcode,
    }),
    [
      bankMeta,
      calculated,
      beneficiary,
      pagadorNome,
      pagadorDocumento,
      pagadorEndereco,
      numeroDocumento,
      especieDoc,
      aceite,
      carteira,
      today,
      dataVencimento,
      valorDocumento,
      descontoValor,
      descontoCondicao,
      multaPercent,
      jurosDiaPercent,
      instrucoes,
      initialData?.parcelaLabel,
    ]
  );

  const whatsappUrl = useMemo(
    () => buildBoletoWhatsAppUrl(boletoDocument, client?.phone || client?.telefone),
    [boletoDocument, client]
  );

  const mailtoUrl = useMemo(
    () => buildBoletoMailtoUrl(boletoDocument, client?.email),
    [boletoDocument, client]
  );

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 4000);
  };

  const handleCopyLinhaDigitavel = async () => {
    try {
      await navigator.clipboard.writeText(calculated.linhaDigitavel);
      setCopiedBarcodeLine(true);
      showToast('Linha digitável copiada para a área de transferência.');
      setTimeout(() => setCopiedBarcodeLine(false), 2500);
    } catch {
      showToast('Linha digitável exibida no cabeçalho do boleto.');
    }
  };

  const handlePrint = () => {
    const ok = openBoletoPrintWindow(boletoDocument);
    if (ok) {
      showToast('Janela de impressão / PDF do boleto aberta.');
    } else {
      showToast('Não foi possível abrir o diálogo de impressão automaticamente.');
    }
  };

  const handleShareWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(buildBoletoShareMessage(boletoDocument));
    } catch {}
    showToast('Mensagem com linha digitável copiada! Abrindo WhatsApp Web...');
  };

  const handleShareEmail = async () => {
    try {
      await navigator.clipboard.writeText(buildBoletoShareMessage(boletoDocument));
    } catch {}
    showToast(
      client?.email
        ? `Dados do boleto copiados! Abrindo rascunho de e-mail para ${client.email}...`
        : 'Dados do boleto copiados! Abrindo cliente de e-mail padrão...'
    );
  };

  if (!isOpen || !initialData) return null;

  return (
    <div
      className="fixed inset-0 z-70 bg-black/65 flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
    >
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl shadow-2xl overflow-hidden text-black">
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#cad4e6] border-b border-black shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#e0e6f1] border border-black flex items-center justify-center shrink-0">
              <Barcode className="w-5 h-5 text-black stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-black">
                  🧾 GERAR / VISUALIZAR BOLETO BANCÁRIO
                </h3>
                {initialData.parcelaLabel && (
                  <span className="px-2 py-0.5 rounded bg-white border border-black text-[10px] font-black text-blue-800 uppercase">
                    {initialData.parcelaLabel}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded bg-emerald-100 border border-black text-[10px] font-black text-emerald-900 uppercase">
                  Padrão FEBRABAN 240/400
                </span>
              </div>
              <p className="text-[11px] text-slate-800 font-medium truncate">
                Pagador: <strong className="text-black">{pagadorNome}</strong> • Cedente:{' '}
                <strong className="text-black">{beneficiary.nome}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-[#e0e6f1] border border-transparent hover:border-black transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOAST DE FEEDBACK */}
        {actionToast && (
          <div className="mx-5 mt-2.5 px-3 py-2 bg-emerald-50 border border-black rounded-lg text-emerald-900 text-xs font-bold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{actionToast}</span>
          </div>
        )}

        {/* CORPO EM 2 COLUNAS (40% PARÂMETROS EDITÁVEIS / 60% PREVIEW AO VIVO) */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 sm:p-4 overflow-y-auto lg:overflow-hidden bg-[#cad4e6]">
          {/* COLUNA ESQUERDA (40%) — PARÂMETROS EDITÁVEIS */}
          <div className="w-full lg:w-[40%] shrink-0 lg:overflow-y-auto pr-0.5 space-y-3">
            {/* Banco Emissor / Conta Cedente */}
            <div className="p-3 bg-[#e0e6f1] border border-black rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 border-b border-black/30 pb-1.5">
                <Landmark className="w-4 h-4 text-black" />
                <h4 className="text-[11px] font-black uppercase tracking-wider text-black">
                  1. Conta Bancária Cedente (Emissora)
                </h4>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-black uppercase mb-1">
                  Banco / Agência / Conta de Recebimento
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankCode ? `${acc.bankCode} - ` : ''}
                      {acc.bankName || acc.name} • Ag: {acc.agency || '0001'} / Cc:{' '}
                      {acc.accountNumber || '00000-0'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-black uppercase mb-1">
                    Carteira
                  </label>
                  <input
                    type="text"
                    value={carteira}
                    onChange={(e) => setCarteira(e.target.value.toUpperCase())}
                    maxLength={5}
                    className="w-full px-2 py-1.5 bg-white border border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-black uppercase mb-1">
                    Espécie Doc.
                  </label>
                  <select
                    value={especieDoc}
                    onChange={(e) => setEspecieDoc(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                  >
                    <option value="DM">DM - Duplicata Mercantil</option>
                    <option value="DS">DS - Duplicata Serviço</option>
                    <option value="NP">NP - Nota Promissória</option>
                    <option value="RC">RC - Recibo</option>
                    <option value="OU">OU - Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-black uppercase mb-1">
                    Aceite
                  </label>
                  <select
                    value={aceite}
                    onChange={(e) => setAceite(e.target.value as 'N' | 'S')}
                    className="w-full px-2 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                  >
                    <option value="N">N (Não)</option>
                    <option value="S">S (Sim)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Identificação & Valores */}
            <div className="p-3 bg-[#e0e6f1] border border-black rounded-xl space-y-2.5">
              <div className="flex items-center gap-1.5 border-b border-black/30 pb-1.5">
                <FileText className="w-4 h-4 text-black" />
                <h4 className="text-[11px] font-black uppercase tracking-wider text-black">
                  2. Dados do Título Bancário
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-black uppercase">
                      Nosso Número
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setNossoNumero(generateNextNossoNumero(numeroDocumento))
                      }
                      className="inline-flex items-center gap-0.5 text-[9px] font-black text-blue-800 hover:underline cursor-pointer uppercase"
                      title="Gerar novo Nosso Número"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Gerar</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={nossoNumero}
                    onChange={(e) => setNossoNumero(e.target.value.replace(/[^\d-]/g, ''))}
                    className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-black uppercase mb-1">
                    Nº do Documento
                  </label>
                  <input
                    type="text"
                    value={numeroDocumento}
                    onChange={(e) => setNumeroDocumento(e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-black uppercase mb-1">
                    Data de Vencimento
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-black uppercase mb-1">
                    Valor do Documento (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-xs font-bold text-slate-600 pointer-events-none">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCentsMask(valorDocumento)}
                      onChange={(e) => setValorDocumento(parseCentsMask(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-black text-emerald-900 focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Encargos e Instruções */}
            <div className="p-3 bg-[#e0e6f1] border border-black rounded-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-black/30 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-black" />
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-black">
                    3. Encargos & Instruções
                  </h4>
                </div>
                {instructionsEditedManually && (
                  <button
                    type="button"
                    onClick={() => {
                      setInstructionsEditedManually(false);
                      setInstrucoes(
                        buildDefaultInstructions({
                          multaPercent,
                          carenciaMultaDias,
                          jurosDiaPercent,
                          carenciaJurosDias,
                          descontoValor,
                          descontoCondicao,
                          descontoDataLimite,
                          dueDate: dataVencimento,
                          refText: initialData.referenceDescription,
                          parcelaLabel: initialData.parcelaLabel,
                        })
                      );
                    }}
                    className="text-[9px] font-black text-blue-800 hover:underline uppercase cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                )}
              </div>

              {/* Linha 1 — Multa por Atraso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-white/75 border border-black/40 rounded-lg">
                <div>
                  <label className="block text-[9px] font-bold text-black uppercase mb-1">
                    Multa Atraso (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={multaPercent}
                    onChange={(e) => setMultaPercent(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-2 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-black uppercase mb-1">
                    Carência / Aplicar após (dias do venc.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={carenciaMultaDias}
                    onChange={(e) =>
                      setCarenciaMultaDias(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                    }
                    className="w-full px-2 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <span className="block text-[9px] text-slate-700 font-semibold mt-0.5">
                    0 = 1º dia após vencimento
                  </span>
                </div>
              </div>

              {/* Linha 2 — Juros de Mora */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-white/75 border border-black/40 rounded-lg">
                <div>
                  <label className="block text-[9px] font-bold text-black uppercase mb-1">
                    Juros Mora / Dia (%)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={jurosDiaPercent}
                    onChange={(e) =>
                      setJurosDiaPercent(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full px-2 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-black uppercase mb-1">
                    Carência / Cobrar após (dias do venc.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={carenciaJurosDias}
                    onChange={(e) =>
                      setCarenciaJurosDias(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                    }
                    className="w-full px-2 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <span className="block text-[9px] text-slate-700 font-semibold mt-0.5">
                    0 = 1º dia após vencimento
                  </span>
                </div>
              </div>

              {/* Linha 3 — Desconto / Abatimento (Eventualidades ou Devolução) */}
              <div className="p-2 bg-white/75 border border-black/40 rounded-lg space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-black uppercase mb-1">
                      Desconto / Abatimento (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-[10px] font-bold text-slate-600 pointer-events-none">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatCentsMask(descontoValor)}
                        onChange={(e) => setDescontoValor(parseCentsMask(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full pl-7 pr-2 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-black uppercase mb-1">
                      Condição do Desconto
                    </label>
                    <select
                      value={descontoCondicao}
                      onChange={(e) => setDescontoCondicao(e.target.value as DescontoCondicao)}
                      className="w-full px-2 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                    >
                      <option value="ate_vencimento">Até o Vencimento (Pontualidade)</option>
                      <option value="antecipado_data">Antecipado até Data Limite</option>
                      <option value="abatimento_direto">
                        Abatimento Direto / Devolução de Item
                      </option>
                    </select>
                  </div>
                </div>

                {descontoCondicao === 'antecipado_data' && (
                  <div>
                    <label className="block text-[9px] font-bold text-black uppercase mb-1">
                      Data Limite do Desconto Antecipado
                    </label>
                    <input
                      type="date"
                      value={descontoDataLimite}
                      onChange={(e) => setDescontoDataLimite(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-black uppercase mb-1">
                  Instruções ao Caixa / Pagador (Impressas na Ficha)
                </label>
                <textarea
                  rows={4}
                  value={instrucoes}
                  onChange={(e) => {
                    setInstructionsEditedManually(true);
                    setInstrucoes(e.target.value.toUpperCase());
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-[11px] font-semibold text-black uppercase focus:outline-none focus:ring-1 focus:ring-black leading-snug"
                />
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA (60%) — VISUALIZAÇÃO AO VIVO DO BOLETO BANCÁRIO */}
          <div className="w-full lg:w-[60%] flex-1 flex flex-col min-h-0 bg-[#e0e6f1] border border-black rounded-xl overflow-hidden">
            {/* Barra superior da pré-visualização com Linha Digitável copiável */}
            <div className="px-3.5 py-2 bg-white border-b border-black flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                <span className="text-[10px] font-black uppercase text-slate-700 shrink-0">
                  Linha Digitável:
                </span>
                <span className="text-[11px] font-mono font-black text-black truncate select-all">
                  {calculated.linhaDigitavel}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyLinhaDigitavel}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-black bg-[#e0e6f1] hover:bg-[#cad4e6] text-[10px] font-black text-black uppercase transition cursor-pointer shrink-0"
              >
                {copiedBarcodeLine ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar Linha</span>
                  </>
                )}
              </button>
            </div>

            {/* FOLHA BRANCA DO BOLETO FEBRABAN */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-slate-200/80">
              <div className="bg-white text-black border border-black p-4 shadow-md mx-auto max-w-[760px] text-[10px] font-sans">
                {/* 1. RECIBO DO PAGADOR */}
                <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-700 mb-1">
                  <span>Recibo do Pagador</span>
                  <span>
                    {initialData.parcelaLabel || 'Cobrança Bancária Registrada'}
                  </span>
                </div>

                {/* Cabeçalho Banco Recibo */}
                <div className="flex items-end border-b-2 border-black pb-1">
                  <div className="flex items-center gap-1.5 pr-2.5 border-r-2 border-black shrink-0">
                    <span
                      className="px-1.5 py-0.5 rounded text-white font-black text-[10px]"
                      style={{ backgroundColor: bankMeta.color }}
                    >
                      {bankMeta.code}
                    </span>
                    <span className="font-black text-xs tracking-tight">
                      {bankMeta.shortName}
                    </span>
                  </div>
                  <div className="px-2.5 border-r-2 border-black font-mono font-black text-sm leading-none shrink-0">
                    {bankMeta.codeWithDv}
                  </div>
                  <div className="flex-1 text-right font-mono font-black text-[11px] sm:text-xs pl-2 break-all">
                    {calculated.linhaDigitavel}
                  </div>
                </div>

                {/* Grade Resumida do Recibo */}
                <div className="grid grid-cols-6 border-l border-r border-black">
                  <div className="col-span-4 border-b border-r border-black px-1.5 py-1">
                    <span className="block text-[7.5px] uppercase text-slate-600">
                      Beneficiário / Cedente
                    </span>
                    <span className="font-bold text-black block truncate">
                      {beneficiary.nome} — {beneficiary.cnpj}
                    </span>
                  </div>
                  <div className="col-span-2 border-b border-black px-1.5 py-1 text-right">
                    <span className="block text-[7.5px] uppercase text-slate-600">
                      Agência / Código Beneficiário
                    </span>
                    <span className="font-bold font-mono text-black">
                      {calculated.agenciaCodigoCedente}
                    </span>
                  </div>

                  <div className="col-span-2 border-b border-r border-black px-1.5 py-1">
                    <span className="block text-[7.5px] uppercase text-slate-600">
                      Pagador
                    </span>
                    <span className="font-bold text-black block truncate">
                      {pagadorNome}
                    </span>
                  </div>
                  <div className="col-span-1 border-b border-r border-black px-1.5 py-1">
                    <span className="block text-[7.5px] uppercase text-slate-600">
                      Nº Documento
                    </span>
                    <span className="font-bold font-mono text-black block truncate">
                      {numeroDocumento}
                    </span>
                  </div>
                  <div className="col-span-1 border-b border-r border-black px-1.5 py-1">
                    <span className="block text-[7.5px] uppercase text-slate-600">
                      Nosso Número
                    </span>
                    <span className="font-bold font-mono text-black block truncate">
                      {calculated.nossoNumeroFormatted}
                    </span>
                  </div>
                  <div className="col-span-1 border-b border-r border-black px-1.5 py-1 text-right">
                    <span className="block text-[7.5px] uppercase text-slate-600">
                      Vencimento
                    </span>
                    <span className="font-black text-black">
                      {formatDateBR(dataVencimento)}
                    </span>
                  </div>
                  <div className="col-span-1 border-b border-black px-1.5 py-1 text-right">
                    <span className="block text-[7.5px] uppercase text-slate-600">
                      (=) Valor Doc.
                    </span>
                    <span className="font-black text-black">
                      {formatCurrencyBRL(valorDocumento)}
                    </span>
                  </div>
                </div>

                {/* LINHA PONTILHADA DE CORTE */}
                <div className="relative my-3.5 border-t border-dashed border-black text-right">
                  <span className="relative -top-2 bg-white px-2 text-[8px] font-bold uppercase text-slate-600">
                    ✂ Corte na linha pontilhada • Autenticação Mecânica
                  </span>
                </div>

                {/* 2. FICHA DE COMPENSAÇÃO */}
                <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-700 mb-1">
                  <span>Ficha de Compensação</span>
                  <span>Padrão FEBRABAN</span>
                </div>

                <div className="flex items-end border-b-2 border-black pb-1">
                  <div className="flex items-center gap-1.5 pr-2.5 border-r-2 border-black shrink-0">
                    <span
                      className="px-1.5 py-0.5 rounded text-white font-black text-[10px]"
                      style={{ backgroundColor: bankMeta.color }}
                    >
                      {bankMeta.code}
                    </span>
                    <span className="font-black text-xs tracking-tight">
                      {bankMeta.shortName}
                    </span>
                  </div>
                  <div className="px-2.5 border-r-2 border-black font-mono font-black text-sm leading-none shrink-0">
                    {bankMeta.codeWithDv}
                  </div>
                  <div className="flex-1 text-right font-mono font-black text-[11px] sm:text-xs pl-2 break-all">
                    {calculated.linhaDigitavel}
                  </div>
                </div>

                {/* Grade Completa Ficha de Compensação */}
                <div className="border-l border-r border-black">
                  {/* Linha 1 */}
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-4 sm:col-span-5 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Local de Pagamento
                      </span>
                      <span className="font-bold text-black">
                        {bankMeta.localPagamento}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 px-1.5 py-1 text-right bg-slate-50">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Vencimento
                      </span>
                      <span className="font-black text-[11px] text-black">
                        {formatDateBR(dataVencimento)}
                      </span>
                    </div>
                  </div>

                  {/* Linha 2 */}
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-4 sm:col-span-5 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Beneficiário / Cedente ({beneficiary.cnpj})
                      </span>
                      <span className="font-bold text-black block">
                        {beneficiary.nome}
                        {beneficiary.endereco ? ` — ${beneficiary.endereco}` : ''}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 px-1.5 py-1 text-right">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Agência / Cód. Beneficiário
                      </span>
                      <span className="font-bold font-mono text-black">
                        {calculated.agenciaCodigoCedente}
                      </span>
                    </div>
                  </div>

                  {/* Linha 3 */}
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Data Documento
                      </span>
                      <span className="font-bold text-black">
                        {formatDateBR(today)}
                      </span>
                    </div>
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Nº Documento
                      </span>
                      <span className="font-bold font-mono text-black block truncate">
                        {numeroDocumento}
                      </span>
                    </div>
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Espécie Doc.
                      </span>
                      <span className="font-bold text-black">{especieDoc}</span>
                    </div>
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Aceite
                      </span>
                      <span className="font-bold text-black">{aceite}</span>
                    </div>
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Data Processam.
                      </span>
                      <span className="font-bold text-black">
                        {formatDateBR(today)}
                      </span>
                    </div>
                    <div className="col-span-1 px-1.5 py-1 text-right">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Nosso Número
                      </span>
                      <span className="font-bold font-mono text-black">
                        {calculated.nossoNumeroFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Linha 4 */}
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Uso do Banco
                      </span>
                      <span className="font-bold text-black">&nbsp;</span>
                    </div>
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Carteira
                      </span>
                      <span className="font-bold font-mono text-black">{carteira}</span>
                    </div>
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Espécie
                      </span>
                      <span className="font-bold text-black">R$</span>
                    </div>
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Quantidade
                      </span>
                      <span className="font-bold text-black">&nbsp;</span>
                    </div>
                    <div className="col-span-1 border-r border-black px-1.5 py-1">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        Valor
                      </span>
                      <span className="font-bold text-black">&nbsp;</span>
                    </div>
                    <div className="col-span-1 px-1.5 py-1 text-right bg-slate-50">
                      <span className="block text-[7.5px] uppercase text-slate-600">
                        (=) Valor do Documento
                      </span>
                      <span className="font-black text-[11px] text-black">
                        {formatCurrencyBRL(valorDocumento)}
                      </span>
                    </div>
                  </div>

                  {/* Linha 5: Instruções + Encargos Laterais */}
                  <div className="grid grid-cols-6 border-b border-black">
                    <div className="col-span-4 sm:col-span-5 border-r border-black px-1.5 py-1.5 min-h-[96px]">
                      <span className="block text-[7.5px] uppercase text-slate-600 mb-1">
                        Instruções (Texto de Responsabilidade do Beneficiário)
                      </span>
                      <p className="text-[9.5px] font-semibold text-black whitespace-pre-line leading-snug">
                        {instrucoes}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex flex-col divide-y divide-black">
                      <div className="px-1.5 py-1 text-right flex-1">
                        <span className="block text-[7px] uppercase text-slate-600">
                          (-) Desconto / Abatimento
                        </span>
                        <span className="font-bold text-black">
                          {descontoValor > 0 ? formatCurrencyBRL(descontoValor) : 'R$ 0,00'}
                        </span>
                      </div>
                      <div className="px-1.5 py-1 text-right flex-1">
                        <span className="block text-[7px] uppercase text-slate-600">
                          (+) Mora / Multa
                        </span>
                        <span className="font-bold text-black">&nbsp;</span>
                      </div>
                      <div className="px-1.5 py-1 text-right flex-1">
                        <span className="block text-[7px] uppercase text-slate-600">
                          (+) Outros Acréscimos
                        </span>
                        <span className="font-bold text-black">&nbsp;</span>
                      </div>
                      <div className="px-1.5 py-1 text-right flex-1 bg-slate-50">
                        <span className="block text-[7px] uppercase text-slate-600">
                          (=) Valor Cobrado
                        </span>
                        <span className="font-bold text-black">
                          {descontoCondicao === 'abatimento_direto' && descontoValor > 0
                            ? formatCurrencyBRL(Math.max(0, valorDocumento - descontoValor))
                            : '\u00A0'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Linha 6: Pagador */}
                  <div className="border-b border-black px-1.5 py-1.5">
                    <span className="block text-[7.5px] uppercase text-slate-600">
                      Pagador
                    </span>
                    <span className="font-bold text-black block">
                      {pagadorNome} — CPF/CNPJ: {pagadorDocumento}
                    </span>
                    <span className="font-medium text-slate-800 text-[9px] block">
                      {pagadorEndereco}
                    </span>
                  </div>
                </div>

                {/* CÓDIGO DE BARRAS INTERCALADO 2 DE 5 (ITF-25 SVG) */}
                <div className="mt-2.5 flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="w-full sm:max-w-[440px]">
                    <svg
                      viewBox={`0 0 ${barcodeLayout.viewBoxWidth} ${barcodeLayout.height}`}
                      className="w-full h-12 bg-white"
                      preserveAspectRatio="none"
                      aria-label="Código de barras FEBRABAN"
                    >
                      {barcodeLayout.bars.map((bar, idx) => (
                        <rect
                          key={idx}
                          x={bar.x}
                          y={0}
                          width={bar.width}
                          height={barcodeLayout.height}
                          fill="#000000"
                        />
                      ))}
                    </svg>
                    <span className="block text-[8px] font-mono text-slate-500 tracking-wider mt-0.5">
                      {calculated.barcode}
                    </span>
                  </div>
                  <div className="text-[8px] uppercase font-bold text-slate-700 border-t border-black pt-0.5 shrink-0 sm:text-right w-full sm:w-48">
                    Autenticação Mecânica — Ficha de Compensação
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ COM AÇÕES DO BOLETO */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-[#cad4e6] border-t border-black shrink-0">
          <div className="text-[11px] font-bold text-slate-800">
            Valor Final: <span className="text-black font-black">{formatCurrencyBRL(valorDocumento)}</span> • Vencimento:{' '}
            <span className="text-black font-black">{formatDateBR(dataVencimento)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-black bg-white hover:bg-gray-100 border border-black rounded-lg shadow-2xs transition cursor-pointer uppercase"
              title="Retornar à tela de Baixar / Faturar Conta a Receber mantendo os dados preenchidos"
            >
              <span>⬅️ Voltar</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 border border-black rounded-lg shadow-2xs transition cursor-pointer uppercase"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ Imprimir / Salvar PDF</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-900 rounded-lg shadow-2xs transition cursor-pointer uppercase"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>📲 Enviar por WhatsApp</span>
            </a>

            <a
              href={mailtoUrl}
              onClick={handleShareEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 border border-blue-950 rounded-lg shadow-2xs transition cursor-pointer uppercase"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>✉️ Enviar por E-mail</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
