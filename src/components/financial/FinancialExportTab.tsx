import React, { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  Printer, 
  FileText, 
  CheckCircle2, 
  Calendar,
  Layers,
  TrendingUp,
  ArrowDownRight
} from 'lucide-react';
import { Expense, SilageOrder, CropSeason, ThirdPartySettlement } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredCompanyProfile } from '../../lib/storage';
import { PrintReportHeader } from '../common/PrintReportHeader';
import { PrintReportFooter } from '../common/PrintReportFooter';

interface FinancialExportTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  seasons: CropSeason[];
  settlements: ThirdPartySettlement[];
}

export const FinancialExportTab: React.FC<FinancialExportTabProps> = ({
  expenses,
  orders,
  seasons,
  settlements,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'dre' | 'despesas' | 'receitas' | 'terceiros'>('dre');

  const totalRevenue = orders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalCosts = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netResult = totalRevenue - totalCosts;

  const handleExportCSV = (type: string) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    if (type === 'despesas') {
      csvContent += 'Data,Descricao,Fornecedor,Categoria,Valor,Status,FormaPagamento\n';
      expenses.forEach((e) => {
        csvContent += `"${e.date}","${e.description}","${e.supplier || ''}","${e.categoryName || ''}",${e.amount},"${e.status}","${e.paymentMethod || ''}"\n`;
      });
    } else if (type === 'receitas') {
      csvContent += 'Data,Cliente,Toneladas,ValorTotal,StatusPagamento,Observacoes\n';
      orders.forEach((o) => {
        csvContent += `"${o.date || o.deliveryDate || o.createdAt}","${o.clientName}",${o.tons},${o.totalAmount},"${o.paymentStatus}","${o.notes || ''}"\n`;
      });
    } else if (type === 'terceiros') {
      csvContent += 'Data,Terceiro,Funcao,Descricao,Bruto,Deducoes,Liquido,Status\n';
      settlements.forEach((s) => {
        csvContent += `"${s.date}","${s.thirdPartyName}","${s.role}","${s.description}",${s.totalAmount},${s.deductions || 0},${s.netAmount},"${s.status}"\n`;
      });
    } else {
      // DRE CSV
      csvContent += 'Item,Valor\n';
      csvContent += `"Receita Total Silagem",${totalRevenue}\n`;
      csvContent += `"Custos Totais Operacionais",${totalCosts}\n`;
      csvContent += `"Resultado Liquido",${netResult}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financeiro_${type}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const companyProfile = getStoredCompanyProfile();

  const getReportTitle = () => {
    switch (selectedFormat) {
      case 'dre': return 'RELATÓRIO DE DRE FINANCEIRO CONSOLIDADO';
      case 'despesas': return 'RELATÓRIO DE DESPESAS E PAGAMENTOS';
      case 'receitas': return 'RELATÓRIO DE FATURAMENTO E RECEITAS';
      case 'terceiros': return 'RELATÓRIO DE ACERTOS DE TERCEIROS';
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Options Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 text-black print:hidden">
        <div>
          <h3 className="text-base font-bold text-black">
            Exportação & Relatórios Gerenciais Financeiros
          </h3>
          <p className="text-xs text-black/80 font-medium mt-0.5">
            Gere demonstrativos em Excel/CSV para contabilidade ou imprima fechamentos de safra
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-[#0963cb] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportCSV(selectedFormat)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar CSV (Excel)</span>
          </button>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex items-center space-x-2 overflow-x-auto shadow-xs print:hidden">
        <button
          type="button"
          onClick={() => setSelectedFormat('dre')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            selectedFormat === 'dre'
              ? 'bg-[#0963cb] text-white shadow-xs'
              : 'bg-slate-100 text-black hover:bg-slate-200'
          }`}
        >
          DRE Consolidado
        </button>
        <button
          type="button"
          onClick={() => setSelectedFormat('despesas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            selectedFormat === 'despesas'
              ? 'bg-[#0963cb] text-white shadow-xs'
              : 'bg-slate-100 text-black hover:bg-slate-200'
          }`}
        >
          Despesas & Pagamentos ({expenses.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedFormat('receitas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            selectedFormat === 'receitas'
              ? 'bg-[#0963cb] text-white shadow-xs'
              : 'bg-slate-100 text-black hover:bg-slate-200'
          }`}
        >
          Receitas de Silagem ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedFormat('terceiros')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            selectedFormat === 'terceiros'
              ? 'bg-[#0963cb] text-white shadow-xs'
              : 'bg-slate-100 text-black hover:bg-slate-200'
          }`}
        >
          Acertos de Terceiros ({settlements.length})
        </button>
      </div>

      {/* Preview Sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4 text-black print:border-none print:shadow-none print:p-0">
        
        {/* Printable Header */}
        <div className="hidden print:block mb-4">
          <PrintReportHeader
            companyProfile={companyProfile}
            reportTitle={getReportTitle()}
            reportSubtitle={`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`}
            documentTypeBadge={selectedFormat.toUpperCase()}
          />
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div>
            <h4 className="font-bold text-black text-base">
              Pré-visualização do Relatório
            </h4>
            <p className="text-xs text-black/75 font-medium">
              Data de Emissão: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full">
            Pronto para Download
          </span>
        </div>

        {selectedFormat === 'dre' && (
          <div className="space-y-3">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between font-bold text-emerald-800 text-sm">
                <span>(+) Faturamento Total (Silagem)</span>
                <span className="font-black font-['Outfit']">{formatCurrencyBRL(totalRevenue)}</span>
              </div>
              <div className="flex justify-between font-bold text-rose-700 text-sm">
                <span>(-) Custos Totais de Campo & Frota</span>
                <span className="font-black font-['Outfit']">{formatCurrencyBRL(totalCosts)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-black text-base">
                <span>(=) Resultado Operacional Líquido</span>
                <span className={`font-['Outfit'] ${netResult >= 0 ? 'text-emerald-800 font-black' : 'text-rose-700 font-black'}`}>
                  {formatCurrencyBRL(netResult)}
                </span>
              </div>
            </div>
          </div>
        )}

        {selectedFormat === 'despesas' && (
          <div className="text-xs text-black font-medium space-y-1">
            <p>Total de {expenses.length} lançamentos de despesas.</p>
            <p>Soma total: <strong className="font-black text-black">{formatCurrencyBRL(totalCosts)}</strong></p>
          </div>
        )}

        {selectedFormat === 'receitas' && (
          <div className="text-xs text-black font-medium space-y-1">
            <p>Total de {orders.length} pedidos e vendas de silagem.</p>
            <p>Faturamento total: <strong className="font-black text-black">{formatCurrencyBRL(totalRevenue)}</strong></p>
          </div>
        )}

        {selectedFormat === 'terceiros' && (
          <div className="text-xs text-black font-medium space-y-1">
            <p>Total de {settlements.length} acertos de caminhões e operadores.</p>
            <p>Total Líquido: <strong className="font-black text-black">{formatCurrencyBRL(settlements.reduce((acc, s) => acc + s.netAmount, 0))}</strong></p>
          </div>
        )}

        {/* Printable Footer */}
        <div className="hidden print:block pt-4">
          <PrintReportFooter
            showSignatures={true}
            signatureLabels={['Setor Financeiro / Controladoria', 'Diretoria Executiva']}
            companyName={companyProfile?.tradeName || companyProfile?.corporateName || 'Silagem Fácil ERP'}
            authCode={`FIN-${selectedFormat.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`}
          />
        </div>
      </div>
    </div>
  );
};
