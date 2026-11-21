import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  SearchCheck,
  Building2,
  CalendarClock,
  Layers,
} from 'lucide-react';
import { executeGlobalStorageAudit } from '../../lib/globalStorageAudit';
import {
  AgroControlBackupMetadata,
  AgroControlBackupPayload,
  BackupModuleSummary,
  buildBackupDownloadFilename,
  buildBackupModuleSummary,
  collectAllSystemBackupKeys,
  getActiveCompanyId,
  getStoredCompanyProfile,
  isBackupExcludedKey,
  mirrorRestoredBackupToActiveScope,
  runWithLoader,
  safeLocalStorageSetItem,
} from '../../lib/storage';
import {
  getAllIndexedDbMediaRecords,
  IndexedDbMediaExportItem,
  MEDIA_UPDATED_EVENT,
  restoreAllIndexedDbMediaRecords,
  verifyIndexedDbIntegrity,
} from '../../lib/imageStorage';
import { SystemSelfTestModal } from './SystemSelfTestModal';

export interface DataBackupSecurityBlockProps {
  className?: string;
  subscriberName?: string;
  companyCnpj?: string;
  compact?: boolean;
}

const AGROCONTROL_SYNC_ENTITIES: Record<string, string[]> = {
  agrocontrol_produtos: ['colaca_silagem_estoque_produtos', 'silagem_facil_clean_v1_inventory'],
  agrocontrol_financeiro: ['silagem_facil_clean_v1_expenses', 'agrocontrol_expenses'],
  agrocontrol_pedidos_reforma: ['colaca_silagem_pedidos_reforma_ativos'],
  agrocontrol_fornecedores: ['silagem_facil_clean_v1_suppliers'],
  agrocontrol_clientes: ['silagem_facil_clean_v1_clients'],
  agrocontrol_empresa: ['dadosEmpresa', 'silagem_facil_clean_v1_company_profile'],
  agrocontrol_frotas_veiculos: ['colaca_silagem_frotas_veiculos', 'silagem_facil_clean_v1_machineries'],
  agrocontrol_funcionarios: ['colaca_silagem_funcionarios', 'silagem_facil_clean_v1_employees'],
  agrocontrol_combustivel: ['silagem_facil_clean_v1_fuel_logs', 'agrocontrol_abastecimentos'],
  agrocontrol_manutencao: ['silagem_facil_clean_v1_maintenance_logs'],
  agrocontrol_bancos: [
    'colaca_silagem_financeiro_contas',
    'silagem_facil_clean_v1_bank_accounts',
    'agrocontrol_contas_bancarias',
    'agrocontrol_financeiro_contas',
  ],
  agrocontrol_safras: ['silagem_facil_clean_v1_seasons'],
  agrocontrol_pedidos: ['silagem_facil_clean_v1_orders'],
  agrocontrol_servicos: ['silagem_facil_clean_v1_services'],
  agrocontrol_notas_entradas: ['colaca_silagem_documentos_entrada_itens'],
  agrocontrol_centros_custo: ['colaca_silagem_centros_custo', 'silagem_facil_clean_v1_cost_centers'],
  agrocontrol_plano_contas: ['silagem_facil_clean_v1_categories'],
  agrocontrol_tipos_veiculos: ['colaca_silagem_tipos_veiculos', 'silagem_facil_clean_v1_vehicle_types'],
  agrocontrol_pneus_estoque: ['colaca_silagem_frotas_pneus_estoque', 'silagem_facil_clean_v1_tire_inventory'],
  agrocontrol_subscribers_data: ['silagem_master_subscribers_v1'],
  agrocontrol_site_settings: ['landingPageSettings'],
  agrocontrol_plans_data: ['silagem_master_plans_v1'],
  agrocontrol_atividades: [],
  agrocontrol_caixa_operacional: [],
  agrocontrol_historico_caixas: [],
  agrocontrol_tool_kits: [],
  agrocontrol_inventory_balances: ['agrocontrol_estoque_balancos'],
  agrocontrol_stock_movements: ['agrocontrol_estoque_movimentacoes'],
  agrocontrol_trocas_devolucoes: [],
  agrocontrol_pendencias_devolucao: [],
  agrocontrol_estornos_auditoria: [],
  agrocontrol_notas_saida: [],
};

const RESTORE_SUMMARY_SESSION_KEY = 'agrocontrol_restore_summary_toast';

const AUTH_SESSION_PRESERVE_EXACT_KEYS = new Set<string>([
  'agrocontrol_auth_session',
  'colaca_silagem_auth_session',
  'colaca_silagem_active_session',
  'silagem_client_session',
  'silagem_active_user_email',
  'silagem_active_subscriber_id',
  'silagem_active_subscriber_email',
  'admin_impersonated_company_id',
  'is_admin_impersonating',
  'impersonated_subscriber_id',
  'impersonated_subscriber_name',
  'impersonated_subscriber_email',
  'impersonated_subscriber_plan',
  'agrocontrol_impersonated_modules',
  'supabase_auth_company_id',
  'authenticated_user_company_id',
  'supabase.auth.token',
]);

function isAuthSessionKeyToPreserve(key: string): boolean {
  if (!key) return false;
  const lower = String(key).toLowerCase().trim();
  if (AUTH_SESSION_PRESERVE_EXACT_KEYS.has(key) || AUTH_SESSION_PRESERVE_EXACT_KEYS.has(lower)) {
    return true;
  }
  return /^sb-.*-(auth-token|code-verifier)/.test(lower);
}

export function isTemporarySessionKey(key: string): boolean {
  return isBackupExcludedKey(key);
}

export function collectAllBackupableLocalStorageKeys(): string[] {
  return collectAllSystemBackupKeys();
}

export function syncAllAgroControlKeys(): void {
  try {
    executeGlobalStorageAudit();

    Object.entries(AGROCONTROL_SYNC_ENTITIES).forEach(([agroKey, legacyKeys]) => {
      let candidateValue: string | null = null;
      for (const legKey of legacyKeys) {
        const val = localStorage.getItem(legKey);
        if (val && val !== '[]' && val !== '{}' && val !== 'null') {
          candidateValue = val;
          break;
        }
      }

      if (candidateValue) {
        const currentAgroVal = localStorage.getItem(agroKey);
        if (!currentAgroVal || currentAgroVal === '[]' || currentAgroVal === '{}' || currentAgroVal === 'null') {
          safeLocalStorageSetItem(agroKey, candidateValue);
        }
      }
    });
  } catch (err) {
    console.error('Erro na sincronização de chaves agrocontrol:', err);
  }
}

function formatDateTimePtBr(isoOrDate?: string): string {
  if (!isoOrDate) return 'Não informada';
  const dt = new Date(isoOrDate);
  if (Number.isNaN(dt.getTime())) return String(isoOrDate);
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatSummaryMetric(value: number): string {
  return value.toLocaleString('pt-BR');
}

interface SummaryBadgeItem {
  key: keyof BackupModuleSummary;
  label: string;
  count: number;
}

function getSummaryDisplayItems(summary: BackupModuleSummary): SummaryBadgeItem[] {
  return [
    { key: 'notasFiscais', label: 'Notas Fiscais', count: summary.notasFiscais },
    { key: 'produtos', label: 'Produtos / Estoque', count: summary.produtos },
    { key: 'veiculos', label: 'Veículos / Frota', count: summary.veiculos },
    { key: 'despesas', label: 'Despesas / A Pagar', count: summary.despesas },
    { key: 'contasReceber', label: 'A Receber / Receitas', count: summary.contasReceber },
    { key: 'clientes', label: 'Clientes', count: summary.clientes },
    { key: 'fornecedores', label: 'Fornecedores', count: summary.fornecedores },
    { key: 'funcionarios', label: 'Funcionários (RH)', count: summary.funcionarios },
    { key: 'kitsFerramentas', label: 'Kits de Ferramentas', count: summary.kitsFerramentas },
    { key: 'balancosEstoque', label: 'Balanços de Estoque', count: summary.balancosEstoque },
    { key: 'devolucoesGarantias', label: 'Devoluções & Garantias', count: summary.devolucoesGarantias },
    { key: 'movimentacoesEstoque', label: 'Movim. de Estoque', count: summary.movimentacoesEstoque },
    { key: 'sessoesCaixa', label: 'Sessões de Caixa', count: summary.sessoesCaixa },
    { key: 'estornos', label: 'Estornos Auditados', count: summary.estornos },
    { key: 'cheques', label: 'Cheques', count: summary.cheques },
    { key: 'abastecimentos', label: 'Abastecimentos', count: summary.abastecimentos },
    { key: 'manutencoes', label: 'Manutenções', count: summary.manutencoes },
    { key: 'servicosPedidos', label: 'Serviços / Pedidos / Vendas', count: summary.servicosPedidos },
    { key: 'contasBancarias', label: 'Contas Bancárias', count: summary.contasBancarias },
    { key: 'cadastrosBase', label: 'Cadastros Base & Pneus', count: summary.cadastrosBase },
  ];
}

export interface ParsedBackupPreview {
  companyName: string;
  companyCnpj: string;
  createdAt: string;
  version: string;
  sourceCompanyId: string;
  totalKeys: number;
  mediaCount: number;
  keysList: string[];
  dataMap: Record<string, any>;
  indexedDbMedia?: IndexedDbMediaExportItem[] | Record<string, any>;
  summary: BackupModuleSummary;
}

export function parseAgroControlBackupPayload(rawJson: Record<string, any> | string): ParsedBackupPreview {
  const parsed: Record<string, any> = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Conteúdo do arquivo JSON de backup inválido ou corrompido.');
  }

  let dataMap: Record<string, any> = {};
  let metadataObj: Record<string, any> = {};
  let indexedDbMedia = parsed.indexedDbMedia;

  // Formato v2.0 ({ metadata, data, indexedDbMedia? })
  if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
    metadataObj = parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (!k || k.startsWith('_') || k === 'indexedDbMedia' || isTemporarySessionKey(k)) continue;
      dataMap[k] = v;
    }
    if (!indexedDbMedia && parsed.data.indexedDbMedia) {
      indexedDbMedia = parsed.data.indexedDbMedia;
    }
  } else if (
    typeof parsed.version === 'string' &&
    !('_meta' in parsed) &&
    ('expenses' in parsed || 'clients' in parsed || 'companyProfile' in parsed || 'machineries' in parsed)
  ) {
    // Formato legado 1.0 (BackupData de exportFullBackup)
    metadataObj = {
      app: 'AgroControl',
      version: parsed.version || '1.0',
      createdAt: parsed.exportedAt || '',
      companyName: parsed.companyProfile?.tradeName || parsed.companyProfile?.corporateName || '',
      companyCnpj: parsed.companyProfile?.cnpjCpf || parsed.companyProfile?.cnpj || '',
      activeCompanyId: parsed.companyProfile?.companyId || parsed.companyProfile?.id || '',
    };
    if (parsed.companyProfile) {
      dataMap['agrocontrol_empresa'] = parsed.companyProfile;
      dataMap['dadosEmpresa'] = parsed.companyProfile;
      dataMap['silagem_facil_clean_v1_company_profile'] = parsed.companyProfile;
    }
    if (Array.isArray(parsed.expenses)) {
      dataMap['agrocontrol_expenses'] = parsed.expenses;
      dataMap['agrocontrol_financeiro'] = parsed.expenses;
    }
    if (Array.isArray(parsed.categories)) {
      dataMap['silagem_facil_clean_v1_categories'] = parsed.categories;
    }
    if (Array.isArray(parsed.costCenters)) {
      dataMap['agrocontrol_centros_custo'] = parsed.costCenters;
    }
    if (Array.isArray(parsed.clients)) {
      dataMap['agrocontrol_clientes'] = parsed.clients;
    }
    if (Array.isArray(parsed.orders)) {
      dataMap['agrocontrol_pedidos'] = parsed.orders;
    }
    if (Array.isArray(parsed.machineries)) {
      dataMap['agrocontrol_frotas_veiculos'] = parsed.machineries;
    }
    if (Array.isArray(parsed.seasons)) {
      dataMap['agrocontrol_safras'] = parsed.seasons;
    }
  } else {
    // Formato plano legado ({ _meta, agrocontrol_*, ... })
    metadataObj = parsed._meta && typeof parsed._meta === 'object' ? parsed._meta : {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!k || k.startsWith('_') || k === 'indexedDbMedia' || k === 'metadata' || isTemporarySessionKey(k)) {
        continue;
      }
      dataMap[k] = v;
    }
  }

  const keysList = Object.keys(dataMap).sort();
  const mediaCount = Array.isArray(indexedDbMedia)
    ? indexedDbMedia.length
    : indexedDbMedia && typeof indexedDbMedia === 'object'
    ? Object.keys(indexedDbMedia).length
    : 0;

  const profileCandidate =
    (typeof dataMap['agrocontrol_empresa'] === 'object' ? dataMap['agrocontrol_empresa'] : null) ||
    (typeof dataMap['dadosEmpresa'] === 'object' ? dataMap['dadosEmpresa'] : null) ||
    (typeof dataMap['silagem_facil_clean_v1_company_profile'] === 'object'
      ? dataMap['silagem_facil_clean_v1_company_profile']
      : null);

  const companyName = String(
    metadataObj.companyName ||
      metadataObj.assinante ||
      profileCandidate?.tradeName ||
      profileCandidate?.corporateName ||
      'Empresa não informada'
  ).trim();

  const companyCnpj = String(
    metadataObj.companyCnpj || profileCandidate?.cnpjCpf || profileCandidate?.cnpj || ''
  ).trim();

  const createdAt = String(
    metadataObj.createdAt || metadataObj.exportadoEm || parsed.exportedAt || ''
  ).trim();

  const version = String(metadataObj.version || metadataObj.versao || '2.0').trim();
  const sourceCompanyId = String(
    metadataObj.activeCompanyId ||
      profileCandidate?.companyId ||
      profileCandidate?.id ||
      dataMap['current_company_id'] ||
      ''
  ).trim();

  const summary = buildBackupModuleSummary(dataMap, sourceCompanyId ? [sourceCompanyId] : []);

  return {
    companyName,
    companyCnpj,
    createdAt,
    version,
    sourceCompanyId,
    totalKeys: keysList.length,
    mediaCount,
    keysList,
    dataMap,
    indexedDbMedia,
    summary,
  };
}

export async function exportAgroControlBackup(
  subscriberName?: string,
  companyCnpj?: string
): Promise<{
  filename: string;
  totalKeys: number;
  totalMediaFiles: number;
  metadata: AgroControlBackupMetadata;
}> {
  syncAllAgroControlKeys();

  const keysToBackup = collectAllBackupableLocalStorageKeys();
  const mediaRecords = await getAllIndexedDbMediaRecords();

  const dataRecord: Record<string, any> = {};
  let count = 0;
  for (const key of keysToBackup) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        dataRecord[key] = JSON.parse(raw);
      } catch {
        dataRecord[key] = raw;
      }
      count++;
    }
  }

  const profile = getStoredCompanyProfile();
  const resolvedCompanyName = String(
    subscriberName && subscriberName !== 'SUA EMPRESA AQUI'
      ? subscriberName
      : profile?.tradeName || profile?.corporateName || subscriberName || 'SUA EMPRESA AQUI'
  ).trim();
  const resolvedCompanyCnpj = String(
    companyCnpj || profile?.cnpjCpf || profile?.cnpj || ''
  ).trim();
  const activeCompanyId = getActiveCompanyId(profile);
  const now = new Date();
  const summary = buildBackupModuleSummary(dataRecord, [activeCompanyId]);

  const metadata: AgroControlBackupMetadata = {
    app: 'AgroControl',
    version: '2.0',
    createdAt: now.toISOString(),
    companyName: resolvedCompanyName,
    companyCnpj: resolvedCompanyCnpj,
    activeCompanyId,
    totalKeys: count,
    totalMediaFiles: mediaRecords.length,
    summary,
  };

  const backupPayload: AgroControlBackupPayload = {
    metadata,
    data: dataRecord,
    indexedDbMedia: mediaRecords,
  };

  const filename = buildBackupDownloadFilename(resolvedCompanyName, now);
  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    filename,
    totalKeys: count,
    totalMediaFiles: mediaRecords.length,
    metadata,
  };
}

export async function handleRestoreBackup(
  jsonData: Record<string, any> | string
): Promise<{
  restoredKeys: number;
  restoredMedia: number;
  summary: BackupModuleSummary;
  companyName: string;
}> {
  try {
    const parsedPreview = parseAgroControlBackupPayload(jsonData);
    const { dataMap, indexedDbMedia, sourceCompanyId, summary, companyName } = parsedPreview;

    if (parsedPreview.totalKeys === 0 && parsedPreview.mediaCount === 0) {
      throw new Error('Nenhuma chave de dados ou mídia válida encontrada no arquivo de backup.');
    }

    const preClearCompanyId = getActiveCompanyId();

    // Preserva exclusivamente chaves ativas de autenticação/sessão (jamais preserva sbx_ ou caches)
    const preservedSessionEntries: Array<[string, string]> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isAuthSessionKeyToPreserve(k)) {
        const val = localStorage.getItem(k);
        if (val !== null) preservedSessionEntries.push([k, val]);
      }
    }

    // 1. Limpeza prévia de chaves órfãs e gravação dos tokens de sessão preservados
    localStorage.clear();
    for (const [sessKey, sessVal] of preservedSessionEntries) {
      try {
        localStorage.setItem(sessKey, sessVal);
      } catch {}
    }

    const serialize = (val: any): string => {
      if (val === null || val === undefined) return '[]';
      return typeof val === 'string' ? val : JSON.stringify(val);
    };

    // 2. Gravação síncrona de 100% das chaves do backup no LocalStorage
    let restoredKeysCount = 0;
    Object.entries(dataMap).forEach(([chave, valor]) => {
      if (!chave || chave.startsWith('_') || chave === 'indexedDbMedia') return;
      if (isTemporarySessionKey(chave)) return;
      if (safeLocalStorageSetItem(chave, serialize(valor))) {
        restoredKeysCount++;
      }
    });

    // 3. Espelhamento completo para chaves canônicas globais e chaves com escopo da empresa ativa (_<activeCompanyId>)
    const effectiveTargetCompanyId = getActiveCompanyId() || preClearCompanyId || sourceCompanyId || 'default';
    mirrorRestoredBackupToActiveScope(dataMap, effectiveTargetCompanyId, sourceCompanyId);

    // 4. Restauração integral das mídias e documentos no IndexedDB (`AgroControlMediaDB`)
    let restoredMediaCount = 0;
    if (indexedDbMedia) {
      const mediaResult = await restoreAllIndexedDbMediaRecords(
        indexedDbMedia as IndexedDbMediaExportItem[] | Record<string, any>,
        { clearExisting: true }
      );
      restoredMediaCount = mediaResult.restoredCount;
    }

    // 5. Auditoria e blindagem completa de todas as categorias
    executeGlobalStorageAudit();

    const summaryText = `Backup de "${companyName}" restaurado com sucesso: ${restoredKeysCount} chaves de dados (${summary.notasFiscais} NF-e/docs, ${summary.produtos} produtos, ${summary.veiculos} veículos, ${summary.funcionarios} funcionários) + ${restoredMediaCount} arquivos de mídia recuperados!`;
    try {
      sessionStorage.setItem(RESTORE_SUMMARY_SESSION_KEY, summaryText);
    } catch {}

    return {
      restoredKeys: restoredKeysCount,
      restoredMedia: restoredMediaCount,
      summary,
      companyName,
    };
  } catch (error) {
    console.error('ERRO CRÍTICO NA RESTAURAÇÃO DO BACKUP:', error);
    throw error;
  }
}

export const applyAgroControlRestore = handleRestoreBackup;

export const DataBackupSecurityBlock: React.FC<DataBackupSecurityBlockProps> = ({
  className = '',
  subscriberName = 'SUA EMPRESA AQUI',
  companyCnpj = '',
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeKeysCount, setActiveKeysCount] = useState<number>(0);
  const [mediaFilesCount, setMediaFilesCount] = useState<number>(0);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [pendingRawJson, setPendingRawJson] = useState<Record<string, any> | null>(null);
  const [pendingPreview, setPendingPreview] = useState<ParsedBackupPreview | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [lastBackupReport, setLastBackupReport] = useState<{
    filename: string;
    totalKeys: number;
    totalMediaFiles: number;
    metadata: AgroControlBackupMetadata;
  } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSelfTestModalOpen, setIsSelfTestModalOpen] = useState<boolean>(false);

  const refreshStorageCounters = async () => {
    const keys = collectAllBackupableLocalStorageKeys();
    setActiveKeysCount(keys.length);
    try {
      const stats = await verifyIndexedDbIntegrity();
      setMediaFilesCount(stats.count);
    } catch {
      setMediaFilesCount(0);
    }
  };

  useEffect(() => {
    syncAllAgroControlKeys();
    void refreshStorageCounters();

    try {
      const restoredBanner = sessionStorage.getItem(RESTORE_SUMMARY_SESSION_KEY);
      if (restoredBanner) {
        sessionStorage.removeItem(RESTORE_SUMMARY_SESSION_KEY);
        setFeedback({ type: 'success', text: restoredBanner });
        setTimeout(() => setFeedback(null), 10000);
      }
    } catch {}

    const handleSyncCounters = () => {
      void refreshStorageCounters();
    };
    window.addEventListener(MEDIA_UPDATED_EVENT, handleSyncCounters);
    window.addEventListener('storage', handleSyncCounters);
    return () => {
      window.removeEventListener(MEDIA_UPDATED_EVENT, handleSyncCounters);
      window.removeEventListener('storage', handleSyncCounters);
    };
  }, []);

  const handleVerifyIntegrity = async () => {
    try {
      setIsProcessing(true);
      const keys = collectAllBackupableLocalStorageKeys();
      let validJsonCount = 0;
      const corruptedKeys: string[] = [];

      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw === null) continue;
        const trimmed = raw.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            JSON.parse(raw);
            validJsonCount++;
          } catch {
            corruptedKeys.push(k);
          }
        } else {
          validJsonCount++;
        }
      }

      const idbStats = await verifyIndexedDbIntegrity();
      setActiveKeysCount(keys.length);
      setMediaFilesCount(idbStats.count);

      const sizeMb = (idbStats.totalBytes / (1024 * 1024)).toFixed(2).replace('.', ',');

      if (corruptedKeys.length > 0 || !idbStats.ok) {
        const problems: string[] = [];
        if (corruptedKeys.length > 0) {
          problems.push(`${corruptedKeys.length} chave(s) com JSON inválido (${corruptedKeys.slice(0, 3).join(', ')})`);
        }
        if (!idbStats.supported) {
          problems.push('IndexedDB indisponível neste navegador');
        } else if (!idbStats.ok) {
          problems.push(`${idbStats.invalidCount} registro(s) inconsistente(s) no IndexedDB`);
        }
        setFeedback({
          type: 'error',
          text: `Auditoria concluída com alertas: ${problems.join(' • ')}. (${validJsonCount} chaves e ${idbStats.count} mídias íntegras)`,
        });
      } else {
        setFeedback({
          type: 'success',
          text: `Integridade 100% validada! ${keys.length} chaves de dados no LocalStorage + ${idbStats.count} arquivos/mídias no IndexedDB (${sizeMb} MB) íntegros e prontos para backup.`,
        });
      }
      setTimeout(() => setFeedback(null), 8000);
    } catch (err) {
      console.error('Erro ao verificar integridade dos bancos locais:', err);
      setFeedback({
        type: 'error',
        text: 'Falha ao executar verificação de integridade dos armazenamentos locais.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setIsProcessing(true);
      await runWithLoader('Gerando Backup Completo do Sistema...', async () => {
        const result = await exportAgroControlBackup(subscriberName, companyCnpj);
        await refreshStorageCounters();
        setLastBackupReport(result);
        setFeedback({
          type: 'success',
          text: `Backup integral v2.0 gerado! "${result.filename}" baixado com ${result.totalKeys} chaves de dados + ${result.totalMediaFiles} arquivos/mídias do IndexedDB.`,
        });
      });
    } catch (err) {
      console.error('Erro ao gerar backup:', err);
      setFeedback({
        type: 'error',
        text: 'Falha ao gerar o arquivo de backup. Verifique as permissões do navegador.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size === 0) {
      setFeedback({
        type: 'error',
        text: 'O ARQUIVO SELECIONADO ESTÁ VAZIO (0 BYTES). SELECIONE UM ARQUIVO DE BACKUP JSON VÁLIDO.',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setPendingFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = ((event.target?.result as string) || '').trim();
        if (!content) {
          setFeedback({
            type: 'error',
            text: 'O ARQUIVO DE BACKUP ESTÁ VAZIO OU CORROMPIDO.',
          });
          return;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          setFeedback({
            type: 'error',
            text: 'ARQUIVO JSON INVÁLIDO: CONTEÚDO CORROMPIDO OU INCOMPLETO (ERRO DE SINTAXE).',
          });
          return;
        }

        const preview = parseAgroControlBackupPayload(parsed);
        if (preview.totalKeys === 0 && preview.mediaCount === 0) {
          setFeedback({
            type: 'error',
            text: 'NENHUMA CHAVE DE DADOS OU MÍDIA VÁLIDA ENCONTRADA NO ARQUIVO JSON.',
          });
          return;
        }

        setPendingRawJson(parsed);
        setPendingPreview(preview);
        setIsConfirmModalOpen(true);
      } catch (err: any) {
        setFeedback({
          type: 'error',
          text: `ARQUIVO JSON INVÁLIDO: ${err?.message || 'NÃO FOI POSSÍVEL INTERPRETAR A ESTRUTURA DO ARQUIVO.'}`,
        });
        setTimeout(() => setFeedback(null), 6000);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setFeedback({
        type: 'error',
        text: 'Erro ao ler o arquivo selecionado no disco.',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!pendingRawJson) return;
    try {
      setIsProcessing(true);
      await runWithLoader('Restaurando Backup e Sincronizando Dados...', async () => {
        const { restoredKeys, restoredMedia } = await handleRestoreBackup(pendingRawJson);
        setIsConfirmModalOpen(false);
        setFeedback({
          type: 'success',
          text: `Backup restaurado com sucesso: ${restoredKeys} chaves de dados + ${restoredMedia} arquivos de mídia/documentos recuperados!`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 350);
      });
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      setIsProcessing(false);
      setIsConfirmModalOpen(false);
      setFeedback({
        type: 'error',
        text: 'Erro crítico ao gravar os dados restaurados no LocalStorage / IndexedDB.',
      });
    }
  };

  const handleCancelRestore = () => {
    setIsConfirmModalOpen(false);
    setPendingRawJson(null);
    setPendingPreview(null);
    setPendingFileName('');
  };

  return (
    <>
      {/* CARD SLIM DE UTILITÁRIOS: PALETA OFICIAL ALTO CONTRASTE */}
      <div
        id="card-backup-seguranca-sistema"
        className={`rounded-xl overflow-hidden border border-black dark:border-stone-700 bg-[#e0e6f1] dark:bg-stone-900 shadow-2xs shrink-0 select-none ${compact ? 'text-[11px]' : ''} ${className}`}
      >
        {/* CABEÇALHO OFICIAL */}
        <div className="bg-[#cad4e6] border-b border-black p-2 dark:bg-stone-800 dark:border-stone-700 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-base leading-none select-none" role="img" aria-label="disquete">
              💾
            </span>
            <h2 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-900 dark:text-stone-100">
              💾 CENTRAL DE SEGURANÇA E BACKUP DE DADOS
            </h2>
          </div>

          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-400 dark:border-emerald-800 text-[9px] font-bold text-emerald-900 dark:text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>100% OFFLINE</span>
            </span>
            <span
              title="Total de chaves de dados gravadas no LocalStorage (todos os módulos)"
              className="text-[9px] font-bold text-slate-800 dark:text-stone-300 bg-white/80 dark:bg-stone-800 px-2 py-0.5 rounded-md border border-black/30 dark:border-stone-600"
            >
              {activeKeysCount} CHAVES (LOCALSTORAGE)
            </span>
            <span
              title="Total de fotos, logos, XMLs e certificado A1 gravados no IndexedDB (AgroControlMediaDB)"
              className="text-[9px] font-bold text-blue-900 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-400 dark:border-blue-800"
            >
              {mediaFilesCount} MÍDIAS (INDEXEDDB)
            </span>
          </div>
        </div>

        {/* CORPO DO CARD SLIM */}
        <div className="p-2 sm:p-2.5 bg-[#e0e6f1] dark:bg-stone-900/60 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center space-x-2 text-slate-800 dark:text-stone-300 min-w-0">
            <div className="p-1.5 rounded-lg bg-[#cad4e6] dark:bg-stone-800 border border-black/30 dark:border-stone-700 shrink-0 text-slate-800 dark:text-stone-300">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="text-[10px] font-extrabold uppercase text-slate-900 dark:text-white truncate">
                  SEGURANÇA DO SISTEMA • {subscriberName}
                </span>
              </div>
              <p className="text-[9px] text-slate-700 dark:text-stone-400 font-medium truncate">
                Backup integral v2.0 de 100% dos módulos (<code className="text-[9px] font-mono text-emerald-800 dark:text-emerald-400 bg-white/80 dark:bg-stone-800 px-1 py-0.2 rounded border border-black/15">LocalStorage</code>) + fotos, logos e certificado A1 (<code className="text-[9px] font-mono text-blue-800 dark:text-blue-400 bg-white/80 dark:bg-stone-800 px-1 py-0.2 rounded border border-black/15">IndexedDB</code>).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json,application/json"
              className="hidden"
              id="input-restaurar-backup-file"
            />

            <button
              type="button"
              id="btn-verificar-integridade-backup"
              onClick={handleVerifyIntegrity}
              disabled={isProcessing}
              title="Auditar integridade do LocalStorage e do IndexedDB (AgroControlMediaDB) sem alterar dados"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 rounded-lg text-[10px] font-bold uppercase tracking-wide border border-slate-300 dark:border-stone-600 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <SearchCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 stroke-[2.2]" />
              <span>🔍 Verificar Integridade</span>
            </button>

            <button
              type="button"
              id="btn-executar-auto-teste-completo"
              onClick={() => setIsSelfTestModalOpen(true)}
              disabled={isProcessing}
              title="Executar bateria automatizada de auto-testes em sandbox isolado sem alterar dados reais"
              className="inline-flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white border border-black font-bold text-xs px-3 py-1.5 rounded-md shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <span>🩺 Executar Auto-Teste Completo</span>
            </button>

            <button
              type="button"
              id="btn-gerar-backup-sistema"
              onClick={handleDownloadBackup}
              disabled={isProcessing}
              title="Baixar arquivo JSON completo com todas as chaves do sistema + mídias/documentos do IndexedDB"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border border-emerald-700/60 shadow-[inset_0_1px_0px_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              <span className="text-white font-bold uppercase tracking-wider">
                GERAR BACKUP DO SISTEMA (BAIXAR ARQUIVO)
              </span>
            </button>

            <button
              type="button"
              id="btn-restaurar-backup-sistema"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              title="Carregar arquivo .JSON e restaurar dados locais + mídias/documentos do IndexedDB"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-stone-850 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-200 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border border-slate-300 dark:border-stone-700 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600 dark:text-stone-300 stroke-[2.5]" />
              <span className="font-bold uppercase tracking-wider">RESTAURAR BACKUP (ARQUIVO .JSON)</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK INLINE MICRO */}
        {feedback && (
          <div
            className={`px-3 py-1.5 text-[10px] font-bold flex items-center justify-between border-t ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            <span className="flex items-center space-x-1.5 min-w-0">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
              )}
              <span className="break-words">{feedback.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 ml-2 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* RESUMO QUANTITATIVO CONFIRMADO APÓS GERAR O BACKUP */}
        {lastBackupReport && (
          <div
            id="backup-export-summary-card"
            className="px-3 py-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border-t border-emerald-200 dark:border-emerald-800 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-900 dark:text-emerald-200">
                <Layers className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>
                  Resumo Confirmado do Backup Salvo • {lastBackupReport.filename} ({lastBackupReport.totalKeys} chaves •{' '}
                  {lastBackupReport.totalMediaFiles} mídias)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLastBackupReport(null)}
                className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 cursor-pointer"
                title="Fechar resumo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
              {getSummaryDisplayItems(lastBackupReport.metadata.summary).map((item) => (
                <div
                  key={item.key}
                  className={`px-2 py-1 rounded-md border text-[10px] flex items-center justify-between gap-1 ${
                    item.count > 0
                      ? 'bg-white dark:bg-stone-800 border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-stone-100 font-bold'
                      : 'bg-slate-100/70 dark:bg-stone-900/50 border-slate-200 dark:border-stone-700 text-slate-400 dark:text-stone-500 font-medium'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <span
                    className={`font-mono px-1 rounded ${
                      item.count > 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                        : 'text-slate-400'
                    }`}
                  >
                    {formatSummaryMetric(item.count)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO E CONFERÊNCIA DETALHADA DE RESTAURAÇÃO */}
      {isConfirmModalOpen && pendingPreview && (
        <div
          id="modal-confirm-restore-backup"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-amber-400/80 dark:border-amber-600 w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            {/* Cabeçalho de Alerta Visual */}
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-3 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded-md bg-white/20 backdrop-blur-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-100 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-amber-100">
                    CONFIRMAÇÃO MANDATÓRIA E CONFERÊNCIA DO BACKUP
                  </span>
                  <h3 className="text-xs sm:text-sm font-black uppercase text-white tracking-wide">
                    RESTAURAÇÃO INTEGRAL DO SISTEMA AGROCONTROL
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelRestore}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo rolável */}
            <div className="p-4 space-y-3 bg-stone-50/50 dark:bg-stone-900 overflow-y-auto">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80">
                <p className="text-xs font-black text-amber-950 dark:text-amber-200 leading-snug tracking-tight">
                  ATENÇÃO: A RESTAURAÇÃO IRÁ SUBSTITUIR TODOS OS DADOS ATUAIS DA TELA PELOS DADOS DO ARQUIVO. DESEJA CONTINUAR?
                </p>
              </div>

              {/* Identificação de Origem, Data/Hora e Destino */}
              <div className="bg-white dark:bg-stone-800 rounded-xl border border-slate-200 dark:border-stone-700 p-3 space-y-2 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-stone-900/60 border border-slate-200 dark:border-stone-700">
                    <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="block text-[9px] font-bold uppercase text-slate-500">Empresa de Origem</span>
                      <span className="block font-black text-[11px] text-slate-900 dark:text-white uppercase truncate">
                        {pendingPreview.companyName}
                      </span>
                      {pendingPreview.companyCnpj && (
                        <span className="block text-[10px] font-mono text-slate-600 dark:text-stone-400">
                          CNPJ/CPF: {pendingPreview.companyCnpj}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-stone-900/60 border border-slate-200 dark:border-stone-700">
                    <CalendarClock className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="block text-[9px] font-bold uppercase text-slate-500">Data/Hora do Backup</span>
                      <span className="block font-black text-[11px] text-slate-900 dark:text-white">
                        {formatDateTimePtBr(pendingPreview.createdAt)}
                      </span>
                      <span className="block text-[10px] text-slate-600 dark:text-stone-400 truncate">
                        Arquivo: <strong className="font-mono">{pendingFileName}</strong> (v{pendingPreview.version})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-stone-700">
                  <div className="text-[10px] text-slate-600 dark:text-stone-300">
                    Destino Ativo:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400 uppercase">{subscriberName}</strong>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {pendingPreview.totalKeys} chaves (LocalStorage)
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {pendingPreview.mediaCount} mídias (IndexedDB)
                    </span>
                  </div>
                </div>
              </div>

              {/* Resumo Quantitativo de Registros que Serão Restaurados */}
              <div className="bg-white dark:bg-stone-800 rounded-xl border border-slate-200 dark:border-stone-700 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-stone-200">
                    Resumo Quantitativo dos Registros a Restaurar
                  </span>
                  <span className="text-[9px] font-semibold text-slate-500 dark:text-stone-400">
                    Espelhamento automático no escopo da empresa ativa
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {getSummaryDisplayItems(pendingPreview.summary).map((item) => (
                    <div
                      key={item.key}
                      className={`px-2 py-1.5 rounded-lg border text-[10px] flex items-center justify-between gap-1 ${
                        item.count > 0
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-stone-100 font-bold'
                          : 'bg-slate-50 dark:bg-stone-900/40 border-slate-200 dark:border-stone-700 text-slate-400 dark:text-stone-500'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span
                        className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                          item.count > 0
                            ? 'bg-emerald-600 text-white font-black'
                            : 'bg-slate-200/70 dark:bg-stone-800 text-slate-500'
                        }`}
                      >
                        {formatSummaryMetric(item.count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-600 dark:text-stone-400 font-semibold leading-relaxed">
                Ao clicar em confirmar, o sistema restaurará 100% das chaves no{' '}
                <code className="text-slate-800 dark:text-stone-200 bg-slate-100 dark:bg-stone-800 px-1 py-0.5 rounded font-mono">
                  LocalStorage
                </code>{' '}
                (incluindo espelhamento automático para a empresa ativa) e todas as mídias/documentos no{' '}
                <code className="text-slate-800 dark:text-stone-200 bg-slate-100 dark:bg-stone-800 px-1 py-0.5 rounded font-mono">
                  IndexedDB
                </code>
                , recarregando a aplicação automaticamente.
              </p>
            </div>

            {/* Botões do Modal */}
            <div className="p-3 bg-slate-100 dark:bg-stone-800/80 border-t border-slate-200 dark:border-stone-700 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                id="btn-cancelar-restauracao"
                onClick={handleCancelRestore}
                disabled={isProcessing}
                className="px-3.5 py-1.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 hover:from-slate-100 hover:to-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase border border-slate-400 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                CANCELAR
              </button>

              <button
                type="button"
                id="btn-confirmar-restauracao"
                onClick={handleConfirmRestore}
                disabled={isProcessing}
                className="px-4 py-1.5 bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider border border-rose-800 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.3)] transition active:scale-95 cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-white ${isProcessing ? 'animate-spin' : ''}`} />
                <span>CONFIRMAR E RESTAURAR DADOS</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <SystemSelfTestModal
        isOpen={isSelfTestModalOpen}
        onClose={() => setIsSelfTestModalOpen(false)}
        subscriberName={subscriberName}
      />
    </>
  );
};
