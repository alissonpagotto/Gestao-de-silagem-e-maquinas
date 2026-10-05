import React, { useState, useEffect, useMemo } from 'react';
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
  CircleDot
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

export const TIRE_BRAND_OPTIONS = [
  'Michelin',
  'Pirelli',
  'Bridgestone',
  'Goodyear',
  'Firestone',
  'Continental',
  'Dunlop',
  'Trelleborg',
  'Alliance',
  'Outro',
];

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

      const initialName = initialData?.nome_comercial || initialData?.name || initialData?.nome || '';
      setNome(initialName);

      const rawCat = (initialData?.category || initialData?.categoria || '').trim();
      let normalizedCat = rawCat;
      const c = rawCat.toLowerCase();
      if (c.includes('pneu')) normalizedCat = 'Pneus';
      else if (c.includes('combust') || c.includes('diesel') || c.includes('arla')) normalizedCat = 'Combustível & Arla';
      else if (c.includes('lona') || c.includes('embalag') || c.includes('filme')) normalizedCat = 'Lona & Embalagem';
      else if (c.includes('inocul') || c.includes('biol')) normalizedCat = 'Inoculante & Biológico';
      else if (c.includes('sement') || c.includes('milho') || c.includes('sorgo') || c.includes('soja')) normalizedCat = 'Sementes';
      else if (c.includes('adubo') || c.includes('fertiliz') || c.includes('ureia') || c.includes('npk')) normalizedCat = 'Adubo & Fertilizante';
      else if (c.includes('peca') || c.includes('peça') || c.includes('manuten') || c.includes('filtro') || c.includes('faca') || c.includes('oleo') || c.includes('óleo')) normalizedCat = 'Peças & Manutenção';
      else if (c.includes('outro')) normalizedCat = 'Outros Insumos';

      const matchedCat = storedCats.find(cat => cat.toLowerCase() === (normalizedCat || '').toLowerCase());
      const initialCat = matchedCat || (normalizedCat && storedCats.includes(normalizedCat) ? normalizedCat : (storedCats[0] || 'Outros Insumos'));
      setCategoria(initialCat);

      const initialUnit = (initialData?.unit || initialData?.unidade_medida || 'UN').toUpperCase();
      setUnidadeMedida(initialUnit);

      setMarca(initialData?.brand || initialData?.marca || '');

      const initialNoGtin = Boolean(initialData?.hasNoGtin ?? initialData?.sem_gtin ?? (initialData?.barcode === 'SEM GTIN'));
      setSemGtin(initialNoGtin);

      const initialBar = initialNoGtin ? '' : (initialData?.barcode || initialData?.codigo_barras || '');
      setCodigoBarras(initialBar);

      setRefFabrica(initialData?.factoryRef || initialData?.ref_fabrica || '');
      setCodigoInterno(initialData?.code || (initialData as any)?.codigo_produto || '');

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
      const initialNivel = initialData?.estoque_nivel || initialData?.nivel || '';
      const initialBox = initialData?.estoque_box || initialData?.box || '';

      const rawAddr = (initialData?.endereco_formatado || initialData?.localizacao_fisica || initialData?.location || '').trim();
      if (!initialSetor && !initialRua && rawAddr && rawAddr.includes('.')) {
        const splitted = rawAddr.split('.');
        setSetor(splitted[0] || '');
        setRua(splitted[1] || '');
        setEstante(splitted[2] || '');
        setNivel(splitted[3] || '');
        setBox(splitted[4] || '');
      } else {
        setSetor(initialSetor);
        setRua(initialRua);
        setEstante(initialEstante);
        setNivel(initialNivel);
        setBox(initialBox);
      }

      const initialGallonCap = initialData?.gallonSizeLiters ?? initialData?.volume_litros_embalagem;
      setCapacidadeGalao(initialGallonCap !== undefined && initialGallonCap !== null ? Number(initialGallonCap) : 20);

      // Inicialização dos parâmetros técnicos do pneu (Gestão de Frotas)
      const tireParams = initialData?.tireParameters;
      const initialFire = tireParams?.fireNumber || initialData?.fireNumber || '';
      const initialTireBrand = tireParams?.brand || initialData?.brand || initialData?.marca || '';
      const initialTireModel = tireParams?.model || initialData?.tireModel || '';
      const initialTireSize = tireParams?.size || initialData?.tireSize || '';
      const initialTread = tireParams?.treadDepthMm ?? initialData?.treadDepthMm ?? 12.0;
      const initialRetread = tireParams?.retreadCount ?? initialData?.retreadCount ?? 0;
      const initialPressure = tireParams?.pressurePsi ?? initialData?.pressurePsi ?? 110;
      const initialKm = tireParams?.currentKm ?? initialData?.currentKm ?? '';
      const initialTireNotes = tireParams?.notes || initialData?.tireNotes || '';

      setTireFireNumber(initialFire);
      setTireBrand(initialTireBrand);
      setTireModel(initialTireModel);
      setTireSize(initialTireSize);
      setTireTreadDepthMm(String(initialTread));
      setTireRetreadCount(initialRetread);
      setTirePressurePsi(String(initialPressure));
      setTireCurrentKm(initialKm !== '' ? String(initialKm) : '');
      setTireNotes(initialTireNotes);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  // Gerenciamento de NCM com máscara 0000.00.00
  const handleNcmChange = (raw: string) => {
    setCodigoNcm(formatNcmMask(raw));
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

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
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
        unit: unidadeMedida.trim() || 'UN',
        unidade_medida: unidadeMedida.trim() || 'UN',
        brand: marca.trim() || undefined,
        marca: marca.trim() || undefined,
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
        // Parâmetros Técnicos do Pneu (Gestão de Frotas)
        tireParameters: isPneuCategory ? {
          fireNumber: tireFireNumber.trim(),
          brand: tireBrand.trim() || marca.trim() || 'Michelin',
          model: tireModel.trim() || undefined,
          size: tireSize.trim() || undefined,
          treadDepthMm: parseFloat(tireTreadDepthMm) || 12.0,
          originalTreadDepthMm: 18.0,
          retreadCount: tireRetreadCount,
          pressurePsi: parseFloat(tirePressurePsi) || 110,
          currentKm: parseFloat(tireCurrentKm) || 0,
          notes: tireNotes.trim() || undefined,
        } : undefined,
        fireNumber: isPneuCategory ? tireFireNumber.trim() : undefined,
        treadDepthMm: isPneuCategory ? (parseFloat(tireTreadDepthMm) || 12.0) : undefined,
        originalTreadDepthMm: isPneuCategory ? 18.0 : undefined,
        retreadCount: isPneuCategory ? tireRetreadCount : undefined,
        pressurePsi: isPneuCategory ? (parseFloat(tirePressurePsi) || 110) : undefined,
        currentKm: isPneuCategory ? (parseFloat(tireCurrentKm) || 0) : undefined,
        tireModel: isPneuCategory ? (tireModel.trim() || undefined) : undefined,
        tireSize: isPneuCategory ? (tireSize.trim() || undefined) : undefined,
        tireNotes: isPneuCategory ? (tireNotes.trim() || undefined) : undefined,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await cadastrarProduto(newProduct, companyId);

      // Sincronização automática com a Frota (Pneus Disponíveis - Estoque)
      if (isPneuCategory && tireFireNumber.trim()) {
        try {
          const currentTireInv = getStoredTireInventory();
          const cleanFire = tireFireNumber.trim();
          const existingIdx = currentTireInv.findIndex(
            (t) => (t.fireNumber || '').trim().toLowerCase() === cleanFire.toLowerCase() || t.id === `tire_${prodId}`
          );

          const tireItemToSave: TireItem = {
            id: existingIdx >= 0 ? currentTireInv[existingIdx].id : `tire_inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            position: 'estoque',
            positionName: 'Estoque / Disponível',
            fireNumber: cleanFire,
            brand: tireBrand.trim() || marca.trim() || 'Michelin',
            model: tireModel.trim() || cleanNome,
            size: tireSize.trim() || '295/80 R22.5',
            treadDepthMm: parseFloat(tireTreadDepthMm) || 12.0,
            originalTreadDepthMm: 18.0,
            pressurePsi: parseFloat(tirePressurePsi) || 110,
            status: 'estoque',
            retreadCount: tireRetreadCount,
            currentKm: parseFloat(tireCurrentKm) || 0,
            notes: tireNotes.trim() || undefined,
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

      onSuccess(newProduct);
      onClose();
    } catch (err: any) {
      console.error('Erro ao cadastrar produto:', err);
      setFormError('Ocorreu um erro ao salvar o produto no Supabase. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

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
      brand: marca.trim() || undefined,
      marca: marca.trim() || undefined,
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
    };
  }, [
    initialData?.id,
    codigoInterno,
    nome,
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
          className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-7xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-stone-900 dark:text-stone-100 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Header Compacto */}
          <div className="px-4 py-2.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/90 dark:bg-stone-800/60 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Package className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-white tracking-tight font-['Outfit']">
                  {initialData?.id ? 'Editar Produto no Estoque' : 'Cadastrar Novo Produto no Estoque'}
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
                  Identificação, parametrização fiscal, formação de preços e controle de almoxarifado
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isSaving) onClose();
              }}
              disabled={isSaving}
              className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800 transition cursor-pointer disabled:opacity-50"
              title="Fechar formulário"
            >
              <X className="w-4 h-4" />
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

          {/* Formulário em 3 Colunas Horizontais Paralelas */}
          <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3 overflow-y-auto max-h-[calc(90vh-60px)]">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
              
              {/* ============================================================== */}
              {/* COLUNA 1: IDENTIFICAÇÃO */}
              {/* ============================================================== */}
              <div className="p-3 bg-stone-50/80 dark:bg-stone-800/40 rounded-xl border border-stone-200/90 dark:border-stone-700/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-[11px] font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider pb-1.5 mb-2 border-b border-stone-200/80 dark:border-stone-700/60">
                    <Package className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>1. Identificação</span>
                  </div>

                  <div className="space-y-2">
                    {/* Linha 1: Nome do Produto + Código Interno */}
                    <div className="grid grid-cols-12 gap-2 items-stretch">
                      <div className="col-span-8 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Nome do Produto <span className="text-rose-500">*</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          required
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Ex: Óleo Diesel S10, Galão Inoculante..."
                          className="w-full h-9 px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>

                      <div className="col-span-4 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Código Interno
                          </label>
                        </div>
                        <input
                          type="text"
                          value={codigoInterno}
                          onChange={(e) => setCodigoInterno(e.target.value)}
                          placeholder="PRD-001"
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    {/* Linha 2: Categoria no Estoque (com botão de gerenciar) */}
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between h-4 mb-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          Categoria no Estoque <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCategoryManagerOpen(true)}
                          className="inline-flex items-center space-x-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline cursor-pointer"
                          title="Gerenciar categorias de estoque"
                        >
                          <Settings className="w-3 h-3" />
                          <span>Gerenciar</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <select
                          value={categoria}
                          onChange={(e) => {
                            if (e.target.value === '__manage__') {
                              setIsCategoryManagerOpen(true);
                            } else {
                              setCategoria(e.target.value);
                            }
                          }}
                          className="flex-1 h-9 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer"
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option disabled value="">──────────</option>
                          <option value="__manage__" className="text-sky-600 font-bold">⚙️ Gerenciar categorias...</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setIsCategoryManagerOpen(true)}
                          className="h-9 w-9 flex items-center justify-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 rounded-lg transition cursor-pointer shrink-0"
                          title="Gerenciar lista de categorias"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Linha 3: Unidade de Medida + Marca */}
                    <div className="grid grid-cols-12 gap-2 items-stretch">
                      <div className="col-span-5 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Unidade de Medida <span className="text-rose-500">*</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          list="product-form-units-list"
                          required
                          value={unidadeMedida}
                          onChange={(e) => setUnidadeMedida(e.target.value.toUpperCase())}
                          placeholder="UN, LT, GALÃO..."
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-mono font-bold uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
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
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Marca
                          </label>
                        </div>
                        <input
                          type="text"
                          value={marca}
                          onChange={(e) => setMarca(e.target.value)}
                          placeholder="Ex: Pirelli, Bosch, Ipiranga..."
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    {/* Linha 4: Cód. de Barras / GTIN (com Sem GTIN) + Ref. Fábrica */}
                    <div className="grid grid-cols-12 gap-2 items-stretch">
                      <div className="col-span-7 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Cód. de Barras / GTIN
                          </label>
                          <label className="inline-flex items-center space-x-1 cursor-pointer text-[10px] font-bold text-stone-600 dark:text-stone-400 select-none shrink-0">
                            <input
                              type="checkbox"
                              checked={semGtin}
                              onChange={(e) => {
                                setSemGtin(e.target.checked);
                                if (e.target.checked) setCodigoBarras('');
                              }}
                              className="rounded border-stone-300 dark:border-stone-600 text-sky-600 focus:ring-sky-500 w-3 h-3 cursor-pointer"
                            />
                            <span>Sem GTIN</span>
                          </label>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-stone-400">
                            <Barcode className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={semGtin}
                            value={semGtin ? 'SEM GTIN' : codigoBarras}
                            onChange={(e) => setCodigoBarras(e.target.value.replace(/\D/g, '').slice(0, 14))}
                            placeholder={semGtin ? 'Sem GTIN' : '7891234567890'}
                            className={`w-full h-9 pl-8 pr-2.5 py-1.5 text-xs font-mono rounded-lg border transition ${
                              semGtin 
                                ? 'bg-stone-100 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800 text-stone-400 cursor-not-allowed italic'
                                : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="col-span-5 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Ref. Fábrica
                          </label>
                        </div>
                        <input
                          type="text"
                          value={refFabrica}
                          onChange={(e) => setRefFabrica(e.target.value)}
                          placeholder="Ex: 2AT-06"
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    {/* ============================================================== */}
                    {/* BLOCO DINÂMICO CONDICIONAL: PARÂMETROS TÉCNICOS DO PNEU        */}
                    {/* (Visível apenas se Categoria == 'Pneus')                       */}
                    {/* ============================================================== */}
                    {isPneuCategory && (
                      <div className="mt-3 p-3 rounded-xl border border-rose-300 dark:border-rose-900/80 bg-rose-50/70 dark:bg-rose-950/30 space-y-2.5 transition-all animate-in fade-in duration-200 shadow-2xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-rose-200/90 dark:border-rose-900/60">
                          <div className="flex items-center space-x-1.5 text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                            <CircleDot className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>Parâmetros Técnicos do Pneu</span>
                          </div>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-200/70 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                            Gestão de Frotas
                          </span>
                        </div>

                        {/* Linha 1: [Nome: Nº de Fogo / Matrícula *] | [Seletor: Marca (Dropdown)] */}
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-6 flex flex-col justify-end">
                            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1 truncate">
                              Nº de Fogo / Matrícula <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={tireFireNumber}
                              onChange={(e) => setTireFireNumber(e.target.value)}
                              placeholder="Ex: #0920 ou P-115"
                              required={isPneuCategory}
                              className="w-full h-8 px-2.5 py-1 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition"
                            />
                          </div>
                          <div className="col-span-6 flex flex-col justify-end">
                            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1 truncate">
                              Marca
                            </label>
                            <select
                              value={tireBrand}
                              onChange={(e) => {
                                setTireBrand(e.target.value);
                                if (!marca) setMarca(e.target.value);
                              }}
                              className="w-full h-8 px-2 py-1 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer transition"
                            >
                              <option value="">Selecione a Marca...</option>
                              {TIRE_BRAND_OPTIONS.map((b) => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Linha 2: [Nome: Modelo da Banda] | [Nome: Medida / Dimensão] */}
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-6 flex flex-col justify-end">
                            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1 truncate">
                              Modelo da Banda
                            </label>
                            <input
                              type="text"
                              value={tireModel}
                              onChange={(e) => setTireModel(e.target.value)}
                              placeholder="Ex: X Multi Z / KMAX"
                              className="w-full h-8 px-2.5 py-1 text-xs rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition"
                            />
                          </div>
                          <div className="col-span-6 flex flex-col justify-end">
                            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1 truncate">
                              Medida / Dimensão
                            </label>
                            <input
                              type="text"
                              value={tireSize}
                              onChange={(e) => setTireSize(e.target.value)}
                              placeholder="Ex: 295/80 R22.5"
                              className="w-full h-8 px-2.5 py-1 text-xs rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition"
                            />
                          </div>
                        </div>

                        {/* Linha 3: [Nome: Sulco Atual (mm) *] | [Seletor: Recapagens (0 Novo, 1, 2, 3)] | [Nome: Pressão (PSI)] */}
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4 flex flex-col justify-end">
                            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1 truncate">
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
                              className="w-full h-8 px-2 py-1 text-xs font-black text-rose-700 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 outline-none focus:ring-2 focus:ring-rose-500 transition"
                            />
                          </div>
                          <div className="col-span-4 flex flex-col justify-end">
                            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1 truncate">
                              Recapagens
                            </label>
                            <select
                              value={tireRetreadCount}
                              onChange={(e) => setTireRetreadCount(parseInt(e.target.value) || 0)}
                              className="w-full h-8 px-1.5 py-1 text-xs font-semibold rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer transition"
                            >
                              <option value={0}>0 (Novo)</option>
                              <option value={1}>1ª Recap.</option>
                              <option value={2}>2ª Recap.</option>
                              <option value={3}>3ª Recap.</option>
                            </select>
                          </div>
                          <div className="col-span-4 flex flex-col justify-end">
                            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1 truncate">
                              Pressão (PSI)
                            </label>
                            <input
                              type="number"
                              value={tirePressurePsi}
                              onChange={(e) => setTirePressurePsi(e.target.value)}
                              placeholder="110"
                              className="w-full h-8 px-2 py-1 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition"
                            />
                          </div>
                        </div>

                        {/* Linha 4: [Nome: KM Rodado Estimado] */}
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                            KM Rodado Estimado
                          </label>
                          <input
                            type="number"
                            value={tireCurrentKm}
                            onChange={(e) => setTireCurrentKm(e.target.value)}
                            placeholder="0"
                            className="w-full h-8 px-2.5 py-1 text-xs rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 transition"
                          />
                        </div>

                        {/* Campo Adicional: Observações específicas do pneu */}
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                            Observações específicas do pneu
                          </label>
                          <textarea
                            value={tireNotes}
                            onChange={(e) => setTireNotes(e.target.value)}
                            rows={2}
                            placeholder="Ex: Pneu novo adquirido na nota fiscal, armazenado no estoque para substituição..."
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-rose-200 dark:border-rose-900/70 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500 resize-none transition"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ============================================================== */}
              {/* COLUNA 2: FISCAL E VALORES */}
              {/* ============================================================== */}
              <div className="p-3 bg-stone-50/80 dark:bg-stone-800/40 rounded-xl border border-stone-200/90 dark:border-stone-700/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-stone-200/80 dark:border-stone-700/60">
                    <div className="flex items-center space-x-1.5 text-[11px] font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                      <Receipt className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>2. Fiscal e Valores</span>
                    </div>
                    <span className="text-[10px] text-stone-400 font-semibold">R$ #.##0,00</span>
                  </div>

                  <div className="space-y-2">
                    {/* Linha 1: Código NCM + Grupo Fiscal */}
                    <div className="grid grid-cols-12 gap-2 items-stretch">
                      <div className="col-span-5 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Código NCM
                          </label>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={codigoNcm}
                          onChange={(e) => handleNcmChange(e.target.value)}
                          placeholder="0000.00.00"
                          maxLength={10}
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>

                      <div className="col-span-7 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Grupo Fiscal
                          </label>
                        </div>
                        <select
                          value={grupoFiscal}
                          onChange={(e) => setGrupoFiscal(e.target.value as any)}
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer"
                        >
                          <option value="TRIBUTADO">TRIBUTADO</option>
                          <option value="SUBSTITUICAO">SUBSTITUICAO</option>
                          <option value="ISENTO">ISENTO</option>
                        </select>
                      </div>
                    </div>

                    {/* Linha 2: Grupo IPI */}
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between h-4 mb-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          Grupo IPI
                        </label>
                      </div>
                      <select
                        value={grupoIpi}
                        onChange={(e) => setGrupoIpi(e.target.value as any)}
                        className="w-full h-9 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition cursor-pointer"
                      >
                        <option value="NAO TRIBUTADO">NAO TRIBUTADO</option>
                        <option value="TRIBUTADO">TRIBUTADO</option>
                      </select>
                    </div>

                    {/* Novos Campos Fiscais e Custos do XML (Apenas Leitura) */}
                    <div className="pt-2 pb-1.5 border-t border-stone-200/80 dark:border-stone-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center space-x-1">
                          <Receipt className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>Composição de Custos do XML</span>
                        </span>
                        {freteDiluidoItem > 0 && (
                          <span className="text-[9px] font-semibold text-stone-500 dark:text-stone-400">
                            Frete Diluído: R$ {formatCurrencyPtBr(freteDiluidoItem)}/un
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 1. Valor Total de Impostos (R$) */}
                        <div className="flex flex-col justify-end">
                          <div className="flex items-center justify-between h-4 mb-1">
                            <label 
                              className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 truncate"
                              title="Mostra a soma acumulada de ICMS, IPI, PIS, COFINS, IBS e CBS incidentes sobre a unidade do item"
                            >
                              Valor Total de Impostos (R$)
                            </label>
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-stone-400 dark:text-stone-500 font-bold text-xs">
                              R$
                            </div>
                            <input
                              type="text"
                              disabled
                              readOnly
                              value={formatCurrencyPtBr(valorImpostosTotal)}
                              title="Mostra a soma acumulada de ICMS, IPI, PIS, COFINS, IBS e CBS incidentes sobre a unidade do item"
                              className="w-full h-9 pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100/90 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 cursor-not-allowed select-all"
                            />
                          </div>
                        </div>

                        {/* 2. Custo Líquido (Sem Imposto) (R$) */}
                        <div className="flex flex-col justify-end">
                          <div className="flex items-center justify-between h-4 mb-1">
                            <label 
                              className="block text-[10.5px] font-bold text-stone-700 dark:text-stone-300 truncate"
                              title="Exibe o valor do produto subtraindo os impostos recuperáveis/incidentes"
                            >
                              Custo Líquido (Sem Imposto) (R$)
                            </label>
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-stone-400 dark:text-stone-500 font-bold text-xs">
                              R$
                            </div>
                            <input
                              type="text"
                              disabled
                              readOnly
                              value={formatCurrencyPtBr(custoSemImposto)}
                              title="Exibe o valor do produto subtraindo os impostos recuperáveis/incidentes"
                              className="w-full h-9 pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100/90 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 cursor-not-allowed select-all"
                            />
                          </div>
                        </div>

                        {/* 3. Custo Real (Com Imposto + Frete Diluído) (R$) */}
                        <div className="flex flex-col justify-end">
                          <div className="flex items-center justify-between h-4 mb-1">
                            <label 
                              className="block text-[10.5px] font-bold text-sky-800 dark:text-sky-300 truncate"
                              title="O Custo Nominal real que servirá de base para a margem de lucro"
                            >
                              Custo Real (Com Imposto + Frete Diluído) (R$)
                            </label>
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-sky-600 dark:text-sky-400 font-bold text-xs">
                              R$
                            </div>
                            <input
                              type="text"
                              disabled
                              readOnly
                              value={formatCurrencyPtBr(custoComImposto)}
                              title="O Custo Nominal real que servirá de base para a margem de lucro"
                              className="w-full h-9 pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-sky-300/80 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 cursor-not-allowed select-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Linha 3: Custo Nominal (R$) + Preço de Venda Sugerido (R$) */}
                    <div className="grid grid-cols-12 gap-2 items-stretch">
                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Custo Nominal (R$)
                            {custoComImposto > 0 && (
                              <span className="ml-1 text-[9px] font-semibold text-sky-600 dark:text-sky-400">
                                (Base Real XML)
                              </span>
                            )}
                          </label>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-stone-500 font-bold text-xs">
                            R$
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={custoNominalDisplay}
                            onChange={(e) => handleCustoChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full h-9 pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                        </div>
                      </div>

                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Preço de Venda Sugerido (R$)
                          </label>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                            R$
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={precoVendaDisplay}
                            onChange={(e) => handlePrecoVendaChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full h-9 pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linha 4: Margem de Lucro Sugerida (%) */}
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between h-4 mb-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          Margem de Lucro Sugerida (%)
                        </label>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={margemLucroSugerida}
                          onChange={(e) => handleMargemChange(e.target.value)}
                          placeholder="Ex: 30"
                          className="w-full h-9 pr-7 pl-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-stone-400 font-bold text-xs">
                          %
                        </div>
                      </div>
                    </div>

                    {/* Linha 5: Atacado (Porcentagem de Desconto Atacado e Valor de Atacado) */}
                    <div className="grid grid-cols-12 gap-2 items-stretch pt-0.5">
                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate" title="Porcentagem de Desconto Atacado (%) - % ATAC.">
                            % Desconto Atacado (%)
                          </label>
                          <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-1 rounded">
                            % ATAC.
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={porcentagemAtacado}
                            onChange={(e) => handlePorcentagemAtacadoChange(e.target.value)}
                            placeholder="Ex: 15"
                            className="w-full h-9 pr-7 pl-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                            %
                          </div>
                        </div>
                      </div>

                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate" title="Valor de Atacado (R$) - V. ATACADO (R$)">
                            Valor de Atacado (R$)
                          </label>
                          <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-1 rounded">
                            V. ATACADO
                          </span>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                            R$
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={valorAtacadoDisplay}
                            onChange={(e) => handleValorAtacadoChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full h-9 pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linha 6: Promoção (Porcentagem de Desconto Promoção e Valor Promocional) */}
                    <div className="grid grid-cols-12 gap-2 items-stretch pt-0.5">
                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate" title="Porcentagem de Desconto Promoção (%) - % PROMO.">
                            % Desconto Promoção (%)
                          </label>
                          <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1 rounded">
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
                            className="w-full h-9 pr-7 pl-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                          />
                          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-orange-600 dark:text-orange-400 font-bold text-xs">
                            %
                          </div>
                        </div>
                      </div>

                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate" title="Valor Promocional (R$) - V. PROMO (R$)">
                            Valor Promocional (R$)
                          </label>
                          <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1 rounded">
                            V. PROMO
                          </span>
                        </div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-orange-600 dark:text-orange-400 font-bold text-xs">
                            R$
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={valorPromoDisplay}
                            onChange={(e) => handleValorPromoChange(e.target.value)}
                            placeholder="0,00"
                            className="w-full h-9 pl-8 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
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
              <div className="p-3 bg-stone-50/80 dark:bg-stone-800/40 rounded-xl border border-stone-200/90 dark:border-stone-700/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-stone-200/80 dark:border-stone-700/60">
                    <div className="flex items-center space-x-1.5 text-[11px] font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                      <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>3. Controle e Almoxarifado</span>
                    </div>
                    <span className="text-[10px] text-stone-400">Saldo & Local</span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Linha 1: Quantidade Inicial + Estoque Mínimo (2 Colunas) */}
                    <div className="grid grid-cols-12 gap-2 items-stretch">
                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Qtd. Inicial ({unidadeMedida || 'UN'})
                          </label>
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={quantidadeAtual}
                          onChange={(e) => setQuantidadeAtual(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0"
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>

                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Estoque Mínimo
                          </label>
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={minQuantity}
                          onChange={(e) => setMinQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0"
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    {/* Linha 2: Endereçamento no Almoxarifado / Gôndola (5 Campos Menores) */}
                    <div className="pt-1 border-t border-stone-200/80 dark:border-stone-700/60">
                      <div className="flex items-center justify-between h-4 mb-1.5">
                        <label className="flex items-center space-x-1 text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          <MapPin className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>Endereçamento Físico (Manual)</span>
                        </label>
                        <span className="text-[9px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">
                          Gôndola / Prateleira
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5">
                        {/* 1. Setor */}
                        <div className="flex flex-col">
                          <label className="block text-[9.5px] font-extrabold text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Setor">
                            SETOR
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={setor}
                            onChange={(e) => setSetor(e.target.value.toUpperCase())}
                            onBlur={(e) => setSetor(formatEnderecoPart(e.target.value))}
                            placeholder="02"
                            className="w-full h-8 px-1 py-1 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Setor do Almoxarifado"
                          />
                        </div>

                        {/* 2. Rua */}
                        <div className="flex flex-col">
                          <label className="block text-[9.5px] font-extrabold text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Rua">
                            RUA
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={rua}
                            onChange={(e) => setRua(e.target.value.toUpperCase())}
                            onBlur={(e) => setRua(formatEnderecoPart(e.target.value))}
                            placeholder="05"
                            className="w-full h-8 px-1 py-1 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Rua / Corredor"
                          />
                        </div>

                        {/* 3. Estante */}
                        <div className="flex flex-col">
                          <label className="block text-[9.5px] font-extrabold text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Estante">
                            ESTANTE
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={estante}
                            onChange={(e) => setEstante(e.target.value.toUpperCase())}
                            onBlur={(e) => setEstante(formatEnderecoPart(e.target.value))}
                            placeholder="08"
                            className="w-full h-8 px-1 py-1 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Estante / Módulo"
                          />
                        </div>

                        {/* 4. Nível */}
                        <div className="flex flex-col">
                          <label className="block text-[9.5px] font-extrabold text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Nível">
                            NÍVEL
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={nivel}
                            onChange={(e) => setNivel(e.target.value.toUpperCase())}
                            onBlur={(e) => setNivel(formatEnderecoPart(e.target.value))}
                            placeholder="07"
                            className="w-full h-8 px-1 py-1 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Nível / Prateleira"
                          />
                        </div>

                        {/* 5. Box */}
                        <div className="flex flex-col">
                          <label className="block text-[9.5px] font-extrabold text-stone-600 dark:text-stone-400 text-center mb-0.5 truncate" title="Box">
                            BOX
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={box}
                            onChange={(e) => setBox(e.target.value.toUpperCase())}
                            onBlur={(e) => setBox(formatEnderecoPart(e.target.value))}
                            placeholder="02"
                            className="w-full h-8 px-1 py-1 text-xs font-mono font-black text-center uppercase rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                            title="Box / Gaveta / Vão"
                          />
                        </div>
                      </div>

                      {/* Caixa de Endereço Formatado Calculado Automaticamente */}
                      <div className="mt-2 p-2 rounded-lg bg-stone-900 dark:bg-stone-950 border border-stone-800 text-white flex flex-col items-center justify-center shadow-inner">
                        <div className="flex items-center space-x-1.5 text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                          <Barcode className="w-3 h-3 text-emerald-400" />
                          <span>Endereço Formatado Automático</span>
                        </div>
                        <div className="text-sm font-black font-mono tracking-widest text-emerald-400 py-0.5">
                          {enderecoFormatado || '00.00.00.00.00'}
                        </div>
                        <div className="text-[8px] font-semibold text-stone-400 tracking-wider">
                          SETOR . RUA . ESTANTE . NÍVEL . BOX
                        </div>
                      </div>
                    </div>

                    {/* Linha 3 (Dinâmica): Capacidade do Galão (L) - aparece somente se unidade for galão ou nome contiver 'Galão' */}
                    {showGallonCapacity && (
                      <div className="flex flex-col justify-end animate-in fade-in duration-150 pt-1 border-t border-stone-200/80 dark:border-stone-700/60">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="flex items-center space-x-1 text-[11px] font-bold text-sky-700 dark:text-sky-300">
                            <Droplets className="w-3 h-3 text-sky-500 shrink-0" />
                            <span>Capacidade do Galão (L)</span>
                          </label>
                          <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">Conversão automática</span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          value={capacidadeGalao}
                          onChange={(e) => setCapacidadeGalao(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="Ex: 20"
                          className="w-full h-9 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-sky-400 dark:border-sky-600 bg-sky-50/50 dark:bg-sky-950/30 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Compacto do Modal com Botão de Imprimir Etiqueta */}
            <div className="pt-2.5 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2 shrink-0">
              {/* Botão de Impressão de Etiquetas à esquerda */}
              <button
                type="button"
                onClick={() => setIsLabelPrintModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold text-stone-700 dark:text-stone-200 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 border border-stone-300 dark:border-stone-700 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer hover:border-sky-500"
                title="Imprimir Etiqueta de Gôndola / Almoxarifado com Código de Barras e Endereço"
              >
                <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Imprimir Etiqueta</span>
              </button>

              {/* Botões Cancelar e Salvar à direita */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando no Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Produto no Estoque</span>
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
            setCategories(newCategories);
            saveStoredInventoryCategories(newCategories);
            if (!newCategories.includes(categoria)) {
              setCategoria(newCategories[0] || 'Outros Insumos');
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
