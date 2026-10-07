import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CircleDot, 
  Search, 
  Layers, 
  Settings, 
  ArrowRightLeft, 
  Clock, 
  Gauge, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Plus, 
  Trash2, 
  RotateCw, 
  RotateCcw,
  ShieldCheck, 
  Info, 
  Sliders, 
  TrendingUp, 
  Wrench, 
  Calendar,
  ChevronRight,
  UserCheck,
  Fuel,
  Check,
  Car,
  X,
  GripVertical,
  ArrowUpRight,
  Sparkles,
  Truck,
  Archive,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { 
  Machinery, 
  Employee, 
  VehicleTypeDefinition, 
  VehicleAxleConfig, 
  TireItem, 
  TireRotationLog, 
  CompanyProfile 
} from '../../types';
import { 
  getPositionReadableLabel, 
  getTireCondition, 
  generateDefaultTiresForAxleConfig, 
  buildDynamicAxleConfig,
  AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R,
  AXLE_CONFIG_CAMINHAO_TOCO_2E_6R,
  AXLE_CONFIG_UTILITARIO_2E_4R,
  AXLE_CONFIG_TRATOR_AGRICOLA_2E_4R,
  AXLE_CONFIG_ENSILADEIRA_AUTOPROPELIDA_2E_4R,
  AXLE_CONFIG_TRANSBORDO_REBOQUE_2E_4R,
  AXLE_CONFIG_REBOQUE_PRANCHA_3E_12R
} from '../../lib/tireAndAxlePresets';
import { supabase } from '../../lib/supabaseClient';
import { isSupabaseConfigured, isTableUnmigrated, markTableUnmigrated } from '../../lib/supabaseService';
import { 
  formatDateBR, 
  formatCurrencyBRL,
  getStoredTireInventory,
  saveStoredTireInventory,
  getStoredTiresInReform,
  saveStoredTiresInReform,
  getStoredTiresDiscarded,
  saveStoredTiresDiscarded
} from '../../lib/storage';
import { VehicleTypesConfigModal } from './VehicleTypesConfigModal';
import { TireInspectionModal } from './TireInspectionModal';
import { TireRotationPrintModal } from './TireRotationPrintModal';
import { TireDiscardModal } from './TireDiscardModal';
import { NewInventoryTireModal } from './NewInventoryTireModal';
import { TireReturnReformModal } from './TireReturnReformModal';

// ========================================================
// FUNÇÕES AUXILIARES DE INTEGRAÇÃO SUPABASE & CHASSI
// ========================================================

export function isCaminhao(rowOrVehicle: any): boolean {
  if (!rowOrVehicle) return false;
  const tipoLower = String(rowOrVehicle.tipo || rowOrVehicle.type || rowOrVehicle.categoryType || rowOrVehicle.categoria || '').toLowerCase().trim();
  const compLower = String(rowOrVehicle.compositionType || '').toLowerCase().trim();
  const nomeLower = String(rowOrVehicle.nome || rowOrVehicle.name || '').toLowerCase().trim();
  const modeloLower = String(rowOrVehicle.modelo || rowOrVehicle.model || '').toLowerCase().trim();
  const fullText = `${tipoLower} ${compLower} ${nomeLower} ${modeloLower}`;

  // Se explicitamente marcado como cavalo mecânico ou composição cavalo
  if (
    compLower === 'cavalo' || 
    tipoLower.includes('cavalo') || 
    fullText.includes('cavalo mecânico') || 
    fullText.includes('cavalo mecanico')
  ) {
    return true;
  }

  // Se tiver 'caminhão' ou 'caminhao' (inclui 'caminhão trator', 'caminhão (basculante / graneleiro)', 'caminhão toco', etc.)
  if (tipoLower.includes('caminh') || tipoLower.includes('caminhao') || fullText.includes('caminhão') || fullText.includes('caminhao')) {
    return true;
  }

  // Tração rodoviária / caminhão-trator
  if (tipoLower.includes('tração caminhão') || tipoLower.includes('tracao caminhao')) {
    return true;
  }

  // Termos típicos de caminhão rodoviário
  if (
    tipoLower.includes('truck') || 
    tipoLower.includes('bitruck') || 
    tipoLower.includes('toco') || 
    tipoLower.includes('graneleiro') || 
    tipoLower.includes('basculante')
  ) {
    return true;
  }

  // Modelos conhecidos de cavalos mecânicos e caminhões rodoviários (ex: Axor 2540 S, Actros, Constellation, Meteor, Scania, Volvo FH)
  if (
    fullText.includes('axor') ||
    fullText.includes('actros') ||
    fullText.includes('constellation') ||
    fullText.includes('meteor') ||
    fullText.includes('scania') ||
    fullText.includes('volvo fh') ||
    fullText.includes('iveco stralis') ||
    fullText.includes('iveco s-way') ||
    fullText.includes('vw delivery')
  ) {
    return true;
  }

  return false;
}

export function isEnsiladeira(rowOrVehicle: any): boolean {
  if (!rowOrVehicle) return false;
  const tipoLower = String(rowOrVehicle.tipo || rowOrVehicle.type || rowOrVehicle.categoryType || rowOrVehicle.categoria || '').toLowerCase().trim();
  const nomeLower = String(rowOrVehicle.nome || rowOrVehicle.name || '').toLowerCase().trim();
  const modeloLower = String(rowOrVehicle.modelo || rowOrVehicle.model || '').toLowerCase().trim();
  const fullText = `${tipoLower} ${nomeLower} ${modeloLower}`;

  return (
    tipoLower.includes('ensilad') ||
    tipoLower.includes('forrageir') ||
    tipoLower.includes('colhedora') ||
    fullText.includes('jaguar') ||
    fullText.includes('claas')
  );
}

export function isReboque(rowOrVehicle: any): boolean {
  if (!rowOrVehicle) return false;
  const tipoLower = String(rowOrVehicle.tipo || rowOrVehicle.type || rowOrVehicle.categoryType || rowOrVehicle.categoria || '').toLowerCase().trim();
  const compLower = String(rowOrVehicle.compositionType || '').toLowerCase().trim();
  const nomeLower = String(rowOrVehicle.nome || rowOrVehicle.name || '').toLowerCase().trim();
  const modeloLower = String(rowOrVehicle.modelo || rowOrVehicle.model || '').toLowerCase().trim();
  const fullText = `${tipoLower} ${compLower} ${nomeLower} ${modeloLower}`;

  return (
    compLower === 'reboque' ||
    tipoLower.includes('reboque') ||
    tipoLower.includes('prancha') ||
    tipoLower.includes('transbordo') ||
    tipoLower.includes('carreta') ||
    tipoLower.includes('implemento') ||
    fullText.includes('prancha') ||
    fullText.includes('transbordo') ||
    fullText.includes('treminhão') ||
    fullText.includes('treminhao')
  );
}

export function isTratorAgricola(rowOrVehicle: any): boolean {
  if (!rowOrVehicle) return false;

  // REGRA CRÍTICA: Se for Caminhão Trator / Cavalo Mecânico / Caminhão rodoviário, NUNCA é trator agrícola!
  if (isCaminhao(rowOrVehicle)) {
    return false;
  }

  // Não pode ser ensiladeira ou reboque
  if (isEnsiladeira(rowOrVehicle) || isReboque(rowOrVehicle)) {
    return false;
  }

  const tipoLower = String(rowOrVehicle.tipo || rowOrVehicle.type || rowOrVehicle.categoryType || rowOrVehicle.categoria || '').toLowerCase().trim();
  const nomeLower = String(rowOrVehicle.nome || rowOrVehicle.name || '').toLowerCase().trim();
  const modeloLower = String(rowOrVehicle.modelo || rowOrVehicle.model || '').toLowerCase().trim();
  const fullText = `${tipoLower} ${nomeLower} ${modeloLower}`;

  // Deve ser trator agrícola (de pneu, esteira, lavoura, etc.)
  return (
    tipoLower.includes('trator') ||
    tipoLower.includes('agrícola') ||
    tipoLower.includes('agricola') ||
    tipoLower.includes('esteira') ||
    fullText.includes('trator de pneu') ||
    fullText.includes('trator de esteira') ||
    fullText.includes('trator agrícola') ||
    fullText.includes('trator agricola') ||
    fullText.includes('trator lavoura')
  );
}

export function matchVehicleCategory(v: any, categoryFilter: string): boolean {
  if (!categoryFilter || categoryFilter === 'todos') return true;
  if (categoryFilter === 'caminhao') return isCaminhao(v);
  if (categoryFilter === 'trator' || categoryFilter === 'trator_agricola') return isTratorAgricola(v);
  if (categoryFilter === 'ensiladeira') return isEnsiladeira(v);
  if (categoryFilter === 'reboque') return isReboque(v);
  return true;
}

export function getVehicleAxleConfigName(v: any, vTypes: VehicleTypeDefinition[]): string {
  if (!v) return 'Configuração de Eixos';

  // 1. Valores explícitos de eixos e pneus salvos no banco de dados (tabela gestao_frotas)
  const vEixos = Number(v.numero_eixos ?? v.numeroEixos);
  const vPneus = Number(v.quantidade_pneus ?? v.quantidadePneus);
  if (vEixos > 0 && vPneus > 0) {
    return `${vEixos} Eixos / ${vPneus} Rodas`;
  }

  // 2. Resolução através da configuração padrão ou associada ao tipo
  const resolved = resolveVehicleAxleConfig(v, null, vTypes);
  if (resolved) {
    if (resolved.totalAxles > 0 && resolved.totalTires > 0) {
      return `${resolved.totalAxles} Eixos / ${resolved.totalTires} Rodas`;
    }
    if (resolved.name) {
      const match = resolved.name.match(/^(\d+\s*Eixos?\s*\/\s*\d+\s*Rodas?)/i);
      if (match) return match[1];
      return resolved.name;
    }
  }

  return 'Configuração de Eixos';
}

function mapSupabaseRowToMachinery(row: any, fallbackMachineries: Machinery[]): Machinery {
  const matchLocal = fallbackMachineries.find((m) => m.id === row.id);
  const tipoLower = String(row.tipo || row.type || row.categoryType || '').toLowerCase();
  const nomeLower = String(row.nome || row.name || row.modelo || row.model || '').toLowerCase();
  
  // Maquinário agrícola autopropelido/lavoura (excluindo rigorosamente caminhão-trator rodoviário)
  const isAgricola = 
    !isCaminhao(row) &&
    (isTratorAgricola(row) || 
     isEnsiladeira(row) || 
     tipoLower.includes('forrageir') || 
     tipoLower.includes('maquina') ||
     nomeLower.includes('claas') || 
     nomeLower.includes('jaguar') || 
     nomeLower.includes('maq'));

  const cleanNome = (row.nome || row.name || '').replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();
  const cleanModel = (row.modelo || row.model || '').replace(/^(AGR[IÍ]COLA\s*[-–—:]*\s*)/i, '').trim();

  const explicitKm = row.km_atual ?? row.current_km ?? row.quilometragem ?? row.currentKm;
  const kmVal = (explicitKm !== undefined && explicitKm !== null)
    ? Number(explicitKm)
    : (!isAgricola && row.horimetro_ou_km_atual !== undefined && row.horimetro_ou_km_atual !== null
        ? Number(row.horimetro_ou_km_atual)
        : undefined);

  const explicitHour = row.horas_atual ?? row.horimetro_atual ?? row.hour_meter ?? row.hourmeter ?? row.hourMeter;
  const hourVal = (explicitHour !== undefined && explicitHour !== null)
    ? Number(explicitHour)
    : (isAgricola && row.horimetro_ou_km_atual !== undefined && row.horimetro_ou_km_atual !== null
        ? Number(row.horimetro_ou_km_atual)
        : (row.hourmeter !== undefined ? Number(row.hourmeter) : (row.hourMeter !== undefined ? Number(row.hourMeter) : undefined)));

  const eixosNum = row.numero_eixos !== undefined && row.numero_eixos !== null 
    ? Number(row.numero_eixos) 
    : (row.numeroEixos !== undefined && row.numeroEixos !== null ? Number(row.numeroEixos) : matchLocal?.numero_eixos);

  const pneusNum = row.quantidade_pneus !== undefined && row.quantidade_pneus !== null 
    ? Number(row.quantidade_pneus) 
    : (row.quantidadePneus !== undefined && row.quantidadePneus !== null ? Number(row.quantidadePneus) : matchLocal?.quantidade_pneus);

  return {
    ...matchLocal,
    ...row,
    id: row.id,
    name: cleanNome || cleanModel || matchLocal?.name || 'Veículo',
    nome: cleanNome || cleanModel || matchLocal?.nome || 'Veículo',
    model: cleanModel || matchLocal?.model || '',
    modelo: cleanModel || matchLocal?.modelo || '',
    categoryType: row.tipo || row.type || row.categoria || matchLocal?.categoryType || 'Caminhão',
    tipo: row.tipo || row.type || row.categoria || matchLocal?.tipo || 'Caminhão',
    licensePlateOrSerial: row.placa_ou_serie || row.plate_or_serial || matchLocal?.licensePlateOrSerial || '',
    placa_ou_serie: row.placa_ou_serie || row.plate_or_serial || matchLocal?.placa_ou_serie || '',
    hourMeter: hourVal ?? matchLocal?.hourMeter,
    currentKm: kmVal ?? matchLocal?.currentKm,
    numero_eixos: eixosNum,
    quantidade_pneus: pneusNum,
    numeroEixos: eixosNum,
    quantidadePneus: pneusNum,
    installedTires: matchLocal?.installedTires || [],
    status: row.status || matchLocal?.status || 'disponivel',
    maintenanceStatus: row.manutencao_status || matchLocal?.maintenanceStatus || 'ok',
  };
}

function resolveVehicleAxleConfig(
  vehicleRow: any,
  typeConfigFromDb: any,
  vTypes: VehicleTypeDefinition[]
): VehicleAxleConfig {
  if (!vehicleRow) return AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R;

  // 1. Prioridade A: Configuração vinda da tabela 'public.tipos_veiculos_config'
  if (typeConfigFromDb) {
    const eixos = Number(typeConfigFromDb.numero_eixos ?? typeConfigFromDb.total_eixos ?? typeConfigFromDb.totalAxles);
    const pneus = Number(typeConfigFromDb.quantidade_pneus ?? typeConfigFromDb.total_pneus ?? typeConfigFromDb.totalTires);
    if (eixos > 0 && pneus > 0) {
      return buildDynamicAxleConfig(eixos, pneus, vehicleRow.tipo, vehicleRow.nome);
    }
  }

  // 2. Prioridade B: Valores explícitos de eixos e pneus salvos na tabela 'public.gestao_frotas'
  const vEixos = Number(vehicleRow.numero_eixos ?? vehicleRow.numeroEixos);
  const vPneus = Number(vehicleRow.quantidade_pneus ?? vehicleRow.quantidadePneus);
  if (vEixos > 0 && vPneus > 0) {
    return buildDynamicAxleConfig(vEixos, vPneus, vehicleRow.tipo, vehicleRow.nome);
  }

  const tipoStr = String(vehicleRow.tipo || vehicleRow.type || vehicleRow.categoryType || '').toLowerCase();
  const nomeStr = String(vehicleRow.nome || vehicleRow.name || '').toLowerCase();
  const modeloStr = String(vehicleRow.modelo || vehicleRow.model || '').toLowerCase();
  const combined = `${tipoStr} ${nomeStr} ${modeloStr}`;

  // 3. Prioridade C: Cruzamento com as configurações cadastradas na janela "Configurar Eixos" (tabela de tipos)
  const matchedType = (vTypes || []).find((vt) => {
    if (!vt) return false;
    const vtName = String(vt.name || '').toLowerCase();
    const vtCat = String(vt.categoryKey || '').toLowerCase();
    return (
      (vehicleRow.vehicleTypeId && vt.id === vehicleRow.vehicleTypeId) ||
      (vtCat && tipoStr.includes(vtCat)) ||
      (vtName && tipoStr.includes(vtName)) ||
      (vtName && vtName.includes(tipoStr) && tipoStr.length > 2) ||
      (isEnsiladeira(vehicleRow) && (vtName.includes('ensilad') || vtCat.includes('ensilad'))) ||
      (isReboque(vehicleRow) && (vtName.includes('reboque') || vtCat.includes('reboque'))) ||
      (isTratorAgricola(vehicleRow) && (vtName.includes('trator') || vtCat.includes('trator'))) ||
      (isCaminhao(vehicleRow) && (vtName.includes('caminh') || vtCat.includes('caminh')))
    );
  });

  if (matchedType?.defaultAxleConfig) {
    return matchedType.defaultAxleConfig;
  }

  // 4. Prioridade D: Reconhecimento categórico das configurações padrão
  if (isEnsiladeira(vehicleRow) || combined.includes('ensilad') || combined.includes('forrageir') || combined.includes('jaguar') || combined.includes('maq 02') || combined.includes('maq02')) {
    return AXLE_CONFIG_ENSILADEIRA_AUTOPROPELIDA_2E_4R; // 2 Eixos e 4 Pneus (rodado simples)
  }
  if (isReboque(vehicleRow) || combined.includes('reboque') || combined.includes('prancha') || combined.includes('carreta') || combined.includes('transbordo')) {
    return AXLE_CONFIG_REBOQUE_PRANCHA_3E_12R; // 3 Eixos e 12 Pneus (rodado duplo)
  }
  // Se for Caminhão (incluindo Caminhão Trator / Cavalo Mecânico como Axor 2540 S)
  if (isCaminhao(vehicleRow)) {
    if (combined.includes('toco') || combined.includes('4x2')) {
      return AXLE_CONFIG_CAMINHAO_TOCO_2E_6R; // 2 Eixos e 6 Rodas
    }
    return AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R; // 3 Eixos e 10 Rodas (Padrão Cavalo Trucado 6x2 / 6x4 Axor)
  }
  if (isTratorAgricola(vehicleRow) || combined.includes('trator')) {
    return AXLE_CONFIG_TRATOR_AGRICOLA_2E_4R; // 2 Eixos e 4 Pneus
  }

  return AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R;
}

interface FleetTireRotationViewProps {
  machineries: Machinery[];
  employees?: Employee[];
  vehicleTypes: VehicleTypeDefinition[];
  tireRotationLogs: TireRotationLog[];
  companyProfile?: CompanyProfile;
  onSaveMachineries: (vehicles: Machinery[]) => void;
  onSaveVehicleTypes: (types: VehicleTypeDefinition[]) => void;
  onSaveTireRotationLogs: (logs: TireRotationLog[]) => void;
  onAddMaintenanceLog?: (log: any) => void;
  onAddExpense?: (expense: any) => void;
  onNavigateToFiscal?: () => void;
  onNavigate?: (tab: string) => void;
}

interface DraggedTirePayload {
  source: 'vehicle' | 'inventory';
  position?: string;
  tire: TireItem;
}

export const FleetTireRotationView: React.FC<FleetTireRotationViewProps> = ({
  machineries,
  employees = [],
  vehicleTypes,
  tireRotationLogs,
  companyProfile,
  onSaveMachineries,
  onSaveVehicleTypes,
  onSaveTireRotationLogs,
  onAddMaintenanceLog,
  onAddExpense,
  onNavigateToFiscal,
  onNavigate,
}) => {
  // ----------------------------------------------------
  // ESTADO DE SELEÇÃO DE VEÍCULO E FILTROS DINÂMICOS
  // ----------------------------------------------------
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(machineries[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');

  // Lista dinâmica vinda do Supabase (com fallback resiliente para machineries)
  const [dbVehicles, setDbVehicles] = useState<Machinery[]>(machineries);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Registro do veículo ativo buscado no Supabase ('public.gestao_frotas')
  const [selectedVehicleDb, setSelectedVehicleDb] = useState<any | null>(null);
  const [dynamicAxleConfig, setDynamicAxleConfig] = useState<VehicleAxleConfig | null>(null);
  const [isLoadingVehicleConfig, setIsLoadingVehicleConfig] = useState(false);

  // ----------------------------------------------------
  // INTEGRAÇÃO REATIVA: CONSULTA DE VEÍCULO & CONFIGURAÇÃO DE EIXOS
  // ----------------------------------------------------
  const loadVehicleConfigFromSupabase = useCallback(
    async (vId: string, currentVTypes?: VehicleTypeDefinition[]) => {
      if (!vId) return;
      setIsLoadingVehicleConfig(true);
      try {
        // 1. Busca na tabela física 'public.veiculos_maquinas'
        let vRow: any = null;
        if (isSupabaseConfigured) {
          let { data, error } = await supabase
            .from('veiculos_maquinas')
            .select('*')
            .eq('id', vId)
            .maybeSingle();

          if (error || !data) {
            const fallback = await supabase
              .from('gestao_frotas')
              .select('*')
              .eq('id', vId)
              .maybeSingle();
            if (!fallback.error && fallback.data) {
              data = fallback.data;
              error = null;
            }
          }

          if (!error && data) {
            vRow = data;
          }
        }

        const matchedLocal = machineries.find((m) => m.id === vId) || dbVehicles.find((m) => m.id === vId);
        const activeVehicleData = vRow ? mapSupabaseRowToMachinery(vRow, machineries) : matchedLocal;
        setSelectedVehicleDb(activeVehicleData);

        // 2. Cruzamento (JOIN / busca secundária) com 'public.tipos_veiculos_config'
        let typeConfigFromDb: any = null;
        if (isSupabaseConfigured && activeVehicleData && !isTableUnmigrated('tipos_veiculos_config')) {
          try {
            const { data: tData, error: tErr } = await supabase
              .from('tipos_veiculos_config')
              .select('*');

            if (tErr && (tErr.code === '42P01' || tErr.code === 'PGRST205' || (tErr as any).status === 404)) {
              markTableUnmigrated('tipos_veiculos_config');
            } else if (!tErr && tData && tData.length > 0) {
              const activeAny = activeVehicleData as any;
              const vTipo = String(activeAny.tipo || activeAny.categoryType || '').toLowerCase();
              const vCat = String(activeAny.categoria || '').toLowerCase();
              const vTipoId = activeAny.tipo_id || activeAny.vehicle_type_id || activeAny.tipoId || activeAny.vehicleTypeId;

              typeConfigFromDb = tData.find((tc: any) => 
                (vTipoId && (tc.id === vTipoId || tc.tipo_id === vTipoId)) ||
                (tc.nome && vTipo && String(tc.nome).toLowerCase() === vTipo) ||
                (tc.tipo && vTipo && String(tc.tipo).toLowerCase() === vTipo) ||
                (tc.categoria && vCat && String(tc.categoria).toLowerCase() === vCat) ||
                (tc.name && vTipo && String(tc.name).toLowerCase() === vTipo)
              );
            }
          } catch (err) {
            console.warn('tipos_veiculos_config secondary search notice:', err);
          }
        }

        // 3. Resolução reativa e dinâmica de eixos & pneus
        const resolvedConfig = resolveVehicleAxleConfig(
          activeVehicleData,
          typeConfigFromDb,
          currentVTypes || vehicleTypes
        );
        setDynamicAxleConfig(resolvedConfig);
      } catch (err) {
        console.warn('Error loading vehicle axle config from Supabase:', err);
      } finally {
        setIsLoadingVehicleConfig(false);
      }
    },
    [machineries, dbVehicles, vehicleTypes]
  );

  // Dispara busca ao selecionar veículo na lista
  useEffect(() => {
    if (selectedVehicleId) {
      loadVehicleConfigFromSupabase(selectedVehicleId);
    }
  }, [selectedVehicleId, loadVehicleConfigFromSupabase]);

  // ----------------------------------------------------
  // INTEGRAÇÃO REATIVA: FILTRO DE CATEGORIAS NO SUPABASE
  // ----------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    const fetchVehiclesByFilter = async () => {
      if (!isSupabaseConfigured) {
        // Fallback local caso Supabase não esteja disponível
        const localFiltered = machineries.filter((m) => matchVehicleCategory(m, categoryFilter));
        setDbVehicles(localFiltered);
        if (localFiltered.length > 0 && !localFiltered.some((v) => v.id === selectedVehicleId)) {
          setSelectedVehicleId(localFiltered[0].id);
        }
        return;
      }

      setIsLoadingList(true);
      try {
        if (categoryFilter !== 'todos') {
          let rows: any[] = [];

          if (categoryFilter === 'caminhao') {
            // Caminhões e Cavalos Mecânicos (incluindo Caminhão-Trator / Axor 2540 S)
            let q = supabase
              .from('veiculos_maquinas')
              .select('*')
              .or('tipo.ilike.%caminh%,tipo.ilike.%cavalo%,tipo.ilike.%tração%,tipo.ilike.%tracao%,tipo.ilike.%truck%,tipo.ilike.%toco%,tipo.ilike.%bitruck%,modelo.ilike.%axor%');

            let res = await q;
            if (res.error || !res.data || res.data.length === 0) {
              res = await supabase.from('veiculos_maquinas').select('*');
              if (res.error || !res.data || res.data.length === 0) {
                res = await supabase.from('gestao_frotas').select('*');
              }
            }
            if (res.data) {
              rows = res.data.filter((r: any) => isCaminhao(r));
            }
          } else if (categoryFilter === 'trator' || categoryFilter === 'trator_agricola') {
            // Tratores exclusivamente agrícolas (de lavoura / pneu ou esteira), excluindo rigorosamente qualquer caminhão-trator
            let q = supabase
              .from('veiculos_maquinas')
              .select('*')
              .or('tipo.ilike.%trator%,tipo.ilike.%agricola%,tipo.ilike.%agrícola%,tipo.ilike.%esteira%,tipo.ilike.%lavoura%')
              .not('tipo', 'ilike', '%caminh%')
              .not('tipo', 'ilike', '%cavalo%');

            let res = await q;
            if (res.error || !res.data || res.data.length === 0) {
              res = await supabase.from('veiculos_maquinas').select('*');
              if (res.error || !res.data || res.data.length === 0) {
                res = await supabase.from('gestao_frotas').select('*');
              }
            }
            if (res.data) {
              rows = res.data.filter((r: any) => isTratorAgricola(r));
            }
          } else if (categoryFilter === 'ensiladeira') {
            let q = supabase
              .from('veiculos_maquinas')
              .select('*')
              .or('tipo.ilike.%ensilad%,tipo.ilike.%forrageir%,tipo.ilike.%colhedora%,tipo.ilike.%jaguar%,modelo.ilike.%claas%,modelo.ilike.%jaguar%');

            let res = await q;
            if (res.error || !res.data || res.data.length === 0) {
              res = await supabase.from('veiculos_maquinas').select('*');
              if (res.error || !res.data || res.data.length === 0) {
                res = await supabase.from('gestao_frotas').select('*');
              }
            }
            if (res.data) {
              rows = res.data.filter((r: any) => isEnsiladeira(r));
            }
          } else if (categoryFilter === 'reboque') {
            let q = supabase
              .from('veiculos_maquinas')
              .select('*')
              .or('tipo.ilike.%reboque%,tipo.ilike.%prancha%,tipo.ilike.%transbordo%,tipo.ilike.%carreta%,tipo.ilike.%implemento%');

            let res = await q;
            if (res.error || !res.data || res.data.length === 0) {
              res = await supabase.from('veiculos_maquinas').select('*');
              if (res.error || !res.data || res.data.length === 0) {
                res = await supabase.from('gestao_frotas').select('*');
              }
            }
            if (res.data) {
              rows = res.data.filter((r: any) => isReboque(r));
            }
          }

          if (!isCancelled) {
            const mapped = rows.map((row: any) => mapSupabaseRowToMachinery(row, machineries));
            setDbVehicles(mapped);
            // Se o veículo atualmente selecionado não fizer parte do filtro, seleciona o primeiro retornado
            if (mapped.length > 0 && !mapped.some((v: Machinery) => v.id === selectedVehicleId)) {
              setSelectedVehicleId(mapped[0].id);
            }
          }
        } else {
          // 'todos': consulta completa ordenada na tabela física 'veiculos_maquinas'
          let res = await supabase
            .from('veiculos_maquinas')
            .select('*')
            .order('modelo', { ascending: true });

          if (res.error || !res.data || res.data.length === 0) {
            res = await supabase
              .from('gestao_frotas')
              .select('*')
              .order('nome', { ascending: true });
          }

          if (!isCancelled && res.data) {
            const mapped = res.data.map((row: any) => mapSupabaseRowToMachinery(row, machineries));
            setDbVehicles(mapped);
          }
        }
      } catch (err) {
        console.warn('Error querying veiculos_maquinas with category filter:', err);
        if (!isCancelled) {
          const localFiltered = machineries.filter((m) => matchVehicleCategory(m, categoryFilter));
          setDbVehicles(localFiltered);
          if (localFiltered.length > 0 && !localFiltered.some((v) => v.id === selectedVehicleId)) {
            setSelectedVehicleId(localFiltered[0].id);
          }
        }
      } finally {
        if (!isCancelled) setIsLoadingList(false);
      }
    };

    fetchVehiclesByFilter();

    return () => {
      isCancelled = true;
    };
  }, [categoryFilter, machineries]);

  // ----------------------------------------------------
  // ESTADO DE GESTÃO DE ESTOQUE, REFORMA E DESCARTE
  // ----------------------------------------------------
  const [tireInventory, setTireInventory] = useState<TireItem[]>(() => getStoredTireInventory());
  const [tiresInReform, setTiresInReform] = useState<TireItem[]>(() => {
    try {
      const rawPending = localStorage.getItem('colaca_silagem_pneus_aguardando_pedido');
      if (rawPending) {
        const parsed = JSON.parse(rawPending);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler pneus aguardando pedido:', e);
    }
    return getStoredTiresInReform();
  });
  const [tiresDiscarded, setTiresDiscarded] = useState<TireItem[]>(() => getStoredTiresDiscarded());
  const [tiresPendingDiscard, setTiresPendingDiscard] = useState<TireItem[]>(() => {
    try {
      const raw = localStorage.getItem('colaca_silagem_pneus_aguardando_descarte');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler pneus aguardando descarte:', e);
    }
    return [];
  });

  // Salvar alterações nos arrays de suporte
  useEffect(() => {
    saveStoredTireInventory(tireInventory);
  }, [tireInventory]);

  // Sincronização reativa quando novos pneus são cadastrados via Estoque ou Notas e Entradas
  useEffect(() => {
    const handleTireInvUpdated = (e?: any) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0 && e.detail[0]?.fireNumber) {
        setTireInventory(e.detail);
      } else {
        setTireInventory(getStoredTireInventory());
      }
    };
    window.addEventListener('tire_inventory_updated', handleTireInvUpdated);
    window.addEventListener('silagem_tire_inventory_updated', handleTireInvUpdated);
    window.addEventListener('colaca_silagem_estoque_produtos_updated', handleTireInvUpdated);
    window.addEventListener('storage', handleTireInvUpdated);
    return () => {
      window.removeEventListener('tire_inventory_updated', handleTireInvUpdated);
      window.removeEventListener('silagem_tire_inventory_updated', handleTireInvUpdated);
      window.removeEventListener('colaca_silagem_estoque_produtos_updated', handleTireInvUpdated);
      window.removeEventListener('storage', handleTireInvUpdated);
    };
  }, []);

  useEffect(() => {
    saveStoredTiresInReform(tiresInReform);
    try {
      localStorage.setItem('colaca_silagem_pneus_aguardando_pedido', JSON.stringify(tiresInReform));
    } catch {}
  }, [tiresInReform]);

  useEffect(() => {
    saveStoredTiresDiscarded(tiresDiscarded);
  }, [tiresDiscarded]);

  useEffect(() => {
    try {
      localStorage.setItem('colaca_silagem_pneus_aguardando_descarte', JSON.stringify(tiresPendingDiscard));
    } catch {}
  }, [tiresPendingDiscard]);

  // ----------------------------------------------------
  // ESTADO DRAG AND DROP
  // ----------------------------------------------------
  const [draggedItem, setDraggedItem] = useState<DraggedTirePayload | null>(null);
  const [hoveredDropZone, setHoveredDropZone] = useState<string | null>(null);

  // Seleção de clique alternativo (Touch / Clique direto)
  const [selectedTireForAction, setSelectedTireForAction] = useState<DraggedTirePayload | null>(null);

  // ----------------------------------------------------
  // MODAIS E GAVETAS
  // ----------------------------------------------------
  const [inspectingTire, setInspectingTire] = useState<TireItem | null>(null);
  const [isTypesConfigOpen, setIsTypesConfigOpen] = useState(false);
  const [isNewInventoryModalOpen, setIsNewInventoryModalOpen] = useState(false);
  const [discardModalData, setDiscardModalData] = useState<{ tire: TireItem; source: 'vehicle' | 'inventory' } | null>(null);
  const [returnReformTire, setReturnReformTire] = useState<TireItem | null>(null);
  const [viewingPrintLog, setViewingPrintLog] = useState<TireRotationLog | null>(null);
  const [isExecutionDrawerOpen, setIsExecutionDrawerOpen] = useState(false);
  const [isDiscardHistoryModalOpen, setIsDiscardHistoryModalOpen] = useState(false);

  // ----------------------------------------------------
  // VEÍCULO ATIVO & CONFIGURAÇÃO DINÂMICA DE EIXOS
  // ----------------------------------------------------
  const selectedVehicle = useMemo(() => {
    const fromDbList = dbVehicles.find((m) => m.id === selectedVehicleId);
    const fromMachineries = machineries.find((m) => m.id === selectedVehicleId);
    const base = fromDbList || fromMachineries || selectedVehicleDb || machineries[0] || null;
    if (base && selectedVehicleDb && selectedVehicleDb.id === selectedVehicleId) {
      return {
        ...base,
        ...selectedVehicleDb,
        installedTires: base.installedTires || selectedVehicleDb.installedTires || [],
      };
    }
    return base;
  }, [dbVehicles, machineries, selectedVehicleId, selectedVehicleDb]);

  const axleConfig: VehicleAxleConfig = useMemo(() => {
    if (dynamicAxleConfig) return dynamicAxleConfig;
    if (!selectedVehicle) return AXLE_CONFIG_CAMINHAO_TRUCADO_3E_10R;
    return resolveVehicleAxleConfig(selectedVehicle, null, vehicleTypes);
  }, [dynamicAxleConfig, selectedVehicle, vehicleTypes]);

  // Lista de pneus instalados no veículo atual
  const currentTires: TireItem[] = useMemo(() => {
    if (!selectedVehicle) return [];
    if (selectedVehicle.installedTires && selectedVehicle.installedTires.length > 0) {
      return selectedVehicle.installedTires;
    }
    return [];
  }, [selectedVehicle]);

  // Mapa de posições ocupadas no veículo
  const tiresByPosition = useMemo(() => {
    const map = new Map<string, TireItem>();
    currentTires.forEach((t) => {
      if (t.position) map.set(t.position, t);
    });
    return map;
  }, [currentTires]);

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

  // Estatísticas do veículo ativo
  const vehicleStats = useMemo(() => {
    const totalSlots = allAxlePositions.length;
    const mountedTires = currentTires.filter((t) => t.status === 'em_uso' && t.position);
    const mountedCount = mountedTires.length;
    const emptyCount = Math.max(0, totalSlots - mountedCount);
    const avgTread = mountedCount > 0 
      ? mountedTires.reduce((acc, t) => acc + (t.treadDepthMm || 0), 0) / mountedCount 
      : 0;

    const criticalCount = mountedTires.filter((t) => (t.treadDepthMm || 0) <= 3.0).length;
    const warningCount = mountedTires.filter((t) => (t.treadDepthMm || 0) > 3.0 && (t.treadDepthMm || 0) <= 6.0).length;

    return { totalSlots, mountedCount, emptyCount, avgTread, criticalCount, warningCount };
  }, [allAxlePositions, currentTires]);

  // Filtro de Veículos da coluna esquerda baseado no resultado do banco
  const filteredVehicles = useMemo(() => {
    const baseSource = (dbVehicles.length > 0 ? dbVehicles : machineries).filter((m) =>
      matchVehicleCategory(m, categoryFilter)
    );
    const q = String(searchQuery || '').trim().toLowerCase();
    return baseSource.filter((m) => {
      if (!m) return false;
      const mName = String(m.name || '').toLowerCase();
      const mPlate = String(m.licensePlateOrSerial || '').toLowerCase();
      const mModel = String(m.model || '').toLowerCase();

      return !q || mName.includes(q) || mPlate.includes(q) || mModel.includes(q);
    });
  }, [dbVehicles, machineries, categoryFilter, searchQuery]);

  // ----------------------------------------------------
  // FUNÇÕES DE ATUALIZAÇÃO DO VEÍCULO ATUAL
  // ----------------------------------------------------
  const updateCurrentVehicleTires = (newTiresList: TireItem[]) => {
    if (!selectedVehicle) return;
    const updatedMachineries = machineries.map((m) => {
      if (m.id === selectedVehicle.id) {
        return {
          ...m,
          installedTires: newTiresList,
        };
      }
      return m;
    });
    onSaveMachineries(updatedMachineries);

    // Atualiza também na lista local sincronizada
    setDbVehicles((prev) =>
      prev.map((m) => (m.id === selectedVehicle.id ? { ...m, installedTires: newTiresList } : m))
    );
  };

  // ----------------------------------------------------
  // HANDLERS DE DRAG AND DROP
  // ----------------------------------------------------
  const handleDragStart = (
    e: React.DragEvent,
    payload: DraggedTirePayload
  ) => {
    setDraggedItem(payload);
    setSelectedTireForAction(null);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        source: payload.source,
        position: payload.position,
        tireId: payload.tire.id,
      }));
    } catch {
      // ignore
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setHoveredDropZone(null);
  };

  // 1. SOLTAR PNEU EM UM SLOT DO VEÍCULO (pos)
  const handleDropOnVehicleSlot = (targetPos: string, e: React.DragEvent) => {
    e.preventDefault();
    setHoveredDropZone(null);
    if (!draggedItem) return;

    const { source, position: sourcePos, tire: sourceTire } = draggedItem;
    const existingTireAtTarget = tiresByPosition.get(targetPos);

    if (source === 'vehicle' && sourcePos) {
      if (sourcePos === targetPos) return;

      // Movimentação interna no veículo
      let updatedList = [...currentTires];

      if (existingTireAtTarget) {
        // TROCA (SWAP) entre sourcePos e targetPos
        updatedList = updatedList.map((t) => {
          if (t.id === sourceTire.id) {
            return { ...t, position: targetPos, positionName: getPositionReadableLabel(targetPos) };
          }
          if (t.id === existingTireAtTarget.id) {
            return { ...t, position: sourcePos, positionName: getPositionReadableLabel(sourcePos) };
          }
          return t;
        });
      } else {
        // Move para slot vazio
        updatedList = updatedList.map((t) => {
          if (t.id === sourceTire.id) {
            return { ...t, position: targetPos, positionName: getPositionReadableLabel(targetPos) };
          }
          return t;
        });
      }

      updateCurrentVehicleTires(updatedList);
    } else if (source === 'inventory') {
      // Montagem de pneu do Estoque no Veículo
      let updatedVehicleTires = [...currentTires];
      let updatedInventory = tireInventory.filter((t) => t.id !== sourceTire.id);

      if (existingTireAtTarget) {
        // Pneu que estava no slot é deslocado para o estoque
        const displacedTire: TireItem = {
          ...existingTireAtTarget,
          position: 'estoque',
          positionName: 'Estoque / Disponível',
          status: 'estoque',
        };
        updatedInventory = [displacedTire, ...updatedInventory];
        updatedVehicleTires = updatedVehicleTires.filter((t) => t.id !== existingTireAtTarget.id);
      }

      // Adiciona o novo pneu na posição do veículo
      const mountedTire: TireItem = {
        ...sourceTire,
        position: targetPos,
        positionName: getPositionReadableLabel(targetPos),
        status: 'em_uso',
        installationDate: new Date().toISOString().split('T')[0],
        installationKm: selectedVehicle?.currentKm,
        installationHourMeter: selectedVehicle?.currentHourMeter,
      };

      updatedVehicleTires.push(mountedTire);

      updateCurrentVehicleTires(updatedVehicleTires);
      setTireInventory(updatedInventory);
    }

    setDraggedItem(null);
  };

  // 2. SOLTAR PNEU NA CAIXA 1 (ESTOQUE)
  const handleDropOnInventoryBox = (e: React.DragEvent) => {
    e.preventDefault();
    setHoveredDropZone(null);
    if (!draggedItem) return;

    const { source, position: sourcePos, tire } = draggedItem;

    if (source === 'vehicle' && sourcePos) {
      // Remove do veículo (slot fica vazio)
      const updatedVehicleTires = currentTires.filter((t) => t.id !== tire.id);
      updateCurrentVehicleTires(updatedVehicleTires);

      // Adiciona ao estoque
      const stockTire: TireItem = {
        ...tire,
        position: 'estoque',
        positionName: 'Estoque / Disponível',
        status: 'estoque',
      };
      setTireInventory((prev) => [stockTire, ...prev.filter((t) => t.id !== tire.id)]);
    }

    setDraggedItem(null);
  };

  // 3. SOLTAR PNEU NA CAIXA 2 (ENVIAR PARA REFORMA)
  const handleDropOnSendReformBox = (e: React.DragEvent) => {
    e.preventDefault();
    setHoveredDropZone(null);
    if (!draggedItem) return;

    const { source, position: sourcePos, tire } = draggedItem;

    if (source === 'vehicle' && sourcePos) {
      const updatedVehicleTires = currentTires.filter((t) => t.id !== tire.id);
      updateCurrentVehicleTires(updatedVehicleTires);
    } else if (source === 'inventory') {
      setTireInventory((prev) => prev.filter((t) => t.id !== tire.id));
    }

    // Adiciona na lista de reforma
    const reformTire: TireItem = {
      ...tire,
      position: 'reforma',
      positionName: 'Em Reforma / Recapagem',
      status: 'reforma',
      reformSentDate: new Date().toISOString().split('T')[0],
      reformWorkshop: 'Recapadora Credenciada',
      reformCost: 0,
      motivo_reforma: (tire.motivo_reforma || '').toUpperCase(),
      servico_reforma: tire.servico_reforma || 'RECAPAGEM / REPROMISSÃO DE BANDA',
      valor_reforma: tire.valor_reforma || 0,
      vehicleId: selectedVehicle?.id,
      vehiclePlate: selectedVehicle?.licensePlateOrSerial,
      vehicleName: selectedVehicle?.name,
    };

    setTiresInReform((prev) => {
      const updated = [reformTire, ...prev.filter((t) => t.id !== tire.id)];
      try {
        localStorage.setItem('colaca_silagem_pneus_aguardando_pedido', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setDraggedItem(null);
  };

  // 3.0.1 Atualizar Motivo da Reforma digitado pelo operador
  const handleUpdateMotivoReforma = (tireId: string, motivo: string) => {
    const upper = motivo.toUpperCase();
    setTiresInReform((prev) => {
      const updated = prev.map((t) => (t.id === tireId ? { ...t, motivo_reforma: upper, notes: upper } : t));
      try {
        localStorage.setItem('colaca_silagem_pneus_aguardando_pedido', JSON.stringify(updated));
      } catch {}
      saveStoredTiresInReform(updated);
      return updated;
    });
  };

  // 3.0.2 Cancelar / Devolver pneu da reforma para o estoque
  const handleCancelPendingReform = (tireId: string) => {
    const target = tiresInReform.find((t) => t.id === tireId);
    if (!target) return;

    const restoredTire: TireItem = {
      ...target,
      position: 'estoque',
      positionName: 'Estoque / Disponível',
      status: 'estoque',
    };
    setTireInventory((prev) => [restoredTire, ...prev.filter((t) => t.id !== tireId)]);
    setTiresInReform((prev) => {
      const remaining = prev.filter((t) => t.id !== tireId);
      try {
        localStorage.setItem('colaca_silagem_pneus_aguardando_pedido', JSON.stringify(remaining));
      } catch {}
      saveStoredTiresInReform(remaining);
      return remaining;
    });
  };

  // 3.1 GERAÇÃO DE PEDIDO DE REFORMA NO MÓDULO NOTAS E ENTRADAS
  const handleGerarPedidoReforma = () => {
    if (tiresInReform.length === 0) return;

    // 1. Salva a array acumulada na chave 'colaca_silagem_pneus_aguardando_pedido'
    try {
      localStorage.setItem('colaca_silagem_pneus_aguardando_pedido', JSON.stringify(tiresInReform));
      localStorage.setItem('colaca_silagem_abrir_pedido_reforma', 'true');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('colaca_silagem_abrir_pedido_reforma', {
          detail: { tires: tiresInReform }
        }));
      }
    } catch (e) {
      console.warn('Erro ao salvar pneus para pedido de reforma:', e);
    }

    // 2. Mude a aba ativa do sistema para o módulo "Notas e Entradas" (fiscal)
    if (onNavigate) {
      onNavigate('fiscal');
    } else if (onNavigateToFiscal) {
      onNavigateToFiscal();
    } else {
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'fiscal' }));
    }
  };

  // 4. SOLTAR PNEU NA CAIXA 4 (LIXEIRA / DESCARTE)
  const handleDropOnDiscardBox = (e: React.DragEvent) => {
    e.preventDefault();
    setHoveredDropZone(null);
    if (!draggedItem) return;

    const { source, position: sourcePos, tire } = draggedItem;

    if (source === 'vehicle' && sourcePos) {
      const updatedVehicleTires = currentTires.filter((t) => t.id !== tire.id);
      updateCurrentVehicleTires(updatedVehicleTires);
    } else if (source === 'inventory') {
      setTireInventory((prev) => prev.filter((t) => t.id !== tire.id));
    }

    const pendingDiscardTire: TireItem = {
      ...tire,
      position: 'descarte',
      positionName: 'Descarte / Sucata',
      status: 'descartado',
      discardDate: new Date().toISOString().split('T')[0],
      motivo_descarte: tire.motivo_descarte || '',
      discardReason: tire.motivo_descarte || '',
      vehicleId: selectedVehicle?.id,
      vehiclePlate: selectedVehicle?.licensePlateOrSerial,
      vehicleName: selectedVehicle?.name,
    };

    setTiresPendingDiscard((prev) => {
      const updated = [pendingDiscardTire, ...prev.filter((t) => t.id !== tire.id)];
      try {
        localStorage.setItem('colaca_silagem_pneus_aguardando_descarte', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setDraggedItem(null);
  };

  // 4.1 Atualizar Motivo do Descarte / Sucata digitado pelo operador
  const handleUpdateMotivoDescarte = (tireId: string, motivo: string) => {
    const upper = motivo.toUpperCase();
    setTiresPendingDiscard((prev) => {
      const updated = prev.map((t) => (t.id === tireId ? { ...t, motivo_descarte: upper, discardReason: upper, discardNotes: upper } : t));
      try {
        localStorage.setItem('colaca_silagem_pneus_aguardando_descarte', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // 4.2 Consolidar Baixa Definitiva (salva no histórico de descartados)
  const handleConsolidarBaixa = (tireId?: string) => {
    const toConsolidate = tireId
      ? tiresPendingDiscard.filter((t) => t.id === tireId)
      : tiresPendingDiscard;

    if (toConsolidate.length === 0) return;

    const finalizedList: TireItem[] = toConsolidate.map((t) => ({
      ...t,
      position: 'descarte',
      positionName: 'Descartado / Sucata',
      status: 'descartado',
      discardReason: t.motivo_descarte?.trim() || t.discardReason || 'Baixa definitiva / Sucata',
      discardNotes: t.motivo_descarte?.trim() || t.discardNotes || '',
      motivo_descarte: t.motivo_descarte?.trim() || t.discardReason || 'Baixa definitiva / Sucata',
      discardDate: t.discardDate || new Date().toISOString().split('T')[0],
    }));

    setTiresDiscarded((prev) => {
      const updated = [...finalizedList, ...prev.filter((d) => !toConsolidate.some((c) => c.id === d.id))];
      saveStoredTiresDiscarded(updated);
      return updated;
    });

    setTiresPendingDiscard((prev) => {
      const remaining = prev.filter((p) => !toConsolidate.some((c) => c.id === p.id));
      try {
        localStorage.setItem('colaca_silagem_pneus_aguardando_descarte', JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
  };

  // 4.3 Cancelar / Devolver pneu da lixeira pendente para o estoque
  const handleCancelPendingDiscard = (tireId: string) => {
    const target = tiresPendingDiscard.find((t) => t.id === tireId);
    if (!target) return;

    const restoredTire: TireItem = {
      ...target,
      position: 'estoque',
      positionName: 'Estoque / Disponível',
      status: 'estoque',
    };
    setTireInventory((prev) => [restoredTire, ...prev.filter((t) => t.id !== tireId)]);
    setTiresPendingDiscard((prev) => {
      const remaining = prev.filter((t) => t.id !== tireId);
      try {
        localStorage.setItem('colaca_silagem_pneus_aguardando_descarte', JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
  };

  // Confirmação do Descarte no Modal (Fallback)
  const handleConfirmDiscard = (
    tire: TireItem,
    reason: string,
    notes: string
  ) => {
    if (discardModalData?.source === 'vehicle') {
      const updatedVehicleTires = currentTires.filter((t) => t.id !== tire.id);
      updateCurrentVehicleTires(updatedVehicleTires);
    } else {
      setTireInventory((prev) => prev.filter((t) => t.id !== tire.id));
    }

    const discardedItem: TireItem = {
      ...tire,
      position: 'descarte',
      positionName: 'Descartado / Sucata',
      status: 'descartado',
      discardReason: reason,
      discardDate: new Date().toISOString().split('T')[0],
      discardNotes: notes,
      motivo_descarte: reason,
    };

    setTiresDiscarded((prev) => {
      const updated = [discardedItem, ...prev];
      saveStoredTiresDiscarded(updated);
      return updated;
    });
    setDiscardModalData(null);
  };

  // Retorno de Pneu da Reforma para o Estoque
  const handleConfirmReturnFromReform = (
    tire: TireItem,
    newTreadMm: number,
    retreadIncrement: number,
    cost?: number,
    notes?: string
  ) => {
    // Remove da lista de reforma
    setTiresInReform((prev) => prev.filter((t) => t.id !== tire.id));

    // Adiciona ao estoque renovado
    const returnedTire: TireItem = {
      ...tire,
      position: 'estoque',
      positionName: 'Estoque / Disponível',
      status: 'estoque',
      treadDepthMm: newTreadMm,
      retreadCount: (tire.retreadCount || 0) + retreadIncrement,
      reformCost: cost || tire.reformCost,
      notes: notes ? `${tire.notes || ''} [Recape: ${notes}]` : tire.notes,
    };

    setTireInventory((prev) => [returnedTire, ...prev]);
    setReturnReformTire(null);
  };

  // Cadastrar Novo Pneu no Estoque
  const handleSaveNewInventoryTire = (newTire: TireItem) => {
    setTireInventory((prev) => [newTire, ...prev]);
  };

  // Salvar Inspeção / Edição de Pneu
  const handleSaveTireInspection = (updatedTire: TireItem) => {
    if (updatedTire.status === 'em_uso' && updatedTire.position !== 'estoque' && updatedTire.position !== 'reforma') {
      const updatedVehicleTires = currentTires.map((t) => (t.id === updatedTire.id ? updatedTire : t));
      updateCurrentVehicleTires(updatedVehicleTires);
    } else if (updatedTire.status === 'estoque' || updatedTire.position === 'estoque') {
      setTireInventory((prev) => prev.map((t) => (t.id === updatedTire.id ? updatedTire : t)));
    } else if (updatedTire.status === 'reforma') {
      setTiresInReform((prev) => prev.map((t) => (t.id === updatedTire.id ? updatedTire : t)));
    }
    setInspectingTire(null);
  };

  // ----------------------------------------------------
  // GAVETA DE GRAVAÇÃO DE O.S. DE RODÍZIO
  // ----------------------------------------------------
  const [execDate, setExecDate] = useState(new Date().toISOString().split('T')[0]);
  const [execKm, setExecKm] = useState<string>('');
  const [execHourMeter, setExecHourMeter] = useState<string>('');
  const [execOperatorName, setExecOperatorName] = useState('');
  const [execServiceProvider, setExecServiceProvider] = useState('Oficina Própria / Borracharia Interna');
  const [execCost, setExecCost] = useState<string>('0');
  const [execNotes, setExecNotes] = useState('');

  useEffect(() => {
    if (selectedVehicle) {
      setExecKm(selectedVehicle.currentKm ? String(selectedVehicle.currentKm) : '');
      setExecHourMeter(selectedVehicle.currentHourMeter ? String(selectedVehicle.currentHourMeter) : '');
    }
  }, [selectedVehicle]);

  const handleExecuteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    const newLog: TireRotationLog = {
      id: `rot_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      vehicleId: selectedVehicle.id,
      vehiclePlate: selectedVehicle.licensePlateOrSerial || selectedVehicle.name,
      vehicleModel: selectedVehicle.model || selectedVehicle.name,
      date: execDate,
      kmAtRotation: parseFloat(execKm) || selectedVehicle.currentKm || 0,
      hourMeterAtRotation: parseFloat(execHourMeter) || selectedVehicle.currentHourMeter || 0,
      rotationType: 'personalizado',
      rotationTypeName: 'Rodízio Manual / Remanejamento Interativo',
      tireMovements: currentTires.map((t) => ({
        tireId: t.id,
        fireNumber: t.fireNumber || t.id,
        fromPosition: t.position,
        toPosition: t.position,
        treadDepthMm: t.treadDepthMm,
      })),
      operatorName: execOperatorName || 'Encarregado de Frota',
      serviceProvider: execServiceProvider,
      cost: parseFloat(execCost) || 0,
      notes: execNotes || 'Rodízio e remanejamento manual de pneus realizado via painel interativo.',
      createdAt: new Date().toISOString(),
    };

    onSaveTireRotationLogs([newLog, ...tireRotationLogs]);

    // Atualiza KM/Horímetro do veículo se preenchido
    if (execKm || execHourMeter) {
      const updatedMachineries = machineries.map((m) => {
        if (m.id === selectedVehicle.id) {
          return {
            ...m,
            currentKm: parseFloat(execKm) || m.currentKm,
            currentHourMeter: parseFloat(execHourMeter) || m.currentHourMeter,
          };
        }
        return m;
      });
      onSaveMachineries(updatedMachineries);
    }

    setIsExecutionDrawerOpen(false);
    setViewingPrintLog(newLog);
  };

  return (
    <div className="space-y-4">

      {/* ========================================================
          CABEÇALHO COMPACTO DO MÓDULO DE RODÍZIO DE PNEUS
          ======================================================== */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs">
            <CircleDot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-black text-stone-900 dark:text-stone-100 tracking-tight font-['Outfit']">
                Painel Interativo de Rodízio &amp; Gestão de Pneus
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 uppercase">
                Drag &amp; Drop Ativo
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Botão Configurar Tipos e Eixos */}
          <button
            type="button"
            onClick={() => setIsTypesConfigOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-stone-500" />
            <span>Configurar Eixos</span>
          </button>

          {/* Botão Histórico de Baixas */}
          <button
            type="button"
            onClick={() => setIsDiscardHistoryModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Baixas ({tiresDiscarded.length})</span>
          </button>

          {/* Botão Gravar O.S. */}
          <button
            type="button"
            onClick={() => setIsExecutionDrawerOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Gravar O.S. / Rodízio</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          GRID PRINCIPAL EM 3 COLUNAS
          Coluna 1: Veículos (280px)
          Coluna 2: Chassi do Caminhão com Pneus Arrastáveis (Centro)
          Coluna 3: As 4 Caixas de Gestão e Destino (Direita)
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ----------------------------------------------------
            COLUNA 1 (3 Colunas no Grid LG): SELEÇÃO DE VEÍCULOS
            ---------------------------------------------------- */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-3.5 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col h-full max-h-[820px]">
            
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                Veículos da Frota ({filteredVehicles.length})
              </span>
              <span className="text-[10px] font-bold text-stone-500">
                Selecione o chassi
              </span>
            </div>

            {/* Campo de Busca */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar placa, prefixo, modelo..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Filtros rápidos de categoria reativos (Consultam o Supabase diretamente) */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 mb-2 scrollbar-none">
              {[
                { key: 'todos', label: 'Todos' },
                { key: 'caminhao', label: 'Caminhão' },
                { key: 'trator', label: 'Trator Agrícola' },
                { key: 'ensiladeira', label: 'Ensiladeira' },
                { key: 'reboque', label: 'Reboque' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategoryFilter(key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition cursor-pointer ${
                    categoryFilter === key
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Lista com scroll de veículos */}
            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {isLoadingList ? (
                <div className="text-center py-8 text-stone-400 text-xs flex flex-col items-center justify-center space-y-2">
                  <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Atualizando lista do Supabase...</span>
                </div>
              ) : filteredVehicles.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  Nenhum veículo encontrado
                </div>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const isSelected = vehicle.id === selectedVehicleId;
                  const vTires = vehicle.installedTires || [];
                  const mountedCount = vTires.filter((t) => t.status === 'em_uso' && t.position).length;
                  const axleConfigLabel = getVehicleAxleConfigName(vehicle, vehicleTypes);

                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      onClick={() => setSelectedVehicleId(vehicle.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/80 dark:bg-sky-950/50 shadow-xs ring-1 ring-sky-400'
                          : 'border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black text-stone-900 dark:text-stone-100 truncate">
                            {vehicle.licensePlateOrSerial || vehicle.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                            {vehicle.categoryType || 'frota'}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 truncate">
                          {vehicle.name} {vehicle.model ? `• ${vehicle.model}` : ''}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-stone-400">
                          <span>{vehicle.currentKm ? `${vehicle.currentKm.toLocaleString()} km` : `${vehicle.currentHourMeter || 0} h`}</span>
                          <span>•</span>
                          <span 
                            className="font-semibold text-sky-600 dark:text-sky-400 truncate"
                            title={axleConfigLabel}
                          >
                            {mountedCount > 0 ? `${axleConfigLabel} (${mountedCount} pneus)` : axleConfigLabel}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className={`w-4 h-4 shrink-0 transition ${isSelected ? 'text-sky-600 translate-x-0.5' : 'text-stone-300'}`} />
                    </button>
                  );
                })
              )}
            </div>

            {/* Rodapé da Coluna Esquerda */}
            <div className="pt-2 mt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500">
              <span>Total da frota:</span>
              <span className="font-black text-stone-800 dark:text-stone-200">{machineries.length} veículos</span>
            </div>

          </div>
        </div>

        {/* ----------------------------------------------------
            COLUNA 2 (5 Colunas no Grid LG): CHASSI INTERATIVO
            ---------------------------------------------------- */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col h-full max-h-[820px] overflow-hidden">
            
            {/* Header do Chassi */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <span>{selectedVehicle?.licensePlateOrSerial || selectedVehicle?.name}</span>
                      {isLoadingVehicleConfig && (
                        <div className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" title="Sincronizando com Supabase..." />
                      )}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      {axleConfig.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    {axleConfig.axles.length} Eixos • {allAxlePositions.length} Posições de Rodagem
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-stone-400 block">Sulco Médio</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {vehicleStats.avgTread.toFixed(1)} mm
                </span>
              </div>
            </div>

            {/* Dica de usabilidade do Drag & Drop */}
            <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-900/60 flex items-center justify-between text-[11px] text-sky-800 dark:text-sky-300">
              <div className="flex items-center space-x-1.5">
                <GripVertical className="w-3.5 h-3.5 text-sky-600" />
                <span>Arraste pneus entre eixos para rodízio ou para os painéis à direita.</span>
              </div>
              <span className="font-bold text-[10px] bg-sky-200 dark:bg-sky-900/80 px-1.5 py-0.2 rounded">
                {vehicleStats.mountedCount}/{vehicleStats.totalSlots} montados
              </span>
            </div>

            {/* CHASSI VISUAL COM EIXOS (Canvas Interativo com Scroll suave) */}
            <div className="my-3 flex-1 overflow-y-auto px-2 py-2 flex flex-col items-center bg-stone-50/70 dark:bg-stone-950/40 rounded-xl border border-stone-200/60 dark:border-stone-800/60 relative">
              
              {/* Cabine Dianteira */}
              <div className="w-36 h-8 rounded-t-xl bg-gradient-to-b from-stone-800 to-stone-700 dark:from-stone-700 dark:to-stone-800 border border-stone-600 flex items-center justify-center shadow-xs mb-3">
                <span className="text-[10px] font-black tracking-widest text-stone-200 uppercase font-mono">
                  ▲ FRENTE / CABINE
                </span>
              </div>

              {/* Linha Central do Chassi / Cardan */}
              <div className="relative w-full max-w-sm space-y-6 pb-4">
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-3 bg-stone-300 dark:bg-stone-700 rounded-full z-0 opacity-60"></div>

                {/* Renderização de Cada Eixo */}
                {axleConfig.axles.map((axle) => {
                  const isFront = axle.axleNumber === 1;

                  return (
                    <div key={axle.axleNumber} className="relative z-10 space-y-1">
                      
                      {/* Título do Eixo */}
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">
                          Eixo {axle.axleNumber} • {axle.name}
                        </span>
                        <span className="text-[9px] font-bold text-stone-400">
                          {axle.type === 'dual' ? 'Rodado Duplo' : 'Rodado Simples'}
                        </span>
                      </div>

                      {/* Estrutura do Eixo (Barra Metálica com Pneus) */}
                      <div className="relative flex items-center justify-between p-2 rounded-xl bg-white/90 dark:bg-stone-900/90 border border-stone-300/80 dark:border-stone-700/80 shadow-2xs">
                        
                        {/* Barra metálica do eixo */}
                        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1.5 bg-stone-400 dark:bg-stone-600 rounded-full z-0"></div>

                        {/* LADO ESQUERDO (E ou EE/EI) */}
                        <div className="relative z-10 flex items-center space-x-1.5">
                          {axle.type === 'single' ? (
                            renderInteractiveTireSlot(axle.tirePositions[0])
                          ) : (
                            <>
                              {renderInteractiveTireSlot(axle.tirePositions[0])} {/* EE */}
                              {renderInteractiveTireSlot(axle.tirePositions[1])} {/* EI */}
                            </>
                          )}
                        </div>

                        {/* Centro do Diferencial / Cubo Central */}
                        <div className="relative z-10 w-7 h-7 rounded-full bg-stone-700 dark:bg-stone-800 border-2 border-stone-400 dark:border-stone-600 flex items-center justify-center shadow-xs">
                          <span className="text-[8px] font-black text-stone-200 font-mono">E{axle.axleNumber}</span>
                        </div>

                        {/* LADO DIREITO (D ou DI/DD) */}
                        <div className="relative z-10 flex items-center space-x-1.5">
                          {axle.type === 'single' ? (
                            renderInteractiveTireSlot(axle.tirePositions[1])
                          ) : (
                            <>
                              {renderInteractiveTireSlot(axle.tirePositions[2])} {/* DI */}
                              {renderInteractiveTireSlot(axle.tirePositions[3])} {/* DD */}
                            </>
                          )}
                        </div>

                      </div>

                    </div>
                  );
                })}

              </div>

              {/* Traseira do Chassi */}
              <div className="w-28 h-3 rounded-b-md bg-stone-700 dark:bg-stone-800 border border-stone-600 flex items-center justify-center mt-1">
                <span className="text-[8px] font-bold text-stone-300 font-mono">TRASEIRA</span>
              </div>

            </div>

            {/* Barra Inferior com Legenda de Cores de Sulco */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-[10px]">
              <span className="font-bold text-stone-500">Condição do Sulco:</span>
              <div className="flex items-center space-x-2">
                <span className="flex items-center space-x-1 text-emerald-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>&gt;10mm</span>
                </span>
                <span className="flex items-center space-x-1 text-amber-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>4-6mm</span>
                </span>
                <span className="flex items-center space-x-1 text-rose-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>&lt;3mm</span>
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* ----------------------------------------------------
            COLUNA 3 (4 Colunas no Grid LG): AS 4 CAIXAS DE GESTÃO E DESTINO
            1. PNEUS DISPONÍVEIS (ESTOQUE)
            2. ENVIAR PARA REFORMA (DROP ZONE)
            3. PNEUS EM REFORMA (LISTA COM BOTÃO "PRONTO")
            4. LIXEIRA (DESCARTE / DROP ZONE)
            ---------------------------------------------------- */}
        <div className="lg:col-span-4 space-y-3">
          
          {/* ========================================================
              CAIXA 1: PNEUS DISPONÍVEIS (ESTOQUE)
              ======================================================== */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setHoveredDropZone('box_inventory');
            }}
            onDragLeave={() => {
              if (hoveredDropZone === 'box_inventory') setHoveredDropZone(null);
            }}
            onDrop={handleDropOnInventoryBox}
            className={`rounded-2xl p-3 border transition flex flex-col max-h-[260px] ${
              hoveredDropZone === 'box_inventory'
                ? 'border-sky-500 bg-sky-50/90 dark:bg-sky-950/70 ring-2 ring-sky-400 scale-[1.01]'
                : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs'
            }`}
          >
            {/* Header da Caixa 1 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Archive className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-stone-900 dark:text-stone-100">
                    Pneus Disponíveis (Estoque)
                  </h4>
                  <p className="text-[10px] text-stone-500">
                    {tireInventory.length} pneus prontos para montagem
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onNavigateToFiscal) {
                    onNavigateToFiscal();
                  } else if (onNavigate) {
                    onNavigate('fiscal');
                  } else {
                    window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'fiscal' }));
                    window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'fiscal' }));
                  }
                }}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-2xs transition cursor-pointer"
                title="Entrada obrigatória de pneus via documento (XML / Nota Fiscal em Notas e Entradas)"
              >
                <Plus className="w-3 h-3" />
                <span>+ Novo</span>
              </button>
            </div>

            {/* Lista com scroll de pneus disponíveis */}
            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 min-h-[110px]">
              {tireInventory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-3 border border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
                  <Archive className="w-5 h-5 text-stone-300 dark:text-stone-600 mb-1" />
                  <span className="text-[11px] font-bold text-stone-500">Estoque vazio</span>
                  <span className="text-[10px] text-stone-400">Arraste pneus do caminhão para cá ou cadastre novos pneus via Notas e Entradas</span>
                </div>
              ) : (
                tireInventory.map((item) => {
                  const cond = getTireCondition(item.treadDepthMm);
                  const isBeingDragged = draggedItem?.tire.id === item.id;

                  return (
                    <div
                      key={item.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, { source: 'inventory', tire: item })}
                      onDragEnd={handleDragEnd}
                      onClick={() => setInspectingTire(item)}
                      className={`group p-2 rounded-xl border transition cursor-grab active:cursor-grabbing flex items-center justify-between select-none ${
                        isBeingDragged
                          ? 'opacity-40 border-sky-400 bg-sky-50'
                          : 'border-stone-200 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-800/80 hover:border-sky-400 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-stone-400 group-hover:text-sky-500 shrink-0" />
                        
                        {/* Ícone mini pneu */}
                        <div className="w-6 h-8 rounded-sm bg-stone-900 flex flex-col justify-between py-0.5 px-0.5 shrink-0 border border-stone-700">
                          <div className="w-full h-0.5 bg-stone-400 opacity-50"></div>
                          <div className="text-[7px] text-white font-black text-center font-mono">
                            {item.fireNumber.replace(/\D/g, '').slice(-3) || 'P'}
                          </div>
                          <div className="w-full h-0.5 bg-stone-400 opacity-50"></div>
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-black text-stone-900 dark:text-stone-100 truncate">
                              {item.fireNumber}
                            </span>
                            <span className="text-[10px] text-stone-500 truncate" title={`${item.brand || ''} ${item.model || ''}`}>
                              • {item.brand && item.model && item.model.trim().toLowerCase() !== item.brand.trim().toLowerCase()
                                  ? `${item.brand} ${item.model}`
                                  : (item.brand || item.model || 'Pneu')}
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-400 truncate">
                            {item.size || '295/80 R22.5'} • {item.retreadCount ? `${item.retreadCount}ª Recap.` : 'Novo'}
                          </p>
                        </div>
                      </div>

                      {/* Badge de Sulco (mm) */}
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: cond.color }}
                      >
                        {item.treadDepthMm.toFixed(1)} mm
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Aviso de drop no rodapé */}
            <div className="mt-1.5 text-center text-[10px] text-stone-400 font-medium">
              💡 Solte pneus aqui para desinstalar do caminhão e guardar no estoque.
            </div>
          </div>

          {/* ========================================================
              CAIXA 2: ENVIAR PARA REFORMA (DROP ZONE)
              ======================================================== */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setHoveredDropZone('box_send_reform');
            }}
            onDragLeave={() => {
              if (hoveredDropZone === 'box_send_reform') setHoveredDropZone(null);
            }}
            onDrop={handleDropOnSendReformBox}
            className={`rounded-2xl p-3 border-2 border-dashed transition flex items-center justify-between ${
              hoveredDropZone === 'box_send_reform'
                ? 'border-amber-500 bg-amber-100/90 dark:bg-amber-950/80 scale-[1.02] shadow-md ring-2 ring-amber-400'
                : 'border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-950 dark:text-amber-100">
                  Enviar para Reforma
                </h4>
                <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                  Arraste um pneu aqui para enviar à recapadora
                </p>
              </div>
            </div>

            <div className="px-2 py-1 rounded-lg bg-amber-200/80 dark:bg-amber-900/80 text-[10px] font-black text-amber-900 dark:text-amber-200">
              Solte Aqui
            </div>
          </div>

          {/* ========================================================
              CAIXA 3: PNEUS EM REFORMA (LISTA COM INPUT DE PROBLEMA)
              ======================================================== */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-3 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col max-h-[300px]">
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <RotateCw className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-stone-900 dark:text-stone-100">
                    Pneus em Reforma ({tiresInReform.length})
                  </h4>
                  <p className="text-[10px] text-stone-500">
                    Aguardando envio / retorno de recapagem
                  </p>
                </div>
              </div>

              {/* Botão de Destaque no Topo do Card (Print 1) */}
              {tiresInReform.length > 0 && (
                <button
                  type="button"
                  id="btn-gerar-pedido-reforma-topo"
                  onClick={handleGerarPedidoReforma}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-black rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 shadow-xs transition cursor-pointer shrink-0"
                  title="Gerar Pedido de Reforma no módulo Notas e Entradas"
                >
                  <span>📝 Gerar Pedido</span>
                </button>
              )}
            </div>

            {/* Lista com scroll de pneus em reforma */}
            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 min-h-[80px]">
              {tiresInReform.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-3 text-[11px] text-stone-400 font-medium">
                  Nenhum pneu em reforma no momento. Arraste pneus para a caixa acima.
                </div>
              ) : (
                tiresInReform.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/90 dark:bg-stone-800/80 space-y-1.5 transition"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black text-stone-900 dark:text-stone-100 truncate">
                            {item.fireNumber}
                          </span>
                          <span className="text-[10px] text-stone-500 truncate">
                            • {item.brand} {item.model || ''} {item.size ? `(${item.size})` : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-400 truncate">
                          {item.vehiclePlate ? `Veículo: ${item.vehiclePlate}` : (item.vehicleName || 'Frota')} {item.reformSentDate ? `• Enviado ${formatDateBR(item.reformSentDate)}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCancelPendingReform(item.id)}
                          className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded hover:bg-stone-200/50 dark:hover:bg-stone-700/50 transition cursor-pointer"
                          title="Remover / devolver ao estoque"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Caixa de Texto: Relatar Problema do Pneu (Requisito 1) */}
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-300">
                        Relatar Problema do Pneu
                      </label>
                      <input
                        type="text"
                        value={item.motivo_reforma || ''}
                        onChange={(e) => handleUpdateMotivoReforma(item.id, e.target.value.toUpperCase())}
                        placeholder="Ex: Descolou a banda, sulco baixo, etc..."
                        className="py-1 px-2 text-xs border border-gray-200 dark:border-stone-700 rounded w-full mt-1.5 focus:ring-1 focus:ring-amber-500 focus:outline-none bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 uppercase"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Rodapé com botão consolidado quando houver pneus acumulados */}
            {tiresInReform.length > 0 && (
              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 mt-1">
                <button
                  type="button"
                  id="btn-gerar-pedido-reforma-rodape"
                  onClick={handleGerarPedidoReforma}
                  className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 shadow-xs hover:shadow-md transition cursor-pointer"
                >
                  <span>📝 Gerar Pedido de Reforma ({tiresInReform.length} {tiresInReform.length === 1 ? 'pneu' : 'pneus'})</span>
                </button>
              </div>
            )}
          </div>

          {/* ========================================================
              CAIXA 4: LIXEIRA / DESCARTE (COM INPUT COMPACTO SLIM)
              ======================================================== */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-3 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col">
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-stone-900 dark:text-stone-100">
                    Lixeira / Descarte {tiresPendingDiscard.length > 0 ? `(${tiresPendingDiscard.length})` : ''}
                  </h4>
                  <p className="text-[10px] text-stone-500">
                    {tiresPendingDiscard.length > 0 ? 'Aguardando confirmação de baixa definitiva' : 'Arraste aqui para dar baixa definitiva / sucata'}
                  </p>
                </div>
              </div>

              {/* Botão de Destaque no Topo do Card quando houver pneus */}
              {tiresPendingDiscard.length > 0 && (
                <button
                  type="button"
                  id="btn-consolidar-baixa-topo"
                  onClick={() => handleConsolidarBaixa()}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-black rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs transition cursor-pointer shrink-0"
                  title="Consolidar baixa definitiva de todos os pneus"
                >
                  <span>🗑️ Consolidar Baixa</span>
                </button>
              )}
            </div>

            {/* Drop Zone: se não houver pneu pendente, mostra a caixa padrão de drop */}
            {tiresPendingDiscard.length === 0 ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setHoveredDropZone('box_discard');
                }}
                onDragLeave={() => {
                  if (hoveredDropZone === 'box_discard') setHoveredDropZone(null);
                }}
                onDrop={handleDropOnDiscardBox}
                className={`rounded-xl p-2.5 border-2 border-dashed transition flex items-center justify-between cursor-pointer ${
                  hoveredDropZone === 'box_discard'
                    ? 'border-rose-500 bg-rose-100/90 dark:bg-rose-950/80 scale-[1.01] shadow-md ring-2 ring-rose-400'
                    : 'border-rose-300 dark:border-rose-900/80 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-400'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-rose-950 dark:text-rose-100">
                      Solte o pneu aqui
                    </h5>
                    <p className="text-[10px] text-rose-800/80 dark:text-rose-300/80">
                      Mova para descarte / sucata
                    </p>
                  </div>
                </div>

                <div className="px-2 py-0.5 rounded-md bg-rose-200/80 dark:bg-rose-900/80 text-[10px] font-black text-rose-900 dark:text-rose-200">
                  Descartar
                </div>
              </div>
            ) : (
              /* Lista com scroll dos pneus soltos para descarte */
              <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 max-h-[220px]">
                {/* Zona de Drop compacta para continuar arrastando outros pneus */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setHoveredDropZone('box_discard');
                  }}
                  onDragLeave={() => {
                    if (hoveredDropZone === 'box_discard') setHoveredDropZone(null);
                  }}
                  onDrop={handleDropOnDiscardBox}
                  className={`rounded-lg py-1 px-2 border border-dashed transition flex items-center justify-center text-[10px] font-bold ${
                    hoveredDropZone === 'box_discard'
                      ? 'border-rose-500 bg-rose-100 dark:bg-rose-950 text-rose-700'
                      : 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 text-rose-600 hover:border-rose-400'
                  }`}
                >
                  <span>+ Arraste mais pneus aqui para descarte</span>
                </div>

                {tiresPendingDiscard.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-stone-50/90 dark:bg-stone-800/80 space-y-1.5 transition"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-black text-stone-900 dark:text-stone-100 truncate">
                            {item.fireNumber}
                          </span>
                          <span className="text-[10px] text-stone-500 truncate">
                            • {item.brand} {item.model || ''} {item.size ? `(${item.size})` : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-400 truncate">
                          {item.vehiclePlate ? `Veículo: ${item.vehiclePlate}` : (item.vehicleName || 'Frota')} {item.discardDate ? `• ${formatDateBR(item.discardDate)}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConsolidarBaixa(item.id)}
                          className="px-2 py-0.5 text-[10px] font-black rounded-md bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition cursor-pointer"
                          title="Confirmar baixa deste pneu"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelPendingDiscard(item.id)}
                          className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded hover:bg-stone-200/50 dark:hover:bg-stone-700/50 transition cursor-pointer"
                          title="Cancelar / devolver ao estoque"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Caixa de Texto: Motivo do Descarte / Sucata (Requisito 2) */}
                    <div>
                      <label className="block text-[10px] font-bold text-rose-900 dark:text-rose-300">
                        Motivo do Descarte / Sucata
                      </label>
                      <input
                        type="text"
                        value={item.motivo_descarte || ''}
                        onChange={(e) => handleUpdateMotivoDescarte(item.id, e.target.value.toUpperCase())}
                        placeholder="Ex: Corte lateral, estouro de carcaça..."
                        className="py-1 px-2 text-xs border border-gray-200 dark:border-stone-700 rounded w-full mt-1.5 focus:ring-1 focus:ring-rose-500 focus:outline-none bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 uppercase"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Rodapé com botão consolidado quando houver pneus acumulados */}
            {tiresPendingDiscard.length > 0 && (
              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 mt-1">
                <button
                  type="button"
                  id="btn-consolidar-baixa-rodape"
                  onClick={() => handleConsolidarBaixa()}
                  className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs hover:shadow-md transition cursor-pointer"
                >
                  <span>🗑️ Consolidar Baixa Definitiva ({tiresPendingDiscard.length} {tiresPendingDiscard.length === 1 ? 'pneu' : 'pneus'})</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ========================================================
          MODAL DE CONFIRMAÇÃO DE DESCARTE (CAIXA 4)
          ======================================================== */}
      <TireDiscardModal
        isOpen={discardModalData !== null}
        onClose={() => setDiscardModalData(null)}
        tire={discardModalData?.tire || null}
        fromSource={discardModalData?.source || 'vehicle'}
        vehiclePlate={selectedVehicle?.licensePlateOrSerial || selectedVehicle?.name}
        onConfirmDiscard={handleConfirmDiscard}
      />

      {/* ========================================================
          MODAL DE RETORNO DA REFORMA (CAIXA 3)
          ======================================================== */}
      <TireReturnReformModal
        isOpen={returnReformTire !== null}
        onClose={() => setReturnReformTire(null)}
        tire={returnReformTire}
        onConfirmReturn={handleConfirmReturnFromReform}
      />

      {/* ========================================================
          MODAL CONFIGURAÇÃO DE TIPOS E EIXOS
          ======================================================== */}
      <VehicleTypesConfigModal
        isOpen={isTypesConfigOpen}
        onClose={() => setIsTypesConfigOpen(false)}
        vehicleTypes={vehicleTypes}
        onSaveVehicleTypes={async (updatedTypes) => {
          onSaveVehicleTypes(updatedTypes);
          try {
            if (isSupabaseConfigured && !isTableUnmigrated('tipos_veiculos_config')) {
              for (const vt of updatedTypes) {
                const { error: upsertErr } = await supabase.from('tipos_veiculos_config').upsert({
                  id: vt.id,
                  nome: vt.name,
                  tipo: vt.categoryKey || vt.name,
                  categoria: vt.categoryKey || vt.name,
                  numero_eixos: vt.defaultAxleConfig.totalAxles,
                  quantidade_pneus: vt.defaultAxleConfig.totalTires,
                  descricao: vt.description,
                  config_json: vt.defaultAxleConfig,
                });
                if (upsertErr && (upsertErr.code === '42P01' || upsertErr.code === 'PGRST205' || (upsertErr as any).status === 404)) {
                  markTableUnmigrated('tipos_veiculos_config');
                  break;
                }
              }
            }
          } catch (err) {
            console.warn('tipos_veiculos_config sync notice:', err);
          }
          if (selectedVehicleId) {
            loadVehicleConfigFromSupabase(selectedVehicleId, updatedTypes);
          }
        }}
      />

      {/* ========================================================
          MODAL INSPEÇÃO / EDIÇÃO DE PNEU
          ======================================================== */}
      <TireInspectionModal
        isOpen={inspectingTire !== null}
        onClose={() => setInspectingTire(null)}
        tire={inspectingTire}
        vehiclePlate={selectedVehicle?.licensePlateOrSerial || selectedVehicle?.name || ''}
        onSaveTire={handleSaveTireInspection}
      />

      {/* ========================================================
          MODAL IMPRESSÃO DE RELATÓRIO / ORDEM DE SERVIÇO
          ======================================================== */}
      <TireRotationPrintModal
        isOpen={viewingPrintLog !== null}
        onClose={() => setViewingPrintLog(null)}
        rotationLog={viewingPrintLog}
        vehicle={selectedVehicle}
        companyProfile={companyProfile}
      />

      {/* ========================================================
          MODAL HISTÓRICO DE BAIXAS / SUCATA
          ======================================================== */}
      {isDiscardHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                    Histórico de Pneus Descartados (Sucata)
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Registro de baixas definitivas da frota ({tiresDiscarded.length} registros)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDiscardHistoryModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {tiresDiscarded.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs font-medium">
                  Nenhum pneu foi descartado até o momento.
                </div>
              ) : (
                tiresDiscarded.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 flex items-center justify-between"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black text-stone-900 dark:text-stone-100">
                          {item.fireNumber} • {item.brand} {item.model || ''}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
                          {item.motivo_descarte || item.discardReason || 'Baixa de carcaça'}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {item.discardDate ? `Data: ${formatDateBR(item.discardDate)}` : ''} {item.vehiclePlate ? `• Veículo: ${item.vehiclePlate}` : ''} {item.discardNotes && item.discardNotes !== item.motivo_descarte ? `• Obs: ${item.discardNotes}` : ''}
                      </p>
                    </div>

                    <span className="text-xs font-bold text-stone-400 shrink-0">
                      Sulco: {item.treadDepthMm.toFixed(1)} mm
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-stone-200 dark:border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDiscardHistoryModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          DRAWER / MODAL DE GRAVAÇÃO DE ORDEM DE SERVIÇO DE RODÍZIO
          ======================================================== */}
      {isExecutionDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-sky-50/50 dark:bg-sky-950/20 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                    Gravar Ordem de Serviço de Rodízio
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Veículo: {selectedVehicle?.licensePlateOrSerial || selectedVehicle?.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExecutionDrawerOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteOrder} className="p-5 space-y-3.5 overflow-y-auto flex-1">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Data da Execução *
                  </label>
                  <input
                    type="date"
                    value={execDate}
                    onChange={(e) => setExecDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    KM Atual na Execução
                  </label>
                  <input
                    type="number"
                    value={execKm}
                    onChange={(e) => setExecKm(e.target.value)}
                    placeholder="Ex: 148500"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Horímetro Atual (Horas)
                  </label>
                  <input
                    type="number"
                    value={execHourMeter}
                    onChange={(e) => setExecHourMeter(e.target.value)}
                    placeholder="Ex: 4500"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Custo do Serviço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={execCost}
                    onChange={(e) => setExecCost(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Mecânico / Operador Responsável
                  </label>
                  <input
                    type="text"
                    value={execOperatorName}
                    onChange={(e) => setExecOperatorName(e.target.value)}
                    placeholder="Ex: João Mecânico / Borracheiro"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Prestador / Borracharia
                  </label>
                  <input
                    type="text"
                    value={execServiceProvider}
                    onChange={(e) => setExecServiceProvider(e.target.value)}
                    placeholder="Ex: Borracharia Interna / São José"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Observações e Laudo Técnico
                </label>
                <textarea
                  value={execNotes}
                  onChange={(e) => setExecNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Rodízio efetuado conforme programação, calibrados com 110 PSI e aperto dos parafusos verificado com torquímetro..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              {/* Ações */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsExecutionDrawerOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Gravar O.S. de Rodízio</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );

  // ========================================================
  // RENDERIZADOR INTERATIVO DE CADA SLOT DE PNEU NO CHASSI
  // (Pode estar OCUPADO por um pneu ou VAZIO [+ Vazio])
  // ========================================================
  function renderInteractiveTireSlot(pos: string) {
    if (!pos) return null;
    const tire = tiresByPosition.get(pos);
    const isHoveredTarget = hoveredDropZone === pos;

    if (!tire) {
      // ----------------------------------------------------
      // SLOT VAZIO (+ Vazio) - Drop target para novos pneus
      // ----------------------------------------------------
      return (
        <div
          key={pos}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setHoveredDropZone(pos);
          }}
          onDragLeave={() => {
            if (hoveredDropZone === pos) setHoveredDropZone(null);
          }}
          onDrop={(e) => handleDropOnVehicleSlot(pos, e)}
          className={`flex flex-col items-center justify-center rounded-xl transition select-none border-2 border-dashed ${
            isHoveredTarget
              ? 'border-sky-500 bg-sky-100/80 dark:bg-sky-950/80 scale-105 ring-2 ring-sky-400'
              : 'border-stone-300 dark:border-stone-700 bg-stone-100/60 dark:bg-stone-800/40 hover:border-sky-400 hover:bg-stone-100 dark:hover:bg-stone-800/60'
          }`}
          style={{ width: '68px', height: '96px' }}
        >
          <div className="text-center p-1 space-y-1">
            <span className="text-[10px] font-black font-mono text-stone-400 block">
              {pos}
            </span>
            <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 block">
              + Vazio
            </span>
          </div>
        </div>
      );
    }

    // ----------------------------------------------------
    // SLOT OCUPADO - Pneu montado (Draggable com mouse)
    // ----------------------------------------------------
    const tread = tire.treadDepthMm || 12.0;
    const condition = getTireCondition(tread);
    const isBeingDragged = draggedItem?.tire.id === tire.id;

    return (
      <div
        key={pos}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, { source: 'vehicle', position: pos, tire })}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setHoveredDropZone(pos);
        }}
        onDragLeave={() => {
          if (hoveredDropZone === pos) setHoveredDropZone(null);
        }}
        onDrop={(e) => handleDropOnVehicleSlot(pos, e)}
        className={`group relative flex flex-col items-center p-1.5 rounded-xl transition cursor-grab active:cursor-grabbing select-none ${
          isBeingDragged
            ? 'opacity-30 scale-95 border-2 border-dashed border-sky-500 bg-sky-50'
            : isHoveredTarget
            ? 'ring-3 ring-sky-500 scale-105 bg-sky-100 dark:bg-sky-950/90 shadow-lg z-20'
            : 'bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-sky-500 hover:shadow-md'
        }`}
        style={{ width: '72px' }}
      >
        {/* Pneu Visual com Textura de Banda de Rodagem */}
        <div className="relative w-12 h-14 rounded-md bg-stone-900 dark:bg-stone-950 border-2 border-stone-800 dark:border-stone-700 flex flex-col justify-between py-1 shadow-xs overflow-hidden">
          
          {/* Ranhuras/Sulcos superiores */}
          <div className="w-full flex justify-between px-1 opacity-40">
            <div className="w-0.5 h-full bg-stone-400"></div>
            <div className="w-0.5 h-full bg-stone-400"></div>
            <div className="w-0.5 h-full bg-stone-400"></div>
          </div>

          {/* Cubo da Roda / Posição */}
          <div className="w-5 h-5 rounded-full bg-stone-700 border border-stone-400 mx-auto flex items-center justify-center">
            <span className="text-[8px] font-black text-white font-mono">{pos}</span>
          </div>

          {/* Ranhuras inferiores */}
          <div className="w-full flex justify-between px-1 opacity-40">
            <div className="w-0.5 h-full bg-stone-400"></div>
            <div className="w-0.5 h-full bg-stone-400"></div>
            <div className="w-0.5 h-full bg-stone-400"></div>
          </div>

          {/* Linha Indicadora de Desgaste (Borda Colorida) */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: condition.color }}
          ></div>
        </div>

        {/* Informações Abaixo do Pneu */}
        <div className="mt-1 text-center w-full space-y-0.5">
          <span className="text-[10px] font-black text-stone-900 dark:text-stone-100 truncate block">
            {tire.fireNumber || pos}
          </span>
          
          {/* Badge Sulco (mm) */}
          <div className="flex items-center justify-center">
            <span
              className="px-1.5 py-0.2 rounded text-[9px] font-extrabold text-white"
              style={{ backgroundColor: condition.color }}
            >
              {tread.toFixed(1)} mm
            </span>
          </div>
        </div>

        {/* Botão de Ação Rápida / Inspecionar (Hover) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setInspectingTire(tire);
          }}
          title="Inspecionar / Editar Pneu"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xs hover:bg-sky-600 cursor-pointer"
        >
          <Eye className="w-3 h-3" />
        </button>
      </div>
    );
  }
};
