import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Trash2, 
  Printer, 
  Check, 
  X, 
  DollarSign, 
  CreditCard, 
  QrCode, 
  Calendar, 
  Barcode, 
  Receipt, 
  Percent, 
  ArrowRight,
  Package,
  User,
  AlertCircle,
  Clock,
  ChevronDown,
  FileCheck2,
  Tractor,
  Key,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Download,
  Copy,
  FileText,
  CheckCheck,
  Truck,
  Settings
} from 'lucide-react';
import { Client, CompanyProfile, ServiceOrder, InventoryItem, Machinery } from '../../types';
import { formatCurrencyBRL, formatDateBR, getStoredInventory, saveStoredInventory, getActiveCompanyId, getStoredClients, getStoredMachineries, STORAGE_KEYS } from '../../lib/storage';
import { registrarVendaNoCaixa } from '../../lib/caixaStorage';
import { getActiveUserSession, SimulatedUserSession } from '../../lib/cadastrosBaseStorage';
import { getStoredAdminSettings } from '../../lib/masterAdminStorage';
import { useConfirm } from '../../context/ConfirmContext';

export interface PdvItem {
  id: string;
  productId?: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  qtd?: number;
  categoria?: string;
  category?: string;
  precoUnitario: number;
  percentualDesconto: number;
  valorDesconto: number;
  totalBruto: number;
  totalLiquido: number;
}

interface InstallmentRow {
  numero: number;
  vencimento: string;
  valor: number;
}

export interface FreteVinculadoItem {
  id: string;
  veiculoId: string;
  veiculoIdentificacao: string; // [PLACA / MODELO DO VEÍCULO]
  tipoCalculo: 'fixo' | 'km';
  valorUnitario: number;
  kmRodados: number;
  valorTotal: number;
}

export interface VendaRascunho {
  id: string;
  identificacao: string;
  data: string;
  hora?: string;
  total: number;
  items: PdvItem[];
  selectedClientId?: string;
  clientSearch?: string;
  tabelaPreco?: PriceTable;
  fretesVinculados?: FreteVinculadoItem[];
  formaPagamento?: 'a_vista' | 'cartao_debito' | 'cartao_credito' | 'pix' | 'prazo';
  prazoCondicao?: string;
  tipoCobranca?: 'carteira' | 'boleto';
  qtdeParcelas?: number;
  dataPrimeiraParcela?: string;
  formatoImpressao?: 'a4' | 'termica';
  valorPagoInput?: string;
  operacaoTipo?: string;
}

export const RASCUNHOS_STORAGE_KEY = 'agrocontrol_rascunhos_vendas';

export const getStoredRascunhos = (): VendaRascunho[] => {
  try {
    const raw = localStorage.getItem(RASCUNHOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveStoredRascunhos = (rascunhos: VendaRascunho[]): void => {
  try {
    localStorage.setItem(RASCUNHOS_STORAGE_KEY, JSON.stringify(rascunhos));
    window.dispatchEvent(new CustomEvent('agrocontrol_rascunhos_updated', { detail: rascunhos }));
  } catch (e) {
    console.warn('Erro ao salvar rascunhos de venda no LocalStorage:', e);
  }
};

export type PriceTable = 'venda' | 'custo' | 'atacado' | 'promocional';

export interface CatalogProduct {
  id: string;
  code: string;
  barcode: string;
  name: string;
  unit: string;
  category?: string;
  price: number;
  salePrice: number;
  unitCost: number;
  wholesalePrice?: number;
  promoPrice?: number;
  fotoUrl?: string;
  imagemBase64?: string;
  rawItem?: any;
}

export function calculatePriceByTable(
  item: {
    salePrice?: number;
    unitCost?: number;
    wholesalePrice?: number;
    promoPrice?: number;
    precoVenda?: number;
    precoCusto?: number;
    precoAtacado?: number;
    precoPromocional?: number;
    name?: string;
    nome_comercial?: string;
    price?: number;
  },
  table: PriceTable
): number {
  const nameStr = (item.name || item.nome_comercial || '').toUpperCase();
  const isDieselS10 = nameStr.includes('DIESEL S10');
  const isDieselS500 = nameStr.includes('DIESEL S500');

  let cost = Number(item.precoCusto ?? item.unitCost ?? 0);
  let sale = Number(item.precoVenda ?? item.salePrice ?? item.price ?? 0);
  let atacado = Number(item.precoAtacado ?? item.wholesalePrice ?? 0);
  let promo = Number(item.precoPromocional ?? item.promoPrice ?? 0);

  // Fallbacks para garantir que produtos com custo preenchido ou combustíveis não fiquem zerados
  if (cost <= 0) {
    if (isDieselS10) cost = 5.85;
    else if (isDieselS500) cost = 5.60;
    else if (sale > 0) cost = Math.round(sale * 0.75 * 100) / 100;
  }

  if (sale <= 0) {
    if (cost > 0) sale = cost;
    else if (isDieselS10) sale = 5.85;
    else if (isDieselS500) sale = 5.60;
  }

  switch (table) {
    case 'venda':
      return sale > 0 ? sale : cost;
    case 'custo':
      return cost > 0 ? cost : sale;
    case 'atacado':
      if (atacado > 0) return atacado;
      const baseAtacado = sale > 0 ? sale : cost;
      return Math.round(baseAtacado * 0.90 * 100) / 100; // Desconto automático de 10% sobre a venda
    case 'promocional':
      if (promo > 0) return promo;
      const basePromo = sale > 0 ? sale : cost;
      return Math.round(basePromo * 0.85 * 100) / 100; // Desconto automático de 15% sobre a venda
    default:
      return sale;
  }
}

interface PdvViewProps {
  clients?: Client[];
  companyProfile?: CompanyProfile;
  onSaveService: (service: ServiceOrder) => void;
  salesCount: number;
}

const PDV_DRAFT_KEY = 'colaca_silagem_pdv_draft_itens';

// Carregador reativo e unificador dos clientes e produtores rurais (agrocontrol_clientes)
export const loadAgrocontrolClientes = (fallback: Client[] = []): Client[] => {
  const map = new Map<string, Client>();

  // 1. Array oficial 'agrocontrol_clientes' salvo no LocalStorage
  try {
    const rawAgro = localStorage.getItem('agrocontrol_clientes');
    if (rawAgro) {
      const parsed = JSON.parse(rawAgro);
      if (Array.isArray(parsed)) {
        parsed.forEach((c: any) => {
          if (!c) return;
          const id = c.id || `ag_${c.name || c.nome || Math.random().toString(36).substr(2, 6)}`;
          map.set(id, {
            id,
            name: c.name || c.nome || 'PRODUTOR RURAL',
            nome: c.nome || c.name || 'PRODUTOR RURAL',
            farmName: c.farmName || c.fazenda || '',
            fazenda: c.fazenda || c.farmName || '',
            cpfCnpj: c.cpfCnpj || c.cnpjCpf || c.documento || '',
            phone: c.phone || c.telefone || '',
            telefone: c.telefone || c.phone || '',
            city: c.city || c.cidade || '',
            state: c.state || c.estado || c.uf || '',
            ...c,
          });
        });
      }
    }
  } catch (e) {
    console.warn('Erro ao ler agrocontrol_clientes:', e);
  }

  // 2. Chave de clientes da aplicação
  try {
    const stored = getStoredClients();
    if (Array.isArray(stored)) {
      stored.forEach(c => {
        if (c && c.id && !map.has(c.id)) {
          map.set(c.id, c);
        }
      });
    }
  } catch (_) {}

  // 3. Fallback dos props
  if (Array.isArray(fallback)) {
    fallback.forEach(c => {
      if (c && c.id && !map.has(c.id)) {
        map.set(c.id, c);
      }
    });
  }

  return Array.from(map.values());
};

// Carregador reativo dinâmico da conta bancária com status 'isPriority' ou primeira ativa (100% livre de hardcode)
export const getPrioritaryBankAccount = (): { bankName: string; agency: string; accountNumber: string; rawText: string } => {
  try {
    const raw = localStorage.getItem('agrocontrol_bancos') ||
                localStorage.getItem('agrocontrol_contas_bancarias') ||
                localStorage.getItem('agrocontrol_financeiro_contas') ||
                localStorage.getItem('agrocontrol_bancos_contas') ||
                localStorage.getItem('colaca_silagem_financeiro_contas');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        const priority = list.find((a: any) => 
          a.isPriority === true || 
          a.prioritaria === true
        ) || list.find((a: any) =>
          String(a.status || '').toUpperCase() === 'PRIORITÁRIA' || 
          String(a.status || '').toUpperCase() === 'PRIORITARIA' || 
          a.isDefault === true || 
          a.padrao === true
        ) || list.find((a: any) => 
          String(a.status || '').toLowerCase() === 'ativa' ||
          String(a.status || '').toLowerCase() === 'ativo'
        ) || list[0];

        const bName = (priority.bankName || priority.banco || priority.nome || priority.name || '').toUpperCase().trim();
        const ag = (priority.agency || priority.agencia || '').trim();
        const num = (priority.accountNumber || priority.conta || priority.numeroConta || '').trim();
        const digit = (priority.accountDigit || priority.digito || '').trim();
        const fullAccount = num ? `${num}${digit ? `-${digit}` : ''}` : '';

        const parts: string[] = [];
        if (bName) parts.push(bName);
        if (ag) parts.push(`AG: ${ag}`);
        if (fullAccount) parts.push(`C/C: ${fullAccount}`);

        return {
          bankName: bName,
          agency: ag,
          accountNumber: fullAccount,
          rawText: parts.join(' - ') || bName || 'CONTA BANCÁRIA'
        };
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar conta prioritária do LocalStorage:', e);
  }
  return {
    bankName: '',
    agency: '',
    accountNumber: '',
    rawText: 'NENHUMA CONTA PRIORITÁRIA DEFINIDA'
  };
};

export const generatePrintableSaleHtml = (
  sale: any,
  format: 'a4' | 'termica',
  company?: CompanyProfile | null
): string => {
  const isA4 = format === 'a4';
  const companyName = (company?.name || 'AGROCONTROL • SOLUÇÕES AGRÍCOLAS & FORRAGENS').toUpperCase();
  const companyDoc = company?.cnpjCpf || company?.cnpj || '12.345.678/0001-90';
  const companyAddress = company?.address || 'Rodovia BR-163, KM 120 • Sorriso - MT';
  const companyPhone = company?.phone || '(66) 99988-7766';

  if (isA4) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>ESPELHO DE VENDA - ${sale.orderNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; color: #0f172a; background: #fff; line-height: 1.35; padding: 15px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company-title { font-size: 15px; font-weight: 900; text-transform: uppercase; color: #047857; letter-spacing: 0.5px; }
    .company-sub { font-size: 10px; color: #475569; margin-top: 3px; font-weight: 500; }
    .order-box { text-align: right; border-left: 1px solid #cbd5e1; padding-left: 14px; min-width: 190px; }
    .order-tag { display: inline-block; background: #d1fae5; color: #065f46; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .order-num { font-size: 17px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 3px; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin: 12px 0; }
    .info-label { font-size: 8.5px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-val { font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-top: 1px; }
    .bank-box { grid-column: span 4; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; padding: 6px 10px; font-weight: 800; color: #0369a1; font-size: 10px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #e2e8f0; font-size: 9.5px; font-weight: 900; text-transform: uppercase; color: #1e293b; padding: 6px 8px; border: 1px solid #cbd5e1; letter-spacing: 0.3px; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 10.5px; }
    tr:nth-child(even) { background: #f8fafc; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: monospace; }
    .totals-area { display: flex; justify-content: flex-end; margin-top: 12px; }
    .totals-box { width: 300px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 10px; font-size: 10.5px; font-weight: 600; border-bottom: 1px solid #f1f5f9; }
    .totals-main { background: #fef3c7; font-weight: 900; font-size: 12.5px; color: #78350f; border-bottom: 1px solid #fde68a; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; }
    .sig-line { width: 45%; text-align: center; border-top: 1px solid #64748b; padding-top: 5px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #475569; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">${companyName}</div>
      <div class="company-sub">
        CNPJ/CPF: ${companyDoc} | ${companyAddress} | ${companyPhone}
      </div>
    </div>
    <div class="order-box">
      <div class="order-tag">ESPELHO DE VENDA PDV</div>
      <div class="order-num">${sale.orderNumber}</div>
      <div style="font-size: 9.5px; color: #64748b; font-weight: 600;">${sale.date} às ${sale.time}</div>
    </div>
  </div>

  <div class="info-grid">
    <div>
      <div class="info-label">CLIENTE / PRODUTOR:</div>
      <div class="info-val">${sale.client || 'CONSUMIDOR FINAL'}</div>
    </div>
    <div>
      <div class="info-label">FAZENDA / DESTINO:</div>
      <div class="info-val">${sale.farmName || 'BALCÃO'}</div>
    </div>
    <div>
      <div class="info-label">FORMA DE PAGAMENTO:</div>
      <div class="info-val" style="color: #047857;">${sale.forma}</div>
    </div>
    <div>
      <div class="info-label">TIPO COBRANÇA:</div>
      <div class="info-val" style="color: #0369a1;">${sale.tipoCobranca || 'À VISTA'}</div>
    </div>
    ${sale.bancoEmissor ? `<div class="bank-box">🏛️ BANCO EMISSOR: <strong>${sale.bancoEmissor}</strong></div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th class="text-center" style="width: 25px;">#</th>
        <th style="width: 75px;">CÓDIGO</th>
        <th>DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
        <th class="text-center" style="width: 45px;">UN</th>
        <th class="text-right" style="width: 60px;">QTDE</th>
        <th class="text-right" style="width: 85px;">VALOR UNIT.</th>
        <th class="text-right" style="width: 65px;">DESC.</th>
        <th class="text-right" style="width: 100px;">TOTAL LÍQUIDO</th>
      </tr>
    </thead>
    <tbody>
      ${sale.items.map((it: any, idx: number) => `
        <tr>
          <td class="text-center text-slate-500 font-mono">${idx + 1}</td>
          <td class="font-mono" style="font-weight: 700; color: #475569;">${it.codigo || 'DIV'}</td>
          <td><strong>${it.descricao}</strong></td>
          <td class="text-center" style="font-weight: 700;">${it.unidade}</td>
          <td class="text-right font-mono" style="font-weight: 700;">${it.quantidade.toFixed(2).replace('.', ',')}</td>
          <td class="text-right font-mono">${formatCurrencyBRL(it.precoUnitario)}</td>
          <td class="text-right font-mono" style="color: #dc2626; font-weight: 700;">${it.percentualDesconto > 0 ? it.percentualDesconto.toFixed(1).replace('.', ',') + '%' : '-'}</td>
          <td class="text-right font-mono" style="font-weight: 900;">${formatCurrencyBRL(it.totalLiquido)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals-area">
    <div class="totals-box">
      <div class="totals-row"><span>TOTAL BRUTO:</span><span class="font-mono">${formatCurrencyBRL(sale.totalBruto)}</span></div>
      <div class="totals-row"><span>DESCONTOS:</span><span class="font-mono" style="color: #dc2626;">${formatCurrencyBRL(sale.totalDesconto)}</span></div>
      ${sale.totalFrete > 0 ? `<div class="totals-row"><span>FRETE LOGÍSTICA:</span><span class="font-mono" style="color: #d97706; font-weight: 700;">${formatCurrencyBRL(sale.totalFrete)}</span></div>` : ''}
      <div class="totals-row totals-main"><span>TOTAL LÍQUIDO:</span><span class="font-mono">${formatCurrencyBRL(sale.totalLiquido)}</span></div>
      <div class="totals-row"><span>VALOR RECEBIDO:</span><span class="font-mono">${formatCurrencyBRL(sale.valorPago)}</span></div>
      <div class="totals-row"><span>TROCO:</span><span class="font-mono" style="color: #059669; font-weight: 800;">${formatCurrencyBRL(sale.troco)}</span></div>
    </div>
  </div>

  ${sale.fretes && sale.fretes.length > 0 ? `
    <div style="margin-top: 10px; padding: 6px 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 9.5px; text-transform: uppercase;">
      <div style="font-weight: 900; color: #1e293b; margin-bottom: 2px;">🚚 TRANSPORTE & LOGÍSTICA DE ENTREGA (VEÍCULOS VINCULADOS):</div>
      <div style="color: #475569; font-weight: 700;">
        ${sale.fretes.map((f: any) => `• ${f.veiculoIdentificacao} [${f.tipoCalculo === 'km' ? `${f.kmRodados} KM` : 'FIXO'}] : ${formatCurrencyBRL(f.valorTotal)}`).join(' | ')}
      </div>
    </div>
  ` : ''}

  ${sale.parcelas && sale.parcelas.length > 0 ? `
    <div style="margin-top: 15px;">
      <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 4px;">PROGRAMAÇÃO DE PARCELAS A RECEBER:</div>
      <table>
        <thead>
          <tr><th style="width: 25%;">PARCELA</th><th style="width: 40%;">VENCIMENTO</th><th class="text-right">VALOR</th></tr>
        </thead>
        <tbody>
          ${sale.parcelas.map((p: any) => `
            <tr>
              <td><strong>${p.numero}ª Parcela</strong></td>
              <td>${p.vencimento ? formatDateBR(p.vencimento) : '-'}</td>
              <td class="text-right font-mono"><strong>${formatCurrencyBRL(p.valor)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''}

  <div class="signatures">
    <div class="sig-line">EMISSOR / OPERADOR DO CAIXA</div>
    <div class="sig-line">${sale.client || 'ASSINATURA DO CLIENTE'}</div>
  </div>

  <script>
    window.onload = function() {
      window.focus();
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;
  }

  // 80mm Cupom Térmico
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>CUPOM - ${sale.orderNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; background: #fff; line-height: 1.25; width: 72mm; margin: 0 auto; padding: 5px 0; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .dashed { border-top: 1px dashed #000; margin: 5px 0; }
    .double { border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin: 5px 0; }
    .item-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; }
    @media print {
      body { width: 100%; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="text-center font-bold" style="font-size: 12px;">${companyName}</div>
  <div class="text-center" style="font-size: 9px;">${companyDoc}</div>
  <div class="text-center" style="font-size: 9px;">${companyAddress}</div>
  <div class="dashed"></div>
  <div class="text-center font-bold">CUPOM NÃO FISCAL</div>
  <div class="text-center font-bold" style="font-size: 13px;">PEDIDO: ${sale.orderNumber}</div>
  <div class="text-center" style="font-size: 9px;">DATA: ${sale.date} ${sale.time}</div>
  <div class="dashed"></div>
  <div>CLIENTE: <span class="font-bold">${sale.client || 'CONSUMIDOR FINAL'}</span></div>
  ${sale.farmName ? `<div>FAZENDA: ${sale.farmName}</div>` : ''}
  <div>PAGTO:   <span class="font-bold">${sale.forma}</span></div>
  ${sale.bancoEmissor ? `<div>BANCO:   <span class="font-bold">${sale.bancoEmissor}</span></div>` : ''}
  <div class="double text-center font-bold" style="font-size: 9.5px;">ITENS DO PEDIDO</div>
  ${sale.items.map((it: any, idx: number) => `
    <div style="margin-bottom: 4px;">
      <div class="font-bold">${idx + 1}. [${it.codigo || 'DIV'}] ${it.descricao}</div>
      <div class="item-row">
        <span>${it.quantidade.toFixed(2).replace('.', ',')} ${it.unidade} x ${formatCurrencyBRL(it.precoUnitario)}</span>
        <span class="font-bold">${formatCurrencyBRL(it.totalLiquido)}</span>
      </div>
    </div>
  `).join('')}
  <div class="dashed"></div>
  <div class="item-row"><span>TOTAL BRUTO:</span><span>${formatCurrencyBRL(sale.totalBruto)}</span></div>
  <div class="item-row"><span>DESCONTOS:</span><span>${formatCurrencyBRL(sale.totalDesconto)}</span></div>
  ${sale.totalFrete > 0 ? `<div class="item-row"><span>FRETE LOGÍSTICA:</span><span>${formatCurrencyBRL(sale.totalFrete)}</span></div>` : ''}
  <div class="item-row font-bold" style="font-size: 12px;"><span>TOTAL LÍQUIDO:</span><span>${formatCurrencyBRL(sale.totalLiquido)}</span></div>
  <div class="item-row"><span>VALOR RECEBIDO:</span><span>${formatCurrencyBRL(sale.valorPago)}</span></div>
  <div class="item-row font-bold"><span>TROCO:</span><span>${formatCurrencyBRL(sale.troco)}</span></div>
  ${sale.fretes && sale.fretes.length > 0 ? `
    <div class="dashed"></div>
    <div style="font-size: 8.5px; text-align: left;">
      <div class="font-bold">VEÍCULOS / TRANSPORTE:</div>
      ${sale.fretes.map((f: any) => `<div>• ${f.veiculoIdentificacao} (${formatCurrencyBRL(f.valorTotal)})</div>`).join('')}
    </div>
  ` : ''}
  ${sale.parcelas && sale.parcelas.length > 0 ? `
    <div class="dashed"></div>
    <div class="font-bold text-center" style="font-size: 9.5px;">PARCELAS A RECEBER (${sale.parcelas.length}x):</div>
    ${sale.parcelas.map((p: any) => `
      <div class="item-row" style="font-size: 9.5px;">
        <span>${p.numero}ª (${p.vencimento ? formatDateBR(p.vencimento) : '-'})</span>
        <span class="font-bold">${formatCurrencyBRL(p.valor)}</span>
      </div>
    `).join('')}
  ` : ''}
  <div class="dashed"></div>
  <div class="text-center" style="font-size: 9px; margin-top: 6px;">OBRIGADO PELA PREFERÊNCIA!</div>
  <div class="text-center font-bold" style="font-size: 8px;">AGROCONTROL - GESTÃO AGRÍCOLA INTELIGENTE</div>
  <script>
    window.onload = function() {
      window.focus();
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`;
};

export const PdvView: React.FC<PdvViewProps> = ({
  clients = [],
  companyProfile,
  onSaveService,
  salesCount,
}) => {
  const { confirm: confirmDialog } = useConfirm();
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Modo de operação no PDV: Venda Balcão ou Lançamento de Contrato de Silagem
  const [operacaoTipo, setOperacaoTipo] = useState<'venda_balcao' | 'contrato_silagem'>('venda_balcao');

  // Modo Expansão Tela Cheia do PDV (Foco Total de Caixa)
  const [isPdvFullscreen, setIsPdvFullscreen] = useState<boolean>(false);

  const togglePdvFullscreen = () => {
    const next = !isPdvFullscreen;
    setIsPdvFullscreen(next);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('agrocontrol_pdv_fullscreen', { detail: { fullscreen: next } }));
    }, 0);
  };

  const exitPdvFullscreen = () => {
    if (!isPdvFullscreen) return;
    setIsPdvFullscreen(false);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('agrocontrol_pdv_fullscreen', { detail: { fullscreen: false } }));
    }, 0);
  };

  useEffect(() => {
    const handlePdvFullscreenSync = (e: any) => {
      if (typeof e?.detail?.fullscreen === 'boolean') {
        setIsPdvFullscreen(e.detail.fullscreen);
      }
    };
    window.addEventListener('agrocontrol_pdv_fullscreen', handlePdvFullscreenSync);
    return () => {
      window.removeEventListener('agrocontrol_pdv_fullscreen', handlePdvFullscreenSync);
    };
  }, []);

  // Clientes e Produtores rurais carregados e sincronizados reativamente de 'agrocontrol_clientes'
  const [agroClientes, setAgroClientes] = useState<Client[]>(() => loadAgrocontrolClientes(clients));

  useEffect(() => {
    setAgroClientes(loadAgrocontrolClientes(clients));
  }, [clients]);

  useEffect(() => {
    const syncClients = () => {
      setAgroClientes(loadAgrocontrolClientes(clients));
    };
    window.addEventListener('storage', syncClients);
    window.addEventListener('agrocontrol_clientes_updated', syncClients);
    window.addEventListener('clients_updated', syncClients);
    window.addEventListener('colaca_clientes_sync', syncClients);
    return () => {
      window.removeEventListener('storage', syncClients);
      window.removeEventListener('agrocontrol_clientes_updated', syncClients);
      window.removeEventListener('clients_updated', syncClients);
      window.removeEventListener('colaca_clientes_sync', syncClients);
    };
  }, [clients]);

  // Itens lançados na grade
  const [items, setItems] = useState<PdvItem[]>(() => {
    try {
      const raw = localStorage.getItem(PDV_DRAFT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Salvar rascunho dos itens no LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(PDV_DRAFT_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Erro ao salvar rascunho do PDV no LocalStorage:', e);
    }
  }, [items]);

  // Produtos do estoque para busca rápida consumindo única e exclusivamente 'agrocontrol_produtos'
  const [stockItems, setStockItems] = useState<InventoryItem[]>(() => getStoredInventory());
  useEffect(() => {
    const syncRealStock = () => {
      setStockItems(getStoredInventory());
    };
    syncRealStock();
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'agrocontrol_produtos') {
        syncRealStock();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('agrocontrol_produtos_updated', syncRealStock);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('agrocontrol_produtos_updated', syncRealStock);
    };
  }, []);

  // Campos do Painel Superior de Entrada
  const [inputQtde, setInputQtde] = useState<string>('1,00');
  const [inputBusca, setInputBusca] = useState<string>('');
  const [inputCodigo, setInputCodigo] = useState<string>('');
  const [inputDescricao, setInputDescricao] = useState<string>('');
  const [inputUnidade, setInputUnidade] = useState<string>('UN');
  const [inputPreco, setInputPreco] = useState<string>('0,00');
  const [inputDesconto, setInputDesconto] = useState<string>('0,00');
  
  // Tabela de Preços Ativa e Objeto de Produto Selecionado
  const [tabelaPreco, setTabelaPreco] = useState<PriceTable>('venda');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);

  // Sugestões de autocomplete na busca
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const valorPagoInputRef = useRef<HTMLInputElement>(null);
  const productSearchContainerRef = useRef<HTMLDivElement>(null);

  // Cliente selecionado no PDV
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('CONSUMIDOR FINAL / BALCÃO');
  const [showClientSuggestions, setShowClientSuggestions] = useState<boolean>(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdowns de sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientSuggestions(false);
      }
      if (productSearchContainerRef.current && !productSearchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =========================================================================
  // REGRAS DE SEGURANÇA E ALÇADA MÁXIMA DE DESCONTO (% DESC) POR CARGO
  // =========================================================================
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('agrocontrol_usuario_logado') || localStorage.getItem('usuario_logado');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) return parsed;
      }
    } catch {}
    return getActiveUserSession();
  });

  useEffect(() => {
    const handleSyncUser = () => {
      try {
        const raw = localStorage.getItem('agrocontrol_usuario_logado') || localStorage.getItem('usuario_logado');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed) {
            setCurrentUser(parsed);
            return;
          }
        }
      } catch {}
      setCurrentUser(getActiveUserSession());
    };

    window.addEventListener('colaca_silagem_session_updated', handleSyncUser);
    window.addEventListener('storage', handleSyncUser);
    return () => {
      window.removeEventListener('colaca_silagem_session_updated', handleSyncUser);
      window.removeEventListener('storage', handleSyncUser);
    };
  }, []);

  // 1. Trava de Teto Máximo por Perfil de Usuário:
  // Administrador Geral: teto de 15.00% | Caixa / Operador: teto rigoroso de 5.00%
  const isAdministradorGeral = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.type === 'admin') return true;
    const roleStr = (currentUser.cargoNome || currentUser.cargo || currentUser.name || currentUser.role || '').toUpperCase();
    return roleStr.includes('ADMINISTRADOR') || roleStr.includes('ADMIN') || roleStr.includes('DIRETOR') || roleStr.includes('GERENTE GERAL');
  }, [currentUser]);

  const maxDiscountAllowed = isAdministradorGeral ? 15.00 : 5.00;
  const roleBadgeLabel = isAdministradorGeral ? 'ADMINISTRADOR GERAL' : 'CAIXA / OPERADOR';

  // Estados de Alerta e Modal de Autorização Master
  const [isDiscountExceeded, setIsDiscountExceeded] = useState<boolean>(false);
  const [attemptedDiscount, setAttemptedDiscount] = useState<number>(0);
  const [isMasterAuthModalOpen, setIsMasterAuthModalOpen] = useState<boolean>(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState<string>('');
  const [masterAuthError, setMasterAuthError] = useState<string>('');
  const [showMasterPassword, setShowMasterPassword] = useState<boolean>(false);
  const discountAlertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validador de Senha Administrativa contra 'agrocontrol_cargos_permissoes' e configurações mestre
  const validateAdminPassword = (enteredPass: string): boolean => {
    const cleanPass = enteredPass.trim();
    if (!cleanPass) return false;

    // 1. Varre 'agrocontrol_cargos_permissoes' e 'colaca_silagem_cargos_permissoes'
    const storageKeys = [
      'agrocontrol_cargos_permissoes',
      'colaca_silagem_cargos_permissoes',
      'cargos_permissoes'
    ];

    for (const key of storageKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item?.senha && item.senha.trim() === cleanPass) return true;
              if (item?.password && item.password.trim() === cleanPass) return true;
              if (item?.senha_admin && item.senha_admin.trim() === cleanPass) return true;
              if (item?.admin_password && item.admin_password.trim() === cleanPass) return true;
            }
          } else if (parsed && typeof parsed === 'object') {
            if (parsed.senha && parsed.senha.trim() === cleanPass) return true;
            if (parsed.password && parsed.password.trim() === cleanPass) return true;
            if (parsed.senha_admin && parsed.senha_admin.trim() === cleanPass) return true;
            if (parsed.admin_password && parsed.admin_password.trim() === cleanPass) return true;
          }
        }
      } catch {}
    }

    // 2. Senha mestre das configurações administrativas do ERP
    try {
      const adminSettings = getStoredAdminSettings();
      if (adminSettings?.masterPassword && adminSettings.masterPassword.trim() === cleanPass) {
        return true;
      }
    } catch {}

    // 3. Padrões de senhas administrativas padrão do sistema
    const defaultMasterPasswords = [
      'AgroControl@Master2026',
      'admin123',
      'admin',
      'agro2026',
      '123456',
      'agrocontrol'
    ];

    return defaultMasterPasswords.some(p => p.toLowerCase() === cleanPass.toLowerCase());
  };

  // Interceptação e Correção Automática no campo % DESC
  const handleDescontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleanNum = parseFloat(raw.replace(/\./g, '').replace(',', '.'));

    // Se o operador digitar um valor maior do que o teto permitido pelo seu cargo
    if (!isNaN(cleanNum) && cleanNum > maxDiscountAllowed) {
      // 1. Captura o valor excedido para autorização
      setAttemptedDiscount(cleanNum);
      // 2. Reajusta o input automaticamente para o teto máximo permitido (5.00% ou 15.00%)
      setInputDesconto(maxDiscountAllowed.toFixed(2).replace('.', ','));
      // 3. Aplica alerta e borda amarela temporária
      setIsDiscountExceeded(true);

      if (discountAlertTimeoutRef.current) {
        clearTimeout(discountAlertTimeoutRef.current);
      }
      discountAlertTimeoutRef.current = setTimeout(() => {
        setIsDiscountExceeded(false);
      }, 5000);
      return;
    }

    setInputDesconto(raw);
    if (isNaN(cleanNum) || cleanNum <= maxDiscountAllowed) {
      setIsDiscountExceeded(false);
      setAttemptedDiscount(0);
    }
  };

  // Controle de Pagamento
  const [formaPagamento, setFormaPagamento] = useState<'a_vista' | 'cartao_debito' | 'cartao_credito' | 'pix' | 'prazo'>('a_vista');
  const [valorPagoInput, setValorPagoInput] = useState<string>('');
  
  // Bloco Prazo: Condição, Cobrança, Formato e Parcelas
  const [prazoCondicao, setPrazoCondicao] = useState<string>('30 DIAS');
  const [tipoCobranca, setTipoCobranca] = useState<'carteira' | 'boleto'>('carteira');
  const [formatoImpressao, setFormatoImpressao] = useState<'a4' | 'termica'>('termica');
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [qtdeParcelas, setQtdeParcelas] = useState<number>(1);

  // Busca reativa da Conta Prioritária para Boleto Bancário
  const [prioritaryAccount, setPrioritaryAccount] = useState<{
    bankName: string;
    agency: string;
    accountNumber: string;
    rawText: string;
  }>(() => getPrioritaryBankAccount());

  useEffect(() => {
    const syncAccount = () => {
      setPrioritaryAccount(getPrioritaryBankAccount());
    };
    window.addEventListener('storage', syncAccount);
    window.addEventListener('agrocontrol_bancos_updated', syncAccount);
    window.addEventListener('agrocontrol_bancos_contas_updated', syncAccount);
    window.addEventListener('bank_accounts_updated', syncAccount);
    return () => {
      window.removeEventListener('storage', syncAccount);
      window.removeEventListener('agrocontrol_bancos_updated', syncAccount);
      window.removeEventListener('agrocontrol_bancos_contas_updated', syncAccount);
      window.removeEventListener('bank_accounts_updated', syncAccount);
    };
  }, []);

  // Modal Centralizado de Fechamento do PDV (Padrão Ouro Slim Design Pro)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);

  // Modal de Cupom / Espelho de Venda A4 com Suporte Anti-Sandbox
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [activePrintFormat, setActivePrintFormat] = useState<'a4' | 'termica'>('termica');
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [lastFinishedSale, setLastFinishedSale] = useState<{
    orderNumber: string;
    date: string;
    time: string;
    client: string;
    clientId?: string;
    farmName?: string;
    items: PdvItem[];
    totalBruto: number;
    totalDesconto: number;
    totalLiquido: number;
    forma: string;
    tipoCobranca?: string;
    bancoEmissor?: string;
    formatoImpressao?: 'a4' | 'termica';
    valorPago: number;
    troco: number;
    parcelas?: InstallmentRow[];
    fretes?: FreteVinculadoItem[];
    totalFrete?: number;
  } | null>(null);

  // =========================================================================
  // LOGÍSTICA DE TRANSPORTE / FRETE VINCULADO MULTIVEÍCULO (SLIM DESIGN PRO)
  // =========================================================================
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [fretesVinculados, setFretesVinculados] = useState<FreteVinculadoItem[]>([]);
  const [veiculoFreteId, setVeiculoFreteId] = useState<string>('');
  const [veiculoSearchText, setVeiculoSearchText] = useState<string>('');
  const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState<boolean>(false);
  const [selectedVehicleIndex, setSelectedVehicleIndex] = useState<number>(0);
  const vehicleContainerRef = useRef<HTMLDivElement>(null);
  const [tipoCalculoFrete, setTipoCalculoFrete] = useState<'fixo' | 'km'>('fixo');
  const [valorTaxaFreteRaw, setValorTaxaFreteRaw] = useState<string>('');
  const [valorTaxaFreteInput, setValorTaxaFreteInput] = useState<string>('0,00');
  const [kmRodadosFreteInput, setKmRodadosFreteInput] = useState<string>('');

  // Fechar dropdown de veículos ao clicar fora do componente
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vehicleContainerRef.current && !vehicleContainerRef.current.contains(e.target as Node)) {
        setIsVehicleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * MÁSCARA FINANCEIRA PADRÃO DE CENTAVOS FLUIDOS NO FRETE (DIREITA PARA A ESQUERDA):
   * - Inicia com "0,00"
   * - Digitação entra como centavos empurrando para a esquerda:
   *   "5" -> 0,05
   *   "50" -> 0,50
   *   "550" -> 5,50
   *   "551000" -> 5.510,00
   */
  const formatFreteTaxaCentsRTL = (rawDigits: string): string => {
    const clean = String(rawDigits || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!clean) return '0,00';
    const centsFloat = parseInt(clean, 10) / 100;
    return centsFloat.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleValorTaxaFreteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      return;
    }

    const target = e.currentTarget;
    const isAllSelected = (target.selectionStart === 0 && target.selectionEnd === target.value.length) || target.value === '0,00';

    if (e.key === 'Backspace') {
      e.preventDefault();
      const currentDigits = valorTaxaFreteInput.replace(/\D/g, '').replace(/^0+/, '');
      if (isAllSelected || currentDigits.length <= 1) {
        setValorTaxaFreteInput('0,00');
        setValorTaxaFreteRaw('');
        return;
      }
      const next = currentDigits.slice(0, -1);
      setValorTaxaFreteRaw(next);
      setValorTaxaFreteInput(formatFreteTaxaCentsRTL(next));
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      setValorTaxaFreteInput('0,00');
      setValorTaxaFreteRaw('');
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const digit = e.key;
      const currentDigits = isAllSelected ? '' : valorTaxaFreteInput.replace(/\D/g, '').replace(/^0+/, '');
      if (currentDigits.length >= 11) return;
      const next = currentDigits + digit;
      setValorTaxaFreteRaw(next);
      setValorTaxaFreteInput(formatFreteTaxaCentsRTL(next));
      return;
    }
  };

  const handleValorTaxaFreteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = val.replace(/\D/g, '').replace(/^0+/, '');
    setValorTaxaFreteRaw(clean);
    setValorTaxaFreteInput(formatFreteTaxaCentsRTL(clean));
  };

  const handleValorTaxaFretePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const digits = pasted.replace(/\D/g, '').replace(/^0+/, '');
    setValorTaxaFreteRaw(digits);
    setValorTaxaFreteInput(formatFreteTaxaCentsRTL(digits));
  };

  const getVehicleIdentificationText = (v: any): string => {
    if (!v) return 'VEÍCULO INDEFINIDO';
    const plate = v.licensePlateOrSerial || v.plate || v.plateOrSerial || 'S/ PLACA';
    const name = v.model || v.name || v.brand || 'VEÍCULO';
    const fleet = v.fleetNumber || v.numero_frota;
    return `[${plate.toUpperCase()}] ${name.toUpperCase()}${fleet ? ` (FROTA #${fleet})` : ''}`;
  };

  // Carregar lista de caminhões, tratores e cavalos mecânicos de 'agrocontrol_frotas_veiculos'
  const loadFleetVehicles = () => {
    try {
      const raw = localStorage.getItem('agrocontrol_frotas_veiculos') ||
                  localStorage.getItem('colaca_silagem_frotas_veiculos') ||
                  localStorage.getItem('agrocontrol_veiculos') ||
                  localStorage.getItem('agrocontrol_frotas');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAvailableVehicles(parsed);
          setVeiculoFreteId(prev => prev || parsed[0]?.id || '');
          setVeiculoSearchText(prev => prev || getVehicleIdentificationText(parsed[0]));
          return;
        }
      }
      const stored = getStoredMachineries();
      if (stored && stored.length > 0) {
        setAvailableVehicles(stored);
        setVeiculoFreteId(prev => prev || stored[0]?.id || '');
        setVeiculoSearchText(prev => prev || getVehicleIdentificationText(stored[0]));
      } else {
        // Frota padrão inicial para prontidão operacional imediata
        const fallbackFleet = [
          { id: 'frot_caminhao_axor', model: 'MERCEDES-BENZ AXOR 2544', plate: 'BRA-2024', licensePlateOrSerial: 'BRA-2024', brand: 'Mercedes-Benz', categoryType: 'caminhao', fleetNumber: '101' },
          { id: 'frot_caminhao_volvo', model: 'VOLVO FH 540 6X4 (CAVALO MECÂNICO)', plate: 'AGR-8899', licensePlateOrSerial: 'AGR-8899', brand: 'Volvo', categoryType: 'caminhao', fleetNumber: '102' },
          { id: 'frot_trator_jd', model: 'TRATOR JOHN DEERE 6110M', plate: 'JD-6110', licensePlateOrSerial: 'JD-6110', brand: 'John Deere', categoryType: 'trator', fleetNumber: '201' },
        ];
        setAvailableVehicles(fallbackFleet);
        setVeiculoFreteId(prev => prev || fallbackFleet[0].id);
        setVeiculoSearchText(prev => prev || getVehicleIdentificationText(fallbackFleet[0]));
      }
    } catch (err) {
      console.warn('Erro ao carregar veículos de frete:', err);
    }
  };

  useEffect(() => {
    loadFleetVehicles();
    const handleUpdate = () => loadFleetVehicles();
    window.addEventListener('agrocontrol_frotas_veiculos_updated', handleUpdate);
    window.addEventListener('frotas_veiculos_updated', handleUpdate);
    window.addEventListener('machineries_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('agrocontrol_frotas_veiculos_updated', handleUpdate);
      window.removeEventListener('frotas_veiculos_updated', handleUpdate);
      window.removeEventListener('machineries_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Filtragem dinâmica por digitação do operador (Autocomplete reativo por PLACA, MODELO, MARCA ou TIPO)
  const filteredVehicles = useMemo(() => {
    const q = veiculoSearchText.trim().toLowerCase();
    if (!q) {
      return availableVehicles.slice(0, 20);
    }
    const cleanQ = q.replace(/[^a-z0-9]/gi, '');
    return availableVehicles.filter((v: any) => {
      const plate = (v.licensePlateOrSerial || v.plate || v.plateOrSerial || '').toLowerCase();
      const cleanPlate = plate.replace(/[^a-z0-9]/gi, '');
      const model = (v.model || v.name || '').toLowerCase();
      const brand = (v.brand || '').toLowerCase();
      const type = (v.categoryType || v.type || v.tipo || '').toLowerCase();
      const fleet = (v.fleetNumber || v.numero_frota || '').toString().toLowerCase();

      return (
        plate.includes(q) ||
        (cleanQ.length > 0 && cleanPlate.includes(cleanQ)) ||
        model.includes(q) ||
        brand.includes(q) ||
        type.includes(q) ||
        fleet.includes(q)
      );
    }).slice(0, 20);
  }, [veiculoSearchText, availableVehicles]);

  const handleSelectVehicle = (veh: any) => {
    setVeiculoFreteId(veh.id);
    setVeiculoSearchText(getVehicleIdentificationText(veh));
    setIsVehicleDropdownOpen(false);
  };

  // =========================================================================
  // GESTÃO DE RASCUNHOS DE VENDA TEMPORÁRIOS ('agrocontrol_rascunhos_vendas')
  // =========================================================================
  const [rascunhosSalvos, setRascunhosSalvos] = useState<VendaRascunho[]>(() => getStoredRascunhos());
  const [isRascunhosDropdownOpen, setIsRascunhosDropdownOpen] = useState<boolean>(false);
  const [isSaveDraftModalOpen, setIsSaveDraftModalOpen] = useState<boolean>(false);
  const [draftIdentificacaoInput, setDraftIdentificacaoInput] = useState<string>('');
  const [currentLoadedDraftId, setCurrentLoadedDraftId] = useState<string | null>(null);
  const rascunhosDropdownRef = useRef<HTMLDivElement>(null);

  // Sincronização reativa dos rascunhos com LocalStorage e CustomEvents
  useEffect(() => {
    const syncRascunhos = () => {
      setRascunhosSalvos(getStoredRascunhos());
    };
    window.addEventListener('agrocontrol_rascunhos_updated', syncRascunhos);
    window.addEventListener('storage', (e) => {
      if (!e.key || e.key === RASCUNHOS_STORAGE_KEY) {
        syncRascunhos();
      }
    });
    return () => {
      window.removeEventListener('agrocontrol_rascunhos_updated', syncRascunhos);
    };
  }, []);

  // Fechar dropdown de rascunhos ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rascunhosDropdownRef.current && !rascunhosDropdownRef.current.contains(e.target as Node)) {
        setIsRascunhosDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Foco inicial no campo de busca ao montar
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Catálogo consumindo única e exclusivamente o estoque real ('agrocontrol_produtos') - Fim dos dados fakes/mockados
  const productCatalog = useMemo<CatalogProduct[]>(() => {
    if (!stockItems || stockItems.length === 0) return [];

    const stockMapped: CatalogProduct[] = stockItems.map(item => {
      const name = (item.nome_comercial || item.name || '').toUpperCase();
      const unit = (item.unidade_medida || item.unit || 'UN').toUpperCase();
      const isDieselS10 = name.includes('DIESEL S10');
      const isDieselS500 = name.includes('DIESEL S500');

      let cost = Number(item.preco_custo_inicial ?? item.custo_nominal ?? item.custo_com_imposto ?? item.unitCost ?? (item as any).precoCusto ?? 0);
      let sale = Number(item.preco_venda_varejo ?? item.preco_venda ?? item.salePrice ?? (item as any).precoVenda ?? 0);
      let atacado = Number(item.wholesalePrice ?? item.preco_venda_atacado ?? item.preco_atacado ?? (item as any).precoAtacado ?? 0);
      let promo = Number(item.promoPrice ?? item.preco_venda_promo ?? item.preco_promocional ?? (item as any).precoPromocional ?? 0);

      if (cost <= 0) {
        if (isDieselS10) cost = 5.85;
        else if (isDieselS500) cost = 5.60;
        else if (sale > 0) cost = Math.round(sale * 0.75 * 100) / 100;
      }

      if (sale <= 0) {
        if (cost > 0) sale = cost;
        else if (isDieselS10) sale = 5.85;
        else if (isDieselS500) sale = 5.60;
      }

      const activePrice = calculatePriceByTable({
        salePrice: sale,
        unitCost: cost,
        wholesalePrice: atacado,
        promoPrice: promo,
        name,
      }, tabelaPreco);

      return {
        id: item.id,
        code: item.code || (item as any).codigo_produto || `EST-${item.id.slice(-4).toUpperCase()}`,
        barcode: item.barcode || (item as any).codigo_barras || '',
        name,
        unit,
        category: (item as any).category || (item as any).categoria || '',
        price: activePrice > 0 ? activePrice : (sale > 0 ? sale : cost),
        salePrice: sale,
        unitCost: cost,
        wholesalePrice: atacado,
        promoPrice: promo,
        fotoUrl: (item as any).fotoUrl || (item as any).imagemBase64 || '',
        imagemBase64: (item as any).imagemBase64 || (item as any).fotoUrl || '',
        rawItem: item,
      };
    });

    return stockMapped;
  }, [stockItems, tabelaPreco]);

  // Itens filtrados para sugestão de autocomplete
  const suggestedProducts = useMemo(() => {
    if (!inputBusca.trim()) return [];
    const q = inputBusca.toLowerCase().trim();
    return productCatalog.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [inputBusca, productCatalog]);

  // Clientes e Produtores rurais filtrados para sugestão de autocomplete reativo
  const suggestedClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    const isDefault = !q || q === 'consumidor final / balcão' || q === 'consumidor final (pdv balcão)';

    if (isDefault) {
      return agroClientes.slice(0, 15);
    }

    const cleanQ = q.replace(/\D/g, '');
    return agroClientes.filter(c => {
      const name = (c.nome || c.name || '').toLowerCase();
      const farm = (c.fazenda || c.farmName || '').toLowerCase();
      const doc = (c.cpfCnpj || '').replace(/\D/g, '');
      const phone = (c.telefone || c.phone || '').replace(/\D/g, '');
      const city = (c.city || c.cidade || '').toLowerCase();
      return (
        name.includes(q) ||
        farm.includes(q) ||
        city.includes(q) ||
        (cleanQ.length > 2 && doc.includes(cleanQ)) ||
        (cleanQ.length > 3 && phone.includes(cleanQ))
      );
    }).slice(0, 12);
  }, [clientSearch, agroClientes]);

  // Item ativo para visualização da foto no painel direito (Área Rosa do PDV)
  const activeVisualProduct = useMemo(() => {
    // 1. Se o operador clicou em um item específico da tabela do carrinho
    if (selectedCartItemId) {
      const foundInCart = items.find(it => it.id === selectedCartItemId);
      if (foundInCart) {
        const match = productCatalog.find(p => 
          String(p.id) === String(foundInCart.productId || foundInCart.id) ||
          (p.code && String(p.code).toUpperCase() === String(foundInCart.codigo).toUpperCase()) ||
          (p.name && String(p.name).toUpperCase() === String(foundInCart.descricao).toUpperCase())
        );
        if (match) return match;

        try {
          const raw = localStorage.getItem('agrocontrol_produtos');
          if (raw) {
            const list = JSON.parse(raw);
            const foundAgro = list.find((p: any) => 
              String(p.id) === String(foundInCart.productId || foundInCart.id) ||
              (p.code && String(p.code).toUpperCase() === String(foundInCart.codigo).toUpperCase()) ||
              (p.name && String(p.name).toUpperCase() === String(foundInCart.descricao).toUpperCase())
            );
            if (foundAgro) {
              return {
                id: foundAgro.id || foundInCart.id,
                name: foundAgro.name || foundAgro.nome_comercial || foundInCart.descricao,
                code: foundAgro.code || foundAgro.codigo_produto || foundInCart.codigo,
                category: foundAgro.category || foundAgro.categoria || foundInCart.categoria || '',
                fotoUrl: foundAgro.fotoUrl || foundAgro.imagemBase64 || (foundInCart as any).fotoUrl || '',
                imagemBase64: foundAgro.imagemBase64 || foundAgro.fotoUrl || (foundInCart as any).imagemBase64 || '',
              };
            }
          }
        } catch (e) {
          // ignore
        }

        return {
          id: foundInCart.id,
          name: foundInCart.descricao,
          code: foundInCart.codigo,
          category: foundInCart.categoria || '',
          fotoUrl: (foundInCart as any).fotoUrl || '',
          imagemBase64: (foundInCart as any).imagemBase64 || '',
        };
      }
    }

    // 2. Se houver um produto selecionado na barra de busca [F3]
    if (selectedProduct) {
      try {
        const raw = localStorage.getItem('agrocontrol_produtos');
        if (raw) {
          const list = JSON.parse(raw);
          const foundAgro = list.find((p: any) => 
            String(p.id) === String(selectedProduct.id) || 
            (p.code && String(p.code).toUpperCase() === String(selectedProduct.code).toUpperCase()) ||
            (p.name && String(p.name).toUpperCase() === String(selectedProduct.name).toUpperCase()) ||
            (p.barcode && String(p.barcode).toUpperCase() === String(selectedProduct.barcode).toUpperCase())
          );
          if (foundAgro) {
            return {
              id: foundAgro.id || selectedProduct.id,
              name: foundAgro.name || foundAgro.nome_comercial || selectedProduct.name,
              code: foundAgro.code || foundAgro.codigo_produto || selectedProduct.code,
              category: foundAgro.category || foundAgro.categoria || selectedProduct.category,
              fotoUrl: foundAgro.fotoUrl || foundAgro.imagemBase64 || selectedProduct.fotoUrl || selectedProduct.imagemBase64 || '',
              imagemBase64: foundAgro.imagemBase64 || foundAgro.fotoUrl || selectedProduct.imagemBase64 || selectedProduct.fotoUrl || '',
            };
          }
        }
      } catch (e) {
        // ignore
      }
      return selectedProduct;
    }

    // 3. Se houver sugestão ativa no inputBusca
    if (showSuggestions && suggestedProducts.length > 0) {
      const p = suggestedProducts[selectedSuggestionIndex] || suggestedProducts[0];
      return p;
    }

    // 4. Se houver texto digitado no campo de busca ou código ou leitor de código de barras
    const q = (inputBusca || inputCodigo || inputDescricao).trim().toLowerCase();
    if (q) {
      const match = productCatalog.find(p => 
        p.code.toLowerCase() === q ||
        p.barcode.toLowerCase() === q ||
        p.name.toLowerCase() === q ||
        p.name.toLowerCase().includes(q)
      );
      if (match) return match;
    }

    // 5. Se houver itens já inseridos no carrinho (conforme print com PNEU PIRELLI)
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      const match = productCatalog.find(p => 
        String(p.id) === String(lastItem.productId || lastItem.id) || 
        (p.code && String(p.code).toUpperCase() === String(lastItem.codigo).toUpperCase()) ||
        (p.name && String(p.name).toUpperCase() === String(lastItem.descricao).toUpperCase())
      );
      if (match) return match;

      try {
        const raw = localStorage.getItem('agrocontrol_produtos');
        if (raw) {
          const list = JSON.parse(raw);
          const foundAgro = list.find((p: any) => 
            String(p.id) === String(lastItem.productId || lastItem.id) || 
            (p.code && String(p.code).toUpperCase() === String(lastItem.codigo).toUpperCase()) ||
            (p.name && String(p.name).toUpperCase() === String(lastItem.descricao).toUpperCase())
          );
          if (foundAgro) {
            return {
              id: foundAgro.id || lastItem.id,
              name: foundAgro.name || foundAgro.nome_comercial || lastItem.descricao,
              code: foundAgro.code || foundAgro.codigo_produto || lastItem.codigo,
              category: foundAgro.category || foundAgro.categoria || lastItem.categoria || '',
              fotoUrl: foundAgro.fotoUrl || foundAgro.imagemBase64 || '',
              imagemBase64: foundAgro.imagemBase64 || foundAgro.fotoUrl || '',
            };
          }
        }
      } catch (e) {
        // ignore
      }

      return {
        id: lastItem.id,
        name: lastItem.descricao,
        code: lastItem.codigo,
        category: lastItem.categoria || '',
        fotoUrl: (lastItem as any).fotoUrl || '',
        imagemBase64: (lastItem as any).imagemBase64 || '',
      };
    }

    return null;
  }, [
    selectedCartItemId, 
    items, 
    selectedProduct, 
    showSuggestions, 
    suggestedProducts, 
    selectedSuggestionIndex, 
    inputBusca, 
    inputCodigo, 
    inputDescricao, 
    productCatalog
  ]);

  // Foto selecionada reativa para exibição no painel da direita (Área Rosa)
  const fotoSelecionada = useMemo(() => {
    if (!activeVisualProduct) return '';
    const directPhoto = (activeVisualProduct as any).fotoUrl || (activeVisualProduct as any).imagemBase64;
    if (directPhoto) return directPhoto;

    // Busca compulsória direta do LocalStorage 'agrocontrol_produtos'
    try {
      const raw = localStorage.getItem('agrocontrol_produtos');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const match = list.find((p: any) => 
            (activeVisualProduct.id && String(p.id) === String(activeVisualProduct.id)) ||
            (activeVisualProduct.code && p.code && String(p.code).toUpperCase() === String(activeVisualProduct.code).toUpperCase()) ||
            (activeVisualProduct.name && p.name && String(p.name).toUpperCase() === String(activeVisualProduct.name).toUpperCase()) ||
            (activeVisualProduct.name && p.nome_comercial && String(p.nome_comercial).toUpperCase() === String(activeVisualProduct.name).toUpperCase())
          );
          if (match && (match.fotoUrl || match.imagemBase64)) {
            return match.fotoUrl || match.imagemBase64;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar foto do produto:', e);
    }

    return '';
  }, [activeVisualProduct]);

  // Identifica se o item é um serviço ou contrato
  const isServicoItem = useMemo(() => {
    if (!activeVisualProduct) return false;
    const cat = String(activeVisualProduct.category || '').toUpperCase();
    const name = String(activeVisualProduct.name || '').toUpperCase();
    return (
      cat.includes('SERVI') ||
      name.includes('SERVI') ||
      name.includes('CONTRATO') ||
      name.includes('SILAGEM') ||
      name.includes('VOLCANIZ') ||
      name.includes('VULCANIZ')
    );
  }, [activeVisualProduct]);

  // Totais do PDV com Soma Reativa do Frete Vinculado
  const totals = useMemo(() => {
    let bruto = 0;
    let desconto = 0;
    let totalItensContagem = 0;

    items.forEach(it => {
      bruto += it.totalBruto;
      desconto += it.valorDesconto;
      totalItensContagem += it.quantidade;
    });

    const totalFreteCalculado = fretesVinculados.reduce((acc, f) => acc + (f.valorTotal || 0), 0);
    const liquido = Math.max(0, bruto - desconto) + totalFreteCalculado;

    let pagoNumerico = liquido;
    if (valorPagoInput && valorPagoInput.trim()) {
      const cleanVal = valorPagoInput.trim();
      if (cleanVal.includes(',')) {
        pagoNumerico = parseFloat(cleanVal.replace(/\./g, '').replace(',', '.')) || 0;
      } else {
        pagoNumerico = parseFloat(cleanVal) || 0;
      }
    }
    const troco = Math.max(0, Math.round((pagoNumerico - liquido) * 100) / 100);

    let custoTotal = 0;
    items.forEach(it => {
      const matched = productCatalog.find(p => p.id === it.productId || p.code === it.codigo || p.name === it.descricao);
      const unitCost = matched?.unitCost || (it.precoUnitario * 0.70);
      custoTotal += unitCost * it.quantidade;
    });
    const margemValor = Math.max(0, Math.round((liquido - custoTotal) * 100) / 100);
    const margemPercentual = liquido > 0 ? Math.round((margemValor / liquido) * 10000) / 100 : 0;

    return {
      totalBruto: bruto,
      totalDesconto: desconto,
      totalFrete: totalFreteCalculado,
      totalLiquido: liquido,
      totalItens: items.length,
      totalQuantidade: totalItensContagem,
      valorPago: pagoNumerico,
      troco: troco,
      margemValor: margemValor,
      margemPercentual: margemPercentual
    };
  }, [items, valorPagoInput, fretesVinculados, productCatalog]);

  // Parcelas do Bloco a Prazo
  const parcelas = useMemo<InstallmentRow[]>(() => {
    if (formaPagamento !== 'prazo' || totals.totalLiquido <= 0 || qtdeParcelas <= 0) return [];
    
    const count = Math.max(1, qtdeParcelas);
    const valorBase = Math.round((totals.totalLiquido / count) * 100) / 100;
    const rows: InstallmentRow[] = [];
    
    const startDate = new Date(dataPrimeiraParcela || new Date());
    
    for (let i = 1; i <= count; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + ((i - 1) * 30));
      
      // Ajuste de centavos na última parcela
      const valor = i === count 
        ? Math.round((totals.totalLiquido - (valorBase * (count - 1))) * 100) / 100
        : valorBase;

      rows.push({
        numero: i,
        vencimento: dueDate.toISOString().split('T')[0],
        valor: Math.max(0, valor)
      });
    }

    return rows;
  }, [formaPagamento, totals.totalLiquido, qtdeParcelas, dataPrimeiraParcela]);

  // Interceptação do gatilho de multiplicação por asterisco ("QTD *") no campo de busca do PDV
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setSelectedSuggestionIndex(0);

    // 1. Identificação do padrão de quantidade multiplicada por asterisco via Regex (ex: "5*", "12*", "10*7891001")
    const match = rawVal.match(/^\s*([0-9]+(?:[.,][0-9]+)?)\s*\*(.*)$/);
    if (match) {
      const qtdStr = match[1];
      const rest = match[2];
      const numQtd = parseFloat(qtdStr.replace(',', '.'));

      if (!isNaN(numQtd) && numQtd > 0) {
        // Atualiza instantaneamente o campo "QTDE (Q)" no padrão BRL (ex: 10,00 ou 5,00)
        const formattedQtde = numQtd.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setInputQtde(formattedQtde);

        // Limpa o prefixo do campo e deixa apenas o que veio após o asterisco em CAIXA ALTA
        const cleanRest = (rest || '').trimStart().toUpperCase();
        setInputBusca(cleanRest);
        setInputDescricao(cleanRest);
        setShowSuggestions(cleanRest.trim().length > 0);
        return;
      }
    }

    // Caso alternativo com split por asterisco
    if (rawVal.includes('*')) {
      const [qtd, ...restArr] = rawVal.split('*');
      const cleanQtd = qtd.trim().replace(',', '.');
      const num = parseFloat(cleanQtd);
      if (!isNaN(num) && num > 0 && cleanQtd !== '') {
        const formattedQtde = num.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setInputQtde(formattedQtde);
        const cleanRest = restArr.join('*').trimStart().toUpperCase();
        setInputBusca(cleanRest);
        setInputDescricao(cleanRest);
        setShowSuggestions(cleanRest.trim().length > 0);
        return;
      }
    }

    // Fluxo normal mantendo strings sempre em CAIXA ALTA
    const upperVal = rawVal.toUpperCase();
    setInputBusca(upperVal);
    setInputDescricao(upperVal);
    setShowSuggestions(upperVal.trim().length > 0);
  };

  // Selecionar um produto do autocomplete e saltar foco imediatamente para a Quantidade
  const handleSelectProduct = (prod: CatalogProduct) => {
    setSelectedProduct(prod);
    setInputCodigo(prod.code);
    setInputDescricao(prod.name);
    setInputUnidade(prod.unit);
    
    // Injeção compulsória do valor financeiro do objeto com base na tabela ativa no momento
    const precoTabela = calculatePriceByTable(prod, tabelaPreco);
    setInputPreco(precoTabela > 0 ? precoTabela.toFixed(2).replace('.', ',') : '0,00');
    setInputBusca(prod.name);
    
    // 1. FECHAMENTO IMEDIATO DA LISTA FLUTUANTE (SUGESTÕES)
    setShowSuggestions(false);
    setSelectedSuggestionIndex(0);

    // Auto-detectar contrato caso o item seja de prestação de serviços de silagem
    if (prod.code.startsWith('CTR-') || prod.name.includes('CONTRATO')) {
      setOperacaoTipo('contrato_silagem');
    }

    // 2. SALTO DE FOCO AUTOMÁTICO PARA O PRÓXIMO CAMPO ("QTDE") COM SELEÇÃO DO TEXTO
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 10);
  };

  // Manipulação do teclado no input de busca (OnKeyDown: ENTER, Setas Cima/Baixo, ESC)
  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (suggestedProducts.length > 0) {
        e.preventDefault();
        if (!showSuggestions) {
          setShowSuggestions(true);
        } else {
          setSelectedSuggestionIndex(prev => (prev + 1) % suggestedProducts.length);
        }
      }
    } else if (e.key === 'ArrowUp') {
      if (suggestedProducts.length > 0 && showSuggestions) {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev - 1 + suggestedProducts.length) % suggestedProducts.length);
      }
    } else if (e.key === 'Enter') {
      // 1. Se a lista de sugestões estiver aberta e houver itens, seleciona automaticamente o item ativo
      if (showSuggestions && suggestedProducts.length > 0) {
        e.preventDefault();
        const targetProd = suggestedProducts[selectedSuggestionIndex] || suggestedProducts[0];
        handleSelectProduct(targetProd);
      } else if (inputBusca.trim().length > 0) {
        // Se houver apenas 1 sugestão exata ou filtrada
        if (suggestedProducts.length === 1) {
          e.preventDefault();
          handleSelectProduct(suggestedProducts[0]);
        } else {
          // Se não houver lista aberta mas houver texto digitado, fecha e pula para o campo de quantidade
          e.preventDefault();
          setShowSuggestions(false);
          setTimeout(() => {
            qtyInputRef.current?.focus();
            qtyInputRef.current?.select();
          }, 10);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
    }
  };

  // Alteração reativa da tabela de preços em tempo real
  const handleTableChange = (newTable: PriceTable) => {
    setTabelaPreco(newTable);

    // Se já houver um produto selecionado na barra de inserção, recalcula e reflete instantaneamente
    let target = selectedProduct;
    if (!target) {
      const q = (inputDescricao || inputBusca || inputCodigo).trim().toLowerCase();
      if (q) {
        target = productCatalog.find(p => 
          p.code.toLowerCase() === q ||
          p.barcode.toLowerCase() === q ||
          p.name.toLowerCase() === q
        ) || (suggestedProducts.length > 0 ? suggestedProducts[0] : null);
      }
    }

    if (target) {
      const novoPreco = calculatePriceByTable(target, newTable);
      setInputPreco(novoPreco > 0 ? novoPreco.toFixed(2).replace('.', ',') : '0,00');
    }
  };

  // Função compartilhada para inserir o item com desconto autorizado
  const inserirItemComDesconto = (descontoFinal: number) => {
    let descResolved = (inputDescricao || inputBusca).trim().toUpperCase();
    if (!descResolved) {
      searchInputRef.current?.focus();
      return;
    }

    const qtd = parseFloat(inputQtde.replace(/\./g, '').replace(',', '.')) || 1;
    let preco = parseFloat(inputPreco.replace(/\./g, '').replace(',', '.')) || 0;
    let cod = inputCodigo;
    let un = inputUnidade.trim().toUpperCase() || 'UN';

    // Se o preço for 0 ou código não estiver preenchido, resolve produto do catálogo por código de barras, código ou nome
    if (preco <= 0 || !cod) {
      const q = (inputBusca || descResolved).trim().toLowerCase();
      const matched = productCatalog.find(p => 
        p.barcode.toLowerCase() === q ||
        p.code.toLowerCase() === q ||
        p.name.toLowerCase() === q
      ) || (suggestedProducts.length === 1 ? suggestedProducts[0] : null);

      if (matched) {
        cod = matched.code;
        descResolved = matched.name;
        un = matched.unit;
        preco = calculatePriceByTable(matched, tabelaPreco);
      }
    }

    const descPct = Math.max(0, descontoFinal);

    // Cálculo exato: Valor Total = Preço Unitário * Quantidade Atualizada
    const totalBruto = Math.round(qtd * preco * 100) / 100;
    const valorDesc = Math.round(totalBruto * (descPct / 100) * 100) / 100;
    const totalLiquido = Math.max(0, totalBruto - valorDesc);

    const resolvedProductId = selectedProduct?.id || (
      (() => {
        const q = (inputBusca || descResolved).trim().toLowerCase();
        const matched = productCatalog.find(p => 
          p.barcode.toLowerCase() === q ||
          p.code.toLowerCase() === q ||
          p.name.toLowerCase() === q ||
          (descResolved && p.name.trim().toLowerCase() === descResolved.trim().toLowerCase())
        ) || (suggestedProducts.length === 1 ? suggestedProducts[0] : null) ||
        stockItems.find((p: any) => 
          (p.codigo && String(p.codigo).toLowerCase() === q) ||
          (p.code && String(p.code).toLowerCase() === q) ||
          (p.nome_comercial && String(p.nome_comercial).toLowerCase() === q) ||
          (p.name && String(p.name).toLowerCase() === q) ||
          (p.item && String(p.item).toLowerCase() === q) ||
          (descResolved && (p.nome_comercial || p.name || p.item || '').trim().toLowerCase() === descResolved.trim().toLowerCase())
        );
        return matched?.id;
      })()
    );

    const matchedProductObj = productCatalog.find(p => String(p.id) === String(resolvedProductId)) || 
                              stockItems.find((p: any) => String(p.id) === String(resolvedProductId)) || 
                              selectedProduct;
    const chosenId = resolvedProductId ? String(resolvedProductId) : `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const cat = matchedProductObj?.category || (matchedProductObj as any)?.categoria || ((matchedProductObj as any)?.rawItem as any)?.category || ((matchedProductObj as any)?.rawItem as any)?.categoria || '';
    const finalCod = cod || (matchedProductObj as any)?.code || (matchedProductObj as any)?.codigo || `COD-${String(items.length + 1).padStart(3, '0')}`;

    const newItem: PdvItem = {
      id: chosenId,
      productId: resolvedProductId ? String(resolvedProductId) : undefined,
      codigo: finalCod,
      descricao: descResolved,
      unidade: un,
      quantidade: qtd,
      qtd: qtd,
      categoria: cat,
      category: cat,
      precoUnitario: preco,
      percentualDesconto: descPct,
      valorDesconto: valorDesc,
      totalBruto: totalBruto,
      totalLiquido: totalLiquido
    };

    setItems(prev => {
      const existingIdx = prev.findIndex(it => String(it.id) === String(chosenId));
      if (existingIdx >= 0) {
        const copy = [...prev];
        const existing = copy[existingIdx];
        const novaQtd = existing.quantidade + qtd;
        const novoTotalBruto = Math.round(novaQtd * preco * 100) / 100;
        const novoValorDesc = Math.round(novoTotalBruto * (descPct / 100) * 100) / 100;
        copy[existingIdx] = {
          ...existing,
          quantidade: novaQtd,
          qtd: novaQtd,
          totalBruto: novoTotalBruto,
          valorDesconto: novoValorDesc,
          totalLiquido: Math.max(0, novoTotalBruto - novoValorDesc)
        };
        return copy;
      }
      return [...prev, newItem];
    });

    // Seleciona o item recém inserido para exibição imediata da foto no painel direito
    setSelectedCartItemId(chosenId);

    // Limpar campos de entrada para o próximo item e resetar quantidade de volta para "1,00"
    setInputBusca('');
    setInputCodigo('');
    setInputDescricao('');
    setInputQtde('1,00');
    setInputPreco('0,00');
    setInputDesconto('0,00');
    setSelectedProduct(null);
    setShowSuggestions(false);
    setIsDiscountExceeded(false);
    setAttemptedDiscount(0);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Adicionar item à grade com validação rigorosa de teto de desconto por cargo
  const handleAdicionarItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let descResolved = (inputDescricao || inputBusca).trim().toUpperCase();
    if (!descResolved) {
      searchInputRef.current?.focus();
      return;
    }

    const descPct = parseFloat(inputDesconto.replace(',', '.')) || 0;

    // Se o desconto exceder o teto máximo permitido pelo perfil, abre o modal de autorização master
    if (attemptedDiscount > maxDiscountAllowed || descPct > maxDiscountAllowed) {
      const requested = attemptedDiscount > maxDiscountAllowed ? attemptedDiscount : descPct;
      setAttemptedDiscount(requested);
      setIsMasterAuthModalOpen(true);
      return;
    }

    inserirItemComDesconto(descPct);
  };

  // Confirmação de Autorização Master com Senha do Administrador
  const handleConfirmMasterAuth = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!masterPasswordInput.trim()) {
      setMasterAuthError('INFORME A SENHA DO ADMINISTRADOR.');
      return;
    }

    const isValid = validateAdminPassword(masterPasswordInput);
    if (!isValid) {
      setMasterAuthError('SENHA DO ADMINISTRADOR INCORRETA OU ACESSO NÃO AUTORIZADO.');
      return;
    }

    // Senha correta: libera o desconto maior exclusivamente para aquele item
    const authorizedPct = attemptedDiscount > 0 ? attemptedDiscount : (parseFloat(inputDesconto.replace(',', '.')) || maxDiscountAllowed);
    inserirItemComDesconto(authorizedPct);

    // Fecha o modal e limpa os campos
    setIsMasterAuthModalOpen(false);
    setMasterPasswordInput('');
    setMasterAuthError('');
  };

  const handleRemoverItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
    setSelectedCartItemId(prev => (prev === id ? null : prev));
  };

  // =========================================================================
  // MOTOR DE LOGÍSTICA DE FRETE MULTIVEÍCULO & CRUZA DE DADOS COM O DRE DA FROTA
  // =========================================================================
  const handleAdicionarFrete = () => {
    const selectedVeh = availableVehicles.find(v => v.id === veiculoFreteId) || availableVehicles[0];
    if (!selectedVeh && availableVehicles.length === 0) {
      setWarningMessage('NENHUM VEÍCULO DISPONÍVEL NA FROTA PARA VINCULAR FRETE.');
      setTimeout(() => setWarningMessage(null), 3500);
      return;
    }

    const taxa = parseFloat(valorTaxaFreteInput.replace(/\./g, '').replace(',', '.')) || 0;
    if (taxa <= 0) {
      setWarningMessage('INFORME O VALOR OU TAXA DO FRETE MAIOR QUE ZERO.');
      setTimeout(() => setWarningMessage(null), 3500);
      return;
    }

    let km = 0;
    let totalFrete = taxa;
    if (tipoCalculoFrete === 'km') {
      km = parseFloat(kmRodadosFreteInput.replace(/\./g, '').replace(',', '.')) || 0;
      if (km <= 0) {
        setWarningMessage('PARA CÁLCULO POR KM RODADO, INFORME A QUILOMETRAGEM PERCORRIDA.');
        setTimeout(() => setWarningMessage(null), 3500);
        return;
      }
      totalFrete = Math.round(taxa * km * 100) / 100;
    }

    const identText = selectedVeh 
      ? getVehicleIdentificationText(selectedVeh) 
      : `[FROTA] VEÍCULO ${veiculoFreteId}`;

    const novoFrete: FreteVinculadoItem = {
      id: `frete_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      veiculoId: selectedVeh?.id || veiculoFreteId || `veh_custom_${Date.now()}`,
      veiculoIdentificacao: identText,
      tipoCalculo: tipoCalculoFrete,
      valorUnitario: taxa,
      kmRodados: km,
      valorTotal: totalFrete
    };

    const updated = [...fretesVinculados, novoFrete];
    setFretesVinculados(updated);

    // Limpar campos de entrada para permitir vincular novos veículos
    setValorTaxaFreteInput('0,00');
    setValorTaxaFreteRaw('');
    setKmRodadosFreteInput('');

    // Ajustar valor recebido de forma reativa caso o usuário não tenha digitado valor manual divergente
    const freteTotalSum = updated.reduce((s, f) => s + f.valorTotal, 0);
    const novoLiquido = Math.max(0, totals.totalBruto - totals.totalDesconto) + freteTotalSum;
    setValorPagoInput(novoLiquido.toFixed(2).replace('.', ','));
  };

  const handleRemoverFrete = (freteId: string) => {
    const updated = fretesVinculados.filter(f => f.id !== freteId);
    setFretesVinculados(updated);
    const freteTotalSum = updated.reduce((s, f) => s + f.valorTotal, 0);
    const novoLiquido = Math.max(0, totals.totalBruto - totals.totalDesconto) + freteTotalSum;
    setValorPagoInput(novoLiquido.toFixed(2).replace('.', ','));
  };

  // Injeção automática da Receita Operacional Logística no DRE/Histórico do Veículo no LocalStorage
  const injectFreightRevenueIntoFleetVehicles = (
    fretes: FreteVinculadoItem[],
    orderNumber: string,
    clientName: string,
    dateStr: string
  ) => {
    if (!fretes || fretes.length === 0) return;

    try {
      const rawStored = localStorage.getItem('agrocontrol_frotas_veiculos') ||
                        localStorage.getItem('colaca_silagem_frotas_veiculos') ||
                        localStorage.getItem('agrocontrol_veiculos') ||
                        localStorage.getItem('agrocontrol_frotas');

      let vehiclesList: any[] = [];
      if (rawStored) {
        try { vehiclesList = JSON.parse(rawStored); } catch {}
      }
      if (!Array.isArray(vehiclesList) || vehiclesList.length === 0) {
        vehiclesList = getStoredMachineries();
      }

      const nowIso = new Date().toISOString();

      fretes.forEach(f => {
        const vIndex = vehiclesList.findIndex(v => 
          v.id === f.veiculoId || 
          (v.licensePlateOrSerial && f.veiculoIdentificacao.includes(v.licensePlateOrSerial)) ||
          (v.plate && f.veiculoIdentificacao.includes(v.plate))
        );

        const novaReceita = {
          id: `rec_frete_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          tipo: 'RECEITA_OPERACIONAL_LOGISTICA',
          categoria: 'Receita Operacional Logística',
          dreCategory: 'Faturamento de Fretes & Entregas de Silagem',
          descricao: `RECEITA OPERACIONAL LOGÍSTICA - FRETE PDV ${orderNumber}`,
          tipoCalculo: f.tipoCalculo === 'km' ? 'POR KM RODADO' : 'VALOR FIXO',
          valor: f.valorTotal,
          amount: f.valorTotal,
          dreGrossAmount: f.valorTotal,
          valorUnitario: f.valorUnitario,
          kmRodados: f.kmRodados,
          orderNumber: orderNumber,
          data: dateStr,
          date: dateStr,
          cliente: clientName,
          criadoEm: nowIso
        };

        if (vIndex >= 0) {
          const v = { ...vehiclesList[vIndex] };
          const existingDre = Array.isArray(v.dreEntries) ? v.dreEntries : [];
          const existingReceitas = Array.isArray(v.receitasOperacionais) ? v.receitasOperacionais : [];
          const existingHistory = Array.isArray(v.historicoDRE) ? v.historicoDRE : [];

          v.dreEntries = [novaReceita, ...existingDre];
          v.receitasOperacionais = [novaReceita, ...existingReceitas];
          v.historicoDRE = [novaReceita, ...existingHistory];
          v.accumulatedRevenue = (Number(v.accumulatedRevenue) || 0) + f.valorTotal;
          v.faturamentoTotal = (Number(v.faturamentoTotal) || 0) + f.valorTotal;

          vehiclesList[vIndex] = v;
        } else {
          const novoVeiculo = {
            id: f.veiculoId,
            name: f.veiculoIdentificacao,
            model: f.veiculoIdentificacao,
            brand: 'Frota AgroControl',
            licensePlateOrSerial: f.veiculoIdentificacao,
            plate: f.veiculoIdentificacao,
            status: 'operacional',
            dreEntries: [novaReceita],
            receitasOperacionais: [novaReceita],
            historicoDRE: [novaReceita],
            accumulatedRevenue: f.valorTotal,
            faturamentoTotal: f.valorTotal
          };
          vehiclesList.push(novoVeiculo);
        }
      });

      const serialized = JSON.stringify(vehiclesList);
      localStorage.setItem('agrocontrol_frotas_veiculos', serialized);
      localStorage.setItem('colaca_silagem_frotas_veiculos', serialized);
      localStorage.setItem('agrocontrol_veiculos', serialized);
      localStorage.setItem('agrocontrol_frotas', serialized);
      localStorage.setItem(STORAGE_KEYS.MACHINERIES, serialized);

      // Injetar também no array de pedidos/ordens de frete ('agrocontrol_pedidos') para consolidar no DRE
      try {
        const rawOrders = localStorage.getItem('agrocontrol_pedidos') || localStorage.getItem(STORAGE_KEYS.ORDERS);
        let ordersList: any[] = [];
        if (rawOrders) {
          try { ordersList = JSON.parse(rawOrders); } catch {}
        }
        if (!Array.isArray(ordersList)) ordersList = [];

        fretes.forEach(f => {
          ordersList.unshift({
            id: `ord_frete_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            orderNumber: `${orderNumber}-FRETE`,
            clientName: clientName,
            date: dateStr,
            machineryId: f.veiculoId,
            machineryPlateOrName: f.veiculoIdentificacao,
            freightCost: f.valorTotal,
            totalAmount: f.valorTotal,
            freightType: f.tipoCalculo === 'km' ? 'POR KM' : 'FIXO',
            distanceKm: f.kmRodados,
            notes: `Receita Operacional Logística vinculada ao cupom PDV ${orderNumber}`,
            status: 'concluido'
          });
        });

        const ordersJson = JSON.stringify(ordersList);
        localStorage.setItem('agrocontrol_pedidos', ordersJson);
        localStorage.setItem(STORAGE_KEYS.ORDERS, ordersJson);
        window.dispatchEvent(new CustomEvent('colaca_orders_updated', { detail: ordersList }));
      } catch (eOrd) {
        console.warn('Erro ao atualizar pedidos de frete:', eOrd);
      }

      // Disparar eventos de sincronização imediata
      window.dispatchEvent(new CustomEvent('agrocontrol_frotas_veiculos_updated', { detail: vehiclesList }));
      window.dispatchEvent(new CustomEvent('frotas_veiculos_updated', { detail: vehiclesList }));
      window.dispatchEvent(new CustomEvent('machineries_updated', { detail: vehiclesList }));
    } catch (e) {
      console.warn('Erro ao injetar receita operacional do frete:', e);
    }
  };

  // Limpar todo o PDV (F4)
  const handleLimparPdv = () => {
    setItems([]);
    setInputBusca('');
    setInputCodigo('');
    setInputDescricao('');
    setInputQtde('1,00');
    setInputPreco('0,00');
    setInputDesconto('0,00');
    setSelectedProduct(null);
    setValorPagoInput('');
    setClientSearch('CONSUMIDOR FINAL / BALCÃO');
    setSelectedClientId('');
    setOperacaoTipo('venda_balcao');
    setIsDiscountExceeded(false);
    setAttemptedDiscount(0);
    setFretesVinculados([]);
    setValorTaxaFreteInput('0,00');
    setValorTaxaFreteRaw('');
    setKmRodadosFreteInput('');
    setCurrentLoadedDraftId(null);
    try {
      localStorage.removeItem(PDV_DRAFT_KEY);
    } catch {}
    searchInputRef.current?.focus();
  };

  // =========================================================================
  // GESTÃO DE RASCUNHOS DE VENDA TEMPORÁRIOS ('agrocontrol_rascunhos_vendas')
  // =========================================================================
  // Disparar abertura da caixa de identificação para salvar rascunho
  const handleSaveVendaRascunho = () => {
    if (items.length === 0) {
      setWarningMessage('Nenhum item lançado no PDV para salvar como rascunho.');
      setTimeout(() => setWarningMessage(null), 3000);
      return;
    }
    const clientDesc = clientSearch && clientSearch !== 'CONSUMIDOR FINAL / BALCÃO'
      ? clientSearch.trim()
      : `Venda Balcão (${items.length} ${items.length === 1 ? 'item' : 'itens'})`;
    setDraftIdentificacaoInput(clientDesc);
    setIsSaveDraftModalOpen(true);
  };

  // Confirmar e persistir o rascunho em 'agrocontrol_rascunhos_vendas'
  const handleConfirmSaveDraft = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nomeFinal = draftIdentificacaoInput.trim();
    if (!nomeFinal) {
      setWarningMessage('Informe uma identificação para o rascunho.');
      setTimeout(() => setWarningMessage(null), 3000);
      return;
    }

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('pt-BR');
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const novoRascunho: VendaRascunho = {
      id: currentLoadedDraftId || `rasc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      identificacao: nomeFinal.toUpperCase(),
      data: dateFormatted,
      hora: timeFormatted,
      total: totals.totalLiquido,
      items: [...items],
      selectedClientId: selectedClientId || undefined,
      clientSearch: clientSearch,
      tabelaPreco: tabelaPreco,
      fretesVinculados: [...fretesVinculados],
      formaPagamento: formaPagamento,
      prazoCondicao: prazoCondicao,
      tipoCobranca: tipoCobranca,
      qtdeParcelas: qtdeParcelas,
      dataPrimeiraParcela: dataPrimeiraParcela,
      formatoImpressao: formatoImpressao,
      valorPagoInput: valorPagoInput,
      operacaoTipo: operacaoTipo
    };

    const existing = getStoredRascunhos();
    const filtered = existing.filter(r => r.id !== novoRascunho.id);
    const updated = [novoRascunho, ...filtered];

    saveStoredRascunhos(updated);
    setRascunhosSalvos(updated);
    setCurrentLoadedDraftId(null);
    setIsSaveDraftModalOpen(false);
    setIsCheckoutModalOpen(false);

    // Limpar a tela do PDV, deixando o caixa 100% livre e pronto para uma nova operação
    handleLimparPdv();
  };

  // Recuperar rascunho na tela do PDV
  const handleLoadDraft = (draft: VendaRascunho) => {
    setItems(draft.items || []);
    if (draft.fretesVinculados && Array.isArray(draft.fretesVinculados)) {
      setFretesVinculados(draft.fretesVinculados);
    } else {
      setFretesVinculados([]);
    }
    setSelectedClientId(draft.selectedClientId || '');
    setClientSearch(draft.clientSearch || 'CONSUMIDOR FINAL / BALCÃO');
    if (draft.tabelaPreco) setTabelaPreco(draft.tabelaPreco);
    if (draft.formaPagamento) setFormaPagamento(draft.formaPagamento);
    if (draft.prazoCondicao) setPrazoCondicao(draft.prazoCondicao);
    if (draft.tipoCobranca) setTipoCobranca(draft.tipoCobranca);
    if (draft.qtdeParcelas) setQtdeParcelas(draft.qtdeParcelas);
    if (draft.dataPrimeiraParcela) setDataPrimeiraParcela(draft.dataPrimeiraParcela);
    if (draft.formatoImpressao) setFormatoImpressao(draft.formatoImpressao);
    if (draft.valorPagoInput) setValorPagoInput(draft.valorPagoInput);
    if (draft.operacaoTipo) setOperacaoTipo(draft.operacaoTipo as any);

    setCurrentLoadedDraftId(draft.id);
    setIsRascunhosDropdownOpen(false);
    searchInputRef.current?.focus();
  };

  // Excluir rascunho
  const handleDeleteDraft = (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const existing = getStoredRascunhos();
    const updated = existing.filter(r => r.id !== draftId);
    saveStoredRascunhos(updated);
    setRascunhosSalvos(updated);
    if (currentLoadedDraftId === draftId) {
      setCurrentLoadedDraftId(null);
    }
  };

  // Acionamento Reativo e Foco Operacional no Botão "À VISTA"
  const handleAcionarAVista = () => {
    setFormaPagamento('a_vista');
    const formattedLiquido = totals.totalLiquido > 0 
      ? totals.totalLiquido.toFixed(2).replace('.', ',') 
      : '0,00';
    setValorPagoInput(formattedLiquido);

    setTimeout(() => {
      if (valorPagoInputRef.current) {
        valorPagoInputRef.current.focus();
        valorPagoInputRef.current.select();
      }
    }, 20);
  };

  // Abrir Janela Modal Centralizada de Fechamento do PDV (F2)
  const handleOpenCheckoutModal = () => {
    if (items.length === 0) {
      setWarningMessage('Nenhum item lançado no PDV. Insira ao menos um produto ou serviço antes de finalizar.');
      searchInputRef.current?.focus();
      setTimeout(() => setWarningMessage(null), 4000);
      return;
    }

    // Sincronizar o valor recebido padrão para o total líquido se estiver vazio ou zerado
    const formattedTotal = totals.totalLiquido > 0 ? totals.totalLiquido.toFixed(2).replace('.', ',') : '0,00';
    if (!valorPagoInput || parseFloat(valorPagoInput.replace(/\./g, '').replace(',', '.')) <= 0) {
      setValorPagoInput(formattedTotal);
    }

    setIsCheckoutModalOpen(true);

    // Se estiver em À VISTA (padrão de abertura), selecionar e focar automaticamente
    setTimeout(() => {
      if (valorPagoInputRef.current) {
        valorPagoInputRef.current.focus();
        valorPagoInputRef.current.select();
      }
    }, 50);
  };

  // Confirmar Venda 100% Offline e Executar Bypass de Impressão na aba '_blank'
  const handleConfirmarEImprimir = async () => {
    if (items.length === 0) return;

    try {
      const isContract = operacaoTipo === 'contrato_silagem' || items.some(it => 
        (it.codigo && it.codigo.startsWith('CTR-')) ||
        (it.descricao && (
          it.descricao.includes('CONTRATO') || 
          it.descricao.includes('PRESTAÇÃO') || 
          it.descricao.includes('ENSILAGEM')
        ))
      );

      const orderNum = isContract
        ? `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
        : `PDV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const dataFormatadaPtBr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const clientNameResolved = clientSearch.trim() || (isContract ? 'PRODUTOR RURAL (CONTRATO)' : 'CONSUMIDOR FINAL (PDV BALCÃO)');
      const clienteSelecionado = agroClientes.find(c => c.id === selectedClientId);
      const farmNameResolved = clienteSelecionado?.fazenda || (clienteSelecionado as any)?.farmName || "Venda Rápida Balcão PDV";

      const formaPagamentoAtiva = formaPagamento === 'prazo'
        ? 'A PRAZO'
        : formaPagamento === 'pix'
          ? 'PIX'
          : formaPagamento === 'cartao_credito'
            ? 'CARTÃO DE CRÉDITO'
            : formaPagamento === 'cartao_debito'
              ? 'CARTÃO DE DÉBITO'
              : 'A VISTA';

      const tipoCobrancaAtiva = formaPagamento === 'prazo'
        ? (tipoCobranca === 'carteira' ? 'CARTEIRA' : tipoCobranca === 'boleto' ? 'BOLETO' : String(tipoCobranca || '').toUpperCase())
        : '';

      const totalBruto = Number(totals.totalBruto || 0);
      const desconto = Number(totals.totalDesconto || 0);
      const totalLiquido = Number(totals.totalLiquido || 0);

      const carrinho = items.map(item => ({
        id: String(item.productId || item.id || ''),
        productId: item.productId ? String(item.productId) : undefined,
        codigo: String(item.codigo || ''),
        descricao: String(item.descricao || ''),
        qtd: Number(item.quantidade ?? (item as any).qtd ?? 1),
        precoUnitario: Number(item.precoUnitario || 0)
      }));

      // 1. ESTRUTURAÇÃO UNIFICADA DO OBJETO DA VENDA:
      const novaVenda: any = {
        id: Date.now().toString(), // Garante um ID único e estável para todas as tabelas
        numeroPedido: `PDV-${Math.floor(100000 + Math.random() * 900000)}`,
        data: dataFormatadaPtBr, // Formato padrão DD/MM/AAAA para bater com o filtro superior
        date: dateStr, // Formato AAAA-MM-DD para consultas ISO
        hora: timeStr,
        cliente: clienteSelecionado?.nome || clientSearch.trim() || "CONSUMIDOR FINAL / BALCÃO",
        clienteCpfCnpj: clienteSelecionado?.cpfCnpj || (clienteSelecionado as any)?.document || "",
        itens: carrinho.map(item => ({ 
          id: String(item.id), 
          codigo: String(item.codigo || ''),
          descricao: item.descricao, 
          qtd: Number(item.qtd), 
          precoUnitario: Number(item.precoUnitario), 
          totalItem: Number(item.qtd * item.precoUnitario) 
        })),
        totalBruto: Number(totalBruto),
        desconto: Number(desconto),
        totalLiquido: Number(totalLiquido),
        formaPagamento: formaPagamentoAtiva, // Ex: "A VISTA", "PIX", "A PRAZO"
        tipoCobranca: tipoCobrancaAtiva || "" // Ex: "CARTEIRA", "BOLETO"
      };

      // Aliases compatíveis para o Dashboard, Relatórios e Cupom:
      novaVenda.orderNumber = novaVenda.numeroPedido;
      novaVenda.numeroVenda = novaVenda.numeroPedido;
      novaVenda.data_formatada = dataFormatadaPtBr;
      novaVenda.valorBruto = Number(totalBruto);
      novaVenda.valorLiquido = Number(totalLiquido);
      novaVenda.totalAmount = Number(totalLiquido);
      novaVenda.clientName = novaVenda.cliente;
      novaVenda.clientId = selectedClientId || undefined;
      novaVenda.fazenda = farmNameResolved;
      novaVenda.farmName = farmNameResolved;
      novaVenda.status = formaPagamentoAtiva === "A PRAZO" ? "pendente" : "concluido";
      novaVenda.fretes = [...fretesVinculados];
      novaVenda.criadoEm = now.toISOString();
      novaVenda.createdAt = novaVenda.criadoEm;

      // 1. FORCE A GRAVAÇÃO PARALELA E SÍNCRONA DAS SEGUINTES CHAVES:

      // A) BLINDAGEM DO DASHBOARD VENDAS (PRINT 1):
      try {
        const vendasAtuais = JSON.parse(localStorage.getItem('agrocontrol_vendas') || '[]');
        vendasAtuais.unshift(novaVenda);
        localStorage.setItem('agrocontrol_vendas', JSON.stringify(vendasAtuais));
        localStorage.setItem('agrocontrol_pdv_vendas', JSON.stringify(vendasAtuais));
        localStorage.setItem('colaca_silagem_vendas_pdv', JSON.stringify(vendasAtuais));
        window.dispatchEvent(new CustomEvent('agrocontrol_vendas_updated', { detail: vendasAtuais }));
        window.dispatchEvent(new CustomEvent('agrocontrol_vendas_change', { detail: vendasAtuais }));
        window.dispatchEvent(new CustomEvent('vendas_updated', { detail: vendasAtuais }));
      } catch (e) {
        console.error("Erro Dashboard:", e);
      }

      // B) BAIXA REAL E UNIFICADA DO ESTOQUE (PRINT 2):
      try {
        const produtosAtuais = JSON.parse(localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos') || '[]');
        carrinho.forEach(item => {
          const pEstoque = produtosAtuais.find((p: any) => 
            (item.id && String(p.id) === String(item.id)) || 
            (item.productId && String(p.id) === String(item.productId)) ||
            (item.codigo && p.codigo && String(p.codigo).trim().toUpperCase() === String(item.codigo).trim().toUpperCase()) ||
            (item.codigo && String(p.id) === String(item.codigo)) ||
            (item.descricao && (p.nome_comercial || p.name || p.item) && String(p.nome_comercial || p.name || p.item).trim().toUpperCase() === String(item.descricao).trim().toUpperCase())
          );
          if (pEstoque && pEstoque.categoria !== "SERVIÇOS" && pEstoque.category !== "SERVIÇOS") {
            const qtdVenda = Number(item.qtd || (item as any).quantidade || 1);
            pEstoque.quantity = Number(pEstoque.quantity || pEstoque.quantidade_atual || 0) - qtdVenda;
            pEstoque.quantidade_atual = pEstoque.quantity;
          }
        });
        localStorage.setItem('agrocontrol_produtos', JSON.stringify(produtosAtuais));
        localStorage.setItem('colaca_silagem_estoque_produtos', JSON.stringify(produtosAtuais));
        saveStoredInventory(produtosAtuais);
        window.dispatchEvent(new CustomEvent('agrocontrol_produtos_updated', { detail: produtosAtuais }));
        window.dispatchEvent(new CustomEvent('colaca_silagem_estoque_produtos_updated', { detail: produtosAtuais }));
        window.dispatchEvent(new CustomEvent('silagem_inventory_changed', { detail: produtosAtuais }));
        window.dispatchEvent(new CustomEvent('silagem_inventory_updated', { detail: produtosAtuais }));
        window.dispatchEvent(new CustomEvent('inventory_updated', { detail: produtosAtuais }));
        setStockItems(produtosAtuais);
      } catch (e) {
        console.error("Erro Estoque:", e);
      }

      // C) INTEGRAÇÃO COMPULSÓRIA DO FINANCEIRO (PRINT 3):
      try {
        if (formaPagamentoAtiva !== "A PRAZO") {
          // Venda à vista (dinheiro ou PIX): lança receita imediatamente para alimentar os cards do Print 3
          const receitaItem = {
            id: `rec_${novaVenda.id}`,
            vendaId: novaVenda.id,
            numeroPedido: novaVenda.numeroPedido,
            data: novaVenda.data, // DD/MM/AAAA
            date: dateStr, // AAAA-MM-DD
            hora: novaVenda.hora,
            cliente: novaVenda.cliente,
            valor: Number(novaVenda.totalLiquido),
            totalLiquido: Number(novaVenda.totalLiquido),
            totalAmount: Number(novaVenda.totalLiquido),
            amount: Number(novaVenda.totalLiquido),
            formaPagamento: formaPagamentoAtiva,
            tipo: 'receita',
            type: 'entrada',
            status: 'liquidado',
            descricao: `Venda PDV à Vista - ${novaVenda.numeroPedido} - ${novaVenda.cliente}`,
            createdAt: now.toISOString()
          };

          try {
            const consolidado = JSON.parse(localStorage.getItem('agrocontrol_financeiro_consolidado') || '[]');
            consolidado.unshift(receitaItem);
            localStorage.setItem('agrocontrol_financeiro_consolidado', JSON.stringify(consolidado));
          } catch (eCons) {}

          try {
            const liquidadas = JSON.parse(localStorage.getItem('agrocontrol_receitas_liquidadas') || '[]');
            liquidadas.unshift(receitaItem);
            localStorage.setItem('agrocontrol_receitas_liquidadas', JSON.stringify(liquidadas));
          } catch (eLiq) {}

          window.dispatchEvent(new CustomEvent('agrocontrol_financeiro_consolidado_updated', { detail: receitaItem }));
          window.dispatchEvent(new CustomEvent('agrocontrol_receitas_liquidadas_updated', { detail: receitaItem }));

          // Conexão compulsória automática com o Caixa Operacional (Fluxo de Caixa):
          try {
            registrarVendaNoCaixa({
              id: novaVenda.id,
              numeroPedido: novaVenda.numeroPedido,
              cliente: novaVenda.cliente,
              valor: Number(novaVenda.totalLiquido),
              formaPagamento: formaPagamentoAtiva,
              dataHora: `${dataFormatadaPtBr} ${timeStr}`
            });
          } catch (eCx) {
            console.warn("Erro ao integrar com caixa operacional:", eCx);
          }
        } else {
          // Venda a prazo: insere na chave 'agrocontrol_financeiro_receber' com status "PENDENTE"
          const receberAtuais = JSON.parse(localStorage.getItem('agrocontrol_financeiro_receber') || localStorage.getItem('agrocontrol_receber') || '[]');
          receberAtuais.unshift({ 
            ...novaVenda, 
            status: "PENDENTE",
            tipo: "receber",
            valor: Number(novaVenda.totalLiquido),
            totalLiquido: Number(novaVenda.totalLiquido),
            totalAmount: Number(novaVenda.totalLiquido),
            amount: Number(novaVenda.totalLiquido),
            descricao: `Venda PDV a Prazo - ${novaVenda.numeroPedido} - ${novaVenda.cliente}`
          });
          localStorage.setItem('agrocontrol_financeiro_receber', JSON.stringify(receberAtuais));
          localStorage.setItem('agrocontrol_receber', JSON.stringify(receberAtuais));
          window.dispatchEvent(new CustomEvent('agrocontrol_financeiro_receber_updated', { detail: receberAtuais }));
          window.dispatchEvent(new CustomEvent('agrocontrol_receber_updated', { detail: receberAtuais }));
          window.dispatchEvent(new CustomEvent('financeiro_receber_updated', { detail: receberAtuais }));

          // Também registra no Caixa Operacional para apuração de Carteira / Boleto:
          try {
            registrarVendaNoCaixa({
              id: novaVenda.id,
              numeroPedido: novaVenda.numeroPedido,
              cliente: novaVenda.cliente,
              valor: Number(novaVenda.totalLiquido),
              formaPagamento: tipoCobrancaAtiva ? `A PRAZO (${tipoCobrancaAtiva})` : 'A PRAZO (CARTEIRA)',
              dataHora: `${dataFormatadaPtBr} ${timeStr}`
            });
          } catch (eCx) {
            console.warn("Erro ao integrar venda a prazo com caixa operacional:", eCx);
          }
        }
      } catch (eFin) {
        console.error("Erro Financeiro:", eFin);
      }

      // D) BLOCO RATEIO DE FRETE NA FROTA:
      try {
        if (fretesVinculados && fretesVinculados.length > 0) {
          const frotasAtuais = JSON.parse(localStorage.getItem('agrocontrol_frotas_veiculos') || localStorage.getItem('agrocontrol_frotas') || '[]');
          fretesVinculados.forEach((f: any) => {
            const veiculo = frotasAtuais.find((v: any) => String(v.id) === String(f.veiculoId || f.vehicleId));
            if (veiculo) {
              if (!veiculo.historico_receitas) veiculo.historico_receitas = [];
              veiculo.historico_receitas.push({ 
                data: novaVenda.data, 
                vendaId: novaVenda.id, 
                numeroPedido: novaVenda.numeroPedido,
                cliente: novaVenda.cliente,
                valor: Number(f.totalFrete || f.valorTotalFrete || 0) 
              });
            }
          });
          localStorage.setItem('agrocontrol_frotas_veiculos', JSON.stringify(frotasAtuais));
          localStorage.setItem('agrocontrol_frotas', JSON.stringify(frotasAtuais));
          try {
            injectFreightRevenueIntoFleetVehicles(fretesVinculados, novaVenda.numeroPedido, clientNameResolved, dateStr);
          } catch (errInj) {}
        }
      } catch (e) {
        console.error("Erro Frete Frota:", e);
      }

      // E) BLOCO HISTÓRICO DO CLIENTE SEM DUPLICIDADE:
      try {
        if (selectedClientId || novaVenda.cliente) {
          const clientesAtuais = JSON.parse(localStorage.getItem('agrocontrol_clientes') || localStorage.getItem('colaca_silagem_clientes') || '[]');
          const clienteIndex = clientesAtuais.findIndex((c: any) => 
            (selectedClientId && String(c.id) === String(selectedClientId)) ||
            (c.nome && c.nome.trim().toUpperCase() === String(novaVenda.cliente).trim().toUpperCase()) ||
            (c.name && c.name.trim().toUpperCase() === String(novaVenda.cliente).trim().toUpperCase())
          );

          if (clienteIndex >= 0) {
            const cli = clientesAtuais[clienteIndex];
            if (!cli.historico_vendas) cli.historico_vendas = [];
            const jaConsta = cli.historico_vendas.some((v: any) => v.id === novaVenda.id || v.numeroPedido === novaVenda.numeroPedido);
            if (!jaConsta) {
              cli.historico_vendas.unshift(novaVenda);
              if (!cli.historico_compras) cli.historico_compras = [];
              cli.historico_compras.unshift(novaVenda);
              cli.ultimaCompra = novaVenda.data;
              cli.totalGasto = Number(cli.totalGasto || 0) + Number(novaVenda.totalLiquido || 0);

              localStorage.setItem('agrocontrol_clientes', JSON.stringify(clientesAtuais));
              localStorage.setItem('colaca_silagem_clientes', JSON.stringify(clientesAtuais));
              window.dispatchEvent(new CustomEvent('agrocontrol_clientes_updated', { detail: clientesAtuais }));
            }
          }
        }
      } catch (e) {
        console.error("Erro Cliente:", e);
      }

      // Persistência em Serviços e Vendas (para alimentar instantaneamente o Dashboard de Vendas do Print 1)
      try {
        const totalTons = items.reduce((acc, it) => (it.unidade && it.unidade.includes('TON')) ? acc + it.quantidade : acc, 0);
        const totalHa = items.reduce((acc, it) => (it.unidade && it.unidade.includes('HA')) ? acc + it.quantidade : acc, 0);

        const newSaleOrder: ServiceOrder = {
          id: novaVenda.id,
          orderNumber: novaVenda.numeroPedido,
          clientName: clientNameResolved,
          clientId: selectedClientId || undefined,
          farmName: farmNameResolved,
          serviceTab: 'venda',
          serviceType: isContract ? 'Contrato de Prestação de Serviços de Silagem' : 'Venda Balcão PDV',
          date: dateStr,
          startDate: dateStr,
          completionDate: dateStr,
          status: formaPagamentoAtiva === 'A PRAZO' ? 'em_andamento' : 'concluido',
          ratePerUnit: totals.totalLiquido,
          totalAmount: totals.totalLiquido,
          tonsEstimated: totalTons > 0 ? totalTons : undefined,
          areaQuantity: totalHa > 0 ? totalHa : undefined,
          areaUnit: totalHa > 0 ? 'hectares' : undefined,
          notes: `${isContract ? 'Contrato de Prestação de Serviços' : 'Venda Balcão PDV'} • Pagamento: ${formaPagamentoAtiva} • Produtor/Cliente: ${clientNameResolved} • Fazenda: ${farmNameResolved} • Itens: ${items.map(i => `${i.quantidade} ${i.unidade || 'UN'} - ${i.descricao}`).join('; ')}`,
        };

        const rawServices = localStorage.getItem('colaca_silagem_services') || localStorage.getItem('agrocontrol_servicos');
        const parsed = rawServices ? JSON.parse(rawServices) : [];
        const existingServices = Array.isArray(parsed) ? parsed : [];
        if (!existingServices.some(s => s.id === newSaleOrder.id || s.orderNumber === newSaleOrder.orderNumber)) {
          const updated = [newSaleOrder, ...existingServices];
          localStorage.setItem('colaca_silagem_services', JSON.stringify(updated));
          localStorage.setItem('agrocontrol_servicos', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('colaca_services_updated', { detail: updated }));
          window.dispatchEvent(new CustomEvent('agrocontrol_servicos_updated', { detail: updated }));
        }

        onSaveService(newSaleOrder);
      } catch (eServ) {
        console.warn('Erro ao persistir serviço de venda:', eServ);
      }

      const cobrancaLabel = tipoCobranca === 'carteira' ? 'CARTEIRA (CONTA INTERNA)' : 'BOLETO BANCÁRIO';
      const formaLabelMap: Record<string, string> = {
        a_vista: 'À VISTA (DINHEIRO)',
        cartao_debito: 'CARTÃO DE DÉBITO',
        cartao_credito: 'CARTÃO DE CRÉDITO',
        pix: 'PIX INSTANTÂNEO',
        prazo: `A PRAZO [${cobrancaLabel}] (${prazoCondicao} - ${qtdeParcelas}x)`
      };

      const saleRecord = {
        orderNumber: novaVenda.numeroPedido,
        date: formatDateBR(dateStr),
        time: timeStr,
        client: clientNameResolved,
        clientId: selectedClientId || undefined,
        farmName: farmNameResolved,
        items: [...items],
        totalBruto: totals.totalBruto,
        totalDesconto: totals.totalDesconto,
        totalFrete: totals.totalFrete,
        totalLiquido: totals.totalLiquido,
        forma: formaLabelMap[formaPagamento] || formaPagamentoAtiva,
        tipoCobranca: formaPagamento === 'prazo' ? cobrancaLabel : undefined,
        bancoEmissor: formaPagamento === 'prazo' && tipoCobranca === 'boleto' ? prioritaryAccount.rawText : undefined,
        formatoImpressao: formatoImpressao,
        valorPago: totals.valorPago,
        troco: totals.troco,
        parcelas: formaPagamento === 'prazo' ? [...parcelas] : undefined,
        fretes: [...fretesVinculados]
      };

      // Excluir automaticamente este rascunho específico do banco local ao concluir a venda para evitar duplicidades
      if (currentLoadedDraftId) {
        try {
          const existingDrafts = getStoredRascunhos();
          const updatedDrafts = existingDrafts.filter(r => r.id !== currentLoadedDraftId);
          saveStoredRascunhos(updatedDrafts);
          setRascunhosSalvos(updatedDrafts);
        } catch (errDraft) {
          console.warn('Erro ao atualizar rascunhos salvos:', errDraft);
        }
      }

      // 3. LIMPEZA E EMISSÃO DE DOCUMENTOS:
      setLastFinishedSale(saleRecord);
      setActivePrintFormat(formatoImpressao);
      setIsCheckoutModalOpen(false);
      handleLimparPdv();
      exitPdvFullscreen();

      // Decolagem da nova aba de impressão casada (A4 ou 80mm)
      try {
        const printHtml = generatePrintableSaleHtml(saleRecord, formatoImpressao, companyProfile);
        const printWindow = window.open('', '_blank');
        if (printWindow && printWindow.document) {
          printWindow.document.open();
          printWindow.document.write(printHtml);
          printWindow.document.close();
        } else {
          setIsReceiptOpen(true);
        }
      } catch (e) {
        console.warn('Aviso de impressão de pop-up:', e);
        setIsReceiptOpen(true);
      }

      // Retorno do cursor piscando para o campo de descrição de produtos [F3]
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }, 60);

    } catch (error) {
      console.error('Erro ao finalizar venda PDV:', error);
      handleLimparPdv();
      setIsCheckoutModalOpen(false);
      exitPdvFullscreen();
    }
  };

  // Teclas de Atalho do PDV Base (F2, F3, F4, F5, Esc) - Ativo quando o modal de fechamento NÃO está aberto
  useEffect(() => {
    if (isCheckoutModalOpen) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // F2: Finalizar Venda (Abre modal de fechamento)
      if (e.key === 'F2') {
        e.preventDefault();
        handleOpenCheckoutModal();
      }
      // Esc: Fechar Comprovante ou sair da Tela Cheia
      else if (e.key === 'Escape') {
        if (isReceiptOpen) {
          e.preventDefault();
          setIsReceiptOpen(false);
        } else if (isPdvFullscreen) {
          e.preventDefault();
          exitPdvFullscreen();
        }
      }
      // F3: Focar Busca de Produtos
      else if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // F4: Cancelar / Limpar Venda
      else if (e.key === 'F4') {
        e.preventDefault();
        if (items.length === 0) {
          handleLimparPdv();
          return;
        }
        const isConfirmed = await confirmDialog({
          title: 'Limpar Frente de Caixa',
          message: 'Deseja realmente cancelar e limpar todos os itens deste cupom de venda?',
          confirmLabel: 'Limpar Caixa',
          cancelLabel: 'Manter Itens',
          variant: 'danger',
        });
        if (isConfirmed) {
          handleLimparPdv();
        }
      }
      // F5: Cupom / Espelho de Venda
      else if (e.key === 'F5') {
        e.preventDefault();
        if (lastFinishedSale) {
          setActivePrintFormat(formatoImpressao);
          setIsReceiptOpen(true);
        } else if (items.length > 0) {
          handlePrintSafe();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, lastFinishedSale, confirmDialog, formatoImpressao, isCheckoutModalOpen, isReceiptOpen, isPdvFullscreen]);

  // =========================================================================
  // OUVINTE EXCLUSIVO DE ATALHOS NO MODAL 'CONCLUIR E EMITIR COMPROVANTE'
  // Ativo exclusivamente quando 'isCheckoutModalOpen' estiver aberto
  // =========================================================================
  useEffect(() => {
    if (!isCheckoutModalOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      // [F2] FINALIZAR VENDA E IMPRIMIR
      if (e.key === 'F2') {
        e.preventDefault();
        handleConfirmarEImprimir();
      }
      // [ESC] CANCELAR / VOLTAR AO PDV
      else if (e.key === 'Escape') {
        e.preventDefault();
        if (isSaveDraftModalOpen) {
          setIsSaveDraftModalOpen(false);
        } else {
          setIsCheckoutModalOpen(false);
        }
      }
      // [F4] SALVAR RASCUNHO VENDA
      else if (e.key === 'F4') {
        e.preventDefault();
        handleSaveVendaRascunho();
      }
      // [F5] À VISTA
      else if (e.key === 'F5') {
        e.preventDefault();
        handleAcionarAVista();
      }
      // [F6] PIX
      else if (e.key === 'F6') {
        e.preventDefault();
        setFormaPagamento('pix');
        setTimeout(() => {
          valorPagoInputRef.current?.focus();
          valorPagoInputRef.current?.select();
        }, 30);
      }
      // [F7] DÉBITO
      else if (e.key === 'F7') {
        e.preventDefault();
        setFormaPagamento('cartao_debito');
        setTimeout(() => {
          valorPagoInputRef.current?.focus();
          valorPagoInputRef.current?.select();
        }, 30);
      }
      // [F8] CRÉDITO
      else if (e.key === 'F8') {
        e.preventDefault();
        setFormaPagamento('cartao_credito');
        setTimeout(() => {
          valorPagoInputRef.current?.focus();
          valorPagoInputRef.current?.select();
        }, 30);
      }
      // [F9] A PRAZO
      else if (e.key === 'F9') {
        e.preventDefault();
        setFormaPagamento('prazo');
      }
      // [F10] ALTERNAR FORMATO DE IMPRESSÃO (A4 <-> TÉRMICA 80MM)
      else if (e.key === 'F10') {
        e.preventDefault();
        setFormatoImpressao(prev => (prev === 'a4' ? 'termica' : 'a4'));
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isCheckoutModalOpen, isSaveDraftModalOpen, handleConfirmarEImprimir, handleSaveVendaRascunho, handleAcionarAVista]);

  // Funções Anti-Sandbox para Impressão, Download e Cópia Segura
  const handlePrintSafe = () => {
    try {
      window.print();
    } catch (err) {
      console.warn('Sandbox restrita para window.print():', err);
    }
  };

  const handleCopyComprovante = () => {
    if (!lastFinishedSale) return;
    try {
      const isA4 = activePrintFormat === 'a4';
      const text = `================================================
${companyProfile?.name || 'AGROCONTROL • SOLUÇÕES AGRÍCOLAS & FORRAGENS'}
${companyProfile?.cnpjCpf || companyProfile?.cnpj ? `CNPJ/CPF: ${companyProfile.cnpjCpf || companyProfile.cnpj}` : ''}
${isA4 ? 'NOTA DE VENDA & ESPELHO DE PEDIDO DE BALCÃO (A4)' : 'CUPOM NÃO FISCAL DE VENDA (80MM)'}
================================================
PEDIDO Nº: ${lastFinishedSale.orderNumber}
DATA/HORA: ${lastFinishedSale.date} às ${lastFinishedSale.time}
CLIENTE:   ${lastFinishedSale.client}
${lastFinishedSale.farmName ? `FAZENDA:   ${lastFinishedSale.farmName}\n` : ''}PAGAMENTO: ${lastFinishedSale.forma}
${lastFinishedSale.tipoCobranca ? `COBRANÇA:  ${lastFinishedSale.tipoCobranca}\n` : ''}${lastFinishedSale.bancoEmissor ? `BANCO:     ${lastFinishedSale.bancoEmissor}\n` : ''}------------------------------------------------
ITENS DO PEDIDO:
${lastFinishedSale.items.map((it, idx) => `${idx + 1}. [${it.codigo}] ${it.quantidade} ${it.unidade} - ${it.descricao} | Unit: ${formatCurrencyBRL(it.precoUnitario)} | Total: ${formatCurrencyBRL(it.totalLiquido)}`).join('\n')}
------------------------------------------------
SUBTOTAL BRUTO: ${formatCurrencyBRL(lastFinishedSale.totalBruto)}
DESCONTO:       ${formatCurrencyBRL(lastFinishedSale.totalDesconto)}
TOTAL LÍQUIDO:  ${formatCurrencyBRL(lastFinishedSale.totalLiquido)}
${lastFinishedSale.troco > 0 ? `TROCO:          ${formatCurrencyBRL(lastFinishedSale.troco)}\n` : ''}${lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 ? `\nPROGRAMAÇÃO DE PARCELAS:\n` + lastFinishedSale.parcelas.map(p => `• Parcela ${p.numero} (${formatDateBR(p.vencimento)}): ${formatCurrencyBRL(p.valor)}`).join('\n') : ''}
================================================
AGROCONTROL - GESTÃO AGRÍCOLA INTELIGENTE
`;
      navigator.clipboard.writeText(text);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2500);
    } catch (err) {
      console.warn('Erro ao copiar comprovante:', err);
    }
  };

  const handleDownloadComprovante = () => {
    if (!lastFinishedSale) return;
    try {
      const isA4 = activePrintFormat === 'a4';
      const text = `================================================
${companyProfile?.name || 'AGROCONTROL • SOLUÇÕES AGRÍCOLAS & FORRAGENS'}
${companyProfile?.cnpjCpf || companyProfile?.cnpj ? `CNPJ/CPF: ${companyProfile.cnpjCpf || companyProfile.cnpj}` : ''}
${isA4 ? 'NOTA DE VENDA & ESPELHO DE PEDIDO DE BALCÃO (A4)' : 'CUPOM NÃO FISCAL DE VENDA (80MM)'}
================================================
PEDIDO Nº: ${lastFinishedSale.orderNumber}
DATA/HORA: ${lastFinishedSale.date} às ${lastFinishedSale.time}
CLIENTE:   ${lastFinishedSale.client}
${lastFinishedSale.farmName ? `FAZENDA:   ${lastFinishedSale.farmName}\n` : ''}PAGAMENTO: ${lastFinishedSale.forma}
${lastFinishedSale.tipoCobranca ? `COBRANÇA:  ${lastFinishedSale.tipoCobranca}\n` : ''}${lastFinishedSale.bancoEmissor ? `BANCO:     ${lastFinishedSale.bancoEmissor}\n` : ''}------------------------------------------------
ITENS DO PEDIDO:
${lastFinishedSale.items.map((it, idx) => `${idx + 1}. [${it.codigo}] ${it.quantidade} ${it.unidade} - ${it.descricao} | Unit: ${formatCurrencyBRL(it.precoUnitario)} | Total: ${formatCurrencyBRL(it.totalLiquido)}`).join('\n')}
------------------------------------------------
SUBTOTAL BRUTO: ${formatCurrencyBRL(lastFinishedSale.totalBruto)}
DESCONTO:       ${formatCurrencyBRL(lastFinishedSale.totalDesconto)}
TOTAL LÍQUIDO:  ${formatCurrencyBRL(lastFinishedSale.totalLiquido)}
${lastFinishedSale.troco > 0 ? `TROCO:          ${formatCurrencyBRL(lastFinishedSale.troco)}\n` : ''}${lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 ? `\nPROGRAMAÇÃO DE PARCELAS:\n` + lastFinishedSale.parcelas.map(p => `• Parcela ${p.numero} (${formatDateBR(p.vencimento)}): ${formatCurrencyBRL(p.valor)}`).join('\n') : ''}
================================================
AGROCONTROL - GESTÃO AGRÍCOLA INTELIGENTE
`;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${isA4 ? 'espelho_a4' : 'cupom_80mm'}_${lastFinishedSale.orderNumber}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Erro ao baixar comprovante:', err);
    }
  };

  return (
    <div 
      id="pdv-frente-de-caixa-container"
      className={`w-full ${isPdvFullscreen ? 'h-full max-h-none py-1' : 'h-[calc(100vh-175px)] max-h-[calc(100vh-170px)]'} flex flex-col justify-between overflow-hidden global antialiased select-none gap-1.5`}
    >
      {/* Alerta Não-Bloqueante de Validação */}
      {warningMessage && (
        <div className="p-2 rounded-lg bg-amber-500 text-amber-950 font-bold text-xs flex items-center justify-between shadow-xs border border-amber-600 animate-in fade-in duration-150 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{warningMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setWarningMessage(null)}
            className="p-0.5 hover:bg-amber-600/30 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          1. PAINEL SUPERIOR DE ENTRADA (MOLDURA BEGE/CINZA 3D)
         ===================================================================== */}
      <section 
        aria-label="Painel Superior de Entrada PDV"
        className="p-1.5 sm:p-2 bg-gradient-to-b from-stone-100 via-stone-50 to-stone-200 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-xl border border-stone-300 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.1)] shrink-0"
      >
        <form onSubmit={handleAdicionarItem} className="space-y-1.5">
          {/* Linha de Identificação de Operação, Cliente (Agrocontrol) & Atalhos Rápidos */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-stone-300">
            {/* Seletor Rápido de Modo de Operação (Venda Balcão) + Botão de Expansão Tela Cheia VENDA PDV */}
            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-stone-800 p-0.5 rounded-md border border-slate-300 dark:border-stone-700 shrink-0">
              <button
                type="button"
                onClick={() => setOperacaoTipo('venda_balcao')}
                className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded transition cursor-pointer flex items-center gap-1 ${
                  operacaoTipo === 'venda_balcao'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-700 dark:text-stone-300 hover:bg-slate-300/60 dark:hover:bg-stone-700'
                }`}
                title="Venda Rápida de Balcão (PDV)"
              >
                <ShoppingCart className="w-3 h-3" />
                <span>VENDA BALCÃO</span>
              </button>

              <button
                type="button"
                onClick={togglePdvFullscreen}
                className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded transition cursor-pointer flex items-center gap-1 border shadow-[inset_1px_1px_0px_rgba(255,255,255,0.7)] ${
                  isPdvFullscreen
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs font-black ring-1 ring-emerald-400'
                    : 'bg-gradient-to-b from-slate-100 via-white to-slate-200 text-slate-800 border-slate-300 dark:from-stone-800 dark:to-stone-900 dark:text-white dark:border-stone-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title={isPdvFullscreen ? "Sair do Modo Tela Cheia (Restaurar Menus)" : "Ativar Modo Expansão Tela Cheia (Foco Total de Caixa)"}
              >
                <span>{isPdvFullscreen ? '✕ SAIR TELA CHEIA' : '📟 VENDA PDV'}</span>
              </button>
            </div>

            {/* Campo CLIENTE: Seleção Reativa de Produtores Rurais do LocalStorage (agrocontrol_clientes) */}
            <div ref={clientDropdownRef} className="relative flex items-center gap-1.5 flex-1 min-w-[280px]">
              <span className="font-extrabold uppercase text-[10px] text-slate-600 dark:text-stone-400 shrink-0 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-600 dark:text-stone-300" />
                CLIENTE:
              </span>
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value.toUpperCase());
                    setShowClientSuggestions(true);
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  placeholder="CONSUMIDOR FINAL / BALCÃO (OU BUSQUE O PRODUTOR RURAL...)"
                  className="w-full pl-2 pr-12 py-0.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold uppercase tracking-wide focus:ring-1 focus:ring-sky-500 outline-none"
                />

                <div className="absolute right-1 flex items-center gap-0.5">
                  {clientSearch && clientSearch !== 'CONSUMIDOR FINAL / BALCÃO' && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientSearch('CONSUMIDOR FINAL / BALCÃO');
                        setSelectedClientId('');
                        setShowClientSuggestions(false);
                      }}
                      title="Voltar para Consumidor Final"
                      className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowClientSuggestions(prev => !prev)}
                    title="Listar Produtores Rurais / Clientes"
                    className="p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-stone-200 transition cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sugestões Reativas de Produtores Rurais / Clientes (agrocontrol_clientes) */}
              {showClientSuggestions && (
                <div className="absolute top-full left-16 right-0 z-50 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-xl max-h-56 overflow-y-auto mt-0.5 divide-y divide-slate-100 dark:divide-stone-800">
                  {/* Opção Rápida: Consumidor Final */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientId('');
                      setClientSearch('CONSUMIDOR FINAL / BALCÃO');
                      setShowClientSuggestions(false);
                      searchInputRef.current?.focus();
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-sky-50 dark:hover:bg-stone-800 flex items-center justify-between transition cursor-pointer bg-slate-50/70 dark:bg-stone-850"
                  >
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-sky-600" />
                      <span className="font-extrabold text-sky-900 dark:text-sky-300 uppercase">
                        CONSUMIDOR FINAL / BALCÃO
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-stone-400 font-semibold uppercase">
                      Venda Rápida
                    </span>
                  </button>

                  {/* Lista de Produtores Rurais Cadastrados no LocalStorage */}
                  {suggestedClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClientId(c.id);
                        const name = (c.nome || c.name || '').toUpperCase();
                        const farm = (c.fazenda || c.farmName || '').toUpperCase();
                        setClientSearch(farm ? `${name} (${farm})` : name);
                        setShowClientSuggestions(false);
                        searchInputRef.current?.focus();
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-emerald-50 dark:hover:bg-stone-800 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-zinc-900 dark:text-white truncate uppercase">
                          {c.nome || c.name}
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold truncate uppercase">
                          {c.fazenda || c.farmName ? `Fazenda: ${c.fazenda || c.farmName}` : 'Produtor Rural'}
                          {c.city || c.cidade ? ` • ${c.city || c.cidade}` : ''}
                          {c.cpfCnpj ? ` • ${c.cpfCnpj}` : ''}
                        </span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black uppercase shrink-0">
                        PRODUTOR RURAL
                      </span>
                    </button>
                  ))}

                  {suggestedClients.length === 0 && clientSearch && clientSearch !== 'CONSUMIDOR FINAL / BALCÃO' && (
                    <div className="px-3 py-2 text-xs text-slate-500 dark:text-stone-400 text-center font-medium">
                      Nenhum produtor rural encontrado para "{clientSearch}".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Teclas de Apoio Operacional & Botão Dropdown Slim RASCUNHOS SALVOS */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Botão Seletor Dropdown Slim: 📜 RASCUNHOS SALVOS */}
              <div ref={rascunhosDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsRascunhosDropdownOpen(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-black bg-gradient-to-b from-amber-100 via-amber-50 to-amber-100 dark:from-stone-800 dark:to-stone-900 text-amber-950 dark:text-amber-300 border border-amber-400/90 shadow-2xs hover:bg-amber-200 transition cursor-pointer whitespace-nowrap uppercase"
                  title="Listar rascunhos de venda temporários salvos no caixa"
                >
                  <span>📜 RASCUNHOS SALVOS</span>
                  {rascunhosSalvos.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[9px] font-black font-mono">
                      {rascunhosSalvos.length}
                    </span>
                  )}
                  <ChevronDown className={`w-3 h-3 text-amber-700 dark:text-amber-400 transition-transform ${isRascunhosDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRascunhosDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-80 sm:w-96 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-stone-800 animate-in fade-in duration-100">
                    <div className="px-3 py-1.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white text-[10px] font-black uppercase flex items-center justify-between shadow-xs">
                      <span>📜 RASCUNHOS SALVOS NO CAIXA</span>
                      <span className="font-mono text-amber-100">{rascunhosSalvos.length} {rascunhosSalvos.length === 1 ? 'REGISTRO' : 'REGISTROS'}</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto no-scrollbar divide-y divide-slate-100 dark:divide-stone-800">
                      {rascunhosSalvos.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 dark:text-stone-400 font-medium">
                          Nenhum rascunho de venda salvo no momento.
                        </div>
                      ) : (
                        rascunhosSalvos.map((draft) => (
                          <div
                            key={draft.id}
                            onClick={() => handleLoadDraft(draft)}
                            className="p-2.5 hover:bg-amber-50 dark:hover:bg-stone-800 flex items-center justify-between cursor-pointer transition text-left group"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-black uppercase text-zinc-900 dark:text-white truncate group-hover:text-amber-700 dark:group-hover:text-amber-400">
                                {draft.identificacao}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                                <span>📅 {draft.data} {draft.hora ? `• ${draft.hora}` : ''}</span>
                                <span>• {draft.items?.length || 0} {draft.items?.length === 1 ? 'item' : 'itens'}</span>
                                {draft.fretesVinculados && draft.fretesVinculados.length > 0 && (
                                  <span className="text-sky-600 dark:text-sky-400 font-semibold">• 🚚 {draft.fretesVinculados.length} veíc.</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-400">
                                {formatCurrencyBRL(draft.total)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteDraft(draft.id, e)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title="Excluir rascunho"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Indicador de Rascunho Ativo */}
              {currentLoadedDraftId && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase animate-pulse">
                  <span>EDITANDO RASCUNHO</span>
                  <button
                    type="button"
                    onClick={() => setCurrentLoadedDraftId(null)}
                    title="Desvincular rascunho"
                    className="ml-0.5 hover:text-rose-600"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-stone-400">
                <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F3] BUSCA</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[ENTER] INSERIR</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F2] FINALIZAR</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 font-mono font-bold text-slate-700 dark:text-stone-300">[F4] LIMPAR</span>
              </div>

              {isPdvFullscreen && (
                <button
                  type="button"
                  onClick={exitPdvFullscreen}
                  className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 shadow-2xs transition cursor-pointer flex items-center gap-1 shrink-0 ml-1"
                  title="Sair do modo tela cheia e restaurar menus laterais (ESC)"
                >
                  <X className="w-3 h-3" />
                  <span>✕ SAIR TELA CHEIA (ESC)</span>
                </button>
              )}
            </div>
          </div>

          {/* Grid de Inputs Horizontais Estilo Supermercado */}
          <div className="grid grid-cols-12 gap-1.5 items-end">
            {/* 1. DESCRIÇÃO / CÓD. / REFERÊNCIA COM FOCO AUTOMÁTICO (F3) */}
            <div ref={productSearchContainerRef} className="col-span-12 sm:col-span-4 relative">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 flex items-center justify-between">
                <span>DESCRIÇÃO / CÓDIGO / REFERÊNCIA [F3]</span>
                <Barcode className="w-3.5 h-3.5 text-slate-400" />
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  value={inputBusca}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchInputKeyDown}
                  onFocus={() => {
                    if (inputBusca.trim().length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  placeholder="DIGITE O NOME, CÓDIGO OU PASSE O LEITOR DE CÓDIGO DE BARRAS..."
                  className="w-full pl-2 pr-7 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none placeholder:normal-case placeholder:font-medium placeholder:text-slate-400"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Sugestões de produtos com valor financeiro em tempo real */}
              {showSuggestions && suggestedProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-0.5 divide-y divide-slate-100 dark:divide-stone-800">
                  {suggestedProducts.map((p, idx) => {
                    const precoCalculado = calculatePriceByTable(p, tabelaPreco);
                    const isSelected = idx === selectedSuggestionIndex;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                        onClick={() => handleSelectProduct(p)}
                        className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-sky-100 dark:bg-sky-950/70 border-l-4 border-sky-600 pl-1.5'
                            : 'hover:bg-sky-50 dark:hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {(p.fotoUrl || p.imagemBase64 || p.rawItem?.fotoUrl || p.rawItem?.imagemBase64) && (
                            <img
                              src={p.fotoUrl || p.imagemBase64 || p.rawItem?.fotoUrl || p.rawItem?.imagemBase64}
                              alt={p.name}
                              className="w-5 h-5 rounded object-cover shrink-0 border border-slate-300 dark:border-stone-700 bg-white"
                            />
                          )}
                          <span className="font-mono text-[10px] font-bold text-slate-500">[{p.code}]</span>
                          <span className="font-bold text-zinc-900 dark:text-white truncate">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-semibold text-slate-500">{p.unit}</span>
                          <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrencyBRL(precoCalculado)}</strong>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. QTDE (Q) */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5">
                QTDE (Q)
              </label>
              <input
                ref={qtyInputRef}
                type="text"
                value={inputQtde}
                onChange={e => setInputQtde(e.target.value)}
                onFocus={e => e.target.select()}
                className="w-full text-center px-1 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                placeholder="1,00"
              />
            </div>

            {/* 3. UNIDADE */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-center">
                UN
              </label>
              <input
                type="text"
                value={inputUnidade}
                onChange={e => setInputUnidade(e.target.value.toUpperCase())}
                className="w-full text-center px-1 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                placeholder="UN"
              />
            </div>

            {/* 4. BLOCO COMBINADO: SELETOR MICRO-SLIM + PREÇO (R$) */}
            <div className="col-span-8 sm:col-span-3">
              <div className="flex items-end gap-1.5">
                {/* Seletor Micro-Slim de Tabela de Preços (Sistema de Siglas Reativas) */}
                <div className="shrink-0">
                  <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-center truncate" title="TABELA PREÇO">
                    TABELA PREÇO
                  </label>
                  <div className="relative w-[65px]">
                    <div className="w-[65px] text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded px-1 py-0.5 text-center leading-none cursor-pointer focus:outline-none select-none flex items-center justify-center min-h-[25px]">
                      {tabelaPreco === 'custo' ? '1-PC' : tabelaPreco === 'venda' ? '2-PF' : tabelaPreco === 'atacado' ? '3-PA' : '4-PP'}
                    </div>
                    <select
                      value={tabelaPreco}
                      onChange={e => handleTableChange(e.target.value as PriceTable)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="TABELA PREÇO"
                    >
                      <option value="custo">1-PC - CUSTO</option>
                      <option value="venda">2-PF - FINAL</option>
                      <option value="atacado">3-PA - ATACADO</option>
                      <option value="promocional">4-PP - PROMO</option>
                    </select>
                  </div>
                </div>

                {/* Input de Preço de Venda */}
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-right truncate">
                    PREÇO (R$)
                  </label>
                  <input
                    type="text"
                    value={inputPreco}
                    onChange={e => setInputPreco(e.target.value)}
                    className="w-full text-right px-2 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white shadow-2xs focus:ring-1 focus:ring-sky-500 outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            {/* 5. % DESCONTO COM TRAVA DE SEGURANÇA E ALÇADA POR CARGO */}
            <div className="col-span-2 sm:col-span-1 relative">
              <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-0.5 text-right flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    const currentDesc = parseFloat(inputDesconto.replace(',', '.')) || maxDiscountAllowed;
                    setAttemptedDiscount(currentDesc > maxDiscountAllowed ? currentDesc : maxDiscountAllowed + 5);
                    setIsMasterAuthModalOpen(true);
                  }}
                  title="Autorização de Desconto Master (Administrador)"
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 p-0 cursor-pointer"
                >
                  <Key className="w-3 h-3" />
                </button>
                <span>% DESC.</span>
              </label>
              <input
                type="text"
                value={inputDesconto}
                onChange={handleDescontoChange}
                className={`w-full text-right px-1 py-1 rounded-lg border text-xs font-bold shadow-2xs outline-none transition ${
                  isDiscountExceeded
                    ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200'
                    : 'border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white focus:ring-1 focus:ring-sky-500'
                }`}
                placeholder="0,00"
              />
              {/* Texto explicativo micro em UPPERCASE logo abaixo do campo quando violado */}
              {isDiscountExceeded && (
                <div 
                  onClick={() => setIsMasterAuthModalOpen(true)}
                  title="Clique para autorizar desconto master"
                  className="text-[7.5px] font-black uppercase text-amber-600 dark:text-amber-400 leading-tight mt-0.5 cursor-pointer hover:underline truncate"
                >
                  * LIMITE MÁXIMO DE DESCONTO PERMITIDO PARA SEU CARGO EXCEDIDO.
                </div>
              )}
            </div>

            {/* 6. BOTÃO INSERIR ITEM */}
            <div className="col-span-10 sm:col-span-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 py-1 px-3 text-xs font-bold text-white rounded-lg bg-gradient-to-b from-sky-600 via-sky-700 to-sky-800 hover:from-sky-500 hover:to-sky-700 border border-sky-500/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>INSERIR (ENTER)</span>
              </button>
            </div>
          </div>

          {/* Alerta Operacional Slim de Teto de Desconto Excedido */}
          {isDiscountExceeded && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200 text-[10px] font-black uppercase shadow-2xs animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">
                  * LIMITE MÁXIMO DE DESCONTO PERMITIDO PARA SEU CARGO EXCEDIDO. (PERFIL: {roleBadgeLabel} • TETO: {maxDiscountAllowed.toFixed(2).replace('.', ',')}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMasterAuthModalOpen(true)}
                className="shrink-0 ml-2 inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-900 dark:text-amber-100 hover:text-amber-700 dark:hover:text-amber-300 underline cursor-pointer"
              >
                <Key className="w-3 h-3" />
                <span>🔑 AUTORIZAR DESCONTO MASTER</span>
              </button>
            </div>
          )}
        </form>
      </section>

      {/* =====================================================================
          2. GRADE CENTRAL DOS ITENS LANÇADOS (CABEÇALHO PRETO & LINHAS AZUIS)
         ===================================================================== */}
      {/* =====================================================================
          2. GRADE CENTRAL DO PDV: TABELA DE ITENS (COL 9) + PAINEL FOTO (COL 3)
         ===================================================================== */}
      <div className="flex-1 min-h-[160px] grid grid-cols-12 gap-2 overflow-hidden items-stretch">
        {/* LADO ESQUERDO: COLUNA 9 - TABELA DE PRODUTOS INSERIDOS NO CARRINHO */}
        <section 
          aria-label="Grade de Itens do Cupom"
          className="col-span-12 lg:col-span-9 bg-white dark:bg-stone-900 rounded-xl border border-slate-400 dark:border-stone-800 overflow-hidden flex flex-col shadow-2xs min-h-0"
        >
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-340px)] scrollbar-none flex flex-col">
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-zinc-950 text-white font-black text-[10px] tracking-wider uppercase border-b border-zinc-800">
                    <tr>
                      <th className="py-1 px-2 w-10 text-center">ITEM</th>
                      <th className="py-1 px-2.5 w-24">CÓDIGO (F3)</th>
                      <th className="py-1 px-2.5">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                      <th className="py-1 px-1.5 w-12 text-center">UN</th>
                      <th className="py-1 px-2 w-16 text-right">QTDE</th>
                      <th className="py-1 px-2 w-24 text-right">PREÇO UNIT.</th>
                      <th className="py-1 px-1.5 w-16 text-right">% DESC.</th>
                      <th className="py-1 px-2 w-20 text-right">R$ DESC.</th>
                      <th className="py-1 px-2.5 w-24 text-right">TOTAL BRUTO</th>
                      <th className="py-1 px-2.5 w-24 text-right text-amber-300">TOTAL LÍQUIDO</th>
                      <th className="py-1 px-1.5 w-10 text-center">AÇÃO</th>
                    </tr>
                  </thead>
                </table>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-stone-500 font-bold gap-2">
                  <ShoppingCart className="w-10 h-10 text-slate-300 dark:text-stone-600 stroke-[1.5]" />
                  <span className="text-xs uppercase tracking-wide">CAIXA LIVRE • DIGITE O CÓDIGO OU BUSQUE O PRODUTO PARA INICIAR A VENDA</span>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-zinc-950 text-white font-black text-[10px] tracking-wider uppercase border-b border-zinc-800">
                  <tr>
                    <th className="py-1 px-2 w-10 text-center">ITEM</th>
                    <th className="py-1 px-2.5 w-24">CÓDIGO (F3)</th>
                    <th className="py-1 px-2.5">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                    <th className="py-1 px-1.5 w-12 text-center">UN</th>
                    <th className="py-1 px-2 w-16 text-right">QTDE</th>
                    <th className="py-1 px-2 w-24 text-right">PREÇO UNIT.</th>
                    <th className="py-1 px-1.5 w-16 text-right">% DESC.</th>
                    <th className="py-1 px-2 w-20 text-right">R$ DESC.</th>
                    <th className="py-1 px-2.5 w-24 text-right">TOTAL BRUTO</th>
                    <th className="py-1 px-2.5 w-24 text-right text-amber-300">TOTAL LÍQUIDO</th>
                    <th className="py-1 px-1.5 w-10 text-center">AÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100 dark:divide-stone-800 font-semibold text-zinc-900 dark:text-stone-100">
                  {items.map((it, idx) => (
                    <tr 
                      key={it.id} 
                      onClick={() => setSelectedCartItemId(it.id)}
                      className={`even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-sky-100/70 dark:hover:bg-sky-950/40 transition border-b border-slate-200 dark:border-stone-800 cursor-pointer ${
                        selectedCartItemId === it.id ? 'bg-sky-100/90 dark:bg-sky-950/70 ring-1 ring-sky-500' : ''
                      }`}
                    >
                      <td className="py-1 px-2 text-center font-mono text-[10px] text-slate-500">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-1 px-2.5 font-mono text-[11px] font-bold text-slate-700 dark:text-stone-300">
                        {it.codigo}
                      </td>
                      <td className="py-1 px-2.5 font-bold text-xs uppercase truncate max-w-[280px]" title={it.descricao}>
                        {it.descricao}
                      </td>
                      <td className="py-1 px-1.5 text-center font-bold text-slate-600 dark:text-stone-400 text-[11px]">
                        {it.unidade}
                      </td>
                      <td className="py-1 px-2 text-right font-black text-xs">
                        {it.quantidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-2 text-right font-semibold text-xs">
                        {formatCurrencyBRL(it.precoUnitario)}
                      </td>
                      <td className="py-1 px-1.5 text-right font-medium text-slate-500 text-[11px]">
                        {it.percentualDesconto > 0 ? `${it.percentualDesconto}%` : '-'}
                      </td>
                      <td className="py-1 px-2 text-right font-medium text-slate-500 text-[11px]">
                        {it.valorDesconto > 0 ? formatCurrencyBRL(it.valorDesconto) : '-'}
                      </td>
                      <td className="py-1 px-2.5 text-right font-semibold text-xs text-slate-700 dark:text-stone-300">
                        {formatCurrencyBRL(it.totalBruto)}
                      </td>
                      <td className="py-1 px-2.5 text-right font-black text-xs text-emerald-700 dark:text-emerald-400">
                        {formatCurrencyBRL(it.totalLiquido)}
                      </td>
                      <td className="py-1 px-1.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoverItem(it.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* LADO DIREITO: COLUNA 3 - PAINEL VERTICAL DA FOTO GRANDE (ÁREA ROSA) */}
        <div className="hidden lg:flex col-span-3 flex-col h-full min-h-0">
          <div className="w-full h-full border border-slate-300 dark:border-stone-700 rounded bg-white dark:bg-stone-900 p-3 flex flex-col items-center justify-between shadow-xs select-none">
            {/* Topo do painel: label fixa micro */}
            <div className="w-full flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-stone-800 shrink-0">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                📸 IDENTIFICAÇÃO VISUAL DO ITEM
              </span>
              {activeVisualProduct?.code && (
                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-stone-500 uppercase">
                  [{activeVisualProduct.code}]
                </span>
              )}
            </div>

            {/* Centro: Foto do Produto ou Silhueta Padrão */}
            <div className="w-full flex-1 flex flex-col items-center justify-center my-2 min-h-0">
              {fotoSelecionada ? (
                <img 
                  src={fotoSelecionada} 
                  alt={activeVisualProduct?.name || 'Foto do Produto'} 
                  className="w-full h-[280px] object-contain object-center rounded border border-slate-200 dark:border-stone-700 p-2 bg-slate-50 dark:bg-stone-800" 
                />
              ) : (
                <div className="w-full h-[280px] rounded border border-dashed border-slate-200 dark:border-stone-800 p-4 bg-slate-50 dark:bg-stone-800/50 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-stone-800 flex items-center justify-center text-slate-400 dark:text-stone-500 mb-1">
                    {isServicoItem ? (
                      <Settings className="w-7 h-7 stroke-[1.6]" />
                    ) : (
                      <Package className="w-7 h-7 stroke-[1.6]" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-stone-400 font-bold mt-2 uppercase tracking-wide text-center">
                    FOTO NÃO CADASTRADA OU ITEM DE SERVIÇO
                  </span>
                </div>
              )}
            </div>

            {/* Rodapé: Identificação Técnica com Nome e Código */}
            <div className="w-full pt-1.5 border-t border-slate-200 dark:border-stone-800 flex flex-col items-center justify-center text-center shrink-0">
              <span className="text-xs font-black text-slate-800 dark:text-white tracking-wide text-center uppercase line-clamp-2">
                {activeVisualProduct?.name || 'NENHUM PRODUTO SELECIONADO'}
              </span>
              {activeVisualProduct?.code && (
                <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-stone-400 mt-0.5 uppercase">
                  CÓD: {activeVisualProduct.code}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. BLOCO INFERIOR DE FECHAMENTO E TOTAIS (CARDS HORIZONTAIS)
         ===================================================================== */}
      <section 
        aria-label="Totais de Fechamento PDV"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 shrink-0"
      >
        {/* TOTAL BRUTO */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            TOTAL BRUTO
          </span>
          <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white font-mono">
            {formatCurrencyBRL(totals.totalBruto)}
          </span>
        </div>

        {/* DESCONTO */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            DESCONTO
          </span>
          <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
            {formatCurrencyBRL(totals.totalDesconto)}
          </span>
        </div>

        {/* TOTAL LÍQUIDO (DESTAQUE AMARELO TEXT-BASE FONT-BOLD) */}
        <div className="bg-amber-300 dark:bg-amber-400 border border-amber-500 rounded-xl px-2.5 py-1 text-left shadow-xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-amber-950">
            TOTAL LÍQUIDO
          </span>
          <span className="text-sm sm:text-base font-black text-amber-950 font-mono tracking-tight leading-tight block">
            {formatCurrencyBRL(totals.totalLiquido)}
          </span>
        </div>

        {/* TOTAL DE ITENS */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            TOTAL DE ITENS
          </span>
          <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white font-mono">
            {totals.totalItens} <span className="text-[10px] text-slate-500 font-semibold">({totals.totalQuantidade.toFixed(1)} un/kg/ton)</span>
          </span>
        </div>

        {/* TOTAL PAGO */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            TOTAL PAGO
          </span>
          <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {formatCurrencyBRL(totals.valorPago)}
          </span>
        </div>

        {/* TROCO */}
        <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-xl px-2.5 py-1 text-left shadow-2xs">
          <span className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-stone-400">
            TROCO
          </span>
          <span className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400 font-mono">
            {formatCurrencyBRL(totals.troco)}
          </span>
        </div>
      </section>

      {/* =====================================================================
          4. CONTROLE DE FECHAMENTO DO PDV (RODAPÉ SLIM DESIGN PRO)
         ===================================================================== */}
      <section 
        aria-label="Controle de Fechamento do PDV"
        className="p-1.5 sm:p-2 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 rounded-xl border border-slate-400 dark:border-stone-700 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.1)] shrink-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          
          {/* Valor Pago pelo Cliente */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 shrink-0 whitespace-nowrap">
              VALOR PAGO (R$):
            </label>
            <input
              type="text"
              value={valorPagoInput}
              onChange={e => setValorPagoInput(e.target.value)}
              placeholder={totals.totalLiquido > 0 ? totals.totalLiquido.toFixed(2).replace('.', ',') : '0,00'}
              className="w-36 sm:w-44 text-right px-2.5 py-1 rounded-lg border border-slate-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs font-black text-zinc-900 dark:text-white font-mono shadow-2xs outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Botões de Ação do PDV */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={async () => {
                if (items.length === 0) {
                  handleLimparPdv();
                  return;
                }
                const isConfirmed = await confirmDialog({
                  title: 'Limpar Frente de Caixa',
                  message: 'Deseja realmente cancelar e limpar todos os itens deste cupom de venda?',
                  confirmLabel: 'Limpar Caixa',
                  cancelLabel: 'Manter Itens',
                  variant: 'danger',
                });
                if (isConfirmed) {
                  handleLimparPdv();
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 dark:from-stone-800 dark:to-stone-900 text-slate-700 dark:text-stone-300 border border-slate-400 dark:border-stone-700 hover:bg-slate-300 shadow-2xs transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Cancelar itens da venda atual"
            >
              <X className="w-3.5 h-3.5 text-rose-500" />
              <span>[F4] LIMPAR</span>
            </button>

            {lastFinishedSale && (
              <button
                type="button"
                onClick={() => {
                  setActivePrintFormat(formatoImpressao);
                  setIsReceiptOpen(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-b from-sky-500 via-sky-600 to-sky-700 text-white border border-sky-400 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
                title="Reimprimir cupom / espelho da última venda"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>[F5] CUPOM</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCheckoutModal}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Finalizar e emitir comprovante da venda"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>✅ [F2] FINALIZAR VENDA</span>
            </button>
          </div>

        </div>
      </section>

      {/* =====================================================================
          NOVO: MODAL CENTRALIZADO DE FECHAMENTO DO PDV (PADRÃO OURO SLIM DESIGN PRO)
         ===================================================================== */}
      {isCheckoutModalOpen && (
        <div 
          id="modal-fechamento-pdv-overlay"
          className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
          onClick={() => setIsCheckoutModalOpen(false)}
        >
          <div 
            id="modal-fechamento-pdv"
            className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global select-none shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho Metálico Acetinado Padrão Ouro em CAIXA ALTA */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 px-4 py-2.5 text-white flex items-center justify-between shadow-xs border-b border-amber-700/60 shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-100 shrink-0" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider font-['Outfit']">
                  🖨️ CONCLUIR E EMITIR COMPROVANTE DE VENDA
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-black/20 text-white border border-white/20">
                  {items.length} {items.length === 1 ? 'ITEM' : 'ITENS'} • {operacaoTipo === 'contrato_silagem' ? 'CONTRATO DE SILAGEM' : 'VENDA BALCÃO'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1 hover:bg-black/20 rounded transition text-amber-100 hover:text-white cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo Central do Modal com Trava Anti-Rolagem e Organização Limpa */}
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto no-scrollbar space-y-3 bg-slate-100/70 dark:bg-stone-950/60">
              
              {/* 1. BLOCOS DE VALORES MACRO: CARDS DESTACADOS COM CONTORNOS FINOS DE AÇO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Card Total Líquido a Pagar */}
                <div className="bg-gradient-to-b from-amber-50 to-amber-100/70 dark:from-amber-950/40 dark:to-stone-900 border-2 border-amber-500/80 rounded-xl p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-900 dark:text-amber-300 tracking-wider">
                      TOTAL LÍQUIDO A PAGAR
                    </span>
                    <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-['Outfit'] text-amber-800 dark:text-amber-300 mt-1">
                    {formatCurrencyBRL(totals.totalLiquido)}
                  </div>
                  <div className="text-[9.5px] font-bold text-amber-700/80 dark:text-amber-400/80 mt-0.5 truncate">
                    SUBTOTAL: {formatCurrencyBRL(totals.totalBruto)} • DESC: {formatCurrencyBRL(totals.totalDesconto)}{totals.totalFrete > 0 ? ` • FRETE: ${formatCurrencyBRL(totals.totalFrete)}` : ''}
                  </div>
                </div>

                {/* Card Valor Recebido */}
                <div className="bg-white dark:bg-stone-800 border-2 border-slate-300 dark:border-stone-700 rounded-xl p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-700 dark:text-stone-300 tracking-wider">
                      VALOR RECEBIDO (R$)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const formatted = totals.totalLiquido > 0 ? totals.totalLiquido.toFixed(2).replace('.', ',') : '0,00';
                        setValorPagoInput(formatted);
                        setTimeout(() => {
                          if (valorPagoInputRef.current) {
                            valorPagoInputRef.current.focus();
                            valorPagoInputRef.current.select();
                          }
                        }, 20);
                      }}
                      className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-stone-700 text-sky-700 dark:text-sky-300 border border-slate-300 dark:border-stone-600 hover:bg-sky-50 uppercase cursor-pointer"
                      title="Copiar valor exato líquido"
                    >
                      VALOR EXATO
                    </button>
                  </div>
                  <input
                    ref={valorPagoInputRef}
                    type="text"
                    value={valorPagoInput}
                    onChange={e => setValorPagoInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmarEImprimir();
                      }
                    }}
                    onFocus={e => e.target.select()}
                    onClick={e => (e.target as HTMLInputElement).select()}
                    placeholder={totals.totalLiquido > 0 ? totals.totalLiquido.toFixed(2).replace('.', ',') : '0,00'}
                    className="w-full text-2xl sm:text-3xl font-black font-['Outfit'] text-zinc-900 dark:text-white bg-transparent outline-none mt-1 border-b border-slate-300 dark:border-stone-600 focus:border-amber-500 font-mono"
                  />
                  <div className="text-[9.5px] font-bold text-slate-500 dark:text-stone-400 mt-0.5">
                    DIGITE O VALOR EFETIVAMENTE PAGO PELO CLIENTE
                  </div>
                </div>

                {/* Card Troco */}
                <div className="bg-gradient-to-b from-emerald-50 to-emerald-100/70 dark:from-emerald-950/40 dark:to-stone-900 border-2 border-emerald-500/80 rounded-xl p-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-900 dark:text-emerald-300 tracking-wider">
                      TROCO A DEVOLVER
                    </span>
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className={`text-2xl sm:text-3xl font-black font-['Outfit'] mt-1 ${totals.troco > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-stone-500'}`}>
                    {formatCurrencyBRL(totals.troco)}
                  </div>
                  <div className={`text-[9.5px] font-black mt-0.5 uppercase tracking-wide truncate ${totals.troco > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-emerald-700/80 dark:text-emerald-400/80'}`}>
                    {totals.troco > 0 ? `DEVOLVER ${formatCurrencyBRL(totals.troco)} EM DINHEIRO` : 'SEM TROCO A DEVOLVER'}
                  </div>
                </div>
              </div>

              {/* =====================================================================
                  NOVO: SEÇÃO DE FRETE DINÂMICO MULTIVEÍCULO (LOGÍSTICA DE TRANSPORTE)
                 ===================================================================== */}
              <div className="bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl p-3 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-700 dark:text-stone-300 tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>🚚 LOGÍSTICA DE TRANSPORTE / FRETE VINCULADO</span>
                  </span>
                  {fretesVinculados.length > 0 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-mono uppercase whitespace-nowrap">
                      TOTAL FRETE: {formatCurrencyBRL(totals.totalFrete)} ({fretesVinculados.length} {fretesVinculados.length === 1 ? 'VEÍCULO' : 'VEÍCULOS'})
                    </span>
                  )}
                </div>

                {/* Linha horizontal fina de inputs utilizando o padrão de contorno de aço */}
                <div className="bg-slate-100 dark:bg-stone-850 p-2 border border-slate-300 dark:border-stone-700 rounded flex flex-wrap lg:flex-nowrap items-center gap-2 text-[11px] font-semibold text-slate-700 dark:text-stone-300 uppercase mb-2">
                  {/* CAMPO 1 (Dropdown Slim / Combobox Autocomplete): VEÍCULO FRETE */}
                  <div ref={vehicleContainerRef} className="flex-1 min-w-[200px] relative">
                    <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-stone-400 mb-0.5 whitespace-nowrap">
                      VEÍCULO FRETE:
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={veiculoSearchText}
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          setVeiculoSearchText(val);
                          setIsVehicleDropdownOpen(true);
                          const matched = availableVehicles.find(v => 
                            getVehicleIdentificationText(v).toUpperCase() === val ||
                            (v.licensePlateOrSerial || v.plate || '').toUpperCase() === val
                          );
                          if (matched) {
                            setVeiculoFreteId(matched.id);
                          }
                        }}
                        onFocus={() => setIsVehicleDropdownOpen(true)}
                        placeholder="DIGITE PLACA, MODELO OU MARCA..."
                        className="w-full pl-2 pr-7 py-1 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-[11px] font-bold text-zinc-900 dark:text-white shadow-2xs outline-none focus:ring-1 focus:ring-amber-500 uppercase truncate"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setIsVehicleDropdownOpen(prev => !prev)}
                        className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 p-0.5 cursor-pointer"
                        title="Abrir lista de veículos da frota"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Dropdown com listagem reduzida em UPPERCASE */}
                    {isVehicleDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md shadow-xl max-h-48 overflow-y-auto no-scrollbar py-0.5">
                        {filteredVehicles.length > 0 ? (
                          filteredVehicles.map((veh: any, idx: number) => {
                            const isSelected = veh.id === veiculoFreteId;
                            const plate = veh.licensePlateOrSerial || veh.plate || veh.plateOrSerial || 'S/ PLACA';
                            const model = veh.model || veh.name || veh.brand || 'VEÍCULO';
                            const fleet = veh.fleetNumber || veh.numero_frota;
                            const brand = veh.brand || '';
                            const type = veh.categoryType || veh.type || veh.tipo || '';

                            return (
                              <div
                                key={veh.id || `veh_opt_${idx}`}
                                onClick={() => {
                                  setVeiculoFreteId(veh.id);
                                  setVeiculoSearchText(getVehicleIdentificationText(veh));
                                  setIsVehicleDropdownOpen(false);
                                }}
                                className={`px-2 py-1 text-[10px] font-bold cursor-pointer transition flex items-center justify-between border-b border-slate-100 dark:border-stone-800 last:border-0 uppercase ${
                                  isSelected
                                    ? 'bg-amber-100/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                                    : 'hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-800 dark:text-stone-200'
                                }`}
                              >
                                <div className="truncate flex items-center gap-1.5">
                                  <span className="font-mono font-black text-amber-700 dark:text-amber-400">
                                    [{plate.toUpperCase()}]
                                  </span>
                                  <span className="truncate">
                                    {model.toUpperCase()}
                                    {brand && !model.toLowerCase().includes(brand.toLowerCase()) ? ` - ${brand.toUpperCase()}` : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  {type && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300">
                                      {type.toUpperCase()}
                                    </span>
                                  )}
                                  {fleet && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-mono">
                                      #{fleet}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-2 py-2 text-[10px] text-slate-400 italic text-center uppercase">
                            NENHUM VEÍCULO ENCONTRADO
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CAMPO 2 (Dropdown Slim): TIPO CÁLCULO */}
                  <div className="w-40 sm:w-44 shrink-0">
                    <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-stone-400 mb-0.5 whitespace-nowrap">
                      TIPO CÁLCULO:
                    </label>
                    <select
                      value={tipoCalculoFrete}
                      onChange={e => {
                        const newType = e.target.value as 'fixo' | 'km';
                        setTipoCalculoFrete(newType);
                        if (newType === 'fixo') setKmRodadosFreteInput('');
                      }}
                      className="w-full px-2 py-1 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-[11px] font-bold text-zinc-900 dark:text-white shadow-2xs outline-none focus:ring-1 focus:ring-amber-500 uppercase whitespace-nowrap"
                    >
                      <option value="fixo">VALOR FIXO (R$)</option>
                      <option value="km">POR KM RODADO (R$/KM)</option>
                    </select>
                  </div>

                  {/* CAMPO 3 (Input Numérico): VALOR / TAXA */}
                  <div className="w-28 sm:w-32 shrink-0">
                    <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-stone-400 mb-0.5 whitespace-nowrap">
                      VALOR / TAXA:
                    </label>
                    <input
                      type="text"
                      value={valorTaxaFreteInput}
                      onKeyDown={handleValorTaxaFreteKeyDown}
                      onChange={handleValorTaxaFreteChange}
                      onPaste={handleValorTaxaFretePaste}
                      onFocus={e => e.target.select()}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      placeholder="0,00"
                      className="w-full px-2 py-1 text-right rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-[11px] font-bold text-zinc-900 dark:text-white font-mono shadow-2xs outline-none focus:ring-1 focus:ring-amber-500 whitespace-nowrap"
                    />
                  </div>

                  {/* CAMPO 4 (Input Numérico): KM RODADOS */}
                  <div className="w-24 sm:w-28 shrink-0">
                    <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-stone-400 mb-0.5 whitespace-nowrap">
                      KM RODADOS:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      disabled={tipoCalculoFrete !== 'km'}
                      value={kmRodadosFreteInput}
                      onChange={e => setKmRodadosFreteInput(e.target.value)}
                      placeholder={tipoCalculoFrete === 'km' ? 'Ex: 150' : '-'}
                      className={`w-full px-2 py-1 text-right rounded border text-[11px] font-bold font-mono shadow-2xs outline-none focus:ring-1 focus:ring-amber-500 whitespace-nowrap ${
                        tipoCalculoFrete === 'km'
                          ? 'border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-zinc-900 dark:text-white'
                          : 'border-slate-200 dark:border-stone-700 bg-slate-200/60 dark:bg-stone-800 text-slate-400 cursor-not-allowed'
                      }`}
                    />
                  </div>

                  {/* CAMPO 5 (Botão Micro): + VINCULAR FRETE */}
                  <div className="shrink-0 self-end">
                    <button
                      type="button"
                      onClick={handleAdicionarFrete}
                      className="px-3 py-1.5 rounded bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 dark:from-stone-800 dark:via-stone-700 dark:to-stone-800 hover:from-amber-400 hover:to-amber-500 hover:text-white text-slate-800 dark:text-stone-200 border border-slate-400 dark:border-stone-600 shadow-2xs text-[10px] sm:text-[11px] font-black tracking-wider transition active:scale-95 cursor-pointer whitespace-nowrap uppercase"
                      title="Adicionar veículo e frete à composição"
                    >
                      + VINCULAR FRETE
                    </button>
                  </div>
                </div>

                {/* Listagem compacta e multiveículo em linhas horizontais micro zebradas */}
                {fretesVinculados.length > 0 && (
                  <div className="rounded border border-slate-200 dark:border-stone-700 overflow-hidden divide-y divide-slate-200 dark:divide-stone-700 bg-white dark:bg-stone-900 max-h-28 overflow-y-auto no-scrollbar">
                    {fretesVinculados.map((item) => (
                      <div
                        key={item.id}
                        className="even:bg-[#eaeaea] dark:even:bg-stone-800/60 odd:bg-white dark:odd:bg-stone-900 py-1 px-2 border-b border-slate-200 dark:border-stone-700 text-[10px] font-bold text-slate-700 dark:text-stone-300 flex items-center justify-between uppercase whitespace-nowrap"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-black text-slate-900 dark:text-white truncate">
                            {item.veiculoIdentificacao}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-stone-700 font-mono text-slate-600 dark:text-stone-300 shrink-0">
                            TIPO: {item.tipoCalculo === 'km' ? `KM (${item.kmRodados} KM x ${formatCurrencyBRL(item.valorUnitario)}/KM)` : 'FIXO'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0 ml-2">
                          <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-[11px]">
                            TOTAL FRETE: {formatCurrencyBRL(item.valorTotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoverFrete(item.id)}
                            className="w-4 h-4 rounded-full flex items-center justify-center bg-rose-100 hover:bg-rose-500 text-rose-600 hover:text-white transition cursor-pointer text-[10px] font-black shadow-2xs shrink-0"
                            title="Remover veículo do frete"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. GRADE DE BOTÕES DE FORMA DE PAGAMENTO REATIVOS */}
              <div className="bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl p-3 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-700 dark:text-stone-300 tracking-wider flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    <span>FORMA DE PAGAMENTO:</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-mono uppercase">
                    {formaPagamento === 'a_vista' && 'À VISTA (DINHEIRO)'}
                    {formaPagamento === 'pix' && 'PIX INSTANTÂNEO'}
                    {formaPagamento === 'cartao_debito' && 'CARTÃO DE DÉBITO'}
                    {formaPagamento === 'cartao_credito' && 'CARTÃO DE CRÉDITO'}
                    {formaPagamento === 'prazo' && 'A PRAZO (PARCELADO)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { key: 'a_vista', label: '[F5] À VISTA' },
                    { key: 'pix', label: '[F6] PIX' },
                    { key: 'cartao_debito', label: '[F7] DÉBITO' },
                    { key: 'cartao_credito', label: '[F8] CRÉDITO' },
                    { key: 'prazo', label: '[F9] A PRAZO' },
                  ].map(method => {
                    const isSelected = formaPagamento === method.key;
                    return (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => {
                          if (method.key === 'a_vista') {
                            handleAcionarAVista();
                          } else {
                            setFormaPagamento(method.key as any);
                          }
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-black uppercase transition cursor-pointer text-center border shadow-2xs ${
                          isSelected
                            ? 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-white border-amber-600 ring-2 ring-amber-300 dark:ring-amber-800'
                            : 'bg-slate-100 dark:bg-stone-700 hover:bg-slate-200 dark:hover:bg-stone-600 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-600'
                        }`}
                      >
                        {method.label}
                      </button>
                    );
                  })}
                </div>

                {/* Bloco Condição para Pagamento a Prazo (Expande dinamicamente) */}
                {formaPagamento === 'prazo' && (
                  <div className="mt-2 pt-2.5 border-t border-slate-200 dark:border-stone-700 space-y-2.5 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                          PRAZO:
                        </label>
                        <select
                          value={prazoCondicao}
                          onChange={e => setPrazoCondicao(e.target.value)}
                          className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="30 DIAS">30 DIAS</option>
                          <option value="30/60 DIAS">30/60 DIAS</option>
                          <option value="30/60/90 DIAS">30/60/90 DIAS</option>
                          <option value="SAFRA (FECHAMENTO)">SAFRA (FECHAMENTO)</option>
                          <option value="PERSONALIZADO">PERSONALIZADO</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                          TIPO COBRANÇA *:
                        </label>
                        <select
                          value={tipoCobranca}
                          onChange={e => setTipoCobranca(e.target.value as 'carteira' | 'boleto')}
                          className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="carteira">💳 CARTEIRA (CONTA INTERNA)</option>
                          <option value="boleto">📄 BOLETO BANCÁRIO</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                          DATA 1ª PARCELA:
                        </label>
                        <input
                          type="date"
                          value={dataPrimeiraParcela}
                          onChange={e => setDataPrimeiraParcela(e.target.value)}
                          className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-xs font-bold text-zinc-900 dark:text-white shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                          QTDE/PARCELAS:
                        </label>
                        <select
                          value={qtdeParcelas}
                          onChange={e => setQtdeParcelas(parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-xs font-bold text-zinc-900 dark:text-white shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value={1}>1x (Parcela Única)</option>
                          <option value={2}>2x Mensais</option>
                          <option value={3}>3x Mensais</option>
                          <option value={4}>4x Mensais</option>
                          <option value={6}>6x Mensais</option>
                          <option value={12}>12x Anual</option>
                        </select>
                      </div>
                    </div>

                    {/* Inteligência de busca da conta bancária prioritária do LocalStorage */}
                    {tipoCobranca === 'boleto' && (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 text-[10px] text-sky-800 dark:text-sky-300 shadow-2xs">
                        <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span className="font-bold text-slate-500 dark:text-stone-400 uppercase">BANCO EMISSOR DO BOLETO:</span>
                        <span className="font-mono text-xs font-black uppercase text-sky-950 dark:text-sky-100">{prioritaryAccount.rawText}</span>
                        <span className="ml-auto inline-flex items-center px-1.5 py-0.2 rounded bg-sky-600 text-white text-[9px] font-black uppercase tracking-wider">
                          ⭐ CONTA PRIORITÁRIA
                        </span>
                      </div>
                    )}

                    {/* Tabela de Parcelas Previstas */}
                    {parcelas.length > 0 && (
                      <div className="bg-slate-50 dark:bg-stone-900 rounded-lg border border-slate-200 dark:border-stone-700 overflow-hidden max-h-28 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-200 dark:bg-stone-800 text-[9.5px] font-black uppercase text-slate-700 dark:text-stone-300 border-b border-slate-300 dark:border-stone-700 sticky top-0">
                            <tr>
                              <th className="py-1 px-2.5">PARCELA</th>
                              <th className="py-1 px-2.5">VENCIMENTO</th>
                              <th className="py-1 px-2.5 text-right">VALOR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-stone-800 font-semibold text-[10.5px]">
                            {parcelas.map(p => (
                              <tr key={p.numero} className="even:bg-white dark:even:bg-stone-850 odd:bg-slate-50 dark:odd:bg-stone-900">
                                <td className="py-1 px-2.5 text-slate-700 dark:text-stone-300">{p.numero}ª Parcela</td>
                                <td className="py-1 px-2.5 text-slate-700 dark:text-stone-300">{formatDateBR(p.vencimento)}</td>
                                <td className="py-1 px-2.5 text-right font-black font-mono text-zinc-900 dark:text-white">{formatCurrencyBRL(p.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. SELETOR DE IMPRESSÃO FIXO */}
              <div className="bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 rounded-xl p-3 shadow-2xs space-y-2">
                <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-700 dark:text-stone-300 tracking-wider flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>SELETOR DE FORMATO DE SAÍDA / IMPRESSÃO *:</span>
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormatoImpressao('a4')}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition cursor-pointer ${
                      formatoImpressao === 'a4'
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 ring-2 ring-sky-300 dark:ring-sky-800 shadow-2xs'
                        : 'bg-slate-50 dark:bg-stone-900/60 border-slate-300 dark:border-stone-700 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className={`w-5 h-5 shrink-0 mt-0.5 ${formatoImpressao === 'a4' ? 'text-sky-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-black uppercase text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>📄 FOLHA A4 RETRATO [F10]</span>
                        {formatoImpressao === 'a4' && (
                          <span className="px-1.5 py-0.2 rounded bg-sky-600 text-white text-[8px] font-black uppercase">
                            SELECIONADO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-stone-400 mt-0.5">
                        Espelho formal de pedido e nota de venda com cabeçalho da empresa, tabela completa e campo para assinatura.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormatoImpressao('termica')}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition cursor-pointer ${
                      formatoImpressao === 'termica'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-800 shadow-2xs'
                        : 'bg-slate-50 dark:bg-stone-900/60 border-slate-300 dark:border-stone-700 hover:bg-slate-100'
                    }`}
                  >
                    <Receipt className={`w-5 h-5 shrink-0 mt-0.5 ${formatoImpressao === 'termica' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-black uppercase text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <span>📟 TÉRMICA 80MM [F10]</span>
                        {formatoImpressao === 'termica' && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[8px] font-black uppercase">
                            SELECIONADO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-stone-400 mt-0.5">
                        Cupom não fiscal compacto em bobina de 80mm otimizado para impressoras térmicas rápidas de balcão.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

            </div>

            {/* 4. BOTÕES NO RODAPÉ ACETINADO (CANCELAR, SALVAR RASCUNHO E CONFIRMAR) */}
            <div className="p-2.5 sm:p-3 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-t border-slate-300 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer uppercase tracking-wider"
                >
                  ✕ [ESC] CANCELAR
                </button>

                <button
                  type="button"
                  onClick={handleSaveVendaRascunho}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-400 font-bold text-xs uppercase px-3 py-1.5 rounded transition-all flex items-center gap-1.5 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.7)] cursor-pointer whitespace-nowrap"
                  title="Salvar venda temporária e liberar PDV"
                >
                  <span>💾 [F4] SALVAR RASCUNHO</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirmarEImprimir}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs sm:text-sm font-black bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)] transition active:scale-95 cursor-pointer uppercase tracking-wider ml-auto"
              >
                <span>🖨️ [F2] FINALIZAR VENDA E IMPRIMIR</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =====================================================================
          MICRO-MODAL PADRÃO OURO: INFORME UMA IDENTIFICAÇÃO PARA O RASCUNHO
         ===================================================================== */}
      {isSaveDraftModalOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-3 overflow-hidden animate-in fade-in duration-150"
          onClick={() => setIsSaveDraftModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg shadow-2xl overflow-hidden select-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho padrão ouro acetinado */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 px-4 py-2 text-white flex items-center justify-between shadow-xs border-b border-amber-700/60">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">💾</span>
                <h4 className="text-xs font-black uppercase tracking-wider font-['Outfit']">
                  INFORME UMA IDENTIFICAÇÃO PARA O RASCUNHO *
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveDraftModalOpen(false)}
                className="p-1 hover:bg-black/20 rounded transition text-amber-100 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleConfirmSaveDraft} className="p-4 space-y-3 bg-slate-50 dark:bg-stone-900">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-1">
                  IDENTIFICAÇÃO / NOME DO RASCUNHO *:
                </label>
                <input
                  autoFocus
                  type="text"
                  value={draftIdentificacaoInput}
                  onChange={e => setDraftIdentificacaoInput(e.target.value)}
                  placeholder="EX: PRODUTOR JOÃO - SILAGEM 2 CAMINHÕES"
                  className="w-full px-3 py-1.5 rounded-md border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-850 text-xs font-bold uppercase text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                />
              </div>

              <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-300 font-semibold space-y-0.5">
                <div className="flex justify-between">
                  <span>TOTAL DA VENDA:</span>
                  <span className="font-mono font-black">{formatCurrencyBRL(totals.totalLiquido)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-amber-800/80 dark:text-amber-400">
                  <span>ITENS NO PDV:</span>
                  <span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                </div>
                {fretesVinculados.length > 0 && (
                  <div className="flex justify-between text-[10px] text-amber-800/80 dark:text-amber-400">
                    <span>FRETE VINCULADO:</span>
                    <span>{formatCurrencyBRL(totals.totalFrete)} ({fretesVinculados.length} veíc.)</span>
                  </div>
                )}
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-2 border-t border-slate-200 dark:border-stone-700 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSaveDraftModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs font-bold border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 uppercase"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-xs font-black bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white shadow-xs uppercase tracking-wider cursor-pointer"
                >
                  💾 CONFIRMAR E SALVAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. MODAL DE COMPROVANTE DUPLO • A4 RETRATO & TÉRMICA 80MM (ANTI-SANDBOX)
         ===================================================================== */}
      {isReceiptOpen && lastFinishedSale && (
        <div 
          className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
          onClick={() => setIsReceiptOpen(false)}
        >
          <div 
            className={`bg-white dark:bg-stone-900 rounded-xl border border-slate-300 dark:border-stone-700 shadow-2xl flex flex-col my-auto transition-all duration-200 overflow-hidden ${
              activePrintFormat === 'a4' ? 'max-w-4xl w-full' : 'max-w-md w-full'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header do Modal com Seletor de Formato */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-100 dark:bg-stone-800 border-b border-slate-300 dark:border-stone-700">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                  COMPROVANTE DE VENDA • PDV
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-stone-700 text-slate-700 dark:text-stone-300">
                  {lastFinishedSale.orderNumber}
                </span>
              </div>

              {/* Seletor Rápido de Formato (Térmica 80mm vs Folha A4 Retrato) */}
              <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-stone-900 p-0.5 rounded-lg border border-slate-300 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => setActivePrintFormat('termica')}
                  className={`px-2.5 py-1 rounded text-[10px] font-black uppercase transition cursor-pointer flex items-center gap-1 ${
                    activePrintFormat === 'termica'
                      ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-stone-400 hover:text-black dark:hover:text-white'
                  }`}
                  title="Formato Bobina Térmica 80mm"
                >
                  <Receipt className="w-3 h-3" />
                  <span>📟 TÉRMICA 80MM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePrintFormat('a4')}
                  className={`px-2.5 py-1 rounded text-[10px] font-black uppercase transition cursor-pointer flex items-center gap-1 ${
                    activePrintFormat === 'a4'
                      ? 'bg-white text-zinc-900 dark:bg-stone-800 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-stone-400 hover:text-black dark:hover:text-white'
                  }`}
                  title="Formato Folha A4 Retrato"
                >
                  <FileText className="w-3 h-3" />
                  <span>🖨️ FOLHA A4 RETRATO</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsReceiptOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-black dark:hover:text-white cursor-pointer"
                title="Fechar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Faixa Informativa Anti-Sandbox */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/60 px-4 py-1.5 flex items-center justify-between text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>PROTEÇÃO ANTI-SANDBOX: Visualização na tela com opções de impressão direta, cópia para WhatsApp/e-mail e download do espelho de venda.</span>
              </span>
              {copiedFeedback && (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-black uppercase animate-in fade-in">
                  <CheckCheck className="w-3.5 h-3.5" />
                  COPIADO COM SUCESSO!
                </span>
              )}
            </div>

            {/* Área de Conteúdo Scrollável */}
            <div className="p-3 sm:p-4 max-h-[75vh] overflow-y-auto bg-slate-100 dark:bg-stone-950">
              {/* =============================================================
                  FORMATO 1: FOLHA A4 RETRATO (ESPELHO DE PEDIDO / NOTA DE VENDA)
                 ============================================================= */}
              {activePrintFormat === 'a4' ? (
                <div id="espelho-a4-imprimivel" className="bg-white text-zinc-900 p-6 sm:p-8 rounded-lg border border-slate-300 shadow-md font-sans text-xs space-y-4">
                  {/* Cabeçalho Formal A4 */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b-2 border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <Tractor className="w-6 h-6 text-emerald-700" />
                        <h2 className="text-base font-black uppercase tracking-tight text-zinc-900">
                          {companyProfile?.name || 'AGROCONTROL • SOLUÇÕES AGRÍCOLAS & FORRAGENS'}
                        </h2>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                        <div>
                          <span className="font-bold">CNPJ/CPF:</span> {companyProfile?.cnpjCpf || companyProfile?.cnpj || '12.345.678/0001-90'}
                          {companyProfile?.stateRegistration && <span className="ml-2"><span className="font-bold">IE:</span> {companyProfile.stateRegistration}</span>}
                        </div>
                        <div>
                          <span className="font-bold">ENDEREÇO:</span> {companyProfile?.address || 'Rodovia BR-163, KM 120'} • {companyProfile?.city || 'Sorriso'} - {companyProfile?.state || 'MT'}
                        </div>
                        <div>
                          <span className="font-bold">CONTATO:</span> {companyProfile?.phone || '(66) 99988-7766'} • {companyProfile?.email || 'contato@agrocontrol.com.br'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-slate-300 sm:pl-4 min-w-[200px]">
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-black text-[10px] uppercase tracking-wider mb-1">
                        ESPELHO DE PEDIDO DE BALCÃO
                      </span>
                      <div className="text-lg font-black font-mono text-zinc-900">
                        {lastFinishedSale.orderNumber}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        EMISSÃO: {lastFinishedSale.date} às {lastFinishedSale.time}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        STATUS: <span className="font-bold text-emerald-700 uppercase">FATURADO / CONCLUÍDO</span>
                      </div>
                    </div>
                  </div>

                  {/* Dados do Cliente / Produtor Rural */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="block text-[9px] font-black text-slate-500 uppercase">PRODUTOR / CLIENTE:</span>
                      <span className="font-bold text-zinc-900 uppercase truncate block">
                        {lastFinishedSale.client}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-500 uppercase">FAZENDA / DESTINO:</span>
                      <span className="font-semibold text-zinc-800 uppercase truncate block">
                        {lastFinishedSale.farmName || 'Fazenda do Produtor'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-500 uppercase">FORMA DE PAGAMENTO:</span>
                      <span className="font-bold text-emerald-800 uppercase truncate block">
                        {lastFinishedSale.forma}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black text-slate-500 uppercase">TIPO COBRANÇA:</span>
                      <span className="font-bold text-sky-800 uppercase truncate block">
                        {lastFinishedSale.tipoCobranca || 'CARTEIRA (CONTA INTERNA)'}
                      </span>
                    </div>
                    {lastFinishedSale.bancoEmissor && (
                      <div className="sm:col-span-4 bg-sky-50 border border-sky-200 rounded px-2 py-1 text-[10px] flex items-center gap-1.5 font-bold text-sky-900">
                        <Building2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                        <span className="uppercase">CONTA EMISSORA DO BOLETO (PRIORITÁRIA):</span>
                        <span className="font-mono font-black">{lastFinishedSale.bancoEmissor}</span>
                      </div>
                    )}
                  </div>

                  {/* Grade de Itens (Tabela Zebrada com Padrão AgroControl) */}
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-200 text-slate-800 text-[10px] font-black uppercase border-b border-slate-300">
                        <tr>
                          <th className="py-1.5 px-2 w-8 text-center">#</th>
                          <th className="py-1.5 px-2 w-20">CÓDIGO</th>
                          <th className="py-1.5 px-2">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                          <th className="py-1.5 px-2 w-14 text-center">UNID</th>
                          <th className="py-1.5 px-2 w-16 text-right">QTDE</th>
                          <th className="py-1.5 px-2 w-24 text-right">VALOR UNIT.</th>
                          <th className="py-1.5 px-2 w-20 text-right">DESC.</th>
                          <th className="py-1.5 px-2 w-28 text-right">TOTAL LÍQUIDO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px] font-medium">
                        {lastFinishedSale.items.map((it, idx) => (
                          <tr key={idx} className="even:bg-[#eaeaea] odd:bg-white hover:bg-slate-100 transition">
                            <td className="py-1 px-2 text-center text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                            <td className="py-1 px-2 font-mono font-bold text-slate-700 text-[10px]">{it.codigo || 'DIV'}</td>
                            <td className="py-1 px-2 font-bold text-zinc-900">{it.descricao}</td>
                            <td className="py-1 px-2 text-center font-bold text-slate-600">{it.unidade}</td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-zinc-900">
                              {it.quantidade.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-slate-700">
                              {formatCurrencyBRL(it.precoUnitario)}
                            </td>
                            <td className="py-1 px-2 text-right font-mono text-rose-600">
                              {it.percentualDesconto > 0 ? `${it.percentualDesconto.toFixed(1).replace('.', ',')}%` : '-'}
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-black text-zinc-900">
                              {formatCurrencyBRL(it.totalLiquido)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bloco Inferior: Parcelas & Totais Financeiros */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Programação de Parcelas (se a prazo) */}
                    <div>
                      {lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 ? (
                        <div className="border border-slate-300 rounded-lg overflow-hidden">
                          <div className="bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-700 border-b border-slate-300 flex justify-between items-center">
                            <span>PROGRAMAÇÃO DE PARCELAS A RECEBER</span>
                            <span className="text-emerald-700 font-mono">{lastFinishedSale.parcelas.length}x PARCELAS</span>
                          </div>
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-500 border-b border-slate-200">
                              <tr>
                                <th className="py-1 px-2">PARCELA</th>
                                <th className="py-1 px-2">VENCIMENTO</th>
                                <th className="py-1 px-2 text-right">VALOR (R$)</th>
                                <th className="py-1 px-2 text-center">SITUAÇÃO</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10px]">
                              {lastFinishedSale.parcelas.map(p => (
                                <tr key={p.numero} className="even:bg-slate-50 odd:bg-white">
                                  <td className="py-1 px-2 font-bold text-slate-700">{p.numero}ª Parcela</td>
                                  <td className="py-1 px-2 font-semibold text-slate-700">{formatDateBR(p.vencimento)}</td>
                                  <td className="py-1 px-2 text-right font-mono font-black text-zinc-900">{formatCurrencyBRL(p.valor)}</td>
                                  <td className="py-1 px-2 text-center font-bold text-amber-700 uppercase text-[9px]">A RECEBER</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600">
                          <span className="font-bold block uppercase text-slate-700 mb-1">OBSERVAÇÕES DA OPERAÇÃO:</span>
                          <p>Venda faturada e liquidada integralmente no balcão de atendimento via {lastFinishedSale.forma}.</p>
                        </div>
                      )}
                    </div>

                    {/* Resumo de Fechamento Financeiro */}
                    <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 space-y-1.5 self-start">
                      <div className="flex justify-between text-xs text-slate-700">
                        <span className="font-bold uppercase">SUBTOTAL BRUTO:</span>
                        <span className="font-mono font-bold">{formatCurrencyBRL(lastFinishedSale.totalBruto)}</span>
                      </div>
                      {lastFinishedSale.totalDesconto > 0 && (
                        <div className="flex justify-between text-xs text-rose-600">
                          <span className="font-bold uppercase">DESCONTOS CONCEDIDOS:</span>
                          <span className="font-mono font-bold">-{formatCurrencyBRL(lastFinishedSale.totalDesconto)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-emerald-800 pt-1.5 border-t-2 border-slate-300">
                        <span className="uppercase">TOTAL LÍQUIDO A PAGAR:</span>
                        <span className="font-mono">{formatCurrencyBRL(lastFinishedSale.totalLiquido)}</span>
                      </div>
                      {lastFinishedSale.valorPago > 0 && (
                        <div className="flex justify-between text-xs text-slate-700 pt-1 border-t border-dashed border-slate-200">
                          <span className="font-semibold uppercase">VALOR RECEBIDO:</span>
                          <span className="font-mono font-bold">{formatCurrencyBRL(lastFinishedSale.valorPago)}</span>
                        </div>
                      )}
                      {lastFinishedSale.troco > 0 && (
                        <div className="flex justify-between text-xs text-blue-700">
                          <span className="font-bold uppercase">TROCO DEVOLVIDO:</span>
                          <span className="font-mono font-black">{formatCurrencyBRL(lastFinishedSale.troco)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Termo de Recebimento e Assinaturas */}
                  <div className="pt-4 border-t border-slate-300 text-[10px] text-slate-600 space-y-4">
                    <p className="italic text-center text-slate-500">
                      "Declaro ter conferido e recebido os produtos/serviços acima relacionados em perfeita ordem, concordando com as condições comerciais e datas de vencimento discriminadas neste documento."
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                      <div className="text-center">
                        <div className="border-t border-slate-400 w-4/5 mx-auto mb-1"></div>
                        <span className="font-bold uppercase text-zinc-900 block truncate">{lastFinishedSale.client}</span>
                        <span className="text-[9px] text-slate-500 uppercase">ASSINATURA DO CLIENTE / PRODUTOR</span>
                      </div>
                      <div className="text-center">
                        <div className="border-t border-slate-400 w-4/5 mx-auto mb-1"></div>
                        <span className="font-bold uppercase text-zinc-900 block">{companyProfile?.name || 'AGROCONTROL'}</span>
                        <span className="text-[9px] text-slate-500 uppercase">RESPONSÁVEL PELO CAIXA / EMISSOR</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* =============================================================
                   FORMATO 2: TÉRMICA 80MM (CUPOM RÁPIDO NÃO FISCAL)
                   ============================================================= */
                <div id="cupom-pdv-imprimivel" className="w-full max-w-[340px] mx-auto bg-white text-zinc-900 p-4 rounded-lg border border-slate-300 shadow-md font-mono text-[11px] space-y-2">
                  <div className="text-center pb-2 border-b border-dashed border-slate-400">
                    <div className="font-black text-xs uppercase">{companyProfile?.name || 'AGROCONTROL SILAGEM'}</div>
                    <div className="text-[10px] text-slate-600">{companyProfile?.cnpjCpf || companyProfile?.cnpj ? `CNPJ/CPF: ${companyProfile.cnpjCpf || companyProfile.cnpj}` : 'SISTEMA DE VENDAS AGRÍCOLAS'}</div>
                    <div className="text-[10px] text-slate-600">{lastFinishedSale.date} às {lastFinishedSale.time}</div>
                    <div className="text-[11px] font-black mt-1 uppercase text-zinc-900">
                      CUPOM: {lastFinishedSale.orderNumber}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">CLIENTE:</span>
                    <div className="font-bold truncate uppercase">{lastFinishedSale.client}</div>
                    {lastFinishedSale.farmName && (
                      <div className="text-[10px] text-slate-600 truncate uppercase">{lastFinishedSale.farmName}</div>
                    )}
                  </div>

                  <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1">
                    <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase">
                      <span>ITEM / QTD x UN</span>
                      <span>TOTAL</span>
                    </div>
                    {lastFinishedSale.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-[10.5px] leading-tight">
                        <span className="truncate pr-1">
                          {it.quantidade.toFixed(1).replace('.', ',')}x {it.descricao}
                        </span>
                        <span className="font-bold shrink-0">{formatCurrencyBRL(it.totalLiquido)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-0.5 text-xs pt-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-bold">SUBTOTAL:</span>
                      <span className="font-mono font-bold">{formatCurrencyBRL(lastFinishedSale.totalBruto)}</span>
                    </div>
                    {lastFinishedSale.totalDesconto > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span className="font-bold">DESCONTOS:</span>
                        <span className="font-mono font-bold">-{formatCurrencyBRL(lastFinishedSale.totalDesconto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm text-emerald-800 pt-1 border-t border-slate-300">
                      <span>TOTAL LÍQUIDO:</span>
                      <span>{formatCurrencyBRL(lastFinishedSale.totalLiquido)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-700 pt-1">
                      <span className="font-bold">PAGAMENTO:</span>
                      <span className="font-black uppercase text-right">{lastFinishedSale.forma}</span>
                    </div>
                    {lastFinishedSale.bancoEmissor && (
                      <div className="text-[9.5px] text-sky-800 font-bold pt-0.5">
                        BANCO: {lastFinishedSale.bancoEmissor}
                      </div>
                    )}
                    {lastFinishedSale.troco > 0 && (
                      <div className="flex justify-between text-[10px] text-blue-700">
                        <span className="font-bold">TROCO:</span>
                        <span className="font-bold">{formatCurrencyBRL(lastFinishedSale.troco)}</span>
                      </div>
                    )}
                  </div>

                  {lastFinishedSale.parcelas && lastFinishedSale.parcelas.length > 0 && (
                    <div className="border-t border-dashed border-slate-400 pt-1.5 text-[10px] space-y-0.5">
                      <span className="font-black text-slate-600 uppercase block">PARCELAS A RECEBER:</span>
                      {lastFinishedSale.parcelas.map(p => (
                        <div key={p.numero} className="flex justify-between">
                          <span>{p.numero}ª ({formatDateBR(p.vencimento)}):</span>
                          <span className="font-bold">{formatCurrencyBRL(p.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-center pt-2 text-[9px] text-slate-500 uppercase border-t border-dashed border-slate-400">
                    OBRIGADO PELA PREFERÊNCIA • VOLTE SEMPRE!
                  </div>
                </div>
              )}
            </div>

            {/* Ações do Modal com Suporte Anti-Sandbox */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 dark:bg-stone-850 border-t border-slate-300 dark:border-stone-700 rounded-b-xl">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyComprovante}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700 transition cursor-pointer shadow-2xs"
                  title="Copiar dados do comprovante para enviar no WhatsApp ou e-mail"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{copiedFeedback ? 'COPIADO!' : 'COPIAR DADOS'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadComprovante}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-stone-800 border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700 transition cursor-pointer shadow-2xs"
                  title="Baixar espelho ou cupom de venda em arquivo texto"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>BAIXAR ARQUIVO</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  FECHAR
                </button>
                <button
                  type="button"
                  onClick={handlePrintSafe}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-black dark:bg-stone-100 dark:text-zinc-900 dark:hover:bg-white transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>IMPRIMIR {activePrintFormat === 'a4' ? 'ESPELHO A4' : 'CUPOM 80MM'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          6. MODAL DE AUTORIZAÇÃO DE DESCONTO MASTER (PADRÃO OURO)
         ===================================================================== */}
      {isMasterAuthModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => {
            setIsMasterAuthModalOpen(false);
            setMasterAuthError('');
            setMasterPasswordInput('');
          }}
        >
          <div 
            className="bg-white dark:bg-stone-900 border-2 border-amber-500/90 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden select-none animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho Dourado Padrão Ouro */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 px-3.5 py-2.5 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-100" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  🔑 AUTORIZAÇÃO DE DESCONTO MASTER
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMasterAuthModalOpen(false);
                  setMasterAuthError('');
                  setMasterPasswordInput('');
                }}
                className="p-1 hover:bg-black/20 rounded transition text-amber-100 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário de Autorização */}
            <form onSubmit={handleConfirmMasterAuth} className="p-3.5 space-y-3">
              {/* Quadro Informativo de Alçadas */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg p-2.5 text-[11px] space-y-1">
                <div className="flex justify-between items-center text-slate-700 dark:text-stone-300">
                  <span className="font-bold text-[10px] uppercase text-slate-500 dark:text-stone-400">ITEM:</span>
                  <span className="font-black truncate max-w-[200px] text-right uppercase">
                    {(inputDescricao || inputBusca || 'PRODUTO SELECIONADO').trim()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[10px] uppercase text-slate-500 dark:text-stone-400">DESCONTO SOLICITADO:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={attemptedDiscount > 0 ? attemptedDiscount : parseFloat(inputDesconto.replace(',', '.')) || maxDiscountAllowed}
                      onChange={e => setAttemptedDiscount(parseFloat(e.target.value) || 0)}
                      className="w-16 px-1 py-0.5 text-right font-black text-rose-600 dark:text-rose-400 text-xs border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-stone-800"
                    />
                    <span className="font-black text-rose-600 dark:text-rose-400 text-xs">%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-semibold text-slate-500 dark:text-stone-400 uppercase">TETO PERMITIDO ({roleBadgeLabel}):</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {maxDiscountAllowed.toFixed(2).replace('.', ',')}%
                  </span>
                </div>
              </div>

              {/* Input da Senha do Administrador */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-stone-300 tracking-wider mb-1 flex items-center justify-between">
                  <span>SENHA DO ADMINISTRADOR</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    autoFocus
                    value={masterPasswordInput}
                    onChange={e => {
                      setMasterPasswordInput(e.target.value);
                      if (masterAuthError) setMasterAuthError('');
                    }}
                    placeholder="DIGITE A SENHA DO ADMINISTRADOR..."
                    className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-amber-400 dark:border-amber-700 bg-white dark:bg-stone-800 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(prev => !prev)}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-stone-200 cursor-pointer p-0.5"
                    title={showMasterPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showMasterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {masterAuthError && (
                  <p className="mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase animate-in fade-in">
                    * {masterAuthError}
                  </p>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsMasterAuthModalOpen(false);
                    setMasterAuthError('');
                    setMasterPasswordInput('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 text-xs font-bold uppercase hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-extrabold uppercase shadow-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>AUTORIZAR E INSERIR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
