import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  IdCard,
  Palette,
  Printer,
  Search,
  Square,
  Users,
} from 'lucide-react';
import { CompanyProfile, Employee } from '../../types';
import { EmployeeAvatar } from '../common/EmployeeAvatar';
import { getEmployeeBadgeNumber } from './badgeHelpers';
import { EmployeeBadgeCard } from './EmployeeBadgeCard';
import { EmployeeBadgeBackCard } from './EmployeeBadgeBackCard';
import { BadgeCustomizeModal } from './BadgeCustomizeModal';
import {
  BADGE_PAPER_OPTIONS,
  BADGE_PAPER_STORAGE_KEY,
  BadgePaperSize,
  BadgeThemeConfig,
  getBadgeDimensions,
  getStoredBadgePaperSize,
  getStoredBadgeTheme,
  isValidBadgePaperSize,
  saveStoredBadgePaperSize,
  saveStoredBadgeTheme,
} from './badgeTheme';
import { generateBadgesPrintHtml } from './badgePrintUtils';
import { getCachedMediaUrl, isIndexedDbRef, resolveMediaUrlAsync } from '../../lib/imageStorage';

interface CrachasTabProps {
  employees: Employee[];
  companyProfile?: CompanyProfile;
}

export const CrachasTab: React.FC<CrachasTabProps> = ({
  employees,
  companyProfile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    employees.length > 0 ? [employees[0].id] : []
  );
  const [badgeTheme, setBadgeTheme] = useState<BadgeThemeConfig>(() =>
    getStoredBadgeTheme()
  );
  const [paperSize, setPaperSize] = useState<BadgePaperSize>(() =>
    getStoredBadgePaperSize()
  );
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [selectionWarning, setSelectionWarning] = useState<string>('');

  const hasInitializedSelectionRef = useRef(employees.length > 0);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === BADGE_PAPER_STORAGE_KEY && isValidBadgePaperSize(e.newValue)) {
        setPaperSize(e.newValue);
      }
    };
    const handleMessage = (e: MessageEvent) => {
      if (
        e.data &&
        typeof e.data === 'object' &&
        e.data.type === 'agrocontrol_badge_paper_size' &&
        isValidBadgePaperSize(e.data.paperSize)
      ) {
        setPaperSize(e.data.paperSize);
        saveStoredBadgePaperSize(e.data.paperSize);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Mantém apenas IDs válidos caso a lista mude e auto-seleciona o primeiro apenas na carga inicial
  useEffect(() => {
    const validSet = new Set(employees.map((e) => e.id));
    if (!hasInitializedSelectionRef.current && employees.length > 0) {
      hasInitializedSelectionRef.current = true;
      setSelectedIds([employees[0].id]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => validSet.has(id)));
  }, [employees]);

  const employeesWithCodes = useMemo(() => {
    return employees.map((emp, idx) => ({
      employee: emp,
      regNumber: getEmployeeBadgeNumber(emp, idx + 1),
    }));
  }, [employees]);

  const filteredList = useMemo(() => {
    const term = String(searchTerm ?? '').trim().toLowerCase();
    if (!term) return employeesWithCodes;
    return employeesWithCodes.filter(({ employee, regNumber }) => {
      const name = String(employee.name ?? '').toLowerCase();
      const role = String(employee.role ?? '').toLowerCase();
      const cpf = String(employee.cpf ?? '').toLowerCase();
      return (
        name.includes(term) ||
        role.includes(term) ||
        cpf.includes(term) ||
        String(regNumber ?? '').toLowerCase().includes(term)
      );
    });
  }, [employeesWithCodes, searchTerm]);

  const selectedEntries = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return employeesWithCodes.filter(({ employee }) => selectedSet.has(employee.id));
  }, [employeesWithCodes, selectedIds]);

  const allFilteredSelected =
    filteredList.length > 0 &&
    filteredList.every(({ employee }) => selectedIds.includes(employee.id));

  const handleToggleOne = (id: string) => {
    setSelectionWarning('');
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    setSelectionWarning('');
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredList.map((item) => item.employee.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set(selectedIds);
      filteredList.forEach(({ employee }) => merged.add(employee.id));
      setSelectedIds(Array.from(merged));
    }
  };

  const companyDisplayName = useMemo(() => {
    const trade = (companyProfile?.tradeName || '').trim();
    const corp = (companyProfile?.corporateName || '').trim();
    return trade || corp || 'COLAÇA SILAGEM LTDA';
  }, [companyProfile]);

  const handleSaveTheme = (nextTheme: BadgeThemeConfig) => {
    setBadgeTheme(nextTheme);
    saveStoredBadgeTheme(nextTheme);
  };

  const handlePrintSelected = async () => {
    if (selectedEntries.length === 0) {
      setSelectionWarning('Selecione pelo menos um funcionário na lista à esquerda para imprimir.');
      return;
    }
    setSelectionWarning('');

    // Verifica se precisa buscar alguma imagem assincronamente no IndexedDB
    const needsAsyncResolution =
      (isIndexedDbRef(companyProfile?.logoUrl) && !getCachedMediaUrl(companyProfile?.logoUrl)) ||
      selectedEntries.some(({ employee }) => {
        const ref = employee.avatar_url || employee.foto || employee.foto_url || employee.photoUrl;
        return isIndexedDbRef(ref) && !getCachedMediaUrl(ref);
      });

    // Abre a janela antes de qualquer await para não acionar bloqueadores de pop-up
    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank', 'width=900,height=700');
    } catch (err) {
      console.warn('Falha ao abrir janela dedicada para impressão dos crachás:', err);
    }

    let resolvedLogoUrl = getCachedMediaUrl(companyProfile?.logoUrl) || companyProfile?.logoUrl;
    let resolvedEntries = selectedEntries;

    if (needsAsyncResolution) {
      const [logoDataUrl, entriesWithResolvedPhotos] = await Promise.all([
        resolveMediaUrlAsync(companyProfile?.logoUrl),
        Promise.all(
          selectedEntries.map(async ({ employee, regNumber }) => {
            const ref = employee.avatar_url || employee.foto || employee.foto_url || employee.photoUrl;
            const dataUrl = await resolveMediaUrlAsync(ref);
            return {
              regNumber,
              employee: {
                ...employee,
                avatar_url: dataUrl,
                photoUrl: dataUrl,
              },
            };
          })
        ),
      ]);
      resolvedLogoUrl = logoDataUrl;
      resolvedEntries = entriesWithResolvedPhotos;
    }

    const htmlDoc = generateBadgesPrintHtml(
      resolvedEntries,
      companyDisplayName,
      resolvedLogoUrl,
      badgeTheme,
      companyProfile,
      paperSize
    );

    // Abordagem 1: Janela dedicada via window.open('', '_blank') (funciona em iframes e qualquer navegador)
    try {
      if (printWindow && printWindow.document) {
        printWindow.document.open();
        printWindow.document.write(htmlDoc);
        printWindow.document.close();
        printWindow.focus();
        return;
      }
    } catch (err) {
      console.warn('Falha ao preencher janela dedicada para impressão dos crachás:', err);
    }

    // Abordagem 2 (Fallback caso bloqueador de pop-ups impeça window.open): Blob URL em nova guia ou iframe oculto
    try {
      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const blobWin = window.open(blobUrl, '_blank');
      if (blobWin) {
        blobWin.focus();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      }
      URL.revokeObjectURL(blobUrl);
    } catch (_) {}

    try {
      let iframe = document.getElementById('badges-print-fallback-iframe') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'badges-print-fallback-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlDoc);
        doc.close();
      }
    } catch (fallbackErr) {
      console.error('Erro no fallback de impressão dos crachás:', fallbackErr);
    }
  };

  const previewTarget = selectedEntries[0] || employeesWithCodes[0];
  const activeBadgeDims = getBadgeDimensions(badgeTheme.size);
  const activePaperOption = BADGE_PAPER_OPTIONS[paperSize];

  return (
    <div className="w-full max-w-none flex-1 min-h-0 h-full max-h-full flex flex-col gap-2.5 overflow-hidden">
      {/* Barra Superior Compacta em Linha Única: Título à Esquerda | Botões à Direita */}
      <div className="no-print shrink-0 bg-[#cad4e6] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-700 flex items-center justify-center shrink-0">
            <IdCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white leading-tight truncate">
              Emissão de Crachás com Código de Barras
            </h2>
            <p className="text-[11px] font-semibold text-slate-700 dark:text-stone-300 leading-tight truncate">
              {activeBadgeDims.label} (Code 128) • {selectedEntries.length} de {employees.length} colaborador(es) selecionado(s)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsCustomizeModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-400 shadow-2xs transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Palette className="w-3.5 h-3.5 text-slate-700" />
            <span>Personalizar Crachá</span>
          </button>

          <button
            type="button"
            onClick={handlePrintSelected}
            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-800 shadow-xs transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap ${
              selectedEntries.length === 0 ? 'opacity-80' : ''
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-white" />
            <span>
              Imprimir Crachá(s) Selecionado(s)
              {selectedEntries.length > 0 ? ` (${selectedEntries.length})` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* Alerta amigável quando usuário clicar em imprimir sem selecionar nenhum funcionário */}
      {selectionWarning && (
        <div className="no-print shrink-0 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-400 text-amber-950 text-xs font-bold shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{selectionWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectionWarning('')}
            className="text-[11px] font-bold underline hover:text-amber-800 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Layout Dividido (Split View): Seleção à Esquerda | Pré-visualização à Direita */}
      <div className="no-print flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        {/* PAINEL ESQUERDO: SELEÇÃO DE COLABORADORES */}
        <div className="lg:col-span-4 h-full min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-800 border border-black/25 dark:border-stone-700 rounded-xl p-3 gap-2.5 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 border-b border-black/15 dark:border-stone-700">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-800 dark:text-stone-200" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Colaboradores Ativos
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              disabled={filteredList.length === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-stone-900 border border-slate-400 dark:border-stone-600 hover:bg-slate-50 text-[11px] font-bold text-slate-900 dark:text-stone-200 transition cursor-pointer disabled:opacity-50"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Desmarcar Todos</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-500" />
                  <span>Selecionar Todos</span>
                </>
              )}
            </button>
          </div>

          {/* Barra de Busca Rápida */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, cargo, CPF ou registro..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 rounded-lg text-xs font-medium text-black dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Lista com Checkboxes */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1.5 pr-0.5">
            {filteredList.length === 0 ? (
              <div className="bg-white dark:bg-stone-900 border border-slate-300 dark:border-stone-700 rounded-lg p-6 text-center text-xs text-slate-500 font-medium">
                Nenhum colaborador ativo encontrado.
              </div>
            ) : (
              filteredList.map(({ employee, regNumber }) => {
                const isSelected = selectedIds.includes(employee.id);
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => handleToggleOne(employee.id)}
                    className={`w-full text-left flex items-center gap-2.5 p-2 rounded-lg border transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-600 shadow-2xs'
                        : 'bg-white dark:bg-stone-900 border-slate-300 dark:border-stone-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </span>

                    <EmployeeAvatar
                      name={employee.name}
                      photoUrl={employee.avatar_url || employee.foto || employee.foto_url || employee.photoUrl}
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white uppercase truncate">
                        {employee.name}
                      </div>
                      <div className="text-[10px] font-medium text-slate-600 dark:text-stone-400 truncate">
                        {(employee.role || 'Colaborador').split(',')[0].trim()}
                      </div>
                    </div>

                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                      {regNumber}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PAINEL DIREITO: PRÉ-VISUALIZAÇÃO REALISTA DOS CRACHÁS */}
        <div className="lg:col-span-8 h-full min-h-0 flex flex-col bg-[#e0e6f1] dark:bg-stone-800 border border-black/25 dark:border-stone-700 rounded-xl p-4 gap-3 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-2 pb-2 border-b border-black/15 dark:border-stone-700">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Pré-visualização do Crachá ({activeBadgeDims.shortLabel} • Frente &amp; Verso)
            </span>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-stone-300">
              {paperSize === 'pvc_card'
                ? `${activePaperOption.shortLabel} • 1 face por página (Pág. 1 Frente / Pág. 2 Verso)`
                : `${activePaperOption.shortLabel} • Frente & verso com espaço de recorte (8mm)`}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {selectedEntries.length === 0 ? (
              <div className="h-full min-h-[220px] bg-white/80 dark:bg-stone-900 border border-dashed border-slate-400 dark:border-stone-700 rounded-xl p-10 text-center flex flex-col items-center justify-center gap-2">
                <IdCard className="w-10 h-10 text-slate-400" />
                <div className="text-sm font-bold text-slate-800 dark:text-stone-200">
                  Nenhum colaborador selecionado
                </div>
                <p className="text-xs text-slate-600 dark:text-stone-400 max-w-md">
                  Marque um ou mais colaboradores na lista à esquerda para visualizar o crachá com código de barras Code 128 e liberar a impressão.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center sm:items-start gap-6 p-2">
                {selectedEntries.map(({ employee, regNumber }) => (
                  <div
                    key={`preview_${employee.id}`}
                    className="flex flex-col items-center gap-1.5 bg-white/60 dark:bg-stone-900/50 border border-black/15 dark:border-stone-700 rounded-xl p-3"
                  >
                    <div className="flex flex-wrap items-start justify-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-stone-300">
                          Frente
                        </span>
                        <EmployeeBadgeCard
                          employee={employee}
                          registrationNumber={regNumber}
                          companyName={companyDisplayName}
                          companyLogoUrl={companyProfile?.logoUrl}
                          theme={badgeTheme}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-stone-300">
                          Verso
                        </span>
                        <EmployeeBadgeBackCard
                          employee={employee}
                          companyName={companyDisplayName}
                          companyProfile={companyProfile}
                          theme={badgeTheme}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 dark:text-stone-300 uppercase tracking-wide mt-0.5">
                      REG {regNumber} • {activeBadgeDims.shortLabel} (Frente &amp; Verso)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BadgeCustomizeModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        currentTheme={badgeTheme}
        onSaveTheme={handleSaveTheme}
        previewEmployee={previewTarget?.employee}
        previewRegistrationNumber={previewTarget?.regNumber || '09101'}
        companyName={companyDisplayName}
        companyLogoUrl={companyProfile?.logoUrl}
        companyProfile={companyProfile}
      />
    </div>
  );
};
