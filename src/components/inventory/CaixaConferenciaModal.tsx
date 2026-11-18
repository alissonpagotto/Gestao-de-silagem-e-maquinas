import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eraser,
  PenTool,
  Printer,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  CaixaFerramentaVeiculoRecord,
  CompanyProfile,
  Employee,
  InventoryItem,
  Machinery,
} from '../../types';
import { formatCurrencyBRL } from '../../lib/formatters';
import { executePrint } from '../../lib/printService';
import {
  buildTermoConferenciaCaixaHtml,
  CaixaConferenciaItemSnapshot,
  CaixaConferenciaRecord,
  CaixaItemMetadata,
  resolveCaixaItemMeta,
  resolveVehicleResponsibleEmployee,
  ToolboxItemCondition,
} from '../../lib/toolKitsStorage';

interface CaixaConferenciaModalProps {
  isOpen: boolean;
  vehicle?: Machinery;
  items: CaixaFerramentaVeiculoRecord[];
  metaMap: Record<string, CaixaItemMetadata>;
  products: InventoryItem[];
  employees: Employee[];
  companyProfile?: Partial<CompanyProfile> | null;
  isSaving?: boolean;
  onClose: () => void;
  onSaveConferencia: (record: CaixaConferenciaRecord) => Promise<boolean>;
}

interface EditableInspectionRow {
  item: CaixaFerramentaVeiculoRecord;
  codigo: string;
  nome: string;
  quantidade_esperada: number;
  quantidade_conferida: number;
  valor_unitario: number;
  status: ToolboxItemCondition;
  observacao: string;
}

function toLocalDatetimeInput(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export const CaixaConferenciaModal: React.FC<CaixaConferenciaModalProps> = ({
  isOpen,
  vehicle,
  items,
  metaMap,
  products,
  employees,
  companyProfile,
  isSaving = false,
  onClose,
  onSaveConferencia,
}) => {
  const resolvedResp = useMemo(
    () => resolveVehicleResponsibleEmployee(vehicle, employees),
    [vehicle, employees]
  );

  const [responsavelId, setResponsavelId] = useState<string>('');
  const [responsavelNome, setResponsavelNome] = useState<string>('');
  const [responsavelCpf, setResponsavelCpf] = useState<string>('');
  const [responsavelCargo, setResponsavelCargo] = useState<string>('');
  const [conferidoPor, setConferidoPor] = useState<string>('Almoxarifado');
  const [dataConferencia, setDataConferencia] = useState<string>(() =>
    toLocalDatetimeInput()
  );
  const [observacoesGerais, setObservacoesGerais] = useState<string>('');
  const [confirmNominal, setConfirmNominal] = useState<boolean>(true);
  const [rows, setRows] = useState<EditableInspectionRow[]>([]);
  const [formError, setFormError] = useState<string>('');

  // Canvas assinatura
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState<boolean>(false);

  // Inicializa estado quando o modal abre
  useEffect(() => {
    if (!isOpen) return;
    setFormError('');
    setResponsavelId(resolvedResp.employee?.id || '');
    setResponsavelNome(resolvedResp.name || '');
    setResponsavelCpf(resolvedResp.cpf || '');
    setResponsavelCargo(resolvedResp.cargo || 'Motorista / Operador');
    setDataConferencia(toLocalDatetimeInput());
    setObservacoesGerais('');
    setHasDrawnSignature(false);

    const mappedRows: EditableInspectionRow[] = items.map(item => {
      const meta = resolveCaixaItemMeta(item, metaMap, products);
      const qtdEsp = Math.max(1, Number(item.quantidade_esperada ?? 1));
      const qtdAtu = Math.max(0, Number(item.quantidade_atual ?? qtdEsp));
      const inferredStatus: ToolboxItemCondition =
        meta.status_conferencia || (qtdAtu < qtdEsp ? 'faltando' : 'ok');

      return {
        item,
        codigo: item.codigo_item_ferramenta,
        nome: item.nome_ferramenta,
        quantidade_esperada: qtdEsp,
        quantidade_conferida: qtdAtu,
        valor_unitario: meta.valor_unitario_efetivo,
        status: inferredStatus,
        observacao: meta.observacao_conferencia || '',
      };
    });
    setRows(mappedRows);

    // Limpa canvas
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }, 30);
  }, [isOpen, items, metaMap, products, resolvedResp]);

  const handleSelectEmployee = (empId: string) => {
    setResponsavelId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setResponsavelNome(emp.name || '');
      setResponsavelCpf(emp.cpf || '');
      setResponsavelCargo(emp.role || 'Motorista / Operador');
    }
  };

  const handleSetRowStatus = (idx: number, status: ToolboxItemCondition) => {
    setRows(prev =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        let nextQtd = row.quantidade_conferida;
        if (status === 'ok') {
          nextQtd = row.quantidade_esperada;
        } else if (status === 'faltando' && row.quantidade_conferida >= row.quantidade_esperada) {
          nextQtd = 0;
        }
        return { ...row, status, quantidade_conferida: nextQtd };
      })
    );
  };

  const handleSetRowQtd = (idx: number, rawVal: string) => {
    const val = Math.max(0, Number(rawVal) || 0);
    setRows(prev =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const nextStatus: ToolboxItemCondition =
          row.status === 'danificada'
            ? 'danificada'
            : val < row.quantidade_esperada
              ? 'faltando'
              : 'ok';
        return { ...row, quantidade_conferida: val, status: nextStatus };
      })
    );
  };

  const handleMarkAllOk = () => {
    setRows(prev =>
      prev.map(r => ({
        ...r,
        status: 'ok',
        quantidade_conferida: r.quantidade_esperada,
      }))
    );
  };

  const getPointerPos = (
    e: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e, canvas);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawnSignature(true);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawnSignature(false);
  };

  const totals = useMemo(() => {
    let totalPatrimonio = 0;
    let totalDivergencia = 0;
    let countOk = 0;
    let countFaltando = 0;
    let countDanificada = 0;

    for (const r of rows) {
      const subtotalEsp = r.quantidade_esperada * r.valor_unitario;
      totalPatrimonio += subtotalEsp;

      if (r.status === 'faltando') {
        countFaltando++;
        const missingQty = Math.max(0, r.quantidade_esperada - r.quantidade_conferida);
        totalDivergencia += (missingQty > 0 ? missingQty : 1) * r.valor_unitario;
      } else if (r.status === 'danificada') {
        countDanificada++;
        const affectedQty = Math.max(1, r.quantidade_conferida || r.quantidade_esperada);
        totalDivergencia += affectedQty * r.valor_unitario;
      } else {
        countOk++;
      }
    }

    return {
      totalPatrimonio: Number(totalPatrimonio.toFixed(2)),
      totalDivergencia: Number(totalDivergencia.toFixed(2)),
      countOk,
      countFaltando,
      countDanificada,
    };
  }, [rows]);

  if (!isOpen || !vehicle) return null;

  const buildSnapshotRecord = (): CaixaConferenciaRecord => {
    const assinaturaDataUrl =
      hasDrawnSignature && canvasRef.current
        ? canvasRef.current.toDataURL('image/png')
        : undefined;

    const itensSnapshot: CaixaConferenciaItemSnapshot[] = rows.map(r => {
      const subtotal = Number((r.quantidade_esperada * r.valor_unitario).toFixed(2));
      let div = 0;
      if (r.status === 'faltando') {
        const missing = Math.max(0, r.quantidade_esperada - r.quantidade_conferida);
        div = (missing > 0 ? missing : 1) * r.valor_unitario;
      } else if (r.status === 'danificada') {
        const aff = Math.max(1, r.quantidade_conferida || r.quantidade_esperada);
        div = aff * r.valor_unitario;
      }
      return {
        item_id: r.item.id,
        codigo: r.codigo,
        nome: r.nome,
        quantidade_esperada: r.quantidade_esperada,
        quantidade_conferida: r.quantidade_conferida,
        valor_unitario: r.valor_unitario,
        subtotal,
        status: r.status,
        valor_divergencia: Number(div.toFixed(2)),
        observacao: r.observacao.trim() || undefined,
      };
    });

    return {
      id: `conf_${Date.now()}`,
      veiculo_id: vehicle.id,
      veiculo_nome: vehicle.name,
      veiculo_placa: vehicle.plateOrSerial || vehicle.plate || '',
      veiculo_prefixo: vehicle.fleetNumber || '',
      veiculo_modelo: vehicle.model || '',
      veiculo_categoria:
        vehicle.categoriaVeiculo || vehicle.categoria || vehicle.categoryType || 'Frota',
      responsavel_id: responsavelId || undefined,
      responsavel_nome: responsavelNome.trim() || 'Não informado',
      responsavel_cpf: responsavelCpf.trim() || '',
      responsavel_cargo: responsavelCargo.trim() || 'Motorista / Operador',
      conferido_por: conferidoPor.trim() || 'Almoxarifado',
      data_conferencia: dataConferencia
        ? new Date(dataConferencia).toISOString()
        : new Date().toISOString(),
      assinatura_data_url: assinaturaDataUrl,
      assinatura_confirmada_nominal: confirmNominal,
      observacoes_gerais: observacoesGerais.trim() || undefined,
      valor_total_patrimonio: totals.totalPatrimonio,
      valor_total_divergencia: totals.totalDivergencia,
      itens: itensSnapshot,
    };
  };

  const validateAndSubmit = async (alsoPrint: boolean) => {
    setFormError('');
    if (!conferidoPor.trim()) {
      setFormError('Informe quem realizou a conferência pelo Almoxarifado.');
      return;
    }
    if (!responsavelNome.trim()) {
      setFormError('Informe o nome do Motorista / Operador responsável pelo veículo.');
      return;
    }

    const record = buildSnapshotRecord();
    const ok = await onSaveConferencia(record);
    if (!ok) return;

    if (alsoPrint) {
      const html = buildTermoConferenciaCaixaHtml(record, companyProfile);
      executePrint(html);
    }
    onClose();
  };

  const handlePrintPreviewOnly = () => {
    const record = buildSnapshotRecord();
    const html = buildTermoConferenciaCaixaHtml(record, companyProfile);
    executePrint(html);
  };

  return createPortal(
    <div className="no-print fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#cad4e6] border border-black rounded-xl w-full max-w-5xl max-h-[94vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="px-4 py-3 bg-[#cad4e6] border-b border-black flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white border border-black flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black uppercase text-black leading-tight">
                Conferir Caixa &amp; Termo de Responsabilidade
              </h3>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
                {vehicle.name}
                {vehicle.plateOrSerial ? ` • Placa/Série: ${vehicle.plateOrSerial}` : ''}
                {vehicle.model ? ` • ${vehicle.model}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPreviewOnly}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-black bg-white hover:bg-slate-100 text-black text-xs font-bold cursor-pointer"
              title="Visualizar e imprimir Termo A4 com os dados atuais"
            >
              <Printer className="w-3.5 h-3.5 text-blue-700" />
              <span>Imprimir Termo A4</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-black hover:bg-black/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="p-3.5 bg-[#e0e6f1] flex-1 min-h-0 overflow-y-auto space-y-3">
          {formError && (
            <div className="px-3 py-2 rounded-lg bg-rose-100 border border-rose-500 text-rose-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Dados do Responsável e da Conferência */}
          <div className="p-3 rounded-lg bg-[#cad4e6] border border-black space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase text-black flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-800" />
                <span>Responsável pelo Veículo &amp; Conferente do Almoxarifado</span>
              </span>
              <button
                type="button"
                onClick={handleMarkAllOk}
                className="px-2.5 py-1 rounded-md border border-black bg-white hover:bg-emerald-50 text-emerald-900 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Marcar Todos como OK / Presentes</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-4">
                <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                  Selecionar Colaborador Vinculado
                </label>
                <select
                  value={responsavelId}
                  onChange={e => handleSelectEmployee(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
                >
                  <option value="">Personalizado / Digitar ao lado...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.role ? `(${emp.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                  Motorista / Operador Responsável *
                </label>
                <input
                  type="text"
                  value={responsavelNome}
                  onChange={e => setResponsavelNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                  CPF
                </label>
                <input
                  type="text"
                  value={responsavelCpf}
                  onChange={e => setResponsavelCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-mono font-bold text-zinc-900"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                  Cargo / Função
                </label>
                <input
                  type="text"
                  value={responsavelCargo}
                  onChange={e => setResponsavelCargo(e.target.value)}
                  placeholder="Motorista / Operador"
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-semibold text-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-4">
                <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                  Conferido Por (Almoxarifado) *
                </label>
                <input
                  type="text"
                  list="almox-employees-list"
                  value={conferidoPor}
                  onChange={e => setConferidoPor(e.target.value)}
                  placeholder="Nome do conferente"
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                  Data e Hora da Conferência *
                </label>
                <input
                  type="datetime-local"
                  value={dataConferencia}
                  onChange={e => setDataConferencia(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-bold text-zinc-900"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[9.5px] font-black uppercase text-slate-800 mb-0.5">
                  Observações Gerais da Conferência
                </label>
                <input
                  type="text"
                  value={observacoesGerais}
                  onChange={e => setObservacoesGerais(e.target.value)}
                  placeholder="Anotações sobre estado da caixa, troca de operador..."
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-400 bg-white text-xs font-medium text-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Checklist de Ferramentas */}
          <div className="border border-black rounded-lg overflow-hidden bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#cad4e6] border-b border-black">
                <tr className="text-[10px] font-black uppercase text-black">
                  <th className="py-2 px-2">Código</th>
                  <th className="py-2 px-2">Ferramenta</th>
                  <th className="py-2 px-2 text-center w-16">Esp.</th>
                  <th className="py-2 px-2 text-center w-20">Conf.</th>
                  <th className="py-2 px-2 text-right w-24">Valor Unit.</th>
                  <th className="py-2 px-2 text-right w-24">Subtotal</th>
                  <th className="py-2 px-2 text-center">Status da Conferência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/15">
                {rows.map((row, idx) => {
                  const subtotal = row.quantidade_esperada * row.valor_unitario;
                  return (
                    <tr
                      key={row.item.id}
                      className={
                        row.status === 'faltando'
                          ? 'bg-rose-50/80'
                          : row.status === 'danificada'
                            ? 'bg-amber-50/80'
                            : 'bg-[#e0e6f1]/45'
                      }
                    >
                      <td className="py-1.5 px-2 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {row.codigo}
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="font-bold text-zinc-900">{row.nome}</div>
                        <input
                          type="text"
                          value={row.observacao}
                          onChange={e =>
                            setRows(prev =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, observacao: e.target.value } : r
                              )
                            )
                          }
                          placeholder="Observação opcional do item..."
                          className="mt-1 w-full px-2 py-0.5 rounded border border-slate-300 bg-white text-[10.5px] text-slate-800"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center font-black">
                        {row.quantidade_esperada}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={row.quantidade_conferida}
                          onChange={e => handleSetRowQtd(idx, e.target.value)}
                          className="w-14 px-1 py-1 rounded border border-slate-400 bg-white text-center font-black text-xs text-zinc-900"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-zinc-800 whitespace-nowrap">
                        {formatCurrencyBRL(row.valor_unitario)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {formatCurrencyBRL(subtotal)}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <div className="inline-flex flex-wrap items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetRowStatus(idx, 'ok')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer inline-flex items-center gap-1 ${
                              row.status === 'ok'
                                ? 'bg-emerald-700 text-white border-black'
                                : 'bg-white text-slate-800 border-slate-400 hover:bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>OK</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetRowStatus(idx, 'faltando')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer inline-flex items-center gap-1 ${
                              row.status === 'faltando'
                                ? 'bg-rose-700 text-white border-black'
                                : 'bg-white text-slate-800 border-slate-400 hover:bg-rose-50'
                            }`}
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Faltando</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetRowStatus(idx, 'danificada')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer inline-flex items-center gap-1 ${
                              row.status === 'danificada'
                                ? 'bg-amber-600 text-white border-black'
                                : 'bg-white text-slate-800 border-slate-400 hover:bg-amber-50'
                            }`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Danificada</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totalizadores + Área de Assinatura Digital na Tela */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5 p-3 rounded-lg bg-[#cad4e6] border border-black space-y-2">
              <div className="text-[11px] font-black uppercase text-black">
                Resumo Patrimonial da Conferência
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-[#e0e6f1] border border-black">
                  <span className="text-[9.5px] font-bold uppercase text-slate-700 block">
                    Valor Total da Caixa
                  </span>
                  <span className="text-sm font-black font-mono text-zinc-900">
                    {formatCurrencyBRL(totals.totalPatrimonio)}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#e0e6f1] border border-black">
                  <span className="text-[9.5px] font-bold uppercase text-slate-700 block">
                    Divergência / Falta / Dano
                  </span>
                  <span
                    className={`text-sm font-black font-mono ${
                      totals.totalDivergencia > 0 ? 'text-rose-700' : 'text-emerald-800'
                    }`}
                  >
                    {formatCurrencyBRL(totals.totalDivergencia)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-500 text-emerald-900">
                  ✅ {totals.countOk} OK
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-500 text-rose-900">
                  ❌ {totals.countFaltando} Faltando
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-500 text-amber-900">
                  ⚠️ {totals.countDanificada} Danificada(s)
                </span>
              </div>
            </div>

            <div className="lg:col-span-7 p-3 rounded-lg bg-[#cad4e6] border border-black space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase text-black flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Assinatura Digital do Motorista / Operador (Opcional na Tela)</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearSignature}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-500 bg-white hover:bg-slate-100 text-[10.5px] font-bold text-slate-800 cursor-pointer"
                >
                  <Eraser className="w-3 h-3" />
                  <span>Limpar Assinatura</span>
                </button>
              </div>

              <div className="border border-black rounded-md bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={560}
                  height={110}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  className="w-full h-[96px] touch-none cursor-crosshair block"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmNominal}
                  onChange={e => setConfirmNominal(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-700"
                />
                <span>
                  Confirmar ciência nominal de recebimento e responsabilidade patrimonial
                  {hasDrawnSignature ? ' (com assinatura digital capturada)' : ' (ou assinatura física no Termo A4 impresso)'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Rodapé Ações */}
        <div className="px-4 py-2.5 bg-[#cad4e6] border-t border-black flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-slate-500 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => validateAndSubmit(false)}
              className="px-3.5 py-1.5 rounded-md border border-black bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Conferência'}</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => validateAndSubmit(true)}
              className="px-4 py-1.5 rounded-md border border-black bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Salvar e Imprimir Termo de Conferência (A4)</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
