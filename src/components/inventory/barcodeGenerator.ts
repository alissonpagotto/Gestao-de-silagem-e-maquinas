// Utilitário de Geração de Código de Barras Vetorial (SVG)
// Suporta renderização nítida em tela e impressão térmica de alta resolução (300/600 DPI)

// Tabela Code 39: 9 elementos por caractere (5 barras, 4 espaços; 3 largos 'W', 6 estreitos 'N')
const CODE_39_CHARS: Record<string, string> = {
  '0': 'NNNWWNWNN', '1': 'WNNWNNNNW', '2': 'NNWWNNNNW', '3': 'WNWWNNNNN',
  '4': 'NNNWWNNNW', '5': 'WNNWWNNNN', '6': 'NNWWWNNNN', '7': 'NNNWWNNWN',
  '8': 'WNNWWNNWN', '9': 'NNWWWNNWN', 'A': 'WNNNNWNNW', 'B': 'NNWNNWNNW',
  'C': 'WNWNNWNNN', 'D': 'NNNNWWNNW', 'E': 'WNNNWWNNN', 'F': 'NNWNWWNNN',
  'G': 'NNNNNWWNW', 'H': 'WNNNNWWNN', 'I': 'NNWNNWWNN', 'J': 'NNNNWWWNN',
  'K': 'WNNNNNNWW', 'L': 'NNWNNNNWW', 'M': 'WNWNNNNWN', 'N': 'NNNNWNNWW',
  'O': 'WNNNWNNWN', 'P': 'NNWNWNNWN', 'Q': 'NNNNNNWWW', 'R': 'WNNNNNWWN',
  'S': 'NNWNNNWWN', 'T': 'NNNNWNWWN', 'U': 'WWNNNNNNW', 'V': 'NWWNNNNNW',
  'W': 'WWWNNNNNN', 'X': 'NWNNWNNNW', 'Y': 'WWNNWNNNN', 'Z': 'NWWNWNNNN',
  '-': 'NWNNNNWNW', '.': 'WWNNNNWNN', ' ': 'NWWNNNWNN', '$': 'NWNWNWNNN',
  '/': 'NWNWNNNWN', '+': 'NWNNNWNWN', '%': 'NNNWNWNWN', '*': 'NWNNWNWNN'
};

export interface BarcodeRenderOptions {
  height?: number; // Altura das barras (px)
  narrowWidth?: number; // Largura da barra estreita (px)
  wideWidth?: number; // Largura da barra larga (px)
  showText?: boolean; // Exibir texto abaixo
  fontSize?: number;
  textColor?: string;
  barColor?: string;
}

/**
 * Sanitiza o código para compatibilidade com Code 39
 */
export function sanitizeCode39(text: string): string {
  if (!text) return '000000';
  const clean = text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
  return clean || '000000';
}

/**
 * Gera os dados dos retângulos para renderização do código de barras
 */
export function generateBarcodeBars(rawCode: string, options: BarcodeRenderOptions = {}) {
  const code = sanitizeCode39(rawCode);
  const fullCode = `*${code}*`;
  const narrowWidth = options.narrowWidth ?? 2;
  const wideWidth = options.wideWidth ?? 5;
  const height = options.height ?? 50;

  const bars: { x: number; width: number; height: number }[] = [];
  let currentX = 0;

  // Quiet zone inicial
  currentX += narrowWidth * 5;

  for (let i = 0; i < fullCode.length; i++) {
    const char = fullCode[i];
    const pattern = CODE_39_CHARS[char] || CODE_39_CHARS['-'];

    for (let p = 0; p < pattern.length; p++) {
      const isBar = p % 2 === 0;
      const isWide = pattern[p] === 'W';
      const width = isWide ? wideWidth : narrowWidth;

      if (isBar) {
        bars.push({
          x: currentX,
          width,
          height
        });
      }
      currentX += width;
    }

    // Espaçador entre caracteres (inter-character gap)
    currentX += narrowWidth;
  }

  // Quiet zone final
  currentX += narrowWidth * 5;

  return {
    bars,
    totalWidth: currentX,
    height,
    sanitizedCode: code,
    displayCode: rawCode
  };
}

/**
 * Gera SVG string pronto para injeção em HTML de impressão térmica
 */
export function generateBarcodeSvgString(rawCode: string, options: BarcodeRenderOptions = {}): string {
  const { bars, totalWidth, height, displayCode } = generateBarcodeBars(rawCode, options);
  const barColor = options.barColor || '#000000';
  const showText = options.showText !== false;
  const fontSize = options.fontSize || 18;
  const svgHeight = showText ? height + fontSize + 6 : height;

  const rectsSvg = bars
    .map(b => `<rect x="${b.x}" y="0" width="${b.width}" height="${b.height}" fill="${barColor}" />`)
    .join('');

  const textSvg = showText
    ? `<text x="${totalWidth / 2}" y="${height + fontSize}" text-anchor="middle" font-family="'Courier New', Courier, monospace" font-size="${fontSize}px" font-weight="800" fill="${options.textColor || '#000000'}">${displayCode}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${svgHeight}" width="${totalWidth}" height="${svgHeight}" style="display:block;margin:0 auto;max-width:100%;">${rectsSvg}${textSvg}</svg>`;
}
