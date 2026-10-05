import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Printer, 
  MapPin, 
  Barcode, 
  Info,
  Tag,
  Eye,
  LayoutGrid,
  FileText,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Copy,
  ArrowLeft
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { generateBarcodeSvgString, generateBarcodeBars } from './barcodeGenerator';
import { executePrint } from '../../lib/printService';
import { formatCurrencyBRL } from '../../lib/storage';
import { 
  type LabelSizePreset, 
  type LabelPresetConfig, 
  A4_PRESETS, 
  THERMAL_PRESETS, 
  ALL_PRESETS, 
  getLabelPresetConfig, 
  getLabelDesignMetrics 
} from './labelPresets';

export interface LabelProductItem {
  product: InventoryItem;
  quantity?: number;
  invoiceQuantity?: number;
}

export type LabelQuantityRule = 'single' | 'invoice';

interface ProductLabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: InventoryItem | null;
  batchProducts?: LabelProductItem[] | null;
  entryTitle?: string;
  zIndexClass?: string;
  onBackToQueue?: () => void;
  defaultQuantityRule?: LabelQuantityRule;
}

export type { LabelSizePreset };

export const ProductLabelPrintModal: React.FC<ProductLabelPrintModalProps> = ({
  isOpen,
  onClose,
  product,
  batchProducts,
  entryTitle,
  zIndexClass = 'z-50',
  onBackToQueue,
  defaultQuantityRule
}) => {
  // Configurações do Formato de Impressão
  const [labelSize, setLabelSize] = useState<LabelSizePreset>('termica_gondola_60x30');
  const [startPosition, setStartPosition] = useState<number>(1);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showInternalCode, setShowInternalCode] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [quantityRule, setQuantityRule] = useState<LabelQuantityRule>(
    defaultQuantityRule ?? (onBackToQueue ? 'invoice' : 'single')
  );
  const [defaultCopies, setDefaultCopies] = useState<number>(1);
  const [customCopies, setCustomCopies] = useState<Record<string, number>>({});
  const [isPrinting, setIsPrinting] = useState(false);
  const [previewTab, setPreviewTab] = useState<'label' | 'sheet'>('label');

  // Obtém o preset ativo
  const currentPreset = useMemo<LabelPresetConfig>(() => {
    return getLabelPresetConfig(labelSize);
  }, [labelSize]);

  const isA4 = currentPreset.category === 'a4';
  const totalSlotsPerSheet = currentPreset.totalPerSheet || 30;

  // Lista normalizada de produtos para impressão (preservando a quantidade original da Nota Fiscal)
  const itemsToPrint = useMemo<LabelProductItem[]>(() => {
    if (batchProducts && batchProducts.length > 0) {
      const mergedMap = new Map<string, LabelProductItem>();
      batchProducts.forEach((entry, idx) => {
        const rawProd = entry.product;
        const prodId = rawProd.id || `item_${idx}`;
        const rawQty = Math.max(1, Math.round(Number(entry.invoiceQuantity ?? entry.quantity) || 1));
        const existing = mergedMap.get(prodId);
        if (existing) {
          const sumQty = (existing.invoiceQuantity ?? existing.quantity ?? 1) + rawQty;
          mergedMap.set(prodId, {
            product: existing.product,
            quantity: sumQty,
            invoiceQuantity: sumQty
          });
        } else {
          mergedMap.set(prodId, {
            product: { ...rawProd, id: prodId },
            quantity: rawQty,
            invoiceQuantity: rawQty
          });
        }
      });
      return Array.from(mergedMap.values());
    }
    if (product) {
      const stockQty = Math.max(1, Math.round(Number(product.quantity ?? product.quantidade_atual) || 1));
      return [{ product, quantity: stockQty, invoiceQuantity: stockQty }];
    }
    return [];
  }, [product, batchProducts]);

  // Soma total de unidades lançadas na Nota Fiscal / lote original
  const totalInvoiceUnitsCount = useMemo<number>(() => {
    return itemsToPrint.reduce((acc, curr) => {
      const notaQty = Math.max(1, Math.round(Number(curr.invoiceQuantity ?? curr.quantity) || 1));
      return acc + notaQty;
    }, 0);
  }, [itemsToPrint]);

  // Sincroniza as quantidades quando o modal abre ou o lote muda, aplicando a Regra de Quantidade Padrão ativa
  useEffect(() => {
    if (!isOpen) return;
    const initialRule: LabelQuantityRule = defaultQuantityRule ?? (onBackToQueue ? 'invoice' : 'single');
    setQuantityRule(initialRule);

    if (itemsToPrint.length > 0) {
      const synced: Record<string, number> = {};
      itemsToPrint.forEach(({ product: item, quantity, invoiceQuantity }) => {
        const notaQty = Math.max(1, Math.round(Number(invoiceQuantity ?? quantity) || 1));
        synced[item.id] = initialRule === 'single' ? 1 : notaQty;
      });
      setCustomCopies(synced);
      setDefaultCopies(1);
    }
  }, [isOpen, itemsToPrint, defaultQuantityRule, onBackToQueue]);

  // Primeiro produto para pré-visualização ao vivo
  const previewProduct = itemsToPrint[0]?.product;

  // Obter quantidade de cópias de um item
  const getItemCopies = (prodId: string, fallbackQty: number = 1): number => {
    if (customCopies[prodId] !== undefined) return customCopies[prodId];
    if (quantityRule === 'single') return 1;
    return fallbackQty > 0 ? fallbackQty : defaultCopies;
  };

  const setItemCopies = (prodId: string, copies: number) => {
    setCustomCopies(prev => ({
      ...prev,
      [prodId]: Math.max(1, copies)
    }));
  };

  // Alterna entre as regras globais: "Uma etiqueta por produto" vs "Quantidade da Nota Fiscal (Total de Unidades)"
  const handleSelectQuantityRule = (rule: LabelQuantityRule) => {
    setQuantityRule(rule);
    const updated: Record<string, number> = {};
    if (rule === 'single') {
      setDefaultCopies(1);
      itemsToPrint.forEach(({ product: item }) => {
        updated[item.id] = 1;
      });
    } else {
      itemsToPrint.forEach(({ product: item, quantity, invoiceQuantity }) => {
        const exactNotaQty = Math.max(1, Math.round(Number(invoiceQuantity ?? quantity) || 1));
        updated[item.id] = exactNotaQty;
      });
    }
    setCustomCopies(updated);
  };

  // Aplica quantidade padrão manual para todos os itens da lista
  const handleApplyGlobalCopies = (qty: number) => {
    const valid = Math.max(1, qty);
    setDefaultCopies(valid);
    const updated: Record<string, number> = {};
    itemsToPrint.forEach(({ product: item }) => {
      updated[item.id] = valid;
    });
    setCustomCopies(updated);
  };

  // Total de etiquetas a serem geradas
  const totalLabelsCount = itemsToPrint.reduce((acc, curr) => {
    return acc + getItemCopies(curr.product.id, curr.quantity);
  }, 0);

  // Lista expandida de todos os itens considerando a quantidade de cada um
  const flatLabelsList = useMemo<InventoryItem[]>(() => {
    const list: InventoryItem[] = [];
    itemsToPrint.forEach(({ product: item, quantity = 1 }) => {
      const copies = getItemCopies(item.id, quantity);
      for (let i = 0; i < copies; i++) {
        list.push(item);
      }
    });
    return list;
  }, [itemsToPrint, customCopies, defaultCopies]);

  if (!isOpen || itemsToPrint.length === 0) return null;

  // Formata o código de barras padrão
  const resolveBarcodeCode = (item: InventoryItem): string => {
    if (item.barcode && String(item.barcode) !== 'SEM GTIN' && String(item.barcode).trim()) {
      return String(item.barcode).trim();
    }
    if (item.code !== undefined && item.code !== null && String(item.code).trim()) {
      return String(item.code).trim();
    }
    return `PRD-${String(item.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  };

  const ADDRESS_LEGEND_LABELS = ['SETOR', 'RUA', 'ESTANTE', 'NÍVEL', 'BOX'] as const;

  // Resolve o endereço formatado
  const resolveAddress = (item: InventoryItem): string => {
    if (item.endereco_formatado && item.endereco_formatado.trim()) {
      return item.endereco_formatado.trim();
    }
    if (item.estoque_setor || item.estoque_rua || item.estoque_estante) {
      const p = [
        item.estoque_setor || '00',
        item.estoque_rua || '00',
        item.estoque_estante || '00',
        item.estoque_nivel || '00',
        item.estoque_box || '00'
      ];
      return p.join('.');
    }
    if (item.location && item.location.includes('.')) {
      return item.location;
    }
    return item.location || item.localizacao_fisica || '00.00.00.00.00';
  };

  // Divide o endereço formatado nos 5 blocos (SETOR, RUA, ESTANTE, NÍVEL, BOX)
  const resolveAddressParts = (item: InventoryItem): string[] => {
    const raw = resolveAddress(item);
    if (raw && raw.includes('.')) {
      const parts = raw.split('.').map(p => p.trim() || '00');
      while (parts.length < 5) parts.push('00');
      return parts.slice(0, 5);
    }
    return [
      item.estoque_setor || '00',
      item.estoque_rua || '00',
      item.estoque_estante || '00',
      item.estoque_nivel || '00',
      item.estoque_box || '00'
    ];
  };

  // Resolve o preço de venda para exibição na etiqueta
  const resolveProductPrice = (item: InventoryItem): number => {
    const directSale = Number(item.salePrice ?? item.preco_venda_varejo ?? item.preco_venda ?? 0);
    if (directSale > 0) return directSale;
    const cost = Number(item.unitCost ?? item.preco_custo_inicial ?? item.custo_nominal ?? 0);
    const margin = Number(item.profitMargin ?? item.margem_lucro_sugerida ?? 0);
    if (cost > 0 && margin > 0) {
      return Math.round(cost * (1 + margin / 100) * 100) / 100;
    }
    if (cost > 0) return cost;
    return 0;
  };

  // Renderiza o HTML individual de uma etiqueta compatível com CSS print
  const renderSingleLabelHtml = (
    item: InventoryItem, 
    preset: LabelPresetConfig, 
    metrics: ReturnType<typeof getLabelDesignMetrics>,
    effectiveHeightMm?: number
  ): string => {
    const barcodeValue = resolveBarcodeCode(item);
    const addressParts = resolveAddressParts(item);
    const internalCode = item.code || `ID:${item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
    const prodName = item.nome_comercial || item.name || 'Produto sem descrição';
    const prodBrand = item.brand || item.marca ? ` • ${item.brand || item.marca}` : '';
    const unit = (item.unidade_medida || item.unit || 'UN').toUpperCase();
    const salePrice = resolveProductPrice(item);

    const labelHeightMm = effectiveHeightMm ?? preset.heightMm;
    const isA4 = preset.category === 'a4';
    const isA4FourCols = isA4 && preset.columns >= 4;
    const isCompact = labelHeightMm <= 22;
    const isSmallPad = labelHeightMm <= 25 || preset.widthMm <= 40;

    const barcodeNarrowWidth = isA4FourCols ? 0.95 : metrics.narrowWidth;
    const barcodeHeight = isA4FourCols ? Math.min(metrics.barcodeHeight, 13) : (isCompact ? Math.min(metrics.barcodeHeight, 11) : metrics.barcodeHeight);
    const barcodeDigitsFontPt = isA4FourCols ? 6.8 : (isCompact ? 7.8 : Math.max(9.0, metrics.codeFontSizePt * 1.3));
    const addressNumFontPt = isA4FourCols ? Math.min(metrics.addressCodeFontSizePt, 8.8) : Math.min(metrics.addressCodeFontSizePt, 12.0);
    const addressLegendFontPt = isA4FourCols ? 3.3 : metrics.addressLegendFontSizePt;
    const descFontPt = isA4FourCols ? 5.8 : (isCompact ? 6.2 : (preset.widthMm >= 80 ? 8.2 : 7.2));
    const priceMainFontPt = isA4FourCols ? 7.2 : (isCompact ? 7.8 : (preset.widthMm >= 80 ? 11.5 : 9.2));
    const priceUnitFontPt = isA4FourCols ? 4.8 : (isCompact ? 5.2 : 6.2);

    const formattedPriceStr = formatCurrencyBRL(salePrice);
    const priceNumericStr = formattedPriceStr.replace(/^R\$\s*/, '') || '0,00';

    const barcodeSvg = generateBarcodeSvgString(barcodeValue, {
      height: barcodeHeight,
      narrowWidth: barcodeNarrowWidth,
      wideWidth: barcodeNarrowWidth * 2.2,
      showText: false,
      fontSize: 18,
      textColor: '#000000',
      barColor: '#000000'
    });

    const addressColumnsHtml = addressParts.map((part, idx) => `
      <div class="address-col" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        min-width: ${isA4FourCols ? '12px' : '18px'};
      ">
        <div class="address-code" style="
          font-size: ${addressNumFontPt}pt;
          font-weight: 900;
          font-family: 'Courier New', Courier, monospace;
          line-height: 0.95;
          color: #000000;
          background: #ffffff;
          white-space: nowrap;
        ">
          ${part}
        </div>
        <div class="address-legend" style="
          font-size: ${addressLegendFontPt}pt;
          font-weight: 800;
          letter-spacing: 0px;
          color: #000000;
          background: #ffffff;
          line-height: 1;
          margin-top: 1px;
          white-space: nowrap;
          text-align: center;
        ">
          ${ADDRESS_LEGEND_LABELS[idx]}
        </div>
      </div>
      ${idx < addressParts.length - 1 ? `
        <div class="address-sep" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 0 0.5px;
        ">
          <div style="
            font-size: ${addressNumFontPt}pt;
            font-weight: 900;
            font-family: 'Courier New', Courier, monospace;
            line-height: 0.85;
            color: #000000;
          ">.</div>
          <div style="
            font-size: ${addressLegendFontPt}pt;
            font-weight: 800;
            line-height: 1;
            margin-top: 1px;
            color: #000000;
          ">.</div>
        </div>
      ` : ''}
    `).join('');

    return `
      <div class="gondola-label" style="
        width: ${isA4 ? '100%' : `${preset.widthMm}mm`};
        max-width: 100%;
        min-width: 0;
        height: ${labelHeightMm}mm;
        max-height: ${labelHeightMm}mm;
        box-sizing: border-box;
        border: 0.5px dashed #999999;
        background: #ffffff;
        color: #000000;
        padding: ${isA4FourCols ? '0.7mm 1.2mm' : (isSmallPad ? '0.9mm 1.2mm' : '1.2mm 1.6mm')};
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
      ">
        <!-- Topo: Linha superior dedicada à Descrição do Produto (até 2 linhas automáticas, font slim) -->
        <div class="label-header" style="
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1.15;
          background: #ffffff;
          color: #000000;
          border-bottom: 0.5px solid #000000;
          padding-bottom: 0.8px;
          margin-bottom: 0.8px;
          width: 100%;
          max-width: 100%;
          min-height: ${isA4FourCols ? '4.8mm' : (isCompact ? '5.0mm' : '5.8mm')};
          max-height: ${isA4FourCols ? '5.4mm' : (isCompact ? '5.6mm' : '6.8mm')};
          overflow: hidden;
          box-sizing: border-box;
        ">
          <div class="label-product-name" style="
            font-size: ${descFontPt}pt;
            font-weight: 500;
            color: #000000;
            background: #ffffff;
            text-transform: uppercase;
            text-align: center;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            word-break: break-word;
            line-height: 1.15;
            max-height: 2.3em;
            width: 100%;
            min-width: 0;
          " title="${prodName}">
            ${prodName}${prodBrand}
          </div>
        </div>

        <!-- Metade Inferior em Duas Colunas (Esquerda 73%: Código de Barras + Endereço | Direita 27%: Preço + Unidade) -->
        <div class="label-lower-columns" style="
          display: flex;
          flex-direction: row;
          align-items: stretch;
          justify-content: space-between;
          gap: 2px;
          flex: 1;
          width: 100%;
          max-width: 100%;
          min-height: 0;
          overflow: hidden;
          box-sizing: border-box;
        ">
          ${(showBarcode || showAddress || showInternalCode) ? `
            <!-- Coluna Esquerda (~73%): Código de Barras + Bloco de Endereçamento alinhados à esquerda -->
            <div class="label-left-col" style="
              width: ${showPrice ? '73%' : '100%'};
              max-width: ${showPrice ? '73%' : '100%'};
              flex: 0 0 ${showPrice ? '73%' : '100%'};
              display: flex;
              flex-direction: column;
              justify-content: ${showBarcode ? 'space-between' : 'center'};
              align-items: stretch;
              min-width: 0;
              overflow: hidden;
              box-sizing: border-box;
            ">
              ${showBarcode ? `
                <!-- Código de Barras centralizado na coluna esquerda com dígitos em destaque logo abaixo -->
                <div class="label-barcode-container" style="
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  flex: 1;
                  width: 100%;
                  max-width: 100%;
                  overflow: hidden;
                  margin: 0.5px 0;
                  box-sizing: border-box;
                  background: #ffffff;
                ">
                  ${barcodeSvg}
                  <div class="barcode-digits-text" style="
                    font-size: ${barcodeDigitsFontPt}pt;
                    font-weight: 800;
                    font-family: 'Courier New', Courier, monospace;
                    color: #000000;
                    background: #ffffff;
                    text-align: center;
                    letter-spacing: 0.6px;
                    line-height: 1.05;
                    margin-top: 1px;
                    white-space: nowrap;
                  ">
                    ${barcodeValue}
                  </div>
                </div>
              ` : ''}

              <!-- Bloco de Endereçamento na coluna esquerda -->
              ${(showAddress || showInternalCode) ? `
                <div class="label-address-box" style="
                  border: 0.5px solid #000000;
                  background: #ffffff;
                  color: #000000;
                  border-radius: 2px;
                  padding: ${showBarcode ? '1px 1.5px 1.5px 1.5px' : '2.5px 2px'};
                  text-align: center;
                  margin-top: 0.5px;
                  width: 100%;
                  max-width: 100%;
                  ${!showBarcode ? 'flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;' : ''}
                  overflow: hidden;
                  box-sizing: border-box;
                ">
                  ${showInternalCode ? `
                    <div class="label-internal-code" style="
                      font-size: ${isA4FourCols ? 4.8 : Math.max(5.2, metrics.codeFontSizePt * (showBarcode ? 0.78 : 0.9))}pt;
                      font-family: 'Courier New', Courier, monospace;
                      font-weight: 700;
                      letter-spacing: 0.2px;
                      line-height: 1;
                      margin-bottom: ${showBarcode ? '1px' : '2px'};
                      color: #000000;
                      background: #ffffff;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    ">
                      CÓD: ${internalCode}
                    </div>
                  ` : ''}
                  ${showAddress ? `
                    <div class="address-columns-row" style="
                      display: flex;
                      align-items: flex-start;
                      justify-content: center;
                      gap: ${isA4FourCols ? '0.5px' : '1.5px'};
                      width: 100%;
                      background: #ffffff;
                      color: #000000;
                    ">
                      ${addressColumnsHtml}
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Coluna Direita (~27%): Cifrão R$ acima e Preço numérico logo abaixo, com unidade na base -->
          ${showPrice ? `
            <div class="label-right-price-col" style="
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: ${showBarcode ? 'flex-end' : 'center'};
              background: #ffffff;
              color: #000000;
              box-sizing: border-box;
              overflow: hidden;
            ">
              <div class="label-price-box" style="
                width: 100%;
                ${!showBarcode ? 'flex: 1; margin-top: 0.5px;' : ''}
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                border: 0.5px solid #000000;
                border-radius: 2px;
                padding: ${isA4FourCols ? '1px 1px' : '1.5px 1.5px'};
                background: #ffffff;
                color: #000000;
                box-sizing: border-box;
              ">
                <div class="label-price-symbol" style="
                  font-size: ${isA4FourCols ? 4.8 : (isCompact ? 5.2 : 6.0)}pt;
                  font-weight: 700;
                  color: #000000;
                  background: #ffffff;
                  line-height: 0.95;
                  letter-spacing: 0.2px;
                ">
                  R$
                </div>
                <div class="label-price-value" style="
                  font-size: ${priceMainFontPt}pt;
                  font-weight: 900;
                  color: #000000;
                  background: #ffffff;
                  line-height: 1.05;
                  white-space: nowrap;
                ">
                  ${priceNumericStr}
                </div>
                <div class="label-price-unit" style="
                  font-size: ${priceUnitFontPt}pt;
                  font-weight: 700;
                  color: #000000;
                  background: #ffffff;
                  line-height: 1;
                  margin-top: 0.5px;
                  white-space: nowrap;
                ">
                  / ${unit}
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  };

  // Gerador do HTML de impressão de todas as etiquetas
  const generateLabelsHtml = (): string => {
    const metrics = getLabelDesignMetrics(currentPreset);
    let pageCss = '';
    let bodyContent = '';

    if (currentPreset.category === 'a4') {
      const slotsPerSheet = currentPreset.totalPerSheet || 30;
      const safeStartPos = Math.max(1, Math.min(startPosition, slotsPerSheet));
      const cols = currentPreset.columns || 4;
      const rows = currentPreset.rows || Math.ceil(slotsPerSheet / cols);
      const gapMm = rows >= 12 ? 2 : 2.5;
      // Garante que todas as linhas da grade A4 caibam em 1 única folha A4 (297mm - 20mm de margem body = 277mm úteis)
      const maxSheetHeightMm = 275;
      const maxRowHeightMm = Number(((maxSheetHeightMm - (rows - 1) * gapMm) / rows).toFixed(2));
      const effectiveHeightMm = Math.min(currentPreset.heightMm, maxRowHeightMm);

      pageCss = `
        @page { 
          margin: 0; 
          size: A4; 
        }
        *, *::before, *::after {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html {
          margin: 0;
          padding: 0;
          background: #ffffff;
          box-sizing: border-box;
        }
        body {
          margin: 10mm;
          padding: 0;
          background: #ffffff;
          color: #000000;
          box-sizing: border-box;
        }
        header, footer, .no-print, .print-metadata {
          display: none !important;
        }
        .a4-sheet {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          margin: 0 auto;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(${cols}, minmax(0, 1fr));
          gap: ${gapMm}mm;
          page-break-after: always;
          break-after: page;
          page-break-inside: avoid;
          break-inside: avoid;
          overflow: hidden;
        }
        .a4-sheet:last-of-type {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .gondola-label,
        .a4-slot {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: ${effectiveHeightMm}mm !important;
          max-height: ${effectiveHeightMm}mm !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        .a4-slot.empty-slot {
          visibility: hidden !important;
          border: none !important;
        }
        .label-barcode-container svg {
          max-width: 100% !important;
          max-height: 100% !important;
          width: auto !important;
          height: auto !important;
          display: block !important;
          margin: 0 auto !important;
        }
        @media print {
          @page { margin: 0; size: A4; }
          body { margin: 10mm; }
          header, footer, .no-print, .print-metadata {
            display: none !important;
          }
          .a4-sheet {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            padding: 0 !important;
            display: grid !important;
            grid-template-columns: repeat(${cols}, minmax(0, 1fr)) !important;
            gap: ${gapMm}mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
          .a4-sheet:last-of-type {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .gondola-label,
          .a4-slot {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            height: ${effectiveHeightMm}mm !important;
            max-height: ${effectiveHeightMm}mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .a4-slot.empty-slot {
            visibility: hidden !important;
            border: none !important;
          }
        }
      `;

      const sheetsHtml: string[] = [];
      let currentFlatIdx = 0;
      let sheetNum = 1;

      while (currentFlatIdx < flatLabelsList.length) {
        const slotsHtml: string[] = [];
        const isFirstSheet = sheetNum === 1;
        const initialOffset = isFirstSheet ? safeStartPos - 1 : 0;

        // Adiciona slots em branco apenas para posições iniciais puladas (reaproveitamento da folha A4)
        for (let s = 0; s < initialOffset; s++) {
          slotsHtml.push(`
            <div class="a4-slot empty-slot" style="width:100%;max-width:100%;min-width:0;height:${effectiveHeightMm}mm;box-sizing:border-box;visibility:hidden;"></div>
          `);
        }

        // Preenche com as etiquetas reais
        const slotsAvailable = slotsPerSheet - initialOffset;
        for (let s = 0; s < slotsAvailable && currentFlatIdx < flatLabelsList.length; s++) {
          const item = flatLabelsList[currentFlatIdx++];
          slotsHtml.push(renderSingleLabelHtml(item, currentPreset, metrics, effectiveHeightMm));
        }

        sheetsHtml.push(`
          <div class="a4-sheet">
            ${slotsHtml.join('\n')}
          </div>
        `);
        sheetNum++;
      }

      bodyContent = sheetsHtml.join('\n');
    } else {
      // IMPRESSORAS TÉRMICAS
      if (currentPreset.columns === 1) {
        pageCss = `
          @page { 
            size: ${currentPreset.pageSize}; 
            margin: 0; 
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
          }
          header, footer, .no-print, .print-metadata {
            display: none !important;
          }
          .thermal-page {
            width: ${currentPreset.widthMm}mm;
            height: ${currentPreset.heightMm}mm;
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }
          .thermal-page:last-of-type {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          @media print {
            .gondola-label {
              border: none !important;
            }
          }
        `;

        const pagesHtml = flatLabelsList.map(item => `
          <div class="thermal-page">
            ${renderSingleLabelHtml(item, currentPreset, metrics)}
          </div>
        `);
        bodyContent = pagesHtml.join('\n');
      } else {
        // Rolo térmico multi-colunas (Dupla, Tripla ou Mini)
        const cols = currentPreset.columns;
        pageCss = `
          @page { 
            size: ${currentPreset.pageSize}; 
            margin: 0; 
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
          }
          header, footer, .no-print, .print-metadata {
            display: none !important;
          }
          .thermal-row-page {
            width: 100%;
            height: ${currentPreset.heightMm}mm;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: repeat(${cols}, ${currentPreset.widthMm}mm);
            column-gap: ${currentPreset.gapXMm}mm;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }
          .thermal-row-page:last-of-type {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          @media print {
            .gondola-label {
              border: none !important;
            }
          }
        `;

        const rowsHtml: string[] = [];
        for (let i = 0; i < flatLabelsList.length; i += cols) {
          const chunk = flatLabelsList.slice(i, i + cols);
          const colsHtml = chunk.map(item => renderSingleLabelHtml(item, currentPreset, metrics));
          while (colsHtml.length < cols) {
            colsHtml.push(`
              <div class="empty-slot" style="width:${currentPreset.widthMm}mm;height:${currentPreset.heightMm}mm;visibility:hidden;"></div>
            `);
          }

          rowsHtml.push(`
            <div class="thermal-row-page">
              ${colsHtml.join('\n')}
            </div>
          `);
        }
        bodyContent = rowsHtml.join('\n');
      }
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title></title>
  <style>
    ${pageCss}
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #000000;
      background: #ffffff;
    }
  </style>
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch(e) {
          console.error(e);
        }
      }, 350);
    });
  </script>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
  };

  // Dispara a impressão
  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const html = generateLabelsHtml();
      executePrint(html);
    } catch (err) {
      console.error('Erro ao acionar impressão:', err);
    } finally {
      setTimeout(() => setIsPrinting(false), 800);
    }
  };

  // Renderiza um card individual de etiqueta no preview ao vivo
  const renderLiveLabelCard = (item: InventoryItem, indexBadge?: string, key?: React.Key) => {
    const barcodeCode = resolveBarcodeCode(item);
    const metrics = getLabelDesignMetrics(currentPreset);
    const itemBars = generateBarcodeBars(barcodeCode, {
      height: metrics.barcodeHeight * 1.1,
      narrowWidth: metrics.narrowWidth,
      wideWidth: metrics.narrowWidth * 2.3
    });

    return (
      <div
        key={key}
        className="w-full flex flex-col items-center"
        style={{
          maxWidth: currentPreset.widthMm >= 80 ? '480px' : '380px'
        }}
      >
        {indexBadge && (
          <div className="w-full flex items-center justify-between text-[10px] font-mono font-bold text-stone-500 dark:text-stone-400 mb-1 px-1">
            <span>{indexBadge}</span>
            <span className="truncate max-w-[200px]">{item.nome_comercial || item.name}</span>
          </div>
        )}
        <div 
          className="w-full bg-white text-black border-2 border-dashed border-stone-400 rounded-lg p-3 shadow-md space-y-2 font-sans select-none"
        >
          {/* Topo da Etiqueta: Linha inteira dedicada exclusivamente ao Nome/Descrição do Produto (até 2 linhas, font slim) */}
          <div className="flex items-center justify-center bg-white text-black border-b border-black pb-1 leading-tight w-full min-h-[34px] sm:min-h-[38px] max-h-[38px] sm:max-h-[42px] overflow-hidden">
            <div className="text-center w-full min-w-0">
              <div 
                className="font-medium text-[11px] sm:text-xs uppercase text-black line-clamp-2 leading-snug break-words" 
                title={item.nome_comercial || item.name}
              >
                {item.nome_comercial || item.name}
                {(item.brand || item.marca) ? ` • ${item.brand || item.marca}` : ''}
              </div>
            </div>
          </div>

          {/* Metade Inferior em Duas Colunas (Esquerda 73%: Código de Barras + Endereço | Direita 27%: Preço + Unidade) */}
          <div className="flex items-stretch justify-between gap-2 w-full">
            {/* Coluna Esquerda (~73%): Código de Barras e Endereço */}
            {(showBarcode || showAddress || showInternalCode) && (
              <div className={`${showPrice ? 'w-[73%]' : 'w-full'} shrink-0 flex flex-col ${showBarcode ? 'justify-between space-y-1.5' : 'justify-center'} min-w-0`}>
                {/* Código de Barras centralizado com numeração legível e destacada (renderizado condicionalmente por showBarcode) */}
                {showBarcode && (
                  <div className="py-0.5 flex flex-col items-center justify-center bg-white w-full">
                    {itemBars && (
                      <>
                        <svg 
                          viewBox={`0 0 ${itemBars.totalWidth} 30`} 
                          className="w-full max-h-[28px] block"
                        >
                          {itemBars.bars.map((b, idx) => (
                            <rect key={idx} x={b.x} y="0" width={b.width} height={30} fill="#000000" />
                          ))}
                        </svg>
                        <span className="text-xs sm:text-sm font-extrabold font-mono tracking-wider text-black text-center leading-tight mt-0.5">
                          {itemBars.displayCode}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Bloco de Endereçamento: Código Interno discreto logo acima do Endereço Formatado em mini-colunas alinhadas */}
                {(showAddress || showInternalCode) && (
                  <div className={`bg-white text-black border border-black rounded px-1.5 ${showBarcode ? 'py-1' : 'py-2.5 flex-1 flex flex-col justify-center'} text-center space-y-0.5 w-full`}>
                    {showInternalCode && (
                      <div className="text-[9.5px] font-mono font-bold text-black leading-none truncate">
                        CÓD: {item.code || item.codigo_produto || `ID:${item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`}
                      </div>
                    )}
                    {showAddress && (
                      <div className="flex items-start justify-center gap-0.5 sm:gap-1 pt-0.5">
                        {resolveAddressParts(item).map((part, idx, arr) => (
                          <React.Fragment key={idx}>
                            <div className="flex flex-col items-center justify-start min-w-[26px] sm:min-w-[32px]">
                              <span className="text-lg sm:text-xl font-black font-mono leading-none text-black">
                                {part}
                              </span>
                              <span className="text-[7px] sm:text-[7.5px] font-extrabold text-black leading-none mt-0.5 uppercase tracking-tight">
                                {ADDRESS_LEGEND_LABELS[idx]}
                              </span>
                            </div>
                            {idx < arr.length - 1 && (
                              <div className="flex flex-col items-center justify-start">
                                <span className="text-lg sm:text-xl font-black font-mono leading-none text-black">
                                  .
                                </span>
                                <span className="text-[7px] sm:text-[7.5px] font-extrabold text-black leading-none mt-0.5">
                                  .
                                </span>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Coluna Direita (~27%): Cifrão R$ acima e Preço numérico logo abaixo, com unidade na base */}
            {showPrice && (
              <div className={`flex-1 min-w-0 flex flex-col ${showBarcode ? 'justify-end' : 'justify-center'} items-center`}>
                <div className={`w-full border border-black rounded px-1 ${showBarcode ? 'py-1 sm:py-1.5' : 'py-2 h-full'} bg-white text-black flex flex-col items-center justify-center text-center`}>
                  <span className="text-[9px] sm:text-[10px] font-bold text-black leading-none tracking-tight">
                    R$
                  </span>
                  <span className="text-xs sm:text-sm font-black text-black leading-tight whitespace-nowrap">
                    {resolveProductPrice(item).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-black leading-none mt-0.5 uppercase">
                    / {(item.unidade_medida || item.unit || 'UN').toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 ${zIndexClass} bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150`}>
      <div 
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-sky-700 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
              <Barcode className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight font-['Outfit']">
                Impressão de Etiquetas de Gôndola / Almoxarifado
              </h3>
              <p className="text-[11px] text-sky-100">
                {entryTitle ? `${entryTitle} • ` : ''}{itemsToPrint.length} produto(s) • Total de etiquetas geradas: {totalLabelsCount} • Formato: {currentPreset.badge}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          
          {/* Seletor Principal: Modelo e Tamanho da Etiqueta */}
          <div className="p-3.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700/80 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              
              {/* Dropdown com os 12 modelos exatos */}
              <div className="md:col-span-8">
                <label className="block text-[11px] font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-sky-600" />
                  <span>Modelo e Tamanho da Etiqueta</span>
                </label>
                <select
                  value={labelSize}
                  onChange={(e) => {
                    const next = e.target.value as LabelSizePreset;
                    setLabelSize(next);
                    const cfg = getLabelPresetConfig(next);
                    if (cfg.category === 'a4') {
                      setStartPosition(1);
                    }
                  }}
                  className="w-full h-10 px-3 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer shadow-xs"
                >
                  <optgroup label="1. IMPRESSORAS COMUNS (Folhas Adesivas A4 - Grades com Margens)">
                    {A4_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="2. IMPRESSORAS TÉRMICAS (Rolos - Largura x Altura)">
                    {THERMAL_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Quantidade Global de Cópias */}
              <div className="md:col-span-4">
                <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase mb-1 flex items-center space-x-1">
                  <Copy className="w-3 h-3 text-stone-500" />
                  <span>Quantidade de Etiquetas</span>
                </label>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalCopies(Math.max(1, defaultCopies - 1))}
                    className="w-10 h-10 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition cursor-pointer flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={defaultCopies}
                    onChange={(e) => handleApplyGlobalCopies(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-10 text-center font-mono font-black text-sm border border-stone-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalCopies(defaultCopies + 1)}
                    className="w-10 h-10 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition cursor-pointer flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>

            {/* Regra de Quantidade Padrão (Radio Buttons) */}
            <div className="pt-2.5 border-t border-stone-200 dark:border-stone-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <Copy className="w-3.5 h-3.5 text-sky-600" />
                  <span>Regra de Quantidade Padrão</span>
                </label>
                <span className="text-[11px] font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                  Total de etiquetas geradas: {totalLabelsCount}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  onClick={() => handleSelectQuantityRule('single')}
                  className={`flex items-center space-x-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                    quantityRule === 'single'
                      ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-500 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500/50 font-bold'
                      : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-sky-400 font-semibold'
                  }`}
                >
                  <input
                    type="radio"
                    name="labelQuantityRule"
                    value="single"
                    checked={quantityRule === 'single'}
                    onChange={() => handleSelectQuantityRule('single')}
                    className="w-4 h-4 text-sky-600 border-stone-300 focus:ring-sky-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="leading-tight">Uma etiqueta por produto</div>
                    <div className="text-[10px] font-normal text-stone-500 dark:text-stone-400 mt-0.5">
                      Define exatamente 1 etiqueta para cada produto da lista ({itemsToPrint.length} {itemsToPrint.length === 1 ? 'etiqueta' : 'etiquetas'})
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => handleSelectQuantityRule('invoice')}
                  className={`flex items-center space-x-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                    quantityRule === 'invoice'
                      ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-500 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500/50 font-bold'
                      : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-sky-400 font-semibold'
                  }`}
                >
                  <input
                    type="radio"
                    name="labelQuantityRule"
                    value="invoice"
                    checked={quantityRule === 'invoice'}
                    onChange={() => handleSelectQuantityRule('invoice')}
                    className="w-4 h-4 text-sky-600 border-stone-300 focus:ring-sky-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="leading-tight">Quantidade da Nota Fiscal (Total de Unidades)</div>
                    <div className="text-[10px] font-normal text-stone-500 dark:text-stone-400 mt-0.5">
                      Preenche com a quantidade exata lançada na nota ({totalInvoiceUnitsCount} {totalInvoiceUnitsCount === 1 ? 'etiqueta' : 'etiquetas'})
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Configurações Avançadas e Reaproveitamento para A4 */}
            {isA4 && (
              <div className="pt-2.5 border-t border-stone-200 dark:border-stone-700/60 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-7">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Reaproveitamento de Folhas A4</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Defina em qual etiqueta da folha a impressão deve começar para reaproveitar folhas que já tiveram adesivos destacados.
                  </p>
                </div>

                <div className="sm:col-span-5 flex items-center justify-end space-x-2">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                    Iniciar na posição:
                  </label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min="1"
                      max={totalSlotsPerSheet}
                      value={startPosition}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setStartPosition(Math.max(1, Math.min(val, totalSlotsPerSheet)));
                        }
                      }}
                      className="w-16 h-8 text-center font-mono font-extrabold text-xs rounded-lg border border-amber-400 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-950/40 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    <span className="text-[11px] font-semibold text-stone-400 font-mono">
                      / {totalSlotsPerSheet}
                    </span>
                    {startPosition > 1 && (
                      <button
                        type="button"
                        onClick={() => setStartPosition(1)}
                        className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950 transition cursor-pointer text-[10px] font-bold"
                        title="Resetar para a 1ª posição"
                      >
                        Resetar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alternância de Abas de Pré-visualização se for A4 */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-700/60 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab('label')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    previewTab === 'label'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Modelo da Etiqueta</span>
                </button>
                {isA4 && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab('sheet')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      previewTab === 'sheet'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Grade da Folha A4 ({currentPreset.columns}x{currentPreset.rows})</span>
                  </button>
                )}
              </div>

              {/* Checkboxes de Elementos Visíveis */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <label className="inline-flex items-center space-x-1 text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showBarcode}
                    onChange={(e) => setShowBarcode(e.target.checked)}
                    className="rounded border-stone-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Código de Barras</span>
                </label>
                <label className="inline-flex items-center space-x-1 text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAddress}
                    onChange={(e) => setShowAddress(e.target.checked)}
                    className="rounded border-stone-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Endereço</span>
                </label>
                <label className="inline-flex items-center space-x-1 text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInternalCode}
                    onChange={(e) => setShowInternalCode(e.target.checked)}
                    className="rounded border-stone-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Código</span>
                </label>
                <label className="inline-flex items-center space-x-1 text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-stone-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Preço</span>
                </label>
              </div>
            </div>

          </div>

          {/* Seção de Visualização: Modelo Individual/Lote ou Folha A4 Completa */}
          {previewTab === 'label' || !isA4 ? (
            <div className="p-3 bg-stone-100 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-between px-1 mb-2 text-xs font-bold text-stone-700 dark:text-stone-300">
                <span>Total de etiquetas geradas: {flatLabelsList.length}</span>
                <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
                  {itemsToPrint.length} produto(s) na lista
                </span>
              </div>

              {flatLabelsList.length === 1 && previewProduct ? (
                renderLiveLabelCard(previewProduct)
              ) : (
                <div className="w-full space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-h-[380px] overflow-y-auto p-1 place-items-center">
                    {flatLabelsList.map((item, idx) =>
                      renderLiveLabelCard(item, `Etiqueta ${idx + 1} de ${flatLabelsList.length}`, `${item.id}_${idx}`)
                    )}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-2 font-mono">
                Dimensões reais de corte: {currentPreset.widthMm}mm × {currentPreset.heightMm}mm ({currentPreset.name.split('(')[0].trim()})
              </div>
            </div>
          ) : (
            /* Visualização Interativa da Grade A4 com clique na posição inicial */
            <div className="p-3 bg-stone-100 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-col items-center">
              <div className="w-full max-w-xl flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-sky-600" />
                  <span>Clique em qualquer posição para começar a impressão</span>
                </span>
                <span className="text-[11px] font-mono font-semibold text-stone-500">
                  Folha A4: {currentPreset.columns} colunas × {currentPreset.rows} linhas ({totalSlotsPerSheet} un)
                </span>
              </div>

              {/* Simulação da Folha A4 em Escala */}
              <div 
                className="w-full max-w-xl bg-white dark:bg-stone-900 border-2 border-stone-400 dark:border-stone-700 rounded-xl p-3 shadow-md overflow-x-auto"
              >
                <div 
                  className="grid gap-1 select-none"
                  style={{
                    gridTemplateColumns: `repeat(${currentPreset.columns}, minmax(0, 1fr))`
                  }}
                >
                  {Array.from({ length: totalSlotsPerSheet }).map((_, idx) => {
                    const slotNum = idx + 1;
                    const isSkipped = slotNum < startPosition;
                    const isPrinted = slotNum >= startPosition && slotNum < startPosition + totalLabelsCount;
                    const targetItem = isPrinted ? flatLabelsList[slotNum - startPosition] : null;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setStartPosition(slotNum)}
                        className={`h-11 rounded border text-left p-1 transition cursor-pointer flex flex-col justify-between overflow-hidden ${
                          isSkipped
                            ? 'bg-stone-100 dark:bg-stone-800/40 border-stone-300 dark:border-stone-700 text-stone-400 opacity-60'
                            : isPrinted
                            ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500'
                            : 'bg-white dark:bg-stone-800 border-dashed border-stone-300 dark:border-stone-700 text-stone-500 hover:border-sky-400'
                        }`}
                        title={`Posição ${slotNum}: ${isSkipped ? 'Ignorado (já usado)' : isPrinted ? targetItem?.name : 'Disponível'}`}
                      >
                        <div className="flex items-center justify-between text-[9px] font-mono leading-none font-bold">
                          <span>#{slotNum}</span>
                          {isSkipped && <span className="text-[8px] text-stone-400">Pulado</span>}
                          {isPrinted && <span className="text-[8px] text-sky-600 dark:text-sky-400 font-black">✓ Imprimir</span>}
                        </div>
                        {isPrinted && targetItem && (
                          <div className="text-[8.5px] font-black truncate leading-tight uppercase">
                            {targetItem.nome_comercial || targetItem.name}
                          </div>
                        )}
                        {isSkipped && (
                          <div className="text-[8px] italic text-stone-400 truncate">
                            Posição usada
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-4 text-[11px] font-semibold text-stone-600 dark:text-stone-400 mt-2">
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-stone-200 border border-stone-400 inline-block"></span>
                  <span>Pulado / Já destacado</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-sky-100 border border-sky-500 inline-block"></span>
                  <span>Será impresso nesta folha</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-3 h-3 rounded bg-white border border-dashed border-stone-400 inline-block"></span>
                  <span>Disponível</span>
                </span>
              </div>
            </div>
          )}

          {/* Seção 3: Lista de Produtos e Cópias */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Quantidade de Cópias por Produto
              </span>
              <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                Total de etiquetas geradas: {totalLabelsCount} • {isA4 ? `${Math.ceil((startPosition - 1 + totalLabelsCount) / totalSlotsPerSheet)} folha(s) A4` : 'Rolo Contínuo'}
              </span>
            </div>

            <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800/80 max-h-44 overflow-y-auto bg-white dark:bg-stone-900">
              {itemsToPrint.map(({ product: item, quantity = 1, invoiceQuantity }) => {
                const notaQty = Math.max(1, Math.round(Number(invoiceQuantity ?? quantity) || 1));
                const copies = getItemCopies(item.id, notaQty);
                const address = resolveAddress(item);

                return (
                  <div key={item.id} className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-stone-50 dark:hover:bg-stone-800/40 transition">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-stone-900 dark:text-stone-100 truncate">
                        {item.nome_comercial || item.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                        <span className="font-mono font-bold bg-stone-100 dark:bg-stone-800 px-1 rounded">
                          Cód: {item.code || `PRD-${item.id.slice(-6)}`}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">
                          Gôndola: {address}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-stone-600 dark:text-stone-300 font-semibold">
                          Qtd. Nota: {notaQty} {(item.unidade_medida || item.unit || 'UN').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setItemCopies(item.id, Math.max(1, copies - 1))}
                        className="w-7 h-7 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={copies}
                        onChange={(e) => setItemCopies(item.id, parseInt(e.target.value, 10) || 1)}
                        className="w-12 h-7 text-center font-mono font-bold text-xs border border-stone-300 dark:border-stone-700 rounded bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setItemCopies(item.id, copies + 1)}
                        className="w-7 h-7 rounded border border-stone-300 dark:border-stone-700 flex items-center justify-center font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer com Botões */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            {onBackToQueue && (
              <button
                type="button"
                onClick={onBackToQueue}
                className="px-3.5 py-2 text-xs font-bold text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar à Fila</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl transition cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{isPrinting ? 'Preparando Impressão...' : `Imprimir ${totalLabelsCount} Etiqueta(s)`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
