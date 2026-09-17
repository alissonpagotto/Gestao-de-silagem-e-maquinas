import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Printer, 
  RotateCcw, 
  Check, 
  Fuel, 
  Clock, 
  Truck, 
  Tractor, 
  Scissors,
  Save,
  Phone
} from 'lucide-react';
import { CompanyProfile, Machinery, Employee, Client } from '../../types';

interface FieldFormsViewProps {
  companyProfile?: CompanyProfile;
  machineries?: Machinery[];
  employees?: Employee[];
  clients?: Client[];
}

export const FieldFormsView: React.FC<FieldFormsViewProps> = ({
  companyProfile,
  machineries = [],
  employees = [],
  clients = [],
}) => {
  const [activeFormTab, setActiveFormTab] = useState<'corte' | 'compactacao' | 'cargas'>('corte');

  // Cabeçalho da Empresa Reativo
  const companyLogo = companyProfile?.logoUrl;
  const companyCnpj = companyProfile?.cnpjCpf || '46.097.636/0001-02';
  const companyTradeName = companyProfile?.tradeName || companyProfile?.corporateName || 'COLAÇA SILAGEM';
  const companyAddress = companyProfile?.address 
    ? `${companyProfile.address}${companyProfile.city ? ` - ${companyProfile.city}` : ''}${companyProfile.state ? ` - ${companyProfile.state}` : ''}`
    : 'Linha Santa Maria - Dois Vizinhos - PR';
  const companyPhone = companyProfile?.phone || '46. 99904-8279';

  // -------------------------------------------------------------
  // ESTADO FORMULÁRIO 1: PEDIDO DE CORTE (Operador da Forrageira)
  // -------------------------------------------------------------
  const [f1Data, setF1Data] = useState({
    data: new Date().toLocaleDateString('pt-BR'),
    cliente: '',
    endereco: '',
    cidade: '',
    uf: 'PR',
    cnpjCpf: '',
    inscrEst: '',
    condPagto: 'À Vista / Safra',
    fone: '',
    numMaquina: '',
    operador: '',
    hectares: '',
    valorHaHr: '',
    valorTotalCorte: '',
    hrT: '',
    hrM: '',
    caminhoes: [
      { id: 1, placa: '', motorista: '', cargas: '', km: '' },
      { id: 2, placa: '', motorista: '', cargas: '', km: '' },
      { id: 3, placa: '', motorista: '', cargas: '', km: '' },
      { id: 4, placa: '', motorista: '', cargas: '', km: '' },
      { id: 5, placa: '', motorista: '', cargas: '', km: '' },
    ],
    valorTotalCaminhoes: '',
    tratorNum: '',
    tratorValorHr: '',
    tratorValorTotal: '',
    tratorOperador: '',
    tratorTotalHoras: '',
    obs: '',
    totalGeral: '',
  });

  // Atualização de caminhões no Form 1
  const handleTruckChange = (index: number, field: string, value: string) => {
    const updated = [...f1Data.caminhoes];
    updated[index] = { ...updated[index], [field]: value };
    setF1Data(prev => ({ ...prev, caminhoes: updated }));
  };

  // -------------------------------------------------------------
  // ESTADO FORMULÁRIO 2: CONTROLE COMPACTAÇÃO (Operador do Trator)
  // -------------------------------------------------------------
  const [f2Data, setF2Data] = useState({
    dataInicial: new Date().toLocaleDateString('pt-BR'),
    dataFinal: '',
    cliente: '',
    numTrator: '',
    operadorTrator: '',
    numMaquina: '',
    operadorMaquina: '',
    hrInicial: '',
    hrFinal: '',
    totalHr: '',
    valorHr: '',
    valorTotal: '',
    // Seção Acoplada de Abastecimento
    abastData: new Date().toLocaleDateString('pt-BR'),
    abastPosto: '',
    abastLitros: '',
    abastValorLitro: '',
    abastHr: '',
    abastValorTotal: '',
    abastObs: '',
  });

  // -------------------------------------------------------------
  // ESTADO FORMULÁRIO 3: CONTROLE DE CARGAS (Demais Veículos / Caminhões)
  // -------------------------------------------------------------
  const [f3Data, setF3Data] = useState({
    data: new Date().toLocaleDateString('pt-BR'),
    cliente: '',
    endereco: '',
    placa: '',
    motorista: '',
    maquina: '',
    selectedLoads: new Set<number>(),
    qtdeCargasLonge: '',
    km: '',
    // Seção Acoplada de Abastecimento
    abastPosto: '',
    abastLitros: '',
    abastValorPorLitro: '',
    abastKm: '',
    abastValorTotal: '',
    abastHr: '',
    abastObs: '',
  });

  // Toggle do grid de 01 a 64
  const toggleLoadCell = (num: number) => {
    const next = new Set(f3Data.selectedLoads);
    if (next.has(num)) {
      next.delete(num);
    } else {
      next.add(num);
    }
    setF3Data(prev => ({ ...prev, selectedLoads: next }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      
      {/* Barra de Seleção entre os 3 Formulários de Campo */}
      <div className="no-print bg-[#204e87] dark:bg-stone-900 p-2 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-sm border border-blue-400/30">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveFormTab('corte')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeFormTab === 'corte'
                ? 'bg-[#188038] text-white shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>1. Pedido de Corte (Forrageira)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFormTab('compactacao')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeFormTab === 'compactacao'
                ? 'bg-[#188038] text-white shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Tractor className="w-3.5 h-3.5" />
            <span>2. Controle de Compactação (Trator)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFormTab('cargas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeFormTab === 'cargas'
                ? 'bg-[#188038] text-white shadow-xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>3. Controle de Cargas (01 a 64)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Imprimir Formulário / Salvar PDF"
          >
            <Printer className="w-3.5 h-3.5 text-stone-700" />
            <span>Imprimir Bloco</span>
          </button>
        </div>
      </div>

      {/* ÁREA DE EXIBIÇÃO DO FORMULÁRIO SELECIONADO */}
      <div className="w-full flex justify-center py-2">
        
        {/* ========================================================================= */}
        {/* 1. FORMULÁRIO DE PEDIDO DE CORTE (Operador da Forrageira) */}
        {/* ========================================================================= */}
        {activeFormTab === 'corte' && (
          <div className="w-full max-w-4xl bg-white text-stone-900 border-2 border-stone-800 rounded-xl p-4 sm:p-6 shadow-xl font-sans text-xs space-y-3 print:border-none print:shadow-none print:p-0">
            
            {/* Cabeçalho Oficial Dinâmico */}
            <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3 gap-2">
              <div className="flex items-center gap-3">
                {companyLogo ? (
                  <img 
                    src={companyLogo} 
                    alt={companyTradeName} 
                    className="h-16 w-auto max-w-[150px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="border-2 border-stone-900 rounded-md px-3 py-1 font-black text-xl tracking-tighter bg-stone-100 text-stone-900">
                    {companyTradeName}
                  </div>
                )}
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase">{companyTradeName}</h2>
                  <p className="text-[11px] font-semibold text-stone-600">CNPJ: {companyCnpj}</p>
                  <p className="text-[10px] text-stone-500">{companyAddress}</p>
                  <p className="text-[11px] font-bold text-stone-800 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-[#188038]" />
                    {companyPhone}
                  </p>
                </div>
              </div>

              {/* Badge Verde PEDIDO 0001 */}
              <div className="text-center shrink-0">
                <div className="bg-[#188038] text-white px-5 py-1 rounded-md font-black text-sm uppercase tracking-wider shadow-xs">
                  PEDIDO
                </div>
                <div className="text-rose-600 font-mono font-black text-lg mt-1 tracking-widest">
                  0001
                </div>
              </div>
            </div>

            {/* Linhas de Dados Iniciais */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
              <div className="sm:col-span-3 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Data:</span>
                <input 
                  type="text" 
                  value={f1Data.data} 
                  onChange={e => setF1Data({...f1Data, data: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="DD/MM/AAAA"
                />
              </div>
              <div className="sm:col-span-9 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Cliente:</span>
                <input 
                  type="text" 
                  value={f1Data.cliente} 
                  onChange={e => setF1Data({...f1Data, cliente: e.target.value})}
                  list="clients-f1-list"
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Nome do produtor / fazenda"
                />
                <datalist id="clients-f1-list">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div className="sm:col-span-12 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Endereço:</span>
                <input 
                  type="text" 
                  value={f1Data.endereco} 
                  onChange={e => setF1Data({...f1Data, endereco: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Linha, estrada ou ponto de referência"
                />
              </div>

              <div className="sm:col-span-8 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Cidade:</span>
                <input 
                  type="text" 
                  value={f1Data.cidade} 
                  onChange={e => setF1Data({...f1Data, cidade: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>
              <div className="sm:col-span-4 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">UF:</span>
                <input 
                  type="text" 
                  value={f1Data.uf} 
                  onChange={e => setF1Data({...f1Data, uf: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 uppercase" 
                />
              </div>

              <div className="sm:col-span-6 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">CNPJ/CPF:</span>
                <input 
                  type="text" 
                  value={f1Data.cnpjCpf} 
                  onChange={e => setF1Data({...f1Data, cnpjCpf: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>
              <div className="sm:col-span-6 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Inscr. Est. / RG:</span>
                <input 
                  type="text" 
                  value={f1Data.inscrEst} 
                  onChange={e => setF1Data({...f1Data, inscrEst: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>

              <div className="sm:col-span-6 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Cond. de Pagto.:</span>
                <input 
                  type="text" 
                  value={f1Data.condPagto} 
                  onChange={e => setF1Data({...f1Data, condPagto: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>
              <div className="sm:col-span-6 flex items-center gap-1 border-b border-stone-300 pb-1">
                <span className="font-bold text-stone-700">Fone(s):</span>
                <input 
                  type="text" 
                  value={f1Data.fone} 
                  onChange={e => setF1Data({...f1Data, fone: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                />
              </div>
            </div>

            {/* Linha Máquina e Operador (Barra Cinza) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-200 p-2 rounded-md font-bold uppercase">
              <div className="flex items-center gap-1.5">
                <span>Nº DA MÁQUINA:</span>
                <input 
                  type="text" 
                  value={f1Data.numMaquina} 
                  onChange={e => setF1Data({...f1Data, numMaquina: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="Ex: Forrageira 01"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>OPERADOR:</span>
                <input 
                  type="text" 
                  value={f1Data.operador} 
                  onChange={e => setF1Data({...f1Data, operador: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="Nome do operador"
                />
              </div>
            </div>

            {/* Linha Hectares e Valor ha/hr */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-200 p-2 rounded-md font-bold uppercase">
              <div className="flex items-center gap-1.5">
                <span>HECTARES:</span>
                <input 
                  type="text" 
                  value={f1Data.hectares} 
                  onChange={e => setF1Data({...f1Data, hectares: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="0,00 ha"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>VALOR HA / HR:</span>
                <input 
                  type="text" 
                  value={f1Data.valorHaHr} 
                  onChange={e => setF1Data({...f1Data, valorHaHr: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* HR / T | HR / M | VALOR TOTAL R$ */}
            <div className="grid grid-cols-3 gap-2 bg-stone-200 p-2 rounded-md font-bold uppercase text-center">
              <div className="flex items-center justify-center gap-1">
                <span>HR / T:</span>
                <input 
                  type="text" 
                  value={f1Data.hrT} 
                  onChange={e => setF1Data({...f1Data, hrT: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-20 text-center text-stone-900" 
                />
              </div>
              <div className="flex items-center justify-center gap-1">
                <span>HR / M:</span>
                <input 
                  type="text" 
                  value={f1Data.hrM} 
                  onChange={e => setF1Data({...f1Data, hrM: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-20 text-center text-stone-900" 
                />
              </div>
              <div className="flex items-center justify-center gap-1">
                <span>VALOR TOTAL R$:</span>
                <input 
                  type="text" 
                  value={f1Data.valorTotalCorte} 
                  onChange={e => setF1Data({...f1Data, valorTotalCorte: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-28 text-center text-stone-900 font-black" 
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* Grid dos Caminhões (Até 5 linhas com fundo verde suave idêntico ao modelo) */}
            <div className="space-y-1">
              {f1Data.caminhoes.map((c, idx) => (
                <div 
                  key={c.id} 
                  className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 bg-[#e0f0e3] p-1.5 rounded font-bold uppercase items-center"
                >
                  <div className="sm:col-span-3 flex items-center gap-1">
                    <span className="text-[11px] shrink-0">CAM. PLACA:</span>
                    <input 
                      type="text" 
                      value={c.placa} 
                      onChange={e => handleTruckChange(idx, 'placa', e.target.value)}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-stone-900" 
                      placeholder="ABC-1234"
                    />
                  </div>
                  <div className="sm:col-span-5 flex items-center gap-1">
                    <span className="text-[10px] text-stone-600 shrink-0">MOTORISTA:</span>
                    <input 
                      type="text" 
                      value={c.motorista} 
                      onChange={e => handleTruckChange(idx, 'motorista', e.target.value)}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-stone-900" 
                      placeholder="Nome"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-[11px] shrink-0">CARGAS:</span>
                    <input 
                      type="number" 
                      value={c.cargas} 
                      onChange={e => handleTruckChange(idx, 'cargas', e.target.value)}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center text-stone-900" 
                      placeholder="0"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-[11px] shrink-0">KM:</span>
                    <input 
                      type="text" 
                      value={c.km} 
                      onChange={e => handleTruckChange(idx, 'km', e.target.value)}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center text-stone-900" 
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Linha Valor Total dos Caminhões */}
            <div className="bg-stone-200 p-2 rounded font-bold uppercase flex items-center justify-between">
              <span>VALOR TOTAL DOS CAMINHÕES R$:</span>
              <input 
                type="text" 
                value={f1Data.valorTotalCaminhoes} 
                onChange={e => setF1Data({...f1Data, valorTotalCaminhoes: e.target.value})}
                className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-36 text-right font-black text-stone-900" 
                placeholder="R$ 0,00"
              />
            </div>

            {/* Seção COMPACTAÇÃO - HORÍMETRO (Barra Preta) */}
            <div className="bg-stone-900 text-white text-center py-1 rounded font-black text-xs uppercase tracking-wider">
              COMPACTAÇÃO - HORÍMETRO
            </div>

            {/* Grade de Compactação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-200 p-2 rounded font-bold uppercase">
              <div className="flex items-center gap-1.5">
                <span>Nº TRATOR:</span>
                <input 
                  type="text" 
                  value={f1Data.tratorNum} 
                  onChange={e => setF1Data({...f1Data, tratorNum: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>VALOR HR:</span>
                <input 
                  type="text" 
                  value={f1Data.tratorValorHr} 
                  onChange={e => setF1Data({...f1Data, tratorValorHr: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>OPERADOR:</span>
                <input 
                  type="text" 
                  value={f1Data.tratorOperador} 
                  onChange={e => setF1Data({...f1Data, tratorOperador: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>TOTAL DE HORAS:</span>
                <input 
                  type="text" 
                  value={f1Data.tratorTotalHoras} 
                  onChange={e => setF1Data({...f1Data, tratorTotalHoras: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-stone-900" 
                />
              </div>
            </div>

            {/* Obs e TOTAL R$ */}
            <div className="border-b border-stone-300 pb-2">
              <span className="font-bold text-stone-700">OBS.:</span>
              <input 
                type="text" 
                value={f1Data.obs} 
                onChange={e => setF1Data({...f1Data, obs: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 mt-1" 
                placeholder="Observações complementares do pedido de corte"
              />
            </div>

            {/* Rodapé com 'Obrigado pela preferência!' e 'TOTAL R$' */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 items-center">
              <div className="sm:col-span-6 border-2 border-[#188038] rounded-lg p-2 text-center">
                <span className="font-serif italic text-lg sm:text-xl font-bold text-[#188038]">
                  Obrigado pela preferência!
                </span>
              </div>
              
              <div className="sm:col-span-6 flex items-center bg-stone-900 text-white rounded-lg overflow-hidden border border-stone-900">
                <span className="bg-stone-900 px-4 py-2 font-black text-sm uppercase tracking-wider shrink-0">
                  TOTAL R$
                </span>
                <input 
                  type="text" 
                  value={f1Data.totalGeral} 
                  onChange={e => setF1Data({...f1Data, totalGeral: e.target.value})}
                  className="w-full bg-white text-stone-950 px-3 py-2 text-sm sm:text-base font-black text-right border-none focus:ring-0" 
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* Campo de Assinatura do Cliente */}
            <div className="pt-6 pb-2 text-center">
              <div className="w-72 mx-auto border-t border-stone-700 pt-1 text-[11px] font-semibold text-stone-700">
                Assinatura do Cliente
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. FORMULÁRIO DE CONTROLE DE COMPACTAÇÃO (Operador do Trator) */}
        {/* ========================================================================= */}
        {activeFormTab === 'compactacao' && (
          <div className="w-full max-w-2xl bg-white text-stone-900 border-2 border-stone-800 rounded-xl p-4 sm:p-6 shadow-xl font-sans text-xs space-y-3.5 print:border-none print:shadow-none print:p-0">
            
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                {companyLogo ? (
                  <img 
                    src={companyLogo} 
                    alt={companyTradeName} 
                    className="h-14 w-auto max-w-[130px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="border-2 border-stone-900 rounded-md px-2.5 py-1 font-black text-base bg-stone-100">
                    {companyTradeName}
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-black uppercase">{companyTradeName}</h2>
                  <p className="text-[10px] font-bold text-stone-600">CNPJ: {companyCnpj}</p>
                  <p className="text-[10px] text-stone-500">{companyAddress}</p>
                  <p className="text-[10px] font-bold text-stone-800 flex items-center gap-1 mt-0.5">
                    <Phone className="w-2.5 h-2.5 text-[#188038]" />
                    {companyPhone}
                  </p>
                </div>
              </div>

              {/* Título Verde CONTROLE COMPACTAÇÃO */}
              <div className="text-right shrink-0">
                <span className="font-black text-sm sm:text-base text-[#188038] uppercase tracking-tight block">
                  CONTROLE COMPACTAÇÃO
                </span>
                <span className="text-[10px] font-mono text-stone-500 font-bold">LIVRO DE CAMPO</span>
              </div>
            </div>

            {/* Linha Datas e Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-stone-300 pb-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Data Inicial:</span>
                <input 
                  type="text" 
                  value={f2Data.dataInicial} 
                  onChange={e => setF2Data({...f2Data, dataInicial: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="DD/MM/AAAA"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Data Final:</span>
                <input 
                  type="text" 
                  value={f2Data.dataFinal} 
                  onChange={e => setF2Data({...f2Data, dataFinal: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="DD/MM/AAAA"
                />
              </div>
            </div>

            <div className="border-b border-stone-300 pb-1 flex items-center gap-1">
              <span className="font-bold text-stone-700">Cliente:</span>
              <input 
                type="text" 
                value={f2Data.cliente} 
                onChange={e => setF2Data({...f2Data, cliente: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                placeholder="Nome do cliente produtor"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-stone-300 pb-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Nº Trator:</span>
                <input 
                  type="text" 
                  value={f2Data.numTrator} 
                  onChange={e => setF2Data({...f2Data, numTrator: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Ex: Trator 04"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Operador:</span>
                <input 
                  type="text" 
                  value={f2Data.operadorTrator} 
                  onChange={e => setF2Data({...f2Data, operadorTrator: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Operador do trator"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-stone-300 pb-1">
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Nº Máquina:</span>
                <input 
                  type="text" 
                  value={f2Data.numMaquina} 
                  onChange={e => setF2Data({...f2Data, numMaquina: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Ex: Forrageira 01"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-stone-700">Operador:</span>
                <input 
                  type="text" 
                  value={f2Data.operadorMaquina} 
                  onChange={e => setF2Data({...f2Data, operadorMaquina: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Operador da forrageira"
                />
              </div>
            </div>

            {/* Linha Horímetro: HR INICIAL | HR FINAL | TOTAL HR */}
            <div className="grid grid-cols-3 gap-2 bg-stone-200 p-2 rounded font-bold uppercase text-center">
              <div>
                <span className="text-[10px] block">HR INICIAL:</span>
                <input 
                  type="text" 
                  value={f2Data.hrInicial} 
                  onChange={e => setF2Data({...f2Data, hrInicial: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                />
              </div>
              <div>
                <span className="text-[10px] block">HR FINAL:</span>
                <input 
                  type="text" 
                  value={f2Data.hrFinal} 
                  onChange={e => setF2Data({...f2Data, hrFinal: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                />
              </div>
              <div>
                <span className="text-[10px] block">TOTAL HR:</span>
                <input 
                  type="text" 
                  value={f2Data.totalHr} 
                  onChange={e => setF2Data({...f2Data, totalHr: e.target.value})}
                  className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5 font-black" 
                />
              </div>
            </div>

            {/* VALOR HR | VALOR TOTAL */}
            <div className="grid grid-cols-2 gap-2 bg-stone-200 p-2 rounded font-bold uppercase text-center">
              <div className="flex items-center justify-center gap-1">
                <span>VALOR HR:</span>
                <input 
                  type="text" 
                  value={f2Data.valorHr} 
                  onChange={e => setF2Data({...f2Data, valorHr: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-28 text-center" 
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="flex items-center justify-center gap-1">
                <span>VALOR TOTAL:</span>
                <input 
                  type="text" 
                  value={f2Data.valorTotal} 
                  onChange={e => setF2Data({...f2Data, valorTotal: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-32 text-center font-black" 
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* SEÇÃO ACOPLADA: CONTROLE ABASTECIMENTO (Barra Verde #188038) */}
            <div className="pt-2">
              <div className="bg-[#188038] text-white text-center py-1 rounded font-black text-xs uppercase tracking-wider shadow-xs">
                CONTROLE ABASTECIMENTO
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase">
                  <div className="flex items-center gap-1">
                    <span>DATA:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastData} 
                      onChange={e => setF2Data({...f2Data, abastData: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full" 
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>POSTO:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastPosto} 
                      onChange={e => setF2Data({...f2Data, abastPosto: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full" 
                      placeholder="Nome do posto"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase text-center">
                  <div>
                    <span className="text-[10px] block">LITROS:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastLitros} 
                      onChange={e => setF2Data({...f2Data, abastLitros: e.target.value})}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                    />
                  </div>
                  <div>
                    <span className="text-[10px] block">VALOR LITRO:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastValorLitro} 
                      onChange={e => setF2Data({...f2Data, abastValorLitro: e.target.value})}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] block">HR:</span>
                    <input 
                      type="text" 
                      value={f2Data.abastHr} 
                      onChange={e => setF2Data({...f2Data, abastHr: e.target.value})}
                      className="bg-white border border-stone-300 px-1 py-0.5 rounded text-xs w-full text-center mt-0.5" 
                    />
                  </div>
                </div>

                <div className="bg-[#e0f0e3] p-2 rounded font-bold uppercase flex items-center justify-between">
                  <span>VALOR TOTAL R$:</span>
                  <input 
                    type="text" 
                    value={f2Data.abastValorTotal} 
                    onChange={e => setF2Data({...f2Data, abastValorTotal: e.target.value})}
                    className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-36 text-right font-black" 
                    placeholder="R$ 0,00"
                  />
                </div>

                <div className="border-b border-stone-300 pb-1 pt-1 flex items-center gap-1">
                  <span className="font-bold text-stone-700">Obs.:</span>
                  <input 
                    type="text" 
                    value={f2Data.abastObs} 
                    onChange={e => setF2Data({...f2Data, abastObs: e.target.value})}
                    className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. FORMULÁRIO DE CONTROLE DE CARGAS (01 a 64) */}
        {/* ========================================================================= */}
        {activeFormTab === 'cargas' && (
          <div className="w-full max-w-2xl bg-white text-stone-900 border-2 border-stone-800 rounded-xl p-4 sm:p-6 shadow-xl font-sans text-xs space-y-3.5 print:border-none print:shadow-none print:p-0">
            
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                {companyLogo ? (
                  <img 
                    src={companyLogo} 
                    alt={companyTradeName} 
                    className="h-14 w-auto max-w-[130px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="border-2 border-stone-900 rounded-md px-2.5 py-1 font-black text-base bg-stone-100">
                    {companyTradeName}
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-black uppercase">{companyTradeName}</h2>
                  <p className="text-[10px] font-bold text-stone-600">CNPJ: {companyCnpj}</p>
                  <p className="text-[10px] text-stone-500">{companyAddress}</p>
                  <p className="text-[10px] font-bold text-stone-800 flex items-center gap-1 mt-0.5">
                    <Phone className="w-2.5 h-2.5 text-[#188038]" />
                    {companyPhone}
                  </p>
                </div>
              </div>

              {/* Título Verde */}
              <div className="text-right shrink-0">
                <span className="font-black text-sm sm:text-base text-[#188038] uppercase tracking-tight block">
                  CONTROLE DE CARGAS
                </span>
                <span className="text-[10px] font-mono text-stone-500 font-bold">TRANSPORTE / CAMINHÕES</span>
              </div>
            </div>

            {/* Dados: Data e Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 border-b border-stone-300 pb-1">
              <div className="sm:col-span-4 flex items-center gap-1">
                <span className="font-bold text-stone-700">Data:</span>
                <input 
                  type="text" 
                  value={f3Data.data} 
                  onChange={e => setF3Data({...f3Data, data: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="DD/MM/AAAA"
                />
              </div>
              <div className="sm:col-span-8 flex items-center gap-1">
                <span className="font-bold text-stone-700">Cliente:</span>
                <input 
                  type="text" 
                  value={f3Data.cliente} 
                  onChange={e => setF3Data({...f3Data, cliente: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Nome do cliente"
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="border-b border-stone-300 pb-1 flex items-center gap-1">
              <span className="font-bold text-stone-700">Endereço:</span>
              <input 
                type="text" 
                value={f3Data.endereco} 
                onChange={e => setF3Data({...f3Data, endereco: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                placeholder="Local de corte / entrega"
              />
            </div>

            {/* Placa e Motorista */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 border-b border-stone-300 pb-1">
              <div className="sm:col-span-5 flex items-center gap-1">
                <span className="font-bold text-stone-700">Placa:</span>
                <input 
                  type="text" 
                  value={f3Data.placa} 
                  onChange={e => setF3Data({...f3Data, placa: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0 uppercase" 
                  placeholder="ABC-1234"
                />
              </div>
              <div className="sm:col-span-7 flex items-center gap-1">
                <span className="font-bold text-stone-700">Motorista:</span>
                <input 
                  type="text" 
                  value={f3Data.motorista} 
                  onChange={e => setF3Data({...f3Data, motorista: e.target.value})}
                  className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                  placeholder="Nome do condutor"
                />
              </div>
            </div>

            {/* Máquina */}
            <div className="border-b border-stone-300 pb-1 flex items-center gap-1">
              <span className="font-bold text-stone-700">Máquina:</span>
              <input 
                type="text" 
                value={f3Data.maquina} 
                onChange={e => setF3Data({...f3Data, maquina: e.target.value})}
                className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                placeholder="Forrageira responsável pelo corte"
              />
            </div>

            {/* PAINEL DE BOTÕES DE 01 A 64: Cargas Selecionáveis em Tempo Real */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-stone-800">
                  Cargas: <span className="text-[#188038] font-black">({f3Data.selectedLoads.size} marcadas)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setF3Data(prev => ({ ...prev, selectedLoads: new Set() }))}
                  className="text-[10px] text-stone-500 hover:text-rose-600 underline font-semibold cursor-pointer"
                >
                  Limpar todas
                </button>
              </div>

              {/* Grid 8 colunas de botões numéricos com visual do bloco impresso */}
              <div className="grid grid-cols-8 sm:grid-cols-13 gap-1 p-2 bg-stone-100 rounded-lg border border-stone-300">
                {Array.from({ length: 64 }, (_, i) => i + 1).map(num => {
                  const numStr = num < 10 ? `0${num}` : `${num}`;
                  const isChecked = f3Data.selectedLoads.has(num);

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => toggleLoadCell(num)}
                      className={`h-7 rounded border font-mono font-bold text-xs flex items-center justify-center transition cursor-pointer select-none ${
                        isChecked
                          ? 'bg-[#188038] text-white border-[#188038] shadow-xs scale-105'
                          : 'bg-white text-stone-800 border-stone-400 hover:bg-stone-200'
                      }`}
                      title={`Carga ${numStr} - ${isChecked ? 'Marcada' : 'Pendente'}`}
                    >
                      {numStr}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QTDE DE CARGAS LONGE | KM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-200 p-2 rounded font-bold uppercase">
              <div className="flex items-center gap-1.5">
                <span>QTDE DE CARGAS LONGE:</span>
                <input 
                  type="number" 
                  value={f3Data.qtdeCargasLonge} 
                  onChange={e => setF3Data({...f3Data, qtdeCargasLonge: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-20 text-center font-black" 
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span>KM:</span>
                <input 
                  type="text" 
                  value={f3Data.km} 
                  onChange={e => setF3Data({...f3Data, km: e.target.value})}
                  className="bg-white border border-stone-300 px-2 py-0.5 rounded text-xs w-full text-center font-black" 
                  placeholder="0"
                />
              </div>
            </div>

            {/* SEÇÃO ACOPLADA: CONTROLE ABASTECIMENTO (Barra Verde #188038) */}
            <div className="pt-2">
              <div className="bg-[#188038] text-white text-center py-1 rounded font-black text-xs uppercase tracking-wider shadow-xs">
                CONTROLE ABASTECIMENTO
              </div>

              <div className="space-y-1.5 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase">
                  <div className="flex items-center gap-1">
                    <span>POSTO:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastPosto} 
                      onChange={e => setF3Data({...f3Data, abastPosto: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full" 
                      placeholder="Nome do posto"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>LITROS:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastLitros} 
                      onChange={e => setF3Data({...f3Data, abastLitros: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-center" 
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase">
                  <div className="flex items-center gap-1">
                    <span>VALOR POR LITRO:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastValorPorLitro} 
                      onChange={e => setF3Data({...f3Data, abastValorPorLitro: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-center" 
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>KM:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastKm} 
                      onChange={e => setF3Data({...f3Data, abastKm: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-center" 
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#e0f0e3] p-2 rounded font-bold uppercase">
                  <div className="flex items-center gap-1">
                    <span>VALOR TOTAL:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastValorTotal} 
                      onChange={e => setF3Data({...f3Data, abastValorTotal: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-right font-black" 
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>HR:</span>
                    <input 
                      type="text" 
                      value={f3Data.abastHr} 
                      onChange={e => setF3Data({...f3Data, abastHr: e.target.value})}
                      className="bg-white border border-stone-300 px-1.5 py-0.5 rounded text-xs w-full text-center" 
                      placeholder="Horímetro"
                    />
                  </div>
                </div>

                <div className="border-b border-stone-300 pb-1 pt-1 flex items-center gap-1">
                  <span className="font-bold text-stone-700">Obs.:</span>
                  <input 
                    type="text" 
                    value={f3Data.abastObs} 
                    onChange={e => setF3Data({...f3Data, abastObs: e.target.value})}
                    className="w-full bg-transparent border-none p-0 text-xs font-semibold focus:ring-0" 
                    placeholder="Observações do abastecimento"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
