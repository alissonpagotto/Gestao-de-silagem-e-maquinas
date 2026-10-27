import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Wallet, 
  Users, 
  Package, 
  Layers, 
  ShieldCheck, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { CompanyProfile } from '../../types';
import { EnsiladeiraVector } from './EnsiladeiraVector';
import { ColacaSilagemEmblem } from './ColacaSilagemEmblem';

export interface AgroControlHomeProps {
  onNavigate: (tab: string) => void;
  companyProfile?: CompanyProfile;
}

interface IndicatorValues {
  receberVencidos: number;
  receberHoje: number;
  receberCheques: number;
  pagarVencidos: number;
  pagarHoje: number;
  pagarCheques: number;
  clientesAusentes: number;
  clientesBloqueados: number;
  clientesAniversariantes: number;
  produtosEstoqueBaixo: number;
  produtosVencendoHoje: number;
  produtosCicloVida: number;
  outrosEntregas: number;
  outrosSemVendas: number;
  outrosCobrancasPrevistas: number;
  monitorFiscalStatus: string;
}

const DEFAULT_INDICATORS: IndicatorValues = {
  receberVencidos: 0,
  receberHoje: 0,
  receberCheques: 0,
  pagarVencidos: 0,
  pagarHoje: 0,
  pagarCheques: 0,
  clientesAusentes: 0,
  clientesBloqueados: 0,
  clientesAniversariantes: 0,
  produtosEstoqueBaixo: 0,
  produtosVencendoHoje: 0,
  produtosCicloVida: 0,
  outrosEntregas: 0,
  outrosSemVendas: 0,
  outrosCobrancasPrevistas: 0,
  monitorFiscalStatus: 'ATIVO'
};

export function calculateRealIndicators(): IndicatorValues {
  const todayIso = new Date().toISOString().split('T')[0];

  // 1. CONTAS A RECEBER (DÉBITOS VENCIDOS & DÉB. VENCENDO HOJE)
  // Diretriz do Contrato Master: Deve ler a chave 'agrocontrol_contas_receber' filtrando por vencidos (STATUS === "PENDENTE" && VENCIMENTO < HOJE). Se estiver vazio, exibe obrigatoriamente "0".
  let itensReceber: any[] = [];
  try {
    const raw = localStorage.getItem('agrocontrol_contas_receber') ||
                localStorage.getItem('agrocontrol_financeiro_receber') ||
                localStorage.getItem('agrocontrol_receber');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) itensReceber = parsed;
    }
  } catch (e) {
    itensReceber = [];
  }

  const receberVencidos = itensReceber.filter((item: any) => {
    const status = String(item.status || item.STATUS || item.paymentStatus || '').trim().toUpperCase();
    if (status !== 'PENDENTE') return false;

    let venc = String(item.vencimento || item.VENCIMENTO || item.data_vencimento || item.dueDate || item.deliveryDate || item.date || '').trim();
    if (!venc) return false;

    if (venc.includes('/')) {
      const parts = venc.split('/');
      if (parts.length === 3) venc = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else if (venc.includes('T')) {
      venc = venc.split('T')[0];
    }

    return venc < todayIso;
  }).length;

  const receberHoje = itensReceber.filter((item: any) => {
    const status = String(item.status || item.STATUS || item.paymentStatus || '').trim().toUpperCase();
    if (status !== 'PENDENTE') return false;

    let venc = String(item.vencimento || item.VENCIMENTO || item.data_vencimento || item.dueDate || item.deliveryDate || item.date || '').trim();
    if (!venc) return false;

    if (venc.includes('/')) {
      const parts = venc.split('/');
      if (parts.length === 3) venc = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else if (venc.includes('T')) {
      venc = venc.split('T')[0];
    }

    return venc === todayIso;
  }).length;

  let receberCheques = 0;
  try {
    const rawCheques = localStorage.getItem('silagem_facil_clean_v1_financeiro_cheques') || localStorage.getItem('agrocontrol_cheques');
    if (rawCheques) {
      const cheques = JSON.parse(rawCheques);
      if (Array.isArray(cheques)) {
        receberCheques = cheques.filter((c: any) => {
          const st = String(c.status || '').toUpperCase();
          const isPending = st !== 'COMPENSADO' && st !== 'DEPOSITADO' && st !== 'CANCELADO';
          let dt = String(c.bomPara || c.dataVencimento || c.vencimento || '').trim();
          if (dt.includes('/')) {
            const p = dt.split('/');
            if (p.length === 3) dt = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
          } else if (dt.includes('T')) {
            dt = dt.split('T')[0];
          }
          return isPending && dt === todayIso;
        }).length;
      }
    }
  } catch {}

  // 2. CONTAS A PAGAR
  let pagarVencidos = 0;
  let pagarHoje = 0;
  try {
    const rawDesp = localStorage.getItem('silagem_facil_clean_v1_expenses') ||
                    localStorage.getItem('agrocontrol_despesas') ||
                    localStorage.getItem('agrocontrol_contas_pagar');
    if (rawDesp) {
      const despesas = JSON.parse(rawDesp);
      if (Array.isArray(despesas)) {
        pagarVencidos = despesas.filter((d: any) => {
          const st = String(d.status || '').toLowerCase();
          if (st === 'pago' || st === 'concluido') return false;
          let dt = String(d.dueDate || d.vencimento || d.data_vencimento || '').trim();
          if (dt.includes('/')) {
            const p = dt.split('/');
            if (p.length === 3) dt = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
          } else if (dt.includes('T')) {
            dt = dt.split('T')[0];
          }
          return dt !== '' && dt < todayIso;
        }).length;

        pagarHoje = despesas.filter((d: any) => {
          const st = String(d.status || '').toLowerCase();
          if (st === 'pago' || st === 'concluido') return false;
          let dt = String(d.dueDate || d.vencimento || d.data_vencimento || '').trim();
          if (dt.includes('/')) {
            const p = dt.split('/');
            if (p.length === 3) dt = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
          } else if (dt.includes('T')) {
            dt = dt.split('T')[0];
          }
          return dt === todayIso;
        }).length;
      }
    }
  } catch {}

  // 3. CLIENTES
  let clientesAusentes = 0;
  let clientesBloqueados = 0;
  let clientesAniversariantes = 0;
  try {
    const rawCli = localStorage.getItem('agrocontrol_clientes') ||
                   localStorage.getItem('colaca_silagem_clientes') ||
                   localStorage.getItem('silagem_facil_clean_v1_clients');
    if (rawCli) {
      const clientes = JSON.parse(rawCli);
      if (Array.isArray(clientes)) {
        const todayMonthDay = todayIso.slice(5);
        clientes.forEach((c: any) => {
          const st = String(c.status || '').toLowerCase();
          if (st === 'ausente' || st === 'inativo') clientesAusentes++;
          if (st === 'bloqueado' || c.isBlocked || c.bloqueado) clientesBloqueados++;

          let bDate = String(c.birthDate || c.dataNascimento || c.data_nascimento || '').trim();
          if (bDate.includes('/')) {
            const p = bDate.split('/');
            if (p.length >= 2) bDate = `${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
          } else if (bDate.includes('-')) {
            bDate = bDate.slice(5, 10);
          }
          if (bDate && bDate === todayMonthDay) clientesAniversariantes++;
        });
      }
    }
  } catch {}

  // 4. PRODUTOS (ESTOQUE BAIXO)
  // Diretriz do Contrato Master: Deve ler a chave 'agrocontrol_produtos' e contar reativamente apenas os itens onde
  // (QUANTIDADE_ATUAL <= QUANTIDADE_MINIMA). Se as quantidades estão zeradas e não há mínimo configurado, exibe obrigatoriamente "0".
  let prodsList: any[] = [];
  try {
    const rawProds = localStorage.getItem('agrocontrol_produtos') ||
                    localStorage.getItem('colaca_silagem_estoque_produtos') ||
                    localStorage.getItem('silagem_facil_clean_v1_inventory');
    if (rawProds) {
      const parsed = JSON.parse(rawProds);
      if (Array.isArray(parsed)) prodsList = parsed;
    }
  } catch {}

  const produtosEstoqueBaixo = prodsList.filter((item: any) => {
    const min = Number(item.QUANTIDADE_MINIMA ?? item.minQuantity ?? item.quantidade_minima ?? item.estoque_minimo ?? 0);
    // Se não há mínimo configurado (min <= 0), NUNCA considera como estoque baixo
    if (min <= 0) return false;
    const current = Number(item.QUANTIDADE_ATUAL ?? item.quantity ?? item.quantidade_atual ?? item.quantidade ?? 0);
    return current <= min;
  }).length;

  const produtosVencendoHoje = prodsList.filter((item: any) => {
    let dt = String(item.data_validade || item.validade || item.expirationDate || '').trim();
    if (dt.includes('/')) {
      const p = dt.split('/');
      if (p.length === 3) dt = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    } else if (dt.includes('T')) {
      dt = dt.split('T')[0];
    }
    return dt === todayIso;
  }).length;

  // 5. OUTROS (PRODUTOS SEM VENDAS, ENTREGAS, COBRANÇAS PREVISTAS)
  // Cruzamento do array de produtos com o de vendas para PRODUTOS SEM VENDAS
  let vendasList: any[] = [];
  try {
    const rawVendas = localStorage.getItem('agrocontrol_vendas') ||
                      localStorage.getItem('agrocontrol_pdv_vendas') ||
                      localStorage.getItem('colaca_silagem_vendas_pdv');
    if (rawVendas) {
      const parsed = JSON.parse(rawVendas);
      if (Array.isArray(parsed)) vendasList = parsed;
    }
  } catch {}

  try {
    const rawOrders = localStorage.getItem('agrocontrol_pedidos') || localStorage.getItem('silagem_facil_clean_v1_orders');
    if (rawOrders) {
      const parsed = JSON.parse(rawOrders);
      if (Array.isArray(parsed)) vendasList = [...vendasList, ...parsed];
    }
  } catch {}

  const soldProductKeys = new Set<string>();
  vendasList.forEach((v: any) => {
    const items = Array.isArray(v.itens) ? v.itens : Array.isArray(v.items) ? v.items : Array.isArray(v.carrinho) ? v.carrinho : [];
    items.forEach((it: any) => {
      if (it.id) soldProductKeys.add(String(it.id).trim().toLowerCase());
      if (it.productId) soldProductKeys.add(String(it.productId).trim().toLowerCase());
      if (it.codigo) soldProductKeys.add(String(it.codigo).trim().toLowerCase());
      if (it.code) soldProductKeys.add(String(it.code).trim().toLowerCase());
      if (it.descricao) soldProductKeys.add(String(it.descricao).trim().toLowerCase());
      if (it.name) soldProductKeys.add(String(it.name).trim().toLowerCase());
      if (it.nome) soldProductKeys.add(String(it.nome).trim().toLowerCase());
    });
    if (v.productType) soldProductKeys.add(String(v.productType).trim().toLowerCase());
    if (v.product_name) soldProductKeys.add(String(v.product_name).trim().toLowerCase());
  });

  const outrosSemVendas = prodsList.length === 0 ? 0 : prodsList.filter((p: any) => {
    const pId = p.id ? String(p.id).trim().toLowerCase() : '';
    const pCode = (p.code || p.codigo || p.codigo_produto) ? String(p.code || p.codigo || p.codigo_produto).trim().toLowerCase() : '';
    const pName = (p.name || p.nome_comercial || p.item || p.descricao) ? String(p.name || p.nome_comercial || p.item || p.descricao).trim().toLowerCase() : '';

    const hasSold = 
      (pId && soldProductKeys.has(pId)) ||
      (pCode && soldProductKeys.has(pCode)) ||
      (pName && soldProductKeys.has(pName));

    return !hasSold;
  }).length;

  const outrosEntregas = vendasList.filter((v: any) => {
    let dt = String(v.deliveryDate || v.dataEntrega || v.data_entrega || '').trim();
    if (dt.includes('/')) {
      const p = dt.split('/');
      if (p.length === 3) dt = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    } else if (dt.includes('T')) {
      dt = dt.split('T')[0];
    }
    const st = String(v.status || '').toLowerCase();
    return dt === todayIso || st === 'em_entrega';
  }).length;

  const outrosCobrancasPrevistas = itensReceber
    .filter((item: any) => {
      const status = String(item.status || item.STATUS || item.paymentStatus || '').trim().toUpperCase();
      return status === 'PENDENTE' || status === 'EM_ANDAMENTO' || status === 'AGENDADO';
    })
    .reduce((acc: number, item: any) => {
      const val = Number(item.totalAmount ?? item.totalLiquido ?? item.valor ?? item.amount ?? item.valorLiquido ?? 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

  return {
    receberVencidos,
    receberHoje,
    receberCheques,
    pagarVencidos,
    pagarHoje,
    pagarCheques: 0,
    clientesAusentes,
    clientesBloqueados,
    clientesAniversariantes,
    produtosEstoqueBaixo,
    produtosVencendoHoje,
    produtosCicloVida: 0,
    outrosEntregas,
    outrosSemVendas,
    outrosCobrancasPrevistas,
    monitorFiscalStatus: 'ATIVO'
  };
}

export const AgroControlHome: React.FC<AgroControlHomeProps> = ({
  onNavigate,
  companyProfile,
}) => {
  const [imgError, setImgError] = useState(false);
  const [clientLogoError, setClientLogoError] = useState(false);

  // Leitura reativa e dinâmica dos indicadores do painel comercial diretamente do LocalStorage
  const [indicators, setIndicators] = useState<IndicatorValues>(() => calculateRealIndicators());

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        setIndicators(calculateRealIndicators());
      } catch (e) {
        console.error('Erro ao recalcular indicadores:', e);
      }
    };

    // Recalcula imediatamente na montagem para garantir sincronismo
    handleStorageChange();

    const events = [
      'storage',
      'agrocontrol_indicators_updated',
      'agrocontrol_produtos_updated',
      'colaca_silagem_estoque_produtos_updated',
      'inventory_updated',
      'silagem_inventory_updated',
      'agrocontrol_contas_receber_updated',
      'agrocontrol_financeiro_receber_updated',
      'agrocontrol_receber_updated',
      'financeiro_receber_updated',
      'agrocontrol_vendas_updated',
      'agrocontrol_vendas_change',
      'vendas_updated',
      'agrocontrol_clientes_updated',
      'colaca_silagem_clientes_updated',
      'expenses_updated',
      'agrocontrol_despesas_updated'
    ];

    events.forEach((ev) => window.addEventListener(ev, handleStorageChange));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleStorageChange));
    };
  }, []);

  // Formatação comercial padrão PT-BR: R$ #.##0,00
  const formattedCobrancasPrevistas = useMemo(() => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(indicators.outrosCobrancasPrevistas || 0);
  }, [indicators.outrosCobrancasPrevistas]);

  return (
    <div 
      id="agrocontrol-home-root"
      className="flex flex-col h-full justify-between p-4 overflow-hidden select-none bg-[#edf4ff] dark:bg-gradient-to-b dark:from-stone-900 dark:via-stone-900 dark:to-stone-950"
    >
      
      {/* =========================================================================
          FAIXA 1: TOPO NOBRE (OCUPAR 40% DA ALTURA DA PÁGINA)
          Centralização absoluta do escudo/logotipo oficial do assinante (COLAÇA SILAGEM)
          ampliado em escala máxima (w-[580px] max-w-[95vw] h-auto) para preenchimento
          completo dos 40% do topo da tela, sem poluição de textos
         ========================================================================= */}
      <div className="h-[40%] flex items-center justify-center text-center shrink-0 w-full max-w-6xl mx-auto px-4 overflow-hidden">
        {companyProfile?.logoUrl && !clientLogoError ? (
          <div className="w-full h-full flex items-center justify-center py-1 px-2">
            <img 
              src={companyProfile.logoUrl} 
              alt="COLAÇA SILAGEM"
              className="w-[580px] max-w-[95vw] h-auto max-h-[96%] object-contain mb-2 sm:mb-3 mx-auto block drop-shadow-md select-none transition-transform hover:scale-[1.01] duration-150"
              referrerPolicy="no-referrer"
              onError={() => setClientLogoError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center py-1 px-2">
            <ColacaSilagemEmblem className="w-[580px] max-w-[95vw] h-auto max-h-[96%] mb-2 sm:mb-3 mx-auto block drop-shadow-md transition-transform hover:scale-[1.01] duration-150" />
          </div>
        )}
      </div>

      {/* =========================================================================
          FAIXA 2: MIOLO CENTRAL (GRADE DE CARDS AZUIS SLIM & HARMONIOSA)
          Grade contínua horizontal contendo os 5 blocos de cards azuis de 
          monitoramento comercial ('CONTAS A RECEBER', 'CONTAS A PAGAR', 'CLIENTES', 
          'PRODUTOS', 'OUTROS') em escala slim elegante e compacta
         ========================================================================= */}
      <div className="w-full max-w-7xl mx-auto shrink-0 my-auto py-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          
          {/* SEÇÃO 1: CONTAS A RECEBER */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('financeiro')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <TrendingUp className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CONTAS A RECEBER</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉBITOS VENCIDOS
                </span>
                <span className={`${indicators.receberVencidos > 0 ? 'bg-rose-600 text-white font-black' : 'bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold'} text-[11px] px-2 py-0.5 rounded shadow-2xs min-w-[22px] text-center shrink-0`}>
                  {indicators.receberVencidos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉB. VENCENDO HOJE
                </span>
                <span className={`${indicators.receberHoje > 0 ? 'bg-amber-500 text-white font-black' : 'bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold'} text-[11px] px-2 py-0.5 rounded shadow-2xs min-w-[22px] text-center shrink-0`}>
                  {indicators.receberHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CHEQUES VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.receberCheques}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 2: CONTAS A PAGAR */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('financeiro')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Wallet className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CONTAS A PAGAR</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉBITOS VENCIDOS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.pagarVencidos}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  DÉB. VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.pagarHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CHEQUES VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.pagarCheques}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 3: CLIENTES */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('clientes')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Users className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">CLIENTES</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CLIENTES AUSENTES
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.clientesAusentes}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  CLIENTES BLOQUEADOS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.clientesBloqueados}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('clientes')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ANIVERSARIANTES
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.clientesAniversariantes}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 4: PRODUTOS */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('almoxarifado')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Package className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">PRODUTOS</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ESTOQUE BAIXO
                </span>
                <span className={`${indicators.produtosEstoqueBaixo > 0 ? 'bg-amber-500 text-white font-black' : 'bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold'} text-[11px] px-2 py-0.5 rounded shadow-2xs min-w-[22px] text-center shrink-0`}>
                  {indicators.produtosEstoqueBaixo}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  PROD. VENCENDO HOJE
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.produtosVencendoHoje}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  SUG. DE CICLO DE VIDA
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.produtosCicloVida}
                </span>
              </button>
            </div>
          </div>

          {/* SEÇÃO 5: OUTROS */}
          <div className="flex flex-col h-full rounded-md shadow-xs overflow-hidden border border-blue-400/80 dark:border-blue-900 bg-white/95 dark:bg-stone-850/95 sm:col-span-2 lg:col-span-1">
            {/* Cabeçalho da Seção */}
            <div 
              onClick={() => onNavigate('fiscal')}
              className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wide py-1.5 px-3 flex items-center justify-between border-b border-blue-900 cursor-pointer transition select-none shadow-2xs shrink-0"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <Layers className="w-3.5 h-3.5 text-blue-200 shrink-0" />
                <span className="truncate">OUTROS</span>
              </div>
              <ChevronRight className="w-3 h-3 text-blue-200 shrink-0" />
            </div>

            {/* Itens Internos com Escala Slim Equilibrada */}
            <div className="flex flex-col justify-between p-2 sm:p-2.5 h-full flex-1 gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate('servicos')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  ENTREGAS
                </span>
                <span className="bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold text-[11px] px-2 py-0.5 rounded min-w-[22px] text-center shrink-0">
                  {indicators.outrosEntregas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('almoxarifado')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  PRODUTOS SEM VENDAS
                </span>
                <span className={`${indicators.outrosSemVendas > 0 ? 'bg-blue-600 text-white font-black' : 'bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-bold'} text-[11px] px-2 py-0.5 rounded shadow-2xs min-w-[22px] text-center shrink-0`}>
                  {indicators.outrosSemVendas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('financeiro')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-stone-700 hover:border-blue-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase truncate">
                  COBRANÇAS PREVISTAS
                </span>
                <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-black text-[10px] px-2 py-0.5 rounded border border-blue-300 dark:border-blue-800 shrink-0">
                  {formattedCobrancasPrevistas}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('fiscal')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-emerald-50/80 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-300 transition cursor-pointer text-left active:scale-98"
              >
                <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase truncate flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  MONITOR FISCAL
                </span>
                <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow-2xs shrink-0 tracking-wider">
                  {indicators.monitorFiscalStatus}
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          FAIXA 3: BASE DA TELA (BLOCO DA MARCA AGROCONTROL OFICIAL 100% CENTRALIZADO)
          Fluxo vertical perfeitamente centralizado: Imagem oficial da ensiladeira 
          com saco de moedas acima, seguida de 'AgroControl' e 'GESTÃO DE SILAGEM E MÁQUINAS'
         ========================================================================= */}
      <div className="flex flex-col items-center justify-center text-center mt-auto pb-2 w-full select-none">
        <div 
          className="flex flex-col items-center justify-center text-center cursor-pointer transition-transform hover:scale-[1.01] duration-150"
          onClick={() => onNavigate('dashboard')}
          title="Visão Executiva do AgroControl"
        >
          {/* 1. Imagem Oficial Fiel: Ensiladeira com Saco de Moedas (Print 2) */}
          <div className="shrink-0 mb-1">
            {!imgError ? (
              <img 
                src="/src/assets/images/ensiladeira_moedas_1791492311961.jpg"
                alt="AgroControl - Ensiladeira com Moedas de Ouro"
                className="w-44 h-auto mx-auto block object-contain mix-blend-multiply drop-shadow-sm transition-all"
                style={{ mixBlendMode: 'multiply' }}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <EnsiladeiraVector size="lg" className="w-44 h-auto drop-shadow-sm mx-auto block" />
            )}
          </div>

          {/* 2. Alinhamento do Nome Comercial: AgroControl (CamelCase exata) */}
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-tight [text-shadow:_0_1px_0_rgba(255,255,255,0.9)] dark:[text-shadow:_0_1px_0_rgba(255,255,255,0.05)]">
            AgroControl
          </h2>

          {/* 3. Alinhamento da Descrição de Especialidade 100% Caixa Alta */}
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tracking-widest uppercase mt-0.5 leading-tight">
            GESTÃO DE SILAGEM E MÁQUINAS
          </p>
        </div>
      </div>

    </div>
  );
};

export default AgroControlHome;
