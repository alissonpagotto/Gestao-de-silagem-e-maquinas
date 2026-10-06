import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, 
  Printer, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Clock, 
  Building2, 
  Truck, 
  FileText, 
  Eye, 
  Check, 
  Search,
  Filter
} from 'lucide-react';
import { TireItem, Supplier, CompanyProfile } from '../../types';
import { formatDateBR, formatCurrencyBRL, getStoredCompanyProfile } from '../../lib/storage';

export interface TireReformOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  supplierId?: string;
  supplierName: string;
  supplierCnpj?: string;
  supplierPhone?: string;
  driverName?: string;
  expectedReturnDate?: string;
  status: 'Aguardando Retorno / Nota' | 'Concluído' | 'Cancelado';
  tires: {
    id: string;
    fireNumber: string;
    brand: string;
    model?: string;
    size?: string;
    treadDepthMm?: number;
    vehiclePlate?: string;
    vehicleName?: string;
    notes?: string;
  }[];
  totalTires: number;
  notes?: string;
}

export const REFORM_ORDERS_STORAGE_KEY = 'colaca_silagem_pedidos_reforma_ativos';
export const PENDING_REFORM_TIRES_KEY = 'colaca_silagem_pneus_aguardando_pedido';
export const SUPPLIERS_STORAGE_KEY = 'colaca_silagem_fornecedores';

export function getStoredReformOrders(): TireReformOrder[] {
  try {
    const raw = localStorage.getItem(REFORM_ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao carregar pedidos de reforma ativos:', e);
  }
  return [];
}

export function saveStoredReformOrders(orders: TireReformOrder[]): void {
  try {
    localStorage.setItem(REFORM_ORDERS_STORAGE_KEY, JSON.stringify(orders));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('colaca_silagem_pedidos_reforma_updated', { detail: orders }));
    }
  } catch (e) {
    console.warn('Erro ao salvar pedidos de reforma:', e);
  }
}

export function getStoredPendingReformTires(): TireItem[] {
  try {
    const raw = localStorage.getItem(PENDING_REFORM_TIRES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao carregar pneus aguardando pedido:', e);
  }
  return [];
}

export function getStoredReformSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const standardRaw = localStorage.getItem('silagem_facil_clean_v1_suppliers');
    if (standardRaw) {
      const parsedStd = JSON.parse(standardRaw);
      if (Array.isArray(parsedStd) && parsedStd.length > 0) return parsedStd;
    }
  } catch (e) {
    console.warn('Erro ao carregar fornecedores:', e);
  }
  return [
    { id: 'sup_rec_1', name: 'Bandag Recapagens & Pneus Ltda', tradeName: 'Bandag Recapadora', category: 'Pneus & Recapagem', cnpjOrCpf: '12.345.678/0001-90', phone: '(44) 3622-1020' },
    { id: 'sup_rec_2', name: 'Tipler Reforma de Pneus Agrícolas e Rodoviários', tradeName: 'Tipler Recapagem', category: 'Pneus & Recapagem', cnpjOrCpf: '23.456.789/0001-01', phone: '(44) 3649-5500' },
    { id: 'sup_rec_3', name: 'Vipal Pneus & Reformadora Regional', tradeName: 'Vipal Reformadora', category: 'Pneus & Recapagem', cnpjOrCpf: '34.567.890/0001-12', phone: '(44) 3624-8899' },
  ];
}

interface TireReformOrderViewProps {
  companyProfile?: CompanyProfile;
  initialCreateMode?: boolean;
  onOrderSaved?: (order: TireReformOrder) => void;
}

export const TireReformOrderView: React.FC<TireReformOrderViewProps> = ({
  companyProfile,
  initialCreateMode = false,
  onOrderSaved,
}) => {
  const [orders, setOrders] = useState<TireReformOrder[]>(() => getStoredReformOrders());
  const [isCreatingNewOrder, setIsCreatingNewOrder] = useState<boolean>(initialCreateMode);
  const [selectedOrderForView, setSelectedOrderForView] = useState<TireReformOrder | null>(null);

  // Fornecedores
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => getStoredReformSuppliers());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [customSupplierName, setCustomSupplierName] = useState<string>('');

  // Pneus em buffer para a nova ordem
  const [pendingTires, setPendingTires] = useState<TireItem[]>(() => getStoredPendingReformTires());
  const [driverName, setDriverName] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const company = useMemo(() => companyProfile || getStoredCompanyProfile(), [companyProfile]);

  // Sincroniza quando houver gatilho de novo pedido vindo da frota
  useEffect(() => {
    const handleTrigger = (e: any) => {
      const tires = e?.detail?.tires || getStoredPendingReformTires();
      if (tires && tires.length > 0) {
        setPendingTires(tires);
      }
      setIsCreatingNewOrder(true);
    };

    const handleStorage = () => {
      setOrders(getStoredReformOrders());
      setSuppliers(getStoredReformSuppliers());
      const pTires = getStoredPendingReformTires();
      if (pTires.length > 0) {
        setPendingTires(pTires);
      }
    };

    window.addEventListener('colaca_silagem_abrir_pedido_reforma', handleTrigger);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('colaca_silagem_abrir_pedido_reforma', handleTrigger);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Seleção automática do primeiro fornecedor de recapagem se disponível
  useEffect(() => {
    if (suppliers.length > 0 && !selectedSupplierId) {
      const recap = suppliers.find(s => (s.category || '').toLowerCase().includes('pneu') || (s.name || '').toLowerCase().includes('recap'));
      setSelectedSupplierId(recap ? recap.id : suppliers[0].id);
    }
  }, [suppliers, selectedSupplierId]);

  // Remove um pneu específico da lista de envio
  const handleRemoveTireFromPending = (tireId: string) => {
    const updated = pendingTires.filter(t => t.id !== tireId);
    setPendingTires(updated);
    localStorage.setItem(PENDING_REFORM_TIRES_KEY, JSON.stringify(updated));
  };

  // Salvar Ordem de Envio de Reforma
  const handleSaveOrder = () => {
    if (pendingTires.length === 0) {
      setErrorMessage('Nenhum pneu acumulado para gerar a ordem de reforma.');
      return;
    }

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    const finalSupplierName = selectedSupplier ? (selectedSupplier.tradeName || selectedSupplier.name) : customSupplierName.trim();

    if (!finalSupplierName) {
      setErrorMessage('Por favor, selecione ou informe o Fornecedor / Recapadora.');
      return;
    }

    const nextNumber = String(orders.length + 1).padStart(3, '0');
    const orderNumber = `REF-${new Date().getFullYear()}-${nextNumber}`;

    const newOrder: TireReformOrder = {
      id: `ped_ref_${Date.now()}`,
      orderNumber,
      createdAt: new Date().toISOString(),
      supplierId: selectedSupplierId || undefined,
      supplierName: finalSupplierName,
      supplierCnpj: selectedSupplier?.cnpjOrCpf,
      supplierPhone: selectedSupplier?.phone,
      driverName: driverName.trim() || undefined,
      expectedReturnDate: expectedReturnDate || undefined,
      status: 'Aguardando Retorno / Nota',
      tires: pendingTires.map(t => ({
        id: t.id,
        fireNumber: t.fireNumber,
        brand: t.brand,
        model: t.model,
        size: t.size || '295/80 R 22.5',
        treadDepthMm: t.treadDepthMm,
        vehiclePlate: t.vehiclePlate,
        vehicleName: t.vehicleName,
        notes: t.notes,
      })),
      totalTires: pendingTires.length,
      notes: orderNotes.trim() || undefined,
    };

    const updatedOrders = [newOrder, ...orders];
    setOrders(updatedOrders);
    saveStoredReformOrders(updatedOrders);

    // Limpa a chave de pneus aguardando pedido conforme requisito
    localStorage.removeItem(PENDING_REFORM_TIRES_KEY);
    localStorage.removeItem('colaca_silagem_abrir_pedido_reforma');
    setPendingTires([]);

    setIsCreatingNewOrder(false);
    setSelectedOrderForView(newOrder);
    setSuccessMessage(`Pedido ${orderNumber} registrado com sucesso com status "Aguardando Retorno / Nota"!`);
    setErrorMessage('');

    if (onOrderSaved) {
      onOrderSaved(newOrder);
    }

    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  // Impressão da Ficha A4 com Logotipo e Assinatura
  const handlePrintOrder = (orderToPrint: TireReformOrder) => {
    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Ordem de Envio de Reforma - ${orderToPrint.orderNumber}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
          }
          body {
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.35;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 14px;
          }
          .company-logo {
            font-size: 18pt;
            font-weight: 900;
            color: #0369a1;
            letter-spacing: -0.5px;
          }
          .company-sub {
            font-size: 8.5pt;
            color: #4b5563;
            font-weight: 600;
          }
          .order-badge {
            text-align: right;
          }
          .order-number {
            font-size: 14pt;
            font-weight: 900;
            color: #d97706;
          }
          .order-date {
            font-size: 9pt;
            color: #6b7280;
          }
          .title-section {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
            border-radius: 6px;
            text-align: center;
            font-size: 12pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 14px;
          }
          .info-card {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
            background: #fafafa;
          }
          .info-title {
            font-size: 8pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 3px;
          }
          .info-val {
            font-size: 9.5pt;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th {
            background: #0f172a;
            color: #ffffff;
            font-size: 8.5pt;
            font-weight: 800;
            text-transform: uppercase;
            padding: 6px 8px;
            text-align: left;
            border: 1px solid #0f172a;
          }
          td {
            padding: 6px 8px;
            border: 1px solid #cbd5e1;
            font-size: 9pt;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .total-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 24px;
            font-weight: 800;
            font-size: 10pt;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 40px;
            padding-top: 20px;
          }
          .signature-line {
            border-top: 1px solid #000;
            text-align: center;
            padding-top: 6px;
            font-size: 8.5pt;
          }
          .footer-note {
            margin-top: 24px;
            font-size: 7.5pt;
            color: #94a3b8;
            text-align: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-logo">${company.tradeName || 'COLACA SILAGEM'}</div>
            <div class="company-sub">Gestão Integrada de Frotas, Logística & Suprimentos</div>
            ${company.cnpj ? `<div class="company-sub">CNPJ: ${company.cnpj}</div>` : ''}
          </div>
          <div class="order-badge">
            <div class="order-number">${orderToPrint.orderNumber}</div>
            <div class="order-date">Emissão: ${formatDateBR(orderToPrint.createdAt)}</div>
            <div class="order-date" style="font-weight: bold; color: #d97706;">Status: ${orderToPrint.status}</div>
          </div>
        </div>

        <div class="title-section">
          Ordem de Envio de Pneus para Reforma (Recapagem)
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="info-title">Destinatário / Recapadora</div>
            <div class="info-val">${orderToPrint.supplierName}</div>
            ${orderToPrint.supplierCnpj ? `<div style="font-size: 8.5pt; color: #4b5563;">CNPJ: ${orderToPrint.supplierCnpj}</div>` : ''}
            ${orderToPrint.supplierPhone ? `<div style="font-size: 8.5pt; color: #4b5563;">Tel: ${orderToPrint.supplierPhone}</div>` : ''}
          </div>
          <div class="info-card">
            <div class="info-title">Responsável pelo Transporte / Motorista</div>
            <div class="info-val">${orderToPrint.driverName || 'Motorista da Frota'}</div>
            ${orderToPrint.expectedReturnDate ? `<div style="font-size: 8.5pt; color: #4b5563;">Previsão de Retorno: ${formatDateBR(orderToPrint.expectedReturnDate)}</div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">Item</th>
              <th style="width: 95px;">Nº de Fogo</th>
              <th>Marca / Modelo</th>
              <th style="width: 110px;">Medida</th>
              <th style="width: 100px;">Veículo Origem</th>
              <th style="width: 75px; text-align: center;">Sulco</th>
              <th>Observação do Pneu</th>
            </tr>
          </thead>
          <tbody>
            ${orderToPrint.tires.map((t, idx) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-family: monospace; font-weight: 900; font-size: 10pt;">${t.fireNumber}</td>
                <td>${t.brand} ${t.model || ''}</td>
                <td style="font-family: monospace; font-weight: bold;">${t.size || '295/80 R 22.5'}</td>
                <td>${t.vehiclePlate || t.vehicleName || 'Frota Geral'}</td>
                <td style="text-align: center; font-weight: bold;">${t.treadDepthMm ? `${t.treadDepthMm.toFixed(1)} mm` : '-'}</td>
                <td style="font-size: 8pt; color: #4b5563;">${t.notes || 'Reforma / Recape'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-box">
          <span>QUANTIDADE TOTAL DE PNEUS ENVIADOS:</span>
          <span>${orderToPrint.totalTires} PNEU(S)</span>
        </div>

        ${orderToPrint.notes ? `
          <div style="font-size: 8.5pt; color: #4b5563; margin-bottom: 20px; padding: 6px; border-left: 3px solid #cbd5e1;">
            <strong>Observações do Pedido:</strong> ${orderToPrint.notes}
          </div>
        ` : ''}

        <div class="signatures">
          <div>
            <div class="signature-line">
              <strong>${orderToPrint.driverName || 'Motorista / Entregador'}</strong><br/>
              Assinatura do Motorista • Data: ___/___/______
            </div>
          </div>
          <div>
            <div class="signature-line">
              <strong>${orderToPrint.supplierName}</strong><br/>
              Recebido na Recapadora (Nome Legível / Carimbo)
            </div>
          </div>
        </div>

        <div class="footer-note">
          Via de remessa para recapadora. Imagem de documento gerada eletronicamente pelo sistema Colaca Silagem.
        </div>
      </body>
      </html>
    `;

    // 1. Tenta abrir em nova janela via window.open (conforme requisito)
    try {
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(printHtml);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
        }, 300);
        return;
      }
    } catch (e) {
      console.warn('Popup bloqueado, utilizando fallback de iframe:', e);
    }

    // 2. Fallback resiliente via iframe invisível para contornar restrições de sandbox
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
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }, 300);
    }
  };

  // Filtragem da lista histórica de ordens
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(o => 
      o.orderNumber.toLowerCase().includes(term) ||
      o.supplierName.toLowerCase().includes(term) ||
      o.tires.some(t => t.fireNumber.toLowerCase().includes(term))
    );
  }, [orders, searchTerm]);

  return (
    <div className="w-full space-y-4">
      
      {/* Alertas */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-emerald-800 dark:text-emerald-200 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-rose-800 dark:text-rose-200 text-xs font-bold animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================
          MODO 1: FORMULÁRIO DE PEDIDO DE ENTRADA DE REFORMA (PASSO 2)
          ======================================================== */}
      {isCreatingNewOrder ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 sm:p-5 space-y-4 animate-in fade-in">
          
          {/* Header do Formulário */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                <Wrench className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                  Pedido de Entrada de Reforma (Envio à Recapadora)
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">
                  {pendingTires.length} {pendingTires.length === 1 ? 'pneu selecionado' : 'pneus selecionados'} da frota aguardando emissão da ordem
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsCreatingNewOrder(false)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao Histórico</span>
              </button>
            </div>
          </div>

          {/* Cabeçalho do Pedido: Dropdown Select para escolher o Fornecedor / Recapadora */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Fornecedor / Recapadora <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">Selecione a Recapadora...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.tradeName || s.name} {s.cnpjOrCpf ? `(${s.cnpjOrCpf})` : ''}
                    </option>
                  ))}
                  <option value="outro">+ Outro Fornecedor / Digitar Nome</option>
                </select>
              </div>

              {selectedSupplierId === 'outro' && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Digite a Razão Social da Recapadora..."
                    value={customSupplierName}
                    onChange={(e) => setCustomSupplierName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white text-stone-900 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Motorista / Responsável pelo Envio
              </label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Previsão de Retorno da Recapagem
              </label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

          </div>

          {/* Corpo: Tabela indexada listando todos os pneus que o usuário arrastou da frota */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                Relação Indexada de Pneus para Reforma ({pendingTires.length})
              </h4>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                Pneus fixos capturados da Gestão de Frotas
              </span>
            </div>

            <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-black uppercase sticky top-0 z-10 border-b border-stone-200 dark:border-stone-700">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3">Nº de Fogo</th>
                      <th className="py-2.5 px-3">Marca</th>
                      <th className="py-2.5 px-3">Modelo da Banda</th>
                      <th className="py-2.5 px-3">Medida (Fixa)</th>
                      <th className="py-2.5 px-3">Veículo / Placa</th>
                      <th className="py-2.5 px-3 text-center">Sulco</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {pendingTires.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-xs text-stone-400 font-medium">
                          Nenhum pneu acumulado. Retorne à Gestão de Frotas e arraste os pneus para a caixa de Reforma.
                        </td>
                      </tr>
                    ) : (
                      pendingTires.map((t, idx) => (
                        <tr key={t.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition">
                          <td className="py-2 px-3 text-center font-bold text-stone-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-stone-900 dark:text-stone-100">
                            {t.fireNumber}
                          </td>
                          <td className="py-2 px-3 font-semibold text-stone-700 dark:text-stone-300">
                            {t.brand}
                          </td>
                          <td className="py-2 px-3 text-stone-600 dark:text-stone-400">
                            {t.model || 'Padrão'}
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-amber-700 dark:text-amber-400">
                            {t.size || '295/80 R 22.5'}
                          </td>
                          <td className="py-2 px-3 font-bold text-stone-700 dark:text-stone-300">
                            {t.vehiclePlate || t.vehicleName || 'Frota Geral'}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-stone-600 dark:text-stone-400">
                            {t.treadDepthMm ? `${t.treadDepthMm.toFixed(1)} mm` : '-'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveTireFromPending(t.id)}
                              className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer transition"
                              title="Remover deste pedido de envio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
              Observações Gerais do Pedido
            </label>
            <input
              type="text"
              placeholder="Instruções para a recapadora (ex: tipo de desenho da banda, prazo de entrega urgente)..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Botões do Formulário de Pedido */}
          <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            <div className="text-xs text-stone-500 font-medium">
              💡 Ao salvar, o documento fica registrado com o status <strong className="text-amber-600">"Aguardando Retorno / Nota"</strong>.
            </div>

            <div className="flex items-center space-x-2.5">
              
              {/* Botão Imprimir Ficha / Pedido de Envio (Requisito 2) */}
              <button
                type="button"
                id="btn-imprimir-pedido-envio"
                onClick={() => {
                  const selSup = suppliers.find(s => s.id === selectedSupplierId);
                  const tempOrder: TireReformOrder = {
                    id: 'temp_print',
                    orderNumber: `REF-${new Date().getFullYear()}-PRÉVIA`,
                    createdAt: new Date().toISOString(),
                    supplierName: selSup ? (selSup.tradeName || selSup.name) : (customSupplierName || 'Recapadora'),
                    supplierCnpj: selSup?.cnpjOrCpf,
                    supplierPhone: selSup?.phone,
                    driverName,
                    expectedReturnDate,
                    status: 'Aguardando Retorno / Nota',
                    tires: pendingTires.map(t => ({
                      id: t.id,
                      fireNumber: t.fireNumber,
                      brand: t.brand,
                      model: t.model,
                      size: t.size || '295/80 R 22.5',
                      treadDepthMm: t.treadDepthMm,
                      vehiclePlate: t.vehiclePlate,
                      vehicleName: t.vehicleName,
                    })),
                    totalTires: pendingTires.length,
                    notes: orderNotes,
                  };
                  handlePrintOrder(tempOrder);
                }}
                disabled={pendingTires.length === 0}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4 text-stone-600" />
                <span>🖨️ Imprimir Pedido de Envio</span>
              </button>

              {/* Botão Salvar Ordem */}
              <button
                type="button"
                id="btn-salvar-pedido-reforma"
                onClick={handleSaveOrder}
                disabled={pendingTires.length === 0}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-black rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-stone-950 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Pedido de Reforma</span>
              </button>

            </div>

          </div>

        </div>
      ) : (
        /* ========================================================
           MODO 2: TABELA HISTÓRICA DE PEDIDOS DE REFORMA
           ======================================================== */
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 space-y-3">
          
          {/* Header da Tabela Histórica */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h3 className="text-sm font-black text-stone-900 dark:text-stone-100 font-['Outfit']">
                Histórico de Pedidos de Reforma de Pneus
              </h3>
              <p className="text-[11px] text-stone-500">
                Acompanhamento de ordens de remessa e status de retorno da recapadora
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar ordem, recapadora..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none w-48 sm:w-56"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingNewOrder(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-black shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Pedido de Reforma</span>
              </button>
            </div>
          </div>

          {/* Tabela de Ordens */}
          <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-2xs">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-black uppercase sticky top-0 z-10 border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th className="py-2.5 px-3">Nº do Pedido</th>
                    <th className="py-2.5 px-3">Data de Envio</th>
                    <th className="py-2.5 px-3">Fornecedor / Recapadora</th>
                    <th className="py-2.5 px-3 text-center">Qtd. Pneus</th>
                    <th className="py-2.5 px-3">Pneus (Nº de Fogo)</th>
                    <th className="py-2.5 px-3">Motorista</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-stone-400 font-medium">
                        Nenhum pedido de reforma registrado. Use a Gestão de Frotas para arrastar pneus e gerar uma nova ordem.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/60 transition">
                        <td className="py-2.5 px-3 font-mono font-black text-amber-700 dark:text-amber-400">
                          {order.orderNumber}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400">
                          {formatDateBR(order.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-stone-800 dark:text-stone-200">
                          {order.supplierName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black">
                          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[11px]">
                            {order.totalTires}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-stone-700 dark:text-stone-300 max-w-[200px] truncate" title={order.tires.map(t => t.fireNumber).join(', ')}>
                          {order.tires.map(t => t.fireNumber).join(', ')}
                        </td>
                        <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400">
                          {order.driverName || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                            order.status === 'Concluído'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              type="button"
                              onClick={() => handlePrintOrder(order)}
                              className="p-1.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
                              title="Imprimir Pedido de Envio (Ficha A4)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {order.status !== 'Concluído' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = orders.map(o => o.id === order.id ? { ...o, status: 'Concluído' as const } : o);
                                  setOrders(updated);
                                  saveStoredReformOrders(updated);
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-black rounded-lg transition cursor-pointer"
                                title="Marcar como Concluído / Retornado"
                              >
                                ✓ Concluir
                              </button>
                            )}
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
      )}

    </div>
  );
};
