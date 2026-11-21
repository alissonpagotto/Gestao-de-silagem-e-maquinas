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
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { generateBarcodeSvgString, generateBarcodeBars } from './barcodeGenerator';
import { executePrint } from '../../lib/printService';
import { formatCurrencyBRL } from '../../lib/storage';
import { buildDanfeViewerToolbarCss, buildDanfeViewerZoomScript } from '../../lib/danfeOficialHtml';
import { 
  type LabelSizePreset, 
  type LabelPresetConfig, 
  type LabelDesignMetrics,
  type CustomLabelDraft,
  type CustomPaperType,
  A4_PRESETS, 
  CARTA_PRESETS,
  THERMAL_PRESETS, 
  DEFAULT_CUSTOM_LABEL_DRAFT,
  buildCustomLabelPreset,
  computeCenteredSheetMargins,
  extractDraftFromPreset,
  loadCustomLabelPresets,
  saveCustomLabelPreset,
  deleteCustomLabelPreset,
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
  const [customPresets, setCustomPresets] = useState<LabelPresetConfig[]>(() => loadCustomLabelPresets());
  const [isCustomPanelOpen, setIsCustomPanelOpen] = useState<boolean>(false);
  const [customDraft, setCustomDraft] = useState<CustomLabelDraft>(DEFAULT_CUSTOM_LABEL_DRAFT);
  const [customSavedFeedback, setCustomSavedFeedback] = useState<string | null>(null);
  const [startPosition, setStartPosition] = useState<number>(1);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showInternalCode, setShowInternalCode] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [quantityRule, setQuantityRule] = useState<LabelQuantityRule>(
    defaultQuantityRule ?? (onBackToQueue ? 'invoice' : 'single')
  );
  const [defaultCopies, setDefaultCopies] = useState<number>(1);
  const [defaultCopiesInput, setDefaultCopiesInput] = useState<string>('1');
  const [customCopies, setCustomCopies] = useState<Record<string, number>>({});
  const [customCopiesInputs, setCustomCopiesInputs] = useState<Record<string, string>>({});
  const [isPrinting, setIsPrinting] = useState(false);
  const [previewTab, setPreviewTab] = useState<'label' | 'sheet'>('label');

  // Obtém o preset ativo (incluindo personalizado em tempo real ou salvo)
  const currentPreset = useMemo<LabelPresetConfig>(() => {
    if (labelSize === 'custom_inline') {
      return buildCustomLabelPreset(customDraft, 'custom_inline');
    }
    return getLabelPresetConfig(labelSize, customPresets);
  }, [labelSize, customDraft, customPresets]);

  const isSheetPreset = currentPreset.category === 'a4' || currentPreset.category === 'carta';
  const totalSlotsPerSheet = currentPreset.totalPerSheet || (currentPreset.cols * currentPreset.rows) || 30;

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

  // Sincroniza as quantidades e modelos personalizados quando o modal abre ou o lote muda
  useEffect(() => {
    if (!isOpen) return;
    setCustomPresets(loadCustomLabelPresets());
    setCustomSavedFeedback(null);
    const initialRule: LabelQuantityRule = defaultQuantityRule ?? (onBackToQueue ? 'invoice' : 'single');
    setQuantityRule(initialRule);

    if (itemsToPrint.length > 0) {
      const synced: Record<string, number> = {};
      const syncedInputs: Record<string, string> = {};
      itemsToPrint.forEach(({ product: item, quantity, invoiceQuantity }) => {
        const notaQty = Math.max(1, Math.round(Number(invoiceQuantity ?? quantity) || 1));
        const val = initialRule === 'single' ? 1 : notaQty;
        synced[item.id] = val;
        syncedInputs[item.id] = String(val);
      });
      setCustomCopies(synced);
      setCustomCopiesInputs(syncedInputs);
      setDefaultCopies(1);
      setDefaultCopiesInput('1');
    }
  }, [isOpen, itemsToPrint, defaultQuantityRule, onBackToQueue]);

  useEffect(() => {
    if (startPosition > totalSlotsPerSheet) {
      setStartPosition(Math.max(1, totalSlotsPerSheet));
    }
  }, [totalSlotsPerSheet, startPosition]);

  const handleToggleCustomPanel = () => {
    if (!isCustomPanelOpen) {
      if (labelSize !== 'custom_inline') {
        const seed = extractDraftFromPreset(currentPreset);
        setCustomDraft({
          ...seed,
          id: undefined,
          name: currentPreset.isCustom ? seed.name : `Personalizada ${seed.labelWidthMm}×${seed.labelHeightMm}`,
        });
        setLabelSize('custom_inline');
      }
      setIsCustomPanelOpen(true);
    } else {
      setIsCustomPanelOpen(false);
    }
  };

  const handleUpdateCustomDraft = (patch: Partial<CustomLabelDraft>) => {
    setCustomDraft((prev) => ({ ...prev, ...patch }));
    if (labelSize !== 'custom_inline') {
      setLabelSize('custom_inline');
    }
  };

  const handleSaveCustomPreset = () => {
    const { saved, all } = saveCustomLabelPreset(customDraft);
    setCustomPresets(all);
    setLabelSize(saved.id);
    setCustomSavedFeedback('Modelo salvo na lista!');
    setTimeout(() => setCustomSavedFeedback(null), 2500);
  };

  const handleDeleteCustomPreset = (idToDelete: string) => {
    const remaining = deleteCustomLabelPreset(idToDelete);
    setCustomPresets(remaining);
    if (labelSize === idToDelete) {
      setLabelSize(remaining[0]?.id || 'termica_gondola_60x30');
    }
  };

  // Primeiro produto para pré-visualização ao vivo
  const previewProduct = itemsToPrint[0]?.product;

  // Obter quantidade de cópias de um item
  const getItemCopies = (prodId: string, fallbackQty: number = 1): number => {
    if (customCopies[prodId] !== undefined) return customCopies[prodId];
    if (quantityRule === 'single') return 1;
    return fallbackQty > 0 ? fallbackQty : defaultCopies;
  };

  const setItemCopies = (prodId: string, copies: number, rawInput?: string) => {
    const valid = Math.min(999, Math.max(1, Math.round(copies) || 1));
    setCustomCopies(prev => ({
      ...prev,
      [prodId]: valid
    }));
    setCustomCopiesInputs(prev => ({
      ...prev,
      [prodId]: rawInput !== undefined ? rawInput : String(valid)
    }));
  };

  // Alterna entre as regras globais: "Uma etiqueta por produto" vs "Quantidade da Nota Fiscal (Total de Unidades)"
  const handleSelectQuantityRule = (rule: LabelQuantityRule) => {
    setQuantityRule(rule);
    const updated: Record<string, number> = {};
    const updatedInputs: Record<string, string> = {};
    if (rule === 'single') {
      setDefaultCopies(1);
      setDefaultCopiesInput('1');
      itemsToPrint.forEach(({ product: item }) => {
        updated[item.id] = 1;
        updatedInputs[item.id] = '1';
      });
    } else {
      itemsToPrint.forEach(({ product: item, quantity, invoiceQuantity }) => {
        const exactNotaQty = Math.max(1, Math.round(Number(invoiceQuantity ?? quantity) || 1));
        updated[item.id] = exactNotaQty;
        updatedInputs[item.id] = String(exactNotaQty);
      });
    }
    setCustomCopies(updated);
    setCustomCopiesInputs(updatedInputs);
  };

  // Aplica quantidade padrão manual para todos os itens da lista
  const handleApplyGlobalCopies = (qty: number, rawInput?: string) => {
    const valid = Math.min(999, Math.max(1, Math.round(qty) || 1));
    setDefaultCopies(valid);
    setDefaultCopiesInput(rawInput !== undefined ? rawInput : String(valid));
    const updated: Record<string, number> = {};
    const updatedInputs: Record<string, string> = {};
    itemsToPrint.forEach(({ product: item }) => {
      updated[item.id] = valid;
      updatedInputs[item.id] = String(valid);
    });
    setCustomCopies(updated);
    setCustomCopiesInputs(updatedInputs);
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
  }, [itemsToPrint, customCopies, defaultCopies, quantityRule]);

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

  // Renderiza o HTML individual de uma etiqueta compatível com CSS print e calibração milimétrica
  const renderSingleLabelHtml = (
    item: InventoryItem,
    preset: LabelPresetConfig,
    metrics: LabelDesignMetrics
  ): string => {
    const barcodeValue = resolveBarcodeCode(item);
    const addressParts = resolveAddressParts(item);
    const internalCode = item.code || item.codigo_produto || `ID:${item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
    const prodName = item.nome_comercial || item.name || 'Produto sem descrição';
    const prodBrand = item.brand || item.marca ? ` • ${item.brand || item.marca}` : '';
    const unit = (item.unidade_medida || item.unit || 'UN').toUpperCase();
    const salePrice = resolveProductPrice(item);

    const isTinyWidth = preset.labelWidthMm <= 34;
    const hideLegendOnUltraLow = preset.labelHeightMm <= 14.5 && showBarcode && showInternalCode;
    const innerHeightMm = Math.max(4, preset.labelHeightMm - 3);
    const barcodeMaxHeightMm =
      preset.labelHeightMm <= 18
        ? Number((innerHeightMm * 0.27).toFixed(1))
        : preset.labelHeightMm > 180
        ? 64
        : Number(Math.max(4.5, Math.min(44, innerHeightMm * 0.31)).toFixed(1));
    const isMiniHeight = preset.labelHeightMm <= 22.5;

    const formattedPriceStr = formatCurrencyBRL(salePrice);
    const priceNumericStr = formattedPriceStr.replace(/^R\$\s*/, '') || '0,00';

    const barcodeSvg = generateBarcodeSvgString(barcodeValue, {
      height: metrics.barcodeHeight,
      narrowWidth: metrics.narrowWidth,
      wideWidth: metrics.narrowWidth * 2.15,
      showText: false,
      fontSize: 16,
      textColor: '#000000',
      barColor: '#000000',
    });

    const addressColumnsHtml = addressParts
      .map(
        (part, idx) => `
      <div class="address-col" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        min-width: ${isTinyWidth ? '0px' : metrics.isCompact ? '8px' : '14px'};
      ">
        <div class="address-code" style="
          font-size: ${metrics.addressCodeFontSizePt}pt;
          font-weight: 900;
          font-family: 'Courier New', Courier, monospace;
          line-height: 0.92;
          color: #000000;
          background: #ffffff;
          white-space: nowrap;
        ">
          ${part}
        </div>
        ${
          hideLegendOnUltraLow
            ? ''
            : `<div class="address-legend" style="
          font-size: ${metrics.addressLegendFontSizePt}pt;
          font-weight: 800;
          letter-spacing: 0px;
          color: #000000;
          background: #ffffff;
          line-height: 0.95;
          margin-top: 0.5px;
          white-space: nowrap;
          text-align: center;
        ">
          ${ADDRESS_LEGEND_LABELS[idx]}
        </div>`
        }
      </div>
      ${
        idx < addressParts.length - 1
          ? `
        <div class="address-sep" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 0 0.3px;
        ">
          <div style="
            font-size: ${metrics.addressCodeFontSizePt}pt;
            font-weight: 900;
            font-family: 'Courier New', Courier, monospace;
            line-height: 0.85;
            color: #000000;
          ">.</div>
          ${
            hideLegendOnUltraLow
              ? ''
              : `<div style="
            font-size: ${metrics.addressLegendFontSizePt}pt;
            font-weight: 800;
            line-height: 0.95;
            margin-top: 0.5px;
            color: #000000;
          ">.</div>`
          }
        </div>
      `
          : ''
      }
    `
      )
      .join('');

    return `
      <div class="label-cell gondola-label" style="
        width: ${preset.labelWidthMm}mm;
        min-width: ${preset.labelWidthMm}mm;
        max-width: ${preset.labelWidthMm}mm;
        height: ${preset.labelHeightMm}mm;
        min-height: ${preset.labelHeightMm}mm;
        max-height: ${preset.labelHeightMm}mm;
        background: #ffffff;
        color: #000000;
        position: relative;
      ">
        <!-- Topo: Descrição do Produto -->
        <div class="label-header" style="
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1.05;
          background: #ffffff;
          color: #000000;
          border-bottom: 0.4px solid #000000;
          padding-bottom: ${isMiniHeight ? '0.3px' : '0.5px'};
          margin-bottom: ${isMiniHeight ? '0.3px' : '0.5px'};
          width: 100%;
          max-width: 100%;
          ${metrics.headerMinMm > 0 ? `min-height: ${metrics.headerMinMm}mm;` : ''}
          max-height: ${metrics.headerMaxMm}mm;
          overflow: hidden;
          box-sizing: border-box;
          flex-shrink: 0;
        ">
          <div class="label-product-name" style="
            font-size: ${metrics.nameFontSizePt}pt;
            font-weight: 600;
            color: #000000;
            background: #ffffff;
            text-transform: uppercase;
            text-align: center;
            display: -webkit-box;
            -webkit-line-clamp: ${metrics.headerLines};
            -webkit-box-orient: vertical;
            overflow: hidden;
            word-break: break-word;
            line-height: 1.05;
            max-height: ${metrics.headerLines === 1 ? '1.12em' : '2.15em'};
            width: 100%;
            min-width: 0;
          " title="${prodName}">
            ${prodName}${prodBrand}
          </div>
        </div>

        <!-- Metade Inferior em Duas Colunas (Esquerda 72%: Código de Barras + Endereço | Direita 28%: Preço + Unidade) -->
        <div class="label-lower-columns" style="
          display: flex;
          flex-direction: ${metrics.isNarrowVertical ? 'column' : 'row'};
          align-items: ${metrics.isNarrowVertical ? 'center' : 'stretch'};
          justify-content: ${metrics.isNarrowVertical ? 'center' : 'space-between'};
          gap: ${isTinyWidth ? '1px' : '2px'};
          flex: ${isMiniHeight ? '0 1 auto' : '1'};
          width: 100%;
          max-width: 100%;
          min-height: 0;
          overflow: hidden;
          box-sizing: border-box;
        ">
          ${
            showBarcode || showAddress || showInternalCode
              ? `
            <div class="label-left-col" style="
              width: ${metrics.isNarrowVertical ? '100%' : showPrice ? (isTinyWidth ? '70%' : '73%') : '100%'};
              max-width: ${metrics.isNarrowVertical ? '100%' : showPrice ? (isTinyWidth ? '70%' : '73%') : '100%'};
              flex: ${metrics.isNarrowVertical ? '0 1 auto' : `0 0 ${showPrice ? (isTinyWidth ? '70%' : '73%') : '100%'}`};
              display: flex;
              flex-direction: column;
              justify-content: ${isMiniHeight || !showBarcode ? 'center' : 'space-between'};
              align-items: stretch;
              gap: ${isMiniHeight ? '0.4px' : '0'};
              min-width: 0;
              min-height: 0;
              overflow: hidden;
              box-sizing: border-box;
            ">
              ${
                showBarcode
                  ? `
                <div class="label-barcode-container" style="
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  flex: ${isMiniHeight ? '0 1 auto' : '1'};
                  min-height: 0;
                  width: 100%;
                  max-width: 100%;
                  overflow: hidden;
                  margin: 0;
                  box-sizing: border-box;
                  background: #ffffff;
                ">
                  <div style="width:100%;max-height:${barcodeMaxHeightMm}mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                    ${barcodeSvg}
                  </div>
                  <div class="barcode-digits-text" style="
                    font-size: ${metrics.codeFontSizePt}pt;
                    font-weight: 800;
                    font-family: 'Courier New', Courier, monospace;
                    color: #000000;
                    background: #ffffff;
                    text-align: center;
                    letter-spacing: ${isTinyWidth ? '0.2px' : '0.4px'};
                    line-height: 0.95;
                    margin-top: ${isMiniHeight ? '0.2px' : '0.5px'};
                    white-space: nowrap;
                    overflow: hidden;
                    max-width: 100%;
                  ">
                    ${barcodeValue}
                  </div>
                </div>
              `
                  : ''
              }

              ${
                showAddress || showInternalCode
                  ? `
                <div class="label-address-box" style="
                  border: 0.4px solid #000000;
                  background: #ffffff;
                  color: #000000;
                  border-radius: 1.5px;
                  padding: ${metrics.isUltraCompact ? '0.3px 0.8px' : showBarcode ? '1px 1.5px' : '2px 2px'};
                  text-align: center;
                  margin-top: ${isMiniHeight ? '0.2px' : '0.5px'};
                  width: 100%;
                  max-width: 100%;
                  ${!showBarcode && !isMiniHeight ? 'flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;' : 'flex-shrink: 0;'}
                  overflow: hidden;
                  box-sizing: border-box;
                ">
                  ${
                    showInternalCode
                      ? `
                    <div class="label-internal-code" style="
                      font-size: ${Math.max(3.4, metrics.codeFontSizePt * (metrics.isUltraCompact ? 0.8 : showBarcode ? 0.76 : 0.9))}pt;
                      font-family: 'Courier New', Courier, monospace;
                      font-weight: 700;
                      letter-spacing: 0.1px;
                      line-height: 0.92;
                      margin-bottom: ${showAddress ? (isMiniHeight ? '0.2px' : '0.5px') : '0'};
                      color: #000000;
                      background: #ffffff;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      max-width: 100%;
                    ">
                      CÓD: ${internalCode}
                    </div>
                  `
                      : ''
                  }
                  ${
                    showAddress
                      ? `
                    <div class="address-columns-row" style="
                      display: flex;
                      align-items: flex-start;
                      justify-content: center;
                      gap: ${isTinyWidth ? '0.3px' : '1px'};
                      width: 100%;
                      background: #ffffff;
                      color: #000000;
                      overflow: hidden;
                    ">
                      ${addressColumnsHtml}
                    </div>
                  `
                      : ''
                  }
                </div>
              `
                  : ''
              }
            </div>
          `
              : ''
          }

          ${
            showPrice
              ? `
            <div class="label-right-price-col" style="
              width: ${metrics.isNarrowVertical ? '100%' : 'auto'};
              flex: ${metrics.isNarrowVertical ? '0 0 auto' : '1'};
              min-width: 0;
              min-height: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: #ffffff;
              color: #000000;
              box-sizing: border-box;
              overflow: hidden;
            ">
              <div class="label-price-box" style="
                width: 100%;
                ${!showBarcode && !isMiniHeight ? 'flex: 1; margin-top: 0.5px;' : ''}
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                border: 0.4px solid #000000;
                border-radius: 1.5px;
                padding: ${metrics.isUltraCompact ? '0.4px' : '1px 1.5px'};
                background: #ffffff;
                color: #000000;
                box-sizing: border-box;
                overflow: hidden;
              ">
                <div class="label-price-symbol" style="
                  font-size: ${metrics.priceSymbolFontSizePt}pt;
                  font-weight: 700;
                  color: #000000;
                  background: #ffffff;
                  line-height: 0.9;
                ">
                  R$
                </div>
                <div class="label-price-value" style="
                  font-size: ${metrics.priceFontSizePt}pt;
                  font-weight: 900;
                  color: #000000;
                  background: #ffffff;
                  line-height: 1;
                  white-space: nowrap;
                ">
                  ${priceNumericStr}
                </div>
                <div class="label-price-unit" style="
                  font-size: ${metrics.priceUnitFontSizePt}pt;
                  font-weight: 700;
                  color: #000000;
                  background: #ffffff;
                  line-height: 0.95;
                  margin-top: 0.3px;
                  white-space: nowrap;
                ">
                  / ${unit}
                </div>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  };

  // Gerador do HTML de impressão calibrado milimetricamente para A4, Carta e Térmica
  const generateLabelsHtml = (): string => {
    const metrics = getLabelDesignMetrics(currentPreset);
    const isSheetPaper = currentPreset.category === 'a4' || currentPreset.category === 'carta';
    const sheetWidthMm =
      currentPreset.category === 'carta'
        ? 215.9
        : currentPreset.category === 'a4'
        ? 210
        : currentPreset.pageWidthMm;
    const sheetHeightMm =
      currentPreset.category === 'carta'
        ? 279
        : currentPreset.category === 'a4'
        ? 296.5
        : currentPreset.pageHeightMm;
    const pageSizeCss =
      currentPreset.category === 'carta'
        ? 'letter portrait'
        : currentPreset.category === 'a4'
        ? 'A4 portrait'
        : `${currentPreset.pageWidthMm}mm ${currentPreset.pageHeightMm}mm`;

    const cols = Math.max(1, currentPreset.cols || currentPreset.columns || 1);
    const rows = isSheetPaper
      ? currentPreset.rows || Math.ceil((currentPreset.totalPerSheet || 30) / cols)
      : Math.max(1, currentPreset.rows || 1);

    const layoutCss = `
      :root {
        --sheet-w: ${sheetWidthMm}mm;
        --sheet-h: ${sheetHeightMm}mm;
      }
      .label-cell,
      .gondola-label,
      .sheet-slot {
        width: ${currentPreset.labelWidthMm}mm !important;
        min-width: ${currentPreset.labelWidthMm}mm !important;
        max-width: ${currentPreset.labelWidthMm}mm !important;
        height: ${currentPreset.labelHeightMm}mm !important;
        min-height: ${currentPreset.labelHeightMm}mm !important;
        max-height: ${currentPreset.labelHeightMm}mm !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .label-cell {
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        padding: 1.5mm 2mm !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .sheet-slot.empty-slot,
      .empty-slot {
        visibility: hidden !important;
        border: none !important;
      }
      .label-sheet {
        width: var(--sheet-w);
        height: var(--sheet-h);
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(${cols}, ${currentPreset.labelWidthMm}mm);
        grid-template-rows: repeat(${rows}, ${currentPreset.labelHeightMm}mm);
        column-gap: ${currentPreset.colGapMm}mm;
        row-gap: ${currentPreset.rowGapMm}mm;
        justify-content: center;
        align-content: center;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
        overflow: hidden;
      }
      .label-sheet:last-of-type {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
    `;

    let bodyContent = '';
    if (isSheetPaper) {
      const slotsPerSheet = currentPreset.totalPerSheet || cols * rows || 30;
      const safeStartPos = Math.max(1, Math.min(startPosition, slotsPerSheet));

      const sheetsHtml: string[] = [];
      let currentFlatIdx = 0;
      let sheetNum = 1;

      while (currentFlatIdx < flatLabelsList.length) {
        const slotsHtml: string[] = [];
        const isFirstSheet = sheetNum === 1;
        const initialOffset = isFirstSheet ? safeStartPos - 1 : 0;

        for (let s = 0; s < initialOffset; s++) {
          slotsHtml.push(`
            <div class="sheet-slot empty-slot" style="width:${currentPreset.labelWidthMm}mm;height:${currentPreset.labelHeightMm}mm;box-sizing:border-box;visibility:hidden;border:none;"></div>
          `);
        }

        const slotsAvailable = slotsPerSheet - initialOffset;
        for (let s = 0; s < slotsAvailable && currentFlatIdx < flatLabelsList.length; s++) {
          const item = flatLabelsList[currentFlatIdx++];
          slotsHtml.push(renderSingleLabelHtml(item, currentPreset, metrics));
        }

        sheetsHtml.push(`
          <div class="label-sheet">
            ${slotsHtml.join('\n')}
          </div>
        `);
        sheetNum++;
      }

      bodyContent = sheetsHtml.join('\n');
    } else {
      const perBlock = Math.max(1, cols * rows);
      const blocksHtml: string[] = [];
      for (let i = 0; i < flatLabelsList.length; i += perBlock) {
        const chunk = flatLabelsList.slice(i, i + perBlock);
        const colsHtml = chunk.map(item => renderSingleLabelHtml(item, currentPreset, metrics));
        while (colsHtml.length < perBlock) {
          colsHtml.push(`
            <div class="sheet-slot empty-slot" style="width:${currentPreset.labelWidthMm}mm;height:${currentPreset.labelHeightMm}mm;box-sizing:border-box;visibility:hidden;border:none;"></div>
          `);
        }

        blocksHtml.push(`
          <div class="label-sheet">
            ${colsHtml.join('\n')}
          </div>
        `);
      }
      bodyContent = blocksHtml.join('\n');
    }

    const toolbarTitle = `${currentPreset.badge.toUpperCase()} • ${flatLabelsList.length} ETIQUETA(S)`.replace(/[<>&"]/g, '');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title></title>
  <style>
    @page {
      size: ${pageSizeCss};
      margin: 0mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    ${buildDanfeViewerToolbarCss()}
    ${layoutCss}
    .label-barcode-container svg {
      max-width: 100% !important;
      max-height: 100% !important;
      width: auto !important;
      height: auto !important;
      display: block !important;
      margin: 0 auto !important;
    }
    @media screen {
      html, body {
        background: #525659 !important;
        min-height: 100vh;
      }
      body {
        padding: 68px 16px 28px 16px !important;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      #zoom-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        transform-origin: top center;
      }
      .label-sheet {
        background: #ffffff;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45);
      }
      .label-cell,
      .gondola-label {
        border: 1px dashed #cbd5e1;
      }
    }
    @media print {
      @page {
        size: ${pageSizeCss};
        margin: 0mm;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: var(--sheet-w) !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        background: #ffffff !important;
        display: block !important;
      }
      header, footer, .no-print, .danfe-toolbar, .print-metadata {
        display: none !important;
      }
      #zoom-wrapper {
        transform: none !important;
        zoom: 1 !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        gap: 0 !important;
      }
      .label-sheet {
        width: var(--sheet-w) !important;
        height: var(--sheet-h) !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        display: grid !important;
        grid-template-columns: repeat(${cols}, ${currentPreset.labelWidthMm}mm) !important;
        grid-template-rows: repeat(${rows}, ${currentPreset.labelHeightMm}mm) !important;
        column-gap: ${currentPreset.colGapMm}mm !important;
        row-gap: ${currentPreset.rowGapMm}mm !important;
        justify-content: center !important;
        align-content: center !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        overflow: hidden !important;
      }
      .label-sheet:last-of-type {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .label-cell,
      .gondola-label,
      .sheet-slot,
      .empty-slot {
        border: none !important;
        outline: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print danfe-toolbar" role="toolbar" aria-label="Controles de visualização e impressão">
    <div class="danfe-toolbar-left">
      <span class="danfe-toolbar-title">${toolbarTitle}</span>
    </div>
    <div class="danfe-zoom-group">
      <button type="button" id="danfe-zoom-out" class="danfe-zoom-btn" title="Reduzir zoom (-10%)">➖</button>
      <span id="danfe-zoom-indicator" class="danfe-zoom-value" title="Clique para redefinir para 100%">100%</span>
      <button type="button" id="danfe-zoom-in" class="danfe-zoom-btn" title="Aumentar zoom (+10%)">➕</button>
    </div>
    <div class="danfe-toolbar-actions">
      <button type="button" class="danfe-btn-print" onclick="window.focus();window.print();">🖨️ Imprimir / Salvar PDF</button>
      <button type="button" class="danfe-btn-close" onclick="window.close();">✖️ Fechar</button>
    </div>
  </div>

  <div id="zoom-wrapper">
    ${bodyContent}
  </div>

  ${buildDanfeViewerZoomScript('#zoom-wrapper')}
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
    <div
      className={`fixed inset-0 ${zIndexClass} bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150`}
    >
      <div 
        className="bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] shadow-2xl overflow-hidden flex flex-col justify-between mx-auto my-auto animate-in zoom-in-95 duration-150 text-black dark:text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================== */}
        {/* CABEÇALHO OFICIAL ALTO CONTRASTE */}
        {/* ============================================================== */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 flex items-center justify-center border border-black dark:border-stone-700 shadow-2xs shrink-0">
              <Barcode className="w-4 h-4 text-sky-700 dark:text-sky-400 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black dark:text-stone-100 font-['Outfit']">
                IMPRESSÃO DE ETIQUETAS DE GÔNDOLA / ALMOXARIFADO
              </h3>
              <p className="text-[11px] text-black/75 dark:text-stone-400 font-bold">
                {entryTitle ? `${entryTitle.toUpperCase()} • ` : ''}{itemsToPrint.length} PRODUTO(S) • TOTAL: {totalLabelsCount} ETIQUETAS • {currentPreset.badge.toUpperCase()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-black/10 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4 text-black dark:text-stone-200" />
          </button>
        </div>

        {/* Corpo do Modal com Slim Design */}
        <div className="p-3 sm:p-4 space-y-2.5 overflow-y-auto scrollbar-none flex-1 min-h-0 bg-[#cad4e6]">
          
          {/* Seletor Principal: Modelo e Tamanho da Etiqueta */}
          <div className="p-2.5 sm:p-3 bg-[#e0e6f1] dark:bg-stone-800/60 rounded-xl border border-black dark:border-stone-700 shadow-2xs space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              
              {/* Dropdown organizado + Botão Criar Etiqueta Personalizada */}
              <div className="md:col-span-9">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-1 flex items-center space-x-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>MODELO E TAMANHO DA ETIQUETA</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={labelSize}
                    onChange={(e) => {
                      const next = e.target.value as LabelSizePreset;
                      if (next === 'custom_inline') {
                        if (labelSize !== 'custom_inline') {
                          const seed = extractDraftFromPreset(currentPreset);
                          setCustomDraft({
                            ...seed,
                            id: undefined,
                            name: currentPreset.isCustom ? seed.name : `Personalizada ${seed.labelWidthMm}×${seed.labelHeightMm}`,
                          });
                        }
                        setLabelSize('custom_inline');
                        setIsCustomPanelOpen(true);
                        return;
                      }
                      setLabelSize(next);
                      const cfg = getLabelPresetConfig(next, customPresets);
                      if (cfg.category === 'a4' || cfg.category === 'carta') {
                        setStartPosition(1);
                      }
                      if (cfg.isCustom) {
                        setCustomDraft(extractDraftFromPreset(cfg));
                      }
                    }}
                    className="flex-1 min-w-0 h-8 sm:h-8.5 px-2.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer shadow-2xs"
                  >
                    <option value="custom_inline">📐 Personalizado (Definir Medidas em mm)</option>
                    {customPresets.length > 0 && (
                      <optgroup label="⭐ Meus Modelos Personalizados">
                        {customPresets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Grupo 1 — Folha A4 (210 × 297 mm — Padrão Pimaco / Colacril)">
                      {A4_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Grupo 2 — Folha Carta / Letter (215,9 × 279,4 mm — Padrão Pimaco 6080/6180)">
                      {CARTA_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Grupo 3 — Impressoras Térmicas (Rolos Contínuos — Largura × Altura)">
                      {THERMAL_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  <button
                    type="button"
                    onClick={handleToggleCustomPanel}
                    className={`h-8 sm:h-8.5 px-2.5 text-[11px] font-bold rounded-lg border border-black transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 shadow-2xs ${
                      isCustomPanelOpen || labelSize === 'custom_inline'
                        ? 'bg-amber-200 hover:bg-amber-300 text-black'
                        : 'bg-white hover:bg-slate-100 text-black dark:bg-stone-800 dark:text-stone-100 dark:border-stone-600'
                    }`}
                    title="Definir tamanho personalizado de etiqueta em milímetros"
                  >
                    <span>⚙️ + Tamanho Personalizado</span>
                  </button>

                  {currentPreset.isCustom && labelSize !== 'custom_inline' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomPreset(currentPreset.id)}
                      className="h-8 sm:h-8.5 px-2 rounded-lg border border-black bg-red-50 hover:bg-red-100 text-red-700 transition cursor-pointer shrink-0 flex items-center justify-center shadow-2xs"
                      title="Excluir este modelo personalizado"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quantidade Global de Cópias */}
              <div className="md:col-span-3">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider mb-1 flex items-center space-x-1">
                  <Copy className="w-3 h-3 text-slate-500" />
                  <span>QUANTIDADE DE ETIQUETAS</span>
                </label>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalCopies(Math.max(1, defaultCopies - 1))}
                    className="w-8 h-8 rounded-lg border border-slate-300 dark:border-stone-700 bg-gradient-to-b from-white to-slate-100 dark:from-stone-800 dark:to-stone-900 font-bold text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700 transition cursor-pointer flex items-center justify-center text-xs shadow-2xs"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={defaultCopiesInput}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw.trim() === '') {
                        setDefaultCopiesInput('');
                        return;
                      }
                      const parsed = parseInt(raw, 10);
                      if (!Number.isNaN(parsed)) {
                        const clamped = Math.min(999, Math.max(1, parsed));
                        handleApplyGlobalCopies(clamped, parsed > 999 ? '999' : raw);
                      }
                    }}
                    onBlur={() => {
                      if (!defaultCopiesInput.trim() || Number(defaultCopiesInput) < 1) {
                        setDefaultCopiesInput(String(defaultCopies));
                      } else {
                        const clamped = Math.min(999, Math.max(1, parseInt(defaultCopiesInput, 10) || defaultCopies));
                        setDefaultCopiesInput(String(clamped));
                      }
                    }}
                    aria-label="Quantidade de etiquetas"
                    className="w-full h-8 text-center font-mono font-black text-xs border border-slate-300 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyGlobalCopies(Math.min(999, defaultCopies + 1))}
                    className="w-8 h-8 rounded-lg border border-slate-300 dark:border-stone-700 bg-gradient-to-b from-white to-slate-100 dark:from-stone-800 dark:to-stone-900 font-bold text-slate-700 dark:text-stone-300 hover:bg-slate-100 dark:hover:bg-stone-700 transition cursor-pointer flex items-center justify-center text-xs shadow-2xs"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>

            {/* Painel Rápido de Etiqueta Personalizada (Atualiza pré-visualização em tempo real) */}
            {isCustomPanelOpen && (
              <div className="p-2.5 rounded-lg bg-white/95 dark:bg-stone-900/90 border border-black dark:border-stone-600 shadow-2xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-stone-700 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase text-slate-800 dark:text-stone-100">
                      📐 Medidas Personalizadas da Etiqueta (mm)
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                      {currentPreset.labelWidthMm} × {currentPreset.labelHeightMm} mm • {currentPreset.cols}×{currentPreset.rows}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {customDraft.paperType !== 'termica' && (
                      <button
                        type="button"
                        onClick={() => {
                          const centered = computeCenteredSheetMargins(
                            customDraft.paperType === 'carta' ? 'carta' : 'a4',
                            customDraft.labelWidthMm,
                            customDraft.labelHeightMm,
                            customDraft.cols,
                            customDraft.rows,
                            customDraft.colGapMm,
                            customDraft.rowGapMm
                          );
                          handleUpdateCustomDraft(centered);
                        }}
                        className="text-[10px] font-bold uppercase text-sky-800 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/50 px-2 py-0.5 rounded border border-sky-400 dark:border-sky-700 cursor-pointer"
                        title="Centralizar automaticamente as etiquetas na folha"
                      >
                        🎯 Centralizar na Folha
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCustomPanelOpen(false)}
                      className="text-[10px] font-bold uppercase text-slate-600 hover:text-black dark:text-stone-400 dark:hover:text-white px-2 py-0.5 rounded border border-slate-300 dark:border-stone-700 cursor-pointer"
                    >
                      Ocultar Painel
                    </button>
                  </div>
                </div>

                {/* Linha 1: Nome, Tipo de Papel, Largura, Altura */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Nome do Modelo
                    </label>
                    <input
                      type="text"
                      value={customDraft.name}
                      onChange={(e) => handleUpdateCustomDraft({ name: e.target.value })}
                      placeholder="Ex: Etiqueta Caixa Grande 80x40"
                      className="w-full h-7.5 px-2 text-xs font-semibold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Tipo de Papel
                    </label>
                    <select
                      value={customDraft.paperType}
                      onChange={(e) => {
                        const nextPaper = e.target.value as CustomPaperType;
                        if (nextPaper === 'termica') {
                          handleUpdateCustomDraft({
                            paperType: nextPaper,
                            rows: 1,
                            marginTopMm: 0,
                            marginLeftMm: 0,
                            rowGapMm: 3.0,
                            colGapMm: customDraft.cols > 1 ? 3.0 : 0,
                          });
                        } else {
                          const centered = computeCenteredSheetMargins(
                            nextPaper,
                            customDraft.labelWidthMm,
                            customDraft.labelHeightMm,
                            customDraft.cols,
                            customDraft.rows,
                            customDraft.colGapMm,
                            0
                          );
                          handleUpdateCustomDraft({
                            paperType: nextPaper,
                            rowGapMm: 0,
                            ...centered,
                          });
                        }
                      }}
                      className="w-full h-7.5 px-2 text-xs font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer"
                    >
                      <option value="a4">Folha A4 (210×297mm)</option>
                      <option value="carta">Folha Carta (215,9×279,4mm)</option>
                      <option value="termica">Rolo Térmico</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Largura (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="10"
                      max="215"
                      value={customDraft.labelWidthMm}
                      onChange={(e) => handleUpdateCustomDraft({ labelWidthMm: parseFloat(e.target.value) || 10 })}
                      className="w-full h-7.5 px-2 text-xs font-mono font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Altura (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="8"
                      max="297"
                      value={customDraft.labelHeightMm}
                      onChange={(e) => handleUpdateCustomDraft({ labelHeightMm: parseFloat(e.target.value) || 8 })}
                      className="w-full h-7.5 px-2 text-xs font-mono font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>

                {/* Linha 2: Colunas, Linhas, Margens e Espaçamentos */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Colunas / Linha
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={customDraft.cols}
                      onChange={(e) => handleUpdateCustomDraft({ cols: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full h-7.5 px-2 text-xs font-mono font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Linhas / Folha
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={customDraft.rows}
                      onChange={(e) => handleUpdateCustomDraft({ rows: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full h-7.5 px-2 text-xs font-mono font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Margem Sup. (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={customDraft.marginTopMm}
                      onChange={(e) => handleUpdateCustomDraft({ marginTopMm: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full h-7.5 px-2 text-xs font-mono font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Margem Esq. (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={customDraft.marginLeftMm}
                      onChange={(e) => handleUpdateCustomDraft({ marginLeftMm: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full h-7.5 px-2 text-xs font-mono font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Esp. Horiz. (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      value={customDraft.colGapMm}
                      onChange={(e) => handleUpdateCustomDraft({ colGapMm: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full h-7.5 px-2 text-xs font-mono font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                      Esp. Vert. (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      value={customDraft.rowGapMm}
                      onChange={(e) => handleUpdateCustomDraft({ rowGapMm: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full h-7.5 px-2 text-xs font-mono font-bold rounded border border-slate-400 dark:border-stone-600 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>

                {/* Rodapé do Painel: Lista rápida de modelos salvos + Botão Salvar Modelo na Lista */}
                <div className="pt-1.5 border-t border-slate-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                    {customPresets.length > 0 ? (
                      <>
                        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-stone-400">
                          ⭐ Salvos:
                        </span>
                        {customPresets.map((saved) => (
                          <div
                            key={saved.id}
                            className={`inline-flex items-center rounded border text-[10px] font-bold overflow-hidden ${
                              labelSize === saved.id
                                ? 'border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200'
                                : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setLabelSize(saved.id);
                                setCustomDraft(extractDraftFromPreset(saved));
                              }}
                              className="px-2 py-0.5 hover:bg-sky-100 dark:hover:bg-sky-900/50 cursor-pointer truncate max-w-[180px]"
                              title={`Aplicar ${saved.name}`}
                            >
                              {saved.name.replace(/\s*\([^)]*mm\s*•[^)]*\)\s*$/, '')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomPreset(saved.id)}
                              className="px-1.5 py-0.5 border-l border-slate-300 dark:border-stone-700 text-red-600 hover:bg-red-100 dark:hover:bg-red-950/50 cursor-pointer"
                              title="Excluir modelo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-500 dark:text-stone-400">
                        Ajuste os milímetros acima: o preview abaixo e a impressão atualizam na hora.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {customSavedFeedback && (
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        ✓ {customSavedFeedback}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveCustomPreset}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 border border-black rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>💾 Salvar Modelo na Lista</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Regra de Quantidade Padrão (Radio Buttons) */}
            <div className="pt-2 border-t border-slate-200 dark:border-stone-700/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider flex items-center space-x-1.5">
                  <Copy className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>REGRA DE QUANTIDADE PADRÃO</span>
                </label>
                <span className="text-[11px] font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                  TOTAL GERADO: {totalLabelsCount} ETIQUETAS
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  onClick={() => handleSelectQuantityRule('single')}
                  className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                    quantityRule === 'single'
                      ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-500 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500/50 font-bold'
                      : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:border-sky-400 font-semibold'
                  }`}
                >
                  <input
                    type="radio"
                    name="labelQuantityRule"
                    value="single"
                    checked={quantityRule === 'single'}
                    onChange={() => handleSelectQuantityRule('single')}
                    className="w-3.5 h-3.5 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="leading-tight text-[11px] font-bold uppercase">Uma etiqueta por produto</div>
                    <div className="text-[10px] font-normal text-slate-500 dark:text-stone-400 mt-0.5">
                      Define 1 etiqueta para cada item ({itemsToPrint.length} {itemsToPrint.length === 1 ? 'etiqueta' : 'etiquetas'})
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => handleSelectQuantityRule('invoice')}
                  className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                    quantityRule === 'invoice'
                      ? 'bg-sky-50/90 dark:bg-sky-950/50 border-sky-500 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500/50 font-bold'
                      : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 hover:border-sky-400 font-semibold'
                  }`}
                >
                  <input
                    type="radio"
                    name="labelQuantityRule"
                    value="invoice"
                    checked={quantityRule === 'invoice'}
                    onChange={() => handleSelectQuantityRule('invoice')}
                    className="w-3.5 h-3.5 text-sky-600 border-slate-300 focus:ring-sky-500 cursor-pointer shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="leading-tight text-[11px] font-bold uppercase">Quantidade da Nota Fiscal (Lote)</div>
                    <div className="text-[10px] font-normal text-slate-500 dark:text-stone-400 mt-0.5">
                      Quantidade exata lançada no lote ({totalInvoiceUnitsCount} {totalInvoiceUnitsCount === 1 ? 'unidade' : 'unidades'})
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Configurações Avançadas e Reaproveitamento para Folhas Adesivas (A4 e Carta) */}
            {isSheetPreset && (
              <div className="pt-2 border-t border-slate-200 dark:border-stone-700/60 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div className="sm:col-span-7">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold text-slate-800 dark:text-stone-200 uppercase">
                    <span className="flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Reaproveitamento de Folhas ({currentPreset.category === 'carta' ? 'Carta' : 'A4'})</span>
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-sky-700 dark:text-sky-400 lowercase">
                      margem sup {currentPreset.marginTopMm}mm • esq {currentPreset.marginLeftMm}mm • gap {currentPreset.colGapMm}×{currentPreset.rowGapMm}mm
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-stone-400 mt-0.5">
                    Escolha a posição inicial na folha para reaproveitar folhas adesivas parcialmente usadas sem perder papel.
                  </p>
                </div>

                <div className="sm:col-span-5 flex items-center justify-end space-x-2">
                  <label htmlFor="input-start-position-sheet" className="text-[11px] font-bold text-slate-700 dark:text-stone-300 whitespace-nowrap uppercase">
                    Iniciar na posição da folha (1 a {totalSlotsPerSheet}):
                  </label>
                  <div className="flex items-center space-x-1">
                    <input
                      id="input-start-position-sheet"
                      type="number"
                      min={1}
                      max={totalSlotsPerSheet}
                      value={startPosition}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setStartPosition(Math.max(1, Math.min(val, totalSlotsPerSheet)));
                        }
                      }}
                      className="w-16 h-7 text-center font-mono font-extrabold text-xs rounded-lg border border-amber-400 dark:border-amber-600 bg-amber-50/60 dark:bg-amber-950/40 text-slate-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    {startPosition > 1 && (
                      <button
                        type="button"
                        onClick={() => setStartPosition(1)}
                        className="p-1 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950 transition cursor-pointer text-[10px] font-bold uppercase"
                        title="Resetar para a 1ª posição"
                      >
                        Resetar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Alternância de Abas de Pré-visualização se for folha A4/Carta */}
            <div className="pt-2 border-t border-slate-200 dark:border-stone-700/60 flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewTab('label')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition flex items-center space-x-1 cursor-pointer ${
                    previewTab === 'label'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-slate-200/70 dark:bg-stone-800 text-slate-700 dark:text-stone-300 hover:bg-slate-300'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Modelo da Etiqueta</span>
                </button>
                {isSheetPreset && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab('sheet')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition flex items-center space-x-1 cursor-pointer ${
                      previewTab === 'sheet'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-slate-200/70 dark:bg-stone-800 text-slate-700 dark:text-stone-300 hover:bg-slate-300'
                    }`}
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>Grade Folha {currentPreset.category === 'carta' ? 'Carta' : 'A4'} ({currentPreset.columns}x{currentPreset.rows})</span>
                  </button>
                )}
              </div>

              {/* Checkboxes de Elementos Visíveis */}
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400">
                <label className="inline-flex items-center space-x-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showBarcode}
                    onChange={(e) => setShowBarcode(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Código de Barras</span>
                </label>
                <label className="inline-flex items-center space-x-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAddress}
                    onChange={(e) => setShowAddress(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Endereço</span>
                </label>
                <label className="inline-flex items-center space-x-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInternalCode}
                    onChange={(e) => setShowInternalCode(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Código</span>
                </label>
                <label className="inline-flex items-center space-x-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Preço</span>
                </label>
              </div>
            </div>

          </div>

          {/* Seção de Visualização: Modelo Individual/Lote ou Folha A4/Carta Completa */}
          {previewTab === 'label' || !isSheetPreset ? (
            <div className="p-3 bg-[#e0e6f1] dark:bg-stone-800/60 rounded-xl border border-black dark:border-stone-700 shadow-2xs flex flex-col items-center justify-between min-h-[340px] h-[56vh] max-h-[60vh] overflow-hidden">
              <div className="w-full flex items-center justify-between px-1 mb-2 text-xs font-bold text-slate-700 dark:text-stone-300 shrink-0">
                <span className="uppercase text-[10px] sm:text-[11px] font-black text-slate-600 dark:text-stone-400">Total de etiquetas geradas: {flatLabelsList.length}</span>
                <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400">
                  {itemsToPrint.length} produto(s) na lista
                </span>
              </div>

              {flatLabelsList.length === 1 && previewProduct ? (
                <div className="flex-1 w-full flex items-center justify-center overflow-y-auto scrollbar-none p-2 min-h-0">
                  {renderLiveLabelCard(previewProduct)}
                </div>
              ) : (
                <div className="w-full flex-1 overflow-y-auto scrollbar-none p-1 min-h-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full p-1 place-items-center">
                    {flatLabelsList.map((item, idx) =>
                      renderLiveLabelCard(item, `Etiqueta ${idx + 1} de ${flatLabelsList.length}`, `${item.id}_${idx}`)
                    )}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-slate-500 dark:text-stone-400 mt-2 font-mono shrink-0">
                Dimensões reais de corte: {currentPreset.labelWidthMm}mm × {currentPreset.labelHeightMm}mm • Página {currentPreset.pageWidthMm}×{currentPreset.pageHeightMm}mm
              </div>
            </div>
          ) : (
            /* Visualização Interativa da Grade (A4 / Carta) com clique na posição inicial */
            <div className="p-3 bg-[#e0e6f1] dark:bg-stone-800/60 rounded-xl border border-black dark:border-stone-700 shadow-2xs flex flex-col items-center min-h-[340px] h-[56vh] max-h-[60vh] overflow-hidden">
              <div className="w-full max-w-xl flex items-center justify-between text-xs mb-2 shrink-0">
                <span className="font-bold text-slate-700 dark:text-stone-300 flex items-center space-x-1.5 uppercase text-[10px] sm:text-[11px]">
                  <LayoutGrid className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Clique em qualquer posição para começar a impressão</span>
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-stone-400">
                  Folha {currentPreset.category === 'carta' ? 'Carta' : 'A4'}: {currentPreset.columns} colunas × {currentPreset.rows} linhas ({totalSlotsPerSheet} un)
                </span>
              </div>

              {/* Simulação da Folha em Escala */}
              <div 
                className="w-full max-w-xl flex-1 bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-xl p-3 shadow-md overflow-y-auto scrollbar-none min-h-0"
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
              <span className="text-[10px] sm:text-[11px] font-black uppercase text-slate-600 dark:text-stone-400 tracking-wider">
                QUANTIDADE DE CÓPIAS POR PRODUTO
              </span>
              <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                TOTAL: {totalLabelsCount} ETIQUETAS • {isSheetPreset ? `${Math.ceil((startPosition - 1 + totalLabelsCount) / totalSlotsPerSheet)} FOLHA(S) ${currentPreset.category === 'carta' ? 'CARTA' : 'A4'}` : 'ROLO CONTÍNUO'}
              </span>
            </div>

            <div className="border border-slate-300 dark:border-stone-700 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-stone-800 max-h-40 overflow-y-auto scrollbar-none bg-white dark:bg-stone-900 shadow-2xs">
              {itemsToPrint.map(({ product: item, quantity = 1, invoiceQuantity }) => {
                const notaQty = Math.max(1, Math.round(Number(invoiceQuantity ?? quantity) || 1));
                const copies = getItemCopies(item.id, notaQty);
                const address = resolveAddress(item);

                return (
                  <div key={item.id} className="p-2 sm:p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-stone-800/40 transition">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-stone-100 uppercase truncate">
                        {item.nome_comercial || item.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-stone-400 mt-0.5">
                        <span className="font-mono font-bold bg-slate-100 dark:bg-stone-800 px-1 rounded border border-slate-200 dark:border-stone-700">
                          CÓD: {item.code || `PRD-${item.id.slice(-6)}`}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">
                          GÔNDOLA: {address}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-slate-600 dark:text-stone-300 font-semibold">
                          QTD NOTA: {notaQty} {(item.unidade_medida || item.unit || 'UN').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setItemCopies(item.id, Math.max(1, copies - 1))}
                        className="w-6 h-6 rounded-md border border-slate-300 dark:border-stone-700 bg-gradient-to-b from-white to-slate-100 dark:from-stone-800 dark:to-stone-900 text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700 shadow-2xs transition flex items-center justify-center font-bold cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={customCopiesInputs[item.id] ?? String(copies)}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw.trim() === '') {
                            setCustomCopiesInputs(prev => ({ ...prev, [item.id]: '' }));
                            return;
                          }
                          const parsed = parseInt(raw, 10);
                          if (!Number.isNaN(parsed)) {
                            const clamped = Math.min(999, Math.max(1, parsed));
                            setItemCopies(item.id, clamped, parsed > 999 ? '999' : raw);
                          }
                        }}
                        onBlur={() => {
                          const raw = customCopiesInputs[item.id];
                          if (!raw || !raw.trim() || Number(raw) < 1) {
                            setCustomCopiesInputs(prev => ({ ...prev, [item.id]: String(copies) }));
                          } else {
                            const clamped = Math.min(999, Math.max(1, parseInt(raw, 10) || copies));
                            setCustomCopiesInputs(prev => ({ ...prev, [item.id]: String(clamped) }));
                          }
                        }}
                        aria-label={`Quantidade de etiquetas para ${item.nome_comercial || item.name}`}
                        className="w-12 h-6 text-center font-mono font-bold text-xs rounded-md border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 focus:ring-1 focus:ring-sky-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setItemCopies(item.id, Math.min(999, copies + 1))}
                        className="w-6 h-6 rounded-md border border-slate-300 dark:border-stone-700 bg-gradient-to-b from-white to-slate-100 dark:from-stone-800 dark:to-stone-900 text-slate-700 dark:text-stone-200 hover:bg-slate-100 dark:hover:bg-stone-700 shadow-2xs transition flex items-center justify-center font-bold cursor-pointer active:scale-95"
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

        {/* ============================================================== */}
        {/* RODAPÉ OFICIAL ALTO CONTRASTE COM GATILHO DE IMPRESSÃO */}
        {/* ============================================================== */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2">
            {onBackToQueue && (
              <button
                type="button"
                onClick={onBackToQueue}
                className="px-3.5 py-1.5 text-xs font-bold text-black dark:text-stone-300 border border-black dark:border-stone-700 bg-white hover:bg-gray-100 rounded-lg transition flex items-center space-x-1.5 cursor-pointer active:scale-95 uppercase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar à Fila</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-black dark:text-stone-300 border border-black dark:border-stone-700 bg-white hover:bg-gray-100 rounded-lg transition cursor-pointer active:scale-95 uppercase"
            >
              Fechar
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-800 rounded-lg transition flex items-center space-x-1.5 cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none uppercase"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isPrinting ? 'Preparando Impressão...' : `Imprimir ${totalLabelsCount} Etiqueta(s)`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
