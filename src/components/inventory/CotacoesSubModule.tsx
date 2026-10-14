import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Building2, 
  Award, 
  Search, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  Trash2, 
  Save, 
  Printer, 
  FolderOpen, 
  X, 
  AlertTriangle,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import { InventoryItem, CompanyProfile } from '../../types';
import { formatCurrencyBRL } from '../../lib/formatters';
import { getStoredCompanyProfile, formatDateBR } from '../../lib/storage';
import { PrintPreviewModal } from '../common/PrintPreviewModal';

interface CotacoesSubModuleProps {
  allItems: InventoryItem[];
}

export interface CotacaoPrecos {
  [itemId: string]: {
    precoA?: number;
    precoB?: number;
    precoC?: number;
    quantity?: number;
  };
}

export interface QuotedItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  lastCost: number;
}

export interface HistoricoCotacaoItem extends QuotedItem {
  precoA?: number;
  precoB?: number;
  precoC?: number;
}

export interface HistoricoCotacao {
  id: string;
  nome: string;
  data: string;
  fornecedores: [string, string, string];
  itens: HistoricoCotacaoItem[];
}

const HISTORICO_STORAGE_KEY = 'agrocontrol_historico_cotacoes';

// Gerador do HTML A4 de Comparativo de Cotações para Impressão Anti-Sandbox
function generateCotacaoPrintHtml(
  items: QuotedItem[],
  cotacoes: CotacaoPrecos,
  fornecedores: [string, string, string],
  cotacaoNome: string,
  company: CompanyProfile,
  totals: { totalA: number; totalB: number; totalC: number },
  bestSupplier: { id: string; name: string; total: number } | null
): string {
  const [fA, fB, fC] = fornecedores;
  const now = new Date();
  const dateFormatted = formatDateBR(now.toISOString().split('T')[0]);
  const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const rows = items.map((it, idx) => {
    const itemKey = it.productId || it.id;
    const pData = cotacoes[itemKey] || {};
    const pA = pData.precoA;
    const pB = pData.precoB;
    const pC = pData.precoC;
    const qty = it.quantity || 1;

    const activePrices: { key: string; val: number }[] = [];
    if (pA !== undefined && pA > 0) activePrices.push({ key: 'F-A', val: pA * qty });
    if (pB !== undefined && pB > 0) activePrices.push({ key: 'F-B', val: pB * qty });
    if (pC !== undefined && pC > 0) activePrices.push({ key: 'F-C', val: pC * qty });

    let minVal = -1;
    if (activePrices.length >= 2) {
      minVal = Math.min(...activePrices.map(x => x.val));
    }

    const bestOffer = activePrices.length > 0
      ? activePrices.reduce((prev, curr) => curr.val < prev.val ? curr : prev)
      : null;

    return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 5px 8px; font-family: monospace; font-size: 10px; font-weight: bold; color: #475569;">${it.code || 'S/CÓD'}</td>
        <td style="padding: 5px 8px; font-size: 10px; font-weight: bold; color: #0f172a; text-transform: uppercase;">${it.name}</td>
        <td style="padding: 5px 8px; font-size: 10px; font-weight: 800; text-align: center; font-family: monospace; color: #0f172a;">${qty.toLocaleString('pt-BR')} ${it.unit || 'UN'}</td>
        <td style="padding: 5px 8px; font-size: 10px; text-align: right; font-family: monospace; color: #64748b;">${formatCurrencyBRL(it.lastCost)}</td>
        <td style="padding: 5px 8px; font-size: 10px; text-align: right; font-family: monospace; color: #1e3a8a; background-color: ${pA && pA * qty === minVal ? '#dcfce7' : 'transparent'}; font-weight: ${pA && pA * qty === minVal ? '900' : 'normal'};">
          ${pA !== undefined && pA > 0 ? formatCurrencyBRL(pA * qty) : '--'}
        </td>
        <td style="padding: 5px 8px; font-size: 10px; text-align: right; font-family: monospace; color: #92400e; background-color: ${pB && pB * qty === minVal ? '#dcfce7' : 'transparent'}; font-weight: ${pB && pB * qty === minVal ? '900' : 'normal'};">
          ${pB !== undefined && pB > 0 ? formatCurrencyBRL(pB * qty) : '--'}
        </td>
        <td style="padding: 5px 8px; font-size: 10px; text-align: right; font-family: monospace; color: #581c87; background-color: ${pC && pC * qty === minVal ? '#dcfce7' : 'transparent'}; font-weight: ${pC && pC * qty === minVal ? '900' : 'normal'};">
          ${pC !== undefined && pC > 0 ? formatCurrencyBRL(pC * qty) : '--'}
        </td>
        <td style="padding: 5px 8px; font-size: 10px; text-align: center; font-family: monospace; font-weight: 900; color: #059669;">
          ${bestOffer ? `${bestOffer.key} (${formatCurrencyBRL(bestOffer.val)})` : '--'}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="font-family: Arial, sans-serif; color: #1e293b; padding: 10px;">
      <div style="margin-bottom: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="margin: 0; font-size: 17px; font-weight: 900; text-transform: uppercase; color: #0f172a;">
            📊 COMPARATIVO MULTIFORNECEDOR DE COTAÇÕES
          </h2>
          <p style="margin: 3px 0 0; font-size: 11px; color: #059669; font-weight: 800; text-transform: uppercase;">
            COTAÇÃO: ${cotacaoNome || 'COTAÇÃO ATIVA'}
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; font-weight: 800; color: #0f172a;">DATA: ${dateFormatted} ${timeFormatted}</div>
          <div style="font-size: 10px; color: #64748b; font-weight: bold;">ITENS COTADOS: ${items.length}</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff; text-align: left; text-transform: uppercase; font-size: 9px;">
            <th style="padding: 7px 8px; width: 10%;">CÓDIGO</th>
            <th style="padding: 7px 8px;">DESCRIÇÃO DO ITEM</th>
            <th style="padding: 7px 8px; width: 10%; text-align: center;">QTDE</th>
            <th style="padding: 7px 8px; width: 11%; text-align: right;">ÚLT. BASE</th>
            <th style="padding: 7px 8px; width: 15%; text-align: right; background-color: #1e3a8a;">${fA || 'FORNECEDOR A'}</th>
            <th style="padding: 7px 8px; width: 15%; text-align: right; background-color: #92400e;">${fB || 'FORNECEDOR B'}</th>
            <th style="padding: 7px 8px; width: 15%; text-align: right; background-color: #581c87;">${fC || 'FORNECEDOR C'}</th>
            <th style="padding: 7px 8px; width: 14%; text-align: center;">MELHOR OFERTA</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr style="background-color: #f1f5f9; border-top: 2px solid #0f172a; font-weight: 900;">
            <td colspan="4" style="padding: 8px; font-size: 10px; text-transform: uppercase; color: #0f172a;">
              SOMA TOTAL POR FORNECEDOR:
            </td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 11px; color: #1e3a8a;">
              ${formatCurrencyBRL(totals.totalA)}
            </td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 11px; color: #92400e;">
              ${formatCurrencyBRL(totals.totalB)}
            </td>
            <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 11px; color: #581c87;">
              ${formatCurrencyBRL(totals.totalC)}
            </td>
            <td style="padding: 8px; text-align: center; font-family: monospace; font-size: 11px; color: #059669; font-weight: 900;">
              ${bestSupplier ? bestSupplier.name : '--'}
            </td>
          </tr>
        </tfoot>
      </table>

      ${bestSupplier ? `
        <div style="margin-top: 10px; padding: 10px 14px; background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #047857; letter-spacing: 0.5px;">
              🏆 VENCEDOR DA CONCORRÊNCIA (MELHOR OPÇÃO GLOBAL):
            </div>
            <div style="font-size: 13px; font-weight: 900; color: #065f46; text-transform: uppercase; margin-top: 2px;">
              ${bestSupplier.name}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9px; font-weight: bold; color: #047857; text-transform: uppercase;">TOTAL DA COTAÇÃO</div>
            <div style="font-size: 14px; font-weight: 900; font-family: monospace; color: #047857;">
              ${formatCurrencyBRL(bestSupplier.total)}
            </div>
          </div>
        </div>
      ` : ''}

      <div style="margin-top: 14px; padding: 8px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; font-size: 9px; color: #64748b; line-height: 1.4;">
        <strong>AUDITORIA COMERCIAL:</strong> Mapa comparativo de concorrência gerado de forma autônoma para análise de melhor custo-benefício de suprimentos e almoxarifado.
      </div>
    </div>
  `;
}

// Gerador do texto do WhatsApp para a cotação
function generateCotacaoWhatsAppText(
  items: QuotedItem[],
  fornecedores: [string, string, string],
  cotacaoNome: string,
  company: CompanyProfile,
  totals: { totalA: number; totalB: number; totalC: number },
  bestSupplier: { id: string; name: string; total: number } | null
): string {
  const [fA, fB, fC] = fornecedores;
  const now = new Date();
  const dateStr = formatDateBR(now.toISOString().split('T')[0]);

  let text = `📊 *${company.tradeName?.toUpperCase() || 'AGROCONTROL'}*\n`;
  text += `📋 *COMPARATIVO DE COTAÇÕES*\n`;
  text += `🏷️ *Cotação:* ${cotacaoNome || 'GERAL'}\n`;
  text += `📅 *Data:* ${dateStr} • *Itens:* ${items.length}\n\n`;

  text += `🏢 *FORNECEDORES CONCORRENTES:*\n`;
  text += `1️⃣ *${fA}:* ${formatCurrencyBRL(totals.totalA)}\n`;
  text += `2️⃣ *${fB}:* ${formatCurrencyBRL(totals.totalB)}\n`;
  text += `3️⃣ *${fC}:* ${formatCurrencyBRL(totals.totalC)}\n\n`;

  if (bestSupplier) {
    text += `🏆 *MELHOR OPÇÃO GLOBAL:* ${bestSupplier.name} (${formatCurrencyBRL(bestSupplier.total)})\n\n`;
  }

  text += `_Emitido via Silagem Fácil Pro / AgroControl_`;
  return text;
}

export const CotacoesSubModule: React.FC<CotacoesSubModuleProps> = ({
  allItems,
}) => {
  // 1. CARREGAMENTO REATIVO DE PRODUTOS CADASTRADOS (agrocontrol_produtos)
  const [storedProducts, setStoredProducts] = useState<InventoryItem[]>(() => {
    try {
      const raw = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return allItems || [];
  });

  useEffect(() => {
    const handleProductsUpdate = () => {
      try {
        const raw = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setStoredProducts(parsed);
          }
        }
      } catch (_) {}
    };

    window.addEventListener('agrocontrol_produtos_updated', handleProductsUpdate);
    window.addEventListener('storage', handleProductsUpdate);
    return () => {
      window.removeEventListener('agrocontrol_produtos_updated', handleProductsUpdate);
      window.removeEventListener('storage', handleProductsUpdate);
    };
  }, []);

  const availableProducts = useMemo(() => {
    if (storedProducts && storedProducts.length > 0) return storedProducts;
    return allItems || [];
  }, [storedProducts, allItems]);

  const companyProfile = useMemo(() => {
    try {
      return getStoredCompanyProfile();
    } catch (_) {
      return {
        tradeName: 'SILAGEM FÁCIL ERP',
        corporateName: 'SILAGEM FÁCIL AGRONEGÓCIOS LTDA',
      } as CompanyProfile;
    }
  }, []);

  // Nomes dos 3 fornecedores concorrentes (persistidos)
  const [fornecedorA, setFornecedorA] = useState<string>(() => {
    return localStorage.getItem('colaca_cotacao_fornecedor_a') || 'FORNECEDOR A (DISTRIBUIDOR PRINCIPAL)';
  });
  const [fornecedorB, setFornecedorB] = useState<string>(() => {
    return localStorage.getItem('colaca_cotacao_fornecedor_b') || 'FORNECEDOR B (ATACADÃO REGIONAL)';
  });
  const [fornecedorC, setFornecedorC] = useState<string>(() => {
    return localStorage.getItem('colaca_cotacao_fornecedor_c') || 'FORNECEDOR C (COOPERATIVA AGRO)';
  });

  // Mapa de preços cotados por item: { [id]: { precoA, precoB, precoC } }
  const [cotacoes, setCotacoes] = useState<CotacaoPrecos>(() => {
    try {
      const saved = localStorage.getItem('colaca_cotacao_precos_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Lista de itens cotados atualmente na tela
  const [quotedItems, setQuotedItems] = useState<QuotedItem[]>(() => {
    try {
      const raw = localStorage.getItem('agrocontrol_cotacao_itens') || localStorage.getItem('colaca_cotacao_itens_list');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const savedPrices = localStorage.getItem('colaca_cotacao_precos_map');
      if (savedPrices) {
        const map = JSON.parse(savedPrices);
        const keys = Object.keys(map);
        if (keys.length > 0) {
          const prodsRaw = localStorage.getItem('agrocontrol_produtos');
          const prodsList: InventoryItem[] = prodsRaw ? JSON.parse(prodsRaw) : allItems;
          const matched = prodsList
            .filter(p => keys.includes(p.id))
            .map(p => ({
              id: p.id,
              productId: p.id,
              code: (p.code || (p as any).codigo_produto || 'S/CÓD').toUpperCase(),
              name: (p.nome_comercial || p.name || 'PRODUTO').toUpperCase(),
              category: (p.categoria || p.category || 'GERAL').toUpperCase(),
              unit: (p.unit || 'UN').toUpperCase(),
              quantity: map[p.id]?.quantity || 1,
              lastCost: Number(p.preco_custo_inicial ?? p.unitCost ?? 0),
            }));
          if (matched.length > 0) return matched;
        }
      }
    } catch (_) {}
    return [];
  });

  // Identificação da cotação ativa carregada (id e nome)
  const [activeCotacaoId, setActiveCotacaoId] = useState<string | null>(null);
  const [activeCotacaoNome, setActiveCotacaoNome] = useState<string>('');

  // 2. BANCO HISTÓRICO DE COTAÇÕES ARQUIVADAS (agrocontrol_historico_cotacoes)
  const [historicoCotacoes, setHistoricoCotacoes] = useState<HistoricoCotacao[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORICO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });

  // Salvar no localStorage sempre que o histórico for atualizado
  const persistHistorico = (lista: HistoricoCotacao[]) => {
    setHistoricoCotacoes(lista);
    try {
      localStorage.setItem(HISTORICO_STORAGE_KEY, JSON.stringify(lista));
    } catch (_) {}
  };

  // Salvar no localStorage sempre que os dados atuais da tela alterarem
  useEffect(() => {
    try {
      localStorage.setItem('colaca_cotacao_fornecedor_a', fornecedorA);
    } catch (_) {}
  }, [fornecedorA]);

  useEffect(() => {
    try {
      localStorage.setItem('colaca_cotacao_fornecedor_b', fornecedorB);
    } catch (_) {}
  }, [fornecedorB]);

  useEffect(() => {
    try {
      localStorage.setItem('colaca_cotacao_fornecedor_c', fornecedorC);
    } catch (_) {}
  }, [fornecedorC]);

  useEffect(() => {
    try {
      localStorage.setItem('colaca_cotacao_precos_map', JSON.stringify(cotacoes));
    } catch (_) {}
  }, [cotacoes]);

  useEffect(() => {
    try {
      localStorage.setItem('agrocontrol_cotacao_itens', JSON.stringify(quotedItems));
      localStorage.setItem('colaca_cotacao_itens_list', JSON.stringify(quotedItems));
    } catch (_) {}
  }, [quotedItems]);

  // Estados da Barra de Inserção Rápida Horizontal (PDV)
  const [searchProductText, setSearchProductText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('1,00');
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // Filtro geral da tabela
  const [searchTerm, setSearchTerm] = useState('');

  // Estados dos Modais
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveNomeInput, setSaveNomeInput] = useState('');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const [isClearDeleteModalOpen, setIsClearDeleteModalOpen] = useState(false);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Toast temporário de sucesso/aviso
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const productInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Foco inicial e atalho F3
  useEffect(() => {
    productInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        productInputRef.current?.focus();
        productInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fechar dropdown de autocomplete ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        productInputRef.current &&
        !productInputRef.current.contains(e.target as Node)
      ) {
        setAutocompleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtro preditivo para o autocomplete
  const filteredProducts = useMemo(() => {
    const term = searchProductText.trim().toLowerCase();
    if (!term) return [];
    return availableProducts.filter(p => {
      const name = String(p.nome_comercial || p.name || '').toLowerCase();
      const code = String(p.code || (p as any).codigo_produto || (p as any).barcode || '').toLowerCase();
      const cat = String(p.categoria || p.category || '').toLowerCase();
      return name.includes(term) || code.includes(term) || cat.includes(term);
    }).slice(0, 10);
  }, [availableProducts, searchProductText]);

  // Multiplicador por Asterisco no campo de busca do Produto
  const handleSearchChange = (val: string) => {
    const upperVal = val.toUpperCase();
    
    const match = upperVal.match(/^(\d+(?:[.,]\d+)?)\*(.*)$/);
    if (match) {
      const numPart = match[1];
      const restText = match[2];
      setQuantity(numPart);
      setSearchProductText(restText);
      setAutocompleteOpen(restText.trim().length > 0);
      productInputRef.current?.focus();
      return;
    }

    setSearchProductText(upperVal);
    setAutocompleteOpen(upperVal.trim().length > 0);
    setAutocompleteIndex(0);

    const exact = availableProducts.find(p => {
      const code = String(p.code || (p as any).codigo_produto || '').trim().toUpperCase();
      const bar = String((p as any).barcode || '').trim().toUpperCase();
      return (code && code === upperVal.trim()) || (bar && bar === upperVal.trim());
    });

    if (exact) {
      setSelectedProduct(exact);
    } else if (selectedProduct && !upperVal.includes(String(selectedProduct.name || '').toUpperCase())) {
      setSelectedProduct(null);
    }
  };

  const handleSelectProduct = (prod: InventoryItem) => {
    setSelectedProduct(prod);
    setSearchProductText(`${prod.code ? `[${prod.code}] ` : ''}${prod.nome_comercial || prod.name}`.toUpperCase());
    setAutocompleteOpen(false);
    productInputRef.current?.focus();
  };

  // Disparo do Adicionar Item na Cotação (+ ADICIONAR ou ENTER)
  const handleAddItemToCotacao = () => {
    const rawQty = quantity.replace(',', '.');
    const numQty = parseFloat(rawQty);
    const finalQty = isNaN(numQty) || numQty <= 0 ? 1 : numQty;

    let targetItem = selectedProduct;
    if (!targetItem && filteredProducts.length > 0 && searchProductText.trim().length > 0) {
      targetItem = filteredProducts[autocompleteIndex] || filteredProducts[0];
    }

    const itemDesc = targetItem 
      ? (targetItem.nome_comercial || targetItem.name || 'PRODUTO').toUpperCase()
      : searchProductText.trim().toUpperCase();

    if (!itemDesc) {
      productInputRef.current?.focus();
      return;
    }

    const itemCode = (targetItem?.code || (targetItem as any)?.codigo_produto || 'S/CÓD').toUpperCase();
    const itemCat = (targetItem?.categoria || targetItem?.category || 'GERAL').toUpperCase();
    const itemUnit = (targetItem?.unit || 'UN').toUpperCase();
    const itemCost = targetItem ? Number(targetItem.preco_custo_inicial ?? targetItem.unitCost ?? (targetItem as any).ultimoCusto ?? 0) : 0;
    const itemId = targetItem?.id || `cot_prod_${Date.now()}`;

    setQuotedItems(prev => {
      const existingIdx = prev.findIndex(p => 
        (p.productId && p.productId === targetItem?.id) ||
        (itemCode !== 'S/CÓD' && p.code === itemCode) || 
        p.name === itemDesc
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + finalQty,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          productId: itemId,
          code: itemCode,
          name: itemDesc,
          category: itemCat,
          unit: itemUnit,
          quantity: finalQty,
          lastCost: itemCost,
        }
      ];
    });

    setSearchProductText('');
    setSelectedProduct(null);
    setQuantity('1,00');
    setAutocompleteOpen(false);

    setTimeout(() => {
      productInputRef.current?.focus();
    }, 10);
  };

  const handleRemoveQuotedItem = (id: string, productId: string) => {
    setQuotedItems(prev => prev.filter(p => p.id !== id));
    setCotacoes(prev => {
      const copy = { ...prev };
      delete copy[productId];
      delete copy[id];
      return copy;
    });
    setTimeout(() => {
      productInputRef.current?.focus();
    }, 10);
  };

  const handlePriceChange = (itemId: string, supplier: 'precoA' | 'precoB' | 'precoC', valStr: string) => {
    const sanitized = valStr.replace(',', '.');
    const val = sanitized === '' ? undefined : parseFloat(sanitized);
    const validVal = val === undefined || isNaN(val) ? undefined : Math.max(0, val);

    setCotacoes(prev => {
      const currentItemPrices = prev[itemId] || {};
      return {
        ...prev,
        [itemId]: {
          ...currentItemPrices,
          [supplier]: validVal,
        },
      };
    });
  };

  // Filtragem dos itens cotados por termo de busca no cabeçalho
  const displayedItems = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return quotedItems;
    return quotedItems.filter(item => {
      const name = String(item.name || '').toLowerCase();
      const code = String(item.code || '').toLowerCase();
      const cat = String(item.category || '').toLowerCase();
      return name.includes(s) || code.includes(s) || cat.includes(s);
    });
  }, [quotedItems, searchTerm]);

  // Cálculos reativos do somatório total de cada fornecedor
  const { totalA, totalB, totalC, countA, countB, countC } = useMemo(() => {
    let tA = 0;
    let tB = 0;
    let tC = 0;
    let cA = 0;
    let cB = 0;
    let cC = 0;

    quotedItems.forEach(item => {
      const itemKey = item.productId || item.id;
      const entry = cotacoes[itemKey] || {};
      const qty = item.quantity || 1;

      if (entry.precoA !== undefined && entry.precoA > 0) {
        tA += entry.precoA * qty;
        cA += 1;
      }
      if (entry.precoB !== undefined && entry.precoB > 0) {
        tB += entry.precoB * qty;
        cB += 1;
      }
      if (entry.precoC !== undefined && entry.precoC > 0) {
        tC += entry.precoC * qty;
        cC += 1;
      }
    });

    return { totalA: tA, totalB: tB, totalC: tC, countA: cA, countB: cB, countC: cC };
  }, [cotacoes, quotedItems]);

  // Identificar qual fornecedor possui a menor soma geral
  const bestSupplier = useMemo(() => {
    const candidates: { id: 'A' | 'B' | 'C'; name: string; total: number; count: number }[] = [];
    if (countA > 0) candidates.push({ id: 'A', name: fornecedorA || 'FORNECEDOR A', total: totalA, count: countA });
    if (countB > 0) candidates.push({ id: 'B', name: fornecedorB || 'FORNECEDOR B', total: totalB, count: countB });
    if (countC > 0) candidates.push({ id: 'C', name: fornecedorC || 'FORNECEDOR C', total: totalC, count: countC });

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => a.total - b.total);
    return candidates[0];
  }, [totalA, totalB, totalC, countA, countB, countC, fornecedorA, fornecedorB, fornecedorC]);

  // 1. ABRIR MODAL PARA SALVAR COTAÇÃO COM NOME
  const handleOpenSaveModal = () => {
    if (quotedItems.length === 0) {
      setToastMessage('ADICIONE AO MENOS UM PRODUTO ANTES DE SALVAR A COTAÇÃO.');
      return;
    }
    setSaveNomeInput(activeCotacaoNome || `COTAÇÃO ${new Date().toLocaleDateString('pt-BR')}`);
    setIsSaveModalOpen(true);
    setTimeout(() => {
      saveInputRef.current?.focus();
      saveInputRef.current?.select();
    }, 50);
  };

  // Confirmar Salvamento de Cotação
  const handleConfirmSaveCotacao = (saveAsNew = false) => {
    const nomeFinal = saveNomeInput.trim().toUpperCase();
    if (!nomeFinal) {
      setToastMessage('INFORME UM NOME VÁLIDO PARA A COTAÇÃO.');
      return;
    }

    const itensComPrecos: HistoricoCotacaoItem[] = quotedItems.map(it => {
      const itemKey = it.productId || it.id;
      const p = cotacoes[itemKey] || {};
      return {
        ...it,
        precoA: p.precoA,
        precoB: p.precoB,
        precoC: p.precoC,
      };
    });

    const isUpdating = activeCotacaoId && !saveAsNew;
    const targetId = isUpdating ? activeCotacaoId : Date.now().toString();

    const cotacaoData: HistoricoCotacao = {
      id: targetId,
      nome: nomeFinal,
      data: new Date().toLocaleDateString('pt-BR'),
      fornecedores: [fornecedorA, fornecedorB, fornecedorC],
      itens: itensComPrecos,
    };

    let novaLista: HistoricoCotacao[];
    if (isUpdating) {
      novaLista = historicoCotacoes.map(c => c.id === targetId ? cotacaoData : c);
    } else {
      novaLista = [cotacaoData, ...historicoCotacoes];
    }

    persistHistorico(novaLista);
    setActiveCotacaoId(targetId);
    setActiveCotacaoNome(nomeFinal);
    setIsSaveModalOpen(false);
    setToastMessage(`💾 COTAÇÃO "${nomeFinal}" SALVA NO HISTÓRICO COM SUCESSO!`);
  };

  // 2. CARREGAR COTAÇÃO ARQUIVADA DO HISTÓRICO
  const handleLoadCotacaoFromHistory = (cotacao: HistoricoCotacao) => {
    setFornecedorA(cotacao.fornecedores[0] || 'FORNECEDOR A');
    setFornecedorB(cotacao.fornecedores[1] || 'FORNECEDOR B');
    setFornecedorC(cotacao.fornecedores[2] || 'FORNECEDOR C');

    // Reconstrói itens e mapa de preços
    const newItems: QuotedItem[] = [];
    const newPrecos: CotacaoPrecos = {};

    (cotacao.itens || []).forEach(it => {
      const itemKey = it.productId || it.id;
      newItems.push({
        id: it.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: it.productId || it.id,
        code: it.code || 'S/CÓD',
        name: it.name || 'PRODUTO',
        category: it.category || 'GERAL',
        unit: it.unit || 'UN',
        quantity: Number(it.quantity) || 1,
        lastCost: Number(it.lastCost) || 0,
      });

      newPrecos[itemKey] = {
        precoA: it.precoA,
        precoB: it.precoB,
        precoC: it.precoC,
        quantity: Number(it.quantity) || 1,
      };
    });

    setQuotedItems(newItems);
    setCotacoes(newPrecos);
    setActiveCotacaoId(cotacao.id);
    setActiveCotacaoNome(cotacao.nome);
    setIsHistoryModalOpen(false);

    setToastMessage(`✓ COTAÇÃO "${cotacao.nome}" CARREGADA COM SUCESSO!`);
    setTimeout(() => {
      productInputRef.current?.focus();
    }, 10);
  };

  // Excluir cotação do histórico
  const handleDeleteCotacaoFromHistory = (id: string, nome: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm(`DESEJA EXCLUIR DEFINITIVAMENTE A COTAÇÃO "${nome}" DO HISTÓRICO?`)) {
      const novaLista = historicoCotacoes.filter(c => c.id !== id);
      persistHistorico(novaLista);
      if (activeCotacaoId === id) {
        setActiveCotacaoId(null);
        setActiveCotacaoNome('');
      }
      setToastMessage(`🗑️ COTAÇÃO "${nome}" REMOVIDA DO HISTÓRICO.`);
    }
  };

  // 3. LIMPAR TELA OU EXCLUIR COTAÇÃO ABERTA
  const handleOpenClearDeleteModal = () => {
    setIsClearDeleteModalOpen(true);
  };

  const handleExecuteClearScreenOnly = () => {
    setQuotedItems([]);
    setCotacoes({});
    setActiveCotacaoId(null);
    setActiveCotacaoNome('');
    try {
      localStorage.removeItem('colaca_cotacao_precos_map');
      localStorage.removeItem('agrocontrol_cotacao_itens');
      localStorage.removeItem('colaca_cotacao_itens_list');
    } catch (_) {}
    setIsClearDeleteModalOpen(false);
    setToastMessage('✨ TELA LIMPA COM SUCESSO. PRONTO PARA NOVA COTAÇÃO!');
    setTimeout(() => {
      productInputRef.current?.focus();
    }, 10);
  };

  const handleExecuteDeleteFromHistoryAndClear = () => {
    if (activeCotacaoId) {
      const novaLista = historicoCotacoes.filter(c => c.id !== activeCotacaoId);
      persistHistorico(novaLista);
    }
    handleExecuteClearScreenOnly();
    setToastMessage('🗑️ COTAÇÃO EXCLUÍDA DO HISTÓRICO E TELA RESETADA COM SUCESSO.');
  };

  // Filtro de cotações dentro do modal de histórico
  const filteredHistory = useMemo(() => {
    const s = historySearchTerm.trim().toLowerCase();
    if (!s) return historicoCotacoes;
    return historicoCotacoes.filter(c => {
      const n = String(c.nome || '').toLowerCase();
      const d = String(c.data || '').toLowerCase();
      const f = c.fornecedores.join(' ').toLowerCase();
      return n.includes(s) || d.includes(s) || f.includes(s);
    });
  }, [historicoCotacoes, historySearchTerm]);

  return (
    <div className="w-full flex flex-col h-[calc(100vh-210px)] min-h-[500px] max-h-[95vh] overflow-hidden global bg-slate-50 dark:bg-stone-900 rounded-lg border border-slate-300 dark:border-stone-700 shadow-xs">
      
      {/* AVISO TEMPORÁRIO DE SUCESSO */}
      {toastMessage && (
        <div className="px-3 py-1.5 rounded border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-black uppercase flex items-center justify-between shadow-xs animate-in fade-in duration-150 shrink-0 mx-2 mt-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. CABEÇALHO FIXO SUPERIOR COM FORNECEDORES CONCORRENTES */}
      <div className="shrink-0 z-20 bg-gradient-to-b from-slate-100 via-white to-slate-100 dark:from-stone-850 dark:via-stone-900 dark:to-stone-850 border-b border-slate-300 dark:border-stone-700 p-2 shadow-xs space-y-1.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-stone-100 tracking-wide">
                  PAINEL DE COTAÇÕES & COMPARATIVO MULTIFORNECEDOR
                </h3>
                {activeCotacaoNome && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <span>📁 ABERTO:</span>
                    <strong className="truncate max-w-[180px]">{activeCotacaoNome}</strong>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-stone-400">
                Histórico com múltiplos salvamentos por nome e inteligência colorimétrica de preços.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* BOTÃO CENTRAL DE HISTÓRICO DE COTAÇÕES */}
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="text-[10px] font-black uppercase px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800 cursor-pointer flex items-center gap-1.5 shadow-xs transition"
              title="Abrir cotações salvas no histórico"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>📜 ABRIR COTAÇÃO SALVA ({historicoCotacoes.length})</span>
            </button>

            <div className="relative w-40 sm:w-48">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                placeholder="FILTRAR NA TABELA..."
                className="w-full pl-7 pr-2 py-0.5 text-[10px] font-bold uppercase rounded border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* INPUTS FIXOS DOS 3 FORNECEDORES CONCORRENTES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 border-t border-slate-200 dark:border-stone-750">
          {/* FORNECEDOR A */}
          <div className="flex items-center gap-1.5 bg-blue-50/70 dark:bg-blue-950/30 p-1 rounded border border-blue-200 dark:border-blue-900/60">
            <span className="text-[9px] font-black uppercase text-blue-800 dark:text-blue-300 w-24 shrink-0">
              FORNECEDOR A:
            </span>
            <input
              type="text"
              value={fornecedorA}
              onChange={(e) => setFornecedorA(e.target.value.toUpperCase())}
              placeholder="DISTRIBUIDOR PRINCIPAL..."
              className="w-full px-2 py-0.5 text-[10px] font-bold uppercase rounded border border-blue-300 dark:border-blue-800 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* FORNECEDOR B */}
          <div className="flex items-center gap-1.5 bg-amber-50/70 dark:bg-amber-950/30 p-1 rounded border border-amber-200 dark:border-amber-900/60">
            <span className="text-[9px] font-black uppercase text-amber-800 dark:text-amber-300 w-24 shrink-0">
              FORNECEDOR B:
            </span>
            <input
              type="text"
              value={fornecedorB}
              onChange={(e) => setFornecedorB(e.target.value.toUpperCase())}
              placeholder="ATACADÃO REGIONAL..."
              className="w-full px-2 py-0.5 text-[10px] font-bold uppercase rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* FORNECEDOR C */}
          <div className="flex items-center gap-1.5 bg-purple-50/70 dark:bg-purple-950/30 p-1 rounded border border-purple-200 dark:border-purple-900/60">
            <span className="text-[9px] font-black uppercase text-purple-800 dark:text-purple-300 w-24 shrink-0">
              FORNECEDOR C:
            </span>
            <input
              type="text"
              value={fornecedorC}
              onChange={(e) => setFornecedorC(e.target.value.toUpperCase())}
              placeholder="COOPERATIVA AGRO..."
              className="w-full px-2 py-0.5 text-[10px] font-bold uppercase rounded border border-purple-300 dark:border-purple-800 bg-white dark:bg-stone-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* 2. BARRA DE INSERÇÃO RÁPIDA HORIZONTAL (FRENTE DE COTAÇÃO - SLIM DESIGN PRO) */}
      <div className="px-2 pt-1.5 shrink-0 bg-slate-50 dark:bg-stone-900">
        <div className="bg-slate-100 dark:bg-stone-850 p-1.5 border border-slate-300 dark:border-stone-700 rounded flex items-center gap-2 grid grid-cols-12 mb-1.5 shadow-xs">
          
          {/* Campo 1 (Col 8): BUSCAR PRODUTO PARA COTAR [F3] */}
          <div className="col-span-12 sm:col-span-8 relative">
            <label className="block text-[9px] font-black text-slate-600 dark:text-stone-400 uppercase mb-0.5 tracking-wider">
              BUSCAR PRODUTO PARA COTAR [F3]
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={productInputRef}
                type="text"
                value={searchProductText}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setAutocompleteIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setAutocompleteIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (autocompleteOpen && filteredProducts.length > 0 && !selectedProduct) {
                      handleSelectProduct(filteredProducts[autocompleteIndex] || filteredProducts[0]);
                    }
                    handleAddItemToCotacao();
                  } else if (e.key === 'Escape') {
                    setAutocompleteOpen(false);
                  }
                }}
                placeholder="DIGITE NOME, CÓDIGO OU MULTIPLICADOR (EX: 2*)..."
                className="w-full pl-8 pr-3 py-1 text-xs font-bold uppercase rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-xs"
              />
            </div>

            {/* Dropdown de Autocomplete Reativo */}
            {autocompleteOpen && filteredProducts.length > 0 && (
              <div 
                ref={dropdownRef}
                className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-md shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-stone-800"
              >
                {filteredProducts.map((prod, idx) => (
                  <div
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod)}
                    className={`px-3 py-1.5 text-xs uppercase cursor-pointer flex items-center justify-between transition ${
                      idx === autocompleteIndex 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-black' 
                        : 'hover:bg-slate-100 dark:hover:bg-stone-800 text-slate-800 dark:text-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="font-mono text-[10px] text-slate-500 font-bold shrink-0">
                        [{prod.code || (prod as any).codigo_produto || 'S/CÓD'}]
                      </span>
                      <span className="truncate font-bold">{prod.nome_comercial || prod.name}</span>
                      <span className="text-[9px] text-slate-400 shrink-0">
                        ({prod.categoria || prod.category || 'GERAL'})
                      </span>
                    </div>
                    <div className="text-right shrink-0 ml-2 font-mono text-[11px] font-bold text-slate-700 dark:text-stone-300">
                      {formatCurrencyBRL(Number(prod.preco_custo_inicial ?? prod.unitCost ?? (prod as any).ultimoCusto ?? 0))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campo 2 (Col 2): QTDE */}
          <div className="col-span-6 sm:col-span-2">
            <label className="block text-[9px] font-black text-slate-600 dark:text-stone-400 uppercase mb-0.5 tracking-wider">
              QTDE
            </label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddItemToCotacao();
                }
              }}
              className="w-full px-2 py-1 text-xs font-black text-center rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
            />
          </div>

          {/* Campo 3 (Col 2): Botão rígido + ADICIONAR */}
          <div className="col-span-6 sm:col-span-2 flex flex-col justify-end">
            <label className="block text-[9px] font-black text-transparent mb-0.5 select-none hidden sm:block">
              _
            </label>
            <button
              type="button"
              onClick={handleAddItemToCotacao}
              className="w-full py-1 text-xs font-bold uppercase rounded bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 cursor-pointer shadow-xs flex items-center justify-center gap-1 tracking-wider"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>+ ADICIONAR</span>
            </button>
          </div>

        </div>
      </div>

      {/* 3. TABELA COMPARATIVA MULTIFORNECEDOR COM ROLAGEM INDEPENDENTE */}
      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 bg-white dark:bg-stone-850 px-2">
        <table className="w-full text-left border-collapse text-[11px] border border-slate-200 dark:border-stone-750 rounded">
          <thead className="bg-slate-100 dark:bg-stone-800 text-[10px] font-black text-slate-700 dark:text-stone-300 uppercase tracking-wide border-b border-slate-300 dark:border-stone-700 sticky top-0 z-10 shadow-xs">
            <tr>
              <th className="py-1 px-3 w-64">CÓDIGO & DESCRIÇÃO DO PRODUTO (UPPERCASE)</th>
              <th className="py-1 px-2 w-20 text-center">QTDE</th>
              <th className="py-1 px-2 w-28 text-right">ÚLTIMO VALOR (BASE)</th>
              <th className="py-1 px-2 w-36 text-center bg-blue-100/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300">
                {fornecedorA || 'FORNECEDOR A'}
              </th>
              <th className="py-1 px-2 w-36 text-center bg-amber-100/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300">
                {fornecedorB || 'FORNECEDOR B'}
              </th>
              <th className="py-1 px-2 w-36 text-center bg-purple-100/60 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300">
                {fornecedorC || 'FORNECEDOR C'}
              </th>
              <th className="py-1 px-2 w-28 text-center">MELHOR OFERTA</th>
              <th className="py-1 px-1 w-10 text-center">✕</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-stone-750">
            {displayedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-stone-500 uppercase font-bold text-xs">
                  <Building2 className="w-8 h-8 text-slate-300 dark:text-stone-600 mx-auto mb-2" />
                  NENHUM PRODUTO ADICIONADO À COTAÇÃO AINDA.
                  <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-400">
                    Utilize a barra de busca rápida [F3] acima para adicionar produtos ou abra uma cotação salva no histórico.
                  </div>
                </td>
              </tr>
            ) : (
              displayedItems.map((item) => {
                const itemKey = item.productId || item.id;
                const lastCost = Number(item.lastCost || 0);
                const pData = cotacoes[itemKey] || {};
                const pA = pData.precoA;
                const pB = pData.precoB;
                const pC = pData.precoC;
                const qty = item.quantity || 1;

                const activePrices: { key: 'A' | 'B' | 'C'; val: number }[] = [];
                if (pA !== undefined && pA > 0) activePrices.push({ key: 'A', val: pA });
                if (pB !== undefined && pB > 0) activePrices.push({ key: 'B', val: pB });
                if (pC !== undefined && pC > 0) activePrices.push({ key: 'C', val: pC });

                let minVal = -1;
                let maxVal = -1;

                if (activePrices.length >= 2) {
                  const vals = activePrices.map(x => x.val);
                  minVal = Math.min(...vals);
                  maxVal = Math.max(...vals);
                }

                const getCellHighlight = (val: number | undefined) => {
                  if (val === undefined || val <= 0 || activePrices.length < 2) {
                    return 'border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-850 dark:text-white';
                  }
                  if (val === minVal) {
                    return 'bg-green-100 text-green-800 font-bold border-green-400 dark:bg-green-950/60 dark:text-green-300 dark:border-green-700';
                  }
                  if (val === maxVal && maxVal !== minVal) {
                    return 'bg-red-100 text-red-800 font-bold border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700';
                  }
                  return 'border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-slate-800 dark:text-white';
                };

                const bestInRow = activePrices.length > 0
                  ? activePrices.reduce((prev, curr) => curr.val < prev.val ? curr : prev)
                  : null;

                return (
                  <tr key={item.id} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
                    {/* CÓDIGO & DESCRIÇÃO DO PRODUTO (Tratado em UPPERCASE) */}
                    <td className="py-1 px-3 font-bold text-slate-900 dark:text-white uppercase">
                      <span className="font-mono text-slate-500 mr-1.5 text-[10px]">
                        {item.code || 'S/CÓD'}
                      </span>
                      {item.name}
                    </td>

                    {/* QUANTIDADE MULTIPLICADORA */}
                    <td className="py-1 px-2 text-center font-mono font-black text-slate-800 dark:text-stone-200 text-[10px] whitespace-nowrap">
                      {qty.toLocaleString('pt-BR')} {item.unit || 'UN'}
                    </td>

                    {/* ÚLTIMO VALOR DE COMPRA (Puxado do histórico do LocalStorage) */}
                    <td className="py-1 px-2 text-right font-mono font-semibold text-slate-600 dark:text-stone-300 text-[10px]">
                      {formatCurrencyBRL(lastCost)}
                    </td>

                    {/* COLUNA INPUT FORNECEDOR A */}
                    <td className="py-1 px-2 text-center">
                      <div className="relative inline-flex items-center w-full max-w-[130px]">
                        <span className="absolute left-1.5 text-[9px] text-slate-400 font-mono">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pA !== undefined ? pA : ''}
                          onChange={(e) => handlePriceChange(itemKey, 'precoA', e.target.value)}
                          placeholder="0,00"
                          className={`w-full pl-6 pr-1.5 py-0.5 text-right text-[11px] font-mono rounded border transition ${getCellHighlight(pA)}`}
                        />
                      </div>
                      {qty > 1 && pA !== undefined && pA > 0 && (
                        <div className="text-[9px] font-mono text-slate-500 dark:text-stone-400 text-right mt-0.5">
                          Total: {formatCurrencyBRL(pA * qty)}
                        </div>
                      )}
                    </td>

                    {/* COLUNA INPUT FORNECEDOR B */}
                    <td className="py-1 px-2 text-center">
                      <div className="relative inline-flex items-center w-full max-w-[130px]">
                        <span className="absolute left-1.5 text-[9px] text-slate-400 font-mono">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pB !== undefined ? pB : ''}
                          onChange={(e) => handlePriceChange(itemKey, 'precoB', e.target.value)}
                          placeholder="0,00"
                          className={`w-full pl-6 pr-1.5 py-0.5 text-right text-[11px] font-mono rounded border transition ${getCellHighlight(pB)}`}
                        />
                      </div>
                      {qty > 1 && pB !== undefined && pB > 0 && (
                        <div className="text-[9px] font-mono text-slate-500 dark:text-stone-400 text-right mt-0.5">
                          Total: {formatCurrencyBRL(pB * qty)}
                        </div>
                      )}
                    </td>

                    {/* COLUNA INPUT FORNECEDOR C */}
                    <td className="py-1 px-2 text-center">
                      <div className="relative inline-flex items-center w-full max-w-[130px]">
                        <span className="absolute left-1.5 text-[9px] text-slate-400 font-mono">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pC !== undefined ? pC : ''}
                          onChange={(e) => handlePriceChange(itemKey, 'precoC', e.target.value)}
                          placeholder="0,00"
                          className={`w-full pl-6 pr-1.5 py-0.5 text-right text-[11px] font-mono rounded border transition ${getCellHighlight(pC)}`}
                        />
                      </div>
                      {qty > 1 && pC !== undefined && pC > 0 && (
                        <div className="text-[9px] font-mono text-slate-500 dark:text-stone-400 text-right mt-0.5">
                          Total: {formatCurrencyBRL(pC * qty)}
                        </div>
                      )}
                    </td>

                    {/* INDICADOR DA MELHOR OFERTA NA LINHA */}
                    <td className="py-1 px-2 text-center whitespace-nowrap">
                      {bestInRow ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <span>F-{bestInRow.key}</span>
                          <span className="font-mono">{formatCurrencyBRL(bestInRow.val * qty)}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">-</span>
                      )}
                    </td>

                    {/* BOTÃO DE REMOÇÃO DA COTAÇÃO */}
                    <td className="py-1 px-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveQuotedItem(item.id, itemKey)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition cursor-pointer"
                        title="Remover item da cotação"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. RODAPÉ FIXO COM SOMA TOTAL COMPARATIVA, "MELHOR OPÇÃO GLOBAL" E BOTÕES REAJUSTADOS */}
      <div className="shrink-0 z-20 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:from-stone-900 dark:via-stone-850 dark:to-stone-900 border-t border-slate-300 dark:border-stone-700 p-2 shadow-md">
        
        {/* CARDS COMPARATIVOS DOS FORNECEDORES */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
          {/* Card Total Fornecedor A */}
          <div className={`p-1.5 rounded border transition ${
            bestSupplier?.id === 'A'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-500'
              : 'border-blue-200 dark:border-blue-900 bg-white dark:bg-stone-850'
          }`}>
            <div className="flex items-center justify-between text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase">
              <span className="truncate">{fornecedorA || 'FORNECEDOR A'}</span>
              <span className="font-mono text-[9px]">({countA} cotados)</span>
            </div>
            <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {formatCurrencyBRL(totalA)}
            </div>
          </div>

          {/* Card Total Fornecedor B */}
          <div className={`p-1.5 rounded border transition ${
            bestSupplier?.id === 'B'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-500'
              : 'border-amber-200 dark:border-amber-900 bg-white dark:bg-stone-850'
          }`}>
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase">
              <span className="truncate">{fornecedorB || 'FORNECEDOR B'}</span>
              <span className="font-mono text-[9px]">({countB} cotados)</span>
            </div>
            <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {formatCurrencyBRL(totalB)}
            </div>
          </div>

          {/* Card Total Fornecedor C */}
          <div className={`p-1.5 rounded border transition ${
            bestSupplier?.id === 'C'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-500'
              : 'border-purple-200 dark:border-purple-900 bg-white dark:bg-stone-850'
          }`}>
            <div className="flex items-center justify-between text-[10px] font-bold text-purple-900 dark:text-purple-300 uppercase">
              <span className="truncate">{fornecedorC || 'FORNECEDOR C'}</span>
              <span className="font-mono text-[9px]">({countC} cotados)</span>
            </div>
            <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
              {formatCurrencyBRL(totalC)}
            </div>
          </div>

          {/* Destaque "MELHOR OPÇÃO GLOBAL" */}
          <div className="p-1.5 rounded border border-emerald-400 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-100">
                <Award className="w-3.5 h-3.5 text-amber-300" />
                <span>MELHOR OPÇÃO GLOBAL</span>
              </div>
              <div className="text-xs font-black uppercase truncate mt-0.5">
                {bestSupplier ? bestSupplier.name : 'NENHUMA COTAÇÃO'}
              </div>
            </div>
            {bestSupplier && (
              <div className="text-right">
                <span className="text-[8px] font-bold uppercase text-emerald-200 block">ECONOMIA</span>
                <span className="text-xs font-black font-mono text-amber-300">
                  {formatCurrencyBRL(bestSupplier.total)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. REAJUSTE DE BOTÕES DO RODAPÉ (SLIM DESIGN PRO) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-200 dark:border-stone-750">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500 dark:text-stone-400">
            {activeCotacaoNome ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <span>📁 ARQUIVADA:</span>
                <strong className="font-black">{activeCotacaoNome}</strong>
              </span>
            ) : (
              <span>* NOVA COTAÇÃO EM ANDAMENTO (NÃO ARQUIVADA)</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* BOTÃO 1: IMPRIMIR ESTA COTAÇÃO (A4) */}
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              disabled={quotedItems.length === 0}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-black uppercase rounded transition active:scale-95 flex items-center justify-center gap-1.5 tracking-wider ${
                quotedItems.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-stone-800 dark:text-stone-600'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
              }`}
              title="Disparar impressão da cotação ativa na tela em A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ IMPRIMIR ESTA COTAÇÃO (A4)</span>
            </button>

            {/* BOTÃO 2: SALVAR COTAÇÃO */}
            <button
              type="button"
              onClick={handleOpenSaveModal}
              disabled={quotedItems.length === 0}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-black uppercase rounded transition active:scale-95 flex items-center justify-center gap-1.5 tracking-wider ${
                quotedItems.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-stone-800 dark:text-stone-600'
                  : 'bg-slate-800 hover:bg-slate-900 text-white cursor-pointer shadow-xs'
              }`}
              title="Salvar ou atualizar esta cotação no histórico por nome"
            >
              <Save className="w-3.5 h-3.5" />
              <span>💾 SALVAR COTAÇÃO</span>
            </button>

            {/* BOTÃO 3: LIMPAR TELA / EXCLUIR */}
            <button
              type="button"
              onClick={handleOpenClearDeleteModal}
              disabled={quotedItems.length === 0 && !activeCotacaoId}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-black uppercase rounded transition active:scale-95 flex items-center justify-center gap-1.5 tracking-wider ${
                quotedItems.length === 0 && !activeCotacaoId
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-stone-800 dark:text-stone-600'
                  : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs'
              }`}
              title="Limpar grade para iniciar nova cotação ou excluir registro salvo"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>🗑️ LIMPAR TELA / EXCLUIR</span>
            </button>
          </div>
        </div>

      </div>

      {/* MODAL 1: SALVAMENTO DE COTAÇÃO POR NOME (PADRÃO OURO AMPLO) */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-2xl max-w-lg w-full p-4 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-2.5">
              <div className="flex items-center gap-2 text-slate-800 dark:text-stone-100">
                <Save className="w-5 h-5 text-emerald-600" />
                <h4 className="text-xs font-black uppercase tracking-wider">
                  SALVAR COTAÇÃO NO BANCO HISTÓRICO
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 dark:text-stone-300 mb-1 tracking-wider">
                  INFORME O NOME / IDENTIFICAÇÃO DESTA COTAÇÃO *
                </label>
                <input
                  ref={saveInputRef}
                  type="text"
                  value={saveNomeInput}
                  onChange={(e) => setSaveNomeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmSaveCotacao(false);
                    }
                  }}
                  placeholder="EX: COTAÇÃO SILAGEM SAFRA 2026/2027"
                  className="w-full px-3 py-2 text-xs font-bold uppercase rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-850 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-xs"
                />
              </div>

              <div className="p-2.5 rounded bg-slate-50 dark:bg-stone-850 border border-slate-200 dark:border-stone-750 text-[10px] text-slate-500 dark:text-stone-400 space-y-1">
                <div>• Total de produtos incluídos: <strong>{quotedItems.length}</strong></div>
                <div>• Fornecedores: <strong>{fornecedorA}</strong> | <strong>{fornecedorB}</strong> | <strong>{fornecedorC}</strong></div>
                <div>• Armazenamento: <strong>100% Offline LocalStorage ('agrocontrol_historico_cotacoes')</strong></div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold uppercase rounded bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-stone-800 dark:text-stone-300 transition cursor-pointer"
              >
                CANCELAR
              </button>

              {activeCotacaoId && (
                <button
                  type="button"
                  onClick={() => handleConfirmSaveCotacao(true)}
                  className="px-3.5 py-1.5 text-xs font-black uppercase rounded bg-blue-600 hover:bg-blue-700 text-white transition active:scale-95 cursor-pointer shadow-xs"
                >
                  SALVAR COMO NOVA
                </button>
              )}

              <button
                type="button"
                onClick={() => handleConfirmSaveCotacao(false)}
                className="px-4 py-1.5 text-xs font-black uppercase rounded bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 cursor-pointer shadow-xs"
              >
                {activeCotacaoId ? 'ATUALIZAR COTAÇÃO' : 'CONFIRMAR E SALVAR'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: CENTRAL DE HISTÓRICO DE COTAÇÕES (PAINEL DE RECUPERAÇÃO) */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-4xl h-[90vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden shadow-2xl">
            
            {/* CABEÇALHO MDI TRIDIMENSIONAL ACETINADO */}
            <div className="bg-gradient-to-r from-slate-800 via-slate-850 to-slate-900 text-white px-4 py-3 border-b border-slate-700 shadow-md flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-5 h-5 text-amber-400" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-100">
                  CENTRAL DE COTAÇÕES ARQUIVADAS
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {historicoCotacoes.length} SALVAMENTOS NO BANCO
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition cursor-pointer"
                title="Fechar Janela"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BARRA DE PESQUISA DENTRO DO MODAL */}
            <div className="bg-slate-100 dark:bg-stone-850 px-4 py-2 border-b border-slate-300 dark:border-stone-700 flex items-center justify-between gap-2 shrink-0">
              <div className="text-xs font-bold uppercase text-slate-600 dark:text-stone-300">
                SELECIONE UMA COTAÇÃO PARA RECUPERAR PRODUTOS, FORNECEDORES E PREÇOS:
              </div>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value.toUpperCase())}
                  placeholder="FILTRAR HISTÓRICO..."
                  className="w-full pl-8 pr-3 py-1 text-xs font-bold uppercase rounded border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-slate-800 dark:text-white font-mono focus:ring-1 focus:ring-emerald-500 outline-none shadow-xs"
                />
              </div>
            </div>

            {/* MIOLO: LISTAGEM DE COTAÇÕES ARQUIVADAS */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-3 sm:p-4 bg-slate-50 dark:bg-stone-900 space-y-2">
              {filteredHistory.length === 0 ? (
                <div className="py-16 text-center text-slate-400 dark:text-stone-500 uppercase font-bold text-xs">
                  <FolderOpen className="w-10 h-10 text-slate-300 dark:text-stone-600 mx-auto mb-2" />
                  NENHUMA COTAÇÃO ARQUIVADA ENCONTRADA.
                  <div className="text-[10px] font-normal normal-case mt-1 text-slate-400">
                    Crie sua concorrência de preços na aba e clique em &ldquo;💾 SALVAR COTAÇÃO&rdquo; para registrar neste histórico.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredHistory.map((cotacao) => {
                    const isCurrent = activeCotacaoId === cotacao.id;
                    const itemsCount = cotacao.itens?.length || 0;
                    const [f1, f2, f3] = cotacao.fornecedores || [];

                    return (
                      <div
                        key={cotacao.id}
                        className={`p-3 rounded-lg border transition shadow-xs flex flex-col justify-between ${
                          isCurrent
                            ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500'
                            : 'border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-850 hover:border-slate-400'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white truncate">
                              {cotacao.nome}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {cotacao.data}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-600 dark:text-stone-300 space-y-0.5">
                            <div>• <strong>{itemsCount}</strong> produto(s) cotado(s)</div>
                            <div className="truncate text-slate-500 dark:text-stone-400">
                              • Fornecedores: {f1 || 'A'} | {f2 || 'B'} | {f3 || 'C'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-slate-200 dark:border-stone-750">
                          {isCurrent ? (
                            <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                              ✓ COTAÇÃO ATIVA NA TELA
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLoadCotacaoFromHistory(cotacao)}
                              className="px-3 py-1 text-xs font-black uppercase rounded bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 cursor-pointer shadow-xs flex items-center gap-1"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span>CARREGAR NA TELA</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleDeleteCotacaoFromHistory(cotacao.id, cotacao.nome, e)}
                            className="p-1 px-2 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950 text-xs font-bold rounded transition cursor-pointer"
                            title="Excluir cotação do banco histórico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RODAPÉ DO MODAL DE HISTÓRICO */}
            <div className="bg-slate-100 dark:bg-stone-850 px-4 py-2.5 border-t border-slate-300 dark:border-stone-700 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 dark:text-stone-400 font-bold uppercase">
                * Os salvamentos são permanentes e independentes no LocalStorage.
              </span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold uppercase rounded bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-stone-800 dark:text-stone-300 transition cursor-pointer"
              >
                FECHAR
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAÇÃO DE LIMPEZA DE TELA / EXCLUSÃO (ANTI-SANDBOX) */}
      {isClearDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg shadow-2xl max-w-md w-full p-4 space-y-3">
            
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-stone-800 pb-2">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-xs font-black uppercase tracking-wider">
                  LIMPAR TELA / EXCLUIR COTAÇÃO
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsClearDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-2">
              <p className="text-xs font-bold uppercase text-slate-800 dark:text-stone-100 leading-relaxed">
                {activeCotacaoNome 
                  ? `VOCÊ ESTÁ COM A COTAÇÃO "${activeCotacaoNome}" ABERTA NA TELA.`
                  : 'DESEJA LIMPAR A GRADE ATUAL PARA INICIAR UMA NOVA COTAÇÃO DO ZERO?'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-stone-400 mt-1">
                {activeCotacaoNome
                  ? 'Você pode apenas limpar a tela para iniciar um novo orçamento ou excluir definitivamente este registro do banco histórico.'
                  : 'Todos os produtos e preços digitados na grade serão resetados.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsClearDeleteModalOpen(false)}
                className="w-full sm:w-auto px-3 py-1.5 text-xs font-bold uppercase rounded bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-stone-800 dark:text-stone-300 transition cursor-pointer"
              >
                CANCELAR
              </button>

              <button
                type="button"
                onClick={handleExecuteClearScreenOnly}
                className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-black uppercase rounded bg-slate-800 hover:bg-slate-900 text-white transition active:scale-95 cursor-pointer shadow-xs"
              >
                LIMPAR TELA (NOVA COTAÇÃO)
              </button>

              {activeCotacaoId && (
                <button
                  type="button"
                  onClick={handleExecuteDeleteFromHistoryAndClear}
                  className="w-full sm:w-auto px-4 py-1.5 text-xs font-black uppercase rounded bg-rose-600 hover:bg-rose-700 text-white transition active:scale-95 cursor-pointer shadow-xs"
                >
                  EXCLUIR DO HISTÓRICO E LIMPAR
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL 4: IMPRESSÃO A4 ANTI-SANDBOX (PRINT PREVIEW COMPLETO) */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        options={{
          company: companyProfile,
          title: 'COMPARATIVO MULTIFORNECEDOR DE COTAÇÕES',
          subtitle: `Cotação: ${activeCotacaoNome || 'COTAÇÃO ATIVA'} • ${quotedItems.length} itens cotados`,
          documentType: 'MAPA COMPARATIVO DE COTAÇÕES',
          contentHtml: generateCotacaoPrintHtml(
            quotedItems,
            cotacoes,
            [fornecedorA, fornecedorB, fornecedorC],
            activeCotacaoNome,
            companyProfile,
            { totalA, totalB, totalC },
            bestSupplier
          ),
          whatsappText: generateCotacaoWhatsAppText(
            quotedItems,
            [fornecedorA, fornecedorB, fornecedorC],
            activeCotacaoNome,
            companyProfile,
            { totalA, totalB, totalC },
            bestSupplier
          ),
          showSignatures: true,
          signatureLabels: ['Encarregado de Compras / Cotações', 'Diretoria / Aprovação Final'],
        }}
      />

    </div>
  );
};
