import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calculator, 
  Printer, 
  Trash2, 
  FileText, 
  UserX, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  X, 
  Plus, 
  Clock, 
  Eye, 
  Building2,
  Phone,
  RefreshCw,
  Scale,
  Edit2,
  Search,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { 
  Employee, 
  SalaryAdvance, 
  AbsenceRecord, 
  CompanyProfile,
  TerminationRecord, 
  TerminationReason, 
  NoticeType,
  TerminationCalculation,
  VacationRecord,
  Expense
} from '../../types';
import { 
  formatCurrencyBRL, 
  formatDateBR, 
  getActiveCompanyId,
  getStoredTerminations, 
  saveStoredTerminations,
  getStoredExpenses,
  saveStoredExpenses,
  getStoredMachineries
} from '../../lib/storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  saveCloudTerminations,
  fetchCloudTerminations,
  upsertRhRescisaoRecord,
  deleteRhRescisaoRecord,
  mapRowToTerminationRecord,
  toValidUUID,
  insertFinanceiroContasAPagar,
  saveCloudExpenses
} from '../../lib/supabaseService';
import { useAuth } from '../../context/AuthContext';
import { 
  formatMoneyBRL, 
  formatCPF, 
  formatEmployeeAdmissionDate,
  findEmployeeLinkedMachinery
} from './payrollHelpers';
import { PixQrCodeBlock } from './PixQrCodeBlock';
import { resolveEmployeePixKey } from './pixQrCodeHelper';
import { getEmployeePixKey, findEmployeeFromStorage } from './pixUtils';
import { useConfirm } from '../../context/ConfirmContext';
import { ResignCalculationModal } from './ResignCalculationModal';

interface RescisaoTabProps {
  employees: Employee[];
  vacations?: VacationRecord[];
  companyProfile?: CompanyProfile;
  advances?: SalaryAdvance[];
  absences?: AbsenceRecord[];
  onSaveEmployees?: (employees: Employee[]) => void;
}

export const RescisaoTab: React.FC<RescisaoTabProps> = ({
  employees = [],
  vacations = [],
  companyProfile,
  advances = [],
  absences = [],
  onSaveEmployees,
}) => {
  const { confirm } = useConfirm();
  const { currentUser, companyId: authCompanyId } = useAuth();
  const activeTenantId = useMemo(() => {
    return authCompanyId || currentUser?.id || getActiveCompanyId() || 'default';
  }, [authCompanyId, currentUser?.id]);

  const clientInstanceIdRef = useRef<string>(`resc_tab_${Math.random().toString(36).slice(2, 10)}`);
  const realtimeChannelRef = useRef<any>(null);

  // Histórico de Rescisões persistido
  const [terminations, setTerminations] = useState<TerminationRecord[]>(() => getStoredTerminations());
  const terminationsRef = useRef<TerminationRecord[]>(terminations);
  useEffect(() => {
    terminationsRef.current = terminations;
  }, [terminations]);

  // Controle da Janela Modal de Cálculo e Listagem
  // OBRIGATÓRIO: Inicia fechado (isOpen: false)
  const [isCalculationModalOpen, setIsCalculationModalOpen] = useState<boolean>(false);
  const [editingTermination, setEditingTermination] = useState<TerminationRecord | null>(null);

  // Filtros da Listagem Histórica
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'homologado' | 'integrado' | 'rascunho'>('all');

  // Estado de Integração Financeira em Andamento & Banner de Feedback
  const [integratingId, setIntegratingId] = useState<string | null>(null);
  const [integrationBanner, setIntegrationBanner] = useState<{
    type: 'success' | 'error';
    title: string;
    details: string;
  } | null>(null);

  // Modal de Impressão / TRCT
  const [viewingTRCT, setViewingTRCT] = useState<TerminationRecord | null>(null);

  // Resolução dinâmica da chave PIX do colaborador na rescisão (consulta de employees e LocalStorage)
  const trctPixKey = useMemo(() => {
    if (!viewingTRCT) return '';
    const stored = findEmployeeFromStorage(viewingTRCT.employeeId || viewingTRCT.employeeName);
    const keyFromStored = getEmployeePixKey(stored);
    if (keyFromStored) return keyFromStored;
    return resolveEmployeePixKey(
      viewingTRCT.employeeId || viewingTRCT.employeeName,
      employees
    );
  }, [viewingTRCT, employees]);

  // Rotina de impressão com janela isolada (window.open) para o Termo de Rescisão
  const handlePrintTRCTIsolated = () => {
    const trctEl = document.getElementById('trct-print-area');
    if (!trctEl) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (printWindow) {
      const estilosPai = Array.from(document.styleSheets)
        .map(styleSheet => {
          try {
            return Array.from(styleSheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
          } catch (e) {
            return '';
          }
        })
        .join('\n');

      printWindow.document.write(`
        <html>
          <head>
            <title>Termo de Rescisão - ${viewingTRCT?.employeeName || 'TRCT'}</title>
            <style>
              ${estilosPai}
              body { background: white !important; color: black !important; padding: 20px; font-family: sans-serif; }
              @media print {
                @page { size: A4 portrait; margin: 1cm; }
                body { padding: 0; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body class="bg-white text-black antialiased">
            <div class="w-full max-w-4xl mx-auto p-2 bg-white border border-gray-200 rounded-xl shadow-none">
              ${trctEl.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    } else {
      window.print();
    }
  };

  // Sincronização inicial com o Supabase da tabela public.rh_rescisoes
  useEffect(() => {
    fetchCloudTerminations(activeTenantId).then((cloudList) => {
      if (cloudList && Array.isArray(cloudList) && cloudList.length > 0) {
        setTerminations((prev) => {
          const map = new Map<string, TerminationRecord>();
          prev.forEach((t) => map.set(toValidUUID(t.id), { ...t, id: toValidUUID(t.id) }));
          cloudList.forEach((t) => map.set(toValidUUID(t.id), { ...t, id: toValidUUID(t.id) }));
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveStoredTerminations(merged);
          return merged;
        });
      }
    }).catch((err) => console.warn('Aviso ao sincronizar rescisões com o Supabase:', err));
  }, [activeTenantId]);

  // Escuta em Tempo Real (Supabase Realtime)
  useEffect(() => {
    if (!isSupabaseConfigured || !activeTenantId) return;

    const applyIncomingTermination = (incoming: TerminationRecord) => {
      if (!incoming) return;
      const incomingId = toValidUUID(incoming.id);
      const normalized: TerminationRecord = { ...incoming, id: incomingId, companyId: activeTenantId };

      setTerminations((prev) => {
        const exists = prev.some((t) => toValidUUID(t.id) === incomingId);
        const next = exists
          ? prev.map((t) => (toValidUUID(t.id) === incomingId ? { ...t, ...normalized, id: incomingId } : t))
          : [normalized, ...prev];
        saveStoredTerminations(next);
        return next;
      });

      setViewingTRCT((prev) =>
        prev && toValidUUID(prev.id) === incomingId ? { ...prev, ...normalized } : prev
      );
    };

    const channelTopic = `rh-rescisoes-realtime-${activeTenantId}`;
    let channel: any = null;

    try {
      const existingChannels = supabase.getChannels?.() || [];
      for (const ch of existingChannels) {
        if (ch.topic === channelTopic || ch.topic === `realtime:${channelTopic}`) {
          try {
            supabase.removeChannel(ch);
          } catch (_) {}
        }
      }

      channel = supabase
        .channel(channelTopic, {
          config: { broadcast: { self: false } },
        })
        .on('broadcast', { event: 'termination_mutation' }, (msg: any) => {
          const payload = msg?.payload || msg;
          if (!payload || payload.senderId === clientInstanceIdRef.current) return;
          if (payload.tenantId && payload.tenantId !== activeTenantId) return;
          if (payload.termination) {
            applyIncomingTermination(payload.termination);
          }
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rh_rescisoes' },
          (payload: any) => {
            const eventType = payload?.eventType;
            if (eventType === 'DELETE') {
              const oldId = payload?.old?.id;
              if (oldId) {
                const targetId = toValidUUID(String(oldId));
                setTerminations((prev) => {
                  const next = prev.filter((t) => toValidUUID(t.id) !== targetId);
                  saveStoredTerminations(next);
                  return next;
                });
              }
              return;
            }

            const row = payload?.new;
            if (!row) return;
            if (row.company_id && String(row.company_id) !== String(activeTenantId)) return;

            const mapped = mapRowToTerminationRecord(row);
            if (mapped) {
              applyIncomingTermination(mapped);
            }
          }
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    } catch (err) {
      console.warn('⚠️ [Realtime Rescisões Notice]:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      }
      realtimeChannelRef.current = null;
    };
  }, [activeTenantId]);

  // Abertura do Modal para "+ Nova Rescisão"
  const handleOpenNewTermination = () => {
    setEditingTermination(null);
    setIsCalculationModalOpen(true);
  };

  // Abertura do Modal para "Visualizar / Editar" rescisão existente
  const handleOpenEditTermination = (record: TerminationRecord) => {
    setEditingTermination(record);
    setIsCalculationModalOpen(true);
  };

  // Nome amigável do motivo de rescisão
  const getReasonLabel = (r: TerminationReason): string => {
    switch (r) {
      case 'sem_justa_causa':
        return 'Demissão sem Justa Causa';
      case 'com_justa_causa':
        return 'Demissão com Justa Causa';
      case 'pedido_demissao':
        return 'Pedido de Demissão';
      case 'acordo_mutuo':
        return 'Acordo Mútuo (Art. 484-A)';
      case 'termino_contrato':
        return 'Término de Contrato';
      default:
        return r;
    }
  };

  // Cálculo da data de vencimento legal (10 dias a contar da data de desligamento)
  const calculateTerminationDueDate = (termDateStr: string): string => {
    if (!termDateStr) {
      const d = new Date();
      d.setDate(d.getDate() + 10);
      return d.toISOString().split('T')[0];
    }
    const cleanDate = termDateStr.split('T')[0];
    const parts = cleanDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setDate(d.getDate() + 10);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  };

  /**
   * PROJETO DE INTEGRAÇÃO FINANCEIRA (BOTÃO INTEGRAR RESCISÃO AO CONTAS A PAGAR E DRE):
   * 1. Lê a linha correspondente da rescisão (t).
   * 2. Lança registro de débito na tabela 'public.financeiro_contas_a_pagar' do Supabase:
   *    * Valor do Título: exatamente o valor da coluna "VALOR LÍQUIDO RESCISÓRIO (R$)".
   *    * Descrição/Histórico: "Acerto Rescisório - [Nome] | Tipo: [Tipo de Rescisão]".
   *    * Categoria Financeira: "Despesas com Pessoal / Rescisões Contratuais".
   *    * Data de Vencimento: prazo legal de 10 dias a contar da Data de Desligamento.
   * 3. Lança despesa no DRE do Veículo/Máquina vinculado (Custo Total Bruto)
   *    ou no DRE Geral da empresa sob a categoria "Custos Administrativos / Pessoal".
   * 4. Muda status da linha para "Integrado", salva no Supabase e desabilita o botão para impedir duplicidade.
   */
  const handleIntegrarRescisaoFinanceiro = async (t: TerminationRecord) => {
    if (t.status === 'integrado' || Boolean(t.isIntegrated) || integratingId === t.id) {
      return;
    }

    setIntegratingId(t.id);
    try {
      const canonicalId = toValidUUID(t.id);
      const payableId = toValidUUID(`cap_rescisao_${canonicalId}`);

      // 1. Data de Vencimento: 10 dias a contar da data de desligamento
      const dueDateIso = calculateTerminationDueDate(t.terminationDate);

      // 2. Colaborador e verificação de veículo / maquinário fixo vinculado
      const emp = employees.find(
        (e) => e.id === t.employeeId || e.name.trim().toLowerCase() === t.employeeName.trim().toLowerCase()
      );
      const machineriesList = getStoredMachineries();
      const linkedMachinery = findEmployeeLinkedMachinery(emp, machineriesList);
      const vehicleLabel = linkedMachinery
        ? `${linkedMachinery.name || linkedMachinery.model || 'Veículo'}${
            linkedMachinery.licensePlateOrSerial ? ` (${linkedMachinery.licensePlateOrSerial})` : ''
          }`
        : undefined;

      // 3. Valores da Rescisão:
      // Valor Líquido Rescisório (R$) = Valor do Título
      const netVal = Math.max(0, Math.round(Number(t.calculation?.netTotal ?? 0) * 100) / 100);
      // Custo Total Bruto da Rescisão para o DRE
      const grossVal = Math.max(0, Math.round(Number(t.calculation?.grossTotal ?? netVal) * 100) / 100);
      const custoDRE = grossVal > 0 ? grossVal : netVal;

      let compMonthIso = new Date().toISOString().slice(0, 7);
      if (t.terminationDate) {
        compMonthIso = t.terminationDate.slice(0, 7);
      }

      const reasonLabel = getReasonLabel(t.reason);
      const descricaoTitulo = `Acerto Rescisório - ${t.employeeName} | Tipo: ${reasonLabel}`;

      // 4. REGRA DE NEGÓCIO 1: Lançamento no Contas a Pagar (tabela 'public.financeiro_contas_a_pagar' do Supabase)
      await insertFinanceiroContasAPagar({
        id: payableId,
        valor: netVal,
        descricao: descricaoTitulo,
        historico: descricaoTitulo,
        categoria: 'Despesas com Pessoal / Rescisões Contratuais',
        categoria_financeira: 'Despesas com Pessoal / Rescisões Contratuais',
        centro_custo: linkedMachinery
          ? `DRE Veículo: ${vehicleLabel}`
          : 'Custos Administrativos / Pessoal',
        data_vencimento: dueDateIso,
        forma_pagamento: 'PIX',
        employee_id: t.employeeId,
        colaborador_id: t.employeeId,
        colaborador_nome: t.employeeName,
        competencia: compMonthIso,
        veiculo_id: linkedMachinery?.id,
        placa: linkedMachinery?.licensePlateOrSerial,
        veiculo_nome: vehicleLabel,
        custo_dre: custoDRE,
      }, activeTenantId);

      // 5. REGRA DE NEGÓCIO 2: Lançamento no DRE do Veículo / DRE Geral da Empresa
      const expenseEntry: Expense = {
        id: payableId,
        companyId: activeTenantId,
        description: linkedMachinery
          ? `Acerto Rescisório - ${t.employeeName} | Tipo: ${reasonLabel} | DRE Veículo: ${vehicleLabel}`
          : `Acerto Rescisório - ${t.employeeName} | Tipo: ${reasonLabel} | Custos Administrativos / Pessoal`,
        amount: netVal,
        dreGrossAmount: custoDRE,
        dreCategory: linkedMachinery
          ? 'Despesa Operacional de Mão de Obra/Pessoal'
          : 'Custos Administrativos / Pessoal',
        competenceMonth: compMonthIso,
        categoryId: linkedMachinery ? 'cat_mao_de_obra' : 'cat_administrativo',
        categoryName: linkedMachinery
          ? 'Despesas com Pessoal / Rescisões Contratuais'
          : 'Custos Administrativos / Pessoal',
        categoryColor: linkedMachinery ? '#0284c7' : '#64748b',
        dueDate: dueDateIso,
        date: t.terminationDate || `${compMonthIso}-01`,
        status: 'pendente',
        paymentMethod: 'pix',
        supplier: t.employeeName,
        employeeId: t.employeeId,
        employeeName: t.employeeName,
        machineryId: linkedMachinery?.id,
        machineryName: vehicleLabel,
        costCenterName: linkedMachinery
          ? `DRE Veículo: ${vehicleLabel}`
          : 'Custos Administrativos / Pessoal',
        notes: linkedMachinery
          ? `Contas a Pagar: ${formatCurrencyBRL(netVal)} (Venc. ${formatDateBR(dueDateIso)}) • DRE Veículo: ${vehicleLabel} [${formatCurrencyBRL(custoDRE)} Bruto]`
          : `Contas a Pagar: ${formatCurrencyBRL(netVal)} (Venc. ${formatDateBR(dueDateIso)}) • DRE Geral Pessoal [${formatCurrencyBRL(custoDRE)} Bruto]`,
        createdAt: new Date().toISOString(),
      };

      const storedExpenses = getStoredExpenses();
      const existingExpIdx = storedExpenses.findIndex(
        (e) => e.id === payableId || toValidUUID(e.id) === payableId
      );
      let updatedExpenses: Expense[];
      if (existingExpIdx >= 0) {
        updatedExpenses = storedExpenses.map((e, idx) =>
          idx === existingExpIdx ? { ...e, ...expenseEntry } : e
        );
      } else {
        updatedExpenses = [expenseEntry, ...storedExpenses];
      }
      saveStoredExpenses(updatedExpenses);
      if (isSupabaseConfigured) {
        saveCloudExpenses(updatedExpenses, activeTenantId).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent('silagem_expenses_updated', { detail: updatedExpenses }));

      // 6. FEEDBACK VISUAL E TRAVA DE SEGURANÇA:
      // Status da linha muda para "Integrado" e botão fica disabled para impedir duplicidade
      const updatedTerminations = terminations.map((item) => {
        if (toValidUUID(item.id) === canonicalId || item.id === t.id) {
          return {
            ...item,
            status: 'integrado' as const,
            isIntegrated: true,
            integratedAt: new Date().toISOString(),
            financePayableId: payableId,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      setTerminations(updatedTerminations);
      saveStoredTerminations(updatedTerminations);

      if (isSupabaseConfigured) {
        const updatedItem = updatedTerminations.find(item => toValidUUID(item.id) === canonicalId);
        if (updatedItem) {
          await upsertRhRescisaoRecord(updatedItem, activeTenantId).catch(() => {});
          await saveCloudTerminations(updatedTerminations, activeTenantId).catch(() => {});
          try {
            realtimeChannelRef.current?.send({
              type: 'broadcast',
              event: 'termination_mutation',
              payload: {
                tenantId: activeTenantId,
                senderId: clientInstanceIdRef.current,
                termination: updatedItem,
              },
            });
          } catch (_) {}
        }
      }

      // 7. Feedback visual de sucesso
      setIntegrationBanner({
        type: 'success',
        title: `Rescisão Integrada ao Financeiro: ${t.employeeName}`,
        details: linkedMachinery
          ? `Título de ${formatCurrencyBRL(netVal)} lançado no Contas a Pagar (vencimento em ${formatDateBR(dueDateIso)}) • Custo Bruto de ${formatCurrencyBRL(custoDRE)} lançado no DRE do Veículo [${vehicleLabel}].`
          : `Título de ${formatCurrencyBRL(netVal)} lançado no Contas a Pagar (vencimento em ${formatDateBR(dueDateIso)}) • Custo Bruto de ${formatCurrencyBRL(custoDRE)} lançado no DRE Geral sob Custos Administrativos / Pessoal.`,
      });
    } catch (err) {
      console.error('Erro na integração financeira da rescisão:', err);
      setIntegrationBanner({
        type: 'error',
        title: 'Erro na Integração Financeira',
        details: 'Não foi possível concluir o lançamento no Contas a Pagar do Supabase. Verifique a conexão e tente novamente.',
      });
    } finally {
      setIntegratingId(null);
    }
  };

  // Persistência: Concluir e salvar homologação definitiva via modal
  const handleSaveTermination = async (record: TerminationRecord, markInactive: boolean) => {
    const canonicalId = toValidUUID(record.id);
    const updatedRecord: TerminationRecord = {
      ...record,
      id: canonicalId,
      companyId: activeTenantId,
      status: 'homologado',
      markEmployeeInactive: markInactive,
      updatedAt: new Date().toISOString(),
    };

    const filteredOther = terminations.filter(
      (t) => !(t.employeeId === record.employeeId && t.status === 'rascunho') && toValidUUID(t.id) !== canonicalId
    );
    const nextList = [updatedRecord, ...filteredOther];

    setTerminations(nextList);
    saveStoredTerminations(nextList);

    if (isSupabaseConfigured) {
      await upsertRhRescisaoRecord(updatedRecord, activeTenantId).catch(() => {});
      await saveCloudTerminations(nextList, activeTenantId).catch(() => {});
      try {
        realtimeChannelRef.current?.send({
          type: 'broadcast',
          event: 'termination_mutation',
          payload: {
            tenantId: activeTenantId,
            senderId: clientInstanceIdRef.current,
            termination: updatedRecord,
          },
        });
      } catch (_) {}
    }

    if (markInactive && onSaveEmployees) {
      const updatedEmployees = employees.map((emp) => {
        if (emp.id === record.employeeId) {
          return {
            ...emp,
            status: 'inativo' as const,
            active: false,
            terminationDate: record.terminationDate,
          };
        }
        return emp;
      });
      onSaveEmployees(updatedEmployees);
    }

    setViewingTRCT(updatedRecord);
  };

  // Persistência: Salvar Rascunho (Em Andamento)
  const handleSaveDraft = async (record: TerminationRecord) => {
    const canonicalId = toValidUUID(record.id);
    const draftRecord: TerminationRecord = {
      ...record,
      id: canonicalId,
      companyId: activeTenantId,
      status: 'rascunho',
      markEmployeeInactive: false,
      updatedAt: new Date().toISOString(),
    };

    const filteredOther = terminations.filter((t) => toValidUUID(t.id) !== canonicalId);
    const nextList = [draftRecord, ...filteredOther];

    setTerminations(nextList);
    saveStoredTerminations(nextList);

    if (isSupabaseConfigured) {
      await upsertRhRescisaoRecord(draftRecord, activeTenantId).catch(() => {});
      await saveCloudTerminations(nextList, activeTenantId).catch(() => {});
      try {
        realtimeChannelRef.current?.send({
          type: 'broadcast',
          event: 'termination_mutation',
          payload: {
            tenantId: activeTenantId,
            senderId: clientInstanceIdRef.current,
            termination: draftRecord,
          },
        });
      } catch (_) {}
    }
  };

  // Excluir Rescisão ou Rascunho
  const handleDeleteTermination = async (id: string, empName: string) => {
    const targetItem = terminations.find((t) => t.id === id);
    const isDraft = targetItem?.status === 'rascunho';

    const isConfirmed = await confirm({
      title: isDraft ? 'Excluir Rascunho' : 'Excluir Rescisão',
      message: `Deseja realmente remover o ${isDraft ? 'rascunho em andamento' : 'registro de rescisão'} de "${empName}"?`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (isConfirmed) {
      const canonicalId = toValidUUID(id);
      const updated = terminations.filter((t) => toValidUUID(t.id) !== canonicalId);
      setTerminations(updated);
      saveStoredTerminations(updated);
      if (isSupabaseConfigured) {
        deleteRhRescisaoRecord(id, activeTenantId).catch(() => {});
        saveCloudTerminations(updated, activeTenantId).catch(() => {});
      }
    }
  };

  // Indicadores de Resumo (KPIs)
  const totalCount = terminations.length;
  const homologadosCount = terminations.filter((t) => t.status === 'homologado').length;
  const integradosCount = terminations.filter((t) => t.status === 'integrado' || Boolean(t.isIntegrated)).length;
  const rascunhosCount = terminations.filter((t) => t.status === 'rascunho').length;
  const totalNetLiquido = terminations.reduce((sum, t) => sum + (t.calculation?.netTotal || 0), 0);

  // Filtragem e Busca
  const filteredTerminations = useMemo(() => {
    return terminations.filter((item) => {
      // Filtro de Status
      if (statusFilter === 'homologado') {
        if (item.status === 'rascunho') return false;
      } else if (statusFilter === 'integrado') {
        if (item.status !== 'integrado' && !item.isIntegrated) return false;
      } else if (statusFilter === 'rascunho') {
        if (item.status !== 'rascunho') return false;
      }

      // Busca por termo
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const empName = (item.employeeName || '').toLowerCase();
      const role = (item.employeeRole || '').toLowerCase();
      const reasonLabel = getReasonLabel(item.reason).toLowerCase();
      return empName.includes(term) || role.includes(term) || reasonLabel.includes(term);
    });
  }, [terminations, statusFilter, searchTerm]);

  return (
    <div className="w-full space-y-4 antialiased">
      
      {/* Banner de Feedback da Integração Financeira */}
      {integrationBanner && (
        <div
          className={`p-3 rounded-xl border flex items-start justify-between gap-3 shadow-xs animate-in fade-in duration-200 ${
            integrationBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {integrationBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <span className="font-bold block">{integrationBanner.title}</span>
              <span className="text-[11px] opacity-90 block mt-0.5">{integrationBanner.details}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIntegrationBanner(null)}
            className="p-1 hover:opacity-75 transition cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. TOPO DA PÁGINA: Cabeçalho com Título & Botão de Ação Primário "+ Nova Rescisão" */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-black dark:text-white">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-100/70 dark:bg-stone-800 border border-blue-200/80 dark:border-stone-700 text-black dark:text-white">
            <Scale className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-black dark:text-white tracking-tight">
              Gestão de Rescisões Contratuais CLT
            </h2>
            <p className="text-xs text-black/85 dark:text-stone-300 font-medium">
              Controle de desligamentos, cálculo oficial de verbas rescisórias, integração financeira e emissão de TRCT
            </p>
          </div>
        </div>

        {/* Botão de Ação Primário Destacado em Verde "+ Nova Rescisão" */}
        <button
          type="button"
          onClick={handleOpenNewTermination}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs sm:text-sm rounded-xl transition shadow-xs cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Nova Rescisão</span>
        </button>
      </div>

      {/* 2. KPIs de Resumo Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs text-black dark:text-white">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-black dark:text-stone-300 block">
            Total de Rescisões
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black font-['Outfit']">{totalCount}</span>
            <span className="text-xs font-bold text-black/70 dark:text-stone-400">registro(s)</span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs text-black dark:text-white">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-emerald-950 dark:text-emerald-400 block">
            Homologadas / Integradas
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black font-['Outfit'] text-emerald-900 dark:text-emerald-400">
              {homologadosCount + integradosCount}
            </span>
            <span className="text-xs font-bold text-black/70 dark:text-stone-400">
              {integradosCount > 0 ? `(${integradosCount} integradas)` : 'concluída(s)'}
            </span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs text-black dark:text-white">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-amber-950 dark:text-amber-400 block">
            Em Andamento
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black font-['Outfit'] text-amber-900 dark:text-amber-400">
              {rascunhosCount}
            </span>
            <span className="text-xs font-bold text-black/70 dark:text-stone-400">rascunho(s)</span>
          </div>
        </div>

        <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-3 shadow-xs text-black dark:text-white">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-black dark:text-stone-300 block">
            Valor Líquido Total
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-black font-['Outfit'] text-emerald-950 dark:text-emerald-400">
              {formatMoneyBRL(totalNetLiquido)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Barra de Busca e Filtros de Status */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-black dark:text-white">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-black/60 dark:text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por colaborador, cargo ou motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-blue-300 dark:border-stone-700 rounded-lg bg-blue-100/50 dark:bg-stone-800 text-black dark:text-white placeholder-black/60 dark:placeholder-stone-400 outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-stone-900'
                : 'bg-blue-100/60 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-200/60'
            }`}
          >
            Todos ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('homologado')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'homologado'
                ? 'bg-emerald-700 text-white dark:bg-emerald-600'
                : 'bg-blue-100/60 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-200/60'
            }`}
          >
            Homologados ({homologadosCount + integradosCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('integrado')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'integrado'
                ? 'bg-blue-700 text-white dark:bg-blue-600'
                : 'bg-blue-100/60 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-200/60'
            }`}
          >
            Integrados ({integradosCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rascunho')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'rascunho'
                ? 'bg-amber-600 text-white dark:bg-amber-500'
                : 'bg-blue-100/60 dark:bg-stone-800 text-black dark:text-stone-300 hover:bg-blue-200/60'
            }`}
          >
            Rascunhos ({rascunhosCount})
          </button>
        </div>
      </div>

      {/* 4. TABELA DE HISTÓRICO DE RESCISÕES */}
      <div className="crm-card bg-[#87AFE3] dark:bg-stone-900 border border-blue-200/80 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs text-black dark:text-white">
        {filteredTerminations.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-3 bg-white/40 dark:bg-stone-900/40">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 dark:bg-stone-800 flex items-center justify-center text-slate-500 dark:text-stone-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-black dark:text-white">
                Nenhum registro de rescisão encontrado
              </p>
              <p className="text-xs text-black/70 dark:text-stone-400 mt-0.5">
                {searchTerm || statusFilter !== 'all'
                  ? 'Nenhum resultado corresponde aos filtros selecionados.'
                  : 'Clique no botão abaixo para simular, calcular e emitir a primeira rescisão.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewTermination}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Rescisão</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-blue-100/60 dark:bg-stone-800 text-[11px] font-black text-black dark:text-white uppercase tracking-wider border-b border-blue-200/80 dark:border-stone-700">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Colaborador (Nome e Cargo)</th>
                  <th className="py-2.5 px-3">Data de Admissão</th>
                  <th className="py-2.5 px-3">Data de Desligamento</th>
                  <th className="py-2.5 px-3">Tipo de Rescisão</th>
                  <th className="py-2.5 px-3 text-right">Valor Líquido Rescisório (R$)</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200/60 dark:divide-stone-800 bg-[#87AFE3] dark:bg-stone-900 font-medium">
                {filteredTerminations.map((t) => (
                  <tr key={t.id || t.employeeId} className="hover:bg-blue-200/40 dark:hover:bg-stone-800/60 transition">
                    
                    {/* Status: Integrado / Em Andamento / Homologado */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {t.isIntegrated || t.status === 'integrado' ? (
                        <span
                          className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-blue-100 dark:bg-blue-950/70 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-300 shadow-2xs"
                          title="Lançado e integrado ao Contas a Pagar e DRE"
                        >
                          <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <span>Integrado</span>
                        </span>
                      ) : t.status === 'rascunho' ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 shadow-2xs">
                          <Clock className="w-3 h-3" />
                          <span>Em Andamento</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-300 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Homologado</span>
                        </span>
                      )}
                    </td>

                    {/* Colaborador (Nome e Cargo) */}
                    <td className="py-2.5 px-3">
                      <div className="font-black text-black dark:text-white text-xs">
                        {t.employeeName}
                      </div>
                      <div className="text-[11px] text-black/75 dark:text-stone-300">
                        {t.employeeRole || 'Colaborador'}
                      </div>
                    </td>

                    {/* Data de Admissão */}
                    <td className="py-2.5 px-3 text-black dark:text-stone-200 whitespace-nowrap">
                      {formatEmployeeAdmissionDate(t.admissionDate)}
                    </td>

                    {/* Data de Desligamento */}
                    <td className="py-2.5 px-3 font-semibold text-black dark:text-white whitespace-nowrap">
                      {formatDateBR(t.terminationDate)}
                    </td>

                    {/* Tipo de Rescisão */}
                    <td className="py-2.5 px-3 max-w-[200px] truncate text-black dark:text-stone-200" title={getReasonLabel(t.reason)}>
                      {getReasonLabel(t.reason)}
                    </td>

                    {/* Valor Líquido Rescisório (R$) */}
                    <td className="py-2.5 px-3 text-right font-black text-emerald-950 dark:text-emerald-400 whitespace-nowrap text-xs font-['Outfit']">
                      {formatMoneyBRL(t.calculation?.netTotal ?? 0)}
                    </td>

                    {/* Coluna de Ações:
                        1. Botão Fechamento Financeiro (ao lado do Visualizar/Editar e antes de Imprimir TRCT)
                        2. Botão Visualizar/Editar
                        3. Botão Imprimir TRCT (PDF)
                        4. Botão Excluir
                    */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1.5">
                        
                        {/* 1. Botão de Integração Financeira (ao lado de Visualizar/Editar e antes de Imprimir TRCT) */}
                        <button
                          type="button"
                          onClick={() => handleIntegrarRescisaoFinanceiro(t)}
                          disabled={t.isIntegrated || t.status === 'integrado' || integratingId === t.id}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-2xs ${
                            t.isIntegrated || t.status === 'integrado'
                              ? 'bg-blue-100/60 dark:bg-blue-950/40 text-blue-400 dark:text-blue-500 border border-blue-200 dark:border-blue-900 opacity-60 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer active:scale-95'
                          }`}
                          title={
                            t.isIntegrated || t.status === 'integrado'
                              ? 'Rescisão já integrada ao Contas a Pagar e DRE do Veículo'
                              : 'Enviar para Contas a Pagar e DRE do Veículo'
                          }
                        >
                          {integratingId === t.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : t.isIntegrated || t.status === 'integrado' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          ) : (
                            <svg
                              className="w-3.5 h-3.5 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                              <polyline points="16 6 12 2 8 6" />
                              <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                          )}
                          <span className="hidden sm:inline">
                            {t.isIntegrated || t.status === 'integrado' ? 'Integrado' : 'Integrar'}
                          </span>
                        </button>

                        {/* 2. Botão Visualizar/Editar */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditTermination(t)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white/70 hover:bg-white dark:bg-stone-800 dark:hover:bg-stone-700 text-slate-800 dark:text-stone-200 border border-slate-300 dark:border-stone-700 rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                          title="Visualizar e Editar Parâmetros da Rescisão"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="hidden sm:inline">Visualizar/Editar</span>
                        </button>

                        {/* 3. Botão Imprimir TRCT (PDF) */}
                        <button
                          type="button"
                          onClick={() => setViewingTRCT(t)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition shadow-2xs cursor-pointer active:scale-95"
                          title="Imprimir Termo de Rescisão do Contrato de Trabalho (PDF)"
                        >
                          <Printer className="w-3.5 h-3.5 text-white" />
                          <span className="hidden sm:inline">Imprimir TRCT</span>
                        </button>

                        {/* 4. Botão Excluir */}
                        <button
                          type="button"
                          onClick={() => handleDeleteTermination(t.id, t.employeeName)}
                          className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-100/60 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
                          title="Excluir do Histórico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL DE CÁLCULO DE RESCISÃO ('ResignCalculationModal')                  */}
      {/* Inicia obrigatoriamente fechado (isOpen: false) e abre via "+ Nova Rescisão" */}
      {/* ========================================================================= */}
      <ResignCalculationModal
        isOpen={isCalculationModalOpen}
        onClose={() => {
          setIsCalculationModalOpen(false);
          setEditingTermination(null);
        }}
        employees={employees}
        vacations={vacations}
        companyProfile={companyProfile}
        advances={advances}
        absences={absences}
        initialTermination={editingTermination}
        activeTenantId={activeTenantId}
        onSaveTermination={handleSaveTermination}
        onSaveDraft={handleSaveDraft}
        onViewTRCT={(rec) => setViewingTRCT(rec)}
      />

      {/* ========================================================================= */}
      {/* 6. MODAL DE IMPRESSÃO DO TERMO DE RESCISÃO (TRCT OFICIAL CLT)             */}
      {/* ========================================================================= */}
      {viewingTRCT && (
        <div className="modal-trct trct-modal-container fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="modal-trct trct-modal-wrapper bg-white text-black w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-auto border border-slate-200 print:shadow-none print:border-none print:m-0 print:rounded-none">
            
            {/* Barra Superior com Controles */}
            <div className="no-print header-modal-trct bg-slate-900 text-white p-3 sm:p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-black">
                  Termo de Rescisão do Contrato de Trabalho (TRCT)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintTRCTIsolated}
                  className="btn-print-action px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs relative z-20 pointer-events-auto"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (viewingTRCT && isSupabaseConfigured) {
                      upsertRhRescisaoRecord(viewingTRCT, activeTenantId).catch(() => {});
                    }
                    setViewingTRCT(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Documento Imprimível A4 */}
            <div id="trct-print-area" className="modal-trct trct-print-document p-6 sm:p-8 space-y-3 text-xs font-sans bg-white print:p-0 print:space-y-1.5">
              
              {/* Cabeçalho da Empresa */}
              <div className="block-rescisao trct-avoid-break flex items-start justify-between border-b-2 border-black pb-2.5 gap-3 print:pb-1.5">
                <div className="flex items-center gap-3">
                  {companyProfile?.logoUrl ? (
                    <img 
                      src={companyProfile.logoUrl} 
                      alt="Logo" 
                      className="h-12 w-auto max-w-[110px] object-contain print:h-10" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-2 border-2 border-black font-black text-sm tracking-tighter print:p-1.5">
                      {companyProfile?.tradeName || companyProfile?.corporateName || 'EMPRESA'}
                    </div>
                  )}
                  <div>
                    <h1 className="font-black text-sm sm:text-base uppercase tracking-tight text-black print:text-sm">
                      {companyProfile?.corporateName || companyProfile?.tradeName || 'Razão Social da Empresa'}
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-700 print:text-black print:text-[10px]">
                      CNPJ/CPF: {companyProfile?.cnpjCpf || companyProfile?.cnpj || 'Não informado'}
                    </p>
                    <p className="text-[10px] text-slate-600 print:text-black print:text-[9px]">
                      {[companyProfile?.address, companyProfile?.number, companyProfile?.neighborhood, companyProfile?.city, companyProfile?.state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {companyProfile?.phone && (
                      <p className="text-[10px] font-bold text-slate-800 print:text-black print:text-[9px] flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        {companyProfile.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-black text-xs sm:text-sm uppercase tracking-tight block border border-black px-2 py-1 bg-slate-100 print:bg-white text-black print:py-0.5">
                    TRCT - TERMO RESCISÓRIO
                  </span>
                  <span className="text-[10px] text-slate-600 print:text-black print:text-[9px] font-mono mt-0.5 block">
                    Emissão: {new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Dados do Contrato e Empregado */}
              <div className="block-rescisao trct-avoid-break border border-black p-2.5 rounded-md space-y-1.5 bg-slate-50/50 print:bg-white print:p-1.5">
                <div className="font-bold text-[11px] uppercase border-b border-black pb-1 text-black print:text-[10px] print:pb-0.5">
                  Identificação do Empregado e do Contrato de Trabalho
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:gap-1">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Nome do Empregado:</span>
                    <span className="font-bold text-xs text-black print:text-[10px]">{viewingTRCT.employeeName}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">CPF:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{formatCPF(viewingTRCT.employeeCpf)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Cargo / Função:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{viewingTRCT.employeeRole || 'Geral'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Salário Base:</span>
                    <span className="font-bold text-emerald-700 print:text-black print:text-[10px]">{formatMoneyBRL(viewingTRCT.baseSalary)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-black print:gap-1 print:pt-0.5">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Data Admissão:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{formatEmployeeAdmissionDate(viewingTRCT.admissionDate)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Data Afastamento:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{formatDateBR(viewingTRCT.terminationDate)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Aviso Prévio:</span>
                    <span className="font-semibold capitalize text-black print:text-[9.5px]">{viewingTRCT.noticeType} ({viewingTRCT.calculation?.noticeDays || 30} dias)</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-600 print:text-black print:text-[9px]">Causa do Afastamento:</span>
                    <span className="font-semibold text-black print:text-[9.5px]">{getReasonLabel(viewingTRCT.reason)}</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Verbas Rescisórias (Proventos) */}
              <div className="block-rescisao trct-avoid-break border border-black rounded-md overflow-hidden">
                <div className="bg-slate-200 print:bg-slate-100 font-black text-[11px] uppercase p-1.5 border-b border-black text-black print:text-[10px] print:py-0.5">
                  Discriminação das Verbas Rescisórias (Proventos)
                </div>
                <table className="w-full text-left text-[11px] border-collapse print:text-[10px]">
                  <thead>
                    <tr className="border-b border-black bg-slate-50 print:bg-white font-bold text-black">
                      <th className="py-1 px-2 w-16 border-r border-black/30 print:py-0.5">Rubrica</th>
                      <th className="py-1 px-2 border-r border-black/30 print:py-0.5">Descrição</th>
                      <th className="py-1 px-2 w-28 text-center border-r border-black/30 print:py-0.5">Referência</th>
                      <th className="py-1 px-2 text-right w-28 print:py-0.5">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/20 text-black">
                    <tr>
                      <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">01</td>
                      <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Saldo de Salário</td>
                      <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation?.workedDaysCurrentMonth || 0} dias</td>
                      <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.salaryBalance || 0)}</td>
                    </tr>
                    {(viewingTRCT.calculation?.noticeAmount || 0) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">02</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Aviso Prévio Indenizado</td>
                        <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation?.noticeDays || 30} dias</td>
                        <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.noticeAmount || 0)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">03</td>
                      <td className="py-1 px-2 border-r border-black/20 print:py-0.5">13º Salário Proporcional</td>
                      <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation?.thirteenthProportionalMonths || 0}/12 avos</td>
                      <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.thirteenthProportionalAmount || 0)}</td>
                    </tr>
                    {(viewingTRCT.calculation?.vacationExpiredAmount || 0) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">04</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Férias Vencidas</td>
                        <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation?.vacationExpiredCount || 0} período(s)</td>
                        <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.vacationExpiredAmount || 0)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">05</td>
                      <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Férias Proporcionais</td>
                      <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">{viewingTRCT.calculation?.vacationProportionalMonths || 0}/12 avos</td>
                      <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.vacationProportionalAmount || 0)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">06</td>
                      <td className="py-1 px-2 border-r border-black/20 print:py-0.5">1/3 Constitucional sobre Férias</td>
                      <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">Art. 7º CF</td>
                      <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.vacationOneThirdBonus || 0)}</td>
                    </tr>
                    {viewingTRCT.calculation?.includeFgtsFine && (viewingTRCT.calculation?.fgtsFineAmount || 0) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">07</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Multa Rescisória FGTS ({viewingTRCT.calculation?.fgtsFineRate || 40}%):</td>
                        <td className="py-1 px-2 text-center border-r border-black/20 print:py-0.5">Art. 18 Lei 8.036</td>
                        <td className="py-1 px-2 text-right font-bold print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.fgtsFineAmount || 0)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 print:bg-white font-black border-t-2 border-black">
                      <td colSpan={3} className="py-1 px-2 text-right text-black print:py-0.5">TOTAL BRUTO DOS PROVENTOS:</td>
                      <td className="py-1 px-2 text-right text-emerald-800 print:text-black font-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.grossTotal || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tabela de Deduções */}
              <div className="block-rescisao trct-avoid-break border border-black rounded-md overflow-hidden">
                <div className="bg-slate-200 print:bg-slate-100 font-black text-[11px] uppercase p-1.5 border-b border-black text-black print:text-[10px] print:py-0.5">
                  Deduções e Descontos Rescisórios
                </div>
                <table className="w-full text-left text-[11px] border-collapse print:text-[10px]">
                  <thead>
                    <tr className="border-b border-black bg-slate-50 print:bg-white font-bold text-black">
                      <th className="py-1 px-2 w-16 border-r border-black/30 print:py-0.5">Rubrica</th>
                      <th className="py-1 px-2 border-r border-black/30 print:py-0.5">Descrição</th>
                      <th className="py-1 px-2 text-right w-28 print:py-0.5">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/20 text-black">
                    {viewingTRCT.calculation?.includeInssDiscount !== false ? (
                      <>
                        <tr>
                          <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">101</td>
                          <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Previdência Social (INSS Saldo de Salário)</td>
                          <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.inssSalaryBalance || 0)}</td>
                        </tr>
                        {(viewingTRCT.calculation?.inssThirteenth || 0) > 0 && (
                          <tr>
                            <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">102</td>
                            <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Previdência Social (INSS sobre 13º Salário)</td>
                            <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.inssThirteenth || 0)}</td>
                          </tr>
                        )}
                      </>
                    ) : (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">101</td>
                        <td className="py-1 px-2 text-slate-500 print:text-black italic border-r border-black/20 print:py-0.5">Previdência Social (INSS) - Desconto Desativado / Isento</td>
                        <td className="py-1 px-2 text-right font-bold text-slate-500 print:text-black print:py-0.5">R$ 0,00</td>
                      </tr>
                    )}
                    {(viewingTRCT.calculation?.advancesDiscount || 0) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">103</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Vales e Adiantamentos Salariais em Aberto</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.advancesDiscount || 0)}</td>
                      </tr>
                    )}
                    {(viewingTRCT.calculation?.absenceDiscount || 0) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">104</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Faltas e Atrasos Injustificados</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.absenceDiscount || 0)}</td>
                      </tr>
                    )}
                    {(viewingTRCT.calculation?.noticeDeduction || 0) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">105</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Aviso Prévio Não Cumprido (Desconto Art. 487 CLT)</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.noticeDeduction || 0)}</td>
                      </tr>
                    )}
                    {(viewingTRCT.calculation?.otherDeductions || 0) > 0 && (
                      <tr>
                        <td className="py-1 px-2 font-mono border-r border-black/20 print:py-0.5">106</td>
                        <td className="py-1 px-2 border-r border-black/20 print:py-0.5">Outras Deduções Autorizadas</td>
                        <td className="py-1 px-2 text-right font-bold text-rose-700 print:text-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.otherDeductions || 0)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 print:bg-white font-black border-t-2 border-black">
                      <td colSpan={2} className="py-1 px-2 text-right text-black print:py-0.5">TOTAL GERAL DAS DEDUÇÕES:</td>
                      <td className="py-1 px-2 text-right text-rose-800 print:text-black font-black print:py-0.5">{formatMoneyBRL(viewingTRCT.calculation?.totalDeductions || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Quadro Resumo com Líquido e Multa FGTS + QR Code PIX */}
              <div className="block-rescisao trct-avoid-break border-2 border-black p-2.5 rounded-md bg-slate-50 print:bg-white print:p-1.5 flex flex-row items-center justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 print:text-black block uppercase print:text-[9px]">Multa Rescisória FGTS ({viewingTRCT.calculation?.fgtsFineRate || 40}%):</span>
                    <span className="text-sm font-bold text-black print:text-xs">
                      {formatMoneyBRL(viewingTRCT.calculation?.fgtsFineAmount || 0)}
                    </span>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-black text-slate-600 print:text-black block uppercase print:text-[9px]">VALOR LÍQUIDO A RECEBER:</span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-800 print:text-black print:text-lg">
                      {formatMoneyBRL(viewingTRCT.calculation?.netTotal || 0)}
                    </span>
                  </div>
                </div>

                {trctPixKey ? (
                  <div className="shrink-0 pl-2 border-l border-black/20 self-center">
                    <PixQrCodeBlock
                      pixKey={trctPixKey}
                      amount={viewingTRCT.calculation?.netTotal || 0}
                      label="PIX para Verbas Rescisórias"
                      receiverName={viewingTRCT.employeeName}
                      city={companyProfile?.city || 'Brasil'}
                    />
                  </div>
                ) : null}
              </div>

              {/* Container de Quitação e Assinaturas */}
              <div className="block-rescisao trct-signature-block trct-avoid-break pt-1.5 space-y-2 print:pt-1 print:space-y-1.5">
                <p className="text-[9.5px] text-slate-700 print:text-black text-justify leading-relaxed print:text-[8.5px] print:leading-tight m-0">
                  Foi prestada, sem ônus para o empregado, a assistência e conferência da presente rescisão contratual, tendo o colaborador recebido os valores líquidos discriminados acima, dando plena e geral quitação das parcelas expressamente consignadas neste termo.
                </p>

                <div className="pt-4 pb-2 grid grid-cols-2 gap-8 text-center text-xs print:pt-3 print:gap-6 print:pb-0">
                  <div className="trct-signature-box border-t-2 border-black pt-1.5 flex flex-col items-center justify-center text-center">
                    <span className="font-bold uppercase text-black block text-[11px] leading-normal print:text-[9.5px] max-w-[90%] truncate">
                      {companyProfile?.tradeName || companyProfile?.corporateName || 'Empregador'}
                    </span>
                    <span className="text-[9.5px] text-slate-600 print:text-black mt-0.5 block font-medium print:text-[8px]">
                      Assinatura do Empregador / Responsável
                    </span>
                  </div>

                  <div className="trct-signature-box border-t-2 border-black pt-1.5 flex flex-col items-center justify-center text-center">
                    <span className="font-bold uppercase text-black block text-[11px] leading-normal print:text-[9.5px] max-w-[90%] truncate">
                      {viewingTRCT.employeeName}
                    </span>
                    <span className="text-[9.5px] text-slate-600 print:text-black mt-0.5 block font-medium print:text-[8px]">
                      Assinatura do Empregado / Colaborador
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
