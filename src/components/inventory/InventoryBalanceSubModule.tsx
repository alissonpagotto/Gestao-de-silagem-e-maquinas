import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  EyeOff,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Lock,
  Trash2,
  Check,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  User,
  MapPin,
  FileCheck2,
  X,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import {
  Employee,
  InventoryItem,
  InventoryBalanceSession,
  InventoryBalanceItem,
  InventoryBalanceScopeType,
  StockEntryMovement,
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getActiveCompanyId,
  getStoredCompanyProfile,
  getStoredEmployees,
  getStoredInventory,
  getStoredInventoryBalances,
  saveStoredInventoryBalances,
  saveStoredInventory,
  saveCompanyEstoque,
  recordStockEntryMovements,
} from '../../lib/storage';
import { getActiveUserSession } from '../../lib/cadastrosBaseStorage';
import { generatePrintableHtml, executePrint } from '../../lib/printService';
import { isSupabaseConfigured, upsertEstoqueItem } from '../../lib/supabaseService';
import { useConfirm } from '../../context/ConfirmContext';

interface InventoryBalanceSubModuleProps {
  allItems: InventoryItem[];
  onSaveInventory: (updated: InventoryItem[]) => void;
}

type CountFilterMode = 'todos' | 'nao_contados' | 'conferidos' | 'divergencia';

function roundQty(val: number): number {
  return Math.round((val + Number.EPSILON) * 1000) / 1000;
}

function formatQtyBR(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function escapeHtml(raw?: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimeHHMMSS(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function formatDateTimeBR(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return `${formatDateBR(iso.split('T')[0])} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '—';
  }
}

function getScopeLabel(scopeType: InventoryBalanceScopeType, scopeValue?: string): string {
  if (scopeType === 'categoria') return `Categoria: ${scopeValue || 'Todas'}`;
  if (scopeType === 'local') return `Local: ${scopeValue || 'Todos'}`;
  return 'Estoque Completo';
}

function computeSessionMetrics(items: InventoryBalanceItem[]) {
  const totalItems = items.length;
  let countedItems = 0;
  let okItems = 0;
  let adjustedItems = 0;
  let surplusCount = 0;
  let surplusValue = 0;
  let shortageCount = 0;
  let shortageValue = 0;

  for (const it of items) {
    if (it.countedQty === null || it.countedQty === undefined || Number.isNaN(it.countedQty)) {
      continue;
    }
    countedItems++;
    const diff = roundQty(it.countedQty - it.systemQty);
    const impact = Math.round(diff * (Number(it.unitCost) || 0) * 100) / 100;
    if (Math.abs(diff) < 0.0001) {
      okItems++;
    } else if (diff > 0) {
      adjustedItems++;
      surplusCount++;
      surplusValue = Math.round((surplusValue + impact) * 100) / 100;
    } else {
      adjustedItems++;
      shortageCount++;
      shortageValue = Math.round((shortageValue + Math.abs(impact)) * 100) / 100;
    }
  }

  const progressPercent = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;
  const netFinancialImpact = Math.round((surplusValue - shortageValue) * 100) / 100;

  return {
    totalItems,
    countedItems,
    uncountedItems: totalItems - countedItems,
    okItems,
    adjustedItems,
    surplusCount,
    surplusValue,
    shortageCount,
    shortageValue,
    netFinancialImpact,
    progressPercent,
  };
}

export const InventoryBalanceSubModule: React.FC<InventoryBalanceSubModuleProps> = ({
  allItems,
  onSaveInventory,
}) => {
  const { confirm } = useConfirm();

  const [sessions, setSessions] = useState<InventoryBalanceSession[]>(() =>
    getStoredInventoryBalances()
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const initial = getStoredInventoryBalances();
    const openSession = initial.find((s) => s.status === 'EM_ANDAMENTO');
    return openSession ? openSession.id : null;
  });

  // Modal de criação de nova sessão
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const defaultMonthYear = useMemo(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${mm}/${yyyy}`;
  }, []);

  const [newTitle, setNewTitle] = useState(`Inventário Geral ${defaultMonthYear}`);
  const [newScopeType, setNewScopeType] = useState<InventoryBalanceScopeType>('completo');
  const [newScopeValue, setNewScopeValue] = useState('');
  const [newResponsible, setNewResponsible] = useState('');
  const [responsibleQuery, setResponsibleQuery] = useState('');
  const [isResponsibleDropdownOpen, setIsResponsibleDropdownOpen] = useState(false);
  const responsibleDropdownRef = useRef<HTMLDivElement | null>(null);
  const [rhEmployees, setRhEmployees] = useState<Employee[]>(() => getStoredEmployees());
  const [newNotes, setNewNotes] = useState('');
  const [excludeServices, setExcludeServices] = useState(true);
  const [formError, setFormError] = useState('');

  // Controles do workspace de contagem
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<CountFilterMode>('todos');
  const [blindMode, setBlindMode] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);

  // Sincronização entre abas / storage
  useEffect(() => {
    const syncSessions = () => {
      setSessions(getStoredInventoryBalances());
    };
    const syncEmployees = () => {
      setRhEmployees(getStoredEmployees());
    };
    window.addEventListener('agrocontrol_inventory_balances_updated', syncSessions);
    window.addEventListener('agrocontrol_funcionarios_updated', syncEmployees);
    window.addEventListener('employees_updated', syncEmployees);
    window.addEventListener('storage', syncSessions);
    window.addEventListener('storage', syncEmployees);
    return () => {
      window.removeEventListener('agrocontrol_inventory_balances_updated', syncSessions);
      window.removeEventListener('agrocontrol_funcionarios_updated', syncEmployees);
      window.removeEventListener('employees_updated', syncEmployees);
      window.removeEventListener('storage', syncSessions);
      window.removeEventListener('storage', syncEmployees);
    };
  }, []);

  // Fechar dropdown de funcionários ao clicar fora
  useEffect(() => {
    if (!isResponsibleDropdownOpen) return;
    const handleClickOutside = (ev: MouseEvent) => {
      if (
        responsibleDropdownRef.current &&
        !responsibleDropdownRef.current.contains(ev.target as Node)
      ) {
        setIsResponsibleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isResponsibleDropdownOpen]);

  const activeRhEmployees = useMemo(() => {
    return rhEmployees
      .filter((emp) => {
        if (!emp || !emp.name || !emp.name.trim()) return false;
        if (emp.active === false) return false;
        const st = String(emp.status || 'ativo').toLowerCase().trim();
        return (
          st !== 'inativo' &&
          st !== 'inativo_sazonal' &&
          st !== 'demitido' &&
          st !== 'desligado' &&
          st !== 'excluido'
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [rhEmployees]);

  const filteredRhEmployees = useMemo(() => {
    const q = responsibleQuery.trim().toLowerCase();
    if (!q) return activeRhEmployees;
    return activeRhEmployees.filter((emp) => {
      const name = String(emp.name || '').toLowerCase();
      const role = String(emp.role || '').toLowerCase();
      const badge = String(emp.badgeRegistrationNumber || emp.numero_registro || '').toLowerCase();
      const cpf = String(emp.cpf || '').toLowerCase();
      return name.includes(q) || role.includes(q) || badge.includes(q) || cpf.includes(q);
    });
  }, [activeRhEmployees, responsibleQuery]);

  const persistSessionsSync = useCallback(
    (nextSessions: InventoryBalanceSession[], allowEmpty = false) => {
      saveStoredInventoryBalances(nextSessions, allowEmpty);
      setSessions(nextSessions);
    },
    []
  );

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  // Categorias e Locais disponíveis no Estoque
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      const cat = String(item.categoria || item.category || '').trim();
      if (cat && cat.toUpperCase() !== 'SERVIÇO') set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allItems]);

  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      const loc = String(item.location || item.localizacao_fisica || 'Barracão Principal').trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allItems]);

  // Pré-visualização de itens elegíveis ao criar nova sessão
  const previewMatchedItems = useMemo(() => {
    return allItems.filter((item) => {
      if (excludeServices) {
        const tipo = String(item.tipo_item || '').toUpperCase();
        const cat = String(item.categoria || item.category || '').toUpperCase();
        if (tipo === 'SERVIÇO' || tipo === 'SERVICO' || cat === 'SERVIÇO' || cat === 'SERVICO') {
          return false;
        }
      }
      if (newScopeType === 'categoria' && newScopeValue) {
        const cat = String(item.categoria || item.category || '').trim().toLowerCase();
        return cat === newScopeValue.trim().toLowerCase();
      }
      if (newScopeType === 'local' && newScopeValue) {
        const loc = String(item.location || item.localizacao_fisica || 'Barracão Principal')
          .trim()
          .toLowerCase();
        return loc === newScopeValue.trim().toLowerCase();
      }
      return true;
    });
  }, [allItems, excludeServices, newScopeType, newScopeValue]);

  const handleOpenNewModal = () => {
    setFormError('');
    setRhEmployees(getStoredEmployees());
    setNewTitle(`Inventário Geral ${defaultMonthYear}`);
    setNewScopeType('completo');
    setNewScopeValue('');
    setNewResponsible('');
    setResponsibleQuery('');
    setIsResponsibleDropdownOpen(false);
    setNewNotes('');
    setExcludeServices(true);
    setIsNewModalOpen(true);
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const titleClean = newTitle.trim();
    const matchedEmployee = activeRhEmployees.find(
      (emp) => emp.name.trim().toLowerCase() === (newResponsible || responsibleQuery).trim().toLowerCase()
    );
    const responsibleClean = matchedEmployee ? matchedEmployee.name.trim() : '';
    if (!titleClean) {
      setFormError('Informe um título ou identificação para o balanço.');
      return;
    }
    if (!responsibleClean) {
      setFormError('Selecione um funcionário ativo do RH responsável pela contagem.');
      setIsResponsibleDropdownOpen(true);
      return;
    }
    if ((newScopeType === 'categoria' || newScopeType === 'local') && !newScopeValue) {
      setFormError(
        newScopeType === 'categoria'
          ? 'Selecione a categoria desejada para o escopo.'
          : 'Selecione o local de armazenagem desejado.'
      );
      return;
    }
    if (previewMatchedItems.length === 0) {
      setFormError('Nenhum produto encontrado no estoque para o escopo selecionado.');
      return;
    }

    const nextSeq = sessions.length + 1;
    const code = `BAL-${String(nextSeq).padStart(3, '0')}`;
    const nowIso = new Date().toISOString();

    const balanceItems: InventoryBalanceItem[] = previewMatchedItems
      .map((item) => ({
        productId: item.id,
        code: String(item.code || item.codigo_produto || '').trim() || undefined,
        name: String(item.nome_comercial || item.name || item.nome || 'Produto sem nome').trim(),
        category: String(item.categoria || item.category || 'Outros Insumos').trim(),
        location: String(item.location || item.localizacao_fisica || 'Barracão Principal').trim(),
        unit: String(item.unidade_medida || item.unit || 'UN').toUpperCase(),
        unitCost: Number(item.preco_custo_inicial ?? item.unitCost ?? 0) || 0,
        systemQty: roundQty(Number(item.quantidade_atual ?? item.quantity ?? 0) || 0),
        countedQty: null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const newSession: InventoryBalanceSession = {
      id: `bal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code,
      companyId: getActiveCompanyId() || 'default',
      title: titleClean,
      scopeType: newScopeType,
      scopeValue: newScopeType === 'completo' ? undefined : newScopeValue,
      responsible: responsibleClean,
      notes: newNotes.trim() || undefined,
      status: 'EM_ANDAMENTO',
      createdAt: nowIso,
      updatedAt: nowIso,
      items: balanceItems,
    };

    const nextSessions = [newSession, ...sessions];
    persistSessionsSync(nextSessions);
    setActiveSessionId(newSession.id);
    setSearchTerm('');
    setFilterMode('todos');
    setBlindMode(false);
    setIsNewModalOpen(false);
    setFeedbackBanner({
      type: 'success',
      text: `Sessão ${code} (${titleClean}) criada com ${balanceItems.length} item(ns). Toda contagem digitada será salva automaticamente.`,
    });
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  // Atualização síncrona imediata de cada quantidade digitada (persistência contínua multi-dias)
  const handleUpdateCountedQty = useCallback(
    (productId: string, rawValue: string) => {
      if (!activeSession || activeSession.status === 'CONCLUIDO') return;
      const trimmed = rawValue.trim();
      let parsed: number | null = null;
      if (trimmed !== '') {
        const normalized = trimmed.replace(',', '.');
        const num = Number(normalized);
        if (Number.isNaN(num) || num < 0) return;
        parsed = roundQty(num);
      }

      const nowIso = new Date().toISOString();
      const nextSessions = sessions.map((sess) => {
        if (sess.id !== activeSession.id) return sess;
        return {
          ...sess,
          updatedAt: nowIso,
          items: sess.items.map((it) =>
            it.productId === productId
              ? {
                  ...it,
                  countedQty: parsed,
                  countedAt: parsed !== null ? nowIso : undefined,
                }
              : it
          ),
        };
      });

      persistSessionsSync(nextSessions);
    },
    [activeSession, sessions, persistSessionsSync]
  );

  // Botão rápido "✓ Confirmar Igual"
  const handleConfirmEqual = useCallback(
    (productId: string, systemQty: number) => {
      if (!activeSession || activeSession.status === 'CONCLUIDO') return;
      const nowIso = new Date().toISOString();
      const nextSessions = sessions.map((sess) => {
        if (sess.id !== activeSession.id) return sess;
        return {
          ...sess,
          updatedAt: nowIso,
          items: sess.items.map((it) =>
            it.productId === productId
              ? {
                  ...it,
                  countedQty: roundQty(systemQty),
                  countedAt: nowIso,
                }
              : it
          ),
        };
      });
      persistSessionsSync(nextSessions);
    },
    [activeSession, sessions, persistSessionsSync]
  );

  const handleDeleteSession = async (session: InventoryBalanceSession) => {
    if (session.status === 'CONCLUIDO') return;
    const ok = await confirm({
      title: 'Excluir Rascunho de Balanço',
      message: `Deseja excluir a sessão em andamento "${session.code} - ${session.title}"? O saldo oficial do estoque não será alterado.`,
      confirmLabel: 'Sim, Excluir Rascunho',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!ok) return;
    const nextSessions = sessions.filter((s) => s.id !== session.id);
    persistSessionsSync(nextSessions, true);
    if (activeSessionId === session.id) {
      setActiveSessionId(null);
    }
  };

  // Métricas em tempo real da sessão ativa
  const activeMetrics = useMemo(() => {
    if (!activeSession) return null;
    return computeSessionMetrics(activeSession.items);
  }, [activeSession]);

  // Itens filtrados da tabela de contagem
  const filteredBalanceItems = useMemo(() => {
    if (!activeSession) return [];
    const q = searchTerm.trim().toLowerCase();
    return activeSession.items.filter((item) => {
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = (item.code || '').toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        const matchLoc = (item.location || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat && !matchLoc) return false;
      }

      if (filterMode === 'nao_contados') {
        return item.countedQty === null;
      }
      if (filterMode === 'conferidos') {
        return item.countedQty !== null;
      }
      if (filterMode === 'divergencia') {
        return item.countedQty !== null && Math.abs(roundQty(item.countedQty - item.systemQty)) >= 0.0001;
      }
      return true;
    });
  }, [activeSession, searchTerm, filterMode]);

  // Fechamento auditado & atualização oficial do estoque
  const handleConfirmFinishBalance = () => {
    if (!activeSession || activeSession.status === 'CONCLUIDO') return;

    const metrics = computeSessionMetrics(activeSession.items);
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];
    const activeCompanyId = getActiveCompanyId() || 'default';
    let completedBy = activeSession.responsible;
    try {
      const userSess = getActiveUserSession();
      if (userSess?.name) completedBy = userSess.name;
    } catch {}

    // 1. Mescla base mais recente do estoque e aplica ajustes apenas nos itens conferidos com divergência
    const storedInv = getStoredInventory();
    const baseMap = new Map<string, InventoryItem>();
    [...storedInv, ...allItems].forEach((p) => {
      if (p && p.id) baseMap.set(p.id, p);
    });

    const movementsToRecord: StockEntryMovement[] = [];
    const changedProducts: InventoryItem[] = [];

    activeSession.items.forEach((bItem) => {
      if (bItem.countedQty === null || bItem.countedQty === undefined) return;
      const diff = roundQty(bItem.countedQty - bItem.systemQty);
      if (Math.abs(diff) < 0.0001) return;

      const existingProd = baseMap.get(bItem.productId);
      if (existingProd) {
        const updatedProd: InventoryItem = {
          ...existingProd,
          quantity: roundQty(bItem.countedQty),
          quantidade_atual: roundQty(bItem.countedQty),
        };
        baseMap.set(existingProd.id, updatedProd);
        changedProducts.push(updatedProd);
      }

      const absDiff = Math.abs(diff);
      const unitCost = Number(bItem.unitCost) || 0;
      movementsToRecord.push({
        id: `mov_bal_${activeSession.id}_${bItem.productId}`,
        companyId: activeCompanyId,
        notaId: activeSession.id,
        invoiceNumber: activeSession.code,
        supplier: `Responsável: ${activeSession.responsible}`,
        productId: bItem.productId,
        productCode: bItem.code,
        productName: bItem.name,
        quantity: absDiff,
        unit: bItem.unit || 'UN',
        unitCost,
        totalCost: Math.round(absDiff * unitCost * 100) / 100,
        date: todayDate,
        type: diff > 0 ? 'entrada' : 'saida',
        source: 'balanco',
        description: `Ajuste de Inventário - Balanço #${activeSession.code} (${activeSession.title}): Sistema ${formatQtyBR(bItem.systemQty)} → Físico ${formatQtyBR(bItem.countedQty)} (${diff > 0 ? '+' : ''}${formatQtyBR(diff)} ${bItem.unit})`,
        createdAt: nowIso,
      });
    });

    const updatedInventory = Array.from(baseMap.values());

    // 2. Gravações síncronas atômicas: Estoque + Movimentações Auditáveis + Sessão CONCLUÍDA
    if (changedProducts.length > 0) {
      saveStoredInventory(updatedInventory);
      saveCompanyEstoque(updatedInventory, activeCompanyId);
      onSaveInventory(updatedInventory);
    }

    if (movementsToRecord.length > 0) {
      recordStockEntryMovements(movementsToRecord);
    }

    const completedSession: InventoryBalanceSession = {
      ...activeSession,
      status: 'CONCLUIDO',
      updatedAt: nowIso,
      completedAt: nowIso,
      completedBy,
      summarySnapshot: {
        totalItems: metrics.totalItems,
        countedItems: metrics.countedItems,
        okItems: metrics.okItems,
        adjustedItems: metrics.adjustedItems,
        surplusCount: metrics.surplusCount,
        surplusValue: metrics.surplusValue,
        shortageCount: metrics.shortageCount,
        shortageValue: metrics.shortageValue,
        netFinancialImpact: metrics.netFinancialImpact,
      },
    };

    const nextSessions = sessions.map((s) => (s.id === activeSession.id ? completedSession : s));
    persistSessionsSync(nextSessions);

    // 3. Sincronização em nuvem (não-bloqueante)
    if (isSupabaseConfigured && changedProducts.length > 0) {
      changedProducts.forEach((prod) => {
        upsertEstoqueItem(prod).catch((err) =>
          console.warn('Aviso upsertEstoqueItem após balanço:', err)
        );
      });
    }

    setBlindMode(false);
    setIsFinishModalOpen(false);
    setFeedbackBanner({
      type: 'success',
      text: `Balanço #${activeSession.code} concluído e auditado! ${changedProducts.length} produto(s) atualizado(s) no Estoque Geral com movimentações registradas.`,
    });
  };

  // Impressão A4: Ficha de Contagem em Branco para Prancheta no Galpão
  const handlePrintCountingSheet = (session: InventoryBalanceSession) => {
    const company = getStoredCompanyProfile();
    const rowsHtml = session.items
      .map(
        (it, idx) => `
      <tr>
        <td style="text-align:center;width:32px;font-weight:700;">${idx + 1}</td>
        <td style="width:76px;font-family:monospace;font-weight:700;">${escapeHtml(it.code || '—')}</td>
        <td>
          <div style="font-weight:700;color:#0f172a;">${escapeHtml(it.name)}</div>
          <div style="font-size:7.5pt;color:#475569;">${escapeHtml(it.category || '')}</div>
        </td>
        <td style="width:120px;font-size:8pt;">${escapeHtml(it.location || 'Barracão Principal')}</td>
        <td style="text-align:center;width:46px;font-weight:700;">${escapeHtml(it.unit)}</td>
        <td style="width:115px;text-align:center;font-family:monospace;color:#64748b;font-size:9pt;">
          [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
        </td>
        <td style="width:110px;"></td>
      </tr>`
      )
      .join('');

    const contentHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;font-size:8.5pt;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;">
        <div><strong>Sessão / Código:</strong> ${escapeHtml(session.code)}</div>
        <div><strong>Escopo:</strong> ${escapeHtml(getScopeLabel(session.scopeType, session.scopeValue))}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(session.responsible)}</div>
        <div><strong>Total de Itens:</strong> ${session.items.length} produto(s)</div>
        <div><strong>Início:</strong> ${formatDateTimeBR(session.createdAt)}</div>
        <div><strong>Modo:</strong> Contagem Física (Prancheta)</div>
      </div>
      ${
        session.notes
          ? `<div style="margin-bottom:10px;font-size:8pt;color:#334155;padding:6px 8px;border-left:3px solid #0963cb;background:#f1f5f9;"><strong>Observações:</strong> ${escapeHtml(session.notes)}</div>`
          : ''
      }
      <table>
        <thead>
          <tr>
            <th style="text-align:center;">#</th>
            <th>Código</th>
            <th>Item / Produto</th>
            <th>Local</th>
            <th style="text-align:center;">Unid.</th>
            <th style="text-align:center;">Qtd. Física Contada</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    const html = generatePrintableHtml({
      title: `FICHA DE CONTAGEM FÍSICA — ${session.title}`,
      subtitle: `Balanço #${session.code} • Conferência de Estoque em Campo / Galpão`,
      documentType: 'FICHA DE INVENTÁRIO (A4)',
      company,
      contentHtml,
      orientation: 'portrait',
      showSignatures: true,
      signatureLabels: [
        `Conferente / Estoquista (${session.responsible})`,
        'Supervisor / Auditoria de Estoque',
      ],
      footerNotes:
        'Preencha a coluna "Qtd. Física Contada" à caneta durante a conferência física e transcreva para a sessão em aberto no AgroControl.',
    });

    executePrint(html);
  };

  // Impressão A4: Relatório Oficial de Inventário & Divergências (Auditado)
  const handlePrintOfficialAuditReport = (session: InventoryBalanceSession) => {
    const company = getStoredCompanyProfile();
    const metrics = session.summarySnapshot || computeSessionMetrics(session.items);

    const rowsHtml = session.items
      .map((it, idx) => {
        const isCounted = it.countedQty !== null && it.countedQty !== undefined;
        const diff = isCounted ? roundQty((it.countedQty as number) - it.systemQty) : 0;
        const impact = isCounted ? Math.round(diff * (Number(it.unitCost) || 0) * 100) / 100 : 0;
        const statusText = !isCounted
          ? 'NÃO CONTADO'
          : Math.abs(diff) < 0.0001
            ? 'OK'
            : diff > 0
              ? 'SOBRA'
              : 'FALTA';
        const diffColor = !isCounted
          ? '#64748b'
          : Math.abs(diff) < 0.0001
            ? '#0f172a'
            : diff > 0
              ? '#047857'
              : '#be123c';

        return `
        <tr>
          <td style="text-align:center;font-size:8pt;">${idx + 1}</td>
          <td style="font-family:monospace;font-size:8pt;font-weight:700;">${escapeHtml(it.code || '—')}</td>
          <td>
            <div style="font-weight:700;font-size:8.5pt;">${escapeHtml(it.name)}</div>
            <div style="font-size:7pt;color:#475569;">${escapeHtml(it.location || 'Barracão Principal')} • ${escapeHtml(it.category || '')}</div>
          </td>
          <td style="text-align:right;font-family:monospace;font-size:8pt;">${formatCurrencyBRL(it.unitCost)}</td>
          <td style="text-align:right;font-family:monospace;font-size:8pt;">${formatQtyBR(it.systemQty)} ${escapeHtml(it.unit)}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700;font-size:8pt;">${isCounted ? `${formatQtyBR(it.countedQty as number)} ${escapeHtml(it.unit)}` : '—'}</td>
          <td style="text-align:right;font-family:monospace;font-weight:800;font-size:8pt;color:${diffColor};">
            ${!isCounted ? '—' : `${diff > 0 ? '+' : ''}${formatQtyBR(diff)}`}
          </td>
          <td style="text-align:right;font-family:monospace;font-weight:800;font-size:8pt;color:${diffColor};">
            ${!isCounted ? '—' : `${impact > 0 ? '+' : impact < 0 ? '-' : ''}${formatCurrencyBRL(Math.abs(impact))}`}
          </td>
          <td style="text-align:center;font-size:7.5pt;font-weight:800;color:${diffColor};">${statusText}</td>
        </tr>`;
      })
      .join('');

    const netColor =
      metrics.netFinancialImpact > 0
        ? '#047857'
        : metrics.netFinancialImpact < 0
          ? '#be123c'
          : '#0f172a';

    const contentHtml = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <div style="border:1px solid #0f172a;border-radius:6px;padding:8px;background:#f8fafc;">
          <div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#475569;">Itens Conferidos</div>
          <div style="font-size:13pt;font-weight:900;color:#0f172a;">${metrics.countedItems} / ${metrics.totalItems}</div>
          <div style="font-size:7.5pt;color:#475569;">Sem divergência (OK): ${metrics.okItems}</div>
        </div>
        <div style="border:1px solid #047857;border-radius:6px;padding:8px;background:#ecfdf5;">
          <div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#065f46;">Sobras Encontradas (+)</div>
          <div style="font-size:12pt;font-weight:900;color:#047857;">+${formatCurrencyBRL(metrics.surplusValue)}</div>
          <div style="font-size:7.5pt;color:#065f46;">${metrics.surplusCount} item(ns) com sobra</div>
        </div>
        <div style="border:1px solid #be123c;border-radius:6px;padding:8px;background:#fff1f2;">
          <div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#9f1239;">Faltas / Perdas (-)</div>
          <div style="font-size:12pt;font-weight:900;color:#be123c;">-${formatCurrencyBRL(metrics.shortageValue)}</div>
          <div style="font-size:7.5pt;color:#9f1239;">${metrics.shortageCount} item(ns) com falta</div>
        </div>
        <div style="border:1.5px solid #0f172a;border-radius:6px;padding:8px;background:#f1f5f9;">
          <div style="font-size:7pt;font-weight:700;text-transform:uppercase;color:#334155;">Impacto Líquido Total</div>
          <div style="font-size:12pt;font-weight:900;color:${netColor};">
            ${metrics.netFinancialImpact > 0 ? '+' : metrics.netFinancialImpact < 0 ? '-' : ''}${formatCurrencyBRL(Math.abs(metrics.netFinancialImpact))}
          </div>
          <div style="font-size:7.5pt;color:#334155;">${metrics.adjustedItems} item(ns) ajustado(s)</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;font-size:8pt;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;">
        <div><strong>Código:</strong> #${escapeHtml(session.code)}</div>
        <div><strong>Status:</strong> ${session.status === 'CONCLUIDO' ? 'CONCLUÍDO / AUDITADO' : 'EM ANDAMENTO'}</div>
        <div><strong>Escopo:</strong> ${escapeHtml(getScopeLabel(session.scopeType, session.scopeValue))}</div>
        <div><strong>Responsável:</strong> ${escapeHtml(session.responsible)}</div>
        <div><strong>Abertura:</strong> ${formatDateTimeBR(session.createdAt)}</div>
        <div><strong>Fechamento:</strong> ${formatDateTimeBR(session.completedAt)}</div>
      </div>

      ${
        session.notes
          ? `<div style="margin-bottom:10px;font-size:8pt;color:#334155;padding:6px 8px;border-left:3px solid #059669;background:#f8fafc;"><strong>Observações do Inventário:</strong> ${escapeHtml(session.notes)}</div>`
          : ''
      }

      <table>
        <thead>
          <tr>
            <th style="text-align:center;width:28px;">#</th>
            <th style="width:65px;">Código</th>
            <th>Produto / Local</th>
            <th style="text-align:right;width:72px;">Custo Unit.</th>
            <th style="text-align:right;width:70px;">Saldo Sist.</th>
            <th style="text-align:right;width:70px;">Qtd. Física</th>
            <th style="text-align:right;width:62px;">Diferença</th>
            <th style="text-align:right;width:82px;">Impacto (R$)</th>
            <th style="text-align:center;width:62px;">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    const html = generatePrintableHtml({
      title: `RELATÓRIO OFICIAL DE INVENTÁRIO & DIVERGÊNCIAS — ${session.title}`,
      subtitle: `Balanço Auditado #${session.code} • Confronto Físico vs. Sistema com Impacto Financeiro`,
      documentType: 'RELATÓRIO OFICIAL DE INVENTÁRIO (A4)',
      company,
      contentHtml,
      orientation: 'landscape',
      showSignatures: true,
      signatureLabels: [
        `Responsável pela Contagem (${session.responsible})`,
        'Gerência / Diretoria (Aprovação do Ajuste)',
      ],
      footerNotes:
        'Documento oficial de auditoria de estoque. Os saldos dos itens divergentes foram atualizados no Estoque Geral com geração de movimentações de ajuste.',
    });

    executePrint(html);
  };

  return (
    <div className="space-y-3">
      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`px-3.5 py-2 rounded-lg border border-black flex items-center justify-between gap-3 text-xs font-bold shadow-xs ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-100 text-emerald-950'
              : feedbackBanner.type === 'warning'
                ? 'bg-amber-100 text-amber-950'
                : 'bg-[#cad4e6] text-black'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-0.5 rounded hover:bg-black/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISÃO 1: LISTA DE SESSÕES DE BALANÇO / INVENTÁRIO                     */}
      {/* ===================================================================== */}
      {!activeSession ? (
        <div className="space-y-3">
          {/* Cabeçalho da Lista */}
          <div className="bg-[#cad4e6] dark:bg-stone-800 border border-black rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#e0e6f1] border border-black flex items-center justify-center shrink-0">
                <ClipboardList className="w-4 h-4 text-emerald-800" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-black dark:text-white leading-tight">
                  Balanço / Inventário Físico de Estoque
                </h2>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-stone-300">
                  Contagens multi-dias com salvamento automático em rascunho, modo cego e ajuste auditado
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-novo-balanco-estoque"
              onClick={handleOpenNewModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white border border-black text-xs font-bold uppercase tracking-wide shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Novo Balanço / Inventário</span>
            </button>
          </div>

          {/* Lista de Sessões */}
          {sessions.length === 0 ? (
            <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black rounded-lg p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#cad4e6] border border-black mx-auto flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-slate-800" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-black uppercase text-black dark:text-white">
                  Nenhuma sessão de balanço iniciada
                </h3>
                <p className="text-xs text-slate-700 dark:text-stone-300">
                  Crie uma sessão de inventário completo, por categoria ou por local de armazenagem.
                  Você pode pausar a contagem, fechar o navegador e retomar nos dias seguintes sem
                  alterar o saldo oficial até o fechamento.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenNewModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white border border-black text-xs font-bold uppercase tracking-wide shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Iniciar Primeiro Balanço</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {sessions.map((sess) => {
                const m = sess.summarySnapshot || computeSessionMetrics(sess.items);
                const isDone = sess.status === 'CONCLUIDO';

                return (
                  <div
                    key={sess.id}
                    className="bg-[#e0e6f1] dark:bg-stone-900 border border-black rounded-lg p-3.5 shadow-xs hover:bg-[#d5dfef] dark:hover:bg-stone-850 transition"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      {/* Informações Principais */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#cad4e6] border border-black text-[11px] font-black font-mono text-black">
                            #{sess.code}
                          </span>
                          <h3 className="text-sm font-black text-black dark:text-white uppercase truncate">
                            {sess.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-wide ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-700'
                                : 'bg-amber-100 text-amber-950 border-amber-700'
                            }`}
                          >
                            {isDone ? '✅ CONCLUÍDO' : '⏳ EM ANDAMENTO'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-800 dark:text-stone-300">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-600" />
                            <span>{getScopeLabel(sess.scopeType, sess.scopeValue)}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-600" />
                            <span>Resp.: {sess.responsible}</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-600" />
                            <span>
                              {isDone
                                ? `Fechado em ${formatDateTimeBR(sess.completedAt)}`
                                : `Último salvamento: ${formatDateTimeBR(sess.updatedAt)}`}
                            </span>
                          </span>
                        </div>

                        {/* Barra de Progresso + Resumo Financeiro */}
                        <div className="pt-1 flex flex-wrap items-center gap-4">
                          <div className="w-52 max-w-full">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 mb-0.5">
                              <span>
                                Progresso: {m.countedItems} / {m.totalItems} itens
                              </span>
                              <span>{m.totalItems > 0 ? Math.round((m.countedItems / m.totalItems) * 100) : 0}%</span>
                            </div>
                            <div className="w-full h-2 bg-white border border-black rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 transition-all"
                                style={{
                                  width: `${m.totalItems > 0 ? Math.round((m.countedItems / m.totalItems) * 100) : 0}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold font-mono">
                            <span className="px-2 py-0.5 rounded bg-white border border-black/40 text-slate-800">
                              OK: {m.okItems}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-700 text-emerald-900">
                              Sobras: +{formatCurrencyBRL(m.surplusValue)}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-700 text-rose-900">
                              Faltas: -{formatCurrencyBRL(m.shortageValue)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ações da Sessão */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSessionId(sess.id);
                            setSearchTerm('');
                            setFilterMode('todos');
                            setBlindMode(false);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-black text-xs font-bold uppercase transition cursor-pointer ${
                            isDone
                              ? 'bg-[#cad4e6] hover:bg-[#b8c6de] text-black'
                              : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Visualizar Auditoria</span>
                            </>
                          ) : (
                            <>
                              <ClipboardList className="w-3.5 h-3.5" />
                              <span>Retomar Contagem</span>
                            </>
                          )}
                        </button>

                        {isDone ? (
                          <button
                            type="button"
                            onClick={() => handlePrintOfficialAuditReport(sess)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-black text-xs font-bold uppercase transition cursor-pointer"
                            title="Imprimir Relatório Oficial de Inventário & Divergências (A4)"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Relatório A4</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePrintCountingSheet(sess)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-black text-xs font-bold uppercase transition cursor-pointer"
                              title="Imprimir Ficha de Contagem (A4)"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-700" />
                              <span>Ficha A4</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSession(sess)}
                              className="p-1.5 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-700 transition cursor-pointer"
                              title="Excluir Rascunho"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================== */
        /* VISÃO 2: WORKSPACE DE CONTAGEM & CONFERÊNCIA                          */
        /* ===================================================================== */
        <div className="space-y-3">
          {/* Barra Superior da Sessão */}
          <div className="bg-[#cad4e6] dark:bg-stone-800 border border-black rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setActiveSessionId(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#e0e6f1] hover:bg-white text-black border border-black text-xs font-bold uppercase transition cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sessões</span>
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-white border border-black text-[10px] font-black font-mono text-black">
                    #{activeSession.code}
                  </span>
                  <h2 className="text-sm font-black uppercase text-black dark:text-white truncate">
                    {activeSession.title}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase ${
                      activeSession.status === 'CONCLUIDO'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-700'
                        : 'bg-amber-100 text-amber-950 border-amber-700'
                    }`}
                  >
                    {activeSession.status === 'CONCLUIDO' ? '🔒 CONCLUÍDO (AUDITADO)' : '⏳ EM ANDAMENTO'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold text-slate-800 dark:text-stone-300 mt-0.5">
                  <span>{getScopeLabel(activeSession.scopeType, activeSession.scopeValue)}</span>
                  <span>•</span>
                  <span>Resp.: {activeSession.responsible}</span>
                  <span>•</span>
                  {activeSession.status === 'CONCLUIDO' ? (
                    <span className="text-emerald-900 font-bold">
                      Concluído em {formatDateTimeBR(activeSession.completedAt)}
                    </span>
                  ) : (
                    <span className="text-emerald-900 font-bold">
                      Salvo automaticamente às {formatTimeHHMMSS(activeSession.updatedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Botões de Ação da Sessão */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {activeSession.status === 'EM_ANDAMENTO' && (
                <button
                  type="button"
                  id="btn-modo-contagem-cega"
                  onClick={() => {
                    setBlindMode((prev) => {
                      const next = !prev;
                      if (next && filterMode === 'divergencia') setFilterMode('todos');
                      return next;
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-black text-xs font-bold uppercase transition cursor-pointer ${
                    blindMode
                      ? 'bg-slate-900 text-white'
                      : 'bg-[#e0e6f1] hover:bg-white text-black'
                  }`}
                  title="Oculta temporariamente Saldo Sistema e Diferença para contagem física imparcial"
                >
                  {blindMode ? <EyeOff className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5 text-slate-800" />}
                  <span>{blindMode ? 'Contagem Cega: ON' : '👁️ Modo Contagem Cega'}</span>
                </button>
              )}

              <button
                type="button"
                id="btn-imprimir-ficha-contagem"
                onClick={() => handlePrintCountingSheet(activeSession)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-black text-xs font-bold uppercase transition cursor-pointer"
                title="Imprimir Ficha de Contagem (A4) com coluna em branco para prancheta"
              >
                <Printer className="w-3.5 h-3.5 text-slate-700" />
                <span>🖨️ Ficha de Contagem (A4)</span>
              </button>

              {activeSession.status === 'EM_ANDAMENTO' ? (
                <button
                  type="button"
                  id="btn-concluir-balanco-estoque"
                  onClick={() => setIsFinishModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white border border-black text-xs font-bold uppercase shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>✅ Concluir Balanço & Atualizar Estoque</span>
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-imprimir-relatorio-oficial-balanco"
                  onClick={() => handlePrintOfficialAuditReport(activeSession)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white border border-black text-xs font-bold uppercase shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>🖨️ Relatório Oficial de Inventário & Divergências (A4)</span>
                </button>
              )}
            </div>
          </div>

          {/* Aviso de Modo Contagem Cega */}
          {blindMode && activeSession.status === 'EM_ANDAMENTO' && (
            <div className="bg-slate-900 text-white border border-black rounded-lg px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-bold">
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  MODO CONTAGEM CEGA ATIVO — As colunas Saldo Sistema, Diferença e Impacto Financeiro
                  estão ocultadas para garantir uma conferência física imparcial.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBlindMode(false)}
                className="px-2 py-0.5 rounded bg-amber-400 text-black text-[10px] font-black uppercase cursor-pointer shrink-0"
              >
                Desativar
              </button>
            </div>
          )}

          {/* 4 Cards de Resumo (bg-[#e0e6f1] border border-black) */}
          {activeMetrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {/* Card 1: Progresso */}
              <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black border-l-4 border-l-emerald-700 rounded-lg p-3 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-stone-300">
                    Progresso da Contagem
                  </span>
                  <span className="text-xs font-black font-mono text-emerald-800 bg-emerald-100 border border-emerald-700 px-1.5 py-0.5 rounded">
                    {activeMetrics.progressPercent}%
                  </span>
                </div>
                <div className="text-base font-black text-black dark:text-white mt-1 font-mono">
                  {activeMetrics.countedItems} / {activeMetrics.totalItems}{' '}
                  <span className="text-xs font-bold font-sans text-slate-700">itens conferidos</span>
                </div>
                <div className="w-full h-2 bg-white border border-black rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${activeMetrics.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Card 2: Sem Divergência */}
              <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black border-l-4 border-l-slate-700 rounded-lg p-3 shadow-xs flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-stone-300">
                    Itens Sem Divergência (OK)
                  </span>
                  <div className="text-lg font-black text-black dark:text-white mt-1 font-mono">
                    {blindMode ? '•••' : activeMetrics.okItems}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-700 dark:text-stone-400">
                    {blindMode
                      ? 'Oculto no Modo Contagem Cega'
                      : `${activeMetrics.uncountedItems} pendente(s) de contagem`}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-[#cad4e6] border border-black flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                </div>
              </div>

              {/* Card 3: Sobras (+ R$) */}
              <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black border-l-4 border-l-blue-700 rounded-lg p-3 shadow-xs flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    Sobras Encontradas (+ R$)
                  </span>
                  <div className="text-lg font-black text-emerald-800 dark:text-emerald-400 mt-1 font-mono">
                    {blindMode ? 'R$ ••••' : `+ ${formatCurrencyBRL(activeMetrics.surplusValue)}`}
                  </div>
                  <p className="text-[10px] font-bold text-blue-900/80 dark:text-blue-300">
                    {blindMode
                      ? 'Oculto no Modo Contagem Cega'
                      : `${activeMetrics.surplusCount} item(ns) acima do sistema`}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-800 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-emerald-800" />
                </div>
              </div>

              {/* Card 4: Faltas / Perdas (- R$) */}
              <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black border-l-4 border-l-rose-700 rounded-lg p-3 shadow-xs flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-900 dark:text-rose-300">
                    Faltas / Perdas (- R$)
                  </span>
                  <div className="text-lg font-black text-rose-700 dark:text-rose-400 mt-1 font-mono">
                    {blindMode ? 'R$ ••••' : `- ${formatCurrencyBRL(activeMetrics.shortageValue)}`}
                  </div>
                  <p className="text-[10px] font-bold text-rose-900/80 dark:text-rose-300">
                    {blindMode
                      ? 'Oculto no Modo Contagem Cega'
                      : `${activeMetrics.shortageCount} item(ns) abaixo do sistema`}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-800 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-4 h-4 text-rose-800" />
                </div>
              </div>
            </div>
          )}

          {/* Faixa de Busca & Filtros de Contagem */}
          <div className="bg-[#cad4e6] dark:bg-stone-800 border border-black rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código, produto, categoria ou local..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-white border border-slate-500 text-xs font-semibold text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {activeMetrics && (
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { id: 'todos', label: `Todos (${activeMetrics.totalItems})` },
                    { id: 'nao_contados', label: `Não Contados (${activeMetrics.uncountedItems})` },
                    { id: 'conferidos', label: `Conferidos (${activeMetrics.countedItems})` },
                    ...(!blindMode
                      ? [{ id: 'divergencia', label: `Com Divergência (${activeMetrics.adjustedItems})` }]
                      : []),
                  ] as { id: CountFilterMode; label: string }[]
                ).map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setFilterMode(btn.id)}
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase transition cursor-pointer ${
                      filterMode === btn.id
                        ? 'bg-emerald-700 text-white border-black shadow-2xs'
                        : 'bg-[#e0e6f1] hover:bg-white text-black border-black/60'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabela Profissional de Contagem */}
          <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black rounded-lg overflow-hidden shadow-xs">
            <div className="max-h-[54vh] overflow-y-auto overflow-x-auto">
              <table className="w-full table-auto text-left text-xs">
                <thead className="sticky top-0 z-20 bg-[#cad4e6] dark:bg-stone-800 border-b border-black text-black dark:text-stone-200 uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="py-2 px-3">CÓDIGO / ITEM / LOCAL</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">CUSTO UNIT. (R$)</th>
                    {!blindMode && (
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">SALDO SISTEMA</th>
                    )}
                    <th className="py-2 px-3 text-center whitespace-nowrap">QTD. FÍSICA CONTADA</th>
                    {!blindMode && (
                      <>
                        <th className="py-2 px-2.5 text-right whitespace-nowrap">DIFERENÇA (+/-)</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">IMPACTO FINANCEIRO (R$)</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20 dark:divide-stone-800">
                  {filteredBalanceItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={blindMode ? 3 : 6}
                        className="py-8 text-center text-xs font-bold uppercase text-slate-600"
                      >
                        Nenhum item encontrado para o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredBalanceItems.map((item) => {
                      const isCounted = item.countedQty !== null && item.countedQty !== undefined;
                      const diff = isCounted ? roundQty((item.countedQty as number) - item.systemQty) : 0;
                      const impact = isCounted
                        ? Math.round(diff * (Number(item.unitCost) || 0) * 100) / 100
                        : 0;
                      const isSurplus = isCounted && diff > 0.0001;
                      const isShortage = isCounted && diff < -0.0001;
                      const isOk = isCounted && Math.abs(diff) < 0.0001;
                      const isLocked = activeSession.status === 'CONCLUIDO';

                      return (
                        <tr
                          key={item.productId}
                          className={`transition ${
                            !blindMode && isShortage
                              ? 'bg-rose-50/70 hover:bg-rose-100/70'
                              : !blindMode && isSurplus
                                ? 'bg-emerald-50/70 hover:bg-emerald-100/70'
                                : 'bg-[#e0e6f1] hover:bg-[#d2dced]'
                          }`}
                        >
                          {/* Código / Item / Local */}
                          <td className="py-2 px-3">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.code && (
                                    <span className="px-1.5 py-0.5 rounded bg-white border border-black/40 text-[10px] font-mono font-bold text-slate-800">
                                      {item.code}
                                    </span>
                                  )}
                                  <span className="font-bold text-black dark:text-white uppercase">
                                    {item.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-700 mt-0.5">
                                  <span>{item.category || 'Geral'}</span>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-0.5">
                                    <MapPin className="w-3 h-3 text-slate-600" />
                                    {item.location || 'Barracão Principal'}
                                  </span>
                                  <span>•</span>
                                  <span className="font-mono font-bold uppercase">{item.unit}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Custo Unitário */}
                          <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {formatCurrencyBRL(item.unitCost)}
                          </td>

                          {/* Saldo Sistema */}
                          {!blindMode && (
                            <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatQtyBR(item.systemQty)}{' '}
                              <span className="text-[10px] font-semibold text-slate-600">{item.unit}</span>
                            </td>
                          )}

                          {/* Qtd. Física Contada + Botão Rápido */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            {isLocked ? (
                              <div className="flex items-center justify-center gap-1.5 font-mono font-black text-black">
                                <Lock className="w-3 h-3 text-slate-500" />
                                <span>
                                  {isCounted ? `${formatQtyBR(item.countedQty as number)} ${item.unit}` : 'Não contado'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={item.countedQty === null ? '' : String(item.countedQty)}
                                  onChange={(e) => handleUpdateCountedQty(item.productId, e.target.value)}
                                  placeholder="Contar..."
                                  aria-label={`Quantidade física contada de ${item.name}`}
                                  className="w-28 px-2 py-1 rounded-md bg-white border border-slate-600 text-right font-mono font-bold text-xs text-black focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                />
                                {!blindMode && (
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmEqual(item.productId, item.systemQty)}
                                    title={`Confirmar igual ao saldo do sistema (${formatQtyBR(item.systemQty)} ${item.unit})`}
                                    className={`h-7 inline-flex items-center gap-1 px-2 rounded-md border text-[10px] font-black uppercase transition cursor-pointer ${
                                      isOk
                                        ? 'bg-emerald-700 text-white border-black'
                                        : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-700'
                                    }`}
                                  >
                                    <Check className="w-3 h-3 stroke-[2.8]" />
                                    <span className="hidden xl:inline">Confirmar Igual</span>
                                  </button>
                                )}
                                {isCounted && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCountedQty(item.productId, '')}
                                    title="Limpar contagem deste item"
                                    className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-white hover:bg-slate-200 text-slate-700 border border-slate-500 transition cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Diferença & Impacto Financeiro */}
                          {!blindMode && (
                            <>
                              <td className="py-2 px-2.5 text-right font-mono font-black whitespace-nowrap">
                                {!isCounted ? (
                                  <span className="text-[10px] font-bold uppercase text-slate-500 bg-white/70 border border-slate-400 px-1.5 py-0.5 rounded">
                                    Pendente
                                  </span>
                                ) : isOk ? (
                                  <span className="text-[10px] font-black uppercase text-emerald-900 bg-emerald-100 border border-emerald-600 px-1.5 py-0.5 rounded">
                                    0 (OK)
                                  </span>
                                ) : isSurplus ? (
                                  <span className="text-emerald-800 bg-emerald-100 border border-emerald-700 px-1.5 py-0.5 rounded">
                                    +{formatQtyBR(diff)} {item.unit}
                                  </span>
                                ) : (
                                  <span className="text-rose-800 bg-rose-100 border border-rose-700 px-1.5 py-0.5 rounded">
                                    {formatQtyBR(diff)} {item.unit}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-black whitespace-nowrap">
                                {!isCounted ? (
                                  <span className="text-slate-500">—</span>
                                ) : isOk ? (
                                  <span className="text-slate-700">{formatCurrencyBRL(0)}</span>
                                ) : isSurplus ? (
                                  <span className="text-emerald-800">
                                    +{formatCurrencyBRL(Math.abs(impact))}
                                  </span>
                                ) : (
                                  <span className="text-rose-700">
                                    -{formatCurrencyBRL(Math.abs(impact))}
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CRIAR NOVA SESSÃO DE BALANÇO / INVENTÁRIO                      */}
      {/* ===================================================================== */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3">
          <div className="w-full max-w-lg bg-[#e0e6f1] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#cad4e6] border-b border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-800" />
                <h3 className="text-sm font-black uppercase text-black">
                  Nova Sessão de Balanço / Inventário
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded hover:bg-black/10 text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="p-4 space-y-3 overflow-y-auto">
              {formError && (
                <div className="p-2.5 rounded-md bg-rose-100 border border-rose-700 text-rose-900 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black uppercase text-black mb-1">
                  Título / Identificação *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Inventário Geral 11/2026"
                  className="w-full px-3 py-1.5 rounded-md bg-white border border-slate-500 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-black mb-1">
                    Escopo da Contagem *
                  </label>
                  <select
                    value={newScopeType}
                    onChange={(e) => {
                      const next = e.target.value as InventoryBalanceScopeType;
                      setNewScopeType(next);
                      setNewScopeValue('');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-500 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="completo">Estoque Completo</option>
                    <option value="categoria">Filtrar por Categoria</option>
                    <option value="local">Filtrar por Local de Armazenagem</option>
                  </select>
                </div>

                <div ref={responsibleDropdownRef} className="relative">
                  <label className="block text-[11px] font-black uppercase text-black mb-1">
                    Responsável pela Contagem *
                  </label>
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={responsibleQuery}
                      onFocus={() => setIsResponsibleDropdownOpen(true)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setResponsibleQuery(val);
                        setIsResponsibleDropdownOpen(true);
                        const exact = activeRhEmployees.find(
                          (emp) => emp.name.trim().toLowerCase() === val.trim().toLowerCase()
                        );
                        setNewResponsible(exact ? exact.name.trim() : '');
                        if (formError) setFormError('');
                      }}
                      placeholder="Buscar ou selecionar funcionário..."
                      autoComplete="off"
                      className={`w-full pl-8 pr-12 py-1.5 rounded-md bg-white border text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                        newResponsible ? 'border-emerald-700' : 'border-slate-500'
                      }`}
                    />
                    <div className="absolute right-1.5 flex items-center gap-0.5">
                      {(responsibleQuery || newResponsible) && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewResponsible('');
                            setResponsibleQuery('');
                            setIsResponsibleDropdownOpen(true);
                          }}
                          title="Limpar seleção"
                          className="p-0.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsResponsibleDropdownOpen((prev) => !prev)}
                        title="Abrir lista de funcionários do RH"
                        className="p-0.5 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            isResponsibleDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {isResponsibleDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 z-40 bg-white border border-black rounded-md shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-200">
                      {filteredRhEmployees.length === 0 ? (
                        <div className="px-3 py-2.5 text-[11px] font-semibold text-slate-600 text-center">
                          {activeRhEmployees.length === 0
                            ? 'Nenhum funcionário ativo cadastrado no módulo RH.'
                            : 'Nenhum funcionário encontrado para a busca.'}
                        </div>
                      ) : (
                        filteredRhEmployees.map((emp) => {
                          const isSelected = newResponsible === emp.name.trim();
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                const cleanName = emp.name.trim();
                                setNewResponsible(cleanName);
                                setResponsibleQuery(cleanName);
                                setIsResponsibleDropdownOpen(false);
                                if (formError) setFormError('');
                              }}
                              className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between gap-2 transition cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-100 text-emerald-950 font-black'
                                  : 'hover:bg-[#e0e6f1] text-black'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate">{emp.name}</div>
                                {emp.role && (
                                  <div className="text-[10px] font-semibold text-slate-600 truncate">
                                    {emp.role}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {newScopeType === 'categoria' && (
                <div>
                  <label className="block text-[11px] font-black uppercase text-black mb-1">
                    Selecione a Categoria *
                  </label>
                  <select
                    value={newScopeValue}
                    onChange={(e) => setNewScopeValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-500 text-xs font-semibold text-black"
                    required
                  >
                    <option value="">-- Selecione uma categoria --</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newScopeType === 'local' && (
                <div>
                  <label className="block text-[11px] font-black uppercase text-black mb-1">
                    Selecione o Local de Armazenagem *
                  </label>
                  <select
                    value={newScopeValue}
                    onChange={(e) => setNewScopeValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-500 text-xs font-semibold text-black"
                    required
                  >
                    <option value="">-- Selecione um local --</option>
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 bg-[#cad4e6] border border-black rounded-md px-3 py-2">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeServices}
                    onChange={(e) => setExcludeServices(e.target.checked)}
                    className="rounded border-black text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Ignorar itens do tipo SERVIÇO (apenas estoque físico)</span>
                </label>
                <span className="px-2 py-0.5 rounded bg-white border border-black text-[11px] font-black font-mono text-emerald-900 shrink-0">
                  <Package className="w-3 h-3 inline mr-1" />
                  {previewMatchedItems.length} item(ns)
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase text-black mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Contagem prevista para 3 dias — Galpão Principal e Peças..."
                  className="w-full px-3 py-1.5 rounded-md bg-white border border-slate-500 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 border-t border-black/20 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Iniciar Sessão em Rascunho</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CONFIRMAÇÃO AUDITADA DE FECHAMENTO DO BALANÇO                  */}
      {/* ===================================================================== */}
      {isFinishModalOpen && activeSession && activeMetrics && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3">
          <div className="w-full max-w-xl bg-[#e0e6f1] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#cad4e6] border-b border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-800" />
                <h3 className="text-sm font-black uppercase text-black">
                  Confirmar Fechamento & Atualização Oficial do Estoque
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFinishModalOpen(false)}
                className="p-1 rounded hover:bg-black/10 text-black cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-800">
                Você está prestes a concluir o balanço{' '}
                <strong className="text-black">
                  #{activeSession.code} — {activeSession.title}
                </strong>
                . Após a confirmação, os saldos oficiais dos produtos ajustados serão atualizados no{' '}
                <strong>Estoque Geral</strong> com movimentações auditáveis e esta sessão será{' '}
                <strong>bloqueada para edição</strong>.
              </p>

              {activeMetrics.uncountedItems > 0 && (
                <div className="p-2.5 rounded-md bg-amber-100 border border-amber-700 text-amber-950 text-xs font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                  <span>
                    Atenção: existem <strong>{activeMetrics.uncountedItems} item(ns) não contado(s)</strong>.
                    Eles permanecerão com o saldo atual inalterado no sistema. Apenas os itens efetivamente
                    conferidos com divergência serão ajustados.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white border border-black rounded-lg p-2.5">
                  <div className="text-[10px] font-black uppercase text-slate-600">
                    Itens Conferidos
                  </div>
                  <div className="text-base font-black font-mono text-black mt-0.5">
                    {activeMetrics.countedItems} / {activeMetrics.totalItems}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-600">
                    Sem divergência (OK): {activeMetrics.okItems}
                  </div>
                </div>

                <div className="bg-white border border-black rounded-lg p-2.5">
                  <div className="text-[10px] font-black uppercase text-slate-600">
                    Itens com Saldo Ajustado
                  </div>
                  <div className="text-base font-black font-mono text-black mt-0.5">
                    {activeMetrics.adjustedItems} produto(s)
                  </div>
                  <div className="text-[10px] font-semibold text-slate-600">
                    {activeMetrics.surplusCount} sobra(s) • {activeMetrics.shortageCount} falta(s)
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-800 rounded-lg p-2.5">
                  <div className="text-[10px] font-black uppercase text-emerald-900">
                    Sobras Encontradas (+)
                  </div>
                  <div className="text-base font-black font-mono text-emerald-800 mt-0.5">
                    + {formatCurrencyBRL(activeMetrics.surplusValue)}
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-800 rounded-lg p-2.5">
                  <div className="text-[10px] font-black uppercase text-rose-900">
                    Faltas / Perdas (-)
                  </div>
                  <div className="text-base font-black font-mono text-rose-700 mt-0.5">
                    - {formatCurrencyBRL(activeMetrics.shortageValue)}
                  </div>
                </div>
              </div>

              <div className="bg-[#cad4e6] border border-black rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-black">
                  Valor Líquido de Sobras / Faltas
                </span>
                <span
                  className={`text-base font-black font-mono ${
                    activeMetrics.netFinancialImpact > 0
                      ? 'text-emerald-900'
                      : activeMetrics.netFinancialImpact < 0
                        ? 'text-rose-800'
                        : 'text-black'
                  }`}
                >
                  {activeMetrics.netFinancialImpact > 0
                    ? '+'
                    : activeMetrics.netFinancialImpact < 0
                      ? '-'
                      : ''}
                  {formatCurrencyBRL(Math.abs(activeMetrics.netFinancialImpact))}
                </span>
              </div>

              <div className="pt-2 border-t border-black/20 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFinishModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  Voltar e Revisar
                </button>
                <button
                  type="button"
                  id="btn-confirmar-fechamento-balanco"
                  onClick={handleConfirmFinishBalance}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar & Atualizar Estoque</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
