import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Check, 
  CircleDot, 
  Wrench, 
  Save, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  Gauge, 
  Sparkles,
  Info,
  ChevronRight
} from 'lucide-react';
import { TireItem, VehicleAxleConfig } from '../../types';
import { 
  buildDynamicAxleConfig, 
  getPositionReadableLabel, 
  getTireCondition 
} from '../../lib/tireAndAxlePresets';
import { getStoredTireInventory, saveStoredTireInventory } from '../../lib/storage';

interface VehicleTireSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleName: string;
  vehiclePlate?: string;
  vehicleType?: string;
  numeroEixos?: number | string;
  quantidadePneus?: number | string;
  vehicleKm?: number | string;
  vehicleId?: string;
  initialTires?: TireItem[];
  onSaveTires: (configuredTires: TireItem[]) => void;
}

export const VehicleTireSetupModal: React.FC<VehicleTireSetupModalProps> = ({
  isOpen,
  onClose,
  vehicleName,
  vehiclePlate,
  vehicleType,
  numeroEixos,
  quantidadePneus,
  vehicleKm,
  vehicleId,
  initialTires = [],
  onSaveTires,
}) => {
  // 1. Resolução Dinâmica de Eixos e Pneus
  const resolvedAxles = useMemo(() => {
    const e = parseInt(String(numeroEixos || ''), 10);
    if (!isNaN(e) && e > 0) return e;
    const tLower = (vehicleType || '').toLowerCase();
    if (tLower.includes('reboque') || tLower.includes('prancha') || tLower.includes('carreta')) return 3;
    if (tLower.includes('toco')) return 2;
    if (tLower.includes('caminh') || tLower.includes('truck')) return 3;
    return 2;
  }, [numeroEixos, vehicleType]);

  const resolvedTires = useMemo(() => {
    const p = parseInt(String(quantidadePneus || ''), 10);
    if (!isNaN(p) && p > 0) return p;
    const tLower = (vehicleType || '').toLowerCase();
    if (tLower.includes('reboque') || tLower.includes('prancha')) return 12;
    if (tLower.includes('toco')) return 6;
    if (tLower.includes('caminh') || tLower.includes('truck')) return 10;
    return 4;
  }, [quantidadePneus, vehicleType]);

  // Configuração visual de eixos gerada dinamicamente
  const axleConfig: VehicleAxleConfig = useMemo(() => {
    return buildDynamicAxleConfig(resolvedAxles, resolvedTires, vehicleType, vehicleName);
  }, [resolvedAxles, resolvedTires, vehicleType, vehicleName]);

  // Posições totais do chassi
  const allAxlePositions = useMemo(() => {
    const list: { pos: string; axleNumber: number; type: 'single' | 'dual' }[] = [];
    axleConfig.axles.forEach((a) => {
      a.tirePositions.forEach((pos) => {
        list.push({ pos, axleNumber: a.axleNumber, type: a.type });
      });
    });
    return list;
  }, [axleConfig]);

  // Mapa de Pneus configurados no veículo (chave: código da posição ex: '1E', '2EE')
  const [tiresByPosition, setTiresByPosition] = useState<Map<string, TireItem>>(() => {
    const map = new Map<string, TireItem>();
    initialTires.forEach((t) => {
      if (t.position) map.set(t.position, t);
    });
    return map;
  });

  // Sincroniza ao abrir com os pneus iniciais do veículo
  useEffect(() => {
    if (isOpen) {
      const map = new Map<string, TireItem>();
      initialTires.forEach((t) => {
        if (t.position) map.set(t.position, t);
      });
      setTiresByPosition(map);
      setSelectedPosition(null);
    }
  }, [isOpen, initialTires]);

  // Posição atualmente selecionada para preenchimento no formulário lateral/popover
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  // Estados do Formulário Padrão de Pneu (idêntico ao Estoque)
  // Estados do Formulário Padrão de Pneu (idêntico ao Estoque)
  const [fireNumber, setFireNumber] = useState('');
  const [brand, setBrand] = useState('Michelin');
  const [model, setModel] = useState('');
  const [size, setSize] = useState('295/80 R 22.5');
  const [treadDepthMm, setTreadDepthMm] = useState('14.0');
  const [originalTreadDepthMm, setOriginalTreadDepthMm] = useState('18.0');
  const [pressurePsi, setPressurePsi] = useState('110');
  const [retreadCount, setRetreadCount] = useState<number>(0);
  const [currentKm, setCurrentKm] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Marcas de Pneus Dinâmicas com Persistência Local (idêntico ao Estoque - ProductFormModal)
  const [tireBrandOptions, setTireBrandOptions] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('colaca_silagem_marcas_pneus');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar marcas de pneus:', e);
    }
    return [
      'Michelin',
      'Pirelli',
      'Bridgestone',
      'Goodyear',
      'Firestone',
      'Continental',
      'Dunlop',
      'Trelleborg',
      'Alliance',
      'Prometeon',
      'XBRI',
      'Outro',
    ];
  });
  const [isBrandManagerOpen, setIsBrandManagerOpen] = useState(false);
  const [newBrandInput, setNewBrandInput] = useState('');
  const [brandToDeleteConfirm, setBrandToDeleteConfirm] = useState<string | null>(null);

  const saveBrandsToStorage = (brands: string[]) => {
    try {
      localStorage.setItem('colaca_silagem_marcas_pneus', JSON.stringify(brands));
    } catch (e) {
      console.warn('Erro ao salvar marcas de pneus:', e);
    }
  };

  const handleAddBrand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newBrandInput.trim();
    if (!clean) return;
    if (!tireBrandOptions.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      const updated = [...tireBrandOptions, clean];
      setTireBrandOptions(updated);
      saveBrandsToStorage(updated);
      setBrand(clean);
    } else {
      const existing = tireBrandOptions.find((b) => b.toLowerCase() === clean.toLowerCase()) || clean;
      setBrand(existing);
    }
    setNewBrandInput('');
    setBrandToDeleteConfirm(null);
    setIsBrandManagerOpen(false);
  };

  const executeRemoveBrand = (brandToRemove: string) => {
    const updated = tireBrandOptions.filter((b) => b !== brandToRemove);
    setTireBrandOptions(updated);
    saveBrandsToStorage(updated);
    if (brand === brandToRemove) {
      setBrand(updated[0] || 'Michelin');
    }
    setBrandToDeleteConfirm(null);
  };

  const commonSizes = [
    '295/80 R 22.5',
    '275/80 R 22.5',
    '215/75 R 17.5',
    '385/65 R 22.5',
    '710/70 R 38',
    '600/65 R 28',
    '12.4-24',
    '18.4-34'
  ];

  // Máscara automática de medida (idêntica ao Estoque)
  const handleSizeChange = (val: string) => {
    if (!val) {
      setSize('');
      return;
    }
    const isDeleting = val.length < size.length;
    if (isDeleting) {
      if (val.endsWith(' R') || val.endsWith(' R ') || val.endsWith(' ')) {
        setSize(val.replace(/\s*R?\s*$/, ''));
        return;
      }
      if (val.endsWith('/')) {
        setSize(val.slice(0, -1));
        return;
      }
      setSize(val);
      return;
    }
    const normalized = val.replace(',', '.');
    const rawDigits = normalized.replace(/[^0-9]/g, '');
    if (!rawDigits) {
      setSize('');
      return;
    }
    const width = rawDigits.slice(0, 3);
    if (rawDigits.length < 3) {
      setSize(width);
      return;
    }
    const aspect = rawDigits.slice(3, 5);
    if (rawDigits.length <= 5) {
      setSize(aspect ? `${width}/${aspect}` : `${width}/`);
      return;
    }
    const rimWhole = rawDigits.slice(5, 7);
    const rimDecimal = rawDigits.slice(7, 8);
    const rim = rimDecimal ? `${rimWhole}.${rimDecimal}` : rimWhole;
    setSize(`${width}/${aspect} R ${rim}`);
  };

  // Quando o usuário clica num pneu para configurar/editar
  const handleSelectSlot = (pos: string) => {
    setSelectedPosition(pos);
    setFormError('');
    const existing = tiresByPosition.get(pos);

    if (existing) {
      setFireNumber(existing.fireNumber || '');
      setBrand(existing.brand || tireBrandOptions[0] || 'Michelin');
      setModel(existing.model || '');
      setSize(existing.size || '295/80 R 22.5');
      setTreadDepthMm(existing.treadDepthMm !== undefined ? String(existing.treadDepthMm) : '14.0');
      setOriginalTreadDepthMm(existing.originalTreadDepthMm !== undefined ? String(existing.originalTreadDepthMm) : '18.0');
      setPressurePsi(existing.pressurePsi !== undefined ? String(existing.pressurePsi) : '110');
      setRetreadCount(existing.retreadCount !== undefined ? existing.retreadCount : 0);
      setCurrentKm(existing.currentKm !== undefined ? String(existing.currentKm) : String(vehicleKm || '0'));
      setNotes(existing.notes || '');
    } else {
      // Auto-sugere número de fogo baseado na placa ou timestamp
      const prefix = vehiclePlate ? vehiclePlate.replace(/[^A-Za-z0-9]/g, '').slice(-3).toUpperCase() : 'PN';
      setFireNumber(`${prefix}-${pos}`);
      setBrand(tireBrandOptions[0] || 'Michelin');
      setModel('X Multi Z');
      setSize('295/80 R 22.5');
      setTreadDepthMm('14.0');
      setOriginalTreadDepthMm('18.0');
      setPressurePsi('110');
      setRetreadCount(0);
      setCurrentKm(String(vehicleKm || '0'));
      setNotes('');
    }
  };

  // Confirma o pneu na posição selecionada
  const handleConfirmTireInPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPosition) return;

    if (!fireNumber.trim()) {
      setFormError('Informe o Nº de Fogo / Matrícula do Pneu.');
      return;
    }

    const finalBrand = brand.trim() || 'Michelin';
    const finalTread = parseFloat(treadDepthMm);
    if (isNaN(finalTread) || finalTread < 0) {
      setFormError('Informe um valor de sulco válido em mm.');
      return;
    }

    const posName = getPositionReadableLabel(selectedPosition);
    const existing = tiresByPosition.get(selectedPosition);

    const confirmedTire: TireItem = {
      id: existing?.id || `tire_${Date.now()}_${selectedPosition}_${Math.random().toString(36).slice(2, 6)}`,
      position: selectedPosition,
      positionName: posName,
      fireNumber: fireNumber.trim().toUpperCase(),
      brand: finalBrand,
      model: model.trim() || undefined,
      size: size.trim() || '295/80 R 22.5',
      treadDepthMm: finalTread,
      originalTreadDepthMm: parseFloat(originalTreadDepthMm) || 18.0,
      pressurePsi: parseFloat(pressurePsi) || 110,
      retreadCount: retreadCount || 0,
      currentKm: parseFloat(currentKm) || 0,
      status: 'em_uso',
      installationDate: existing?.installationDate || new Date().toISOString().split('T')[0],
      installationKm: existing?.installationKm || parseFloat(String(vehicleKm || 0)) || 0,
      notes: notes.trim() || undefined,
      vehicleId: vehicleId || undefined,
      vehiclePlate: vehiclePlate || undefined,
      vehicleName: vehicleName || undefined,
    };

    setTiresByPosition((prev) => {
      const next = new Map(prev);
      next.set(selectedPosition, confirmedTire);
      return next;
    });

    // Fecha o formulário para voltar à visão geral dos eixos
    setSelectedPosition(null);
    setFormError('');
  };

  // Remove o pneu de uma posição
  const handleRemoveTireFromPosition = (pos: string) => {
    setTiresByPosition((prev) => {
      const next = new Map(prev);
      next.delete(pos);
      return next;
    });
    if (selectedPosition === pos) {
      setSelectedPosition(null);
    }
  };

  // Salvar Pneus neste Veículo (Consolidado e Persistência Local)
  const handleSaveAllTires = () => {
    const list = Array.from(tiresByPosition.values()).map(t => ({
      ...t,
      status: 'em_uso' as const,
      installationDate: t.installationDate || new Date().toISOString().split('T')[0],
      vehicleId: vehicleId || vehiclePlate || vehicleName,
      vehiclePlate: vehiclePlate,
      vehicleName: vehicleName,
    }));

    // 1. Atualiza e sincroniza o armazenamento global de inventário de pneus
    try {
      const existingInventory = getStoredTireInventory();
      const targetVehicleId = vehicleId || vehiclePlate || vehicleName;
      const targetPlate = (vehiclePlate || '').toUpperCase().trim();

      // Remove pneus anteriores que estavam neste veículo para evitar duplicatas
      const filtered = existingInventory.filter(
        (ext: any) => {
          if (list.some((current) => current.id === ext.id)) return false;
          if (targetVehicleId && ext.vehicleId === targetVehicleId) return false;
          if (targetPlate && (ext.vehiclePlate || '').toUpperCase().trim() === targetPlate) return false;
          return true;
        }
      );
      const combined = [...filtered, ...list];
      
      // Salva tanto na chave padrão do sistema quanto na solicitada pelo cliente
      saveStoredTireInventory(combined);
      localStorage.setItem('colaca_silagem_frotas_pneus_estoque', JSON.stringify(combined));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('silagem_tire_inventory_updated', { detail: combined }));
        window.dispatchEvent(new CustomEvent('colaca_silagem_frotas_pneus_updated', { detail: combined }));
      }
    } catch (err) {
      console.warn('Erro ao salvar inventário global de pneus:', err);
    }

    // 2. Notifica o componente pai (VehicleModal)
    onSaveTires(list);
    onClose();
  };

  if (!isOpen) return null;

  const configuredCount = tiresByPosition.size;
  const totalSlots = allAxlePositions.length;
  const isAllFilled = configuredCount >= totalSlots && totalSlots > 0;

  return (
    <div 
      id="modal-configuracao-pneus-veiculo"
      className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-5xl w-full border border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* HEADER SUPERIOR */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <CircleDot className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                  Configuração de Pneus Atuais no Veículo
                </h3>
                {vehiclePlate && (
                  <span className="px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-mono font-black">
                    {vehiclePlate}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 font-medium">
                {vehicleName} • Chassi com {resolvedAxles} eixos e {totalSlots} posições de rodagem
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition ${
              isAllFilled
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            }`}>
              {isAllFilled ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Todos os {totalSlots} Pneus Configurados!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                  <span>{configuredCount} de {totalSlots} Pneus Configurados</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              title="Fechar sem salvar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CORPO PRINCIPAL COM CHASSI + FORMULÁRIO LATERAL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-stone-100/50 dark:bg-stone-950/40">
          
          {/* COLUNA ESQUERDA: DESENHO VISUAL DOS EIXOS E CHASSI */}
          <div className={`${selectedPosition ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all duration-300 flex flex-col items-center justify-start`}>
            
            {/* Aviso Indutivo no Topo */}
            <div className="w-full max-w-md mb-3 p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-sky-900 dark:text-sky-200">
                <Info className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="font-semibold text-[11px]">
                  Clique nos pneus vazios piscando para regularizar os parâmetros de cada posição.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white dark:bg-stone-800 text-sky-700 dark:text-sky-300 border border-sky-300 shrink-0">
                {configuredCount}/{totalSlots}
              </span>
            </div>

            {/* Chassi Card */}
            <div className="w-full max-w-md p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col items-center">
              
              {/* Cabine / Frente do Chassi */}
              <div className="w-36 h-8 rounded-t-xl bg-stone-800 dark:bg-stone-700 border border-stone-700 flex flex-col items-center justify-center shadow-xs">
                <span className="text-[9px] font-black text-white tracking-widest uppercase font-mono">
                  ▲ FRENTE / CABINE ▲
                </span>
              </div>

              {/* Viga Central / Cardan */}
              <div className="relative w-full space-y-6 py-4">
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-3 bg-stone-300 dark:bg-stone-700 rounded-full z-0 opacity-70"></div>

                {/* Eixos do Veículo */}
                {axleConfig.axles.map((axle) => (
                  <div key={axle.axleNumber} className="relative z-10 space-y-1">
                    
                    {/* Header do Eixo */}
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-black text-stone-600 dark:text-stone-300 uppercase tracking-wider">
                        Eixo {axle.axleNumber} • {axle.name}
                      </span>
                      <span className="text-[9px] font-bold text-stone-400">
                        {axle.type === 'dual' ? 'Rodado Duplo' : 'Rodado Simples'}
                      </span>
                    </div>

                    {/* Barra Metálica do Eixo */}
                    <div className="relative flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 shadow-2xs">
                      
                      {/* Linha Metálica Transeixo */}
                      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full z-0"></div>

                      {/* LADO ESQUERDO */}
                      <div className="relative z-10 flex items-center space-x-1.5">
                        {axle.type === 'single' ? (
                          renderTireSlot(axle.tirePositions[0])
                        ) : (
                          <>
                            {renderTireSlot(axle.tirePositions[0])} {/* EE */}
                            {renderTireSlot(axle.tirePositions[1])} {/* EI */}
                          </>
                        )}
                      </div>

                      {/* Cubo Central / Diferencial */}
                      <div className="relative z-10 w-7 h-7 rounded-full bg-stone-700 dark:bg-stone-800 border-2 border-stone-400 dark:border-stone-600 flex items-center justify-center shadow-xs">
                        <span className="text-[8px] font-black text-stone-200 font-mono">E{axle.axleNumber}</span>
                      </div>

                      {/* LADO DIREITO */}
                      <div className="relative z-10 flex items-center space-x-1.5">
                        {axle.type === 'single' ? (
                          renderTireSlot(axle.tirePositions[1])
                        ) : (
                          <>
                            {renderTireSlot(axle.tirePositions[2])} {/* DI */}
                            {renderTireSlot(axle.tirePositions[3])} {/* DD */}
                          </>
                        )}
                      </div>

                    </div>

                  </div>
                ))}

              </div>

              {/* Traseira do Chassi */}
              <div className="w-32 h-4 rounded-b-lg bg-stone-800 dark:bg-stone-700 border border-stone-700 flex items-center justify-center mt-1">
                <span className="text-[8px] font-bold text-stone-300 font-mono">▼ TRASEIRA ▼</span>
              </div>

            </div>

          </div>

          {/* COLUNA DIREITA: FORMULÁRIO PADRÃO DE PARÂMETROS TÉCNICOS (SETA ROSA) */}
          {selectedPosition && (
            <div className="lg:col-span-5 bg-white dark:bg-stone-900 rounded-2xl border-2 border-sky-500/60 dark:border-sky-500/40 p-4 sm:p-5 shadow-xl flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-200">
              
              <div className="space-y-4">
                
                {/* Cabeçalho do Formulário */}
                <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100">
                        Parâmetros Técnicos do Pneu
                      </h4>
                      <p className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                        Posição: {selectedPosition} • {getPositionReadableLabel(selectedPosition)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedPosition(null)}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {formError && (
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleConfirmTireInPosition} className="space-y-3">
                  
                  {/* Linha 1: Nº de Fogo / Matrícula & Marca */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Nº de Fogo / Matrícula <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={fireNumber}
                        onChange={(e) => setFireNumber(e.target.value.toUpperCase())}
                        placeholder="Ex: #0920 ou P-115"
                        required
                        className="w-full px-2.5 py-1.5 text-xs font-black rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div className="relative">
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5 truncate">
                        Marca <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <select
                          value={brand}
                          onChange={(e) => setBrand(e.target.value)}
                          required
                          className="flex-1 min-w-0 px-2 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {tireBrandOptions.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsBrandManagerOpen(!isBrandManagerOpen)}
                            className="p-1.5 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 transition cursor-pointer"
                            title="Adicionar ou gerenciar marcas de pneus"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {brand && (
                            <button
                              type="button"
                              onClick={() => setBrandToDeleteConfirm(brand)}
                              className="p-1.5 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300 border border-rose-300 dark:border-rose-800 transition cursor-pointer"
                              title={`Excluir marca "${brand}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mini-popover para cadastro/gestão rápida de marca (idêntico ao Estoque) */}
                      {isBrandManagerOpen && (
                        <div className="absolute right-0 top-full mt-1 z-30 w-56 p-2 bg-white dark:bg-stone-850 rounded-xl shadow-xl border border-stone-300 dark:border-stone-700 animate-in fade-in zoom-in-95 text-stone-900 dark:text-stone-100">
                          <div className="flex items-center justify-between pb-1 mb-1 border-b border-stone-200 dark:border-stone-700">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">Nova Marca de Pneu</span>
                            <button 
                              type="button" 
                              onClick={() => {
                                setIsBrandManagerOpen(false);
                                setBrandToDeleteConfirm(null);
                              }}
                              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex gap-1 mb-1.5">
                            <input
                              type="text"
                              placeholder="Nome da marca..."
                              value={newBrandInput}
                              onChange={(e) => setNewBrandInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddBrand();
                                }
                              }}
                              className="flex-1 h-6.5 px-1.5 text-xs rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-1 focus:ring-sky-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleAddBrand()}
                              className="h-6.5 px-2 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-bold transition flex items-center justify-center cursor-pointer active:scale-95"
                              title="Adicionar nova marca"
                            >
                              <Check className="w-3 h-3 stroke-[2.5]" />
                            </button>
                          </div>

                          {/* Confirmação de exclusão */}
                          {brandToDeleteConfirm && (
                            <div className="mb-1.5 p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                              <p className="text-[10px] font-bold leading-tight mb-1">
                                Excluir marca "{brandToDeleteConfirm}"?
                              </p>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => executeRemoveBrand(brandToDeleteConfirm)}
                                  className="px-2 py-0.5 text-[9.5px] font-bold rounded bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition cursor-pointer"
                                >
                                  Sim
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBrandToDeleteConfirm(null)}
                                  className="px-2 py-0.5 text-[9.5px] font-semibold rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition cursor-pointer"
                                >
                                  Não
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="max-h-28 overflow-y-auto space-y-0.5 custom-scrollbar">
                            {tireBrandOptions.map((b) => (
                              <div 
                                key={b} 
                                className="flex items-center justify-between px-1.5 py-0.5 text-[11px] rounded hover:bg-stone-100 dark:hover:bg-stone-850 transition"
                              >
                                <span className="truncate">{b}</span>
                                <button
                                  type="button"
                                  onClick={() => setBrandToDeleteConfirm(b)}
                                  className="text-stone-400 hover:text-rose-600 p-0.5 cursor-pointer transition"
                                  title={`Excluir ${b}`}
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Linha 2: Modelo da Banda & Medida / Dimensão */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Modelo da Banda
                      </label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="Ex: X Multi Z / KMAX"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Medida / Dimensão (Máscara Auto)
                      </label>
                      <input
                        type="text"
                        value={size}
                        onChange={(e) => handleSizeChange(e.target.value)}
                        placeholder="Ex: 295/80 R 22.5"
                        maxLength={16}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  {/* Pílulas de Medidas Rápidas */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    <span className="text-[10px] text-stone-400 font-bold shrink-0">Sugestões:</span>
                    {commonSizes.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition shrink-0 cursor-pointer ${
                          size === s
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {/* Linha 3: Sulco Atual, Recapagens e Pressão */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Sulco (mm) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="30"
                        value={treadDepthMm}
                        onChange={(e) => setTreadDepthMm(e.target.value)}
                        required
                        className="w-full px-2 py-1.5 text-xs font-black text-sky-700 dark:text-sky-400 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Recapagens
                      </label>
                      <select
                        value={retreadCount}
                        onChange={(e) => setRetreadCount(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-1.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value={0}>0 (Novo)</option>
                        <option value={1}>1ª Recap.</option>
                        <option value={2}>2ª Recap.</option>
                        <option value={3}>3ª Recap.</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                        Pressão (PSI)
                      </label>
                      <input
                        type="number"
                        value={pressurePsi}
                        onChange={(e) => setPressurePsi(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  {/* Linha 4: KM Estimado */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      KM Estimado Rodado
                    </label>
                    <input
                      type="number"
                      value={currentKm}
                      onChange={(e) => setCurrentKm(e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-0.5">
                      Observações
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Informações adicionais do pneu nesta posição..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                    />
                  </div>

                  {/* Botões do Formulário Lateral */}
                  <div className="pt-2 flex items-center justify-between border-t border-stone-200 dark:border-stone-800">
                    {tiresByPosition.has(selectedPosition) ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveTireFromPosition(selectedPosition)}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover Pneu</span>
                      </button>
                    ) : <div></div>}

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPosition(null)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-black rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Confirmar Pneu na Posição</span>
                      </button>
                    </div>
                  </div>

                </form>

              </div>

            </div>
          )}

        </div>

        {/* RODAPÉ CONSOLIDADO: SALVAR PNEUS NESTE VEÍCULO (REQUISITO 4) */}
        <div className="px-4 sm:px-6 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
              Total: {configuredCount} de {totalSlots} pneus regularizados
            </span>
            {isAllFilled && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>100% Configurado</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              id="btn-salvar-pneus-veiculo"
              onClick={handleSaveAllTires}
              className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md hover:shadow-lg transition cursor-pointer transform hover:scale-[1.01] active:scale-98"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>💾 Salvar Pneus neste Veículo</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );

  // RENDERIZAÇÃO INDIVIDUAL DE CADA SLOT DE PNEU COM ANIMAÇÃO INDUTIVA (SETA AMARELA)
  function renderTireSlot(pos: string) {
    if (!pos) return null;
    const tire = tiresByPosition.get(pos);
    const isSelected = selectedPosition === pos;

    // -----------------------------------------------------------------
    // CASO 1: SLOT VAZIO (SEM PNEU) -> ANIMAÇÃO DE PULSO SUAVE INDUTIVA
    // -----------------------------------------------------------------
    if (!tire) {
      return (
        <button
          type="button"
          key={pos}
          onClick={() => handleSelectSlot(pos)}
          title={`Clique para configurar o pneu na posição ${pos}`}
          className={`group relative flex flex-col items-center justify-center rounded-xl transition cursor-pointer select-none border-2 border-dashed ${
            isSelected
              ? 'ring-3 ring-sky-500 border-sky-500 bg-sky-100 dark:bg-sky-950 scale-105 z-20 shadow-md'
              : 'animate-pulse ring-2 ring-amber-400/70 border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:scale-105 hover:bg-amber-100'
          }`}
          style={{ width: '68px', height: '94px' }}
        >
          {/* Indicador pulsante com ícone de adição */}
          <div className="flex flex-col items-center justify-center p-1 space-y-1">
            <span className="text-[10px] font-black font-mono block">
              {pos}
            </span>
            <div className="w-5 h-5 rounded-full bg-amber-400 text-stone-900 flex items-center justify-center shadow-xs">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span className="text-[9px] font-extrabold uppercase tracking-tight block">
              Configurar
            </span>
          </div>
        </button>
      );
    }

    // -----------------------------------------------------------------
    // CASO 2: SLOT OCUPADO / JÁ CONFIGURADO -> CARD COMPLETO
    // -----------------------------------------------------------------
    const tread = tire.treadDepthMm || 12.0;
    const condition = getTireCondition(tread);

    return (
      <button
        type="button"
        key={pos}
        onClick={() => handleSelectSlot(pos)}
        title={`Pneu ${tire.fireNumber} (${pos}) - Clique para editar`}
        className={`group relative flex flex-col items-center p-1.5 rounded-xl transition cursor-pointer select-none text-left ${
          isSelected
            ? 'ring-3 ring-sky-500 border-2 border-sky-500 bg-sky-50 dark:bg-sky-950/80 scale-105 shadow-md z-20'
            : 'bg-white dark:bg-stone-900 border-2 border-emerald-500/80 dark:border-emerald-600 hover:border-sky-500 hover:shadow-md'
        }`}
        style={{ width: '70px' }}
      >
        {/* Pneu Visual com Textura e Detalhes */}
        <div className="relative w-11 h-13 rounded-md bg-stone-900 dark:bg-stone-950 border border-stone-800 flex flex-col justify-between py-1 shadow-xs overflow-hidden">
          
          {/* Sulcos Superiores */}
          <div className="w-full flex justify-between px-1 opacity-40">
            <div className="w-0.5 h-full bg-stone-300"></div>
            <div className="w-0.5 h-full bg-stone-300"></div>
            <div className="w-0.5 h-full bg-stone-300"></div>
          </div>

          {/* Cubo da Roda / Posição */}
          <div className="w-4 h-4 rounded-full bg-stone-700 border border-stone-400 mx-auto flex items-center justify-center">
            <span className="text-[7px] font-black text-white font-mono">{pos}</span>
          </div>

          {/* Sulcos Inferiores */}
          <div className="w-full flex justify-between px-1 opacity-40">
            <div className="w-0.5 h-full bg-stone-300"></div>
            <div className="w-0.5 h-full bg-stone-300"></div>
            <div className="w-0.5 h-full bg-stone-300"></div>
          </div>

          {/* Barra Colorida de Sulco */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: condition.color }}
          ></div>
        </div>

        {/* Informações Resumidas do Pneu */}
        <div className="mt-1 text-center w-full space-y-0.5">
          <span className="text-[9px] font-black text-stone-900 dark:text-stone-100 truncate block">
            {tire.fireNumber}
          </span>
          <span
            className="px-1 py-0.2 rounded text-[8px] font-black text-white block text-center truncate"
            style={{ backgroundColor: condition.color }}
          >
            {tread.toFixed(1)} mm
          </span>
        </div>

        {/* Indicador de Status Configurado */}
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
          <Check className="w-2.5 h-2.5 stroke-[3]" />
        </div>
      </button>
    );
  }
};
