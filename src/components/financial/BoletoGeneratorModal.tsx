import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Layers,
  Upload,
} from 'lucide-react';
import { BankAccount, Client, CompanyProfile } from '../../types';
import { formatCpfCnpj } from '../../lib/formatters';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredCompanyProfile,
} from '../../lib/storage';
import {
  addDaysIsoDate,
  BoletoDocumentInput,
  buildBoletosBatchMailtoUrl,
  buildBoletosBatchShareMessage,
  buildBoletosBatchWhatsAppUrl,
  calculateFebrabanBoletoData,
  formatClientFullAddress,
  generateI2of5BarcodeLayout,
  generateNextNossoNumero,
  incrementNossoNumero,
  openBoletosBatchPrintWindow,
  resolveBeneficiaryDefaults,
  resolveBoletoBankMeta,
} from '../../utils/boletoUtils';
import {
  appendCnabRemessaHistory,
  generateCnabRemessaFile,
  markBoletosStatus,
  triggerTextFileDownload,
  upsertBoletosEmitidos,
} from '../../utils/cnabUtils';

export interface BoletoInitialInstallment {
  number: number;
  total: number;
  dueDate: string;
  amount: number;
}

export interface BoletoInitialData {
  contaReceberId?: string;
  contaReceberTipo?: string;
  numeroDocumento: string;
  dueDate: string;
  amount: number;
  parcelaLabel?: string;
  referenceDescription?: string;
  bankAccountId?: string;
  installmentsCount?: number;
  intervalDays?: number;
  installments?: BoletoInitialInstallment[];
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

const PRESET_INTERVAL_VALUES = ['7', '15', '30', '45', '60', '90', '180', '365'];

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
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [intervalDays, setIntervalDays] = useState<number>(30);
  const [intervalPreset, setIntervalPreset] = useState<string>('30');
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

  const [copiedParcelIndex, setCopiedParcelIndex] = useState<number | null>(null);
  const [copiedAllLines, setCopiedAllLines] = useState(false);
  const [actionToast, setActionToast] = useState<string>('');
  const lastSavedSignatureRef = useRef<string>('');

  // Inicialização ao abrir o modal
  useEffect(() => {
    if (!isOpen || !initialData) return;

    const defaultAcc =
      bankAccounts.find((a) => a.id === initialData.bankAccountId) ||
      bankAccounts.find((a) => a.isPriority || a.prioritaria) ||
      bankAccounts[0];

    const initialAccId = defaultAcc?.id || '';
    const initialBankMeta = resolveBoletoBankMeta(defaultAcc);
    const initDue = initialData.installments?.[0]?.dueDate || initialData.dueDate || today;
    const initCount = Math.max(
      1,
      Math.min(
        24,
        Math.trunc(
          Number(initialData.installmentsCount || initialData.installments?.length || 1)
        )
      )
    );
    const initInterval = Math.max(1, Math.trunc(Number(initialData.intervalDays || 30)));
    const initPreset = PRESET_INTERVAL_VALUES.includes(String(initInterval))
      ? String(initInterval)
      : 'custom';
    const installmentsSum =
      initialData.installments && initialData.installments.length > 0
        ? initialData.installments.reduce((acc, it) => acc + (Number(it.amount) || 0), 0)
        : 0;
    const initTotalAmount =
      Number(initialData.amount) > 0 ? Number(initialData.amount) : installmentsSum;

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
    setValorDocumento(Number(initTotalAmount.toFixed(2)) || 0);
    setInstallmentsCount(initCount);
    setIntervalDays(initInterval);
    setIntervalPreset(initPreset);
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
        parcelaLabel: initCount > 1 ? `Parcela 1/${initCount}` : 'Parcela Única',
      })
    );
    setCopiedParcelIndex(null);
    setCopiedAllLines(false);
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
        parcelaLabel:
          installmentsCount > 1 ? `Parcela 1/${installmentsCount}` : 'Parcela Única',
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
    installmentsCount,
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

  const handleIntervalPresetChange = (val: string) => {
    setIntervalPreset(val);
    if (val !== 'custom') {
      const parsed = Math.max(1, parseInt(val, 10) || 30);
      setIntervalDays(parsed);
    }
  };

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

  const calculatedBoletos = useMemo(() => {
    const count = Math.max(1, Math.min(24, Math.trunc(Number(installmentsCount) || 1)));
    const totalAmt = Math.max(0, Number(valorDocumento) || 0);
    const safeInterval = Math.max(1, Math.trunc(Number(intervalDays) || 30));
    const baseDue = dataVencimento || today;

    const baseVal = Math.floor((totalAmt / count) * 100) / 100;
    const remainder = Number((totalAmt - baseVal * count).toFixed(2));

    const agency = selectedAccount?.agency || effectiveCompany?.bankAgency || '0001';
    const accountNumber =
      selectedAccount?.accountNumber || effectiveCompany?.bankAccount || '000001';

    const items: Array<{
      parcelaNumber: number;
      totalParcelas: number;
      doc: BoletoDocumentInput;
      barcodeLayout: ReturnType<typeof generateI2of5BarcodeLayout>;
    }> = [];

    for (let i = 1; i <= count; i++) {
      const parcelAmount =
        i === 1 ? Number((baseVal + remainder).toFixed(2)) : baseVal;
      const parcelDueDate = addDaysIsoDate(baseDue, (i - 1) * safeInterval);
      const parcelNossoRaw = incrementNossoNumero(nossoNumero, i - 1);
      const parcelDocNumber = count > 1 ? `${numeroDocumento}/P${i}` : numeroDocumento;
      const parcelLabel = count > 1 ? `Parcela ${i}/${count}` : 'Parcela Única';

      const calc = calculateFebrabanBoletoData({
        bankCode: bankMeta.code,
        agency,
        accountNumber,
        carteira,
        nossoNumero: parcelNossoRaw,
        dueDate: parcelDueDate,
        amount: parcelAmount,
      });

      const parcelInstructions = instructionsEditedManually
        ? instrucoes
        : buildDefaultInstructions({
            multaPercent,
            carenciaMultaDias,
            jurosDiaPercent,
            carenciaJurosDias,
            descontoValor,
            descontoCondicao,
            descontoDataLimite:
              count > 1 && descontoCondicao === 'antecipado_data'
                ? parcelDueDate
                : descontoDataLimite,
            dueDate: parcelDueDate,
            refText: initialData?.referenceDescription,
            parcelaLabel: parcelLabel,
          });

      const doc: BoletoDocumentInput = {
        bankMeta,
        agenciaCodigoCedente: calc.agenciaCodigoCedente,
        beneficiarioNome: beneficiary.nome,
        beneficiarioCnpj: beneficiary.cnpj,
        beneficiarioEndereco: beneficiary.endereco,
        pagadorNome,
        pagadorDocumento,
        pagadorEndereco,
        nossoNumero: calc.nossoNumeroFormatted,
        numeroDocumento: parcelDocNumber,
        especieDoc,
        aceite,
        carteira,
        dataDocumento: today,
        dataVencimento: parcelDueDate,
        valorDocumento: parcelAmount,
        valorDesconto: descontoValor,
        descontoCondicao,
        multaPercent,
        jurosDiaPercent,
        instrucoes: parcelInstructions,
        demonstrativoParcela: parcelLabel,
        linhaDigitavel: calc.linhaDigitavel,
        barcode: calc.barcode,
      };

      items.push({
        parcelaNumber: i,
        totalParcelas: count,
        doc,
        barcodeLayout: generateI2of5BarcodeLayout(calc.barcode),
      });
    }

    return items;
  }, [
    installmentsCount,
    valorDocumento,
    intervalDays,
    dataVencimento,
    today,
    selectedAccount,
    effectiveCompany,
    nossoNumero,
    numeroDocumento,
    bankMeta,
    carteira,
    instructionsEditedManually,
    instrucoes,
    multaPercent,
    carenciaMultaDias,
    jurosDiaPercent,
    carenciaJurosDias,
    descontoValor,
    descontoCondicao,
    descontoDataLimite,
    initialData?.referenceDescription,
    beneficiary,
    pagadorNome,
    pagadorDocumento,
    pagadorEndereco,
    especieDoc,
    aceite,
  ]);

  const boletoDocuments = useMemo(
    () => calculatedBoletos.map((item) => item.doc),
    [calculatedBoletos]
  );

  const whatsappUrl = useMemo(
    () => buildBoletosBatchWhatsAppUrl(boletoDocuments, client?.phone || client?.telefone),
    [boletoDocuments, client]
  );

  const mailtoUrl = useMemo(
    () => buildBoletosBatchMailtoUrl(boletoDocuments, client?.email),
    [boletoDocuments, client]
  );

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 4500);
  };

  const persistGeneratedBoletos = () => {
    if (!initialData || calculatedBoletos.length === 0) return [];
    const resolvedContaId =
      initialData.contaReceberId || `doc_${initialData.numeroDocumento || numeroDocumento}`;
    const agencyVal = selectedAccount?.agency || effectiveCompany?.bankAgency || '0001';
    const accountVal =
      selectedAccount?.accountNumber || effectiveCompany?.bankAccount || '000001';

    return upsertBoletosEmitidos(
      calculatedBoletos.map((item) => ({
        contaReceberId: resolvedContaId,
        contaReceberTipo: initialData.contaReceberTipo || 'Contas a Receber',
        parcela:
          item.totalParcelas > 1
            ? `${item.parcelaNumber}/${item.totalParcelas}`
            : '1/1',
        parcelaNumero: item.parcelaNumber,
        totalParcelas: item.totalParcelas,
        nossoNumero: item.doc.nossoNumero,
        numeroDocumento: item.doc.numeroDocumento,
        clienteNome: item.doc.pagadorNome,
        clienteCpfCnpj: item.doc.pagadorDocumento,
        clienteEndereco: item.doc.pagadorEndereco,
        bancoCodigo: item.doc.bankMeta.code,
        bancoNome: item.doc.bankMeta.shortName,
        agencia: agencyVal,
        conta: accountVal,
        carteira: item.doc.carteira,
        vencimento: item.doc.dataVencimento,
        dataEmissao: item.doc.dataDocumento,
        valor: item.doc.valorDocumento,
        multa: item.doc.multaPercent,
        juros: item.doc.jurosDiaPercent,
        desconto: item.doc.valorDesconto,
        linhaDigitavel: item.doc.linhaDigitavel,
        codigoBarras: item.doc.barcode,
      }))
    );
  };

  useEffect(() => {
    if (!isOpen || !initialData || calculatedBoletos.length === 0) return;
    const signature = JSON.stringify(
      calculatedBoletos.map((b) => [
        initialData.contaReceberId || initialData.numeroDocumento,
        b.parcelaNumber,
        b.totalParcelas,
        b.doc.nossoNumero,
        b.doc.numeroDocumento,
        b.doc.dataVencimento,
        b.doc.valorDocumento,
        b.doc.bankMeta.code,
        b.doc.carteira,
      ])
    );
    if (lastSavedSignatureRef.current === signature) return;
    lastSavedSignatureRef.current = signature;
    persistGeneratedBoletos();
  }, [isOpen, initialData, calculatedBoletos]);

  const handleCopyParcelLinha = async (linha: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(linha);
      setCopiedParcelIndex(idx);
      showToast(
        calculatedBoletos.length > 1
          ? `Linha digitável da Parcela ${idx + 1}/${calculatedBoletos.length} copiada!`
          : 'Linha digitável copiada para a área de transferência.'
      );
      setTimeout(() => setCopiedParcelIndex((curr) => (curr === idx ? null : curr)), 2500);
    } catch {
      showToast('Linha digitável exibida no cabeçalho do boleto.');
    }
  };

  const handleCopyAllLinhas = async () => {
    try {
      const content =
        boletoDocuments.length === 1
          ? boletoDocuments[0].linhaDigitavel
          : buildBoletosBatchShareMessage(boletoDocuments);
      await navigator.clipboard.writeText(content);
      setCopiedAllLines(true);
      showToast(
        boletoDocuments.length > 1
          ? `Resumo completo com todas as ${boletoDocuments.length} linhas digitáveis copiado!`
          : 'Linha digitável copiada para a área de transferência.'
      );
      setTimeout(() => setCopiedAllLines(false), 2500);
    } catch {
      showToast('Não foi possível copiar automaticamente.');
    }
  };

  const handlePrint = () => {
    persistGeneratedBoletos();
    const ok = openBoletosBatchPrintWindow(boletoDocuments);
    if (ok) {
      showToast(
        boletoDocuments.length > 1
          ? `Janela de impressão / PDF com todos os ${boletoDocuments.length} boletos aberta.`
          : 'Janela de impressão / PDF do boleto aberta.'
      );
    } else {
      showToast('Não foi possível abrir o diálogo de impressão automaticamente.');
    }
  };

  const handleShareWhatsApp = async () => {
    persistGeneratedBoletos();
    try {
      await navigator.clipboard.writeText(buildBoletosBatchShareMessage(boletoDocuments));
    } catch {}
    showToast(
      boletoDocuments.length > 1
        ? `Mensagem com todos os ${boletoDocuments.length} boletos copiada! Abrindo WhatsApp Web...`
        : 'Mensagem com linha digitável copiada! Abrindo WhatsApp Web...'
    );
  };

  const handleShareEmail = async () => {
    persistGeneratedBoletos();
    try {
      await navigator.clipboard.writeText(buildBoletosBatchShareMessage(boletoDocuments));
    } catch {}
    showToast(
      client?.email
        ? `Dados de todos os boletos copiados! Abrindo rascunho de e-mail para ${client.email}...`
        : 'Dados dos boletos copiados! Abrindo cliente de e-mail padrão...'
    );
  };

  const handleGenerateRemessa = () => {
    const savedRecords = persistGeneratedBoletos();
    if (!savedRecords || savedRecords.length === 0) {
      showToast('Nenhum boleto disponível para gerar o arquivo remessa.');
      return;
    }

    const res = generateCnabRemessaFile({
      boletos: savedRecords,
      standard: 'CNAB_240',
      bankAccount: selectedAccount,
      companyProfile: effectiveCompany,
    });

    triggerTextFileDownload(res.fileName, res.content);

    const remessaId = `rem_${Date.now()}`;
    const boletoIds = savedRecords.map((b) => b.id);
    markBoletosStatus(boletoIds, 'ENVIADO_BANCO', {
      remessaId,
      remessaArquivo: res.fileName,
      dataEnvioRemessa: new Date().toISOString().split('T')[0],
    });

    appendCnabRemessaHistory({
      id: remessaId,
      fileName: res.fileName,
      standard: res.standard,
      bankAccountId: selectedAccount?.id || '',
      bankCode: bankMeta.code,
      bankName: bankMeta.shortName,
      convenio: selectedAccount?.accountNumber || '',
      sequencialArquivo: res.sequencialArquivo,
      boletosCount: res.boletosCount,
      totalAmount: res.totalAmount,
      boletoIds,
      createdAt: new Date().toISOString(),
    });

    showToast(
      `Remessa ${res.fileName} gerada com ${res.boletosCount} boleto(s)! Status atualizado para ✅ ENVIADO AO BANCO.`
    );
  };

  if (!isOpen || !initialData) return null;

  const isBatch = calculatedBoletos.length > 1;
  const headerBadgeText = isBatch
    ? `CARNÊ COMPLETO: ${calculatedBoletos.length} BOLETOS`
    : '1 BOLETO (À VISTA)';

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
                <span className="px-2 py-0.5 rounded bg-white border border-black text-[10px] font-black text-blue-800 uppercase">
                  {headerBadgeText}
                </span>
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
                      {isBatch ? 'Nosso Número (Inicial)' : 'Nosso Número'}
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
                    {isBatch ? 'Nº do Documento (Base)' : 'Nº do Documento'}
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
                    {isBatch ? '1º Vencimento' : 'Data de Vencimento'}
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
                    {isBatch ? 'Valor Total do Título (R$)' : 'Valor do Documento (R$)'}
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

              {/* PARCELAMENTO & INTERVALO DO CARNÊ */}
              <div className="pt-1 border-t border-black/20 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-black uppercase mb-1">
                      Quantidade de Parcelas
                    </label>
                    <select
                      value={installmentsCount}
                      onChange={(e) => setInstallmentsCount(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                    >
                      <option value={1}>1x (À Vista)</option>
                      {Array.from({ length: 23 }, (_, idx) => idx + 2).map((n) => (
                        <option key={n} value={n}>
                          {n}x ({formatCurrencyBRL(valorDocumento / n)}/parc.)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-black uppercase mb-1">
                      Intervalo entre Parcelas
                    </label>
                    <select
                      value={intervalPreset}
                      disabled={!isBatch}
                      onChange={(e) => handleIntervalPresetChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="30">30 dias (Mensal)</option>
                      <option value="15">15 dias</option>
                      <option value="7">7 dias</option>
                      <option value="45">45 dias</option>
                      <option value="60">60 dias (Bimestral)</option>
                      <option value="90">90 dias (Trimestral)</option>
                      <option value="180">180 dias (Semestral)</option>
                      <option value="365">365 dias (Anual)</option>
                      <option value="custom">Safra / Personalizado</option>
                    </select>
                  </div>
                </div>

                {isBatch && intervalPreset === 'custom' && (
                  <div>
                    <label className="block text-[10px] font-bold text-black uppercase mb-1">
                      Dias entre Parcelas (Safra / Personalizado)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="730"
                      step="1"
                      value={intervalDays}
                      onChange={(e) =>
                        setIntervalDays(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                )}

                {isBatch && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/80 border border-black/40 text-[10px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                    <span>
                      Carnê de <strong>{calculatedBoletos.length} boletos</strong> a cada{' '}
                      <strong>{intervalDays} dias</strong> (eventuais centavos na 1ª parcela).
                    </span>
                  </div>
                )}
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
                          parcelaLabel: isBatch
                            ? `Parcela 1/${calculatedBoletos.length}`
                            : 'Parcela Única',
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

          {/* COLUNA DIREITA (60%) — VISUALIZAÇÃO AO VIVO DO(S) BOLETO(S) BANCÁRIO(S) */}
          <div className="w-full lg:w-[60%] flex-1 flex flex-col min-h-0 bg-[#e0e6f1] border border-black rounded-xl overflow-hidden">
            {/* Barra superior da pré-visualização com Linha Digitável / Resumo do Carnê */}
            <div className="px-3.5 py-2 bg-white border-b border-black flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                {isBatch ? (
                  <span className="text-[11px] font-black uppercase text-black truncate">
                    Carnê Completo: {calculatedBoletos.length} Boletos em Sequência • Total:{' '}
                    <span className="text-emerald-800">{formatCurrencyBRL(valorDocumento)}</span>
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] font-black uppercase text-slate-700 shrink-0">
                      Linha Digitável:
                    </span>
                    <span className="text-[11px] font-mono font-black text-black truncate select-all">
                      {calculatedBoletos[0]?.doc.linhaDigitavel}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleCopyAllLinhas}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-black bg-[#e0e6f1] hover:bg-[#cad4e6] text-[10px] font-black text-black uppercase transition cursor-pointer shrink-0"
              >
                {copiedAllLines ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{isBatch ? 'Copiar Todas Linhas' : 'Copiar Linha'}</span>
                  </>
                )}
              </button>
            </div>

            {/* FOLHA(S) BRANCA(S) DO(S) BOLETO(S) FEBRABAN */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-slate-200/80 space-y-5">
              {calculatedBoletos.map((item, parcelIdx) => {
                const { doc, barcodeLayout, parcelaNumber, totalParcelas } = item;
                const isCopiedThis = copiedParcelIndex === parcelIdx;

                return (
                  <div
                    key={`${parcelaNumber}-${doc.nossoNumero}`}
                    className="mx-auto max-w-[760px] space-y-1.5"
                  >
                    {/* Faixa identificadora de cada parcela do lote */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#cad4e6] border border-black rounded-lg text-[10px] font-black text-black">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-blue-700 text-white uppercase">
                          {totalParcelas > 1
                            ? `Parcela ${parcelaNumber}/${totalParcelas}`
                            : 'Boleto Único'}
                        </span>
                        <span>Vencimento: {formatDateBR(doc.dataVencimento)}</span>
                        <span>•</span>
                        <span className="text-emerald-900">
                          Valor: {formatCurrencyBRL(doc.valorDocumento)}
                        </span>
                        <span className="hidden sm:inline text-slate-700 font-mono">
                          • Doc: {doc.numeroDocumento}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyParcelLinha(doc.linhaDigitavel, parcelIdx)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-black bg-white hover:bg-[#e0e6f1] text-[10px] font-black text-black uppercase transition cursor-pointer"
                      >
                        {isCopiedThis ? (
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

                    <div className="bg-white text-black border border-black p-4 shadow-md text-[10px] font-sans">
                      {/* 1. RECIBO DO PAGADOR */}
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase text-slate-700 mb-1">
                        <span>Recibo do Pagador</span>
                        <span>
                          {doc.demonstrativoParcela || 'Cobrança Bancária Registrada'}
                        </span>
                      </div>

                      {/* Cabeçalho Banco Recibo */}
                      <div className="flex items-end border-b-2 border-black pb-1">
                        <div className="flex items-center gap-1.5 pr-2.5 border-r-2 border-black shrink-0">
                          <span
                            className="px-1.5 py-0.5 rounded text-white font-black text-[10px]"
                            style={{ backgroundColor: doc.bankMeta.color }}
                          >
                            {doc.bankMeta.code}
                          </span>
                          <span className="font-black text-xs tracking-tight">
                            {doc.bankMeta.shortName}
                          </span>
                        </div>
                        <div className="px-2.5 border-r-2 border-black font-mono font-black text-sm leading-none shrink-0">
                          {doc.bankMeta.codeWithDv}
                        </div>
                        <div className="flex-1 text-right font-mono font-black text-[11px] sm:text-xs pl-2 break-all">
                          {doc.linhaDigitavel}
                        </div>
                      </div>

                      {/* Grade Resumida do Recibo */}
                      <div className="grid grid-cols-6 border-l border-r border-black">
                        <div className="col-span-4 border-b border-r border-black px-1.5 py-1">
                          <span className="block text-[7.5px] uppercase text-slate-600">
                            Beneficiário / Cedente
                          </span>
                          <span className="font-bold text-black block truncate">
                            {doc.beneficiarioNome} — {doc.beneficiarioCnpj}
                          </span>
                        </div>
                        <div className="col-span-2 border-b border-black px-1.5 py-1 text-right">
                          <span className="block text-[7.5px] uppercase text-slate-600">
                            Agência / Código Beneficiário
                          </span>
                          <span className="font-bold font-mono text-black">
                            {doc.agenciaCodigoCedente}
                          </span>
                        </div>

                        <div className="col-span-2 border-b border-r border-black px-1.5 py-1">
                          <span className="block text-[7.5px] uppercase text-slate-600">
                            Pagador
                          </span>
                          <span className="font-bold text-black block truncate">
                            {doc.pagadorNome}
                          </span>
                        </div>
                        <div className="col-span-1 border-b border-r border-black px-1.5 py-1">
                          <span className="block text-[7.5px] uppercase text-slate-600">
                            Nº Documento
                          </span>
                          <span className="font-bold font-mono text-black block truncate">
                            {doc.numeroDocumento}
                          </span>
                        </div>
                        <div className="col-span-1 border-b border-r border-black px-1.5 py-1">
                          <span className="block text-[7.5px] uppercase text-slate-600">
                            Nosso Número
                          </span>
                          <span className="font-bold font-mono text-black block truncate">
                            {doc.nossoNumero}
                          </span>
                        </div>
                        <div className="col-span-1 border-b border-r border-black px-1.5 py-1 text-right">
                          <span className="block text-[7.5px] uppercase text-slate-600">
                            Vencimento
                          </span>
                          <span className="font-black text-black">
                            {formatDateBR(doc.dataVencimento)}
                          </span>
                        </div>
                        <div className="col-span-1 border-b border-black px-1.5 py-1 text-right">
                          <span className="block text-[7.5px] uppercase text-slate-600">
                            (=) Valor Doc.
                          </span>
                          <span className="font-black text-black">
                            {formatCurrencyBRL(doc.valorDocumento)}
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
                            style={{ backgroundColor: doc.bankMeta.color }}
                          >
                            {doc.bankMeta.code}
                          </span>
                          <span className="font-black text-xs tracking-tight">
                            {doc.bankMeta.shortName}
                          </span>
                        </div>
                        <div className="px-2.5 border-r-2 border-black font-mono font-black text-sm leading-none shrink-0">
                          {doc.bankMeta.codeWithDv}
                        </div>
                        <div className="flex-1 text-right font-mono font-black text-[11px] sm:text-xs pl-2 break-all">
                          {doc.linhaDigitavel}
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
                              {doc.bankMeta.localPagamento}
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-1 px-1.5 py-1 text-right bg-slate-50">
                            <span className="block text-[7.5px] uppercase text-slate-600">
                              Vencimento
                            </span>
                            <span className="font-black text-[11px] text-black">
                              {formatDateBR(doc.dataVencimento)}
                            </span>
                          </div>
                        </div>

                        {/* Linha 2 */}
                        <div className="grid grid-cols-6 border-b border-black">
                          <div className="col-span-4 sm:col-span-5 border-r border-black px-1.5 py-1">
                            <span className="block text-[7.5px] uppercase text-slate-600">
                              Beneficiário / Cedente ({doc.beneficiarioCnpj})
                            </span>
                            <span className="font-bold text-black block">
                              {doc.beneficiarioNome}
                              {doc.beneficiarioEndereco ? ` — ${doc.beneficiarioEndereco}` : ''}
                            </span>
                          </div>
                          <div className="col-span-2 sm:col-span-1 px-1.5 py-1 text-right">
                            <span className="block text-[7.5px] uppercase text-slate-600">
                              Agência / Cód. Beneficiário
                            </span>
                            <span className="font-bold font-mono text-black">
                              {doc.agenciaCodigoCedente}
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
                              {formatDateBR(doc.dataDocumento)}
                            </span>
                          </div>
                          <div className="col-span-1 border-r border-black px-1.5 py-1">
                            <span className="block text-[7.5px] uppercase text-slate-600">
                              Nº Documento
                            </span>
                            <span className="font-bold font-mono text-black block truncate">
                              {doc.numeroDocumento}
                            </span>
                          </div>
                          <div className="col-span-1 border-r border-black px-1.5 py-1">
                            <span className="block text-[7.5px] uppercase text-slate-600">
                              Espécie Doc.
                            </span>
                            <span className="font-bold text-black">{doc.especieDoc}</span>
                          </div>
                          <div className="col-span-1 border-r border-black px-1.5 py-1">
                            <span className="block text-[7.5px] uppercase text-slate-600">
                              Aceite
                            </span>
                            <span className="font-bold text-black">{doc.aceite}</span>
                          </div>
                          <div className="col-span-1 border-r border-black px-1.5 py-1">
                            <span className="block text-[7.5px] uppercase text-slate-600">
                              Data Processam.
                            </span>
                            <span className="font-bold text-black">
                              {formatDateBR(doc.dataDocumento)}
                            </span>
                          </div>
                          <div className="col-span-1 px-1.5 py-1 text-right">
                            <span className="block text-[7.5px] uppercase text-slate-600">
                              Nosso Número
                            </span>
                            <span className="font-bold font-mono text-black">
                              {doc.nossoNumero}
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
                            <span className="font-bold font-mono text-black">{doc.carteira}</span>
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
                              {formatCurrencyBRL(doc.valorDocumento)}
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
                              {doc.instrucoes}
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1 flex flex-col divide-y divide-black">
                            <div className="px-1.5 py-1 text-right flex-1">
                              <span className="block text-[7px] uppercase text-slate-600">
                                (-) Desconto / Abatimento
                              </span>
                              <span className="font-bold text-black">
                                {doc.valorDesconto > 0
                                  ? formatCurrencyBRL(doc.valorDesconto)
                                  : 'R$ 0,00'}
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
                                {doc.descontoCondicao === 'abatimento_direto' &&
                                doc.valorDesconto > 0
                                  ? formatCurrencyBRL(
                                      Math.max(0, doc.valorDocumento - doc.valorDesconto)
                                    )
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
                            {doc.pagadorNome} — CPF/CNPJ: {doc.pagadorDocumento}
                          </span>
                          <span className="font-medium text-slate-800 text-[9px] block">
                            {doc.pagadorEndereco}
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
                            {doc.barcode}
                          </span>
                        </div>
                        <div className="text-[8px] uppercase font-bold text-slate-700 border-t border-black pt-0.5 shrink-0 sm:text-right w-full sm:w-48">
                          Autenticação Mecânica — Ficha de Compensação
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RODAPÉ COM AÇÕES DO BOLETO */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-[#cad4e6] border-t border-black shrink-0">
          <div className="text-[11px] font-bold text-slate-800">
            {isBatch ? (
              <>
                Carnê: <span className="text-black font-black">{calculatedBoletos.length} Boletos</span> • Valor Total:{' '}
                <span className="text-black font-black">{formatCurrencyBRL(valorDocumento)}</span> • 1º Vencimento:{' '}
                <span className="text-black font-black">{formatDateBR(dataVencimento)}</span>
              </>
            ) : (
              <>
                Valor Final: <span className="text-black font-black">{formatCurrencyBRL(valorDocumento)}</span> • Vencimento:{' '}
                <span className="text-black font-black">{formatDateBR(dataVencimento)}</span>
              </>
            )}
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
              <span>
                {isBatch
                  ? '🖨️ Imprimir / Salvar PDF (Todos os Boletos)'
                  : '🖨️ Imprimir / Salvar PDF'}
              </span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-900 rounded-lg shadow-2xs transition cursor-pointer uppercase"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>
                {isBatch ? '📲 Enviar Todos por WhatsApp' : '📲 Enviar por WhatsApp'}
              </span>
            </a>

            <button
              type="button"
              id="btn-boleto-gerar-remessa-cnab"
              onClick={handleGenerateRemessa}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-700 hover:bg-indigo-800 border border-black rounded-lg shadow-2xs transition cursor-pointer uppercase"
              title="Gerar e baixar arquivo Remessa CNAB 240 (.REM) deste lote de boletos"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>📤 Gerar Remessa Bancária (.REM)</span>
            </button>

            <a
              href={mailtoUrl}
              onClick={handleShareEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 border border-blue-950 rounded-lg shadow-2xs transition cursor-pointer uppercase"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>
                {isBatch ? '✉️ Enviar Todos por E-mail' : '✉️ Enviar por E-mail'}
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
