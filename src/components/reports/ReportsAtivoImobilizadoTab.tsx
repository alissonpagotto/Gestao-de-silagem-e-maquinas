import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Printer, 
  Search, 
  Filter, 
  Car, 
  Landmark, 
  ShieldCheck, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  TrendingUp,
  Tag
} from 'lucide-react';
import { Machinery, CompanyProfile } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { PrintPreviewModal } from '../common/PrintPreviewModal';

interface ReportsAtivoImobilizadoTabProps {
  machineries: Machinery[];
  companyProfile: CompanyProfile;
  startDate?: string;
  endDate?: string;
}

export const ReportsAtivoImobilizadoTab: React.FC<ReportsAtivoImobilizadoTabProps> = ({
  machineries = [],
  companyProfile,
  startDate,
  endDate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [filterOwnership, setFilterOwnership] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Filter machineries
  const filteredVehicles = useMemo(() => {
    return machineries.filter((v) => {
      const matchesSearch = 
        !searchTerm.trim() ||
        (v.name && v.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.model && v.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.brand && v.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.licensePlateOrSerial && v.licensePlateOrSerial.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.fleetNumber && v.fleetNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.renavam && v.renavam.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat = filterCategory === 'todos' || v.categoryType === filterCategory;
      const matchesOwnership = filterOwnership === 'todos' || v.ownership === filterOwnership;
      const matchesStatus = filterStatus === 'todos' || v.status === filterStatus;

      return matchesSearch && matchesCat && matchesOwnership && matchesStatus;
    });
  }, [machineries, searchTerm, filterCategory, filterOwnership, filterStatus]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let capitalTotalFipe = 0;
    let capitalTotalCompra = 0;
    let totalIpvaProjetado = 0;
    let totalLicenciamento = 0;
    let totalLicenciamentosPendentes = 0;
    let ipvaLancadosCount = 0;
    let ipvaPendentesCount = 0;

    machineries.forEach((v) => {
      // Capital FIPE ou Valor de Compra
      const fipe = v.fipeValue || 0;
      const compra = v.purchaseValue || 0;
      capitalTotalFipe += fipe;
      capitalTotalCompra += compra;

      // IPVA
      const baseVenal = v.ipvaBaseValue || 0;
      const rate = v.ipvaRatePercent || 0;
      const ipva = v.ipvaTotalAmount || (baseVenal > 0 && rate > 0 ? (baseVenal * (rate / 100)) : 0);
      totalIpvaProjetado += ipva;

      if (v.ipvaFinancialStatus === 'lancado') {
        ipvaLancadosCount += 1;
      } else if (ipva > 0) {
        ipvaPendentesCount += 1;
      }

      // Licenciamento
      const lic = v.licensingValue || 0;
      totalLicenciamento += lic;
      if (v.licensingFinancialStatus !== 'lancado' && (v.licensePlateOrSerial || lic > 0)) {
        totalLicenciamentosPendentes += 1;
      }
    });

    const capitalTotalImobilizado = capitalTotalFipe > 0 ? capitalTotalFipe : capitalTotalCompra;

    return {
      capitalTotalImobilizado,
      capitalTotalFipe,
      capitalTotalCompra,
      totalIpvaProjetado,
      totalLicenciamento,
      totalLicenciamentosPendentes,
      ipvaLancadosCount,
      ipvaPendentesCount,
      totalFrota: machineries.length,
    };
  }, [machineries]);

  // Filtered totals for table footer
  const filteredTotals = useMemo(() => {
    let fipeSum = 0;
    let ipvaBaseSum = 0;
    let ipvaTotalSum = 0;
    let licSum = 0;

    filteredVehicles.forEach((v) => {
      fipeSum += v.fipeValue || 0;
      ipvaBaseSum += v.ipvaBaseValue || 0;
      const rate = v.ipvaRatePercent || 0;
      const calcIpva = v.ipvaTotalAmount || (v.ipvaBaseValue && rate ? (v.ipvaBaseValue * (rate / 100)) : 0);
      ipvaTotalSum += calcIpva;
      licSum += v.licensingValue || 0;
    });

    return {
      fipeSum,
      ipvaBaseSum,
      ipvaTotalSum,
      licSum,
    };
  }, [filteredVehicles]);

  // Generate Print HTML
  const printHtml = useMemo(() => {
    const todayStr = formatDateBR(new Date().toISOString().split('T')[0]);
    const totalVehiclesCount = filteredVehicles.length;

    const rowsHtml = filteredVehicles.map((v) => {
      const fipeVal = v.fipeValue ? formatCurrencyBRL(v.fipeValue) : '--';
      const baseVenal = v.ipvaBaseValue ? formatCurrencyBRL(v.ipvaBaseValue) : '--';
      const rateStr = v.ipvaRatePercent ? `${v.ipvaRatePercent}%` : '--';
      const calcIpva = v.ipvaTotalAmount || (v.ipvaBaseValue && v.ipvaRatePercent ? (v.ipvaBaseValue * (v.ipvaRatePercent / 100)) : 0);
      const ipvaVal = calcIpva > 0 ? formatCurrencyBRL(calcIpva) : 'R$ 0,00';
      const licVal = v.licensingValue ? formatCurrencyBRL(v.licensingValue) : '--';
      
      const ipvaStatusBadge = v.ipvaFinancialStatus === 'lancado'
        ? '<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">Lançado</span>'
        : (calcIpva > 0 
            ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">Pendente</span>'
            : '<span style="color: #94a3b8; font-size: 10px;">Isento / --</span>');

      const licStatusBadge = v.licensingFinancialStatus === 'lancado'
        ? '<span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">Lançado</span>'
        : (v.licensingValue 
            ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">Pendente</span>'
            : '<span style="color: #94a3b8; font-size: 10px;">--</span>');

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 7px 8px; font-weight: 800; font-family: monospace; text-align: center;">${v.fleetNumber || '--'}</td>
          <td style="padding: 7px 8px; font-weight: 700; font-family: monospace;">${(v.licensePlateOrSerial || '--').toUpperCase()}</td>
          <td style="padding: 7px 8px;">
            <strong style="text-transform: uppercase;">${(v.brand || '').toUpperCase()} ${(v.model || v.name || '').toUpperCase()}</strong>
            <div style="font-size: 9px; color: #64748b;">${v.year ? `Ano: ${v.year}` : ''} ${v.renavam ? `| Renavam: ${v.renavam}` : ''} | Reg.: ${v.ownership === 'proprio' ? 'Próprio' : v.ownership || 'Próprio'}</div>
          </td>
          <td style="padding: 7px 8px; text-align: right; font-weight: 700;">${fipeVal}</td>
          <td style="padding: 7px 8px; text-align: right;">${baseVenal}</td>
          <td style="padding: 7px 8px; text-align: center;">${rateStr}</td>
          <td style="padding: 7px 8px; text-align: right; font-weight: 800; color: #0963cb;">${ipvaVal}</td>
          <td style="padding: 7px 8px; text-align: right;">${licVal}</td>
          <td style="padding: 7px 8px; text-align: center;">${ipvaStatusBadge}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 10px 0;">
        
        <!-- CARDS DE RESUMO DO IMOBILIZADO -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px; page-break-inside: avoid; break-inside: avoid;">
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; border-left: 4px solid #0963cb;">
            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Capital Total Imobilizado (FIPE)</div>
            <div style="font-size: 16px; font-weight: 900; color: #0963cb; margin-top: 3px;">${formatCurrencyBRL(metrics.capitalTotalImobilizado)}</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Patrimônio avaliado em ${metrics.totalFrota} veículos</div>
          </div>
          
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; border-left: 4px solid #d97706;">
            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total de IPVA Projetado</div>
            <div style="font-size: 16px; font-weight: 900; color: #d97706; margin-top: 3px;">${formatCurrencyBRL(metrics.totalIpvaProjetado)}</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${metrics.ipvaLancadosCount} lançados | ${metrics.ipvaPendentesCount} pendentes</div>
          </div>

          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; border-left: 4px solid #059669;">
            <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Licenciamentos Pendentes</div>
            <div style="font-size: 16px; font-weight: 900; color: #059669; margin-top: 3px;">${metrics.totalLicenciamentosPendentes} veículos</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Total Previsto: ${formatCurrencyBRL(metrics.totalLicenciamento)}</div>
          </div>
        </div>

        <!-- TABELA DE VEÍCULOS & ATIVO IMOBILIZADO -->
        <div style="margin-top: 10px;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #94a3b8; font-size: 10px; text-transform: uppercase; color: #334155;">
                <th style="padding: 8px 6px; text-align: center; width: 60px;">Nº Frota</th>
                <th style="padding: 8px 6px; text-align: left; width: 85px;">Placa / Série</th>
                <th style="padding: 8px 6px; text-align: left;">Veículo / Modelo</th>
                <th style="padding: 8px 6px; text-align: right; width: 110px;">Valor FIPE</th>
                <th style="padding: 8px 6px; text-align: right; width: 105px;">Base IPVA</th>
                <th style="padding: 8px 6px; text-align: center; width: 65px;">Alíq.</th>
                <th style="padding: 8px 6px; text-align: right; width: 95px;">Total IPVA</th>
                <th style="padding: 8px 6px; text-align: right; width: 90px;">Licenc.</th>
                <th style="padding: 8px 6px; text-align: center; width: 80px;">Status Fin.</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; border-top: 2px solid #0963cb; font-weight: 900; font-size: 11px;">
                <td colspan="3" style="padding: 8px; text-align: right; text-transform: uppercase;">Totais do Relatório (${totalVehiclesCount} veículos):</td>
                <td style="padding: 8px; text-align: right; color: #0963cb;">${formatCurrencyBRL(filteredTotals.fipeSum)}</td>
                <td style="padding: 8px; text-align: right;">${formatCurrencyBRL(filteredTotals.ipvaBaseSum)}</td>
                <td style="padding: 8px; text-align: center;">--</td>
                <td style="padding: 8px; text-align: right; color: #0963cb;">${formatCurrencyBRL(filteredTotals.ipvaTotalSum)}</td>
                <td style="padding: 8px; text-align: right;">${formatCurrencyBRL(filteredTotals.licSum)}</td>
                <td style="padding: 8px; text-align: center;">--</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top: 14px; font-size: 10px; color: #64748b; text-align: right;">
          Demonstrativo gerado em ${todayStr} às ${new Date().toLocaleTimeString('pt-BR')} • Silagem Fácil Pro - Gestão Patrimonial
        </div>
      </div>
    `;
  }, [filteredVehicles, metrics, filteredTotals]);

  const whatsappText = useMemo(() => {
    return `📊 *${companyProfile?.tradeName?.toUpperCase() || 'SILAGEM FÁCIL PRO'}*\n` +
      `📑 *RELATÓRIO DE ATIVO IMOBILIZADO, FIPE & TRIBUTOS*\n` +
      `📅 *Emissão:* ${formatDateBR(new Date().toISOString().split('T')[0])}\n\n` +
      `🚜 *Veículos na Frota:* ${machineries.length}\n` +
      `🏛️ *Capital Imobilizado (FIPE):* ${formatCurrencyBRL(metrics.capitalTotalImobilizado)}\n` +
      `💰 *IPVA Total Projetado:* ${formatCurrencyBRL(metrics.totalIpvaProjetado)}\n` +
      `📋 *Licenciamentos Pendentes:* ${metrics.totalLicenciamentosPendentes} veículos\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🌱 Gerado automaticamente pelo Silagem Fácil Pro`;
  }, [companyProfile, machineries, metrics]);

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* 1. Barra de Ações Superiores & Botão de Impressão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100 flex items-center space-x-2 font-['Outfit']">
            <Building2 className="w-5 h-5 text-[#0963cb]" />
            <span>Ativo Imobilizado, FIPE & Tributos da Frota</span>
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
            Demonstrativo contábil e patrimonial de veículos, avaliação comercial de mercado e projeção de impostos (IPVA / CRLV).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Botão de Impressão com o padrão solicitado (Fundo branco, texto e ícones pretos, hover #b0d2ed) */}
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="h-9 px-4 rounded-xl border border-stone-300 bg-white hover:bg-[#b0d2ed] text-[#000000] text-xs font-bold transition flex items-center space-x-2 shadow-xs cursor-pointer"
            style={{ color: '#000000' }}
          >
            <Printer className="w-4 h-4 text-[#000000]" />
            <span>🖨️ Imprimir Imobilizado</span>
          </button>
        </div>
      </div>

      {/* 2. Três Cards de Resumo Principais Solicitados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: CAPITAL TOTAL IMOBILIZADO */}
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              CAPITAL TOTAL IMOBILIZADO
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#0963cb]">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-[#0963cb] font-['Outfit']">
              {formatCurrencyBRL(metrics.capitalTotalImobilizado)}
            </div>
            <div className="text-[11px] text-stone-500 mt-1 flex items-center space-x-1">
              <span>{metrics.totalFrota} veículos e máquinas registrados</span>
            </div>
          </div>
        </div>

        {/* Card 2: TOTAL DE IPVA PROJETADO */}
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              TOTAL DE IPVA PROJETADO
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-amber-600 font-['Outfit']">
              {formatCurrencyBRL(metrics.totalIpvaProjetado)}
            </div>
            <div className="text-[11px] text-stone-500 mt-1 flex items-center space-x-2">
              <span className="text-emerald-600 font-bold">{metrics.ipvaLancadosCount} no Financeiro</span>
              <span>•</span>
              <span className="text-amber-700 font-semibold">{metrics.ipvaPendentesCount} a lançar</span>
            </div>
          </div>
        </div>

        {/* Card 3: LICENCIAMENTOS PENDENTES */}
        <div className="bg-white dark:bg-stone-900 rounded-xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              LICENCIAMENTOS PENDENTES
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-['Outfit']">
              {metrics.totalLicenciamentosPendentes} <span className="text-sm font-semibold text-stone-500">veículos</span>
            </div>
            <div className="text-[11px] text-stone-500 mt-1">
              Valor estimado: <strong className="text-stone-700 dark:text-stone-300">{formatCurrencyBRL(metrics.totalLicenciamento)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filtros e Busca */}
      <div className="bg-white dark:bg-stone-900 p-3 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por placa, modelo, marca ou nº de frota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0963cb]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0963cb]"
          >
            <option value="todos">Todas Categorias</option>
            <option value="forrageira">Forrageira / Ensiladeira</option>
            <option value="caminhao">Caminhão</option>
            <option value="trator">Trator Agrícola</option>
            <option value="reboque">Reboque / Carreta</option>
            <option value="utilitario">Utilitário / Apoio</option>
          </select>

          <select
            value={filterOwnership}
            onChange={(e) => setFilterOwnership(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0963cb]"
          >
            <option value="todos">Todos Regimes</option>
            <option value="proprio">Próprio</option>
            <option value="terceirizado">De Terceiros</option>
            <option value="alugado">Alugado</option>
            <option value="arrendado">Arrendado / Financiado</option>
          </select>
        </div>
      </div>

      {/* 4. Tabela Densa de Ativo Imobilizado com Totalizadores */}
      <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-800/70 border-b border-stone-200 dark:border-stone-700 text-[11px] font-black uppercase text-stone-700 dark:text-stone-300 tracking-wider">
                <th className="py-2.5 px-3 text-center w-16">Nº Frota</th>
                <th className="py-2.5 px-3 w-28">Placa</th>
                <th className="py-2.5 px-3 min-w-[200px]">Veículo / Modelo</th>
                <th className="py-2.5 px-3 text-right">Valor Comercial (FIPE)</th>
                <th className="py-2.5 px-3 text-right">Valor Venal (IPVA)</th>
                <th className="py-2.5 px-3 text-center w-20">Alíquota</th>
                <th className="py-2.5 px-3 text-right">Total IPVA</th>
                <th className="py-2.5 px-3 text-right">Licenc.</th>
                <th className="py-2.5 px-3 text-center w-28">Status Financeiro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-500 dark:text-stone-400">
                    Nenhum veículo encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const rate = v.ipvaRatePercent || 0;
                  const calcIpva = v.ipvaTotalAmount || (v.ipvaBaseValue && rate ? (v.ipvaBaseValue * (rate / 100)) : 0);

                  return (
                    <tr key={v.id} className="hover:bg-blue-50/40 dark:hover:bg-stone-800/40 transition">
                      <td className="py-2 px-3 text-center font-black font-mono text-stone-900 dark:text-stone-100">
                        {v.fleetNumber ? (
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700">
                            {v.fleetNumber}
                          </span>
                        ) : (
                          <span className="text-stone-400">--</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-black font-mono text-stone-900 dark:text-stone-100">
                        {(v.licensePlateOrSerial || '--').toUpperCase()}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-stone-900 dark:text-stone-100 uppercase">
                          {(v.brand || '').toUpperCase()} {(v.model || v.name || 'Veículo').toUpperCase()}
                        </div>
                        <div className="text-[10px] text-stone-500 flex items-center space-x-1.5 mt-0.5">
                          {v.year && <span>Ano: {v.year}</span>}
                          {v.year && <span>•</span>}
                          <span>{v.categoryType || 'Equipamento'}</span>
                          <span>•</span>
                          <span>{v.ownership === 'proprio' ? 'Próprio' : v.ownership}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-stone-900 dark:text-stone-100">
                        {v.fipeValue ? formatCurrencyBRL(v.fipeValue) : <span className="text-stone-400 font-normal">--</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-stone-700 dark:text-stone-300">
                        {v.ipvaBaseValue ? formatCurrencyBRL(v.ipvaBaseValue) : <span className="text-stone-400 font-normal">--</span>}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-stone-700 dark:text-stone-300">
                        {v.ipvaRatePercent ? `${v.ipvaRatePercent}%` : <span className="text-stone-400 font-normal">--</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-[#0963cb]">
                        {calcIpva > 0 ? (
                          <span>{formatCurrencyBRL(calcIpva)}</span>
                        ) : (
                          <span className="text-stone-400 font-normal">R$ 0,00</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-stone-700 dark:text-stone-300">
                        {v.licensingValue ? formatCurrencyBRL(v.licensingValue) : <span className="text-stone-400 font-normal">--</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {v.ipvaFinancialStatus === 'lancado' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Lançado
                          </span>
                        ) : calcIpva > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Pendente
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-400">
                            Isento / --
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Totalizadores de Rodapé */}
            <tfoot>
              <tr className="bg-stone-100 dark:bg-stone-800/80 border-t-2 border-[#0963cb] text-xs font-black text-stone-900 dark:text-stone-100">
                <td colSpan={3} className="py-3 px-3 text-right uppercase tracking-wider">
                  Totalizador ({filteredVehicles.length} veículos):
                </td>
                <td className="py-3 px-3 text-right text-[#0963cb] text-sm">
                  {formatCurrencyBRL(filteredTotals.fipeSum)}
                </td>
                <td className="py-3 px-3 text-right text-sm">
                  {formatCurrencyBRL(filteredTotals.ipvaBaseSum)}
                </td>
                <td className="py-3 px-3 text-center">--</td>
                <td className="py-3 px-3 text-right text-[#0963cb] text-sm">
                  {formatCurrencyBRL(filteredTotals.ipvaTotalSum)}
                </td>
                <td className="py-3 px-3 text-right text-sm">
                  {formatCurrencyBRL(filteredTotals.licSum)}
                </td>
                <td className="py-3 px-3 text-center">--</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal de Impressão Executiva com Cabeçalho e Rodapé Corporativos */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        options={{
          title: 'RELATÓRIO PATRIMONIAL DO ATIVO IMOBILIZADO & TRIBUTOS',
          subtitle: `Demonstrativo contábil da frota, valor de mercado FIPE, IPVA venal e licenciamento`,
          documentType: 'RELATÓRIO PATRIMONIAL',
          company: companyProfile,
          contentHtml: printHtml,
          signatureLabels: ['Diretoria de Operações & Frotas', 'Controladoria Financeira & Contabilidade'],
          whatsappText,
        }}
      />

    </div>
  );
};
