import { CompanyProfile, TrocaDevolucaoRecord } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredCompanyProfile } from '../../lib/storage';
import { COMPANY_LOGO_REF, resolveMediaUrlAsync } from '../../lib/imageStorage';
import {
  resolveSubscriberPrintHeader,
  buildSystemPrintFooterHtml,
  buildSystemPrintFooterText,
  formatSystemSupportPhoneMask,
} from '../../lib/printIdentity';
import { executePrint } from '../../lib/printService';
import {
  buildDanfeOficialNfeHtml,
  buildDeterministicChave44,
  resolveDestinatarioDanfe,
} from '../../lib/danfeOficialHtml';

function escapeHtml(raw?: string | null): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCnpjCpfDisplay(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return trimmed;
}

function formatPhoneDisplay(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 11) {
    return formatSystemSupportPhoneMask(digits);
  }
  return trimmed;
}

function formatZipDisplay(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 8) {
    return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }
  return trimmed;
}

export function getTipoOperacaoLabel(tipo: TrocaDevolucaoRecord['tipoOperacao']): string {
  switch (tipo) {
    case 'troca_direta':
      return 'TROCA DIRETA POR OUTRO PRODUTO';
    case 'devolucao_cliente':
      return 'DEVOLUÇÃO DE CLIENTE';
    case 'devolucao_fornecedor':
      return 'DEVOLUÇÃO PARA FORNECEDOR (GARANTIA / DEFEITO)';
    default:
      return String(tipo || '').toUpperCase();
  }
}

async function resolveActiveCompanyAndLogo(companyProfile?: CompanyProfile | null) {
  const stored = getStoredCompanyProfile();
  const company = companyProfile || stored;
  const header = resolveSubscriberPrintHeader(company);
  const logoDataUrl =
    (await resolveMediaUrlAsync(header.logoUrl || company?.logoUrl)) ||
    (await resolveMediaUrlAsync(COMPANY_LOGO_REF)) ||
    '';

  const pickField = (...keys: string[]): string => {
    const passed = (companyProfile || {}) as Record<string, any>;
    const storedObj = (stored || {}) as Record<string, any>;
    for (const k of keys) {
      if (typeof passed[k] === 'string' && passed[k].trim()) return passed[k].trim();
    }
    for (const k of keys) {
      if (typeof storedObj[k] === 'string' && storedObj[k].trim()) return storedObj[k].trim();
    }
    return '';
  };

  const rawAddress = pickField('address', 'endereco', 'street', 'logradouro');
  const rawNumber = pickField('number', 'numero');
  const rawNeighborhood = pickField('neighborhood', 'bairro');
  const rawCity = pickField('city', 'cidade');
  const rawState = pickField('state', 'estado', 'uf');
  const rawZip = formatZipDisplay(pickField('zipCode', 'cep'));

  const streetPart = rawAddress ? `${rawAddress}${rawNumber ? `, ${rawNumber}` : ''}` : '';
  const cityStatePart = rawCity ? `${rawCity}${rawState ? `/${rawState}` : ''}` : rawState;
  const formattedAddress =
    [
      streetPart,
      rawNeighborhood,
      cityStatePart,
      rawZip ? `CEP: ${rawZip}` : '',
    ]
      .filter(Boolean)
      .join(' - ') || header.fullAddress;

  return {
    companyName: header.corporateName || header.displayTitle,
    tradeName: header.tradeName,
    cnpj: formatCnpjCpfDisplay(header.cnpjCpf),
    stateRegistration: header.stateRegistration,
    phone: formatPhoneDisplay(header.phone),
    email: header.email,
    fullAddress: formattedAddress,
    street: streetPart,
    neighborhood: rawNeighborhood,
    city: rawCity,
    state: rawState,
    zipCode: rawZip,
    logoDataUrl,
    ambienteSefaz: company?.ambienteSefaz ?? stored?.ambienteSefaz ?? 'homologacao',
  };
}

export async function buildTrocaDevolucaoA4Html(
  record: TrocaDevolucaoRecord,
  companyProfile?: CompanyProfile | null,
  options?: { isEspelhoFiscal?: boolean; isPreview?: boolean }
): Promise<string> {
  const isEspelhoFiscal = Boolean(options?.isEspelhoFiscal);
  const isPreview = Boolean(options?.isPreview);
  const { companyName, tradeName, cnpj, phone, email, fullAddress, logoDataUrl } =
    await resolveActiveCompanyAndLogo(companyProfile);

  const tipoLabel = getTipoOperacaoLabel(record.tipoOperacao);
  const dataEmissaoBR = formatDateBR(record.data);
  const geradoEm = new Date().toLocaleString('pt-BR');

  const logoBlock = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Logo" style="max-height: 58px; max-width: 140px; object-fit: contain; border-radius: 4px;" />`
    : `<div style="width: 58px; height: 58px; border: 1.5px solid #0f172a; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16pt; color: #059669; background: #ecfdf5;">AC</div>`;

  const returnedRowsHtml = record.itensDevolvidos
    .map(
      (item, idx) => `
      <tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 8.5pt;">${escapeHtml(item.productCode || '—')}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">${escapeHtml(item.productName)}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${item.quantity.toLocaleString('pt-BR')} ${escapeHtml(item.unit || 'UN')}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${escapeHtml(formatCurrencyBRL(item.unitPrice))}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 800;">${escapeHtml(formatCurrencyBRL(item.totalPrice))}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-size: 8pt; font-weight: 700; color: ${item.returnToStock !== false ? '#047857' : '#b45309'};">
          ${
            record.tipoOperacao === 'devolucao_fornecedor'
              ? item.returnToStock !== false
                ? 'Baixado do Estoque'
                : 'Fora de Estoque'
              : item.returnToStock !== false
                ? 'Retornou ao Estoque'
                : 'Avaria / Quarentena'
          }
        </td>
      </tr>`
    )
    .join('');

  const exchangedSectionHtml =
    record.itensLevados && record.itensLevados.length > 0
      ? `
      <div style="margin-top: 14px;">
        <div style="background: #1e293b; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 5px 10px; border-radius: 4px 4px 0 0; letter-spacing: 0.5px;">
          3. Produtos Levados na Troca (${record.itensLevados.length} ${record.itensLevados.length === 1 ? 'item' : 'itens'})
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
          <thead>
            <tr style="background: #e2e8f0; color: #0f172a;">
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 14%;">Código</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Produto / Descrição</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 14%;">Qtd.</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 16%;">Unitário</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 16%;">Subtotal</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 16%;">Movimentação</th>
            </tr>
          </thead>
          <tbody>
            ${record.itensLevados
              .map(
                (item, idx) => `
              <tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 8.5pt;">${escapeHtml(item.productCode || '—')}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">${escapeHtml(item.productName)}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${item.quantity.toLocaleString('pt-BR')} ${escapeHtml(item.unit || 'UN')}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${escapeHtml(formatCurrencyBRL(item.unitPrice))}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 800;">${escapeHtml(formatCurrencyBRL(item.totalPrice))}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-size: 8pt; font-weight: 700; color: #0369a1;">Baixado do Estoque</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
      : '';

  const valeCreditoBoxHtml =
    record.destinoFinanceiro === 'vale_credito' && (record.valeCreditoValor || 0) > 0
      ? `
      <div style="margin-top: 14px; border: 2px dashed #059669; background: #ecfdf5; border-radius: 6px; padding: 12px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <div style="font-size: 8pt; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.6px;">
              Vale-Crédito / Vale-Troca Oficial
            </div>
            <div style="font-size: 10pt; font-weight: 800; color: #0f172a; margin-top: 2px;">
              Titular: ${escapeHtml(record.envolvidoNome)}
            </div>
            <div style="font-size: 8pt; color: #334155; margin-top: 2px;">
              Protocolo de Origem: <strong>${escapeHtml(record.protocolo)}</strong> • Válido para abatimento em compras futuras no balcão/PDV.
            </div>
          </div>
          <div style="text-align: right; background: #059669; color: #ffffff; padding: 8px 14px; border-radius: 6px; min-width: 150px;">
            <div style="font-size: 7pt; font-weight: 700; text-transform: uppercase; opacity: 0.9;">Crédito Disponível</div>
            <div style="font-size: 15pt; font-weight: 900; letter-spacing: 0.3px;">${escapeHtml(formatCurrencyBRL(record.valeCreditoValor || 0))}</div>
          </div>
        </div>
      </div>`
      : '';

  const boletoAbatidoBoxHtml = record.boletoAbatido
    ? `
      <div style="margin-top: 14px; border: 1.5px solid #0f766e; background: #f0fdfa; border-radius: 6px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #99f6e4; padding-bottom: 6px; margin-bottom: 8px;">
          <div style="font-size: 8.5pt; font-weight: 900; color: #115e59; text-transform: uppercase;">
            Abatimento em Boleto / Parcela do Fornecedor (Contas a Pagar)
          </div>
          <div style="background: #0f766e; color: #ffffff; font-size: 7.5pt; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
            ${escapeHtml(record.boletoAbatido.statusResultante)}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 8.5pt;">
          <div>
            <div style="font-size: 7.5pt; font-weight: 700; color: #0f766e; text-transform: uppercase;">Documento / NF</div>
            <div style="font-weight: 800; color: #0f172a;">${escapeHtml(record.boletoAbatido.documento || '—')}</div>
          </div>
          <div>
            <div style="font-size: 7.5pt; font-weight: 700; color: #0f766e; text-transform: uppercase;">Vencimento</div>
            <div style="font-weight: 800; color: #0f172a;">${escapeHtml(record.boletoAbatido.vencimento ? formatDateBR(record.boletoAbatido.vencimento) : '—')}</div>
          </div>
          <div>
            <div style="font-size: 7.5pt; font-weight: 700; color: #0f766e; text-transform: uppercase;">Valor Abatido</div>
            <div style="font-weight: 900; color: #0f172a;">${escapeHtml(formatCurrencyBRL(record.boletoAbatido.valorAbatido))}</div>
          </div>
          <div>
            <div style="font-size: 7.5pt; font-weight: 700; color: #0f766e; text-transform: uppercase;">Saldo Restante</div>
            <div style="font-weight: 900; color: #0f172a;">${escapeHtml(formatCurrencyBRL(record.boletoAbatido.saldoRestante))}</div>
          </div>
        </div>
      </div>`
    : '';

  const fiscalBoxHtml =
    record.fiscalStatus || record.notaDevolucaoNumber || record.justificativaDescarte
      ? `
      <div style="margin-top: 14px; border: 1.5px solid ${
        record.fiscalStatus === 'Nota de Devolução Emitida'
          ? '#059669'
          : record.fiscalStatus === 'Descartado pela Empresa'
            ? '#475569'
            : '#d97706'
      }; background: ${
        record.fiscalStatus === 'Nota de Devolução Emitida'
          ? '#ecfdf5'
          : record.fiscalStatus === 'Descartado pela Empresa'
            ? '#f8fafc'
            : '#fffbeb'
      }; border-radius: 6px; padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(15,23,42,0.12); padding-bottom: 5px; margin-bottom: 6px;">
          <div style="font-size: 8.5pt; font-weight: 900; color: #0f172a; text-transform: uppercase;">
            Controle Fiscal / Nota de Devolução
          </div>
          <div style="background: ${
            record.fiscalStatus === 'Nota de Devolução Emitida'
              ? '#059669'
              : record.fiscalStatus === 'Descartado pela Empresa'
                ? '#475569'
                : '#d97706'
          }; color: #ffffff; font-size: 7.5pt; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
            ${escapeHtml(record.fiscalStatus || 'Aguardando Decisão Fiscal')}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 8.5pt;">
          <div>
            <span style="font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase; display: block;">Nº NF-e de Devolução Emitida</span>
            <strong style="font-family: monospace; font-size: 9.5pt;">${escapeHtml(record.notaDevolucaoNumber || '—')}</strong>
          </div>
          <div>
            <span style="font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase; display: block;">NF-e / Venda de Origem</span>
            <strong style="font-family: monospace;">${escapeHtml(record.numeroVendaOuNotaOrigem || '—')}</strong>
          </div>
          ${
            record.notaDevolucaoChave
              ? `<div style="grid-column: span 2;">
                  <span style="font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase; display: block;">Chave de Acesso da NF-e de Devolução</span>
                  <strong style="font-family: monospace; font-size: 8pt; word-break: break-all;">${escapeHtml(record.notaDevolucaoChave)}</strong>
                </div>`
              : ''
          }
          ${
            record.justificativaDescarte
              ? `<div style="grid-column: span 2;">
                  <span style="font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase; display: block;">Justificativa do Descarte / Perda</span>
                  <strong>${escapeHtml(record.justificativaDescarte)}</strong>
                </div>`
              : ''
          }
        </div>
      </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${isEspelhoFiscal ? 'Espelho Fiscal de Devolução' : 'Comprovante'} ${escapeHtml(record.protocolo)} — Troca e Devolução</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9pt;
      line-height: 1.4;
    }
    .sheet {
      max-width: 190mm;
      margin: 0 auto;
      padding: 4px;
    }
    .no-print {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
      padding: 10px 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 12px;
    }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="background: #059669; color: #ffffff; border: none; padding: 7px 16px; border-radius: 5px; font-weight: 800; font-size: 12px; cursor: pointer;">
      🖨️ IMPRIMIR COMPROVANTE A4
    </button>
    <button onclick="window.close()" style="background: #e2e8f0; color: #0f172a; border: 1px solid #94a3b8; padding: 7px 14px; border-radius: 5px; font-weight: 700; font-size: 12px; cursor: pointer;">
      FECHAR
    </button>
  </div>

  <div class="sheet">
    <!-- CABEÇALHO EMPRESARIAL -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; gap: 14px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${logoBlock}
        <div>
          <div style="font-size: 13pt; font-weight: 900; color: #0f172a; text-transform: uppercase;">${escapeHtml(tradeName)}</div>
          ${companyName !== tradeName ? `<div style="font-size: 8.5pt; font-weight: 700; color: #334155;">${escapeHtml(companyName)}</div>` : ''}
          ${cnpj ? `<div style="font-size: 8pt; color: #475569;"><strong>CNPJ/CPF:</strong> ${escapeHtml(cnpj)} ${phone ? `&nbsp;|&nbsp; <strong>Tel:</strong> ${escapeHtml(phone)}` : ''}</div>` : ''}
          ${fullAddress ? `<div style="font-size: 7.5pt; color: #475569;">${escapeHtml(fullAddress)}</div>` : ''}
          ${email ? `<div style="font-size: 7.5pt; color: #475569;">${escapeHtml(email)}</div>` : ''}
        </div>
      </div>
      <div style="text-align: right; min-width: 190px;">
        <div style="font-size: 7.5pt; font-weight: 800; color: #475569; text-transform: uppercase;">Nº DO PROTOCOLO</div>
        <div style="display: inline-block; background: #0f172a; color: #ffffff; font-family: monospace; font-size: 12pt; font-weight: 900; padding: 4px 12px; border-radius: 4px; margin-top: 2px; letter-spacing: 0.8px;">
          ${escapeHtml(record.protocolo)}
        </div>
        <div style="font-size: 8pt; color: #475569; margin-top: 4px;">
          <strong>Data:</strong> ${escapeHtml(dataEmissaoBR)}
        </div>
      </div>
    </div>

    <!-- TÍTULO E CLASSIFICAÇÃO -->
    <div style="background: #e0e6f1; border: 1.5px solid #0f172a; border-radius: 5px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 7.5pt; font-weight: 800; color: #334155; text-transform: uppercase;">
          ${isEspelhoFiscal ? 'ESPELHO FISCAL DE DEVOLUÇÃO DE MERCADORIAS / GARANTIA' : 'COMPROVANTE OFICIAL DE OPERAÇÃO'}
        </div>
        <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">${escapeHtml(tipoLabel)}</div>
      </div>
      <div style="text-align: right; font-size: 8pt;">
        <div><strong>Motivo:</strong> ${escapeHtml(record.motivo)}</div>
        ${record.operador ? `<div><strong>Operador:</strong> ${escapeHtml(record.operador)}</div>` : ''}
      </div>
    </div>

    <!-- QUADRO 1: DADOS DO ENVOLVIDO -->
    <div style="background: #1e293b; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 5px 10px; border-radius: 4px 4px 0 0; letter-spacing: 0.5px;">
      1. Identificação do ${record.envolvidoTipo === 'fornecedor' ? 'Fornecedor' : 'Cliente'} e Origem
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 8.5pt;">
      <tbody>
        <tr>
          <td style="width: 20%; background: #f8fafc; font-weight: 700; padding: 6px 8px; border: 1px solid #cbd5e1;">${record.envolvidoTipo === 'fornecedor' ? 'Fornecedor:' : 'Cliente:'}</td>
          <td style="width: 45%; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 800; text-transform: uppercase;">${escapeHtml(record.envolvidoNome)}</td>
          <td style="width: 15%; background: #f8fafc; font-weight: 700; padding: 6px 8px; border: 1px solid #cbd5e1;">CPF / CNPJ:</td>
          <td style="width: 20%; padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace;">${escapeHtml(record.envolvidoDocumento || 'Não informado')}</td>
        </tr>
        <tr>
          <td style="background: #f8fafc; font-weight: 700; padding: 6px 8px; border: 1px solid #cbd5e1;">Telefone:</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${escapeHtml(record.envolvidoTelefone || 'Não informado')}</td>
          <td style="background: #f8fafc; font-weight: 700; padding: 6px 8px; border: 1px solid #cbd5e1;">Venda / NF Origem:</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">${escapeHtml(record.numeroVendaOuNotaOrigem || 'Não informada')}</td>
        </tr>
        ${
          record.observacoes
            ? `<tr>
                <td style="background: #f8fafc; font-weight: 700; padding: 6px 8px; border: 1px solid #cbd5e1;">Observações:</td>
                <td colspan="3" style="padding: 6px 8px; border: 1px solid #cbd5e1;">${escapeHtml(record.observacoes)}</td>
              </tr>`
            : ''
        }
      </tbody>
    </table>

    <!-- QUADRO 2: PRODUTOS DEVOLVIDOS -->
    <div style="background: #1e293b; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 5px 10px; border-radius: 4px 4px 0 0; letter-spacing: 0.5px;">
      2. Produtos Devolvidos (${record.itensDevolvidos.length} ${record.itensDevolvidos.length === 1 ? 'item' : 'itens'})
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
      <thead>
        <tr style="background: #e2e8f0; color: #0f172a;">
          <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; width: 14%;">Código</th>
          <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Produto / Descrição</th>
          <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 14%;">Qtd.</th>
          <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 16%;">Unitário</th>
          <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; width: 16%;">Subtotal</th>
          <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; width: 18%;">Estoque</th>
        </tr>
      </thead>
      <tbody>
        ${returnedRowsHtml}
      </tbody>
    </table>

    ${exchangedSectionHtml}

    <!-- RESUMO FINANCEIRO -->
    <div style="margin-top: 14px; border: 1.5px solid #0f172a; border-radius: 5px; overflow: hidden;">
      <div style="background: #f1f5f9; padding: 6px 10px; font-weight: 800; font-size: 8.5pt; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">
        Resumo Financeiro da Operação
      </div>
      <div style="display: flex; justify-content: space-between; padding: 10px 12px; gap: 12px; font-size: 9pt;">
        <div>
          <div style="color: #475569; font-size: 8pt;">Total Devolvido</div>
          <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">${escapeHtml(formatCurrencyBRL(record.totalDevolvido))}</div>
        </div>
        ${
          record.tipoOperacao === 'troca_direta'
            ? `<div>
                <div style="color: #475569; font-size: 8pt;">Total Levado na Troca</div>
                <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">${escapeHtml(formatCurrencyBRL(record.totalLevado))}</div>
              </div>
              <div>
                <div style="color: #475569; font-size: 8pt;">Saldo / Diferença</div>
                <div style="font-size: 11pt; font-weight: 900; color: ${record.saldoFinal > 0 ? '#0369a1' : '#047857'};">
                  ${escapeHtml(formatCurrencyBRL(Math.abs(record.saldoFinal)))}
                </div>
              </div>`
            : ''
        }
        <div style="text-align: right;">
          <div style="color: #475569; font-size: 8pt;">Destino Financeiro</div>
          <div style="font-size: 10pt; font-weight: 900; color: #0f172a;">${escapeHtml(record.destinoFinanceiroLabel)}</div>
          ${record.formaPagamentoDiferenca ? `<div style="font-size: 8pt; color: #334155;">Forma: ${escapeHtml(record.formaPagamentoDiferenca)}</div>` : ''}
        </div>
      </div>
    </div>

    ${valeCreditoBoxHtml}
    ${boletoAbatidoBoxHtml}
    ${fiscalBoxHtml}

    <!-- DECLARAÇÃO E ASSINATURAS -->
    <div style="margin-top: 18px; font-size: 8pt; color: #475569; text-align: justify;">
      Declaramos para os devidos fins que os itens acima discriminados foram devidamente conferidos no ato da operação de troca/devolução sob protocolo <strong>${escapeHtml(record.protocolo)}</strong>, com regularização do saldo financeiro e de estoque conforme descrito neste documento.
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 38px;">
      <div style="text-align: center;">
        <div style="border-top: 1px solid #0f172a; padding-top: 5px; font-size: 8.5pt; font-weight: 700;">
          ${escapeHtml(tradeName)}
        </div>
        <div style="font-size: 7.5pt; color: #475569;">Responsável / Empresa</div>
      </div>
      <div style="text-align: center;">
        <div style="border-top: 1px solid #0f172a; padding-top: 5px; font-size: 8.5pt; font-weight: 700;">
          ${escapeHtml(record.envolvidoNome)}
        </div>
        <div style="font-size: 7.5pt; color: #475569;">${record.envolvidoTipo === 'fornecedor' ? 'Fornecedor / Portador' : 'Cliente / Portador'}</div>
      </div>
    </div>

    ${buildSystemPrintFooterHtml({ extraRight: `Protocolo ${record.protocolo}` })}
  </div>
  ${
    isPreview
      ? `<style>body { padding: 14px; background: #f8fafc; } .sheet, .print-wrapper { background: #fff; padding: 14px; border: 1px solid #cbd5e1; border-radius: 6px; }</style>`
      : `<script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    });
  </script>`
  }
</body>
</html>`;

  return isPreview
    ? html.replace(
        '<body>',
        `<body><div style="background:#fef3c7;border:1.5px solid #92400e;color:#78350f;padding:7px 12px;margin-bottom:10px;border-radius:6px;font-family:Arial,sans-serif;font-size:11px;font-weight:800;text-align:center;">👁️ PRÉ-VISUALIZAÇÃO DO COMPROVANTE INTERNO (NÃO FISCAL) — DOCUMENTO AINDA NÃO SALVO E SEM MOVIMENTAÇÃO DE ESTOQUE</div>`
      )
    : html;
}

export async function printTrocaDevolucaoA4(
  record: TrocaDevolucaoRecord,
  companyProfile?: CompanyProfile | null,
  options?: { isEspelhoFiscal?: boolean }
): Promise<boolean> {
  const html = await buildTrocaDevolucaoA4Html(record, companyProfile, {
    ...options,
    isPreview: false,
  });
  executePrint(html);
  return true;
}

export async function printEspelhoFiscalDevolucaoA4(
  record: TrocaDevolucaoRecord,
  companyProfile?: CompanyProfile | null
): Promise<boolean> {
  if (
    record.fiscalStatus === 'NF-e Emitida' ||
    record.fiscalStatus === 'Nota de Devolução Emitida' ||
    record.tipoDocumento === 'nfe_oficial'
  ) {
    return printDanfeDevolucaoOficialA4(record, companyProfile);
  }
  return printTrocaDevolucaoA4(record, companyProfile, { isEspelhoFiscal: true });
}

/**
 * Gera o HTML do DANFE da NF-e de Devolução (Modelo 55 — Finalidade 4: Devolução de Mercadoria)
 */
export async function buildDanfeDevolucaoOficialHtml(
  record: TrocaDevolucaoRecord,
  companyProfile?: CompanyProfile | null,
  options?: { isPreview?: boolean }
): Promise<string> {
  const isPreview = Boolean(options?.isPreview);
  const isFornecedor =
    record.envolvidoTipo === 'fornecedor' || record.tipoOperacao === 'devolucao_fornecedor';

  const {
    companyName,
    tradeName,
    cnpj,
    stateRegistration,
    phone,
    fullAddress,
    street,
    neighborhood,
    city,
    state,
    zipCode,
    logoDataUrl,
    ambienteSefaz,
  } = await resolveActiveCompanyAndLogo(companyProfile);

  const companyIe = String(stateRegistration || '').trim() || 'ISENTO';
  const numeroNfe =
    record.notaDevolucaoNumber || record.protocolo.replace(/\D/g, '').padStart(6, '0');
  const serieNfe = record.serieNfe || companyProfile?.seriePadraoNotas || '001';
  const rawChaveDigits = String(record.notaDevolucaoChave || '').replace(/\D/g, '');
  const chaveNfe =
    rawChaveDigits.length === 44
      ? rawChaveDigits
      : buildDeterministicChave44({
          uf: state || 'PR',
          dataEmissao: record.data,
          cnpj: cnpj || '',
          modelo: '55',
          serie: serieNfe,
          numero: numeroNfe,
          seed: record.id || record.protocolo,
        });

  const chaveRefDigits = String(record.chaveNfeReferenciada || '').replace(/\D/g, '');
  const chaveRefDisplay =
    chaveRefDigits.length === 44
      ? chaveRefDigits
      : String(record.chaveNfeReferenciada || '').trim();

  const cfopClean = String(
    record.cfopDevolucao || (isFornecedor ? '5202' : '1202')
  ).replace(/\D/g, '') || (isFornecedor ? '5202' : '1202');

  const natureza =
    record.naturezaOperacao ||
    (isFornecedor ? 'DEVOLUÇÃO DE MERCADORIA ADQUIRIDA' : 'DEVOLUÇÃO DE VENDA');

  const dataEmissaoBR = formatDateBR(record.data);
  const horaEmissao = new Date(
    record.notaDevolucaoEmitidaEm || record.createdAt || Date.now()
  ).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const isHomologacao = ambienteSefaz !== 'producao';
  const protocoloAut = record.protocoloAutorizacao
    ? `${record.protocoloAutorizacao}${isHomologacao ? ' (HOMOLOGAÇÃO)' : ''}`
    : `141${String(record.notaDevolucaoEmitidaEm || Date.now()).replace(/\D/g, '').slice(-12)} - ${dataEmissaoBR} ${horaEmissao}${isHomologacao ? ' (HOMOLOGAÇÃO)' : ''}`;

  const tipoNfCodigo: '0' | '1' = isFornecedor ? '1' : '0';
  const valorTotal =
    record.totalDevolvido > 0 ? record.totalDevolvido : Math.abs(record.saldoFinal || 0);

  const infoLines = [
    chaveRefDisplay ? `NFe Ref.: (${chaveRefDisplay})` : '',
    record.numeroVendaOuNotaOrigem ? `Documento / Venda Origem: ${record.numeroVendaOuNotaOrigem}` : '',
    `Protocolo Interno: ${record.protocolo}`,
    record.motivo ? `Motivo da Devolução: ${record.motivo}` : '',
    record.destinoFinanceiroLabel ? `Destino Financeiro: ${record.destinoFinanceiroLabel}` : '',
    record.observacoes ? `Observações: ${record.observacoes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const danfeItens = (record.itensDevolvidos || []).map((it, idx) => ({
    codigo: it.productCode || String(idx + 1).padStart(3, '0'),
    descricao: it.productName,
    ncm: '00000000',
    csosnCst: '102',
    cfop: cfopClean,
    unidade: it.unit || 'UN',
    quantidade: Number(it.quantity || 0),
    valorUnitario: Number(it.unitPrice || 0),
    valorDesconto: 0,
    valorTotal: Number(it.totalPrice || 0),
    baseIcms: 0,
    valorIcms: 0,
    valorIpi: 0,
    aliquotaIcms: 0,
    aliquotaIpi: 0,
  }));

  return buildDanfeOficialNfeHtml({
    numero: numeroNfe,
    serie: serieNfe,
    tipoOperacao: tipoNfCodigo,
    chaveAcesso: chaveNfe,
    naturezaOperacao: natureza,
    protocoloAutorizacao: protocoloAut,
    dataEmissao: record.data,
    dataSaida: record.data,
    horaSaida: horaEmissao,
    isHomologacao,
    emitente: {
      razaoSocial: companyName || tradeName || 'EMPRESA EMITENTE',
      cnpjCpf: cnpj || 'NÃO INFORMADO',
      ie: companyIe,
      endereco: street || fullAddress || 'Endereço não informado',
      bairro: neighborhood || '',
      municipio: city || '',
      uf: state || '',
      cep: zipCode || '',
      fone: phone || '',
      logoUrl: logoDataUrl,
    },
    destinatario: resolveDestinatarioDanfe({
      id: record.envolvidoId,
      nome: record.envolvidoNome.toUpperCase(),
      cpfCnpj: record.envolvidoDocumento,
      fone: record.envolvidoTelefone,
      preferTipo: isFornecedor ? 'fornecedor' : 'cliente',
      chaveNfeReferenciada: chaveRefDisplay,
      numeroOrigem: record.numeroVendaOuNotaOrigem,
    }),
    pagamentos: [{ descricao: 'Sem Pagamento', valor: 0 }],
    totais: {
      baseCalculoIcms: 0,
      valorIcms: 0,
      baseCalculoIcmsSt: 0,
      valorIcmsSt: 0,
      valorTotalProdutos: valorTotal,
      valorFrete: 0,
      valorSeguro: 0,
      desconto: 0,
      outrasDespesas: 0,
      valorIpi: 0,
      valorTotalNota: valorTotal,
    },
    transportador: {
      nomeRazaoSocial: '',
      fretePorConta: '9 - SEM FRETE',
      codigoAntt: '',
      placaVeiculo: '',
      veiculoUf: '',
      cnpjCpf: '',
      endereco: '',
      municipio: '',
      uf: '',
      ie: '',
    },
    itens: danfeItens,
    informacoesComplementares: infoLines,
    options: {
      isPreview,
      autoPrint: !isPreview,
      documentTitle: `DANFE NF-e Nº ${numeroNfe} - ${record.protocolo}`,
    },
  });
}

/**
 * Impressão oficial do DANFE da NF-e de Devolução (Modelo 55 — Finalidade 4: Devolução de Mercadoria)
 */
export async function printDanfeDevolucaoOficialA4(
  record: TrocaDevolucaoRecord,
  companyProfile?: CompanyProfile | null
): Promise<boolean> {
  const html = await buildDanfeDevolucaoOficialHtml(record, companyProfile, { isPreview: false });
  executePrint(html);
  return true;
}

export async function printTrocaDevolucaoCupom80mm(
  record: TrocaDevolucaoRecord,
  companyProfile?: CompanyProfile | null
): Promise<boolean> {
  const printWindow = window.open('', '_blank', 'width=420,height=720');
  if (!printWindow) return false;

  const { companyName, tradeName, cnpj, phone, fullAddress, logoDataUrl } = await resolveActiveCompanyAndLogo(companyProfile);
  const dataEmissaoBR = formatDateBR(record.data);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Cupom ${escapeHtml(record.protocolo)}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.25;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 4px;
      text-transform: uppercase;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
    .double-divider { border-bottom: 2px solid #000; margin: 5px 0; }
    .flex-between { display: flex; justify-content: space-between; margin: 2px 0; gap: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 4px 0; }
    th { border-bottom: 1px solid #000; text-align: left; padding: 2px 0; }
    td { padding: 2px 0; vertical-align: top; }
    .no-print { margin-bottom: 8px; text-align: center; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 6px 14px; font-weight: bold; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px;">
      🖨️ IMPRIMIR CUPOM 80MM
    </button>
  </div>

  ${logoDataUrl ? `<div class="text-center" style="margin-bottom: 4px;"><img src="${logoDataUrl}" alt="Logo" style="max-height: 40px; max-width: 120px; object-fit: contain;" /></div>` : ''}
  <div class="text-center font-bold" style="font-size: 13px;">${escapeHtml(tradeName)}</div>
  ${companyName && companyName !== tradeName ? `<div class="text-center" style="font-size: 9.5px;">${escapeHtml(companyName)}</div>` : ''}
  ${cnpj ? `<div class="text-center" style="font-size: 10px;">CNPJ/CPF: ${escapeHtml(cnpj)}</div>` : ''}
  ${phone ? `<div class="text-center" style="font-size: 10px;">TEL: ${escapeHtml(phone)}</div>` : ''}
  ${fullAddress ? `<div class="text-center" style="font-size: 9px;">${escapeHtml(fullAddress)}</div>` : ''}

  <div class="double-divider"></div>
  <div class="text-center font-bold" style="font-size: 12px;">COMPROVANTE DE TROCA / DEVOLUÇÃO</div>
  <div class="text-center font-bold" style="font-size: 12px;">PROTOCOLO: ${escapeHtml(record.protocolo)}</div>
  <div class="divider"></div>

  <div class="flex-between"><span>DATA:</span><span>${escapeHtml(dataEmissaoBR)}</span></div>
  <div class="flex-between"><span>OPERAÇÃO:</span><span class="font-bold">${escapeHtml(
    record.tipoOperacao === 'troca_direta'
      ? 'TROCA DIRETA'
      : record.tipoOperacao === 'devolucao_cliente'
        ? 'DEVOLUÇÃO CLIENTE'
        : 'DEVOLUÇÃO FORNECEDOR'
  )}</span></div>
  <div class="flex-between"><span>${record.envolvidoTipo === 'fornecedor' ? 'FORNEC:' : 'CLIENTE:'}</span><span class="font-bold">${escapeHtml(record.envolvidoNome)}</span></div>
  <div class="flex-between"><span>MOTIVO:</span><span>${escapeHtml(record.motivo)}</span></div>
  ${record.numeroVendaOuNotaOrigem ? `<div class="flex-between"><span>ORIGEM:</span><span>${escapeHtml(record.numeroVendaOuNotaOrigem)}</span></div>` : ''}

  <div class="double-divider"></div>
  <div class="font-bold">ITENS DEVOLVIDOS:</div>
  <table>
    <thead>
      <tr><th>PRODUTO</th><th class="text-right">QTD</th><th class="text-right">TOTAL</th></tr>
    </thead>
    <tbody>
      ${record.itensDevolvidos
        .map(
          (i) => `<tr>
          <td>${escapeHtml(i.productName)}</td>
          <td class="text-right">${i.quantity} ${escapeHtml(i.unit || 'UN')}</td>
          <td class="text-right font-bold">${escapeHtml(formatCurrencyBRL(i.totalPrice))}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  ${
    record.itensLevados && record.itensLevados.length > 0
      ? `
    <div class="divider"></div>
    <div class="font-bold">ITENS LEVADOS NA TROCA:</div>
    <table>
      <thead>
        <tr><th>PRODUTO</th><th class="text-right">QTD</th><th class="text-right">TOTAL</th></tr>
      </thead>
      <tbody>
        ${record.itensLevados
          .map(
            (i) => `<tr>
            <td>${escapeHtml(i.productName)}</td>
            <td class="text-right">${i.quantity} ${escapeHtml(i.unit || 'UN')}</td>
            <td class="text-right font-bold">${escapeHtml(formatCurrencyBRL(i.totalPrice))}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`
      : ''
  }

  <div class="double-divider"></div>
  <div class="flex-between"><span>TOTAL DEVOLVIDO:</span><span class="font-bold">${escapeHtml(formatCurrencyBRL(record.totalDevolvido))}</span></div>
  ${
    record.tipoOperacao === 'troca_direta'
      ? `<div class="flex-between"><span>TOTAL LEVADO:</span><span class="font-bold">${escapeHtml(formatCurrencyBRL(record.totalLevado))}</span></div>`
      : ''
  }
  <div class="flex-between font-bold" style="font-size: 11.5px;"><span>DESTINO:</span><span>${escapeHtml(record.destinoFinanceiroLabel)}</span></div>

  ${
    record.destinoFinanceiro === 'vale_credito' && (record.valeCreditoValor || 0) > 0
      ? `
    <div class="divider"></div>
    <div style="border: 1px solid #000; padding: 5px; text-align: center;">
      <div class="font-bold">*** VALE-CRÉDITO GERADO ***</div>
      <div class="font-bold" style="font-size: 14px; margin: 2px 0;">${escapeHtml(formatCurrencyBRL(record.valeCreditoValor || 0))}</div>
      <div style="font-size: 9px;">TITULAR: ${escapeHtml(record.envolvidoNome)}</div>
    </div>`
      : ''
  }

  ${
    record.boletoAbatido
      ? `
    <div class="divider"></div>
    <div style="border: 1px solid #000; padding: 5px;">
      <div class="text-center font-bold">*** ABATIMENTO EM BOLETO ***</div>
      <div class="flex-between"><span>DOC/NF:</span><span class="font-bold">${escapeHtml(record.boletoAbatido.documento || '—')}</span></div>
      <div class="flex-between"><span>VENC.:</span><span>${escapeHtml(record.boletoAbatido.vencimento ? formatDateBR(record.boletoAbatido.vencimento) : '—')}</span></div>
      <div class="flex-between"><span>ABATIDO:</span><span class="font-bold">${escapeHtml(formatCurrencyBRL(record.boletoAbatido.valorAbatido))}</span></div>
      <div class="flex-between"><span>RESTANTE:</span><span class="font-bold">${escapeHtml(formatCurrencyBRL(record.boletoAbatido.saldoRestante))}</span></div>
      <div class="text-center font-bold" style="font-size: 9px; margin-top: 2px;">${escapeHtml(record.boletoAbatido.statusResultante)}</div>
    </div>`
      : ''
  }

  <div style="margin-top: 28px; text-align: center;">
    <div style="border-top: 1px solid #000; padding-top: 3px; font-size: 10px;">ASSINATURA DO CLIENTE / PORTADOR</div>
  </div>
  <div class="divider" style="margin-top: 10px;"></div>
  <div class="text-center" style="font-size: 9px; color: #374151; text-transform: none;">${escapeHtml(buildSystemPrintFooterText())}</div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
