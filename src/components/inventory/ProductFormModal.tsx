import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Package, 
  Settings, 
  Barcode, 
  Receipt, 
  Layers, 
  Check, 
  Loader2,
  Droplets,
  Printer,
  MapPin,
  CircleDot,
  Plus,
  Trash2,
  Pencil,
  Camera
} from 'lucide-react';
import { InventoryItem, TireItem } from '../../types';
import { 
  getStoredInventoryCategories, 
  saveStoredInventoryCategories, 
  DEFAULT_INVENTORY_CATEGORIES,
  getStoredTireInventory,
  saveStoredTireInventory
} from '../../lib/storage';
import { CategoryOptionsManagerModal } from '../common/CategoryOptionsManagerModal';
import { cadastrarProduto, parseNumericFloat } from '../../lib/supabaseService';
import { ProductLabelPrintModal } from './ProductLabelPrintModal';

export const DEFAULT_TIRE_BRANDS = [
  'MICHELIN',
  'PIRELLI',
  'BRIDGESTONE',
  'GOODYEAR',
  'FIRESTONE',
  'CONTINENTAL',
  'DUNLOP',
  'TRELLEBORG',
  'ALLIANCE',
  'OUTRO',
];

export const TIRE_BRAND_STORAGE_KEY = 'colaca_silagem_marcas_pneus';

export function getStoredTireBrands(): string[] {
  try {
    const raw = localStorage.getItem(TIRE_BRAND_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((b: string) => String(b).toUpperCase());
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar marcas de pneus:', e);
  }
  return DEFAULT_TIRE_BRANDS;
}

export function saveStoredTireBrands(brands: string[]): void {
  try {
    localStorage.setItem(TIRE_BRAND_STORAGE_KEY, JSON.stringify(brands));
  } catch (e) {
    console.warn('Erro ao salvar marcas de pneus:', e);
  }
}

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: InventoryItem) => void;
  initialData?: Partial<InventoryItem>;
  companyId?: string;
  showStockBalanceFields?: boolean;
  zIndexClass?: string;
}

// Formatação padronizada de partes do endereçamento de gôndola/almoxarifado
export function formatEnderecoPart(val: string): string {
  const clean = (val || '').trim();
  if (!clean) return '';
  if (/^\d$/.test(clean)) return `0${clean}`;
  return clean.toUpperCase();
}

// Máscara NCM: 0000.00.00 (8 dígitos numéricos)
export function formatNcmMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
}

// Formatação PT-BR para moeda: 1.250,50
export function formatCurrencyPtBr(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Parse de string PT-BR para float numérico válido
export function parseCurrencyPtBr(value: string): number {
  if (!value) return 0;
  const clean = value.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.max(0, num);
}

// Máscara de Digitação Automática Inteligente para Medida / Dimensão de Pneu (Padrão: 295/80 R 22.5)
export function applyTireSizeMask(val: string, prevVal: string = ''): string {
  if (!val) return '';

  const isDeleting = val.length < prevVal.length;

  if (isDeleting) {
    // Quando o usuário apaga com Backspace, remove os delimitadores suavemente sem travar
    if (val.endsWith(' R') || val.endsWith(' R ') || val.endsWith(' ') || val.endsWith(' r') || val.endsWith(' r ')) {
      return val.replace(/\s*[Rr]?\s*$/, '').toUpperCase();
    }
    if (val.endsWith('/')) {
      return val.slice(0, -1);
    }
    return val.toUpperCase();
  }

  // Normalização de vírgula para ponto decimal e maiúsculas
  const normalized = val.toUpperCase().replace(',', '.');

  // Extrai dígitos numéricos limpos
  const rawDigits = normalized.replace(/[^0-9]/g, '');
  if (!rawDigits) return '';

  // 1. Largura (primeiros 3 dígitos, ex: 295, 275, 315)
  const width = rawDigits.slice(0, 3);
  if (rawDigits.length < 3) {
    return width;
  }

  // 2. Perfil (próximos 2 dígitos, ex: 80, 70, 75)
  const profile = rawDigits.slice(3, 5);
  if (rawDigits.length === 3) {
    return `${width}/`;
  }
  if (rawDigits.length === 4) {
    return `${width}/${profile}`;
  }

  // Com largura (3 dígitos) e perfil (2 dígitos) completos, insere " R "
  // 3. Aro (ex: 22, 22.5, 17.5, 24)
  const rimDigits = rawDigits.slice(5);

  // Verifica se o usuário digitou ponto explicitamente após o perfil/letra R
  const rIndex = normalized.lastIndexOf('R');
  const afterProfile = normalized.slice(rIndex !== -1 ? rIndex + 1 : 5);
  const userTypedDot = afterProfile.includes('.');

  let rim = '';
  if (userTypedDot) {
    const dotIndex = afterProfile.indexOf('.');
    const beforeDot = afterProfile.slice(0, dotIndex).replace(/[^0-9]/g, '').slice(0, 2);
    const afterDot = afterProfile.slice(dotIndex + 1).replace(/[^0-9]/g, '').slice(0, 1);
    if (afterProfile.endsWith('.') && !afterDot) {
      rim = `${beforeDot}.`;
    } else if (afterDot) {
      rim = `${beforeDot}.${afterDot}`;
    } else {
      rim = beforeDot;
    }
  } else {
    if (rimDigits.length <= 2) {
      rim = rimDigits;
    } else {
      // Formata automaticamente 3 dígitos de aro comercial (ex: 225 -> 22.5)
      rim = `${rimDigits.slice(0, 2)}.${rimDigits.slice(2, 3)}`;
    }
  }

  return `${width}/${profile} R ${rim}`;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  companyId,
  zIndexClass = 'z-50',
}) => {
  // Categorias de Estoque Dinâmicas com Suporte a Gerenciamento
  const [categories, setCategories] = useState<string[]>(() => {
    return getStoredInventoryCategories();
  });
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  // Escuta atualizações reativas das categorias no LocalStorage
  useEffect(() => {
    const handleCategoriesUpdate = (e: any) => {
      const updatedCats = e.detail || getStoredInventoryCategories();
      setCategories(updatedCats);
    };
    window.addEventListener('colaca_silagem_categorias_estoque_updated', handleCategoriesUpdate);
    return () => {
      window.removeEventListener('colaca_silagem_categorias_estoque_updated', handleCategoriesUpdate);
    };
  }, []);

  // COLUNA 1: IDENTIFICAÇÃO
  const [nome, setNome] = useState('');
  const [codigoInterno, setCodigoInterno] = useState('');
  const [categoria, setCategoria] = useState('');
  const [unidadeMedida, setUnidadeMedida] = useState('UN');
  const [marca, setMarca] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [semGtin, setSemGtin] = useState(false);
  const [refFabrica, setRefFabrica] = useState('');

  // BLOCO TÉCNICO: PARÂMETROS DO PNEU (GESTÃO DE FROTAS)
  const [tireFireNumber, setTireFireNumber] = useState('');
  const [tireBrand, setTireBrand] = useState('');
  const [tireModel, setTireModel] = useState('');
  const [tireSize, setTireSize] = useState('');
  const [tireTreadDepthMm, setTireTreadDepthMm] = useState('12.0');
  const [tireRetreadCount, setTireRetreadCount] = useState<number>(0);
  const [tirePressurePsi, setTirePressurePsi] = useState('110');
  const [tireCurrentKm, setTireCurrentKm] = useState('');
  const [tireNotes, setTireNotes] = useState('');

  // Marcas de Pneus Dinâmicas com Persistência Local
  const [tireBrandOptions, setTireBrandOptions] = useState<string[]>(() => getStoredTireBrands());
  const [isBrandManagerOpen, setIsBrandManagerOpen] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState('');
  const [brandToDeleteConfirm, setBrandToDeleteConfirm] = useState<string | null>(null);

  // 1. CORREÇÃO DO REPASSE DE VALOR (BINDING): Atualização reativa de marca com redundância inteligente
  const setMarcaPneu = (value: string) => {
    const upperVal = value ? value.toUpperCase() : '';
    setTireBrand(upperVal);
    // Se o operador selecionou ou preencheu a marca do pneu e o campo geral de marca estiver vazio ou "SELECIONE...", atualiza também
    if (!marca || marca.trim() === '' || marca.toUpperCase() === 'SELECIONE...') {
      if (upperVal && upperVal !== 'SELECIONE...') {
        setMarca(upperVal);
      }
    }
  };

  const handleAddBrand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newBrandInput.trim().toUpperCase();
    if (!clean) return;
    if (!tireBrandOptions.some((b) => b.toUpperCase() === clean)) {
      const updated = [...tireBrandOptions, clean];
      setTireBrandOptions(updated);
      saveStoredTireBrands(updated);
      setTireBrand(clean);
      if (!marca) setMarca(clean);
    } else {
      const existing = tireBrandOptions.find((b) => b.toUpperCase() === clean) || clean;
      setTireBrand(existing);
      if (!marca) setMarca(existing);
    }
    setNewBrandInput('');
    setBrandToDeleteConfirm(null);
  };

  const executeRemoveBrand = (brandToRemove: string) => {
    const updated = tireBrandOptions.filter((b) => b !== brandToRemove);
    setTireBrandOptions(updated);
    saveStoredTireBrands(updated);
    if (tireBrand === brandToRemove) {
      setTireBrand('');
    }
  };

  const handleRequestRemoveBrand = (brandToRemove: string) => {
    // Tenta primeiro o window.confirm nativo leve
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const ok = window.confirm(`Tem certeza que deseja excluir esta marca? (${brandToRemove})`);
        if (ok) {
          executeRemoveBrand(brandToRemove);
          setBrandToDeleteConfirm(null);
          return;
        } else {
          return;
        }
      }
    } catch {
      // Se window.confirm não for suportado no ambiente, prossegue com confirmação visual
    }
    setBrandToDeleteConfirm(brandToRemove);
  };

  const handleDeleteSelectedBrand = () => {
    if (!tireBrand) return;
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const ok = window.confirm(`Tem certeza que deseja excluir esta marca? (${tireBrand})`);
        if (ok) {
          executeRemoveBrand(tireBrand);
          setBrandToDeleteConfirm(null);
          return;
        } else {
          return;
        }
      }
    } catch {
      // Fallback
    }
    setIsBrandManagerOpen(true);
    setBrandToDeleteConfirm(tireBrand);
  };

  // Identifica dinamicamente se a categoria selecionada é 'Pneus'
  const isPneuCategory = useMemo(() => {
    const catNorm = (categoria || '').trim().toLowerCase();
    return catNorm === 'pneus' || catNorm === 'pneu' || catNorm.includes('pneu');
  }, [categoria]);

  // COLUNA 2: FISCAL E VALORES
  const [codigoNcm, setCodigoNcm] = useState('');
  const [grupoFiscal, setGrupoFiscal] = useState<'SUBSTITUICAO' | 'TRIBUTADO' | 'ISENTO'>('TRIBUTADO');
  const [grupoIpi, setGrupoIpi] = useState<'NAO TRIBUTADO' | 'TRIBUTADO'>('NAO TRIBUTADO');
  
  // Novos campos de custos e impostos calculados do XML (Apenas Leitura)
  const [valorImpostosTotal, setValorImpostosTotal] = useState<number>(0);
  const [custoSemImposto, setCustoSemImposto] = useState<number>(0);
  const [custoComImposto, setCustoComImposto] = useState<number>(0);
  const [freteDiluidoItem, setFreteDiluidoItem] = useState<number>(0);

  const [custoNominalDisplay, setCustoNominalDisplay] = useState('0,00');
  const [precoVendaDisplay, setPrecoVendaDisplay] = useState('0,00');
  const [margemLucroSugerida, setMargemLucroSugerida] = useState('');
  
  // Atacado e Promoção (Novos campos de precificação e desconto)
  const [porcentagemAtacado, setPorcentagemAtacado] = useState('');
  const [valorAtacadoDisplay, setValorAtacadoDisplay] = useState('0,00');
  const [porcentagemPromo, setPorcentagemPromo] = useState('');
  const [valorPromoDisplay, setValorPromoDisplay] = useState('0,00');

  // COLUNA 3: CONTROLE E ALMOXARIFADO
  const [quantidadeAtual, setQuantidadeAtual] = useState<number | ''>('');
  const [minQuantity, setMinQuantity] = useState<number | ''>('');
  const [capacidadeGalao, setCapacidadeGalao] = useState<number | ''>(20);

  // Endereçamento de Almoxarifado / Gôndola (Setor, Rua, Estante, Nível, Box)
  const [setor, setSetor] = useState('');
  const [rua, setRua] = useState('');
  const [estante, setEstante] = useState('');
  const [nivel, setNivel] = useState('');
  const [box, setBox] = useState('');

  // Modal de Impressão de Etiquetas
  const [isLabelPrintModalOpen, setIsLabelPrintModalOpen] = useState(false);

  // Endereço Formatado Calculado Automaticamente (ex: 02.05.08.07.02)
  const enderecoFormatado = useMemo(() => {
    const pSetor = formatEnderecoPart(setor);
    const pRua = formatEnderecoPart(rua);
    const pEstante = formatEnderecoPart(estante);
    const pNivel = formatEnderecoPart(nivel);
    const pBox = formatEnderecoPart(box);

    if (!pSetor && !pRua && !pEstante && !pNivel && !pBox) {
      return '';
    }

    return `${pSetor || '00'}.${pRua || '00'}.${pEstante || '00'}.${pNivel || '00'}.${pBox || '00'}`;
  }, [setor, rua, estante, nivel, box]);

  // Estado de envio
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Foto do Produto (Upload em Base64 - Offline LocalStorage)
  const [fotoBase64, setFotoBase64] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. COMPRESSÃO COMPULSÓRIA DA IMAGEM EM CANVAS (REDUÇÃO DE PESO):
  // Reduz para largura máxima de 400px com qualidade 0.7 (70%), enxugando o arquivo para ~30KB
  const handleImageUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('SELECIONE UM ARQUIVO DE IMAGEM VÁLIDO (JPG OU PNG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 400; // Largura máxima de 400px
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Qualidade em 0.7 (70%)
            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            setFotoBase64(compressed);
            setFormError('');
          } else {
            setFotoBase64(result);
            setFormError('');
          }
        } catch (errCanvas) {
          console.warn('Erro na compressão canvas, utilizando fallback:', errCanvas);
          setFotoBase64(result);
          setFormError('');
        }
      };
      img.onerror = () => {
        setFotoBase64(result);
        setFormError('');
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Verifica dinamicamente se a unidade é galão ou o nome contém 'Galão'
  const showGallonCapacity = useMemo(() => {
    const unitNorm = (unidadeMedida || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const nameNorm = (nome || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return (
      unitNorm === 'galao' ||
      unitNorm === 'gal' ||
      unitNorm === 'gl' ||
      unitNorm.includes('galao') ||
      nameNorm.includes('galao')
    );
  }, [unidadeMedida, nome]);

  // Inicializa dados ao abrir ou alterar initialData
  useEffect(() => {
    if (isOpen) {
      setFormError('');
      const storedCats = getStoredInventoryCategories();
      setCategories(storedCats);

      const initialName = (initialData?.nome_comercial || initialData?.name || initialData?.nome || '').toUpperCase();
      setNome(initialName);

      const rawCat = (initialData?.category || initialData?.categoria || '').trim();
      let normalizedCat = rawCat;
      const exactMatch = storedCats.find(cat => cat.toUpperCase() === rawCat.toUpperCase());
      if (exactMatch) {
        normalizedCat = exactMatch;
      } else {
        const c = rawCat.toLowerCase();
        if (c.includes('pneu')) normalizedCat = 'Pneus';
        else if (c.includes('combust') || c.includes('diesel') || c.includes('arla')) normalizedCat = 'Combustível & Arla';
        else if (c.includes('lona') || c.includes('embalag') || c.includes('filme')) normalizedCat = 'Lona & Embalagem';
        else if (c.includes('inocul') || c.includes('biol')) normalizedCat = 'Inoculante & Biológico';
        else if (c.includes('sement') || c.includes('milho') || c.includes('sorgo') || c.includes('soja')) normalizedCat = 'Sementes';
        else if (c.includes('adubo') || c.includes('fertiliz') || c.includes('ureia') || c.includes('npk')) normalizedCat = 'Adubo & Fertilizante';
        else if (c.includes('peca') || c.includes('peça') || c.includes('manuten') || c.includes('filtro') || c.includes('faca') || c.includes('oleo') || c.includes('óleo')) normalizedCat = 'Peças & Manutenção';
        else if (c.includes('servi') || initialData?.tipo_item === 'SERVIÇO') normalizedCat = 'SERVIÇO';
        else if (c.includes('outro')) normalizedCat = 'Outros Insumos';
      }

      const matchedCat = storedCats.find(cat => cat.toLowerCase() === (normalizedCat || '').toLowerCase());
      const initialCat = matchedCat || (normalizedCat && storedCats.includes(normalizedCat) ? normalizedCat : (storedCats[0] || 'Outros Insumos'));
      setCategoria(initialCat);

      const initialUnit = (initialData?.unit || initialData?.unidade_medida || 'UN').toUpperCase();
      setUnidadeMedida(initialUnit);

      setMarca((initialData?.brand || initialData?.marca || '').toUpperCase());

      const initialNoGtin = Boolean(initialData?.hasNoGtin ?? initialData?.sem_gtin ?? (initialData?.barcode === 'SEM GTIN'));
      setSemGtin(initialNoGtin);

      const initialBar = initialNoGtin ? '' : (initialData?.barcode || initialData?.codigo_barras || '').toUpperCase();
      setCodigoBarras(initialBar);

      setRefFabrica((initialData?.factoryRef || initialData?.ref_fabrica || '').toUpperCase());
      setCodigoInterno((initialData?.code || (initialData as any)?.codigo_produto || '').toUpperCase());

      // Fiscal
      const initialNcm = initialData?.ncm || initialData?.codigo_ncm || '';
      setCodigoNcm(formatNcmMask(initialNcm));

      const initialFiscalGroup = (initialData?.fiscalGroup || initialData?.grupo_fiscal) as any;
      if (initialFiscalGroup && ['SUBSTITUICAO', 'TRIBUTADO', 'ISENTO'].includes(initialFiscalGroup)) {
        setGrupoFiscal(initialFiscalGroup);
      } else {
        setGrupoFiscal('TRIBUTADO');
      }

      const initialIpiGroup = (initialData?.ipiGroup || initialData?.grupo_ipi) as any;
      if (initialIpiGroup && ['NAO TRIBUTADO', 'TRIBUTADO'].includes(initialIpiGroup)) {
        setGrupoIpi(initialIpiGroup);
      } else {
        setGrupoIpi('NAO TRIBUTADO');
      }

      // Impostos e Custos calculados do XML
      const initialImpostos = parseNumericFloat(initialData?.valor_impostos_total ?? (initialData as any)?.valorImpostosTotal ?? 0);
      const initialCustoSemImp = parseNumericFloat(initialData?.custo_sem_imposto ?? (initialData as any)?.custoSemImposto ?? 0);
      const initialCustoComImp = parseNumericFloat(initialData?.custo_com_imposto ?? (initialData as any)?.custoComImposto ?? 0);
      const initialFreteDil = parseNumericFloat(initialData?.frete_diluido_item ?? (initialData as any)?.freteDiluidoItem ?? 0);

      setValorImpostosTotal(initialImpostos);
      setCustoSemImposto(initialCustoSemImp);
      setCustoComImposto(initialCustoComImp);
      setFreteDiluidoItem(initialFreteDil);

      // Custos e Preços:
      // O campo "Custo Nominal (R$)" atual do modal deve passar a receber automaticamente o valor gerado pelo "Custo Real (Com Imposto + Frete Diluído)"
      const custo = initialCustoComImp > 0
        ? initialCustoComImp
        : parseNumericFloat(initialData?.unitCost ?? initialData?.preco_custo_inicial ?? initialData?.custo_nominal ?? 0);
      const venda = parseNumericFloat(initialData?.salePrice ?? initialData?.preco_venda_varejo ?? initialData?.preco_venda ?? 0);
      
      setCustoNominalDisplay(custo > 0 ? formatCurrencyPtBr(custo) : '0,00');
      setPrecoVendaDisplay(venda > 0 ? formatCurrencyPtBr(venda) : '0,00');

      if (initialData?.profitMargin !== undefined && initialData?.profitMargin !== null) {
        setMargemLucroSugerida(String(initialData.profitMargin));
      } else if (initialData?.margem_lucro_sugerida !== undefined && initialData?.margem_lucro_sugerida !== null) {
        setMargemLucroSugerida(String(initialData.margem_lucro_sugerida));
      } else if (custo > 0 && venda > 0) {
        setMargemLucroSugerida((((venda - custo) / custo) * 100).toFixed(2));
      } else {
        setMargemLucroSugerida('30');
      }

      // Atacado & Promoção
      const initialWholesalePrice = parseNumericFloat(
        initialData?.wholesalePrice ?? 
        initialData?.preco_venda_atacado ?? 
        initialData?.preco_atacado ?? 
        0
      );
      setValorAtacadoDisplay(initialWholesalePrice > 0 ? formatCurrencyPtBr(initialWholesalePrice) : '0,00');

      if (initialData?.wholesaleMargin !== undefined && initialData?.wholesaleMargin !== null) {
        setPorcentagemAtacado(String(initialData.wholesaleMargin));
      } else if (initialData?.margem_atacado !== undefined && initialData?.margem_atacado !== null) {
        setPorcentagemAtacado(String(initialData.margem_atacado));
      } else if (initialData?.desconto_atacado_percent !== undefined && initialData?.desconto_atacado_percent !== null) {
        setPorcentagemAtacado(String(initialData.desconto_atacado_percent));
      } else if (initialWholesalePrice > 0 && custo > 0) {
        setPorcentagemAtacado((((initialWholesalePrice - custo) / custo) * 100).toFixed(2));
      } else if (initialWholesalePrice > 0 && venda > 0) {
        setPorcentagemAtacado((((venda - initialWholesalePrice) / venda) * 100).toFixed(2));
      } else {
        setPorcentagemAtacado('');
      }

      const initialPromoPrice = parseNumericFloat(
        initialData?.promoPrice ?? 
        initialData?.preco_venda_promo ?? 
        initialData?.preco_promocional ?? 
        0
      );
      setValorPromoDisplay(initialPromoPrice > 0 ? formatCurrencyPtBr(initialPromoPrice) : '0,00');

      if (initialData?.promoMargin !== undefined && initialData?.promoMargin !== null) {
        setPorcentagemPromo(String(initialData.promoMargin));
      } else if (initialData?.margem_promocional !== undefined && initialData?.margem_promocional !== null) {
        setPorcentagemPromo(String(initialData.margem_promocional));
      } else if (initialData?.desconto_promo_percent !== undefined && initialData?.desconto_promo_percent !== null) {
        setPorcentagemPromo(String(initialData.desconto_promo_percent));
      } else if (initialPromoPrice > 0 && custo > 0) {
        setPorcentagemPromo((((initialPromoPrice - custo) / custo) * 100).toFixed(2));
      } else if (initialPromoPrice > 0 && venda > 0) {
        setPorcentagemPromo((((venda - initialPromoPrice) / venda) * 100).toFixed(2));
      } else {
        setPorcentagemPromo('');
      }

      // Estoque e Almoxarifado
      setQuantidadeAtual(initialData?.quantity !== undefined ? initialData.quantity : '');
      setMinQuantity(initialData?.minQuantity !== undefined ? initialData.minQuantity : '');

      const initialSetor = initialData?.estoque_setor || initialData?.setor || '';
      const initialRua = initialData?.estoque_rua || initialData?.rua || '';
      const initialEstante = initialData?.estoque_estante || initialData?.estante || '';
      const initialNivel = (initialData?.estoque_nivel || initialData?.nivel || '').toUpperCase();
      const initialBox = (initialData?.estoque_box || initialData?.box || '').toUpperCase();

      const rawAddr = (initialData?.endereco_formatado || initialData?.localizacao_fisica || initialData?.location || '').trim().toUpperCase();
      if (!initialSetor && !initialRua && rawAddr && rawAddr.includes('.')) {
        const splitted = rawAddr.split('.');
        setSetor(splitted[0]?.toUpperCase() || '');
        setRua(splitted[1]?.toUpperCase() || '');
        setEstante(splitted[2]?.toUpperCase() || '');
        setNivel(splitted[3]?.toUpperCase() || '');
        setBox(splitted[4]?.toUpperCase() || '');
      } else {
        setSetor((initialData?.estoque_setor || initialData?.setor || '').toUpperCase());
        setRua((initialData?.estoque_rua || initialData?.rua || '').toUpperCase());
        setEstante((initialData?.estoque_estante || initialData?.estante || '').toUpperCase());
        setNivel(initialNivel);
        setBox(initialBox);
      }

      const initialGallonCap = initialData?.gallonSizeLiters ?? initialData?.volume_litros_embalagem;
      setCapacidadeGalao(initialGallonCap !== undefined && initialGallonCap !== null ? Number(initialGallonCap) : 20);

      // 3. REABERTURA REATIVA INTEGRAL (MÉTODO COMPULSÓRIO CARREGAMENTO):
      // Recupera o objeto do LocalStorage ou do initialData e preenche todos os inputs
      let itemFresh = initialData;
      if (initialData?.id || initialData?.code || initialData?.name || initialData?.nome_comercial) {
        try {
          const raw = localStorage.getItem('agrocontrol_produtos') || localStorage.getItem('colaca_silagem_estoque_produtos');
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const found = list.find((p: any) => 
                (initialData?.id && String(p.id) === String(initialData.id)) ||
                (initialData?.id && String(p.code) === String(initialData.id)) ||
                (p.code && initialData.code && String(p.code).toUpperCase() === String(initialData.code).toUpperCase()) ||
                (p.name && initialData.name && String(p.name).toUpperCase() === String(initialData.name).toUpperCase()) ||
                (p.nome_comercial && initialData.nome_comercial && String(p.nome_comercial).toUpperCase() === String(initialData.nome_comercial).toUpperCase()) ||
                (p.item && initialData.name && String(p.item).toUpperCase() === String(initialData.name).toUpperCase())
              );
              if (found) {
                itemFresh = { ...initialData, ...found };
              }
            }
          }
        } catch (e) {
          console.warn('Erro ao ler agrocontrol_produtos no modal:', e);
        }
      }

      // Restauração da Marca: herança unificada pelo campo MARCA de 1. IDENTIFICAÇÃO
      const initialMarca = (
        itemFresh?.marca || 
        itemFresh?.brand || 
        initialData?.marca || 
        initialData?.brand || 
        (itemFresh as any)?.pneuParams?.marcaPneu || 
        (initialData as any)?.pneuParams?.marcaPneu || 
        ''
      ).toUpperCase();
      setMarca(initialMarca);

      const pneuParamsObj = (itemFresh as any)?.pneuParams || (initialData as any)?.pneuParams;
      const tireParamsObj = itemFresh?.tireParameters || initialData?.tireParameters;

      const initialFire = (
        pneuParamsObj?.numeroFogo || 
        (itemFresh as any)?.numeroFogo || 
        (tireParamsObj as any)?.numeroFogo || 
        tireParamsObj?.fireNumber || 
        itemFresh?.fireNumber || 
        (initialData as any)?.fireNumber || 
        ''
      ).toUpperCase();

      const initialTireModel = (
        pneuParamsObj?.modeloBanda || 
        (itemFresh as any)?.modeloBanda || 
        (tireParamsObj as any)?.modeloBanda || 
        tireParamsObj?.model || 
        itemFresh?.tireModel || 
        (initialData as any)?.tireModel || 
        ''
      ).toUpperCase();

      const initialTireSize = (
        pneuParamsObj?.medidaDimensao || 
        (itemFresh as any)?.medidaDimensao || 
        (tireParamsObj as any)?.medidaDimensao || 
        tireParamsObj?.size || 
        itemFresh?.tireSize || 
        (initialData as any)?.tireSize || 
        ''
      ).toUpperCase();

      const initialTread = pneuParamsObj?.sulcoActual ?? 
                           (itemFresh as any)?.sulcoActual ?? 
                           (tireParamsObj as any)?.sulcoActual ?? 
                           tireParamsObj?.treadDepthMm ?? 
                           itemFresh?.treadDepthMm ?? 
                           (initialData as any)?.treadDepthMm ?? 
                           12.0;

      const initialRetread = pneuParamsObj?.recapagens ?? 
                            (itemFresh as any)?.recapagens ?? 
                            (tireParamsObj as any)?.recapagens ?? 
                            tireParamsObj?.retreadCount ?? 
                            itemFresh?.retreadCount ?? 
                            (initialData as any)?.retreadCount ?? 
                            0;

      const initialPressure = pneuParamsObj?.pressaoPsi ?? 
                             (itemFresh as any)?.pressaoPsi ?? 
                             (tireParamsObj as any)?.pressaoPsi ?? 
                             tireParamsObj?.pressurePsi ?? 
                             itemFresh?.pressurePsi ?? 
                             (initialData as any)?.pressurePsi ?? 
                             110;

      const initialKm = pneuParamsObj?.kmEstimado ?? 
                        (itemFresh as any)?.kmEstimado ?? 
                        (tireParamsObj as any)?.kmEstimado ?? 
                        tireParamsObj?.currentKm ?? 
                        itemFresh?.currentKm ?? 
                        (initialData as any)?.currentKm ?? 
                        '';

      const initialTireNotes = (
        pneuParamsObj?.observacoesPneu || 
        (itemFresh as any)?.observacoesPneu || 
        (tireParamsObj as any)?.observacoesPneu || 
        tireParamsObj?.notes || 
        itemFresh?.tireNotes || 
        (initialData as any)?.tireNotes || 
        ''
      ).toUpperCase();

      setTireFireNumber(initialFire);
      setTireBrand(initialMarca);
      setTireModel(initialTireModel);
      setTireSize(initialTireSize);
      setTireTreadDepthMm(String(initialTread));
      setTireRetreadCount(Number(initialRetread) || 0);
      setTirePressurePsi(String(initialPressure));
      setTireCurrentKm(initialKm !== '' && initialKm !== null && initialKm !== undefined ? String(initialKm) : '');
      setTireNotes(initialTireNotes);

      // 3. CARREGAMENTO REATIVO NA EDIÇÃO (MONTAGEM EM DOIS NÍVEIS):
      // Busca secundária na chave 'agrocontrol_fotos_produtos' localizando pelo ID do produto ativo
      const activeProdId = String(itemFresh?.id || initialData?.id || '').trim();
      let fotoEncontrada = '';
      if (activeProdId) {
        try {
          const rawFotos = localStorage.getItem('agrocontrol_fotos_produtos');
          if (rawFotos) {
            const parsed = JSON.parse(rawFotos);
            if (Array.isArray(parsed)) {
              const match = parsed.find((f: any) => 
                String(f.idProduto || f.id || '').toUpperCase() === activeProdId.toUpperCase()
              );
              if (match && (match.imagem || match.fotoBase64)) {
                fotoEncontrada = match.imagem || match.fotoBase64;
              }
            } else if (parsed && typeof parsed === 'object') {
              if (parsed[activeProdId]) {
                fotoEncontrada = typeof parsed[activeProdId] === 'string' ? parsed[activeProdId] : (parsed[activeProdId].imagem || '');
              }
            }
          }
        } catch (eFotos) {
          console.warn('Erro ao ler agrocontrol_fotos_produtos:', eFotos);
        }
      }

      // Se encontrar a imagem correspondente na gaveta de fotos, injeta na miniatura do quadro na hora; fallback legado seguro
      const fotoFinal = fotoEncontrada || 
                        (itemFresh as any)?.imagemBase64 || 
                        (itemFresh as any)?.fotoUrl || 
                        (initialData as any)?.imagemBase64 || 
                        (initialData as any)?.fotoUrl || 
                        '';
      setFotoBase64(fotoFinal);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // Gerenciamento de NCM com máscara 0000.00.00
  const handleNcmChange = (raw: string) => {
    setCodigoNcm(formatNcmMask(raw.toUpperCase()));
  };

  // Tratamento e cálculo dinâmico de Custo Nominal (R$)
  const handleCustoChange = (raw: string) => {
    const cleanDigits = raw.replace(/\D/g, '');
    const floatVal = cleanDigits ? Number(cleanDigits) / 100 : 0;
    setCustoNominalDisplay(formatCurrencyPtBr(floatVal));

    const marginNum = parseFloat(margemLucroSugerida.replace(',', '.'));
    if (floatVal > 0 && !isNaN(marginNum) && marginNum >= 0) {
      const calculatedSale = Math.round(floatVal * (1 + marginNum / 100) * 100) / 100;
      setPrecoVendaDisplay(formatCurrencyPtBr(calculatedSale));
    }

    // Atualização sincronizada de Atacado caso haja porcentagem informada
    const atacadoMarginNum = parseFloat(porcentagemAtacado.replace(',', '.'));
    if (floatVal > 0 && !isNaN(atacadoMarginNum)) {
      const calculatedAtacado = Math.round(floatVal * (1 + atacadoMarginNum / 100) * 100) / 100;
      setValorAtacadoDisplay(formatCurrencyPtBr(calculatedAtacado));
    }

    // Atualização sincronizada de Promoção caso haja porcentagem informada
    const promoMarginNum = parseFloat(porcentagemPromo.replace(',', '.'));
    if (floatVal > 0 && !isNaN(promoMarginNum)) {
      const calculatedPromo = Math.round(floatVal * (1 + promoMarginNum / 100) * 100) / 100;
      setValorPromoDisplay(formatCurrencyPtBr(calculatedPromo));
    }
  };

  // Tratamento e cálculo dinâmico de Preço de Venda Sugerido (R$)
  const handlePrecoVendaChange = (raw: string) => {
    const cleanDigits = raw.replace(/\D/g, '');
    const saleFloat = cleanDigits ? Number(cleanDigits) / 100 : 0;
    setPrecoVendaDisplay(formatCurrencyPtBr(saleFloat));

    const costFloat = parseCurrencyPtBr(custoNominalDisplay);
    if (costFloat > 0 && saleFloat > 0) {
      const calculatedMargin = (((saleFloat - costFloat) / costFloat) * 100).toFixed(2);
      setMargemLucroSugerida(calculatedMargin);
    }
  };

  // Tratamento de Margem de Lucro Sugerida (%)
  const handleMargemChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.,-]/g, '');
    setMargemLucroSugerida(cleaned);

    const marginNum = parseFloat(cleaned.replace(',', '.'));
    const costFloat = parseCurrencyPtBr(custoNominalDisplay);
    if (costFloat > 0 && !isNaN(marginNum)) {
      const calculatedSale = Math.round(costFloat * (1 + marginNum / 100) * 100) / 100;
      setPrecoVendaDisplay(formatCurrencyPtBr(calculatedSale));
    }
  };

  // Tratamento de Porcentagem de Desconto Atacado (%) -> % ATAC.
  const handlePorcentagemAtacadoChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.,-]/g, '');
    setPorcentagemAtacado(cleaned);

    const pctNum = parseFloat(cleaned.replace(',', '.'));
    const costFloat = parseCurrencyPtBr(custoNominalDisplay);
    const saleFloat = parseCurrencyPtBr(precoVendaDisplay);

    if (!isNaN(pctNum)) {
      if (costFloat > 0) {
        const calculated = Math.round(costFloat * (1 + pctNum / 100) * 100) / 100;
        setValorAtacadoDisplay(formatCurrencyPtBr(calculated));
      } else if (saleFloat > 0) {
        const calculated = Math.round(saleFloat * (1 - pctNum / 100) * 100) / 100;
        setValorAtacadoDisplay(formatCurrencyPtBr(calculated));
      }
    }
  };

  // Tratamento de Valor de Atacado (R$) -> V. ATACADO (R$)
  const handleValorAtacadoChange = (raw: string) => {
    const cleanDigits = raw.replace(/\D/g, '');
    const floatVal = cleanDigits ? Number(cleanDigits) / 100 : 0;
    setValorAtacadoDisplay(formatCurrencyPtBr(floatVal));

    const costFloat = parseCurrencyPtBr(custoNominalDisplay);
    const saleFloat = parseCurrencyPtBr(precoVendaDisplay);

    if (floatVal > 0) {
      if (costFloat > 0) {
        const calculatedMargin = (((floatVal - costFloat) / costFloat) * 100).toFixed(2);
        setPorcentagemAtacado(calculatedMargin);
      } else if (saleFloat > 0) {
        const calculatedDiscount = (((saleFloat - floatVal) / saleFloat) * 100).toFixed(2);
        setPorcentagemAtacado(calculatedDiscount);
      }
    }
  };

  // Tratamento de Porcentagem de Desconto Promoção (%) -> % PROMO.
  const handlePorcentagemPromoChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.,-]/g, '');
    setPorcentagemPromo(cleaned);

    const pctNum = parseFloat(cleaned.replace(',', '.'));
    const costFloat = parseCurrencyPtBr(custoNominalDisplay);
    const saleFloat = parseCurrencyPtBr(precoVendaDisplay);

    if (!isNaN(pctNum)) {
      if (costFloat > 0) {
        const calculated = Math.round(costFloat * (1 + pctNum / 100) * 100) / 100;
        setValorPromoDisplay(formatCurrencyPtBr(calculated));
      } else if (saleFloat > 0) {
        const calculated = Math.round(saleFloat * (1 - pctNum / 100) * 100) / 100;
        setValorPromoDisplay(formatCurrencyPtBr(calculated));
      }
    }
  };

  // Tratamento de Valor Promocional (R$) -> V. PROMO (R$)
  const handleValorPromoChange = (raw: string) => {
    const cleanDigits = raw.replace(/\D/g, '');
    const floatVal = cleanDigits ? Number(cleanDigits) / 100 : 0;
    setValorPromoDisplay(formatCurrencyPtBr(floatVal));

    const costFloat = parseCurrencyPtBr(custoNominalDisplay);
    const saleFloat = parseCurrencyPtBr(precoVendaDisplay);

    if (floatVal > 0) {
      if (costFloat > 0) {
        const calculatedMargin = (((floatVal - costFloat) / costFloat) * 100).toFixed(2);
        setPorcentagemPromo(calculatedMargin);
      } else if (saleFloat > 0) {
        const calculatedDiscount = (((saleFloat - floatVal) / saleFloat) * 100).toFixed(2);
        setPorcentagemPromo(calculatedDiscount);
      }
    }
  };

  // 2. ATUALIZAÇÃO DA FUNÇÃO DE SALVAMENTO: handleSaveProduct / handleUpdateProduct / handleSubmit
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanNome = nome.trim();
    if (!cleanNome) {
      setFormError('O Nome do Produto é obrigatório.');
      return;
    }

    if (isPneuCategory && !tireFireNumber.trim()) {
      setFormError('Para produtos da categoria Pneus, o Nº de Fogo / Matrícula é obrigatório.');
      return;
    }

    // A partir de agora, a rotina de pneus deve ler e herdar de forma automática a propriedade 'marca' preenchida no campo "MARCA" do bloco superior "1. IDENTIFICAÇÃO".
    const marcaTratada = (marca || '').trim().toUpperCase();

    const custoNominalFloat = parseCurrencyPtBr(custoNominalDisplay);
    const precoVendaFloat = parseCurrencyPtBr(precoVendaDisplay);
    const margemFloat = parseFloat(margemLucroSugerida.replace(',', '.')) || (
      custoNominalFloat > 0 && precoVendaFloat > 0 
        ? Number((((precoVendaFloat - custoNominalFloat) / custoNominalFloat) * 100).toFixed(2)) 
        : 0
    );

    const valorAtacadoFloat = parseCurrencyPtBr(valorAtacadoDisplay);
    const valorPromoFloat = parseCurrencyPtBr(valorPromoDisplay);
    const margemAtacadoFloat = porcentagemAtacado !== '' ? parseFloat(porcentagemAtacado.replace(',', '.')) : (
      custoNominalFloat > 0 && valorAtacadoFloat > 0 
        ? Number((((valorAtacadoFloat - custoNominalFloat) / custoNominalFloat) * 100).toFixed(2)) 
        : undefined
    );
    const margemPromoFloat = porcentagemPromo !== '' ? parseFloat(porcentagemPromo.replace(',', '.')) : (
      custoNominalFloat > 0 && valorPromoFloat > 0 
        ? Number((((valorPromoFloat - custoNominalFloat) / custoNominalFloat) * 100).toFixed(2)) 
        : undefined
    );

    setIsSaving(true);
    try {
      const prodId = initialData?.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const cleanBarcode = semGtin ? 'SEM GTIN' : (codigoBarras.trim() || undefined);
      const parsedGallonLiters = showGallonCapacity && capacidadeGalao !== '' && Number(capacidadeGalao) > 0
        ? Number(capacidadeGalao)
        : undefined;

      const newProduct: InventoryItem = {
        id: prodId,
        companyId: companyId || initialData?.companyId,
        code: codigoInterno.trim() || undefined,
        name: cleanNome,
        nome: cleanNome,
        nome_comercial: cleanNome,
        category: categoria || 'outro',
        categoria: categoria || 'outro',
        tipo_item: (categoria === 'SERVIÇO' || (categoria || '').toUpperCase().startsWith('SERVIÇO') || (categoria || '').toUpperCase().includes('MÃO DE OBRA')) ? 'SERVIÇO' : (initialData?.tipo_item || 'PRODUTO'),
        unit: unidadeMedida.trim() || 'UN',
        unidade_medida: unidadeMedida.trim() || 'UN',
        brand: marcaTratada || undefined,
        marca: marcaTratada || undefined,
        barcode: cleanBarcode,
        codigo_barras: cleanBarcode,
        hasNoGtin: semGtin,
        sem_gtin: semGtin,
        factoryRef: refFabrica.trim() || undefined,
        ref_fabrica: refFabrica.trim() || undefined,
        ncm: codigoNcm.trim() || undefined,
        codigo_ncm: codigoNcm.trim() || undefined,
        fiscalGroup: grupoFiscal,
        grupo_fiscal: grupoFiscal,
        ipiGroup: grupoIpi,
        grupo_ipi: grupoIpi,
        valor_impostos_total: valorImpostosTotal,
        custo_sem_imposto: custoSemImposto > 0 ? custoSemImposto : (valorImpostosTotal > 0 ? Math.max(0, custoNominalFloat - valorImpostosTotal) : 0),
        custo_com_imposto: custoComImposto > 0 ? custoComImposto : custoNominalFloat,
        frete_diluido_item: freteDiluidoItem,
        valorImpostosTotal,
        custoSemImposto: custoSemImposto > 0 ? custoSemImposto : (valorImpostosTotal > 0 ? Math.max(0, custoNominalFloat - valorImpostosTotal) : 0),
        custoComImposto: custoComImposto > 0 ? custoComImposto : custoNominalFloat,
        freteDiluidoItem,
        unitCost: custoNominalFloat,
        custo_nominal: custoNominalFloat,
        preco_custo_inicial: custoNominalFloat,
        salePrice: precoVendaFloat,
        preco_venda: precoVendaFloat,
        preco_venda_varejo: precoVendaFloat,
        profitMargin: margemFloat,
        margem_lucro_sugerida: margemFloat,
        wholesaleMargin: isNaN(margemAtacadoFloat as number) ? undefined : margemAtacadoFloat,
        wholesalePrice: valorAtacadoFloat > 0 ? valorAtacadoFloat : undefined,
        promoMargin: isNaN(margemPromoFloat as number) ? undefined : margemPromoFloat,
        promoPrice: valorPromoFloat > 0 ? valorPromoFloat : undefined,
        preco_venda_atacado: valorAtacadoFloat > 0 ? valorAtacadoFloat : undefined,
        preco_venda_promo: valorPromoFloat > 0 ? valorPromoFloat : undefined,
        preco_atacado: valorAtacadoFloat > 0 ? valorAtacadoFloat : undefined,
        preco_promocional: valorPromoFloat > 0 ? valorPromoFloat : undefined,
        margem_atacado: isNaN(margemAtacadoFloat as number) ? undefined : margemAtacadoFloat,
        margem_promocional: isNaN(margemPromoFloat as number) ? undefined : margemPromoFloat,
        desconto_atacado_percent: isNaN(margemAtacadoFloat as number) ? undefined : margemAtacadoFloat,
        desconto_promo_percent: isNaN(margemPromoFloat as number) ? undefined : margemPromoFloat,
        quantity: typeof quantidadeAtual === 'number' ? quantidadeAtual : 0,
        quantidade_atual: typeof quantidadeAtual === 'number' ? quantidadeAtual : 0,
        minQuantity: typeof minQuantity === 'number' ? minQuantity : 0,
        estoque_setor: formatEnderecoPart(setor) || undefined,
        estoque_rua: formatEnderecoPart(rua) || undefined,
        estoque_estante: formatEnderecoPart(estante) || undefined,
        estoque_nivel: formatEnderecoPart(nivel) || undefined,
        estoque_box: formatEnderecoPart(box) || undefined,
        endereco_formatado: enderecoFormatado || undefined,
        setor: formatEnderecoPart(setor) || undefined,
        rua: formatEnderecoPart(rua) || undefined,
        estante: formatEnderecoPart(estante) || undefined,
        nivel: formatEnderecoPart(nivel) || undefined,
        box: formatEnderecoPart(box) || undefined,
        location: enderecoFormatado || 'Depósito Principal',
        localizacao_fisica: enderecoFormatado || 'Depósito Principal',
        gallonSizeLiters: parsedGallonLiters,
        volume_litros_embalagem: parsedGallonLiters,
        // Parâmetros Técnicos do Pneu (Gestão de Frotas e Almoxarifado)
        tireParameters: isPneuCategory ? {
          fireNumber: tireFireNumber.trim().toUpperCase(),
          brand: (marcaTratada || 'MICHELIN').toUpperCase(),
          model: tireModel.trim() ? tireModel.trim().toUpperCase() : undefined,
          size: tireSize.trim() ? tireSize.trim().toUpperCase() : undefined,
          treadDepthMm: parseFloat(tireTreadDepthMm) || 12.0,
          originalTreadDepthMm: 18.0,
          retreadCount: tireRetreadCount,
          pressurePsi: parseFloat(tirePressurePsi) || 110,
          currentKm: parseFloat(tireCurrentKm) || 0,
          notes: tireNotes.trim() ? tireNotes.trim().toUpperCase() : undefined,
        } : undefined,
        pneuParams: isPneuCategory ? {
          numeroFogo: tireFireNumber.trim().toUpperCase(),
          modeloBanda: (tireModel.trim() || cleanNome).toUpperCase(),
          medidaDimensao: (tireSize.trim() || '295/80 R 22.5').toUpperCase(),
          sulcoActual: parseFloat(tireTreadDepthMm) || 12.0,
          recapagens: tireRetreadCount,
          pressaoPsi: parseFloat(tirePressurePsi) || 110,
          kmEstimado: parseFloat(tireCurrentKm) || 0,
          observacoesPneu: tireNotes.trim() ? tireNotes.trim().toUpperCase() : '',
        } : undefined,
        numeroFogo: isPneuCategory ? tireFireNumber.trim().toUpperCase() : undefined,
        modeloBanda: isPneuCategory ? (tireModel.trim() || cleanNome).toUpperCase() : undefined,
        medidaDimensao: isPneuCategory ? (tireSize.trim() || '295/80 R 22.5').toUpperCase() : undefined,
        sulcoActual: isPneuCategory ? (parseFloat(tireTreadDepthMm) || 12.0) : undefined,
        recapagens: isPneuCategory ? tireRetreadCount : undefined,
        pressaoPsi: isPneuCategory ? (parseFloat(tirePressurePsi) || 110) : undefined,
        kmEstimado: isPneuCategory ? (parseFloat(tireCurrentKm) || 0) : undefined,
        observacoesPneu: isPneuCategory ? (tireNotes.trim() ? tireNotes.trim().toUpperCase() : '') : undefined,
        fireNumber: isPneuCategory ? tireFireNumber.trim().toUpperCase() : undefined,
        treadDepthMm: isPneuCategory ? (parseFloat(tireTreadDepthMm) || 12.0) : undefined,
        originalTreadDepthMm: isPneuCategory ? 18.0 : undefined,
        retreadCount: isPneuCategory ? tireRetreadCount : undefined,
        pressurePsi: isPneuCategory ? (parseFloat(tirePressurePsi) || 110) : undefined,
        currentKm: isPneuCategory ? (parseFloat(tireCurrentKm) || 0) : undefined,
        tireModel: isPneuCategory ? (tireModel.trim() ? tireModel.trim().toUpperCase() : undefined) : undefined,
        tireSize: isPneuCategory ? (tireSize.trim() ? tireSize.trim().toUpperCase() : undefined) : undefined,
        tireNotes: isPneuCategory ? (tireNotes.trim() ? tireNotes.trim().toUpperCase() : undefined) : undefined,
        fotoUrl: undefined,
        imagemBase64: undefined,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await cadastrarProduto(newProduct, companyId);

      // Sincronização automática com a Frota (Pneus Disponíveis - Estoque)
      if (isPneuCategory && tireFireNumber.trim()) {
        try {
          const currentTireInv = getStoredTireInventory();
          const cleanFire = tireFireNumber.trim().toUpperCase();
          const existingIdx = currentTireInv.findIndex(
            (t) => (t.fireNumber || '').trim().toLowerCase() === cleanFire.toLowerCase() || t.id === `tire_${prodId}`
          );

          const tireItemToSave: TireItem = {
            id: existingIdx >= 0 ? currentTireInv[existingIdx].id : `tire_inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            position: 'estoque',
            positionName: 'Estoque / Disponível',
            fireNumber: cleanFire.toUpperCase(),
            brand: (marcaTratada || 'MICHELIN').toUpperCase(),
            model: (tireModel.trim() || cleanNome).toUpperCase(),
            size: (tireSize.trim() || '295/80 R 22.5').toUpperCase(),
            treadDepthMm: parseFloat(tireTreadDepthMm) || 12.0,
            originalTreadDepthMm: 18.0,
            pressurePsi: parseFloat(tirePressurePsi) || 110,
            status: 'estoque',
            retreadCount: tireRetreadCount,
            currentKm: parseFloat(tireCurrentKm) || 0,
            notes: tireNotes.trim() ? tireNotes.trim().toUpperCase() : undefined,
          };

          let updatedTireInv: TireItem[];
          if (existingIdx >= 0) {
            updatedTireInv = [...currentTireInv];
            updatedTireInv[existingIdx] = { ...updatedTireInv[existingIdx], ...tireItemToSave };
          } else {
            updatedTireInv = [tireItemToSave, ...currentTireInv];
          }

          saveStoredTireInventory(updatedTireInv);
          window.dispatchEvent(new CustomEvent('tire_inventory_updated', { detail: updatedTireInv }));
        } catch (errTire) {
          console.warn('Aviso ao sincronizar pneu com estoque de frotas:', errTire);
        }
      }

      // Parâmetros do pneu consolidados para persistência (Nota: Removida a chave marca interna daqui)
      const pneuParamsConsolidado = isPneuCategory ? {
        numeroFogo: tireFireNumber.trim().toUpperCase(),
        modeloBanda: (tireModel.trim() || cleanNome).toUpperCase(),
        medidaDimensao: (tireSize.trim() || '295/80 R 22.5').toUpperCase(),
        sulcoActual: parseFloat(tireTreadDepthMm) || 12.0,
        recapagens: tireRetreadCount,
        pressaoPsi: parseFloat(tirePressurePsi) || 110,
        kmEstimado: parseFloat(tireCurrentKm) || 0,
        observacoesPneu: tireNotes.trim() ? tireNotes.trim().toUpperCase() : '',
      } : undefined;

      // 2. DIVISÃO DAS GAVETAS DE PERSISTÊNCIA (SEPARAÇÃO DE CHAVES FOTO VS PARÂMETROS):
      // CHAVE 1 ('agrocontrol_produtos'): Salve estritamente os dados textuais, de custos, o bloco 'pneuParams' unificado e remova a string da foto daqui.
      const productAgroToSave: any = {
        ...newProduct,
        pneuParams: pneuParamsConsolidado,
        ...(pneuParamsConsolidado || {}),
        marca: marcaTratada,
        brand: marcaTratada,
        ...(isPneuCategory ? {
          tireBrand: marcaTratada,
          fireNumber: tireFireNumber.trim().toUpperCase(),
          tireParameters: {
            ...(newProduct.tireParameters || {}),
            brand: (marcaTratada || 'MICHELIN').toUpperCase(),
            fireNumber: tireFireNumber.trim().toUpperCase(),
          }
        } : {})
      };
      delete productAgroToSave.fotoUrl;
      delete productAgroToSave.imagemBase64;

      // CHAVE 2 ('agrocontrol_fotos_produtos'): Crie um objeto isolado para guardar apenas as fotos associadas ao ID: { idProduto: String(idAtivo), imagem: fotoComprimidaBase64 }
      try {
        const prodIdStr = String(prodId);
        const rawFotos = localStorage.getItem('agrocontrol_fotos_produtos');
        let fotosList: any[] = [];
        if (rawFotos) {
          try {
            const parsed = JSON.parse(rawFotos);
            if (Array.isArray(parsed)) {
              fotosList = parsed;
            } else if (parsed && typeof parsed === 'object') {
              fotosList = Object.entries(parsed).map(([idProduto, imagem]) => ({ idProduto, imagem }));
            }
          } catch {
            fotosList = [];
          }
        }

        if (fotoBase64) {
          const idx = fotosList.findIndex((f: any) => String(f.idProduto || f.id) === prodIdStr);
          const fotoObj = { idProduto: prodIdStr, imagem: fotoBase64 };
          if (idx >= 0) {
            fotosList[idx] = fotoObj;
          } else {
            fotosList.push(fotoObj);
          }
        } else {
          fotosList = fotosList.filter((f: any) => String(f.idProduto || f.id) !== prodIdStr);
        }

        localStorage.setItem('agrocontrol_fotos_produtos', JSON.stringify(fotosList));
        window.dispatchEvent(new CustomEvent('agrocontrol_fotos_produtos_updated', { detail: fotosList }));
      } catch (errFoto) {
        console.warn('Aviso ao persistir foto em agrocontrol_fotos_produtos:', errFoto);
      }

      // CHAVE 1 ('agrocontrol_produtos'): Salva o array de produtos enxuto e livre de fotos no LocalStorage
      try {
        const rawAgro = localStorage.getItem('agrocontrol_produtos');
        let agroList: any[] = rawAgro ? JSON.parse(rawAgro) : [];
        if (!Array.isArray(agroList)) agroList = [];

        let matchFound = false;
        const updatedAgroList = agroList.map((p: any) => {
          if (
            String(p.id) === String(newProduct.id) || 
            (p.code && newProduct.code && String(p.code) === String(newProduct.code)) ||
            (p.name && p.name.toUpperCase() === newProduct.name.toUpperCase()) ||
            (p.nome_comercial && p.nome_comercial.toUpperCase() === newProduct.name.toUpperCase()) ||
            (isPneuCategory && p.fireNumber && newProduct.fireNumber && p.fireNumber.toUpperCase() === newProduct.fireNumber.toUpperCase()) ||
            (isPneuCategory && p.numeroFogo && newProduct.fireNumber && p.numeroFogo.toUpperCase() === newProduct.fireNumber.toUpperCase())
          ) {
            matchFound = true;
            const updated = {
              ...p,
              ...productAgroToSave,
              pneuParams: pneuParamsConsolidado,
              ...(pneuParamsConsolidado || {}),
            };
            delete updated.fotoUrl;
            delete updated.imagemBase64;
            return updated;
          }
          if (p.fotoUrl || p.imagemBase64) {
            const cleanP = { ...p };
            delete cleanP.fotoUrl;
            delete cleanP.imagemBase64;
            return cleanP;
          }
          return p;
        });

        if (!matchFound) {
          updatedAgroList.unshift(productAgroToSave);
        }

        localStorage.setItem('agrocontrol_produtos', JSON.stringify(updatedAgroList));
        window.dispatchEvent(new CustomEvent('agrocontrol_produtos_updated', { detail: updatedAgroList }));
      } catch (errAgro) {
        console.warn('Aviso ao persistir produto em agrocontrol_produtos:', errAgro);
      }

      // Sincronização na chave secundária 'colaca_silagem_estoque_produtos' também sem foto
      try {
        const rawStock = localStorage.getItem('colaca_silagem_estoque_produtos');
        let stockList: any[] = rawStock ? JSON.parse(rawStock) : [];
        if (!Array.isArray(stockList)) stockList = [];

        let stockFound = false;
        const updatedStockList = stockList.map((p: any) => {
          if (
            String(p.id) === String(newProduct.id) || 
            (p.code && newProduct.code && String(p.code) === String(newProduct.code)) ||
            (p.name && p.name.toUpperCase() === newProduct.name.toUpperCase()) ||
            (p.nome_comercial && p.nome_comercial.toUpperCase() === newProduct.name.toUpperCase()) ||
            (isPneuCategory && p.fireNumber && newProduct.fireNumber && p.fireNumber.toUpperCase() === newProduct.fireNumber.toUpperCase()) ||
            (isPneuCategory && p.numeroFogo && newProduct.fireNumber && p.numeroFogo.toUpperCase() === newProduct.fireNumber.toUpperCase())
          ) {
            stockFound = true;
            const updated = {
              ...p,
              ...productAgroToSave,
              pneuParams: pneuParamsConsolidado,
              ...(pneuParamsConsolidado || {}),
              marca: marcaTratada,
              brand: marcaTratada,
              categoria: newProduct.categoria,
              category: newProduct.category,
            };
            delete updated.fotoUrl;
            delete updated.imagemBase64;
            return updated;
          }
          if (p.fotoUrl || p.imagemBase64) {
            const cleanP = { ...p };
            delete cleanP.fotoUrl;
            delete cleanP.imagemBase64;
            return cleanP;
          }
          return p;
        });

        if (!stockFound) {
          updatedStockList.unshift({
            ...productAgroToSave,
            pneuParams: pneuParamsConsolidado,
            ...(pneuParamsConsolidado || {}),
            marca: marcaTratada,
            brand: marcaTratada,
            categoria: newProduct.categoria,
            category: newProduct.category,
          });
        }
        localStorage.setItem('colaca_silagem_estoque_produtos', JSON.stringify(updatedStockList));
        window.dispatchEvent(new CustomEvent('colaca_silagem_estoque_produtos_updated', { detail: updatedStockList }));
      } catch (errStock) {
        console.warn('Aviso ao persistir produto no LocalStorage:', errStock);
      }

      onSuccess({
        ...productAgroToSave,
        imagemBase64: fotoBase64 || undefined,
        fotoUrl: fotoBase64 || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Erro ao cadastrar produto:', err);
      setFormError('Ocorreu um erro ao salvar o produto no Supabase. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProduct = handleSaveProduct;
  const handleSubmit = handleSaveProduct;

  // Objeto reativo do produto atual formatado para pré-visualização e impressão de etiquetas
  const currentProductForPrint = useMemo<InventoryItem>(() => {
    const cleanNome = nome.trim() || 'Novo Produto';
    const cleanBarcode = semGtin ? 'SEM GTIN' : (codigoBarras.trim() || undefined);
    const custo = parseCurrencyPtBr(custoNominalDisplay);
    const venda = parseCurrencyPtBr(precoVendaDisplay);
    const atacado = parseCurrencyPtBr(valorAtacadoDisplay);
    const promo = parseCurrencyPtBr(valorPromoDisplay);
    const pSetor = formatEnderecoPart(setor);
    const pRua = formatEnderecoPart(rua);
    const pEstante = formatEnderecoPart(estante);
    const pNivel = formatEnderecoPart(nivel);
    const pBox = formatEnderecoPart(box);
    const endFmt = enderecoFormatado || '00.00.00.00.00';

    const marcaPneu = (tireBrand || '').trim();
    const marcaGeral = (marca || '').trim();
    const marcaPreview = (marcaPneu && marcaPneu !== 'SELECIONE...')
      ? marcaPneu.toUpperCase()
      : (marcaGeral && marcaGeral !== 'SELECIONE...' ? marcaGeral.toUpperCase() : '');

    return {
      id: initialData?.id || `preview_${Date.now()}`,
      code: codigoInterno.trim() || undefined,
      name: cleanNome,
      nome: cleanNome,
      nome_comercial: cleanNome,
      category: categoria || 'outro',
      categoria: categoria || 'outro',
      unit: unidadeMedida.trim() || 'UN',
      unidade_medida: unidadeMedida.trim() || 'UN',
      brand: marcaPreview || undefined,
      marca: marcaPreview || undefined,
      barcode: cleanBarcode,
      codigo_barras: cleanBarcode,
      unitCost: custo,
      salePrice: venda,
      preco_venda_varejo: venda,
      preco_venda: venda,
      wholesalePrice: atacado > 0 ? atacado : undefined,
      promoPrice: promo > 0 ? promo : undefined,
      estoque_setor: pSetor,
      estoque_rua: pRua,
      estoque_estante: pEstante,
      estoque_nivel: pNivel,
      estoque_box: pBox,
      endereco_formatado: endFmt,
      location: endFmt,
      localizacao_fisica: endFmt,
      quantity: typeof quantidadeAtual === 'number' ? quantidadeAtual : 0,
      minQuantity: typeof minQuantity === 'number' ? minQuantity : 0,
      fotoUrl: fotoBase64 || undefined,
      imagemBase64: fotoBase64 || undefined,
    };
  }, [
    initialData?.id,
    codigoInterno,
    nome,
    fotoBase64,
    categoria,
    unidadeMedida,
    marca,
    semGtin,
    codigoBarras,
    custoNominalDisplay,
    precoVendaDisplay,
    valorAtacadoDisplay,
    valorPromoDisplay,
    setor,
    rua,
    estante,
    nivel,
    box,
    enderecoFormatado,
    quantidadeAtual,
    minQuantity
  ]);

  return (
    <>
      <div 
        id="modal-cadastrar-novo-produto-estoque"
        className={`fixed inset-0 ${zIndexClass} bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150`}
        onClick={() => {
          if (!isSaving) onClose();
        }}
      >
        <div 
          className="w-full max-w-[90vw] h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global shadow-2xl animate-in zoom-in-95 duration-150 text-slate-800 dark:text-stone-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header 3D Metálico Acetinado */}
          <div className="px-4 py-2.5 border-b border-slate-400 dark:border-stone-700 flex items-center justify-between bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 text-slate-800 dark:text-stone-100 shrink-0 rounded-t-lg shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)]">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
                <Package className="w-4 h-4 text-sky-600 dark:text-sky-400 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100 font-['Outfit']">
                  {initialData?.id ? 'EDITAR PRODUTO NO ESTOQUE' : 'CADASTRAR NOVO PRODUTO NO ESTOQUE'}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-stone-400 font-bold uppercase tracking-wide">
                  IDENTIFICAÇÃO, PARAMETRIZAÇÃO FISCAL, FORMAÇÃO DE PREÇOS E CONTROLE DE ALMOXARIFADO
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isSaving) onClose();
              }}
              disabled={isSaving}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer disabled:opacity-50"
              title="Fechar formulário"
            >
              <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
            </button>
          </div>

          {/* Erro de validação */}
          {formError && (
            <div className="mx-4 mt-2.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
              <span>{formError}</span>
              <button 
                type="button" 
                onClick={() => setFormError('')} 
                className="text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Formulário em 3 Colunas Horizontais Paralelas - Slim Design sem Rolagem */}
          <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-2 overflow-y-auto custom-scrollbar flex flex-col justify-between flex-1 min-h-0 bg-[#cad4e6] dark:bg-stone-900">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4 items-stretch flex-1 min-h-0">
              
              {/* ============================================================== */}
              {/* COLUNA 1: IDENTIFICAÇÃO */}
              {/* ============================================================== */}
              <div className="p-3 sm:p-3.5 bg-slate-50/70 dark:bg-stone-800/40 rounded-xl border border-slate-300 dark:border-stone-700/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-800 dark:text-stone-200 uppercase tracking-wider pb-1 mb-1.5 border-b border-slate-300 dark:border-stone-700">
                    <Package className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>1. IDENTIFICAÇÃO</span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Linha 1: Nome do Produto + Código Interno */}
                    <div className="grid grid-cols-12 gap-1.5 items-stretch">
                      <div className="col-span-8 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          NOME DO PRODUTO <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={nome}
                          onChange={(e) => setNome(e.target.value.toUpperCase())}
                          placeholder="EX: ÓLEO DIESEL S10, PNEU 295/80..."
                          className="w-full h-7.5 px-2 py-1 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none transition uppercase"
                        />
                      </div>

                      <div className="col-span-4 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          CÓDIGO INTERNO
                        </label>
                        <input
                          type="text"
                          value={codigoInterno}
                          onChange={(e) => setCodigoInterno(e.target.value.toUpperCase())}
                          placeholder="PRD-001"
                          className="w-full h-7.5 px-2 py-1 text-xs font-mono font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition uppercase"
                        />
                      </div>
                    </div>

                    {/* Linha 2: Categoria no Estoque */}
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400">
                          CATEGORIA NO ESTOQUE <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCategoryManagerOpen(true)}
                          className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline cursor-pointer"
                          title="Gerenciar categorias de estoque"
                        >
                          <Settings className="w-3 h-3" />
                          <span>GERENCIAR</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <select
                          id="product-form-categoria-select"
                          name="categoria"
                          disabled={false}
                          value={categoria}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__manage__') {
                              setIsCategoryManagerOpen(true);
                            } else {
                              setCategoria(val);
                            }
                          }}
                          className="flex-1 h-7.5 px-2 py-1 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer select-auto pointer-events-auto"
                        >
                          {!categories.includes(categoria) && categoria && (
                            <option value={categoria}>{categoria}</option>
                          )}
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option disabled value="">──────────</option>
                          <option value="__manage__" className="text-sky-600 font-bold">⚙️ Gerenciar categorias...</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setIsCategoryManagerOpen(true)}
                          className="h-7.5 w-7.5 flex items-center justify-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 rounded-lg transition cursor-pointer shrink-0"
                          title="Gerenciar lista de categorias"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Linha 3: Unidade de Medida + Marca */}
                    <div className="grid grid-cols-12 gap-1.5 items-stretch">
                      <div className="col-span-5 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          UNIDADE DE MEDIDA <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          list="product-form-units-list"
                          required
                          value={unidadeMedida}
                          onChange={(e) => setUnidadeMedida(e.target.value.toUpperCase())}
                          placeholder="UN, LT..."
                          className="w-full h-7.5 px-2 py-1 text-xs font-mono font-bold uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                        <datalist id="product-form-units-list">
                          <option value="UN" />
                          <option value="KG" />
                          <option value="LT" />
                          <option value="GALÃO" />
                          <option value="GL" />
                          <option value="SC" />
                          <option value="M" />
                          <option value="M2" />
                          <option value="CX" />
                          <option value="PAR" />
                          <option value="TON" />
                          <option value="ROLO" />
                          <option value="DOSES" />
                          <option value="HORAS" />
                        </datalist>
                      </div>

                      <div className="col-span-7 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          MARCA
                        </label>
                        <input
                          type="text"
                          value={marca}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setMarca(val);
                            // Redundância inteligente: caso o select de parâmetros técnicos do pneu fique vazio ou "SELECIONE...", assume a marca geral
                            if (!tireBrand || tireBrand.trim() === '' || tireBrand.toUpperCase() === 'SELECIONE...') {
                              setTireBrand(val);
                            }
                          }}
                          placeholder="EX: MICHELIN, PIRELLI..."
                          className="w-full h-7.5 px-2 py-1 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition uppercase"
                        />
                      </div>
                    </div>

                    {/* Linha 4: Cód. de Barras / GTIN (com Sem GTIN) + Ref. Fábrica */}
                    <div className="grid grid-cols-12 gap-1.5 items-stretch">
                      <div className="col-span-7 flex flex-col justify-end">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate">
                            CÓD. DE BARRAS / GTIN
                          </label>
                          <label className="inline-flex items-center space-x-1 cursor-pointer text-[10px] font-black uppercase text-stone-600 dark:text-stone-400 select-none shrink-0">
                            <input
                              type="checkbox"
                              checked={semGtin}
                              onChange={(e) => {
                                setSemGtin(e.target.checked);
                                if (e.target.checked) setCodigoBarras('');
                              }}
                              className="rounded border-stone-300 dark:border-stone-600 text-sky-600 focus:ring-sky-500 w-3 h-3 cursor-pointer"
                            />
                            <span>SEM GTIN</span>
                          </label>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-stone-400">
                            <Barcode className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={semGtin}
                            value={semGtin ? 'SEM GTIN' : codigoBarras}
                            onChange={(e) => setCodigoBarras(e.target.value.toUpperCase().replace(/\D/g, '').slice(0, 14))}
                            placeholder={semGtin ? 'SEM GTIN' : '7891234567890'}
                            className={`w-full h-7.5 pl-7 pr-2 py-1 text-xs font-mono rounded-lg border transition uppercase ${
                              semGtin 
                                ? 'bg-stone-100 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800 text-stone-400 cursor-not-allowed italic'
                                : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="col-span-5 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          REF. FÁBRICA
                        </label>
                        <input
                          type="text"
                          value={refFabrica}
                          onChange={(e) => setRefFabrica(e.target.value.toUpperCase())}
                          placeholder="EX: 2AT-06"
                          className="w-full h-7.5 px-2 py-1 text-xs font-mono font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition uppercase"
                        />
                      </div>
                    </div>

                    {/* ============================================================== */}
                    {/* BLOCO DINÂMICO CONDICIONAL: PARÂMETROS TÉCNICOS DO PNEU        */}
                    {/* (Visível apenas se Categoria == 'Pneus')                       */}
                    {/* ============================================================== */}
                    {isPneuCategory && (
                      <div className="mt-1 p-2 rounded-lg border border-rose-300 dark:border-rose-900/80 bg-rose-50/70 dark:bg-rose-950/30 space-y-1.5 transition-all animate-in fade-in duration-150 shadow-2xs">
                        <div className="flex items-center justify-between pb-0.5 border-b border-rose-200/90 dark:border-rose-900/60">
                          <div className="flex items-center space-x-1.5 text-[10.5px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                            <CircleDot className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>Parâmetros Técnicos do Pneu</span>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-200/70 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                            Gestão de Frotas
                          </span>
                        </div>

                        {/* Linha 1: [Nome: Nº de Fogo / Matrícula *] (Marca herdada automaticamente de 1. IDENTIFICAÇÃO) */}
                        <div className="grid grid-cols-12 gap-1.5">
                          <div className="col-span-12 flex flex-col justify-end">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-0.5 truncate">
                              Nº de Fogo / Matrícula <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={tireFireNumber}
                              onChange={(e) => setTireFireNumber(e.target.value.toUpperCase())}
                              placeholder="EX: #0920 OU P-115"
                              required={isPneuCategory}
                              className="w-full h-7.5 px-2 py-1 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition uppercase"
                            />
                          </div>
                        </div>

                        {/* Linha 2: [Nome: Modelo da Banda] | [Nome: Medida / Dimensão] */}
                        <div className="grid grid-cols-12 gap-1.5">
                          <div className="col-span-6 flex flex-col justify-end">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-0.5 truncate">
                              Modelo da Banda
                            </label>
                            <input
                              type="text"
                              value={tireModel}
                              onChange={(e) => setTireModel(e.target.value.toUpperCase())}
                              placeholder="EX: X MULTI Z / KMAX"
                              className="w-full h-7.5 px-2 py-1 text-xs rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition uppercase"
                            />
                          </div>
                          <div className="col-span-6 flex flex-col justify-end">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-0.5 truncate">
                              Medida / Dimensão
                            </label>
                            <input
                              type="text"
                              value={tireSize}
                              onChange={(e) => {
                                const masked = applyTireSizeMask(e.target.value.toUpperCase(), tireSize);
                                setTireSize(masked.toUpperCase());
                              }}
                              placeholder="EX: 295/80 R 22.5"
                              maxLength={16}
                              className="w-full h-7.5 px-2 py-1 text-xs rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition font-mono font-bold uppercase"
                            />
                          </div>
                        </div>

                        {/* Linha 3: [Nome: Sulco Atual (mm) *] | [Seletor: Recapagens] | [Nome: Pressão (PSI)] */}
                        <div className="grid grid-cols-12 gap-1.5">
                          <div className="col-span-4 flex flex-col justify-end">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-0.5 truncate">
                              Sulco Atual (mm) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="30"
                              value={tireTreadDepthMm}
                              onChange={(e) => setTireTreadDepthMm(e.target.value)}
                              placeholder="12.0"
                              required={isPneuCategory}
                              className="w-full h-7.5 px-2 py-1 text-xs font-black text-rose-700 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 outline-none focus:ring-2 focus:ring-rose-500 transition"
                            />
                          </div>
                          <div className="col-span-4 flex flex-col justify-end">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-0.5 truncate">
                              Recapagens
                            </label>
                            <select
                              value={tireRetreadCount}
                              onChange={(e) => setTireRetreadCount(parseInt(e.target.value) || 0)}
                              className="w-full h-7.5 px-1.5 py-1 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer transition uppercase"
                            >
                              <option value={0}>0 (Novo)</option>
                              <option value={1}>1ª Recap.</option>
                              <option value={2}>2ª Recap.</option>
                              <option value={3}>3ª Recap.</option>
                            </select>
                          </div>
                          <div className="col-span-4 flex flex-col justify-end">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-0.5 truncate">
                              Pressão (PSI)
                            </label>
                            <input
                              type="number"
                              value={tirePressurePsi}
                              onChange={(e) => setTirePressurePsi(e.target.value)}
                              placeholder="110"
                              className="w-full h-7.5 px-2 py-1 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition"
                            />
                          </div>
                        </div>

                        {/* Linha 4: KM Rodado Estimado e Observações do Pneu Lado a Lado */}
                        <div className="grid grid-cols-12 gap-1.5">
                          <div className="col-span-5 flex flex-col justify-end">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-0.5 truncate">
                              KM Estimado
                            </label>
                            <input
                              type="number"
                              value={tireCurrentKm}
                              onChange={(e) => setTireCurrentKm(e.target.value)}
                              placeholder="0"
                              className="w-full h-7.5 px-2 py-1 text-xs rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition"
                            />
                          </div>
                          <div className="col-span-7 flex flex-col justify-end">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-stone-400 mb-0.5 truncate">
                              Observações do Pneu
                            </label>
                            <input
                              type="text"
                              value={tireNotes}
                              onChange={(e) => setTireNotes(e.target.value.toUpperCase())}
                              placeholder="EX: PNEU NOVO ADQUIRIDO NA NF..."
                              className="w-full h-7.5 px-2 py-1 text-xs rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition uppercase"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ============================================================== */}
              {/* COLUNA 2: FISCAL E VALORES */}
              {/* ============================================================== */}
              <div className="p-3 sm:p-3.5 bg-slate-50/70 dark:bg-stone-800/40 rounded-xl border border-slate-300 dark:border-stone-700/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-300 dark:border-stone-700">
                    <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-800 dark:text-stone-200 uppercase tracking-wider">
                      <Receipt className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>2. FISCAL E VALORES</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-stone-400 font-semibold font-mono">R$ #.##0,00</span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Linha 1: Código NCM + Grupo Fiscal */}
                    <div className="grid grid-cols-12 gap-1.5 items-stretch">
                      <div className="col-span-5 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          CÓDIGO NCM
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={codigoNcm}
                          onChange={(e) => handleNcmChange(e.target.value)}
                          placeholder="0000.00.00"
                          maxLength={10}
                          className="w-full h-7.5 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition uppercase"
                        />
                      </div>

                      <div className="col-span-7 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          GRUPO FISCAL
                        </label>
                        <select
                          value={grupoFiscal}
                          onChange={(e) => setGrupoFiscal(e.target.value as any)}
                          className="w-full h-7.5 px-2 py-1 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer uppercase"
                        >
                          <option value="TRIBUTADO">TRIBUTADO</option>
                          <option value="SUBSTITUICAO">SUBSTITUICAO</option>
                          <option value="ISENTO">ISENTO</option>
                        </select>
                      </div>
                    </div>

                    {/* Linha 2: Grupo IPI */}
                    <div className="flex flex-col justify-end">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                        GRUPO IPI
                      </label>
                      <select
                        value={grupoIpi}
                        onChange={(e) => setGrupoIpi(e.target.value as any)}
                        className="w-full h-7.5 px-2 py-1 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer uppercase"
                      >
                        <option value="NAO TRIBUTADO">NAO TRIBUTADO</option>
                        <option value="TRIBUTADO">TRIBUTADO</option>
                      </select>
                    </div>

                    {/* Composição de Custos do XML (Apenas Leitura) */}
                    <div className="pt-1.5 pb-1 border-t border-stone-200/80 dark:border-stone-700/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center space-x-1">
                          <Receipt className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>COMPOSIÇÃO DE CUSTOS DO XML</span>
                        </span>
                        {freteDiluidoItem > 0 && (
                          <span className="text-[9.5px] font-bold uppercase text-stone-500 dark:text-stone-400">
                            FRETE: R$ {formatCurrencyPtBr(freteDiluidoItem)}/UN
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 1. Valor Total de Impostos (R$) */}
                        <div className="flex flex-col justify-end">
                          <label 
                            className="block text-[10.5px] font-bold uppercase text-stone-700 dark:text-stone-300 truncate mb-0.5"
                            title="Soma de ICMS, IPI, PIS, COFINS, IBS e CBS"
                          >
                            IMPOSTOS (R$)
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-stone-400 dark:text-stone-500 font-bold text-xs">
                              R$
                            </div>
                            <input
                              type="text"
                              disabled
                              readOnly
                              value={formatCurrencyPtBr(valorImpostosTotal)}
                              className="w-full h-7.5 pl-7 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100/90 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 cursor-not-allowed select-all"
                            />
                          </div>
                        </div>

                        {/* 2. Custo Líquido (Sem Imposto) (R$) */}
                        <div className="flex flex-col justify-end">
                          <label 
                            className="block text-[10.5px] font-bold uppercase text-stone-700 dark:text-stone-300 truncate mb-0.5"
                            title="Valor do produto subtraindo os impostos"
                          >
                            CUSTO LÍQ. (R$)
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-stone-400 dark:text-stone-500 font-bold text-xs">
                              R$
                            </div>
                            <input
                              type="text"
                              disabled
                              readOnly
                              value={formatCurrencyPtBr(custoSemImposto)}
                              className="w-full h-7.5 pl-7 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100/90 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 cursor-not-allowed select-all"
                            />
                          </div>
                        </div>

                        {/* 3. Custo Real (Com Imposto + Frete) (R$) */}
                        <div className="flex flex-col justify-end">
                          <label 
                            className="block text-[10.5px] font-bold uppercase text-sky-800 dark:text-sky-300 truncate mb-0.5"
                            title="Custo Nominal real base para margem"
                          >
                            CUSTO REAL (R$)
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-sky-600 dark:text-sky-400 font-bold text-xs">
                              R$
                            </div>
                            <input
                              type="text"
                              disabled
                              readOnly
                              value={formatCurrencyPtBr(custoComImposto)}
                              className="w-full h-7.5 pl-7 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-sky-300/80 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 cursor-not-allowed select-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Linha 3: Custo Nominal (R$) + Preço de Venda Sugerido (R$) */}
                    <div className="grid grid-cols-12 gap-1.5 items-stretch">
                      <div className="col-span-6 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          CUSTO NOMINAL (R$)
                          {custoComImposto > 0 && (
                            <span className="ml-1 text-[9px] font-bold uppercase text-sky-600 dark:text-sky-400">
                              (BASE REAL)
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-stone-500 font-bold text-xs">
                            R$
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={custoNominalDisplay}
                            onChange={(e) => handleCustoChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full h-7.5 pl-7 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                        </div>
                      </div>

                      <div className="col-span-6 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          PREÇO DE VENDA (R$)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                            R$
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={precoVendaDisplay}
                            onChange={(e) => handlePrecoVendaChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full h-7.5 pl-7 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linha 4: Margem de Lucro Sugerida (%) */}
                    <div className="flex flex-col justify-end">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 mb-0.5">
                        MARGEM DE LUCRO SUGERIDA (%)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={margemLucroSugerida}
                          onChange={(e) => handleMargemChange(e.target.value)}
                          placeholder="Ex: 30"
                          className="w-full h-7.5 pr-6 pl-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                        <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-stone-400 font-bold text-xs">
                          %
                        </div>
                      </div>
                    </div>

                    {/* Linha 5: Atacado (% Desconto e Valor de Atacado) */}
                    <div className="grid grid-cols-12 gap-1.5 items-stretch">
                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate" title="% Desconto Máximo Atacado">
                            % DESCONTO ATACADO
                          </label>
                          <span className="text-[9px] font-black uppercase text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.2 rounded">
                            % DESCONTO MAX ATAC.
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={porcentagemAtacado}
                            onChange={(e) => handlePorcentagemAtacadoChange(e.target.value)}
                            placeholder="Ex: 15"
                            className="w-full h-7.5 pr-6 pl-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                            %
                          </div>
                        </div>
                      </div>

                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate" title="Valor de Atacado">
                            VALOR DE ATACADO
                          </label>
                          <span className="text-[9px] font-black uppercase text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.2 rounded">
                            V. ATAC.
                          </span>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                            R$
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={valorAtacadoDisplay}
                            onChange={(e) => handleValorAtacadoChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full h-7.5 pl-7 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linha 6: Promoção (% Desconto e Valor Promocional) */}
                    <div className="grid grid-cols-12 gap-1.5 items-stretch">
                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate" title="% Desconto Promoção">
                            % DESCONTO PROMOÇÃO
                          </label>
                          <span className="text-[9px] font-black uppercase text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.2 rounded">
                            % PROMO.
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={porcentagemPromo}
                            onChange={(e) => handlePorcentagemPromoChange(e.target.value)}
                            placeholder="Ex: 10"
                            className="w-full h-7.5 pr-6 pl-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-orange-600 dark:text-orange-400 font-bold text-xs">
                            %
                          </div>
                        </div>
                      </div>

                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate" title="Valor Promocional">
                            VALOR PROMOCIONAL
                          </label>
                          <span className="text-[9px] font-black uppercase text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.2 rounded">
                            V. PROMO
                          </span>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-orange-600 dark:text-orange-400 font-bold text-xs">
                            R$
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={valorPromoDisplay}
                            onChange={(e) => handleValorPromoChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full h-7.5 pl-7 pr-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================== */}
              {/* COLUNA 3: CONTROLE E ALMOXARIFADO */}
              {/* ============================================================== */}
              <div className="p-3 sm:p-3.5 bg-slate-50/70 dark:bg-stone-800/40 rounded-xl border border-slate-300 dark:border-stone-700/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-300 dark:border-stone-700">
                    <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-800 dark:text-stone-200 uppercase tracking-wider">
                      <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>3. CONTROLE E ALMOXARIFADO</span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-stone-400 font-bold uppercase">SALDO & LOCAL</span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Linha 1: Quantidade Inicial + Estoque Mínimo (2 Colunas) */}
                    <div className="grid grid-cols-12 gap-1.5 items-stretch">
                      <div className="col-span-6 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          QTD. INICIAL ({unidadeMedida || 'UN'})
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={quantidadeAtual}
                          onChange={(e) => setQuantidadeAtual(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0"
                          className="w-full h-7.5 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>

                      <div className="col-span-6 flex flex-col justify-end">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400 truncate mb-0.5">
                          ESTOQUE MÍNIMO
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={minQuantity}
                          onChange={(e) => setMinQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0"
                          className="w-full h-7.5 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    {/* Linha 2: Endereçamento no Almoxarifado / Gôndola (5 Campos Menores) */}
                    <div className="pt-0.5 border-t border-stone-200/80 dark:border-stone-700/60">
                      <div className="flex items-center justify-between mb-1">
                        <label className="flex items-center space-x-1 text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400">
                          <MapPin className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>ENDEREÇAMENTO FÍSICO</span>
                        </label>
                        <span className="text-[9px] font-black uppercase text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1 py-0.2 rounded">
                          GÔNDOLA / PRATELEIRA
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1">
                        {/* 1. Setor */}
                        <div className="flex flex-col">
                          <label className="block text-[9px] font-black uppercase text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Setor">
                            SETOR
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={setor}
                            onChange={(e) => setSetor(e.target.value.toUpperCase())}
                            onBlur={(e) => setSetor(formatEnderecoPart(e.target.value))}
                            placeholder="02"
                            className="w-full h-7 px-1 py-0.5 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Setor do Almoxarifado"
                          />
                        </div>

                        {/* 2. Rua */}
                        <div className="flex flex-col">
                          <label className="block text-[9px] font-black uppercase text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Rua">
                            RUA
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={rua}
                            onChange={(e) => setRua(e.target.value.toUpperCase())}
                            onBlur={(e) => setRua(formatEnderecoPart(e.target.value))}
                            placeholder="05"
                            className="w-full h-7 px-1 py-0.5 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Rua / Corredor"
                          />
                        </div>

                        {/* 3. Estante */}
                        <div className="flex flex-col">
                          <label className="block text-[9px] font-black uppercase text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Estante">
                            ESTANTE
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={estante}
                            onChange={(e) => setEstante(e.target.value.toUpperCase())}
                            onBlur={(e) => setEstante(formatEnderecoPart(e.target.value))}
                            placeholder="08"
                            className="w-full h-7 px-1 py-0.5 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Estante / Módulo"
                          />
                        </div>

                        {/* 4. Nível */}
                        <div className="flex flex-col">
                          <label className="block text-[9px] font-black uppercase text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Nível">
                            NÍVEL
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={nivel}
                            onChange={(e) => setNivel(e.target.value.toUpperCase())}
                            onBlur={(e) => setNivel(formatEnderecoPart(e.target.value))}
                            placeholder="07"
                            className="w-full h-7 px-1 py-0.5 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Nível / Prateleira"
                          />
                        </div>

                        {/* 5. Box */}
                        <div className="flex flex-col">
                          <label className="block text-[9px] font-black uppercase text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Box">
                            BOX
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={box}
                            onChange={(e) => setBox(e.target.value.toUpperCase())}
                            onBlur={(e) => setBox(formatEnderecoPart(e.target.value))}
                            placeholder="02"
                            className="w-full h-7 px-1 py-0.5 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Box / Gaveta / Vão"
                          />
                        </div>
                      </div>

                      {/* Caixa de Endereço Formatado Calculado Automaticamente - Achatada Slim */}
                      <div className="mt-1 py-1 px-2.5 rounded-lg bg-stone-900 dark:bg-stone-950 border border-stone-800 text-white flex items-center justify-between shadow-inner">
                        <div className="flex items-center space-x-1.5">
                          <Barcode className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="text-[9px] font-black uppercase text-stone-400 tracking-wider">
                            ENDEREÇO FORMATADO:
                          </span>
                        </div>
                        <div className="text-xs font-black font-mono tracking-widest text-emerald-400">
                          {enderecoFormatado || '00.00.00.00.00'}
                        </div>
                        <span className="text-[8px] font-black uppercase text-stone-400 tracking-wider hidden sm:inline">
                          SET.RUA.EST.NÍV.BOX
                        </span>
                      </div>
                    </div>

                    {/* Linha 3 (Dinâmica): Capacidade do Galão (L) */}
                    {showGallonCapacity && (
                      <div className="flex flex-col justify-end animate-in fade-in duration-150 pt-0.5 border-t border-stone-200/80 dark:border-stone-700/60">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="flex items-center space-x-1 text-xs font-bold uppercase text-sky-700 dark:text-sky-300">
                            <Droplets className="w-3 h-3 text-sky-500 shrink-0" />
                            <span>CAPACIDADE DO GALÃO (L)</span>
                          </label>
                          <span className="text-[9px] text-sky-600 dark:text-sky-400 font-bold uppercase">AUTOMÁTICO</span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          value={capacidadeGalao}
                          onChange={(e) => setCapacidadeGalao(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ex: 20"
                          className="w-full h-7.5 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-sky-400 dark:border-sky-600 bg-sky-50/50 dark:bg-sky-950/30 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>
                    )}

                    {/* Central de Upload e Visualização da Foto do Produto */}
                    <div className="pt-2 border-t border-stone-200/80 dark:border-stone-700/60">
                      <div className="flex items-center justify-between mb-1">
                        <label className="flex items-center space-x-1 text-[11px] font-bold uppercase text-slate-600 dark:text-stone-400">
                          <Camera className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>FOTO DO PRODUTO</span>
                        </label>
                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-stone-400">
                          CATÁLOGO & PDV
                        </span>
                      </div>

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleImageUpload(e.dataTransfer.files[0]);
                          }
                        }}
                        className="w-full h-[220px] border-2 border-dashed border-slate-300 rounded bg-slate-50 flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-slate-100/80 transition-all select-none group relative overflow-hidden"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageUpload(e.target.files[0]);
                            }
                          }}
                        />

                        {fotoBase64 ? (
                          <div className="w-full h-full relative flex items-center justify-center">
                            <img
                              src={fotoBase64}
                              alt="Foto do Produto"
                              className="w-full h-full object-contain object-center rounded"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFotoBase64('');
                                if (fileInputRef.current) fileInputRef.current.value = '';
                              }}
                              className="text-[9px] font-bold uppercase p-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-sm absolute top-2 right-2 cursor-pointer z-10"
                              title="Remover Foto"
                            >
                              ✕ REMOVER FOTO
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center">
                            <Camera className="text-slate-400 size-8 group-hover:text-blue-500 transition-colors" />
                            <span className="text-[11px] font-bold text-slate-500 mt-2">
                              📸 CLIQUE OU ARRASTE A FOTO DO PRODUTO AQUI
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
                              FORMATOS ACEITOS: JPG, PNG • MÁXIMO 1MB
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Compacto do Modal com Botão de Imprimir Etiqueta */}
            <div className="pt-2 border-t border-slate-300 dark:border-stone-800 flex items-center justify-between gap-2 shrink-0">
              {/* Botão de Impressão de Etiquetas à esquerda */}
              <button
                type="button"
                onClick={() => setIsLabelPrintModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold uppercase text-slate-800 dark:text-stone-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 hover:bg-slate-100 dark:from-stone-800 dark:to-stone-900 border border-slate-300 dark:border-stone-700 shadow-[inset_0_1px_0px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.05)] rounded-xl transition flex items-center space-x-1.5 cursor-pointer active:scale-95"
                title="Imprimir Etiqueta de Gôndola / Almoxarifado com Código de Barras e Endereço"
              >
                <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>IMPRIMIR ETIQUETA</span>
              </button>

              {/* Botões Cancelar e Salvar à direita */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold uppercase text-slate-700 dark:text-stone-300 bg-gradient-to-b from-white via-slate-50 to-slate-100 hover:bg-slate-100 dark:from-stone-800 dark:to-stone-900 border border-slate-300 dark:border-stone-700 shadow-[inset_0_1px_0px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.05)] rounded-xl transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  CANCELAR
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 text-xs font-bold uppercase text-white bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 border border-emerald-400/80 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] rounded-xl transition flex items-center space-x-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>SALVANDO NO SUPABASE...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>SALVAR PRODUTO NO ESTOQUE</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>

      {/* Sub-modal: Gerenciar Categorias de Estoque */}
      {isCategoryManagerOpen && (
        <CategoryOptionsManagerModal
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          title="Gerenciar Categorias de Estoque"
          defaultItems={DEFAULT_INVENTORY_CATEGORIES}
          items={categories}
          onSaveItems={(newCategories) => {
            saveStoredInventoryCategories(newCategories);
            const fresh = getStoredInventoryCategories();
            setCategories(fresh);
            if (!fresh.includes(categoria)) {
              setCategoria(fresh[0] || 'Outros Insumos');
            }
          }}
          zIndexClass="z-[9999]"
        />
      )}

      {/* Sub-modal: Impressão de Etiquetas de Gôndola */}
      {isLabelPrintModalOpen && (
        <ProductLabelPrintModal
          isOpen={isLabelPrintModalOpen}
          onClose={() => setIsLabelPrintModalOpen(false)}
          product={currentProductForPrint}
          zIndexClass="z-[9999]"
        />
      )}
    </>
  );
};
