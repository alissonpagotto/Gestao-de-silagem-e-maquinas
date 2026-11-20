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
    logoDataUrl,
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

function formatAccessKeyGroups(rawKey?: string): string {
  const digits = String(rawKey || '').replace(/\D/g, '');
  if (!digits) return '—';
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function buildDanfeBarcodeSvg(code: string): string {
  const digits = String(code || '').replace(/\D/g, '') || '00000000000000000000000000000000000000000000';
  let x = 2;
  const bars: string[] = [];
  for (let i = 0; i < digits.length; i++) {
    const val = Number(digits[i]) || 0;
    const w1 = (val % 3) + 1;
    const g1 = ((val + 1) % 2) + 1;
    const w2 = ((val + 2) % 2) + 1;
    bars.push(`<rect x="${x}" y="0" width="${w1}" height="34" fill="#000"/>`);
    x += w1 + g1;
    bars.push(`<rect x="${x}" y="0" width="${w2}" height="34" fill="#000"/>`);
    x += w2 + 1.5;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(x + 2)} 34" preserveAspectRatio="none" style="width:100%;height:34px;display:block;">${bars.join('')}</svg>`;
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
    logoDataUrl,
  } = await resolveActiveCompanyAndLogo(companyProfile);

  const companyIe = String(stateRegistration || '').trim() || 'ISENTO';

  const numeroNfe =
    record.notaDevolucaoNumber || record.protocolo.replace(/\D/g, '').padStart(6, '0');
  const serieNfe = record.serieNfe || '001';
  const chaveNfe = record.notaDevolucaoChave || '';
  const chaveRef = record.chaveNfeReferenciada || '';
  const cfop = record.cfopDevolucao || (isFornecedor ? '5.202' : '1.202');
  const natureza =
    record.naturezaOperacao ||
    (isFornecedor ? 'DEVOLUÇÃO DE MERCADORIA ADQUIRIDA' : 'DEVOLUÇÃO DE VENDA');
  const protocoloAut = record.protocoloAutorizacao || `141${Date.now().toString().slice(-12)}`;
  const dataEmissao = formatDateBR(record.data);
  const horaEmissao = new Date(
    record.notaDevolucaoEmitidaEm || record.createdAt || Date.now()
  ).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const tipoNfCodigo = isFornecedor ? '1' : '0';
  const tipoNfLabel = isFornecedor ? '1 - SAÍDA' : '0 - ENTRADA';
  const valorTotal =
    record.totalDevolvido > 0 ? record.totalDevolvido : Math.abs(record.saldoFinal || 0);

  const itemsRows = (record.itensDevolvidos || [])
    .map(
      (it, idx) => `
      <tr>
        <td class="c">${escapeHtml(it.productCode || String(idx + 1).padStart(3, '0'))}</td>
        <td><strong>${escapeHtml(it.productName)}</strong></td>
        <td class="c">0000.00.00</td>
        <td class="c">000</td>
        <td class="c"><strong>${escapeHtml(cfop.replace(/\./g, ''))}</strong></td>
        <td class="c">${escapeHtml(it.unit || 'UN')}</td>
        <td class="r">${Number(it.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td>
        <td class="r">${formatCurrencyBRL(it.unitPrice)}</td>
        <td class="r"><strong>${formatCurrencyBRL(it.totalPrice)}</strong></td>
        <td class="r">0,00</td>
        <td class="r">0,00</td>
      </tr>
    `
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>DANFE NF-e Nº ${escapeHtml(numeroNfe)} - ${escapeHtml(record.protocolo)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      background: #fff;
      font-size: 9px;
      line-height: 1.25;
    }
    .toolbar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 12px; background: #e0e6f1; border-bottom: 1.5px solid #000; margin-bottom: 8px; }
    .btn { padding: 6px 14px; border: 1.5px solid #000; border-radius: 5px; font-weight: 800; font-size: 11px; cursor: pointer; background: #0f172a; color: #fff; }
    .btn.sec { background: #fff; color: #000; }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      html, body { width: 100%; height: 100%; margin: 0; padding: 0; }
      .toolbar { display: none !important; }
    }

    .danfe-page {
      width: 100%;
      min-height: 278mm;
      border: 1.5px solid #000;
      padding: 5px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .danfe-top { flex-shrink: 0; }
    .danfe-products-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .products-table-wrap {
      flex: 1;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      background: #fff;
    }
    .danfe-bottom { flex-shrink: 0; }

    .canhoto { display: grid; grid-template-columns: 1fr 140px; border: 1px solid #000; margin-bottom: 5px; }
    .canhoto-left { border-right: 1px solid #000; display: flex; flex-direction: column; }
    .canhoto-top { padding: 4px 6px; font-size: 7.5px; border-bottom: 1px solid #000; }
    .canhoto-bottom { display: grid; grid-template-columns: 130px 1fr; flex: 1; }
    .canhoto-cell { padding: 4px 6px; min-height: 28px; }
    .canhoto-cell:first-child { border-right: 1px solid #000; }
    .canhoto-right { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4px; }
    .cut-line { border-top: 1px dashed #000; margin: 5px 0; text-align: center; font-size: 7px; color: #333; }

    .header-grid { display: grid; grid-template-columns: 40% 19% 41%; border: 1px solid #000; }
    .hdr-emit { border-right: 1px solid #000; padding: 6px; display: flex; align-items: center; gap: 8px; }
    .hdr-logo { width: 54px; height: 54px; object-fit: contain; border: 1px solid #cbd5e1; padding: 2px; border-radius: 4px; flex-shrink: 0; }
    .hdr-danfe { border-right: 1px solid #000; padding: 5px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; }
    .hdr-key { padding: 5px; display: flex; flex-direction: column; justify-content: space-between; }

    .lbl { font-size: 6.8px; text-transform: uppercase; font-weight: 700; color: #111; display: block; margin-bottom: 1px; letter-spacing: 0.2px; }
    .val { font-size: 9.2px; font-weight: 700; color: #000; word-break: break-word; }
    .val-mono { font-family: 'Courier New', monospace; font-size: 8.5px; font-weight: 700; letter-spacing: 0.35px; }
    .danfe-title { font-size: 13px; font-weight: 900; letter-spacing: 1px; margin: 0; }
    .danfe-sub { font-size: 7.4px; font-weight: 700; margin: 2px 0; }
    .tipo-box { display: inline-flex; align-items: center; justify-content: center; gap: 6px; margin: 3px auto; }
    .tipo-num { border: 1.5px solid #000; padding: 2px 7px; font-size: 12px; font-weight: 900; }

    .sec-title { font-size: 7.5px; font-weight: 900; text-transform: uppercase; background: #e2e8f0; border: 1px solid #000; border-top: none; padding: 2.5px 5px; letter-spacing: 0.4px; }
    .row { display: grid; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px solid #000; }
    .cell { padding: 3px 5px; border-right: 1px solid #000; min-height: 24px; }
    .cell:last-child { border-right: none; }

    table.products-table { width: 100%; border-collapse: collapse; }
    table.products-table th { background: #f1f5f9; border-bottom: 1px solid #000; border-right: 1px solid #000; font-size: 7px; text-transform: uppercase; padding: 3px 4px; text-align: left; }
    table.products-table th:last-child, table.products-table td:last-child { border-right: none; }
    table.products-table td { border-bottom: 1px solid #cbd5e1; border-right: 1px solid #000; padding: 4px 4px; font-size: 8.5px; }
    .c { text-align: center; }
    .r { text-align: right; }

    .footer-note { margin-top: 6px; font-size: 7.5px; color: #334155; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn sec" onclick="window.close()">Fechar</button>
    <button class="btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF (DANFE NF-e)</button>
  </div>

  <div class="danfe-page">
    <div class="danfe-top">
      <div class="canhoto">
        <div class="canhoto-left">
          <div class="canhoto-top">
            RECEBEMOS DE <strong>${escapeHtml((companyName || tradeName).toUpperCase())}</strong> OS PRODUTOS / MERCADORIAS CONSTANTES DA NOTA FISCAL ELETRÔNICA DE DEVOLUÇÃO INDICADA AO LADO — EMISSÃO: ${escapeHtml(dataEmissao)} — VALOR TOTAL: <strong>${formatCurrencyBRL(valorTotal)}</strong> — DESTINATÁRIO/REMETENTE: <strong>${escapeHtml(record.envolvidoNome.toUpperCase())}</strong>
          </div>
          <div class="canhoto-bottom">
            <div class="canhoto-cell"><span class="lbl">DATA DE RECEBIMENTO</span></div>
            <div class="canhoto-cell"><span class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span></div>
          </div>
        </div>
        <div class="canhoto-right">
          <strong style="font-size:11px;">NF-e</strong>
          <div style="font-size:10px;font-weight:900;">Nº ${escapeHtml(numeroNfe)}</div>
          <div style="font-size:8.5px;font-weight:700;">SÉRIE ${escapeHtml(serieNfe)}</div>
        </div>
      </div>

      <div class="cut-line">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>

      <div class="header-grid">
        <div class="hdr-emit">
          ${logoDataUrl ? `<img src="${logoDataUrl}" class="hdr-logo" alt="Logo" />` : ''}
          <div style="min-width: 0; flex: 1;">
            <div style="font-size:9.8px;font-weight:900;text-transform:uppercase;line-height:1.2;margin-bottom:2px;">${escapeHtml(companyName || tradeName)}</div>
            ${tradeName && companyName && tradeName.toUpperCase() !== companyName.toUpperCase() ? `<div style="font-size:7.6px;font-weight:700;color:#1e293b;margin-bottom:2px;">${escapeHtml(tradeName)}</div>` : ''}
            ${fullAddress ? `<div style="font-size:7.4px;line-height:1.25;margin-top:2px;">${escapeHtml(fullAddress)}</div>` : ''}
            ${phone ? `<div style="font-size:7.5px;margin-top:2px;"><strong>TELEFONE:</strong> ${escapeHtml(phone)}</div>` : ''}
            <div style="font-size:7.5px;margin-top:2px;"><strong>CNPJ:</strong> ${escapeHtml(cnpj || 'Não informado')} &nbsp;|&nbsp; <strong>IE:</strong> ${escapeHtml(companyIe)}</div>
          </div>
        </div>
        <div class="hdr-danfe">
          <div>
            <p class="danfe-title">DANFE</p>
            <p class="danfe-sub">Documento Auxiliar da Nota Fiscal Eletrônica</p>
          </div>
          <div class="tipo-box">
            <div style="text-align:left;font-size:7px;font-weight:700;">0 - ENTRADA<br/>1 - SAÍDA</div>
            <div class="tipo-num">${tipoNfCodigo}</div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:900;">Nº ${escapeHtml(numeroNfe)}</div>
            <div style="font-size:8.5px;font-weight:700;">SÉRIE ${escapeHtml(serieNfe)} &nbsp;|&nbsp; FOLHA 1/1</div>
            <div style="font-size:7px;font-weight:700;margin-top:2px;">FINALIDADE: 4 - DEVOLUÇÃO</div>
          </div>
        </div>
        <div class="hdr-key">
          <div>
            <span class="lbl">CONTROLE DO FISCO / CÓDIGO DE BARRAS</span>
            <div style="margin:3px 0;">${buildDanfeBarcodeSvg(chaveNfe)}</div>
          </div>
          <div style="border-top:1px solid #000;padding-top:3px;">
            <span class="lbl">CHAVE DE ACESSO (MODELO 55)</span>
            <div class="val-mono">${escapeHtml(formatAccessKeyGroups(chaveNfe))}</div>
          </div>
          <div style="border-top:1px solid #000;padding-top:3px;font-size:7px;">
            Consulta de autenticidade no portal nacional da NF-e <strong>www.nfe.fazenda.gov.br/portal</strong> ou na Sefaz Autorizadora.
          </div>
        </div>
      </div>

      <div class="row" style="grid-template-columns: 58% 42%;">
        <div class="cell">
          <span class="lbl">NATUREZA DA OPERAÇÃO</span>
          <span class="val">${escapeHtml(natureza)} (CFOP ${escapeHtml(cfop)})</span>
        </div>
        <div class="cell">
          <span class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
          <span class="val-mono">${escapeHtml(protocoloAut)} - ${escapeHtml(dataEmissao)} ${escapeHtml(horaEmissao)}</span>
        </div>
      </div>

      <div class="row" style="grid-template-columns: 33% 33% 34%;">
        <div class="cell">
          <span class="lbl">INSCRIÇÃO ESTADUAL</span>
          <span class="val">${escapeHtml(companyIe)}</span>
        </div>
        <div class="cell">
          <span class="lbl">TIPO DE OPERAÇÃO FISCAL</span>
          <span class="val">${escapeHtml(tipoNfLabel)} — ${escapeHtml(getTipoOperacaoLabel(record.tipoOperacao))}</span>
        </div>
        <div class="cell">
          <span class="lbl">CNPJ DO EMITENTE</span>
          <span class="val">${escapeHtml(cnpj || 'Não informado')}</span>
        </div>
      </div>

      <div class="sec-title">DESTINATÁRIO / REMETENTE (${isFornecedor ? 'FORNECEDOR' : 'CLIENTE'})</div>
      <div class="row" style="grid-template-columns: 56% 24% 20%;">
        <div class="cell">
          <span class="lbl">NOME / RAZÃO SOCIAL</span>
          <span class="val">${escapeHtml(record.envolvidoNome.toUpperCase())}</span>
        </div>
        <div class="cell">
          <span class="lbl">CNPJ / CPF</span>
          <span class="val">${escapeHtml(record.envolvidoDocumento || 'NÃO INFORMADO')}</span>
        </div>
        <div class="cell">
          <span class="lbl">DATA DA EMISSÃO</span>
          <span class="val">${escapeHtml(dataEmissao)}</span>
        </div>
      </div>
      <div class="row" style="grid-template-columns: 56% 24% 20%;">
        <div class="cell">
          <span class="lbl">TELEFONE / CONTATO</span>
          <span class="val">${escapeHtml(record.envolvidoTelefone || '—')}</span>
        </div>
        <div class="cell">
          <span class="lbl">PROTOCOLO INTERNO</span>
          <span class="val">${escapeHtml(record.protocolo)}</span>
        </div>
        <div class="cell">
          <span class="lbl">DATA ENTRADA / SAÍDA</span>
          <span class="val">${escapeHtml(dataEmissao)}</span>
        </div>
      </div>

      <div class="sec-title">DOCUMENTO FISCAL REFERENCIADO (NF-e DE ORIGEM)</div>
      <div class="row" style="grid-template-columns: 72% 28%;">
        <div class="cell">
          <span class="lbl">CHAVE DE ACESSO DA NF-e REFERENCIADA (44 DÍGITOS)</span>
          <span class="val-mono">${chaveRef ? escapeHtml(formatAccessKeyGroups(chaveRef)) : 'NÃO INFORMADA'}</span>
        </div>
        <div class="cell">
          <span class="lbl">Nº DOC / VENDA ORIGEM</span>
          <span class="val">${escapeHtml(record.numeroVendaOuNotaOrigem || '—')}</span>
        </div>
      </div>

      <div class="sec-title">CÁLCULO DO IMPOSTO / TOTAIS DA DEVOLUÇÃO</div>
      <div class="row" style="grid-template-columns: repeat(5, 1fr);">
        <div class="cell"><span class="lbl">BASE DE CÁLC. DO ICMS</span><span class="val">R$ 0,00</span></div>
        <div class="cell"><span class="lbl">VALOR DO ICMS</span><span class="val">R$ 0,00</span></div>
        <div class="cell"><span class="lbl">VALOR DO FRETE</span><span class="val">R$ 0,00</span></div>
        <div class="cell"><span class="lbl">VALOR TOTAL DOS PRODUTOS</span><span class="val">${formatCurrencyBRL(valorTotal)}</span></div>
        <div class="cell" style="background:#f8fafc;"><span class="lbl">VALOR TOTAL DA NOTA</span><span class="val" style="font-size:11px;">${formatCurrencyBRL(valorTotal)}</span></div>
      </div>
    </div>

    <div class="danfe-products-section">
      <div class="sec-title">DADOS DOS PRODUTOS / MERCADORIAS DEVOLVIDAS</div>
      <div class="products-table-wrap">
        <table class="products-table">
          <thead>
            <tr>
              <th class="c" style="width:8%;">CÓD.</th>
              <th>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
              <th class="c" style="width:9%;">NCM/SH</th>
              <th class="c" style="width:5%;">CST</th>
              <th class="c" style="width:6%;">CFOP</th>
              <th class="c" style="width:5%;">UN</th>
              <th class="r" style="width:8%;">QTD.</th>
              <th class="r" style="width:11%;">V. UNIT.</th>
              <th class="r" style="width:12%;">V. TOTAL</th>
              <th class="r" style="width:7%;">BC ICMS</th>
              <th class="r" style="width:7%;">V. ICMS</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows || `<tr><td colspan="11" class="c" style="padding:10px;">Nenhum item detalhado.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="danfe-bottom">
      <div class="sec-title">DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES</div>
      <div class="row" style="grid-template-columns: 65% 35%;">
        <div class="cell" style="min-height:64px;">
          <span class="lbl">INFORMAÇÕES COMPLEMENTARES</span>
          <div style="font-size:8px;margin-top:2px;line-height:1.4;">
            <strong>Motivo da Devolução:</strong> ${escapeHtml(record.motivo)}<br/>
            <strong>Destino Financeiro:</strong> ${escapeHtml(record.destinoFinanceiroLabel || '—')}<br/>
            ${chaveRef ? `<strong>NF-e de Origem Referenciada:</strong> ${escapeHtml(chaveRef)}<br/>` : ''}
            ${record.observacoes ? `<strong>Observações:</strong> ${escapeHtml(record.observacoes)}` : ''}
          </div>
        </div>
        <div class="cell" style="min-height:64px;">
          <span class="lbl">RESERVADO AO FISCO</span>
          <div style="font-size:7.5px;margin-top:4px;color:#334155;">
            NF-e de Devolução Oficial (Modelo 55).<br/>
            Status: <strong>NF-e EMITIDA / AUTORIZADA</strong><br/>
            Operador: ${escapeHtml(record.operador || 'Sistema')}
          </div>
        </div>
      </div>

      <div class="footer-note">
        <span>${buildSystemPrintFooterText()}</span>
        <span>${isPreview ? 'Pré-visualização em ' : 'Impresso em '}${escapeHtml(new Date().toLocaleString('pt-BR'))}</span>
      </div>
    </div>
  </div>
  ${
    isPreview
      ? `<style>.toolbar { display: none !important; } body { padding: 12px; background: #f8fafc; } .danfe-page { background: #fff; }</style>`
      : `<script>
    window.addEventListener('load', function() {
      setTimeout(function() { try { window.print(); } catch(e) {} }, 260);
    });
  </script>`
  }
</body>
</html>`;

  return isPreview
    ? html.replace(
        '<div class="danfe-page">',
        `<div style="background:#fef3c7;border:1.5px solid #92400e;color:#78350f;padding:7px 12px;margin-bottom:10px;border-radius:6px;font-family:Arial,sans-serif;font-size:11px;font-weight:800;text-align:center;">👁️ PRÉ-VISUALIZAÇÃO DO DANFE (NF-e MODELO 55) — SEM VALOR FISCAL ATÉ A EMISSÃO DEFINITIVA</div><div class="danfe-page">`
      )
    : html;
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
