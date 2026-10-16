import { formatCurrencyBRL, formatDateBR } from './formatters';

export interface MovimentacaoCaixa {
  id: string;
  dataHora: string;
  valor: number;
  motivo: string;
  destino?: string;
  tipo: 'SUPRIMENTO' | 'SANGRIA';
}

export interface VendaPdvCaixa {
  id: string;
  numeroPedido: string;
  cliente: string;
  valor: number;
  formaPagamento: string;
  dataHora: string;
}

export interface CaixaOperacional {
  id: string;
  status: 'ABERTO' | 'FECHADO';
  dataAbertura: string;
  dataHoraAbertura?: string;
  valorAbertura: number;
  suprimentos: MovimentacaoCaixa[];
  sangrias: MovimentacaoCaixa[];
  vendasPdv?: VendaPdvCaixa[];
  valorFechamentoReal: number;
  valorFechamentoSistema?: number;
  diferenca?: number;
  dataFechamento?: string;
  dataHoraFechamento?: string;
  observacoes?: string;
  operador?: string;
  operadorAbertura?: string;
  operadorFechamento?: string;
}

const CAIXA_OPERACIONAL_KEY = 'agrocontrol_caixa_operacional';
const HISTORICO_CAIXAS_KEY = 'agrocontrol_historico_caixas';

export function getOperadorLogadoNome(): string {
  try {
    const rawSession = localStorage.getItem('colaca_silagem_active_session') || localStorage.getItem('agrocontrol_active_session');
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed) {
        if (parsed.type === 'admin') return 'ADMINISTRADOR GERAL';
        if (parsed.name) return String(parsed.name).trim().toUpperCase();
        if (parsed.cargoNome) return String(parsed.cargoNome).trim().toUpperCase();
      }
    }
    const rawCadastros = localStorage.getItem('colaca_silagem_cadastros_base_session');
    if (rawCadastros) {
      const parsed = JSON.parse(rawCadastros);
      if (parsed) {
        if (parsed.type === 'admin') return 'ADMINISTRADOR GERAL';
        if (parsed.name) return String(parsed.name).trim().toUpperCase();
      }
    }
    const rawRh = localStorage.getItem('agrocontrol_funcionarios');
    if (rawRh) {
      const parsed = JSON.parse(rawRh);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const ativo = parsed.find((f: any) => f.ativo || f.status === 'ativo');
        if (ativo?.nome) return String(ativo.nome).trim().toUpperCase();
      }
    }
  } catch (err) {
    console.warn('Erro ao obter operador logado:', err);
  }
  return 'ADMINISTRADOR GERAL';
}

export function getStoredCaixaOperacional(): CaixaOperacional {
  try {
    const raw = localStorage.getItem(CAIXA_OPERACIONAL_KEY);
    if (!raw) {
      const defaultClosed: CaixaOperacional = {
        id: '',
        status: 'FECHADO',
        dataAbertura: '',
        valorAbertura: 0,
        suprimentos: [],
        sangrias: [],
        vendasPdv: [],
        valorFechamentoReal: 0,
        operador: getOperadorLogadoNome(),
        operadorAbertura: getOperadorLogadoNome(),
        operadorFechamento: '',
      };
      return defaultClosed;
    }
    const parsed = JSON.parse(raw);
    const caixaObj: CaixaOperacional = {
      id: parsed.id || '',
      status: parsed.status === 'ABERTO' ? 'ABERTO' : 'FECHADO',
      dataAbertura: parsed.dataAbertura || '',
      dataHoraAbertura: parsed.dataHoraAbertura || '',
      valorAbertura: Number(parsed.valorAbertura || 0),
      suprimentos: Array.isArray(parsed.suprimentos) ? parsed.suprimentos : [],
      sangrias: Array.isArray(parsed.sangrias) ? parsed.sangrias : [],
      vendasPdv: Array.isArray(parsed.vendasPdv) ? parsed.vendasPdv : [],
      valorFechamentoReal: Number(parsed.valorFechamentoReal || 0),
      valorFechamentoSistema: parsed.valorFechamentoSistema ? Number(parsed.valorFechamentoSistema) : undefined,
      diferenca: parsed.diferenca !== undefined ? Number(parsed.diferenca) : undefined,
      dataFechamento: parsed.dataFechamento || '',
      dataHoraFechamento: parsed.dataHoraFechamento || '',
      observacoes: parsed.observacoes || '',
      operador: parsed.operador || parsed.operadorAbertura || getOperadorLogadoNome(),
      operadorAbertura: parsed.operadorAbertura || parsed.operador || getOperadorLogadoNome(),
      operadorFechamento: parsed.operadorFechamento || '',
    };
    return caixaObj;
  } catch (err) {
    console.error('Erro ao ler agrocontrol_caixa_operacional:', err);
    return {
      id: '',
      status: 'FECHADO',
      dataAbertura: '',
      valorAbertura: 0,
      suprimentos: [],
      sangrias: [],
      vendasPdv: [],
      valorFechamentoReal: 0,
      operador: getOperadorLogadoNome(),
      operadorAbertura: getOperadorLogadoNome(),
      operadorFechamento: '',
    };
  }
}

export function saveStoredCaixaOperacional(caixa: CaixaOperacional): void {
  try {
    localStorage.setItem(CAIXA_OPERACIONAL_KEY, JSON.stringify(caixa));
    window.dispatchEvent(new CustomEvent('agrocontrol_caixa_operacional_updated', { detail: caixa }));
  } catch (err) {
    console.error('Erro ao gravar agrocontrol_caixa_operacional:', err);
  }
}

export function getStoredHistoricoCaixas(): CaixaOperacional[] {
  try {
    const raw = localStorage.getItem(HISTORICO_CAIXAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Erro ao ler agrocontrol_historico_caixas:', err);
    return [];
  }
}

export function saveStoredHistoricoCaixas(historico: CaixaOperacional[]): void {
  try {
    localStorage.setItem(HISTORICO_CAIXAS_KEY, JSON.stringify(historico));
    window.dispatchEvent(new CustomEvent('agrocontrol_historico_caixas_updated', { detail: historico }));
  } catch (err) {
    console.error('Erro ao salvar agrocontrol_historico_caixas:', err);
  }
}

export function abrirCaixaOperacional(valorInicial: number, operador?: string): CaixaOperacional {
  const now = new Date();
  const dataFormatadaPtBr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataHoraAbertura = `${dataFormatadaPtBr} ${horaFormatada}`;
  const operadorFinal = (operador || getOperadorLogadoNome()).trim().toUpperCase();

  const novoCaixa: CaixaOperacional = {
    id: `CX-${now.getFullYear()}-${String(Date.now()).slice(-6)}`,
    status: 'ABERTO',
    dataAbertura: dataFormatadaPtBr,
    dataHoraAbertura,
    valorAbertura: Number(valorInicial || 0),
    suprimentos: [],
    sangrias: [],
    vendasPdv: [],
    valorFechamentoReal: 0,
    operador: operadorFinal,
    operadorAbertura: operadorFinal,
    operadorFechamento: '',
  };

  saveStoredCaixaOperacional(novoCaixa);
  return novoCaixa;
}

export function adicionarSuprimentoCaixa(valor: number, motivo: string): CaixaOperacional | null {
  const caixa = getStoredCaixaOperacional();
  if (caixa.status !== 'ABERTO') return null;

  const now = new Date();
  const dataFormatadaPtBr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const novoSuprimento: MovimentacaoCaixa = {
    id: `SUP-${Date.now()}`,
    dataHora: `${dataFormatadaPtBr} ${horaFormatada}`,
    valor: Number(valor || 0),
    motivo: (motivo || 'SUPRIMENTO DE TROCO').trim().toUpperCase(),
    tipo: 'SUPRIMENTO',
  };

  if (!Array.isArray(caixa.suprimentos)) {
    caixa.suprimentos = [];
  }
  caixa.suprimentos.unshift(novoSuprimento);
  saveStoredCaixaOperacional(caixa);
  return caixa;
}

export function adicionarSangriaCaixa(valor: number, motivo: string, destino?: string): CaixaOperacional | null {
  const caixa = getStoredCaixaOperacional();
  if (caixa.status !== 'ABERTO') return null;

  const now = new Date();
  const dataFormatadaPtBr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const novaSangria: MovimentacaoCaixa = {
    id: `SAN-${Date.now()}`,
    dataHora: `${dataFormatadaPtBr} ${horaFormatada}`,
    valor: Number(valor || 0),
    motivo: (motivo || 'SANGRIA / RETIRADA').trim().toUpperCase(),
    destino: destino ? destino.trim().toUpperCase() : undefined,
    tipo: 'SANGRIA',
  };

  if (!Array.isArray(caixa.sangrias)) {
    caixa.sangrias = [];
  }
  caixa.sangrias.unshift(novaSangria);
  saveStoredCaixaOperacional(caixa);
  return caixa;
}

export function registrarVendaNoCaixa(venda: {
  id: string;
  numeroPedido: string;
  cliente: string;
  valor: number;
  formaPagamento: string;
  dataHora?: string;
}): boolean {
  try {
    const caixa = getStoredCaixaOperacional();
    if (caixa.status !== 'ABERTO') return false;

    const now = new Date();
    const dataFormatadaPtBr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const itemVenda: VendaPdvCaixa = {
      id: venda.id,
      numeroPedido: venda.numeroPedido,
      cliente: (venda.cliente || 'CONSUMIDOR BALCÃO').toUpperCase(),
      valor: Number(venda.valor || 0),
      formaPagamento: (venda.formaPagamento || 'A VISTA').toUpperCase(),
      dataHora: venda.dataHora || `${dataFormatadaPtBr} ${horaFormatada}`,
    };

    if (!Array.isArray(caixa.vendasPdv)) {
      caixa.vendasPdv = [];
    }
    // Evita duplicidade de registro por id ou número de pedido
    const exists = caixa.vendasPdv.some(v => v.id === itemVenda.id || (v.numeroPedido && v.numeroPedido === itemVenda.numeroPedido));
    if (!exists) {
      caixa.vendasPdv.unshift(itemVenda);
      saveStoredCaixaOperacional(caixa);
    }
    return true;
  } catch (err) {
    console.warn('Erro ao registrar venda no caixa:', err);
    return false;
  }
}

export function syncCaixaComVendas(caixa: CaixaOperacional): CaixaOperacional {
  if (caixa.status !== 'ABERTO') return caixa;
  try {
    const rawVendas = localStorage.getItem('agrocontrol_vendas') || localStorage.getItem('agrocontrol_pdv_vendas');
    if (!rawVendas) return caixa;
    const vendas = JSON.parse(rawVendas);
    if (!Array.isArray(vendas)) return caixa;

    let alterado = false;
    const currentVendas = Array.isArray(caixa.vendasPdv) ? [...caixa.vendasPdv] : [];
    const currentIds = new Set(currentVendas.map(v => v.id));

    vendas.forEach((v: any) => {
      const vId = String(v.id || v.numeroPedido || v.orderNumber || '');
      if (!vId || currentIds.has(vId)) return;

      // Resolução correta da forma de pagamento
      let fp = String(v.formaPagamento || '').toUpperCase();
      if (!fp && v.tipoCobranca) {
        fp = `A PRAZO (${String(v.tipoCobranca).toUpperCase()})`;
      } else if (!fp) {
        fp = 'DINHEIRO';
      }

      currentVendas.unshift({
        id: vId,
        numeroPedido: String(v.numeroPedido || v.orderNumber || 'PED-001'),
        cliente: String(v.cliente || v.clientName || 'CONSUMIDOR BALCÃO').toUpperCase(),
        valor: Number(v.valorLiquido || v.totalLiquido || v.totalAmount || v.valor || 0),
        formaPagamento: fp,
        dataHora: v.hora ? `${v.data || v.data_formatada || ''} ${v.hora}` : (v.data || v.data_formatada || `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`),
      });
      currentIds.add(vId);
      alterado = true;
    });

    if (alterado) {
      caixa.vendasPdv = currentVendas;
      saveStoredCaixaOperacional(caixa);
    }
  } catch (e) {
    console.warn('Erro ao sincronizar vendas recentes com o caixa:', e);
  }
  return caixa;
}

export function calcularTotaisCaixa(caixa: CaixaOperacional) {
  const saldoInicial = Number(caixa.valorAbertura || 0);

  const vendas = Array.isArray(caixa.vendasPdv) ? caixa.vendasPdv : [];

  // 1. (+) VENDAS EM DINHEIRO (Alimenta estritamente o saldo físico esperado na gaveta)
  const vendasDinheiro = vendas
    .filter(v => {
      const fp = (v.formaPagamento || '').toUpperCase();
      const isDinheiro = fp.includes('DINHEIRO') || fp.includes('A VISTA') || fp.includes('À VISTA') || fp === 'ESPECIE' || fp === 'ESPÉCIE';
      const isOutro = fp.includes('PIX') || fp.includes('CART') || fp.includes('DÉB') || fp.includes('DEB') || fp.includes('CRÉD') || fp.includes('CRED') || fp.includes('PRAZO') || fp.includes('BOLETO') || fp.includes('CARTEIRA');
      return isDinheiro && !isOutro;
    })
    .reduce((acc, v) => acc + Number(v.valor || 0), 0);

  // 2. (+) VENDAS EM PIX
  const vendasPix = vendas
    .filter(v => (v.formaPagamento || '').toUpperCase().includes('PIX'))
    .reduce((acc, v) => acc + Number(v.valor || 0), 0);

  // 3. (+) VENDAS EM CARTÃO DE DÉBITO
  const vendasDebito = vendas
    .filter(v => {
      const fp = (v.formaPagamento || '').toUpperCase();
      return fp.includes('DÉBITO') || fp.includes('DEBITO');
    })
    .reduce((acc, v) => acc + Number(v.valor || 0), 0);

  // 4. (+) VENDAS EM CARTÃO DE CRÉDITO
  const vendasCredito = vendas
    .filter(v => {
      const fp = (v.formaPagamento || '').toUpperCase();
      return fp.includes('CRÉDITO') || fp.includes('CREDITO');
    })
    .reduce((acc, v) => acc + Number(v.valor || 0), 0);

  // 5. (+) VENDAS EM CARTEIRA / BOLETO
  const vendasCarteiraBoleto = vendas
    .filter(v => {
      const fp = (v.formaPagamento || '').toUpperCase();
      return fp.includes('CARTEIRA') || fp.includes('BOLETO') || fp.includes('PRAZO') || fp.includes('DUPLICATA') || fp.includes('CREDIARIO');
    })
    .reduce((acc, v) => acc + Number(v.valor || 0), 0);

  const totalVendasPdv = vendas.reduce((acc, v) => acc + Number(v.valor || 0), 0);
  const totalEletronicoMaquininha = vendasPix + vendasDebito + vendasCredito;

  const suprimentos = Array.isArray(caixa.suprimentos) ? caixa.suprimentos : [];
  const totalSuprimentos = suprimentos.reduce((acc, s) => acc + Number(s.valor || 0), 0);

  const sangrias = Array.isArray(caixa.sangrias) ? caixa.sangrias : [];
  const totalSangrias = sangrias.reduce((acc, s) => acc + Number(s.valor || 0), 0);

  // Saldo Esperado = Saldo Inicial (R$ 10,00) + Suprimentos + Vendas em Dinheiro - Sangrias
  const saldoAtualDinheiro = saldoInicial + vendasDinheiro + totalSuprimentos - totalSangrias;

  // Saldo total geral de todas as formas
  const saldoTotalGeral = saldoInicial + totalVendasPdv + totalSuprimentos - totalSangrias;

  return {
    saldoInicial,
    vendasDinheiro,
    vendasPix,
    vendasDebito,
    vendasCredito,
    vendasCarteiraBoleto,
    totalVendasPdv,
    totalEletronicoMaquininha,
    totalSuprimentos,
    totalSangrias,
    saldoAtualDinheiro,
    saldoTotalGeral,
  };
}

export function fecharCaixaOperacional(
  valorFechamentoReal: number,
  observacoes = '',
  operadorFechamento?: string
): { caixaFechado: CaixaOperacional; diferenca: number } | null {
  const caixa = getStoredCaixaOperacional();
  if (caixa.status !== 'ABERTO') return null;

  const now = new Date();
  const dataFormatadaPtBr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataHoraFechamento = `${dataFormatadaPtBr} ${horaFormatada}`;

  const opFechamento = (operadorFechamento || getOperadorLogadoNome()).trim().toUpperCase();

  const totais = calcularTotaisCaixa(caixa);
  const valorFechamentoSistema = totais.saldoAtualDinheiro;
  const diferenca = Number(valorFechamentoReal || 0) - valorFechamentoSistema;

  const caixaFechado: CaixaOperacional = {
    ...caixa,
    status: 'FECHADO',
    valorFechamentoReal: Number(valorFechamentoReal || 0),
    valorFechamentoSistema,
    diferenca,
    dataFechamento: dataFormatadaPtBr,
    dataHoraFechamento,
    observacoes: observacoes ? observacoes.trim().toUpperCase() : '',
    operador: opFechamento,
    operadorFechamento: opFechamento,
    operadorAbertura: caixa.operadorAbertura || caixa.operador || opFechamento,
  };

  // Salva no histórico de caixas
  const historico = getStoredHistoricoCaixas();
  historico.unshift(caixaFechado);
  saveStoredHistoricoCaixas(historico);

  // Atualiza caixa atual para fechado
  saveStoredCaixaOperacional(caixaFechado);

  return { caixaFechado, diferenca };
}

export function gerarHtmlRelatorioCaixa(
  caixa: CaixaOperacional,
  companyProfile?: any,
  formato: 'a4' | 'termica' = 'a4'
): string {
  const totais = calcularTotaisCaixa(caixa);
  const empresaNome = (companyProfile?.name || companyProfile?.razaoSocial || 'AGROCONTROL • SOLUÇÕES AGRÍCOLAS & FORRAGENS').toUpperCase();
  const empresaCnpj = companyProfile?.cnpjCpf || companyProfile?.cnpj || '';
  const empresaTel = companyProfile?.phone || companyProfile?.telefone || '';
  const empresaEndereco = companyProfile?.address || companyProfile?.endereco || '';

  const valorReal = Number(caixa.valorFechamentoReal || 0);
  const valorSistema = Number(caixa.valorFechamentoSistema ?? totais.saldoAtualDinheiro);
  const diferenca = Number(caixa.diferenca ?? (valorReal - valorSistema));

  const diferencaTexto = Math.abs(diferenca) < 0.005
    ? '✅ CAIXA CONFERIDO - SEM DIVERGÊNCIAS (R$ 0,00)'
    : diferenca > 0
      ? `🟢 SOBRA DE CAIXA: + ${formatCurrencyBRL(Math.abs(diferenca))}`
      : `🔴 QUEBRA DE CAIXA: - ${formatCurrencyBRL(Math.abs(diferenca))}`;

  const operadorAbertura = (caixa.operadorAbertura || caixa.operador || 'ADMINISTRADOR GERAL').toUpperCase();
  const operadorFechamento = (caixa.operadorFechamento || caixa.operador || 'ADMINISTRADOR GERAL').toUpperCase();

  const vendas = Array.isArray(caixa.vendasPdv) ? caixa.vendasPdv : [];
  const suprimentos = Array.isArray(caixa.suprimentos) ? caixa.suprimentos : [];
  const sangrias = Array.isArray(caixa.sangrias) ? caixa.sangrias : [];

  if (formato === 'termica') {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>FECHAMENTO DE CAIXA - ${caixa.id}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.25;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 4px;
      text-transform: uppercase;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
    .double-divider { border-bottom: 2px solid #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 4px 0; }
    th { border-bottom: 1px solid #000; text-align: left; padding: 2px 0; font-size: 9.5px; }
    td { padding: 2px 0; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .flex-between { display: flex; justify-content: space-between; margin: 2px 0; }
    .highlight { font-size: 11.5px; font-weight: bold; padding: 2px 0; }
    .no-print { margin-bottom: 8px; text-align: center; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" style="padding: 6px 16px; font-weight: bold; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 4px;">🖨️ IMPRIMIR COMPROVANTE</button>
  </div>

  <div class="text-center font-bold" style="font-size: 13px;">${empresaNome}</div>
  ${empresaCnpj ? `<div class="text-center" style="font-size: 10px;">CNPJ: ${empresaCnpj}</div>` : ''}
  ${empresaTel ? `<div class="text-center" style="font-size: 10px;">TEL: ${empresaTel}</div>` : ''}
  <div class="divider"></div>
  <div class="text-center font-bold" style="font-size: 12px;">RELATÓRIO DE FECHAMENTO DE CAIXA</div>
  <div class="text-center" style="font-size: 10px;">ID CAIXA: ${caixa.id}</div>
  <div class="divider"></div>

  <div class="flex-between"><span>ABERTURA:</span><span>${caixa.dataHoraAbertura || caixa.dataAbertura}</span></div>
  <div class="flex-between"><span>FECHAMENTO:</span><span>${caixa.dataHoraFechamento || caixa.dataFechamento || '-'}</span></div>
  <div class="flex-between"><span>OPERADOR ABERTURA:</span><span>${operadorAbertura}</span></div>
  <div class="flex-between"><span>OPERADOR FECHAMENTO:</span><span>${operadorFechamento}</span></div>
  <div class="flex-between"><span>STATUS:</span><span class="font-bold">${caixa.status}</span></div>

  <div class="double-divider"></div>
  <div class="font-bold" style="font-size: 11px;">CONCILIAÇÃO FÍSICA (GAVETA):</div>
  <div class="divider"></div>
  <div class="flex-between"><span>(+) SALDO INICIAL:</span><span>${formatCurrencyBRL(totais.saldoInicial)}</span></div>
  <div class="flex-between"><span>(+) SUPRIMENTOS:</span><span>${formatCurrencyBRL(totais.totalSuprimentos)}</span></div>
  <div class="flex-between"><span>(+) VENDAS EM DINHEIRO:</span><span>${formatCurrencyBRL(totais.vendasDinheiro)}</span></div>
  <div class="flex-between"><span>(-) SANGRIAS / RETIRADAS:</span><span>${formatCurrencyBRL(totais.totalSangrias)}</span></div>
  <div class="divider"></div>
  <div class="flex-between highlight"><span>(=) SALDO SISTEMA (ESPERADO):</span><span>${formatCurrencyBRL(valorSistema)}</span></div>
  <div class="flex-between highlight"><span>(=) VALOR FÍSICO CONTADO:</span><span>${formatCurrencyBRL(valorReal)}</span></div>
  <div class="flex-between font-bold" style="padding-top: 2px;"><span>SITUAÇÃO:</span><span>${diferencaTexto}</span></div>

  <div class="double-divider"></div>
  <div class="font-bold" style="font-size: 11px;">DISCRIMINAÇÃO POR FORMA DE PGTO:</div>
  <div class="divider"></div>
  <div class="flex-between"><span>(+) VENDAS EM DINHEIRO:</span><span>${formatCurrencyBRL(totais.vendasDinheiro)}</span></div>
  <div class="flex-between"><span>(+) VENDAS EM PIX:</span><span>${formatCurrencyBRL(totais.vendasPix)}</span></div>
  <div class="flex-between"><span>(+) VENDAS EM CARTÃO DÉBITO:</span><span>${formatCurrencyBRL(totais.vendasDebito)}</span></div>
  <div class="flex-between"><span>(+) VENDAS EM CARTÃO CRÉDITO:</span><span>${formatCurrencyBRL(totais.vendasCredito)}</span></div>
  <div class="flex-between"><span>(+) VENDAS CARTEIRA / BOLETO:</span><span>${formatCurrencyBRL(totais.vendasCarteiraBoleto)}</span></div>
  <div class="divider"></div>
  <div class="flex-between font-bold"><span>TOTAL GERAL VENDAS PDV:</span><span>${formatCurrencyBRL(totais.totalVendasPdv)}</span></div>
  <div class="flex-between" style="font-size: 10px; color: #444;"><span>CONFERÊNCIA MAQUININHA (CARTÕES/PIX):</span><span>${formatCurrencyBRL(totais.totalEletronicoMaquininha)}</span></div>

  ${caixa.observacoes ? `
    <div class="divider"></div>
    <div class="font-bold" style="font-size: 10px;">OBSERVAÇÕES:</div>
    <div style="font-size: 9.5px; word-break: break-word;">${caixa.observacoes}</div>
  ` : ''}

  <div class="double-divider"></div>
  <div class="font-bold" style="font-size: 10.5px;">VENDAS BALCÃO REALIZADAS (${vendas.length}):</div>
  ${vendas.length === 0 ? '<div style="font-size: 9.5px; color: #666;">NENHUMA VENDA REGISTRADA</div>' : `
    <table>
      <thead>
        <tr><th>HORA</th><th>PEDIDO</th><th>FORMA</th><th class="text-right">VALOR</th></tr>
      </thead>
      <tbody>
        ${vendas.map(v => `
          <tr>
            <td>${v.dataHora.split(' ')[1] || v.dataHora}</td>
            <td>${v.numeroPedido}</td>
            <td>${v.formaPagamento}</td>
            <td class="text-right font-bold">${formatCurrencyBRL(v.valor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `}

  <div class="divider"></div>
  <div class="font-bold" style="font-size: 10.5px;">SUPRIMENTOS (${suprimentos.length}):</div>
  ${suprimentos.length === 0 ? '<div style="font-size: 9.5px; color: #666;">SEM SUPRIMENTOS</div>' : `
    <table>
      <thead>
        <tr><th>HORA</th><th>MOTIVO</th><th class="text-right">VALOR</th></tr>
      </thead>
      <tbody>
        ${suprimentos.map(s => `
          <tr>
            <td>${s.dataHora.split(' ')[1] || s.dataHora}</td>
            <td>${s.motivo}</td>
            <td class="text-right font-bold">${formatCurrencyBRL(s.valor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `}

  <div class="divider"></div>
  <div class="font-bold" style="font-size: 10.5px;">SANGRIAS / RETIRADAS (${sangrias.length}):</div>
  ${sangrias.length === 0 ? '<div style="font-size: 9.5px; color: #666;">SEM SANGRIAS</div>' : `
    <table>
      <thead>
        <tr><th>HORA</th><th>MOTIVO</th><th class="text-right">VALOR</th></tr>
      </thead>
      <tbody>
        ${sangrias.map(s => `
          <tr>
            <td>${s.dataHora.split(' ')[1] || s.dataHora}</td>
            <td>${s.motivo}${s.destino ? ` (${s.destino})` : ''}</td>
            <td class="text-right font-bold">${formatCurrencyBRL(s.valor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `}

  <div class="double-divider" style="margin-top: 18px;"></div>
  <div class="text-center" style="margin-top: 14px; font-size: 10px;">
    __________________________________________<br>
    OPERADOR: ${operadorFechamento}
  </div>
  <div class="text-center" style="margin-top: 18px; font-size: 10px;">
    __________________________________________<br>
    SUPERVISÃO / GERÊNCIA FINANCEIRA
  </div>
  <div class="divider"></div>
  <div class="text-center" style="font-size: 9px; color: #666;">AGROCONTROL SISTEMAS • EMITIDO EM ${new Date().toLocaleString('pt-BR')}</div>
</body>
</html>`;
  }

  // FOLHA A4 RETRATO
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Fechamento de Caixa - ${caixa.id}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 10.5px;
      color: #0f172a;
      background: #fff;
      margin: 0;
      padding: 0;
      text-transform: uppercase;
    }
    .no-print {
      background: #f1f5f9;
      padding: 8px 12px;
      margin-bottom: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn {
      padding: 6px 16px;
      font-weight: bold;
      cursor: pointer;
      background: #0f172a;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 11px;
    }
    .header-box {
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      background: #f8fafc;
    }
    .title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin-bottom: 3px;
    }
    .sub {
      font-size: 9.5px;
      color: #475569;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 9.5px;
      background: #0f172a;
      color: #fff;
    }
    .grid-info {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    .card-info {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 8px;
      background: #fff;
    }
    .card-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 2px;
    }
    .card-val {
      font-size: 11.5px;
      font-weight: 900;
      color: #0f172a;
    }
    .grid-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .card-metric {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
      background: #f8fafc;
    }
    .metric-title { font-size: 9.5px; font-weight: 800; color: #475569; margin-bottom: 3px; }
    .metric-value { font-size: 14.5px; font-weight: 900; }
    .section-title {
      font-size: 11px;
      font-weight: 900;
      background: #0f172a;
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      margin: 10px 0 4px 0;
      display: flex;
      justify-content: space-between;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 8px;
    }
    th {
      background: #e2e8f0;
      color: #334155;
      font-weight: 800;
      text-align: left;
      padding: 3px 6px;
      border: 1px solid #cbd5e1;
    }
    td {
      padding: 3px 6px;
      border: 1px solid #cbd5e1;
    }
    tr:nth-child(even) { background-color: #f8fafc; }
    .text-right { text-align: right; }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
      page-break-inside: avoid;
    }
    .sign-col {
      width: 45%;
      text-align: center;
      border-top: 1.5px solid #0f172a;
      padding-top: 5px;
      font-size: 9.5px;
      font-weight: 700;
    }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div><strong>RELATÓRIO CONSOLIDADO DE FECHAMENTO DE CAIXA (A4 RETRATO)</strong></div>
    <button class="btn" onclick="window.print()">🖨️ IMPRIMIR RELATÓRIO A4</button>
  </div>

  <div class="header-box">
    <div>
      <div class="title">${empresaNome}</div>
      <div class="sub">
        ${empresaCnpj ? `CNPJ/CPF: ${empresaCnpj} • ` : ''}
        ${empresaTel ? `TEL: ${empresaTel} • ` : ''}
        ${empresaEndereco ? `${empresaEndereco}` : ''}
      </div>
    </div>
    <div style="text-align: right;">
      <span class="badge">STATUS: ${caixa.status}</span>
      <div style="font-size: 9.5px; font-weight: 800; margin-top: 3px;">CAIXA: ${caixa.id}</div>
    </div>
  </div>

  <div class="grid-info">
    <div class="card-info">
      <div class="card-label">DATA DE ABERTURA</div>
      <div class="card-val">${caixa.dataHoraAbertura || caixa.dataAbertura}</div>
    </div>
    <div class="card-info">
      <div class="card-label">DATA DE FECHAMENTO</div>
      <div class="card-val">${caixa.dataHoraFechamento || caixa.dataFechamento || '-'}</div>
    </div>
    <div class="card-info">
      <div class="card-label">OPERADOR RESPONSÁVEL</div>
      <div class="card-val">${operadorFechamento}</div>
    </div>
    <div class="card-info">
      <div class="card-label">SITUAÇÃO DO FECHAMENTO</div>
      <div class="card-val" style="font-size: 10px;">${diferencaTexto}</div>
    </div>
  </div>

  <div class="grid-summary">
    <div class="card-metric" style="border-left: 4px solid #3b82f6;">
      <div class="metric-title">(+) SALDO INICIAL / TROCO</div>
      <div class="metric-value" style="color: #1d4ed8;">${formatCurrencyBRL(totais.saldoInicial)}</div>
    </div>
    <div class="card-metric" style="border-left: 4px solid #10b981;">
      <div class="metric-title">(+) VENDAS PDV (DINHEIRO)</div>
      <div class="metric-value" style="color: #047857;">${formatCurrencyBRL(totais.vendasDinheiro)}</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">+ PIX: ${formatCurrencyBRL(totais.vendasPix)}</div>
    </div>
    <div class="card-metric" style="border-left: 4px solid #06b6d4;">
      <div class="metric-title">(+) SUPRIMENTOS DE CAIXA</div>
      <div class="metric-value" style="color: #0e7490;">${formatCurrencyBRL(totais.totalSuprimentos)}</div>
    </div>
    <div class="card-metric" style="border-left: 4px solid #ef4444;">
      <div class="metric-title">(-) SANGRIAS DE CAIXA</div>
      <div class="metric-value" style="color: #b91c1c;">${formatCurrencyBRL(totais.totalSangrias)}</div>
    </div>
    <div class="card-metric" style="border-left: 4px solid #6366f1;">
      <div class="metric-title">(=) SALDO SISTEMA (ESPERADO)</div>
      <div class="metric-value" style="color: #4338ca;">${formatCurrencyBRL(valorSistema)}</div>
    </div>
    <div class="card-metric" style="border-left: 4px solid #f59e0b;">
      <div class="metric-title">(=) VALOR FÍSICO (APURADO)</div>
      <div class="metric-value" style="color: #b45309;">${formatCurrencyBRL(valorReal)}</div>
    </div>
  </div>

  <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px;">
    <div style="font-weight: 800; font-size: 9.5px; color: #334155; margin-bottom: 4px;">DISCRIMINAÇÃO COMPLETA DAS VENDAS POR FORMA DE PAGAMENTO:</div>
    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; font-size: 9px;">
      <div><span style="color: #64748b;">DINHEIRO:</span> <strong>${formatCurrencyBRL(totais.vendasDinheiro)}</strong></div>
      <div><span style="color: #64748b;">PIX:</span> <strong>${formatCurrencyBRL(totais.vendasPix)}</strong></div>
      <div><span style="color: #64748b;">CARTÃO DÉBITO:</span> <strong>${formatCurrencyBRL(totais.vendasDebito)}</strong></div>
      <div><span style="color: #64748b;">CARTÃO CRÉDITO:</span> <strong>${formatCurrencyBRL(totais.vendasCredito)}</strong></div>
      <div><span style="color: #64748b;">CARTEIRA / BOLETO:</span> <strong>${formatCurrencyBRL(totais.vendasCarteiraBoleto)}</strong></div>
    </div>
    <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 9px; font-weight: bold;">
      <span>TOTAL GERAL VENDAS: ${formatCurrencyBRL(totais.totalVendasPdv)}</span>
      <span style="color: #047857;">TOTAL MAQUININHA (CARTÕES + PIX): ${formatCurrencyBRL(totais.totalEletronicoMaquininha)}</span>
    </div>
  </div>

  ${caixa.observacoes ? `
    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; background: #fff;">
      <strong style="font-size: 9.5px; color: #475569;">OBSERVAÇÕES DO FECHAMENTO:</strong>
      <div style="font-size: 9.5px; margin-top: 2px;">${caixa.observacoes}</div>
    </div>
  ` : ''}

  <div class="section-title">
    <span>1. VENDAS REALIZADAS NO PDV BALCÃO (${vendas.length})</span>
    <span>TOTAL: ${formatCurrencyBRL(totais.totalVendasPdv)}</span>
  </div>
  ${vendas.length === 0 ? '<div style="padding: 4px; color: #64748b; font-size: 9.5px;">NENHUMA VENDA REGISTRADA NESTE CICLO.</div>' : `
    <table>
      <thead>
        <tr>
          <th style="width: 15%;">DATA / HORA</th>
          <th style="width: 18%;">PEDIDO</th>
          <th style="width: 35%;">CLIENTE</th>
          <th style="width: 17%;">FORMA PGTO</th>
          <th style="width: 15%;" class="text-right">VALOR</th>
        </tr>
      </thead>
      <tbody>
        ${vendas.map(v => `
          <tr>
            <td>${v.dataHora}</td>
            <td style="font-weight: 800;">${v.numeroPedido}</td>
            <td>${v.cliente}</td>
            <td>${v.formaPagamento}</td>
            <td class="text-right" style="font-weight: 900;">${formatCurrencyBRL(v.valor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `}

  <div class="section-title">
    <span>2. SUPRIMENTOS EFETUADOS (${suprimentos.length})</span>
    <span>TOTAL: ${formatCurrencyBRL(totais.totalSuprimentos)}</span>
  </div>
  ${suprimentos.length === 0 ? '<div style="padding: 4px; color: #64748b; font-size: 9.5px;">NENHUM SUPRIMENTO REGISTRADO.</div>' : `
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">DATA / HORA</th>
          <th style="width: 55%;">MOTIVO / JUSTIFICATIVA</th>
          <th style="width: 20%;" class="text-right">VALOR</th>
        </tr>
      </thead>
      <tbody>
        ${suprimentos.map(s => `
          <tr>
            <td>${s.dataHora}</td>
            <td>${s.motivo}</td>
            <td class="text-right" style="font-weight: 900; color: #047857;">${formatCurrencyBRL(s.valor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `}

  <div class="section-title">
    <span>3. SANGRIAS E RETIRADAS EFETUADAS</span>
    <span>TOTAL: ${formatCurrencyBRL(totais.totalSangrias)}</span>
  </div>
  ${sangrias.length === 0 ? '<div style="padding: 6px; color: #64748b; font-size: 10px;">NENHUMA SANGRIA REGISTRADA.</div>' : `
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">DATA / HORA</th>
          <th style="width: 55%;">MOTIVO / DESTINO</th>
          <th style="width: 20%;" class="text-right">VALOR</th>
        </tr>
      </thead>
      <tbody>
        ${sangrias.map(s => `
          <tr>
            <td>${s.dataHora}</td>
            <td>${s.motivo}${s.destino ? ` [DESTINO: ${s.destino}]` : ''}</td>
            <td class="text-right" style="font-weight: 900; color: #b91c1c;">${formatCurrencyBRL(s.valor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `}

  <div class="signatures">
    <div class="sign-col">
      <div>${caixa.operador || 'OPERADOR DO CAIXA'}</div>
      <div style="font-size: 8.5px; color: #64748b; font-weight: normal; margin-top: 2px;">RESPONSÁVEL PELA APURAÇÃO</div>
    </div>
    <div class="sign-col">
      <div>SUPERVISOR / GERÊNCIA FINANCEIRA</div>
      <div style="font-size: 8.5px; color: #64748b; font-weight: normal; margin-top: 2px;">VISTO E CONCILIAÇÃO FINAL</div>
    </div>
  </div>

  <div style="margin-top: 25px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
    AGROCONTROL GESTÃO INTEGRADA • RELATÓRIO OFICIAL GERADO EM ${new Date().toLocaleString('pt-BR')}
  </div>
</body>
</html>`;
}

export function dispararImpressaoRelatorioCaixa(
  caixa: CaixaOperacional,
  companyProfile?: any,
  formato: 'a4' | 'termica' = 'a4'
) {
  try {
    const html = gerarHtmlRelatorioCaixa(caixa, companyProfile, formato);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para abrir o relatório de fechamento de caixa.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.warn('Erro ao disparar print na nova janela:', e);
      }
    }, 450);
  } catch (err) {
    console.error('Erro ao emitir relatório de caixa:', err);
  }
}
