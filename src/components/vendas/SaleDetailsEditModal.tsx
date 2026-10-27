import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  FileText,
  Receipt,
  Plus,
  Trash2,
  DollarSign,
  Truck,
  User,
  Calendar,
  CreditCard,
  Building2,
  Printer,
  Save,
  Check,
  Search
} from 'lucide-react';
import { ServiceOrder, CompanyProfile, Machinery } from '../../types';
import { formatCurrencyBRL, formatDateBR } from '../../lib/storage';
import { generatePrintableSaleHtml } from './PdvView';

interface SaleItem {
  id: string;
  codigo?: string;
  descricao: string;
  qtd: number;
  precoUnitario: number;
  totalItem: number;
}

interface SaleFreight {
  id: string;
  veiculoId?: string;
  veiculoIdentificacao: string;
  tipoCalculo: 'fixo' | 'km';
  valorUnitario: number;
  kmRodados?: number;
  valorTotal: number;
}

interface SaleDetailsEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleRecord: ServiceOrder | null;
  companyProfile?: CompanyProfile | null;
  onSaveSuccess?: (updatedSale: any) => void;
}

export const SaleDetailsEditModal: React.FC<SaleDetailsEditModalProps> = ({
  isOpen,
  onClose,
  saleRecord,
  companyProfile,
  onSaveSuccess,
}) => {
  // Dados Mestre da Venda
  const [orderNumber, setOrderNumber] = useState('');
  const [saleId, setSaleId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState('');
  const [dataVenda, setDataVenda] = useState('');
  const [horaVenda, setHoraVenda] = useState('12:00');
  const [formaPagamento, setFormaPagamento] = useState('À VISTA');
  const [tipoCobranca, setTipoCobranca] = useState('CARTEIRA');
  const [desconto, setDesconto] = useState(0);

  // Itens e Fretes da Venda
  const [items, setItems] = useState<SaleItem[]>([]);
  const [initialItems, setInitialItems] = useState<SaleItem[]>([]);
  const [fretes, setFretes] = useState<SaleFreight[]>([]);

  // Auxiliares de Busca e Sugestões
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [clientSearchFilter, setClientSearchFilter] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [newFreteTipo, setNewFreteTipo] = useState<'fixo' | 'km'>('fixo');
  const [newFreteValor, setNewFreteValor] = useState('');
  const [newFreteKm, setNewFreteKm] = useState('');

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Atalho global ESC para fechar a janela
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Carregar listas de Clientes, Produtos e Veículos
  useEffect(() => {
    if (!isOpen) return;

    // 1. Clientes
    try {
      const rawC = localStorage.getItem('agrocontrol_clientes') || localStorage.getItem('colaca_silagem_clientes') || '[]';
      const parsedC = JSON.parse(rawC);
      if (Array.isArray(parsedC)) setAvailableClients(parsedC);
    } catch {}

    // 2. Produtos
    try {
      const rawP = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos') || '[]';
      const parsedP = JSON.parse(rawP);
      if (Array.isArray(parsedP)) {
        setAvailableProducts(parsedP);
        if (parsedP.length > 0 && !selectedProductId) {
          setSelectedProductId(String(parsedP[0].id));
        }
      }
    } catch {}

    // 3. Frota / Veículos
    try {
      const rawV = localStorage.getItem('agrocontrol_frotas_veiculos') || localStorage.getItem('agrocontrol_frotas') || '[]';
      const parsedV = JSON.parse(rawV);
      if (Array.isArray(parsedV)) {
        setAvailableVehicles(parsedV);
        if (parsedV.length > 0 && !selectedVehicleId) {
          setSelectedVehicleId(String(parsedV[0].id));
        }
      }
    } catch {}
  }, [isOpen]);

  // Carregar dados da Venda Selecionada
  useEffect(() => {
    if (!isOpen || !saleRecord) return;

    let targetSale: any = null;
    const rawVendas = localStorage.getItem('agrocontrol_vendas') || localStorage.getItem('agrocontrol_pdv_vendas');
    if (rawVendas) {
      try {
        const vendasList = JSON.parse(rawVendas);
        if (Array.isArray(vendasList)) {
          targetSale = vendasList.find((v: any) =>
            (saleRecord.id && String(v.id) === String(saleRecord.id)) ||
            (saleRecord.orderNumber && (v.orderNumber === saleRecord.orderNumber || v.numeroPedido === saleRecord.orderNumber)) ||
            (v.id && String(v.id) === String(saleRecord.orderNumber))
          );
        }
      } catch {}
    }

    const resolvedNumber = targetSale?.numeroPedido || targetSale?.orderNumber || saleRecord.orderNumber || `PDV-${saleRecord.id}`;
    const resolvedId = targetSale?.id || saleRecord.id;
    const resolvedCliente = targetSale?.cliente || targetSale?.clientName || saleRecord.clientName || 'CONSUMIDOR FINAL / BALCÃO';
    const resolvedDoc = targetSale?.clienteCpfCnpj || '';

    let resolvedDate = targetSale?.date || saleRecord.startDate || saleRecord.date || '';
    if (!resolvedDate && targetSale?.data) {
      if (targetSale.data.includes('/')) {
        const parts = targetSale.data.split('/');
        if (parts.length === 3) resolvedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        resolvedDate = targetSale.data;
      }
    }
    if (!resolvedDate) resolvedDate = new Date().toISOString().split('T')[0];

    const resolvedHora = targetSale?.hora || '12:00';
    let resolvedForma = (targetSale?.formaPagamento || 'A VISTA').toUpperCase();
    if (resolvedForma === 'A_VISTA') resolvedForma = 'À VISTA';
    if (resolvedForma === 'CARTAO_DEBITO') resolvedForma = 'DÉBITO';
    if (resolvedForma === 'CARTAO_CREDITO') resolvedForma = 'CRÉDITO';
    if (resolvedForma === 'PRAZO') resolvedForma = 'A PRAZO';

    const resolvedTipoCobranca = (targetSale?.tipoCobranca || 'CARTEIRA').toUpperCase();
    const resolvedDesconto = Number(targetSale?.desconto || 0);

    // Carregar Itens
    let loadedItems: SaleItem[] = [];
    if (targetSale?.itens && Array.isArray(targetSale.itens) && targetSale.itens.length > 0) {
      loadedItems = targetSale.itens.map((it: any) => ({
        id: String(it.id || it.productId || Date.now()),
        codigo: String(it.codigo || ''),
        descricao: String(it.descricao || it.name || 'Produto Sem Descrição'),
        qtd: Number(it.qtd ?? it.quantidade ?? 1),
        precoUnitario: Number(it.precoUnitario ?? it.price ?? 0),
        totalItem: Number((it.qtd ?? it.quantidade ?? 1) * (it.precoUnitario ?? it.price ?? 0)),
      }));
    } else if (saleRecord.totalAmount) {
      loadedItems = [
        {
          id: String(saleRecord.id),
          codigo: 'ITEM-01',
          descricao: saleRecord.serviceType || 'Venda Balcão PDV',
          qtd: 1,
          precoUnitario: Number(saleRecord.totalAmount),
          totalItem: Number(saleRecord.totalAmount),
        },
      ];
    }

    // Carregar Fretes
    let loadedFretes: SaleFreight[] = [];
    if (targetSale?.fretes && Array.isArray(targetSale.fretes)) {
      loadedFretes = targetSale.fretes.map((fr: any, idx: number) => ({
        id: String(fr.id || `fr_${idx}_${Date.now()}`),
        veiculoId: fr.veiculoId ? String(fr.veiculoId) : undefined,
        veiculoIdentificacao: fr.veiculoIdentificacao || 'VEÍCULO DIVERSO',
        tipoCalculo: fr.tipoCalculo === 'km' ? 'km' : 'fixo',
        valorUnitario: Number(fr.valorUnitario || 0),
        kmRodados: fr.kmRodados ? Number(fr.kmRodados) : undefined,
        valorTotal: Number(fr.valorTotal || fr.valorUnitario || 0),
      }));
    }

    setOrderNumber(resolvedNumber);
    setSaleId(resolvedId);
    setClienteNome(resolvedCliente);
    setClienteCpfCnpj(resolvedDoc);
    setDataVenda(resolvedDate);
    setHoraVenda(resolvedHora);
    setFormaPagamento(resolvedForma);
    setTipoCobranca(resolvedTipoCobranca);
    setDesconto(resolvedDesconto);
    setItems(loadedItems);
    setInitialItems(JSON.parse(JSON.stringify(loadedItems)));
    setFretes(loadedFretes);
  }, [isOpen, saleRecord]);

  // Recálculo Reativo de Totais
  const totals = useMemo(() => {
    const subtotalItens = items.reduce((acc, it) => acc + (it.qtd * it.precoUnitario), 0);
    const totalFrete = fretes.reduce((acc, fr) => acc + Number(fr.valorTotal || 0), 0);
    const totalBruto = subtotalItens + totalFrete;
    const totalLiquido = Math.max(0, totalBruto - (desconto || 0));
    return {
      subtotalItens,
      totalFrete,
      totalBruto,
      totalLiquido,
    };
  }, [items, fretes, desconto]);

  // Manipulação de Itens
  const handleItemChange = (index: number, field: 'qtd' | 'precoUnitario', val: number) => {
    setItems(prev => {
      const next = [...prev];
      const target = { ...next[index] };
      if (field === 'qtd') target.qtd = Math.max(0, val);
      if (field === 'precoUnitario') target.precoUnitario = Math.max(0, val);
      target.totalItem = target.qtd * target.precoUnitario;
      next[index] = target;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddItemFromStock = () => {
    if (!selectedProductId) return;
    const prod = availableProducts.find(p => String(p.id) === String(selectedProductId));
    if (!prod) return;

    const newItem: SaleItem = {
      id: String(prod.id),
      codigo: String(prod.codigo || prod.code || ''),
      descricao: String(prod.nome_comercial || prod.name || prod.item || 'Produto'),
      qtd: 1,
      precoUnitario: Number(prod.preco_venda || prod.preco || prod.price || 0),
      totalItem: Number(prod.preco_venda || prod.preco || prod.price || 0),
    };

    setItems(prev => [...prev, newItem]);
  };

  // Manipulação de Fretes
  const handleAddFrete = () => {
    const veh = availableVehicles.find(v => String(v.id) === String(selectedVehicleId));
    const vehDesc = veh
      ? `${veh.plate || veh.placa || ''} - ${veh.model || veh.modelo || veh.name || 'Veículo'}`.trim()
      : 'VEÍCULO FRETE';

    const valUnit = parseFloat(newFreteValor.replace(',', '.')) || 0;
    const km = parseFloat(newFreteKm.replace(',', '.')) || 0;
    const valTotal = newFreteTipo === 'km' ? km * valUnit : valUnit;

    const newF: SaleFreight = {
      id: `fr_${Date.now()}`,
      veiculoId: selectedVehicleId || undefined,
      veiculoIdentificacao: vehDesc,
      tipoCalculo: newFreteTipo,
      valorUnitario: valUnit,
      kmRodados: newFreteTipo === 'km' ? km : undefined,
      valorTotal: valTotal,
    };

    setFretes(prev => [...prev, newF]);
    setNewFreteValor('');
    setNewFreteKm('');
  };

  const handleRemoveFrete = (freightId: string) => {
    setFretes(prev => prev.filter(f => f.id !== freightId));
  };

  const handleUpdateFreteItem = (index: number, field: 'tipoCalculo' | 'valorUnitario' | 'kmRodados', val: any) => {
    setFretes(prev => {
      const next = [...prev];
      const target = { ...next[index] };
      if (field === 'tipoCalculo') {
        target.tipoCalculo = val;
        if (val === 'fixo') target.kmRodados = undefined;
      } else if (field === 'valorUnitario') {
        target.valorUnitario = Math.max(0, Number(val));
      } else if (field === 'kmRodados') {
        target.kmRodados = Math.max(0, Number(val));
      }

      if (target.tipoCalculo === 'km') {
        target.valorTotal = (target.kmRodados || 0) * (target.valorUnitario || 0);
      } else {
        target.valorTotal = target.valorUnitario || 0;
      }

      next[index] = target;
      return next;
    });
  };

  // Construção do objeto final para salvar e reimprimir
  const buildCurrentSalePayload = () => {
    let dataFormatadaPtBr = dataVenda;
    if (dataVenda.includes('-')) {
      const parts = dataVenda.split('-');
      if (parts.length === 3) dataFormatadaPtBr = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return {
      id: saleId,
      numeroPedido: orderNumber,
      orderNumber: orderNumber,
      numeroVenda: orderNumber,
      data: dataFormatadaPtBr,
      date: dataVenda,
      data_formatada: dataFormatadaPtBr,
      hora: horaVenda,
      cliente: clienteNome,
      clientName: clienteNome,
      clienteCpfCnpj: clienteCpfCnpj,
      itens: items.map(it => ({
        id: it.id,
        codigo: it.codigo,
        descricao: it.descricao,
        qtd: it.qtd,
        precoUnitario: it.precoUnitario,
        totalItem: it.totalItem,
      })),
      fretes: fretes.map(fr => ({
        id: fr.id,
        veiculoId: fr.veiculoId,
        veiculoIdentificacao: fr.veiculoIdentificacao,
        tipoCalculo: fr.tipoCalculo,
        valorUnitario: fr.valorUnitario,
        kmRodados: fr.kmRodados,
        valorTotal: fr.valorTotal,
      })),
      totalBruto: totals.totalBruto,
      desconto: desconto,
      totalLiquido: totals.totalLiquido,
      valorLiquido: totals.totalLiquido,
      totalAmount: totals.totalLiquido,
      ratePerUnit: totals.totalLiquido,
      formaPagamento: formaPagamento,
      tipoCobranca: tipoCobranca,
      status: formaPagamento === 'A PRAZO' ? 'pendente' : 'concluido',
    };
  };

  // 3. INTELIGÊNCIA REATIVA DE ATUALIZAÇÃO AO SALVAR EDIÇÃO
  const handleSalvarAlteracoes = () => {
    try {
      const payload = buildCurrentSalePayload();

      // A) ESTOQUE REAL ('agrocontrol_produtos')
      try {
        const rawProdutos = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos') || '[]';
        const produtosAtuais = JSON.parse(rawProdutos);
        if (Array.isArray(produtosAtuais)) {
          // 1. Processar itens originais (estornar se excluído ou abater/estornar diferença)
          initialItems.forEach((orig) => {
            const current = items.find(it => String(it.id) === String(orig.id) || (it.codigo && String(it.codigo) === String(orig.codigo)));
            const pEstoque = produtosAtuais.find((p: any) =>
              (orig.id && String(p.id) === String(orig.id)) ||
              (orig.codigo && p.codigo && String(p.codigo).trim().toUpperCase() === String(orig.codigo).trim().toUpperCase()) ||
              (orig.descricao && (p.nome_comercial || p.name || p.item) && String(p.nome_comercial || p.name || p.item).trim().toUpperCase() === String(orig.descricao).trim().toUpperCase())
            );

            if (pEstoque && pEstoque.categoria !== 'SERVIÇOS' && pEstoque.category !== 'SERVIÇOS') {
              const origQtd = Number(orig.qtd || 1);
              const saldoAtual = Number(pEstoque.quantity || pEstoque.quantidade_atual || 0);

              if (!current) {
                // Item foi deletado da venda: devolve saldo integral
                const novoSaldo = saldoAtual + origQtd;
                pEstoque.quantity = novoSaldo;
                pEstoque.quantidade_atual = novoSaldo;
              } else {
                // Item permaneceu: aplica a diferença
                const curQtd = Number(current.qtd || 1);
                const diff = curQtd - origQtd; // ex: 2 -> 1, diff = -1 (estorna 1). 1 -> 3, diff = +2 (abate 2)
                const novoSaldo = Math.max(0, saldoAtual - diff);
                pEstoque.quantity = novoSaldo;
                pEstoque.quantidade_atual = novoSaldo;
              }
            }
          });

          // 2. Processar itens novos adicionados que não existiam originalmente
          items.forEach((it) => {
            const isOriginal = initialItems.some(orig => String(orig.id) === String(it.id) || (orig.codigo && String(orig.codigo) === String(it.codigo)));
            if (!isOriginal) {
              const pEstoque = produtosAtuais.find((p: any) =>
                (it.id && String(p.id) === String(it.id)) ||
                (it.codigo && p.codigo && String(p.codigo).trim().toUpperCase() === String(it.codigo).trim().toUpperCase()) ||
                (it.descricao && (p.nome_comercial || p.name || p.item) && String(p.nome_comercial || p.name || p.item).trim().toUpperCase() === String(it.descricao).trim().toUpperCase())
              );
              if (pEstoque && pEstoque.categoria !== 'SERVIÇOS' && pEstoque.category !== 'SERVIÇOS') {
                const saldoAtual = Number(pEstoque.quantity || pEstoque.quantidade_atual || 0);
                const novoSaldo = Math.max(0, saldoAtual - Number(it.qtd || 1));
                pEstoque.quantity = novoSaldo;
                pEstoque.quantidade_atual = novoSaldo;
              }
            }
          });

          localStorage.setItem('agrocontrol_produtos', JSON.stringify(produtosAtuais));
          localStorage.setItem('colaca_silagem_estoque_produtos', JSON.stringify(produtosAtuais));
          window.dispatchEvent(new CustomEvent('agrocontrol_produtos_updated', { detail: produtosAtuais }));
          window.dispatchEvent(new CustomEvent('inventory_updated', { detail: produtosAtuais }));
        }
      } catch (errEstoque) {
        console.error('Erro ao atualizar estoque:', errEstoque);
      }

      // B) FINANCEIRO ('agrocontrol_vendas' e 'agrocontrol_receber')
      try {
        const rawVendas = localStorage.getItem('agrocontrol_vendas') || localStorage.getItem('agrocontrol_pdv_vendas') || '[]';
        let vendasList = JSON.parse(rawVendas);
        if (!Array.isArray(vendasList)) vendasList = [];

        const indexFound = vendasList.findIndex((v: any) =>
          (saleId && String(v.id) === String(saleId)) ||
          (orderNumber && (v.orderNumber === orderNumber || v.numeroPedido === orderNumber))
        );

        if (indexFound >= 0) {
          vendasList[indexFound] = { ...vendasList[indexFound], ...payload };
        } else {
          vendasList.unshift(payload);
        }

        localStorage.setItem('agrocontrol_vendas', JSON.stringify(vendasList));
        localStorage.setItem('agrocontrol_pdv_vendas', JSON.stringify(vendasList));
        localStorage.setItem('colaca_silagem_vendas_pdv', JSON.stringify(vendasList));
        window.dispatchEvent(new CustomEvent('agrocontrol_vendas_updated', { detail: vendasList }));
        window.dispatchEvent(new CustomEvent('agrocontrol_vendas_change', { detail: vendasList }));
        window.dispatchEvent(new CustomEvent('vendas_updated', { detail: vendasList }));
      } catch (errVendas) {
        console.error('Erro ao atualizar vendas:', errVendas);
      }

      // C) CONTAS A RECEBER ('agrocontrol_financeiro_receber', 'agrocontrol_receber')
      try {
        const rawReceber = localStorage.getItem('agrocontrol_financeiro_receber') || localStorage.getItem('agrocontrol_receber') || '[]';
        let receberList = JSON.parse(rawReceber);
        if (Array.isArray(receberList)) {
          const targetNum = orderNumber || saleId;
          const parcelasVenda = receberList.filter((r: any) =>
            r.orderNumber === targetNum ||
            r.numeroPedido === targetNum ||
            r.vendaId === saleId ||
            (r.description && r.description.includes(targetNum))
          );

          if (parcelasVenda.length > 0) {
            const count = parcelasVenda.length;
            const valorParcela = Math.round((totals.totalLiquido / count) * 100) / 100;
            parcelasVenda.forEach((p: any, idx: number) => {
              p.clientName = clienteNome;
              p.cliente = clienteNome;
              p.totalAmount = valorParcela;
              p.valor = valorParcela;
              p.valor_parcela = valorParcela;
              p.description = `Venda ${orderNumber} (${idx + 1}/${count})`;
            });
          } else if (formaPagamento === 'A PRAZO') {
            receberList.unshift({
              id: `REC-${saleId || Date.now()}`,
              orderNumber: orderNumber,
              numeroPedido: orderNumber,
              vendaId: saleId,
              clientName: clienteNome,
              cliente: clienteNome,
              description: `Venda a Prazo ${orderNumber}`,
              date: dataVenda,
              dueDate: dataVenda,
              totalAmount: totals.totalLiquido,
              valor: totals.totalLiquido,
              status: 'PENDENTE'
            });
          }
          localStorage.setItem('agrocontrol_contas_receber', JSON.stringify(receberList));
          localStorage.setItem('agrocontrol_financeiro_receber', JSON.stringify(receberList));
          localStorage.setItem('agrocontrol_receber', JSON.stringify(receberList));
          window.dispatchEvent(new CustomEvent('agrocontrol_contas_receber_updated', { detail: receberList }));
          window.dispatchEvent(new CustomEvent('agrocontrol_receber_updated', { detail: receberList }));
        }
      } catch (errReceber) {
        console.error('Erro ao atualizar Contas a Receber:', errReceber);
      }

      setStatusMessage('ALTERAÇÕES SALVAS COM SUCESSO!');
      if (onSaveSuccess) onSaveSuccess(payload);

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (e) {
      console.error('Erro ao salvar alterações da venda:', e);
      setStatusMessage('ERRO AO SALVAR ALTERAÇÕES.');
    }
  };

  // 4. BARRA DE FERRAMENTAS DO RODAPÉ (IMPRESSÃO CASADA DE RETAGUARDA)
  const handleReimprimir = (format: 'a4' | 'termica') => {
    try {
      const currentPayload = buildCurrentSalePayload();
      const printHtml = generatePrintableSaleHtml(currentPayload, format, companyProfile);
      const printWindow = window.open('', '_blank');
      if (printWindow && printWindow.document) {
        printWindow.document.open();
        printWindow.document.write(printHtml);
        printWindow.document.close();
      } else {
        alert('Janela de impressão bloqueada pelo navegador. Permita pop-ups para esta página.');
      }
    } catch (err) {
      console.error('Erro ao reimprimir venda:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 1. CABEÇALHO MDI TRIDIMENSIONAL ACETINADO EM CAIXA ALTA */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 px-4 py-2.5 text-white flex items-center justify-between shadow-xs border-b border-amber-700/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg">📝</span>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider font-['Outfit']">
              DETALHES E EDIÇÃO DA VENDA: {orderNumber || 'PEDIDO'}
            </h3>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-black bg-black/20 text-white border border-white/20 uppercase">
              {formaPagamento} • {items.length} {items.length === 1 ? 'ITEM' : 'ITENS'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-black/20 rounded transition text-amber-100 hover:text-white cursor-pointer"
            title="Fechar [ESC]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. ESTRUTURA INTERNA SEM POLUIÇÃO (MIOLO DO FORMULÁRIO COM TRÊS BLOCOS) */}
        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto no-scrollbar space-y-3 bg-slate-100/70 dark:bg-stone-950/60">

          {/* STATUS TOAST NOTIFICATION */}
          {statusMessage && (
            <div className="p-2 rounded bg-emerald-600 text-white text-xs font-black uppercase text-center shadow-xs animate-in fade-in">
              {statusMessage}
            </div>
          )}

          {/* =========================================================================
              BLOCO 1: DADOS DA VENDA (Inputs em linha única / grid fino de aço)
             ========================================================================= */}
          <div className="border border-slate-300 dark:border-stone-700 rounded bg-white dark:bg-stone-900 p-3 shadow-xs space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-stone-800 pb-1.5">
              <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-black uppercase text-slate-800 dark:text-stone-200 tracking-wider">
                1. DADOS DA VENDA & CLIENTE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              {/* Cliente com Busca e Seleção */}
              <div className="sm:col-span-2 relative">
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  CLIENTE SELECIONADO *:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clienteNome}
                    onChange={e => {
                      setClienteNome(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="DIGITE O NOME OU SELECIONE..."
                    className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-850 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  {showClientDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md shadow-lg max-h-40 overflow-y-auto z-20">
                      <div
                        onClick={() => {
                          setClienteNome('CONSUMIDOR FINAL / BALCÃO');
                          setShowClientDropdown(false);
                        }}
                        className="px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-stone-800 text-xs font-bold uppercase cursor-pointer text-slate-800 dark:text-stone-200 border-b border-slate-100 dark:border-stone-800"
                      >
                        CONSUMIDOR FINAL / BALCÃO
                      </div>
                      {availableClients
                        .filter(c => (c.name || c.nome || '').toLowerCase().includes(clienteNome.toLowerCase()))
                        .map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setClienteNome(c.name || c.nome);
                              setClienteCpfCnpj(c.cpfCnpj || c.document || '');
                              setShowClientDropdown(false);
                            }}
                            className="px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-stone-800 text-xs font-bold uppercase cursor-pointer text-slate-800 dark:text-stone-200"
                          >
                            {c.name || c.nome} {c.farmName || c.fazenda ? `(${c.farmName || c.fazenda})` : ''}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Data da Venda */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  DATA DA VENDA *:
                </label>
                <input
                  type="date"
                  value={dataVenda}
                  onChange={e => setDataVenda(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-850 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  FORMA DE PAGAMENTO *:
                </label>
                <select
                  value={formaPagamento}
                  onChange={e => setFormaPagamento(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-850 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="À VISTA">À VISTA (DINHEIRO)</option>
                  <option value="PIX">PIX</option>
                  <option value="DÉBITO">CARTÃO DÉBITO</option>
                  <option value="CRÉDITO">CARTÃO CRÉDITO</option>
                  <option value="A PRAZO">A PRAZO</option>
                </select>
              </div>
            </div>

            {/* Linha auxiliar: Tipo de cobrança & Desconto */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  TIPO DE COBRANÇA:
                </label>
                <select
                  value={tipoCobranca}
                  onChange={e => setTipoCobranca(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-850 text-xs font-bold text-zinc-900 dark:text-white uppercase shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="CARTEIRA">CARTEIRA (CONTA INTERNA)</option>
                  <option value="BOLETO">BOLETO BANCÁRIO</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                  DESCONTO GERAL (R$):
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={desconto || ''}
                  onChange={e => setDesconto(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-850 text-xs font-bold text-zinc-900 dark:text-white font-mono shadow-2xs outline-none focus:ring-1 focus:ring-amber-500 text-right"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-end">
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-500 dark:text-stone-400 block">
                    TOTAL LÍQUIDO RECALCULADO:
                  </span>
                  <span className="text-lg font-black font-mono text-amber-700 dark:text-amber-400">
                    {formatCurrencyBRL(totals.totalLiquido)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              BLOCO 2: GRADE DE ITENS VENDIDOS (Tabela Horizontal py-1 com fundo zebrado)
             ========================================================================= */}
          <div className="border border-slate-300 dark:border-stone-700 rounded bg-white dark:bg-stone-900 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-black uppercase text-slate-800 dark:text-stone-200 tracking-wider">
                  2. GRADE DE PRODUTOS & QUANTIDADES ({items.length} {items.length === 1 ? 'ITEM' : 'ITENS'})
                </span>
              </div>

              {/* Seletor rápido para incluir outro produto do estoque se necessário */}
              {availableProducts.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    className="px-2 py-0.5 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-850 text-[10px] font-bold text-zinc-900 dark:text-white uppercase outline-none max-w-[180px] truncate"
                  >
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome_comercial || p.name || p.item}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddItemFromStock}
                    className="px-2 py-0.5 rounded bg-slate-200 hover:bg-amber-500 hover:text-white text-slate-800 text-[10px] font-black uppercase transition cursor-pointer flex items-center gap-1 border border-slate-400"
                    title="Adicionar produto selecionado"
                  >
                    <Plus className="w-3 h-3" />
                    <span>ADICIONAR</span>
                  </button>
                </div>
              )}
            </div>

            {/* TABELA HORIZONTAL COMPACTA COM FUNDO ZEBRADO */}
            <div className="rounded border border-slate-200 dark:border-stone-700 overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-200 dark:bg-stone-800 text-[10px] font-black uppercase text-slate-700 dark:text-stone-300 border-b border-slate-300 dark:border-stone-700">
                  <tr>
                    <th className="py-1 px-2.5">PRODUTO / ITEM</th>
                    <th className="py-1 px-2.5 w-28 text-center">QUANTIDADE</th>
                    <th className="py-1 px-2.5 w-32 text-right">PREÇO UNIT. (R$)</th>
                    <th className="py-1 px-2.5 w-32 text-right">TOTAL ITEM</th>
                    <th className="py-1 px-2 text-center w-12">AÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-stone-800 font-semibold text-[11px]">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-slate-500 text-xs uppercase font-bold">
                        Nenhum item cadastrado nesta venda.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr
                        key={item.id || idx}
                        className="even:bg-[#eaeaea] odd:bg-white dark:even:bg-stone-850 dark:odd:bg-stone-900 transition-colors"
                      >
                        {/* Descrição */}
                        <td className="py-1 px-2.5 text-slate-900 dark:text-white uppercase">
                          <span className="font-bold">{item.descricao}</span>
                          {item.codigo && (
                            <span className="ml-2 font-mono text-[9px] text-slate-500 bg-slate-200 dark:bg-stone-700 px-1 py-0.2 rounded">
                              CÓD: {item.codigo}
                            </span>
                          )}
                        </td>

                        {/* Quantidade editável */}
                        <td className="py-1 px-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.qtd}
                            onChange={e => handleItemChange(idx, 'qtd', parseFloat(e.target.value) || 0)}
                            className="w-20 px-1.5 py-0.5 text-center font-bold font-mono rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </td>

                        {/* Preço Unitário editável */}
                        <td className="py-1 px-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.precoUnitario}
                            onChange={e => handleItemChange(idx, 'precoUnitario', parseFloat(e.target.value) || 0)}
                            className="w-24 px-1.5 py-0.5 text-right font-bold font-mono rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-zinc-900 dark:text-white shadow-2xs outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </td>

                        {/* Total Recalculado */}
                        <td className="py-1 px-2.5 text-right font-black font-mono text-zinc-900 dark:text-white">
                          {formatCurrencyBRL(item.qtd * item.precoUnitario)}
                        </td>

                        {/* Exclusão */}
                        <td className="py-1 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="w-5 h-5 rounded-full inline-flex items-center justify-center bg-rose-100 hover:bg-rose-600 text-rose-600 hover:text-white transition cursor-pointer text-xs font-black"
                            title="Remover este item da venda"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* =========================================================================
              BLOCO 3: FRETE E LOGÍSTICA (Ajuste de valor fixo ou km rodados)
             ========================================================================= */}
          <div className="border border-slate-300 dark:border-stone-700 rounded bg-white dark:bg-stone-900 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-black uppercase text-slate-800 dark:text-stone-200 tracking-wider">
                  3. FRETE E LOGÍSTICA VINCULADA
                </span>
              </div>
              {fretes.length > 0 && (
                <span className="text-[10px] font-mono font-black text-amber-700 dark:text-amber-400 uppercase">
                  TOTAL FRETE: {formatCurrencyBRL(totals.totalFrete)}
                </span>
              )}
            </div>

            {/* Linha para adicionar novo frete se necessário */}
            <div className="bg-slate-100 dark:bg-stone-850 p-2 border border-slate-300 dark:border-stone-700 rounded flex flex-wrap items-center gap-2 text-[11px]">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">
                  VEÍCULO DA FROTA:
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-[11px] font-bold text-zinc-900 dark:text-white uppercase"
                >
                  {availableVehicles.map(veh => (
                    <option key={veh.id} value={veh.id}>
                      {veh.plate || veh.placa || ''} - {veh.model || veh.modelo || veh.name || 'Veículo'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-32">
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">
                  CÁLCULO:
                </label>
                <select
                  value={newFreteTipo}
                  onChange={e => setNewFreteTipo(e.target.value as any)}
                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-[11px] font-bold text-zinc-900 dark:text-white uppercase"
                >
                  <option value="fixo">VALOR FIXO (R$)</option>
                  <option value="km">POR KM (R$/KM)</option>
                </select>
              </div>

              <div className="w-24">
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">
                  VALOR / TAXA:
                </label>
                <input
                  type="text"
                  value={newFreteValor}
                  onChange={e => setNewFreteValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-2 py-1 text-right font-mono font-bold rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-[11px] text-zinc-900 dark:text-white"
                />
              </div>

              {newFreteTipo === 'km' && (
                <div className="w-20">
                  <label className="block text-[9px] font-black uppercase text-slate-500 mb-0.5">
                    KM:
                  </label>
                  <input
                    type="text"
                    value={newFreteKm}
                    onChange={e => setNewFreteKm(e.target.value)}
                    placeholder="Ex: 50"
                    className="w-full px-2 py-1 text-right font-mono font-bold rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-[11px] text-zinc-900 dark:text-white"
                  />
                </div>
              )}

              <div className="self-end">
                <button
                  type="button"
                  onClick={handleAddFrete}
                  className="px-2.5 py-1 rounded bg-slate-200 hover:bg-amber-500 hover:text-white text-slate-800 text-[10px] font-black uppercase transition cursor-pointer border border-slate-400"
                >
                  + VINCULAR
                </button>
              </div>
            </div>

            {/* Listagem e Ajuste de Fretes Existentes */}
            {fretes.length > 0 && (
              <div className="rounded border border-slate-200 dark:border-stone-700 overflow-hidden divide-y divide-slate-200 dark:divide-stone-700 bg-white dark:bg-stone-900">
                {fretes.map((fr, fIdx) => (
                  <div
                    key={fr.id}
                    className="p-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs font-semibold even:bg-[#eaeaea] odd:bg-white dark:even:bg-stone-850 dark:odd:bg-stone-900"
                  >
                    <div className="font-bold text-slate-900 dark:text-white uppercase flex-1 min-w-[160px]">
                      {fr.veiculoIdentificacao}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={fr.tipoCalculo}
                        onChange={e => handleUpdateFreteItem(fIdx, 'tipoCalculo', e.target.value)}
                        className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-stone-600 text-[10px] font-bold uppercase bg-white dark:bg-stone-800"
                      >
                        <option value="fixo">VALOR FIXO</option>
                        <option value="km">POR KM RODADO</option>
                      </select>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={fr.valorUnitario}
                        onChange={e => handleUpdateFreteItem(fIdx, 'valorUnitario', parseFloat(e.target.value) || 0)}
                        placeholder="Valor"
                        className="w-20 px-1 py-0.5 text-right font-mono font-bold rounded border border-slate-300 dark:border-stone-600 text-[10px] bg-white dark:bg-stone-800"
                        title="Valor unitário ou taxa fixa"
                      />

                      {fr.tipoCalculo === 'km' && (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={fr.kmRodados || ''}
                          onChange={e => handleUpdateFreteItem(fIdx, 'kmRodados', parseFloat(e.target.value) || 0)}
                          placeholder="KM"
                          className="w-16 px-1 py-0.5 text-right font-mono font-bold rounded border border-slate-300 dark:border-stone-600 text-[10px] bg-white dark:bg-stone-800"
                          title="Quilômetros rodados"
                        />
                      )}

                      <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-xs min-w-[90px] text-right">
                        {formatCurrencyBRL(fr.valorTotal)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveFrete(fr.id)}
                        className="w-5 h-5 rounded-full inline-flex items-center justify-center bg-rose-100 hover:bg-rose-600 text-rose-600 hover:text-white transition cursor-pointer text-xs font-black"
                        title="Remover frete deste veículo"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* =========================================================================
            4. BARRA DE FERRAMENTAS DO RODAPÉ (IMPRESSÃO CASADA DE RETAGUARDA)
           ========================================================================= */}
        <div className="p-2.5 sm:p-3 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-t border-slate-300 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          
          {/* À Esquerda: Botões de Impressão Casada */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleReimprimir('a4')}
              className="px-3 py-1.5 rounded-lg text-xs font-black border border-sky-400 bg-sky-50 hover:bg-sky-500 hover:text-white text-sky-800 transition cursor-pointer uppercase tracking-wider flex items-center gap-1.5 shadow-2xs"
              title="Abrir espelho formal da venda em Folha A4 Retrato"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ REIMPRIMIR EM FOLHA A4</span>
            </button>

            <button
              type="button"
              onClick={() => handleReimprimir('termica')}
              className="px-3 py-1.5 rounded-lg text-xs font-black border border-emerald-400 bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-800 transition cursor-pointer uppercase tracking-wider flex items-center gap-1.5 shadow-2xs"
              title="Abrir comprovante térmico em bobina de 80mm"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>📟 REIMPRIMIR EM TÉRMICA 80MM</span>
            </button>
          </div>

          {/* À Direita: Cancelar e Salvar Alterações */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer uppercase tracking-wider"
            >
              ✕ [ESC] CANCELAR
            </button>

            <button
              type="button"
              onClick={handleSalvarAlteracoes}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-black bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.4),0_2px_4px_rgba(0,0,0,0.2)] transition active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>💾 SALVAR ALTERAÇÕES DA VENDA</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
