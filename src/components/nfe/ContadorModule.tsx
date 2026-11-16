import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  Lock,
  Mail,
  MessageCircle,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import {
  CompanyProfile,
  DocumentoEntradaRecord,
  Expense,
  NotaSaidaRecord,
} from '../../types';
import {
  FISCAL_DOCS_STORAGE_KEYS,
  FiscalDocumentRecord,
} from './FiscalDocumentTypeView';
import {
  MdfeRecord,
  getStoredMdfe,
  saveStoredMdfe,
} from './MdfeView';
import {
  buildUnifiedFiscalRecords,
  getStoredFiscalRecords,
  saveStoredFiscalRecords,
} from './NfeModule';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredCompanyProfile,
  getStoredDocumentosEntrada,
  getStoredExpenses,
  getStoredNotasSaida,
  saveLocalNotaSaida,
  saveStoredDocumentosEntrada,
} from '../../lib/storage';
import {
  formatSystemSupportPhoneMask,
  resolveSubscriberPrintHeader,
} from '../../lib/printIdentity';
import {
  getCurrentCompetence,
  getNextCompetence,
  getPrevCompetence,
} from '../financial/CompetenceSelector';
import {
  AccountingDocItem,
  buildCfopSummary,
  cleanCnpjDigits,
  collectAccountingDocumentsForCompetence,
  ContadorConfig,
  generateAccountingZipPackage,
  getStoredContadorConfig,
  loadRawFiscalXml,
  printAccountingClosingReport,
  saveStoredContadorConfig,
} from '../../lib/accountingExport';

interface ContadorModuleProps {
  companyProfile?: CompanyProfile | null;
  expenses?: Expense[];
}

function readLegacyFiscalDocsFromStorage(): FiscalDocumentRecord[] {
  const keys = [
    FISCAL_DOCS_STORAGE_KEYS.nfe,
    FISCAL_DOCS_STORAGE_KEYS.cte,
    FISCAL_DOCS_STORAGE_KEYS.nfe_c,
    FISCAL_DOCS_STORAGE_KEYS.nfse,
  ];
  const list: FiscalDocumentRecord[] = [];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list.push(...parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return list;
}

export const ContadorModule: React.FC<ContadorModuleProps> = ({
  companyProfile,
  expenses,
}) => {
  const [competence, setCompetence] = useState<string>(() => getCurrentCompetence());
  const [contadorConfig, setContadorConfig] = useState<ContadorConfig>(() => getStoredContadorConfig());
  const [configSavedBadge, setConfigSavedBadge] = useState(false);

  const [documentosEntrada, setDocumentosEntrada] = useState<DocumentoEntradaRecord[]>(() =>
    getStoredDocumentosEntrada()
  );
  const [legacyFiscalDocs, setLegacyFiscalDocs] = useState<FiscalDocumentRecord[]>(() =>
    readLegacyFiscalDocsFromStorage()
  );
  const [mdfeDocs, setMdfeDocs] = useState<MdfeRecord[]>(() => getStoredMdfe());
  const [notasSaida, setNotasSaida] = useState<NotaSaidaRecord[]>(() => getStoredNotasSaida());
  const [fiscalSyncVersion, setFiscalSyncVersion] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [xmlPresenceMap, setXmlPresenceMap] = useState<Record<string, boolean>>({});
  const [showExcludedDrawer, setShowExcludedDrawer] = useState(false);

  const [isExportingZip, setIsExportingZip] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const reloadFiscalSources = useCallback(() => {
    setDocumentosEntrada(getStoredDocumentosEntrada());
    setLegacyFiscalDocs(readLegacyFiscalDocsFromStorage());
    setMdfeDocs(getStoredMdfe());
    setNotasSaida(getStoredNotasSaida());
    setFiscalSyncVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const handleSync = () => reloadFiscalSources();
    window.addEventListener('storage', handleSync);
    window.addEventListener('agrocontrol_fiscal_records_updated', handleSync);
    window.addEventListener('agrocontrol_notas_entradas_updated', handleSync);
    window.addEventListener('agrocontrol_notas_saida_updated', handleSync);
    window.addEventListener('colaca_silagem_expenses_updated', handleSync);
    window.addEventListener('silagem_expenses_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('agrocontrol_fiscal_records_updated', handleSync);
      window.removeEventListener('agrocontrol_notas_entradas_updated', handleSync);
      window.removeEventListener('agrocontrol_notas_saida_updated', handleSync);
      window.removeEventListener('colaca_silagem_expenses_updated', handleSync);
      window.removeEventListener('silagem_expenses_updated', handleSync);
    };
  }, [reloadFiscalSources]);

  const effectiveCompanyProfile = useMemo(
    () => companyProfile || getStoredCompanyProfile(),
    [companyProfile]
  );

  const subscriber = useMemo(
    () => resolveSubscriberPrintHeader(effectiveCompanyProfile),
    [effectiveCompanyProfile]
  );

  const notasFiscaisExibicao = useMemo(() => {
    const sourceExpenses = expenses && expenses.length > 0 ? expenses : getStoredExpenses();
    return buildUnifiedFiscalRecords(sourceExpenses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, fiscalSyncVersion]);

  const { includedDocs, excludedDocs } = useMemo(() => {
    return collectAccountingDocumentsForCompetence({
      competence,
      companyProfile: effectiveCompanyProfile,
      notasFiscaisExibicao,
      documentosEntrada,
      legacyFiscalDocs,
      mdfeDocs,
      notasSaida,
    });
  }, [
    competence,
    effectiveCompanyProfile,
    notasFiscaisExibicao,
    documentosEntrada,
    legacyFiscalDocs,
    mdfeDocs,
    notasSaida,
  ]);

  // Verifica no IndexedDB quais documentos possuem XML original gravado
  useEffect(() => {
    let cancelled = false;
    const checkAll = async () => {
      const nextMap: Record<string, boolean> = {};
      await Promise.all(
        includedDocs.map(async (doc) => {
          const found = await loadRawFiscalXml([
            doc.xmlStorageKey,
            doc.accessKey,
            doc.id,
            doc.rawExpense?.id,
            doc.rawManualDoc?.id,
            doc.rawNotaSaida?.id,
          ]);
          nextMap[doc.id] = Boolean(found);
        })
      );
      if (!cancelled) {
        setXmlPresenceMap(nextMap);
      }
    };
    checkAll();
    return () => {
      cancelled = true;
    };
  }, [includedDocs]);

  // Seleciona todos os documentos aptos por padrão sempre que muda competência ou lista
  useEffect(() => {
    setSelectedIds(new Set(includedDocs.map((d) => d.id)));
  }, [includedDocs]);

  const includedWithXmlStatus = useMemo(() => {
    return includedDocs.map((d) => ({
      ...d,
      hasOriginalXml: xmlPresenceMap[d.id] ?? d.hasOriginalXml,
    }));
  }, [includedDocs, xmlPresenceMap]);

  const selectedDocs = useMemo(() => {
    return includedWithXmlStatus.filter((d) => selectedIds.has(d.id));
  }, [includedWithXmlStatus, selectedIds]);

  const cfopSummary = useMemo(() => buildCfopSummary(selectedDocs), [selectedDocs]);

  const summaryStats = useMemo(() => {
    const entradas = selectedDocs.filter((d) => d.direction === 'entrada');
    const saidasNfe = selectedDocs.filter((d) => d.direction === 'saida' && d.docCategory === 'nfe');
    const outrosFiscais = selectedDocs.filter(
      (d) =>
        d.docCategory === 'cte' ||
        d.docCategory === 'nfse' ||
        d.docCategory === 'nfce' ||
        d.docCategory === 'mdfe'
    );
    const pendentesCanceladas = selectedDocs.filter((d) => d.isCanceledOrDraft);

    const sum = (arr: AccountingDocItem[]) =>
      arr.reduce((acc, item) => acc + (Number(item.valorTotal) || 0), 0);

    return {
      entradas: { count: entradas.length, total: sum(entradas) },
      saidasNfe: { count: saidasNfe.length, total: sum(saidasNfe) },
      outrosFiscais: { count: outrosFiscais.length, total: sum(outrosFiscais) },
      pendentesCanceladas: { count: pendentesCanceladas.length, total: sum(pendentesCanceladas) },
    };
  }, [selectedDocs]);

  const handleToggleDocEnviarContador = useCallback(
    (doc: AccountingDocItem, nextValue: boolean) => {
      const motivo = nextValue
        ? 'Incluído no fechamento contábil'
        : 'Marcado manualmente como Controle Interno / Não Fiscal';

      if (doc.sourceKind === 'nota_saida' && doc.rawNotaSaida) {
        const updatedNota: NotaSaidaRecord = {
          ...doc.rawNotaSaida,
          enviarContador: nextValue,
          enviarContadorMotivo: motivo,
          updatedAt: new Date().toISOString(),
        };
        saveLocalNotaSaida(updatedNota);
        setNotasSaida(getStoredNotasSaida());
        window.dispatchEvent(new CustomEvent('agrocontrol_notas_saida_updated'));
        return;
      }

      if (doc.sourceKind === 'xml_expense' || doc.rawExpense) {
        const expId = doc.rawExpense?.id || doc.id;
        const storedFiscal = getStoredFiscalRecords();
        const existsInFiscal = storedFiscal.some((f) => f.id === expId);
        const updatedFiscal = existsInFiscal
          ? storedFiscal.map((f) =>
              f.id === expId ? { ...f, enviarContador: nextValue, enviarContadorMotivo: motivo } : f
            )
          : [
              ...storedFiscal,
              ...(doc.rawExpense
                ? [{ ...doc.rawExpense, enviarContador: nextValue, enviarContadorMotivo: motivo }]
                : []),
            ];
        saveStoredFiscalRecords(updatedFiscal);

        const storedDocs = getStoredDocumentosEntrada();
        if (storedDocs.some((d) => d.id === expId)) {
          const updatedDocs = storedDocs.map((d) =>
            d.id === expId ? { ...d, enviarContador: nextValue, enviarContadorMotivo: motivo } : d
          );
          saveStoredDocumentosEntrada(updatedDocs);
          setDocumentosEntrada(updatedDocs);
          window.dispatchEvent(new CustomEvent('agrocontrol_notas_entradas_updated'));
        }
        setFiscalSyncVersion((v) => v + 1);
        window.dispatchEvent(new CustomEvent('agrocontrol_fiscal_records_updated'));
        return;
      }

      if (doc.sourceKind === 'manual_doc' || doc.rawManualDoc) {
        const docId = doc.rawManualDoc?.id || doc.id;
        const storedDocs = getStoredDocumentosEntrada();
        const updatedDocs = storedDocs.map((d) =>
          d.id === docId ? { ...d, enviarContador: nextValue, enviarContadorMotivo: motivo } : d
        );
        saveStoredDocumentosEntrada(updatedDocs);
        setDocumentosEntrada(updatedDocs);
        window.dispatchEvent(new CustomEvent('agrocontrol_notas_entradas_updated'));
        return;
      }

      if (doc.sourceKind === 'legacy_fiscal' || doc.rawLegacyFiscalDoc) {
        const legId = doc.rawLegacyFiscalDoc?.id || doc.id;
        const keys = [
          FISCAL_DOCS_STORAGE_KEYS.nfe,
          FISCAL_DOCS_STORAGE_KEYS.cte,
          FISCAL_DOCS_STORAGE_KEYS.nfe_c,
          FISCAL_DOCS_STORAGE_KEYS.nfse,
        ];
        for (const k of keys) {
          try {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) continue;
            if (parsed.some((r: any) => r && r.id === legId)) {
              const nextArr = parsed.map((r: any) =>
                r && r.id === legId ? { ...r, enviarContador: nextValue, enviarContadorMotivo: motivo } : r
              );
              localStorage.setItem(k, JSON.stringify(nextArr));
            }
          } catch {
            // ignore errors
          }
        }
        setLegacyFiscalDocs(readLegacyFiscalDocsFromStorage());
        window.dispatchEvent(new CustomEvent('agrocontrol_fiscal_records_updated'));
        return;
      }

      if (doc.sourceKind === 'mdfe' || doc.rawMdfeDoc) {
        const mdId = doc.rawMdfeDoc?.id || doc.id;
        const storedMdfe = getStoredMdfe();
        const updatedMdfe = storedMdfe.map((m) =>
          m.id === mdId ? ({ ...m, enviarContador: nextValue, enviarContadorMotivo: motivo } as MdfeRecord) : m
        );
        saveStoredMdfe(updatedMdfe);
        setMdfeDocs(updatedMdfe);
        window.dispatchEvent(new CustomEvent('agrocontrol_fiscal_records_updated'));
      }
    },
    []
  );

  const handleUpdateConfig = (patch: Partial<ContadorConfig>) => {
    const nextRaw: ContadorConfig = {
      ...contadorConfig,
      ...patch,
    };
    if (patch.whatsapp !== undefined) {
      nextRaw.whatsapp = formatSystemSupportPhoneMask(patch.whatsapp);
    }
    setContadorConfig(nextRaw);
    saveStoredContadorConfig(nextRaw);
    setConfigSavedBadge(true);
    window.setTimeout(() => setConfigSavedBadge(false), 1800);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === includedWithXmlStatus.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(includedWithXmlStatus.map((d) => d.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadZip = async (): Promise<string | null> => {
    if (selectedDocs.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Selecione ao menos 01 documento fiscal na lista para gerar o pacote .ZIP do contador.',
      });
      return null;
    }

    setIsExportingZip(true);
    setFeedback(null);
    try {
      const result = await generateAccountingZipPackage({
        competence,
        companyProfile: effectiveCompanyProfile,
        items: selectedDocs,
      });
      setFeedback({
        type: 'success',
        message: `Pacote "${result.filename}" gerado e baixado com ${result.xmlCount} XML(s) (${result.originalCount} originais e ${result.structuredCount} estruturados) + planilha resumo CSV.`,
      });
      return result.filename;
    } catch (err) {
      console.error('Erro ao gerar pacote ZIP contábil:', err);
      setFeedback({
        type: 'error',
        message: 'Falha ao gerar o arquivo .ZIP contábil. Verifique os dados e tente novamente.',
      });
      return null;
    } finally {
      setIsExportingZip(false);
    }
  };

  const handlePrintPdfReport = () => {
    if (selectedDocs.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Selecione ao menos 01 documento fiscal para imprimir o relatório de fechamento.',
      });
      return;
    }
    const ok = printAccountingClosingReport({
      competence,
      companyProfile: effectiveCompanyProfile,
      contadorConfig,
      items: selectedDocs,
      excludedCount: excludedDocs.length,
    });
    if (ok) {
      setFeedback({
        type: 'info',
        message: 'Relatório de Fechamento Contábil enviado para visualização / impressão PDF.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: 'Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.',
      });
    }
  };

  const buildClosingTextSummary = (zipFilename?: string | null) => {
    const cfopText = cfopSummary
      .slice(0, 10)
      .map((r) => `- CFOP ${r.cfop} (${r.qtdNotas}x): ${formatCurrencyBRL(r.valorTotal)}`)
      .join('\n');

    return [
      `FECHAMENTO FISCAL MENSAL — COMPETENCIA ${competence}`,
      `Empresa: ${subscriber.displayTitle}`,
      subscriber.cnpjCpf ? `CNPJ: ${subscriber.cnpjCpf}` : '',
      contadorConfig.escritorioNome ? `Contabilidade: ${contadorConfig.escritorioNome}` : '',
      '',
      `RESUMO DO LOTE (${selectedDocs.length} documento(s)):`,
      `- Entradas (Compras): ${summaryStats.entradas.count} doc(s) | ${formatCurrencyBRL(summaryStats.entradas.total)}`,
      `- Saidas NF-e: ${summaryStats.saidasNfe.count} doc(s) | ${formatCurrencyBRL(summaryStats.saidasNfe.total)}`,
      `- CT-e / NFS-e / NFC-e / MDF-e: ${summaryStats.outrosFiscais.count} doc(s) | ${formatCurrencyBRL(summaryStats.outrosFiscais.total)}`,
      `- Pendentes / Canceladas: ${summaryStats.pendentesCanceladas.count} doc(s)`,
      `- Lancamentos internos/outros CNPJs excluidos automaticamente: ${excludedDocs.length}`,
      cfopText ? `\nRESUMO POR CFOP:\n${cfopText}` : '',
      zipFilename ? `\nArquivo ZIP gerado para anexo: ${zipFilename}` : '',
      contadorConfig.crcObservacoes ? `\nObservacoes: ${contadorConfig.crcObservacoes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleSendByEmail = async () => {
    const email = (contadorConfig.email || '').trim();
    if (!email || !email.includes('@')) {
      setFeedback({
        type: 'error',
        message: 'Informe o "E-mail da Contabilidade *" no Bloco 1 antes de enviar por e-mail.',
      });
      const input = document.getElementById('contador-email-input');
      input?.focus();
      return;
    }
    if (selectedDocs.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Selecione ao menos 01 documento fiscal para enviar ao contador.',
      });
      return;
    }

    const zipName = await handleDownloadZip();
    const subject = encodeURIComponent(
      `Fechamento Fiscal ${competence} - ${subscriber.displayTitle}${subscriber.cnpjCpf ? ` (${subscriber.cnpjCpf})` : ''}`
    );
    const body = encodeURIComponent(buildClosingTextSummary(zipName));
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;

    const link = document.createElement('a');
    link.href = mailtoUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setFeedback({
      type: 'success',
      message: `Pacote ${zipName || '.ZIP'} baixado! Cliente de e-mail acionado para ${email} — anexe o arquivo .ZIP baixado à mensagem.`,
    });
  };

  const handleNotifyWhatsApp = async () => {
    if (selectedDocs.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Selecione ao menos 01 documento fiscal para compor a notificação ao contador.',
      });
      return;
    }

    const rawDigits = cleanCnpjDigits(contadorConfig.whatsapp);
    const summaryText = buildClosingTextSummary();
    try {
      await navigator.clipboard.writeText(summaryText);
    } catch {
      // ignore clipboard fallback
    }

    if (!rawDigits || rawDigits.length < 10) {
      setFeedback({
        type: 'info',
        message:
          'Resumo do fechamento copiado para a área de transferência! Informe o WhatsApp do Contador no Bloco 1 para abrir a conversa diretamente.',
      });
      return;
    }

    const phoneWithCountry = rawDigits.startsWith('55') ? rawDigits : `55${rawDigits}`;
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(summaryText)}`;

    const link = document.createElement('a');
    link.href = waUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setFeedback({
      type: 'success',
      message: `Resumo copiado e WhatsApp do contador (${contadorConfig.whatsapp}) acionado com os totais da competência ${competence}.`,
    });
  };

  return (
    <div id="contador-module" className="w-full max-w-none flex-1 min-h-0 flex flex-col gap-2.5 text-black dark:text-stone-100">
      {/* CABEÇALHO DO MÓDULO CONTADOR */}
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-stone-800 shadow-[0_1px_0px_0px_rgba(255,255,255,0.8)] dark:shadow-[0_1px_0px_0px_rgba(255,255,255,0.05)] pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center border border-black/40 shrink-0 shadow-xs">
            <Calculator className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight uppercase truncate">
              CONTADOR — FECHAMENTO FISCAL &amp; XMLs
            </h2>
            <p className="text-[11px] font-bold text-slate-700 dark:text-stone-300 truncate">
              {subscriber.displayTitle}
              {subscriber.cnpjCpf ? ` • CNPJ: ${subscriber.cnpjCpf}` : ' • Cadastre o CNPJ em Dados da Empresa'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Seletor de Competência < Mês/Ano > */}
          <div className="inline-flex items-center bg-white dark:bg-stone-900 border border-black dark:border-stone-600 rounded-lg overflow-hidden shadow-2xs">
            <button
              type="button"
              id="btn-contador-prev-competence"
              onClick={() => setCompetence((c) => getPrevCompetence(c))}
              className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-stone-800 border-r border-black/30 cursor-pointer"
              title="Competência anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 text-xs font-black font-mono uppercase tracking-wider">
              COMPETÊNCIA: {competence}
            </span>
            <button
              type="button"
              id="btn-contador-next-competence"
              onClick={() => setCompetence((c) => getNextCompetence(c))}
              className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-stone-800 border-l border-black/30 cursor-pointer"
              title="Próxima competência"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-stone-800 text-[11px] font-black text-zinc-800 dark:text-stone-200 border border-slate-300 dark:border-stone-700 shadow-2xs">
            {includedWithXmlStatus.length} doc(s) no lote
          </div>
        </div>
      </header>

      {/* CONTAINER PRINCIPAL INTEGRADO */}
      <div className="w-full flex-1 min-h-0 flex flex-col bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-sm overflow-hidden">
        {/* CORPO SCROLLÁVEL */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
          {/* BLOCO 1: CONFIGURAÇÕES DA CONTABILIDADE */}
          <section className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-2.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-black dark:text-stone-100 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
                <span>1. Dados do Escritório / Contabilidade Destinatária</span>
              </h3>
              {configSavedBadge && (
                <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 border border-emerald-400 px-2 py-0.5 rounded">
                  ✓ Salvo automaticamente
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                  Nome do Escritório / Contador
                </label>
                <input
                  id="contador-escritorio-input"
                  type="text"
                  value={contadorConfig.escritorioNome}
                  onChange={(e) => handleUpdateConfig({ escritorioNome: e.target.value })}
                  placeholder="EX: CONTABILIDADE RURAL LTDA"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                  E-mail da Contabilidade <span className="text-rose-600">*</span>
                </label>
                <input
                  id="contador-email-input"
                  type="email"
                  value={contadorConfig.email}
                  onChange={(e) => handleUpdateConfig({ email: e.target.value })}
                  placeholder="fiscal@contabilidade.com.br"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                  WhatsApp do Contador
                </label>
                <input
                  id="contador-whatsapp-input"
                  type="text"
                  value={contadorConfig.whatsapp}
                  onChange={(e) => handleUpdateConfig({ whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-stone-300 mb-0.5">
                  CRC / Observações Padrão
                </label>
                <input
                  id="contador-crc-input"
                  type="text"
                  value={contadorConfig.crcObservacoes}
                  onChange={(e) => handleUpdateConfig({ crcObservacoes: e.target.value })}
                  placeholder="EX: CRC PR-000000/O • ENVIAR ATÉ DIA 05"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-stone-900 border border-black/50 dark:border-stone-600 rounded-lg text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>
          </section>

          {/* BLOCO 2: FILTRO DE SEGURANÇA & AUDITORIA DE EXCLUÍDOS */}
          <section className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-600 dark:border-emerald-700 rounded-xl p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>
                  🛡️ <strong>Filtro Contábil Ativo:</strong> Mostrando apenas documentos fiscais vinculados ao CNPJ da empresa (
                  <strong>{excludedDocs.length}</strong> lançamento(s) interno(s) / não fiscal(is) / outros CNPJs foram excluídos automaticamente deste lote)
                </span>
              </div>
              <button
                type="button"
                id="btn-ver-excluidos-contador"
                onClick={() => setShowExcludedDrawer((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-950 border border-amber-500 text-[11px] font-black uppercase cursor-pointer transition shrink-0"
              >
                {showExcludedDrawer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showExcludedDrawer ? 'Ocultar Excluídos' : `Ver Excluídos (${excludedDocs.length})`}</span>
              </button>
            </div>

            {showExcludedDrawer && (
              <div className="mt-2 pt-2 border-t border-emerald-400/50">
                {excludedDocs.length === 0 ? (
                  <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 py-1">
                    Nenhum documento foi excluído na competência {competence}.
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto bg-white dark:bg-stone-900 border border-black/40 rounded-lg">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 uppercase font-black border-b border-black/30 sticky top-0">
                        <tr>
                          <th className="py-1 px-2">Mov.</th>
                          <th className="py-1 px-2">Tipo</th>
                          <th className="py-1 px-2">Número</th>
                          <th className="py-1 px-2">Parte (Emitente/Destinatário)</th>
                          <th className="py-1 px-2">Motivo da Exclusão Automática</th>
                          <th className="py-1 px-2 text-right">Valor</th>
                          <th className="py-1 px-2 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-stone-800">
                        {excludedDocs.map((doc) => (
                          <tr key={`excl_${doc.sourceKind}_${doc.id}`} className="hover:bg-amber-50/50 dark:hover:bg-stone-800/60">
                            <td className="py-1 px-2 font-black uppercase">
                              {doc.direction === 'entrada' ? 'ENTRADA' : 'SAÍDA'}
                            </td>
                            <td className="py-1 px-2 font-bold">{doc.tipoLabel}</td>
                            <td className="py-1 px-2 font-mono font-bold">{doc.numero}</td>
                            <td className="py-1 px-2 truncate max-w-[180px]">{doc.parteNome}</td>
                            <td className="py-1 px-2 text-amber-900 dark:text-amber-300 font-semibold">
                              <span className="inline-flex items-center gap-1">
                                <Lock className="w-3 h-3 shrink-0" />
                                <span>{doc.exclusionReason}</span>
                              </span>
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-bold">
                              {formatCurrencyBRL(doc.valorTotal)}
                            </td>
                            <td className="py-1 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleDocEnviarContador(doc, true)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase cursor-pointer"
                              >
                                Incluir no Lote
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* BLOCO 3: PAINEL DE CONFERÊNCIA CONTÁBIL (4 CARDS + RESUMO CFOP) */}
          <section className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="bg-white dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl px-3 py-2 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-sky-800 dark:text-sky-300 block">
                  📥 XMLs DE ENTRADA (COMPRAS)
                </span>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-sm font-black font-mono text-black dark:text-white">
                    {formatCurrencyBRL(summaryStats.entradas.total)}
                  </span>
                  <span className="text-[11px] font-black text-slate-600 dark:text-stone-300">
                    {summaryStats.entradas.count} doc(s)
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl px-3 py-2 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300 block">
                  📤 XMLs DE SAÍDA (VENDAS / REM. / RET.)
                </span>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-sm font-black font-mono text-black dark:text-white">
                    {formatCurrencyBRL(summaryStats.saidasNfe.total)}
                  </span>
                  <span className="text-[11px] font-black text-slate-600 dark:text-stone-300">
                    {summaryStats.saidasNfe.count} doc(s)
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl px-3 py-2 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300 block">
                  🚛 CT-e / NFS-e / NFC-e / MDF-e
                </span>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-sm font-black font-mono text-black dark:text-white">
                    {formatCurrencyBRL(summaryStats.outrosFiscais.total)}
                  </span>
                  <span className="text-[11px] font-black text-slate-600 dark:text-stone-300">
                    {summaryStats.outrosFiscais.count} doc(s)
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl px-3 py-2 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 block">
                  🚫 CANCELADAS / PENDENTES DE ENVIO
                </span>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-sm font-black font-mono text-black dark:text-white">
                    {formatCurrencyBRL(summaryStats.pendentesCanceladas.total)}
                  </span>
                  <span className="text-[11px] font-black text-slate-600 dark:text-stone-300">
                    {summaryStats.pendentesCanceladas.count} doc(s)
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela de Resumo por CFOP & Natureza */}
            <div className="bg-white dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl overflow-hidden">
              <div className="px-3 py-1.5 bg-[#e0e6f1] dark:bg-stone-700 border-b border-black/40 flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider">
                  📊 Resumo por CFOP &amp; Natureza de Operação ({cfopSummary.length} código(s))
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-stone-900 border-b border-slate-300 dark:border-stone-700 uppercase font-black text-[10px] sticky top-0">
                    <tr>
                      <th className="py-1 px-2.5 w-20 text-center">CFOP</th>
                      <th className="py-1 px-2.5">Descrição</th>
                      <th className="py-1 px-2.5 w-36">Tipo</th>
                      <th className="py-1 px-2.5 w-24 text-center">Qtd Notas</th>
                      <th className="py-1 px-2.5 w-36 text-right">Valor Contábil Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-stone-700">
                    {cfopSummary.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-center text-slate-500 font-bold uppercase">
                          Nenhum documento fiscal selecionado para apuração de CFOP.
                        </td>
                      </tr>
                    ) : (
                      cfopSummary.map((row) => (
                        <tr key={`cfop_${row.cfop}`} className="even:bg-slate-50 dark:even:bg-stone-800/40">
                          <td className="py-1 px-2.5 text-center font-mono font-black text-indigo-800 dark:text-indigo-300">
                            {row.cfop}
                          </td>
                          <td className="py-1 px-2.5 font-semibold uppercase">{row.descricao}</td>
                          <td className="py-1 px-2.5 font-bold text-slate-600 dark:text-stone-300 uppercase">
                            {row.tipo}
                          </td>
                          <td className="py-1 px-2.5 text-center font-black">{row.qtdNotas}</td>
                          <td className="py-1 px-2.5 text-right font-mono font-black">
                            {formatCurrencyBRL(row.valorTotal)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* BLOCO 4: LISTAGEM EM LOTE COM CHECKBOXES */}
          <section className="bg-white dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl overflow-hidden">
            <div className="px-3 py-1.5 bg-[#e0e6f1] dark:bg-stone-700 border-b border-black/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
                <span className="text-[11px] font-black uppercase tracking-wider">
                  4. Documentos Fiscais do Lote Contábil ({selectedDocs.length} de {includedWithXmlStatus.length} selecionado(s))
                </span>
              </div>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-2.5 py-0.5 rounded bg-white hover:bg-slate-100 text-black border border-black/50 text-[10px] font-black uppercase cursor-pointer"
              >
                {selectedIds.size === includedWithXmlStatus.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 dark:bg-stone-900 border-b border-slate-300 dark:border-stone-700 uppercase font-black text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-1.5 px-2 w-8 text-center">
                      <input
                        type="checkbox"
                        checked={includedWithXmlStatus.length > 0 && selectedIds.size === includedWithXmlStatus.length}
                        onChange={toggleSelectAll}
                        className="w-3.5 h-3.5 accent-indigo-700 cursor-pointer"
                        aria-label="Selecionar todos os XMLs"
                      />
                    </th>
                    <th className="py-1.5 px-2 w-32">Tipo</th>
                    <th className="py-1.5 px-2 w-24">Número / Série</th>
                    <th className="py-1.5 px-2 w-24 text-center">Data</th>
                    <th className="py-1.5 px-2 min-w-[180px]">Emitente / Destinatário</th>
                    <th className="py-1.5 px-2 w-16 text-center">CFOP</th>
                    <th className="py-1.5 px-2 w-28 text-center">Status SEFAZ</th>
                    <th className="py-1.5 px-2 w-40 text-center">Status do XML</th>
                    <th className="py-1.5 px-2 w-28 text-right">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-stone-700">
                  {includedWithXmlStatus.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500 font-bold uppercase">
                        Nenhum documento fiscal apto para o contador na competência {competence}.
                      </td>
                    </tr>
                  ) : (
                    includedWithXmlStatus.map((doc) => {
                      const checked = selectedIds.has(doc.id);
                      return (
                        <tr
                          key={`batch_${doc.sourceKind}_${doc.id}`}
                          className={`even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-indigo-50/60 dark:hover:bg-stone-800 cursor-pointer ${
                            !checked ? 'opacity-55' : ''
                          }`}
                          onClick={() => toggleSelectOne(doc.id)}
                        >
                          <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelectOne(doc.id)}
                              className="w-3.5 h-3.5 accent-indigo-700 cursor-pointer"
                              aria-label={`Selecionar ${doc.tipoLabel} ${doc.numero}`}
                            />
                          </td>
                          <td className="py-1 px-2 font-bold whitespace-nowrap">
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase border mr-1 ${
                                doc.direction === 'entrada'
                                  ? 'bg-sky-100 text-sky-900 border-sky-300'
                                  : 'bg-blue-100 text-blue-900 border-blue-300'
                              }`}
                            >
                              {doc.direction === 'entrada' ? 'ENT' : 'SAÍ'}
                            </span>
                            <span>{doc.tipoLabel}</span>
                          </td>
                          <td className="py-1 px-2 font-mono font-black whitespace-nowrap">
                            {doc.numero}/{doc.serie}
                          </td>
                          <td className="py-1 px-2 text-center font-mono whitespace-nowrap">
                            {formatDateBR(doc.dataEmissao)}
                          </td>
                          <td className="py-1 px-2 font-bold uppercase truncate max-w-[230px]" title={doc.parteNome}>
                            {doc.parteNome}
                          </td>
                          <td className="py-1 px-2 text-center font-mono font-bold text-indigo-800 dark:text-indigo-300">
                            {doc.cfop}
                          </td>
                          <td className="py-1 px-2 text-center whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase border ${
                                doc.isCanceledOrDraft
                                  ? 'bg-amber-100 text-amber-900 border-amber-400'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-400'
                              }`}
                            >
                              {doc.statusSefaz}
                            </span>
                          </td>
                          <td className="py-1 px-2 text-center whitespace-nowrap">
                            {doc.hasOriginalXml ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-400 text-[9.5px] font-black">
                                ✅ XML Original
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 text-[9.5px] font-black">
                                🔄 XML Estruturado Gerado
                              </span>
                            )}
                          </td>
                          <td className="py-1 px-2 text-right font-mono font-black whitespace-nowrap">
                            {formatCurrencyBRL(doc.valorTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {feedback && (
            <div
              className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border-rose-500 text-rose-900'
                  : feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                    : 'bg-sky-50 border-sky-500 text-sky-900'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

        {/* RODAPÉ DE EXPORTAÇÃO & ENVIO */}
        <footer className="px-4 py-2.5 bg-[#b8c6de] dark:bg-stone-800 border-t border-black dark:border-stone-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] font-black uppercase text-slate-800 dark:text-stone-200">
            Lote Selecionado: <span className="font-mono">{selectedDocs.length}</span> documento(s) • Total:{' '}
            <span className="font-mono text-emerald-800 dark:text-emerald-300">
              {formatCurrencyBRL(selectedDocs.reduce((a, b) => a + (Number(b.valorTotal) || 0), 0))}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-baixar-zip-contador"
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white border border-emerald-900 rounded-lg text-xs font-black uppercase cursor-pointer shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingZip ? 'GERANDO PACOTE .ZIP...' : '📥 BAIXAR PACOTE COMPLETO (.ZIP)'}</span>
            </button>

            <button
              type="button"
              id="btn-imprimir-fechamento-contador"
              onClick={handlePrintPdfReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white border border-black rounded-lg text-xs font-black uppercase cursor-pointer shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ IMPRIMIR RELATÓRIO DE FECHAMENTO (PDF)</span>
            </button>

            <button
              type="button"
              id="btn-email-contador"
              onClick={handleSendByEmail}
              disabled={isExportingZip}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white border border-sky-950 rounded-lg text-xs font-black uppercase cursor-pointer shadow-sm transition"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>✉️ ENVIAR POR E-MAIL AO CONTADOR</span>
            </button>

            <button
              type="button"
              id="btn-whatsapp-contador"
              onClick={handleNotifyWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-green-700 hover:bg-green-800 text-white border border-green-950 rounded-lg text-xs font-black uppercase cursor-pointer shadow-sm transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>📲 NOTIFICAR CONTADOR NO WHATSAPP</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
