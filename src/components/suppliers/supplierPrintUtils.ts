import { CompanyProfile, Supplier } from '../../types';
import { getStoredCompanyProfile } from '../../lib/storage';
import { COMPANY_LOGO_REF, resolveMediaUrlAsync } from '../../lib/imageStorage';

function escapeHtml(raw?: string | number | null): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveActiveCompanyAndLogo(companyProfile?: CompanyProfile | null) {
  const company = companyProfile || getStoredCompanyProfile();
  const logoDataUrl =
    (await resolveMediaUrlAsync(company?.logoUrl)) ||
    (await resolveMediaUrlAsync(COMPANY_LOGO_REF)) ||
    '';

  const corporateName =
    company?.corporateName || company?.name || company?.companyName || 'AGROCONTROL';
  const tradeName = company?.tradeName || corporateName;
  const cnpj = company?.cnpjCpf || company?.cnpj || '';
  const phone = company?.phone || '';
  const email = company?.email || '';
  const addressParts = [
    company?.address,
    company?.number ? `nº ${company.number}` : '',
    company?.neighborhood ? `Bairro ${company.neighborhood}` : '',
    company?.city ? `${company.city}${company?.state ? `/${company.state}` : ''}` : company?.state || '',
    company?.zipCode ? `CEP ${company.zipCode}` : '',
  ].filter(Boolean);
  const fullAddress = addressParts.join(' • ');

  return {
    corporateName,
    tradeName,
    cnpj,
    phone,
    email,
    fullAddress,
    logoDataUrl,
  };
}

export async function printSupplierRegistrationA4(
  supplier: Partial<Supplier>,
  companyProfile?: CompanyProfile | null
): Promise<boolean> {
  // Chamada síncrona antes de qualquer await para evitar bloqueio de pop-up/print
  const printWindow = window.open('', '_blank', 'width=900,height=750');
  if (!printWindow) return false;

  const {
    corporateName,
    tradeName,
    cnpj,
    phone: companyPhone,
    email: companyEmail,
    fullAddress,
    logoDataUrl,
  } = await resolveActiveCompanyAndLogo(companyProfile);

  const digitsDoc = String(supplier.cnpjOrCpf || '').replace(/\D/g, '');
  const isPJ = supplier.personType ? supplier.personType === 'PJ' : digitsDoc.length !== 11;
  const supplierCode = supplier.code || supplier.codigo || '';
  const supplierName = supplier.name || '—';
  const supplierTradeName = supplier.tradeName || '—';
  const cnpjOrCpf = supplier.cnpjOrCpf || '—';
  const category = supplier.category || 'Não informada';
  const stateReg = supplier.stateRegistration || '—';
  const munReg = supplier.municipalRegistration || '—';
  const phone = supplier.phone || '—';
  const email = supplier.email || '—';

  const zipCode = supplier.zipCode || '—';
  const address = supplier.address || '—';
  const addressNumber = supplier.addressNumber || '—';
  const addressComplement = supplier.addressComplement || '—';
  const neighborhood = supplier.neighborhood || '—';
  const city = supplier.city || '—';
  const state = supplier.state || '—';

  const salespersonName = supplier.salespersonName || '—';
  const salespersonPhone = supplier.salespersonPhone || '—';
  const defaultPaymentTerm = supplier.defaultPaymentTerm || '—';
  const notes = supplier.notes || 'Nenhuma observação registrada.';

  const emitidoEm = new Date().toLocaleString('pt-BR');

  const logoBlock = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Logotipo" style="max-height: 62px; max-width: 150px; object-fit: contain; border-radius: 4px;" />`
    : `<div style="width: 60px; height: 60px; border: 1.5px solid #0f172a; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16pt; color: #059669; background: #ecfdf5;">AC</div>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Ficha Cadastral do Fornecedor — ${escapeHtml(supplierName)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9.2pt;
      line-height: 1.4;
    }
    .no-print {
      background: #e2e8f0;
      border-bottom: 1px solid #94a3b8;
      padding: 10px 18px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn-action {
      border: 1px solid #0f172a;
      background: #ffffff;
      color: #0f172a;
      font-weight: 700;
      font-size: 9pt;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-primary {
      background: #059669;
      border-color: #065f46;
      color: #ffffff;
    }
    .sheet {
      max-width: 190mm;
      margin: 10px auto 16px auto;
      padding: 4px 8px;
    }
    .header-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      padding: 10px 14px;
      background: #f8fafc;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }
    .company-info h1 {
      margin: 0;
      font-size: 11.5pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.2px;
    }
    .company-info .trade {
      font-size: 9pt;
      font-weight: 700;
      color: #334155;
      margin-top: 1px;
    }
    .company-info .meta {
      font-size: 8pt;
      color: #475569;
      margin-top: 3px;
    }
    .doc-title-bar {
      margin-top: 12px;
      background: #0f172a;
      color: #ffffff;
      text-align: center;
      padding: 7px 12px;
      border-radius: 5px;
      font-size: 11pt;
      font-weight: 900;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .card {
      margin-top: 12px;
      border: 1.2px solid #334155;
      border-radius: 6px;
      overflow: hidden;
    }
    .card-header {
      background: #e2e8f0;
      color: #0f172a;
      font-size: 8.8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 10px;
      border-bottom: 1px solid #334155;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 8px 12px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .field {
      min-width: 0;
    }
    .col-2 { grid-column: span 2; }
    .col-3 { grid-column: span 3; }
    .col-4 { grid-column: span 4; }
    .col-5 { grid-column: span 5; }
    .col-6 { grid-column: span 6; }
    .col-8 { grid-column: span 8; }
    .col-9 { grid-column: span 9; }
    .col-12 { grid-column: span 12; }
    .label {
      display: block;
      font-size: 7pt;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
    }
    .value {
      font-size: 9.2pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
      word-break: break-word;
    }
    .notes-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 7px 9px;
      background: #f8fafc;
      font-size: 8.8pt;
      color: #1e293b;
      min-height: 36px;
      white-space: pre-wrap;
    }
    .signatures {
      margin-top: 28px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 36px;
      padding: 0 12px;
    }
    .sig-block {
      text-align: center;
      padding-top: 26px;
    }
    .sig-line {
      border-top: 1.2px solid #0f172a;
      padding-top: 5px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #0f172a;
    }
    .sig-sub {
      font-size: 7.5pt;
      color: #475569;
      margin-top: 1px;
    }
    .footer-meta {
      margin-top: 18px;
      border-top: 1px dashed #94a3b8;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #475569;
    }
    @media print {
      .no-print { display: none !important; }
      .sheet { margin: 0 auto; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button type="button" class="btn-action" onclick="window.close()">Fechar</button>
    <button type="button" class="btn-action btn-primary" onclick="window.focus(); window.print();">Imprimir Ficha</button>
  </div>

  <div class="sheet">
    <!-- Cabeçalho Oficial da Empresa -->
    <div class="header-box">
      <div class="header-left">
        ${logoBlock}
        <div class="company-info">
          <h1>${escapeHtml(corporateName)}</h1>
          ${
            tradeName && tradeName.toLowerCase() !== corporateName.toLowerCase()
              ? `<div class="trade">${escapeHtml(tradeName)}</div>`
              : ''
          }
          <div class="meta">
            ${cnpj ? `<strong>CNPJ/CPF:</strong> ${escapeHtml(cnpj)}` : ''}
            ${cnpj && companyPhone ? ' &nbsp;|&nbsp; ' : ''}
            ${companyPhone ? `<strong>Tel:</strong> ${escapeHtml(companyPhone)}` : ''}
            ${companyEmail ? ` &nbsp;|&nbsp; <strong>E-mail:</strong> ${escapeHtml(companyEmail)}` : ''}
          </div>
          ${fullAddress ? `<div class="meta">${escapeHtml(fullAddress)}</div>` : ''}
        </div>
      </div>
      <div style="text-align: right; font-size: 7.5pt; color: #475569; white-space: nowrap;">
        <div style="font-weight: 800; color: #0f172a; text-transform: uppercase;">Emissão</div>
        <div>${escapeHtml(emitidoEm)}</div>
      </div>
    </div>

    <!-- Título -->
    <div class="doc-title-bar">FICHA CADASTRAL DO FORNECEDOR</div>

    <!-- Quadro 1: Dados Principais, Fiscais e Contato -->
    <div class="card">
      <div class="card-header">1. Dados Principais, Fiscais e Contato (${isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'})${supplierCode ? ` &nbsp;•&nbsp; CÓD. ${escapeHtml(supplierCode)}` : ''}</div>
      <div class="grid">
        <div class="field col-6">
          <span class="label">${isPJ ? 'Razão Social / Nome' : 'Nome Completo / Fornecedor'}</span>
          <div class="value">${escapeHtml(supplierName)}</div>
        </div>
        <div class="field col-6">
          <span class="label">${isPJ ? 'Nome Fantasia' : 'Nome Fantasia / Apelido Comercial'}</span>
          <div class="value">${escapeHtml(supplierTradeName)}</div>
        </div>

        <div class="field col-3">
          <span class="label">${isPJ ? 'CNPJ' : 'CPF'}</span>
          <div class="value">${escapeHtml(cnpjOrCpf)}</div>
        </div>
        <div class="field col-3">
          <span class="label">${isPJ ? 'Inscrição Estadual (IE)' : 'RG / Identidade'}</span>
          <div class="value">${escapeHtml(stateReg)}</div>
        </div>
        <div class="field col-3">
          <span class="label">Inscrição Municipal (IM)</span>
          <div class="value">${escapeHtml(munReg)}</div>
        </div>
        <div class="field col-3">
          <span class="label">Categoria Principal</span>
          <div class="value">${escapeHtml(category)}</div>
        </div>

        <div class="field col-4">
          <span class="label">WhatsApp / Telefone</span>
          <div class="value">${escapeHtml(phone)}</div>
        </div>
        <div class="field col-8">
          <span class="label">E-mail Comercial / Fiscal</span>
          <div class="value">${escapeHtml(email)}</div>
        </div>
      </div>
    </div>

    <!-- Quadro 2: Endereço -->
    <div class="card">
      <div class="card-header">2. Endereço e Localização</div>
      <div class="grid">
        <div class="field col-2">
          <span class="label">CEP</span>
          <div class="value">${escapeHtml(zipCode)}</div>
        </div>
        <div class="field col-5">
          <span class="label">Endereço / Logradouro</span>
          <div class="value">${escapeHtml(address)}</div>
        </div>
        <div class="field col-2">
          <span class="label">Número / S/N</span>
          <div class="value">${escapeHtml(addressNumber)}</div>
        </div>
        <div class="field col-3">
          <span class="label">Complemento</span>
          <div class="value">${escapeHtml(addressComplement)}</div>
        </div>

        <div class="field col-5">
          <span class="label">Bairro / Comunidade</span>
          <div class="value">${escapeHtml(neighborhood)}</div>
        </div>
        <div class="field col-5">
          <span class="label">Cidade</span>
          <div class="value">${escapeHtml(city)}</div>
        </div>
        <div class="field col-2">
          <span class="label">Estado (UF)</span>
          <div class="value">${escapeHtml(state)}</div>
        </div>
      </div>
    </div>

    <!-- Quadro 3: Contato Comercial, Condições & Dados Bancários -->
    <div class="card">
      <div class="card-header">3. Contato Comercial, Condições e Dados Bancários</div>
      <div class="grid">
        <div class="field col-4">
          <span class="label">Nome do Vendedor / Representante</span>
          <div class="value">${escapeHtml(salespersonName)}</div>
        </div>
        <div class="field col-4">
          <span class="label">WhatsApp Direto do Vendedor</span>
          <div class="value">${escapeHtml(salespersonPhone)}</div>
        </div>
        <div class="field col-4">
          <span class="label">Condição de Pagamento / Prazo Padrão</span>
          <div class="value">${escapeHtml(defaultPaymentTerm)}</div>
        </div>

        <div class="field col-12">
          <span class="label">Observações / Dados Bancários / PIX</span>
          <div class="notes-box">${escapeHtml(notes)}</div>
        </div>
      </div>
    </div>

    <!-- Assinaturas -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">${escapeHtml(supplierName !== '—' ? supplierName : 'Fornecedor / Representante')}</div>
        <div class="sig-sub">Assinatura do Fornecedor (${escapeHtml(cnpjOrCpf !== '—' ? cnpjOrCpf : 'CNPJ/CPF')})</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">${escapeHtml(tradeName)}</div>
        <div class="sig-sub">Setor de Compras / Financeiro</div>
      </div>
    </div>

    <!-- Rodapé -->
    <div class="footer-meta">
      <span>Documento emitido em ${escapeHtml(emitidoEm)}</span>
      <span>${escapeHtml(corporateName)} — Ficha Cadastral do Fornecedor</span>
    </div>
  </div>

  <script>
    function triggerSupplierPrint() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    }
    if (document.readyState === 'complete') {
      triggerSupplierPrint();
    } else {
      window.addEventListener('load', triggerSupplierPrint);
    }
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
