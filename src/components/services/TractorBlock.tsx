import React from 'react';
import { Tractor, User, Calculator, Clock, Layers, Info, X, Check } from 'lucide-react';
import { Machinery, Employee } from '../../types';
import { formatCurrencyBRL } from '../../lib/storage';
import { isTrator, findLinkedOperator, formatEmployeeOptionLabel, formatMachineryOptionLabel } from './serviceHelpers';

interface TractorBlockProps {
  blockTitle?: string;
  fieldLabel?: string;
  operatorFieldLabel?: string;
  machineries: Machinery[];
  employees: Employee[];
  selectedMachineryIds: Set<string>;
  quantidadeAreaGlobal?: number | '';
  
  // Trator Selecionado
  tratorId: string;
  tratorNome: string;
  onSelectTrator: (tratorId: string, tratorNome: string, operator: { id: string; name: string }) => void;
  onTratorNomeChange: (name: string) => void;

  // Operadores
  operadorTratorId: string;
  operadorTratorNome: string;
  onOperadorChange: (id: string, name: string) => void;
  segundoOperadorTratorId: string;
  segundoOperadorTratorNome: string;
  onSegundoOperadorChange: (id: string, name: string) => void;

  // Faturamento da Máquina (Cobrança do Trator)
  modoCobrancaTrator: 'horas' | 'area_alq' | 'area_ha';
  onModoCobrancaChange: (modo: 'horas' | 'area_alq' | 'area_ha') => void;
  qtdCobrancaTrator: number | '';
  onQtdCobrancaChange: (qtd: number | '') => void;
  valorUnitarioTrator: number | '';
  onValorUnitarioChange: (val: number | '') => void;
  subtotalTrator: number;

  // Comissão do Operador (Independente)
  modoComissaoOperador: 'horas' | 'area_alq' | 'area_ha' | 'livre';
  onModoComissaoChange: (modo: 'horas' | 'area_alq' | 'area_ha' | 'livre') => void;
  qtdBaseComissao: number | '';
  onQtdBaseComissaoChange: (qtd: number | '') => void;
  taxaComissaoOperador: number | '';
  onTaxaComissaoChange: (taxa: number | '') => void;
  comissaoTratorP1Total: number;
  comissaoTratorP2Total: number;
  comissaoFormulaP1: string;
  comissaoFormulaP2: string;
}

export const TractorBlock: React.FC<TractorBlockProps> = ({
  blockTitle = 'Trator & Compactação do Silo',
  fieldLabel = 'Selecione um Trator',
  operatorFieldLabel = 'Operador do Trator',
  machineries,
  employees,
  selectedMachineryIds,
  quantidadeAreaGlobal,
  tratorId,
  tratorNome,
  onSelectTrator,
  onTratorNomeChange,
  operadorTratorId,
  operadorTratorNome,
  onOperadorChange,
  segundoOperadorTratorId,
  segundoOperadorTratorNome,
  onSegundoOperadorChange,
  modoCobrancaTrator,
  onModoCobrancaChange,
  qtdCobrancaTrator,
  onQtdCobrancaChange,
  valorUnitarioTrator,
  onValorUnitarioChange,
  subtotalTrator,
  modoComissaoOperador,
  onModoComissaoChange,
  qtdBaseComissao,
  onQtdBaseComissaoChange,
  taxaComissaoOperador,
  onTaxaComissaoChange,
  comissaoTratorP1Total,
  comissaoTratorP2Total,
  comissaoFormulaP1,
  comissaoFormulaP2,
}) => {
  // Filtra APENAS tratores e aplica a regra de exclusão (oculta os já selecionados em outros campos)
  const tratoresDisponiveis = machineries.filter((m) => {
    if (!isTrator(m)) return false;
    // Se for o trator atualmente selecionado neste campo, mantém. Caso contrário, se já estiver em uso, oculta.
    return m.id === tratorId || !selectedMachineryIds.has(m.id);
  });

  const isTractorActive = Boolean(tratorId || tratorNome.trim());

  // SINCRONIZAÇÃO AUTOMÁTICA DE REFERÊNCIAS:
  // 1. Faturamento do Trator: Se configurado por "Por Alqueire (alq)" ou "Por Hectare (ha)", puxa automaticamente o valor da área global
  React.useEffect(() => {
    if (modoCobrancaTrator !== 'horas' && quantidadeAreaGlobal !== undefined && quantidadeAreaGlobal !== '') {
      if (qtdCobrancaTrator !== quantidadeAreaGlobal) {
        onQtdCobrancaChange(quantidadeAreaGlobal);
      }
    }
  }, [modoCobrancaTrator, quantidadeAreaGlobal, qtdCobrancaTrator, onQtdCobrancaChange]);

  // 2. Comissão do Operador: Se "Por Horas (h)", puxa as horas faturadas do trator acima. Se "Por Área", puxa a área global. Se 'livre', preserva a base digitada.
  React.useEffect(() => {
    if (modoComissaoOperador === 'livre') {
      return;
    }
    if (modoComissaoOperador === 'horas') {
      if (qtdCobrancaTrator !== undefined && qtdCobrancaTrator !== '') {
        if (qtdBaseComissao !== qtdCobrancaTrator) {
          onQtdBaseComissaoChange(qtdCobrancaTrator);
        }
      }
    } else {
      if (quantidadeAreaGlobal !== undefined && quantidadeAreaGlobal !== '') {
        if (qtdBaseComissao !== quantidadeAreaGlobal) {
          onQtdBaseComissaoChange(quantidadeAreaGlobal);
        }
      }
    }
  }, [modoComissaoOperador, qtdCobrancaTrator, quantidadeAreaGlobal, qtdBaseComissao, onQtdBaseComissaoChange]);

  // Limpa completamente todos os campos vinculados ao trator (Opção Neutra)
  const handleClearTractor = () => {
    onSelectTrator('', '', { id: '', name: '' });
    onTratorNomeChange('');
    onOperadorChange('', '');
    onSegundoOperadorChange('', '');
    onQtdCobrancaChange('');
    onValorUnitarioChange('');
    onQtdBaseComissaoChange('');
    onTaxaComissaoChange('');
  };

  const handleSelectMachinery = (id: string) => {
    if (!id) {
      handleClearTractor();
      return;
    }

    const mach = machineries.find((m) => m.id === id);
    if (!mach) return;

    const nomeFormatado = formatMachineryOptionLabel(mach);
    const linkedOp = findLinkedOperator(mach, employees);

    // Passa operador principal vinculado e NUNCA preenche o segundo operador
    onSelectTrator(mach.id, nomeFormatado, linkedOp);
    onTratorNomeChange(nomeFormatado);
    onSegundoOperadorChange('', '');
  };

  return (
    <div className={`border rounded-xl p-3 sm:p-3.5 space-y-3 border-l-4 transition-colors shadow-sm bg-white dark:bg-stone-900 border-zinc-300 dark:border-stone-700 ${
      isTractorActive 
        ? 'border-l-zinc-800 dark:border-l-zinc-400' 
        : 'border-l-zinc-400 dark:border-l-zinc-600'
    }`}>
      
      {/* Cabeçalho do Bloco */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-stone-700 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 dark:bg-stone-800 text-white flex items-center justify-center shadow-2xs shrink-0">
            <Tractor className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
            {blockTitle}
          </span>
          {!isTractorActive && (
            <span className="text-[10px] uppercase font-bold text-zinc-600 dark:text-stone-400 bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 px-2 py-0.5 rounded shadow-2xs">
              Desativado / Nenhum
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-stone-400 bg-zinc-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-full border border-zinc-300 dark:border-stone-700 shadow-2xs">
            Faturamento & Operador Independentes
          </span>
          {isTractorActive && (
            <button
              type="button"
              onClick={handleClearTractor}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded-md shadow-2xs transition cursor-pointer ml-1"
              title="Não utilizar trator e zerar custos"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remover Trator</span>
            </button>
          )}
        </div>
      </div>

      {/* Seleção do Equipamento (APENAS TRATORES com OPÇÃO NEUTRA e REGRA DE EXCLUSÃO) */}
      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {fieldLabel}
            </label>
            <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-semibold">
              {tratoresDisponiveis.length} trator(es) cadastrado(s) disponível(is)
            </span>
          </div>
          
          <div className="relative">
            <input
              type="text"
              value={tratorNome}
              onChange={(e) => onTratorNomeChange(e.target.value)}
              placeholder="-- Não Utilizar Trator / Nenhum (Clique para escolher) --"
              className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-700 font-semibold shadow-2xs transition-colors"
            />
            <select
              value={tratorId}
              onChange={(e) => handleSelectMachinery(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              title="Selecionar trator cadastrado"
            >
              <option value="">-- Não Utilizar Trator / Nenhum --</option>
              {tratoresDisponiveis.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatMachineryOptionLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Se o trator estiver desativado/neutro, exibe card explicativo e oculta campos internos */}
        {!isTractorActive ? (
          <div className="p-3 rounded-lg border border-dashed border-zinc-300 dark:border-stone-700 bg-zinc-50 dark:bg-stone-800/40 text-center text-xs text-zinc-700 dark:text-stone-300 shadow-2xs">
            <p className="font-bold text-zinc-800 dark:text-stone-200">
              Nenhum trator selecionado para este serviço.
            </p>
            <p className="text-[11px] mt-0.5 text-zinc-600 dark:text-stone-400">
              Os custos de faturamento e comissão do trator estão zerados e não afetarão o DRE final. Para adicionar, clique no campo acima e selecione um trator da lista.
            </p>
          </div>
        ) : (
          <>
            {/* Operadores: Principal (Autocompletado) e Segundo Operador (Opcional - inicia vazio) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>{operatorFieldLabel} (Principal)</span>
                  <span className="text-[10px] text-zinc-700 dark:text-stone-300 bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 font-bold px-1.5 py-0.2 rounded shadow-2xs">Autocompletado</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={operadorTratorNome}
                    onChange={(e) => onOperadorChange('', e.target.value)}
                    placeholder="Ex: Tratorista Roberto"
                    className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-700 shadow-2xs transition-colors"
                  />
                  {employees.length > 0 && (
                    <select
                      value={operadorTratorId}
                      onChange={(e) => {
                        const emp = employees.find((em) => em.id === e.target.value);
                        onOperadorChange(e.target.value, emp ? emp.name : '');
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      title="Selecionar operador principal"
                    >
                      <option value="">-- Escolher Operador --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {formatEmployeeOptionLabel(emp)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Segundo Operador (Opcional)</span>
                  <span className="text-[10px] text-zinc-500 dark:text-stone-400 font-semibold">Inicia Vazio</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={segundoOperadorTratorNome}
                    onChange={(e) => onSegundoOperadorChange('', e.target.value)}
                    placeholder="Ex: Auxiliar de Silo / Suplente"
                    className="w-full px-3 py-1.5 sm:py-2 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-700 shadow-2xs transition-colors"
                  />
                  {employees.length > 0 && (
                    <select
                      value={segundoOperadorTratorId}
                      onChange={(e) => {
                        const emp = employees.find((em) => em.id === e.target.value);
                        onSegundoOperadorChange(e.target.value, emp ? emp.name : '');
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      title="Selecionar segundo operador"
                    >
                      <option value="">-- Nenhum segundo operador --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {formatEmployeeOptionLabel(emp)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* SEÇÃO 1 DA INDEPENDÊNCIA: COBRANÇA DO TRATOR (CLIENTE) */}
            <div className="bg-zinc-50 dark:bg-stone-850 border border-zinc-300 dark:border-stone-700 rounded-lg p-3 space-y-2.5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Tractor className="w-3.5 h-3.5 text-zinc-700 dark:text-stone-300" />
                  1. COBRANÇA DO TRATOR (FATURAMENTO DA MÁQUINA)
                </span>

                {/* Seletor Individual de Unidade do Trator - 3D Metálico */}
                <div className="inline-flex rounded-lg p-1 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] self-start sm:self-auto text-xs gap-1">
                  <button
                    type="button"
                    onClick={() => onModoCobrancaChange('horas')}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer ${
                      modoCobrancaTrator === 'horas'
                        ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 hover:bg-slate-200/50 font-semibold'
                    }`}
                  >
                    Horas (h)
                  </button>
                  <button
                    type="button"
                    onClick={() => onModoCobrancaChange('area_alq')}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer ${
                      modoCobrancaTrator === 'area_alq'
                        ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 hover:bg-slate-200/50 font-semibold'
                    }`}
                  >
                    Por Alqueire (alq)
                  </button>
                  <button
                    type="button"
                    onClick={() => onModoCobrancaChange('area_ha')}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer ${
                      modoCobrancaTrator === 'area_ha'
                        ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 hover:bg-slate-200/50 font-semibold'
                    }`}
                  >
                    Por Hectare (ha)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>{modoCobrancaTrator === 'horas' ? 'Horas Trabalhadas (h)' : modoCobrancaTrator === 'area_alq' ? 'Área Cobrada (Alqueires)' : 'Área Cobrada (Hectares)'}</span>
                    {modoCobrancaTrator !== 'horas' && (
                      <span className="text-[10px] text-zinc-700 dark:text-stone-300 font-semibold bg-zinc-200 dark:bg-stone-700 px-1.5 py-0.2 rounded">
                        Puxado da Área
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    readOnly={modoCobrancaTrator !== 'horas'}
                    value={qtdCobrancaTrator}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onChange={(e) => onQtdCobrancaChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={modoCobrancaTrator === 'horas' ? 'Ex: 10.0 (Input livre)' : 'Puxado da Área Global'}
                    className={`w-full px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      modoCobrancaTrator === 'horas'
                        ? 'bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-700 shadow-2xs transition-colors'
                        : 'bg-zinc-100 dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 text-zinc-800 dark:text-stone-300 cursor-not-allowed'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    R$ / {modoCobrancaTrator === 'horas' ? 'Hora Trator' : modoCobrancaTrator === 'area_alq' ? 'Alqueire Trator' : 'Hectare Trator'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorUnitarioTrator}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onChange={(e) => onValorUnitarioChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 220.00"
                    className="w-full px-2.5 py-1 sm:py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-700 shadow-2xs transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Subtotal do Trator (Cobrado)
                  </label>
                  <div className="w-full px-2.5 py-1 sm:py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-zinc-900 dark:text-white flex items-center justify-between shadow-2xs">
                    <span>{formatCurrencyBRL(subtotalTrator)}</span>
                    <span className="text-[10px] font-normal text-zinc-600 dark:text-stone-400">
                      {qtdCobrancaTrator || 0} {modoCobrancaTrator === 'horas' ? 'h' : modoCobrancaTrator === 'area_alq' ? 'alq' : 'ha'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2 DA INDEPENDÊNCIA: COMISSÃO DO OPERADOR DO TRATOR (INFORMATIVA DRE) */}
            <div className="bg-zinc-50 dark:bg-stone-850 border border-zinc-300 dark:border-stone-700 rounded-lg p-3 space-y-2.5 print-client-hide shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-700 dark:text-stone-300" />
                  2. COMISSÃO DO OPERADOR DO TRATOR (INDEPENDENTE)
                </span>

                {/* Seletor Individual de Unidade para a Comissão do Operador - 3D Metálico */}
                <div className="inline-flex rounded-lg p-1 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)] self-start sm:self-auto text-xs gap-1">
                  <button
                    type="button"
                    onClick={() => onModoComissaoChange('livre')}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer ${
                      modoComissaoOperador === 'livre'
                        ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 hover:bg-slate-200/50 font-semibold'
                    }`}
                  >
                    Digitar (livre)
                  </button>
                  <button
                    type="button"
                    onClick={() => onModoComissaoChange('horas')}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer ${
                      modoComissaoOperador === 'horas'
                        ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 hover:bg-slate-200/50 font-semibold'
                    }`}
                  >
                    Por Horas (h)
                  </button>
                  <button
                    type="button"
                    onClick={() => onModoComissaoChange('area_alq')}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer ${
                      modoComissaoOperador === 'area_alq'
                        ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 hover:bg-slate-200/50 font-semibold'
                    }`}
                  >
                    Por Alqueire (alq)
                  </button>
                  <button
                    type="button"
                    onClick={() => onModoComissaoChange('area_ha')}
                    className={`px-2.5 py-1 text-xs rounded-md transition cursor-pointer ${
                      modoComissaoOperador === 'area_ha'
                        ? 'bg-gradient-to-b from-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-750 text-slate-900 dark:text-white font-bold border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-stone-400 hover:text-slate-900 dark:hover:text-stone-200 hover:bg-slate-200/50 font-semibold'
                    }`}
                  >
                    Por Hectare (ha)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Base do Operador ({modoComissaoOperador === 'livre' ? 'Digitada Livre' : modoComissaoOperador === 'horas' ? 'Horas trabalhadas' : modoComissaoOperador === 'area_alq' ? 'Alqueires' : 'Hectares'})</span>
                    {modoComissaoOperador !== 'livre' && (
                      <span className="text-[10px] text-zinc-700 dark:text-stone-300 font-semibold bg-zinc-200 dark:bg-stone-700 px-1.5 py-0.2 rounded">
                        {modoComissaoOperador === 'horas' ? 'Puxado Horas Trator' : 'Puxado Área Global'}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    readOnly={modoComissaoOperador !== 'livre'}
                    value={qtdBaseComissao}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onChange={(e) => onQtdBaseComissaoChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={
                      modoComissaoOperador === 'livre'
                        ? 'Digite a base livremente'
                        : modoComissaoOperador === 'horas'
                        ? 'Puxado das Horas do Trator'
                        : 'Puxado da Área Global'
                    }
                    className={`w-full px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      modoComissaoOperador === 'livre'
                        ? 'bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-700 shadow-2xs transition-colors'
                        : 'bg-zinc-100 dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 text-zinc-800 dark:text-stone-300 cursor-not-allowed'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    R$ Comissão por {modoComissaoOperador === 'livre' ? 'Hora / Unidade (R$)' : modoComissaoOperador === 'horas' ? 'Hora (R$/h)' : modoComissaoOperador === 'area_alq' ? 'Alqueire (R$/alq)' : 'Hectare (R$/ha)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={typeof taxaComissaoOperador === 'number' ? Number(taxaComissaoOperador.toFixed(2)) : taxaComissaoOperador}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    onChange={(e) => onTaxaComissaoChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 15.00"
                    className="w-full px-2.5 py-1 sm:py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-700 shadow-2xs transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>

            {/* Card Informativo de Comissão do Operador do Trator */}
            <div className="bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-md p-2 space-y-1 text-xs text-zinc-900 dark:text-stone-100">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-zinc-700 dark:text-stone-300" />
                  Comissão Operador ({operadorTratorNome || 'Não selecionado'}):
                </span>
                <span className="font-mono font-bold">
                  {comissaoFormulaP1 ? `${comissaoFormulaP1} (informativo)` : `${formatCurrencyBRL(comissaoTratorP1Total)} (informativo)`}
                </span>
              </div>

              {segundoOperadorTratorNome && comissaoTratorP2Total > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-stone-700">
                  <span className="font-semibold">
                    Comissão 2º Operador ({segundoOperadorTratorNome}):
                  </span>
                  <span className="font-mono font-bold">
                    {comissaoFormulaP2 ? `${comissaoFormulaP2} (informativo)` : `${formatCurrencyBRL(comissaoTratorP2Total)} (informativo)`}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
};
