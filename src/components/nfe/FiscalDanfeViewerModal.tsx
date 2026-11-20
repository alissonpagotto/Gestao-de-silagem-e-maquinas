import React from 'react';
import {
  X,
  Printer,
  Pencil,
  Trash2,
  Receipt,
  FileText,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import {
  CompanyProfile,
  DocumentoEntradaItem,
  DocumentoEntradaRecord,
  Expense,
  Supplier,
} from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { resolveSubscriberPrintHeader } from '../../lib/printIdentity';
import { generatePrintableHtml, executePrint } from '../../lib/printService';
import { getCachedMediaUrl } from '../../lib/imageStorage';
import { FiscalDocumentRecord } from './FiscalDocumentTypeView';
import { MdfeRecord } from './MdfeView';

export interface NormalizedDanfeItem {
  code?: string;
  description: string;
  ncm?: string;
  cfop?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface NormalizedDanfeInstallment {
  number: string;
  dueDate: string;
  paymentMethod?: string;
  amount: number;
  status: string;
}

export type FiscalDanfeViewerPayload =
  | {
      kind: 'expense';
      expense: Expense;
      items: NormalizedDanfeItem[];
      accessKey?: string;
      series?: string;
      installments: NormalizedDanfeInstallment[];
    }
  | {
      kind: 'manual';
      doc: DocumentoEntradaRecord;
      items: DocumentoEntradaItem[];
      isLoadingItems?: boolean;
      installments: NormalizedDanfeInstallment[];
    }
  | {
      kind: 'legacy';
      doc: FiscalDocumentRecord;
      installments: NormalizedDanfeInstallment[];
    }
  | {
      kind: 'mdfe';
      doc: MdfeRecord;
    };

interface FiscalDanfeViewerModalProps {
  payload: FiscalDanfeViewerPayload | null;
  companyProfile?: CompanyProfile | null;
  suppliers?: Supplier[];
  onClose: () => void;
  onEdit?: () => void;
  editLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
}

const escapeHtml = (value: string | undefined | null): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatAccessKeyChunks = (rawKey?: string): string => {
  const digits = String(rawKey || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

const buildBarcodeSvgHtml = (code: string): string => {
  const digits = code.replace(/\D/g, '') || '00000000000000000000';
  let x = 2;
  const rects: string[] = [];
  for (let i = 0; i < Math.min(digits.length, 44); i++) {
    const val = parseInt(digits[i], 10) || 0;
    const w = val % 3 === 0 ? 2 : 1;
    const gap = (val % 2) + 1;
    rects.push(`<rect x="${x}" y="0" width="${w}" height="28" fill="#0f172a" />`);
    x += w + gap;
  }
  return `<svg viewBox="0 0 ${Math.max(x + 2, 120)} 28" style="width:100%;max-width:260px;height:28px;display:block;margin:0 auto;">${rects.join('')}</svg>`;
};

const normalizeStatusBadge = (
  rawStatus?: string
): { label: string; cls: string; printBg: string; printColor: string } => {
  const s = String(rawStatus || '').trim().toLowerCase();
  if (s === 'pago' || s === 'finalizado' || s === 'confirmado' || s === 'autorizada' || s === 'atendido' || s === 'encerrado') {
    return {
      label: (rawStatus || 'FINALIZADO').toUpperCase(),
      cls: 'bg-emerald-100 text-emerald-900 border-emerald-500',
      printBg: '#dcfce7',
      printColor: '#14532d',
    };
  }
  if (s === 'cancelado' || s === 'cancelada' || s === 'atrasado') {
    return {
      label: (rawStatus || 'CANCELADO').toUpperCase(),
      cls: 'bg-rose-100 text-rose-900 border-rose-500',
      printBg: '#ffe4e6',
      printColor: '#881337',
    };
  }
  if (s === 'rascunho' || s === 'pendente' || s === 'em aberto') {
    return {
      label: (rawStatus || 'RASCUNHO').toUpperCase(),
      cls: 'bg-amber-100 text-amber-900 border-amber-500',
      printBg: '#fef3c7',
      printColor: '#78350f',
    };
  }
  return {
    label: (rawStatus || 'REGISTRADO').toUpperCase(),
    cls: 'bg-sky-100 text-sky-900 border-sky-500',
    printBg: '#e0f2fe',
    printColor: '#0c4a6e',
  };
};

export const FiscalDanfeViewerModal: React.FC<FiscalDanfeViewerModalProps> = ({
  payload,
  companyProfile,
  suppliers = [],
  onClose,
  onEdit,
  editLabel,
  onDelete,
  deleteLabel,
}) => {
  if (!payload) return null;

  const subscriber = resolveSubscriberPrintHeader(companyProfile);
  const logoSrc = getCachedMediaUrl(subscriber.logoUrl || companyProfile?.logoUrl) || '';

  // Normaliza todos os campos para exibição unificada em espelho A4 / DANFE
  let docTypeBadge = 'DOCUMENTO FISCAL';
  let docTitle = 'ESPELHO DE DOCUMENTO FISCAL DE ENTRADA';
  let docNumber = 'S/N';
  let docSeries = '1';
  let issueDate = '';
  let entryDate = '';
  let statusText = 'FINALIZADO';
  let enviarContador: boolean | undefined = undefined;
  let accessKey = '';

  let partnerLabel = 'FORNECEDOR / EMITENTE';
  let partnerName = '-';
  let partnerCnpj = '';
  let partnerPhone = '';
  let partnerAddress = '';

  let vehicleLabel = '';
  let costCenterLabel = '';
  let paymentSummary = '';
  let natureSummary = '';
  let notesText = '';
  let totalAmount = 0;

  let items: NormalizedDanfeItem[] = [];
  let installments: NormalizedDanfeInstallment[] = [];
  let isLoadingItems = false;

  // MDF-e específicos
  let mdfeDoc: MdfeRecord | null = null;

  const findSupplierDetails = (name?: string, id?: string) => {
    const cleanName = String(name || '').trim().toLowerCase();
    return suppliers.find(
      (s) =>
        (id && s.id === id) ||
        (cleanName && String(s.name || '').trim().toLowerCase() === cleanName)
    );
  };

  if (payload.kind === 'expense') {
    const exp = payload.expense;
    const isXml =
      String(exp.notes || '').toLowerCase().includes('xml') ||
      String(exp.notes || '').toLowerCase().includes('chave:') ||
      Boolean(payload.accessKey && payload.accessKey.length === 44);
    docTypeBadge = isXml ? 'DANFE / NF-E (ENTRADA)' : 'NOTA FISCAL / ENTRADA';
    docTitle = isXml ? 'ESPELHO DANFE — NOTA FISCAL DE ENTRADA' : 'ESPELHO DE DOCUMENTO FISCAL DE ENTRADA';
    docNumber = exp.invoiceNumber || exp.id.slice(0, 8).toUpperCase();
    docSeries = payload.series || '1';
    issueDate = exp.issueDate || exp.dueDate || '';
    entryDate = exp.entryDate || exp.dueDate || issueDate;
    statusText = exp.status === 'pago' ? 'PAGO / LIQUIDADO' : exp.status === 'atrasado' ? 'VENCIDO' : 'FINALIZADO';
    enviarContador = (exp as any).enviarContador;
    accessKey = payload.accessKey || (exp as any).accessKey || '';

    partnerName = exp.supplier || 'FORNECEDOR NÃO INFORMADO';
    const matchedSup = findSupplierDetails(exp.supplier, exp.supplierId || exp.fornecedorId);
    partnerCnpj = (exp as any).supplierCnpj || matchedSup?.cnpjOrCpf || '';
    partnerPhone = matchedSup?.phone || '';
    partnerAddress = [matchedSup?.address, matchedSup?.city, matchedSup?.state].filter(Boolean).join(' • ');

    vehicleLabel = exp.machineryName || (exp as any).vehiclePlate || '';
    costCenterLabel = exp.costCenterName || '';
    paymentSummary = String(exp.paymentMethod || 'A COMBINAR').replace(/_/g, ' ').toUpperCase();
    natureSummary = exp.operationNature || exp.transactionType || exp.categoryName || '';
    notesText = String(exp.notes || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\[ITENS_NFE:[\s\S]*?\]/g, '')
      .trim();
    totalAmount = Number(exp.amount) || 0;
    items = payload.items || [];
    installments = payload.installments || [];
  } else if (payload.kind === 'manual') {
    const doc = payload.doc;
    docTypeBadge = `ENTRADA MANUAL — ${(doc.tipo_documento || 'DOCUMENTO').toUpperCase()}`;
    docTitle = 'ESPELHO DE DOCUMENTO DE ENTRADA MANUAL';
    docNumber = doc.numero || doc.numero_documento || doc.id.slice(0, 8).toUpperCase();
    docSeries = doc.serie || '1';
    issueDate = doc.data_emissao || doc.data || doc.data_entrada || '';
    entryDate = doc.data_entrada || doc.data || issueDate;
    statusText = doc.status || 'FINALIZADO';
    enviarContador = doc.enviarContador;
    accessKey = doc.chave_acesso || '';

    partnerName = doc.fornecedor || doc.fornecedor_nome || 'FORNECEDOR NÃO INFORMADO';
    const matchedSup = findSupplierDetails(partnerName, doc.fornecedor_id);
    partnerCnpj = doc.fornecedor_cnpj || matchedSup?.cnpjOrCpf || '';
    partnerPhone = matchedSup?.phone || '';
    partnerAddress = [matchedSup?.address, matchedSup?.city, matchedSup?.state].filter(Boolean).join(' • ');

    vehicleLabel = doc.machineryName || doc.vehiclePlate || '';
    costCenterLabel = (doc as any).costCenterName || '';
    paymentSummary = doc.condicao_pagamento
      ? `${doc.condicao_pagamento.toUpperCase()}${doc.parcelas_qtd ? ` (${doc.parcelas_qtd}X)` : ''}`
      : 'NÃO INFORMADO';
    natureSummary = doc.natureza_operacao || doc.tipo_documento || '';
    notesText = doc.observacoes || '';
    totalAmount = Number(doc.valor_total) || 0;
    isLoadingItems = Boolean(payload.isLoadingItems);
    items = (payload.items || []).map((it) => ({
      code: it.codigo_produto || (it.produto_id ? it.produto_id.slice(0, 6).toUpperCase() : '-'),
      description: it.descricao || 'PRODUTO',
      ncm: it.ncm || '',
      cfop: (it as any).cfop || '',
      unit: (it.unidade || 'UN').toUpperCase(),
      quantity: Number(it.quantidade) || 0,
      unitPrice: Number(it.valor_unitario) || 0,
      totalPrice: Number(it.valor_total) || 0,
    }));
    installments = payload.installments || [];
  } else if (payload.kind === 'legacy') {
    const doc = payload.doc;
    docTypeBadge = (doc.documentTypeLabel || 'DOCUMENTO FISCAL').toUpperCase();
    docTitle = `ESPELHO FISCAL — ${docTypeBadge}`;
    docNumber = doc.number || doc.id.slice(0, 8).toUpperCase();
    docSeries = doc.series || '1';
    issueDate = doc.issueDate || '';
    entryDate = doc.issueDate || '';
    statusText = doc.status || 'CONFIRMADO';
    enviarContador = doc.enviarContador;

    partnerName = doc.supplierName || 'FORNECEDOR NÃO INFORMADO';
    const matchedSup = findSupplierDetails(doc.supplierName, doc.supplierId);
    partnerCnpj = doc.supplierCnpj || matchedSup?.cnpjOrCpf || '';
    partnerPhone = matchedSup?.phone || '';
    partnerAddress = [matchedSup?.address, matchedSup?.city, matchedSup?.state].filter(Boolean).join(' • ');

    vehicleLabel = [doc.vehiclePlate, doc.vehicleModel].filter(Boolean).join(' — ');
    paymentSummary = `${String(doc.paymentMethod || 'A COMBINAR').toUpperCase()} (${doc.installmentsCount || 1}X)`;
    natureSummary = doc.description || (doc.cfop ? `CFOP ${doc.cfop}` : '');
    notesText = doc.notes || '';
    totalAmount = Number(doc.totalAmount) || 0;
    items = (doc.items || []).map((it) => ({
      code: it.code || '-',
      description: it.description || 'ITEM',
      cfop: doc.cfop || '',
      unit: (it.unit || 'UN').toUpperCase(),
      quantity: Number(it.quantity) || 0,
      unitPrice: Number(it.unitPrice) || 0,
      totalPrice: Number(it.totalPrice) || 0,
    }));
    installments =
      payload.installments.length > 0
        ? payload.installments
        : (doc.installments || []).map((inst) => ({
            number: inst.number,
            dueDate: inst.dueDate,
            paymentMethod: doc.paymentMethod,
            amount: Number(inst.amount) || 0,
            status: inst.status,
          }));
  } else if (payload.kind === 'mdfe') {
    mdfeDoc = payload.doc;
    docTypeBadge = 'DAMDFE / MDF-E';
    docTitle = 'ESPELHO DE MANIFESTO ELETRÔNICO DE DOCUMENTOS FISCAIS';
    docNumber = mdfeDoc.numero || mdfeDoc.id.slice(0, 8).toUpperCase();
    docSeries = mdfeDoc.serie || '1';
    issueDate = mdfeDoc.dataEmissao || '';
    entryDate = mdfeDoc.dataEmissao || '';
    statusText = mdfeDoc.status || 'EMITIDO';
    enviarContador = (mdfeDoc as any).enviarContador;
    accessKey = mdfeDoc.chaveAcesso || '';

    partnerLabel = 'CONDUTOR & VEÍCULO DA OPERAÇÃO';
    partnerName = mdfeDoc.motoristaNome || 'MOTORISTA NÃO INFORMADO';
    partnerCnpj = mdfeDoc.motoristaCpf ? `CPF: ${mdfeDoc.motoristaCpf}` : '';
    vehicleLabel = [mdfeDoc.veiculoPlaca, mdfeDoc.veiculoTipo, mdfeDoc.veiculoRntrc ? `RNTRC ${mdfeDoc.veiculoRntrc}` : '']
      .filter(Boolean)
      .join(' • ');
    natureSummary = `${mdfeDoc.municipiosCarregamento || mdfeDoc.ufCarregamento} → ${mdfeDoc.municipiosDescarregamento || mdfeDoc.ufDescarregamento}`;
    notesText = mdfeDoc.observacoes || '';
    totalAmount = Number(mdfeDoc.valorTotalCarga) || 0;
  }

  const statusMeta = normalizeStatusBadge(statusText);
  const itemsSubtotal = items.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0);
  const resolvedTotal = totalAmount > 0 ? totalAmount : itemsSubtotal;
  const formattedKey = formatAccessKeyChunks(accessKey);

  const handlePrintA4 = () => {
    const itemsRowsHtml = mdfeDoc
      ? (mdfeDoc.documentosVinculados || []).length > 0
        ? (mdfeDoc.documentosVinculados || [])
            .map(
              (dv, idx) => `
          <tr>
            <td style="text-align:center;font-weight:bold;">${String(idx + 1).padStart(2, '0')}</td>
            <td style="text-align:center;font-family:monospace;font-weight:bold;">${escapeHtml(dv.tipo)} ${escapeHtml(dv.numero)}</td>
            <td style="font-weight:bold;">${escapeHtml(dv.emitente)}<br/><span style="font-size:8pt;font-family:monospace;color:#475569;">${escapeHtml(dv.chave)}</span></td>
            <td style="text-align:center;">-</td>
            <td style="text-align:center;">KG</td>
            <td style="text-align:right;font-family:monospace;">${Number(dv.pesoKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td style="text-align:right;font-family:monospace;">-</td>
            <td style="text-align:right;font-family:monospace;font-weight:bold;">${formatCurrencyBRL(dv.valor || 0)}</td>
          </tr>`
            )
            .join('')
        : `<tr><td colspan="8" style="text-align:center;padding:12px;">TRAJETO: ${escapeHtml(natureSummary)} • PESO BRUTO: ${Number(mdfeDoc.pesoBrutoTotalKg || 0).toLocaleString('pt-BR')} KG • VALOR DA CARGA: ${formatCurrencyBRL(resolvedTotal)}</td></tr>`
      : items.length > 0
      ? items
          .map(
            (it, idx) => `
          <tr>
            <td style="text-align:center;font-weight:bold;">${String(idx + 1).padStart(2, '0')}</td>
            <td style="text-align:center;font-family:monospace;">${escapeHtml(it.code || '-')}</td>
            <td style="font-weight:bold;">${escapeHtml(it.description)}</td>
            <td style="text-align:center;font-family:monospace;">${escapeHtml([it.ncm, it.cfop].filter(Boolean).join(' / ') || '-')}</td>
            <td style="text-align:center;">${escapeHtml(it.unit || 'UN')}</td>
            <td style="text-align:right;font-family:monospace;">${Number(it.quantity || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
            <td style="text-align:right;font-family:monospace;">${formatCurrencyBRL(it.unitPrice || 0)}</td>
            <td style="text-align:right;font-family:monospace;font-weight:bold;">${formatCurrencyBRL(it.totalPrice || 0)}</td>
          </tr>`
          )
          .join('')
      : `<tr>
          <td style="text-align:center;font-weight:bold;">01</td>
          <td style="text-align:center;font-family:monospace;">DOC</td>
          <td style="font-weight:bold;">${escapeHtml(natureSummary || docTypeBadge)} — ${escapeHtml(partnerName)}</td>
          <td style="text-align:center;">-</td>
          <td style="text-align:center;">UN</td>
          <td style="text-align:right;font-family:monospace;">1,00</td>
          <td style="text-align:right;font-family:monospace;">${formatCurrencyBRL(resolvedTotal)}</td>
          <td style="text-align:right;font-family:monospace;font-weight:bold;">${formatCurrencyBRL(resolvedTotal)}</td>
        </tr>`;

    const installmentsHtml =
      installments.length > 0
        ? `
      <div style="border:1px solid #0f172a;border-radius:4px;overflow:hidden;margin-bottom:12px;">
        <div style="background:#f1f5f9;border-bottom:1px solid #0f172a;padding:5px 8px;font-size:8.5pt;font-weight:900;text-transform:uppercase;">
          FATURA / DUPLICATAS E PARCELAMENTO FINANCEIRO (${installments.length})
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;padding:8px;">
          ${installments
            .map(
              (inst) => `
            <div style="border:1px solid #cbd5e1;border-radius:4px;padding:5px 8px;background:#f8fafc;font-size:8pt;">
              <div style="font-weight:900;color:#0f172a;">PARCELA ${escapeHtml(inst.number)} • <span style="color:#047857;">${escapeHtml(inst.status)}</span></div>
              <div style="font-size:9.5pt;font-weight:900;font-family:monospace;color:#0f172a;">${formatCurrencyBRL(inst.amount)}</div>
              <div style="color:#475569;">VENC: ${inst.dueDate ? formatDateBR(inst.dueDate) : '-'}${inst.paymentMethod ? ` • ${escapeHtml(inst.paymentMethod)}` : ''}</div>
            </div>`
            )
            .join('')}
        </div>
      </div>`
        : '';

    const accessKeyBlock = formattedKey
      ? `
      <div style="border:1px solid #0f172a;border-radius:4px;padding:6px 10px;margin-bottom:12px;background:#f8fafc;text-align:center;">
        ${buildBarcodeSvgHtml(accessKey)}
        <div style="font-size:7.5pt;font-weight:800;color:#475569;text-transform:uppercase;margin-top:3px;">CHAVE DE ACESSO</div>
        <div style="font-family:monospace;font-size:9pt;font-weight:900;letter-spacing:0.6px;color:#0f172a;">${escapeHtml(formattedKey)}</div>
      </div>`
      : '';

    const contentHtml = `
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;border:1.5px solid #0f172a;border-radius:4px;padding:8px 10px;margin-bottom:12px;background:#f8fafc;">
        <div>
          <div style="font-size:7.5pt;font-weight:900;color:#475569;text-transform:uppercase;">${escapeHtml(partnerLabel)}</div>
          <div style="font-size:11pt;font-weight:900;color:#0f172a;text-transform:uppercase;">${escapeHtml(partnerName)}</div>
          ${partnerCnpj ? `<div style="font-size:8.5pt;font-family:monospace;color:#334155;"><strong>CNPJ/CPF:</strong> ${escapeHtml(partnerCnpj)}</div>` : ''}
          ${partnerAddress ? `<div style="font-size:8pt;color:#475569;">${escapeHtml(partnerAddress)}</div>` : ''}
          ${partnerPhone ? `<div style="font-size:8pt;color:#475569;"><strong>FONE:</strong> ${escapeHtml(partnerPhone)}</div>` : ''}
        </div>
        <div style="border-left:1px solid #cbd5e1;padding-left:10px;font-size:8.5pt;">
          <div><strong>DOCUMENTO Nº:</strong> <span style="font-family:monospace;font-weight:900;">${escapeHtml(docNumber)}</span> (SÉRIE ${escapeHtml(docSeries)})</div>
          <div><strong>EMISSÃO:</strong> ${issueDate ? formatDateBR(issueDate) : '-'} &nbsp;|&nbsp; <strong>ENTRADA:</strong> ${entryDate ? formatDateBR(entryDate) : '-'}</div>
          <div><strong>SITUAÇÃO:</strong> <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-weight:900;background:${statusMeta.printBg};color:${statusMeta.printColor};">${escapeHtml(statusMeta.label)}</span></div>
          ${paymentSummary ? `<div><strong>PAGAMENTO:</strong> ${escapeHtml(paymentSummary)}</div>` : ''}
          ${vehicleLabel ? `<div><strong>FROTA/VEÍCULO:</strong> ${escapeHtml(vehicleLabel)}</div>` : ''}
          ${costCenterLabel ? `<div><strong>CENTRO DE CUSTO:</strong> ${escapeHtml(costCenterLabel)}</div>` : ''}
        </div>
      </div>

      ${accessKeyBlock}

      <div style="border:1.5px solid #0f172a;border-radius:4px;overflow:hidden;margin-bottom:12px;">
        <div style="background:#e2e8f0;border-bottom:1.5px solid #0f172a;padding:5px 8px;font-size:8.5pt;font-weight:900;text-transform:uppercase;">
          ${mdfeDoc ? 'DOCUMENTOS VINCULADOS / COMPOSIÇÃO DA CARGA' : `DISCRIMINAÇÃO DOS PRODUTOS / ITENS (${items.length || 1})`}
        </div>
        <table style="margin-bottom:0;border:none;">
          <thead>
            <tr>
              <th style="width:28px;text-align:center;">#</th>
              <th style="width:70px;text-align:center;">CÓD.</th>
              <th style="text-align:left;">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
              <th style="width:88px;text-align:center;">NCM / CFOP</th>
              <th style="width:38px;text-align:center;">UN</th>
              <th style="width:68px;text-align:right;">QTD.</th>
              <th style="width:88px;text-align:right;">VALOR UNIT.</th>
              <th style="width:94px;text-align:right;">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9;border-top:2px solid #0f172a;">
              <td colspan="7" style="text-align:right;font-weight:900;font-size:10pt;padding:8px;">VALOR TOTAL DO DOCUMENTO:</td>
              <td style="text-align:right;font-weight:900;font-size:11pt;font-family:monospace;color:#047857;padding:8px;">${formatCurrencyBRL(resolvedTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${installmentsHtml}

      ${
        notesText || natureSummary
          ? `<div style="border:1px solid #0f172a;border-radius:4px;padding:8px 10px;background:#f8fafc;font-size:8.5pt;">
              <div style="font-size:8pt;font-weight:900;text-transform:uppercase;color:#334155;margin-bottom:3px;">DADOS ADICIONAIS / OBSERVAÇÕES</div>
              ${natureSummary ? `<div><strong>NATUREZA / REF.:</strong> ${escapeHtml(natureSummary)}</div>` : ''}
              ${notesText ? `<div style="white-space:pre-line;margin-top:3px;">${escapeHtml(notesText)}</div>` : ''}
            </div>`
          : ''
      }
    `;

    const html = generatePrintableHtml({
      title: `${docTypeBadge} — Nº ${docNumber}`,
      subtitle: `${partnerName} • Emissão: ${issueDate ? formatDateBR(issueDate) : '-'}`,
      documentType: docTypeBadge,
      company: companyProfile || ({} as CompanyProfile),
      contentHtml,
      orientation: 'portrait',
      showSignatures: true,
      signatureLabels: ['Conferente / Recebimento', `Responsável (${subscriber.displayTitle})`],
    });
    executePrint(html);
  };

  return (
    <div
      id="modal-danfe-espelho-visualizador"
      className="fixed inset-0 z-70 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-[92vw] max-w-[1100px] max-h-[92vh] flex flex-col justify-start mx-auto my-auto bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-black dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOPO DO MODAL */}
        <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded bg-white dark:bg-stone-800 border border-black flex items-center justify-center shrink-0">
              {mdfeDoc ? (
                <Truck className="w-4 h-4 text-indigo-700" />
              ) : (
                <Receipt className="w-4 h-4 text-emerald-700" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-black dark:text-stone-100 truncate">
                  {docTitle}
                </h3>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${statusMeta.cls}`}
                >
                  {statusMeta.label}
                </span>
                {typeof enviarContador === 'boolean' && (
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                      enviarContador
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-500'
                        : 'bg-amber-100 text-amber-900 border-amber-500'
                    }`}
                  >
                    {enviarContador ? '📤 Contador' : '🔒 Interno'}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-bold text-black/75 dark:text-stone-400 uppercase truncate">
                {docTypeBadge} • Nº {docNumber} • SÉRIE {docSeries}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-black/10 dark:text-stone-300 dark:hover:bg-stone-800 cursor-pointer shrink-0"
            title="Fechar visualização"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FOLHA A4 VISUAL / DANFE */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-[#cad4e6] dark:bg-stone-950">
          <div className="bg-white text-black border-2 border-black rounded-lg shadow-md p-4 sm:p-5 space-y-3 text-xs">
            {/* 1. CABEÇALHO DANFE: EMITENTE RECEPTOR + QUADRO DO DOCUMENTO + CHAVE/BARRAS */}
            <div className="grid grid-cols-1 md:grid-cols-12 border-2 border-black rounded overflow-hidden">
              {/* Empresa / Destinatário (Assinante) */}
              <div className="md:col-span-5 p-3 border-b md:border-b-0 md:border-r-2 border-black flex items-start gap-3 bg-slate-50/70">
                <div className="w-14 h-14 rounded border border-black/40 bg-white flex items-center justify-center shrink-0 overflow-hidden p-1">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={subscriber.displayTitle}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-slate-700" />
                  )}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider">
                    EMPRESA / DESTINATÁRIO
                  </div>
                  <div className="font-black text-xs sm:text-sm uppercase text-black leading-tight">
                    {subscriber.displayTitle}
                  </div>
                  {subscriber.corporateName &&
                    subscriber.corporateName.toUpperCase() !== subscriber.displayTitle.toUpperCase() && (
                      <div className="text-[10px] font-bold text-slate-700 uppercase">
                        {subscriber.corporateName}
                      </div>
                    )}
                  {(subscriber.cnpjCpf || subscriber.stateRegistration) && (
                    <div className="text-[10px] font-mono text-slate-800">
                      {subscriber.cnpjCpf ? `CNPJ/CPF: ${subscriber.cnpjCpf}` : ''}
                      {subscriber.stateRegistration ? ` • IE: ${subscriber.stateRegistration}` : ''}
                    </div>
                  )}
                  {subscriber.fullAddress && (
                    <div className="text-[10px] text-slate-600 uppercase leading-snug">
                      {subscriber.fullAddress}
                    </div>
                  )}
                  {subscriber.phone && (
                    <div className="text-[10px] text-slate-700 font-semibold">
                      FONE: {subscriber.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Quadro Central: Tipo, Nº, Série, Emissão */}
              <div className="md:col-span-3 p-3 border-b md:border-b-0 md:border-r-2 border-black flex flex-col justify-center items-center text-center bg-white">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-white mb-1">
                  {docTypeBadge}
                </span>
                <div className="text-base font-black font-mono text-black">
                  Nº {docNumber}
                </div>
                <div className="text-[10px] font-bold text-slate-700 uppercase">
                  SÉRIE: {docSeries}
                </div>
                <div className="mt-1.5 pt-1.5 border-t border-slate-300 w-full grid grid-cols-2 gap-1 text-[10px]">
                  <div>
                    <span className="block text-[9px] text-slate-500 font-bold">EMISSÃO</span>
                    <span className="font-mono font-bold">{issueDate ? formatDateBR(issueDate) : '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-slate-500 font-bold">ENTRADA</span>
                    <span className="font-mono font-bold">{entryDate ? formatDateBR(entryDate) : '-'}</span>
                  </div>
                </div>
              </div>

              {/* Chave de Acesso & Código de Barras */}
              <div className="md:col-span-4 p-3 flex flex-col justify-center bg-slate-50/70">
                <div className="text-[9px] font-black uppercase text-slate-500 mb-1 text-center">
                  CONTROLE DE CHAVE / AUTENTICAÇÃO FISCAL
                </div>
                <div
                  className="py-1 flex justify-center"
                  dangerouslySetInnerHTML={{
                    __html: buildBarcodeSvgHtml(accessKey || docNumber),
                  }}
                />
                {formattedKey ? (
                  <div className="mt-1 p-1.5 bg-white border border-slate-300 rounded font-mono text-[10px] font-bold text-center break-all tracking-wide text-slate-900">
                    {formattedKey}
                  </div>
                ) : (
                  <div className="mt-1 text-center font-mono text-[10px] font-bold text-slate-600 uppercase">
                    DOCUMENTO INTERNO / SEM CHAVE XML 44 DÍGITOS
                  </div>
                )}
              </div>
            </div>

            {/* 2. DADOS DO FORNECEDOR / EMITENTE & VÍNCULOS OPERACIONAIS */}
            <div className="border border-black rounded overflow-hidden">
              <div className="px-3 py-1 bg-slate-200 border-b border-black text-[10px] font-black uppercase tracking-wider text-black">
                {partnerLabel} &amp; PARÂMETROS DA OPERAÇÃO
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-white">
                <div className="sm:col-span-6 space-y-0.5">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">
                    RAZÃO SOCIAL / NOME
                  </span>
                  <span className="font-black text-xs sm:text-sm uppercase text-black block">
                    {partnerName}
                  </span>
                  {partnerCnpj && (
                    <span className="text-[11px] font-mono text-slate-700 block">
                      CNPJ/CPF: {partnerCnpj}
                    </span>
                  )}
                  {(partnerAddress || partnerPhone) && (
                    <span className="text-[10px] text-slate-600 uppercase block">
                      {[partnerAddress, partnerPhone ? `FONE: ${partnerPhone}` : '']
                        .filter(Boolean)
                        .join(' • ')}
                    </span>
                  )}
                </div>

                <div className="sm:col-span-3 space-y-1">
                  {natureSummary && (
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-500 block">
                        NATUREZA / FINALIDADE
                      </span>
                      <span className="font-bold uppercase text-black block">{natureSummary}</span>
                    </div>
                  )}
                  {paymentSummary && (
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-500 block">
                        CONDIÇÃO DE PAGAMENTO
                      </span>
                      <span className="font-bold uppercase text-black block">{paymentSummary}</span>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-3 space-y-1">
                  {vehicleLabel && (
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-500 block">
                        VEÍCULO / FROTA (DRE)
                      </span>
                      <span className="font-black uppercase text-indigo-800 block">
                        {vehicleLabel}
                      </span>
                    </div>
                  )}
                  {costCenterLabel && (
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-500 block">
                        CENTRO DE CUSTO
                      </span>
                      <span className="font-bold uppercase text-black block">{costCenterLabel}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] font-bold uppercase text-slate-500 block">
                      VALOR TOTAL
                    </span>
                    <span className="font-mono font-black text-sm text-emerald-800">
                      {formatCurrencyBRL(resolvedTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. TABELA DE PRODUTOS / ITENS (OU DOCUMENTOS VINCULADOS MDF-E) */}
            <div className="border border-black rounded overflow-hidden">
              <div className="px-3 py-1.5 bg-slate-200 border-b border-black flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-black">
                <span>
                  {mdfeDoc
                    ? `DOCUMENTOS VINCULADOS / CARGA (${mdfeDoc.documentosVinculados?.length || 0})`
                    : `DADOS DOS PRODUTOS / SERVIÇOS (${items.length || 1})`}
                </span>
                <span className="font-mono">
                  TOTAL: {formatCurrencyBRL(resolvedTotal)}
                </span>
              </div>

              {isLoadingItems ? (
                <div className="p-5 text-center text-xs text-slate-600 flex items-center justify-center space-x-2">
                  <Clock className="w-4 h-4 animate-spin text-emerald-700" />
                  <span>Carregando itens do documento...</span>
                </div>
              ) : mdfeDoc ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black text-[10px] font-black uppercase">
                        <th className="py-1.5 px-2 w-16 text-center">TIPO</th>
                        <th className="py-1.5 px-2 w-24 text-center">NÚMERO</th>
                        <th className="py-1.5 px-2">EMITENTE / CHAVE DE ACESSO</th>
                        <th className="py-1.5 px-2 text-right w-24">PESO (KG)</th>
                        <th className="py-1.5 px-2 text-right w-28">VALOR (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {mdfeDoc.documentosVinculados && mdfeDoc.documentosVinculados.length > 0 ? (
                        mdfeDoc.documentosVinculados.map((dv, idx) => (
                          <tr key={`mdfe_dv_${idx}`} className="even:bg-slate-50">
                            <td className="py-1.5 px-2 text-center font-bold">{dv.tipo}</td>
                            <td className="py-1.5 px-2 text-center font-mono font-bold">{dv.numero}</td>
                            <td className="py-1.5 px-2">
                              <div className="font-bold uppercase">{dv.emitente}</div>
                              <div className="font-mono text-[10px] text-slate-500 break-all">{dv.chave}</div>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono">
                              {Number(dv.pesoKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold">
                              {formatCurrencyBRL(dv.valor || 0)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-3 px-3 text-center text-slate-700 font-semibold">
                            ROTA: <strong>{natureSummary}</strong> • QTD CT-e: {mdfeDoc.qtdCte || 0} • QTD NF-e: {mdfeDoc.qtdNfe || 0} • PESO BRUTO: {Number(mdfeDoc.pesoBrutoTotalKg || 0).toLocaleString('pt-BR')} KG
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black text-[10px] font-black uppercase">
                        <th className="py-1.5 px-2 w-8 text-center">#</th>
                        <th className="py-1.5 px-2 w-20 text-center">CÓDIGO</th>
                        <th className="py-1.5 px-2">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                        <th className="py-1.5 px-2 w-24 text-center">NCM / CFOP</th>
                        <th className="py-1.5 px-2 w-14 text-center">UN</th>
                        <th className="py-1.5 px-2 w-20 text-right">QTD.</th>
                        <th className="py-1.5 px-2 w-28 text-right">VALOR UNIT.</th>
                        <th className="py-1.5 px-2 w-28 text-right">SUBTOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.length > 0 ? (
                        items.map((it, idx) => (
                          <tr key={`danfe_item_${idx}`} className="even:bg-slate-50">
                            <td className="py-1.5 px-2 text-center font-mono font-bold text-slate-600">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-slate-700">
                              {it.code || '-'}
                            </td>
                            <td className="py-1.5 px-2 font-bold uppercase text-black">
                              {it.description}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-[10px] text-slate-600">
                              {[it.ncm, it.cfop].filter(Boolean).join(' / ') || '-'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-semibold uppercase">
                              {it.unit || 'UN'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold">
                              {Number(it.quantity || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 4,
                              })}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono">
                              {formatCurrencyBRL(it.unitPrice || 0)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-black text-emerald-800">
                              {formatCurrencyBRL(it.totalPrice || 0)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-600">01</td>
                          <td className="py-2 px-2 text-center font-mono text-slate-600">DOC</td>
                          <td className="py-2 px-2 font-bold uppercase text-black">
                            {natureSummary || docTypeBadge} — {partnerName}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-slate-500">-</td>
                          <td className="py-2 px-2 text-center font-semibold">UN</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">1,00</td>
                          <td className="py-2 px-2 text-right font-mono">
                            {formatCurrencyBRL(resolvedTotal)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-black text-emerald-800">
                            {formatCurrencyBRL(resolvedTotal)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-black font-black">
                        <td colSpan={7} className="py-2 px-3 text-right uppercase text-xs">
                          VALOR TOTAL DO DOCUMENTO:
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-sm text-emerald-800">
                          {formatCurrencyBRL(resolvedTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 4. PARCELAS FINANCEIRAS / DUPLICATAS */}
            {installments.length > 0 && (
              <div className="border border-black rounded overflow-hidden">
                <div className="px-3 py-1 bg-slate-200 border-b border-black text-[10px] font-black uppercase tracking-wider text-black">
                  DUPLICATAS / PARCELAS FINANCEIRAS ({installments.length})
                </div>
                <div className="p-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 bg-white">
                  {installments.map((inst, idx) => {
                    const instBadge = normalizeStatusBadge(inst.status);
                    return (
                      <div
                        key={`danfe_inst_${idx}`}
                        className="p-2 rounded border border-slate-300 bg-slate-50 space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-black text-slate-800">
                            PARC. {inst.number}
                          </span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded border uppercase ${instBadge.cls}`}
                          >
                            {instBadge.label}
                          </span>
                        </div>
                        <div className="font-mono font-black text-xs text-emerald-800">
                          {formatCurrencyBRL(inst.amount)}
                        </div>
                        <div className="text-[10px] text-slate-600 font-semibold">
                          Venc: {inst.dueDate ? formatDateBR(inst.dueDate) : '-'}
                        </div>
                        {inst.paymentMethod && (
                          <div className="text-[9px] text-slate-500 uppercase truncate">
                            {inst.paymentMethod}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. DADOS ADICIONAIS / OBSERVAÇÕES */}
            {notesText && (
              <div className="border border-black rounded overflow-hidden">
                <div className="px-3 py-1 bg-slate-200 border-b border-black text-[10px] font-black uppercase tracking-wider text-black">
                  DADOS ADICIONAIS / OBSERVAÇÕES DO DOCUMENTO
                </div>
                <div className="p-3 bg-white text-[11px] text-slate-800 whitespace-pre-line leading-relaxed uppercase">
                  {notesText}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ DE AÇÕES */}
        <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div>
            {onDelete && (
              <button
                type="button"
                id="btn-danfe-modal-excluir"
                onClick={onDelete}
                className="px-3.5 py-1.5 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-600 rounded-lg transition cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteLabel || 'Excluir'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-danfe-modal-imprimir"
              onClick={handlePrintA4}
              className="px-4 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 border border-black rounded-lg transition cursor-pointer flex items-center space-x-1.5 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Documento</span>
            </button>

            {onEdit && (
              <button
                type="button"
                id="btn-danfe-modal-editar"
                onClick={onEdit}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-800 rounded-lg transition cursor-pointer flex items-center space-x-1.5 shadow-2xs"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{editLabel || 'Editar'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-black dark:text-stone-300 bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 border border-black rounded-lg transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
