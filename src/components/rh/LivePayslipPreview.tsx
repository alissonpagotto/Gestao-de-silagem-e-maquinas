import React, { useState, useEffect } from 'react';
import { Building2, FileText, CheckCircle2 } from 'lucide-react';
import { Employee, CompanyProfile, PayrollCommissionItem, PayrollDeductionItem } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { formatCPF, formatEmployeeAdmissionDate, formatEmployeeBankDeposit, getFaixaIrrf } from './payrollHelpers';
import { hasEmployeePixPayment, getEmployeePixKey, generatePixPayload, getPixQrCodeUrl, findEmployeeFromStorage } from './pixUtils';
import { generateQrCodeDataUrl, buildOfficialPixBrCode } from './pixQrCodeHelper';
import { QRCode } from './PixQrCodeBlock';

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

  // Separação de vales vs outros descontos para as linhas do holerite
  const valesList = deductionItems.filter(d => d.type === 'Vale / Adiantamento');
  const valesTotal = valesList.length > 0 
    ? valesList.reduce((acc, it) => acc + (Number(it.amount) || 0), 0)
    : (advancesDiscount || 0);

  const outrosList = deductionItems.filter(d => d.type !== 'Vale / Adiantamento');
  const outrosTotal = outrosList.length > 0
    ? outrosList.reduce((acc, it) => acc + (Number(it.amount) || 0), 0)
    : (otherDiscounts || 0);

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
            <div className="flex flex-col items-center justify-center p-2 border border-slate-200 rounded bg-white shrink-0 self-center">
              <QRCode value={pixPayload} size={90} className="mx-auto" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight text-center mt-1.5 w-full block">
                QR CODE PIX PARA PAGAMENTO
              </span>
            </div>
          )}
        </div>

        {/* CENTRO: QUADRO OFICIAL DE VERBAS */}
        <div className="border border-stone-300 rounded-lg overflow-hidden">
          <table className="w-full text-[10.5px]">
            <thead className="bg-stone-100 text-stone-700 font-bold uppercase text-[9px] border-b border-stone-300">
              <tr>
                <th className="py-1.5 px-2 text-left w-10">Cód</th>
                <th className="py-1.5 px-2 text-left">Descrição da Verba</th>
                <th className="py-1.5 px-1.5 text-center w-14">Ref.</th>
                <th className="py-1.5 px-2 text-right w-24">Proventos</th>
                <th className="py-1.5 px-2 text-right w-24">Descontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {/* Salário Base */}
              <tr>
                <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">001</td>
                <td className="py-1 px-2 font-semibold text-stone-900">Salário Base Mensal</td>
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
                  <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">012</td>
                  <td className="py-1 px-2 font-semibold text-stone-900">Horas Extras / Adicional Safra</td>
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
                  <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">024</td>
                  <td className="py-1 px-2 font-semibold text-stone-900">Insalubridade / Bônus</td>
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
                  <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">035</td>
                  <td className="py-1 px-2 font-semibold text-stone-900">
                    Comissões Variáveis de Silagem
                  </td>
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
                  <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">101</td>
                  <td className="py-1 px-2 font-semibold text-stone-900">Desconto Previdência (INSS)</td>
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
                  <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">102</td>
                  <td className="py-1 px-2 font-semibold text-stone-900">Retenção Imposto Renda (IRRF)</td>
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px] font-bold">
                    {aliquotaIrrfStr ? `${aliquotaIrrfStr}%` : 'Oficial'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(activeIrrf)}
                  </td>
                </tr>
              )}

              {/* Taxa Sindical */}
              {activeSindical > 0 && (
                <tr>
                  <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">103</td>
                  <td className="py-1 px-2 font-semibold text-stone-900">Taxa Assistencial Sindicato</td>
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px] font-bold">
                    {aliquotaSindicatoStr ? `${aliquotaSindicatoStr}%` : '1,0%'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(activeSindical)}
                  </td>
                </tr>
              )}

              {/* Vales / Adiantamentos */}
              {valesTotal > 0 && (
                <tr>
                  <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">110</td>
                  <td className="py-1 px-2 font-semibold text-stone-900">Adiantamento Salarial / Vales</td>
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px]">
                    {valesList.length > 0 ? `${valesList.length} vales` : 'Vales'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(valesTotal)}
                  </td>
                </tr>
              )}

              {/* Outros Descontos / Faltas */}
              {outrosTotal > 0 && (
                <tr>
                  <td className="py-1 px-2 text-stone-400 font-mono text-[9.5px]">120</td>
                  <td className="py-1 px-2 font-semibold text-stone-900">Faltas / Peças / Descontos</td>
                  <td className="py-1 px-1.5 text-center text-stone-600 text-[9.5px]">
                    {outrosList.length > 0 ? `${outrosList.length} itens` : '--'}
                  </td>
                  <td className="py-1 px-2 text-right text-stone-300">-</td>
                  <td className="py-1 px-2 text-right font-bold text-rose-700 font-['Outfit']">
                    {formatCurrencyBRL(outrosTotal)}
                  </td>
                </tr>
              )}
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
