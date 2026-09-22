import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Printer, 
  Download, 
  Calendar, 
  Clock, 
  Truck, 
  User, 
  MapPin, 
  AlertCircle,
  Scissors,
  CheckCircle2,
  Phone
} from 'lucide-react';
import { ServiceAppointment, CompanyProfile } from '../../types';
import { formatDateBR } from '../../lib/storage';
import { PrintReportHeader } from '../common/PrintReportHeader';
import { PrintReportFooter } from '../common/PrintReportFooter';

interface PrintFieldOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: ServiceAppointment | null;
  companyProfile?: CompanyProfile;
}

export const PrintFieldOrderModal: React.FC<PrintFieldOrderModalProps> = ({
  isOpen,
  onClose,
  appointment,
  companyProfile,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !appointment || !mounted) return null;

  const handlePrint = () => {
    document.body.classList.add('printing-field-order');

    const cleanUpPrint = () => {
      document.body.classList.remove('printing-field-order');
      window.removeEventListener('afterprint', cleanUpPrint);
    };
    window.addEventListener('afterprint', cleanUpPrint);

    let nativeTriggered = false;
    try {
      window.focus();
      window.print();
      nativeTriggered = true;
    } catch (e) {
      console.warn('Impressão nativa bloqueada:', e);
    } finally {
      setTimeout(() => {
        cleanUpPrint();
      }, 3000);
    }

    if (!nativeTriggered) {
      const printContent = document.getElementById('printable-field-order');
      if (printContent) {
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
              <head>
                <meta charset="UTF-8" />
                <title>Ordem de Campo - ${appointment.appointmentNumber}</title>
                <style>
                  @page { size: A4 portrait; margin: 8mm; }
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #1c1917; background: #fff; }
                  * { box-sizing: border-box; }
                  .print\\:hidden { display: none !important; }
                  #printable-field-order { width: 100% !important; max-width: 100% !important; padding: 0 !important; display: block !important; }
                  table { border-collapse: collapse; width: 100%; }
                  th, td { border: 1px solid #d6d3d1; padding: 4px 6px; font-size: 11px; }
                </style>
                <link rel="stylesheet" href="/src/index.css" />
              </head>
              <body>
                <div id="printable-field-order">
                  ${printContent.innerHTML}
                </div>
                <script>
                  window.onload = function() {
                    setTimeout(function() {
                      window.focus();
                      window.print();
                      window.close();
                    }, 400);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    }
  };

  const handleExportPdf = async () => {
    const el = document.getElementById('printable-field-order');
    if (!el) {
      handlePrint();
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Ordem_Campo_${appointment.appointmentNumber}_${appointment.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.warn('Exportação em PDF fallback para print:', err);
      handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatMinToHoursText = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  return createPortal(
    <div 
      id="printable-field-order-overlay" 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:!block print:!visible print:static print:w-full print:h-auto print:p-0 print:m-0 print:bg-white print:overflow-visible"
    >
      <div 
        id="printable-field-order-container"
        className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 print:!block print:!visible print:static print:w-full print:h-auto print:max-h-none print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:bg-white print:overflow-visible"
      >
        {/* Barra de Ações Superior (Não impressa) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 rounded-t-2xl print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <span>Ordem de Campo da Agenda</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                  {appointment.appointmentNumber}
                </span>
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Via única A4 para escala de equipe, roteiro logístico e frotas em campo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-700 dark:text-stone-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>{isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Ordem de Campo (A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Folha de Impressão A4 de Via Única */}
        <div 
          id="printable-field-order"
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 text-stone-900 dark:text-stone-100 print:!block print:!visible print:w-full print:p-0 print:space-y-3 print:overflow-visible print:break-inside-avoid print:page-break-inside-avoid text-xs leading-tight"
        >
          {/* Cabeçalho Corporativo Padronizado */}
          <PrintReportHeader
            companyProfile={companyProfile}
            reportTitle="ORDEM DE CAMPO & LOGÍSTICA DE ENSILAGEM"
            reportSubtitle={`ESCALA OPERACIONAL DE FROTAS E EQUIPES — VIA ÚNICA DE CAMPO • ${appointment.appointmentNumber}`}
            documentTypeBadge="ORDEM DE CAMPO"
            className="mb-3"
          />

          {/* 1. Bloco de Dados do Cliente e Operação */}
          <div className="border border-stone-300 rounded-lg p-3 bg-stone-50/50 print:bg-white">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Produtor / Cliente</span>
                <span className="text-xs font-extrabold text-stone-900">{appointment.clientName}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Fazenda / Propriedade</span>
                <span className="text-xs font-semibold text-stone-800">{appointment.farmName || 'Não especificada'}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Município / Região</span>
                <span className="text-xs font-semibold text-stone-800">{appointment.locationCityState || 'Local de operação'}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Contato / WhatsApp</span>
                <span className="text-xs font-semibold text-stone-800">{appointment.contactPhone || '—'}</span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-stone-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Tipo de Serviço</span>
                <span className="text-xs font-bold text-emerald-800 print:text-black">{appointment.serviceType}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Data Prevista</span>
                <span className="text-xs font-bold text-stone-900">{formatDateBR(appointment.startDate)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Saída da Base (Início)</span>
                <span className="text-xs font-bold text-stone-900">{appointment.startTime}h</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-bold text-stone-500">Status Operacional</span>
                <span className="inline-block uppercase font-black text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {appointment.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Bloco do Cronograma e Cálculo de Tempos */}
          <div className="border border-stone-300 rounded-lg p-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-800 mb-2 border-b border-stone-200 pb-1 flex items-center justify-between">
              <span>1. Cronograma Logístico e Estimativa de Execução</span>
              <span className="text-[10px] font-bold text-stone-500">Cálculo de Deslocamento + Prancha + Produção</span>
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                <span className="block text-[9px] uppercase font-bold text-stone-500">Deslocamento</span>
                <span className="text-xs font-black text-stone-900">{formatMinToHoursText(appointment.travelTimeMinutes)}</span>
              </div>
              <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                <span className="block text-[9px] uppercase font-bold text-stone-500">Tempo Prancha</span>
                <span className="text-xs font-black text-stone-900">{formatMinToHoursText(appointment.trailerLoadingTimeMinutes)}</span>
              </div>
              <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                <span className="block text-[9px] uppercase font-bold text-stone-500">Qtd. Estimada</span>
                <span className="text-xs font-black text-stone-900">
                  {appointment.estimatedQuantity} {appointment.areaUnit === 'hectares' ? 'ha' : appointment.areaUnit === 'alqueires' ? 'alq' : 'horas'}
                </span>
              </div>
              <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                <span className="block text-[9px] uppercase font-bold text-stone-500">Rendimento</span>
                <span className="text-xs font-black text-stone-900">
                  {appointment.productivityRatePerHour} {appointment.areaUnit === 'hectares' ? 'ha/h' : appointment.areaUnit === 'alqueires' ? 'alq/h' : 'h/h'}
                </span>
              </div>
              <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                <span className="block text-[9px] uppercase font-bold text-stone-500">Tempo Corte</span>
                <span className="text-xs font-black text-stone-900">{formatMinToHoursText(appointment.executionTimeMinutes)}</span>
              </div>
              <div className="bg-emerald-50 print:bg-stone-100 p-1.5 rounded border border-emerald-300 print:border-stone-400">
                <span className="block text-[9px] uppercase font-black text-emerald-900 print:text-black">Tempo Total</span>
                <span className="text-xs font-black text-emerald-900 print:text-black">{formatMinToHoursText(appointment.totalTimeMinutes)}</span>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-stone-700 flex items-center justify-between bg-stone-100/70 p-2 rounded">
              <div>
                <strong>Início Previsto no Campo:</strong> {formatDateBR(appointment.startDate)} às {appointment.startTime}h
              </div>
              <div>
                <strong>Término Estimado:</strong> {formatDateBR(appointment.endDate)} às {appointment.endTime}h
              </div>
            </div>
          </div>

          {/* 3. Escala de Maquinários e Frotas (Rastreados por Prefixo e Placa) */}
          <div className="border border-stone-300 rounded-lg p-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-800 mb-2 border-b border-stone-200 pb-1 flex items-center justify-between">
              <span>2. Escala de Maquinários & Frotas (Prefixos e Placas Oficiais)</span>
              <span className="text-[10px] font-bold text-stone-500">Rastreamento Individual sem Sobreposição</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-700 text-[10px] uppercase font-bold">
                    <th className="p-1.5 border border-stone-300">Prefixo / Identificação</th>
                    <th className="p-1.5 border border-stone-300">Placa / Nº Série</th>
                    <th className="p-1.5 border border-stone-300">Função Operacional</th>
                    <th className="p-1.5 border border-stone-300">Modelo / Veículo</th>
                    <th className="p-1.5 border border-stone-300">Operador / Motorista Escalado</th>
                  </tr>
                </thead>
                <tbody className="text-[11px]">
                  {/* Veículo Principal (Forrageira / Trator) */}
                  {appointment.primaryMachineryPrefix && (
                    <tr className="bg-emerald-50/50 print:bg-white font-semibold">
                      <td className="p-1.5 border border-stone-300 font-extrabold text-emerald-950 print:text-black">
                        {appointment.primaryMachineryPrefix}
                      </td>
                      <td className="p-1.5 border border-stone-300 font-mono font-bold">
                        {appointment.primaryMachineryPlate || 'Série Oficial'}
                      </td>
                      <td className="p-1.5 border border-stone-300 uppercase text-[10px] font-bold text-emerald-800 print:text-black">
                        Máquina Principal (Ensiladeira / Forrageira)
                      </td>
                      <td className="p-1.5 border border-stone-300">
                        {appointment.primaryMachineryModel || 'Forrageira'}
                      </td>
                      <td className="p-1.5 border border-stone-300 font-bold">
                        {appointment.assignedTeam.find(t => t.role.toLowerCase().includes('forrageira') || t.role.toLowerCase().includes('principal'))?.employeeName || 'A definir'}
                      </td>
                    </tr>
                  )}

                  {/* Demais Veículos Escalados (Caminhões, Tratores, Pranchas) */}
                  {appointment.assignedVehicles && appointment.assignedVehicles.length > 0 ? (
                    appointment.assignedVehicles.map((v, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}>
                        <td className="p-1.5 border border-stone-300 font-extrabold text-stone-900">
                          {v.prefix || `Veículo ${idx + 1}`}
                        </td>
                        <td className="p-1.5 border border-stone-300 font-mono font-bold text-stone-800">
                          {v.plateOrSerial || '—'}
                        </td>
                        <td className="p-1.5 border border-stone-300 uppercase text-[10px] text-stone-600 font-semibold">
                          {v.category === 'caminhao' ? 'Caminhão de Apoio / Silagem' : v.category === 'trator' ? 'Trator Compactador' : v.category}
                        </td>
                        <td className="p-1.5 border border-stone-300 text-stone-800">
                          {v.model || '—'}
                        </td>
                        <td className="p-1.5 border border-stone-300 font-semibold text-stone-900">
                          {v.driverOrOperatorName || 'A definir'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    !appointment.primaryMachineryPrefix && (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-stone-500 italic border border-stone-300">
                          Nenhum veículo escalado nesta ordem de campo.
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Escala de Pessoal e Equipe de Campo */}
          <div className="border border-stone-300 rounded-lg p-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-800 mb-2 border-b border-stone-200 pb-1 flex items-center justify-between">
              <span>3. Escala da Equipe Operacional de Campo</span>
              <span className="text-[10px] font-bold text-stone-500">Membros e Responsabilidades</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {appointment.assignedTeam && appointment.assignedTeam.length > 0 ? (
                appointment.assignedTeam.map((member, idx) => (
                  <div key={idx} className="p-1.5 bg-stone-50 border border-stone-200 rounded">
                    <span className="block text-[9px] uppercase font-bold text-stone-500">{member.role}</span>
                    <span className="text-xs font-bold text-stone-900 block truncate">{member.employeeName}</span>
                    {member.assignedVehiclePrefix && (
                      <span className="text-[10px] text-emerald-800 print:text-black font-semibold">
                        Vínculo: {member.assignedVehiclePrefix}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-4 text-stone-500 italic text-center p-1">
                  Equipe operacional direta vinculada aos condutores e operadores da tabela acima.
                </div>
              )}
            </div>
          </div>

          {/* 5. Observações de Campo & Checklist Técnico */}
          <div className="border border-stone-300 rounded-lg p-3">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-800 mb-1.5 border-b border-stone-200 pb-1">
              4. Recomendações e Instruções Operacionais de Silagem
            </h3>
            <p className="text-[11px] text-stone-700 italic mb-2">
              {appointment.fieldNotes || 'Operação de corte de alta precisão. Regular tamanho de picado entre 8 a 12mm com quebra uniforme de grãos (KPS). Garantir compactação contínua na trincheira com trator pesado durante todo o transbordo.'}
            </p>

            <div className="grid grid-cols-3 gap-2 text-[10px] text-stone-800 font-semibold border-t border-stone-200 pt-2">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 border border-stone-400 inline-block rounded-xs"></span>
                <span>Ponto de Corte & Matéria Seca Aferido</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 border border-stone-400 inline-block rounded-xs"></span>
                <span>Compactador em Operação Contínua</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 border border-stone-400 inline-block rounded-xs"></span>
                <span>Inoculante Bacteriano Aplicado</span>
              </div>
            </div>
          </div>

          {/* 6. Assinaturas e Termo de Ciência */}
          <div className="pt-2">
            <div className="grid grid-cols-2 gap-8 text-center text-[10px] mt-4">
              <div>
                <div className="border-b border-stone-400 pb-1 mb-1"></div>
                <span className="font-bold text-stone-900 block">Encarregado / Líder de Campo</span>
                <span className="text-stone-500">{companyProfile?.tradeName || companyProfile?.corporateName || 'Equipe de Operações'}</span>
              </div>
              <div>
                <div className="border-b border-stone-400 pb-1 mb-1"></div>
                <span className="font-bold text-stone-900 block">Produtor Rural / Responsável da Fazenda</span>
                <span className="text-stone-500">{appointment.clientName}</span>
              </div>
            </div>
          </div>

          {/* Rodapé Corporativo Padronizado */}
          <PrintReportFooter
            customInstitutionalText="Documento operacional gerado automaticamente pelo Módulo de Agenda de Serviços — Silagem Fácil ERP."
            pageText="Via Única de Campo • 1 de 1"
            authCode={appointment.appointmentNumber}
            className="mt-3 pt-2 text-[10px]"
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
