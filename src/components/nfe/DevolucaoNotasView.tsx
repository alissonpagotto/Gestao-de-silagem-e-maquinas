import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowDownLeft, 
  Plus, 
  Trash2, 
  Printer, 
  Search, 
  FileText, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Building2,
  Calendar,
  Layers
} from 'lucide-react';
import { Supplier, CompanyProfile } from '../../types';
import { formatDateBR, formatCurrencyBRL, getStoredCompanyProfile, getStoredSuppliers } from '../../lib/storage';
import { getStoredReformSuppliers } from './TireReformOrderView';
import { 
  CompetenceSelector, 
  getPrevCompetence, 
  getNextCompetence, 
  matchesCompetence 
} from '../financial/CompetenceSelector';

export interface DevolucaoItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface NotaDevolucao {
  id: string;
  devolucaoNumber: string; // ex: 'DEV-2026-001'
  originInvoiceNumber: string; // NF de Origem
  originInvoiceKey?: string;
  issueDate: string;
  supplierId?: string;
  supplierName: string;
  supplierCnpj?: string;
  reason: 'Mercadoria com Defeito / Avaria' | 'Peça Incompatível com a Frota' | 'Desacordo com Pedido de Compra' | 'Devolução em Garantia' | 'Devolução de Vasilhame / Comodato' | 'Outro';
  items: DevolucaoItem[];
  totalAmount: number;
  status: 'Autorizada' | 'Emitida' | 'Cancelada';
  notes?: string;
  createdAt: string;
}

export interface NotaDevolucaoPrefill {
  supplierId?: string;
  supplierName?: string;
  originInvoiceNumber?: string;
  issueDate?: string;
  reason?: NotaDevolucao['reason'];
  notes?: string;
  items?: DevolucaoItem[];
}

export const NOTAS_DEVOLUCAO_KEY = 'colaca_silagem_notas_devolucao';

export function getStoredNotasDevolucao(): NotaDevolucao[] {
  try {
    const raw = localStorage.getItem(NOTAS_DEVOLUCAO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(d => d && d.id !== 'dev_mock_1');
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(NOTAS_DEVOLUCAO_KEY, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar notas de devolução:', e);
  }
  return [];
}

export function saveStoredNotasDevolucao(notas: NotaDevolucao[]): void {
  try {
    localStorage.setItem(NOTAS_DEVOLUCAO_KEY, JSON.stringify(notas));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('colaca_silagem_notas_devolucao_updated', { detail: notas }));
    }
  } catch (e) {
    console.warn('Erro ao salvar notas de devolução:', e);
  }
}

function getAllAvailableSuppliers(): Supplier[] {
  const map = new Map<string, Supplier>();
  [...getStoredSuppliers(), ...getStoredReformSuppliers()].forEach((s) => {
    if (s && s.id && !map.has(s.id)) {
      map.set(s.id, s);
    }
  });
  return Array.from(map.values());
}

interface NovaNotaDevolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefill?: NotaDevolucaoPrefill | null;
  onSaved?: (nota: NotaDevolucao) => void;
}

export const NovaNotaDevolucaoModal: React.FC<NovaNotaDevolucaoModalProps> = ({
  isOpen,
  onClose,
  prefill,
  onSaved,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => getAllAvailableSuppliers());

  // Form states
  const [originInvoice, setOriginInvoice] = useState('');
  const [originKey, setOriginKey] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [customSupplier, setCustomSupplier] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<NotaDevolucao['reason']>('Mercadoria com Defeito / Avaria');
  const [notes, setNotes] = useState('');

  // Itens da devolução
  const [items, setItems] = useState<DevolucaoItem[]>([
    { id: '1', description: '', quantity: 1, unit: 'UN', unitPrice: 0, totalPrice: 0 }
  ]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const allSups = getAllAvailableSuppliers();
    setSuppliers(allSups);
    setFormError('');

    if (prefill) {
      setOriginInvoice(prefill.originInvoiceNumber || '');
      setOriginKey('');
      setIssueDate(prefill.issueDate || new Date().toISOString().split('T')[0]);
      setReason(prefill.reason || 'Mercadoria com Defeito / Avaria');
      setNotes(prefill.notes || '');

      // Match fornecedor por ID ou nome
      const matchedSup =
        (prefill.supplierId && allSups.find(s => String(s.id) === String(prefill.supplierId))) ||
        (prefill.supplierName &&
          allSups.find(s => {
            const target = prefill.supplierName!.trim().toLowerCase();
            return (
              String(s.name || '').trim().toLowerCase() === target ||
              String(s.tradeName || '').trim().toLowerCase() === target
            );
          }));

      if (matchedSup) {
        setSelectedSupplierId(matchedSup.id);
        setCustomSupplier('');
      } else if (
        prefill.supplierName &&
        !prefill.supplierName.toLowerCase().includes('a definir') &&
        !prefill.supplierName.toLowerCase().includes('não informado')
      ) {
        setSelectedSupplierId('outro');
        setCustomSupplier(prefill.supplierName);
      } else {
        setSelectedSupplierId('');
        setCustomSupplier('');
      }

      if (prefill.items && prefill.items.length > 0) {
        setItems(
          prefill.items.map((it, idx) => ({
            ...it,
            id: it.id || String(idx + 1),
          }))
        );
      } else {
        setItems([{ id: '1', description: '', quantity: 1, unit: 'UN', unitPrice: 0, totalPrice: 0 }]);
      }
    } else {
      setOriginInvoice('');
      setOriginKey('');
      setSelectedSupplierId('');
      setCustomSupplier('');
      setIssueDate(new Date().toISOString().split('T')[0]);
      setReason('Mercadoria com Defeito / Avaria');
      setNotes('');
      setItems([{ id: '1', description: '', quantity: 1, unit: 'UN', unitPrice: 0, totalPrice: 0 }]);
    }
  }, [isOpen, prefill]);

  const totalCalculated = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
  }, [items]);

  const handleItemChange = (id: string, field: keyof DevolucaoItem, val: any) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? parseFloat(val) || 0 : it.quantity;
        const price = field === 'unitPrice' ? parseFloat(val) || 0 : it.unitPrice;
        updated.totalPrice = Math.round(qty * price * 100) / 100;
      }
      return updated;
    }));
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: String(Date.now()), description: '', quantity: 1, unit: 'UN', unitPrice: 0, totalPrice: 0 }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleSaveNotaDevolucao = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!originInvoice.trim()) {
      setFormError('Informe o número da NF de Entrada / Origem.');
      return;
    }

    const selSup = suppliers.find(s => s.id === selectedSupplierId);
    const finalSupplierName = selSup ? (selSup.tradeName || selSup.name) : customSupplier.trim();

    if (!finalSupplierName) {
      setFormError('Selecione ou informe o Fornecedor / Destinatário.');
      return;
    }

    const validItems = items.filter(it => it.description.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setFormError('Adicione pelo menos um item válido na lista de devolução.');
      return;
    }

    const currentNotas = getStoredNotasDevolucao();
    const currentYear = new Date().getFullYear();
    let maxSeq = currentNotas.length;
    currentNotas.forEach((n) => {
      const m = String(n?.devolucaoNumber || '').match(/DEV-\d{4}-(\d+)/i);
      if (m && m[1]) {
        const parsed = parseInt(m[1], 10);
        if (!isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
      }
    });
    const nextDevNumber = `DEV-${currentYear}-${String(maxSeq + 1).padStart(3, '0')}`;

    const newNota: NotaDevolucao = {
      id: `dev_${Date.now()}`,
      devolucaoNumber: nextDevNumber,
      originInvoiceNumber: originInvoice.trim(),
      originInvoiceKey: originKey.trim() || undefined,
      issueDate,
      supplierId: selectedSupplierId && selectedSupplierId !== 'outro' ? selectedSupplierId : undefined,
      supplierName: finalSupplierName,
      supplierCnpj: selSup?.cnpjOrCpf,
      reason,
      items: validItems,
      totalAmount: totalCalculated,
      status: 'Autorizada',
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    const updated = [newNota, ...currentNotas];
    saveStoredNotasDevolucao(updated);
    onSaved?.(newNota);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-hidden overflow-y-hidden animate-in fade-in duration-150">
      <div className="bg-[#cad4e6] dark:bg-stone-900 rounded-2xl max-w-3xl w-full border border-black dark:border-stone-700 shadow-2xl overflow-hidden overflow-y-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] dark:bg-stone-900 border-b border-black dark:border-stone-700 text-black dark:text-stone-100 flex items-center justify-between shrink-0 rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white dark:bg-stone-800 text-black dark:text-stone-100 flex items-center justify-center border border-black dark:border-stone-700 shrink-0 font-bold">
              <ArrowDownLeft className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-black dark:text-stone-100">
                NOVA NOTA DE DEVOLUÇÃO DE MERCADORIAS / PEÇAS
              </h3>
              <p className="text-[11px] text-black/80 dark:text-stone-400 font-medium">
                Preencha os dados da NF de origem e itens devolvidos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-black hover:bg-black/10 dark:text-stone-300 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSaveNotaDevolucao} className="bg-[#cad4e6] dark:bg-stone-950 text-xs flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="p-3 sm:p-4 overflow-y-auto flex-1">
            <div className="bg-[#e0e6f1] dark:bg-stone-800 border border-black dark:border-stone-700 rounded-xl p-3.5 space-y-2.5">
              {formError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-400 text-rose-800 text-xs font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Linha 1: Fornecedor & Data */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-0.5">
                    Fornecedor / Destinatário <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb] cursor-pointer"
                  >
                    <option value="">Selecione o Fornecedor...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.tradeName || s.name}</option>
                    ))}
                    <option value="outro">+ Outro (Digitar Nome)</option>
                  </select>
                  {selectedSupplierId === 'outro' && (
                    <input
                      type="text"
                      placeholder="Nome do Fornecedor..."
                      value={customSupplier}
                      onChange={(e) => setCustomSupplier(e.target.value)}
                      className="mt-1 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none"
                    />
                  )}
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-0.5">
                    Data da Devolução
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb]"
                  />
                </div>
              </div>

              {/* Linha 2: NF de Origem & Motivo */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-0.5">
                    NF-e de Origem (Entrada) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: NF-e 048291"
                    value={originInvoice}
                    onChange={(e) => setOriginInvoice(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb]"
                    required
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-0.5">
                    Motivo da Devolução <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb] cursor-pointer"
                  >
                    <option value="Mercadoria com Defeito / Avaria">Mercadoria com Defeito / Avaria</option>
                    <option value="Peça Incompatível com a Frota">Peça Incompatível com a Frota</option>
                    <option value="Desacordo com Pedido de Compra">Desacordo com Pedido de Compra</option>
                    <option value="Devolução em Garantia">Devolução em Garantia</option>
                    <option value="Devolução de Vasilhame / Comodato">Devolução de Vasilhame / Comodato</option>
                    <option value="Outro">Outro Motivo</option>
                  </select>
                </div>
              </div>

              {/* Tabela de Itens Devolvidos */}
              <div className="space-y-1.5 pt-2 border-t border-black/20 dark:border-stone-700">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider">
                    Itens a Devolver
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[2.5]" />
                    <span>+ Adicionar Linha</span>
                  </button>
                </div>

                <div className="border border-black dark:border-stone-700 rounded-lg overflow-hidden max-h-36 overflow-y-auto bg-white dark:bg-stone-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#cad4e6] dark:bg-stone-800 text-black dark:text-stone-300 text-[10px] font-black uppercase sticky top-0 border-b border-black dark:border-stone-700">
                      <tr>
                        <th className="py-1.5 px-2">Descrição do Produto / Peça</th>
                        <th className="py-1.5 px-2 w-20">Qtd</th>
                        <th className="py-1.5 px-2 w-16">Un</th>
                        <th className="py-1.5 px-2 w-28">Unitário (R$)</th>
                        <th className="py-1.5 px-2 w-28 text-right">Total (R$)</th>
                        <th className="py-1.5 px-1 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 dark:divide-stone-800">
                      {items.map((it, idx) => (
                        <tr key={`${it.id || 'dev_item'}_${idx}`} className="bg-white dark:bg-stone-900 hover:bg-gray-50 dark:hover:bg-stone-800 transition">
                          <td className="p-1">
                            <input
                              type="text"
                              placeholder="Ex: Filtro de Combustível..."
                              value={it.description}
                              onChange={(e) => handleItemChange(it.id, 'description', e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none"
                              required
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={it.quantity}
                              onChange={(e) => handleItemChange(it.id, 'quantity', e.target.value)}
                              className="w-full px-1.5 py-1 text-xs rounded border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="text"
                              value={it.unit}
                              onChange={(e) => handleItemChange(it.id, 'unit', e.target.value)}
                              className="w-full px-1 py-1 text-xs text-center rounded border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none uppercase"
                            />
                          </td>
                          <td className="p-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={it.unitPrice}
                              onChange={(e) => handleItemChange(it.id, 'unitPrice', e.target.value)}
                              className="w-full px-1.5 py-1 text-xs text-right rounded border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none"
                            />
                          </td>
                          <td className="p-1 text-right font-bold text-black dark:text-stone-100 pr-2">
                            {formatCurrencyBRL(it.totalPrice)}
                          </td>
                          <td className="p-1 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.id)}
                                className="text-stone-500 hover:text-rose-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-0.5">
                  <span className="text-xs font-black text-rose-700 dark:text-rose-400">
                    Total da Devolução: {formatCurrencyBRL(totalCalculated)}
                  </span>
                </div>
              </div>

              {/* Justificativa / Observações */}
              <div>
                <label className="block text-[11px] font-bold text-black dark:text-stone-300 uppercase tracking-wider mb-0.5">
                  Justificativa / Dados Adicionais da Devolução
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações fiscais complementares..."
                  className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-400 dark:border-stone-700 bg-white dark:bg-stone-800 text-black dark:text-stone-100 outline-none focus:ring-1 focus:ring-[#0963cb] resize-none"
                />
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-5 py-3 bg-[#cad4e6] dark:bg-stone-900 border-t border-black dark:border-stone-700 flex items-center justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-white hover:bg-gray-100 dark:bg-stone-800 dark:hover:bg-stone-700 text-black dark:text-stone-200 border border-gray-400 dark:border-stone-600 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-800 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Gravar Nota de Devolução</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DevolucaoNotasViewProps {
  companyProfile?: CompanyProfile;
  competence?: string;
  onCompetenceChange?: (comp: string) => void;
}

export const DevolucaoNotasView: React.FC<DevolucaoNotasViewProps> = ({ 
  companyProfile,
  competence,
  onCompetenceChange 
}) => {
  const [notas, setNotas] = useState<NotaDevolucao[]>(() => getStoredNotasDevolucao());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const syncNotas = () => setNotas(getStoredNotasDevolucao());
    window.addEventListener('colaca_silagem_notas_devolucao_updated', syncNotas);
    window.addEventListener('storage', syncNotas);
    return () => {
      window.removeEventListener('colaca_silagem_notas_devolucao_updated', syncNotas);
      window.removeEventListener('storage', syncNotas);
    };
  }, []);

  // Competência ativa
  const activeCompetence = useMemo(() => {
    if (competence && /^\d{2}\/\d{4}$/.test(competence)) return competence;
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, [competence]);

  const handlePrevCompetence = () => {
    const prev = getPrevCompetence(activeCompetence);
    onCompetenceChange?.(prev);
  };

  const handleNextCompetence = () => {
    const next = getNextCompetence(activeCompetence);
    onCompetenceChange?.(next);
  };

  const [successMsg, setSuccessMsg] = useState('');

  const company = useMemo(() => companyProfile || getStoredCompanyProfile(), [companyProfile]);

  const handlePrintEspelho = (dev: NotaDevolucao) => {
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Espelho de Nota de Devolução - ${dev.devolucaoNumber}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; }
          body { font-size: 10.5pt; line-height: 1.4; margin: 0; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #b91c1c; padding-bottom: 8px; margin-bottom: 12px; }
          .title { font-size: 14pt; font-weight: 900; color: #b91c1c; text-transform: uppercase; }
          .sub { font-size: 8.5pt; color: #6b7280; }
          .badge { text-align: right; }
          .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 12px; background: #fafafa; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 16px; }
          th { background: #1e293b; color: #fff; font-size: 8pt; text-transform: uppercase; padding: 6px 8px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 8.5pt; }
          .total { text-align: right; font-size: 11pt; font-weight: 900; color: #b91c1c; }
          .sig { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .sig-line { border-top: 1px solid #000; text-align: center; padding-top: 4px; font-size: 8pt; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${company.tradeName || 'COLACA SILAGEM'}</div>
            <div class="sub">Espelho de Emissão / Controle Fiscal de Devolução de Mercadorias</div>
            ${company.cnpj ? `<div class="sub">CNPJ: ${company.cnpj}</div>` : ''}
          </div>
          <div class="badge">
            <div style="font-size: 13pt; font-weight: 900; color: #b91c1c;">${dev.devolucaoNumber}</div>
            <div class="sub">Data: ${formatDateBR(dev.issueDate)}</div>
            <div style="font-weight: bold; font-size: 8pt; color: #059669;">Status: ${dev.status}</div>
          </div>
        </div>

        <div class="box">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div><strong>Destinatário / Fornecedor:</strong> ${dev.supplierName}</div>
            <div><strong>NF-e de Origem:</strong> ${dev.originInvoiceNumber}</div>
            <div><strong>Motivo da Devolução:</strong> ${dev.reason}</div>
            ${dev.originInvoiceKey ? `<div><strong>Chave de Acesso:</strong> <span style="font-family: monospace; font-size: 8pt;">${dev.originInvoiceKey}</span></div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Descrição do Item / Mercadoria Devolvida</th>
              <th style="width: 50px; text-align: center;">Qtd</th>
              <th style="width: 40px; text-align: center;">Un</th>
              <th style="width: 90px; text-align: right;">Unitário (R$)</th>
              <th style="width: 100px; text-align: right;">Total (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${dev.items.map((it, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="font-weight: bold;">${it.description}</td>
                <td style="text-align: center;">${it.quantity}</td>
                <td style="text-align: center;">${it.unit}</td>
                <td style="text-align: right;">${formatCurrencyBRL(it.unitPrice)}</td>
                <td style="text-align: right; font-weight: bold;">${formatCurrencyBRL(it.totalPrice)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total">
          VALOR TOTAL DA DEVOLUÇÃO: ${formatCurrencyBRL(dev.totalAmount)}
        </div>

        ${dev.notes ? `
          <div style="margin-top: 14px; font-size: 8pt; color: #4b5563; padding: 6px; border-left: 3px solid #b91c1c;">
            <strong>Justificativa Fiscal / Observações:</strong> ${dev.notes}
          </div>
        ` : ''}

        <div class="sig">
          <div class="sig-line">
            Responsável pela Emissão / Expedição
          </div>
          <div class="sig-line">
            Transportadora / Recebedor Fornecedor
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const pWin = window.open('', '_blank');
      if (pWin) {
        pWin.document.write(printHtml);
        pWin.document.close();
        pWin.focus();
        setTimeout(() => pWin.print(), 300);
        return;
      }
    } catch {}

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 300);
    }
  };

  const filteredNotas = useMemo(() => {
    return notas.filter(n => {
      const notaDate = n.issueDate || n.createdAt || '';
      if (!matchesCompetence(notaDate, activeCompetence)) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        n.devolucaoNumber.toLowerCase().includes(term) ||
        n.originInvoiceNumber.toLowerCase().includes(term) ||
        n.supplierName.toLowerCase().includes(term) ||
        n.reason.toLowerCase().includes(term)
      );
    });
  }, [notas, searchTerm, activeCompetence]);

  return (
    <div className="w-full space-y-4">
      
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Painel Principal de Devoluções */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 space-y-3">
        
        {/* Header do Painel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-stone-200 dark:border-stone-800">
          <div>
            <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
              Controle & Emissão de Notas de Devolução
            </h3>
            <p className="text-[11px] text-stone-500">
              Registro e controle fiscal de devolução de mercadorias, insumos e peças danificadas/incompatíveis
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar devolução, NF, fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none w-48 sm:w-56"
              />
            </div>

            <CompetenceSelector
              competence={activeCompetence}
              onPrev={handlePrevCompetence}
              onNext={handleNextCompetence}
            />

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nova Nota de Devolução</span>
            </button>
          </div>
        </div>

        {/* Tabela de Devoluções */}
        <div className="border border-slate-300 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-black uppercase sticky top-0 z-20 border-b border-slate-300 dark:border-stone-700 shadow-sm">
                <tr>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">Nº Devolução</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">NF Origem</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">Data</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">Fornecedor / Destinatário</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3">Motivo da Devolução</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3 text-right">Valor Total</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3 text-center">Status</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-stone-800 py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredNotas.length === 0 ? (
                  <tr key="empty_devolucao_rows">
                    <td colSpan={8} className="py-4 text-center text-xs text-stone-500 font-semibold uppercase">
                      NENHUM REGISTRO ENCONTRADO
                    </td>
                  </tr>
                ) : (
                  filteredNotas.map((dev, devIdx) => (
                    <tr key={`devolucao_doc_${dev.id || devIdx}_${devIdx}`} className="even:bg-[#f2f2f2] odd:bg-white dark:even:bg-stone-800/50 dark:odd:bg-stone-900 hover:bg-slate-200/60 dark:hover:bg-stone-800 transition border-b border-slate-200 dark:border-stone-800">
                      <td className="py-2.5 px-3 font-mono font-black text-rose-700 dark:text-rose-400">
                        {dev.devolucaoNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-stone-700 dark:text-stone-300">
                        {dev.originInvoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400">
                        {formatDateBR(dev.issueDate)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-stone-800 dark:text-stone-200">
                        {dev.supplierName}
                      </td>
                      <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[10.5px]">
                          {dev.reason}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-stone-900 dark:text-stone-100">
                        {formatCurrencyBRL(dev.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {dev.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handlePrintEspelho(dev)}
                            className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
                            title="Imprimir Espelho da Nota de Devolução"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = notas.filter(n => n.id !== dev.id);
                              setNotas(updated);
                              saveStoredNotasDevolucao(updated);
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal para Emissão de Nova Nota de Devolução - Tema Oficial Alto Contraste */}
      <NovaNotaDevolucaoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={(newNota) => {
          setNotas(getStoredNotasDevolucao());
          setSuccessMsg(`Nota de Devolução ${newNota.devolucaoNumber} gravada com sucesso!`);
          setTimeout(() => setSuccessMsg(''), 4000);
        }}
      />

    </div>
  );
};
