import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import {
  INITIAL_SELF_TEST_STEPS,
  SelfTestStepResult,
  SelfTestReport,
  runFullSystemSelfTest,
  formatTechnicalSelfTestReport,
} from '../../lib/systemSelfTestEngine';

interface SystemSelfTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriberName: string;
}

export const SystemSelfTestModal: React.FC<SystemSelfTestModalProps> = ({
  isOpen,
  onClose,
  subscriberName,
}) => {
  const [steps, setSteps] = useState<SelfTestStepResult[]>(INITIAL_SELF_TEST_STEPS);
  const [report, setReport] = useState<SelfTestReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);

  const executeTests = useCallback(async () => {
    setIsRunning(true);
    setReport(null);
    setCopied(false);
    setExpandedStepIds(new Set());
    try {
      const finalReport = await runFullSystemSelfTest({
        subscriberName,
        onStepUpdate: (updatedSteps) => {
          setSteps(updatedSteps);
        },
      });
      setReport(finalReport);
      // Expande automaticamente qualquer teste que tenha falhado
      const failedIds = finalReport.steps
        .filter((s) => s.status === 'failed')
        .map((s) => s.id);
      if (failedIds.length > 0) {
        setExpandedStepIds(new Set(failedIds));
      }
    } finally {
      setIsRunning(false);
    }
  }, [subscriberName]);

  useEffect(() => {
    if (isOpen) {
      void executeTests();
    }
  }, [isOpen, executeTests]);

  const toggleExpand = (id: string) => {
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyReport = async () => {
    const activeReport: SelfTestReport = report || {
      executedAt: new Date().toLocaleString('pt-BR'),
      subscriberName,
      executedBy: 'OPERADOR',
      totalDurationMs: steps.reduce((acc, s) => acc + s.durationMs, 0),
      passedCount: steps.filter((s) => s.status === 'passed').length,
      failedCount: steps.filter((s) => s.status === 'failed').length,
      totalTests: steps.length,
      steps,
    };
    const text = formatTechnicalSelfTestReport(activeReport);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  if (!isOpen) return null;

  const passedCount = report
    ? report.passedCount
    : steps.filter((s) => s.status === 'passed').length;
  const failedCount = report
    ? report.failedCount
    : steps.filter((s) => s.status === 'failed').length;
  const totalTests = steps.length;
  const completedCount = steps.filter(
    (s) => s.status === 'passed' || s.status === 'failed'
  ).length;
  const progressPercent = Math.round((completedCount / Math.max(1, totalTests)) * 100);

  return (
    <div
      id="modal-auto-teste-sistema"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-3"
    >
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#e0e6f1] border border-black rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Cabeçalho */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-b border-black flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-700 border border-black flex items-center justify-center shrink-0">
              <Activity className={`w-4 h-4 text-white ${isRunning ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-black leading-tight">
                🩺 Auto-Teste Completo do Sistema (Health Check & Sandbox E2E)
              </h3>
              <p className="text-[11px] font-semibold text-slate-800">
                Validação sequencial em sandbox isolado — zero impacto nos dados reais de {subscriberName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="p-1 rounded hover:bg-black/10 text-black cursor-pointer disabled:opacity-40"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo Geral + Barra de Progresso */}
        <div className="p-3.5 space-y-3 overflow-y-auto flex-1">
          <div className="bg-[#cad4e6] border border-black rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-800 shrink-0" />
                <span className="text-xs font-black uppercase text-black">
                  {isRunning
                    ? `Executando bateria de testes (${completedCount}/${totalTests})...`
                    : failedCount === 0
                      ? `✅ Resultado Geral: ${passedCount} de ${totalTests} testes aprovados`
                      : `⚠️ Resultado Geral: ${passedCount} de ${totalTests} testes aprovados (${failedCount} com falha)`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-slate-900">
                {report && (
                  <span className="px-2 py-0.5 rounded bg-white border border-black">
                    Tempo total: {report.totalDurationMs} ms
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded border border-black font-black ${
                    isRunning
                      ? 'bg-indigo-100 text-indigo-900'
                      : failedCount === 0
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {passedCount} / {totalTests} APROVADOS
                </span>
              </div>
            </div>

            <div className="w-full h-2.5 bg-white border border-black rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  failedCount > 0
                    ? 'bg-amber-600'
                    : isRunning
                      ? 'bg-indigo-600'
                      : 'bg-emerald-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Lista Sequencial dos 5 Testes */}
          <div className="space-y-2">
            {steps.map((step) => {
              const isExpanded = expandedStepIds.has(step.id);
              const isPassed = step.status === 'passed';
              const isFailed = step.status === 'failed';
              const isStepRunning = step.status === 'running';

              return (
                <div
                  key={step.id}
                  className={`border border-black rounded-lg overflow-hidden transition ${
                    isFailed
                      ? 'bg-rose-50'
                      : isPassed
                        ? 'bg-white'
                        : isStepRunning
                          ? 'bg-indigo-50'
                          : 'bg-[#cad4e6]/60'
                  }`}
                >
                  <div
                    onClick={() => (step.details.length > 0 || step.errors.length > 0) && toggleExpand(step.id)}
                    className={`p-3 flex flex-wrap items-start justify-between gap-2 ${
                      step.details.length > 0 || step.errors.length > 0 ? 'cursor-pointer hover:bg-black/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {isPassed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        ) : isFailed ? (
                          <XCircle className="w-4 h-4 text-rose-700" />
                        ) : isStepRunning ? (
                          <RefreshCw className="w-4 h-4 text-indigo-700 animate-spin" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-black uppercase text-black">
                            {step.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase ${
                              isPassed
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-700'
                                : isFailed
                                  ? 'bg-rose-100 text-rose-900 border-rose-700'
                                  : isStepRunning
                                    ? 'bg-indigo-100 text-indigo-900 border-indigo-700'
                                    : 'bg-slate-200 text-slate-700 border-slate-500'
                            }`}
                          >
                            {isPassed
                              ? '✅ PASSOU'
                              : isFailed
                                ? '❌ FALHOU'
                                : isStepRunning
                                  ? '⏳ EXECUTANDO'
                                  : 'AGUARDANDO'}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                          {step.subtitle}
                        </p>
                        <p
                          className={`text-[11px] font-bold mt-1 ${
                            isFailed
                              ? 'text-rose-800'
                              : isPassed
                                ? 'text-emerald-900'
                                : 'text-indigo-900'
                          }`}
                        >
                          {step.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(isPassed || isFailed) && (
                        <span className="px-2 py-0.5 rounded bg-[#e0e6f1] border border-black font-mono text-[10px] font-black text-black">
                          {step.durationMs} ms • {step.checksPassed}/{step.checksTotal}
                        </span>
                      )}
                      {(step.details.length > 0 || step.errors.length > 0) && (
                        <span className="p-1 rounded bg-[#cad4e6] border border-black text-black">
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalhes Expandidos */}
                  {isExpanded && (step.details.length > 0 || step.errors.length > 0) && (
                    <div className="px-3 pb-3 pt-2 border-t border-black/15 bg-[#e0e6f1]/70 space-y-1.5 text-[11px] font-mono">
                      {step.errors.map((err, idx) => (
                        <div
                          key={`err_${idx}`}
                          className="px-2 py-1 rounded bg-rose-100 border border-rose-700 text-rose-900 font-bold"
                        >
                          [ERRO] {err}
                        </div>
                      ))}
                      {step.details.map((det, idx) => (
                        <div key={`det_${idx}`} className="text-slate-800 font-semibold leading-snug">
                          {det}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rodapé com Ações e Copiar Relatório Técnico */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-t border-black flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            id="btn-copiar-relatorio-auto-teste"
            onClick={handleCopyReport}
            disabled={isRunning}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-black text-xs font-bold uppercase transition cursor-pointer disabled:opacity-50 ${
              copied
                ? 'bg-emerald-700 text-white'
                : 'bg-white hover:bg-slate-100 text-black'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Relatório Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>📋 Copiar Relatório Técnico</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void executeTests()}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-700 hover:bg-indigo-800 text-white border border-black text-xs font-bold uppercase transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>Re-executar Auto-Teste</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isRunning}
              className="px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-black border border-black text-xs font-bold uppercase cursor-pointer disabled:opacity-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
