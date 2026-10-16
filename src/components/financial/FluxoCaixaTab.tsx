import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Lock,
  Unlock,
  PlusCircle,
  MinusCircle,
  Printer,
  FileText,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  Search,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Building2
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import {
  CaixaOperacional,
  MovimentacaoCaixa,
  VendaPdvCaixa,
  getStoredCaixaOperacional,
  saveStoredCaixaOperacional,
  getStoredHistoricoCaixas,
  abrirCaixaOperacional,
  adicionarSuprimentoCaixa,
  adicionarSangriaCaixa,
  calcularTotaisCaixa,
  fecharCaixaOperacional,
  dispararImpressaoRelatorioCaixa,
  getOperadorLogadoNome,
  syncCaixaComVendas
} from '../../lib/caixaStorage';
import { formatCurrencyBRL, formatDateBR, parseCurrencyToFloat } from '../../lib/formatters';

interface FluxoCaixaTabProps {
  companyProfile?: CompanyProfile | null;
}

export const FluxoCaixaTab: React.FC<FluxoCaixaTabProps> = ({ companyProfile }) => {
  // Operador Ativo Conectado ao RH / Sessão
  const [operadorLogado, setOperadorLogado] = useState<string>(() => getOperadorLogadoNome());

  // Estado do Caixa Atual
  const [caixa, setCaixa] = useState<CaixaOperacional>(() => syncCaixaComVendas(getStoredCaixaOperacional()));
  const [historico, setHistorico] = useState<CaixaOperacional[]>(() => getStoredHistoricoCaixas());

  // Modais
  const [isAbrirModalOpen, setIsAbrirModalOpen] = useState(false);
  const [isSuprimentoModalOpen, setIsSuprimentoModalOpen] = useState(false);
  const [isSangriaModalOpen, setIsSangriaModalOpen] = useState(false);
  const [isFecharModalOpen, setIsFecharModalOpen] = useState(false);

  // Inputs dos Formulários
  const [inputValorAbertura, setInputValorAbertura] = useState('');
  const [inputValorSuprimento, setInputValorSuprimento] = useState('');
  const [inputMotivoSuprimento, setInputMotivoSuprimento] = useState('');
  const [inputValorSangria, setInputValorSangria] = useState('');
  const [inputMotivoSangria, setInputMotivoSangria] = useState('');
  const [inputDestinoSangria, setInputDestinoSangria] = useState('');

  // Fechamento
  const [inputValorContado, setInputValorContado] = useState('');
  const [inputObservacoesFechamento, setInputObservacoesFechamento] = useState('');
  const [formatoImpressao, setFormatoImpressao] = useState<'a4' | 'termica'>('a4');

  // Filtro do Extrato Atual
  const [filtroExtrato, setFiltroExtrato] = useState<'todos' | 'vendas' | 'suprimentos' | 'sangrias'>('todos');
  const [buscaExtrato, setBuscaExtrato] = useState('');

  // Sincronização Reativa com o LocalStorage
  useEffect(() => {
    const handleCaixaUpdate = () => {
      setOperadorLogado(getOperadorLogadoNome());
      setCaixa(syncCaixaComVendas(getStoredCaixaOperacional()));
      setHistorico(getStoredHistoricoCaixas());
    };

    window.addEventListener('agrocontrol_caixa_operacional_updated', handleCaixaUpdate);
    window.addEventListener('agrocontrol_historico_caixas_updated', handleCaixaUpdate);
    window.addEventListener('agrocontrol_vendas_updated', handleCaixaUpdate);
    window.addEventListener('colaca_silagem_session_updated', handleCaixaUpdate);
    window.addEventListener('storage', handleCaixaUpdate);

    return () => {
      window.removeEventListener('agrocontrol_caixa_operacional_updated', handleCaixaUpdate);
      window.removeEventListener('agrocontrol_historico_caixas_updated', handleCaixaUpdate);
      window.removeEventListener('agrocontrol_vendas_updated', handleCaixaUpdate);
      window.removeEventListener('colaca_silagem_session_updated', handleCaixaUpdate);
      window.removeEventListener('storage', handleCaixaUpdate);
    };
  }, []);

  // Atalho [F12] para Fechamento de Caixa do Dia quando caixa estiver aberto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        if (caixa.status === 'ABERTO') {
          setIsFecharModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [caixa.status]);

  // Totais calculados do caixa ativo
  const totais = useMemo(() => calcularTotaisCaixa(caixa), [caixa]);

  // Lista unificada de movimentações do caixa atual para o extrato
  const extratoItems = useMemo(() => {
    if (caixa.status !== 'ABERTO') return [];

    const items: Array<{
      id: string;
      dataHora: string;
      tipo: 'VENDA' | 'SUPRIMENTO' | 'SANGRIA';
      descricao: string;
      formaPagamento: string;
      valor: number;
    }> = [];

    // Vendas PDV
    (caixa.vendasPdv || []).forEach(v => {
      items.push({
        id: v.id,
        dataHora: v.dataHora,
        tipo: 'VENDA',
        descricao: `VENDA ${v.numeroPedido} • ${v.cliente}`,
        formaPagamento: v.formaPagamento,
        valor: v.valor,
      });
    });

    // Suprimentos
    (caixa.suprimentos || []).forEach(s => {
      items.push({
        id: s.id,
        dataHora: s.dataHora,
        tipo: 'SUPRIMENTO',
        descricao: s.motivo,
        formaPagamento: 'DINHEIRO',
        valor: s.valor,
      });
    });

    // Sangrias
    (caixa.sangrias || []).forEach(s => {
      items.push({
        id: s.id,
        dataHora: s.dataHora,
        tipo: 'SANGRIA',
        descricao: `${s.motivo}${s.destino ? ` [${s.destino}]` : ''}`,
        formaPagamento: 'DINHEIRO',
        valor: s.valor,
      });
    });

    // Ordenar do mais recente para o mais antigo
    return items.sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  }, [caixa]);

  const extratoFiltrado = useMemo(() => {
    return extratoItems.filter(item => {
      if (filtroExtrato === 'vendas' && item.tipo !== 'VENDA') return false;
      if (filtroExtrato === 'suprimentos' && item.tipo !== 'SUPRIMENTO') return false;
      if (filtroExtrato === 'sangrias' && item.tipo !== 'SANGRIA') return false;

      if (buscaExtrato.trim()) {
        const query = buscaExtrato.toLowerCase();
        return (
          item.descricao.toLowerCase().includes(query) ||
          item.formaPagamento.toLowerCase().includes(query) ||
          item.dataHora.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [extratoItems, filtroExtrato, buscaExtrato]);

  // Ações de Caixa
  const handleConfirmarAbertura = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseCurrencyToFloat(inputValorAbertura);
    const op = getOperadorLogadoNome();
    const novoCaixa = abrirCaixaOperacional(valor, op);
    setCaixa(novoCaixa);
    setInputValorAbertura('');
    setIsAbrirModalOpen(false);
  };

  const handleConfirmarSuprimento = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseCurrencyToFloat(inputValorSuprimento);
    if (valor <= 0) return;
    const atualizado = adicionarSuprimentoCaixa(valor, inputMotivoSuprimento || 'SUPRIMENTO DE TROCO');
    if (atualizado) setCaixa({ ...atualizado });
    setInputValorSuprimento('');
    setInputMotivoSuprimento('');
    setIsSuprimentoModalOpen(false);
  };

  const handleConfirmarSangria = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseCurrencyToFloat(inputValorSangria);
    if (valor <= 0) return;
    const atualizado = adicionarSangriaCaixa(valor, inputMotivoSangria || 'SANGRIA DE GAVETA', inputDestinoSangria);
    if (atualizado) setCaixa({ ...atualizado });
    setInputValorSangria('');
    setInputMotivoSangria('');
    setInputDestinoSangria('');
    setIsSangriaModalOpen(false);
  };

  const handleConfirmarFechamento = (e: React.FormEvent) => {
    e.preventDefault();
    const valorContado = parseCurrencyToFloat(inputValorContado);
    const op = getOperadorLogadoNome();
    const res = fecharCaixaOperacional(valorContado, inputObservacoesFechamento, op);

    if (res) {
      setCaixa({ ...res.caixaFechado });
      setHistorico(getStoredHistoricoCaixas());
      setIsFecharModalOpen(false);
      setInputValorContado('');
      setInputObservacoesFechamento('');

      // Bypass anti-sandbox: dispara relatório em aba _blank
      dispararImpressaoRelatorioCaixa(res.caixaFechado, companyProfile, formatoImpressao);
    }
  };

  // Diferença calculada no modal de fechamento
  const valorDigitadoFechamento = parseCurrencyToFloat(inputValorContado);
  const diferencaCalculada = Math.round((valorDigitadoFechamento - totais.saldoAtualDinheiro) * 100) / 100;
  const temValorDigitado = inputValorContado.trim() !== '';
  const isConferido = temValorDigitado && Math.abs(diferencaCalculada) < 0.005;
  const isSobra = temValorDigitado && diferencaCalculada > 0.005;
  const isQuebra = temValorDigitado && diferencaCalculada < -0.005;

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      
      {/* =========================================================================
          CENÁRIO 1: CAIXA ESTÁ FECHADO (ABERTURA DE CAIXA PADRÃO OURO)
         ========================================================================= */}
      {caixa.status !== 'ABERTO' ? (
        <div className="space-y-4">
          {/* Card Principal de Abertura */}
          <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl p-5 sm:p-7 shadow-xs max-w-2xl mx-auto my-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-700 dark:text-amber-300 shadow-xs">
              <Lock className="w-7 h-7" />
            </div>

            <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">
              🔓 ABERTURA DE CAIXA DIÁRIO
            </h2>
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider my-2">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>👤 OPERADOR DE ABERTURA: <strong className="text-zinc-800 dark:text-stone-200">{operadorLogado}</strong></span>
            </div>
            <p className="text-xs text-slate-500 dark:text-stone-400 font-medium max-w-md mx-auto mt-1 mb-5">
              O caixa operacional está atualmente fechado. Informe o fundo de troco ou saldo de gaveta para iniciar as movimentações do dia e liberar as vendas no PDV.
            </p>

            <form onSubmit={handleConfirmarAbertura} className="max-w-md mx-auto space-y-3.5">
              <div className="text-left">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                  VALOR INICIAL DE TROCO / FUNDO DE GAVETA *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    value={inputValorAbertura}
                    onChange={(e) => setInputValorAbertura(e.target.value)}
                    placeholder="0,00"
                    autoFocus
                    required
                    className="w-full pl-10 pr-3 py-2 text-base font-black rounded-lg border border-slate-300 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-stone-500 font-medium mt-1 block">
                  Ex: 100,00 ou 250,50 (Pode iniciar com 0,00 se não houver troco)
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>ABRIR CAIXA OPERACIONAL</span>
              </button>
            </form>
          </div>

          {/* Histórico Recente de Fechamentos */}
          {historico.length > 0 && (
            <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl overflow-hidden shadow-xs">
              <div className="p-3 bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600 dark:text-stone-300" />
                  <span className="text-xs font-black uppercase text-zinc-900 dark:text-white">
                    HISTÓRICO DE FECHAMENTOS DE CAIXA ANTERIORES
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-stone-400">
                  {historico.length} registro{historico.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-stone-850 text-slate-600 dark:text-stone-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-stone-700">
                    <tr>
                      <th className="py-1.5 px-3">ID Caixa</th>
                      <th className="py-1.5 px-3">Abertura</th>
                      <th className="py-1.5 px-3">Fechamento</th>
                      <th className="py-1.5 px-3 text-right">Saldo Inicial</th>
                      <th className="py-1.5 px-3 text-right">Vendas PDV</th>
                      <th className="py-1.5 px-3 text-right">Saldo Apurado</th>
                      <th className="py-1.5 px-3 text-center">Diferença</th>
                      <th className="py-1.5 px-3 text-right">Reimpressão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-stone-800">
                    {historico.map((cx) => {
                      const t = calcularTotaisCaixa(cx);
                      const dif = Number(cx.diferenca || 0);
                      return (
                        <tr key={cx.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/40 dark:odd:bg-stone-900 hover:bg-slate-100 dark:hover:bg-stone-800/70 transition">
                          <td className="py-1.5 px-3 font-bold text-zinc-900 dark:text-white">{cx.id}</td>
                          <td className="py-1.5 px-3 text-slate-600 dark:text-stone-300">{cx.dataHoraAbertura || cx.dataAbertura}</td>
                          <td className="py-1.5 px-3 text-slate-600 dark:text-stone-300">{cx.dataHoraFechamento || cx.dataFechamento || '-'}</td>
                          <td className="py-1.5 px-3 text-right font-medium">{formatCurrencyBRL(cx.valorAbertura)}</td>
                          <td className="py-1.5 px-3 text-right font-medium text-emerald-600">{formatCurrencyBRL(t.totalVendasPdv)}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-zinc-900 dark:text-white">{formatCurrencyBRL(cx.valorFechamentoReal)}</td>
                          <td className="py-1.5 px-3 text-center">
                            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                              dif === 0
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : dif > 0
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}>
                              {dif === 0 ? 'EXATO' : dif > 0 ? `+${formatCurrencyBRL(dif)}` : formatCurrencyBRL(dif)}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => dispararImpressaoRelatorioCaixa(cx, companyProfile, 'a4')}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 hover:bg-slate-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-zinc-800 dark:text-white transition cursor-pointer"
                                title="Reimprimir em Folha A4"
                              >
                                📄 A4
                              </button>
                              <button
                                type="button"
                                onClick={() => dispararImpressaoRelatorioCaixa(cx, companyProfile, 'termica')}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 hover:bg-slate-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-zinc-800 dark:text-white transition cursor-pointer"
                                title="Reimprimir em Cupom Térmico 80mm"
                              >
                                📟 80MM
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
            CENÁRIO 2: CAIXA ESTÁ ABERTO (PAINEL MDI SLIM PRO COMPLETO)
           ========================================================================= */
        <div className="space-y-3.5">
          
          {/* TOPO: INDICADORES MICRO COM SOFT COLORS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Card 1: Saldo Inicial */}
            <div className="bg-gradient-to-b from-blue-50/70 to-blue-100/50 dark:from-blue-950/30 dark:to-stone-900 border border-blue-200 dark:border-blue-900/60 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">
                (+) SALDO INICIAL
              </span>
              <div className="text-base sm:text-lg font-black text-blue-950 dark:text-blue-100 font-mono mt-0.5">
                {formatCurrencyBRL(totais.saldoInicial)}
              </div>
              <span className="text-[9.5px] font-semibold text-blue-600/80 dark:text-blue-400 mt-1 block">
                FUNDO DE TROCO INICIAL
              </span>
            </div>

            {/* Card 2: Vendas PDV Dinheiro */}
            <div className="bg-gradient-to-b from-emerald-50/70 to-emerald-100/50 dark:from-emerald-950/30 dark:to-stone-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  (+) VENDAS PDV (DINHEIRO)
                </span>
                <span className="text-[9px] font-bold bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-1 py-0.2 rounded">
                  {caixa.vendasPdv?.length || 0}
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-950 dark:text-emerald-100 font-mono mt-0.5">
                {formatCurrencyBRL(totais.vendasDinheiro)}
              </div>
              <span className="text-[9.5px] font-semibold text-emerald-700/80 dark:text-emerald-400 mt-1 block">
                PIX: {formatCurrencyBRL(totais.vendasPix)}
              </span>
            </div>

            {/* Card 3: Suprimentos */}
            <div className="bg-gradient-to-b from-cyan-50/70 to-cyan-100/50 dark:from-cyan-950/30 dark:to-stone-900 border border-cyan-200 dark:border-cyan-900/60 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider block">
                (+) SUPRIMENTOS
              </span>
              <div className="text-base sm:text-lg font-black text-cyan-950 dark:text-cyan-100 font-mono mt-0.5">
                {formatCurrencyBRL(totais.totalSuprimentos)}
              </div>
              <span className="text-[9.5px] font-semibold text-cyan-700/80 dark:text-cyan-400 mt-1 block">
                {caixa.suprimentos?.length || 0} ENTRADA(S) MANUAL(IS)
              </span>
            </div>

            {/* Card 4: Sangrias */}
            <div className="bg-gradient-to-b from-rose-50/70 to-rose-100/50 dark:from-rose-950/30 dark:to-stone-900 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                (-) SANGRIAS
              </span>
              <div className="text-base sm:text-lg font-black text-rose-950 dark:text-rose-100 font-mono mt-0.5">
                {formatCurrencyBRL(totais.totalSangrias)}
              </div>
              <span className="text-[9.5px] font-semibold text-rose-700/80 dark:text-rose-400 mt-1 block">
                {caixa.sangrias?.length || 0} RETIRADA(S) MANUAL(IS)
              </span>
            </div>

            {/* Card 5: Saldo Atual em Dinheiro */}
            <div className="bg-gradient-to-b from-amber-50 to-amber-100/70 dark:from-amber-950/40 dark:to-stone-900 border-2 border-amber-400/80 dark:border-amber-600 rounded-xl p-3 shadow-xs">
              <span className="text-[10px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                (=) SALDO ATUAL EM DINHEIRO
              </span>
              <div className="text-lg sm:text-xl font-black text-amber-950 dark:text-amber-200 font-mono mt-0.5">
                {formatCurrencyBRL(totais.saldoAtualDinheiro)}
              </div>
              <span className="text-[9.5px] font-bold text-amber-800 dark:text-amber-400 mt-1 block">
                VALOR ESPERADO NA GAVETA
              </span>
            </div>
          </div>

          {/* CENTRO: BARRA DE AÇÕES SLIM COM 3 BOTÕES */}
          <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-stone-400 uppercase tracking-wide">
                OPERACIONAL:
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                CAIXA {caixa.id} (ABERTO DESDE {caixa.dataHoraAbertura || caixa.dataAbertura})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Botão 1: Suprimento */}
              <button
                type="button"
                onClick={() => setIsSuprimentoModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>📥 [+] SUPRIMENTO DE CAIXA</span>
              </button>

              {/* Botão 2: Sangria */}
              <button
                type="button"
                onClick={() => setIsSangriaModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>📤 [-] SANGRIA DE CAIXA</span>
              </button>

              {/* Botão 3: Fechamento com [F12] */}
              <button
                type="button"
                onClick={() => setIsFecharModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="Pressione F12 para abrir rapidamente"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>🔒 [F12] FECHAR CAIXA DO DIA</span>
              </button>
            </div>
          </div>

          {/* EXTRATO COMPACTO EM LINHA ÚNICA ZEBRADA (SLIM PRO) */}
          <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
            {/* Toolbar do Extrato */}
            <div className="p-2.5 bg-slate-100 dark:bg-stone-850 border-b border-slate-300 dark:border-stone-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase text-zinc-900 dark:text-white">
                  EXTRATO DE MOVIMENTAÇÕES DO CICLO ATIVO:
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-stone-400">
                  ({extratoFiltrado.length} lançamentos)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Abas Rápidas do Extrato */}
                <div className="flex items-center bg-slate-200 dark:bg-stone-800 p-0.5 rounded-lg border border-slate-300 dark:border-stone-700 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFiltroExtrato('todos')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      filtroExtrato === 'todos' ? 'bg-white dark:bg-stone-700 text-zinc-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-stone-400'
                    }`}
                  >
                    TODOS
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroExtrato('vendas')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      filtroExtrato === 'vendas' ? 'bg-white dark:bg-stone-700 text-zinc-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-stone-400'
                    }`}
                  >
                    VENDAS PDV
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroExtrato('suprimentos')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      filtroExtrato === 'suprimentos' ? 'bg-white dark:bg-stone-700 text-zinc-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-stone-400'
                    }`}
                  >
                    SUPRIMENTOS
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroExtrato('sangrias')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      filtroExtrato === 'sangrias' ? 'bg-white dark:bg-stone-700 text-zinc-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-stone-400'
                    }`}
                  >
                    SANGRIAS
                  </button>
                </div>

                {/* Campo de Busca Rápida */}
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={buscaExtrato}
                    onChange={(e) => setBuscaExtrato(e.target.value)}
                    placeholder="Filtrar lançamentos..."
                    className="pl-6 pr-2 py-0.5 text-xs rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-48 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Tabela Zebrada py-1 */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-stone-850 text-slate-600 dark:text-stone-400 uppercase text-[10px] font-bold border-b border-slate-300 dark:border-stone-700">
                  <tr>
                    <th className="py-1 px-3">Horário</th>
                    <th className="py-1 px-3">Tipo</th>
                    <th className="py-1 px-3">Descrição / Detalhes</th>
                    <th className="py-1 px-3">Forma Pgto</th>
                    <th className="py-1 px-3 text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-stone-800 font-medium">
                  {extratoFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 dark:text-stone-500">
                        Nenhuma movimentação registrada para este filtro até o momento.
                      </td>
                    </tr>
                  ) : (
                    extratoFiltrado.map((item) => {
                      const isVenda = item.tipo === 'VENDA';
                      const isSuprimento = item.tipo === 'SUPRIMENTO';
                      const isSangria = item.tipo === 'SANGRIA';

                      return (
                        <tr
                          key={item.id}
                          className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/40 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800/70 transition"
                        >
                          <td className="py-1 px-3 text-slate-600 dark:text-stone-300 font-mono text-[11px] whitespace-nowrap">
                            {item.dataHora}
                          </td>
                          <td className="py-1 px-3 whitespace-nowrap">
                            <span
                              className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                                isVenda
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : isSuprimento
                                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {item.tipo}
                            </span>
                          </td>
                          <td className="py-1 px-3 text-zinc-900 dark:text-white font-bold truncate max-w-xs sm:max-w-md">
                            {item.descricao}
                          </td>
                          <td className="py-1 px-3 text-slate-600 dark:text-stone-300 uppercase text-[11px] whitespace-nowrap">
                            {item.formaPagamento}
                          </td>
                          <td
                            className={`py-1 px-3 text-right font-black font-mono whitespace-nowrap ${
                              isSangria
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {isSangria ? '-' : '+'}{formatCurrencyBRL(item.valor)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: SUPRIMENTO DE CAIXA (ENTRADA MANUAL)
         ========================================================================= */}
      {isSuprimentoModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl shadow-xl overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4" />
                <span>📥 SUPRIMENTO DE CAIXA (INJETAR VALOR)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsSuprimentoModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarSuprimento} className="p-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                  VALOR DO SUPRIMENTO (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    value={inputValorSuprimento}
                    onChange={(e) => setInputValorSuprimento(e.target.value)}
                    placeholder="0,00"
                    autoFocus
                    required
                    className="w-full pl-10 pr-3 py-1.5 text-base font-black rounded-lg border border-slate-300 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                  MOTIVO / JUSTIFICATIVA *
                </label>
                <input
                  type="text"
                  value={inputMotivoSuprimento}
                  onChange={(e) => setInputMotivoSuprimento(e.target.value)}
                  placeholder="EX: TROCO ADICIONAL, REFORÇO DE GAVETA"
                  required
                  className="w-full px-3 py-1.5 text-xs font-medium uppercase rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsSuprimentoModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:bg-slate-100 uppercase cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  CONFIRMAR SUPRIMENTO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: SANGRIA DE CAIXA (RETIRADA MANUAL)
         ========================================================================= */}
      {isSangriaModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl shadow-xl overflow-hidden">
            <div className="p-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <MinusCircle className="w-4 h-4" />
                <span>📤 SANGRIA DE CAIXA (RETIRAR VALOR)</span>
              </span>
              <button
                type="button"
                onClick={() => setIsSangriaModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarSangria} className="p-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                  VALOR DA SANGRIA (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">
                    R$
                  </span>
                  <input
                    type="text"
                    value={inputValorSangria}
                    onChange={(e) => setInputValorSangria(e.target.value)}
                    placeholder="0,00"
                    autoFocus
                    required
                    className="w-full pl-10 pr-3 py-1.5 text-base font-black rounded-lg border border-slate-300 dark:border-stone-700 bg-slate-50 dark:bg-stone-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-stone-400 mt-0.5 block">
                  Saldo disponível na gaveta: <strong>{formatCurrencyBRL(totais.saldoAtualDinheiro)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                  DESPESA / MOTIVO DA RETIRADA *
                </label>
                <input
                  type="text"
                  value={inputMotivoSangria}
                  onChange={(e) => setInputMotivoSangria(e.target.value)}
                  placeholder="EX: DEPÓSITO BANCÁRIO, PAGAMENTO FORNECEDOR"
                  required
                  className="w-full px-3 py-1.5 text-xs font-medium uppercase rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                  DESTINO / FAVORECIDO (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={inputDestinoSangria}
                  onChange={(e) => setInputDestinoSangria(e.target.value)}
                  placeholder="EX: CONTA SICREDI, DIÁRIA TRATORISTA"
                  className="w-full px-3 py-1.5 text-xs font-medium uppercase rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsSangriaModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:bg-slate-100 uppercase cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  CONFIRMAR SANGRIA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: FECHAMENTO DE CAIXA CONSOLIDADO & IMPRESSÃO (SLIM PRO)
         ========================================================================= */}
      {isFecharModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 animate-in fade-in duration-150">
          <div className="w-full max-w-xl max-h-[95vh] bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
            {/* Cabeçalho Acetinado */}
            <div className="p-3 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  <span>🔒 CONCILIAÇÃO E FECHAMENTO DE CAIXA: {caixa.id}</span>
                </span>
                {/* Linha Slim com fonte micro padrão ouro */}
                <div className="text-[11px] font-semibold text-amber-100 uppercase tracking-wider mt-0.5 flex items-center gap-1">
                  <span>👤 OPERADOR RESPONSÁVEL: {operadorLogado}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFecharModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarFechamento} className="p-3.5 space-y-2.5 overflow-y-auto max-h-[calc(95vh-60px)]">
              {/* Linha Slim Adicional de Auditoria de Operador */}
              <div className="py-1 px-3 rounded-lg bg-slate-100 dark:bg-stone-850 border border-slate-200 dark:border-stone-700 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider">
                <span>👤 OPERADOR RESPONSÁVEL: <strong className="text-zinc-900 dark:text-white font-bold">{operadorLogado}</strong></span>
                <span>ABERTURA: {caixa.operadorAbertura || caixa.operador || operadorLogado}</span>
              </div>

              {/* Grid de Conciliação Física vs Discriminação Eletrônica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Bloco 1: Demonstrativo de Caixa Físico (Gaveta) */}
                <div className="bg-slate-50 dark:bg-stone-800/80 p-2.5 rounded-xl border border-slate-300 dark:border-stone-700 space-y-1 text-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-stone-300 pb-1 border-b border-slate-200 dark:border-stone-700">
                    💰 GAVETA FÍSICA (EM DINHEIRO)
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(+) SALDO INICIAL:</span>
                    <span className="font-bold">{formatCurrencyBRL(totais.saldoInicial)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(+) SUPRIMENTOS DE CAIXA:</span>
                    <span className="font-bold text-cyan-600">{formatCurrencyBRL(totais.totalSuprimentos)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(+) VENDAS EM DINHEIRO:</span>
                    <span className="font-bold text-emerald-600">{formatCurrencyBRL(totais.vendasDinheiro)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(-) SANGRIAS / RETIRADAS:</span>
                    <span className="font-bold text-rose-600">{formatCurrencyBRL(totais.totalSangrias)}</span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-stone-700 pt-1.5 flex justify-between font-black text-xs text-zinc-900 dark:text-white">
                    <span>(=) SALDO SISTEMA (ESPERADO):</span>
                    <span className="text-amber-700 dark:text-amber-400 font-mono text-sm">
                      {formatCurrencyBRL(totais.saldoAtualDinheiro)}
                    </span>
                  </div>
                </div>

                {/* Bloco 2: Discriminação Completa por Modalidade de Pagamento */}
                <div className="bg-slate-50 dark:bg-stone-800/80 p-2.5 rounded-xl border border-slate-300 dark:border-stone-700 space-y-1 text-xs">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-stone-300 pb-1 border-b border-slate-200 dark:border-stone-700 flex justify-between">
                    <span>💳 VENDAS POR MODALIDADE</span>
                    <span className="text-[9.5px] text-emerald-600 font-bold">{formatCurrencyBRL(totais.totalVendasPdv)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(+) VENDAS EM DINHEIRO:</span>
                    <span className="font-bold text-emerald-600">{formatCurrencyBRL(totais.vendasDinheiro)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(+) VENDAS EM PIX:</span>
                    <span className="font-bold text-blue-600">{formatCurrencyBRL(totais.vendasPix)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(+) VENDAS EM CARTÃO DE DÉBITO:</span>
                    <span className="font-bold text-indigo-600">{formatCurrencyBRL(totais.vendasDebito)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(+) VENDAS EM CARTÃO DE CRÉDITO:</span>
                    <span className="font-bold text-purple-600">{formatCurrencyBRL(totais.vendasCredito)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-stone-400 py-0.5">
                    <span>(+) VENDAS EM CARTEIRA / BOLETO:</span>
                    <span className="font-bold text-amber-600">{formatCurrencyBRL(totais.vendasCarteiraBoleto)}</span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-stone-700 pt-1 flex justify-between font-bold text-[10.5px] text-slate-700 dark:text-stone-300">
                    <span>CONFERÊNCIA MAQUININHA (PIX/CARTÕES):</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono">
                      {formatCurrencyBRL(totais.totalEletronicoMaquininha)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Input Valor Físico */}
              <div>
                <label className="block text-[11px] font-black text-zinc-900 dark:text-white uppercase mb-1">
                  VALOR FÍSICO CONTADO NA GAVETA (EM MÃOS) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-base">
                    R$
                  </span>
                  <input
                    type="text"
                    value={inputValorContado}
                    onChange={(e) => setInputValorContado(e.target.value)}
                    placeholder={totais.saldoAtualDinheiro.toFixed(2).replace('.', ',')}
                    autoFocus
                    required
                    className="w-full pl-11 pr-3 py-1.5 text-lg font-black rounded-lg border-2 border-amber-500 bg-amber-50/40 dark:bg-stone-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Box Reativa de Situação do Fechamento */}
              <div
                className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-between transition-colors ${
                  isConferido
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-200'
                    : isSobra
                      ? 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                      : isQuebra
                        ? 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-stone-800 dark:text-stone-300'
                }`}
              >
                <span>SITUAÇÃO DO FECHAMENTO:</span>
                <span className="font-black text-xs sm:text-sm font-mono">
                  {isConferido
                    ? '✅ CAIXA CONFERIDO - SEM DIVERGÊNCIAS'
                    : isSobra
                      ? `🟢 SOBRA: +${formatCurrencyBRL(diferencaCalculada)}`
                      : isQuebra
                        ? `🔴 QUEBRA: -${formatCurrencyBRL(Math.abs(diferencaCalculada))}`
                        : 'DIGITE O VALOR CONTADO'}
                </span>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-0.5">
                  JUSTIFICATIVA / OBSERVAÇÕES
                </label>
                <input
                  type="text"
                  value={inputObservacoesFechamento}
                  onChange={(e) => setInputObservacoesFechamento(e.target.value)}
                  placeholder="EX: CAIXA CONFERIDO SEM DIVERGÊNCIAS"
                  className="w-full px-3 py-1 text-xs font-medium uppercase rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white"
                />
              </div>

              {/* Seletor Formato Impressão */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-stone-300 uppercase mb-1">
                  FORMATO DE IMPRESSÃO DO RELATÓRIO:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormatoImpressao('a4')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer uppercase transition ${
                      formatoImpressao === 'a4'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-stone-800 dark:text-stone-400'
                    }`}
                  >
                    <span>📄 FOLHA A4 RETRATO</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormatoImpressao('termica')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer uppercase transition ${
                      formatoImpressao === 'termica'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-stone-800 dark:text-stone-400'
                    }`}
                  >
                    <span>📟 TÉRMICA 80MM (CUPOM)</span>
                  </button>
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsFecharModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 text-slate-600 hover:bg-slate-100 uppercase cursor-pointer"
                >
                  ✕ [ESC] CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>🔒 FINALIZAR FECHAMENTO E IMPRIMIR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
