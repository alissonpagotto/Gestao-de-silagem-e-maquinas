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
  driverCommissionFormula?: string;
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
  unidadeArea?: 'sacas' | 'hectares' | 'alqueires' | 'hora' | 'horas';
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
      
      {/* 1. BLOCO RESUMO DO PEDIDO (DESTAQUE VERDE SUAVE COM CONTORNO PRETO) */}
      <div className="border border-black bg-emerald-50 rounded-xl p-3.5 space-y-2.5 border-l-4 border-l-emerald-600 shadow-2xs text-black">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/20 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-700 shrink-0" />
            <h4 className="text-xs font-bold text-black uppercase tracking-wider flex flex-wrap items-center gap-1.5">
              <span>Resumo do Pedido (Cobrado do Cliente)</span>
              {volumeTotalFrotaM3 > 0 && (
                <span className="text-emerald-900 font-extrabold normal-case bg-emerald-100 px-2 py-0.5 rounded text-[11px] border border-emerald-700/50">
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
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span>
                Valor Base do Serviço ({quantidadeArea || 0} {unidadeAreaLabel}):
              </span>
              <span className="font-semibold text-black font-mono">
                {formatCurrencyBRL(valorBaseArea)}
              </span>
            </div>
          )}

          {subtotalServicoMaquina !== undefined && subtotalServicoMaquina > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5">
                <Tractor className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                {descricaoServicoMaquina || 'Serviço de Máquinas / Transporte'}:
              </span>
              <span className="font-semibold text-black font-mono">
                {formatCurrencyBRL(subtotalServicoMaquina)}
              </span>
            </div>
          )}

          {subtotalTrator > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5">
                <Tractor className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                Serviço de Trator / Compactação ({qtdCobrancaTrator || 0} {modoCobrancaTratorLabel}):
              </span>
              <span className="font-semibold text-black font-mono">
                {formatCurrencyBRL(subtotalTrator)}
              </span>
            </div>
          )}

          {numFretePrancha > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                Frete Prancha:
              </span>
              <span className="font-semibold text-black font-mono">
                {formatCurrencyBRL(numFretePrancha)}
              </span>
            </div>
          )}

          {subtotalForrageira > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                Cobrança de Forrageira:
              </span>
              <span className="font-semibold text-black font-mono">
                {formatCurrencyBRL(subtotalForrageira)}
              </span>
            </div>
          )}

          {totalAdicionalKm > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                Adicional KM (Frotas de Alqueires):
              </span>
              <span className="font-semibold text-black font-mono">
                {formatCurrencyBRL(totalAdicionalKm)}
              </span>
            </div>
          )}

          {(unidadeArea === 'hectares' || unidadeArea === 'hora' || unidadeArea === 'horas') && totalFrotasPorHora > 0 && (
            <div className="space-y-1 py-0.5">
              <div className="flex items-center justify-between text-slate-900">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  Transporte Frotas (Cobrança por Horas):
                </span>
                <span className="font-semibold text-black font-mono">
                  {formatCurrencyBRL(totalFrotasPorHora)}
                </span>
              </div>

              {/* INÍCIO DO MAPEAMENTO DE FROTAS NO RESUMO DO CLIENTE (COBRADO DO CLIENTE) */}
              {trucksExpenseDetails && trucksExpenseDetails.length > 0 && (
                <div className="pl-5 space-y-1">
                  {trucksExpenseDetails.map((truckItem) => (
                    <div 
                      key={`resumo-pedido-truck-${truckItem.truckId}`}
                      className="text-xs text-slate-800 font-medium leading-relaxed"
                    >
                      • Transp. <strong className="font-mono font-bold text-black">{truckItem.plate || 'S/ Placa'}</strong> ({truckItem.driverName || 'Motorista'}) – {truckItem.loads} Cargas ({truckItem.totalM3.toFixed(1)} m³) – Cobrança por Horas: {truckItem.truckHours || 0}h × {formatCurrencyBRL(truckItem.truckHourlyRate || 0)}/h = Total: <strong className="font-mono font-bold text-black">{formatCurrencyBRL(truckItem.rateioCost)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {/* FIM DO MAPEAMENTO DE FROTAS NO RESUMO DO CLIENTE (COBRADO DO CLIENTE) */}
            </div>
          )}

          <div className="pt-2 border-t border-black/20 flex items-center justify-between font-bold text-sm text-emerald-950">
            <span>Total do Pedido:</span>
            <span className="text-base font-extrabold font-mono text-emerald-900">
              {formatCurrencyBRL(totalPedido)}
            </span>
          </div>
        </div>
      </div>

      {/* NOVO CARD DEDICADO: CONSUMO DE COMBUSTÍVEL E ALIMENTAÇÃO (ENTRE RESUMO DO PEDIDO E COMISSÕES) */}
      <div className="border border-black bg-[#e0e6f1] rounded-xl p-3.5 space-y-3 shadow-2xs print-client-hide print-hide-on-client text-black">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/20 pb-2">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-sky-700 shrink-0" />
            <h4 className="text-xs font-bold text-black uppercase tracking-wider">
              Consumo de Combustível & Alimentação (Despesas da Operação)
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-sky-900 bg-white border border-gray-400 px-2 py-0.5 rounded">
              Dedutível no DRE
            </span>
            <span className="text-xs font-extrabold text-black font-mono">
              Total do Card: {formatCurrencyBRL(totalCombustivelGeral + totalAlimentacaoGeral)}
            </span>
          </div>
        </div>

        {/* A) SUBSEÇÃO: CONSUMO DE COMBUSTÍVEL (Estrutura fixa por veículo envolvido) */}
        <div className="space-y-2 bg-white/80 p-2.5 rounded-lg border border-black">
          <div className="flex items-center justify-between border-b border-black/20 pb-1">
            <span className="text-[11px] font-bold text-black uppercase flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-sky-700" />
              A. Consumo de Combustível por Veículo
            </span>
            <span className="text-[11px] font-mono font-bold text-sky-900">
              Total Geral de Combustível: {formatCurrencyBRL(totalCombustivelGeral)}
            </span>
          </div>

          {fuelEntries.length === 0 ? (
            <p className="text-[11px] text-slate-700 italic py-1">
              Nenhum veículo ativo selecionado na operação (Ensiladeira, Trator ou Caminhões).
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-[10px] font-bold text-slate-800 uppercase px-1">
                <span className="sm:col-span-5">Veículo / Máquina Ativa</span>
                <span className="sm:col-span-2 text-right">Qtd. Litros</span>
                <span className="sm:col-span-2 text-right">Valor / Litro (R$)</span>
                <span className="sm:col-span-3 text-right">Subtotal Combustível</span>
              </div>

              {fuelEntries.map((entry) => (
                <div
                  key={entry.vehicleId}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#cad4e6]/40 p-2 rounded-md border border-gray-400 text-xs"
                >
                  <div className="sm:col-span-5 font-semibold text-black truncate flex items-center gap-1.5">
                    {entry.vehicleType === 'forrageira' ? (
                      <Scissors className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    ) : entry.vehicleType === 'trator' ? (
                      <Tractor className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    ) : (
                      <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    )}
                    <span className="truncate" title={entry.vehicleName}>
                      {entry.vehicleName}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-black font-bold sm:hidden">
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
                        className="w-full px-2.5 py-1 text-xs bg-white border border-gray-400 rounded-lg font-mono font-bold text-black focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black text-right pr-6 shadow-2xs"
                      />
                      <span className="absolute right-2 top-1 text-[10px] text-slate-700 font-bold">L</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-black font-bold sm:hidden">
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
                        className="w-full px-2.5 py-1 text-xs bg-white border border-gray-400 rounded-lg font-mono font-bold text-black focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black text-right pr-6 shadow-2xs"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-slate-700 font-bold">R$</span>
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex sm:justify-end items-center justify-between">
                    <span className="text-[10px] text-slate-700 sm:hidden">
                      Subtotal:
                    </span>
                    <span className="font-bold font-mono text-black text-xs">
                      {formatCurrencyBRL(entry.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* B) SUBSEÇÃO: ALIMENTAÇÃO E DIÁRIAS (Estrutura Dinâmica) */}
        <div className="space-y-2 bg-white/80 p-2.5 rounded-lg border border-black">
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-black/20 pb-1">
            <span className="text-[11px] font-bold text-black uppercase flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700" />
              B. Alimentação e Diárias da Operação
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-amber-900">
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
            <div className="text-[11px] text-slate-700 italic py-1 flex items-center justify-between">
              <span>Nenhuma refeição ou diária lançada.</span>
              {onAddMealExpense && (
                <button
                  type="button"
                  onClick={onAddMealExpense}
                  className="text-amber-800 font-semibold hover:underline text-[11px] cursor-pointer"
                >
                  + Adicionar Refeição/Despesa
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="hidden sm:grid sm:grid-cols-12 gap-1.5 text-[10px] font-bold text-slate-800 uppercase px-1">
                <span className="sm:col-span-5">Descrição / Tipo</span>
                <span className="sm:col-span-3">Data / Dia do Gasto</span>
                <span className="sm:col-span-3 text-right">Valor (R$)</span>
                <span className="sm:col-span-1 text-center">Ação</span>
              </div>

              {mealExpenses.map((meal) => (
                <div
                  key={meal.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center bg-[#cad4e6]/40 p-1.5 rounded-md border border-gray-400 text-xs"
                >
                  <div className="sm:col-span-5">
                    <select
                      value={meal.description}
                      onChange={(e) => onMealExpenseChange?.(meal.id, 'description', e.target.value)}
                      className="w-full px-2.5 py-1 text-xs bg-white border border-gray-400 rounded-lg font-bold text-black focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black shadow-2xs"
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
                      className="w-full px-2.5 py-1 text-xs bg-white border border-gray-400 rounded-lg font-mono font-bold text-black focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black shadow-2xs"
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
                        className="w-full px-2.5 py-1 text-xs bg-white border border-gray-400 rounded-lg font-mono font-bold text-black focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black text-right pr-6 shadow-2xs"
                      />
                      <span className="absolute right-1.5 top-1 text-[10px] text-slate-700 font-bold">R$</span>
                    </div>
                  </div>

                  <div className="sm:col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveMealExpense?.(meal.id)}
                      className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition cursor-pointer"
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

      {/* 2. BLOCO CUSTOS E PROVENTOS ADICIONAIS - DETALHAMENTO CIRÚRGICO */}
      <div className="border border-black bg-[#e0e6f1] rounded-xl p-3.5 space-y-2.5 print-client-hide print-hide-on-client shadow-2xs text-black">
        <div className="flex items-center justify-between border-b border-black/20 pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-700 shrink-0" />
            <h4 className="text-xs font-bold text-black uppercase tracking-wider">
              Custos e Proventos Adicionais (Comissões & Motoristas)
            </h4>
          </div>
          <span className="text-[10px] font-bold text-orange-900 bg-white border border-gray-400 px-2 py-0.5 rounded">
            Discriminação Nominal
          </span>
        </div>

        <div className="space-y-1.5 text-xs">
          
          {/* Comissão Trator (Nome) */}
          {comissaoTratorP1 > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5">
                <Tractor className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                Comissão Trator ({operadorTratorNome || 'Operador Principal'}):
              </span>
              <span className="font-semibold font-mono text-black">
                {formatCurrencyBRL(comissaoTratorP1)}
              </span>
            </div>
          )}

          {comissaoTratorP2 > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5 pl-4">
                ↳ 2º Operador Trator ({segundoOperadorTratorNome}):
              </span>
              <span className="font-semibold font-mono text-black">
                {formatCurrencyBRL(comissaoTratorP2)}
              </span>
            </div>
          )}

          {/* Comissão Forrageira (Nome) */}
          {comissaoForrageiraP1 > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                Comissão Forrageira ({operadorForrageiraNome || 'Operador Principal'}):
              </span>
              <span className="font-semibold font-mono text-black">
                {formatCurrencyBRL(comissaoForrageiraP1)}
              </span>
            </div>
          )}

          {comissaoForrageiraP2 > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5 pl-4">
                ↳ 2º Operador Forrageira ({segundoOperadorForrageiraNome}):
              </span>
              <span className="font-semibold font-mono text-black">
                {formatCurrencyBRL(comissaoForrageiraP2)}
              </span>
            </div>
          )}

          {/* Comissão Agenciador / Intermediação */}
          {brokerCommissionAmount > 0 && (
            <div className="flex items-center justify-between text-slate-900 py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-700 font-bold">🤝</span>
                Comissão Agenciador ({brokerName || 'Agenciador'}):
              </span>
              <span className="font-semibold font-mono text-black">
                {formatCurrencyBRL(brokerCommissionAmount)}
              </span>
            </div>
          )}

          {/* Comissões Individuais dos Motoristas */}
          {trucksExpenseDetails
            .filter((t) => (t.driverCommissionCost || 0) > 0)
            .map((truckItem) => (
              <div key={`comm-driver-${truckItem.truckId}`} className="py-0.5">
                <div className="flex items-center justify-between text-slate-900 py-0.5">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    🚚 Comissão Motorista ({truckItem.driverName || 'Motorista'}):
                  </span>
                  <span className="font-semibold font-mono text-black">
                    {formatCurrencyBRL(truckItem.driverCommissionCost || 0)}
                  </span>
                </div>
                {truckItem.driverCommissionFormula && (
                  <div className="pl-5 text-[11px] text-slate-700 font-medium leading-relaxed">
                    {truckItem.driverCommissionFormula}
                  </div>
                )}
              </div>
            ))}

          {/* PLOTAGEM NOMINAL E CIRÚRGICA DE CADA CAMINHÃO ATIVO */}
          {trucksExpenseDetails.length > 0 && (
            <div className="pt-1.5 space-y-1.5 border-t border-black/20">
              {trucksExpenseDetails.map((truckItem) => (
                <div 
                  key={truckItem.truckId} 
                  className="flex items-start gap-1.5 text-black font-medium py-1 border-b border-black/10 last:border-0 text-xs"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    {(unidadeArea === 'hectares' || unidadeArea === 'hora' || unidadeArea === 'horas') ? (
                      <>
                        Transp. <strong className="font-mono font-bold text-black">{truckItem.plate || 'S/ Placa'}</strong> ({truckItem.driverName || 'Motorista'}) — {truckItem.loads} Cargas ({truckItem.totalM3.toFixed(1)} m³) — Cobrança por Horas: {truckItem.truckHours || 0}h × {formatCurrencyBRL(truckItem.truckHourlyRate || 0)}/h = Total: <strong className="font-mono font-bold text-orange-950">{formatCurrencyBRL(truckItem.rateioCost)}</strong>
                      </>
                    ) : (
                      <>
                        Transp. <strong className="font-mono font-bold text-black">{truckItem.plate || 'S/ Placa'}</strong> ({truckItem.driverName || 'Motorista'}) — {truckItem.loads} Cargas (Capacidade: {truckItem.capacityM3 || 0} m³ | Total Transportado: {truckItem.totalM3.toFixed(1)} m³) — {truckItem.distributionPercent.toFixed(1)}% de Distribuição Global ({formatCurrencyBRL(truckItem.rateioCost)}){truckItem.additionalKmCost > 0 ? ` + Adicional KM (${formatCurrencyBRL(truckItem.additionalKmCost)})` : ''} = Total: <strong className="font-mono font-bold text-orange-950">{formatCurrencyBRL(truckItem.rateioCost + truckItem.additionalKmCost)}</strong>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {totalGeralDespesas === 0 && (
            <div className="text-slate-700 italic py-1">
              Nenhuma comissão ou custo adicional configurado para este serviço.
            </div>
          )}

          {/* Linha de Total Geral Despesas */}
          <div className="pt-2 border-t border-black/20 flex items-center justify-between font-bold text-sm text-black">
            <span>Total Geral Despesas:</span>
            <span className="text-base font-extrabold font-mono text-orange-800">
              {formatCurrencyBRL(totalGeralDespesas)}
            </span>
          </div>

          <p className="text-[10px] text-slate-700 italic pt-0.5">
            * Comissões não são somadas no valor total do pedido — usadas para pagamento dos operadores e motoristas.
          </p>
        </div>
      </div>

      {/* 3. CARD DE DESTAQUE VERDE: RESULTADO FINAL (LUCRO ESTIMADO) */}
      <div 
        className="bg-gradient-to-br from-emerald-800 to-emerald-900 border border-black text-white rounded-xl p-3.5 shadow-sm space-y-2 print-client-hide print-hide-on-client break-inside-avoid"
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
