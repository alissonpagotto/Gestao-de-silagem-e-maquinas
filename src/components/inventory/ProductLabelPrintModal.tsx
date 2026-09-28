import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Copy, 
  Check, 
  Layers, 
  Sliders, 
  MapPin, 
  Barcode, 
  Info,
  Tag,
  Eye
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { generateBarcodeSvgString, generateBarcodeBars } from './barcodeGenerator';
import { executePrint } from '../../lib/printService';
import { formatCurrencyBRL } from '../../lib/storage';

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

export type LabelSizePreset = 'gondola_100x35' | 'gondola_80x30' | 'termica_60x40' | 'a4_grade';

export const ProductLabelPrintModal: React.FC<ProductLabelPrintModalProps> = ({
  isOpen,
  onClose,
  product,
  batchProducts,
  entryTitle,
  zIndexClass = 'z-50'
}) => {
  // Configurações da Etiqueta
  const [labelSize, setLabelSize] = useState<LabelSizePreset>('gondola_100x35');
  const [showPrice, setShowPrice] = useState(true);
  const [showInternalCode, setShowInternalCode] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [defaultCopies, setDefaultCopies] = useState<number>(1);
  const [customCopies, setCustomCopies] = useState<Record<string, number>>({});
  const [isPrinting, setIsPrinting] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Primeiro produto selecionado para o preview ao vivo
  const previewProduct = itemsToPrint[0]?.product;

  if (!isOpen || itemsToPrint.length === 0) return null;

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

  // Cálculo do total de etiquetas a serem geradas
  const totalLabelsCount = itemsToPrint.reduce((acc, curr) => {
    return acc + getItemCopies(curr.product.id, curr.quantity);
  }, 0);

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

  // Gerador do HTML de impressão de todas as etiquetas
  const generateLabelsHtml = (): string => {
    let sizeCss = '';
    let pageCss = '';

    if (labelSize === 'gondola_100x35') {
      pageCss = '@page { size: 100mm 35mm; margin: 0; }';
      sizeCss = 'width: 98mm; height: 33mm; padding: 2mm 3mm;';
    } else if (labelSize === 'gondola_80x30') {
      pageCss = '@page { size: 80mm 30mm; margin: 0; }';
      sizeCss = 'width: 78mm; height: 28mm; padding: 1.5mm 2mm;';
    } else if (labelSize === 'termica_60x40') {
      pageCss = '@page { size: 60mm 40mm; margin: 0; }';
      sizeCss = 'width: 58mm; height: 38mm; padding: 2mm 2mm;';
    } else {
      pageCss = '@page { size: A4 portrait; margin: 8mm 6mm; }';
      sizeCss = 'width: 95mm; height: 33mm; padding: 2mm 3mm; margin: 1.5mm; display: inline-block; vertical-align: top;';
    }

    const labelsHtmlArray: string[] = [];

    itemsToPrint.forEach(({ product: item, quantity = 1 }) => {
      const copies = getItemCopies(item.id, quantity);
      const barcodeValue = resolveBarcodeCode(item);
      const addressValue = resolveAddress(item);
      const internalCode = item.code || `ID:${item.id.slice(-6)}`;
      const prodName = item.nome_comercial || item.name || 'Produto sem descrição';
      const prodBrand = item.brand || item.marca ? ` • ${item.brand || item.marca}` : '';
      const unit = item.unidade_medida || item.unit || 'UN';
      const salePrice = item.salePrice ?? item.preco_venda_varejo ?? item.preco_venda;

      const barcodeSvg = generateBarcodeSvgString(barcodeValue, {
        height: labelSize === 'termica_60x40' ? 32 : 28,
        narrowWidth: 1.8,
        wideWidth: 4.2,
        showText: true,
        fontSize: 10,
        textColor: '#000000',
        barColor: '#000000'
      });

      for (let i = 0; i < copies; i++) {
        labelsHtmlArray.push(`
          <div class="gondola-label" style="${sizeCss}">
            <div class="label-header">
              ${showInternalCode ? `<div class="label-internal-code">CÓD: <strong>${internalCode}</strong></div>` : '<div></div>'}
              <div class="label-product-name" title="${prodName}">${prodName}${prodBrand}</div>
            </div>

            <div class="label-barcode-container">
              ${barcodeSvg}
            </div>

            ${showAddress ? `
              <div class="label-address-box">
                <div class="address-title">ENDEREÇO NA GÔNDOLA</div>
                <div class="address-code">${addressValue}</div>
                <div class="address-legend">SETOR . RUA . ESTANTE . NÍVEL . BOX</div>
              </div>
            ` : ''}

            ${showPrice && salePrice && salePrice > 0 ? `
              <div class="label-price-tag">
                ${formatCurrencyBRL(salePrice)} <span class="unit">/${unit}</span>
              </div>
            ` : ''}
          </div>
        `);
      }
    });

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Impressão de Etiquetas de Gôndola</title>
  <style>
    ${pageCss}
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #000000;
      background: #ffffff;
    }
    .gondola-label {
      box-sizing: border-box;
      border: 1px dashed #000000;
      background: #ffffff;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .label-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 4px;
      line-height: 1.1;
      border-bottom: 1px solid #000000;
      padding-bottom: 2px;
      margin-bottom: 2px;
    }
    .label-internal-code {
      font-size: 8pt;
      font-family: 'Courier New', Courier, monospace;
      font-weight: 800;
      white-space: nowrap;
      background: #f0f0f0;
      padding: 1px 3px;
      border-radius: 2px;
      border: 0.5px solid #000000;
    }
    .label-product-name {
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .label-barcode-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 1px 0;
    }
    .label-barcode-container svg {
      max-width: 95%;
      height: auto;
    }
    .label-address-box {
      border: 1.5px solid #000000;
      background: #000000;
      color: #ffffff;
      border-radius: 3px;
      padding: 1.5px 2px;
      text-align: center;
      margin-top: 1px;
    }
    .address-title {
      font-size: 5.5pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1;
      color: #e0e0e0;
    }
    .address-code {
      font-size: 11pt;
      font-weight: 900;
      font-family: 'Courier New', Courier, monospace;
      letter-spacing: 1.5px;
      line-height: 1.1;
      color: #ffffff;
    }
    .address-legend {
      font-size: 4.8pt;
      font-weight: 600;
      letter-spacing: 0.3px;
      color: #cccccc;
      line-height: 1;
    }
    .label-price-tag {
      position: absolute;
      bottom: 2px;
      right: 3px;
      font-size: 8pt;
      font-weight: 900;
      color: #000000;
      background: #ffffff;
      padding: 0 2px;
      border: 0.5px solid #000000;
      border-radius: 2px;
    }
    .label-price-tag .unit {
      font-size: 6pt;
      font-weight: normal;
    }
    @media print {
      body {
        background: transparent !important;
      }
      .gondola-label {
        border: none !important;
      }
    }
  </style>
</head>
<body>
  ${labelsHtmlArray.join('\n')}
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch(e) {
          console.error(e);
        }
      }, 300);
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
    return generateBarcodeBars(barcodeCode, {
      height: 32,
      narrowWidth: 1.8,
      wideWidth: 4.2
    });
  }, [previewProduct]);

  return (
    <div className={`fixed inset-0 ${zIndexClass} bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150`}>
      <div 
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-sky-700 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
              <Barcode className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight font-['Outfit']">
                Impressão de Etiquetas de Gôndola / Almoxarifado
              </h3>
              <p className="text-[11px] text-sky-100">
                {entryTitle || `${itemsToPrint.length} produto(s) selecionado(s) • Total de ${totalLabelsCount} etiqueta(s)`}
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
          
          {/* Seção 1: Pré-visualização do Modelo de Gôndola */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                Modelo Visual da Etiqueta (Gôndola / Prateleira)
              </span>
              <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded">
                100mm × 35mm
              </span>
            </div>

            {previewProduct && (
              <div className="p-3 bg-stone-100 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800 flex justify-center">
                
                {/* Card Físico da Etiqueta */}
                <div className="w-full max-w-[420px] bg-white text-black border-2 border-dashed border-stone-400 rounded-lg p-3 shadow-md space-y-2 font-sans select-none">
                  
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
                        viewBox={`0 0 ${livePreviewBars.totalWidth} 46`} 
                        className="w-full max-h-[38px] block"
                      >
                        {livePreviewBars.bars.map((b, idx) => (
                          <rect key={idx} x={b.x} y="0" width={b.width} height={32} fill="#000000" />
                        ))}
                        <text 
                          x={livePreviewBars.totalWidth / 2} 
                          y={44} 
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
                      <div className="text-base font-black font-mono tracking-widest leading-tight text-white my-0.5">
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

              </div>
            )}
          </div>

          {/* Seção 2: Controles de Configuração e Tamanho */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700/60">
            
            {/* Formato da Etiqueta */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase mb-1">
                Formato / Tipo de Etiqueta
              </label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="w-full h-9 px-2.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer"
              >
                <option value="gondola_100x35">Gôndola / Prateleira (100mm × 35mm) - Padrão</option>
                <option value="gondola_80x30">Gôndola Estreita (80mm × 30mm)</option>
                <option value="termica_60x40">Térmica Compacta (60mm × 40mm)</option>
                <option value="a4_grade">Folha A4 (Grade de Etiquetas 3 Colunas)</option>
              </select>
            </div>

            {/* Opções de Elementos na Etiqueta */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase mb-1">
                Elementos Visíveis
              </label>
              <div className="flex items-center space-x-3 h-9">
                <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAddress}
                    onChange={(e) => setShowAddress(e.target.checked)}
                    className="rounded border-stone-300 dark:border-stone-600 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Endereço</span>
                </label>
                <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInternalCode}
                    onChange={(e) => setShowInternalCode(e.target.checked)}
                    className="rounded border-stone-300 dark:border-stone-600 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Código</span>
                </label>
                <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded border-stone-300 dark:border-stone-600 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Preço</span>
                </label>
              </div>
            </div>

          </div>

          {/* Seção 3: Lista de Produtos e Cópias */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Quantidade de Cópias por Produto
              </span>
              <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                {totalLabelsCount} etiqueta(s) a imprimir
              </span>
            </div>

            <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-y divide-stone-100 dark:divide-stone-800/80 max-h-48 overflow-y-auto bg-white dark:bg-stone-900">
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
