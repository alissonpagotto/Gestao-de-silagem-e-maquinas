import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move, Camera, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isSupabaseConfigured, uploadEmployeePhotoToStorage } from '../../lib/supabaseService';
import { getActiveCompanyId } from '../../lib/storage';

interface EmployeePhotoCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  employeeId?: string;
  companyId?: string;
  employeeName?: string;
  onClose: () => void;
  onConfirm: (result: { file: File; previewUrl: string; publicUrl?: string }) => void | Promise<void>;
}

export const EmployeePhotoCropModal: React.FC<EmployeePhotoCropModalProps> = ({
  isOpen,
  imageSrc,
  employeeId,
  companyId,
  employeeName,
  onClose,
  onConfirm,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const posStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Dimensões do viewport e do círculo de recorte
  const VIEWPORT_SIZE = 300;
  const CROP_DIAMETER = 240;
  const CROP_RADIUS = CROP_DIAMETER / 2;

  // Carrega e pré-valida a imagem ao abrir ou trocar imageSrc
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsProcessing(false);

      // Pré-carrega a imagem na memória para obter as dimensões imediatamente
      const testImg = new Image();
      testImg.crossOrigin = 'anonymous';
      testImg.onload = () => {
        setNaturalSize({
          width: testImg.naturalWidth || 400,
          height: testImg.naturalHeight || 400,
        });
        setImageLoaded(true);
      };
      testImg.onerror = () => {
        // Fallback para permitir o recorte mesmo com erro de cross-origin
        setNaturalSize({ width: 400, height: 400 });
        setImageLoaded(true);
      };
      testImg.src = imageSrc;

      // Se a imagem já estiver em cache pelo navegador
      if (testImg.complete && testImg.naturalWidth > 0) {
        setNaturalSize({
          width: testImg.naturalWidth,
          height: testImg.naturalHeight,
        });
        setImageLoaded(true);
      }
    } else {
      setImageLoaded(false);
      setIsProcessing(false);
    }
  }, [isOpen, imageSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
    setImageLoaded(true);
  };

  // Cálculo da escala base para cobrir o círculo de corte
  const baseScale = React.useMemo(() => {
    const w = naturalSize.width || 400;
    const h = naturalSize.height || 400;
    const scaleX = CROP_DIAMETER / w;
    const scaleY = CROP_DIAMETER / h;
    return Math.max(scaleX, scaleY);
  }, [naturalSize]);

  // Limites de arrasto para não perder a foto do círculo
  const clampPosition = useCallback((x: number, y: number, currentZoom: number) => {
    const w = naturalSize.width || 400;
    const h = naturalSize.height || 400;
    const scaledWidth = w * baseScale * currentZoom;
    const scaledHeight = h * baseScale * currentZoom;

    // Permitir margem elástica
    const maxOffset = CROP_RADIUS + 30;
    const boundX = Math.max(maxOffset, (scaledWidth - CROP_DIAMETER) / 2 + 50);
    const boundY = Math.max(maxOffset, (scaledHeight - CROP_DIAMETER) / 2 + 50);

    return {
      x: Math.max(-boundX, Math.min(boundX, x)),
      y: Math.max(-boundY, Math.min(boundY, y)),
    };
  }, [naturalSize, baseScale, CROP_DIAMETER, CROP_RADIUS]);

  // Handlers de arrastar com mouse ou toque
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newPos = clampPosition(posStartRef.current.x + dx, posStartRef.current.y + dy, zoom);
    setPosition(newPos);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.min(3, Math.max(0.7, Number(newZoom.toFixed(2))));
    setZoom(clampedZoom);
    setPosition(prev => clampPosition(prev.x, prev.y, clampedZoom));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Gerar imagem final do recorte circular através de Canvas, enviar para Storage do Supabase e salvar
  const handleConfirmCrop = async () => {
    if (!imageSrc || isProcessing) return;

    setIsProcessing(true);

    try {
      const OUTPUT_SIZE = 400; // Resolução de alta definição para avatares
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Não foi possível inicializar o processador de imagem.');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Obter a imagem para desenho garantindo carregamento
      let sourceImg: HTMLImageElement | null = imageRef.current;
      if (!sourceImg || !sourceImg.complete || sourceImg.naturalWidth === 0) {
        sourceImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Falha ao carregar a imagem selecionada.'));
          img.src = imageSrc;
        });
      }

      const imgWidth = sourceImg.naturalWidth || sourceImg.width || 400;
      const imgHeight = sourceImg.naturalHeight || sourceImg.height || 400;

      // Cálculo da proporção e escala exata
      const factor = OUTPUT_SIZE / CROP_DIAMETER;
      const effectiveBaseScale = Math.max(CROP_DIAMETER / imgWidth, CROP_DIAMETER / imgHeight);
      const currentScale = effectiveBaseScale * zoom * factor;

      const drawWidth = imgWidth * currentScale;
      const drawHeight = imgHeight * currentScale;

      const centerX = OUTPUT_SIZE / 2 + position.x * factor;
      const centerY = OUTPUT_SIZE / 2 + position.y * factor;

      const drawX = centerX - drawWidth / 2;
      const drawY = centerY - drawHeight / 2;

      // Fundo branco limpo para o avatar
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      // Desenha a imagem com as coordenadas e zoom definidos pelo usuário
      ctx.drawImage(sourceImg, drawX, drawY, drawWidth, drawHeight);

      // 2. Converte o canvas diretamente em base64 e transfere para um File nativo em memória (sem URLs temporárias 'blob:' que violam CSP)
      const base64DataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64Content = base64DataUrl.split(',')[1];
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const rawBlob = new Blob([byteNumbers], { type: 'image/jpeg' });
      const rawFile = new File([rawBlob], `avatar_${employeeId || 'colaborador'}_${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      // 3. Upload imediato do arquivo nativo para o Supabase Storage (bucket de avatares/funcionários)
      let publicStorageUrl: string | null = null;
      if (isSupabaseConfigured) {
        try {
          const effectiveCid = companyId || getActiveCompanyId();
          const targetEmpId = employeeId || `emp_${Date.now()}`;
          publicStorageUrl = await uploadEmployeePhotoToStorage(rawFile, targetEmpId, effectiveCid);
          console.info('Retorno do Supabase Storage:', publicStorageUrl);
        } catch (uploadError) {
          console.warn('Aviso: Falha no upload para o Supabase Storage:', uploadError);
        }
      }

      // Validação estrita: verifica se o Storage retornou uma URL pública HTTP completa
      const isValidStorageHttpUrl = Boolean(
        publicStorageUrl &&
        typeof publicStorageUrl === 'string' &&
        (publicStorageUrl.startsWith('http://') || publicStorageUrl.startsWith('https://')) &&
        !publicStorageUrl.startsWith('blob:') &&
        !publicStorageUrl.startsWith('data:')
      );

      // 4. Comunica o resultado para o formulário pai usando o link de texto do bucket avatars
      await onConfirm({
        file: rawFile,
        previewUrl: base64DataUrl,
        publicUrl: isValidStorageHttpUrl ? publicStorageUrl! : undefined,
      });

      // 5. Fecha o modal de ajuste automaticamente
      onClose();
    } catch (err: any) {
      console.error('Erro ao processar o recorte da foto:', err);
      alert(err?.message || 'Ocorreu um erro ao processar o recorte da foto.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-md overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-900/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-['Outfit']">
                Ajustar Foto do Colaborador
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {employeeName ? `Colaborador: ${employeeName}` : 'Arraste para posicionar e use o zoom'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-lg transition disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport de Recorte Interativo */}
        <div className="p-5 flex flex-col items-center select-none bg-stone-100/50 dark:bg-stone-950/40">
          <div
            ref={containerRef}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            className={`relative rounded-xl overflow-hidden bg-stone-950 shadow-inner border border-stone-300 dark:border-stone-800 touch-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Imagem sendo posicionada */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.05s ease-out',
              }}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Foto para recorte"
                onLoad={handleImageLoad}
                crossOrigin="anonymous"
                style={{
                  width: naturalSize.width ? `${naturalSize.width * baseScale * zoom}px` : 'auto',
                  height: naturalSize.height ? `${naturalSize.height * baseScale * zoom}px` : 'auto',
                  maxWidth: 'none',
                  maxHeight: 'none',
                }}
                className="select-none pointer-events-none"
                draggable={false}
              />
            </div>

            {/* Máscara escura com recorte circular transparente no centro */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* O anel SVG cria o recorte perfeito sem vazamento */}
              <svg width={VIEWPORT_SIZE} height={VIEWPORT_SIZE} className="absolute inset-0">
                <defs>
                  <mask id="crop-circle-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <circle cx={VIEWPORT_SIZE / 2} cy={VIEWPORT_SIZE / 2} r={CROP_RADIUS} fill="black" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.65)" mask="url(#crop-circle-mask)" />
              </svg>

              {/* Guia visual do círculo do perfil */}
              <div
                style={{ width: CROP_DIAMETER, height: CROP_DIAMETER }}
                className="rounded-full border-2 border-emerald-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)] pointer-events-none relative flex items-center justify-center"
              >
                {/* Linhas guias suaves para ajudar a centralizar os olhos */}
                <div className="absolute inset-x-8 top-[38%] border-t border-dashed border-white/30" />
                <div className="absolute inset-y-8 left-1/2 border-l border-dashed border-white/30" />
              </div>
            </div>

            {/* Dica de arraste quando ocioso */}
            <div className="absolute bottom-2.5 inset-x-0 flex justify-center pointer-events-none">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-medium text-white/90">
                <Move className="w-3 h-3 text-emerald-400" />
                <span>Arraste para reposicionar</span>
              </span>
            </div>
          </div>

          {/* Controles de Zoom */}
          <div className="w-full mt-4 space-y-3 px-1">
            <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300 font-medium">
              <span className="flex items-center space-x-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-stone-500" />
                <span>Controle de Zoom</span>
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => handleZoomChange(zoom - 0.15)}
                disabled={zoom <= 0.7 || isProcessing}
                className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Diminuir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input
                type="range"
                min="0.7"
                max="3"
                step="0.05"
                value={zoom}
                disabled={isProcessing}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500 disabled:opacity-50"
              />

              <button
                type="button"
                onClick={() => handleZoomChange(zoom + 0.15)}
                disabled={zoom >= 3 || isProcessing}
                className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={isProcessing}
                className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 transition"
                title="Redefinir Posição e Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé com botões de ação */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end space-x-3 bg-white dark:bg-stone-900">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          
          {/* Botão de confirmação destravado: ativo assim que a imagem for carregada */}
          <button
            type="button"
            onClick={handleConfirmCrop}
            disabled={!imageSrc || isProcessing}
            className={`inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition ${
              isProcessing
                ? 'bg-emerald-700/80 cursor-wait'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 cursor-pointer'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Enviando Foto...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirmar Recorte</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
