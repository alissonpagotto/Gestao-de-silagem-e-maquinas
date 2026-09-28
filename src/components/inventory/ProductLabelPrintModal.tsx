import React, { useState, useMemo } from 'react';
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
  Copy
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
}

interface ProductLabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: InventoryItem | null;
  batchProducts?: LabelProductItem[] | null;
  entryTitle?: string;
  zIndexClass?: string;
}

export type { LabelSizePreset };

export const ProductLabelPrintModal: React.FC<ProductLabelPrintModalProps> = ({
  isOpen,
  onClose,
  product,
  batchProducts,
  entryTitle,
  zIndexClass = 'z-50'
}) => {
  // Configurações do Formato de Impressão
  const [labelSize, setLabelSize] = useState<LabelSizePreset>('termica_gondola_60x30');
  const [startPosition, setStartPosition] = useState<number>(1);
  const [showPrice, setShowPrice] = useState(true);
  const [showInternalCode, setShowInternalCode] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
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

  // Lista normalizada de produtos para impressão
  const itemsToPrint = useMemo<LabelProductItem[]>(() => {
    if (batchProducts && batchProducts.length > 0) {
      return batchProducts;
    }
    if (product) {
      return [{ product, quantity: 1 }];
    }
    return [];
  }, [product, batchProducts]);

  // Primeiro produto para pré-visualização ao vivo
  const previewProduct = itemsToPrint[0]?.product;

  // Obter quantidade de cópias de um item
  const getItemCopies = (prodId: string, fallbackQty: number = 1): number => {
    if (customCopies[prodId] !== undefined) return customCopies[prodId];
    return fallbackQty > 0 ? fallbackQty : defaultCopies;
  };

  const setItemCopies = (prodId: string, copies: number) => {
    setCustomCopies(prev => ({
      ...prev,
      [prodId]: Math.max(1, copies)
    }));
  };

  // Aplica quantidade padrão para todos os itens da lista
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
    if (item.barcode && item.barcode !== 'SEM GTIN' && item.barcode.trim()) {
      return item.barcode.trim();
    }
    if (item.code && item.code.trim()) {
      return item.code.trim();
    }
    return `PRD-${item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
  };

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

  // Renderiza o HTML individual de uma etiqueta compatível com CSS print
  const renderSingleLabelHtml = (
    item: InventoryItem, 
    preset: LabelPresetConfig, 
    metrics: ReturnType<typeof getLabelDesignMetrics>
  ): string => {
    const barcodeValue = resolveBarcodeCode(item);
    const addressValue = resolveAddress(item);
    const internalCode = item.code || `ID:${item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
    const prodName = item.nome_comercial || item.name || 'Produto sem descrição';
    const prodBrand = item.brand || item.marca ? ` • ${item.brand || item.marca}` : '';
    const unit = item.unidade_medida || item.unit || 'UN';
    const salePrice = item.salePrice ?? item.preco_venda_varejo ?? item.preco_venda;

    const isA4 = preset.category === 'a4';
    const isA4FourCols = isA4 && preset.columns >= 4;
    const isCompact = preset.heightMm <= 22;
    const isSmallPad = preset.heightMm <= 25 || preset.widthMm <= 40;

    const barcodeNarrowWidth = isA4FourCols ? 1.0 : metrics.narrowWidth;
    const barcodeHeight = isA4FourCols ? Math.min(metrics.barcodeHeight, 18) : metrics.barcodeHeight;

    const barcodeSvg = generateBarcodeSvgString(barcodeValue, {
      height: barcodeHeight,
      narrowWidth: barcodeNarrowWidth,
      wideWidth: barcodeNarrowWidth * 2.2,
      showText: true,
      fontSize: Math.max(6, Math.round(metrics.codeFontSizePt * 1.1)),
      textColor: '#000000',
      barColor: '#000000'
    });

    return `
      <div class="gondola-label" style="
        width: ${isA4 ? '100%' : `${preset.widthMm}mm`};
        max-width: 100%;
        min-width: 0;
        height: ${preset.heightMm}mm;
        max-height: ${preset.heightMm}mm;
        box-sizing: border-box;
        border: 0.4px dashed #999999;
        background: #ffffff;
        padding: ${isSmallPad ? '1mm 1.5mm' : '1.5mm 2mm'};
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
      ">
        <!-- Topo: Código Interno no topo esquerdo e Descrição no topo direito -->
        <div class="label-header" style="
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 2px;
          line-height: 1.05;
          border-bottom: 0.5px solid #000000;
          padding-bottom: 1px;
          margin-bottom: 1px;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
          box-sizing: border-box;
        ">
          ${showInternalCode ? `
            <div class="label-internal-code" style="
              font-size: ${isA4FourCols ? Math.min(metrics.codeFontSizePt, 6.5) : metrics.codeFontSizePt}pt;
              font-family: 'Courier New', Courier, monospace;
              font-weight: 800;
              white-space: nowrap;
              background: #f1f5f9;
              padding: 0.5px 2px;
              border-radius: 2px;
              border: 0.4px solid #000000;
              line-height: 1;
              flex-shrink: 0;
            ">
              CÓD: <strong>${internalCode}</strong>
            </div>
          ` : '<div></div>'}
          <div class="label-product-name" style="
            font-size: ${isA4FourCols ? Math.min(metrics.nameFontSizePt, 7.0) : metrics.nameFontSizePt}pt;
            font-weight: 800;
            text-transform: uppercase;
            text-align: right;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
            line-height: 1.1;
          " title="${prodName}">
            ${prodName}${prodBrand}
          </div>
        </div>

        <!-- Centro: Código de Barras centralizado -->
        <div class="label-barcode-container" style="
          display: flex;
          justify-content: center;
          align-items: center;
          flex: 1;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
          margin: 0.5px 0;
          box-sizing: border-box;
        ">
          ${barcodeSvg}
        </div>

        <!-- Rodapé: Endereço Formatado em Destaque logo abaixo do código de barras -->
        ${showAddress ? `
          <div class="label-address-box" style="
            border: 1px solid #000000;
            background: #000000;
            color: #ffffff;
            border-radius: 2px;
            padding: 1px 2px;
            text-align: center;
            margin-top: 0.5px;
            width: 100%;
            max-width: 100%;
            overflow: hidden;
            box-sizing: border-box;
          ">
            ${!isCompact ? `
              <div class="address-title" style="
                font-size: ${isA4FourCols ? 3.5 : metrics.addressLegendFontSizePt}pt;
                font-weight: 700;
                letter-spacing: 0.2px;
                text-transform: uppercase;
                line-height: 1;
                color: #d1d5db;
                white-space: nowrap;
                overflow: hidden;
              ">
                ENDEREÇO NA GÔNDOLA
              </div>
            ` : ''}
            <div class="address-code" style="
              font-size: ${isA4FourCols ? Math.min(metrics.addressCodeFontSizePt, 8.5) : metrics.addressCodeFontSizePt}pt;
              font-weight: 900;
              font-family: 'Courier New', Courier, monospace;
              letter-spacing: ${isA4FourCols ? '0.3px' : '0.8px'};
              line-height: 1.05;
              color: #ffffff;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            ">
              ${addressValue}
            </div>
            ${!isCompact ? `
              <div class="address-legend" style="
                font-size: ${isA4FourCols ? 3.2 : metrics.addressLegendFontSizePt}pt;
                font-weight: 600;
                letter-spacing: 0.1px;
                color: #9ca3af;
                line-height: 1;
                white-space: nowrap;
                overflow: hidden;
              ">
                SETOR . RUA . ESTANTE . NÍVEL . BOX
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Preço Opcional -->
        ${showPrice && salePrice && salePrice > 0 && preset.heightMm >= 28 ? `
          <div class="label-price-tag" style="
            position: absolute;
            bottom: 1.5px;
            right: 2px;
            font-size: ${metrics.priceFontSizePt}pt;
            font-weight: 900;
            color: #000000;
            background: #ffffff;
            padding: 0 2px;
            border: 0.5px solid #000000;
            border-radius: 2px;
            line-height: 1.1;
          ">
            ${formatCurrencyBRL(salePrice)} <span style="font-size: ${metrics.priceFontSizePt * 0.75}pt; font-weight: normal;">/${unit}</span>
          </div>
        ` : ''}
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

      pageCss = `
        @page { 
          size: A4; 
          margin: 10mm 5mm 10mm 5mm; 
        }
        *, *::before, *::after {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          background: #ffffff;
          box-sizing: border-box;
        }
        .a4-sheet {
          width: 210mm;
          max-width: 100%;
          box-sizing: border-box;
          margin: 0 auto;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(${cols}, 1fr);
          gap: 3mm; /* Adiciona o espaçamento essencial entre as etiquetas para não colarem uma na outra */
          width: 100%;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
        }
        .a4-sheet:last-child {
          page-break-after: avoid;
          break-after: avoid;
        }
        .gondola-label,
        .a4-slot {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: ${currentPreset.heightMm}mm !important;
          max-height: ${currentPreset.heightMm}mm !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
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
          @page { 
            size: A4; 
            margin: 10mm 5mm 10mm 5mm; 
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
          }
          .a4-sheet {
            width: 210mm !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            padding: 0 !important;
            display: grid !important;
            grid-template-columns: repeat(${cols}, 1fr) !important;
            gap: 3mm !important; /* Adiciona o espaçamento essencial entre as etiquetas para não colarem uma na outra */
            width: 100% !important;
            page-break-after: always !important;
            break-after: page !important;
            overflow: hidden !important;
          }
          .a4-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .gondola-label,
          .a4-slot {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            height: ${currentPreset.heightMm}mm !important;
            max-height: ${currentPreset.heightMm}mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            border: none !important;
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

        // Adiciona slots em branco para posições puladas (reaproveitamento da folha A4)
        for (let s = 0; s < initialOffset; s++) {
          slotsHtml.push(`
            <div class="a4-slot empty-slot" style="width:100%;max-width:100%;min-width:0;height:${currentPreset.heightMm}mm;box-sizing:border-box;visibility:hidden;"></div>
          `);
        }

        // Preenche com as etiquetas reais
        const slotsAvailable = slotsPerSheet - initialOffset;
        for (let s = 0; s < slotsAvailable && currentFlatIdx < flatLabelsList.length; s++) {
          const item = flatLabelsList[currentFlatIdx++];
          slotsHtml.push(renderSingleLabelHtml(item, currentPreset, metrics));
        }

        // Preenche o restante da folha com slots invisíveis para travar a geometria da grade CSS
        while (slotsHtml.length < slotsPerSheet) {
          slotsHtml.push(`
            <div class="a4-slot empty-slot" style="width:100%;max-width:100%;min-width:0;height:${currentPreset.heightMm}mm;box-sizing:border-box;visibility:hidden;"></div>
          `);
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
          }
          .thermal-page {
            width: ${currentPreset.widthMm}mm;
            height: ${currentPreset.heightMm}mm;
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
          }
          .thermal-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
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
          .thermal-row-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
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
  <title>Impressão de Etiquetas - ${currentPreset.name}</title>
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
    }
  </style>
</head>
<body>
  ${bodyContent}
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

  // Render do preview ao vivo do código de barras
  const livePreviewBars = useMemo(() => {
    if (!previewProduct) return null;
    const barcodeCode = resolveBarcodeCode(previewProduct);
    const metrics = getLabelDesignMetrics(currentPreset);
    return generateBarcodeBars(barcodeCode, {
      height: metrics.barcodeHeight * 1.1,
      narrowWidth: metrics.narrowWidth,
      wideWidth: metrics.narrowWidth * 2.3
    });
  }, [previewProduct, currentPreset]);

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
                {entryTitle || `${itemsToPrint.length} produto(s) • Total de ${totalLabelsCount} etiqueta(s)`} • Formato: {currentPreset.badge}
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
              <div className="flex items-center space-x-3 text-xs font-semibold">
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

          {/* Seção de Visualização: Modelo Individual ou Folha A4 Completa */}
          {previewTab === 'label' || !isA4 ? (
            <div className="p-3 bg-stone-100 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800 flex flex-col items-center justify-center">
              
              {/* Card Físico da Etiqueta em Preview Proporcional */}
              {previewProduct && (
                <div 
                  className="w-full bg-white text-black border-2 border-dashed border-stone-400 rounded-lg p-3 shadow-md space-y-2 font-sans select-none"
                  style={{
                    maxWidth: currentPreset.widthMm >= 80 ? '480px' : '380px'
                  }}
                >
                  
                  {/* Topo da Etiqueta: Código no topo esquerdo e Descrição no topo direito */}
                  <div className="flex items-start justify-between border-b border-black pb-1 gap-2 leading-tight">
                    {showInternalCode && (
                      <div className="bg-stone-100 border border-black rounded px-1.5 py-0.5 font-mono font-black text-[11px] shrink-0">
                        CÓD: {previewProduct.code || `PRD-${previewProduct.id.slice(-6).toUpperCase()}`}
                      </div>
                    )}
                    <div className="text-right flex-1 min-w-0">
                      <div className="font-black text-xs uppercase truncate" title={previewProduct.nome_comercial || previewProduct.name}>
                        {previewProduct.nome_comercial || previewProduct.name}
                      </div>
                      {(previewProduct.brand || previewProduct.marca) && (
                        <div className="text-[10px] font-bold text-stone-600 truncate">
                          {previewProduct.brand || previewProduct.marca}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Centro da Etiqueta: Código de Barras centralizado com numeração */}
                  <div className="py-1 flex flex-col items-center justify-center">
                    {livePreviewBars && (
                      <svg 
                        viewBox={`0 0 ${livePreviewBars.totalWidth} 44`} 
                        className="w-full max-h-[36px] block"
                      >
                        {livePreviewBars.bars.map((b, idx) => (
                          <rect key={idx} x={b.x} y="0" width={b.width} height={30} fill="#000000" />
                        ))}
                        <text 
                          x={livePreviewBars.totalWidth / 2} 
                          y={42} 
                          textAnchor="middle" 
                          fontFamily="Courier New, monospace" 
                          fontSize="10px" 
                          fontWeight="bold" 
                          fill="#000000"
                        >
                          {livePreviewBars.displayCode}
                        </text>
                      </svg>
                    )}
                  </div>

                  {/* Abaixo do Código de Barras: Endereço Formatado em Destaque */}
                  {showAddress && (
                    <div className="bg-black text-white rounded p-1.5 text-center shadow-xs">
                      <div className="text-[8px] font-bold uppercase tracking-wider text-stone-300 leading-none">
                        ENDEREÇO NA GÔNDOLA
                      </div>
                      <div className="text-sm sm:text-base font-black font-mono tracking-widest leading-tight text-white my-0.5">
                        {resolveAddress(previewProduct)}
                      </div>
                      <div className="text-[7.5px] font-semibold text-stone-300 leading-none">
                        SETOR • RUA • ESTANTE • NÍVEL • BOX
                      </div>
                    </div>
                  )}

                  {/* Preço de Venda Varejo (opcional no rodapé) */}
                  {showPrice && (previewProduct.salePrice ?? previewProduct.preco_venda_varejo) ? (
                    <div className="flex items-center justify-end pt-0.5 border-t border-stone-200">
                      <span className="text-[11px] font-black text-black">
                        {formatCurrencyBRL(previewProduct.salePrice ?? previewProduct.preco_venda_varejo ?? 0)}
                        <span className="text-[9px] font-normal text-stone-600"> / {previewProduct.unidade_medida || previewProduct.unit || 'UN'}</span>
                      </span>
                    </div>
                  ) : null}

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
                {totalLabelsCount} etiqueta(s) no total • {isA4 ? `${Math.ceil((startPosition - 1 + totalLabelsCount) / totalSlotsPerSheet)} folha(s) A4` : 'Rolo Contínuo'}
              </span>
            </div>

            <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800/80 max-h-44 overflow-y-auto bg-white dark:bg-stone-900">
              {itemsToPrint.map(({ product: item, quantity = 1 }) => {
                const copies = getItemCopies(item.id, quantity);
                const address = resolveAddress(item);

                return (
                  <div key={item.id} className="p-2.5 flex items-center justify-between gap-3 text-xs hover:bg-stone-50 dark:hover:bg-stone-800/40 transition">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-stone-900 dark:text-stone-100 truncate">
                        {item.nome_comercial || item.name}
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">
                        <span className="font-mono font-bold bg-stone-100 dark:bg-stone-800 px-1 rounded">
                          Cód: {item.code || `PRD-${item.id.slice(-6)}`}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">
                          Gôndola: {address}
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
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>

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
