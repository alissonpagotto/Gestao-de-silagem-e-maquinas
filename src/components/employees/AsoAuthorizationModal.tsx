import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  Clock,
  FileCheck2,
  Loader2,
  MapPin,
  Phone,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import { Employee, Supplier } from '../../types';
import { getCompanyFornecedores, getStoredSuppliers } from '../../lib/storage';
import { getEmployeeBadgeNumber } from '../rh/badgeHelpers';
import {
  ASO_EXAM_OPTIONS,
  ASO_EXAM_PURPOSES,
  AsoExamPurpose,
  AsoGuidePayload,
  formatSupplierFullAddress,
  getDefaultSelectedAsoExams,
  isDriverOrOperatorRole,
} from './asoGuideUtils';

interface AsoAuthorizationModalProps {
  isOpen: boolean;
  employee: Employee | null;
  employeeSeqIndex: number;
  companyId?: string;
  onClose: () => void;
  onGenerate: (payload: AsoGuidePayload) => Promise<void> | void;
}

const MANUAL_CLINIC_OPTION = '__MANUAL__';

export const AsoAuthorizationModal: React.FC<AsoAuthorizationModalProps> = ({
  isOpen,
  employee,
  employeeSeqIndex,
  companyId,
  onClose,
  onGenerate,
}) => {
  const [purpose, setPurpose] = useState<AsoExamPurpose>('Admissional (Contratação)');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Campos manuais quando "Outro / Digitar Manualmente" está selecionado
  const [manualName, setManualName] = useState('');
  const [manualCnpj, setManualCnpj] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  // Agendamento opcional
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Lista de exames
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>(['aso_clinico']);
  const [customNotes, setCustomNotes] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Carrega fornecedores do storage e inicializa padrões inteligentes ao abrir para um funcionário
  useEffect(() => {
    if (!isOpen || !employee) return;

    const loadedSuppliers = (() => {
      const scoped = companyId ? getCompanyFornecedores(companyId) : [];
      if (Array.isArray(scoped) && scoped.length > 0) return scoped;
      return getStoredSuppliers();
    })();

    // Ordena priorizando clínicas / laboratórios / saúde médica no topo da lista
    const sortedSuppliers = [...(Array.isArray(loadedSuppliers) ? loadedSuppliers : [])].sort((a, b) => {
      const score = (s: Supplier) => {
        const hay = `${s.category || ''} ${s.name || ''} ${s.tradeName || ''}`.toLowerCase();
        return /clin|clín|lab|medic|médic|saude|saúde|aso|ocupacional|odonto/.test(hay) ? 0 : 1;
      };
      const diff = score(a) - score(b);
      if (diff !== 0) return diff;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });

    setSuppliers(sortedSuppliers);
    setSupplierSearch('');
    setPurpose('Admissional (Contratação)');

    const firstClinic = sortedSuppliers.find((s) => {
      const hay = `${s.category || ''} ${s.name || ''} ${s.tradeName || ''}`.toLowerCase();
      return /clin|clín|lab|medic|médic|saude|saúde|aso|ocupacional/.test(hay);
    });
    if (firstClinic) {
      setSelectedSupplierId(firstClinic.id);
    } else if (sortedSuppliers.length > 0) {
      setSelectedSupplierId(sortedSuppliers[0].id);
    } else {
      setSelectedSupplierId(MANUAL_CLINIC_OPTION);
    }

    setManualName('');
    setManualCnpj('');
    setManualAddress('');
    setManualPhone('');
    setScheduledDate('');
    setScheduledTime('');
    setSelectedExamIds(getDefaultSelectedAsoExams(employee));
    setCustomNotes('');
    setValidationError(null);
    setIsGenerating(false);
  }, [isOpen, employee, companyId]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      const text = `${s.name || ''} ${s.tradeName || ''} ${s.category || ''} ${s.cnpjOrCpf || ''} ${s.city || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [suppliers, supplierSearch]);

  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId || selectedSupplierId === MANUAL_CLINIC_OPTION) return null;
    return suppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  const isManualMode = selectedSupplierId === MANUAL_CLINIC_OPTION || !selectedSupplier;

  if (!isOpen || !employee) return null;

  const badgeNumber = getEmployeeBadgeNumber(employee, employeeSeqIndex);
  const driverOrOpAutoToxic = isDriverOrOperatorRole(employee);

  const toggleExam = (examId: string) => {
    setValidationError(null);
    setSelectedExamIds((prev) =>
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (isManualMode && !manualName.trim()) {
      setValidationError('Informe o nome da Clínica / Laboratório autorizado ou selecione um Fornecedor cadastrado.');
      return;
    }

    if (selectedExamIds.length === 0 && !customNotes.trim()) {
      setValidationError('Selecione pelo menos um exame autorizado ou preencha o campo de Outros Exames / Observações.');
      return;
    }

    const payload: AsoGuidePayload = {
      purpose,
      clinic: isManualMode
        ? {
            isManual: true,
            name: manualName.trim(),
            cnpj: manualCnpj.trim() || undefined,
            address: manualAddress.trim() || undefined,
            phone: manualPhone.trim() || undefined,
          }
        : {
            supplierId: selectedSupplier!.id,
            isManual: false,
            name: selectedSupplier!.tradeName || selectedSupplier!.name,
            cnpj: selectedSupplier!.cnpjOrCpf || undefined,
            address: formatSupplierFullAddress(selectedSupplier!) || undefined,
            phone: selectedSupplier!.phone || undefined,
          },
      scheduledDate: scheduledDate || undefined,
      scheduledTime: scheduledTime || undefined,
      selectedExamIds,
      customNotes: customNotes.trim() || undefined,
      badgeNumber,
    };

    setIsGenerating(true);
    try {
      await onGenerate(payload);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-[#cad4e6] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[93vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Oficial AgroControl */}
        <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-800 border border-gray-400 dark:border-stone-700 flex items-center justify-center shadow-2xs shrink-0">
              <Stethoscope className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black dark:text-stone-100 truncate">
                AUTORIZAÇÃO DE EXAMES MÉDICOS (ASO)
              </h3>
              <p className="text-[11px] text-stone-800 dark:text-stone-300 font-semibold truncate">
                {employee.name} • Reg. Crachá: <span className="font-mono font-black">{badgeNumber}</span>
                {employee.role ? ` • ${employee.role}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/80 hover:bg-white border border-gray-400 text-black transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo com 2 Cards Internos (#e0e6f1 + border-black) */}
        <form
          id="aso-authorization-form"
          onSubmit={handleSubmit}
          className="p-4 space-y-3 overflow-y-auto flex-1 bg-[#cad4e6] dark:bg-stone-950"
        >
          {validationError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-500 text-rose-900 text-xs font-bold">
              {validationError}
            </div>
          )}

          {/* CARD 1: Tipo de Exame e Clínica / Laboratório Conveniado */}
          <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-400/70 pb-1.5">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-slate-800 dark:text-stone-200" />
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-black dark:text-stone-100">
                  1. Tipo de Exame e Clínica / Laboratório Conveniado
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-700 uppercase">
                Integração Fornecedores
              </span>
            </div>

            {/* Finalidade do Exame */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-black dark:text-stone-200 mb-1">
                  Finalidade do Exame *
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as AsoExamPurpose)}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {ASO_EXAM_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Agendamento Opcional (Data e Hora) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-black dark:text-stone-200 mb-1">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Data Agendamento
                    </span>
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-semibold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-black dark:text-stone-200 mb-1">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Hora (Opcional)
                    </span>
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-semibold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Seletor de Clínica / Laboratório Autorizado */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <label className="text-[11px] font-bold uppercase text-black dark:text-stone-200">
                  Clínica / Laboratório Autorizado (Fornecedor) *
                </label>
                {suppliers.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      placeholder="Filtrar fornecedor / clínica..."
                      className="w-full pl-7 pr-2.5 py-1 bg-white dark:bg-stone-800 border border-slate-400 rounded-md text-[11px] text-black dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>
                )}
              </div>

              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setValidationError(null);
                  setSelectedSupplierId(e.target.value);
                }}
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-bold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {filteredSuppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.tradeName || sup.name}
                    {sup.category ? ` (${sup.category})` : ''}
                    {sup.city ? ` — ${sup.city}${sup.state ? `/${sup.state}` : ''}` : ''}
                  </option>
                ))}
                <option value={MANUAL_CLINIC_OPTION}>
                  ✏️ Outro / Digitar Manualmente
                </option>
              </select>

              {/* Resumo automático do Endereço e Telefone do Fornecedor selecionado */}
              {selectedSupplier && selectedSupplierId !== MANUAL_CLINIC_OPTION && (
                <div className="bg-white dark:bg-stone-800 border border-slate-400 rounded-lg p-2.5 text-[11px] text-slate-800 dark:text-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      <strong className="uppercase">Endereço:</strong>{' '}
                      {formatSupplierFullAddress(selectedSupplier) || 'Não cadastrado no fornecedor'}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      <strong className="uppercase">Telefone:</strong>{' '}
                      {selectedSupplier.phone || 'Não cadastrado'}
                      {selectedSupplier.cnpjOrCpf ? ` • CNPJ: ${selectedSupplier.cnpjOrCpf}` : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Campos manuais se selecionou "Outro / Digitar Manualmente" */}
              {isManualMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-200 mb-0.5">
                      Nome / Razão Social da Clínica ou Laboratório *
                    </label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Ex: Clínica Ocupacional MedTrabalho Ltda"
                      className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-semibold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-200 mb-0.5">
                      CNPJ (Opcional)
                    </label>
                    <input
                      type="text"
                      value={manualCnpj}
                      onChange={(e) => setManualCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-semibold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-200 mb-0.5">
                      Telefone / WhatsApp (Opcional)
                    </label>
                    <input
                      type="text"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-semibold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-black dark:text-stone-200 mb-0.5">
                      Endereço Completo (Rua, Nº, Bairro, Cidade/UF)
                    </label>
                    <input
                      type="text"
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="Av. Brasil, nº 450 - Centro - Cidade/PR"
                      className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-semibold text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CARD 2: Lista de Exames Autorizados */}
          <div className="bg-[#e0e6f1] dark:bg-stone-900 border border-black dark:border-stone-700 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/70 pb-1.5">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-slate-800 dark:text-stone-200" />
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-black dark:text-stone-100">
                  2. Lista de Exames Autorizados
                </h4>
              </div>
              {driverOrOpAutoToxic && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-400">
                  Cargo Motorista/Operador: Toxicológico pré-marcado
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ASO_EXAM_OPTIONS.map((exam) => {
                const isChecked = selectedExamIds.includes(exam.id);
                return (
                  <label
                    key={exam.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition select-none ${
                      isChecked
                        ? 'bg-white border-emerald-700 ring-1 ring-emerald-600 text-black'
                        : 'bg-white/85 border-slate-400 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleExam(exam.id)}
                      className="sr-only"
                    />
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                        isChecked
                          ? 'bg-emerald-600 border-emerald-700 text-white'
                          : 'bg-white border-slate-500 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                    <span className="text-xs font-bold leading-tight">{exam.label}</span>
                  </label>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-black dark:text-stone-200 mb-1">
                Outros Exames / Observações Específicas
              </label>
              <input
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Ex: Espirometria, Avaliação Psicossocial, comparecer em jejum de 8h com CNH e CPF..."
                className="w-full px-3 py-2 bg-white dark:bg-stone-800 border border-slate-500 rounded-lg text-xs font-medium text-black dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </form>

        {/* Rodapé Oficial AgroControl */}
        <div className="px-4 py-3 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-400 bg-white hover:bg-gray-100 text-black text-xs font-bold uppercase transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="aso-authorization-form"
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-700 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>📄 Gerar Guia Oficial para Impressão</span>
          </button>
        </div>
      </div>
    </div>
  );
};
