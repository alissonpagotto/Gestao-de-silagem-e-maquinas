import React from 'react';
import { Employee, CompanyProfile } from '../../types';
import { formatDateBR, formatCurrencyBRL } from '../../lib/storage';

interface PrintableEmployeeSheetProps {
  employee: Partial<Employee> | null;
  companyProfile?: CompanyProfile | null;
}

export const PrintableEmployeeSheet: React.FC<PrintableEmployeeSheetProps> = ({
  employee,
  companyProfile,
}) => {
  if (!employee) return null;

  const todayBR = new Date().toLocaleDateString('pt-BR');

  // Calculate age if birthDate is present
  const calculatedAge = (() => {
    if (!employee.birthDate) return null;
    const birth = new Date(employee.birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  })();

  const companyName = companyProfile?.tradeName || companyProfile?.companyName || 'Silagem Fácil Gestão Agrícola';
  const companyCnpj = companyProfile?.cnpj || '';
  const companyPhone = companyProfile?.phone || '';
  const companyAddress = [companyProfile?.address, companyProfile?.city, companyProfile?.state]
    .filter(Boolean)
    .join(' - ');

  return (
    <div id="printable-employee-sheet" className="printable-sheet-container">
      <style>{`
        #printable-employee-sheet {
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif;
          color: #1a1a1a;
          line-height: 1.35;
          font-size: 11pt;
        }
        #printable-employee-sheet table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        #printable-employee-sheet th,
        #printable-employee-sheet td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
          font-size: 9.5pt;
        }
        #printable-employee-sheet th {
          background-color: #f1f5f9 !important;
          font-weight: bold;
          color: #0f172a;
          text-transform: uppercase;
          font-size: 8.5pt;
          letter-spacing: 0.5px;
        }
        #printable-employee-sheet .section-header {
          background-color: #0f766e !important;
          color: #ffffff !important;
          font-size: 10pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 6px 10px;
          margin-top: 14px;
          margin-bottom: 6px;
          border-radius: 4px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        #printable-employee-sheet .label-cell {
          font-weight: bold;
          color: #475569;
          width: 28%;
          background-color: #f8fafc;
        }
        #printable-employee-sheet .value-cell {
          color: #0f172a;
        }
        #printable-employee-sheet .signature-box {
          margin-top: 35px;
          display: flex;
          justify-content: space-between;
          page-break-inside: avoid;
        }
        #printable-employee-sheet .signature-line {
          width: 45%;
          text-align: center;
          border-top: 1px solid #334155;
          padding-top: 6px;
          font-size: 9pt;
        }
      `}</style>

      {/* CABEÇALHO DA EMPRESA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #0f766e', paddingBottom: '10px', marginBottom: '14px' }}>
        <div style={{ maxWidth: '70%' }}>
          <h1 style={{ fontSize: '15pt', fontWeight: 'bold', margin: '0 0 2px 0', color: '#0f766e', textTransform: 'uppercase' }}>
            {companyName}
          </h1>
          {companyCnpj && (
            <div style={{ fontSize: '8.5pt', color: '#475569' }}>
              <strong>CNPJ:</strong> {companyCnpj} {companyPhone ? ` | Tel: ${companyPhone}` : ''}
            </div>
          )}
          {companyAddress && (
            <div style={{ fontSize: '8pt', color: '#64748b' }}>
              {companyAddress}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
          <div style={{ fontSize: '7.5pt', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>DOCUMENTO INTERNO</div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#0f172a' }}>FICHA CADASTRAL</div>
          <div style={{ fontSize: '8pt', color: '#475569' }}>Emissão: {todayBR}</div>
        </div>
      </div>

      {/* TÍTULO DO DOCUMENTO */}
      <div style={{ textAlign: 'center', margin: '10px 0 14px 0', backgroundColor: '#f1f5f9', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: 0, fontSize: '12pt', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          CADASTRO DO COLABORADOR & TERMO DE ADMISSÃO
        </h2>
        <div style={{ fontSize: '8.5pt', color: '#64748b', marginTop: '2px' }}>
          Registro Oficial de Colaborador Operacional / Motorista / Prestador de Serviço
        </div>
      </div>

      {/* CORPO PRINCIPAL COM FOTO E DADOS */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '10px' }}>
        {/* Espaço para Foto */}
        <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>
          {employee.photoUrl ? (
            <div style={{ width: '95px', height: '120px', border: '1px solid #94a3b8', borderRadius: '4px', overflow: 'hidden', margin: '0 auto' }}>
              <img 
                src={employee.photoUrl} 
                alt={employee.name || 'Foto'} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ width: '95px', height: '120px', border: '1px dashed #94a3b8', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', margin: '0 auto', fontSize: '8pt', color: '#94a3b8' }}>
              <span>FOTO</span>
              <span>3x4</span>
            </div>
          )}
          <div style={{ fontSize: '7pt', color: '#64748b', marginTop: '4px' }}>Identificação</div>
        </div>

        {/* Tabela de Dados Principais */}
        <div style={{ flex: 1 }}>
          <table>
            <tbody>
              <tr>
                <td className="label-cell" style={{ width: '22%' }}>Nome Completo:</td>
                <td className="value-cell" colSpan={3} style={{ fontSize: '11pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {employee.name || '—'}
                </td>
              </tr>
              <tr>
                <td className="label-cell">Cargo / Função:</td>
                <td className="value-cell" style={{ fontWeight: 'bold' }}>{employee.role || '—'}</td>
                <td className="label-cell" style={{ width: '20%' }}>Tipo Cadastro:</td>
                <td className="value-cell">{employee.registrationType || 'Funcionário'}</td>
              </tr>
              <tr>
                <td className="label-cell">Regime Contrato:</td>
                <td className="value-cell">{employee.contractType || 'Registrado (CLT)'}</td>
                <td className="label-cell">Data Admissão:</td>
                <td className="value-cell">
                  {employee.admissionDate ? formatDateBR(employee.admissionDate) : '—'}
                </td>
              </tr>
              {employee.actingRegion && (
                <tr>
                  <td className="label-cell">Região de Atuação:</td>
                  <td className="value-cell" colSpan={3} style={{ fontWeight: 'bold', color: '#c2410c', textTransform: 'uppercase' }}>
                    📍 {employee.actingRegion}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO 1: DOCUMENTOS PESSOAIS */}
      <div className="section-header">1. Documentação Pessoal & Contato</div>
      <table>
        <tbody>
          <tr>
            <td className="label-cell">Número do RG:</td>
            <td className="value-cell" style={{ fontWeight: 'bold' }}>{employee.rg || 'Não informado'}</td>
            <td className="label-cell">CPF:</td>
            <td className="value-cell" style={{ fontWeight: 'bold' }}>{employee.cpf || 'Não informado'}</td>
          </tr>
          <tr>
            <td className="label-cell">Número do PIS / PASEP:</td>
            <td className="value-cell" style={{ fontWeight: 'bold' }}>{employee.pis || 'Não informado'}</td>
            <td className="label-cell">Data Nascimento:</td>
            <td className="value-cell">
              {employee.birthDate ? `${formatDateBR(employee.birthDate)} ${calculatedAge ? `(${calculatedAge} anos)` : ''}` : 'Não informado'}
            </td>
          </tr>
          <tr>
            <td className="label-cell">Telefone / WhatsApp:</td>
            <td className="value-cell">{employee.phone || 'Não informado'}</td>
            <td className="label-cell">Situação Cadastral:</td>
            <td className="value-cell">
              {employee.active !== false && employee.status !== 'inativo' ? 'ATIVO NO QUADRO' : 'INATIVO / DESLIGADO'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* SEÇÃO 2: DADOS DE HABILITAÇÃO (CNH) */}
      <div className="section-header">2. Habilitação Profissional / CNH</div>
      <table>
        <tbody>
          <tr>
            <td className="label-cell">Nº Registro CNH:</td>
            <td className="value-cell" style={{ fontWeight: 'bold' }}>{employee.cnhNumber || 'Não cadastrado'}</td>
            <td className="label-cell">Categoria Atual:</td>
            <td className="value-cell" style={{ fontWeight: 'bold' }}>
              {employee.cnhCategory ? `Cat. ${employee.cnhCategory}` : 'Sem CNH / Não aplicável'}
            </td>
          </tr>
          <tr>
            <td className="label-cell">Validade CNH:</td>
            <td className="value-cell">
              {employee.cnhExpiration ? formatDateBR(employee.cnhExpiration) : 'Não informada'}
            </td>
            <td className="label-cell">Melhorar Categoria (DT):</td>
            <td className="value-cell">
              {employee.cnhUpgradeDT ? (
                <span style={{ fontWeight: 'bold', color: '#0f766e' }}>
                  SIM - Pretensão / Indicação: {employee.cnhUpgradeCategory || 'A'}
                </span>
              ) : (
                'Não solicitada / Não aplicável'
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* SEÇÃO 3: INFORMAÇÕES DE PAGAMENTO / RECEBIMENTO */}
      <div className="section-header">3. Informações Financeiras & Pagamento</div>
      <table>
        <tbody>
          <tr>
            <td className="label-cell">Local de Recebimento:</td>
            <td className="value-cell" colSpan={3} style={{ fontWeight: 'bold' }}>
              {employee.paymentLocation || 'Sede da Empresa / Matriz'}
            </td>
          </tr>
          <tr>
            <td className="label-cell">Banco / Chave PIX:</td>
            <td className="value-cell" colSpan={3} style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
              {employee.bankPixKey || 'Não informada'}
            </td>
          </tr>
          <tr>
            <td className="label-cell">Agência (Ag.):</td>
            <td className="value-cell">{employee.bankAgency || 'Não informada'}</td>
            <td className="label-cell">Conta Corrente (C.C.):</td>
            <td className="value-cell">{employee.bankAccount || 'Não informada'}</td>
          </tr>
          <tr>
            <td className="label-cell">Salário Base (R$):</td>
            <td className="value-cell" style={{ fontWeight: 'bold' }}>
              {formatCurrencyBRL(employee.baseSalary || employee.salary || 0)}
            </td>
            <td className="label-cell">Comissões:</td>
            <td className="value-cell">
              {employee.brokerCommissionValue !== undefined && employee.brokerCommissionValue > 0 ? (
                <span style={{ fontWeight: 'bold', color: '#0369a1' }}>
                  Agenciador: {employee.brokerCommissionType === 'Valor Fixo por contrato/pedido'
                    ? `${formatCurrencyBRL(employee.brokerCommissionValue)} (Fixo por pedido)`
                    : `${employee.brokerCommissionValue}% (${employee.brokerCommissionType?.includes('produção') ? 's/ Produção' : 's/ Pedido'})`}
                </span>
              ) : employee.receivesCommission ? (
                <span>
                  {employee.commissionPerHour ? `${formatCurrencyBRL(employee.commissionPerHour)}/h ` : ''}
                  {employee.commissionPerAlqueire ? `${formatCurrencyBRL(employee.commissionPerAlqueire)}/alq ` : ''}
                  {employee.commissionPerHectare ? `${formatCurrencyBRL(employee.commissionPerHectare)}/ha` : ''}
                </span>
              ) : (
                'Sem comissão adicional'
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* SEÇÃO 4: CHECKLIST DE DOCUMENTOS DE RETORNO */}
      <div className="section-header">4. Protocolo de Arquivos de Retorno</div>
      <table>
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Documento / Laudo Exigido</th>
            <th style={{ width: '30%' }}>Status no Sistema</th>
            <th style={{ width: '30%' }}>Data de Recepção</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Exame Admissional (ASO)</td>
            <td style={{ fontWeight: employee.admissionExamDoc ? 'bold' : 'normal', color: employee.admissionExamDoc ? '#047857' : '#64748b' }}>
              {employee.admissionExamDoc ? `[ X ] ANEXADO (${employee.admissionExamDoc.name})` : '[   ] PENDENTE'}
            </td>
            <td>{employee.admissionExamDoc?.uploadedAt ? formatDateBR(employee.admissionExamDoc.uploadedAt) : '___/___/______'}</td>
          </tr>
          <tr>
            <td>Contrato de Experiência</td>
            <td style={{ fontWeight: employee.experienceContractDoc ? 'bold' : 'normal', color: employee.experienceContractDoc ? '#047857' : '#64748b' }}>
              {employee.experienceContractDoc ? `[ X ] ANEXADO (${employee.experienceContractDoc.name})` : '[   ] PENDENTE'}
            </td>
            <td>{employee.experienceContractDoc?.uploadedAt ? formatDateBR(employee.experienceContractDoc.uploadedAt) : '___/___/______'}</td>
          </tr>
          <tr>
            <td>Documentos Gerais (RE + CNH)</td>
            <td style={{ fontWeight: employee.generalDocs ? 'bold' : 'normal', color: employee.generalDocs ? '#047857' : '#64748b' }}>
              {employee.generalDocs ? `[ X ] ANEXADO (${employee.generalDocs.name})` : '[   ] PENDENTE'}
            </td>
            <td>{employee.generalDocs?.uploadedAt ? formatDateBR(employee.generalDocs.uploadedAt) : '___/___/______'}</td>
          </tr>
          <tr>
            <td>Cadastro Assinado (Ficha Física)</td>
            <td style={{ fontWeight: employee.signedRegistrationDoc ? 'bold' : 'normal', color: employee.signedRegistrationDoc ? '#047857' : '#64748b' }}>
              {employee.signedRegistrationDoc ? `[ X ] ANEXADO (${employee.signedRegistrationDoc.name})` : '[   ] PENDENTE (Via este termo)'}
            </td>
            <td>{employee.signedRegistrationDoc?.uploadedAt ? formatDateBR(employee.signedRegistrationDoc.uploadedAt) : '___/___/______'}</td>
          </tr>
        </tbody>
      </table>

      {/* TERMO DE COMPROMISSO E DECLARAÇÃO */}
      <div style={{ marginTop: '12px', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#f8fafc', fontSize: '8pt', color: '#334155', textAlign: 'justify' }}>
        <strong>DECLARAÇÃO E TERMO DE CIÊNCIA:</strong> Declaro para os devidos fins que as informações cadastrais e bancárias prestadas acima são a expressão da verdade. Autorizo a realização de pagamentos de proventos, diárias e comissões através dos dados bancários / chave PIX informados. Comprometo-me a comunicar imediatamente qualquer alteração em meus dados cadastrais, habilitação de trânsito ou conta de recebimento.
      </div>

      {/* BLOCO DE ASSINATURAS */}
      <div className="signature-box" style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
        <div className="signature-line" style={{ width: '45%', textAlign: 'center', borderTop: '1px solid #000', paddingTop: '6px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '9.5pt', textTransform: 'uppercase' }}>{employee.name || 'COLABORADOR'}</div>
          <div style={{ fontSize: '8pt', color: '#475569' }}>
            CPF: {employee.cpf || '_____________________'}
          </div>
          <div style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '2px' }}>Assinatura do Colaborador</div>
        </div>

        <div className="signature-line" style={{ width: '45%', textAlign: 'center', borderTop: '1px solid #000', paddingTop: '6px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '9.5pt' }}>{companyName}</div>
          <div style={{ fontSize: '8pt', color: '#475569' }}>
            {companyCnpj ? `CNPJ: ${companyCnpj}` : 'Recursos Humanos / Gestão Operacional'}
          </div>
          <div style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '2px' }}>Assinatura do Responsável / RH</div>
        </div>
      </div>

      <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '7.5pt', color: '#94a3b8' }}>
        Documento gerado eletronicamente em {todayBR} às {new Date().toLocaleTimeString('pt-BR')} via Sistema de Gestão Silagem Fácil Pro.
      </div>
    </div>
  );
};
