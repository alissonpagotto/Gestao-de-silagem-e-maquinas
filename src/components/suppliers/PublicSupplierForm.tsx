import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Building2, 
  Send, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Search, 
  Loader2,
  ArrowLeft,
  Truck
} from 'lucide-react';
import { SupplierFormSubmission } from '../../types';
import { 
  formatCpfCnpj, 
  formatCep, 
  formatPhone, 
  formatIE,
  cleanDigits, 
  fetchAddressByCep, 
  fetchCompanyByCnpj 
} from '../../lib/formatters';
import { saveSupplierSubmission } from '../../lib/supplierSubmissions';

export interface PublicSupplierFormProps {
  onBackToApp?: () => void;
}

export const PublicSupplierForm: React.FC<PublicSupplierFormProps> = ({ onBackToApp }) => {
  const [cnpjOrCpf, setCnpjOrCpf] = useState('');
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [category, setCategory] = useState('Combustível');
  const [stateRegistration, setStateRegistration] = useState('');
  const [municipalRegistration, setMunicipalRegistration] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('PR');
  const [notes, setNotes] = useState('');

  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCnpjChange = async (val: string) => {
    const formatted = formatCpfCnpj(val);
    setCnpjOrCpf(formatted);
    const digits = cleanDigits(val);
    if (digits.length === 14) {
      setIsLoadingCnpj(true);
      try {
        const res = await fetchCompanyByCnpj(digits);
        if (res.success) {
          if (res.corporateName && !name) setName(res.corporateName);
          if (res.tradeName && !tradeName) setTradeName(res.tradeName);
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
    if (!name.trim()) {
      setErrorMsg('Por favor, informe a Razão Social ou Nome do fornecedor.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Por favor, informe um telefone / WhatsApp de contato.');
      return;
    }

    const submission: SupplierFormSubmission = {
      id: `sup_sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      tradeName: tradeName.trim() || undefined,
      category,
      cnpjOrCpf: cnpjOrCpf.trim() || undefined,
      stateRegistration: stateRegistration.trim() || undefined,
      municipalRegistration: municipalRegistration.trim() || undefined,
      phone: phone.trim(),
      email: email.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      address: address.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      city: city.trim() || 'Região',
      state: state.trim() || 'PR',
      notes: notes.trim() || undefined,
      submittedAt: new Date().toISOString(),
      status: 'pendente',
    };

    saveSupplierSubmission(submission);
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
              Obrigado! Os dados cadastrais de <strong className="text-stone-900">{name}</strong> foram recebidos com segurança pelo setor de compras e fiscal da Silagem Fácil.
            </p>
          </div>
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-left text-xs text-stone-700 space-y-1">
            <p><span className="font-bold">Fornecedor:</span> {name}</p>
            {tradeName && <p><span className="font-bold">Nome Fantasia:</span> {tradeName}</p>}
            <p><span className="font-bold">Contato:</span> {phone}</p>
            {cnpjOrCpf && <p><span className="font-bold">CNPJ/CPF:</span> {cnpjOrCpf}</p>}
            {city && <p><span className="font-bold">Localização:</span> {city} - {state}</p>}
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setIsSubmitted(false);
                setCnpjOrCpf('');
                setName('');
                setTradeName('');
                setStateRegistration('');
                setMunicipalRegistration('');
                setPhone('');
                setEmail('');
                setZipCode('');
                setAddress('');
                setNeighborhood('');
                setCity('');
                setState('PR');
                setNotes('');
              }}
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-sm font-bold transition cursor-pointer"
            >
              Enviar Outro Cadastro
            </button>
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="flex-1 py-3 px-4 rounded-xl bg-[#0963cb] hover:bg-[#0852a8] text-white text-sm font-bold shadow-md transition cursor-pointer"
              >
                Voltar ao Sistema
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 py-6 px-3 sm:px-6 flex flex-col items-center justify-center font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-3xl bg-[#0a8bc1] rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
        
        {/* Header Superior */}
        <div className="bg-[#0963cb] px-6 py-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-inner">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Cadastro de Fornecedor & Parceiro
              </h1>
              <p className="text-xs text-blue-100 font-medium">
                Silagem Fácil — Cadastro comercial e emissão de notas fiscais
              </p>
            </div>
          </div>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="text-xs font-bold text-white/80 hover:text-white flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          )}
        </div>

        {/* Informações Instrucionais */}
        <div className="px-6 py-3 bg-[#0a8bc1] text-white text-xs font-medium border-b border-white/10">
          Preencha o formulário abaixo com os dados cadastrais da sua empresa para emissão de pedidos, ordens de compra e pagamentos.
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Card 1: Identificação e Dados Fiscais */}
          <div className="bg-[#b0d2ed] p-4 rounded-2xl border border-[#96c1e5] shadow-xs space-y-3">
            <div className="flex items-center space-x-2 border-b border-[#96c1e5]/60 pb-2">
              <Building2 className="w-4 h-4 text-black" />
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">
                Dados Principais & Fiscais
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-black uppercase">
                    CNPJ ou CPF (Auto-Busca)
                  </label>
                  {isLoadingCnpj && (
                    <span className="text-[10px] text-black font-bold flex items-center space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin text-[#0963cb]" />
                      <span>Buscando...</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={cnpjOrCpf}
                    onChange={(e) => handleCnpjChange(e.target.value)}
                    maxLength={18}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                  />
                  <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Razão Social / Nome Completo <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Categoria Principal
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                >
                  <option value="Combustível">Combustível & Arla</option>
                  <option value="Alimentação & Restaurante">Alimentação & Restaurante</option>
                  <option value="Peças & Oficinas">Peças & Manutenção</option>
                  <option value="Lonas & Embalagens">Lonas & Embalagens</option>
                  <option value="Sementes & Insumos">Sementes & Defensivos</option>
                  <option value="Inoculantes">Inoculantes & Nutrição</option>
                  <option value="Transporte & Frete">Transporte & Frete</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Inscrição Estadual (IE)
                </label>
                <input
                  type="text"
                  value={stateRegistration}
                  onChange={(e) => setStateRegistration(formatIE(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Inscrição Municipal (IM)
                </label>
                <input
                  type="text"
                  value={municipalRegistration}
                  onChange={(e) => setMunicipalRegistration(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  WhatsApp / Telefone <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    maxLength={15}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                  />
                  <Phone className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  E-mail Comercial / Financeiro
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Endereço */}
          <div className="bg-[#b0d2ed] p-4 rounded-2xl border border-[#96c1e5] shadow-xs space-y-3">
            <div className="flex items-center space-x-2 border-b border-[#96c1e5]/60 pb-2">
              <MapPin className="w-4 h-4 text-black" />
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">
                Endereço & Localização
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-black uppercase">
                    CEP (Auto-Busca)
                  </label>
                  {isLoadingCep && (
                    <span className="text-[10px] text-black font-bold flex items-center space-x-1">
                      <Loader2 className="w-3 h-3 animate-spin text-[#0963cb]" />
                      <span>Buscando...</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => handleCepChange(e.target.value)}
                    maxLength={9}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                  />
                  <Search className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Endereço / Logradouro / Número
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Bairro / Distrito
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-black uppercase mb-1">
                  Estado (UF)
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium uppercase focus:ring-2 focus:ring-[#0963cb]"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Observações e Dados Bancários */}
          <div className="bg-[#b0d2ed] p-4 rounded-2xl border border-[#96c1e5] shadow-xs space-y-3">
            <div className="flex items-center space-x-2 border-b border-[#96c1e5]/60 pb-2">
              <FileText className="w-4 h-4 text-black" />
              <h3 className="text-xs font-bold text-black uppercase tracking-wider">
                Observações, Dados Bancários ou Chave PIX
              </h3>
            </div>

            <div>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-black text-sm font-medium focus:ring-2 focus:ring-[#0963cb] resize-none"
              />
            </div>
          </div>

          {/* Botão de Envio */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-[#0963cb] hover:bg-[#0852a8] text-white font-bold text-sm shadow-xl transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
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
