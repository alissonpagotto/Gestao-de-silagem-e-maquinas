import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  ExternalLink, 
  CheckCircle2, 
  MessageCircle, 
  Copy, 
  Check, 
  Send,
  Smartphone,
  FileText,
  Download,
  Loader2,
  Share2,
  Sparkles,
  Info
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { 
  generatePrintableHtml, 
  executePrint, 
  sendViaWhatsApp, 
  PrintDocumentOptions 
} from '../../lib/printService';
import { formatDateBR } from '../../lib/storage';
import { formatPhone, cleanDigits } from '../../lib/formatters';
import { 
  generatePdfFromElement, 
  downloadPdfBlob, 
  canShareFilesNatively, 
  sharePdfNatively 
} from '../../lib/pdfGenerator';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: PrintDocumentOptions;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  options,
}) => {
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsappMode, setWhatsappMode] = useState<'pdf' | 'text'>('pdf');
  const [copied, setCopied] = useState(false);

  // PDF Generation States
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  const printDocRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const { 
    company, 
    title, 
    subtitle, 
    documentType = 'DOCUMENTO OFICIAL', 
    contentHtml, 
    showSignatures = true, 
    signatureLabels = ['Responsável Técnico / Encarregado', 'Gerência Operacional / Diretoria'],
    whatsappText 
  } = options;

  const handlePrint = () => {
    const html = generatePrintableHtml(options);
    executePrint(html);
  };

  const handleOpenInNewTab = () => {
    const html = generatePrintableHtml(options);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Generate clean default WhatsApp text if not explicitly provided
  const resolvedWhatsAppText = whatsappText || (() => {
    const now = new Date();
    const dateStr = formatDateBR(now.toISOString().split('T')[0]);
    let text = `🚜 *${company.tradeName?.toUpperCase() || 'SILAGEM FÁCIL'}*\n`;
    text += `📋 *${title.toUpperCase()}*\n`;
    if (subtitle) text += `📌 ${subtitle}\n`;
    text += `📅 *Data de Emissão:* ${dateStr}\n`;
    if (company.phone) text += `📞 *Contato:* ${company.phone}\n`;
    text += `\n_Emitido eletronicamente via Silagem Fácil Pro_`;
    return text;
  })();

  const handleCopyWhatsAppText = () => {
    navigator.clipboard.writeText(resolvedWhatsAppText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsAppDirectText = () => {
    sendViaWhatsApp(resolvedWhatsAppText);
    setIsWhatsAppModalOpen(false);
  };

  // Generate & Download PDF
  const handleDownloadPdfOnly = async () => {
    if (!printDocRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const { blob, filename } = await generatePdfFromElement(printDocRef.current, {
        title,
        filename: `${title}_${company.tradeName || 'silagem_facil'}`,
      });
      downloadPdfBlob(blob, filename);
      setPdfSuccessMessage(`✅ PDF baixado: ${filename}`);
      setTimeout(() => setPdfSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Share PDF to WhatsApp (Generates & Downloads PDF + Opens WhatsApp to pick contact)
  const handleSharePdfToWhatsApp = async () => {
    if (!printDocRef.current) return;
    setIsGeneratingPdf(true);
    setPdfSuccessMessage(null);

    try {
      const { blob, file, filename } = await generatePdfFromElement(printDocRef.current, {
        title,
        filename: `${title}_${company.tradeName || 'silagem_facil'}`,
      });

      // 1. If mobile native file sharing is available
      const hasNativeShare = canShareFilesNatively(file);
      if (hasNativeShare) {
        const shared = await sharePdfNatively(
          file, 
          `${title} - ${company.tradeName || 'Silagem Fácil'}`,
          `Segue o documento oficial em anexo: ${title}`
        );
        if (shared) {
          setIsGeneratingPdf(false);
          setIsWhatsAppModalOpen(false);
          return;
        }
      }

      // 2. Download PDF and immediately open WhatsApp
      downloadPdfBlob(blob, filename);
      setPdfSuccessMessage(`✅ PDF baixado com sucesso! Abrindo WhatsApp...`);
      
      const escortText = `🚜 *${company.tradeName || 'SILAGEM FÁCIL'}*\n📄 *${title.toUpperCase()}*\n\nEstou enviando o arquivo em anexo (*${filename}*).`;
      sendViaWhatsApp(escortText);

    } catch (err) {
      console.error('Error sharing PDF to WhatsApp:', err);
      // Fallback open WhatsApp directly
      sendViaWhatsApp(resolvedWhatsAppText);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const now = new Date();
  const dateFormatted = formatDateBR(now.toISOString().split('T')[0]);
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const fullAddress = [
    company.address,
    company.number ? `nº ${company.number}` : '',
    company.neighborhood ? `- ${company.neighborhood}` : '',
    company.city ? `${company.city}` : '',
    company.state ? `/${company.state}` : '',
    company.zipCode ? `- CEP: ${company.zipCode}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const defaultPdfFilename = `${title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.pdf`;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div 
        className={`bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full ${options.orientation === 'landscape' ? 'max-w-6xl' : 'max-w-4xl'} shadow-2xl overflow-hidden flex flex-col max-h-[92vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Actions Bar */}
        <div className="bg-white dark:bg-stone-900 px-4 sm:px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 text-[#0963cb] dark:text-blue-400 shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100 font-['Outfit'] truncate">
                Visualização de Impressão Oficial
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                Documento formatado com o logotipo e dados cadastrais da empresa
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* WhatsApp Share Button (PDF / Text Choice) */}
            <button
              onClick={() => {
                setWhatsappMode('pdf');
                setIsWhatsAppModalOpen(true);
              }}
              title="Enviar por WhatsApp (Escolha PDF ou Texto)"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar no WhatsApp</span>
            </button>

            {/* Quick Direct PDF Download */}
            <button
              onClick={handleDownloadPdfOnly}
              disabled={isGeneratingPdf}
              title="Baixar arquivo PDF diretamente"
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-bold border border-stone-200 dark:border-stone-700 transition cursor-pointer"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span className="hidden sm:inline">Baixar PDF</span>
            </button>

            {/* Open New Tab / Print */}
            <button
              onClick={handleOpenInNewTab}
              title="Abrir em nova aba / Salvar como PDF nativo"
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 rounded-xl text-xs font-bold border border-stone-200 dark:border-stone-700 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Aba</span>
            </button>

            {/* Print Now Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-700 dark:hover:bg-stone-600 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Sheet Preview Area */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-stone-200/70 dark:bg-stone-950/70 flex justify-center">
          <div 
            ref={printDocRef}
            className={`bg-white text-stone-900 w-full ${options.orientation === 'landscape' ? 'max-w-[1060px]' : 'max-w-[800px]'} p-6 sm:p-8 rounded-lg shadow-lg border border-stone-300 font-sans text-xs space-y-4`}
          >
            
            {/* Header with Company Logo */}
            <div className="flex items-center justify-between border-b-2 border-[#0963cb] pb-3 gap-4">
              <div className="w-18 h-18 shrink-0 rounded-lg bg-blue-50 border border-blue-200 p-1 flex items-center justify-center overflow-hidden">
                {company.logoUrl ? (
                  <img 
                    src={company.logoUrl} 
                    alt="Logo" 
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-xl font-black text-[#0963cb]">SF</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-base font-black text-[#0963cb] uppercase tracking-tight font-['Outfit']">
                  {company.tradeName || 'Silagem Fácil'}
                </h4>
                {company.corporateName && company.corporateName !== company.tradeName && (
                  <p className="text-[11px] text-stone-600 font-semibold">
                    Razão Social: {company.corporateName}
                  </p>
                )}
                <div className="text-[10px] text-stone-500 leading-relaxed mt-0.5">
                  {company.cnpjCpf && <span><strong>CNPJ:</strong> {company.cnpjCpf} </span>}
                  {company.stateRegistration && <span> | <strong>IE:</strong> {company.stateRegistration} </span>}
                  {company.phone && <span> | <strong>Tel:</strong> {company.phone}</span>}
                  {company.email && <div><strong>E-mail:</strong> {company.email}</div>}
                  {fullAddress && <div><strong>Endereço:</strong> {fullAddress}</div>}
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block bg-[#0963cb] text-white text-[10px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider">
                  {documentType}
                </span>
                <div className="text-[10px] text-stone-500 mt-1.5 space-y-0.5">
                  <div>Emissão: <strong>{dateFormatted} às {timeFormatted}</strong></div>
                  <div>Sistema: <strong>Silagem Fácil ERP</strong></div>
                </div>
              </div>
            </div>

            {/* Document Headline */}
            <div className="text-center py-2 px-3 bg-stone-50 border border-stone-200 rounded-md">
              <h2 className="text-sm font-black text-stone-900 uppercase tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11px] text-stone-500 mt-0.5">{subtitle}</p>
              )}
            </div>

            {/* Content rendered safely */}
            <div 
              className="text-stone-800 leading-normal"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />

            {/* Signature Area */}
            {showSignatures && (
              <div className="pt-6 flex justify-around gap-8 text-center text-[10px] text-stone-600 border-t border-stone-200 mt-6 page-break-inside-avoid break-inside-avoid">
                {signatureLabels.map((lbl, idx) => (
                  <div key={idx} className="flex-1 max-w-[260px] page-break-inside-avoid break-inside-avoid">
                    <div className="border-t-1.5 border-stone-800 mb-1.5 pt-1 font-bold text-stone-900">
                      {lbl}
                    </div>
                    <div className="text-[9px] text-stone-400">
                      {company.tradeName} • Data: ____/____/________
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-dashed border-stone-200 pt-2 flex items-center justify-between text-[9px] text-stone-400 page-break-inside-avoid break-inside-avoid">
              <span>Relatório gerado automaticamente por: Silagem Fácil ERP - Gestão Integrada de Silagem & Frotas Agrícolas</span>
              <span>Emissão: {dateFormatted} às {timeFormatted} • Página 1 de 1</span>
            </div>

          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-white dark:bg-stone-900 px-4 sm:px-5 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-1.5 text-xs text-stone-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Layout otimizado para impressão A4 e exportação em PDF.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setWhatsappMode('pdf');
                setIsWhatsAppModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs shadow-emerald-600/20 active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar por WhatsApp</span>
            </button>

            <button
              onClick={handleDownloadPdfOnly}
              disabled={isGeneratingPdf}
              className="px-3.5 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-rose-500" />}
              <span>Baixar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-700 dark:hover:bg-stone-600 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

      </div>

      {/* Enhanced WhatsApp Sending Modal (PDF vs Text Mode) */}
      {isWhatsAppModalOpen && (
        <div 
          className="fixed inset-0 z-[70] bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setIsWhatsAppModalOpen(false);
          }}
        >
          <div 
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-xs">
                  <MessageCircle className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-stone-100 font-['Outfit']">
                    Enviar para o WhatsApp
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Escolha como deseja enviar este documento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification alert */}
            {pdfSuccessMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-xl flex items-center space-x-2 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{pdfSuccessMessage}</span>
              </div>
            )}

            {/* Mode Selection Tabs (PDF vs Text) */}
            <div className="grid grid-cols-2 gap-2 bg-stone-100 dark:bg-stone-800/80 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setWhatsappMode('pdf')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition ${
                  whatsappMode === 'pdf'
                    ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-emerald-500/20'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <FileText className="w-4 h-4 text-rose-500" />
                <span>1. Enviar Arquivo PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setWhatsappMode('text')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition ${
                  whatsappMode === 'text'
                    ? 'bg-white dark:bg-stone-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-emerald-500/20'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <span>2. Enviar Mensagem de Texto</span>
              </button>
            </div>

            {/* MODE 1: PDF DOCUMENT ATTACHMENT */}
            {whatsappMode === 'pdf' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* PDF File Preview Card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-rose-50/70 via-stone-50 to-emerald-50/40 dark:from-stone-800/60 dark:to-stone-800/30 border border-stone-200 dark:border-stone-700 flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-xs">
                      <FileText className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                          PDF Oficial
                        </span>
                        <span className="text-[10px] text-stone-500 font-semibold">
                          A4 Alta Resolução
                        </span>
                      </div>
                      <h5 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate mt-1">
                        {title}
                      </h5>
                      <p className="text-[11px] text-stone-500 truncate font-mono">
                        {defaultPdfFilename}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadPdfOnly}
                    disabled={isGeneratingPdf}
                    title="Baixar arquivo PDF"
                    className="p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 text-stone-700 dark:text-stone-300 transition shrink-0"
                  >
                    {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> : <Download className="w-4 h-4 text-rose-500" />}
                  </button>
                </div>

                {/* How it works explanation */}
                <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 space-y-1.5 text-stone-700 dark:text-stone-300 text-xs leading-relaxed">
                  <div className="flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Ao clicar em "Enviar PDF no WhatsApp":</span>
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 text-[11px]">
                    1. O arquivo <strong>{defaultPdfFilename}</strong> é gerado e baixado automaticamente no seu dispositivo.
                  </p>
                  <p className="text-stone-600 dark:text-stone-300 text-[11px]">
                    2. O <strong>WhatsApp</strong> abre imediatamente na tela de contatos para você escolher quem vai receber e anexar o arquivo com 1 clique (📎 Documento).
                  </p>
                </div>

                {/* PDF Actions */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={handleDownloadPdfOnly}
                    disabled={isGeneratingPdf}
                    className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Apenas Baixar PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSharePdfToWhatsApp}
                    disabled={isGeneratingPdf}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/25 transition flex items-center space-x-2 active:scale-95 disabled:opacity-50"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando PDF...</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4" />
                        <span>Enviar PDF no WhatsApp</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* MODE 2: FORMATTED TEXT MESSAGE */}
            {whatsappMode === 'text' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Message Preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mensagem Formatada Pronta para Envio</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyWhatsAppText}
                      className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-3.5 bg-stone-50 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-800 dark:text-stone-200 font-mono whitespace-pre-wrap leading-relaxed">
                    {resolvedWhatsAppText}
                  </div>
                </div>

                {/* Text Actions */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setIsWhatsAppModalOpen(false)}
                    className="px-4 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSendWhatsAppDirectText}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/25 transition flex items-center space-x-1.5 active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar Texto no WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

