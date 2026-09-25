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
  Droplets
} from 'lucide-react';
import { InventoryItem } from '../../types';
import { 
  getStoredInventoryCategories, 
  saveStoredInventoryCategories, 
  DEFAULT_INVENTORY_CATEGORIES 
} from '../../lib/storage';
import { CategoryOptionsManagerModal } from '../common/CategoryOptionsManagerModal';
import { cadastrarProduto, parseNumericFloat } from '../../lib/supabaseService';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: InventoryItem) => void;
  initialData?: Partial<InventoryItem>;
  companyId?: string;
  showStockBalanceFields?: boolean;
  zIndexClass?: string;
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

  // COLUNA 2: FISCAL E VALORES
  const [codigoNcm, setCodigoNcm] = useState('');
  const [grupoFiscal, setGrupoFiscal] = useState<'SUBSTITUICAO' | 'TRIBUTADO' | 'ISENTO'>('TRIBUTADO');
  const [grupoIpi, setGrupoIpi] = useState<'NAO TRIBUTADO' | 'TRIBUTADO'>('NAO TRIBUTADO');
  const [custoNominalDisplay, setCustoNominalDisplay] = useState('0,00');
  const [precoVendaDisplay, setPrecoVendaDisplay] = useState('0,00');
  const [margemLucroSugerida, setMargemLucroSugerida] = useState('');

  // COLUNA 3: CONTROLE E ALMOXARIFADO
  const [quantidadeAtual, setQuantidadeAtual] = useState<number | ''>('');
  const [minQuantity, setMinQuantity] = useState<number | ''>('');
  const [localizacao, setLocalizacao] = useState('Depósito Principal');
  const [capacidadeGalao, setCapacidadeGalao] = useState<number | ''>(20);

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

      const initialName = initialData?.name || initialData?.nome || '';
      setNome(initialName);

      const initialCat = initialData?.category || initialData?.categoria || storedCats[0] || 'Outros Insumos';
      setCategoria(initialCat);

      const initialUnit = (initialData?.unit || initialData?.unidade_medida || 'UN').toUpperCase();
      setUnidadeMedida(initialUnit);

      setMarca(initialData?.brand || initialData?.marca || '');

      const initialNoGtin = Boolean(initialData?.hasNoGtin ?? initialData?.sem_gtin ?? (initialData?.barcode === 'SEM GTIN'));
      setSemGtin(initialNoGtin);

      const initialBar = initialNoGtin ? '' : (initialData?.barcode || initialData?.codigo_barras || '');
      setCodigoBarras(initialBar);

      setRefFabrica(initialData?.factoryRef || initialData?.ref_fabrica || '');
      setCodigoInterno(initialData?.code || '');

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

      // Custos e Preços
      const custo = parseNumericFloat(initialData?.unitCost ?? initialData?.custo_nominal ?? 0);
      const venda = parseNumericFloat(initialData?.salePrice ?? initialData?.preco_venda ?? 0);
      
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

      // Estoque e Almoxarifado
      setQuantidadeAtual(initialData?.quantity !== undefined ? initialData.quantity : '');
      setMinQuantity(initialData?.minQuantity !== undefined ? initialData.minQuantity : '');
      setLocalizacao(initialData?.location || 'Depósito Principal');

      const initialGallonCap = initialData?.gallonSizeLiters ?? initialData?.volume_litros_embalagem;
      setCapacidadeGalao(initialGallonCap !== undefined && initialGallonCap !== null ? Number(initialGallonCap) : 20);
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

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanNome = nome.trim();
    if (!cleanNome) {
      setFormError('O Nome do Produto é obrigatório.');
      return;
    }

    const custoNominalFloat = parseCurrencyPtBr(custoNominalDisplay);
    const precoVendaFloat = parseCurrencyPtBr(precoVendaDisplay);
    const margemFloat = parseFloat(margemLucroSugerida.replace(',', '.')) || (
      custoNominalFloat > 0 && precoVendaFloat > 0 
        ? Number((((precoVendaFloat - custoNominalFloat) / custoNominalFloat) * 100).toFixed(2)) 
        : 0
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
        unitCost: custoNominalFloat,
        custo_nominal: custoNominalFloat,
        preco_custo_inicial: custoNominalFloat,
        salePrice: precoVendaFloat,
        preco_venda: precoVendaFloat,
        preco_venda_varejo: precoVendaFloat,
        profitMargin: margemFloat,
        margem_lucro_sugerida: margemFloat,
        quantity: typeof quantidadeAtual === 'number' ? quantidadeAtual : 0,
        quantidade_atual: typeof quantidadeAtual === 'number' ? quantidadeAtual : 0,
        minQuantity: typeof minQuantity === 'number' ? minQuantity : 0,
        location: localizacao.trim() || 'Depósito Principal',
        gallonSizeLiters: parsedGallonLiters,
        volume_litros_embalagem: parsedGallonLiters,
        createdAt: initialData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await cadastrarProduto(newProduct, companyId);

      onSuccess(newProduct);
      onClose();
    } catch (err: any) {
      console.error('Erro ao cadastrar produto:', err);
      setFormError('Ocorreu um erro ao salvar o produto no Supabase. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

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
                  Cadastrar Novo Produto no Estoque
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

          {/* Formulário em 3 Colunas Horizontais Paralelas (Sem Barra de Rolagem Vertical) */}
          <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3">
            
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

                    {/* Linha 3: Custo Nominal (R$) + Preço de Venda Sugerido (R$) */}
                    <div className="grid grid-cols-12 gap-2 items-stretch">
                      <div className="col-span-6 flex flex-col justify-end">
                        <div className="flex items-center justify-between h-4 mb-1">
                          <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 truncate">
                            Custo Nominal (R$)
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

                  <div className="space-y-2">
                    {/* Linha 1: Quantidade Inicial */}
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between h-4 mb-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          Quantidade Inicial ({unidadeMedida || 'UN'})
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

                    {/* Linha 2: Estoque Mínimo */}
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between h-4 mb-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
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

                    {/* Linha 3: Localização Física */}
                    <div className="flex flex-col justify-end">
                      <div className="flex items-center justify-between h-4 mb-1">
                        <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300">
                          Localização Física
                        </label>
                      </div>
                      <input
                        type="text"
                        value={localizacao}
                        onChange={(e) => setLocalizacao(e.target.value)}
                        placeholder="Ex: Barracão Principal, Tanque 1..."
                        className="w-full h-9 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
                      />
                    </div>

                    {/* Linha 4 (Dinâmica): Capacidade do Galão (L) - aparece somente se unidade for galão ou nome contiver 'Galão' */}
                    {showGallonCapacity && (
                      <div className="flex flex-col justify-end animate-in fade-in duration-150">
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

            {/* Footer Compacto do Modal */}
            <div className="pt-2.5 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end space-x-2.5 shrink-0">
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
    </>
  );
};
