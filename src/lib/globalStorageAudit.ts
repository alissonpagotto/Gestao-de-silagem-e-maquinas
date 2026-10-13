/**
 * MOTOR DE CONTINGÊNCIA UNIVERSAL DO LOCALSTORAGE (VARREDURA COMPLETA BASEADA NO MENU PRINCIPAL)
 * 
 * Executa auditoria, reconciliação e blindagem de dados 100% offline em todas as 13 categorias
 * do Menu Principal:
 * 1. DASHBOARD & RELATÓRIOS (agrocontrol_site_settings, agrocontrol_dashboard_stats, agrocontrol_relatorios_gerais)
 * 2. SERVIÇOS (agrocontrol_servicos, colaca_silagem_servicos_prestados, silagem_facil_clean_v1_services, colaca_silagem_servicos, agrocontrol_pedidos, silagem_facil_clean_v1_orders)
 * 3. VENDA & PDV (agrocontrol_vendas, agrocontrol_pdv_vendas, silagem_facil_clean_v1_sales, colaca_silagem_vendas_pdv)
 * 4. ESTOQUE (agrocontrol_produtos, colaca_silagem_estoque_produtos, silagem_facil_clean_v1_inventory)
 * 5. ALMOXARIFADO & PNEUS (agrocontrol_pneus_estoque, agrocontrol_pneus, colaca_silagem_frotas_pneus_estoque, silagem_facil_clean_v1_tire_inventory, silagem_facil_clean_v1_tire_rotation_logs)
 * 6. FINANCEIRO (agrocontrol_financeiro, agrocontrol_bancos, agrocontrol_contas_bancarias, agrocontrol_bancos_colaca_silagem, agrocontrol_financeiro_contas, colaca_silagem_financeiro_contas, silagem_facil_clean_v1_expenses, silagem_facil_clean_v1_bank_accounts, silagem_facil_clean_v1_settlements)
 * 7. NOTAS E ENTRADAS (agrocontrol_notas_entradas, agrocontrol_mdfe, agrocontrol_manifestacoes_sefaz, agrocontrol_notas_nfse, colaca_silagem_documentos_entrada, colaca_silagem_documentos_entrada_itens)
 * 8. RH (agrocontrol_funcionarios, colaca_silagem_funcionarios, silagem_facil_clean_v1_employees, silagem_facil_clean_v1_payrolls, silagem_facil_clean_v1_vacations, silagem_facil_clean_v1_terminations, silagem_facil_clean_v1_absences)
 * 9. RELATÓRIOS (agrocontrol_relatorios_gerais, agrocontrol_dashboard_stats, agrocontrol_relatorios_safra)
 * 10. CLIENTES (agrocontrol_clientes, colaca_silagem_clientes, silagem_facil_clean_v1_clients)
 * 11. FORNECEDORES (agrocontrol_fornecedores, colaca_silagem_fornecedores, silagem_facil_clean_v1_suppliers)
 * 12. GESTÃO DE FROTAS (agrocontrol_frotas_veiculos, agrocontrol_frotas, agrocontrol_veiculos, colaca_silagem_frotas_veiculos, silagem_facil_clean_v1_machineries, silagem_facil_clean_v1_fuel_logs, silagem_facil_clean_v1_maintenance_logs)
 * 13. CADASTROS BASE (agrocontrol_centros_custo, agrocontrol_plano_contas, agrocontrol_cargos_permissoes, colaca_silagem_centros_custo, colaca_silagem_plano_contas, silagem_facil_clean_v1_cost_centers, silagem_facil_clean_v1_categories)
 * EXTRA: DADOS DA EMPRESA (agrocontrol_empresa, dadosEmpresa, silagem_facil_clean_v1_company_profile)
 * 
 * DIRETRIZ DE SEGURANÇA SLIM DESIGN PRO:
 * - A auditoria roda automaticamente antes do carregamento de qualquer tela.
 * - Array com dados reais NUNCA é sobrescrito por array vazio '[]'.
 * - Preserva e espelha os maiores arrays entre chaves correlatas para evitar telas em branco.
 */

export interface StorageAuditResult {
  auditedCategories: number;
  synchronizedKeys: number;
  recoveredRecords: number;
  timestamp: string;
}

// Helper seguro para obter companyId ativo
function getActiveCompanyId(): string {
  try {
    const raw = localStorage.getItem('agrocontrol_auth_session') || localStorage.getItem('colaca_silagem_auth_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.companyId) return String(parsed.companyId).trim();
    }
  } catch {}
  return 'default';
}

// Parse defensivo de array
function parseArraySafe(raw: string | null): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    // Se for objeto que embrulha array (ex: { items: [...] } ou { records: [...] } ou { categorias: [...] })
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.items)) return parsed.items;
      if (Array.isArray(parsed.records)) return parsed.records;
      if (Array.isArray(parsed.categorias)) return parsed.categorias;
      if (Array.isArray(parsed.produtos)) return parsed.produtos;
    }
    return [];
  } catch {
    return [];
  }
}

// Parse defensivo de objeto
function parseObjectSafe(raw: string | null): Record<string, any> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Unifica e deduplica itens de array por chave identificadora (id, uuid, codigo, chNFe, placa, etc.)
function mergeAndDeduplicate(arrays: any[][]): any[] {
  const map = new Map<string, any>();
  let fallbackIdCounter = 0;

  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const key = 
        item.id || 
        item.uuid || 
        item.codigo || 
        item.code || 
        item.chNFe || 
        item.placa || 
        item.plate || 
        item.cpfCnpj || 
        item.cnpjOrCpf || 
        item.cpf || 
        item.cnpj || 
        item.numero || 
        item.nNF || 
        (item.name ? `name_${item.name}` : undefined) ||
        (item.nome ? `nome_${item.nome}` : undefined) ||
        `anon_${++fallbackIdCounter}`;

      if (!map.has(String(key))) {
        map.set(String(key), item);
      } else {
        // Mescla propriedades sem sobrescrever campos preenchidos com nulos/vazios
        const existing = map.get(String(key));
        const merged = { ...existing };
        for (const [k, v] of Object.entries(item)) {
          if (v !== null && v !== undefined && v !== '' && (merged[k] === null || merged[k] === undefined || merged[k] === '')) {
            merged[k] = v;
          }
        }
        map.set(String(key), merged);
      }
    }
  }

  return Array.from(map.values());
}

// Definição dos Grupos de Entidades das 13 Categorias
interface SyncGroupConfig {
  name: string;
  categoryIndex: number;
  keys: string[];
  type?: 'array' | 'object' | 'plano_contas';
  transform?: (items: any[]) => any[];
}

const STORAGE_SYNC_GROUPS: SyncGroupConfig[] = [
  // 1. DASHBOARD & RELATÓRIOS
  {
    name: 'Dashboard Settings & Stats',
    categoryIndex: 1,
    keys: ['agrocontrol_site_settings', 'agrocontrol_dashboard_stats', 'landingPageSettings'],
    type: 'object',
  },

  // 2. SERVIÇOS (Agenda, corte, colheita, trator, máquina, frete)
  {
    name: 'Serviços Prestados & Ordens',
    categoryIndex: 2,
    keys: [
      'agrocontrol_servicos', 
      'colaca_silagem_servicos_prestados', 
      'silagem_facil_clean_v1_services', 
      'colaca_silagem_servicos', 
      'colaca_silagem_servicos_estoque'
    ],
    type: 'array',
  },
  {
    name: 'Agendamentos & Pedidos de Silagem',
    categoryIndex: 2,
    keys: [
      'agrocontrol_pedidos',
      'silagem_facil_clean_v1_orders',
      'colaca_silagem_pedidos',
      'silagem_facil_clean_v1_service_appointments',
      'colaca_silagem_agendamentos'
    ],
    type: 'array',
  },

  // 3. VENDA & PDV (Frente de caixa e saídas)
  {
    name: 'Vendas & PDV',
    categoryIndex: 3,
    keys: [
      'agrocontrol_vendas', 
      'agrocontrol_pdv_vendas', 
      'silagem_facil_clean_v1_sales', 
      'colaca_silagem_vendas_pdv', 
      'colaca_silagem_vendas'
    ],
    type: 'array',
  },

  // 4. ESTOQUE (Inventário, peças, insumos)
  {
    name: 'Estoque de Produtos e Peças',
    categoryIndex: 4,
    keys: [
      'agrocontrol_produtos', 
      'colaca_silagem_estoque_produtos', 
      'silagem_facil_clean_v1_inventory',
      'colaca_silagem_produtos'
    ],
    type: 'array',
  },

  // 5. ALMOXARIFADO & PNEUS (Parâmetros, estoque e rodízio de pneus)
  {
    name: 'Estoque de Pneus',
    categoryIndex: 5,
    keys: [
      'agrocontrol_pneus_estoque', 
      'agrocontrol_pneus', 
      'colaca_silagem_frotas_pneus_estoque', 
      'silagem_facil_clean_v1_tire_inventory'
    ],
    type: 'array',
  },
  {
    name: 'Rodízio e Histórico de Pneus',
    categoryIndex: 5,
    keys: [
      'agrocontrol_rodizio_pneus',
      'silagem_facil_clean_v1_tire_rotation_logs',
      'colaca_silagem_rodizio_pneus'
    ],
    type: 'array',
  },
  {
    name: 'Pneus em Reforma e Sucata',
    categoryIndex: 5,
    keys: [
      'agrocontrol_pedidos_reforma',
      'colaca_silagem_pedidos_reforma_ativos',
      'silagem_facil_clean_v1_tires_in_reform'
    ],
    type: 'array',
  },

  // 6. FINANCEIRO (Consolidado, contas bancárias, DRE, despesas, acertos)
  {
    name: 'Contas Bancárias e Caixas',
    categoryIndex: 6,
    keys: [
      'agrocontrol_bancos', 
      'agrocontrol_contas_bancarias', 
      'agrocontrol_bancos_colaca_silagem', 
      'agrocontrol_financeiro_contas',
      'colaca_silagem_financeiro_contas',
      'silagem_facil_clean_v1_bank_accounts'
    ],
    type: 'array',
  },
  {
    name: 'Despesas e Lançamentos Financeiros',
    categoryIndex: 6,
    keys: [
      'agrocontrol_financeiro', 
      'agrocontrol_despesas',
      'colaca_silagem_despesas',
      'silagem_facil_clean_v1_expenses'
    ],
    type: 'array',
  },
  {
    name: 'Acertos de Terceiros e Corretores',
    categoryIndex: 6,
    keys: [
      'agrocontrol_acertos',
      'colaca_silagem_acertos',
      'silagem_facil_clean_v1_settlements',
      'silagem_facil_clean_v1_broker_settlements'
    ],
    type: 'array',
  },
  {
    name: 'Cheques e Créditos Financeiros',
    categoryIndex: 6,
    keys: [
      'agrocontrol_cheques',
      'silagem_facil_clean_v1_financeiro_cheques',
      'agrocontrol_cliente_creditos',
      'silagem_facil_clean_v1_cliente_creditos'
    ],
    type: 'array',
  },

  // 7. NOTAS E ENTRADAS (NF-e, CT-e, NFC-e, NFS-e, MDF-e, Manifestações)
  {
    name: 'Documentos Fiscais de Entrada & NF-e',
    categoryIndex: 7,
    keys: [
      'agrocontrol_notas_entradas', 
      'colaca_silagem_documentos_entrada', 
      'colaca_silagem_documentos_entrada_itens',
      'silagem_facil_clean_v1_documentos_entrada'
    ],
    type: 'array',
  },
  {
    name: 'MDF-e (Manifesto Eletrônico de Documentos Fiscais)',
    categoryIndex: 7,
    keys: [
      'agrocontrol_mdfe', 
      'colaca_silagem_mdfe'
    ],
    type: 'array',
  },
  {
    name: 'Manifestações SEFAZ & Eventos',
    categoryIndex: 7,
    keys: [
      'agrocontrol_manifestacoes_sefaz', 
      'colaca_silagem_manifestacoes_sefaz'
    ],
    type: 'array',
  },
  {
    name: 'NFS-e (Notas Fiscais de Serviço Eletrônicas)',
    categoryIndex: 7,
    keys: [
      'agrocontrol_notas_nfse', 
      'colaca_silagem_notas_nfse'
    ],
    type: 'array',
  },

  // 8. RH (Funcionários, folha, rescisões, férias, históricos)
  {
    name: 'Quadro de Funcionários e Colaboradores',
    categoryIndex: 8,
    keys: [
      'agrocontrol_funcionarios', 
      'colaca_silagem_funcionarios', 
      'silagem_facil_clean_v1_employees'
    ],
    type: 'array',
  },
  {
    name: 'Folha de Pagamento',
    categoryIndex: 8,
    keys: [
      'agrocontrol_folhas_pagamento',
      'colaca_silagem_rh_folhas',
      'silagem_facil_clean_v1_payrolls'
    ],
    type: 'array',
  },
  {
    name: 'Férias e Licenças',
    categoryIndex: 8,
    keys: [
      'agrocontrol_ferias',
      'colaca_silagem_rh_ferias',
      'silagem_facil_clean_v1_vacations',
      'silagem_facil_clean_v1_leaves'
    ],
    type: 'array',
  },
  {
    name: 'Rescisões e Términos Trabalhistas',
    categoryIndex: 8,
    keys: [
      'agrocontrol_rescisao',
      'colaca_silagem_rh_rescisao',
      'silagem_facil_clean_v1_terminations'
    ],
    type: 'array',
  },
  {
    name: 'Adiantamentos, Vales e Faltas',
    categoryIndex: 8,
    keys: [
      'agrocontrol_adiantamentos',
      'colaca_silagem_rh_adiantamentos',
      'silagem_facil_clean_v1_salary_advances',
      'silagem_facil_clean_v1_absences'
    ],
    type: 'array',
  },

  // 9. RELATÓRIOS (Visualização comercial e da safra)
  {
    name: 'Relatórios Gerais & Histórico Comercial',
    categoryIndex: 9,
    keys: [
      'agrocontrol_relatorios_gerais', 
      'agrocontrol_dashboard_stats',
      'agrocontrol_relatorios_safra',
      'colaca_silagem_relatorios_gerais'
    ],
    type: 'object',
  },

  // 10. CLIENTES (Cadastros base de produtores rurais)
  {
    name: 'Clientes e Produtores Rurais',
    categoryIndex: 10,
    keys: [
      'agrocontrol_clientes', 
      'colaca_silagem_clientes', 
      'silagem_facil_clean_v1_clients'
    ],
    type: 'array',
  },

  // 11. FORNECEDORES (Cadastros base de parceiros)
  {
    name: 'Fornecedores e Parceiros Comerciais',
    categoryIndex: 11,
    keys: [
      'agrocontrol_fornecedores', 
      'colaca_silagem_fornecedores', 
      'silagem_facil_clean_v1_suppliers'
    ],
    type: 'array',
  },

  // 12. GESTÃO DE FROTAS (Veículos, máquinas, tratores, reboques, manutenções, combustível)
  {
    name: 'Frota de Máquinas, Tratores e Caminhões',
    categoryIndex: 12,
    keys: [
      'agrocontrol_frotas_veiculos', 
      'agrocontrol_frotas', 
      'agrocontrol_veiculos', 
      'colaca_silagem_frotas_veiculos', 
      'silagem_facil_clean_v1_machineries'
    ],
    type: 'array',
    transform: (veiculos: any[]) => {
      // Padroniza terminologia: implementos de caminhão trator / cavalo são "REBOQUE"
      return veiculos.map(veiculo => {
        if (!veiculo || typeof veiculo !== 'object') return veiculo;
        const vTipo = String(veiculo.type || veiculo.category || veiculo.tipo || veiculo.categoria || '').toUpperCase();
        const isCavalo = vTipo.includes('TRATOR_ESTRADA') || vTipo.includes('CAVALO') || vTipo.includes('CAMINHÃO') || vTipo.includes('CAMINHAO');
        if (isCavalo) {
          const vAtt = { ...veiculo };
          if (typeof vAtt.coupledTrailerType === 'string') vAtt.coupledTrailerType = vAtt.coupledTrailerType.replace(/IMPLEMENTO/gi, 'REBOQUE');
          if (typeof vAtt.compositionType === 'string') vAtt.compositionType = vAtt.compositionType.replace(/IMPLEMENTO/gi, 'REBOQUE');
          if (typeof vAtt.implementoType === 'string') vAtt.implementoType = vAtt.implementoType.replace(/IMPLEMENTO/gi, 'REBOQUE');
          return vAtt;
        }
        return veiculo;
      });
    }
  },
  {
    name: 'Abastecimentos e Tanques',
    categoryIndex: 12,
    keys: [
      'agrocontrol_combustivel',
      'silagem_facil_clean_v1_fuel_logs',
      'colaca_silagem_abastecimentos',
      'silagem_facil_clean_v1_tanques_combustivel'
    ],
    type: 'array',
  },
  {
    name: 'Manutenções e Ordens Mecânicas',
    categoryIndex: 12,
    keys: [
      'agrocontrol_manutencao',
      'silagem_facil_clean_v1_maintenance_logs',
      'colaca_silagem_manutencoes'
    ],
    type: 'array',
  },
  {
    name: 'Tipos de Veículos da Frota',
    categoryIndex: 12,
    keys: [
      'agrocontrol_tipos_veiculos',
      'colaca_silagem_tipos_veiculos',
      'silagem_facil_clean_v1_vehicle_types'
    ],
    type: 'array',
  },

  // 13. CADASTROS BASE (Centros de custo, plano de contas, cargos/permissões)
  {
    name: 'Centros de Custo',
    categoryIndex: 13,
    keys: [
      'agrocontrol_centros_custo', 
      'colaca_silagem_centros_custo', 
      'silagem_facil_clean_v1_cost_centers'
    ],
    type: 'array',
  },
  {
    name: 'Plano de Contas & Categorias Financeiras',
    categoryIndex: 13,
    keys: [
      'agrocontrol_plano_contas', 
      'colaca_silagem_plano_contas', 
      'agrocontrol_categorias_despesas', 
      'silagem_facil_clean_v1_categories'
    ],
    type: 'plano_contas',
  },
  {
    name: 'Cargos e Permissões Estruturais',
    categoryIndex: 13,
    keys: [
      'agrocontrol_cargos_permissoes', 
      'colaca_silagem_cargos_permissoes', 
      'silagem_facil_clean_v1_employee_roles'
    ],
    type: 'array',
  },

  // DADOS DA EMPRESA (Perfil corporativo e inscrições)
  {
    name: 'Dados Cadastrais da Empresa',
    categoryIndex: 1, // Vinculado a Dashboard / Empresa
    keys: [
      'agrocontrol_empresa', 
      'dadosEmpresa', 
      'silagem_facil_clean_v1_company_profile', 
      'colaca_company_profile'
    ],
    type: 'object',
  }
];

/**
 * EXECUÇÃO DO MOTOR DE CONTINGÊNCIA UNIVERSAL DO LOCALSTORAGE
 * - Varre todas as chaves de todas as 13 categorias
 * - Detecta arrays em chaves canônicas e chaves com sufixo de companyId
 * - Captura sempre o maior array populado
 * - DIRETRIZ SLIM DESIGN PRO: Jamais sobrescreve array preenchido por '[]'
 * - Espelha instantaneamente para todas as chaves pares
 */
export function executeGlobalStorageAudit(): StorageAuditResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      auditedCategories: 13,
      synchronizedKeys: 0,
      recoveredRecords: 0,
      timestamp: new Date().toISOString()
    };
  }

  const companyId = getActiveCompanyId();
  let synchronizedKeysCount = 0;
  let totalRecoveredRecords = 0;
  const coveredCategories = new Set<number>();

  try {
    for (const group of STORAGE_SYNC_GROUPS) {
      coveredCategories.add(group.categoryIndex);

      // Coleta todas as variantes de chaves (global e com escopo de tenant)
      const expandedKeys: string[] = [];
      for (const k of group.keys) {
        if (!expandedKeys.includes(k)) expandedKeys.push(k);
        const scopedKey = `${k}_${companyId}`;
        if (!expandedKeys.includes(scopedKey)) expandedKeys.push(scopedKey);
      }

      // TRATAMENTO 1: PLANO DE CONTAS (Estrutura mista de categorias e formas de pagamento)
      if (group.type === 'plano_contas') {
        let bestPlanoContasObj: any = null;
        let bestCategoriesArray: any[] = [];

        for (const k of expandedKeys) {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed.categorias) && parsed.categorias.length > 0) {
                if (!bestPlanoContasObj || parsed.categorias.length > (bestPlanoContasObj.categorias?.length || 0)) {
                  bestPlanoContasObj = parsed;
                }
              }
              if (Array.isArray(parsed) && parsed.length > 0) {
                if (parsed.length > bestCategoriesArray.length) {
                  bestCategoriesArray = parsed;
                }
              }
            }
          } catch {}
        }

        // Se encontrou objeto estruturado de plano de contas, espelha para as chaves canônicas de plano de contas
        if (bestPlanoContasObj && bestPlanoContasObj.categorias?.length > 0) {
          const serializedObj = JSON.stringify(bestPlanoContasObj);
          ['agrocontrol_plano_contas', 'colaca_silagem_plano_contas', `colaca_silagem_plano_contas_${companyId}`].forEach(k => {
            const current = localStorage.getItem(k);
            if (!current || current === '[]' || current === '{}' || current === 'null') {
              localStorage.setItem(k, serializedObj);
              synchronizedKeysCount++;
            }
          });

          // Também alimenta o array de categorias simples caso esteja vazio
          if (bestCategoriesArray.length === 0) {
            bestCategoriesArray = bestPlanoContasObj.categorias.map((c: any) => ({
              id: c.id || c.codigo || `cat_${c.nome || 'item'}`,
              name: c.nome || c.name || 'Categoria',
              color: c.cor || c.color || '#0284c7',
              icon: c.icon || 'Tag',
              description: c.descricao || c.description,
              isCustom: false
            }));
          }
        }

        // Se tem array de categorias simples, garante que não seja apagado e espelha
        if (bestCategoriesArray.length > 0) {
          const serializedArr = JSON.stringify(bestCategoriesArray);
          ['agrocontrol_categorias_despesas', 'silagem_facil_clean_v1_categories'].forEach(k => {
            const current = localStorage.getItem(k);
            if (!current || current === '[]' || current === '{}' || current === 'null') {
              localStorage.setItem(k, serializedArr);
              synchronizedKeysCount++;
            }
          });
        }
        continue;
      }

      // TRATAMENTO 2: OBJETOS (Configurações, Stats, Perfil da Empresa)
      if (group.type === 'object') {
        const foundObjects: Record<string, any>[] = [];

        for (const k of expandedKeys) {
          const raw = localStorage.getItem(k);
          const parsed = parseObjectSafe(raw);
          if (parsed && Object.keys(parsed).length > 0) {
            foundObjects.push(parsed);
          }
        }

        if (foundObjects.length > 0) {
          // Mescla todas as propriedades encontradas sem sobrescrever valores válidos por nulos
          const mergedObj: Record<string, any> = {};
          for (const obj of foundObjects) {
            for (const [prop, val] of Object.entries(obj)) {
              if (val !== null && val !== undefined && val !== '' && (mergedObj[prop] === null || mergedObj[prop] === undefined || mergedObj[prop] === '')) {
                mergedObj[prop] = val;
              }
            }
          }

          if (Object.keys(mergedObj).length > 0) {
            const serialized = JSON.stringify(mergedObj);
            for (const k of expandedKeys) {
              const current = localStorage.getItem(k);
              const curObj = parseObjectSafe(current);
              // NUNCA sobrescreve se o atual tiver mais dados específicos, mas preenche se estiver vazio ou parcial
              if (!current || !curObj || Object.keys(curObj).length < Object.keys(mergedObj).length) {
                localStorage.setItem(k, serialized);
                synchronizedKeysCount++;
              }
            }
          }
        }
        continue;
      }

      // TRATAMENTO 3: ARRAYS DE ENTIDADES OPERACIONAIS
      const collectedArrays: any[][] = [];

      for (const k of expandedKeys) {
        const raw = localStorage.getItem(k);
        const parsed = parseArraySafe(raw);
        if (parsed.length > 0) {
          collectedArrays.push(parsed);
        }
      }

      // Se há dados em pelo menos uma chave deste grupo
      if (collectedArrays.length > 0) {
        // Unifica e deduplica itens mantendo o maior volume com completude de campos
        let merged = mergeAndDeduplicate(collectedArrays);

        if (group.transform) {
          merged = group.transform(merged);
        }

        if (merged.length > 0) {
          totalRecoveredRecords += merged.length;
          const serialized = JSON.stringify(merged);

          for (const k of expandedKeys) {
            const currentRaw = localStorage.getItem(k);
            const currentArr = parseArraySafe(currentRaw);

            // DIRETRIZ DE SEGURANÇA SLIM DESIGN PRO:
            // 1. Nunca sobrescrever array com dados por '[]'
            // 2. Se a chave estiver vazia ou com menos dados que o array unificado consolidado, atualiza
            if (currentArr.length < merged.length || !currentRaw || currentRaw === '[]' || currentRaw === 'null') {
              localStorage.setItem(k, serialized);
              synchronizedKeysCount++;
            }
          }
        }
      }
    }

    // Dispara evento global notificando os módulos que a auditoria e espelhamento foram concluídos
    window.dispatchEvent(new CustomEvent('agrocontrol_global_storage_audit_complete', {
      detail: {
        categories: coveredCategories.size,
        synchronizedKeys: synchronizedKeysCount,
        records: totalRecoveredRecords,
        companyId
      }
    }));

  } catch (error) {
    console.warn('Erro não-bloqueante na auditoria global do LocalStorage:', error);
  }

  return {
    auditedCategories: coveredCategories.size || 13,
    synchronizedKeys: synchronizedKeysCount,
    recoveredRecords: totalRecoveredRecords,
    timestamp: new Date().toISOString()
  };
}

// Inicialização imediata ao carregar o módulo no ambiente de execução do navegador
if (typeof window !== 'undefined') {
  try {
    (window as any).executeGlobalStorageAudit = executeGlobalStorageAudit;
    executeGlobalStorageAudit();
  } catch {}
}
