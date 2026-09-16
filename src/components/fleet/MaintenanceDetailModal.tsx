import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Printer, 
  Download,
  Wrench, 
  MapPin, 
  UserCheck, 
  Package, 
  FileText, 
  CreditCard, 
  DollarSign, 
  Clock, 
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Truck,
  Loader2
} from 'lucide-react';
import { MaintenanceLog, Machinery, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { PrintReportHeader } from '../common/PrintReportHeader';
import { PrintReportFooter } from '../common/PrintReportFooter';
import { generatePdfFromElement, downloadPdfBlob } from '../../lib/pdfGenerator';

interface MaintenanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: MaintenanceLog | null;
  machinery?: Machinery;
  companyProfile?: CompanyProfile;
}

export const MaintenanceDetailModal: React.FC<MaintenanceDetailModalProps> = ({
  isOpen,
  onClose,
  log,
  machinery,
  companyProfile,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !log || !mounted) return null;

  const handleExportPdf = async () => {
    const el = document.getElementById('printable-os');
    if (!el) return;
    setIsGeneratingPdf(true);
    try {
      const filename = `Ordem_Servico_${log.osNumber || log.id}.pdf`;
      const { blob } = await generatePdfFromElement(el, { 
        filename, 
        title: `Ordem de Serviço ${log.osNumber || log.id}`,
        singlePage: true 
      });
      downloadPdfBlob(blob, filename);
    } catch (e) {
      console.error('Erro ao gerar PDF da OS:', e);
      handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.add('printing-maintenance-os');

    const cleanUpPrint = () => {
      document.body.classList.remove('printing-maintenance-os');
      window.removeEventListener('afterprint', cleanUpPrint);
    };
    window.addEventListener('afterprint', cleanUpPrint);

    let nativeTriggered = false;
    try {
      window.focus();
      window.print();
      nativeTriggered = true;
    } catch (e) {
      console.warn('Impressão nativa direta bloqueada pelo navegador/iframe:', e);
    } finally {
      setTimeout(() => {
        cleanUpPrint();
      }, 3000);
    }

    if (!nativeTriggered) {
      try {
        const printContent = document.getElementById('printable-os');
        if (printContent) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Ordem de Serviço - ${log.osNumber || log.id}</title>
                  <style>
                    @page { size: A4 portrait; margin: 8mm; }
                    html, body { 
                      font-family: system-ui, -apple-system, sans-serif; 
                      color: #1c1917; 
                      background: #fff; 
                      margin: 0; 
                      padding: 0; 
                      -webkit-print-color-adjust: exact;
                      print-color-adjust: exact;
                    }
                    * { box-sizing: border-box; }
                    .print\\:hidden { display: none !important; }
                    #printable-os { 
                      display: block !important;
                      visibility: visible !important;
                      width: 100% !important; 
                      max-width: 100% !important; 
                      padding: 0 !important; 
                      margin: 0 !important; 
                      page-break-inside: avoid !important; 
                      break-inside: avoid !important; 
                      page-break-after: avoid !important; 
                      break-after: avoid !important; 
                    }
                  </style>
                  <link rel="stylesheet" href="/src/index.css" />
                </head>
                <body>
                  <div id="printable-os">
                    ${printContent.innerHTML}
                  </div>
                  <script>
                    window.onload = function() {
                      setTimeout(function() {
                        window.focus();
                        window.print();
                      }, 250);
                    };
                  </script>
                </body>
              </html>
            `);
            printWindow.document.close();
          }
        }
      } catch (err) {
        console.error('Falha no fallback de impressão:', err);
      }
    }
  };

  const getLocationBadge = (loc?: MaintenanceLog['location']) => {
    switch (loc) {
      case 'roca':
        return { label: 'Roça (Lavoura / Campo)', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300' };
      case 'estrada':
        return { label: 'Estrada (Socorro Rodoviário)', bg: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300' };
      case 'oficina_interna':
        return { label: 'Oficina Interna (Barracão)', bg: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300' };
      case 'oficina_externa':
        return { label: 'Oficina Externa / Concessionária', bg: 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300' };
      default:
        return { label: 'Oficina Interna', bg: 'bg-stone-100 text-stone-700 border-stone-300' };
    }
  };

  const getExecutorBadge = (type?: MaintenanceLog['executorType']) => {
    switch (type) {
      case 'equipe_propria':
        return 'Equipe Própria / Próprio Operador';
      case 'mecanico_interno':
        return 'Mecânico Interno da Empresa';
      case 'mecanico_campo':
        return 'Mecânico Terceiro em Campo (Socorro)';
      case 'mecanica_terceirizada':
        return 'Oficina Mecânica Terceirizada';
      default:
        return 'Mecânica Interna';
    }
  };

  const locBadge = getLocationBadge(log.location);

  return createPortal(
    <div 
      id="printable-os-overlay" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:!block print:!visible print:static print:w-full print:h-auto print:p-0 print:m-0 print:bg-white print:overflow-visible"
    >
      <div 
        id="printable-os-container"
        className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 print:!block print:!visible print:static print:w-full print:h-auto print:max-h-none print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:bg-white print:overflow-visible"
      >
        
        {/* Header - Não impresso */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0963cb] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                Ordem de Serviço: {log.osNumber || log.id}
              </h3>
              <p className="text-xs text-stone-500">
                Laudo Técnico & Detalhamento da Manutenção
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
              title="Exportar PDF em 1 Via Única A4"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#0963cb] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir OS</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo Imprimível / Visualizável */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-stone-900 dark:text-stone-100 print:!block print:!visible print:w-full print:p-0 print:space-y-3.5 print:overflow-visible print:break-inside-avoid print:page-break-inside-avoid print:page-break-after-avoid" id="printable-os">
          
          {/* Cabeçalho Corporativo Padronizado */}
          <PrintReportHeader
            companyProfile={companyProfile}
            reportTitle="ORDEM DE SERVIÇO DE MANUTENÇÃO"
            reportSubtitle={`Veículo: ${log.machineryPlateOrName} • Categoria: ${log.serviceCategory}`}
            documentTypeBadge={`O.S. Nº ${log.osNumber || log.id}`}
          />

          {/* Dados do Veículo & Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 dark:bg-stone-800/40 p-4 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
            <div>
              <span className="text-stone-400 text-[10px] uppercase font-bold block">Veículo / Máquina</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">{log.machineryPlateOrName}</span>
            </div>
            <div>
              <span className="text-stone-400 text-[10px] uppercase font-bold block">Tipo & Categoria</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">{log.type.toUpperCase()} • {log.serviceCategory}</span>
            </div>
            <div>
              <span className="text-stone-400 text-[10px] uppercase font-bold block">Horímetro / KM</span>
              <span className="font-bold text-stone-900 dark:text-stone-100">{log.currentHourMeterOrKm || '-'}</span>
            </div>
            <div>
              <span className="text-stone-400 text-[10px] uppercase font-bold block">Status Atual</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {log.status === 'concluida' ? '✓ Concluída' : log.status === 'em_andamento' ? '⏳ Em Andamento' : log.status === 'aguardando_pecas' ? '📦 Aguardando Peças' : log.status}
              </span>
            </div>
          </div>

          {/* Cenário Operacional: Local & Executante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 space-y-1 text-xs">
              <div className="flex items-center space-x-1.5 text-stone-500 font-bold uppercase text-[10px]">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Local da Manutenção</span>
              </div>
              <div className="pt-1">
                <span className={`inline-block px-2.5 py-1 rounded-md font-bold text-xs border ${locBadge.bg}`}>
                  {locBadge.label}
                </span>
                {log.locationDetails && (
                  <p className="text-stone-600 dark:text-stone-400 mt-1 font-medium italic">
                    Ref: {log.locationDetails}
                  </p>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 space-y-1 text-xs">
              <div className="flex items-center space-x-1.5 text-stone-500 font-bold uppercase text-[10px]">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Responsável pela Execução</span>
              </div>
              <div className="pt-1">
                <div className="font-bold text-stone-900 dark:text-stone-100">
                  {getExecutorBadge(log.executorType)}
                </div>
                <div className="text-stone-600 dark:text-stone-400 font-medium">
                  {log.workshopOrMechanic}
                </div>
              </div>
            </div>
          </div>

          {/* Descrição do Diagnóstico */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Diagnóstico / Descrição dos Serviços
            </h4>
            <div className="p-3.5 bg-stone-50 dark:bg-stone-800/30 rounded-xl border border-stone-200 dark:border-stone-800 text-xs leading-relaxed text-stone-800 dark:text-stone-200">
              {log.description}
            </div>
          </div>

          {/* Tabela de Peças & Insumos */}
          {log.partsItems && log.partsItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Peças & Insumos Aplicados
              </h4>
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Origem</th>
                      <th className="py-2 px-3">Descrição da Peça</th>
                      <th className="py-2 px-3 text-right">Qtd</th>
                      <th className="py-2 px-3 text-right">Unitário</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {log.partsItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3">
                          {item.origin === 'almoxarifado_interno' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">Almoxarifado</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Compra Ext.</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-stone-800 dark:text-stone-200">
                          {item.description}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrencyBRL(item.unitCost)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {formatCurrencyBRL(item.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dados Fiscais (NF-e) & Financeiros */}
          {(log.nfeLink || log.financialConditions) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {log.nfeLink && log.nfeLink.nfeNumber && (
                <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase block">Vínculo Fiscal (NF-e)</span>
                  <div className="font-mono font-bold text-stone-900 dark:text-stone-100">
                    Nota Nº: {log.nfeLink.nfeNumber} (Série {log.nfeLink.nfeSeries || '1'})
                  </div>
                  {log.nfeLink.nfeAccessKey && (
                    <div className="text-[10px] font-mono text-stone-500 break-all">
                      Chave: {log.nfeLink.nfeAccessKey}
                    </div>
                  )}
                  {log.nfeLink.supplierName && (
                    <div className="text-stone-600 dark:text-stone-400 font-medium text-[11px]">
                      Fornecedor: {log.nfeLink.supplierName}
                    </div>
                  )}
                </div>
              )}

              {log.financialConditions && (
                <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-800 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 uppercase block">Condição Financeira</span>
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">
                    Prazo: {log.financialConditions.paymentTerm.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div className="text-stone-600 dark:text-stone-400">
                    Forma: {log.financialConditions.paymentMethod.toUpperCase()} • 1º Venc: {formatDateBR(log.financialConditions.firstDueDate)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Totais */}
          <div className="flex justify-end pt-3 border-t border-stone-200 dark:border-stone-800">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>Subtotal Peças:</span>
                <span className="font-mono font-bold">{formatCurrencyBRL(log.partsCost)}</span>
              </div>
              <div className="flex justify-between text-stone-600 dark:text-stone-400">
                <span>Mão de Obra:</span>
                <span className="font-mono font-bold">{formatCurrencyBRL(log.laborCost)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-indigo-700 dark:text-indigo-400 pt-1 border-t border-stone-200 dark:border-stone-700">
                <span>Total Geral:</span>
                <span className="font-mono">{formatCurrencyBRL(log.totalCost)}</span>
              </div>
            </div>
          </div>

          {/* Rodapé Corporativo Padronizado com Assinaturas */}
          <PrintReportFooter
            showSignatures={true}
            signatureLabels={[
              `Mecânico / Prestador: ${log.workshopOrMechanic || 'Oficina'}`,
              'Motorista / Responsável pela Frota'
            ]}
            companyName={companyProfile?.tradeName || companyProfile?.companyName || 'Silagem Fácil ERP'}
            authCode={`OS-${(log.osNumber || log.id).toString().replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`}
          />

        </div>

      </div>
    </div>,
    document.body
  );
};
