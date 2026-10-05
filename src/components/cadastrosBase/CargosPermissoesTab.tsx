import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shield, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Users, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Info,
  DollarSign,
  Truck,
  Tractor,
  Eye,
  HeartHandshake,
  Package,
  Building,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ChevronRight,
  Check,
  X,
  Layers,
  Sparkles,
  Save,
  CheckSquare,
  Square,
  ShieldCheck,
  LayoutGrid,
  List,
  FileText,
  FileSpreadsheet,
  BarChart2,
  ArrowDownLeft,
  ArrowUpRight,
  Handshake,
  Download,
  Scissors,
  ShoppingCart,
  Fuel,
  UserSquare2,
  Calendar,
  AlertCircle,
  FileHeart,
  CalendarX2,
  UserX,
  Database,
  MapPin,
  Phone,
  CreditCard,
  LayoutDashboard,
  Receipt,
  UserCheck
} from 'lucide-react';
import { 
  CargoPermissao, 
  RolePermissions, 
  Employee, 
  ServicesSubPermissions, 
  FrotasSubPermissions,
  FinanceiroSubPermissions,
  NotasSubPermissions,
  RhSubPermissions,
  RelatoriosSubPermissions,
  ClientesSubPermissions,
  FornecedoresSubPermissions,
  CadastrosBaseSubPermissions,
  EmpresaSubPermissions
} from '../../types';
import { 
  getStoredCargosPermissoes, 
  saveStoredCargosPermissoes, 
  INITIAL_CARGOS_PERMISSOES,
  CADASTROS_STORAGE_KEYS 
} from '../../lib/cadastrosBaseStorage';
import { getStoredEmployees, saveStoredEmployees } from '../../lib/storage';
import { CargoEmployeesModal } from './CargoEmployeesModal';
import { CargoSubPermissionsEditor } from './CargoSubPermissionsEditor';

const SETORES_DISPONIVEIS = [
  'DIRETORIA & ADMINISTRATIVO',
  'FINANCEIRO & CONTABILIDADE',
  'TRANSPORTE & LOGÍSTICA',
  'CAMPO & SILAGEM',
  'OFICINA & MANUTENÇÃO',
  'RECURSOS HUMANOS'
];

export type ModuleKeyFocus = 
  | 'financeiro'
  | 'notas'
  | 'rh'
  | 'relatorios'
  | 'clientes'
  | 'fornecedores'
  | 'cadastros'
  | 'empresa'
  | 'servicos'
  | 'frotas'
  | 'all';

const DEFAULT_FORM_PERMISSOES: RolePermissions = {
  financeiro: false,
  frotas: true,
  rh: false,
  estoque: false,
  empresa: false,
  servicos: true,
  notas: false,
  relatorios: false,
  clientes: false,
  fornecedores: false,
  cadastros_base: false,
  sub_servicos: {
    agenda: true,
    corte: true,
    colheita: true,
    trator: true,
    maquina: true,
    frete: true,
    orcamento: true,
  },
  sub_frotas: {
    painel: true,
    veiculos: true,
    motoristas: true,
    equipes: true,
    combustivel: true,
    manutencoes: true,
    pneus: true,
  },
  sub_financeiro: {
    dre: true,
    despesas: true,
    contas_bancarias: true,
    a_pagar: true,
    a_receber: true,
    acertos_terceiros: true,
    acertos_agenciadores: true,
    exportar: true,
  },
  sub_notas: {
    historico: true,
    importar_xml: true,
    nova_entrada: true,
    acoes_avancadas: true,
  },
  sub_rh: {
    dashboard: true,
    funcionarios: true,
    folha: true,
    ferias: true,
    afastamentos: true,
    adiantamentos: true,
    atestados: true,
    faltas: true,
    rescisao: true,
  },
  sub_relatorios: {
    dashboard: true,
    resumo_geral: true,
    ativo_imobilizado: true,
    exportar_excel: true,
    cortes: true,
    vendas: true,
    despesas: true,
    consumo: true,
  },
  sub_clientes: {
    lista: true,
    kanban: true,
    novo_cliente: true,
    acoes_avancadas: true,
  },
  sub_fornecedores: {
    lista: true,
    novo_fornecedor: true,
    acoes_avancadas: true,
  },
  sub_cadastros: {
    centros_custo: true,
    plano_contas: true,
    cargos_permissoes: true,
  },
  sub_empresa: {
    identificacao: true,
    localizacao: true,
    contatos: true,
    enquadramento_fiscal: true,
    chaves_pix: true,
    gestao_socios: true,
    identidade_visual: true,
    bancarios: true,
  },
};

export const CargosPermissoesTab: React.FC = () => {
  const [cargos, setCargos] = useState<CargoPermissao[]>(() => getStoredCargosPermissoes());
  const [employees, setEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('silagem_cargos_view_mode');
      if (saved === 'grid' || saved === 'list') return saved;
    } catch {}
    return 'list'; // Tabela limpa como padrão
  });

  // Modal Expandido em 3 Colunas (Editor / Novo Cargo)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editorSearchTerm, setEditorSearchTerm] = useState('');
  const [activeModuleFocus, setActiveModuleFocus] = useState<ModuleKeyFocus>('financeiro');

  // Modal Slim de Colaboradores
  const [selectedCargoForEmployees, setSelectedCargoForEmployees] = useState<CargoPermissao | null>(null);

  // Form State (Coluna Central do Editor)
  const [nome, setNome] = useState('');
  const [setor, setSetor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [permissoes, setPermissoes] = useState<RolePermissions>({ ...DEFAULT_FORM_PERMISSOES });
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Combobox Autocomplete State
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Sincronização em tempo real de eventos locais
  useEffect(() => {
    const handleCargosSync = () => {
      setCargos(getStoredCargosPermissoes());
    };
    const handleEmployeesSync = () => {
      setEmployees(getStoredEmployees());
    };

    window.addEventListener('colaca_silagem_cargos_updated', handleCargosSync);
    window.addEventListener('storage', handleCargosSync);
    window.addEventListener('silagem_employees_updated', handleEmployeesSync);

    return () => {
      window.removeEventListener('colaca_silagem_cargos_updated', handleCargosSync);
      window.removeEventListener('storage', handleCargosSync);
      window.removeEventListener('silagem_employees_updated', handleEmployeesSync);
    };
  }, []);

  // Fechar combobox ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Contagem de funcionários por cargo
  const employeeCountByCargo = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach(emp => {
      const roleStr = (emp.role || '').trim().toLowerCase();
      const cargoId = emp.cargoId;
      if (cargoId) {
        map[cargoId] = (map[cargoId] || 0) + 1;
      }
      cargos.forEach(c => {
        if (c.nome.trim().toLowerCase() === roleStr) {
          map[c.id] = (map[c.id] || 0) + 1;
        }
      });
    });
    return map;
  }, [employees, cargos]);

  // Lista de cargos ordenada compulsoriamente de A a Z
  const sortedCargos = useMemo(() => {
    return [...cargos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [cargos]);

  // Lista filtrada para a Tabela Principal (Print 2)
  const filteredCargos = useMemo(() => {
    if (!searchTerm.trim()) return sortedCargos;
    const term = searchTerm.toLowerCase();
    return sortedCargos.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.setor.toLowerCase().includes(term) ||
      (c.descricao && c.descricao.toLowerCase().includes(term))
    );
  }, [sortedCargos, searchTerm]);

  // Lista filtrada para o painel lateral interno do editor (Coluna 1)
  const editorFilteredCargos = useMemo(() => {
    if (!editorSearchTerm.trim()) return sortedCargos;
    const term = editorSearchTerm.toLowerCase();
    return sortedCargos.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.setor.toLowerCase().includes(term)
    );
  }, [sortedCargos, editorSearchTerm]);

  // Nomes de cargos cadastrados para o combobox
  const existingCargoSuggestions = useMemo(() => {
    const unique = Array.from(new Set(cargos.map(c => c.nome.trim()))).filter(Boolean);
    const query = nome.trim().toLowerCase();
    const sorted = unique.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!query) return sorted;
    return sorted.filter(n => n.toLowerCase().includes(query));
  }, [cargos, nome]);

  // Cargo selecionado atual no editor
  const selectedCargo = useMemo(() => {
    if (!selectedCargoId) return null;
    return cargos.find(c => c.id === selectedCargoId) || null;
  }, [cargos, selectedCargoId]);

  // Carregar dados de um cargo no form do editor
  const handleSelectCargo = (cargo: CargoPermissao) => {
    setIsCreatingNew(false);
    setSelectedCargoId(cargo.id);
    setNome(cargo.nome);
    setSetor(cargo.setor);
    setDescricao(cargo.descricao || '');
    setPermissoes({
      financeiro: Boolean(cargo.permissoes?.financeiro),
      frotas: Boolean(cargo.permissoes?.frotas),
      rh: Boolean(cargo.permissoes?.rh),
      estoque: Boolean(cargo.permissoes?.estoque),
      empresa: Boolean(cargo.permissoes?.empresa),
      servicos: cargo.permissoes?.servicos !== undefined ? Boolean(cargo.permissoes.servicos) : true,
      notas: cargo.permissoes?.notas !== undefined ? Boolean(cargo.permissoes.notas) : Boolean(cargo.permissoes?.estoque),
      relatorios: cargo.permissoes?.relatorios !== undefined ? Boolean(cargo.permissoes.relatorios) : true,
      clientes: cargo.permissoes?.clientes !== undefined ? Boolean(cargo.permissoes.clientes) : true,
      fornecedores: cargo.permissoes?.fornecedores !== undefined ? Boolean(cargo.permissoes.fornecedores) : true,
      cadastros_base: cargo.permissoes?.cadastros_base !== undefined ? Boolean(cargo.permissoes.cadastros_base) : true,
      sub_servicos: cargo.permissoes?.sub_servicos || { ...DEFAULT_FORM_PERMISSOES.sub_servicos },
      sub_frotas: cargo.permissoes?.sub_frotas || { ...DEFAULT_FORM_PERMISSOES.sub_frotas },
      sub_financeiro: cargo.permissoes?.sub_financeiro || { ...DEFAULT_FORM_PERMISSOES.sub_financeiro },
      sub_notas: cargo.permissoes?.sub_notas || { ...DEFAULT_FORM_PERMISSOES.sub_notas },
      sub_rh: cargo.permissoes?.sub_rh || { ...DEFAULT_FORM_PERMISSOES.sub_rh },
      sub_relatorios: cargo.permissoes?.sub_relatorios || { ...DEFAULT_FORM_PERMISSOES.sub_relatorios },
      sub_clientes: cargo.permissoes?.sub_clientes || { ...DEFAULT_FORM_PERMISSOES.sub_clientes },
      sub_fornecedores: cargo.permissoes?.sub_fornecedores || { ...DEFAULT_FORM_PERMISSOES.sub_fornecedores },
      sub_cadastros: cargo.permissoes?.sub_cadastros || { ...DEFAULT_FORM_PERMISSOES.sub_cadastros },
      sub_empresa: cargo.permissoes?.sub_empresa || { ...DEFAULT_FORM_PERMISSOES.sub_empresa },
    });
    setFormError('');
  };

  // Abrir Modal de Edição a partir de uma linha da Tabela (Print 1 & 3)
  const handleOpenEditModal = (cargo: CargoPermissao) => {
    handleSelectCargo(cargo);
    setIsEditorOpen(true);
  };

  // Abrir Modal de Cadastro de Novo Cargo (Print 1 & 3)
  const handleOpenCreateModal = () => {
    setIsCreatingNew(true);
    setSelectedCargoId(null);
    setNome('');
    setSetor('CAMPO & SILAGEM');
    setDescricao('');
    setPermissoes({ ...DEFAULT_FORM_PERMISSOES });
    setFormError('');
    setIsEditorOpen(true);
  };

  // Fechar Modal Expandido e Retornar à Tabela Geral Limpa
  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setFormError('');
  };

  // Manipulador de Toggle de Permissão Principal com Foco Instantâneo na Coluna 3
  const atualizarPermissao = (modulo: keyof RolePermissions, valor: boolean) => {
    setPermissoes(prev => {
      const next = { ...prev, [modulo]: valor };
      if (modulo === 'notas') {
        next.estoque = valor;
      } else if (modulo === 'estoque') {
        next.notas = valor;
      }
      return next;
    });
    // Foca instantaneamente o painel da Coluna 3 para exibir as sub-permissões daquele módulo
    if (modulo === 'financeiro') setActiveModuleFocus('financeiro');
    else if (modulo === 'notas' || modulo === 'estoque') setActiveModuleFocus('notas');
    else if (modulo === 'rh') setActiveModuleFocus('rh');
    else if (modulo === 'relatorios') setActiveModuleFocus('relatorios');
    else if (modulo === 'clientes') setActiveModuleFocus('clientes');
    else if (modulo === 'fornecedores') setActiveModuleFocus('fornecedores');
    else if (modulo === 'cadastros_base') setActiveModuleFocus('cadastros');
    else if (modulo === 'empresa') setActiveModuleFocus('empresa');
    else if (modulo === 'servicos') setActiveModuleFocus('servicos');
    else if (modulo === 'frotas') setActiveModuleFocus('frotas');
  };

  // Manipulador universal de sub-permissão
  const toggleSubPermissao = (
    modulo: 'sub_financeiro' | 'sub_notas' | 'sub_rh' | 'sub_relatorios' | 'sub_clientes' | 'sub_fornecedores' | 'sub_cadastros' | 'sub_empresa' | 'sub_servicos' | 'sub_frotas',
    subKey: string,
    valor: boolean
  ) => {
    setPermissoes(prev => ({
      ...prev,
      [modulo]: {
        ...(prev[modulo] as any || {}),
        [subKey]: valor
      }
    }));
  };

  // Botões rápidos: Marcar Todas / Desmarcar
  const setAllSubPermissionsForModule = (
    modulo: 'sub_financeiro' | 'sub_notas' | 'sub_rh' | 'sub_relatorios' | 'sub_clientes' | 'sub_fornecedores' | 'sub_cadastros' | 'sub_empresa' | 'sub_servicos' | 'sub_frotas',
    valor: boolean
  ) => {
    const keysMap: Record<string, string[]> = {
      sub_financeiro: ['dre', 'despesas', 'contas_bancarias', 'a_pagar', 'a_receber', 'acertos_terceiros', 'acertos_agenciadores', 'exportar'],
      sub_notas: ['historico', 'importar_xml', 'nova_entrada', 'acoes_avancadas'],
      sub_rh: ['dashboard', 'funcionarios', 'folha', 'ferias', 'afastamentos', 'adiantamentos', 'atestados', 'faltas', 'rescisao'],
      sub_relatorios: ['dashboard', 'resumo_geral', 'ativo_imobilizado', 'exportar_excel', 'cortes', 'vendas', 'despesas', 'consumo'],
      sub_clientes: ['lista', 'kanban', 'novo_cliente', 'acoes_avancadas'],
      sub_fornecedores: ['lista', 'novo_fornecedor', 'acoes_avancadas'],
      sub_cadastros: ['centros_custo', 'plano_contas', 'cargos_permissoes'],
      sub_empresa: ['identificacao', 'localizacao', 'contatos', 'enquadramento_fiscal', 'chaves_pix', 'gestao_socios', 'identidade_visual'],
      sub_servicos: ['agenda', 'corte', 'colheita', 'trator', 'maquina', 'frete', 'orcamento'],
      sub_frotas: ['painel', 'veiculos', 'motoristas', 'equipes', 'combustivel', 'manutencoes', 'pneus'],
    };

    const keys = keysMap[modulo] || [];
    const updatedSub: Record<string, boolean> = {};
    keys.forEach(k => {
      updatedSub[k] = valor;
    });

    setPermissoes(prev => ({
      ...prev,
      [modulo]: updatedSub
    }));
  };

  // Manipuladores de compatibilidade
  const atualizarSubServico = (subKey: keyof ServicesSubPermissions, valor: boolean) => {
    toggleSubPermissao('sub_servicos', subKey, valor);
  };

  const atualizarSubFrota = (subKey: keyof FrotasSubPermissions, valor: boolean) => {
    toggleSubPermissao('sub_frotas', subKey, valor);
  };

  // Salvar Cargo (Criação ou Edição) e Retornar à Tabela Geral
  const handleSaveCargo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNome = nome.trim();
    const cleanSetor = setor.trim();

    if (!cleanNome) {
      setFormError('Informe o nome do cargo obrigatoriamente.');
      return;
    }
    if (!cleanSetor) {
      setFormError('Informe o setor / departamento.');
      return;
    }

    // Valida duplicação de nome
    const exists = cargos.some(c => 
      c.nome.trim().toLowerCase() === cleanNome.toLowerCase() && 
      c.id !== selectedCargoId
    );
    if (exists) {
      setFormError(`Já existe um cargo cadastrado com o nome "${cleanNome}".`);
      return;
    }

    let updatedList: CargoPermissao[];
    let savedCargoId: string;

    if (selectedCargoId && !isCreatingNew) {
      savedCargoId = selectedCargoId;
      const existing = cargos.find(c => c.id === selectedCargoId);
      const updatedCargo: CargoPermissao = {
        id: selectedCargoId,
        nome: cleanNome,
        setor: cleanSetor,
        descricao: descricao.trim() || undefined,
        permissoes: { ...permissoes },
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedList = cargos.map(c => c.id === selectedCargoId ? updatedCargo : c);
      showToast(`Cargo "${cleanNome}" atualizado com sucesso!`);
    } else {
      savedCargoId = `cargo-${Date.now()}`;
      const newCargo: CargoPermissao = {
        id: savedCargoId,
        nome: cleanNome,
        setor: cleanSetor,
        descricao: descricao.trim() || undefined,
        permissoes: { ...permissoes },
        createdAt: new Date().toISOString(),
      };
      updatedList = [...cargos, newCargo];
      showToast(`Novo cargo "${cleanNome}" cadastrado com sucesso!`);
    }

    setCargos(updatedList);
    saveStoredCargosPermissoes(updatedList);
    setFormError('');

    // Propaga atualização de permissões aos colaboradores associados a este cargo
    const currentEmps = getStoredEmployees();
    let empsModified = false;
    const refreshedEmps = currentEmps.map(emp => {
      const matchByName = emp.role && emp.role.trim().toLowerCase() === cleanNome.toLowerCase();
      const matchById = emp.cargoId === savedCargoId;
      if (matchByName || matchById) {
        empsModified = true;
        return {
          ...emp,
          cargoId: savedCargoId,
          cargo_setor: cleanSetor,
          permissions: { ...permissoes },
          permissoes: { ...permissoes },
        };
      }
      return emp;
    });

    if (empsModified) {
      saveStoredEmployees(refreshedEmps);
      setEmployees(refreshedEmps);
    }

    // Fecha o modal e retorna para a tabela geral limpa (Passo 1 & 3)
    setIsEditorOpen(false);
  };

  // Excluir Cargo
  const handleDeleteCargo = (cargoId: string) => {
    const cargo = cargos.find(c => c.id === cargoId);
    if (!cargo) return;

    const count = employeeCountByCargo[cargo.id] || 0;
    if (count > 0) {
      if (!confirm(`Atenção: Existem ${count} colaborador(es) associados ao cargo "${cargo.nome}". Deseja realmente remover? As permissões serão revogadas.`)) {
        return;
      }
    } else {
      if (!confirm(`Tem certeza que deseja excluir o cargo "${cargo.nome}"?`)) {
        return;
      }
    }

    const updated = cargos.filter(c => c.id !== cargo.id);
    setCargos(updated);
    saveStoredCargosPermissoes(updated);
    showToast(`Cargo "${cargo.nome}" removido.`);

    // Se estava editando este cargo no modal, seleciona o primeiro restante ou fecha
    if (selectedCargoId === cargoId) {
      if (updated.length > 0) {
        const sorted = [...updated].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        handleSelectCargo(sorted[0]);
      } else {
        setIsEditorOpen(false);
      }
    }
  };

  // Restaurar padrão
  const handleResetDefaults = () => {
    if (confirm('Deseja restaurar a matriz padrão de cargos e permissões do sistema?')) {
      setCargos(INITIAL_CARGOS_PERMISSOES);
      saveStoredCargosPermissoes(INITIAL_CARGOS_PERMISSOES);
      showToast('Cargos e permissões restaurados para o padrão.');
    }
  };

  // Contadores de sub-permissões ativas no editor
  const activeSubServicosCount = useMemo(() => {
    if (!permissoes.sub_servicos) return 0;
    return Object.values(permissoes.sub_servicos).filter(Boolean).length;
  }, [permissoes.sub_servicos]);

  const activeSubFrotasCount = useMemo(() => {
    if (!permissoes.sub_frotas) return 0;
    return Object.values(permissoes.sub_frotas).filter(Boolean).length;
  }, [permissoes.sub_frotas]);

  const activeSubFinanceiroCount = useMemo(() => {
    if (!permissoes.sub_financeiro) return 0;
    return Object.values(permissoes.sub_financeiro).filter(Boolean).length;
  }, [permissoes.sub_financeiro]);

  const activeSubNotasCount = useMemo(() => {
    if (!permissoes.sub_notas) return 0;
    return Object.values(permissoes.sub_notas).filter(Boolean).length;
  }, [permissoes.sub_notas]);

  const activeSubRhCount = useMemo(() => {
    if (!permissoes.sub_rh) return 0;
    return Object.values(permissoes.sub_rh).filter(Boolean).length;
  }, [permissoes.sub_rh]);

  const activeSubRelatoriosCount = useMemo(() => {
    if (!permissoes.sub_relatorios) return 0;
    return Object.values(permissoes.sub_relatorios).filter(Boolean).length;
  }, [permissoes.sub_relatorios]);

  const activeSubClientesCount = useMemo(() => {
    if (!permissoes.sub_clientes) return 0;
    return Object.values(permissoes.sub_clientes).filter(Boolean).length;
  }, [permissoes.sub_clientes]);

  const activeSubFornecedoresCount = useMemo(() => {
    if (!permissoes.sub_fornecedores) return 0;
    return Object.values(permissoes.sub_fornecedores).filter(Boolean).length;
  }, [permissoes.sub_fornecedores]);

  const activeSubCadastrosCount = useMemo(() => {
    if (!permissoes.sub_cadastros) return 0;
    return Object.values(permissoes.sub_cadastros).filter(Boolean).length;
  }, [permissoes.sub_cadastros]);

  const activeSubEmpresaCount = useMemo(() => {
    if (!permissoes.sub_empresa) return 0;
    return Object.values(permissoes.sub_empresa).filter(Boolean).length;
  }, [permissoes.sub_empresa]);

  // Estilo de badge do setor
  const getSectorBadgeStyle = (setorName?: string) => {
    const s = (setorName || '').toUpperCase();
    if (s.includes('DIRETORIA') || s.includes('ADMINISTRATIVO')) {
      return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    }
    if (s.includes('FINANCEIRO') || s.includes('CONTABILIDADE')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
    if (s.includes('TRANSPORTE') || s.includes('LOGÍSTICA')) {
      return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    }
    if (s.includes('CAMPO') || s.includes('SILAGEM')) {
      return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    }
    if (s.includes('OFICINA') || s.includes('MANUTENÇÃO')) {
      return 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800';
    }
    if (s.includes('RECURSOS') || s.includes('HUMANOS') || s.includes('RH')) {
      return 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
    }
    return 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700';
  };

  return (
    <div className="space-y-3 pb-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TELA INICIAL LIMPA: CABEÇALHO COM AÇÕES E BUSCA      */}
      {/* ======================================================== */}
      <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                  Cargos, Setores & Permissões de Acesso
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                  MATRIZ DE CONTROLE
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-stone-400">
                Gerenciamento de níveis de acesso por função com persistência local em <code>{CADASTROS_STORAGE_KEYS.CARGOS_PERMISSOES}</code>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Restaurar matriz padrão inicial de cargos"
              className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-stone-800 border border-zinc-300 dark:border-stone-700 transition cursor-pointer text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restaurar Padrão</span>
            </button>

            {/* BOTÃO + NOVO CARGO: ABRE O PAINEL DE 3 COLUNAS EM MODO EXPANDIDO */}
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Cargo</span>
            </button>
          </div>
        </div>

        {/* Barra de Busca e Filtros */}
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome do cargo, setor ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-7 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <div className="text-xs font-bold text-zinc-500 dark:text-stone-400">
              Total: <span className="text-zinc-900 dark:text-white font-extrabold">{filteredCargos.length}</span> cargo(s)
            </div>

            {/* Alternador de Visualização: Tabela (Padrão) ou Grade de Cards */}
            <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-lg">
              <button
                type="button"
                id="btn-cargos-view-list"
                onClick={() => {
                  setViewMode('list');
                  try { localStorage.setItem('silagem_cargos_view_mode', 'list'); } catch {}
                }}
                title="Visualização em Tabela Horizontal (Recomendado)"
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-stone-900 text-indigo-600 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id="btn-cargos-view-grid"
                onClick={() => {
                  setViewMode('grid');
                  try { localStorage.setItem('silagem_cargos_view_mode', 'grid'); } catch {}
                }}
                title="Visualização em Grade de Cards"
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-stone-900 text-indigo-600 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-stone-400 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TELA INICIAL: TABELA GERAL LIMPA E AMPLA (PRINT 2)    */}
      {/* ======================================================== */}
      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-290px)] overflow-y-auto scrollbar-none">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-stone-800 shadow-2xs">
                <tr className="border-b border-zinc-200 dark:border-stone-700 text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-stone-400">
                  <th className="py-2 px-4 whitespace-nowrap">Cargo / Função</th>
                  <th className="py-2 px-4 whitespace-nowrap">Setor / Área</th>
                  <th className="py-2 px-4 w-full">Módulos Liberados</th>
                  <th className="py-2 px-4 whitespace-nowrap">Status de Uso</th>
                  <th className="py-2 px-4 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-stone-800 text-xs">
                {filteredCargos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500 dark:text-stone-400">
                      Nenhum cargo encontrado para a busca "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  filteredCargos.map((cargo) => {
                    const empCount = employeeCountByCargo[cargo.id] || 0;

                    return (
                      <tr 
                        key={cargo.id} 
                        className="hover:bg-zinc-50/80 dark:hover:bg-stone-800/50 transition-colors group"
                      >
                        {/* 1. Coluna Cargo / Função (Exibindo estritamente apenas o Nome Principal em destaque) */}
                        <td className="py-1.5 px-4 whitespace-nowrap">
                          <div className="font-extrabold text-zinc-900 dark:text-white text-xs sm:text-sm">
                            {cargo.nome}
                          </div>
                        </td>

                        {/* 2. Coluna Setor / Área */}
                        <td className="py-1.5 px-4 whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border uppercase tracking-wider ${getSectorBadgeStyle(cargo.setor)}`}>
                            {cargo.setor || 'GERAL'}
                          </span>
                        </td>

                        {/* 3. Coluna Módulos Liberados (Alinhados horizontalmente em linha única flexível) */}
                        <td className="py-1.5 px-4">
                          <div className="flex flex-row items-center justify-start gap-1.5 flex-wrap">
                            {/* Serviços */}
                            {cargo.permissoes?.servicos ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Serviços</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65 whitespace-nowrap shrink-0">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Serviços</span>
                              </span>
                            )}

                            {/* Frotas */}
                            {cargo.permissoes?.frotas ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Frotas</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65 whitespace-nowrap shrink-0">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Frotas</span>
                              </span>
                            )}

                            {/* Financeiro */}
                            {cargo.permissoes?.financeiro ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Financeiro</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65 whitespace-nowrap shrink-0">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Financeiro</span>
                              </span>
                            )}

                            {/* RH */}
                            {cargo.permissoes?.rh ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>RH</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65 whitespace-nowrap shrink-0">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>RH</span>
                              </span>
                            )}

                            {/* Estoque */}
                            {cargo.permissoes?.estoque ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Estoque</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65 whitespace-nowrap shrink-0">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Estoque</span>
                              </span>
                            )}

                            {/* Minha Empresa */}
                            {cargo.permissoes?.empresa ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>Empresa</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-stone-800 dark:text-stone-400 opacity-65 whitespace-nowrap shrink-0">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Empresa</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Coluna Status de Uso (Botão Reativo com Modal Slim - Print 1) */}
                        <td className="py-1.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedCargoForEmployees(cargo)}
                            className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 transition cursor-pointer"
                            title={`Clique para listar os colaboradores vinculados ao cargo "${cargo.nome}"`}
                          >
                            <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>
                              <strong>{empCount}</strong> {empCount === 1 ? 'colaborador' : 'colaboradores'}
                            </span>
                            <Eye className="w-3 h-3 text-blue-400 ml-0.5 opacity-70" />
                          </button>
                        </td>

                        {/* 5. Coluna Ações (Editar com Lápis aciona o Modal Expandido de 3 Colunas) */}
                        <td className="py-1.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* BOTÃO EDITAR: ABRE O PAINEL DE 3 COLUNAS */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(cargo)}
                              className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition cursor-pointer flex items-center space-x-1 font-bold text-xs"
                              title={`Editar cargo "${cargo.nome}"`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCargo(cargo.id)}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition cursor-pointer"
                              title={`Excluir cargo "${cargo.nome}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visualização Alternativa em Grade de Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredCargos.map((cargo) => {
            const empCount = employeeCountByCargo[cargo.id] || 0;

            return (
              <div
                key={cargo.id}
                className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-xl p-3.5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                        {cargo.nome}
                      </h4>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border uppercase mt-1 ${getSectorBadgeStyle(cargo.setor)}`}>
                        {cargo.setor || 'GERAL'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cargo)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCargo(cargo.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {cargo.descricao && (
                    <p className="text-[11px] text-zinc-500 dark:text-stone-400 mt-2 line-clamp-2">
                      {cargo.descricao}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-stone-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedCargoForEmployees(cargo)}
                    className="flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span><strong>{empCount}</strong> colaborador(es)</span>
                  </button>

                  <span className="text-[10px] text-zinc-400">
                    ID: {cargo.id.slice(0, 10)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL EXPANDIDO DE TELA CHEIA (3 COLUNAS) PARA EDIÇÃO/NOVO CARGO       */}
      {/*    (ACIONADO APENAS AO CLICAR EM '+ NOVO CARGO' OU 'EDITAR')              */}
      {/* ========================================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150 overflow-hidden">
          <div className="bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl w-[95vw] max-w-[95%] h-[92vh] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header Amplo do Modal de 3 Colunas */}
            <div className="px-4 sm:px-5 py-3.5 bg-zinc-50 dark:bg-stone-850 border-b border-zinc-200 dark:border-stone-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3 min-w-0 pr-3">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
                  <Shield className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white truncate">
                      {isCreatingNew ? 'Cadastrar Novo Cargo' : `Editar Cargo: ${nome || selectedCargo?.nome}`}
                    </h3>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                      isCreatingNew ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300' : 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-300'
                    }`}>
                      {isCreatingNew ? 'Novo Cadastro' : 'Edição Dinâmica'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-stone-400 truncate">
                    Painel integrado de 3 seções: seleção rápida A-Z, dados e chaves centrais, e refinamento granular de telas.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    isCreatingNew 
                      ? 'bg-amber-600 text-white border-amber-600' 
                      : 'bg-white dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border-zinc-300 dark:border-stone-700 hover:bg-zinc-100'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo</span>
                </button>

                {/* Botão Fechar/Sair */}
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-stone-800 transition cursor-pointer"
                  title="Sair e retornar para a Tabela Geral"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CORPO DO MODAL: AS 3 COLUNAS PARALELAS */}
            <div className="flex-1 overflow-y-hidden overflow-x-hidden p-3 sm:p-4 bg-zinc-100/60 dark:bg-stone-950/40 min-h-0">
              <div className="flex flex-col lg:flex-row gap-3.5 items-stretch h-full min-h-0 w-full">
                
                {/* ======================================================== */}
                {/* COLUNA 1 (EXTREMIDADE ESQUERDA - LISTAGEM FIXA A-Z)      */}
                {/* ======================================================== */}
                <div className="w-full lg:w-[310px] xl:w-[320px] shrink-0 flex flex-col bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden h-full min-h-0">
                  <div className="p-3 bg-zinc-50 dark:bg-stone-800/60 border-b border-zinc-200 dark:border-stone-800 space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                          1. Lista de Cargos
                        </h4>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-stone-700 text-zinc-800 dark:text-stone-200">
                        {editorFilteredCargos.length} A-Z
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Filtrar cargos..."
                        value={editorSearchTerm}
                        onChange={(e) => setEditorSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />
                      {editorSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setEditorSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-stone-800 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {editorFilteredCargos.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-500">
                        Nenhum cargo encontrado.
                      </div>
                    ) : (
                      editorFilteredCargos.map((cargo) => {
                        const isSelected = !isCreatingNew && selectedCargoId === cargo.id;
                        const empCount = employeeCountByCargo[cargo.id] || 0;

                        return (
                          <div
                            key={cargo.id}
                            onClick={() => handleSelectCargo(cargo)}
                            className={`p-2.5 transition-all duration-150 cursor-pointer border-l-4 text-left select-none relative group ${
                              isSelected
                                ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-white shadow-2xs font-semibold'
                                : 'border-transparent hover:bg-zinc-50 dark:hover:bg-stone-800/50 text-zinc-800 dark:text-stone-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5">
                                  <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-900 dark:text-white'}`}>
                                    {cargo.nome}
                                  </span>
                                  {isSelected && (
                                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-500 dark:text-stone-400 uppercase tracking-tight truncate mt-0.5">
                                  {cargo.setor || 'Geral'}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCargoForEmployees(cargo);
                                }}
                                className="shrink-0 flex items-center space-x-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline px-1.5 py-0.5 rounded bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 transition cursor-pointer"
                                title={`Colaboradores vinculados`}
                              >
                                <Users className="w-3 h-3 text-blue-500 shrink-0" />
                                <span>{empCount}</span>
                              </button>
                            </div>

                            <div className="mt-1.5 flex items-center space-x-1">
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.servicos ? 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-300' : 'bg-zinc-100 text-zinc-400'}`}>S</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.frotas ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300' : 'bg-zinc-100 text-zinc-400'}`}>F</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.financeiro ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-400'}`}>$</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.rh ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300' : 'bg-zinc-100 text-zinc-400'}`}>RH</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.estoque ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' : 'bg-zinc-100 text-zinc-400'}`}>Est</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${cargo.permissoes?.empresa ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300' : 'bg-zinc-100 text-zinc-400'}`}>Emp</span>
                              <div className="flex-1" />
                              <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600' : 'text-zinc-300 dark:text-stone-600'}`} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ======================================================== */}
                {/* COLUNA 2 (CENTRAL - PAINEL DE IDENTIFICAÇÃO E CHAVES)    */}
                {/* ======================================================== */}
                <div className="w-full lg:w-[480px] xl:w-[500px] shrink-0 flex flex-col bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl shadow-xs p-3.5 sm:p-4 h-full min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-stone-800 shrink-0">
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white truncate">
                          2. Identificação & Chaves Principais
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-stone-400 truncate">
                          {isCreatingNew ? 'Cadastrando um novo cargo' : `Editando: ${selectedCargo?.nome || 'Cargo selecionado'}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center space-x-2 text-xs font-bold text-rose-700 dark:text-rose-300 shrink-0">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Formulário com Autocomplete e Chaves Principais */}
                  <form onSubmit={handleSaveCargo} className="flex-1 flex flex-col min-h-0 justify-between">
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 space-y-3.5">
                      {/* Campo 1: Nome do Cargo (Textbox Inteligente / Combobox com Busca) */}
                    <div className="relative" ref={comboboxRef}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-zinc-700 dark:text-stone-300 flex items-center gap-1">
                          <span>Nome do Cargo</span>
                          <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[10px] text-zinc-400">Sugestões inteligentes ativas</span>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Ex: Motorista de Caminhão, Mecânico, etc."
                          value={nome}
                          onFocus={() => setIsComboboxOpen(true)}
                          onChange={(e) => {
                            setNome(e.target.value);
                            setIsComboboxOpen(true);
                          }}
                          className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        />

                        {nome && (
                          <button
                            type="button"
                            onClick={() => {
                              setNome('');
                              setIsComboboxOpen(true);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-stone-200 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown de Sugestões de Nomes de Cargos */}
                      {isComboboxOpen && existingCargoSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-stone-800 border border-zinc-200 dark:border-stone-700 rounded-xl shadow-xl divide-y divide-zinc-100 dark:divide-stone-700 animate-in fade-in zoom-in-95 duration-100">
                          <div className="p-1.5 bg-zinc-50 dark:bg-stone-800 text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Cargos já cadastrados:</span>
                            <button 
                              type="button" 
                              onClick={() => setIsComboboxOpen(false)}
                              className="text-zinc-400 hover:text-zinc-700"
                            >
                              ✕
                            </button>
                          </div>
                          {existingCargoSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setNome(suggestion);
                                setIsComboboxOpen(false);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-zinc-800 dark:text-stone-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 transition flex items-center justify-between cursor-pointer"
                            >
                              <span>{suggestion}</span>
                              <Sparkles className="w-3 h-3 text-indigo-400 opacity-60" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Campo 2: Setor / Departamento (Textbox Interativo + Grade de Tags Clicáveis '+') */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-zinc-700 dark:text-stone-300 flex items-center gap-1">
                          <span>Setor / Departamento</span>
                          <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[10px] text-zinc-400">Clique nas tags abaixo para preencher</span>
                      </div>

                      <input
                        type="text"
                        required
                        placeholder="Ex: Transporte, Campo, Financeiro, Oficina..."
                        value={setor}
                        onChange={(e) => setSetor(e.target.value)}
                        className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />

                      {/* GRADE DE SETORES COM SELEÇÃO DE TAGS CLICÁVEIS */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {SETORES_DISPONIVEIS.map((s) => {
                          const isSelected = setor.trim().toUpperCase() === s.toUpperCase();
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSetor(s)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all duration-150 cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-800 scale-102'
                                  : 'bg-zinc-100 dark:bg-stone-800 text-zinc-700 dark:text-stone-300 border-zinc-200 dark:border-stone-700 hover:bg-zinc-200 dark:hover:bg-stone-700 hover:border-zinc-400'
                              }`}
                              title={`Selecionar setor ${s}`}
                            >
                              <span>{isSelected ? '✓' : '+'}</span>
                              <span>{s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Campo 3: Descrição Básica do Cargo */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                        Descrição básica do Cargo
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Resumo das atribuições, responsabilidades e escopo..."
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="w-full px-3 py-1.5 bg-zinc-50 dark:bg-stone-800/80 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs resize-none"
                      />
                    </div>

                    {/* Chaves Centrais Liga/Desliga */}
                    <div className="pt-2 border-t border-zinc-200 dark:border-stone-800 space-y-2">
                      <div className="flex items-center justify-between pb-1">
                        <div className="flex items-center space-x-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                            Chaves de Acesso Principais
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-semibold">
                          Toggles Ativos
                        </span>
                      </div>

                      {/* 1. Módulo Serviços */}
                      <label 
                        htmlFor="modal-toggle-servicos"
                        onClick={() => setActiveModuleFocus('servicos')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.servicos
                            ? 'bg-teal-50/90 dark:bg-teal-950/40 border-teal-400 dark:border-teal-600 shadow-xs ring-1 ring-teal-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.servicos ? 'bg-teal-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Tractor className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Serviços</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.servicos ? 'bg-teal-200 text-teal-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.servicos ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Agenda, Corte, Colheita, Trator, Máquinas e Orçamento
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-servicos"
                            checked={Boolean(permissoes.servicos)}
                            onChange={(e) => atualizarPermissao('servicos', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.servicos ? 'bg-teal-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.servicos ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 2. Módulo Frotas & Veículos */}
                      <label 
                        htmlFor="modal-toggle-frotas"
                        onClick={() => setActiveModuleFocus('frotas')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.frotas
                            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs ring-1 ring-blue-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.frotas ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso a Frotas & Veículos</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.frotas ? 'bg-blue-200 text-blue-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.frotas ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Veículos, Manutenções, Abastecimento, Pneus
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-frotas"
                            checked={Boolean(permissoes.frotas)}
                            onChange={(e) => atualizarPermissao('frotas', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.frotas ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.frotas ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 3. Módulo Financeiro */}
                      <label 
                        htmlFor="modal-toggle-financeiro"
                        onClick={() => setActiveModuleFocus('financeiro')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.financeiro
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-xs ring-1 ring-emerald-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.financeiro ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <DollarSign className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Financeiro</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.financeiro ? 'bg-emerald-200 text-emerald-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.financeiro ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Bancos, Saldos, DRE, Contas a Pagar e Receber
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-financeiro"
                            checked={Boolean(permissoes.financeiro)}
                            onChange={(e) => atualizarPermissao('financeiro', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.financeiro ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.financeiro ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 4. Módulo Notas e Entradas */}
                      <label 
                        htmlFor="modal-toggle-notas"
                        onClick={() => setActiveModuleFocus('notas')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.notas || permissoes.estoque
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-xs ring-1 ring-indigo-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.notas || permissoes.estoque ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Receipt className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Notas e Entradas</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.notas || permissoes.estoque ? 'bg-indigo-200 text-indigo-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.notas || permissoes.estoque ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Histórico, Importação XML, Entradas Manuais e Ações
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-notas"
                            checked={Boolean(permissoes.notas || permissoes.estoque)}
                            onChange={(e) => atualizarPermissao('notas', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.notas || permissoes.estoque ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.notas || permissoes.estoque ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 5. Recursos Humanos - RH */}
                      <label 
                        htmlFor="modal-toggle-rh"
                        onClick={() => setActiveModuleFocus('rh')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.rh
                            ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600 shadow-xs ring-1 ring-purple-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.rh ? 'bg-purple-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <HeartHandshake className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso a Recursos Humanos</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.rh ? 'bg-purple-200 text-purple-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.rh ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Dashboard, Funcionários, Folha, Férias, Afastamentos, Rescisão
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-rh"
                            checked={Boolean(permissoes.rh)}
                            onChange={(e) => atualizarPermissao('rh', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.rh ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.rh ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 6. Módulo Relatórios */}
                      <label 
                        htmlFor="modal-toggle-relatorios"
                        onClick={() => setActiveModuleFocus('relatorios')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.relatorios
                            ? 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 shadow-xs ring-1 ring-sky-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.relatorios ? 'bg-sky-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Relatórios</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.relatorios ? 'bg-sky-200 text-sky-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.relatorios ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Dashboards, Resumo Geral, Ativo Imobilizado e Cortes
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-relatorios"
                            checked={Boolean(permissoes.relatorios)}
                            onChange={(e) => atualizarPermissao('relatorios', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.relatorios ? 'bg-sky-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.relatorios ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 7. Módulo Clientes */}
                      <label 
                        htmlFor="modal-toggle-clientes"
                        onClick={() => setActiveModuleFocus('clientes')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.clientes
                            ? 'bg-cyan-50/90 dark:bg-cyan-950/40 border-cyan-400 dark:border-cyan-600 shadow-xs ring-1 ring-cyan-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.clientes ? 'bg-cyan-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Users className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Clientes</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.clientes ? 'bg-cyan-200 text-cyan-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.clientes ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Lista de Clientes, Funil Kanban e Novos Cadastros
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-clientes"
                            checked={Boolean(permissoes.clientes)}
                            onChange={(e) => atualizarPermissao('clientes', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.clientes ? 'bg-cyan-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.clientes ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 8. Módulo Fornecedores */}
                      <label 
                        htmlFor="modal-toggle-fornecedores"
                        onClick={() => setActiveModuleFocus('fornecedores')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.fornecedores
                            ? 'bg-orange-50/90 dark:bg-orange-950/40 border-orange-400 dark:border-orange-600 shadow-xs ring-1 ring-orange-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.fornecedores ? 'bg-orange-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Fornecedores</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.fornecedores ? 'bg-orange-200 text-orange-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.fornecedores ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Lista de Fornecedores, Cadastros e Edições
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-fornecedores"
                            checked={Boolean(permissoes.fornecedores)}
                            onChange={(e) => atualizarPermissao('fornecedores', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.fornecedores ? 'bg-orange-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.fornecedores ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 9. Módulo Cadastros Base */}
                      <label 
                        htmlFor="modal-toggle-cadastros"
                        onClick={() => setActiveModuleFocus('cadastros')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.cadastros_base
                            ? 'bg-violet-50/90 dark:bg-violet-950/40 border-violet-400 dark:border-violet-600 shadow-xs ring-1 ring-violet-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.cadastros_base ? 'bg-violet-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Database className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso ao Módulo Cadastros Base</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.cadastros_base ? 'bg-violet-200 text-violet-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.cadastros_base ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Centros de Custo, Plano de Contas e Cargos
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-cadastros"
                            checked={Boolean(permissoes.cadastros_base)}
                            onChange={(e) => atualizarPermissao('cadastros_base', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.cadastros_base ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.cadastros_base ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>

                      {/* 10. Dados da Empresa */}
                      <label 
                        htmlFor="modal-toggle-empresa"
                        onClick={() => setActiveModuleFocus('empresa')}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          permissoes.empresa
                            ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 shadow-xs ring-1 ring-rose-400/30'
                            : 'bg-zinc-50 dark:bg-stone-850 border-zinc-200 dark:border-stone-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 pr-2 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${permissoes.empresa ? 'bg-rose-600 text-white' : 'bg-zinc-200 dark:bg-stone-800 text-zinc-500'}`}>
                            <Building className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <span className="truncate">Acesso a Dados da Empresa</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                permissoes.empresa ? 'bg-rose-200 text-rose-900' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                                {permissoes.empresa ? 'Liberado' : 'Bloqueado'}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-stone-400 leading-tight truncate">
                              Identificação, Localização, Contatos, PIX e Sócios
                            </div>
                          </div>
                        </div>

                        <div className="relative inline-flex items-center shrink-0">
                          <input
                            type="checkbox"
                            id="modal-toggle-empresa"
                            checked={Boolean(permissoes.empresa)}
                            onChange={(e) => atualizarPermissao('empresa', e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ${permissoes.empresa ? 'bg-rose-600' : 'bg-zinc-300 dark:bg-stone-700'}`}>
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${permissoes.empresa ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </div>
                      </label>
                    </div>

                    </div>

                    {/* Botões de Ação na Base da Coluna 2 */}
                    <div className="pt-3 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-between gap-2 shrink-0">
                      <div>
                        {!isCreatingNew && selectedCargoId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCargo(selectedCargoId)}
                            className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition cursor-pointer text-xs font-bold flex items-center gap-1.5"
                            title="Excluir este cargo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleCloseEditor}
                          className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-stone-700 text-zinc-700 dark:text-stone-300 hover:bg-zinc-100 dark:hover:bg-stone-800 font-bold text-xs transition cursor-pointer"
                        >
                          Sair
                        </button>

                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer active:scale-95 flex items-center space-x-1.5"
                        >
                          <Save className="w-4 h-4" />
                          <span>{isCreatingNew ? 'Cadastrar Cargo' : 'Salvar Alterações'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* ======================================================== */}
                {/* COLUNA 3 (EXTREMIDADE DIREITA - SUB-PERMISSÕES POR TELA)  */}
                {/* ======================================================== */}
                <div className="w-full flex-1 min-w-0 flex flex-col bg-white dark:bg-stone-900 border border-zinc-200 dark:border-stone-800 rounded-2xl shadow-xs p-3.5 sm:p-4 space-y-3.5 h-full min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-stone-800 shrink-0">
                    <div className="flex items-center space-x-2 min-w-0 pr-2">
                      <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shrink-0">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white truncate">
                          3. Sub-permissões por Tela
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-stone-400 truncate">
                          Controle granular por tela e funcionalidade
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 dark:bg-teal-950/80 dark:text-teal-300 uppercase shrink-0">
                      Granular
                    </span>
                  </div>

                  <CargoSubPermissionsEditor
                    permissoes={permissoes}
                    activeModuleFocus={activeModuleFocus}
                    onSelectModuleFocus={setActiveModuleFocus}
                    onToggleSubPermissao={toggleSubPermissao}
                    onSetAllSubPermissions={setAllSubPermissionsForModule}
                    onActivateModulo={(mod) => atualizarPermissao(mod, true)}
                  />
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL SLIM: COLABORADORES VINCULADOS AO CARGO (PRINT 1) */}
      <CargoEmployeesModal
        isOpen={Boolean(selectedCargoForEmployees)}
        onClose={() => setSelectedCargoForEmployees(null)}
        cargo={selectedCargoForEmployees}
        employees={employees}
      />
    </div>
  );
};
