import { Employee } from '../types';
import { getCachedMediaUrl, resolveMediaUrlAsync } from './imageStorage';

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
 * Redimensiona o logotipo da empresa via <canvas> (máx 400x400 px), preservando transparência em PNG quando aplicável.
 */
export async function compressLogoToLocalDataUrl(
  source: File | Blob | string,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.85
): Promise<string> {
  const isPng =
    (source instanceof File && source.type === 'image/png') ||
    (typeof source === 'string' && source.startsWith('data:image/png'));

  const srcDataUrl =
    typeof source === 'string'
      ? source
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Falha ao ler arquivo do logotipo.'));
          reader.readAsDataURL(source);
        });

  if (!srcDataUrl) {
    throw new Error('Imagem inválida para o logotipo.');
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
        reject(new Error('Não foi possível inicializar o canvas para o logotipo.'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (!isPng) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      resolve(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Não foi possível decodificar a imagem do logotipo.'));
    img.src = srcDataUrl;
  });
}

/**
 * Resolve a referência de foto válida do colaborador (pode retornar `indexeddb://...`, `data:...` ou `https://...`).
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

/**
 * Resolve de forma síncrona a foto já pronta para renderização (`data:image/...` ou URL HTTP) usando o cache em memória.
 */
export function resolveEmployeePhotoDataUrl(employee?: Partial<Employee> | null): string | undefined {
  const ref = resolveEmployeePhoto(employee);
  return getCachedMediaUrl(ref);
}

/**
 * Resolve de forma assíncrona a foto completa (`data:image/...` ou URL HTTP) buscando no IndexedDB se necessário.
 */
export async function resolveEmployeePhotoAsync(employee?: Partial<Employee> | null): Promise<string | undefined> {
  const ref = resolveEmployeePhoto(employee);
  return resolveMediaUrlAsync(ref);
}
