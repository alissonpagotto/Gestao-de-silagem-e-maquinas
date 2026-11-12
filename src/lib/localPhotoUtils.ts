import { Employee } from '../types';

/**
 * Utilitário 100% local para processamento e compressão de fotos no navegador via HTML5 <canvas>.
 * Redimensiona proporcionalmente para no máximo 300x300 px e exporta em JPEG qualidade 0.8 (Base64).
 */
export async function compressImageToLocalBase64(
  source: File | Blob | string,
  maxWidth = 300,
  maxHeight = 300,
  quality = 0.8
): Promise<string> {
  const srcDataUrl =
    typeof source === 'string'
      ? source
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem selecionado.'));
          reader.readAsDataURL(source);
        });

  if (!srcDataUrl) {
    throw new Error('Imagem inválida para processamento.');
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    if (!srcDataUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const origW = img.naturalWidth || img.width || maxWidth;
      const origH = img.naturalHeight || img.height || maxHeight;
      const ratio = Math.min(maxWidth / origW, maxHeight / origH, 1);
      const targetW = Math.max(1, Math.round(origW * ratio));
      const targetH = Math.max(1, Math.round(origH * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível inicializar o canvas para comprimir a imagem.'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Não foi possível decodificar a imagem selecionada.'));
    img.src = srcDataUrl;
  });
}

/**
 * Resolve a foto válida do colaborador considerando todos os aliases locais/legados.
 */
export function resolveEmployeePhoto(employee?: Partial<Employee> | null): string | undefined {
  if (!employee) return undefined;
  const raw =
    employee.avatar_url ||
    employee.foto ||
    employee.foto_url ||
    employee.photoUrl;
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('wix_mp.com') ||
    lower.includes('wix_mp') ||
    lower.includes('static.wixstatic.com')
  ) {
    return undefined;
  }
  return trimmed;
}
