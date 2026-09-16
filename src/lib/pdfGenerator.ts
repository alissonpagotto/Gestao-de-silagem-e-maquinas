import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface GeneratePdfOptions {
  filename?: string;
  title?: string;
}

/**
 * Generates a clean, crisp PDF from an HTML Element using html2canvas & jsPDF.
 * Returns a Blob, File object, and Data URL.
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  options?: GeneratePdfOptions
): Promise<{ blob: Blob; file: File; dataUrl: string; filename: string }> {
  const filename = (options?.filename || options?.title || 'documento_silagem_facil')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_') + '.pdf';

  // Clone element or adjust styling for high-res print rendering
  const canvas = await html2canvas(element, {
    scale: 2, // High resolution (Retina quality)
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 1024,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  
  // Calculate A4 dimensions (in mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pdfWidth - 20; // 10mm margins on each side
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  let heightLeft = imgHeight;
  let position = 10; // Top margin

  // First page
  pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
  heightLeft -= (pdfHeight - 20);

  // If multi-page
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 20);
  }

  const blob = pdf.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });
  const dataUrl = pdf.output('datauristring');

  return { blob, file, dataUrl, filename };
}

/**
 * Downloads a generated PDF file directly to user's device
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Checks if the browser supports sharing files natively via Web Share API
 */
export function canShareFilesNatively(file?: File): boolean {
  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    if (file) {
      return navigator.canShare({ files: [file] });
    }
    return true;
  }
  return false;
}

/**
 * Share PDF file natively (e.g. opens native WhatsApp share sheet on Mobile/macOS/Windows)
 */
export async function sharePdfNatively(
  file: File,
  title: string,
  text?: string
): Promise<boolean> {
  if (canShareFilesNatively(file)) {
    try {
      await navigator.share({
        files: [file],
        title: title,
        text: text || `Segue o documento oficial: ${title}`,
      });
      return true;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Native share failed:', err);
      }
      return false;
    }
  }
  return false;
}
