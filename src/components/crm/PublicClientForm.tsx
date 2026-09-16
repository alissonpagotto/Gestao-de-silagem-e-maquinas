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
  fetchCompanyByCnpj 
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
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('PR');
  const [cattleType, setCattleType] = useState<'leite' | 'corte' | 'misto' | 'confinamento' | 'outro'>('leite');
  const [headCount, setHeadCount] = useState('');
  const [monthlyDemandTons, setMonthlyDemandTons] = useState('');
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
      setErrorMsg('Por favor, informe seu nome e o nome da propriedade.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Por favor, informe um telefone / WhatsApp de contato.');
      return;
    }

    const submission: ClientFormSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      farmName: farmName.trim(),
      cpfCnpj: cpfCnpj.trim() || undefined,
      stateRegistration: stateRegistration.trim() || undefined,
      phone: phone.trim(),
      email: email.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      address: address.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim() || 'Região',
      state: state.trim() || 'PR',
      cattleType,
      headCount: headCount ? parseInt(headCount) : undefined,
      monthlyDemandTons: monthlyDemandTons ? parseFloat(monthlyDemandTons) : undefined,
      notes: notes.trim() || undefined,
      submittedAt: new Date().toISOString(),
      status: 'pendente',
    };

    saveClientSubmission(submission);
    setIsSubmitted(true);
    setErrorMsg(null);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#0a8bc1] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl border border-white/30 space-y-6">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-stone-900 tracking-tight">Ficha Enviada com Sucesso!</h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              Obrigado, <strong className="text-stone-900">{name}</strong>! Seus dados cadastrais da fazenda <strong className="text-stone-900">{farmName}</strong> foram recebidos com segurança pela equipe da Silagem Fácil.
            </p>
          </div>
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-left text-xs text-stone-700 space-y-1">
            <p><span className="font-bold">Produtor:</span> {name}</p>
            <p><span className="font-bold">Fazenda:</span> {farmName}</p>
            <p><span className="font-bold">Contato:</span> {phone}</p>
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
                setPhone('');
                setEmail('');
                setZipCode('');
                setAddress('');
                setNeighborhood('');
                setCity('');
                setHeadCount('');
                setMonthlyDemandTons('');
                setNotes('');
              }}
              className="flex-1 py-3 rounded-xl border border-stone-300 text-stone-700 font-bold text-sm hover:bg-stone-50 transition cursor-pointer"
            >
              Preencher Nova Ficha
            </button>
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="flex-1 py-3 rounded-xl bg-[#0963cb] text-white font-bold text-sm hover:bg-[#0852a8] transition shadow-md cursor-pointer"
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
    <div className="min-h-screen bg-[#0a8bc1] p-3 sm:p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/30 my-4">
        
        {/* Header */}
        <div className="bg-[#0963cb] p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
              <Tractor className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Ficha Cadastral do Produtor Rural
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 font-medium">
                Silagem Fácil • Cadastro de Clientes e Fornecimento de Silagem
              </p>
            </div>
          </div>
          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold transition text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Sistema</span>
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 bg-stone-50">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-sm font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Bloco 1: Identificação & Propriedade */}
          <div className="bg-[#b0d2ed] p-4 rounded-2xl border border-[#96c1e5] space-y-3">
            <div className="flex items-center space-x-2 text-black font-bold text-xs sm:text-sm">
              <Building2 className="w-4 h-4 text-[#0963cb]" />
              <span>DADOS DA PROPRIEDADE E DO PRODUTOR</span>
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
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  NOME DO PRODUTOR / RESPONSÁVEL <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  NOME DA FAZENDA / PROPRIEDADE <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  INSCRIÇÃO ESTADUAL (IE) / CADPRO
                </label>
                <input
                  type="text"
                  value={stateRegistration}
                  onChange={(e) => setStateRegistration(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  WHATSAPP / TELEFONE <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  E-MAIL (OPCIONAL)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>
            </div>
          </div>

          {/* Bloco 2: Localização e Endereço */}
          <div className="bg-[#b0d2ed] p-4 rounded-2xl border border-[#96c1e5] space-y-3">
            <div className="flex items-center space-x-2 text-black font-bold text-xs sm:text-sm">
              <MapPin className="w-4 h-4 text-[#0963cb]" />
              <span>ENDEREÇO E LOCALIZAÇÃO DA PROPRIEDADE</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  CEP
                  {isLoadingCep && <span className="ml-2 text-xs font-normal text-blue-800 animate-pulse">Buscando...</span>}
                </label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={9}
                  placeholder="00000-000"
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  ENDEREÇO / LINHA / RODOVIA
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  BAIRRO / COMUNIDADE
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  CIDADE
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  ESTADO (UF)
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
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

          {/* Bloco 3: Rebanho e Demanda */}
          <div className="bg-[#b0d2ed] p-4 rounded-2xl border border-[#96c1e5] space-y-3">
            <div className="flex items-center space-x-2 text-black font-bold text-xs sm:text-sm">
              <FileText className="w-4 h-4 text-[#0963cb]" />
              <span>ATIVIDADE PECUÁRIA E DEMANDA DE SILAGEM</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  TIPO DE REBANHO
                </label>
                <select
                  value={cattleType}
                  onChange={(e) => setCattleType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                >
                  <option value="leite">Gado de Leite</option>
                  <option value="corte">Gado de Corte</option>
                  <option value="confinamento">Confinamento Intensivo</option>
                  <option value="misto">Rebanho Misto</option>
                  <option value="outro">Outro / Haras</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  NÚMERO DE CABEÇAS
                </label>
                <input
                  type="number"
                  value={headCount}
                  onChange={(e) => setHeadCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  DEMANDA ESTIMADA (TONELADAS/MÊS)
                </label>
                <input
                  type="number"
                  value={monthlyDemandTons}
                  onChange={(e) => setMonthlyDemandTons(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-black uppercase mb-1">
                OBSERVAÇÕES TÉCNICAS / ROTA DE ACESSO / PREFERÊNCIAS
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#0963cb] resize-none"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold text-sm sm:text-base shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer"
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
