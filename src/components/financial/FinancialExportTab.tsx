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
import { CompetenceSelector, getPrevCompetence, getNextCompetence, matchesCompetence } from './CompetenceSelector';

interface FinancialExportTabProps {
  expenses: Expense[];
  orders: SilageOrder[];
  seasons: CropSeason[];
  settlements: ThirdPartySettlement[];
  competenceMonth?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

export const FinancialExportTab: React.FC<FinancialExportTabProps> = ({
  expenses,
  orders,
  seasons,
  settlements,
  competenceMonth,
  onPrevMonth,
  onNextMonth,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'dre' | 'despesas' | 'receitas' | 'terceiros'>('dre');

  const [internalCompetence, setInternalCompetence] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  });

  const activeCompetence = competenceMonth || internalCompetence;
  const handlePrev = onPrevMonth || (() => setInternalCompetence((prev) => getPrevCompetence(prev)));
  const handleNext = onNextMonth || (() => setInternalCompetence((prev) => getNextCompetence(prev)));

  const competenceExpenses = React.useMemo(() => {
    return expenses.filter((e) => matchesCompetence(e.date || e.dueDate, activeCompetence));
  }, [expenses, activeCompetence]);

  const competenceOrders = React.useMemo(() => {
    return orders.filter((o) => matchesCompetence(o.date || o.deliveryDate || o.createdAt, activeCompetence));
  }, [orders, activeCompetence]);

  const competenceSettlements = React.useMemo(() => {
    return settlements.filter((s) => matchesCompetence(s.date, activeCompetence));
  }, [settlements, activeCompetence]);

  const totalRevenue = competenceOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalCosts = competenceExpenses.reduce((acc, e) => acc + e.amount, 0);
  const netResult = totalRevenue - totalCosts;

  const handleExportCSV = (type: string) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    if (type === 'despesas') {
      csvContent += 'Data,Descricao,Fornecedor,Categoria,Valor,Status,FormaPagamento\n';
      competenceExpenses.forEach((e) => {
        csvContent += `"${e.date}","${e.description}","${e.supplier || ''}","${e.categoryName || ''}",${e.amount},"${e.status}","${e.paymentMethod || ''}"\n`;
      });
    } else if (type === 'receitas') {
      csvContent += 'Data,Cliente,Toneladas,ValorTotal,StatusPagamento,Observacoes\n';
      competenceOrders.forEach((o) => {
        csvContent += `"${o.date || o.deliveryDate || o.createdAt}","${o.clientName}",${o.tons},${o.totalAmount},"${o.paymentStatus}","${o.notes || ''}"\n`;
      });
    } else if (type === 'terceiros') {
      csvContent += 'Data,Terceiro,Funcao,Descricao,Bruto,Deducoes,Liquido,Status\n';
      competenceSettlements.forEach((s) => {
        csvContent += `"${s.date}","${s.thirdPartyName}","${s.role}","${s.description}",${s.totalAmount},${s.deductions || 0},${s.netAmount},"${s.status}"\n`;
      });
    } else {
      // DRE CSV
      csvContent += 'Item,Valor\n';
      csvContent += `"Receita Total Silagem (${activeCompetence})",${totalRevenue}\n`;
      csvContent += `"Custos Totais Operacionais (${activeCompetence})",${totalCosts}\n`;
      csvContent += `"Resultado Liquido (${activeCompetence})",${netResult}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financeiro_${type}_${activeCompetence.replace('/', '-')}_${new Date().toISOString().split('T')[0]}.csv`);
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
      case 'dre': return `RELATÓRIO DE DRE FINANCEIRO CONSOLIDADO (${activeCompetence})`;
      case 'despesas': return `RELATÓRIO DE DESPESAS E PAGAMENTOS (${activeCompetence})`;
      case 'receitas': return `RELATÓRIO DE FATURAMENTO E RECEITAS (${activeCompetence})`;
      case 'terceiros': return `RELATÓRIO DE ACERTOS DE TERCEIROS (${activeCompetence})`;
    }
  };

  return (
    <div id="financial-tab-exportar" className="financial-subtab-clean space-y-6">
      {/* Export Options Banner */}
      <div className="bg-transparent border border-slate-400/60 dark:border-stone-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 text-black dark:text-white print:hidden">
        <div className="bg-transparent border-0 p-0">
          <h3 className="text-base font-bold text-black dark:text-white">
            Exportação & Relatórios Gerenciais Financeiros
          </h3>
          <p className="text-xs text-black/80 dark:text-stone-300 font-medium mt-0.5">
            Gere demonstrativos em Excel/CSV para contabilidade ou imprima fechamentos de safra
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2 bg-transparent border-0 p-0">
          <CompetenceSelector
            competence={activeCompetence}
            onPrev={handlePrev}
            onNext={handleNext}
          />

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
      <div className="bg-[#e0e6f1] dark:bg-stone-900 rounded-xl border border-slate-400/70 dark:border-stone-800 p-1.5 flex items-center space-x-2 overflow-x-auto shadow-xs print:hidden">
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
          Despesas & Pagamentos ({competenceExpenses.length})
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
          Receitas de Silagem ({competenceOrders.length})
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
          Acertos de Terceiros ({competenceSettlements.length})
        </button>
      </div>

      {/* Preview Sheet */}
      <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-slate-400/70 dark:border-stone-800 rounded-xl p-6 shadow-xs space-y-4 text-black dark:text-white print:bg-white print:border-none print:shadow-none print:p-0">
        
        {/* Printable Header */}
        <div className="hidden print:block mb-4">
          <PrintReportHeader
            companyProfile={companyProfile}
            reportTitle={getReportTitle()}
            reportSubtitle={`Competência: ${activeCompetence} | Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`}
            documentTypeBadge={selectedFormat.toUpperCase()}
          />
        </div>

        <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div>
            <h4 className="font-bold text-black text-base">
              Pré-visualização do Relatório ({activeCompetence})
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
            <p>Total de {competenceExpenses.length} lançamentos de despesas na competência {activeCompetence}.</p>
            <p>Soma total: <strong className="font-black text-black">{formatCurrencyBRL(totalCosts)}</strong></p>
          </div>
        )}

        {selectedFormat === 'receitas' && (
          <div className="text-xs text-black font-medium space-y-1">
            <p>Total de {competenceOrders.length} pedidos e vendas de silagem na competência {activeCompetence}.</p>
            <p>Faturamento total: <strong className="font-black text-black">{formatCurrencyBRL(totalRevenue)}</strong></p>
          </div>
        )}

        {selectedFormat === 'terceiros' && (
          <div className="text-xs text-black font-medium space-y-1">
            <p>Total de {competenceSettlements.length} acertos de caminhões e operadores na competência {activeCompetence}.</p>
            <p>Total Líquido: <strong className="font-black text-black">{formatCurrencyBRL(competenceSettlements.reduce((acc, s) => acc + s.netAmount, 0))}</strong></p>
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
