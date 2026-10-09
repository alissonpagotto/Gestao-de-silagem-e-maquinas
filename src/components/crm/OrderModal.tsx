import React, { useState } from 'react';
import { X, ChevronDown, ShoppingCart } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-xs overflow-hidden overflow-y-hidden">
      <div className="w-full max-w-4xl h-[95vh] flex flex-col justify-between mx-auto my-auto bg-slate-50 dark:bg-stone-900 border border-slate-400 dark:border-stone-700 rounded-lg overflow-hidden global shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header - Moldura Metálica 3D Acetinada */}
        <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 dark:from-stone-800 dark:via-stone-750 dark:to-stone-900 border-b border-slate-400 dark:border-stone-700 text-slate-800 dark:text-stone-100 flex items-center justify-between shrink-0 rounded-t-lg shadow-[inset_1px_1px_0px_rgba(255,255,255,0.9),inset_-1px_-1px_0px_rgba(0,0,0,0.15)]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/80 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center border border-slate-300 dark:border-stone-700 shadow-2xs shrink-0">
              <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-stone-100">
                NOVO PEDIDO DE SILAGEM
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-stone-400 font-medium">
                Venda de volumoso para nutrição animal e agendamento de entrega
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-700 dark:text-stone-200" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-2.5 max-h-[82vh] overflow-y-auto scrollbar-none flex-1 bg-white dark:bg-stone-900 text-xs">
          
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
              PRODUTOR RURAL / CLIENTE <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-9 cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.farmName} ({c.city}/{c.state})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                TIPO DE SILAGEM
              </label>
              <div className="relative">
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400 appearance-none pr-9 cursor-pointer"
                >
                  <option value="Milho Planta Inteira">Milho Planta Inteira</option>
                  <option value="Milho Grão Úmido">Milho Grão Úmido / Snaplage</option>
                  <option value="Sorgo Forrageiro">Sorgo Forrageiro</option>
                  <option value="Capiaçu">BRS Capiaçu</option>
                  <option value="Aveia / Azevém">Aveia / Azevém Pré-Secado</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                DATA PREVISTA DE ENTREGA
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 dark:bg-stone-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-stone-700">
            <div>
              <label className="block text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-0.5">
                VOLUME EM TONELADAS (TON)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={tons}
                onChange={(e) => setTons(e.target.value)}
                placeholder="50"
                className="w-full px-2.5 py-1 sm:py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-800 font-bold text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider mb-0.5">
                PREÇO POR TONELADA (R$/TON)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={pricePerTon}
                onChange={(e) => setPricePerTon(e.target.value)}
                placeholder="440.00"
                className="w-full px-2.5 py-1 sm:py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-stone-800 font-bold text-slate-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Total Preview */}
          <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-stone-100 rounded-xl border border-slate-200 dark:border-stone-700">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-stone-400 uppercase">Valor Total do Pedido:</span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                MODALIDADE DE FRETE
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFreightType('CIF')}
                  className={`py-1 text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                    freightType === 'CIF'
                      ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300'
                  }`}
                >
                  CIF (Entregue)
                </button>
                <button
                  type="button"
                  onClick={() => setFreightType('FOB')}
                  className={`py-1 text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                    freightType === 'FOB'
                      ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white dark:bg-stone-800 border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300'
                  }`}
                >
                  FOB (Retira)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                STATUS DO PAGAMENTO
              </label>
              <div className="relative">
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:ring-1 focus:ring-slate-400 appearance-none pr-8 cursor-pointer"
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
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
              OBSERVAÇÕES / LOCAL DE DESCARREGAMENTO
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Entregar pela manhã na trincheira 2 da Fazenda Bela Vista."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-slate-900 dark:text-stone-100 text-xs font-medium focus:ring-1 focus:ring-slate-400 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-200 dark:border-stone-700 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1 sm:py-1.5 rounded-lg border border-slate-300 dark:border-stone-700 text-slate-700 dark:text-stone-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1 sm:py-1.5 rounded-lg bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold shadow-xs transition cursor-pointer border border-emerald-800"
            >
              Confirmar Pedido
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
