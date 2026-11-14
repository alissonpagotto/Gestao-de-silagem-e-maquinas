import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Tractor, 
  Send, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Building2, 
  Search, 
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { ClientFormSubmission } from '../../types';
import { 
  formatCpfCnpj, 
  formatCep, 
  formatPhone, 
  cleanDigits, 
  fetchAddressByCep, 
  fetchCompanyByCnpj,
  formatCurrencyBRL,
  formatarMoeda,
  desformatarMoeda,
  formatDateBR
} from '../../lib/formatters';
import { saveClientSubmission } from '../../lib/clientSubmissions';

export interface PublicClientFormProps {
  onBackToApp?: () => void;
}

export const PublicClientForm: React.FC<PublicClientFormProps> = ({ onBackToApp }) => {
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [name, setName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryContact, setSecondaryContact] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('PR');
  const [cattleType, setCattleType] = useState<'leite' | 'corte' | 'misto' | 'confinamento' | 'outro'>('leite');
  const [headCount, setHeadCount] = useState('');
  const [monthlyDemandTons, setMonthlyDemandTons] = useState('');
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [preferredPaymentTerm, setPreferredPaymentTerm] = useState('');
  const [notes, setNotes] = useState('');

  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCpfCnpjChange = async (val: string) => {
    const formatted = formatCpfCnpj(val);
    setCpfCnpj(formatted);
    const digits = cleanDigits(val);
    if (digits.length === 14) {
      setIsLoadingCnpj(true);
      try {
        const res = await fetchCompanyByCnpj(digits);
        if (res.success) {
          if (res.corporateName && !name) setName(res.corporateName);
          if (res.tradeName && !farmName) setFarmName(res.tradeName);
          if (res.phone && !phone) setPhone(formatPhone(res.phone));
          if (res.email && !email) setEmail(res.email);
          if (res.zipCode) setZipCode(formatCep(res.zipCode));
          if (res.street) setAddress(`${res.street}${res.number ? ', Nº ' + res.number : ''}`);
          if (res.neighborhood) setNeighborhood(res.neighborhood);
          if (res.city) setCity(res.city);
          if (res.state) setState(res.state);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingCnpj(false);
      }
    }
  };

  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setZipCode(formatted);
    const digits = cleanDigits(val);
    if (digits.length === 8) {
      setIsLoadingCep(true);
      try {
        const res = await fetchAddressByCep(digits);
        if (res.success) {
          if (res.street) setAddress(res.street);
          if (res.neighborhood) setNeighborhood(res.neighborhood);
          if (res.city) setCity(res.city);
          if (res.state) setState(res.state);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !farmName.trim()) {
      setErrorMsg('Por favor, informe o nome do cliente e o nome fantasia / estabelecimento.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Por favor, informe um telefone / WhatsApp de contato.');
      return;
    }

    const parsedCreditLimit = creditLimitInput ? desformatarMoeda(creditLimitInput) : 0;

    const submission: ClientFormSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      farmName: farmName.trim(),
      cpfCnpj: cpfCnpj.trim() || undefined,
      stateRegistration: stateRegistration.trim() || undefined,
      birthDate: birthDate.trim() || undefined,
      phone: phone.trim(),
      secondaryContact: secondaryContact.trim() || undefined,
      email: email.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      address: address.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim() || 'Região',
      state: state.trim() || 'PR',
      cattleType,
      headCount: headCount ? parseInt(headCount) : undefined,
      monthlyDemandTons: monthlyDemandTons ? parseFloat(monthlyDemandTons) : undefined,
      creditLimit: parsedCreditLimit > 0 ? parsedCreditLimit : undefined,
      preferredPaymentTerm: preferredPaymentTerm.trim() || undefined,
      notes: notes.trim() || undefined,
      submittedAt: new Date().toISOString(),
      status: 'pendente',
    };

    saveClientSubmission(submission);
    setIsSubmitted(true);
    setErrorMsg(null);
  };

  if (isSubmitted) {
    const parsedCreditLimit = creditLimitInput ? desformatarMoeda(creditLimitInput) : 0;
    return (
      <div className="min-h-screen bg-[#cad4e6] flex items-center justify-center p-4">
        <div className="bg-[#e0e6f1] rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl border border-black space-y-5">
          <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto border border-black shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Ficha Enviada com Sucesso!</h2>
            <p className="text-sm text-slate-800 leading-relaxed">
              Obrigado, <strong className="text-black">{name}</strong>! Os dados cadastrais de <strong className="text-black">{farmName}</strong> foram recebidos com segurança pela nossa equipe comercial.
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-black text-left text-xs text-slate-900 space-y-1.5">
            <p><span className="font-bold">Cliente / Responsável:</span> {name}</p>
            <p><span className="font-bold">Nome Fantasia / Estabelecimento:</span> {farmName}</p>
            {birthDate && <p><span className="font-bold">Data de Nascimento:</span> {formatDateBR(birthDate)}</p>}
            <p><span className="font-bold">Contato Principal:</span> {phone}</p>
            {secondaryContact && <p><span className="font-bold">Contato Secundário:</span> {secondaryContact}</p>}
            {parsedCreditLimit > 0 && <p><span className="font-bold">Limite de Crédito Solicitado:</span> {formatCurrencyBRL(parsedCreditLimit)}</p>}
            {preferredPaymentTerm && <p><span className="font-bold">Condição / Prazo Preferencial:</span> {preferredPaymentTerm}</p>}
            {city && <p><span className="font-bold">Localização:</span> {city} - {state}</p>}
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setIsSubmitted(false);
                setName('');
                setFarmName('');
                setCpfCnpj('');
                setStateRegistration('');
                setBirthDate('');
                setPhone('');
                setSecondaryContact('');
                setEmail('');
                setZipCode('');
                setAddress('');
                setNeighborhood('');
                setCity('');
                setHeadCount('');
                setMonthlyDemandTons('');
                setCreditLimitInput('');
                setPreferredPaymentTerm('');
                setNotes('');
              }}
              className="flex-1 py-2.5 rounded-xl border border-black bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 transition cursor-pointer"
            >
              Preencher Nova Ficha
            </button>
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 border border-emerald-800 transition shadow-md cursor-pointer"
              >
                Acessar Sistema
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#cad4e6] p-3 sm:p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl bg-[#cad4e6] rounded-2xl shadow-2xl overflow-hidden border border-black my-4">
        
        {/* Header */}
        <div className="bg-[#cad4e6] px-5 py-4 border-b border-black text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-black">
              <Tractor className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 uppercase">
                Ficha Cadastral de Cliente
              </h1>
              <p className="text-xs text-slate-800 font-medium">
                Cadastro comercial, endereço, contato e condições preferenciais
              </p>
            </div>
          </div>
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-black rounded-xl text-xs font-bold transition text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Sistema</span>
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3 bg-[#cad4e6]">
          {errorMsg && (
            <div className="p-3 bg-rose-600 border border-black text-white rounded-xl text-xs sm:text-sm font-bold">
              {errorMsg}
            </div>
          )}

          {/* Bloco 1: Identificação & Estabelecimento */}
          <div className="bg-[#e0e6f1] p-4 rounded-xl border border-black space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs sm:text-sm">
              <Building2 className="w-4 h-4 text-slate-900" />
              <span>DADOS DE IDENTIFICAÇÃO E CONTATO</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  CPF OU CNPJ
                  {isLoadingCnpj && <span className="ml-2 text-xs font-normal text-blue-800 animate-pulse">Buscando...</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cpfCnpj}
                    onChange={(e) => handleCpfCnpjChange(e.target.value)}
                    maxLength={18}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                  />
                  {isLoadingCnpj && (
                    <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-stone-400" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  NOME DO CLIENTE / RESPONSÁVEL <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  NOME FANTASIA / ESTABELECIMENTO <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  INSC. ESTADUAL (IE)
                </label>
                <input
                  type="text"
                  value={stateRegistration}
                  onChange={(e) => setStateRegistration(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  DATA DE NASCIMENTO
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  WHATSAPP / TELEFONE <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  CONTATO SECUNDÁRIO / RESPONSÁVEL
                </label>
                <input
                  type="text"
                  value={secondaryContact}
                  onChange={(e) => setSecondaryContact(e.target.value)}
                  placeholder="Nome e telefone alternativo..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
            </div>
          </div>

          {/* Bloco 2: Localização e Endereço */}
          <div className="bg-[#e0e6f1] p-4 rounded-xl border border-black space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs sm:text-sm">
              <MapPin className="w-4 h-4 text-slate-900" />
              <span>ENDEREÇO E LOCALIZAÇÃO</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  CEP
                  {isLoadingCep && <span className="ml-2 text-xs font-normal text-slate-700 animate-pulse">Buscando...</span>}
                </label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={9}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  ENDEREÇO / LOGRADOURO
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  BAIRRO / COMUNIDADE
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  CIDADE
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  ESTADO (UF)
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  <option value="PR">PR - Paraná</option>
                  <option value="SC">SC - Santa Catarina</option>
                  <option value="RS">RS - Rio Grande do Sul</option>
                  <option value="SP">SP - São Paulo</option>
                  <option value="MS">MS - Mato Grosso do Sul</option>
                  <option value="MG">MG - Minas Gerais</option>
                  <option value="GO">GO - Goiás</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bloco 3: Parâmetros Comerciais, Crédito & Observações */}
          <div className="bg-[#e0e6f1] p-4 rounded-xl border border-black space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs sm:text-sm">
              <FileText className="w-4 h-4 text-slate-900" />
              <span>ATIVIDADE, PARÂMETROS COMERCIAIS E OBSERVAÇÕES</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  ATIVIDADE / SEGMENTO
                </label>
                <select
                  value={cattleType}
                  onChange={(e) => setCattleType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  <option value="leite">Gado de Leite</option>
                  <option value="corte">Gado de Corte</option>
                  <option value="confinamento">Confinamento Intensivo</option>
                  <option value="misto">Rebanho Misto</option>
                  <option value="outro">Comércio / Empresa / Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  LIMITE DE CRÉDITO (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={creditLimitInput}
                  onChange={(e) => {
                    const formatted = formatarMoeda(e.target.value);
                    setCreditLimitInput(formatted ? `R$ ${formatted}` : '');
                  }}
                  placeholder="R$ 0,00"
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  CONDIÇÃO / PRAZO PREFERENCIAL
                </label>
                <select
                  value={preferredPaymentTerm}
                  onChange={(e) => setPreferredPaymentTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  <option value="">Opcional / Padrão</option>
                  <option value="À Vista">À Vista</option>
                  <option value="7 Dias">7 Dias</option>
                  <option value="14 Dias">14 Dias</option>
                  <option value="15 Dias">15 Dias</option>
                  <option value="30 Dias">30 Dias</option>
                  <option value="30/60 Dias">30/60 Dias</option>
                  <option value="30/60/90 Dias">30/60/90 Dias</option>
                  <option value="Faturado / Personalizado">Faturado / Personalizado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  E-MAIL (OPCIONAL)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  Nº DE CABEÇAS / UNIDADES
                </label>
                <input
                  type="number"
                  value={headCount}
                  onChange={(e) => setHeadCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                  DEMANDA ESTIMADA (TON/MÊS)
                </label>
                <input
                  type="number"
                  value={monthlyDemandTons}
                  onChange={(e) => setMonthlyDemandTons(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-900 uppercase mb-1">
                OBSERVAÇÕES COMERCIAIS / ROTA DE ACESSO / PREFERÊNCIAS
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-400 bg-white text-black text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-600 resize-none"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex justify-end border-t border-black">
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md border border-emerald-800 transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Enviar Ficha Cadastral</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
