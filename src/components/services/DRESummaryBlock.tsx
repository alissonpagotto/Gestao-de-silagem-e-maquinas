import React from 'react';
import { DollarSign, AlertCircle, TrendingUp, Truck, Tractor, Scissors, Fuel, UtensilsCrossed, Plus, Trash2 } from 'lucide-react';
import { formatCurrencyBRL } from '../../lib/storage';
import { parseCurrencyToFloat } from '../../lib/formatters';
import { ServiceTruckItem, ServiceFuelEntry, ServiceMealExpense } from '../../types';

export interface TruckExpenseDetail {
  truckId: string;
  plate: string;
  driverName: string;
  loads: number;
  capacityM3: number;
  totalM3: number;
  distributionPercent: number;
  rateioCost: number;
  additionalKmCost: number;
  driverCommissionCost?: number;
  totalCost: number;
  truckHours?: number;
  truckHourlyRate?: number;
}

interface DRESummaryBlockProps {
  // Bloco 1: Resumo do Pedido (Borda Verde)
  valorBaseArea: number;
  unidadeAreaLabel: string;
  quantidadeArea: number | '';
  subtotalTrator: number;
  qtdCobrancaTrator: number | '';
  modoCobrancaTratorLabel: string;
  subtotalForrageira: number;
  totalAdicionalKm: number;
  fretePrancha?: number | string;
  totalPedido: number;
  volumeTotalFrotaM3?: number;
  unidadeArea?: 'hectares' | 'alqueires' | 'hora' | 'horas';
  totalFrotasPorHora?: number;
  subtotalServicoMaquina?: number;
  descricaoServicoMaquina?: string;

  // NOVO CARD: Consumo de Combustível e Alimentação
  fuelEntries?: ServiceFuelEntry[];
  onFuelEntryChange?: (vehicleId: string, field: 'liters' | 'pricePerLiter', val: number | '') => void;
  totalCombustivelGeral?: number;

  mealExpenses?: ServiceMealExpense[];
  onAddMealExpense?: () => void;
  onRemoveMealExpense?: (id: string) => void;
  onMealExpenseChange?: (id: string, field: 'description' | 'date' | 'amount', val: any) => void;
  totalAlimentacaoGeral?: number;

  // Bloco 2: Custos e Proventos Adicionais (Borda Laranja - Comissões Discriminadas)
  operadorForrageiraNome: string;
  comissaoForrageiraP1: number;
  segundoOperadorForrageiraNome: string;
  comissaoForrageiraP2: number;

  operadorTratorNome: string;
  comissaoTratorP1: number;
  segundoOperadorTratorNome: string;
  comissaoTratorP2: number;

  // Agenciador / Intermediação
  brokerName?: string;
  brokerCommissionAmount?: number;

  trucksExpenseDetails: TruckExpenseDetail[];
  totalGeralDespesas: number;

  // Bloco 3: Resultado Final (Lucro Estimado)
  lucroEstimado: number;
  margemLucroPercent: number;

  // Modo de Impressão (via cliente oculta custos e lucro)
  printMode?: 'client' | 'full' | null;
}

export const DRESummaryBlock: React.FC<DRESummaryBlockProps> = ({
  valorBaseArea,
  unidadeAreaLabel,
  quantidadeArea,
  subtotalTrator,
  qtdCobrancaTrator,
  modoCobrancaTratorLabel,
  subtotalForrageira,
  totalAdicionalKm,
  fretePrancha,
  totalPedido,
  volumeTotalFrotaM3 = 0,
  unidadeArea,
  totalFrotasPorHora = 0,
  subtotalServicoMaquina,
  descricaoServicoMaquina,

  fuelEntries = [],
  onFuelEntryChange,
  totalCombustivelGeral = 0,

  mealExpenses = [],
  onAddMealExpense,
  onRemoveMealExpense,
  onMealExpenseChange,
  totalAlimentacaoGeral = 0,

  operadorForrageiraNome,
  comissaoForrageiraP1,
  segundoOperadorForrageiraNome,
  comissaoForrageiraP2,
  operadorTratorNome,
  comissaoTratorP1,
  segundoOperadorTratorNome,
  comissaoTratorP2,
  brokerName,
  brokerCommissionAmount = 0,
  trucksExpenseDetails,
  totalGeralDespesas,
  lucroEstimado,
  margemLucroPercent,
  printMode,
}) => {
  const numFretePrancha = typeof fretePrancha === 'number' ? fretePrancha : parseCurrencyToFloat(fretePrancha || 0);

  return (
    <div className="space-y-3">
      
      {/* 1. BLOCO RESUMO DO PEDIDO (BORDA VERDE) COM INDICADOR DE M³ NO CABEÇALHO */}
      <div className="border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-3.5 space-y-2.5 border-l-4 border-l-emerald-600 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 dark:border-emerald-800/40 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex flex-wrap items-center gap-1.5">
              <span>Resumo do Pedido (Cobrado do Cliente)</span>
              {volumeTotalFrotaM3 > 0 && (
                <span className="text-emerald-700 dark:text-emerald-300 font-extrabold normal-case bg-emerald-100/90 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-[11px] border border-emerald-200 dark:border-emerald-700/80">
                  — [Volume Total: {volumeTotalFrotaM3.toFixed(1)} m³]
                </span>
              )}
            </h4>
          </div>
          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-extrabold uppercase tracking-wide">
            Faturamento Bruto
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          {valorBaseArea > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span>
                Valor Base do Serviço ({quantidadeArea || 0} {unidadeAreaLabel}):
              </span>
              <span className="font-semibold text-gray-900 dark:text-white font-mono">
                {formatCurrencyBRL(valorBaseArea)}
              </span>
            </div>
          )}

          {subtotalServicoMaquina !== undefined && subtotalServicoMaquina > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <Tractor className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                {descricaoServicoMaquina || 'Serviço de Máquinas / Transporte'}:
              </span>
              <span className="font-semibold text-gray-900 dark:text-white font-mono">
                {formatCurrencyBRL(subtotalServicoMaquina)}
              </span>
            </div>
          )}

          {subtotalTrator > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <Tractor className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                Serviço de Trator / Compactação ({qtdCobrancaTrator || 0} {modoCobrancaTratorLabel}):
              </span>
              <span className="font-semibold text-gray-900 dark:text-white font-mono">
                {formatCurrencyBRL(subtotalTrator)}
              </span>
            </div>
          )}

          {numFretePrancha > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                Frete Prancha:
              </span>
              <span className="font-semibold text-gray-900 dark:text-white font-mono">
                {formatCurrencyBRL(numFretePrancha)}
              </span>
            </div>
          )}

          {subtotalForrageira > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Cobrança de Forrageira:
              </span>
              <span className="font-semibold text-gray-900 dark:text-white font-mono">
                {formatCurrencyBRL(subtotalForrageira)}
              </span>
            </div>
          )}

          {totalAdicionalKm > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Adicional KM (Frotas de Alqueires):
              </span>
              <span className="font-semibold text-gray-900 dark:text-white font-mono">
                {formatCurrencyBRL(totalAdicionalKm)}
              </span>
            </div>
          )}

          {(unidadeArea === 'hectares' || unidadeArea === 'hora' || unidadeArea === 'horas') && totalFrotasPorHora > 0 && (
            <div className="space-y-1 py-0.5">
              <div className="flex items-center justify-between text-gray-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Transporte Frotas (Cobrança por Horas):
                </span>
                <span className="font-semibold text-gray-900 dark:text-white font-mono">
                  {formatCurrencyBRL(totalFrotasPorHora)}
                </span>
              </div>

              {/* INÍCIO DO MAPEAMENTO DE FROTAS NO RESUMO DO CLIENTE (COBRADO DO CLIENTE) */}
              {trucksExpenseDetails && trucksExpenseDetails.length > 0 && (
                <div className="pl-5 space-y-1">
                  {trucksExpenseDetails.map((truckItem) => (
                    <div 
                      key={`resumo-pedido-truck-${truckItem.truckId}`}
                      className="text-xs text-gray-500 dark:text-slate-400 font-medium leading-relaxed"
                    >
                      • Transp. <strong className="font-mono font-bold text-gray-800 dark:text-slate-200">{truckItem.plate || 'S/ Placa'}</strong> ({truckItem.driverName || 'Motorista'}) – {truckItem.loads} Cargas ({truckItem.totalM3.toFixed(1)} m³) – Cobrança por Horas: {truckItem.truckHours || 0}h × {formatCurrencyBRL(truckItem.truckHourlyRate || 0)}/h = Total: <strong className="font-mono font-bold text-gray-900 dark:text-white">{formatCurrencyBRL(truckItem.rateioCost)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {/* FIM DO MAPEAMENTO DE FROTAS NO RESUMO DO CLIENTE (COBRADO DO CLIENTE) */}
            </div>
          )}

          <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between font-bold text-sm text-emerald-950 dark:text-emerald-200">
            <span>Total do Pedido:</span>
            <span className="text-base font-extrabold font-mono text-emerald-800 dark:text-emerald-300">
              {formatCurrencyBRL(totalPedido)}
            </span>
          </div>
        </div>
      </div>

      {/* NOVO CARD DEDICADO: CONSUMO DE COMBUSTÍVEL E ALIMENTAÇÃO (ENTRE RESUMO DO PEDIDO E COMISSÕES) */}
      <div className="border border-sky-300 dark:border-sky-800/80 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl p-3.5 space-y-3 border-l-4 border-l-sky-600 shadow-2xs print-client-hide print-hide-on-client">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/80 dark:border-sky-800/40 pb-2">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Consumo de Combustível & Alimentação (Despesas da Operação)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded">
              Dedutível no DRE
            </span>
            <span className="text-xs font-extrabold text-sky-950 dark:text-sky-200 font-mono">
              Total do Card: {formatCurrencyBRL(totalCombustivelGeral + totalAlimentacaoGeral)}
            </span>
          </div>
        </div>

        {/* A) SUBSÉÇÃO: CONSUMO DE COMBUSTÍVEL (Estrutura fixa por veículo envolvido) */}
        <div className="space-y-2 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-1">
            <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 uppercase flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-sky-600" />
              A. Consumo de Combustível por Veículo
            </span>
            <span className="text-[11px] font-mono font-bold text-sky-800 dark:text-sky-300">
              Total Geral de Combustível: {formatCurrencyBRL(totalCombustivelGeral)}
            </span>
          </div>

          {fuelEntries.length === 0 ? (
            <p className="text-[11px] text-gray-500 dark:text-slate-400 italic py-1">
              Nenhum veículo ativo selecionado na operação (Ensiladeira, Trator ou Caminhões).
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase px-1">
                <span className="sm:col-span-5">Veículo / Máquina Ativa</span>
                <span className="sm:col-span-2 text-right">Qtd. Litros</span>
                <span className="sm:col-span-2 text-right">Valor / Litro (R$)</span>
                <span className="sm:col-span-3 text-right">Subtotal Combustível</span>
              </div>

              {fuelEntries.map((entry) => (
                <div
                  key={entry.vehicleId}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-50/80 dark:bg-slate-800/60 p-2 rounded-md border border-gray-200/70 dark:border-slate-700/60 text-xs"
                >
                  <div className="sm:col-span-5 font-semibold text-gray-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                    {entry.vehicleType === 'forrageira' ? (
                      <Scissors className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    ) : entry.vehicleType === 'trator' ? (
                      <Tractor className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="truncate" title={entry.vehicleName}>
                      {entry.vehicleName}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-gray-700 dark:text-slate-300 font-bold sm:hidden">
                      Quantidade de Litros:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={entry.liters}
                        placeholder="0.0"
                        onChange={(e) =>
                          onFuelEntryChange?.(
                            entry.vehicleId,
                            'liters',
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600/30 focus:border-sky-600 text-right pr-6 shadow-2xs"
                      />
                      <span className="absolute right-2 top-1 text-[10px] text-gray-500 font-bold">L</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-gray-700 dark:text-slate-300 font-bold sm:hidden">
                      Valor por Litro (R$):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.pricePerLiter}
                        placeholder="0.00"
                        onChange={(e) =>
                          onFuelEntryChange?.(
                            entry.vehicleId,
                            'pricePerLiter',
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-600/30 focus:border-sky-600 text-right pr-6 shadow-2xs"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-gray-500 font-bold">R$</span>
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex sm:justify-end items-center justify-between">
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 sm:hidden">
                      Subtotal:
                    </span>
                    <span className="font-bold font-mono text-gray-900 dark:text-white text-xs">
                      {formatCurrencyBRL(entry.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* B) SUBSEÇÃO: ALIMENTAÇÃO E DIÁRIAS (Estrutura Dinâmica) */}
        <div className="space-y-2 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40">
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-gray-100 dark:border-slate-800 pb-1">
            <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 uppercase flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-600" />
              B. Alimentação e Diárias da Operação
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-amber-800 dark:text-amber-300">
                Total Geral de Alimentação: {formatCurrencyBRL(totalAlimentacaoGeral)}
              </span>
              {onAddMealExpense && (
                <button
                  type="button"
                  onClick={onAddMealExpense}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10.5px] font-bold cursor-pointer transition shadow-2xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Adicionar Refeição/Despesa</span>
                </button>
              )}
            </div>
          </div>

          {mealExpenses.length === 0 ? (
            <div className="text-[11px] text-gray-500 dark:text-slate-400 italic py-1 flex items-center justify-between">
              <span>Nenhuma refeição ou diária lançada.</span>
              {onAddMealExpense && (
                <button
                  type="button"
                  onClick={onAddMealExpense}
                  className="text-amber-700 dark:text-amber-400 font-semibold hover:underline text-[11px] cursor-pointer"
                >
                  + Adicionar Refeição/Despesa
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="hidden sm:grid sm:grid-cols-12 gap-1.5 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase px-1">
                <span className="sm:col-span-5">Descrição / Tipo</span>
                <span className="sm:col-span-3">Data / Dia do Gasto</span>
                <span className="sm:col-span-3 text-right">Valor (R$)</span>
                <span className="sm:col-span-1 text-center">Ação</span>
              </div>

              {mealExpenses.map((meal) => (
                <div
                  key={meal.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center bg-gray-50/80 dark:bg-slate-800/60 p-1.5 rounded-md border border-gray-200/70 dark:border-slate-700/60 text-xs"
                >
                  <div className="sm:col-span-5">
                    <select
                      value={meal.description}
                      onChange={(e) => onMealExpenseChange?.(meal.id, 'description', e.target.value)}
                      className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
                    >
                      <option value="Café da manhã">Café da manhã</option>
                      <option value="Almoço">Almoço</option>
                      <option value="Janta">Janta</option>
                      <option value="Diária">Diária da Equipe</option>
                      <option value="Marmitas da Equipe">Marmitas da Equipe</option>
                      <option value="Lanche / Bebidas">Lanche / Bebidas</option>
                      <option value="Outra Despesa">Outra Despesa</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <input
                      type="date"
                      value={meal.date}
                      onChange={(e) => onMealExpenseChange?.(meal.id, 'date', e.target.value)}
                      className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={meal.amount}
                        placeholder="0.00"
                        onChange={(e) =>
                          onMealExpenseChange?.(
                            meal.id,
                            'amount',
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-400 dark:border-slate-500 rounded-lg font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-right pr-6 shadow-2xs"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-gray-500 font-bold">R$</span>
                    </div>
                  </div>

                  <div className="sm:col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveMealExpense?.(meal.id)}
                      className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                      title="Excluir refeição"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. BLOCO CUSTOS E PROVENTOS ADICIONAIS (BORDA LARANJA) - DETALHAMENTO CIRÚRGICO */}
      <div className="border border-orange-300 dark:border-orange-700/80 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl p-3.5 space-y-2.5 border-l-4 border-l-orange-600 print-client-hide print-hide-on-client shadow-2xs">
        <div className="flex items-center justify-between border-b border-orange-200/80 dark:border-orange-800/40 pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Custos e Proventos Adicionais (Comissões & Motoristas)
            </h4>
          </div>
          <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/60 px-2 py-0.5 rounded">
            Discriminação Nominal
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          
          {/* Comissão Trator (Nome) */}
          {comissaoTratorP1 > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <Tractor className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                Comissão Trator ({operadorTratorNome || 'Operador Principal'}):
              </span>
              <span className="font-semibold font-mono text-gray-900 dark:text-white">
                {formatCurrencyBRL(comissaoTratorP1)}
              </span>
            </div>
          )}

          {comissaoTratorP2 > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5 pl-4">
                ↳ 2º Operador Trator ({segundoOperadorTratorNome}):
              </span>
              <span className="font-semibold font-mono text-gray-900 dark:text-white">
                {formatCurrencyBRL(comissaoTratorP2)}
              </span>
            </div>
          )}

          {/* Comissão Forrageira (Nome) */}
          {comissaoForrageiraP1 > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Comissão Forrageira ({operadorForrageiraNome || 'Operador Principal'}):
              </span>
              <span className="font-semibold font-mono text-gray-900 dark:text-white">
                {formatCurrencyBRL(comissaoForrageiraP1)}
              </span>
            </div>
          )}

          {comissaoForrageiraP2 > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5 pl-4">
                ↳ 2º Operador Forrageira ({segundoOperadorForrageiraNome}):
              </span>
              <span className="font-semibold font-mono text-gray-900 dark:text-white">
                {formatCurrencyBRL(comissaoForrageiraP2)}
              </span>
            </div>
          )}

          {/* Comissão Agenciador / Intermediação */}
          {brokerCommissionAmount > 0 && (
            <div className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-700 dark:text-amber-400 font-bold">🤝</span>
                Comissão Agenciador ({brokerName || 'Agenciador'}):
              </span>
              <span className="font-semibold font-mono text-gray-900 dark:text-white">
                {formatCurrencyBRL(brokerCommissionAmount)}
              </span>
            </div>
          )}

          {/* Comissões Individuais dos Motoristas (No Topo do Bloco Laranja) */}
          {trucksExpenseDetails
            .filter((t) => (t.driverCommissionCost || 0) > 0)
            .map((truckItem) => (
              <div key={`comm-driver-${truckItem.truckId}`} className="flex items-center justify-between text-gray-700 dark:text-slate-300 py-0.5">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  🚚 Comissão Motorista ({truckItem.driverName || 'Motorista'}):
                </span>
                <span className="font-semibold font-mono text-gray-900 dark:text-white">
                  {formatCurrencyBRL(truckItem.driverCommissionCost || 0)}
                </span>
              </div>
            ))}

          {/* PLOTAGEM NOMINAL E CIRÚRGICA DE CADA CAMINHÃO ATIVO (APENAS TRANSPORTE/LOGÍSTICA) */}
          {trucksExpenseDetails.length > 0 && (
            <div className="pt-1.5 space-y-1.5 border-t border-orange-200/80 dark:border-orange-800/50">
              {trucksExpenseDetails.map((truckItem) => (
                <div 
                  key={truckItem.truckId} 
                  className="flex items-start gap-1.5 text-gray-800 dark:text-slate-200 font-medium py-1 border-b border-orange-100 dark:border-orange-900/40 last:border-0 text-xs"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    {(unidadeArea === 'hectares' || unidadeArea === 'hora' || unidadeArea === 'horas') ? (
                      <>
                        Transp. <strong className="font-mono font-bold text-gray-900 dark:text-white">{truckItem.plate || 'S/ Placa'}</strong> ({truckItem.driverName || 'Motorista'}) — {truckItem.loads} Cargas ({truckItem.totalM3.toFixed(1)} m³) — Cobrança por Horas: {truckItem.truckHours || 0}h × {formatCurrencyBRL(truckItem.truckHourlyRate || 0)}/h = Total: <strong className="font-mono font-bold text-orange-950 dark:text-orange-200">{formatCurrencyBRL(truckItem.rateioCost)}</strong>
                      </>
                    ) : (
                      <>
                        Transp. <strong className="font-mono font-bold text-gray-900 dark:text-white">{truckItem.plate || 'S/ Placa'}</strong> ({truckItem.driverName || 'Motorista'}) — {truckItem.loads} Cargas (Capacidade: {truckItem.capacityM3 || 0} m³ | Total Transportado: {truckItem.totalM3.toFixed(1)} m³) — {truckItem.distributionPercent.toFixed(1)}% de Distribuição Global ({formatCurrencyBRL(truckItem.rateioCost)}){truckItem.additionalKmCost > 0 ? ` + Adicional KM (${formatCurrencyBRL(truckItem.additionalKmCost)})` : ''} = Total: <strong className="font-mono font-bold text-orange-950 dark:text-orange-200">{formatCurrencyBRL(truckItem.rateioCost + truckItem.additionalKmCost)}</strong>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {totalGeralDespesas === 0 && (
            <div className="text-gray-400 dark:text-slate-500 italic py-1">
              Nenhuma comissão ou custo adicional configurado para este serviço.
            </div>
          )}

          {/* Linha de Total Geral Despesas */}
          <div className="pt-2 border-t border-orange-200 dark:border-orange-800 flex items-center justify-between font-bold text-sm text-orange-950 dark:text-orange-200">
            <span>Total Geral Despesas:</span>
            <span className="text-base font-extrabold font-mono text-orange-700 dark:text-orange-400">
              {formatCurrencyBRL(totalGeralDespesas)}
            </span>
          </div>

          <p className="text-[10px] text-gray-500 dark:text-slate-400 italic pt-0.5">
            * Comissões não são somadas no valor total do pedido — usadas para pagamento dos operadores e motoristas.
          </p>
        </div>
      </div>

      {/* 3. CARD DE DESTAQUE VERDE: RESULTADO FINAL (LUCRO ESTIMADO) */}
      <div 
        className="bg-gradient-to-br from-emerald-800 to-emerald-900 text-white rounded-xl p-3.5 shadow-sm space-y-2 print-client-hide print-hide-on-client break-inside-avoid"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        <div className="flex items-center justify-between border-b border-emerald-700/60 pb-1.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              3. Resultado Final da Operação (Lucro Líquido Estimado)
            </span>
          </div>
          <span className="text-xs font-extrabold px-2.5 py-0.5 bg-white/20 rounded-full backdrop-blur-xs text-white font-mono">
            Margem: {margemLucroPercent.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-center">
          <div className="bg-emerald-950/40 p-2 rounded flex flex-col justify-center">
            <span className="text-[10px] text-emerald-200 block uppercase font-medium mb-0.5">Receita Bruta (Pedido)</span>
            <strong className="text-sm font-mono text-white block">{formatCurrencyBRL(totalPedido)}</strong>
          </div>
          <div className="bg-emerald-950/40 p-2 rounded flex flex-col justify-center">
            <span className="text-[10px] text-emerald-200 block uppercase font-medium mb-0.5">(-) Comissões & Frotas</span>
            <strong className="text-sm font-mono text-amber-300 block">
              {formatCurrencyBRL(totalGeralDespesas - (totalCombustivelGeral + totalAlimentacaoGeral))}
            </strong>
          </div>
          <div className="bg-emerald-950/40 p-2 rounded flex flex-col justify-center">
            <span className="text-[10px] text-emerald-200 block uppercase font-medium mb-0.5">(-) Combustível & Refeições</span>
            <strong className="text-sm font-mono text-amber-300 block">
              {formatCurrencyBRL(totalCombustivelGeral + totalAlimentacaoGeral)}
            </strong>
          </div>
          <div className="bg-emerald-700/60 border border-emerald-500/40 p-2 rounded flex flex-col justify-center">
            <span className="text-[10px] text-emerald-100 block uppercase font-extrabold mb-0.5">(=) Lucro Líquido</span>
            <strong className="text-base font-black font-mono text-emerald-100 block">{formatCurrencyBRL(lucroEstimado)}</strong>
          </div>
        </div>
      </div>

    </div>
  );
};
