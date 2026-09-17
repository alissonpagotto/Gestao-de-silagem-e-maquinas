import React, { useState, useEffect } from 'react';
import { X, Save, Search, AlertCircle, Building2, User, Key, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
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
      setPlanId(subscriber.planId || plans[0]?.id || 'plano-pro');
      setMonthlyValue(subscriber.monthlyValue || 295);
      setStatus(subscriber.status || 'ativa');
    } else {
      // Novo Assinante
      setName('');
      setResponsibleEmail('');
      setPassword('');
      const trialDate = new Date();
      trialDate.setDate(trialDate.getDate() + 7);
      setTrialUntil(trialDate.toISOString().split('T')[0]);
      setCpfCnpj('');
      setStateRegistration('');
      setPhone('');
      setCep('');
      setStreet('');
      setNumber('');
      setNeighborhood('');
      setCity('');
      setState('SP');
      setPlanId(plans[0]?.id || 'plano-pro');
      setMonthlyValue(plans[0]?.price || 295);
      setStatus('trial');
    }
    setCepError('');
    setValidationError('');
  }, [subscriber, isOpen, plans]);

  if (!isOpen) return null;

  // Busca automática do CEP
  const handleCepBlur = async () => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      setCepError('');
      try {
        const addr = await fetchAddressByCep(clean);
        if (addr) {
          setStreet(addr.street || street);
          setNeighborhood(addr.neighborhood || neighborhood);
          setCity(addr.city || city);
          setState(addr.state || state);
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

  const handlePlanChange = (selectedPlanId: string) => {
    setPlanId(selectedPlanId);
    const selected = plans.find(p => p.id === selectedPlanId);
    if (selected) {
      setMonthlyValue(selected.price);
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

    const selectedPlan = plans.find(p => p.id === planId);

    const updatedSubscriber: Subscriber = {
      id: subscriber?.id || `sub-${Date.now()}`,
      name: name.trim(),
      responsibleEmail: responsibleEmail.trim(),
      password: password.trim() || subscriber?.password || 'agro1234',
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
      planName: selectedPlan?.name || subscriber?.planName || 'Frota Pro',
      monthlyValue: Number(monthlyValue) || 0,
      status,
      createdAt: subscriber?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedSubscriber);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Cabeçalho do Modal */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-emerald-200" />
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight">
                {subscriber ? 'Editar Informações do Assinante' : 'Novo Assinante do Sistema'}
              </h3>
              <p className="text-xs text-emerald-100/80">
                Atualize o cadastro fiscal, acesso e limites da assinatura
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
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
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800 pb-1.5">
              <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>1. Identificação do Assinante & Acesso</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  NOME DO ASSINANTE *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Agropecuária Santa Fé Ltda ou Fazenda Sol Nascente"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  EMAIL DO RESPONSÁVEL *
                </label>
                <input
                  type="email"
                  required
                  value={responsibleEmail}
                  onChange={(e) => setResponsibleEmail(e.target.value)}
                  placeholder="responsavel@empresa.com.br"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  SENHA DE ACESSO
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Deixe em branco para manter a atual"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                  <Key className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Dados Fiscais & Contato */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800 pb-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>2. Dados Fiscais, Plano & Contato</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  CPF OU CNPJ
                </label>
                <input
                  type="text"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00 ou CNPJ"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  INSCRIÇÃO ESTADUAL
                </label>
                <input
                  type="text"
                  value={stateRegistration}
                  onChange={(e) => setStateRegistration(formatIE(e.target.value))}
                  placeholder="Ou 'ISENTO'"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  TELEFONE / WHATSAPP
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  TRIAL ATÉ (DATA)
                </label>
                <input
                  type="date"
                  value={trialUntil}
                  onChange={(e) => setTrialUntil(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  PLANO CONTRATADO
                </label>
                <select
                  value={planId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  STATUS DA ASSINATURA
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-black text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                >
                  <option value="ativa">Ativa (Em dia)</option>
                  <option value="trial">Em Período de Teste (Trial)</option>
                  <option value="inadimplente">Inadimplente</option>
                  <option value="suspensa">Suspensa</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          {/* Seção 3: Endereço do Assinante */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-stone-900 dark:text-stone-100 uppercase tracking-wider border-b border-stone-200 dark:border-stone-800 pb-1.5">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>3. Endereço & Localização</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  CEP
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => setCep(formatCep(e.target.value))}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                  {isLoadingCep && (
                    <span className="absolute right-3 top-3 text-[10px] text-stone-400 animate-pulse font-bold">
                      Buscando...
                    </span>
                  )}
                </div>
                {cepError && <span className="text-[10px] text-rose-500 font-bold block mt-0.5">{cepError}</span>}
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  LOGRADOURO
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Rua, Avenida, Rodovia"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Nº
                </label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="123 ou S/N"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  BAIRRO
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Centro, Zona Rural..."
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-semibold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  CIDADE
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Cidade"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  ESTADO
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="UF"
                  className="w-full p-2.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs font-bold text-stone-900 dark:text-stone-100 text-center uppercase focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Rodapé e Botões */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
