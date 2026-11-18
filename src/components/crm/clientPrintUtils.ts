import { Client, CompanyProfile } from '../../types';
import {
  formatCurrencyBRL,
  getCrmStatusLabel,
  getStoredCompanyProfile,
} from '../../lib/storage';
import { COMPANY_LOGO_REF, resolveMediaUrlAsync } from '../../lib/imageStorage';
import { resolveSubscriberPrintHeader, buildSystemPrintFooterHtml } from '../../lib/printIdentity';

function escapeHtml(raw?: string | number | null): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBirthDateBR(raw?: string): string {
  if (!raw) return '—';
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }
  return trimmed || '—';
}

async function resolveActiveCompanyAndLogo(companyProfile?: CompanyProfile | null) {
  const company = companyProfile || getStoredCompanyProfile();
  const header = resolveSubscriberPrintHeader(company);
  const logoDataUrl =
    (await resolveMediaUrlAsync(header.logoUrl || company?.logoUrl)) ||
    (await resolveMediaUrlAsync(COMPANY_LOGO_REF)) ||
    '';

  return {
    corporateName: header.corporateName || header.displayTitle,
    tradeName: header.displayTitle,
    cnpj: header.cnpjCpf,
    phone: header.phone,
    email: header.email,
    fullAddress: header.fullAddress,
    logoDataUrl,
  };
}

export async function printClientRegistrationA4(
  client: Partial<Client>,
  companyProfile?: CompanyProfile | null
): Promise<boolean> {
  // Execução síncrona antes de qualquer await para evitar bloqueio de pop-up/print
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

  const clientAvatarDataUrl = (await resolveMediaUrlAsync(client.avatarUrl)) || '';
  const digitsDoc = String(client.cpfCnpj || '').replace(/\D/g, '');
  const isPJ = client.personType ? client.personType === 'PJ' : digitsDoc.length > 11;

  const clientCode = client.code || client.codigo || '';
  const clientName = client.nome || client.name || '—';
  const farmName = client.fazenda || client.farmName || '—';
  const cpfCnpj = client.cpfCnpj || '—';
  const stateReg = client.stateRegistration || '—';
  const birthDate = formatBirthDateBR(client.birthDate);
  const phone = client.phone || client.telefone || '—';
  const secondaryContact = client.secondaryContact || '—';
  const email = client.email || '—';

  const zipCode = client.zipCode || '—';
  const address = client.address || '—';
  const addressNumber = client.addressNumber || '—';
  const addressComplement = client.addressComplement || '—';
  const neighborhood = client.neighborhood || '—';
  const city = client.city || client.cidade || '—';
  const state = client.state || client.estado || '—';

  const atividade = client.atividade || 'Não informada';
  const porteCapacidade =
    client.porteCapacidade ||
    (typeof client.headCount === 'number' && client.headCount > 0 ? String(client.headCount) : '—');
  const demandaPotencial =
    client.potencialCompraMensal ||
    (typeof client.monthlyDemandTons === 'number' && client.monthlyDemandTons > 0
      ? String(client.monthlyDemandTons)
      : '—');
  const statusLabel = getCrmStatusLabel(client.status);
  const contribuinteIcms = client.contribuinteIcms || '—';
  const creditLimitDisplay =
    typeof client.creditLimit === 'number' && client.creditLimit > 0
      ? formatCurrencyBRL(client.creditLimit)
      : '—';
  const paymentTerm = client.preferredPaymentTerm || '—';
  const priceTableLabel = (() => {
    switch (client.defaultPriceTable) {
      case 'custo': return '1 - PC (Custo)';
      case 'venda': return '2 - PF (Final)';
      case 'atacado': return '3 - PA (Atacado)';
      case 'promocional': return '4 - PP (Promo)';
      default: return 'Nenhuma / Padrão do PDV';
    }
  })();
  const blockOverdueLabel = client.blockOverdueCredit ? 'Sim (Bloqueado se inadimplente)' : 'Não';
  const authorizedBuyers = Array.isArray(client.authorizedBuyers) ? client.authorizedBuyers : [];
  const services = client.interestedServices || client.servicosInteresse || [];
  const notes = client.notes || client.observacoes || 'Nenhuma observação registrada.';

  const emitidoEm = new Date().toLocaleString('pt-BR');

  const logoBlock = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Logotipo" style="max-height: 62px; max-width: 150px; object-fit: contain; border-radius: 4px;" />`
    : `<div style="width: 60px; height: 60px; border: 1.5px solid #0f172a; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16pt; color: #059669; background: #ecfdf5;">AC</div>`;

  const servicesHtml =
    services.length > 0
      ? services
          .map(
            (srv) =>
              `<span style="display: inline-block; padding: 3px 9px; margin: 2px 4px 2px 0; border-radius: 4px; background: #ecfdf5; border: 1px solid #059669; color: #065f46; font-size: 8.5pt; font-weight: 700;">&#10003; ${escapeHtml(srv)}</span>`
          )
          .join('')
      : `<span style="color: #64748b; font-style: italic;">Nenhum serviço / operação marcado</span>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Ficha Cadastral do Cliente — ${escapeHtml(clientName)}</title>
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
          <h1>${escapeHtml(tradeName)}</h1>
          ${
            corporateName && String(corporateName ?? '').toLowerCase() !== String(tradeName ?? '').toLowerCase()
              ? `<div class="trade">${escapeHtml(corporateName)}</div>`
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
    <div class="doc-title-bar">FICHA CADASTRAL DO CLIENTE</div>

    <!-- Quadro 1: Identificação -->
    <div class="card">
      <div class="card-header">1. Identificação e Contato (${isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'})${clientCode ? ` &nbsp;•&nbsp; CÓD. ${escapeHtml(clientCode)}` : ''}</div>
      <div class="grid">
        ${
          clientAvatarDataUrl
            ? `<div class="field col-12" style="display:flex; align-items:center; gap:12px;">
                <img src="${clientAvatarDataUrl}" alt="Foto do Cliente" style="width:62px; height:62px; object-fit:cover; border-radius:8px; border:1px solid #334155;" />
                <div style="flex:1; display:grid; grid-template-columns: repeat(2, 1fr); gap:8px 12px;">
                  <div><span class="label">${isPJ ? 'Razão Social / Responsável' : 'Nome Completo / Responsável'}</span><div class="value">${escapeHtml(clientName)}</div></div>
                  <div><span class="label">Nome Fantasia / Estabelecimento</span><div class="value">${escapeHtml(farmName)}</div></div>
                </div>
              </div>`
            : `<div class="field col-6">
                <span class="label">${isPJ ? 'Razão Social / Responsável' : 'Nome Completo / Responsável'}</span>
                <div class="value">${escapeHtml(clientName)}</div>
              </div>
              <div class="field col-6">
                <span class="label">Nome Fantasia / Estabelecimento</span>
                <div class="value">${escapeHtml(farmName)}</div>
              </div>`
        }

        <div class="field col-4">
          <span class="label">${isPJ ? 'CNPJ' : 'CPF'}</span>
          <div class="value">${escapeHtml(cpfCnpj)}</div>
        </div>
        <div class="field col-4">
          <span class="label">${isPJ ? 'Inscrição Estadual (IE)' : 'RG / Identidade'}</span>
          <div class="value">${escapeHtml(stateReg)}</div>
        </div>
        <div class="field col-4">
          <span class="label">Data de Nascimento</span>
          <div class="value">${escapeHtml(birthDate)}</div>
        </div>

        <div class="field col-4">
          <span class="label">Telefone / WhatsApp</span>
          <div class="value">${escapeHtml(phone)}</div>
        </div>
        <div class="field col-4">
          <span class="label">E-mail Principal / Fiscal</span>
          <div class="value">${escapeHtml(email)}</div>
        </div>
        <div class="field col-4">
          <span class="label">Contato Secundário / Responsável</span>
          <div class="value">${escapeHtml(secondaryContact)}</div>
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
          <span class="label">Logradouro / Endereço</span>
          <div class="value">${escapeHtml(address)}</div>
        </div>
        <div class="field col-2">
          <span class="label">Número / S/N</span>
          <div class="value">${escapeHtml(addressNumber)}</div>
        </div>
        <div class="field col-3">
          <span class="label">Complemento / Ref.</span>
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
          <span class="label">UF</span>
          <div class="value">${escapeHtml(state)}</div>
        </div>
      </div>
    </div>

    <!-- Quadro 3: Perfil Comercial, Financeiro & Serviços -->
    <div class="card">
      <div class="card-header">3. Perfil Comercial, Financeiro e Serviços Contratados</div>
      <div class="grid">
        <div class="field col-4">
          <span class="label">Atividade / Segmento</span>
          <div class="value">${escapeHtml(atividade)}</div>
        </div>
        <div class="field col-4">
          <span class="label">Porte / Capacidade</span>
          <div class="value">${escapeHtml(porteCapacidade)}</div>
        </div>
        <div class="field col-4">
          <span class="label">Demanda Estimada / Potencial</span>
          <div class="value">${escapeHtml(demandaPotencial)}</div>
        </div>

        <div class="field col-3">
          <span class="label">Status no Funil CRM</span>
          <div class="value">${escapeHtml(statusLabel)}</div>
        </div>
        <div class="field col-3">
          <span class="label">Contribuinte ICMS</span>
          <div class="value">${escapeHtml(contribuinteIcms)}</div>
        </div>
        <div class="field col-3">
          <span class="label">Limite de Crédito</span>
          <div class="value">${escapeHtml(creditLimitDisplay)}</div>
        </div>
        <div class="field col-3">
          <span class="label">Condição / Prazo Preferencial</span>
          <div class="value">${escapeHtml(paymentTerm)}</div>
        </div>

        <div class="field col-6">
          <span class="label">Tabela de Preço Padrão (PDV)</span>
          <div class="value">${escapeHtml(priceTableLabel)}</div>
        </div>
        <div class="field col-6">
          <span class="label">Bloqueio de Venda a Prazo (Inadimplente)</span>
          <div class="value">${escapeHtml(blockOverdueLabel)}</div>
        </div>

        ${
          authorizedBuyers.length > 0
            ? `<div class="field col-12">
                <span class="label">Pessoas Autorizadas a Comprar / Retirar na Conta</span>
                <div style="border:1px solid #cbd5e1; border-radius:4px; padding:6px 8px; background:#f8fafc; font-size:8.4pt;">
                  ${authorizedBuyers
                    .map(
                      (b) =>
                        `<div style="padding:2px 0;"><strong>${escapeHtml(b.name)}</strong>${
                          b.documentOrPhone ? ` — ${escapeHtml(b.documentOrPhone)}` : ''
                        }${b.relationshipOrRole ? ` (${escapeHtml(b.relationshipOrRole)})` : ''}</div>`
                    )
                    .join('')}
                </div>
              </div>`
            : ''
        }

        <div class="field col-12">
          <span class="label">Serviços / Operações de Interesse</span>
          <div style="padding: 4px 0;">${servicesHtml}</div>
        </div>

        <div class="field col-12">
          <span class="label">Observações Comerciais / Preferências</span>
          <div class="notes-box">${escapeHtml(notes)}</div>
        </div>
      </div>
    </div>

    <!-- Assinaturas -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">${escapeHtml(clientName !== '—' ? clientName : 'Cliente / Responsável')}</div>
        <div class="sig-sub">Assinatura do Cliente (${escapeHtml(cpfCnpj !== '—' ? cpfCnpj : 'CPF/CNPJ')})</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">${escapeHtml(tradeName)}</div>
        <div class="sig-sub">Responsável Comercial</div>
      </div>
    </div>

    <!-- Rodapé -->
    ${buildSystemPrintFooterHtml({ extraRight: `${tradeName} — Ficha Cadastral do Cliente` })}
  </div>

  <script>
    function triggerClientPrint() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    }
    if (document.readyState === 'complete') {
      triggerClientPrint();
    } else {
      window.addEventListener('load', triggerClientPrint);
    }
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
