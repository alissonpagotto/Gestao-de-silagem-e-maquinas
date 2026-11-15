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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-[2px] overflow-hidden overflow-y-hidden">
      <div className="w-[88vw] max-w-[1300px] h-[92vh] max-h-[92vh] flex flex-col justify-between mx-auto my-auto bg-[#cad4e6] border border-black rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-slate-900">
        
        {/* Header Oficial (#cad4e6 + border-black) */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] border-b border-black text-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white text-slate-900 flex items-center justify-center border border-black shadow-2xs shrink-0">
              <ShoppingCart className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900">
                NOVO PEDIDO DE SILAGEM
              </h3>
              <p className="text-[11px] text-slate-800 font-medium">
                Venda de volumoso para nutrição animal e agendamento de entrega
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-black transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between bg-[#cad4e6] text-xs">
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3">
            <div className="bg-[#e0e6f1] border border-black rounded-xl p-3.5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  PRODUTOR RURAL / CLIENTE <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-400 bg-white text-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 appearance-none pr-9 cursor-pointer"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.farmName} ({c.city}/{c.state})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    TIPO DE SILAGEM
                  </label>
                  <div className="relative">
                    <select
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-400 bg-white text-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 appearance-none pr-9 cursor-pointer"
                    >
                      <option value="Milho Planta Inteira">Milho Planta Inteira</option>
                      <option value="Milho Grão Úmido">Milho Grão Úmido / Snaplage</option>
                      <option value="Sorgo Forrageiro">Sorgo Forrageiro</option>
                      <option value="Capiaçu">BRS Capiaçu</option>
                      <option value="Aveia / Azevém">Aveia / Azevém Pré-Secado</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    DATA PREVISTA DE ENTREGA
                  </label>
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-400 bg-white text-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#e0e6f1] border border-black rounded-xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    VOLUME EM TONELADAS (TON)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={tons}
                    onChange={(e) => setTons(e.target.value)}
                    placeholder="50"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-400 bg-white font-bold text-black focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    PREÇO POR TONELADA (R$/TON)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={pricePerTon}
                    onChange={(e) => setPricePerTon(e.target.value)}
                    placeholder="440.00"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-400 bg-white font-bold text-black focus:outline-none focus:ring-2 focus:ring-slate-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white text-slate-900 rounded-xl border border-gray-400">
                <span className="text-[11px] font-bold text-slate-800 uppercase">Valor Total do Pedido:</span>
                <span className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                </span>
              </div>
            </div>

            <div className="bg-[#e0e6f1] border border-black rounded-xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    MODALIDADE DE FRETE
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFreightType('CIF')}
                      className={`py-1.5 text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                        freightType === 'CIF'
                          ? 'bg-emerald-600 text-white border-emerald-900 shadow-2xs'
                          : 'bg-white border-gray-400 text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      CIF (Entregue)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFreightType('FOB')}
                      className={`py-1.5 text-xs font-bold rounded-lg border text-center transition cursor-pointer ${
                        freightType === 'FOB'
                          ? 'bg-emerald-600 text-white border-emerald-900 shadow-2xs'
                          : 'bg-white border-gray-400 text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      FOB (Retira)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                    STATUS DO PAGAMENTO
                  </label>
                  <div className="relative">
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-400 bg-white text-black text-xs font-medium focus:ring-2 focus:ring-slate-600 appearance-none pr-8 cursor-pointer"
                    >
                      <option value="pendente">Pendente / A Receber</option>
                      <option value="parcial">Entrada Paga (Parcial)</option>
                      <option value="pago">Quitado / Pago</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1">
                  OBSERVAÇÕES / LOCAL DE DESCARREGAMENTO
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Entregar pela manhã na trincheira 2 da Fazenda Bela Vista."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-400 bg-white text-black text-xs font-medium focus:ring-2 focus:ring-slate-600 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Rodapé Oficial (#cad4e6 + border-black) */}
          <div className="px-4 sm:px-5 py-2.5 bg-[#cad4e6] border-t border-black flex justify-end space-x-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-black bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition cursor-pointer uppercase"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer border border-emerald-900 uppercase"
            >
              Confirmar Pedido
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
