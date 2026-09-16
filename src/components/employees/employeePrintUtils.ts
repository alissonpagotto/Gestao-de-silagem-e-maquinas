import { Employee, CompanyProfile } from '../../types';
import { formatDateBR, formatCurrencyBRL } from '../../lib/storage';

/**
 * Calculates age based on birthDate string (YYYY-MM-DD)
 */
export function calculateAge(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

/**
 * Generates structured HTML content for the individual employee registration sheet.
 * Ready for both PrintPreviewModal and generatePrintableHtml.
 */
export function generateEmployeeSheetHtml(
  employee: Partial<Employee>,
  company?: CompanyProfile | null
): string {
  const age = calculateAge(employee.birthDate);
  const salary = employee.baseSalary !== undefined ? employee.baseSalary : (employee.salary || 0);

  const photoBlock = employee.photoUrl
    ? `<div style="width: 105px; height: 130px; border: 1.5px solid #64748b; border-radius: 6px; overflow: hidden; margin: 0 auto; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <img src="${employee.photoUrl}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover;" />
      </div>`
    : `<div style="width: 105px; height: 130px; border: 1.5px dashed #94a3b8; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; margin: 0 auto; color: #94a3b8; font-size: 8pt; font-weight: bold;">
        <span style="font-size: 14pt; margin-bottom: 2px;">👤</span>
        <span>FOTO 3x4</span>
        <span style="font-size: 6.5pt; font-weight: normal; margin-top: 2px;">(Física ou Digital)</span>
      </div>`;

  const commissionParts: string[] = [];
  if (employee.brokerCommissionValue !== undefined && employee.brokerCommissionValue > 0) {
    if (employee.brokerCommissionType === 'Valor Fixo por contrato/pedido') {
      commissionParts.push(`Agenciador: ${formatCurrencyBRL(employee.brokerCommissionValue)} (Fixo por pedido)`);
    } else {
      commissionParts.push(`Agenciador: ${employee.brokerCommissionValue}% (${employee.brokerCommissionType?.includes('produção') ? 's/ Produção' : 's/ Pedido'})`);
    }
  } else if (employee.receivesCommission) {
    if (employee.commissionPerHour && employee.commissionPerHour > 0) {
      commissionParts.push(`${formatCurrencyBRL(employee.commissionPerHour)}/hora`);
    }
    if (employee.commissionPerAlqueire && employee.commissionPerAlqueire > 0) {
      commissionParts.push(`${formatCurrencyBRL(employee.commissionPerAlqueire)}/alqueire`);
    }
    if (employee.commissionPerHectare && employee.commissionPerHectare > 0) {
      commissionParts.push(`${formatCurrencyBRL(employee.commissionPerHectare)}/hectare`);
    }
  }

  const commissionText = commissionParts.length > 0
    ? commissionParts.join(' • ')
    : (employee.receivesCommission ? 'Comissão Ativa' : 'Sem comissão adicional');

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 9pt; line-height: 1.4;">
      
      <!-- IDENTIFICAÇÃO E FOTO -->
      <div style="display: flex; gap: 14px; margin-bottom: 12px; align-items: stretch;">
        <div style="width: 115px; flex-shrink: 0; text-align: center; display: flex; flex-direction: column; justify-content: center;">
          ${photoBlock}
          <div style="font-size: 7.5pt; color: #64748b; margin-top: 4px; font-weight: 600;">Identificação Civil</div>
        </div>

        <div style="flex: 1;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; font-size: 8.5pt;">
            <tbody>
              <tr>
                <td style="width: 25%; background: #f8fafc; font-weight: bold; color: #475569; padding: 6px 8px; border: 1px solid #cbd5e1;">Nome Completo:</td>
                <td colspan="3" style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10.5pt; font-weight: 800; color: #0f172a;">
                  ${employee.name || '—'}
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 6px 8px; border: 1px solid #cbd5e1;">Função / Cargo:</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #047857;">
                  ${employee.role || '—'}
                </td>
                <td style="width: 22%; background: #f8fafc; font-weight: bold; color: #475569; padding: 6px 8px; border: 1px solid #cbd5e1;">Tipo Cadastro:</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">
                  ${employee.registrationType || 'Funcionário'}
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 6px 8px; border: 1px solid #cbd5e1;">Regime Contratual:</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">
                  ${employee.contractType || 'Registrado (CLT)'}
                </td>
                <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 6px 8px; border: 1px solid #cbd5e1;">Data Admissão:</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">
                  ${employee.admissionDate ? formatDateBR(employee.admissionDate) : '—'}
                </td>
              </tr>
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 6px 8px; border: 1px solid #cbd5e1;">Status Atual:</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: ${employee.active !== false && employee.status !== 'inativo' ? '#047857' : '#e11d48'};">
                  ${employee.active !== false && employee.status !== 'inativo' ? 'ATIVO NO QUADRO' : 'INATIVO / DESLIGADO'}
                </td>
                <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 6px 8px; border: 1px solid #cbd5e1;">Contato / Telefone:</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600;">
                  ${employee.phone || 'Não informado'}
                </td>
              </tr>
              ${employee.actingRegion ? `
              <tr>
                <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 6px 8px; border: 1px solid #cbd5e1;">Região de Atuação:</td>
                <td colspan="3" style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #c2410c; text-transform: uppercase;">
                  📍 ${employee.actingRegion}
                </td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </div>

      <!-- SEÇÃO 1: DOCUMENTOS PESSOAIS -->
      <div style="background: #0f766e; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; margin: 10px 0 4px 0; letter-spacing: 0.5px;">
        1. Documentação Pessoal & Trabalhista
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8.5pt;">
        <tbody>
          <tr>
            <td style="width: 20%; background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">CPF:</td>
            <td style="width: 30%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">
              ${employee.cpf || 'Não informado'}
            </td>
            <td style="width: 20%; background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">RG (Cédula Identidade):</td>
            <td style="width: 30%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold;">
              ${employee.rg || 'Não informado'}
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">PIS / PASEP:</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">
              ${employee.pis || 'Não informado'}
            </td>
            <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Data Nascimento:</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">
              ${employee.birthDate ? `${formatDateBR(employee.birthDate)} ${age !== null ? `(${age} anos)` : ''}` : 'Não informado'}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- SEÇÃO 2: DADOS DE HABILITAÇÃO (CNH) -->
      <div style="background: #0f766e; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; margin: 10px 0 4px 0; letter-spacing: 0.5px;">
        2. Habilitação de Trânsito / CNH & Qualificação
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8.5pt;">
        <tbody>
          <tr>
            <td style="width: 20%; background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Nº Registro CNH:</td>
            <td style="width: 30%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">
              ${employee.cnhNumber || 'Sem CNH cadastrada'}
            </td>
            <td style="width: 20%; background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Categoria Atual:</td>
            <td style="width: 30%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold;">
              ${employee.cnhCategory ? `Categoria ${employee.cnhCategory}` : '—'}
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Validade da CNH:</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 600;">
              ${employee.cnhExpiration ? formatDateBR(employee.cnhExpiration) : 'Não informada'}
            </td>
            <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Melhorar Categoria (DT):</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">
              ${employee.cnhUpgradeDT ? `<strong style="color: #047857;">SIM (Plano/Pretensão: Cat. ${employee.cnhUpgradeCategory || 'A'})</strong>` : 'Não solicitada'}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- SEÇÃO 3: INFORMAÇÕES FINANCEIRAS E PAGAMENTO -->
      <div style="background: #0f766e; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; margin: 10px 0 4px 0; letter-spacing: 0.5px;">
        3. Informações Financeiras & Dados para Pagamento
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8.5pt;">
        <tbody>
          <tr>
            <td style="width: 20%; background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Local Recebimento:</td>
            <td style="width: 30%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 600;">
              ${employee.paymentLocation || 'Sede da Empresa / Matriz'}
            </td>
            <td style="width: 20%; background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Banco / Chave PIX:</td>
            <td style="width: 30%; padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">
              ${employee.bankPixKey || 'Não informada'}
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Agência Bancária:</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">
              ${employee.bankAgency || 'Não informada'}
            </td>
            <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Conta Corrente:</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">
              ${employee.bankAccount || 'Não informada'}
            </td>
          </tr>
          <tr>
            <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Salário Base (R$):</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 800; color: #047857; font-size: 9.5pt;">
              ${formatCurrencyBRL(salary)}
            </td>
            <td style="background: #f8fafc; font-weight: bold; color: #475569; padding: 5px 8px; border: 1px solid #cbd5e1;">Comissões de Campo:</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 600;">
              ${commissionText}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- SEÇÃO 4: PROTOCOLO DE ANEXOS E DOCUMENTOS DE RETORNO -->
      <div style="background: #0f766e; color: #ffffff; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; margin: 10px 0 4px 0; letter-spacing: 0.5px;">
        4. Protocolo de Anexos & Arquivos de Retorno (RH)
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8pt;">
        <thead>
          <tr style="background: #f1f5f9; text-transform: uppercase; font-size: 7.5pt; color: #334155;">
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: left; width: 40%;">Documento Obrigatório</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: left; width: 35%;">Status no Sistema Digital</th>
            <th style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; width: 25%;">Data de Entrega</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: 600;">Exame Médico Admissional (ASO)</td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; color: ${employee.admissionExamDoc ? '#047857' : '#e11d48'}; font-weight: bold;">
              ${employee.admissionExamDoc ? `[ X ] ANEXADO (${employee.admissionExamDoc.name})` : '[ &nbsp; ] PENDENTE DE ENTREGA'}
            </td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; text-align: center;">
              ${employee.admissionExamDoc?.uploadedAt ? formatDateBR(employee.admissionExamDoc.uploadedAt) : '____/____/________'}
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: 600;">Contrato de Trabalho / Experiência</td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; color: ${employee.experienceContractDoc ? '#047857' : '#e11d48'}; font-weight: bold;">
              ${employee.experienceContractDoc ? `[ X ] ANEXADO (${employee.experienceContractDoc.name})` : '[ &nbsp; ] PENDENTE DE ENTREGA'}
            </td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; text-align: center;">
              ${employee.experienceContractDoc?.uploadedAt ? formatDateBR(employee.experienceContractDoc.uploadedAt) : '____/____/________'}
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: 600;">Documentos Gerais (RE + CNH)</td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; color: ${employee.generalDocs ? '#047857' : '#e11d48'}; font-weight: bold;">
              ${employee.generalDocs ? `[ X ] ANEXADO (${employee.generalDocs.name})` : '[ &nbsp; ] PENDENTE DE ENTREGA'}
            </td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; text-align: center;">
              ${employee.generalDocs?.uploadedAt ? formatDateBR(employee.generalDocs.uploadedAt) : '____/____/________'}
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-weight: 600;">Ficha Cadastral Assinada (Via Física)</td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; color: ${employee.signedRegistrationDoc ? '#047857' : '#d97706'}; font-weight: bold;">
              ${employee.signedRegistrationDoc ? `[ X ] DIGITALIZADA (${employee.signedRegistrationDoc.name})` : '[ &nbsp; ] AGUARDANDO ASSINATURA DESTA VIA'}
            </td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; text-align: center;">
              ${employee.signedRegistrationDoc?.uploadedAt ? formatDateBR(employee.signedRegistrationDoc.uploadedAt) : '____/____/________'}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- TERMO LEGAL E DECLARAÇÃO DE VERACIDADE -->
      <div style="margin-top: 10px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; font-size: 7.5pt; color: #334155; text-align: justify; line-height: 1.35;">
        <strong>TERMO DE RESPONSABILIDADE E DECLARAÇÃO:</strong> Declaro para todos os fins de direito que as informações cadastrais, documentais e bancárias acima registradas são verídicas e de minha total responsabilidade. Autorizo a realização de créditos remuneratórios, comissões operacionais e diárias na conta corrente / chave PIX especificada. Comprometo-me formalmente a notificar de imediato o setor de Recursos Humanos de qualquer alteração de dados de contato, dados bancários ou situação de minha Carteira Nacional de Habilitação.
      </div>

    </div>
  `;
}

/**
 * Formats a clean, readable text message for WhatsApp sharing of employee registration.
 */
export function generateEmployeeWhatsAppText(
  employee: Partial<Employee>,
  company?: CompanyProfile | null
): string {
  const companyName = company?.tradeName?.toUpperCase() || 'SILAGEM FÁCIL';
  const now = new Date();
  const dateStr = formatDateBR(now.toISOString().split('T')[0]);
  const salary = employee.baseSalary !== undefined ? employee.baseSalary : (employee.salary || 0);

  let text = `🚜 *${companyName}*\n`;
  text += `📋 *FICHA CADASTRAL DE COLABORADOR*\n`;
  text += `📅 *Data de Emissão:* ${dateStr}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `👤 *Nome:* ${employee.name || 'Não informado'}\n`;
  text += `💼 *Cargo:* ${employee.role || 'Não informado'}\n`;
  if (employee.actingRegion) text += `📍 *Região de Atuação:* ${employee.actingRegion}\n`;
  text += `📄 *Tipo Cadastro:* ${employee.registrationType || 'Funcionário'}\n`;
  text += `📝 *Regime:* ${employee.contractType || 'CLT'}\n`;
  if (employee.admissionDate) text += `📅 *Admissão:* ${formatDateBR(employee.admissionDate)}\n`;
  if (employee.phone) text += `📞 *Telefone:* ${employee.phone}\n`;

  text += `\n*DOCUMENTOS:*\n`;
  if (employee.cpf) text += `• CPF: ${employee.cpf}\n`;
  if (employee.rg) text += `• RG: ${employee.rg}\n`;
  if (employee.pis) text += `• PIS: ${employee.pis}\n`;
  if (employee.birthDate) text += `• Nasc.: ${formatDateBR(employee.birthDate)}\n`;

  if (employee.cnhNumber || employee.cnhExpiration) {
    text += `\n*HABILITAÇÃO / CNH:*\n`;
    text += `• CNH: ${employee.cnhNumber || 'Não informada'} (Cat. ${employee.cnhCategory || '-'})\n`;
    if (employee.cnhExpiration) text += `• Validade: ${formatDateBR(employee.cnhExpiration)}\n`;
    if (employee.cnhUpgradeDT) text += `• Incentivo DT: Pretensão Cat. ${employee.cnhUpgradeCategory || 'A'}\n`;
  }

  text += `\n*FINANCEIRO & PAGAMENTO:*\n`;
  text += `• Salário Base: ${formatCurrencyBRL(salary)}\n`;
  if (employee.brokerCommissionValue !== undefined && employee.brokerCommissionValue > 0) {
    if (employee.brokerCommissionType === 'Valor Fixo por contrato/pedido') {
      text += `• Comissão Agenciador: ${formatCurrencyBRL(employee.brokerCommissionValue)} (Fixo por pedido)\n`;
    } else {
      text += `• Comissão Agenciador: ${employee.brokerCommissionValue}% (${employee.brokerCommissionType?.includes('produção') ? 's/ Produção' : 's/ Pedido'})\n`;
    }
  } else if (employee.receivesCommission) {
    if (employee.commissionPerHour) text += `• Comissão/Hora: ${formatCurrencyBRL(employee.commissionPerHour)}/h\n`;
    if (employee.commissionPerAlqueire) text += `• Comissão/Alqueire: ${formatCurrencyBRL(employee.commissionPerAlqueire)}/alq\n`;
    if (employee.commissionPerHectare) text += `• Comissão/Hectare: ${formatCurrencyBRL(employee.commissionPerHectare)}/ha\n`;
  }
  if (employee.paymentLocation) text += `• Local: ${employee.paymentLocation}\n`;
  if (employee.bankPixKey) text += `• Chave PIX/Banco: ${employee.bankPixKey}\n`;
  if (employee.bankAgency || employee.bankAccount) {
    text += `• Agência: ${employee.bankAgency || '-'} | Conta: ${employee.bankAccount || '-'}\n`;
  }

  text += `\n_Documento emitido eletronicamente via Sistema Silagem Fácil Pro_`;

  return text;
}
