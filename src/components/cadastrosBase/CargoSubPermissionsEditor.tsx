import React from 'react';
import { 
  DollarSign, 
  Receipt, 
  HeartHandshake, 
  FileSpreadsheet, 
  Users, 
  Truck, 
  Database, 
  Building, 
  Tractor, 
  CheckCircle2, 
  XCircle, 
  Info,
  ShieldAlert,
  Sparkles,
  Sliders
} from 'lucide-react';
import { RolePermissions } from '../../types';
import { ModuleKeyFocus } from './CargosPermissoesTab';

interface CargoSubPermissionsEditorProps {
  permissoes: RolePermissions;
  activeModuleFocus: ModuleKeyFocus;
  onSelectModuleFocus: (module: ModuleKeyFocus) => void;
  onToggleSubPermissao: (
    modulo: 'sub_financeiro' | 'sub_notas' | 'sub_rh' | 'sub_relatorios' | 'sub_clientes' | 'sub_fornecedores' | 'sub_cadastros' | 'sub_empresa' | 'sub_servicos' | 'sub_frotas',
    subKey: string,
    valor: boolean
  ) => void;
  onSetAllSubPermissions: (
    modulo: 'sub_financeiro' | 'sub_notas' | 'sub_rh' | 'sub_relatorios' | 'sub_clientes' | 'sub_fornecedores' | 'sub_cadastros' | 'sub_empresa' | 'sub_servicos' | 'sub_frotas',
    valor: boolean
  ) => void;
  onActivateModulo: (modulo: keyof RolePermissions) => void;
}

export const CargoSubPermissionsEditor: React.FC<CargoSubPermissionsEditorProps> = ({
  permissoes,
  activeModuleFocus,
  onSelectModuleFocus,
  onToggleSubPermissao,
  onSetAllSubPermissions,
  onActivateModulo,
}) => {
  // Contadores
  const countFinanceiro = Object.values(permissoes.sub_financeiro || {}).filter(Boolean).length;
  const countNotas = Object.values(permissoes.sub_notas || {}).filter(Boolean).length;
  const countRh = Object.values(permissoes.sub_rh || {}).filter(Boolean).length;
  const countRelatorios = Object.values(permissoes.sub_relatorios || {}).filter(Boolean).length;
  const countClientes = Object.values(permissoes.sub_clientes || {}).filter(Boolean).length;
  const countFornecedores = Object.values(permissoes.sub_fornecedores || {}).filter(Boolean).length;
  const countCadastros = Object.values(permissoes.sub_cadastros || {}).filter(Boolean).length;
  const countEmpresa = Object.values(permissoes.sub_empresa || {}).filter(Boolean).length;
  const countServicos = Object.values(permissoes.sub_servicos || {}).filter(Boolean).length;
  const countFrotas = Object.values(permissoes.sub_frotas || {}).filter(Boolean).length;

  const totalAtivas = 
    countFinanceiro + countNotas + countRh + countRelatorios + 
    countClientes + countFornecedores + countCadastros + 
    countEmpresa + countServicos + countFrotas;

  // Pills de navegação rápida entre módulos no topo da Coluna 3
  const moduleTabs = [
    { id: 'financeiro' as const, label: 'Financeiro', count: countFinanceiro, total: 8, active: Boolean(permissoes.financeiro), icon: DollarSign },
    { id: 'notas' as const, label: 'Notas e Entradas', count: countNotas, total: 4, active: Boolean(permissoes.notas || permissoes.estoque), icon: Receipt },
    { id: 'rh' as const, label: 'RH', count: countRh, total: 9, active: Boolean(permissoes.rh), icon: HeartHandshake },
    { id: 'relatorios' as const, label: 'Relatórios', count: countRelatorios, total: 8, active: Boolean(permissoes.relatorios), icon: FileSpreadsheet },
    { id: 'clientes' as const, label: 'Clientes', count: countClientes, total: 4, active: Boolean(permissoes.clientes), icon: Users },
    { id: 'fornecedores' as const, label: 'Fornecedores', count: countFornecedores, total: 3, active: Boolean(permissoes.fornecedores), icon: Truck },
    { id: 'cadastros' as const, label: 'Cadastros Base', count: countCadastros, total: 3, active: Boolean(permissoes.cadastros_base), icon: Database },
    { id: 'empresa' as const, label: 'Empresa', count: countEmpresa, total: 7, active: Boolean(permissoes.empresa), icon: Building },
    { id: 'servicos' as const, label: 'Serviços', count: countServicos, total: 7, active: Boolean(permissoes.servicos), icon: Tractor },
    { id: 'frotas' as const, label: 'Frotas', count: countFrotas, total: 7, active: Boolean(permissoes.frotas), icon: Truck },
    { id: 'all' as const, label: 'Todos', count: totalAtivas, total: 60, active: true, icon: Sliders },
  ];

  // Helper para renderizar cartão do módulo
  const renderModuleCard = (
    id: string,
    title: string,
    isModuloActive: boolean,
    mainModuloKey: keyof RolePermissions,
    subModuloKey: 'sub_financeiro' | 'sub_notas' | 'sub_rh' | 'sub_relatorios' | 'sub_clientes' | 'sub_fornecedores' | 'sub_cadastros' | 'sub_empresa' | 'sub_servicos' | 'sub_frotas',
    icon: React.ReactNode,
    items: { key: string; label: string }[],
    subValues: any
  ) => {
    return (
      <div 
        key={id}
        className={`rounded-xl border transition-all duration-150 p-3 space-y-2.5 shadow-2xs w-full ${
          isModuloActive
            ? 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-800'
            : 'bg-zinc-50/80 dark:bg-stone-900/60 border-zinc-200/70 dark:border-stone-800/60 opacity-80'
        }`}
      >
        {/* Topo do Bloco Branco com Botões Rápidos e Badge */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-stone-800 gap-2">
          <div className="flex items-center space-x-2 min-w-0 pr-2">
            <div className="p-1 rounded-md bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                  {title}
                </span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase shrink-0 ${
                  isModuloActive 
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800' 
                    : 'bg-zinc-200 text-zinc-600 dark:bg-stone-800 dark:text-stone-400'
                }`}>
                  {isModuloActive ? 'Liberado' : 'Bloqueado'}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 dark:text-stone-400 shrink-0">
                  ({items.filter(it => subValues?.[it.key] !== false).length}/{items.length} ativas)
                </span>
              </div>
            </div>
          </div>

          {/* Botões Rápidos: Marcar Todas | Desmarcar */}
          <div className="flex items-center space-x-1.5 text-[11px] font-bold shrink-0">
            <button
              type="button"
              onClick={() => onSetAllSubPermissions(subModuloKey, true)}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline px-1 py-0.5 rounded cursor-pointer whitespace-nowrap"
            >
              Marcar Todas
            </button>
            <span className="text-zinc-300 dark:text-stone-600">|</span>
            <button
              type="button"
              onClick={() => onSetAllSubPermissions(subModuloKey, false)}
              className="text-zinc-500 dark:text-stone-400 hover:text-zinc-800 dark:hover:text-white hover:underline px-1 py-0.5 rounded cursor-pointer whitespace-nowrap"
            >
              Desmarcar
            </button>
          </div>
        </div>

        {/* Alerta caso o módulo esteja desligado na coluna central */}
        {!isModuloActive && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-[11px] text-amber-800 dark:text-amber-300">
            <div className="flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Chave principal desligada. Clique para liberar este módulo:</span>
            </div>
            <button
              type="button"
              onClick={() => onActivateModulo(mainModuloKey)}
              className="px-2 py-0.5 rounded font-black bg-amber-600 text-white hover:bg-amber-700 transition cursor-pointer text-[10px] shrink-0"
            >
              Ativar
            </button>
          </div>
        )}

        {/* Grade de Checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-1.5 text-xs">
          {items.map((item) => {
            const isChecked = subValues?.[item.key] !== false;
            return (
              <label 
                key={item.key}
                className={`flex items-center space-x-2 p-1.5 rounded-lg border transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-zinc-50/80 dark:bg-stone-850/80 border-indigo-200 dark:border-indigo-900/60 shadow-2xs'
                    : 'bg-white dark:bg-stone-900 border-zinc-200 dark:border-stone-800 hover:border-zinc-300 opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => onToggleSubPermissao(subModuloKey, item.key, e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className={`text-[11px] font-semibold truncate ${
                  isChecked ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-stone-400'
                }`}>
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 flex-1 flex flex-col min-h-0 w-full">
      {/* 1. Barra de Seleção Rápida de Módulo (Pills em Flex-Wrap Multilinha) */}
      <div className="flex flex-row flex-wrap gap-2 shrink-0 w-full">
        {moduleTabs.map((tab) => {
          const isSelected = activeModuleFocus === tab.id;
          const TabIcon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectModuleFocus(tab.id)}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : 'bg-zinc-50 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border-zinc-200 dark:border-stone-700 hover:bg-zinc-100 dark:hover:bg-stone-700'
              }`}
            >
              <TabIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-zinc-500 dark:text-stone-400'}`} />
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                isSelected 
                  ? 'bg-white/20 text-white' 
                  : tab.active 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-zinc-200 text-zinc-600 dark:bg-stone-700 dark:text-stone-400'
              }`}>
                {tab.count}/{tab.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Container dos Cards de Sub-permissões */}
      <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0 w-full">
        
        {/* 1. MÓDULO FINANCEIRO */}
        {(activeModuleFocus === 'financeiro' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-financeiro',
            'Módulo Financeiro',
            Boolean(permissoes.financeiro),
            'financeiro',
            'sub_financeiro',
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
            [
              { key: 'dre', label: 'Consolidado (DRE)' },
              { key: 'despesas', label: 'Despesas' },
              { key: 'contas_bancarias', label: 'Contas Bancárias' },
              { key: 'a_pagar', label: 'A Pagar' },
              { key: 'a_receber', label: 'A Receber' },
              { key: 'acertos_terceiros', label: 'Acertos Terceiros' },
              { key: 'acertos_agenciadores', label: 'Acertos Agenciadores' },
              { key: 'exportar', label: 'Exportar' },
            ],
            permissoes.sub_financeiro
          )}

        {/* 2. MÓDULO NOTAS E ENTRADAS */}
        {(activeModuleFocus === 'notas' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-notas',
            'Módulo Notas e Entradas',
            Boolean(permissoes.notas || permissoes.estoque),
            'notas',
            'sub_notas',
            <Receipt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
            [
              { key: 'historico', label: 'Histórico de Notas e Entradas' },
              { key: 'importar_xml', label: 'Importar XML (Carregar Arquivos)' },
              { key: 'nova_entrada', label: 'Nova Entrada Manual' },
              { key: 'acoes_avancadas', label: 'Ações Avançadas (Editar / Excluir)' },
            ],
            permissoes.sub_notas
          )}

        {/* 3. RECURSOS HUMANOS - RH */}
        {(activeModuleFocus === 'rh' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-rh',
            'Recursos Humanos - RH',
            Boolean(permissoes.rh),
            'rh',
            'sub_rh',
            <HeartHandshake className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
            [
              { key: 'dashboard', label: 'Dashboard RH' },
              { key: 'funcionarios', label: 'Funcionários' },
              { key: 'folha', label: 'Folha de Pagamento' },
              { key: 'ferias', label: 'Férias' },
              { key: 'afastamentos', label: 'Afastamentos' },
              { key: 'adiantamentos', label: 'Adiantamentos' },
              { key: 'atestados', label: 'Atestados' },
              { key: 'faltas', label: 'Faltas' },
              { key: 'rescisao', label: 'Rescisão' },
            ],
            permissoes.sub_rh
          )}

        {/* 4. MÓDULO RELATÓRIOS */}
        {(activeModuleFocus === 'relatorios' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-relatorios',
            'Módulo Relatórios',
            Boolean(permissoes.relatorios),
            'relatorios',
            'sub_relatorios',
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
            [
              { key: 'dashboard', label: 'Dashboard Consolidado' },
              { key: 'resumo_geral', label: 'Resumo Geral' },
              { key: 'ativo_imobilizado', label: 'Ativo Imobilizado' },
              { key: 'exportar_excel', label: 'Exportar Excel' },
              { key: 'cortes', label: 'Cortes' },
              { key: 'vendas', label: 'Vendas' },
              { key: 'despesas', label: 'Despesas' },
              { key: 'consumo', label: 'Consumo' },
            ],
            permissoes.sub_relatorios
          )}

        {/* 5. MÓDULO CLIENTES */}
        {(activeModuleFocus === 'clientes' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-clientes',
            'Módulo Clientes',
            Boolean(permissoes.clientes),
            'clientes',
            'sub_clientes',
            <Users className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />,
            [
              { key: 'lista', label: 'Lista de Clientes (Tabela)' },
              { key: 'kanban', label: 'Funil Kanban' },
              { key: 'novo_cliente', label: '+ Novo Cliente (Cadastrar)' },
              { key: 'acoes_avancadas', label: 'Ações Avançadas (Editar / Excluir)' },
            ],
            permissoes.sub_clientes
          )}

        {/* 6. MÓDULO FORNECEDORES */}
        {(activeModuleFocus === 'fornecedores' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-fornecedores',
            'Módulo Fornecedores',
            Boolean(permissoes.fornecedores),
            'fornecedores',
            'sub_fornecedores',
            <Truck className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />,
            [
              { key: 'lista', label: 'Lista de Fornecedores (Visualizar)' },
              { key: 'novo_fornecedor', label: '+ Cadastrar Fornecedor' },
              { key: 'acoes_avancadas', label: 'Ações Avançadas (Editar / Excluir)' },
            ],
            permissoes.sub_fornecedores
          )}

        {/* 7. MÓDULO CADASTROS BASE */}
        {(activeModuleFocus === 'cadastros' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-cadastros',
            'Módulo Cadastros Base',
            Boolean(permissoes.cadastros_base),
            'cadastros_base',
            'sub_cadastros',
            <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
            [
              { key: 'centros_custo', label: 'Centros de Custo' },
              { key: 'plano_contas', label: 'Plano de Contas & Formas' },
              { key: 'cargos_permissoes', label: 'Cargos, Setores & Permissões' },
            ],
            permissoes.sub_cadastros
          )}

        {/* 8. DADOS DA EMPRESA */}
        {(activeModuleFocus === 'empresa' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-empresa',
            'Dados da Empresa',
            Boolean(permissoes.empresa),
            'empresa',
            'sub_empresa',
            <Building className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
            [
              { key: 'identificacao', label: '1. Identificação (CNPJ/Razão)' },
              { key: 'localizacao', label: '2. Localização & Endereço' },
              { key: 'contatos', label: '3. Contatos & Representante Legal' },
              { key: 'enquadramento_fiscal', label: '4. Enquadramento Fiscal' },
              { key: 'chaves_pix', label: '5. Chaves PIX Oficiais' },
              { key: 'gestao_socios', label: '6. Gestão de Sócios & QSA' },
              { key: 'identidade_visual', label: '7. Logos & Identidade Visual' },
            ],
            permissoes.sub_empresa
          )}

        {/* 9. MÓDULO SERVIÇOS */}
        {(activeModuleFocus === 'servicos' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-servicos',
            'Módulo Serviços',
            Boolean(permissoes.servicos),
            'servicos',
            'sub_servicos',
            <Tractor className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
            [
              { key: 'agenda', label: 'Agenda de Serviços' },
              { key: 'corte', label: 'Corte' },
              { key: 'colheita', label: 'Colheita' },
              { key: 'trator', label: 'Serviço de Trator' },
              { key: 'maquina', label: 'Serviço de Máquina' },
              { key: 'frete', label: 'Serviço de Frete' },
              { key: 'orcamento', label: 'Orçamento' },
            ],
            permissoes.sub_servicos
          )}

        {/* 10. MÓDULO FROTAS & VEÍCULOS */}
        {(activeModuleFocus === 'frotas' || activeModuleFocus === 'all') &&
          renderModuleCard(
            'mod-frotas',
            'Módulo Frotas & Veículos',
            Boolean(permissoes.frotas),
            'frotas',
            'sub_frotas',
            <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
            [
              { key: 'painel', label: 'Painel Frotas' },
              { key: 'veiculos', label: 'Veículos' },
              { key: 'motoristas', label: 'Motoristas' },
              { key: 'equipes', label: 'Equipes' },
              { key: 'combustivel', label: 'Combustível (Abastecimentos)' },
              { key: 'manutencoes', label: 'Manutenções' },
              { key: 'pneus', label: 'Rodízio de Pneus' },
            ],
            permissoes.sub_frotas
          )}
      </div>

      {/* 3. Rodapé Resumo Granular */}
      <div className="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-[11px] text-indigo-950 dark:text-indigo-300 flex items-center justify-between shrink-0 w-full">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Total de Telas e Abas Ativas:</span>
        </div>
        <span className="font-extrabold px-2 py-0.5 rounded-md bg-indigo-600 text-white text-xs">
          {totalAtivas} de 60 ativas
        </span>
      </div>
    </div>
  );
};
