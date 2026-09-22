import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Printer, 
  Receipt, 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle, 
  Truck, 
  Tractor, 
  Scissors, 
  User, 
  Calendar, 
  X,
  Lock,
  Users,
  Fuel,
  UtensilsCrossed
} from 'lucide-react';
import { formatCurrencyBRL, formatDateBR, getStoredCompanyProfile } from '../../lib/storage';
import { parseCurrencyToFloat } from '../../lib/formatters';
import { ServiceTruckItem, CompanyProfile, ServiceFuelEntry, ServiceMealExpense } from '../../types';
import { TruckExpenseDetail } from './DRESummaryBlock';

export type PrintContentType = 'client' | 'full';
export type PrintPaperFormat = 'thermal_80mm' | 'a4';

export interface ServiceDocumentPreviewProps {
  initialContentType?: PrintContentType;
  initialPaperFormat?: PrintPaperFormat;
  companyProfile?: CompanyProfile;
  onClose: () => void;

  // Identificação Geral
  orderNumber?: string;
  serviceTypeTitle: string;
  serviceTab?: string;
  clientName: string;
  clientPhone: string;
  farmName: string;
  location: string;
  serviceDate: string;
  operatorName: string;
  tractorOperatorName: string;

  // Operacional Área / Forrageira
  unidadeArea: 'hectares' | 'alqueires' | 'hora';
  unidadeAreaLabel: string;
  quantidadeArea: number | '';
  valorBaseArea: number;
  valorHectare: number | '';
  horasTambor: number | '';
  horasMotor: number | '';
  forageHarvesterName?: string;

  // Operacional Trator
  tractorName?: string;
  tractorHours: number | '';
  subtotalTrator: number;
  qtdCobrancaTrator: number | '';
  modoCobrancaTratorLabel: string;

  // Frota de Caminhões
  trucks: ServiceTruckItem[];
  totalAdicionalKm: number;
  totalFrotasPorHora?: number;

  // Resumo Financeiro Pedido
  fretePrancha?: number | string | '';
  totalPedido: number;

  // Custos Operacionais (Combustível & Alimentação)
  fuelEntries?: ServiceFuelEntry[];
  totalCombustivelGeral?: number;
  mealExpenses?: ServiceMealExpense[];
  totalAlimentacaoGeral?: number;

  // DRE Gerencial (Exclusivo Modo Full)
  operadorForrageiraNome: string;
  comissaoForrageiraP1: number;
  segundoOperadorForrageiraNome: string;
  comissaoForrageiraP2: number;

  operadorTratorNome: string;
  comissaoTratorP1: number;
  segundoOperadorTratorNome: string;
  comissaoTratorP2: number;

  brokerName?: string;
  brokerCommissionAmount?: number;

  trucksExpenseDetails: TruckExpenseDetail[];
  totalGeralDespesas: number;
  lucroEstimado: number;
  margemLucroPercent: number;

  // Observações
  observacoes: string;
}

export const ServiceDocumentPreview: React.FC<ServiceDocumentPreviewProps> = ({
  initialContentType = 'client',
  initialPaperFormat = 'thermal_80mm',
  companyProfile,
  onClose,
  orderNumber,
  serviceTypeTitle,
  serviceTab,
  clientName,
  clientPhone,
  farmName,
  location,
  serviceDate,
  operatorName,
  tractorOperatorName,
  unidadeArea,
  unidadeAreaLabel,
  quantidadeArea,
  valorBaseArea,
  valorHectare,
  horasTambor,
  horasMotor,
  forageHarvesterName,
  tractorName,
  tractorHours,
  subtotalTrator,
  qtdCobrancaTrator,
  modoCobrancaTratorLabel,
  trucks,
  totalAdicionalKm,
  totalFrotasPorHora = 0,
  fretePrancha,
  totalPedido,
  fuelEntries,
  totalCombustivelGeral,
  mealExpenses,
  totalAlimentacaoGeral,
  operadorForrageiraNome,
  comissaoForrageiraP1,
  segundoOperadorForrageiraNome,
  comissaoForrageiraP2,
  operadorTratorNome,
  comissaoTratorP1,
  segundoOperadorTratorNome,
  comissaoTratorP2,
  brokerName,
  brokerCommissionAmount = 0,
  trucksExpenseDetails,
  totalGeralDespesas,
  lucroEstimado,
  margemLucroPercent,
  observacoes,
}) => {
  const [contentType, setContentType] = useState<PrintContentType>(initialContentType);
  const [paperFormat, setPaperFormat] = useState<PrintPaperFormat>(initialPaperFormat);

  // Título dinâmico por modalidade conforme a aba ativa
  const operationalSpecsTitle = useMemo(() => {
    const tab = (serviceTab || '').toLowerCase();
    const title = (serviceTypeTitle || '').toLowerCase();
    if (tab === 'corte' || title.includes('corte')) {
      return 'ESPECIFICAÇÕES OPERACIONAIS DO CORTE';
    }
    if (tab === 'colheita' || title.includes('colheita')) {
      return 'ESPECIFICAÇÕES OPERACIONAIS DA COLHEITA';
    }
    if (tab === 'trator' || title.includes('trator')) {
      return 'ESPECIFICAÇÕES OPERACIONAIS DO SERVIÇO DE TRATOR';
    }
    if (tab === 'maquina' || title.includes('máquina') || title.includes('maquina')) {
      return 'ESPECIFICAÇÕES OPERACIONAIS DO SERVIÇO DE MÁQUINA';
    }
    if (tab === 'orcamento' || title.includes('orçamento') || title.includes('orcamento')) {
      return 'ESPECIFICAÇÕES OPERACIONAIS DO ORÇAMENTO';
    }
    if (tab === 'venda' || title.includes('venda')) {
      return 'ESPECIFICAÇÕES OPERACIONAIS DA VENDA';
    }
    return 'ESPECIFICAÇÕES OPERACIONAIS DO CORTE';
  }, [serviceTab, serviceTypeTitle]);

  // Perfil da empresa prestadora (via props ou armazenamento local sincronizado)
  const company = useMemo(() => companyProfile || getStoredCompanyProfile(), [companyProfile]);

  // Formatação completa do endereço da empresa
  const fullCompanyAddress = useMemo(() => {
    const parts = [
      company.address ? `${company.address}${company.number ? `, nº ${company.number}` : ''}` : '',
      company.neighborhood ? `Bairro ${company.neighborhood}` : '',
      company.city ? `${company.city}${company.state ? `/${company.state}` : ''}` : (company.state || ''),
      company.zipCode ? `CEP: ${company.zipCode}` : '',
    ].filter(Boolean);
    return parts.join(' - ');
  }, [company.address, company.number, company.neighborhood, company.city, company.state, company.zipCode]);

  const displayOrderNumber = orderNumber || `#${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  // =========================================================================
  // CÁLCULOS MATEMÁTICOS DE TOTAIS E CUSTOS DE TRANSPORTE
  // =========================================================================
  // 1. Totais acumulados da frota de caminhões (para rodapé da tabela e cabeçalhos)
  const totalCargasViagens = useMemo(() => {
    return trucks.reduce((sum, t) => sum + (Number(t.tripLoads) || 0), 0);
  }, [trucks]);

  const totalVolumeTransportadoM3 = useMemo(() => {
    return trucks.reduce((sum, t) => {
      const vol = typeof t.totalM3 === 'number' && t.totalM3 > 0 
        ? t.totalM3 
        : (Number(t.capacityM3) || 0) * (Number(t.tripLoads) || 0);
      return sum + vol;
    }, 0);
  }, [trucks]);

  const totalKmAdicionalSoma = useMemo(() => {
    return trucks.reduce((sum, t) => sum + (Number(t.additionalKm) || 0), 0);
  }, [trucks]);

  const totalKmAdicionalValor = useMemo(() => {
    return trucks.reduce((sum, t) => sum + (Number(t.totalAdditionalKm) || 0), 0);
  }, [trucks]);

  const totalTransporteHoras = useMemo(() => {
    if (typeof totalFrotasPorHora === 'number' && totalFrotasPorHora > 0) return totalFrotasPorHora;
    return trucks.reduce((sum, t) => {
      const h = typeof t.truckHours === 'number' ? t.truckHours : 0;
      const rate = typeof t.truckHourlyRate === 'number' ? t.truckHourlyRate : 0;
      return sum + (h * rate);
    }, 0);
  }, [trucks, totalFrotasPorHora]);

  // 2. Subtotais para discriminação detalhada no DRE Gerencial
  const subtotalTransporteFrotas = useMemo(() => {
    return trucksExpenseDetails.reduce((sum, t) => sum + (t.rateioCost + t.additionalKmCost), 0);
  }, [trucksExpenseDetails]);

  const subtotalComissoesMotoristas = useMemo(() => {
    return trucksExpenseDetails.reduce((sum, t) => sum + (t.driverCommissionCost || 0), 0);
  }, [trucksExpenseDetails]);

  // 3. Valor numérico padronizado do Frete Prancha para exibição em A4 e Cupom 80mm
  const numFretePrancha = useMemo(() => {
    if (typeof fretePrancha === 'number') return isNaN(fretePrancha) ? 0 : fretePrancha;
    if (typeof fretePrancha === 'string') return parseCurrencyToFloat(fretePrancha);
    return 0;
  }, [fretePrancha]);

  // Disparo da impressão isolada em nova janela (Blob URL / window.open) para contornar sandboxing do iframe
  const handlePrint = () => {
    const printableElement = document.getElementById('printable-document-content');
    if (!printableElement) {
      window.print();
      return;
    }

    const isThermal = paperFormat === 'thermal_80mm';
    const isClient = contentType === 'client';

    // Extrai estilos injetados pelo Vite/Tailwind da página atual
    const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    const styles = `
      @page {
        size: ${isThermal ? '80mm auto' : 'A4 portrait'};
        margin: ${isThermal ? '0' : '3mm 5mm'};
      }

      /* RESET E PRESERVAÇÃO RIGOROSA DE CORES E BACKGROUNDS (REQUISITO 2) */
      *, *::before, *::after {
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #ffffff !important;
        color: #0f172a !important;
        font-family: ${isThermal ? "'Courier New', Courier, monospace, monospace" : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"} !important;
        font-size: ${isThermal ? '10px' : '9.5px'} !important;
        line-height: ${isThermal ? '1.25' : '1.18'} !important;
        -webkit-font-smoothing: antialiased;
      }

      /* REGRAS BÁSICAS DE DISPLAY E LAYOUT */
      .block { display: block !important; }
      .inline-block { display: inline-block !important; }
      .inline { display: inline !important; }
      .flex { display: flex !important; }
      .inline-flex { display: inline-flex !important; }
      .flex-col { flex-direction: column !important; }
      .flex-row { flex-direction: row !important; }
      .flex-wrap { flex-wrap: wrap !important; }
      .items-center { align-items: center !important; }
      .items-start { align-items: flex-start !important; }
      .items-baseline { align-items: baseline !important; }
      .justify-between { justify-content: space-between !important; }
      .justify-center { justify-content: center !important; }
      .justify-start { justify-content: flex-start !important; }
      .justify-end { justify-content: flex-end !important; }
      .shrink-0 { flex-shrink: 0 !important; }

      /* GRID SYSTEM ROBUSTO (REQUISITO 1 & REQUISITO 3) */
      .grid { display: grid !important; }
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
      .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
      .gap-1 { gap: 4px !important; }
      .gap-1\\.5 { gap: 6px !important; }
      .gap-2 { gap: 8px !important; }
      .gap-3 { gap: 12px !important; }
      .gap-4 { gap: 16px !important; }
      .gap-6 { gap: 24px !important; }
      .gap-x-2 { column-gap: 8px !important; }
      .gap-y-0\\.5 { row-gap: 2px !important; }

      /* LOGO & DIMENSÕES DO CABEÇALHO */
      .w-14 { width: 56px !important; }
      .h-14 { height: 56px !important; }
      .min-w-\\[56px\\] { min-width: 56px !important; }
      .max-w-\\[56px\\] { max-width: 56px !important; }
      .w-12 { width: 48px !important; }
      .h-12 { height: 48px !important; }
      .min-w-\\[170px\\] { min-width: 170px !important; }
      .object-contain { object-fit: contain !important; }
      .max-w-full { max-width: 100% !important; }
      .max-h-full { max-height: 100% !important; }

      /* ESPAÇAMENTO VERTICAL SPACE-Y */
      .space-y-0\\.5 > * + * { margin-top: 2px !important; }
      .space-y-1 > * + * { margin-top: 4px !important; }
      .space-y-1\\.5 > * + * { margin-top: 6px !important; }
      .space-y-2 > * + * { margin-top: 8px !important; }
      .space-y-2\\.5 > * + * { margin-top: 10px !important; }
      .space-y-3 > * + * { margin-top: 12px !important; }

      /* PREVENÇÃO DEFINITIVA DE AGLOMERAÇÃO DE TEXTO (REQUISITO 1) */
      .grid > div {
        display: flex !important;
        flex-direction: column !important;
        justify-content: flex-start !important;
        min-width: 0 !important;
      }
      .grid > div > span:first-child,
      .text-slate-500.uppercase.block,
      span.uppercase.block {
        display: block !important;
        margin-bottom: 2px !important;
        line-height: 1.2 !important;
        white-space: normal !important;
      }
      .grid > div > span:last-child,
      .grid > div > strong:last-child {
        display: block !important;
        line-height: 1.25 !important;
      }
      .truncate {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      /* BOXES DA SEÇÃO 3: RESULTADO FINAL DA OPERAÇÃO */
      .bg-emerald-950\\/40,
      .bg-emerald-700\\/60 {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 6px 4px !important;
        text-align: center !important;
      }
      .bg-emerald-950\\/40 span,
      .bg-emerald-700\\/60 span {
        display: block !important;
        margin-bottom: 2px !important;
      }
      .bg-emerald-950\\/40 strong,
      .bg-emerald-700\\/60 strong {
        display: block !important;
      }

      /* PRESERVAÇÃO DE CORES VIBRANTES E BACKGROUNDS (REQUISITO 2) */
      /* Seção 3 - Resultado Final (Verde Esmeralda Vibrante) */
      .bg-gradient-to-br,
      .from-emerald-800,
      .to-emerald-900 {
        background-color: #064e3b !important;
        background-image: linear-gradient(135deg, #065f46 0%, #064e3b 100%) !important;
        color: #ffffff !important;
      }
      .bg-emerald-950\\/40 {
        background-color: #022c22 !important;
        border: 1px solid rgba(16, 185, 129, 0.3) !important;
        color: #ffffff !important;
      }
      .bg-emerald-700\\/60 {
        background-color: #047857 !important;
        border: 1px solid #10b981 !important;
        color: #ffffff !important;
      }
      .bg-emerald-700\\/50 {
        background-color: #047857 !important;
        color: #ffffff !important;
      }
      .bg-emerald-50, .bg-emerald-50\\/40 {
        background-color: #f0fdf4 !important;
      }
      .bg-emerald-100 {
        background-color: #dcfce7 !important;
      }
      .text-emerald-100 { color: #d1fae5 !important; }
      .text-emerald-200 { color: #a7f3d0 !important; }
      .text-emerald-300 { color: #6ee7b7 !important; }
      .text-emerald-600 { color: #059669 !important; }
      .text-emerald-700 { color: #047857 !important; }
      .text-emerald-800 { color: #065f46 !important; }
      .text-emerald-900 { color: #064e3b !important; }
      .text-emerald-950 { color: #022c22 !important; }
      .border-emerald-100 { border-color: #d1fae5 !important; }
      .border-emerald-200 { border-color: #a7f3d0 !important; }
      .border-emerald-300 { border-color: #86efac !important; }
      .border-emerald-500\\/40 { border-color: rgba(16, 185, 129, 0.4) !important; }
      .border-l-emerald-600 {
        border-left-width: 4px !important;
        border-left-style: solid !important;
        border-left-color: #059669 !important;
      }

      /* Seção 2 - DRE Gerencial & Custos (Laranja) e Barras de Progresso */
      .bg-orange-50, .bg-orange-50\\/40 {
        background-color: #fff7ed !important;
      }
      .bg-orange-100 {
        background-color: #ffedd5 !important;
      }
      .bg-orange-500 {
        background-color: #ea580c !important;
      }
      .bg-orange-600 {
        background-color: #c2410c !important;
      }
      .border-orange-200 { border-color: #fed7aa !important; }
      .border-orange-300 { border-color: #fdba74 !important; }
      .border-l-orange-600 {
        border-left-width: 4px !important;
        border-left-style: solid !important;
        border-left-color: #ea580c !important;
      }
      .text-orange-600 { color: #ea580c !important; }
      .text-orange-700 { color: #c2410c !important; }
      .text-orange-800 { color: #9a3412 !important; }
      .text-orange-900 { color: #7c2d12 !important; }
      .text-orange-950 { color: #431407 !important; }

      /* Barras de progresso e badges adicionais */
      .bg-amber-50 { background-color: #fffbeb !important; }
      .border-amber-200 { border-color: #fde68a !important; }
      .text-amber-300 { color: #fcd34d !important; }
      .text-amber-800 { color: #92400e !important; }
      .bg-indigo-100 { background-color: #e0e7ff !important; }
      .text-indigo-900 { color: #312e81 !important; }
      .border-indigo-300 { border-color: #a5b4fc !important; }

      /* Tons Neutros e Textos */
      .bg-slate-50 { background-color: #f8fafc !important; }
      .bg-slate-100 { background-color: #f1f5f9 !important; }
      .bg-white { background-color: #ffffff !important; }
      .text-white { color: #ffffff !important; }
      .text-slate-400 { color: #94a3b8 !important; }
      .text-slate-500 { color: #64748b !important; }
      .text-slate-600 { color: #475569 !important; }
      .text-slate-700 { color: #334155 !important; }
      .text-slate-800 { color: #1e293b !important; }
      .text-slate-900 { color: #0f172a !important; }
      .border-slate-100 { border-color: #f1f5f9 !important; }
      .border-slate-200 { border-color: #e2e8f0 !important; }
      .border-slate-300 { border-color: #cbd5e1 !important; }
      .border-slate-400 { border-color: #94a3b8 !important; }
      .border-slate-900 { border-color: #0f172a !important; }
      .border { border-width: 1px !important; border-style: solid !important; }
      .border-t { border-top-width: 1px !important; border-top-style: solid !important; }
      .border-b { border-bottom-width: 1px !important; border-bottom-style: solid !important; }
      .border-b-2 { border-bottom-width: 2px !important; border-bottom-style: solid !important; }
      .border-t-2 { border-top-width: 2px !important; border-top-style: solid !important; }
      .rounded { border-radius: 4px !important; }
      .rounded-lg { border-radius: 8px !important; }
      .rounded-full { border-radius: 9999px !important; }
      .h-1\\.5 { height: 6px !important; }
      .w-10 { width: 40px !important; }
      .w-full { width: 100% !important; }
      .overflow-hidden { overflow: hidden !important; }

      /* ALINHAMENTO LADO A LADO DAS ASSINATURAS E TABELAS (REQUISITO 3) */
      .a4-sheet .grid.grid-cols-2 {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 24px !important;
        width: 100% !important;
      }
      .a4-sheet .grid.grid-cols-2 > div {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        text-align: center !important;
        width: 100% !important;
      }
      .a4-sheet .grid.grid-cols-2 > div .border-b {
        width: 75% !important;
        margin: 0 auto 6px auto !important;
        border-bottom: 1px solid #475569 !important;
      }

      /* Tabelas alinhadas com cabeçalho e rodapé destacados */
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        table-layout: auto !important;
      }
      th, td {
        padding: 3px 6px !important;
        vertical-align: middle !important;
      }
      table thead tr {
        background-color: #f1f5f9 !important;
        border-bottom: 1px solid #cbd5e1 !important;
      }
      table tbody tr {
        border-bottom: 1px solid #f1f5f9 !important;
      }
      table tfoot tr {
        background-color: #f1f5f9 !important;
        border-top: 2px solid #94a3b8 !important;
      }
      .text-left { text-align: left !important; }
      .text-center { text-align: center !important; }
      .text-right { text-align: right !important; }
      .font-semibold { font-weight: 600 !important; }
      .font-bold { font-weight: 700 !important; }
      .font-extrabold { font-weight: 800 !important; }
      .font-black { font-weight: 900 !important; }
      .uppercase { text-transform: uppercase !important; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }

      /* DIVISORES E NEGRITOS NO FORMATO 80MM (REQUISITO 4) */
      .border-dashed { border-style: dashed !important; }
      .border-dotted { border-style: dotted !important; }
      .border-gray-300 { border-color: #d1d5db !important; }
      .border-gray-400 { border-color: #9ca3af !important; }
      .border-gray-600 { border-color: #4b5563 !important; }
      .border-gray-700 { border-color: #374151 !important; }
      .border-gray-800 { border-color: #1f2937 !important; }
      .border-black { border-color: #000000 !important; }

      .border-b-2.border-dashed { border-bottom: 2px dashed #000000 !important; }
      .border-b.border-dashed { border-bottom: 1px dashed #1f2937 !important; }
      .border-t.border-dotted { border-top: 1px dotted #374151 !important; }
      .border-b.border-dotted { border-bottom: 1px dotted #374151 !important; }
      .border-b.border-black { border-bottom: 1px solid #000000 !important; }

      ${isThermal ? `
        body, .page-container, #printable-document-content {
          width: 80mm !important;
          max-width: 80mm !important;
          min-width: 80mm !important;
          font-family: 'Courier New', Courier, monospace, monospace !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
          margin: 0 auto !important;
          padding: 0 !important;
        }
        b, strong, .font-bold, .font-black, .font-extrabold {
          font-weight: 800 !important;
          color: #000000 !important;
          -webkit-text-stroke: 0.25px #000000;
        }
        .text-gray-600, .text-gray-700 {
          color: #1f2937 !important;
        }
      ` : `
        /* Folha A4 */
        .a4-sheet {
          width: 210mm !important;
          max-width: 210mm !important;
          min-width: 210mm !important;
          height: 100% !important;
          max-height: 297mm !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          box-sizing: border-box !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      `}

      @media screen {
        body {
          background-color: #0f172a !important;
          padding: 16px 8px 32px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        .page-container {
          background-color: #ffffff !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4) !important;
          width: ${isThermal ? '80mm' : '210mm'} !important;
          min-height: ${isThermal ? 'auto' : '297mm'} !important;
          padding: ${isThermal ? '3mm' : '5mm 7mm'} !important;
        }
      }

      @media print {
        html, body {
          height: auto !important;
          min-height: 100% !important;
          overflow: visible !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }

        /* FORÇAR NEGRITO GLOBAL NA IMPRESSÃO: ALTA LEGIBILIDADE FÍSICA NO PAPEL */
        *, *::before, *::after {
          font-weight: 700 !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }

        span, p, div, td, th, label, h1, h2, h3, h4, h5, h6, b, strong, i, em, small, input, select, textarea, li, a {
          font-weight: 700 !important;
        }

        /* Títulos, cabeçalhos de tabela e tags de maior destaque em negrito máximo */
        h1, h2, h3, h4, th, b, strong, .font-bold, .font-extrabold, .font-black {
          font-weight: 800 !important;
        }

        /* Garante alto contraste e cor nítida para evitar textos apagados em tons claros de cinza */
        .text-slate-400,
        .text-slate-500,
        .text-slate-600,
        .text-gray-400,
        .text-gray-500,
        .text-gray-600,
        .text-gray-700 {
          color: #000000 !important;
        }

        /* Preserva textos claros onde o fundo é escuro/colorido */
        .text-white,
        .bg-gradient-to-br,
        .bg-gradient-to-br span,
        .bg-gradient-to-br strong,
        .bg-gradient-to-br div,
        .bg-emerald-950\\/40 span,
        .bg-emerald-950\\/40 strong,
        .bg-emerald-700\\/60 span,
        .bg-emerald-700\\/60 strong,
        .bg-emerald-700\\/50 span,
        .bg-emerald-700\\/50 strong,
        .bg-emerald-900 span,
        .bg-emerald-900 strong {
          color: #ffffff !important;
        }

        .no-print {
          display: none !important;
        }
        body {
          background-color: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .page-container {
          box-shadow: none !important;
          border: none !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .a4-sheet {
          box-shadow: none !important;
          border: none !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          height: auto !important;
          min-height: 280mm !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .print-signatures-area {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin-top: 2rem !important;
          padding-top: 1rem !important;
        }
        .footer-sistema {
          display: block !important;
        }
      }

      .footer-sistema {
        display: block !important;
      }

      .break-avoid {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-column-break-inside: avoid !important;
      }

      .toolbar {
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        z-index: 9999;
        background: #1e293b;
        color: #f8fafc;
        padding: 8px 14px;
        border-radius: 8px;
        margin-bottom: 12px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        max-width: 900px;
        width: 100%;
      }
      .toolbar-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 11px;
        cursor: pointer;
        border: none;
        transition: background-color 0.15s;
      }
      .btn-primary {
        background-color: #16a34a;
        color: #ffffff;
      }
      .btn-primary:hover {
        background-color: #15803d;
      }
      .btn-secondary {
        background-color: #334155;
        color: #f8fafc;
      }
      .btn-secondary:hover {
        background-color: #475569;
      }
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ordem de Serviço ${displayOrderNumber} - ${company.tradeName || 'Silagem Fácil'}</title>
        ${headStyles}
        <style>${styles}</style>
      </head>
      <body>
        <div class="toolbar no-print">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 13px; font-weight: 700;">${(company.tradeName || company.corporateName || 'SILAGEM FÁCIL').toUpperCase()}</span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${isClient ? '#d97706' : '#2563eb'}; color: white; font-weight: 700;">
              ${isClient ? 'Via Cliente' : 'Via Completa'}
            </span>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #475569; color: white;">
              ${isThermal ? 'Cupom Térmico 80mm' : 'Folha A4'}
            </span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="toolbar-btn btn-primary" onclick="window.print()">
              🖨️ Imprimir / Salvar PDF
            </button>
            <button class="toolbar-btn btn-secondary" onclick="window.close()">
              ✕ Fechar
            </button>
          </div>
        </div>

        <div class="page-container">
          ${printableElement.innerHTML}
        </div>

        <script>
          // Dispara a impressão com timeout seguro para carregar fontes e imagens
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              try {
                window.print();
              } catch(e) {
                console.warn('Auto-print dialog blocked, click print button in toolbar.', e);
              }
            }, 350);
          };
        </script>
      </body>
      </html>
    `;

    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (!printWindow) {
        // Fallback em caso de popup blocker
        const fallbackWin = window.open('', '_blank');
        if (fallbackWin) {
          fallbackWin.document.open();
          fallbackWin.document.write(htmlContent);
          fallbackWin.document.close();
        } else {
          window.print();
        }
      }
    } catch (err) {
      console.warn('Erro ao abrir janela de impressão:', err);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm overflow-hidden text-slate-100">
      {/* BARRA SUPERIOR DE CONTROLE E NAVEGAÇÃO DA PRÉVIA */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-bold rounded-lg shadow-sm transition cursor-pointer"
            title="Voltar ao formulário para continuar editando"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Formulário</span>
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-700" />

          {/* INDICADOR RESUMIDO */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span>Prévia:</span>
            <span className="font-bold text-slate-200">{displayOrderNumber}</span>
            <span>•</span>
            <span className="text-slate-300 font-semibold">{company.tradeName || company.corporateName || 'Silagem Fácil'}</span>
          </div>
        </div>

        {/* CONTROLES: FORMATO DE PAPEL & TIPO DE VIA */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* SELETOR 1: FORMATO DE PAPEL (80mm vs A4) */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <span className="text-[11px] font-semibold text-slate-400 px-2 hidden lg:inline">Formato:</span>
            <button
              type="button"
              onClick={() => setPaperFormat('thermal_80mm')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                paperFormat === 'thermal_80mm'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Formato Bobina / Cupom Térmico (80mm)"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Cupom 80mm</span>
            </button>

            <button
              type="button"
              onClick={() => setPaperFormat('a4')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                paperFormat === 'a4'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Formato Folha A4 Corporativa"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Folha A4</span>
            </button>
          </div>

          {/* SELETOR 2: TIPO DE VIA (Via Cliente vs Via Completa) */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <span className="text-[11px] font-semibold text-slate-400 px-2 hidden lg:inline">Via:</span>
            <button
              type="button"
              onClick={() => setContentType('client')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                contentType === 'client'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Via Cliente: Comissões e lucros 100% ocultos"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Via Cliente</span>
            </button>

            <button
              type="button"
              onClick={() => setContentType('full')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                contentType === 'full'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Via Completa: DRE discriminado e comissões nominais"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Via Completa (DRE)</span>
            </button>
          </div>

          {/* BOTÃO PRINCIPAL DE IMPRESSÃO */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-extrabold rounded-lg transition cursor-pointer shadow-sm hover:shadow-md"
            title="Abrir diálogo de impressão limpo em nova janela"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Salvar PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* SUB-BARRA DE STATUS DA POLÍTICA DE PRIVACIDADE E FORMATO SELECIONADOS */}
      <div className={`px-4 sm:px-6 py-2 text-xs font-medium flex items-center justify-between border-b ${
        contentType === 'client'
          ? 'bg-emerald-950/40 text-emerald-200 border-emerald-800/40'
          : 'bg-indigo-950/40 text-indigo-200 border-indigo-800/40'
      }`}>
        <div className="flex items-center gap-2">
          {contentType === 'client' ? (
            <>
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Privacidade do Produtor Ativa:</strong> Comissões da forrageira, trator e motoristas estão completamente ocultas. Exibindo apenas medição de áreas, faturamento e total do pedido.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>Visualização Gerencial Completa:</strong> Exibindo DRE, comissões discriminadas nominalmente de cada motorista/operador, despesas e margem operacional líquida.
              </span>
            </>
          )}
        </div>
        <span className="text-[11px] opacity-80 hidden md:inline font-mono">
          {paperFormat === 'thermal_80mm' ? '📐 Bobina 80mm' : '📄 Folha A4'} • {contentType === 'client' ? 'Via Cliente' : 'Via Completa'}
        </span>
      </div>

      {/* ÁREA DE PRÉVIA CENTRALIZADA (PAPEL SOBRE MESA ESCURA) */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-slate-900/70">
        
        {/* DOCUMENTO PRINCIPAL RENDERIZADO */}
        <div id="printable-document-content">
          
          {/* ========================================================================= */}
          {/* CASO 1 & 2: CUPOM TÉRMICO 80MM (VIA CLIENTE OU VIA COMPLETA)              */}
          {/* ========================================================================= */}
          {paperFormat === 'thermal_80mm' && (
            <div 
              className="w-[80mm] max-w-[80mm] min-w-[80mm] bg-white text-black p-3 font-mono text-[11px] leading-tight shadow-2xl border-2 border-dashed border-gray-400 rounded-none my-2 selection:bg-gray-300"
              style={{ boxSizing: 'border-box' }}
            >
              {/* TOPO SERRILHADO BOBINA TÉRMICA */}
              <div className="border-b-2 border-dashed border-gray-800 pb-2 mb-2 text-center space-y-0.5">
                {company.logoUrl && (
                  <div className="w-12 h-12 mx-auto mb-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={company.logoUrl}
                      alt={company.tradeName || 'Logo'}
                      className="max-w-full max-h-full object-contain grayscale"
                    />
                  </div>
                )}
                <h2 className="font-black text-sm tracking-wider uppercase">
                  {company.tradeName || company.corporateName || 'SILAGEM FÁCIL'}
                </h2>
                {company.corporateName && company.corporateName !== company.tradeName && (
                  <p className="text-[9px] text-gray-700 font-semibold">{company.corporateName}</p>
                )}
                {company.cnpjCpf && (
                  <p className="text-[9px] text-gray-700 font-bold">CNPJ/CPF: {company.cnpjCpf}</p>
                )}
                {(company.phone || company.city) && (
                  <p className="text-[8.5px] text-gray-600">
                    {[company.phone ? `Tel: ${company.phone}` : '', company.city ? `${company.city}/${company.state || ''}` : ''].filter(Boolean).join(' • ')}
                  </p>
                )}
                <div className="mt-1 pt-1 border-t border-dotted border-gray-400">
                  <span className={`font-bold text-[10px] uppercase px-2 py-0.5 inline-block ${
                    contentType === 'client' ? 'bg-black text-white' : 'bg-gray-800 text-white'
                  }`}>
                    {contentType === 'client' ? 'COMPROVANTE DO CLIENTE' : 'VIA COMPLETA - DRE GERENCIAL'}
                  </span>
                </div>
              </div>

              {/* CABEÇALHO DO PEDIDO */}
              <div className="space-y-1 pb-2 border-b border-dashed border-gray-400 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ordem Serviço:</span>
                  <strong className="font-bold">{displayOrderNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data:</span>
                  <span className="font-bold">{serviceDate ? formatDateBR(serviceDate) : 'Hoje'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Modalidade:</span>
                  <span className="font-bold uppercase">{serviceTypeTitle}</span>
                </div>
                <div>
                  <span className="text-gray-600">Cliente:</span>{' '}
                  <strong className="uppercase">{clientName || 'Consumidor Final'}</strong>
                </div>
                {farmName && (
                  <div>
                    <span className="text-gray-600">Fazenda:</span>{' '}
                    <span className="font-bold uppercase">{farmName}</span>
                  </div>
                )}
                {location && (
                  <div>
                    <span className="text-gray-600">Local:</span>{' '}
                    <span>{location}</span>
                  </div>
                )}
                {clientPhone && (
                  <div>
                    <span className="text-gray-600">Tel:</span>{' '}
                    <span>{clientPhone}</span>
                  </div>
                )}
              </div>

              {/* DADOS OPERACIONAIS DA EXECUÇÃO */}
              <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10px]">
                <p className="font-bold uppercase text-gray-700 border-b border-dotted border-gray-300 pb-0.5">
                  {operationalSpecsTitle}
                </p>
                <div className="flex justify-between">
                  <span>{unidadeAreaLabel}:</span>
                  <span className="font-bold">{quantidadeArea || 0}</span>
                </div>

                {forageHarvesterName && (
                  <div className="flex justify-between">
                    <span>Ensiladeira:</span>
                    <span className="font-bold truncate max-w-[130px]">{forageHarvesterName}</span>
                  </div>
                )}

                {horasTambor !== '' && Number(horasTambor) > 0 && (
                  <div className="flex justify-between">
                    <span>Horas Tambor:</span>
                    <span className="font-bold">{horasTambor} h</span>
                  </div>
                )}

                {horasMotor !== '' && Number(horasMotor) > 0 && (
                  <div className="flex justify-between">
                    <span>Horas Motor:</span>
                    <span className="font-bold">{horasMotor} h</span>
                  </div>
                )}

                {tractorName && (
                  <div className="flex justify-between">
                    <span>Trator:</span>
                    <span className="font-bold truncate max-w-[130px]">{tractorName}</span>
                  </div>
                )}

                {tractorHours !== '' && Number(tractorHours) > 0 && (
                  <div className="flex justify-between">
                    <span>Horas Trator:</span>
                    <span className="font-bold">{tractorHours} h</span>
                  </div>
                )}

                {/* CAMINHÕES (SEM COMISSÕES NA VIA CLIENTE) */}
                {trucks.length > 0 && (
                  <div className="pt-1">
                    <p className="font-semibold text-gray-700">Frotas Utilizadas ({trucks.length}):</p>
                    <div className="space-y-0.5 pl-1 pt-0.5">
                      {trucks.map((t, idx) => (
                        <div key={t.id} className="flex justify-between text-[9.5px]">
                          <span className="truncate max-w-[140px]">
                            • {t.truckName || t.plate || `Caminhão ${idx + 1}`}
                          </span>
                          <span>{t.tripLoads || 0} viagens</span>
                        </div>
                      ))}
                    </div>

                    {/* Somatórios da frota (Via Cliente e Via Completa) */}
                    <div className="border-t border-dotted border-gray-400 pt-0.5 mt-1 text-[9.5px] space-y-0.5">
                      <div className="flex justify-between font-bold">
                        <span>Total Viagens / Volume:</span>
                        <span className="font-mono">{totalCargasViagens} vg • {totalVolumeTransportadoM3.toFixed(1).replace('.', ',')} m³</span>
                      </div>
                      {totalKmAdicionalSoma > 0 && (
                        <div className="flex justify-between text-gray-700">
                          <span>Total KM Adicional:</span>
                          <span className="font-mono font-bold">
                            {totalKmAdicionalSoma} km
                            {(totalKmAdicionalValor > 0 || totalAdicionalKm > 0) ? ` (R$ ${formatCurrencyBRL(totalKmAdicionalValor || totalAdicionalKm)})` : ''}
                          </span>
                        </div>
                      )}
                      {(unidadeArea === 'hectares' || unidadeArea === 'hora') && totalTransporteHoras > 0 && (
                        <div className="flex justify-between text-gray-700">
                          <span>Transporte Frotas (Horas):</span>
                          <span className="font-mono font-bold">
                            {formatCurrencyBRL(totalTransporteHoras)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* RESUMO DO PEDIDO / FATURAMENTO COBRADO DO CLIENTE */}
              <div className="py-2 border-b-2 border-dashed border-gray-800 space-y-1 text-[10px]">
                <p className="font-black uppercase tracking-wide text-center bg-gray-100 py-0.5 border border-gray-300">
                  1. RESUMO DO PEDIDO
                </p>

                <div className="flex justify-between">
                  <span className={unidadeArea === 'hectares' ? 'font-bold' : ''}>
                    {unidadeArea === 'hectares' ? 'Valor Base do Serviço (Hectares):' : `Serviço Base (${unidadeAreaLabel}):`}
                  </span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(valorBaseArea)}</span>
                </div>

                {subtotalTrator > 0 && (
                  <div className="flex justify-between">
                    <span>Compactação Trator:</span>
                    <span className="font-mono font-bold">{formatCurrencyBRL(subtotalTrator)}</span>
                  </div>
                )}

                {totalAdicionalKm > 0 && (
                  <div className="flex justify-between">
                    <span>Frete / KM Adicional:</span>
                    <span className="font-mono font-bold">{formatCurrencyBRL(totalAdicionalKm)}</span>
                  </div>
                )}

                {(unidadeArea === 'hectares' || unidadeArea === 'hora') && totalTransporteHoras > 0 && (
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span>Transporte Frotas (Horas):</span>
                      <span className="font-mono font-bold">{formatCurrencyBRL(totalTransporteHoras)}</span>
                    </div>
                    {/* INÍCIO DO MAPEAMENTO DE FROTAS NO RESUMO DO PEDIDO 80MM */}
                    {trucksExpenseDetails && trucksExpenseDetails.length > 0 && (
                      <div className="pl-1 space-y-0.5 text-[8.5px] text-gray-700">
                        {trucksExpenseDetails.map((truckItem) => (
                          <div key={`80mm-resumo-truck-${truckItem.truckId}`} className="leading-tight">
                            • Transp. <strong>{truckItem.plate || 'S/ Placa'}</strong> ({truckItem.driverName || 'Motorista'}) – {truckItem.loads} Cargas ({truckItem.totalM3.toFixed(1)} m³) – {truckItem.truckHours || 0}h × {formatCurrencyBRL(truckItem.truckHourlyRate || 0)}/h = <span className="font-bold font-mono">{formatCurrencyBRL(truckItem.rateioCost)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* FIM DO MAPEAMENTO DE FROTAS NO RESUMO DO PEDIDO 80MM */}
                  </div>
                )}

                {numFretePrancha > 0 && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Frete Prancha:</span>
                    <span className="font-mono font-bold">{formatCurrencyBRL(numFretePrancha)}</span>
                  </div>
                )}

                <div className="border-t-2 border-black pt-1 mt-1 flex justify-between items-baseline font-black text-[11px]">
                  <span>TOTAL A PAGAR:</span>
                  <span className="text-xs font-black font-mono">{formatCurrencyBRL(totalPedido)}</span>
                </div>
              </div>

              {/* BLOCO EXCLUSIVO DA VIA COMPLETA: COMISSÕES E DRE EM 80MM */}
              {contentType === 'full' && (
                <div className="py-2 border-b-2 border-dashed border-gray-800 space-y-1.5 text-[10px] bg-gray-50 p-1.5 rounded">
                  <p className="font-black uppercase tracking-wide text-center bg-orange-100 text-orange-900 py-0.5 border border-orange-300">
                    DRE & CUSTOS DA OPERAÇÃO
                  </p>

                  {/* Custos Operacionais: Combustível e Alimentação */}
                  {((totalCombustivelGeral || 0) > 0 || (totalAlimentacaoGeral || 0) > 0) && (
                    <div className="space-y-0.5 border-b border-dotted border-gray-300 pb-1">
                      <div className="flex justify-between font-bold text-gray-700">
                        <span>Combustível & Refeições:</span>
                        <span className="font-mono">{formatCurrencyBRL((totalCombustivelGeral || 0) + (totalAlimentacaoGeral || 0))}</span>
                      </div>
                      {fuelEntries && fuelEntries.some(f => (f.subtotal || 0) > 0) && (
                        fuelEntries.filter(f => (f.subtotal || 0) > 0).map(f => (
                          <div key={`80mm-fuel-${f.vehicleId}`} className="flex justify-between pl-1 text-[9px]">
                            <span className="truncate max-w-[135px]">• Diesel {f.vehicleName}: {f.liters}L</span>
                            <span className="font-bold font-mono whitespace-nowrap">{formatCurrencyBRL(f.subtotal || 0)}</span>
                          </div>
                        ))
                      )}
                      {mealExpenses && mealExpenses.some(m => Number(m.amount) > 0) && (
                        mealExpenses.filter(m => Number(m.amount) > 0).map(m => (
                          <div key={`80mm-meal-${m.id}`} className="flex justify-between pl-1 text-[9px]">
                            <span className="truncate max-w-[135px]">• {m.description || 'Alimentação'}</span>
                            <span className="font-bold font-mono whitespace-nowrap">{formatCurrencyBRL(Number(m.amount) || 0)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Custos de Transporte das Frotas (Rateio + Adicional KM) */}
                  {trucksExpenseDetails.length > 0 && (
                    <div className="space-y-0.5 border-b border-dotted border-gray-300 pb-1">
                      <div className="flex justify-between font-bold text-gray-700">
                        <span>Custos Transporte Frotas:</span>
                        <span className="font-mono">{formatCurrencyBRL(subtotalTransporteFrotas)}</span>
                      </div>
                      {trucksExpenseDetails.map((truckItem) => {
                        const transpVal = truckItem.rateioCost + truckItem.additionalKmCost;
                        return (
                          <div key={`80mm-transp-${truckItem.truckId}`} className="flex justify-between pl-1 text-[9px]">
                            <span className="truncate max-w-[135px]">
                              • Transp. {truckItem.plate} ({truckItem.driverName || 'Motorista'}) [{truckItem.loads}vg, {truckItem.distributionPercent.toFixed(0)}%]
                            </span>
                            <span className="font-bold font-mono whitespace-nowrap">{formatCurrencyBRL(transpVal)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Comissões Nominais Forrageira */}
                  {(comissaoForrageiraP1 > 0 || comissaoForrageiraP2 > 0) && (
                    <div className="space-y-0.5 border-b border-dotted border-gray-300 pb-1">
                      <span className="font-bold text-gray-700 block">Comissão Ensiladeira:</span>
                      {comissaoForrageiraP1 > 0 && (
                        <div className="flex justify-between pl-1">
                          <span>{operadorForrageiraNome || 'Operador Principal'}:</span>
                          <span className="font-bold font-mono">{formatCurrencyBRL(comissaoForrageiraP1)}</span>
                        </div>
                      )}
                      {comissaoForrageiraP2 > 0 && (
                        <div className="flex justify-between pl-1">
                          <span>2º {segundoOperadorForrageiraNome}:</span>
                          <span className="font-bold font-mono">{formatCurrencyBRL(comissaoForrageiraP2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comissões Nominais Trator */}
                  {(comissaoTratorP1 > 0 || comissaoTratorP2 > 0) && (
                    <div className="space-y-0.5 border-b border-dotted border-gray-300 pb-1">
                      <span className="font-bold text-gray-700 block">Comissão Trator:</span>
                      {comissaoTratorP1 > 0 && (
                        <div className="flex justify-between pl-1">
                          <span>{operadorTratorNome || 'Operador Principal'}:</span>
                          <span className="font-bold font-mono">{formatCurrencyBRL(comissaoTratorP1)}</span>
                        </div>
                      )}
                      {comissaoTratorP2 > 0 && (
                        <div className="flex justify-between pl-1">
                          <span>2º {segundoOperadorTratorNome}:</span>
                          <span className="font-bold font-mono">{formatCurrencyBRL(comissaoTratorP2)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comissões Motoristas */}
                  {trucksExpenseDetails.filter(t => (t.driverCommissionCost || 0) > 0).length > 0 && (
                    <div className="space-y-0.5 border-b border-dotted border-gray-300 pb-1">
                      <div className="flex justify-between font-bold text-gray-700">
                        <span>Comissão Motoristas:</span>
                        <span className="font-mono">{formatCurrencyBRL(subtotalComissoesMotoristas)}</span>
                      </div>
                      {trucksExpenseDetails
                        .filter(t => (t.driverCommissionCost || 0) > 0)
                        .map(truckItem => (
                          <div key={truckItem.truckId} className="flex justify-between pl-1 text-[9.5px]">
                            <span className="truncate max-w-[130px]">• {truckItem.driverName || 'Motorista'} ({truckItem.plate})</span>
                            <span className="font-bold font-mono">{formatCurrencyBRL(truckItem.driverCommissionCost || 0)}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Total Geral de Despesas */}
                  <div className="flex justify-between font-bold pt-0.5 text-orange-950">
                    <span>Total Geral Despesas:</span>
                    <span className="font-mono">{formatCurrencyBRL(totalGeralDespesas)}</span>
                  </div>

                  {/* Lucro Estimado */}
                  <div className="border-t border-gray-400 pt-1 flex justify-between items-baseline font-black bg-emerald-100 p-1 rounded text-emerald-950">
                    <span>LUCRO OPERACIONAL:</span>
                    <span className="font-mono">{formatCurrencyBRL(lucroEstimado)} ({margemLucroPercent.toFixed(1)}%)</span>
                  </div>
                </div>
              )}

              {/* OBSERVAÇÕES */}
              {observacoes && (
                <div className="py-1.5 border-b border-dashed border-gray-400 text-[9.5px]">
                  <p className="font-bold text-gray-600">OBSERVAÇÕES:</p>
                  <p className="italic">{observacoes}</p>
                </div>
              )}

              {/* LINHAS DE ASSINATURAS (CUPOM TÉRMICO) COM ESPAÇO CONFORTÁVEL */}
              <div className="pt-6 pb-2 text-center space-y-4">
                <div className="space-y-1">
                  <div className="h-8 w-4/5 mx-auto flex items-end justify-center mb-1">
                    <div className="border-b border-black w-full"></div>
                  </div>
                  <p className="font-bold text-[10px] uppercase">{clientName || 'Assinatura do Produtor'}</p>
                  <p className="text-[8px] text-gray-500">Declaro conferência dos serviços executados</p>
                </div>

                {contentType === 'full' && (
                  <div className="space-y-1 pt-1">
                    <div className="h-8 w-4/5 mx-auto flex items-end justify-center mb-1">
                      <div className="border-b border-black w-full"></div>
                    </div>
                    <p className="font-bold text-[10px] uppercase">{operatorName || 'Encarregado Operacional'}</p>
                    <p className="text-[8px] text-gray-500">{company.tradeName || 'Silagem Fácil'} - Fechamento de Campo</p>
                  </div>
                )}
              </div>

              {/* RODAPÉ DO CUPOM */}
              <div className="text-center pt-2 border-t border-dotted border-gray-400 text-[9px] text-gray-600 space-y-0.5">
                <p className="font-bold tracking-wider">{(company.tradeName || 'SILAGEM FÁCIL').toUpperCase()} - GESTÃO AGRÍCOLA</p>
                <p className="text-[8px] text-gray-400">
                  {contentType === 'client' ? 'Via do Produtor Rural' : 'Via Gerencial Interna'}
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CASO 3 & 4: FOLHA A4 CORPORATIVA (VIA CLIENTE OU VIA COMPLETA)           */}
          {/* ========================================================================= */}
          {paperFormat === 'a4' && (
            <div 
              className="a4-sheet w-[210mm] max-w-[210mm] min-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-3.5 sm:p-4 font-sans text-[10px] leading-tight shadow-2xl border border-gray-300 rounded-none my-2 selection:bg-blue-100 flex flex-col justify-between"
              style={{ boxSizing: 'border-box' }}
            >
              <div className="space-y-1.5">
                {/* CABEÇALHO EXECUTIVO INSTITUCIONAL A4 */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5 mb-1.5 break-avoid gap-3">
                  {/* LADO ESQUERDO: LOGOTIPO + IDENTIFICAÇÃO INSTITUCIONAL & CADASTRO */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* 1. Logotipo da Empresa */}
                    <div className="w-12 h-12 min-w-[48px] max-w-[48px] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden p-1 shrink-0">
                      {company.logoUrl ? (
                        <img
                          src={company.logoUrl}
                          alt={company.tradeName || 'Logotipo da Empresa'}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-black text-lg rounded">
                          {(company.tradeName || company.corporateName || 'SF').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* 2 & 3: Nome Fantasia, Razão Social e Bloco Cadastral */}
                    <div className="space-y-0.5 flex-1 min-w-0">
                      {/* Nome Fantasia + Badge da Via */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase truncate">
                          {company.tradeName || company.corporateName || 'SILAGEM FÁCIL'}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border shrink-0 ${
                          contentType === 'client'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                        }`}>
                          {contentType === 'client' ? 'Comprovante do Cliente (Via Produtor)' : 'Via Completa / DRE Gerencial'}
                        </span>
                      </div>

                      {/* Razão Social */}
                      {company.corporateName && company.corporateName !== company.tradeName && (
                        <p className="text-[9.5px] text-slate-700 font-semibold truncate">
                          Razão Social: <span className="text-slate-900 font-bold">{company.corporateName}</span>
                        </p>
                      )}

                      {/* Bloco de Dados Cadastrais: CNPJ/CPF, Inscrição Estadual, Contato (Tel/Email) e Endereço */}
                      <div className="text-[9px] text-slate-600 leading-tight space-y-0.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {company.cnpjCpf && (
                            <span><strong className="text-slate-800">CNPJ/CPF:</strong> {company.cnpjCpf}</span>
                          )}
                          {company.stateRegistration && (
                            <span>• <strong className="text-slate-800">IE:</strong> {company.stateRegistration}</span>
                          )}
                          {company.phone && (
                            <span>• <strong className="text-slate-800">Contato:</strong> {company.phone}</span>
                          )}
                          {company.email && (
                            <span>• <strong className="text-slate-800">E-mail:</strong> {company.email}</span>
                          )}
                        </div>
                        {fullCompanyAddress && (
                          <div className="truncate text-[8.5px] text-slate-500">
                            <strong className="text-slate-700">Endereço:</strong> {fullCompanyAddress}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4. LADO DIREITO: DADOS ESPECÍFICOS DO RELATÓRIO (MANTIDO) */}
                  <div className="text-right space-y-0.5 shrink-0 min-w-[170px]">
                    <p className="text-xs font-black text-slate-900 tracking-tight">
                      ORDEM DE SERVIÇO Nº {displayOrderNumber}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      Data da Emissão: <strong className="text-slate-900">{serviceDate ? formatDateBR(serviceDate) : 'Hoje'}</strong>
                    </p>
                    <p className="text-[9.5px] text-slate-500">
                      Modalidade: <strong className="text-slate-800 uppercase">{serviceTypeTitle}</strong>
                    </p>
                  </div>
                </div>

                {/* SEÇÃO 1: DADOS CADASTRAIS DO CLIENTE E LOCAL */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 mb-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] break-avoid">
                  <div className="flex flex-col justify-start">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-0.5">Produtor / Cliente</span>
                    <span className="font-bold text-slate-900 truncate block">{clientName || 'Não Informado'}</span>
                  </div>
                  <div className="flex flex-col justify-start">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-0.5">Fazenda / Propriedade</span>
                    <span className="font-bold text-slate-900 truncate block">{farmName || 'Não Informada'}</span>
                  </div>
                  <div className="flex flex-col justify-start">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-0.5">Localidade</span>
                    <span className="text-slate-800 truncate block">{location || 'Não Informada'}</span>
                  </div>
                  <div className="flex flex-col justify-start">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block mb-0.5">Telefone de Contato</span>
                    <span className="text-slate-800 truncate block">{clientPhone || 'Não Informado'}</span>
                  </div>
                </div>

                {/* SEÇÃO 2: ESPECIFICAÇÕES OPERACIONAIS (FORRAGEIRA, TRATOR, FROTAS) */}
                <div className="border border-slate-200 rounded-lg p-1.5 mb-1.5 space-y-1 break-avoid">
                  <h3 className="text-[10.5px] font-bold uppercase text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-0.5">
                    <Scissors className="w-3.5 h-3.5 text-emerald-700" />
                    {operationalSpecsTitle}
                  </h3>

                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="bg-slate-50 p-1 rounded border border-slate-100 flex flex-col justify-start">
                      <span className="text-[8.5px] text-slate-500 font-bold uppercase block mb-0.5">Área da Colheita</span>
                      <span className="font-black text-slate-900 text-[11px] block">{quantidadeArea || 0} {unidadeAreaLabel}</span>
                    </div>

                    <div className="bg-slate-50 p-1 rounded border border-slate-100 flex flex-col justify-start">
                      <span className="text-[8.5px] text-slate-500 font-bold uppercase block mb-0.5">Ensiladeira / Forrageira</span>
                      <span className="font-bold text-slate-800 truncate block">{forageHarvesterName || 'Não vinculada'}</span>
                      <span className="text-[8.5px] text-slate-500 block mt-0.5">
                        Tambor: {horasTambor || 0}h | Motor: {horasMotor || 0}h
                      </span>
                    </div>

                    <div className="bg-slate-50 p-1 rounded border border-slate-100 flex flex-col justify-start">
                      <span className="text-[8.5px] text-slate-500 font-bold uppercase block mb-0.5">Trator Compactador</span>
                      <span className="font-bold text-slate-800 truncate block">{tractorName || 'Não vinculado'}</span>
                      <span className="text-[8.5px] text-slate-500 block mt-0.5">
                        Horímetro: {tractorHours || 0}h ({modoCobrancaTratorLabel})
                      </span>
                    </div>
                  </div>

                  {/* TABELA DE CAMINHÕES COM LINHA DE TOTAIS (VIA COMPLETA E VIA CLIENTE) */}
                  {trucks.length > 0 && (
                    <div className="pt-0.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-slate-700 uppercase">
                          Frota de Caminhões ({trucks.length} veículos):
                        </span>
                        <span className="text-[9.5px] font-mono text-slate-500">
                          Total acumulado: {totalCargasViagens} viagens • {totalVolumeTransportadoM3.toFixed(1).replace('.', ',')} m³
                        </span>
                      </div>
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                            <th className="py-0.5 px-2">Veículo / Placa</th>
                            <th className="py-0.5 px-2">Motorista</th>
                            <th className="py-0.5 px-2 text-center">Capacidade</th>
                            <th className="py-0.5 px-2 text-center">Viagens</th>
                            <th className="py-0.5 px-2 text-center">Total m³</th>
                            <th className="py-0.5 px-2 text-right">{(unidadeArea === 'hectares' || unidadeArea === 'hora') ? 'Horas / Total' : 'KM Adicional'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {trucks.map((t, i) => (
                            <tr key={t.id} className="hover:bg-slate-50">
                              <td className="py-0.5 px-2 font-semibold text-slate-900">{t.truckName || t.plate || `Caminhão ${i + 1}`}</td>
                              <td className="py-0.5 px-2 text-slate-700">{t.primaryDriverName || 'Não Informado'}</td>
                              <td className="py-0.5 px-2 text-center">{t.capacityM3 || 0} m³</td>
                              <td className="py-0.5 px-2 text-center font-bold text-slate-900">{t.tripLoads || 0}</td>
                              <td className="py-0.5 px-2 text-center">{(t.totalM3 || ((t.capacityM3 || 0) * (t.tripLoads || 0))).toFixed(1).replace('.', ',')} m³</td>
                              <td className="py-0.5 px-2 text-right">
                                {(unidadeArea === 'hectares' || unidadeArea === 'hora') ? (
                                  (t.truckHours || 0) > 0 ? `${t.truckHours}h (${formatCurrencyBRL((t.truckHours || 0) * (t.truckHourlyRate || 0))})` : '-'
                                ) : (
                                  (t.additionalKm || 0) > 0 ? `${t.additionalKm} km (${formatCurrencyBRL(t.totalAdditionalKm || 0)})` : '-'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {/* LINHA DE TOTAIS NO RODAPÉ (TFOOT) - REQUISITO DA VIA COMPLETA E VIA CLIENTE */}
                        <tfoot>
                          <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                            <td colSpan={3} className="py-1 px-2 uppercase text-[9.5px] tracking-wide text-slate-700">
                              Totais Acumulados da Frota:
                            </td>
                            <td className="py-1 px-2 text-center font-black text-slate-950">
                              {totalCargasViagens}
                            </td>
                            <td className="py-1 px-2 text-center font-black text-slate-950">
                              {totalVolumeTransportadoM3.toFixed(1).replace('.', ',')} m³
                            </td>
                            <td className="py-1 px-2 text-right font-black text-slate-950">
                              {(unidadeArea === 'hectares' || unidadeArea === 'hora') ? (
                                totalTransporteHoras > 0 ? formatCurrencyBRL(totalTransporteHoras) : '-'
                              ) : (
                                totalKmAdicionalSoma > 0 
                                  ? `${totalKmAdicionalSoma} km${(totalKmAdicionalValor > 0 || totalAdicionalKm > 0) ? ` (${formatCurrencyBRL(totalKmAdicionalValor || totalAdicionalKm)})` : ''}` 
                                  : totalAdicionalKm > 0 
                                    ? `${formatCurrencyBRL(totalAdicionalKm)}` 
                                    : '-'
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* SEÇÃO 1: RESUMO DO PEDIDO / FATURAMENTO BRUTO COBRADO DO CLIENTE */}
                <div className="border border-emerald-300 bg-emerald-50/40 rounded-lg p-1.5 mb-1.5 space-y-0.5 border-l-4 border-l-emerald-600 break-avoid">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-0.5">
                    <span className="font-bold text-[10.5px] uppercase text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      1. Resumo do Pedido (Faturamento Cobrado do Produtor)
                    </span>
                    <span className="font-black text-[11px] text-emerald-900 font-mono">
                      Total a Pagar: {formatCurrencyBRL(totalPedido)}
                    </span>
                  </div>

                  <div className={`grid gap-1.5 text-[10px] pt-0.5 ${numFretePrancha > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <div className="bg-white p-1 rounded border border-emerald-100 flex flex-col justify-start">
                      <span className="text-[8.5px] text-slate-600 font-bold block mb-0.5">
                        {unidadeArea === 'hectares' ? 'Valor Base do Serviço (Hectares)' : `Serviço Base (${unidadeAreaLabel})`}
                      </span>
                      <span className="font-bold text-slate-900 text-[11px] block">{formatCurrencyBRL(valorBaseArea)}</span>
                      <span className="text-[8.5px] text-slate-500 block mt-0.5">{quantidadeArea || 0} {unidadeAreaLabel} x {formatCurrencyBRL(typeof valorHectare === 'number' ? valorHectare : parseCurrencyToFloat(valorHectare || 0))}</span>
                    </div>

                    <div className="bg-white p-1 rounded border border-emerald-100 flex flex-col justify-start">
                      <span className="text-[8.5px] text-slate-500 font-bold block mb-0.5">Compactação Trator</span>
                      <span className="font-bold text-slate-900 text-[11px] block">{formatCurrencyBRL(subtotalTrator)}</span>
                      <span className="text-[8.5px] text-slate-500 block mt-0.5">{qtdCobrancaTrator || 0} {modoCobrancaTratorLabel}</span>
                    </div>

                    {(unidadeArea === 'hectares' || unidadeArea === 'hora') ? (
                      <div className="bg-white p-1 rounded border border-blue-200 flex flex-col justify-start">
                        <span className="text-[8.5px] text-blue-800 font-bold block mb-0.5">Transporte Frotas (Horas)</span>
                        <span className="font-bold text-slate-900 text-[11px] block">{formatCurrencyBRL(totalTransporteHoras)}</span>
                        <span className="text-[8.5px] text-slate-500 block mt-0.5">Cobrança por horas trabalhadas</span>
                      </div>
                    ) : (
                      <div className="bg-white p-1 rounded border border-emerald-100 flex flex-col justify-start">
                        <span className="text-[8.5px] text-slate-500 font-bold block mb-0.5">Frete / KM Adicional Frotas</span>
                        <span className="font-bold text-slate-900 text-[11px] block">{formatCurrencyBRL(totalAdicionalKm)}</span>
                        <span className="text-[8.5px] text-slate-500 block mt-0.5">Cobrança de deslocamento</span>
                      </div>
                    )}

                    {numFretePrancha > 0 && (
                      <div className="bg-white p-1 rounded border border-emerald-200 flex flex-col justify-start">
                        <span className="text-[8.5px] text-slate-500 font-bold block mb-0.5">Frete Prancha</span>
                        <span className="font-bold text-slate-900 text-[11px] block">{formatCurrencyBRL(numFretePrancha)}</span>
                        <span className="text-[8.5px] text-emerald-700 font-semibold block mt-0.5">Transporte de maquinário</span>
                      </div>
                    )}
                  </div>

                  {/* INÍCIO DO MAPEAMENTO DE FROTAS NO RESUMO DO PEDIDO A4 */}
                  {(unidadeArea === 'hectares' || unidadeArea === 'hora') && totalTransporteHoras > 0 && trucksExpenseDetails && trucksExpenseDetails.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-emerald-200/80 text-[8.5px] text-slate-600 space-y-0.5">
                      <span className="font-bold text-slate-800 uppercase text-[8.5px] block">
                        Detalhamento do Transporte por Horas (Cobrado do Produtor):
                      </span>
                      <div className="space-y-0.5">
                        {trucksExpenseDetails.map((truckItem) => (
                          <div key={`a4-resumo-truck-${truckItem.truckId}`} className="text-[8.5px]">
                            • Transp. <strong className="font-mono text-slate-900">{truckItem.plate || 'S/ Placa'}</strong> ({truckItem.driverName || 'Motorista'}) – {truckItem.loads} Cargas ({truckItem.totalM3.toFixed(1)} m³) – Cobrança por Horas: {truckItem.truckHours || 0}h × {formatCurrencyBRL(truckItem.truckHourlyRate || 0)}/h = Total: <strong className="font-mono text-slate-900">{formatCurrencyBRL(truckItem.rateioCost)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* FIM DO MAPEAMENTO DE FROTAS NO RESUMO DO PEDIDO A4 */}
                </div>

                {/* SEÇÃO 4 & 5 (EXCLUSIVO VIA COMPLETA): DRE E LUCRO OPERACIONAL */}
                {contentType === 'full' && (
                  <>
                    {/* BLOCO 2: DRE GERENCIAL (CUSTOS OPERACIONAIS E TRANSPORTE COMPLETO) */}
                    <div className="border border-orange-300 bg-orange-50/40 rounded-lg p-1.5 mb-1.5 space-y-1 border-l-4 border-l-orange-600 break-avoid">
                      <div className="flex items-center justify-between border-b border-orange-200 pb-0.5">
                        <span className="font-bold text-[10.5px] uppercase text-orange-900 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
                          2. Custos e Proventos Adicionais (DRE Gerencial da Operação)
                        </span>
                        <span className="font-black text-[11px] text-orange-900 font-mono">
                          Total Geral Despesas: {formatCurrencyBRL(totalGeralDespesas)}
                        </span>
                      </div>

                      {/* 1. DETALHAMENTO DOS CUSTOS DE TRANSPORTE DAS FROTAS (RATEIO + ADICIONAL KM) */}
                      {trucksExpenseDetails && trucksExpenseDetails.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <p className="font-bold text-orange-950 flex items-center gap-1 uppercase">
                              <Truck className="w-3.5 h-3.5 text-orange-600" />
                              Custos de Transporte das Frotas (Rateio Global & Adicional KM):
                            </p>
                            <span className="font-bold text-orange-800 text-[9.5px] font-mono">
                              Subtotal Transporte: {formatCurrencyBRL(subtotalTransporteFrotas)}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {trucksExpenseDetails.map((truck) => {
                              const transportTotal = truck.rateioCost + truck.additionalKmCost;
                              return (
                                <div 
                                  key={`a4-transp-${truck.truckId}`}
                                  className="bg-white px-2 py-1 rounded border border-orange-200 flex items-center justify-between gap-2 text-[9.5px] break-avoid"
                                >
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-bold text-slate-900">
                                      Transp. {truck.plate || 'Veículo'}
                                    </span>
                                    <span className="text-slate-600 font-medium">
                                      ({truck.driverName || 'Motorista'})
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-700">
                                      <strong>{truck.loads}</strong> Cargas (Cap: {truck.capacityM3 || 0} m³ | Total: <strong>{truck.totalM3.toFixed(1)} m³</strong>)
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    {(unidadeArea === 'hectares' || unidadeArea === 'hora') ? (
                                      <span className="text-slate-700">
                                        Horas: <strong>{truck.truckHours || 0}h</strong> × {formatCurrencyBRL(truck.truckHourlyRate || 0)}/h ({formatCurrencyBRL(truck.rateioCost)})
                                      </span>
                                    ) : (
                                      <span className="text-slate-700">
                                        <strong>{truck.distributionPercent.toFixed(1)}%</strong> Distribuição ({formatCurrencyBRL(truck.rateioCost)})
                                      </span>
                                    )}
                                    {truck.additionalKmCost > 0 && (
                                      <span className="text-amber-800 font-semibold bg-amber-50 px-1 rounded border border-amber-200 text-[8.5px]">
                                        + KM ({formatCurrencyBRL(truck.additionalKmCost)})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-right font-mono font-black text-orange-900 text-[10px] shrink-0">
                                    {formatCurrencyBRL(transportTotal)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* CUSTOS OPERACIONAIS: COMBUSTÍVEL E ALIMENTAÇÃO */}
                      {((totalCombustivelGeral || 0) > 0 || (totalAlimentacaoGeral || 0) > 0) && (
                        <div className="space-y-1 pt-1 border-t border-orange-200/60">
                          <div className="flex items-center justify-between text-[10px]">
                            <p className="font-bold text-orange-950 flex items-center gap-1 uppercase">
                              <Fuel className="w-3.5 h-3.5 text-amber-600" />
                              Custos Operacionais (Combustível & Alimentação):
                            </p>
                            <span className="font-bold text-orange-800 text-[9.5px] font-mono">
                              Subtotal Operacional: {formatCurrencyBRL((totalCombustivelGeral || 0) + (totalAlimentacaoGeral || 0))}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {/* Combustível */}
                            {fuelEntries && fuelEntries.some(f => (f.subtotal || 0) > 0) ? (
                              <div className="bg-white p-1.5 rounded border border-orange-200 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold text-slate-700 flex items-center gap-1">
                                    <Fuel className="w-3 h-3 text-amber-500" />
                                    Diesel Consumido
                                  </span>
                                  <span className="font-mono font-bold text-amber-800 text-[9px]">
                                    {formatCurrencyBRL(totalCombustivelGeral || 0)}
                                  </span>
                                </div>
                                <div className="space-y-0.5 text-[8.5px]">
                                  {fuelEntries.filter(f => (f.subtotal || 0) > 0).map(f => (
                                    <div key={`a4-fuel-${f.vehicleId}`} className="flex justify-between text-slate-700">
                                      <span className="truncate max-w-[150px]">{f.vehicleName} ({f.liters} L x {formatCurrencyBRL(f.pricePerLiter || 0)})</span>
                                      <span className="font-bold font-mono">{formatCurrencyBRL(f.subtotal || 0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {/* Alimentação */}
                            {mealExpenses && mealExpenses.some(m => Number(m.amount) > 0) ? (
                              <div className="bg-white p-1.5 rounded border border-orange-200 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold text-slate-700 flex items-center gap-1">
                                    <UtensilsCrossed className="w-3 h-3 text-orange-500" />
                                    Alimentação & Diárias
                                  </span>
                                  <span className="font-mono font-bold text-orange-800 text-[9px]">
                                    {formatCurrencyBRL(totalAlimentacaoGeral || 0)}
                                  </span>
                                </div>
                                <div className="space-y-0.5 text-[8.5px]">
                                  {mealExpenses.filter(m => Number(m.amount) > 0).map(m => (
                                    <div key={`a4-meal-${m.id}`} className="flex justify-between text-slate-700">
                                      <span className="truncate max-w-[150px]">{m.description} {m.date ? `(${formatDateBR(m.date)})` : ''}</span>
                                      <span className="font-bold font-mono">{formatCurrencyBRL(Number(m.amount) || 0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* 2. COMISSÃO INDIVIDUAL DOS MOTORISTAS */}
                      {trucksExpenseDetails && trucksExpenseDetails.some((t) => (t.driverCommissionCost || 0) > 0) && (
                        <div className="space-y-1 pt-1 border-t border-orange-200/60">
                          <div className="flex items-center justify-between text-[10px]">
                            <p className="font-bold text-orange-950 flex items-center gap-1 uppercase">
                              <Users className="w-3.5 h-3.5 text-orange-600" />
                              Comissões Individuais dos Motoristas:
                            </p>
                            <span className="font-bold text-orange-800 text-[9.5px] font-mono">
                              Subtotal Motoristas: {formatCurrencyBRL(subtotalComissoesMotoristas)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {trucksExpenseDetails
                              .filter((t) => (t.driverCommissionCost || 0) > 0)
                              .map((truck) => (
                                <div key={`a4-comm-${truck.truckId}`} className="bg-white px-2 py-1 rounded border border-orange-200 flex justify-between items-center text-[9.5px] break-avoid">
                                  <div className="truncate pr-1">
                                    <strong className="text-slate-900 block truncate">{truck.driverName || 'Motorista'}</strong>
                                    <span className="text-slate-500 text-[8.5px] block font-mono">{truck.plate} • {truck.loads} vg</span>
                                  </div>
                                  <span className="font-bold font-mono text-orange-700 text-[9.5px] whitespace-nowrap">
                                    {formatCurrencyBRL(truck.driverCommissionCost || 0)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* 3. COMISSÕES OPERADORES (ENSILADEIRA E TRATOR) */}
                      {(comissaoForrageiraP1 > 0 || comissaoForrageiraP2 > 0 || comissaoTratorP1 > 0 || comissaoTratorP2 > 0) && (
                        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-orange-200/60">
                          <div className="bg-white px-2 py-1 rounded border border-orange-200 text-[9.5px] flex justify-between items-center break-avoid">
                            <div>
                              <span className="text-[8.5px] font-bold text-slate-500 block uppercase">Operador Ensiladeira</span>
                              <strong className="text-slate-900">{operadorForrageiraNome || 'Sem Operador'}</strong>
                              {segundoOperadorForrageiraNome && (
                                <span className="text-[8.5px] text-slate-500 block">+ {segundoOperadorForrageiraNome}</span>
                              )}
                            </div>
                            <span className="font-bold font-mono text-orange-700 text-[10px] whitespace-nowrap">
                              {formatCurrencyBRL(comissaoForrageiraP1 + comissaoForrageiraP2)}
                            </span>
                          </div>

                          <div className="bg-white px-2 py-1 rounded border border-orange-200 text-[9.5px] flex justify-between items-center break-avoid">
                            <div>
                              <span className="text-[8.5px] font-bold text-slate-500 block uppercase">Operador Trator</span>
                              <strong className="text-slate-900">{operadorTratorNome || 'Sem Operador'}</strong>
                              {segundoOperadorTratorNome && (
                                <span className="text-[8.5px] text-slate-500 block">+ {segundoOperadorTratorNome}</span>
                              )}
                            </div>
                            <span className="font-bold font-mono text-orange-700 text-[10px] whitespace-nowrap">
                              {formatCurrencyBRL(comissaoTratorP1 + comissaoTratorP2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 4. COMISSÃO AGENCIADOR / INTERMEDIAÇÃO */}
                      {brokerCommissionAmount > 0 && (
                        <div className="pt-1 border-t border-orange-200/60">
                          <div className="bg-white px-2 py-1 rounded border border-orange-200 text-[9.5px] flex justify-between items-center break-avoid">
                            <div>
                              <span className="text-[8.5px] font-bold text-amber-700 block uppercase">Agenciador / Intermediação</span>
                              <strong className="text-slate-900">{brokerName || 'Agenciador'}</strong>
                            </div>
                            <span className="font-bold font-mono text-orange-700 text-[10px] whitespace-nowrap">
                              {formatCurrencyBRL(brokerCommissionAmount)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

              </div>

              {/* CONTÊINER AGRUPADO: SEÇÃO 3 (RESULTADO FINAL) + OBSERVAÇÕES + ASSINATURAS + RODAPÉ (EVITA CORTE NA IMPRESSÃO A4) */}
              <div 
                className="break-avoid space-y-2 mt-auto pt-2 w-full"
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                {/* BLOCO 3: RESULTADO FINAL (LUCRO ESTIMADO - DESTAQUE VERDE ESCURO) */}
                {contentType === 'full' && (
                  <div className="bg-gradient-to-br from-emerald-800 to-emerald-900 text-white rounded-lg p-2 shadow-xs space-y-1.5 break-avoid">
                    <div className="flex items-center justify-between border-b border-emerald-700/60 pb-1">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="font-bold text-[10.5px] uppercase tracking-wide">
                          3. Resultado Final da Operação (Lucro Líquido Estimado)
                        </span>
                      </div>
                      <span className="text-[9.5px] bg-emerald-700/50 px-2 py-0.5 rounded font-mono font-bold">
                        Margem: {margemLucroPercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                      <div className="bg-emerald-950/40 p-1.5 rounded flex flex-col items-center justify-center">
                        <span className="text-[8.5px] text-emerald-200 block uppercase font-medium mb-0.5">Receita Bruta</span>
                        <strong className="text-[11.5px] text-white font-mono block">{formatCurrencyBRL(totalPedido)}</strong>
                      </div>
                      <div className="bg-emerald-950/40 p-1.5 rounded flex flex-col items-center justify-center">
                        <span className="text-[8.5px] text-emerald-200 block uppercase font-medium mb-0.5">(-) Custos Operacionais</span>
                        <strong className="text-[11.5px] text-amber-300 font-mono block">{formatCurrencyBRL(totalGeralDespesas)}</strong>
                      </div>
                      <div className="bg-emerald-700/60 p-1.5 rounded border border-emerald-500/40 flex flex-col items-center justify-center">
                        <span className="text-[8.5px] text-emerald-100 block uppercase font-bold mb-0.5">(=) Lucro Líquido Estimado</span>
                        <strong className="text-[11.5px] text-emerald-100 font-black font-mono block">{formatCurrencyBRL(lucroEstimado)}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* OBSERVAÇÕES GERAIS */}
                {observacoes && (
                  <div className="border border-slate-200 bg-slate-50 rounded p-1.5 text-[9.5px] break-avoid">
                    <span className="font-bold text-slate-700 uppercase block text-[8.5px] mb-0.5">Observações Gerais da OS:</span>
                    <p className="text-slate-800 italic text-[9px]">{observacoes}</p>
                  </div>
                )}

                {/* SEÇÃO 6: ASSINATURAS GERENCIAIS (FIM DA FOLHA A4) COM RESPIRO VISUAL GENEROSO */}
                <div 
                  className="mt-8 sm:mt-10 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-700 break-avoid print-signatures-area"
                  style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                >
                  <div className="flex flex-col items-center justify-end">
                    <div className="h-10 sm:h-12 w-full flex items-end justify-center mb-1.5">
                      <div className="border-b border-slate-400 w-4/5 mx-auto signature-line"></div>
                    </div>
                    <p className="font-bold text-slate-900 block text-[10.5px]">
                      {clientName || 'Assinatura do Produtor Rural'}
                    </p>
                    <p className="text-[8.5px] text-slate-500 block mt-0.5">
                      Declaro haver conferido a medição e execução dos serviços
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-end">
                    <div className="h-10 sm:h-12 w-full flex items-end justify-center mb-1.5">
                      <div className="border-b border-slate-400 w-4/5 mx-auto signature-line"></div>
                    </div>
                    <p className="font-bold text-slate-900 block text-[10.5px]">
                      {operatorName || `${company.tradeName || 'Silagem Fácil'} - Responsável Técnico`}
                    </p>
                    <p className="text-[8.5px] text-slate-500 block mt-0.5">
                      {contentType === 'client' ? 'Conferência e encerramento operacional' : 'Validação de DRE e encerramento financeiro'}
                    </p>
                  </div>
                </div>

                {/* RODAPÉ INSTITUCIONAL DO SISTEMA PARA IMPRESSÃO A4 */}
                <div className="footer-sistema border-t border-slate-300 pt-1 text-center text-[8.5px] text-slate-500 leading-tight break-avoid">
                  <p className="font-bold text-slate-700">
                    {company.tradeName || company.corporateName || 'Silagem Fácil'} — Sistema de Gestão e Operações Agrícolas
                  </p>
                  {(company.cnpjCpf || company.phone || company.email) && (
                    <p>
                      {[
                        company.cnpjCpf ? `CNPJ/CPF: ${company.cnpjCpf}` : null,
                        company.phone ? `Contato: ${company.phone}` : null,
                        company.email ? `E-mail: ${company.email}` : null,
                      ].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
