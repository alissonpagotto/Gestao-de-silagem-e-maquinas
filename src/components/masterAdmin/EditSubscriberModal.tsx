import React, { useState, useEffect } from 'react';
import { X, Save, Search, AlertCircle, Building2, User, Key, MapPin, CreditCard, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { Subscriber, PlanDefinition } from '../../types/masterAdmin';
import { formatCpfCnpj, formatPhone, formatCep, formatIE, fetchAddressByCep } from '../../lib/formatters';

interface EditSubscriberModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: Subscriber | null;
  plans: PlanDefinition[];
  onSave: (subscriber: Subscriber) => void;
}

export const EditSubscriberModal: React.FC<EditSubscriberModalProps> = ({
  isOpen,
  onClose,
  subscriber,
  plans,
  onSave,
}) => {
  // Campos obrigatórios conforme diretriz:
  // NOME DO ASSINANTE, EMAIL DO RESPONSÁVEL, SENHA, TRIAL ATÉ (Data), CPF OU CNPJ,
  // INSCRIÇÃO ESTADUAL, TELEFONE, CEP, LOGRADOURO, Nº, BAIRRO, CIDADE e ESTADO.
  const [name, setName] = useState('');
  const [responsibleEmail, setResponsibleEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trialUntil, setTrialUntil] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [planId, setPlanId] = useState('');
  const [planName, setPlanName] = useState('Produtor Essencial');
  const [monthlyValue, setMonthlyValue] = useState<number>(195);
  const [status, setStatus] = useState<Subscriber['status']>('ativa');

  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState('');
  const [validationError, setValidationError] = useState('');

  // Carrega os dados ao abrir o modal
  useEffect(() => {
    if (subscriber) {
      setName(subscriber.name || '');
      setResponsibleEmail(subscriber.responsibleEmail || '');
      setPassword(subscriber.password || '');
      setTrialUntil(subscriber.trialUntil || '');
      setCpfCnpj(subscriber.cpfCnpj || '');
      setStateRegistration(subscriber.stateRegistration || '');
      setPhone(subscriber.phone || '');
      setCep(subscriber.cep || '');
      setStreet(subscriber.street || '');
      setNumber(subscriber.number || '');
      setNeighborhood(subscriber.neighborhood || '');
      setCity(subscriber.city || '');
      setState(subscriber.state || '');
      setPlanId(subscriber.planId || plans[0]?.id || 'starter');
      setPlanName(subscriber.planName || plans[0]?.name || 'Produtor Essencial');
      setMonthlyValue(subscriber.monthlyValue || 195);
      setStatus(subscriber.status || 'ativa');
    } else {
      // Novo Assinante
      setName('');
      setResponsibleEmail('');
      setPassword('');
      const trialDate = new Date();
      trialDate.setDate(trialDate.getDate() + 15);
      setTrialUntil(trialDate.toISOString().split('T')[0]);
      setCpfCnpj('');
      setStateRegistration('');
      setPhone('');
      setCep('');
      setStreet('');
      setNumber('');
      setNeighborhood('');
      setCity('');
      setState('PR');
      setPlanId(plans[0]?.id || 'starter');
      setPlanName(plans[0]?.name || 'Produtor Essencial');
      setMonthlyValue(plans[0]?.price || 195);
      setStatus('trial');
    }
    setCepError('');
    setValidationError('');
  }, [subscriber, isOpen, plans]);

  if (!isOpen) return null;

  // Gerador de senha aleatória segura
  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let res = 'Agro#';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
  };

  // Busca automática do CEP
  const handleCepSearch = async (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      setCepError('');
      try {
        const addr = await fetchAddressByCep(clean);
        if (addr) {
          if (addr.street) setStreet(addr.street);
          if (addr.neighborhood) setNeighborhood(addr.neighborhood);
          if (addr.city) setCity(addr.city);
          if (addr.state) setState(addr.state);
        } else {
          setCepError('CEP não localizado');
        }
      } catch {
        setCepError('Erro ao consultar CEP');
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handlePlanChangeByName = (selectedName: string) => {
    setPlanName(selectedName);
    const matched = plans.find(p => p.name.toLowerCase() === selectedName.toLowerCase());
    if (matched) {
      setPlanId(matched.id);
      setMonthlyValue(matched.price);
    } else {
      if (selectedName === 'Starter') setMonthlyValue(149);
      else if (selectedName === 'Pro') setMonthlyValue(299);
      else if (selectedName === 'Business') setMonthlyValue(599);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Informe o Nome do Assinante.');
      return;
    }
    if (!responsibleEmail.trim()) {
      setValidationError('Informe o E-mail do Responsável.');
      return;
    }

    const updatedSubscriber: Subscriber = {
      id: subscriber?.id || `sub-${Date.now()}`,
      name: name.trim(),
      responsibleEmail: responsibleEmail.trim(),
      password: password.trim() || subscriber?.password || 'Agro@123',
      trialUntil: trialUntil || new Date().toISOString().split('T')[0],
      cpfCnpj: cpfCnpj.trim(),
      stateRegistration: stateRegistration.trim(),
      phone: phone.trim(),
      cep: cep.trim(),
      street: street.trim(),
      number: number.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      planId,
      planName: planName || subscriber?.planName || 'Produtor Essencial',
      monthlyValue: Number(monthlyValue) || 0,
      status,
      createdAt: subscriber?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedSubscriber);
    onClose();
  };

  // Lista combinada de planos comerciais para o Select
  const availablePlanOptions = plans.length > 0 
    ? Array.from(new Set([...plans.map(p => p.name), 'Starter', 'Pro', 'Business']))
    : ['Produtor Essencial', 'Starter', 'Pro', 'Business'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-zinc-100 dark:bg-stone-900 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-300 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho do Modal */}
        <div className="px-5 py-4 bg-zinc-800 text-white flex items-center justify-between border-b border-zinc-700">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-zinc-200" />
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                {subscriber ? 'Editar Informações do Assinante' : 'Novo Assinante do Sistema'}
              </h3>
              <p className="text-xs text-zinc-300">
                Atualize o cadastro, plano comercial e credenciais em nuvem
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {validationError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Seção 1: Identificação & Acesso */}
          <div className="space-y-3 p-4 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-black text-zinc-900 dark:text-stone-100 uppercase tracking-wider border-b border-zinc-200 dark:border-stone-700 pb-2">
              <User className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>1. Identificação do Assinante & Acesso</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  NOME DO ASSINANTE *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Fazenda Santa Fé ou Agropecuária Sol Nascente"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  EMAIL DO RESPONSÁVEL *
                </label>
                <input
                  type="email"
                  required
                  value={responsibleEmail}
                  onChange={(e) => setResponsibleEmail(e.target.value)}
                  placeholder="responsavel@empresa.com.br"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300">
                    SENHA DE ACESSO
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 hover:underline flex items-center gap-1 cursor-pointer"
                    title="Gerar uma nova senha segura aleatória"
                  >
                    <Sparkles className="w-3 h-3 text-zinc-600" />
                    <span>Gerar Senha Aleatória</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Deixe em branco para manter a atual"
                    className="w-full p-2.5 pr-9 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-mono text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                  />
                  <Key className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Dados Fiscais & Contato */}
          <div className="space-y-3 p-4 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-black text-zinc-900 dark:text-stone-100 uppercase tracking-wider border-b border-zinc-200 dark:border-stone-700 pb-2">
              <CreditCard className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>2. Dados Fiscais & Contato</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  CPF OU CNPJ
                </label>
                <input
                  type="text"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-mono font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  INSCRIÇÃO ESTADUAL
                </label>
                <input
                  type="text"
                  value={stateRegistration}
                  onChange={(e) => setStateRegistration(formatIE(e.target.value))}
                  placeholder="ISENTO ou 000.000.000"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  TELEFONE / WHATSAPP
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Endereço & Localização com Busca Automática de CEP */}
          <div className="space-y-3 p-4 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-stone-700 pb-2">
              <div className="flex items-center gap-2 text-xs font-black text-zinc-900 dark:text-stone-100 uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <span>3. Endereço & Localização</span>
              </div>
              <span className="text-[11px] text-stone-400 font-medium">Busca automática via CEP</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  CEP (Busca Automática)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => {
                      const formatted = formatCep(e.target.value);
                      setCep(formatted);
                      handleCepSearch(formatted);
                    }}
                    onBlur={() => handleCepSearch(cep)}
                    placeholder="00000-000"
                    className="w-full p-2.5 pr-8 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                  />
                  {isLoadingCep ? (
                    <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin absolute right-2.5 top-2.5" />
                  ) : (
                    <Search className="w-4 h-4 text-stone-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  )}
                </div>
                {cepError && <span className="text-[10px] text-rose-500 font-bold block mt-0.5">{cepError}</span>}
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  LOGRADOURO
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Rua, Avenida, Rodovia ou Estrada Rural"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  Nº
                </label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="123 ou S/N"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  BAIRRO
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Centro, Zona Rural..."
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  CIDADE
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cidade"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  ESTADO
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="UF"
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 text-center uppercase focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 4: Dropdown 'PLANO ATUAL' conforme diretriz técnica */}
          <div className="space-y-3 p-4 bg-white dark:bg-stone-800 border border-zinc-300 dark:border-stone-700 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-black text-zinc-900 dark:text-stone-100 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>4. Plano Comercial & Status da Conta</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  PLANO ATUAL *
                </label>
                <select
                  value={planName}
                  onChange={(e) => handlePlanChangeByName(e.target.value)}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none cursor-pointer"
                >
                  {availablePlanOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-1">
                  Altera o pacote contratado e as permissões operacionais do assinante.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-stone-300 mb-1">
                  STATUS DA CONTA
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Subscriber['status'])}
                  className="w-full p-2.5 bg-zinc-50 dark:bg-stone-900 border border-zinc-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-zinc-600/30 focus:border-zinc-600 outline-none cursor-pointer"
                >
                  <option value="ativa">Ativa</option>
                  <option value="trial">Trial (Período de Testes)</option>
                  <option value="suspensa">Suspensa (Bloqueio Financeiro)</option>
                  <option value="inadimplente">Inadimplente</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          {/* Rodapé e Botões */}
          <div className="pt-4 border-t border-zinc-200 dark:border-stone-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold border border-zinc-900 flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações no Banco</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
