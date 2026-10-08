import React, { useState, useEffect } from 'react';
import { Building2, FileText, CheckCircle2 } from 'lucide-react';
import { Employee, CompanyProfile, PayrollCommissionItem, PayrollDeductionItem } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { formatCPF, formatEmployeeAdmissionDate, formatEmployeeBankDeposit, getFaixaIrrf } from './payrollHelpers';
import { hasEmployeePixPayment, getEmployeePixKey, generatePixPayload, getPixQrCodeUrl, findEmployeeFromStorage } from './pixUtils';
import { generateQrCodeDataUrl, buildOfficialPixBrCode } from './pixQrCodeHelper';
import { QRCode } from './PixQrCodeBlock';
import { getStoredVerbasRH, updateVerbaInStorage, findVerbaByCodigo } from './verbasRH';

interface LivePayslipPreviewProps {
  companyProfile: CompanyProfile;
  employee?: Employee;
  currentMonthRef: string;
  baseSalary: number;
  admissionInfo?: {
    isAdmittedInCompetenceMonth: boolean;
    daysWorked: number;
    proportionalSalary: number;
    fullContractualSalary: number;
    admissionDate?: string;
  } | null;
  overtimeAmount: number;
  bonusAmount: number;
  commissionAmount: number;
  commissionItems: PayrollCommissionItem[];
  activeCommissionTotal: number;
  inssDiscount: number;
  inssEnabled: boolean;
  aliquotaInssStr: string;
  irrfDiscount: number;
  irrfEnabled: boolean;
  aliquotaIrrfStr: string;
  sindicalDiscount: number;
  sindicalEnabled: boolean;
  aliquotaSindicatoStr: string;
  deductionItems: PayrollDeductionItem[];
  advancesDiscount: number;
  otherDiscounts: number;
  activeListDeductions: number;
  modalGrossTotal: number;
  modalDiscountsTotal: number;
  calculatedModalNet: number;
  baseCalculoInssFgts: number;
  baseSalaryContratual: number;
  customVerbaOverrides?: Record<string, { codigo: string; descricao: string }>;
  onUpdateVerba?: (rowKey: string, codigo: string, descricao: string) => void;
}

export const LivePayslipPreview: React.FC<LivePayslipPreviewProps> = ({
  companyProfile,
  employee,
  currentMonthRef,
  baseSalary,
  admissionInfo,
  overtimeAmount,
  bonusAmount,
  commissionItems,
  activeCommissionTotal,
  inssDiscount,
  inssEnabled,
  aliquotaInssStr,
  irrfDiscount,
  irrfEnabled,
  aliquotaIrrfStr,
  sindicalDiscount,
  sindicalEnabled,
  aliquotaSindicatoStr,
  deductionItems,
  advancesDiscount,
  otherDiscounts,
  modalGrossTotal,
  modalDiscountsTotal,
  calculatedModalNet,
  baseCalculoInssFgts,
  baseSalaryContratual,
  customVerbaOverrides = {},
  onUpdateVerba,
}) => {
  const tradeName =
    companyProfile?.tradeName ||
    companyProfile?.companyName ||
    companyProfile?.corporateName ||
    'COLAÇA SILAGEM';

  const cnpj = companyProfile?.cnpjCpf || (companyProfile as any)?.cnpj || '';
  const todayStr = formatDateBR(new Date().toISOString().split('T')[0]);

  const activeInss = inssEnabled ? (inssDiscount || 0) : 0;
  const activeIrrf = irrfEnabled ? (irrfDiscount || 0) : 0;
  const activeSindical = sindicalEnabled ? (sindicalDiscount || 0) : 0;

  // Estado para edição direta e reativa nas células (Cód e Descrição)
  const [editingCell, setEditingCell] = useState<{ rowKey: string; field: 'codigo' | 'descricao' } | null>(null);
  const [cellDraft, setCellDraft] = useState<string>('');

  // 1. Apuração Inteligente das Faltas (Falta é Falta -> Rubrica 501 - FALTAS INTEGRADAS (DIAS))
  const faltasList = deductionItems.filter(
    (d) =>
      d.verbaCode === '501' ||
      d.type === 'Falta / Atraso' ||
      d.description?.toLowerCase().includes('falta') ||
      d.description?.toLowerCase().includes('dias anteriores')
  );
  const faltasTotal = faltasList.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

  // Calcula referência de faltas (dias acumulados)
  const faltasRef = (() => {
    if (faltasList.length === 0) return '0d';
    let totalDias = 0;
    faltasList.forEach((it) => {
      const match = it.description?.match(/(\d+)\s*(d|dia|dias)/i);
      if (match) {
        totalDias += parseInt(match[1], 10);
      } else {
        totalDias += 1;
      }
    });
    return `${totalDias}d`;
  })();

  // 2. Apuração dos Vales / Adiantamentos (Rubrica 502 / 110)
  const valesList = deductionItems.filter(
    (d) =>
      !faltasList.includes(d) &&
      (d.verbaCode === '502' ||
        d.verbaCode === '110' ||
        d.type === 'Vale / Adiantamento' ||
        d.description?.toLowerCase().includes('vale') ||
        d.description?.toLowerCase().includes('adiantamento'))
  );
  const valesTotal =
    valesList.length > 0
      ? valesList.reduce((acc, it) => acc + (Number(it.amount) || 0), 0)
      : advancesDiscount || 0;

  // 3. Apuração de Equipamentos / Avarias / Peças (Rubrica 503)
  const avariasList = deductionItems.filter(
    (d) =>
      !faltasList.includes(d) &&
      !valesList.includes(d) &&
      (d.verbaCode === '503' ||
        d.type === 'Peças / Oficina' ||
        d.type?.toLowerCase().includes('avaria') ||
        d.type?.toLowerCase().includes('equipamento') ||
        d.description?.toLowerCase().includes('peça') ||
        d.description?.toLowerCase().includes('peca') ||
        d.description?.toLowerCase().includes('avaria') ||
        d.description?.toLowerCase().includes('equipamento'))
  );
  const avariasTotal = avariasList.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

  // 4. Outros Descontos manuais isolados (não agrupados nos anteriores)
  const outrosList = deductionItems.filter(
    (d) =>
      !faltasList.includes(d) &&
      !valesList.includes(d) &&
      !avariasList.includes(d) &&
      !d.type?.toLowerCase().includes('sindicat') &&
      !d.description?.toLowerCase().includes('sindicat')
  );

  // Helper para resolver Código e Descrição (respeitando overrides do colaborador ou dicionário do LocalStorage)
  const resolveVerba = (rowKey: string, defaultCod: string, defaultDesc: string) => {
    if (customVerbaOverrides[rowKey]) {
      return customVerbaOverrides[rowKey];
    }
    const fromStorage = findVerbaByCodigo(defaultCod);
    if (fromStorage) {
      return { codigo: fromStorage.codigo, descricao: fromStorage.descricao };
    }
    return { codigo: defaultCod, descricao: defaultDesc };
  };

  const handleStartEdit = (rowKey: string, field: 'codigo' | 'descricao', currentValue: string) => {
    setEditingCell({ rowKey, field });
    setCellDraft(currentValue);
  };

  const handleCommitEdit = (
    rowKey: string,
    field: 'codigo' | 'descricao',
    value: string,
    defaultCod: string,
    defaultDesc: string
  ) => {
    const current = resolveVerba(rowKey, defaultCod, defaultDesc);
    const clean = value.trim().toUpperCase();
    const nextCod = field === 'codigo' ? (clean || current.codigo) : current.codigo;
    const nextDesc = field === 'descricao' ? (clean || current.descricao) : current.descricao;

    // Dispara a gravação reativa no fechamento atual da folha do colaborador
    onUpdateVerba?.(rowKey, nextCod, nextDesc);

    // Também atualiza o dicionário no LocalStorage para persistência global
    updateVerbaInStorage(nextCod, nextDesc);

    setEditingCell(null);
  };

  // Renderizador compacto de células Cód e Descrição com suporte a clique e duplo clique
  const renderEditableCells = (rowKey: string, defaultCod: string, defaultDesc: string) => {
    const verba = resolveVerba(rowKey, defaultCod, defaultDesc);
    const isEditingCod = editingCell?.rowKey === rowKey && editingCell?.field === 'codigo';
    const isEditingDesc = editingCell?.rowKey === rowKey && editingCell?.field === 'descricao';

    return (
      <>
        {isEditingCod ? (
          <td className="py-0.5 px-1 w-12 align-middle">
            <input
              type="text"
              autoFocus
              value={cellDraft}
              onChange={(e) => setCellDraft(e.target.value.toUpperCase())}
              onBlur={() => handleCommitEdit(rowKey, 'codigo', cellDraft, defaultCod, defaultDesc)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitEdit(rowKey, 'codigo', cellDraft, defaultCod, defaultDesc);
                if (e.key === 'Escape') setEditingCell(null);
              }}
              className="w-12 h-5 px-1 py-0 text-[9.5px] font-mono font-bold uppercase text-stone-900 bg-white border border-[#0963cb] rounded shadow-inner outline-none ring-1 ring-[#0963cb]"
            />
          </td>
        ) : (
          <td
            onClick={() => handleStartEdit(rowKey, 'codigo', verba.codigo)}
            onDoubleClick={() => handleStartEdit(rowKey, 'codigo', verba.codigo)}
            className="py-1 px-2 text-stone-500 font-mono text-[9.5px] cursor-pointer hover:bg-blue-50/80 hover:text-[#0963cb] hover:outline-dashed hover:outline-1 hover:outline-blue-400 rounded transition select-none group/cell relative"
            title="Clique ou duplo clique para editar o código"
          >
            <span className="font-bold group-hover/cell:underline">{verba.codigo}</span>
          </td>
        )}

        {isEditingDesc ? (
          <td className="py-0.5 px-1 align-middle">
            <input
              type="text"
              autoFocus
              value={cellDraft}
              onChange={(e) => setCellDraft(e.target.value.toUpperCase())}
              onBlur={() => handleCommitEdit(rowKey, 'descricao', cellDraft, defaultCod, defaultDesc)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitEdit(rowKey, 'descricao', cellDraft, defaultCod, defaultDesc);
                if (e.key === 'Escape') setEditingCell(null);
              }}
              className="w-full h-5 px-1.5 py-0 text-[9.5px] font-bold uppercase text-stone-900 bg-white border border-[#0963cb] rounded shadow-inner outline-none ring-1 ring-[#0963cb]"
            />
          </td>
        ) : (
          <td
            onClick={() => handleStartEdit(rowKey, 'descricao', verba.descricao)}
            onDoubleClick={() => handleStartEdit(rowKey, 'descricao', verba.descricao)}
            className="py-1 px-2 font-semibold text-stone-900 text-[10px] uppercase cursor-pointer hover:bg-blue-50/80 hover:text-[#0963cb] hover:outline-dashed hover:outline-1 hover:outline-blue-400 rounded transition select-none group/cell relative"
            title="Clique ou duplo clique para editar a descrição da verba"
          >
            <span className="group-hover/cell:underline">{verba.descricao}</span>
          </td>
        )}
      </>
    );
  };

  const baseCalculo = baseCalculoInssFgts || baseSalaryContratual || baseSalary || 0;
  const fgtsMes = Math.round((baseCalculo * 0.08) * 100) / 100;
  const baseIrrf = Math.max(0, baseCalculo - activeInss);
  const faixaIrrf = getFaixaIrrf(baseIrrf);

  // Verificação e geração do PIX Dinâmico para exibição no holerite (ativação por chave preenchida)
  const resolvedEmp = employee || findEmployeeFromStorage(employee?.id || employee?.name);
  const pixKey = getEmployeePixKey(resolvedEmp);
  const isPixPayment = Boolean(pixKey);
  const employeeBeneficiaryName = resolvedEmp?.name || employee?.name || 'COLABORADOR';
  const pixPayload = isPixPayment ? buildOfficialPixBrCode(
    pixKey,
    calculatedModalNet,
    employeeBeneficiaryName
  ) : '';

  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string>(() => {
    return pixPayload ? getPixQrCodeUrl(pixPayload, 180) : '';
  });

  useEffect(() => {
    let isMounted = true;
    if (!pixPayload) {
      setPixQrCodeUrl('');
      return;
    }
    generateQrCodeDataUrl(pixPayload).then((dataUrl) => {
      if (isMounted && dataUrl) {
        setPixQrCodeUrl(dataUrl);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [pixPayload]);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Top Banner de Status Live */}
      <div className="w-full max-w-[580px] flex items-center justify-between pb-2 text-stone-600 dark:text-stone-300 text-xs font-bold">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-[#0963cb]" />
          <span>Espelho do Holerite Oficial (Ao Vivo)</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Tempo Real
        </span>
      </div>

      {/* Folha Física Branca Estilizada */}
      <div 
        id="live-holerite-sheet"
        className="w-full max-w-[580px] bg-white text-stone-900 rounded-xl shadow-lg border border-stone-300 p-4 sm:p-5 space-y-3 font-sans transition-all text-xs"
      >
        {/* TOPO: Dados da Empresa e do Recibo */}
        <div className="flex items-start justify-between border-b-2 border-stone-800 pb-2.5 gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center shrink-0 text-[#0963cb] overflow-hidden p-0.5">
              {companyProfile?.logoUrl ? (
                <img src={companyProfile.logoUrl} alt={tradeName} className="max-w-full max-h-full object-contain" />
              ) : (
                <Building2 className="w-6 h-6 stroke-[1.8]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-xs sm:text-sm font-black tracking-tight text-stone-900 uppercase truncate font-['Outfit']">
                  {tradeName}
                </h4>
                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-blue-50 text-[#0963cb] border border-blue-200">
                  Holerite
                </span>
              </div>
              <p className="text-[10px] text-stone-600 truncate mt-0.5">
                {cnpj ? `CNPJ/CPF: ${cnpj}` : 'Gestão Agrícola e Operações de Silagem'}
                {companyProfile?.city && ` • ${companyProfile.city}/${companyProfile.state || 'ES'}`}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[11px] font-black text-stone-900 uppercase tracking-tight font-['Outfit']">
              Recibo de Salário
            </p>
            <p className="text-[10px] text-stone-600">
              Ref: <strong className="text-[#0963cb] font-bold">{currentMonthRef}</strong>
            </p>
            <p className="text-[9.5px] text-stone-500">
              Emissão: <strong>{todayStr}</strong>
            </p>
          </div>
        </div>

        {/* DADOS DO COLABORADOR */}
        <div className="border border-stone-300 rounded-lg p-2 bg-stone-50/80 flex flex-row items-stretch justify-between w-full gap-3 sm:gap-4 print:gap-3">
          {/* Sub-bloco da Esquerda: Dados textuais do colaborador */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1 text-[11px]">
              <div className="col-span-2 sm:col-span-2">
                <span className="text-stone-500 block text-[9px] font-bold uppercase leading-none">Colaborador:</span>
                <span className="font-bold text-stone-900 block mt-0.5">
                  {employee?.name || 'Selecione um funcionário...'}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px] font-bold uppercase leading-none">Cargo:</span>
                <span className="font-semibold text-stone-800 truncate block mt-0.5">
                  {employee?.role || '--'}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px] font-bold uppercase leading-none">CPF:</span>
                <span className="font-semibold text-stone-800 block mt-0.5">
                  {formatCPF(employee?.cpf)}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px] font-bold uppercase leading-none">Admissão:</span>
                <span className="font-semibold text-stone-800 block mt-0.5">
                  {formatEmployeeAdmissionDate(employee?.admissionDate)}
                  {admissionInfo?.isAdmittedInCompetenceMonth && (
                    <span className="text-amber-800 font-extrabold ml-1">({admissionInfo.daysWorked}d)</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[9px] font-bold uppercase leading-none">Regime:</span>
                <span className="font-semibold text-stone-800 block mt-0.5">
                  {employee?.contractType || 'CLT'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-stone-500 block text-[9px] font-bold uppercase leading-none">DEPÓSITO / FORMA DE PAGAMENTO:</span>
                <span className="font-semibold text-stone-800 truncate block mt-0.5 uppercase text-[10px]" title={formatEmployeeBankDeposit(resolvedEmp || employee)}>
                  {formatEmployeeBankDeposit(resolvedEmp || employee)}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-bloco da Direita: Espaço isolado e dedicado exclusivamente para o QR Code do PIX */}
          {isPixPayment && pixPayload && (
            <div className="flex flex-col items-center justify-center p-1.5 border border-slate-200 rounded bg-white shrink-0 self-center">
              <QRCode value={pixPayload} size={70} className="mx-auto" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight text-center mt-1.5 w-full block">
                QR CODE PIX PARA PAGAMENTO
              </span>
            </div>
          )}
        </div>

        {/* CENTRO: QUADRO OFICIAL DE VERBAS */}
        <div className="border border-stone-300 rounded-lg overflow-hidden">
          <div className="bg-stone-50 border-b border-stone-200 px-2 py-0.5 flex items-center justify-between text-[8px] text-stone-500 font-bold uppercase tracking-wider">
            <span>Quadro Oficial de Verbas • Edição Direta Destravada</span>
            <span>(Clique ou dê duplo clique nas células Cód / Descrição para editar)</span>
          </div>
          <table className="w-full text-[10.5px]">
            <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[9px] border-b border-stone-300">
              <tr>
                <th className="py-1.5 px-2 text-left w-12">Cód</th>
                <th className="py-1.5 px-2 text-left">Descrição da Verba</th>
                <th className="py-1.5 px-1.5 text-center w-14">Ref.</th>
                <th className="py-1.5 px-2 text-right w-24">Proventos</th>
                <th className="py-1.5 px-2 text-right w-24">Descontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {/* Salário Base */}
              <tr>
                {renderEditableCells('salario_base', '001', 'SALÁRIO BASE MENSAL')}
                <td className="py-1 px-1.5 text-center text-stone-600 font-medium text-[9.5px]">
                  {admissionInfo?.isAdmittedInCompetenceMonth ? `${admissionInfo.daysWorked}d` : '30d'}
                </td>
                <td className="py-1 px-2 text-right font-bold text-emerald-700 font-['Outfit']">
                  {formatCurrencyBRL(baseSalary)}
                </td>
                <td className="py-1 px-2 text-right text-stone-300">-</td>
              </tr>

              {/* Horas Extras */}
              {overtimeAmount > 0 && (
                <tr>
                  {renderEditableCells('horas_extras', '012', 'HORAS EXTRAS / ADICIONAL SAFRA & COLHEITA')}
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px]">--</td>
                  <td className="py-1 px-2 text-right font-bold text-emerald-700 font-['Outfit']">
                    {formatCurrencyBRL(overtimeAmount)}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                </tr>
              )}

              {/* Bônus */}
              {bonusAmount > 0 && (
                <tr>
                  {renderEditableCells('bonus', '024', 'INSALUBRIDADE / BÔNUS PRODUTIVIDADE')}
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px]">--</td>
                  <td className="py-1 px-2 text-right font-bold text-emerald-700 font-['Outfit']">
                    {formatCurrencyBRL(bonusAmount)}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                </tr>
              )}

              {/* Comissões de Silagem */}
              {activeCommissionTotal > 0 && (
                <tr>
                  {renderEditableCells('comissao', '035', 'COMISSÕES VARIÁVEIS DE SILAGEM / PRODUÇÃO')}
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px]">
                    {commissionItems.length > 0 ? `${commissionItems.length} OS` : '--'}
                  </td>
                  <td className="py-1 px-2 text-right font-bold text-emerald-700 font-['Outfit']">
                    {formatCurrencyBRL(activeCommissionTotal)}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                </tr>
              )}

              {/* INSS */}
              {activeInss > 0 && (
                <tr>
                  {renderEditableCells('inss', '101', 'DESCONTO PREVIDÊNCIA SOCIAL (INSS)')}
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px] font-bold">
                    {aliquotaInssStr ? `${aliquotaInssStr}%` : 'Oficial'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(activeInss)}
                  </td>
                </tr>
              )}

              {/* IRRF */}
              {activeIrrf > 0 && (
                <tr>
                  {renderEditableCells('irrf', '102', 'RETENÇÃO IMPOSTO DE RENDA (IRRF)')}
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px] font-bold">
                    {aliquotaIrrfStr ? `${aliquotaIrrfStr}%` : 'Oficial'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(activeIrrf)}
                  </td>
                </tr>
              )}

              {/* Taxa Sindical / Contribuição Sindical */}
              {activeSindical > 0 && (
                <tr>
                  {renderEditableCells('sindicato', '504', 'DESCONTO CONTRIBUIÇÃO SINDICAL')}
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px] font-bold">
                    {aliquotaSindicatoStr ? `${aliquotaSindicatoStr}%` : '1,0%'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(activeSindical)}
                  </td>
                </tr>
              )}

              {/* Faltas Integradas (Falta é Falta -> 501) */}
              {faltasTotal > 0 && (
                <tr>
                  {renderEditableCells('faltas', '501', 'FALTAS INTEGRADAS (DIAS)')}
                  <td className="py-1 px-1.5 text-center text-amber-900 font-bold text-[9.5px]">
                    {faltasRef}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(faltasTotal)}
                  </td>
                </tr>
              )}

              {/* Vales / Adiantamentos (Rubrica 502) */}
              {valesTotal > 0 && (
                <tr>
                  {renderEditableCells('vales', '502', 'ADIANTAMENTO DE SALÁRIO (VALE)')}
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px]">
                    {valesList.length > 0 ? `${valesList.length} vales` : 'Vales'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(valesTotal)}
                  </td>
                </tr>
              )}

              {/* Equipamentos / Avarias / Peças (Rubrica 503) */}
              {avariasTotal > 0 && (
                <tr>
                  {renderEditableCells('avarias', '503', 'DESCONTO DE EQUIPAMENTOS / AVARIAS')}
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px]">
                    {avariasList.length > 0 ? `${avariasList.length} itens` : '--'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(avariasTotal)}
                  </td>
                </tr>
              )}

              {/* Outros Descontos Isolados */}
              {outrosList.map((it) => {
                const rowKey = `ded_${it.id}`;
                const defCod = it.verbaCode || '503';
                const defDesc = it.verbaDescription || it.description?.toUpperCase() || 'DESCONTO DIVERSO';
                return (
                  <tr key={it.id}>
                    {renderEditableCells(rowKey, defCod, defDesc)}
                    <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px]">--</td>
                    <td className="py-1 px-2 text-right text-stone-300">-</td>
                    <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                      {formatCurrencyBRL(it.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totais do Quadro de Verbas */}
            <tfoot className="bg-stone-50 font-bold border-t border-stone-300 text-[10.5px]">
              <tr>
                <td colSpan={3} className="py-1.5 px-2 text-right text-stone-700">
                  Totais das Verbas:
                </td>
                <td className="py-1.5 px-2 text-right text-emerald-800 font-black font-['Outfit']">
                  {formatCurrencyBRL(modalGrossTotal)}
                </td>
                <td className="py-1.5 px-2 text-right text-rose-700 font-black font-['Outfit']">
                  {formatCurrencyBRL(modalDiscountsTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* RODAPÉ: CARDS DE TOTAIS */}
        <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-stone-50 border border-stone-300">
          <div>
            <span className="text-[8.5px] text-stone-500 font-black uppercase block tracking-wider leading-none">
              Total Bruto (+)
            </span>
            <span className="text-xs font-black text-emerald-800 font-['Outfit'] block mt-0.5">
              {formatCurrencyBRL(modalGrossTotal)}
            </span>
          </div>
          <div>
            <span className="text-[8.5px] text-stone-500 font-black uppercase block tracking-wider leading-none">
              Total Deduções (-)
            </span>
            <span className="text-xs font-black text-rose-700 font-['Outfit'] block mt-0.5">
              - {formatCurrencyBRL(modalDiscountsTotal)}
            </span>
          </div>
          <div className="p-1 rounded-md bg-[#0963cb] text-white text-right pl-2">
            <span className="text-[8px] font-extrabold uppercase text-blue-100 block tracking-wider leading-none">
              Líquido a Pagar
            </span>
            <span className="text-xs sm:text-sm font-black text-white font-['Outfit'] block mt-0.5">
              {formatCurrencyBRL(calculatedModalNet)}
            </span>
          </div>
        </div>

        {/* BADGES CINZAS DE BASES FISCAIS */}
        <div className="grid grid-cols-4 gap-1.5 p-2 bg-stone-100 border border-stone-300 rounded-lg text-center text-xs">
          <div className="bg-white border border-stone-200 rounded p-1 shadow-2xs">
            <span className="text-[8px] font-black uppercase text-stone-500 block leading-none">Base FGTS</span>
            <span className="text-[10.5px] font-black text-stone-900 font-['Outfit'] block mt-0.5 truncate">
              {formatCurrencyBRL(baseCalculo)}
            </span>
          </div>
          <div className="bg-white border border-stone-200 rounded p-1 shadow-2xs">
            <span className="text-[8px] font-black uppercase text-stone-500 block leading-none">FGTS (8%)</span>
            <span className="text-[10.5px] font-black text-[#0963cb] font-['Outfit'] block mt-0.5 truncate">
              {formatCurrencyBRL(fgtsMes)}
            </span>
          </div>
          <div className="bg-white border border-stone-200 rounded p-1 shadow-2xs">
            <span className="text-[8px] font-black uppercase text-stone-500 block leading-none">Base IRRF</span>
            <span className="text-[10.5px] font-black text-stone-900 font-['Outfit'] block mt-0.5 truncate">
              {formatCurrencyBRL(baseIrrf)}
            </span>
          </div>
          <div className="bg-white border border-stone-200 rounded p-1 shadow-2xs">
            <span className="text-[8px] font-black uppercase text-stone-500 block leading-none">Faixa IRRF</span>
            <span className="text-[10.5px] font-black text-stone-800 block mt-0.5 truncate">
              {faixaIrrf}
            </span>
          </div>
        </div>

        {/* QUITAÇÃO E ASSINATURA */}
        <div className="pt-2 border-t border-dashed border-stone-300 space-y-1 text-center">
          <p className="text-[8.5px] text-stone-500 leading-tight italic">
            Declaro ter recebido a importância líquida discriminada neste recibo, referente à quitação das verbas.
          </p>
          <div className="pt-3 max-w-[200px] mx-auto border-b border-stone-400" />
          <p className="text-[9px] font-bold text-stone-700 uppercase">
            {employee?.name || 'Assinatura do Colaborador'}
          </p>
        </div>
      </div>
    </div>
  );
};
