import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { SilageOrder, Client } from '../../types';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: SilageOrder) => void;
  clients: Client[];
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
}) => {
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [productType, setProductType] = useState<any>('Milho Planta Inteira');
  const [tons, setTons] = useState<string>('50');
  const [pricePerTon, setPricePerTon] = useState<string>('440');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [freightType, setFreightType] = useState<'CIF' | 'FOB'>('CIF');
  const [freightCost, setFreightCost] = useState<string>('1500');
  const [status, setStatus] = useState<any>('confirmado');
  const [paymentStatus, setPaymentStatus] = useState<any>('pendente');
  const [notes, setNotes] = useState('');

  const parsedTons = parseFloat(tons) || 0;
  const parsedPrice = parseFloat(pricePerTon) || 0;
  const totalAmount = parsedTons * parsedPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClient = clients.find((c) => c.id === clientId) || clients[0];

    const newOrder: SilageOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      clientId: selectedClient ? selectedClient.id : 'cli_temp',
      clientName: selectedClient ? selectedClient.name : 'Cliente Avulso',
      farmName: selectedClient ? selectedClient.farmName : 'Propriedade Rural',
      productType,
      tons: parsedTons,
      pricePerTon: parsedPrice,
      totalAmount,
      deliveryDate,
      freightType,
      freightCost: freightType === 'CIF' ? parseFloat(freightCost) || 0 : 0,
      status,
      paymentStatus,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    onSave(newOrder);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-xl w-full shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Standardized Solid Teal Bar */}
        <div className="px-5 py-3.5 bg-[#009688] text-white flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              Novo Pedido de Silagem
            </h3>
            <p className="text-xs text-white/80">
              Venda de volumoso para nutrição animal
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          
          <div>
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
              PRODUTOR RURAL / CLIENTE <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688] appearance-none pr-9"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.farmName} ({c.city}/{c.state})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                TIPO DE SILAGEM
              </label>
              <div className="relative">
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688] appearance-none pr-9"
                >
                  <option value="Milho Planta Inteira">Milho Planta Inteira</option>
                  <option value="Milho Grão Úmido">Milho Grão Úmido / Snaplage</option>
                  <option value="Sorgo Forrageiro">Sorgo Forrageiro</option>
                  <option value="Capiaçu">BRS Capiaçu</option>
                  <option value="Aveia / Azevém">Aveia / Azevém Pré-Secado</option>
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                DATA PREVISTA DE ENTREGA
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#009688]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
            <div>
              <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-1">
                VOLUME EM TONELADAS (TON)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={tons}
                onChange={(e) => setTons(e.target.value)}
                placeholder="50"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-800 font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#009688]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-1">
                PREÇO POR TONELADA (R$/TON)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={pricePerTon}
                onChange={(e) => setPricePerTon(e.target.value)}
                placeholder="440.00"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-800 font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#009688]"
              />
            </div>
          </div>

          {/* Total Preview */}
          <div className="flex items-center justify-between p-3.5 bg-stone-900 text-white rounded-xl">
            <span className="text-xs text-stone-300 font-bold">Valor Total do Pedido:</span>
            <span className="text-lg font-extrabold text-emerald-400 font-mono">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                MODALIDADE DE FRETE
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFreightType('CIF')}
                  className={`py-2 text-xs font-bold rounded-xl border text-center transition ${
                    freightType === 'CIF'
                      ? 'bg-[#1b5e20] text-white border-[#1b5e20] shadow-xs'
                      : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  CIF (Entregue)
                </button>
                <button
                  type="button"
                  onClick={() => setFreightType('FOB')}
                  className={`py-2 text-xs font-bold rounded-xl border text-center transition ${
                    freightType === 'FOB'
                      ? 'bg-[#1b5e20] text-white border-[#1b5e20] shadow-xs'
                      : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  FOB (Retira)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
                STATUS DO PAGAMENTO
              </label>
              <div className="relative">
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:ring-2 focus:ring-[#009688] appearance-none pr-8"
                >
                  <option value="pendente">Pendente / A Receber</option>
                  <option value="parcial">Entrada Paga (Parcial)</option>
                  <option value="pago">Quitado / Pago</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider mb-1">
              OBSERVAÇÕES / LOCAL DE DESCARREGAMENTO
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Entregar pela manhã na trincheira 2 da Fazenda Bela Vista."
              className="w-full p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-medium focus:ring-2 focus:ring-[#009688] resize-none"
            />
          </div>

          {/* Footer - Standardized */}
          <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-[#156f33] hover:bg-[#0e5224] text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
            >
              Confirmar Pedido
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
