import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Trash2, RotateCcw, Link as LinkIcon, Check, Eye } from 'lucide-react';

interface ImageUploadFieldProps {
  id: string;
  label: string;
  description?: string;
  value?: string;
  onChange: (value: string) => void;
  defaultFallback?: string;
  aspectRatioLabel?: string;
}

/**
 * Utilitário para comprimir e converter imagem para Base64 otimizado,
 * evitando estouro de limite de armazenamento no localStorage.
 */
function processAndOptimizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Falha ao processar arquivo'));
        return;
      }

      // Se for arquivo muito leve (< 400KB), pode usar direto
      if (file.size <= 400 * 1024) {
        resolve(dataUrl);
        return;
      }

      // Se for imagem maior, redimensiona suavemente via Canvas
      const img = new Image();
      img.onerror = () => resolve(dataUrl); // fallback para o dataUrl original
      img.onload = () => {
        try {
          const maxDim = 1920;
          let { width, height } = img;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Exporta em jpeg de alta qualidade para economizar espaço
          const optimized = canvas.toDataURL('image/jpeg', 0.86);
          resolve(optimized);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  id,
  label,
  description,
  value = '',
  onChange,
  defaultFallback,
  aspectRatioLabel = 'Recomendado: 16:9 ou widescreen',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const hasImage = Boolean(value && value.trim());

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (.jpg, .png, .webp).');
      return;
    }

    try {
      setIsProcessing(true);
      setPreviewError(false);
      const optimizedBase64 = await processAndOptimizeImage(file);
      onChange(optimizedBase64);
    } catch (err) {
      console.error('Erro ao converter imagem:', err);
      alert('Não foi possível carregar esta imagem. Tente outro arquivo.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-bold text-stone-200">
          {label}
        </label>
        <span className="text-[10px] text-stone-400">
          {aspectRatioLabel}
        </span>
      </div>

      {description && (
        <p className="text-[11px] text-stone-400">
          {description}
        </p>
      )}

      {/* Input de arquivo invisível acionado pelos botões */}
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files)}
      />

      {/* Card Principal de Upload e Visualização */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-2xl p-4 transition-all ${
          isDragging
            ? 'border-emerald-500 bg-emerald-950/20'
            : 'border-stone-800 bg-stone-950/70 hover:border-stone-700'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          
          {/* Miniatura / Preview da Imagem */}
          <div className="relative w-full sm:w-40 h-28 rounded-xl bg-stone-900 border border-stone-800 overflow-hidden shrink-0 flex items-center justify-center group shadow-inner">
            {hasImage && !previewError ? (
              <>
                <img
                  src={value}
                  alt="Pré-visualização"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition duration-300"
                  referrerPolicy="no-referrer"
                  onError={() => setPreviewError(true)}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                  <a
                    href={value}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-stone-900/90 text-white rounded-lg hover:bg-emerald-600 transition"
                    title="Ver em tamanho real"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </a>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-stone-600 space-y-1 p-2 text-center">
                <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                <span className="text-[10px] text-stone-500 font-medium">
                  {previewError ? 'Erro na imagem' : 'Sem imagem'}
                </span>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-stone-950/80 flex flex-col items-center justify-center gap-1">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-emerald-400 font-medium">Carregando...</span>
              </div>
            )}
          </div>

          {/* Área de Ações e Informações */}
          <div className="flex-1 space-y-3 w-full">
            <div className="flex flex-wrap items-center gap-2">
              {/* Botão de Upload do Computador */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{hasImage ? 'Substituir Imagem' : 'Selecionar Imagem do Computador'}</span>
              </button>

              {/* Botão para limpar */}
              {hasImage && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setPreviewError(false);
                  }}
                  className="px-3 py-2 bg-stone-900 hover:bg-rose-950/40 text-stone-400 hover:text-rose-300 border border-stone-800 hover:border-rose-800/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Remover imagem atual"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover</span>
                </button>
              )}

              {/* Botão Restaurar Padrão se aplicável */}
              {defaultFallback && value !== defaultFallback && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(defaultFallback);
                    setPreviewError(false);
                  }}
                  className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Restaurar imagem padrão do sistema"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Padrão</span>
                </button>
              )}

              {/* Alternar modo manual de URL */}
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="px-2.5 py-2 text-stone-400 hover:text-stone-200 text-xs flex items-center gap-1 transition cursor-pointer ml-auto"
                title="Inserir link URL ou caminho estático"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span className="text-[11px] underline">
                  {showUrlInput ? 'Ocultar URL' : 'Digitar URL'}
                </span>
              </button>
            </div>

            <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
              <span>Arraste e solte uma imagem aqui (.jpg, .png ou .webp) ou clique no botão verde.</span>
              {hasImage && (
                <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-bold ml-auto">
                  <Check className="w-3 h-3" /> Imagem Pronta
                </span>
              )}
            </p>

            {/* Campo opcional para digitação manual de URL */}
            {showUrlInput && (
              <div className="pt-2 border-t border-stone-800/80">
                <label className="block text-[10px] uppercase font-bold text-stone-400 mb-1">
                  Ou digite a URL / caminho do arquivo estático:
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    setPreviewError(false);
                    onChange(e.target.value);
                  }}
                  placeholder="Ex: /image.png ou https://meusite.com/foto.jpg"
                  className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg text-xs font-mono text-emerald-400 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
