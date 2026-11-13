import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  Trash2,
  X,
  Clock,
  Ban,
  PackageX,
} from 'lucide-react';
import {
  CompanyProfile,
  PendenciaDevolucaoRecord,
  PendenciaDevolucaoStatus,
} from '../../types';
import {
  formatCurrencyBRL,
  formatDateBR,
  getStoredPendenciasDevolucao,
  updatePendenciaDevolucao,
} from '../../lib/storage';
import {
  NotaDevolucao,
  NotaDevolucaoPrefill,
  NovaNotaDevolucaoModal,
} from './DevolucaoNotasView';

interface PendenciasDevolucaoViewProps {
  companyProfile?: CompanyProfile;
}

function mapMotivoToNotaReason(motivo: string): NotaDevolucao['reason'] {
  const m = String(motivo || '').toLowerCase();
  if (m.includes('garantia')) return 'Devolução em Garantia';
  if (m.includes('tamanho') || m.includes('modelo') || m.includes('incompat')) {
    return 'Peça Incompatível com a Frota';
  }
  if (m.includes('desacordo')) return 'Desacordo com Pedido de Compra';
  if (m.includes('vasilhame') || m.includes('comodato')) {
    return 'Devolução de Vasilhame / Comodato';
  }
  return 'Mercadoria com Defeito / Avaria';
}

const JUSTIFICATIVAS_RAPIDAS = [
  'Peça de baixo valor (custo de frete/NF não compensa)',
  'Avaria interna / mau uso constatado',
  'Fora do prazo ou sem cobertura de garantia do fornecedor',
];

export const PendenciasDevolucaoView: React.FC<PendenciasDevolucaoViewProps> = () => {
  const [pendencias, setPendencias] = useState<PendenciaDevolucaoRecord[]>(() =>
    getStoredPendenciasDevolucao()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | PendenciaDevolucaoStatus>('todos');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal de Emissão de Nota de Devolução (pré-preenchido)
  const [emitTarget, setEmitTarget] = useState<PendenciaDevolucaoRecord | null>(null);

  // Modal de Confirmação de Descarte / Baixa como Perda
  const [discardTarget, setDiscardTarget] = useState<PendenciaDevolucaoRecord | null>(null);
  const [discardJustificativa, setDiscardJustificativa] = useState('');
  const [discardError, setDiscardError] = useState('');

  useEffect(() => {
    const syncPendencias = () => {
      setPendencias(getStoredPendenciasDevolucao());
    };
    window.addEventListener('agrocontrol_pendencias_devolucao_updated', syncPendencias);
    window.addEventListener('storage', syncPendencias);
    return () => {
      window.removeEventListener('agrocontrol_pendencias_devolucao_updated', syncPendencias);
      window.removeEventListener('storage', syncPendencias);
    };
  }, []);

  const counts = useMemo(() => {
    let aguardando = 0;
    let emitidas = 0;
    let descartadas = 0;
    let valorAguardando = 0;
    pendencias.forEach((p) => {
      if (p.status === 'Aguardando Decisão Fiscal') {
        aguardando += 1;
        valorAguardando += Number(p.valorTotal || 0);
      } else if (p.status === 'Nota de Devolução Emitida') {
        emitidas += 1;
      } else if (p.status === 'Descartado pela Empresa') {
        descartadas += 1;
      }
    });
    return { aguardando, emitidas, descartadas, valorAguardando };
  }, [pendencias]);

  const filteredPendencias = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = pendencias.filter((p) => {
      if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(p.protocolo || '').toLowerCase().includes(q) ||
        String(p.fornecedorNome || '').toLowerCase().includes(q) ||
        String(p.productName || '').toLowerCase().includes(q) ||
        String(p.productCode || '').toLowerCase().includes(q) ||
        String(p.motivo || '').toLowerCase().includes(q) ||
        String(p.clienteNome || '').toLowerCase().includes(q)
      );
    });
    // Ordena mantendo "Aguardando Decisão Fiscal" no topo e os mais recentes primeiro
    return [...list].sort((a, b) => {
      const aWait = a.status === 'Aguardando Decisão Fiscal' ? 0 : 1;
      const bWait = b.status === 'Aguardando Decisão Fiscal' ? 0 : 1;
      if (aWait !== bWait) return aWait - bWait;
      return String(b.createdAt || b.data).localeCompare(String(a.createdAt || a.data));
    });
  }, [pendencias, statusFilter, searchTerm]);

  const notaPrefill = useMemo<NotaDevolucaoPrefill | null>(() => {
    if (!emitTarget) return null;
    const notesParts = [
      `Protocolo Balcão: ${emitTarget.protocolo}`,
      emitTarget.clienteNome ? `Origem Cliente: ${emitTarget.clienteNome}` : '',
      emitTarget.motivo ? `Motivo: ${emitTarget.motivo}` : '',
      emitTarget.boletoAbatido
        ? `Abatimento Boleto (${emitTarget.boletoAbatido.documento || 'Parcela'}): -${formatCurrencyBRL(
            emitTarget.boletoAbatido.valorAbatido
          )} (Restante: ${formatCurrencyBRL(emitTarget.boletoAbatido.saldoRestante)})`
        : '',
      emitTarget.observacoes ? `Obs. Balcão: ${emitTarget.observacoes}` : '',
    ].filter(Boolean);

    return {
      supplierId: emitTarget.fornecedorId,
      supplierName: emitTarget.fornecedorNome,
      originInvoiceNumber: emitTarget.numeroNotaOuVendaOrigem || '',
      issueDate: new Date().toISOString().split('T')[0],
      reason: mapMotivoToNotaReason(emitTarget.motivo),
      notes: notesParts.join(' • '),
      items: [
        {
          id: '1',
          description: emitTarget.productCode
            ? `[${emitTarget.productCode}] ${emitTarget.productName}`
            : emitTarget.productName,
          quantity: Number(emitTarget.quantidade || 1),
          unit: emitTarget.unit || 'UN',
          unitPrice: Number(emitTarget.valorUnitario || 0),
          totalPrice: Number(emitTarget.valorTotal || 0),
        },
      ],
    };
  }, [emitTarget]);

  const handleOpenDiscard = (item: PendenciaDevolucaoRecord) => {
    setDiscardTarget(item);
    setDiscardJustificativa('');
    setDiscardError('');
  };

  const handleConfirmDiscard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discardTarget) return;
    const just = discardJustificativa.trim();
    if (!just) {
      setDiscardError('Informe uma justificativa curta para baixar o item como perda.');
      return;
    }

    updatePendenciaDevolucao(discardTarget.id, {
      status: 'Descartado pela Empresa',
      justificativaDescarte: just,
      decidedAt: new Date().toISOString(),
    });
    setPendencias(getStoredPendenciasDevolucao());
    setSuccessMsg(
      `Pendência ${discardTarget.protocolo} (${discardTarget.productName}) encerrada como "Descartado pela Empresa" sem gerar NF-e.`
    );
    setDiscardTarget(null);
    setDiscardJustificativa('');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const getStatusBadge = (item: PendenciaDevolucaoRecord) => {
    if (item.status === 'Aguardando Decisão Fiscal') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Aguardando Decisão Fiscal</span>
        </span>
      );
    }
    if (item.status === 'Nota de Devolução Emitida') {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>Nota de Devolução Emitida</span>
          </span>
          {item.notaDevolucaoNumber && (
            <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
              {item.notaDevolucaoNumber}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-stone-200 text-stone-800 border border-stone-400 whitespace-nowrap">
          <Ban className="w-3 h-3 shrink-0" />
          <span>Descartado pela Empresa</span>
        </span>
        {item.justificativaDescarte && (
          <span
            className="text-[10px] text-stone-500 max-w-[180px] truncate"
            title={item.justificativaDescarte}
          >
            {item.justificativaDescarte}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-3">
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-2 text-emerald-800 dark:text-emerald-200 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPIs Compactos de Quarentena Fiscal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="border border-rose-300/90 dark:border-rose-800 rounded-xl bg-white dark:bg-stone-900 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Aguardando Decisão Fiscal
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-rose-700 dark:text-rose-400">
              {counts.aguardando} {counts.aguardando === 1 ? 'item' : 'itens'}
            </span>
            <span className="text-xs font-black text-stone-700 dark:text-stone-300">
              {formatCurrencyBRL(counts.valorAguardando)}
            </span>
          </div>
        </div>

        <div className="border border-slate-300/80 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Notas de Devolução Emitidas
            </span>
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
            {counts.emitidas}
          </div>
        </div>

        <div className="border border-slate-300/80 dark:border-stone-700 rounded-xl bg-white dark:bg-stone-900 py-2 px-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              Descartados / Baixa como Perda
            </span>
            <PackageX className="w-3.5 h-3.5 text-stone-500" />
          </div>
          <div className="text-lg font-black text-stone-800 dark:text-stone-200 mt-0.5">
            {counts.descartadas}
          </div>
        </div>
      </div>

      {/* Painel Principal da Fila de Pendências */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2 border-b border-stone-200 dark:border-stone-800">
          <div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit'] flex items-center gap-1.5">
              <span>⚠️ Pendências de Devolução / Garantia (Quarentena Fiscal)</span>
            </h3>
            <p className="text-[11px] text-stone-500">
              Itens registrados pelo balcão aguardando decisão fiscal: emitir Nota de Devolução ao fornecedor ou baixar como perda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar protocolo, fornecedor, produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none cursor-pointer"
            >
              <option value="todos">Todos os Status ({pendencias.length})</option>
              <option value="Aguardando Decisão Fiscal">
                Aguardando Decisão ({counts.aguardando})
              </option>
              <option value="Nota de Devolução Emitida">
                NF Emitida ({counts.emitidas})
              </option>
              <option value="Descartado pela Empresa">
                Descartados ({counts.descartadas})
              </option>
            </select>
          </div>
        </div>

        <div className="border border-slate-300 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
          <div className="max-h-[calc(100vh-360px)] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-black uppercase sticky top-0 z-20 border-b border-slate-300 dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Protocolo</th>
                  <th className="py-2.5 px-3">Fornecedor</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3 text-center">Qtd</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 px-3">Motivo (Balcão)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredPendencias.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-6 text-center text-xs text-stone-500 font-semibold uppercase"
                    >
                      Nenhuma pendência de devolução / garantia encontrada
                    </td>
                  </tr>
                ) : (
                  filteredPendencias.map((item, idx) => {
                    const isPending = item.status === 'Aguardando Decisão Fiscal';
                    return (
                      <tr
                        key={`${item.id}_${idx}`}
                        className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800"
                      >
                        <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                          {formatDateBR(item.data)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-black text-rose-700 dark:text-rose-400">
                            {item.protocolo}
                          </span>
                          {item.origemTipo === 'devolucao_cliente_defeito' && item.clienteNome && (
                            <span className="block text-[10px] text-stone-500">
                              Balcão: {item.clienteNome}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-stone-800 dark:text-stone-200">
                          {item.fornecedorNome}
                          {item.numeroNotaOuVendaOrigem && (
                            <span className="block text-[10px] font-normal text-stone-500">
                              Origem: {item.numeroNotaOuVendaOrigem}
                            </span>
                          )}
                          {item.boletoAbatido && (
                            <span
                              className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/50 border border-teal-300 dark:border-teal-800 text-[10px] font-bold text-teal-800 dark:text-teal-300"
                              title={`Boleto: ${item.boletoAbatido.documento || '—'} | Venc: ${
                                item.boletoAbatido.vencimento
                                  ? formatDateBR(item.boletoAbatido.vencimento)
                                  : '—'
                              } | ${item.boletoAbatido.statusResultante}`}
                            >
                              Abatido em {item.boletoAbatido.documento || 'Boleto'}:{' '}
                              {formatCurrencyBRL(item.boletoAbatido.valorAbatido)}
                              {item.boletoAbatido.saldoRestante <= 0
                                ? ' (Liquidado)'
                                : ` • Rest: ${formatCurrencyBRL(item.boletoAbatido.saldoRestante)}`}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-stone-100">
                          {item.productCode ? `[${item.productCode}] ` : ''}
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold whitespace-nowrap">
                          {item.quantidade} {item.unit || 'UN'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-stone-900 dark:text-stone-100 whitespace-nowrap">
                          {formatCurrencyBRL(item.valorTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-stone-700 dark:text-stone-300">
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[10.5px] font-bold text-amber-900 dark:text-amber-200">
                            {item.motivo}
                          </span>
                          {item.observacoes && (
                            <span
                              className="block text-[10px] text-stone-500 mt-0.5 max-w-[200px] truncate"
                              title={item.observacoes}
                            >
                              {item.observacoes}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">{getStatusBadge(item)}</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEmitTarget(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                                title="Abrir modal pré-preenchido para emitir Nota de Devolução"
                              >
                                <FileText className="w-3 h-3" />
                                <span>📄 Emitir Nota de Devolução</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDiscard(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-bold transition cursor-pointer"
                                title="Descartar item e baixar como perda sem emitir nota"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>🗑️ Descartar / Baixar como Perda</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10.5px] font-semibold text-stone-400">
                              Decisão registrada
                              {item.decidedAt ? ` em ${formatDateBR(item.decidedAt)}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal pré-preenchido de Nova Nota de Devolução de Mercadorias / Peças */}
      <NovaNotaDevolucaoModal
        isOpen={Boolean(emitTarget)}
        onClose={() => setEmitTarget(null)}
        prefill={notaPrefill}
        onSaved={(newNota) => {
          if (emitTarget) {
            updatePendenciaDevolucao(emitTarget.id, {
              status: 'Nota de Devolução Emitida',
              notaDevolucaoId: newNota.id,
              notaDevolucaoNumber: newNota.devolucaoNumber,
              decidedAt: new Date().toISOString(),
            });
            setPendencias(getStoredPendenciasDevolucao());
            setSuccessMsg(
              `Nota de Devolução ${newNota.devolucaoNumber} gravada e pendência ${emitTarget.protocolo} atualizada para "Nota de Devolução Emitida"!`
            );
            setTimeout(() => setSuccessMsg(''), 5000);
          }
          setEmitTarget(null);
        }}
      />

      {/* Modal de Confirmação Simples: Descartar / Baixar como Perda */}
      {discardTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#cad4e6] dark:bg-stone-900 rounded-2xl max-w-lg w-full border border-black dark:border-stone-700 shadow-2xl overflow-hidden text-slate-900 dark:text-stone-100">
            <div className="px-4 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white dark:bg-stone-800 border border-black dark:border-stone-700">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                    Descartar / Baixar como Perda
                  </h3>
                  <p className="text-[11px] text-black/75 dark:text-stone-400 font-medium">
                    Encerrar item sem emitir Nota Fiscal de Devolução
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscardTarget(null)}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDiscard} className="p-4 space-y-3 bg-[#cad4e6] dark:bg-stone-950">
              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3 space-y-1 text-xs">
                <div>
                  <span className="font-bold">Protocolo:</span>{' '}
                  <span className="font-mono font-black text-rose-700 dark:text-rose-400">
                    {discardTarget.protocolo}
                  </span>
                </div>
                <div>
                  <span className="font-bold">Produto:</span> {discardTarget.productName} ({discardTarget.quantidade} {discardTarget.unit})
                </div>
                <div>
                  <span className="font-bold">Valor:</span>{' '}
                  {formatCurrencyBRL(discardTarget.valorTotal)} •{' '}
                  <span className="font-bold">Fornecedor:</span> {discardTarget.fornecedorNome}
                </div>
              </div>

              {discardError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-400 text-rose-800 text-xs font-bold">
                  {discardError}
                </div>
              )}

              <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3 space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider">
                  Justificativa Curta <span className="text-rose-600">*</span>
                </label>
                <div className="flex flex-wrap gap-1">
                  {JUSTIFICATIVAS_RAPIDAS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setDiscardJustificativa(sug)}
                      className="px-2 py-0.5 rounded bg-white dark:bg-stone-900 border border-gray-400 dark:border-stone-700 text-[10px] font-semibold hover:bg-slate-100 cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={discardJustificativa}
                  onChange={(e) => {
                    setDiscardJustificativa(e.target.value);
                    if (discardError) setDiscardError('');
                  }}
                  placeholder="Ex: Peça barata / avaria interna, não compensa emitir NF de devolução..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-900 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-rose-600 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDiscardTarget(null)}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-white hover:bg-gray-100 dark:bg-stone-800 text-black dark:text-stone-200 border border-gray-400 dark:border-stone-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white border border-rose-800 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmar Descarte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
