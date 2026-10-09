import React, { useState, useRef, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  ShieldCheck, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  FileJson, 
  RefreshCw,
  HardDrive
} from 'lucide-react';

export interface DataBackupSecurityBlockProps {
  className?: string;
  subscriberName?: string;
  compact?: boolean;
}

/**
 * Mapeamento e espelhamento seguro entre chaves legadas e o padrão padronizado 'agrocontrol_*'
 * para assegurar que 100% dos dados do sistema do assinante estejam consolidados no backup.
 */
const AGROCONTROL_SYNC_ENTITIES: Record<string, string[]> = {
  agrocontrol_produtos: ['colaca_silagem_estoque_produtos', 'silagem_facil_clean_v1_inventory'],
  agrocontrol_financeiro: ['silagem_facil_clean_v1_expenses'],
  agrocontrol_pedidos_reforma: ['colaca_silagem_pedidos_reforma_ativos'],
  agrocontrol_fornecedores: ['silagem_facil_clean_v1_suppliers'],
  agrocontrol_clientes: ['silagem_facil_clean_v1_clients'],
  agrocontrol_empresa: ['dadosEmpresa', 'silagem_facil_clean_v1_company_profile'],
  agrocontrol_frotas_veiculos: ['colaca_silagem_frotas_veiculos', 'silagem_facil_clean_v1_machineries'],
  agrocontrol_funcionarios: ['colaca_silagem_funcionarios', 'silagem_facil_clean_v1_employees'],
  agrocontrol_combustivel: ['silagem_facil_clean_v1_fuel_logs'],
  agrocontrol_manutencao: ['silagem_facil_clean_v1_maintenance_logs'],
  agrocontrol_bancos: ['colaca_silagem_financeiro_contas', 'silagem_facil_clean_v1_bank_accounts'],
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
};

/**
 * Garante que todas as chaves do sistema comecem com 'agrocontrol_' sincronizando
 * os dados já cadastrados em memória/LocalStorage.
 */
export function syncAllAgroControlKeys(): void {
  try {
    Object.entries(AGROCONTROL_SYNC_ENTITIES).forEach(([agroKey, legacyKeys]) => {
      // Se a chave agrocontrol_* ainda não tiver valor ou a legada tiver sido modificada recentemente
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
          localStorage.setItem(agroKey, candidateValue);
        }
      }
    });
  } catch (err) {
    console.error('Erro na sincronização de chaves agrocontrol:', err);
  }
}

/**
 * Gera e dispara o download do arquivo JSON de backup contendo todas as chaves 'agrocontrol_*'
 */
export function exportAgroControlBackup(subscriberName: string = 'COLAÇA SILAGEM LTDA'): { filename: string; totalKeys: number } {
  // Sincroniza chaves preliminarmente
  syncAllAgroControlKeys();

  // 1. Coleta todas as chaves que começam com 'agrocontrol_'
  const backupObject: Record<string, any> = {
    _meta: {
      assinante: subscriberName,
      sistema: 'AGROCONTROL_SISTEMA_AGRICOLA',
      tipo: 'BACKUP_COMPLETO_SISTEMA',
      exportadoEm: new Date().toISOString(),
      versao: '2.0-offline',
      ambiente: 'LocalStorage Resiliente',
    }
  };

  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('agrocontrol_')) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          backupObject[key] = JSON.parse(raw);
        } catch {
          backupObject[key] = raw;
        }
        count++;
      }
    }
  }

  // 2. Formata a data atual padronizada (ex: 2026_10_09)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dataAtual = `${year}_${month}_${day}`;

  const filename = `BACKUP_AGROCONTROL_COLACA_SILAGEM_${dataAtual}.json`;

  // 3. Converte para string e dispara download automático via Blob
  const jsonString = JSON.stringify(backupObject, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, totalKeys: count };
}

/**
 * FUNÇÃO DE IMPORTAÇÃO E RESTAURAÇÃO DO ARQUIVO JSON DO SISTEMA
 * Aplica mapeamento de redundância nas chaves críticas (frotas, pneus, produtos, financeiro, funcionários)
 * e executa rotina de segurança genérica com recarregamento forçado.
 */
export function handleRestoreBackup(jsonData: Record<string, any> | string): void {
  try {
    const data: Record<string, any> = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    if (!data || typeof data !== 'object') {
      throw new Error('Conteúdo do arquivo JSON de backup inválido ou corrompido.');
    }

    const serialize = (val: any): string => {
      if (val === null || val === undefined) return '[]';
      return typeof val === 'string' ? val : JSON.stringify(val);
    };

    // 2. LOOP AUTOMÁTICO DE SEGURANÇA:
    // Varre o JSON: para cada chave que começar com "agrocontrol_", aplica localStorage.setItem direto,
    // garantindo que nenhuma tabela seja esquecida.
    Object.entries(data).forEach(([chave, valor]) => {
      if (chave.startsWith('_')) return; // ignora metadados
      if (chave.startsWith('agrocontrol_')) {
        localStorage.setItem(chave, serialize(valor));
      }
    });

    // 1. MAPEAR CHAVES ESPECÍFICAS COM REDUNDÂNCIA:
    // -------------------------------------------------------------
    // FROTAS E VEÍCULOS:
    // Se encontrar 'agrocontrol_frotas_veiculos' (ou chaves equivalentes), grava em:
    // - agrocontrol_frotas_veiculos
    // - agrocontrol_veiculos
    // - agrocontrol_frotas
    // + redundâncias ativas para os componentes de visualização da frota
    const dadosFrotas = data['agrocontrol_frotas_veiculos'] ?? 
                        data['agrocontrol_veiculos'] ?? 
                        data['agrocontrol_frotas'] ?? 
                        data['colaca_silagem_frotas_veiculos'] ?? 
                        data['silagem_facil_clean_v1_machineries'];

    if (dadosFrotas !== undefined) {
      const serializedFrotas = serialize(dadosFrotas);
      localStorage.setItem('agrocontrol_frotas_veiculos', serializedFrotas);
      localStorage.setItem('agrocontrol_veiculos', serializedFrotas);
      localStorage.setItem('agrocontrol_frotas', serializedFrotas);
      localStorage.setItem('colaca_silagem_frotas_veiculos', serializedFrotas);
      localStorage.setItem('silagem_facil_clean_v1_machineries', serializedFrotas);
    }

    // PNEUS E ESTOQUE DE PNEUS:
    // Se encontrar 'agrocontrol_pneus_estoque' (ou 'agrocontrol_pneus'), grava em:
    // - agrocontrol_pneus_estoque
    // - agrocontrol_pneus
    // + redundâncias ativas para os componentes de estoque e rodízio de pneus
    const dadosPneus = data['agrocontrol_pneus_estoque'] ?? 
                       data['agrocontrol_pneus'] ?? 
                       data['colaca_silagem_frotas_pneus_estoque'] ?? 
                       data['silagem_facil_clean_v1_tire_inventory'];

    if (dadosPneus !== undefined) {
      const serializedPneus = serialize(dadosPneus);
      localStorage.setItem('agrocontrol_pneus_estoque', serializedPneus);
      localStorage.setItem('agrocontrol_pneus', serializedPneus);
      localStorage.setItem('colaca_silagem_frotas_pneus_estoque', serializedPneus);
      localStorage.setItem('silagem_facil_clean_v1_tire_inventory', serializedPneus);
    }

    // PRODUTOS:
    // Se encontrar 'agrocontrol_produtos', grava em:
    // - agrocontrol_produtos
    // + redundâncias ativas para estoque de produtos
    const dadosProdutos = data['agrocontrol_produtos'] ?? 
                          data['colaca_silagem_estoque_produtos'] ?? 
                          data['silagem_facil_clean_v1_inventory'];

    if (dadosProdutos !== undefined) {
      const serializedProdutos = serialize(dadosProdutos);
      localStorage.setItem('agrocontrol_produtos', serializedProdutos);
      localStorage.setItem('colaca_silagem_estoque_produtos', serializedProdutos);
      localStorage.setItem('silagem_facil_clean_v1_inventory', serializedProdutos);
    }

    // FINANCEIRO:
    // Se encontrar 'agrocontrol_financeiro', grava em:
    // - agrocontrol_financeiro
    // + redundâncias ativas para despesas e receitas
    const dadosFinanceiro = data['agrocontrol_financeiro'] ?? 
                            data['silagem_facil_clean_v1_expenses'];

    if (dadosFinanceiro !== undefined) {
      const serializedFinanceiro = serialize(dadosFinanceiro);
      localStorage.setItem('agrocontrol_financeiro', serializedFinanceiro);
      localStorage.setItem('silagem_facil_clean_v1_expenses', serializedFinanceiro);
    }

    // FUNCIONÁRIOS:
    // Se encontrar 'agrocontrol_funcionarios', grava em:
    // - agrocontrol_funcionarios
    // + redundâncias ativas para equipe e motoristas
    const dadosFuncionarios = data['agrocontrol_funcionarios'] ?? 
                              data['colaca_silagem_funcionarios'] ?? 
                              data['silagem_facil_clean_v1_employees'];

    if (dadosFuncionarios !== undefined) {
      const serializedFuncionarios = serialize(dadosFuncionarios);
      localStorage.setItem('agrocontrol_funcionarios', serializedFuncionarios);
      localStorage.setItem('colaca_silagem_funcionarios', serializedFuncionarios);
      localStorage.setItem('silagem_facil_clean_v1_employees', serializedFuncionarios);
    }

    // OUTRAS ENTIDADES OPERACIONAIS COMPLEMENTARES
    if (data['agrocontrol_pedidos_reforma'] !== undefined) {
      const s = serialize(data['agrocontrol_pedidos_reforma']);
      localStorage.setItem('agrocontrol_pedidos_reforma', s);
      localStorage.setItem('colaca_silagem_pedidos_reforma_ativos', s);
    }
    if (data['agrocontrol_fornecedores'] !== undefined) {
      const s = serialize(data['agrocontrol_fornecedores']);
      localStorage.setItem('agrocontrol_fornecedores', s);
      localStorage.setItem('silagem_facil_clean_v1_suppliers', s);
    }
    if (data['agrocontrol_clientes'] !== undefined) {
      const s = serialize(data['agrocontrol_clientes']);
      localStorage.setItem('agrocontrol_clientes', s);
      localStorage.setItem('silagem_facil_clean_v1_clients', s);
    }
    if (data['agrocontrol_empresa'] !== undefined) {
      const s = serialize(data['agrocontrol_empresa']);
      localStorage.setItem('agrocontrol_empresa', s);
      localStorage.setItem('dadosEmpresa', s);
      localStorage.setItem('silagem_facil_clean_v1_company_profile', s);
    }
    if (data['agrocontrol_bancos'] !== undefined) {
      const s = serialize(data['agrocontrol_bancos']);
      localStorage.setItem('agrocontrol_bancos', s);
      localStorage.setItem('colaca_silagem_financeiro_contas', s);
      localStorage.setItem('silagem_facil_clean_v1_bank_accounts', s);
    }
    if (data['agrocontrol_tipos_veiculos'] !== undefined) {
      const s = serialize(data['agrocontrol_tipos_veiculos']);
      localStorage.setItem('agrocontrol_tipos_veiculos', s);
      localStorage.setItem('colaca_silagem_tipos_veiculos', s);
      localStorage.setItem('silagem_facil_clean_v1_vehicle_types', s);
    }
    if (data['agrocontrol_notas_entradas'] !== undefined) {
      const s = serialize(data['agrocontrol_notas_entradas']);
      localStorage.setItem('agrocontrol_notas_entradas', s);
      localStorage.setItem('colaca_silagem_documentos_entrada_itens', s);
    }
    if (data['agrocontrol_safras'] !== undefined) {
      const s = serialize(data['agrocontrol_safras']);
      localStorage.setItem('agrocontrol_safras', s);
      localStorage.setItem('silagem_facil_clean_v1_seasons', s);
    }
    if (data['agrocontrol_pedidos'] !== undefined) {
      const s = serialize(data['agrocontrol_pedidos']);
      localStorage.setItem('agrocontrol_pedidos', s);
      localStorage.setItem('silagem_facil_clean_v1_orders', s);
    }
    if (data['agrocontrol_servicos'] !== undefined) {
      const s = serialize(data['agrocontrol_servicos']);
      localStorage.setItem('agrocontrol_servicos', s);
      localStorage.setItem('silagem_facil_clean_v1_services', s);
    }
    if (data['agrocontrol_combustivel'] !== undefined) {
      const s = serialize(data['agrocontrol_combustivel']);
      localStorage.setItem('agrocontrol_combustivel', s);
      localStorage.setItem('silagem_facil_clean_v1_fuel_logs', s);
    }
    if (data['agrocontrol_manutencao'] !== undefined) {
      const s = serialize(data['agrocontrol_manutencao']);
      localStorage.setItem('agrocontrol_manutencao', s);
      localStorage.setItem('silagem_facil_clean_v1_maintenance_logs', s);
    }

    // 3. RECARREGAMENTO FORÇADO:
    // Limpa a memória do navegador e força a leitura imediata dos novos dados na tela
    window.location.reload();
  } catch (error) {
    console.error('ERRO CRÍTICO NA RESTAURAÇÃO DO BACKUP:', error);
    throw error;
  }
}

// Alias de retrocompatibilidade
export const applyAgroControlRestore = handleRestoreBackup;

export const DataBackupSecurityBlock: React.FC<DataBackupSecurityBlockProps> = ({
  className = '',
  subscriberName = 'COLAÇA SILAGEM LTDA',
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeKeysCount, setActiveKeysCount] = useState<number>(0);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<Record<string, any> | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [pendingKeysList, setPendingKeysList] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Varredura reativa de chaves agrocontrol_*
  const refreshKeyCount = () => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('agrocontrol_')) {
        count++;
      }
    }
    setActiveKeysCount(count);
  };

  useEffect(() => {
    syncAllAgroControlKeys();
    refreshKeyCount();
  }, []);

  // Motor de Exportação (Backup)
  const handleDownloadBackup = () => {
    try {
      setIsProcessing(true);
      const { filename, totalKeys } = exportAgroControlBackup(subscriberName);
      refreshKeyCount();
      setFeedback({
        type: 'success',
        text: `Backup gerado com sucesso! Arquivo "${filename}" baixado contendo ${totalKeys} módulos do sistema.`
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      console.error('Erro ao gerar backup:', err);
      setFeedback({
        type: 'error',
        text: 'Falha ao gerar o arquivo de backup. Verifique as permissões do navegador.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Motor de Importação (Restauração)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) {
          throw new Error('Arquivo vazio');
        }

        const parsed = JSON.parse(content);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Formato JSON inválido');
        }

        // Filtra as chaves detectadas no arquivo
        const keys = Object.keys(parsed).filter(k => k.startsWith('agrocontrol_') || !k.startsWith('_'));
        if (keys.length === 0) {
          throw new Error('Nenhuma chave de dados válida encontrada no arquivo JSON.');
        }

        setPendingRestoreData(parsed);
        setPendingKeysList(keys);
        setIsConfirmModalOpen(true);
      } catch (err: any) {
        console.error('Erro ao ler arquivo de backup:', err);
        setFeedback({
          type: 'error',
          text: `Arquivo JSON inválido: ${err?.message || 'não foi possível interpretar a estrutura do arquivo.'}`
        });
        setTimeout(() => setFeedback(null), 6000);
      } finally {
        // Limpa o valor do input para permitir selecionar o mesmo arquivo novamente
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setFeedback({
        type: 'error',
        text: 'Erro ao ler o arquivo selecionado no disco.'
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingRestoreData) return;
    try {
      setIsProcessing(true);
      handleRestoreBackup(pendingRestoreData);
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      setIsProcessing(false);
      setIsConfirmModalOpen(false);
      setFeedback({
        type: 'error',
        text: 'Erro crítico ao gravar os dados restaurados no LocalStorage.'
      });
    }
  };

  const handleCancelRestore = () => {
    setIsConfirmModalOpen(false);
    setPendingRestoreData(null);
    setPendingFileName('');
    setPendingKeysList([]);
  };

  return (
    <>
      {/* CARD SLIM DE UTILITÁRIOS: MDI TRIDIMENSIONAL ACETINADO */}
      <div 
        id="card-backup-seguranca-sistema" 
        className={`rounded-xl overflow-hidden border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-2xs shrink-0 select-none ${className}`}
      >
        {/* CABEÇALHO COM GRADIENTE TRIDIMENSIONAL ACETINADO OBRIGATÓRIO */}
        <div className="bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border border-slate-400 p-2 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 dark:border-stone-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-base leading-none select-none" role="img" aria-label="disquete">💾</span>
            <h2 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-800 dark:text-stone-100 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] dark:drop-shadow-none">
              💾 CENTRAL DE SEGURANÇA E BACKUP DE DADOS
            </h2>
          </div>
          
          <div className="flex items-center space-x-1.5">
            <span className="hidden md:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>100% OFFLINE</span>
            </span>
            <span className="text-[9px] font-bold text-slate-600 dark:text-stone-400 bg-slate-100/80 dark:bg-stone-800 px-2 py-0.5 rounded-md border border-slate-300 dark:border-stone-600">
              {activeKeysCount} CHAVES ATIVAS
            </span>
          </div>
        </div>

        {/* CORPO DO CARD SLIM COM TIPOGRAFIA MICRO E FORMATO ESTÁTICO */}
        <div className="p-2 sm:p-2.5 bg-slate-50/70 dark:bg-stone-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Informações de Contexto do Assinante */}
          <div className="flex items-start sm:items-center space-x-2 text-slate-700 dark:text-stone-300 min-w-0">
            <div className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-stone-800 border border-slate-300 dark:border-stone-700 shrink-0 text-slate-700 dark:text-stone-300">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="text-[10px] font-extrabold uppercase text-slate-900 dark:text-white truncate">
                  SEGURANÇA DO SISTEMA • {subscriberName}
                </span>
              </div>
              <p className="text-[9px] text-slate-600 dark:text-stone-400 font-medium truncate">
                Exportação e importação direta das chaves <code className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-stone-800 px-1 py-0.2 rounded">agrocontrol_*</code> gravadas no LocalStorage do navegador.
              </p>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO: MOTOR DE BACKUP & MOTOR DE RESTAURAÇÃO */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Input oculto para carregar arquivo .json */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".json,application/json" 
              className="hidden" 
              id="input-restaurar-backup-file"
            />

            {/* BOTÃO 1: GERAR BACKUP DO SISTEMA (BAIXAR ARQUIVO) */}
            <button
              type="button"
              id="btn-gerar-backup-sistema"
              onClick={handleDownloadBackup}
              disabled={isProcessing}
              title="Baixar arquivo JSON com todas as tabelas e dados do sistema salvos no navegador"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider border border-emerald-800 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.35)] transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100 stroke-[2.5]" />
              <span>📥 GERAR BACKUP DO SISTEMA (BAIXAR ARQUIVO)</span>
            </button>

            {/* BOTÃO 2: RESTAURAR BACKUP (ARQUIVO .JSON) */}
            <button
              type="button"
              id="btn-restaurar-backup-sistema"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              title="Carregar arquivo .JSON e substituir os dados locais da tela"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 hover:from-slate-100 hover:to-slate-200 text-slate-800 dark:from-stone-800 dark:via-stone-750 dark:to-stone-850 dark:text-stone-100 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider border border-slate-400 dark:border-stone-600 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9)] dark:shadow-[inset_1px_1px_0px_rgba(255,255,255,0.1)] transition active:scale-95 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-slate-700 dark:text-stone-300 stroke-[2.5]" />
              <span>RESTAURAR BACKUP (ARQUIVO .JSON)</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK INLINE MICRO */}
        {feedback && (
          <div className={`px-3 py-1 text-[10px] font-bold flex items-center justify-between border-t ${
            feedback.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' 
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
          }`}>
            <span className="flex items-center space-x-1.5 truncate">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3 h-3 shrink-0 text-rose-600" />
              )}
              <span className="truncate">{feedback.text}</span>
            </span>
            <button 
              type="button" 
              onClick={() => setFeedback(null)} 
              className="text-slate-400 hover:text-slate-600 ml-2"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO CUSTOMIZADO EM TELA (ANTI-SANDBOX BLOCK) */}
      {isConfirmModalOpen && (
        <div 
          id="modal-confirm-restore-backup"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-stone-900 rounded-2xl border-2 border-amber-400/80 dark:border-amber-600 w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Cabeçalho de Alerta Visual */}
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-3 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1 rounded-md bg-white/20 backdrop-blur-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-100 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[10px] font-black tracking-widest uppercase text-amber-100">
                    CONFIRMAÇÃO MANDATÓRIA DE SEGURANÇA
                  </span>
                  <h3 className="text-xs sm:text-sm font-black uppercase text-white tracking-wide">
                    RESTAURAÇÃO DO BANCO DE DADOS LOCAL
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

            {/* Mensagem em Caixa Alta Estrita Conforme Especificação */}
            <div className="p-4 space-y-3.5 bg-stone-50/50 dark:bg-stone-900">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80">
                <p className="text-xs sm:text-[13px] font-black text-amber-950 dark:text-amber-200 leading-snug tracking-tight">
                  ATENÇÃO: A RESTAURAÇÃO IRÁ SUBSTITUIR TODOS OS DADOS ATUAIS DA TELA PELOS DADOS DO ARQUIVO. DESEJA CONTINUAR?
                </p>
              </div>

              {/* Detalhes do Arquivo Carregado */}
              <div className="bg-white dark:bg-stone-800 rounded-xl border border-slate-200 dark:border-stone-700 p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-700 dark:text-stone-300">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Arquivo Carregado:</span>
                  <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[240px]">
                    {pendingFileName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-stone-300">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Assinante Alvo:</span>
                  <span className="font-bold text-[11px] text-emerald-700 dark:text-emerald-400 uppercase">
                    {subscriberName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-stone-300">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Chaves Identificadas:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    {pendingKeysList.length} tabelas prontas para gravação
                  </span>
                </div>

                {/* Prévia das Chaves */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-stone-700">
                  <span className="block text-[9px] font-bold uppercase text-slate-500 mb-1">
                    Exemplos de módulos detectados:
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                    {pendingKeysList.slice(0, 10).map((k) => (
                      <span 
                        key={k} 
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-stone-700 text-slate-700 dark:text-stone-300 border border-slate-200 dark:border-stone-600 truncate max-w-[180px]"
                      >
                        {k}
                      </span>
                    ))}
                    {pendingKeysList.length > 10 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-stone-700 text-slate-600 dark:text-stone-300">
                        +{pendingKeysList.length - 10} adicionais
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Informação sobre recarregamento */}
              <p className="text-[10px] text-slate-600 dark:text-stone-400 font-semibold leading-relaxed">
                Ao clicar em confirmar, o sistema executará <code className="text-slate-800 dark:text-stone-200 bg-slate-100 dark:bg-stone-800 px-1 py-0.5 rounded font-mono">localStorage.setItem()</code> para cada registro e recarregará a aplicação instantaneamente para readmitir os novos dados.
              </p>
            </div>

            {/* Botões do Modal */}
            <div className="p-3 bg-slate-100 dark:bg-stone-800/80 border-t border-slate-200 dark:border-stone-700 flex items-center justify-end space-x-2">
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
    </>
  );
};
